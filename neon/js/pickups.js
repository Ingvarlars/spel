'use strict';
// XP-kristaller och sällsynta föremål (hjärta läker, magnet drar till sig all XP).

const CRYSTAL_TIERS = [
  { min: 25, color: '#ff3fa4', r: 8 },
  { min: 5, color: '#3fff8a', r: 6.5 },
  { min: 0, color: '#3fd0ff', r: 5 },
];
const MAX_PICKUPS = 700;

function createPickup() {
  return { x: 0, y: 0, vx: 0, vy: 0, kind: 'xp', value: 0, r: 5, color: '', pulled: false, age: 0 };
}

const Pickups = {
  pool: new Pool(createPickup, 400),

  reset() { this.pool.clear(); },

  spawn(kind, x, y, value) {
    const o = this.pool.spawn();
    o.kind = kind;
    o.x = x; o.y = y;
    const a = rand(0, TAU), s = rand(30, 110);
    o.vx = Math.cos(a) * s; o.vy = Math.sin(a) * s;
    o.value = value || 0;
    o.pulled = false;
    o.age = 0;
    this.style(o);
    return o;
  },

  style(o) {
    if (o.kind === 'heart') { o.color = '#ff4060'; o.r = 9; return; }
    if (o.kind === 'magnet') { o.color = '#ffe23f'; o.r = 9; return; }
    for (let i = 0; i < CRYSTAL_TIERS.length; i++) {
      if (o.value >= CRYSTAL_TIERS[i].min) { o.color = CRYSTAL_TIERS[i].color; o.r = CRYSTAL_TIERS[i].r; return; }
    }
  },

  dropXp(x, y, amount) {
    const a = this.pool.active;
    // För många kristaller: lägg värdet på en befintlig i stället.
    if (a.length >= MAX_PICKUPS) {
      const o = a[Math.floor(Math.random() * a.length)];
      if (o.kind === 'xp') { o.value += amount; this.style(o); }
      return;
    }
    while (amount > 0) {
      const v = amount >= 25 ? 25 : amount >= 5 ? 5 : amount;
      this.spawn('xp', x + rand(-6, 6), y + rand(-6, 6), v);
      amount -= v;
      if (a.length >= MAX_PICKUPS) break;
    }
  },

  magnetAll() {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) if (a[i].kind === 'xp') a[i].pulled = true;
  },

  update(dt, game) {
    const p = game.player;
    const a = this.pool.active;
    const mr = p.stats.magnet;
    const mr2 = mr * mr;
    const damp = Math.exp(-4 * dt);
    for (let i = a.length - 1; i >= 0; i--) {
      const o = a[i];
      o.age += dt;
      const dx = p.x - o.x, dy = p.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (!o.pulled && d2 < mr2 && p.alive) o.pulled = true;
      if (o.pulled && p.alive) {
        const d = Math.sqrt(d2) || 1;
        const sp = 350 + o.age * 60 + (o.kind === 'xp' ? 0 : 100);
        const k = 1 - Math.exp(-10 * dt);
        o.vx += ((dx / d) * Math.max(sp, Math.hypot(p.vx, p.vy) + 120) - o.vx) * k;
        o.vy += ((dy / d) * Math.max(sp, Math.hypot(p.vx, p.vy) + 120) - o.vy) * k;
      } else {
        o.vx *= damp; o.vy *= damp;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      const rr = p.r + o.r + 4;
      if (p.alive && d2 < rr * rr) {
        game.onPickup(o);
        this.pool.releaseAt(i);
      }
    }
  },

  draw(ctx, game, time) {
    const v = game.view(20);
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const o = a[i];
      if (o.x < v.x0 || o.x > v.x1 || o.y < v.y0 || o.y > v.y1) continue;
      let sp;
      if (o.kind === 'heart') {
        sp = Sprites.get('pk-heart', 10, 10, (g) => neonShape(g, o.color, 10, 2.5, 0.4, (p) => {
          p.moveTo(0, 8); p.bezierCurveTo(-12, -1, -6, -10, 0, -4); p.bezierCurveTo(6, -10, 12, -1, 0, 8);
        }));
      } else if (o.kind === 'magnet') {
        sp = Sprites.get('pk-magnet', 10, 10, (g) => {
          neonShape(g, o.color, 10, 2.5, 0.15, circlePath(9));
          neonShape(g, o.color, 6, 2, 0.6, polyPath(4, 4, 0));
        });
      } else {
        sp = Sprites.get('pk-' + o.color, o.r, 8, (g) => neonShape(g, o.color, 8, 1.5, 0.6, (p) => {
          p.moveTo(0, -o.r); p.lineTo(o.r * 0.7, 0); p.lineTo(0, o.r); p.lineTo(-o.r * 0.7, 0);
        }));
      }
      const bob = o.kind === 'xp' ? 0 : Math.sin(time * 4 + i) * 2;
      ctx.drawImage(sp.img, o.x - sp.half, o.y - sp.half + bob);
    }
  },
};
