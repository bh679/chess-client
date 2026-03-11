/**
 * PostGameSummary — Modal overlay showing game analysis summary.
 *
 * Displays per-player accuracy, move classification breakdown (10 types),
 * and action buttons after a game ends or when reviewing a past game.
 *
 * Usage:
 *   const summary = new PostGameSummary();
 *   summary.show(gameRecord, analysisResult);  // with existing analysis
 *   summary.showWithAnalysis(record, engine, serverId, callbacks);  // runs analysis first
 */

const CLASSIFICATION_ORDER = [
  'brilliant', 'great', 'best', 'excellent', 'good',
  'book', 'inaccuracy', 'mistake', 'miss', 'blunder'
];

const CLASSIFICATION_META = {
  brilliant:  { icon: '!!',  label: 'Brilliant',   cls: 'analysis-brilliant' },
  great:      { icon: '!',   label: 'Great',       cls: 'analysis-great' },
  best:       { icon: '\u2713', label: 'Best',     cls: 'analysis-best' },
  excellent:  { icon: '\u25CF', label: 'Excellent', cls: 'analysis-excellent' },
  good:       { icon: '\u25CF', label: 'Good',     cls: 'analysis-good' },
  book:       { icon: '\u2261', label: 'Book',     cls: 'analysis-book' },
  inaccuracy: { icon: '?!',  label: 'Inaccuracy',  cls: 'analysis-inaccuracy' },
  mistake:    { icon: '?',   label: 'Mistake',     cls: 'analysis-mistake' },
  miss:       { icon: '\u00D7', label: 'Miss',     cls: 'analysis-miss' },
  blunder:    { icon: '??',  label: 'Blunder',     cls: 'analysis-blunder' },
};

class PostGameSummary {
  constructor() {
    this._overlay = null;
    this._contentEl = null;
    this._headerEl = null;
    this._progressEl = null;
    this._progressFillEl = null;
    this._progressTextEl = null;
    this._bodyEl = null;
    this._actionsEl = null;
    this._onReview = null;
    this._onNewGame = null;
    this._onClose = null;
    this._currentRecord = null;
    // Progressive update refs (set by _renderProgressiveBody)
    this._wAccuracyEl = null;
    this._bAccuracyEl = null;
    this._wAccuracyFillEl = null;
    this._bAccuracyFillEl = null;
    this._classCountEls = {};
    this._buildDOM();
  }

  /**
   * Show the summary with pre-computed analysis results.
   */
  show(gameRecord, analysisResult) {
    this._currentRecord = gameRecord;
    this._progressEl.classList.add('hidden');
    this._progressTextEl.classList.add('hidden');
    this._renderResult(gameRecord);
    this._renderBody(gameRecord, analysisResult.summary);
    this._overlay.classList.remove('hidden');
  }

  /**
   * Run analysis then show the summary.
   * @param {Object} gameRecord
   * @param {AnalysisEngine} engine
   * @param {number|null} serverId
   * @param {Object} callbacks — { onReview, onNewGame, onClose }
   */
  async showWithAnalysis(gameRecord, engine, serverId, callbacks) {
    this._currentRecord = gameRecord;
    this._onReview = callbacks.onReview || null;
    this._onNewGame = callbacks.onNewGame || null;
    this._onClose = callbacks.onClose || null;

    // Show modal with progress bar and skeleton body
    this._renderResult(gameRecord);
    this._renderProgressiveBody(gameRecord);
    this._progressEl.classList.remove('hidden');
    this._progressTextEl.classList.remove('hidden');
    this._progressFillEl.style.width = '0%';
    this._overlay.classList.remove('hidden');

    try {
      const result = await engine.analyze(
        gameRecord.moves,
        gameRecord.startingFen,
        {
          depth: 18,
          serverId: serverId,
          onProgress: ({ current, total, summary }) => {
            const pct = total > 0 ? (current / total * 100) : 0;
            this._progressFillEl.style.width = `${pct}%`;
            if (summary) this._updateSummary(summary);
          }
        }
      );
      this._progressEl.classList.add('hidden');
      this._progressTextEl.classList.add('hidden');
      this._renderBody(gameRecord, result.summary);
    } catch (err) {
      if (err !== 'stopped') {
        console.warn('Post-game analysis failed:', err);
      }
      this._progressEl.classList.add('hidden');
      this._progressTextEl.classList.add('hidden');
      this._bodyEl.innerHTML = '<div class="pgs-error">Analysis failed. Try again later.</div>';
    }
  }

  /**
   * Set callbacks after construction (used when wiring up from app.js).
   */
  setCallbacks(callbacks) {
    this._onReview = callbacks.onReview || null;
    this._onNewGame = callbacks.onNewGame || null;
    this._onClose = callbacks.onClose || null;
  }

  /**
   * Insert an action button element at the start of the actions area.
   * Used by IssueReporter to add a flag button to the summary.
   */
  addActionButton(el) {
    if (el && this._actionsEl) {
      this._actionsEl.insertBefore(el, this._actionsEl.firstChild);
    }
  }

  close() {
    this._overlay.classList.add('hidden');
  }

  isOpen() {
    return this._overlay && !this._overlay.classList.contains('hidden');
  }

  _buildDOM() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'pgs-modal hidden';

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'pgs-content';

    // Header
    this._headerEl = document.createElement('div');
    this._headerEl.className = 'pgs-header';
    this._contentEl.appendChild(this._headerEl);

    // Progress bar
    this._progressEl = document.createElement('div');
    this._progressEl.className = 'analysis-progress hidden';
    this._progressFillEl = document.createElement('div');
    this._progressFillEl.className = 'analysis-progress-fill';
    this._progressEl.appendChild(this._progressFillEl);
    this._contentEl.appendChild(this._progressEl);

    // Progress text
    this._progressTextEl = document.createElement('div');
    this._progressTextEl.className = 'pgs-progress-text hidden';
    this._progressTextEl.textContent = 'Analyzing game\u2026';
    this._contentEl.appendChild(this._progressTextEl);

    // Body (accuracy + classifications)
    this._bodyEl = document.createElement('div');
    this._bodyEl.className = 'pgs-body';
    this._contentEl.appendChild(this._bodyEl);

    // Action buttons
    this._actionsEl = document.createElement('div');
    this._actionsEl.className = 'pgs-actions';

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'pgs-btn pgs-btn-review';
    reviewBtn.textContent = 'Game Review';
    reviewBtn.addEventListener('click', () => {
      this.close();
      if (this._onReview) this._onReview(this._currentRecord);
    });

    const newGameBtn = document.createElement('button');
    newGameBtn.className = 'pgs-btn pgs-btn-new';
    newGameBtn.textContent = 'New Game';
    newGameBtn.addEventListener('click', () => {
      this.close();
      if (this._onNewGame) this._onNewGame();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pgs-btn pgs-btn-close';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => {
      this.close();
      if (this._onClose) this._onClose();
    });

    this._actionsEl.appendChild(reviewBtn);
    this._actionsEl.appendChild(newGameBtn);
    this._actionsEl.appendChild(closeBtn);
    this._contentEl.appendChild(this._actionsEl);

    this._overlay.appendChild(this._contentEl);
    document.body.appendChild(this._overlay);

    // Close on backdrop click
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.close();
        if (this._onClose) this._onClose();
      }
    });
  }

  _renderResult(gameRecord) {
    if (!gameRecord.result) {
      this._headerEl.textContent = 'Game Summary';
      return;
    }

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
    let text;
    if (gameRecord.result === '1/2-1/2') {
      text = reason ? `Draw \u2014 ${reason}` : 'Draw';
    } else {
      const winner = gameRecord.result === '1-0' ? 'White' : 'Black';
      text = reason ? `${reason}! ${winner} wins` : `${winner} wins`;
    }

    this._headerEl.textContent = text;
  }

  _computeAvgMoveTime(gameRecord) {
    const moves = gameRecord.moves || [];
    if (moves.length === 0 || !gameRecord.startTime) {
      return { white: null, black: null };
    }

    let whiteTotal = 0;
    let whiteCount = 0;
    let blackTotal = 0;
    let blackCount = 0;
    let prevTimestamp = gameRecord.startTime;

    for (const move of moves) {
      if (!move.timestamp) continue;
      const spent = (move.timestamp - prevTimestamp) / 1000;
      if (move.side === 'w') {
        whiteTotal += spent;
        whiteCount++;
      } else {
        blackTotal += spent;
        blackCount++;
      }
      prevTimestamp = move.timestamp;
    }

    return {
      white: whiteCount > 0 ? whiteTotal / whiteCount : null,
      black: blackCount > 0 ? blackTotal / blackCount : null,
    };
  }

  _formatMoveTime(seconds) {
    if (seconds == null) return '--';
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Render the body skeleton immediately with 0 counts so numbers can
   * populate progressively during analysis. Stores DOM refs for live updates.
   */
  _renderProgressiveBody(gameRecord) {
    this._bodyEl.innerHTML = '';
    this._classCountEls = {};

    // Player accuracy section
    const playersRow = document.createElement('div');
    playersRow.className = 'pgs-players';

    for (const side of ['white', 'black']) {
      const playerInfo = gameRecord[side];

      const col = document.createElement('div');
      col.className = `pgs-player pgs-player-${side}`;

      const nameEl = document.createElement('div');
      nameEl.className = 'pgs-player-name';
      nameEl.textContent = playerInfo ? playerInfo.name : (side === 'white' ? 'White' : 'Black');
      col.appendChild(nameEl);

      const accVal = document.createElement('div');
      accVal.className = 'pgs-accuracy-value pgs-count-loading';
      accVal.textContent = '0%';
      col.appendChild(accVal);

      const barOuter = document.createElement('div');
      barOuter.className = 'pgs-accuracy-bar';
      const barFill = document.createElement('div');
      barFill.className = `pgs-accuracy-fill pgs-accuracy-fill-${side}`;
      barFill.style.width = '0%';
      barOuter.appendChild(barFill);
      col.appendChild(barOuter);

      if (side === 'white') {
        this._wAccuracyEl = accVal;
        this._wAccuracyFillEl = barFill;
      } else {
        this._bAccuracyEl = accVal;
        this._bAccuracyFillEl = barFill;
      }

      playersRow.appendChild(col);
    }

    this._bodyEl.appendChild(playersRow);

    // Average move time section (computed from timestamps, available immediately)
    const avgTimes = this._computeAvgMoveTime(gameRecord);
    if (avgTimes.white != null || avgTimes.black != null) {
      const timingRow = document.createElement('div');
      timingRow.className = 'pgs-timing';

      const wTimeEl = document.createElement('span');
      wTimeEl.className = 'pgs-timing-value pgs-timing-value-white';
      wTimeEl.textContent = this._formatMoveTime(avgTimes.white);

      const labelEl = document.createElement('span');
      labelEl.className = 'pgs-timing-label';
      labelEl.textContent = 'Avg Move Time';

      const bTimeEl = document.createElement('span');
      bTimeEl.className = 'pgs-timing-value pgs-timing-value-black';
      bTimeEl.textContent = this._formatMoveTime(avgTimes.black);

      timingRow.appendChild(wTimeEl);
      timingRow.appendChild(labelEl);
      timingRow.appendChild(bTimeEl);
      this._bodyEl.appendChild(timingRow);
    }

    // Classification breakdown grid — all 10 rows shown during analysis
    const grid = document.createElement('div');
    grid.className = 'pgs-classifications';

    for (const type of CLASSIFICATION_ORDER) {
      const meta = CLASSIFICATION_META[type];

      const row = document.createElement('div');
      row.className = 'pgs-class-row';

      const wCountEl = document.createElement('span');
      wCountEl.className = 'pgs-class-count pgs-class-count-white pgs-count-loading';
      wCountEl.textContent = '0';

      const iconEl = document.createElement('span');
      iconEl.className = `pgs-class-icon ${meta.cls}`;
      iconEl.textContent = meta.icon;

      const labelEl = document.createElement('span');
      labelEl.className = 'pgs-class-label';
      labelEl.textContent = meta.label;

      const bCountEl = document.createElement('span');
      bCountEl.className = 'pgs-class-count pgs-class-count-black pgs-count-loading';
      bCountEl.textContent = '0';

      const centerEl = document.createElement('span');
      centerEl.className = 'pgs-class-center';
      centerEl.appendChild(iconEl);
      centerEl.appendChild(labelEl);

      row.appendChild(wCountEl);
      row.appendChild(centerEl);
      row.appendChild(bCountEl);
      grid.appendChild(row);

      this._classCountEls[`white_${type}`] = wCountEl;
      this._classCountEls[`black_${type}`] = bCountEl;
    }

    this._bodyEl.appendChild(grid);
  }

  /**
   * Update accuracy and classification counts from a partial/running summary.
   * Called on each onProgress tick during analysis.
   */
  _updateSummary(summary) {
    this._flashUpdate(this._wAccuracyEl, `${summary.white.accuracy}%`);
    this._flashUpdate(this._bAccuracyEl, `${summary.black.accuracy}%`);
    if (this._wAccuracyFillEl) this._wAccuracyFillEl.style.width = `${summary.white.accuracy}%`;
    if (this._bAccuracyFillEl) this._bAccuracyFillEl.style.width = `${summary.black.accuracy}%`;

    for (const type of CLASSIFICATION_ORDER) {
      this._flashUpdate(this._classCountEls[`white_${type}`], String(summary.white[type] || 0));
      this._flashUpdate(this._classCountEls[`black_${type}`], String(summary.black[type] || 0));
    }
  }

  /**
   * Update element text and trigger flash animation if value changed.
   */
  _flashUpdate(el, newText) {
    if (!el) return;
    if (el.textContent === newText) return;
    el.textContent = newText;
    el.classList.remove('pgs-count-flash');
    // Force reflow so removing+adding the class restarts the animation
    void el.offsetWidth;
    el.classList.remove('pgs-count-loading');
    el.classList.add('pgs-count-flash');
  }

  _renderBody(gameRecord, summary) {
    this._bodyEl.innerHTML = '';

    // Player accuracy section
    const playersRow = document.createElement('div');
    playersRow.className = 'pgs-players';

    for (const side of ['white', 'black']) {
      const s = summary[side];
      const playerInfo = gameRecord[side];

      const col = document.createElement('div');
      col.className = `pgs-player pgs-player-${side}`;

      const nameEl = document.createElement('div');
      nameEl.className = 'pgs-player-name';
      nameEl.textContent = playerInfo ? playerInfo.name : (side === 'white' ? 'White' : 'Black');
      col.appendChild(nameEl);

      const accVal = document.createElement('div');
      accVal.className = 'pgs-accuracy-value';
      accVal.textContent = `${s.accuracy}%`;
      col.appendChild(accVal);

      const barOuter = document.createElement('div');
      barOuter.className = 'pgs-accuracy-bar';
      const barFill = document.createElement('div');
      barFill.className = `pgs-accuracy-fill pgs-accuracy-fill-${side}`;
      barFill.style.width = `${s.accuracy}%`;
      barOuter.appendChild(barFill);
      col.appendChild(barOuter);

      playersRow.appendChild(col);
    }

    this._bodyEl.appendChild(playersRow);

    // Average move time section
    const avgTimes = this._computeAvgMoveTime(gameRecord);
    if (avgTimes.white != null || avgTimes.black != null) {
      const timingRow = document.createElement('div');
      timingRow.className = 'pgs-timing';

      const wTimeEl = document.createElement('span');
      wTimeEl.className = 'pgs-timing-value pgs-timing-value-white';
      wTimeEl.textContent = this._formatMoveTime(avgTimes.white);

      const labelEl = document.createElement('span');
      labelEl.className = 'pgs-timing-label';
      labelEl.textContent = 'Avg Move Time';

      const bTimeEl = document.createElement('span');
      bTimeEl.className = 'pgs-timing-value pgs-timing-value-black';
      bTimeEl.textContent = this._formatMoveTime(avgTimes.black);

      timingRow.appendChild(wTimeEl);
      timingRow.appendChild(labelEl);
      timingRow.appendChild(bTimeEl);
      this._bodyEl.appendChild(timingRow);
    }

    // Classification breakdown grid
    const grid = document.createElement('div');
    grid.className = 'pgs-classifications';

    for (const type of CLASSIFICATION_ORDER) {
      const meta = CLASSIFICATION_META[type];
      const wCount = summary.white[type] || 0;
      const bCount = summary.black[type] || 0;

      // Skip types with zero count for both sides (except always-shown ones)
      if (wCount === 0 && bCount === 0 && !['best', 'good', 'inaccuracy', 'mistake', 'blunder'].includes(type)) {
        continue;
      }

      const row = document.createElement('div');
      row.className = 'pgs-class-row';

      const wCountEl = document.createElement('span');
      wCountEl.className = 'pgs-class-count pgs-class-count-white';
      wCountEl.textContent = wCount;

      const iconEl = document.createElement('span');
      iconEl.className = `pgs-class-icon ${meta.cls}`;
      iconEl.textContent = meta.icon;

      const labelEl = document.createElement('span');
      labelEl.className = 'pgs-class-label';
      labelEl.textContent = meta.label;

      const bCountEl = document.createElement('span');
      bCountEl.className = 'pgs-class-count pgs-class-count-black';
      bCountEl.textContent = bCount;

      const centerEl = document.createElement('span');
      centerEl.className = 'pgs-class-center';
      centerEl.appendChild(iconEl);
      centerEl.appendChild(labelEl);

      row.appendChild(wCountEl);
      row.appendChild(centerEl);
      row.appendChild(bCountEl);
      grid.appendChild(row);
    }

    this._bodyEl.appendChild(grid);
  }
}

export { PostGameSummary };
