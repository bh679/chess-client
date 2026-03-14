/**
 * TiledCam — displays camera feeds as repeated small thumbnails across the chess board.
 *
 * Unlike board-face (which slices one large feed across all squares), TiledCam
 * draws each player's feed as a complete miniature inside every square of their color.
 * White player's camera appears as small thumbnails on every light square,
 * black player's camera on every dark square.
 *
 * Implementation: two canvas elements (one per square color) are drawn each frame
 * using requestAnimationFrame, tiling the video 8×8 at 1/8 scale. CSS checkerboard
 * masks clip each canvas to the appropriate square color.
 *
 * The camera stream is provided externally by app.js (shared with other cam modes).
 * TiledCam does not call getUserMedia directly.
 */

export class TiledCam {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._lightCanvas = null;
    this._darkCanvas = null;
    this._lightCtx = null;
    this._darkCtx = null;
    this._lightTint = null;
    this._darkTint = null;
    this._lightVideo = null;
    this._darkVideo = null;
    this._animId = null;
    this._active = false;
    this._playerColor = null;
  }

  /**
   * Enable tiled cam mode.
   * @param {MediaStream|null} localStream — local player's camera
   * @param {MediaStream|null} remoteStream — remote player's camera (may arrive later)
   * @param {'w'|'b'} playerColor — local player's color
   */
  enable(localStream, remoteStream, playerColor) {
    if (!this._layer) {
      this._buildLayer();
    }

    this._playerColor = playerColor;

    const localVideo = playerColor === 'w' ? this._lightVideo : this._darkVideo;
    const remoteVideo = playerColor === 'w' ? this._darkVideo : this._lightVideo;

    this._setStream(localVideo, localStream);
    this._setStream(remoteVideo, remoteStream);

    this._boardEl.classList.add('tiled-cam-active');
    this._active = true;
    this._startDrawLoop();
  }

  /**
   * Disable tiled cam mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('tiled-cam-active');
    this._active = false;

    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }

    if (this._lightVideo) this._lightVideo.srcObject = null;
    if (this._darkVideo) this._darkVideo.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._lightCanvas = null;
      this._darkCanvas = null;
      this._lightCtx = null;
      this._darkCtx = null;
      this._lightTint = null;
      this._darkTint = null;
    }

    // Keep hidden videos but clear streams
    this._playerColor = null;
  }

  /**
   * Update the remote player's stream after it arrives via WebRTC.
   * @param {MediaStream} remoteStream
   * @param {'w'|'b'} playerColor — local player's color (used to derive remote color)
   */
  updateRemoteStream(remoteStream, playerColor) {
    if (!this._active) return;
    const remoteVideo = playerColor === 'w' ? this._darkVideo : this._lightVideo;
    this._setStream(remoteVideo, remoteStream);
  }

  /**
   * Update the local player's stream (e.g. after camera toggle).
   * @param {MediaStream} localStream
   * @param {'w'|'b'} playerColor
   */
  updateLocalStream(localStream, playerColor) {
    if (!this._active) return;
    const localVideo = playerColor === 'w' ? this._lightVideo : this._darkVideo;
    this._setStream(localVideo, localStream);
  }

  /**
   * Enable or disable board color tints.
   * Call with false during pre-game lobby, true when gameplay begins.
   * @param {boolean} enabled
   */
  setTintEnabled(enabled) {
    if (this._lightTint) this._lightTint.style.opacity = enabled ? '' : '0';
    if (this._darkTint) this._darkTint.style.opacity = enabled ? '' : '0';
  }

  /**
   * Update tint opacity based on whose turn it is.
   * @param {'w'|'b'} turn — whose turn it is
   * @param {'w'|'b'} playerColor — local player's color (unused, kept for API parity)
   * @param {number} [baseOpacity=0.55]
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

  /** @returns {boolean} */
  isActive() {
    return this._active;
  }

  // --- Private ---

  _buildLayer() {
    const layer = document.createElement('div');
    layer.className = 'tiled-cam-layer';

    const lightResult = this._createMaskedCanvas('light');
    const darkResult = this._createMaskedCanvas('dark');

    this._lightCanvas = lightResult.canvas;
    this._lightCtx = lightResult.ctx;
    this._darkCanvas = darkResult.canvas;
    this._darkCtx = darkResult.ctx;

    this._lightTint = this._createTint('tiled-cam-light-tint');
    this._darkTint = this._createTint('tiled-cam-dark-tint');

    layer.appendChild(lightResult.mask);
    layer.appendChild(darkResult.mask);
    layer.appendChild(this._lightTint);
    layer.appendChild(this._darkTint);

    // Insert as first child so it sits behind grid squares
    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;

    // Create hidden off-screen video elements for stream reading
    this._lightVideo = this._createHiddenVideo();
    this._darkVideo = this._createHiddenVideo();
  }

  /**
   * @param {'light'|'dark'} type
   * @returns {{ mask: HTMLDivElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
   */
  _createMaskedCanvas(type) {
    const mask = document.createElement('div');
    mask.className = `tiled-cam-${type}-mask`;

    const canvas = document.createElement('canvas');
    canvas.className = `tiled-cam-${type}-canvas`;
    canvas.width = 480;
    canvas.height = 480;

    const ctx = canvas.getContext('2d');

    mask.appendChild(canvas);
    return { mask, canvas, ctx };
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
   * Creates a hidden off-screen video element for reading a stream.
   * @returns {HTMLVideoElement}
   */
  _createHiddenVideo() {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    // Off-screen but still decoded (display:none breaks frame decoding in Chrome)
    video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    return video;
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
   * Start the animation loop that tiles video frames onto the canvases.
   */
  _startDrawLoop() {
    const draw = () => {
      if (!this._active) return;
      this._drawFrame();
      this._animId = requestAnimationFrame(draw);
    };
    this._animId = requestAnimationFrame(draw);
  }

  /**
   * Draw one frame: tile each video 8×8 times across its canvas.
   */
  _drawFrame() {
    const TILES = 8;
    const pairs = [
      { ctx: this._lightCtx, video: this._lightVideo },
      { ctx: this._darkCtx, video: this._darkVideo },
    ];

    for (const { ctx, video } of pairs) {
      if (!ctx || !video || !video.srcObject || video.readyState < 2) continue;

      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const tileW = cw / TILES;
      const tileH = ch / TILES;

      ctx.clearRect(0, 0, cw, ch);
      for (let row = 0; row < TILES; row++) {
        for (let col = 0; col < TILES; col++) {
          ctx.drawImage(video, col * tileW, row * tileH, tileW, tileH);
        }
      }
    }
  }
}
