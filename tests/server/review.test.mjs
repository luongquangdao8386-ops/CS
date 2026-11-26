// Rà soát d1.6: lưu phiếu/đồng bộ/bảng tháng không đọc lại mọi lượt kiểm cũ; bỏ sót không tính khi mẫu/máy ngừng,
// khoảng ngừng gán không thành bỏ sót, ca đã bớt trong Giờ ca không còn là ca của mẫu; số ngày ghi bù gửi xuống app
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, linkMe, uuid, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';
const DAY = 86400000;

function setup() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  return { env, owner };
}

const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };

function makeTemplate(owner, { freq = 'DAY', shifts = '' } = {}) {
  const id = uuid();
  const items = [
    { name_vi: 'Nhiệt độ dầu', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 60 },
    { name_vi: 'Rò rỉ', input_type: 'PASS_FAIL' }
  ];
  const r = ok(owner.write('template.edit', { template_id: id, name_vi: 'Mẫu thử', frequency: freq, shifts, items }));
  return { id, items: r.data.items };
}

/** Số lần đọc Sheet của một lệnh */
function reads(env, fn) {
  const s = env.ssApp._stats;
  const r0 = s.reads;
  const out = fn();
  return { out, n: s.reads - r0 };
}

/** Chép một lượt kiểm thật thành n lượt cũ (mỗi ngày một lượt, lùi từ ngày `from`) */
function seedRuns(env, run, n, from) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const d = env.g.addDaysIso_(from, -i);
    const o = { ...run, run_id: uuid(), work_date: d, period_key: d, sync_revision: 1 };
    delete o.__row;
    rows.push(o);
  }
  env.g.dbReset_();
  env.g.withWriteLock_(() => env.g.insertRows_('Runs', rows));
  env.g.dbReset_();
}

test('lưu phiếu, lý do bỏ sót: số lần đọc Sheet không tăng theo số lượt kiểm cũ của máy; vẫn chặn trùng kỳ', () => {
  const { env, owner } = setup();
  const { id, items } = makeTemplate(owner);
  const mac = env.rows('Machines')[0];
  const aid = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: id }));
  const results = [{ item_key: items[0].item_key, value: 50 }, { item_key: items[1].item_key, pass: true }];
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-28', results }));
  const run = env.rows('Runs')[0];
  seedRuns(env, run, 600, '2026-10-21');
  // Lượt mới hôm qua: số lần đọc nhỏ (trước d1.6: ~600 lần, mỗi lượt cũ một lần)
  const m = reads(env, () => owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-27', results }));
  ok(m.out);
  assert.ok(m.n < 40, 'check.submit đọc ' + m.n + ' lần');
  // Trùng kỳ vẫn bị chặn: kỳ hôm nay và một kỳ cũ đã có lượt
  let r = owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-28', results });
  assert.equal(r.errors[0].code, 'RUN_EXISTS');
  r = owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-21', results });
  assert.equal(r.errors[0].code, 'RUN_EXISTS');
  // Lý do bỏ sót: kỳ đã có lượt → từ chối; kỳ chưa có lượt (máy khác cùng ngày có lượt cũng không lẫn) → ghi được
  r = owner.write('missed.reason', { missed_id: uuid(), assignment_id: aid, work_date: '2026-10-20', reason_vi: 'Máy dừng' });
  assert.equal(r.errors[0].code, 'STATUS_INVALID');
  const mac2 = env.rows('Machines')[1];
  const aid2 = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid2, machine_id: mac2.machine_id, template_id: id }));
  const m2 = reads(env, () => owner.write('missed.reason', { missed_id: uuid(), assignment_id: aid2, work_date: '2026-10-20', reason_vi: 'Máy dừng' }));
  ok(m2.out);
  assert.ok(m2.n < 40, 'missed.reason đọc ' + m2.n + ' lần');
});

test('bảng lượt kiểm lớn: bootstrap chỉ gửi lượt trong cửa sổ ngày, changes chỉ dòng mới đổi, check.month đúng tháng; bất thường còn mở cũ vẫn gửi', () => {
  const { env, owner } = setup();
  const { id, items } = makeTemplate(owner);
  const mac = env.rows('Machines')[0];
  const aid = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: id }));
  const results = [{ item_key: items[0].item_key, value: 50 }, { item_key: items[1].item_key, pass: true }];
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-28', results }));
  seedRuns(env, env.rows('Runs')[0], 400, '2026-10-27');
  // Bất thường: 250 dòng cũ đã xử lý + 1 dòng cũ còn mở (ngoài cửa sổ 40 ngày) + 1 dòng mới đã xử lý
  const base = { run_id: uuid(), machine_id: mac.machine_id, template_id: id, item_key: items[0].item_key, item_name_vi: 'Nhiệt độ dầu', item_name_zh: '', value_text: '70 °C', std_text: '≤ 60 °C', result: 'FAIL', note: 'x', shift: '', reported_by: 'SYSTEM', reported_at: NOW, resolution_vi: 'ok', resolution_zh: '', resolved_by: 'SYSTEM', resolved_at: NOW, i18n_meta: null };
  const abn = [];
  for (let i = 0; i < 250; i++) { const d = env.g.addDaysIso_('2026-06-01', -i); abn.push(env.g.cNewSystem_({ ...base, abnormal_id: uuid(), period_key: d, work_date: d, status: 'RESOLVED' })); }
  const oldOpen = env.g.cNewSystem_({ ...base, abnormal_id: uuid(), period_key: '2026-05-01', work_date: '2026-05-01', status: 'OPEN' });
  const recent = env.g.cNewSystem_({ ...base, abnormal_id: uuid(), period_key: '2026-10-20', work_date: '2026-10-20', status: 'RESOLVED' });
  abn.push(oldOpen, recent);
  env.g.dbReset_();
  env.g.withWriteLock_(() => env.g.insertRows_('Abnormals', abn.map((x) => ({ ...x, sync_revision: 1 }))));
  env.g.dbReset_();
  const all = env.rows('Runs');
  const from = env.g.addDaysIso_('2026-10-28', -40);
  const want = all.filter((r) => r.work_date >= from).map((r) => r.run_id).sort();
  const b = ok(owner.call('sync.bootstrap', {}));
  assert.equal(b.data.next_page_token, null);
  assert.deepEqual(b.data.records.RUN.map((r) => r.run_id).sort(), want);
  assert.deepEqual(b.data.records.ABNORMAL.map((a) => a.abnormal_id).sort(), [oldOpen.abnormal_id, recent.abnormal_id].sort());
  // Lượt mới: changes chỉ có lượt đó (không đọc lại 400 lượt cũ)
  const cursor = Number(b.data.sync_cursor);
  const rid = uuid();
  ok(owner.write('check.submit', { run_id: rid, assignment_id: aid, template_revision: 1, work_date: '2026-10-29', results: [{ item_key: items[0].item_key, value: 50 }] }));
  const c = reads(env, () => ok(owner.call('sync.changes', { cursor })));
  assert.deepEqual(c.out.data.changes.filter((x) => x.entity_type === 'RUN').map((x) => x.entity_id), [rid]);
  assert.ok(c.n < 20, 'sync.changes đọc ' + c.n + ' lần');
  // Bảng tháng của máy: đúng các lượt trong tháng
  const mo = ok(owner.call('check.month', { machine_id: mac.machine_id, ym: '2026-09' }));
  assert.equal(mo.data.runs.length, 30);
  assert.ok(mo.data.runs.every((r) => r.work_date.startsWith('2026-09')));
  assert.equal(mo.data.abnormals.length, 0);
});

test('gán lại sau khi ngừng, dùng lại mẫu đã ngừng: tính kỳ từ ngày gán lại (khoảng ngừng không thành bỏ sót)', () => {
  const { env, owner } = setup();
  const { id } = makeTemplate(owner);
  const [m1, m2] = env.rows('Machines');
  const a1 = uuid(), a2 = uuid();
  ok(owner.write('assignment.edit', { assignment_id: a1, machine_id: m1.machine_id, template_id: id }));
  ok(owner.write('assignment.edit', { assignment_id: a2, machine_id: m2.machine_id, template_id: id }));
  const asg = (aid) => env.rows('Assignments').find((a) => a.assignment_id === aid);
  assert.equal(asg(a1).start_date, '2026-10-28');
  env.clock.advance(5 * DAY);
  ok(owner.write('assignment.edit', { assignment_id: a1, active: false }, { expected_version: 1 }));
  // Sửa tiêu chuẩn riêng / ghi chú khi đang dùng: giữ ngày bắt đầu
  ok(owner.write('assignment.edit', { assignment_id: a2, note: 'x' }, { expected_version: 1 }));
  assert.equal(asg(a2).start_date, '2026-10-28');
  env.clock.advance(5 * DAY);
  ok(owner.write('assignment.edit', { assignment_id: a1, active: true }, { expected_version: 2 }));
  assert.equal(asg(a1).start_date, '2026-11-07');
  // Gán nhiều máy (assignment.add) gán lại máy đã ngừng: cũng tính từ hôm nay
  ok(owner.write('assignment.edit', { assignment_id: a1, active: false }, { expected_version: 3 }));
  env.clock.advance(2 * DAY);
  const r = ok(owner.write('assignment.add', { template_id: id, machine_ids: [m1.machine_id] }));
  assert.equal(r.data.reactivated, 1);
  assert.equal(asg(a1).start_date, '2026-11-09');
  // Ngừng mẫu rồi dùng lại: máy đang gán tính từ ngày dùng lại
  const tv = () => env.rows('Templates').find((t) => t.template_id === id).record_version;
  ok(owner.write('template.archive', { template_id: id, active: false }, { expected_version: tv() }));
  env.clock.advance(3 * DAY);
  ok(owner.write('template.archive', { template_id: id, active: true }, { expected_version: tv() }));
  assert.equal(asg(a1).start_date, '2026-11-12');
  assert.equal(asg(a2).start_date, '2026-11-12');
});

test('PDF bảng tháng: mẫu ngừng hoặc máy ngừng không tính bỏ sót; ca đã bớt trong Giờ ca không còn là ca của mẫu', () => {
  const { env, owner } = setup();
  const { id } = makeTemplate(owner, { freq: 'SHIFT', shifts: '1,2,3' });
  const mac = env.rows('Machines')[0];
  const aid = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: id }));
  env.clock.advance(3 * DAY);
  const grid = () => {
    env.g.dbReset_();
    const md = env.g.monthData_(mac.machine_id, '2026-10');
    const tpl = md.templates.find((t) => t.template_id === id);
    return env.g.monthGrid_(md, tpl, '1', { list: [], map: {} });
  };
  const missed = (g) => g.rows[0].filter((x) => x === '–').length;
  assert.equal(grid().counts.due, 3); // 28, 29, 30/10 ca 1 đã hết, chưa kiểm
  assert.equal(missed(grid()), 3);
  const tv = () => env.rows('Templates').find((t) => t.template_id === id).record_version;
  ok(owner.write('template.archive', { template_id: id, active: false }, { expected_version: tv() }));
  assert.equal(grid().counts.due, 0);
  assert.equal(missed(grid()), 0);
  ok(owner.write('template.archive', { template_id: id, active: true }, { expected_version: tv() }));
  // Máy ngừng sử dụng bên M&E
  env.g.dbReset_();
  env.g.withWriteLock_(() => env.g.writeCells_('Machines', env.g.findRowNums_('Machines', 'machine_id', mac.machine_id)[0], { active: false }));
  assert.equal(grid().counts.due, 0);
  env.g.dbReset_();
  env.g.withWriteLock_(() => env.g.writeCells_('Machines', env.g.findRowNums_('Machines', 'machine_id', mac.machine_id)[0], { active: true }));
  // Quản trị bớt ca 3 (hai kíp 12 giờ): mẫu "1,2,3" chỉ còn ca 1, 2; lượt mới ca 3 bị từ chối
  owner.pin(OWNER_PIN);
  ok(owner.write('settings.edit', { changes: { shifts_json: [{ no: 1, start: '07:00', end: '19:00' }, { no: 2, start: '19:00', end: '07:00' }] } }));
  env.g.dbReset_();
  const tpl = env.rows('Templates').find((t) => t.template_id === id);
  assert.deepEqual([...env.g.tplShifts_(tpl)], ['1', '2']);
  const items = env.rows('TemplateItems').filter((x) => x.template_id === id);
  const r = owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-30', shift: '3', results: [{ item_key: items[0].item_key, value: 50 }] });
  assert.equal(r.errors[0].code, 'PERIOD_INVALID');
  ok(owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-30', shift: '2', results: [{ item_key: items[0].item_key, value: 50 }] }));
  // PDF: không còn bảng ca 3
  ok(owner.call('report.pdf', { machine_id: mac.machine_id, ym: '2026-10' }));
  const text = [...env.drive._docs.values()].pop().text();
  assert.match(text, /Ca 2 · 2班 \(19:00 – 07:00\)/);
  assert.doesNotMatch(text, /Ca 3 · 3班/);
});

test('số ngày ghi bù (check_backdate_days) gửi xuống app cùng cài đặt', () => {
  const { env, owner } = setup();
  let b = ok(owner.call('sync.bootstrap', {}));
  assert.equal(b.data.settings.check_backdate_days, 7);
  owner.pin(OWNER_PIN);
  ok(owner.write('settings.edit', { changes: { check_backdate_days: 3 } }));
  env.g.dbReset_();
  b = ok(owner.call('sync.bootstrap', {}));
  assert.equal(b.data.settings.check_backdate_days, 3);
});

test('Xong / Kiểm dở theo mục bắt buộc: mục không bắt buộc để trống vẫn là Xong; thiếu mục bắt buộc là Kiểm dở', () => {
  const { env, owner } = setup();
  const id = uuid();
  const r = ok(owner.write('template.edit', { template_id: id, name_vi: 'Có mục không bắt buộc', frequency: 'DAY', items: [
    { name_vi: 'Nhiệt độ dầu', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 60 },
    { name_vi: 'Giờ có tải', input_type: 'NUMBER', unit: 'h', std_type: 'NONE', required: false },
    { name_vi: 'Hóa chất châm', input_type: 'TEXT', required: false }
  ] }));
  const [k1, k2] = r.data.items.map((x) => x.item_key);
  const mac = env.rows('Machines')[0];
  const aid = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: id }));
  const run1 = uuid();
  ok(owner.write('check.submit', { run_id: run1, assignment_id: aid, template_revision: 1, work_date: '2026-10-28', results: [{ item_key: k1, value: 50 }] }));
  let run = env.rows('Runs').find((x) => x.run_id === run1);
  assert.equal(run.status, 'DONE');
  assert.deepEqual([run.filled_count, run.total_count], [1, 3]);
  const run2 = uuid();
  ok(owner.write('check.submit', { run_id: run2, assignment_id: aid, template_revision: 1, work_date: '2026-10-27', results: [{ item_key: k2, value: 7 }] }));
  run = env.rows('Runs').find((x) => x.run_id === run2);
  assert.equal(run.status, 'PARTIAL');
});
