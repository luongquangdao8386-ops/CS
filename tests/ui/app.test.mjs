// Giao diện Checksheet với máy chủ giả lập (390×844 iPhone và 1440×900 web): Hôm nay, màn kiểm tô màu, lưu khi mất mạng,
// Bảng tháng, Chờ xử lý (xử lý Không đạt, xác nhận ngày có PIN), khu vực phụ trách, mẫu checksheet, báo cáo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openApp, SHOTS } from './harness.mjs';
import { freshServer, ownerClient, addUser, OWNER_CODE, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:10:00+07:00';
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };
const WEB = { viewport: { width: 1440, height: 900 }, mobile: false };

function seeded() {
  const env = freshServer({ now: NOW });
  ownerClient(env); // đổi PIN tạm → OWNER_PIN
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  return env;
}
/** Đăng nhập → trang chủ (lưới ô như M&E); mặc định đi tiếp sang Kiểm tra hôm nay */
async function login(page, code = OWNER_CODE, pin = OWNER_PIN, { stay = false } = {}) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', code);
  await page.fill('#pin', pin);
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
  if (stay) return;
  await page.evaluate(() => { location.hash = '#/today'; });
  await page.waitForSelector('.due-item, .empty-state', { timeout: 20000 });
}
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Không còn khóa nhãn thô (vd "chk.std") lọt ra màn hình */
async function noRawKeys(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  const raw = txt.match(/\b(?:nav|home|chk|check|month|pend|mac|tpl|ie|rp|state|res|grp|shift|period|adm|admin|melink|shf|sample|account|sync|btn|draft|logo)\.[a-z_]+[A-Z_0-9]*\b/g);
  return raw ? [...new Set(raw)] : [];
}
/** Điền phiếu của máy đầu danh sách: giá trị theo thứ tự ô số, chọn ô đầu của mỗi nhóm nút */
async function fillCheck(page, values) {
  await page.waitForSelector('.ci');
  const inputs = page.locator('.ci-inp');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) await inputs.nth(i).fill(values[i % values.length]);
  const groups = page.locator('.ci-opts');
  for (let i = 0; i < await groups.count(); i++) await groups.nth(i).locator('.opt').first().click();
}

test('iPhone: trang chủ như M&E (lưới ô, lịch tuần), 5 nút nav; Kiểm tra hôm nay theo ca; màn kiểm tô màu khi gõ, Không đạt bắt buộc ghi chú, lưu lên máy chủ', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE });
  try {
    const { page } = app;
    await login(page, OWNER_CODE, OWNER_PIN, { stay: true });
    assert.equal(await page.locator('.bnav > *').count(), 5);
    assert.equal(await page.locator('.home-hero img.brand-logo[src*="cs-tile.svg"]').count(), 1);
    assert.equal(await page.locator('.grid9 > .tile').count(), 9, 'Quản trị: đủ 9 ô');
    assert.equal(await page.locator('.grid9 [href="#/history"]').count(), 1);
    assert.ok(!(await page.textContent('.grid9')).includes('Quét'), 'không có ô Quét (đã có ở nav)');
    assert.ok((await page.textContent('.grid9')).includes('5 phiếu chưa kiểm'));
    assert.equal(await page.locator('.home-week .day').count(), 7);
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'home-iphone.png'), fullPage: true });
    await page.click('.grid9 a.tile[href="#/today"]');
    await page.waitForSelector('.due-item');
    assert.ok((await page.textContent('.shift-card')).includes('Ca 1'));
    assert.equal(await page.locator('.due-item').count(), 5, '5 phiếu kỳ này (2 máy nén theo ca, 2 máy theo ngày, 1 tủ điện theo tuần)');
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'today-iphone.png') });
    // Mở phiếu máy nén khí 01
    await page.locator('.due-item', { hasText: 'TB-0007' }).click();
    await page.waitForSelector('.ci');
    assert.equal(await page.locator('img[src*="cs-tile.svg"]').count(), 0, 'màn nghiệp vụ không có biểu tượng app');
    const oil = page.locator('.ci', { hasText: 'Nhiệt độ dầu' });
    const inp = oil.locator('.ci-inp');
    await inp.fill('52');
    assert.match(await oil.getAttribute('class'), /st-ok/);
    await inp.fill('57');
    assert.match(await oil.getAttribute('class'), /st-warn/, '≥ 55 → Cần chú ý');
    await inp.fill('65');
    assert.match(await oil.getAttribute('class'), /st-fail/);
    assert.ok((await oil.locator('.ci-msg').textContent()).includes('Cao hơn tiêu chuẩn 5'));
    assert.equal(await oil.locator('.ci-note').isVisible(), true, 'Không đạt → hiện ô ghi chú bắt buộc');
    await inp.fill('5,x');
    assert.match(await oil.getAttribute('class'), /st-bad/);
    // Gõ tiếp vẫn giữ con trỏ trong ô (không vẽ lại ô đang gõ)
    await inp.fill('52');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('ci-inp')), true);
    // 3 pha: lệch pha app tự tính
    const ph = page.locator('.ci', { hasText: 'Dòng điện 3 pha' });
    const p3 = ph.locator('.ci-inp');
    await p3.nth(0).fill('40'); await p3.nth(1).fill('41'); await p3.nth(2).fill('49');
    assert.match(await ph.locator('[data-imb]').textContent(), /^13,1 %$/, 'TB 43,33 A, lệch lớn nhất 5,67 A');
    assert.match(await ph.getAttribute('class'), /st-fail/, 'lệch > 10 % → Không đạt');
    await fillCheck(page, ['52', '97', '5,4', '0,32', '41', '42', '46', '385', '2,1']);
    await page.click('#ck-save');
    assert.ok((await page.textContent('#toast')).includes('phải ghi chú'));
    const notes = page.locator('.ci.st-fail .ci-note textarea');
    for (let i = 0; i < await notes.count(); i++) await notes.nth(i).fill('Kiểm tra lại ' + i);
    await page.screenshot({ path: path.join(SHOTS, 'check-iphone.png') });
    await page.click('#ck-save');
    await page.waitForSelector('.due-item');
    // Lưu xong phiếu rời ngăn "Chưa kiểm" (sau khi gửi lên máy chủ: sang ngăn Không đạt)
    await page.waitForFunction(() => document.querySelectorAll('.due-item').length === 4 && !document.querySelector('.due-item.st-local'), null, { timeout: 15000 });
    await page.click('[data-f="fail"]');
    await page.waitForSelector('.due-item.st-fail');
    env.g.dbReset_();
    const runs = env.rows('Runs');
    assert.equal(runs.length, 1);
    assert.equal(runs[0].shift, '1');
    assert.ok(runs[0].fail_count >= 2, 'máy chủ tự đánh giá lại: áp suất 5,4 bar, mức dầu Thấp');
    assert.ok(env.rows('Abnormals').some((a) => a.item_name_vi === 'Áp suất khí nén' && a.status === 'OPEN'));
    assert.deepEqual(await noRawKeys(page), []);
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('iPhone: mất mạng vẫn lưu phiếu (Đã lưu trên máy), có mạng lại tự gửi lên máy chủ', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE });
  try {
    const { page } = app;
    await login(page);
    // Trong test không có Service Worker: mở màn kiểm một lần khi có mạng để trình duyệt nạp sẵn mã của màn
    await page.locator('.due-item', { hasText: 'TB-0031' }).click();
    await page.waitForSelector('.ci');
    await page.goBack();
    await page.waitForSelector('.due-item');
    await app.offline(true);
    await page.locator('.due-item', { hasText: 'TB-0031' }).click();
    await fillCheck(page, ['28', '29', '12', '3', '41', '42', '43']);
    await page.click('#ck-save');
    await page.waitForSelector('.due-item.st-local', { timeout: 10000 });
    assert.ok((await page.textContent('.due-item.st-local')).includes('chờ gửi'));
    env.g.dbReset_();
    assert.equal(env.rows('Runs').length, 0);
    await app.offline(false);
    await page.waitForFunction(() => !document.querySelector('.due-item.st-local'), null, { timeout: 15000 });
    env.g.dbReset_();
    assert.equal(env.rows('Runs').length, 1);
    // Bảng tháng (mã màn đã nạp sẵn: mở thử một lần khi có mạng ở trên): ngày hôm nay có lượt kiểm
    await go(page, '#/month?m=' + env.rows('Runs')[0].machine_id);
    await page.waitForSelector('.cal-cell.today');
    assert.match(await page.getAttribute('.cal-cell.today', 'class'), /st-(done|warn|fail)/);
    assert.ok(await noOverflow(page));
    await page.screenshot({ path: path.join(SHOTS, 'month-iphone.png') });
  } finally { await app.close(); }
});

test('web: menu trái, Chờ xử lý — xử lý Không đạt, xác nhận ngày (nhập lại PIN) khóa sửa lượt kiểm', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...WEB });
  try {
    const { page } = app;
    await login(page);
    assert.equal(await page.locator('.side-nav .side-item').count(), 8);
    await page.locator('.due-item', { hasText: 'TB-0007' }).click();
    await fillCheck(page, ['52', '97', '5,4', '0,32', '41', '42', '46', '385', '2,1']);
    const notes = page.locator('.ci.st-fail .ci-note textarea');
    for (let i = 0; i < await notes.count(); i++) await notes.nth(i).fill('Ghi chú ' + i);
    await page.click('#ck-save');
    await page.waitForFunction(() => document.querySelectorAll('.due-item').length === 4 && !document.querySelector('.due-item.st-local'), null, { timeout: 15000 });
    await page.screenshot({ path: path.join(SHOTS, 'today-web.png') });
    await go(page, '#/');
    await page.waitForSelector('.home-today tbody tr');
    assert.ok((await page.textContent('.home-week .day.today')).includes('✕ 1'), 'lịch tuần: hôm nay 1 phiếu Không đạt');
    await page.screenshot({ path: path.join(SHOTS, 'home-web.png') });
    // Lịch sử kiểm: lượt vừa lưu, mục Không đạt, lọc Không đạt
    await page.click('.grid9 [href="#/history"]');
    await page.waitForSelector('tr[data-href]');
    assert.equal(await page.locator('tr[data-href]').count(), 1);
    assert.ok((await page.textContent('tbody')).includes('Áp suất khí nén'));
    await page.click('[data-res="ok"]');
    await page.waitForSelector('.empty-state');
    await page.click('[data-res="fail"]');
    await page.waitForSelector('tr[data-href]');
    await page.fill('#hs-q', 'tb-0007');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('tr[data-href]').count(), 1);
    await page.click('tr[data-href]');
    await page.waitForSelector('.ci');
    // Bảng tháng web: bảng hạng mục × ngày có giá trị, biểu đồ xu hướng
    await go(page, '#/month');
    await page.waitForSelector('.mgrid');
    assert.ok((await page.textContent('.mgrid')).includes('5,4'));
    assert.equal(await page.locator('.trend-svg').count(), 1);
    await page.screenshot({ path: path.join(SHOTS, 'month-web.png') });
    // Chờ xử lý
    await go(page, '#/pending');
    await page.waitForSelector('[data-resolve]');
    const nAbn = await page.locator('[data-resolve]').count();
    assert.ok(nAbn >= 2);
    await page.locator('[data-resolve]').first().click();
    await page.fill('#ask-text', 'Đã xả nước ngưng, áp lên 6,8 bar');
    await page.click('.modal .btn.primary');
    await page.waitForFunction((n) => document.querySelectorAll('[data-resolve]').length === n - 1, nAbn, { timeout: 15000 });
    env.g.dbReset_();
    assert.equal(env.rows('Abnormals').filter((a) => a.status === 'RESOLVED').length, 1);
    await page.click('[data-tab="days"]');
    await page.waitForSelector('[data-confirm]');
    await page.click('[data-confirm]');
    await page.click('.modal .btn.primary');
    await page.waitForSelector('.pin-input');
    await page.fill('.pin-input', OWNER_PIN);
    await page.click('.modal .btn.primary');
    await page.waitForFunction(() => !document.querySelector('[data-confirm]'), null, { timeout: 15000 });
    env.g.dbReset_();
    assert.equal(env.rows('DayConfirms').length, 1);
    // Lượt kiểm của ngày đã xác nhận: chỉ xem
    await go(page, '#/today');
    await page.waitForSelector('.due-item');
    await page.click('[data-f="fail"]');
    await page.waitForSelector('.due-item.st-fail');
    await page.locator('.due-item.st-fail').first().click();
    await page.waitForSelector('.ci');
    assert.ok((await page.textContent('.check-page')).includes('đã được Trưởng bộ phận xác nhận'));
    assert.equal(await page.locator('#ck-save').count(), 0);
    assert.ok(await noOverflow(page));
    assert.deepEqual(await noRawKeys(page), []);
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('Người kiểm có khu vực: chỉ thấy máy khu vực mình, không có Chờ xử lý / Mẫu checksheet', async () => {
  const env = seeded();
  env.g.dbReset_();
  const areaA = env.rows('Areas').find((a) => a.area_code === 'KV-A').area_id;
  addUser(env, 'KT1', 2, '583920', areaA);
  const app = await openApp({ env, now: NOW, ...WEB });
  try {
    const { page } = app;
    await login(page, 'KT1', '583920');
    assert.equal(await page.locator('.due-item').count(), 3, 'Xưởng A: 2 máy nén + máy sấy');
    assert.equal(await page.locator('.side-item[data-nav="pending"]').count(), 0);
    assert.equal(await page.locator('.side-item[data-nav="templates"]').count(), 0);
    await go(page, '#/templates');
    await page.waitForTimeout(500);
    assert.ok((await page.textContent('.view')).includes('Không có quyền'));
  } finally { await app.close(); }
});

test('Mẫu checksheet: tạo mẫu mới từ thư viện, gán cho máy; máy hiện mẫu mới; báo cáo xem trước + PDF', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...WEB });
  try {
    const { page } = app;
    await login(page);
    await go(page, '#/templates/new');
    await page.waitForSelector('#f-name_vi');
    await page.fill('#f-name_vi', 'Bơm nước – hằng ngày');
    await page.selectOption('#f-frequency', 'DAY');
    await page.click('#tp-lib');
    await page.waitForSelector('.lib-pick');
    await page.locator('.lib-pick', { hasText: 'Áp suất nước' }).locator('input').check();
    await page.locator('.lib-pick', { hasText: 'Rò rỉ dầu, khí, nước' }).locator('input').check();
    await page.click('.modal .btn.primary');
    assert.equal(await page.locator('.ie').count(), 2);
    await page.click('#tp-save');
    await page.waitForSelector('#tp-assign', { timeout: 15000 });
    env.g.dbReset_();
    const tpl = env.rows('Templates').find((t) => t.name_vi === 'Bơm nước – hằng ngày');
    assert.ok(tpl && tpl.frequency === 'DAY');
    assert.equal(env.rows('TemplateItems').filter((x) => x.template_id === tpl.template_id).length, 2);
    await page.click('#tp-assign');
    await page.waitForSelector('#as-list');
    await page.locator('#as-list .lib-pick', { hasText: 'TB-0031' }).locator('input').check();
    await page.click('.modal .btn.primary');
    await page.waitForFunction(() => document.querySelector('.chip') && document.body.innerText.includes('TB-0031'), null, { timeout: 15000 });
    env.g.dbReset_();
    assert.ok(env.rows('Assignments').some((a) => a.template_id === tpl.template_id && a.active));
    await go(page, '#/today');
    await page.waitForFunction(() => document.querySelectorAll('.due-item').length === 6, null, { timeout: 10000 });
    // Báo cáo: xem trước có tiêu đề phiếu, PDF qua máy chủ
    await go(page, '#/reports');
    await page.waitForSelector('.rp-paper');
    assert.ok((await page.textContent('.rp-paper')).includes('PHIẾU KIỂM TRA THIẾT BỊ'));
    await page.click('#rp-pdf');
    await page.waitForSelector('#of-open', { timeout: 15000 });
    assert.ok(app.calls.includes('report.pdf'));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('Gán mẫu cho máy: thẻ "Đang lưu…" hiện ngay khi máy chủ còn đang ghi, xong thì thành thẻ thật', async () => {
  const env = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE, delays: { 'assignment.edit': 2500 } });
  try {
    const { page } = app;
    await login(page);
    env.g.dbReset_();
    const mac = env.rows('Machines').find((m) => m.machine_code === 'TB-0102');
    await go(page, '#/m/' + mac.machine_id);
    await page.waitForSelector('#mc-assign');
    await page.click('#mc-assign');
    await page.waitForSelector('#as-t');
    await page.click('.modal .btn.primary');
    await page.waitForSelector('.asg-card.saving', { timeout: 500 });
    assert.ok((await page.textContent('.asg-card.saving')).includes('Đang lưu'));
    assert.match(await page.getAttribute('#mc-assign', 'class'), /busy/);
    await page.waitForFunction(() => document.querySelectorAll('.asg-card').length === 2 && !document.querySelector('.asg-card.saving'), null, { timeout: 15000 });
    env.g.dbReset_();
    assert.equal(env.rows('Assignments').filter((a) => a.machine_id === mac.machine_id && a.active).length, 2);
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
