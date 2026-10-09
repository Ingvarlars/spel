'use strict';
// Tredjepersonskamera. Kamerans "upp" följer spelarens gravitation mjukt, så att
// man kan springa på klippväggar och tak utan att världen känns fel.

const Camera = {
  pos: V3.create(0, 5, -10),
  fwd: V3.create(0, 0, 1),      // tittriktning
  right: V3.create(-1, 0, 0),
  up: V3.create(0, 1, 0),        // vyns upp (vinkelrät mot fwd)
  refUp: V3.create(0, 1, 0),     // kamerans referens-upp (följer gravitationen)
  refFwd: V3.create(0, 0, 1),    // framåt i planet vinkelrätt mot refUp
  pitch: -0.25,
  dist: 6.5,
  distCur: 6.5,
  shoulder: 0.9,
  fov: 1.15,
  view: M4.create(),
  proj: M4.create(),
  viewProj: M4.create(),
  invViewProj: M4.create(),
  planes: new Float32Array(24),
  aspect: 1,
  shakeX: 0,
  shakeY: 0,
  _t: V3.create(),
  _t2: V3.create(),
  _target: V3.create(),

  reset(up, fwd) {
    V3.copy(this.refUp, up);
    V3.copy(this.refFwd, fwd);
    this.pitch = -0.25;
  },

  // Musrörelse: girar runt referens-upp, nickar runt höger-axeln.
  look(dx, dy) {
    V3.rotate(this.refFwd, this.refFwd, this.refUp, -dx);
    this.pitch = clamp(this.pitch - dy, -1.35, 1.25);
  },

  update(dt, target, playerUp, lockDir) {
    // Följ spelarens upp; vrid framåt-vektorn lika mycket.
    const before = this._t2;
    V3.copy(before, this.refUp);
    V3.rotateTowards(this.refUp, this.refUp, playerUp, dt * 3.2);
    const dotUU = clamp(V3.dot(before, this.refUp), -1, 1);
    if (dotUU < 0.99999) {
      const axis = V3.cross(this._t, before, this.refUp);
      V3.normalize(axis, axis);
      V3.rotate(this.refFwd, this.refFwd, axis, Math.acos(dotUU));
    }
    // Ortonormera framåt.
    V3.addScaled(this.refFwd, this.refFwd, this.refUp, -V3.dot(this.refFwd, this.refUp));
    if (V3.len(this.refFwd) < 0.01) {
      V3.set(this.refFwd, 0, 0, 1);
      V3.addScaled(this.refFwd, this.refFwd, this.refUp, -V3.dot(this.refFwd, this.refUp));
      if (V3.len(this.refFwd) < 0.01) V3.set(this.refFwd, 1, 0, 0);
    }
    V3.normalize(this.refFwd, this.refFwd);

    // Valfri målvändning (t.ex. mot en boss).
    if (lockDir) {
      const flat = this._t;
      V3.addScaled(flat, lockDir, this.refUp, -V3.dot(lockDir, this.refUp));
      if (V3.len(flat) > 0.1) {
        V3.normalize(flat, flat);
        V3.rotateTowards(this.refFwd, this.refFwd, flat, dt * 2.5);
      }
    }

    // Tittriktning = framåt nickad runt höger.
    V3.cross(this.right, this.refFwd, this.refUp);
    V3.normalize(this.right, this.right);
    V3.rotate(this.fwd, this.refFwd, this.right, this.pitch);
    V3.normalize(this.fwd, this.fwd);
    V3.cross(this.up, this.right, this.fwd);
    V3.normalize(this.up, this.up);

    // Placera kameran bakom och över axeln; dra in den om berg är i vägen.
    const t = this._target;
    V3.addScaled(t, target, this.refUp, 1.55);
    const back = this._t;
    V3.scale(back, this.fwd, -1);
    V3.addScaled(back, back, this.right, this.shoulder / this.dist);
    V3.normalize(back, back);
    const hit = World.raycast(t[0], t[1], t[2], back[0], back[1], back[2], this.dist, 0.35);
    const want = Math.max(1.2, hit - 0.45);
    this.distCur = want < this.distCur ? want : lerp(this.distCur, want, 1 - Math.exp(-4 * dt));
    V3.addScaled(this.pos, t, back, this.distCur);
    this.pos[0] += this.right[0] * this.shakeX + this.up[0] * this.shakeY;
    this.pos[1] += this.right[1] * this.shakeX + this.up[1] * this.shakeY;
    this.pos[2] += this.right[2] * this.shakeX + this.up[2] * this.shakeY;
    this.updateMatrices();
  },

  updateMatrices() {
    const c = this._t2;
    V3.add(c, this.pos, this.fwd);
    M4.lookAt(this.view, this.pos, c, this.up);
    M4.perspective(this.proj, this.fov, this.aspect, 0.15, 2600);
    M4.multiply(this.viewProj, this.proj, this.view);
    M4.invert(this.invViewProj, this.viewProj);
    // Frustumplan (för culling).
    const m = this.viewProj, p = this.planes;
    const rows = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]];
    for (let i = 0; i < 6; i++) {
      const [w, r, s] = rows[i];
      const a = m[w] + s * m[r], b = m[w + 4] + s * m[r + 4], cc = m[w + 8] + s * m[r + 8], d = m[w + 12] + s * m[r + 12];
      const l = Math.hypot(a, b, cc) || 1;
      p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = cc / l; p[i * 4 + 3] = d / l;
    }
  },

  sphereVisible(x, y, z, r) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z + p[i * 4 + 3] < -r) return false;
    }
    return true;
  },

  // Världspunkt -> skärmkoordinater (CSS-pixlar). Returnerar false bakom kameran.
  project(x, y, z, w, h, out) {
    const m = this.viewProj;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return false;
    out[0] = (cx / cw * 0.5 + 0.5) * w;
    out[1] = (1 - (cy / cw * 0.5 + 0.5)) * h;
    return true;
  },
};
