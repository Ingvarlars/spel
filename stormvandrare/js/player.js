'use strict';
// Windrunnern i 3D: rörelse relativt den egna gravitationen, Lashings åt valfritt
// håll (flera gånger för starkare drag), Stormlight, läkning och rusning.

const G_BASE = 24;           // normal gravitation (m/s²)
const CAPSULE_R = 0.4;
const CAPSULE_OFFS = [0.4, 0.95, 1.5];

function basePlayerStats() {
  return {
    maxHp: 100,
    maxLight: 100,
    speed: 7.5,
    jump: 9.5,
    lashCost: 4,
    lashDrain: 1.2,
    maxLashes: 3,
    healRate: 18,
    healCost: 0.34,
    leak: 0.35,
    dashCost: 8,
    bladeDamage: 30,
    bladeSpeed: 1,
    bladeReach: 1,
    armor: 0,
    drawRange: 7,
  };
}

const PLAYER_PAL = {
  skin: col('#8a5a3c'), hair: col('#1e1a18'), body: col('#24497a'), sleeve: col('#24497a'),
  pants: col('#2c2a33'), boots: col('#3b2a1e'), belt: col('#4a3a2a'), trim: col('#d9b44a'), coat: col('#1b3558'),
  eye: col('#bfe6ff', 0),
};

class Player {
  constructor() {
    this.pos = V3.create();
    this.vel = V3.create();
    this.g = V3.create(0, -1, 0);   // gravitationens riktning
    this.up = V3.create(0, 1, 0);   // visuell upp (mjukt följande)
    this.facing = V3.create(0, 0, 1);
    this.groundN = V3.create(0, 1, 0);
    this.move = { x: 0, y: 0 };
    this._n = V3.create();
    this._c = V3.create();
    this._t = V3.create();
    this._t2 = V3.create();
    this._m = M4.create();
    this.reset();
  }

  reset() {
    this.stats = basePlayerStats();
    V3.set(this.vel, 0, 0, 0);
    V3.set(this.g, 0, -1, 0);
    V3.set(this.up, 0, 1, 0);
    this.strength = 1;
    this.lashed = false;
    this.hp = this.stats.maxHp;
    this.light = 40;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.alive = true;
    this.anim = 0;
    this.attackAnim = 0;
    this.dashTime = 0;
    this.lastLash = -10;
    this.inShelter = false;
    this.airTime = 0;
  }

  spawnAt(x, y, z) {
    V3.set(this.pos, x, y, z);
    V3.set(this.vel, 0, 0, 0);
    this.resetGravity();
    V3.set(this.up, 0, 1, 0);
  }

  resetGravity() {
    V3.set(this.g, 0, -1, 0);
    this.strength = 1;
    this.lashed = false;
  }

  // Mittpunkt (för träffar, sikte och ljus).
  center(out) { return V3.addScaled(out, this.pos, this.g, -0.95); }

  // Lashing åt riktningen d (enhetsvektor). Samma håll igen = starkare.
  lash(d, game) {
    const s = this.stats;
    if (this.light < s.lashCost) { game.onLashFail(this); return; }
    const same = this.lashed && V3.dot(d, this.g) > 0.93;
    if (same) this.strength = Math.min(s.maxLashes, this.strength + 1);
    else { V3.copy(this.g, d); this.strength = 1; }
    this.lashed = true;
    this.light -= s.lashCost;
    V3.addScaled(this.vel, this.vel, d, 3);
    this.lastLash = game.time;
    game.onLash(this, same);
  }

  update(dt, game) {
    const s = this.stats;
    const m = Input.readMove(this.move);
    const U = this._t;
    V3.scale(U, this.g, -1);

    // --- Lashings ---
    if (Input.consume('lash')) {
      const d = game.aimDirection(this);
      this.lash(d, game);
    }
    if (Input.consume('lashDown')) this.lash(V3.set(this._t2, 0, -1, 0), game);
    if (Input.consume('reset') && this.lashed) { this.resetGravity(); game.onLashReset(this); }
    if (this.lashed) {
      this.light -= s.lashDrain * this.strength * dt;
      if (this.light <= 0) { this.light = 0; this.resetGravity(); game.onLightOut(this); }
    }
    V3.scale(U, this.g, -1);

    // --- Rörelse relativt kameran och gravitationen ---
    const f = this._c, r = this._n;
    V3.addScaled(f, Camera.fwd, U, -V3.dot(Camera.fwd, U));
    if (V3.len(f) < 0.15) V3.addScaled(f, Camera.up, U, -V3.dot(Camera.up, U));
    V3.normalize(f, f);
    V3.cross(r, f, U);
    const wish = this._t2;
    V3.scale(wish, f, m.y);
    V3.addScaled(wish, wish, r, m.x);
    const wl = V3.len(wish);
    if (wl > 1) V3.scale(wish, wish, 1 / wl);

    // Rusning med Stormlight.
    if (Input.consume('dash') && this.light >= s.dashCost && this.dashTime <= 0) {
      const dir = wl > 0.1 ? wish : Camera.fwd;
      const dl = V3.len(dir) || 1;
      V3.addScaled(this.vel, this.vel, dir, 20 / dl);
      this.light -= s.dashCost;
      this.dashTime = 0.28;
      this.invuln = Math.max(this.invuln, 0.28);
      game.onDash(this);
    }
    if (this.dashTime > 0) this.dashTime -= dt;

    const vn = V3.dot(this.vel, U);
    if (this.grounded) {
      // Tangentiell fart mot önskad fart.
      const k = 1 - Math.exp(-14 * dt);
      const tx = this.vel[0] - U[0] * vn, ty = this.vel[1] - U[1] * vn, tz = this.vel[2] - U[2] * vn;
      const sp = this.dashTime > 0 ? 0 : s.speed;
      this.vel[0] += (wish[0] * sp - tx) * k * (this.dashTime > 0 ? 0 : 1);
      this.vel[1] += (wish[1] * sp - ty) * k * (this.dashTime > 0 ? 0 : 1);
      this.vel[2] += (wish[2] * sp - tz) * k * (this.dashTime > 0 ? 0 : 1);
    } else {
      // I luften: styrning (starkare när man flyger med egen Lashing).
      const acc = this.lashed ? 16 : 9;
      V3.addScaled(this.vel, this.vel, wish, acc * dt);
      if (!this.lashed) {
        // Begränsa sidofarten när man faller normalt.
        const tx = this.vel[0] - U[0] * vn, tz = this.vel[2] - U[2] * vn;
        const hs = Math.hypot(tx, tz);
        const cap = Math.max(s.speed * 1.15, this.dashTime > 0 ? 30 : 0);
        if (hs > cap && this.dashTime <= 0) {
          const k = 1 - Math.exp(-3 * dt);
          this.vel[0] -= tx * (1 - cap / hs) * k;
          this.vel[2] -= tz * (1 - cap / hs) * k;
        }
      }
    }

    // --- Hopp ---
    if (Input.consume('jump')) this.jumpBuffer = 0.15;
    if (this.jumpBuffer > 0) {
      this.jumpBuffer -= dt;
      if (this.coyote > 0) {
        const cur = V3.dot(this.vel, U);
        V3.addScaled(this.vel, this.vel, U, s.jump - cur);
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.grounded = false;
        game.onJump(this);
      }
    }

    // --- Gravitation, vind och fartgränser ---
    V3.addScaled(this.vel, this.vel, this.g, G_BASE * this.strength * dt);
    const wind = game.wind(this.pos);
    if (wind) this.vel[0] += wind * dt;
    const fall = V3.dot(this.vel, this.g);
    const maxFall = 34 + 22 * (this.strength - 1);
    if (fall > maxFall) V3.addScaled(this.vel, this.vel, this.g, maxFall - fall);
    const sp = V3.len(this.vel);
    if (sp > 75) V3.scale(this.vel, this.vel, 75 / sp);
    if (this.lashed && !this.grounded) {
      // Lite luftmotstånd vid flygning.
      V3.scale(this.vel, this.vel, Math.exp(-0.15 * dt));
    }

    // --- Förflyttning i delsteg och kollision ---
    const fallSpeed = Math.max(0, V3.dot(this.vel, this.g));
    const wasGrounded = this.grounded;
    const steps = Math.max(1, Math.ceil(sp * dt / 0.3));
    let ground = false;
    const nAcc = this.groundN;
    for (let st = 0; st < steps; st++) {
      V3.addScaled(this.pos, this.pos, this.vel, dt / steps);
      if (this.collide(U)) ground = true;
    }
    this.grounded = ground;
    if (ground) this.coyote = 0.12; else this.coyote -= dt;
    if (ground && !wasGrounded && fallSpeed > 22) game.onSlam(this, fallSpeed);
    if (!ground) this.airTime += dt; else this.airTime = 0;
    void nAcc;

    // --- Stormlight: läckage och läkning ---
    if (this.light > 0) {
      this.light = Math.max(0, this.light - s.leak * dt);
      if (this.hp < s.maxHp && this.alive) {
        const heal = Math.min(s.healRate * dt, s.maxHp - this.hp, this.light / s.healCost);
        this.hp += heal;
        this.light -= heal * s.healCost;
      }
    }
    this.light = Math.min(this.light, s.maxLight);

    // --- Visuell orientering ---
    V3.rotateTowards(this.up, this.up, U, dt * 9);
    const tv = this._c;
    const un = V3.dot(this.vel, this.up);
    V3.addScaled(tv, this.vel, this.up, -un);
    const tl = V3.len(tv);
    if (this.attackAnim > 0) {
      V3.addScaled(tv, game.aimDirection(this), this.up, -V3.dot(game.aimDirection(this), this.up));
      if (V3.len(tv) > 0.05) { V3.normalize(tv, tv); V3.rotateTowards(this.facing, this.facing, tv, dt * 20); }
    } else if (tl > 1) {
      V3.scale(tv, tv, 1 / tl);
      V3.rotateTowards(this.facing, this.facing, tv, dt * 12);
    }
    // Håll facing vinkelrät mot upp.
    V3.addScaled(this.facing, this.facing, this.up, -V3.dot(this.facing, this.up));
    if (V3.len(this.facing) < 0.01) V3.copy(this.facing, Camera.refFwd);
    V3.normalize(this.facing, this.facing);

    this.anim += dt * (this.grounded ? Math.min(1.6, tl / 4) * 9 : 3);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
  }

  // Löser kapselns kollision. Returnerar true om den står på något (i förhållande till U).
  collide(U) {
    let grounded = false;
    const c = this._c;
    const n = this._n;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < CAPSULE_OFFS.length; i++) {
        V3.addScaled(c, this.pos, U, CAPSULE_OFFS[i]);
        const ox = c[0], oy = c[1], oz = c[2];
        if (World.collideSphere(c, CAPSULE_R, n)) {
          this.pos[0] += c[0] - ox; this.pos[1] += c[1] - oy; this.pos[2] += c[2] - oz;
          V3.normalize(n, n);
          const into = V3.dot(this.vel, n);
          if (into < 0) V3.addScaled(this.vel, this.vel, n, -into);
          if (V3.dot(n, U) > 0.55) { grounded = true; V3.copy(this.groundN, n); }
        }
      }
    }
    return grounded;
  }

  takeDamage(amount, game, from) {
    if (!this.alive || this.invuln > 0) return 0;
    const dmg = amount * (1 - this.stats.armor);
    this.hp -= dmg;
    this.invuln = 0.6;
    this.hurtFlash = 0.25;
    if (from) {
      const d = this._t2;
      V3.sub(d, this.pos, from);
      d[1] = Math.max(d[1], 0.5);
      V3.normalize(d, d);
      V3.addScaled(this.vel, this.vel, d, 7);
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

  draw(game) {
    if (!this.alive) return;
    const rig = Models.humanoid('player', PLAYER_PAL, { coat: true });
    const up = this.up, fw = this.facing;
    const right = this._t;
    V3.cross(right, up, fw);
    V3.normalize(right, right);
    const root = this._m;
    M4.fromBasis(root, this.pos, right, up, fw, 1);
    const t = this.anim;
    const run = this.grounded ? Math.sin(t) : 0;
    const flying = !this.grounded && this.lashed;
    const pose = this.pose || (this.pose = {});
    pose.legL = this.grounded ? run * 0.7 : flying ? -0.2 : 0.4;
    pose.legR = this.grounded ? -run * 0.7 : flying ? 0.1 : -0.3;
    pose.armL = this.grounded ? -run * 0.6 : flying ? 2.6 : -0.6;
    pose.armR = this.grounded ? run * 0.6 : flying ? 0.4 : -0.5;
    pose.armLr = flying ? 0.3 : 0.1;
    pose.armRr = flying ? 0.5 : 0.1;
    pose.lean = flying ? 0.5 : this.grounded ? Math.min(0.25, V3.len(this.vel) * 0.02) : 0;
    pose.crouch = 0;
    pose.twist = 0;
    pose.armRy = 0;
    if (this.attackAnim > 0) {
      // Hugg: högerarmen sveper.
      const k = 1 - this.attackAnim / 0.22;
      pose.armR = lerp(2.4, 0.2, k);
      pose.armRr = lerp(0.9, -0.5, k) * (this.swingDir || 1);
      pose.twist = lerp(0.5, -0.5, k) * (this.swingDir || 1);
    }
    pose.wantHand = this._hand || (this._hand = M4.create());
    const tint = this.hurtFlash > 0 ? { tint: [1, 0.3, 0.3, 0.5] } : this.invuln > 0 && Math.floor(game.realTime * 20) % 2 ? { tint: [0.8, 0.9, 1, 0.4] } : null;
    const hand = Rig.draw(rig, root, pose, tint);
    // Shardblade i handen vid hugg (den framkallas ur dimma och försvinner igen).
    if (this.attackAnim > 0 || this.bladeOut > 0) {
      const L = M4.fromTRS(this._m2 || (this._m2 = M4.create()), 0, -0.68, 0.02, 0, 0, 0, 1, 1, 1);
      const out = M4.multiply(this._m3 || (this._m3 = M4.create()), hand, L);
      Renderer.draw(Models.shardblade(), out, { emissive: 0.15 });
      if (this.attackAnim > 0) Blade.recordTip(hand);
    }
    this.bladeOut = Math.max(0, (this.bladeOut || 0) - 0.016);
    if (this.attackAnim > 0) this.bladeOut = 0.5;
  }
}
