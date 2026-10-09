// Röktest: spela en stund, Lasha, hugg och ta en skärmbild.
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1200);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');
  await page.evaluate(() => { Camera.pitch = 0.4; Input.queued.lash = true; Input.queued.attack = true; });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { Input.queued.reset = true; });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({ state: Game.state, pos: Array.from(Game.player.pos).map((v) => +v.toFixed(1)), enemies: Enemies.list.length, fps: Math.round(Game.fps) }));
  console.log(JSON.stringify(st));
  await page.screenshot({ path: dir + '/smoke.png' });
};
