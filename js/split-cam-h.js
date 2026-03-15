/**
 * SplitCamH — displays player webcam feeds split horizontally across the chess board.
 *
 * The local player's camera always appears on the bottom half of the board,
 * and the remote player's camera on the top half. This matches the board
 * orientation where the local player's pieces are always at the bottom.
 *
 * Board color tints (--board-light / --board-dark) fade on top of each half to
 * indicate whose turn it is, matching the board-face mode.
 *
 * The camera stream is provided externally by app.js (shared with VideoBoard).
 * SplitCamH does not call getUserMedia directly.
 */

export class SplitCamH {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._topVideo = null;      // remote player's feed
    this._bottomVideo = null;   // local player's feed
    this._topTint = null;
    this._bottomTint = null;
    this._active = false;
  }

  /**
   * Enable horizontal split cam mode.
   * Local player always on bottom, remote player always on top.
   * @param {MediaStream|null} localStream — local player's camera
   * @param {MediaStream|null} remoteStream — remote player's camera (may arrive later)
   * @param {'w'|'b'} playerColor — local player's color
   */
  enable(localStream, remoteStream, playerColor) {
    if (!this._layer) {
      this._buildLayer();
    }

    this._setStream(this._bottomVideo, localStream);   // local always bottom
    this._setStream(this._topVideo, remoteStream);     // remote always top

    this._boardEl.classList.add('split-cam-h-active');
    this._active = true;
  }

  /**
   * Disable horizontal split cam mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('split-cam-h-active');
    this._active = false;

    if (this._topVideo) this._topVideo.srcObject = null;
    if (this._bottomVideo) this._bottomVideo.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._topVideo = null;
      this._bottomVideo = null;
      this._topTint = null;
      this._bottomTint = null;
    }
  }

  /**
   * Update the remote player's stream after it arrives via WebRTC.
   * @param {MediaStream} remoteStream
   * @param {'w'|'b'} localPlayerColor — local player's color
   */
  updateRemoteStream(remoteStream, localPlayerColor) {
    if (!this._active || !this._layer) return;
    this._setStream(this._topVideo, remoteStream);     // remote always top
  }

  /**
   * Update the local player's stream (e.g. after camera toggle).
   * @param {MediaStream} localStream
   * @param {'w'|'b'} playerColor
   */
  updateLocalStream(localStream, playerColor) {
    if (!this._active || !this._layer) return;
    this._setStream(this._bottomVideo, localStream);   // local always bottom
  }

  /**
   * Enable or disable board color tints.
   * Call with false during pre-game lobby, true when gameplay begins.
   * @param {boolean} enabled
   */
  setTintEnabled(enabled) {
    if (this._topTint) this._topTint.style.opacity = enabled ? '' : '0';
    if (this._bottomTint) this._bottomTint.style.opacity = enabled ? '' : '0';
  }

  /**
   * Update tint opacity based on whose turn it is.
   * @param {'w'|'b'} turn — whose turn it is
   * @param {'w'|'b'} playerColor — local player's color
   * @param {number} [baseOpacity=0.55]
   */
  updateTurnTint(turn, playerColor, baseOpacity = 0.55) {
    if (!this._active || !this._topTint || !this._bottomTint) return;

    const localIsActive = turn === playerColor;
    const lo = Math.max(0, baseOpacity - 0.05);
    const hi = Math.min(1, baseOpacity + 0.05);
    // Bottom = local player, top = remote player
    this._bottomTint.style.opacity = localIsActive ? lo : hi;
    this._topTint.style.opacity = localIsActive ? hi : lo;
  }

  /** @returns {boolean} */
  isActive() {
    return this._active;
  }

  // --- Private ---

  _buildLayer() {
    const layer = document.createElement('div');
    layer.className = 'split-cam-h-layer';

    const topResult = this._createHalfVideo('top');
    const bottomResult = this._createHalfVideo('bottom');

    this._topVideo = topResult.video;
    this._bottomVideo = bottomResult.video;

    this._topTint = this._createTint('split-cam-h-top-tint');
    this._bottomTint = this._createTint('split-cam-h-bottom-tint');

    layer.appendChild(topResult.mask);
    layer.appendChild(bottomResult.mask);
    layer.appendChild(this._topTint);
    layer.appendChild(this._bottomTint);

    // Insert as first child so it sits behind grid squares
    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;
  }

  /**
   * @param {'top'|'bottom'} side
   * @returns {{ mask: HTMLDivElement, video: HTMLVideoElement }}
   */
  _createHalfVideo(side) {
    const mask = document.createElement('div');
    mask.className = `split-cam-h-${side}-mask`;

    const video = document.createElement('video');
    video.className = `split-cam-h-${side}-feed`;
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


}
