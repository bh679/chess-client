/**
 * IssueReporter — Flag button and feedback modal for reporting game issues.
 *
 * Shows a small flag icon next to the connection status during multiplayer games.
 * Expands to "Submit Issue" when errors are auto-detected.
 * On click: instantly flags the game via API, then opens a feedback modal
 * with checkboxes (categories) and free-text description.
 */

const ISSUE_API = '/api/chess/issues';

const ISSUE_CATEGORIES = [
  { id: 'audio_video', label: 'Audio / video issue', videoOnly: true },
  { id: 'connection',  label: 'Connection issue',    videoOnly: false },
  { id: 'gameplay',    label: 'Gameplay issue',      videoOnly: false },
  { id: 'missing',     label: 'Something missing',   videoOnly: false },
  { id: 'other',       label: 'Other',               videoOnly: false },
];

export class IssueReporter {
  constructor() {
    this._gameId = null;
    this._sessionId = null;
    this._errorDetected = false;
    this._reportId = null;
    this._videoGame = false;
    this._selectedCategories = [];

    // DOM refs
    this._flagBtn = document.getElementById('ir-flag-btn');
    this._lobbyFlagBtn = document.getElementById('lobby-flag-btn');
    this._pgsFlagBtn = null;
    this._modalEl = null;
    this._stepCategoriesEl = null;
    this._stepDescriptionEl = null;
    this._checkboxGroupEl = null;
    this._textareaEl = null;

    this._buildModal();
    this._bindFlagButton();
    this._bindLobbyButton();
  }

  // --- Public API ---

  /** Set context for the current game. */
  setGameContext(gameId, sessionId, isVideoGame) {
    this._gameId = gameId;
    this._sessionId = sessionId;
    this._videoGame = !!isVideoGame;
    this._errorDetected = false;
    this._reportId = null;
    this._selectedCategories = [];
    this._updateButtonState();
  }

  /** Record that an error was auto-detected. Expands the flag button. */
  recordError() {
    if (this._errorDetected) return;
    this._errorDetected = true;
    this._updateButtonState();
  }

  /** Whether any error has been auto-detected for the current game. */
  isErrorDetected() {
    return this._errorDetected;
  }

  /** Show the in-game flag button. */
  showButton() {
    this._flagBtn.classList.remove('hidden');
    this._updateButtonState();
  }

  /** Hide the in-game flag button. */
  hideButton() {
    this._flagBtn.classList.add('hidden');
  }

  /** Show the lobby flag button. */
  showLobbyButton() {
    if (!this._lobbyFlagBtn) return;
    this._lobbyFlagBtn.classList.remove('hidden');
    this._updateLobbyButtonState();
  }

  /** Hide the lobby flag button. */
  hideLobbyButton() {
    if (!this._lobbyFlagBtn) return;
    this._lobbyFlagBtn.classList.add('hidden');
  }

  /**
   * Create and return a flag button element for the post-game summary.
   * The caller should insert it into the PGS actions area.
   */
  createPostGameFlagButton() {
    const btn = document.createElement('button');
    btn.className = 'pgs-btn pgs-btn-flag';
    btn.title = 'Report an issue';
    btn.textContent = '\u2691';

    if (this._errorDetected) {
      btn.classList.add('ir-expanded');
      btn.textContent = '\u2691 Report';
    }
    if (this._reportId) {
      btn.classList.add('ir-flagged');
      btn.textContent = '\u2713';
    }

    btn.addEventListener('click', () => this._flagGame(btn));
    this._pgsFlagBtn = btn;
    return btn;
  }

  /** Reset all state (on new game start). */
  reset() {
    this._gameId = null;
    this._reportId = null;
    this._errorDetected = false;
    this._videoGame = false;
    this._selectedCategories = [];
    this._closeModal();
    this._updateButtonState();
    this._flagBtn.classList.add('hidden');
    this._pgsFlagBtn = null;
    this.hideLobbyButton();
  }

  // --- Private: Flag button ---

  _bindFlagButton() {
    this._flagBtn.addEventListener('click', () => this._flagGame(this._flagBtn));
  }

  _bindLobbyButton() {
    if (!this._lobbyFlagBtn) return;
    this._lobbyFlagBtn.addEventListener('click', () => this._flagGame(this._lobbyFlagBtn));
  }

  _updateLobbyButtonState() {
    if (!this._lobbyFlagBtn) return;
    if (this._reportId) {
      this._lobbyFlagBtn.classList.remove('ir-expanded');
      this._lobbyFlagBtn.classList.add('ir-flagged');
      this._lobbyFlagBtn.innerHTML = '&#10003;';
      this._lobbyFlagBtn.title = 'Issue reported';
    } else if (this._errorDetected) {
      this._lobbyFlagBtn.classList.add('ir-expanded');
      this._lobbyFlagBtn.classList.remove('ir-flagged');
      this._lobbyFlagBtn.innerHTML = '&#9873; Submit Issue';
      this._lobbyFlagBtn.title = 'An issue was detected — click to report';
    } else {
      this._lobbyFlagBtn.classList.remove('ir-expanded', 'ir-flagged');
      this._lobbyFlagBtn.innerHTML = '&#9873;';
      this._lobbyFlagBtn.title = 'Report an issue';
    }
  }

  _updateButtonState() {
    if (this._reportId) {
      this._flagBtn.classList.remove('ir-expanded');
      this._flagBtn.classList.add('ir-flagged');
      this._flagBtn.innerHTML = '&#10003;';
      this._flagBtn.title = 'Issue reported';
    } else if (this._errorDetected) {
      this._flagBtn.classList.add('ir-expanded');
      this._flagBtn.classList.remove('ir-flagged');
      this._flagBtn.innerHTML = '&#9873; Submit Issue';
      this._flagBtn.title = 'An issue was detected — click to report';
    } else {
      this._flagBtn.classList.remove('ir-expanded', 'ir-flagged');
      this._flagBtn.innerHTML = '&#9873;';
      this._flagBtn.title = 'Report an issue';
    }
    this._updateLobbyButtonState();
  }

  // --- Private: Flag action ---

  async _flagGame(triggerBtn) {
    try {
      const sessionId = this._sessionId || localStorage.getItem('chess-mp-session-id') || 'anonymous';
      const res = await fetch(ISSUE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: this._gameId,
          sessionId,
          autoDetected: this._errorDetected,
          deviceInfo: this._detectDeviceInfo(),
        }),
      });

      if (!res.ok) {
        console.warn('Issue report creation failed:', res.status);
        return;
      }

      const data = await res.json();
      this._reportId = data.id;
      this._updateButtonState();

      // Sync sibling buttons
      if (this._pgsFlagBtn && this._pgsFlagBtn !== triggerBtn) {
        this._pgsFlagBtn.classList.add('ir-flagged');
        this._pgsFlagBtn.textContent = '\u2713';
      }
      if (this._lobbyFlagBtn && this._lobbyFlagBtn !== triggerBtn) {
        this._lobbyFlagBtn.classList.remove('ir-expanded');
        this._lobbyFlagBtn.classList.add('ir-flagged');
        this._lobbyFlagBtn.innerHTML = '&#10003;';
      }

      this._openModal();
    } catch (e) {
      console.warn('Issue report error:', e);
    }
  }

  // --- Private: Feedback modal ---

  _buildModal() {
    this._modalEl = document.createElement('div');
    this._modalEl.className = 'ir-modal hidden';

    const content = document.createElement('div');
    content.className = 'ir-content';

    // Header
    const header = document.createElement('div');
    header.className = 'ir-header';
    header.innerHTML = '<span class="ir-header-icon">&#9873;</span> Report an Issue';
    content.appendChild(header);

    // Step 1: Categories
    this._stepCategoriesEl = document.createElement('div');
    this._stepCategoriesEl.className = 'ir-step';

    const catSubtext = document.createElement('div');
    catSubtext.className = 'ir-subtext';
    catSubtext.textContent = 'What kind of issue did you experience? Select all that apply.';
    this._stepCategoriesEl.appendChild(catSubtext);

    this._checkboxGroupEl = document.createElement('div');
    this._checkboxGroupEl.className = 'ir-checkbox-group';
    this._stepCategoriesEl.appendChild(this._checkboxGroupEl);

    const catActions = document.createElement('div');
    catActions.className = 'ir-actions';

    const skipCatBtn = document.createElement('button');
    skipCatBtn.className = 'ir-btn-skip';
    skipCatBtn.textContent = 'Skip';
    skipCatBtn.addEventListener('click', () => this._submitCategories(true));

    const nextBtn = document.createElement('button');
    nextBtn.className = 'ir-btn ir-btn-primary';
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', () => this._submitCategories(false));

    catActions.appendChild(skipCatBtn);
    catActions.appendChild(nextBtn);
    this._stepCategoriesEl.appendChild(catActions);

    content.appendChild(this._stepCategoriesEl);

    // Step 2: Description
    this._stepDescriptionEl = document.createElement('div');
    this._stepDescriptionEl.className = 'ir-step hidden';

    const descSubtext = document.createElement('div');
    descSubtext.className = 'ir-subtext';
    descSubtext.textContent =
      'Help us understand what went wrong. ' +
      'Any details you share — what you were doing, what you expected to happen, ' +
      'or what seemed off — will help us improve the experience.';
    this._stepDescriptionEl.appendChild(descSubtext);

    this._textareaEl = document.createElement('textarea');
    this._textareaEl.className = 'ir-textarea';
    this._textareaEl.placeholder = 'Describe what happened...';
    this._stepDescriptionEl.appendChild(this._textareaEl);

    const descActions = document.createElement('div');
    descActions.className = 'ir-actions';

    const skipDescBtn = document.createElement('button');
    skipDescBtn.className = 'ir-btn-skip';
    skipDescBtn.textContent = 'Skip';
    skipDescBtn.addEventListener('click', () => this._closeModal());

    const submitBtn = document.createElement('button');
    submitBtn.className = 'ir-btn ir-btn-primary';
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', () => this._submitDescription());

    descActions.appendChild(skipDescBtn);
    descActions.appendChild(submitBtn);
    this._stepDescriptionEl.appendChild(descActions);

    content.appendChild(this._stepDescriptionEl);

    this._modalEl.appendChild(content);
    document.body.appendChild(this._modalEl);

    // Close on backdrop click
    this._modalEl.addEventListener('click', (e) => {
      if (e.target === this._modalEl) this._closeModal();
    });
  }

  _renderCheckboxes() {
    this._checkboxGroupEl.innerHTML = '';
    for (const cat of ISSUE_CATEGORIES) {
      if (cat.videoOnly && !this._videoGame) continue;

      const label = document.createElement('label');
      label.className = 'ir-checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = cat.id;

      const text = document.createTextNode(cat.label);
      label.appendChild(checkbox);
      label.appendChild(text);
      this._checkboxGroupEl.appendChild(label);
    }
  }

  _openModal() {
    this._renderCheckboxes();
    this._stepCategoriesEl.classList.remove('hidden');
    this._stepDescriptionEl.classList.add('hidden');
    this._textareaEl.value = '';
    this._modalEl.classList.remove('hidden');
  }

  _closeModal() {
    this._modalEl.classList.add('hidden');
  }

  async _submitCategories(skipped) {
    if (!skipped) {
      const checkboxes = this._checkboxGroupEl.querySelectorAll('input[type="checkbox"]:checked');
      this._selectedCategories = Array.from(checkboxes).map(cb => cb.value);
    } else {
      this._selectedCategories = [];
    }

    // Send categories to API
    if (this._reportId && this._selectedCategories.length > 0) {
      try {
        await fetch(`${ISSUE_API}/${this._reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: this._selectedCategories }),
        });
      } catch (e) {
        console.warn('Failed to update issue categories:', e);
      }
    }

    // Transition to description step
    this._stepCategoriesEl.classList.add('hidden');
    this._stepDescriptionEl.classList.remove('hidden');
    this._textareaEl.focus();
  }

  async _submitDescription() {
    const description = this._textareaEl.value.trim();

    if (this._reportId && description) {
      try {
        await fetch(`${ISSUE_API}/${this._reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        });
      } catch (e) {
        console.warn('Failed to update issue description:', e);
      }
    }

    this._closeModal();
  }

  // --- Private: Device info (reuses Diagnostics pattern) ---

  _detectDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      browser: this._parseBrowser(ua),
      os: this._parseOS(ua),
      screenWidth: screen.width,
      screenHeight: screen.height,
      userAgent: ua.substring(0, 500),
    };
  }

  _parseBrowser(ua) {
    if (/CriOS/.test(ua)) return 'Chrome iOS';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    if (/Firefox\//.test(ua)) return 'Firefox';
    return 'Unknown';
  }

  _parseOS(ua) {
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
  }
}
