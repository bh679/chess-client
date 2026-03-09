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

export class VideoChat {
  /**
   * @param {import('./multiplayer.js').MultiplayerClient} multiplayerClient
   */
  constructor(multiplayerClient) {
    this._mp = multiplayerClient;
    this._peerConnection = null;
    this._localStream = null;
    this._remoteStream = null;
    this._isInitiator = false;
    this._iceServers = null;

    // ICE candidate queue — holds candidates received before remote description is set
    this._pendingIceCandidates = [];
    this._remoteDescriptionReady = false;

    // Event callbacks — set by app.js
    this.onLocalStream = null;   // (stream: MediaStream) => void
    this.onRemoteStream = null;  // (stream: MediaStream) => void
    this.onDisconnected = null;  // () => void
    this.onError = null;         // (msg: string) => void
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
        this._iceServers = await res.json();
        console.log('[VideoChat] Fetched', this._iceServers.length, 'ICE servers');
      } else {
        console.warn('[VideoChat] ICE servers endpoint returned', res.status, '— using fallback STUN');
      }
    } catch (err) {
      console.warn('[VideoChat] ICE servers fetch failed:', err.message, '— using fallback STUN');
    }
  }

  /**
   * Request camera and microphone access.
   * @returns {Promise<MediaStream>}
   */
  async requestCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Video calls are not supported in your browser.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      this._localStream = stream;
      if (this.onLocalStream) this.onLocalStream(stream);
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Camera permission denied. Please enable camera access in browser settings.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('No camera or microphone found.');
      }
      if (err.name === 'NotReadableError') {
        throw new Error('Camera is in use by another application.');
      }
      throw new Error('Could not access camera: ' + err.message);
    }
  }

  /**
   * Start the WebRTC call. If initiator, creates and sends an offer.
   * @param {boolean} isInitiator
   */
  async startCall(isInitiator) {
    this._isInitiator = isInitiator;

    // Guard: if handleOffer() already created a PC and processed an offer
    // while we were waiting (e.g. during fetchIceServers()), don't overwrite it.
    if (this._peerConnection && this._peerConnection.remoteDescription) {
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
      } catch (err) {
        if (this.onError) this.onError('Failed to create video offer: ' + err.message);
      }
    }
  }

  /**
   * Handle incoming WebRTC offer from opponent.
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleOffer(sdp) {
    if (!this._peerConnection) {
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
    } catch (err) {
      if (this.onError) this.onError('Failed to handle video offer: ' + err.message);
    }
  }

  /**
   * Handle incoming WebRTC answer from opponent.
   * @param {RTCSessionDescriptionInit} sdp
   */
  async handleAnswer(sdp) {
    if (!this._peerConnection) return;
    try {
      await this._peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      this._remoteDescriptionReady = true;
      await this._flushIceCandidates();
    } catch (err) {
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
      }
    };

    pc.ontrack = (event) => {
      console.log('[VideoChat] Remote track received:', event.track.kind);
      this._remoteStream = event.streams[0];
      if (this.onRemoteStream) this.onRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[VideoChat] ICE state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[VideoChat] Connection state:', state);
      if (state === 'disconnected' || state === 'failed') {
        if (this.onDisconnected) this.onDisconnected();
      }
    };

    return pc;
  }
}
