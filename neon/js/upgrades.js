'use strict';
// Uppgraderingar vid ny nivå: passiva förbättringar och vapen.

const PASSIVES = {
  multishot: { name: 'Fler skott', icon: '⁂', color: '#3ff6ff', max: 3, desc: '+1 projektil för alla vapen.', apply: (p) => { p.stats.projectiles += 1; } },
  firerate: { name: 'Snabbare eldtakt', icon: '»', color: '#ffe23f', max: 5, desc: '+12% eldtakt för alla vapen.', apply: (p) => { p.stats.fireRate += 0.12; } },
  pierce: { name: 'Genomträngande skott', icon: '➤', color: '#9d7dff', max: 3, desc: 'Skott går igenom ytterligare en fiende.', apply: (p) => { p.stats.pierce += 1; } },
  shield: { name: 'Sköld', icon: '⬡', color: '#7fa8ff', max: 3, desc: 'Blockerar en träff. Laddas om automatiskt (+1 laddning per nivå).', apply: (p) => { p.stats.shieldMax += 1; p.stats.shieldTime = Math.max(6, p.stats.shieldTime - 1.5); p.shield += 1; } },
  regen: { name: 'Livsregenerering', icon: '✚', color: '#3fff8a', max: 5, desc: '+0,8 liv per sekund.', apply: (p) => { p.stats.regen += 0.8; } },
  magnet: { name: 'XP-magnet', icon: '◎', color: '#3fd0ff', max: 5, desc: '+40% upplockningsradie för XP.', apply: (p) => { p.stats.magnet *= 1.4; } },
  damage: { name: 'Överladdning', icon: '✦', color: '#ff3fa4', max: 5, desc: '+15% skada.', apply: (p) => { p.stats.damage += 0.15; } },
  maxhp: { name: 'Förstärkt skrov', icon: '♥', color: '#ff4060', max: 5, desc: '+25 max-liv och läker 25.', apply: (p) => { p.stats.maxHp += 25; p.heal(25); } },
  speed: { name: 'Thrusters', icon: '▲', color: '#3ff6ff', max: 4, desc: '+8% fart och kortare dash-nedkylning.', apply: (p) => { p.stats.speed *= 1.08; p.stats.dashCooldown *= 0.88; } },
  crit: { name: 'Precision', icon: '✧', color: '#ffe23f', max: 4, desc: '+7% chans till kritisk träff (dubbel skada).', apply: (p) => { p.stats.crit += 0.07; } },
  area: { name: 'Förstärkare', icon: '◈', color: '#3fff8a', max: 4, desc: '+15% område för blad, explosioner och pulser.', apply: (p) => { p.stats.area += 0.15; } },
  armor: { name: 'Pansarplåt', icon: '■', color: '#ff8a3f', max: 3, desc: 'Minskar all inkommande skada med 2.', apply: (p) => { p.stats.armor += 2; } },
};

const WEAPON_ICONS = { blaster: '•', orbit: '◌', missile: '➶', lightning: 'ϟ', nova: '◉' };

const Upgrades = {
  levels: {},

  reset() { this.levels = {}; },

  // Slumpar fram upp till n olika val.
  roll(game, n) {
    const cands = [];
    const owned = game.weapons.length;
    for (let i = 0; i < WEAPON_IDS.length; i++) {
      const id = WEAPON_IDS[i], def = WEAPONS[id];
      const lvl = game.weaponLevel(id);
      if (lvl === 0 && owned >= MAX_WEAPONS) continue;
      if (lvl >= def.levels.length) continue;
      cands.push({ w: lvl === 0 ? 1.1 : 1.5, v: {
        kind: 'weapon', id, name: def.name, icon: WEAPON_ICONS[id], color: def.color,
        level: lvl + 1, max: def.levels.length, isNew: lvl === 0, desc: def.levels[lvl].text,
      } });
    }
    for (const id in PASSIVES) {
      const def = PASSIVES[id];
      const lvl = this.levels[id] || 0;
      if (lvl >= def.max) continue;
      cands.push({ w: 1, v: {
        kind: 'passive', id, name: def.name, icon: def.icon, color: def.color,
        level: lvl + 1, max: def.max, isNew: lvl === 0, desc: def.desc,
      } });
    }
    const out = [];
    while (out.length < n && cands.length) {
      const v = weightedPick(cands);
      out.push(v);
      for (let i = 0; i < cands.length; i++) if (cands[i].v === v) { cands.splice(i, 1); break; }
    }
    if (out.length < n) {
      out.push({ kind: 'heal', id: 'heal', name: 'Reparation', icon: '♥', color: '#ff4060', level: 0, max: 0, isNew: false, desc: 'Läker 40% av max-livet.' });
    }
    return out;
  },

  apply(opt, game) {
    const p = game.player;
    if (opt.kind === 'weapon') game.addWeapon(opt.id);
    else if (opt.kind === 'passive') {
      this.levels[opt.id] = (this.levels[opt.id] || 0) + 1;
      PASSIVES[opt.id].apply(p);
    } else if (opt.kind === 'heal') p.heal(p.stats.maxHp * 0.4);
  },
};
