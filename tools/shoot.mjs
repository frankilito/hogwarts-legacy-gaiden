// 用系统 Chrome 驱动游戏:自动测试/定点截图
// 用法:
//   node tools/shoot.mjs shot out.png [zone] [extraQuery] [waitMs]
//   node tools/shoot.mjs cam out.png "x,y,z,tx,ty,tz" [zone] [extraQuery]
//   node tools/shoot.mjs eval out.png "JS代码" [zone] [waitMs]
//   node tools/shoot.mjs test [extraQuery]
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8996/';
const mode = process.argv[2] || 'shot';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1600,900', '--hide-scrollbars', '--mute-audio', '--use-angle=metal'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (/error|Error|FAIL|警告|失败/.test(t)) { errors.push(t); console.log('[console]', t.slice(0, 300)); }
  if (t.startsWith('TEST')) console.log('[test]', t);
});
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message.slice(0, 400)); });

async function waitLoaded(timeout = 90000) {
  await page.waitForFunction('window.__game && window.__game.started', { timeout });
  await new Promise((r) => setTimeout(r, 1200));
}

try {
  if (mode === 'shot') {
    const out = process.argv[3] || '/tmp/hg_shot.png';
    const zone = process.argv[4] || 'hall';
    const extra = process.argv[5] ? `&${process.argv[5]}` : '';
    const waitMs = parseInt(process.argv[6] || '2200');
    await page.goto(`${BASE}?shot&zone=${zone}${extra}`, { waitUntil: 'domcontentloaded' });
    await waitLoaded();
    await new Promise((r) => setTimeout(r, waitMs));
    await page.screenshot({ path: out });
    console.log('saved', out);
  } else if (mode === 'cam') {
    const out = process.argv[3];
    const cam = process.argv[4];
    const zone = process.argv[5] || 'hall';
    const extra = process.argv[6] ? `&${process.argv[6]}` : '';
    await page.goto(`${BASE}?shot&zone=${zone}&cam=${cam}${extra}`, { waitUntil: 'domcontentloaded' });
    await waitLoaded();
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({ path: out });
    console.log('saved', out);
  } else if (mode === 'eval') {
    const out = process.argv[3];
    const code = process.argv[4];
    const zone = process.argv[5] || 'hall';
    const waitMs = parseInt(process.argv[6] || '1500');
    await page.goto(`${BASE}?shot&zone=${zone}`, { waitUntil: 'domcontentloaded' });
    await waitLoaded();
    await page.evaluate(code);
    await new Promise((r) => setTimeout(r, waitMs));
    await page.screenshot({ path: out });
    console.log('saved', out);
  } else if (mode === 'test') {
    const extra = process.argv[3] ? `&${process.argv[3]}` : '';
    await page.goto(`${BASE}?test&autotest${extra}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__testDone === true', { timeout: 180000 }).catch(() => console.log('[warn] test timeout'));
    await page.screenshot({ path: '/tmp/hg_autotest.png' });
  }
  console.log(errors.length ? `ERRORS: ${errors.length}` : 'NO-ERRORS');
} finally {
  await browser.close();
}
