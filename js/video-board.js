/**
 * VideoBoard — displays camera feeds as a mosaic across the chess board.
 *
 * White player's camera appears across all light squares, black player's
 * camera across all dark squares. Each square shows a portion of one large
 * feed (not duplicates), using CSS masks to clip the video into a
 * checkerboard pattern.
 *
 * Face tracking (via MediaPipe) runs only on the LOCAL camera feed.
 * A CroppedStream captures the tracked feed to a canvas and provides a
 * bandwidth-efficient MediaStream for WebRTC transmission. The remote
 * feed is received pre-cropped and displayed without additional tracking.
 *
 * Both local and remote players display the same 480×480 canvas stream,
 * ensuring feeds are visually identical regardless of board size.
 */

import { FaceTracker } from './face-tracker.js';
import { CroppedStream } from './cropped-stream.js';

export class VideoBoard {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._lightMask = null;
    this._darkMask = null;
    this._lightVideo = null;
    this._darkVideo = null;
    this._lightTint = null;
    this._darkTint = null;
    this._lightTracker = null;
    this._darkTracker = null;
    this._active = false;
    this._playerColor = null;
    this._localStream = null;
    this._trackingVideo = null;
    this._croppedStream = null;

    // Fired with the canvas MediaStream once the local tracker is ready.
    // app.js wires this to videoChat.replaceVideoTrack() to send the
    // pre-cropped stream to the remote peer instead of the raw camera feed.
    this.onCroppedStreamReady = null;
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

    this._playerColor = playerColor;
    this._localStream = localStream;

    // Set remote stream on the remote board slot immediately.
    // Local slot will be updated to show the canvas stream once tracking starts.
    const remoteVideo = playerColor === 'w' ? this._darkVideo : this._lightVideo;
    this._setStream(remoteVideo, remoteStream);

    this._boardEl.classList.add('video-board-active');
    this._active = true;

    this._startFaceTracking();
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

    this._localStream = localStream;

    // Update the hidden tracking video — the canvas stream on the display
    // video will automatically reflect the new source next frame.
    if (this._trackingVideo) {
      this._trackingVideo.srcObject = localStream;
    }
  }

  /**
   * Reset the video board for a new game (e.g. rematch with swapped colors).
   * Reuses the existing DOM layer — stops and restarts face tracking with the
   * new player color and streams without a full disable/enable cycle.
   *
   * @param {MediaStream|null} localStream
   * @param {MediaStream|null} remoteStream
   * @param {'w'|'b'} playerColor
   */
  reset(localStream, remoteStream, playerColor) {
    if (!this._active || !this._layer) return;

    this._stopFaceTracking();
    if (this._croppedStream) {
      this._croppedStream.stop();
      this._croppedStream = null;
    }

    this._playerColor = playerColor;
    this._localStream = localStream;

    const remoteVideo = playerColor === 'w' ? this._darkVideo : this._lightVideo;
    this._setStream(remoteVideo, remoteStream);

    this._startFaceTracking();
  }

  /**
   * Disable video board mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('video-board-active');
    this._active = false;

    this._stopFaceTracking();

    if (this._croppedStream) {
      this._croppedStream.stop();
      this._croppedStream = null;
    }

    if (this._lightVideo) this._lightVideo.srcObject = null;
    if (this._darkVideo) this._darkVideo.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._lightMask = null;
      this._darkMask = null;
      this._lightVideo = null;
      this._darkVideo = null;
      this._lightTint = null;
      this._darkTint = null;
    }

    this._playerColor = null;
    this._localStream = null;
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

    const lightResult = this._createMaskedVideo('light');
    const darkResult = this._createMaskedVideo('dark');

    this._lightMask = lightResult.mask;
    this._lightVideo = lightResult.video;
    this._darkMask = darkResult.mask;
    this._darkVideo = darkResult.video;

    this._lightTint = this._createTint('video-board-light-tint');
    this._darkTint = this._createTint('video-board-dark-tint');

    layer.appendChild(this._lightMask);
    layer.appendChild(this._darkMask);
    layer.appendChild(this._lightTint);
    layer.appendChild(this._darkTint);

    // Insert as the first child so it sits behind grid squares
    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;
  }

  /**
   * Creates a mask container with a video element inside.
   * The mask stays fixed on the board grid while the video can be
   * transformed (scaled/translated) for face centering.
   *
   * @param {'light'|'dark'} type
   * @returns {{ mask: HTMLDivElement, video: HTMLVideoElement }}
   */
  _createMaskedVideo(type) {
    const mask = document.createElement('div');
    mask.className = `video-board-${type}-mask`;

    const video = document.createElement('video')
    video.className = `video-board-${type}-feed`;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

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
   * Start face tracking on the LOCAL feed only.
   *
   * Uses a hidden off-screen video element as the tracking source so the
   * display video can show the canvas stream without creating a feedback
   * loop. Both local and remote board slots display the same 480×480
   * canvas stream, so the face appears identical on both sides regardless
   * of board size.
   */
  async _startFaceTracking() {
    const localVideo = this._playerColor === 'w' ? this._lightVideo : this._darkVideo;
    const localOffsetX = this._playerColor === 'w' ? -19 : 19;

    // Hidden video reads the raw camera stream — FaceTracker and CroppedStream
    // operate on this so the canvas output doesn't feed back into itself.
    const trackingVideo = document.createElement('video');
    trackingVideo.autoplay = true;
    trackingVideo.playsInline = true;
    trackingVideo.muted = true;
    // Use off-screen positioning instead of display:none — Chrome does not
    // decode video frames for display:none elements, which breaks MediaPipe
    // face detection (zero-size framebuffers) and leaves the canvas blank.
    trackingVideo.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    trackingVideo.srcObject = this._localStream;
    document.body.appendChild(trackingVideo);
    trackingVideo.play().catch(() => {});
    this._trackingVideo = trackingVideo;

    try {
      const localTracker = new FaceTracker(trackingVideo, { offsetX: localOffsetX });
      await localTracker.start();

      if (this._playerColor === 'w') {
        this._lightTracker = localTracker;
      } else {
        this._darkTracker = localTracker;
      }

      // Canvas stream is cropped and pre-positioned for the receiver's board.
      this._croppedStream = new CroppedStream(trackingVideo, localTracker);
      const canvasStream = this._croppedStream.start();

      // Display the canvas stream on the local board slot so both players
      // see identical output — no CSS transforms needed.
      this._setStream(localVideo, canvasStream);

      if (this.onCroppedStreamReady) {
        this.onCroppedStreamReady(canvasStream);
      }
    } catch (err) {
      // Face tracking failed (MediaPipe unavailable, WebGL issues, etc.)
      // Fall back to showing the raw camera stream without face cropping.
      console.warn('[VideoBoard] Face tracking unavailable, using raw camera feed:', err.message);
      this._setStream(localVideo, this._localStream);
    }
  }

  /**
   * Stop face tracking and release the hidden tracking video.
   */
  _stopFaceTracking() {
    if (this._lightTracker) {
      this._lightTracker.stop();
      this._lightTracker = null;
    }
    if (this._darkTracker) {
      this._darkTracker.stop();
      this._darkTracker = null;
    }
    if (this._trackingVideo) {
      this._trackingVideo.srcObject = null;
      this._trackingVideo.remove();
      this._trackingVideo = null;
    }
  }
}
