// d1.5: cửa chỉ-đọc feed.isoEvidence cho app ISO (Phần K hướng dẫn app ISO): không phiên, khóa FEED_KEY_ISO, ngày có hồ sơ =
// ngày làm việc của lượt kiểm theo Templates.form_code; adminCreateFeedKeyIso; dòng iso_feed ở Trạng thái hệ thống
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, linkMe, uuid, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';
const ISO_KEY = 'iso-feed-key-TESTONLY-0123456789abcdef';
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };

/** Lượt gọi giống máy chủ ISO bản 2a: không token, app_version là phiên bản máy chủ ISO */
function isoCall(env, payload, extra = {}) {
  env.g.dbReset_();
  return env.post({
    api_contract_version: '1.0', action: 'feed.isoEvidence', payload: { client: 'ISO', ...payload },
    device_id: uuid(), app_version: '1.0.0-d2.1', ...extra
  });
}

/** Thiết bị từ M&E, mẫu ISO BM-CĐ-07-02 (theo ca) + mẫu thường không mã biểu, cả hai gán cho TB-0007 */
function setup() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  ok(owner.pin(OWNER_PIN));
  ok(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02', 'BM-CĐ-09-10'] }));
  const iso = env.rows('Templates').find((t) => t.form_code === 'BM-CĐ-07-02');
  const month = env.rows('Templates').find((t) => t.form_code === 'BM-CĐ-09-10');
  const plainId = uuid();
  ok(owner.write('template.edit', {
    template_id: plainId, name_vi: 'Mẫu thường', frequency: 'DAY', shifts: '',
    items: [{ group_key: 'VISUAL', name_vi: 'Sạch sẽ', name_zh: '清洁', input_type: 'PASS_FAIL', std_type: 'NONE' }]
  }));
  const m7 = env.rows('Machines').find((m) => m.machine_code === 'TB-0007');
  const asg = {};
  for (const [k, tid] of [['iso', iso.template_id], ['month', month.template_id], ['plain', plainId]]) {
    asg[k] = uuid();
    ok(owner.write('assignment.edit', { assignment_id: asg[k], machine_id: m7.machine_id, template_id: tid }));
  }
  return { env, owner, iso, month, plainId, asg, m7 };
}

test('feed.isoEvidence: thiếu / sai mã → FORBIDDEN; không cần phiên; device_id phải là UUID v4; bảo trì thì chặn', () => {
  const env = freshServer({ now: NOW });
  env.g.dbReset_();
  // Chưa tạo FEED_KEY_ISO: mã nào cũng bị từ chối (kể cả chuỗi rỗng)
  assert.equal(isoCall(env, { key: '', since: '2026-01-01' }).code, 'FORBIDDEN');
  assert.equal(isoCall(env, { key: ISO_KEY, since: '2026-01-01' }).code, 'FORBIDDEN');
  env.props.setProperty('FEED_KEY_ISO', ISO_KEY);
  assert.equal(isoCall(env, { key: ISO_KEY.slice(0, -1) + 'X', since: '2026-01-01' }).code, 'FORBIDDEN');
  assert.equal(isoCall(env, { since: '2026-01-01' }).code, 'FORBIDDEN');
  // Mã kết nối M&E không dùng thay được
  env.props.setProperty('ME_FEED_KEY', 'test-feed-key-0123456789abcdef0123');
  assert.equal(isoCall(env, { key: 'test-feed-key-0123456789abcdef0123' }).code, 'FORBIDDEN');
  // Mã ngắn hơn 24 ký tự coi như chưa đặt
  env.props.setProperty('FEED_KEY_ISO', 'ngan');
  assert.equal(isoCall(env, { key: 'ngan' }).code, 'FORBIDDEN');
  env.props.setProperty('FEED_KEY_ISO', ISO_KEY);
  const r = ok(isoCall(env, { key: ISO_KEY, since: '2026-01-01' }));
  assert.deepEqual(Object.keys(r.data).sort(), ['app_id', 'items', 'server_time']);
  assert.equal(r.data.app_id, 'CS');
  assert.deepEqual(r.data.items, []);
  // Không kiểm phiên bản app Checksheet tối thiểu (app_version là phiên bản máy chủ ISO)
  env.g.writeSetting_('min_client_version', '9.0.0', 'TEST');
  ok(isoCall(env, { key: ISO_KEY }, { app_version: '0.0.1' }));
  env.g.writeSetting_('min_client_version', '1.0.0', 'TEST');
  // device_id vẫn phải là UUID v4; hợp đồng khác → cập nhật
  let bad = isoCall(env, { key: ISO_KEY }, { device_id: 'khong-phai-uuid' });
  assert.equal(bad.code, 'VALIDATION_ERROR');
  assert.equal(bad.errors[0].field, 'device_id');
  assert.equal(isoCall(env, { key: ISO_KEY }, { api_contract_version: '2.0' }).code, 'CLIENT_UPDATE_REQUIRED');
  // Bảo trì: chặn như mọi action khác
  env.g.adminMaintenanceOn();
  assert.equal(isoCall(env, { key: ISO_KEY }).code, 'SYSTEM_MAINTENANCE');
  env.g.adminMaintenanceOff();
  ok(isoCall(env, { key: ISO_KEY }));
  // Qua GET không đọc được (chỉ POST)
  const g = env.g.doGet({ parameter: { action: 'feed.isoEvidence', key: ISO_KEY } });
  assert.equal(JSON.parse(g.getContent()).code, 'NOT_FOUND');
});

test('feed.isoEvidence: ngày làm việc của lượt kiểm theo mã biểu; đếm số lượt; mẫu không mã, lượt đã xóa không tính; mẫu đã ngừng vẫn tính', () => {
  const { env, owner, iso, month, plainId, asg, m7 } = setup();
  env.props.setProperty('FEED_KEY_ISO', ISO_KEY);
  const kt = userClient(env, 'KT1', 2, '583920');
  const submit = (aid, wd, shift) => ok(kt.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: wd, shift, results: [] }));
  // BM-CĐ-07-02 theo ca: ngày 28 ca 1 + ca 2, ngày 27 ca 3 (ca qua nửa đêm tính vào ngày bắt đầu ca)
  submit(asg.iso, '2026-10-28', '1');
  submit(asg.iso, '2026-10-28', '2');
  const r27 = submit(asg.iso, '2026-10-27', '3');
  // BM-CĐ-09-10 theo tháng: một lượt, ngày làm việc 26
  submit(asg.month, '2026-10-26', '');
  // Mẫu không mã biểu: không trả
  submit(asg.plain, '2026-10-28', '');
  let d = ok(isoCall(env, { key: ISO_KEY, since: '2026-10-01' })).data;
  const norm = (items) => items.map((x) => `${x.form_code}|${x.date}|${x.count}`).sort();
  assert.deepEqual(norm(d.items), ['BM-CĐ-07-02|2026-10-27|1', 'BM-CĐ-07-02|2026-10-28|2', 'BM-CĐ-09-10|2026-10-26|1']);
  for (const x of d.items) assert.deepEqual(Object.keys(x).sort(), ['count', 'date', 'form_code']);
  // since cắt: chỉ từ ngày 28
  d = ok(isoCall(env, { key: ISO_KEY, since: '2026-10-28' })).data;
  assert.deepEqual(norm(d.items), ['BM-CĐ-07-02|2026-10-28|2']);
  // since tương lai → không có dòng
  assert.deepEqual(ok(isoCall(env, { key: ISO_KEY, since: '2026-11-30' })).data.items, []);
  // Lượt đã xóa (archived_at) không tính; ghi thẳng qua systemWrite_ để table_rev đổi như mọi lần ghi
  env.g.dbReset_();
  const run27 = env.rows('Runs').find((r) => r.run_id === r27.data.run.run_id);
  const archived = { ...run27, archived_at: env.g.isoVN_(new env.clock.Date()), record_version: run27.record_version + 1 };
  delete archived.__row;
  env.g.systemWrite_([{ sheet: 'Runs', mode: 'update', row: archived }]);
  d = ok(isoCall(env, { key: ISO_KEY, since: '2026-10-01' })).data;
  assert.deepEqual(norm(d.items), ['BM-CĐ-07-02|2026-10-28|2', 'BM-CĐ-09-10|2026-10-26|1']);
  // Mẫu đã ngừng vẫn tính lượt cũ
  ok(owner.write('template.archive', { template_id: iso.template_id, active: false }, { expected_version: iso.record_version }));
  assert.equal(env.rows('Templates').find((t) => t.template_id === iso.template_id).active, false);
  d = ok(isoCall(env, { key: ISO_KEY, since: '2026-10-01' })).data;
  assert.deepEqual(norm(d.items), ['BM-CĐ-07-02|2026-10-28|2', 'BM-CĐ-09-10|2026-10-26|1']);
  // Đặt mã biểu cho mẫu thường → lượt cũ của mẫu đó có ngay (mã viết sao trả vậy, chỉ bỏ khoảng trắng hai đầu)
  const plain = env.rows('Templates').find((t) => t.template_id === plainId);
  ok(owner.write('template.edit', { template_id: plainId, form_code: ' BM-CĐ-07-06-KT ' }, { expected_version: plain.record_version }));
  d = ok(isoCall(env, { key: ISO_KEY, since: '2026-10-01' })).data;
  assert.ok(norm(d.items).includes('BM-CĐ-07-06-KT|2026-10-28|1'), JSON.stringify(d.items));
  assert.ok(month && m7);
});

test('feed.isoEvidence: since thiếu / sai dạng / cũ hơn 400 ngày → hôm nay − 400 ngày; không quá hôm nay', () => {
  const { env, iso, m7, asg } = setup();
  env.props.setProperty('FEED_KEY_ISO', ISO_KEY);
  // Lượt kiểm ở các mốc quanh hôm nay − 400 ngày (2025-09-23) và một lượt ngày mai (giờ máy lệch) — ghi thẳng như dữ liệu cũ
  env.g.dbReset_();
  const today = env.g.todayVN_();
  assert.equal(today, '2026-10-28');
  const floor = env.g.addDaysIso_(today, -400);
  assert.equal(floor, '2025-09-23');
  const mk = (wd) => env.g.cNewSystem_({
    run_id: uuid(), machine_id: m7.machine_id, template_id: iso.template_id, template_revision: 1, assignment_id: asg.iso, frequency: 'SHIFT',
    period_key: wd + '#1', work_date: wd, shift: '1', status: 'DONE', results_json: [], filled_count: 0, total_count: 0, fail_count: 0, warn_count: 0,
    checked_by: 'SYSTEM', checked_at: wd + 'T07:00:00+07:00', note: ''
  });
  env.g.systemWrite_(['2025-09-22', floor, '2026-10-28', '2026-10-29'].map((wd) => ({ sheet: 'Runs', mode: 'insert', row: mk(wd) })));
  const dates = (since) => {
    const p = since === undefined ? { key: ISO_KEY } : { key: ISO_KEY, since };
    return ok(isoCall(env, p)).data.items.map((x) => x.date).sort();
  };
  const want = [floor, '2026-10-28'];
  assert.deepEqual(dates(undefined), want);
  assert.deepEqual(dates('28/10/2026'), want);
  assert.deepEqual(dates('2026-13-45'), want);
  assert.deepEqual(dates('2024-01-01'), want);
  assert.deepEqual(dates(12345), want);
  assert.deepEqual(dates('2025-09-24'), ['2026-10-28']);
});

test('adminCreateFeedKeyIso: tạo một lần (32 byte base64url), chạy lại in mã cũ; Trạng thái hệ thống có dòng iso_feed', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  let st = ok(owner.call('system.status', {})).data.checks.find((x) => x.key === 'iso_feed');
  assert.equal(st.value, 'OFF');
  assert.equal(st.status, 'OK');
  env.g.adminCreateFeedKeyIso();
  const k = env.props.getProperty('FEED_KEY_ISO');
  assert.match(k, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(env.logs.some((l) => l.includes('Mã kết nối cho app ISO: ' + k)));
  assert.notEqual(k, env.props.getProperty('ME_FEED_KEY'));
  env.logs.length = 0;
  env.g.adminCreateFeedKeyIso();
  assert.equal(env.props.getProperty('FEED_KEY_ISO'), k);
  assert.ok(env.logs.some((l) => l.includes('Mã kết nối cho app ISO: ' + k)));
  st = ok(owner.call('system.status', {})).data.checks.find((x) => x.key === 'iso_feed');
  assert.equal(st.value, 'ON');
  ok(isoCall(env, { key: k }));
  // Đổi mã: xóa thuộc tính rồi chạy lại → mã mới, mã cũ hết dùng được
  env.props.deleteProperty('FEED_KEY_ISO');
  env.g.adminCreateFeedKeyIso();
  const k2 = env.props.getProperty('FEED_KEY_ISO');
  assert.notEqual(k2, k);
  assert.equal(isoCall(env, { key: k }).code, 'FORBIDDEN');
  ok(isoCall(env, { key: k2 }));
});
