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

/**
 * SettingsController — owns all settings-panel DOM, persistence, and server sync.
 *
 * Responsibilities:
 *  - Settings panel open / close
 *  - Toggle state init from localStorage
 *  - Save settings to server (debounced)
 *  - Apply settings received from server on login
 *  - Apply config from the new-game wizard
 *  - Fire onSettingChanged(name, value) so callers can react to changes
 *    without this class needing app-level state (isReplayMode, etc.)
 *
 * Constructor: { auth, board, sound }
 * Exposes:  getCurrentSettings(), getAIConfig(),
 *           isEvalBarEnabled(), isAnimationsEnabled(), isChess960(), isAIEnabled(side),
 *           setEvalBarEnabled(val), setAnimationsEnabled(val), setChess960(val),
 *           toggleAI(side),
 *           openSettings(), closeSettings(),
 *           applyServerSettings(settings), applyWizardConfig(config),
 *           saveSettingsToServer()
 */
export class SettingsController {
  constructor({ auth, board, sound }) {
    this._auth = auth;
    this._board = board;
    this._sound = sound;
    this._saveTimer = null;

    /** Fired whenever a setting changes: (name, value) => void */
    this.onSettingChanged = null;

    // Internal game state (configured by wizard, not settings panel)
    this._chess960 = false;
    this._ai = {
      white: { enabled: false, engineId: '', elo: 1500 },
      black: { enabled: false, engineId: '', elo: 500 },
    };

    this._els = {
      settingsToggle:      document.getElementById('settings-toggle'),
      settingsPanel:       document.getElementById('settings-panel'),
      settingsBackdrop:    document.getElementById('settings-backdrop'),
      evalBarToggle:       document.getElementById('eval-bar-toggle'),
      premovesToggle:      document.getElementById('premoves-toggle'),
      animationsToggle:    document.getElementById('animations-toggle'),
      soundToggle:         document.getElementById('sound-toggle'),
      artStylePicker:      document.getElementById('art-style-picker'),
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
    const { evalBarToggle, premovesToggle, animationsToggle, artStylePicker } = this._els;
    const selectedStyle = artStylePicker.querySelector('.selected')?.dataset.style || 'classic';
    return {
      evalBar:    evalBarToggle.checked,
      premoves:   premovesToggle.checked,
      pieceStyle: selectedStyle,
      animations: animationsToggle.checked,
    };
  }

  /** Returns the AI configuration object for use in startNewGame(). */
  getAIConfig() {
    return {
      whiteEnabled:  this._ai.white.enabled,
      whiteElo:      this._ai.white.elo,
      whiteEngineId: this._ai.white.engineId,
      blackEnabled:  this._ai.black.enabled,
      blackElo:      this._ai.black.elo,
      blackEngineId: this._ai.black.engineId,
    };
  }

  /** Board tint percentage — fixed default (no longer user-adjustable). */
  getBoardTint() {
    return 75;
  }

  isEvalBarEnabled()    { return this._els.evalBarToggle.checked; }
  isAnimationsEnabled() { return this._els.animationsToggle.checked; }
  isChess960()          { return this._chess960; }

  /** Returns whether the AI toggle for the given side ('w' or 'b') is on. */
  isAIEnabled(side) {
    return side === 'w' ? this._ai.white.enabled : this._ai.black.enabled;
  }

  /** Returns the current engine ID for the given side ('w' or 'b'). */
  getEngineId(side) {
    return side === 'w' ? this._ai.white.engineId : this._ai.black.engineId;
  }

  /**
   * Returns ELO config for the given side ('w' or 'b'),
   * or null if the engine has no ELO range (e.g. Random).
   * Shape: { min, max, step, value }
   */
  getEloConfig(side) {
    const ai = side === 'w' ? this._ai.white : this._ai.black;
    const info = getEngineInfo(ai.engineId);
    if (!info) return null;
    const { min, max, step, default: defaultElo } = info.eloRange;
    if (min === max) return null;
    return { min, max, step, value: ai.elo || defaultElo };
  }

  /** Set the engine for the given side and reset ELO to engine default. */
  setEngine(side, engineId) {
    const ai = side === 'w' ? this._ai.white : this._ai.black;
    ai.engineId = engineId;
    const info = getEngineInfo(engineId);
    if (info) ai.elo = info.eloRange.default;
  }

  /** Set the ELO for the given side. */
  setElo(side, elo) {
    const ai = side === 'w' ? this._ai.white : this._ai.black;
    ai.elo = elo;
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

  /** Programmatically set the Chess960 flag. */
  setChess960(val) {
    this._chess960 = val;
  }

  /**
   * Toggle the AI for the given side. Used by player-icon click handlers in app.js.
   */
  toggleAI(side) {
    if (side === 'w') {
      this._ai.white.enabled = !this._ai.white.enabled;
    } else {
      this._ai.black.enabled = !this._ai.black.enabled;
    }
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
    const { evalBarToggle, premovesToggle, artStylePicker } = this._els;

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
  }

  /**
   * Apply configuration from the new-game wizard.
   * Sets chess960 flag, eval bar toggle, and AI state.
   */
  applyWizardConfig(config) {
    const { evalBarToggle } = this._els;

    this._chess960 = config.chess960;
    evalBarToggle.checked = config.evalBar;
    localStorage.setItem('chess-eval-bar', config.evalBar ? 'true' : 'false');

    if (config.mode === 'bot') {
      const userPlaysWhite = config.botSide === 'black';
      this._ai.white.enabled = !userPlaysWhite;
      this._ai.black.enabled = userPlaysWhite;

      const engines = getAllEngines();
      const defaultEngineId = engines[0]?.id || '';

      if (config.botSide === 'black') {
        this._ai.black.engineId = config.engineId || defaultEngineId;
        this._ai.black.elo      = config.elo;
      } else {
        this._ai.white.engineId = config.engineId || defaultEngineId;
        this._ai.white.elo      = config.elo;
      }
    } else {
      // Shared device: both human
      this._ai.white.enabled = false;
      this._ai.black.enabled = false;
    }
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
    this._initDefaultEngines();
  }

  _initDefaultEngines() {
    const engines = getAllEngines();
    if (!engines.length) return;
    const defaultId = engines[0].id;
    if (!this._ai.white.engineId) this._ai.white.engineId = defaultId;
    if (!this._ai.black.engineId) this._ai.black.engineId = defaultId;
    const info = getEngineInfo(defaultId);
    if (info) {
      if (!this._ai.white.elo) this._ai.white.elo = info.eloRange.default;
      if (!this._ai.black.elo) this._ai.black.elo = info.eloRange.default;
    }
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
