'use strict';
// Karaktärer: mjukt modellerade kroppar med skelett, procedurella animationer
// och tygsimulering (rockar och mantlar som följer gravitation och vind).

// --- Kroppsbyggare ---
// pal: färger. opts: { bulk, plates, helmet, hair, robe, coat }
const Body = {
  cache: {},

  build(key, pal, opts) {
    if (this.cache[key]) return this.cache[key];
    opts = opts || {};
    const b = opts.bulk || 1;
    const SEG = 10;
    const parts = {};
    const coat = pal.coat || pal.body;
    const coatDark = pal.coatDark || coat;

    // Bäcken (pivot i höftleden).
    let mb = new MeshBuilder();
    mb.loft([
      { y: -0.1, rx: 0.15 * b, rz: 0.11 * b, c: pal.pants },
      { y: 0.0, rx: 0.17 * b, rz: 0.12 * b, c: pal.pants },
      { y: 0.08, rx: 0.165 * b, rz: 0.115 * b, c: pal.pants },
      { y: 0.08, rx: 0.17 * b, rz: 0.122 * b, c: pal.belt },
      { y: 0.15, rx: 0.16 * b, rz: 0.116 * b, c: pal.belt },
    ], SEG, true, true);
    if (pal.trim) {
      mb.box(0, 0.115, 0.122 * b, 0.07, 0.06, 0.02, pal.trim);
      // Sfärpung som lyser svagt.
      mb.ellipsoid(0.15 * b, 0.05, 0.05, 0.045, 0.055, 0.04, 6, 4, pal.belt);
      mb.ellipsoid(0.15 * b, 0.1, 0.07, 0.022, 0.022, 0.022, 6, 4, col('#bfe6ff', 1.2));
    }
    parts.pelvis = mb.build();

    // Bröstkorg (pivot i midjan).
    mb = new MeshBuilder();
    const chestRings = [
      { y: 0.0, rx: 0.155 * b, rz: 0.112 * b, c: coat },
      { y: 0.12, rx: 0.175 * b, rz: 0.122 * b, c: coat },
      { y: 0.25, rx: 0.205 * b, rz: 0.135 * b, c: coat },
      { y: 0.36, rx: 0.22 * b, rz: 0.14 * b, c: coat },
      { y: 0.44, rx: 0.2 * b, rz: 0.128 * b, c: coat },
      { y: 0.48, rx: 0.12, rz: 0.1, c: coatDark },
      { y: 0.55, rx: 0.095, rz: 0.088, c: coatDark },
    ];
    mb.loft(chestRings, SEG + 2, true, true);
    if (pal.shirt) {
      // Öppen rock: skjorta och guldkant framtill.
      mb.box(0, 0.24, 0.128 * b, 0.07, 0.42, 0.02, pal.shirt);
      if (pal.trim) {
        mb.box(-0.045, 0.24, 0.132 * b, 0.014, 0.44, 0.02, pal.trim);
        mb.box(0.045, 0.24, 0.132 * b, 0.014, 0.44, 0.02, pal.trim);
        for (let k = 0; k < 4; k++) mb.box(0.075, 0.1 + k * 0.1, 0.13 * b, 0.02, 0.02, 0.02, pal.trim);
        // Axelklaffar.
        mb.ellipsoid(0.19 * b, 0.45, 0, 0.075, 0.03, 0.07, 8, 4, coatDark);
        mb.ellipsoid(-0.19 * b, 0.45, 0, 0.075, 0.03, 0.07, 8, 4, coatDark);
        mb.box(0.19 * b, 0.475, 0, 0.11, 0.008, 0.11, pal.trim);
        mb.box(-0.19 * b, 0.475, 0, 0.11, 0.008, 0.11, pal.trim);
        // Glyf på ryggen (egen design: stiliserad vind).
        mb.box(0, 0.3, -0.142 * b, 0.02, 0.16, 0.01, pal.trim);
        mb.transform(M4.fromTRS(M4.create(), 0.04, 0.33, -0.142 * b, 0, 0, 0.7, 1, 1, 1)).box(0, 0, 0, 0.018, 0.12, 0.01, pal.trim);
        mb.transform(M4.fromTRS(M4.create(), -0.04, 0.33, -0.142 * b, 0, 0, -0.7, 1, 1, 1)).box(0, 0, 0, 0.018, 0.12, 0.01, pal.trim);
        mb.transform(null);
      }
    }
    if (opts.plates) {
      // Karapaxplattor som växer ur huden.
      mb.ellipsoid(0.07, 0.3, 0.1 * b, 0.1, 0.12, 0.06, 8, 5, pal.plate);
      mb.ellipsoid(-0.07, 0.3, 0.1 * b, 0.1, 0.12, 0.06, 8, 5, pal.plate);
      mb.ellipsoid(0.2 * b, 0.43, 0, 0.1, 0.07, 0.11, 8, 5, pal.plate);
      mb.ellipsoid(-0.2 * b, 0.43, 0, 0.1, 0.07, 0.11, 8, 5, pal.plate);
      mb.ellipsoid(0, 0.32, -0.1 * b, 0.15, 0.14, 0.06, 8, 5, pal.plate);
    }
    if (opts.robe) {
      mb.loft([
        { y: -0.95, rx: 0.36 * b, rz: 0.3 * b, c: pal.robe },
        { y: -0.4, rx: 0.26 * b, rz: 0.2 * b, c: pal.robe },
        { y: 0.02, rx: 0.17 * b, rz: 0.125 * b, c: pal.robe },
      ], SEG, false, false);
    }
    parts.chest = mb.build();

    // Huvud (pivot i nacken).
    mb = new MeshBuilder();
    mb.loft([{ y: -0.02, rx: 0.058, rz: 0.058, c: pal.skin }, { y: 0.09, rx: 0.052, rz: 0.055, c: pal.skin }], 8, false, false);
    mb.ellipsoid(0, 0.17, 0.005, 0.098, 0.122, 0.11, 12, 8, pal.skin);
    mb.ellipsoid(0, 0.105, 0.03, 0.078, 0.06, 0.08, 10, 6, pal.skin);      // käke
    mb.ellipsoid(0, 0.158, 0.108, 0.016, 0.03, 0.022, 6, 4, pal.skin);     // näsa
    mb.ellipsoid(0.098, 0.165, 0, 0.018, 0.032, 0.026, 6, 4, pal.skin);    // öron
    mb.ellipsoid(-0.098, 0.165, 0, 0.018, 0.032, 0.026, 6, 4, pal.skin);
    const eyeCol = pal.eye || col('#1a1410');
    mb.ellipsoid(0.037, 0.18, 0.094, 0.016, 0.011, 0.01, 6, 4, eyeCol);
    mb.ellipsoid(-0.037, 0.18, 0.094, 0.016, 0.011, 0.01, 6, 4, eyeCol);
    const brow = pal.hair || col('#2a1d18');
    mb.box(0.038, 0.205, 0.098, 0.04, 0.009, 0.012, brow);
    mb.box(-0.038, 0.205, 0.098, 0.04, 0.009, 0.012, brow);
    if (opts.hair && pal.hair) {
      // Vågigt mörkt hår i tofsar.
      mb.ellipsoid(0, 0.235, -0.012, 0.108, 0.075, 0.118, 10, 6, pal.hair);
      mb.ellipsoid(0, 0.18, -0.06, 0.1, 0.1, 0.08, 10, 6, pal.hair);
      const tufts = [[0.06, 0.27, 0.06, 0.4], [-0.05, 0.28, 0.05, -0.3], [0.0, 0.29, 0.0, 0.1], [0.08, 0.22, -0.06, 0.8], [-0.08, 0.22, -0.06, -0.8], [0.0, 0.14, -0.1, 0], [0.07, 0.13, -0.07, 0.5], [-0.07, 0.13, -0.07, -0.5]];
      for (const t of tufts) {
        mb.transform(M4.fromTRS(M4.create(), t[0], t[1], t[2], t[3], 0.3, t[3] * 0.5, 1, 1, 1));
        mb.ellipsoid(0, 0, 0, 0.04, 0.03, 0.06, 6, 4, pal.hair);
      }
      mb.transform(null);
    }
    if (opts.helmet) {
      mb.ellipsoid(0, 0.22, -0.01, 0.115, 0.09, 0.125, 10, 6, pal.helmet);
      mb.transform(M4.fromTRS(M4.create(), 0, 0.3, -0.03, 0, -0.4, 0, 1, 1, 1));
      mb.ellipsoid(0, 0, 0, 0.03, 0.06, 0.13, 6, 4, pal.helmet);
      mb.transform(null);
      mb.ellipsoid(0.07, 0.13, 0.06, 0.04, 0.05, 0.04, 6, 4, pal.helmet);
      mb.ellipsoid(-0.07, 0.13, 0.06, 0.04, 0.05, 0.04, 6, 4, pal.helmet);
    }
    if (pal.mask) mb.ellipsoid(0, 0.16, 0.07, 0.085, 0.06, 0.05, 8, 5, pal.mask);
    parts.head = mb.build();

    // Armar.
    const sleeve = pal.sleeve || coat;
    mb = new MeshBuilder();
    mb.loft([
      { y: 0.02, rx: 0.066 * b, rz: 0.066 * b, c: sleeve },
      { y: -0.1, rx: 0.062 * b, rz: 0.06 * b, c: sleeve },
      { y: -0.28, rx: 0.05 * b, rz: 0.05 * b, c: sleeve },
      { y: -0.31, rx: 0.047 * b, rz: 0.047 * b, c: sleeve },
    ], 8, true, true);
    if (opts.plates) mb.ellipsoid(0, -0.14, 0.02, 0.07 * b, 0.11, 0.07 * b, 8, 5, pal.plate);
    parts.upperArm = mb.build();
    mb = new MeshBuilder();
    mb.loft([
      { y: 0.02, rx: 0.048 * b, rz: 0.048 * b, c: sleeve },
      { y: -0.18, rx: 0.043 * b, rz: 0.04 * b, c: sleeve },
      { y: -0.18, rx: 0.05 * b, rz: 0.047 * b, c: pal.trim || pal.cuff || sleeve },
      { y: -0.23, rx: 0.047 * b, rz: 0.044 * b, c: pal.trim || pal.cuff || sleeve },
      { y: -0.23, rx: 0.035, rz: 0.03, c: pal.skin },
      { y: -0.27, rx: 0.033, rz: 0.028, c: pal.skin },
    ], 8, true, true);
    if (opts.plates) mb.ellipsoid(0, -0.12, 0.02, 0.055 * b, 0.1, 0.055 * b, 8, 5, pal.plate);
    parts.foreArm = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -0.055, 0.006, 0.036, 0.058, 0.03, 8, 5, pal.gloves || pal.skin);
    mb.ellipsoid(0.026, -0.04, 0.026, 0.014, 0.03, 0.014, 6, 4, pal.gloves || pal.skin);
    parts.hand = mb.build();

    // Ben.
    mb = new MeshBuilder();
    mb.loft([
      { y: 0.03, rx: 0.088 * b, rz: 0.092 * b, c: pal.pants },
      { y: -0.18, rx: 0.077 * b, rz: 0.082 * b, c: pal.pants },
      { y: -0.42, rx: 0.058 * b, rz: 0.062 * b, c: pal.pants },
      { y: -0.46, rx: 0.056 * b, rz: 0.058 * b, c: pal.pants },
    ], 8, true, true);
    if (opts.plates) mb.ellipsoid(0, -0.22, 0.05, 0.075 * b, 0.13, 0.05, 8, 5, pal.plate);
    parts.thigh = mb.build();
    mb = new MeshBuilder();
    mb.loft([
      { y: 0.02, rx: 0.056 * b, rz: 0.058 * b, c: pal.pants },
      { y: -0.1, rx: 0.06 * b, rz: 0.064 * b, c: pal.pants },
      { y: -0.12, rx: 0.068 * b, rz: 0.07 * b, c: pal.boots },
      { y: -0.16, rx: 0.064 * b, rz: 0.066 * b, c: pal.boots },
      { y: -0.4, rx: 0.048 * b, rz: 0.05 * b, c: pal.boots },
      { y: -0.45, rx: 0.05 * b, rz: 0.052 * b, c: pal.boots },
    ], 8, true, true);
    if (opts.plates) mb.ellipsoid(0, -0.2, 0.05, 0.06 * b, 0.12, 0.04, 8, 5, pal.plate);
    parts.shin = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -0.035, 0.06, 0.052 * b, 0.045, 0.125, 8, 5, pal.boots);
    mb.box(0, -0.075, 0.06, 0.1 * b, 0.02, 0.24, col('#1d1510'));
    parts.foot = mb.build();

    const body = { parts, bulk: b, hipY: 0.98, waistY: 0.14, neckY: 0.52, shoulderX: 0.2 * b, shoulderY: 0.45, hipX: 0.095 * b, upper: 0.3, fore: 0.25, thigh: 0.45, shin: 0.45 };
    this.cache[key] = body;
    return body;
  },
};

// Pose: vinklar i radianer. P = framåt (pitch), Y = gir, R = utåt (roll).
function makePose() {
  return {
    rootY: 0, pelvisP: 0, pelvisY: 0, pelvisR: 0, spineP: 0, spineY: 0, spineR: 0, neckP: 0, neckY: 0,
    shLP: 0, shLY: 0, shLR: 0.08, elL: 0.15, wrL: 0, shRP: 0, shRY: 0, shRR: 0.08, elR: 0.15, wrR: 0,
    hipLP: 0, hipLR: 0.03, knL: 0.05, anL: 0, hipRP: 0, hipRR: 0.03, knR: 0.05, anR: 0,
  };
}
function blendPose(out, a, b, t) {
  for (const k in out) out[k] = lerp(a[k], b[k], t);
  return out;
}

// Skelett: sätter ihop delarna och ritar dem. Returnerar ledernas matriser.
const Skeleton = {
  joints: null,
  _L: M4.create(),

  draw(body, root, pose, opts) {
    const J = this.joints || (this.joints = {
      pelvis: M4.create(), chest: M4.create(), head: M4.create(),
      upperL: M4.create(), foreL: M4.create(), handL: M4.create(),
      upperR: M4.create(), foreR: M4.create(), handR: M4.create(),
      thighL: M4.create(), shinL: M4.create(), footL: M4.create(),
      thighR: M4.create(), shinR: M4.create(), footR: M4.create(),
    });
    const L = this._L, P = body.parts;
    const link = (out, parent, x, y, z, yaw, pitch, roll) => {
      M4.fromTRS(L, x, y, z, yaw, pitch, roll, 1, 1, 1);
      return M4.multiply(out, parent, L);
    };
    link(J.pelvis, root, 0, body.hipY + pose.rootY, 0, pose.pelvisY, pose.pelvisP, pose.pelvisR);
    link(J.chest, J.pelvis, 0, body.waistY, 0, pose.spineY, pose.spineP, pose.spineR);
    link(J.head, J.chest, 0, body.neckY, 0, pose.neckY, pose.neckP, 0);
    // Vänster sida ligger på +x (modellen tittar mot +z).
    link(J.upperL, J.chest, body.shoulderX, body.shoulderY, 0, pose.shLY, -pose.shLP, pose.shLR);
    link(J.foreL, J.upperL, 0, -body.upper, 0, 0, -pose.elL, 0);
    link(J.handL, J.foreL, 0, -body.fore - 0.02, 0, 0, -pose.wrL, 0);
    link(J.upperR, J.chest, -body.shoulderX, body.shoulderY, 0, pose.shRY, -pose.shRP, -pose.shRR);
    link(J.foreR, J.upperR, 0, -body.upper, 0, 0, -pose.elR, 0);
    link(J.handR, J.foreR, 0, -body.fore - 0.02, 0, 0, -pose.wrR, 0);
    link(J.thighL, J.pelvis, body.hipX, -0.04, 0, 0, -pose.hipLP, pose.hipLR);
    link(J.shinL, J.thighL, 0, -body.thigh, 0, 0, pose.knL, 0);
    link(J.footL, J.shinL, 0, -body.shin, 0, 0, -pose.anL, 0);
    link(J.thighR, J.pelvis, -body.hipX, -0.04, 0, 0, -pose.hipRP, -pose.hipRR);
    link(J.shinR, J.thighR, 0, -body.thigh, 0, 0, pose.knR, 0);
    link(J.footR, J.shinR, 0, -body.shin, 0, 0, -pose.anR, 0);

    Renderer.draw(P.pelvis, J.pelvis, opts);
    Renderer.draw(P.chest, J.chest, opts);
    Renderer.draw(P.head, J.head, opts);
    for (const s of ['L', 'R']) {
      Renderer.draw(P.upperArm, J['upper' + s], opts);
      Renderer.draw(P.foreArm, J['fore' + s], opts);
      Renderer.draw(P.hand, J['hand' + s], opts);
      Renderer.draw(P.thigh, J['thigh' + s], opts);
      Renderer.draw(P.shin, J['shin' + s], opts);
      Renderer.draw(P.foot, J['foot' + s], opts);
    }
    return J;
  },
};

// --- Animationer ---
const Anim = {
  // Gång/löpning. phase i radianer, amt 0..1 (fart), run = 0 gång .. 1 sprint.
  locomotion(p, phase, amt, run) {
    const s = Math.sin(phase), c = Math.cos(phase);
    const stride = (0.45 + run * 0.35) * amt;
    p.hipLP = s * stride;
    p.hipRP = -s * stride;
    // Knät böjs mest när benet svingar fram.
    p.knL = 0.08 + Math.max(0, c) * (0.5 + run * 0.9) * amt + Math.max(0, -s) * 0.2 * amt;
    p.knR = 0.08 + Math.max(0, -c) * (0.5 + run * 0.9) * amt + Math.max(0, s) * 0.2 * amt;
    p.anL = -p.hipLP * 0.3 + 0.1 * amt;
    p.anR = -p.hipRP * 0.3 + 0.1 * amt;
    p.shLP = -s * (0.35 + run * 0.45) * amt;
    p.shRP = s * (0.35 + run * 0.45) * amt;
    p.elL = 0.25 + (0.3 + run * 0.9) * amt + Math.max(0, -p.shLP) * 0.3;
    p.elR = 0.25 + (0.3 + run * 0.9) * amt + Math.max(0, -p.shRP) * 0.3;
    p.shLR = 0.1 + run * 0.08;
    p.shRR = 0.1 + run * 0.08;
    p.spineY = s * 0.12 * amt;
    p.pelvisY = -s * 0.1 * amt;
    p.spineP = 0.05 + run * 0.18 * amt;
    p.rootY = -Math.abs(c) * 0.05 * amt * (0.6 + run);
  },

  idle(p, t) {
    const br = Math.sin(t * 1.6);
    p.spineP = 0.02 + br * 0.015;
    p.neckP = -0.02 - br * 0.01;
    p.shLR = 0.12 + br * 0.01; p.shRR = 0.12 + br * 0.01;
    p.elL = 0.2; p.elR = 0.25;
    p.shLP = 0.05; p.shRP = 0.08;
    p.hipLR = 0.06; p.hipRR = 0.04;
    p.knL = 0.06; p.knR = 0.1;
    p.pelvisR = Math.sin(t * 0.7) * 0.02;
    p.rootY = br * 0.006;
  },
};

// --- Tyg ---
// Ett rutnät av partiklar (verlet) vars översta rad sitter fast i kroppen.
class Cloth {
  // anchors: lokala punkter (i fästets rum) för översta raden, len = längd.
  constructor(anchors, rows, len, colors) {
    this.cols = anchors.length;
    this.rows = rows;
    this.anchors = anchors;
    this.seg = len / (rows - 1);
    const n = this.cols * rows;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.restH = [];
    for (let i = 0; i < this.cols - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      this.restH.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
    this.colors = colors; // { outer, hem }
    this.mesh = new DynamicMesh((this.cols - 1) * (rows - 1) * 6);
    this.data = new Float32Array((this.cols - 1) * (rows - 1) * 6 * VERT_FLOATS);
    this.ready = false;
    this._a = V3.create();
    this._id = M4.create();
  }

  // Placera tyget rakt nedåt från fästet.
  reset(mat, down) {
    const a = this._a;
    for (let i = 0; i < this.cols; i++) {
      M4.transformPoint(a, mat, this.anchors[i]);
      for (let r = 0; r < this.rows; r++) {
        const k = (r * this.cols + i) * 3;
        this.pos[k] = this.prev[k] = a[0] + down[0] * this.seg * r;
        this.pos[k + 1] = this.prev[k + 1] = a[1] + down[1] * this.seg * r;
        this.pos[k + 2] = this.prev[k + 2] = a[2] + down[2] * this.seg * r;
      }
    }
    this.ready = true;
  }

  // gravity = acceleration (m/s²), spheres = [[x,y,z,r], ...], bodyVel = kroppens fart.
  // Tyget följer med kroppens förflyttning; fartvinden läggs på som en kraft så
  // att simuleringen är stabil även i hög fart och låg bildfrekvens.
  update(dt, mat, gravity, spheres, bodyVel) {
    if (!this.ready) this.reset(mat, V3.normalize(V3.create(), gravity));
    dt = Math.min(dt, 1 / 20);
    const steps = dt > 1 / 45 ? 2 : 1;
    const P = this.pos, Q = this.prev, C = this.cols, R = this.rows;
    const a = this._a;
    // Flytta hela tyget lika mycket som fästet flyttat sig.
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < C; i++) {
      M4.transformPoint(a, mat, this.anchors[i]);
      mx += a[0] - P[i * 3]; my += a[1] - P[i * 3 + 1]; mz += a[2] - P[i * 3 + 2];
    }
    mx /= C; my /= C; mz /= C;
    for (let k = C * 3; k < P.length; k += 3) {
      P[k] += mx; P[k + 1] += my; P[k + 2] += mz;
      Q[k] += mx; Q[k + 1] += my; Q[k + 2] += mz;
    }
    for (let i = 0; i < C; i++) {
      M4.transformPoint(a, mat, this.anchors[i]);
      const k = i * 3;
      P[k] = Q[k] = a[0]; P[k + 1] = Q[k + 1] = a[1]; P[k + 2] = Q[k + 2] = a[2];
    }
    const h = dt / steps;
    const damp = this.damp || 0.97, dt2 = h * h;
    const bv = bodyVel || [0, 0, 0];
    const wind = this._w || (this._w = [0, 0, 0]);
    for (let d = 0; d < 3; d++) wind[d] = gravity[d] - bv[d] * 1.1;
    for (let st = 0; st < steps; st++) {
      for (let r = 1; r < R; r++) {
        for (let i = 0; i < C; i++) {
          const k = (r * C + i) * 3;
          for (let d = 0; d < 3; d++) {
            const x = P[k + d];
            P[k + d] = x + (x - Q[k + d]) * damp + wind[d] * dt2;
            Q[k + d] = x;
          }
        }
      }
      this.solve(spheres);
    }
  }

  solve(spheres) {
    const P = this.pos, C = this.cols, R = this.rows;
    for (let it = 0; it < 4; it++) {
      // Lodräta, vågräta och böjande avstånd.
      for (let r = 0; r < R - 1; r++) for (let i = 0; i < C; i++) this.constrain(r * C + i, (r + 1) * C + i, this.seg, r === 0);
      for (let r = 1; r < R; r++) for (let i = 0; i < C - 1; i++) this.constrain(r * C + i, r * C + i + 1, this.restH[i] * (1 + r * 0.07), false);
      for (let r = 0; r < R - 2; r++) for (let i = 0; i < C; i++) this.constrain(r * C + i, (r + 2) * C + i, this.seg * 2, r === 0, 0.4);
      // Kollision med kroppen.
      for (let r = 1; r < R; r++) {
        for (let i = 0; i < C; i++) {
          const k = (r * C + i) * 3;
          for (let s = 0; s < spheres.length; s++) {
            const sp = spheres[s];
            const dx = P[k] - sp[0], dy = P[k + 1] - sp[1], dz = P[k + 2] - sp[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < sp[3] * sp[3] && d2 > 1e-8) {
              const d = Math.sqrt(d2), f = (sp[3] - d) / d;
              P[k] += dx * f; P[k + 1] += dy * f; P[k + 2] += dz * f;
            }
          }
        }
      }
    }
  }

  constrain(i, j, rest, pinI, stiff) {
    const P = this.pos;
    const a = i * 3, b = j * 3;
    const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    const diff = ((d - rest) / d) * (stiff || 1);
    if (pinI) { P[b] -= dx * diff; P[b + 1] -= dy * diff; P[b + 2] -= dz * diff; }
    else {
      const h = diff * 0.5;
      P[a] += dx * h; P[a + 1] += dy * h; P[a + 2] += dz * h;
      P[b] -= dx * h; P[b + 1] -= dy * h; P[b + 2] -= dz * h;
    }
  }

  draw() {
    const P = this.pos, C = this.cols, R = this.rows, D = this.data;
    let o = 0;
    const nrm = (r, i, out) => {
      const k = (r * C + i) * 3;
      const r0 = Math.max(0, r - 1), r1 = Math.min(R - 1, r + 1), i0 = Math.max(0, i - 1), i1 = Math.min(C - 1, i + 1);
      const ka = (r1 * C + i) * 3, kb = (r0 * C + i) * 3, kc = (r * C + i1) * 3, kd = (r * C + i0) * 3;
      const ux = P[ka] - P[kb], uy = P[ka + 1] - P[kb + 1], uz = P[ka + 2] - P[kb + 2];
      const vx = P[kc] - P[kd], vy = P[kc + 1] - P[kd + 1], vz = P[kc + 2] - P[kd + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      out[0] = P[k]; out[1] = P[k + 1]; out[2] = P[k + 2];
      out[3] = nx / l; out[4] = ny / l; out[5] = nz / l;
    };
    const v = [0, 0, 0, 0, 0, 0];
    const put = (r, i) => {
      nrm(r, i, v);
      const c = r === R - 1 ? this.colors.hem : this.colors.outer;
      const shade = 1 - (r / R) * 0.18;
      D[o++] = v[0]; D[o++] = v[1]; D[o++] = v[2]; D[o++] = v[3]; D[o++] = v[4]; D[o++] = v[5];
      D[o++] = c[0] * shade; D[o++] = c[1] * shade; D[o++] = c[2] * shade; D[o++] = 0;
    };
    for (let r = 0; r < R - 1; r++) {
      for (let i = 0; i < C - 1; i++) {
        put(r, i); put(r + 1, i); put(r + 1, i + 1);
        put(r, i); put(r + 1, i + 1); put(r, i + 1);
      }
    }
    this.mesh.update(D, o / VERT_FLOATS);
    Renderer.draw(this.mesh, this._id, { noCull: true });
  }
}
