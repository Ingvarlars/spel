'use strict';
// Tangentbord (och senare virtuell joystick). Rörelse läses varje tick,
// engångshändelser (paus, ljud av, val 1-3) skickas till registrerade lyssnare.

const Input = {
  keys: Object.create(null),
  listeners: Object.create(null),
  dashRequested: false,

  init() {
    const actionFor = {
      Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
      Digit1: 'choose1', Digit2: 'choose2', Digit3: 'choose3',
      Numpad1: 'choose1', Numpad2: 'choose2', Numpad3: 'choose3',
      Enter: 'confirm',
    };
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    window.addEventListener('keydown', (e) => {
      if (gameKeys.indexOf(e.code) !== -1) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashRequested = true;
      const action = actionFor[e.code];
      if (action) this.emit(action);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.emit('blur'); });
  },

  on(action, fn) { (this.listeners[action] || (this.listeners[action] = [])).push(fn); },
  emit(action) {
    const l = this.listeners[action];
    if (l) for (let i = 0; i < l.length; i++) l[i]();
  },

  // Returnerar rörelseriktning med längd 0..1 i `out`.
  readMove(out) {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    out.x = x; out.y = y;
    return out;
  },

  consumeDash() {
    const d = this.dashRequested;
    this.dashRequested = false;
    return d;
  },
};
