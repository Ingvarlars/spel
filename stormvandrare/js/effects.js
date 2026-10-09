'use strict';
// Effekter i 3D: partiklar (lysande och vanliga), flytande text på HUD:en,
// skärmskakning och spår (t.ex. Shardblade-hugg).

const MAX_PARTICLES = 3000;

function createParticle() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, r: 1, g: 1, b: 1, a: 1, drag: 2, grav: 0, add: true, grow: 0 };
}
function createFloat() {
  return { x: 0, y: 0, z: 0, life: 0, max: 1, text: '', color: '#fff', size: 14, rise: 0 };
}

const Effects = {
  particles: new Pool(createParticle, 1200),
  floats: new Pool(createFloat, 40),
  trauma: 0,
  settings: { shake: true, numbers: true, particles: 1 },

  reset() {
    this.particles.clear();
    this.floats.clear();
    this.trauma = 0;
  },

  // c = [r, g, b] (0..1)
  particle(x, y, z, vx, vy, vz, life, size, c, a, drag, grav, add, grow) {
    if (this.particles.count >= MAX_PARTICLES) return null;
    const p = this.particles.spawn();
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = p.max = life;
    p.size = size;
    p.r = c[0]; p.g = c[1]; p.b = c[2]; p.a = a === undefined ? 1 : a;
    p.drag = drag === undefined ? 2 : drag;
    p.grav = grav || 0;
    p.add = add !== false;
    p.grow = grow || 0;
    return p;
  },

  burst(x, y, z, c, count, speed, life, size, opts) {
    count = Math.round(count * this.settings.particles);
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      // Slumpad riktning på en sfär.
      const u = rand(-1, 1), a = rand(0, TAU), s = Math.sqrt(1 - u * u), v = rand(0.25, 1) * speed;
      this.particle(x, y, z, Math.cos(a) * s * v, u * v + (o.up || 0), Math.sin(a) * s * v, life * rand(0.6, 1.25), size * rand(0.6, 1.4), c, o.alpha, o.drag === undefined ? 3 : o.drag, o.grav, o.add, o.grow);
    }
  },

  // Gnistor i en riktning (dx, dy, dz) med spridning.
  sparks(x, y, z, dx, dy, dz, spread, c, count, speed) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const v = rand(0.4, 1) * speed;
      this.particle(x, y, z, (dx + rand(-spread, spread)) * v, (dy + rand(-spread, spread)) * v, (dz + rand(-spread, spread)) * v, rand(0.15, 0.4), rand(0.04, 0.09), c, 1, 4, 10);
    }
  },

  // Damm och stenflisor (inte lysande, faller).
  debris(x, y, z, c, count, speed) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), v = rand(0.3, 1) * speed;
      this.particle(x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), z + rand(-0.3, 0.3), Math.cos(a) * v, rand(0.3, 1.2) * v, Math.sin(a) * v, rand(0.6, 1.3), rand(0.06, 0.16), c, 1, 1, 22, false);
    }
  },

  dust(x, y, z, count, radius) {
    count = Math.round(count * this.settings.particles);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = rand(0, radius);
      this.particle(x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, Math.cos(a) * rand(1, 4), rand(0.5, 2), Math.sin(a) * rand(1, 4), rand(0.6, 1.4), rand(0.25, 0.6), [0.78, 0.66, 0.52], 0.45, 2, -0.5, false, 0.8);
    }
  },

  text(x, y, z, str, color, size) {
    if (!this.settings.numbers || this.floats.count >= 50) return;
    const t = this.floats.spawn();
    t.x = x + rand(-0.3, 0.3); t.y = y; t.z = z + rand(-0.3, 0.3);
    t.life = t.max = 0.9;
    t.text = str;
    t.color = color;
    t.size = size || 15;
    t.rise = 0;
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
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.size += p.grow * dt;
    }
    const fs = this.floats.active;
    for (let i = fs.length - 1; i >= 0; i--) {
      const t = fs[i];
      t.life -= dt;
      t.rise += dt * 1.2;
      if (t.life <= 0) this.floats.releaseAt(i);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma;
    Camera.shakeX = s * rand(-0.5, 0.5);
    Camera.shakeY = s * rand(-0.5, 0.5);
  },

  draw() {
    const ps = this.particles.active;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const k = p.life / p.max;
      Renderer.particle(p.x, p.y, p.z, p.size, p.r, p.g, p.b, p.a * Math.min(1, k * 2), p.add);
    }
  },

  // Flytande text projiceras till HUD:en.
  drawFloats(ctx, w, h) {
    const fs = this.floats.active;
    if (!fs.length) return;
    const out = this._o || (this._o = new Float32Array(2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30,20,10,0.75)';
    for (let i = 0; i < fs.length; i++) {
      const t = fs[i];
      if (!Camera.project(t.x, t.y + t.rise, t.z, w, h, out)) continue;
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2.5);
      ctx.font = 'bold ' + t.size + 'px Georgia, serif';
      ctx.strokeText(t.text, out[0], out[1]);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, out[0], out[1]);
    }
    ctx.globalAlpha = 1;
  },
};
