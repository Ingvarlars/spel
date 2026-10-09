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
    ctx.fillText('Nivå ' + game.level + (game.wave ? '  ·  Våg ' + game.wave : ''), w / 2, 52);

    // Dödade fiender till höger.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8f6ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('☠ ' + game.stats.kills, w - 64, 30);

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
