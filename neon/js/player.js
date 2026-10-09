'use strict';
// Spelarens farkost: rörelse, dash, liv, sköld och regenerering.

const PLAYER_COLOR = '#3ff6ff';

function baseStats() {
  return {
    maxHp: 100,
    speed: 230,       // pixlar per sekund
    damage: 1,        // skademultiplikator
    fireRate: 1,      // eldtaktsmultiplikator (högre = snabbare)
    projectiles: 0,   // extra projektiler för skjutande vapen
    pierce: 0,        // extra genomträngning
    area: 1,          // områdesmultiplikator
    magnet: 90,       // upplockningsradie för XP
    regen: 0,         // HP per sekund
    shieldMax: 0,     // antal sköldladdningar
    shieldTime: 10,   // sekunder per ny laddning
    crit: 0.05,       // chans för kritisk träff (dubbel skada)
    armor: 0,         // dras av från inkommande skada
    dashCooldown: 1.6,
  };
}

class Player {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.reset();
  }

  reset() {
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2;
    this.vx = 0;
    this.vy = 0;
    this.r = 13;
    this.stats = baseStats();
    this.hp = this.stats.maxHp;
    this.angle = -Math.PI / 2;
    this.dashCd = 0;
    this.dashTime = 0;
    this.dashDx = 0;
    this.dashDy = 0;
    this.invuln = 0;
    this.shield = 0;
    this.shieldTimer = 0;
    this.hurtFlash = 0;
    this.alive = true;
  }

  get dashReady() { return this.dashCd <= 0; }

  update(dt, game) {
    const s = this.stats;
    const m = Input.readMove(this.move);

    if (Input.consumeDash() && this.dashCd <= 0) {
      // Dasha i rörelseriktningen, annars dit farkosten pekar.
      let dx = m.x, dy = m.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) { dx = Math.cos(this.angle); dy = Math.sin(this.angle); }
      else { dx /= len; dy /= len; }
      this.dashDx = dx;
      this.dashDy = dy;
      this.dashTime = 0.18;
      this.dashCd = s.dashCooldown;
      game.onDash(this);
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = this.dashDx * 900;
      this.vy = this.dashDy * 900;
    } else {
      // Mjuk acceleration mot önskad hastighet.
      const tx = m.x * s.speed, ty = m.y * s.speed;
      const k = 1 - Math.exp(-14 * dt);
      this.vx += (tx - this.vx) * k;
      this.vy += (ty - this.vy) * k;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, this.r, WORLD_W - this.r);
    this.y = clamp(this.y, this.r, WORLD_H - this.r);

    if (this.vx * this.vx + this.vy * this.vy > 400) {
      const target = Math.atan2(this.vy, this.vx);
      let d = target - this.angle;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.angle += d * Math.min(1, 16 * dt);
    }

    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    if (s.regen > 0 && this.hp < s.maxHp) this.hp = Math.min(s.maxHp, this.hp + s.regen * dt);

    if (this.shield < s.shieldMax) {
      this.shieldTimer += dt;
      if (this.shieldTimer >= s.shieldTime) {
        this.shieldTimer = 0;
        this.shield++;
      }
    } else {
      this.shieldTimer = 0;
    }
  }

  get dashing() { return this.dashTime > 0; }

  // Returnerar faktisk skada (0 om träffen blockerades).
  takeDamage(amount, game) {
    if (!this.alive || this.invuln > 0 || this.dashTime > 0) return 0;
    if (this.shield > 0) {
      this.shield--;
      this.shieldTimer = 0;
      this.invuln = 0.6;
      game.onShieldBlock(this);
      return 0;
    }
    const dmg = Math.max(1, amount - this.stats.armor);
    this.hp -= dmg;
    this.invuln = 0.5;
    this.hurtFlash = 0.25;
    game.onPlayerHurt(this, dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      game.onPlayerDeath(this);
    }
    return dmg;
  }

  heal(amount) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  draw(ctx, time) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && !this.dashing && Math.floor(time * 20) % 2 === 0;
    const sprite = Sprites.get(this.hurtFlash > 0 ? 'player-hurt' : 'player', 18, 14, (g) => {
      const c = this.hurtFlash > 0 ? '#ff4060' : PLAYER_COLOR;
      neonShape(g, c, 14, 3, 0.25, (p) => {
        p.moveTo(18, 0);
        p.lineTo(-12, 11);
        p.lineTo(-6, 0);
        p.lineTo(-12, -11);
      });
    });
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.shield > 0) {
      const sh = Sprites.get('shield', 24, 10, (g) => neonShape(g, '#7fa8ff', 10, 2, 0.08, circlePath(24)));
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(time * 5);
      ctx.drawImage(sh.img, -sh.half, -sh.half);
    }
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.rotate(this.angle);
    ctx.drawImage(sprite.img, -sprite.half, -sprite.half);
    ctx.restore();
  }
}
