export class Sound {
  constructor() {
    this._enabled = localStorage.getItem('soundEnabled') !== 'false';
    this._gameVolume = parseInt(localStorage.getItem('soundVolume') ?? '100', 10) / 100;
    this._sounds = {
      move:    new Audio('sounds/move.ogg'),
      capture: new Audio('sounds/capture.ogg'),
      check:   new Audio('sounds/check.ogg'),
      start:   new Audio('sounds/start.ogg'),
      victory: new Audio('sounds/victory.ogg'),
    };
    for (const audio of Object.values(this._sounds)) {
      audio.volume = this._gameVolume;
    }
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    localStorage.setItem('soundEnabled', String(enabled));
  }

  isEnabled() { return this._enabled; }

  setVolume(pct) {
    this._gameVolume = pct / 100;
    localStorage.setItem('soundVolume', String(pct));
    for (const audio of Object.values(this._sounds)) {
      audio.volume = this._gameVolume;
    }
  }

  getVolume() {
    return Math.round(this._gameVolume * 100);
  }

  _play(name) {
    if (!this._enabled || this._gameVolume === 0) return;
    const audio = this._sounds[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = this._gameVolume;
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
