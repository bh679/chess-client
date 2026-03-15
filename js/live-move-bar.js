/**
 * LiveMoveBar — persistent move strip displayed during an active game.
 *
 * Also owns the Live Review mode: browsing past moves while the game
 * continues in the background.
 *
 * Constructor options
 * -------------------
 * board          Board instance
 * game           Game instance
 * ai             AI instance
 * timer          Timer instance
 * boardEl        The board DOM element (for CSS class toggling)
 * statusEl       The status text DOM element
 * liveMoveBarEl  The strip container element
 * liveMoveListEl The scrollable move list element
 * liveStartBtn   "|<" button
 * livePrevBtn    "<" button
 * liveNextBtn    ">" button
 * liveEndBtn     ">|" button
 * getMoveCount   () => number  — live getter, returns current move count
 * getIsReplayMode () => boolean — live getter, returns replay-mode flag
 *
 * Settable callbacks (set after construction)
 * -------------------------------------------
 * onNeedEval   () => void  — called when the eval bar should refresh
 * onExitReview () => void  — called after review state is torn down; app.js
 *                            should call renderCaptured(), updateStatus(), and
 *                            handle multiplayer turn logic here
 */
export class LiveMoveBar {
  constructor({
    board, game, ai, timer,
    boardEl, statusEl,
    liveMoveBarEl, liveMoveListEl,
    liveStartBtn, livePrevBtn, liveNextBtn, liveEndBtn,
    getMoveCount,
    getIsReplayMode,
  }) {
    this._board = board;
    this._game = game;
    this._ai = ai;
    this._timer = timer;
    this._boardEl = boardEl;
    this._statusEl = statusEl;
    this._barEl = liveMoveBarEl;
    this._listEl = liveMoveListEl;
    this._startBtn = liveStartBtn;
    this._prevBtn = livePrevBtn;
    this._nextBtn = liveNextBtn;
    this._endBtn = liveEndBtn;
    this._getMoveCount = getMoveCount;
    this._getIsReplayMode = getIsReplayMode;

    // Review state
    this._isReviewing = false;
    this._ply = -1;
    this._moves = [];            // { san, fen, from, to, side }
    this._startingFen = null;
    this._savedPgn = null;
    this._pendingMoves = [];     // buffered opponent moves received during review

    // Callbacks — set by app.js after construction
    this.onNeedEval = null;
    this.onExitReview = null;

    this._boundKeyHandler = this._keyHandler.bind(this);
    this._wireButtons();
  }

  // ---------------------------------------------------------------------------
  // Public getters — app.js reads these instead of the old bare variables
  // ---------------------------------------------------------------------------

  get isReviewing() { return this._isReviewing; }

  /** All review moves (read-only reference — do not mutate from outside). */
  get reviewMoves() { return this._moves; }

  /** Starting FEN for the review session. */
  get reviewStartingFen() { return this._startingFen; }

  // ---------------------------------------------------------------------------
  // Move bar visibility helpers
  // ---------------------------------------------------------------------------

  activate() {
    if (this._barEl) this._barEl.classList.remove('faded');
  }

  fade() {
    if (this._barEl) this._barEl.classList.add('faded');
  }

  reset() {
    if (this._barEl) this._barEl.classList.add('faded');
    if (this._listEl) this._listEl.innerHTML = '';
    this.updateButtons();
  }

  // ---------------------------------------------------------------------------
  // Move list population
  // ---------------------------------------------------------------------------

  /** Append one move chip to the persistent live move list. */
  appendMove(san, side, plyIndex) {
    if (!this._listEl) return;
    const moveNum = Math.floor(plyIndex / 2) + 1;
    const isWhite = side === 'w';

    if (isWhite) {
      const numEl = document.createElement('span');
      numEl.className = 'strip-move-num';
      numEl.textContent = `${moveNum}.`;
      this._listEl.appendChild(numEl);
    }

    const moveEl = document.createElement('span');
    moveEl.className = 'strip-move';
    moveEl.textContent = san;
    moveEl.dataset.ply = plyIndex;
    moveEl.addEventListener('click', () => {
      const ply = parseInt(moveEl.dataset.ply, 10);
      if (this._isReviewing) {
        this.goToMove(ply);
      } else {
        this.enter(ply);
      }
    });
    this._listEl.appendChild(moveEl);

    // Auto-scroll to show the latest move
    this._listEl.scrollLeft = this._listEl.scrollWidth;
  }

  // ---------------------------------------------------------------------------
  // State helpers for app.js (opponent-move and reconnect handlers)
  // ---------------------------------------------------------------------------

  /**
   * Called by the onOpponentMove handler when a move arrives during review.
   * Buffers it for replay on exit and also adds it to the review history.
   * Returns true if the move was successfully parsed (so app.js can update
   * moveCount and the database).
   */
  bufferOpponentMove(payload) {
    this._pendingMoves.push(payload);

    const { san } = payload;
    const { Chess } = window._ChessClass || {};
    // We need a scratch Chess instance — import it at the top of the caller,
    // or accept a Chess factory.  The caller passes a pre-computed result:
    // this method only stores the move data and updates the UI.
    return true; // caller handles Chess computation and calls pushReviewMove + appendMove
  }

  /**
   * Append a move entry to the review moves array.
   * Used by the reconnect handler and the opponent-move handler (during review).
   */
  pushReviewMove(moveData) {
    this._moves.push(moveData);
  }

  /**
   * Buffer a pending move (received during review) without the full
   * review-move computation.  Use alongside pushReviewMove.
   */
  pushPendingMove(payload) {
    this._pendingMoves.push(payload);
  }

  /**
   * Returns the FEN of the last known review position, or the starting FEN
   * if no moves have been recorded yet.  Used by caller to compute new moves
   * on a scratch chess instance.
   */
  getLastReviewFen() {
    if (this._moves.length > 0) {
      return this._moves[this._moves.length - 1].fen;
    }
    return this._startingFen;
  }

  // ---------------------------------------------------------------------------
  // Button state
  // ---------------------------------------------------------------------------

  updateButtons() {
    if (!this._startBtn) return;
    const moveCount = this._getMoveCount();

    if (this._isReviewing) {
      const atStart = this._ply === -1;
      const atEnd = this._ply >= this._moves.length - 1;
      this._startBtn.disabled = atStart;
      this._prevBtn.disabled = atStart;
      this._nextBtn.disabled = atEnd;
      this._endBtn.disabled = false;
    } else {
      this._startBtn.disabled = moveCount === 0;
      this._prevBtn.disabled = moveCount === 0;
      this._nextBtn.disabled = true;
      this._endBtn.disabled = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Highlight
  // ---------------------------------------------------------------------------

  highlightPly(plyIndex) {
    if (!this._listEl) return;
    this._listEl.querySelectorAll('.strip-move-active').forEach(el => {
      el.classList.remove('strip-move-active');
    });

    if (plyIndex >= 0) {
      const el = this._listEl.querySelector(`.strip-move[data-ply="${plyIndex}"]`);
      if (el) {
        el.classList.add('strip-move-active');
        el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }
    } else {
      this._listEl.scrollLeft = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Live Review — enter / navigate / exit
  // ---------------------------------------------------------------------------

  enter(targetPly) {
    if (this._isReviewing || this._getIsReplayMode()) return;
    const moveCount = this._getMoveCount();
    if (moveCount === 0 || this._game.isGameOver()) return;

    this._isReviewing = true;
    this._pendingMoves = [];

    // Save the starting FEN (position before move 1)
    const history = this._game.chess.history({ verbose: true });
    this._startingFen = history.length > 0 ? history[0].before : this._game.chess.fen();

    // Save full game state for restoration on exit
    this._savedPgn = this._game.chess.pgn();

    // Build move details from chess.js history
    this._moves = history.map(m => ({
      san: m.san,
      fen: m.after,
      from: m.from,
      to: m.to,
      side: m.color,
    }));

    // Stop AI and clear premoves — board position will change
    this._ai.stop();
    this._board.clearPremove();

    // Disable board interaction
    this._board.setInteractive(false);
    this._boardEl.classList.add('live-review-border');

    // Navigate to target ply (default: one before latest)
    const ply = targetPly !== undefined ? targetPly : this._moves.length - 2;
    this._ply = this._moves.length - 1;
    this.goToMove(ply);

    // Register keyboard handler for arrow-key navigation
    document.addEventListener('keydown', this._boundKeyHandler);
  }

  exit() {
    if (!this._isReviewing) return;

    this._isReviewing = false;

    // Remove keyboard handler
    document.removeEventListener('keydown', this._boundKeyHandler);

    // Restore game state from saved PGN
    this._game.chess.loadPgn(this._savedPgn);

    // Apply any buffered opponent moves received during review
    for (const pending of this._pendingMoves) {
      this._game.makeMoveSan(pending.san);
      if (pending.clocks && this._timer.isEnabled()) {
        this._timer.setTime('w', pending.clocks.w);
        this._timer.setTime('b', pending.clocks.b);
      }
    }

    // Clear review state
    this._moves = [];
    this._ply = -1;
    this._startingFen = null;
    this._savedPgn = null;
    const hadPending = this._pendingMoves.length > 0;
    this._pendingMoves = [];

    // Re-enable board
    this._board.setInteractive(true);
    this._boardEl.classList.remove('live-review-border');

    // Update move bar UI
    this.highlightPly(-1);
    this.updateButtons();

    // Clear engine arrows
    this._board.getArrowOverlay().clear();

    // Render restored position
    this._board.render();

    // Notify app.js to handle renderCaptured, updateStatus, mp logic
    if (this.onExitReview) this.onExitReview({ hadPending });
  }

  goToMove(plyIndex) {
    if (!this._isReviewing) return;
    const maxPly = this._moves.length - 1;
    this._ply = Math.max(-1, Math.min(plyIndex, maxPly));

    if (this._ply === -1) {
      this._game.chess.load(this._startingFen);
      this._game._lastMove = null;
    } else {
      const detail = this._moves[this._ply];
      this._game.chess.load(detail.fen);
      this._game._lastMove = { from: detail.from, to: detail.to };
    }

    this._board.render();
    this.highlightPly(this._ply);
    this.updateButtons();

    // Update status text
    if (this._ply === -1) {
      this._statusEl.textContent = 'Reviewing \u2014 Starting Position';
    } else {
      const moveNum = Math.floor(this._ply / 2) + 1;
      const side = this._moves[this._ply].side === 'w' ? '' : '...';
      this._statusEl.textContent = `Reviewing \u2014 ${moveNum}${side} ${this._moves[this._ply].san}`;
    }
    this._statusEl.className = 'status live-review';

    // Refresh eval bar for the reviewed position
    if (this.onNeedEval) this.onNeedEval();

    // Auto-exit when we reach the latest move and there are no pending moves
    if (this._ply === maxPly && this._pendingMoves.length === 0) {
      this.exit();
    }
  }

  next() {
    if (!this._isReviewing) return;
    this.goToMove(this._ply + 1);
  }

  prev() {
    if (!this._isReviewing) return;
    this.goToMove(this._ply - 1);
  }

  goToStart() {
    if (!this._isReviewing) return;
    this.goToMove(-1);
  }

  goToEnd() {
    if (!this._isReviewing) return;
    // "Go to end" means return to the live position
    this.exit();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _keyHandler(e) {
    if (!this._isReviewing) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.next();
        break;
      case 'Escape':
        e.preventDefault();
        this.exit();
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
  }

  _wireButtons() {
    if (this._startBtn) {
      this._startBtn.addEventListener('click', () => {
        if (this._getIsReplayMode()) return; // replay controller handles this
        if (this._isReviewing) {
          this.goToStart();
        } else if (this._getMoveCount() > 0 && !this._game.isGameOver()) {
          this.enter(0);
        }
      });
    }

    if (this._prevBtn) {
      this._prevBtn.addEventListener('click', () => {
        if (this._getIsReplayMode()) return; // replay controller handles this
        if (this._isReviewing) {
          this.prev();
        } else if (this._getMoveCount() > 0 && !this._game.isGameOver()) {
          this.enter();
        }
      });
    }

    if (this._nextBtn) {
      this._nextBtn.addEventListener('click', () => {
        if (this._isReviewing) this.next();
      });
    }

    if (this._endBtn) {
      this._endBtn.addEventListener('click', () => {
        if (this._isReviewing) this.exit();
      });
    }
  }
}
