'use strict';
// Renderare i WebGL2: skuggkarta, himmel, ljussatta lågpolygonsmodeller med
// dimma, instansering, partiklar, band (spår/blixtar) och bloom.

const MAX_LIGHTS = 8;

// Gemensam GLSL: himlens färg i en riktning (används även för dimman).
const GLSL_SKY = `
uniform vec3 u_sunDir;
uniform vec3 u_skyTop;
uniform vec3 u_skyHorizon;
uniform vec3 u_skyGround;
uniform vec3 u_sunCol;
uniform float u_storm;
vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 c = mix(u_skyHorizon, u_skyTop, smoothstep(0.0, 0.55, h));
  c = mix(c, u_skyGround, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, u_sunDir), 0.0);
  c += u_sunCol * (pow(s, 6.0) * 0.12 + pow(s, 900.0) * 3.0) * (1.0 - u_storm);
  return c;
}
`;

const VS_LIT = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_color;
#ifdef INSTANCED
layout(location=3) in vec4 a_i0;
layout(location=4) in vec4 a_i1;
layout(location=5) in vec4 a_i2;
layout(location=6) in vec4 a_i3;
#endif
layout(location=7) in vec4 a_icolor;
uniform mat4 u_model;
uniform mat4 u_viewProj;
uniform mat4 u_lightViewProj;
uniform vec4 u_retract;     // xyz = spelare, w = radie (gräs)
uniform float u_retractAll; // stormen får allt gräs att dra sig undan
uniform float u_time;
out vec3 v_normal;
out vec4 v_color;
out vec3 v_world;
out vec4 v_shadow;
void main() {
#ifdef INSTANCED
  mat4 model = mat4(a_i0, a_i1, a_i2, a_i3);
#else
  mat4 model = u_model;
#endif
  vec3 p = a_pos;
#ifdef GRASS
  vec3 base = model[3].xyz;
  float d = distance(base, u_retract.xyz);
  float k = smoothstep(u_retract.w * 0.35, u_retract.w, d) * (1.0 - u_retractAll);
  p.y *= mix(0.06, 1.0, k);
  p.x += sin(u_time * 2.0 + base.x * 0.3 + base.z * 0.2) * 0.08 * p.y * k;
#endif
  vec4 w = model * vec4(p, 1.0);
  v_world = w.xyz;
  v_normal = mat3(model) * a_normal;
  v_color = vec4(a_color.rgb * a_icolor.rgb, a_color.a + a_icolor.a);
  v_shadow = u_lightViewProj * w;
  gl_Position = u_viewProj * w;
}`;

const FS_LIT = GLSL_SKY + `
in vec3 v_normal;
in vec4 v_color;
in vec3 v_world;
in vec4 v_shadow;
uniform sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec3 u_camPos;
uniform vec3 u_ambientSky;
uniform vec3 u_ambientGround;
uniform float u_fog;
uniform vec4 u_tint;      // rgb = blixt mot färg, a = styrka
uniform float u_alpha;
uniform float u_emissive; // extra självlysning för hela modellen
uniform int u_numLights;
uniform vec4 u_lightPos[${MAX_LIGHTS}];  // xyz, radie
uniform vec3 u_lightCol[${MAX_LIGHTS}];
uniform float u_chasmFloor;
out vec4 o_color;

float shadowAt(vec4 sc, float ndl) {
  vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0015 + 0.003 * (1.0 - ndl);
  float s = 0.0;
  for (int i = -1; i <= 1; i += 2)
    for (int j = -1; j <= 1; j += 2)
      s += texture(u_shadowMap, vec3(p.xy + vec2(float(i), float(j)) * u_shadowTexel * 0.75, p.z - bias));
  return s * 0.25;
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 albedo = v_color.rgb;
  float ndl = max(dot(N, u_sunDir), 0.0);
  float sh = ndl > 0.0 ? shadowAt(v_shadow, ndl) : 0.0;
  vec3 hemi = mix(u_ambientGround, u_ambientSky, N.y * 0.5 + 0.5);
  // Klyftorna blir mörkare och kallare ju djupare man kommer.
  float depth = smoothstep(2.0, u_chasmFloor, v_world.y);
  vec3 sun = u_sunCol * ndl * sh * (1.0 - depth * 0.7);
  vec3 lit = albedo * (hemi * (1.0 - depth * 0.45) + sun);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_numLights) break;
    vec3 L = u_lightPos[i].xyz - v_world;
    float d = length(L);
    float att = clamp(1.0 - d / u_lightPos[i].w, 0.0, 1.0);
    att *= att;
    lit += albedo * u_lightCol[i] * (max(dot(N, L / max(d, 0.001)), 0.0) * 0.8 + 0.2) * att;
  }
  float em = v_color.a + u_emissive;
  lit += albedo * em * 2.5;
  lit = mix(lit, u_tint.rgb, u_tint.a);
  vec3 V = v_world - u_camPos;
  float dist = length(V);
  float f = 1.0 - exp(-pow(dist * u_fog, 1.6));
  f = max(f, depth * 0.35);
  vec3 fogc = skyColor(normalize(V) * vec3(1.0, 0.25, 1.0));
  fogc = mix(fogc, vec3(0.16, 0.2, 0.26), depth * 0.6);
  o_color = vec4(mix(lit, fogc, clamp(f, 0.0, 1.0)), u_alpha);
}`;

const VS_SHADOW = `
layout(location=0) in vec3 a_pos;
#ifdef INSTANCED
layout(location=3) in vec4 a_i0;
layout(location=4) in vec4 a_i1;
layout(location=5) in vec4 a_i2;
layout(location=6) in vec4 a_i3;
#endif
uniform mat4 u_model;
uniform mat4 u_lightViewProj;
void main() {
#ifdef INSTANCED
  mat4 model = mat4(a_i0, a_i1, a_i2, a_i3);
#else
  mat4 model = u_model;
#endif
  gl_Position = u_lightViewProj * model * vec4(a_pos, 1.0);
}`;
const FS_SHADOW = `out vec4 o; void main() { o = vec4(1.0); }`;

const VS_FULL = `
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_SKY = GLSL_SKY + `
in vec2 v_uv;
uniform mat4 u_invViewProj;
uniform float u_time;
uniform vec3 u_cloudCol;
out vec4 o_color;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec4 a = u_invViewProj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec4 b = u_invViewProj * vec4(v_uv * 2.0 - 1.0, -1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w - b.xyz / b.w);
  vec3 c = skyColor(d);
  // Moln projicerade på ett plan högt upp.
  if (d.y > 0.01) {
    vec2 uv = d.xz / d.y * 0.6 + vec2(u_time * 0.01, u_time * 0.004);
    float cov = mix(0.55, 0.3, u_storm);
    float cl = smoothstep(cov, cov + 0.3, fbm(uv));
    float lightSide = max(dot(d, u_sunDir), 0.0);
    vec3 cc = mix(u_cloudCol, u_cloudCol * 1.15 + u_sunCol * 0.15, lightSide);
    c = mix(c, cc, cl * smoothstep(0.01, 0.18, d.y) * 0.9);
  }
  o_color = vec4(c, 1.0);
}`;

const VS_PART = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_posSize;
layout(location=2) in vec4 a_col;
uniform mat4 u_viewProj;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
out vec2 v_uv;
out vec4 v_col;
void main() {
  vec3 p = a_posSize.xyz + (u_camRight * a_corner.x + u_camUp * a_corner.y) * a_posSize.w;
  v_uv = a_corner;
  v_col = a_col;
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
const FS_PART = `
in vec2 v_uv;
in vec4 v_col;
uniform float u_soft;
out vec4 o_color;
void main() {
  float r = length(v_uv);
  if (r > 1.0) discard;
  float a = mix(1.0, 1.0 - r * r, u_soft);
  o_color = vec4(v_col.rgb, v_col.a * a);
}`;

const VS_RIB = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
uniform mat4 u_viewProj;
out vec4 v_col;
void main() { v_col = a_col; gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;
const FS_RIB = `in vec4 v_col; out vec4 o_color; void main() { o_color = v_col; }`;

const FS_BRIGHT = `
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
out vec4 o_color;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  o_color = vec4(c * smoothstep(u_threshold, u_threshold + 0.35, l), 1.0);
}`;
const FS_BLUR = `
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
out vec4 o_color;
void main() {
  vec3 s = texture(u_tex, v_uv).rgb * 0.227;
  s += texture(u_tex, v_uv + u_dir * 1.385).rgb * 0.316;
  s += texture(u_tex, v_uv - u_dir * 1.385).rgb * 0.316;
  s += texture(u_tex, v_uv + u_dir * 3.231).rgb * 0.07;
  s += texture(u_tex, v_uv - u_dir * 3.231).rgb * 0.07;
  o_color = vec4(s, 1.0);
}`;
const FS_COMPOSITE = `
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomStr;
uniform float u_exposure;
uniform vec3 u_grade;    // färgton (varm/kall)
uniform float u_vignette;
uniform vec4 u_overlay;  // rgb, styrka (skada, blixt)
out vec4 o_color;
void main() {
  vec3 c = texture(u_scene, v_uv).rgb + texture(u_bloom, v_uv).rgb * u_bloomStr;
  c *= u_exposure;
  c = c / (1.0 + c * 0.25);               // mjuk tonmappning
  c = pow(c, vec3(0.95)) * u_grade;
  vec2 q = v_uv - 0.5;
  c *= 1.0 - dot(q, q) * u_vignette;
  c = mix(c, u_overlay.rgb, u_overlay.a);
  o_color = vec4(c, 1.0);
}`;

const Renderer = {
  gl: null,
  w: 1, h: 1,
  hdr: false,
  items: [],     // ritköer
  itemCount: 0,
  instItems: [],
  lights: [],
  env: null,
  cam: null,
  time: 0,
  shadowSize: 2048,
  lightViewProj: M4.create(),
  partData: null,

  init(canvas) {
    const gl = GL.init(canvas);
    if (!gl) return false;
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.progLit = GL.program(VS_LIT, FS_LIT, '');
    this.progLitInst = GL.program(VS_LIT, FS_LIT, '#define INSTANCED\n');
    this.progGrass = GL.program(VS_LIT, FS_LIT, '#define INSTANCED\n#define GRASS\n');
    this.progShadow = GL.program(VS_SHADOW, FS_SHADOW, '');
    this.progShadowInst = GL.program(VS_SHADOW, FS_SHADOW, '#define INSTANCED\n');
    this.progSky = GL.program(VS_FULL, FS_SKY, '');
    this.progPart = GL.program(VS_PART, FS_PART, '');
    this.progRib = GL.program(VS_RIB, FS_RIB, '');
    this.progBright = GL.program(VS_FULL, FS_BRIGHT, '');
    this.progBlur = GL.program(VS_FULL, FS_BLUR, '');
    this.progComp = GL.program(VS_FULL, FS_COMPOSITE, '');
    this.emptyVao = gl.createVertexArray();

    // Skuggkarta.
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Partiklar: en instansierad fyrkant.
    this.partMax = 6000;
    this.partData = new Float32Array(this.partMax * 8);
    this.partVao = gl.createVertexArray();
    gl.bindVertexArray(this.partVao);
    GL.buffer(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    // Band: dynamiska trianglar med färg.
    this.ribMax = 30000;
    this.ribData = new Float32Array(this.ribMax * 7);
    this.ribVao = gl.createVertexArray();
    gl.bindVertexArray(this.ribVao);
    this.ribBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ribData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    this.ribCountAdd = 0;
    this.ribCountAlpha = 0;
    this.ribAlphaStart = this.ribMax / 2;

    for (let i = 0; i < 4096; i++) this.items.push({ mesh: null, model: M4.create(), tint: new Float32Array(4), emissive: 0, alpha: 1, shadow: true, noCull: false });
    this.lightPosArr = new Float32Array(MAX_LIGHTS * 4);
    this.lightColArr = new Float32Array(MAX_LIGHTS * 3);
    return true;
  },

  makeTarget(w, h, internal, format, type, depth, samples) {
    const gl = this.gl;
    const t = { w, h, fbo: gl.createFramebuffer(), tex: null, msFbo: null };
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    if (depth) {
      // Multisamplad bild + djup som sedan löses upp till texturen.
      t.msFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.msFbo);
      const cb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, cb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, internal, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cb);
      const db = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, db);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db);
      t.rbs = [cb, db];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return t;
  },

  freeTarget(t) {
    if (!t) return;
    const gl = this.gl;
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.tex);
    if (t.msFbo) { gl.deleteFramebuffer(t.msFbo); t.rbs.forEach((r) => gl.deleteRenderbuffer(r)); }
  },

  resize(w, h, scale) {
    const gl = this.gl;
    this.w = Math.max(1, Math.floor(w * scale));
    this.h = Math.max(1, Math.floor(h * scale));
    gl.canvas.width = this.w;
    gl.canvas.height = this.h;
    [this.scene, this.bloomA, this.bloomB].forEach((t) => this.freeTarget(t));
    const internal = this.hdr ? gl.RGBA16F : gl.RGBA8;
    const type = this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    this.scene = this.makeTarget(this.w, this.h, internal, gl.RGBA, type, true, samples);
    const bw = Math.max(1, this.w >> 2), bh = Math.max(1, this.h >> 2);
    this.bloomA = this.makeTarget(bw, bh, internal, gl.RGBA, type, false);
    this.bloomB = this.makeTarget(bw, bh, internal, gl.RGBA, type, false);
  },

  // --- Köer ---
  begin(cam, env, time) {
    this.cam = cam;
    this.env = env;
    this.time = time;
    this.itemCount = 0;
    this.instItems.length = 0;
    this.lights.length = 0;
    this.partCountAdd = 0;
    this.partCountAlpha = 0;
    this.partAlphaStart = this.partMax / 2;
    this.ribCountAdd = 0;
    this.ribCountAlpha = 0;
  },

  // Lägg en modell i kön. Returnerar posten så att man kan sätta tint m.m.
  draw(mesh, model, opts) {
    if (this.itemCount >= this.items.length) return null;
    const it = this.items[this.itemCount++];
    it.mesh = mesh;
    it.model.set(model);
    it.tint[0] = it.tint[1] = it.tint[2] = it.tint[3] = 0;
    it.emissive = 0;
    it.alpha = 1;
    it.shadow = true;
    it.noCull = false;
    if (opts) {
      if (opts.noCull) it.noCull = true;
      if (opts.tint) it.tint.set(opts.tint);
      if (opts.emissive) it.emissive = opts.emissive;
      if (opts.alpha !== undefined) it.alpha = opts.alpha;
      if (opts.shadow === false) it.shadow = false;
    }
    return it;
  },

  // Instansierad mesh (instanser satta med mesh.setInstances).
  drawInstanced(mesh, grass, shadow) {
    if (mesh.instCount > 0) this.instItems.push({ mesh, grass: !!grass, shadow: shadow !== false });
  },

  light(x, y, z, r, g, b, radius) {
    this.lights.push({ x, y, z, r, g, b, radius });
  },

  // Partikel: additiv (lysande) eller vanlig.
  particle(x, y, z, size, r, g, b, a, additive) {
    let i;
    if (additive) { if (this.partCountAdd >= this.partAlphaStart) return; i = this.partCountAdd++; }
    else { if (this.partCountAlpha >= this.partMax - this.partAlphaStart) return; i = this.partAlphaStart + this.partCountAlpha++; }
    const d = this.partData, o = i * 8;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
  },

  // Triangel i bandbufferten (additiv eller vanlig blandning).
  ribTri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, a0, a1, a2, additive) {
    let i;
    if (additive) { if (this.ribCountAdd + 3 > this.ribAlphaStart) return; i = this.ribCountAdd; this.ribCountAdd += 3; }
    else { if (this.ribCountAlpha + 3 > this.ribMax - this.ribAlphaStart) return; i = this.ribAlphaStart + this.ribCountAlpha; this.ribCountAlpha += 3; }
    const d = this.ribData;
    let o = i * 7;
    d[o++] = ax; d[o++] = ay; d[o++] = az; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a0;
    d[o++] = bx; d[o++] = by; d[o++] = bz; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a1;
    d[o++] = cx; d[o++] = cy; d[o++] = cz; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a2;
  },

  // Band längs punkter (array av [x,y,z]) med bredd, vänt mot kameran.
  ribbon(pts, width, r, g, b, alpha, additive, taper) {
    const n = pts.length;
    if (n < 2) return;
    const cam = this.cam.pos;
    let px0 = 0, py0 = 0, pz0 = 0, px1 = 0, py1 = 0, pz1 = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
      const vx = cam[0] - p[0], vy = cam[1] - p[1], vz = cam[2] - p[2];
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
      const l = Math.hypot(sx, sy, sz) || 1;
      const t = i / (n - 1);
      const wdt = width * (taper ? Math.sin(t * Math.PI) * 0.8 + 0.2 : 1) / l * 0.5;
      sx *= wdt; sy *= wdt; sz *= wdt;
      const ax = p[0] - sx, ay = p[1] - sy, az = p[2] - sz, bx = p[0] + sx, by = p[1] + sy, bz = p[2] + sz;
      if (i > 0) {
        const aPrev = alpha * (taper ? (i - 1) / (n - 1) : 1), aCur = alpha * (taper ? t : 1);
        this.ribTri(px0, py0, pz0, px1, py1, pz1, bx, by, bz, r, g, b, aPrev, aPrev, aCur, additive);
        this.ribTri(px0, py0, pz0, bx, by, bz, ax, ay, az, r, g, b, aPrev, aCur, aCur, additive);
      }
      px0 = ax; py0 = ay; pz0 = az; px1 = bx; py1 = by; pz1 = bz;
    }
  },

  // --- Rendering ---
  setLitUniforms(prog) {
    const gl = this.gl, u = prog.u, e = this.env, c = this.cam;
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(u.u_viewProj, false, c.viewProj);
    gl.uniformMatrix4fv(u.u_lightViewProj, false, this.lightViewProj);
    gl.uniform3fv(u.u_sunDir, e.sunDir);
    gl.uniform3fv(u.u_sunCol, e.sunCol);
    gl.uniform3fv(u.u_skyTop, e.skyTop);
    gl.uniform3fv(u.u_skyHorizon, e.skyHorizon);
    gl.uniform3fv(u.u_skyGround, e.skyGround);
    gl.uniform3fv(u.u_ambientSky, e.ambientSky);
    gl.uniform3fv(u.u_ambientGround, e.ambientGround);
    gl.uniform1f(u.u_storm, e.storm);
    gl.uniform1f(u.u_fog, e.fog);
    gl.uniform1f(u.u_chasmFloor, e.chasmFloor);
    gl.uniform3fv(u.u_camPos, c.pos);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform1f(u.u_shadowTexel, 1 / this.shadowSize);
    gl.uniform4f(u.u_retract, e.retract[0], e.retract[1], e.retract[2], e.retract[3]);
    gl.uniform1f(u.u_retractAll, e.retractAll);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.u_shadowMap, 0);
    gl.uniform1i(u.u_numLights, this.numLights);
    gl.uniform4fv(u.u_lightPos, this.lightPosArr);
    gl.uniform3fv(u.u_lightCol, this.lightColArr);
    gl.uniform4f(u.u_tint, 0, 0, 0, 0);
    gl.uniform1f(u.u_alpha, 1);
    gl.uniform1f(u.u_emissive, 0);
  },

  prepareLights() {
    const c = this.cam.pos;
    this.lights.sort((a, b) => ((a.x - c[0]) ** 2 + (a.y - c[1]) ** 2 + (a.z - c[2]) ** 2) - ((b.x - c[0]) ** 2 + (b.y - c[1]) ** 2 + (b.z - c[2]) ** 2));
    this.numLights = Math.min(MAX_LIGHTS, this.lights.length);
    for (let i = 0; i < this.numLights; i++) {
      const l = this.lights[i];
      this.lightPosArr.set([l.x, l.y, l.z, l.radius], i * 4);
      this.lightColArr.set([l.r, l.g, l.b], i * 3);
    }
  },

  // Ortografisk ljuskamera kring fokuspunkten (låst till texlar mot fladder).
  updateLightMatrix(focus) {
    const e = this.env;
    const size = e.shadowRange || 70;
    const texel = (size * 2) / this.shadowSize;
    const view = this._lv || (this._lv = M4.create());
    const proj = this._lp || (this._lp = M4.create());
    const eye = [focus[0] + e.sunDir[0] * 200, focus[1] + e.sunDir[1] * 200, focus[2] + e.sunDir[2] * 200];
    M4.lookAt(view, eye, focus, Math.abs(e.sunDir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    // Snappa i ljusets rum.
    const fx = view[0] * focus[0] + view[4] * focus[1] + view[8] * focus[2] + view[12];
    const fy = view[1] * focus[0] + view[5] * focus[1] + view[9] * focus[2] + view[13];
    const ox = fx - Math.floor(fx / texel) * texel, oy = fy - Math.floor(fy / texel) * texel;
    M4.ortho(proj, -size - ox, size - ox, -size - oy, size - oy, 1, 450);
    M4.multiply(this.lightViewProj, proj, view);
  },

  render(focus) {
    const gl = this.gl;
    this.prepareLights();
    this.updateLightMatrix(focus);

    // 1. Skuggpass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    let prog = this.progShadow;
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.u_lightViewProj, false, this.lightViewProj);
    for (let i = 0; i < this.itemCount; i++) {
      const it = this.items[i];
      if (!it.shadow || it.alpha < 1) continue;
      gl.uniformMatrix4fv(prog.u.u_model, false, it.model);
      gl.bindVertexArray(it.mesh.vao);
      if (it.noCull) gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count);
      if (it.noCull) gl.enable(gl.CULL_FACE);
    }
    prog = this.progShadowInst;
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.u_lightViewProj, false, this.lightViewProj);
    for (const it of this.instItems) {
      if (!it.shadow || it.grass) continue;
      gl.bindVertexArray(it.mesh.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, it.mesh.count, it.mesh.instCount);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // 2. Scenen till den multisamplade bilden.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.msFbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Himmel.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    prog = this.progSky;
    gl.useProgram(prog.p);
    const e = this.env;
    gl.uniformMatrix4fv(prog.u.u_invViewProj, false, this.cam.invViewProj);
    gl.uniform3fv(prog.u.u_sunDir, e.sunDir);
    gl.uniform3fv(prog.u.u_sunCol, e.sunCol);
    gl.uniform3fv(prog.u.u_skyTop, e.skyTop);
    gl.uniform3fv(prog.u.u_skyHorizon, e.skyHorizon);
    gl.uniform3fv(prog.u.u_skyGround, e.skyGround);
    gl.uniform3fv(prog.u.u_cloudCol, e.cloudCol);
    gl.uniform1f(prog.u.u_storm, e.storm);
    gl.uniform1f(prog.u.u_time, this.time);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Opaka modeller.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    prog = this.progLit;
    this.setLitUniforms(prog);
    const u = prog.u;
    const transparent = this._transp || (this._transp = []);
    transparent.length = 0;
    for (let i = 0; i < this.itemCount; i++) {
      const it = this.items[i];
      if (it.alpha < 1) { transparent.push(it); continue; }
      this.drawItem(prog, it);
    }
    prog = this.progLitInst;
    this.setLitUniforms(prog);
    for (const it of this.instItems) {
      if (it.grass) continue;
      gl.bindVertexArray(it.mesh.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, it.mesh.count, it.mesh.instCount);
    }
    prog = this.progGrass;
    this.setLitUniforms(prog);
    gl.disable(gl.CULL_FACE);
    for (const it of this.instItems) {
      if (!it.grass) continue;
      gl.bindVertexArray(it.mesh.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, it.mesh.count, it.mesh.instCount);
    }

    // Genomskinligt (stormmur m.m.).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    if (transparent.length) {
      prog = this.progLit;
      this.setLitUniforms(prog);
      for (const it of transparent) this.drawItem(prog, it);
    }
    void u;

    // Band och partiklar.
    this.drawRibbons(false);
    this.drawParticles(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    this.drawRibbons(true);
    this.drawParticles(true);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    // 3. Lös upp multisamplingen.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.scene.msFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fbo);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    // 4. Bloom.
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.emptyVao);
    const bw = this.bloomA.w, bh = this.bloomA.h;
    gl.viewport(0, 0, bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.fbo);
    prog = this.progBright;
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(prog.u.u_tex, 0);
    gl.uniform1f(prog.u.u_threshold, this.hdr ? 0.95 : 0.8);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    prog = this.progBlur;
    gl.useProgram(prog.p);
    for (let k = 0; k < 2; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
      gl.uniform2f(prog.u.u_dir, (1 + k) / bw, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomB.tex);
      gl.uniform2f(prog.u.u_dir, 0, (1 + k) / bh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 5. Slutbild till skärmen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    prog = this.progComp;
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(prog.u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
    gl.uniform1i(prog.u.u_bloom, 1);
    gl.uniform1f(prog.u.u_bloomStr, e.bloom);
    gl.uniform1f(prog.u.u_exposure, e.exposure);
    gl.uniform3fv(prog.u.u_grade, e.grade);
    gl.uniform1f(prog.u.u_vignette, e.vignette);
    gl.uniform4fv(prog.u.u_overlay, e.overlay);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  },

  drawItem(prog, it) {
    const gl = this.gl, u = prog.u;
    gl.uniformMatrix4fv(u.u_model, false, it.model);
    gl.uniform4fv(u.u_tint, it.tint);
    gl.uniform1f(u.u_emissive, it.emissive);
    gl.uniform1f(u.u_alpha, it.alpha);
    gl.bindVertexArray(it.mesh.vao);
    if (it.noCull) gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, it.mesh.count);
    if (it.noCull) gl.enable(gl.CULL_FACE);
  },

  drawParticles(additive) {
    const gl = this.gl;
    const n = additive ? this.partCountAdd : this.partCountAlpha;
    if (!n) return;
    const start = additive ? 0 : this.partAlphaStart;
    const prog = this.progPart;
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.u_viewProj, false, this.cam.viewProj);
    gl.uniform3fv(prog.u.u_camRight, this.cam.right);
    gl.uniform3fv(prog.u.u_camUp, this.cam.up);
    gl.uniform1f(prog.u.u_soft, additive ? 1 : 0.4);
    gl.bindVertexArray(this.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData, start * 8, n * 8);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
  },

  drawRibbons(additive) {
    const gl = this.gl;
    const n = additive ? this.ribCountAdd : this.ribCountAlpha;
    if (!n) return;
    const start = additive ? 0 : this.ribAlphaStart;
    const prog = this.progRib;
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.u_viewProj, false, this.cam.viewProj);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.ribVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ribData, start * 7, n * 7);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  },
};
