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
    World.updateDecor(dt, this);
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
  wind() { return 0; },
  inStorm() { return false; },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    World.drawBackground(ctx, this);

    const s = this.dpr * this.zoom;
    const cx = this.cam.x + Effects.shakeX, cy = this.cam.y + Effects.shakeY;
    ctx.setTransform(s, 0, 0, s, this.w * this.dpr / 2 - cx * s, this.h * this.dpr / 2 - cy * s);
    World.drawTiles(ctx, this);
    World.drawDecor(ctx, this);
    this.player.draw(ctx, this);
    Effects.draw(ctx, this);
    Effects.drawTexts(ctx);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
  },

  // --- Händelser ---
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
