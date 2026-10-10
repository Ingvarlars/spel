'use strict';
// Handkontroll via Gamepad API (standardlayout: Xbox/PlayStation).
// Vänster spak går, höger spak styr kameran. Menyerna kan styras med styrkorset.

const PAD_PLAY = {
  0: 'jump',      // A / ✕
  1: 'dash',      // B / ○
  2: 'attack',    // X / □
  3: 'spear',     // Y / △
  4: 'lashDown',  // LB / L1
  5: 'full',      // RB / R1
  6: 'lash',      // LT / L2
  7: 'attack',    // RT / R2
  11: 'reset',    // höger spak (tryck)
  12: 'call',     // upp
  13: 'lashDown', // ned
  14: 'reset',    // vänster
  15: 'lash2',    // höger
};

const Pad = {
  active: false,
  prev: [],
  navT: 0,
  attackRepeat: 0,
  DEAD: 0.2,

  init(game) {
    this.game = game;
    window.addEventListener('gamepadconnected', (e) => {
      this.active = true;
      game.toast('Handkontroll ansluten', 'Vänster spak går, höger spak styr kameran');
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.active = false;
      Input.padMove = null;
      if (game.state === 'playing') game.pause();
    });
  },

  get() {
    if (!navigator.getGamepads) return null;
    const list = navigator.getGamepads();
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) return list[i];
    return null;
  },

  axis(v) {
    const a = Math.abs(v);
    if (a < this.DEAD) return 0;
    return Math.sign(v) * (a - this.DEAD) / (1 - this.DEAD);
  },

  update(dt) {
    const gp = this.get();
    if (!gp) { Input.padMove = null; return; }
    const pressed = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    const down = (i) => pressed[i] && !this.prev[i];
    const ax = gp.axes;
    const lx = this.axis(ax[0] || 0), ly = this.axis(ax[1] || 0);
    const rx = this.axis(ax[2] || 0), ry = this.axis(ax[3] || 0);
    if (pressed.some((p) => p) || lx || ly || rx || ry) this.active = true;
    const game = this.game;

    if (down(9)) Input.emit('pause');   // Start / Options
    if (down(8)) Input.emit('map');     // Back / Share

    if (game.state === 'playing') {
      if (lx || ly) {
        const l = Math.min(1, Math.hypot(lx, ly)), n = Math.hypot(lx, ly);
        Input.padMove = { x: lx / n * l, y: -ly / n * l };
      } else Input.padMove = null;
      // Kvadratisk kurva för finare sikte nära mitten.
      const k = Input.sensitivity / 0.0023;
      Input.lookDX += Math.sign(rx) * rx * rx * 2.8 * k * dt;
      Input.lookDY += Math.sign(ry) * ry * ry * 2.0 * k * dt * (Input.invertY ? -1 : 1);
      for (const i in PAD_PLAY) if (down(+i)) Input.queued[PAD_PLAY[i]] = true;
      // Håll in X/RT för att fortsätta kombon.
      if (pressed[2] || pressed[7]) {
        if ((this.attackRepeat -= dt) <= 0) { Input.queued.attack = true; this.attackRepeat = 0.38; }
      } else this.attackRepeat = 0.38;
      // Vibration vid träffar sköts via rumble().
    } else {
      Input.padMove = null;
      if (UI.current) this.navigate(dt, pressed, down, lx, ly);
    }
    this.prev = pressed;
  },

  // Menystyrning: upp/ned flyttar fokus, vänster/höger ändrar reglage, A väljer, B går tillbaka.
  navigate(dt, pressed, down, lx, ly) {
    const items = Array.from(document.querySelectorAll('#ui button:not([disabled]), #ui input, #ui select'));
    if (!items.length) return;
    let dirY = 0, dirX = 0;
    if (pressed[12] || ly < -0.5) dirY = -1;
    else if (pressed[13] || ly > 0.5) dirY = 1;
    if (pressed[14] || lx < -0.5) dirX = -1;
    else if (pressed[15] || lx > 0.5) dirX = 1;
    if (!dirX && !dirY) this.navT = 0;
    else if ((this.navT -= dt) <= 0) {
      this.navT = this.navT < -1 ? 0.12 : 0.28;
      const cur = items.indexOf(document.activeElement);
      const el = document.activeElement;
      if (dirX && el && el.type === 'range') {
        const step = (+el.max - +el.min) / 20;
        el.value = +el.value + dirX * step;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (dirX && el && el.tagName === 'SELECT') {
        el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + dirX));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const d = dirY || dirX;
        const next = items[cur < 0 ? 0 : (cur + d + items.length) % items.length];
        next.focus();
        if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest' });
      }
    }
    if (down(0)) {
      const el = document.activeElement;
      if (el && items.indexOf(el) >= 0 && el.type !== 'range' && el.tagName !== 'SELECT') el.click();
      else if (items.indexOf(el) < 0) items[0].focus();
    }
    if (down(1)) {
      const back = document.querySelector('#ui [data-act="back"], #ui [data-act="resume"]');
      if (back) back.click();
    }
  },

  // Kort vibration (om kontrollen stöder det).
  rumble(strength, ms) {
    if (!this.active || !Save.data.settings.shake) return;
    const gp = this.get();
    const act = gp && gp.vibrationActuator;
    if (act && act.playEffect) {
      try { act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) { /* ignorera */ }
    }
  },
};
