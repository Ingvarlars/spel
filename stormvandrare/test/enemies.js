// Visar alla fiendetyper på rad.
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    Enemies.reset();
    const p = Game.player;
    ['crab','warrior','archer','shield','thunder','hover','leech','brute'].forEach((t, i) => {
      const e = Enemies.spawn(t, p.pos[0] + 7, p.pos[1] + (ENEMY_DEFS[t].flying ? 1.2 : 0.1), p.pos[2] - 7 + i * 2, Game.mods);
      e.yaw = -Math.PI / 2; e.state = 0;
    });
    Camera.pitch = -0.12; Camera.dist = 4;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: dir + '/enemies.png' });
};
