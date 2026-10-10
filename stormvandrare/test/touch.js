// Pekskärm: emulerad telefon i liggande läge. Joystick, kameradrag och knappar.
module.exports.context = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const touch = (page, type, pts, changed) => page.evaluate(({ type, pts, changed }) => {
  const el = document.elementFromPoint(changed[0].x, changed[0].y) || document.getElementById('touch');
  const mk = (p) => new Touch({ identifier: p.id, target: el, clientX: p.x, clientY: p.y });
  el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: pts.map(mk), changedTouches: changed.map(mk) }));
}, { type, pts, changed });
module.exports.run = async (page, dir) => {
  await page.waitForTimeout(1200);
  console.log('touch', await page.evaluate(() => TouchControls.active && Game.touch));
  const p0 = await page.evaluate(() => Array.from(Game.player.pos));
  // Joystick framåt.
  await touch(page, 'touchstart', [{ id: 1, x: 150, y: 280 }], [{ id: 1, x: 150, y: 280 }]);
  await touch(page, 'touchmove', [{ id: 1, x: 150, y: 210 }], [{ id: 1, x: 150, y: 210 }]);
  console.log('move', await page.evaluate(() => JSON.stringify(Input.touchMove)));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: dir + '/touch-1.png' });
  await touch(page, 'touchend', [], [{ id: 1, x: 150, y: 210 }]);
  const p1 = await page.evaluate(() => Array.from(Game.player.pos));
  console.log('gick', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1), 'm');
  // Kameradrag på höger sida.
  const y0 = await page.evaluate(() => Math.atan2(Camera.refFwd[0], Camera.refFwd[2]));
  await touch(page, 'touchstart', [{ id: 2, x: 500, y: 200 }], [{ id: 2, x: 500, y: 200 }]);
  await touch(page, 'touchmove', [{ id: 2, x: 600, y: 200 }], [{ id: 2, x: 600, y: 200 }]); console.log('lookDX', await page.evaluate(() => Input.lookDX));
  await touch(page, 'touchend', [], [{ id: 2, x: 600, y: 200 }]);
  await page.waitForFunction(() => Input.lookDX === 0, null, { timeout: 5000 });
  console.log('kamera', ((await page.evaluate(() => Math.atan2(Camera.refFwd[0], Camera.refFwd[2]))) - y0).toFixed(2));
  // Hugg-knappen.
  const b = await page.evaluate(() => { const r = document.querySelector('.tattack').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await touch(page, 'touchstart', [{ id: 3, ...b }], [{ id: 3, ...b }]);
  await page.waitForTimeout(500);
  await touch(page, 'touchend', [], [{ id: 3, ...b }]);
  console.log('hugg', await page.evaluate(() => Blade.lastSwing > 0));
  // Paus-knappen.
  const pb = await page.evaluate(() => { const r = document.querySelector('.tpause').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await touch(page, 'touchstart', [{ id: 4, ...pb }], [{ id: 4, ...pb }]);
  await touch(page, 'touchend', [], [{ id: 4, ...pb }]);
  await page.waitForTimeout(600);
  console.log('paus', await page.evaluate(() => Game.state));
  await page.screenshot({ path: dir + '/touch-2.png' });
};
