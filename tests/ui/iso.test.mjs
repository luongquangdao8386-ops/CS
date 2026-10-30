// d1.2: Mẫu checksheet → "Tạo bộ mẫu theo biểu ISO": chọn mẫu, PIN, mẫu hiện trong danh sách kèm mã biểu mẫu; ô Mã biểu mẫu ISO
// trong màn sửa mẫu; xem trước báo cáo in mã biểu mẫu; 1440×900 và 390×844
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openApp, SHOTS } from './harness.mjs';
import { freshServer, ownerClient, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:10:00+07:00';
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };
const WEB = { viewport: { width: 1440, height: 900 }, mobile: false };
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

function seeded() {
  const env = freshServer({ now: NOW });
  ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  return env;
}
async function login(page) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', OWNER_CODE);
  await page.fill('#pin', OWNER_PIN);
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
}

test('web: Tạo bộ mẫu theo biểu ISO → bỏ chọn bớt → PIN → mẫu có mã biểu mẫu; mở lại thấy "Đã tạo"; sửa mã biểu mẫu', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...WEB });
  const { page } = app;
  try {
    await login(page);
    await go(page, '#/templates');
    await page.click('#tp-iso');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input').count(), 23);
    assert.equal(await page.locator('#iso-list input:checked').count(), 23, 'mặc định chọn hết mẫu chưa tạo');
    assert.equal(await page.locator('#iso-migrate').count(), 0);
    await page.uncheck('#iso-all');
    assert.equal(await page.locator('#iso-list input:checked').count(), 0);
    await page.check('#iso-list input[value="BM-CĐ-07-02"]');
    await page.check('#iso-list input[value="BM-CĐ-09-10"]');
    await page.screenshot({ path: path.join(SHOTS, 'd12-web-iso-dialog.png') });
    await page.click('.modal-actions .btn.primary');
    await page.waitForSelector('.modal .pin-input');
    await page.fill('.modal .pin-input', OWNER_PIN);
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => document.querySelector('.view')?.textContent.includes('BM-CĐ-07-02'), null, { timeout: 15000 });
    assert.equal(env.rows('Templates').filter((t) => /^BM-CĐ/.test(t.form_code)).length, 2);
    assert.ok((await page.textContent('.view')).includes('BM-CĐ-09-10'));
    // Mở lại: hai mẫu đã tạo bị khóa, còn 21 mẫu chọn được
    await page.click('#tp-iso');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input[disabled]').count(), 2);
    assert.ok((await page.textContent('#iso-list')).includes('Đã tạo'));
    await page.click('.modal-actions .btn:not(.primary)');
    // Màn sửa mẫu: ô mã biểu mẫu
    const tpl = env.rows('Templates').find((t) => t.form_code === 'BM-CĐ-07-02');
    await go(page, '#/templates/' + tpl.template_id);
    await page.waitForSelector('#f-form_code');
    assert.equal(await page.inputValue('#f-form_code'), 'BM-CĐ-07-02');
    await page.fill('#f-form_code', 'BM-CĐ-07-02/B');
    await page.click('#tp-save');
    await page.waitForFunction((id) => location.hash === '#/templates/' + id && document.querySelector('#f-form_code'), tpl.template_id, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('#f-form_code')?.value === 'BM-CĐ-07-02/B', null, { timeout: 15000 });
    assert.equal(env.rows('Templates').find((t) => t.template_id === tpl.template_id).form_code, 'BM-CĐ-07-02/B');
    assert.ok(await noOverflow(page));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('iPhone: hộp thoại bộ mẫu ISO không tràn ngang; mẫu thẻ hiện mã biểu mẫu', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE });
  const { page } = app;
  try {
    await login(page);
    await go(page, '#/templates');
    await page.click('#tp-iso');
    await page.waitForSelector('.modal #iso-list');
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'd12-iphone-iso-dialog.png') });
    await page.uncheck('#iso-all');
    await page.check('#iso-list input[value="BM-CĐ-13-01"]');
    await page.click('.modal-actions .btn.primary');
    await page.waitForSelector('.modal .pin-input');
    await page.fill('.modal .pin-input', OWNER_PIN);
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => document.querySelector('.view .cards')?.textContent.includes('BM-CĐ-13-01'), null, { timeout: 15000 });
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'd12-iphone-iso-list.png'), fullPage: true });
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
