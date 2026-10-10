// Handkontroll: emulerad Gamepad API (standardlayout).
module.exports.init = () => {
  const pad = { id: 'Testkontroll', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
};
const set = (page, fn) => page.evaluate(fn);
// Vänta ett antal bildrutor (spelet läser handkontrollen en gång per bildruta).
const frames = (page, n) => page.evaluate((n) => new Promise((res) => { const f = () => (n-- <= 0 ? res() : requestAnimationFrame(f)); f(); }), n);
const press = async (page, i) => {
  await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: true, value: 1 }; }, i);
  await frames(page, 2);
  await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: false, value: 0 }; }, i);
  await frames(page, 2);
};
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(800);
  const p0 = await page.evaluate(() => Array.from(Game.player.pos));
  await set(page, () => { window.__pad.axes = [0, -1, 0.8, 0]; });
  await page.waitForTimeout(1500);
  await set(page, () => { window.__pad.axes = [0, 0, 0, 0]; });
  const p1 = await page.evaluate(() => Array.from(Game.player.pos));
  console.log('aktiv', await page.evaluate(() => Pad.active), 'gick', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1), 'm');
  await press(page, 2);
  console.log('hugg', await page.evaluate(() => Blade.lastSwing > 0));
  await press(page, 6);
  console.log('lash', await page.evaluate(() => Game.player.lashed));
  await press(page, 14);
  console.log('åter', await page.evaluate(() => !Game.player.lashed));
  await press(page, 9);
  console.log('paus', await page.evaluate(() => Game.state));
  // Menynavigering: ned två steg (Inställningar), A, sedan B tillbaka.
  await press(page, 13); await press(page, 13);
  console.log('fokus', await page.evaluate(() => document.activeElement.textContent));
  await press(page, 0);
  console.log('meny', await page.evaluate(() => UI.current));
  await press(page, 1);
  console.log('tillbaka', await page.evaluate(() => UI.current));
  await press(page, 9);
  console.log('spelar', await page.evaluate(() => Game.state));
  await page.screenshot({ path: dir + '/gamepad.png' });
};
