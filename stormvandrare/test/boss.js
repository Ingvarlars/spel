// Testar en boss: teleportera till arenan, slåss en stund (odödlig), döda den och ta gemhearten.
// Användning: node test/run.js test/boss.js <katalog>  (BOSS=thunderclast m.m. via process.env)
module.exports.run = async (page, dir) => {
  const type = process.env.BOSS || 'chasmfiend';
  await page.waitForTimeout(800);
  await page.evaluate((type) => {
    Game.stageBoss = type;
    const p = Game.player; p.stats.maxHp = p.hp = 1e6;
    Enemies.reset();
    const ar = World.arena;
    p.spawnAt(ar.cx - 15, ar.y1 + 0.1, ar.cz);
    Camera.reset(V3.create(0, 1, 0), V3.create(1, 0, 0));
    Progression.reset(5); Progression.apply(p); p.light = p.stats.maxLight;
  }, type);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: dir + '/boss-' + type + '-a.png' });
  for (let i = 0; i < 24; i++) {
    await page.evaluate((i) => {
      Input.queued.attack = true;
      if (i % 6 === 0) Input.queued.spear = true;
      if (i % 9 === 0) Input.queued.full = true;
      const b = Bosses.boss; if (b) { const z = Bosses.zones(b)[0]; const p = Game.player; let dx = z[0] - p.pos[0], dz = z[2] - p.pos[2];
        const d = Math.hypot(dx, dz) || 1; p.pos[0] = z[0] - dx / d * 2.8; p.pos[2] = z[2] - dz / d * 2.8; p.pos[1] = z[1] - 0.95; V3.set(p.vel, 0, 0, 0); dx = z[0] - p.pos[0]; dz = z[2] - p.pos[2]; Camera.refFwd[0] = dx; Camera.refFwd[2] = dz; Camera.refFwd[1] = 0; V3.normalize(Camera.refFwd, Camera.refFwd); Camera.pitch = 0.1; }
    }, i);
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: dir + '/boss-' + type + '-b.png' });
  console.log(await page.evaluate(() => JSON.stringify({ boss: Bosses.boss && { hp: Math.round(Bosses.boss.hp), max: Bosses.boss.maxHp, state: Bosses.boss.state, phase: Bosses.boss.phase }, dmg: Math.round(Game.stats.damage), ideal: Progression.ideal })));
  await page.evaluate(() => { const b = Bosses.boss; if (b) { b.invulnerable = false; Game.damageEnemy(b, 1e6, null, 0, 'test'); } });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = Pickups.pool.active.find((o) => o.kind === 'gemheart'); if (g) { const p = Game.player; p.pos[0] = g.pos[0]; p.pos[2] = g.pos[2]; p.pos[1] = g.pos[1] + 0.2; } });
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => JSON.stringify({ complete: Game.complete, banner: Game.banner && Game.banner.text, ideal: Progression.ideal })));
};
