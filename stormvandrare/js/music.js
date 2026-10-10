'use strict';
// Procedurell musik: en drönarbädd, en långsam pentatonisk melodi på ett
// kalimba-liknande instrument och trummor som tar över i strid och mot bossar.
// Schemaläggs en bit framåt i tiden med Web Audio-klockan.

const Music = {
  on: true,
  mode: 'explore',   // explore | combat | boss | storm | calm
  next: 0,
  step: 0,
  tempo: 72,
  pad: null,
  scale: [0, 2, 3, 5, 7, 9, 10],  // dorisk
  root: 146.83,                   // D
  motif: null,

  start() {
    if (!Sound.ctx || this.pad) return;
    const c = Sound.ctx;
    // Drönare: två lätt avstämda sågtandsvågor genom ett lågpassfilter.
    const g = c.createGain(); g.gain.value = 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.6;
    f.connect(g); g.connect(Sound.musicBus);
    const oscs = [];
    for (const [mult, det] of [[0.5, -6], [0.5, 5], [0.75, 0], [1, 3]]) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = this.root * mult; o.detune.value = det;
      const og = c.createGain(); og.gain.value = 0.06;
      o.connect(og); og.connect(f); o.start();
      oscs.push(o);
    }
    // Långsam rörelse i filtret.
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lg = c.createGain(); lg.gain.value = 220;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    this.pad = { g, f, oscs };
    g.gain.setTargetAtTime(0.5, c.currentTime, 2);
    this.next = c.currentTime + 0.5;
    this.motif = this.makeMotif();
  },

  makeMotif() {
    const m = [];
    for (let i = 0; i < 16; i++) m.push(Math.random() < 0.55 ? randInt(0, 9) : -1);
    return m;
  },

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (!this.pad) return;
    const t = Sound.ctx.currentTime;
    const lvl = mode === 'boss' ? 0.65 : mode === 'combat' ? 0.55 : mode === 'storm' ? 0.35 : 0.5;
    this.pad.g.gain.setTargetAtTime(lvl, t, 1.5);
    this.tempo = mode === 'boss' ? 112 : mode === 'combat' ? 96 : mode === 'storm' ? 84 : 72;
    if (mode === 'boss') this.motif = this.makeMotif();
  },

  // Ny tonart per region.
  setKey(root, scale) {
    this.root = root;
    if (scale) this.scale = scale;
    if (this.pad) {
      const t = Sound.ctx.currentTime;
      const mults = [0.5, 0.5, 0.75, 1];
      this.pad.oscs.forEach((o, i) => o.frequency.setTargetAtTime(root * mults[i], t, 2));
    }
    this.motif = this.makeMotif();
  },

  freq(deg) {
    const n = this.scale.length;
    const oct = Math.floor(deg / n);
    const semis = this.scale[((deg % n) + n) % n] + oct * 12;
    return this.root * 2 * Math.pow(2, semis / 12);
  },

  pluck(f, t, vol) {
    const c = Sound.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = f; o2.frequency.value = f * 2.01;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(Sound.musicBus); g.connect(Sound.reverb);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  },

  drum(t, kind, vol) {
    const c = Sound.ctx;
    if (kind === 'low') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(Sound.musicBus); o.start(t); o.stop(t + 0.45);
    } else {
      const src = c.createBufferSource(); src.buffer = Sound.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'hi' ? 3500 : 900; f.Q.value = 1.5;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hi' ? 0.06 : 0.18));
      src.connect(f); f.connect(g); g.connect(Sound.musicBus);
      src.start(t, Math.random()); src.stop(t + 0.2);
    }
  },

  update() {
    if (!this.on || !Sound.ready()) return;
    if (!this.pad) this.start();
    const c = Sound.ctx;
    const stepDur = 60 / this.tempo / 2; // åttondelar
    while (this.next < c.currentTime + 0.25) {
      const t = this.next, s = this.step;
      const deg = this.motif[s % 16];
      const calmish = this.mode === 'explore' || this.mode === 'calm';
      if (deg >= 0 && (calmish ? s % 2 === 0 : true) && Math.random() < (calmish ? 0.8 : 0.95)) {
        this.pluck(this.freq(deg + (this.mode === 'boss' ? -2 : 0)), t, calmish ? 0.05 : 0.06);
      }
      if (s % 32 === 0 && Math.random() < 0.5) this.motif = this.makeMotif();
      // Trummor i strid och mot bossar (som Parshendis krigstrummor).
      if (this.mode === 'combat' || this.mode === 'boss') {
        if (s % 4 === 0) this.drum(t, 'low', 0.35);
        if (s % 8 === 6) this.drum(t, 'low', 0.25);
        if (this.mode === 'boss' && s % 2 === 1) this.drum(t, 'hi', 0.06);
        if (s % 8 === 4) this.drum(t, 'mid', 0.12);
      } else if (this.mode === 'storm' && s % 8 === 0) this.drum(t, 'low', 0.18);
      this.next += stepDur;
      this.step++;
    }
  },
};
