// Luồng nghiệp vụ chính trên máy chủ giả lập: lấy thiết bị từ M&E, mẫu có phiên bản, gán máy, kiểm, bất thường, xác nhận ngày
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, linkMe, meFeed, uuid, ME_EXEC, ME_KEY, fakeJpegB64, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';

function setupLinked() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const me = linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  return { env, owner, me };
}

function lib(env) {
  const rows = env.rows('LibraryItems');
  const by = (n) => rows.find((r) => r.name_vi === n);
  return { rows, by };
}

function itemFrom(li, extra = {}) {
  const f = ['group_key', 'name_vi', 'name_zh', 'input_type', 'unit', 'std_type', 'std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json', 'std_text_vi', 'std_text_zh'];
  const o = { library_item_id: li.item_id };
  f.forEach((k) => { if (li[k] !== null && li[k] !== '' && li[k] !== undefined) o[k] = li[k]; });
  return { ...o, ...extra };
}

function makeTemplate(c, env, { freq = 'SHIFT', shifts = '1,2,3' } = {}) {
  const L = lib(env);
  const id = uuid();
  const items = ['Nhiệt độ dầu', 'Áp suất khí nén', 'Dòng điện 3 pha', 'Mức dầu', 'Rò rỉ dầu, khí, nước'].map((n) => itemFrom(L.by(n)));
  const r = c.write('template.edit', { template_id: id, name_vi: 'Máy nén khí – hằng ca', frequency: freq, shifts, items });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { id, res: r };
}

test('lấy thiết bị từ M&E: thêm, sửa, ngừng; không đổi thì không ghi', () => {
  const { env, me } = setupLinked();
  let macs = env.rows('Machines');
  assert.equal(macs.length, 3);
  assert.equal(macs.find((m) => m.machine_code === 'TB-0007').area_id, 'loc-a');
  assert.equal(env.rows('Areas').length, 2);
  // Không đổi rev → unchanged, không ghi
  env.g.dbReset_();
  const r0 = env.g.syncMachines_(false);
  assert.equal(r0.unchanged, true);
  // Đổi tên, khu vực, một máy Ngừng sử dụng, một máy mất khỏi M&E
  const f = meFeed({ rev: 'r2' });
  f.equipment[0].name_vi = 'Máy nén khí số 1';
  f.equipment[0].location_id = 'loc-b';
  f.equipment[1].status = 'RETIRED';
  f.equipment.splice(2, 1);
  me.feed = f;
  env.g.dbReset_();
  const r1 = env.g.syncMachines_(false);
  assert.equal(r1.machines.updated, 1);
  assert.equal(r1.machines.deactivated, 2);
  macs = env.rows('Machines');
  const m7 = macs.find((m) => m.machine_code === 'TB-0007');
  assert.equal(m7.name_vi, 'Máy nén khí số 1');
  assert.equal(m7.area_id, 'loc-b');
  assert.equal(m7.record_version, 2);
  assert.equal(macs.find((m) => m.machine_code === 'TB-0008').active, false);
  assert.equal(macs.find((m) => m.machine_code === 'TB-0031').active, false);
  // Mã kết nối sai → lỗi, ghi trạng thái
  env.props.setProperty('ME_FEED_KEY', 'sai-ma-ket-noi-000000000000000');
  env.g.dbReset_();
  assert.throws(() => env.g.syncMachines_(true), /ME_LINK_FAILED/);
  env.g.dbReset_();
  assert.equal(env.g.readState_().map.me_last_sync_status, 'FAILED');
});

test('me.link.set: kiểm link + mã, thử kết nối trước khi lưu', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  linkMe(env);
  env.props.deleteProperty('ME_EXEC_URL');
  env.props.deleteProperty('ME_FEED_KEY');
  owner.pin(OWNER_PIN);
  let r = owner.write('me.link.set', { exec_url: 'https://example.com/exec', key: 'ngan' });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.deepEqual(r.errors.map((e) => e.code).sort(), ['KEY_FORMAT', 'URL_INVALID']);
  r = owner.write('me.link.set', { exec_url: ME_EXEC, key: 'sai-ma-ket-noi-000000000000000' });
  assert.equal(r.code, 'ME_LINK_FAILED');
  assert.equal(env.props.getProperty('ME_FEED_KEY'), null);
  r = owner.write('me.link.set', { exec_url: ME_EXEC, key: ME_KEY });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.sync.machines.added, 3);
  assert.equal(env.props.getProperty('ME_EXEC_URL'), ME_EXEC);
  // Người kiểm không được
  const kt = userClient(env, 'KT1', 2, '583920');
  kt.pin('583920');
  assert.equal(kt.write('me.link.set', { exec_url: ME_EXEC, key: ME_KEY }).code, 'FORBIDDEN');
});

test('mẫu: tạo, sửa hạng mục = phiên bản mới, item_key giữ nguyên; sửa tên không tạo phiên bản', () => {
  const { env, owner } = setupLinked();
  const { id, res } = makeTemplate(owner, env);
  assert.equal(res.data.template.template_code, 'MS-0001');
  assert.equal(res.data.template.revision, 1);
  assert.equal(res.data.items.length, 5);
  const items = res.data.items;
  // Đổi tiêu chuẩn áp suất → phiên bản 2, cùng item_key
  const edited = items.map((it) => ({ ...it, ...(it.name_vi === 'Áp suất khí nén' ? { std_min: 6.5 } : {}) }));
  let r = owner.write('template.edit', { template_id: id, items: edited }, { expected_version: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.template.revision, 2);
  assert.equal(r.data.new_revision, true);
  assert.deepEqual(r.data.items.map((x) => x.item_key), items.map((x) => x.item_key));
  // Chỉ đổi tên mẫu → không tạo phiên bản
  r = owner.write('template.edit', { template_id: id, name_vi: 'Máy nén khí – mỗi ca' }, { expected_version: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.data.template.revision, 2);
  assert.equal(r.data.new_revision, false);
  // Dịch máy điền tiếng Trung khi chỉ nhập tiếng Việt
  assert.match(r.data.template.name_zh, /\[zh-CN\]/);
  // Lỗi tiêu chuẩn: RANGE min ≥ max; kiểu chọn thiếu lựa chọn Đạt
  r = owner.write('template.edit', { template_id: uuid(), name_vi: 'X', frequency: 'DAY', items: [{ name_vi: 'A', input_type: 'NUMBER', std_type: 'RANGE', std_min: 8, std_max: 6 }, { name_vi: 'B', input_type: 'CHOICE', choices_json: [{ code: 'X', vi: 'x', result: 'FAIL' }] }] });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.deepEqual(r.errors.map((e) => e.code).sort(), ['CHOICES_REQUIRED', 'STD_INVALID']);
  // Kiểm theo ca mà không chọn ca
  r = owner.write('template.edit', { template_id: uuid(), name_vi: 'Y', frequency: 'SHIFT', shifts: '', items: [{ name_vi: 'A', input_type: 'PASS_FAIL' }] });
  assert.equal(r.errors[0].code, 'SHIFTS_REQUIRED');
  // Đồng bộ chỉ gửi hạng mục của phiên bản hiện tại
  const b = owner.call('sync.bootstrap', {});
  assert.equal(b.data.records.TEMPLATE_ITEM.length, 5);
  assert.ok(b.data.records.TEMPLATE_ITEM.every((x) => x.revision === 2));
});

test('gán máy, tiêu chuẩn riêng; kiểm: đánh giá trên máy chủ, Không đạt sinh bất thường, sửa lượt hủy bất thường', () => {
  const { env, owner } = setupLinked();
  const { id, res } = makeTemplate(owner, env);
  const items = res.data.items;
  const key = (n) => items.find((x) => x.name_vi === n).item_key;
  const m7 = env.rows('Machines').find((m) => m.machine_code === 'TB-0007');
  const aid = uuid();
  let r = owner.write('assignment.edit', { assignment_id: aid, machine_id: m7.machine_id, template_id: id, overrides: { [key('Áp suất khí nén')]: { std_type: 'RANGE', std_min: 7, std_max: 8 } } });
  assert.equal(r.ok, true, JSON.stringify(r));
  // Gán trùng
  r = owner.write('assignment.edit', { assignment_id: uuid(), machine_id: m7.machine_id, template_id: id });
  assert.equal(r.errors[0].code, 'ASSIGNMENT_EXISTS');
  // Gán nhiều máy: bỏ qua máy đã gán và máy đã ngừng
  r = owner.write('assignment.add', { template_id: id, machine_ids: env.rows('Machines').map((m) => m.machine_id) });
  assert.equal(r.data.added, 2);
  assert.equal(r.data.skipped, 1);

  const kt = userClient(env, 'KT1', 2, '583920');
  const runId = uuid();
  const results = [
    { item_key: key('Nhiệt độ dầu'), value: 57 },              // ≥ 55 → Cần chú ý
    { item_key: key('Áp suất khí nén'), value: 6.8, note: '' },  // tiêu chuẩn riêng 7–8 → Không đạt, thiếu ghi chú
    { item_key: key('Dòng điện 3 pha'), values: [41, 42, 46] },
    { item_key: key('Mức dầu'), choice: 'NORMAL' }
  ];
  r = kt.write('check.submit', { run_id: runId, assignment_id: aid, template_revision: 1, work_date: '2026-10-28', shift: '1', results });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.equal(r.errors[0].code, 'FAIL_NOTE_REQUIRED');
  results[1].note = 'Áp thấp, xì van xả';
  r = kt.write('check.submit', { run_id: runId, assignment_id: aid, template_revision: 1, work_date: '2026-10-28', shift: '1', results });
  assert.equal(r.ok, true, JSON.stringify(r));
  const run = r.data.run;
  assert.equal(run.period_key, '2026-10-28#1');
  assert.equal(run.status, 'PARTIAL');
  assert.equal(run.filled_count, 4);
  assert.equal(run.fail_count, 1);
  assert.equal(run.warn_count, 1);
  const p = run.results_json.find((x) => x.item_key === key('Áp suất khí nén'));
  assert.equal(p.result, 'FAIL');
  assert.equal(p.std_vi, '7 – 8 bar');
  assert.equal(p.overridden, true);
  const tp = run.results_json.find((x) => x.item_key === key('Dòng điện 3 pha'));
  assert.equal(tp.result, 'OK');
  assert.equal(tp.imb, 7);
  assert.equal(r.data.abnormals.length, 1);
  assert.equal(r.data.abnormals[0].status, 'OPEN');
  // Người khác kiểm cùng ca → RUN_EXISTS
  const kt2 = userClient(env, 'KT2', 2, '583921');
  r = kt2.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-10-28', shift: '1', results });
  assert.equal(r.errors[0].code, 'RUN_EXISTS');
  assert.ok(r.data.existing);
  // Người kiểm sửa lượt: áp suất 7,2 → hết Không đạt → bất thường Đã hủy; điền nốt → DONE
  const fixed = results.map((x) => (x.item_key === key('Áp suất khí nén') ? { ...x, value: 7.2 } : x)).concat([{ item_key: key('Rò rỉ dầu, khí, nước'), pass: true }]);
  r = kt.write('check.submit', { run_id: runId, results: fixed }, { expected_version: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.run.status, 'DONE');
  assert.equal(r.data.run.fail_count, 0);
  const abn = env.rows('Abnormals');
  assert.equal(abn.length, 1);
  assert.equal(abn[0].status, 'CANCELLED');
  // Người kiểm khác không sửa được lượt của người khác
  r = kt2.write('check.submit', { run_id: runId, results: fixed }, { expected_version: 2 });
  assert.equal(r.code, 'FORBIDDEN');
  // Ca không thuộc mẫu, ngày quá cũ
  r = kt.write('check.submit', { run_id: uuid(), assignment_id: aid, work_date: '2026-10-28', shift: '4', results });
  assert.equal(r.errors[0].code, 'PERIOD_INVALID');
  r = kt.write('check.submit', { run_id: uuid(), assignment_id: aid, work_date: '2026-10-01', shift: '1', results });
  assert.equal(r.errors[0].code, 'PERIOD_TOO_OLD');
  // Tra cứu không được kiểm
  const c1 = userClient(env, 'TC1', 1, '583922');
  assert.equal(c1.write('check.submit', { run_id: uuid(), assignment_id: aid, work_date: '2026-10-28', shift: '2', results }).code, 'FORBIDDEN');
});

test('hàng chờ offline: check.submit + ảnh qua sync.push, gửi lại cùng mã thao tác không ghi trùng', () => {
  const { env, owner } = setupLinked();
  const { id, res } = makeTemplate(owner, env, { freq: 'DAY', shifts: '' });
  const m7 = env.rows('Machines').find((m) => m.machine_code === 'TB-0007');
  const aid = uuid();
  owner.write('assignment.edit', { assignment_id: aid, machine_id: m7.machine_id, template_id: id });
  const kt = userClient(env, 'KT1', 2, '583920');
  const runId = uuid();
  const k = res.data.items[1].item_key;
  const op = { action: 'check.submit', operation_id: uuid(), expected_version: 0, payload: { run_id: runId, assignment_id: aid, template_revision: 1, work_date: '2026-10-27', shift: '', results: [{ item_key: k, value: 5.4, note: 'Áp thấp' }] } };
  let r = kt.call('sync.push', { op }, { operation_id: op.operation_id, expected_version: 0 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.state, 'COMMITTED');
  r = kt.call('sync.push', { op }, { operation_id: op.operation_id, expected_version: 0 });
  assert.equal(r.code, 'DUPLICATE_OPERATION');
  assert.equal(env.rows('Runs').length, 1);
  const photo = { action: 'doc.upload', operation_id: uuid(), expected_version: 0, payload: { document_id: uuid(), entity_type: 'RUN', entity_id: runId, item_key: k, kind: 'PHOTO_CHECK', mime_type: 'image/jpeg', content_b64: fakeJpegB64() } };
  r = kt.call('sync.push', { op: photo }, { operation_id: photo.operation_id, expected_version: 0 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const docs = env.rows('Documents');
  assert.equal(docs.length, 1);
  assert.equal(docs[0].parent_run_id, runId);
  assert.equal(docs[0].drive_sharing_state, 'LINK_SHARED');
  // Đổi tên máy trong M&E không đổi lịch sử: lượt kiểm vẫn gắn machine_id
  assert.equal(env.rows('Runs')[0].machine_id, 'eq-7');
});

test('Trưởng bộ phận: xử lý bất thường, lý do bỏ sót, xác nhận ngày khóa sửa lượt kiểm', () => {
  const { env, owner } = setupLinked();
  const { id, res } = makeTemplate(owner, env, { freq: 'DAY', shifts: '' });
  const macs = env.rows('Machines');
  const m7 = macs.find((m) => m.machine_code === 'TB-0007'), m8 = macs.find((m) => m.machine_code === 'TB-0008');
  const a7 = uuid(), a8 = uuid();
  owner.write('assignment.edit', { assignment_id: a7, machine_id: m7.machine_id, template_id: id });
  owner.write('assignment.edit', { assignment_id: a8, machine_id: m8.machine_id, template_id: id });
  const kt = userClient(env, 'KT1', 2, '583920');
  const k = res.data.items[1].item_key;
  const runId = uuid();
  let r = kt.write('check.submit', { run_id: runId, assignment_id: a7, template_revision: 1, work_date: '2026-10-27', results: [{ item_key: k, value: 5.4, note: 'Áp thấp' }] });
  assert.equal(r.ok, true);
  const abnId = r.data.abnormals[0].abnormal_id;
  const c3 = userClient(env, 'TBP1', 3, '583923', 'loc-a');
  assert.equal(kt.write('abnormal.resolve', { abnormal_id: abnId, resolution_vi: 'x' }, { expected_version: 1 }).code, 'FORBIDDEN');
  r = c3.write('abnormal.resolve', { abnormal_id: abnId, resolution_vi: 'Thay gioăng van xả, áp lên 6,9 bar' }, { expected_version: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.abnormal.status, 'RESOLVED');
  // Lý do bỏ sót TB-0008 ngày 27
  r = c3.write('missed.reason', { missed_id: uuid(), assignment_id: a8, work_date: '2026-10-27', reason_vi: 'Máy dừng bảo trì' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.missed.period_key, '2026-10-27');
  // Kỳ đã có lượt kiểm thì không ghi lý do bỏ sót
  r = c3.write('missed.reason', { missed_id: uuid(), assignment_id: a7, work_date: '2026-10-27', reason_vi: 'x' });
  assert.equal(r.errors[0].code, 'STATUS_INVALID');
  // Xác nhận ngày cần PIN; chỉ khu vực của mình
  r = c3.write('day.confirm', { work_date: '2026-10-27' });
  assert.equal(r.code, 'REAUTH_REQUIRED');
  c3.pin('583923');
  assert.equal(c3.write('day.confirm', { work_date: '2026-10-27', area_ids: ['loc-b'] }).code, 'FORBIDDEN');
  assert.equal(c3.write('day.confirm', { work_date: '2026-10-30' }).errors[0].code, 'FUTURE_DATE');
  r = c3.write('day.confirm', { work_date: '2026-10-27' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.confirms[0].area_id, 'loc-a');
  assert.equal(r.data.confirms[0].summary_json.runs, 1);
  assert.equal(c3.write('day.confirm', { work_date: '2026-10-27' }).errors[0].code, 'ALREADY_CONFIRMED');
  // Ngày đã xác nhận: người kiểm không sửa được lượt kiểm ngày đó
  r = kt.write('check.submit', { run_id: runId, results: [{ item_key: k, value: 6.5 }] }, { expected_version: 1 });
  assert.equal(r.errors[0].code, 'RUN_LOCKED');
  // Bảng tháng
  r = kt.call('check.month', { machine_id: m7.machine_id, ym: '2026-10' });
  assert.equal(r.ok, true);
  assert.equal(r.data.runs.length, 1);
  assert.equal(r.data.abnormals.length, 1);
  assert.equal(r.data.confirms.length, 1);
});

test('thư viện hạng mục: có sẵn 34 mục; thêm mục mới; Người kiểm không sửa được', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const rows = env.rows('LibraryItems');
  assert.equal(rows.length, 34);
  assert.ok(rows.every((r) => r.builtin && r.name_vi && r.name_zh));
  const id = uuid();
  let r = owner.write('library.edit', { item_id: id, group_key: 'TEMP', name_vi: 'Nhiệt độ hộp số', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 85 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.builtin, false);
  assert.match(r.data.item.name_zh, /\[zh-CN\]/);
  const kt = userClient(env, 'KT1', 2, '583920');
  assert.equal(kt.write('library.edit', { item_id: uuid(), name_vi: 'x', input_type: 'TEXT' }).code, 'FORBIDDEN');
});

test('dữ liệu mẫu THỬ: tạo khu vực, thiết bị, 3 mẫu, gán máy, tài khoản MAU-*; THẬT không chạy', () => {
  const env = freshServer({ now: NOW });
  env.g.dbReset_();
  const out = env.g.seedSample_('SYSTEM');
  assert.equal(out.machines, 5);
  assert.equal(env.rows('Templates').length, 3);
  assert.equal(env.rows('Assignments').length, 5);
  assert.ok(out.temp_pins['MAU-KT']);
  const envThat = freshServer({ envName: 'THAT', now: NOW });
  envThat.g.dbReset_();
  assert.throws(() => envThat.g.seedSample_('SYSTEM'), /THỬ/);
});
