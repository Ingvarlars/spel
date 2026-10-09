'use strict';
// Tunna hjälpfunktioner runt WebGL2: shaderprogram, buffertar och texturer.

const GL = {
  gl: null,

  init(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return null;
    this.gl = gl;
    return gl;
  },

  compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      throw new Error('Shaderfel: ' + log + '\n' + lines);
    }
    return s;
  },

  // Länkar ett program och samlar uniform-platser i `u`.
  program(vs, fs, defines) {
    const gl = this.gl;
    const head = '#version 300 es\nprecision highp float;\nprecision highp sampler2DShadow;\n' + (defines || '');
    const p = gl.createProgram();
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, head + vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, head + fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Länkfel: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  },

  buffer(data, usage, target) {
    const gl = this.gl;
    const b = gl.createBuffer();
    gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
    gl.bufferData(target || gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    return b;
  },
};

// Vertexformat för vanliga modeller: position(3) normal(3) färg(4: rgb + självlysning).
const VERT_FLOATS = 10;
const ATTR = { pos: 0, normal: 1, color: 2, inst0: 3, inst1: 4, inst2: 5, inst3: 6, instColor: 7 };

class Mesh {
  constructor(data, count) {
    const gl = GL.gl;
    this.count = count;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = GL.buffer(data);
    const stride = VERT_FLOATS * 4;
    gl.enableVertexAttribArray(ATTR.pos);
    gl.vertexAttribPointer(ATTR.pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(ATTR.normal);
    gl.vertexAttribPointer(ATTR.normal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(ATTR.color);
    gl.vertexAttribPointer(ATTR.color, 4, gl.FLOAT, false, stride, 24);
    // Standardvärden för instansattribut när meshen ritas utan instanser.
    gl.vertexAttrib4f(ATTR.instColor, 1, 1, 1, 0);
    gl.bindVertexArray(null);
    this.instBuf = null;
    this.instCap = 0;
    this.cpu = data; // behålls för att kunna bakas ihop (LOD)
    // Gränslåda (för culling).
    let r = 0;
    for (let i = 0; i < count; i++) {
      const o = i * VERT_FLOATS;
      r = Math.max(r, Math.hypot(data[o], data[o + 1], data[o + 2]));
    }
    this.radius = r;
  }

  // Instansdata: 16 floats matris + 4 floats färg per instans.
  setInstances(data, n) {
    const gl = GL.gl;
    gl.bindVertexArray(this.vao);
    if (!this.instBuf || n > this.instCap) {
      if (this.instBuf) gl.deleteBuffer(this.instBuf);
      this.instCap = Math.max(n, 16);
      this.instBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.instCap * 20 * 4, gl.DYNAMIC_DRAW);
      const stride = 20 * 4;
      for (let k = 0; k < 4; k++) {
        gl.enableVertexAttribArray(ATTR.inst0 + k);
        gl.vertexAttribPointer(ATTR.inst0 + k, 4, gl.FLOAT, false, stride, k * 16);
        gl.vertexAttribDivisor(ATTR.inst0 + k, 1);
      }
      gl.enableVertexAttribArray(ATTR.instColor);
      gl.vertexAttribPointer(ATTR.instColor, 4, gl.FLOAT, false, stride, 64);
      gl.vertexAttribDivisor(ATTR.instColor, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 20);
    gl.bindVertexArray(null);
    this.instCount = n;
  }
}

// Mesh vars hörn skrivs om varje bildruta (t.ex. tyg).
class DynamicMesh extends Mesh {
  constructor(maxVerts) {
    super(new Float32Array(maxVerts * VERT_FLOATS), 0);
    this.max = maxVerts;
    this.radius = 100;
    const gl = GL.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, maxVerts * VERT_FLOATS * 4, gl.DYNAMIC_DRAW);
  }
  update(data, verts) {
    const gl = GL.gl;
    this.count = Math.min(verts, this.max);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, this.count * VERT_FLOATS);
  }
}

// Bygger platt skuggade lågpolygonsmodeller med vertexfärger.
class MeshBuilder {
  constructor() {
    this.data = [];
    this.m = null; // valfri transform för nästa former
  }

  // c = [r, g, b] eller [r, g, b, självlysning]
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, c) {
    if (this.m) {
      const t = MeshBuilder._p;
      M4.transformPoint(t, this.m, [ax, ay, az]); ax = t[0]; ay = t[1]; az = t[2];
      M4.transformPoint(t, this.m, [bx, by, bz]); bx = t[0]; by = t[1]; bz = t[2];
      M4.transformPoint(t, this.m, [cx, cy, cz]); cx = t[0]; cy = t[1]; cz = t[2];
    }
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const e = c[3] || 0;
    const d = this.data;
    d.push(ax, ay, az, nx, ny, nz, c[0], c[1], c[2], e);
    d.push(bx, by, bz, nx, ny, nz, c[0], c[1], c[2], e);
    d.push(cx, cy, cz, nx, ny, nz, c[0], c[1], c[2], e);
  }

  quad(a, b, c, d, col) {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col);
  }

  // Låda centrerad i (x, y, z) med storlek (sx, sy, sz).
  box(x, y, z, sx, sy, sz, col, colTop) {
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y - sy / 2, y1 = y + sy / 2, z0 = z - sz / 2, z1 = z + sz / 2;
    const top = colTop || col;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
    return this;
  }

  // Cylinder/kon längs y från y0 till y1 (r0 nedtill, r1 upptill).
  cyl(x, y0, z, r0, r1, h, seg, col, capCol) {
    const y1 = y0 + h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p00 = [x + c0 * r0, y0, z + s0 * r0], p10 = [x + c1 * r0, y0, z + s1 * r0];
      const p01 = [x + c0 * r1, y1, z + s0 * r1], p11 = [x + c1 * r1, y1, z + s1 * r1];
      if (r1 > 0.0001) this.quad(p00, p01, p11, p10, col);
      else this.tri(p00[0], p00[1], p00[2], x, y1, z, p10[0], p10[1], p10[2], col);
      if (capCol !== null) {
        if (r1 > 0.0001) this.tri(x, y1, z, p11[0], p11[1], p11[2], p01[0], p01[1], p01[2], capCol || col);
        this.tri(x, y0, z, p00[0], p00[1], p00[2], p10[0], p10[1], p10[2], capCol || col);
      }
    }
    return this;
  }

  // Låg-poly sfär (lat/long).
  sphere(x, y, z, r, seg, col, sy) {
    const rings = Math.max(3, Math.floor(seg / 2));
    sy = sy || 1;
    for (let j = 0; j < rings; j++) {
      const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        const p = (t, a) => [x + Math.sin(t) * Math.cos(a) * r, y + Math.cos(t) * r * sy, z + Math.sin(t) * Math.sin(a) * r];
        const a = p(t0, a0), b = p(t0, a1), c = p(t1, a1), d = p(t1, a0);
        if (j === 0) this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col);
        else if (j === rings - 1) this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col);
        else this.quad(a, b, c, d, col);
      }
    }
    return this;
  }

  // Vertex med egen normal (för mjukt skuggade former).
  vert(x, y, z, nx, ny, nz, c) {
    if (this.m) {
      const t = MeshBuilder._p, m = this.m;
      M4.transformPoint(t, m, [x, y, z]); x = t[0]; y = t[1]; z = t[2];
      const ax = m[0] * nx + m[4] * ny + m[8] * nz, ay = m[1] * nx + m[5] * ny + m[9] * nz, az = m[2] * nx + m[6] * ny + m[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      nx = ax / l; ny = ay / l; nz = az / l;
    }
    this.data.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], c[3] || 0);
  }

  // Loft: ringar längs y med elliptiskt tvärsnitt och jämna normaler.
  // rings: [{ y, rx, rz, x?, z?, c }], seg = antal hörn per ring.
  loft(rings, seg, capBottom, capTop) {
    const n = rings.length;
    const P = [];
    for (let i = 0; i < n; i++) {
      const r = rings[i], row = [];
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * TAU;
        row.push([(r.x || 0) + Math.sin(a) * r.rx, r.y, (r.z || 0) + Math.cos(a) * r.rz]);
      }
      P.push(row);
    }
    const N = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < seg; j++) {
        // Längs: närmaste grannringar med verklig längd.
        let a = P[Math.min(n - 1, i + 1)][j], b = P[Math.max(0, i - 1)][j];
        if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-4) { a = P[Math.min(n - 1, i + 2)][j]; b = P[Math.max(0, i - 2)][j]; }
        const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
        const c = P[i][(j + 1) % seg], d = P[i][(j + seg - 1) % seg];
        const vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
        let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
        const r = rings[i];
        const ox = P[i][j][0] - (r.x || 0), oz = P[i][j][2] - (r.z || 0);
        if (nx * ox + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz) || 1;
        row.push([nx / l, ny / l, nz / l]);
      }
      N.push(row);
    }
    for (let i = 0; i < n - 1; i++) {
      const c = rings[i + 1].c || rings[i].c;
      for (let j = 0; j < seg; j++) {
        const j2 = (j + 1) % seg;
        const a = P[i][j], b = P[i][j2], cc = P[i + 1][j2], d = P[i + 1][j];
        const na = N[i][j], nb = N[i][j2], nc = N[i + 1][j2], nd = N[i + 1][j];
        // Moturs sett utifrån.
        this.vert(a[0], a[1], a[2], na[0], na[1], na[2], c);
        this.vert(b[0], b[1], b[2], nb[0], nb[1], nb[2], c);
        this.vert(cc[0], cc[1], cc[2], nc[0], nc[1], nc[2], c);
        this.vert(a[0], a[1], a[2], na[0], na[1], na[2], c);
        this.vert(cc[0], cc[1], cc[2], nc[0], nc[1], nc[2], c);
        this.vert(d[0], d[1], d[2], nd[0], nd[1], nd[2], c);
      }
    }
    const cap = (i, down) => {
      const r = rings[i], c = r.c;
      const cx = r.x || 0, cz = r.z || 0;
      for (let j = 0; j < seg; j++) {
        const a = P[i][j], b = P[i][(j + 1) % seg];
        if (down) { this.vert(cx, r.y, cz, 0, -1, 0, c); this.vert(b[0], b[1], b[2], 0, -1, 0, c); this.vert(a[0], a[1], a[2], 0, -1, 0, c); }
        else { this.vert(cx, r.y, cz, 0, 1, 0, c); this.vert(a[0], a[1], a[2], 0, 1, 0, c); this.vert(b[0], b[1], b[2], 0, 1, 0, c); }
      }
    };
    if (capBottom) cap(0, true);
    if (capTop) cap(n - 1, false);
    return this;
  }

  // Mjukt skuggad ellipsoid.
  ellipsoid(cx, cy, cz, rx, ry, rz, seg, rings, c) {
    const P = (t, a) => {
      const st = Math.sin(t), ct = Math.cos(t), sa = Math.sin(a), ca = Math.cos(a);
      const x = st * sa, y = ct, z = st * ca;
      const nx = x / rx, ny = y / ry, nz = z / rz, l = Math.hypot(nx, ny, nz) || 1;
      return [cx + x * rx, cy + y * ry, cz + z * rz, nx / l, ny / l, nz / l];
    };
    for (let i = 0; i < rings; i++) {
      const t0 = (i / rings) * Math.PI, t1 = ((i + 1) / rings) * Math.PI;
      for (let j = 0; j < seg; j++) {
        const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU;
        const p00 = P(t0, a0), p01 = P(t0, a1), p10 = P(t1, a0), p11 = P(t1, a1);
        const v = (p) => this.vert(p[0], p[1], p[2], p[3], p[4], p[5], c);
        if (i > 0) { v(p00); v(p11); v(p01); }
        if (i < rings - 1) { v(p00); v(p10); v(p11); }
      }
    }
    return this;
  }

  // Applicera en transform på efterföljande former (null = ingen).
  transform(m) { this.m = m; return this; }

  build() {
    const arr = new Float32Array(this.data);
    return new Mesh(arr, arr.length / VERT_FLOATS);
  }
}
MeshBuilder._p = new Float32Array(3);

// Färghjälp: '#rrggbb' -> [r, g, b] (0..1), valfri självlysning.
function col(hex, emissive) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, emissive || 0];
}
function colMix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] || 0, b[3] || 0, t)]; }
function colShade(c, k) { return [c[0] * k, c[1] * k, c[2] * k, c[3] || 0]; }
