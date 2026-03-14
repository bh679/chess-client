import { Chess } from './chess.js';

/**
 * GameController — owns game-flow logic: starting games, AI moves, game results,
 * and post-game transitions.
 *
 * Extracted from app.js to reduce file size and improve cohesion.
 * The shared setup between startNewGame() and startMultiplayerGame() is
 * consolidated into the private _prepareGame() method.
 */
export class GameController {
  // Public state (read externally)
  gameId = 0;
  moveCount = 0;
  currentDbGameId = null;
  multiplayerActive = false;
  multiplayerGameStartTime = null;
  multiplayerMoveTimes = [];

  // Dependencies (injected via constructor)
  _game = null;
  _board = null;
  _timer = null;
  _ai = null;
  _sound = null;
  _db = null;
  _postGameSummary = null;
  _replayController = null;
  _liveMoveBar = null;
  _analysisController = null;
  _settingsController = null;
  _mpUI = null;
  _mp = null;

  // Callbacks (set after construction to avoid circular deps)
  _callbacks = null;

  /**
   * @param {object} deps
   * @param {object} deps.game               — Game instance
   * @param {object} deps.board              — Board instance
   * @param {object} deps.timer              — Timer instance
   * @param {object} deps.ai                 — AI instance
   * @param {object} deps.sound              — Sound instance
   * @param {object} deps.db                 — GameDatabase instance
   * @param {object} deps.postGameSummary    — PostGameSummary instance
   * @param {object} deps.replayController   — ReplayController instance
   * @param {object} deps.liveMoveBar        — LiveMoveBar instance
   * @param {object} deps.analysisController — AnalysisController instance
   * @param {object} deps.settingsController — SettingsController instance
   * @param {object} deps.mpUI               — MultiplayerUI instance
   * @param {object} deps.mp                 — MultiplayerClient instance
   */
  constructor(deps) {
    this._game = deps.game;
    this._board = deps.board;
    this._timer = deps.timer;
    this._ai = deps.ai;
    this._sound = deps.sound;
    this._db = deps.db;
    this._postGameSummary = deps.postGameSummary;
    this._replayController = deps.replayController;
    this._liveMoveBar = deps.liveMoveBar;
    this._analysisController = deps.analysisController;
    this._settingsController = deps.settingsController;
    this._mpUI = deps.mpUI;
    this._mp = deps.mp;
  }

  /**
   * Set callbacks that connect GameController to app-level concerns.
   * @param {object} cbs
   * @param {function} cbs.updateStatus       — updateStatus(msg, isGameInfo)
   * @param {function} cbs.renderCaptured     — renderCaptured()
   * @param {function} cbs.closeAllPopups     — closeAllPopups()
   * @param {function} cbs.liveEval           — liveEval()
   * @param {function} cbs.getTimeConfig      — getTimeConfig() → {whiteSec, increment, blackSec} | null
   * @param {function} cbs.getTimeControlLabel — getTimeControlLabel() → string
   * @param {function} cbs.getCustomWhiteName — () → string | null
   * @param {function} cbs.getCustomBlackName — () → string | null
   * @param {function} cbs.startPublicLobbyPolling  — startPublicLobbyPolling()
   * @param {function} cbs.stopPublicLobbyPolling   — stopPublicLobbyPolling()
   * @param {object}   cbs.dom                — { boardEl, appEl, newGameBtn, startGameBtn, gameTypeLabel,
   *                                              playerIconWhite, playerIconBlack, playerNameWhite, playerNameBlack,
   *                                              playerEloWhite, playerEloBlack, mainEvalBar }
   * @param {function} cbs.routerSilentUpdate — router.silentUpdate(path)
   * @param {object}   cbs.issueReporter      — IssueReporter instance
   * @param {object}   cbs.videoBoard         — VideoBoard instance
   * @param {object}   cbs.splitCam           — SplitCam instance
   * @param {object}   cbs.splitCamH          — SplitCamH instance
   * @param {function} cbs.getLiveEvalEngine   — () → liveEvalEngine | null
   * @param {function} cbs.getEngineInfo      — getEngineInfo(engineId) → info
   */
  setCallbacks(cbs) {
    this._callbacks = cbs;
  }

  // ─── Shared game preparation (used by both local and multiplayer) ───

  /**
   * Common setup shared between startNewGame() and startMultiplayerGame().
   * Handles: closing overlays, incrementing gameId, clearing premoves,
   * resetting move state, ending abandoned games, and configuring sound.
   */
  _prepareGame() {
    const { dom } = this._callbacks;

    // Close post-game summary if open
    if (this._postGameSummary.isOpen()) {
      this._postGameSummary.close();
    }

    // Exit live review or replay mode if active
    if (this._liveMoveBar.isReviewing) this._liveMoveBar.exit();
    if (this._replayController.isActive) {
      this._replayController.exit(false);
    }

    // End the current game as abandoned if moves were made and game isn't over
    if (this.currentDbGameId && this.moveCount > 0 && !this._game.isGameOver()) {
      this._db.endGame(this.currentDbGameId, 'abandoned', 'abandoned');
    }

    this.gameId++;
    this._ai.stop();
    this._board.clearPremove();
    dom.newGameBtn.classList.remove('game-ended');
    this._liveMoveBar.reset();
    this._board.getArrowOverlay().clear();
    this._sound.start();
    this.moveCount = 0;
  }

  // ─── Local (vs AI / Human) game ───────────────────────────────────

  /**
   * Start a new local game (vs AI or human-vs-human).
   */
  async startNewGame() {
    // Don't override an active multiplayer game
    if (this.multiplayerActive) return;

    const { dom, updateStatus, renderCaptured, closeAllPopups, liveEval,
            getTimeConfig, getTimeControlLabel, getCustomWhiteName,
            getCustomBlackName, startPublicLobbyPolling, routerSilentUpdate,
            issueReporter, getEngineInfo } = this._callbacks;

    // Clear any pre-game lobby state
    dom.boardEl.classList.remove('lobby-active');
    this._mpUI.hideLobbyPanel();

    // Reset issue reporter for new game
    issueReporter.reset();
    // Stop post-game analysis engine if running
    this._analysisController.stopPostGameEngine();

    this._prepareGame();

    this._board.setFlipped(false);
    dom.appEl.classList.remove('board-flipped');
    dom.startGameBtn.classList.add('hidden');

    const chess960 = this._settingsController.isChess960();
    this._game.newGame(chess960);
    this._board.render();

    const aiCfg = this._settingsController.getAIConfig();
    const wIsAI = aiCfg.whiteEnabled;
    const bIsAI = aiCfg.blackEnabled;

    // Show loading status while engines initialise
    if (wIsAI || bIsAI) {
      updateStatus('Loading engine...', true);
    }

    // Configure AI (per-side) — async: loads engine WASM on first use
    await this._ai.configure(aiCfg);
    this._board.setAI(this._ai);
    this._ai.newGame();

    const config = getTimeConfig();
    if (config) {
      this._timer.configure(config.whiteSec, config.increment, config.blackSec);
      // Auto-disable animations for timed games to reduce per-move overhead
      this._settingsController.setAnimationsEnabled(false);
    } else {
      this._timer.configure(0, 0);
      // Restore user's animation preference for untimed games
      this._board.setAnimationsEnabled(this._settingsController.isAnimationsEnabled());
    }

    // Show matchup info in status briefly
    const matchup = this._buildMatchupString(aiCfg, wIsAI, bIsAI);
    updateStatus(matchup, true);

    // Update player type icons and info
    const wInfo = getEngineInfo(aiCfg.whiteEngineId);
    const bInfo = getEngineInfo(aiCfg.blackEngineId);
    dom.playerIconWhite.textContent = wIsAI ? (wInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
    dom.playerIconBlack.textContent = bIsAI ? (bInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
    const wEloVal = aiCfg.whiteElo;
    const bEloVal = aiCfg.blackElo;
    const wName = wIsAI ? this._ai.getEngineName('w') : (getCustomWhiteName() || 'Human');
    const bName = bIsAI ? this._ai.getEngineName('b') : (getCustomBlackName() || 'Human');
    dom.playerNameWhite.textContent = wName;
    dom.playerNameBlack.textContent = bName;
    dom.playerEloWhite.textContent = wIsAI ? wEloVal : '';
    dom.playerEloBlack.textContent = bIsAI ? bEloVal : '';
    dom.playerEloWhite.classList.toggle('hidden', !wIsAI);
    dom.playerEloBlack.classList.toggle('hidden', !bIsAI);

    // Enable pre-game interactive controls
    dom.appEl.classList.add('pre-game');
    closeAllPopups();

    renderCaptured();

    // Save game to local-first database
    this.currentDbGameId = this._db.createGame({
      gameType: chess960 ? 'chess960' : 'standard',
      timeControl: getTimeControlLabel(),
      startingFen: this._game.chess.fen(),
      white: {
        name: wIsAI ? `${this._ai.getEngineName('w')} ${wEloVal}` : wName,
        isAI: wIsAI,
        elo: wIsAI ? wEloVal : null,
        engineId: wIsAI ? aiCfg.whiteEngineId : null,
      },
      black: {
        name: bIsAI ? `${this._ai.getEngineName('b')} ${bEloVal}` : bName,
        isAI: bIsAI,
        elo: bIsAI ? bEloVal : null,
        engineId: bIsAI ? aiCfg.blackEngineId : null,
      },
    });

    // Show eval bar if the toggle is enabled, and run initial evaluation
    if (this._settingsController.isEvalBarEnabled()) {
      dom.mainEvalBar.show();
      dom.mainEvalBar.reset();
      liveEval();
    } else {
      dom.mainEvalBar.hide();
      dom.mainEvalBar.reset();
    }

    // If AI plays White, show start button instead of auto-starting
    if (this._ai.isEnabled() && this._ai.isAITurn('w')) {
      dom.startGameBtn.classList.remove('hidden');
    } else {
      dom.startGameBtn.classList.add('hidden');
    }

    // Update URL to home
    routerSilentUpdate('/');

    // Resume public lobby polling
    startPublicLobbyPolling();
  }

  // ─── Multiplayer game ─────────────────────────────────────────────

  /**
   * Start a multiplayer game (called by multiplayer event handlers).
   */
  startMultiplayerGame(color, fen, timeControl, opponentName, chess960, isCreator) {
    this.multiplayerActive = true;
    this._callbacks.stopPublicLobbyPolling();
    this.multiplayerGameStartTime = Date.now();
    this.multiplayerMoveTimes = [];

    const { dom, updateStatus, renderCaptured, closeAllPopups,
            routerSilentUpdate, videoBoard, splitCam, splitCamH,
            getLiveEvalEngine } = this._callbacks;

    this._prepareGame();

    dom.startGameBtn.classList.add('hidden');

    // Set up the game with the server-provided FEN
    // For chess960, the server already generates the randomized FEN
    this._game.newGame(!!chess960, fen);

    // Flip board if playing black
    this._board.setFlipped(color === 'b');
    dom.appEl.classList.toggle('board-flipped', color === 'b');
    this._board.render();

    // Disable AI
    this._ai.configure({ whiteEnabled: false, blackEnabled: false });
    this._board.setAI(this._ai);

    // Configure timer from multiplayer time control
    this._configureMultiplayerTimer(timeControl, color, isCreator);

    // Player names and icons
    dom.playerIconWhite.textContent = '\uD83C\uDF10';
    dom.playerIconBlack.textContent = '\uD83C\uDF10';
    dom.playerNameWhite.textContent = color === 'w' ? 'You' : opponentName || 'Opponent';
    dom.playerNameBlack.textContent = color === 'b' ? 'You' : opponentName || 'Opponent';
    // Mark opponent name as non-editable
    dom.playerNameWhite.classList.toggle('multiplayer-opponent', color !== 'w');
    dom.playerNameBlack.classList.toggle('multiplayer-opponent', color !== 'b');
    dom.playerEloWhite.classList.add('hidden');
    dom.playerEloBlack.classList.add('hidden');

    // Enable pre-game state
    dom.appEl.classList.add('pre-game');
    closeAllPopups();
    renderCaptured();

    // DB persistence
    this.currentDbGameId = this._db.createGame({
      gameType: chess960 ? 'chess960' : 'standard',
      timeControl: timeControl || 'Online',
      startingFen: this._game.chess.fen(),
      white: {
        name: color === 'w' ? 'You' : (opponentName || 'Opponent'),
        isAI: false,
      },
      black: {
        name: color === 'b' ? 'You' : (opponentName || 'Opponent'),
        isAI: false,
      },
    });

    // Disable eval bar during multiplayer
    this._settingsController.setEvalBarEnabled(false);
    dom.mainEvalBar.hide();
    dom.mainEvalBar.reset();
    const liveEngine = getLiveEvalEngine();
    if (liveEngine) liveEngine.stop();

    // Set board interactivity based on whose turn it is
    const isMyTurn = this._mp.isMyTurn(this._game.getTurn());
    this._board.setInteractive(isMyTurn);

    // Update video feed tint for turn indication
    const tint = this._settingsController.getBoardTint() / 100;
    if (videoBoard.isActive()) {
      videoBoard.updateTurnTint(this._game.getTurn(), this._mp.color, tint);
    }
    if (splitCam.isActive()) {
      splitCam.updateTurnTint(this._game.getTurn(), this._mp.color, tint);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateTurnTint(this._game.getTurn(), this._mp.color, tint);
    }

    // Show multiplayer in-game controls
    this._mpUI.showGameControls();
    this._mpUI.close();

    updateStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
    routerSilentUpdate('/');
  }

  // ─── AI Move ──────────────────────────────────────────────────────

  /**
   * Trigger the AI to make a move (if it's the computer's turn).
   */
  triggerAIMove() {
    if (!this._ai.isEnabled()) return;
    if (this._liveMoveBar.isReviewing) return;
    if (this._game.isGameOver()) return;
    const turn = this._game.getTurn();
    if (!this._ai.isAITurn(turn)) return;
    if (this._ai.isThinking()) return;

    const currentGameId = this.gameId;
    const elo = this._ai.getElo(turn);
    const sideLabel = turn === 'w' ? 'White' : 'Black';

    // Dynamic delay: shorter when clock is ticking to reduce overhead
    let aiDelay = 400;
    if (this._timer.isEnabled()) {
      const minTime = Math.min(this._timer.getTime('w'), this._timer.getTime('b'));
      if (minTime <= 60000) aiDelay = 50;
      else if (minTime <= 300000) aiDelay = 150;
    }

    setTimeout(async () => {
      // Check again after delay in case game state changed
      if (currentGameId !== this.gameId) return;
      if (this._game.isGameOver()) return;

      this._callbacks.updateStatus(`${sideLabel} AI is thinking...`);

      try {
        const fen = this._game.chess.fen();
        const wtime = this._timer.isEnabled() ? this._timer.getTime('w') : 0;
        const btime = this._timer.isEnabled() ? this._timer.getTime('b') : 0;
        const inc = this._timer.isEnabled() ? this._timer.getIncrement() : 0;
        const move = await this._ai.requestMove(fen, elo, wtime, btime, inc);

        // Discard if game changed during thinking
        if (currentGameId !== this.gameId) return;
        if (!move || this._game.isGameOver()) return;

        this._board.executeAIMove(move.from, move.to, move.promotion);
      } catch (e) {
        // Move was cancelled (e.g., new game started)
        if (e !== 'stopped') {
          console.error('AI move error:', e);
        }
      }
    }, aiDelay);
  }

  // ─── Game Result ──────────────────────────────────────────────────

  /**
   * Determine the game result and reason from the current chess state.
   * @returns {{ result: string, reason: string }}
   */
  getGameResult() {
    if (this._game.chess.isCheckmate()) {
      const result = this._game.getTurn() === 'w' ? '0-1' : '1-0';
      return { result, reason: 'checkmate' };
    }
    if (this._game.chess.isStalemate()) {
      return { result: '1/2-1/2', reason: 'stalemate' };
    }
    if (this._game.chess.isInsufficientMaterial()) {
      return { result: '1/2-1/2', reason: 'insufficient' };
    }
    if (this._game.chess.isThreefoldRepetition()) {
      return { result: '1/2-1/2', reason: 'threefold' };
    }
    // 50-move rule or other draw
    return { result: '1/2-1/2', reason: 'draw' };
  }

  // ─── Time Config ──────────────────────────────────────────────────

  /**
   * Read the time control from the DOM select element.
   * @param {HTMLSelectElement} timeControlSelect
   * @returns {{ whiteSec: number, increment: number, blackSec: number } | null}
   */
  getTimeConfig(timeControlSelect) {
    const val = timeControlSelect.value;
    if (val === '0' || val === 'custom') return null;
    const parts = val.split('|').map(Number);
    return {
      whiteSec: parts[0],
      increment: parts[1],
      blackSec: parts[2] !== undefined ? parts[2] : parts[0],
    };
  }

  // ─── Game Record Builders ─────────────────────────────────────────

  /**
   * Build a game record from the current live game state.
   * Converts local database format to the replay-compatible format.
   * @returns {object|null}
   */
  buildCurrentGameRecord() {
    const g = this._db.getLocalGame(this.currentDbGameId);
    if (!g) return null;
    return {
      startingFen: g.metadata.startingFen,
      moves: g.moves,
      white: g.metadata.white,
      black: g.metadata.black,
      result: g.result,
      resultReason: g.resultReason,
      timeControl: g.metadata.timeControl,
      gameType: g.metadata.gameType,
      startTime: g.createdAt,
      serverId: g.serverId,
    };
  }

  /**
   * Build a game record from the current multiplayer game state.
   * Used for post-game summary from in-memory game state.
   * @param {string} result
   * @param {string} reason
   * @returns {object|null}
   */
  buildMultiplayerGameRecord(result, reason) {
    const verboseHistory = this._game.chess.history({ verbose: true });
    if (!verboseHistory || verboseHistory.length === 0) return null;

    const startingFen = verboseHistory[0].before;
    const replay = new Chess(startingFen);
    const moves = [];

    for (let i = 0; i < verboseHistory.length; i++) {
      const moveObj = verboseHistory[i];
      const side = i % 2 === 0 ? 'w' : 'b';
      try {
        replay.move({ from: moveObj.from, to: moveObj.to, promotion: moveObj.promotion });
      } catch (e) {
        console.warn(`buildMultiplayerGameRecord: failed to replay move ${moveObj.san} at ply ${i}:`, e.message);
        break;
      }
      moves.push({
        san: moveObj.san,
        fen: replay.fen(),
        ply: i,
        side,
        timestamp: this.multiplayerMoveTimes[i] || null,
      });
    }

    return {
      startingFen,
      moves,
      result: result || 'unknown',
      resultReason: reason || 'unknown',
      white: { name: this._mp.color === 'w' ? 'You' : 'Opponent', isAI: false },
      black: { name: this._mp.color === 'b' ? 'You' : 'Opponent', isAI: false },
      timeControl: 'Online',
      gameType: 'online',
      startTime: this.multiplayerGameStartTime,
    };
  }

  /**
   * Trigger the post-game summary after a game ends.
   */
  triggerPostGameSummary() {
    const record = this.buildCurrentGameRecord();
    if (!record || !record.moves || record.moves.length === 0) return;

    const { issueReporter } = this._callbacks;

    this._postGameSummary.setCallbacks({
      onReview: (rec) => this._replayController.enter(rec),
      onNewGame: () => this.startNewGame(),
      onClose: () => {},
    });

    this._postGameSummary.addActionButton(issueReporter.createPostGameFlagButton());

    this._postGameSummary.showWithAnalysis(
      record,
      this._analysisController.getPostGameEngine(),
      record.serverId || null,
      {
        onReview: (rec) => this._replayController.enter(rec),
        onNewGame: () => this.startNewGame(),
        onClose: () => {},
      }
    );
  }

  // ─── Lobby Timer ──────────────────────────────────────────────────

  /**
   * Configure timer display for lobby preview without starting it.
   * @param {string} timeControl — e.g. "5+0" or "10/5+3"
   * @param {string} color — 'w' or 'b'
   * @param {boolean} isCreator
   */
  configureLobbyTimer(timeControl, color, isCreator) {
    const tcMatch = timeControl ? timeControl.match(/^(\d+)\+(\d+)$/) : null;
    const tcOddsMatch = timeControl ? timeControl.match(/^(\d+)\/(\d+)\+(\d+)$/) : null;
    if (tcMatch) {
      this._timer.configure(parseInt(tcMatch[1], 10) * 60, parseInt(tcMatch[2], 10));
    } else if (tcOddsMatch) {
      const creatorMin = parseInt(tcOddsMatch[1], 10);
      const opponentMin = parseInt(tcOddsMatch[2], 10);
      const increment = parseInt(tcOddsMatch[3], 10);
      const wMin = (isCreator && color === 'w') || (!isCreator && color === 'b') ? creatorMin : opponentMin;
      const bMin = (isCreator && color === 'b') || (!isCreator && color === 'w') ? creatorMin : opponentMin;
      this._timer.configure(wMin * 60, increment, bMin * 60);
    } else {
      this._timer.configure(0, 0);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /**
   * Build matchup string for status display.
   */
  _buildMatchupString(aiCfg, wIsAI, bIsAI) {
    if (wIsAI && bIsAI) {
      const wEng = this._ai.getEngineName('w');
      const bEng = this._ai.getEngineName('b');
      return `${wEng} (${aiCfg.whiteElo}) vs ${bEng} (${aiCfg.blackElo})`;
    }
    if (wIsAI) {
      return `${this._ai.getEngineName('w')} (${aiCfg.whiteElo}) vs Human`;
    }
    if (bIsAI) {
      return `Human vs ${this._ai.getEngineName('b')} (${aiCfg.blackElo})`;
    }
    return 'Human vs Human';
  }

  /**
   * Configure timer for multiplayer time control string.
   */
  _configureMultiplayerTimer(timeControl, color, isCreator) {
    const tcMatch = timeControl ? timeControl.match(/^(\d+)\+(\d+)$/) : null;
    const tcOddsMatch = timeControl ? timeControl.match(/^(\d+)\/(\d+)\+(\d+)$/) : null;
    if (tcMatch) {
      const minutes = parseInt(tcMatch[1], 10);
      const increment = parseInt(tcMatch[2], 10);
      this._timer.configure(minutes * 60, increment);
      this._timer.setServerAuthoritative(true);
      this._settingsController.setAnimationsEnabled(false);
    } else if (tcOddsMatch) {
      const creatorMin = parseInt(tcOddsMatch[1], 10);
      const opponentMin = parseInt(tcOddsMatch[2], 10);
      const increment = parseInt(tcOddsMatch[3], 10);
      const wMin = (isCreator && color === 'w') || (!isCreator && color === 'b') ? creatorMin : opponentMin;
      const bMin = (isCreator && color === 'b') || (!isCreator && color === 'w') ? creatorMin : opponentMin;
      this._timer.configure(wMin * 60, increment, bMin * 60);
      this._timer.setServerAuthoritative(true);
      this._settingsController.setAnimationsEnabled(false);
    } else {
      this._timer.configure(0, 0);
      this._timer.setServerAuthoritative(false);
    }
  }
}
