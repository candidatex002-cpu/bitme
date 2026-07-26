export class AudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicEnabled: boolean = true;
  private musicTimer: any = null;
  private musicStep: number = 0;

  // Upbeat, calm copyright-free pentatonic melody sequence
  private melodyNotes: number[] = [
    523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99,
    659.25, 587.33, 523.25, 440.00, 523.25, 659.25, 783.99, 659.25
  ];

  constructor() {
    // AudioContext initialized on user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // SFX mute only — background music is a separate channel (see setMusicEnabled).
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) this.playChime();
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --- Background music (independent of the SFX mute) ---
  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (on) this.ensureMusic();
    else this.stopMusic();
  }

  // Start the loop as soon as the browser lets us — audio needs a user gesture to unlock,
  // so this is safe to call on page load AND from the first tap/click/keypress.
  public ensureMusic() {
    if (!this.musicEnabled || this.musicTimer) return;
    this.initCtx();
    if (!this.ctx) return;
    const tryStart = () => {
      if (this.musicEnabled && !this.musicTimer && this.ctx && this.ctx.state === 'running') this.startMusicLoop();
    };
    if (this.ctx.state === 'running') tryStart();
    else this.ctx.resume().then(tryStart).catch(() => { /* still locked — retries on next gesture */ });
  }

  // Back-compat: a match starting just ensures music is going (respects the on/off setting).
  public startMusic() {
    this.ensureMusic();
  }

  // --- Additive 100% Copyright-Free Web Audio Background Music Loop ---
  private startMusicLoop() {
    if (this.musicTimer) return;

    // Play a gentle, soothing pentatonic note every 320ms
    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || !this.ctx) return;
      const freq = this.melodyNotes[this.musicStep % this.melodyNotes.length];
      this.musicStep++;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Soft sine wave for a dreamy kawaii vibe
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, this.ctx.currentTime); // Soft octave

        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch { /* */ }
    }, 320);
  }

  public stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playChime() {
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(987.77, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playEat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playDeath() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  public playFanfare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startTime = this.ctx!.currentTime + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }
}

export const audio = new AudioSystem();
