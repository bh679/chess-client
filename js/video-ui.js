/**
 * VideoUI — DOM management for video chat overlay, controls, and camera preview.
 *
 * Follows the same pattern as multiplayer-ui.js: caches DOM elements, binds events,
 * exposes show/hide and stream-setting methods.
 */

const ERROR_TOAST_DURATION = 4000;

export class VideoUI {
  /**
   * @param {import('./video-chat.js').VideoChat} videoChat
   */
  constructor(videoChat) {
    this._videoChat = videoChat;
    this._visible = false;
    this._errorTimer = null;

    // Event callbacks — set by app.js
    this.onEndCall = null;         // () => void
    this.onPreviewConfirm = null;  // () => void
    this.onPreviewCancel = null;   // () => void

    this._initElements();
    this._bindEvents();
  }

  // --- Public API ---

  show() {
    if (this._container) {
      this._container.classList.remove('hidden');
    }
    this._visible = true;
  }

  hide() {
    if (this._container) {
      this._container.classList.add('hidden');
    }
    this._visible = false;
    this._clearStreams();
  }

  /**
   * @param {MediaStream} stream
   */
  setLocalStream(stream) {
    if (this._localVideo) {
      this._localVideo.srcObject = stream;
    }
  }

  /**
   * @param {MediaStream} stream
   */
  setRemoteStream(stream) {
    if (this._remoteVideo) {
      this._remoteVideo.srcObject = stream;
    }
    if (this._remotePlaceholder) {
      this._remotePlaceholder.classList.add('hidden');
    }
  }

  /**
   * Show camera preview modal with local stream.
   * @param {MediaStream} stream
   */
  showCameraPreview(stream) {
    if (this._previewVideo) {
      this._previewVideo.srcObject = stream;
    }
    if (this._previewBackdrop) {
      this._previewBackdrop.classList.remove('hidden');
    }
    if (this._previewModal) {
      this._previewModal.classList.remove('hidden');
    }
  }

  hideCameraPreview() {
    if (this._previewBackdrop) {
      this._previewBackdrop.classList.add('hidden');
    }
    if (this._previewModal) {
      this._previewModal.classList.add('hidden');
    }
    if (this._previewVideo) {
      this._previewVideo.srcObject = null;
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
    this._container = document.getElementById('vc-container');
    this._localVideo = document.getElementById('vc-local-video');
    this._remoteVideo = document.getElementById('vc-remote-video');
    this._remotePlaceholder = document.getElementById('vc-remote-placeholder');
    this._toggleMicBtn = document.getElementById('vc-toggle-mic');
    this._toggleVideoBtn = document.getElementById('vc-toggle-video');
    this._endCallBtn = document.getElementById('vc-end-call');
    this._previewBackdrop = document.getElementById('vc-preview-backdrop');
    this._previewModal = document.getElementById('vc-preview-modal');
    this._previewVideo = document.getElementById('vc-preview-video');
    this._previewConfirmBtn = document.getElementById('vc-preview-confirm');
    this._previewCancelBtn = document.getElementById('vc-preview-cancel');
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
    if (this._previewConfirmBtn) {
      this._previewConfirmBtn.addEventListener('click', () => {
        this.hideCameraPreview();
        if (this.onPreviewConfirm) this.onPreviewConfirm();
      });
    }
    if (this._previewCancelBtn) {
      this._previewCancelBtn.addEventListener('click', () => {
        this.hideCameraPreview();
        if (this.onPreviewCancel) this.onPreviewCancel();
      });
    }
  }

  _clearStreams() {
    if (this._localVideo) this._localVideo.srcObject = null;
    if (this._remoteVideo) this._remoteVideo.srcObject = null;
    if (this._remotePlaceholder) this._remotePlaceholder.classList.remove('hidden');
  }
}
