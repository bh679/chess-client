/**
 * TileCam — displays camera feeds as individual per-tile feeds across the chess board.
 *
 * Each of the 64 tiles shows its own complete, self-contained camera feed:
 * - Light squares (32 tiles): white player's full camera feed
 * - Dark squares (32 tiles): black player's full camera feed
 *
 * Unlike board-face (which masks one large video into a checkerboard), each
 * tile here independently frames the complete stream with object-fit: cover —
 * like 32 small monitors per colour.
 *
 * Face tracking (via MediaPipe) runs only on the LOCAL camera feed.
 * A CroppedStream captures the tracked feed to a canvas and provides a
 * bandwidth-efficient MediaStream for WebRTC transmission.
 */

import { FaceTracker } from './face-tracker.js';
import { CroppedStream } from './cropped-stream.js';

export class TileCam {
  /**
   * @param {HTMLElement} boardEl — the .board container
   */
  constructor(boardEl) {
    this._boardEl = boardEl;
    this._layer = null;
    this._lightVideos = [];
    this._darkVideos = [];
    this._lightTint = null;
    this._darkTint = null;
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
   * Enable tile cam mode.
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

    // Remote stream goes to the opponent's squares immediately.
    // Local slot will be updated to the canvas stream once tracking starts.
    if (playerColor === 'w') {
      this._setAllStreams('dark', remoteStream);
    } else {
      this._setAllStreams('light', remoteStream);
    }

    this._boardEl.classList.add('tile-cam-active');
    this._active = true;

    this._startFaceTracking();
  }

  /**
   * Update the remote stream (arrives after call connects).
   * @param {MediaStream} remoteStream
   * @param {'w'|'b'} playerColor — local player's color
   */
  updateRemoteStream(remoteStream, playerColor) {
    if (!this._active || !this._layer) return;

    if (playerColor === 'w') {
      this._setAllStreams('dark', remoteStream);
    } else {
      this._setAllStreams('light', remoteStream);
    }
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
    // videos will automatically reflect the new source next frame.
    if (this._trackingVideo) {
      this._trackingVideo.srcObject = localStream;
    }
  }

  /**
   * Reset for a new game (e.g. rematch with swapped colors).
   * Reuses the existing DOM layer without a full disable/enable cycle.
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

    if (playerColor === 'w') {
      this._setAllStreams('dark', remoteStream);
    } else {
      this._setAllStreams('light', remoteStream);
    }

    this._startFaceTracking();
  }

  /**
   * Disable tile cam mode and clean up.
   */
  disable() {
    this._boardEl.classList.remove('tile-cam-active');
    this._active = false;

    this._stopFaceTracking();

    if (this._croppedStream) {
      this._croppedStream.stop();
      this._croppedStream = null;
    }

    for (const v of this._lightVideos) v.srcObject = null;
    for (const v of this._darkVideos) v.srcObject = null;

    if (this._layer) {
      this._layer.remove();
      this._layer = null;
      this._lightVideos = [];
      this._darkVideos = [];
      this._lightTint = null;
      this._darkTint = null;
    }

    this._playerColor = null;
    this._localStream = null;
  }

  /**
   * Enable or disable board color tints.
   * Call with false during pre-game lobby (no tints on camera feed).
   * Call with true when gameplay begins.
   * @param {boolean} enabled
   */
  setTintEnabled(enabled) {
    if (this._lightTint) this._lightTint.style.opacity = enabled ? '' : '0';
    if (this._darkTint) this._darkTint.style.opacity = enabled ? '' : '0';
  }

  /**
   * Update tint opacity based on whose turn it is.
   * @param {'w'|'b'} turn — whose turn it is
   * @param {'w'|'b'} playerColor — local player's color
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

  /**
   * @returns {boolean}
   */
  isActive() {
    return this._active;
  }

  // --- Private ---

  /**
   * Build the 8×8 tile grid layer and insert it into the board.
   * Top-left (row=0, col=0) is a light square in both normal and flipped
   * orientations (chess board symmetry guarantees this).
   */
  _buildLayer() {
    const layer = document.createElement('div');
    layer.className = 'tile-cam-layer';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const cell = document.createElement('div');
        cell.className = `tile-cam-cell tile-cam-${isLight ? 'light' : 'dark'}`;

        const video = document.createElement('video');
        video.className = 'tile-cam-video';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        cell.appendChild(video);
        layer.appendChild(cell);

        if (isLight) {
          this._lightVideos.push(video);
        } else {
          this._darkVideos.push(video);
        }
      }
    }

    this._lightTint = this._createTint('tile-cam-light-tint');
    this._darkTint = this._createTint('tile-cam-dark-tint');
    layer.appendChild(this._lightTint);
    layer.appendChild(this._darkTint);

    this._boardEl.insertBefore(layer, this._boardEl.firstChild);
    this._layer = layer;
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
   * Set the same stream on all videos of the given type.
   * @param {'light'|'dark'} type
   * @param {MediaStream|null} stream
   */
  _setAllStreams(type, stream) {
    const videos = type === 'light' ? this._lightVideos : this._darkVideos;
    for (const video of videos) {
      video.srcObject = stream || null;
      if (stream) video.play().catch(() => {});
    }
  }

  /**
   * Start face tracking on the LOCAL feed only.
   *
   * Uses a hidden off-screen video element as the tracking source so the
   * display videos can show the canvas stream without creating a feedback loop.
   */
  async _startFaceTracking() {
    const localType = this._playerColor === 'w' ? 'light' : 'dark';
    const localOffsetX = this._playerColor === 'w' ? -19 : 19;

    // Hidden video reads the raw camera stream — FaceTracker and CroppedStream
    // operate on this so the canvas output doesn't feed back into itself.
    const trackingVideo = document.createElement('video');
    trackingVideo.autoplay = true;
    trackingVideo.playsInline = true;
    trackingVideo.muted = true;
    trackingVideo.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    trackingVideo.srcObject = this._localStream;
    document.body.appendChild(trackingVideo);
    trackingVideo.play().catch(() => {});
    this._trackingVideo = trackingVideo;

    try {
      const localTracker = new FaceTracker(trackingVideo, { offsetX: localOffsetX });
      await localTracker.start();

      this._croppedStream = new CroppedStream(trackingVideo, localTracker);
      const canvasStream = this._croppedStream.start();

      // Display canvas stream on all local-player tiles
      this._setAllStreams(localType, canvasStream);

      if (this.onCroppedStreamReady) {
        this.onCroppedStreamReady(canvasStream);
      }
    } catch (err) {
      // Face tracking failed — fall back to raw stream
      console.warn('[TileCam] Face tracking unavailable, using raw camera feed:', err.message);
      this._setAllStreams(localType, this._localStream);
    }
  }

  /**
   * Stop face tracking and release the hidden tracking video.
   */
  _stopFaceTracking() {
    if (this._trackingVideo) {
      this._trackingVideo.srcObject = null;
      this._trackingVideo.remove();
      this._trackingVideo = null;
    }
  }
}
