'use strict';
// Spel-loop med fast tidssteg, kamera, tillstånd och samordning av alla system.

const Game = {
  canvas: null,
  ctx: null,
  w: 0, h: 0, dpr: 1, zoom: 1,
  cam: { x: 0, y: 0 },
  state: 'playing',
  time: 0,
  realTime: 0,
  tick: 0,
  acc: 0,
  last: 0,
  fps: 60,
  player: new Player(),
  touchMove: null,
  stormDark: 0,
  banner: null,
  mods: { hp: 1, dmg: 1, speed: 1 },
  stats: null,
  _mw: { x: 0, y: 0 },
  _view: { x0: 0, y0: 0, x1: 0, y1: 0 },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init(this.canvas);
    this.startStage(1, 12345);
    requestAnimationFrame((t) => { this.last = t; this.loop(t); });
  },

  setState(s) {
    this.state = s;
    document.body.setAttribute('data-state', s);
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    // Visa ungefär lika mycket av banan på alla skärmar.
    this.zoom = clamp(Math.min(this.w / 1100, this.h / 640), 0.5, 1.4);
  },

  startStage(level, seed) {
    World.generate(level, seed);
    Effects.reset();
    Enemies.reset();
    Blade.reset();
    Pickups.reset();
    Input.clearQueue();
    this.banner = null;
    this.stormDark = 0;
    this.stats = { kills: 0, damage: 0, taken: 0, wealth: 0, gemhearts: 0, stormTime: 0 };
    for (const s of World.sphereSpots) Pickups.spawnSphere(s.x, s.y, Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0, !s.dun, false);
    for (const h of World.herbSpots) { const o = Pickups.spawnItem('knobweed', h.x, h.y); o.settled = true; o.vx = o.vy = 0; }
    Storm.reset(rand(55, 75), 105);
    this.mods = { hp: 1 + (level - 1) * 0.25, dmg: 1 + (level - 1) * 0.15, speed: 1 + Math.min(0.25, (level - 1) * 0.05) };
    for (const s of World.spawns) Enemies.spawn(s.type, s.x, s.y, this.mods, s.elite);
    this.time = 0;
    this.tick = 0;
    const p = this.player;
    p.reset();
    const sx = 6 * TILE;
    p.spawnAt(sx, World.surfaceRow(6) * TILE - 30);
    p.light = 100;
    this.cam.x = p.x;
    this.cam.y = p.y;
    this.setState('playing');
  },

  loop(t) {
    let frame = (t - this.last) / 1000;
    this.last = t;
    if (frame > 0.25) frame = 0.25;
    if (frame < 0) frame = 0;
    this.realTime += frame;
    if (frame > 0) this.fps += (1 / frame - this.fps) * 0.05;
    if (this.state === 'playing') {
      this.acc += frame;
      let steps = 0;
      while (this.acc >= STEP && steps < 8 && this.state === 'playing') {
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
    this.tick++;
    const p = this.player;
    p.update(dt, this);
    Blade.update(dt, this);
    Enemies.update(dt, this);
    Enemies.updateBeams(dt);
    Projectiles.update(dt, this);
    Pickups.update(dt, this);
    Storm.update(dt, this);
    Storm.affectPlayer(p, dt, this);
    World.updateDecor(dt, this);
    const dark = Storm.warnProgress() * (Storm.contains(this.cam.x) || Storm.state === 'warning' ? 1 : 0.5);
    this.stormDark += (dark - this.stormDark) * Math.min(1, dt * 1.5);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    Effects.update(dt);
    this.updateCamera(dt);
  },

  updateCamera(dt) {
    const p = this.player;
    // Titta lite framåt i rörelseriktningen.
    const tx = p.x + clamp(p.vx * 0.25, -160, 160);
    const ty = p.y + clamp(p.vy * 0.2, -120, 140) - 40;
    const k = 1 - Math.exp(-6 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const hw = this.w / 2 / this.zoom, hh = this.h / 2 / this.zoom;
    this.cam.x = clamp(this.cam.x, hw, Math.max(hw, World.width - hw));
    this.cam.y = clamp(this.cam.y, hh - 400, Math.max(hh, World.height - hh));
  },

  // Synligt område i världskoordinater (återanvänder samma objekt).
  view(margin) {
    const v = this._view;
    const hw = this.w / 2 / this.zoom + margin, hh = this.h / 2 / this.zoom + margin;
    v.x0 = this.cam.x - hw; v.x1 = this.cam.x + hw;
    v.y0 = this.cam.y - hh; v.y1 = this.cam.y + hh;
    return v;
  },

  mouseWorld() {
    const m = this._mw;
    m.x = (Input.mouse.x - this.w / 2) / this.zoom + this.cam.x;
    m.y = (Input.mouse.y - this.h / 2) / this.zoom + this.cam.y;
    return m;
  },

  toScreen(x, y, out) {
    out.x = (x - this.cam.x) * this.zoom + this.w / 2;
    out.y = (y - this.cam.y) * this.zoom + this.h / 2;
    return out;
  },

  // Vind från urstormen (läggs till i steg 3).
  wind(b) { return Storm.wind(b); },
  inStorm(x) { return Storm.contains(x); },

  showBanner(text, sub, color, time) {
    this.banner = { text, sub: sub || '', color: color || '#f3e6c8', t: time || 3.5, max: time || 3.5 };
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    World.drawBackground(ctx, this);

    const s = this.dpr * this.zoom;
    const cx = this.cam.x + Effects.shakeX, cy = this.cam.y + Effects.shakeY;
    ctx.setTransform(s, 0, 0, s, this.w * this.dpr / 2 - cx * s, this.h * this.dpr / 2 - cy * s);
    World.drawTiles(ctx, this);
    World.drawDecor(ctx, this);
    Pickups.draw(ctx, this);
    Enemies.draw(ctx, this);
    Projectiles.draw(ctx, this);
    this.player.draw(ctx, this);
    Blade.drawInHand(ctx, this);
    Blade.draw(ctx, this);
    Effects.draw(ctx, this);
    Storm.drawWorld(ctx, this);
    Effects.drawTexts(ctx);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    Storm.drawOverlay(ctx, this);
    this.drawDebugHud(ctx);
  },

  drawDebugHud(ctx) {
    const p = this.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 10, 220, 40);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(14, 14, 212 * p.hp / p.stats.maxHp, 12);
    ctx.fillStyle = '#dff3ff';
    ctx.fillRect(14, 32, 212 * p.light / p.stats.maxLight, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(Storm.state + ' ' + Math.ceil(Storm.timer) + (p.inShelter ? ' lä' : ''), 14, 64);
    const b = this.banner;
    if (b) {
      ctx.globalAlpha = Math.min(1, (b.max - b.t) * 3, b.t * 1.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = b.color;
      ctx.font = 'bold 34px Georgia';
      ctx.fillText(b.text, this.w / 2, this.h * 0.28);
      ctx.font = 'italic 16px Georgia';
      ctx.fillText(b.sub, this.w / 2, this.h * 0.28 + 30);
      ctx.globalAlpha = 1;
    }
  },

  // Hjälper siktet mot en fiende i ungefär rätt riktning.
  aimAssist(angle, range) {
    const p = this.player;
    let best = null, bestScore = 1e9;
    const list = Enemies.list;
    const maxDiff = this.touchMove ? 1.2 : 0.5;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > range + e.w / 2) continue;
      const diff = Math.abs(angleDiff(Math.atan2(dy, dx), angle));
      if (diff > maxDiff) continue;
      const score = d + diff * 120;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : angle;
  },

  // All skada på fiender går hit. Returnerar faktisk skada.
  damageEnemy(e, dmg, kx, ky, source) {
    if (e.dead) return 0;
    const p = this.player;
    if ((source === 'blade' || source === 'spear') && Enemies.blocks(e, p.x, p.y)) {
      this.onBlocked(e);
      p.vx += (p.x < e.x ? -1 : 1) * 260;
      return 0;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    e.alert = true;
    const w = e.def.weight * (e.boss ? 20 : 1);
    e.vx += kx / w;
    e.vy += ky / w;
    if (e.type === 'crab' && (Math.abs(kx) + Math.abs(ky)) > 50) e.attached = false;
    if (e.type === 'leech') { e.state = 1; e.timer = 1.2; }
    this.stats.damage += dmg;
    this.onEnemyHit(e, dmg, source);
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  },

  killEnemy(e) {
    e.dead = true;
    this.stats.kills++;
    this.onEnemyKilled(e);
  },

  // --- Händelser ---
  onSwing() {},
  onCarve() { Effects.shake(0.08); },
  onParry(b) { Effects.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 0.8, '#ffe9b0', 8, 260); },
  onBlocked(e) {
    Effects.sparks(e.x + e.facing * 16, e.y - 6, e.facing > 0 ? 0 : Math.PI, 0.9, '#ffd27a', 10, 300);
    Effects.text(e.x, e.y - e.h / 2 - 16, 'Blockerat', '#ffd27a', 13);
  },
  onEnemyAlert() {},
  onEnemyStrike() {},
  onEnemyShoot() {},
  onThunderCharge() {},
  onBeam(e, x, y) { Effects.sparks(x, y, 0, Math.PI, '#ff4d7a', 10, 200); Effects.shake(0.12); },
  onBruteSlam(e) { Effects.shake(0.35); Effects.debris(e.x, e.y + e.h / 2, '#9a7a5a', 20, 300); },
  onEnemyHit(e, dmg) {
    Effects.sparks(e.x, e.y, rand(0, TAU), Math.PI, '#e8f6ff', 5, 220);
    Effects.text(e.x, e.y - e.h / 2 - 6, String(Math.round(dmg)), '#fff4d6', 14);
  },
  onDrawLight(o) { Effects.burst(o.x, o.y, GEMS[o.gem].color, 5, 60, 0.4, 2); },
  onSphereTaken(o) { this.stats.wealth += o.value; },
  onItem(o) {
    const p = this.player;
    if (o.kind === 'gemheart') {
      this.stats.gemhearts++;
      p.addLight(p.stats.maxLight);
      Effects.burst(o.x, o.y, '#7dffb5', 30, 260, 0.9, 3);
      this.showBanner('Gemheart', 'Stormlight fyller dig', '#9dffc8', 2.5);
    } else if (o.kind === 'knobweed') {
      p.hp = Math.min(p.stats.maxHp, p.hp + 35);
      Effects.text(p.x, p.y - 30, '+35', '#9be37a', 16);
    }
  },
  onStormWarning() { this.showBanner('Highstormen närmar sig!', 'Sök lä på klippornas västra sida', '#dbe7ff', 4); },
  onStormStart() { Effects.shake(0.3); },
  onStormEnd() { this.showBanner('Stormen har passerat', 'Sfärerna glöder igen', '#f3e6c8', 3); },
  onLightning() { Effects.shake(0.15); },
  onEnemyKilled(e) {
    Pickups.dropFromEnemy(e);
    Effects.burst(e.x, e.y, 'rgba(230,245,255,0.9)', 16, 220, 0.6, 3);
    Effects.debris(e.x, e.y, e.type === 'brute' ? '#7a6656' : '#6d5c55', e.type === 'brute' ? 24 : 10, 220);
  },

  onLash(p, reset) {
    Effects.burst(p.x, p.y, 'rgba(220,240,255,0.9)', reset ? 6 : 14, 180, 0.4, 3);
  },
  onLashFail() {},
  onLightOut() {},
  onJump() {},
  onSlam(p, speed) {
    Effects.debris(p.x - p.gx * 16, p.y - p.gy * 16 + 16 * p.gy, '#b88a62', 14, speed * 0.4);
    Effects.shake(Math.min(0.6, speed / 2000));
  },
  onPlayerHurt() {},
  onPlayerDeath() {},
};

window.addEventListener('load', () => Game.init());
