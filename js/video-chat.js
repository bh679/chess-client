/**
 * VideoChat — WebRTC peer connection manager for live video during chess games.
 *
 * Uses the existing MultiplayerClient WebSocket for signaling (offer/answer/ICE).
 * Media flows peer-to-peer via RTCPeerConnection.
 */

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;
const ICE_DISCONNECT_GRACE_MS = 4000; // wait before restarting on 'disconnected'

export class VideoChat {
  /**
   * @param {import('./multiplayer.js').MultiplayerClient} multiplayerClient
   * @param {import('./diagnostics.js').Diagnostics} [diagnostics]
   */
  constructor(multiplayerClient, diagnostics) {
    this._mp = multiplayerClient;
    this._diag = diagnostics || null;
    this._peerConnection = null;
    this._localStream = null;
    this._remoteStream = null;
    this._isInitiator = false;
    this._iceServers = null;

    // ICE candidate queue — holds candidates received before remote description is set
    this._pendingIceCandidates = [];
    this._remoteDescriptionReady = false;

    // ICE reconnection state
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;

    // Event callbacks — set by app.js
    this.onLocalStream = null;         // (stream: MediaStream) => void
    this.onRemoteStream = null;        // (stream: MediaStream) => void
    this.onDisconnected = null;        // () => void
    this.onError = null;               // (msg: string) => void
    this.onReconnecting = null;        // (attempt: number, max: number) => void
    this.onReconnected = null;         // () => void
    this.onRemoteVideoMuted = null;    // () => void
    this.onRemoteVideoUnmuted = null;  // () => void
  }

  // --- Public API ---

  /**
   * Fetch ICE server config (STUN + optional TURN) from the server.
   * Falls back to STUN-only if the endpoint is unavailable.
   */
  async fetchIceServers() {
    try {
      const res = await fetch('/api/chess/ice-servers');
      if (res.ok) {
        const body = await res.json();
        // Support both new { iceServers, turnProvider } and legacy flat-array responses
        const isWrapped = body && !Array.isArray(body) && Array.isArray(body.iceServers);
        this._iceServers = isWrapped ? body.iceServers : body;
        const turnProvider = isWrapped ? (body.turnProvider || 'unknown') : 'unknown';
        console.log('[VideoChat] Fetched', this._iceServers.length, 'ICE servers, provider:', turnProvider);
        if (this._diag) {
          const hasTurn = this._iceServers.some(s =>
            Array.isArray(s.urls) ? s.urls.some(u => u.startsWith('turn')) : String(s.urls).startsWith('turn')
          );
          this._diag.iceServersConfig(this._iceServers.length, hasTurn, turnProvider);
        }
      } else {
        console.warn('[VideoChat] ICE servers endpoint returned', res.status, '— using fallback STUN');
        if (this._diag) this._diag.record('webrtc', 'ice_servers_fetch_failed', { status: res.status });
      }
    } catch (err) {
      console.warn('[VideoChat] ICE servers fetch failed:', err.message, '— using fallback STUN');
      if (this._diag) this._diag.record('webrtc', 'ice_servers_fetch_error', { message: err.message });
    }
  }

  /** Whether local camera stream is already active */
  hasLocalStream() {
    return !!(this._localStream);
  }

  /**
   * Request camera and microphone access.
   * @returns {Promise<MediaStream>}
   */
  async requestCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Video calls are not supported in your browser.');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
    } catch (err) {
      let msg;
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission denied. Please enable camera access in browser settings.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera or microphone found.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is in use by another application.';
      } else {
        msg = 'Could not access camera: ' + err.message;
      }
      if (this.onCameraError) this.onCameraError(msg);
      throw new Error(msg);
    }
    this._localStream = stream;
    if (this.onLocalStream) this.onLocalStream(stream);
    return stream;
  }

  /**
   * Start the WebRTC call. If initiator, creates and sends an offer.
   * @param {boolean} isInitiator
   */
  async startCall(isInitiator) {
    this._isInitiator = isInitiator;
    this._reconnectAttempts = 0;
    if (this._diag) this._diag.record('webrtc', 'call_start', { isInitiator });

    // Guard: if handleOffer() already created a PC and processed an offer
    // while we were waiting (e.g. during fetchIceServers()), don't overwrite it.
    if (this._peerConnection && this._peerConnection.remoteDescription) {
      return;
    }

    // Guard: if a call is already in progress (negotiating), don't restart it
    if (this._peerConnection && this._peerConnection.signalingState !== 'closed') {
      return;
    }

    // If a stale PC exists without remote description, close it first
    if (this._peerConnection) {
      this._peerConnection.close();
    }

    this._remoteDescriptionReady = false;
    this._pendingIceCandidates = [];
    this._peerConnection = this._createPeerConnection();

    // Add local tracks to the connection
    if (this._localStream) {
      for (const track of this._localStream.getTracks()) {
        this._peerConnection.addTrack(track, this._localStream);
      }
    }

    if (isInitiator) {
      try {
        const offer = await this._peerConnection.createOffer();
        await this._peerConnection.setLocalDescription(offer);
        this._mp.sendRtcOffer(this._peerConnection.localDescription);
        if (this._diag) this._diag.sdpExchange('sent', 'offer');
      } catch (err) {
        if (this._diag) this._diag.webrtcError('createOffer', err.message);
        if (this.onError) this.onError('Failed to create video offer: ' + err.message);
      }
    }
  }

  /**
   * Handle incoming WebRTC offer from opponent.
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleOffer(sdp) {
    if (this._diag) this._diag.sdpExchange('received', 'offer');
    if (!this._peerConnection) {
      // Ensure ICE servers (including TURN) are fetched before creating the peer connection.
      // The offer can arrive while onVideoStart is still awaiting fetchIceServers(), so we
      // must guard here too — otherwise the responder gets STUN-only and ICE fails on mobile.
      if (!this._iceServers) await this.fetchIceServers();
      this._remoteDescriptionReady = false;
      this._pendingIceCandidates = [];
      this._peerConnection = this._createPeerConnection();
      if (this._localStream) {
        for (const track of this._localStream.getTracks()) {
          this._peerConnection.addTrack(track, this._localStream);
        }
      }
    }
    try {
      await this._peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      this._remoteDescriptionReady = true;
      await this._flushIceCandidates();
      const answer = await this._peerConnection.createAnswer();
      await this._peerConnection.setLocalDescription(answer);
      this._mp.sendRtcAnswer(this._peerConnection.localDescription);
      if (this._diag) this._diag.sdpExchange('sent', 'answer');
    } catch (err) {
      if (this._diag) this._diag.webrtcError('handleOffer', err.message);
      if (this.onError) this.onError('Failed to handle video offer: ' + err.message);
    }
  }

  /**
   * Handle incoming WebRTC answer from opponent.
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleAnswer(sdp) {
    if (this._diag) this._diag.sdpExchange('received', 'answer');
    if (!this._peerConnection) return;
    // Only accept an answer when we've sent an offer
    if (this._peerConnection.signalingState !== 'have-local-offer') return;
    try {
      await this._peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      this._remoteDescriptionReady = true;
      await this._flushIceCandidates();
    } catch (err) {
      if (this._diag) this._diag.webrtcError('handleAnswer', err.message);
      if (this.onError) this.onError('Failed to handle video answer: ' + err.message);
    }
  }

  /**
   * Handle incoming ICE candidate from opponent.
   * Queues candidates if the remote description is not yet set.
   * @param {RTCIceCandidateInit} candidate
   */
  async handleIceCandidate(candidate) {
    if (!this._peerConnection) {
      // No PC yet — queue for later (startCall or handleOffer will flush)
      this._pendingIceCandidates.push(candidate);
      return;
    }
    if (!this._remoteDescriptionReady) {
      this._pendingIceCandidates.push(candidate);
      return;
    }
    try {
      await this._peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // ICE candidate errors are non-fatal; log but don't alert
      console.warn('ICE candidate error:', err.message);
    }
  }

  /**
   * Toggle audio track. Returns new enabled state.
   * @returns {boolean}
   */
  toggleAudio() {
    if (!this._localStream) return false;
    const audioTrack = this._localStream.getAudioTracks()[0];
    if (!audioTrack) return false;
    audioTrack.enabled = !audioTrack.enabled;
    return audioTrack.enabled;
  }

  /**
   * Toggle video track. Returns new enabled state.
   * @returns {boolean}
   */
  toggleVideo() {
    if (!this._localStream) return false;
    const videoTrack = this._localStream.getVideoTracks()[0];
    if (!videoTrack) return false;
    videoTrack.enabled = !videoTrack.enabled;
    return videoTrack.enabled;
  }

  /**
   * Replace the outgoing video track with a pre-processed one (e.g. canvas crop).
   * Uses RTCRtpSender.replaceTrack() — no SDP renegotiation required.
   * Safe to call before or after the peer connection is established;
   * does nothing if no video sender exists yet.
   * @param {MediaStreamTrack} newTrack
   */
  async replaceVideoTrack(newTrack) {
    if (!this._peerConnection) return;
    const sender = this._peerConnection.getSenders()
      .find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  /**
   * Stop all media and close the peer connection.
   */
  stop() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    if (this._localStream) {
      for (const track of this._localStream.getTracks()) {
        track.stop();
      }
      this._localStream = null;
    }
    this._remoteStream = null;
    this._remoteDescriptionReady = false;
    this._pendingIceCandidates = [];
    if (this._peerConnection) {
      this._peerConnection.close();
      this._peerConnection = null;
    }
  }

  /**
   * @returns {boolean} true if ICE servers have been fetched from the server
   */
  hasIceServers() {
    return this._iceServers !== null;
  }

  /**
   * @returns {boolean}
   */
  isActive() {
    return !!(this._peerConnection && this._peerConnection.connectionState === 'connected');
  }

  /**
   * Check if the browser supports video calls.
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // --- Private ---

  /**
   * Attempt an ICE restart to recover a disconnected/failed peer connection.
   * Only the initiator (white) sends a new offer — the non-initiator waits.
   * Uses exponential backoff up to MAX_RECONNECT_ATTEMPTS.
   */
  async _attemptIceRestart() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;

    if (!this._peerConnection) return;

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[VideoChat] ICE restart exhausted after', MAX_RECONNECT_ATTEMPTS, 'attempts');
      if (this._diag) this._diag.record('webrtc', 'ice_restart_exhausted', { attempts: this._reconnectAttempts });
      if (this.onDisconnected) this.onDisconnected();
      return;
    }

    this._reconnectAttempts++;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, this._reconnectAttempts - 1), 30000);
    console.log(`[VideoChat] ICE restart attempt ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    if (this._diag) this._diag.record('webrtc', 'ice_restart_attempt', { attempt: this._reconnectAttempts });
    if (this.onReconnecting) this.onReconnecting(this._reconnectAttempts, MAX_RECONNECT_ATTEMPTS);

    if (this._isInitiator) {
      try {
        const offer = await this._peerConnection.createOffer({ iceRestart: true });
        await this._peerConnection.setLocalDescription(offer);
        this._mp.sendRtcOffer(this._peerConnection.localDescription);
        if (this._diag) this._diag.sdpExchange('sent', 'offer_restart');
      } catch (err) {
        console.warn('[VideoChat] ICE restart offer failed:', err.message);
        if (this._diag) this._diag.webrtcError('iceRestart', err.message);
      }
    }
    // Both initiator and non-initiator schedule a follow-up check.
    // If the connection recovers, oniceconnectionstatechange 'connected' will clear this timer.
    this._reconnectTimer = setTimeout(() => this._attemptIceRestart(), delay);
  }

  /**
   * Flush queued ICE candidates now that remote description is set.
   */
  async _flushIceCandidates() {
    const pending = this._pendingIceCandidates.splice(0);
    for (const candidate of pending) {
      try {
        await this._peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('ICE candidate flush error:', err.message);
      }
    }
  }

  _createPeerConnection() {
    const iceServers = this._iceServers || FALLBACK_ICE_SERVERS;
    console.log('[VideoChat] Creating PC with', iceServers.length, 'ICE servers');
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._mp.sendRtcIce(event.candidate);
        if (this._diag && event.candidate.candidate) {
          const parsed = this._parseCandidate(event.candidate.candidate);
          this._diag.iceCandidateLocal(parsed);
        }
      } else if (this._diag) {
        this._diag.record('webrtc', 'ice_gathering_complete', {});
      }
    };

    pc.ontrack = (event) => {
      console.log('[VideoChat] Remote track received:', event.track.kind);
      if (this._diag) this._diag.remoteTrackReceived(event.track.kind);
      this._remoteStream = event.streams[0];
      if (this.onRemoteStream) this.onRemoteStream(event.streams[0]);

      // Monitor remote video track for mute/unmute (e.g. iOS backgrounding)
      if (event.track.kind === 'video') {
        event.track.onmute = () => {
          console.log('[VideoChat] Remote video track muted');
          if (this._diag) this._diag.record('webrtc', 'remote_track_muted', { kind: 'video' });
          if (this.onRemoteVideoMuted) this.onRemoteVideoMuted();
        };
        event.track.onunmute = () => {
          console.log('[VideoChat] Remote video track unmuted');
          if (this._diag) this._diag.record('webrtc', 'remote_track_unmuted', { kind: 'video' });
          if (this.onRemoteVideoUnmuted) this.onRemoteVideoUnmuted();
        };
        event.track.onended = () => {
          console.log('[VideoChat] Remote video track ended');
          if (this._diag) this._diag.record('webrtc', 'remote_track_ended', { kind: 'video' });
          this._attemptIceRestart();
        };
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[VideoChat] ICE state:', state);
      if (this._diag) this._diag.iceStateChange(state);

      if (state === 'connected' || state === 'completed') {
        // Connection recovered — clear any pending restart and reset counter
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
        if (this._reconnectAttempts > 0) {
          console.log('[VideoChat] ICE reconnected after', this._reconnectAttempts, 'attempt(s)');
          if (this._diag) this._diag.record('webrtc', 'ice_reconnected', { attempts: this._reconnectAttempts });
          this._reconnectAttempts = 0;
          if (this.onReconnected) this.onReconnected();
        }
      } else if (state === 'disconnected') {
        // Transient — wait before restarting in case it self-recovers
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this._attemptIceRestart(), ICE_DISCONNECT_GRACE_MS);
      } else if (state === 'failed') {
        // Hard failure — restart immediately
        this._attemptIceRestart();
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[VideoChat] Connection state:', state);
      if (this._diag) this._diag.connectionStateChange(state);
      // ICE restart handles recovery; only call onDisconnected if ICE gives up
    };

    pc.onicegatheringstatechange = () => {
      if (this._diag) this._diag.record('webrtc', 'ice_gathering_state', {
        state: pc.iceGatheringState,
      });
    };

    return pc;
  }

  /**
   * Parse an ICE candidate string for diagnostic logging.
   * Extracts candidate type (host/srflx/relay) and protocol.
   */
  _parseCandidate(candidateStr) {
    const typeMatch = candidateStr.match(/typ\s+(host|srflx|prflx|relay)/);
    const protoMatch = candidateStr.match(/\s(udp|tcp)\s/i);
    return {
      type: typeMatch ? typeMatch[1] : 'unknown',
      protocol: protoMatch ? protoMatch[1].toLowerCase() : 'unknown',
    };
  }
}
