import { Chess } from './chess.js';
import { Game } from './game.js';
import { Board } from './board.js';
import { Timer } from './timer.js?v=2';
import { AI } from './ai.js?v=3';
import { getEngineInfo } from './engines/registry.js';
import { GameDatabase } from './database.js?v=6';
import { GameBrowser } from './browser.js?v=4';
import { ReplayViewer } from './replay.js';
import { ReplayController } from './replay-controller.js';
import { AnalysisEngine } from './analysis.js';
import { EvalBar } from './eval-bar.js';
import { AnalysisController } from './analysis-controller.js';
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
import { SplitCamH } from './split-cam-h.js';
import { Diagnostics } from './diagnostics.js?v=2';
import { IssueReporter } from './issue-reporter.js';
import { Sound } from './sound.js';
import { LiveMoveBar } from './live-move-bar.js';
import { SettingsController } from './settings-controller.js';
import { GameController } from './game-controller.js';
import { UIController } from './ui-controller.js';

const sound = new Sound();

// Default art style path (SettingsController manages art style selection)
window.chessPiecePath = 'img/pieces';

const game = new Game();
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const promotionModal = document.getElementById('promotion-modal');
const newGameBtn = document.getElementById('new-game');
const exitGameBtn = document.getElementById('exit-game');
const capturedByWhiteEl = document.getElementById('captured-by-white');
const capturedByBlackEl = document.getElementById('captured-by-black');
const timerWhiteEl = document.getElementById('timer-white');
const timerBlackEl = document.getElementById('timer-black');
const timeControlSelect = document.getElementById('time-control');
const customTimeModal = document.getElementById('custom-time-modal');
const customMinutesInput = document.getElementById('custom-minutes');
const customYourMinutes = document.getElementById('custom-your-minutes');
const customOpponentMinutes = document.getElementById('custom-opponent-minutes');
const customIncrementInput = document.getElementById('custom-increment');
const customOddsToggle = document.getElementById('custom-odds-toggle');
const sameTimeFields = document.getElementById('same-time-fields');
const oddsTimeFields = document.getElementById('odds-time-fields');
const customTimeOk = document.getElementById('custom-time-ok');
const customTimeCancel = document.getElementById('custom-time-cancel');
const customYourLabel = document.getElementById('custom-your-label');
const customOpponentLabel = document.getElementById('custom-opponent-label');
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
const appEl = document.querySelector('.app');
const lobbyPanel         = document.getElementById('lobby-panel');
const publicLobbiesPanel = document.getElementById('public-lobbies-panel');
const publicLobbiesList  = document.getElementById('public-lobbies-list');

// Confirmation modal DOM elements
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

// Replay-on-board DOM elements (reuse live-move-bar for replay mode)
const replayControlsEl = document.getElementById('live-move-bar');
const replayMoveListEl = document.getElementById('live-move-list');
const replayStartBtn = document.getElementById('live-start-btn');
const replayPrevBtn = document.getElementById('live-prev-btn');
const replayPlayBtn = document.getElementById('replay-main-play');
const replayNextBtn = document.getElementById('live-next-btn');
const replayEndBtn = document.getElementById('live-end-btn');
const replayResultEl = document.getElementById('replay-main-result');
const replayExtrasEl = document.getElementById('replay-extras');

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


const board = new Board(boardEl, game, promotionModal);
const timer = new Timer(timerWhiteEl, timerBlackEl);
const ai = new AI();
const auth = new Auth();
const db = new GameDatabase();
db.setAuth(auth);
const replayViewer = new ReplayViewer();
const postGameSummary = new PostGameSummary();
const issueReporter = new IssueReporter();

// Replay controller — manages replay-mode state and navigation
const replayController = new ReplayController({
  board,
  game,
  sound,
  timer,
  dom: {
    statusEl, boardEl, timerWhiteEl, timerBlackEl,
    replayControlsEl, replayMoveListEl, replayExtrasEl,
    replayStartBtn, replayPrevBtn, replayPlayBtn, replayNextBtn, replayEndBtn,
    replayResultEl, playerNameWhite, playerNameBlack,
    playerIconWhite, playerIconBlack, playerEloWhite, playerEloBlack,
    capturedByWhiteEl, capturedByBlackEl,
    startGameBtn, appEl, newGameBtn,
    replayAnalyzeToggleEl,
  },
  callbacks: {
    onExitReplay: (startNew) => { if (startNew) startNewGame(); },
    resetAnalysis: () => { analysisCtrl.stopEngine(); analysisCtrl.reset(); },
    getAnalysisData: () => analysisCtrl.data,
    onAnalysisUpdate: () => { const ply = replayController.getPly(); analysisCtrl.updateAnalysisDetail(ply); analysisCtrl.updateCriticalNav(ply); analysisCtrl.updateEvalBar(ply); analysisCtrl.updateEngineArrows(ply); },
    onRunAnalysis: (rec) => analysisCtrl.runAnalysis(rec, {
      sharedReviewActive,
      peerAnalysisRunning,
      onShareResults: (result) => mp.sendReviewAnalysis(result),
      onShareStarted: () => mp.sendReviewAnalysisStarted(),
    }),
    onEnterSharedReview: () => { sharedReviewActive = true; mp.sendReviewEnter(); },
    onExitSharedReview: () => {
      if (sharedReviewActive) {
        mp.sendReviewExit();
        sharedReviewActive = false;
        peerInReview = false;
        peerAnalysisRunning = false;
        setMultiplayerMode(false);
      }
    },
    onNavigate: (ply) => { if (sharedReviewActive && !isRemoteNavigation) mp.sendReviewNavigate(ply); },
    shouldClearPeerArrows: () => sharedReviewActive,
    closeAllPopups: () => uiCtrl.closeAllPopups(),
    exitLiveReview: () => liveMoveBar.exit(),
    isLiveReview: () => liveMoveBar.isReviewing,
    showConfirmation: (msg, title) => uiCtrl.showConfirmation(msg, title),
    getCurrentDbGameId: () => gameCtrl.currentDbGameId,
    endCurrentGame: (id) => db.endGame(id, 'abandoned', 'abandoned'),
    resetMoveCount: () => { gameCtrl.moveCount = 0; },
    getMoveCount: () => gameCtrl.moveCount,
    isGameOver: () => game.isGameOver(),
    getLastMultiplayerGameRecord: () => lastMultiplayerGameRecord,
    stopAI: () => ai.stop(),
    stopLiveEval: () => { if (liveEvalEngine) liveEvalEngine.stop(); },
    getMpRoomId: () => mp.roomId,
    getReplayAnalyzeEnabled: () => replayAnalyzeCheckbox && replayAnalyzeCheckbox.checked,
    routerSilentUpdate: (path, params) => router.silentUpdate(path, params),
  },
});

const gameBrowser = new GameBrowser(db, replayViewer, (rec) => replayController.enter(rec));
const profile = new Profile(auth, { onGameClick: (id) => loadGameById(id) });
const friends = new Friends(auth);
const authUI = new AuthUI(auth, {
  onProfileClick: () => profile.show(),
  onFriendsClick: () => friends.show()
});
const router = new Router();

// Settings controller — owns all settings-panel DOM, persistence, and server sync
const settingsCtrl = new SettingsController({ auth, board, sound });

// React to eval bar and board tint changes (requires app-level state)
settingsCtrl.onSettingChanged = (name, value) => {
  if (name === 'evalBar') {
    if (gameCtrl.multiplayerActive) { settingsCtrl.setEvalBarEnabled(false); return; }
    if (replayController.isActive) {
      if (value && analysisCtrl.data) { mainEvalBar.show(); analysisCtrl.updateEvalBar(replayController.getPly()); }
      else { mainEvalBar.hide(); }
      return;
    }
    if (value) { mainEvalBar.show(); mainEvalBar.reset(); liveEval(); }
    else { mainEvalBar.hide(); mainEvalBar.reset(); if (liveEvalEngine) liveEvalEngine.stop(); }
  } else if (name === 'boardTint' && mp && mp.color) {
    const tint = value / 100;
    if (videoBoard.isActive()) videoBoard.updateTurnTint(game.getTurn(), mp.color, tint);
    if (splitCam.isActive()) splitCam.updateTurnTint(game.getTurn(), mp.color, tint);
    if (splitCamH.isActive()) splitCamH.updateTurnTint(game.getTurn(), mp.color, tint);
  }
};

// Auth state change handler — offer game claiming and update player names on login
// (settings sync is handled inside SettingsController._listenForAuthSettingsSync)
auth.onAuthChange(async (user) => {
  if (user) {
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

// Fetch client and API versions and attach to all diagnostic logs
Promise.all([
  fetch('./package.json').then(r => r.json()).then(pkg => pkg.version).catch(() => null),
  fetch('/api/chess/health').then(r => r.json()).then(h => h.version).catch(() => null),
]).then(([clientVersion, apiVersion]) => {
  diagnostics.setVersions(clientVersion, apiVersion);
});

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
const splitCamH = new SplitCamH(boardEl);
window.kingCam = kingCam;
window.replayController = replayController;
let videoActive = false;
let activeCamMode = 'none'; // set by onGameStart, read by onVideoStart
let _userStoppedCamera = false; // set before videoChat.stop() to tag track ended reason as "user"

// Hide video buttons if browser doesn't support WebRTC
if (!VideoChat.isSupported()) {
  const onlineVideoBtn = document.getElementById('ng-online-video-btn');
  const friendVideoBtn = document.getElementById('ng-friend-video-btn');
  if (onlineVideoBtn) onlineVideoBtn.classList.add('hidden');
  if (friendVideoBtn) friendVideoBtn.classList.add('hidden');
}

// New Game Wizard
const newGameMenu = new NewGameMenu();

// uiCtrl is assigned after gameCtrl is constructed; callbacks below capture it by reference.
let uiCtrl;

// Game state is now owned by gameCtrl (GameController) — declared below.
// These module-level aliases provide backward-compatible access for the
// many existing call-sites in app.js event handlers and multiplayer logic.
// They are initialised after gameCtrl is constructed (search: "gameCtrl").

// Live move bar (persistent move strip + live review mode)
const liveMoveBar = new LiveMoveBar({
  board, game, ai, timer,
  boardEl, statusEl,
  liveMoveBarEl: document.getElementById('live-move-bar'),
  liveMoveListEl: document.getElementById('live-move-list'),
  liveStartBtn: document.getElementById('live-start-btn'),
  livePrevBtn: document.getElementById('live-prev-btn'),
  liveNextBtn: document.getElementById('live-next-btn'),
  liveEndBtn: document.getElementById('live-end-btn'),
  getMoveCount: () => gameCtrl.moveCount,
  getIsReplayMode: () => replayController.isActive,
});

// Eval callback — refresh the eval bar whenever live review navigates
liveMoveBar.onNeedEval = () => {
  if (settingsCtrl.isEvalBarEnabled()) liveEval();
};

// Exit-review callback — app.js handles post-review rendering/logic
liveMoveBar.onExitReview = () => {
  uiCtrl.renderCaptured();
  uiCtrl.updateStatus();
  if (settingsCtrl.isEvalBarEnabled()) liveEval();

  if (mp.isActive()) {
    const isMyTurn = game.getTurn() === mp.color;
    board.setInteractive(isMyTurn);
    if (isMyTurn) {
      uiCtrl.updateStatus('Your turn');
    } else {
      uiCtrl.updateStatus("Opponent's turn");
    }
    if (game.isGameOver()) {
      board.setInteractive(false);
      newGameBtn.classList.add('game-ended');
      uiCtrl.updateStatus();
    }
  } else {
    triggerAIMove();
  }
};

// Eval bar for main board (used in both live play and replay)
const mainEvalBar = new EvalBar();
document.getElementById('main-eval-bar').appendChild(mainEvalBar.el);

// Analysis controller for main-board replay
const analysisCtrl = new AnalysisController({
  board,
  evalBar: mainEvalBar,
  evalBarToggle: settingsCtrl.getEvalBarToggle(),
  moveListEl: replayMoveListEl,
  progressEl: replayProgressEl,
  progressFillEl: replayProgressFillEl,
  accuracyEl: replayAccuracyEl,
  detailEl: replayDetailEl,
  classEl: replayClassEl,
  evalEl: replayEvalEl,
  bestEl: replayBestEl,
  lineEl: replayLineEl,
  critPrevBtn: replayCritPrevBtn,
  critNextBtn: replayCritNextBtn,
  summaryBtn: replaySummaryBtn,
});
analysisCtrl.setNavigationCallbacks(
  () => replayController.stopPlayback(),
  (ply) => replayController.goToMove(ply),
);

// Dedicated analysis engine for live position evaluation (separate from replay/game AI)
let liveEvalEngine = null;

/**
 * Evaluate the current board position and update the eval bar.
 * Uses a dedicated low-depth Stockfish worker that doesn't conflict
 * with the game AI or the replay analysis engine.
 */
async function liveEval() {
  if (replayController.isActive || game.isGameOver()) return;

  if (!liveEvalEngine) {
    liveEvalEngine = new AnalysisEngine();
  }

  try {
    const cp = await liveEvalEngine.quickEval(game.chess.fen());
    // cp is null if a full analysis is running on this engine
    if (cp != null && !replayController.isActive) {
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

// ─── GameController ─────────────────────────────────────────────
const gameCtrl = new GameController({
  game, board, timer, ai, sound, db, postGameSummary,
  replayController, liveMoveBar, analysisController: analysisCtrl,
  settingsController: settingsCtrl, mpUI, mp,
});

gameCtrl.setCallbacks({
  updateStatus: (msg, isGameInfo) => uiCtrl.updateStatus(msg, isGameInfo),
  renderCaptured: () => uiCtrl.renderCaptured(),
  closeAllPopups: () => uiCtrl.closeAllPopups(),
  liveEval,
  getTimeConfig: () => {
    const val = timeControlSelect.value;
    if (val === '0' || val === 'custom') return null;
    const parts = val.split('|').map(Number);
    return {
      whiteSec: parts[0],
      increment: parts[1],
      blackSec: parts[2] !== undefined ? parts[2] : parts[0],
    };
  },
  getTimeControlLabel: () => {
    const val = timeControlSelect.value;
    if (val === '0') return 'none';
    const selectedOption = timeControlSelect.selectedOptions[0];
    return selectedOption ? selectedOption.textContent : 'none';
  },
  getCustomWhiteName: () => uiCtrl?.customWhiteName ?? null,
  getCustomBlackName: () => uiCtrl?.customBlackName ?? null,
  startPublicLobbyPolling: () => uiCtrl.startPublicLobbyPolling(),
  stopPublicLobbyPolling: () => uiCtrl.stopPublicLobbyPolling(),
  routerSilentUpdate: (path) => router.silentUpdate(path),
  issueReporter,
  videoBoard,
  splitCam,
  splitCamH,
  getLiveEvalEngine: () => liveEvalEngine,
  getEngineInfo,
  dom: {
    boardEl, appEl, newGameBtn, startGameBtn,
    playerIconWhite, playerIconBlack, playerNameWhite, playerNameBlack,
    playerEloWhite, playerEloBlack, mainEvalBar,
  },
});

// Thin delegation functions for backward-compat with existing call sites
function getTimeConfig() { return gameCtrl._callbacks.getTimeConfig(); }
function triggerAIMove() { gameCtrl.triggerAIMove(); }
function getGameResult() { return gameCtrl.getGameResult(); }
function buildCurrentGameRecord() { return gameCtrl.buildCurrentGameRecord(); }
function buildMultiplayerGameRecord(result, reason) { return gameCtrl.buildMultiplayerGameRecord(result, reason); }
function triggerPostGameSummary() { gameCtrl.triggerPostGameSummary(); }
function configureLobbyTimer(tc, color, isCreator) { gameCtrl.configureLobbyTimer(tc, color, isCreator); }
async function startNewGame() { return gameCtrl.startNewGame(); }
function startMultiplayerGame(color, fen, tc, oppName, chess960, isCreator) {
  gameCtrl.startMultiplayerGame(color, fen, tc, oppName, chess960, isCreator);
}

// ─── Video & Hard Reset ──────────────────────────────────────────

/** Stop all video subsystems (WebRTC, camera, overlays). */
function setMultiplayerMode(active) {
  newGameBtn.classList.toggle('hidden', active);
  exitGameBtn.classList.toggle('hidden', !active);
}

function stopAllVideo() {
  videoChat.stop();
  videoUI.hide();
  videoUI.hideCameraPreview();
  videoBoard.disable();
  kingCam.disable();
  splitCam.disable();
  splitCamH.disable();
  videoActive = false;
  activeCamMode = 'none';
}

/**
 * Reset all transient application state (video, network, UI).
 * Does NOT start a new game — caller decides what to do next.
 * Preserves: settings, account, username cache.
 */
function resetState() {
  // Video
  _userStoppedCamera = false;
  stopAllVideo();

  // Shared review state
  sharedReviewActive = false;
  isRemoteNavigation = false;
  peerInReview = false;
  peerAnalysisRunning = false;
  lastMultiplayerGameRecord = null;

  // Multiplayer — resign or cancel, then disconnect
  if (gameCtrl.multiplayerActive) {
    if (gameCtrl.moveCount > 0 && !game.isGameOver()) {
      mp.resign();
    } else {
      mp.cancelPendingRoom();
    }
  }
  mp.disconnect();
  gameCtrl.multiplayerActive = false;
  setMultiplayerMode(false);

  // Timers & polling
  timer.stop();
  uiCtrl.stopPublicLobbyPolling();

  // Multiplayer UI
  mpUI.hideGameControls();
  mpUI.hideLobbyPanel();
  mpUI.close();
  mpUI.setAIMode(true);
  boardEl.classList.remove('lobby-active');

  // Re-render board (removes kingCam video elements)
  board.render();
}

/** Full reset + start a fresh local game. */
function hardReset() {
  resetState();
  startNewGame();
}

// ─── UIController ────────────────────────────────────────────────
uiCtrl = new UIController({
  game, board, db, mp, gameCtrl, settingsCtrl, replayController, liveMoveBar,
  diagnostics, videoChat, videoBoard, splitCam, splitCamH, kingCam,
  getVideoActive: () => videoActive,
  callbacks: { startNewGame },
  dom: {
    statusEl,
    capturedByWhiteEl, capturedByBlackEl,
    playerNameWhite, playerNameBlack,
    playerEloWhite, playerEloBlack,
    timeControlSelect, customYourLabel, customOpponentLabel, customTimeModal,
    confirmModal, confirmModalTitle, confirmModalMessage, confirmModalOk, confirmModalCancel,
    devIndicator: document.getElementById('dev-indicator'),
    lobbyPanel, publicLobbiesPanel, publicLobbiesList,
  },
});

board.onMove((result) => {
  if (replayController.isActive || liveMoveBar.isReviewing) return;
  gameCtrl.moveCount++;
  uiCtrl.showingGameInfo = false;

  // Disable pre-game interactive controls after first move
  if (gameCtrl.moveCount === 1) {
    appEl.classList.remove('pre-game');
    uiCtrl.closeAllPopups();
    startGameBtn.classList.add('hidden');
  }

  uiCtrl.renderCaptured();

  // Update the persistent live move bar
  const moveSide = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
  liveMoveBar.appendMove(result.san, moveSide, gameCtrl.moveCount - 1);
  if (gameCtrl.moveCount === 1) liveMoveBar.activate();
  liveMoveBar.updateButtons();

  // Multiplayer: send move to server, disable board until opponent moves
  if (mp.isActive()) {
    gameCtrl.multiplayerMoveTimes.push(Date.now());
    mp.sendMove(result.san);
    diagnostics.flush();
    board.setInteractive(false);
    if (videoBoard.isActive()) {
      videoBoard.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
    }
    if (splitCam.isActive()) {
      splitCam.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
    }
    uiCtrl.updateStatus("Opponent's turn");

    // Start/switch timer locally for visual feedback (server will sync)
    if (timer.isEnabled()) {
      const currentTurn = game.getTurn();
      if (gameCtrl.moveCount === 1) {
        timer.start(currentTurn);
      } else {
        timer.switchTo(currentTurn);
      }
    }

    // Update live eval bar
    if (settingsCtrl.isEvalBarEnabled()) liveEval();

    // Save move to local database
    if (gameCtrl.currentDbGameId) {
      const side = game.getTurn() === 'w' ? 'b' : 'w';
      db.addMove(gameCtrl.currentDbGameId, {
        ply: gameCtrl.moveCount - 1,
        san: result.san,
        fen: game.chess.fen(),
        timestamp: Date.now(),
        side,
      });
    }

    // Check for game over (checkmate/stalemate detected client-side, server will confirm)
    if (game.isGameOver()) {
      board.clearPremove();
      liveMoveBar.fade();
      newGameBtn.classList.add('game-ended');
      uiCtrl.updateStatus();
    }
    return;
  }

  // Save move to local-first database
  const side = game.getTurn() === 'w' ? 'b' : 'w'; // side that just moved
  db.addMove(gameCtrl.currentDbGameId, {
    ply: gameCtrl.moveCount - 1,
    san: result.san,
    fen: game.chess.fen(),
    timestamp: Date.now(),
    side: side,
  });

  if (timer.isEnabled()) {
    const currentTurn = game.getTurn();
    if (gameCtrl.moveCount === 1) {
      // First move: start black's timer (white just moved)
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  // Update live eval bar after every move (if toggle is on)
  if (settingsCtrl.isEvalBarEnabled()) {
    liveEval();
  }

  if (game.isGameOver()) {
    timer.stop();
    board.clearPremove();
    liveMoveBar.fade();
    newGameBtn.classList.add('game-ended');
    uiCtrl.updateStatus();

    // Save game result to local-first database
    const { result: dbResult, reason } = getGameResult();
    db.endGame(gameCtrl.currentDbGameId, dbResult, reason);

    // Auto-trigger post-game summary
    triggerPostGameSummary();
    return;
  }

  uiCtrl.updateStatus();

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

  sound.onMove(result);
});

timer.onTimeout((loser) => {
  if (liveMoveBar.isReviewing) liveMoveBar.exit();
  liveMoveBar.fade();
  ai.stop();
  game.setTimedOut();
  board.setInteractive(false);
  newGameBtn.classList.add('game-ended');
  const winner = loser === 'White' ? 'Black' : 'White';
  uiCtrl.updateStatus(`Time out! ${winner} wins`);

  // Save timeout result to local-first database
  const dbResult = loser === 'White' ? '0-1' : '1-0';
  db.endGame(gameCtrl.currentDbGameId, dbResult, 'timeout');

  // Auto-trigger post-game summary
  triggerPostGameSummary();
});

newGameBtn.addEventListener('click', async () => {
  // If a game is in progress, confirm abandonment first
  if (gameCtrl.moveCount > 0 && !game.isGameOver()) {
    const confirmed = await uiCtrl.showConfirmation(
      'You have a game in progress. Abandon it and start a new one?',
      'Abandon Game?'
    );
    if (!confirmed) return;
    if (gameCtrl.currentDbGameId) {
      db.endGame(gameCtrl.currentDbGameId, 'abandoned', 'abandoned');
    }
    newGameMenu.showExitButton();
  }

  newGameMenu.open();
});

exitGameBtn.addEventListener('click', async () => {
  const confirmed = await uiCtrl.showConfirmation(
    'Exit the current online game?',
    'Exit Game?'
  );
  if (!confirmed) return;
  hardReset();
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
  uiCtrl.closeAllPopups();
  triggerAIMove();
});

// --- Editable Player Names ---

playerNameWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameCtrl.multiplayerActive) {
    // In multiplayer: only allow editing own name, not opponent's
    if (mp.color === 'w') {
      uiCtrl.startNameEdit(playerNameWhite, 'white');
    }
    return;
  }
  if (settingsCtrl.isAIEnabled('w')) {
    uiCtrl.startEngineSwitch(playerNameWhite, 'white');
  } else {
    uiCtrl.startNameEdit(playerNameWhite, 'white');
  }
});

playerNameBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameCtrl.multiplayerActive) {
    // In multiplayer: only allow editing own name, not opponent's
    if (mp.color === 'b') {
      uiCtrl.startNameEdit(playerNameBlack, 'black');
    }
    return;
  }
  if (settingsCtrl.isAIEnabled('b')) {
    uiCtrl.startEngineSwitch(playerNameBlack, 'black');
  } else {
    uiCtrl.startNameEdit(playerNameBlack, 'black');
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
    customYourLabel.textContent = 'Your time (min):';
    customOpponentLabel.textContent = "Opponent's time (min):";
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
  let yourMin, oppMin;

  if (odds) {
    yourMin = parseInt(customYourMinutes.value, 10) || 10;
    oppMin = parseInt(customOpponentMinutes.value, 10) || 5;
  } else {
    yourMin = parseInt(customMinutesInput.value, 10) || 10;
    oppMin = yourMin;
  }

  // Add custom option and select it
  const existingCustom = timeControlSelect.querySelector('[data-custom]');
  if (existingCustom) existingCustom.remove();
  const opt = document.createElement('option');
  const label = yourMin === oppMin
    ? `Custom ${yourMin}+${increment}`
    : `Custom ${yourMin}/${oppMin}+${increment}`;
  const tcValue = `${yourMin * 60}|${increment}|${oppMin * 60}`;
  opt.value = tcValue;
  opt.textContent = label;
  opt.dataset.custom = 'true';
  opt.selected = true;
  timeControlSelect.insertBefore(opt, timeControlSelect.querySelector('[value="custom"]'));
  customTimeModal.classList.add('hidden');

  // If a lobby custom TC is pending, apply it to the lobby
  if (mpUI && mpUI.hasPendingLobbyCustomTc()) {
    mpUI.applyCustomTc(yourMin, oppMin, increment);
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
  // If a lobby custom TC is pending, cancel it
  if (mpUI && mpUI.hasPendingLobbyCustomTc()) {
    mpUI.resetLobbyCustomTc();
    return;
  }
  timeControlSelect.value = '600|0'; // fallback to Rapid 10+0
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

// Click player icon to toggle Human ↔ AI (only before first move)
playerIconWhite.addEventListener('click', () => {
  if (replayController.isActive || gameCtrl.multiplayerActive || gameCtrl.moveCount > 0) return;
  settingsCtrl.toggleAI('w');
  startNewGame();
});

playerIconBlack.addEventListener('click', () => {
  if (replayController.isActive || gameCtrl.multiplayerActive || gameCtrl.moveCount > 0) return;
  settingsCtrl.toggleAI('b');
  startNewGame();
});


// Click timer for time control dropdown (only before first move)
timerWhiteEl.addEventListener('click', (e) => {
  e.stopPropagation();
  uiCtrl.showTimerDropdown(timerWhiteEl);
});

timerBlackEl.addEventListener('click', (e) => {
  e.stopPropagation();
  uiCtrl.showTimerDropdown(timerBlackEl);
});

// Click ELO label for inline slider popup (only before first move, only for AI)
playerEloWhite.addEventListener('click', (e) => {
  e.stopPropagation();
  uiCtrl.showEloPopup(playerEloWhite, 'w');
});

playerEloBlack.addEventListener('click', (e) => {
  e.stopPropagation();
  uiCtrl.showEloPopup(playerEloBlack, 'b');
});

// Close popups on outside click
document.addEventListener('click', () => {
  const hadPopup = document.querySelector('.elo-popup');
  uiCtrl.closeAllPopups();
  // If an elo popup was open and just closed, restart game to apply ELO change
  if (hadPopup && gameCtrl.moveCount === 0) {
    startNewGame();
  }
});

// Close popups on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    board.clearPremove();
    const hadPopup = document.querySelector('.elo-popup');
    uiCtrl.closeAllPopups();
    if (hadPopup && gameCtrl.moveCount === 0) {
      startNewGame();
    }
  }
});

// (Analysis functions extracted to AnalysisController)

// Global keydown listener for entering live review via arrow key
document.addEventListener('keydown', (e) => {
  if (liveMoveBar.isReviewing || replayController.isActive) return;
  if (e.key === 'ArrowLeft' && gameCtrl.moveCount > 0 && !game.isGameOver()) {
    e.preventDefault();
    liveMoveBar.enter();
  }
});

// Wire up replay/live-review control buttons (dispatch to ReplayController)
replayStartBtn.addEventListener('click', () => replayController.goToStart());
replayPrevBtn.addEventListener('click', () => replayController.prev());
replayPlayBtn.addEventListener('click', () => replayController.togglePlayback());
replayNextBtn.addEventListener('click', () => replayController.next());
replayEndBtn.addEventListener('click', () => replayController.goToEnd());

// Wire up analysis toggle and critical nav buttons
if (replayAnalyzeCheckbox) {
  replayAnalyzeCheckbox.addEventListener('change', () => {
    const enabled = replayAnalyzeCheckbox.checked;
    localStorage.setItem('chess-auto-analyze', enabled ? 'true' : 'false');
    if (enabled) {
      if (replayController.isActive && replayController.getGame() && !analysisCtrl.data) {
        analysisCtrl.runAnalysis(replayController.getGame(), {
          sharedReviewActive, peerAnalysisRunning,
          onShareResults: (result) => mp.sendReviewAnalysis(result),
          onShareStarted: () => mp.sendReviewAnalysisStarted(),
        });
      }
    } else {
      analysisCtrl.stopEngine();
      analysisCtrl.reset();
    }
  });
}
if (replayCritPrevBtn) replayCritPrevBtn.addEventListener('click', () => analysisCtrl.goToPrevCritical(replayController.getPly()));
if (replayCritNextBtn) replayCritNextBtn.addEventListener('click', () => analysisCtrl.goToNextCritical(replayController.getPly()));

// Wire up post-game summary callback on the full-screen replay viewer
replayViewer.setSummaryCallback((gameRecord, analysisData) => {
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
      analysisCtrl.getPostGameEngine(),
      gameRecord.serverId || null,
      callbacks
    );
  }
});

// Wire up main-board replay summary button
if (replaySummaryBtn) {
  replaySummaryBtn.addEventListener('click', () => {
    if (!replayController.isActive || !replayController.getGame()) return;

    const callbacks = {
      onReview: () => {},  // Already in replay mode
      onNewGame: () => startNewGame(),
      onClose: () => {},
    };

    postGameSummary.setCallbacks(callbacks);

    if (analysisCtrl.data) {
      postGameSummary.show(replayController.getGame(), { summary: analysisCtrl.data.summary });
    } else {
      postGameSummary.showWithAnalysis(
        replayController.getGame(),
        analysisCtrl.getPostGameEngine(),
        replayController.getGame().serverId || null,
        callbacks
      );
    }
  });
}

// Wire up multiplayer post-game Summary button
const mpSummaryBtn = document.getElementById('mp-summary-btn');
if (mpSummaryBtn) {
  mpSummaryBtn.addEventListener('click', () => {
    mpUI.hideSummaryButton();
    postGameSummary.reopen();
  });
}

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
  issueReporter.setGameContext(payload.dbGameId, mp.sessionId, !!payload.videoEnabled, payload.roomId);
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
  if (splitCamH.isActive()) {
    splitCamH.setTintEnabled(true);
  }

  // Reconcile cam mode: video_start fires in the lobby before game starts,
  // so the cam mode may have changed after video_start but before game_start.
  // If the active cam mode doesn't match, disable the wrong one and re-enable correctly.
  if (videoActive && mp.color) {
    const needsSplitCam = activeCamMode === 'split-cam' && !splitCam.isActive();
    const needsSplitCamH = activeCamMode === 'split-cam-h' && !splitCamH.isActive();
    const needsKingCam = activeCamMode === 'king-cam' && !kingCam.isActive();
    const needsBoardFace = activeCamMode === 'board-face' && !videoBoard.isActive();
    const needsNone = activeCamMode === 'none' &&
      (videoBoard.isActive() || splitCam.isActive() || splitCamH.isActive() || kingCam.isActive());

    if (needsSplitCam || needsSplitCamH || needsKingCam || needsBoardFace || needsNone) {
      videoBoard.disable();
      splitCam.disable();
      splitCamH.disable();
      kingCam.disable();
      const opponentColor = mp.color === 'w' ? 'b' : 'w';
      if (activeCamMode === 'split-cam') {
        splitCam.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
        splitCam.setTintEnabled(true);
      } else if (activeCamMode === 'split-cam-h') {
        splitCamH.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
        splitCamH.setTintEnabled(true);
      } else if (activeCamMode === 'king-cam') {
        kingCam.enable(videoChat._localStream, mp.color, videoChat._remoteStream);
        board.render();
      } else if (activeCamMode === 'board-face') {
        videoBoard.enable(videoChat._localStream, videoChat._remoteStream, mp.color);
        videoBoard.setTintEnabled(true);
      }
    }
  }

  startMultiplayerGame(payload.color, payload.fen, payload.timeControl, payload.opponentName, payload.chess960, payload.isCreator);

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
  uiCtrl.stopPublicLobbyPolling();
  mpUI.setPlayerColor(payload.color);
  mpUI.showWaiting(payload.roomId);
  issueReporter.setGameContext(null, mp.sessionId, false, payload.roomId);
  issueReporter.showWaitingButton();
  diagnostics.setContext(null, payload.roomId);
  diagnostics.record('lifecycle', 'lobby_created', { roomId: payload.roomId });
  diagnostics.flush();

  gameCtrl.multiplayerActive = true;
  setMultiplayerMode(true);

  // Fade board and lock interaction while waiting for opponent (same as lobby)
  boardEl.classList.add('lobby-active');
  game.newGame(false);
  board.getArrowOverlay().clear();
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  board.render();
  playerNameWhite.textContent = payload.color === 'w' ? 'You' : 'Opponent';
  playerNameBlack.textContent = payload.color === 'b' ? 'You' : 'Opponent';
  playerNameWhite.classList.toggle('multiplayer-opponent', payload.color !== 'w');
  playerNameBlack.classList.toggle('multiplayer-opponent', payload.color !== 'b');
  // Reset icons and elo from any previous game
  playerIconWhite.textContent = '\uD83C\uDF10';
  playerIconBlack.textContent = '\uD83C\uDF10';
  playerEloWhite.classList.add('hidden');
  playerEloBlack.classList.add('hidden');
};

// Lobby joined — show pre-game settings inline below board
mp.onLobbyJoined = async (payload) => {
  // Guard: don't reset board if a game is actively in progress
  if (mp.isActive() && gameCtrl.moveCount > 0 && !game.isGameOver()) {
    diagnostics.record('lifecycle', 'lobby_joined_rejected', {
      reason: 'game_in_progress', moveCount: gameCtrl.moveCount, roomId: payload.roomId
    });
    console.warn('[MP] Ignoring lobby_joined — game in progress with', gameCtrl.moveCount, 'moves');
    return;
  }

  gameCtrl.multiplayerActive = true;
  setMultiplayerMode(true);
  uiCtrl.stopPublicLobbyPolling();
  issueReporter.hideWaitingButton();
  mpUI.showLobby(payload);
  issueReporter.setGameContext(null, mp.sessionId, false, payload.roomId);
  issueReporter.showLobbyButton();
  diagnostics.setContext(null, payload.roomId);
  diagnostics.record('lifecycle', 'lobby_joined', { roomId: payload.roomId, color: payload.color });
  diagnostics.flush();

  // Always add lobby-active: fades pieces to 30% and locks interaction until game starts
  boardEl.classList.add('lobby-active');

  // Initialize board with starting position for lobby preview
  // (startNewGame() won't run because gameCtrl.multiplayerActive is true, so render directly)
  game.newGame(!!payload.settings?.chess960);
  board.getArrowOverlay().clear();
  // Flip board to player's color so name elements are in correct visual positions
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  board.render();
  playerNameWhite.textContent = payload.color === 'w' ? 'You' : payload.opponentName || 'Opponent';
  playerNameBlack.textContent = payload.color === 'b' ? 'You' : payload.opponentName || 'Opponent';
  playerNameWhite.classList.toggle('multiplayer-opponent', payload.color !== 'w');
  playerNameBlack.classList.toggle('multiplayer-opponent', payload.color !== 'b');
  // Reset icons and elo from any previous game
  playerIconWhite.textContent = '\uD83C\uDF10';
  playerIconBlack.textContent = '\uD83C\uDF10';
  playerEloWhite.classList.add('hidden');
  playerEloBlack.classList.add('hidden');

  // Orient board to player's color and configure timer for lobby preview
  board.setFlipped(payload.color === 'b');
  appEl.classList.toggle('board-flipped', payload.color === 'b');
  configureLobbyTimer(payload.settings?.timeControl, payload.color, payload.isCreator);

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

  // Capture opponent name before mp.color changes
  const opponentName = mp.color === 'w'
    ? playerNameBlack.textContent
    : playerNameWhite.textContent;

  // Keep mp.color in sync (server sends current color in every setting_changed)
  mp.color = payload.color;

  // Update player name labels to match the new colour assignment
  playerNameWhite.textContent = payload.color === 'w' ? 'You' : opponentName;
  playerNameBlack.textContent = payload.color === 'b' ? 'You' : opponentName;
  playerNameWhite.classList.toggle('multiplayer-opponent', payload.color !== 'w');
  playerNameBlack.classList.toggle('multiplayer-opponent', payload.color !== 'b');

  // Flip board to match new color assignment and update timer display
  // Skip board flip for colorPreference — handled live by onColorPreferenceChange callback
  if (payload.field !== 'colorPreference') {
    board.setFlipped(payload.color === 'b');
    appEl.classList.toggle('board-flipped', payload.color === 'b');
  }
  configureLobbyTimer(payload.settings?.timeControl, payload.color, mpUI.isCreator());

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
    uiCtrl.applyCamMode(payload.settings.camMode);
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
  gameCtrl.multiplayerMoveTimes.push(Date.now());

  // If in live review, buffer the move instead of applying immediately
  if (liveMoveBar.isReviewing) {
    liveMoveBar.pushPendingMove(payload);
    gameCtrl.moveCount++;

    // Compute the FEN for this move using a scratch chess instance
    const scratch = new Chess(liveMoveBar.getLastReviewFen());
    const result = scratch.move(san);

    if (result) {
      liveMoveBar.pushReviewMove({
        san,
        fen: scratch.fen(),
        from: result.from,
        to: result.to,
        side: result.color,
      });

      // Append to the live move bar UI
      const idx = liveMoveBar.reviewMoves.length - 1;
      liveMoveBar.appendMove(san, result.color, idx);
      liveMoveBar.updateButtons();

      // Save opponent's move to local database even during live review
      if (gameCtrl.currentDbGameId) {
        db.addMove(gameCtrl.currentDbGameId, {
          ply: gameCtrl.moveCount - 1,
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
  const oppMoveResult = game.makeMoveSan(san);
  gameCtrl.moveCount++;
  board.render();
  uiCtrl.renderCaptured();
  sound.onMove(oppMoveResult);

  // Update the persistent live move bar
  const opponentSide = game.getTurn() === 'w' ? 'b' : 'w';
  liveMoveBar.appendMove(san, opponentSide, gameCtrl.moveCount - 1);
  if (gameCtrl.moveCount === 1) liveMoveBar.activate();
  liveMoveBar.updateButtons();

  // Save opponent's move to local database
  if (gameCtrl.currentDbGameId) {
    db.addMove(gameCtrl.currentDbGameId, {
      ply: gameCtrl.moveCount - 1,
      san,
      fen: game.chess.fen(),
      timestamp: Date.now(),
      side: opponentSide,
    });
  }

  // Disable pre-game state
  if (gameCtrl.moveCount === 1) {
    appEl.classList.remove('pre-game');
    uiCtrl.closeAllPopups();
  }

  // Sync clocks from server
  if (clocks && timer.isEnabled()) {
    timer.setTime('w', clocks.w);
    timer.setTime('b', clocks.b);
    const currentTurn = game.getTurn();
    if (gameCtrl.moveCount === 1) {
      timer.start(currentTurn);
    } else {
      timer.switchTo(currentTurn);
    }
  }

  // Update eval bar
  if (settingsCtrl.isEvalBarEnabled()) liveEval();

  // Check for game over
  if (game.isGameOver()) {
    board.clearPremove();
    liveMoveBar.fade();
    newGameBtn.classList.add('game-ended');
    board.setInteractive(false);
    uiCtrl.updateStatus();
    return;
  }

  // Enable board for our turn
  board.setInteractive(true);
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCamH.isActive()) {
    splitCamH.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  uiCtrl.updateStatus('Your turn');

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
  if (liveMoveBar.isReviewing) liveMoveBar.exit();
  liveMoveBar.fade();
  sound.gameOver();
  gameCtrl.multiplayerActive = false;
  // setMultiplayerMode(false) is deferred — exit button stays visible through post-game summary and shared replay
  uiCtrl.startPublicLobbyPolling();
  playerNameWhite.classList.remove('multiplayer-opponent');
  playerNameBlack.classList.remove('multiplayer-opponent');
  timer.stop();
  board.clearPremove();
  board.setInteractive(false);
  newGameBtn.classList.add('game-ended');

  const { result, reason } = payload;

  // Persist game result to local database
  if (gameCtrl.currentDbGameId) {
    db.endGame(gameCtrl.currentDbGameId, result, reason);
  }

  let statusText;
  if (result === '1/2-1/2') {
    statusText = `Draw — ${reason}`;
  } else {
    const winnerSide = result === '1-0' ? 'w' : 'b';
    const iWin = mp.color === winnerSide;
    statusText = iWin ? `You win! (${reason})` : `You lose (${reason})`;
  }
  uiCtrl.updateStatus(statusText);
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
    issueReporter.bindPostGameFlagButton(postGameSummary.getPgsFlagButton());
    postGameSummary.showWithAnalysis(
      record,
      analysisCtrl.getPostGameEngine(),
      null,
      {
        onReview: (rec) => replayController.enter(rec),
        onNewGame: () => { gameCtrl.multiplayerActive = false; setMultiplayerMode(false); startNewGame(); },
        onClose: () => { mpUI.showSummaryButton(); },
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
  uiCtrl.updateStatus("Draw declined — your turn");
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
  issueReporter.setGameContext(payload.dbGameId, mp.sessionId, videoActive, payload.roomId);
  issueReporter.showButton();
  mpUI.hideGameControls();
  startMultiplayerGame(payload.color, payload.fen, payload.timeControl, payload.opponentName, payload.chess960, payload.isCreator);

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
  } else if (splitCamH.isActive()) {
    // Horizontal split cam — disable and re-enable with new player color.
    splitCamH.disable();
    splitCamH.enable(videoChat._localStream, videoChat._remoteStream, payload.color);
  } else if (kingCam.isActive()) {
    // King cam — disable and re-enable with new player color (colors swap on rematch).
    kingCam.disable();
    kingCam.enable(videoChat._localStream, payload.color, videoChat._remoteStream || null);
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
  startMultiplayerGame(payload.color, payload.startingFen || null, payload.timeControl, payload.opponentName, payload.chess960, payload.isCreator);

  // Replay all moves to restore game state and populate the move strip
  if (payload.moves && payload.moves.length > 0) {
    const scratch = new Chess(payload.startingFen || undefined);
    for (const san of payload.moves) {
      const result = scratch.move(san);
      if (!result) break;
      game.makeMoveSan(san);
      gameCtrl.moveCount++;
      liveMoveBar.appendMove(san, result.color, gameCtrl.moveCount - 1);
      liveMoveBar.pushReviewMove({ san, fen: scratch.fen(), from: result.from, to: result.to, side: result.color });

      // Record replayed move to local database
      if (gameCtrl.currentDbGameId) {
        db.addMove(gameCtrl.currentDbGameId, {
          ply: gameCtrl.moveCount - 1,
          san,
          fen: scratch.fen(),
          timestamp: Date.now(),
          side: result.color,
        });
      }
    }
    liveMoveBar.activate();
    liveMoveBar.updateButtons();
    appEl.classList.remove('pre-game');
  }
  board.render();
  uiCtrl.renderCaptured();

  // Sync clocks
  if (payload.clocks && timer.isEnabled()) {
    timer.setTime('w', payload.clocks.w);
    timer.setTime('b', payload.clocks.b);
    timer.start(game.getTurn());
  }

  const isMyTurn = mp.isMyTurn(game.getTurn());
  board.setInteractive(isMyTurn);
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCamH.isActive()) {
    splitCamH.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  uiCtrl.updateStatus(isMyTurn ? 'Your turn (reconnected)' : "Opponent's turn (reconnected)");
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
  uiCtrl.updateStatus(`Opponent disconnected — ${payload.timeout}s to reconnect`);
};

// Opponent reconnected
mp.onOpponentReconnected = () => {
  diagnostics.record('lifecycle', 'opponent_reconnected', {});
  mpUI.setConnectionStatus('connected');
  const isMyTurn = mp.isMyTurn(game.getTurn());
  if (videoBoard.isActive()) {
    videoBoard.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCam.isActive()) {
    splitCam.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  if (splitCamH.isActive()) {
    splitCamH.updateTurnTint(game.getTurn(), mp.color, settingsCtrl.getBoardTint() / 100);
  }
  uiCtrl.updateStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
};

// Connection status
mp.onConnected = (payload) => {
  diagnostics.record('network', 'ws_connected', { inRoom: payload?.inRoom });
  if (payload && payload.inRoom) {
    if (!gameCtrl.multiplayerActive) {
      // Server auto-reconnected us to a room we intentionally left — cancel it
      mp.cancelPendingRoom();
      mpUI.setConnectionStatus('connected');
      return;
    }
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
      gameCtrl.multiplayerActive = false;
      setMultiplayerMode(false);
      mp.active = false;
      uiCtrl.updateStatus('Game ended — connection to room was lost');
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
  diagnostics.record('network', 'ws_reconnecting', { attempt, maxAttempts });
  mpUI.setConnectionStatus('reconnecting', `Reconnecting... (${attempt}/${maxAttempts})`);
};

mp.onConnectionLost = () => {
  diagnostics.record('network', 'ws_connection_lost', {});
  diagnostics.flush();
  mpUI.setConnectionStatus('connection-lost');
  gameCtrl.multiplayerActive = false;
  setMultiplayerMode(false);
  uiCtrl.startPublicLobbyPolling();
  issueReporter.recordError();
  uiCtrl.updateStatus('Connection lost — game may have ended');
};

mp.onHeartbeatTimeout = () => {
  diagnostics.record('network', 'ws_heartbeat_timeout', {});
  diagnostics.flush();
};

mp.onRoomLost = () => {
  diagnostics.record('network', 'ws_room_lost', {});
  diagnostics.flush();
};

mp.onError = (msg) => {
  console.warn('Multiplayer error:', msg);
  issueReporter.recordError();
  // "Not in a room" during active game is handled by multiplayer.js (triggers reconnect)
  // Don't show alerts or reset state during shared post-game review
  if (!mp.isActive() && !sharedReviewActive) {
    gameCtrl.multiplayerActive = false;
    setMultiplayerMode(false);
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
  diagnostics.record('lifecycle', 'video_start_received', { initiator: payload.initiator, camMode: activeCamMode });
  try {
    if (!videoChat.hasIceServers()) {
      await videoChat.fetchIceServers();
    }
    await videoChat.startCall(payload.initiator);
    diagnostics.record('lifecycle', 'video_call_started', { initiator: payload.initiator });
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
      } else if (activeCamMode === 'split-cam-h') {
        // Horizontal split cam — top half = black, bottom half = white
        splitCamH.enable(videoChat._localStream, null, mp.color);
        if (videoChat._remoteStream) {
          splitCamH.updateRemoteStream(videoChat._remoteStream, mp.color);
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
    diagnostics.record('lifecycle', 'video_call_failed', { error: e.message });
    diagnostics.flush();
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
videoChat.onCameraError = (msg) => {
  diagnostics.record('lifecycle', 'camera_denied', { error: msg });
  diagnostics.flush();
};
videoChat.onLocalStream = (stream) => {
  diagnostics.record('lifecycle', 'camera_acquired', {});

  // Track the last time the page became hidden, so we can correlate it with track endings.
  let lastHiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastHiddenAt = Date.now();
  });

  stream.getVideoTracks().forEach(track => {
    let pendingMuteReason = null;

    track.onmute = () => {
      diagnostics.record('webrtc', 'local_track_muted', { kind: 'video' });
      pendingMuteReason = 'muted';
    };

    track.onended = () => {
      let reason;
      if (_userStoppedCamera) {
        reason = 'user';
        _userStoppedCamera = false;
      } else if (pendingMuteReason) {
        reason = pendingMuteReason;
      } else if (lastHiddenAt !== null && (Date.now() - lastHiddenAt) < 2000) {
        reason = 'visibility';
      } else {
        reason = 'ended';
      }
      pendingMuteReason = null;
      diagnostics.record('webrtc', 'local_track_ended', { kind: 'video', reason });
    };
  });
  videoUI.setLocalStream(stream);
  if (mp.color) {
    videoBoard.updateLocalStream(stream, mp.color);
    diagnostics.localStreamUpdated('board-face', mp.color);
    if (splitCam.isActive()) {
      splitCam.updateLocalStream(stream, mp.color);
      diagnostics.localStreamUpdated('split-cam', mp.color);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateLocalStream(stream, mp.color);
      diagnostics.localStreamUpdated('split-cam-h', mp.color);
    }
    if (kingCam.isActive()) {
      kingCam.updateLocalStream(stream, mp.color);
      diagnostics.localStreamUpdated('king-cam', mp.color);
    }
  }
};
videoChat.onRemoteStream = (stream) => {
  videoUI.setRemoteStream(stream);
  if (mp.color) {
    const opponentColor = mp.color === 'w' ? 'b' : 'w';
    videoBoard.updateRemoteStream(stream, mp.color);
    diagnostics.remoteStreamUpdated('board-face', mp.color);
    if (kingCam.isActive()) {
      kingCam.updateRemoteStream(stream, opponentColor);
      diagnostics.remoteStreamUpdated('king-cam', opponentColor);
      board.render();
    }
    if (splitCam.isActive()) {
      splitCam.updateRemoteStream(stream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam', mp.color);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateRemoteStream(stream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam-h', mp.color);
    }
  }
};
videoChat.onDisconnected = () => {
  diagnostics.record('webrtc', 'video_disconnected', {});
  diagnostics.flush();
  videoUI.showError('Video disconnected');
  issueReporter.recordError();
};
videoChat.onError = (msg) => {
  diagnostics.record('webrtc', 'video_error', { message: msg });
  videoUI.showError(msg);
  issueReporter.recordError();
};
videoChat.onReconnecting = (attempt, max) => {
  diagnostics.record('webrtc', 'video_reconnecting', { attempt, max });
  videoUI.showError(`Reconnecting video... (${attempt}/${max})`);
};
videoChat.onReconnected = () => {
  diagnostics.record('webrtc', 'video_reconnected', {});
  // Re-deliver remote stream to displays in case it was interrupted
  if (videoChat._remoteStream && mp.color) {
    const opponentColor = mp.color === 'w' ? 'b' : 'w';
    videoBoard.updateRemoteStream(videoChat._remoteStream, mp.color);
    diagnostics.remoteStreamUpdated('board-face', mp.color);
    if (kingCam.isActive()) {
      kingCam.updateRemoteStream(videoChat._remoteStream, opponentColor);
      diagnostics.remoteStreamUpdated('king-cam', opponentColor);
      board.render();
    }
    if (splitCam.isActive()) {
      splitCam.updateRemoteStream(videoChat._remoteStream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam', mp.color);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateRemoteStream(videoChat._remoteStream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam-h', mp.color);
    }
  }
};
videoChat.onRemoteVideoMuted = () => {
  diagnostics.record('webrtc', 'remote_video_muted', {});
};
videoChat.onRemoteVideoUnmuted = () => {
  // Re-deliver the stream in case display stalled while muted
  if (videoChat._remoteStream && mp.color) {
    const opponentColor = mp.color === 'w' ? 'b' : 'w';
    videoBoard.updateRemoteStream(videoChat._remoteStream, mp.color);
    diagnostics.remoteStreamUpdated('board-face', mp.color);
    if (kingCam.isActive()) {
      kingCam.updateRemoteStream(videoChat._remoteStream, opponentColor);
      diagnostics.remoteStreamUpdated('king-cam', opponentColor);
      board.render();
    }
    if (splitCam.isActive()) {
      splitCam.updateRemoteStream(videoChat._remoteStream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam', mp.color);
    }
    if (splitCamH.isActive()) {
      splitCamH.updateRemoteStream(videoChat._remoteStream, mp.color);
      diagnostics.remoteStreamUpdated('split-cam-h', mp.color);
    }
  }
};

// VideoUI events
videoUI.onPreviewConfirm = () => {
  // Pre-fetch ICE servers while waiting for opponent to confirm camera
  videoChat.fetchIceServers();
  mp.sendVideoReady();
};

videoUI.onPreviewCancel = () => {
  // User cancelled — stop camera, don't send video_ready
  _userStoppedCamera = true;
  videoChat.stop();
};

videoUI.onEndCall = () => {
  mp.sendVideoEnd();
  _userStoppedCamera = true;
  stopAllVideo();
  board.render(); // remove kingCam video elements
};

mp.onVideoEnded = () => {
  stopAllVideo();
  board.render();
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
  if (!replayController.isActive && lastMultiplayerGameRecord) {
    replayController.enter(lastMultiplayerGameRecord);
  }
  // Share any existing analysis with the newly joined peer.
  // Cached analysis runs synchronously before sharedReviewActive is set,
  // so it cannot be shared at analysis time — share it here instead.
  if (sharedReviewActive && analysisCtrl.data) {
    mp.sendReviewAnalysis(analysisCtrl.data);
  }
};

mp.onReviewExited = (payload) => {
  peerInReview = false;
  peerAnalysisRunning = false;
  board.getArrowOverlay().clearPeerAnnotations(payload.side);
  uiCtrl.updateStatus('Opponent left review');
};

// Navigation sync
mp.onReviewNavigate = (payload) => {
  if (!replayController.isActive) return;
  isRemoteNavigation = true;
  replayController.goToMove(payload.ply);
  isRemoteNavigation = false;
};

// Analysis sharing
mp.onReviewAnalysisStarted = (payload) => {
  peerAnalysisRunning = true;
  uiCtrl.updateStatus('Opponent is analyzing...');
};

mp.onReviewAnalysis = (payload) => {
  peerAnalysisRunning = false;
  if (replayController.isActive && payload) {
    analysisCtrl.setAnalysis(payload);
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
    gameCtrl.multiplayerActive = true;
    setMultiplayerMode(true);
    mp.connect().then(() => {
      const name = document.getElementById('mp-player-name').value.trim() || null;
      mp.joinRoom(roomCode, name);
    }).catch(() => {
      gameCtrl.multiplayerActive = false;
      setMultiplayerMode(false);
      alert('Could not connect to the multiplayer server.');
    });
  }
}

// --- New Game Wizard wiring ---

newGameMenu.onStart((config) => {
  // Apply wizard settings (chess960, evalBar, AI config, engine/ELO)
  settingsCtrl.applyWizardConfig(config);

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
    gameCtrl.multiplayerActive = true;  // Prevent startNewGame() from overwriting
    setMultiplayerMode(true);
    mp.joinRoom(code, null);
  }
});

newGameMenu.onRequestPublicRooms(async () => {
  if (!mp.ws || mp.ws.readyState !== WebSocket.OPEN) {
    try {
      await mp.connect();
    } catch (e) {
      return; // silently fail — no public rooms to show
    }
  }
  mp.requestPublicRooms();
});

mp.onPublicRoomsList = (rooms) => {
  newGameMenu.setPublicRooms(rooms);
  uiCtrl.renderPublicLobbies(rooms);
};

newGameMenu.onExit(() => {
  hardReset();
});

newGameMenu.onCustomTime(() => {
  // Set context-dependent labels based on game mode
  if (newGameMenu.getMode() === 'local') {
    customYourLabel.textContent = 'Player 1 time (min):';
    customOpponentLabel.textContent = 'Player 2 time (min):';
  } else {
    customYourLabel.textContent = 'Your time (min):';
    customOpponentLabel.textContent = "Opponent's time (min):";
  }
  customTimeModal.classList.remove('hidden');
});

// Lobby cam mode change — update activeCamMode, notify opponent, and switch live video
mpUI.onCamChange((mode) => {
  activeCamMode = mode;
  mp.proposeSetting('camMode', mode);
  uiCtrl.applyCamMode(mode);
});

// Waiting room color preference — flip board to preview selected color and update names
mpUI.onColorPreferenceChange((pref) => {
  const asBlack = pref === 'black';
  board.setFlipped(asBlack);
  appEl.classList.toggle('board-flipped', asBlack);
  playerNameWhite.textContent = asBlack ? 'Opponent' : 'You';
  playerNameBlack.textContent = asBlack ? 'You' : 'Opponent';
  playerNameWhite.classList.toggle('multiplayer-opponent', asBlack);
  playerNameBlack.classList.toggle('multiplayer-opponent', !asBlack);
});

// --- Route handlers ---

// Helper: fetch a game by server ID and enter replay mode
async function loadGameById(gameId) {
  const id = parseInt(gameId, 10);
  if (isNaN(id)) {
    router.navigate('/');
    return;
  }
  try {
    const rec = await db.getGame(id);
    if (rec && rec.moves && rec.moves.length > 0) {
      replayController.enter(rec);
    } else {
      console.warn(`Game ${id} not found or has no moves`);
      router.navigate('/');
    }
  } catch (e) {
    console.error('Failed to load game:', id, e);
    uiCtrl.updateStatus('Could not load game — please try again');
    router.navigate('/');
  }
}

router.on('/', ({ params }) => {
  const gameId = params.get('gameid');
  if (gameId) { loadGameById(gameId); return; }
  gameBrowser.close();
  if (replayController.isActive) replayController.exit(true);
  else if (gameCtrl.moveCount === 0) startNewGame();
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
  // Set gameCtrl.multiplayerActive BEFORE routing so startNewGame() won't overwrite the join
  const hasRoomCode = new URLSearchParams(window.location.search).has('room');
  if (hasRoomCode) { gameCtrl.multiplayerActive = true; setMultiplayerMode(true); }
  router.start();
  checkRoomCodeInUrl();
  // Start polling for public lobbies (only runs while not in a game)
  if (!gameCtrl.multiplayerActive) uiCtrl.startPublicLobbyPolling();
});
