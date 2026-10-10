// Går igenom alla regioner och tar en bild per tema.
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  for (let r = 0; r < 4; r++) {
    await page.evaluate((r) => { Campaign.region = r; Campaign.stage = 1; Game.startStage(); Enemies.reset(); Camera.pitch = -0.2; Camera.dist = 7; }, r);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const p = Game.player; p.pos[1] += 18; V3.set(p.vel, 0, 0, 0); p.lash(V3.normalize(V3.create(), [1, 0.02, 0]), Game); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: dir + '/region-' + r + '.png' });
    console.log(await page.evaluate(() => JSON.stringify({ region: Game.stageCfg.region.name, stage: Game.stageCfg.name, prisms: World.prisms.length, enemies: Enemies.list.length })));
  }
  // Etapp utan boss: väktare och gemheart.
  await page.evaluate(() => { Campaign.region = 0; Campaign.stage = 1; Game.startStage(); const p = Game.player; p.stats.maxHp = p.hp = 1e6; const ar = World.arena; p.spawnAt(ar.cx - 10, ar.y1 + 0.1, ar.cz); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { for (const e of Enemies.list) if (e.guardian) Game.damageEnemy(e, 1e6, null, 0, 'test'); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const g = Pickups.pool.active.find((o) => o.kind === 'gemheart'); if (g) { const p = Game.player; p.pos[0] = g.pos[0]; p.pos[2] = g.pos[2]; p.pos[1] = g.pos[1] + 0.2; } });
  await page.waitForTimeout(600);
  console.log(await page.evaluate(() => JSON.stringify({ guardians: Game.guardians, complete: Game.complete, wealth: Progression.wealth, banner: Game.banner && Game.banner.text })));
};
