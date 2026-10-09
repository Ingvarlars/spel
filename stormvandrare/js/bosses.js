'use strict';
// Bossar: chasmfiend, Thunderclast, Himmelsk mästare (Fused) och Everstormens härold.
// Varje boss är en post i fiendelistan (boss = true) med träffzoner, faser och
// egna attacker. Bosses sköter deras beteende och utseende.

const CF_SCALE = 1.8; // chasmfiender är enorma

const BOSS_DEFS = {
  chasmfiend: { name: 'Chasmfiend', title: 'Klyftornas härskare', hp: 2600, dmg: 26 },
  thunderclast: { name: 'Thunderclast', title: 'Det vandrande berget', hp: 3400, dmg: 30 },
  heavenly: { name: 'Vev-Tarun', title: 'Himmelsk mästare bland Fused', hp: 2300, dmg: 22 },
  herald: { name: 'Everstormens härold', title: 'Den röda stormens röst', hp: 5200, dmg: 28 },
};

const Bosses = {
  boss: null,
  markers: [],   // varningsmarkeringar på marken { x, y, z, r, life, max, color }
  rocks: [],     // kastade block { pos, vel, r, dmg, target }
  _t: V3.create(),
  _t2: V3.create(),
  _m: M4.create(),
  _L: M4.create(),
  _O: M4.create(),

  reset() {
    this.boss = null;
    this.markers.length = 0;
    this.rocks.length = 0;
    this.curse = 0;
  },

  // Skapar bossen vid arenan.
  spawn(type, game) {
    const def = BOSS_DEFS[type];
    const ar = World.arena;
    const e = Enemies.pool.spawn();
    Object.assign(e, createEnemy());
    e.id = ++Enemies.serial;
    e.type = 'boss'; e.bossType = type; e.boss = true;
    e.def = { name: def.name, weight: 30, glow: 40, flying: type === 'heavenly' || type === 'herald' };
    const m = game.mods;
    e.maxHp = e.hp = def.hp * (0.8 + 0.2 * m.hp);
    e.dmg = def.dmg * m.dmg;
    e.r = 3; e.h = 6;
    e.phase = 0;
    e.state = 'intro';
    e.timer = 3;
    e.cd = 2;
    e.alert = true;
    e.seen = true;
    e.anim = 0;
    if (type === 'chasmfiend') {
      this.pickEdge(e, game, true);
      e.rise = 0;
      e.r = 4; e.h = 6;
    } else if (type === 'thunderclast') {
      V3.set(e.pos, ar.cx + 20, ar.y1, ar.cz);
      e.yaw = -Math.PI / 2;
      e.r = 2.5; e.h = 9;
    } else if (type === 'heavenly') {
      V3.set(e.pos, ar.cx, ar.y1 + 14, ar.cz);
      e.r = 0.8; e.h = 2.4;
    } else {
      V3.set(e.pos, ar.cx + 10, ar.y1 + 16, ar.cz);
      e.r = 3; e.h = 14;
    }
    this.boss = e;
    game.onBossSpawn(e, def);
    return e;
  },

  // Chasmfienden klamrar sig fast vid arenans kant, med huvudet mot spelaren.
  pickEdge(e, game, initial) {
    const ar = World.arena;
    const p = game.player;
    const poly = ar.poly, n = poly.length / 2;
    let best = 0, bestScore = -1e9;
    for (let i = 0; i < n; i++) {
      const x = poly[i * 2], z = poly[i * 2 + 1];
      const d = Math.hypot(x - p.pos[0], z - p.pos[2]);
      const score = initial ? -Math.abs(d - 30) : -Math.abs(d - 22) + Math.random() * 8;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const ex = poly[best * 2], ez = poly[best * 2 + 1];
    const dx = ar.cx - ex, dz = ar.cz - ez, d = Math.hypot(dx, dz) || 1;
    e.edge = [ex + dx / d * 1.5, ar.y1, ez + dz / d * 1.5];
    e.yaw = Math.atan2(dx, dz);
    V3.set(e.pos, e.edge[0], e.edge[1], e.edge[2]);
  },

  // Bossens träffzoner i världen: [x, y, z, r, multiplikator].
  zones(e) {
    const out = this._zones || (this._zones = []);
    out.length = 0;
    const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
    const S = e.bossType === 'chasmfiend' ? CF_SCALE : 1;
    const add = (fx, y, fz, r, mult) => out.push([e.pos[0] + (s * fz + c * fx) * S, e.pos[1] + y * S, e.pos[2] + (c * fz - s * fx) * S, r * S, mult]);
    switch (e.bossType) {
      case 'chasmfiend': {
        const rise = e.rise || 0;
        const lift = (1 - rise) * -12;
        add(0, 2.2 + lift + (e.state === 'bite' ? 0.5 : 0), 2.2 + (e.lunge || 0), 2.2, e.state === 'roar' ? 2.2 : 1);
        add(0, 1.2 + lift, -2.5, 3.2, 0.7);
        add(4.2, 2 + lift + (e.clawL || 0) * 3, 3 + (e.clawL || 0) * 3, 1.6, 0.5);
        add(-4.2, 2 + lift + (e.clawR || 0) * 3, 3 + (e.clawR || 0) * 3, 1.6, 0.5);
        break;
      }
      case 'thunderclast':
        add(0, 5.4, 1.15, 1.1, 2);
        add(0, 6.0, -1.3, 1.0, 2);
        add(0, 4.6, 0, 2.6, 0.3);
        add(0, 8.4, 0.3, 1.3, 1);
        add(1.2, 1.6, 0, 1.2, 0.3); add(-1.2, 1.6, 0, 1.2, 0.3);
        break;
      case 'heavenly':
        add(0, 1.2, 0, 1.3, 1);
        break;
      case 'herald':
        add(0, 7, 0, e.exposed > 0 ? 2.4 : 1.6, e.exposed > 0 ? 3 : 0.25);
        break;
    }
    return out;
  },

  update(dt, game) {
    const e = this.boss;
    for (let i = this.markers.length - 1; i >= 0; i--) { this.markers[i].life -= dt; if (this.markers[i].life <= 0) this.markers.splice(i, 1); }
    this.updateRocks(dt, game);
    if (this.curse > 0) {
      this.curse -= dt;
      if (this.curse <= 0) { game.player.resetGravity(); }
    }
    if (!e || e.dead) return;
    e.anim += dt;
    if (e.flash > 0) e.flash -= dt;
    const p = game.player;
    const def = BOSS_DEFS[e.bossType];
    // Faser vid 66 % och 33 % liv.
    const ph = e.hp < e.maxHp * 0.33 ? 2 : e.hp < e.maxHp * 0.66 ? 1 : 0;
    if (ph > e.phase) { e.phase = ph; this.onPhase(e, game); }
    switch (e.bossType) {
      case 'chasmfiend': this.chasmfiend(e, dt, game, p, def); break;
      case 'thunderclast': this.thunderclast(e, dt, game, p, def); break;
      case 'heavenly': this.heavenly(e, dt, game, p, def); break;
      case 'herald': this.herald(e, dt, game, p, def); break;
    }
  },

  onPhase(e, game) {
    game.onBossPhase(e);
    if (e.bossType === 'chasmfiend') { e.state = 'submerge'; e.timer = 1.6; }
    if (e.bossType === 'heavenly') {
      for (let k = 0; k < 2; k++) {
        const a = Enemies.spawn('hover', e.pos[0] + rand(-6, 6), e.pos[1], e.pos[2] + rand(-6, 6), game.mods, false, World.arena);
        a.alert = true;
      }
    }
    if (e.bossType === 'herald' && e.phase === 1) game.startEverstorm();
  },

  marker(x, y, z, r, life, color) { this.markers.push({ x, y, z, r, life, max: life, color: color || [1, 0.3, 0.2] }); },

  // Spelaren i en zon (horisontellt avstånd, låg höjd)?
  playerInRadius(p, x, y, z, r, h) {
    return Math.hypot(p.pos[0] - x, p.pos[2] - z) < r && Math.abs(p.pos[1] - y) < (h || 3);
  },

  // --- Chasmfiend ---
  chasmfiend(e, dt, game, p, def) {
    e.timer -= dt;
    const toP = Math.atan2(p.pos[0] - e.pos[0], p.pos[2] - e.pos[2]);
    const headYaw = clamp(angleDiff(toP, e.yaw), -0.9, 0.9);
    e.headYaw = lerp(e.headYaw || 0, headYaw, 1 - Math.exp(-3 * dt));
    e.clawL = Math.max(0, (e.clawL || 0) - dt * 2);
    e.clawR = Math.max(0, (e.clawR || 0) - dt * 2);
    e.lunge = Math.max(0, (e.lunge || 0) - dt * 6);
    const fast = 1 + e.phase * 0.25;
    switch (e.state) {
      case 'intro':
      case 'emerge':
        e.rise = Math.min(1, (e.rise || 0) + dt * 0.45);
        if (Math.random() < 0.3) Effects.dust(e.edge[0] + rand(-4, 4), e.edge[1], e.edge[2] + rand(-4, 4), 2, 2);
        if (e.rise >= 1 && e.timer <= 0) { e.state = 'idle'; e.timer = 1.2; }
        break;
      case 'idle': {
        if (e.timer > 0) break;
        const d = Math.hypot(p.pos[0] - e.pos[0], p.pos[2] - e.pos[2]);
        const r = Math.random();
        if (d < 20 && r < 0.45) { e.state = 'swipe'; e.side = Math.random() < 0.5 ? 1 : -1; e.timer = 0.9 / fast; game.onBossWindup(e); }
        else if (d < 22 && r < 0.75) { e.state = 'bite'; e.timer = 0.7 / fast; game.onBossWindup(e); }
        else { e.state = 'roar'; e.timer = 1.6; game.onBossRoar(e); }
        break;
      }
      case 'swipe':
        // Klon höjs (förvarning) och sveper över platån.
        if (e.side > 0) e.clawL = Math.min(1, (e.clawL || 0) + dt * 4); else e.clawR = Math.min(1, (e.clawR || 0) + dt * 4);
        if (!e.marked) { e.marked = true; const z = this.zones(e)[e.side > 0 ? 2 : 3]; this.marker(lerp(e.pos[0], p.pos[0], 0.7), World.arena.y1, lerp(e.pos[2], p.pos[2], 0.7), 6, 0.9 / fast); void z; }
        if (e.timer <= 0) {
          e.marked = false;
          const sweepX = e.pos[0] + Math.sin(e.yaw + e.headYaw) * 12, sweepZ = e.pos[2] + Math.cos(e.yaw + e.headYaw) * 12;
          if (this.playerInRadius(p, sweepX, World.arena.y1, sweepZ, 10, 3.5)) p.takeDamage(def.dmg, game, e.pos);
          Effects.dust(sweepX, World.arena.y1, sweepZ, 30, 6);
          Effects.shake(0.45);
          e.state = 'idle'; e.timer = rand(0.8, 1.6) / fast;
          if (e.side > 0) e.clawL = 0; else e.clawR = 0;
        }
        break;
      case 'bite':
        if (e.timer <= 0) {
          e.lunge = 6;
          const hx = e.pos[0] + Math.sin(e.yaw + e.headYaw) * 11, hz = e.pos[2] + Math.cos(e.yaw + e.headYaw) * 11;
          if (this.playerInRadius(p, hx, World.arena.y1, hz, 4.5, 4)) p.takeDamage(def.dmg * 1.3, game, e.pos);
          Effects.shake(0.3);
          game.onBossBite(e);
          e.state = 'idle'; e.timer = rand(1, 1.8) / fast;
        }
        break;
      case 'roar':
        // Under vrålet är huvudet sårbart (dubbel skada).
        if (e.timer < 1.2 && !e.roared) {
          e.roared = true;
          Projectiles.ring(e.pos[0], World.arena.y1, e.pos[2], 12, 18, 14);
          for (let k = 0; k < 2 + e.phase * 2; k++) {
            const a = rand(0, TAU);
            const c = Enemies.spawn('crab', World.arena.cx + Math.cos(a) * 15, World.arena.y1 + 0.2, World.arena.cz + Math.sin(a) * 15, game.mods, false, World.arena);
            c.alert = true;
          }
          Effects.shake(0.6);
        }
        if (e.timer <= 0) { e.roared = false; e.state = 'idle'; e.timer = rand(1, 2); }
        break;
      case 'submerge':
        e.rise = Math.max(0, e.rise - dt * 0.8);
        if (e.rise <= 0) {
          this.pickEdge(e, game, false);
          e.state = 'emerge';
          e.timer = 1;
          game.onBossEmerge(e);
        }
        break;
    }
    e.invulnerable = e.state === 'submerge' || e.rise < 0.6;
  },

  // --- Thunderclast ---
  thunderclast(e, dt, game, p, def) {
    e.timer -= dt;
    const fast = 1 + e.phase * 0.3;
    const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2], d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    if (e.state !== 'slam') e.yaw += clamp(angleDiff(want, e.yaw), -1.2 * dt, 1.2 * dt);
    e.armRaise = Math.max(0, (e.armRaise || 0) - dt * 1.5);
    switch (e.state) {
      case 'intro':
        if (e.timer <= 0) { e.state = 'walk'; e.timer = 2; }
        break;
      case 'walk': {
        // Går långsamt mot spelaren och håller sig på arenan.
        if (d > 7) {
          const nx = e.pos[0] + Math.sin(e.yaw) * 2.2 * dt * fast, nz = e.pos[2] + Math.cos(e.yaw) * 2.2 * dt * fast;
          if (pointInPoly(World.arena.poly, nx, nz)) { e.pos[0] = nx; e.pos[2] = nz; e.step = (e.step || 0) + dt * 2.2 * fast; }
          if (Math.floor(e.step * 0.7) !== e.lastStep) { e.lastStep = Math.floor(e.step * 0.7); Effects.shake(0.12); Effects.dust(e.pos[0], e.pos[1], e.pos[2], 8, 2); }
        }
        if (e.timer <= 0) {
          if (d < 12) { e.state = 'slam'; e.timer = 1.1 / fast; e.target = [p.pos[0], World.arena.y1, p.pos[2]]; this.marker(p.pos[0], World.arena.y1, p.pos[2], 4.5, 1.1 / fast); game.onBossWindup(e); }
          else { e.state = 'throw'; e.timer = 1.2 / fast; game.onBossWindup(e); }
        }
        break;
      }
      case 'slam':
        e.armRaise = Math.min(1, (e.armRaise || 0) + dt * 3);
        if (e.timer <= 0) {
          const t = e.target;
          if (this.playerInRadius(p, t[0], t[1], t[2], 4.5, 3)) p.takeDamage(def.dmg, game, t);
          Projectiles.ring(t[0], t[1], t[2], def.dmg * 0.6, 14 + e.phase * 4, 11);
          Effects.dust(t[0], t[1], t[2], 40, 5);
          Effects.shake(0.8);
          game.onBossSlam(e);
          e.state = 'walk'; e.timer = rand(1.5, 2.5) / fast; e.armRaise = 0;
        }
        break;
      case 'throw':
        e.armRaise = Math.min(1, (e.armRaise || 0) + dt * 2);
        if (e.timer <= 0) {
          const n = 1 + e.phase;
          for (let k = 0; k < n; k++) {
            const tx = p.pos[0] + p.vel[0] * 1.2 + rand(-3, 3) * k, tz = p.pos[2] + p.vel[2] * 1.2 + rand(-3, 3) * k;
            const ty = World.groundBelow(tx, p.pos[1] + 2, tz);
            const sx = e.pos[0] + Math.sin(e.yaw) * 1.5, sy = e.pos[1] + 9, sz = e.pos[2] + Math.cos(e.yaw) * 1.5;
            const v = Enemies.ballistic(sx, sy, sz, tx, ty, tz, 26, G_BASE);
            this.rocks.push({ pos: V3.create(sx, sy, sz), vel: V3.create(v[0], v[1], v[2]), r: 1.2, dmg: def.dmg * 1.2, spin: rand(0, TAU) });
            this.marker(tx, ty, tz, 4, 2.2);
          }
          game.onBossThrow(e);
          e.state = 'walk'; e.timer = rand(2, 3) / fast;
        }
        break;
    }
  },

  updateRocks(dt, game) {
    const p = game.player;
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.vel[1] -= G_BASE * dt;
      V3.addScaled(r.pos, r.pos, r.vel, dt);
      r.spin += dt * 3;
      if (World.insideAny(r.pos[0], r.pos[1] - r.r * 0.5, r.pos[2]) || r.pos[1] < CHASM_FLOOR) {
        if (this.playerInRadius(p, r.pos[0], r.pos[1], r.pos[2], 4.2, 4)) p.takeDamage(r.dmg, game, r.pos);
        Effects.debris(r.pos[0], r.pos[1], r.pos[2], [0.5, 0.42, 0.36], 30, 9);
        Effects.dust(r.pos[0], r.pos[1], r.pos[2], 20, 3);
        Effects.shake(0.5);
        this.rocks.splice(i, 1);
      }
    }
  },

  // --- Himmelsk mästare (Fused) ---
  heavenly(e, dt, game, p, def) {
    e.timer -= dt;
    const pc = p.center(this._t);
    const fast = 1 + e.phase * 0.25;
    e.yaw += clamp(angleDiff(Math.atan2(pc[0] - e.pos[0], pc[2] - e.pos[2]), e.yaw), -6 * dt, 6 * dt);
    const v = e.vel;
    const flyTo = (x, y, z, speed) => {
      const dx = x - e.pos[0], dy = y - e.pos[1], dz = z - e.pos[2], d = Math.hypot(dx, dy, dz) || 1;
      const s = Math.min(speed, d * 2), k = 1 - Math.exp(-3 * dt);
      v[0] += (dx / d * s - v[0]) * k; v[1] += (dy / d * s - v[1]) * k; v[2] += (dz / d * s - v[2]) * k;
    };
    switch (e.state) {
      case 'intro':
        flyTo(pc[0], pc[1] + 10, pc[2], 6);
        if (e.timer <= 0) { e.state = 'circle'; e.timer = 2; }
        break;
      case 'circle': {
        const a = e.anim * 0.7;
        flyTo(pc[0] + Math.cos(a) * 11, pc[1] + 7 + Math.sin(e.anim * 1.7) * 2, pc[2] + Math.sin(a) * 11, 16 * fast);
        if (e.timer <= 0) {
          const r = Math.random();
          if (r < 0.4) { e.state = 'aim'; e.timer = 0.55 / fast; e.dives = 2 + e.phase; game.onBossWindup(e); }
          else if (r < 0.75) { e.state = 'volley'; e.timer = 0.8; game.onBossWindup(e); }
          else { e.state = 'curse'; e.timer = 1.2; game.onBossCurse(e); }
        }
        break;
      }
      case 'aim':
        V3.scale(v, v, Math.exp(-6 * dt));
        V3.set(e.aim, pc[0] - e.pos[0], pc[1] - e.pos[1], pc[2] - e.pos[2]);
        V3.normalize(e.aim, e.aim);
        if (e.timer <= 0) { e.state = 'dive'; e.timer = 0.6; }
        break;
      case 'dive':
        V3.scale(v, e.aim, 34 * fast);
        if (V3.dist(e.pos, pc) < 2) p.takeDamage(def.dmg, game, e.pos);
        if (e.timer <= 0) {
          e.dives--;
          if (e.dives > 0) { e.state = 'aim'; e.timer = 0.35; }
          else { e.state = 'circle'; e.timer = rand(2, 3); }
        }
        break;
      case 'volley':
        V3.scale(v, v, Math.exp(-4 * dt));
        if (e.timer <= 0) {
          for (let k = -1; k <= 1; k++) {
            const tx = pc[0] + p.vel[0] * 0.5 + k * 2.5, ty = pc[1], tz = pc[2] + p.vel[2] * 0.5 + k * 2.5;
            const dx = tx - e.pos[0], dy = ty - e.pos[1], dz = tz - e.pos[2], d = Math.hypot(dx, dy, dz) || 1;
            Projectiles.spawn('arrow', e.pos[0], e.pos[1] + 1.2, e.pos[2], dx / d * 38, dy / d * 38, dz / d * 38, def.dmg * 0.7, { parryable: true, r: 0.25, life: 4 });
          }
          game.onEnemyShoot(e);
          e.state = 'circle'; e.timer = rand(1.5, 2.5);
        }
        break;
      case 'curse':
        // Lashar spelarens gravitation åt ett slumpat håll.
        V3.scale(v, v, Math.exp(-4 * dt));
        if (e.timer <= 0) {
          const dir = [rand(-1, 1), rand(0.2, 1), rand(-1, 1)];
          V3.normalize(dir, dir);
          V3.copy(p.g, dir);
          p.strength = 1; p.lashed = true;
          this.curse = 2.2;
          game.onCursed(p);
          e.state = 'circle'; e.timer = rand(2, 3);
        }
        break;
    }
    V3.addScaled(e.pos, e.pos, v, dt);
    const n = this._t2;
    const c = V3.set(Enemies._t, e.pos[0], e.pos[1] + 1, e.pos[2]);
    if (World.collideSphere(c, 0.9, n)) V3.set(e.pos, c[0], c[1] - 1, c[2]);
  },

  // --- Everstormens härold ---
  herald(e, dt, game, p, def) {
    e.timer -= dt;
    if (e.exposed > 0) e.exposed -= dt;
    const ar = World.arena;
    const fast = 1 + e.phase * 0.3;
    e.pos[0] = ar.cx + Math.cos(e.anim * 0.15) * 12;
    e.pos[2] = ar.cz + Math.sin(e.anim * 0.15) * 12;
    e.pos[1] = ar.y1 + 14 + Math.sin(e.anim * 0.6) * 1.5;
    e.yaw += clamp(angleDiff(Math.atan2(p.pos[0] - e.pos[0], p.pos[2] - e.pos[2]), e.yaw), -dt, dt);
    switch (e.state) {
      case 'intro':
        if (e.timer <= 0) { e.state = 'idle'; e.timer = 1.5; }
        break;
      case 'idle':
        if (e.timer <= 0) {
          const r = Math.random();
          if (r < 0.5) { e.state = 'bolts'; e.timer = 1.1 / fast; e.count = 3 + e.phase * 2; }
          else if (r < 0.8 || e.phase < 2) { e.state = 'orbs'; e.timer = 1.2; }
          else { e.state = 'invert'; e.timer = 1.5; game.onBossCurse(e); }
          game.onBossWindup(e);
        }
        break;
      case 'bolts':
        // Röda blixtar slår ned där spelaren står (markeras först).
        if (!e.marked) {
          e.marked = true;
          e.boltTargets = [];
          for (let k = 0; k < e.count; k++) {
            const tx = p.pos[0] + (k ? rand(-7, 7) : 0), tz = p.pos[2] + (k ? rand(-7, 7) : 0);
            const ty = World.groundBelow(tx, p.pos[1] + 3, tz);
            e.boltTargets.push([tx, ty, tz]);
            this.marker(tx, ty, tz, 2.6, 1.1 / fast, [1, 0.15, 0.25]);
          }
        }
        if (e.timer <= 0) {
          for (const t of e.boltTargets) {
            Projectiles.beam([t[0] + rand(-2, 2), t[1] + 60, t[2] + rand(-2, 2)], t);
            if (this.playerInRadius(p, t[0], t[1], t[2], 2.6, 4)) p.takeDamage(def.dmg, game, t);
            Effects.sparks(t[0], t[1] + 0.3, t[2], 0, 1, 0, 1, [1, 0.3, 0.4], 18, 8);
          }
          Effects.shake(0.5);
          game.onLightning();
          e.marked = false;
          e.state = 'idle'; e.timer = rand(1.4, 2.2) / fast;
          e.exposed = 2.5; // kärnan blottas efter attacken
        }
        break;
      case 'orbs':
        if (e.timer <= 0) {
          for (let k = 0; k < 2 + e.phase; k++) {
            const a = Enemies.spawn('leech', e.pos[0] + rand(-4, 4), e.pos[1] - 3, e.pos[2] + rand(-4, 4), game.mods, false, ar);
            a.alert = true;
          }
          e.state = 'idle'; e.timer = rand(2, 3);
          e.exposed = 2;
        }
        break;
      case 'invert':
        if (e.timer <= 0) {
          // Vänder gravitationen på arenan en stund.
          V3.set(p.g, 0, 1, 0);
          p.strength = 1; p.lashed = true;
          this.curse = 2.5;
          game.onCursed(p);
          for (const en of Enemies.list) if (!en.boss && !en.def.flying) en.float = 2;
          e.state = 'idle'; e.timer = 3;
          e.exposed = 3;
        }
        break;
    }
  },

  // --- Utseende ---
  draw(game) {
    const t = game.realTime;
    for (const mk of this.markers) {
      const k = 1 - mk.life / mk.max;
      const n = 28;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        pts.push([mk.x + Math.cos(a) * mk.r, mk.y + 0.15, mk.z + Math.sin(a) * mk.r]);
      }
      Renderer.ribbon(pts, 0.25, mk.color[0], mk.color[1], mk.color[2], 0.4 + k * 0.5, true);
      const inner = pts.map((q) => [mk.x + (q[0] - mk.x) * k, q[1], mk.z + (q[2] - mk.z) * k]);
      Renderer.ribbon(inner, 0.15, mk.color[0], mk.color[1], mk.color[2], 0.6, true);
    }
    for (const r of this.rocks) {
      M4.fromTRS(this._m, r.pos[0], r.pos[1], r.pos[2], r.spin, r.spin * 0.6, 0, r.r, r.r, r.r);
      Renderer.draw(Models.rock(), this._m);
    }
    if (this.curse > 0) {
      const c = game.player.center(this._t);
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU + t * 4 * (k ? -1 : 1); pts.push([c[0] + Math.cos(a) * 0.9, c[1] + (k - 0.5) * 0.8, c[2] + Math.sin(a) * 0.9]); }
        Renderer.ribbon(pts, 0.08, 0.9, 0.3, 1, 0.8, true);
      }
    }
    const e = this.boss;
    if (!e || e.dead) return;
    const opts = e.flash > 0 ? { tint: [1, 1, 1, 0.6] } : null;
    switch (e.bossType) {
      case 'chasmfiend': this.drawChasmfiend(e, t, opts); break;
      case 'thunderclast': this.drawThunderclast(e, t, opts); break;
      case 'heavenly': this.drawHeavenly(e, t, opts, game); break;
      case 'herald': this.drawHerald(e, t, opts); break;
    }
  },

  drawChasmfiend(e, t, opts) {
    const M = BossModels.chasmfiend();
    const m = this._m, L = this._L, O = this._O;
    const lift = (1 - (e.rise || 0)) * -12;
    // Kroppen lutar ned i klyftan bakom kanten.
    M4.fromTRS(m, e.pos[0], e.pos[1] + lift * CF_SCALE, e.pos[2], e.yaw, -0.35, 0, CF_SCALE, CF_SCALE, CF_SCALE);
    Renderer.draw(M.body, m, opts);
    // Huvud som följer spelaren.
    M4.fromTRS(L, 0, 2.2 + (e.state === 'roar' ? 0.6 : 0), 2.4 + (e.lunge || 0) * 0.7, e.headYaw || 0, e.state === 'roar' ? -0.5 : 0.1, 0, 1, 1, 1);
    Renderer.draw(M.head, M4.multiply(O, m, L), e.state === 'roar' ? { emissive: 0.5, tint: opts ? opts.tint : undefined } : opts);
    // Ben som greppar kanten.
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1, row = Math.floor(k / 2);
      M4.fromTRS(L, side * (2.6 + row * 0.3), 1.2 - row * 0.8, 1.6 - row * 2.2, side * (0.6 + row * 0.2), 0.4 + Math.sin(t * 2 + k) * 0.05, side * 0.9, 1, 1, 1);
      Renderer.draw(M.leg, M4.multiply(O, m, L), opts);
    }
    // Klor.
    for (const side of [1, -1]) {
      const raise = side > 0 ? e.clawL || 0 : e.clawR || 0;
      M4.fromTRS(L, side * 3.8, 2.4, 2.4, side * (0.4 - raise * 0.6), -0.3 - raise * 1.3, 0, 1, 1, 1);
      Renderer.draw(M.claw, M4.multiply(O, m, L), opts);
    }
  },

  drawThunderclast(e, t, opts) {
    const M = BossModels.thunderclast();
    const m = this._m, L = this._L, O = this._O;
    const sway = Math.sin((e.step || 0) * 1.4) * 0.05;
    M4.fromTRS(m, e.pos[0], e.pos[1], e.pos[2], e.yaw, 0, sway, 1, 1, 1);
    Renderer.draw(M.body, m, opts);
    for (const side of [1, -1]) {
      const raise = side > 0 ? (e.armRaise || 0) : (e.state === 'slam' ? e.armRaise || 0 : 0);
      M4.fromTRS(L, side * 2.4, 7.2, 0, 0, -raise * 2.6 + Math.sin((e.step || 0) * 1.4 + side) * 0.2, side * 0.2, 1, 1, 1);
      Renderer.draw(M.arm, M4.multiply(O, m, L), opts);
      M4.fromTRS(L, side * 1.2, 3, 0, 0, Math.sin((e.step || 0) * 1.4 + (side > 0 ? 0 : Math.PI)) * 0.3, 0, 1, 1, 1);
      Renderer.draw(M.leg, M4.multiply(O, m, L), opts);
    }
    const z = this.zones(e);
    Renderer.light(z[0][0], z[0][1], z[0][2], 1.6, 0.5, 0.2, 9);
  },

  drawHeavenly(e, t, opts, game) {
    const body = Body.build('boss-heavenly', BOSS_PAL.heavenly, { plates: true, helmet: true, robe: true, bulk: 1.15 });
    const P = e.pose || (e.pose = makePose());
    P.hipLP = 0.2; P.hipRP = -0.1; P.knL = 0.4; P.knR = 0.6; P.anL = -0.6; P.anR = -0.5;
    P.shLR = 0.7; P.elL = 0.3; P.shRP = e.state === 'aim' || e.state === 'dive' ? 1.7 : e.state === 'volley' ? 2.6 : 0.6; P.elR = 0.2;
    P.spineP = e.state === 'dive' ? 1.1 : 0.15;
    const m = this._m;
    M4.fromTRS(m, e.pos[0], e.pos[1], e.pos[2], e.yaw, 0, 0, 1.3, 1.3, 1.3);
    const J = Skeleton.draw(body, m, P, opts);
    M4.fromTRS(this._L, 0, -0.07, 0, 0, 0, 0, 1.3, 1.3, 1.3);
    Renderer.draw(Models.spear(), M4.multiply(this._O, J.handR, this._L), opts);
    const q = this._t;
    for (let k = 0; k < 4; k++) {
      const pts = [];
      M4.transformPoint(q, J.chest, [(k - 1.5) * 0.15, 0.45, -0.15]);
      for (let j = 0; j < 12; j++) {
        const back = j * 0.5;
        pts.push([q[0] - Math.sin(e.yaw) * back + Math.sin(t * 5 - j + k) * 0.06 * j, q[1] - j * 0.08 + Math.cos(t * 4 - j + k) * 0.08 * j, q[2] - Math.cos(e.yaw) * back + Math.cos(t * 5 - j) * 0.06 * j]);
      }
      Renderer.ribbon(pts, 0.35, k % 2 ? 0.75 : 0.85, 0.62, 0.2, 0.95, false, true);
    }
    Renderer.light(e.pos[0], e.pos[1] + 1.5, e.pos[2], 0.8, 0.4, 0.2, 7);
    void game;
  },

  drawHerald(e, t, opts) {
    const m = this._m;
    // En jättelik gestalt av röda blixtar och mörka moln kring en glödande kärna.
    const exposed = e.exposed > 0;
    M4.fromTRS(m, e.pos[0], e.pos[1] + 7, e.pos[2], t * 0.6, 0, 0, exposed ? 2.2 : 1.4, exposed ? 2.2 : 1.4, exposed ? 2.2 : 1.4);
    Renderer.draw(BossModels.heraldCore(), m, { emissive: exposed ? 1.2 : 0.4, tint: opts ? opts.tint : undefined });
    Renderer.light(e.pos[0], e.pos[1] + 7, e.pos[2], 2.2, 0.2, 0.3, 26);
    const rng = makeRng(Math.floor(t * 12));
    const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
    const P = (x, y, z) => [e.pos[0] + c * x + s * z, e.pos[1] + y, e.pos[2] - s * x + c * z];
    const jag = (a, b) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const tt = k / 6;
        pts.push([lerp(a[0], b[0], tt) + (rng() - 0.5) * 0.8, lerp(a[1], b[1], tt) + (rng() - 0.5) * 0.8, lerp(a[2], b[2], tt) + (rng() - 0.5) * 0.8]);
      }
      return pts;
    };
    const bones = [
      [[0, 0, 0], [0, 7, 0]], [[0, 7, 0], [0, 12, 0]], [[0, 12, 0], [0, 14.5, 0.5]],
      [[0, 11.5, 0], [-5, 10, 2]], [[-5, 10, 2], [-8, 6 + Math.sin(t) * 2, 4]],
      [[0, 11.5, 0], [5, 10, 2]], [[5, 10, 2], [8, 6 + Math.cos(t) * 2, 4]],
      [[0, 1, 0], [-2.5, -6, 1]], [[0, 1, 0], [2.5, -6, 1]],
    ];
    for (const b of bones) {
      const pts = jag(P(...b[0]), P(...b[1]));
      Renderer.ribbon(pts, 1.4, 0.6, 0.05, 0.12, 0.55, true);
      Renderer.ribbon(pts, 0.3, 1, 0.5, 0.55, 0.9, true);
    }
    for (let k = 0; k < 10; k++) {
      const q = P(rand(-6, 6), rand(-4, 14), rand(-3, 3));
      Renderer.particle(q[0], q[1], q[2], rand(1.5, 3.5), 0.15, 0.08, 0.1, 0.5, false);
    }
    // Ögon.
    for (const sx of [-0.5, 0.5]) { const q = P(sx, 13.6, 1); Renderer.particle(q[0], q[1], q[2], 0.5, 1, 0.2, 0.25, 1, true); }
  },
};

const BOSS_PAL = {
  heavenly: { skin: col('#3c2c30'), pants: col('#5a2424'), boots: col('#2a1d18'), belt: col('#d4af4a'), body: col('#8a2e2a'), sleeve: col('#8a2e2a'), plate: col('#c9a046'), helmet: col('#b58a3a'), robe: col('#8a2e2a'), mask: col('#e8d9b8'), eye: col('#ff7a3a', 3), cuff: col('#d4af4a') },
};

const BossModels = {
  cache: {},
  chasmfiend() {
    if (this.cache.cf) return this.cache.cf;
    const shell = col('#4b3b45'), shellD = col('#33282f'), moss = col('#5b6b3a'), under = col('#7a6058'), eye = col('#ff9a3a', 2.5);
    const M = {};
    let mb = new MeshBuilder();
    // Segmenterad kropp som sträcker sig bakåt och nedåt.
    for (let k = 0; k < 6; k++) {
      const z = 1 - k * 2.6, y = 0.8 - k * 1.4, r = 2.6 - k * 0.2;
      mb.ellipsoid(0, y, z, r * 1.15, r * 0.8, 1.7, 12, 7, k % 2 ? shell : shellD);
      mb.ellipsoid(0, y + r * 0.7, z, r * 0.5, 0.3, 1.2, 8, 4, moss);
      for (const s of [-1, 1]) mb.ellipsoid(s * r * 0.9, y + 0.4, z, 0.5, 0.7, 0.9, 6, 4, shellD);
    }
    M.body = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, 0, 0, 1.9, 1.3, 2.0, 12, 8, shell);
    mb.ellipsoid(0, -0.5, 1.2, 1.4, 0.7, 1.2, 10, 6, under);
    for (const s of [-1, 1]) {
      mb.ellipsoid(s * 1.1, 0.5, 1.4, 0.28, 0.22, 0.2, 8, 5, eye);
      mb.ellipsoid(s * 0.8, 0.1, 1.75, 0.18, 0.15, 0.15, 6, 4, eye);
      // Käkar.
      mb.transform(M4.fromTRS(M4.create(), s * 0.7, -0.6, 2.1, s * 0.4, 0.3, 0, 1, 1, 1));
      mb.cyl(0, 0, 0, 0.25, 0.02, 1.3, 6, col('#d8cdb8'), null);
      mb.transform(null);
    }
    mb.ellipsoid(0, 1.1, -0.3, 1.3, 0.5, 1.4, 10, 5, moss);
    M.head = mb.build();
    mb = new MeshBuilder();
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.35, 0.25, 3.2, 6, shellD);
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 3.2, 0, Math.PI / 2 + 0.9, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.25, 0.04, 3.4, 6, shell);
    mb.transform(null);
    M.leg = mb.build();
    mb = new MeshBuilder();
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.6, 0.5, 3, 7, shellD);
    mb.transform(null);
    mb.ellipsoid(0, 0, 4, 1.1, 0.9, 1.6, 10, 6, shell);
    mb.transform(M4.fromTRS(M4.create(), 0.4, 0, 5, 0.25, Math.PI / 2, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.45, 0.04, 2.6, 6, under);
    mb.transform(M4.fromTRS(M4.create(), -0.4, 0, 5, -0.2, Math.PI / 2, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.35, 0.04, 2.0, 6, under);
    mb.transform(null);
    M.claw = mb.build();
    return (this.cache.cf = M);
  },
  thunderclast() {
    if (this.cache.tc) return this.cache.tc;
    const rock = col('#6b5d55'), dark = col('#4a3f39'), lava = col('#ff5a2a', 3), moss = col('#5a6338');
    const M = {};
    let mb = new MeshBuilder();
    mb.ellipsoid(0, 4.6, 0, 2.4, 2.4, 1.7, 12, 8, rock);
    mb.ellipsoid(1.3, 6.2, -0.2, 1.4, 1.2, 1.4, 10, 6, dark);
    mb.ellipsoid(-1.4, 6.1, -0.1, 1.4, 1.3, 1.4, 10, 6, dark);
    mb.ellipsoid(0, 8.3, 0.3, 1.1, 1.0, 1.1, 10, 7, rock);
    mb.ellipsoid(0, 3.0, 0, 1.6, 0.9, 1.2, 10, 6, dark);
    mb.ellipsoid(0, 5.4, 1.35, 0.7, 0.75, 0.3, 10, 6, lava);       // kärna fram
    mb.ellipsoid(0, 6.0, -1.5, 0.6, 0.65, 0.3, 10, 6, lava);       // kristall bak
    mb.ellipsoid(0.38, 8.45, 1.2, 0.18, 0.1, 0.08, 6, 4, lava);
    mb.ellipsoid(-0.38, 8.45, 1.2, 0.18, 0.1, 0.08, 6, 4, lava);
    mb.ellipsoid(0, 7.2, 0.6, 1.2, 0.4, 1.1, 8, 4, moss);
    const cracks = [[0.9, 4.2, 1.5, 0.6], [-1, 4.6, 1.4, -0.5], [0.4, 3.6, 1.4, 1.2]];
    for (const c of cracks) {
      mb.transform(M4.fromTRS(M4.create(), c[0], c[1], c[2], 0, 0, c[3], 1, 1, 1));
      mb.ellipsoid(0, 0, 0, 0.08, 0.7, 0.05, 6, 3, lava);
    }
    mb.transform(null);
    M.body = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -1.2, 0, 0.9, 1.5, 0.9, 10, 6, dark);
    mb.ellipsoid(0, -3.4, 0.2, 0.8, 1.3, 0.8, 10, 6, rock);
    mb.ellipsoid(0, -5.0, 0.4, 1.2, 0.9, 1.1, 10, 6, dark);
    M.arm = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -1.4, 0, 1.0, 1.6, 1.0, 10, 6, dark);
    mb.ellipsoid(0, -2.7, 0.3, 1.1, 0.6, 1.4, 10, 6, rock);
    M.leg = mb.build();
    return (this.cache.tc = M);
  },
  heraldCore() {
    if (this.cache.hc) return this.cache.hc;
    const mb = new MeshBuilder();
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 0, 0.3, 0.5, 0.2, 1, 1, 1));
    mb.cyl(0, -1, 0, 0, 1, 1, 6, col('#ff2a4a', 2.5), null);
    mb.cyl(0, 0, 0, 1, 0, 1.2, 6, col('#ff6a7a', 3), null);
    mb.transform(null);
    return (this.cache.hc = mb.build());
  },
};
