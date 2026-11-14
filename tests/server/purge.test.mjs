// d1.5: xóa hẳn mẫu — chưa có lượt kiểm: Trưởng bộ phận/Quản trị (PIN); đã có lượt kiểm: chỉ owner, gõ XÓA, số đếm khớp (PIN).
// Xóa mẫu, hạng mục, gán máy, lượt kiểm, bất thường, lý do bỏ sót, ảnh; mẫu khác không đổi; mã MS không cấp lại; app tự tải lại.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, linkMe, uuid, fakeJpegB64, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };
const C3_PIN = '583923';

function libItems(env) {
  const rows = env.rows('LibraryItems');
  const f = ['group_key', 'name_vi', 'name_zh', 'input_type', 'unit', 'std_type', 'std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json'];
  return ['Nhiệt độ dầu', 'Áp suất khí nén', 'Mức dầu'].map((n) => {
    const li = rows.find((r) => r.name_vi === n);
    const o = { library_item_id: li.item_id };
    f.forEach((k) => { if (li[k] !== null && li[k] !== '' && li[k] !== undefined) o[k] = li[k]; });
    return o;
  });
}

/** Ba mẫu theo ngày: A có lượt kiểm (bất thường, ảnh) + lý do bỏ sót, B chỉ gán máy, C có lượt kiểm (không được đụng) */
function setup() {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  const items = libItems(env);
  const mk = (name) => {
    const id = uuid();
    const r = ok(owner.write('template.edit', { template_id: id, name_vi: name, frequency: 'DAY', items }));
    return { id, code: r.data.template.template_code, keys: r.data.items.map((x) => x.item_key) };
  };
  const A = mk('Mẫu A'), B = mk('Mẫu B'), C = mk('Mẫu C');
  // Sửa A một lần → 2 phiên bản hạng mục (xóa hết mọi phiên bản)
  ok(owner.write('template.edit', { template_id: A.id, items: items.slice(0, 2) }, { expected_version: 1 }));
  const macs = env.rows('Machines');
  const m7 = macs.find((m) => m.machine_code === 'TB-0007'), m8 = macs.find((m) => m.machine_code === 'TB-0008');
  const asg = (tpl, mac) => { const aid = uuid(); ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: tpl.id })); return aid; };
  const a7 = asg(A, m7), a8 = asg(A, m8), b7 = asg(B, m7), c7 = asg(C, m7);
  const kt = userClient(env, 'KT1', 2, '583920');
  const runA = uuid();
  const keyA = env.rows('TemplateItems').find((x) => x.template_id === A.id && x.revision === 2 && x.step_no === 2).item_key;
  const r1 = ok(kt.write('check.submit', { run_id: runA, assignment_id: a7, template_revision: 2, work_date: '2026-10-27', results: [{ item_key: keyA, value: 5.4, note: 'Áp thấp' }] }));
  assert.equal(r1.data.abnormals.length, 1);
  ok(kt.write('doc.upload', { document_id: uuid(), entity_type: 'RUN', entity_id: runA, item_key: keyA, kind: 'PHOTO_CHECK', mime_type: 'image/jpeg', content_b64: fakeJpegB64(), thumb_b64: fakeJpegB64(500) }));
  ok(kt.write('check.submit', { run_id: uuid(), assignment_id: a7, template_revision: 2, work_date: '2026-10-28', results: [{ item_key: keyA, value: 7 }] }));
  const runC = uuid();
  ok(kt.write('check.submit', { run_id: runC, assignment_id: c7, template_revision: 1, work_date: '2026-10-27', results: [{ item_key: C.keys[1], value: 5.4, note: 'Áp thấp C' }] }));
  ok(kt.write('doc.upload', { document_id: uuid(), entity_type: 'RUN', entity_id: runC, item_key: C.keys[1], kind: 'PHOTO_CHECK', mime_type: 'image/jpeg', content_b64: fakeJpegB64() }));
  const c3 = userClient(env, 'TBP1', 3, C3_PIN);
  ok(c3.write('missed.reason', { missed_id: uuid(), assignment_id: a8, work_date: '2026-10-27', reason_vi: 'Máy dừng bảo trì' }));
  return { env, owner, kt, c3, A, B, C, a7, a8, b7, c7, runA, runC, keyA };
}

const byTpl = (env, sheet, id) => env.rows(sheet).filter((r) => r.template_id === id).length;
const expectOf = (info) => Object.fromEntries(info.templates.map((t) => [t.template_id, { runs: t.runs, abnormals: t.abnormals, missed: t.missed, documents: t.documents }]));

test('template.purgeInfo: đếm đúng từng mẫu, biết ai được xóa và lần sao lưu gần nhất', () => {
  const { env, owner, kt, c3, A, B } = setup();
  assert.equal(kt.call('template.purgeInfo', { template_ids: [A.id] }).code, 'FORBIDDEN', 'Người kiểm không xem/xóa mẫu');
  const d = ok(c3.call('template.purgeInfo', { template_ids: [A.id, B.id] })).data;
  assert.equal(d.is_owner, false);
  assert.equal(ok(owner.call('template.purgeInfo', { template_ids: [A.id] })).data.is_owner, true);
  assert.ok('last_backup_at' in d && 'last_backup_status' in d);
  const [a, b] = d.templates;
  assert.equal(a.template_code, A.code);
  assert.deepEqual([a.items, a.assignments, a.assignments_active, a.runs, a.abnormals, a.abnormals_open, a.missed, a.documents, a.has_history],
    [5, 2, 2, 2, 1, 1, 1, 1, true], 'A: 3 + 2 hạng mục (2 phiên bản), 2 gán, 2 lượt, 1 bất thường, 1 lý do bỏ sót, 1 ảnh');
  assert.deepEqual([a.first_date, a.last_date], ['2026-10-27', '2026-10-28']);
  assert.deepEqual([b.items, b.assignments, b.runs, b.missed, b.has_history], [3, 1, 0, 0, false]);
  assert.equal(c3.call('template.purgeInfo', { template_ids: [uuid()] }).code, 'NOT_FOUND');
  assert.equal(c3.call('template.purgeInfo', { template_ids: [] }).code, 'VALIDATION_ERROR');
  assert.equal(c3.call('template.purgeInfo', { template_ids: [A.id, A.id] }).code, 'VALIDATION_ERROR');
  void env;
});

test('mẫu chưa có lượt kiểm: Trưởng bộ phận xóa hẳn được (PIN) — mẫu, hạng mục, gán máy; mẫu khác giữ nguyên', () => {
  const { env, c3, kt, A, B, C } = setup();
  const before = { tpl: env.rows('Templates').length, runs: env.rows('Runs').length };
  assert.equal(kt.write('template.purge', { template_ids: [B.id] }).code, 'FORBIDDEN');
  assert.equal(c3.write('template.purge', { template_ids: [B.id] }).code, 'REAUTH_REQUIRED');
  ok(c3.pin(C3_PIN));
  const r = ok(c3.write('template.purge', { template_ids: [B.id] }));
  assert.deepEqual(r.data.purged, [{ template_id: B.id, template_code: B.code }]);
  assert.deepEqual(r.data.counts, { templates: 1, items: 3, assignments: 1, runs: 0, abnormals: 0, missed: 0, documents: 0 });
  assert.equal(byTpl(env, 'Templates', B.id), 0);
  assert.equal(byTpl(env, 'TemplateItems', B.id), 0);
  assert.equal(byTpl(env, 'Assignments', B.id), 0);
  assert.equal(env.rows('Templates').length, before.tpl - 1);
  assert.equal(env.rows('Runs').length, before.runs, 'không đụng lượt kiểm mẫu khác');
  for (const t of [A, C]) {
    assert.equal(byTpl(env, 'Templates', t.id), 1);
    assert.ok(byTpl(env, 'TemplateItems', t.id) > 0);
  }
  const audit = env.rows('AuditLogs').find((x) => x.action === 'template.purge');
  assert.equal(audit.entity_id, B.id);
  assert.equal(audit.reason, 'PURGE');
  assert.equal(audit.before_json.templates[0].c, B.code);
  // Xóa lại mẫu đã xóa → không còn
  assert.equal(c3.write('template.purge', { template_ids: [B.id] }).code, 'NOT_FOUND');
});

test('mẫu đã có lượt kiểm: chỉ owner, phải gõ XÓA và số đếm khớp; xóa lượt kiểm, bất thường, lý do bỏ sót, ảnh (Drive vào thùng rác)', () => {
  const { env, owner, c3, kt, A, C, a7, runA, runC, keyA } = setup();
  ok(c3.pin(C3_PIN));
  const info = ok(owner.call('template.purgeInfo', { template_ids: [A.id] })).data;
  let r = c3.write('template.purge', { template_ids: [A.id], confirm_text: 'XÓA', expect: expectOf(info) });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.equal(r.errors[0].code, 'PURGE_OWNER_ONLY');
  assert.equal(byTpl(env, 'Runs', A.id), 2, 'không xóa gì');
  ok(owner.pin(OWNER_PIN));
  r = owner.write('template.purge', { template_ids: [A.id], expect: expectOf(info) });
  assert.equal(r.errors[0].code, 'CONFIRM_TEXT');
  r = owner.write('template.purge', { template_ids: [A.id], confirm_text: 'xoa nhe', expect: expectOf(info) });
  assert.equal(r.errors[0].code, 'CONFIRM_TEXT');
  // Có người vừa kiểm thêm sau khi xem → số đếm lệch → xem lại
  r = owner.write('template.purge', { template_ids: [A.id], confirm_text: 'XÓA', expect: { [A.id]: { runs: 1, abnormals: 1, missed: 1, documents: 1 } } });
  assert.equal(r.errors[0].code, 'PURGE_COUNTS_CHANGED');
  assert.equal(r.data.templates[0].runs, 2, 'gửi kèm số đếm mới');
  assert.equal(byTpl(env, 'Runs', A.id), 2);

  const docA = env.rows('Documents').find((d) => d.parent_run_id === runA);
  const docC = env.rows('Documents').find((d) => d.parent_run_id === runC);
  const cBefore = { runs: byTpl(env, 'Runs', C.id), abn: byTpl(env, 'Abnormals', C.id), items: byTpl(env, 'TemplateItems', C.id), asg: byTpl(env, 'Assignments', C.id) };
  const cur0 = Number(ok(owner.call('sync.changes', { cursor: 0 })).data.next_cursor);
  const rev0 = ok(owner.call('sync.changes', { cursor: cur0 })).data.settings_rev;
  const opId = uuid();
  r = ok(owner.call('template.purge', { template_ids: [A.id], confirm_text: 'xóa', expect: expectOf(info) }, { operation_id: opId, expected_version: 0 }));
  assert.deepEqual(r.data.counts, { templates: 1, items: 5, assignments: 2, runs: 2, abnormals: 1, missed: 1, documents: 1 });
  assert.equal(r.data.files_trashed, 2, 'ảnh + ảnh nhỏ');
  for (const s of ['Templates', 'TemplateItems', 'Assignments', 'Runs', 'Abnormals', 'MissedReasons']) assert.equal(byTpl(env, s, A.id), 0, s);
  assert.equal(env.rows('Documents').filter((d) => d.parent_run_id === runA).length, 0);
  assert.equal(env.drive._files.get(docA.drive_file_id).trashed, true);
  assert.equal(env.drive._files.get(docA.thumb_drive_file_id).trashed, true);
  // Mẫu C không đổi
  assert.deepEqual({ runs: byTpl(env, 'Runs', C.id), abn: byTpl(env, 'Abnormals', C.id), items: byTpl(env, 'TemplateItems', C.id), asg: byTpl(env, 'Assignments', C.id) }, cBefore);
  assert.equal(env.drive._files.get(docC.drive_file_id).trashed, false);
  assert.ok(env.rows('Documents').some((d) => d.parent_run_id === runC));
  // Gửi lại đúng thao tác: không xóa thêm, trả kết quả cũ
  r = owner.call('template.purge', { template_ids: [A.id], confirm_text: 'xóa', expect: expectOf(info) }, { operation_id: opId, expected_version: 0 });
  assert.equal(r.code, 'DUPLICATE_OPERATION');
  // Điện thoại: lần lấy thay đổi tới thấy settings_rev đổi → app tải lại toàn bộ (bootstrap không còn mẫu A)
  const ch = ok(kt.call('sync.changes', { cursor: cur0 })).data;
  assert.notEqual(ch.settings_rev, rev0);
  const boot = ok(kt.call('sync.bootstrap', {})).data;
  assert.ok(!boot.records.TEMPLATE.some((t) => t.template_id === A.id));
  assert.ok(!(boot.records.ASSIGNMENT || []).some((a) => a.template_id === A.id));
  assert.ok(!(boot.records.RUN || []).some((x) => x.template_id === A.id));
  assert.ok(boot.records.TEMPLATE.some((t) => t.template_id === C.id));
  // Lượt kiểm còn trong hàng chờ của máy đang offline → bị từ chối (không sinh dòng mồ côi)
  r = kt.write('check.submit', { run_id: uuid(), assignment_id: a7, template_revision: 2, work_date: '2026-10-28', results: [{ item_key: keyA, value: 7 }] });
  assert.equal(r.errors[0].code, 'NOT_ASSIGNED');
  assert.equal(byTpl(env, 'Runs', A.id), 0);
});

test('xóa nhiều mẫu một lần (9 mẫu hằng ngày đang chạy thử); mã MS đã xóa không cấp lại; bộ mẫu soạn sẵn tạo lại được', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  ok(owner.pin(OWNER_PIN));
  ok(owner.write('template.isoSeed', { set: 'DAILY', keys: ['HN-01', 'HN-02', 'HN-03', 'HN-04', 'HN-05', 'HN-06', 'HN-07'] }));
  const items = libItems(env);
  for (const n of ['Mẫu 8', 'Mẫu 9', 'Mẫu 10']) ok(owner.write('template.edit', { template_id: uuid(), name_vi: n, frequency: 'DAY', items }));
  const tpls = env.rows('Templates').sort((a, b) => a.template_code.localeCompare(b.template_code));
  assert.deepEqual(tpls.map((t) => t.template_code), ['MS-0001', 'MS-0002', 'MS-0003', 'MS-0004', 'MS-0005', 'MS-0006', 'MS-0007', 'MS-0008', 'MS-0009', 'MS-0010']);
  const nine = tpls.slice(0, 9);
  const info = ok(owner.call('template.purgeInfo', { template_ids: nine.map((t) => t.template_id) })).data;
  assert.equal(info.templates.length, 9);
  const r = ok(owner.write('template.purge', { template_ids: nine.map((t) => t.template_id), expect: expectOf(info) }));
  assert.equal(r.data.purged.length, 9);
  assert.deepEqual(env.rows('Templates').map((t) => t.template_code), ['MS-0010'], 'chỉ còn mẫu MS-0010');
  const left = env.rows('TemplateItems');
  assert.ok(left.length > 0 && left.every((x) => x.template_id === tpls[9].template_id));
  // Mẫu mới: MS-0011 (không dùng lại MS-0001…0009)
  const n = ok(owner.write('template.edit', { template_id: uuid(), name_vi: 'Mẫu mới', frequency: 'DAY', items }));
  assert.equal(n.data.template.template_code, 'MS-0011');
  // Bộ mẫu hằng ngày tạo lại được (id cố định), mã mới
  const list = ok(owner.call('template.isoList', { set: 'DAILY' })).data.templates;
  assert.ok(list.every((t) => !t.exists));
  const re = ok(owner.write('template.isoSeed', { set: 'DAILY', keys: ['HN-01'] }));
  assert.equal(re.data.created.length, 1);
  assert.equal(env.rows('Templates').find((t) => t.template_id === env.g.isoUuid_('HN-01')).template_code, 'MS-0012');
});

test('deleteWhere_: bảng đầy tới dòng cuối vẫn xóa được hết; dòng xen kẽ xóa đúng', () => {
  const env = freshServer({ now: NOW });
  const g = env.g;
  g.dbReset_();
  const rows = Array.from({ length: 6 }, (_, i) => ({ glossary_id: uuid(), term_vi: 'T' + i, term_zh: i % 2 ? 'odd' : 'even', note: '', active: true }));
  g.withWriteLock_(() => g.insertRows_('Glossary', rows));
  const sheet = g.sh_('Glossary');
  sheet._maxRows = sheet.getLastRow(); // không còn dòng trống ở cuối
  g.withWriteLock_(() => assert.equal(g.deleteWhere_('Glossary', 'term_zh', ['odd']), 3));
  assert.deepEqual(env.rows('Glossary').map((r) => r.term_vi), ['T0', 'T2', 'T4']);
  g.dbReset_();
  g.sh_('Glossary')._maxRows = g.sh_('Glossary').getLastRow();
  g.withWriteLock_(() => assert.equal(g.deleteWhere_('Glossary', 'term_zh', ['even']), 3));
  assert.deepEqual(env.rows('Glossary'), []);
  g.withWriteLock_(() => g.insertRows_('Glossary', [{ glossary_id: uuid(), term_vi: 'Mới', term_zh: 'x', note: '', active: true }]));
  assert.deepEqual(env.rows('Glossary').map((r) => r.term_vi), ['Mới']);
});
