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

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const s = this.dpr * this.zoom;
    ctx.setTransform(s, 0, 0, s, this.w * this.dpr / 2 - this.cam.x * s, this.h * this.dpr / 2 - this.cam.y * s);
    this.drawBackground(ctx);
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
};

window.addEventListener('load', () => Game.init());
