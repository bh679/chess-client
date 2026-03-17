import { Game } from './game.js';

/**
 * Client-side bughouse game state.
 * Wraps two Game instances (one per board) and piece pools.
 */
class BughouseGame {
  constructor() {
    this.boardA = new Game();
    this.boardB = new Game();
    this.pools = {
      a: { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } },
      b: { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } },
    };
    this._myBoard = 'a';
    this._myColor = 'w';
    this._myTeam = 'alpha';
    this._finished = false;
  }

  init(startPayload) {
    this.boardA.newGame(false, startPayload.boards.a.fen);
    this.boardB.newGame(false, startPayload.boards.b.fen);
    this._myBoard = startPayload.you.board;
    this._myColor = startPayload.you.color;
    this._myTeam = startPayload.you.team;
    this._finished = false;
    if (startPayload.pools) {
      this.pools = startPayload.pools;
    }
  }

  getMyGame() {
    return this._myBoard === 'a' ? this.boardA : this.boardB;
  }

  getPartnerGame() {
    return this._myBoard === 'a' ? this.boardB : this.boardA;
  }

  getMyBoard() {
    return this._myBoard;
  }

  getPartnerBoard() {
    return this._myBoard === 'a' ? 'b' : 'a';
  }

  getMyColor() {
    return this._myColor;
  }

  getMyTeam() {
    return this._myTeam;
  }

  getGame(boardId) {
    return boardId === 'a' ? this.boardA : this.boardB;
  }

  applyMove(boardId, san) {
    const game = this.getGame(boardId);
    return game.makeMoveSan(san);
  }

  /**
   * Apply a drop move by loading the new FEN.
   * The server sends us the validated FEN, so we just load it.
   */
  applyDrop(boardId, fen) {
    const game = this.getGame(boardId);
    game.chess.load(fen);
    return { success: true };
  }

  updatePools(pools) {
    this.pools = pools;
  }

  /**
   * Get the pool for the current player's board and color.
   * This is what the player can drop from.
   */
  getMyPool() {
    return this.pools[this._myBoard]?.[this._myColor] || { p: 0, n: 0, b: 0, r: 0, q: 0 };
  }

  isMyTurn() {
    const myGame = this.getMyGame();
    return myGame.getTurn() === this._myColor;
  }

  setFinished() {
    this._finished = true;
  }

  isFinished() {
    return this._finished;
  }
}

export { BughouseGame };
