'use strict';
// Spel-loop med fast tidssteg, tillstånd och samordning av alla system.

const Game = {
  glCanvas: null,
  hud: null,
  hctx: null,
  w: 1, h: 1, dpr: 1,
  renderScale: 1,
  state: 'loading',
  time: 0,
  realTime: 0,
  tick: 0,
  acc: 0,
  last: 0,
  fps: 60,
  player: new Player(),
  env: null,
  stormDark: 0,
  level: 1,
  _aim: V3.create(),
  _aimTick: -1,
  _c: V3.create(),
  _p2: new Float32Array(2),

  init() {
    this.glCanvas = document.getElementById('gl');
    this.hud = document.getElementById('hud');
    this.hctx = this.hud.getContext('2d');
    if (!Renderer.init(this.glCanvas)) {
      document.getElementById('nogl').hidden = false;
      return;
    }
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init(this.glCanvas);
    Input.wantLock = true;
    this.env = this.makeEnv(THEMES.plains);
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
    Renderer.resize(this.w, this.h, this.dpr * this.renderScale);
    this.hud.width = Math.floor(this.w * this.dpr);
    this.hud.height = Math.floor(this.h * this.dpr);
    Camera.aspect = this.w / this.h;
  },

  makeEnv(theme) {
    const s = theme.sky;
    const sd = V3.normalize(V3.create(), theme.sunDir);
    return {
      sunDir: sd,
      sunCol: Float32Array.from(s.sun),
      skyTop: Float32Array.from(s.top), skyHorizon: Float32Array.from(s.horizon), skyGround: Float32Array.from(s.ground),
      cloudCol: Float32Array.from(s.cloud),
      ambientSky: Float32Array.from(theme.ambientSky), ambientGround: Float32Array.from(theme.ambientGround),
      fog: theme.fog, storm: 0, chasmFloor: CHASM_FLOOR,
      retract: new Float32Array([0, 0, 0, 6]), retractAll: 0,
      bloom: 0.9, exposure: 1.0, grade: Float32Array.from([1.03, 1.0, 0.95]), vignette: 0.9,
      overlay: new Float32Array(4), shadowRange: 60,
      base: theme,
    };
  },

  startStage(level, seed) {
    this.level = level;
    World.generate({ level, length: 520 + level * 40, theme: THEMES.plains }, seed);
    this.time = 0;
    this.tick = 0;
    const p = this.player;
    p.reset();
    const st = World.start;
    p.spawnAt(st.cx, st.y1 + 0.05, st.cz);
    p.light = 100;
    // Titta österut (mot målet).
    V3.set(p.facing, 1, 0, 0);
    Camera.reset(V3.create(0, 1, 0), V3.create(1, 0, 0));
    Input.clearQueue();
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
      while (this.acc >= STEP && steps < 6 && this.state === 'playing') {
        this.update(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 6) this.acc = 0;
      const look = Input.takeLook(frame);
      Camera.look(look.dx, look.dy);
    }
    Camera.update(frame, this.player.pos, V3.scale(this._c, this.player.g, -1), null);
    this.render();
    requestAnimationFrame((tt) => this.loop(tt));
  },

  update(dt) {
    this.time += dt;
    this.tick++;
    this.player.update(dt, this);
  },

  // Riktning från spelaren mot det man siktar på (kamerans mittpunkt).
  aimDirection(p) {
    if (this._aimTick === this.tick) return this._aim;
    this._aimTick = this.tick;
    const c = Camera.pos, f = Camera.fwd;
    const d = World.raycast(c[0], c[1], c[2], f[0], f[1], f[2], 220, 1);
    const tx = c[0] + f[0] * d, ty = c[1] + f[1] * d, tz = c[2] + f[2] * d;
    const pc = p.center(this._c);
    V3.set(this._aim, tx - pc[0], ty - pc[1], tz - pc[2]);
    if (V3.len(this._aim) < 2) V3.copy(this._aim, f);
    V3.normalize(this._aim, this._aim);
    return this._aim;
  },

  wind() { return 0; },

  render() {
    const p = this.player;
    const env = this.env;
    env.retract[0] = p.pos[0]; env.retract[1] = p.pos[1]; env.retract[2] = p.pos[2];
    Renderer.begin(Camera, env, this.realTime);
    World.draw(Camera);
    p.draw(this);
    // Stormlight lyser upp omgivningen.
    if (p.light > 1) {
      const c = p.center(this._c);
      const k = p.light / p.stats.maxLight;
      Renderer.light(c[0], c[1], c[2], 0.5 * k + 0.2, 0.7 * k + 0.25, 1.0 * k + 0.3, 6 + k * 6);
    }
    Renderer.render(p.pos);
    this.drawHud();
  },

  drawHud() {
    const ctx = this.hctx, w = this.w, h = this.h, p = this.player;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Sikte.
    ctx.strokeStyle = 'rgba(235,245,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 5, 0, TAU);
    ctx.moveTo(w / 2 - 12, h / 2); ctx.lineTo(w / 2 - 8, h / 2);
    ctx.moveTo(w / 2 + 8, h / 2); ctx.lineTo(w / 2 + 12, h / 2);
    ctx.stroke();
    // Liv och Stormlight.
    ctx.fillStyle = 'rgba(20,16,12,0.5)';
    ctx.fillRect(16, 16, 230, 34);
    ctx.fillStyle = '#d0533a';
    ctx.fillRect(20, 20, 222 * p.hp / p.stats.maxHp, 10);
    ctx.fillStyle = '#e4f4ff';
    ctx.fillRect(20, 35, 222 * p.light / p.stats.maxLight, 10);
    // Gravitationskompass: pil som visar Lashingens riktning relativt kameran.
    const gx = V3.dot(p.g, Camera.right), gy = -V3.dot(p.g, Camera.up), gz = V3.dot(p.g, Camera.fwd);
    const cx = w - 60, cy = h - 60;
    ctx.fillStyle = 'rgba(20,16,12,0.45)';
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.lashed ? '#bfe6ff' : 'rgba(240,230,210,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + gx * 26, cy + gy * 26); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(cx + gx * 26, cy + gy * 26, 4 + gz * 2, 0, TAU); ctx.fill();
    for (let i = 0; i < p.strength; i++) { ctx.beginPath(); ctx.arc(cx - 12 + i * 12, cy + 44, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.font = '12px Georgia';
    ctx.fillText(Math.round(this.fps) + ' fps', 16, h - 16);
  },

  // --- Händelser (fylls på i senare steg) ---
  onLash() {},
  onLashFail() {},
  onLashReset() {},
  onLightOut() {},
  onDash() {},
  onJump() {},
  onSlam() {},
  onPlayerHurt() {},
  onPlayerDeath() {},
};

window.addEventListener('load', () => Game.init());
