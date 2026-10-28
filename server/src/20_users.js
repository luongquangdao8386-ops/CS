/* 20_users: quản trị người dùng (lấy từ M&E; thay vai trò con bằng khu vực phụ trách).
 * Giới hạn: không thao tác lên chính mình; không thao tác lên owner trừ khi người làm là owner;
 * không hạ cấp/khóa cấp 4 cuối cùng còn active; mọi thay đổi tăng auth_version, trừ user.unlock.
 * PIN tạm chỉ trả một lần trong phản hồi: không ghi Operations.result_json/intent, AuditLogs, log. */

var EMP_CODE_RE_ = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;
var EMAIL_RE_ = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Bản ghi người dùng gửi client: không bao giờ có pin_hash/salt; C3 không thấy email, lịch sử đăng nhập */
function projectUser_(ctx, u, sessionsByUser) {
  var t = now_().getTime();
  var lu = parseTime_(u.locked_until);
  var o = {
    user_id: u.user_id, employee_code: u.employee_code, display_name: u.display_name, role_level: Number(u.role_level),
    area_ids: areaList_(u.area_ids), active: !!u.active, is_system_owner: !!u.is_system_owner,
    pin_locked: !!(lu && lu.getTime() > t), locked_until: lu && lu.getTime() > t ? u.locked_until : '',
    must_change_pin: !!u.must_change_pin, temp_pin_expires_at: u.must_change_pin ? u.temp_pin_expires_at : '',
    record_version: u.record_version || 1, created_at: u.created_at, updated_at: u.updated_at
  };
  if (Number(ctx.user.role_level) >= 4) {
    o.email = u.email || '';
    o.last_login_at = u.last_login_at || '';
    o.pin_changed_at = u.pin_changed_at || '';
    o.active_sessions = sessionsByUser ? (sessionsByUser[u.user_id] || 0) : undefined;
  }
  return o;
}

function userView_(ctx) {
  var sess = null;
  if (Number(ctx.user.role_level) >= 4) {
    sess = {};
    var t = now_().getTime();
    readRows_('Sessions').forEach(function (s) {
      if (s.session_kind === 'FULL' && isSessionActive_(s, t)) sess[s.user_id] = (sess[s.user_id] || 0) + 1;
    });
  }
  var items = readRows_('Users').map(function (u) { return projectUser_(ctx, u, sess); });
  items.sort(function (a, b) { return String(a.employee_code).localeCompare(String(b.employee_code)); });
  return { items: items, me: ctx.user.user_id };
}

/** Kiểm cấp và khu vực phụ trách. Trả chuỗi area_ids đã chuẩn hóa (rỗng = mọi khu vực) */
function validateRole_(p, errs) {
  var lvl = Number(p.role_level);
  if (!(lvl >= 1 && lvl <= 4 && Math.floor(lvl) === lvl)) { errs.push(fieldError_('role_level', 'INVALID_VALUE')); return ''; }
  var list = Array.isArray(p.area_ids) ? p.area_ids.map(String) : areaList_(p.area_ids);
  var have = {};
  readRows_('Areas').forEach(function (a) { have[a.area_id] = true; });
  var out = [];
  list.forEach(function (a) {
    if (!have[a]) errs.push(fieldError_('area_ids', 'NOT_FOUND'));
    else if (out.indexOf(a) < 0) out.push(a);
  });
  return out.join(',');
}

/** Người đích của thao tác quản trị: tồn tại, không phải mình, owner chỉ owner thao tác */
function adminTarget_(ctx, userId) {
  if (!isUuidV4_(userId)) throw validationError_([fieldError_('user_id', 'ID_INVALID')]);
  var u = findOne_('Users', 'user_id', userId);
  if (!u) throw apiError_('NOT_FOUND');
  if (u.user_id === ctx.user.user_id) throw validationError_([fieldError_('user_id', 'SELF_ACTION')]);
  if (u.is_system_owner && !ctx.user.is_system_owner) throw apiError_('FORBIDDEN');
  return u;
}

/** Còn cấp 4 active nào khác ngoài người này không */
function otherActiveAdmin_(userId) {
  return readRows_('Users').some(function (u) { return u.user_id !== userId && u.active && Number(u.role_level) === 4; });
}

/** So expected_version (không lộ dòng Users ra phản hồi lỗi) */
function assertUserVersion_(ctx, u) {
  var ev = ctx.req.expected_version;
  if (ev === undefined || ev === null || Number(ev) !== Number(u.record_version || 1)) {
    throw apiError_('VERSION_CONFLICT', { entity_type: 'USER', server: projectUser_(ctx, u, null), server_version: u.record_version || 1 });
  }
}

/** Thu hồi mọi phiên còn hiệu lực (dưới khóa; ghi Sheet trước, cache sau) */
function revokeUserSessions_(userId, reason) {
  var t = now_().getTime();
  findAll_('Sessions', 'user_id', userId).forEach(function (s) {
    if (isSessionActive_(s, t)) revokeSessionRow_(s, reason || 'AUTH_VERSION');
  });
}

/** Sau khi ghi Users: làm mới cache phiên/người dùng */
function afterUserWrite_(userId, oldAv, newAv) {
  var c = cache_();
  if (newAv !== undefined && newAv !== oldAv) c.put('av:' + userId, String(newAv), 21600);
  c.remove('us:' + userId);
  c.remove('users:dir');
  DB_.userDir = null;
}

/** Trả PIN tạm một lần, chỉ ở lần ghi đầu (gửi lại cùng operation_id không trả lại) */
function withTempPin_(res, box) {
  if (!res || res.code !== 'OK' || !box.pin) return res;
  var out = clone_(res);
  out.data = out.data || {};
  out.data.temp_pin = box.pin;
  return out;
}

/** user.create {user_id, employee_code, display_name, email?, role_level, area_ids[]} — Quản trị, PIN */
function userCreate_(ctx) {
  var p = ctx.req.payload || {};
  var errs = [];
  if (!isUuidV4_(p.user_id)) errs.push(fieldError_('user_id', 'ID_INVALID'));
  var code = normEmpCode_(p.employee_code);
  if (!code) errs.push(fieldError_('employee_code', 'REQUIRED'));
  else if (!EMP_CODE_RE_.test(code)) errs.push(fieldError_('employee_code', 'CODE_INVALID'));
  var name = trimStr_(p.display_name);
  if (!name) errs.push(fieldError_('display_name', 'REQUIRED'));
  if (name.length > 80) errs.push(fieldError_('display_name', 'INVALID_VALUE'));
  var email = trimStr_(p.email).toLowerCase();
  if (email && !EMAIL_RE_.test(email)) errs.push(fieldError_('email', 'INVALID_VALUE'));
  var areas = validateRole_(p, errs);
  if (Number(ctx.req.expected_version || 0) !== 0) errs.push(fieldError_('expected_version', 'INVALID_VALUE'));
  if (errs.length) throw validationError_(errs);
  var box = {};
  var res = executeWrite_(ctx, {
    entity_type: 'USER', entity_id: p.user_id,
    build: function () {
      if (findRowNums_('Users', 'user_id', p.user_id).length) throw validationError_([fieldError_('user_id', 'ID_EXISTS')]);
      if (findRowNums_('Users', 'employee_code', code).length) throw validationError_([fieldError_('employee_code', 'CODE_DUPLICATE')]);
      var pin = randomPin_(code);
      var rec = newPinRecord_(pin);
      var nowIso = isoVN_(now_());
      var exp = isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000));
      var row = {
        user_id: p.user_id, employee_code: code, display_name: name, email: email, role_level: Number(p.role_level), active: true,
        pin_hash: rec.pin_hash, salt: rec.salt, pin_hash_version: rec.pin_hash_version, failed_attempts: 0, locked_until: '',
        created_at: nowIso, updated_at: nowIso, auth_version: 1, is_system_owner: false, must_change_pin: true,
        temp_pin_expires_at: exp, pin_changed_at: '', failed_window_started_at: '', last_login_at: '', record_version: 1,
        created_by: ctx.user.user_id, updated_by: ctx.user.user_id, area_ids: areas
      };
      var writes = [{ sheet: 'Users', mode: 'insert', row: row }];
      box.pin = pin;
      return {
        writes: writes, noReplay: true,
        result: { entity_type: 'USER', entity_id: p.user_id, employee_code: code, temp_pin_expires_at: exp, record_version: 1 },
        record_version: 1,
        audit: { entity_type: 'USER', entity_id: p.user_id, before_json: null, after_json: { employee_code: code, display_name: name, role_level: row.role_level, area_ids: areas, temp_pin_issued: true } }
      };
    }
  });
  afterUserWrite_(p.user_id);
  return withTempPin_(res, box);
}

/** user.setRole {user_id, role_level, area_ids[], display_name?, email?} — đổi cấp/khu vực (tăng auth_version) */
function userSetRole_(ctx) {
  var p = ctx.req.payload || {};
  var errs = [];
  var areas = validateRole_(p, errs);
  var name = p.display_name !== undefined ? trimStr_(p.display_name) : null;
  if (name !== null && (!name || name.length > 80)) errs.push(fieldError_('display_name', name ? 'INVALID_VALUE' : 'REQUIRED'));
  var email = p.email !== undefined ? trimStr_(p.email).toLowerCase() : null;
  if (email && !EMAIL_RE_.test(email)) errs.push(fieldError_('email', 'INVALID_VALUE'));
  if (errs.length) throw validationError_(errs);
  var av = {};
  var res = executeWrite_(ctx, {
    entity_type: 'USER', entity_id: p.user_id,
    build: function () {
      var u = adminTarget_(ctx, p.user_id);
      assertUserVersion_(ctx, u);
      var lvl = Number(p.role_level);
      if (Number(u.role_level) === 4 && lvl !== 4 && u.active && !otherActiveAdmin_(u.user_id)) throw validationError_([fieldError_('role_level', 'LAST_ADMIN')]);
      var before = { role_level: Number(u.role_level), area_ids: u.area_ids || '', display_name: u.display_name, email: u.email ? 'set' : '' };
      var row = clone_(u); delete row.__row;
      row.role_level = lvl;
      row.area_ids = areas;
      if (name !== null) row.display_name = name;
      if (email !== null) row.email = email;
      av.old = u.auth_version || 0;
      row.auth_version = av.old + 1;
      av.new = row.auth_version;
      row.record_version = (u.record_version || 1) + 1;
      row.updated_at = isoVN_(now_()); row.updated_by = ctx.user.user_id;
      var writes = [{ sheet: 'Users', mode: 'update', row: row }];
      revokeUserSessions_(u.user_id, 'AUTH_VERSION');
      return {
        writes: writes, noReplay: true,
        result: { entity_type: 'USER', entity_id: u.user_id, record_version: row.record_version },
        record_version: row.record_version,
        audit: { entity_type: 'USER', entity_id: u.user_id, before_json: before, after_json: { role_level: lvl, area_ids: areas, display_name: row.display_name, email: row.email ? 'set' : '' } }
      };
    }
  });
  afterUserWrite_(p.user_id, av.old, av.new);
  return res;
}

/** Khung chung cho lock/unlock/resetPin/revokeSessions */
function userAdminOp_(ctx, kind) {
  var p = ctx.req.payload || {};
  var reason = trimStr_(p.reason);
  if (kind === 'LOCK' && !reason) throw validationError_([fieldError_('reason', 'REQUIRED')]);
  var av = {}, box = {};
  var res = executeWrite_(ctx, {
    entity_type: 'USER', entity_id: p.user_id,
    build: function () {
      var u = adminTarget_(ctx, p.user_id);
      assertUserVersion_(ctx, u);
      var row = clone_(u); delete row.__row;
      var nowIso = isoVN_(now_());
      var before, after;
      av.old = u.auth_version || 0;
      if (kind === 'LOCK') {
        if (Number(u.role_level) === 4 && u.active && !otherActiveAdmin_(u.user_id)) throw validationError_([fieldError_('user_id', 'LAST_ADMIN')]);
        row.active = false;
        before = { active: !!u.active }; after = { active: false };
      } else if (kind === 'UNLOCK') {
        // Mở khóa: bật lại tài khoản và xóa khóa do nhập sai PIN; không tăng auth_version
        row.active = true; row.failed_attempts = 0; row.failed_window_started_at = ''; row.locked_until = '';
        before = { active: !!u.active, pin_locked: !!u.locked_until }; after = { active: true, pin_locked: false };
      } else if (kind === 'RESET_PIN') {
        var pin = randomPin_(u.employee_code);
        var rec = newPinRecord_(pin);
        row.pin_hash = rec.pin_hash; row.salt = rec.salt; row.pin_hash_version = rec.pin_hash_version;
        row.must_change_pin = true;
        row.temp_pin_expires_at = isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000));
        row.failed_attempts = 0; row.failed_window_started_at = ''; row.locked_until = '';
        box.pin = pin;
        before = { must_change_pin: !!u.must_change_pin }; after = { must_change_pin: true, temp_pin_issued: true };
      } else {
        before = { auth_version: av.old }; after = { sessions_revoked: true };
      }
      if (kind !== 'UNLOCK') row.auth_version = av.old + 1;
      av.new = row.auth_version || 0;
      row.record_version = (u.record_version || 1) + 1;
      row.updated_at = nowIso; row.updated_by = ctx.user.user_id;
      if (kind !== 'UNLOCK') revokeUserSessions_(u.user_id, 'AUTH_VERSION');
      var result = { entity_type: 'USER', entity_id: u.user_id, record_version: row.record_version };
      if (kind === 'RESET_PIN') result.temp_pin_expires_at = row.temp_pin_expires_at;
      return {
        writes: [{ sheet: 'Users', mode: 'update', row: row }], noReplay: true,
        result: result, record_version: row.record_version,
        audit: { entity_type: 'USER', entity_id: u.user_id, before_json: before, after_json: after, reason: reason }
      };
    }
  });
  afterUserWrite_(p.user_id, av.old, av.new);
  return withTempPin_(res, box);
}

function userLock_(ctx) { return userAdminOp_(ctx, 'LOCK'); }
function userUnlock_(ctx) { return userAdminOp_(ctx, 'UNLOCK'); }
function userResetPin_(ctx) { return userAdminOp_(ctx, 'RESET_PIN'); }
function userRevokeSessions_(ctx) { return userAdminOp_(ctx, 'REVOKE'); }
