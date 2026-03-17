import { getAllEngines } from './engines/registry.js';

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_DISPLAY = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

const DEV_MODE_KEY = 'chess-dev-mode';
const CAM_LABELS = { 'board-face': 'Board-Face', 'king-cam': 'King·Cam', 'split-cam': 'Side/Side', 'split-cam-h': 'Top/Bottom', 'none': 'No-Cam' };

/**
 * UIController — owns UI rendering and pre-game inline controls.
 *
 * Extracted from app.js to reduce file size and improve cohesion.
 * Manages: captured pieces display, status messages, player name editing,
 * engine switching, timer/ELO popups, confirmation modal, dev mode indicator,
 * public lobbies panel, and camera mode switching.
 */
export class UIController {
  // Internal state
  showingGameInfo = false;
  customWhiteName = localStorage.getItem('chess-player-name') || null;
  customBlackName = localStorage.getItem('chess-player-name') || null;
  _publicLobbyPollTimer = null;
  _renderedRooms = new Map(); // roomId → { row, text } for diff-based rendering

  constructor({
    game, board, db, mp, gameCtrl, settingsCtrl, replayController, liveMoveBar,
    diagnostics, videoChat, videoBoard, tileCam, splitCam, splitCamH, kingCam,
    getVideoActive,
    callbacks,
    dom,
  }) {
    // Dependencies
    this.game = game;
    this.board = board;
    this.db = db;
    this.mp = mp;
    this.gameCtrl = gameCtrl;
    this.settingsCtrl = settingsCtrl;
    this.replayController = replayController;
    this.liveMoveBar = liveMoveBar;
    this.diagnostics = diagnostics;
    this.videoChat = videoChat;
    this.videoBoard = videoBoard;
    this.tileCam = tileCam;
    this.splitCam = splitCam;
    this.splitCamH = splitCamH;
    this.kingCam = kingCam;
    this.getVideoActive = getVideoActive;
    this.callbacks = callbacks; // { startNewGame }

    // DOM elements
    this.statusEl = dom.statusEl;
    this.capturedByWhiteEl = dom.capturedByWhiteEl;
    this.capturedByBlackEl = dom.capturedByBlackEl;
    this.playerNameWhite = dom.playerNameWhite;
    this.playerNameBlack = dom.playerNameBlack;
    this.playerEloWhite = dom.playerEloWhite;
    this.playerEloBlack = dom.playerEloBlack;
    this.timeControlSelect = dom.timeControlSelect;
    this.customYourLabel = dom.customYourLabel;
    this.customOpponentLabel = dom.customOpponentLabel;
    this.customTimeModal = dom.customTimeModal;
    this.confirmModal = dom.confirmModal;
    this.confirmModalTitle = dom.confirmModalTitle;
    this.confirmModalMessage = dom.confirmModalMessage;
    this.confirmModalOk = dom.confirmModalOk;
    this.confirmModalCancel = dom.confirmModalCancel;
    this.devIndicator = dom.devIndicator;
    this.lobbyPanel = dom.lobbyPanel;
    this.publicLobbiesPanel = dom.publicLobbiesPanel;
    this.publicLobbiesList = dom.publicLobbiesList;

    // Check dev mode once at startup, then listen for cross-tab changes
    this.checkDevMode();
    window.addEventListener('storage', (e) => {
      if (e.key === DEV_MODE_KEY) this.checkDevMode();
    });
  }

  // ─── Captured Pieces ─────────────────────────────────────────────

  renderCaptured() {
    const captured = this.game.getCaptured();

    for (const [color, el] of [['w', this.capturedByWhiteEl], ['b', this.capturedByBlackEl]]) {
      const pieces = [...captured[color]].sort((a, b) => PIECE_ORDER[a] - PIECE_ORDER[b]);
      el.innerHTML = '';

      for (const p of pieces) {
        const img = document.createElement('img');
        img.className = 'captured-piece';
        // White captured these pieces, so they are black pieces (opponent's color)
        const victimColor = color === 'w' ? 'b' : 'w';
        img.src = `${window.chessPiecePath}/${victimColor}${PIECE_DISPLAY[p]}.svg`;
        img.alt = p;
        el.appendChild(img);
      }

      // Material advantage
      const myTotal = captured[color].reduce((s, p) => s + PIECE_VALUES[p], 0);
      const oppColor = color === 'w' ? 'b' : 'w';
      const oppTotal = captured[oppColor].reduce((s, p) => s + PIECE_VALUES[p], 0);
      const diff = myTotal - oppTotal;
      if (diff > 0) {
        const badge = document.createElement('span');
        badge.className = 'material-advantage';
        badge.textContent = `+${diff}`;
        el.appendChild(badge);
      }
    }
  }

  // ─── Status ──────────────────────────────────────────────────────

  updateStatus(msg, isGameInfo) {
    if (isGameInfo) {
      this.showingGameInfo = true;
      this.statusEl.textContent = msg;
      this.statusEl.className = 'status new-game-info';
      return;
    }
    // Keep showing game info until first move or AI thinking
    if (this.showingGameInfo && !msg) return;
    this.showingGameInfo = false;

    this.statusEl.textContent = msg || this.game.getGameStatus();
    this.statusEl.className = 'status';
    if (msg && msg.includes('thinking')) {
      this.statusEl.classList.add('ai-thinking');
    } else if (this.game.isGameOver() || msg) {
      this.statusEl.classList.add('game-over');
    } else if (this.game.getGameStatus().startsWith('Check')) {
      this.statusEl.classList.add('in-check');
    }
  }

  // ─── Popups ───────────────────────────────────────────────────────

  closeAllPopups() {
    document.querySelectorAll('.timer-dropdown, .elo-popup').forEach(el => el.remove());
  }

  showTimerDropdown(timerEl) {
    if (this.replayController.isActive || this.gameCtrl.moveCount > 0) return;
    this.closeAllPopups();

    const dropdown = document.createElement('div');
    dropdown.className = 'timer-dropdown';

    // Gather options from the time control select
    const options = this.timeControlSelect.querySelectorAll('option');
    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'timer-dropdown-option';
      if (opt.value === this.timeControlSelect.value) {
        item.classList.add('selected');
      }
      item.textContent = opt.textContent;
      item.dataset.value = opt.value;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.value === 'custom') {
          this.closeAllPopups();
          this.customYourLabel.textContent = 'Your time (min):';
          this.customOpponentLabel.textContent = "Opponent's time (min):";
          this.customTimeModal.classList.remove('hidden');
          return;
        }
        this.timeControlSelect.value = opt.value;
        this.closeAllPopups();
        this.callbacks.startNewGame();
      });
      dropdown.appendChild(item);
    });

    // Position near the timer
    const rect = timerEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;

    // Prevent dropdown from going off-screen right
    document.body.appendChild(dropdown);
    const dropRect = dropdown.getBoundingClientRect();
    if (dropRect.right > window.innerWidth) {
      dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
    }
    // Prevent going off-screen bottom — show above instead
    if (dropRect.bottom > window.innerHeight) {
      dropdown.style.top = `${rect.top - dropRect.height - 4}px`;
    }
  }

  showEloPopup(eloEl, side) {
    if (this.replayController.isActive || this.gameCtrl.moveCount > 0) return;
    this.closeAllPopups();

    const eloCfg = this.settingsCtrl.getEloConfig(side);

    // Don't show popup for engines with no ELO range (e.g. Random)
    if (!eloCfg) return;

    const popup = document.createElement('div');
    popup.className = 'elo-popup';

    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    rangeInput.min = eloCfg.min;
    rangeInput.max = eloCfg.max;
    rangeInput.step = eloCfg.step;
    rangeInput.value = eloCfg.value;
    rangeInput.className = 'elo-slider';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'elo-value';
    valueDisplay.textContent = eloCfg.value;

    rangeInput.addEventListener('input', () => {
      const elo = parseInt(rangeInput.value, 10);
      valueDisplay.textContent = elo;
      this.settingsCtrl.setElo(side, elo);
      eloEl.textContent = elo;
    });

    popup.appendChild(rangeInput);
    popup.appendChild(valueDisplay);

    // Position near the elo label
    const rect = eloEl.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;

    document.body.appendChild(popup);

    // Adjust if off-screen
    const popRect = popup.getBoundingClientRect();
    if (popRect.right > window.innerWidth) {
      popup.style.left = `${window.innerWidth - popRect.width - 8}px`;
    }
    if (popRect.bottom > window.innerHeight) {
      popup.style.top = `${rect.top - popRect.height - 4}px`;
    }

    // Stop click propagation so it doesn't immediately close
    popup.addEventListener('click', (e) => e.stopPropagation());
  }

  // ─── Confirmation Modal ──────────────────────────────────────────

  showConfirmation(message, title) {
    return new Promise((resolve) => {
      this.confirmModalTitle.textContent = title || 'Confirm';
      this.confirmModalMessage.textContent = message;
      this.confirmModal.classList.remove('hidden');

      function cleanup() {
        this.confirmModal.classList.add('hidden');
        this.confirmModalOk.removeEventListener('click', onOk);
        this.confirmModalCancel.removeEventListener('click', onCancel);
        this.confirmModal.removeEventListener('click', onBackdrop);
      }

      const onOk = () => {
        cleanup.call(this);
        resolve(true);
      };

      const onCancel = () => {
        cleanup.call(this);
        resolve(false);
      };

      const onBackdrop = (e) => {
        if (e.target === this.confirmModal) {
          cleanup.call(this);
          resolve(false);
        }
      };

      this.confirmModalOk.addEventListener('click', onOk);
      this.confirmModalCancel.addEventListener('click', onCancel);
      this.confirmModal.addEventListener('click', onBackdrop);
    });
  }

  // ─── Player Name Editing ─────────────────────────────────────────

  startNameEdit(nameEl, side) {
    if (this.replayController.isActive || this.liveMoveBar.isReviewing) return;
    // Prevent double-editing
    if (nameEl.querySelector('.player-name-input')) return;

    const currentName = nameEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name-input';
    input.value = currentName;
    input.maxLength = 20;

    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.focus();
    input.select();

    const commitName = () => {
      const newName = input.value.trim() || (side === 'white' ? 'Human' : 'Human');
      nameEl.textContent = newName;

      // In multiplayer, broadcast name change to opponent
      if (this.gameCtrl.multiplayerActive) {
        this.mp.changeName(newName);
        return;
      }

      // Only save custom name for human players
      const isAI = this.settingsCtrl.isAIEnabled(side === 'white' ? 'w' : 'b');
      if (!isAI) {
        if (side === 'white') {
          this.customWhiteName = newName === 'Human' ? null : newName;
        } else {
          this.customBlackName = newName === 'Human' ? null : newName;
        }
        if (newName && newName !== 'Human') {
          localStorage.setItem('chess-player-name', newName);
        } else {
          localStorage.removeItem('chess-player-name');
        }
      }

      // Update local-first database
      this.db.updatePlayerName(this.gameCtrl.currentDbGameId, side, newName);
    };

    const cancelEdit = () => {
      nameEl.textContent = currentName;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });

    input.addEventListener('blur', () => {
      // Only commit if input is still in DOM (wasn't cancelled by Escape)
      if (nameEl.contains(input)) {
        commitName();
      }
    });
  }

  startEngineSwitch(nameEl, side) {
    if (this.replayController.isActive || this.gameCtrl.multiplayerActive) return;
    if (nameEl.querySelector('.engine-switch-select')) return;

    const sideKey = side === 'white' ? 'w' : 'b';
    const currentEngineId = this.settingsCtrl.getEngineId(sideKey);
    const currentName = nameEl.textContent;

    const select = document.createElement('select');
    select.className = 'engine-switch-select';
    const engines = getAllEngines();
    for (const eng of engines) {
      const opt = document.createElement('option');
      opt.value = eng.id;
      opt.textContent = `${eng.icon} ${eng.name}`;
      if (eng.id === currentEngineId) opt.selected = true;
      select.appendChild(opt);
    }

    nameEl.textContent = '';
    nameEl.appendChild(select);
    select.focus();
    // Open the dropdown immediately so the user doesn't have to click twice
    try { select.showPicker(); } catch { /* older browsers */ }

    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const newId = select.value;
      // Remove select safely
      if (select.parentNode) {
        select.parentNode.removeChild(select);
      }
      if (newId !== currentEngineId) {
        this.settingsCtrl.setEngine(sideKey, newId);
        this.callbacks.startNewGame();
      } else {
        nameEl.textContent = currentName;
      }
    };

    select.addEventListener('change', commit);
    select.addEventListener('blur', () => {
      if (!committed && select.parentNode) {
        select.parentNode.removeChild(select);
        nameEl.textContent = currentName;
      }
    });
  }

  // ─── Dev Mode ────────────────────────────────────────────────────

  checkDevMode() {
    const devMode = localStorage.getItem(DEV_MODE_KEY);
    if (devMode === 'true') {
      this.devIndicator.classList.remove('hidden');
    } else {
      this.devIndicator.classList.add('hidden');
    }
  }

  // ─── Public Lobbies Panel ────────────────────────────────────────

  _buildRoomText(room) {
    const tc = room.timeControl === 'none' ? 'No timer' : room.timeControl;
    const variant = room.chess960 ? ' · Chess960' : ' · Chess';
    const camMode = room.camMode || 'board-face';
    const cam = ` · ${CAM_LABELS[camMode] ?? camMode}`;
    return `${room.hostName || 'Opponent'} — ${tc}${variant}${cam}`;
  }

  renderPublicLobbies(rooms) {
    // Hide if in a game, in pre-game lobby, or no rooms available
    if (this.gameCtrl.multiplayerActive || !this.lobbyPanel.classList.contains('hidden') || !rooms || rooms.length === 0) {
      this.publicLobbiesPanel.classList.add('hidden');
      this._renderedRooms.clear();
      this.publicLobbiesList.innerHTML = '';
      return;
    }
    this.publicLobbiesPanel.classList.remove('hidden');

    const incomingIds = new Set(rooms.map(r => r.roomId));

    // Remove stale rooms
    for (const [id, entry] of this._renderedRooms) {
      if (!incomingIds.has(id)) {
        entry.row.remove();
        this._renderedRooms.delete(id);
      }
    }

    // Add new rooms / update changed text (batch new additions via DocumentFragment)
    const fragment = document.createDocumentFragment();
    for (const room of rooms) {
      const text = this._buildRoomText(room);
      const existing = this._renderedRooms.get(room.roomId);
      if (existing) {
        if (existing.text !== text) {
          existing.row.querySelector('.public-lobby-info').textContent = text;
          existing.text = text;
        }
      } else {
        const row = document.createElement('div');
        row.className = 'public-lobby-row';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'public-lobby-info';
        nameSpan.textContent = text;
        const joinBtn = document.createElement('button');
        joinBtn.className = 'public-lobby-join-btn';
        joinBtn.textContent = 'Join';
        joinBtn.addEventListener('click', () => {
          this.stopPublicLobbyPolling();
          this.gameCtrl.multiplayerActive = true;
          this.mp.joinRoom(room.roomId, null);
        });
        row.appendChild(nameSpan);
        row.appendChild(joinBtn);
        fragment.appendChild(row);
        this._renderedRooms.set(room.roomId, { row, text });
      }
    }
    if (fragment.childNodes.length > 0) {
      this.publicLobbiesList.appendChild(fragment);
    }
  }

  async _fetchPublicLobbies() {
    if (this.gameCtrl.multiplayerActive) return;
    if (!this.mp.ws || this.mp.ws.readyState !== WebSocket.OPEN) {
      try { await this.mp.connect(); } catch { return; }
    }
    this.mp.requestPublicRooms();
  }

  startPublicLobbyPolling() {
    if (this._publicLobbyPollTimer) return;
    this._fetchPublicLobbies();
    this._publicLobbyPollTimer = setInterval(() => this._fetchPublicLobbies(), 5_000);
  }

  stopPublicLobbyPolling() {
    clearInterval(this._publicLobbyPollTimer);
    this._publicLobbyPollTimer = null;
    this.publicLobbiesPanel.classList.add('hidden');
    this._renderedRooms.clear();
    this.publicLobbiesList.innerHTML = '';
  }

  // ─── Camera Mode ─────────────────────────────────────────────────

  // Switch live video display to match a cam mode (used by both local button
  // clicks and remote setting changes)
  applyCamMode(mode) {
    if (!this.getVideoActive()) return;
    this.diagnostics.camModeChanged(mode);
    if (mode === 'king-cam') {
      this.videoBoard.disable();
      this.tileCam.disable();
      this.splitCam.disable();
      this.splitCamH.disable();
      // Restore raw camera track — videoBoard replaced it with a cropped canvas stream that is now stopped
      const rawVideoTrack = this.videoChat._localStream?.getVideoTracks()[0];
      if (rawVideoTrack) this.videoChat.replaceVideoTrack(rawVideoTrack);
      this.kingCam.enable(this.videoChat._localStream, this.mp.color, null);
      if (this.videoChat._remoteStream) {
        this.kingCam.updateRemoteStream(this.videoChat._remoteStream, this.mp.color === 'w' ? 'b' : 'w');
      }
      this.board.render();
    } else if (mode === 'board-face') {
      this.kingCam.disable();
      this.tileCam.disable();
      this.splitCam.disable();
      this.splitCamH.disable();
      this.board.render();
      this.videoBoard.enable(this.videoChat._localStream, null, this.mp.color);
      // videoBoard replaces the WebRTC track via onCroppedStreamReady when face tracking is ready
      if (this.videoChat._remoteStream) {
        this.videoBoard.updateRemoteStream(this.videoChat._remoteStream, this.mp.color);
      }
    } else if (mode === 'split-cam') {
      this.kingCam.disable();
      this.videoBoard.disable();
      this.tileCam.disable();
      this.splitCamH.disable();
      this.board.render();
      // Restore raw camera track — videoBoard may have replaced it
      const rawVideoTrack = this.videoChat._localStream?.getVideoTracks()[0];
      if (rawVideoTrack) this.videoChat.replaceVideoTrack(rawVideoTrack);
      this.splitCam.enable(this.videoChat._localStream, this.videoChat._remoteStream, this.mp.color);
      this.splitCam.setTintEnabled(true);
    } else if (mode === 'split-cam-h') {
      this.kingCam.disable();
      this.videoBoard.disable();
      this.splitCam.disable();
      this.tileCam.disable();
      this.board.render();
      // Restore raw camera track — videoBoard may have replaced it
      const rawVideoTrack = this.videoChat._localStream?.getVideoTracks()[0];
      if (rawVideoTrack) this.videoChat.replaceVideoTrack(rawVideoTrack);
      this.splitCamH.enable(this.videoChat._localStream, this.videoChat._remoteStream, this.mp.color);
      this.splitCamH.setTintEnabled(true);
    } else if (mode === 'tile-cam') {
      this.kingCam.disable();
      this.videoBoard.disable();
      this.splitCam.disable();
      this.splitCamH.disable();
      this.board.render();
      this.tileCam.enable(this.videoChat._localStream, this.videoChat._remoteStream, this.mp.color);
      this.tileCam.setTintEnabled(true);
    } else {
      this.kingCam.disable();
      this.videoBoard.disable();
      this.tileCam.disable();
      this.splitCam.disable();
      this.splitCamH.disable();
      // Restore raw camera track when disabling all video modes
      const rawVideoTrack = this.videoChat._localStream?.getVideoTracks()[0];
      if (rawVideoTrack) this.videoChat.replaceVideoTrack(rawVideoTrack);
      this.board.render();
    }
  }
}
