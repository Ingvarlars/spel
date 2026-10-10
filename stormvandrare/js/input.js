'use strict';
// Tangentbord, mus (med pekarlås för kameran), handkontroll och pekskärm.

const Input = {
  keys: Object.create(null),
  listeners: Object.create(null),
  queued: Object.create(null),
  lookDX: 0,
  lookDY: 0,
  sensitivity: 0.0023,
  invertY: false,
  locked: false,
  canvas: null,
  mouseDown: [false, false, false],
  touchMove: null,   // { x, y } från virtuell joystick (js/touch.js)
  padMove: null,     // { x, y } från handkontrollens vänstra spak (js/gamepad.js)

  init(canvas) {
    this.canvas = canvas;
    const keyAction = {
      Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyQ: 'reset', KeyE: 'lashDown',
      KeyR: 'full', KeyF: 'lash2', KeyG: 'spear', KeyV: 'lash', KeyC: 'call',
    };
    const uiAction = {
      Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Tab: 'map',
      Digit1: 'choose1', Digit2: 'choose2', Digit3: 'choose3',
    };
    window.addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) !== -1 && !(e.target && e.target.tagName === 'BUTTON')) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      const a = keyAction[e.code];
      if (a) this.queued[a] = true;
      const u = uiAction[e.code];
      if (u) this.emit(u);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.mouseDown = [false, false, false]; this.emit('blur'); });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.wantLock) { this.requestLock(); return; }
      this.mouseDown[e.button] = true;
      if (e.button === 0) this.queued.attack = true;
      else if (e.button === 2) this.queued.lash = true;
      else if (e.button === 1) { this.queued.spear = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => { this.mouseDown[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * this.sensitivity;
      this.lookDY += e.movementY * this.sensitivity * (this.invertY ? -1 : 1);
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) this.emit('unlock');
    });
  },

  wantLock: false,
  requestLock() {
    if (!this.canvas || this.locked) return;
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignorera */ } });
    } catch (e) { /* ignorera */ }
  },
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  },

  on(action, fn) { (this.listeners[action] || (this.listeners[action] = [])).push(fn); },
  emit(action) {
    const l = this.listeners[action];
    if (l) for (let i = 0; i < l.length; i++) l[i]();
  },
  consume(action) {
    const v = !!this.queued[action];
    this.queued[action] = false;
    return v;
  },
  clearQueue() { this.queued = Object.create(null); },

  // Rörelse: x = höger, y = framåt (längd 0..1).
  readMove(out) {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.KeyA) x -= 1;
    if (k.KeyD) x += 1;
    if (k.KeyW) y += 1;
    if (k.KeyS) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (!l) {
      const m = this.touchMove || this.padMove;
      if (m) { x = m.x; y = m.y; }
    }
    out.x = x; out.y = y;
    return out;
  },

  // Kamerarörelse sedan förra bildrutan (mus + piltangenter).
  takeLook(dt) {
    let dx = this.lookDX, dy = this.lookDY;
    this.lookDX = this.lookDY = 0;
    const k = this.keys;
    if (k.ArrowLeft) dx -= 2.2 * dt;
    if (k.ArrowRight) dx += 2.2 * dt;
    if (k.ArrowUp) dy -= 1.6 * dt;
    if (k.ArrowDown) dy += 1.6 * dt;
    return { dx, dy };
  },
};
