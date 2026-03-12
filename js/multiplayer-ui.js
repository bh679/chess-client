/**
 * MultiplayerUI — manages the multiplayer modal, in-game controls,
 * and connection status. Works with MultiplayerClient and app.js.
 *
 * The pre-game lobby settings (TC, variant, colors, ready) are rendered
 * in an inline panel below the board (#lobby-panel), not in the modal.
 * The modal is kept for: menu, waiting (room created), searching.
 */
export class MultiplayerUI {
  constructor(mp) {
    this.mp = mp; // MultiplayerClient instance
    this._onStartGame = null; // callback from app.js
    this._currentView = 'menu'; // 'menu' | 'waiting' | 'searching' | 'lobby' | 'ingame'
    this._lobbyState = null;
    this._myReady = false;
    this._pendingLobbyCustomTc = false;

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
    // Also show room code in the header while waiting
    this._showHeaderRoomCode(roomId);
  }

  /** Show searching screen */
  showSearching() {
    this._showView('searching');
  }

  /** Show lobby — inline panel below board, modal closes */
  showLobby(payload) {
    this._lobbyState = { ...payload };
    this._myReady = false;
    this._renderLobbyPanel();
    // Show inline panel, hide modal
    this.lobbyPanel.classList.remove('hidden');
    this.close();
    // Show room code in header
    this._showHeaderRoomCode(payload.roomId);
    this._currentView = 'lobby';
  }

  /** Hide the inline lobby panel — called when game starts */
  hideLobbyPanel() {
    this.lobbyPanel.classList.add('hidden');
    this._hideHeaderRoomCode();
    this._lobbyState = null;
    this._myReady = false;
  }

  /** Render inline lobby panel from current state */
  _renderLobbyPanel() {
    if (!this._lobbyState) return;
    const s = this._lobbyState;

    // TC
    const tc = s.settings?.timeControl || 'none';
    this.inlineTcDisplay.textContent = tc === 'none' ? 'No Timer' : tc;
    this.inlineTcDisplay.classList.remove('hidden');
    this.inlineTcSelect.classList.add('hidden');

    // Variant
    this.inline960Btn.textContent = s.settings?.chess960 ? 'Chess960' : 'Standard';

    // Color — from our perspective
    const myColor = s.color === 'w' ? 'White' : 'Black';
    this.inlineSwapBtn.textContent = myColor;

    // Ready states
    const myReadyState = s.color === 'w' ? s.white?.ready : s.black?.ready;
    const oppReadyState = s.color === 'w' ? s.black?.ready : s.white?.ready;
    this.inlineReadyYou.classList.toggle('ready', !!myReadyState);
    this.inlineReadyOpp.classList.toggle('ready', !!oppReadyState);
    this.inlineReadyYou.querySelector('.lobby-ready-name').textContent = myReadyState ? 'You are ready' : 'You';
    this.inlineReadyOpp.querySelector('.lobby-ready-name').textContent = oppReadyState ? 'Opponent is ready' : 'Opponent';

    // Ready button state
    if (this._myReady) {
      this.inlineReadyBtn.textContent = 'Not Ready';
      this.inlineReadyBtn.classList.add('not-ready');
    } else {
      this.inlineReadyBtn.textContent = 'Ready';
      this.inlineReadyBtn.classList.remove('not-ready');
    }
  }

  /** Called when a setting change is applied (immediate, no approval needed) */
  showSettingChanged(payload) {
    if (!this._lobbyState) return;
    if (payload.settings) {
      this._lobbyState.settings = { ...payload.settings };
    }
    if (payload.field === 'colorSwap') {
      this._lobbyState.color = this._lobbyState.color === 'w' ? 'b' : 'w';
    }
    // Reset our ready state
    this._myReady = false;
    if (this._lobbyState.white) this._lobbyState.white.ready = false;
    if (this._lobbyState.black) this._lobbyState.black.ready = false;
    this._renderLobbyPanel();
  }

  /** Called when ready state changes */
  updateReadyState(payload) {
    if (!this._lobbyState) return;
    if (this._lobbyState.white) this._lobbyState.white.ready = payload.w;
    if (this._lobbyState.black) this._lobbyState.black.ready = payload.b;
    this._renderLobbyPanel();
  }

  /** Returns true if a custom TC entry from the lobby is pending */
  hasPendingLobbyCustomTc() {
    return this._pendingLobbyCustomTc;
  }

  /** Apply a custom TC from the custom-time-modal to the lobby */
  applyCustomTc(wMin, bMin, increment) {
    const tcString = wMin === bMin
      ? `${wMin}+${increment}`
      : `${wMin}/${bMin}+${increment}`;
    // Insert or update the custom option so the display reflects it
    let opt = this.inlineTcSelect.querySelector('option[value="__custom__"]');
    if (!opt) {
      opt = document.createElement('option');
      opt.value = '__custom__';
      this.inlineTcSelect.insertBefore(opt, this.inlineTcSelect.querySelector('option[value="custom"]'));
    }
    opt.value = tcString;
    opt.textContent = `Custom ${tcString}`;
    this._pendingLobbyCustomTc = false;
    this.mp.proposeSetting('timeControl', tcString);
  }

  /** Cancel a pending custom TC entry — revert the select display */
  resetLobbyCustomTc() {
    this._pendingLobbyCustomTc = false;
    // Revert select value to current lobby TC
    const currentTc = this._lobbyState?.settings?.timeControl || 'none';
    this.inlineTcSelect.value = currentTc;
  }

  // --- Private ---

  _showHeaderRoomCode(roomId) {
    this.statusEl.classList.add('hidden');
    this.headerRoomCodeDisplay.classList.remove('hidden');
    this.headerRoomCodeValue.textContent = roomId || '------';
  }

  _hideHeaderRoomCode() {
    this.headerRoomCodeDisplay.classList.add('hidden');
    this.statusEl.classList.remove('hidden');
  }

  _initElements() {
    // Modal and backdrop
    this.modal = document.getElementById('mp-modal');
    this.backdrop = document.getElementById('mp-backdrop');

    // Header room code display
    this.statusEl = document.getElementById('status');
    this.headerRoomCodeDisplay = document.getElementById('lobby-room-code-display');
    this.headerRoomCodeValue = document.getElementById('lobby-room-code-header');

    // Inline lobby panel
    this.lobbyPanel = document.getElementById('lobby-panel');
    this.inlineTcDisplay = document.getElementById('lobby-tc-display');
    this.inlineTcSelect = document.getElementById('lobby-tc-select');
    this.inline960Btn = document.getElementById('lobby-960-btn');
    this.inlineSwapBtn = document.getElementById('lobby-swap-btn');
    this.inlineReadyBtn = document.getElementById('lobby-ready-btn');
    this.inlineReadyYou = document.getElementById('lobby-ready-you');
    this.inlineReadyOpp = document.getElementById('lobby-ready-opp');

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

    // Legacy lobby view in modal (kept for reconnect edge cases, hidden by default)
    this.lobbyView = document.getElementById('mp-lobby');
    this.lobbyCloseBtn = document.getElementById('mp-lobby-close');

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
      this._hideHeaderRoomCode();
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

    // Legacy lobby close (X button in modal, kept for edge cases)
    this.lobbyCloseBtn.addEventListener('click', () => {
      this.mp.disconnect();
      this.hideLobbyPanel();
      this.close();
    });

    // Inline lobby — TC: click value to show dropdown
    this.inlineTcDisplay.addEventListener('click', () => {
      const currentTc = this._lobbyState?.settings?.timeControl || 'none';
      this.inlineTcSelect.value = currentTc;
      this.inlineTcDisplay.classList.add('hidden');
      this.inlineTcSelect.classList.remove('hidden');
      this.inlineTcSelect.focus();
    });

    this.inlineTcSelect.addEventListener('change', () => {
      const value = this.inlineTcSelect.value;
      this.inlineTcDisplay.classList.remove('hidden');
      this.inlineTcSelect.classList.add('hidden');
      if (value === 'custom') {
        this._pendingLobbyCustomTc = true;
        document.getElementById('custom-time-modal').classList.remove('hidden');
        return;
      }
      this.mp.proposeSetting('timeControl', value);
    });

    this.inlineTcSelect.addEventListener('blur', () => {
      this.inlineTcDisplay.classList.remove('hidden');
      this.inlineTcSelect.classList.add('hidden');
    });

    // Inline lobby — 960 toggle
    this.inline960Btn.addEventListener('click', () => {
      const current = this._lobbyState?.settings?.chess960 || false;
      this.mp.proposeSetting('chess960', !current);
    });

    // Inline lobby — color swap
    this.inlineSwapBtn.addEventListener('click', () => {
      this.mp.proposeSetting('colorSwap', true);
    });

    // Inline lobby — ready
    this.inlineReadyBtn.addEventListener('click', () => {
      this._myReady = !this._myReady;
      this.mp.setReady(this._myReady);
      this._renderLobbyPanel();
    });
  }

  _showView(view) {
    this._currentView = view;
    this.menuView.classList.toggle('hidden', view !== 'menu');
    this.waitingView.classList.toggle('hidden', view !== 'waiting');
    this.searchingView.classList.toggle('hidden', view !== 'searching');
    // Legacy lobby view in modal — always hidden (lobby is now inline)
    this.lobbyView.classList.add('hidden');
    this.lobbyCloseBtn.classList.add('hidden');
    // Show modal for menu/waiting/searching
    if (view === 'menu' || view === 'waiting' || view === 'searching') {
      this.modal.classList.remove('hidden');
      this.backdrop.classList.remove('hidden');
    }
  }
}
