/**
 * MultiplayerUI — manages the multiplayer modal, in-game controls,
 * and connection status. Works with MultiplayerClient and app.js.
 */
export class MultiplayerUI {
  constructor(mp) {
    this.mp = mp; // MultiplayerClient instance
    this._onStartGame = null; // callback from app.js
    this._currentView = 'menu'; // 'menu' | 'waiting' | 'searching' | 'lobby' | 'ingame'
    this._lobbyState = null;
    this._pendingChangeId = null;
    this._myReady = false;

    this._initElements();
    this._bindEvents();
  }

  /** Set callback for when a multiplayer game starts */
  onStartGame(cb) {
    this._onStartGame = cb;
  }

  /** Open the multiplayer modal (main menu) */
  open() {
    this._showView('menu');
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  /** Close the modal */
  close() {
    this.modal.classList.add('hidden');
    this.backdrop.classList.add('hidden');
    // If searching, cancel
    if (this._currentView === 'searching') {
      this.mp.cancelQueue();
    }
  }

  /** Show the in-game multiplayer controls */
  showGameControls() {
    this.gameControls.classList.remove('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
  }

  /** Hide in-game controls */
  hideGameControls() {
    this.gameControls.classList.add('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
  }

  /** Show draw offer toast */
  showDrawOffer() {
    this.drawOfferToast.classList.remove('hidden');
  }

  /** Hide draw offer toast */
  hideDrawOffer() {
    this.drawOfferToast.classList.add('hidden');
  }

  /** Show rematch controls after game ends */
  showRematchControls() {
    this.rematchControls.classList.remove('hidden');
    this.rematchStatus.textContent = '';
    this.rematchOfferBtn.classList.remove('hidden');
  }

  /** Show rematch offer received */
  showRematchOffer() {
    this.rematchControls.classList.remove('hidden');
    this.rematchStatus.textContent = 'Opponent wants a rematch!';
    this.rematchOfferBtn.textContent = 'Accept';
    this.rematchOfferBtn.classList.remove('hidden');
  }

  /** Update connection status indicator */
  setConnectionStatus(status, detail) {
    this.connectionStatus.className = 'mp-connection-status ' + status;
    const labels = {
      connected: 'Connected',
      reconnecting: detail || 'Reconnecting...',
      disconnected: 'Disconnected',
      'opponent-disconnected': 'Opponent disconnected',
      'connection-lost': 'Connection lost',
    };
    this.connectionStatus.textContent = labels[status] || status;
  }

  /** Show waiting screen with room code */
  showWaiting(roomId) {
    this._showView('waiting');
    this.roomCodeDisplay.textContent = roomId;
    // Build the share URL
    const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
    this.shareUrlDisplay.textContent = shareUrl;
  }

  /** Show searching screen */
  showSearching() {
    this._showView('searching');
  }

  /** Show lobby screen with initial payload from server */
  showLobby(payload) {
    this._lobbyState = { ...payload };
    this._myReady = payload.white?.ready || payload.black?.ready ? (payload.color === 'w' ? payload.white.ready : payload.black.ready) : false;
    this._pendingChangeId = null;
    this._myReady = false;
    this._renderLobby();
    this._showView('lobby');
    this.modal.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
  }

  /** Render all lobby elements from current state */
  _renderLobby() {
    if (!this._lobbyState) return;
    const s = this._lobbyState;

    this.lobbyRoomCode.textContent = s.roomId || '------';
    this.lobbyOpponent.textContent = s.opponentName || 'Opponent';

    // Settings
    const tc = s.settings?.timeControl || 'none';
    this.lobbyTcDisplay.textContent = tc === 'none' ? 'No Timer' : tc;
    this.lobby960Display.textContent = s.settings?.chess960 ? 'Chess960' : 'Standard';

    // Color display — from perspective of our color
    const myColor = s.color === 'w' ? 'White' : 'Black';
    const oppColor = s.color === 'w' ? 'Black' : 'White';
    this.lobbyColorDisplay.textContent = `You: ${myColor}`;

    // Ready states
    const myReadyState = s.color === 'w' ? s.white?.ready : s.black?.ready;
    const oppReadyState = s.color === 'w' ? s.black?.ready : s.white?.ready;
    this.lobbyReadyYou.classList.toggle('ready', !!myReadyState);
    this.lobbyReadyOpp.classList.toggle('ready', !!oppReadyState);
    this.lobbyReadyBtn.textContent = this._myReady ? 'Not Ready' : 'Ready';

    // Reset TC select to hidden display mode
    this.lobbyTcDisplay.classList.remove('hidden');
    this.lobbyTcSelect.classList.add('hidden');
  }

  /** Called when opponent proposes a setting change */
  showPendingChange(payload) {
    this._pendingChangeId = payload.changeId;
    const label = this._changeLabel(payload.field, payload.value);
    this.lobbyPendingText.textContent = `Opponent proposes: ${label}`;
    this.lobbyPendingActions.classList.remove('hidden');
    this.lobbyPending.classList.remove('hidden');
    this._setEditBtnsDisabled(true);
  }

  /** Called when we proposed a change and are waiting for response */
  showMyPendingChange(payload) {
    this._pendingChangeId = payload.changeId;
    const label = this._changeLabel(payload.field, payload.value);
    this.lobbyPendingText.textContent = `Proposed: ${label} — waiting...`;
    this.lobbyPendingActions.classList.add('hidden');
    this.lobbyPending.classList.remove('hidden');
    this._setEditBtnsDisabled(true);
    // Revert TC select to display mode
    this.lobbyTcDisplay.classList.remove('hidden');
    this.lobbyTcSelect.classList.add('hidden');
  }

  /** Called when a setting proposal is resolved (accepted or declined) */
  resolveSetting(payload) {
    this._pendingChangeId = null;
    this.lobbyPending.classList.add('hidden');
    this._setEditBtnsDisabled(false);
    if (payload.accepted && payload.settings) {
      this._lobbyState.settings = { ...payload.settings };
      // After colorSwap, flip our color
      if (payload.field === 'colorSwap') {
        this._lobbyState.color = this._lobbyState.color === 'w' ? 'b' : 'w';
      }
      // Reset ready states
      this._myReady = false;
      if (this._lobbyState.white) this._lobbyState.white.ready = false;
      if (this._lobbyState.black) this._lobbyState.black.ready = false;
    }
    this._renderLobby();
  }

  /** Called when ready state changes */
  updateReadyState(payload) {
    if (!this._lobbyState) return;
    if (this._lobbyState.white) this._lobbyState.white.ready = payload.w;
    if (this._lobbyState.black) this._lobbyState.black.ready = payload.b;
    this._renderLobby();
  }

  _changeLabel(field, value) {
    if (field === 'timeControl') return `Time: ${value === 'none' ? 'No Timer' : value}`;
    if (field === 'chess960') return value ? 'Enable Chess960' : 'Disable Chess960';
    if (field === 'colorSwap') return 'Swap Colors';
    return field;
  }

  _setEditBtnsDisabled(disabled) {
    this.lobbyTcEdit.disabled = disabled;
    this.lobby960Btn.disabled = disabled;
    this.lobbySwapBtn.disabled = disabled;
  }

  // --- Private ---

  _initElements() {
    // Modal and backdrop
    this.modal = document.getElementById('mp-modal');
    this.backdrop = document.getElementById('mp-backdrop');

    // Menu view
    this.menuView = document.getElementById('mp-menu');
    this.quickMatchBtn = document.getElementById('mp-quick-match-btn');
    this.createRoomBtn = document.getElementById('mp-create-room-btn');
    this.joinRoomBtn = document.getElementById('mp-join-room-btn');
    this.joinCodeInput = document.getElementById('mp-join-code');
    this.mpTimeControl = document.getElementById('mp-time-control');
    this.mpPlayerName = document.getElementById('mp-player-name');

    // Waiting view (room created, waiting for opponent)
    this.waitingView = document.getElementById('mp-waiting');
    this.roomCodeDisplay = document.getElementById('mp-room-code');
    this.shareUrlDisplay = document.getElementById('mp-share-url');
    this.cancelWaitBtn = document.getElementById('mp-cancel-wait');
    this.copyCodeBtn = document.getElementById('mp-copy-code');

    // Searching view (in queue)
    this.searchingView = document.getElementById('mp-searching');
    this.cancelSearchBtn = document.getElementById('mp-cancel-search');

    // Lobby view
    this.lobbyView = document.getElementById('mp-lobby');
    this.lobbyRoomCode = document.getElementById('mp-lobby-room-code');
    this.lobbyOpponent = document.getElementById('mp-lobby-opponent');
    this.lobbyTcDisplay = document.getElementById('mp-lobby-tc');
    this.lobbyTcSelect = document.getElementById('mp-lobby-tc-select');
    this.lobbyTcEdit = document.getElementById('mp-lobby-tc-edit');
    this.lobby960Display = document.getElementById('mp-lobby-960');
    this.lobby960Btn = document.getElementById('mp-lobby-960-btn');
    this.lobbyColorDisplay = document.getElementById('mp-lobby-color');
    this.lobbySwapBtn = document.getElementById('mp-lobby-swap-btn');
    this.lobbyPending = document.getElementById('mp-lobby-pending');
    this.lobbyPendingText = document.getElementById('mp-lobby-pending-text');
    this.lobbyPendingActions = document.getElementById('mp-lobby-pending-actions');
    this.lobbyAcceptBtn = document.getElementById('mp-lobby-accept');
    this.lobbyDeclineBtn = document.getElementById('mp-lobby-decline');
    this.lobbyReadyYou = document.getElementById('mp-lobby-ready-you');
    this.lobbyReadyOpp = document.getElementById('mp-lobby-ready-opp');
    this.lobbyReadyBtn = document.getElementById('mp-lobby-ready-btn');
    this.lobbyLeaveBtn = document.getElementById('mp-lobby-leave');

    // In-game controls
    this.gameControls = document.getElementById('mp-game-controls');
    this.resignBtn = document.getElementById('mp-resign-btn');
    this.drawOfferBtn = document.getElementById('mp-draw-offer-btn');

    // Draw offer toast
    this.drawOfferToast = document.getElementById('mp-draw-toast');
    this.drawAcceptBtn = document.getElementById('mp-draw-accept');
    this.drawDeclineBtn = document.getElementById('mp-draw-decline');

    // Rematch controls
    this.rematchControls = document.getElementById('mp-rematch-controls');
    this.rematchOfferBtn = document.getElementById('mp-rematch-offer-btn');
    this.rematchStatus = document.getElementById('mp-rematch-status');

    // Connection status
    this.connectionStatus = document.getElementById('mp-connection-status');
  }

  _bindEvents() {
    // Close modal
    this.backdrop.addEventListener('click', () => this.close());

    // Quick Match
    this.quickMatchBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.quickMatch(tc, name);
      this.showSearching();
    });

    // Create Room
    this.createRoomBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.createRoom(tc, name);
    });

    // Join Room
    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) return;
      const name = this.mpPlayerName.value.trim() || null;
      this.mp.joinRoom(code, name);
    });

    // Join on Enter key
    this.joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoomBtn.click();
    });

    // Cancel waiting
    this.cancelWaitBtn.addEventListener('click', () => {
      this.mp.disconnect();
      this.close();
    });

    // Copy room code
    this.copyCodeBtn.addEventListener('click', () => {
      const shareUrl = this.shareUrlDisplay.textContent;
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => { this.copyCodeBtn.textContent = 'Copy Link'; }, 2000);
      });
    });

    // Cancel search
    this.cancelSearchBtn.addEventListener('click', () => {
      this.mp.cancelQueue();
      this._showView('menu');
    });

    // Resign
    this.resignBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to resign?')) {
        this.mp.resign();
      }
    });

    // Offer draw
    this.drawOfferBtn.addEventListener('click', () => {
      this.mp.offerDraw();
      this.drawOfferBtn.textContent = 'Draw Offered';
      this.drawOfferBtn.disabled = true;
      setTimeout(() => {
        this.drawOfferBtn.textContent = 'Offer Draw';
        this.drawOfferBtn.disabled = false;
      }, 5000);
    });

    // Accept/decline draw
    this.drawAcceptBtn.addEventListener('click', () => {
      this.mp.respondToDraw(true);
      this.hideDrawOffer();
    });
    this.drawDeclineBtn.addEventListener('click', () => {
      this.mp.respondToDraw(false);
      this.hideDrawOffer();
    });

    // Rematch
    this.rematchOfferBtn.addEventListener('click', () => {
      if (this.rematchOfferBtn.textContent === 'Accept') {
        this.mp.respondToRematch(true);
        this.rematchStatus.textContent = 'Starting rematch...';
      } else {
        this.mp.offerRematch();
        this.rematchOfferBtn.classList.add('hidden');
        this.rematchStatus.textContent = 'Rematch offered — waiting for opponent...';
      }
    });

    // Lobby — TC edit
    this.lobbyTcEdit.addEventListener('click', () => {
      if (this.lobbyTcEdit.disabled) return;
      // Set select to current value before showing
      const currentTc = this._lobbyState?.settings?.timeControl || 'none';
      this.lobbyTcSelect.value = currentTc;
      this.lobbyTcDisplay.classList.add('hidden');
      this.lobbyTcSelect.classList.remove('hidden');
      this.lobbyTcSelect.focus();
    });

    this.lobbyTcSelect.addEventListener('change', () => {
      const value = this.lobbyTcSelect.value;
      this.lobbyTcDisplay.classList.remove('hidden');
      this.lobbyTcSelect.classList.add('hidden');
      this.mp.proposeSetting('timeControl', value);
    });

    this.lobbyTcSelect.addEventListener('blur', () => {
      // If they blur without selecting, revert
      this.lobbyTcDisplay.classList.remove('hidden');
      this.lobbyTcSelect.classList.add('hidden');
    });

    // Lobby — 960 toggle
    this.lobby960Btn.addEventListener('click', () => {
      if (this.lobby960Btn.disabled) return;
      const current = this._lobbyState?.settings?.chess960 || false;
      this.mp.proposeSetting('chess960', !current);
    });

    // Lobby — color swap
    this.lobbySwapBtn.addEventListener('click', () => {
      if (this.lobbySwapBtn.disabled) return;
      this.mp.proposeSetting('colorSwap', true);
    });

    // Lobby — accept/decline proposal
    this.lobbyAcceptBtn.addEventListener('click', () => {
      if (this._pendingChangeId) {
        this.mp.respondToSetting(this._pendingChangeId, true);
      }
    });
    this.lobbyDeclineBtn.addEventListener('click', () => {
      if (this._pendingChangeId) {
        this.mp.respondToSetting(this._pendingChangeId, false);
      }
    });

    // Lobby — ready
    this.lobbyReadyBtn.addEventListener('click', () => {
      this._myReady = !this._myReady;
      this.mp.setReady(this._myReady);
      this.lobbyReadyBtn.textContent = this._myReady ? 'Not Ready' : 'Ready';
    });

    // Lobby — leave
    this.lobbyLeaveBtn.addEventListener('click', () => {
      this.mp.disconnect();
      this.close();
    });
  }

  _showView(view) {
    this._currentView = view;
    this.menuView.classList.toggle('hidden', view !== 'menu');
    this.waitingView.classList.toggle('hidden', view !== 'waiting');
    this.searchingView.classList.toggle('hidden', view !== 'searching');
    this.lobbyView.classList.toggle('hidden', view !== 'lobby');
  }
}
