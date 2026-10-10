'use strict';
// Menyer och skärmar i skissboksstil (HTML ovanpå spelet).

const GLYPH_SVG = (size, color) => `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
  <g fill="none" stroke="${color || '#2b1d12'}" stroke-width="2.4" stroke-linecap="round">
    <path d="M50 8 C40 30 40 46 50 58 C60 46 60 30 50 8 Z"/>
    <path d="M50 58 L50 92"/>
    <path d="M22 40 C30 50 40 56 50 58 C60 56 70 50 78 40"/>
    <path d="M14 62 C26 70 38 74 50 74 C62 74 74 70 86 62"/>
    <circle cx="50" cy="34" r="4"/>
    <path d="M35 86 L50 92 L65 86"/>
  </g></svg>`;

const UI = {
  root: null,
  current: null,

  init() {
    this.root = document.getElementById('ui');
    this.toasts = document.getElementById('toasts');
  },

  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

  show(name, html, cls, rootCls) {
    this.current = name;
    this.root.className = 'open' + (rootCls ? ' ' + rootCls : '');
    this.root.innerHTML = '<div class="page ' + (cls || '') + '">' + html + '</div>';
    const page = this.root.firstChild;
    page.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      Sound.unlock();
      Sound.play('ui');
      const fn = this.actions && this.actions[b.dataset.act];
      if (fn) fn(b.dataset.arg);
    }));
    const first = page.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
    return page;
  },

  hide() {
    this.current = null;
    this.root.className = '';
    this.root.innerHTML = '';
  },

  toast(title, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<b>' + this.esc(title) + '</b><span>' + this.esc(text || '') + '</span>';
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  },

  menu(actions, hasSave) {
    this.actions = actions;
    const c = Save.data.campaign;
    const R = REGIONS[c.region];
    const cont = hasSave ? '<button class="btn primary" data-act="continue">Fortsätt resan <span class="hint">' + this.esc(R.name) + ', etapp ' + (c.stage + 1) + '</span></button>' : '';
    this.show('menu', GLYPH_SVG(84) +
      '<h1>Stormvandrare<small>Ett fanspel i Stormlight-världen</small></h1>' +
      '<div class="ink-rule"></div>' +
      '<div class="btns">' + cont +
      '<button class="btn' + (hasSave ? '' : ' primary') + '" data-act="newGame">Ny kampanj</button>' +
      '<button class="btn" data-act="endless">Oändlig expedition <span class="hint">rekord: etapp ' + (Save.data.best.endless || 0) + '</span></button>' +
      '<button class="btn" data-act="camp">Lägret <span class="hint">färdigheter</span></button>' +
      '<button class="btn" data-act="codex">Skissboken</button>' +
      '<button class="btn" data-act="settings">Inställningar</button>' +
      '<button class="btn" data-act="about">Om spelet och kontroller</button>' +
      '</div>', 'side', 'side');
  },

  regionIntro(region, stageName, actions) {
    this.actions = actions;
    const page = this.show('intro', '<h3>' + this.esc(stageName) + '</h3><h2>' + this.esc(region.name) + '</h2>' +
      '<canvas class="map" width="760" height="260"></canvas>' +
      region.intro.map((p) => '<p>' + this.esc(p) + '</p>').join('') +
      '<div class="btns row"><button class="btn primary" data-act="start">Börja</button></div>');
    this.drawMap(page.querySelector('canvas'));
  },

  // Bläckritad karta över etappens platåer, sedd ovanifrån.
  drawMap(cv) {
    const g = cv.getContext('2d');
    const b = World.bounds;
    const sx = cv.width / (b.x1 - b.x0), sz = cv.height / (b.z1 - b.z0), s = Math.min(sx, sz) * 0.95;
    const ox = (cv.width - (b.x1 - b.x0) * s) / 2, oz = (cv.height - (b.z1 - b.z0) * s) / 2;
    const P = (x, z) => [ox + (x - b.x0) * s, oz + (z - b.z0) * s];
    g.clearRect(0, 0, cv.width, cv.height);
    g.lineJoin = 'round';
    for (const pr of World.prisms) {
      if (pr.kind === 'boulder') continue;
      g.beginPath();
      for (let i = 0; i < pr.poly.length; i += 2) {
        const q = P(pr.poly[i] + (Math.random() - 0.5) * 0.6, pr.poly[i + 1] + (Math.random() - 0.5) * 0.6);
        if (i === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]);
      }
      g.closePath();
      g.fillStyle = pr.kind === 'bridge' ? 'rgba(90,60,30,0.5)' : pr.kind === 'spire' ? 'rgba(90,60,30,0.35)' : 'rgba(150,110,60,0.18)';
      g.fill();
      g.strokeStyle = 'rgba(43,29,18,0.8)';
      g.lineWidth = pr.kind === 'plateau' ? 1.4 : 0.8;
      g.stroke();
    }
    // Rutt från start till mål.
    const st = World.start, ar = World.arena;
    const a = P(st.cx, st.cz), z = P(ar.cx, ar.cz);
    g.setLineDash([5, 6]);
    g.strokeStyle = '#7a2a1a';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(a[0], a[1]); g.bezierCurveTo((a[0] + z[0]) / 2, a[1] - 30, (a[0] + z[0]) / 2, z[1] + 30, z[0], z[1]); g.stroke();
    g.setLineDash([]);
    g.font = 'italic 14px Georgia';
    g.fillStyle = '#2b1d12';
    g.fillText('Start', a[0] - 14, a[1] - 10);
    g.fillText('Mål', z[0] - 10, z[1] - 10);
    // Kompassros och stormens riktning.
    g.strokeStyle = 'rgba(43,29,18,0.8)';
    g.beginPath(); g.arc(cv.width - 40, 40, 16, 0, TAU); g.stroke();
    g.fillText('Ö', cv.width - 20, 45);
    g.fillText('stormen kommer härifrån →', cv.width - 230, cv.height - 10);
  },

  pause(actions) {
    this.actions = actions;
    this.show('pause', GLYPH_SVG(56) + '<h2>Paus</h2><div class="btns">' +
      '<button class="btn primary" data-act="resume">Fortsätt <span class="hint">Esc</span></button>' +
      '<button class="btn" data-act="codex">Skissboken</button>' +
      '<button class="btn" data-act="settings">Inställningar</button>' +
      '<button class="btn" data-act="restart">Börja om etappen</button>' +
      '<button class="btn" data-act="quit">Avsluta till huvudmenyn</button>' +
      '</div>', 'narrow');
  },

  statsHtml(st, time) {
    const row = (l, v) => '<div class="stat"><span>' + l + '</span><b>' + v + '</b></div>';
    return '<div class="cols">' + row('Tid', formatTime(time)) + row('Fiender besegrade', st.kills) + row('Sfärer', st.wealth) +
      row('Utdelad skada', Math.round(st.damage).toLocaleString('sv-SE')) + row('Tagen skada', Math.round(st.taken)) + row('Gemhearts', st.gemhearts) + '</div>';
  },

  complete(cfg, st, time, ideal, actions) {
    this.actions = actions;
    const idealHtml = ideal ? '<div class="ink-rule"></div><h3>' + this.esc(ideal.title) + '</h3><div class="ideal-words">”' + this.esc(ideal.words) + '”</div><p class="muted" style="text-align:center">Orden accepteras. ' + this.esc(ideal.grants) + '.</p>' : '';
    this.show('complete', '<h3>' + this.esc(cfg.region.name) + '</h3><h2>' + this.esc(cfg.name) + ' – klar</h2>' + this.statsHtml(st, time) + idealHtml +
      '<p class="wealth">Sfärer i lägret: <b>' + Progression.wealth + '</b></p>' +
      '<div class="btns row"><button class="btn primary" data-act="next">Nästa etapp</button><button class="btn" data-act="camp">Lägret</button><button class="btn" data-act="menu">Huvudmeny</button></div>');
  },

  gameOver(cfg, st, time, actions) {
    this.actions = actions;
    this.show('gameover', '<h2>Du föll</h2><p class="muted">"Res dig. Resan är inte slut." – Lirra</p>' + this.statsHtml(st, time) +
      '<div class="btns row"><button class="btn primary" data-act="retry">Försök igen</button><button class="btn" data-act="camp">Lägret</button><button class="btn" data-act="menu">Huvudmeny</button></div>');
  },

  camp(actions) {
    this.actions = actions;
    const branches = {};
    for (const s of SKILLS) (branches[s.branch] || (branches[s.branch] = [])).push(s);
    let html = '<h2>Lägret</h2><p class="muted">Vid lägerelden kan Arin öva. Spendera sfärer på färdigheter som gäller i alla etapper.</p>' +
      '<p class="wealth">Sfärer: <b>' + Progression.wealth + '</b></p><div class="skills">';
    for (const b in branches) {
      html += '<div class="branch"><h3>' + this.esc(b) + '</h3>';
      for (const s of branches[b]) {
        const r = Progression.rank(s.id);
        let pips = '';
        for (let i = 0; i < s.max; i++) pips += '<span class="pip' + (i < r ? ' on' : '') + '"></span>';
        const maxed = r >= s.max;
        html += '<div class="skill"><b>' + this.esc(s.name) + '</b> <span class="pips">' + pips + '</span><p>' + this.esc(s.desc) + '</p>' +
          (maxed ? '<span class="muted">Fullärd</span>' : '<button class="btn" data-act="buy" data-arg="' + s.id + '"' + (Progression.canBuy(s.id) ? '' : ' disabled') + '>' + Progression.cost(s.id) + ' sfärer</button>') + '<div style="clear:both"></div></div>';
      }
      html += '</div>';
    }
    html += '</div><div class="btns row"><button class="btn primary" data-act="back">Tillbaka</button></div>';
    this.show('camp', html);
  },

  codex(tab, actions) {
    this.actions = actions;
    tab = tab || 'creatures';
    const seen = Save.data.codex.seen, notes = Save.data.codex.notes;
    let body = '';
    if (tab === 'creatures') {
      body = '<div class="entries">';
      for (const id in CODEX_CREATURES) {
        const c = CODEX_CREATURES[id];
        if (seen[id]) {
          let img = '';
          try { img = Sketch.creature(id) || ''; } catch (e) { img = ''; }
          body += '<div class="entry">' + (img ? '<img alt="" src="' + img + '">' : '') + '<h4>' + this.esc(c.name) + '</h4><p>' + this.esc(c.text) + '</p></div>';
        } else body += '<div class="entry"><div class="unknown">?</div><h4>Okänd</h4><p class="muted">Ännu inte skådad.</p></div>';
      }
      body += '</div>';
    } else if (tab === 'notes') {
      body = '<div class="entries">';
      let heroImg = '';
      try { heroImg = Sketch.creature('hero') || ''; } catch (e) { heroImg = ''; }
      body += '<div class="entry">' + (heroImg ? '<img alt="" src="' + heroImg + '">' : '') + '<h4>Arin</h4><p>Löparen som blev Windrunner. Bär lägrets blå rock med stolthet – och lite för stora stövlar.</p></div>';
      for (const id in CODEX_NOTES) {
        const n = CODEX_NOTES[id];
        if (n.always || notes[id]) body += '<div class="entry"><h4>' + this.esc(n.title) + '</h4><p>' + this.esc(n.text) + '</p></div>';
        else body += '<div class="entry"><h4>???</h4><p class="muted">Upptäck mer för att fylla sidan.</p></div>';
      }
      for (let i = 0; i < IDEALS.length; i++) {
        const I = IDEALS[i];
        body += '<div class="entry"><h4>' + this.esc(I.title) + '</h4>' + (Save.data.campaign.ideal > i ? '<p><i>”' + this.esc(I.words) + '”</i></p><p class="muted">' + this.esc(I.grants) + '</p>' : '<p class="muted">Ännu inte svuret.</p>') + '</div>';
      }
      body += '</div>';
    } else {
      body = '<div class="entries">';
      for (const a of ACHIEVEMENTS) {
        const on = Save.data.achievements[a.id];
        body += '<div class="entry" style="opacity:' + (on ? 1 : 0.55) + '"><h4>' + (on ? '★ ' : '☆ ') + this.esc(a.name) + '</h4><p>' + this.esc(a.desc) + '</p></div>';
      }
      const t = Save.data.totals;
      body += '</div><div class="ink-rule"></div><div class="cols">' +
        [['Fiender', t.kills], ['Speltid', formatTime(t.time)], ['Bossar', t.bosses], ['Fall', t.deaths], ['Gemhearts', t.gemhearts], ['Etapper', t.stages]].map((r) => '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>';
    }
    const tabBtn = (id, name) => '<button class="tab' + (tab === id ? ' on' : '') + '" data-act="tab" data-arg="' + id + '">' + name + '</button>';
    this.show('codex', '<h2>Skissboken</h2><div class="tabs">' + tabBtn('creatures', 'Varelser') + tabBtn('notes', 'Anteckningar') + tabBtn('achievements', 'Prestationer och statistik') + '</div>' + body +
      '<div class="btns row"><button class="btn primary" data-act="back">Tillbaka</button></div>');
  },

  settings(actions) {
    this.actions = actions;
    const s = Save.data.settings;
    const range = (k, label, min, max, step, val) => '<label class="setting"><span>' + label + '</span><input type="range" data-key="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';
    const check = (k, label) => '<label class="setting"><span>' + label + '</span><input type="checkbox" data-key="' + k + '"' + (s[k] ? ' checked' : '') + '></label>';
    const page = this.show('settings', '<h2>Inställningar</h2>' +
      range('volume', 'Huvudvolym', 0, 1, 0.05, s.volume) + range('music', 'Musik', 0, 1, 0.05, s.music) + range('sfx', 'Ljudeffekter', 0, 1, 0.05, s.sfx) +
      check('muted', 'Stäng av allt ljud') +
      range('sensitivity', 'Muskänslighet', 0.3, 2.5, 0.05, s.sensitivity) + check('invertY', 'Invertera musen i höjdled') +
      range('fov', 'Synfält (grader)', 55, 90, 1, s.fov) +
      '<label class="setting"><span>Grafikkvalitet</span><select data-key="quality"><option value="high"' + (s.quality === 'high' ? ' selected' : '') + '>Hög</option><option value="medium"' + (s.quality === 'medium' ? ' selected' : '') + '>Mellan</option><option value="low"' + (s.quality === 'low' ? ' selected' : '') + '>Låg (snabbast)</option></select></label>' +
      check('shadows', 'Skuggor') + check('bloom', 'Glöd (bloom)') +
      range('particles', 'Mängd partiklar', 0.2, 1, 0.1, s.particles) +
      check('numbers', 'Skadesiffror') + check('shake', 'Skärmskakning') + check('showFps', 'Visa bildfrekvens') +
      '<div class="btns row"><button class="btn primary" data-act="back">Tillbaka</button><button class="btn" data-act="resetSave">Radera sparfilen</button></div>', 'narrow');
    page.querySelectorAll('[data-key]').forEach((inp) => {
      const h = () => {
        const k = inp.dataset.key;
        s[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? Number(inp.value) : inp.value;
        actions.change(k);
      };
      inp.addEventListener('input', h);
      inp.addEventListener('change', h);
    });
  },

  about(actions) {
    this.actions = actions;
    const k = (keys, what) => '<span>' + keys + '</span><span>' + what + '</span>';
    this.show('about', '<h2>Om spelet</h2>' +
      '<p>Stormvandrare är ett icke-kommersiellt fanspel som utspelar sig i världen från Brandon Sandersons <i>The Stormlight Archive</i>. Det har ingen koppling till författaren, Dragonsteel eller förlagen. Världens namn och begrepp tillhör sina upphovspersoner; huvudpersonen Arin, honorsprenen Lirra, alla texter, all grafik, allt ljud och all kod är egna.</p>' +
      '<h3>Kontroller</h3><div class="keys">' +
      k('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Gå och styr i luften') +
      k('Mus', 'Titta (klicka i fönstret för att fånga musen)') +
      k('Vänsterklick', 'Hugg med Shardblade (tre i rad = avslut)') +
      k('Högerklick / <kbd>V</kbd>', 'Lasha dig mot siktet – igen åt samma håll = snabbare') +
      k('<kbd>E</kbd> / <kbd>Q</kbd>', 'Lasha nedåt / ta tillbaka vanlig gravitation') +
      k('<kbd>Mellanslag</kbd> / <kbd>Shift</kbd>', 'Hopp / Stormlight-rusning') +
      k('<kbd>R</kbd> <kbd>F</kbd> <kbd>G</kbd> <kbd>C</kbd>', 'Full Lashing, Lasha fiende, spjut, vindkallelse (låses upp av Ideal)') +
      k('<kbd>Esc</kbd> / <kbd>M</kbd>', 'Paus / ljud av') +
      '</div><div class="btns row"><button class="btn primary" data-act="back">Tillbaka</button></div>');
  },
};
