/**
 * KingCam — displays player webcam feeds inside the king pieces.
 *
 * Each player's king shows their live face framed by a crown portrait SVG.
 * The camera stream is provided externally by app.js (shared with VideoBoard).
 * KingCam does not call getUserMedia directly.
 */

export class KingCam {
  constructor() {
    this._active = false;
    this._streams = { w: null, b: null };
  }

  /**
   * Enable King Cam mode.
   * @param {MediaStream} localStream — local player's camera
   * @param {'w'|'b'} playerColor — local player's color
   * @param {MediaStream|null} remoteStream — remote player's camera (arrives later)
   */
  enable(localStream, playerColor, remoteStream = null) {
    const opponentColor = playerColor === 'w' ? 'b' : 'w';
    this._streams = { w: null, b: null };
    this._streams[playerColor] = localStream;
    if (remoteStream) {
      this._streams[opponentColor] = remoteStream;
    }
    this._active = true;
  }

  /**
   * Disable King Cam mode and clear all streams.
   */
  disable() {
    this._streams = { w: null, b: null };
    this._active = false;
  }

  /** @returns {boolean} */
  isActive() {
    return this._active;
  }

  /**
   * Update the remote player's stream after it arrives via WebRTC.
   * @param {MediaStream} stream
   * @param {'w'|'b'} color — the remote player's color
   */
  updateRemoteStream(stream, color) {
    this._streams[color] = stream;
  }

  /**
   * Create the DOM element for a king piece.
   * If no stream is available for this color, returns a normal SVG img element.
   * @param {'w'|'b'} color
   * @returns {HTMLElement}
   */
  createKingElement(color) {
    const stream = this._streams[color];

    if (!stream) {
      // No camera for this color (e.g. AI opponent) — render the frame without video
      const img = document.createElement('img');
      img.className = 'piece';
      img.src = `img/pieces-kingcam/${color}K.svg`;
      img.alt = `${color}k`;
      img.draggable = false;
      return img;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'piece king-cam-piece';
    wrapper.draggable = false;

    const video = document.createElement('video');
    video.className = 'king-cam-video';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    const frame = document.createElement('img');
    frame.className = 'king-cam-frame';
    frame.src = `img/pieces-kingcam/${color}K.svg`;
    frame.alt = `${color}k`;
    frame.draggable = false;

    wrapper.appendChild(video);
    wrapper.appendChild(frame);
    return wrapper;
  }
}
