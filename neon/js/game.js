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
  waveMods: null,
  tick: 0,
  hurtVignette: 0,
  boss: null,
  banner: null,
  level: 1,
  xp: 0,
  xpNext: 5,
  wave: 0,
  pendingLevels: 0,
  choices: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init();
    UI.init();
    // Ljud kräver en användarhändelse innan det får spelas.
    const unlock = () => Sound.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    Input.on('mute', () => this.toggleMute());
    const muteBtn = document.getElementById('btn-mute');
    muteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMute(); muteBtn.blur(); });
    Input.on('choose1', () => this.chooseUpgrade(0));
    Input.on('choose2', () => this.chooseUpgrade(1));
    Input.on('choose3', () => this.chooseUpgrade(2));
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
    Pickups.reset();
    Effects.reset();
    this.hurtVignette = 0;
    Upgrades.reset();
    this.level = 1;
    this.xp = 0;
    this.xpNext = Levels.xpForLevel(1);
    this.pendingLevels = 0;
    this.choices = null;
    this.weapons = [];
    this.addWeapon('blaster');
    this.stats = { kills: 0, damage: 0 };
    this.boss = null;
    this.banner = null;
    this.wave = 0;
    Director.reset();
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
    this.tick++;
    if (this.hurtVignette > 0) this.hurtVignette -= dt;
    const p = this.player;
    p.update(dt, this);

    Director.update(dt, this);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    Enemies.update(dt, this);
    Weapons.update(dt, this);
    Pickups.update(dt, this);
    Effects.update(dt);

    // Motorspår bakom farkosten.
    if (p.alive && (this.tick & 1) === 0 && (p.vx * p.vx + p.vy * p.vy) > 2500) {
      const bx = p.x - Math.cos(p.angle) * 10, by = p.y - Math.sin(p.angle) * 10;
      Effects.particle(bx, by, -Math.cos(p.angle) * 80 + rand(-20, 20), -Math.sin(p.angle) * 80 + rand(-20, 20), p.dashing ? 0.4 : 0.25, p.dashing ? 4 : 2.5, p.dashing ? '#ffffff' : PLAYER_COLOR, 4);
    }
    if (this.pendingLevels > 0) this.openLevelUp();

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
    if (e.isBoss) this.onBossKilled(e);
    if (e.type === 'splitter' && e.gen > 0) {
      for (let i = 0; i < 2; i++) {
        const c = Enemies.spawn('splitter', e.x + rand(-8, 8), e.y + rand(-8, 8), e.mods, e.gen - 1);
        const a = rand(0, TAU);
        c.kbx = Math.cos(a) * 220; c.kby = Math.sin(a) * 220;
      }
    }
    this.onEnemyKilled(e);
  },

  toggleMute() {
    Sound.unlock();
    Sound.toggleMute();
    this.updateMuteButton();
  },

  updateMuteButton() {
    const b = document.getElementById('btn-mute');
    b.textContent = Sound.muted ? '🔇' : '🔊';
    b.setAttribute('aria-label', Sound.muted ? 'Slå på ljud' : 'Stäng av ljud');
    b.classList.toggle('off', Sound.muted);
  },

  addXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Levels.xpForLevel(this.level);
      this.pendingLevels++;
    }
  },

  openLevelUp() {
    this.state = 'levelup';
    this.choices = Upgrades.roll(this, 3);
    this.onLevelUp();
    UI.showLevelUp(this.choices, this.level - this.pendingLevels + 1, (i) => this.chooseUpgrade(i));
  },

  chooseUpgrade(i) {
    if (this.state !== 'levelup' || !this.choices || !this.choices[i]) return;
    Upgrades.apply(this.choices[i], this);
    this.choices = null;
    this.pendingLevels--;
    if (this.pendingLevels > 0) this.openLevelUp();
    else {
      UI.hide();
      this.state = 'playing';
    }
  },

  onEnemyKilled(e) {
    const big = e.type === 'tank' || e.isBoss;
    Effects.burst(e.x, e.y, e.def.color, big ? 30 : 10, big ? 320 : 220, 0.5, 3);
    Effects.burst(e.x, e.y, '#ffffff', big ? 10 : 3, 160, 0.3, 2);
    if (big) { Effects.ring(e.x, e.y, e.r * 3, e.def.color, 0.45, 4); Effects.shake(0.15); }
    Sound.play(big ? 'explosion' : 'kill');
    const xp = e.xp * (1 + Math.max(0, this.wave - 1) * 0.08);
    if (xp > 0) Pickups.dropXp(e.x, e.y, Math.max(1, Math.round(xp)));
    const r = Math.random();
    if (r < 0.006) Pickups.spawn('heart', e.x, e.y);
    else if (r < 0.009) Pickups.spawn('magnet', e.x, e.y);
  },

  showBanner(text, sub, color) {
    this.banner = { text, sub, color: color || '#3ff6ff', t: 3, max: 3 };
  },

  onWaveStart(w) {
    Sound.play('wave');
    this.showBanner('VÅG ' + w, w === 1 ? 'Överlev!' : 'Fienderna blir starkare', '#3ff6ff');
  },

  onBossSpawn(b) {
    Effects.shake(0.4);
    Sound.play('boss');
    this.boss = b;
    this.showBanner('VÅG ' + this.wave + ' – BOSS', 'Kärnan nivå ' + b.level + ' närmar sig!', '#ff2050');
  },

  onBossKilled(b) {
    Effects.burst(b.x, b.y, '#ff2050', 120, 600, 1.2, 4);
    Effects.burst(b.x, b.y, '#ffe23f', 60, 400, 1, 3);
    Effects.ring(b.x, b.y, 400, '#ff2050', 1, 8);
    Effects.ring(b.x, b.y, 250, '#ffe23f', 0.7, 5);
    Effects.shake(1);
    Sound.play('bigExplosion');
    this.boss = null;
    this.stats.bosses = (this.stats.bosses || 0) + 1;
    Pickups.dropXp(b.x, b.y, 60 + 40 * b.level);
    Pickups.spawn('heart', b.x + 20, b.y);
    Pickups.spawn('magnet', b.x - 20, b.y);
    this.showBanner('BOSS BESEGRAD', '+' + (60 + 40 * b.level) + ' XP', '#ffe23f');
  },

  onPickup(o) {
    if (o.kind === 'heart') { Sound.play('heal'); Effects.text(this.player.x, this.player.y - 24, '+30', '#3fff8a', 18); }
    else if (o.kind === 'magnet') { Sound.play('levelUp'); Effects.ring(this.player.x, this.player.y, 300, '#ffe23f', 0.5, 4); }
    else Sound.play('pickup');
    if (o.kind === 'xp') this.addXp(o.value);
    else if (o.kind === 'heart') this.player.heal(30);
    else if (o.kind === 'magnet') Pickups.magnetAll();
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const s = this.dpr * this.zoom;
    const vt = this.vt;
    vt.s = s;
    vt.tx = this.w * this.dpr / 2 - (this.cam.x + Effects.shakeX) * s;
    vt.ty = this.h * this.dpr / 2 - (this.cam.y + Effects.shakeY) * s;
    ctx.setTransform(s, 0, 0, s, vt.tx, vt.ty);
    this.drawBackground(ctx);
    Pickups.draw(ctx, this, this.realTime);
    Enemies.draw(ctx, this, vt);
    ctx.globalCompositeOperation = 'lighter';
    Weapons.draw(ctx, this, vt);
    ctx.globalCompositeOperation = 'source-over';
    this.player.draw(ctx, this.realTime);
    Effects.draw(ctx, this);
    Effects.drawTexts(ctx);

    // Röd kant när spelaren tar skada eller har lite liv kvar.
    const p = this.player;
    const low = p.alive && p.hp < p.stats.maxHp * 0.3 ? 0.25 + 0.15 * Math.sin(this.realTime * 6) : 0;
    const vig = Math.max(this.hurtVignette, low);
    if (vig > 0) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const g = this.vignette || (this.vignette = { w: 0, h: 0, grad: null });
      if (g.w !== this.w || g.h !== this.h) {
        g.w = this.w; g.h = this.h;
        g.grad = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
        g.grad.addColorStop(0, 'rgba(255,0,40,0)');
        g.grad.addColorStop(1, 'rgba(255,0,40,1)');
      }
      ctx.globalAlpha = Math.min(0.6, vig);
      ctx.fillStyle = g.grad;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    UI.drawHUD(ctx, this);
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
  // --- Effekter och ljud vid händelser ---
  onDash(p) {
    Effects.burst(p.x, p.y, PLAYER_COLOR, 14, 220, 0.35, 3);
    Sound.play('dash');
  },
  onShieldBlock(p) {
    Effects.ring(p.x, p.y, 70, '#7fa8ff', 0.4, 4);
    Effects.burst(p.x, p.y, '#7fa8ff', 16, 260, 0.4, 3);
    Effects.shake(0.15);
    Sound.play('shield');
  },
  onPlayerHurt(p, dmg) {
    Effects.burst(p.x, p.y, '#ff4060', 18, 260, 0.45, 3);
    Effects.text(p.x, p.y - 20, '-' + Math.round(dmg), '#ff4060', 18);
    Effects.shake(0.35 + Math.min(0.3, dmg / 60));
    this.hurtVignette = 0.5;
    Sound.play('hurt');
  },
  onPlayerDeath(p) {
    Effects.burst(p.x, p.y, PLAYER_COLOR, 80, 500, 1.2, 4);
    Effects.burst(p.x, p.y, '#ffffff', 40, 300, 0.8, 3);
    Effects.ring(p.x, p.y, 220, PLAYER_COLOR, 0.8, 6);
    Effects.shake(1);
    Sound.play('bigExplosion');
  },
  onShoot(kind) {
    Sound.play(kind === 'missile' ? 'missile' : kind === 'lightning' ? 'zap' : kind === 'nova' ? 'nova' : 'shoot');
    if (kind === 'nova') Effects.shake(0.06);
  },
  onEnemyShoot(e, boss) {
    if (!boss) Effects.sparks(e.x, e.y, e.angle, 0.4, e.def.color, 3, 120);
    Sound.play('enemyShoot');
  },
  onEnemyHit(e, dmg, crit) {
    Effects.sparks(e.x, e.y, rand(0, TAU), Math.PI, e.def.color, crit ? 5 : 2, 200);
    Effects.text(e.x, e.y - e.r, String(Math.round(dmg)), crit ? '#ffe23f' : '#ffffff', crit ? 18 : 13);
    Sound.play('hit');
  },
  onLevelUp() {
    const p = this.player;
    Effects.ring(p.x, p.y, 160, '#3fd0ff', 0.6, 5);
    Sound.play('levelUp');
  },
  onBossRage(b) {
    Effects.ring(b.x, b.y, 260, '#ff7a3f', 0.7, 6);
    Effects.shake(0.5);
    this.showBanner('RASERI!', 'Kärnan blir snabbare', '#ff7a3f');
    Sound.play('boss');
  },
  onBossCharge(b) {
    Effects.burst(b.x, b.y, '#ff2050', 20, 300, 0.4, 3);
    Sound.play('charge');
  },
  onBossSummon(b) {
    Effects.ring(b.x, b.y, 140, '#ff3fa4', 0.5, 4);
  },
  onExplosion(x, y, r, color) {
    Effects.ring(x, y, r, color, 0.3, 4);
    Effects.burst(x, y, color, 16, r * 5, 0.4, 3);
    Effects.burst(x, y, '#ffffff', 6, r * 3, 0.25, 2);
    Effects.shake(0.07);
    Sound.play('explosion');
  },
  onMissileTrail(b) {
    if ((this.tick & 1) === 0) Effects.particle(b.x, b.y, rand(-20, 20), rand(-20, 20), 0.35, 2.5, '#ff8a3f', 2);
  },
};

window.addEventListener('load', () => Game.init());
