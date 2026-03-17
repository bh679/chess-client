import { BughouseGame } from './bughouse-game.js';
import { BughouseBoard } from './bughouse-board.js';

/**
 * Bughouse game controller.
 * Manages the bughouse game lifecycle: start, moves, drops, timers, game end.
 */
class BughouseController {
  constructor(elements, multiplayer, sound, timerA, timerB) {
    this._mp = multiplayer;
    this._sound = sound;
    this._timerA = timerA;
    this._timerB = timerB;
    this._elements = elements;
    this._game = new BughouseGame();
    this._board = null;
    this._active = false;
    this._players = {};
    this._roomId = null;
  }

  get game() { return this._game; }
  get board() { return this._board; }
  get active() { return this._active; }
  get roomId() { return this._roomId; }

  /**
   * Start a bughouse game from a bug_game_start payload.
   */
  start(payload) {
    this._active = true;
    this._roomId = payload.roomId;
    this._players = payload.players || {};

    // Initialize game state
    this._game.init(payload);

    // Create board UI
    this._board = new BughouseBoard(
      this._elements.myBoardEl,
      this._elements.partnerBoardEl,
      this._elements.myPoolEl,
      this._elements.partnerPoolEl,
      this._game.getMyGame(),
      this._game.getPartnerGame(),
      this._elements.promotionModalEl
    );

    this._board.setMyColor(this._game.getMyColor());
    this._board.setMyBoardId(this._game.getMyBoard());

    // Determine partner color
    const partnerBoard = this._game.getPartnerBoard();
    const myTeam = this._game.getMyTeam();
    // Partner plays the opposite color on the other board
    const partnerColor = this._game.getMyColor();
    this._board.setPartnerColor(partnerColor);

    // Set up move callback
    this._board.onMove((result) => {
      this._onMyMove(result);
    });

    // Set up drop callback
    this._board.onDrop((piece, square) => {
      this._onMyDrop(piece, square);
    });

    // Update pools
    if (payload.pools) {
      this._board.updatePools(payload.pools);
    }

    // Start timers
    this._startTimers(payload);

    // Render
    this._board.renderAll();

    // Show bughouse container, hide standard
    this._showBughouseUI();
  }

  /**
   * Handle a move from the server (any board).
   */
  handleServerMove(data) {
    if (!this._active) return;

    const { board: boardId, san, fen, clocks, pools } = data;

    // Apply the move
    this._game.applyMove(boardId, san);

    // Update pools
    if (pools) {
      this._game.updatePools(pools);
      this._board.updatePools(pools);
    }

    // Update clocks
    if (clocks) {
      this._updateClocks(boardId, clocks);
    }

    // Re-render the affected board
    if (boardId === this._game.getMyBoard()) {
      this._board.renderMyBoard();
      // Play sound on my board
      if (data.captured) {
        this._sound?.playCapture();
      } else {
        this._sound?.playMove();
      }
    } else {
      this._board.renderPartnerBoard();
    }

    // Update interactivity
    this._board.setMyInteractive(this._game.isMyTurn());
  }

  /**
   * Handle a drop from the server (any board).
   */
  handleServerDrop(data) {
    if (!this._active) return;

    const { board: boardId, fen, clocks, pools } = data;

    // Apply the drop via FEN
    this._game.applyDrop(boardId, fen);

    // Update pools
    if (pools) {
      this._game.updatePools(pools);
      this._board.updatePools(pools);
    }

    // Update clocks
    if (clocks) {
      this._updateClocks(boardId, clocks);
    }

    // Re-render
    if (boardId === this._game.getMyBoard()) {
      this._board.renderMyBoard();
      this._sound?.playMove();
    } else {
      this._board.renderPartnerBoard();
    }

    // Update interactivity
    this._board.setMyInteractive(this._game.isMyTurn());
  }

  /**
   * Handle game end.
   */
  handleGameEnd(data) {
    if (!this._active) return;

    this._active = false;
    this._game.setFinished();
    this._board.setMyInteractive(false);

    // Stop timers
    this._timerA?.stop();
    this._timerB?.stop();

    // Show result
    const { result, reason, winningTeam, decidingBoard } = data;
    const myTeam = this._game.getMyTeam();
    const won = winningTeam === myTeam;
    const isDraw = !winningTeam;

    let message;
    if (isDraw) {
      message = `Draw - ${reason}`;
    } else if (won) {
      message = `You win! (${reason} on board ${decidingBoard.toUpperCase()})`;
    } else {
      message = `You lose (${reason} on board ${decidingBoard.toUpperCase()})`;
    }

    this._showGameEndOverlay(message, won, isDraw);
  }

  /**
   * Handle reconnection — restore full state.
   */
  handleReconnect(data) {
    // Reconstruct a game_start-like payload from reconnect data
    const startPayload = {
      roomId: data.roomId,
      boards: {
        a: { fen: data.boards.a.fen },
        b: { fen: data.boards.b.fen },
      },
      pools: data.pools,
      players: data.players,
      timeControl: data.timeControl,
      you: data.you,
    };

    this.start(startPayload);

    // Replay moves to restore last-move highlights
    // (FEN is already at the correct position)
  }

  /**
   * Clean up bughouse state.
   */
  cleanup() {
    this._active = false;
    this._timerA?.stop();
    this._timerB?.stop();
    this._hideBughouseUI();
  }

  // --- Private methods ---

  _onMyMove(result) {
    if (!this._active) return;
    if (!result.success) return;

    // Send to server
    this._mp.sendBughouseMove(result.san);

    // Play sound
    if (result.captured) {
      this._sound?.playCapture();
    } else {
      this._sound?.playMove();
    }

    // Disable interaction until it's our turn again
    this._board.setMyInteractive(false);
  }

  _onMyDrop(piece, square) {
    if (!this._active) return;
    if (!this._game.isMyTurn()) return;

    // Send to server
    this._mp.sendBughouseDrop(piece, square);

    // Disable interaction until confirmed
    this._board.setMyInteractive(false);
  }

  _startTimers(payload) {
    // Timers will be updated by clock sync messages
    // For now just set initial values from time control
  }

  _updateClocks(boardId, clocks) {
    // Update timer displays
    const timer = boardId === 'a' ? this._timerA : this._timerB;
    if (timer && clocks) {
      // Timer update logic — depends on Timer class API
    }
  }

  _showBughouseUI() {
    const container = document.getElementById('bughouse-container');
    if (container) container.classList.remove('hidden');

    // Hide standard board elements via a class on the app
    const appEl = document.querySelector('.app');
    if (appEl) appEl.classList.add('bughouse-active');
  }

  _hideBughouseUI() {
    const container = document.getElementById('bughouse-container');
    if (container) container.classList.add('hidden');

    const appEl = document.querySelector('.app');
    if (appEl) appEl.classList.remove('bughouse-active');
  }

  _showGameEndOverlay(message, won, isDraw) {
    // Create or show an overlay with the result
    let overlay = document.getElementById('bughouse-result-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bughouse-result-overlay';
      overlay.className = 'bughouse-result-overlay';
      document.getElementById('bughouse-container')?.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="bughouse-result-message ${won ? 'win' : isDraw ? 'draw' : 'loss'}">
        <h2>${message}</h2>
        <button class="bughouse-result-close" onclick="this.closest('.bughouse-result-overlay').classList.add('hidden')">OK</button>
      </div>
    `;
    overlay.classList.remove('hidden');
  }
}

export { BughouseController };
