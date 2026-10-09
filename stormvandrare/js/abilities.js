'use strict';
// Förmågor: Shardblade (och i senare steg spjut, Full Lashing, rustning, vindkallelse).

const Blade = {
  cooldown: 0,
  combo: 0,
  lastSwing: -10,
  swing: null,
  swingId: 0,
  queued: 0,
  trail: [],   // klingspetsens positioner { x, y, z, age }
  _d: V3.create(),
  _c: V3.create(),
  _t: V3.create(),

  reset() {
    this.cooldown = 0; this.combo = 0; this.lastSwing = -10; this.swing = null; this.queued = 0;
    this.trail.length = 0;
  },

  update(dt, game) {
    const p = game.player;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (Input.consume('attack') && p.alive) this.queued = 0.2;
    if (this.queued > 0) {
      this.queued -= dt;
      if (this.cooldown <= 0) { this.start(game); this.queued = 0; }
    }
    const sw = this.swing;
    if (sw) {
      sw.t += dt;
      if (sw.t >= 0.04 && sw.t <= sw.dur) this.applyHits(sw, game);
      if (sw.t > sw.dur) this.swing = null;
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 0.16) this.trail.splice(i, 1);
    }
  },

  start(game) {
    const p = game.player, s = p.stats;
    if (game.time - this.lastSwing > 0.6) this.combo = 0;
    const c = this.combo, finisher = c === 2;
    const dir = V3.copy(this._d, game.aimAssist(game.aimDirection(p), 9, 0.6));
    this.swing = {
      t: 0, dur: finisher ? 0.2 : 0.15,
      dir: Float32Array.from(dir),
      reach: (finisher ? 3.6 : 3.1) * s.bladeReach,
      cosArc: finisher ? 0.2 : 0.4,
      dmg: s.bladeDamage * (finisher ? 1.8 : c === 1 ? 1.1 : 1),
      knock: finisher ? 14 : 6,
      id: ++this.swingId, combo: c, pogo: false,
    };
    this.cooldown = (finisher ? 0.45 : 0.27) / s.bladeSpeed;
    this.lastSwing = game.time;
    this.combo = (c + 1) % 3;
    p.attackAnim = 0.22;
    p.swingDir = c === 1 ? -1 : 1;
    p.swingCombo = c;
    // Ett utfall framåt.
    V3.addScaled(p.vel, p.vel, dir, p.grounded ? (finisher ? 6 : 3) : 4);
    this.carve(this.swing, game);
    game.onSwing(this.swing);
  },

  // Är punkten inom hugget (avstånd och kon)?
  inSwing(sw, pc, x, y, z, r) {
    const dx = x - pc[0], dy = y - pc[1], dz = z - pc[2];
    const d = Math.hypot(dx, dy, dz);
    if (d > sw.reach + r) return false;
    if (d < 1 + r) return true;
    return (dx * sw.dir[0] + dy * sw.dir[1] + dz * sw.dir[2]) / d > sw.cosArc - r / d;
  },

  applyHits(sw, game) {
    const p = game.player;
    const pc = p.center(this._c);
    const ec = this._t;
    for (const e of Enemies.list) {
      if (e.dead || e.lastSwing === sw.id) continue;
      let mult = 1;
      if (e.boss) {
        // Bossar har träffzoner med olika sårbarhet.
        if (e.invulnerable) continue;
        mult = 0;
        for (const z of Bosses.zones(e)) if (this.inSwing(sw, pc, z[0], z[1], z[2], z[3])) mult = Math.max(mult, z[4]);
        if (mult <= 0) continue;
      } else {
        Enemies.center(e, ec);
        if (!this.inSwing(sw, pc, ec[0], ec[1], ec[2], e.r + e.h * 0.3)) continue;
      }
      e.lastSwing = sw.id;
      const dealt = game.damageEnemy(e, sw.dmg * mult, sw.dir, sw.knock, 'blade');
      // Stöt nedåt i luften studsar uppåt.
      const down = V3.dot(sw.dir, p.g);
      if (dealt > 0 && !sw.pogo && !p.grounded && down > 0.55) {
        sw.pogo = true;
        const vn = V3.dot(p.vel, p.g);
        V3.addScaled(p.vel, p.vel, p.g, -11 - vn);
      }
    }
    // Pilar och bråte i bågen paréras.
    const pr = Projectiles.pool.active;
    for (let i = pr.length - 1; i >= 0; i--) {
      const b = pr[i];
      if (b.parryable && b.stuck <= 0 && this.inSwing(sw, pc, b.pos[0], b.pos[1], b.pos[2], 0.6)) {
        game.onParry(b);
        Projectiles.pool.releaseAt(i);
      }
    }
  },

  // Skär löst berg (block) i hugget.
  carve(sw, game) {
    const p = game.player;
    const pc = p.center(this._c);
    const list = World.query(pc[0], pc[2], sw.reach + 5, []);
    for (const pr of list) {
      if (pr.kind !== 'boulder' || !pr.alive) continue;
      // Närmaste punkt på blocket.
      const cp = closestOnPoly(pr.poly, pc[0], pc[2], [0, 0, 0]);
      const inside = pointInPoly(pr.poly, pc[0], pc[2]);
      const x = inside ? pc[0] : cp[0], z = inside ? pc[2] : cp[1];
      const y = clamp(pc[1], pr.y0, pr.y1);
      if (!this.inSwing(sw, pc, x, y, z, 0.5)) continue;
      pr.hp -= sw.combo === 2 ? 2 : 1;
      pr.flash = 0.1;
      game.onCarveHit(pr, x, y, z);
      if (pr.hp <= 0) { World.destroyPrism(pr); game.onCarve(pr); }
    }
  },

  // Spår efter klingspetsen (handens matris från spelarens rigg).
  recordTip(bladeMat) {
    if (!bladeMat) return;
    const tip = M4.transformPoint(this._t, bladeMat, [0, 0, 1.85]);
    this.trail.unshift({ x: tip[0], y: tip[1], z: tip[2], age: 0 });
    if (this.trail.length > 14) this.trail.length = 14;
  },

  draw() {
    if (this.trail.length < 2) return;
    const pts = this.trail.map((t) => [t.x, t.y, t.z]);
    Renderer.ribbon(pts, 0.55, 0.75, 0.9, 1, 0.55, true, true);
    Renderer.ribbon(pts, 0.15, 1, 1, 1, 0.8, true, true);
  },
};

// --- Förmågor som Idealen låser upp ---
const Abilities = {
  cd: { full: 0, lashEnemy: 0, spear: 0, wind: 0 },
  spear: null,      // { pos, vel, life, returning, hits }
  tornado: null,    // { x, y, z, life }
  binds: [],        // visuella band { e, life }
  _t: V3.create(),
  _c: V3.create(),

  reset() {
    for (const k in this.cd) this.cd[k] = 0;
    this.spear = null;
    this.tornado = null;
    this.binds.length = 0;
  },

  cost: { full: 15, lashEnemy: 8, spear: 10, wind: 25 },
  cooldown: { full: 6, lashEnemy: 1.2, spear: 1.4, wind: 10 },

  tryUse(key, game) {
    const p = game.player;
    if (!Progression.has(key)) { game.onLocked(key); return false; }
    if (this.cd[key] > 0) return false;
    if (p.light < this.cost[key]) { game.onLashFail(p); return false; }
    p.light -= this.cost[key];
    this.cd[key] = this.cooldown[key];
    return true;
  },

  update(dt, game) {
    const p = game.player;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    if (Input.consume('full') && this.tryUse('full', game)) this.fullLashing(game);
    if (Input.consume('lash2') && this.tryUse('lashEnemy', game)) this.lashEnemy(game);
    if (Input.consume('spear') && this.tryUse('spear', game)) this.throwSpear(game);
    if (Input.consume('call') && this.tryUse('wind', game)) this.windCall(game);
    this.updateSpear(dt, game);
    this.updateTornado(dt, game);
    for (let i = this.binds.length - 1; i >= 0; i--) {
      const b = this.binds[i];
      b.life -= dt;
      if (b.life <= 0 || b.e.dead) this.binds.splice(i, 1);
    }
    void p;
  },

  // Full Lashing: fiender runt omkring fastnar mot marken.
  fullLashing(game) {
    const pc = game.player.center(this._c);
    const ec = this._t;
    let n = 0;
    for (const e of Enemies.list) {
      if (e.dead) continue;
      Enemies.center(e, ec);
      const d = V3.dist(ec, pc);
      if (d > 8 + e.r) continue;
      if (e.boss) { e.flash = 0.2; continue; }
      e.stun = Math.max(e.stun, 4);
      e.lash = 0;
      V3.set(e.vel, 0, Math.min(e.vel[1], 0), 0);
      this.binds.push({ e, life: 4 });
      n++;
    }
    game.onFullLashing(pc, n);
  },

  // Lasha en fiende åt det håll man tittar.
  lashEnemy(game) {
    const p = game.player;
    const pc = p.center(this._c);
    const aim = game.aimDirection(p);
    let best = null, bestScore = -1e9;
    const ec = this._t;
    for (const e of Enemies.list) {
      if (e.dead || e.boss) continue;
      Enemies.center(e, ec);
      const dx = ec[0] - pc[0], dy = ec[1] - pc[1], dz = ec[2] - pc[2], d = Math.hypot(dx, dy, dz);
      if (d > 22) continue;
      const c = (dx * Camera.fwd[0] + dy * Camera.fwd[1] + dz * Camera.fwd[2]) / (d || 1);
      if (c < 0.75) continue;
      const score = c * 3 - d / 22;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) { game.onLashFail(p); this.cd.lashEnemy = 0.2; p.light += this.cost.lashEnemy; return; }
    // Riktningen: kamerans tittriktning, men alltid lite uppåt om man siktar rakt fram.
    const dir = V3.copy(V3.create(), Camera.fwd);
    if (dir[1] > -0.3 && dir[1] < 0.35) dir[1] = 0.6;
    V3.normalize(dir, dir);
    best.lash = 3;
    best.lashDir = dir;
    best.stun = Math.max(best.stun, 3);
    best.vel[0] += dir[0] * 4; best.vel[1] += dir[1] * 4 + 3; best.vel[2] += dir[2] * 4;
    this.binds.push({ e: best, life: 3 });
    game.onLashEnemy(best);
  },

  throwSpear(game) {
    const p = game.player;
    const pc = p.center(this._c);
    const dir = game.aimAssist(game.aimDirection(p), 30, 0.92);
    this.spear = { pos: V3.copy(V3.create(), pc), vel: V3.scale(V3.create(), dir, 62), life: 1.2, returning: false, hits: new Set() };
    p.attackAnim = 0.22; p.swingCombo = 2;
    game.onSpear();
  },

  updateSpear(dt, game) {
    const s = this.spear;
    if (!s) return;
    const p = game.player;
    if (s.returning) {
      const pc = p.center(this._c);
      const d = V3.sub(this._t, pc, s.pos);
      const l = V3.len(d);
      if (l < 1.5) { this.spear = null; return; }
      V3.scale(s.vel, d, 45 / l);
    } else {
      s.life -= dt;
      if (s.life <= 0) { s.returning = true; }
    }
    const steps = 3;
    const ec = this._t;
    for (let k = 0; k < steps; k++) {
      V3.addScaled(s.pos, s.pos, s.vel, dt / steps);
      if (!s.returning && World.insideAny(s.pos[0], s.pos[1], s.pos[2])) {
        Effects.debris(s.pos[0], s.pos[1], s.pos[2], [0.6, 0.5, 0.4], 10, 5);
        s.returning = true;
        s.stuck = 0.3;
        break;
      }
      for (const e of Enemies.list) {
        if (e.dead || s.hits.has(e.id)) continue;
        let hitMult = 0;
        if (e.boss) {
          if (e.invulnerable) continue;
          for (const z of Bosses.zones(e)) if (Math.hypot(z[0] - s.pos[0], z[1] - s.pos[1], z[2] - s.pos[2]) < z[3] + 0.4) { hitMult = Math.max(hitMult, z[4]); }
        } else {
          Enemies.center(e, ec);
          if (V3.dist(ec, s.pos) < e.r + e.h * 0.35 + 0.3) hitMult = 1;
        }
        if (hitMult > 0) {
          s.hits.add(e.id);
          const dir = V3.normalize(V3.create(), s.vel);
          game.damageEnemy(e, 48 * hitMult * (e.bossType === 'herald' ? 1.5 : 1), dir, 10, 'spear');
        }
      }
    }
  },

  // Vindkallelse: en virvel av windspren som drar in och lyfter fiender.
  windCall(game) {
    const c = Camera.pos, f = Camera.fwd;
    const d = World.raycast(c[0], c[1], c[2], f[0], f[1], f[2], 40, 0.8);
    const x = c[0] + f[0] * d, z = c[2] + f[2] * d;
    const y = World.groundBelow(x, c[1] + f[1] * d + 1, z);
    this.tornado = { x, y, z, life: 5 };
    game.onWindCall(this.tornado);
  },

  updateTornado(dt, game) {
    const t = this.tornado;
    if (!t) return;
    t.life -= dt;
    if (t.life <= 0) { this.tornado = null; return; }
    for (const e of Enemies.list) {
      if (e.dead || e.boss) continue;
      const dx = t.x - e.pos[0], dz = t.z - e.pos[2], d = Math.hypot(dx, dz);
      if (d > 9) continue;
      const pull = (1 - d / 9) * 30;
      e.vel[0] += (dx / (d || 1)) * pull * dt + (-dz / (d || 1)) * pull * 0.8 * dt;
      e.vel[2] += (dz / (d || 1)) * pull * dt + (dx / (d || 1)) * pull * 0.8 * dt;
      e.vel[1] += 34 * dt * (1 - d / 9);
      e.stun = Math.max(e.stun, 0.3);
      if (game.tick % 20 === 0) game.damageEnemy(e, 6, null, 0, 'wind');
    }
  },

  draw(game) {
    const t = game.realTime;
    const s = this.spear;
    if (s) {
      const m = this._m || (this._m = M4.create());
      const v = s.vel, l = V3.len(v) || 1;
      M4.fromTRS(m, s.pos[0], s.pos[1], s.pos[2], Math.atan2(v[0], v[2]), -Math.asin(clamp(v[1] / l, -1, 1)), t * (s.returning ? 20 : 0), 1, 1, 1);
      M4.multiply(m, m, M4.fromTRS(this._m2 || (this._m2 = M4.create()), 0, 0, -0.9, 0, 0, 0, 1, 1, 1));
      Renderer.draw(Models.shardblade(), m, { emissive: 0.6, shadow: false });
      Renderer.light(s.pos[0], s.pos[1], s.pos[2], 0.4, 0.6, 1, 6);
    }
    const tr = this.tornado;
    if (tr) {
      const k = Math.min(1, tr.life);
      for (let r = 0; r < 5; r++) {
        const pts = [];
        for (let j = 0; j < 24; j++) {
          const h = j * 0.6, a = t * 5 + j * 0.5 + r * 1.25, rad = 1 + h * 0.3;
          pts.push([tr.x + Math.cos(a) * rad, tr.y + h, tr.z + Math.sin(a) * rad]);
        }
        Renderer.ribbon(pts, 0.18, 0.85, 0.95, 1, 0.55 * k, true, true);
      }
      Effects.dust(tr.x, tr.y, tr.z, 1, 3);
    }
    for (const b of this.binds) {
      const e = b.e;
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let j = 0; j <= 16; j++) {
          const a = (j / 16) * TAU + t * 3 * (k ? 1 : -1);
          pts.push([e.pos[0] + Math.cos(a) * (e.r + 0.3), e.pos[1] + e.h * (0.3 + k * 0.4), e.pos[2] + Math.sin(a) * (e.r + 0.3)]);
        }
        Renderer.ribbon(pts, 0.07, 0.8, 0.92, 1, Math.min(1, b.life) * 0.8, true);
      }
    }
  },
};
