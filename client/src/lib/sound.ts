// Sound Manager — Web Audio API (no audio files needed)
class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted = typeof window !== 'undefined' ? localStorage.getItem('edubattle_muted') === 'true' : false;

  private get context(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number, duration: number,
    type: OscillatorType = 'sine', gain = 0.25, delay = 0
  ) {
    const ctx = this.context; if (!ctx) return;
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.type = type;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }, delay);
  }

  play(type: 'correct' | 'wrong' | 'combo' | 'victory' | 'tick' | 'boss-attack' | 'level-up' | 'achievement') {
    if (this._muted) return;
    switch (type) {
      case 'correct':
        this.tone(440, 0.1, 'sine', 0.2);
        this.tone(880, 0.15, 'sine', 0.2, 80);
        break;
      case 'wrong':
        this.tone(300, 0.15, 'sawtooth', 0.2);
        this.tone(200, 0.25, 'sawtooth', 0.15, 100);
        break;
      case 'combo':
        this.tone(440, 0.08, 'square', 0.15);
        this.tone(554, 0.08, 'square', 0.15, 70);
        this.tone(659, 0.15, 'square', 0.2,  140);
        break;
      case 'victory':
        [0,90,180,270,360,450].forEach((d, i) =>
          this.tone(261 * Math.pow(1.2, i), 0.15, 'square', 0.2, d));
        break;
      case 'tick':
        this.tone(1000, 0.04, 'square', 0.08);
        break;
      case 'boss-attack':
        this.tone(55, 0.5, 'sawtooth', 0.6);
        this.tone(80, 0.4, 'sawtooth', 0.4, 100);
        break;
      case 'level-up':
        [261, 329, 392, 523, 659].forEach((f, i) =>
          this.tone(f, 0.18, 'square', 0.22, i * 100));
        break;
      case 'achievement':
        this.tone(523, 0.1, 'sine', 0.25);
        this.tone(659, 0.1, 'sine', 0.25, 100);
        this.tone(784, 0.2, 'sine', 0.3,  200);
        break;
    }
  }

  toggle(): boolean {
    this._muted = !this._muted;
    localStorage.setItem('edubattle_muted', String(this._muted));
    return this._muted;
  }
  get muted() { return this._muted; }
}

export const sound = new SoundManager();
