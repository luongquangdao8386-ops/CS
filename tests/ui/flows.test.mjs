// Luồng mất mạng: sửa phiếu khi mất mạng trong lúc Trưởng bộ phận cũng sửa → Xung đột → "Sửa tiếp trên bản máy chủ";
// chụp ảnh mục Không đạt khi mất mạng → có mạng lại gửi phiếu rồi ảnh, mở lại phiếu thấy ảnh đã lưu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './harness.mjs';
import { freshServer, ownerClient, addUser } from '../helpers.mjs';

const NOW = '2026-10-28T08:10:00+07:00';
const IPHONE = { viewport: { width: 390, height: 844 }, mobile: true };

function seeded() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  addUser(env, 'KT', 2, '583922');
  const tpl = env.rows('Templates').find((t) => t.frequency === 'DAY');
  const asg = env.rows('Assignments').find((a) => a.template_id === tpl.template_id);
  return { env, owner, tpl, asg, items: env.rows('TemplateItems').filter((x) => x.template_id === tpl.template_id) };
}
async function login(page) {
  await page.waitForSelector('#emp', { timeout: 15000 });
  await page.fill('#emp', 'KT');
  await page.fill('#pin', '583922');
  await page.click('#login-btn');
  await page.waitForSelector('.grid9', { timeout: 20000 });
}
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
/** Điền mọi ô số bằng giá trị v (ô đầu = first nếu có), chọn nút đầu mỗi nhóm, ghi chú mục Không đạt */
async function fill(page, v, first = null) {
  await page.waitForSelector('.ci');
  const n = await page.locator('.ci-inp').count();
  for (let i = 0; i < n; i++) await page.locator('.ci-inp').nth(i).fill(i === 0 && first ? first : v);
  const groups = page.locator('.ci-opts');
  for (let i = 0; i < await groups.count(); i++) {
    const o = groups.nth(i).locator('.opt').first();
    if (!/\bon\b/.test(await o.getAttribute('class'))) await o.click();
  }
  for (const ci of await page.locator('.ci.st-fail').all()) await ci.locator('.ci-note textarea').fill('ghi chú');
}
/** Chờ hàm (chạy trong trang, có thể async) trả giá trị đúng — waitForFunction không chờ Promise */
async function until(page, fn, timeout = 15000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return;
    if (Date.now() - t0 > timeout) throw new Error('until: hết giờ chờ');
    await page.waitForTimeout(200);
  }
}
const queue = (page) => page.evaluate(async () => (await import('./js/sync.js')).queueItems().then((l) => l.map((o) => [o.action, o.state])));
async function serverRun(env, page, pred) {
  for (let k = 0; k < 40; k++) { const r = env.rows('Runs').find(pred); if (r) return r; await page.waitForTimeout(250); }
  return null;
}

test('iPhone: sửa phiếu khi mất mạng mà Trưởng bộ phận đã sửa trước → Xung đột → Sửa tiếp trên bản máy chủ → máy chủ nhận bản của người kiểm', async () => {
  const { env, owner, asg, items } = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE });
  try {
    const { page } = app;
    await login(page);
    await go(page, '#/check/' + asg.assignment_id);
    await fill(page, '20');
    await page.click('#ck-save');
    await page.waitForFunction(() => location.hash.startsWith('#/today'));
    const run = await serverRun(env, page, (x) => x.assignment_id === asg.assignment_id);
    assert.ok(run);
    await page.waitForTimeout(1500);
    await app.offline(true);
    await go(page, '#/check/' + asg.assignment_id);
    await fill(page, '25');
    await page.click('#ck-save');
    await page.waitForFunction(() => location.hash.startsWith('#/today'));
    // Trưởng bộ phận (owner) sửa cùng lượt trên máy chủ trước
    const res = items.filter((x) => x.input_type !== 'CHOICE').map((x) => (x.input_type === 'NUMBER' ? { item_key: x.item_key, value: 30 } : { item_key: x.item_key, pass: true }));
    const r = owner.write('check.submit', { run_id: run.run_id, assignment_id: asg.assignment_id, template_revision: 1, work_date: run.work_date, results: res }, { expected_version: run.record_version });
    assert.equal(r.ok, true, JSON.stringify(r));
    await app.offline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await until(page, async () => (await import('./js/sync.js')).queueItems().then((l) => l.some((o) => o.state === 'CONFLICT')));
    await go(page, '#/account/drafts');
    await page.click('[data-tab="conflict"]');
    await page.locator('a[href^="#/account/conflict/"]').first().click();
    await page.click('#cf-edit');
    await until(page, async () => (await import('./js/sync.js')).queueItems().then((l) => !l.length));
    const after = env.rows('Runs').find((x) => x.run_id === run.run_id);
    assert.equal(after.record_version, 3);
    assert.ok(after.results_json.filter((x) => x.input_type === 'NUMBER').every((x) => x.value === 25), JSON.stringify(after.results_json.map((x) => x.value)));
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});

test('iPhone: chụp ảnh mục Không đạt khi mất mạng → hàng chờ phiếu + ảnh → có mạng gửi lên (ảnh chia sẻ bằng link) → mở lại thấy ảnh đã lưu', async () => {
  const { env, asg } = seeded();
  const app = await openApp({ env, now: NOW, ...IPHONE });
  try {
    const { page } = app;
    await login(page);
    const jpg = Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 800, 600); return c.toDataURL('image/jpeg', 0.9); })).split(',')[1], 'base64');
    await go(page, '#/check/' + asg.assignment_id);
    await page.waitForSelector('.ci');
    await app.offline(true);
    await fill(page, '28', '999');
    await page.locator('.ci.st-fail').first().locator('input[data-photo]').setInputFiles({ name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpg });
    await page.waitForFunction(() => /1/.test((document.querySelector('.ci.st-fail [id^="pc-"]') || {}).textContent || ''), null, { timeout: 10000 });
    await page.click('#ck-save');
    await page.waitForFunction(() => location.hash.startsWith('#/today'));
    assert.deepEqual(await queue(page), [['check.submit', 'QUEUED'], ['doc.upload', 'QUEUED']]);
    await app.offline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await until(page, async () => (await import('./js/sync.js')).queueItems().then((l) => !l.length));
    const docs = env.rows('Documents');
    assert.equal(docs.length, 1);
    assert.equal(docs[0].drive_sharing_state, 'LINK_SHARED');
    assert.ok(docs[0].item_key);
    await page.waitForTimeout(1000);
    await go(page, '#/check/' + asg.assignment_id);
    await page.waitForSelector('.ci');
    assert.match(await page.textContent('.check-page'), /1 ảnh đã lưu/);
    assert.deepEqual(app.consoleErrors, []);
  } finally { await app.close(); }
});
