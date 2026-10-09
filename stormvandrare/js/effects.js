'use strict';
// Visuella effekter: partiklar, flytande text och skärmskakning (poolade).

const MAX_PARTICLES = 2500;

function createParticle() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 2, grav: 0, add: false };
}
function createFloatText() {
  return { x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', size: 14 };
}

const Effects = {
  particles: new Pool(createParticle, 800),
  texts: new Pool(createFloatText, 40),
  trauma: 0,
  shakeX: 0,
  shakeY: 0,
  settings: { shake: true, numbers: true, particles: 1 },

  reset() {
    this.particles.clear();
    this.texts.clear();
    this.trauma = 0;
    this.shakeX = this.shakeY = 0;
  },

  // add = additiv blandning (lysande partiklar), grav = egen nedåtkraft.
  particle(x, y, vx, vy, life, size, color, drag, grav, add) {
    if (this.particles.count >= MAX_PARTICLES) return null;
    const p = this.particles.spawn();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.color = color;
    p.drag = drag === undefined ? 2 : drag;
    p.grav = grav || 0;
    p.add = add !== false;
    return p;
  },

  burst(x, y, color, count, speed, life, size, grav, add) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = rand(0.2, 1) * speed;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1.2), size * rand(0.6, 1.3), color, 3, grav, add);
    }
  },

  // Gnistor i en kon.
  sparks(x, y, angle, spread, color, count, speed, size) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread), s = rand(0.4, 1) * speed;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.4), size || rand(1.5, 3), color, 4);
    }
  },

  // Damm och grus som faller (inte lysande).
  debris(x, y, color, count, speed) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI, 0), s = rand(0.3, 1) * speed;
      this.particle(x + rand(-6, 6), y + rand(-6, 6), Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.1), rand(2, 4.5), color, 1, 900, false);
    }
  },

  text(x, y, str, color, size) {
    if (!this.settings.numbers || this.texts.count >= 60) return;
    const t = this.texts.spawn();
    t.x = x + rand(-6, 6); t.y = y;
    t.vy = -60;
    t.life = t.max = 0.8;
    t.text = str;
    t.color = color;
    t.size = size || 14;
  },

  shake(amount) {
    if (this.settings.shake) this.trauma = Math.min(1, this.trauma + amount);
  },

  update(dt) {
    const ps = this.particles.active;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.releaseAt(i); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
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
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const s = this.trauma * this.trauma * 20;
    this.shakeX = s * rand(-1, 1);
    this.shakeY = s * rand(-1, 1);
  },

  // Ritar vanliga partiklar först, sedan de lysande additivt.
  draw(ctx, game) {
    const v = game.view(20);
    const ps = this.particles.active;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      let last = '';
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.add !== (pass === 1)) continue;
        if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
        if (p.color !== last) { ctx.fillStyle = p.color; last = p.color; }
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
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
    ctx.strokeStyle = 'rgba(30,20,10,0.7)';
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      ctx.font = 'bold ' + t.size + 'px Georgia, serif';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};
