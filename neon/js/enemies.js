'use strict';
// Fiendetyper och deras beteenden, fiendeskott samt bossen.

const ENEMY_TYPES = {
  // Jagar spelaren rakt.
  chaser: { name: 'Jägare', hp: 12, speed: 105, r: 12, dmg: 8, xp: 1, color: '#ff3fa4', sides: 4, mass: 1 },
  // Laddar upp och rusar snabbt i en rak linje.
  dasher: { name: 'Rusare', hp: 9, speed: 85, r: 11, dmg: 12, xp: 2, color: '#ffe23f', sides: 3, mass: 0.8 },
  // Håller avstånd och skjuter.
  shooter: { name: 'Skytt', hp: 16, speed: 80, r: 13, dmg: 7, xp: 3, color: '#3fff8a', sides: 5, mass: 1 },
  // Långsam med mycket liv, svår att knuffa.
  tank: { name: 'Pansar', hp: 110, speed: 50, r: 26, dmg: 20, xp: 10, color: '#ff8a3f', sides: 6, mass: 6 },
  // Delar sig i två mindre när den dör (två gånger).
  splitter: { name: 'Delare', hp: 30, speed: 72, r: 20, dmg: 10, xp: 2, color: '#b04bff', sides: 0, mass: 1.5 },
  // Boss var 5:e våg.
  boss: { name: 'Kärnan', hp: 2200, speed: 70, r: 50, dmg: 25, xp: 0, color: '#ff2050', sides: 8, mass: 50 },
};

// Storlek och liv per generation för delaren (gen 2 = störst).
const SPLITTER_GEN = [
  { r: 8, hp: 6, speed: 1.35 },
  { r: 13, hp: 14, speed: 1.15 },
  { r: 20, hp: 30, speed: 1 },
];

function createEnemy() {
  return {
    id: 0, type: '', def: null, x: 0, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0,
    r: 10, hp: 1, maxHp: 1, speed: 0, dmg: 0, xp: 0, mass: 1,
    state: 0, timer: 0, angle: 0, spin: 0, flash: 0, gen: 0, dead: false,
    dirX: 0, dirY: 0, lastOrbitHit: -1, novaId: -1, zapTag: -1, isBoss: false,
    phase: 0, pattern: 0, patternTimer: 0, shotTimer: 0, level: 0,
  };
}

function createEnemyBullet() {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 0, life: 0, color: '#ff3f5a' };
}

const Enemies = {
  pool: new Pool(createEnemy, 500),
  bullets: new Pool(createEnemyBullet, 300),
  grid: new SpatialGrid(WORLD_W, WORLD_H, 64, 1024),
  serial: 0,
  near: [],

  get list() { return this.pool.active; },

  reset() {
    this.pool.clear();
    this.bullets.clear();
    this.grid.clear();
  },

  // mods: { hp, speed, dmg } multiplikatorer från vågsystemet.
  spawn(type, x, y, mods, gen) {
    const def = ENEMY_TYPES[type];
    const e = this.pool.spawn();
    e.id = ++this.serial;
    e.type = type;
    e.def = def;
    e.x = x; e.y = y;
    e.vx = e.vy = e.kbx = e.kby = 0;
    e.state = 0;
    e.timer = rand(0, 1.5);
    e.angle = rand(0, TAU);
    e.spin = rand(-2, 2);
    e.flash = 0;
    e.dead = false;
    e.isBoss = type === 'boss';
    e.lastOrbitHit = -1;
    e.novaId = -1;
    e.mass = def.mass;
    e.r = def.r;
    e.xp = def.xp;
    e.gen = 0;
    let hp = def.hp, speed = def.speed;
    if (type === 'splitter') {
      e.gen = gen === undefined ? 2 : gen;
      const g = SPLITTER_GEN[e.gen];
      e.r = g.r; hp = g.hp; speed *= g.speed;
    }
    const m = mods || { hp: 1, speed: 1, dmg: 1 };
    e.maxHp = e.hp = hp * m.hp;
    e.speed = speed * m.speed * rand(0.92, 1.08);
    e.dmg = def.dmg * m.dmg;
    e.mods = m;
    return e;
  },

  fireBullet(x, y, angle, speed, dmg, color, r) {
    const b = this.bullets.spawn();
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.dmg = dmg;
    b.life = 6;
    b.color = color || '#ff3f5a';
    b.r = r || 6;
    return b;
  },

  rebuildGrid() {
    const g = this.grid;
    g.clear();
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) if (!a[i].dead) g.insert(a[i]);
  },

  update(dt, game) {
    const p = game.player;
    const a = this.pool.active;

    // Ta bort döda fiender från förra ticken.
    for (let i = a.length - 1; i >= 0; i--) if (a[i].dead) this.pool.releaseAt(i);

    this.rebuildGrid();
    const near = this.near;

    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      let tvx = 0, tvy = 0, steer = 6;

      switch (e.type) {
        case 'chaser':
        case 'splitter':
        case 'tank':
          tvx = nx * e.speed; tvy = ny * e.speed;
          if (e.type === 'splitter') {
            // Lite vingligt.
            const w = Math.sin(game.time * 3 + e.id) * 0.5;
            tvx += -ny * e.speed * w; tvy += nx * e.speed * w;
          }
          e.angle += e.spin * dt;
          break;

        case 'dasher':
          e.timer -= dt;
          if (e.state === 0) { // närmar sig
            tvx = nx * e.speed; tvy = ny * e.speed;
            e.angle = Math.atan2(ny, nx);
            if (d < 320 && e.timer <= 0) { e.state = 1; e.timer = 0.65; }
          } else if (e.state === 1) { // laddar upp, siktar
            e.dirX = nx; e.dirY = ny;
            e.angle = Math.atan2(ny, nx);
            steer = 10;
            if (e.timer <= 0) { e.state = 2; e.timer = 0.5; }
          } else if (e.state === 2) { // rusar
            tvx = e.dirX * e.speed * 6.5; tvy = e.dirY * e.speed * 6.5;
            steer = 30;
            if (e.timer <= 0) { e.state = 3; e.timer = 0.7; }
          } else { // återhämtar sig
            steer = 3;
            if (e.timer <= 0) { e.state = 0; e.timer = rand(0.5, 1.5); }
          }
          break;

        case 'shooter':
          e.angle = Math.atan2(ny, nx);
          if (d > 340) { tvx = nx * e.speed; tvy = ny * e.speed; }
          else if (d < 230) { tvx = -nx * e.speed; tvy = -ny * e.speed; }
          else { const s = (e.id & 1) ? 1 : -1; tvx = -ny * e.speed * 0.6 * s; tvy = nx * e.speed * 0.6 * s; }
          e.timer -= dt;
          if (e.timer <= 0 && d < 520) {
            e.timer = rand(1.9, 2.6);
            this.fireBullet(e.x + nx * e.r, e.y + ny * e.r, Math.atan2(ny, nx), 240, e.dmg, '#7dff9e', 6);
            game.onEnemyShoot(e);
          }
          break;

        case 'boss':
          Boss.update(e, dt, game, nx, ny, d);
          tvx = e.vx; tvy = e.vy; steer = 0;
          break;
      }

      if (steer > 0) {
        const k = 1 - Math.exp(-steer * dt);
        e.vx += (tvx - e.vx) * k;
        e.vy += (tvy - e.vy) * k;
      }

      // Separation så att fiender inte staplas på varandra.
      this.grid.query(e.x, e.y, e.r + 30, near);
      let sx = 0, sy = 0;
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const rr = e.r + o.r;
        const dd = ox * ox + oy * oy;
        if (dd < rr * rr && dd > 0.0001) {
          const dl = Math.sqrt(dd);
          const push = (rr - dl) * (o.mass / (e.mass + o.mass));
          sx += (ox / dl) * push;
          sy += (oy / dl) * push;
        }
      }
      e.x += sx * 0.5;
      e.y += sy * 0.5;

      e.x += (e.vx + e.kbx) * dt;
      e.y += (e.vy + e.kby) * dt;
      const kd = Math.exp(-8 * dt);
      e.kbx *= kd; e.kby *= kd;
      if (e.flash > 0) e.flash -= dt;

      e.x = clamp(e.x, e.r, WORLD_W - e.r);
      e.y = clamp(e.y, e.r, WORLD_H - e.r);

      // Fiender som hamnat långt efter flyttas fram runt spelaren.
      if (!e.isBoss && d > 1700) {
        const sp = game.spawnPoint();
        e.x = sp.x; e.y = sp.y;
      }
    }

    this.rebuildGrid();

    // Kontaktskada mot spelaren.
    if (p.alive) {
      this.grid.query(p.x, p.y, p.r + 60, near);
      for (let j = 0; j < near.length; j++) {
        const e = near[j];
        const rr = e.r + p.r - 3;
        if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          if (p.takeDamage(e.dmg, game) > 0) {
            const dx = p.x - e.x, dy = p.y - e.y, dl = Math.hypot(dx, dy) || 1;
            p.vx += (dx / dl) * 250; p.vy += (dy / dl) * 250;
          }
          break;
        }
      }
    }

    // Fiendeskott.
    const b = this.bullets.active;
    for (let i = b.length - 1; i >= 0; i--) {
      const s = b[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let remove = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_W || s.y > WORLD_H;
      if (!remove && p.alive) {
        const rr = s.r + p.r - 2;
        if (dist2(s.x, s.y, p.x, p.y) < rr * rr) {
          p.takeDamage(s.dmg, game);
          remove = true;
        }
      }
      if (remove) this.bullets.releaseAt(i);
    }
  },

  // Returnerar närmaste levande fiende inom maxR, eller null.
  nearest(x, y, maxR, exclude) {
    const near = this.grid.query(x, y, maxR, this.near);
    let best = null, bd = maxR * maxR;
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (e.dead || (exclude && exclude(e))) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  sprite(e, flash) {
    const def = e.def;
    const key = 'e-' + e.type + '-' + e.gen + (flash ? '-f' : '');
    // Runda delare behöver ingen rotation.
    const angle = def.sides === 0 ? 0 : e.angle;
    return Sprites.rotated(key, e.r * (e.type === 'dasher' ? 1.22 : 1.02), 10, angle, (g) => {
      const c = flash ? '#ffffff' : def.color;
      const path = def.sides === 0 ? circlePath(e.r) :
        e.type === 'dasher' ? (p) => { p.moveTo(e.r * 1.2, 0); p.lineTo(-e.r, e.r * 0.85); p.lineTo(-e.r * 0.5, 0); p.lineTo(-e.r, -e.r * 0.85); } :
        polyPath(def.sides, e.r, 0);
      neonShape(g, c, 10, e.isBoss ? 4 : 2.5, flash ? 0.7 : 0.18, path);
      if (e.type === 'tank') neonShape(g, c, 6, 2, 0, polyPath(6, e.r * 0.5, Math.PI / 6));
      if (e.type === 'shooter') neonShape(g, c, 4, 2, 0.6, circlePath(e.r * 0.3));
      if (e.isBoss) {
        neonShape(g, c, 10, 3, 0.15, polyPath(4, e.r * 0.6, Math.PI / 4));
        neonShape(g, '#ffe23f', 8, 2, 0.5, circlePath(e.r * 0.2));
      }
    });
  },

  draw(ctx, game) {
    const v = game.view(60);
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.dead || e.x < v.x0 || e.x > v.x1 || e.y < v.y0 || e.y > v.y1) continue;
      const sp = this.sprite(e, e.flash > 0);
      ctx.drawImage(sp.img, e.x - sp.half, e.y - sp.half);
    }

    if (game.boss && !game.boss.dead) Boss.drawTelegraph(game.boss, ctx);

    // Rusarens siktlinje under uppladdning.
    ctx.lineWidth = 2;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.type !== 'dasher' || e.state !== 1 || e.dead) continue;
      ctx.strokeStyle = 'rgba(255, 226, 63, ' + (0.25 + 0.5 * (1 - e.timer / 0.65)) + ')';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.dirX * 300, e.y + e.dirY * 300);
      ctx.stroke();
    }

    // Livmätare för skadade pansarfiender.
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.type !== 'tank' || e.hp >= e.maxHp || e.dead) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 22, e.y - e.r - 12, 44, 4);
      ctx.fillStyle = '#ff8a3f';
      ctx.fillRect(e.x - 22, e.y - e.r - 12, 44 * Math.max(0, e.hp / e.maxHp), 4);
    }

    // Fiendeskott.
    const b = this.bullets.active;
    for (let i = 0; i < b.length; i++) {
      const sb = b[i];
      if (sb.x < v.x0 || sb.x > v.x1 || sb.y < v.y0 || sb.y > v.y1) continue;
      const sp = Sprites.get('eb-' + sb.color + sb.r, sb.r, 10, (g) => neonShape(g, sb.color, 10, 2, 0.6, circlePath(sb.r)));
      ctx.drawImage(sp.img, sb.x - sp.half, sb.y - sp.half);
    }
  },
};

// Bossen: växlar mellan attackmönster och blir argare under halva livet.
// Mönster: 0 = spiral, 1 = ringsalvor, 2 = rusning, 3 = kallar på hjälp.
const Boss = {
  init(e, n) {
    e.level = n;
    e.maxHp = e.hp = 1300 * (1 + 1.3 * (n - 1));
    e.dmg = 25 + 5 * n;
    e.speed = 70 + 6 * n;
    e.pattern = -1;
    e.state = 0;
    e.patternTimer = 1.5;
    e.shotTimer = 0;
    e.phase = 0;
  },

  nextPattern(e) {
    let p;
    do { p = randInt(0, 3); } while (p === e.pattern);
    e.pattern = p;
    e.state = 0;
    e.shotTimer = 0;
    e.patternTimer = p === 0 ? 4 : p === 1 ? 2.4 : p === 2 ? 0 : 1.2;
    e.charges = 2 + (e.phase ? 1 : 0);
  },

  update(e, dt, game, nx, ny, d) {
    const rage = e.hp < e.maxHp * 0.5;
    if (rage && !e.phase) { e.phase = 1; game.onBossRage(e); }
    const n = e.level, speedUp = rage ? 1.35 : 1;
    e.patternTimer -= dt;
    e.shotTimer -= dt;
    const k = 1 - Math.exp(-4 * dt);

    if (e.pattern === -1) { // paus mellan mönster: närma sig spelaren
      e.vx += (nx * e.speed - e.vx) * k;
      e.vy += (ny * e.speed - e.vy) * k;
      e.angle += dt * 0.6;
      if (e.patternTimer <= 0) this.nextPattern(e);
      return;
    }

    switch (e.pattern) {
      case 0: // spiral av skott medan den sakta följer efter
        e.vx += (nx * e.speed * 0.4 - e.vx) * k;
        e.vy += (ny * e.speed * 0.4 - e.vy) * k;
        e.angle += dt * 2.2 * speedUp;
        if (e.shotTimer <= 0) {
          e.shotTimer = 0.09 / speedUp;
          const arms = 2 + Math.min(3, n) + (rage ? 1 : 0);
          for (let i = 0; i < arms; i++) {
            Enemies.fireBullet(e.x, e.y, e.angle + (i / arms) * TAU, 200 + 15 * n, e.dmg * 0.5, '#ff3f5a', 7);
          }
          game.onEnemyShoot(e, true);
        }
        break;

      case 1: // ringar av skott
        e.vx *= 0.9; e.vy *= 0.9;
        e.angle += dt;
        if (e.shotTimer <= 0) {
          e.shotTimer = 0.6 / speedUp;
          const count = 16 + 4 * n + (rage ? 6 : 0);
          const off = e.state * 0.5;
          for (let i = 0; i < count; i++) {
            Enemies.fireBullet(e.x, e.y, off + (i / count) * TAU, 170 + 10 * n, e.dmg * 0.5, '#ff7a3f', 8);
          }
          e.state++;
          game.onEnemyShoot(e, true);
        }
        break;

      case 2: // laddar och rusar mot spelaren, flera gånger
        if (e.state === 0) { // sikta
          e.vx *= 0.85; e.vy *= 0.85;
          e.dirX = nx; e.dirY = ny;
          e.state = 1;
          e.timer = 0.8 / speedUp;
        } else if (e.state === 1) {
          e.vx *= 0.85; e.vy *= 0.85;
          e.dirX = nx; e.dirY = ny;
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 2; e.timer = 0.65; game.onBossCharge(e); }
        } else if (e.state === 2) {
          const sp = 640 + 40 * n;
          e.vx = e.dirX * sp; e.vy = e.dirY * sp;
          e.angle += dt * 8;
          e.timer -= dt;
          if (e.timer <= 0) {
            e.charges--;
            // Skott åt sidorna när rusningen slutar.
            const a = Math.atan2(e.dirY, e.dirX);
            for (let i = 0; i < 10; i++) Enemies.fireBullet(e.x, e.y, a + (i / 10) * TAU, 180, e.dmg * 0.5, '#ff3f5a', 7);
            e.state = e.charges > 0 ? 0 : 3;
            e.timer = 0.5;
          }
        } else {
          e.vx *= 0.9; e.vy *= 0.9;
          e.timer -= dt;
          if (e.timer <= 0) e.patternTimer = 0;
        }
        if (e.state !== 3) e.patternTimer = 1;
        break;

      case 3: // kallar på hjälp och skjuter riktade salvor
        e.vx *= 0.9; e.vy *= 0.9;
        e.angle += dt * 0.5;
        if (e.state === 0) {
          e.state = 1;
          const count = Math.max(0, Math.min(5 + 2 * n, MAX_ENEMIES + 80 - Enemies.list.length));
          for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU;
            Enemies.spawn(n >= 2 && i % 3 === 0 ? 'dasher' : 'chaser', e.x + Math.cos(a) * (e.r + 30), e.y + Math.sin(a) * (e.r + 30), game.waveMods);
          }
          game.onBossSummon(e);
        }
        if (e.shotTimer <= 0) {
          e.shotTimer = 0.35 / speedUp;
          const a = Math.atan2(ny, nx);
          for (let i = -2; i <= 2; i++) Enemies.fireBullet(e.x + nx * e.r, e.y + ny * e.r, a + i * 0.14, 300, e.dmg * 0.5, '#ff3f5a', 7);
          game.onEnemyShoot(e, true);
        }
        break;
    }

    if (e.patternTimer <= 0) {
      e.pattern = -1;
      e.patternTimer = rage ? 0.6 : 1.1;
    }
  },

  // Siktlinje före rusning.
  drawTelegraph(e, ctx) {
    if (e.pattern !== 2 || e.state !== 1) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 32, 80, 0.55)';
    ctx.lineWidth = e.r * 1.6;
    ctx.globalAlpha = 0.25 + 0.3 * Math.sin(e.timer * 30) ** 2;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + e.dirX * 700, e.y + e.dirY * 700);
    ctx.stroke();
    ctx.restore();
  },
};
