'use strict';
// Sfärer, gemhearts och knobweed.
// Sfärer ligger kvar när man dragit ur deras Stormlight och laddas igen av highstormen.

const GEMS = [
  { name: 'diamant', color: '#f4fbff' },
  { name: 'safir', color: '#5fa8ff' },
  { name: 'rubin', color: '#ff5a5a' },
  { name: 'smaragd', color: '#4fe08a' },
  { name: 'topas', color: '#ffc845' },
  { name: 'ametist', color: '#c07bff' },
];
// chip, mark och broam (växande storlek och mängd Stormlight).
const SPHERE_SIZES = [
  { name: 'chip', light: 5, r: 4, value: 1 },
  { name: 'mark', light: 12, r: 5.5, value: 5 },
  { name: 'broam', light: 28, r: 7.5, value: 20 },
];

function createPickup() {
  return { kind: 'sphere', x: 0, y: 0, vx: 0, vy: 0, size: 0, gem: 0, charged: true, draining: 0, life: -1, settled: false, bob: 0, value: 0, taken: false };
}

const Pickups = {
  pool: new Pool(createPickup, 120),
  streams: [], // Stormlight som strömmar till spelaren { x, y, t, color }

  reset() {
    this.pool.clear();
    this.streams.length = 0;
  },

  spawnSphere(x, y, size, charged, loose) {
    const o = this.pool.spawn();
    o.kind = 'sphere';
    o.x = x; o.y = y;
    o.vx = loose ? rand(-120, 120) : 0;
    o.vy = loose ? rand(-320, -160) : 0;
    o.size = size;
    o.gem = randInt(0, GEMS.length - 1);
    o.charged = charged;
    o.draining = 0;
    o.life = loose ? 40 : -1;
    o.settled = !loose;
    o.bob = rand(0, TAU);
    o.value = SPHERE_SIZES[size].value;
    o.taken = false;
    return o;
  },

  spawnItem(kind, x, y) {
    const o = this.pool.spawn();
    o.kind = kind;
    o.x = x; o.y = y;
    o.vx = rand(-60, 60); o.vy = -300;
    o.settled = false;
    o.life = -1;
    o.bob = rand(0, TAU);
    o.taken = false;
    o.charged = true;
    return o;
  },

  // Fiender tappar en handfull laddade chips (ibland en mark).
  dropFromEnemy(e) {
    const n = e.def.glow;
    let left = n;
    while (left > 0) {
      const size = left >= 5 && Math.random() < 0.5 ? 1 : 0;
      this.spawnSphere(e.x, e.y, size, true, true);
      left -= size ? 5 : 1;
      if (this.pool.count > 160) break;
    }
  },

  // Highstormen laddar sfärer som den passerar.
  chargeBetween(x0, x1) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const o = a[i];
      if (o.kind === 'sphere' && !o.charged && o.x >= x0 && o.x <= x1) {
        o.charged = true;
        Effects.burst(o.x, o.y, GEMS[o.gem].color, 6, 80, 0.5, 2);
      }
    }
  },

  update(dt, game) {
    const p = game.player;
    const a = this.pool.active;
    const range = p.stats.magnet + 40;
    for (let i = a.length - 1; i >= 0; i--) {
      const o = a[i];
      if (o.life > 0) { o.life -= dt; if (o.life <= 0) { this.pool.releaseAt(i); continue; } }
      o.bob += dt * 3;
      if (!o.settled) {
        o.vy += GRAVITY * 0.8 * dt;
        o.vx *= Math.exp(-1.5 * dt);
        const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
        if (World.solidAtPx(nx, ny + 6)) {
          o.vy = -o.vy * 0.3;
          o.vx *= 0.6;
          if (Math.abs(o.vy) < 60) { o.vy = 0; o.vx = 0; o.settled = true; }
        } else { o.x = nx; o.y = ny; }
        if (World.solidAtPx(o.x, o.y)) o.y -= 4;
      }
      if (!p.alive) continue;
      const d2 = dist2(o.x, o.y, p.x, p.y);

      if (o.kind === 'sphere') {
        // Andas in Stormlight på avstånd; sfären blir mörk men ligger kvar.
        if (o.charged && d2 < range * range && p.light < p.stats.maxLight - 1) {
          o.draining += dt;
          if (o.draining > 0.25) {
            o.charged = false;
            o.draining = 0;
            p.addLight(SPHERE_SIZES[o.size].light);
            this.streams.push({ x: o.x, y: o.y, t: 0, color: GEMS[o.gem].color });
            game.onDrawLight(o);
          }
        } else o.draining = 0;
        // Lösa sfärer plockas upp som rikedom när man går över dem.
        if (!o.taken && d2 < 26 * 26) {
          o.taken = true;
          game.onSphereTaken(o);
          if (o.charged) { p.addLight(SPHERE_SIZES[o.size].light); game.onDrawLight(o); }
          this.pool.releaseAt(i);
        }
      } else if (d2 < 34 * 34) {
        game.onItem(o);
        this.pool.releaseAt(i);
      }
    }
    for (let i = this.streams.length - 1; i >= 0; i--) {
      this.streams[i].t += dt * 2.5;
      if (this.streams[i].t >= 1) this.streams.splice(i, 1);
    }
  },

  draw(ctx, game) {
    const v = game.view(30);
    const t = game.realTime;
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const o = a[i];
      if (o.x < v.x0 || o.x > v.x1 || o.y < v.y0 || o.y > v.y1) continue;
      if (o.kind === 'sphere') {
        const S = SPHERE_SIZES[o.size], G = GEMS[o.gem];
        const y = o.y - (o.settled ? 2 + Math.sin(o.bob) * (o.charged ? 1.5 : 0) : 0);
        if (o.charged) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = S.r * 4 + Math.sin(t * 3 + i) * 2;
          const g = ctx.createRadialGradient(o.x, y, 0, o.x, y, r);
          g.addColorStop(0, G.color);
          g.addColorStop(0.3, G.color + '88');
          g.addColorStop(1, G.color + '00');
          ctx.fillStyle = g;
          ctx.fillRect(o.x - r, y - r, r * 2, r * 2);
          ctx.restore();
        }
        // Glaskula med ädelsten inuti.
        ctx.fillStyle = 'rgba(220,235,240,0.35)';
        ctx.beginPath(); ctx.arc(o.x, y, S.r + 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = o.charged ? G.color : '#6f6a66';
        ctx.beginPath(); ctx.arc(o.x, y, S.r * 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(o.x - S.r * 0.5, y - S.r * 0.6, 1.5, 1.5);
      } else if (o.kind === 'gemheart') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 40);
        g.addColorStop(0, 'rgba(120,255,180,0.9)');
        g.addColorStop(1, 'rgba(60,200,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(o.x - 40, o.y - 40, 80, 80);
        ctx.restore();
        ctx.save();
        ctx.translate(o.x, o.y - 4 + Math.sin(o.bob) * 3);
        ctx.rotate(Math.sin(t) * 0.2);
        ctx.fillStyle = '#3fcf7a';
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, -4); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-10, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b8ffd6';
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(4, -4); ctx.lineTo(0, 10); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (o.kind === 'knobweed') {
        // Knobweed: knotig växt vars sav läker.
        const y = o.y;
        ctx.strokeStyle = '#4f7a35'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o.x, y); ctx.quadraticCurveTo(o.x - 6, y - 10, o.x - 2, y - 18); ctx.stroke();
        ctx.fillStyle = '#86b84f';
        ctx.beginPath(); ctx.arc(o.x - 2, y - 19, 4, 0, TAU); ctx.arc(o.x - 5, y - 10, 3, 0, TAU); ctx.arc(o.x + 2, y - 8, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 4 + i)) + ')';
        ctx.fillRect(o.x - 3, y - 21, 2, 2);
      }
    }

    // Strömmar av Stormlight från sfär till spelare.
    const p = game.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.streams.length; i++) {
      const s = this.streams[i];
      for (let k = 0; k < 6; k++) {
        const tt = clamp(s.t - k * 0.05, 0, 1);
        const x = lerp(s.x, p.x, tt) + Math.sin(tt * 9 + k) * 10 * (1 - tt);
        const y = lerp(s.y, p.y, tt) - Math.sin(tt * Math.PI) * 30;
        ctx.fillStyle = 'rgba(225,245,255,' + (0.7 - k * 0.1) + ')';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    ctx.restore();
  },
};
