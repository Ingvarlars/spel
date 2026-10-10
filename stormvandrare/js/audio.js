'use strict';
// Ljudeffekter som syntetiseras med Web Audio API (inga ljudfiler).
// Ljudkontexten skapas vid första användarhändelsen.

const Sound = {
  ctx: null,
  master: null,
  sfx: null,
  musicBus: null,
  noiseBuf: null,
  volume: 0.7,
  sfxVolume: 0.9,
  musicVolume: 0.55,
  muted: false,
  last: Object.create(null),
  loops: {},

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain();
      // En lätt kompressor håller ihop mixen.
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.connect(this.master);
      // Rumsklang (enkel ekoslinga) för en känsla av vidd.
      this.reverb = c.createDelay(1);
      this.reverb.delayTime.value = 0.23;
      const fb = c.createGain(); fb.gain.value = 0.32;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      this.reverb.connect(lp); lp.connect(fb); fb.connect(this.reverb);
      const wet = c.createGain(); wet.gain.value = 0.22;
      lp.connect(wet); wet.connect(this.master);
      this.applyVolume();
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startLoops();
    } catch (e) { this.ctx = null; }
  },

  applyVolume() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.sfx.gain.value = this.sfxVolume;
    this.musicBus.gain.value = this.musicVolume;
  },

  ready() { return this.ctx && this.ctx.state === 'running' && !this.muted; },

  throttle(name, gap) {
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < gap) return false;
    this.last[name] = now;
    return true;
  },

  // Grundbyggstenar.
  tone(type, f0, f1, dur, vol, delay, dest, attack) {
    const c = this.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    if (!dest) g.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  },

  noise(filter, f0, f1, dur, vol, q, delay, attack) {
    const c = this.ctx, t = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  },

  // Metallisk klang (karapax och Shardblade).
  clang(base, vol) {
    for (const k of [1, 2.76, 5.4, 8.9]) this.tone('sine', base * k, base * k * 0.995, 0.5 / Math.sqrt(k), vol / k);
  },

  play(name, x) {
    if (!this.ready()) return;
    const v = x === undefined ? 1 : x; // valfri volymfaktor (t.ex. avstånd)
    switch (name) {
      case 'swing':
        if (this.throttle(name, 0.05)) { this.noise('bandpass', 700, 3200, 0.2, 0.22 * v, 2.5); this.tone('sine', 1800, 2600, 0.12, 0.03 * v); }
        break;
      case 'swingHeavy':
        this.noise('bandpass', 400, 2400, 0.32, 0.3 * v, 2); this.tone('triangle', 220, 110, 0.3, 0.06 * v);
        break;
      case 'hit':
        if (this.throttle(name, 0.04)) { this.noise('lowpass', 2400, 300, 0.16, 0.3 * v); this.tone('sine', 160, 70, 0.14, 0.18 * v); }
        break;
      case 'clang':
        if (this.throttle(name, 0.08)) { this.clang(rand(520, 640), 0.12 * v); this.noise('highpass', 4000, 2000, 0.08, 0.08 * v); }
        break;
      case 'kill':
        if (this.throttle(name, 0.06)) { this.noise('lowpass', 1600, 120, 0.5, 0.3 * v); this.tone('sine', 900, 1800, 0.4, 0.04 * v, 0.05); }
        break;
      case 'lash':
        this.noise('bandpass', 300, 2600, 0.35, 0.18, 3);
        this.tone('sine', 660, 1320, 0.35, 0.06);
        this.tone('sine', 990, 1980, 0.3, 0.04, 0.05);
        break;
      case 'lashMore':
        this.tone('sine', 880, 1760, 0.3, 0.06); this.noise('bandpass', 800, 3000, 0.2, 0.12, 4);
        break;
      case 'lashReset':
        this.tone('sine', 880, 440, 0.25, 0.05); this.noise('bandpass', 2000, 500, 0.2, 0.08, 3);
        break;
      case 'fail':
        this.tone('triangle', 220, 160, 0.15, 0.06);
        break;
      case 'dash':
        this.noise('bandpass', 500, 3500, 0.25, 0.25, 2); this.tone('sine', 1200, 2400, 0.2, 0.04);
        break;
      case 'jump':
        if (this.throttle(name, 0.1)) this.noise('bandpass', 400, 1200, 0.12, 0.06, 2);
        break;
      case 'step':
        if (this.throttle(name, 0.12)) this.noise('lowpass', rand(500, 800), 120, 0.07, 0.05 * v);
        break;
      case 'land':
        this.noise('lowpass', 900, 100, 0.2, 0.15 * v); this.tone('sine', 120, 50, 0.18, 0.12 * v);
        break;
      case 'slam':
        this.noise('lowpass', 1400, 60, 0.9, 0.5); this.tone('sine', 90, 30, 0.8, 0.45);
        break;
      case 'draw':
        if (this.throttle(name, 0.06)) { this.tone('sine', rand(1400, 1700), rand(2000, 2400), 0.35, 0.035); this.tone('sine', 2600, 3200, 0.3, 0.015, 0.05); }
        break;
      case 'sphere':
        if (this.throttle(name, 0.05)) { this.tone('sine', 2400, 2350, 0.25, 0.04); this.tone('sine', 3600, 3550, 0.2, 0.02, 0.03); }
        break;
      case 'gemheart':
        for (const [f, d] of [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24]]) this.tone('sine', f, f, 1.6, 0.07, d, undefined, 0.05);
        break;
      case 'heal':
        this.tone('triangle', 440, 660, 0.4, 0.06); this.tone('triangle', 660, 990, 0.4, 0.04, 0.1);
        break;
      case 'hurt':
        this.noise('lowpass', 1200, 200, 0.25, 0.25); this.tone('square', 180, 80, 0.2, 0.05);
        break;
      case 'arrow':
        if (this.throttle(name, 0.08)) { this.noise('highpass', 3000, 1500, 0.12, 0.08 * v, 2); this.tone('triangle', 300, 200, 0.06, 0.04 * v); }
        break;
      case 'parry':
        this.clang(880, 0.12); this.noise('highpass', 5000, 3000, 0.1, 0.1);
        break;
      case 'thunderCharge':
        this.noise('bandpass', 200, 2000, 1.1, 0.1 * v, 6, 0, 0.8); this.tone('sawtooth', 60, 120, 1.1, 0.03 * v, 0, undefined, 0.6);
        break;
      case 'redBolt':
        this.noise('highpass', 6000, 800, 0.35, 0.35 * v); this.tone('sawtooth', 80, 40, 0.4, 0.15 * v);
        break;
      case 'thunder':
        this.noise('lowpass', 900, 40, 2.4, 0.5 * v, 1, 0.1, 0.05); this.noise('lowpass', 3000, 300, 0.3, 0.2 * v);
        break;
      case 'roar':
        this.tone('sawtooth', 70, 45, 1.6, 0.2, 0, undefined, 0.2); this.tone('sawtooth', 105, 60, 1.5, 0.12, 0.05, undefined, 0.2); this.noise('lowpass', 600, 150, 1.6, 0.3, 2, 0, 0.2);
        break;
      case 'bossSlam':
        this.tone('sine', 55, 25, 1.4, 0.6); this.noise('lowpass', 800, 40, 1.4, 0.6);
        break;
      case 'bossSpawn':
        this.tone('sawtooth', 55, 55, 2.5, 0.08, 0, undefined, 0.8); this.tone('sawtooth', 82, 82, 2.5, 0.06, 0.2, undefined, 0.8); this.noise('lowpass', 300, 100, 2.5, 0.2, 1, 0, 0.6);
        break;
      case 'ideal':
        // Ett körliknande ackord som stiger.
        for (const [f, d] of [[392, 0], [494, 0.15], [587, 0.3], [784, 0.45], [988, 0.6]]) { this.tone('sine', f, f * 1.005, 3, 0.06, d, undefined, 0.3); this.tone('triangle', f * 2, f * 2, 2.2, 0.015, d, undefined, 0.3); }
        break;
      case 'stormHorn':
        this.tone('sawtooth', 110, 104, 2.2, 0.08, 0, undefined, 0.4); this.tone('sawtooth', 165, 158, 2.2, 0.05, 0, undefined, 0.4);
        break;
      case 'ui':
        this.tone('sine', 660, 880, 0.08, 0.06);
        break;
      case 'spear':
        this.noise('bandpass', 1200, 4000, 0.3, 0.2, 3); this.tone('sine', 1500, 900, 0.25, 0.05);
        break;
      case 'full':
        this.tone('sine', 220, 440, 0.6, 0.12); this.noise('lowpass', 2000, 200, 0.6, 0.2); this.clang(330, 0.06);
        break;
      case 'wind':
        this.noise('bandpass', 200, 1500, 2.5, 0.2, 1.5, 0, 0.5);
        break;
      case 'crumble':
        this.noise('lowpass', 1000, 80, 0.8, 0.3); for (let k = 0; k < 4; k++) this.noise('bandpass', rand(800, 2000), 300, 0.1, 0.08, 3, k * 0.08);
        break;
    }
  },

  // Ständiga ljud: stormvind, regn och Parshendis nynnande (styrs med nivåer 0..1).
  startLoops() {
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.sfx);
      src.start();
      return { g, f };
    };
    this.loops.wind = mk('bandpass', 400, 0.8);
    this.loops.rain = mk('highpass', 2500, 0.5);
    // Nynnande: två låga sinustoner med tremolo.
    const hum = c.createGain(); hum.gain.value = 0;
    hum.connect(this.sfx);
    for (const f of [110, 164.8]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const tg = c.createGain(); tg.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 2.3 + f * 0.003;
      const lg = c.createGain(); lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(tg.gain);
      o.connect(tg); tg.connect(hum);
      o.start(); lfo.start();
    }
    this.loops.hum = { g: hum };
    this.loops.flight = mk('bandpass', 800, 1.2);
  },

  setLoop(name, level, freq) {
    const l = this.loops[name];
    if (!l || !this.ctx) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(level, t, 0.3);
    if (freq && l.f) l.f.frequency.setTargetAtTime(freq, t, 0.3);
  },
};
