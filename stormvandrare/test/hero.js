// Närbilder på huvudkaraktären i olika lägen.
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1000);
  await page.evaluate(() => { Enemies.reset(); Camera.dist = 3.2; Camera.shoulder = 0.3; Camera.pitch = -0.15; Camera.look(2.6, 0); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: dir + '/hero-idle.png' });
  await page.evaluate(() => { Camera.look(-2.6, 0); Camera.dist = 4; });
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.evaluate(() => Camera.look(1.2, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: dir + '/hero-run.png' });
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  await page.evaluate(() => { Camera.look(-1.2, 0); Input.queued.attack = true; });
  await page.waitForTimeout(90);
  await page.screenshot({ path: dir + '/hero-attack.png' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { Camera.pitch = 0.35; Camera.dist = 5; Input.queued.lash = true; });
  await page.waitForTimeout(150);
  await page.evaluate(() => { Input.queued.lash = true; });
  await page.waitForTimeout(1100);
  await page.evaluate(() => { Camera.pitch = -0.1; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: dir + '/hero-fly.png' });
  console.log(await page.evaluate(() => JSON.stringify({ flying: Game.player.flying, v: Math.round(V3.len(Game.player.vel)) })));
};
