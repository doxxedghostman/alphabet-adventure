// First run: npx playwright install chromium
// Optional WORDSWOOP_CHROMIUM_PATH selects a preinstalled Chromium binary.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let server, browser;
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 5178 } });
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.WORDSWOOP_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
});
after(async () => { await browser?.close(); await server?.close(); });

async function openGame(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Browser regressions are isolated from real accounts, ads and cloud data.
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.game?.scene.isActive('MainMenuScene'));
  return { page, errors };
}
async function startBoard(page) {
  await page.evaluate(() => window.game.scene.start('BoardScene', { levelId: 199, worldId: 10, levelNum: 19 }));
  await page.waitForFunction(() => {
    const scene = window.game.scene.getScene('BoardScene');
    return scene.sys.isActive() && scene.grid.length === 5 && !scene.isBusy;
  });
}
async function clickButton(page, label) {
  const point = await page.evaluate((label) => {
    const scene = window.game.scene.getScene('BoardScene');
    const card = scene.children.list.find((object) => object.type === 'Container'
      && object.list?.some((child) => child.type === 'Container' && child.list?.some((part) => part.text === label)));
    const button = card?.list.find((child) => child.list?.some((part) => part.text === label));
    if (!button) throw new Error(`Missing popup button: ${label}`);
    const matrix = button.getWorldTransformMatrix();
    const rect = window.game.canvas.getBoundingClientRect();
    return { x: rect.x + matrix.tx * rect.width / scene.scale.width, y: rect.y + matrix.ty * rect.height / scene.scale.height };
  }, label);
  await page.mouse.click(point.x, point.y);
}

for (const viewport of [{ width: 393, height: 852 }, { width: 360, height: 640 }]) {
  test(`board, shuffle, Bomb, resume and modal input at ${viewport.width}x${viewport.height}`, async () => {
    const { page, errors } = await openGame(viewport);
    try {
      await startBoard(page);
      assert.equal(await page.evaluate(() => window.game.scene.getScene('BoardScene').findWordMatches().matchedCells.size), 0);
      await page.evaluate(() => window.game.scene.getScene('BoardScene').onShufflePressed());
      await page.waitForFunction(() => !window.game.scene.getScene('BoardScene').isBusy);
      assert.equal(await page.evaluate(() => window.game.scene.getScene('BoardScene').grid.flat().every((tile) => tile.text.text === tile.letter)), true);
      await page.evaluate(async () => {
        const scene = window.game.scene.getScene('BoardScene');
        await scene.onBombPressed();
      });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wordswoop_session')));
      assert.ok(saved);
      assert.deepEqual(await page.evaluate(() => window.game.scene.getScene('BoardScene').grid.map((row) => row.map((tile) => tile.letter))), saved.grid);
      await page.evaluate(() => window.game.scene.start('HomeHubScene'));
      await page.waitForFunction(() => window.game.scene.isActive('HomeHubScene'));
      await startBoard(page);
      assert.deepEqual(await page.evaluate(() => window.game.scene.getScene('BoardScene').grid.map((row) => row.map((tile) => tile.letter))), saved.grid);
      const boosters = await page.evaluate(async () => (await import('/src/utils/boosterStore.js')).getBoosters());
      assert.equal(boosters.bomb, 1); assert.equal(boosters.shuffle, 2);
      await page.evaluate(async () => {
        const { spendBooster } = await import('/src/utils/boosterStore.js');
        while (spendBooster('lens')) {}
        window.game.scene.getScene('BoardScene').onLensPressed();
      });
      await page.waitForTimeout(300);
      const tilePoint = await page.evaluate(() => {
        const scene = window.game.scene.getScene('BoardScene'); const point = scene.cellToPixel(0, 0);
        const rect = window.game.canvas.getBoundingClientRect();
        return { x: rect.x + point.x * rect.width / scene.scale.width, y: rect.y + point.y * rect.height / scene.scale.height };
      });
      await page.mouse.click(tilePoint.x, tilePoint.y);
      assert.equal(await page.evaluate(() => !!window.game.scene.getScene('BoardScene').selectedTile), false);
      await clickButton(page, 'Cancel');
      await page.waitForFunction(() => !window.game.scene.getScene('BoardScene').boosterPromptOpen);
      await page.evaluate(async () => {
        (await import('/src/utils/currencyStore.js')).addGems(100);
        window.game.scene.getScene('BoardScene').onLensPressed();
      });
      await page.waitForTimeout(300);
      await clickButton(page, 'Buy for 75 Gems');
      await clickButton(page, 'Buy for 75 Gems');
      await page.waitForFunction(() => !window.game.scene.getScene('BoardScene').boosterPromptOpen);
      assert.equal(await page.evaluate(async () => (await import('/src/utils/currencyStore.js')).getGems()), 25);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('real board recognises only forward GOAT and Lens rewards use Lens art', async () => {
  const { page, errors } = await openGame({ width: 393, height: 852 });
  try {
    await startBoard(page);
    for (const vertical of [false, true]) {
      for (const word of ['GOAT', 'TAOG']) {
        const result = await page.evaluate(({ vertical, word }) => {
          const scene = window.game.scene.getScene('BoardScene');
          scene.targetWord = 'GOAT';
          scene.grid.flat().forEach((tile) => { tile.letter = 'Q'; });
          [...word].forEach((letter, index) => { scene.grid[vertical ? index : 0][vertical ? 0 : index].letter = letter; });
          return { found: scene.findWordMatches().wordsFound.includes('GOAT'), target: scene.boardContainsTargetWord() };
        }, { vertical, word });
        assert.deepEqual(result, { found: word === 'GOAT', target: word === 'GOAT' });
      }
    }
    await page.evaluate(() => window.game.scene.start('ShopScene'));
    await page.waitForFunction(() => window.game.scene.isActive('ShopScene'));
    const reward = await page.evaluate(async () => {
      const scene = window.game.scene.getScene('ShopScene');
      const { showRewardPopup } = await import('/src/utils/rewardPopup.js');
      showRewardPopup(scene, { type: 'lens', amount: 1 });
      const card = scene.children.list.find((object) => object.depth === 3001 && object.type === 'Container');
      return { label: card.list.find((part) => part.text === 'Lens!')?.text,
        texture: card.list.find((part) => part.type === 'Container').list[0].texture.key };
    });
    assert.deepEqual(reward, { label: 'Lens!', texture: 'rewardPopupLens' });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('restored sign-in syncs through the real Supabase client and serialises arrays', async () => {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const userId = '11111111-1111-4111-8111-111111111111';
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: userId, exp: expires, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.');
  const user = { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {} };
  let profile = { gems: 100, completed_level_ids: [1, 2], settings: { musicOn: true, sfxOn: true, hapticsOn: true },
    created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-08T00:00:00Z' };
  const writes = [];
  await page.addInitScript(({ token, expires, user }) => {
    localStorage.setItem('sb-kaeiaiesavwsebyhkgig-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test-refresh',
      expires_at: expires, expires_in: 3600, token_type: 'bearer', user }));
    localStorage.setItem('wordswoop_progress', JSON.stringify({ completedLevelIds: [3] }));
  }, { token, expires, user });
  await page.route('**/*.supabase.co/**', async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname === '/rest/v1/wordswoop_profiles') {
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON(); writes.push(body);
        profile = { ...profile, ...body, updated_at: new Date(Date.parse(profile.updated_at) + 1000).toISOString() };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: userId }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(profile) });
    }
    return route.abort();
  });
  try {
    await page.goto(server.resolvedUrls.local[0]);
    await page.evaluate(async () => {
      window.testAuth = await import('/src/utils/authStore.js');
      window.testMoney = await import('/src/utils/currencyStore.js');
    });
    await page.waitForFunction(() => window.testAuth.getSyncStatus() === 'synced' && window.testMoney.getGems() === 100);
    assert.ok(writes.length > 0);
    assert.ok(Array.isArray(writes[0].completed_level_ids));
    assert.deepEqual(new Set(writes[0].completed_level_ids), new Set([1, 2, 3]));
    const count = writes.length;
    const patched = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('wordswoop_profiles'));
    await page.evaluate(async () => (await import('/src/utils/currencyStore.js')).addGems(10));
    await patched;
    await page.waitForFunction(() => window.testAuth.getSyncStatus() === 'synced');
    assert.equal(writes.length, count + 1);
    assert.equal(profile.gems, 110);
  } finally { await page.close(); }
});
