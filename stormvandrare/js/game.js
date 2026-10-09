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
  stageBoss: null,
  bossSpawned: false,
  complete: false,
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
    const unlock = () => Sound.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    Input.on('mute', () => { Sound.muted = !Sound.muted; Sound.applyVolume(); });
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

  startStage(level, seed, ideal) {
    this.level = level;
    this.stageBoss = ['chasmfiend', 'thunderclast', 'heavenly', 'herald'][(level - 1) % 4];
    this.bossSpawned = false;
    this.complete = false;
    Progression.reset(ideal || Progression.ideal);
    World.generate({ level, length: 520 + level * 40, theme: THEMES.plains }, seed);
    this.time = 0;
    this.tick = 0;
    Effects.reset();
    Enemies.reset();
    Blade.reset();
    Abilities.reset();
    Bosses.reset();
    this.stats = { kills: 0, damage: 0, taken: 0, wealth: 0, gemhearts: 0, stormTime: 0 };
    this.mods = { hp: 1 + (level - 1) * 0.25, dmg: 1 + (level - 1) * 0.15, speed: 1 + Math.min(0.25, (level - 1) * 0.05) };
    for (const s of World.spawns) Enemies.spawn(s.type, s.x, s.y, s.z, this.mods, s.elite, s.home);
    Pickups.reset();
    for (const s of World.sphereSpots) Pickups.spawnSphere(s.x, s.y, s.z, Math.random() < 0.12 ? 2 : Math.random() < 0.4 ? 1 : 0, !s.dun, false);
    for (const h of World.herbSpots) Pickups.spawnItem('knobweed', h.x, h.y, h.z, false);
    Storm.reset(rand(70, 95), 125);
    this.banner = null;
    const p = this.player;
    p.reset();
    const st = World.start;
    p.spawnAt(st.cx, st.y1 + 0.05, st.cz);
    Progression.apply(p);
    p.light = p.stats.maxLight;
    Spren.reset(p);
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
    this.frameDt = frame;
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
    Abilities.update(dt, this);
    Enemies.update(dt, this);
    Bosses.update(dt, this);
    Spren.update(dt, this);
    this.updateStage(dt);
    this.updateAudio(dt);
    Projectiles.update(dt, this);
    Pickups.update(dt, this);
    Storm.update(dt, this);
    Storm.affectPlayer(this.player, dt, this);
    Effects.update(dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
  },

  // Etappens mål: nå arenan, besegra bossen och ta dess gemheart.
  updateStage(dt) {
    const p = this.player;
    const ar = World.arena;
    if (!this.bossSpawned && p.alive && Math.hypot(p.pos[0] - ar.cx, p.pos[2] - ar.cz) < ar.radius * 0.85 && p.pos[1] > ar.y1 - 2) {
      this.bossSpawned = true;
      Bosses.spawn(this.stageBoss, this);
    }
    if (this.completeTimer > 0) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0) this.startStage(this.level + 1, (Math.random() * 1e9) | 0);
    }
  },

  // Ljudslingor och musikläge efter vad som händer.
  updateAudio() {
    if (!Sound.ready()) return;
    const p = this.player;
    const k = Storm.intensity;
    Sound.setLoop('wind', k * 0.5 + Math.min(0.25, V3.len(p.vel) / 150), 300 + k * 500);
    Sound.setLoop('rain', k > 0.3 ? (k - 0.3) * 0.35 : 0);
    Sound.setLoop('flight', !p.grounded && p.lashed ? Math.min(0.3, V3.len(p.vel) / 120) : 0, 500 + V3.len(p.vel) * 20);
    let hum = 0, combat = false;
    for (const e of Enemies.list) {
      if (e.dead) continue;
      const d = V3.dist(e.pos, p.pos);
      if ((e.type === 'warrior' || e.type === 'archer' || e.type === 'shield') && d < 25) hum += (1 - d / 25) * 0.05;
      if (e.alert && d < 35) combat = true;
    }
    Sound.setLoop('hum', Math.min(0.12, hum));
    Music.setMode(Bosses.boss && !Bosses.boss.dead ? 'boss' : combat ? 'combat' : Storm.contains(p.pos[0]) ? 'storm' : 'explore');
    Music.update();
    // Fotsteg.
    if (p.grounded && Math.hypot(p.vel[0], p.vel[2]) > 2) {
      const ph = Math.floor(((p.phase || 0) + Math.PI / 2) / Math.PI);
      if (ph !== this._stepPh) { this._stepPh = ph; Sound.play('step', 0.8); Effects.dust(p.pos[0], p.pos[1], p.pos[2], 1, 0.3); }
    }
  },

  // Ljud i världen dämpas med avståndet.
  sfx(name, pos) {
    if (!pos) { Sound.play(name); return; }
    const d = V3.dist(pos, this.player.pos);
    if (d < 70) Sound.play(name, Math.max(0.15, 1 - d / 70));
  },

  showBanner(text, sub, color, time) {
    this.banner = { text, sub: sub || '', color: color || '#f3e6c8', t: time || 3.5, max: time || 3.5 };
  },

  // Vrider en riktning mot närmaste fiende inom räckvidd och vinkel.
  aimAssist(dir, range, cosLimit) {
    const pc = this.player.center(this._c);
    let best = null, bestScore = -1e9;
    const ec = this._ec || (this._ec = V3.create());
    for (const e of Enemies.list) {
      if (e.dead || e.invulnerable) continue;
      if (e.boss) { const z = Bosses.zones(e)[0]; V3.set(ec, z[0], z[1], z[2]); } else Enemies.center(e, ec);
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
    if (e.boss) { this.onBossKilled(e); return; }
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

  wind(pos) { return Storm.wind(pos); },

  render() {
    const p = this.player;
    const env = this.env;
    env.retract[0] = p.pos[0]; env.retract[1] = p.pos[1]; env.retract[2] = p.pos[2];
    Storm.applyEnv(env, env.base);
    // Röd blixt vid skada och puls när livet är lågt.
    if (this.hurtFlash > 0) this.hurtFlash -= this.frameDt || 0.016;
    const low = p.alive && p.hp < p.stats.maxHp * 0.25 ? 0.12 + 0.08 * Math.sin(this.realTime * 6) : 0;
    const red = Math.max(Math.max(0, this.hurtFlash || 0) * 0.45, low);
    if (red > env.overlay[3]) { env.overlay[0] = 0.75; env.overlay[1] = 0.08; env.overlay[2] = 0.05; env.overlay[3] = red; }
    Renderer.begin(Camera, env, this.realTime);
    World.draw(Camera);
    Pickups.draw(this);
    Storm.draw(this);
    Bosses.draw(this);
    Abilities.draw(this);
    Spren.draw(this);
    Enemies.draw(this);
    Projectiles.draw(this);
    p.draw(this);
    Blade.draw();
    Effects.draw();
    // Stormlight lyser upp omgivningen.
    if (p.light > 1) {
      const c = p.center(this._c);
      const k = p.light / p.stats.maxLight;
      Renderer.light(c[0], c[1], c[2], 0.06 + 0.1 * k, 0.09 + 0.14 * k, 0.14 + 0.2 * k, 3 + k * 3);
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
    // Bossens livmätare.
    const boss = Bosses.boss;
    if (boss && !boss.dead) {
      const bw = Math.min(560, w * 0.6), bx = (w - bw) / 2, by = h - 70;
      ctx.fillStyle = 'rgba(20,14,10,0.65)';
      ctx.fillRect(bx - 4, by - 4, bw + 8, 20);
      ctx.fillStyle = boss.invulnerable ? '#7a6a6a' : '#c8402a';
      ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 12);
      ctx.strokeStyle = 'rgba(232,210,160,0.7)';
      ctx.strokeRect(bx - 4.5, by - 4.5, bw + 9, 21);
      for (const f of [0.33, 0.66]) { ctx.fillStyle = 'rgba(232,210,160,0.6)'; ctx.fillRect(bx + bw * f, by, 2, 12); }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1e4c4';
      ctx.font = 'bold 15px Georgia';
      ctx.fillText(BOSS_DEFS[boss.bossType].name.toUpperCase(), w / 2, by - 12);
    }
    // Förmågor och nedkylning.
    const abil = [['R', 'full', 'Full Lashing'], ['F', 'lashEnemy', 'Lasha fiende'], ['G', 'spear', 'Spjut'], ['C', 'wind', 'Vindkallelse']];
    let ax = w - 290;
    for (const a of abil) {
      const on = Progression.has(a[1]);
      ctx.fillStyle = on ? 'rgba(20,16,12,0.55)' : 'rgba(20,16,12,0.25)';
      ctx.fillRect(ax, h - 40, 52, 26);
      if (on && Abilities.cd[a[1]] > 0) { ctx.fillStyle = 'rgba(140,190,255,0.35)'; ctx.fillRect(ax, h - 40, 52 * (Abilities.cd[a[1]] / Abilities.cooldown[a[1]]), 26); }
      ctx.fillStyle = on ? '#e8f4ff' : 'rgba(232,220,200,0.35)';
      ctx.font = 'bold 13px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(a[0], ax + 26, h - 22);
      ax += 58;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d4af4a';
    ctx.font = 'italic 13px Georgia';
    ctx.fillText(IDEALS[Progression.ideal - 1].title + ' · Etapp ' + this.level, 20, 92);

    // Stormvarning och lä.
    ctx.textAlign = 'left';
    ctx.font = 'italic 14px Georgia';
    if (Storm.state === 'warning') {
      ctx.fillStyle = '#dbe7ff';
      ctx.fillText('Highstormen om ' + Math.ceil(Storm.timer) + ' s', 20, 72);
    } else if (Storm.state === 'active') {
      ctx.fillStyle = p.inShelter ? '#bfe6ff' : '#ffb0a0';
      ctx.fillText(Storm.contains(p.pos[0]) ? (p.inShelter ? 'I lä – Stormlight fyller dig' : 'Utsatt för stormen!') : 'Highstormen drar fram', 20, 72);
    }
    const b = this.banner;
    if (b) {
      ctx.globalAlpha = Math.min(1, (b.max - b.t) * 3, b.t * 1.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = b.color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.font = 'bold ' + Math.round(Math.min(42, w / 14)) + 'px Georgia';
      ctx.fillText(b.text, w / 2, h * 0.26);
      ctx.font = 'italic 17px Georgia';
      ctx.fillText(b.sub, w / 2, h * 0.26 + 34);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  },

  // --- Händelser (fylls på i senare steg) ---
  onLash(p, more) {
    Sound.play(more ? 'lashMore' : 'lash');
    const c = p.center(this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 18, 5, 0.5, 0.1);
  },
  onLashFail() { Sound.play('fail'); Spren.say('Du har för lite Stormlight. Andas in från sfärerna!', 3); },
  onLashReset() { Sound.play('lashReset'); },
  onLightOut() { Sound.play('fail'); Spren.say('Ditt Stormlight tog slut – du faller!', 3); },
  onDash(p) {
    Sound.play('dash');
    const c = p.center(this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 24, 6, 0.4, 0.1);
  },
  onJump() { Sound.play('jump'); },
  onSlam(p, speed) {
    p.landT = Math.min(1, speed / 40);
    Sound.play(speed > 40 ? 'slam' : 'land');
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
    Sound.play('hurt');
    Spren.painspren(p.pos[0], p.pos[1], p.pos[2]);
    this.hurtFlash = 0.5;
  },
  onPlayerDeath() {},
  onSwing(sw) { Sound.play(sw.combo === 2 ? 'swingHeavy' : 'swing'); },
  onCarveHit(pr, x, y, z) { Effects.debris(x, y, z, [0.62, 0.5, 0.4], 6, 4); Effects.shake(0.05); },
  onCarve(pr) {
    Sound.play('crumble');
    for (let k = 0; k < 6; k++) Effects.debris(pr.cx + rand(-1, 1), lerp(pr.y0, pr.y1, k / 6), pr.cz + rand(-1, 1), [0.6, 0.48, 0.38], 10, 6);
    Effects.dust(pr.cx, pr.y0 + 0.5, pr.cz, 20, 3);
    Effects.shake(0.25);
  },
  onParry(b) {
    Sound.play('parry'); Effects.sparks(b.pos[0], b.pos[1], b.pos[2], -b.vel[0] * 0.03, 0.3, -b.vel[2] * 0.03, 0.5, [1, 0.9, 0.6], 10, 6); },
  onBlocked(e) {
    const c = Enemies.center(e, this._c);
    Effects.sparks(c[0] + Math.sin(e.yaw) * 0.7, c[1], c[2] + Math.cos(e.yaw) * 0.7, Math.sin(e.yaw), 0.3, Math.cos(e.yaw), 0.6, [1, 0.85, 0.5], 14, 7);
    Effects.text(c[0], c[1] + 1.2, c[2], 'Blockerat', '#ffd27a', 14);
    Sound.play('clang');
  },
  onEnemyAlert() {},
  onEnemySeen() {},
  onEnemyWindup(e) { Spren.anticipation(e); },
  onEnemyStrike() {},
  onEnemyShoot(e) { this.sfx('arrow', e.pos); },
  onThunderCharge(e) { Spren.anticipation(e); this.sfx('thunderCharge', e.pos); },
  onBeam(e, x, y, z) {
    this.sfx('redBolt', e.pos); Effects.sparks(x, y, z, 0, 1, 0, 1, [1, 0.3, 0.45], 14, 6); Effects.shake(0.12); },
  onBruteSlam(e) {
    this.sfx('bossSlam', e.pos); Effects.dust(e.pos[0], e.pos[1], e.pos[2], 24, 3); Effects.shake(0.4); },
  onEnemyHit(e, dmg, source) {
    Sound.play(e.def.plated || e.type === 'brute' || (e.boss && e.bossType === 'thunderclast') ? 'clang' : 'hit');
    const c = Enemies.center(e, this._c);
    Effects.burst(c[0], c[1], c[2], [0.9, 0.97, 1], 8, 5, 0.3, 0.06);
    Effects.text(c[0], c[1] + e.h * 0.6, c[2], String(Math.round(dmg)), '#fff4d6', 15);
  },
  onDrawLight(o) {
    Sound.play('draw'); Effects.burst(o.pos[0], o.pos[1], o.pos[2], GEMS[o.gem].c, 6, 1.5, 0.5, 0.05); },
  onSphereTaken(o) { this.stats.wealth += o.value; Sound.play('sphere'); },
  onItem(o) {
    const p = this.player;
    const c = p.center(this._c);
    if (o.kind === 'gemheart') {
      this.stats.gemhearts++;
      Sound.play('gemheart');
      Spren.glory = 6;
      p.addLight(p.stats.maxLight);
      Effects.burst(c[0], c[1], c[2], [0.4, 1, 0.65], 40, 6, 1, 0.12);
      if (this.bossSpawned && !Bosses.boss && !this.complete) this.stageComplete();
      else this.showBanner('Gemheart', 'Stormlight fyller dig', '#9dffc8', 2.5);
    } else if (o.kind === 'knobweed') {
      p.hp = Math.min(p.stats.maxHp, p.hp + 35);
      Sound.play('heal');
      Effects.text(c[0], c[1] + 1, c[2], '+35', '#9be37a', 18);
    }
  },
  // Etappen klar: svär nästa Ideal och gå vidare.
  stageComplete() {
    this.complete = true;
    const ideal = Progression.swearNext(this);
    const p = this.player;
    const c = p.center(this._c);
    if (ideal) {
      Sound.play('ideal');
      Spren.glory = 10;
      this.showBanner(ideal.title + ': \u201d' + ideal.words + '\u201d', 'Orden accepteras. Nytt: ' + ideal.grants, '#bfe6ff', 6);
      Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 120, 14, 1.5, 0.14);
      Effects.shake(0.5);
    } else this.showBanner('Etappen klar', 'Gemheart skördat', '#f0d890', 4);
    this.completeTimer = 7;
  },

  onStormWarning() {
    Sound.play('stormHorn');
    Spren.say('Hör du hornen? Highstormen kommer – hitta lä!', 4); this.showBanner('Highstormen närmar sig!', 'Sök lä på klippornas västra sida', '#dbe7ff', 4); },
  onStormStart() { Effects.shake(0.3); },
  onStormEnd() { this.showBanner('Stormen har passerat', 'Sfärerna glöder igen', '#f3e6c8', 3); },
  onLightning() { Effects.shake(0.12); Sound.play('thunder', 0.8); },
  onBossSpawn(e, def) {
    Sound.play('bossSpawn'); this.showBanner(def.name, def.title, '#f0c070', 4); Effects.shake(0.5); },
  onBossPhase(e) { Effects.shake(0.6); this.showBanner(BOSS_DEFS[e.bossType].name + ' rasar!', '', '#ff9a7a', 2); },
  onBossWindup(e) { if (e.bossType !== 'herald') Spren.anticipation(e); },
  onBossRoar(e) { Effects.shake(0.4); Sound.play('roar'); },
  onBossEmerge(e) { Effects.shake(0.6); Effects.dust(e.pos[0], e.pos[1], e.pos[2], 40, 6); },
  onBossBite() {},
  onBossSlam() { Sound.play('bossSlam'); },
  onBossThrow() { Sound.play('swingHeavy'); },
  onBossCurse() { Sound.play('thunderCharge'); },
  onCursed(p) { const c = p.center(this._c); Effects.burst(c[0], c[1], c[2], [0.9, 0.3, 1], 30, 6, 0.8, 0.1); this.showBanner('Din gravitation har Lashats!', 'Tryck Q för att ta tillbaka den', '#e0a0ff', 2); },
  onLocked(key) { this.showBanner('Ej upplåst ännu', 'Svär fler Ideal för att låsa upp förmågan', '#d8c8a8', 1.6); },
  onFullLashing(c, n) {
    Sound.play('full'); Effects.burst(c[0], c[1] - 0.8, c[2], [0.85, 0.95, 1], 50, 12, 0.6, 0.12); Effects.shake(0.3); },
  onLashEnemy(e) {
    Sound.play('lash'); const c = Enemies.center(e, this._c); Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 24, 5, 0.5, 0.1); },
  onSpear() { Sound.play('spear'); },
  onWindCall(t) {
    Sound.play('wind'); Effects.dust(t.x, t.y, t.z, 30, 4); },
  onArmorHit(p) { const c = p.center(this._c); Effects.burst(c[0], c[1], c[2], [0.7, 0.85, 1], 16, 4, 0.4, 0.08); },
  startEverstorm() { Storm.startEverstorm(); this.showBanner('Everstormen!', 'Sök lä på klippornas östra sida', '#ff7a7a', 3.5); },
  onBossKilled(e) {
    const ar = World.arena;
    const z = Bosses.zones(e)[0];
    for (let k = 0; k < 5; k++) Effects.burst(z[0] + rand(-3, 3), z[1] + rand(-2, 3), z[2] + rand(-3, 3), [1, 0.85, 0.6], 40, 10, 1.2, 0.18);
    Effects.shake(1);
    let gx = clamp(z[0], ar.cx - ar.radius * 0.6, ar.cx + ar.radius * 0.6), gz = clamp(z[2], ar.cz - ar.radius * 0.6, ar.cz + ar.radius * 0.6);
    // Flytta in mot mitten tills platsen är fri från klippor.
    for (let k = 0; k < 30 && World.insideAny(gx, ar.y1 + 0.6, gz); k++) { gx = lerp(gx, ar.cx, 0.15) + rand(-1, 1); gz = lerp(gz, ar.cz, 0.15) + rand(-1, 1); }
    Pickups.spawnItem('gemheart', gx, ar.y1, gz, false);
    for (let k = 0; k < 8; k++) Pickups.spawnSphere(gx + rand(-4, 4), ar.y1 + 1, gz + rand(-4, 4), randInt(0, 2), true, true);
    Bosses.boss = null;
    Storm.red = 0;
    Sound.play('crumble');
    Spren.glory = 8;
    this.stats.bosses = (this.stats.bosses || 0) + 1;
    this.showBanner(BOSS_DEFS[e.bossType].name + ' besegrad', 'Ta dess gemheart', '#f0d890', 4);
  },
  onEnemyKilled(e) {
    Pickups.dropFromEnemy(e);
    this.sfx('kill', e.pos);
    const c = Enemies.center(e, this._c);
    Effects.burst(c[0], c[1], c[2], [0.85, 0.95, 1], 26, 6, 0.8, 0.1);
    Effects.debris(c[0], c[1], c[2], e.type === 'brute' ? [0.48, 0.4, 0.34] : [0.3, 0.22, 0.2], e.type === 'brute' ? 26 : 12, 5);
  },
};

window.addEventListener('load', () => Game.init());
