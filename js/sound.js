export class Sound {
  constructor() {
    this._enabled = localStorage.getItem('soundEnabled') !== 'false';
    this._sounds = {
      move:    new Audio('sounds/move.ogg'),
      capture: new Audio('sounds/capture.mp3'),
      check:   new Audio('sounds/check.ogg'),
      start:   new Audio('sounds/start.mp3'),
      victory: new Audio('sounds/victory.ogg'),
    };
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    localStorage.setItem('soundEnabled', String(enabled));
  }

  isEnabled() { return this._enabled; }

  _play(name) {
    if (!this._enabled) return;
    const audio = this._sounds[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  onMove(result) {
    if (result.isCheckmate || result.isStalemate || result.isDraw) {
      this._play('victory');
    } else if (result.isCheck) {
      this._play('check');
    } else if (result.captured) {
      this._play('capture');
    } else {
      this._play('move');
    }
  }

  start() { this._play('start'); }
  gameOver() { this._play('victory'); }
}
