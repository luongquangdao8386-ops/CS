// d1.5: Mẫu checksheet → "Xóa hẳn mẫu…": owner xóa mẫu đã có lượt kiểm (báo số lượt kiểm/bất thường, gõ XÓA, PIN);
// điện thoại người kiểm đang mở tự bỏ mẫu đã xóa khi đồng bộ (không đăng nhập lại); Trưởng bộ phận chỉ xóa được mẫu chưa có lượt kiểm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openApp, SHOTS } from './harness.mjs';
import { freshServer, ownerClient, userClient, addUser, uuid, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-11-14T08:10:00+07:00';
const LATER = '2026-11-14T08:13:00+07:00';
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };
const WEB = { viewport: { width: 1440, height: 900 }, mobile: false };
const KT_PIN = '583920', C3_PIN = '583923';
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const viewText = (page) => page.evaluate(() => document.querySelector('.view')?.textContent || '');

/** Dữ liệu mẫu (MS-0001 máy nén khí hằng ca, MS-0002 chiller hằng ngày, MS-0003 tủ điện hằng tuần); MS-0001 có 1 lượt kiểm Không đạt */
function seeded() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  const tpl = Object.fromEntries(env.rows('Templates').map((t) => [t.template_code, t]));
  const mac = Object.fromEntries(env.rows('Machines').map((m) => [m.machine_code, m]));
  const asg = env.rows('Assignments').find((a) => a.template_id === tpl['MS-0001'].template_id && a.machine_id === mac['TB-0007'].machine_id);
  const oil = env.rows('TemplateItems').find((x) => x.template_id === tpl['MS-0001'].template_id && x.name_vi === 'Nhiệt độ dầu');
  const kt = userClient(env, 'KT1', 2, KT_PIN);
  const r = kt.write('check.submit', { run_id: uuid(), assignment_id: asg.assignment_id, template_revision: 1, work_date: '2026-11-14', shift: '1', results: [{ item_key: oil.item_key, value: 75, note: 'Dầu nóng' }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { env, owner, tpl };
}

async function login(page, code, pin) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', code);
  await page.fill('#pin', pin);
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
}

test('web owner xóa hẳn MS-0001 (có lượt kiểm) + MS-0002: báo số đếm, gõ XÓA, PIN; điện thoại người kiểm tự bỏ hai mẫu, không phải đăng nhập lại', async () => {
  const { env, tpl } = seeded();
  const phone = await openApp({ env, now: NOW, ...IPHONE });
  const web = await openApp({ env, now: NOW, ...WEB });
  try {
    // Điện thoại người kiểm: Kiểm tra hôm nay có máy nén khí (MS-0001) và chiller (MS-0002)
    await login(phone.page, 'KT1', KT_PIN);
    await go(phone.page, '#/today');
    await phone.page.waitForFunction(() => /TB-0008/.test(document.querySelector('.view')?.textContent || ''), null, { timeout: 15000 });
    assert.ok((await viewText(phone.page)).includes('TB-0031'));

    const { page } = web;
    await login(page, OWNER_CODE, OWNER_PIN);
    await go(page, '#/templates');
    await page.waitForSelector('#tp-purge');
    await page.click('#tp-purge');
    await page.waitForSelector('.modal #pg-list');
    assert.equal(await page.locator('#pg-list input').count(), 3);
    await page.fill('#pg-q', 'chiller');
    assert.equal(await page.locator('#pg-list label:not([hidden])').count(), 1, 'tìm theo tên');
    await page.locator('#pg-list label:not([hidden]) input').check();
    await page.fill('#pg-q', '');
    await page.locator('#pg-list label', { hasText: 'MS-0001' }).locator('input').check();
    await page.click('.modal-actions .btn.danger');
    await page.waitForSelector('.modal #pg-confirm');
    const txt = await page.textContent('.modal');
    for (const s of ['Sẽ xóa luôn 1 lượt kiểm, 1 bất thường, 0 lý do bỏ sót và 0 ảnh', 'MS-0001', 'MS-0002', 'Lượt kiểm 1', 'Gán máy 2', '1 bất thường chưa xử lý', 'Chưa có bản sao lưu nào', 'Gõ chữ XÓA']) assert.ok(txt.includes(s), s);
    const go1 = page.locator('.modal-actions .btn.danger');
    assert.equal(await go1.isDisabled(), true, 'chưa gõ XÓA thì chưa bấm được');
    assert.ok(await page.locator('.modal-actions .btn', { hasText: 'Mở Sao lưu' }).isVisible());
    await page.fill('#pg-confirm', 'xoa');
    assert.equal(await go1.isEnabled(), true);
    await page.screenshot({ path: path.join(SHOTS, 'd15-web-purge-confirm.png') });
    await go1.click();
    await page.waitForSelector('.modal .pin-input');
    await page.fill('.modal .pin-input', OWNER_PIN);
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => /Đã xóa hẳn 2 mẫu/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 15000 });
    await page.waitForFunction(() => !/MS-0001/.test(document.querySelector('.view')?.textContent || ''), null, { timeout: 15000 });
    const left = await viewText(page);
    assert.ok(left.includes('MS-0003') && !left.includes('MS-0002'));
    assert.deepEqual(env.rows('Templates').map((t) => t.template_code), ['MS-0003']);
    for (const s of ['Runs', 'Abnormals', 'Assignments']) assert.ok(env.rows(s).every((r) => r.template_id === tpl['MS-0003'].template_id), s);

    // Điện thoại quay lại app sau vài phút: tự lấy thay đổi, tải lại dữ liệu, màn Hôm nay vẽ lại không còn hai mẫu đã xóa
    await phone.context.clock.setFixedTime(new Date(LATER));
    await phone.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await phone.page.waitForFunction(() => !/TB-0008|TB-0031/.test(document.querySelector('.view')?.textContent || ''), null, { timeout: 15000 });
    assert.equal(await phone.page.locator('#emp').count(), 0, 'không bị đưa về màn đăng nhập');
    assert.ok(phone.calls.includes('sync.bootstrap'));
    assert.ok(await noOverflow(page));
    assert.deepEqual(web.consoleErrors, []);
    assert.deepEqual(phone.consoleErrors, []);
  } finally { await web.close(); await phone.close(); }
});

test('iPhone Trưởng bộ phận: mẫu có lượt kiểm không xóa được (chỉ chủ hệ thống); mẫu chưa có lượt kiểm xóa được bằng PIN', async () => {
  const { env, tpl } = seeded();
  addUser(env, 'TBP1', 3, C3_PIN);
  const app = await openApp({ env, now: NOW, ...IPHONE });
  const { page } = app;
  try {
    await login(page, 'TBP1', C3_PIN);
    await go(page, '#/templates/' + tpl['MS-0001'].template_id);
    await page.waitForSelector('#tp-purge');
    await page.click('#tp-purge');
    await page.waitForSelector('.modal .banner.err');
    const t = await page.textContent('.modal');
    assert.ok(t.includes('chỉ chủ hệ thống xóa hẳn được') && t.includes('Chỉ chủ hệ thống'));
    assert.equal(await page.locator('.modal-actions .btn.danger').count(), 0, 'không có nút xóa');
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'd15-iphone-purge-owner-only.png') });
    await page.click('.modal-actions .btn');
    // MS-0003 chưa có lượt kiểm: xóa được, không phải gõ XÓA
    await go(page, '#/templates/' + tpl['MS-0003'].template_id);
    await page.waitForFunction(() => /MS-0003/.test(document.querySelector('.view')?.textContent || ''));
    await page.click('#tp-purge');
    await page.waitForSelector('.modal .banner.warn');
    assert.ok((await page.textContent('.modal')).includes('Mẫu chưa có lượt kiểm nào'));
    assert.equal(await page.locator('.modal #pg-confirm').count(), 0);
    await page.screenshot({ path: path.join(SHOTS, 'd15-iphone-purge-plain.png') });
    await page.click('.modal-actions .btn.danger');
    await page.waitForSelector('.modal .pin-input');
    await page.fill('.modal .pin-input', C3_PIN);
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => location.hash === '#/templates' && /MS-0001/.test(document.querySelector('.view')?.textContent || ''), null, { timeout: 15000 });
    assert.ok(!(await viewText(page)).includes('MS-0003'));
    assert.deepEqual(env.rows('Templates').map((x) => x.template_code).sort(), ['MS-0001', 'MS-0002']);
    assert.ok(await noOverflow(page));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
