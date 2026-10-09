'use strict';
// Ljudeffekter som genereras med Web Audio API (inga ljudfiler).
// Ljudkontexten skapas först vid användarens första tryck/knapp.

const Sound = {
  ctx: null,
  master: null,
  noiseBuf: null,
  muted: false,
  volume: 0.6,
  last: Object.create(null),
  combo: 0,
  comboTime: 0,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      // Brusbuffert för explosioner, träffar och dash.
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  },

  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  },
  setMuted(m) { this.muted = !!m; this.applyVolume(); },
  toggleMute() { this.setMuted(!this.muted); return this.muted; },
  setVolume(v) { this.volume = clamp(v, 0, 1); this.applyVolume(); },

  ready() { return this.ctx && !this.muted && this.ctx.state === 'running'; },

  // Begränsar hur ofta samma ljud spelas (många träffar samtidigt).
  throttle(name, gap) {
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < gap) return false;
    this.last[name] = now;
    return true;
  },

  tone(type, f0, f1, dur, vol, delay) {
    const c = this.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(filter, f0, f1, dur, vol, q) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ready()) return;
    switch (name) {
      case 'shoot':
        if (this.throttle(name, 0.05)) this.tone('square', 900, 380, 0.07, 0.05);
        break;
      case 'missile':
        if (this.throttle(name, 0.1)) { this.tone('sawtooth', 160, 520, 0.18, 0.04); this.noise('bandpass', 800, 2500, 0.18, 0.05, 2); }
        break;
      case 'zap':
        if (this.throttle(name, 0.08)) { this.tone('sawtooth', 1400, 180, 0.14, 0.05); this.noise('highpass', 3000, 1500, 0.1, 0.06); }
        break;
      case 'nova':
        this.tone('sine', 260, 50, 0.4, 0.18);
        this.noise('lowpass', 1500, 100, 0.3, 0.08);
        break;
      case 'hit':
        if (this.throttle(name, 0.045)) this.tone('triangle', rand(260, 340), 120, 0.06, 0.07);
        break;
      case 'kill':
        if (this.throttle(name, 0.05)) this.noise('lowpass', 2200, 200, 0.16, 0.12);
        break;
      case 'explosion':
        if (this.throttle(name, 0.06)) { this.noise('lowpass', 1600, 80, 0.45, 0.28); this.tone('sine', 120, 35, 0.4, 0.2); }
        break;
      case 'bigExplosion':
        this.noise('lowpass', 2500, 40, 1.4, 0.5);
        this.tone('sine', 90, 25, 1.3, 0.4);
        this.tone('sawtooth', 300, 30, 0.9, 0.08);
        break;
      case 'enemyShoot':
        if (this.throttle(name, 0.09)) this.tone('square', 520, 260, 0.06, 0.025);
        break;
      case 'pickup': {
        if (!this.throttle(name, 0.035)) break;
        const now = this.ctx.currentTime;
        this.combo = now - this.comboTime < 0.4 ? Math.min(this.combo + 1, 24) : 0;
        this.comboTime = now;
        const f = 900 * Math.pow(2, this.combo / 24);
        this.tone('sine', f, f * 1.3, 0.06, 0.05);
        break;
      }
      case 'heal':
        this.tone('triangle', 520, 1040, 0.25, 0.12);
        this.tone('triangle', 780, 1560, 0.25, 0.08, 0.08);
        break;
      case 'levelUp': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) this.tone('triangle', notes[i], notes[i] * 1.01, 0.22, 0.13, i * 0.07);
        this.tone('sine', 1046.5, 2093, 0.4, 0.05, 0.28);
        break;
      }
      case 'hurt':
        this.tone('square', 220, 70, 0.22, 0.12);
        this.noise('lowpass', 1200, 200, 0.2, 0.15);
        break;
      case 'shield':
        this.tone('sine', 500, 1400, 0.2, 0.12);
        break;
      case 'dash':
        this.noise('bandpass', 400, 2400, 0.18, 0.18, 3);
        break;
      case 'wave':
        this.tone('sawtooth', 220, 440, 0.25, 0.06);
        this.tone('sawtooth', 330, 660, 0.3, 0.05, 0.12);
        break;
      case 'boss':
        this.tone('sawtooth', 110, 40, 1.6, 0.14);
        this.tone('square', 55, 30, 1.6, 0.08);
        this.noise('lowpass', 400, 60, 1.5, 0.15);
        break;
      case 'charge':
        this.tone('sawtooth', 80, 300, 0.5, 0.1);
        break;
      case 'select':
        this.tone('sine', 660, 990, 0.08, 0.08);
        break;
      case 'gameOver':
        this.tone('sawtooth', 440, 55, 1.4, 0.12);
        this.tone('square', 220, 40, 1.4, 0.06, 0.1);
        break;
    }
  },
};
