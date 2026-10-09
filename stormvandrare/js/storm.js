'use strict';
// Highstormen: förvarning, en stormmur som drar fram från öst (+x) mot väst,
// stark vind, lä bakom klippor, flygande bråte, regn, blixtar och laddning av sfärer.

const STORM_SPEED = 24;      // m/s
const STORM_LENGTH = 150;    // hur långt stormen sträcker sig bakom muren
const STORM_WARNING = 14;    // sekunders förvarning

const Storm = {
  state: 'calm',     // calm | warning | active
  timer: 0,
  period: 120,
  wallX: 0,
  tailX: 0,
  flash: 0,
  flashTimer: 2,
  debrisTimer: 0,
  count: 0,
  intensity: 0,      // hur mycket av stormen spelaren upplever (0..1)
  bolts: [],         // blixtar i fjärran { pts, life }
  _c: V3.create(),

  reset(first, period) {
    this.state = 'calm';
    this.timer = first;
    this.period = period;
    this.flash = 0;
    this.flashTimer = 2;
    this.count = 0;
    this.intensity = 0;
    this.bolts.length = 0;
  },

  get active() { return this.state === 'active'; },

  warnProgress() { return this.state === 'warning' ? 1 - this.timer / STORM_WARNING : this.state === 'active' ? 1 : 0; },

  contains(x) { return this.state === 'active' && x >= this.wallX && x <= this.tailX; },

  // Lä: berg strax öster om kroppen (där stormen kommer ifrån).
  sheltered(x, y, z) {
    return World.raycast(x, y, z, 1, 0, 0, 9, 0.6) < 9 && World.raycast(x, y + 0.9, z, 1, 0, 0, 9, 0.6) < 9;
  },

  update(dt, game) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    const p = game.player;
    if (this.state === 'calm') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'warning'; this.timer = STORM_WARNING; game.onStormWarning(); }
    } else if (this.state === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'active';
        this.wallX = World.bounds.x1 + 80;
        this.tailX = this.wallX + STORM_LENGTH;
        this.count++;
        game.onStormStart();
      }
    } else {
      const prev = this.wallX;
      this.wallX -= STORM_SPEED * dt;
      this.tailX -= STORM_SPEED * dt;
      Pickups.chargeBetween(this.wallX, prev);
      const inside = this.contains(p.pos[0]);
      if (inside) {
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) {
          this.flashTimer = rand(1.2, 4);
          this.flash = 1;
          this.addBolt(p);
          game.onLightning();
        }
        // Bråte som flyger med vinden.
        this.debrisTimer -= dt;
        if (this.debrisTimer <= 0) {
          this.debrisTimer = rand(0.3, 0.7);
          const pc = p.center(this._c);
          Projectiles.spawn('rock', pc[0] + 40, pc[1] + rand(-3, 6), pc[2] + rand(-14, 14), -rand(28, 40), rand(-1, 2), rand(-2, 2), 10, { grav: 4, r: rand(0.25, 0.6), life: 4 });
        }
      }
      if (this.tailX < World.bounds.x0 - 60) {
        this.state = 'calm';
        this.timer = this.period;
        game.onStormEnd();
      }
    }
    // Hur mycket storm spelaren upplever.
    const target = this.contains(p.pos[0]) ? 1 : this.state === 'warning' ? this.warnProgress() * 0.45 : this.state === 'active' ? clamp(1 - (this.wallX - p.pos[0]) / 200, 0.3, 0.7) : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 1.2);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
  },

  addBolt(p) {
    const a = rand(0, TAU), r = rand(40, 120);
    const x = p.pos[0] + Math.cos(a) * r, z = p.pos[2] + Math.sin(a) * r;
    const pts = [];
    let y = 160;
    let bx = x, bz = z;
    while (y > CHASM_FLOOR) {
      pts.push([bx, y, bz]);
      y -= rand(8, 20);
      bx += rand(-6, 6); bz += rand(-6, 6);
    }
    this.bolts.push({ pts, life: 0.25 });
  },

  // Vindkraft (m/s², negativ = västerut).
  wind(pos) {
    if (!this.contains(pos[0])) return 0;
    if (this.sheltered(pos[0], pos[1] + 0.8, pos[2])) return -2;
    const front = clamp(1 - (pos[0] - this.wallX) / 60, 0.55, 1);
    return -46 * front;
  },

  // Skada och Stormlight för spelaren.
  affectPlayer(p, dt, game) {
    p.inShelter = false;
    if (!this.contains(p.pos[0]) || !p.alive) return;
    const shelter = this.sheltered(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
    p.inShelter = shelter;
    p.addLight((shelter ? 4 : 14) * dt);
    if (!shelter) {
      p.hp -= 9 * dt * (1 - p.stats.armor);
      game.stats.stormTime += dt;
      if (p.hp <= 0) { p.hp = 0; p.alive = false; game.onPlayerDeath(p); }
    }
  },

  // Miljön påverkas av stormen (himmel, dimma, ljus).
  applyEnv(env, base) {
    const k = this.intensity;
    env.storm = k;
    env.fog = base.fog * (1 + k * 4);
    const mix3 = (out, a, b) => { out[0] = lerp(a[0], b[0], k); out[1] = lerp(a[1], b[1], k); out[2] = lerp(a[2], b[2], k); };
    mix3(env.skyTop, base.sky.top, [0.12, 0.14, 0.18]);
    mix3(env.skyHorizon, base.sky.horizon, [0.24, 0.26, 0.3]);
    mix3(env.skyGround, base.sky.ground, [0.16, 0.16, 0.18]);
    mix3(env.cloudCol, base.sky.cloud, [0.22, 0.24, 0.28]);
    mix3(env.sunCol, base.sky.sun, [0.25, 0.27, 0.32]);
    mix3(env.ambientSky, base.ambientSky, [0.3, 0.33, 0.4]);
    env.retractAll = clamp(k * 1.4, 0, 1);
    const f = this.flash;
    env.overlay[0] = 0.85; env.overlay[1] = 0.9; env.overlay[2] = 1; env.overlay[3] = f * 0.35;
  },

  draw(game) {
    if (this.state === 'active') {
      const b = World.bounds;
      Renderer.stormWall = { x: this.wallX, z0: b.z0 - 300, z1: b.z1 + 300, h: 230, flash: this.flash };
    } else Renderer.stormWall = null;
    for (const bolt of this.bolts) {
      Renderer.ribbon(bolt.pts, 2.4, 0.8, 0.85, 1, bolt.life * 3, true);
      Renderer.ribbon(bolt.pts, 0.6, 1, 1, 1, bolt.life * 4, true);
    }
    // Regn runt kameran.
    const k = this.intensity;
    if (k > 0.3) {
      const c = Camera.pos;
      const n = Math.floor(260 * k * Effects.settings.particles);
      const t = game.realTime;
      for (let i = 0; i < n; i++) {
        const sx = ((i * 7.31) % 1) * 40 - 20, sz = ((i * 3.77) % 1) * 40 - 20;
        const fall = ((t * 1.6 + i * 0.137) % 1);
        const x = c[0] + sx - fall * 8, y = c[1] + 14 - fall * 28, z = c[2] + sz;
        Renderer.ribbon([[x + 0.6, y + 0.9, z], [x, y, z]], 0.025, 0.75, 0.8, 0.9, 0.35 * k, false);
      }
    }
  },
};
