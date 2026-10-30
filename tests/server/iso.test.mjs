// d1.2: bộ mẫu theo biểu ISO cơ điện (BM-CĐ-xx): danh sách, tạo (PIN, không tạo lại), mã biểu mẫu trên mẫu và PDF bảng tháng
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, uuid, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };

test('template.isoList: đủ bộ mẫu, khóa duy nhất, ≤ 60 hạng mục; C2 không xem được', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const d = ok(owner.call('template.isoList', {})).data;
  assert.equal(d.migrated, true);
  assert.equal(d.templates.length, 23);
  const keys = new Set(d.templates.map((t) => t.key));
  assert.equal(keys.size, 23);
  assert.equal(new Set(d.templates.map((t) => t.form_code)).size, 21, '21 biểu, 07-06 và 07-07 mỗi biểu hai mẫu');
  for (const t of d.templates) {
    assert.ok(t.items > 0 && t.items <= 60, t.key);
    assert.ok(env.g.isUuidV4_(t.template_id), t.key);
    assert.equal(t.exists, false);
    assert.ok(['SHIFT', 'DAY', 'WEEK', 'MONTH'].includes(t.frequency), t.key);
    assert.ok(t.name_vi && t.name_zh, t.key);
  }
  const kt = userClient(env, 'KT1', 2, '583920');
  assert.equal(kt.call('template.isoList', {}).code, 'FORBIDDEN');
});

test('template.isoSeed: cần PIN; tạo mẫu kèm mã biểu mẫu, mọi ca; chạy lại không tạo trùng', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  assert.equal(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02'] }).code, 'REAUTH_REQUIRED');
  ok(owner.pin(OWNER_PIN));
  let r = ok(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02', 'BM-CĐ-09-10'] }));
  assert.equal(r.data.created.length, 2);
  const tpls = env.rows('Templates');
  const comp = tpls.find((t) => t.form_code === 'BM-CĐ-07-02');
  assert.ok(comp, 'có mã biểu mẫu');
  assert.match(comp.template_code, /^MS-/);
  assert.equal(comp.frequency, 'SHIFT');
  assert.equal(comp.shifts, env.g.shiftsCfg_().map((s) => String(s.no)).join(','));
  assert.equal(comp.revision, 1);
  assert.equal(comp.active, true);
  const items = env.rows('TemplateItems').filter((x) => x.template_id === comp.template_id);
  assert.ok(items.length > 5);
  assert.deepEqual(items.map((x) => x.step_no), items.map((_, i) => i + 1));
  const choice = items.find((x) => x.input_type === 'CHOICE');
  assert.ok(choice && choice.choices_json.length >= 2);
  const month = tpls.find((t) => t.form_code === 'BM-CĐ-09-10');
  assert.equal(month.frequency, 'MONTH');
  assert.equal(month.shifts, '');
  assert.ok(env.rows('AuditLogs').some((a) => a.action === 'template.isoSeed'));
  // Chạy lại: đã có hết → báo; chọn tất cả → chỉ tạo phần còn lại
  r = owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02'] });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.equal(r.errors[0].code, 'ISO_ALL_EXIST');
  const all = owner.call('template.isoList', {}).data.templates;
  assert.equal(all.filter((t) => t.exists).length, 2);
  r = ok(owner.write('template.isoSeed', { keys: all.map((t) => t.key) }));
  assert.equal(r.data.created.length, 21);
  assert.deepEqual(r.data.skipped.sort(), ['BM-CĐ-07-02', 'BM-CĐ-09-10']);
  assert.equal(env.rows('Templates').length, 23);
  // Mọi hạng mục ba pha có ngưỡng lệch pha; mọi hạng mục số RANGE có min < max
  for (const it of env.rows('TemplateItems')) {
    if (it.input_type === 'THREE_PHASE') assert.ok(it.extra_json && it.extra_json.imb_max > 0, it.name_vi);
    if (it.std_type === 'RANGE') assert.ok(it.std_min < it.std_max, it.name_vi);
  }
  // Mẫu đã ngừng cũng không tạo lại
  ok(owner.write('template.archive', { template_id: comp.template_id, active: false }, { expected_version: 1 }));
  assert.equal(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02'] }).errors[0].code, 'ISO_ALL_EXIST');
  assert.equal(owner.write('template.isoSeed', { keys: ['KHONG-CO'] }).errors[0].code, 'REQUIRED');
});

test('template.edit giữ/sửa form_code; PDF bảng tháng in mã biểu mẫu ở khối thông tin, tiêu đề mẫu và chân trang', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  ok(owner.pin(OWNER_PIN));
  ok(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02'] }));
  const tpl = env.rows('Templates').find((t) => t.form_code === 'BM-CĐ-07-02');
  // Sửa tên không gửi form_code → giữ nguyên
  ok(owner.write('template.edit', { template_id: tpl.template_id, name_vi: 'Máy nén khí – theo ca' }, { expected_version: 1 }));
  assert.equal(env.rows('Templates').find((t) => t.template_id === tpl.template_id).form_code, 'BM-CĐ-07-02');
  let r = owner.write('template.edit', { template_id: tpl.template_id, form_code: 'X'.repeat(41) }, { expected_version: 2 });
  assert.equal(r.errors[0].code, 'FORM_CODE_LONG');
  ok(owner.write('template.edit', { template_id: tpl.template_id, form_code: '  BM-CĐ-07-02/A ' }, { expected_version: 2 }));
  assert.equal(env.rows('Templates').find((t) => t.template_id === tpl.template_id).form_code, 'BM-CĐ-07-02/A');
  // Mẫu mới tự soạn: không có mã biểu mẫu
  const nid = uuid();
  ok(owner.write('template.edit', { template_id: nid, name_vi: 'Mẫu riêng', frequency: 'DAY', items: [{ name_vi: 'A', input_type: 'PASS_FAIL' }] }));
  assert.equal(env.rows('Templates').find((t) => t.template_id === nid).form_code, '');
  // Gán cho một máy rồi in PDF
  const mac = env.rows('Machines')[0];
  ok(owner.write('assignment.add', { template_id: tpl.template_id, machine_ids: [mac.machine_id] }));
  r = ok(owner.call('report.pdf', { machine_id: mac.machine_id, ym: '2026-10', template_id: tpl.template_id, shift: '1' }));
  const doc = [...env.drive._docs.values()].pop();
  assert.match(doc.text(), /Mã biểu mẫu[^:\n]*: BM-CĐ-07-02\/A/);
  assert.match(doc.text(), new RegExp(tpl.template_code + ' · BM-CĐ-07-02/A · '));
  const foot = doc.footer.getText();
  assert.ok(foot.startsWith('BM-CĐ-07-02/A · '), foot);
  // Mẫu không có mã: PDF không có dòng mã biểu mẫu
  ok(owner.write('assignment.add', { template_id: nid, machine_ids: [mac.machine_id] }));
  ok(owner.call('report.pdf', { machine_id: mac.machine_id, ym: '2026-10', template_id: nid }));
  const doc2 = [...env.drive._docs.values()].pop();
  assert.doesNotMatch(doc2.text(), /Mã biểu mẫu/);
});
