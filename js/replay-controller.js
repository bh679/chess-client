import { Chess } from './chess.js';
import { getEngineInfo } from './engines/registry.js';

/**
 * ReplayController — manages replay-mode state and navigation on the main board.
 *
 * Extracted from app.js to reduce file size and improve cohesion.
 * Analysis functions remain in app.js and are accessed via callbacks.
 */
export class ReplayController {
  // Public state (read externally)
  isActive = false;

  // Private state
  _game = null;        // the game record being replayed
  _ply = -1;
  _moveDetails = [];
  _clockSnapshots = [];
  _playing = false;
  _playbackTimer = null;

  // Dependencies
  _board = null;
  _gameEngine = null;
  _sound = null;
  _timer = null;
  _dom = null;
  _callbacks = null;

  /**
   * @param {object} deps
   * @param {object} deps.board      — Board instance
   * @param {object} deps.game       — Game instance (game.chess is the Chess engine)
   * @param {object} deps.sound      — Sound instance
   * @param {object} deps.timer      — Timer instance
   * @param {object} deps.dom        — DOM element references:
   *   { statusEl, boardEl, timerWhiteEl, timerBlackEl,
   *     replayControlsEl, replayMoveListEl,
   *     replayStartBtn, replayPrevBtn, replayPlayBtn, replayNextBtn, replayEndBtn,
   *     replayResultEl, playerNameWhite, playerNameBlack,
   *     playerIconWhite, playerIconBlack, playerEloWhite, playerEloBlack,
   *     capturedByWhiteEl, capturedByBlackEl, gameTypeLabel,
   *     startGameBtn, appEl, newGameBtn }
   * @param {object} deps.callbacks  — callback hooks:
   *   { onExitReplay(startNew), resetAnalysis(), getAnalysisData(),
   *     onAnalysisUpdate(), onRunAnalysis(gameRecord),
   *     onEnterSharedReview(), onExitSharedReview(),
   *     onNavigate(ply), shouldClearPeerArrows(),
   *     closeAllPopups(), fadeLiveMoveBar(), exitLiveReview(),
   *     isLiveReview(), showConfirmation(msg, title),
   *     getCurrentDbGameId(), endCurrentGame(), resetMoveCount(),
   *     getMoveCount(), isGameOver(), getLastMultiplayerGameRecord(),
   *     stopAI(), stopLiveEval(), getMpRoomId(),
   *     getReplayAnalyzeEnabled(), routerSilentUpdate(path, params) }
   */
  constructor({ board, game, sound, timer, dom, callbacks }) {
    this._board = board;
    this._gameEngine = game;
    this._sound = sound;
    this._timer = timer;
    this._dom = dom;
    this._callbacks = callbacks;
  }

  /** The game record currently being replayed (or null). */
  getGame() {
    return this._game;
  }

  /** Current ply index (-1 = starting position). */
  getPly() {
    return this._ply;
  }

  // --- Enter / Exit ---

  async enter(gameRecord) {
    const cb = this._callbacks;
    const dom = this._dom;

    // Confirm if there's an active live game
    if (!this.isActive && cb.getMoveCount() > 0 && !cb.isGameOver() && !cb.getLastMultiplayerGameRecord()) {
      const confirmed = await cb.showConfirmation(
        'You have a game in progress. Abandon it to review this game?',
        'Abandon Game?'
      );
      if (!confirmed) return;

      const dbId = cb.getCurrentDbGameId();
      if (dbId) cb.endCurrentGame(dbId);
      cb.resetMoveCount();
    }

    if (this.isActive) this.exit(false);
    if (cb.isLiveReview()) cb.exitLiveReview();

    cb.stopAI();
    this._timer.stop();
    cb.stopLiveEval();

    this.isActive = true;
    this._game = gameRecord;
    this._ply = -1;
    this._playing = false;

    // Precompute move details
    this._moveDetails = [];
    const scratch = new Chess(gameRecord.startingFen);
    for (const move of gameRecord.moves) {
      const result = scratch.move(move.san);
      if (result) {
        this._moveDetails.push({
          fen: move.fen,
          from: result.from,
          to: result.to,
          san: move.san,
          side: move.side,
        });
      }
    }

    // Reconstruct clocks
    this._clockSnapshots = this._reconstructClocks(gameRecord);

    // Disable board input and show replay border
    this._board.setInteractive(false);
    dom.boardEl.classList.add('replay-mode-border');

    // Update player bars
    this._updatePlayerBars(gameRecord);

    // Update status
    dom.statusEl.textContent = 'Replay Mode';
    dom.statusEl.className = 'status replay-mode';

    // Hide normal game controls
    dom.startGameBtn.classList.add('hidden');
    dom.appEl.classList.remove('pre-game');
    cb.closeAllPopups();

    // Build move list
    this._buildMoveList(gameRecord);

    // Show replay controls (activate live-move-bar with replay UI)
    dom.replayControlsEl.classList.remove('faded');
    dom.replayExtrasEl.classList.remove('hidden');
    dom.replayPlayBtn.classList.remove('hidden');
    if (dom.replayAnalyzeToggleEl) dom.replayAnalyzeToggleEl.classList.remove('hidden');

    // Show result
    if (gameRecord.result) {
      dom.replayResultEl.textContent = this._formatResult(gameRecord);
      dom.replayResultEl.style.display = '';
    } else {
      dom.replayResultEl.style.display = 'none';
    }

    // Render starting position
    this.goToMove(-1);

    // Highlight New Game button
    dom.newGameBtn.classList.add('game-ended');

    // Set up keyboard handler
    document.addEventListener('keydown', this._keyHandler);

    // Auto-analyze if toggle is enabled
    cb.resetAnalysis();
    if (cb.getReplayAnalyzeEnabled()) {
      cb.onRunAnalysis(gameRecord);
    }

    // Update URL
    if (gameRecord.id) {
      cb.routerSilentUpdate('/replay', { gameid: gameRecord.id });
    }

    // Enter shared review if post-multiplayer
    if (cb.getMpRoomId()) {
      cb.onEnterSharedReview();
    }
  }

  exit(startNew = true) {
    if (!this.isActive) return;
    const cb = this._callbacks;
    const dom = this._dom;

    cb.onExitSharedReview();
    this.stopPlayback();
    cb.resetAnalysis();

    this.isActive = false;
    this._game = null;
    this._ply = -1;
    this._moveDetails = [];
    this._clockSnapshots = [];

    // Clear all arrows
    this._board.getArrowOverlay().clear();

    // Re-enable board input
    this._board.setInteractive(true);
    dom.boardEl.classList.remove('replay-mode-border');

    // Hide replay controls (fade live-move-bar, hide replay-only elements)
    dom.replayExtrasEl.classList.add('hidden');
    dom.replayPlayBtn.classList.add('hidden');
    if (dom.replayAnalyzeToggleEl) dom.replayAnalyzeToggleEl.classList.add('hidden');
    dom.replayMoveListEl.innerHTML = '';
    dom.replayControlsEl.classList.add('faded');

    // Remove keyboard handler
    document.removeEventListener('keydown', this._keyHandler);

    if (startNew) cb.onExitReplay(true);
  }

  // --- Navigation ---

  goToMove(plyIndex) {
    if (!this._game) return;
    const maxPly = this._game.moves.length - 1;
    this._ply = Math.max(-1, Math.min(plyIndex, maxPly));

    if (this._ply === -1) {
      this._gameEngine.chess.load(this._game.startingFen);
      this._gameEngine._lastMove = null;
    } else {
      const detail = this._moveDetails[this._ply];
      this._gameEngine.chess.load(detail.fen);
      this._gameEngine._lastMove = { from: detail.from, to: detail.to };
    }

    this._board.render();
    this._highlightMove();
    this._updateButtons();
    this._updateTimers();

    const dom = this._dom;
    if (this._ply === -1) {
      dom.statusEl.textContent = 'Replay Mode \u2014 Starting Position';
    } else {
      const moveNum = Math.floor(this._ply / 2) + 1;
      const side = this._moveDetails[this._ply].side === 'w' ? '' : '...';
      dom.statusEl.textContent = `Replay Mode \u2014 ${moveNum}${side} ${this._moveDetails[this._ply].san}`;
    }
    dom.statusEl.className = 'status replay-mode';

    // Update analysis (stays in app.js)
    const cb = this._callbacks;
    if (cb.getAnalysisData()) {
      cb.onAnalysisUpdate();
    } else {
      this._board.getArrowOverlay().clearEngineArrows();
    }

    // Clear peer arrows on navigation
    if (cb.shouldClearPeerArrows()) {
      this._board.getArrowOverlay().clearPeerAnnotations();
    }

    // Sync navigation to peer
    cb.onNavigate(this._ply);
  }

  next() {
    if (!this._game) return;
    if (this._ply >= this._game.moves.length - 1) {
      this.stopPlayback();
      return;
    }
    this.goToMove(this._ply + 1);
  }

  prev() {
    this.goToMove(this._ply - 1);
  }

  goToStart() {
    this.stopPlayback();
    this.goToMove(-1);
  }

  goToEnd() {
    this.stopPlayback();
    if (this._game) {
      this.goToMove(this._game.moves.length - 1);
    }
  }

  // --- Playback ---

  togglePlayback() {
    if (this._playing) {
      this.stopPlayback();
    } else {
      this._startPlayback();
    }
  }

  stopPlayback() {
    this._playing = false;
    if (this._playbackTimer) {
      clearTimeout(this._playbackTimer);
      this._playbackTimer = null;
    }
    const btn = this._dom.replayPlayBtn;
    if (btn) {
      btn.textContent = '\u25B6';
      btn.classList.remove('playing');
    }
  }

  _startPlayback() {
    if (!this._game) return;
    if (this._ply >= this._game.moves.length - 1) {
      this.goToMove(-1);
    }
    this._playing = true;
    this._dom.replayPlayBtn.textContent = '\u23F8';
    this._dom.replayPlayBtn.classList.add('playing');
    this._scheduleNext();
  }

  _scheduleNext() {
    if (!this._playing || !this._game) return;
    if (this._ply >= this._game.moves.length - 1) {
      this.stopPlayback();
      return;
    }

    const nextPly = this._ply + 1;
    const nextMove = this._game.moves[nextPly];
    let delay;

    if (this._ply === -1) {
      delay = nextMove.timestamp - this._game.startTime;
    } else {
      delay = nextMove.timestamp - this._game.moves[this._ply].timestamp;
    }

    delay = Math.max(200, Math.min(delay, 5000));

    this._playbackTimer = setTimeout(() => {
      this.next();
      if (this._playing) this._scheduleNext();
    }, delay);
  }

  // --- Clock Reconstruction ---

  _parseTimeControl(tc) {
    if (!tc || tc === 'none' || tc === 'No Timer') return null;
    const oddsMatch = tc.match(/(\d+)\/(\d+)\+(\d+)/);
    if (oddsMatch) {
      return {
        baseSec: parseInt(oddsMatch[1], 10) * 60,
        secondPlayerBaseSec: parseInt(oddsMatch[2], 10) * 60,
        increment: parseInt(oddsMatch[3], 10),
      };
    }
    const legacyOddsMatch = tc.match(/W(\d+)\s*\/\s*B(\d+)\s*\+(\d+)/);
    if (legacyOddsMatch) {
      return {
        baseSec: parseInt(legacyOddsMatch[1], 10) * 60,
        secondPlayerBaseSec: parseInt(legacyOddsMatch[2], 10) * 60,
        increment: parseInt(legacyOddsMatch[3], 10),
      };
    }
    const match = tc.match(/(\d+)\+(\d+)/);
    if (!match) return null;
    return { baseSec: parseInt(match[1], 10) * 60, increment: parseInt(match[2], 10) };
  }

  _reconstructClocks(gameRecord) {
    const snapshots = [];
    const tc = this._parseTimeControl(gameRecord.timeControl);
    if (!tc) {
      for (let i = 0; i < gameRecord.moves.length; i++) snapshots.push(null);
      return snapshots;
    }

    let whiteTime = tc.baseSec;
    let blackTime = tc.secondPlayerBaseSec || tc.baseSec;
    let prevTimestamp = gameRecord.startTime;

    for (const move of gameRecord.moves) {
      const spent = (move.timestamp - prevTimestamp) / 1000;
      if (move.side === 'w') {
        whiteTime = Math.max(0, whiteTime - spent) + tc.increment;
      } else {
        blackTime = Math.max(0, blackTime - spent) + tc.increment;
      }
      snapshots.push({ w: whiteTime, b: blackTime });
      prevTimestamp = move.timestamp;
    }
    return snapshots;
  }

  _formatClockTime(seconds) {
    if (seconds == null) return '--:--';
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  _updateTimers() {
    if (!this._game) return;
    const dom = this._dom;

    if (this._ply === -1) {
      const tc = this._parseTimeControl(this._game.timeControl);
      if (tc) {
        dom.timerWhiteEl.textContent = this._formatClockTime(tc.baseSec);
        dom.timerBlackEl.textContent = this._formatClockTime(tc.secondPlayerBaseSec || tc.baseSec);
      } else {
        dom.timerWhiteEl.textContent = '--:--';
        dom.timerBlackEl.textContent = '--:--';
      }
      dom.timerWhiteEl.classList.remove('timer-active', 'timer-low');
      dom.timerBlackEl.classList.remove('timer-active', 'timer-low');
      return;
    }

    const snapshot = this._clockSnapshots[this._ply];
    if (!snapshot) {
      dom.timerWhiteEl.textContent = '--:--';
      dom.timerBlackEl.textContent = '--:--';
      dom.timerWhiteEl.classList.remove('timer-active', 'timer-low');
      dom.timerBlackEl.classList.remove('timer-active', 'timer-low');
      return;
    }

    dom.timerWhiteEl.textContent = this._formatClockTime(snapshot.w);
    dom.timerBlackEl.textContent = this._formatClockTime(snapshot.b);

    const nextPly = this._ply + 1;
    if (nextPly < this._game.moves.length) {
      const nextSide = this._game.moves[nextPly].side;
      dom.timerWhiteEl.classList.toggle('timer-active', nextSide === 'w');
      dom.timerBlackEl.classList.toggle('timer-active', nextSide === 'b');
    } else {
      dom.timerWhiteEl.classList.remove('timer-active');
      dom.timerBlackEl.classList.remove('timer-active');
    }
  }

  // --- Player Bars ---

  _updatePlayerBars(gameRecord) {
    const dom = this._dom;
    const w = gameRecord.white;
    const b = gameRecord.black;

    dom.playerNameWhite.textContent = w.name || 'White';
    dom.playerNameBlack.textContent = b.name || 'Black';
    const wEngInfo = w.engineId ? getEngineInfo(w.engineId) : null;
    const bEngInfo = b.engineId ? getEngineInfo(b.engineId) : null;
    dom.playerIconWhite.textContent = w.isAI ? (wEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
    dom.playerIconBlack.textContent = b.isAI ? (bEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';

    if (w.elo) {
      dom.playerEloWhite.textContent = w.elo;
      dom.playerEloWhite.classList.remove('hidden');
    } else {
      dom.playerEloWhite.classList.add('hidden');
    }

    if (b.elo) {
      dom.playerEloBlack.textContent = b.elo;
      dom.playerEloBlack.classList.remove('hidden');
    } else {
      dom.playerEloBlack.classList.add('hidden');
    }

    dom.capturedByWhiteEl.innerHTML = '';
    dom.capturedByBlackEl.innerHTML = '';
    dom.gameTypeLabel.textContent = gameRecord.gameType === 'chess960' ? 'Chess960' : 'Standard';
  }

  // --- Move List ---

  _buildMoveList(gameRecord) {
    const el = this._dom.replayMoveListEl;
    el.innerHTML = '';

    for (let i = 0; i < gameRecord.moves.length; i++) {
      const move = gameRecord.moves[i];
      const moveNum = Math.floor(i / 2) + 1;
      const isWhite = move.side === 'w';

      if (isWhite) {
        const numEl = document.createElement('span');
        numEl.className = 'strip-move-num';
        numEl.textContent = `${moveNum}.`;
        el.appendChild(numEl);
      }

      const moveEl = document.createElement('span');
      moveEl.className = 'strip-move';
      moveEl.textContent = move.san;
      moveEl.dataset.ply = i;
      moveEl.addEventListener('click', () => {
        this.stopPlayback();
        this.goToMove(parseInt(moveEl.dataset.ply, 10));
      });
      el.appendChild(moveEl);
    }
  }

  _highlightMove() {
    const el = this._dom.replayMoveListEl;
    el.querySelectorAll('.strip-move-active').forEach(node => {
      node.classList.remove('strip-move-active');
    });

    if (this._ply >= 0) {
      const node = el.querySelector(`.strip-move[data-ply="${this._ply}"]`);
      if (node) {
        node.classList.add('strip-move-active');
        node.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }
    } else {
      el.scrollLeft = 0;
    }
  }

  // --- Button State ---

  _updateButtons() {
    if (!this._game) return;
    const dom = this._dom;
    const atStart = this._ply === -1;
    const atEnd = this._ply >= this._game.moves.length - 1;

    dom.replayStartBtn.disabled = atStart;
    dom.replayPrevBtn.disabled = atStart;
    dom.replayNextBtn.disabled = atEnd;
    dom.replayEndBtn.disabled = atEnd;
  }

  // --- Result Formatting ---

  _formatResult(gameRecord) {
    if (!gameRecord.result) return '';
    if (gameRecord.result === 'abandoned') return 'Abandoned';

    const reasons = {
      checkmate: 'Checkmate',
      stalemate: 'Stalemate',
      timeout: 'Time out',
      insufficient: 'Insufficient material',
      threefold: 'Threefold repetition',
      '50-move': 'Fifty-move rule',
      draw: 'Draw',
    };

    const reason = reasons[gameRecord.resultReason] || '';
    if (gameRecord.result === '1/2-1/2') return reason ? `Draw \u2014 ${reason}` : 'Draw';
    const winner = gameRecord.result === '1-0' ? 'White' : 'Black';
    return reason ? `${reason}! ${winner} wins` : `${winner} wins`;
  }

  // --- Keyboard Handler ---

  _keyHandler = (e) => {
    if (!this.isActive) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.next();
        break;
      case ' ':
        e.preventDefault();
        this.togglePlayback();
        break;
      case 'Home':
        e.preventDefault();
        this.goToStart();
        break;
      case 'End':
        e.preventDefault();
        this.goToEnd();
        break;
    }
  };
}
