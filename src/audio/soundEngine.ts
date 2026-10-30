class ArcadeSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  // Continuous sound oscillators / nodes
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenType: "NORMAL" | "FRIGHTENED" | "EYES" | "NONE" = "NONE";
  private wakaFlip: boolean = false;
  private lastWakaTime: number = 0;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxCtor) {
        this.ctx = new AudioCtxCtor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(enabled ? this.volume : 0, this.ctx.currentTime);
    }
    if (!enabled) {
      this.stopSiren();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && this.enabled) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getEnabled() {
    return this.enabled;
  }

  public getVolume() {
    return this.volume;
  }

  // Play intro game start music
  public playIntro(): Promise<void> {
    this.initCtx();
    if (!this.ctx || !this.enabled || !this.masterGain) return Promise.resolve();

    const ctx = this.ctx;
    const now = ctx.currentTime + 0.05;

    // Classic arcade Pac-Man intro notes & durations (approx frequencies)
    // B4, B5, F#5, D#5, B5, F#5, D#5, C5, C6, G5, E5, C6, G5, E5, B4, B5, F#5, D#5, B5, F#5, D#5, D#5, E5, F5, F5, F#5, G5, G#5, A5, B5
    const notes: Array<{ f: number; d: number }> = [
      { f: 493.88, d: 0.12 }, // B4
      { f: 987.77, d: 0.12 }, // B5
      { f: 739.99, d: 0.12 }, // F#5
      { f: 622.25, d: 0.12 }, // D#5
      { f: 987.77, d: 0.08 }, // B5
      { f: 739.99, d: 0.14 }, // F#5
      { f: 622.25, d: 0.22 }, // D#5

      { f: 523.25, d: 0.12 }, // C5
      { f: 1046.5, d: 0.12 }, // C6
      { f: 783.99, d: 0.12 }, // G5
      { f: 659.25, d: 0.12 }, // E5
      { f: 1046.5, d: 0.08 }, // C6
      { f: 783.99, d: 0.14 }, // G5
      { f: 659.25, d: 0.22 }, // E5

      { f: 493.88, d: 0.12 }, // B4
      { f: 987.77, d: 0.12 }, // B5
      { f: 739.99, d: 0.12 }, // F#5
      { f: 622.25, d: 0.12 }, // D#5
      { f: 987.77, d: 0.08 }, // B5
      { f: 739.99, d: 0.14 }, // F#5
      { f: 622.25, d: 0.22 }, // D#5

      { f: 622.25, d: 0.06 }, // D#5
      { f: 659.25, d: 0.06 }, // E5
      { f: 698.46, d: 0.06 }, // F5
      { f: 698.46, d: 0.06 },
      { f: 739.99, d: 0.06 }, // F#5
      { f: 783.99, d: 0.06 }, // G5
      { f: 830.61, d: 0.06 }, // G#5
      { f: 880.0, d: 0.06 }, // A5
      { f: 987.77, d: 0.28 }, // B5
    ];

    let t = now;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + n.d);
      t += n.d;
    });

    return new Promise((resolve) => {
      setTimeout(resolve, (t - now) * 1000);
    });
  }

  // Waka-waka dot eating sound
  public playWaka() {
    this.initCtx();
    if (!this.ctx || !this.enabled || !this.masterGain) return;

    const now = this.ctx.currentTime;
    if (now - this.lastWakaTime < 0.07) return; // Prevent audio congestion
    this.lastWakaTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";

    this.wakaFlip = !this.wakaFlip;
    const startFreq = this.wakaFlip ? 360 : 480;
    const endFreq = this.wakaFlip ? 480 : 360;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.07);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Eat ghost sound
  public playEatGhost() {
    this.initCtx();
    if (!this.ctx || !this.enabled || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.35);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Fruit eat sound
  public playEatFruit() {
    this.initCtx();
    if (!this.ctx || !this.enabled || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.06;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  // Death sound
  public playDeath(): Promise<void> {
    this.initCtx();
    this.stopSiren();
    if (!this.ctx || !this.enabled || !this.masterGain) return Promise.resolve();

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    // Classic Pac-Man death descending pitch sweep with stepped slides
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 1.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.2);

    // Final pop
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      const popNow = this.ctx.currentTime;
      popOsc.type = "sine";
      popOsc.frequency.setValueAtTime(120, popNow);
      popOsc.frequency.exponentialRampToValueAtTime(40, popNow + 0.15);
      popGain.gain.setValueAtTime(0.35, popNow);
      popGain.gain.exponentialRampToValueAtTime(0.01, popNow + 0.15);

      popOsc.connect(popGain);
      popGain.connect(this.masterGain);
      popOsc.start(popNow);
      popOsc.stop(popNow + 0.15);
    }, 1250);

    return new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Extra life chime
  public playExtraLife() {
    this.initCtx();
    if (!this.ctx || !this.enabled || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const notes = [659.25, 783.99, 987.77, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.08;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // Background Siren management
  public updateSiren(mode: "NORMAL" | "FRIGHTENED" | "EYES" | "NONE", dotsRatio: number = 1) {
    if (!this.enabled) {
      this.stopSiren();
      return;
    }
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    if (mode === "NONE") {
      this.stopSiren();
      return;
    }

    if (this.sirenType !== mode || !this.sirenOsc) {
      this.stopSiren();
      this.sirenType = mode;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (mode === "NORMAL") {
        osc.type = "sawtooth";
        // Base frequency scales up as dots decrease (from 140Hz up to 260Hz)
        const baseFreq = 140 + (1 - dotsRatio) * 120;
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      } else if (mode === "FRIGHTENED") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      } else if (mode === "EYES") {
        osc.type = "square";
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();

      this.sirenOsc = osc;
      this.sirenGain = gain;
    } else if (mode === "NORMAL" && this.sirenOsc) {
      // Modulate frequency dynamically with remaining dots
      const baseFreq = 140 + (1 - dotsRatio) * 120;
      this.sirenOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.2);
    }
  }

  public stopSiren() {
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenOsc.disconnect();
      } catch {
        // ignore
      }
      this.sirenOsc = null;
    }
    if (this.sirenGain) {
      try {
        this.sirenGain.disconnect();
      } catch {
        // ignore
      }
      this.sirenGain = null;
    }
    this.sirenType = "NONE";
  }
}

export const soundEngine = new ArcadeSoundEngine();
