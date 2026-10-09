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
