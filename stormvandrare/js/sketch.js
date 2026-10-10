'use strict';
// Skissrenderare: ritar en modell som en sepiatonad bläckskiss (konturer via
// ett inverterat skal och skuggning i steg) och returnerar en bild-URL.
// Används för skissbokens teckningar.

const VS_SKETCH = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_color;
uniform mat4 u_model;
uniform mat4 u_viewProj;
uniform float u_outline;
out vec3 v_n;
out vec3 v_w;
void main() {
  vec3 p = a_pos + a_normal * u_outline;
  vec4 w = u_model * vec4(p, 1.0);
  v_n = mat3(u_model) * a_normal;
  v_w = w.xyz;
  gl_Position = u_viewProj * w;
}`;
const FS_SKETCH = `
in vec3 v_n;
in vec3 v_w;
uniform float u_ink;
out vec4 o;
void main() {
  if (u_ink > 0.5) { o = vec4(0.17, 0.12, 0.08, 1.0); return; }
  vec3 N = normalize(v_n);
  float l = dot(N, normalize(vec3(-0.5, 0.8, 0.6))) * 0.5 + 0.5;
  // Skuggning i steg med korsstreck i de mörkaste partierna.
  float stepL = floor(l * 4.0) / 4.0;
  vec3 paper = vec3(0.93, 0.87, 0.74);
  vec3 c = mix(vec3(0.55, 0.45, 0.33), paper, stepL);
  float hatch = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.18));
  if (stepL < 0.5) c = mix(c, vec3(0.35, 0.27, 0.19), hatch * 0.35);
  float hatch2 = step(0.55, fract((gl_FragCoord.x - gl_FragCoord.y) * 0.18));
  if (stepL < 0.3) c = mix(c, vec3(0.3, 0.22, 0.15), hatch2 * 0.35);
  o = vec4(c, 1.0);
}`;

const Sketch = {
  prog: null,
  fbo: null,
  size: 320,
  cache: {},

  init() {
    const gl = GL.gl;
    this.prog = GL.program(VS_SKETCH, FS_SKETCH, '');
    this.fbo = Renderer.makeTarget(this.size, this.size, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, false);
    const db = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, db);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.size, this.size);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  // draws: [[mesh, modelMatrix], ...] samlade från en vanlig ritfunktion.
  render(key, collect, viewDist, centerY) {
    if (this.cache[key]) return this.cache[key];
    if (!this.prog) this.init();
    const gl = GL.gl;
    const items = [];
    const saved = Renderer.draw, savedP = Renderer.particle, savedR = Renderer.ribbon, savedL = Renderer.light;
    Renderer.draw = (mesh, m) => { items.push([mesh, Float32Array.from(m)]); return null; };
    Renderer.particle = () => {}; Renderer.ribbon = () => {}; Renderer.light = () => {};
    try { collect(); } finally { Renderer.draw = saved; Renderer.particle = savedP; Renderer.ribbon = savedR; Renderer.light = savedL; }
    const S = this.size;
    const view = M4.create(), proj = M4.create(), vp = M4.create();
    const d = viewDist || 4, cy = centerY || 1;
    M4.lookAt(view, [d * 0.75, cy + d * 0.15, d * 0.85], [0, cy, 0], [0, 1, 0]);
    M4.perspective(proj, 0.7, 1, 0.1, 100);
    M4.multiply(vp, proj, view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fbo);
    gl.viewport(0, 0, S, S);
    gl.clearColor(0.93, 0.87, 0.74, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.prog.p);
    gl.uniformMatrix4fv(this.prog.u.u_viewProj, false, vp);
    // Konturer: framsidor bortplockade, något förstorat, mörkt bläck.
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.uniform1f(this.prog.u.u_ink, 1);
    gl.uniform1f(this.prog.u.u_outline, 0.018 * d / 4);
    for (const [mesh, m] of items) { gl.uniformMatrix4fv(this.prog.u.u_model, false, m); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); }
    gl.cullFace(gl.BACK);
    gl.uniform1f(this.prog.u.u_ink, 0);
    gl.uniform1f(this.prog.u.u_outline, 0);
    for (const [mesh, m] of items) { gl.uniformMatrix4fv(this.prog.u.u_model, false, m); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); }
    // Läs pixlarna till en vanlig canvas (spegelvänd i y).
    const px = new Uint8Array(S * S * 4);
    gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    g.putImageData(img, 0, 0);
    // Lite ojämn kant som i en skissbok.
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.52);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    const url = c.toDataURL('image/png');
    this.cache[key] = url;
    return url;
  },

  // Skiss av en fiendetyp eller boss.
  creature(type) {
    const m = M4.create();
    if (ENEMY_BODY[type]) {
      return this.render(type, () => {
        const body = Body.build('e-' + type, ENEMY_PAL[type], ENEMY_BODY[type]);
        const pose = makePose();
        Anim.idle(pose, 0);
        pose.shRP = 0.5; pose.elR = 0.6;
        const J = Skeleton.draw(body, m, pose, null);
        const L = M4.create(), O = M4.create();
        M4.fromTRS(L, 0, -0.08, 0, 0, 0, 0, 1, 1, 1);
        if (type === 'warrior') Renderer.draw(Models.axe(), M4.multiply(O, J.handR, L));
        if (type === 'archer') Renderer.draw(Models.bow(), M4.multiply(O, J.handL, L));
        if (type === 'shield') { M4.fromTRS(L, 0, -0.1, 0.12, 0, 0, Math.PI / 2, 1, 1, 1); Renderer.draw(Models.shieldMesh(), M4.multiply(O, J.foreL, L)); }
        if (type === 'hover') Renderer.draw(Models.spear(), M4.multiply(O, J.handR, L));
      }, 3.6, 1.05);
    }
    if (type === 'crab') return this.render(type, () => { M4.fromTRS(m, 0, 0, 0, 0.6, 0, 0, 2.2, 2.2, 2.2); Renderer.draw(Models.crab(), m); }, 3, 0.4);
    if (type === 'leech') return this.render(type, () => { M4.fromTRS(m, 0, 1, 0, 0.8, 0, 0.3, 1.6, 1.6, 1.6); Renderer.draw(Models.voidspren(), m); }, 3, 1);
    if (type === 'brute') return this.render(type, () => { const P = Models.brute(); M4.fromTRS(m, 0, 0, 0, 0.5, 0, 0, 1, 1, 1); Renderer.draw(P.body, m); const L = M4.create(), O = M4.create(); for (const s of [-1, 1]) { M4.fromTRS(L, s * 0.95, 1.9, 0, 0, 0, s * 0.15, 1, 1, 1); Renderer.draw(P.arm, M4.multiply(O, m, L)); M4.fromTRS(L, s * 0.4, 0.75, 0, 0, 0, 0, 1, 1, 1); Renderer.draw(P.leg, M4.multiply(O, m, L)); } }, 6, 1.4);
    if (type === 'chasmfiend') return this.render(type, () => { const M = BossModels.chasmfiend(); M4.fromTRS(m, 0, 0, 0, 0.6, -0.2, 0, 1, 1, 1); Renderer.draw(M.body, m); const L = M4.create(), O = M4.create(); M4.fromTRS(L, 0, 2.2, 2.4, 0, 0.1, 0, 1, 1, 1); Renderer.draw(M.head, M4.multiply(O, m, L)); for (const s of [1, -1]) { M4.fromTRS(L, s * 3.8, 2.4, 2.4, s * 0.4, -0.6, 0, 1, 1, 1); Renderer.draw(M.claw, M4.multiply(O, m, L)); } }, 20, 1);
    if (type === 'thunderclast') return this.render(type, () => { const M = BossModels.thunderclast(); M4.fromTRS(m, 0, 0, 0, 0.5, 0, 0, 1, 1, 1); Renderer.draw(M.body, m); const L = M4.create(), O = M4.create(); for (const s of [1, -1]) { M4.fromTRS(L, s * 2.4, 7.2, 0, 0, 0, s * 0.2, 1, 1, 1); Renderer.draw(M.arm, M4.multiply(O, m, L)); M4.fromTRS(L, s * 1.2, 3, 0, 0, 0, 0, 1, 1, 1); Renderer.draw(M.leg, M4.multiply(O, m, L)); } }, 17, 4.5);
    if (type === 'heavenly') return this.render(type, () => { const body = Body.build('boss-heavenly', BOSS_PAL.heavenly, { plates: true, helmet: true, robe: true, bulk: 1.15 }); const pose = makePose(); pose.shLR = 0.7; pose.shRP = 1.4; const J = Skeleton.draw(body, m, pose, null); const L = M4.create(), O = M4.create(); M4.fromTRS(L, 0, -0.07, 0, 0, 0, 0, 1, 1, 1); Renderer.draw(Models.spear(), M4.multiply(O, J.handR, L)); }, 3.8, 1.05);
    if (type === 'herald') return this.render(type, () => { M4.fromTRS(m, 0, 1, 0, 0.4, 0.3, 0, 1.5, 1.5, 1.5); Renderer.draw(BossModels.heraldCore(), m); }, 6, 1);
    if (type === 'hero') return this.render(type, () => { const body = Body.build('hero', HERO_PAL, { hair: true }); const pose = makePose(); Anim.idle(pose, 0); pose.shRP = 0.3; Skeleton.draw(body, m, pose, null); }, 3.6, 1.05);
    return null;
  },
};
