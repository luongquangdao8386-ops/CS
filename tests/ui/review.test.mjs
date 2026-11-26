// d1.6: Bảng tháng không báo "bỏ sót" khi mẫu đã ngừng; màn kiểm không cho kiểm trước kỳ chưa bắt đầu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './harness.mjs';
import { freshServer, ownerClient, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const SEED = '2026-10-28T08:10:00+07:00';
const LATER = '2026-10-30T08:10:00+07:00';
const WEB = { viewport: { width: 1440, height: 900 }, mobile: false };

async function login(page) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', OWNER_CODE);
  await page.fill('#pin', OWNER_PIN);
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
}
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);

test('web: Bảng tháng báo bỏ sót khi mẫu đang dùng, hết báo khi ngừng mẫu; kỳ chưa bắt đầu (ca 3 lúc đang ca 1) chỉ xem', async () => {
  const env = freshServer({ now: SEED });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  env.clock.advance(Date.parse(LATER) - Date.parse(SEED));
  const mac = env.rows('Machines').find((m) => m.machine_code === 'TB-0007');
  const tpl = env.rows('Templates').find((t) => t.frequency === 'SHIFT');
  const asg = env.rows('Assignments').find((a) => a.machine_id === mac.machine_id);
  const app = await openApp({ env, now: LATER, ...WEB });
  try {
    const { page } = app;
    await login(page);
    await go(page, '#/month?m=' + encodeURIComponent(mac.machine_id));
    await page.waitForSelector('.mgrid');
    // 28/10 ca 1–3, 29/10 ca 1–3 đã hết mà chưa kiểm (bảng ca 1 đang mở: 28, 29)
    assert.ok(await page.locator('.mgrid td.st-missed').count() > 0, 'có ô bỏ sót khi mẫu đang dùng');

    // Kỳ chưa bắt đầu: ca 3 hôm nay lúc 08:10 → chỉ xem, không có nút Lưu
    await go(page, `#/check/${encodeURIComponent(asg.assignment_id)}?d=2026-10-30&s=3`);
    await page.waitForSelector('.check-page');
    assert.match(await page.textContent('.check-page'), /Kỳ này chưa bắt đầu/);
    assert.equal(await page.locator('#ck-save').count(), 0);

    // Ngừng mẫu (máy chủ), app lấy thay đổi khi quay lại: Bảng tháng không còn ô bỏ sót
    owner.pin(OWNER_PIN);
    const r = owner.write('template.archive', { template_id: tpl.template_id, active: false }, { expected_version: tpl.record_version });
    assert.equal(r.ok, true, JSON.stringify(r));
    await app.context.clock.setFixedTime(new Date(Date.parse(LATER) + 5 * 60000));
    await go(page, '#/month?m=' + encodeURIComponent(mac.machine_id));
    await page.waitForSelector('.mgrid');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelectorAll('.mgrid td.st-missed').length === 0, null, { timeout: 15000 });
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
