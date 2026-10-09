'use strict';
// Gemensamma hjälpfunktioner och konstanter.

const TAU = Math.PI * 2;
const STEP = 1 / 60;       // fast tidssteg
const TILE = 32;           // rutstorlek i pixlar
const GRAVITY = 1250;      // normal gravitation (px/s²)

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Deterministisk slump (för banor och bakgrund).
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Object pool: `active` innehåller levande objekt. Loopa baklänges vid borttagning.
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
  clear() { while (this.active.length) this.free.push(this.active.pop()); }
  get count() { return this.active.length; }
}
