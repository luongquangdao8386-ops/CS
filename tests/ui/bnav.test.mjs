// Thanh 5 nút dưới (iPhone) cùng cỡ với M&E d4.14/d4.15: chữ Việt ≥ 13 px / Trung ≥ 12 px, biểu tượng ≥ 26 px, vạch navy trên nút
// đang mở, ô vàng Quét QR to và nhô lên khỏi thanh; 390 px và 320 px (iPhone SE): nhãn một dòng không tràn, chữ thẳng hàng;
// cuối trang chủ và thanh Lưu của màn kiểm không bị thanh nút che
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openApp, SHOTS } from './harness.mjs';
import { freshServer, ownerClient, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:10:00+07:00';

const measure = (page) => page.evaluate(() => [...document.querySelectorAll('.bnav .bnav-item')].map((it) => {
  const vi = it.querySelector('.bnav-label .vi'), zh = it.querySelector('.bnav-label .zh');
  const lineH = (el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.15;
  const r = it.getBoundingClientRect();
  return {
    vi: vi.textContent, viPx: parseFloat(getComputedStyle(vi).fontSize), zhPx: parseFloat(getComputedStyle(zh).fontSize),
    icon: it.querySelector('svg').getBoundingClientRect().width,
    oneLine: vi.getBoundingClientRect().height <= lineH(vi) + 1 && zh.getBoundingClientRect().height <= lineH(zh) + 1,
    inside: vi.getBoundingClientRect().left >= r.left - 1 && vi.getBoundingClientRect().right <= r.right + 1 && zh.getBoundingClientRect().right <= r.right + 1,
    active: it.classList.contains('active'), bar: getComputedStyle(it, '::before').height,
    labelTop: it.querySelector('.bnav-label').getBoundingClientRect().top
  };
}));

for (const [name, width, minVi, boxW, boxH] of [['iPhone 390', 390, 13, 68, 52], ['iPhone SE 320', 320, 12, 60, 48]]) {
  test(`thanh nút dưới ${name}: chữ ≥ ${minVi} px, biểu tượng ≥ 26 px, nhãn một dòng, ô Quét nhô lên; trang chủ và thanh Lưu không bị che`, async () => {
    const env = freshServer({ now: NOW });
    ownerClient(env);
    env.g.dbReset_();
    env.g.seedSample_('SYSTEM');
    const app = await openApp({ env, now: NOW, viewport: { width, height: 760 }, mobile: true });
    const { page } = app;
    try {
      await page.waitForSelector('#emp', { timeout: 15000 });
      await page.fill('#emp', OWNER_CODE);
      await page.fill('#pin', OWNER_PIN);
      await page.click('#login-btn');
      await page.waitForSelector('.grid9', { timeout: 20000 });
      const m = await measure(page);
      assert.equal(m.length, 5);
      for (const x of m) {
        assert.ok(x.viPx >= minVi, `${x.vi}: ${x.viPx} px`);
        assert.ok(x.zhPx >= minVi - 1, `${x.vi} (zh): ${x.zhPx} px`);
        assert.ok(x.icon >= 26, `${x.vi}: biểu tượng ${x.icon} px`);
        assert.ok(x.oneLine, `${x.vi}: nhãn xuống dòng`);
        assert.ok(x.inside, `${x.vi}: nhãn tràn khỏi nút`);
      }
      const tops = m.map((x) => x.labelTop);
      assert.ok(Math.max(...tops) - Math.min(...tops) <= 3, `chữ các nút lệch hàng: ${tops.join(', ')}`);
      const sb = await page.evaluate(() => {
        const b = document.querySelector('.bnav-scan-box').getBoundingClientRect(), nav = document.querySelector('.bnav').getBoundingClientRect();
        return { w: b.width, h: b.height, top: b.top, navTop: nav.top };
      });
      assert.ok(sb.w >= boxW && sb.h >= boxH, `ô vàng Quét QR ${sb.w} × ${sb.h}`);
      assert.ok(sb.top <= sb.navTop - 10 && sb.top >= 0, `ô vàng nhô lên khỏi thanh: ô ${sb.top}, thanh ${sb.navTop}`);
      const home = m.find((x) => x.active);
      assert.ok(home && home.vi === 'Trang chủ' && home.bar === '3px', 'nút đang mở có vạch navy 3 px');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      const gap = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('.grid9 > *')];
        return document.querySelector('.bnav').getBoundingClientRect().top - cells[cells.length - 1].getBoundingClientRect().bottom;
      });
      assert.ok(gap >= 0, `ô cuối bị thanh nút che ${-gap} px`);
      await page.screenshot({ path: path.join(SHOTS, `bnav-${width}.png`) });
      // Màn kiểm: thanh Lưu nằm trên thanh nút, không chồng lên
      await page.evaluate(() => { location.hash = '#/today'; });
      await page.waitForSelector('.due-item');
      await page.locator('.due-item').first().click();
      await page.waitForSelector('#ck-save');
      const over = await page.evaluate(() => document.querySelector('.bnav').getBoundingClientRect().top - document.querySelector('#ck-foot').getBoundingClientRect().bottom);
      assert.ok(over >= -1, `thanh Lưu bị thanh nút che ${-over} px`);
      await page.screenshot({ path: path.join(SHOTS, `bnav-check-${width}.png`) });
      assert.deepEqual(app.consoleErrors, []);
    } finally { await app.close(); }
  });
}
