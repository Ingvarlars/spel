'use strict';
// Vågsystem och svårighetskurva: en ny våg var 30:e sekund, boss var 5:e våg.

const WAVE_DURATION = 30;
const MAX_ENEMIES = 450;

const Levels = {
  // XP som krävs för att gå från nivå `level` till nästa.
  xpForLevel(level) {
    const l = level - 1;
    return Math.round(5 + l * 4.5 + Math.pow(l, 1.6));
  },

  isBossWave(w) { return w % 5 === 0; },

  // Inställningar för en våg: spawntakt, fiendemix och förstärkning.
  waveConfig(w) {
    const n = w - 1;
    const weights = [{ w: 10, v: 'chaser' }];
    if (w >= 2) weights.push({ w: 2 + 0.4 * w, v: 'dasher' });
    if (w >= 3) weights.push({ w: 2 + 0.3 * w, v: 'shooter' });
    if (w >= 4) weights.push({ w: 2 + 0.3 * w, v: 'splitter' });
    if (w >= 6) weights.push({ w: 0.5 + 0.25 * w, v: 'tank' });
    return {
      rate: Math.min(16, 0.9 + 0.5 * n + 0.035 * n * n), // fiender per sekund
      mods: {
        hp: 1 + 0.16 * n + 0.012 * n * n,
        speed: 1 + Math.min(0.35, 0.025 * n),
        dmg: 1 + 0.08 * n,
      },
      weights,
      burst: 6 + 3 * w,
    };
  },
};

// Styr när och var fiender dyker upp.
const Director = {
  wave: 0,
  timer: 0,
  acc: 0,
  config: null,
  bossCount: 0,

  reset() {
    this.wave = 0;
    this.timer = 0;
    this.acc = 0;
    this.config = null;
    this.bossCount = 0;
  },

  startWave(game) {
    this.wave++;
    this.timer = WAVE_DURATION;
    this.config = Levels.waveConfig(this.wave);
    game.wave = this.wave;
    game.waveMods = this.config.mods;

    // Inledande formation: en ring av fiender runt spelaren.
    const p = game.player, cfg = this.config;
    const ring = Math.min(cfg.burst, MAX_ENEMIES - Enemies.list.length);
    const radius = Math.hypot(game.w, game.h) / 2 / game.zoom + 40;
    const type = this.wave >= 3 && this.wave % 3 === 0 ? 'dasher' : 'chaser';
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * TAU;
      Enemies.spawn(type, clamp(p.x + Math.cos(a) * radius, 20, WORLD_W - 20), clamp(p.y + Math.sin(a) * radius, 20, WORLD_H - 20), cfg.mods);
    }

    if (Levels.isBossWave(this.wave)) {
      this.bossCount++;
      const sp = game.spawnPoint();
      const b = Enemies.spawn('boss', sp.x, sp.y, cfg.mods);
      Boss.init(b, this.bossCount);
      game.onBossSpawn(b);
    } else {
      game.onWaveStart(this.wave);
    }
  },

  update(dt, game) {
    this.timer -= dt;
    if (this.timer <= 0) this.startWave(game);
    const cfg = this.config;
    const progress = 1 - this.timer / WAVE_DURATION;
    let rate = cfg.rate * (0.75 + 0.5 * progress);
    if (game.boss && !game.boss.dead) rate *= 0.45;
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (Enemies.list.length >= MAX_ENEMIES) { this.acc = 0; break; }
      const sp = game.spawnPoint();
      Enemies.spawn(weightedPick(cfg.weights), sp.x, sp.y, cfg.mods);
    }
  },
};
