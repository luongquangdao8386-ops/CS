/* 07_perm: bảng thao tác và quyền theo cấp
 * Cấp: 1 Tra cứu · 2 Người kiểm · 3 Trưởng bộ phận · 4 Quản trị (số lớn quyền cao, như M&E); owner là cờ riêng.
 */

/*
 * Mỗi dòng: mã | cấp tối thiểu | mạng | R/W
 *  - cấp: 0 = không cần phiên (public); S = chỉ cần phiên (mọi cấp); 1–4; O = chỉ owner
 *  - mạng: net · offline (được vào hàng chờ) · pin (phải nhập lại PIN) · public · session · cache
 */
var ACTION_TABLE_ = [
  'auth.login|0|public|R',
  'system.health|0|public|R',
  'system.getPublicState|0|public|R',
  'auth.reauth|S|session|R',
  'auth.logout|S|session|R',
  'account.view|S|session|R',
  'pin.change|S|session|R',
  'session.listOwn|S|session|R',
  'session.revokeOwn|S|session|R',
  'auth.logoutAll|S|pin|R',
  'sync.bootstrap|S|session|R',
  'sync.changes|S|session|R',
  'sync.push|S|session|R',
  'sync.getOperationStatus|S|session|R',
  // Kiểm tra
  'check.submit|2|offline|W',
  'check.month|1|net|R',
  'doc.upload|2|offline|W',
  // Trưởng bộ phận: xử lý bất thường, lý do bỏ sót, xác nhận ngày
  'abnormal.resolve|3|net|W',
  'missed.reason|3|net|W',
  'day.confirm|3|pin|W',
  // Mẫu, thư viện hạng mục, gán máy, thiết bị
  'template.edit|3|net|W',
  'template.archive|3|net|W',
  'library.edit|3|net|W',
  'assignment.edit|3|net|W',
  'assignment.add|3|net|W',
  'machine.sync|3|net|W',
  'i18n.suggest|3|net|R',
  // Báo cáo
  'report.pdf|1|net|R',
  'report.logo.get|1|net|R',
  'report.logo.set|4|pin|W',
  // Người dùng, quản trị
  'user.pickList|3|net|R',
  'user.view|4|net|R',
  'user.create|4|pin|W',
  'user.setRole|4|pin|W',
  'user.lock|4|pin|W',
  'user.unlock|4|pin|W',
  'user.resetPin|4|pin|W',
  'user.revokeSessions|4|pin|W',
  'audit.own|S|net|R',
  'audit.view|3|net|R',
  'backup.view|4|net|R',
  'backup.run|4|pin|W',
  'settings.edit|4|pin|W',
  'system.status|4|net|R',
  'me.link.set|4|pin|W',
  'sample.seed|O|pin|W'
];

var ACTION_REGISTRY = (function () {
  var reg = {};
  ACTION_TABLE_.forEach(function (line) {
    var p = line.split('|');
    reg[p[0]] = { code: p[0], level: p[1], net: p[2], write: p[3] === 'W', dot: 1 };
  });
  return reg;
})();

/** Người dùng có được chạy action không (chưa xét hồ sơ) */
function levelAllows_(user, def) {
  if (def.level === '0' || def.level === 'S') return true;
  if (def.level === 'O') return !!user.is_system_owner && Number(user.role_level) === 4;
  return Number(user.role_level) >= Number(def.level);
}

/** Ném FORBIDDEN nếu cấp không đủ */
function authorize_(ctx, code) {
  var def = ACTION_REGISTRY[code];
  if (!def || !levelAllows_(ctx.user, def)) throw apiError_('FORBIDDEN');
  return { level: Number(ctx.user.role_level) };
}

function can_(ctx, code) {
  try { authorize_(ctx, code); return true; } catch (e) { return false; }
}

/** Cơ sở quyền ghi vào AuditLogs.auth_basis */
function authBasis_(ctx) {
  return 'ROLE_LEVEL:' + Number(ctx.user.role_level);
}

function releasedDot_() { return RELEASED_DOT; }

/** Khối permissions của bootstrap: action được phép theo cấp */
function permissionSummary_(ctx) {
  var actions = [];
  Object.keys(ACTION_REGISTRY).forEach(function (code) {
    var def = ACTION_REGISTRY[code];
    if (!HANDLERS_[code]) return;
    if (levelAllows_(ctx.user, def)) actions.push(code);
  });
  return { perm_version: 1, actions: actions };
}

/** Khu vực của người dùng (rỗng = mọi khu vực) */
function userAreas_(u) {
  return areaList_(u && u.area_ids);
}
