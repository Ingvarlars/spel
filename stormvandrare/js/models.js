'use strict';
// Lågpolygonsmodeller byggda av enkla former, med leder för procedurell animation.
// Varje del har sin pivot (led) i origo; riggen sätter ihop dem varje bildruta.

const Models = {
  cache: {},

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
    const shell = col('#8c7a68'), dark = col('#5e4f42'), belly = col('#b9a58a');
    mb.ellipsoid(0, 0.2, 0, 0.36, 0.17, 0.42, 10, 6, shell);
    mb.ellipsoid(0, 0.13, 0.02, 0.3, 0.08, 0.36, 8, 4, belly);
    for (let k = -1; k <= 1; k++) mb.ellipsoid(0, 0.33, k * 0.13, 0.25, 0.04, 0.05, 6, 3, dark);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      mb.transform(M4.fromTRS(M4.create(), s * 0.3, 0.12, -0.18 + i * 0.17, 0, 0, s * 0.9, 1, 1, 1));
      mb.ellipsoid(0, -0.12, 0, 0.03, 0.14, 0.03, 5, 3, dark);
    }
    mb.transform(null);
    for (const s of [-1, 1]) {
      mb.ellipsoid(s * 0.12, 0.38, 0.32, 0.025, 0.08, 0.025, 5, 3, dark);
      mb.ellipsoid(s * 0.12, 0.47, 0.33, 0.04, 0.04, 0.04, 6, 4, col('#ffb347', 1.4));
      mb.ellipsoid(s * 0.24, 0.15, 0.46, 0.09, 0.06, 0.12, 6, 4, dark);
    }
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
    const rock = col('#7a6656'), dark = col('#5a4a3e'), crack = col('#ffb347', 2.4);
    let mb = new MeshBuilder();
    mb.ellipsoid(0, 1.45, 0, 0.8, 0.65, 0.55, 10, 7, rock);
    mb.ellipsoid(0.35, 1.75, -0.1, 0.45, 0.4, 0.4, 8, 5, dark);
    mb.ellipsoid(-0.4, 1.7, -0.05, 0.42, 0.42, 0.4, 8, 5, dark);
    mb.ellipsoid(0, 2.2, 0.2, 0.32, 0.28, 0.3, 8, 6, rock);
    mb.ellipsoid(0.12, 2.24, 0.47, 0.06, 0.035, 0.03, 6, 3, crack);
    mb.ellipsoid(-0.12, 2.24, 0.47, 0.06, 0.035, 0.03, 6, 3, crack);
    mb.ellipsoid(0, 0.85, 0, 0.55, 0.3, 0.4, 8, 5, dark);
    // Glödande sprickor över bröstet.
    const cr = [[0.2, 1.5, 0.52, 0.03, 0.3, 0.6], [-0.15, 1.3, 0.53, 0.25, 0.03, -0.3], [0.05, 1.7, 0.5, 0.18, 0.025, 0.4]];
    for (const c of cr) {
      mb.transform(M4.fromTRS(M4.create(), c[0], c[1], c[2], 0, 0, c[5], 1, 1, 1));
      mb.ellipsoid(0, 0, 0, Math.max(c[3], 0.03), Math.max(c[4], 0.03), 0.02, 6, 3, crack);
    }
    mb.transform(null);
    parts.body = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -0.35, 0, 0.3, 0.42, 0.3, 8, 5, dark);
    mb.ellipsoid(0, -1.0, 0.05, 0.27, 0.4, 0.27, 8, 5, rock);
    mb.ellipsoid(0, -1.45, 0.1, 0.36, 0.26, 0.34, 8, 5, dark);
    parts.arm = mb.build();
    mb = new MeshBuilder();
    mb.ellipsoid(0, -0.38, 0, 0.3, 0.42, 0.32, 8, 5, dark);
    parts.leg = mb.build();
    return (this.cache.brute = parts);
  },
});
