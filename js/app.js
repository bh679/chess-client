import { Chess } from './chess.js';
import { Game } from './game.js';
import { Board } from './board.js';
import { Timer } from './timer.js?v=2';
import { AI } from './ai.js?v=3';
import { getAllEngines, getEngineInfo } from './engines/registry.js';
import { GameDatabase } from './database.js?v=6';
import { GameBrowser } from './browser.js?v=4';
import { ReplayViewer } from './replay.js';
import { AnalysisEngine } from './analysis.js';
import { EvalBar } from './eval-bar.js';
import { PostGameSummary } from './post-game-summary.js';
import { Router } from './router.js';
import { Auth } from './auth.js';
import { AuthUI } from './auth-ui.js';
import { Profile } from './profile.js';
import { Friends } from './friends.js';
import { MultiplayerClient } from './multiplayer.js';
import { MultiplayerUI } from './multiplayer-ui.js';
import { NewGameMenu } from './new-game-menu.js';
import { VideoChat } from './video-chat.js';
import { VideoUI } from './video-ui.js';
import { VideoBoard } from './video-board.js';
import { KingCam } from './king-cam.js';
import { SplitCam } from './split-cam.js';
import { Diagnostics } from './diagnostics.js';
import { IssueReporter } from './issue-reporter.js';

const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_DISPLAY = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

// Analysis classification icons (shared with replay.js)
const CLASSIFICATION_ICONS = {
  brilliant:  { text: '!!',    cls: 'analysis-brilliant' },
  great:      { text: '!',     cls: 'analysis-great' },
  best:       { text: '\u2713', cls: 'analysis-best' },
  excellent:  { text: '\u25CF', cls: 'analysis-excellent' },
  good:       { text: '\u25CF', cls: 'analysis-good' },
  book:       { text: '\u2261', cls: 'analysis-book' },
  inaccuracy: { text: '?!',    cls: 'analysis-inaccuracy' },
  mistake:    { text: '?',     cls: 'analysis-mistake' },
  miss:       { text: '\u00D7', cls: 'analysis-miss' },
  blunder:    { text: '??',    cls: 'analysis-blunder' },
};
const ANALYSIS_CACHE_KEY = 'chess-analysis-cache';

// Art style configuration
const STYLE_PATHS = {
  classic: 'img/pieces',
  sovereign: 'img/pieces-sovereign',
  staunton: 'img/pieces-staunton',
  gothic: 'img/pieces-gothic',
  kawaii: 'img/pieces-kawaii',
  pixel: 'img/pieces-pixel',
  neo: 'img/pieces-neo',
  fish: 'img/pieces-fish',
};
window.chessPiecePath = STYLE_PATHS.classic;

const game = new Game();
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const promotionModal = document.getElementById('promotion-modal');
const newGameBtn = document.getElementById('new-game');
const capturedByWhiteEl = document.getElementById('captured-by-white');
const capturedByBlackEl = document.getElementById('captured-by-black');
const timerWhiteEl = document.getElementById('timer-white');
const timerBlackEl = document.getElementById('timer-black');
const timeControlSelect = document.getElementById('time-control');
const customTimeModal = document.getElementById('custom-time-modal');
const customMinutesInput = document.getElementById('custom-minutes');
const customWhiteMinutes = document.getElementById('custom-white-minutes');
const customBlackMinutes = document.getElementById('custom-black-minutes');
const customIncrementInput = document.getElementById('custom-increment');
const customOddsToggle = document.getElementById('custom-odds-toggle');
const sameTimeFields = document.getElementById('same-time-fields');
const oddsTimeFields = document.getElementById('odds-time-fields');
const customTimeOk = document.getElementById('custom-time-ok');
const customTimeCancel = document.getElementById('custom-time-cancel');
const customWhiteLabel = document.getElementById('custom-white-label');
const customBlackLabel = document.getElementById('custom-black-label');
const chess960Toggle = document.getElementById('chess960-toggle');
const animationsToggle = document.getElementById('animations-toggle');
const evalBarToggle = document.getElementById('eval-bar-toggle');
const premovesToggle = document.getElementById('premoves-toggle');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsBackdrop = document.getElementById('settings-backdrop');
const artStylePicker = document.getElementById('art-style-picker');
const boardTintSlider = document.getElementById('board-tint-slider');
const boardTintValue = document.getElementById('board-tint-value');
const aiWhiteToggle = document.getElementById('ai-white-toggle');
const aiWhiteEngineSelect = document.getElementById('ai-white-engine');
const aiWhiteEloSlider = document.getElementById('ai-white-elo');
const aiWhiteEloValue = document.getElementById('ai-white-elo-value');
const aiWhiteEloWrapper = document.getElementById('ai-white-elo-wrapper');
const aiBlackToggle = document.getElementById('ai-black-toggle');
const aiBlackEngineSelect = document.getElementById('ai-black-engine');
const aiBlackEloSlider = document.getElementById('ai-black-elo');
const aiBlackEloValue = document.getElementById('ai-black-elo-value');
const aiBlackEloWrapper = document.getElementById('ai-black-elo-wrapper');
const archiveToggleBtn = document.getElementById('archive-toggle');
const archiveMenu = document.getElementById('archive-menu');
const playerIconWhite = document.getElementById('player-icon-white');
const playerIconBlack = document.getElementById('player-icon-black');
const playerNameWhite = document.getElementById('player-name-white');
const playerNameBlack = document.getElementById('player-name-black');
const playerEloWhite = document.getElementById('player-elo-white');
const playerEloBlack = document.getElementById('player-elo-black');
const gameHistoryBtn = document.getElementById('game-history-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameTypeLabel = document.getElementById('game-type-label');
const appEl = document.querySelector('.app');

// Confirmation modal DOM elements
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

// Replay-on-board DOM elements
const replayControlsEl = document.getElementById('replay-controls');
const replayMoveListEl = document.getElementById('replay-move-list');
const replayStartBtn = document.getElementById('replay-main-start');
const replayPrevBtn = document.getElementById('replay-main-prev');
const replayPlayBtn = document.getElementById('replay-main-play');
const replayNextBtn = document.getElementById('replay-main-next');
const replayEndBtn = document.getElementById('replay-main-end');
const replayResultEl = document.getElementById('replay-main-result');

// Analysis DOM elements for main-board replay
const replayAnalyzeCheckbox = document.getElementById('replay-auto-analyze');
const replayProgressEl = document.getElementById('replay-analysis-progress');
const replayProgressFillEl = document.getElementById('replay-analysis-progress-fill');
const replayAccuracyEl = document.getElementById('replay-analysis-accuracy');
const replayDetailEl = document.getElementById('replay-analysis-detail');
const replayClassEl = document.getElementById('replay-analysis-classification');
const replayEvalEl = document.getElementById('replay-analysis-eval');
const replayBestEl = document.getElementById('replay-analysis-best');
const replayLineEl = document.getElementById('replay-analysis-line');
const replayCritPrevBtn = document.getElementById('replay-crit-prev');
const replayCritNextBtn = document.getElementById('replay-crit-next');
const replaySummaryBtn = document.getElementById('replay-summary-btn');
const replayAnalyzeToggleEl = document.getElementById('replay-analyze-toggle');

// Live move bar elements (persistent during live games)
const liveMoveBarEl = document.getElementById('live-move-bar');
const liveMoveListEl = document.getElementById('live-move-list');
const liveStartBtn = document.getElementById('live-start-btn');
const livePrevBtn = document.getElementById('live-prev-btn');
const liveNextBtn = document.getElementById('live-next-btn');
const liveEndBtn = document.getElementById('live-end-btn');

const board = new Board(boardEl, game, promotionModal);
const timer = new Timer(timerWhiteEl, timerBlackEl);
const ai = new AI();
const auth = new Auth();
const db = new GameDatabase();
db.setAuth(auth);
const replayViewer = new ReplayViewer();
const postGameSummary = new PostGameSummary();
const issueReporter = new IssueReporter();
const gameBrowser = new GameBrowser(db, replayViewer, enterReplayMode);
const profile = new Profile(auth, { onGameClick: (id) => loadGameById(id) });
const friends = new Friends(auth);
const authUI = new AuthUI(auth, {
  onProfileClick: () => profile.show(),
  onFriendsClick: () => friends.show()
});
const router = new Router();

// Auth state change handler — sync settings and offer game claiming on login
auth.onAuthChange(async (user) => {
  if (user) {
    // Sync settings from server on login
    try {
      const res = await fetch('/api/chess/settings', { headers: auth.getAuthHeaders() });
      if (res.ok) {
        const { settings } = await res.json();
        if (settings) {
          // Apply server settings to UI
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
            board.redraw();
          }
          if (settings.boardTint !== undefined) {
            boardTintSlider.value = settings.boardTint;
            boardTintValue.textContent = settings.boardTint + '%';
          }
        }
      }
    } catch (e) { /* offline — skip */ }

    // Offer to claim existing anonymous games
    const allGames = db.getAllGames();
    const claimableIds = [];
    for (const g of Object.values(allGames)) {
      if (g.serverId) claimableIds.push(g.serverId);
    }
    if (claimableIds.length > 0) {
      try {
        const res = await fetch('/api/chess/games/claim-batch', {
          method: 'POST',
          headers: auth.getAuthHeaders(),
          body: JSON.stringify({ gameIds: claimableIds })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.claimed > 0) {
            console.log(`Claimed ${data.claimed} games for account`);
          }
        }
      } catch (e) { /* silent */ }
    }

    // Update player name to display name on current board UI
    const displayName = user.displayName || user.username;
    if (playerNameWhite.textContent === 'Human') {
      playerNameWhite.textContent = displayName;
    }

    // Update local game records so player names sync to server
    for (const g of Object.values(allGames)) {
      if (g.metadata?.white && !g.metadata.white.isAI && g.metadata.white.name === 'Human') {
        db.updatePlayerName(g.localId, 'white', displayName);
      }
      if (g.metadata?.black && !g.metadata.black.isAI && g.metadata.black.name === 'Human') {
        db.updatePlayerName(g.localId, 'black', displayName);
      }
    }
  }
});

// Save settings to server when they change (debounced)
let settingsSaveTimer = null;
function saveSettingsToServer() {
  if (!auth.isLoggedIn) return;
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    const selectedStyle = artStylePicker.querySelector('.selected')?.dataset.style || 'classic';
    const settings = {
      evalBar: evalBarToggle.checked,
      premoves: premovesToggle.checked,
      pieceStyle: selectedStyle,
      animations: animationsToggle.checked,
      chess960: chess960Toggle.checked,
      boardTint: parseInt(boardTintSlider.value, 10)
    };
    try {
      await fetch('/api/chess/settings', {
        method: 'PUT',
        headers: auth.getAuthHeaders(),
        body: JSON.stringify({ settings })
      });
    } catch (e) { /* offline — skip */ }
  }, 1000);
}

// Wire browser close callback to update URL
gameBrowser.setOnClose(() => {
  const { path } = router.current();
  if (path === '/games' || path === '/history' || path === '/live') {
    router.silentUpdate('/');
  }
});

// Multiplayer
const mp = new MultiplayerClient();
const mpUI = new MultiplayerUI(mp);

// Wire multiplayer into game browser for pending rooms / rejoin
gameBrowser.setMultiplayerClient(mp);
gameBrowser.setOnRejoinGame(async (roomId) => {
  try {
    if (!mp.ws || mp.ws.readyState !== WebSocket.OPEN) {
      await mp.connect();
    }
    mp.joinRoom(roomId, null);
  } catch (err) {
    console.warn('Failed to rejoin game:', err);
    alert('Could not rejoin the game. Please try again.');
  }
});

// Diagnostics — collects WebRTC events, errors, and device info for debugging
const diagnostics = new Diagnostics();
diagnostics.setSessionId(mp.sessionId);
diagnostics.start();

// Global error capture
window.addEventListener('error', (event) => {
  diagnostics.jsError(
    event.message,
    event.filename,
    event.lineno,
    event.colno,
    event.error?.stack
  );
  issueReporter.recordError();
});
window.addEventListener('unhandledrejection', (event) => {
  diagnostics.record('error', 'unhandled_rejection', {
    message: String(event.reason),
    stack: event.reason?.stack?.substring(0, 1000) || null,
  });
  issueReporter.recordError();
});

// Video Chat
const videoChat = new VideoChat(mp, diagnostics);
const videoUI = new VideoUI(videoChat);
const videoBoard = new VideoBoard(boardEl);
const kingCam = new KingCam();
const splitCam = new SplitCam(boardEl);
window.kingCam = kingCam;
let videoActive = false;
let activeCamMode = 'none'; // set by onGameStart, read by onVideoStart

// Hide video buttons if browser doesn't support WebRTC
if (!VideoChat.isSupported()) {
  const onlineVideoBtn = document.getElementById('ng-online-video-btn');
  const friendVideoBtn = document.getElementById('ng-friend-video-btn');
  if (onlineVideoBtn) onlineVideoBtn.classList.add('hidden');
  if (friendVideoBtn) friendVideoBtn.classList.add('hidden');
}

// New Game Wizard
const newGameMenu = new NewGameMenu();

let moveCount = 0;
let gameId = 0;
let currentDbGameId = null;
let customWhiteName = null;
let customBlackName = null;

// Replay-on-board state
let isReplayMode = false;
let multiplayerActive = false;
let multiplayerGameStartTime = null;
let multiplayerMoveTimes = [];
let replayGame = null;
let replayPly = -1;
let replayPlaying = false;
let replayTimer = null;
let replayMoveDetails = [];
let replayClockSnapshots = [];

// Live review state (review past moves during an active game)
let isLiveReview = false;
let liveReviewMoves = [];           // { san, fen, from, to, side }
let liveReviewPly = -1;
let liveReviewStartingFen = null;
let liveReviewSavedPgn = null;
let liveReviewPendingMoves = [];    // buffered opponent moves during review

// Analysis state for main-board replay
let replayAnalysisData = null;
let replayAnalysisEngine = null;

// Eval bar for main board (used in both live play and replay)
const mainEvalBar = new EvalBar();
document.getElementById('main-eval-bar').appendChild(mainEvalBar.el);

// Dedicated analysis engine for live position evaluation (separate from replay/game AI)
let liveEvalEngine = null;

// Dedicated analysis engine for post-game summary
let postGameAnalysisEngine = null;

/**
 * Evaluate the current board position and update the eval bar.
 * Uses a dedicated low-depth Stockfish worker that doesn't conflict
 * with the game AI or the replay analysis engine.
 */
async function liveEval() {
  if (isReplayMode || game.isGameOver()) return;

  if (!liveEvalEngine) {
    liveEvalEngine = new AnalysisEngine();
  }

  try {
    const cp = await liveEvalEngine.quickEval(game.chess.fen());
    // cp is null if a full analysis is running on this engine
    if (cp != null && !isReplayMode) {
      mainEvalBar.update(cp);
    }
  } catch {
    // Worker init failed or was cancelled — ignore
  }
}

// Initialise analysis toggle from localStorage
if (replayAnalyzeCheckbox) {
  replayAnalyzeCheckbox.checked = localStorage.getItem('chess-auto-analyze') !== 'false';
}

// Initialise eval bar toggle from localStorage (default: off for live play)
if (evalBarToggle) {
  evalBarToggle.checked = localStorage.getItem('chess-eval-bar') === 'true';
}

function renderCaptured() {
  const captured = game.getCaptured();

  for (const [color, el] of [['w', capturedByWhiteEl], ['b', capturedByBlackEl]]) {
    const pieces = [...captured[color]].sort((a, b) => PIECE_ORDER[a] - PIECE_ORDER[b]);
    el.innerHTML = '';

    for (const p of pieces) {
      const img = document.createElement('img');
      img.className = 'captured-piece';
      // White captured these pieces, so they are black pieces (opponent's color)
      const victimColor = color === 'w' ? 'b' : 'w';
      img.src = `${window.chessPiecePath}/${victimColor}${PIECE_DISPLAY[p]}.svg`;
      img.alt = p;
      el.appendChild(img);
    }

    // Material advantage
    const myTotal = captured[color].reduce((s, p) => s + PIECE_VALUES[p], 0);
    const oppColor = color === 'w' ? 'b' : 'w';
    const oppTotal = captured[oppColor].reduce((s, p) => s + PIECE_VALUES[p], 0);
    const diff = myTotal - oppTotal;
    if (diff > 0) {
      const badge = document.createElement('span');
      badge.className = 'material-advantage';
      badge.textContent = `+${diff}`;
      el.appendChild(badge);
    }
  }
}

let showingGameInfo = false;

function updateStatus(msg, isGameInfo) {
  if (isGameInfo) {
    showingGameInfo = true;
    statusEl.textContent = msg;
    statusEl.className = 'status new-game-info';
    return;
  }
  // Keep showing game info until first move or AI thinking
  if (showingGameInfo && !msg) return;
  showingGameInfo = false;

  statusEl.textContent = msg || game.getGameStatus();
  statusEl.className = 'status';
  if (msg && msg.includes('thinking')) {
    statusEl.classList.add('ai-thinking');
  } else if (game.isGameOver() || msg) {
    statusEl.classList.add('game-over');
  } else if (game.getGameStatus().startsWith('Check')) {
    statusEl.classList.add('in-check');
  }
}

function getTimeConfig() {
  const val = timeControlSelect.value;
  if (val === '0' || val === 'custom') return null;
  const parts = val.split('|').map(Number);
  // Format: whiteSec|increment or whiteSec|increment|blackSec
  return {
    whiteSec: parts[0],
    increment: parts[1],
    blackSec: parts[2] !== undefined ? parts[2] : parts[0],
  };
}

// --- AI Move Trigger ---

function triggerAIMove() {
  if (!ai.isEnabled()) return;
  if (isLiveReview) return;
  if (game.isGameOver()) return;
  const turn = game.getTurn();
  if (!ai.isAITurn(turn)) return;
  if (ai.isThinking()) return;

  const currentGameId = gameId;
  const elo = ai.getElo(turn);
  const sideLabel = turn === 'w' ? 'White' : 'Black';

  // Dynamic delay: shorter when clock is ticking to reduce overhead
  let aiDelay = 400;
  if (timer.isEnabled()) {
    const minTime = Math.min(timer.getTime('w'), timer.getTime('b'));
    if (minTime <= 60000) aiDelay = 50;
    else if (minTime <= 300000) aiDelay = 150;
  }

  setTimeout(async () => {
    // Check again after delay in case game state changed
    if (currentGameId !== gameId) return;
    if (game.isGameOver()) return;

    updateStatus(`${sideLabel} AI is thinking...`);

    try {
      const fen = game.chess.fen();
      const wtime = timer.isEnabled() ? timer.getTime('w') : 0;
      const btime = timer.isEnabled() ? timer.getTime('b') : 0;
      const inc = timer.isEnabled() ? timer.getIncrement() : 0;
      const move = await ai.requestMove(fen, elo, wtime, btime, inc);

      // Discard if game changed during thinking
      if (currentGameId !== gameId) return;
      if (!move || game.isGameOver()) return;

      board.executeAIMove(move.from, move.to, move.promotion);
    } catch (e) {
      // Move was cancelled (e.g., new game started)
      if (e !== 'stopped') {
        console.error('AI move error:', e);
      }
    }
  }, aiDelay);
}

// --- Game Database Helpers ---

function getGameResult() {
  if (game.chess.isCheckmate()) {
    const result = game.getTurn() === 'w' ? '0-1' : '1-0';
    return { result, reason: 'checkmate' };
  }
  if (game.chess.isStalemate()) {
    return { result: '1/2-1/2', reason: 'stalemate' };
  }
  if (game.chess.isInsufficientMaterial()) {
    return { result: '1/2-1/2', reason: 'insufficient' };
  }
  if (game.chess.isThreefoldRepetition()) {
    return { result: '1/2-1/2', reason: 'threefold' };
  }
  // 50-move rule or other draw
  return { result: '1/2-1/2', reason: 'draw' };
}

function getTimeControlLabel() {
  const val = timeControlSelect.value;
  if (val === '0') return 'none';
  const selectedOption = timeControlSelect.selectedOptions[0];
  return selectedOption ? selectedOption.textContent : 'none';
}

/**
 * Build a game record from the current live game state.
 * Converts local database format to the replay-compatible format.
 */
function buildCurrentGameRecord() {
  const g = db.getLocalGame(currentDbGameId);
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
 * Trigger the post-game summary after a game ends.
 */
function triggerPostGameSummary() {
  const record = buildCurrentGameRecord();
  if (!record || !record.moves || record.moves.length === 0) return;

  if (!postGameAnalysisEngine) {
    postGameAnalysisEngine = new AnalysisEngine();
  }

  postGameSummary.setCallbacks({
    onReview: (rec) => enterReplayMode(rec),
    onNewGame: () => startNewGame(),
    onClose: () => {},
  });

  postGameSummary.addActionButton(issueReporter.createPostGameFlagButton());

  postGameSummary.showWithAnalysis(
    record,
    postGameAnalysisEngine,
    record.serverId || null,
    {
      onReview: (rec) => enterReplayMode(rec),
      onNewGame: () => startNewGame(),
      onClose: () => {},
    }
  );
}

/**
 * Build a game record from the current multiplayer game state.
 * Used for post-game summary from in-memory game state.
 */
function buildMultiplayerGameRecord(result, reason) {
  const verboseHistory = game.chess.history({ verbose: true });
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
      timestamp: multiplayerMoveTimes[i] || null,
    });
  }

  return {
    startingFen,
    moves,
    result: result || 'unknown',
    resultReason: reason || 'unknown',
    white: { name: mp.color === 'w' ? 'You' : 'Opponent', isAI: false },
    black: { name: mp.color === 'b' ? 'You' : 'Opponent', isAI: false },
    timeControl: 'Online',
    gameType: 'online',
    startTime: multiplayerGameStartTime,
  };
}

// --- Game Flow ---

async function startNewGame() {
  // Don't override an active multiplayer game
  if (multiplayerActive) return;

  // Close post-game summary if open
  if (postGameSummary.isOpen()) {
    postGameSummary.close();
  }
  // Reset issue reporter for new game
  issueReporter.reset();
  // Stop post-game analysis engine if running
  if (postGameAnalysisEngine) {
    postGameAnalysisEngine.stop();
  }


  // Exit live review or replay mode if active
  if (isLiveReview) exitLiveReview();
  if (isReplayMode) {
    exitReplayMode(false);
  }

  // End the current game as abandoned if moves were made and game isn't over
  if (currentDbGameId && moveCount > 0 && !game.isGameOver()) {
    db.endGame(currentDbGameId, 'abandoned', 'abandoned');
  }

  gameId++;
  ai.stop();
  board.clearPremove();
  board.setFlipped(false);
  appEl.classList.remove('board-flipped');
  newGameBtn.classList.remove('game-ended');
  resetLiveMoveBar();

  const chess960 = chess960Toggle.checked;
  game.newGame(chess960);
  board.getArrowOverlay().clear();
  board.render();
  moveCount = 0;

  const wIsAI = aiWhiteToggle.checked;
  const bIsAI = aiBlackToggle.checked;

  // Show loading status while engines initialise
  if (wIsAI || bIsAI) {
    updateStatus('Loading engine...', true);
  }

  // Configure AI (per-side) — async: loads engine WASM on first use
  await ai.configure({
    whiteEnabled: wIsAI,
    whiteElo: parseInt(aiWhiteEloSlider.value, 10),
    whiteEngineId: aiWhiteEngineSelect.value,
    blackEnabled: bIsAI,
    blackElo: parseInt(aiBlackEloSlider.value, 10),
    blackEngineId: aiBlackEngineSelect.value,
  });
  board.setAI(ai);
  ai.newGame();

  const config = getTimeConfig();
  if (config) {
    timer.configure(config.whiteSec, config.increment, config.blackSec);
    // Auto-disable animations for timed games to reduce per-move overhead
    board.setAnimationsEnabled(false);
    animationsToggle.checked = false;
  } else {
    timer.configure(0, 0);
    // Restore user's animation preference for untimed games
    board.setAnimationsEnabled(animationsToggle.checked);
  }

  // Update game type label
  gameTypeLabel.textContent = chess960 ? 'Chess960' : 'Standard';

  // Show matchup info in status briefly
  let matchup;
  if (wIsAI && bIsAI) {
    const wElo = aiWhiteEloSlider.value;
    const bElo = aiBlackEloSlider.value;
    const wEng = ai.getEngineName('w');
    const bEng = ai.getEngineName('b');
    matchup = `${wEng} (${wElo}) vs ${bEng} (${bElo})`;
  } else if (wIsAI) {
    matchup = `${ai.getEngineName('w')} (${aiWhiteEloSlider.value}) vs Human`;
  } else if (bIsAI) {
    matchup = `Human vs ${ai.getEngineName('b')} (${aiBlackEloSlider.value})`;
  } else {
    matchup = 'Human vs Human';
  }
  updateStatus(matchup, true);

  // Update player type icons and info — use engine-specific icons
  const wInfo = getEngineInfo(aiWhiteEngineSelect.value);
  const bInfo = getEngineInfo(aiBlackEngineSelect.value);
  playerIconWhite.textContent = wIsAI ? (wInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  playerIconBlack.textContent = bIsAI ? (bInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  const wEloVal = parseInt(aiWhiteEloSlider.value, 10);
  const bEloVal = parseInt(aiBlackEloSlider.value, 10);
  const wName = wIsAI ? ai.getEngineName('w') : (customWhiteName || 'Human');
  const bName = bIsAI ? ai.getEngineName('b') : (customBlackName || 'Human');
  playerNameWhite.textContent = wName;
  playerNameBlack.textContent = bName;
  playerEloWhite.textContent = wIsAI ? wEloVal : '';
  playerEloBlack.textContent = bIsAI ? bEloVal : '';
  playerEloWhite.classList.toggle('hidden', !wIsAI);
  playerEloBlack.classList.toggle('hidden', !bIsAI);

  // Enable pre-game interactive controls
  appEl.classList.add('pre-game');
  closeAllPopups();

  renderCaptured();

  // Save game to local-first database (always succeeds, syncs to server in background)
  currentDbGameId = db.createGame({
    gameType: chess960 ? 'chess960' : 'standard',
    timeControl: getTimeControlLabel(),
    startingFen: game.chess.fen(),
    white: {
      name: wIsAI ? `${ai.getEngineName('w')} ${wEloVal}` : wName,
      isAI: wIsAI,
      elo: wIsAI ? wEloVal : null,
      engineId: wIsAI ? aiWhiteEngineSelect.value : null,
    },
    black: {
      name: bIsAI ? `${ai.getEngineName('b')} ${bEloVal}` : bName,
      isAI: bIsAI,
      elo: bIsAI ? bEloVal : null,
      engineId: bIsAI ? aiBlackEngineSelect.value : null,
    },
  });

  // Show eval bar if the toggle is enabled, and run initial evaluation
  if (evalBarToggle && evalBarToggle.checked) {
    mainEvalBar.show();
    mainEvalBar.reset();
    liveEval();
  } else {
    mainEvalBar.hide();
    mainEvalBar.reset();
  }

  // If AI plays White, show start button instead of auto-starting
  if (ai.isEnabled() && ai.isAITurn('w')) {
    startGameBtn.classList.remove('hidden');
  } else {
    startGameBtn.classList.add('hidden');
  }

  // Update URL to home
  router.silentUpdate('/');
}

/** Configure timer display for lobby preview without starting it */
function configureLobbyTimer(timeControl) {
  const tcMatch = timeControl ? timeControl.match(/^(\d+)\+(\d+)$/) : null;
  const tcOddsMatch = timeControl ? timeControl.match(/^(\d+)\/(\d+)\+(\d+)$/) : null;
  if (tcMatch) {
    timer.configure(parseInt(tcMatch[1], 10) * 60, parseInt(tcMatch[2], 10));
  } else if (tcOddsMatch) {
    timer.configure(parseInt(tcOddsMatch[1], 10) * 60, parseInt(tcOddsMatch[3], 10), parseInt(tcOddsMatch[2], 10) * 60);
  } else {
    timer.configure(0, 0);
  }
}

/** Start a multiplayer game (called by multiplayer event handlers) */
function startMultiplayerGame(color, fen, timeControl, opponentName, chess960) {
  multiplayerActive = true;
  multiplayerGameStartTime = Date.now();
  multiplayerMoveTimes = [];

  // Close any open panels/overlays
  if (postGameSummary.isOpen()) postGameSummary.close();
  if (isLiveReview) exitLiveReview();
  if (isReplayMode) exitReplayMode(false);

  // End current local game if in progress
  if (currentDbGameId && moveCount > 0 && !game.isGameOver()) {
    db.endGame(currentDbGameId, 'abandoned', 'abandoned');
  }

  gameId++;
  ai.stop();
  board.clearPremove();
  newGameBtn.classList.remove('game-ended');
  startGameBtn.classList.add('hidden');

  // Set up the game with the server-provided FEN
  // For chess960, the server already generates the randomized FEN — don't regenerate on client
  game.newGame(!!chess960, fen);
  board.getArrowOverlay().clear();

  // Flip board if playing black, and reposition player bars accordingly
  board.setFlipped(color === 'b');
  appEl.classList.toggle('board-flipped', color === 'b');
  board.render();
  moveCount = 0;
  resetLiveMoveBar();

  // Disable AI
  ai.configure({ whiteEnabled: false, blackEnabled: false });
  board.setAI(ai);

  // Configure timer from multiplayer time control (format: "5+0" or odds "10/5+3")
  const tcMatch = timeControl ? timeControl.match(/^(\d+)\+(\d+)$/) : null;
  const tcOddsMatch = timeControl ? timeControl.match(/^(\d+)\/(\d+)\+(\d+)$/) : null;
  if (tcMatch) {
    const minutes = parseInt(tcMatch[1], 10);
    const increment = parseInt(tcMatch[2], 10);
    timer.configure(minutes * 60, increment);
    timer.setServerAuthoritative(true);
    board.setAnimationsEnabled(false);
    animationsToggle.checked = false;
  } else if (tcOddsMatch) {
    const wMin = parseInt(tcOddsMatch[1], 10);
    const bMin = parseInt(tcOddsMatch[2], 10);
    const increment = parseInt(tcOddsMatch[3], 10);
    timer.configure(wMin * 60, increment, bMin * 60);
    timer.setServerAuthoritative(true);
    board.setAnimationsEnabled(false);
    animationsToggle.checked = false;
  } else {
    timer.configure(0, 0);
    timer.setServerAuthoritative(false);
  }

  // Update game type label
  gameTypeLabel.textContent = 'Online';

  // Player names and icons
  const myName = color === 'w' ? 'You' : opponentName || 'Opponent';
  const oppName = color === 'w' ? opponentName || 'Opponent' : 'You';
  playerIconWhite.textContent = '\uD83C\uDF10';
  playerIconBlack.textContent = '\uD83C\uDF10';
  playerNameWhite.textContent = color === 'w' ? 'You' : opponentName || 'Opponent';
  playerNameBlack.textContent = color === 'b' ? 'You' : opponentName || 'Opponent';
  // Mark opponent name as non-editable
  playerNameWhite.classList.toggle('multiplayer-opponent', color !== 'w');
  playerNameBlack.classList.toggle('multiplayer-opponent', color !== 'b');
  playerEloWhite.classList.add('hidden');
  playerEloBlack.classList.add('hidden');

  // Enable pre-game state
  appEl.classList.add('pre-game');
  closeAllPopups();
  renderCaptured();

  // DB persistence — save multiplayer games locally for replay/history
  currentDbGameId = db.createGame({
    gameType: chess960 ? 'chess960' : 'standard',
    timeControl: timeControl || 'Online',
    startingFen: game.chess.fen(),
    white: {
      name: color === 'w' ? 'You' : (opponentName || 'Opponent'),
      isAI: false,
    },
    black: {
      name: color === 'b' ? 'You' : (opponentName || 'Opponent'),
      isAI: false,
    },
  });

  // Disable eval bar during multiplayer (no engine assistance in online play)
  if (evalBarToggle) evalBarToggle.checked = false;
  mainEvalBar.hide();
  mainEvalBar.reset();
  if (liveEvalEngine) liveEvalEngine.stop();

  // Set board interactivity based on whose turn it is
  const isMyTurn = mp.isMyTurn(game.getTurn());
  board.setInteractive(isMyTurn);

  // Update video feed tint for turn indication
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }

  // Show multiplayer in-game controls
  mpUI.showGameControls();
  mpUI.close(); // close the modal

  updateStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
  router.silentUpdate('/');
}

board.onMove((result) => {
  if (isReplayMode || isLiveReview) return;
  moveCount++;
  showingGameInfo = false;

  // Disable pre-game interactive controls after first move
  if (moveCount === 1) {
    appEl.classList.remove('pre-game');
    closeAllPopups();
    startGameBtn.classList.add('hidden');
  }

  renderCaptured();

  // Update the persistent live move bar
  const moveSide = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
  appendLiveMove(result.san, moveSide, moveCount - 1);
  if (moveCount === 1) activateLiveMoveBar();
  updateLiveMoveBarButtons();

  // Multiplayer: send move to server, disable board until opponent moves
  if (mp.isActive()) {
    multiplayerMoveTimes.push(Date.now());
    mp.sendMove(result.san);
    diagnostics.flush();
    board.setInteractive(false);
    if (videoBoard.isActive()) {
      videoBoard.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
    }
    if (splitCam.isActive()) {
      splitCam.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
    }
    updateStatus("Opponent's turn");

    // Start/switch timer locally for visual feedback (server will sync)
    if (timer.isEnabled()) {
      const currentTurn = game.getTurn();
      if (moveCount === 1) {
        timer.start(currentTurn);
      } else {
        timer.switchTo(currentTurn);
      }
    }

    // Update live eval bar
    if (evalBarToggle && evalBarToggle.checked) liveEval();

    // Save move to local database
    if (currentDbGameId) {
      const side = game.getTurn() === 'w' ? 'b' : 'w';
      db.addMove(currentDbGameId, {
        ply: moveCount - 1,
        san: result.san,
        fen: game.chess.fen(),
        timestamp: Date.now(),
        side,
      });
    }

    // Check for game over (checkmate/stalemate detected client-side, server will confirm)
    if (game.isGameOver()) {
      board.clearPremove();
      fadeLiveMoveBar();
      newGameBtn.classList.add('game-ended');
      updateStatus();
    }
    return;
  }

  // Save move to local-first database
  const side = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
  db.addMove(currentDbGameId, {
    ply: moveCount - 1,
    san: result.san,
    fen: game.chess.fen(),
    timestamp: Date.now(),
    side: side,
  });

  if (timer.isEnabled()) {
    const currentTurn = game.getTurn();
    if (moveCount === 1) {
      // First move: start black's timer (white just moved)
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  // Update live eval bar after every move (if toggle is on)
  if (evalBarToggle && evalBarToggle.checked) {
    liveEval();
  }

  if (game.isGameOver()) {
    timer.stop();
    board.clearPremove();
    fadeLiveMoveBar();
    newGameBtn.classList.add('game-ended');
    updateStatus();

    // Save game result to local-first database
    const { result: dbResult, reason } = getGameResult();
    db.endGame(currentDbGameId, dbResult, reason);

    // Auto-trigger post-game summary
    triggerPostGameSummary();
    return;
  }

  updateStatus();

  // Check for queued premove before triggering AI
  const turn = game.getTurn();
  if (board.getPremove() && (!ai.isEnabled() || !ai.isAITurn(turn))) {
    setTimeout(() => {
      if (!board.executePremove()) {
        triggerAIMove();
      }
    }, 50);
    return;
  }

  // Trigger AI move if it's the computer's turn
  triggerAIMove();
});

timer.onTimeout((loser) => {
  if (isLiveReview) exitLiveReview();
  fadeLiveMoveBar();
  ai.stop();
  game.setTimedOut();
  newGameBtn.classList.add('game-ended');
  const winner = loser === 'White' ? 'Black' : 'White';
  updateStatus(`Time out! ${winner} wins`);

  // Save timeout result to local-first database
  const dbResult = loser === 'White' ? '0-1' : '1-0';
  db.endGame(currentDbGameId, dbResult, 'timeout');

  // Auto-trigger post-game summary
  triggerPostGameSummary();
});

newGameBtn.addEventListener('click', async () => {
  // If multiplayer game active, don't interfere
  if (multiplayerActive) return;

  // If a game is in progress, confirm abandonment first
  if (moveCount > 0 && !game.isGameOver()) {
    const confirmed = await showConfirmation(
      'You have a game in progress. Abandon it and start a new one?',
      'Abandon Game?'
    );
    if (!confirmed) return;
    if (currentDbGameId) {
      db.endGame(currentDbGameId, 'abandoned', 'abandoned');
    }
  }

  newGameMenu.open();
});

// Flash lobby panel when user touches the board during pre-game lobby
boardEl.addEventListener('pointerdown', () => {
  if (!boardEl.classList.contains('lobby-active')) return;
  const panel = document.getElementById('lobby-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  panel.classList.remove('flash');
  void panel.offsetWidth; // force reflow to restart animation
  panel.classList.add('flash');
});

// Start button — deferred AI start
startGameBtn.addEventListener('click', () => {
  startGameBtn.classList.add('hidden');
  appEl.classList.remove('pre-game');
  closeAllPopups();
  triggerAIMove();
});

// --- Editable Player Names ---

function startNameEdit(nameEl, side) {
  if (isReplayMode || isLiveReview) return;
  // Prevent double-editing
  if (nameEl.querySelector('.player-name-input')) return;

  const currentName = nameEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'player-name-input';
  input.value = currentName;
  input.maxLength = 20;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();
  input.select();

  function commitName() {
    const newName = input.value.trim() || (side === 'white' ? 'Human' : 'Human');
    nameEl.textContent = newName;

    // In multiplayer, broadcast name change to opponent
    if (multiplayerActive) {
      mp.changeName(newName);
      return;
    }

    // Only save custom name for human players
    const isAI = side === 'white' ? aiWhiteToggle.checked : aiBlackToggle.checked;
    if (!isAI) {
      if (side === 'white') {
        customWhiteName = newName === 'Human' ? null : newName;
      } else {
        customBlackName = newName === 'Human' ? null : newName;
      }
    }

    // Update local-first database
    db.updatePlayerName(currentDbGameId, side, newName);
  }

  function cancelEdit() {
    nameEl.textContent = currentName;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  input.addEventListener('blur', () => {
    // Only commit if input is still in DOM (wasn't cancelled by Escape)
    if (nameEl.contains(input)) {
      commitName();
    }
  });
}

function startEngineSwitch(nameEl, side) {
  if (isReplayMode || multiplayerActive) return;
  if (nameEl.querySelector('.engine-switch-select')) return;

  const isWhite = side === 'white';
  const settingsSelect = isWhite ? aiWhiteEngineSelect : aiBlackEngineSelect;
  const currentEngineId = settingsSelect.value;
  const currentName = nameEl.textContent;

  const select = document.createElement('select');
  select.className = 'engine-switch-select';
  const engines = getAllEngines();
  for (const eng of engines) {
    const opt = document.createElement('option');
    opt.value = eng.id;
    opt.textContent = `${eng.icon} ${eng.name}`;
    if (eng.id === currentEngineId) opt.selected = true;
    select.appendChild(opt);
  }

  nameEl.textContent = '';
  nameEl.appendChild(select);
  select.focus();
  // Open the dropdown immediately so the user doesn't have to click twice
  try { select.showPicker(); } catch { /* older browsers */ }


  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const newId = select.value;
    // Remove select safely
    if (select.parentNode) {
      select.parentNode.removeChild(select);
    }
    if (newId !== currentEngineId) {
      settingsSelect.value = newId;
      settingsSelect.dispatchEvent(new Event('change'));
      startNewGame();
    } else {
      nameEl.textContent = currentName;
    }
  }

  select.addEventListener('change', commit);
  select.addEventListener('blur', () => {
    if (!committed && select.parentNode) {
      select.parentNode.removeChild(select);
      nameEl.textContent = currentName;
    }
  });
}

playerNameWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  if (multiplayerActive) {
    // In multiplayer: only allow editing own name, not opponent's
    if (mp.color === 'w') {
      startNameEdit(playerNameWhite, 'white');
    }
    return;
  }
  if (aiWhiteToggle.checked) {
    startEngineSwitch(playerNameWhite, 'white');
  } else {
    startNameEdit(playerNameWhite, 'white');
  }
});

playerNameBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  if (multiplayerActive) {
    // In multiplayer: only allow editing own name, not opponent's
    if (mp.color === 'b') {
      startNameEdit(playerNameBlack, 'black');
    }
    return;
  }
  if (aiBlackToggle.checked) {
    startEngineSwitch(playerNameBlack, 'black');
  } else {
    startNameEdit(playerNameBlack, 'black');
  }
});

// Game history button
gameHistoryBtn.addEventListener('click', () => {
  gameBrowser.open();
  router.silentUpdate('/games');
});

// Time control select
timeControlSelect.addEventListener('change', () => {
  if (timeControlSelect.value === 'custom') {
    customTimeModal.classList.remove('hidden');
  } else {
    startNewGame();
  }
});

// Toggle between same-time and per-player fields
customOddsToggle.addEventListener('change', () => {
  const odds = customOddsToggle.checked;
  sameTimeFields.classList.toggle('hidden', odds);
  oddsTimeFields.classList.toggle('hidden', !odds);
});

customTimeOk.addEventListener('click', () => {
  const odds = customOddsToggle.checked;
  const increment = parseInt(customIncrementInput.value, 10) || 0;
  let wMin, bMin;

  if (odds) {
    wMin = parseInt(customWhiteMinutes.value, 10) || 10;
    bMin = parseInt(customBlackMinutes.value, 10) || 5;
  } else {
    wMin = parseInt(customMinutesInput.value, 10) || 10;
    bMin = wMin;
  }

  // Add custom option and select it
  const existingCustom = timeControlSelect.querySelector('[data-custom]');
  if (existingCustom) existingCustom.remove();
  const opt = document.createElement('option');
  const label = wMin === bMin
    ? `Custom ${wMin}+${increment}`
    : `Custom W${wMin} / B${bMin} +${increment}`;
  const tcValue = `${wMin * 60}|${increment}|${bMin * 60}`;
  opt.value = tcValue;
  opt.textContent = label;
  opt.dataset.custom = 'true';
  opt.selected = true;
  timeControlSelect.insertBefore(opt, timeControlSelect.querySelector('[value="custom"]'));
  customTimeModal.classList.add('hidden');
  customWhiteLabel.textContent = 'White minutes:';
  customBlackLabel.textContent = 'Black minutes:';

  // If a lobby custom TC is pending, apply it to the lobby
  if (mpUI && mpUI.hasPendingLobbyCustomTc()) {
    mpUI.applyCustomTc(wMin, bMin, increment);
    return;
  }

  // If the new game wizard triggered this, resume at settings step
  if (newGameMenu.hasPendingCustomTime()) {
    newGameMenu.resumeAtSettings(tcValue);
  } else {
    startNewGame();
  }
});

customTimeCancel.addEventListener('click', () => {
  customTimeModal.classList.add('hidden');
  customWhiteLabel.textContent = 'White minutes:';
  customBlackLabel.textContent = 'Black minutes:';
  // If a lobby custom TC is pending, cancel it
  if (mpUI && mpUI.hasPendingLobbyCustomTc()) {
    mpUI.resetLobbyCustomTc();
    return;
  }
  timeControlSelect.value = '600|0'; // fallback to Rapid 10+0
});

// Animations toggle
animationsToggle.addEventListener('change', () => {
  board.setAnimationsEnabled(animationsToggle.checked);
});

// Eval bar toggle — persists preference and shows/hides bar during live play
if (evalBarToggle) {
  evalBarToggle.addEventListener('change', () => {
    const enabled = evalBarToggle.checked;
    localStorage.setItem('chess-eval-bar', enabled ? 'true' : 'false');

    // Prevent eval bar during multiplayer games
    if (multiplayerActive) {
      evalBarToggle.checked = false;
      return;
    }

    if (isReplayMode) {
      // In replay mode, show/hide based on toggle + analysis data
      if (enabled && replayAnalysisData) {
        mainEvalBar.show();
        updateMainEvalBar();
      } else {
        mainEvalBar.hide();
      }
      return;
    }

    if (enabled) {
      mainEvalBar.show();
      mainEvalBar.reset();
      liveEval();
    } else {
      mainEvalBar.hide();
      mainEvalBar.reset();
      if (liveEvalEngine) liveEvalEngine.stop();
    }
    saveSettingsToServer();
  });
}

// Premoves toggle
premovesToggle.checked = localStorage.getItem('chess-premoves') === 'true';
board.setPremovesEnabled(premovesToggle.checked);
premovesToggle.addEventListener('change', () => {
  localStorage.setItem('chess-premoves', premovesToggle.checked ? 'true' : 'false');
  board.setPremovesEnabled(premovesToggle.checked);
  if (!premovesToggle.checked) board.clearPremove();
  saveSettingsToServer();
});

// Settings panel toggle (bottom sheet)
function openSettings() {
  settingsPanel.classList.add('open');
  settingsBackdrop.classList.add('visible');
  settingsToggle.classList.add('active');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsBackdrop.classList.remove('visible');
  settingsToggle.classList.remove('active');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

settingsToggle.addEventListener('click', () => {
  if (settingsPanel.classList.contains('open')) {
    closeSettings();
  } else {
    openSettings();
  }
});

settingsBackdrop.addEventListener('click', closeSettings);

// Art style picker
artStylePicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.art-style-option');
  if (!btn) return;

  const style = btn.dataset.style;
  if (!STYLE_PATHS[style]) return;

  window.chessPiecePath = STYLE_PATHS[style];

  artStylePicker.querySelectorAll('.art-style-option').forEach(el => {
    el.classList.toggle('selected', el === btn);
  });

  board.render();
  renderCaptured();
  saveSettingsToServer();
});

// Board tint slider
boardTintSlider.addEventListener('input', () => {
  const val = parseInt(boardTintSlider.value, 10);
  boardTintValue.textContent = val + '%';
  if (videoBoard.isActive() && mp) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, val / 100);
  }
  if (splitCam.isActive() && mp) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, val / 100);
  }
});
boardTintSlider.addEventListener('change', () => {
  saveSettingsToServer();
});

// AI per-side toggles - show/hide engine select + ELO sliders
aiWhiteToggle.addEventListener('change', () => {
  const on = aiWhiteToggle.checked;
  aiWhiteEngineSelect.classList.toggle('hidden', !on);
  updateEloSliderRange('w');
});

aiBlackToggle.addEventListener('change', () => {
  const on = aiBlackToggle.checked;
  aiBlackEngineSelect.classList.toggle('hidden', !on);
  updateEloSliderRange('b');
});

// Engine selector change — update ELO slider range and player bar
aiWhiteEngineSelect.addEventListener('change', () => {
  updateEloSliderRange('w');
  saveEngineSelection();
  if (aiWhiteToggle.checked) {
    const info = getEngineInfo(aiWhiteEngineSelect.value);
    if (info) {
      playerNameWhite.textContent = info.name;
      playerIconWhite.textContent = info.icon || '\uD83E\uDD16';
      playerEloWhite.textContent = aiWhiteEloSlider.value;
    }
  }
});

aiBlackEngineSelect.addEventListener('change', () => {
  updateEloSliderRange('b');
  saveEngineSelection();
  if (aiBlackToggle.checked) {
    const info = getEngineInfo(aiBlackEngineSelect.value);
    if (info) {
      playerNameBlack.textContent = info.name;
      playerIconBlack.textContent = info.icon || '\uD83E\uDD16';
      playerEloBlack.textContent = aiBlackEloSlider.value;
    }
  }
});

/**
 * Update ELO slider min/max/step based on selected engine.
 * Hides slider entirely for engines with no ELO range (e.g. Random).
 */
function updateEloSliderRange(side) {
  const isWhite = side === 'w';
  const toggle = isWhite ? aiWhiteToggle : aiBlackToggle;
  const select = isWhite ? aiWhiteEngineSelect : aiBlackEngineSelect;
  const slider = isWhite ? aiWhiteEloSlider : aiBlackEloSlider;
  const valueEl = isWhite ? aiWhiteEloValue : aiBlackEloValue;
  const wrapper = isWhite ? aiWhiteEloWrapper : aiBlackEloWrapper;

  if (!toggle.checked) {
    wrapper.classList.add('hidden');
    return;
  }

  const info = getEngineInfo(select.value);
  if (!info) return;

  const { min, max, step, default: defaultElo } = info.eloRange;

  if (min === max) {
    slider.min = min;
    slider.max = max;
    slider.value = defaultElo;
    valueEl.textContent = defaultElo;
    wrapper.classList.add('hidden');
    return;
  }

  slider.min = min;
  slider.max = max;
  slider.step = step;
  const current = parseInt(slider.value, 10);
  if (current < min || current > max) {
    slider.value = defaultElo;
  }
  valueEl.textContent = slider.value;
  wrapper.classList.remove('hidden');
}

// ELO slider live value display
aiWhiteEloSlider.addEventListener('input', () => {
  aiWhiteEloValue.textContent = aiWhiteEloSlider.value;
});

aiBlackEloSlider.addEventListener('input', () => {
  aiBlackEloValue.textContent = aiBlackEloSlider.value;
});

// Archive menu — dynamically discover archive location
let archiveLoaded = false;

async function loadArchiveMenu() {
  if (archiveLoaded) return;
  archiveLoaded = true;

  archiveMenu.innerHTML = '';
  let archiveBase = 'archive/';
  let currentHref = null;

  // Check if local archive/ exists (main app has archive/ as a subdirectory)
  try {
    const res = await fetch('archive/', { method: 'HEAD' });
    if (!res.ok) throw new Error();
  } catch {
    // Try parent's archive/ (sibling relationship)
    let found = false;
    try {
      const res = await fetch('../archive/', { method: 'HEAD' });
      if (res.ok) {
        archiveBase = '../archive/';
        currentHref = '../';
        found = true;
      }
    } catch { /* continue */ }
    // If not found, check if we're inside the archive directory itself
    if (!found) {
      try {
        const res = await fetch('../');
        if (res.ok) {
          const html = await res.text();
          // If parent listing contains subdirectories, treat it as the archive
          if (html.includes('href="') && !html.includes('<title>404')) {
            archiveBase = '../';
            currentHref = '../../';
          }
        }
      } catch { /* no archive found */ }
    }
  }

  // Add "Current" link when not at the top-level app
  if (currentHref) {
    const currentLink = document.createElement('a');
    currentLink.href = currentHref;
    currentLink.textContent = 'Current';
    archiveMenu.appendChild(currentLink);
  }

  // Scan for subdirectories by fetching the archive index
  try {
    const res = await fetch(archiveBase);
    if (res.ok) {
      const html = await res.text();
      // Parse directory listing links (Apache auto-index format)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a[href]');
      const entries = [];
      for (const link of links) {
        const href = link.getAttribute('href');
        // Skip parent, self, and query/sort links
        if (!href || href === '../' || href === './' || href.startsWith('?') || href.startsWith('/')) continue;
        entries.push(href);
      }
      // Reverse so most recent (date-prefixed) entries appear first
      entries.reverse();
      for (const href of entries) {
        const name = decodeURIComponent(href.replace(/\/$/, ''));
        const a = document.createElement('a');
        a.href = `${archiveBase}${href}index.html`;
        if (!currentHref) a.target = '_blank';
        a.textContent = name;
        archiveMenu.appendChild(a);
      }
    }
  } catch { /* silently fail */ }

  if (archiveMenu.children.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'No archives';
    empty.style.color = '#888';
    empty.style.padding = '4px 8px';
    archiveMenu.appendChild(empty);
  }
}

archiveToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  archiveMenu.classList.toggle('hidden');
  if (!archiveMenu.classList.contains('hidden')) {
    loadArchiveMenu();
  }
});

// Close archive menu on outside click
document.addEventListener('click', (e) => {
  if (!archiveMenu.classList.contains('hidden') &&
      !archiveMenu.contains(e.target) &&
      e.target !== archiveToggleBtn) {
    archiveMenu.classList.add('hidden');
  }
});

// --- Pre-game Inline Controls ---

function closeAllPopups() {
  document.querySelectorAll('.timer-dropdown, .elo-popup').forEach(el => el.remove());
}

// Click player icon to toggle Human ↔ AI (only before first move)
playerIconWhite.addEventListener('click', () => {
  if (isReplayMode || multiplayerActive || moveCount > 0) return;
  aiWhiteToggle.checked = !aiWhiteToggle.checked;
  aiWhiteToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

playerIconBlack.addEventListener('click', () => {
  if (isReplayMode || multiplayerActive || moveCount > 0) return;
  aiBlackToggle.checked = !aiBlackToggle.checked;
  aiBlackToggle.dispatchEvent(new Event('change'));
  startNewGame();
});

// Click game type label to toggle Chess960 ↔ Standard (only before first move)
gameTypeLabel.addEventListener('click', () => {
  if (isReplayMode || moveCount > 0) return;
  chess960Toggle.checked = !chess960Toggle.checked;
  startNewGame();
});

// Click timer for time control dropdown (only before first move)
function showTimerDropdown(timerEl) {
  if (isReplayMode || moveCount > 0) return;
  closeAllPopups();

  const dropdown = document.createElement('div');
  dropdown.className = 'timer-dropdown';

  // Gather options from the time control select
  const options = timeControlSelect.querySelectorAll('option');
  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'timer-dropdown-option';
    if (opt.value === timeControlSelect.value) {
      item.classList.add('selected');
    }
    item.textContent = opt.textContent;
    item.dataset.value = opt.value;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opt.value === 'custom') {
        closeAllPopups();
        customTimeModal.classList.remove('hidden');
        return;
      }
      timeControlSelect.value = opt.value;
      closeAllPopups();
      startNewGame();
    });
    dropdown.appendChild(item);
  });

  // Position near the timer
  const rect = timerEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  // Prevent dropdown from going off-screen right
  document.body.appendChild(dropdown);
  const dropRect = dropdown.getBoundingClientRect();
  if (dropRect.right > window.innerWidth) {
    dropdown.style.left = `${window.innerWidth - dropRect.width - 8}px`;
  }
  // Prevent going off-screen bottom — show above instead
  if (dropRect.bottom > window.innerHeight) {
    dropdown.style.top = `${rect.top - dropRect.height - 4}px`;
  }
}

timerWhiteEl.addEventListener('click', (e) => {
  e.stopPropagation();
  showTimerDropdown(timerWhiteEl);
});

timerBlackEl.addEventListener('click', (e) => {
  e.stopPropagation();
  showTimerDropdown(timerBlackEl);
});

// Click ELO label for inline slider popup (only before first move, only for AI)
function showEloPopup(eloEl, side) {
  if (isReplayMode || moveCount > 0) return;
  closeAllPopups();

  const isWhite = side === 'w';
  const slider = isWhite ? aiWhiteEloSlider : aiBlackEloSlider;
  const settingsValue = isWhite ? aiWhiteEloValue : aiBlackEloValue;

  // Don't show popup for engines with no ELO range (e.g. Random)
  if (slider.min === slider.max) return;

  const popup = document.createElement('div');
  popup.className = 'elo-popup';

  const rangeInput = document.createElement('input');
  rangeInput.type = 'range';
  rangeInput.min = slider.min;
  rangeInput.max = slider.max;
  rangeInput.step = slider.step;
  rangeInput.value = slider.value;
  rangeInput.className = 'elo-slider';

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'elo-value';
  valueDisplay.textContent = slider.value;

  rangeInput.addEventListener('input', () => {
    valueDisplay.textContent = rangeInput.value;
    // Sync with settings panel slider
    slider.value = rangeInput.value;
    settingsValue.textContent = rangeInput.value;
    // Update the player bar elo display
    eloEl.textContent = rangeInput.value;
  });

  popup.appendChild(rangeInput);
  popup.appendChild(valueDisplay);

  // Position near the elo label
  const rect = eloEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 4}px`;

  document.body.appendChild(popup);

  // Adjust if off-screen
  const popRect = popup.getBoundingClientRect();
  if (popRect.right > window.innerWidth) {
    popup.style.left = `${window.innerWidth - popRect.width - 8}px`;
  }
  if (popRect.bottom > window.innerHeight) {
    popup.style.top = `${rect.top - popRect.height - 4}px`;
  }

  // Stop click propagation so it doesn't immediately close
  popup.addEventListener('click', (e) => e.stopPropagation());
}

playerEloWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  showEloPopup(playerEloWhite, 'w');
});

playerEloBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  showEloPopup(playerEloBlack, 'b');
});

// Close popups on outside click
document.addEventListener('click', () => {
  const hadPopup = document.querySelector('.elo-popup');
  closeAllPopups();
  // If an elo popup was open and just closed, restart game to apply ELO change
  if (hadPopup && moveCount === 0) {
    startNewGame();
  }
});

// Close popups on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    board.clearPremove();
    const hadPopup = document.querySelector('.elo-popup');
    closeAllPopups();
    if (hadPopup && moveCount === 0) {
      startNewGame();
    }
  }
});

// --- Confirmation Modal ---

function showConfirmation(message, title) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title || 'Confirm';
    confirmModalMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    function cleanup() {
      confirmModal.classList.add('hidden');
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
    }

    function onOk() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onBackdrop(e) {
      if (e.target === confirmModal) {
        cleanup();
        resolve(false);
      }
    }

    confirmModalOk.addEventListener('click', onOk);
    confirmModalCancel.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);
  });
}

// --- Replay on Main Board ---

async function enterReplayMode(gameRecord) {
  // Confirm if there's an active live game (not if already in replay mode)
  // Skip confirmation for post-multiplayer review (game already ended)
  if (!isReplayMode && moveCount > 0 && !game.isGameOver() && !lastMultiplayerGameRecord) {
    const confirmed = await showConfirmation(
      'You have a game in progress. Abandon it to review this game?',
      'Abandon Game?'
    );
    if (!confirmed) {
      return;
    }
    // End the current game as abandoned
    if (currentDbGameId) {
      db.endGame(currentDbGameId, 'abandoned', 'abandoned');
    }
    moveCount = 0;
  }

  if (isReplayMode) exitReplayMode(false);
  if (isLiveReview) exitLiveReview();
  fadeLiveMoveBar();

  ai.stop();
  timer.stop();

  // Stop live eval — replay mode uses its own analysis engine
  if (liveEvalEngine) {
    liveEvalEngine.stop();
  }

  isReplayMode = true;
  replayGame = gameRecord;
  replayPly = -1;
  replayPlaying = false;

  // Precompute move details (from/to for highlighting)
  replayMoveDetails = [];
  const scratch = new Chess(gameRecord.startingFen);
  for (const move of gameRecord.moves) {
    const result = scratch.move(move.san);
    if (result) {
      replayMoveDetails.push({
        fen: move.fen,
        from: result.from,
        to: result.to,
        san: move.san,
        side: move.side,
      });
    }
  }

  // Reconstruct clocks
  replayClockSnapshots = reconstructClocks(gameRecord);

  // Disable board input and show replay border
  board.setInteractive(false);
  boardEl.classList.add('replay-mode-border');

  // Update player bars
  updatePlayerBarsForReplay(gameRecord);

  // Update status
  statusEl.textContent = 'Replay Mode';
  statusEl.className = 'status replay-mode';

  // Hide normal game controls that don't apply
  startGameBtn.classList.add('hidden');
  appEl.classList.remove('pre-game');
  closeAllPopups();

  // Build move list
  buildReplayMoveList(gameRecord);

  // Show replay controls
  replayControlsEl.classList.remove('hidden');

  // Show result
  if (gameRecord.result) {
    replayResultEl.textContent = formatReplayResult(gameRecord);
    replayResultEl.style.display = '';
  } else {
    replayResultEl.style.display = 'none';
  }

  // Render starting position
  replayGoToMove(-1);

  // Highlight New Game button to indicate how to exit
  newGameBtn.classList.add('game-ended');

  // Set up keyboard handler
  document.addEventListener('keydown', replayKeyHandler);

  // Auto-analyze if toggle is enabled
  resetMainBoardAnalysis();
  if (replayAnalyzeCheckbox && replayAnalyzeCheckbox.checked) {
    runMainBoardAnalysis(gameRecord);
  }

  // Update URL to reflect replay mode
  if (gameRecord.id) {
    router.silentUpdate('/replay', { gameid: gameRecord.id });
  }

  // Enter shared review if this is a post-multiplayer game
  if (mp.roomId) {
    sharedReviewActive = true;
    mp.sendReviewEnter();
  }
}

function exitReplayMode(startNew = true) {
  if (!isReplayMode) return;

  // Exit shared review if active
  if (sharedReviewActive) {
    mp.sendReviewExit();
    sharedReviewActive = false;
    peerInReview = false;
    peerAnalysisRunning = false;
  }

  stopReplayPlayback();

  // Stop analysis if running
  if (replayAnalysisEngine) {
    replayAnalysisEngine.stop();
  }
  resetMainBoardAnalysis();

  isReplayMode = false;
  replayGame = null;
  replayPly = -1;
  replayMoveDetails = [];
  replayClockSnapshots = [];

  // Clear all arrows
  board.getArrowOverlay().clear();

  // Re-enable board input and remove replay border
  board.setInteractive(true);
  boardEl.classList.remove('replay-mode-border');

  // Hide replay controls
  replayControlsEl.classList.add('hidden');

  // Remove keyboard handler
  document.removeEventListener('keydown', replayKeyHandler);

  if (startNew) startNewGame();
}

// --- Replay Navigation ---

function replayGoToMove(plyIndex) {
  if (!replayGame) return;
  const maxPly = replayGame.moves.length - 1;
  replayPly = Math.max(-1, Math.min(plyIndex, maxPly));

  if (replayPly === -1) {
    game.chess.load(replayGame.startingFen);
    game._lastMove = null;
  } else {
    const detail = replayMoveDetails[replayPly];
    game.chess.load(detail.fen);
    game._lastMove = { from: detail.from, to: detail.to };
  }

  board.render();
  highlightReplayMove();
  updateReplayButtons();
  updateReplayTimers();

  if (replayPly === -1) {
    statusEl.textContent = 'Replay Mode \u2014 Starting Position';
  } else {
    const moveNum = Math.floor(replayPly / 2) + 1;
    const side = replayMoveDetails[replayPly].side === 'w' ? '' : '...';
    statusEl.textContent = `Replay Mode \u2014 ${moveNum}${side} ${replayMoveDetails[replayPly].san}`;
  }
  statusEl.className = 'status replay-mode';

  // Update analysis detail panel and engine arrows for current ply
  if (replayAnalysisData) {
    updateAnalysisDetail();
    updateCriticalNav();
    updateMainEvalBar();
    updateEngineArrows();
  } else {
    board.getArrowOverlay().clearEngineArrows();
  }

  // Clear peer arrows on navigation (arrows are position-specific)
  board.getArrowOverlay().clearPeerAnnotations();

  // Sync navigation to peer in shared review
  if (sharedReviewActive && !isRemoteNavigation) {
    mp.sendReviewNavigate(replayPly);
  }
}

function replayNext() {
  if (!replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    stopReplayPlayback();
    return;
  }
  replayGoToMove(replayPly + 1);
}

function replayPrev() {
  replayGoToMove(replayPly - 1);
}

function replayGoToStart() {
  stopReplayPlayback();
  replayGoToMove(-1);
}

function replayGoToEnd() {
  stopReplayPlayback();
  if (replayGame) {
    replayGoToMove(replayGame.moves.length - 1);
  }
}

// --- Replay Playback ---

function toggleReplayPlayback() {
  if (replayPlaying) {
    stopReplayPlayback();
  } else {
    startReplayPlayback();
  }
}

function startReplayPlayback() {
  if (!replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    replayGoToMove(-1);
  }
  replayPlaying = true;
  replayPlayBtn.textContent = '\u23F8';
  replayPlayBtn.classList.add('playing');
  scheduleReplayNext();
}

function stopReplayPlayback() {
  replayPlaying = false;
  if (replayTimer) {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
  if (replayPlayBtn) {
    replayPlayBtn.textContent = '\u25B6';
    replayPlayBtn.classList.remove('playing');
  }
}

function scheduleReplayNext() {
  if (!replayPlaying || !replayGame) return;
  if (replayPly >= replayGame.moves.length - 1) {
    stopReplayPlayback();
    return;
  }

  const nextPly = replayPly + 1;
  const nextMove = replayGame.moves[nextPly];
  let delay;

  if (replayPly === -1) {
    delay = nextMove.timestamp - replayGame.startTime;
  } else {
    delay = nextMove.timestamp - replayGame.moves[replayPly].timestamp;
  }

  delay = Math.max(200, Math.min(delay, 5000));

  replayTimer = setTimeout(() => {
    replayNext();
    if (replayPlaying) scheduleReplayNext();
  }, delay);
}

// --- Replay Clock Reconstruction ---

function parseReplayTimeControl(tc) {
  if (!tc || tc === 'none' || tc === 'No Timer') return null;
  const oddsMatch = tc.match(/W(\d+)\s*\/\s*B(\d+)\s*\+(\d+)/);
  if (oddsMatch) {
    return {
      baseSec: parseInt(oddsMatch[1], 10) * 60,
      blackBaseSec: parseInt(oddsMatch[2], 10) * 60,
      increment: parseInt(oddsMatch[3], 10),
    };
  }
  const match = tc.match(/(\d+)\+(\d+)/);
  if (!match) return null;
  return { baseSec: parseInt(match[1], 10) * 60, increment: parseInt(match[2], 10) };
}

function reconstructClocks(gameRecord) {
  const snapshots = [];
  const tc = parseReplayTimeControl(gameRecord.timeControl);
  if (!tc) {
    for (let i = 0; i < gameRecord.moves.length; i++) snapshots.push(null);
    return snapshots;
  }

  let whiteTime = tc.baseSec;
  let blackTime = tc.blackBaseSec || tc.baseSec;
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

function formatClockTime(seconds) {
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

function updateReplayTimers() {
  if (!replayGame) return;

  if (replayPly === -1) {
    const tc = parseReplayTimeControl(replayGame.timeControl);
    if (tc) {
      timerWhiteEl.textContent = formatClockTime(tc.baseSec);
      timerBlackEl.textContent = formatClockTime(tc.blackBaseSec || tc.baseSec);
    } else {
      timerWhiteEl.textContent = '--:--';
      timerBlackEl.textContent = '--:--';
    }
    timerWhiteEl.classList.remove('timer-active', 'timer-low');
    timerBlackEl.classList.remove('timer-active', 'timer-low');
    return;
  }

  const snapshot = replayClockSnapshots[replayPly];
  if (!snapshot) {
    timerWhiteEl.textContent = '--:--';
    timerBlackEl.textContent = '--:--';
    timerWhiteEl.classList.remove('timer-active', 'timer-low');
    timerBlackEl.classList.remove('timer-active', 'timer-low');
    return;
  }

  timerWhiteEl.textContent = formatClockTime(snapshot.w);
  timerBlackEl.textContent = formatClockTime(snapshot.b);

  const nextPly = replayPly + 1;
  if (nextPly < replayGame.moves.length) {
    const nextSide = replayGame.moves[nextPly].side;
    timerWhiteEl.classList.toggle('timer-active', nextSide === 'w');
    timerBlackEl.classList.toggle('timer-active', nextSide === 'b');
  } else {
    timerWhiteEl.classList.remove('timer-active');
    timerBlackEl.classList.remove('timer-active');
  }
}

// --- Replay Player Bars ---

function updatePlayerBarsForReplay(gameRecord) {
  const w = gameRecord.white;
  const b = gameRecord.black;

  playerNameWhite.textContent = w.name || 'White';
  playerNameBlack.textContent = b.name || 'Black';
  const wEngInfo = w.engineId ? getEngineInfo(w.engineId) : null;
  const bEngInfo = b.engineId ? getEngineInfo(b.engineId) : null;
  playerIconWhite.textContent = w.isAI ? (wEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';
  playerIconBlack.textContent = b.isAI ? (bEngInfo?.icon || '\uD83E\uDD16') : '\uD83D\uDC64';

  if (w.elo) {
    playerEloWhite.textContent = w.elo;
    playerEloWhite.classList.remove('hidden');
  } else {
    playerEloWhite.classList.add('hidden');
  }

  if (b.elo) {
    playerEloBlack.textContent = b.elo;
    playerEloBlack.classList.remove('hidden');
  } else {
    playerEloBlack.classList.add('hidden');
  }

  capturedByWhiteEl.innerHTML = '';
  capturedByBlackEl.innerHTML = '';

  gameTypeLabel.textContent = gameRecord.gameType === 'chess960' ? 'Chess960' : 'Standard';
}

// --- Replay Move List ---

function buildReplayMoveList(gameRecord) {
  replayMoveListEl.innerHTML = '';

  for (let i = 0; i < gameRecord.moves.length; i++) {
    const move = gameRecord.moves[i];
    const moveNum = Math.floor(i / 2) + 1;
    const isWhite = move.side === 'w';

    if (isWhite) {
      const numEl = document.createElement('span');
      numEl.className = 'strip-move-num';
      numEl.textContent = `${moveNum}.`;
      replayMoveListEl.appendChild(numEl);
    }

    const moveEl = document.createElement('span');
    moveEl.className = 'strip-move';
    moveEl.textContent = move.san;
    moveEl.dataset.ply = i;
    moveEl.addEventListener('click', () => {
      stopReplayPlayback();
      replayGoToMove(parseInt(moveEl.dataset.ply, 10));
    });
    replayMoveListEl.appendChild(moveEl);
  }
}

function highlightReplayMove() {
  replayMoveListEl.querySelectorAll('.strip-move-active').forEach(el => {
    el.classList.remove('strip-move-active');
  });

  if (replayPly >= 0) {
    const el = replayMoveListEl.querySelector(`.strip-move[data-ply="${replayPly}"]`);
    if (el) {
      el.classList.add('strip-move-active');
      el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  } else {
    replayMoveListEl.scrollLeft = 0;
  }
}

// --- Replay Button State ---

function updateReplayButtons() {
  if (!replayGame) return;
  const atStart = replayPly === -1;
  const atEnd = replayPly >= replayGame.moves.length - 1;

  replayStartBtn.disabled = atStart;
  replayPrevBtn.disabled = atStart;
  replayNextBtn.disabled = atEnd;
  replayEndBtn.disabled = atEnd;
}

function formatReplayResult(gameRecord) {
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

// --- Main-Board Analysis ---

function loadCachedAnalysis(serverId) {
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

async function runMainBoardAnalysis(gameRecord) {
  if (!gameRecord || !gameRecord.moves || gameRecord.moves.length === 0) return;

  // If peer is already running analysis during shared review, skip
  if (sharedReviewActive && peerAnalysisRunning) return;

  // Check cache first
  const serverId = gameRecord.serverId || null;
  const cached = loadCachedAnalysis(serverId);
  if (cached) {
    setMainBoardAnalysis(cached);
    // Share cached results with peer
    if (sharedReviewActive) {
      mp.sendReviewAnalysis(cached);
    }
    return;
  }

  // Notify peer that we're starting analysis
  if (sharedReviewActive) {
    mp.sendReviewAnalysisStarted();
  }

  // Lazily create engine
  if (!replayAnalysisEngine) {
    replayAnalysisEngine = new AnalysisEngine();
  }

  const totalPositions = gameRecord.moves.length + 1;
  replayProgressEl.classList.remove('hidden');
  replayProgressFillEl.style.width = '0%';

  try {
    const result = await replayAnalysisEngine.analyze(
      gameRecord.moves,
      gameRecord.startingFen,
      {
        depth: 18,
        serverId: serverId,
        onProgress: ({ current, total }) => {
          const pct = total > 0 ? (current / total * 100) : 0;
          replayProgressFillEl.style.width = `${pct}%`;
        }
      }
    );
    setMainBoardAnalysis(result);
    // Share analysis results with peer
    if (sharedReviewActive) {
      mp.sendReviewAnalysis(result);
    }
  } catch (err) {
    if (err !== 'stopped') {
      console.warn('Analysis failed:', err);
    }
    replayProgressEl.classList.add('hidden');
    replayProgressFillEl.style.width = '0%';
  }
}

function setMainBoardAnalysis(result) {
  replayAnalysisData = result;

  // Hide progress bar
  replayProgressEl.classList.add('hidden');
  replayProgressFillEl.style.width = '0%';

  // Add classification icons to move list
  addClassificationIcons();

  // Render accuracy summary
  renderAccuracy();

  // Update critical moment nav
  updateCriticalNav();

  // Show detail and engine arrows for current move
  updateAnalysisDetail();
  updateEngineArrows();

  // Show and update eval bar (only if toggle is on)
  if (evalBarToggle && evalBarToggle.checked) {
    mainEvalBar.show();
  }
  updateMainEvalBar();

  // Show summary button
  if (replaySummaryBtn) replaySummaryBtn.classList.remove('hidden');
}

function addClassificationIcons() {
  if (!replayAnalysisData) return;

  const moveEls = replayMoveListEl.querySelectorAll('.strip-move[data-ply]');
  const criticalSet = new Set(replayAnalysisData.criticalMoments);

  moveEls.forEach(el => {
    const ply = parseInt(el.dataset.ply, 10);
    const posIdx = ply + 1; // positions[0] = starting, positions[ply+1] = after move
    if (posIdx >= replayAnalysisData.positions.length) return;

    const pos = replayAnalysisData.positions[posIdx];
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

function renderAccuracy() {
  if (!replayAnalysisData || !replayAccuracyEl) return;

  const summary = replayAnalysisData.summary;
  replayAccuracyEl.innerHTML = '';
  replayAccuracyEl.classList.remove('hidden');

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

    replayAccuracyEl.appendChild(div);
  }
}

function updateAnalysisDetail() {
  if (!replayAnalysisData || !replayDetailEl) {
    if (replayDetailEl) replayDetailEl.classList.add('hidden');
    return;
  }

  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) {
    replayDetailEl.classList.add('hidden');
    return;
  }

  const pos = replayAnalysisData.positions[posIdx];
  replayDetailEl.classList.remove('hidden');

  // Classification + cpLoss
  if (pos.classification) {
    const iconDef = CLASSIFICATION_ICONS[pos.classification] || {};
    replayClassEl.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = `analysis-icon ${iconDef.cls || ''}`;
    icon.textContent = iconDef.text || '';
    replayClassEl.appendChild(icon);
    const label = document.createElement('span');
    const classLabel = pos.classification.charAt(0).toUpperCase() + pos.classification.slice(1);
    label.textContent = ` ${classLabel}${pos.cpLoss > 0 ? ` (${pos.cpLoss}cp)` : ''}`;
    replayClassEl.appendChild(label);
  } else {
    replayClassEl.textContent = 'Starting position';
  }

  // Eval
  const evalPawns = pos.eval / 100;
  const evalSign = evalPawns >= 0 ? '+' : '';
  const evalDisplay = Math.abs(pos.eval) >= 9900
    ? (pos.eval > 0 ? '+M' : '-M')
    : `${evalSign}${evalPawns.toFixed(2)}`;
  replayEvalEl.textContent = `Eval: ${evalDisplay}`;

  // Best move
  if (pos.bestMoveUci) {
    replayBestEl.textContent = `Best: ${pos.bestMoveUci}`;
  } else {
    replayBestEl.textContent = '';
  }

  // PV line (first 5 moves)
  if (pos.bestLineUci && pos.bestLineUci.length > 0) {
    const line = pos.bestLineUci.slice(0, 5).join(' ');
    replayLineEl.textContent = `Line: ${line}`;
  } else {
    replayLineEl.textContent = '';
  }
}

function updateEngineArrows() {
  const overlay = board.getArrowOverlay();
  overlay.clearEngineArrows();

  if (!replayAnalysisData) return;
  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) return;

  const pos = replayAnalysisData.positions[posIdx];
  if (pos.bestMoveUci) {
    overlay.setEngineArrows(pos.bestMoveUci, pos.bestLineUci || []);
  }
}

function updateCriticalNav() {
  if (!replayAnalysisData || !replayAnalysisData.criticalMoments.length) {
    if (replayCritPrevBtn) replayCritPrevBtn.classList.add('hidden');
    if (replayCritNextBtn) replayCritNextBtn.classList.add('hidden');
    return;
  }

  replayCritPrevBtn.classList.remove('hidden');
  replayCritNextBtn.classList.remove('hidden');

  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;

  const prevCrit = moments.filter(m => m < curPos);
  const nextCrit = moments.filter(m => m > curPos);

  replayCritPrevBtn.disabled = prevCrit.length === 0;
  replayCritNextBtn.disabled = nextCrit.length === 0;
}

function goToPrevCritical() {
  if (!replayAnalysisData) return;
  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;
  const prev = moments.filter(m => m < curPos);
  if (prev.length > 0) {
    const targetPos = prev[prev.length - 1];
    stopReplayPlayback();
    replayGoToMove(targetPos - 1);
  }
}

function goToNextCritical() {
  if (!replayAnalysisData) return;
  const moments = replayAnalysisData.criticalMoments;
  const curPos = replayPly + 1;
  const next = moments.filter(m => m > curPos);
  if (next.length > 0) {
    const targetPos = next[0];
    stopReplayPlayback();
    replayGoToMove(targetPos - 1);
  }
}

function resetMainBoardAnalysis() {
  replayAnalysisData = null;

  // Hide progress
  if (replayProgressEl) {
    replayProgressEl.classList.add('hidden');
    replayProgressFillEl.style.width = '0%';
  }
  // Hide detail panel
  if (replayDetailEl) {
    replayDetailEl.classList.add('hidden');
  }
  // Hide accuracy panel
  if (replayAccuracyEl) {
    replayAccuracyEl.classList.add('hidden');
    replayAccuracyEl.innerHTML = '';
  }
  // Hide critical nav
  if (replayCritPrevBtn) replayCritPrevBtn.classList.add('hidden');
  if (replayCritNextBtn) replayCritNextBtn.classList.add('hidden');
  // Hide eval bar
  mainEvalBar.hide();
  mainEvalBar.reset();
  // Hide summary button
  if (replaySummaryBtn) replaySummaryBtn.classList.add('hidden');

  // Remove classification icons and critical markers
  replayMoveListEl.querySelectorAll('.analysis-icon').forEach(el => el.remove());
  replayMoveListEl.querySelectorAll('.analysis-critical').forEach(el => {
    el.classList.remove('analysis-critical');
  });
}

function updateMainEvalBar() {
  if (!replayAnalysisData) return;
  const posIdx = replayPly + 1;
  if (posIdx < 0 || posIdx >= replayAnalysisData.positions.length) return;
  mainEvalBar.update(replayAnalysisData.positions[posIdx].eval);
}

// --- Live Move Bar (persistent move list during live games) ---

function activateLiveMoveBar() {
  if (liveMoveBarEl) liveMoveBarEl.classList.remove('faded');
}

function fadeLiveMoveBar() {
  if (liveMoveBarEl) liveMoveBarEl.classList.add('faded');
}

function resetLiveMoveBar() {
  if (liveMoveBarEl) liveMoveBarEl.classList.add('faded');
  if (liveMoveListEl) liveMoveListEl.innerHTML = '';
  updateLiveMoveBarButtons();
}

/** Append a move to the persistent live move list */
function appendLiveMove(san, side, plyIndex) {
  if (!liveMoveListEl) return;
  const moveNum = Math.floor(plyIndex / 2) + 1;
  const isWhite = side === 'w';

  if (isWhite) {
    const numEl = document.createElement('span');
    numEl.className = 'strip-move-num';
    numEl.textContent = `${moveNum}.`;
    liveMoveListEl.appendChild(numEl);
  }

  const moveEl = document.createElement('span');
  moveEl.className = 'strip-move';
  moveEl.textContent = san;
  moveEl.dataset.ply = plyIndex;
  moveEl.addEventListener('click', () => {
    const ply = parseInt(moveEl.dataset.ply, 10);
    if (isLiveReview) {
      liveReviewGoToMove(ply);
    } else {
      // Clicking a past move enters live review at that ply
      enterLiveReview(ply);
    }
  });
  liveMoveListEl.appendChild(moveEl);

  // Auto-scroll to the latest move
  liveMoveListEl.scrollLeft = liveMoveListEl.scrollWidth;
}

function updateLiveMoveBarButtons() {
  if (!liveStartBtn) return;

  if (isLiveReview) {
    const atStart = liveReviewPly === -1;
    const atEnd = liveReviewPly >= liveReviewMoves.length - 1;
    liveStartBtn.disabled = atStart;
    livePrevBtn.disabled = atStart;
    liveNextBtn.disabled = atEnd;
    liveEndBtn.disabled = false;
  } else {
    // Not reviewing — back buttons enabled if moves exist, forward disabled
    liveStartBtn.disabled = moveCount === 0;
    livePrevBtn.disabled = moveCount === 0;
    liveNextBtn.disabled = true;
    liveEndBtn.disabled = true;
  }
}

function highlightLiveMoveBarPly(plyIndex) {
  if (!liveMoveListEl) return;
  liveMoveListEl.querySelectorAll('.strip-move-active').forEach(el => {
    el.classList.remove('strip-move-active');
  });

  if (plyIndex >= 0) {
    const el = liveMoveListEl.querySelector(`.strip-move[data-ply="${plyIndex}"]`);
    if (el) {
      el.classList.add('strip-move-active');
      el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  } else {
    liveMoveListEl.scrollLeft = 0;
  }
}

// --- Live Review (review past moves during a live game) ---

function enterLiveReview(targetPly) {
  if (isLiveReview || isReplayMode || moveCount === 0 || game.isGameOver()) return;

  isLiveReview = true;
  liveReviewPendingMoves = [];

  // Save the starting FEN (before any moves)
  const history = game.chess.history({ verbose: true });
  liveReviewStartingFen = history.length > 0 ? history[0].before : game.chess.fen();

  // Save full game state via PGN for later restoration
  liveReviewSavedPgn = game.chess.pgn();

  // Build move details from chess.js history
  liveReviewMoves = history.map(m => ({
    san: m.san,
    fen: m.after,
    from: m.from,
    to: m.to,
    side: m.color,
  }));

  // Stop AI (will re-trigger on exit)
  ai.stop();

  // Clear premoves (board position will change)
  board.clearPremove();

  // Disable board interaction
  board.setInteractive(false);
  boardEl.classList.add('live-review-border');

  // Navigate to the target ply (default: one before latest)
  const ply = targetPly !== undefined ? targetPly : liveReviewMoves.length - 2;
  liveReviewPly = liveReviewMoves.length - 1;
  liveReviewGoToMove(ply);

  // Register keyboard handler
  document.addEventListener('keydown', liveReviewKeyHandler);
}

function exitLiveReview() {
  if (!isLiveReview) return;

  isLiveReview = false;

  // Remove keyboard handler
  document.removeEventListener('keydown', liveReviewKeyHandler);

  // Restore game state from saved PGN
  game.chess.loadPgn(liveReviewSavedPgn);

  // Apply any buffered opponent moves
  for (const pending of liveReviewPendingMoves) {
    game.makeMoveSan(pending.san);
    if (pending.clocks && timer.isEnabled()) {
      timer.setTime('w', pending.clocks.w);
      timer.setTime('b', pending.clocks.b);
    }
  }
  liveReviewPendingMoves = [];

  // Clear review state
  liveReviewMoves = [];
  liveReviewPly = -1;
  liveReviewStartingFen = null;
  liveReviewSavedPgn = null;

  // Re-enable board
  board.setInteractive(true);
  boardEl.classList.remove('live-review-border');

  // Update live move bar — clear highlight, update buttons, hide LIVE badge
  highlightLiveMoveBarPly(-1);
  updateLiveMoveBarButtons();

  // Clear arrows
  board.getArrowOverlay().clear();

  // Render the restored position
  board.render();
  renderCaptured();

  // Restore normal status
  updateStatus();

  // Resume eval bar
  if (evalBarToggle && evalBarToggle.checked) liveEval();

  // For multiplayer, check if it's our turn and update board interactivity
  if (mp.isActive()) {
    const isMyTurn = game.getTurn() === mp.color;
    board.setInteractive(isMyTurn);
    if (isMyTurn) {
      updateStatus('Your turn');
    } else {
      updateStatus("Opponent's turn");
    }
    // Check for game over after applying buffered moves
    if (game.isGameOver()) {
      board.setInteractive(false);
      newGameBtn.classList.add('game-ended');
      updateStatus();
    }
  } else {
    // Local game — re-trigger AI if needed
    triggerAIMove();
  }
}

function liveReviewGoToMove(plyIndex) {
  if (!isLiveReview) return;
  const maxPly = liveReviewMoves.length - 1;
  liveReviewPly = Math.max(-1, Math.min(plyIndex, maxPly));

  if (liveReviewPly === -1) {
    game.chess.load(liveReviewStartingFen);
    game._lastMove = null;
  } else {
    const detail = liveReviewMoves[liveReviewPly];
    game.chess.load(detail.fen);
    game._lastMove = { from: detail.from, to: detail.to };
  }

  board.render();
  highlightLiveMoveBarPly(liveReviewPly);
  updateLiveMoveBarButtons();

  // Update status
  if (liveReviewPly === -1) {
    statusEl.textContent = 'Reviewing \u2014 Starting Position';
  } else {
    const moveNum = Math.floor(liveReviewPly / 2) + 1;
    const side = liveReviewMoves[liveReviewPly].side === 'w' ? '' : '...';
    statusEl.textContent = `Reviewing \u2014 ${moveNum}${side} ${liveReviewMoves[liveReviewPly].san}`;
  }
  statusEl.className = 'status live-review';

  // Update eval bar for the reviewed position
  if (evalBarToggle && evalBarToggle.checked) liveEval();

  // Auto-exit when at the latest move and no pending moves
  if (liveReviewPly === maxPly && liveReviewPendingMoves.length === 0) {
    exitLiveReview();
  }
}

function liveReviewNext() {
  if (!isLiveReview) return;
  liveReviewGoToMove(liveReviewPly + 1);
}

function liveReviewPrev() {
  if (!isLiveReview) return;
  liveReviewGoToMove(liveReviewPly - 1);
}

function liveReviewGoToStart() {
  if (!isLiveReview) return;
  liveReviewGoToMove(-1);
}

function liveReviewGoToEnd() {
  if (!isLiveReview) return;
  // Go to end = exit review (return to live position)
  exitLiveReview();
}

function liveReviewKeyHandler(e) {
  if (!isLiveReview) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      liveReviewPrev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      liveReviewNext();
      break;
    case 'Escape':
      e.preventDefault();
      exitLiveReview();
      break;
    case 'Home':
      e.preventDefault();
      liveReviewGoToStart();
      break;
    case 'End':
      e.preventDefault();
      liveReviewGoToEnd();
      break;
  }
}

// Global keydown listener for entering live review via arrow key
document.addEventListener('keydown', (e) => {
  if (isLiveReview || isReplayMode) return;
  if (e.key === 'ArrowLeft' && moveCount > 0 && !game.isGameOver()) {
    e.preventDefault();
    enterLiveReview();
  }
});

// --- Replay Keyboard Handler ---

function replayKeyHandler(e) {
  if (!isReplayMode) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      replayPrev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      replayNext();
      break;
    case ' ':
      e.preventDefault();
      toggleReplayPlayback();
      break;
    case 'Home':
      e.preventDefault();
      replayGoToStart();
      break;
    case 'End':
      e.preventDefault();
      replayGoToEnd();
      break;
  }
}

// Wire up replay/live-review control buttons (dispatch based on active mode)
replayStartBtn.addEventListener('click', replayGoToStart);
replayPrevBtn.addEventListener('click', replayPrev);
replayPlayBtn.addEventListener('click', toggleReplayPlayback);
replayNextBtn.addEventListener('click', replayNext);
replayEndBtn.addEventListener('click', replayGoToEnd);

// Wire up live move bar buttons (persistent bar during live games)
if (liveStartBtn) liveStartBtn.addEventListener('click', () => {
  if (isLiveReview) liveReviewGoToStart();
  else if (moveCount > 0 && !game.isGameOver()) enterLiveReview(0);
});
if (livePrevBtn) livePrevBtn.addEventListener('click', () => {
  if (isLiveReview) liveReviewPrev();
  else if (moveCount > 0 && !game.isGameOver()) enterLiveReview();
});
if (liveNextBtn) liveNextBtn.addEventListener('click', () => {
  if (isLiveReview) liveReviewNext();
});
if (liveEndBtn) liveEndBtn.addEventListener('click', () => {
  if (isLiveReview) exitLiveReview();
});

// Wire up analysis toggle and critical nav buttons
if (replayAnalyzeCheckbox) {
  replayAnalyzeCheckbox.addEventListener('change', () => {
    const enabled = replayAnalyzeCheckbox.checked;
    localStorage.setItem('chess-auto-analyze', enabled ? 'true' : 'false');
    if (enabled) {
      if (isReplayMode && replayGame && !replayAnalysisData) {
        runMainBoardAnalysis(replayGame);
      }
    } else {
      if (replayAnalysisEngine) replayAnalysisEngine.stop();
      resetMainBoardAnalysis();
    }
  });
}
if (replayCritPrevBtn) replayCritPrevBtn.addEventListener('click', goToPrevCritical);
if (replayCritNextBtn) replayCritNextBtn.addEventListener('click', goToNextCritical);

// Wire up post-game summary callback on the full-screen replay viewer
replayViewer.setSummaryCallback((gameRecord, analysisData) => {
  if (!postGameAnalysisEngine) {
    postGameAnalysisEngine = new AnalysisEngine();
  }

  const callbacks = {
    onReview: () => {},  // Already in replay, no action needed
    onNewGame: () => { replayViewer.close(); startNewGame(); },
    onClose: () => {},
  };

  postGameSummary.setCallbacks(callbacks);

  if (analysisData) {
    postGameSummary.show(gameRecord, analysisData);
  } else {
    postGameSummary.showWithAnalysis(
      gameRecord,
      postGameAnalysisEngine,
      gameRecord.serverId || null,
      callbacks
    );
  }
});

// Wire up main-board replay summary button
if (replaySummaryBtn) {
  replaySummaryBtn.addEventListener('click', () => {
    if (!isReplayMode || !replayGame) return;

    if (!postGameAnalysisEngine) {
      postGameAnalysisEngine = new AnalysisEngine();
    }

    const callbacks = {
      onReview: () => {},  // Already in replay mode
      onNewGame: () => startNewGame(),
      onClose: () => {},
    };

    postGameSummary.setCallbacks(callbacks);

    if (replayAnalysisData) {
      postGameSummary.show(replayGame, { summary: replayAnalysisData.summary });
    } else {
      postGameSummary.showWithAnalysis(
        replayGame,
        postGameAnalysisEngine,
        replayGame.serverId || null,
        callbacks
      );
    }
  });
}

// Dev indicator management
const devIndicator = document.getElementById('dev-indicator');
const DEV_MODE_KEY = 'chess-dev-mode';

function checkDevMode() {
  const devMode = localStorage.getItem(DEV_MODE_KEY);
  if (devMode === 'true') {
    devIndicator.classList.remove('hidden');
  } else {
    devIndicator.classList.add('hidden');
  }
}

// Check on load
checkDevMode();

// Poll for changes every 500ms
setInterval(checkDevMode, 500);

// --- Engine Selection Persistence ---

const LS_ENGINE_KEY = 'chess-engine-selection';

/** Populate engine dropdowns from the registry. */
function populateEngineDropdowns() {
  const engines = getAllEngines();
  for (const select of [aiWhiteEngineSelect, aiBlackEngineSelect]) {
    select.innerHTML = '';
    for (const eng of engines) {
      const opt = document.createElement('option');
      opt.value = eng.id;
      opt.textContent = `${eng.icon} ${eng.name}`;
      select.appendChild(opt);
    }
  }
}

function saveEngineSelection() {
  localStorage.setItem(LS_ENGINE_KEY, JSON.stringify({
    white: aiWhiteEngineSelect.value,
    black: aiBlackEngineSelect.value,
  }));
}

function loadEngineSelection() {
  try {
    const raw = localStorage.getItem(LS_ENGINE_KEY);
    if (raw) {
      const { white, black } = JSON.parse(raw);
      if (white && getEngineInfo(white)) aiWhiteEngineSelect.value = white;
      if (black && getEngineInfo(black)) aiBlackEngineSelect.value = black;
    }
  } catch { /* ignore */ }
}

// Populate dropdowns, restore saved selection, sync ELO ranges
populateEngineDropdowns();
loadEngineSelection();
updateEloSliderRange('w');
updateEloSliderRange('b');

// --- Multiplayer wiring ---

// When the server says a game has started
mp.onGameStart = async (payload) => {
  lastMultiplayerGameRecord = null;
  diagnostics.setContext(payload.dbGameId, payload.roomId);
  activeCamMode = (mpUI.inlineCamBtn ? mpUI.getCamMode() : null)
    ?? payload.camMode
    ?? (payload.videoEnabled ? 'board-face' : 'none');
  diagnostics.record('lifecycle', 'game_start', {
    color: payload.color,
    camMode: activeCamMode,
    timeControl: payload.timeControl,
  });
  issueReporter.hideLobbyButton();
  issueReporter.hideWaitingButton();
  issueReporter.setGameContext(payload.dbGameId, mp.sessionId, !!payload.videoEnabled);
  issueReporter.showButton();

  // Hide lobby panel and restore header; re-enable board tints for gameplay
  mpUI.hideLobbyPanel();
  boardEl.classList.remove('lobby-active');
  if (videoBoard.isActive()) {
    videoBoard.setTintEnabled(true);
  }
  if (splitCam.isActive()) {
    splitCam.setTintEnabled(true);
  }

  // Reconcile cam mode: video_start fires in the lobby before game starts,
  // so the cam mode may have changed after video_start but before game_start.
  // If the active cam mode doesn't match, disable the wrong one and re-enable correctly.
  if (videoActive && mp.color) {
    const needsSplitCam = activeCamMode === 'split-cam' && !splitCam.isActive();
    const needsKingCam = activeCamMode === 'king-cam' && !kingCam.isActive();
    const needsBoardFace = activeCamMode === 'board-face' && !videoBoard.isActive();
    const needsNone = activeCamMode === 'none' &&
      (videoBoard.isActive() || splitCam.isActive() || kingCam.isActive());

    if (needsSplitCam || needsKingCam || needsBoardFace || needsNone) {
      videoBoard.disable();
      splitCam.disable();
      kingCam.disable();
      const opponentColor = mp.color === 'w' ? 'b' : 'w';
      if (activeCamMode === 'split-cam') {
        splitCam.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
        splitCam.setTintEnabled(true);
      } else if (activeCamMode === 'king-cam') {
        kingCam.enable(videoChat._localStream, mp.color, videoChat._remoteStream);
        board.render();
      } else if (activeCamMode === 'board-face') {
        videoBoard.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
        videoBoard.setTintEnabled(true);
      }
    }
  }

  startMultiplayerGame(payload.color, payload.fen, payload.timeControl, payload.opponentName, payload.chess960);

  // If a camera mode is active, request camera (skip if already started in lobby)
  if (activeCamMode !== 'none' && !videoChat.hasLocalStream()) {
    try {
      const stream = await videoChat.requestCamera();
      videoUI.showCameraPreview(stream);
    } catch (e) {
      videoUI.showError(e.message || 'Camera access failed.');
    }
  }
};

// Room created — show waiting screen (lobby panel in waiting mode)
mp.onRoomCreated = (payload) => {
  mpUI.showWaiting(payload.roomId);
  issueReporter.setGameContext(null, mp.sessionId, false);
  issueReporter.showWaitingButton();
};

// Lobby joined — show pre-game settings inline below board
mp.onLobbyJoined = async (payload) => {
  multiplayerActive = true;
  issueReporter.hideWaitingButton();
  mpUI.showLobby(payload);
  issueReporter.setGameContext(null, mp.sessionId, false);
  issueReporter.showLobbyButton();

  // Always add lobby-active: fades pieces to 30% and locks interaction until game starts
  boardEl.classList.add('lobby-active');

  // Initialize board with starting position for lobby preview
  // (startNewGame() won't run because multiplayerActive is true, so render directly)
  game.newGame(!!payload.settings?.chess960);
  board.getArrowOverlay().clear();
  // Flip board to player's color so name elements are in correct visual positions
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  board.render();

  // Orient board to player's color and configure timer for lobby preview
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  configureLobbyTimer(payload.settings?.timeControl);

  // Start camera for video-enabled rooms — request access and signal ready.
  // Board tints are suppressed by CSS (.board.lobby-active) until game starts.
  // onVideoStart handles videoBoard.enable() once both players are ready.
  if (payload.settings?.videoEnabled) {
    activeCamMode = payload.settings?.camMode ?? 'board-face';
    try {
      await videoChat.requestCamera(); // sets _localStream, fires onLocalStream
      videoChat.fetchIceServers();     // pre-fetch to reduce WebRTC delay
      mp.sendVideoReady();
    } catch (e) {
      videoUI.showError(e.message || 'Camera access failed.');
    }
  }
};

// Setting changed (applied immediately, no approval needed)
mp.onSettingChanged = (payload) => {
  mpUI.showSettingChanged(payload);

  // Keep mp.color in sync (server sends current color in every setting_changed)
  mp.color = payload.color;

  // Flip board to match new color assignment and update timer display
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  configureLobbyTimer(payload.settings?.timeControl);

  // Reset board position when variant changes
  if (payload.field === 'chess960') {
    game.newGame(!!payload.settings?.chess960);
    board.getArrowOverlay().clear();
    board.render();
  }

  // Sync cam mode when the other player changes it
  if (payload.field === 'camMode' && payload.settings?.camMode !== undefined) {
    activeCamMode = payload.settings.camMode;
    mpUI.syncCamMode(payload.settings.camMode);
    applyCamMode(payload.settings.camMode);
  }
};

// Ready state update
mp.onReadyState = (payload) => {
  mpUI.updateReadyState(payload);
};

// Queue joined
mp.onQueueJoined = (payload) => {
  mpUI.showSearching();
};

// Opponent made a move
mp.onOpponentMove = (payload) => {
  const { san, fen, clocks } = payload;
  multiplayerMoveTimes.push(Date.now());

  // If in live review, buffer the move instead of applying immediately
  if (isLiveReview) {
    liveReviewPendingMoves.push(payload);
    moveCount++;

    // Compute the FEN for this move using a scratch chess instance
    const lastFen = liveReviewMoves.length > 0
      ? liveReviewMoves[liveReviewMoves.length - 1].fen
      : liveReviewStartingFen;
    const scratch = new Chess(lastFen);
    const result = scratch.move(san);

    if (result) {
      liveReviewMoves.push({
        san,
        fen: scratch.fen(),
        from: result.from,
        to: result.to,
        side: result.color,
      });

      // Append to the live move bar UI
      const idx = liveReviewMoves.length - 1;
      appendLiveMove(san, result.color, idx);
      updateLiveMoveBarButtons();

      // Save opponent's move to local database even during live review
      if (currentDbGameId) {
        db.addMove(currentDbGameId, {
          ply: moveCount - 1,
          san,
          fen: scratch.fen(),
          timestamp: Date.now(),
          side: result.color,
        });
      }
    }

    // Sync clocks even during review
    if (clocks && timer.isEnabled()) {
      timer.setTime('w', clocks.w);
      timer.setTime('b', clocks.b);
    }
    return;
  }

  // Apply the opponent's move to local game state
  game.makeMoveSan(san);
  moveCount++;
  board.render();
  renderCaptured();

  // Update the persistent live move bar
  const opponentSide = game.getTurn() === 'w' ? 'b' : 'w';
  appendLiveMove(san, opponentSide, moveCount - 1);
  if (moveCount === 1) activateLiveMoveBar();
  updateLiveMoveBarButtons();

  // Save opponent's move to local database
  if (currentDbGameId) {
    db.addMove(currentDbGameId, {
      ply: moveCount - 1,
      san,
      fen: game.chess.fen(),
      timestamp: Date.now(),
      side: opponentSide,
    });
  }

  // Disable pre-game state
  if (moveCount === 1) {
    appEl.classList.remove('pre-game');
    closeAllPopups();
  }

  // Sync clocks from server
  if (clocks && timer.isEnabled()) {
    timer.setTime('w', clocks.w);
    timer.setTime('b', clocks.b);
    const currentTurn = game.getTurn();
    if (moveCount === 1) {
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  // Update eval bar
  if (evalBarToggle && evalBarToggle.checked) liveEval();

  // Check for game over
  if (game.isGameOver()) {
    board.clearPremove();
    fadeLiveMoveBar();
    newGameBtn.classList.add('game-ended');
    board.setInteractive(false);
    updateStatus();
    return;
  }

  // Enable board for our turn
  board.setInteractive(true);
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  updateStatus('Your turn');

  // Execute premove if queued
  if (board.getPremove()) {
    setTimeout(() => board.executePremove(), 50);
  }
};

// Our move acknowledged with clock sync
mp.onMoveAck = (payload) => {
  if (payload.clocks && timer.isEnabled()) {
    timer.setTime('w', payload.clocks.w);
    timer.setTime('b', payload.clocks.b);
  }
};

// Opponent changed their name
mp.onNameChange = (payload) => {
  const opponentNameEl = mp.color === 'w' ? playerNameBlack : playerNameWhite;
  opponentNameEl.textContent = payload.name || 'Opponent';
};

// Game ended (from server — timeout, resignation, draw, checkmate)
mp.onGameEnd = (payload) => {
  diagnostics.record('lifecycle', 'game_end', {
    result: payload.result,
    reason: payload.reason,
  });
  diagnostics.flush();
  if (isLiveReview) exitLiveReview();
  fadeLiveMoveBar();
  multiplayerActive = false;
  playerNameWhite.classList.remove('multiplayer-opponent');
  playerNameBlack.classList.remove('multiplayer-opponent');
  timer.stop();
  board.clearPremove();
  board.setInteractive(false);
  newGameBtn.classList.add('game-ended');

  const { result, reason } = payload;

  // Persist game result to local database
  if (currentDbGameId) {
    db.endGame(currentDbGameId, result, reason);
  }

  let statusText;
  if (result === '1/2-1/2') {
    statusText = `Draw — ${reason}`;
  } else {
    const winnerSide = result === '1-0' ? 'w' : 'b';
    const iWin = mp.color === winnerSide;
    statusText = iWin ? `You win! (${reason})` : `You lose (${reason})`;
  }
  updateStatus(statusText);
  mpUI.hideGameControls();
  mpUI.showRematchControls();

  // Trigger post-game summary with analysis
  let record = null;
  try {
    record = buildMultiplayerGameRecord(result, reason);
  } catch (e) {
    console.error('buildMultiplayerGameRecord failed:', e);
  }
  lastMultiplayerGameRecord = record;
  if (record) {
    if (!postGameAnalysisEngine) {
      postGameAnalysisEngine = new AnalysisEngine();
    }
    postGameSummary.addActionButton(issueReporter.createPostGameFlagButton());
    postGameSummary.showWithAnalysis(
      record,
      postGameAnalysisEngine,
      null,
      {
        onReview: (rec) => enterReplayMode(rec),
        onNewGame: () => { multiplayerActive = false; startNewGame(); },
        onClose: () => {},
      }
    );
  }

  // Video stays active after game end — players can continue chatting
  // Video is stopped when either player clicks "End Call" or room expires
};

// Draw offered by opponent
mp.onDrawOffered = () => {
  mpUI.showDrawOffer();
};

// Draw declined
mp.onDrawDeclined = () => {
  mpUI.hideDrawOffer();
  updateStatus("Draw declined — your turn");
};

// Rematch offered
mp.onRematchOffered = () => {
  mpUI.showRematchOffer();
};

// Rematch declined
mp.onRematchDeclined = () => {
  mpUI.rematchStatus.textContent = 'Rematch declined';
};

// Rematch starting
mp.onRematchStart = async (payload) => {
  diagnostics.setContext(payload.dbGameId, payload.roomId);
  diagnostics.record('lifecycle', 'rematch_start', { color: payload.color });
  issueReporter.setGameContext(payload.dbGameId, mp.sessionId, videoActive);
  issueReporter.showButton();
  mpUI.hideGameControls();
  startMultiplayerGame(payload.color, payload.fen, payload.timeControl, payload.opponentName, payload.chess960);

  // Handle video board for the new game.
  // Colors swap on rematch so _playerColor must be updated, and streams must
  // be reassigned to the correct light/dark squares for the new color.
  if (videoBoard.isActive()) {
    // WebRTC connection still live — reset board with new player color.
    videoBoard.reset(videoChat._localStream, videoChat._remoteStream, payload.color);
  } else if (splitCam.isActive()) {
    // Split cam — disable and re-enable with new player color.
    splitCam.disable();
    splitCam.enable(videoChat._localStream, videoChat._remoteStream, payload.color);
  } else if (payload.videoEnabled && !videoActive) {
    // Video was configured for this room but the connection dropped — re-request
    // camera and signal readiness so the server can re-initiate WebRTC.
    try {
      const stream = await videoChat.requestCamera();
      videoUI.showCameraPreview(stream);
    } catch (e) {
      videoUI.showError(e.message || 'Camera access failed on rematch.');
    }
  }
};

// Reconnection
mp.onReconnect = async (payload) => {
  diagnostics.setContext(payload.dbGameId, payload.roomId);
  diagnostics.record('lifecycle', 'reconnected', { color: payload.color });
  // Use startingFen (null = standard) so the board starts at the correct initial position
  // before replaying moves. Using payload.fen (current state) would cause "Invalid move"
  // errors because moves would be applied on top of an already-advanced board.
  startMultiplayerGame(payload.color, payload.startingFen || null, payload.timeControl, payload.opponentName, payload.chess960);

  // Replay all moves to restore game state and populate the move strip
  if (payload.moves && payload.moves.length > 0) {
    const scratch = new Chess(payload.startingFen || undefined);
    for (const san of payload.moves) {
      const result = scratch.move(san);
      if (!result) break;
      game.makeMoveSan(san);
      moveCount++;
      appendLiveMove(san, result.color, moveCount - 1);
      liveReviewMoves.push({ san, fen: scratch.fen(), from: result.from, to: result.to, side: result.color });

      // Record replayed move to local database
      if (currentDbGameId) {
        db.addMove(currentDbGameId, {
          ply: moveCount - 1,
          san,
          fen: scratch.fen(),
          timestamp: Date.now(),
          side: result.color,
        });
      }
    }
    activateLiveMoveBar();
    updateLiveMoveBarButtons();
    appEl.classList.remove('pre-game');
  }
  board.render();
  renderCaptured();

  // Sync clocks
  if (payload.clocks && timer.isEnabled()) {
    timer.setTime('w', payload.clocks.w);
    timer.setTime('b', payload.clocks.b);
    timer.start(game.getTurn());
  }

  const isMyTurn = mp.isMyTurn(game.getTurn());
  board.setInteractive(isMyTurn);
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  updateStatus(isMyTurn ? 'Your turn (reconnected)' : "Opponent's turn (reconnected)");
  mpUI.setConnectionStatus('connected');

  // Re-establish video if it was a video game
  const reconnectCamMode = payload.camMode ?? (payload.videoEnabled ? 'board-face' : 'none');
  if (reconnectCamMode !== 'none' && !videoActive) {
    try {
      await videoChat.requestCamera();
      mp.sendVideoReady();
    } catch (e) {
      videoUI.showError(e.message || 'Camera access failed on reconnect.');
    }
  }
};

// Opponent disconnected
mp.onOpponentDisconnected = (payload) => {
  diagnostics.record('lifecycle', 'opponent_disconnected', { timeout: payload.timeout });
  mpUI.setConnectionStatus('opponent-disconnected');
  updateStatus(`Opponent disconnected — ${payload.timeout}s to reconnect`);
};

// Opponent reconnected
mp.onOpponentReconnected = () => {
  mpUI.setConnectionStatus('connected');
  const isMyTurn = mp.isMyTurn(game.getTurn());
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, parseInt(boardTintSlider.value, 10) / 100);
  }
  updateStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
};

// Connection status
mp.onConnected = (payload) => {
  diagnostics.record('network', 'ws_connected', { inRoom: payload?.inRoom });
  if (payload && payload.inRoom) {
    mpUI.setConnectionStatus('connected');
  } else if (mp.isActive()) {
    if (mp.roomId) {
      // Server didn't auto-reconnect us — try manually re-joining
      mpUI.setConnectionStatus('reconnecting', 'Re-joining game...');
      mp.joinRoom(mp.roomId, null);
      // If joinRoom succeeds, onReconnect fires. If it fails, onError fires.
    } else {
      // No room to rejoin — game is over
      mpUI.setConnectionStatus('connection-lost');
      multiplayerActive = false;
      mp.active = false;
      updateStatus('Game ended — connection to room was lost');
    }
  } else {
    mpUI.setConnectionStatus('connected');
  }
};

mp.onDisconnected = () => {
  diagnostics.record('network', 'ws_disconnected', {});
  if (mp.isActive()) {
    mpUI.setConnectionStatus('reconnecting');
  }
};

mp.onReconnecting = (attempt, maxAttempts) => {
  mpUI.setConnectionStatus('reconnecting', `Reconnecting... (${attempt}/${maxAttempts})`);
};

mp.onConnectionLost = () => {
  mpUI.setConnectionStatus('connection-lost');
  multiplayerActive = false;
  issueReporter.recordError();
  updateStatus('Connection lost — game may have ended');
};

mp.onError = (msg) => {
  console.warn('Multiplayer error:', msg);
  issueReporter.recordError();
  // "Not in a room" during active game is handled by multiplayer.js (triggers reconnect)
  // Don't show alerts or reset state during shared post-game review
  if (!mp.isActive() && !sharedReviewActive) {
    multiplayerActive = false;
    alert(msg || 'Multiplayer error. Please try again.');
  }
};

// --- Video Chat wiring ---

// WebRTC signaling relayed from opponent
mp.onRtcOffer = (payload) => videoChat.handleOffer(payload.sdp);
mp.onRtcAnswer = (payload) => videoChat.handleAnswer(payload.sdp);
mp.onRtcIce = (payload) => videoChat.handleIceCandidate(payload.candidate);

// Server says both players have cameras ready — start WebRTC handshake
mp.onVideoStart = async (payload) => {
  try {
    if (!videoChat.hasIceServers()) {
      await videoChat.fetchIceServers();
    }
    await videoChat.startCall(payload.initiator);
    videoActive = true;
    if (mp.color) {
      if (activeCamMode === 'king-cam') {
        // Enable king cam — face appears on king pieces
        kingCam.enable(videoChat._localStream, mp.color, null);
        if (videoChat._remoteStream) {
          const opponentColor = mp.color === 'w' ? 'b' : 'w';
          kingCam.updateRemoteStream(videoChat._remoteStream, opponentColor);
        }
        board.render();
      } else if (activeCamMode === 'split-cam') {
        // Split cam — left half = white, right half = black
        splitCam.enable(videoChat._localStream, null, mp.color);
        if (videoChat._remoteStream) {
          splitCam.updateRemoteStream(videoChat._remoteStream, mp.color);
        }
      } else {
        // Default: board-face mode — camera fills board squares
        videoBoard.enable(videoChat._localStream, null, mp.color);
        // Race condition fix: apply remote stream if it arrived before enable()
        if (videoChat._remoteStream) {
          videoBoard.updateRemoteStream(videoChat._remoteStream, mp.color);
        }
      }
    } else {
      // Fallback: show floating popup only when board mode is unavailable
      videoUI.show();
    }
  } catch (e) {
    videoUI.showError('Video connection failed: ' + e.message);
  }
};

mp.onVideoPeerReady = () => {
  // Opponent's camera is ready — UI hint (optional)
};

// VideoBoard: send the canvas-cropped stream over WebRTC instead of the raw feed.
// Face tracking runs locally only — the remote peer receives a pre-cropped stream
// and doesn't need to run face detection on it.
videoBoard.onCroppedStreamReady = (canvasStream) => {
  videoChat.replaceVideoTrack(canvasStream.getVideoTracks()[0]);
};

// VideoChat events
videoChat.onLocalStream = (stream) => {
  videoUI.setLocalStream(stream);
  if (mp.color) {
    videoBoard.updateLocalStream(stream, mp.color);
  }
};
videoChat.onRemoteStream = (stream) => {
  videoUI.setRemoteStream(stream);
  if (mp.color) {
    const opponentColor = mp.color === 'w' ? 'b' : 'w';
    videoBoard.updateRemoteStream(stream, mp.color);
    if (kingCam.isActive()) {
      kingCam.updateRemoteStream(stream, opponentColor);
      board.render();
    }
    if (splitCam.isActive()) {
      splitCam.updateRemoteStream(stream, mp.color);
    }
  }
};
videoChat.onDisconnected = () => { videoUI.showError('Video disconnected'); issueReporter.recordError(); };
videoChat.onError = (msg) => { videoUI.showError(msg); issueReporter.recordError(); };

// VideoUI events
videoUI.onPreviewConfirm = () => {
  // Pre-fetch ICE servers while waiting for opponent to confirm camera
  videoChat.fetchIceServers();
  mp.sendVideoReady();
};

videoUI.onPreviewCancel = () => {
  // User cancelled — stop camera, don't send video_ready
  videoChat.stop();
};

videoUI.onEndCall = () => {
  mp.sendVideoEnd();
  videoChat.stop();
  videoUI.hide();
  videoBoard.disable();
  if (kingCam.isActive()) { kingCam.disable(); board.render(); }
  splitCam.disable();
  videoActive = false;
  activeCamMode = 'none';
};

mp.onVideoEnded = () => {
  videoChat.stop();
  videoUI.hide();
  videoBoard.disable();
  if (kingCam.isActive()) { kingCam.disable(); board.render(); }
  splitCam.disable();
  videoActive = false;
  activeCamMode = 'none';
};

// --- Shared Post-Game Review ---

let sharedReviewActive = false;
let isRemoteNavigation = false;
let peerInReview = false;
let peerAnalysisRunning = false;
let lastMultiplayerGameRecord = null;

// Board arrow callbacks — broadcast to peer during shared review
board.onUserArrowDrawn = (from, to, action) => {
  if (sharedReviewActive) {
    mp.sendReviewArrow(action || 'add', from, to);
  }
};

board.onUserHighlightToggled = (square) => {
  // Highlights are local-only for now
};

// Incoming peer arrows
mp.onReviewArrow = (payload) => {
  const { action, from, to, side } = payload;
  const overlay = board.getArrowOverlay();
  if (action === 'add') {
    overlay.addPeerArrow(from, to, side);
  } else if (action === 'remove') {
    overlay.removePeerArrow(from, to, side);
  }
};

mp.onReviewClearArrows = (payload) => {
  board.getArrowOverlay().clearPeerAnnotations(payload.side);
};

// Peer entered/exited review
mp.onReviewEntered = (payload) => {
  peerInReview = true;
  // Auto-enter review if peer started it and we're not already in replay
  if (!isReplayMode && lastMultiplayerGameRecord) {
    enterReplayMode(lastMultiplayerGameRecord);
  }
  // Share any existing analysis with the newly joined peer.
  // Cached analysis runs synchronously before sharedReviewActive is set,
  // so it cannot be shared at analysis time — share it here instead.
  if (sharedReviewActive && replayAnalysisData) {
    mp.sendReviewAnalysis(replayAnalysisData);
  }
};

mp.onReviewExited = (payload) => {
  peerInReview = false;
  peerAnalysisRunning = false;
  board.getArrowOverlay().clearPeerAnnotations(payload.side);
  updateStatus('Opponent left review');
};

// Navigation sync
mp.onReviewNavigate = (payload) => {
  if (!isReplayMode) return;
  isRemoteNavigation = true;
  replayGoToMove(payload.ply);
  isRemoteNavigation = false;
};

// Analysis sharing
mp.onReviewAnalysisStarted = (payload) => {
  peerAnalysisRunning = true;
  updateStatus('Opponent is analyzing...');
};

mp.onReviewAnalysis = (payload) => {
  peerAnalysisRunning = false;
  if (isReplayMode && payload) {
    setMainBoardAnalysis(payload);
  }
};

// Check URL for room code parameter (joining via shared link)
function checkRoomCodeInUrl() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (roomCode) {
    // Remove the param from URL
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname + url.hash);

    // Connect and join the room
    multiplayerActive = true;
    mp.connect().then(() => {
      const name = document.getElementById('mp-player-name').value.trim() || null;
      mp.joinRoom(roomCode, name);
    }).catch(() => {
      multiplayerActive = false;
      alert('Could not connect to the multiplayer server.');
    });
  }
}

// --- New Game Wizard wiring ---

newGameMenu.onStart((config) => {
  // Apply wizard config to existing settings controls
  chess960Toggle.checked = config.chess960;
  evalBarToggle.checked = config.evalBar;
  localStorage.setItem('chess-eval-bar', config.evalBar ? 'true' : 'false');

  // Time control
  if (config.timeControl === '0') {
    timeControlSelect.value = '0';
  } else {
    // Try to find a matching option in the select
    const opts = timeControlSelect.querySelectorAll('option');
    let found = false;
    for (const opt of opts) {
      if (opt.value === config.timeControl) {
        timeControlSelect.value = config.timeControl;
        found = true;
        break;
      }
    }
    if (!found) {
      // Create a custom option for this time control
      const existingCustom = timeControlSelect.querySelector('[data-custom]');
      if (existingCustom) existingCustom.remove();
      const parts = config.timeControl.split('|').map(Number);
      const mins = Math.round(parts[0] / 60);
      const inc = parts[1] || 0;
      const opt = document.createElement('option');
      opt.value = config.timeControl;
      opt.textContent = `Custom ${mins}+${inc}`;
      opt.dataset.custom = 'true';
      opt.selected = true;
      timeControlSelect.insertBefore(opt, timeControlSelect.querySelector('[value="custom"]'));
    }
  }

  // Player configuration
  if (config.mode === 'bot') {
    const userPlaysWhite = config.botSide === 'black';
    aiWhiteToggle.checked = !userPlaysWhite;
    aiBlackToggle.checked = userPlaysWhite;

    // Set engine and ELO on the bot's side
    if (config.botSide === 'black') {
      aiBlackEngineSelect.value = config.engineId;
      aiBlackEloSlider.value = config.elo;
      aiBlackEloValue.textContent = config.elo;
    } else {
      aiWhiteEngineSelect.value = config.engineId;
      aiWhiteEloSlider.value = config.elo;
      aiWhiteEloValue.textContent = config.elo;
    }

    // Sync the engine/elo visibility in settings panel
    updateEloSliderRange('w');
    updateEloSliderRange('b');
  } else {
    // Shared device: both human
    aiWhiteToggle.checked = false;
    aiBlackToggle.checked = false;
  }

  // Show/hide engine selects based on AI toggle state
  aiWhiteEngineSelect.classList.toggle('hidden', !aiWhiteToggle.checked);
  aiWhiteEloWrapper.classList.toggle('hidden', !aiWhiteToggle.checked);
  aiBlackEngineSelect.classList.toggle('hidden', !aiBlackToggle.checked);
  aiBlackEloWrapper.classList.toggle('hidden', !aiBlackToggle.checked);

  startNewGame();
});

newGameMenu.onOnline(async (tc, name, camMode, chess960) => {
  if (!mp.ws || mp.ws.readyState !== WebSocket.OPEN) {
    try {
      await mp.connect();
    } catch (e) {
      alert('Could not connect to the multiplayer server. Please try again.');
      return;
    }
  }
  // Auto matchmaking — go straight to searching
  mp.quickMatch(tc, name, camMode, chess960);
  mpUI.showSearching();
  mpUI.modal.classList.remove('hidden');
  mpUI.backdrop.classList.remove('hidden');
});

newGameMenu.onFriend(async (action, code) => {
  if (!mp.ws || mp.ws.readyState !== WebSocket.OPEN) {
    try {
      await mp.connect();
    } catch (e) {
      alert('Could not connect to the multiplayer server. Please try again.');
      return;
    }
  }
  if (action === 'create') {
    // Defaults — waiting panel and lobby handle TC, variant, colors, cam
    mp.createRoom('5+0', null, 'board-face', false);
    // mpUI.showWaiting() will open the lobby panel when room_created fires
  } else if (action === 'join') {
    multiplayerActive = true;  // Prevent startNewGame() from overwriting
    mp.joinRoom(code, null);
  }
});

newGameMenu.onCustomTime(() => {
  customTimeModal.classList.remove('hidden');
});

// Switch live video display to match a cam mode (used by both local button clicks and remote setting changes)
function applyCamMode(mode) {
  if (!videoActive) return;
  if (mode === 'king-cam') {
    videoBoard.disable();
    splitCam.disable();
    // Restore raw camera track — videoBoard replaced it with a cropped canvas stream that is now stopped
    const rawVideoTrack = videoChat._localStream?.getVideoTracks()[0];
    if (rawVideoTrack) videoChat.replaceVideoTrack(rawVideoTrack);
    kingCam.enable(videoChat._localStream, mp.color, null);
    if (videoChat._remoteStream) {
      kingCam.updateRemoteStream(videoChat._remoteStream, mp.color === 'w' ? 'b' : 'w');
    }
    board.render();
  } else if (mode === 'board-face') {
    kingCam.disable();
    splitCam.disable();
    board.render();
    videoBoard.enable(videoChat._localStream, null, mp.color);
    // videoBoard replaces the WebRTC track via onCroppedStreamReady when face tracking is ready
    if (videoChat._remoteStream) {
      videoBoard.updateRemoteStream(videoChat._remoteStream, mp.color);
    }
  } else if (mode === 'split-cam') {
    kingCam.disable();
    videoBoard.disable();
    // Restore raw camera track — videoBoard may have replaced it
    const rawVideoTrack = videoChat._localStream?.getVideoTracks()[0];
    if (rawVideoTrack) videoChat.replaceVideoTrack(rawVideoTrack);
    splitCam.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
    splitCam.setTintEnabled(true);
  } else {
    kingCam.disable();
    videoBoard.disable();
    splitCam.disable();
    // Restore raw camera track when disabling all video modes
    const rawVideoTrack = videoChat._localStream?.getVideoTracks()[0];
    if (rawVideoTrack) videoChat.replaceVideoTrack(rawVideoTrack);
    board.render();
  }
}

// Lobby cam mode change — update activeCamMode, notify opponent, and switch live video
mpUI.onCamChange((mode) => {
  activeCamMode = mode;
  mp.proposeSetting('camMode', mode);
  applyCamMode(mode);
});

// --- Route handlers ---

// Helper: fetch a game by server ID and enter replay mode
async function loadGameById(gameId) {
  const id = parseInt(gameId, 10);
  if (isNaN(id)) {
    router.navigate('/');
    return;
  }
  const rec = await db.getGame(id);
  if (rec && rec.moves && rec.moves.length > 0) {
    enterReplayMode(rec);
  } else {
    console.warn(`Game ${id} not found or has no moves`);
    router.navigate('/');
  }
}

router.on('/', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  gameBrowser.close();
  if (isReplayMode) exitReplayMode(true);
  else if (moveCount === 0) startNewGame();
});

router.on('/replay', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  router.navigate('/');
});

router.on('/games', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  gameBrowser.open();
});

router.on('/history', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  gameBrowser.open({ showLive: false });
});

router.on('/live', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  gameBrowser.open({ showLive: true });
});

router.on('/profile', ({ params }) => {
  const username = params.get('user');
  profile.show(username || undefined);
});

router.on('/:username', ({ username }) => {
  profile.show(username);
});

router.on('/friends', () => {
  friends.show();
});

// Set version in settings footer from package.json
fetch('./package.json')
  .then(r => r.json())
  .then(pkg => {
    const el = document.querySelector('.settings-footer .version');
    if (el) el.textContent = `v${pkg.version}`;
  })
  .catch(() => {}); // keep hardcoded fallback on failure

// Initialize DB and auth, then start routing (engines load lazily in startNewGame)
Promise.all([
  db.open().catch(e => { console.warn('Database unavailable:', e); }),
  auth.validateToken().catch(() => {}),
]).then(() => {
  // Set multiplayerActive BEFORE routing so startNewGame() won't overwrite the join
  const hasRoomCode = new URLSearchParams(window.location.search).has('room');
  if (hasRoomCode) multiplayerActive = true;
  router.start();
  checkRoomCodeInUrl();
});
