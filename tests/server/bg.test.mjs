// Ảnh nền màn đăng nhập / trang chủ (29_bg.js, chép từ ISO 1.0.0-d3.3; người dùng yêu cầu 12/11/2026): Quản trị (cấp 4, PIN) tải ảnh lên
// hoặc dùng lại ảnh mặc định; mọi người đã đăng nhập lấy ảnh (bg.get); cài đặt bg_<ô>_rev gửi xuống app, ID tệp không gửi; tệp cũ vào
// thùng rác; nhật ký; Trạng thái hệ thống; không sửa tay ở Cấu hình.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshServer, ownerClient, userClient, fakeJpegB64, fakePngB64, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-11-12T08:00:00+07:00';
const fields = (r) => (r.errors || []).map((e) => e.field + ':' + e.code).sort();

test('ảnh nền: quyền + PIN, kiểm tệp, lưu / lấy / thay / dùng lại ảnh mặc định; cài đặt gửi xuống app; nhật ký; Trạng thái hệ thống', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const g = env.g;
  const lead = userClient(env, 'TBP1', 3, '583920');
  const viewer = userClient(env, 'XEM1', 1, '583921');
  const jpg = fakeJpegB64(5000);
  // Chưa có ảnh riêng
  let r = viewer.call('bg.get', { slot: 'LOGIN' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.data, { slot: 'LOGIN', rev: '' });
  assert.deepEqual(fields(viewer.call('bg.get', { slot: 'XX' })), ['slot:INVALID_VALUE']);
  // Trưởng bộ phận cấp 3 không thay được; Quản trị chưa nhập PIN → hỏi PIN
  assert.equal(lead.write('bg.set', { slot: 'LOGIN', content_b64: jpg, mime_type: 'image/jpeg' }).code, 'FORBIDDEN');
  assert.equal(owner.write('bg.set', { slot: 'LOGIN', content_b64: jpg, mime_type: 'image/jpeg' }).code, 'REAUTH_REQUIRED');
  assert.equal(owner.pin(OWNER_PIN).ok, true);
  // Kiểm tệp: loại, nội dung không đúng loại, quá 2 MB, ô lạ
  assert.deepEqual(fields(owner.write('bg.set', { slot: 'LOGIN', content_b64: jpg, mime_type: 'image/gif' })), ['mime_type:FILE_TYPE']);
  assert.deepEqual(fields(owner.write('bg.set', { slot: 'LOGIN', content_b64: fakePngB64(), mime_type: 'image/jpeg' })), ['mime_type:FILE_TYPE']);
  assert.deepEqual(fields(owner.write('bg.set', { slot: 'LOGIN', content_b64: fakeJpegB64(2 * 1048576 + 10), mime_type: 'image/jpeg' })), ['content_b64:FILE_TOO_LARGE']);
  assert.deepEqual(fields(owner.write('bg.set', { slot: 'HOMEPAGE', content_b64: jpg, mime_type: 'image/jpeg' })), ['slot:INVALID_VALUE']);
  // Lưu ảnh màn đăng nhập
  const rev0 = Number(g.stateGet_(g.readState_(), 'settings_rev', 0));
  r = owner.write('bg.set', { slot: 'LOGIN', content_b64: jpg, mime_type: 'image/jpeg' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rev1 = r.data.rev;
  assert.equal(rev1.length, 16);
  g.dbReset_();
  assert.ok(Number(g.stateGet_(g.readState_(), 'settings_rev', 0)) > rev0, 'app tải lại cài đặt');
  const id1 = g.setting_('bg_login_file_id');
  assert.ok(id1);
  // Người dùng cấp 1 lấy được ảnh; cài đặt gửi xuống app có rev, không có ID tệp
  r = viewer.call('bg.get', { slot: 'LOGIN' });
  assert.equal(r.data.rev, rev1);
  assert.equal(r.data.mime_type, 'image/jpeg');
  assert.equal(r.data.content_b64, jpg);
  const st = viewer.call('sync.bootstrap', {}).data.settings;
  assert.equal(st.bg_login_rev, rev1);
  assert.equal(st.bg_home_rev, '');
  assert.ok(!('bg_login_file_id' in st));
  // Cùng ảnh: không tạo tệp mới
  r = owner.write('bg.set', { slot: 'LOGIN', content_b64: jpg, mime_type: 'image/jpeg' });
  assert.equal(r.data.rev, rev1);
  g.dbReset_();
  assert.equal(g.setting_('bg_login_file_id'), id1);
  // Thay ảnh khác: tệp cũ vào thùng rác
  r = owner.write('bg.set', { slot: 'LOGIN', content_b64: fakeJpegB64(7000), mime_type: 'image/jpeg' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.notEqual(r.data.rev, rev1);
  assert.equal(env.drive.getFileById(id1).isTrashed(), true);
  // Ảnh trang chủ riêng; Trạng thái hệ thống
  assert.equal(owner.write('bg.set', { slot: 'HOME', content_b64: fakeJpegB64(6000), mime_type: 'image/jpeg' }).ok, true);
  let h = owner.call('system.status', {}).data.checks.find((x) => x.key === 'bg');
  assert.equal(h.value, 'Đăng nhập: ảnh riêng · Trang chủ: ảnh riêng');
  // Dùng lại ảnh mặc định
  const id2 = (g.dbReset_(), g.setting_('bg_login_file_id'));
  r = owner.write('bg.set', { slot: 'LOGIN', remove: true });
  assert.deepEqual(r.data, { slot: 'LOGIN', rev: '' });
  assert.equal(env.drive.getFileById(id2).isTrashed(), true);
  assert.deepEqual(viewer.call('bg.get', { slot: 'LOGIN' }).data, { slot: 'LOGIN', rev: '' });
  assert.equal(viewer.call('sync.bootstrap', {}).data.settings.bg_login_rev, '');
  h = owner.call('system.status', {}).data.checks.find((x) => x.key === 'bg');
  assert.equal(h.value, 'Đăng nhập: ảnh mặc định · Trang chủ: ảnh riêng');
  // Bỏ lần nữa: không ghi gì
  assert.equal(owner.write('bg.set', { slot: 'LOGIN', remove: true }).ok, true);
  // Nhật ký: 4 lần đổi (lưu, thay, trang chủ, bỏ), Trưởng bộ phận không thấy (thao tác quản trị); Cấu hình không sửa tay
  g.dbReset_();
  assert.equal(g.readRows_('AuditLogs').filter((l) => l.action === 'bg.set').length, 4);
  assert.equal(owner.call('audit.view', { action: 'bg.' }).data.items.length, 4);
  assert.equal(lead.call('audit.view', { action: 'bg.' }).data.items.length, 0);
  assert.deepEqual(fields(owner.write('settings.edit', { changes: { bg_home_rev: 'abc' } })), ['bg_home_rev:INVALID_VALUE']);
});

test('máy chủ đang ở bản d1.4 (Settings chưa có dòng bg_*): dán Code.gs mới, chưa chạy migrateSchema vẫn thay ảnh được; migrateSchema thêm dòng cài đặt, không ghi đè', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const g = env.g;
  g.dbReset_();
  const rows = g.readRows_('Settings').filter((r) => /^bg_/.test(r.setting_key)).map((r) => r.__row).sort((a, b) => b - a);
  assert.equal(rows.length, 4);
  rows.forEach((n) => g.sh_('Settings').deleteRow(n));
  g.cache_().remove('cfg:settings');
  g.dbReset_();
  assert.equal(g.readRows_('Settings').filter((r) => /^bg_/.test(r.setting_key)).length, 0);
  assert.equal(owner.call('sync.bootstrap', {}).data.settings.bg_login_rev, '', 'mặc định khi chưa có dòng');
  assert.equal(owner.pin(OWNER_PIN).ok, true);
  const r = owner.write('bg.set', { slot: 'HOME', content_b64: fakeJpegB64(4000), mime_type: 'image/jpeg' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(owner.call('sync.bootstrap', {}).data.settings.bg_home_rev, r.data.rev);
  env.logs.length = 0;
  g.migrateSchema();
  assert.ok(env.logs.some((l) => /^migrateSchema xong\. Thêm: không có\./.test(l)), env.logs.join('\n'));
  g.dbReset_();
  assert.equal(g.readRows_('Settings').filter((x) => /^bg_/.test(x.setting_key)).length, 4);
  assert.equal(g.setting_('bg_home_rev'), r.data.rev, 'migrateSchema không ghi đè ảnh đã đặt');
});
