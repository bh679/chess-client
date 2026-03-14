/**
 * AnalysisController — Coordinates analysis display for main-board replay.
 *
 * Owns the analysis state (engine, data) and all display/coordination
 * functions: classification icons, accuracy rendering, analysis detail
 * panel, engine arrows, critical moment navigation, and eval bar updates.
 *
 * Does NOT own replay navigation or live move bar functions.
 */

import { AnalysisEngine } from './analysis.js';
import { CLASSIFICATION_ICONS, ANALYSIS_CACHE_KEY } from './constants.js';

class AnalysisController {
  /**
   * @param {Object} deps
   * @param {Object} deps.board - Board instance (for arrow overlay)
   * @param {Object} deps.evalBar - EvalBar instance for the main board
   * @param {HTMLElement} deps.evalBarToggle - Checkbox toggle for eval bar
   * @param {HTMLElement} deps.moveListEl - Move list container (strip moves)
   * @param {HTMLElement} deps.progressEl - Analysis progress bar container
   * @param {HTMLElement} deps.progressFillEl - Analysis progress bar fill
   * @param {HTMLElement} deps.accuracyEl - Accuracy summary container
   * @param {HTMLElement} deps.detailEl - Analysis detail panel
   * @param {HTMLElement} deps.classEl - Classification display element
   * @param {HTMLElement} deps.evalEl - Eval display element
   * @param {HTMLElement} deps.bestEl - Best move display element
   * @param {HTMLElement} deps.lineEl - PV line display element
   * @param {HTMLElement} deps.critPrevBtn - Previous critical moment button
   * @param {HTMLElement} deps.critNextBtn - Next critical moment button
   * @param {HTMLElement} deps.summaryBtn - Post-game summary button
   */
  constructor(deps) {
    this._board = deps.board;
    this._evalBar = deps.evalBar;
    this._evalBarToggle = deps.evalBarToggle;
    this._moveListEl = deps.moveListEl;
    this._progressEl = deps.progressEl;
    this._progressFillEl = deps.progressFillEl;
    this._accuracyEl = deps.accuracyEl;
    this._detailEl = deps.detailEl;
    this._classEl = deps.classEl;
    this._evalEl = deps.evalEl;
    this._bestEl = deps.bestEl;
    this._lineEl = deps.lineEl;
    this._critPrevBtn = deps.critPrevBtn;
    this._critNextBtn = deps.critNextBtn;
    this._summaryBtn = deps.summaryBtn;

    // Analysis state
    this._engine = null;
    this._data = null;

    // Dedicated engine for post-game summary (separate lifecycle)
    this._postGameEngine = null;

    // Callbacks set by the consumer for navigation
    this._stopReplayPlayback = null;
    this._replayGoToMove = null;
  }

  /**
   * Set navigation callbacks used by critical moment navigation.
   * @param {Function} stopPlayback - Stops auto-play
   * @param {Function} goToMove - Navigates to a specific ply
   */
  setNavigationCallbacks(stopPlayback, goToMove) {
    this._stopReplayPlayback = stopPlayback;
    this._replayGoToMove = goToMove;
  }

  /** @returns {Object|null} Current analysis data */
  get data() {
    return this._data;
  }

  /** @returns {AnalysisEngine|null} The replay analysis engine */
  get engine() {
    return this._engine;
  }

  /**
   * Get or lazily create the post-game analysis engine.
   * @returns {AnalysisEngine}
   */
  getPostGameEngine() {
    if (!this._postGameEngine) {
      this._postGameEngine = new AnalysisEngine();
    }
    return this._postGameEngine;
  }

  // -------------------------------------------------------------------
  //  Cache
  // -------------------------------------------------------------------

  /**
   * Load cached analysis result from localStorage.
   * @param {number|null} serverId
   * @returns {Object|null}
   */
  loadCachedAnalysis(serverId) {
    if (!serverId) return null;
    try {
      const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const entry = cache.entries[serverId];
      return entry ? entry.result : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------
  //  Run / set analysis
  // -------------------------------------------------------------------

  /**
   * Run analysis on a game record. Manages engine lifecycle and progress.
   * @param {Object} gameRecord
   * @param {Object} [options]
   * @param {boolean} [options.sharedReviewActive] - Whether shared review is active
   * @param {boolean} [options.peerAnalysisRunning] - Whether peer is running analysis
   * @param {Function} [options.onShareResults] - Called with results to share with peer
   * @param {Function} [options.onShareStarted] - Called when analysis starts (for peer notification)
   */
  async runAnalysis(gameRecord, options = {}) {
    if (!gameRecord || !gameRecord.moves || gameRecord.moves.length === 0) return;

    const {
      sharedReviewActive = false,
      peerAnalysisRunning = false,
      onShareResults = null,
      onShareStarted = null,
    } = options;

    // If peer is already running analysis during shared review, skip
    if (sharedReviewActive && peerAnalysisRunning) return;

    // Check cache first
    const serverId = gameRecord.serverId || null;
    const cached = this.loadCachedAnalysis(serverId);
    if (cached) {
      this.setAnalysis(cached);
      if (sharedReviewActive && onShareResults) {
        onShareResults(cached);
      }
      return;
    }

    // Notify peer that we're starting analysis
    if (sharedReviewActive && onShareStarted) {
      onShareStarted();
    }

    // Lazily create engine
    if (!this._engine) {
      this._engine = new AnalysisEngine();
    }

    this._progressEl.classList.remove('hidden');
    this._progressFillEl.style.width = '0%';

    try {
      const result = await this._engine.analyze(
        gameRecord.moves,
        gameRecord.startingFen,
        {
          depth: 18,
          serverId,
          onProgress: ({ current, total }) => {
            const pct = total > 0 ? (current / total * 100) : 0;
            this._progressFillEl.style.width = `${pct}%`;
          }
        }
      );
      this.setAnalysis(result);
      if (sharedReviewActive && onShareResults) {
        onShareResults(result);
      }
    } catch (err) {
      if (err !== 'stopped') {
        console.warn('Analysis failed:', err);
      }
      this._progressEl.classList.add('hidden');
      this._progressFillEl.style.width = '0%';
    }
  }

  /**
   * Set analysis data (from engine result or received from peer).
   * Updates all display elements.
   * @param {Object} result
   */
  setAnalysis(result) {
    this._data = result;

    // Hide progress bar
    this._progressEl.classList.add('hidden');
    this._progressFillEl.style.width = '0%';

    // Add classification icons to move list
    this.addClassificationIcons();

    // Render accuracy summary
    this.renderAccuracy();

    // Update critical moment nav
    this.updateCriticalNav();

    // Show detail and engine arrows for current move
    this.updateAnalysisDetail();
    this.updateEngineArrows();

    // Show and update eval bar (only if toggle is on)
    if (this._evalBarToggle && this._evalBarToggle.checked) {
      this._evalBar.show();
    }
    this.updateEvalBar();

    // Show summary button
    if (this._summaryBtn) this._summaryBtn.classList.remove('hidden');
  }

  // -------------------------------------------------------------------
  //  Display functions
  // -------------------------------------------------------------------

  /**
   * Add classification icons to move list elements.
   * Reads data-ply from .strip-move elements and maps to analysis positions.
   */
  addClassificationIcons() {
    if (!this._data) return;

    const moveEls = this._moveListEl.querySelectorAll('.strip-move[data-ply]');
    const criticalSet = new Set(this._data.criticalMoments);

    moveEls.forEach(el => {
      const ply = parseInt(el.dataset.ply, 10);
      const posIdx = ply + 1;
      if (posIdx >= this._data.positions.length) return;

      const pos = this._data.positions[posIdx];
      if (!pos || !pos.classification) return;

      const iconDef = CLASSIFICATION_ICONS[pos.classification];
      if (!iconDef) return;

      // Remove any existing icon
      const existing = el.querySelector('.analysis-icon');
      if (existing) existing.remove();

      const icon = document.createElement('span');
      icon.className = `analysis-icon ${iconDef.cls}`;
      icon.textContent = iconDef.text;
      el.prepend(icon);

      // Mark critical moments
      if (criticalSet.has(posIdx)) {
        el.classList.add('analysis-critical');
      }
    });
  }

  /**
   * Render accuracy summary (white/black bars with breakdown).
   */
  renderAccuracy() {
    if (!this._data || !this._accuracyEl) return;

    const summary = this._data.summary;
    this._accuracyEl.innerHTML = '';
    this._accuracyEl.classList.remove('hidden');

    for (const side of ['white', 'black']) {
      const s = summary[side];
      const div = document.createElement('div');
      div.className = 'accuracy-side';

      const header = document.createElement('div');
      header.className = 'accuracy-header';

      const label = document.createElement('span');
      label.className = 'accuracy-label';
      label.textContent = side === 'white' ? 'White' : 'Black';
      header.appendChild(label);

      const value = document.createElement('span');
      value.className = 'accuracy-value';
      value.textContent = `${s.accuracy}%`;
      header.appendChild(value);

      div.appendChild(header);

      const barOuter = document.createElement('div');
      barOuter.className = 'accuracy-bar';
      const barFill = document.createElement('div');
      barFill.className = 'accuracy-fill';
      barFill.style.width = `${s.accuracy}%`;
      barOuter.appendChild(barFill);
      div.appendChild(barOuter);

      const breakdown = document.createElement('div');
      breakdown.className = 'accuracy-breakdown';
      const bkParts = [];
      if (s.brilliant) bkParts.push(`!!:${s.brilliant}`);
      if (s.great) bkParts.push(`!:${s.great}`);
      bkParts.push(`B:${s.best || 0}`);
      if (s.excellent) bkParts.push(`E:${s.excellent}`);
      bkParts.push(`G:${s.good || 0}`);
      if (s.book) bkParts.push(`Bk:${s.book}`);
      bkParts.push(`I:${s.inaccuracy || 0}`);
      bkParts.push(`M:${s.mistake || 0}`);
      if (s.miss) bkParts.push(`Ms:${s.miss}`);
      bkParts.push(`BL:${s.blunder || 0}`);
      breakdown.textContent = bkParts.join(' ');
      div.appendChild(breakdown);

      this._accuracyEl.appendChild(div);
    }
  }

  /**
   * Update the analysis detail panel for the current replay ply.
   * Reads replayPly from the consumer via a getter.
   * @param {number} [replayPly] - Current replay ply (defaults to -1)
   */
  updateAnalysisDetail(replayPly = -1) {
    if (!this._data || !this._detailEl) {
      if (this._detailEl) this._detailEl.classList.add('hidden');
      return;
    }

    const posIdx = replayPly + 1;
    if (posIdx < 0 || posIdx >= this._data.positions.length) {
      this._detailEl.classList.add('hidden');
      return;
    }

    const pos = this._data.positions[posIdx];
    this._detailEl.classList.remove('hidden');

    // Classification + cpLoss
    if (pos.classification) {
      const iconDef = CLASSIFICATION_ICONS[pos.classification] || {};
      this._classEl.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = `analysis-icon ${iconDef.cls || ''}`;
      icon.textContent = iconDef.text || '';
      this._classEl.appendChild(icon);
      const labelEl = document.createElement('span');
      const classLabel = pos.classification.charAt(0).toUpperCase() + pos.classification.slice(1);
      labelEl.textContent = ` ${classLabel}${pos.cpLoss > 0 ? ` (${pos.cpLoss}cp)` : ''}`;
      this._classEl.appendChild(labelEl);
    } else {
      this._classEl.textContent = 'Starting position';
    }

    // Eval
    const evalPawns = pos.eval / 100;
    const evalSign = evalPawns >= 0 ? '+' : '';
    const evalDisplay = Math.abs(pos.eval) >= 9900
      ? (pos.eval > 0 ? '+M' : '-M')
      : `${evalSign}${evalPawns.toFixed(2)}`;
    this._evalEl.textContent = `Eval: ${evalDisplay}`;

    // Best move
    if (pos.bestMoveUci) {
      this._bestEl.textContent = `Best: ${pos.bestMoveUci}`;
    } else {
      this._bestEl.textContent = '';
    }

    // PV line (first 5 moves)
    if (pos.bestLineUci && pos.bestLineUci.length > 0) {
      const line = pos.bestLineUci.slice(0, 5).join(' ');
      this._lineEl.textContent = `Line: ${line}`;
    } else {
      this._lineEl.textContent = '';
    }
  }

  /**
   * Update engine arrows on the board for the current ply.
   * @param {number} [replayPly] - Current replay ply (defaults to -1)
   */
  updateEngineArrows(replayPly = -1) {
    const overlay = this._board.getArrowOverlay();
    overlay.clearEngineArrows();

    if (!this._data) return;
    const posIdx = replayPly + 1;
    if (posIdx < 0 || posIdx >= this._data.positions.length) return;

    const pos = this._data.positions[posIdx];
    if (pos.bestMoveUci) {
      overlay.setEngineArrows(pos.bestMoveUci, pos.bestLineUci || []);
    }
  }

  /**
   * Update critical moment navigation button states.
   * @param {number} [replayPly] - Current replay ply (defaults to -1)
   */
  updateCriticalNav(replayPly = -1) {
    if (!this._data || !this._data.criticalMoments.length) {
      if (this._critPrevBtn) this._critPrevBtn.classList.add('hidden');
      if (this._critNextBtn) this._critNextBtn.classList.add('hidden');
      return;
    }

    this._critPrevBtn.classList.remove('hidden');
    this._critNextBtn.classList.remove('hidden');

    const moments = this._data.criticalMoments;
    const curPos = replayPly + 1;

    const prevCrit = moments.filter(m => m < curPos);
    const nextCrit = moments.filter(m => m > curPos);

    this._critPrevBtn.disabled = prevCrit.length === 0;
    this._critNextBtn.disabled = nextCrit.length === 0;
  }

  /**
   * Navigate to the previous critical moment.
   * @param {number} replayPly - Current replay ply
   */
  goToPrevCritical(replayPly) {
    if (!this._data) return;
    const moments = this._data.criticalMoments;
    const curPos = replayPly + 1;
    const prev = moments.filter(m => m < curPos);
    if (prev.length > 0) {
      const targetPos = prev[prev.length - 1];
      if (this._stopReplayPlayback) this._stopReplayPlayback();
      if (this._replayGoToMove) this._replayGoToMove(targetPos - 1);
    }
  }

  /**
   * Navigate to the next critical moment.
   * @param {number} replayPly - Current replay ply
   */
  goToNextCritical(replayPly) {
    if (!this._data) return;
    const moments = this._data.criticalMoments;
    const curPos = replayPly + 1;
    const next = moments.filter(m => m > curPos);
    if (next.length > 0) {
      const targetPos = next[0];
      if (this._stopReplayPlayback) this._stopReplayPlayback();
      if (this._replayGoToMove) this._replayGoToMove(targetPos - 1);
    }
  }

  /**
   * Reset all analysis display state. Hides panels, removes icons.
   */
  reset() {
    this._data = null;

    // Hide progress
    if (this._progressEl) {
      this._progressEl.classList.add('hidden');
      this._progressFillEl.style.width = '0%';
    }
    // Hide detail panel
    if (this._detailEl) {
      this._detailEl.classList.add('hidden');
    }
    // Hide accuracy panel
    if (this._accuracyEl) {
      this._accuracyEl.classList.add('hidden');
      this._accuracyEl.innerHTML = '';
    }
    // Hide critical nav
    if (this._critPrevBtn) this._critPrevBtn.classList.add('hidden');
    if (this._critNextBtn) this._critNextBtn.classList.add('hidden');
    // Hide eval bar
    this._evalBar.hide();
    this._evalBar.reset();
    // Hide summary button
    if (this._summaryBtn) this._summaryBtn.classList.add('hidden');

    // Remove classification icons and critical markers
    this._moveListEl.querySelectorAll('.analysis-icon').forEach(el => el.remove());
    this._moveListEl.querySelectorAll('.analysis-critical').forEach(el => {
      el.classList.remove('analysis-critical');
    });
  }

  /**
   * Update the eval bar for the current replay ply.
   * @param {number} [replayPly] - Current replay ply (defaults to -1)
   */
  updateEvalBar(replayPly = -1) {
    if (!this._data) return;
    const posIdx = replayPly + 1;
    if (posIdx < 0 || posIdx >= this._data.positions.length) return;
    this._evalBar.update(this._data.positions[posIdx].eval);
  }

  /**
   * Stop the replay analysis engine (if running).
   */
  stopEngine() {
    if (this._engine) {
      this._engine.stop();
    }
  }

  /**
   * Stop the post-game analysis engine (if running).
   */
  stopPostGameEngine() {
    if (this._postGameEngine) {
      this._postGameEngine.stop();
    }
  }
}

export { AnalysisController };
