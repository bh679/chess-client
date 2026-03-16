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
const CAM_LABELS = { 'board-face': 'Board - Face', 'king-cam': 'King - Cam', 'split-cam': 'Side / Side', 'split-cam-h': 'Top / Bottom', 'none': 'No-Cam' };
const CAM_LABELS_SHORT = { 'board-face': 'Board Face', 'split-cam': 'Side / Side', 'split-cam-h': 'Top / Bottom', 'king-cam': 'King Cam', 'none': 'No Cam' };
const CAM_MODES = ['board-face', 'king-cam', 'split-cam', 'split-cam-h', 'none'];

export class MultiplayerUI {
  constructor(mp) {
    this.mp = mp; // MultiplayerClient instance
    this._onStartGame = null; // callback from app.js
    this._onCamChange = null; // callback for cam mode changes
    this._onColorPreferenceChange = null; // callback for waiting-room color preview
    this._currentView = 'menu'; // 'menu' | 'waiting' | 'searching' | 'lobby' | 'ingame'
    this._lobbyState = null;
    this._myReady = false;
    this._aiMode = false; // true when an AI game is starting (lobby Ready→Start)
    this._pendingLobbyCustomTc = false;
    this._myColor = null; // 'w' | 'b' — set when game starts via setPlayerColor()
    // Settings tracked while in waiting state (host-only, before opponent joins)
    this._waitingSettings = { timeControl: '5+0', chess960: false, colorPreference: 'random' };

    this._initElements();
    this._bindEvents();
  }

  /** Set callback for when a multiplayer game starts */
  onStartGame(cb) {
    this._onStartGame = cb;
  }

  /** Set callback for when cam mode changes in the lobby */
  onCamChange(cb) { this._onCamChange = cb; }

  /** Set callback for when color preference changes in the waiting room (for board preview flip) */
  onColorPreferenceChange(cb) { this._onColorPreferenceChange = cb; }

  /** Get current cam mode from lobby button */
  getCamMode() { return this.inlineCamBtn?.dataset.mode ?? 'board-face'; }

  /** Sync the cam button to a mode received from the other player */
  syncCamMode(mode) {
    if (!this.inlineCamBtn) return;
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

  /** Set which color the local player is (call before showGameControls) */
  setPlayerColor(color) {
    this._myColor = color;
  }

  /** Show the in-game multiplayer controls */
  showGameControls() {
    this.gameControls.classList.remove('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
    // Show per-player connection dots and set initial connected state
    if (this.playerConnStatusWhite) this.playerConnStatusWhite.classList.remove('hidden');
    if (this.playerConnStatusBlack) this.playerConnStatusBlack.classList.remove('hidden');
    this._updateConnDot(this.playerConnStatusWhite, 'connected');
    this._updateConnDot(this.playerConnStatusBlack, 'connected');
  }

  /** Hide in-game controls */
  hideGameControls() {
    this.gameControls.classList.add('hidden');
    this.drawOfferToast.classList.add('hidden');
    this.rematchControls.classList.add('hidden');
    // Hide per-player connection dots
    if (this.playerConnStatusWhite) this.playerConnStatusWhite.classList.add('hidden');
    if (this.playerConnStatusBlack) this.playerConnStatusBlack.classList.add('hidden');
    this._myColor = null;
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
    this.rematchOfferBtn.textContent = 'Rematch';
    this.rematchOfferBtn.classList.remove('hidden');
    if (this.summaryBtn) this.summaryBtn.classList.add('hidden'); // summary is open
  }

  /** Show the Summary button (after user closes the post-game summary modal) */
  showSummaryButton() {
    if (this.summaryBtn) this.summaryBtn.classList.remove('hidden');
  }

  /** Hide the Summary button (when re-opening the post-game summary modal) */
  hideSummaryButton() {
    if (this.summaryBtn) this.summaryBtn.classList.add('hidden');
  }

  /** Show rematch offer received */
  showRematchOffer() {
    this.rematchControls.classList.remove('hidden');
    this.rematchStatus.textContent = 'Opponent wants a rematch!';
    this.rematchOfferBtn.textContent = 'Accept';
    this.rematchOfferBtn.classList.remove('hidden');
  }

  /** Update per-player connection status dots in the player bars */
  setConnectionStatus(status) {
    if (!this._myColor) return;
    const myEl = this._myColor === 'w' ? this.playerConnStatusWhite : this.playerConnStatusBlack;
    const oppEl = this._myColor === 'w' ? this.playerConnStatusBlack : this.playerConnStatusWhite;

    switch (status) {
      case 'connected':
        this._updateConnDot(myEl, 'connected');
        this._updateConnDot(oppEl, 'connected');
        break;
      case 'reconnecting':
        this._updateConnDot(myEl, 'reconnecting');
        break;
      case 'disconnected':
      case 'connection-lost':
        this._updateConnDot(myEl, status);
        break;
      case 'opponent-disconnected':
        this._updateConnDot(oppEl, 'disconnected');
        break;
    }
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
      colorPreference: 'random',
    };
    this._currentView = 'waiting';
    this._updateStatusBar();

    // Set up the share URL
    const shareUrl = `${location.origin}${location.pathname}?room=${roomId}`;
    this._shareUrl = shareUrl;
    this.waitingUrlDisplay.textContent = roomId;

    // Default to public
    this._isPublic = true;
    this.publicToggleBtn.classList.add('active');
    this.publicToggleBtn.title = 'Lobby is public';
    this.mp.setPublic(true);

    // Show lobby panel in waiting mode
    this._renderLobbyPanel();
    this.waitingSection.classList.remove('hidden');
    this.readyRow.classList.add('hidden');
    this.colorItem.classList.remove('hidden');
    this.lobbyPanel.classList.remove('hidden');

    // Show my connection dot (opponent not present yet in waiting room)
    if (this._myColor) {
      const myEl = this._myColor === 'w' ? this.playerConnStatusWhite : this.playerConnStatusBlack;
      const oppEl = this._myColor === 'w' ? this.playerConnStatusBlack : this.playerConnStatusWhite;
      myEl.classList.remove('hidden');
      this._updateConnDot(myEl, 'connected');
      oppEl.classList.add('hidden');
    }

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
    this._lobbyState = { ...payload, colorPreference: this._waitingSettings?.colorPreference ?? 'random' };
    this._aiMode = false;
    this._myReady = false;
    // Initialize cam button from lobby settings (creator's chosen mode)
    if (this.inlineCamBtn) {
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
    this._updateStatusBar();

    // Show both connection dots now that opponent has joined
    this._myColor = payload.color;
    const myEl = this._myColor === 'w' ? this.playerConnStatusWhite : this.playerConnStatusBlack;
    const oppEl = this._myColor === 'w' ? this.playerConnStatusBlack : this.playerConnStatusWhite;
    myEl.classList.remove('hidden');
    oppEl.classList.remove('hidden');
    this._updateConnDot(myEl, 'connected');
    this._updateConnDot(oppEl, 'connected');
  }

  /** Returns whether the local player is the room creator */
  isCreator() {
    return this._lobbyState?.isCreator ?? true;
  }

  /** Mark that an AI game is being set up (replaces "Ready" with "Start" in lobby) */
  setAIMode(enabled) {
    this._aiMode = enabled;
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
    document.title = 'Chess';
    if (this.statusEl) this.statusEl.className = 'status';
    // Hide connection dots — game controls will re-show them when the game starts
    if (this.playerConnStatusWhite) this.playerConnStatusWhite.classList.add('hidden');
    if (this.playerConnStatusBlack) this.playerConnStatusBlack.classList.add('hidden');
  }

  /** Render the lobby panel settings buttons (TC, variant, color, cam) for both waiting and lobby views */
  _renderLobbyPanel() {
    const isWaiting = this._currentView === 'waiting';
    if (!isWaiting && !this._lobbyState) return;

    // TC
    const TC_LABELS = {
      '1+0': 'Bullet 1+0', '3+2': 'Blitz 3+2', '5+0': 'Rapid 5+0',
      '10+0': 'Rapid 10+0', '15+10': 'Classical 15+10', '30+0': 'Classical 30+0',
      'none': 'No Timer'
    };
    const tc = isWaiting
      ? (this._waitingSettings.timeControl || 'none')
      : (this._lobbyState.settings?.timeControl || 'none');
    const oddsMatch = !isWaiting && tc.match(/^(\d+)\/(\d+)\+(\d+)$/);
    if (oddsMatch) {
      const s = this._lobbyState;
      const myMin = s.isCreator ? oddsMatch[1] : oddsMatch[2];
      const theirMin = s.isCreator ? oddsMatch[2] : oddsMatch[1];
      this.inlineTcDisplay.textContent = `You: ${myMin}min / Opp: ${theirMin}min +${oddsMatch[3]}s`;
    } else {
      this.inlineTcDisplay.textContent = TC_LABELS[tc] ?? tc;
    }
    this.inlineTcDisplay.classList.remove('hidden');
    this.inlineTcSelect.classList.add('hidden');

    // Variant
    const chess960 = isWaiting ? this._waitingSettings.chess960 : this._lobbyState.settings?.chess960;
    this.inline960Btn.textContent = chess960 ? 'Chess960' : 'Standard';

    // Color
    const COLOR_LABELS = { white: 'I am White', black: 'I am Black', random: 'Random Color' };
    if (isWaiting) {
      this.inlineSwapBtn.textContent = COLOR_LABELS[this._waitingSettings.colorPreference] ?? 'Random Color';
    } else {
      this.inlineSwapBtn.textContent = COLOR_LABELS[this._lobbyState.colorPreference ?? 'random'] ?? 'Random Color';
    }

    // Ready states (lobby only)
    if (!isWaiting) {
      const s = this._lobbyState;
      const myReadyState = s.color === 'w' ? s.white?.ready : s.black?.ready;
      const oppReadyState = s.color === 'w' ? s.black?.ready : s.white?.ready;
      this.inlineReadyYou.classList.toggle('ready', !!myReadyState);
      this.inlineReadyOpp.classList.toggle('ready', !!oppReadyState);
      const oppName = s.color === 'w' ? (s.black?.name || 'Opponent') : (s.white?.name || 'Opponent');
      this.inlineReadyYou.querySelector('.lobby-ready-name').textContent = myReadyState ? 'You are ready' : 'You';
      this.inlineReadyOpp.querySelector('.lobby-ready-name').textContent = oppReadyState ? `${oppName} is ready` : oppName;

      if (this._aiMode) {
        this.inlineReadyBtn.textContent = 'Start';
        this.inlineReadyBtn.classList.remove('not-ready');
      } else if (this._myReady) {
        this.inlineReadyBtn.textContent = 'Not Ready';
        this.inlineReadyBtn.classList.add('not-ready');
      } else {
        this.inlineReadyBtn.textContent = 'Ready';
        this.inlineReadyBtn.classList.remove('not-ready');
      }
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
      if (payload.settings?.colorPreference !== undefined) {
        this._waitingSettings.colorPreference = payload.settings.colorPreference;
      }
      this._renderLobbyPanel();
      this._updateStatusBar();
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
      const newMode = payload.settings?.camMode ?? 'board-face';
      this.inlineCamBtn.dataset.mode = newMode;
      this.inlineCamBtn.textContent = CAM_LABELS_SHORT[newMode] ?? 'Board Face';
    }
    // Reset our ready state
    this._myReady = false;
    if (this._lobbyState.white) this._lobbyState.white.ready = false;
    if (this._lobbyState.black) this._lobbyState.black.ready = false;
    this._renderLobbyPanel();
    this._updateStatusBar();
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
  applyCustomTc(yourMin, opponentMin, increment) {
    // yourMin/opponentMin are from the stable "Your time" / "Opponent's time" inputs.
    // Sent as-is: color is not used here as it may not yet be defined.
    const tcString = yourMin === opponentMin
      ? `${yourMin}+${increment}`
      : `${yourMin}/${opponentMin}+${increment}`;
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

  /** Update the header status bar and document title to reflect the current multiplayer pre-game state */
  _updateStatusBar() {
    if (!this.statusEl) return;
    if (this._currentView === 'waiting') {
      const s = this._waitingSettings;
      const tc = s.timeControl === 'none' ? 'No Timer' : (s.timeControl || '5+0');
      const variant = s.chess960 ? ' · Chess960' : '';
      this.statusEl.textContent = `Hosting${variant} · ${tc}`;
      this.statusEl.className = 'status waiting-room';
      document.title = 'Waiting... | Chess';
    } else if (this._currentView === 'lobby' && this._lobbyState) {
      const s = this._lobbyState;
      const tc = s.settings?.timeControl === 'none' ? 'No Timer' : (s.settings?.timeControl || '5+0');
      const variant = s.settings?.chess960 ? ' · Chess960' : '';
      const oppName = s.color === 'w' ? (s.black?.name || 'Opponent') : (s.white?.name || 'Opponent');
      this.statusEl.textContent = `vs ${oppName}${variant} · ${tc}`;
      this.statusEl.className = 'status lobby';
      document.title = `vs ${oppName} | Chess`;
    }
  }

  _showHeaderRoomCode(_roomId) {
    // Room code display removed from header
  }

  _hideHeaderRoomCode() {
    // Room code display removed from header
  }

  _initElements() {
    // Modal and backdrop
    this.modal = document.getElementById('mp-modal');
    this.backdrop = document.getElementById('mp-backdrop');

    this.statusEl = document.getElementById('status');

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
    this.publicToggleBtn = document.getElementById('lobby-public-toggle');
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
    const savedName = localStorage.getItem('chess-player-name');
    if (savedName) this.mpPlayerName.value = savedName;

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
    this.summaryBtn = document.getElementById('mp-summary-btn');

    // Per-player connection status dots (shown inline next to player names during online games)
    this.playerConnStatusWhite = document.getElementById('player-connection-status-white');
    this.playerConnStatusBlack = document.getElementById('player-connection-status-black');
  }

  _bindEvents() {
    // Close modal
    this.backdrop.addEventListener('click', () => this.close());

    // Quick Match
    this.quickMatchBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      if (name) localStorage.setItem('chess-player-name', name);
      this.mp.quickMatch(tc, name);
      this.showSearching();
    });

    // Create Room
    this.createRoomBtn.addEventListener('click', () => {
      const tc = this.mpTimeControl.value;
      const name = this.mpPlayerName.value.trim() || null;
      if (name) localStorage.setItem('chess-player-name', name);
      this.mp.createRoom(tc, name);
    });

    // Join Room
    this.joinRoomBtn.addEventListener('click', () => {
      const code = this.joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) return;
      const name = this.mpPlayerName.value.trim() || null;
      if (name) localStorage.setItem('chess-player-name', name);
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

    // Public toggle button
    this._isPublic = true;
    this.publicToggleBtn.addEventListener('click', () => {
      this._isPublic = !this._isPublic;
      this.mp.setPublic(this._isPublic);
      this.publicToggleBtn.classList.toggle('active', this._isPublic);
      this.publicToggleBtn.title = this._isPublic ? 'Lobby is public' : 'Make lobby public';
    });

    // Listen for server confirmation
    this.mp.onPublicSet = (payload) => {
      this._isPublic = payload.isPublic;
      this.publicToggleBtn.classList.toggle('active', this._isPublic);
      this.publicToggleBtn.title = this._isPublic ? 'Lobby is public' : 'Make lobby public';
    };

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
      if (value === 'custom' || value === 'odds') {
        this._pendingLobbyCustomTc = true;
        document.getElementById('custom-your-label').textContent = 'Your time (min):';
        document.getElementById('custom-opponent-label').textContent = "Opponent's time (min):";
        const isOdds = value === 'odds';
        const oddsToggle = document.getElementById('custom-odds-toggle');
        oddsToggle.checked = isOdds;
        document.getElementById('same-time-fields').classList.toggle('hidden', isOdds);
        document.getElementById('odds-time-fields').classList.toggle('hidden', !isOdds);
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
        this._renderLobbyPanel();
        this.mp.proposeSetting('chess960', next);
        return;
      }
      const current = this._lobbyState?.settings?.chess960 || false;
      this.mp.proposeSetting('chess960', !current);
    });

    // Inline lobby — color swap / color preference
    this.inlineSwapBtn.addEventListener('click', () => {
      if (this._currentView === 'waiting') {
        const ORDER = ['random', 'white', 'black'];
        const next = ORDER[(ORDER.indexOf(this._waitingSettings.colorPreference) + 1) % ORDER.length];
        this._waitingSettings.colorPreference = next;
        this.mp.proposeSetting('colorPreference', next);
        this._renderLobbyPanel();
        this._onColorPreferenceChange?.(next);
        return;
      }
      if (this._currentView !== 'lobby') return;
      const ORDER = ['random', 'white', 'black'];
      const next = ORDER[(ORDER.indexOf(this._lobbyState.colorPreference ?? 'random') + 1) % ORDER.length];
      this._lobbyState.colorPreference = next;
      this._renderLobbyPanel();
      this.mp.proposeSetting('colorPreference', next);
    });

    // Inline lobby — cam mode cycle
    if (this.inlineCamBtn) {
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

  /** Update a connection dot element to a given state */
  _updateConnDot(el, state) {
    if (!el) return;
    el.className = `player-conn-dot ${state}`;
    const ariaLabels = { connected: 'Connected', reconnecting: 'Reconnecting', disconnected: 'Disconnected', 'connection-lost': 'Connection lost' };
    el.setAttribute('aria-label', ariaLabels[state] || state);
    // Show text label for non-connected states; dot-only for connected
    // Space before ● is handled by ::after CSS, so no leading space here
    const textLabels = { connected: '', reconnecting: 'Reconnecting', disconnected: 'Disconnected', 'connection-lost': 'Lost' };
    el.textContent = textLabels[state] ?? '';
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
