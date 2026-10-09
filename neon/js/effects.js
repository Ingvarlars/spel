'use strict';
// Visuella effekter: partiklar, skadesiffror, chockvågor och skärmskakning.
// Allt är poolat så att inget nytt skapas under spelets gång.

const MAX_PARTICLES = 3000;
const MAX_TEXTS = 160;

function createParticle() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 3 };
}
function createText() {
  return { x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', size: 14 };
}
function createRing() {
  return { x: 0, y: 0, r: 0, max: 0, life: 0, total: 1, color: '#fff', width: 3 };
}

const Effects = {
  particles: new Pool(createParticle, 1500),
  texts: new Pool(createText, 80),
  rings: new Pool(createRing, 40),
  trauma: 0,
  shakeX: 0,
  shakeY: 0,
  // Ändras från inställningsmenyn.
  settings: { shake: true, numbers: true, particles: 1 },

  reset() {
    this.particles.clear();
    this.texts.clear();
    this.rings.clear();
    this.trauma = 0;
    this.shakeX = this.shakeY = 0;
  },

  particle(x, y, vx, vy, life, size, color, drag) {
    if (this.particles.count >= MAX_PARTICLES) return null;
    const p = this.particles.spawn();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.color = color;
    p.drag = drag === undefined ? 3 : drag;
    return p;
  },

  // Partiklar som sprids åt alla håll.
  burst(x, y, color, count, speed, life, size) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = rand(0.2, 1) * speed;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1.2), size * rand(0.6, 1.3), color);
    }
  },

  // Gnistor i en kon runt en riktning.
  sparks(x, y, angle, spread, color, count, speed) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread), s = rand(0.4, 1) * speed;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.35), rand(1.5, 2.5), color, 5);
    }
  },

  text(x, y, str, color, size) {
    if (!this.settings.numbers || this.texts.count >= MAX_TEXTS) return;
    const t = this.texts.spawn();
    t.x = x + rand(-6, 6); t.y = y;
    t.vy = -70;
    t.life = t.max = 0.7;
    t.text = str;
    t.color = color;
    t.size = size;
  },

  ring(x, y, maxR, color, life, width) {
    if (this.rings.count >= 60) return;
    const r = this.rings.spawn();
    r.x = x; r.y = y; r.r = 0; r.max = maxR;
    r.life = r.total = life;
    r.color = color;
    r.width = width || 3;
  },

  shake(amount) {
    if (!this.settings.shake) return;
    this.trauma = Math.min(1, this.trauma + amount);
  },

  update(dt) {
    const ps = this.particles.active;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.releaseAt(i); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const ts = this.texts.active;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.releaseAt(i); continue; }
      t.y += t.vy * dt;
      t.vy *= Math.exp(-3 * dt);
    }
    const rs = this.rings.active;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.releaseAt(i); continue; }
      const t = 1 - r.life / r.total;
      r.r = r.max * (1 - (1 - t) * (1 - t));
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 22;
    this.shakeX = s * rand(-1, 1);
    this.shakeY = s * rand(-1, 1);
  },

  draw(ctx, game) {
    const v = game.view(20);
    ctx.globalCompositeOperation = 'lighter';
    const ps = this.particles.active;
    let lastColor = '';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; }
      ctx.globalAlpha = p.life / p.max;
      const s = p.size;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    const rs = this.rings.active;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      ctx.globalAlpha = r.life / r.total;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawTexts(ctx) {
    const ts = this.texts.active;
    if (!ts.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = 'bold ' + t.size + 'px system-ui, sans-serif';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};
