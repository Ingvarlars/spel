// Menytest: huvudmeny, intro, spel, paus, lägret, skissboken, inställningar, om, klar och game over.
module.exports.menu = true;
const shot = (page, dir, n) => page.screenshot({ path: dir + '/menu-' + n + '.png' });
const click = async (page, act, arg) => {
  const sel = '#ui [data-act="' + act + '"]' + (arg ? '[data-arg="' + arg + '"]' : '');
  await page.waitForSelector(sel, { timeout: 4000 });
  await page.click(sel);
  await page.waitForTimeout(300);
};
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1500);
  await shot(page, dir, '1-huvud');
  await click(page, 'about'); await shot(page, dir, '2-om'); await click(page, 'back');
  await click(page, 'codex'); await page.waitForTimeout(500); await shot(page, dir, '3-skissbok');
  const tabs = await page.$$eval('#ui [data-act="tab"]', (b) => b.map((x) => x.dataset.arg));
  for (const t of tabs) { await click(page, 'tab', t); await shot(page, dir, '3-skissbok-' + t); }
  await click(page, 'back');
  await click(page, 'settings'); await shot(page, dir, '4-inst'); await click(page, 'back');
  await click(page, 'camp'); await shot(page, dir, '5-lager'); await click(page, 'back');
  await click(page, 'newGame'); await page.waitForTimeout(500); await shot(page, dir, '6-intro');
  await click(page, 'start'); await page.waitForTimeout(1500);
  console.log('efter start', await page.evaluate(() => Game.state));
  await shot(page, dir, '7-spel');
  await page.evaluate(() => Game.pause()); await page.waitForTimeout(300);
  console.log('paus', await page.evaluate(() => Game.state));
  await shot(page, dir, '8-paus');
  await click(page, 'codex'); await click(page, 'back');
  await click(page, 'settings'); await click(page, 'back');
  await click(page, 'resume'); await page.waitForTimeout(500);
  console.log('åter', await page.evaluate(() => Game.state));
  await page.evaluate(() => Game.stageComplete()); await page.waitForFunction(() => Game.state === 'complete', null, { timeout: 40000 });
  console.log('klar', await page.evaluate(() => Game.state + ' fps ' + Math.round(Game.fps)));
  await shot(page, dir, '9-klar');
  await click(page, 'camp'); await shot(page, dir, '9-lager2'); await click(page, 'back');
  await click(page, 'next'); await page.waitForTimeout(500);
  console.log('nästa', await page.evaluate(() => Game.state));
  if (await page.$('#ui [data-act="start"]')) await click(page, 'start');
  await page.waitForTimeout(800);
  await page.evaluate(() => { Game.player.invuln = 0; Game.player.takeDamage(99999, Game, null); }); await page.waitForFunction(() => Game.state === 'gameover', null, { timeout: 30000 });
  console.log('död', await page.evaluate(() => Game.state));
  await shot(page, dir, '10-gameover');
  await click(page, 'menu'); await page.waitForTimeout(800);
  console.log('meny', await page.evaluate(() => Game.state), await page.evaluate(() => localStorage.getItem('stormvandrare-v1').length));
  await shot(page, dir, '11-meny2');
  // Sparfilen ska överleva en omladdning och visa "Fortsätt resan".
  const before = await page.evaluate(() => ({ r: Campaign.region, s: Campaign.stage, w: Progression.wealth }));
  await page.reload(); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ r: Campaign.region, s: Campaign.stage, w: Progression.wealth, cont: !!document.querySelector('#ui [data-act="continue"]') }));
  console.log('sparning', JSON.stringify(before), JSON.stringify(after));
  if (before.r !== after.r || before.s !== after.s || before.w !== after.w || !after.cont) throw new Error('Sparfilen återställdes inte');
};
