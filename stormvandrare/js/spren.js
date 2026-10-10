'use strict';
// Spren: små varelser som dras till känslor och naturfenomen.
// Windspren följer den som flyger, honorsprenen Lirra håller sig nära,
// gloryspren firar segrar, painspren kryper fram vid skada, anticipationspren
// fladdrar kring den som laddar ett anfall och lifespren svävar i grönskan.

const Spren = {
  wind: [],     // { pts: [[x,y,z]...], phase, life, max }
  glory: 0,     // tid kvar för gloryspren
  lirra: { pos: V3.create(), vel: V3.create(), trail: [], mood: 0, speech: null, speechT: 0 },
  anticip: [],  // { e, life }
  _t: V3.create(),
  _c: V3.create(),

  reset(p) {
    this.wind.length = 0;
    this.glory = 0;
    this.anticip.length = 0;
    const c = p.center(this._c);
    V3.set(this.lirra.pos, c[0] + 1, c[1] + 1, c[2]);
    this.lirra.trail.length = 0;
    this.lirra.speech = null;
  },

  say(text, time) { this.lirra.speech = text; this.lirra.speechT = time || 4; },

  update(dt, game) {
    const p = game.player;
    const c = p.center(this._c);
    const speed = V3.len(p.vel);
    // Windspren dyker upp vid hög fart.
    const want = speed > 12 ? Math.min(5, Math.floor(speed / 8)) : 0;
    if (want && !this._noted) { this._noted = true; game.note('windspren'); }
    if (this.wind.length < want && Math.random() < dt * 6) {
      this.wind.push({ pts: [], phase: rand(0, TAU), life: rand(3, 6), max: 6, r: rand(1, 2.2), h: rand(-0.6, 0.8), spin: rand(2, 4) * (Math.random() < 0.5 ? -1 : 1) });
    }
    for (let i = this.wind.length - 1; i >= 0; i--) {
      const w = this.wind[i];
      w.life -= dt * (speed < 8 ? 3 : 1);
      if (w.life <= 0) { this.wind.splice(i, 1); continue; }
      w.phase += dt * w.spin;
      const right = Camera.right, up = p.up || [0, 1, 0];
      const x = c[0] + Math.cos(w.phase) * w.r * right[0] + up[0] * (w.h + Math.sin(w.phase * 1.7) * 0.5);
      const y = c[1] + Math.cos(w.phase) * w.r * right[1] + up[1] * (w.h + Math.sin(w.phase * 1.7) * 0.5) + Math.sin(w.phase) * w.r * 0.4;
      const z = c[2] + Math.cos(w.phase) * w.r * right[2] + Math.sin(w.phase) * w.r + up[2] * w.h;
      w.pts.unshift([x, y, z]);
      if (w.pts.length > 14) w.pts.length = 14;
    }
    // Lirra följer efter vid högra axeln, med lite eftersläp.
    const L = this.lirra;
    const tx = c[0] - Camera.right[0] * 0.9 + Math.sin(game.realTime * 1.3) * 0.2;
    const ty = c[1] + 0.8 + Math.sin(game.realTime * 2.1) * 0.15;
    const tz = c[2] - Camera.right[2] * 0.9 + Math.cos(game.realTime * 1.1) * 0.2;
    const k = 1 - Math.exp(-4 * dt);
    L.pos[0] += (tx - L.pos[0]) * k; L.pos[1] += (ty - L.pos[1]) * k; L.pos[2] += (tz - L.pos[2]) * k;
    if (V3.dist(L.pos, c) > 30) V3.set(L.pos, tx, ty, tz);
    L.trail.unshift([L.pos[0], L.pos[1], L.pos[2]]);
    if (L.trail.length > 12) L.trail.length = 12;
    if (L.speechT > 0) { L.speechT -= dt; if (L.speechT <= 0) L.speech = null; }
    if (this.glory > 0) { this.glory -= dt; if (!this._gNoted) { this._gNoted = true; game.note('gloryspren'); } }
    for (let i = this.anticip.length - 1; i >= 0; i--) {
      this.anticip[i].life -= dt;
      if (this.anticip[i].life <= 0 || this.anticip[i].e.dead) this.anticip.splice(i, 1);
    }
    // Lifespren: gröna prickar i klyftornas grönska.
    if (p.pos[1] < CHASM_FLOOR + 6 && Math.random() < dt * 8) {
      Effects.particle(c[0] + rand(-8, 8), CHASM_FLOOR + rand(0.3, 2), c[2] + rand(-8, 8), rand(-0.2, 0.2), rand(0.1, 0.4), rand(-0.2, 0.2), rand(2, 4), 0.06, [0.5, 1, 0.45], 0.8, 0.5, -0.05, true);
    }
  },

  anticipation(e) { this.anticip.push({ e, life: 0.7 }); },

  painspren(x, y, z) {
    for (let k = 0; k < 5; k++) {
      const a = rand(0, TAU), r = rand(0.4, 1.2);
      Effects.particle(x + Math.cos(a) * r, y + 0.05, z + Math.sin(a) * r, Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5, rand(0.6, 1), rand(0.06, 0.1), [1, 0.45, 0.15], 0.9, 2, 0, false);
    }
  },

  draw(game) {
    const t = game.realTime;
    for (const w of this.wind) {
      if (w.pts.length > 2) Renderer.ribbon(w.pts, 0.09, 0.9, 0.97, 1, Math.min(1, w.life) * 0.7, true, true);
    }
    // Lirra: en liten ljusvarelse med en slöja som släpar efter.
    const L = this.lirra;
    Renderer.particle(L.pos[0], L.pos[1], L.pos[2], 0.06, 0.8, 0.92, 1, 0.8, true);
    Renderer.particle(L.pos[0], L.pos[1], L.pos[2], 0.18, 0.55, 0.75, 1, 0.14, true);
    if (L.trail.length > 2) Renderer.ribbon(L.trail, 0.05, 0.75, 0.9, 1, 0.45, true, true);
    Renderer.light(L.pos[0], L.pos[1], L.pos[2], 0.12, 0.18, 0.28, 3);
    // Gloryspren: gyllene ljusklot som kretsar ovanför huvudet.
    if (this.glory > 0) {
      const c = game.player.center(this._c);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = t * 1.8 + (i / n) * TAU;
        Renderer.particle(c[0] + Math.cos(a) * 0.7, c[1] + 1.4 + Math.sin(t * 3 + i) * 0.1, c[2] + Math.sin(a) * 0.7, 0.12, 1, 0.82, 0.35, Math.min(1, this.glory), true);
      }
    }
    // Anticipationspren: röda band som fladdrar kring fienden som laddar.
    for (const a of this.anticip) {
      const e = a.e;
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let j = 0; j < 7; j++) {
          const ang = t * 6 + k * Math.PI + j * 0.35;
          pts.push([e.pos[0] + Math.cos(ang) * (e.r + 0.4), e.pos[1] + e.h * 0.9 + j * 0.12, e.pos[2] + Math.sin(ang) * (e.r + 0.4)]);
        }
        Renderer.ribbon(pts, 0.1, 1, 0.15, 0.15, Math.min(1, a.life * 2) * 0.8, false, true);
      }
    }
    // Fearspren: violetta klumpar kring svårt skadade fiender.
    for (const e of Enemies.list) {
      if (e.dead || e.boss || e.hp > e.maxHp * 0.25) continue;
      if (V3.dist(Camera.pos, e.pos) > 40) continue;
      for (let k = 0; k < 3; k++) {
        const a = t * 1.5 + k * 2.1;
        Renderer.particle(e.pos[0] + Math.cos(a) * 0.6, e.pos[1] + 0.1 + Math.abs(Math.sin(t * 2 + k)) * 0.15, e.pos[2] + Math.sin(a) * 0.6, 0.12, 0.55, 0.25, 0.75, 0.8, false);
      }
    }
  },
};
