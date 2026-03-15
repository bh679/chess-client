/**
 * Diagnostics — Client-side event collector and batch reporter.
 *
 * Collects diagnostic events (WebRTC states, errors, lifecycle events)
 * in memory and periodically sends them to the server in batches.
 * Minimal performance impact: events are buffered, never blocking.
 */

const DIAG_API = '/api/chess/diagnostics';
const FLUSH_INTERVAL = 15_000;   // 15 seconds
const MAX_BUFFER_SIZE = 200;     // flush early if buffer gets large
const MAX_BATCH_SIZE = 50;       // events per POST request

export class Diagnostics {
  constructor() {
    this._buffer = [];
    this._flushTimer = null;
    this._gameId = null;
    this._roomCode = null;
    this._sessionId = null;
    this._deviceInfo = null;
    this._clientVersion = null;
    this._apiVersion = null;
    this._enabled = true;
  }

  // --- Public API ---

  /** Set the multiplayer session ID (called once at startup). */
  setSessionId(sessionId) {
    this._sessionId = sessionId;
  }

  /** Associate events with the current game/room. */
  setContext(gameId, roomCode) {
    this._gameId = gameId || null;
    this._roomCode = roomCode || null;
  }

  /** Set client and API version strings for inclusion in all log batches. */
  setVersions(clientVersion, apiVersion) {
    this._clientVersion = clientVersion || null;
    this._apiVersion = apiVersion || null;
  }

  /** Clear game context (game ended or disconnected). */
  clearContext() {
    this._gameId = null;
    this._roomCode = null;
  }

  /** Record a diagnostic event. Never throws. */
  record(category, eventType, data = {}) {
    if (!this._enabled) return;
    try {
      this._buffer.push({
        timestamp: Date.now(),
        category,
        eventType,
        data,
      });
      if (this._buffer.length >= MAX_BUFFER_SIZE) {
        this.flush();
      }
    } catch (e) {
      // Diagnostics must never break the game
    }
  }

  /** Start the periodic flush timer. */
  start() {
    this._deviceInfo = this._detectDeviceInfo();
    this._flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
    window.addEventListener('beforeunload', () => this._beaconFlush());
  }

  /** Flush remaining events and stop the timer. */
  async stop() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    await this.flush();
  }

  /** Force an immediate flush (e.g., on game end or move). */
  async flush() {
    if (this._buffer.length === 0) return;

    const events = this._buffer.splice(0, MAX_BATCH_SIZE);
    const payload = {
      sessionId: this._sessionId,
      gameId: this._gameId,
      roomCode: this._roomCode,
      deviceInfo: this._buildDeviceInfo(),
      events,
    };

    try {
      const res = await fetch(DIAG_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this._buffer.unshift(...events);
      }
    } catch (e) {
      this._buffer.unshift(...events);
    }
  }

  // --- WebRTC convenience methods ---

  /** Record a WebRTC ICE connection state change. */
  iceStateChange(state) {
    this.record('webrtc', 'ice_state_change', { state });
  }

  /** Record a WebRTC connection state change. */
  connectionStateChange(state) {
    this.record('webrtc', 'connection_state_change', { state });
  }

  /** Record an ICE candidate gathered locally. */
  iceCandidateLocal(candidate) {
    this.record('webrtc', 'ice_candidate_local', {
      type: candidate.type,
      protocol: candidate.protocol,
    });
  }

  /** Record ICE servers configuration. */
  iceServersConfig(count, hasTurn, turnProvider, turnUrls) {
    this.record('webrtc', 'ice_servers_config', { count, hasTurn, turnProvider, turnUrls: turnUrls || [] });
  }

  /** Record that a TURN relay ICE candidate was gathered (confirms TURN server is reachable). */
  turnCandidateGathered(protocol) {
    this.record('webrtc', 'turn_candidate_gathered', { protocol });
  }

  /** Record SDP exchange event. */
  sdpExchange(direction, type) {
    this.record('webrtc', 'sdp_exchange', { direction, type });
  }

  /** Record remote track received. */
  remoteTrackReceived(kind) {
    this.record('webrtc', 'remote_track_received', { kind });
  }

  /** Record a JS error. */
  jsError(message, source, line, col, stack) {
    this.record('error', 'js_error', {
      message,
      source,
      line,
      col,
      stack: stack ? stack.substring(0, 1000) : null,
    });
  }

  /** Record a WebRTC-specific error. */
  webrtcError(operation, message) {
    this.record('webrtc', 'error', { operation, message });
  }

  /** Record cam mode change (king-cam, board-face, split-cam, split-cam-h, none). */
  camModeChanged(mode) {
    this.record('video', 'cam_mode_changed', { mode });
  }

  /** Record local stream assigned to a video display. */
  localStreamUpdated(display, color) {
    this.record('video', 'local_stream_updated', { display, color });
  }

  /** Record remote stream assigned to a video display. */
  remoteStreamUpdated(display, color) {
    this.record('video', 'remote_stream_updated', { display, color });
  }

  // --- Private ---

  /** Best-effort flush using sendBeacon (survives page close on mobile). */
  _beaconFlush() {
    if (this._buffer.length === 0) return;
    const events = this._buffer.splice(0);
    const payload = {
      sessionId: this._sessionId,
      gameId: this._gameId,
      roomCode: this._roomCode,
      deviceInfo: this._buildDeviceInfo(),
      events,
    };
    try {
      navigator.sendBeacon(
        DIAG_API,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    } catch (e) {
      // Best effort — nothing more we can do
    }
  }

  /** Return device info merged with current version strings. */
  _buildDeviceInfo() {
    const base = this._deviceInfo || this._detectDeviceInfo();
    return {
      ...base,
      clientVersion: this._clientVersion,
      apiVersion: this._apiVersion,
    };
  }

  /** Detect browser, OS, and device info from user agent. */
  _detectDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      browser: this._parseBrowser(ua),
      browserVersion: this._parseBrowserVersion(ua),
      os: this._parseOS(ua),
      osVersion: this._parseOSVersion(ua),
      device: this._parseDevice(ua),
      screenWidth: screen.width,
      screenHeight: screen.height,
      userAgent: ua.substring(0, 500),
    };
  }

  _parseBrowser(ua) {
    if (/CriOS/.test(ua)) return 'Chrome iOS';
    if (/FxiOS/.test(ua)) return 'Firefox iOS';
    if (/EdgA/.test(ua) || /Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    if (/Firefox\//.test(ua)) return 'Firefox';
    return 'Unknown';
  }

  _parseBrowserVersion(ua) {
    const patterns = [
      /CriOS\/([\d.]+)/,
      /FxiOS\/([\d.]+)/,
      /Edg\/([\d.]+)/,
      /OPR\/([\d.]+)/,
      /Chrome\/([\d.]+)/,
      /Version\/([\d.]+).*Safari/,
      /Firefox\/([\d.]+)/,
    ];
    for (const pattern of patterns) {
      const match = ua.match(pattern);
      if (match) return match[1];
    }
    return 'Unknown';
  }

  _parseOS(ua) {
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    return 'Unknown';
  }

  _parseOSVersion(ua) {
    const patterns = [
      /iPhone OS ([\d_]+)/, /iPad.*OS ([\d_]+)/,
      /Android ([\d.]+)/,
      /Mac OS X ([\d_.]+)/,
      /Windows NT ([\d.]+)/,
    ];
    for (const pattern of patterns) {
      const match = ua.match(pattern);
      if (match) return match[1].replace(/_/g, '.');
    }
    return 'Unknown';
  }

  _parseDevice(ua) {
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPod/.test(ua)) return 'iPod';
    if (/Android.*Mobile/.test(ua)) return 'Android Phone';
    if (/Android/.test(ua)) return 'Android Tablet';
    return 'Desktop';
  }
}
