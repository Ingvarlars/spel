'use strict';
// Fiender i 3D: beteenden, fysik, projektiler (pilar, bråte), chockvågor och
// röda blixtar. Bossar sköts av bosses.js men använder samma lista.

// Färger och kroppsval för de humanoida fienderna (Parshendi har karapaxpansar
// som växer ur huden; stormformen har glödande röda ögon).
const ENEMY_PAL = {
  warrior: { skin: col('#3a2a2c'), pants: col('#4a2c22'), boots: col('#2a1d18'), belt: col('#6a3a24'), body: col('#3a2a2c'), sleeve: col('#3a2a2c'), plate: col('#a8452a'), helmet: col('#b5522f'), eye: col('#2a1a10'), cuff: col('#a8452a') },
  archer: { skin: col('#3d2b2b'), pants: col('#5a3a26'), boots: col('#2a1d18'), belt: col('#6a4a2c'), body: col('#5d4a3a'), sleeve: col('#3d2b2b'), plate: col('#c46a3a'), helmet: col('#c46a3a'), eye: col('#2a1a10'), cuff: col('#5d4a3a') },
  shield: { skin: col('#33262a'), pants: col('#3b2a22'), boots: col('#221812'), belt: col('#5a3424'), body: col('#33262a'), sleeve: col('#33262a'), plate: col('#8e3a24'), helmet: col('#8e3a24'), eye: col('#2a1a10'), cuff: col('#8e3a24') },
  thunder: { skin: col('#2a1e24'), pants: col('#2a1a20'), boots: col('#1a1214'), belt: col('#5a1a24'), body: col('#2a1e24'), sleeve: col('#2a1e24'), plate: col('#5a1f2a'), helmet: col('#4a1822'), robe: col('#3a1420'), eye: col('#ff3a5a', 3), cuff: col('#5a1f2a') },
  hover: { skin: col('#3c2c30'), pants: col('#6a2a2a'), boots: col('#2a1d18'), belt: col('#c9a046'), body: col('#7a2e2a'), sleeve: col('#7a2e2a'), plate: col('#8a5a3a'), helmet: col('#5a3a2a'), robe: col('#7a2e2a'), mask: col('#d8c7a8'), eye: col('#ff5a3a', 2), cuff: col('#c9a046') },
};
const ENEMY_BODY = {
  warrior: { plates: true, helmet: true, bulk: 1.12 },
  archer: { plates: true, helmet: true, bulk: 1.0 },
  shield: { plates: true, helmet: true, bulk: 1.3 },
  thunder: { plates: true, helmet: true, robe: true, bulk: 1.05 },
  hover: { plates: true, helmet: true, robe: true, bulk: 1.0 },
};

const ENEMY_DEFS = {
  crab:    { name: 'Kremling',              hp: 16,  r: 0.38, h: 0.6, speed: 4.2, dmg: 7,  weight: 0.5, contact: true,  glow: 1 },
  warrior: { name: 'Parshendi-krigare',     hp: 60,  r: 0.42, h: 1.9, speed: 5.4, dmg: 18, weight: 1.2, contact: false, glow: 3 },
  archer:  { name: 'Parshendi-bågskytt',    hp: 38,  r: 0.4,  h: 1.85, speed: 4.6, dmg: 12, weight: 1,  contact: false, glow: 3 },
  shield:  { name: 'Parshendi-sköldbärare', hp: 80,  r: 0.5,  h: 2.0, speed: 3.6, dmg: 15, weight: 2.5, contact: false, glow: 4 },
  thunder: { name: 'Stormform',             hp: 50,  r: 0.42, h: 1.95, speed: 4,  dmg: 24, weight: 1,  contact: false, glow: 4 },
  hover:   { name: 'Fused (Himmelsk)',      hp: 64,  r: 0.45, h: 2.0, speed: 9,   dmg: 16, weight: 1,  contact: false, glow: 5, flying: true },
  leech:   { name: 'Voidspren',             hp: 28,  r: 0.5,  h: 1.0, speed: 9,   dmg: 0,  weight: 0.5, contact: false, glow: 4, flying: true },
  brute:   { name: 'Stenbjässe',            hp: 210, r: 0.9,  h: 2.6, speed: 3,   dmg: 20, weight: 8,  contact: true,  glow: 8 },
};

function createEnemy() {
  return {
    id: 0, type: '', def: null, pos: V3.create(), vel: V3.create(), aim: V3.create(), target: V3.create(),
    yaw: 0, r: 0.4, h: 1.8, hp: 1, maxHp: 1, dmg: 0, speed: 0, state: 0, timer: 0, cd: 0,
    grounded: false, flash: 0, dead: false, alert: false, stun: 0, float: 0, lastSwing: -1,
    los: false, losTimer: 0, anim: 0, elite: false, mods: null, boss: false, home: null,
    turnTimer: 0, fallV: 0, wallClimb: false, seen: false, scale: 1, lash: 0, lashDir: null, lastSpeed: 0,
  };
}

function createProjectile() {
  return { kind: '', pos: V3.create(), vel: V3.create(), dmg: 0, life: 0, grav: 0, r: 0.2, parryable: false, stuck: 0, owner: null, spin: 0 };
}

const Projectiles = {
  pool: new Pool(createProjectile, 80),
  rings: [],   // chockvågor { x, y, z, r, speed, max, dmg, hit }
  beams: [],   // röda blixtar { a: [x,y,z], b: [x,y,z], life, seed }

  reset() { this.pool.clear(); this.rings.length = 0; this.beams.length = 0; },

  spawn(kind, x, y, z, vx, vy, vz, dmg, opts) {
    const b = this.pool.spawn();
    b.kind = kind;
    V3.set(b.pos, x, y, z);
    V3.set(b.vel, vx, vy, vz);
    b.dmg = dmg;
    b.life = (opts && opts.life) || 5;
    b.grav = (opts && opts.grav) || 0;
    b.r = (opts && opts.r) || 0.2;
    b.parryable = !!(opts && opts.parryable);
    b.stuck = 0;
    b.owner = (opts && opts.owner) || null;
    b.spin = rand(0, TAU);
    return b;
  },

  ring(x, y, z, dmg, max, speed) {
    this.rings.push({ x, y, z, r: 0.5, speed: speed || 9, max: max || 10, dmg, hit: false });
  },

  beam(a, b) {
    this.beams.push({ a: Float32Array.from(a), b: Float32Array.from(b), life: 0.3, seed: Math.random() * 1000 });
  },

  update(dt, game) {
    const p = game.player;
    const pc = p.center(this._pc || (this._pc = V3.create()));
    const a = this.pool.active;
    for (let i = a.length - 1; i >= 0; i--) {
      const b = a[i];
      b.life -= dt;
      if (b.life <= 0) { this.pool.releaseAt(i); continue; }
      if (b.stuck > 0) { b.stuck -= dt; if (b.stuck <= 0) this.pool.releaseAt(i); continue; }
      b.vel[1] -= b.grav * dt;
      b.vel[0] += game.wind(b.pos) * dt * 0.3;
      V3.addScaled(b.pos, b.pos, b.vel, dt);
      b.spin += dt * 10;
      if (World.insideAny(b.pos[0], b.pos[1], b.pos[2])) {
        if (b.kind === 'arrow') { b.stuck = 2; continue; }
        if (b.kind === 'rock') Effects.debris(b.pos[0], b.pos[1], b.pos[2], [0.45, 0.4, 0.36], 6, 4);
        this.pool.releaseAt(i);
        continue;
      }
      if (p.alive && V3.dist2(b.pos, pc) < (b.r + 0.55) * (b.r + 0.55) + (Math.abs(b.pos[1] - pc[1]) < 0.9 ? 0.15 : 0)) {
        p.takeDamage(b.dmg, game, b.pos);
        this.pool.releaseAt(i);
      }
    }
    // Chockvågor längs marken.
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt;
      if (r.r > r.max) { this.rings.splice(i, 1); continue; }
      if (game.tick % 3 === 0) {
        const a2 = rand(0, TAU);
        Effects.debris(r.x + Math.cos(a2) * r.r, r.y + 0.2, r.z + Math.sin(a2) * r.r, [0.6, 0.48, 0.36], 2, 3);
      }
      if (!r.hit && p.alive && p.grounded) {
        const d = Math.hypot(p.pos[0] - r.x, p.pos[2] - r.z);
        if (Math.abs(d - r.r) < 0.8 && Math.abs(p.pos[1] - r.y) < 1.2) { r.hit = true; p.takeDamage(r.dmg, game, [r.x, r.y, r.z]); }
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
  },

  draw(game) {
    const a = this.pool.active;
    const m = this._m || (this._m = M4.create());
    for (let i = 0; i < a.length; i++) {
      const b = a[i];
      if (!Camera.sphereVisible(b.pos[0], b.pos[1], b.pos[2], 2)) continue;
      if (b.kind === 'arrow') {
        const v = b.vel, l = V3.len(v) || 1;
        const yaw = Math.atan2(v[0], v[2]), pitch = -Math.asin(clamp(v[1] / l, -1, 1));
        M4.fromTRS(m, b.pos[0], b.pos[1], b.pos[2], yaw, pitch, 0, 1, 1, 1);
        Renderer.draw(Models.arrow(), m, { shadow: false });
      } else if (b.kind === 'rock') {
        M4.fromTRS(m, b.pos[0], b.pos[1], b.pos[2], b.spin, b.spin * 0.7, 0, b.r, b.r, b.r);
        Renderer.draw(Models.rock(), m);
      }
    }
    // Chockvågor som ringar av damm.
    for (const r of this.rings) {
      const n = 20;
      for (let k = 0; k < n; k++) {
        const a2 = (k / n) * TAU;
        Renderer.particle(r.x + Math.cos(a2) * r.r, r.y + 0.3, r.z + Math.sin(a2) * r.r, 0.45, 0.78, 0.62, 0.45, 0.6 * (1 - r.r / r.max), false);
      }
    }
    // Röda blixtar.
    for (const bm of this.beams) {
      const rng = makeRng(bm.seed + Math.floor(game.realTime * 30));
      const pts = [];
      const n = 12;
      for (let k = 0; k <= n; k++) {
        const t = k / n, j = k === 0 || k === n ? 0 : 0.5;
        pts.push([lerp(bm.a[0], bm.b[0], t) + (rng() - 0.5) * j, lerp(bm.a[1], bm.b[1], t) + (rng() - 0.5) * j, lerp(bm.a[2], bm.b[2], t) + (rng() - 0.5) * j]);
      }
      const k = Math.min(1, bm.life * 5);
      Renderer.ribbon(pts, 0.5, 1, 0.15, 0.35, 0.7 * k, true);
      Renderer.ribbon(pts, 0.12, 1, 0.9, 0.95, k, true);
    }
  },
};

Object.assign(Models, {
  arrow() {
    return this.cache.arrow || (this.cache.arrow = new MeshBuilder()
      .box(0, 0, 0, 0.03, 0.03, 0.9, col('#3b2a1c'))
      .box(0, 0, 0.47, 0.06, 0.06, 0.1, col('#9aa4ab'))
      .box(0, 0, -0.42, 0.12, 0.01, 0.12, col('#c94c34')).build());
  },
  rock() {
    return this.cache.rock || (this.cache.rock = new MeshBuilder().sphere(0, 0, 0, 1, 5, col('#6e5f55')).build());
  },
});

const Enemies = {
  pool: new Pool(createEnemy, 60),
  serial: 0,
  tethers: [],
  _t: V3.create(),
  _t2: V3.create(),
  _n: V3.create(),
  _pc: V3.create(),
  _m: M4.create(),

  get list() { return this.pool.active; },

  reset() {
    this.pool.clear();
    Projectiles.reset();
  },

  spawn(type, x, y, z, mods, elite, home) {
    const def = ENEMY_DEFS[type];
    const e = this.pool.spawn();
    const m = mods || { hp: 1, dmg: 1, speed: 1 };
    e.id = ++this.serial;
    e.type = type; e.def = def;
    V3.set(e.pos, x, y, z);
    V3.set(e.vel, 0, 0, 0);
    e.yaw = rand(0, TAU);
    e.scale = elite ? 1.25 : 1;
    e.r = def.r * e.scale; e.h = def.h * e.scale;
    e.maxHp = e.hp = def.hp * m.hp * (elite ? 2.4 : 1);
    e.dmg = def.dmg * m.dmg * (elite ? 1.3 : 1);
    e.speed = def.speed * m.speed * rand(0.92, 1.08);
    e.state = 0; e.timer = rand(0.5, 2); e.cd = rand(0.5, 1.5);
    e.grounded = false; e.flash = 0; e.dead = false; e.alert = false;
    e.stun = 0; e.float = 0; e.lastSwing = -1; e.los = false; e.losTimer = rand(0, 0.3);
    e.anim = rand(0, 10); e.elite = !!elite; e.mods = m; e.boss = false;
    e.home = home || World.plateauAt(x, z);
    e.turnTimer = 0; e.wallClimb = false; e.seen = false;
    e.lash = 0; e.lashDir = null; e.lastSpeed = 0; e.pose = null; e.invulnerable = false;
    return e;
  },

  center(e, out) { return V3.set(out, e.pos[0], e.pos[1] + e.h * 0.55, e.pos[2]); },

  update(dt, game) {
    const p = game.player;
    const pc = p.center(this._pc);
    const a = this.pool.active;
    this.tethers.length = 0;
    for (let i = a.length - 1; i >= 0; i--) if (a[i].dead) this.pool.releaseAt(i);
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.boss) continue;
      const dx = pc[0] - e.pos[0], dy = pc[1] - (e.pos[1] + e.h * 0.55), dz = pc[2] - e.pos[2];
      const d = Math.hypot(dx, dy, dz);
      if (!e.alert && d > 110) continue;
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.cd > 0) e.cd -= dt;

      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.losTimer = 0.3;
        e.los = d < 60 && World.lineClear(e.pos[0], e.pos[1] + e.h * 0.8, e.pos[2], pc[0], pc[1], pc[2]);
        if (e.los && d < (e.def.flying ? 34 : 26) && p.alive) {
          if (!e.alert) game.onEnemyAlert(e);
          e.alert = true;
        }
        if (e.los && d < 40 && !e.seen) { e.seen = true; game.onEnemySeen(e); }
      }

      let wantX = 0, wantZ = 0, wantY = 0;
      if (e.stun > 0) { e.stun -= dt; e.state = 0; }
      else if (p.alive && !(e.lash > 0)) {
        const w = this.think(e, dt, game, dx, dy, dz, d);
        if (w) { wantX = w[0]; wantY = w[1]; wantZ = w[2]; }
      }
      this.physics(e, dt, game, wantX, wantY, wantZ);

      if (e.def.contact && p.alive && e.stun <= 0 && this.touchesPlayer(e, p, 0.1)) p.takeDamage(e.dmg, game, e.pos);
    }
  },

  touchesPlayer(e, p, pad) {
    const hx = p.pos[0] - e.pos[0], hz = p.pos[2] - e.pos[2];
    const pc = p.center(this._t);
    return Math.hypot(hx, hz) < e.r + 0.45 + pad && Math.abs(pc[1] - (e.pos[1] + e.h / 2)) < e.h / 2 + 0.9;
  },

  faceTo(e, x, z, rate, dt) {
    const want = Math.atan2(x - e.pos[0], z - e.pos[2]);
    const diff = angleDiff(want, e.yaw);
    e.yaw += clamp(diff, -rate * dt, rate * dt);
    return Math.abs(diff);
  },

  // Rörelse. (wx, wy, wz) = önskad hastighet (wy bara för flygare).
  physics(e, dt, game, wx, wy, wz) {
    const flying = e.def.flying && e.stun <= 0 && e.float <= 0;
    const v = e.vel;
    if (flying) {
      const k = 1 - Math.exp(-3 * dt);
      v[0] += (wx - v[0]) * k; v[1] += (wy - v[1]) * k; v[2] += (wz - v[2]) * k;
    } else {
      // Kanter: gå inte ut över ett stup om det inte finns mark där.
      if ((wx || wz) && e.grounded && e.type !== 'crab') {
        const l = Math.hypot(wx, wz) || 1;
        const ax = e.pos[0] + (wx / l) * (e.r + 0.7), az = e.pos[2] + (wz / l) * (e.r + 0.7);
        if (World.groundBelow(ax, e.pos[1] + 0.5, az) < e.pos[1] - 1.5) { wx = 0; wz = 0; }
      }
      const k = 1 - Math.exp(-(e.grounded ? 10 : 1.5) * dt);
      v[0] += (wx - v[0]) * k;
      v[2] += (wz - v[2]) * k;
      if (e.float > 0) { e.lash = Math.max(e.lash || 0, e.float); e.lashDir = e.lashDir || [0, 1, 0]; e.float = 0; }
      if (e.lash > 0) {
        // Lashad: fienden faller åt det håll Windrunnern bestämde.
        e.lash -= dt;
        V3.addScaled(v, v, e.lashDir, G_BASE * 1.2 * dt);
      } else if (e.wallClimb) {
        v[1] = 3.5;
      } else {
        v[1] -= G_BASE * dt;
      }
    }
    v[0] += game.wind(e.pos) * dt / e.def.weight;
    const fallV = v[1];
    V3.addScaled(e.pos, e.pos, v, dt);
    // Kollision med två sfärer (fötter och huvud).
    const n = this._n, c = this._t;
    let grounded = false, hitWall = false, hitCeil = false;
    const offs = e.h > 1.2 ? [e.r, e.h - e.r] : [e.r];
    for (let k = 0; k < offs.length; k++) {
      V3.set(c, e.pos[0], e.pos[1] + offs[k], e.pos[2]);
      const ox = c[0], oy = c[1], oz = c[2];
      if (World.collideSphere(c, e.r, n)) {
        e.pos[0] += c[0] - ox; e.pos[1] += c[1] - oy; e.pos[2] += c[2] - oz;
        V3.normalize(n, n);
        const into = V3.dot(v, n);
        if (into < 0) V3.addScaled(v, v, n, -into);
        if (n[1] > 0.6) grounded = true;
        else if (n[1] < -0.6) hitCeil = true;
        else hitWall = true;
      }
    }
    if (grounded && !e.grounded && fallV < -20 && !flying) this.impact(e, -fallV, game);
    const speed = V3.len(v);
    if (e.lash > 0 && (hitWall || hitCeil || grounded) && (e.lastSpeed || 0) > 14) { this.impact(e, e.lastSpeed, game); e.lash = 0; }
    e.lastSpeed = Math.max(speed, Math.abs(fallV));
    e.grounded = grounded;
    e.wallClimb = e.type === 'crab' && hitWall && e.alert;
    if (e.pos[1] < CHASM_FLOOR - 5) e.pos[1] = CHASM_FLOOR + 1;
  },

  impact(e, speed, game) {
    const dmg = (speed - 16) * 2.2;
    if (dmg > 2) game.damageEnemy(e, dmg, null, 0, 'fall');
    Effects.debris(e.pos[0], e.pos[1], e.pos[2], [0.55, 0.45, 0.35], 10, 4);
  },

  // Rörelse mot en punkt på marken (returnerar önskad hastighet).
  walkTo(e, x, z, speed, dt, out) {
    const dx = x - e.pos[0], dz = z - e.pos[2], d = Math.hypot(dx, dz) || 1;
    this.faceTo(e, x, z, 8, dt);
    return V3.set(out, (dx / d) * speed, 0, (dz / d) * speed);
  },

  patrol(e, dt, out) {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = rand(2, 5);
      const h = e.home;
      if (h) { const a = rand(0, TAU), r = rand(0, h.radius ? h.radius * 0.6 : 6); V3.set(e.target, h.cx + Math.cos(a) * r, 0, h.cz + Math.sin(a) * r); }
      else V3.set(e.target, e.pos[0] + rand(-6, 6), 0, e.pos[2] + rand(-6, 6));
    }
    const dx = e.target[0] - e.pos[0], dz = e.target[2] - e.pos[2];
    if (Math.hypot(dx, dz) < 1) return V3.set(out, 0, 0, 0);
    return this.walkTo(e, e.target[0], e.target[2], e.speed * 0.35, dt, out);
  },

  // Beteenden. Returnerar önskad hastighet.
  think(e, dt, game, dx, dy, dz, d) {
    const p = game.player;
    const out = this._t2;
    const hd = Math.hypot(dx, dz) || 1;
    switch (e.type) {
      case 'crab':
        if (e.alert && d < 30) return this.walkTo(e, p.pos[0], p.pos[2], e.speed * 1.3, dt, out);
        return this.patrol(e, dt, out);

      case 'warrior': {
        e.timer -= dt;
        if (!e.alert) return this.patrol(e, dt, out);
        if (e.state === 0) {
          if (hd < 2.4 && Math.abs(dy) < 1.8 && e.cd <= 0) { e.state = 1; e.timer = 0.45; game.onEnemyWindup(e); }
          return this.walkTo(e, p.pos[0], p.pos[2], hd > 2 ? e.speed : 0, dt, out);
        }
        if (e.state === 1) {
          this.faceTo(e, p.pos[0], p.pos[2], 6, dt);
          if (e.timer <= 0) {
            e.state = 2; e.timer = 0.15;
            V3.addScaled(e.vel, e.vel, [Math.sin(e.yaw), 0, Math.cos(e.yaw)], 5);
            game.onEnemyStrike(e);
          }
          return V3.set(out, 0, 0, 0);
        }
        if (e.state === 2) {
          this.meleeHit(e, game, 2.8, 0.45, e.dmg);
          if (e.timer <= 0) { e.state = 3; e.timer = 0.55; }
          return V3.set(out, e.vel[0], 0, e.vel[2]);
        }
        if (e.timer <= 0) { e.state = 0; e.cd = rand(0.3, 0.9); }
        return V3.set(out, 0, 0, 0);
      }

      case 'shield': {
        e.timer -= dt;
        if (!e.alert) return this.patrol(e, dt, out);
        // Vänder sig långsamt – gå runt eller över för att träffa ryggen.
        const off = this.faceTo(e, p.pos[0], p.pos[2], 1.3, dt);
        e.turnTimer = off > 0.6 ? e.turnTimer + dt : 0;
        if (e.state === 0) {
          if (hd < 2.6 && off < 0.4 && e.cd <= 0) { e.state = 1; e.timer = 0.4; game.onEnemyWindup(e); }
          const s = off < 0.5 && hd > 2 ? e.speed : 0;
          return V3.set(out, Math.sin(e.yaw) * s, 0, Math.cos(e.yaw) * s);
        }
        if (e.state === 1) { if (e.timer <= 0) { e.state = 2; e.timer = 0.25; game.onEnemyStrike(e); } return V3.set(out, 0, 0, 0); }
        if (e.state === 2) {
          // Sköldstöt.
          if (this.touchesPlayer(e, p, 0.6) && p.invuln <= 0) {
            p.takeDamage(e.dmg, game, e.pos);
            V3.addScaled(p.vel, p.vel, [Math.sin(e.yaw), 0.3, Math.cos(e.yaw)], 9);
          }
          if (e.timer <= 0) { e.state = 3; e.timer = 0.7; }
          return V3.set(out, Math.sin(e.yaw) * 12, 0, Math.cos(e.yaw) * 12);
        }
        if (e.timer <= 0) { e.state = 0; e.cd = rand(0.8, 1.6); }
        return V3.set(out, 0, 0, 0);
      }

      case 'archer': {
        e.timer -= dt;
        if (!e.alert) return this.patrol(e, dt, out);
        this.faceTo(e, p.pos[0], p.pos[2], 8, dt);
        if (e.state === 0) {
          if (e.cd <= 0 && e.los && d < 45) { e.state = 1; e.timer = 0.85; }
          let s = 0;
          if (hd < 9) s = -e.speed; else if (hd > 24 || !e.los) s = e.speed;
          return V3.set(out, dx / hd * s, 0, dz / hd * s);
        }
        if (e.state === 1) {
          if (e.timer <= 0) {
            const sx = e.pos[0] + Math.sin(e.yaw) * 0.5, sy = e.pos[1] + 1.4, sz = e.pos[2] + Math.cos(e.yaw) * 0.5;
            const pc = p.center(this._t);
            const lead = Math.min(1.2, d / 30);
            const v = this.ballistic(sx, sy, sz, pc[0] + p.vel[0] * lead * 0.6, pc[1] + p.vel[1] * lead * 0.3, pc[2] + p.vel[2] * lead * 0.6, 32, 14);
            Projectiles.spawn('arrow', sx, sy, sz, v[0], v[1], v[2], e.dmg, { grav: 14, parryable: true, life: 5, r: 0.15 });
            game.onEnemyShoot(e);
            e.state = 0; e.cd = rand(1.4, 2.3);
          }
          return V3.set(out, 0, 0, 0);
        }
        return V3.set(out, 0, 0, 0);
      }

      case 'thunder': {
        e.timer -= dt;
        if (!e.alert) return this.patrol(e, dt, out);
        this.faceTo(e, p.pos[0], p.pos[2], 6, dt);
        if (e.state === 0) {
          if (e.cd <= 0 && e.los && d < 32) { e.state = 1; e.timer = 1.2; game.onThunderCharge(e); }
          let s = 0;
          if (hd < 8) s = -e.speed; else if (hd > 26 || !e.los) s = e.speed;
          return V3.set(out, dx / hd * s, 0, dz / hd * s);
        }
        if (e.state === 1) {
          const pc = p.center(this._t);
          if (e.timer > 0.3) V3.set(e.aim, pc[0], pc[1], pc[2]);
          if (e.timer <= 0) { this.fireBeam(e, game); e.state = 0; e.cd = rand(2.2, 3.2); }
          return V3.set(out, 0, 0, 0);
        }
        return V3.set(out, 0, 0, 0);
      }

      case 'hover': {
        e.timer -= dt;
        this.faceTo(e, p.pos[0], p.pos[2], 5, dt);
        if (!e.alert) return V3.set(out, 0, Math.sin(e.anim) * 0.5, 0);
        if (e.state === 0) {
          const side = (e.id & 1) ? 1 : -1;
          const pc = p.center(this._t);
          const tx = pc[0] + Math.cos(e.anim * 0.5) * 8 * side, ty = pc[1] + 6 + Math.sin(e.anim * 1.3), tz = pc[2] + Math.sin(e.anim * 0.5) * 8 * side;
          if (e.timer <= 0 && e.los) { e.state = 1; e.timer = 0.6; game.onEnemyWindup(e); }
          return this.flyTo(e, tx, ty, tz, e.speed, out);
        }
        if (e.state === 1) {
          const pc = p.center(this._t);
          V3.set(e.aim, pc[0] - e.pos[0], pc[1] - e.pos[1] - 1, pc[2] - e.pos[2]);
          V3.normalize(e.aim, e.aim);
          if (e.timer <= 0) { e.state = 2; e.timer = 0.65; game.onEnemyStrike(e); }
          return V3.set(out, 0, 0, 0);
        }
        if (e.state === 2) {
          V3.scale(e.vel, e.aim, 26);
          if (this.touchesPlayer(e, p, 0.4)) p.takeDamage(e.dmg, game, e.pos);
          if (e.timer <= 0) { e.state = 3; e.timer = 0.9; }
          return V3.scale(out, e.aim, 26);
        }
        if (e.timer <= 0) { e.state = 0; e.timer = rand(2, 3.2); }
        return V3.set(out, 0, 6, 0);
      }

      case 'leech': {
        e.timer -= dt;
        this.faceTo(e, p.pos[0], p.pos[2], 6, dt);
        if (!e.alert) return V3.set(out, 0, Math.sin(e.anim * 2), 0);
        const pc = p.center(this._t);
        if (e.state === 0) {
          if (d < 7 && p.light > 0) {
            const amount = Math.min(p.light, 9 * dt);
            p.light -= amount;
            e.hp = Math.min(e.maxHp * 1.5, e.hp + amount * 0.8);
            this.tethers.push(e);
          }
          return this.flyTo(e, pc[0] - dx / d * 3, pc[1] + 1, pc[2] - dz / d * 3, e.speed, out);
        }
        if (e.timer <= 0) e.state = 0;
        return this.flyTo(e, e.pos[0] - dx / d * 15, e.pos[1] + 6, e.pos[2] - dz / d * 15, e.speed * 1.4, out);
      }

      case 'brute': {
        e.timer -= dt;
        if (!e.alert) return this.patrol(e, dt, out);
        if (e.state === 0) {
          if (e.cd <= 0 && e.grounded && hd < 14) { e.state = 1; e.timer = 0.6; game.onEnemyWindup(e); }
          return this.walkTo(e, p.pos[0], p.pos[2], hd > 3 ? e.speed : 0, dt, out);
        }
        if (e.state === 1) {
          if (e.timer <= 0) { e.vel[1] = 11; e.state = 2; e.timer = 2; }
          return V3.set(out, 0, 0, 0);
        }
        if (e.state === 2) {
          if (e.grounded && e.vel[1] <= 0 && e.timer < 1.9) {
            Projectiles.ring(e.pos[0], e.pos[1], e.pos[2], e.dmg, 12, 10);
            game.onBruteSlam(e);
            e.state = 0; e.cd = rand(2.5, 3.5);
          }
          return this.walkTo(e, p.pos[0], p.pos[2], 2.5, dt, out);
        }
        return V3.set(out, 0, 0, 0);
      }
    }
    return null;
  },

  flyTo(e, x, y, z, speed, out) {
    const dx = x - e.pos[0], dy = y - e.pos[1], dz = z - e.pos[2], d = Math.hypot(dx, dy, dz) || 1;
    const s = Math.min(speed, d * 2);
    return V3.set(out, dx / d * s, dy / d * s, dz / d * s);
  },

  // Slag i en kon framför fienden.
  meleeHit(e, game, reach, cosArc, dmg) {
    const p = game.player;
    if (!p.alive || p.invuln > 0) return;
    const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2], d = Math.hypot(dx, dz) || 1;
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    if (d < reach + 0.4 && (dx * fx + dz * fz) / d > cosArc && Math.abs(p.pos[1] - e.pos[1]) < 2) p.takeDamage(dmg, game, e.pos);
  },

  // Starthastighet för en projektil med fart v och gravitation g mot målet.
  ballistic(x, y, z, tx, ty, tz, v, g) {
    const dx = tx - x, dz = tz - z, h = Math.hypot(dx, dz) || 0.001, dy = ty - y;
    const v2 = v * v;
    const disc = v2 * v2 - g * (g * h * h + 2 * dy * v2);
    let ang = Math.PI / 4;
    if (disc >= 0) ang = Math.atan2(v2 - Math.sqrt(disc), g * h);
    const out = this._bal || (this._bal = [0, 0, 0]);
    out[0] = dx / h * Math.cos(ang) * v; out[1] = Math.sin(ang) * v; out[2] = dz / h * Math.cos(ang) * v;
    return out;
  },

  fireBeam(e, game) {
    const sx = e.pos[0] + Math.sin(e.yaw) * 0.5, sy = e.pos[1] + 1.5, sz = e.pos[2] + Math.cos(e.yaw) * 0.5;
    let dx = e.aim[0] - sx, dy = e.aim[1] - sy, dz = e.aim[2] - sz;
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const len = World.raycast(sx, sy, sz, dx, dy, dz, 45, 0.5);
    Projectiles.beam([sx, sy, sz], [sx + dx * len, sy + dy * len, sz + dz * len]);
    // Träff om spelaren är nära linjen.
    const p = game.player, pc = p.center(this._t);
    const t = clamp((pc[0] - sx) * dx + (pc[1] - sy) * dy + (pc[2] - sz) * dz, 0, len);
    const qx = sx + dx * t, qy = sy + dy * t, qz = sz + dz * t;
    if (Math.hypot(pc[0] - qx, pc[1] - qy, pc[2] - qz) < 1.1) p.takeDamage(e.dmg, game, [sx, sy, sz]);
    game.onBeam(e, sx + dx * len, sy + dy * len, sz + dz * len);
  },

  // Sköldbäraren blockerar hugg framifrån (inte ovanifrån eller bakifrån).
  blocks(e, from) {
    if (e.type !== 'shield' || e.stun > 0 || e.lash > 0) return false;
    const dx = from[0] - e.pos[0], dz = from[2] - e.pos[2], d = Math.hypot(dx, dz) || 1;
    const front = (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / d > 0.25;
    const above = from[1] > e.pos[1] + e.h + 0.2;
    return front && !above;
  },

  draw(game) {
    const a = this.pool.active;
    const t = game.realTime;
    const m = this._m;
    const pose = this._pose || (this._pose = {});
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.boss || !Camera.sphereVisible(e.pos[0], e.pos[1] + e.h / 2, e.pos[2], e.h + 1)) continue;
      const camD = V3.dist(Camera.pos, e.pos);
      if (camD > 170) continue;
      const far = camD > 35;
      const opts = e.flash > 0 ? { tint: [1, 1, 1, 0.75], shadow: !far } : far ? { shadow: false } : null;
      const s = e.scale;
      M4.fromTRS(m, e.pos[0], e.pos[1], e.pos[2], e.yaw, 0, 0, s, s, s);
      const moving = Math.hypot(e.vel[0], e.vel[2]);
      const run = e.grounded ? Math.sin(e.anim * 9) * Math.min(1, moving / 3) : 0.3;
      for (const k in pose) pose[k] = 0;
      pose.legL = run * 0.7; pose.legR = -run * 0.7; pose.armL = -run * 0.5; pose.armR = run * 0.5;
      pose.wantHand = this._hand || (this._hand = M4.create());
      switch (e.type) {
        case 'crab': {
          M4.fromTRS(m, e.pos[0], e.pos[1] + Math.abs(Math.sin(e.anim * 14)) * 0.04, e.pos[2], e.yaw, e.wallClimb ? -1.2 : 0, 0, s, s, s);
          Renderer.draw(Models.crab(), m, opts);
          break;
        }
        case 'warrior':
        case 'shield':
        case 'archer':
        case 'thunder':
        case 'hover': {
          const body = Body.build('e-' + e.type, ENEMY_PAL[e.type], ENEMY_BODY[e.type]);
          if (far) {
            // Långt bort: en enda bakad mesh.
            Renderer.draw(Body.lod('e-' + e.type, body), m, opts);
            break;
          }
          const P = e.pose || (e.pose = makePose());
          const T = this._T || (this._T = makePose());
          const base = this._B || (this._B = makePose());
          for (const k in T) T[k] = base[k];
          if (e.type === 'hover') {
            // Svävar med hängande ben; dyker med spjutet före.
            T.hipLP = 0.25; T.hipRP = 0.1; T.knL = 0.5; T.knR = 0.7; T.anL = -0.5; T.anR = -0.5;
            T.shLR = 0.6; T.elL = 0.4;
            T.shRP = e.state === 1 || e.state === 2 ? 1.6 : 0.5; T.elR = 0.2;
            T.spineP = e.state === 2 ? 0.9 : 0.15;
          } else if (moving > 0.3 && e.grounded) {
            e.walkPhase = (e.walkPhase || 0) + moving * 0.016 * 1.3;
            Anim.locomotion(T, e.walkPhase, Math.min(1, moving / 3), clamp((moving - 3) / 3, 0, 1));
          } else Anim.idle(T, t + e.id);
          if (e.type === 'warrior') {
            if (e.state === 1) { const k = 1 - e.timer / 0.45; T.shRP = 2.7 * k; T.elR = 0.6 * k; T.spineP = -0.2 * k; T.spineY = -0.3 * k; }
            else if (e.state === 2) { T.shRP = 0.4; T.elR = 0.1; T.spineP = 0.45; T.spineY = 0.3; T.knL += 0.4; }
            else T.shRP = Math.max(T.shRP, 0.3);
          } else if (e.type === 'archer' && e.state === 1) {
            const k = 1 - e.timer / 0.85;
            T.shLP = 1.55; T.elL = 0.05; T.shRP = 1.5; T.shRY = 0.3; T.elR = 0.6 + k * 1.2; T.spineY = -0.5;
          } else if (e.type === 'thunder') {
            T.hipLP = T.hipRP = 0; T.knL = T.knR = 0.05;
            if (e.state === 1) { T.shLP = T.shRP = 2.4; T.shLR = T.shRR = 0.5; T.elL = T.elR = 0.2; T.spineP = -0.2; T.neckP = -0.3; }
          } else if (e.type === 'shield') {
            T.shLP = 1.2; T.elL = 1.3; T.shLR = -0.2;
            if (e.state === 2) { T.spineP = 0.35; T.shLP = 1.5; }
          }
          const kk0 = 1 - Math.exp(-18 * 0.016);
          for (const key in P) P[key] += (T[key] - P[key]) * kk0;
          const J = Skeleton.draw(body, m, P, opts);
          const L = this._L || (this._L = M4.create()), O = this._O || (this._O = M4.create());
          if (e.type === 'warrior') {
            M4.fromTRS(L, 0, -0.08, 0, 0, 0, 0, 1, 1, 1);
            Renderer.draw(Models.axe(), M4.multiply(O, J.handR, L), opts);
          } else if (e.type === 'archer') {
            M4.fromTRS(L, 0, -0.07, 0.04, 0, 0, 0, 1, 1, 1);
            Renderer.draw(Models.bow(), M4.multiply(O, J.handL, L), opts);
          } else if (e.type === 'shield') {
            M4.fromTRS(L, 0, -0.1, 0.12, 0, 0, Math.PI / 2, 1, 1, 1);
            Renderer.draw(Models.shieldMesh(), M4.multiply(O, J.foreL, L), opts);
          } else if (e.type === 'hover') {
            M4.fromTRS(L, 0, -0.07, 0, 0, 0, 0, 1, 1, 1);
            Renderer.draw(Models.spear(), M4.multiply(O, J.handR, L), opts);
            // Långa tygband som fladdrar från ryggen.
            const q = this._q || (this._q = V3.create());
            for (let kk = 0; kk < 2; kk++) {
              const pts = [];
              M4.transformPoint(q, J.chest, [(kk - 0.5) * 0.25, 0.45, -0.14]);
              for (let jj = 0; jj < 9; jj++) {
                const back = jj * 0.42;
                pts.push([q[0] - Math.sin(e.yaw) * back + Math.sin(t * 6 - jj + kk) * 0.05 * jj, q[1] - jj * 0.1 + Math.cos(t * 5 - jj) * 0.06 * jj, q[2] - Math.cos(e.yaw) * back + Math.cos(t * 6 - jj + kk) * 0.05 * jj]);
              }
              Renderer.ribbon(pts, 0.3, 0.6, 0.16, 0.13, 0.95, false, true);
            }
          }
          if (e.type === 'thunder' && (e.state === 1 || Math.sin(t * 5 + e.id) > 0.7)) {
            const kk = e.state === 1 ? 1 - e.timer / 1.2 : 0.3;
            const q = this._q || (this._q = V3.create());
            for (const hnd of [J.handL, J.handR]) {
              M4.transformPoint(q, hnd, [0, -0.06, 0]);
              Renderer.particle(q[0], q[1], q[2], 0.15 + kk * 0.35, 1, 0.2, 0.4, 0.9, true);
            }
            Renderer.light(q[0], q[1], q[2], 1.5 * kk + 0.3, 0.1, 0.3, 6);
            if (e.state === 1 && kk > 0.3) this.drawAimLine(e, kk);
          }
          break;
        }
        case 'leech': {
          M4.fromTRS(m, e.pos[0], e.pos[1] + Math.sin(e.anim * 3) * 0.15, e.pos[2], e.yaw + Math.sin(e.anim) * 0.3, 0, e.anim * 0.5, s, s, s);
          Renderer.draw(Models.voidspren(), m, opts);
          Renderer.light(e.pos[0], e.pos[1], e.pos[2], 0.6, 0.2, 1, 5);
          break;
        }
        case 'brute': {
          const parts = Models.brute();
          const crouch = e.state === 1 ? 0.3 : 0;
          M4.fromTRS(m, e.pos[0], e.pos[1] - crouch, e.pos[2], e.yaw, 0, 0, s, s, s);
          Renderer.draw(parts.body, m, opts);
          const L = this._L || (this._L = M4.create()), O = this._O || (this._O = M4.create());
          for (const side of [-1, 1]) {
            M4.fromTRS(L, side * 0.95, 1.9, 0, 0, -(side < 0 ? run : -run) * 0.5 - (e.state === 1 ? 2.2 : 0), side * 0.15, 1, 1, 1);
            Renderer.draw(parts.arm, M4.multiply(O, m, L), opts);
            M4.fromTRS(L, side * 0.4, 0.75, 0, 0, (side < 0 ? run : -run) * 0.5, 0, 1, 1, 1);
            Renderer.draw(parts.leg, M4.multiply(O, m, L), opts);
          }
          break;
        }
      }
    }
    // Voidsprens sugtrådar.
    const pc = game.player.center(this._pc);
    for (const e of this.tethers) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const tt = k / 10;
        pts.push([lerp(e.pos[0], pc[0], tt) + Math.sin(t * 20 + k) * 0.15, lerp(e.pos[1], pc[1], tt) + Math.sin(tt * Math.PI) * 0.6, lerp(e.pos[2], pc[2], tt) + Math.cos(t * 17 + k) * 0.15]);
      }
      Renderer.ribbon(pts, 0.12, 0.7, 0.3, 1, 0.8, true);
    }
  },

  // Siktlinje som blir tydligare innan stormformens blixt.
  drawAimLine(e, k) {
    const sx = e.pos[0] + Math.sin(e.yaw) * 0.5, sy = e.pos[1] + 1.5, sz = e.pos[2] + Math.cos(e.yaw) * 0.5;
    Renderer.ribbon([[sx, sy, sz], [e.aim[0], e.aim[1], e.aim[2]]], 0.06, 1, 0.2, 0.35, 0.25 + k * 0.4, true);
  },
};
