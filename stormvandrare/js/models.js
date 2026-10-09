'use strict';
// Lågpolygonsmodeller byggda av enkla former, med leder för procedurell animation.
// Varje del har sin pivot (led) i origo; riggen sätter ihop dem varje bildruta.

const Models = {
  cache: {},

  // Humanoid. pal: färger (col()-arrayer). opts: proportioner och tillbehör.
  humanoid(key, pal, opts) {
    if (this.cache[key]) return this.cache[key];
    opts = opts || {};
    const s = opts.scale || 1;
    const bulk = opts.bulk || 1;
    const parts = {};
    // Ben: pivot i höften, pekar nedåt.
    for (const side of [-1, 1]) {
      const mb = new MeshBuilder();
      mb.box(0, -0.25, 0, 0.17 * bulk, 0.5, 0.18 * bulk, pal.pants);
      mb.box(0, -0.68, 0, 0.15 * bulk, 0.4, 0.16 * bulk, pal.pants);
      mb.box(0, -0.9, 0.05, 0.17 * bulk, 0.12, 0.28, pal.boots);
      parts[side < 0 ? 'legL' : 'legR'] = mb.build();
    }
    // Bål: pivot i höften.
    {
      const mb = new MeshBuilder();
      mb.box(0, 0.08, 0, 0.36 * bulk, 0.18, 0.22 * bulk, pal.belt || pal.pants);
      mb.box(0, 0.36, 0, 0.42 * bulk, 0.42, 0.24 * bulk, pal.body);
      if (pal.plate) {
        mb.box(0, 0.4, 0.08 * bulk, 0.36 * bulk, 0.3, 0.12, pal.plate);
        mb.box(-0.26 * bulk, 0.55, 0, 0.16, 0.12, 0.26 * bulk, pal.plate);
        mb.box(0.26 * bulk, 0.55, 0, 0.16, 0.12, 0.26 * bulk, pal.plate);
      }
      if (pal.trim) mb.box(0, 0.36, 0.125 * bulk, 0.06, 0.4, 0.02, pal.trim);
      if (opts.coat) {
        // Rockskört bak.
        mb.quad([-0.2, 0.15, -0.12], [0.2, 0.15, -0.12], [0.24, -0.45, -0.24], [-0.24, -0.45, -0.24], pal.coat || pal.body);
        mb.quad([0.2, 0.15, -0.12], [-0.2, 0.15, -0.12], [-0.24, -0.45, -0.24], [0.24, -0.45, -0.24], pal.coat || pal.body);
      }
      if (opts.robe) mb.cyl(0, -0.85, 0, 0.36, 0.22, 1.0, 8, pal.robe, null);
      parts.torso = mb.build();
    }
    // Huvud: pivot i nacken.
    {
      const mb = new MeshBuilder();
      mb.box(0, 0.04, 0, 0.1, 0.08, 0.1, pal.skin);
      mb.sphere(0, 0.17, 0.01, 0.13, 7, pal.skin, 1.1);
      if (pal.hair) { mb.sphere(0, 0.22, -0.02, 0.135, 7, pal.hair, 0.75); }
      if (pal.helmet) {
        mb.sphere(0, 0.2, -0.01, 0.145, 7, pal.helmet, 0.8);
        mb.box(0, 0.33, -0.02, 0.05, 0.12, 0.28, pal.helmet);
      }
      if (pal.mask) mb.box(0, 0.17, 0.12, 0.2, 0.08, 0.04, pal.mask);
      if (pal.eye) {
        mb.box(-0.045, 0.18, 0.125, 0.035, 0.025, 0.02, pal.eye);
        mb.box(0.045, 0.18, 0.125, 0.035, 0.025, 0.02, pal.eye);
      }
      parts.head = mb.build();
    }
    // Armar: pivot i axeln, pekar nedåt.
    for (const side of [-1, 1]) {
      const mb = new MeshBuilder();
      mb.box(0, -0.18, 0, 0.13 * bulk, 0.36, 0.13 * bulk, pal.sleeve || pal.body);
      mb.box(0, -0.48, 0, 0.11 * bulk, 0.3, 0.11 * bulk, pal.sleeve || pal.body);
      mb.box(0, -0.66, 0, 0.1, 0.1, 0.1, pal.skin);
      if (pal.plate) mb.box(0, -0.42, 0, 0.14 * bulk, 0.16, 0.14 * bulk, pal.plate);
      parts[side < 0 ? 'armL' : 'armR'] = mb.build();
    }
    const rig = { parts, scale: s, bulk, hip: 0.95, shoulderY: 0.55, shoulderX: 0.26 * bulk, neck: 0.6 };
    this.cache[key] = rig;
    return rig;
  },

  // Shardblade: lång, smal klinga med vågig egg och glödande linjer.
  shardblade() {
    if (this.cache.blade) return this.cache.blade;
    const mb = new MeshBuilder();
    const steel = col('#dfe9f2'), edge = col('#bfe6ff', 0.9), dark = col('#5c6f86');
    // Fäste.
    mb.box(0, 0, 0, 0.05, 0.05, 0.28, dark);
    mb.box(0, 0, 0.16, 0.26, 0.06, 0.06, col('#8fa6bf'));
    // Klinga i segment (z framåt), lätt vågform.
    const segs = 8, len = 1.55;
    for (let i = 0; i < segs; i++) {
      const z0 = 0.18 + (i / segs) * len, z1 = 0.18 + ((i + 1) / segs) * len;
      const w0 = 0.07 * (1 - i / segs * 0.4) + Math.sin(i * 1.3) * 0.012, w1 = 0.07 * (1 - (i + 1) / segs * 0.4) + Math.sin((i + 1) * 1.3) * 0.012;
      const tip = i === segs - 1;
      const a0 = [-w0, 0, z0], b0 = [w0, 0, z0], a1 = [-(tip ? 0 : w1), 0, z1 + (tip ? 0.18 : 0)], b1 = [tip ? 0 : w1, 0, z1 + (tip ? 0.18 : 0)];
      const t = 0.015;
      mb.quad([a0[0], t, a0[2]], [a1[0], t, a1[2]], [b1[0], t, b1[2]], [b0[0], t, b0[2]], steel);
      mb.quad([b0[0], -t, b0[2]], [b1[0], -t, b1[2]], [a1[0], -t, a1[2]], [a0[0], -t, a0[2]], steel);
      mb.quad([b0[0], t, b0[2]], [b1[0], t, b1[2]], [b1[0], -t, b1[2]], [b0[0], -t, b0[2]], edge);
      mb.quad([a0[0], -t, a0[2]], [a1[0], -t, a1[2]], [a1[0], t, a1[2]], [a0[0], t, a0[2]], edge);
    }
    this.cache.blade = mb.build();
    return this.cache.blade;
  },
};

// Sätter ihop en humanoid. root = modellmatris för höften (y=0 vid fötterna).
// pose: { legL, legR, armL, armR (framåtsving), armLr, armRr (utåt), lean, head, crouch }
const Rig = {
  _root: M4.create(),
  _loc: M4.create(),
  _out: M4.create(),

  draw(rig, root, pose, opts) {
    const s = rig.scale;
    const L = this._loc, O = this._out;
    const hipY = rig.hip * s - (pose.crouch || 0);
    // Bål (lutning framåt).
    M4.fromTRS(L, 0, hipY, 0, pose.twist || 0, pose.lean || 0, pose.roll || 0, s, s, s);
    M4.multiply(O, root, L);
    const torso = M4.copy(this._root, O);
    Renderer.draw(rig.parts.torso, O, opts);
    // Huvud.
    M4.fromTRS(L, 0, rig.neck, 0, pose.head || 0, pose.headPitch || 0, 0, 1, 1, 1);
    M4.multiply(O, torso, L);
    Renderer.draw(rig.parts.head, O, opts);
    // Armar.
    // Modellen tittar mot +z, så vänster sida ligger på +x.
    M4.fromTRS(L, rig.shoulderX, rig.shoulderY, 0, 0, -(pose.armL || 0), pose.armLr || 0, 1, 1, 1);
    M4.multiply(O, torso, L);
    Renderer.draw(rig.parts.armL, O, opts);
    M4.fromTRS(L, -rig.shoulderX, rig.shoulderY, 0, pose.armRy || 0, -(pose.armR || 0), -(pose.armRr || 0), 1, 1, 1);
    M4.multiply(O, torso, L);
    Renderer.draw(rig.parts.armR, O, opts);
    const hand = pose.wantHand ? M4.copy(pose.wantHand, O) : null;
    // Ben (sitter i höften men följer inte bålens lutning).
    for (const side of [-1, 1]) {
      M4.fromTRS(L, -side * 0.1 * rig.bulk * s, hipY, 0, 0, -(side < 0 ? pose.legL || 0 : pose.legR || 0), 0, s, s, s);
      M4.multiply(O, root, L);
      Renderer.draw(side < 0 ? rig.parts.legL : rig.parts.legR, O, opts);
    }
    return hand;
  },
};

// --- Fiendernas färger ---
const PAL = {
  warrior: { skin: col('#3a2a2c'), pants: col('#4a2c22'), boots: col('#2a1d18'), belt: col('#6a3a24'), body: col('#3a2a2c'), sleeve: col('#3a2a2c'), plate: col('#a8452a'), helmet: col('#b5522f'), eye: col('#2a1a10') },
  archer: { skin: col('#3d2b2b'), pants: col('#5a3a26'), boots: col('#2a1d18'), belt: col('#6a4a2c'), body: col('#5d4a3a'), sleeve: col('#3d2b2b'), plate: col('#c46a3a'), helmet: col('#c46a3a'), eye: col('#2a1a10') },
  shield: { skin: col('#33262a'), pants: col('#3b2a22'), boots: col('#221812'), belt: col('#5a3424'), body: col('#33262a'), sleeve: col('#33262a'), plate: col('#8e3a24'), helmet: col('#8e3a24'), eye: col('#2a1a10') },
  thunder: { skin: col('#2a1e24'), pants: col('#2a1a20'), boots: col('#1a1214'), belt: col('#5a1a24'), body: col('#2a1e24'), sleeve: col('#2a1e24'), plate: col('#5a1f2a'), robe: col('#3a1420'), eye: col('#ff3a5a', 2.5) },
  hover: { skin: col('#3c2c30'), pants: col('#6a2a2a'), boots: col('#2a1d18'), belt: col('#c9a046'), body: col('#7a2e2a'), sleeve: col('#7a2e2a'), plate: col('#8a5a3a'), robe: col('#7a2e2a'), mask: col('#d8c7a8'), eye: col('#ff5a3a', 1.5) },
};

Object.assign(Models, {
  axe() {
    return this.cache.axe || (this.cache.axe = new MeshBuilder()
      .box(0, 0, 0.4, 0.05, 0.05, 1.0, col('#5a3d26'))
      .box(0, 0.12, 0.82, 0.04, 0.32, 0.22, col('#9aa4ab'))
      .box(0, -0.12, 0.82, 0.04, 0.32, 0.22, col('#9aa4ab')).build());
  },
  bow() {
    if (this.cache.bow) return this.cache.bow;
    const mb = new MeshBuilder();
    const wood = col('#5a3d26');
    for (let i = 0; i < 6; i++) {
      const a0 = -1 + i / 3, a1 = -1 + (i + 1) / 3;
      const p0 = [0, Math.sin(a0) * 0.7, Math.cos(a0) * 0.25], p1 = [0, Math.sin(a1) * 0.7, Math.cos(a1) * 0.25];
      mb.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, 0.04, Math.abs(p1[1] - p0[1]) + 0.04, 0.05, wood);
    }
    mb.box(0, 0, 0.13, 0.01, 1.3, 0.01, col('#e8e0d0'));
    return (this.cache.bow = mb.build());
  },
  shieldMesh() {
    return this.cache.shield || (this.cache.shield = new MeshBuilder()
      .box(0, 0, 0, 0.75, 1.5, 0.12, col('#7a5a3a'), col('#7a5a3a'))
      .box(0, 0, 0.07, 0.62, 1.3, 0.04, col('#9a3a24'))
      .box(0, 0, 0.1, 0.12, 1.1, 0.04, col('#c9a046')).build());
  },
  // Spjut längs +z med spetsen framåt.
  spear() {
    if (this.cache.spear) return this.cache.spear;
    const mb = new MeshBuilder();
    mb.box(0, 0, 0.6, 0.05, 0.05, 2.4, col('#5a3d26'));
    mb.transform(M4.fromTRS(M4.create(), 0, 0, 1.8, 0, Math.PI / 2, 0, 1, 1, 1));
    mb.cyl(0, 0, 0, 0.08, 0, 0.35, 4, col('#c0c8d0'), null);
    mb.transform(null);
    return (this.cache.spear = mb.build());
  },
  crab() {
    if (this.cache.crab) return this.cache.crab;
    const mb = new MeshBuilder();
    const shell = col('#8c7a68'), dark = col('#5e4f42');
    mb.sphere(0, 0.18, 0, 0.36, 7, shell, 0.55);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) mb.box(s * 0.35, 0.08, -0.15 + i * 0.15, 0.3, 0.05, 0.05, dark);
    mb.box(0.12, 0.32, 0.3, 0.04, 0.16, 0.04, dark); mb.box(-0.12, 0.32, 0.3, 0.04, 0.16, 0.04, dark);
    mb.box(0.12, 0.42, 0.3, 0.06, 0.06, 0.06, col('#ffb347', 1.2)); mb.box(-0.12, 0.42, 0.3, 0.06, 0.06, 0.06, col('#ffb347', 1.2));
    mb.box(0.22, 0.15, 0.42, 0.14, 0.1, 0.18, dark); mb.box(-0.22, 0.15, 0.42, 0.14, 0.1, 0.18, dark);
    return (this.cache.crab = mb.build());
  },
  voidspren() {
    if (this.cache.void) return this.cache.void;
    const mb = new MeshBuilder();
    mb.sphere(0, 0, 0, 0.45, 8, col('#1a0f22'));
    mb.sphere(0, 0, 0.18, 0.22, 6, col('#b45cff', 2.2));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      mb.transform(M4.fromTRS(M4.create(), Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.1, a, 1.2, 0, 1, 1, 1));
      mb.cyl(0, 0, 0, 0.08, 0.0, 0.8, 4, col('#2a1238'), null);
    }
    mb.transform(null);
    return (this.cache.void = mb.build());
  },
  brute() {
    if (this.cache.brute) return this.cache.brute;
    const parts = {};
    const rock = col('#7a6656'), dark = col('#544538'), crack = col('#ffb347', 2.2);
    let mb = new MeshBuilder();
    mb.box(0, 1.4, 0, 1.5, 1.3, 1.0, rock);
    mb.box(0, 2.2, 0.15, 0.7, 0.55, 0.6, dark);
    mb.box(0.15, 2.25, 0.46, 0.14, 0.08, 0.04, crack); mb.box(-0.15, 2.25, 0.46, 0.14, 0.08, 0.04, crack);
    mb.box(0.3, 1.5, 0.51, 0.08, 0.6, 0.02, crack); mb.box(-0.2, 1.2, 0.51, 0.5, 0.06, 0.02, crack);
    mb.box(0, 0.75, 0, 1.1, 0.4, 0.8, dark);
    parts.body = mb.build();
    mb = new MeshBuilder(); mb.box(0, -0.6, 0, 0.5, 1.3, 0.5, dark); mb.box(0, -1.3, 0.1, 0.62, 0.4, 0.6, rock); parts.arm = mb.build();
    mb = new MeshBuilder(); mb.box(0, -0.4, 0, 0.5, 0.8, 0.55, dark); parts.leg = mb.build();
    return (this.cache.brute = parts);
  },
});
