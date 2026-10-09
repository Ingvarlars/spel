// Bild på chasmfienden när den klättrat upp.
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    Game.stageBoss = 'chasmfiend';
    const p = Game.player; p.stats.maxHp = p.hp = 1e6;
    Enemies.reset();
    const ar = World.arena;
    p.spawnAt(ar.cx - 15, ar.y1 + 0.1, ar.cz);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Bosses.boss; b.rise = 1; b.state = 'roar'; b.timer = 5; b.cd = 5; });
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { const b = Bosses.boss, p = Game.player; const dx = b.pos[0] - p.pos[0], dz = b.pos[2] - p.pos[2]; V3.set(Camera.refFwd, dx, 0, dz); V3.normalize(Camera.refFwd, Camera.refFwd); Camera.pitch = 0.05; Camera.dist = 9; b.timer = 5; });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: dir + '/chasmfiend.png' });
};
