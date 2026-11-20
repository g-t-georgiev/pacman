import { GAME_START_FRAMES } from "../game/RoundSequencer";
import { SIM_FPS } from "../game/constants";

/**
 * Procedural sounds (S1/S2). The arcade used a 3-voice wavetable chip (32-step, 4-bit waveforms);
 * we approximate its character with our own small wavetables and pitch sweeps, matched by ear to
 * the original's behavior: when each sound plays, its rhythm, pitch range and shape. No samples or
 * data from the original are used. The sirens' pitches and rhythms, and the death sound's length,
 * were measured on footage of the original (docs/footage/2026-11-19.md); the other sounds' pitches
 * and lengths are estimates.
 */

type SirenKind = "NORMAL" | "FRIGHTENED" | "EYES" | "NONE";

/** A 32-step, 4-bit waveform (values 0-15), like the arcade chip's wavetables. Our own shapes. */
const WAVES = {
  /** A rounded tone: sine quantized to 16 levels (the slight grit of a 4-bit table). */
  soft: Array.from({ length: 32 }, (_, i) =>
    Math.round(7.5 + 7.5 * Math.sin((i / 32) * 2 * Math.PI))
  ),
  /** A reedy, buzzy tone for the chomp and the death sound: a lopsided triangle. */
  buzz: Array.from({ length: 32 }, (_, i) =>
    i < 12 ? Math.round((i / 11) * 15) : Math.round(15 - ((i - 12) / 19) * 15)
  ),
  /** A rough, nasal tone for the chomp: a stepped saw with a notch. */
  rasp: Array.from({ length: 32 }, (_, i) =>
    i < 4 ? 15 : i < 8 ? 3 : i < 20 ? Math.round(15 - ((i - 8) / 11) * 12) : i < 24 ? 12 : 0
  ),
  /** A hollow pulse for beeps. */
  pulse: Array.from({ length: 32 }, (_, i) => (i < 10 ? 15 : i < 14 ? 8 : 0)),
};
type WaveName = keyof typeof WAVES;

/** The death sound's length: about 1.5 s on footage of the original (docs/footage/2026-11-19.md). */
const DEATH_SOUND_SECONDS = 1.5;

/**
 * Normal siren per stage: lowest and highest pitch (Hz) and the length of one up-down sweep (s),
 * a straight sweep in Hz. Measured on footage of the original, good to about 30 Hz and 0.01 s
 * (docs/footage/2026-11-19.md).
 */
const SIREN_STAGES: ReadonlyArray<{ lo: number; hi: number; period: number }> = [
  { lo: 440, hi: 1000, period: 0.42 },
  { lo: 495, hi: 1180, period: 0.35 },
  { lo: 620, hi: 1320, period: 0.33 },
  { lo: 760, hi: 1510, period: 0.3 },
  { lo: 900, hi: 1680, period: 0.27 },
];
/**
 * Frightened: a fast rising sweep, 7.5 a second. Eyes: a slower falling one from high up, about 4 a
 * second. Pitches in Hz, measured on footage of the original (docs/footage/2026-11-19.md).
 */
const FRIGHTENED_SIREN = { lo: 470, hi: 2420, rate: 7.5 };
const EYES_SIREN = { lo: 600, hi: 2650, rate: 3.8 };

/** One frequency point of a sweep: seconds from the sound's start, Hz. */
type Sweep = Array<[number, number]>;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;
  private waves = new Map<WaveName, PeriodicWave>();

  // The siren: one tone whose pitch an LFO sweeps; kept running and re-tuned on state changes
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenDepth: GainNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenType: SirenKind = "NONE";
  private sirenStageNow = -1;

  private wakaFlip: boolean = false;
  private lastWakaTime: number = 0;
  private introNodes: OscillatorNode[] = [];

  private initCtx() {
    if (typeof window === "undefined") return;
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

  /** The PeriodicWave for a 32-step table (its Fourier series, first 16 harmonics). */
  private wave(name: WaveName): PeriodicWave {
    const cached = this.waves.get(name);
    if (cached) return cached;
    const table = WAVES[name];
    const n = table.length;
    // The chip plays the table as a staircase (each step held), and the hard steps are where
    // its grit comes from: take the staircase's own Fourier series, well past the table's 16
    // smooth harmonics.
    const harmonics = 64;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) {
      const w = 2 * Math.PI * k;
      for (let i = 0; i < n; i++) {
        const v = (table[i] - 7.5) / 7.5;
        const t0 = i / n;
        const t1 = (i + 1) / n;
        real[k] += (2 * v * (Math.sin(w * t1) - Math.sin(w * t0))) / w;
        imag[k] += (2 * v * (Math.cos(w * t0) - Math.cos(w * t1))) / w;
      }
    }
    const periodic = this.ctx!.createPeriodicWave(real, imag);
    this.waves.set(name, periodic);
    return periodic;
  }

  /**
   * Plays one note: a wavetable tone following `sweep` (linear ramps between its points) at
   * `level`, starting `delay` s from now, with a short release so it doesn't click.
   */
  private tone(wave: WaveName, sweep: Sweep, level: number, delay = 0): OscillatorNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const t0 = this.ctx.currentTime + delay;
    const end = t0 + sweep[sweep.length - 1][0];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.setPeriodicWave(this.wave(wave));
    osc.frequency.setValueAtTime(sweep[0][1], t0);
    for (const [at, hz] of sweep.slice(1)) osc.frequency.linearRampToValueAtTime(hz, t0 + at);
    gain.gain.setValueAtTime(level, t0);
    gain.gain.setValueAtTime(level, Math.max(t0, end - 0.01));
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(end + 0.01);
    return osc;
  }

  private ready(): boolean {
    this.initCtx();
    return !!this.ctx && this.enabled && !!this.masterGain;
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

  /** Which siren is playing (for the agent driver and debugging). */
  public get sirenStatus(): { kind: SirenKind; stage: number } {
    return { kind: this.sirenType, stage: this.sirenStageNow };
  }

  /**
   * The start tune, two voices (melody and bass), stretched to end just before READY does.
   * A new start cuts off a tune still playing.
   */
  public playIntro(): Promise<void> {
    for (const node of this.introNodes) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    this.introNodes = [];
    if (!this.ready()) return Promise.resolve();

    // Melody in beats (B, C, B phrases, then the closing run), as [Hz, beats]
    const B4 = 493.88,
      B5 = 987.77,
      Fs5 = 739.99,
      Ds5 = 622.25,
      C5 = 523.25,
      C6 = 1046.5;
    const G5 = 783.99,
      E5 = 659.25,
      F5 = 698.46,
      Gs5 = 830.61,
      A5 = 880.0;
    const phrase = (
      root: number,
      oct: number,
      fifth: number,
      third: number
    ): Array<[number, number]> => [
      [root, 1],
      [oct, 1],
      [fifth, 1],
      [third, 1],
      [oct, 0.5],
      [fifth, 1],
      [third, 1.5],
    ];
    const melody: Array<[number, number]> = [
      ...phrase(B4, B5, Fs5, Ds5),
      ...phrase(C5, C6, G5, E5),
      ...phrase(B4, B5, Fs5, Ds5),
      [Ds5, 0.5],
      [E5, 0.5],
      [F5, 1],
      [F5, 0.5],
      [Fs5, 0.5],
      [G5, 1],
      [G5, 0.5],
      [Gs5, 0.5],
      [A5, 1],
      [B5, 2],
    ];
    const beats = melody.reduce((sum, [, b]) => sum + b, 0);
    const length = GAME_START_FRAMES / SIM_FPS - 0.15;
    const beat = length / beats;

    let at = 0;
    for (const [hz, b] of melody) {
      const d = b * beat;
      const node = this.tone(
        "soft",
        [
          [0, hz],
          [d * 0.9, hz],
        ],
        0.16,
        at
      );
      if (node) this.introNodes.push(node);
      at += d;
    }
    // Bass: root and octave on every beat, following the phrase's chord (B, C, B, then G-A-B)
    const bassRoots: number[] = [];
    const phraseBeats = 7;
    for (const root of [123.47, 130.81, 123.47])
      for (let i = 0; i < phraseBeats; i++) bassRoots.push(root);
    for (const root of [155.56, 155.56, 174.61, 196.0, 196.0, 220.0, 246.94, 246.94])
      bassRoots.push(root);
    bassRoots.forEach((root, i) => {
      if (i * beat >= length) return;
      const hz = i % 2 === 0 ? root : root * 2;
      const node = this.tone(
        "buzz",
        [
          [0, hz],
          [beat * 0.8, hz],
        ],
        0.12,
        i * beat
      );
      if (node) this.introNodes.push(node);
    });

    return new Promise((resolve) => setTimeout(resolve, length * 1000));
  }

  /** One half of the chomp per dot, alternating a falling and a rising sweep ("wa", "ka"). */
  public playWaka() {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastWakaTime < 0.06) return; // turbo: don't pile up
    this.lastWakaTime = now;
    this.wakaFlip = !this.wakaFlip;
    const [from, to] = this.wakaFlip ? [880, 330] : [330, 880];
    this.tone(
      "rasp",
      [
        [0, from],
        [0.1, to],
      ],
      0.2
    );
  }

  /** Eating a ghost: a rising sweep, about half a second (the eat pause is 1 s). */
  public playEatGhost() {
    if (!this.ready()) return;
    this.tone(
      "soft",
      [
        [0, 150],
        [0.15, 330],
        [0.5, 1150],
      ],
      0.22
    );
  }

  /** Eating the fruit: a quick dip and rise. */
  public playEatFruit() {
    if (!this.ready()) return;
    this.tone(
      "soft",
      [
        [0, 900],
        [0.17, 300],
        [0.36, 950],
      ],
      0.2
    );
  }

  /**
   * The death sound: wobbling chirps that fall in pitch, then two short falling blips. It is
   * shorter than the animation (1.8 s), as on the original.
   */
  public playDeath(): Promise<void> {
    this.stopSiren();
    const length = DEATH_SOUND_SECONDS;
    if (!this.ready()) return Promise.resolve();

    const chirps = 11;
    const chirpLength = (length * 0.77) / chirps;
    for (let i = 0; i < chirps; i++) {
      const lo = 620 * Math.pow(0.88, i);
      const hi = lo * 1.6;
      this.tone(
        "buzz",
        [
          [0, lo],
          [chirpLength * 0.6, hi],
          [chirpLength, lo * 0.9],
        ],
        0.2,
        i * chirpLength
      );
    }
    for (const at of [length * 0.83, length * 0.93]) {
      this.tone(
        "soft",
        [
          [0, 950],
          [0.09, 180],
        ],
        0.22,
        at
      );
    }
    return new Promise((resolve) => setTimeout(resolve, length * 1000));
  }

  /** The extra life: a run of short high beeps, about 2 s. */
  public playExtraLife() {
    if (!this.ready()) return;
    for (let i = 0; i < 12; i++)
      this.tone(
        "pulse",
        [
          [0, 1180],
          [0.08, 1180],
        ],
        0.12,
        i * 0.16
      );
  }

  /**
   * The background siren: switches at once to the requested state (like the arcade), and re-tunes
   * the normal siren when its stage changes. `stage` is 0-4 (normal / spurt 1-4).
   */
  public updateSiren(mode: SirenKind, stage: number = 0) {
    if (!this.enabled || mode === "NONE") {
      this.stopSiren();
      return;
    }
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;
    if (mode === this.sirenType && (mode !== "NORMAL" || stage === this.sirenStageNow)) return;

    if (!this.sirenOsc) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.setPeriodicWave(this.wave("soft"));
      lfo.connect(depth);
      depth.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      lfo.start();
      this.sirenOsc = osc;
      this.sirenLfo = lfo;
      this.sirenDepth = depth;
      this.sirenGain = gain;
    }

    const now = this.ctx.currentTime;
    let lo: number, hi: number, rate: number, level: number;
    if (mode === "NORMAL") {
      const s = SIREN_STAGES[Math.max(0, Math.min(SIREN_STAGES.length - 1, stage))];
      ({ lo, hi } = s);
      rate = 1 / s.period;
      level = 0.07;
      this.sirenLfo!.type = "triangle"; // up and down
    } else if (mode === "FRIGHTENED") {
      ({ lo, hi, rate } = FRIGHTENED_SIREN);
      level = 0.08;
      this.sirenLfo!.type = "sawtooth"; // rising ramps
    } else {
      ({ lo, hi, rate } = EYES_SIREN);
      level = 0.06;
      this.sirenLfo!.type = "sawtooth";
    }
    const falling = mode === "EYES";
    this.sirenOsc.frequency.setValueAtTime((lo + hi) / 2, now);
    this.sirenDepth!.gain.setValueAtTime(((hi - lo) / 2) * (falling ? -1 : 1), now);
    this.sirenLfo!.frequency.setValueAtTime(rate, now);
    this.sirenGain!.gain.setValueAtTime(level, now);
    this.sirenType = mode;
    this.sirenStageNow = mode === "NORMAL" ? stage : -1;
  }

  public stopSiren() {
    for (const node of [this.sirenOsc, this.sirenLfo]) {
      if (!node) continue;
      try {
        node.stop();
        node.disconnect();
      } catch {
        // ignore
      }
    }
    for (const node of [this.sirenDepth, this.sirenGain]) {
      try {
        node?.disconnect();
      } catch {
        // ignore
      }
    }
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenDepth = null;
    this.sirenGain = null;
    this.sirenType = "NONE";
    this.sirenStageNow = -1;
  }
}

const soundEngine = new SoundEngine();

export default soundEngine;
