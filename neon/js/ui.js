'use strict';
// Gränssnitt: HUD ritas på canvas, menyer och val är HTML-överlägg i #ui.

const UI = {
  root: null,
  current: null,

  init() {
    this.root = document.getElementById('ui');
  },

  esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  show(name, html) {
    this.current = name;
    this.root.innerHTML = '<div class="screen screen-' + name + '">' + html + '</div>';
    this.root.classList.add('open');
    return this.root.firstChild;
  },

  hide() {
    this.current = null;
    this.root.innerHTML = '';
    this.root.classList.remove('open');
  },

  // Kopplar knappar med data-action till funktioner och fokuserar den första.
  bind(el, actions) {
    const btns = el.querySelectorAll('[data-action]');
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', (e) => {
        e.preventDefault();
        Sound.unlock();
        Sound.play('select');
        const fn = actions[btns[i].dataset.action];
        if (fn) fn();
      });
    }
    const first = el.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  },

  // --- Startmeny ---
  showMenu(save, actions) {
    const b = save.best;
    const rec = b.time > 0
      ? '<p class="record">Rekord: <b>' + formatTime(b.time) + '</b> · ' + b.kills + ' fiender · nivå ' + b.level + ' · våg ' + b.wave + '</p>'
      : '<p class="record">Inget rekord ännu – hur länge klarar du dig?</p>';
    const el = this.show('menu',
      '<h1 class="title">NEON<br><span>ÖVERLEVARE</span></h1>' + rec +
      '<div class="menu-buttons">' +
      '<button class="btn primary" data-action="play">▶ Spela</button>' +
      '<button class="btn" data-action="settings">⚙ Inställningar</button>' +
      '<button class="btn" data-action="stats">★ Rekord &amp; statistik</button>' +
      '</div>' +
      '<div class="help">' +
      '<p><b>Dator:</b> WASD / piltangenter styr · Mellanslag = dash · Esc = paus · M = ljud</p>' +
      '<p><b>Mobil:</b> dra med tummen för att styra · tryck på DASH-knappen</p>' +
      '<p>Skeppet skjuter automatiskt. Plocka XP-kristaller, välj uppgraderingar och överlev vågorna. Var 5:e våg kommer en boss.</p>' +
      '</div>' +
      '<p class="back-link"><a href="../index.html">← Tillbaka till Snake</a></p>');
    this.bind(el, actions);
  },

  // --- Paus ---
  showPause(actions) {
    const el = this.show('pause',
      '<h2 class="glow">PAUS</h2>' +
      '<div class="menu-buttons">' +
      '<button class="btn primary" data-action="resume">▶ Fortsätt</button>' +
      '<button class="btn" data-action="settings">⚙ Inställningar</button>' +
      '<button class="btn" data-action="restart">↻ Starta om</button>' +
      '<button class="btn" data-action="quit">⌂ Avsluta till menyn</button>' +
      '</div><p class="sub small">Tryck Esc för att fortsätta</p>');
    this.bind(el, actions);
  },

  // --- Game over ---
  showGameOver(run, records, actions) {
    const row = (label, value, key) =>
      '<div class="stat"><span>' + label + '</span><b>' + value + '</b>' + (records[key] ? '<em>Nytt rekord!</em>' : '') + '</div>';
    const any = Object.keys(records).length > 0;
    const el = this.show('gameover',
      '<h2 class="glow red">GAME OVER</h2>' +
      (any ? '<p class="sub highlight">Du slog ett personligt rekord!</p>' : '<p class="sub">Farkosten förstördes</p>') +
      '<div class="stats">' +
      row('Tid överlevd', formatTime(run.time), 'time') +
      row('Fiender dödade', run.kills, 'kills') +
      row('Nivå', run.level, 'level') +
      row('Våg', run.wave, 'wave') +
      row('Bossar besegrade', run.bosses, '') +
      row('Skada utdelad', Math.round(run.damage).toLocaleString('sv-SE'), '') +
      '</div>' +
      '<div class="menu-buttons">' +
      '<button class="btn primary" data-action="restart">↻ Spela igen</button>' +
      '<button class="btn" data-action="menu">⌂ Huvudmeny</button>' +
      '</div>');
    this.bind(el, actions);
  },

  // --- Rekord och statistik ---
  showStats(save, actions) {
    const b = save.best, t = save.totals;
    const row = (label, value) => '<div class="stat"><span>' + label + '</span><b>' + value + '</b></div>';
    const el = this.show('stats',
      '<h2 class="glow">REKORD</h2>' +
      '<div class="stats">' +
      row('Längsta tid', formatTime(b.time)) + row('Flest fiender', b.kills) +
      row('Högsta nivå', b.level) + row('Högsta våg', b.wave) +
      '</div><h3>Totalt</h3><div class="stats">' +
      row('Spelade rundor', t.games) + row('Fiender dödade', t.kills.toLocaleString('sv-SE')) +
      row('Speltid', formatTime(t.time)) + row('Bossar besegrade', t.bosses) +
      '</div><div class="menu-buttons">' +
      '<button class="btn primary" data-action="back">← Tillbaka</button>' +
      '<button class="btn danger" data-action="reset">Nollställ statistik</button>' +
      '</div>');
    this.bind(el, Object.assign({}, actions, {
      reset: () => {
        if (window.confirm('Vill du nollställa alla rekord och all statistik?')) actions.reset();
      },
    }));
  },

  // --- Inställningar ---
  showSettings(settings, onChange, onBack) {
    const check = (key, label) =>
      '<label class="setting"><span>' + label + '</span><input type="checkbox" data-key="' + key + '"' + (settings[key] ? ' checked' : '') + '></label>';
    const el = this.show('settings',
      '<h2 class="glow">INSTÄLLNINGAR</h2>' +
      '<div class="settings">' +
      check('sound', 'Ljud') +
      '<label class="setting"><span>Volym</span><input type="range" min="0" max="100" step="5" data-key="volume" value="' + Math.round(settings.volume * 100) + '"></label>' +
      check('shake', 'Skärmskakning') +
      check('numbers', 'Skadesiffror') +
      '<label class="setting"><span>Partiklar</span><select data-key="particles">' +
      '<option value="high"' + (settings.particles === 'high' ? ' selected' : '') + '>Många</option>' +
      '<option value="low"' + (settings.particles === 'low' ? ' selected' : '') + '>Få (snabbare)</option>' +
      '</select></label>' +
      check('showFps', 'Visa FPS') +
      '</div><div class="menu-buttons"><button class="btn primary" data-action="back">← Tillbaka</button></div>');
    const inputs = el.querySelectorAll('[data-key]');
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      const handler = () => {
        const key = inp.dataset.key;
        let v;
        if (inp.type === 'checkbox') v = inp.checked;
        else if (inp.type === 'range') v = Number(inp.value) / 100;
        else v = inp.value;
        onChange(key, v);
      };
      inp.addEventListener('input', handler);
      inp.addEventListener('change', handler);
    }
    this.bind(el, { back: onBack });
  },

  // --- Nivå upp ---
  showLevelUp(options, level, onPick) {
    let cards = '';
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const tag = o.kind === 'heal' ? '' : o.isNew ? '<span class="tag new">NY!</span>' : '<span class="tag">Nivå ' + o.level + '/' + o.max + '</span>';
      cards += '<button class="card" data-i="' + i + '" style="--c:' + o.color + '">' +
        '<span class="key">' + (i + 1) + '</span>' +
        '<span class="icon">' + this.esc(o.icon) + '\uFE0E</span>' +
        '<span class="name">' + this.esc(o.name) + '</span>' + tag +
        '<span class="desc">' + this.esc(o.desc) + '</span>' +
        '<span class="kind">' + (o.kind === 'weapon' ? 'Vapen' : o.kind === 'passive' ? 'Förmåga' : '') + '</span>' +
        '</button>';
    }
    const el = this.show('levelup', '<h2 class="glow">NIVÅ ' + level + '!</h2><p class="sub">Välj en uppgradering</p><div class="cards">' + cards + '</div>');
    const btns = el.querySelectorAll('.card');
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', () => onPick(Number(btns[i].dataset.i)));
    }
  },

  // --- HUD på canvas (skärmkoordinater) ---
  drawHUD(ctx, game) {
    const p = game.player, w = game.w, h = game.h;
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    ctx.textBaseline = 'middle';

    // XP-mätare överst.
    const xpT = clamp(game.xp / game.xpNext, 0, 1);
    ctx.fillStyle = 'rgba(63,208,255,0.12)';
    ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = '#3fd0ff';
    ctx.shadowColor = '#3fd0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, 0, w * xpT, 8);
    ctx.shadowBlur = 0;

    // Liv.
    const x0 = 16, y0 = 22, bw = Math.min(220, w * 0.4);
    ctx.fillStyle = 'rgba(255,64,96,0.15)';
    ctx.fillRect(x0, y0, bw, 16);
    ctx.fillStyle = '#ff4060';
    ctx.shadowColor = '#ff4060';
    ctx.shadowBlur = 10;
    ctx.fillRect(x0, y0, bw * clamp(p.hp / p.stats.maxHp, 0, 1), 16);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, 15);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + Math.round(p.stats.maxHp), x0 + 6, y0 + 8.5);

    // Sköldladdningar och dash.
    let yy = y0 + 26;
    for (let i = 0; i < p.stats.shieldMax; i++) {
      ctx.fillStyle = i < p.shield ? '#7fa8ff' : 'rgba(127,168,255,0.2)';
      ctx.beginPath();
      ctx.arc(x0 + 7 + i * 18, yy, 6, 0, TAU);
      ctx.fill();
    }
    if (p.stats.shieldMax > 0) yy += 16;
    const dashT = p.dashCd <= 0 ? 1 : 1 - p.dashCd / p.stats.dashCooldown;
    ctx.fillStyle = 'rgba(63,246,255,0.15)';
    ctx.fillRect(x0, yy - 3, 80, 6);
    ctx.fillStyle = dashT >= 1 ? '#3ff6ff' : 'rgba(63,246,255,0.6)';
    ctx.fillRect(x0, yy - 3, 80 * dashT, 6);
    ctx.fillStyle = '#8aa0c0';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('DASH', x0 + 88, yy);

    // Tid, nivå och våg i mitten.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f6ff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(formatTime(game.time), w / 2, 30);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8aa0c0';
    ctx.fillText('Nivå ' + game.level + '  ·  Våg ' + game.wave + '  ·  nästa om ' + Math.ceil(Director.timer) + ' s', w / 2, 52);

    if (game.settings.showFps) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8aa0c0';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(Math.round(game.fps) + ' fps · ' + Enemies.list.length + ' fiender · ' + Weapons.bullets.count + ' skott · ' + Effects.particles.count + ' partiklar', 16, h - 76);
    }

    // Dödade fiender till höger.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8f6ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('☠ ' + game.stats.kills, w - 64, 30);

    // Bossens livmätare.
    const b = game.boss;
    if (b && !b.dead) {
      const bw2 = Math.min(520, w * 0.7), bx = (w - bw2) / 2, by = 72;
      ctx.fillStyle = 'rgba(255,32,80,0.15)';
      ctx.fillRect(bx, by, bw2, 12);
      ctx.fillStyle = b.phase ? '#ff7a3f' : '#ff2050';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.fillRect(bx, by, bw2 * clamp(b.hp / b.maxHp, 0, 1), 12);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, 11);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('KÄRNAN · NIVÅ ' + b.level + (b.phase ? ' · RASERI' : ''), w / 2, by + 24);
      // Pil mot bossen om den är utanför skärmen.
      const sx = (b.x - game.cam.x) * game.zoom + w / 2, sy = (b.y - game.cam.y) * game.zoom + h / 2;
      if (sx < 0 || sx > w || sy < 0 || sy > h) {
        const a = Math.atan2(sy - h / 2, sx - w / 2);
        const ex = clamp(w / 2 + Math.cos(a) * w, 30, w - 30), ey = clamp(h / 2 + Math.sin(a) * h, 100, h - 30);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#ff2050';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, 9); ctx.lineTo(-8, -9);
        ctx.fill();
        ctx.restore();
      }
    }

    // Banner för ny våg / boss.
    const bn = game.banner;
    if (bn) {
      const t = bn.max - bn.t;
      const alpha = Math.min(1, t * 3, bn.t * 1.5);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = bn.color;
      ctx.shadowColor = bn.color;
      ctx.shadowBlur = 20;
      ctx.font = 'bold ' + Math.round(Math.min(56, w / 10)) + 'px system-ui, sans-serif';
      ctx.fillText(bn.text, w / 2, h * 0.3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e8f6ff';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(bn.sub, w / 2, h * 0.3 + 40);
      ctx.globalAlpha = 1;
    }

    // Vapen nere till vänster.
    ctx.textAlign = 'center';
    const ws = game.weapons;
    for (let i = 0; i < ws.length; i++) {
      const def = WEAPONS[ws[i].id];
      const bx = 16 + i * 46, by = h - 58;
      ctx.strokeStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 38, 38);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10,12,28,0.7)';
      ctx.fillRect(bx + 1, by + 1, 36, 36);
      ctx.fillStyle = def.color;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(WEAPON_ICONS[ws[i].id], bx + 19, by + 18);
      for (let l = 0; l < def.levels.length; l++) {
        ctx.fillStyle = l < ws[i].level ? def.color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx + 2 + l * 6, by + 42, 4, 4);
      }
    }
    ctx.textAlign = 'left';
  },
};
