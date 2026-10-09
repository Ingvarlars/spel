'use strict';
// Fiender, deras beteenden och projektiler (pilar, chockvågor, bråte).
// Ritfunktionerna tar en palett så att samma figur kan ritas i spelet eller
// som bläckskiss i skissboken.

const ENEMY_DEFS = {
  crab:    { name: 'Kremling',  hp: 14,  w: 18, h: 16, speed: 75,  dmg: 8,  weight: 0.6, contact: true,  glow: 1 },
  warrior: { name: 'Parshendi-krigare',  hp: 55,  w: 24, h: 40, speed: 115, dmg: 18, weight: 1.2, contact: false, glow: 3 },
  archer:  { name: 'Parshendi-bågskytt',    hp: 34,  w: 22, h: 38, speed: 95,  dmg: 12, weight: 1,   contact: false, glow: 3 },
  shield:  { name: 'Parshendi-sköldbärare',  hp: 75,  w: 30, h: 42, speed: 70,  dmg: 15, weight: 2.5, contact: false, glow: 4 },
  thunder: { name: 'Stormform',    hp: 46,  w: 24, h: 40, speed: 80,  dmg: 24, weight: 1,   contact: false, glow: 4 },
  hover:   { name: 'Fused (Himmelsk)',      hp: 60,  w: 26, h: 40, speed: 170, dmg: 16, weight: 1,   contact: false, glow: 5, flying: true },
  leech:   { name: 'Voidspren',   hp: 26,  w: 22, h: 22, speed: 200, dmg: 0,  weight: 0.5, contact: false, glow: 4, flying: true },
  brute:   { name: 'Stenbjässe',   hp: 190, w: 46, h: 56, speed: 60,  dmg: 20, weight: 8,   contact: true,  glow: 8 },
};

function createEnemy() {
  return {
    id: 0, type: '', def: null, x: 0, y: 0, vx: 0, vy: 0, w: 10, h: 10,
    hp: 1, maxHp: 1, dmg: 0, speed: 0, facing: 1, state: 0, timer: 0, cd: 0,
    onGround: false, flash: 0, dead: false, alert: false, stun: 0, float: 0,
    lastSwing: -1, lastSpear: -1, los: false, losTimer: 0, aim: 0, gx: 0, gy: 1,
    dir: 1, attached: false, anim: 0, turnTimer: 0, tx: 0, ty: 0, fallV: 0,
    boss: false, drain: false, mods: null, elite: false,
  };
}

function createProjectile() {
  return { x: 0, y: 0, vx: 0, vy: 0, kind: '', dmg: 0, life: 0, grav: 0, r: 4, parryable: false, stuck: 0, dir: 1, owner: null };
}

const Projectiles = {
  pool: new Pool(createProjectile, 120),

  reset() { this.pool.clear(); },

  spawn(kind, x, y, vx, vy, dmg, opts) {
    const b = this.pool.spawn();
    b.kind = kind; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.dmg = dmg;
    b.life = (opts && opts.life) || 4;
    b.grav = (opts && opts.grav) || 0;
    b.r = (opts && opts.r) || 4;
    b.parryable = !!(opts && opts.parryable);
    b.stuck = 0;
    b.dir = vx >= 0 ? 1 : -1;
    b.owner = (opts && opts.owner) || null;
    return b;
  },

  update(dt, game) {
    const p = game.player;
    const a = this.pool.active;
    for (let i = a.length - 1; i >= 0; i--) {
      const b = a[i];
      b.life -= dt;
      if (b.life <= 0) { this.pool.releaseAt(i); continue; }
      if (b.stuck > 0) { b.stuck -= dt; if (b.stuck <= 0) this.pool.releaseAt(i); continue; }

      if (b.kind === 'wave') {
        // Chockvåg som rullar längs marken tills marken tar slut.
        b.x += b.vx * dt;
        const below = World.solidAtPx(b.x, b.y + 20), wall = World.solidAtPx(b.x + b.dir * 8, b.y);
        if (!below || wall) { this.pool.releaseAt(i); continue; }
        if (game.tick % 2 === 0) Effects.debris(b.x, b.y + 14, '#9a7a5a', 1, 120);
      } else {
        b.vy += b.grav * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (World.solidAtPx(b.x, b.y)) {
          if (b.kind === 'arrow') { b.stuck = 1.2; b.vx = b.vx; continue; }
          if (b.kind === 'rock') Effects.debris(b.x, b.y, '#7a6656', 5, 160);
          this.pool.releaseAt(i);
          continue;
        }
      }

      if (p.alive && this.hitsPlayer(b, p)) {
        p.takeDamage(b.dmg, game, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
        if (b.kind !== 'wave') { this.pool.releaseAt(i); continue; }
      }
    }
  },

  hitsPlayer(b, p) {
    const hh = b.kind === 'wave' ? 18 : b.r;
    return Math.abs(b.x - p.x) < p.w / 2 + b.r && Math.abs(b.y - p.y) < p.h / 2 + hh;
  },

  draw(ctx, game) {
    const v = game.view(20);
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const b = a[i];
      if (b.x < v.x0 || b.x > v.x1 || b.y < v.y0 || b.y > v.y1) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.kind === 'arrow') {
        ctx.globalAlpha = b.stuck > 0 ? Math.min(1, b.stuck) : 1;
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.strokeStyle = '#3b2a1c';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#5c6670';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.fill();
        ctx.fillStyle = '#c94c34';
        ctx.fillRect(-17, -3, 5, 2); ctx.fillRect(-17, 1, 5, 2);
      } else if (b.kind === 'wave') {
        const k = Math.min(1, b.life * 2);
        ctx.globalAlpha = k;
        ctx.fillStyle = '#c99a6a';
        ctx.beginPath();
        ctx.moveTo(-14, 18);
        ctx.quadraticCurveTo(0, -14 - Math.sin(game.realTime * 30) * 4, 14, 18);
        ctx.fill();
        ctx.strokeStyle = '#7a5a3a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (b.kind === 'rock') {
        ctx.rotate(game.realTime * 8 + b.r);
        ctx.fillStyle = '#6e5f55';
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a2 = (k / 6) * TAU, rr = b.r * (0.75 + ((k * 37) % 5) / 10);
          if (k === 0) ctx.moveTo(Math.cos(a2) * rr, Math.sin(a2) * rr); else ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else if (b.kind === 'orb') {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, b.r * 2.2);
        g.addColorStop(0, 'rgba(255,220,255,1)');
        g.addColorStop(0.4, 'rgba(200,80,255,0.8)');
        g.addColorStop(1, 'rgba(120,20,200,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-b.r * 2.2, -b.r * 2.2, b.r * 4.4, b.r * 4.4);
      }
      ctx.restore();
    }
  },
};

const Enemies = {
  pool: new Pool(createEnemy, 80),
  serial: 0,
  beams: [],     // röda blixtar från stormformen { x0, y0, x1, y1, life }
  tethers: [],   // voidsprens sugtrådar (fylls varje tick)

  get list() { return this.pool.active; },

  reset() {
    this.pool.clear();
    this.beams.length = 0;
    Projectiles.reset();
  },

  // mods: { hp, dmg, speed } från svårighetsgraden.
  spawn(type, x, y, mods, elite) {
    const def = ENEMY_DEFS[type];
    const e = this.pool.spawn();
    const m = mods || { hp: 1, dmg: 1, speed: 1 };
    const em = elite ? 2.2 : 1;
    e.id = ++this.serial;
    e.type = type; e.def = def;
    e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.w = def.w * (elite ? 1.2 : 1); e.h = def.h * (elite ? 1.2 : 1);
    e.maxHp = e.hp = def.hp * m.hp * em;
    e.dmg = def.dmg * m.dmg * (elite ? 1.3 : 1);
    e.speed = def.speed * m.speed * rand(0.92, 1.08);
    e.facing = Math.random() < 0.5 ? -1 : 1;
    e.state = 0; e.timer = rand(0.5, 2); e.cd = rand(0.5, 1.5);
    e.onGround = false; e.flash = 0; e.dead = false; e.alert = false;
    e.stun = 0; e.float = 0; e.lastSwing = -1; e.lastSpear = -1;
    e.los = false; e.losTimer = rand(0, 0.3); e.aim = 0;
    e.gx = 0; e.gy = 1; e.dir = e.facing; e.attached = false;
    e.anim = rand(0, 10); e.turnTimer = 0; e.fallV = 0;
    e.boss = false; e.drain = false; e.mods = m; e.elite = !!elite;
    return e;
  },

  // Fiender som sover långt bort uppdateras inte.
  update(dt, game) {
    const p = game.player;
    const a = this.pool.active;
    this.tethers.length = 0;
    for (let i = a.length - 1; i >= 0; i--) if (a[i].dead) this.pool.releaseAt(i);

    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.boss) continue; // bossar sköts av bosses.js
      const dx = p.x - e.x, dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (!e.alert && d2 > 1500 * 1500) continue;
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.cd > 0) e.cd -= dt;

      // Siktlinje mot spelaren kontrolleras några gånger per sekund.
      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.losTimer = 0.25;
        e.los = d2 < 700 * 700 && World.lineClear(e.x, e.y - e.h * 0.3, p.x, p.y);
        if (e.los && d2 < 480 * 480 && p.alive) {
          if (!e.alert) game.onEnemyAlert(e);
          e.alert = true;
        }
      }

      if (e.stun > 0) {
        e.stun -= dt;
        e.state = 0;
      } else if (p.alive) {
        this.think(e, dt, game, dx, dy, Math.sqrt(d2));
      }

      this.physics(e, dt, game);

      // Kontaktskada.
      if (e.def.contact && p.alive && e.stun <= 0 && this.overlapsPlayer(e, p, 0)) {
        p.takeDamage(e.dmg, game, e.x, e.y);
      }
    }
  },

  overlapsPlayer(e, p, pad) {
    return Math.abs(e.x - p.x) < (e.w + p.w) / 2 + pad && Math.abs(e.y - p.y) < (e.h + p.h) / 2 + pad;
  },

  // Rörelse, gravitation, knuffar och kollision.
  physics(e, dt, game) {
    if (e.type === 'crab' && e.attached && e.float <= 0) { this.crawl(e, dt, game); return; }
    const flying = e.def.flying && e.stun <= 0;
    if (e.float > 0) {
      // Full Lashing: fienden faller uppåt.
      e.float -= dt;
      e.vy -= GRAVITY * 1.1 * dt;
      e.vx *= Math.exp(-2 * dt);
    } else if (!flying) {
      e.vy += GRAVITY * dt;
    } else {
      e.vx *= Math.exp(-1.5 * dt);
      e.vy *= Math.exp(-1.5 * dt);
    }
    e.vx += game.wind(e) * dt / e.def.weight;
    if (e.vy > 900) e.vy = 900;
    if (e.vy < -900) e.vy = -900;
    const fallV = e.vy;
    const hit = World.move(e, e.vx * dt, e.vy * dt);
    if (hit & 3) { e.vx = 0; e.blocked = true; } else e.blocked = false;
    if (hit & 4) {
      if (e.float > 0 && fallV < -500) this.impact(e, -fallV, game);
      e.vy = 0;
    }
    if (hit & 8) {
      if (fallV > 700 && !flying) this.impact(e, fallV, game);
      e.vy = 0;
      e.onGround = true;
      if (e.type === 'crab') { e.attached = true; e.gx = 0; e.gy = 1; }
    } else e.onGround = false;
  },

  // Fiender som krossas mot berg efter en Lashing tar fallskada.
  impact(e, speed, game) {
    const dmg = (speed - 500) * 0.18;
    if (dmg > 2) game.damageEnemy(e, dmg, 0, 0, 'fall');
    Effects.debris(e.x, e.y + e.h / 2, '#9a7a5a', 8, 200);
  },

  // Kremlingen kryper längs alla ytor, även väggar och tak.
  crawl(e, dt, game) {
    const p = game.player;
    const tx = e.gy * e.dir, ty = -e.gx * e.dir;
    const sp = e.speed * (e.alert ? 1.4 : 0.7);
    const hw = e.w / 2, hh = e.h / 2;
    const hits = (ox, oy) => World.rectHits(e.x - hw + ox, e.y - hh + oy, e.w, e.h);
    e.vx = tx * sp + e.gx * 30;
    e.vy = ty * sp + e.gy * 30;
    World.move(e, e.vx * dt, e.vy * dt);
    if (hits(tx * 2, ty * 2)) {
      // Vägg framför: den blir det nya golvet.
      e.gx = tx * e.dir; e.gy = ty * e.dir;
      e.gx = Math.round(e.gx); e.gy = Math.round(e.gy);
      const ngx = Math.round(tx), ngy = Math.round(ty);
      e.gx = ngx; e.gy = ngy;
    } else if (!hits(e.gx * 3, e.gy * 3)) {
      // Kanten tog slut: runda hörnet.
      const ngx = -Math.round(tx), ngy = -Math.round(ty);
      World.move(e, e.gx * 6, e.gy * 6);
      e.gx = ngx; e.gy = ngy;
      World.move(e, e.gx * 6, e.gy * 6);
      if (!hits(e.gx * 3, e.gy * 3)) { e.attached = false; e.gx = 0; e.gy = 1; }
    }
    void p;
  },

  // Beteenden per fiendetyp.
  think(e, dt, game, dx, dy, d) {
    const p = game.player;
    switch (e.type) {
      case 'crab': {
        if (e.attached) {
          const tx = e.gy, ty = -e.gx;
          if (e.alert && d < 420) e.dir = (dx * tx + dy * ty) >= 0 ? 1 : -1;
          else if ((e.timer -= dt) <= 0) { e.timer = rand(1.5, 4); e.dir = -e.dir; }
        }
        break;
      }

      case 'warrior': {
        e.timer -= dt;
        if (e.state === 0) { // patrull / jakt
          if (e.alert) {
            e.facing = dx >= 0 ? 1 : -1;
            this.walk(e, e.facing * e.speed, dt, true);
            if (Math.abs(dx) < 62 && Math.abs(dy) < 50 && e.cd <= 0) { e.state = 1; e.timer = 0.45; }
          } else this.patrol(e, dt);
        } else if (e.state === 1) { // laddar slaget
          this.walk(e, 0, dt);
          if (e.timer <= 0) { e.state = 2; e.timer = 0.14; e.vx += e.facing * 160; game.onEnemyStrike(e); }
        } else if (e.state === 2) { // slår
          this.strikeBox(e, game, 74, 56, e.dmg);
          if (e.timer <= 0) { e.state = 3; e.timer = 0.55; }
        } else { // återhämtning
          this.walk(e, 0, dt);
          if (e.timer <= 0) { e.state = 0; e.cd = rand(0.3, 0.8); }
        }
        break;
      }

      case 'shield': {
        e.timer -= dt;
        // Vänder sig långsamt – gå runt eller över för att träffa ryggen.
        const want = dx >= 0 ? 1 : -1;
        if (e.alert && want !== e.facing) {
          e.turnTimer += dt;
          if (e.turnTimer > 0.85) { e.facing = want; e.turnTimer = 0; }
        } else e.turnTimer = 0;
        if (e.state === 0) {
          if (e.alert) {
            this.walk(e, want === e.facing ? e.facing * e.speed : 0, dt, true);
            if (Math.abs(dx) < 80 && Math.abs(dy) < 50 && want === e.facing && e.cd <= 0) { e.state = 1; e.timer = 0.4; }
          } else this.patrol(e, dt);
        } else if (e.state === 1) {
          this.walk(e, 0, dt);
          if (e.timer <= 0) { e.state = 2; e.timer = 0.22; game.onEnemyStrike(e); }
        } else if (e.state === 2) { // sköldstöt framåt
          e.vx = e.facing * 420;
          if (this.overlapsPlayer(e, p, 6) && p.invuln <= 0) {
            p.takeDamage(e.dmg, game, e.x, e.y);
            p.vx += e.facing * 380;
          }
          if (e.timer <= 0) { e.state = 3; e.timer = 0.7; }
        } else {
          this.walk(e, 0, dt);
          if (e.timer <= 0) { e.state = 0; e.cd = rand(0.8, 1.6); }
        }
        break;
      }

      case 'archer': {
        e.timer -= dt;
        e.facing = e.alert ? (dx >= 0 ? 1 : -1) : e.facing;
        if (!e.alert) { this.patrol(e, dt); break; }
        if (e.state === 0) {
          // Håll avstånd.
          let want = 0;
          if (Math.abs(dx) < 230) want = -e.facing;
          else if (Math.abs(dx) > 480 || !e.los) want = e.facing;
          this.walk(e, want * e.speed, dt, true);
          if (e.cd <= 0 && e.los && d < 700) { e.state = 1; e.timer = 0.8; }
        } else if (e.state === 1) { // spänner bågen
          this.walk(e, 0, dt);
          e.aim = this.ballistic(e.x, e.y - 10, p.x + p.vx * 0.35, p.y + p.vy * 0.2, 640, 900);
          if (e.timer <= 0) {
            Projectiles.spawn('arrow', e.x + e.facing * 10, e.y - 10, Math.cos(e.aim) * 640, Math.sin(e.aim) * 640, e.dmg, { grav: 900, parryable: true, life: 4, r: 4 });
            game.onEnemyShoot(e);
            e.state = 0; e.cd = rand(1.4, 2.2);
          }
        }
        break;
      }

      case 'thunder': {
        e.timer -= dt;
        if (!e.alert) { this.patrol(e, dt); break; }
        e.facing = dx >= 0 ? 1 : -1;
        if (e.state === 0) {
          let want = 0;
          if (d < 260) want = -e.facing; else if (d > 520 || !e.los) want = e.facing;
          this.walk(e, want * e.speed, dt, true);
          if (e.cd <= 0 && e.los && d < 620) { e.state = 1; e.timer = 1.15; game.onThunderCharge(e); }
        } else if (e.state === 1) { // laddar blixten, låser siktet strax före
          this.walk(e, 0, dt);
          if (e.timer > 0.3) e.aim = Math.atan2(dy, dx);
          if (e.timer <= 0) {
            this.fireBeam(e, game);
            e.state = 0; e.cd = rand(2, 3);
          }
        }
        break;
      }

      case 'hover': {
        e.timer -= dt;
        e.facing = dx >= 0 ? 1 : -1;
        if (!e.alert) {
          e.vy += Math.sin(e.anim * 2) * 20 * dt;
          break;
        }
        if (e.state === 0) { // svävar snett ovanför spelaren
          const side = (e.id & 1) ? 1 : -1;
          const tx = p.x + side * 170, ty = p.y - 170 + Math.sin(e.anim * 2) * 30;
          this.flyTo(e, tx, ty, e.speed, dt);
          if (e.timer <= 0 && e.los) { e.state = 1; e.timer = 0.55; e.tx = p.x; e.ty = p.y; game.onEnemyStrike(e); }
        } else if (e.state === 1) { // siktar med spjutet
          e.vx *= 0.9; e.vy *= 0.9;
          e.tx = p.x; e.ty = p.y;
          e.aim = Math.atan2(e.ty - e.y, e.tx - e.x);
          if (e.timer <= 0) { e.state = 2; e.timer = 0.6; }
        } else if (e.state === 2) { // dyker
          e.vx = Math.cos(e.aim) * 640; e.vy = Math.sin(e.aim) * 640;
          if (this.overlapsPlayer(e, p, 4)) p.takeDamage(e.dmg, game, e.x, e.y);
          if (e.timer <= 0 || e.blocked) { e.state = 3; e.timer = 0.9; }
        } else {
          e.vy -= 400 * dt;
          if (e.timer <= 0) { e.state = 0; e.timer = rand(1.6, 2.6); }
        }
        break;
      }

      case 'leech': {
        e.timer -= dt;
        if (!e.alert) { e.vy += Math.sin(e.anim * 3) * 30 * dt; break; }
        if (e.state === 0) { // följer efter och suger Stormlight
          this.flyTo(e, p.x - Math.sign(dx || 1) * 70, p.y - 30, e.speed, dt);
          if (d < 150 && p.light > 0) {
            const amount = Math.min(p.light, 9 * dt);
            p.light -= amount;
            e.hp = Math.min(e.maxHp * 1.5, e.hp + amount * 0.8);
            this.tethers.push(e);
          }
        } else { // flyr efter träff
          this.flyTo(e, e.x - Math.sign(dx || 1) * 300, e.y - 120, e.speed * 1.3, dt);
          if (e.timer <= 0) e.state = 0;
        }
        break;
      }

      case 'brute': {
        e.timer -= dt;
        if (!e.alert) { this.patrol(e, dt); break; }
        e.facing = dx >= 0 ? 1 : -1;
        if (e.state === 0) {
          this.walk(e, e.facing * e.speed, dt, false);
          if (e.cd <= 0 && e.onGround && Math.abs(dx) < 300) {
            e.state = 1; e.timer = 0.5; game.onEnemyStrike(e);
          }
        } else if (e.state === 1) { // hukar inför hoppet
          this.walk(e, 0, dt);
          if (e.timer <= 0) { e.vy = -620; e.vx = e.facing * 140; e.state = 2; e.timer = 2; }
        } else if (e.state === 2) { // i luften – landar med chockvåg
          if (e.onGround && e.vy >= 0) {
            for (const s of [-1, 1]) Projectiles.spawn('wave', e.x + s * 30, e.y + e.h / 2 - 18, s * 380, 0, e.dmg, { life: 1.6, r: 12 });
            game.onBruteSlam(e);
            e.state = 0; e.cd = rand(2.2, 3.2);
          }
        }
        break;
      }
    }
  },

  // Gå med önskad fart; hoppar över små kanter om `jump` är sant.
  walk(e, target, dt, jump) {
    const k = 1 - Math.exp(-10 * dt);
    e.vx += (target - e.vx) * k;
    if (jump && e.blocked && e.onGround && Math.abs(target) > 1) e.vy = -560;
  },

  patrol(e, dt) {
    e.timer -= dt;
    // Vänd vid kanter och väggar.
    const ahead = e.x + e.facing * (e.w / 2 + 6);
    const groundAhead = World.solidAtPx(ahead, e.y + e.h / 2 + 6);
    if (e.onGround && (!groundAhead || e.blocked)) e.facing = -e.facing;
    if (e.timer <= 0) { e.timer = rand(1.5, 4); if (Math.random() < 0.4) e.facing = -e.facing; }
    this.walk(e, e.facing * e.speed * 0.4, dt, false);
  },

  flyTo(e, tx, ty, speed, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    const s = Math.min(speed, d * 3);
    const k = 1 - Math.exp(-4 * dt);
    e.vx += ((dx / d) * s - e.vx) * k;
    e.vy += ((dy / d) * s - e.vy) * k;
  },

  strikeBox(e, game, reach, height, dmg) {
    const p = game.player;
    const x0 = e.facing > 0 ? e.x : e.x - reach, x1 = e.facing > 0 ? e.x + reach : e.x;
    if (p.x + p.w / 2 > x0 && p.x - p.w / 2 < x1 && Math.abs(p.y - e.y) < height / 2 + p.h / 2) {
      p.takeDamage(dmg, game, e.x, e.y);
    }
  },

  // Vinkel för en pil som ska träffa (tx, ty) med fart v och gravitation g.
  ballistic(x, y, tx, ty, v, g) {
    const dx = tx - x, dyUp = y - ty;
    const v2 = v * v;
    const disc = v2 * v2 - g * (g * dx * dx + 2 * dyUp * v2);
    if (disc < 0) return dx >= 0 ? -Math.PI / 4 : -Math.PI * 3 / 4;
    const th = Math.atan2(v2 - Math.sqrt(disc), g * Math.abs(dx)); // låg bana
    return dx >= 0 ? -th : -(Math.PI - th);
  },

  fireBeam(e, game) {
    const x0 = e.x + e.facing * 8, y0 = e.y - 12;
    const cx = Math.cos(e.aim), cy = Math.sin(e.aim);
    let len = 0;
    while (len < 760 && !World.solidAtPx(x0 + cx * len, y0 + cy * len)) len += 8;
    const x1 = x0 + cx * len, y1 = y0 + cy * len;
    this.beams.push({ x0, y0, x1, y1, life: 0.3, seed: Math.random() * 1000 });
    // Träff om spelaren är nära linjen.
    const p = game.player;
    const t = clamp(((p.x - x0) * cx + (p.y - y0) * cy), 0, len);
    const px = x0 + cx * t, py = y0 + cy * t;
    if (Math.abs(p.x - px) < p.w / 2 + 8 && Math.abs(p.y - py) < p.h / 2 + 8) p.takeDamage(e.dmg, game, x0, y0);
    game.onBeam(e, x1, y1);
  },

  // Sköldbäraren blockerar hugg framifrån (inte ovanifrån eller bakifrån).
  blocks(e, fromX, fromY) {
    if (e.type !== 'shield' || e.stun > 0 || e.float > 0) return false;
    const front = (fromX - e.x) * e.facing > 0;
    const above = fromY < e.y - e.h / 2 - 4;
    return front && !above;
  },

  updateBeams(dt) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
  },

  draw(ctx, game) {
    const v = game.view(80);
    const a = this.pool.active;
    const t = game.realTime;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.boss || e.x < v.x0 || e.x > v.x1 || e.y < v.y0 || e.y > v.y1) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.type === 'crab' && e.attached) ctx.rotate(Math.atan2(e.gy, e.gx) - Math.PI / 2);
      ctx.scale(e.type === 'crab' ? e.dir : e.facing, 1);
      if (e.elite) ctx.scale(1.2, 1.2);
      const P = e.flash > 0 ? PAL_FLASH : PAL_GAME;
      ENEMY_ART[e.type](ctx, e, t, P);
      ctx.restore();

      if (e.stun > 0 || e.float > 0) this.drawBound(ctx, e, t);
      if (e.hp < e.maxHp && e.type !== 'crab') {
        const w = Math.max(26, e.w);
        ctx.fillStyle = 'rgba(30,20,15,0.6)';
        ctx.fillRect(e.x - w / 2, e.y - e.h / 2 - 12, w, 4);
        ctx.fillStyle = e.elite ? '#e0b040' : '#d0533a';
        ctx.fillRect(e.x - w / 2, e.y - e.h / 2 - 12, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    // Voidsprens trådar.
    const p = game.player;
    for (let i = 0; i < this.tethers.length; i++) {
      const e = this.tethers[i];
      ctx.strokeStyle = 'rgba(170,90,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      const mx = (e.x + p.x) / 2 + Math.sin(t * 20) * 10, my = (e.y + p.y) / 2 + Math.cos(t * 17) * 10;
      ctx.quadraticCurveTo(mx, my, p.x, p.y);
      ctx.stroke();
    }

    // Blixtar.
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const rng = makeRng(b.seed + Math.floor(t * 30));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, b.life * 5);
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? '#ffe0f0' : 'rgba(255,40,90,0.6)';
        ctx.lineWidth = pass ? 2 : 9;
        ctx.beginPath();
        ctx.moveTo(b.x0, b.y0);
        const n = 10;
        const dx = b.x1 - b.x0, dy = b.y1 - b.y0, len = Math.hypot(dx, dy) || 1;
        for (let k = 1; k <= n; k++) {
          const off = k === n ? 0 : (rng() - 0.5) * 22;
          ctx.lineTo(b.x0 + dx * k / n - dy / len * off, b.y0 + dy * k / n + dx / len * off);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  // Glödande band runt fiender som träffats av en Full Lashing.
  drawBound(ctx, e, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(200,235,255,0.7)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + (k - 0.5) * e.h * 0.4, e.w * 0.8, 5, Math.sin(t * 3 + k) * 0.2, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// --- Konst ---
// Paletter: spelets färger, vit blixt vid träff och bläck för skissboken.
const PAL_GAME = {
  ink: false, skin: '#6d5c55', plate: '#3f6467', plateDark: '#2d4a4d', plateLight: '#6f9a96',
  eye: '#ffb347', cloth: '#7a2e2a', clothLight: '#a3463c', metal: '#b9c3c8', wood: '#5a3d26',
  rock: '#7a6656', rockDark: '#544538', crack: '#ffb347', shadow: '#2b1f33', violet: '#b45cff',
  shell: '#8c7a68', shellDark: '#5e4f42', red: '#ff3d6e', line: 'rgba(0,0,0,0)',
};
const PAL_FLASH = {};
for (const k in PAL_GAME) PAL_FLASH[k] = typeof PAL_GAME[k] === 'string' ? '#ffffff' : PAL_GAME[k];
PAL_FLASH.line = 'rgba(0,0,0,0)';
const PAL_INK = {};
for (const k in PAL_GAME) PAL_INK[k] = typeof PAL_GAME[k] === 'string' ? 'rgba(90,60,30,0.12)' : PAL_GAME[k];
PAL_INK.ink = true;
PAL_INK.line = '#3a2a1a';
PAL_INK.eye = '#3a2a1a';
PAL_INK.crack = 'rgba(90,60,30,0.3)';

// Fyller (och i bläckläge även konturerar) aktuell path.
function inkFill(ctx, P, color) {
  ctx.fillStyle = color;
  ctx.fill();
  if (P.ink) { ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.stroke(); }
}

const ENEMY_ART = {
  crab(ctx, e, t, P) {
    const walk = Math.sin(t * 14 + e.id);
    ctx.strokeStyle = P.ink ? P.line : P.shellDark;
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 5, 2);
      ctx.lineTo(k * 7 + walk * (k === 0 ? -2 : 2), 9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, Math.PI, TAU);
    ctx.lineTo(10, 2); ctx.lineTo(-10, 2);
    inkFill(ctx, P, P.shell);
    ctx.fillStyle = P.shellDark;
    ctx.fillRect(-7, -4, 3, 2); ctx.fillRect(-1, -6, 3, 2); ctx.fillRect(4, -4, 3, 2);
    // Ögonstjälkar och klo.
    ctx.strokeStyle = P.ink ? P.line : P.shellDark;
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(9, -10); ctx.moveTo(8, -3); ctx.lineTo(12, -8); ctx.stroke();
    ctx.fillStyle = P.eye;
    ctx.fillRect(8, -12, 2, 2); ctx.fillRect(11, -10, 2, 2);
    ctx.beginPath(); ctx.arc(12, 0, 3, -1, 2); inkFill(ctx, P, P.shellDark);
  },

  warrior(ctx, e, t, P) {
    const windup = e.state === 1 ? 1 - e.timer / 0.45 : 0;
    const striking = e.state === 2;
    const step = e.onGround ? Math.sin(e.anim * 9) * Math.min(1, Math.abs(e.vx) / 60) : 0.5;
    ctx.lineCap = 'round';
    // Ben.
    ctx.strokeStyle = P.ink ? P.line : P.skin;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-4 + step * 5, 20); ctx.moveTo(3, 6); ctx.lineTo(4 - step * 5, 20); ctx.stroke();
    // Kropp med skalplattor.
    ctx.beginPath(); ctx.rect(-8, -12, 16, 20); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(7, 2); ctx.lineTo(-7, 2); ctx.closePath(); inkFill(ctx, P, P.plate);
    ctx.beginPath(); ctx.ellipse(-8, -11, 5, 4, -0.4, 0, TAU); inkFill(ctx, P, P.plateDark);
    ctx.fillStyle = P.cloth; ctx.fillRect(-8, 2, 16, 6);
    // Huvud med kam.
    ctx.beginPath(); ctx.arc(1, -18, 6, 0, TAU); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.moveTo(-6, -20); ctx.quadraticCurveTo(0, -30, 7, -21); ctx.lineTo(4, -19); ctx.lineTo(-4, -18); ctx.closePath(); inkFill(ctx, P, P.plate);
    ctx.fillStyle = P.eye; ctx.fillRect(3, -19, 3, 2);
    // Arm och yxa.
    const armA = striking ? 0.9 : windup > 0 ? -2.2 * windup : 0.4 + step * 0.2;
    ctx.save();
    ctx.translate(4, -9);
    ctx.rotate(armA);
    ctx.strokeStyle = P.ink ? P.line : P.skin; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 4); ctx.stroke();
    ctx.strokeStyle = P.ink ? P.line : P.wood; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(28, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 4); ctx.quadraticCurveTo(34, -10, 30, -12); ctx.lineTo(24, -2); ctx.closePath(); inkFill(ctx, P, P.metal);
    ctx.beginPath(); ctx.moveTo(24, 4); ctx.quadraticCurveTo(34, 18, 30, 20); ctx.lineTo(24, 10); ctx.closePath(); inkFill(ctx, P, P.metal);
    ctx.restore();
    if (windup > 0 && !P.ink) {
      ctx.fillStyle = 'rgba(255,90,50,' + (0.3 + windup * 0.5) + ')';
      ctx.beginPath(); ctx.arc(0, -40, 3 + windup * 3, 0, TAU); ctx.fill();
    }
  },

  archer(ctx, e, t, P) {
    const drawing = e.state === 1 ? 1 - e.timer / 0.8 : 0;
    const step = e.onGround ? Math.sin(e.anim * 9) * Math.min(1, Math.abs(e.vx) / 60) : 0.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.ink ? P.line : P.skin; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(-3 + step * 5, 19); ctx.moveTo(2, 6); ctx.lineTo(3 - step * 5, 19); ctx.stroke();
    ctx.beginPath(); ctx.rect(-6, -11, 12, 18); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.lineTo(5, -2); ctx.lineTo(-5, -2); ctx.closePath(); inkFill(ctx, P, P.plateLight);
    ctx.fillStyle = P.cloth; ctx.fillRect(-6, 1, 12, 6);
    ctx.beginPath(); ctx.arc(1, -17, 5.5, 0, TAU); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.arc(1, -18, 6, Math.PI, TAU); inkFill(ctx, P, P.plateLight);
    ctx.fillStyle = P.eye; ctx.fillRect(3, -18, 3, 2);
    // Båge, riktad mot siktet.
    ctx.save();
    ctx.translate(4, -8);
    const aim = e.state === 1 ? (e.facing > 0 ? e.aim : Math.PI - e.aim) : 0;
    ctx.rotate(aim);
    ctx.strokeStyle = P.ink ? P.line : P.wood; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(6, 0, 14, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = P.ink ? P.line : '#e8e0d0'; ctx.lineWidth = 1;
    const pull = drawing * 10;
    ctx.beginPath(); ctx.moveTo(6 + Math.cos(-1.2) * 14, Math.sin(-1.2) * 14); ctx.lineTo(6 - pull, 0); ctx.lineTo(6 + Math.cos(1.2) * 14, Math.sin(1.2) * 14); ctx.stroke();
    if (drawing > 0) { ctx.strokeStyle = P.ink ? P.line : '#3b2a1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6 - pull, 0); ctx.lineTo(24 - pull, 0); ctx.stroke(); }
    ctx.restore();
  },

  shield(ctx, e, t, P) {
    const step = e.onGround ? Math.sin(e.anim * 7) * Math.min(1, Math.abs(e.vx) / 50) : 0;
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.ink ? P.line : P.skin; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(-6 + step * 4, 21); ctx.moveTo(4, 8); ctx.lineTo(5 - step * 4, 21); ctx.stroke();
    ctx.beginPath(); ctx.rect(-11, -13, 20, 22); inkFill(ctx, P, P.plateDark);
    ctx.beginPath(); ctx.arc(-1, -19, 7, 0, TAU); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(7, -24); ctx.lineTo(7, -17); ctx.lineTo(-8, -15); ctx.closePath(); inkFill(ctx, P, P.plate);
    ctx.fillStyle = P.eye; ctx.fillRect(2, -20, 3, 2);
    // Den höga skölden framför.
    const lunge = e.state === 2 ? 4 : 0;
    ctx.beginPath();
    ctx.moveTo(10 + lunge, -24); ctx.lineTo(18 + lunge, -20); ctx.lineTo(18 + lunge, 16); ctx.lineTo(10 + lunge, 22); ctx.closePath();
    inkFill(ctx, P, P.shell);
    ctx.strokeStyle = P.ink ? P.line : P.shellDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14 + lunge, -16); ctx.lineTo(14 + lunge, 12); ctx.moveTo(12 + lunge, -2); ctx.lineTo(17 + lunge, -6); ctx.stroke();
    if (e.turnTimer > 0 && !P.ink) {
      ctx.fillStyle = 'rgba(255,255,255,' + e.turnTimer + ')';
      ctx.font = 'bold 14px Georgia';
      ctx.fillText('?', -4, -32);
    }
  },

  thunder(ctx, e, t, P) {
    const charging = e.state === 1;
    ctx.beginPath();
    ctx.moveTo(-9, 20); ctx.lineTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(10, 20);
    ctx.closePath();
    inkFill(ctx, P, P.cloth);
    ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(6, -10); ctx.lineTo(3, 0); ctx.lineTo(-3, 0); ctx.closePath(); inkFill(ctx, P, P.plateDark);
    ctx.beginPath(); ctx.arc(0, -16, 6, 0, TAU); inkFill(ctx, P, P.skin);
    ctx.beginPath(); ctx.moveTo(-7, -14); ctx.lineTo(0, -28); ctx.lineTo(7, -14); ctx.closePath(); inkFill(ctx, P, P.clothLight);
    ctx.fillStyle = P.ink ? P.eye : P.red; ctx.fillRect(2, -17, 3, 2);
    // Händer med knastrande energi.
    const hx = charging ? 12 : 8, hy = charging ? -12 : -2;
    ctx.strokeStyle = P.ink ? P.line : P.skin; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(hx, hy); ctx.stroke();
    if (!P.ink && (charging || Math.sin(t * 7 + e.id) > 0.6)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const k = charging ? 1 - e.timer / 1.15 : 0.3;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6 + k * 14);
      g.addColorStop(0, 'rgba(255,220,240,1)');
      g.addColorStop(0.4, 'rgba(255,40,100,0.8)');
      g.addColorStop(1, 'rgba(255,40,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(hx - 20, hy - 20, 40, 40);
      ctx.restore();
    }
    if (charging && !P.ink) {
      // Siktlinje som blir tydligare.
      const k = 1 - e.timer / 1.15;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(e.facing > 0 ? e.aim : Math.PI - e.aim);
      ctx.strokeStyle = 'rgba(255,60,110,' + (0.15 + k * 0.4) + ')';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(700, 0); ctx.stroke();
      ctx.restore();
    }
  },

  hover(ctx, e, t, P) {
    const diving = e.state === 2;
    // Långa band som fladdrar bakom.
    ctx.strokeStyle = P.ink ? P.line : P.clothLight;
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-4, -6 + k * 6);
      for (let s = 1; s <= 6; s++) {
        ctx.lineTo(-4 - s * 7, -6 + k * 6 + Math.sin(t * 8 - s * 0.9 + k) * (3 + s) + (diving ? 0 : s * 1.5));
      }
      ctx.stroke();
    }
    // Hinnvingar.
    ctx.beginPath();
    ctx.moveTo(-2, -10); ctx.quadraticCurveTo(-20, -34 + Math.sin(t * 6) * 6, -30, -8); ctx.quadraticCurveTo(-14, -10, -2, -4);
    inkFill(ctx, P, P.ink ? 'rgba(90,60,30,0.08)' : 'rgba(230,200,170,0.35)');
    ctx.beginPath();
    ctx.moveTo(-7, 18); ctx.lineTo(-5, -10); ctx.lineTo(5, -10); ctx.lineTo(4, 14); ctx.closePath();
    inkFill(ctx, P, P.cloth);
    ctx.beginPath(); ctx.arc(0, -16, 6, 0, TAU); inkFill(ctx, P, P.plateLight);
    ctx.fillStyle = P.ink ? P.eye : P.shadow; ctx.fillRect(-1, -18, 6, 3); // mask
    ctx.fillStyle = P.eye; ctx.fillRect(2, -17, 2, 1);
    // Spjut.
    ctx.save();
    ctx.translate(2, -6);
    if (e.state >= 1 && e.state <= 2) ctx.rotate(e.facing > 0 ? e.aim : Math.PI - e.aim);
    else ctx.rotate(0.3);
    ctx.strokeStyle = P.ink ? P.line : P.wood; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, -4); ctx.lineTo(40, 0); ctx.lineTo(30, 4); ctx.closePath(); inkFill(ctx, P, P.metal);
    ctx.restore();
  },

  leech(ctx, e, t, P) {
    // Rökig kula med violett kärna och slingrande trådar.
    ctx.strokeStyle = P.ink ? P.line : 'rgba(60,20,90,0.8)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + t * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.quadraticCurveTo(Math.cos(a + 0.5) * 16, Math.sin(a + 0.5) * 16, Math.cos(a + 0.2) * (18 + Math.sin(t * 5 + k) * 4), Math.sin(a + 0.2) * (18 + Math.sin(t * 5 + k) * 4));
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); inkFill(ctx, P, P.shadow);
    if (!P.ink) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
      g.addColorStop(0, 'rgba(230,180,255,0.9)');
      g.addColorStop(1, 'rgba(140,60,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.strokeStyle = P.line; ctx.stroke();
    }
  },

  brute(ctx, e, t, P) {
    const crouch = e.state === 1 ? 6 : 0;
    const step = e.onGround ? Math.sin(e.anim * 5) * Math.min(1, Math.abs(e.vx) / 40) : 0;
    ctx.translate(0, crouch);
    // Ben av sten.
    ctx.beginPath(); ctx.rect(-16 + step * 3, 10, 12, 18); inkFill(ctx, P, P.rockDark);
    ctx.beginPath(); ctx.rect(4 - step * 3, 10, 12, 18); inkFill(ctx, P, P.rockDark);
    // Kropp av block.
    ctx.beginPath();
    ctx.moveTo(-22, 12); ctx.lineTo(-24, -14); ctx.lineTo(-10, -26); ctx.lineTo(14, -24); ctx.lineTo(24, -8); ctx.lineTo(20, 14);
    ctx.closePath();
    inkFill(ctx, P, P.rock);
    // Glödande sprickor.
    ctx.strokeStyle = P.crack; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-6, -6); ctx.lineTo(-10, 6); ctx.moveTo(4, -20); ctx.lineTo(8, -8); ctx.lineTo(16, -4); ctx.stroke();
    // Huvud och ögon.
    ctx.beginPath(); ctx.rect(4, -36, 14, 12); inkFill(ctx, P, P.rockDark);
    ctx.fillStyle = P.crack; ctx.fillRect(12, -32, 4, 3);
    // Arm.
    ctx.beginPath(); ctx.rect(14, -14, 12, 26); inkFill(ctx, P, P.rockDark);
  },
};
