'use strict';
// Stormvandraren: rörelse relativt den egna gravitationen, fallbindning och stormglöd.

function basePlayerStats() {
  return {
    maxHp: 100,
    maxLight: 100,
    speed: 260,          // löpfart (px/s)
    lashCost: 4,         // stormglöd per bindning
    lashDrain: 1.2,      // stormglöd per sekund och bindningsstyrka
    maxLashes: 3,        // flera bindningar åt samma håll
    healRate: 18,        // HP per sekund när stormglöd läker
    healCost: 0.34,      // stormglöd per läkt HP
    leak: 0.35,          // stormglöd som ångar bort per sekund
    bladeDamage: 30,
    bladeSpeed: 1,       // hugghastighet
    bladeReach: 1,       // räckvidd
    armor: 0,            // skadereduktion 0..1
    magnet: 70,          // räckvidd för att dra till sig sfärer
  };
}

class Player {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.reset();
  }

  reset() {
    this.stats = basePlayerStats();
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.w = 20; this.h = 36;
    this.gx = 0; this.gy = 1; this.gStrength = 1;
    this.lashed = false;
    this.hp = this.stats.maxHp;
    this.light = 40;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.facing = 1;
    this.aim = 0;
    this.runPhase = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.alive = true;
    this.lastLashTime = -10;
    this.fallSpeed = 0;
    this.lashFail = 0;
    this.attackAnim = 0;
  }

  spawnAt(x, y) {
    this.x = x; this.y = y;
    this.vx = this.vy = 0;
    this.resetGravity();
  }

  resetGravity() {
    this.gx = 0; this.gy = 1; this.gStrength = 1;
    this.lashed = false;
    this.fitBox();
  }

  // Hitboxen ligger ned när gravitationen pekar åt sidan.
  fitBox() {
    const upright = Math.abs(this.gy) >= Math.abs(this.gx);
    const w = upright ? 20 : 36, h = upright ? 36 : 20;
    if (w === this.w) return;
    // Prova på plats och med små förskjutningar; annars behålls den gamla lådan.
    const nudges = [0, 0, 0, -9, 0, 9, -9, 0, 9, 0, -9, -9, 9, -9, -9, 9, 9, 9];
    for (let i = 0; i < nudges.length; i += 2) {
      const x = this.x + nudges[i], y = this.y + nudges[i + 1];
      if (!World.rectHits(x - w / 2, y - h / 2, w, h)) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        return;
      }
    }
  }

  // Binder sitt fall åt (dx, dy). Samma håll igen = starkare (flera bindningar).
  lash(dx, dy, game) {
    const len = Math.hypot(dx, dy);
    if (len < 0.01) {
      if (this.lashed) { this.resetGravity(); game.onLash(this, true); }
      return;
    }
    dx /= len; dy /= len;
    const s = this.stats;
    if (this.light < s.lashCost) { this.lashFail = 0.4; game.onLashFail(this); return; }
    const same = this.lashed && Math.abs(angleDiff(Math.atan2(dy, dx), Math.atan2(this.gy, this.gx))) < 0.4;
    if (same) this.gStrength = Math.min(s.maxLashes, this.gStrength + 1);
    else { this.gStrength = 1; this.gx = dx; this.gy = dy; }
    this.lashed = true;
    this.light -= s.lashCost;
    this.vx += dx * 160;
    this.vy += dy * 160;
    this.lastLashTime = game.time;
    this.fitBox();
    game.onLash(this, false);
  }

  // Rör kroppen 2 px i riktningen och kollar om den tar i berg.
  touching(dx, dy) {
    return World.rectHits(this.x - this.w / 2 + dx, this.y - this.h / 2 + dy, this.w, this.h);
  }

  update(dt, game) {
    const s = this.stats;
    const m = Input.readMove(this.move);
    if (game.touchMove) { m.x = game.touchMove.x; m.y = game.touchMove.y; }

    // --- Fallbindning ---
    if (Input.consume('lash')) {
      if (Input.mouseLash && Input.mouseAiming()) {
        const a = game.mouseWorld();
        this.lash(a.x - this.x, a.y - this.y, game);
      } else if (game.touchMove) this.lash(m.x, m.y, game);
      else this.lash(Input.lashDir.x, Input.lashDir.y, game);
    }
    if (this.lashed) {
      this.light -= s.lashDrain * this.gStrength * dt;
      if (this.light <= 0) {
        this.light = 0;
        this.resetGravity();
        game.onLightOut(this);
      }
    }

    if ((Math.abs(this.gy) >= Math.abs(this.gx)) !== (this.h > this.w)) this.fitBox();
    const gx = this.gx, gy = this.gy;
    const tx = gy, ty = -gx; // tangent (gång längs ytan)
    this.onGround = this.touching(gx * 2, gy * 2);
    if (this.onGround) this.coyote = 0.1; else this.coyote -= dt;

    // --- Gång och styrning ---
    const along = m.x * tx + m.y * ty; // önskad fart längs ytan
    if (this.onGround) {
      const vt = this.vx * tx + this.vy * ty;
      const target = along * s.speed;
      const k = 1 - Math.exp(-16 * dt);
      const dv = (target - vt) * k;
      this.vx += tx * dv; this.vy += ty * dv;
    } else if (this.lashed) {
      // I luften med egen gravitation kan man styra åt alla håll.
      this.vx += m.x * 700 * dt;
      this.vy += m.y * 700 * dt;
    } else {
      const k = 1 - Math.exp(-5 * dt);
      this.vx += (m.x * s.speed - this.vx) * k * Math.abs(m.x || 0.25);
    }
    if (Math.abs(along) > 0.2) this.facing = along > 0 ? 1 : -1;

    // --- Hopp ---
    if (Input.consume('jump')) this.jumpBuffer = 0.14;
    if (this.jumpBuffer > 0) {
      this.jumpBuffer -= dt;
      if (this.coyote > 0) {
        const vn = this.vx * gx + this.vy * gy;
        this.vx += gx * (-560 - vn);
        this.vy += gy * (-560 - vn);
        this.jumpBuffer = 0;
        this.coyote = 0;
        game.onJump(this);
      }
    }

    // --- Gravitation och yttre krafter ---
    const g = GRAVITY * this.gStrength;
    this.vx += gx * g * dt + game.wind(this) * dt;
    this.vy += gy * g * dt;
    // Begränsa fallfarten i gravitationens riktning.
    const vn = this.vx * gx + this.vy * gy;
    const maxFall = 760 + 420 * (this.gStrength - 1);
    if (vn > maxFall) { this.vx -= gx * (vn - maxFall); this.vy -= gy * (vn - maxFall); }
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 1500) { this.vx *= 1500 / sp; this.vy *= 1500 / sp; }

    // --- Förflyttning och kollision ---
    this.fallSpeed = Math.max(0, this.vx * gx + this.vy * gy);
    const hit = World.move(this, this.vx * dt, this.vy * dt);
    if (hit & 1 && this.vx < 0) this.vx = 0;
    if (hit & 2 && this.vx > 0) this.vx = 0;
    if (hit & 4 && this.vy < 0) this.vy = 0;
    if (hit & 8 && this.vy > 0) this.vy = 0;
    // Landade vi hårt i gravitationens riktning? (nedslag)
    const landed = (gx > 0.5 && hit & 2) || (gx < -0.5 && hit & 1) || (gy > 0.5 && hit & 8) || (gy < -0.5 && hit & 4);
    if (landed && this.fallSpeed > 650) game.onSlam(this, this.fallSpeed);

    // --- Stormglöd: läkning och läckage ---
    if (this.light > 0) {
      this.light = Math.max(0, this.light - s.leak * dt);
      if (this.hp < s.maxHp && this.alive) {
        const heal = Math.min(s.healRate * dt, s.maxHp - this.hp, this.light / s.healCost);
        this.hp += heal;
        this.light -= heal * s.healCost;
      }
    }
    this.light = Math.min(this.light, s.maxLight);

    // --- Sikte ---
    if (Input.mouseAiming() && !game.touchMove) {
      const a = game.mouseWorld();
      this.aim = Math.atan2(a.y - this.y, a.x - this.x);
    } else if (Math.hypot(m.x, m.y) > 0.3) {
      this.aim = Math.atan2(m.y, m.x);
    } else {
      this.aim = Math.atan2(ty * this.facing, tx * this.facing);
    }

    if (this.onGround) this.runPhase += Math.abs(this.vx * tx + this.vy * ty) * dt * 0.05;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.lashFail > 0) this.lashFail -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;

    // Föll ut ur världen (bör inte hända): tillbaka till marken.
    if (this.y > World.height + 200) this.y = World.height - FLOOR_ROW * 0 - 200;
  }

  takeDamage(amount, game, fromX, fromY) {
    if (!this.alive || this.invuln > 0) return 0;
    const dmg = amount * (1 - this.stats.armor);
    this.hp -= dmg;
    this.invuln = 0.6;
    this.hurtFlash = 0.25;
    if (fromX !== undefined) {
      const dx = this.x - fromX, dy = this.y - fromY, d = Math.hypot(dx, dy) || 1;
      this.vx += (dx / d) * 300;
      this.vy += (dy / d) * 300 - 120;
    }
    game.onPlayerHurt(this, dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      game.onPlayerDeath(this);
    }
    return dmg;
  }

  addLight(v) { this.light = Math.min(this.stats.maxLight, this.light + v); }

  draw(ctx, game) {
    if (!this.alive) return;
    const t = game.realTime;
    const glow = this.light / this.stats.maxLight;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Stormglödens sken.
    if (this.light > 1) {
      const r = 34 + glow * 30 + Math.sin(t * 4) * 3;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
      g.addColorStop(0, 'rgba(235,248,255,' + (0.25 + glow * 0.45) + ')');
      g.addColorStop(1, 'rgba(160,210,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }

    // Rotera så att fötterna pekar mot den egna gravitationen.
    ctx.rotate(Math.atan2(this.gy, this.gx) - Math.PI / 2);
    const upright = Math.abs(this.gy) >= Math.abs(this.gx);
    const half = (upright ? this.h : this.w) / 2;
    ctx.translate(0, half - 18);
    ctx.scale(this.facingDraw(), 1);
    if (this.invuln > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.5;

    const run = this.onGround ? Math.sin(this.runPhase) : 0.6;
    const coat = this.hurtFlash > 0 ? '#c0404a' : '#24497a';
    // Ben.
    ctx.strokeStyle = '#2a2622';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, 4); ctx.lineTo(-3 + run * 6, 18);
    ctx.moveTo(2, 4); ctx.lineTo(3 - run * 6, 18);
    ctx.stroke();
    // Kappa som fladdrar.
    ctx.fillStyle = '#1b3558';
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(-12 - Math.abs(Math.sin(t * 6)) * 3, 10);
    ctx.lineTo(-3, 6);
    ctx.closePath();
    ctx.fill();
    // Kropp (blå rock).
    ctx.fillStyle = coat;
    ctx.fillRect(-6, -12, 12, 18);
    ctx.fillStyle = '#d9b44a';
    ctx.fillRect(-6, -2, 12, 2); // bälte
    // Huvud.
    ctx.fillStyle = '#9a6a4a';
    ctx.beginPath(); ctx.arc(0, -18, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1e1a18';
    ctx.beginPath(); ctx.arc(-1, -20, 6, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
    // Ögonen lyser när man håller stormglöd.
    ctx.fillStyle = this.light > 1 ? '#bfe6ff' : '#2a2622';
    ctx.fillRect(2, -19, 2, 2);
    // Arm.
    ctx.strokeStyle = coat;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, -1 + run * 2); ctx.stroke();
    ctx.restore();

    // Stormglöd som ångar från huden.
    if (this.light > 5 && (game.tick % 3) === 0) {
      Effects.particle(this.x + rand(-8, 8), this.y + rand(-14, 14), rand(-10, 10), rand(-40, -20), rand(0.5, 1), rand(2, 3.5), 'rgba(225,245,255,0.8)', 1);
    }
  }

  facingDraw() {
    // När man står på taket blir "höger" spegelvänt; följ den faktiska rörelsen.
    return this.facing;
  }
}
