/**
 * Procedural Web Audio Engine for Tactical Military Simulation.
 * Synthesizes military radio squelch, radio static based on SNR,
 * frequency hopping chirps, tactical alarms, and weapon discharges
 * without requiring external sound files.
 */
class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private staticGainNode: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.staticGainNode) {
      this.staticGainNode.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play tactical radio mic click (PTT burst)
   */
  public playRadioSquelch(isOpening: boolean = true) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Bandpass filter to emulate tactical VHF combat net radio (CNR)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isOpening ? 1800 : 900, now);
      filter.Q.setValueAtTime(3.5, now);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isOpening ? 650 : 350, now);
      osc.frequency.exponentialRampToValueAtTime(isOpening ? 1200 : 150, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // AudioContext policy fallback
    }
  }

  /**
   * Play frequency-hopping chirp (FHSS sync tone)
   */
  public playFreqHopChirp() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(2100, now + 0.03);
      osc.frequency.setValueAtTime(1750, now + 0.06);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // AudioContext policy fallback
    }
  }

  /**
   * Play warning/threat alert klaxon
   */
  public playAlertKlaxon() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Ignore
    }
  }

  /**
   * Play artillery launch and seismic rumble
   */
  public playArtilleryFire() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.8;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.18));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(320, now);
      lowpass.frequency.linearRampToValueAtTime(80, now + 0.6);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      whiteNoise.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
    } catch {
      // Ignore
    }
  }

  /**
   * Play dynamic radio message burst with static noise matched to SNR level
   */
  public playRadioMessageBurst(audioNoiseRatio: number) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      this.playRadioSquelch(true);

      const now = this.ctx.currentTime + 0.08;
      const duration = 0.5 + Math.random() * 0.4;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / this.ctx.sampleRate;
        const voiceTone = Math.sin(2 * Math.PI * 450 * t) * 0.3 + Math.sin(2 * Math.PI * 720 * t) * 0.2;
        const noise = (Math.random() * 2 - 1) * Math.min(1.0, audioNoiseRatio * 1.5 + 0.15);
        data[i] = (voiceTone * (1 - audioNoiseRatio) + noise * audioNoiseRatio) * 0.25;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0.09, now + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseSource.start(now);

      setTimeout(() => {
        this.playRadioSquelch(false);
      }, duration * 1000);
    } catch {
      // Ignore
    }
  }
}

export const audioEngine = new TacticalAudioEngine();
