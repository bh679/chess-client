/**
 * Bughouse lobby UI — manages the 4-player waiting room, team assignment,
 * ready states, and settings negotiation.
 */
class BughouseUI {
  constructor(containerEl, multiplayer) {
    this._container = containerEl;
    this._mp = multiplayer;
    this._players = {};
    this._myInfo = null;
    this._roomId = null;
    this._status = 'waiting';
    this._settings = {};
  }

  show() {
    this._container.classList.remove('hidden');
  }

  hide() {
    this._container.classList.add('hidden');
  }

  /**
   * Update the lobby display from a bug_lobby_update payload.
   */
  updateLobby(data) {
    this._roomId = data.roomId;
    this._players = data.players || {};
    this._myInfo = data.you;
    this._status = data.status;
    this._settings = data.settings || {};
    this._render();
  }

  /**
   * Update ready states from a bug_ready_state payload.
   */
  updateReadyState(readyState) {
    for (const [sid, ready] of Object.entries(readyState)) {
      if (this._players[sid]) {
        this._players[sid].ready = ready;
      }
    }
    this._render();
  }

  getRoomId() {
    return this._roomId;
  }

  _render() {
    this._container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'bughouse-lobby';

    // Room code
    if (this._roomId) {
      const codeEl = document.createElement('div');
      codeEl.className = 'bughouse-room-code';
      codeEl.innerHTML = `<span class="label">Room Code:</span> <span class="code">${this._roomId}</span>`;
      wrapper.appendChild(codeEl);
    }

    // Status
    const statusEl = document.createElement('div');
    statusEl.className = 'bughouse-lobby-status';
    const playerCount = Object.keys(this._players).length;
    statusEl.textContent = this._status === 'waiting'
      ? `Waiting for players (${playerCount}/4)...`
      : 'All players joined - Ready up!';
    wrapper.appendChild(statusEl);

    // Teams display
    const teamsEl = document.createElement('div');
    teamsEl.className = 'bughouse-teams';

    const alphaPlayers = Object.values(this._players).filter(p => p.team === 'alpha');
    const betaPlayers = Object.values(this._players).filter(p => p.team === 'beta');

    teamsEl.appendChild(this._renderTeam('Team 1', alphaPlayers, 'alpha'));
    teamsEl.appendChild(this._renderTeam('Team 2', betaPlayers, 'beta'));

    wrapper.appendChild(teamsEl);

    // Settings (time control)
    if (this._status === 'lobby' || this._status === 'waiting') {
      const settingsEl = document.createElement('div');
      settingsEl.className = 'bughouse-settings';

      const tcLabel = document.createElement('label');
      tcLabel.textContent = 'Time Control: ';
      const tcSelect = document.createElement('select');
      tcSelect.className = 'bughouse-tc-select';
      const tcOptions = ['3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'];
      for (const tc of tcOptions) {
        const opt = document.createElement('option');
        opt.value = tc;
        opt.textContent = tc;
        opt.selected = this._settings.timeControl === tc;
        tcSelect.appendChild(opt);
      }
      tcSelect.addEventListener('change', () => {
        this._mp.proposeBughouseSetting('timeControl', tcSelect.value);
      });
      tcLabel.appendChild(tcSelect);
      settingsEl.appendChild(tcLabel);

      wrapper.appendChild(settingsEl);
    }

    // Ready button (only when 4 players in lobby)
    if (this._status === 'lobby') {
      const readyBtn = document.createElement('button');
      readyBtn.className = 'bughouse-ready-btn';
      const mySession = this._findMySession();
      const amReady = mySession && this._players[mySession]?.ready;
      readyBtn.textContent = amReady ? 'Not Ready' : 'Ready';
      readyBtn.classList.toggle('ready-active', amReady);
      readyBtn.addEventListener('click', () => {
        this._mp.setBughouseReady(!amReady);
      });
      wrapper.appendChild(readyBtn);
    }

    this._container.appendChild(wrapper);
    this.show();
  }

  _renderTeam(teamName, players, teamId) {
    const teamEl = document.createElement('div');
    teamEl.className = `bughouse-team bughouse-team-${teamId}`;

    const header = document.createElement('h3');
    header.textContent = teamName;
    teamEl.appendChild(header);

    // Board A and Board B slots
    const boardAPlayers = players.filter(p => p.board === 'a');
    const boardBPlayers = players.filter(p => p.board === 'b');

    const boardASlot = this._renderBoardSlot('Board A', boardAPlayers);
    const boardBSlot = this._renderBoardSlot('Board B', boardBPlayers);

    teamEl.appendChild(boardASlot);
    teamEl.appendChild(boardBSlot);

    return teamEl;
  }

  _renderBoardSlot(boardLabel, players) {
    const slotEl = document.createElement('div');
    slotEl.className = 'bughouse-board-slot';

    const label = document.createElement('span');
    label.className = 'board-label';
    label.textContent = boardLabel;
    slotEl.appendChild(label);

    if (players.length > 0) {
      for (const p of players) {
        const playerEl = document.createElement('div');
        playerEl.className = 'bughouse-player';

        const colorDot = document.createElement('span');
        colorDot.className = `color-dot ${p.color === 'w' ? 'white-dot' : 'black-dot'}`;
        playerEl.appendChild(colorDot);

        const nameEl = document.createElement('span');
        nameEl.className = 'player-name';
        nameEl.textContent = p.name;
        playerEl.appendChild(nameEl);

        if (p.ready) {
          const readyBadge = document.createElement('span');
          readyBadge.className = 'ready-badge';
          readyBadge.textContent = 'Ready';
          playerEl.appendChild(readyBadge);
        }

        slotEl.appendChild(playerEl);
      }
    } else {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'bughouse-player empty';
      emptyEl.textContent = 'Waiting...';
      slotEl.appendChild(emptyEl);
    }

    return slotEl;
  }

  _findMySession() {
    // Find the session ID that matches our team/board/color
    if (!this._myInfo) return null;
    for (const [sid, p] of Object.entries(this._players)) {
      if (p.team === this._myInfo.team && p.board === this._myInfo.board && p.color === this._myInfo.color) {
        return sid;
      }
    }
    return null;
  }
}

export { BughouseUI };
