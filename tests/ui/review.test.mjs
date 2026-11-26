// d1.6: Bảng tháng không báo "bỏ sót" khi mẫu đã ngừng; màn kiểm không cho kiểm trước kỳ chưa bắt đầu;
// mục không bắt buộc để trống vẫn Xong; nhắc chụp ảnh khi Không đạt
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './harness.mjs';
import { freshServer, ownerClient, uuid, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

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

test('iPhone: mục không bắt buộc có nhãn, để trống vẫn Xong (không còn trong Chưa kiểm); Không đạt ở mục "Nhắc chụp ảnh" thì nhắc chụp', async () => {
  const env = freshServer({ now: SEED });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  const tid = uuid();
  let r = owner.write('template.edit', { template_id: tid, name_vi: 'Mẫu có mục tùy chọn', frequency: 'DAY', items: [
    { name_vi: 'Nhiệt độ dầu', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 60, photo_on_fail: true },
    { name_vi: 'Giờ có tải', input_type: 'NUMBER', unit: 'h', std_type: 'NONE', required: false }
  ] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const mac = env.rows('Machines').find((m) => m.machine_code === 'TB-0102');
  const aid = uuid();
  r = owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: tid });
  assert.equal(r.ok, true, JSON.stringify(r));
  const app = await openApp({ env, now: SEED, viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const { page } = app;
    await login(page);
    await go(page, '#/check/' + encodeURIComponent(aid));
    await page.waitForSelector('.ci');
    assert.equal(await page.locator('.ci-opt').count(), 1, 'một mục không bắt buộc');
    const inp = page.locator('.ci-inp').first();
    await inp.fill('70');
    assert.equal(await page.locator('.ci-photo-need').first().isVisible(), true, 'nhắc chụp ảnh');
    await inp.fill('50');
    assert.equal(await page.locator('#ck-left').isVisible(), false, 'không báo còn mục bắt buộc');
    await page.click('#ck-save');
    await page.waitForSelector('.due-item', { timeout: 15000 });
    await page.waitForFunction((code) => {
      const it = [...document.querySelectorAll('.due-item')].find((x) => x.textContent.includes(code));
      return !it || !/Kiểm dở/.test(it.textContent);
    }, 'TB-0102', { timeout: 15000 });
    // Máy chủ: lượt là Xong
    let run = null;
    for (let i = 0; i < 30 && !run; i++) { run = env.rows('Runs').find((x) => x.assignment_id === aid); if (!run) await page.waitForTimeout(300); }
    assert.ok(run, 'đã gửi lên máy chủ');
    assert.equal(run.status, 'DONE');
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
