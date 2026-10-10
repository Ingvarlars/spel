// Minikarta och hela kartan (Tab).
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: dir + '/map-mini.png' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  console.log('karta', await page.evaluate(() => Game.mapOpen));
  await page.screenshot({ path: dir + '/map-stor.png' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  console.log('stängd', await page.evaluate(() => !Game.mapOpen));
};
