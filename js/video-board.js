/**
 * VideoBoard — displays camera feeds as a mosaic across the chess board.
 *
 * White player's camera appears across all light squares, black player's
 * camera across all dark squares. Each square shows a portion of one large
 * feed (not duplicates), using CSS masks to clip the video into a
 * checkerboard pattern.
 */

export class VideoBoard {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._lightVideo = null;
    this._darkVideo = null;
    this._lightTint = null;
    this._darkTint = null;
    this._active = false;
  }

  /**
   * Enable video board mode.
   * @param {MediaStream|null} localStream — local player's camera
   * @param {MediaStream|null} remoteStream — remote player's camera
   * @param {'w'|'b'} playerColor — local player's color
   */
  enable(localStream, remoteStream, playerColor) {
    if (!this._layer) {
      this._buildLayer();
    }

    const lightStream = playerColor === 'w' ? localStream : remoteStream;
    const darkStream = playerColor === 'w' ? remoteStream : localStream;

    this._setStream(this._lightVideo, lightStream);
    this._setStream(this._darkVideo, darkStream);

    this._boardEl.classList.add('video-board-active');
    this._active = true;
  }

  /**
   * Update the remote stream (arrives after call connects).
   * @param {MediaStream} remoteStream
   * @param {'w'|'b'} playerColor
   */
  updateRemoteStream(remoteStream, playerColor) {
    if (!this._active || !this._layer) return;

    const targetVideo = playerColor === 'w' ? this._darkVideo : this._lightVideo;
    this._setStream(targetVideo, remoteStream);
  }

  /**
   * Update the local stream (e.g. after camera toggle).
   * @param {MediaStream} localStream
   * @param {'w'|'b'} playerColor
   */
  updateLocalStream(localStream, playerColor) {
    if (!this._active || !this._layer) return;

    const targetVideo = playerColor === 'w' ? this._lightVideo : this._darkVideo;
    this._setStream(targetVideo, localStream);
  }

  /**
   * Disable video board mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('video-board-active');
    this._active = false;

    if (this._lightVideo) this._lightVideo.srcObject = null;
    if (this._darkVideo) this._darkVideo.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._lightVideo = null;
      this._darkVideo = null;
      this._lightTint = null;
      this._darkTint = null;
    }
  }

  /**
   * Update tint opacity based on whose turn it is.
   * @param {'w'|'b'} turn — whose turn it is
   * @param {'w'|'b'} playerColor — local player's color
   * @param {number} [baseOpacity=0.55] — base tint opacity (0–1)
   */
  updateTurnTint(turn, playerColor, baseOpacity = 0.55) {
    if (!this._active || !this._lightTint || !this._darkTint) return;

    const whiteIsActive = turn === 'w';
    const lo = Math.max(0, baseOpacity - 0.05);
    const hi = Math.min(1, baseOpacity + 0.05);
    // Light squares = white player's feed, dark squares = black player's feed
    this._lightTint.style.opacity = whiteIsActive ? lo : hi;
    this._darkTint.style.opacity = whiteIsActive ? hi : lo;
  }

  /**
   * @returns {boolean}
   */
  isActive() {
    return this._active;
  }

  // --- Private ---

  _buildLayer() {
    const layer = document.createElement('div');
    layer.className = 'video-board-layer';

    this._lightVideo = this._createVideo('video-board-light-feed');
    this._darkVideo = this._createVideo('video-board-dark-feed');

    this._lightTint = this._createTint('video-board-light-tint');
    this._darkTint = this._createTint('video-board-dark-tint');

    layer.appendChild(this._lightVideo);
    layer.appendChild(this._darkVideo);
    layer.appendChild(this._lightTint);
    layer.appendChild(this._darkTint);

    // Insert as the first child so it sits behind grid squares
    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;
  }

  /**
   * @param {string} className
   * @returns {HTMLVideoElement}
   */
  _createVideo(className) {
    const video = document.createElement('video');
    video.className = className;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    return video;
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
    }
  }
}
