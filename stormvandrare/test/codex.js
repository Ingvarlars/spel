// Skissboken med alla varelser sedda (testar bläckteckningarna).
module.exports.menu = true;
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1200);
  await page.evaluate(() => { Object.keys(CODEX_CREATURES).forEach((id) => { Save.data.codex.seen[id] = 1; }); });
  await page.click('#ui [data-act="codex"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: dir + '/codex-alla.png' });
  await page.evaluate(() => document.querySelector('#ui .page').scrollTop = 700);
  await page.waitForTimeout(300);
  await page.screenshot({ path: dir + '/codex-alla2.png' });
};
