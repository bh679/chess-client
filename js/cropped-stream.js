/**
 * CroppedStream — canvas-based video cropper for WebRTC transmission.
 *
 * Renders a local camera feed to an offscreen canvas, cropping to the
 * face-tracked region computed by FaceTracker. The canvas stream
 * (via captureStream) can then be sent over WebRTC instead of the raw
 * camera feed, saving bandwidth and removing the need for the remote
 * peer to run face tracking.
 *
 * Output resolution: CANVAS_SIZE × CANVAS_SIZE (square, matches board display).
 */

const CANVAS_SIZE = 480;
const CAPTURE_FPS = 30;

export class CroppedStream {
  /**
   * @param {HTMLVideoElement} videoEl — local camera video element
   * @param {import('./face-tracker.js').FaceTracker} tracker — face tracker for this feed
   * @param {number} [displayOffsetX=0] — the offsetX passed to FaceTracker (board display only).
   *   FaceTracker.getTransform().translateX includes this display offset, which shifts the face
   *   sideways on the board. The crop must subtract it to center on the actual face.
   */
  constructor(videoEl, tracker, displayOffsetX = 0) {
    this._video = videoEl;
    this._tracker = tracker;
    this._displayOffsetX = displayOffsetX;
    this._canvas = null;
    this._ctx = null;
    this._stream = null;
    this._rafId = null;
    this._running = false;
  }

  /**
   * Start the canvas render loop and return the captureStream MediaStream.
   * @returns {MediaStream}
   */
  start() {
    this._canvas = document.createElement('canvas');
    this._canvas.width = CANVAS_SIZE;
    this._canvas.height = CANVAS_SIZE;
    this._ctx = this._canvas.getContext('2d');
    this._stream = this._canvas.captureStream(CAPTURE_FPS);
    this._running = true;
    this._render();
    return this._stream;
  }

  /**
   * Stop the render loop and release stream tracks.
   */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._stream) {
      for (const track of this._stream.getTracks()) {
        track.stop();
      }
      this._stream = null;
    }
    this._canvas = null;
    this._ctx = null;
  }

  /**
   * @returns {MediaStream|null}
   */
  getStream() {
    return this._stream;
  }

  // --- Private ---

  _render() {
    if (!this._running) return;

    const v = this._video;
    if (v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
      this._drawFrame(v);
    }

    this._rafId = requestAnimationFrame(() => this._render());
  }

  /**
   * Draw the current video frame to the canvas, cropped to the face region.
   * @param {HTMLVideoElement} v
   */
  _drawFrame(v) {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const t = this._tracker.getTransform();

    // Translate FaceTracker CSS transform values into a source crop rectangle.
    // FaceTracker produces: translateX (%), translateY (%), scale
    // translateX includes a display-only offsetX (shifts face left/right on the board).
    // Strip it out so the crop centers on the actual face, not the display-shifted position.
    //   pureTX  = translateX - displayOffsetX  (pure face centering, no board offset)
    //   faceCX  = 0.5 - pureTX / 100           (face center as fraction of videoWidth)
    //   faceCY  = 0.5 - translateY / 100        (face center as fraction of videoHeight)
    // At scale S, the visible crop covers vw/S × vh/S source pixels.
    const pureTX = t.translateX - this._displayOffsetX;
    const faceCX = 0.5 - pureTX / 100;
    const faceCY = 0.5 - t.translateY / 100;
    const cropW = vw / t.scale;
    const cropH = vh / t.scale;

    // Use a square crop (shorter dimension) to avoid squishing the output when
    // the source is non-square (e.g. 640×480 camera → 480×480 canvas).
    const cropSide = Math.min(cropW, cropH);

    const rawX = faceCX * vw - cropSide / 2;
    const rawY = faceCY * vh - cropSide / 2;

    // Clamp so we never read outside the video frame
    const srcX = Math.max(0, Math.min(rawX, vw - cropSide));
    const srcY = Math.max(0, Math.min(rawY, vh - cropSide));

    this._ctx.drawImage(v, srcX, srcY, cropSide, cropSide, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
}
