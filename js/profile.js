/**
 * Profile — user profile page/modal.
 *
 * Shows username, avatar, bio, per-time-control ratings,
 * W/L/D stats, rating history sparkline, and recent games.
 * Accessible via /#/profile?user=<username>
 */

const API_BASE = '/api/chess';
const CATEGORIES = ['bullet', 'blitz', 'rapid', 'classical'];
const CATEGORY_ICONS = { bullet: '\u26A1', blitz: '\u23F1', rapid: '\u23F0', classical: '\u265A' };
const PROVISIONAL_THRESHOLD = 15;
const PAGE_SIZE = 10;

export class Profile {
  constructor(auth, { onGameClick } = {}) {
    this._auth = auth;
    this._onGameClick = onGameClick;
    this._modal = null;
    this._currentUsername = null;
    this._currentUserId = null;
    this._filters = { result: ['win', 'loss', 'draw', 'ongoing'], gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
    this._page = 0;
    this._totalGames = 0;
    this._buildDOM();
  }

  async show(username) {
    if (!username && this._auth.isLoggedIn) {
      username = this._auth.user.username;
    }
    if (!username) return;

    this._currentUsername = username;
    this._filters = { result: ['win', 'loss', 'draw', 'ongoing'], gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
    this._page = 0;
    this._modal.classList.remove('hidden');
    this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-loading">Loading...</div>';

    try {
      const headers = this._auth.isLoggedIn ? this._auth.getAuthHeaders() : {};
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, { headers });
      if (!res.ok) {
        this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-error">Profile not found</div>';
        return;
      }
      const data = await res.json();
      this._currentUserId = data.user.id;
      this._renderProfile(data.user, data.ratings);
    } catch (e) {
      this._modal.querySelector('.profile-body').innerHTML = '<div class="profile-error">Failed to load profile</div>';
    }
  }

  hide() {
    this._modal.classList.add('hidden');
  }

  _buildDOM() {
    this._modal = document.createElement('div');
    this._modal.className = 'profile-modal hidden';
    this._modal.innerHTML = `
      <div class="profile-backdrop"></div>
      <div class="profile-panel">
        <button class="profile-close">\u2715</button>
        <div class="profile-body"></div>
      </div>
    `;
    document.body.appendChild(this._modal);

    this._modal.querySelector('.profile-backdrop').addEventListener('click', () => this.hide());
    this._modal.querySelector('.profile-close').addEventListener('click', () => this.hide());
  }

  _renderProfile(user, ratings) {
    const body = this._modal.querySelector('.profile-body');

    // Header
    let avatarHtml;
    if (user.avatarUrl) {
      avatarHtml = `<img class="profile-avatar-img" src="${user.avatarUrl}" alt="">`;
    } else {
      avatarHtml = `<div class="profile-avatar-placeholder">${(user.username || '?')[0].toUpperCase()}</div>`;
    }

    body.innerHTML = `
      <div class="profile-header">
        ${avatarHtml}
        <div class="profile-info">
          <h2 class="profile-display-name">${this._esc(user.displayName)}</h2>
          <span class="profile-username">@${this._esc(user.username)}</span>
          ${user.bio ? `<p class="profile-bio">${this._esc(user.bio)}</p>` : ''}
        </div>
      </div>
      <div class="profile-ratings"></div>
      <div class="profile-games-section">
        <h3>Games</h3>
        <div class="profile-games-filters"></div>
        <div class="profile-games-list"></div>
        <div class="profile-games-pagination"></div>
      </div>
    `;

    // Render rating cards
    const ratingsContainer = body.querySelector('.profile-ratings');
    for (const cat of CATEGORIES) {
      const r = ratings[cat];
      const card = document.createElement('div');
      card.className = 'profile-rating-card';

      if (r) {
        const provisional = r.gamesPlayed < PROVISIONAL_THRESHOLD;
        const total = r.wins + r.losses + r.draws;
        const winPct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
        card.innerHTML = `
          <div class="rating-card-header">
            <span class="rating-card-icon">${CATEGORY_ICONS[cat]}</span>
            <span class="rating-card-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </div>
          <div class="rating-card-value">${Math.round(r.rating)}${provisional ? '?' : ''}</div>
          <div class="rating-card-rd">RD: ${Math.round(r.rd)}</div>
          <div class="rating-card-stats">
            <span class="rating-win">${r.wins}W</span>
            <span class="rating-loss">${r.losses}L</span>
            <span class="rating-draw">${r.draws}D</span>
            <span class="rating-pct">${winPct}%</span>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="rating-card-header">
            <span class="rating-card-icon">${CATEGORY_ICONS[cat]}</span>
            <span class="rating-card-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </div>
          <div class="rating-card-value rating-unrated">--</div>
          <div class="rating-card-stats">No games</div>
        `;
      }
      ratingsContainer.appendChild(card);
    }

    // Build filter UI
    this._buildFilters(body.querySelector('.profile-games-filters'));

    // Load games
    this._loadGames();
  }

  _resultFilterLabel(selected) {
    const ALL_RESULTS = ['win', 'loss', 'draw', 'abandoned', 'ongoing'];
    if (selected.length === 0) return 'No Results';
    if (selected.length === ALL_RESULTS.length) return 'All Results';
    if (selected.length <= 2) {
      const NAMES = { win: 'Win', loss: 'Loss', draw: 'Draw', abandoned: 'Abandoned', ongoing: 'Ongoing' };
      return selected.map(r => NAMES[r]).join(', ');
    }
    return `${selected.length} of ${ALL_RESULTS.length} Results`;
  }

  _buildFilters(container) {
    const DEFAULT_RESULTS = ['win', 'loss', 'draw', 'ongoing'];
    const ALL_RESULTS = ['win', 'loss', 'draw', 'abandoned', 'ongoing'];
    const RESULT_LABELS = { win: 'Win', loss: 'Loss', draw: 'Draw', abandoned: 'Abandoned', ongoing: 'Ongoing' };

    container.innerHTML = `
      <div class="profile-filters-row">
        <div class="profile-multiselect">
          <button class="profile-multiselect-btn" type="button">${this._resultFilterLabel(this._filters.result)} \u25BE</button>
          <div class="profile-multiselect-dropdown hidden">
            ${ALL_RESULTS.map(r => `
              <label class="profile-multiselect-option">
                <input type="checkbox" value="${r}"${DEFAULT_RESULTS.includes(r) ? ' checked' : ''}>
                ${RESULT_LABELS[r]}
              </label>
            `).join('')}
          </div>
        </div>
        <select class="profile-filter-select" data-filter="playerType">
          <option value="all">All Players</option>
          <option value="hvai">Human vs AI</option>
          <option value="hvh">Human vs Human</option>
          <option value="avai">AI vs AI</option>
        </select>
        <select class="profile-filter-select" data-filter="gameType">
          <option value="all">All Types</option>
          <option value="standard">Standard</option>
          <option value="chess960">Chess960</option>
        </select>
        <select class="profile-filter-select" data-filter="timeControl">
          <option value="all">All Time Controls</option>
          <option value="none">No Clock</option>
          <option value="Bullet 1+0">Bullet 1+0</option>
          <option value="Bullet 2+1">Bullet 2+1</option>
          <option value="Blitz 3+0">Blitz 3+0</option>
          <option value="Blitz 3+2">Blitz 3+2</option>
          <option value="Blitz 5+0">Blitz 5+0</option>
          <option value="Blitz 5+3">Blitz 5+3</option>
          <option value="Rapid 10+0">Rapid 10+0</option>
          <option value="Rapid 10+5">Rapid 10+5</option>
          <option value="Rapid 15+10">Rapid 15+10</option>
          <option value="Classical 30+0">Classical 30+0</option>
          <option value="Classical 30+20">Classical 30+20</option>
        </select>
      </div>
      <div class="profile-filters-row">
        <label class="profile-filter-label">Elo:</label>
        <input type="number" class="profile-filter-elo" data-filter="eloMin" placeholder="Min" min="0" max="4000">
        <span class="profile-filter-dash">\u2013</span>
        <input type="number" class="profile-filter-elo" data-filter="eloMax" placeholder="Max" min="0" max="4000">
        <button class="profile-filter-clear-btn">Clear</button>
      </div>
    `;

    // Multi-select result dropdown
    const multiselect = container.querySelector('.profile-multiselect');
    const btn = multiselect.querySelector('.profile-multiselect-btn');
    const dropdown = multiselect.querySelector('.profile-multiselect-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!multiselect.contains(e.target)) dropdown.classList.add('hidden');
    });

    dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        this._filters.result = [...dropdown.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
        btn.textContent = this._resultFilterLabel(this._filters.result) + ' \u25BE';
        this._page = 0;
        this._loadGames();
      });
    });

    container.querySelectorAll('.profile-filter-select').forEach(sel => {
      sel.addEventListener('change', () => {
        this._filters[sel.dataset.filter] = sel.value;
        this._page = 0;
        this._loadGames();
      });
    });

    container.querySelectorAll('.profile-filter-elo').forEach(input => {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this._filters[input.dataset.filter] = input.value;
          this._page = 0;
          this._loadGames();
        }, 500);
      });
    });

    container.querySelector('.profile-filter-clear-btn').addEventListener('click', () => {
      this._filters = { result: [...DEFAULT_RESULTS], gameType: 'all', playerType: 'all', timeControl: 'all', eloMin: '', eloMax: '' };
      // Reset result checkboxes
      dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = DEFAULT_RESULTS.includes(cb.value);
      });
      btn.textContent = this._resultFilterLabel(this._filters.result) + ' \u25BE';
      container.querySelectorAll('.profile-filter-select').forEach(s => { s.value = 'all'; });
      container.querySelectorAll('.profile-filter-elo').forEach(i => { i.value = ''; });
      this._page = 0;
      this._loadGames();
    });
  }

  async _loadGames() {
    const container = this._modal.querySelector('.profile-games-list');
    const pagination = this._modal.querySelector('.profile-games-pagination');
    if (!container) return;

    container.innerHTML = '<div class="profile-loading">Loading...</div>';

    try {
      const headers = this._auth.isLoggedIn ? this._auth.getAuthHeaders() : {};
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: this._page * PAGE_SIZE,
      });
      const ALL_RESULTS = ['win', 'loss', 'draw', 'abandoned', 'ongoing'];
      const sel = this._filters.result;
      if (sel.length > 0 && sel.length < ALL_RESULTS.length) {
        params.set('result', sel.join(','));
      }
      if (this._filters.gameType !== 'all') params.set('gameType', this._filters.gameType);
      if (this._filters.playerType !== 'all') params.set('playerType', this._filters.playerType);
      if (this._filters.timeControl !== 'all') params.set('timeControl', this._filters.timeControl);
      if (this._filters.eloMin) params.set('eloMin', this._filters.eloMin);
      if (this._filters.eloMax) params.set('eloMax', this._filters.eloMax);

      const res = await fetch(
        `${API_BASE}/users/${encodeURIComponent(this._currentUsername)}/games?${params}`,
        { headers }
      );
      if (!res.ok) {
        container.textContent = 'Could not load games';
        if (pagination) pagination.innerHTML = '';
        return;
      }
      const data = await res.json();
      this._totalGames = data.total || 0;

      if (!data.games || data.games.length === 0) {
        container.textContent = 'No games yet';
        if (pagination) pagination.innerHTML = '';
        return;
      }

      container.innerHTML = '';
      for (const g of data.games) {
        const row = document.createElement('a');
        row.className = 'profile-game-row';
        row.href = `/#/game/${g.id}`;
        const date = new Date(g.startTime).toLocaleDateString();

        // Format result display and determine CSS class
        // DB stores chess notation: '1-0'/'0-1'/'1/2-1/2'/'abandoned'
        let resultText = g.result || 'ongoing';
        let resultClass = '';
        if (g.result === '1-0') {
          const userIsWhite = g.white.userId === this._currentUserId;
          resultText = userIsWhite ? 'Won' : 'Lost';
          resultClass = userIsWhite ? 'pg-result-win' : 'pg-result-loss';
        } else if (g.result === '0-1') {
          const userIsBlack = g.black.userId === this._currentUserId;
          resultText = userIsBlack ? 'Won' : 'Lost';
          resultClass = userIsBlack ? 'pg-result-win' : 'pg-result-loss';
        } else if (g.result === '1/2-1/2') {
          resultText = 'Draw';
          resultClass = 'pg-result-draw';
        } else if (g.result === 'abandoned') {
          resultText = 'Abandoned';
          resultClass = 'pg-result-abandoned';
        } else if (!g.result) {
          resultText = 'Ongoing';
          resultClass = 'pg-result-ongoing';
        }

        row.innerHTML = `
          <span class="pg-players">${this._esc(g.white.name)} vs ${this._esc(g.black.name)}</span>
          <span class="pg-result ${resultClass}">${resultText}</span>
          <span class="pg-type">${g.gameType}</span>
          <span class="pg-date">${date}</span>
        `;

        row.addEventListener('click', (e) => {
          e.preventDefault();
          if (this._onGameClick) {
            this.hide();
            this._onGameClick(g.id);
          }
        });

        container.appendChild(row);
      }

      // Pagination
      const totalPages = Math.ceil(this._totalGames / PAGE_SIZE);
      if (totalPages > 1 && pagination) {
        pagination.innerHTML = `
          <button class="profile-page-btn profile-page-prev" ${this._page === 0 ? 'disabled' : ''}>Previous</button>
          <span class="profile-page-info">Page ${this._page + 1} of ${totalPages}</span>
          <button class="profile-page-btn profile-page-next" ${this._page >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        `;
        pagination.querySelector('.profile-page-prev')?.addEventListener('click', () => {
          if (this._page > 0) { this._page--; this._loadGames(); }
        });
        pagination.querySelector('.profile-page-next')?.addEventListener('click', () => {
          if (this._page < totalPages - 1) { this._page++; this._loadGames(); }
        });
      } else if (pagination) {
        pagination.innerHTML = '';
      }
    } catch (e) {
      container.textContent = 'Failed to load games';
      if (pagination) pagination.innerHTML = '';
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
