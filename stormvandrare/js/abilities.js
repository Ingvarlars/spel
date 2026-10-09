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
      Enemies.center(e, ec);
      if (!this.inSwing(sw, pc, ec[0], ec[1], ec[2], e.r + e.h * 0.3)) continue;
      e.lastSwing = sw.id;
      const dealt = game.damageEnemy(e, sw.dmg, sw.dir, sw.knock, 'blade');
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
