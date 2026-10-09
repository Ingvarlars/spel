'use strict';
// Spel-loop med fast tidssteg, kamera, tillstånd och samordning av alla system.

const Game = {
  canvas: null,
  ctx: null,
  w: 0, h: 0, dpr: 1, zoom: 1,
  cam: { x: WORLD_W / 2, y: WORLD_H / 2 },
  state: 'playing',
  time: 0,
  realTime: 0,
  acc: 0,
  last: 0,
  fps: 60,
  player: new Player(),
  weapons: [],
  vt: { s: 1, tx: 0, ty: 0 }, // aktuell vy-transform
  stats: null,
  spawnTimer: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init();
    this.newGame();
    requestAnimationFrame((t) => { this.last = t; this.loop(t); });
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    // Zooma ut på små skärmar så att man ser lika mycket av banan.
    this.zoom = clamp(Math.min(this.w, this.h) / 720, 0.55, 1);
  },

  newGame() {
    this.time = 0;
    this.player.reset();
    Enemies.reset();
    Weapons.reset();
    this.weapons = [];
    this.addWeapon('blaster');
    this.stats = { kills: 0, damage: 0 };
    this.spawnTimer = 0;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.state = 'playing';
  },

  loop(t) {
    let frame = (t - this.last) / 1000;
    this.last = t;
    if (frame > 0.25) frame = 0.25; // t.ex. efter att fliken varit dold
    this.realTime += frame;
    if (frame > 0) this.fps += (1 / frame - this.fps) * 0.05;

    if (this.state === 'playing') {
      this.acc += frame;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        this.update(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 8) this.acc = 0;
    }
    this.render();
    requestAnimationFrame((tt) => this.loop(tt));
  },

  update(dt) {
    this.time += dt;
    const p = this.player;
    p.update(dt, this);

    // Tillfällig spawner (ersätts av vågsystemet i levels.js).
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && Enemies.list.length < 300) {
      this.spawnTimer = 0.35;
      const sp = this.spawnPoint();
      Enemies.spawn(pick(['chaser', 'chaser', 'dasher', 'shooter', 'tank', 'splitter']), sp.x, sp.y);
    }

    Enemies.update(dt, this);
    Weapons.update(dt, this);

    // Kameran följer spelaren mjukt och hålls inom banan.
    const k = 1 - Math.exp(-8 * dt);
    this.cam.x += (p.x - this.cam.x) * k;
    this.cam.y += (p.y - this.cam.y) * k;
    const hw = this.w / 2 / this.zoom, hh = this.h / 2 / this.zoom;
    this.cam.x = WORLD_W > hw * 2 ? clamp(this.cam.x, hw - 80, WORLD_W - hw + 80) : WORLD_W / 2;
    this.cam.y = WORLD_H > hh * 2 ? clamp(this.cam.y, hh - 80, WORLD_H - hh + 80) : WORLD_H / 2;
  },

  // Synligt område i världskoordinater (med marginal).
  view(margin) {
    const hw = this.w / 2 / this.zoom + margin, hh = this.h / 2 / this.zoom + margin;
    return { x0: this.cam.x - hw, y0: this.cam.y - hh, x1: this.cam.x + hw, y1: this.cam.y + hh };
  },

  // Slumpad punkt strax utanför skärmen men inom banan.
  spawnPoint() {
    const p = this.player;
    const dist = Math.hypot(this.w, this.h) / 2 / this.zoom + 60;
    const pt = this._sp || (this._sp = { x: 0, y: 0 });
    for (let tries = 0; tries < 8; tries++) {
      const a = rand(0, TAU);
      pt.x = clamp(p.x + Math.cos(a) * dist, 30, WORLD_W - 30);
      pt.y = clamp(p.y + Math.sin(a) * dist, 30, WORLD_H - 30);
      if (dist2(pt.x, pt.y, p.x, p.y) > 350 * 350) break;
    }
    return pt;
  },

  addWeapon(id) {
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      if (w.id === id) { w.level = Math.min(w.level + 1, WEAPONS[id].levels.length); return w; }
    }
    const w = { id, level: 1, timer: 0.3 };
    this.weapons.push(w);
    return w;
  },

  weaponLevel(id) {
    for (let i = 0; i < this.weapons.length; i++) if (this.weapons[i].id === id) return this.weapons[i].level;
    return 0;
  },

  // All skada på fiender går hit: kritiska träffar, knuff och död.
  damageEnemy(e, base, fromX, fromY, knock) {
    if (e.dead) return;
    const st = this.player.stats;
    const crit = Math.random() < st.crit;
    const dmg = base * st.damage * (crit ? 2 : 1);
    e.hp -= dmg;
    e.flash = 0.07;
    this.stats.damage += dmg;
    if (knock > 0) {
      const dx = e.x - fromX, dy = e.y - fromY, d = Math.hypot(dx, dy) || 1;
      const k = knock / e.mass;
      e.kbx += (dx / d) * k;
      e.kby += (dy / d) * k;
    }
    this.onEnemyHit(e, dmg, crit);
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    e.dead = true;
    this.stats.kills++;
    if (e.type === 'splitter' && e.gen > 0) {
      for (let i = 0; i < 2; i++) {
        const c = Enemies.spawn('splitter', e.x + rand(-8, 8), e.y + rand(-8, 8), e.mods, e.gen - 1);
        const a = rand(0, TAU);
        c.kbx = Math.cos(a) * 220; c.kby = Math.sin(a) * 220;
      }
    }
    this.onEnemyKilled(e);
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const s = this.dpr * this.zoom;
    const vt = this.vt;
    vt.s = s;
    vt.tx = this.w * this.dpr / 2 - this.cam.x * s;
    vt.ty = this.h * this.dpr / 2 - this.cam.y * s;
    ctx.setTransform(s, 0, 0, s, vt.tx, vt.ty);
    this.drawBackground(ctx);
    Enemies.draw(ctx, this, vt);
    ctx.globalCompositeOperation = 'lighter';
    Weapons.draw(ctx, this, vt);
    ctx.globalCompositeOperation = 'source-over';
    this.player.draw(ctx, this.realTime);
  },

  drawBackground(ctx) {
    const v = this.view(0);
    const gs = 80;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(63, 246, 255, 0.07)';
    ctx.beginPath();
    const x0 = Math.max(0, Math.floor(v.x0 / gs) * gs), x1 = Math.min(WORLD_W, v.x1);
    const y0 = Math.max(0, Math.floor(v.y0 / gs) * gs), y1 = Math.min(WORLD_H, v.y1);
    for (let x = x0; x <= x1; x += gs) { ctx.moveTo(x, Math.max(0, v.y0)); ctx.lineTo(x, Math.min(WORLD_H, v.y1)); }
    for (let y = y0; y <= y1; y += gs) { ctx.moveTo(Math.max(0, v.x0), y); ctx.lineTo(Math.min(WORLD_W, v.x1), y); }
    ctx.stroke();

    // Större rutnät med starkare linjer var 400:e pixel.
    ctx.strokeStyle = 'rgba(176, 75, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const big = 400;
    for (let x = Math.max(0, Math.floor(v.x0 / big) * big); x <= x1; x += big) { ctx.moveTo(x, Math.max(0, v.y0)); ctx.lineTo(x, Math.min(WORLD_H, v.y1)); }
    for (let y = Math.max(0, Math.floor(v.y0 / big) * big); y <= y1; y += big) { ctx.moveTo(Math.max(0, v.x0), y); ctx.lineTo(Math.min(WORLD_W, v.x1), y); }
    ctx.stroke();

    // Banans kant.
    ctx.save();
    ctx.strokeStyle = '#ff3fa4';
    ctx.shadowColor = '#ff3fa4';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  },

  // Händelser från spelaren (fylls på i senare steg).
  onDash() {},
  onShieldBlock() {},
  onPlayerHurt() {},
  onPlayerDeath() {},
  onShoot() {},
  onEnemyShoot() {},
  onEnemyHit() {},
  onEnemyKilled() {},
  onExplosion() {},
  onMissileTrail() {},
};

window.addEventListener('load', () => Game.init());
