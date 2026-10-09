'use strict';
// Gemensamma hjälpfunktioner: matematik, object pool, spatialt rutnät och sprite-cache.

const TAU = Math.PI * 2;
const WORLD_W = 4000;
const WORLD_H = 4000;
const STEP = 1 / 60; // fast tidssteg för simuleringen

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

// Väljer ett värde ur [{ w, v }] med sannolikhet proportionell mot w.
function weightedPick(entries) {
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i].w;
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= entries[i].w;
    if (r <= 0) return entries[i].v;
  }
  return entries[entries.length - 1].v;
}

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Object pool: återanvänder objekt i stället för att skapa nya varje gång.
// `active` innehåller levande objekt. releaseAt flyttar sista objektet till
// den lediga platsen, så loopa baklänges när objekt tas bort under iteration.
class Pool {
  constructor(create, initial) {
    this.create = create;
    this.free = [];
    this.active = [];
    for (let i = 0; i < initial; i++) this.free.push(create());
  }
  spawn() {
    const o = this.free.length ? this.free.pop() : this.create();
    this.active.push(o);
    return o;
  }
  releaseAt(i) {
    const a = this.active;
    const o = a[i];
    const last = a.pop();
    if (i < a.length) a[i] = last;
    this.free.push(o);
  }
  clear() {
    while (this.active.length) this.free.push(this.active.pop());
  }
  get count() { return this.active.length; }
}

// Fast rutnät över världen. Varje cell har en länkad lista av index (typade
// arrayer) så att ombyggnaden varje tick inte skapar skräp för skräpsamlaren.
class SpatialGrid {
  constructor(w, h, cell, capacity) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity);
    this.items = [];
  }
  clear() {
    this.head.fill(-1);
    this.items.length = 0;
  }
  insert(obj) {
    const idx = this.items.length;
    if (idx >= this.next.length) {
      const n = new Int32Array(this.next.length * 2);
      n.set(this.next);
      this.next = n;
    }
    this.items.push(obj);
    const cx = clamp((obj.x / this.cell) | 0, 0, this.cols - 1);
    const cy = clamp((obj.y / this.cell) | 0, 0, this.rows - 1);
    const c = cy * this.cols + cx;
    this.next[idx] = this.head[c];
    this.head[c] = idx;
  }
  // Fyller `out` med objekt vars cell överlappar cirkeln (x, y, r).
  query(x, y, r, out) {
    out.length = 0;
    const cs = this.cell;
    const x0 = clamp(((x - r) / cs) | 0, 0, this.cols - 1);
    const x1 = clamp(((x + r) / cs) | 0, 0, this.cols - 1);
    const y0 = clamp(((y - r) / cs) | 0, 0, this.rows - 1);
    const y1 = clamp(((y + r) / cs) | 0, 0, this.rows - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.head[cy * this.cols + cx];
        while (i !== -1) {
          out.push(this.items[i]);
          i = this.next[i];
        }
      }
    }
    return out;
  }
}

// Glödande former ritas en gång med shadowBlur till en liten offscreen-canvas
// och kopieras sedan med drawImage, vilket är mycket snabbare.
const Sprites = {
  cache: new Map(),
  get(key, radius, glow, draw) {
    let s = this.cache.get(key);
    if (!s) {
      const size = Math.ceil((radius + glow) * 2 + 4);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.translate(size / 2, size / 2);
      draw(g);
      s = { img: c, half: size / 2 };
      this.cache.set(key, s);
    }
    return s;
  },
};

// Ritar en polygon/form med neonglöd. `path` bygger en path på g.
function neonShape(g, color, blur, lineWidth, fillAlpha, path) {
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.lineJoin = 'round';
  g.beginPath();
  path(g);
  g.closePath();
  if (fillAlpha > 0) {
    g.globalAlpha = fillAlpha;
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 1;
  }
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1, lineWidth * 0.35);
  g.stroke();
}

function polyPath(sides, r, rot) {
  return function (g) {
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * TAU;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
  };
}

function circlePath(r) {
  return function (g) { g.arc(0, 0, r, 0, TAU); };
}
