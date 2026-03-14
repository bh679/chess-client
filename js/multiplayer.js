/**
 * MultiplayerClient — WebSocket client for live multiplayer chess.
 * Manages connection, room lifecycle, move sync, and reconnection.
 */
export class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.sessionId = this._getOrCreateSessionId();
    this.roomId = null;
    this.color = null; // 'w' or 'b'
    this.active = false;
    this._roomConnected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._reconnectTimer = null;
    this._serverUrl = null;
    this._heartbeatInterval = null;
    this._heartbeatTimeout = null;

    // Event callbacks (set by app.js)
    this.onGameStart = null;
    this.onOpponentMove = null;
    this.onMoveAck = null;
    this.onClockSync = null;
    this.onDrawOffered = null;
    this.onDrawDeclined = null;
    this.onGameEnd = null;
    this.onRematchOffered = null;
    this.onRematchDeclined = null;
    this.onRematchStart = null;
    this.onOpponentDisconnected = null;
    this.onOpponentReconnected = null;
    this.onReconnect = null;
    this.onQueueJoined = null;
    this.onQueueLeft = null;
    this.onRoomCreated = null;
    this.onRoomsList = null;
    this.onRoomCancelled = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onReconnecting = null;
    this.onConnectionLost = null;
    this.onError = null;

    // WebRTC video signaling callbacks
    this.onRtcOffer = null;
    this.onRtcAnswer = null;
    this.onRtcIce = null;
    this.onVideoStart = null;
    this.onVideoPeerReady = null;
    this.onVideoEnded = null;

    // Name change callback
    this.onNameChange = null;

    // Shared review callbacks
    this.onReviewEntered = null;
    this.onReviewNavigate = null;
    this.onReviewArrow = null;
    this.onReviewClearArrows = null;
    this.onReviewAnalysisStarted = null;
    this.onReviewAnalysis = null;
    this.onReviewExited = null;

    // Lobby callbacks
    this.onLobbyJoined = null;
    this.onSettingChanged = null;
    this.onReadyState = null;

    // Public lobby callbacks
    this.onPublicSet = null;
    this.onPublicRoomsList = null;
  }

  /** Connect to the WebSocket server */
  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      this._serverUrl = serverUrl || this._buildWsUrl();
      this.ws = new WebSocket(this._serverUrl);

      this.ws.onopen = () => {
        this._reconnectAttempts = 0;
        // Authenticate with session ID
        this._send('auth', { sessionId: this.sessionId });
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        try {
          this._handleMessage(msg, resolve);
        } catch (e) {
          console.error('[MP] Message handler error:', msg?.type, e);
        }
      };

      this.ws.onclose = () => {
        this._stopHeartbeat();
        if (this.active) {
          this._attemptReconnect();
        }
        if (this.onDisconnected) this.onDisconnected();
      };

      this.ws.onerror = (err) => {
        if (this.onError) this.onError('Connection error');
        reject(err);
      };
    });
  }

  /** Create a new room */
  createRoom(timeControl, name, camMode, chess960) {
    const videoEnabled = camMode !== 'none';
    this._send('create_room', { timeControl, name, camMode: camMode ?? 'none', videoEnabled, chess960: !!chess960 });
  }

  /** Join an existing room by code */
  joinRoom(roomId, name) {
    this._send('join_room', { roomId: roomId.toUpperCase(), name });
  }

  /** Join the quick match queue */
  quickMatch(timeControl, name, camMode, chess960) {
    const videoEnabled = camMode !== 'none';
    this._send('quick_match', { timeControl, name, camMode: camMode ?? 'none', videoEnabled, chess960: !!chess960 });
  }

  /** Cancel queue search */
  cancelQueue() {
    this._send('cancel_queue', {});
  }

  /** Send a move to the server */
  sendMove(san) {
    this._send('move', { san });
  }

  /** Resign the current game */
  resign() {
    this._send('resign', {});
  }

  /** Offer a draw */
  offerDraw() {
    this._send('draw_offer', {});
  }

  /** Respond to a draw offer */
  respondToDraw(accept) {
    this._send('draw_respond', { accept });
  }

  /** Offer a rematch */
  offerRematch() {
    this._send('rematch_offer', {});
  }

  /** Respond to a rematch offer */
  respondToRematch(accept) {
    this._send('rematch_respond', { accept });
  }

  /** Change display name (broadcast to opponent) */
  changeName(name) {
    this._send('name_change', { name });
  }

  /** Request list of active/pending rooms */
  listRooms() {
    this._send('list_rooms', {});
  }

  /** Cancel a pending waiting room */
  cancelPendingRoom() {
    this._send('cancel_room', {});
  }

  /** Send WebRTC offer SDP */
  sendRtcOffer(sdp) { this._send('rtc_offer', { sdp }); }

  /** Send WebRTC answer SDP */
  sendRtcAnswer(sdp) { this._send('rtc_answer', { sdp }); }

  /** Send ICE candidate */
  sendRtcIce(candidate) { this._send('rtc_ice', { candidate }); }

  /** Notify server that local camera is ready */
  sendVideoReady() { this._send('video_ready', {}); }

  /** Notify server that we're ending our video */
  sendVideoEnd() { this._send('video_end', {}); }

  // --- Shared review methods ---

  /** Enter shared post-game review */
  sendReviewEnter() { this._send('review_enter', {}); }

  /** Navigate to a specific ply in shared review */
  sendReviewNavigate(ply) { this._send('review_navigate', { ply }); }

  /** Send an arrow annotation to peer */
  sendReviewArrow(action, from, to) { this._send('review_arrow', { action, from, to }); }

  /** Clear our arrows (notify peer) */
  sendReviewClearArrows() { this._send('review_clear_arrows', {}); }

  /** Notify peer that we started analysis */
  sendReviewAnalysisStarted() { this._send('review_analysis_started', {}); }

  /** Share analysis results with peer */
  sendReviewAnalysis(data) { this._send('review_analysis', data); }

  /** Exit shared review */
  sendReviewExit() { this._send('review_exit', {}); }

  // --- Lobby methods ---

  /** Propose a setting change */
  proposeSetting(field, value) { this._send('setting_change', { field, value }); }

  /** Set ready state */
  setReady(ready) { this._send('player_ready', { ready }); }

  /** Toggle public visibility for the current waiting room */
  setPublic(isPublic) { this._send('set_public', { isPublic }); }

  /** Request list of public rooms available to join */
  requestPublicRooms() { this._send('list_public_rooms', {}); }

  /** Disconnect from the server */
  disconnect() {
    this.active = false;
    this.roomId = null;
    this.color = null;
    this._roomConnected = false;
    this._stopHeartbeat();
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Whether we're in an active multiplayer game */
  isActive() {
    return this.active;
  }

  /** Whether we're authenticated and in a room on the server */
  isRoomConnected() {
    return this._roomConnected;
  }

  /** Whether it's our turn */
  isMyTurn(gameTurn) {
    return this.color === gameTurn;
  }

  // --- Private methods ---

  _buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  _send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  _handleMessage(msg, connectResolve) {
    const { type, payload } = msg;

    switch (type) {
      case 'auth_ok':
        this._roomConnected = !!(payload && payload.inRoom);
        if (this.onConnected) this.onConnected(payload);
        if (connectResolve) connectResolve();
        this._startHeartbeat();
        break;

      case 'room_created':
        this.roomId = payload.roomId;
        this.color = payload.color;
        if (this.onRoomCreated) this.onRoomCreated(payload);
        break;

      case 'queue_joined':
        if (this.onQueueJoined) this.onQueueJoined(payload);
        break;

      case 'queue_left':
        if (this.onQueueLeft) this.onQueueLeft();
        break;

      case 'game_start':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        if (this.onGameStart) this.onGameStart(payload);
        break;

      case 'move':
        if (this.onOpponentMove) this.onOpponentMove(payload);
        break;

      case 'move_ack':
        if (this.onMoveAck) this.onMoveAck(payload);
        break;

      case 'clock_sync':
        if (this.onClockSync) this.onClockSync(payload);
        break;

      case 'draw_offered':
        if (this.onDrawOffered) this.onDrawOffered();
        break;

      case 'draw_declined':
        if (this.onDrawDeclined) this.onDrawDeclined();
        break;

      case 'game_end':
        this.active = false;
        if (this.onGameEnd) this.onGameEnd(payload);
        break;

      case 'rematch_offered':
        if (this.onRematchOffered) this.onRematchOffered();
        break;

      case 'rematch_declined':
        if (this.onRematchDeclined) this.onRematchDeclined();
        break;

      case 'rematch_start':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        if (this.onRematchStart) this.onRematchStart(payload);
        break;

      case 'opponent_disconnected':
        if (this.onOpponentDisconnected) this.onOpponentDisconnected(payload);
        break;

      case 'opponent_reconnected':
        if (this.onOpponentReconnected) this.onOpponentReconnected();
        break;

      case 'reconnect':
        this.roomId = payload.roomId;
        this.color = payload.color;
        this.active = true;
        this._roomConnected = true;
        if (this.onReconnect) this.onReconnect(payload);
        break;

      case 'rooms_list':
        if (this.onRoomsList) this.onRoomsList(payload.rooms);
        break;

      case 'room_cancelled':
        this.roomId = null;
        this.color = null;
        if (this.onRoomCancelled) this.onRoomCancelled();
        break;

      // WebRTC video signaling
      case 'rtc_offer':
        if (this.onRtcOffer) this.onRtcOffer(payload);
        break;

      case 'rtc_answer':
        if (this.onRtcAnswer) this.onRtcAnswer(payload);
        break;

      case 'rtc_ice':
        if (this.onRtcIce) this.onRtcIce(payload);
        break;

      case 'video_start':
        if (this.onVideoStart) this.onVideoStart(payload);
        break;

      case 'video_peer_ready':
        if (this.onVideoPeerReady) this.onVideoPeerReady();
        break;

      case 'video_ended':
        if (this.onVideoEnded) this.onVideoEnded(payload);
        break;

      case 'name_change':
        if (this.onNameChange) this.onNameChange(payload);
        break;

      // Shared review messages
      case 'review_entered':
        if (this.onReviewEntered) this.onReviewEntered(payload);
        break;

      case 'review_navigate':
        if (this.onReviewNavigate) this.onReviewNavigate(payload);
        break;

      case 'review_arrow':
        if (this.onReviewArrow) this.onReviewArrow(payload);
        break;

      case 'review_clear_arrows':
        if (this.onReviewClearArrows) this.onReviewClearArrows(payload);
        break;

      case 'review_analysis_started':
        if (this.onReviewAnalysisStarted) this.onReviewAnalysisStarted(payload);
        break;

      case 'review_analysis':
        if (this.onReviewAnalysis) this.onReviewAnalysis(payload);
        break;

      case 'review_exited':
        if (this.onReviewExited) this.onReviewExited(payload);
        break;

      // Lobby messages
      case 'lobby_joined':
        if (this.active) {
          console.warn('[MP] Received lobby_joined while game active — possible mid-game reset', { roomId: payload.roomId, currentRoom: this.roomId });
        }
        this.roomId = payload.roomId;
        this.color = payload.color;
        if (this.onLobbyJoined) this.onLobbyJoined(payload);
        break;

      case 'setting_changed':
        if (this.onSettingChanged) this.onSettingChanged(payload);
        break;

      case 'ready_state':
        if (this.onReadyState) this.onReadyState(payload);
        break;

      case 'public_set':
        if (this.onPublicSet) this.onPublicSet(payload);
        break;

      case 'public_rooms_list':
        if (this.onPublicRoomsList) this.onPublicRoomsList(payload.rooms);
        break;

      case 'error':
        if (payload.message === 'Not in a room' && this.active) {
          // Room was lost — trigger reconnection instead of surfacing error
          if (this.onRoomLost) this.onRoomLost();
          this._roomConnected = false;
          this.ws.close();
          return;
        }
        if (this.onError) this.onError(payload.message);
        break;

      case 'pong':
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = null;
        break;
    }
  }

  _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this.active = false;
      this._roomConnected = false;
      if (this.onConnectionLost) this.onConnectionLost();
      return;
    }

    this._reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);

    if (this.onReconnecting) {
      this.onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);
    }

    this._reconnectTimer = setTimeout(() => {
      this.connect(this._serverUrl).catch(() => {
        this._attemptReconnect();
      });
    }, delay);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this._send('ping', { ts: Date.now() });
      this._heartbeatTimeout = setTimeout(() => {
        // No pong received — connection is stale
        if (this.onHeartbeatTimeout) this.onHeartbeatTimeout();
        if (this.ws) this.ws.close();
      }, 5000);
    }, 15000);
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatInterval);
    this._heartbeatInterval = null;
    clearTimeout(this._heartbeatTimeout);
    this._heartbeatTimeout = null;
  }

  _getOrCreateSessionId() {
    // Use localStorage so session persists across page reloads
    let id = localStorage.getItem('chess-mp-session-id');
    if (!id) {
      // Migrate from sessionStorage if present
      id = sessionStorage.getItem('chess-mp-session-id');
      if (!id) {
        id = crypto.randomUUID();
      }
      localStorage.setItem('chess-mp-session-id', id);
    }
    return id;
  }
}
