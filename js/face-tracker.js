/**
 * FaceTracker — real-time face detection for centering video feeds on the board.
 *
 * Uses MediaPipe Face Detection (loaded lazily from CDN) to detect a face in a
 * video stream and compute CSS transforms (translate + scale) that center and
 * normalize the face within the board area.
 *
 * Detection runs at ~10 FPS for performance. Transform values are smoothed via
 * exponential moving average to prevent jitter.
 */

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const DETECTION_INTERVAL_MS = 100;
const SMOOTHING_FACTOR = 0.15;
const TARGET_FACE_FRACTION = 0.45;
const MIN_SCALE = 1.0;
const MAX_SCALE = 3.0;
const RETURN_TO_CENTER_SPEED = 0.05;

/** @type {Promise<typeof import('@mediapipe/tasks-vision')>|null} */
let _visionPromise = null;

/** @type {import('@mediapipe/tasks-vision').FaceDetector|null} */
let _sharedDetector = null;

/** @type {Promise<import('@mediapipe/tasks-vision').FaceDetector>|null} */
let _detectorPromise = null;

let _activeTrackerCount = 0;

/**
 * Dynamically loads the MediaPipe tasks-vision module from CDN.
 * @returns {Promise<object>}
 */
function loadVisionModule() {
  if (!_visionPromise) {
    _visionPromise = import(`${MEDIAPIPE_CDN}/vision_bundle.mjs`);
  }
  return _visionPromise;
}

/**
 * Gets or creates the shared FaceDetector instance.
 * @returns {Promise<import('@mediapipe/tasks-vision').FaceDetector>}
 */
async function getDetector() {
  if (_sharedDetector) return _sharedDetector;
  if (_detectorPromise) return _detectorPromise;

  _detectorPromise = (async () => {
    const vision = await loadVisionModule();
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      `${MEDIAPIPE_CDN}/wasm`
    );
    _sharedDetector = await vision.FaceDetector.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
    return _sharedDetector;
  })();

  return _detectorPromise;
}

/**
 * Releases the shared detector when no trackers are active.
 */
function maybeReleaseDetector() {
  if (_activeTrackerCount <= 0 && _sharedDetector) {
    _sharedDetector.close();
    _sharedDetector = null;
    _detectorPromise = null;
    _activeTrackerCount = 0;
  }
}

/**
 * Linearly interpolates between two values.
 * @param {number} current
 * @param {number} target
 * @param {number} factor
 * @returns {number}
 */
function lerp(current, target, factor) {
  return current + (target - current) * factor;
}

export class FaceTracker {
  /**
   * @param {HTMLVideoElement} videoEl — the video element to track
   * @param {object} [options]
   * @param {number} [options.offsetX=0] — horizontal offset in percentage
   *   (negative = shift face left, positive = shift face right)
   */
  constructor(videoEl, options = {}) {
    this._video = videoEl;
    this._offsetX = options.offsetX || 0;
    this._running = false;
    this._rafId = null;
    this._lastDetectionTime = 0;
    this._detector = null;

    // Current smoothed transform values
    this._currentTX = this._offsetX;
    this._currentTY = 0;
    this._currentScale = 1.0;

    // Target transform values (from latest detection)
    this._targetTX = this._offsetX;
    this._targetTY = 0;
    this._targetScale = 1.0;

    this._faceDetected = false;
  }

  /**
   * Start face detection loop on the video element.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    _activeTrackerCount++;

    try {
      this._detector = await getDetector();
    } catch (err) {
      console.warn('FaceTracker: Failed to load face detector:', err.message);
      this._running = false;
      _activeTrackerCount--;
      return;
    }

    this._loop();
  }

  /**
   * Stop detection and release resources.
   */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._detector = null;
    _activeTrackerCount--;
    maybeReleaseDetector();
  }

  /**
   * Get the current smoothed transform values.
   * @returns {{ translateX: number, translateY: number, scale: number }}
   */
  getTransform() {
    return {
      translateX: this._currentTX,
      translateY: this._currentTY,
      scale: this._currentScale,
    };
  }

  // --- Private ---

  _loop() {
    if (!this._running) return;

    const now = performance.now();

    // Run detection at throttled rate
    if (now - this._lastDetectionTime >= DETECTION_INTERVAL_MS) {
      this._detect(now);
      this._lastDetectionTime = now;
    }

    // Smooth interpolation every frame
    this._interpolate();

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  /**
   * Run face detection on the current video frame.
   * @param {number} timestamp
   */
  _detect(timestamp) {
    if (!this._detector || !this._video) return;
    if (this._video.readyState < 2) return; // not enough data
    if (this._video.videoWidth === 0 || this._video.videoHeight === 0) return;

    try {
      const result = this._detector.detectForVideo(this._video, timestamp);
      if (result.detections && result.detections.length > 0) {
        this._updateTarget(result.detections[0]);
        this._faceDetected = true;
      } else {
        this._faceDetected = false;
      }
    } catch {
      // Detection errors are non-fatal — keep running
    }
  }

  /**
   * Update target transform values from a face detection.
   * @param {object} detection — MediaPipe face detection result
   */
  _updateTarget(detection) {
    const bbox = detection.boundingBox;
    if (!bbox) return;

    const vw = this._video.videoWidth;
    const vh = this._video.videoHeight;

    // Face center as fraction of video dimensions
    const faceCX = (bbox.originX + bbox.width / 2) / vw;
    const faceCY = (bbox.originY + bbox.height / 2) / vh;

    // Scale: make face occupy TARGET_FACE_FRACTION of the frame
    const faceWidthFraction = bbox.width / vw;
    const faceHeightFraction = bbox.height / vh;
    const faceFraction = Math.max(faceWidthFraction, faceHeightFraction);
    const rawScale = TARGET_FACE_FRACTION / faceFraction;
    const scale = Math.max(MIN_SCALE, Math.min(rawScale, MAX_SCALE));

    // Translate: center the face (in percentage of video dimensions)
    const tx = (0.5 - faceCX) * 100;
    const ty = (0.5 - faceCY) * 100;

    // Apply horizontal offset (shifts face left or right on the board)
    const offsetTX = tx + this._offsetX;

    // Clamp translation so video edges don't leave the container
    const maxTranslate = ((scale - 1) / scale) * 50;
    this._targetTX = Math.max(-maxTranslate, Math.min(offsetTX, maxTranslate));
    this._targetTY = Math.max(-maxTranslate, Math.min(ty, maxTranslate));
    this._targetScale = scale;
  }

  /**
   * Smoothly interpolate current values toward targets.
   */
  _interpolate() {
    const factor = this._faceDetected ? SMOOTHING_FACTOR : RETURN_TO_CENTER_SPEED;
    const targetTX = this._faceDetected ? this._targetTX : this._offsetX;
    const targetTY = this._faceDetected ? this._targetTY : 0;
    const targetScale = this._faceDetected ? this._targetScale : 1.0;

    this._currentTX = lerp(this._currentTX, targetTX, factor);
    this._currentTY = lerp(this._currentTY, targetTY, factor);
    this._currentScale = lerp(this._currentScale, targetScale, factor);
  }
}
