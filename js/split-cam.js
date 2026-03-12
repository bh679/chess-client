/**
 * SplitCam — displays player webcam feeds split across the chess board.
 *
 * White player's camera appears on the left half of the board,
 * black player's camera on the right half. Board color tints
 * (--board-light / --board-dark) fade on top of each half to
 * indicate whose turn it is, matching the board-face mode.
 *
 * The camera stream is provided externally by app.js (shared with VideoBoard).
 * SplitCam does not call getUserMedia directly.
 */

export class SplitCam {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._leftVideo = null;   // white player's feed
    this._rightVideo = null;  // black player's feed
    this._leftTint = null;
    this._rightTint = null;
    this._active = false;
  }

  /**
   * Enable split cam mode.
   * White player always on left, black player always on right.
   * @param {MediaStream|null} localStream — local player's camera
   * @param {MediaStream|null} remoteStream — remote player's camera (may arrive later)
   * @param {'w'|'b'} playerColor — local player's color
   */
  enable(localStream, remoteStream, playerColor) {
    if (!this._layer) {
      this._buildLayer();
    }

    const localVideo = this._videoForColor(playerColor);
    const remoteColor = playerColor === 'w' ? 'b' : 'w';
    const remoteVideo = this._videoForColor(remoteColor);

    this._setStream(localVideo, localStream);
    this._setStream(remoteVideo, remoteStream);

    this._boardEl.classList.add('split-cam-active');
    this._active = true;
  }

  /**
   * Disable split cam mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('split-cam-active');
    this._active = false;

    if (this._leftVideo) this._leftVideo.srcObject = null;
    if (this._rightVideo) this._rightVideo.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._leftVideo = null;
      this._rightVideo = null;
      this._leftTint = null;
      this._rightTint = null;
    }
  }

  /**
   * Update the remote player's stream after it arrives via WebRTC.
   * @param {MediaStream} remoteStream
   * @param {'w'|'b'} localPlayerColor — local player's color (used to derive remote color)
   */
  updateRemoteStream(remoteStream, localPlayerColor) {
    if (!this._active || !this._layer) return;
    const remoteColor = localPlayerColor === 'w' ? 'b' : 'w';
    this._setStream(this._videoForColor(remoteColor), remoteStream);
  }

  /**
   * Update the local player's stream (e.g. after camera toggle).
   * @param {MediaStream} localStream
   * @param {'w'|'b'} playerColor
   */
  updateLocalStream(localStream, playerColor) {
    if (!this._active || !this._layer) return;
    this._setStream(this._videoForColor(playerColor), localStream);
  }

  /**
   * Enable or disable board color tints.
   * Call with false during pre-game lobby, true when gameplay begins.
   * @param {boolean} enabled
   */
  setTintEnabled(enabled) {
    if (this._leftTint) this._leftTint.style.opacity = enabled ? '' : '0';
    if (this._rightTint) this._rightTint.style.opacity = enabled ? '' : '0';
  }

  /**
   * Update tint opacity based on whose turn it is.
   * @param {'w'|'b'} turn — whose turn it is
   * @param {'w'|'b'} playerColor — local player's color (unused, kept for API parity)
   * @param {number} [baseOpacity=0.55]
   */
  updateTurnTint(turn, playerColor, baseOpacity = 0.55) {
    if (!this._active || !this._leftTint || !this._rightTint) return;

    const whiteIsActive = turn === 'w';
    const lo = Math.max(0, baseOpacity - 0.05);
    const hi = Math.min(1, baseOpacity + 0.05);
    // Left = white side (board-light tint), right = black side (board-dark tint)
    this._leftTint.style.opacity = whiteIsActive ? lo : hi;
    this._rightTint.style.opacity = whiteIsActive ? hi : lo;
  }

  /** @returns {boolean} */
  isActive() {
    return this._active;
  }

  // --- Private ---

  _buildLayer() {
    const layer = document.createElement('div');
    layer.className = 'split-cam-layer';

    const leftResult = this._createHalfVideo('left');
    const rightResult = this._createHalfVideo('right');

    this._leftVideo = leftResult.video;
    this._rightVideo = rightResult.video;

    this._leftTint = this._createTint('split-cam-left-tint');
    this._rightTint = this._createTint('split-cam-right-tint');

    layer.appendChild(leftResult.mask);
    layer.appendChild(rightResult.mask);
    layer.appendChild(this._leftTint);
    layer.appendChild(this._rightTint);

    // Insert as first child so it sits behind grid squares
    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;
  }

  /**
   * @param {'left'|'right'} side
   * @returns {{ mask: HTMLDivElement, video: HTMLVideoElement }}
   */
  _createHalfVideo(side) {
    const mask = document.createElement('div');
    mask.className = `split-cam-${side}-mask`;

    const video = document.createElement('video');
    video.className = `split-cam-${side}-feed`;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.disablePictureInPicture = true;

    mask.appendChild(video);
    return { mask, video };
  }

  /**
   * @param {string} className
   * @returns {HTMLDivElement}
   */
  _createTint(className) {
    const div = document.createElement('div');
    div.className = className;
    return div;
  }

  /**
   * @param {HTMLVideoElement} videoEl
   * @param {MediaStream|null} stream
   */
  _setStream(videoEl, stream) {
    if (videoEl) {
      videoEl.srcObject = stream || null;
      if (stream) videoEl.play().catch(() => {});
    }
  }

  /**
   * Returns the video element for the given player color.
   * White is always on the left, black always on the right.
   * @param {'w'|'b'} color
   * @returns {HTMLVideoElement|null}
   */
  _videoForColor(color) {
    return color === 'w' ? this._leftVideo : this._rightVideo;
  }
}
