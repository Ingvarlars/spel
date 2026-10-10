'use strict';
// Sfärer (chip, mark, broam), gemhearts och knobweed.
// Laddade sfärer lyser; man drar Stormlight ur dem på avstånd och de blir mörka
// men ligger kvar tills highstormen laddar dem igen.

const GEMS = [
  { name: 'diamant', c: [0.95, 0.98, 1] },
  { name: 'safir', c: [0.35, 0.6, 1] },
  { name: 'rubin', c: [1, 0.3, 0.3] },
  { name: 'smaragd', c: [0.3, 0.95, 0.5] },
  { name: 'topas', c: [1, 0.78, 0.25] },
  { name: 'ametist', c: [0.75, 0.45, 1] },
];
const SPHERE_SIZES = [
  { name: 'chip', light: 12, r: 0.07, value: 1 },
  { name: 'mark', light: 25, r: 0.1, value: 5 },
  { name: 'broam', light: 50, r: 0.14, value: 20 },
];

function createPickup() {
  return { kind: 'sphere', pos: V3.create(), vel: V3.create(), size: 0, gem: 0, charged: true, life: -1, settled: false, bob: 0, value: 0, taken: false };
}

const Pickups = {
  pool: new Pool(createPickup, 120),
  streams: [], // Stormlight som strömmar till spelaren { x, y, z, t, c }
  _m: M4.create(),
  _c: V3.create(),

  reset() { this.pool.clear(); this.streams.length = 0; },

  spawnSphere(x, y, z, size, charged, loose) {
    const o = this.pool.spawn();
    o.kind = 'sphere';
    V3.set(o.pos, x, y + 0.15, z);
    if (loose) V3.set(o.vel, rand(-3, 3), rand(4, 7), rand(-3, 3)); else V3.set(o.vel, 0, 0, 0);
    o.size = size;
    o.gem = randInt(0, GEMS.length - 1);
    o.charged = charged;
    o.life = loose ? 60 : -1;
    o.settled = !loose;
    o.bob = rand(0, TAU);
    o.value = SPHERE_SIZES[size].value;
    o.taken = false;
    return o;
  },

  spawnItem(kind, x, y, z, loose) {
    const o = this.pool.spawn();
    o.kind = kind;
    V3.set(o.pos, x, y + (loose ? 0.5 : 0), z);
    if (loose) V3.set(o.vel, rand(-2, 2), 7, rand(-2, 2)); else V3.set(o.vel, 0, 0, 0);
    o.settled = !loose;
    o.life = -1;
    o.bob = rand(0, TAU);
    o.taken = false;
    o.charged = true;
    return o;
  },

  dropFromEnemy(e) {
    let left = e.def.glow * (e.elite ? 3 : 1) + 2;
    while (left > 0 && this.pool.count < 160) {
      const size = left >= 20 && Math.random() < 0.4 ? 2 : left >= 5 && Math.random() < 0.5 ? 1 : 0;
      this.spawnSphere(e.pos[0], e.pos[1] + e.h * 0.5, e.pos[2], size, true, true);
      left -= SPHERE_SIZES[size].value;
    }
    if (Math.random() < 0.05) this.spawnItem('knobweed', e.pos[0], e.pos[1], e.pos[2], true);
  },

  // Highstormen laddar sfärer som stormmuren passerar.
  chargeBetween(x0, x1) {
    for (const o of this.pool.active) {
      if (o.kind === 'sphere' && !o.charged && o.pos[0] >= x0 && o.pos[0] <= x1) {
        o.charged = true;
        Effects.burst(o.pos[0], o.pos[1], o.pos[2], GEMS[o.gem].c, 8, 2, 0.6, 0.06);
      }
    }
  },

  update(dt, game) {
    const p = game.player;
    const pc = p.center(this._c);
    const range = p.stats.drawRange;
    const a = this.pool.active;
    for (let i = a.length - 1; i >= 0; i--) {
      const o = a[i];
      if (o.life > 0) { o.life -= dt; if (o.life <= 0) { this.pool.releaseAt(i); continue; } }
      o.bob += dt * 2.5;
      if (!o.settled) {
        o.vel[1] -= G_BASE * 0.8 * dt;
        V3.addScaled(o.pos, o.pos, o.vel, dt);
        const g = World.groundBelow(o.pos[0], o.pos[1] + 0.3, o.pos[2]);
        if (o.pos[1] <= g + 0.08) {
          o.pos[1] = g + 0.08;
          if (Math.abs(o.vel[1]) < 2) { o.settled = true; V3.set(o.vel, 0, 0, 0); }
          else { o.vel[1] = -o.vel[1] * 0.35; o.vel[0] *= 0.6; o.vel[2] *= 0.6; }
        }
      }
      if (!p.alive) continue;
      const d2 = V3.dist2(o.pos, pc);
      if (o.kind === 'sphere') {
        // Dra in Stormlight på avstånd.
        if (o.charged && d2 < range * range && p.light < p.stats.maxLight - 1) {
          o.charged = false;
          p.addLight(SPHERE_SIZES[o.size].light);
          this.streams.push({ x: o.pos[0], y: o.pos[1], z: o.pos[2], t: 0, c: GEMS[o.gem].c });
          game.onDrawLight(o);
        }
        // Plocka upp sfären när man går över den.
        if (!o.taken && d2 < 1.3 * 1.3) {
          o.taken = true;
          if (o.charged) { p.addLight(SPHERE_SIZES[o.size].light); game.onDrawLight(o); }
          game.onSphereTaken(o);
          this.pool.releaseAt(i);
        }
      } else if (d2 < 2.2 * 2.2) {
        game.onItem(o);
        this.pool.releaseAt(i);
      }
    }
    for (let i = this.streams.length - 1; i >= 0; i--) {
      this.streams[i].t += dt * 2.2;
      if (this.streams[i].t >= 1) this.streams.splice(i, 1);
    }
  },

  draw(game) {
    const m = this._m;
    const pc = game.player.center(this._c);
    const t = game.realTime;
    // De närmaste laddade sfärerna lyser upp omgivningen.
    let lights = 0;
    for (const o of this.pool.active) {
      if (!Camera.sphereVisible(o.pos[0], o.pos[1], o.pos[2], 1)) continue;
      const dist = V3.dist(o.pos, Camera.pos);
      if (dist > 150) continue;
      const y = o.pos[1] + (o.settled ? Math.sin(o.bob) * 0.02 : 0);
      if (o.kind === 'sphere') {
        const S = SPHERE_SIZES[o.size], G = GEMS[o.gem].c;
        M4.fromTRS(m, o.pos[0], y, o.pos[2], o.bob, 0, 0, S.r, S.r, S.r);
        Renderer.draw(Models.sphereGem(o.gem, o.charged), m, { shadow: false });
        if (o.charged) {
          Renderer.particle(o.pos[0], y, o.pos[2], S.r * 4 + Math.sin(t * 3 + o.bob) * 0.02, G[0], G[1], G[2], 0.55, true);
          if (lights < 4 && dist < 30) { Renderer.light(o.pos[0], y + 0.3, o.pos[2], G[0] * 0.6, G[1] * 0.6, G[2] * 0.6, 3 + o.size * 1.5); lights++; }
        }
      } else if (o.kind === 'gemheart') {
        M4.fromTRS(m, o.pos[0], y + 0.6 + Math.sin(t * 1.5) * 0.1, o.pos[2], t * 0.6, 0.2, 0, 1, 1, 1);
        Renderer.draw(Models.gemheart(), m, { emissive: 0.3 });
        Renderer.particle(o.pos[0], y + 0.6, o.pos[2], 1.4, 0.3, 1, 0.6, 0.35, true);
        Renderer.light(o.pos[0], y + 1, o.pos[2], 0.3, 1, 0.5, 9);
      } else if (o.kind === 'knobweed') {
        M4.fromTRS(m, o.pos[0], o.pos[1], o.pos[2], o.bob * 0.1, 0, 0, 1, 1, 1);
        Renderer.draw(Models.knobweed(), m);
      }
    }
    // Strömmar av Stormlight från sfär till spelare.
    for (const s of this.streams) {
      for (let k = 0; k < 8; k++) {
        const tt = clamp(s.t - k * 0.04, 0, 1);
        const x = lerp(s.x, pc[0], tt) + Math.sin(tt * 9 + k) * 0.3 * (1 - tt);
        const y = lerp(s.y, pc[1], tt) + Math.sin(tt * Math.PI) * 1.2;
        const z = lerp(s.z, pc[2], tt) + Math.cos(tt * 9 + k) * 0.3 * (1 - tt);
        Renderer.particle(x, y, z, 0.09 - k * 0.008, 0.85 * 0.6 + s.c[0] * 0.4, 0.95 * 0.6 + s.c[1] * 0.4, 0.6 + s.c[2] * 0.4, 0.8 - k * 0.08, true);
      }
    }
  },
};

Object.assign(Models, {
  // Glaskula med en ädelsten inuti (laddad = självlysande).
  sphereGem(gem, charged) {
    const key = 'sph' + gem + (charged ? 'c' : 'd');
    if (this.cache[key]) return this.cache[key];
    const g = GEMS[gem].c;
    const mb = new MeshBuilder();
    mb.ellipsoid(0, 0, 0, 1, 1, 1, 10, 6, [0.78, 0.84, 0.88, 0.05]);
    const c = charged ? [g[0], g[1], g[2], 2.5] : [0.36, 0.35, 0.34, 0];
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 0, 0.5, 0.6, 0, 1, 1, 1));
    mb.sphere(0, 0, 0, 0.62, 5, c);
    mb.transform(null);
    return (this.cache[key] = mb.build());
  },
  gemheart() {
    if (this.cache.gemheart) return this.cache.gemheart;
    const mb = new MeshBuilder();
    const c = [0.25, 0.85, 0.5, 1.4], hi = [0.7, 1, 0.85, 2];
    mb.cyl(0, -0.45, 0, 0.0, 0.42, 0.45, 7, c, null);
    mb.cyl(0, 0, 0, 0.42, 0.0, 0.6, 7, hi, null);
    return (this.cache.gemheart = mb.build());
  },
  knobweed() {
    if (this.cache.knob) return this.cache.knob;
    const mb = new MeshBuilder();
    const stem = col('#4f7a35'), knob = col('#86b84f'), sap = col('#e6f2c8', 0.6);
    mb.cyl(0, 0, 0, 0.05, 0.03, 0.55, 5, stem);
    mb.ellipsoid(0, 0.6, 0, 0.1, 0.09, 0.1, 6, 4, knob);
    mb.ellipsoid(0.12, 0.3, 0.03, 0.07, 0.06, 0.07, 6, 4, knob);
    mb.ellipsoid(-0.1, 0.42, -0.04, 0.07, 0.06, 0.07, 6, 4, knob);
    mb.ellipsoid(0, 0.68, 0.06, 0.03, 0.03, 0.03, 5, 3, sap);
    return (this.cache.knob = mb.build());
  },
});
