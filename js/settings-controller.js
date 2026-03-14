import { getAllEngines, getEngineInfo } from './engines/registry.js';

// Art style path mapping (shared with app.js global)
const STYLE_PATHS = {
  classic:  'img/pieces',
  sovereign:'img/pieces-sovereign',
  staunton: 'img/pieces-staunton',
  gothic:   'img/pieces-gothic',
  kawaii:   'img/pieces-kawaii',
  pixel:    'img/pieces-pixel',
  neo:      'img/pieces-neo',
  fish:     'img/pieces-fish',
};

const LS_ENGINE_KEY = 'chess-engine-selection';

/**
 * SettingsController — owns all settings-panel DOM, persistence, and server sync.
 *
 * Responsibilities:
 *  - Settings panel open / close
 *  - Toggle state init from localStorage
 *  - Save / load engine selection
 *  - Populate engine dropdowns from registry
 *  - Save settings to server (debounced)
 *  - Apply settings received from server on login
 *  - Apply config from the new-game wizard
 *  - Fire onSettingChanged(name, value) so callers can react to changes
 *    without this class needing app-level state (isReplayMode, etc.)
 *
 * Constructor: { auth, board, sound }
 * Exposes:  getCurrentSettings(), getAIConfig(), getBoardTint(),
 *           isEvalBarEnabled(), isAnimationsEnabled(), isChess960(), isAIEnabled(side),
 *           setEvalBarEnabled(val), setAnimationsEnabled(val), setChess960(val),
 *           toggleAI(side), getEngineSelect(side),
 *           openSettings(), closeSettings(),
 *           applyServerSettings(settings), applyWizardConfig(config),
 *           updateEloSliderRange(side), saveSettingsToServer()
 */
export class SettingsController {
  constructor({ auth, board, sound }) {
    this._auth = auth;
    this._board = board;
    this._sound = sound;
    this._saveTimer = null;

    /** Fired whenever a setting changes: (name, value) => void */
    this.onSettingChanged = null;

    this._els = {
      settingsToggle:      document.getElementById('settings-toggle'),
      settingsPanel:       document.getElementById('settings-panel'),
      settingsBackdrop:    document.getElementById('settings-backdrop'),
      evalBarToggle:       document.getElementById('eval-bar-toggle'),
      premovesToggle:      document.getElementById('premoves-toggle'),
      animationsToggle:    document.getElementById('animations-toggle'),
      soundToggle:         document.getElementById('sound-toggle'),
      chess960Toggle:      document.getElementById('chess960-toggle'),
      artStylePicker:      document.getElementById('art-style-picker'),
      boardTintSlider:     document.getElementById('board-tint-slider'),
      boardTintValue:      document.getElementById('board-tint-value'),
      aiWhiteToggle:       document.getElementById('ai-white-toggle'),
      aiWhiteEngineSelect: document.getElementById('ai-white-engine'),
      aiWhiteEloSlider:    document.getElementById('ai-white-elo'),
      aiWhiteEloValue:     document.getElementById('ai-white-elo-value'),
      aiWhiteEloWrapper:   document.getElementById('ai-white-elo-wrapper'),
      aiBlackToggle:       document.getElementById('ai-black-toggle'),
      aiBlackEngineSelect: document.getElementById('ai-black-engine'),
      aiBlackEloSlider:    document.getElementById('ai-black-elo'),
      aiBlackEloValue:     document.getElementById('ai-black-elo-value'),
      aiBlackEloWrapper:   document.getElementById('ai-black-elo-wrapper'),
      playerNameWhite:     document.getElementById('player-name-white'),
      playerNameBlack:     document.getElementById('player-name-black'),
      playerIconWhite:     document.getElementById('player-icon-white'),
      playerIconBlack:     document.getElementById('player-icon-black'),
      playerEloWhite:      document.getElementById('player-elo-white'),
      playerEloBlack:      document.getElementById('player-elo-black'),
    };

    this._init();
    this._listenForAuthSettingsSync();
  }

  // ---------------------------------------------------------------------------
  // Public API — read settings
  // ---------------------------------------------------------------------------

  /** Returns the full current settings snapshot for persistence. */
  getCurrentSettings() {
    const { evalBarToggle, premovesToggle, animationsToggle,
            artStylePicker, boardTintSlider, chess960Toggle } = this._els;
    const selectedStyle = artStylePicker.querySelector('.selected')?.dataset.style || 'classic';
    return {
      evalBar:    evalBarToggle.checked,
      premoves:   premovesToggle.checked,
      pieceStyle: selectedStyle,
      animations: animationsToggle.checked,
      chess960:   chess960Toggle.checked,
      boardTint:  parseInt(boardTintSlider.value, 10),
    };
  }

  /** Returns the AI configuration object for use in startNewGame(). */
  getAIConfig() {
    const { aiWhiteToggle, aiWhiteEngineSelect, aiWhiteEloSlider,
            aiBlackToggle, aiBlackEngineSelect, aiBlackEloSlider } = this._els;
    return {
      whiteEnabled:  aiWhiteToggle.checked,
      whiteElo:      parseInt(aiWhiteEloSlider.value, 10),
      whiteEngineId: aiWhiteEngineSelect.value,
      blackEnabled:  aiBlackToggle.checked,
      blackElo:      parseInt(aiBlackEloSlider.value, 10),
      blackEngineId: aiBlackEngineSelect.value,
    };
  }

  /** Current board tint percentage (0–100). */
  getBoardTint() {
    return parseInt(this._els.boardTintSlider.value, 10);
  }

  isEvalBarEnabled()    { return this._els.evalBarToggle.checked; }
  isAnimationsEnabled() { return this._els.animationsToggle.checked; }
  isChess960()          { return this._els.chess960Toggle.checked; }

  /** Returns whether the AI toggle for the given side ('w' or 'b') is on. */
  isAIEnabled(side) {
    return side === 'w'
      ? this._els.aiWhiteToggle.checked
      : this._els.aiBlackToggle.checked;
  }

  /**
   * Returns the engine <select> element for the given side ('w' or 'b').
   * Used by startEngineSwitch() in app.js for inline engine switching.
   */
  getEngineSelect(side) {
    return side === 'w' ? this._els.aiWhiteEngineSelect : this._els.aiBlackEngineSelect;
  }

  /** Returns the ELO slider element for the given side ('w' or 'b'). */
  getEloSlider(side) {
    return side === 'w' ? this._els.aiWhiteEloSlider : this._els.aiBlackEloSlider;
  }

  /** Returns the ELO display value element for the given side ('w' or 'b'). */
  getEloValueEl(side) {
    return side === 'w' ? this._els.aiWhiteEloValue : this._els.aiBlackEloValue;
  }

  /** Returns the eval bar toggle checkbox element (needed by AnalysisController). */
  getEvalBarToggle() {
    return this._els.evalBarToggle;
  }

  // ---------------------------------------------------------------------------
  // Public API — programmatic state changes (no onSettingChanged fired)
  // ---------------------------------------------------------------------------

  /** Programmatically set the eval bar toggle without firing the change listener. */
  setEvalBarEnabled(val) {
    this._els.evalBarToggle.checked = val;
  }

  /** Programmatically set animations toggle + update board. */
  setAnimationsEnabled(val) {
    this._els.animationsToggle.checked = val;
    this._board.setAnimationsEnabled(val);
  }

  /** Programmatically set the Chess960 toggle. */
  setChess960(val) {
    this._els.chess960Toggle.checked = val;
  }

  /**
   * Toggle the AI for the given side and dispatch 'change' to update engine
   * visibility and ELO range. Used by player-icon click handlers in app.js.
   */
  toggleAI(side) {
    const toggle = side === 'w' ? this._els.aiWhiteToggle : this._els.aiBlackToggle;
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
  }

  // ---------------------------------------------------------------------------
  // Public API — settings panel
  // ---------------------------------------------------------------------------

  openSettings() {
    const { settingsPanel, settingsBackdrop, settingsToggle } = this._els;
    settingsPanel.classList.add('open');
    settingsBackdrop.classList.add('visible');
    settingsToggle.classList.add('active');
    settingsToggle.setAttribute('aria-expanded', 'true');
  }

  closeSettings() {
    const { settingsPanel, settingsBackdrop, settingsToggle } = this._els;
    settingsPanel.classList.remove('open');
    settingsBackdrop.classList.remove('visible');
    settingsToggle.classList.remove('active');
    settingsToggle.setAttribute('aria-expanded', 'false');
  }

  // ---------------------------------------------------------------------------
  // Public API — apply settings from external sources
  // ---------------------------------------------------------------------------

  /**
   * Apply settings object received from the server on login.
   * Dispatches 'change' on each toggle so listeners (including onSettingChanged)
   * react correctly.
   */
  applyServerSettings(settings) {
    const { evalBarToggle, premovesToggle, artStylePicker,
            boardTintSlider, boardTintValue } = this._els;

    if (settings.evalBar !== undefined) {
      evalBarToggle.checked = settings.evalBar;
      evalBarToggle.dispatchEvent(new Event('change'));
    }
    if (settings.premoves !== undefined) {
      premovesToggle.checked = settings.premoves;
      premovesToggle.dispatchEvent(new Event('change'));
    }
    if (settings.pieceStyle && STYLE_PATHS[settings.pieceStyle]) {
      window.chessPiecePath = STYLE_PATHS[settings.pieceStyle];
      const btn = artStylePicker.querySelector(`[data-style="${settings.pieceStyle}"]`);
      if (btn) {
        artStylePicker.querySelector('.selected')?.classList.remove('selected');
        btn.classList.add('selected');
      }
      this._board.redraw();
    }
    if (settings.boardTint !== undefined) {
      boardTintSlider.value = settings.boardTint;
      boardTintValue.textContent = settings.boardTint + '%';
    }
  }

  /**
   * Apply configuration from the new-game wizard.
   * Sets all relevant toggles, ELO sliders, and engine selects, then
   * updates visibility of engine/ELO wrappers.
   */
  applyWizardConfig(config) {
    const { chess960Toggle, evalBarToggle,
            aiWhiteToggle, aiBlackToggle,
            aiWhiteEngineSelect, aiBlackEngineSelect,
            aiWhiteEloSlider, aiBlackEloSlider,
            aiWhiteEloValue, aiBlackEloValue,
            aiWhiteEloWrapper, aiBlackEloWrapper } = this._els;

    chess960Toggle.checked = config.chess960;
    evalBarToggle.checked  = config.evalBar;
    localStorage.setItem('chess-eval-bar', config.evalBar ? 'true' : 'false');

    if (config.mode === 'bot') {
      const userPlaysWhite = config.botSide === 'black';
      aiWhiteToggle.checked = !userPlaysWhite;
      aiBlackToggle.checked = userPlaysWhite;

      if (config.botSide === 'black') {
        aiBlackEngineSelect.value   = config.engineId;
        aiBlackEloSlider.value      = config.elo;
        aiBlackEloValue.textContent = config.elo;
      } else {
        aiWhiteEngineSelect.value   = config.engineId;
        aiWhiteEloSlider.value      = config.elo;
        aiWhiteEloValue.textContent = config.elo;
      }

      this.updateEloSliderRange('w');
      this.updateEloSliderRange('b');
    } else {
      // Shared device: both human
      aiWhiteToggle.checked = false;
      aiBlackToggle.checked = false;
    }

    aiWhiteEngineSelect.classList.toggle('hidden', !aiWhiteToggle.checked);
    aiWhiteEloWrapper.classList.toggle('hidden', !aiWhiteToggle.checked);
    aiBlackEngineSelect.classList.toggle('hidden', !aiBlackToggle.checked);
    aiBlackEloWrapper.classList.toggle('hidden', !aiBlackToggle.checked);
  }

  // ---------------------------------------------------------------------------
  // Public API — engine dropdowns
  // ---------------------------------------------------------------------------

  /** Populate both engine dropdowns from the registry. */
  populateEngineDropdowns() {
    const engines = getAllEngines();
    for (const select of [this._els.aiWhiteEngineSelect, this._els.aiBlackEngineSelect]) {
      select.innerHTML = '';
      for (const eng of engines) {
        const opt = document.createElement('option');
        opt.value = eng.id;
        opt.textContent = `${eng.icon} ${eng.name}`;
        select.appendChild(opt);
      }
    }
  }

  saveEngineSelection() {
    localStorage.setItem(LS_ENGINE_KEY, JSON.stringify({
      white: this._els.aiWhiteEngineSelect.value,
      black: this._els.aiBlackEngineSelect.value,
    }));
  }

  loadEngineSelection() {
    try {
      const raw = localStorage.getItem(LS_ENGINE_KEY);
      if (raw) {
        const { white, black } = JSON.parse(raw);
        if (white && getEngineInfo(white)) this._els.aiWhiteEngineSelect.value = white;
        if (black && getEngineInfo(black)) this._els.aiBlackEngineSelect.value = black;
      }
    } catch { /* ignore */ }
  }

  /**
   * Update ELO slider min/max/step based on selected engine.
   * Hides slider entirely for engines with no ELO range (e.g. Random).
   */
  updateEloSliderRange(side) {
    const isWhite = side === 'w';
    const { aiWhiteToggle, aiBlackToggle,
            aiWhiteEngineSelect, aiBlackEngineSelect,
            aiWhiteEloSlider, aiBlackEloSlider,
            aiWhiteEloValue, aiBlackEloValue,
            aiWhiteEloWrapper, aiBlackEloWrapper } = this._els;

    const toggle  = isWhite ? aiWhiteToggle  : aiBlackToggle;
    const select  = isWhite ? aiWhiteEngineSelect : aiBlackEngineSelect;
    const slider  = isWhite ? aiWhiteEloSlider   : aiBlackEloSlider;
    const valueEl = isWhite ? aiWhiteEloValue    : aiBlackEloValue;
    const wrapper = isWhite ? aiWhiteEloWrapper  : aiBlackEloWrapper;

    if (!toggle.checked) {
      wrapper.classList.add('hidden');
      return;
    }

    const info = getEngineInfo(select.value);
    if (!info) return;

    const { min, max, step, default: defaultElo } = info.eloRange;

    if (min === max) {
      slider.min   = min;
      slider.max   = max;
      slider.value = defaultElo;
      valueEl.textContent = defaultElo;
      wrapper.classList.add('hidden');
      return;
    }

    slider.min  = min;
    slider.max  = max;
    slider.step = step;
    const current = parseInt(slider.value, 10);
    if (current < min || current > max) slider.value = defaultElo;
    valueEl.textContent = slider.value;
    wrapper.classList.remove('hidden');
  }

  // ---------------------------------------------------------------------------
  // Public API — server persistence
  // ---------------------------------------------------------------------------

  /** Debounced save of current settings to the server. */
  saveSettingsToServer() {
    if (!this._auth.isLoggedIn) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      const settings = this.getCurrentSettings();
      try {
        await fetch('/api/chess/settings', {
          method: 'PUT',
          headers: this._auth.getAuthHeaders(),
          body: JSON.stringify({ settings }),
        });
      } catch { /* offline — skip */ }
    }, 1000);
  }

  // ---------------------------------------------------------------------------
  // Private — initialisation
  // ---------------------------------------------------------------------------

  _notify(name, value) {
    if (this.onSettingChanged) this.onSettingChanged(name, value);
  }

  _init() {
    this._initPanel();
    this._initToggles();
    this._initArtStylePicker();
    this._initBoardTintSlider();
    this._initAIToggles();
    this._initEngineDropdowns();
  }

  _initPanel() {
    const { settingsToggle, settingsPanel, settingsBackdrop } = this._els;
    settingsToggle.addEventListener('click', () => {
      if (settingsPanel.classList.contains('open')) {
        this.closeSettings();
      } else {
        this.openSettings();
      }
    });
    settingsBackdrop.addEventListener('click', () => this.closeSettings());
  }

  _initToggles() {
    const { evalBarToggle, premovesToggle, animationsToggle, soundToggle } = this._els;

    // Eval bar — init from localStorage; complex show/hide handled via onSettingChanged
    evalBarToggle.checked = localStorage.getItem('chess-eval-bar') === 'true';
    evalBarToggle.addEventListener('change', () => {
      localStorage.setItem('chess-eval-bar', evalBarToggle.checked ? 'true' : 'false');
      this._notify('evalBar', evalBarToggle.checked);
      this.saveSettingsToServer();
    });

    // Premoves
    premovesToggle.checked = localStorage.getItem('chess-premoves') === 'true';
    this._board.setPremovesEnabled(premovesToggle.checked);
    premovesToggle.addEventListener('change', () => {
      localStorage.setItem('chess-premoves', premovesToggle.checked ? 'true' : 'false');
      this._board.setPremovesEnabled(premovesToggle.checked);
      if (!premovesToggle.checked) this._board.clearPremove();
      this._notify('premoves', premovesToggle.checked);
      this.saveSettingsToServer();
    });

    // Animations — no localStorage key; board handles state
    animationsToggle.addEventListener('change', () => {
      this._board.setAnimationsEnabled(animationsToggle.checked);
      this._notify('animations', animationsToggle.checked);
    });

    // Sound
    soundToggle.checked = this._sound.isEnabled();
    soundToggle.addEventListener('change', () => {
      this._sound.setEnabled(soundToggle.checked);
      this._notify('sound', soundToggle.checked);
    });
  }

  _initArtStylePicker() {
    const { artStylePicker } = this._els;
    artStylePicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.art-style-option');
      if (!btn) return;

      const style = btn.dataset.style;
      if (!STYLE_PATHS[style]) return;

      window.chessPiecePath = STYLE_PATHS[style];
      artStylePicker.querySelectorAll('.art-style-option').forEach(el => {
        el.classList.toggle('selected', el === btn);
      });

      this._board.render();
      this._notify('artStyle', style);
      this.saveSettingsToServer();
    });
  }

  _initBoardTintSlider() {
    const { boardTintSlider, boardTintValue } = this._els;
    boardTintSlider.addEventListener('input', () => {
      const val = parseInt(boardTintSlider.value, 10);
      boardTintValue.textContent = val + '%';
      this._notify('boardTint', val);
    });
    boardTintSlider.addEventListener('change', () => {
      this.saveSettingsToServer();
    });
  }

  _initAIToggles() {
    const { aiWhiteToggle, aiWhiteEngineSelect, aiWhiteEloSlider, aiWhiteEloValue,
            aiBlackToggle, aiBlackEngineSelect, aiBlackEloSlider, aiBlackEloValue,
            playerNameWhite, playerNameBlack,
            playerIconWhite, playerIconBlack,
            playerEloWhite, playerEloBlack } = this._els;

    // White AI toggle — show/hide engine select + update ELO range
    aiWhiteToggle.addEventListener('change', () => {
      aiWhiteEngineSelect.classList.toggle('hidden', !aiWhiteToggle.checked);
      this.updateEloSliderRange('w');
    });

    // Black AI toggle
    aiBlackToggle.addEventListener('change', () => {
      aiBlackEngineSelect.classList.toggle('hidden', !aiBlackToggle.checked);
      this.updateEloSliderRange('b');
    });

    // Engine selector changes — update ELO range, persist, update player bar
    aiWhiteEngineSelect.addEventListener('change', () => {
      this.updateEloSliderRange('w');
      this.saveEngineSelection();
      if (aiWhiteToggle.checked) {
        const info = getEngineInfo(aiWhiteEngineSelect.value);
        if (info) {
          playerNameWhite.textContent = info.name;
          playerIconWhite.textContent = info.icon || '\uD83E\uDD16';
          playerEloWhite.textContent  = aiWhiteEloSlider.value;
        }
      }
    });

    aiBlackEngineSelect.addEventListener('change', () => {
      this.updateEloSliderRange('b');
      this.saveEngineSelection();
      if (aiBlackToggle.checked) {
        const info = getEngineInfo(aiBlackEngineSelect.value);
        if (info) {
          playerNameBlack.textContent = info.name;
          playerIconBlack.textContent = info.icon || '\uD83E\uDD16';
          playerEloBlack.textContent  = aiBlackEloSlider.value;
        }
      }
    });

    // ELO slider — live value display only
    aiWhiteEloSlider.addEventListener('input', () => {
      aiWhiteEloValue.textContent = aiWhiteEloSlider.value;
    });
    aiBlackEloSlider.addEventListener('input', () => {
      aiBlackEloValue.textContent = aiBlackEloSlider.value;
    });
  }

  _initEngineDropdowns() {
    this.populateEngineDropdowns();
    this.loadEngineSelection();
    this.updateEloSliderRange('w');
    this.updateEloSliderRange('b');
  }

  /** Register a settings-sync listener on auth so server settings are applied on login. */
  _listenForAuthSettingsSync() {
    this._auth.onAuthChange(async (user) => {
      if (!user) return;
      try {
        const res = await fetch('/api/chess/settings', {
          headers: this._auth.getAuthHeaders(),
        });
        if (res.ok) {
          const { settings } = await res.json();
          if (settings) this.applyServerSettings(settings);
        }
      } catch { /* offline — skip */ }
    });
  }
}
