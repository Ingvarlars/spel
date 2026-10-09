'use strict';
// Highstormen: varning, stormmur som drar från öst (höger) till väst, vind,
// lä bakom klippor, flygande bråte och laddning av sfärer.

const STORM_SPEED = 520;     // stormmurens fart (px/s)
const STORM_LENGTH = 2600;   // hur långt stormen sträcker sig bakom muren
const STORM_WARNING = 12;    // sekunders förvarning

const Storm = {
  state: 'calm',     // calm | warning | active
  timer: 0,          // tid till nästa storm (calm) eller kvar av varning
  wallX: 0,
  tailX: 0,
  flash: 0,          // blixtljus 0..1
  flashTimer: 0,
  debrisTimer: 0,
  rain: [],
  period: 110,
  count: 0,

  reset(first, period) {
    this.state = 'calm';
    this.timer = first;
    this.period = period;
    this.flash = 0;
    this.flashTimer = 2;
    this.count = 0;
    this.wallX = this.tailX = 0;
    if (!this.rain.length) for (let i = 0; i < 160; i++) this.rain.push({ x: Math.random(), y: Math.random(), l: rand(10, 24) });
  },

  get active() { return this.state === 'active'; },

  // Hur långt in i stormvarningen vi är (0..1), används för att mörka himlen.
  warnProgress() { return this.state === 'warning' ? 1 - this.timer / STORM_WARNING : this.state === 'active' ? 1 : 0; },

  contains(x) { return this.state === 'active' && x >= this.wallX && x <= this.tailX; },

  // Lä: berg strax öster om (till höger) kroppen i samma höjd.
  sheltered(x, y, h) {
    const tx = Math.floor(x / TILE);
    const rows = [y - h * 0.35, y, y + h * 0.35];
    for (let k = 0; k < rows.length; k++) {
      const ty = Math.floor(rows[k] / TILE);
      let found = false;
      for (let i = 1; i <= 6; i++) if (World.solid(tx + i, ty)) { found = true; break; }
      if (!found) return false;
    }
    return true;
  },

  update(dt, game) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.state === 'calm') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'warning';
        this.timer = STORM_WARNING;
        game.onStormWarning();
      }
    } else if (this.state === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'active';
        this.wallX = World.width + 200;
        this.tailX = this.wallX + STORM_LENGTH;
        this.count++;
        game.onStormStart();
      }
    } else {
      const prev = this.wallX;
      this.wallX -= STORM_SPEED * dt;
      this.tailX -= STORM_SPEED * dt;
      Pickups.chargeBetween(this.wallX, prev);
      // Blixtar och bråte nära spelaren.
      const p = game.player;
      if (this.contains(game.cam.x)) {
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) {
          this.flashTimer = rand(1.5, 4.5);
          this.flash = 1;
          game.onLightning();
        }
        this.debrisTimer -= dt;
        if (this.debrisTimer <= 0) {
          this.debrisTimer = rand(0.25, 0.6);
          const y = p.y + rand(-260, 160);
          const x = game.cam.x + game.w / 2 / game.zoom + 40;
          if (this.contains(x)) Projectiles.spawn('rock', x, y, -rand(650, 900), rand(-60, 60), 10, { grav: 120, r: rand(5, 10), life: 4 });
        }
      }
      if (this.tailX < -200) {
        this.state = 'calm';
        this.timer = this.period;
        game.onStormEnd();
      }
    }
  },

  // Vindkraft på en kropp (px/s², negativ = västerut).
  wind(b) {
    if (!this.contains(b.x)) return 0;
    if (this.sheltered(b.x, b.y, b.h)) return -120;
    // Starkast precis bakom muren.
    const front = clamp(1 - (b.x - this.wallX) / 900, 0.55, 1);
    return -1500 * front;
  },

  // Påverkan på spelaren varje tick: skada och Stormlight.
  affectPlayer(p, dt, game) {
    if (!this.contains(p.x) || !p.alive) return;
    const shelter = this.sheltered(p.x, p.y, p.h);
    p.addLight((shelter ? 4 : 14) * dt);
    if (!shelter) {
      p.hp -= 6 * dt * (1 - p.stats.armor);
      game.stats.stormTime = (game.stats.stormTime || 0) + dt;
      if (p.hp <= 0) { p.hp = 0; p.alive = false; game.onPlayerDeath(p); }
    }
    p.inShelter = shelter;
  },

  // Stormmuren och regnet (världskoordinater).
  drawWorld(ctx, game) {
    if (this.state !== 'active') return;
    const v = game.view(50);
    const x = this.wallX;
    if (x < v.x1 + 300 && x > v.x0 - 300) {
      // Muren: en tornande vägg av vatten och bråte.
      const g = ctx.createLinearGradient(x - 220, 0, x + 260, 0);
      g.addColorStop(0, 'rgba(70,80,95,0)');
      g.addColorStop(0.35, 'rgba(70,82,98,0.75)');
      g.addColorStop(0.6, 'rgba(40,46,58,0.95)');
      g.addColorStop(1, 'rgba(32,36,46,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 260, v.y0);
      for (let yy = v.y0; yy <= v.y1; yy += 40) {
        ctx.lineTo(x - 200 + Math.sin(yy * 0.01 + game.realTime * 3) * 40 + Math.sin(yy * 0.037 + game.realTime * 5) * 18, yy);
      }
      ctx.lineTo(x + 260, v.y1);
      ctx.closePath();
      ctx.fill();
    }
  },

  // Mörker, regn och blixtljus över skärmen (skärmkoordinater).
  drawOverlay(ctx, game) {
    const inside = this.contains(game.cam.x);
    const w = game.w, h = game.h;
    if (inside) {
      ctx.fillStyle = 'rgba(20,26,38,0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(190,210,230,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const t = game.realTime;
      for (let i = 0; i < this.rain.length; i++) {
        const r = this.rain[i];
        const x = ((r.x * w * 1.4 - t * 900 + r.y * 300) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
        const y = ((r.y * h + t * 700) % h + h) % h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - r.l * 1.4, y + r.l);
      }
      ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(235,240,255,' + this.flash * 0.55 + ')';
      ctx.fillRect(0, 0, w, h);
    }
  },
};
