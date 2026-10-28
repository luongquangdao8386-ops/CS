// Đăng nhập, người dùng (khu vực phụ trách), logo + PDF báo cáo, cấu hình ca, trạng thái hệ thống
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, makeClient, linkMe, uuid, fakePngB64, OWNER_PIN, OWNER_CODE } from '../helpers.mjs';

const NOW = '2026-10-28T08:00:00+07:00';

test('đăng nhập: PIN tạm phải đổi, sai 5 lần khóa, PIN yếu bị từ chối', () => {
  const env = freshServer({ now: NOW });
  const c = makeClient(env);
  assert.equal(c.login(OWNER_CODE, '358024').code, 'MUST_CHANGE_PIN');
  assert.equal(c.call('sync.bootstrap', {}).code, 'MUST_CHANGE_PIN');
  const weak = c.call('pin.change', { current_pin: '358024', new_pin: '123456' });
  assert.equal(weak.errors[0].code, 'PIN_WEAK');
  const ok = c.call('pin.change', { current_pin: '358024', new_pin: OWNER_PIN });
  assert.equal(ok.ok, true);
  const d = makeClient(env);
  for (let i = 0; i < 4; i++) assert.equal(d.login(OWNER_CODE, '111222').code, 'AUTH_FAILED');
  assert.equal(d.login(OWNER_CODE, '111222').code, 'PIN_LOCKED');
});

test('người dùng: tạo với khu vực, PIN tạm trả một lần; đổi cấp thu hồi phiên; không khóa Quản trị cuối cùng', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  owner.pin(OWNER_PIN);
  const uid = uuid();
  let r = owner.write('user.create', { user_id: uid, employee_code: 'nv0012', display_name: 'Nguyễn Văn A', role_level: 2, area_ids: ['loc-a'] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.data.temp_pin, /^\d{6}$/);
  r = owner.call('user.view', {});
  const u = r.data.items.find((x) => x.user_id === uid);
  assert.equal(u.employee_code, 'NV0012');
  assert.deepEqual(u.area_ids, ['loc-a']);
  r = owner.write('user.create', { user_id: uuid(), employee_code: 'NV0013', display_name: 'B', role_level: 2, area_ids: ['khong-co'] });
  assert.equal(r.errors[0].code, 'NOT_FOUND');
  r = owner.write('user.setRole', { user_id: uid, role_level: 3, area_ids: [] }, { expected_version: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const ownerRow = env.rows('Users').find((x) => x.is_system_owner);
  r = owner.write('user.lock', { user_id: ownerRow.user_id, reason: 'x' }, { expected_version: ownerRow.record_version });
  assert.equal(r.errors[0].code, 'SELF_ACTION');
  // Bootstrap gửi khu vực của người dùng
  const kt = userClient(env, 'KT9', 2, '583920', 'loc-a,loc-b');
  const b = kt.call('sync.bootstrap', {});
  assert.deepEqual(b.data.user.area_ids, ['loc-a', 'loc-b']);
  assert.ok(b.data.permissions.actions.includes('check.submit'));
  assert.ok(!b.data.permissions.actions.includes('template.edit'));
  assert.ok(Array.isArray(b.data.settings.shifts_json));
});

test('cấu hình ca: kiểm giờ HH:MM, không trùng số ca; đổi xong app nhận settings_rev mới', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  owner.pin(OWNER_PIN);
  let r = owner.write('settings.edit', { changes: { shifts_json: [{ no: 1, start: '25:00', end: '14:00' }] } });
  assert.equal(r.errors[0].code, 'SHIFTS_INVALID');
  const before = owner.call('sync.changes', { cursor: 0 }).data.settings_rev;
  r = owner.write('settings.edit', { changes: { shifts_json: [{ no: 1, start: '07:00', end: '19:00' }, { no: 2, start: '19:00', end: '07:00' }] } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = owner.call('sync.changes', { cursor: 0 }).data;
  assert.ok(after.settings_rev > before);
  env.g.dbReset_();
  const at = env.g.shiftAt_(new env.clock.Date('2026-10-29T03:00:00+07:00'));
  assert.deepEqual({ ...at }, { work_date: '2026-10-28', shift: '2' });
});

test('logo báo cáo + PDF bảng tháng của máy (logo đầu trang, bảng ca, bất thường, khối ký)', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  owner.pin(OWNER_PIN);
  let r = owner.write('report.logo.set', { mime_type: 'image/png', content_b64: fakePngB64() });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.rev);
  const kt = userClient(env, 'KT1', 2, '583920');
  assert.equal(kt.write('report.logo.set', { mime_type: 'image/png', content_b64: fakePngB64() }).code, 'FORBIDDEN');
  assert.equal(kt.call('report.logo.get', {}).data.rev, r.data.rev);
  // Một lượt kiểm có mục Không đạt
  const asg = env.rows('Assignments'), tpls = env.rows('Templates'), macs = env.rows('Machines');
  const tpl = tpls.find((t) => t.frequency === 'SHIFT');
  const a = asg.find((x) => x.template_id === tpl.template_id);
  const items = env.rows('TemplateItems').filter((x) => x.template_id === tpl.template_id);
  const press = items.find((x) => x.name_vi === 'Áp suất khí nén');
  r = kt.write('check.submit', { run_id: uuid(), assignment_id: a.assignment_id, template_revision: 1, work_date: '2026-10-28', shift: '1', results: [{ item_key: press.item_key, value: 5.4, note: 'Áp thấp' }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  r = kt.call('report.pdf', { machine_id: a.machine_id, ym: '2026-10', shift: '1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.data.report_code, /^BC-2610-001$/);
  assert.ok(r.data.content_b64.length > 10);
  const doc = [...env.drive._docs.values()].pop();
  const text = doc.text();
  assert.match(text, /PHIẾU KIỂM TRA THIẾT BỊ/);
  assert.match(text, /5,4/);
  assert.match(text, /Ký, ghi rõ họ tên/);
  assert.ok(doc.header, 'có đầu trang logo');
  const mac = macs.find((m) => m.machine_id === a.machine_id);
  assert.match(r.data.file_name, new RegExp(mac.machine_code));
});

test('system.status: kết nối M&E, trigger, thiết bị', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  let r = owner.call('system.status', {});
  assert.equal(r.ok, true);
  assert.equal(r.data.checks.find((x) => x.key === 'me_link').status, 'WARN');
  assert.equal(r.data.checks.find((x) => x.key === 'triggers').status, 'OK');
  linkMe(env);
  env.g.dbReset_();
  env.g.syncMachines_(true);
  r = owner.call('system.status', {});
  assert.equal(r.data.checks.find((x) => x.key === 'me_link').status, 'OK');
  assert.equal(r.data.me_link.linked, true);
});
