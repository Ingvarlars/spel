'use strict';
// Pekskärm: virtuell joystick (vänster halva), kameradrag (höger halva) och knappar.
// Aktiveras vid första beröringen eller direkt på enheter med grov pekare.

const TouchControls = {
  active: false,
  root: null,
  stick: null,     // { id, ox, oy }
  look: null,      // { id, x, y }
  held: Object.create(null),   // knapp -> touch-id
  attackRepeat: 0,
  RADIUS: 56,

  init(game) {
    this.game = game;
    window.addEventListener('touchstart', () => { if (!this.active) this.enable(); }, { passive: true, capture: true });
    try {
      if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) this.enable();
    } catch (e) { /* ignorera */ }
  },

  enable() {
    if (this.active) return;
    this.active = true;
    this.game.touch = true;
    document.body.classList.add('touch');
    const b = (a, label, cls) => '<button class="tb ' + (cls || '') + '" data-a="' + a + '">' + label + '</button>';
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML =
      '<div id="tstick"><div id="tknob"></div></div>' +
      b('pause', 'II', 'tpause') +
      '<div id="tabil">' +
        b('full', 'Full', 'small" data-cd="full') + b('lash2', 'Fiende', 'small" data-cd="lashEnemy') +
        b('spear', 'Spjut', 'small" data-cd="spear') + b('call', 'Vind', 'small" data-cd="wind') +
      '</div>' +
      b('attack', 'Hugg', 'tattack') + b('jump', 'Hopp', 'tjump') + b('lash', 'Lash', 'tlash') +
      b('dash', 'Rusa', 'tdash') + b('lashDown', 'Ned', 'tdown') + b('reset', 'Åter', 'treset');
    document.body.appendChild(root);
    this.root = root;
    this.stickEl = root.querySelector('#tstick');
    this.knobEl = root.querySelector('#tknob');
    this.abilBtns = Array.from(root.querySelectorAll('[data-cd]'));
    root.addEventListener('touchstart', (e) => this.start(e), { passive: false });
    root.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    root.addEventListener('touchend', (e) => this.end(e), { passive: false });
    root.addEventListener('touchcancel', (e) => this.end(e), { passive: false });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  start(e) {
    e.preventDefault();
    Sound.unlock();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('.tb');
      if (btn) {
        const a = btn.dataset.a;
        btn.classList.add('on');
        this.held[a] = t.identifier;
        if (a === 'pause') Input.emit('pause');
        else Input.queued[a] = true;
        if (a === 'attack') this.attackRepeat = 0.38;
        continue;
      }
      if (t.clientX < window.innerWidth * 0.45 && !this.stick) {
        this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY };
        this.stickEl.style.transform = 'translate(' + (t.clientX - this.RADIUS) + 'px,' + (t.clientY - this.RADIUS) + 'px)';
        this.knobEl.style.transform = 'translate(0px,0px)';
        this.stickEl.classList.add('on');
        Input.touchMove = { x: 0, y: 0 };
      } else if (!this.look) {
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  },

  move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
        const l = Math.hypot(dx, dy), R = this.RADIUS;
        if (l > R) {
          // Joysticken följer med tummen så att man aldrig "tappar" den.
          this.stick.ox += dx * (1 - R / l); this.stick.oy += dy * (1 - R / l);
          dx *= R / l; dy *= R / l;
          this.stickEl.style.transform = 'translate(' + (this.stick.ox - R) + 'px,' + (this.stick.oy - R) + 'px)';
        }
        this.knobEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        // Liten död zon och mjuk kurva.
        const m = Math.max(0, Math.min(1, (Math.hypot(dx, dy) / R - 0.12) / 0.88));
        const n = Math.hypot(dx, dy) || 1;
        Input.touchMove = { x: dx / n * m, y: -dy / n * m };
      } else if (this.look && t.identifier === this.look.id) {
        const s = Input.sensitivity * 1.9;
        Input.lookDX += (t.clientX - this.look.x) * s;
        Input.lookDY += (t.clientY - this.look.y) * s * (Input.invertY ? -1 : 1);
        this.look.x = t.clientX; this.look.y = t.clientY;
      }
    }
  },

  end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        this.stick = null;
        Input.touchMove = null;
        this.stickEl.classList.remove('on');
      }
      if (this.look && t.identifier === this.look.id) this.look = null;
      for (const a in this.held) {
        if (this.held[a] !== t.identifier) continue;
        delete this.held[a];
        const btn = this.root.querySelector('[data-a="' + a + '"]');
        if (btn) btn.classList.remove('on');
      }
    }
  },

  // Varje bildruta: håll inne Hugg för fortsatt kombo, visa nedkylning på förmågorna.
  update(dt) {
    if (!this.active) return;
    if (this.held.attack !== undefined && (this.attackRepeat -= dt) <= 0) {
      Input.queued.attack = true;
      this.attackRepeat = 0.38;
    }
    for (const btn of this.abilBtns) {
      const k = btn.dataset.cd;
      const on = Progression.has(k);
      btn.classList.toggle('off', !on);
      const f = on && Abilities.cd[k] > 0 ? Abilities.cd[k] / Abilities.cooldown[k] : 0;
      btn.style.setProperty('--cd', (f * 100).toFixed(1) + '%');
    }
  },

  // Släpp allt när spelet pausas eller byter läge.
  reset() {
    if (!this.active) return;
    this.stick = null; this.look = null; Input.touchMove = null;
    this.held = Object.create(null);
    this.stickEl.classList.remove('on');
    this.root.querySelectorAll('.tb.on').forEach((b) => b.classList.remove('on'));
  },
};
