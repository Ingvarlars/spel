'use strict';
// Förmågor: Shardblade (och senare spjut, Full Lashing, rustning och vindkallelse).

const Blade = { // Shardblade
  cooldown: 0,
  combo: 0,
  lastSwing: -10,
  swing: null,      // aktivt hugg { t, dur, angle, reach, arc, dmg, id, combo, hits }
  swingId: 0,
  arcs: [],         // synliga hugg-bågar
  queued: 0,

  reset() {
    this.cooldown = 0;
    this.combo = 0;
    this.lastSwing = -10;
    this.swing = null;
    this.arcs.length = 0;
    this.queued = 0;
  },

  update(dt, game) {
    const p = game.player;
    const s = p.stats;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (Input.consume('attack') && p.alive) this.queued = 0.18;
    if (this.queued > 0) {
      this.queued -= dt;
      if (this.cooldown <= 0) { this.start(game); this.queued = 0; }
    }

    const sw = this.swing;
    if (sw) {
      sw.t += dt;
      // Följ spelaren under hugget.
      sw.x = p.x; sw.y = p.y;
      if (sw.t >= 0.03 && sw.t <= sw.dur) this.applyHits(sw, game);
      if (sw.t > sw.dur) this.swing = null;
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
  },

  start(game) {
    const p = game.player, s = p.stats;
    if (game.time - this.lastSwing > 0.55) this.combo = 0;
    const c = this.combo;
    const finisher = c === 2;
    let angle = game.aimAssist(p.aim, 190);
    const sw = {
      t: 0,
      dur: finisher ? 0.16 : 0.12,
      angle,
      reach: (finisher ? 84 : 70) * s.bladeReach,
      arc: finisher ? 1.45 : 1.15,
      dmg: s.bladeDamage * (finisher ? 1.8 : c === 1 ? 1.1 : 1),
      knock: finisher ? 520 : 220,
      id: ++this.swingId,
      combo: c,
      x: p.x, y: p.y,
      pogo: false,
    };
    this.swing = sw;
    this.cooldown = (finisher ? 0.42 : 0.24) / s.bladeSpeed;
    this.lastSwing = game.time;
    this.combo = (c + 1) % 3;
    p.attackAnim = 0.2;
    p.swingAngle = angle;
    p.swingDir = c === 1 ? -1 : 1;
    // Ett litet utfall framåt.
    if (!p.onGround || finisher) { p.vx += Math.cos(angle) * 90; p.vy += Math.sin(angle) * 60; }
    this.arcs.push({ x: p.x, y: p.y, angle, reach: sw.reach, arc: sw.arc, life: 0.16, max: 0.16, dir: p.swingDir, finisher, follow: true });
    this.carve(sw);
    game.onSwing(sw);
  },

  inArc(sw, x, y, r) {
    const dx = x - sw.x, dy = y - sw.y;
    const d = Math.hypot(dx, dy);
    if (d > sw.reach + r) return false;
    if (d < 18 + r) return true;
    return Math.abs(angleDiff(Math.atan2(dy, dx), sw.angle)) <= sw.arc / 2 + Math.atan2(r, d);
  },

  applyHits(sw, game) {
    const list = Enemies.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || e.lastSwing === sw.id) continue;
      const r = Math.max(e.w, e.h) * 0.5;
      if (!this.inArc(sw, e.x, e.y, r)) continue;
      e.lastSwing = sw.id;
      const kx = Math.cos(sw.angle) * sw.knock, ky = Math.sin(sw.angle) * sw.knock - 80;
      const dealt = game.damageEnemy(e, sw.dmg, kx, ky, 'blade');
      // Nedåthugg i luften studsar spelaren uppåt.
      const p = game.player;
      const down = Math.cos(sw.angle) * p.gx + Math.sin(sw.angle) * p.gy;
      if (dealt > 0 && !sw.pogo && !p.onGround && down > 0.6) {
        sw.pogo = true;
        const vn = p.vx * p.gx + p.vy * p.gy;
        p.vx += p.gx * (-460 - vn); p.vy += p.gy * (-460 - vn);
      }
    }
    // Pilar och andra projektiler i bågen paréras.
    const pr = Projectiles.pool.active;
    for (let i = pr.length - 1; i >= 0; i--) {
      const b = pr[i];
      if (b.parryable && this.inArc(sw, b.x, b.y, 6)) {
        game.onParry(b);
        Projectiles.pool.releaseAt(i);
      }
    }
  },

  // Skär löst berg i bågen.
  carve(sw) {
    const r = sw.reach;
    const tx0 = Math.floor((sw.x - r) / TILE), tx1 = Math.floor((sw.x + r) / TILE);
    const ty0 = Math.floor((sw.y - r) / TILE), ty1 = Math.floor((sw.y + r) / TILE);
    let cut = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (World.get(tx, ty) !== T_BOULDER) continue;
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
        if (this.inArc(sw, cx, cy, 10) && World.carve(tx, ty)) {
          cut++;
          Effects.debris(cx, cy, '#8d6a4e', 8, 260);
        }
      }
    }
    if (cut) Game.onCarve(cut);
  },

  draw(ctx, game) {
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      const p = game.player;
      const x = a.follow ? p.x : a.x, y = a.follow ? p.y : a.y;
      const t = 1 - a.life / a.max;
      const a0 = a.angle - (a.arc / 2) * a.dir, a1 = a.angle + (a.arc / 2) * a.dir;
      const cur = lerp(a0, a1, Math.min(1, t * 1.6));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      // Halvmåne som sveper genom bågen.
      const g = ctx.createRadialGradient(x, y, a.reach * 0.35, x, y, a.reach);
      g.addColorStop(0, 'rgba(150,210,255,0)');
      g.addColorStop(0.75, a.finisher ? 'rgba(200,235,255,0.55)' : 'rgba(170,220,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const lo = Math.min(a0, cur), hi = Math.max(a0, cur);
      ctx.arc(x, y, a.reach, lo, hi);
      ctx.arc(x, y, a.reach * 0.45, hi, lo, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // Klingan i handen under och strax efter ett hugg.
  drawInHand(ctx, game) {
    const p = game.player;
    if (p.attackAnim <= 0 || !p.alive) return;
    const t = 1 - p.attackAnim / 0.2;
    const ang = (p.swingAngle || 0) + (t - 0.5) * 1.6 * (p.swingDir || 1);
    const len = 46;
    ctx.save();
    ctx.translate(p.x, p.y - 4);
    ctx.rotate(ang);
    ctx.globalAlpha = Math.min(1, p.attackAnim * 8);
    ctx.shadowColor = '#bfe6ff';
    ctx.shadowBlur = 14;
    // Lång, smal klinga med en våg längs eggen.
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(8 + len * 0.5, -4);
    ctx.quadraticCurveTo(8 + len * 0.8, -1, 8 + len, 0);
    ctx.lineTo(8 + len * 0.55, 3);
    ctx.lineTo(8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6a7f99';
    ctx.fillRect(2, -4, 6, 8);
    ctx.restore();
  },
};
