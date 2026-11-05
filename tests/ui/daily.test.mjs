// d1.3: Mẫu checksheet → "Tạo bộ mẫu hằng ngày" (7 loại máy); màn máy → Tiêu chuẩn riêng: "Máy này không có" bỏ mục "nếu có";
// màn kiểm không còn mục đã bỏ, hiện chọn [Mức] và chữ tiêu chuẩn 3 pha; 1440×900 và 390×844
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openApp, SHOTS } from './harness.mjs';
import { freshServer, ownerClient, uuid, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-11-05T08:10:00+07:00';
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };
const WEB = { viewport: { width: 1440, height: 900 }, mobile: false };
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Máy chủ có dữ liệu mẫu; withDaily: tạo sẵn mẫu HN-02 (phòng điện), HN-06 (chiller) và gán cho hai máy */
function seeded(withDaily = false) {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  const out = { env };
  if (withDaily) {
    owner.pin(OWNER_PIN);
    const r = owner.write('template.isoSeed', { keys: ['HN-02', 'HN-06'] });
    assert.equal(r.ok, true, JSON.stringify(r));
    const macs = env.rows('Machines').filter((m) => m.active);
    out.chillerMac = macs[0];
    out.roomMac = macs[1];
    out.chillerAsg = uuid();
    out.roomAsg = uuid();
    for (const [aid, mac, key] of [[out.chillerAsg, out.chillerMac, 'HN-06'], [out.roomAsg, out.roomMac, 'HN-02']]) {
      const a = owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: env.g.isoUuid_(key) });
      assert.equal(a.ok, true, JSON.stringify(a));
    }
  }
  return out;
}
async function login(page) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', OWNER_CODE);
  await page.fill('#pin', OWNER_PIN);
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
}

test('web: Tạo bộ mẫu hằng ngày → chọn hết 7 mẫu → PIN → mẫu hiện trong danh sách; mở lại thấy đã tạo đủ', async () => {
  const { env } = seeded();
  const app = await openApp({ env, now: NOW, ...WEB });
  const { page } = app;
  try {
    await login(page);
    await go(page, '#/templates');
    await page.click('#tp-daily');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input').count(), 7);
    assert.equal(await page.locator('#iso-list input:checked').count(), 7);
    const txt = await page.textContent('.modal');
    for (const s of ['HN-01', 'Máy phát điện', 'Phòng điện', 'Máy nén khí', 'Máy sấy lạnh', 'Máy sấy hấp thụ', 'Chiller', 'Hệ bơm chiller', 'Mỗi ngày']) assert.ok(txt.includes(s), s);
    await page.screenshot({ path: path.join(SHOTS, 'd13-web-daily-dialog.png') });
    await page.click('.modal-actions .btn.primary');
    await page.waitForSelector('.modal .pin-input');
    await page.fill('.modal .pin-input', OWNER_PIN);
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => document.querySelector('.view')?.textContent.includes('Hệ bơm chiller'), null, { timeout: 15000 });
    const ids = new Set(['HN-01', 'HN-02', 'HN-03', 'HN-04', 'HN-05', 'HN-06', 'HN-07'].map((k) => env.g.isoUuid_(k)));
    const daily = env.rows('Templates').filter((t) => ids.has(t.template_id));
    assert.equal(daily.length, 7);
    assert.ok(daily.every((t) => t.frequency === 'DAY'));
    // Mở lại: hết mẫu để tạo
    await page.click('#tp-daily');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input[disabled]').count(), 7);
    assert.ok((await page.textContent('.modal')).includes('Đã tạo đủ các mẫu hằng ngày'));
    await page.click('.modal-actions .btn:not(.primary)');
    // Bộ ISO vẫn mở riêng, không lẫn mẫu hằng ngày
    await page.click('#tp-iso');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input').count(), 23);
    await page.click('.modal-actions .btn:not(.primary)');
    assert.ok(await noOverflow(page));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('web: Tiêu chuẩn riêng của chiller — bỏ hai mục nước giải nhiệt, dòng máy nén theo % tải; màn kiểm không còn mục đã bỏ', async () => {
  const s = seeded(true);
  const { env } = s;
  const app = await openApp({ env, now: NOW, ...WEB });
  const { page } = app;
  try {
    await login(page);
    await go(page, '#/m/' + s.chillerMac.machine_id);
    await page.waitForSelector(`[data-ov="${s.chillerAsg}"]`);
    await page.click(`[data-ov="${s.chillerAsg}"]`);
    await page.waitForSelector('.modal .ov');
    // Hạng mục số + mục "nếu có" (dàn ngưng là Đạt/Không đạt nhưng không bắt buộc → có ô "Máy này không có")
    assert.equal(await page.locator('.modal .ov').count(), 8);
    assert.equal(await page.locator('.modal [data-off]').count(), 3);
    const box = (name) => page.locator('.modal .ov', { hasText: name });
    await box('Nhiệt độ nước giải nhiệt vào').locator('[data-off]').check();
    await box('Nhiệt độ nước giải nhiệt ra').locator('[data-off]').check();
    assert.equal(await box('Nhiệt độ nước giải nhiệt vào').locator('.ov-own').isHidden(), true, 'đã bỏ thì ẩn ô tiêu chuẩn riêng');
    const cur = box('Dòng điện máy nén');
    await cur.locator('[data-own]').check();
    await cur.locator('[data-k="unit"]').fill('%');
    await cur.locator('[data-k="std_type"]').selectOption('MAX');
    await cur.locator('[data-k="std_max"]').fill('95');
    assert.ok((await cur.locator('.ie-preview').textContent()).includes('≤ 95 %'));
    await page.screenshot({ path: path.join(SHOTS, 'd13-web-overrides-off.png') });
    await page.click('.modal-actions .btn.primary');
    await page.waitForFunction(() => document.querySelector('.view')?.textContent.includes('2 mục máy không có'), null, { timeout: 15000 });
    assert.ok((await page.textContent('.view')).includes('1 tiêu chuẩn riêng'));
    const ov = env.rows('Assignments').find((a) => a.assignment_id === s.chillerAsg).overrides_json;
    assert.equal(Object.values(ov).filter((o) => o.off === true).length, 2);
    // Màn kiểm: 10 hạng mục, không có nước giải nhiệt, có chọn mức Đủ / Thấp / Dưới min, dòng máy nén ≤ 95 %
    await go(page, '#/check/' + s.chillerAsg);
    await page.waitForSelector('.ci');
    assert.equal(await page.locator('.ci').count(), 10);
    const t = await page.textContent('.check-page');
    assert.ok(!t.includes('nước giải nhiệt'));
    for (const x of ['Dưới min', 'Thấp', 'Đủ', '≤ 95 %', 'Theo cài đặt', 'Dàn ngưng sạch']) assert.ok(t.includes(x), x);
    assert.ok(await noOverflow(page));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('iPhone: hộp bộ mẫu hằng ngày không tràn ngang; màn kiểm phòng điện hiện điện áp 380 V ± 5 % và dòng "Theo định mức tủ, lệch ≤ 10 %"', async () => {
  const s = seeded(true);
  const app = await openApp({ env: s.env, now: NOW, ...IPHONE });
  const { page } = app;
  try {
    await login(page);
    await go(page, '#/templates');
    await page.click('#tp-daily');
    await page.waitForSelector('.modal #iso-list');
    assert.equal(await page.locator('#iso-list input[disabled]').count(), 2, 'HN-02, HN-06 đã tạo');
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'd13-iphone-daily-dialog.png') });
    await page.click('.modal-actions .btn:not(.primary)');
    await go(page, '#/check/' + s.roomAsg);
    await page.waitForSelector('.ci-3p');
    const t = await page.textContent('.check-page');
    assert.ok(t.includes('380 V ± 5 % (361 – 399 V) mỗi pha, lệch ≤ 10 %'));
    assert.ok(t.includes('Theo định mức tủ, lệch ≤ 10 %'));
    assert.ok(t.includes('≤ 35 °C'));
    assert.ok(!t.includes('chỉ ghi số'), 'mục Đạt/Không đạt: tên mục là tiêu chuẩn, không hiện "Không có tiêu chuẩn"');
    // Gõ điện áp 405/406/404 → Không đạt (vượt 399 V) ngay trên máy
    await page.fill('#v-1-0', '405');
    await page.fill('#v-1-1', '406');
    await page.fill('#v-1-2', '404');
    await page.waitForFunction(() => /Không đạt/.test(document.querySelector('#pill-1')?.textContent || ''));
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'd13-iphone-check-room.png'), fullPage: true });
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
