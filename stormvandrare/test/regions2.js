// Markbilder från varje region (från startplatån mot öster).
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  for (let r = 0; r < 4; r++) {
    await page.evaluate((r) => { Campaign.region = r; Campaign.stage = 2; Game.startStage(); Camera.pitch = -0.05; Camera.dist = 6; }, r);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: dir + '/ground-' + r + '.png' });
  }
};
