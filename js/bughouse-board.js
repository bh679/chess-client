import { Board } from './board.js';

const PIECE_NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q' };
const PIECE_TYPES = ['q', 'r', 'b', 'n', 'p'];

/**
 * Manages two Board instances for bughouse: player's board (interactive)
 * and partner's board (view-only), plus the piece pool UI.
 */
class BughouseBoard {
  constructor(myContainerEl, partnerContainerEl, myPoolEl, partnerPoolEl, myGame, partnerGame, promotionModalEl) {
    this.myBoard = new Board(myContainerEl, myGame, promotionModalEl);
    this.partnerBoard = new Board(partnerContainerEl, partnerGame, promotionModalEl);
    this.partnerBoard.setInteractive(false);
    this.partnerBoard.setAnimationsEnabled(false);

    this._myPoolEl = myPoolEl;
    this._partnerPoolEl = partnerPoolEl;
    this._myColor = 'w';
    this._partnerColor = 'b';
    this._pools = null;
    this._myBoardId = 'a';
    this._dropMode = null;
    this._dropCallback = null;

    this._buildPoolUI(this._myPoolEl);
    this._buildPoolUI(this._partnerPoolEl);
  }

  setMyColor(color) {
    this._myColor = color;
    this.myBoard.setFlipped(color === 'b');
  }

  setPartnerColor(color) {
    this._partnerColor = color;
    this.partnerBoard.setFlipped(color === 'w');
  }

  setMyBoardId(boardId) {
    this._myBoardId = boardId;
  }

  onMove(callback) {
    this.myBoard.onMove(callback);
  }

  onDrop(callback) {
    this._dropCallback = callback;
  }

  updatePools(pools) {
    this._pools = pools;
    this._renderPool(this._myPoolEl, pools[this._myBoardId]?.[this._myColor] || {}, true);
    const partnerBoardId = this._myBoardId === 'a' ? 'b' : 'a';
    this._renderPool(this._partnerPoolEl, pools[partnerBoardId]?.[this._partnerColor] || {}, false);
  }

  renderMyBoard() {
    this.myBoard.render();
  }

  renderPartnerBoard() {
    this.partnerBoard.render();
  }

  renderAll() {
    this.myBoard.render();
    this.partnerBoard.render();
  }

  setMyInteractive(enabled) {
    this.myBoard.setInteractive(enabled);
  }

  _buildPoolUI(containerEl) {
    containerEl.innerHTML = '';
    for (const pieceType of PIECE_TYPES) {
      const slot = document.createElement('div');
      slot.className = 'bughouse-pool-piece';
      slot.dataset.piece = pieceType;

      const img = document.createElement('img');
      img.className = 'pool-piece-img';
      img.draggable = false;
      img.alt = PIECE_NAMES[pieceType];
      slot.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'pool-piece-count';
      badge.textContent = '0';
      slot.appendChild(badge);

      containerEl.appendChild(slot);
    }
  }

  _renderPool(containerEl, pool, interactive) {
    for (const pieceType of PIECE_TYPES) {
      const slot = containerEl.querySelector(`[data-piece="${pieceType}"]`);
      if (!slot) continue;

      const count = pool[pieceType] || 0;
      const badge = slot.querySelector('.pool-piece-count');
      badge.textContent = count;

      const img = slot.querySelector('.pool-piece-img');
      const color = containerEl === this._myPoolEl ? this._myColor : this._partnerColor;
      img.src = `${window.chessPiecePath || 'img/pieces'}/${color}${PIECE_NAMES[pieceType]}.svg`;

      slot.classList.toggle('pool-empty', count === 0);
      slot.classList.toggle('pool-available', count > 0);

      // Remove old listeners
      const newSlot = slot.cloneNode(true);
      slot.parentNode.replaceChild(newSlot, slot);

      if (interactive && count > 0) {
        newSlot.addEventListener('click', () => {
          this._handlePoolClick(pieceType);
        });
        newSlot.style.cursor = 'pointer';
      } else {
        newSlot.style.cursor = 'default';
      }
    }
  }

  _handlePoolClick(pieceType) {
    if (this._dropMode && this._dropMode.piece === pieceType) {
      this._clearDropMode();
      return;
    }

    this._setDropMode(pieceType);
  }

  _setDropMode(piece) {
    this._clearDropMode();
    this._dropMode = { piece };

    // Highlight the selected pool piece
    const slots = this._myPoolEl.querySelectorAll('.bughouse-pool-piece');
    for (const slot of slots) {
      slot.classList.toggle('pool-selected', slot.dataset.piece === piece);
    }

    // Highlight legal drop squares on my board
    const board = this.myBoard.game.getBoard();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        const square = files[col] + ranks[row];
        const squareEl = this.myBoard.container.querySelector(`[data-square="${square}"]`);
        if (!squareEl) continue;

        const boardPiece = board[row][col];
        const rank = parseInt(square[1], 10);
        const isPawnRestricted = piece === 'p' && (rank === 1 || rank === 8);

        if (!boardPiece && !isPawnRestricted) {
          squareEl.classList.add('drop-target');
          // Add click handler for drop
          const handler = (e) => {
            e.stopPropagation();
            this._executeDrop(piece, square);
          };
          squareEl._dropHandler = handler;
          squareEl.addEventListener('click', handler, { once: true });
        }
      }
    }
  }

  _clearDropMode() {
    if (!this._dropMode) return;
    this._dropMode = null;

    // Clear pool selection
    const slots = this._myPoolEl.querySelectorAll('.bughouse-pool-piece');
    for (const slot of slots) {
      slot.classList.remove('pool-selected');
    }

    // Clear drop target highlights
    const targets = this.myBoard.container.querySelectorAll('.drop-target');
    for (const el of targets) {
      el.classList.remove('drop-target');
      if (el._dropHandler) {
        el.removeEventListener('click', el._dropHandler);
        delete el._dropHandler;
      }
    }
  }

  _executeDrop(piece, square) {
    this._clearDropMode();
    if (this._dropCallback) {
      this._dropCallback(piece, square);
    }
  }
}

export { BughouseBoard };
