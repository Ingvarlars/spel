// Headless-test för Stormvandrare.
// Användning: node stormvandrare/test/run.js <scenario.js> [utkatalog]
// Kräver Playwright (förinstallerat i molnmiljön under /opt/node22/lib/node_modules).
// Scenariot exporterar run(page, dir) och valfritt context/init.
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
  const scenario = require(path.resolve(process.argv[2]));
  const outDir = path.resolve(process.argv[3] || '.');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext(scenario.context || { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|GroupMarkerNotSet/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  if (scenario.init) await page.addInitScript(scenario.init);
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);
  try { await scenario.run(page, outDir); } catch (e) { errors.push('scenario: ' + e.stack); }
  console.log(errors.length ? 'FEL:\n' + errors.join('\n') : 'Inga konsolfel');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
