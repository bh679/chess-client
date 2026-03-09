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
    this._transformRafId = null;
    this._active = false;
    this._playerColor = null;
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

    const lightStream = playerColor === 'w' ? localStream : remoteStream;
    const darkStream = playerColor === 'w' ? remoteStream : localStream;

    this._setStream(this._lightVideo, lightStream);
    this._setStream(this._darkVideo, darkStream);

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

    const targetVideo = playerColor === 'w' ? this._lightVideo : this._darkVideo;
    this._setStream(targetVideo, localStream);
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

    const video = document.createElement('video');
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
    }
  }

  /**
   * Start face tracking on the LOCAL feed only.
   *
   * The remote feed is received pre-cropped from the remote peer — no
   * tracking is needed on that side. A CroppedStream is created from the
   * local feed so the tracked/cropped output can be sent over WebRTC.
   */
  _startFaceTracking() {
    // Local feed: white = light squares, black = dark squares
    const localVideo = this._playerColor === 'w' ? this._lightVideo : this._darkVideo;
    const localOffsetX = this._playerColor === 'w' ? -19 : 19;

    // Track only the local feed
    const localTracker = new FaceTracker(localVideo, { offsetX: localOffsetX });
    localTracker.start();

    if (this._playerColor === 'w') {
      this._lightTracker = localTracker;
    } else {
      this._darkTracker = localTracker;
    }

    // Create canvas-based cropped stream for WebRTC transmission.
    // translateX already includes the board offsetX — the crop is intentionally
    // offset so the received video sits in the right position on the board squares.
    this._croppedStream = new CroppedStream(localVideo, localTracker);
    const canvasStream = this._croppedStream.start();
    if (this.onCroppedStreamReady) {
      this.onCroppedStreamReady(canvasStream);
    }

    this._applyTransforms();
  }

  /**
   * Stop face tracking and cancel animation loop.
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
    if (this._transformRafId) {
      cancelAnimationFrame(this._transformRafId);
      this._transformRafId = null;
    }
  }

  /**
   * Animation loop that reads face tracker transforms and applies them
   * to the LOCAL video element each frame.
   *
   * The remote video element has no tracker — it receives a pre-cropped
   * stream and is displayed without any additional CSS transform.
   */
  _applyTransforms() {
    if (!this._active) return;

    if (this._lightTracker && this._lightVideo) {
      const t = this._lightTracker.getTransform();
      this._lightVideo.style.transform =
        `scale(${t.scale}) translate(${t.translateX}%, ${t.translateY}%)`;
    }

    if (this._darkTracker && this._darkVideo) {
      const t = this._darkTracker.getTransform();
      this._darkVideo.style.transform =
        `scale(${t.scale}) translate(${t.translateX}%, ${t.translateY}%)`;
    }

    // Ensure the remote video (no tracker) has no residual transform
    if (this._playerColor === 'w' && this._darkVideo) {
      this._darkVideo.style.transform = 'none';
    } else if (this._playerColor === 'b' && this._lightVideo) {
      this._lightVideo.style.transform = 'none';
    }

    this._transformRafId = requestAnimationFrame(() => this._applyTransforms());
  }
}
