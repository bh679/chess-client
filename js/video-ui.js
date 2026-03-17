/**
 * VideoUI — under-board video controls, error toast, and remote volume management.
 *
 * The floating video overlay and camera preview modal have been removed.
 * Video is displayed via board camera modes (board-face, king-cam, split-cam, split-cam-h).
 * This class now manages only the under-board mic/camera/end-call controls,
 * error toasts, and remote audio volume.
 */

const ERROR_TOAST_DURATION = 4000;

export class VideoUI {
  /**
   * @param {import('./video-chat.js').VideoChat} videoChat
   */
  constructor(videoChat) {
    this._videoChat = videoChat;
    this._errorTimer = null;
    this._remoteVolume = parseInt(localStorage.getItem('voiceVolume') ?? '100', 10) / 100;

    // Event callbacks — set by app.js
    this.onEndCall = null;         // () => void

    this._initElements();
    this._bindEvents();
  }

  // --- Public API ---

  showControls() {
    if (this._controlsContainer) {
      this._controlsContainer.classList.remove('hidden');
    }
  }

  hideControls() {
    if (this._controlsContainer) {
      this._controlsContainer.classList.add('hidden');
    }
    if (this._remoteAudio) {
      this._remoteAudio.srcObject = null;
    }
  }

  /**
   * Attach the remote stream to the hidden audio element for voice playback.
   * @param {MediaStream} stream
   */
  setRemoteStream(stream) {
    if (this._remoteAudio) {
      this._remoteAudio.srcObject = stream;
      this._remoteAudio.volume = this._remoteVolume;
    }
  }

  /**
   * Set remote audio volume (0–100).
   * @param {number} pct
   */
  setRemoteVolume(pct) {
    this._remoteVolume = pct / 100;
    localStorage.setItem('voiceVolume', String(pct));
    if (this._remoteAudio) {
      this._remoteAudio.volume = this._remoteVolume;
    }
  }

  /**
   * @param {boolean} enabled
   */
  updateMicState(enabled) {
    if (this._toggleMicBtn) {
      if (enabled) {
        this._toggleMicBtn.classList.remove('vc-muted');
        this._toggleMicBtn.title = 'Mute Microphone';
      } else {
        this._toggleMicBtn.classList.add('vc-muted');
        this._toggleMicBtn.title = 'Unmute Microphone';
      }
    }
  }

  /**
   * @param {boolean} enabled
   */
  updateVideoState(enabled) {
    if (this._toggleVideoBtn) {
      if (enabled) {
        this._toggleVideoBtn.classList.remove('vc-muted');
        this._toggleVideoBtn.title = 'Turn Off Camera';
      } else {
        this._toggleVideoBtn.classList.add('vc-muted');
        this._toggleVideoBtn.title = 'Turn On Camera';
      }
    }
  }

  /**
   * @param {string} msg
   */
  showError(msg) {
    if (!this._errorToast) return;
    this._errorToast.textContent = msg;
    this._errorToast.classList.remove('hidden');
    clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => {
      this._errorToast.classList.add('hidden');
    }, ERROR_TOAST_DURATION);
  }

  // --- Private ---

  _initElements() {
    this._controlsContainer = document.getElementById('vc-settings-section');
    this._toggleMicBtn = document.getElementById('vc-toggle-mic');
    this._toggleVideoBtn = document.getElementById('vc-toggle-video');
    this._endCallBtn = document.getElementById('vc-end-call');
    this._remoteAudio = document.getElementById('vc-remote-audio');
    this._errorToast = document.getElementById('vc-error-toast');
  }

  _bindEvents() {
    if (this._toggleMicBtn) {
      this._toggleMicBtn.addEventListener('click', () => {
        const enabled = this._videoChat.toggleAudio();
        this.updateMicState(enabled);
      });
    }
    if (this._toggleVideoBtn) {
      this._toggleVideoBtn.addEventListener('click', () => {
        const enabled = this._videoChat.toggleVideo();
        this.updateVideoState(enabled);
      });
    }
    if (this._endCallBtn) {
      this._endCallBtn.addEventListener('click', () => {
        if (this.onEndCall) this.onEndCall();
      });
    }
  }
}
