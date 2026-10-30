import crypto from 'node:crypto';
import { loadServer } from './gas-mock.mjs';

export const OWNER_CODE = 'NV-001';
export const OWNER_TEMP_PIN = '358024';
export const OWNER_PIN = '604817';
export const APP_VERSION = '1.0.0-d1.2';
export const ME_EXEC = 'https://script.google.com/macros/s/TESTONLY_me_feed_deployment_00000/exec';
export const ME_KEY = 'test-feed-key-0123456789abcdef0123';

export const uuid = () => crypto.randomUUID();

/** Máy chủ đã setup + owner (PIN tạm) */
export function freshServer({ envName = 'THU', now } = {}) {
  const env = loadServer();
  if (now) env.clock.offset = Date.parse(now) - Date.now(); // đồng hồ giả đặt trước setup để PIN tạm của owner còn hạn
  env.props.setProperty('ENV', envName);
  env.g.setup();
  env.props.setProperty('SETUP_OWNER_CODE', OWNER_CODE);
  env.props.setProperty('SETUP_OWNER_NAME', 'Chủ hệ thống');
  env.props.setProperty('SETUP_OWNER_TEMP_PIN', OWNER_TEMP_PIN);
  env.g.adminSetupOwner();
  env.g.dbReset_();
  return env;
}

/** Client giả: giữ device_id, token, epoch */
export function makeClient(env, deviceId = uuid()) {
  const c = {
    deviceId, token: null, reauth: null,
    epoch() { return env.props.getProperty('DATASET_EPOCH'); },
    req(action, payload = {}, extra = {}) {
      return {
        api_contract_version: '1.0', action, payload, device_id: deviceId, app_version: APP_VERSION,
        dataset_epoch: c.epoch(), token: c.token || undefined, reauth_token: c.reauth || undefined, ...extra
      };
    },
    call(action, payload = {}, extra = {}) {
      env.g.dbReset_();
      return env.post(c.req(action, payload, extra));
    },
    write(action, payload = {}, extra = {}) {
      return c.call(action, payload, { operation_id: uuid(), expected_version: 0, ...extra });
    },
    login(code, pin) {
      const r = c.call('auth.login', { employee_code: code, pin, device_label: 'test' });
      if ((r.ok || r.code === 'MUST_CHANGE_PIN') && r.data && r.data.token) c.token = r.data.token;
      return r;
    },
    /** Nhập lại PIN (thao tác cần PIN) */
    pin(pin) {
      const r = c.call('auth.reauth', { pin });
      if (r.ok) c.reauth = r.data.reauth_token;
      return r;
    }
  };
  return c;
}

/** Đăng nhập owner, đổi PIN tạm → phiên FULL */
export function ownerClient(env) {
  const c = makeClient(env);
  const r1 = c.login(OWNER_CODE, OWNER_TEMP_PIN);
  if (r1.code !== 'MUST_CHANGE_PIN') throw new Error('expected MUST_CHANGE_PIN, got ' + r1.code);
  const r2 = c.call('pin.change', { current_pin: OWNER_TEMP_PIN, new_pin: OWNER_PIN });
  if (!r2.ok) throw new Error('pin.change failed ' + JSON.stringify(r2));
  c.token = r2.data.token;
  return c;
}

/** Thêm người dùng trực tiếp (không qua API) */
export function addUser(env, code, level, pin, areaIds = '') {
  const g = env.g;
  g.dbReset_();
  const rec = g.newPinRecord_(pin);
  const uid = uuid();
  const now = g.isoVN_(new env.clock.Date());
  g.withWriteLock_(() => {
    g.insertRows_('Users', [{
      user_id: uid, employee_code: code, display_name: code, email: '', role_level: level, active: true,
      pin_hash: rec.pin_hash, salt: rec.salt, pin_hash_version: rec.pin_hash_version, failed_attempts: 0, locked_until: '',
      created_at: now, updated_at: now, auth_version: 1, is_system_owner: false, must_change_pin: false,
      temp_pin_expires_at: '', pin_changed_at: now, failed_window_started_at: '', last_login_at: '', record_version: 1,
      created_by: 'TEST', updated_by: 'TEST', area_ids: areaIds
    }]);
  });
  g.cache_().remove('users:dir');
  g.dbReset_();
  return uid;
}

export function userClient(env, code, level, pin, areaIds = '') {
  addUser(env, code, level, pin, areaIds);
  const c = makeClient(env);
  const r = c.login(code, pin);
  if (!r.ok) throw new Error('login failed ' + JSON.stringify(r));
  return c;
}

/** JPEG nhỏ hợp lệ về chữ ký byte (FF D8 FF …) */
export function fakeJpegB64(size = 2000) {
  const b = Buffer.alloc(size, 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  return b.toString('base64');
}

export function fakePngB64(size = 1200) {
  const b = Buffer.alloc(size, 9);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  return b.toString('base64');
}

/** Dữ liệu feed.equipment giả của M&E */
export function meFeed({ rev = 'r1', locations, equipment } = {}) {
  return {
    rev,
    locations: locations || [
      { location_id: 'loc-a', location_code: 'KV-A', name_vi: 'Xưởng A', name_zh: 'A车间', parent_location_id: '', active: true },
      { location_id: 'loc-b', location_code: 'KV-B', name_vi: 'Xưởng B', name_zh: 'B车间', parent_location_id: '', active: true }
    ],
    equipment: equipment || [
      { equipment_id: 'eq-7', equipment_code: 'TB-0007', name_vi: 'Máy nén khí 01', name_zh: '空压机01', location_id: 'loc-a', status: 'RUNNING', category_vi: 'Máy nén khí', category_zh: '空压机', model: 'GA30', qr_key: 'ABCDEFGHJKMNPQRSTV01', archived: false },
      { equipment_id: 'eq-8', equipment_code: 'TB-0008', name_vi: 'Máy nén khí 02', name_zh: '空压机02', location_id: 'loc-a', status: 'RUNNING', category_vi: 'Máy nén khí', category_zh: '空压机', model: 'GA30', qr_key: 'ABCDEFGHJKMNPQRSTV02', archived: false },
      { equipment_id: 'eq-31', equipment_code: 'TB-0031', name_vi: 'Chiller 01', name_zh: '冷水机01', location_id: 'loc-b', status: 'RUNNING', category_vi: 'Chiller', category_zh: '冷水机', model: '', qr_key: 'ABCDEFGHJKMNPQRSTV31', archived: false }
    ]
  };
}

/** Nối máy chủ giả với "M&E" trả feed; trả hàm đổi feed */
export function linkMe(env, feed = meFeed()) {
  const state = { feed, calls: 0 };
  env.urlFetch.handler = (url, o) => {
    state.calls++;
    const body = JSON.parse(o.payload);
    if (url !== ME_EXEC || body.action !== 'feed.equipment') return { code: 404, body: { ok: false, code: 'NOT_FOUND' } };
    if (body.payload.key !== ME_KEY) return { ok: false, code: 'FORBIDDEN' };
    if (body.payload.since_rev && body.payload.since_rev === state.feed.rev) return { ok: true, code: 'OK', data: { unchanged: true, rev: state.feed.rev } };
    return { ok: true, code: 'OK', data: state.feed };
  };
  env.props.setProperty('ME_EXEC_URL', ME_EXEC);
  env.props.setProperty('ME_FEED_KEY', ME_KEY);
  return state;
}
