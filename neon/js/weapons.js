'use strict';
// Vapen: definitioner med nivåer, avfyrning och poolade spelarskott.
// Varje nivå i `levels` anger de fullständiga värdena för den nivån.

const WEAPONS = {
  blaster: {
    name: 'Pulsblaster', color: '#3ff6ff',
    desc: 'Skjuter automatiskt mot närmaste fiende.',
    levels: [
      { dmg: 12, cd: 0.45, count: 1, pierce: 0, text: 'Skjuter automatiskt mot närmaste fiende.' },
      { dmg: 12, cd: 0.45, count: 2, pierce: 0, text: '+1 skott per salva.' },
      { dmg: 13, cd: 0.45, count: 2, pierce: 0, text: '+30% skada, snabbare eldtakt.' },
      { dmg: 13, cd: 0.45, count: 3, pierce: 0, text: '+1 skott per salva.' },
      { dmg: 15, cd: 0.36, count: 3, pierce: 1, text: 'Snabbare eldtakt och +1 genomträngning.' },
      { dmg: 19, cd: 0.32, count: 4, pierce: 1, text: 'MAX: +1 skott och +25% skada.' },
    ],
    update(w, dt, game) {
      const L = this.levels[w.level - 1], st = game.player.stats;
      w.timer -= dt * st.fireRate;
      if (w.timer > 0) return;
      const p = game.player;
      const target = Enemies.nearest(p.x, p.y, 650);
      if (!target) { w.timer = 0; return; }
      w.timer = L.cd;
      const count = L.count + st.projectiles;
      const base = Math.atan2(target.y - p.y, target.x - p.x);
      const spread = 0.11;
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * spread;
        Weapons.fire(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, a, 760, L.dmg, L.pierce + st.pierce, 4, this.color, 0);
      }
      game.onShoot('blaster');
    },
  },

  orbit: {
    name: 'Kretsande blad', color: '#ff3fa4',
    desc: 'Energiblad kretsar runt farkosten.',
    levels: [
      { dmg: 9, count: 2, radius: 70, speed: 3.0, text: 'Två energiblad kretsar runt farkosten.' },
      { dmg: 9, count: 3, radius: 72, speed: 3.0, text: '+1 blad.' },
      { dmg: 13, count: 3, radius: 78, speed: 3.4, text: '+40% skada och snabbare rotation.' },
      { dmg: 13, count: 4, radius: 86, speed: 3.4, text: '+1 blad och större radie.' },
      { dmg: 17, count: 4, radius: 90, speed: 4.2, text: '+30% skada och snabbare rotation.' },
      { dmg: 22, count: 5, radius: 96, speed: 4.4, text: 'MAX: +1 blad och +30% skada.' },
    ],
    update(w, dt, game) {
      const L = this.levels[w.level - 1], p = game.player, st = p.stats;
      w.angle = (w.angle || 0) + L.speed * dt;
      const count = L.count + st.projectiles;
      const radius = L.radius * st.area, br = 9 * st.area;
      const near = Weapons.near;
      w.points = w.points || [];
      w.points.length = count;
      for (let i = 0; i < count; i++) {
        const a = w.angle + (i / count) * TAU;
        const x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
        w.points[i] = w.points[i] || { x: 0, y: 0 };
        w.points[i].x = x; w.points[i].y = y;
        Enemies.grid.query(x, y, br + 60, near);
        for (let j = 0; j < near.length; j++) {
          const e = near[j];
          if (e.dead || game.time - e.lastOrbitHit < 0.35) continue;
          const rr = br + e.r;
          if (dist2(x, y, e.x, e.y) < rr * rr) {
            e.lastOrbitHit = game.time;
            game.damageEnemy(e, L.dmg, p.x, p.y, 160);
          }
        }
      }
    },
    draw(w, ctx, game) {
      if (!w.points) return;
      // Fyruddigt blad som snurrar.
      const sp = Sprites.get('orb', 12, 12, (g) => neonShape(g, '#ff8ae0', 12, 2, 0.75, (p) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, r = i % 2 ? 4 : 12;
          if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r); else p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      }));
      const sc = game.player.stats.area;
      const half = sp.half * sc;
      const rot = w.angle * 3;
      for (let i = 0; i < w.points.length; i++) {
        const pt = w.points[i];
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(rot);
        ctx.drawImage(sp.img, -half, -half, half * 2, half * 2);
        ctx.restore();
      }
    },
  },

  missile: {
    name: 'Målsökande raketer', color: '#ffe23f',
    desc: 'Raketer som söker upp fiender och exploderar.',
    levels: [
      { dmg: 22, cd: 1.6, count: 1, blast: 55, text: 'Raketer som söker upp fiender och exploderar.' },
      { dmg: 30, cd: 1.6, count: 1, blast: 60, text: '+35% skada.' },
      { dmg: 30, cd: 1.5, count: 2, blast: 60, text: '+1 raket.' },
      { dmg: 34, cd: 1.5, count: 2, blast: 80, text: 'Större explosioner.' },
      { dmg: 38, cd: 1.15, count: 2, blast: 85, text: 'Snabbare omladdning.' },
      { dmg: 46, cd: 1.1, count: 3, blast: 95, text: 'MAX: +1 raket och +20% skada.' },
    ],
    update(w, dt, game) {
      const L = this.levels[w.level - 1], p = game.player, st = p.stats;
      w.timer -= dt * st.fireRate;
      if (w.timer > 0) return;
      if (!Enemies.nearest(p.x, p.y, 700)) { w.timer = 0; return; }
      w.timer = L.cd;
      const count = L.count + Math.floor(st.projectiles / 2);
      for (let i = 0; i < count; i++) {
        const a = p.angle + Math.PI + (i - (count - 1) / 2) * 0.6;
        const b = Weapons.fire(p.x, p.y, a, 260, L.dmg, 0, 6, this.color, 1);
        b.blast = L.blast * st.area;
        b.life = 3.5;
      }
      game.onShoot('missile');
    },
  },

  lightning: {
    name: 'Blixtkedja', color: '#9d7dff',
    desc: 'En blixt som hoppar mellan fiender.',
    levels: [
      { dmg: 16, cd: 1.4, chains: 2, bolts: 1, text: 'En blixt som hoppar mellan tre fiender.' },
      { dmg: 16, cd: 1.4, chains: 3, bolts: 1, text: '+1 hopp.' },
      { dmg: 23, cd: 1.3, chains: 3, bolts: 1, text: '+40% skada.' },
      { dmg: 23, cd: 1.05, chains: 4, bolts: 1, text: 'Snabbare och +1 hopp.' },
      { dmg: 27, cd: 1.0, chains: 5, bolts: 2, text: 'Två blixtar samtidigt.' },
      { dmg: 35, cd: 0.9, chains: 6, bolts: 2, text: 'MAX: +30% skada och +1 hopp.' },
    ],
    update(w, dt, game) {
      const L = this.levels[w.level - 1], p = game.player, st = p.stats;
      w.bolts = w.bolts || [];
      for (let i = w.bolts.length - 1; i >= 0; i--) {
        w.bolts[i].life -= dt;
        if (w.bolts[i].life <= 0) w.bolts.splice(i, 1);
      }
      w.timer -= dt * st.fireRate;
      if (w.timer > 0) return;
      const first = Enemies.nearest(p.x, p.y, 420);
      if (!first) { w.timer = 0; return; }
      w.timer = L.cd;
      const serial = (w.serial = (w.serial || 0) + 1) * 8;
      for (let b = 0; b < L.bolts; b++) {
        const hitTag = serial + b;
        let target = b === 0 ? first : Enemies.nearest(p.x, p.y, 420, (e) => e.zapTag === serial || e.zapTag === hitTag);
        if (!target) break;
        const pts = [p.x, p.y];
        let fx = p.x, fy = p.y;
        for (let c = 0; c <= L.chains + st.projectiles && target; c++) {
          target.zapTag = hitTag;
          Weapons.jag(pts, fx, fy, target.x, target.y);
          fx = target.x; fy = target.y;
          game.damageEnemy(target, L.dmg, fx - 1, fy, 0);
          target = Enemies.nearest(fx, fy, 180 * st.area, (e) => e.zapTag === hitTag);
        }
        w.bolts.push({ pts, life: 0.18 });
      }
      game.onShoot('lightning');
    },
    draw(w, ctx) {
      if (!w.bolts || !w.bolts.length) return;
      ctx.save();
      ctx.lineJoin = 'round';
      for (let i = 0; i < w.bolts.length; i++) {
        const bolt = w.bolts[i], pts = bolt.pts;
        ctx.globalAlpha = Math.min(1, bolt.life / 0.1);
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? 'rgba(157,125,255,0.45)' : '#f0e8ff';
          ctx.lineWidth = pass === 0 ? 8 : 2;
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  nova: {
    name: 'Novapuls', color: '#3fff8a',
    desc: 'En chockvåg som skadar och knuffar bort fiender.',
    levels: [
      { dmg: 18, cd: 3.0, radius: 140, text: 'En chockvåg som skadar och knuffar bort fiender.' },
      { dmg: 18, cd: 2.8, radius: 170, text: 'Större radie.' },
      { dmg: 26, cd: 2.8, radius: 170, text: '+45% skada.' },
      { dmg: 26, cd: 2.3, radius: 190, text: 'Snabbare puls.' },
      { dmg: 30, cd: 2.2, radius: 220, text: 'Större radie och mer skada.' },
      { dmg: 40, cd: 1.9, radius: 240, text: 'MAX: +35% skada och snabbare puls.' },
    ],
    update(w, dt, game) {
      const L = this.levels[w.level - 1], p = game.player, st = p.stats;
      const maxR = L.radius * st.area;
      if (w.ring) {
        const prev = w.ring.r;
        w.ring.r += 650 * dt;
        const near = Enemies.grid.query(w.ring.x, w.ring.y, w.ring.r + 30, Weapons.near);
        for (let i = 0; i < near.length; i++) {
          const e = near[i];
          if (e.dead || e.novaId === w.ring.id) continue;
          const d = Math.sqrt(dist2(w.ring.x, w.ring.y, e.x, e.y)) - e.r;
          if (d <= w.ring.r && d >= prev - 40) {
            e.novaId = w.ring.id;
            game.damageEnemy(e, L.dmg, w.ring.x, w.ring.y, 380);
          }
        }
        if (w.ring.r >= w.ring.max) w.ring = null;
      }
      w.timer -= dt * st.fireRate;
      if (w.timer > 0) return;
      w.timer = L.cd;
      w.ring = { x: p.x, y: p.y, r: 0, max: maxR, id: (w.pulse = (w.pulse || 0) + 1) };
      game.onShoot('nova');
    },
    draw(w, ctx) {
      if (!w.ring) return;
      const t = w.ring.r / w.ring.max;
      ctx.save();
      ctx.globalAlpha = 1 - t * 0.8;
      ctx.strokeStyle = 'rgba(63,255,138,0.35)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(w.ring.x, w.ring.y, w.ring.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#c8ffd9';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    },
  },
};

const WEAPON_IDS = Object.keys(WEAPONS);
const MAX_WEAPONS = 5;

function createBullet() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 0, pierce: 0, life: 0, color: '', kind: 0,
    hits: [], target: null, blast: 0, speed: 0,
  };
}

const Weapons = {
  bullets: new Pool(createBullet, 600),
  near: [],

  reset() { this.bullets.clear(); },

  // kind 0 = vanligt skott, 1 = målsökande raket.
  fire(x, y, angle, speed, dmg, pierce, r, color, kind) {
    const b = this.bullets.spawn();
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.speed = speed;
    b.dmg = dmg;
    b.pierce = pierce;
    b.r = r;
    b.color = color;
    b.kind = kind;
    b.life = 1.2;
    b.hits.length = 0;
    b.target = null;
    b.blast = 0;
    return b;
  },

  // Lägger till en sicksackad linje (för blixtar) i pts.
  jag(pts, x0, y0, x1, y1) {
    const segs = 5;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, off = i === segs ? 0 : rand(-1, 1) * Math.min(18, len * 0.15);
      pts.push(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
    }
  },

  update(dt, game) {
    const list = game.weapons;
    for (let i = 0; i < list.length; i++) WEAPONS[list[i].id].update(list[i], dt, game);

    const a = this.bullets.active, near = this.near;
    for (let i = a.length - 1; i >= 0; i--) {
      const b = a[i];
      if (b.kind === 1) {
        // Raket: sök mål och sväng mot det.
        if (!b.target || b.target.dead) b.target = Enemies.nearest(b.x, b.y, 600);
        b.speed = Math.min(560, b.speed + 700 * dt);
        let ang = Math.atan2(b.vy, b.vx);
        if (b.target) {
          let d = Math.atan2(b.target.y - b.y, b.target.x - b.x) - ang;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          ang += clamp(d, -6 * dt, 6 * dt);
        }
        b.vx = Math.cos(ang) * b.speed;
        b.vy = Math.sin(ang) * b.speed;
        game.onMissileTrail(b);
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let remove = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H;

      if (!remove) {
        Enemies.grid.query(b.x, b.y, b.r + 60, near);
        for (let j = 0; j < near.length; j++) {
          const e = near[j];
          if (e.dead) continue;
          const rr = b.r + e.r;
          if (dist2(b.x, b.y, e.x, e.y) >= rr * rr) continue;
          if (b.kind === 1) {
            this.explode(b, game);
            remove = true;
            break;
          }
          if (b.hits.indexOf(e.id) !== -1) continue;
          b.hits.push(e.id);
          game.damageEnemy(e, b.dmg, b.x - b.vx, b.y - b.vy, 90);
          if (b.pierce-- <= 0) { remove = true; break; }
        }
      }
      if (remove && b.kind === 1 && b.life <= 0) this.explode(b, game);
      if (remove) this.bullets.releaseAt(i);
    }
  },

  explode(b, game) {
    const near = Enemies.grid.query(b.x, b.y, b.blast + 60, this.near);
    for (let j = 0; j < near.length; j++) {
      const e = near[j];
      if (e.dead) continue;
      const rr = b.blast + e.r;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) game.damageEnemy(e, b.dmg, b.x, b.y, 260);
    }
    game.onExplosion(b.x, b.y, b.blast, b.color);
  },

  draw(ctx, game) {
    const v = game.view(20);
    const a = this.bullets.active;
    for (let i = 0; i < a.length; i++) {
      const b = a[i];
      if (b.x < v.x0 || b.x > v.x1 || b.y < v.y0 || b.y > v.y1) continue;
      const ang = Math.atan2(b.vy, b.vx);
      const sp = b.kind === 1
        ? Sprites.rotated('missile', 10, 10, ang, (g) => neonShape(g, b.color, 10, 2, 0.5, (p) => { p.moveTo(10, 0); p.lineTo(-7, 5); p.lineTo(-7, -5); }))
        : Sprites.rotated('bullet-' + b.color, 10, 8, ang, (g) => neonShape(g, b.color, 8, 2, 0.9, (p) => { p.ellipse(0, 0, 9, 3.2, 0, 0, TAU); }));
      ctx.drawImage(sp.img, b.x - sp.half, b.y - sp.half);
    }
    const list = game.weapons;
    for (let i = 0; i < list.length; i++) {
      const def = WEAPONS[list[i].id];
      if (def.draw) def.draw(list[i], ctx, game);
    }
  },
};
