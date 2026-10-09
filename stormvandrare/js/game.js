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
  mods: { hp: 1, dmg: 1, speed: 1 },
  stats: null,
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
    Effects.reset();
    Enemies.reset();
    Blade.reset();
    this.stats = { kills: 0, damage: 0, taken: 0, wealth: 0, gemhearts: 0, stormTime: 0 };
    this.mods = { hp: 1 + (level - 1) * 0.25, dmg: 1 + (level - 1) * 0.15, speed: 1 + Math.min(0.25, (level - 1) * 0.05) };
    for (const s of World.spawns) Enemies.spawn(s.type, s.x, s.y, s.z, this.mods, s.elite, s.home);
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
    Blade.update(dt, this);
    Enemies.update(dt, this);
    Projectiles.update(dt, this);
    Effects.update(dt);
  },

  // Vrider en riktning mot närmaste fiende inom räckvidd och vinkel.
  aimAssist(dir, range, cosLimit) {
    const pc = this.player.center(this._c);
    let best = null, bestScore = -1e9;
    const ec = this._ec || (this._ec = V3.create());
    for (const e of Enemies.list) {
      if (e.dead) continue;
      Enemies.center(e, ec);
      const dx = ec[0] - pc[0], dy = ec[1] - pc[1], dz = ec[2] - pc[2], d = Math.hypot(dx, dy, dz);
      if (d > range + e.r || d < 0.01) continue;
      const c = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / d;
      if (c < cosLimit) continue;
      const score = c * 2 - d / range;
      if (score > bestScore) { bestScore = score; best = V3.set(this._aa || (this._aa = V3.create()), dx / d, dy / d, dz / d); }
    }
    return best || dir;
  },

  // All skada på fiender går hit. dir = knuffriktning, knock = styrka.
  damageEnemy(e, dmg, dir, knock, source) {
    if (e.dead) return 0;
    const p = this.player;
    if ((source === 'blade' || source === 'spear') && Enemies.blocks(e, p.center(this._c))) {
      this.onBlocked(e);
      const pc = p.center(this._c);
      V3.addScaled(p.vel, p.vel, V3.normalize(this._c, V3.sub(this._c, pc, e.pos)), 8);
      return 0;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    e.alert = true;
    if (dir && knock) {
      const w = e.def.weight * (e.boss ? 25 : 1);
      V3.addScaled(e.vel, e.vel, dir, knock / w);
      if (!e.def.flying) e.vel[1] += 3 / w;
    }
    if (e.type === 'leech') { e.state = 1; e.timer = 1.3; }
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
    Enemies.draw(this);
    Projectiles.draw(this);
    p.draw(this);
    Blade.draw();
    Effects.draw();
    // Stormlight lyser upp omgivningen.
    if (p.light > 1) {
      const c = p.center(this._c);
      const k = p.light / p.stats.maxLight;
      Renderer.light(c[0], c[1], c[2], 0.12 + 0.18 * k, 0.17 + 0.25 * k, 0.25 + 0.35 * k, 4 + k * 4);
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
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(this.fps) + ' fps', 16, h - 16);
    // Livmätare över skadade fiender.
    const o = this._p2;
    for (const e of Enemies.list) {
      if (e.dead || e.boss || e.hp >= e.maxHp) continue;
      if (!Camera.project(e.pos[0], e.pos[1] + e.h + 0.4, e.pos[2], w, h, o)) continue;
      const d = V3.dist(Camera.pos, e.pos);
      if (d > 45) continue;
      const bw = clamp(60 - d, 24, 56);
      ctx.fillStyle = 'rgba(25,18,12,0.65)';
      ctx.fillRect(o[0] - bw / 2, o[1], bw, 5);
      ctx.fillStyle = e.elite ? '#e0b040' : '#d0533a';
      ctx.fillRect(o[0] - bw / 2, o[1], bw * Math.max(0, e.hp / e.maxHp), 5);
    }
    Effects.drawFloats(ctx, w, h);
  },

  // --- Händelser (fylls på i senare steg) ---
  onLash(p) {
    const c = p.center(this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 18, 5, 0.5, 0.1);
  },
  onLashFail() {},
  onLashReset() {},
  onLightOut() {},
  onDash(p) {
    const c = p.center(this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 24, 6, 0.4, 0.1);
  },
  onJump() {},
  onSlam(p, speed) {
    Effects.dust(p.pos[0], p.pos[1], p.pos[2], 16, 2.5);
    Effects.shake(Math.min(0.7, speed / 60));
    // Nedslaget skadar och knuffar fiender runt omkring.
    const pc = p.pos;
    for (const e of Enemies.list) {
      if (e.dead) continue;
      const d = V3.dist(e.pos, pc);
      if (d < 4.5) {
        const dir = V3.normalize(V3.create(), V3.sub(V3.create(), e.pos, pc));
        dir[1] = 0.5;
        this.damageEnemy(e, speed * 0.9 * (1 - d / 6), dir, 10, 'slam');
      }
    }
  },
  onPlayerHurt(p, dmg) {
    const c = p.center(this._c);
    Effects.burst(c[0], c[1], c[2], [1, 0.45, 0.3], 10, 4, 0.5, 0.08, { add: false, grav: 6 });
    Effects.shake(0.3);
    this.stats.taken += dmg;
  },
  onPlayerDeath() {},
  onSwing() {},
  onCarveHit(pr, x, y, z) { Effects.debris(x, y, z, [0.62, 0.5, 0.4], 6, 4); Effects.shake(0.05); },
  onCarve(pr) {
    for (let k = 0; k < 6; k++) Effects.debris(pr.cx + rand(-1, 1), lerp(pr.y0, pr.y1, k / 6), pr.cz + rand(-1, 1), [0.6, 0.48, 0.38], 10, 6);
    Effects.dust(pr.cx, pr.y0 + 0.5, pr.cz, 20, 3);
    Effects.shake(0.25);
  },
  onParry(b) { Effects.sparks(b.pos[0], b.pos[1], b.pos[2], -b.vel[0] * 0.03, 0.3, -b.vel[2] * 0.03, 0.5, [1, 0.9, 0.6], 10, 6); },
  onBlocked(e) {
    const c = Enemies.center(e, this._c);
    Effects.sparks(c[0] + Math.sin(e.yaw) * 0.7, c[1], c[2] + Math.cos(e.yaw) * 0.7, Math.sin(e.yaw), 0.3, Math.cos(e.yaw), 0.6, [1, 0.85, 0.5], 14, 7);
    Effects.text(c[0], c[1] + 1.2, c[2], 'Blockerat', '#ffd27a', 14);
  },
  onEnemyAlert() {},
  onEnemySeen() {},
  onEnemyWindup() {},
  onEnemyStrike() {},
  onEnemyShoot() {},
  onThunderCharge() {},
  onBeam(e, x, y, z) { Effects.sparks(x, y, z, 0, 1, 0, 1, [1, 0.3, 0.45], 14, 6); Effects.shake(0.12); },
  onBruteSlam(e) { Effects.dust(e.pos[0], e.pos[1], e.pos[2], 24, 3); Effects.shake(0.4); },
  onEnemyHit(e, dmg) {
    const c = Enemies.center(e, this._c);
    Effects.burst(c[0], c[1], c[2], [0.9, 0.97, 1], 8, 5, 0.3, 0.06);
    Effects.text(c[0], c[1] + e.h * 0.6, c[2], String(Math.round(dmg)), '#fff4d6', 15);
  },
  onEnemyKilled(e) {
    const c = Enemies.center(e, this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 26, 6, 0.8, 0.1);
    Effects.debris(c[0], c[1], c[2], e.type === 'brute' ? [0.48, 0.4, 0.34] : [0.3, 0.22, 0.2], e.type === 'brute' ? 26 : 12, 5);
  },
};

window.addEventListener('load', () => Game.init());
