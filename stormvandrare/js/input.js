'use strict';
// Tangentbord och mus. Rörelse läses varje tick; handlingar (hugg, bindning,
// hopp ...) köas som händelser så att inga snabba tryck missas.

const Input = {
  keys: Object.create(null),
  listeners: Object.create(null),
  queued: Object.create(null),   // handlingar som spelaren konsumerar
  mouse: { x: 0, y: 0, active: false, lastMove: -10 },
  mouseLash: false,               // senaste bindningen kom från musen
  lashDir: { x: 0, y: 0 },        // riktning när bindningstangenten trycktes

  init(canvas) {
    const keyAction = {
      Space: 'jump', KeyJ: 'attack', KeyK: 'lash', ShiftLeft: 'lash', ShiftRight: 'lash',
      KeyE: 'spear', KeyQ: 'full',
    };
    const uiAction = {
      Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
      Digit1: 'choose1', Digit2: 'choose2', Digit3: 'choose3',
      Numpad1: 'choose1', Numpad2: 'choose2', Numpad3: 'choose3',
    };
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    window.addEventListener('keydown', (e) => {
      if (block.indexOf(e.code) !== -1 && !(e.target && e.target.tagName === 'BUTTON' && e.code === 'Space')) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      const a = keyAction[e.code];
      if (a) {
        this.queued[a] = true;
        if (a === 'lash') { this.mouseLash = false; this.readMove(this.lashDir); }
      }
      const u = uiAction[e.code];
      if (u) this.emit(u);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.emit('blur'); });

    canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
      this.mouse.lastMove = performance.now();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
      this.mouse.lastMove = performance.now();
      if (e.button === 0) this.queued.attack = true;
      else if (e.button === 2) { this.queued.lash = true; this.mouseLash = true; }
      else if (e.button === 1) { this.queued.spear = true; e.preventDefault(); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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

  // Riktning från tangenterna (längd 0..1).
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

  // Musen räknas som sikte om den rörts de senaste sekunderna.
  mouseAiming() { return this.mouse.active && performance.now() - this.mouse.lastMove < 4000; },
};
