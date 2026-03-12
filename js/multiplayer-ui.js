/**
 * MultiplayerUI — manages the multiplayer modal, in-game controls,
 * and connection status. Works with MultiplayerClient and app.js.
 *
 * The pre-game lobby settings (TC, variant, colors, ready) are rendered
 * in an inline panel below the board (#lobby-panel), not in the modal.
 * The modal is kept for: menu, searching.
 *
 * When a room is created (waiting for opponent), the lobby panel opens
 * immediately in "waiting" mode — the host can configure settings while
 * waiting. When the opponent joins, the panel transitions to full lobby
 * mode (ready buttons, color swap).
 */
export class MultiplayerUI {
  constructor(mp) {
    this.mp = mp; // MultiplayerClient instance
    this._onStartGame = null; // callback from app.js
    this._onCamChange = null; // callback for cam mode changes
    this._currentView = 'menu'; // 'menu' | 'waiting' | 'searching' | 'lobby' | 'ingame'
    this._lobbyState = null;
    this._myReady = false;
    this._pendingLobbyCustomTc = false;
    // Settings tracked while in waiting state (host-only, before opponent joins)
    this._waitingSettings = { timeControl: '5+0', chess960: false };

    this._initElements();
    this._bindEvents();
  }

  /** Set callback for when a multiplayer game starts */
  onStartGame(cb) {
    this._onStartGame = cb;
  }

  /** Set callback for when cam mode changes in the lobby */
  onCamChange(cb) { this._onCamChange = cb; }

  /** Get current cam mode from lobby button */
  getCamMode() { return this.inlineCamBtn?.dataset.mode ?? 'board-face'; }

  /** Sync the cam button to a mode received from the other player */
  syncCamMode(mode) {
    if (!this.inlineCamBtn) return;
    const CAM_LABELS = { 'board-face': 'Board - Face', 'king-cam': 'King - Cam', 'split-cam': 'Split Cam', 'none': 'No-Cam' };
    this.inlineCamBtn.dataset.mode = mode;
    this.inlineCamBtn.textContent = CAM_LABELS[mode] ?? mode;
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

  /**
   * Show waiting state — lobby panel opens immediately below board.
   * Host can adjust settings while waiting for opponent to join.
   * initialTc seeds the TC display from the room creation settings.
   */
  showWaiting(roomId, initialTc, initialChess960) {
    this._waitingSettings = {
      timeControl: initialTc || this.mpTimeControl?.value || '5+0',
      chess960: !!initialChess960,
    };
    this._currentView = 'waiting';

    // Set up the share URL
    const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
    this._shareUrl = shareUrl;
    this.waitingUrlDisplay.textContent = roomId;

    // Show lobby panel in waiting mode
    this._renderLobbyPanelWaiting();
    this.waitingSection.classList.remove('hidden');
    this.readyRow.classList.add('hidden');
    this.colorItem.classList.add('hidden');
    this.lobbyPanel.classList.remove('hidden');

    // Close modal, show room code in header
    this.close();
    this._showHeaderRoomCode(roomId);
  }

  /** Show searching screen */
  showSearching() {
    this._showView('searching');
  }

  /**
   * Show full lobby — opponent joined, transition from waiting mode.
   * Hides the waiting section, shows ready buttons and color control.
   */
  showLobby(payload) {
    this._lobbyState = { ...payload };
    this._myReady = false;
    // Initialize cam button from lobby settings (creator's chosen mode)
    if (this.inlineCamBtn) {
      const CAM_LABELS = { 'board-face': 'Board - Face', 'king-cam': 'King - Cam', 'split-cam': 'Split Cam', 'none': 'No-Cam' };
      const mode = payload.settings?.camMode ?? 'board-face';
      this.inlineCamBtn.dataset.mode = mode;
      this.inlineCamBtn.textContent = CAM_LABELS[mode] ?? mode;
    }
    this._renderLobbyPanel();
    // Hide waiting section, show full lobby controls
    this.waitingSection.classList.add('hidden');
    this.readyRow.classList.remove('hidden');
    this.colorItem.classList.remove('hidden');
    // Show inline panel, close modal
    this.lobbyPanel.classList.remove('hidden');
    this.close();
    // Show room code in header
    this._showHeaderRoomCode(payload.roomId);
    this._currentView = 'lobby';
  }

  /** Hide the inline lobby panel — called when game starts */
  hideLobbyPanel() {
    this.lobbyPanel.classList.add('hidden');
    this.waitingSection.classList.add('hidden');
    this.readyRow.classList.remove('hidden');
    this.colorItem.classList.remove('hidden');
    this._hideHeaderRoomCode();
    this._lobbyState = null;
    this._myReady = false;
  }

  /** Render lobby panel in waiting mode from _waitingSettings */
  _renderLobbyPanelWaiting() {
    const tc = this._waitingSettings.timeControl || 'none';
    this.inlineTcDisplay.textContent = tc === 'none' ? 'No Timer' : tc;
    this.inlineTcDisplay.classList.remove('hidden');
    this.inlineTcSelect.classList.add('hidden');
    this.inline960Btn.textContent = this._waitingSettings.chess960 ? 'Chess960' : 'Standard';
    // Color swap not applicable while waiting
    this.inlineSwapBtn.textContent = 'Random';
  }

  /** Render inline lobby panel from current lobby state */
  _renderLobbyPanel() {
    if (!this._lobbyState) return;
    const s = this._lobbyState;

    // TC
    const TC_LABELS = {
      '1+0': 'Bullet 1+0', '3+2': 'Blitz 3+2', '5+0': 'Rapid 5+0',
      '10+0': 'Rapid 10+0', '15+10': 'Classical 15+10', '30+0': 'Classical 30+0',
      'none': 'No Timer'
    };
    const tc = s.settings?.timeControl || 'none';
    this.inlineTcDisplay.textContent = TC_LABELS[tc] ?? tc;
    this.inlineTcDisplay.classList.remove('hidden');
    this.inlineTcSelect.classList.add('hidden');

    // Variant
    this.inline960Btn.textContent = s.settings?.chess960 ? 'Chess960' : 'Chess';

    // Color — from our perspective
    const myColor = s.color === 'w' ? 'I am White' : 'I am Black';
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
    if (this._currentView === 'waiting') {
      // Update waiting settings display
      if (payload.settings?.timeControl !== undefined) {
        this._waitingSettings.timeControl = payload.settings.timeControl;
      }
      if (payload.settings?.chess960 !== undefined) {
        this._waitingSettings.chess960 = payload.settings.chess960;
      }
      this._renderLobbyPanelWaiting();
      return;
    }
    if (!this._lobbyState) return;
    if (payload.settings) {
      this._lobbyState.settings = { ...payload.settings };
    }
    if (payload.field === 'colorSwap') {
      this._lobbyState.color = this._lobbyState.color === 'w' ? 'b' : 'w';
    }
    if (payload.field === 'camMode' && this.inlineCamBtn) {
      const CAM_LABELS = { 'board-face': 'Board Face', 'split-cam': 'Split Cam', 'king-cam': 'King Cam', 'none': 'No Cam' };
      const newMode = payload.settings?.camMode ?? 'board-face';
      this.inlineCamBtn.dataset.mode = newMode;
      this.inlineCamBtn.textContent = CAM_LABELS[newMode] ?? 'Board Face';
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
    // Revert select value
    const currentTc = this._currentView === 'waiting'
      ? (this._waitingSettings.timeControl || 'none')
      : (this._lobbyState?.settings?.timeControl || 'none');
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
    this.inlineCamBtn = document.getElementById('lobby-cam-btn');
    this.inlineReadyBtn = document.getElementById('lobby-ready-btn');
    this.inlineReadyYou = document.getElementById('lobby-ready-you');
    this.inlineReadyOpp = document.getElementById('lobby-ready-opp');

    // Waiting section in lobby panel
    this.waitingSection = document.getElementById('lobby-waiting-section');
    this.waitingUrlDisplay = document.getElementById('lobby-waiting-url');
    this.waitingCopyBtn = document.getElementById('lobby-waiting-copy');
    this.readyRow = document.getElementById('lobby-ready-row');
    this.colorItem = document.getElementById('lobby-color-item');

    // Menu view
    this.menuView = document.getElementById('mp-menu');
    this.quickMatchBtn = document.getElementById('mp-quick-match-btn');
    this.createRoomBtn = document.getElementById('mp-create-room-btn');
    this.joinRoomBtn = document.getElementById('mp-join-room-btn');
    this.joinCodeInput = document.getElementById('mp-join-code');
    this.mpTimeControl = document.getElementById('mp-time-control');
    this.mpPlayerName = document.getElementById('mp-player-name');

    // Waiting view in modal (still used for display but no longer primary waiting UI)
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

    // Cancel waiting (modal — fallback)
    this.cancelWaitBtn?.addEventListener('click', () => {
      this._hideHeaderRoomCode();
      this.mp.disconnect();
      this.close();
    });

    // Copy room code (modal — fallback)
    this.copyCodeBtn?.addEventListener('click', () => {
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

    // Waiting section — copy link
    this.waitingCopyBtn.addEventListener('click', () => {
      const label = this.waitingCopyBtn.querySelector('.lobby-waiting-copy-label');
      navigator.clipboard.writeText(this._shareUrl || '').then(() => {
        if (label) label.textContent = 'Copied!';
        setTimeout(() => { if (label) label.textContent = 'Copy Link'; }, 2000);
      });
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
      const currentTc = this._currentView === 'waiting'
        ? (this._waitingSettings.timeControl || 'none')
        : (this._lobbyState?.settings?.timeControl || 'none');
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
      if (this._currentView === 'waiting') {
        this._waitingSettings.timeControl = value;
      }
      this.mp.proposeSetting('timeControl', value);
    });

    this.inlineTcSelect.addEventListener('blur', () => {
      this.inlineTcDisplay.classList.remove('hidden');
      this.inlineTcSelect.classList.add('hidden');
    });

    // Inline lobby — 960 toggle
    this.inline960Btn.addEventListener('click', () => {
      if (this._currentView === 'waiting') {
        const next = !this._waitingSettings.chess960;
        this._waitingSettings.chess960 = next;
        this.inline960Btn.textContent = next ? 'Chess960' : 'Standard';
        this.mp.proposeSetting('chess960', next);
        return;
      }
      const current = this._lobbyState?.settings?.chess960 || false;
      this.mp.proposeSetting('chess960', !current);
    });

    // Inline lobby — color swap (only in full lobby mode)
    this.inlineSwapBtn.addEventListener('click', () => {
      if (this._currentView !== 'lobby') return;
      this.mp.proposeSetting('colorSwap', true);
    });

    // Inline lobby — cam mode cycle
    if (this.inlineCamBtn) {
      const CAM_MODES = ['board-face', 'king-cam', 'split-cam', 'none'];
      const CAM_LABELS = { 'board-face': 'Board - Face', 'king-cam': 'King - Cam', 'split-cam': 'Split Cam', 'none': 'No-Cam' };
      this.inlineCamBtn.addEventListener('click', () => {
        const next = CAM_MODES[(CAM_MODES.indexOf(this.inlineCamBtn.dataset.mode) + 1) % CAM_MODES.length];
        this.inlineCamBtn.dataset.mode = next;
        this.inlineCamBtn.textContent = CAM_LABELS[next];
        this.mp.proposeSetting('camMode', next);
      });
    }

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
    // Show modal for menu/searching
    if (view === 'menu' || view === 'searching') {
      this.modal.classList.remove('hidden');
      this.backdrop.classList.remove('hidden');
    }
  }
}
