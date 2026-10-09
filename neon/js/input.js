'use strict';
// Tangentbord och virtuell joystick för pekskärm. Rörelse läses varje tick,
// engångshändelser (paus, ljud av, val 1-3) skickas till registrerade lyssnare.

const JOY_RADIUS = 56;

const Input = {
  keys: Object.create(null),
  listeners: Object.create(null),
  dashRequested: false,
  touchMode: false,
  // Flytande joystick: dyker upp där tummen sätts ned.
  joy: { id: -1, active: false, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 },

  init(canvas) {
    const actionFor = {
      Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
      Digit1: 'choose1', Digit2: 'choose2', Digit3: 'choose3',
      Numpad1: 'choose1', Numpad2: 'choose2', Numpad3: 'choose3',
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
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.releaseJoy(); this.emit('blur'); });

    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.setTouchMode();

    const joy = this.joy;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      this.setTouchMode();
      if (joy.active) return;
      joy.active = true;
      joy.id = e.pointerId;
      joy.bx = joy.x = e.clientX;
      joy.by = joy.y = e.clientY;
      joy.dx = joy.dy = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorera */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!joy.active || e.pointerId !== joy.id) return;
      e.preventDefault();
      joy.x = e.clientX;
      joy.y = e.clientY;
      let dx = joy.x - joy.bx, dy = joy.y - joy.by;
      const len = Math.hypot(dx, dy);
      // Basen följer med om tummen dras längre än radien.
      if (len > JOY_RADIUS) {
        joy.bx = joy.x - (dx / len) * JOY_RADIUS;
        joy.by = joy.y - (dy / len) * JOY_RADIUS;
        dx = joy.x - joy.bx; dy = joy.y - joy.by;
      }
      joy.dx = dx / JOY_RADIUS;
      joy.dy = dy / JOY_RADIUS;
    });
    const end = (e) => { if (e.pointerId === joy.id) this.releaseJoy(); };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const dashBtn = document.getElementById('btn-dash');
    if (dashBtn) {
      dashBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setTouchMode();
        this.dashRequested = true;
      });
    }
    // Hindra dubbeltryck-zoom och "studs" i iOS Safari.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  },

  setTouchMode() {
    if (this.touchMode) return;
    this.touchMode = true;
    document.body.classList.add('touch');
  },

  releaseJoy() {
    const j = this.joy;
    j.active = false;
    j.id = -1;
    j.dx = j.dy = 0;
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
    const j = this.joy;
    if (j.active) {
      const jl = Math.hypot(j.dx, j.dy);
      if (jl > 0.15) {
        // Dödzon och mjuk kurva för finare styrning.
        const m = Math.min(1, (jl - 0.15) / 0.75);
        x = (j.dx / jl) * m;
        y = (j.dy / jl) * m;
      }
    }
    out.x = x; out.y = y;
    return out;
  },

  consumeDash() {
    const d = this.dashRequested;
    this.dashRequested = false;
    return d;
  },
};
