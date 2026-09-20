// Renders the real game's board screen in headless Chromium and saves a
// screenshot, so visual changes can be checked without a phone.
//
// One-time setup, in a SCRATCH folder (not the repo):
//   mkdir /tmp/render && cd /tmp/render && npm init -y
//   npm i puppeteer-core @sparticuz/chromium
//   cp <repo>/tools/render_board.mjs .
// Every time:
//   cd <repo> && npm run build
//   (cd dist && setsid nohup python3 -m http.server 4173 >/dev/null 2>&1 </dev/null &)
//   cd /tmp/render && node render_board.mjs out.png <levelId> <worldId> <levelNum> [width height]
// e.g. node render_board.mjs out.png 12 1 12          (Candy Garden, level 12, 393x852)
//      node render_board.mjs out.png 12 1 12 360 640   (short phone)
// worldId is the NUMBER from worlds.js (1 = Candy Garden ... 10).
// Stop the server with:  fuser -k 4173/tcp
// (Never `pkill -f chromium` - it matches the shell running the command
// and kills it.) Screenshots take a few seconds, so anything timed
// (e.g. the Bomb "tap again" window, 2.5s) may expire before the shot.
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const [, , out, levelId, worldId, levelNum, vw = '393', vh = '852'] = process.argv;
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote', '--disable-dev-shm-usage',
    '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--in-process-gpu'],
  executablePath: await chromium.executablePath(),
  headless: true,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.setViewport({ width: +vw, height: +vh, deviceScaleFactor: 2 });
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 4500));
await page.evaluate((levelId, worldId, levelNum) => {
  const g = window.game; // main.js exposes the Phaser game as window.game
  g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
  g.scene.start('BoardScene', { levelId: +levelId, worldId: isNaN(+worldId) ? worldId : +worldId, levelNum: +levelNum });
}, levelId, worldId, levelNum);
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
