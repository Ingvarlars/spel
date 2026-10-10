'use strict';
// Världen: platåer som extruderade polygoner med platta toppar och branta,
// skiktade klippväggar, spiror, block som kan skäras, broar och klyftbotten.
// Kollision mellan sfärer och prismor är exakt; ett rutnät snabbar upp sökningar.

const CHASM_FLOOR = -46;
const SKY_LIMIT = 160;
const GRID_CELL = 16;

// Prisma: polygon i xz-planet (moturs) extruderad mellan y0 och y1.
function makePrism(poly, y0, y1, kind) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < poly.length; i += 2) {
    minX = Math.min(minX, poly[i]); maxX = Math.max(maxX, poly[i]);
    minZ = Math.min(minZ, poly[i + 1]); maxZ = Math.max(maxZ, poly[i + 1]);
  }
  return { poly: Float32Array.from(poly), y0, y1, kind, minX, maxX, minZ, maxZ, alive: true, id: 0, hp: 0, mesh: null, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

// Stjärnformad polygon kring (cx, cz) med radiefunktion.
function blobPoly(cx, cz, radius, n, rng, rough) {
  const pts = [];
  const ph = rng() * TAU;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = radius * (1 + (Math.sin(a * 3 + ph) * 0.12 + (rng() - 0.5) * rough));
    pts.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
  }
  return pts;
}

function pointInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], zi = poly[i + 1], xj = poly[j], zj = poly[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Närmaste punkt på polygonens kant. Skriver till out = [x, z, avstånd²].
function closestOnPoly(poly, x, z, out) {
  let best = 1e18, bx = 0, bz = 0;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const ax = poly[j], az = poly[j + 1], ex = poly[i] - ax, ez = poly[i + 1] - az;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    const px = ax + ex * t, pz = az + ez * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  out[0] = bx; out[1] = bz; out[2] = best;
  return out;
}

const World = {
  prisms: [],
  grid: null,
  gx0: 0, gz0: 0, gw: 0, gh: 0,
  bounds: { x0: -100, x1: 100, z0: -100, z1: 100 },
  plateaus: [],
  start: null,
  goal: null,
  arena: null,
  spawns: [],
  sphereSpots: [],
  herbSpots: [],
  chunks: [],         // { mesh, cx, cz, r }
  grassMesh: null,
  budMesh: null,
  decorMeshes: [],    // instansierade meshar för dekor
  theme: null,
  seed: 1,
  _cp: new Float32Array(3),
  _q: [],

  // Bygger en etapp. opts: { level, length, theme, boss }
  generate(opts, seed) {
    const rng = makeRng(seed);
    this.seed = seed;
    const theme = this.theme = opts.theme || THEMES.plains;
    this.prisms = [];
    this.plateaus = [];
    this.spawns = [];
    this.sphereSpots = [];
    this.herbSpots = [];
    const L = opts.length || 560;
    const W = 220;
    this.bounds = { x0: -90, x1: L + 140, z0: -W / 2 - 60, z1: W / 2 + 60 };

    // Platåer på ett ruterat nät med slump; klyftor uppstår mellan dem.
    const cell = 68;
    const cols = Math.ceil(L / cell) + 1, rows = Math.ceil(W / cell);
    let id = 0;
    const heightAt = (x, z) => (fbm2(x * 0.006 + seed * 0.01, z * 0.006, 3) - 0.5) * 22;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cx = i * cell + (rng() - 0.5) * cell * 0.3;
        const cz = -W / 2 + (j + 0.5) * cell + (rng() - 0.5) * cell * 0.3;
        const isStart = i === 0 && j === Math.floor(rows / 2);
        if (!isStart && rng() < 0.08) continue; // ibland ett stort hål
        const radius = isStart ? 30 : cell * rand2(rng, 0.33, 0.47);
        const gen = theme.gen || {};
        let top = isStart ? 0 : Math.round(heightAt(cx, cz) * (gen.heightVar || 22) / 22);
        if (gen.tall && !isStart) top += gen.tall;
        if (isStart && gen.startLow) top = CHASM_FLOOR + 2;
        const poly = blobPoly(cx, cz, radius, isStart ? 16 : 13, rng, 0.22);
        // Svävande öar i Ursprunget: botten hänger fritt i luften.
        const y0 = gen.floating && !isStart ? top - rand2(rng, 14, 28) : CHASM_FLOOR - 4;
        const pr = this.addPrism(poly, y0, top, 'plateau');
        pr.floating = gen.floating && !isStart;
        pr.id = id++;
        pr.radius = radius;
        this.plateaus.push(pr);
        if (isStart) this.start = pr;
      }
    }
    // Slutarenan: en stor platå bortom de andra.
    const ax = cols * cell + 50;
    const aTop = (theme.gen && theme.gen.startLow) ? CHASM_FLOOR + 2 : 2;
    this.arena = this.addPrism(blobPoly(ax, 0, 60, 20, rng, 0.08), CHASM_FLOOR - 4, aTop, 'plateau');
    this.arena.radius = 60;
    this.arena.isArena = true;
    this.plateaus.push(this.arena);
    this.goal = { x: ax, y: aTop, z: 0 };

    // Broar mellan några grannplatåer (som de som brolagen bär).
    for (const a of this.plateaus) {
      let best = null, bd = 1e9;
      for (const b of this.plateaus) {
        if (b === a || b.cx <= a.cx) continue;
        const d = Math.hypot(b.cx - a.cx, b.cz - a.cz) - a.radius - b.radius;
        if (d > 4 && d < 26 && d < bd) { bd = d; best = b; }
      }
      if (best && rng() < 0.45) this.addBridge(a, best);
    }

    // Spiror, åsar och block på platåerna.
    for (const pl of this.plateaus) {
      if (pl === this.start) continue;
      const n = pl.isArena ? 6 : randInt2(rng, 1, 4);
      for (let k = 0; k < n; k++) {
        const a = rng() * TAU, d = rng() * pl.radius * 0.7;
        const x = pl.cx + Math.cos(a) * d, z = pl.cz + Math.sin(a) * d;
        const r = rand2(rng, 1.5, 4.5);
        const h = rand2(rng, 4, pl.isArena ? 10 : 16);
        const boulder = rng() < 0.4;
        const pr = this.addPrism(blobPoly(x, z, r, boulder ? 7 : 6, rng, 0.35), pl.y1 - 0.5, pl.y1 + h, boulder ? 'boulder' : 'spire');
        if (boulder) pr.hp = 3;
        pr.base = pl;
      }
    }

    // Banans gränser: alla prismor plus marginal.
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (const pr of this.prisms) { bx0 = Math.min(bx0, pr.minX); bx1 = Math.max(bx1, pr.maxX); bz0 = Math.min(bz0, pr.minZ); bz1 = Math.max(bz1, pr.maxZ); }
    this.bounds = { x0: bx0 - 60, x1: bx1 + 60, z0: bz0 - 60, z1: bz1 + 60 };
    this.buildGrid();

    // Fiender, sfärer och knobweed.
    for (const pl of this.plateaus) {
      if (pl === this.start || pl.isArena) continue;
      const progress = clamp(pl.cx / L, 0, 1);
      this.populate(pl, opts, rng, progress);
    }
    // Klyftornas djup: fiender och knobweed även på botten.
    if (theme.gen && theme.gen.startLow) {
      for (let k = 0; k < 10 + opts.level * 3; k++) {
        const x = rand2(rng, 40, L), z = (rng() - 0.5) * W;
        if (this.insideAny(x, CHASM_FLOOR + 1, z)) continue;
        const type = pickWeighted(rng, [[3, 'crab'], [2, 'warrior'], [1.5, 'archer'], [1, 'leech'], [opts.level > 2.5 ? 1 : 0, 'shield'], [opts.level > 3 ? 0.8 : 0, 'hover']]);
        this.spawns.push({ type, x, y: CHASM_FLOOR + 0.2, z, elite: rng() < 0.05, home: null });
        if (rng() < 0.2) this.herbSpots.push({ x: x + 3, y: CHASM_FLOOR, z });
      }
    }
    // Sfärer på klyftbotten.
    for (let k = 0; k < 18 + opts.level * 2; k++) {
      const x = rng() * L, z = (rng() - 0.5) * W;
      if (!this.insideAny(x, CHASM_FLOOR + 1, z)) this.sphereSpots.push({ x, y: CHASM_FLOOR, z, dun: rng() < 0.25 });
    }

    this.buildMeshes(rng);
  },

  addPrism(poly, y0, y1, kind) {
    const p = makePrism(poly, y0, y1, kind);
    this.prisms.push(p);
    return p;
  },

  addBridge(a, b) {
    // Från kanten av a till kanten av b, 3 m bred.
    const dx = b.cx - a.cx, dz = b.cz - a.cz, d = Math.hypot(dx, dz);
    const ux = dx / d, uz = dz / d, nx = -uz, nz = ux;
    const x0 = a.cx + ux * (a.radius * 0.7), z0 = a.cz + uz * (a.radius * 0.7);
    const x1 = b.cx - ux * (b.radius * 0.7), z1 = b.cz - uz * (b.radius * 0.7);
    const y = Math.max(a.y1, b.y1) + 0.01;
    const w = 1.6;
    const poly = [x0 + nx * w, z0 + nz * w, x0 - nx * w, z0 - nz * w, x1 - nx * w, z1 - nz * w, x1 + nx * w, z1 + nz * w];
    // Se till att polygonen är moturs.
    const pr = this.addPrism(poly, y - 0.5, y, 'bridge');
    pr.from = a; pr.to = b;
  },

  populate(pl, opts, rng, progress) {
    const level = Math.floor(opts.level);
    const tut = !!opts.tutorial;
    const types = [{ w: 2.5, v: 'crab' }, { w: 4, v: 'warrior' }];
    if (progress > 0.15 || level > 1) types.push({ w: 2.5, v: 'archer' });
    if (!tut && (level >= 2 || progress > 0.5)) types.push({ w: 1.5 + level * 0.3, v: 'shield' });
    if (level >= 2) types.push({ w: 1.2 + level * 0.3, v: 'thunder' });
    if (!tut && (level >= 2 || progress > 0.6)) types.push({ w: 1 + level * 0.4, v: 'hover' });
    if (!tut && (level >= 3 || progress > 0.7)) types.push({ w: 0.8, v: 'leech' });
    if (level >= 3) types.push({ w: 0.6 + level * 0.2, v: 'brute' });
    const total = types.reduce((s, t) => s + t.w, 0);
    // Första etappen är en lugn introduktion; sedan ökar tätheten med nivå och avstånd.
    const count = tut ? Math.floor(rng() * 1.1 + progress * 0.9) : Math.floor(rng() * 1.4 + level * 0.35 + progress * 1.3);
    for (let k = 0; k < count; k++) {
      let roll = rng() * total, type = types[0].v;
      for (const t of types) { roll -= t.w; if (roll <= 0) { type = t.v; break; } }
      const a = rng() * TAU, d = rng() * pl.radius * 0.6;
      const x = pl.cx + Math.cos(a) * d, z = pl.cz + Math.sin(a) * d;
      const elite = rng() < 0.04 + level * 0.02;
      const y = (type === 'hover' || type === 'leech') ? pl.y1 + 8 : pl.y1 + 0.1;
      this.spawns.push({ type, x, y, z, elite, home: pl });
      if (type === 'crab' && rng() < 0.35) this.spawns.push({ type, x: x + rng() * 4, y, z: z + rng() * 4, home: pl });
    }
    for (let k = 0; k < randInt2(rng, 2, 4); k++) {
      const a = rng() * TAU, d = rng() * pl.radius * 0.75;
      this.sphereSpots.push({ x: pl.cx + Math.cos(a) * d, y: pl.y1, z: pl.cz + Math.sin(a) * d, dun: rng() < 0.15 });
    }
    if (rng() < 0.3) {
      const a = rng() * TAU, d = rng() * pl.radius * 0.6;
      this.herbSpots.push({ x: pl.cx + Math.cos(a) * d, y: pl.y1, z: pl.cz + Math.sin(a) * d });
    }
  },

  // --- Rutnät för snabba sökningar ---
  buildGrid() {
    const b = this.bounds;
    this.gx0 = b.x0; this.gz0 = b.z0;
    this.gw = Math.ceil((b.x1 - b.x0) / GRID_CELL);
    this.gh = Math.ceil((b.z1 - b.z0) / GRID_CELL);
    this.grid = new Array(this.gw * this.gh);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    for (const p of this.prisms) this.gridInsert(p);
  },

  gridInsert(p) {
    const i0 = clamp(Math.floor((p.minX - this.gx0) / GRID_CELL), 0, this.gw - 1);
    const i1 = clamp(Math.floor((p.maxX - this.gx0) / GRID_CELL), 0, this.gw - 1);
    const j0 = clamp(Math.floor((p.minZ - this.gz0) / GRID_CELL), 0, this.gh - 1);
    const j1 = clamp(Math.floor((p.maxZ - this.gz0) / GRID_CELL), 0, this.gh - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grid[j * this.gw + i].push(p);
  },

  // Prismor nära (x, z) inom radien r (unika, levande).
  query(x, z, r, out) {
    out.length = 0;
    const i0 = clamp(Math.floor((x - r - this.gx0) / GRID_CELL), 0, this.gw - 1);
    const i1 = clamp(Math.floor((x + r - this.gx0) / GRID_CELL), 0, this.gw - 1);
    const j0 = clamp(Math.floor((z - r - this.gz0) / GRID_CELL), 0, this.gh - 1);
    const j1 = clamp(Math.floor((z + r - this.gz0) / GRID_CELL), 0, this.gh - 1);
    const stamp = (this._stamp = (this._stamp || 0) + 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cellList = this.grid[j * this.gw + i];
        for (let k = 0; k < cellList.length; k++) {
          const p = cellList[k];
          if (!p.alive || p._s === stamp) continue;
          p._s = stamp;
          if (x + r < p.minX || x - r > p.maxX || z + r < p.minZ || z - r > p.maxZ) continue;
          out.push(p);
        }
      }
    }
    return out;
  },

  insideAny(x, y, z) {
    if (y < CHASM_FLOOR) return true;
    const list = this.query(x, z, 0.01, this._q);
    for (const p of list) if (y >= p.y0 && y <= p.y1 && pointInPoly(p.poly, x, z)) return p;
    return null;
  },

  // Högsta yta under (x, y, z), eller klyftbotten.
  groundBelow(x, y, z) {
    let best = CHASM_FLOOR;
    const list = this.query(x, z, 0.01, this._q);
    for (const p of list) if (p.y1 <= y + 0.01 && p.y1 > best && pointInPoly(p.poly, x, z)) best = p.y1;
    return best;
  },

  // Knuffar ut en sfär (pos = [x,y,z]) ur berget. Returnerar antal kontakter;
  // summan av kontaktnormalerna skrivs till nOut.
  collideSphere(pos, r, nOut) {
    let contacts = 0;
    nOut[0] = nOut[1] = nOut[2] = 0;
    // Klyftbotten och himlen.
    if (pos[1] - r < CHASM_FLOOR) { pos[1] = CHASM_FLOOR + r; nOut[1] += 1; contacts++; }
    if (pos[1] + r > SKY_LIMIT) { pos[1] = SKY_LIMIT - r; nOut[1] -= 1; contacts++; }
    // Banans ytterkant.
    const b = this.bounds;
    if (pos[0] < b.x0 + r) { pos[0] = b.x0 + r; nOut[0] += 1; contacts++; }
    if (pos[0] > b.x1 - r) { pos[0] = b.x1 - r; nOut[0] -= 1; contacts++; }
    if (pos[2] < b.z0 + r) { pos[2] = b.z0 + r; nOut[2] += 1; contacts++; }
    if (pos[2] > b.z1 - r) { pos[2] = b.z1 - r; nOut[2] -= 1; contacts++; }

    const list = this.query(pos[0], pos[2], r, this._q);
    const cp = this._cp;
    for (let k = 0; k < list.length; k++) {
      const p = list[k];
      const x = pos[0], y = pos[1], z = pos[2];
      if (y - r > p.y1 || y + r < p.y0) continue;
      const inside = pointInPoly(p.poly, x, z);
      closestOnPoly(p.poly, x, z, cp);
      const edgeD = Math.sqrt(cp[2]);
      if (inside) {
        if (y >= p.y0 && y <= p.y1) {
          // Mitten är inne i berget: ta kortaste vägen ut.
          const up = p.y1 - y + r, down = y - p.y0 + r, side = edgeD + r;
          if (up <= down && up <= side) { pos[1] += up; nOut[1] += 1; }
          else if (down <= side) { pos[1] -= down; nOut[1] -= 1; }
          else {
            const ex = (cp[0] - x) / (edgeD || 1), ez = (cp[1] - z) / (edgeD || 1);
            pos[0] += ex * side; pos[2] += ez * side; nOut[0] += ex; nOut[2] += ez;
          }
          contacts++;
        } else if (y > p.y1) {
          pos[1] = p.y1 + r; nOut[1] += 1; contacts++;
        } else {
          pos[1] = p.y0 - r; nOut[1] -= 1; contacts++;
        }
      } else {
        // Utanför polygonen: närmaste punkt på väggen (eller kanten).
        const cy = clamp(y, p.y0, p.y1);
        const dx = x - cp[0], dy = y - cy, dz = z - cp[1];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r && d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          pos[0] += dx / d * push; pos[1] += dy / d * push; pos[2] += dz / d * push;
          nOut[0] += dx / d; nOut[1] += dy / d; nOut[2] += dz / d;
          contacts++;
        }
      }
    }
    return contacts;
  },

  // Stråle: avstånd till första träff (eller maxD). Stegar halvmeter för halvmeter.
  raycast(ox, oy, oz, dx, dy, dz, maxD, step) {
    step = step || 0.5;
    for (let t = step; t <= maxD; t += step) {
      if (this.insideAny(ox + dx * t, oy + dy * t, oz + dz * t)) return t;
    }
    return maxD;
  },

  lineClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, 1) >= d - 0.01;
  },

  // Plattan som en punkt står på (för fiender som håller sig hemma).
  plateauAt(x, z) {
    const list = this.query(x, z, 0.01, this._q);
    for (const p of list) if (p.kind === 'plateau' && pointInPoly(p.poly, x, z)) return p;
    return null;
  },

  // Tar bort ett skuret block.
  destroyPrism(p) {
    p.alive = false;
  },

  // --- Meshar ---
  buildMeshes(rng) {
    this.chunks = [];
    const th = this.theme;
    const groups = new Map();
    const chunkSize = 120;
    for (const p of this.prisms) {
      if (p.kind === 'boulder') { p.mesh = this.prismMesh(p, th, rng).build(); continue; }
      const key = Math.floor(p.cx / chunkSize) + ',' + Math.floor(p.cz / chunkSize);
      if (!groups.has(key)) groups.set(key, { mb: new MeshBuilder(), x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
      const g = groups.get(key);
      this.prismMesh(p, th, rng, g.mb);
      g.x0 = Math.min(g.x0, p.minX); g.x1 = Math.max(g.x1, p.maxX);
      g.z0 = Math.min(g.z0, p.minZ); g.z1 = Math.max(g.z1, p.maxZ);
    }
    for (const g of groups.values()) {
      this.chunks.push({ mesh: g.mb.build(), cx: (g.x0 + g.x1) / 2, cz: (g.z0 + g.z1) / 2, r: Math.hypot(g.x1 - g.x0, g.z1 - g.z0) / 2 + 20 });
    }

    // Klyftbotten och avlägsna mesas bortom spelområdet.
    const mb = new MeshBuilder();
    const b = this.bounds;
    const fx0 = b.x0 - 400, fx1 = b.x1 + 400, fz0 = b.z0 - 400, fz1 = b.z1 + 400;
    const step = 40;
    for (let x = fx0; x < fx1; x += step) {
      for (let z = fz0; z < fz1; z += step) {
        const n = noise2(x * 0.05, z * 0.05);
        const c = colMix(th.floor, th.floorAlt, n);
        mb.quad([x, CHASM_FLOOR, z], [x, CHASM_FLOOR, z + step], [x + step, CHASM_FLOOR, z + step], [x + step, CHASM_FLOOR, z], c);
      }
    }
    // Ring av mesas runt omkring (horisonten).
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * TAU + rng() * 0.05;
      const cx = (b.x0 + b.x1) / 2 + Math.cos(a) * ((b.x1 - b.x0) / 2 + rand2(rng, 140, 520));
      const cz = Math.sin(a) * ((b.z1 - b.z0) / 2 + rand2(rng, 120, 480));
      const pr = makePrism(blobPoly(cx, cz, rand2(rng, 30, 80), 10, rng, 0.25), CHASM_FLOOR, rand2(rng, -10, 24), 'far');
      this.prismMesh(pr, th, rng, mb);
    }
    this.chunks.push({ mesh: mb.build(), cx: 0, cz: 0, r: 1e9, far: true });

    this.buildDecor(rng);
  },

  // Platta toppar, skiktade väggar (horisontella band i ockra och rost).
  prismMesh(p, th, rng, mbIn) {
    const mb = mbIn || new MeshBuilder();
    const poly = p.poly, n = poly.length / 2;
    const cx = p.cx, cz = p.cz;
    const isRock = p.kind !== 'bridge';
    const topCol = p.kind === 'bridge' ? th.wood : p.kind === 'boulder' ? th.boulderTop : th.top;
    // Topp: solfjäder från mitten (polygonerna är stjärnformade).
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = poly[i * 2], az = poly[i * 2 + 1], bx = poly[j * 2], bz = poly[j * 2 + 1];
      const k = noise2(ax * 0.08, az * 0.08) * 0.25 + rng() * 0.05;
      const c = colMix(topCol, th.topAlt, k * (isRock ? 1 : 0.2));
      mb.tri(cx, p.y1, cz, bx, p.y1, bz, ax, p.y1, az, c);
    }
    // Väggar i band.
    const band = p.kind === 'bridge' ? 0.5 : 2.2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = poly[i * 2], az = poly[i * 2 + 1], bx = poly[j * 2], bz = poly[j * 2 + 1];
      let y = p.y1;
      let b = 0;
      while (y > p.y0) {
        const y2 = Math.max(p.y0, y - band * (0.7 + ((b * 7919 + Math.floor(p.y1)) % 5) * 0.15));
        const strata = th.strata[(b + Math.floor(Math.abs(p.y1))) % th.strata.length];
        const depthDark = 1 - clamp((p.y1 - y) / 70, 0, 0.35);
        const c = p.kind === 'bridge' ? th.woodDark : colShade(strata, depthDark * (0.92 + noise2(ax * 0.3, y * 0.4) * 0.16));
        mb.quad([ax, y, az], [bx, y, bz], [bx, y2, bz], [ax, y2, az], c);
        y = y2;
        b++;
      }
    }
    if (p.floating) {
      // Svävande ö: en klippig spets under.
      const tipY = p.y0 - (p.y1 - p.y0) * 0.7;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = poly[i * 2], az = poly[i * 2 + 1], bx = poly[j * 2], bz = poly[j * 2 + 1];
        const c = colShade(th.strata[i % th.strata.length], 0.7);
        mb.tri(ax, p.y0, az, bx, p.y0, bz, cx + (ax - cx) * 0.15, tipY, cz + (az - cz) * 0.15, c);
      }
    }
    if (p.kind === 'bridge') {
      // Rep och plankor.
      const steps = Math.floor(Math.hypot(poly[4] - poly[2], poly[5] - poly[3]) / 1.2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const lx = lerp(poly[0], poly[6], t), lz = lerp(poly[1], poly[7], t);
        const rx = lerp(poly[2], poly[4], t), rz = lerp(poly[3], poly[5], t);
        mb.box((lx + rx) / 2, p.y1 + 0.03, (lz + rz) / 2, 0.3, 0.06, 0.3, th.woodDark);
        mb.cyl(lx, p.y1, lz, 0.06, 0.06, 0.9, 4, th.woodDark);
        mb.cyl(rx, p.y1, rz, 0.06, 0.06, 0.9, 4, th.woodDark);
      }
    }
    return mb;
  },

  // Gräs, rockbuds och växter som ritas instansierat.
  buildDecor(rng) {
    const th = this.theme;
    // Grässtrå-tuva (origo vid roten så att shadern kan krympa den).
    const gb = new MeshBuilder();
    for (let k = 0; k < 4; k++) {
      const a = k * 0.8, ox = Math.cos(a) * 0.12, oz = Math.sin(a) * 0.12;
      const c = colMix(th.grass, th.grassTip, 0.3);
      gb.tri(ox - 0.05, 0, oz, ox + 0.05, 0, oz, ox + Math.cos(a) * 0.2, 0.7 + k * 0.08, oz + Math.sin(a) * 0.2, c);
      gb.tri(ox, 0, oz - 0.05, ox, 0, oz + 0.05, ox + Math.cos(a) * 0.2, 0.7 + k * 0.08, oz + Math.sin(a) * 0.2, th.grassTip);
    }
    this.grassMesh = gb.build();
    // Rockbud: skal med vinrankor som drar sig in.
    const bb = new MeshBuilder();
    bb.sphere(0, 0, 0, 0.7, 7, th.bud, 0.6);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      bb.cyl(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2, 0.06, 0.02, 1.3, 4, th.vine, null);
    }
    this.budMesh = bb.build();

    const grass = [], buds = [];
    const m = M4.create();
    for (const pl of this.plateaus) {
      const count = Math.floor(pl.radius * pl.radius * 0.05);
      for (let k = 0; k < count; k++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * pl.radius * 0.9;
        const x = pl.cx + Math.cos(a) * d, z = pl.cz + Math.sin(a) * d;
        if (!pointInPoly(pl.poly, x, z)) continue;
        const s = rand2(rng, 0.7, 1.4);
        M4.fromTRS(m, x, pl.y1, z, rng() * TAU, 0, 0, s, s, s);
        if (rng() < 0.12) buds.push(...m, 1, 1, 1, 0);
        else grass.push(...m, 1, 1, 1, 0);
      }
    }
    // Lummig växtlighet i klyftorna.
    const floorPlants = Math.floor(900 * ((th.gen && th.gen.grass) || 1));
    for (let k = 0; k < floorPlants; k++) {
      const x = rand2(rng, this.bounds.x0, this.bounds.x1), z = rand2(rng, this.bounds.z0, this.bounds.z1);
      if (this.insideAny(x, CHASM_FLOOR + 0.5, z)) continue;
      const s = rand2(rng, 1.2, 2.6);
      M4.fromTRS(m, x, CHASM_FLOOR, z, rng() * TAU, 0, 0, s, s * 1.4, s);
      grass.push(...m, 0.8, 1.15, 0.9, 0);
    }
    this.grassMesh.setInstances(new Float32Array(grass), grass.length / 20);
    this.budMesh.setInstances(new Float32Array(buds), buds.length / 20);
  },

  draw(cam) {
    const id = this._id || (this._id = M4.create());
    for (const c of this.chunks) {
      if (!c.far && !cam.sphereVisible(c.cx, 0, c.cz, c.r)) continue;
      Renderer.draw(c.mesh, id, { shadow: !c.far });
    }
    for (const p of this.prisms) {
      if (p.kind === 'boulder' && p.alive && cam.sphereVisible(p.cx, (p.y0 + p.y1) / 2, p.cz, 8)) {
        const it = Renderer.draw(p.mesh, id);
        if (it && p.flash > 0) { it.tint[0] = it.tint[1] = it.tint[2] = 1; it.tint[3] = p.flash; }
      }
    }
    Renderer.drawInstanced(this.grassMesh, true);
    Renderer.drawInstanced(this.budMesh, true);
  },
};

function rand2(rng, a, b) { return a + rng() * (b - a); }
function pickWeighted(rng, list) {
  let tot = 0;
  for (const [w] of list) tot += w;
  let r = rng() * tot;
  for (const [w, v] of list) { r -= w; if (r <= 0) return v; }
  return list[0][1];
}
function randInt2(rng, a, b) { return Math.floor(a + rng() * (b - a + 1)); }

// Färgteman och genereringsval per region.
// gen: { heightVar, startLow (start och arena på klyftbotten), floating (svävande öar), grass }
const THEMES = {
  plains: {
    name: 'Splittrade slätterna',
    top: col('#c99a6b'), topAlt: col('#d9b48a'), boulderTop: col('#a88a6e'),
    strata: [col('#b5683f'), col('#c47a4c'), col('#a35a36'), col('#bd7247'), col('#9a5637')],
    floor: col('#4c5a3a'), floorAlt: col('#5e6b40'),
    grass: col('#5f8a3a'), grassTip: col('#9fbf55'), bud: col('#7d6a58'), vine: col('#5c8a3a'),
    wood: col('#8a6a45'), woodDark: col('#5a4128'),
    sky: { top: [0.32, 0.55, 0.85], horizon: [0.86, 0.85, 0.78], ground: [0.55, 0.45, 0.38], sun: [1.25, 1.1, 0.9], cloud: [0.95, 0.94, 0.92] },
    ambientSky: [0.4, 0.45, 0.55], ambientGround: [0.32, 0.24, 0.19], fog: 0.0042, sunDir: [-0.45, 0.62, 0.35],
    gen: { heightVar: 22, grass: 1 }, weather: 'dust', storm: [70, 125],
  },
  chasms: {
    name: 'Klyftornas djup',
    top: col('#9b7a5a'), topAlt: col('#7f8a4a'), boulderTop: col('#7d6a58'),
    strata: [col('#7a4a32'), col('#8a5a3c'), col('#6a4030'), col('#7f5038'), col('#5f3a2a')],
    floor: col('#3f5a32'), floorAlt: col('#4f6e3a'),
    grass: col('#4f8a4a'), grassTip: col('#b0d860'), bud: col('#8a5a6a'), vine: col('#c04a8a'),
    wood: col('#6a5038'), woodDark: col('#4a3424'),
    sky: { top: [0.28, 0.45, 0.62], horizon: [0.62, 0.72, 0.62], ground: [0.3, 0.36, 0.28], sun: [1.0, 1.0, 0.85], cloud: [0.85, 0.9, 0.85] },
    ambientSky: [0.32, 0.42, 0.4], ambientGround: [0.22, 0.28, 0.18], fog: 0.0048, sunDir: [-0.2, 0.85, 0.2],
    gen: { heightVar: 10, startLow: true, tall: 34, grass: 3 }, weather: 'spores', storm: [90, 150],
  },
  frost: {
    name: 'Frostlanden',
    top: col('#e8eef4'), topAlt: col('#c9d6e2'), boulderTop: col('#b8c4d0'),
    strata: [col('#7d8a9a'), col('#8e9aaa'), col('#6d7a8a'), col('#9aa6b4'), col('#5f6a78')],
    floor: col('#a8b6c4'), floorAlt: col('#c4d0dc'),
    grass: col('#7a8a7a'), grassTip: col('#c8d8d0'), bud: col('#8a96a2'), vine: col('#6a7a8a'),
    wood: col('#7a6a58'), woodDark: col('#4a4038'),
    sky: { top: [0.45, 0.58, 0.75], horizon: [0.88, 0.9, 0.94], ground: [0.7, 0.72, 0.76], sun: [1.15, 1.1, 1.05], cloud: [0.96, 0.97, 1.0] },
    ambientSky: [0.5, 0.56, 0.66], ambientGround: [0.4, 0.42, 0.46], fog: 0.0042, sunDir: [-0.7, 0.32, 0.4],
    gen: { heightVar: 26, grass: 0.4 }, weather: 'snow', storm: [110, 170],
  },
  origin: {
    name: 'Ursprunget',
    top: col('#5a5660'), topAlt: col('#6a6470'), boulderTop: col('#4a4650'),
    strata: [col('#3a3640'), col('#4a4450'), col('#2e2a34'), col('#443e4a'), col('#36303c')],
    floor: col('#16141c'), floorAlt: col('#201c26'),
    grass: col('#3a5a5a'), grassTip: col('#6ab0c0'), bud: col('#4a4a5a'), vine: col('#5a8aa0'),
    wood: col('#4a4038'), woodDark: col('#2a2420'),
    sky: { top: [0.16, 0.18, 0.28], horizon: [0.42, 0.36, 0.42], ground: [0.12, 0.1, 0.14], sun: [0.8, 0.75, 0.85], cloud: [0.35, 0.34, 0.42] },
    ambientSky: [0.34, 0.34, 0.46], ambientGround: [0.16, 0.14, 0.2], fog: 0.0036, sunDir: [0.3, 0.55, -0.4],
    gen: { heightVar: 30, floating: true, grass: 0.6 }, weather: 'ash', storm: [45, 85],
  },
};
