/**
 * VideoChat — WebRTC peer connection manager for live video during chess games.
 *
 * Uses the existing MultiplayerClient WebSocket for signaling (offer/answer/ICE).
 * Media flows peer-to-peer via RTCPeerConnection.
 */

const ICE_SERVERS = [
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

    // Event callbacks — set by app.js
    this.onLocalStream = null;   // (stream: MediaStream) => void
    this.onRemoteStream = null;  // (stream: MediaStream) => void
    this.onDisconnected = null;  // () => void
    this.onError = null;         // (msg: string) => void
  }

  // --- Public API ---

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
      this._peerConnection = this._createPeerConnection();
      if (this._localStream) {
        for (const track of this._localStream.getTracks()) {
          this._peerConnection.addTrack(track, this._localStream);
        }
      }
    }
    try {
      await this._peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
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
    } catch (err) {
      if (this.onError) this.onError('Failed to handle video answer: ' + err.message);
    }
  }

  /**
   * Handle incoming ICE candidate from opponent.
   * @param {RTCIceCandidateInit} candidate
   */
  async handleIceCandidate(candidate) {
    if (!this._peerConnection) return;
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

  _createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._mp.sendRtcIce(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      this._remoteStream = event.streams[0];
      if (this.onRemoteStream) this.onRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed') {
        if (this.onDisconnected) this.onDisconnected();
      }
    };

    return pc;
  }
}
