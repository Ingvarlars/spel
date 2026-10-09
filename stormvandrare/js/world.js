'use strict';
// Banan: procedurgenererade platåer och klyftor (de Splittrade slätterna m.fl.).
// Rutnät med typer, kollision för rektanglar och rendering i förrenderade bitar.

const T_EMPTY = 0;
const T_ROCK = 1;     // vanligt berg
const T_BOULDER = 2;  // löst berg som en Shardblade kan skära igenom
const T_BEDROCK = 3;  // klyftans botten och kanter, går inte att förstöra

const ROWS = 64;
const FLOOR_ROW = 58;  // klyftornas botten
const CHUNK = 16;      // rutor per renderad bit

const World = {
  cols: 0,
  rows: ROWS,
  tiles: null,
  width: 0,
  height: ROWS * TILE,
  chunks: new Map(),
  spawns: [],       // fiender: { type, x, y }
  sphereSpots: [],  // sfärer: { x, y, dun }
  herbSpots: [],    // knobweed
  decor: [],        // rockbuds och gräs
  plateaus: [],     // { x0, x1, top } i rutor
  arena: null,      // slutarenan { x0, x1, top }
  bg: null,         // bakgrundslager
  seed: 1,

  // Bygger banan för platå nummer `level` (1, 2, 3 ...).
  generate(level, seed) {
    const rng = makeRng(seed);
    this.seed = seed;
    const r = (a, b) => a + rng() * (b - a);
    const ri = (a, b) => Math.floor(a + rng() * (b - a + 1));

    const count = 5 + level * 2;
    // Planera platåer: [bredd, klyfta efter].
    const plan = [];
    let total = 2;
    plan.push({ w: 30, gap: ri(5, 7) });
    for (let i = 0; i < count; i++) {
      const w = ri(16, 34);
      const gap = ri(5, 9 + Math.min(6, level));
      plan.push({ w, gap });
    }
    plan.push({ w: 64, gap: 0 }); // slutarenan
    for (const p of plan) total += p.w + p.gap;
    total += 2;

    this.cols = total;
    this.width = total * TILE;
    this.tiles = new Uint8Array(this.cols * ROWS);
    this.chunks.clear();
    this.spawns = [];
    this.sphereSpots = [];
    this.herbSpots = [];
    this.decor = [];
    this.plateaus = [];

    // Klyftans botten och banans ytterväggar.
    for (let x = 0; x < this.cols; x++) {
      for (let y = FLOOR_ROW; y < ROWS; y++) this.set(x, y, T_BEDROCK);
    }
    for (let y = 0; y < ROWS; y++) {
      this.set(0, y, T_BEDROCK); this.set(1, y, T_BEDROCK);
      this.set(this.cols - 1, y, T_BEDROCK); this.set(this.cols - 2, y, T_BEDROCK);
    }

    let x = 2;
    let top = 34;
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const isStart = i === 0, isArena = i === plan.length - 1;
      if (!isStart && !isArena) top = clamp(top + ri(-5, 5), 26, 40);
      if (isArena) top = 34;
      this.buildPlateau(x, p.w, top, rng, isStart || isArena);
      const plat = { x0: x, x1: x + p.w - 1, top };
      this.plateaus.push(plat);
      if (isArena) this.arena = plat;
      else if (!isStart) this.populate(plat, level, rng, i / plan.length);

      // Klyftan efter platån: sfärer på botten och ibland en avsats på väggen.
      if (p.gap > 0) {
        const gx0 = x + p.w, gx1 = gx0 + p.gap - 1;
        for (let k = 0; k < ri(1, 3); k++) {
          this.sphereSpots.push({ x: (r(gx0 + 1, gx1)) * TILE, y: FLOOR_ROW * TILE - 12, dun: rng() < 0.6 });
        }
        if (rng() < 0.6) this.spawns.push({ type: 'crab', x: (gx0 + p.gap / 2) * TILE, y: FLOOR_ROW * TILE - 20 });
        if (p.gap >= 8 && rng() < 0.5) {
          const ly = ri(top + 6, FLOOR_ROW - 8), side = rng() < 0.5 ? gx0 : gx1 - 2;
          for (let k = 0; k < 3; k++) this.set(side + k, ly, T_ROCK);
          this.sphereSpots.push({ x: (side + 1.5) * TILE, y: ly * TILE - 12, dun: false });
        }
      }
      x += p.w + p.gap;
    }

    this.buildBackground(seed);
  },

  buildPlateau(x0, w, top, rng, flat) {
    const ri = (a, b) => Math.floor(a + rng() * (b - a + 1));
    // Ojämna kanter: sidorna varierar en aning per rad.
    let lOff = 0, rOff = 0;
    const heights = new Int8Array(w);
    let h = 0;
    for (let i = 0; i < w; i++) {
      if (!flat && i > 2 && i < w - 3 && rng() < 0.12) h = clamp(h + ri(-1, 1), -2, 2);
      heights[i] = h;
    }
    for (let y = top - 3; y < FLOOR_ROW; y++) {
      if (y > top + 2 && rng() < 0.3) lOff = clamp(lOff + ri(-1, 1), 0, 2);
      if (y > top + 2 && rng() < 0.3) rOff = clamp(rOff + ri(-1, 1), 0, 2);
      for (let i = lOff; i < w - rOff; i++) {
        if (y >= top - heights[i]) this.set(x0 + i, y, T_ROCK);
      }
    }
    if (flat) return;
    // Klippformationer att ta skydd bakom (och skära i).
    const n = ri(0, 2);
    for (let k = 0; k < n; k++) {
      const px = x0 + ri(3, w - 6), pw = ri(1, 3), ph = ri(3, 7);
      const surface = this.surfaceRow(px);
      const type = rng() < 0.6 ? T_BOULDER : T_ROCK;
      for (let i = 0; i < pw; i++) for (let j = 1; j <= ph; j++) this.set(px + i, surface - j, type);
      // Ibland ett överhäng.
      if (ph >= 5 && rng() < 0.5) {
        const dir = rng() < 0.5 ? -1 : 1;
        for (let i = 1; i <= ri(2, 4); i++) this.set(px + (dir < 0 ? -i : pw - 1 + i), surface - ph, type);
      }
    }
  },

  // Placerar fiender, sfärer och dekor på en platå.
  populate(plat, level, rng, progress) {
    const ri = (a, b) => Math.floor(a + rng() * (b - a + 1));
    const w = plat.x1 - plat.x0;
    const types = [{ w: 3, v: 'crab' }, { w: 4, v: 'warrior' }];
    if (level >= 1 && progress > 0.25) types.push({ w: 2.5, v: 'archer' });
    if (level >= 2) types.push({ w: 1.5 + level * 0.3, v: 'thunder' });
    if (level >= 2 || progress > 0.6) types.push({ w: 1 + level * 0.4, v: 'hover' });
    const total = types.reduce((s, t) => s + t.w, 0);
    const count = ri(1, 2) + Math.floor(level * 0.7 + progress * 2);
    for (let k = 0; k < count; k++) {
      let roll = rng() * total, type = types[0].v;
      for (const t of types) { roll -= t.w; if (roll <= 0) { type = t.v; break; } }
      const tx = ri(plat.x0 + 2, plat.x1 - 2);
      const sy = this.surfaceRow(tx) * TILE;
      this.spawns.push({ type, x: (tx + 0.5) * TILE, y: type === 'hover' ? sy - 200 : sy - 24 });
      if (type === 'crab') {
        for (let c = 0; c < ri(1, 3); c++) this.spawns.push({ type, x: (tx + c + 1) * TILE, y: sy - 20 });
      }
    }
    if (rng() < 0.25) {
      const tx = ri(plat.x0 + 1, plat.x1 - 1);
      this.herbSpots.push({ x: (tx + 0.5) * TILE, y: this.surfaceRow(tx) * TILE });
    }
    for (let k = 0; k < ri(1, 3); k++) {
      const tx = ri(plat.x0 + 1, plat.x1 - 1);
      this.sphereSpots.push({ x: (tx + 0.5) * TILE, y: this.surfaceRow(tx) * TILE - 12, dun: rng() < 0.35 });
    }
    // Rockbuds och gräs som drar sig undan när man kommer nära.
    for (let i = plat.x0 + 1; i < plat.x1; i++) {
      const roll = rng();
      if (roll < 0.12) this.decor.push({ kind: 'bud', x: (i + 0.5) * TILE, y: this.surfaceRow(i) * TILE, size: 10 + rng() * 8, open: 1, hue: rng() });
      else if (roll < 0.45) this.decor.push({ kind: 'grass', x: (i + rng()) * TILE, y: this.surfaceRow(i) * TILE, size: 6 + rng() * 8, open: 1, hue: rng() });
    }
    void w;
  },

  // Översta fasta raden i kolumn tx (från himlen och nedåt).
  surfaceRow(tx) {
    for (let y = 0; y < ROWS; y++) if (this.get(tx, y) !== T_EMPTY) return y;
    return FLOOR_ROW;
  },

  get(tx, ty) {
    if (tx < 0 || tx >= this.cols || ty >= ROWS) return T_BEDROCK;
    if (ty < 0) return T_EMPTY;
    return this.tiles[ty * this.cols + tx];
  },

  set(tx, ty, v) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= ROWS) return;
    this.tiles[ty * this.cols + tx] = v;
  },

  solid(tx, ty) {
    if (ty < 0) return true; // tak över himlen
    return this.get(tx, ty) !== T_EMPTY;
  },

  solidAtPx(x, y) { return this.solid(Math.floor(x / TILE), Math.floor(y / TILE)); },

  // Tar bort en ruta (t.ex. skuren av en Shardblade). Returnerar true om något försvann.
  carve(tx, ty) {
    const t = this.get(tx, ty);
    if (t !== T_BOULDER) return false;
    this.set(tx, ty, T_EMPTY);
    this.chunks.delete(Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK));
    return true;
  },

  rectHits(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
    return false;
  },

  // Flyttar en kropp { x, y, w, h } (x/y = mittpunkt) axel för axel.
  // Returnerar bitar: 1 = vänster, 2 = höger, 4 = upp, 8 = ned blockerad.
  move(b, dx, dy) {
    let hit = 0;
    const hw = b.w / 2, hh = b.h / 2;
    if (dx !== 0) {
      const nx = b.x + dx;
      if (this.rectHits(nx - hw, b.y - hh, b.w, b.h)) {
        if (dx > 0) { b.x = Math.floor((nx + hw) / TILE) * TILE - hw - 0.01; hit |= 2; }
        else { b.x = (Math.floor((nx - hw) / TILE) + 1) * TILE + hw + 0.01; hit |= 1; }
        if (this.rectHits(b.x - hw, b.y - hh, b.w, b.h)) b.x -= dx; // säkerhetsnät
      } else b.x = nx;
    }
    if (dy !== 0) {
      const ny = b.y + dy;
      if (this.rectHits(b.x - hw, ny - hh, b.w, b.h)) {
        if (dy > 0) { b.y = Math.floor((ny + hh) / TILE) * TILE - hh - 0.01; hit |= 8; }
        else { b.y = (Math.floor((ny - hh) / TILE) + 1) * TILE + hh + 0.01; hit |= 4; }
        if (this.rectHits(b.x - hw, b.y - hh, b.w, b.h)) b.y -= dy;
      } else b.y = ny;
    }
    return hit;
  },

  // Fri sikt mellan två punkter (för bågskyttar och lä i stormen).
  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / (TILE / 2));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAtPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  },

  // --- Rendering ---

  buildBackground(seed) {
    const rng = makeRng(seed * 7 + 3);
    const layer = (n, base, amp) => {
      const pts = [];
      let h = base;
      for (let i = 0; i < n; i++) {
        h = clamp(h + (rng() - 0.5) * amp, base - amp * 2, base + amp * 2);
        pts.push(h, rng() < 0.25 ? 1 : 0); // höjd, klyfta
      }
      return pts;
    };
    this.bg = {
      far: layer(200, 0.62, 0.05),
      near: layer(200, 0.72, 0.06),
      clouds: Array.from({ length: 14 }, () => ({ x: rng(), y: 0.08 + rng() * 0.3, s: 0.6 + rng() * 1.2 })),
    };
  },

  tileColor(tx, ty, t) {
    // Lager i berget (strata) i ockra och rost.
    const band = Math.floor((ty + Math.sin(tx * 0.3) * 1.5) / 2) % 4;
    if (t === T_BEDROCK) return ['#3d2e2a', '#43322c', '#3a2b27', '#40302a'][band];
    if (t === T_BOULDER) return ['#8d6a4e', '#977354', '#86644a', '#916e51'][band];
    return ['#a8663f', '#b5754a', '#9c5c39', '#b06d44'][band];
  },

  renderChunk(cx, cy) {
    const c = document.createElement('canvas');
    c.width = c.height = CHUNK * TILE;
    const g = c.getContext('2d');
    const rng = makeRng((cx * 73856093) ^ (cy * 19349663) ^ this.seed);
    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        const tx = cx * CHUNK + i, ty = cy * CHUNK + j;
        const t = this.get(tx, ty);
        if (t === T_EMPTY || ty < 0) continue;
        const px = i * TILE, py = j * TILE;
        g.fillStyle = this.tileColor(tx, ty, t);
        g.fillRect(px, py, TILE, TILE);
        // Struktur: små fläckar.
        g.fillStyle = 'rgba(0,0,0,0.08)';
        for (let k = 0; k < 3; k++) g.fillRect(px + rng() * 28, py + rng() * 28, 2 + rng() * 4, 2);
        g.fillStyle = 'rgba(255,230,190,0.06)';
        g.fillRect(px + rng() * 28, py + rng() * 28, 3, 2);
        const up = this.get(tx, ty - 1) === T_EMPTY;
        const down = this.get(tx, ty + 1) === T_EMPTY;
        const left = this.get(tx - 1, ty) === T_EMPTY;
        const right = this.get(tx + 1, ty) === T_EMPTY;
        if (up) {
          // Ytan: crem (ljust stoft) och en mörk kant.
          g.fillStyle = t === T_BOULDER ? '#b89a7a' : '#d7a77a';
          g.fillRect(px, py, TILE, 5);
          g.fillStyle = 'rgba(80,110,60,0.55)';
          if (rng() < 0.5) g.fillRect(px + rng() * 20, py - 1, 8 + rng() * 8, 3);
        }
        g.fillStyle = 'rgba(40,20,10,0.35)';
        if (down) g.fillRect(px, py + TILE - 4, TILE, 4);
        if (left) g.fillRect(px, py, 3, TILE);
        if (right) g.fillRect(px + TILE - 3, py, 3, TILE);
        if (t === T_BOULDER) {
          g.strokeStyle = 'rgba(40,25,15,0.35)';
          g.lineWidth = 1;
          g.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
        }
      }
    }
    return c;
  },

  drawBackground(ctx, game) {
    const w = game.w, h = game.h;
    const storm = game.stormDark || 0;
    // Himmel.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, storm > 0 ? lerpColor('#6fa8d8', '#1d2533', storm) : '#6fa8d8');
    sky.addColorStop(0.6, storm > 0 ? lerpColor('#d8e6ec', '#3a4250', storm) : '#d8e6ec');
    sky.addColorStop(1, storm > 0 ? lerpColor('#f1dcc0', '#3c3a3e', storm) : '#f1dcc0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Solen.
    if (storm < 0.8) {
      ctx.globalAlpha = 1 - storm;
      const sx = w * 0.78, sy = h * 0.18;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
      sg.addColorStop(0, 'rgba(255,250,230,1)');
      sg.addColorStop(0.25, 'rgba(255,240,200,0.8)');
      sg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 90, sy - 90, 180, 180);
      ctx.globalAlpha = 1;
    }

    // Moln med svag parallax.
    const camX = game.cam.x;
    ctx.fillStyle = storm > 0.3 ? 'rgba(60,66,80,0.5)' : 'rgba(255,255,255,0.55)';
    for (const c of this.bg.clouds) {
      const x = ((c.x * w * 3 - camX * 0.05 + game.realTime * 6) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * 0.25;
      const y = c.y * h;
      ctx.beginPath();
      ctx.ellipse(x, y, 60 * c.s, 14 * c.s, 0, 0, TAU);
      ctx.ellipse(x + 30 * c.s, y - 8 * c.s, 40 * c.s, 14 * c.s, 0, 0, TAU);
      ctx.fill();
    }

    // Avlägsna platåer i två lager.
    this.drawLayer(ctx, game, this.bg.far, 0.15, storm > 0 ? lerpColor('#b9a99c', '#2b2e36', storm) : '#b9a99c', 0.12);
    this.drawLayer(ctx, game, this.bg.near, 0.35, storm > 0 ? lerpColor('#a58670', '#262629', storm) : '#a58670', 0.2);
  },

  drawLayer(ctx, game, pts, factor, color, vfactor) {
    const w = game.w, h = game.h;
    const seg = 90;
    const off = game.cam.x * factor;
    const yOff = (game.cam.y - this.height * 0.5) * vfactor * game.zoom;
    const n = pts.length / 2;
    const first = Math.floor(off / seg);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= Math.ceil(w / seg) + 1; i++) {
      const k = (((first + i) % n) + n) % n;
      const x = (first + i) * seg - off;
      const y = pts[k * 2] * h - yOff;
      if (pts[k * 2 + 1]) { // klyfta
        ctx.lineTo(x, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + 14, h); ctx.lineTo(x + 30, h); ctx.lineTo(x + 34, y);
      } else ctx.lineTo(x, y);
      ctx.lineTo(x + seg, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  },

  drawTiles(ctx, game) {
    const v = game.view(0);
    const cs = CHUNK * TILE;
    const cx0 = Math.max(0, Math.floor(v.x0 / cs)), cx1 = Math.floor(v.x1 / cs);
    const cy0 = Math.max(0, Math.floor(v.y0 / cs)), cy1 = Math.min(Math.floor(ROWS / CHUNK), Math.floor(v.y1 / cs));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx * CHUNK >= this.cols) continue;
        const key = cx + ',' + cy;
        let c = this.chunks.get(key);
        if (!c) { c = this.renderChunk(cx, cy); this.chunks.set(key, c); }
        ctx.drawImage(c, cx * cs, cy * cs);
      }
    }
  },

  updateDecor(dt, game) {
    const p = game.player;
    const v = game.view(100);
    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      if (d.x < v.x0 || d.x > v.x1) continue;
      // Rockbuds och gräs drar sig undan när någon kommer nära eller stormen blåser.
      const near = dist2(d.x, d.y, p.x, p.y) < (d.kind === 'bud' ? 110 * 110 : 70 * 70) || game.inStorm(d.x, d.y);
      const target = near ? 0 : 1;
      d.open += (target - d.open) * Math.min(1, dt * (near ? 10 : 1.2));
    }
  },

  drawDecor(ctx, game) {
    const v = game.view(40);
    const t = game.realTime;
    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      if (d.x < v.x0 || d.x > v.x1 || d.y < v.y0 || d.y > v.y1) continue;
      if (d.kind === 'bud') {
        const s = d.size;
        // Vinrankor som sticker ut när knoppen är öppen.
        if (d.open > 0.05) {
          ctx.strokeStyle = d.hue < 0.5 ? '#5c8a3a' : '#7a9a3a';
          ctx.lineWidth = 2;
          for (let k = -2; k <= 2; k++) {
            const a = -Math.PI / 2 + k * 0.45 + Math.sin(t * 1.5 + d.x) * 0.08;
            const len = s * 1.6 * d.open;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y - s * 0.6);
            ctx.quadraticCurveTo(d.x + Math.cos(a) * len * 0.5 + 4, d.y - s * 0.6 + Math.sin(a) * len * 0.6, d.x + Math.cos(a) * len, d.y - s * 0.6 + Math.sin(a) * len);
            ctx.stroke();
          }
        }
        // Skalet.
        ctx.fillStyle = '#7d6a58';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, s, s * (0.7 + 0.15 * d.open), 0, Math.PI, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(d.x - s, d.y - 2, s * 2, 2);
      } else {
        // Gräs som drar sig ned i marken.
        const len = d.size * d.open;
        if (len < 0.5) continue;
        ctx.strokeStyle = d.hue < 0.5 ? '#6f9a45' : '#8daa4a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const bx = d.x + k * 3;
          ctx.moveTo(bx, d.y);
          ctx.lineTo(bx + Math.sin(t * 2 + d.x + k) * 2, d.y - len * (0.7 + k * 0.15));
        }
        ctx.stroke();
      }
    }
  },
};

// Blandar två hex-färger (t = 0..1).
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
