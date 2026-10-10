// Sfärer och highstorm (snabbspolad).
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  const info = () => page.evaluate(() => { const p = Game.player; const sp = Pickups.pool.active.filter((o) => o.kind === 'sphere'); return { light: Math.round(p.light), hp: Math.round(p.hp), storm: Storm.state, wall: Math.round(Storm.wallX), charged: sp.filter((o) => o.charged).length, dun: sp.filter((o) => !o.charged).length, herbs: Pickups.pool.active.filter((o) => o.kind === 'knobweed').length, shelter: p.inShelter, k: +Storm.intensity.toFixed(2) }; });
  await page.evaluate(() => { Enemies.reset(); Game.player.light = 10; const s = World.sphereSpots.find((q) => q.y > -10); if (s) { Game.player.pos[0] = s.x - 4; Game.player.pos[2] = s.z; Game.player.pos[1] = s.y + 1; } });
  await page.waitForTimeout(1500);
  console.log('vid sfär', JSON.stringify(await info()));
  await page.screenshot({ path: dir + '/storm-spheres.png' });
  await page.evaluate(() => { Storm.timer = 0.1; });
  await page.waitForTimeout(2000);
  console.log('varning', JSON.stringify(await info()));
  await page.evaluate(() => { Storm.timer = 0.05; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { Storm.wallX = Game.player.pos[0] + 35; Storm.tailX = Storm.wallX + STORM_LENGTH; Camera.look(Math.PI * 0.5, 0); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: dir + '/storm-wall.png' });
  await page.evaluate(() => { Storm.wallX = Game.player.pos[0] - 20; Storm.tailX = Storm.wallX + STORM_LENGTH; });
  await page.waitForTimeout(2500);
  console.log('i stormen', JSON.stringify(await info()));
  await page.screenshot({ path: dir + '/storm-inside.png' });
  await page.evaluate(() => { Storm.wallX = World.bounds.x0 - 500; Storm.tailX = Storm.wallX + 10; });
  await page.waitForTimeout(500);
  console.log('efter', JSON.stringify(await info()));
};
