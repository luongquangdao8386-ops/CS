// d1.6: khu vực phụ trách do máy chủ giữ (không chỉ app ẩn đi): ghi/đọc máy ngoài khu vực bị chặn, đồng bộ chỉ gửi dữ liệu khu vực mình;
// dọn phiên, nhật ký đăng nhập, thao tác cũ
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, linkMe, meFeed, uuid, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };

function setup() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const me = linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  const tid = uuid();
  const r = ok(owner.write('template.edit', { template_id: tid, name_vi: 'Hằng ngày', frequency: 'DAY', items: [{ name_vi: 'Nhiệt độ', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 60 }] }));
  const key = r.data.items[0].item_key;
  const mac = (code) => env.rows('Machines').find((m) => m.machine_code === code);
  const asg = {};
  for (const code of ['TB-0007', 'TB-0031']) {
    asg[code] = uuid();
    ok(owner.write('assignment.edit', { assignment_id: asg[code], machine_id: mac(code).machine_id, template_id: tid }));
  }
  return { env, owner, me, tid, key, mac, asg };
}

test('khu vực phụ trách: người kiểm/trưởng bộ phận không ghi, không xem Bảng tháng/PDF máy ngoài khu vực; tự sửa lượt của mình khi máy đã chuyển khu vực vẫn được', () => {
  const { env, owner, me, tid, key, mac, asg } = setup();
  const kt = userClient(env, 'KT-A', 2, '583920', 'loc-a');
  const c3 = userClient(env, 'TBP-A', 3, '583921', 'loc-a');
  const res = (v) => [{ item_key: key, value: v, note: v > 60 ? 'nóng' : '' }];
  // TB-0007 ở loc-a: được; TB-0031 ở loc-b: chặn
  const rA = uuid();
  ok(kt.write('check.submit', { run_id: rA, assignment_id: asg['TB-0007'], template_revision: 1, work_date: '2026-10-28', results: res(70) }));
  let r = kt.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0031'], template_revision: 1, work_date: '2026-10-28', results: res(50) });
  assert.equal(r.errors[0].code, 'AREA_FORBIDDEN');
  // Owner (mọi khu vực) kiểm TB-0031, có mục Không đạt
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0031'], template_revision: 1, work_date: '2026-10-28', results: res(75) }));
  const abnB = env.rows('Abnormals').find((a) => a.machine_id === mac('TB-0031').machine_id);
  const abnA = env.rows('Abnormals').find((a) => a.machine_id === mac('TB-0007').machine_id);
  r = c3.write('abnormal.resolve', { abnormal_id: abnB.abnormal_id, resolution_vi: 'Đã sửa' }, { expected_version: abnB.record_version });
  assert.equal(r.errors[0].code, 'AREA_FORBIDDEN');
  ok(c3.write('abnormal.resolve', { abnormal_id: abnA.abnormal_id, resolution_vi: 'Đã sửa' }, { expected_version: abnA.record_version }));
  r = c3.write('missed.reason', { missed_id: uuid(), assignment_id: asg['TB-0031'], work_date: '2026-10-27', reason_vi: 'Dừng máy' });
  assert.equal(r.errors[0].code, 'AREA_FORBIDDEN');
  ok(c3.write('missed.reason', { missed_id: uuid(), assignment_id: asg['TB-0007'], work_date: '2026-10-27', reason_vi: 'Dừng máy' }));
  // Gán mẫu: máy ngoài khu vực bị chặn (gán một máy) / bỏ qua (gán nhiều máy)
  r = c3.write('assignment.edit', { assignment_id: asg['TB-0031'], active: false }, { expected_version: 1 });
  assert.equal(r.errors[0].code, 'AREA_FORBIDDEN');
  const tid2 = uuid();
  ok(owner.write('template.edit', { template_id: tid2, name_vi: 'Hằng tuần', frequency: 'WEEK', items: [{ name_vi: 'Vệ sinh', input_type: 'PASS_FAIL' }] }));
  r = ok(c3.write('assignment.add', { template_id: tid2, machine_ids: [mac('TB-0007').machine_id, mac('TB-0031').machine_id] }));
  assert.deepEqual([r.data.added, r.data.skipped], [1, 1]);
  // Bảng tháng, PDF
  assert.equal(c3.call('check.month', { machine_id: mac('TB-0031').machine_id, ym: '2026-10' }).code, 'FORBIDDEN');
  assert.equal(kt.call('report.pdf', { machine_id: mac('TB-0031').machine_id, ym: '2026-10' }).code, 'FORBIDDEN');
  ok(kt.call('check.month', { machine_id: mac('TB-0007').machine_id, ym: '2026-10' }));
  // M&E chuyển TB-0007 sang loc-b: người kiểm tự sửa lượt của mình vẫn được, lượt mới thì không
  const f = meFeed({ rev: 'r2' });
  f.equipment[0].location_id = 'loc-b';
  me.feed = f;
  env.g.dbReset_();
  env.g.syncMachines_(false);
  const run = env.rows('Runs').find((x) => x.run_id === rA);
  ok(kt.write('check.submit', { run_id: rA, assignment_id: asg['TB-0007'], template_revision: 1, work_date: '2026-10-28', results: res(55) }, { expected_version: run.record_version }));
  r = kt.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0007'], template_revision: 1, work_date: '2026-10-27', results: res(50) });
  assert.equal(r.errors[0].code, 'AREA_FORBIDDEN');
  assert.ok(tid);
});

test('đồng bộ theo khu vực: người có khu vực chỉ nhận máy, gán mẫu, lượt kiểm, bất thường của khu vực mình; máy chuyển khu vực → app tải lại', () => {
  const { env, owner, me, key, mac, asg } = setup();
  const kt = userClient(env, 'KT-A', 2, '583920', 'loc-a');
  const res = [{ item_key: key, value: 70, note: 'nóng' }];
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0007'], template_revision: 1, work_date: '2026-10-28', results: res }));
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0031'], template_revision: 1, work_date: '2026-10-28', results: res }));
  owner.pin(OWNER_PIN);
  ok(owner.write('day.confirm', { work_date: '2026-10-28' }));
  const b = ok(kt.call('sync.bootstrap', {})).data.records;
  const inA = new Set(env.rows('Machines').filter((m) => m.area_id === 'loc-a').map((m) => m.machine_id));
  assert.deepEqual(b.MACHINE.map((m) => m.machine_code).sort(), ['TB-0007', 'TB-0008']);
  assert.equal(b.AREA.length, 2, 'khu vực: gửi đủ');
  assert.equal(b.TEMPLATE.length, 1, 'mẫu: gửi đủ');
  for (const t of ['ASSIGNMENT', 'RUN', 'ABNORMAL']) {
    assert.ok(b[t].length >= 1, t);
    assert.ok(b[t].every((x) => inA.has(x.machine_id)), t);
  }
  assert.equal(b.DAY_CONFIRM.length, 1, 'xác nhận ngày mọi khu vực (*)');
  // Owner (mọi khu vực) vẫn nhận đủ
  const ob = ok(owner.call('sync.bootstrap', {})).data.records;
  assert.equal(ob.MACHINE.length, 3);
  assert.equal(ob.RUN.length, 2);
  // Bản ghi mới của khu vực khác không tới máy người kiểm
  const cursor = Number(ok(kt.call('sync.changes', { cursor: 0 })).data.next_cursor);
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: asg['TB-0031'], template_revision: 1, work_date: '2026-10-27', results: [{ item_key: key, value: 50 }] }));
  let c = ok(kt.call('sync.changes', { cursor })).data;
  const runCh = c.changes.filter((x) => x.entity_type === 'RUN');
  assert.deepEqual(runCh.map((x) => x.op), ['TOMBSTONE'], 'lượt kiểm khu vực khác: chỉ báo xóa, không gửi dữ liệu');
  assert.equal(runCh[0].data, null);
  // M&E chuyển TB-0031 sang loc-a: settings_rev đổi → app tải lại (nhận cả gán mẫu, lượt kiểm cũ của máy)
  const rev0 = c.settings_rev;
  const f = meFeed({ rev: 'r2' });
  f.equipment[2].location_id = 'loc-a';
  me.feed = f;
  env.g.dbReset_();
  env.g.syncMachines_(false);
  c = ok(kt.call('sync.changes', { cursor: Number(c.next_cursor) })).data;
  assert.ok(c.settings_rev > rev0);
  const b2 = ok(kt.call('sync.bootstrap', {})).data.records;
  assert.equal(b2.MACHINE.length, 3);
  assert.equal(b2.RUN.length, 3);
});

test('dọn dữ liệu cũ: phiên hết hạn/thu hồi > 30 ngày, nhật ký đăng nhập quá hạn giữ, thao tác đã xong > 90 ngày; phiên đang dùng không ảnh hưởng', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const g = env.g;
  const old = (days) => g.isoVN_(new env.clock.Date(Date.parse(NOW) - days * 86400000));
  g.dbReset_();
  const base = g.readRows_('Sessions')[0];
  const sess = [], att = [], ops = [];
  for (let i = 0; i < 5; i++) {
    sess.push({ ...base, session_id: uuid(), token_hash: 'x' + i, expires_at: old(40), revoked_at: '', __row: undefined });
    sess.push({ ...base, session_id: uuid(), token_hash: 'y' + i, expires_at: old(-10), revoked_at: old(45), __row: undefined });
    sess.push({ ...base, session_id: uuid(), token_hash: 'z' + i, expires_at: old(-10), revoked_at: old(5), __row: undefined });
    att.push({ attempt_id: uuid(), occurred_at: old(120), employee_code_hash: 'h', device_id: '', outcome: 'FAILED', attempt_kind: 'LOGIN', user_id: '' });
    att.push({ attempt_id: uuid(), occurred_at: old(10), employee_code_hash: 'h', device_id: '', outcome: 'FAILED', attempt_kind: 'LOGIN', user_id: '' });
    ops.push({ operation_id: uuid(), user_id: 'u', state: 'COMMITTED', received_at: old(100), action: 'check.submit' });
    ops.push({ operation_id: uuid(), user_id: 'u', state: 'PREPARED', received_at: old(100), action: 'check.submit' });
    ops.push({ operation_id: uuid(), user_id: 'u', state: 'COMMITTED', received_at: old(20), action: 'check.submit' });
  }
  sess.forEach((s) => delete s.__row);
  g.withWriteLock_(() => {
    g.insertRows_('Sessions', sess);
    g.insertRows_('AuthAttempts', att);
    g.insertRows_('Operations', ops);
  });
  const n = (s) => env.rows(s).length;
  const before = { s: n('Sessions'), a: n('AuthAttempts'), o: n('Operations') };
  g.dbReset_();
  const out = g.cleanupOld_(false);
  assert.deepEqual({ ...out }, { sessions: 10, auth_attempts: 5, operations: 5 });
  assert.deepEqual({ s: n('Sessions'), a: n('AuthAttempts'), o: n('Operations') }, { s: before.s - 10, a: before.a - 5, o: before.o - 5 });
  assert.ok(env.rows('Operations').some((o) => o.state === 'PREPARED'), 'thao tác chưa xong giữ nguyên');
  // Chưa tới lượt (1 lần/ngày) → không chạy
  g.dbReset_();
  assert.equal(g.cleanupOld_(false), null);
  // Phiên của owner vẫn dùng được, ghi tiếp bình thường
  ok(owner.call('sync.changes', { cursor: 0 }));
  ok(owner.write('template.edit', { template_id: uuid(), name_vi: 'Sau khi dọn', frequency: 'DAY', items: [{ name_vi: 'A', input_type: 'PASS_FAIL' }] }));
});
