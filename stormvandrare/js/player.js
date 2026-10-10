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
    lashCost: 2,
    lashDrain: 0.45,
    maxLashes: 3,
    healRate: 18,
    healCost: 0.2,
    leak: 0,
    dashCost: 4,
    bladeDamage: 30,
    bladeSpeed: 1,
    bladeReach: 1,
    armor: 0,
    drawRange: 12,
  };
}

// Windrunner-uniform: djupblå rock med guldkanter.
const HERO_PAL = {
  skin: col('#8d5d3f'), hair: col('#1c1512'), coat: col('#1f3f6e'), coatDark: col('#162f52'), sleeve: col('#1f3f6e'),
  shirt: col('#d8cfbd'), trim: col('#d4af4a'), pants: col('#2a2830'), boots: col('#3a2a1e'), belt: col('#4a3626'),
  eye: col('#e8f4ff', 0.6),
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
    const maxFall = (34 + 22 * (this.strength - 1)) * (this.lashed ? this.stats.flySpeed || 1 : 1);
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
    else if (ground && !wasGrounded && fallSpeed > 6) this.landT = Math.min(0.6, fallSpeed / 30);
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
    // Lirra delar med sig: Stormlight fylls långsamt på när man står på marken,
    // och snabbare när man nästan är tom, så att man aldrig blir helt utan.
    if (ground && this.alive && this.light < s.maxLight * 0.5) {
      this.light += (this.light < s.maxLight * 0.2 ? 6 : 2.5) * dt;
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
    let dmg = amount * (1 - this.stats.armor);
    // Stormlight-rustning (fjärde Idealet) tar en del av smällen.
    if (this.stats.armorLight && this.light > 20) { this.light -= dmg * 0.3; dmg *= 0.6; game.onArmorHit(this); }
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

  // Pose för den här bildrutan (procedurell animation).
  animate(dt, game) {
    const P = this.poseCur || (this.poseCur = makePose());
    const T = this.poseTgt || (this.poseTgt = makePose());
    const base = this.poseBase || (this.poseBase = makePose());
    for (const k in T) T[k] = base[k];
    const U = this._t;
    V3.scale(U, this.g, -1);
    const vn = V3.dot(this.vel, U);
    const tx = this.vel[0] - U[0] * vn, ty = this.vel[1] - U[1] * vn, tz = this.vel[2] - U[2] * vn;
    const ts = Math.hypot(tx, ty, tz);
    const speed = V3.len(this.vel);
    this.flying = !this.grounded && this.lashed && speed > 9;
    let rate = 14;

    if (this.grounded) {
      if (ts < 0.4) Anim.idle(T, game.realTime);
      else {
        this.phase = (this.phase || 0) + ts * dt * 1.25;
        Anim.locomotion(T, this.phase, Math.min(1, ts / 3), clamp((ts - 3) / 4.5, 0, 1));
        rate = 22;
      }
      if (this.landT > 0) {
        const k = this.landT;
        T.knL += k * 1.1; T.knR += k * 1.1; T.hipLP += k * 0.6; T.hipRP += k * 0.6;
        T.anL += k * 0.5; T.anR += k * 0.5; T.spineP += k * 0.35; T.rootY -= k * 0.22;
        T.shLR += k * 0.4; T.shRR += k * 0.4;
        rate = 26;
      }
    } else if (this.flying) {
      // Flygning: kroppen ligger längs farten, ena armen framåt.
      T.shLP = 2.95; T.elL = 0.1; T.shLR = 0.05;
      T.shRP = -0.25; T.shRR = 0.25; T.elR = 0.35;
      T.hipLP = -0.08; T.hipRP = 0.06; T.knL = 0.12; T.knR = 0.25; T.anL = -0.4; T.anR = -0.35;
      T.neckP = -0.75; T.spineP = -0.08;
      T.spineY = Math.sin(game.realTime * 2) * 0.05;
      rate = 6;
    } else if (this.lashed) {
      // Svävar långsamt: armar ut, benen hänger.
      const t = game.realTime;
      T.shLR = 0.8 + Math.sin(t * 1.3) * 0.1; T.shRR = 0.75 + Math.cos(t * 1.1) * 0.1;
      T.elL = 0.4; T.elR = 0.4; T.hipLP = 0.15; T.hipRP = -0.1; T.knL = 0.3; T.knR = 0.4;
      T.anL = -0.3; T.anR = -0.3;
      rate = 5;
    } else if (vn > 0) {
      // Hopp uppåt: benen dras upp.
      T.hipLP = 0.7; T.knL = 1.2; T.hipRP = -0.15; T.knR = 0.5;
      T.shLP = 0.4; T.shRP = -0.3; T.shLR = 0.4; T.shRR = 0.5; T.elL = 0.6; T.elR = 0.5;
      T.spineP = 0.1;
    } else {
      // Faller.
      const t = game.realTime;
      T.hipLP = 0.25; T.knL = 0.5; T.hipRP = -0.05; T.knR = 0.3;
      T.shLR = 0.9 + Math.sin(t * 9) * 0.15; T.shRR = 0.85 + Math.cos(t * 8) * 0.15; T.elL = 0.3; T.elR = 0.3;
      T.shLP = 0.3; T.shRP = 0.2;
    }

    if (this.dashTime > 0) {
      T.spineP += 0.5; T.shLP = -0.8; T.shRP = -0.8; T.shLR = 0.3; T.shRR = 0.3; T.elL = 0.2; T.elR = 0.2;
      rate = 30;
    }

    // Hugg: överkroppen tar över.
    if (this.attackAnim > 0) {
      const k = clamp(1 - this.attackAnim / 0.22, 0, 1);
      const e = 1 - (1 - k) * (1 - k);
      const c = this.swingCombo || 0;
      if (c === 0) {
        T.shRP = 1.45; T.shRY = lerp(-1.4, 1.1, e); T.elR = lerp(0.6, 0.1, e); T.shRR = 0.35;
        T.spineY = lerp(-0.55, 0.6, e);
      } else if (c === 1) {
        T.shRP = 1.3; T.shRY = lerp(1.2, -1.5, e); T.elR = lerp(0.9, 0.15, e); T.shRR = 0.2;
        T.spineY = lerp(0.6, -0.65, e);
      } else {
        T.shRP = lerp(3.1, 0.5, e); T.shRY = 0; T.elR = lerp(0.4, 0.05, e); T.shRR = 0.1;
        T.spineP += lerp(-0.25, 0.55, e);
        T.knL += e * 0.5; T.knR += e * 0.5; T.rootY -= e * 0.12;
      }
      T.wrR = 0.2;
      T.shLP = -0.3; T.shLR = 0.55; T.elL = 0.5;
      // Luta med siktet uppåt/nedåt.
      const aim = game.aimDirection(this);
      T.spineP -= clamp(V3.dot(aim, this.visUp || U), -0.8, 0.8) * 0.5;
      rate = 40;
    }
    if (this.hurtFlash > 0) { T.spineP -= 0.3; T.neckP -= 0.2; }

    const k = 1 - Math.exp(-rate * dt);
    for (const key in P) P[key] += (T[key] - P[key]) * k;
    if (this.landT > 0) this.landT = Math.max(0, this.landT - dt * 2.5);
    return P;
  }

  draw(game) {
    if (!this.alive) return;
    const dt = Math.min(0.05, game.frameDt || 0.016);
    const body = Body.build('hero', HERO_PAL, { hair: true });
    const pose = this.animate(dt, game);

    // Kroppens orientering: följer gravitationen, eller farten vid flygning.
    const U = V3.scale(this._t, this.g, -1);
    const vu = this.visUp || (this.visUp = V3.create(0, 1, 0));
    const vf = this.visFwd || (this.visFwd = V3.create(0, 0, 1));
    const tu = this._tu || (this._tu = V3.create());
    const tf = this._tf || (this._tf = V3.create());
    if (this.flying) {
      V3.normalize(tu, this.vel);
      V3.scale(tf, Camera.up, -1);
    } else {
      V3.copy(tu, U);
      V3.copy(tf, this.facing);
    }
    V3.rotateTowards(vu, vu, tu, dt * (this.flying ? 5 : 10));
    V3.addScaled(tf, tf, vu, -V3.dot(tf, vu));
    if (V3.len(tf) < 0.05) V3.copy(tf, vf);
    V3.normalize(tf, tf);
    V3.rotateTowards(vf, vf, tf, dt * 12);
    V3.addScaled(vf, vf, vu, -V3.dot(vf, vu));
    if (V3.len(vf) < 0.05) V3.copy(vf, Camera.refFwd);
    V3.normalize(vf, vf);
    const right = this._r || (this._r = V3.create());
    V3.cross(right, vu, vf);
    V3.normalize(right, right);
    // Rotera kring mittpunkten så att kroppen inte svänger runt fötterna.
    const center = this.center(this._c2 || (this._c2 = V3.create()));
    const rootPos = this._rp || (this._rp = V3.create());
    V3.addScaled(rootPos, center, vu, -0.95);
    const root = this._m;
    M4.fromBasis(root, rootPos, right, vu, vf, 1);

    const tint = this.hurtFlash > 0 ? { tint: [1, 0.35, 0.3, 0.45] } : this.invuln > 0 && this.dashTime <= 0 && Math.floor(game.realTime * 20) % 2 ? { tint: [0.85, 0.92, 1, 0.35] } : null;
    const J = Skeleton.draw(body, root, pose, tint);
    this.joints = J;

    // Rocken: tyg som hänger från bältet och följer gravitation och vind.
    if (!this.coat) {
      const anchors = [];
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = 0.6 + (i / (n - 1)) * (TAU - 1.2);
        anchors.push([Math.sin(a) * 0.19, 0.1, Math.cos(a) * 0.145]);
      }
      this.coat = new Cloth(anchors, 7, 0.78, { outer: HERO_PAL.coat, hem: HERO_PAL.trim });
    }
    const grav = this._gv || (this._gv = V3.create());
    V3.scale(grav, this.g, 14);
    grav[0] += game.wind(this.pos) * 0.6;
    const sph = this._sph || (this._sph = [[0, 0, 0, 0.21], [0, 0, 0, 0.13], [0, 0, 0, 0.13], [0, 0, 0, 0.11], [0, 0, 0, 0.11]]);
    const setS = (s, m, y, r) => { const q = M4.transformPoint(this._q || (this._q = V3.create()), m, [0, y, 0]); s[0] = q[0]; s[1] = q[1]; s[2] = q[2]; s[3] = r; };
    setS(sph[0], J.pelvis, 0, 0.22);
    setS(sph[1], J.thighL, -0.22, 0.13);
    setS(sph[2], J.thighR, -0.22, 0.13);
    setS(sph[3], J.shinL, -0.12, 0.1);
    setS(sph[4], J.shinR, -0.12, 0.1);
    this.coat.damp = 0.975;
    this.coat.update(dt, J.pelvis, grav, sph, this.vel);
    this.coat.draw();

    // Ögonen lyser när man håller Stormlight.
    const k = this.light / this.stats.maxLight;
    if (k > 0.3) {
      const e = this._e || (this._e = V3.create());
      for (const sx of [0.037, -0.037]) {
        M4.transformPoint(e, J.head, [sx, 0.18, 0.105]);
        Renderer.particle(e[0], e[1], e[2], 0.012 + k * 0.012, 0.75, 0.9, 1, 0.35 + k * 0.4, true);
      }
      // Stormlight som ångar från huden.
      if (game.tick !== this._steamTick && Math.random() < 0.15 + k * 0.4) {
        this._steamTick = game.tick;
        const src = [J.chest, J.head, J.upperL, J.upperR, J.foreL, J.foreR, J.thighL, J.thighR][Math.floor(Math.random() * 8)];
        M4.transformPoint(e, src, [rand(-0.1, 0.1), rand(-0.2, 0.2), rand(-0.1, 0.1)]);
        Effects.particle(e[0], e[1], e[2], U[0] * 0.5 + rand(-0.15, 0.15), U[1] * 0.5 + rand(-0.1, 0.2), U[2] * 0.5 + rand(-0.15, 0.15), rand(0.6, 1.1), rand(0.02, 0.04), [0.8, 0.92, 1], 0.28, 1.5, 0, true, 0.05);
      }
    }

    // Shardblade i högerhanden.
    const hand = J.handR;
    if (this.attackAnim > 0 || this.bladeOut > 0) {
      const L = M4.fromTRS(this._m2 || (this._m2 = M4.create()), 0, -0.07, 0.02, 0, 0, 0, 1, 1, 1);
      const out = M4.multiply(this._m3 || (this._m3 = M4.create()), hand, L);
      const fresh = !this._bladeShown;
      this._bladeShown = true;
      Renderer.draw(Models.shardblade(), out, { emissive: 0.12 });
      if (fresh) {
        // Klingan framkallas ur dimma.
        const q = this._e || (this._e = V3.create());
        for (let i = 0; i < 18; i++) {
          M4.transformPoint(q, out, [0, 0, rand(0.1, 1.9)]);
          Effects.particle(q[0], q[1], q[2], rand(-0.5, 0.5), rand(-0.2, 0.6), rand(-0.5, 0.5), rand(0.3, 0.6), rand(0.08, 0.16), [0.9, 0.95, 1], 0.6, 3, 0, true, 0.2);
        }
      }
      if (this.attackAnim > 0) Blade.recordTip(out);
    } else if (this._bladeShown) {
      this._bladeShown = false;
      // Klingan löses upp i dimma.
      const q = this._e || (this._e = V3.create());
      const L = M4.fromTRS(this._m2, 0, -0.07, 0.02, 0, 0, 0, 1, 1, 1);
      const out = M4.multiply(this._m3, hand, L);
      for (let i = 0; i < 14; i++) {
        M4.transformPoint(q, out, [0, 0, rand(0.1, 1.9)]);
        Effects.particle(q[0], q[1], q[2], rand(-0.4, 0.4), rand(0, 0.5), rand(-0.4, 0.4), rand(0.4, 0.8), rand(0.08, 0.14), [0.85, 0.92, 1], 0.4, 2, 0, true, 0.2);
      }
    }
    if (this.attackAnim > 0) this.bladeOut = 0.9;
    else this.bladeOut = Math.max(0, (this.bladeOut || 0) - dt);
  }
}
