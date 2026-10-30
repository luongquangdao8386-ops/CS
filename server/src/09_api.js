/* 09_api: doPost, doGet, điều phối action (cùng phong bì và quy trình như M&E) */

/** Bảng thao tác đã có mã. Action có trong registry mà chưa có ở đây → FEATURE_NOT_ENABLED. */
var HANDLERS_ = {
  'auth.login': function (req) { return authLogin_(req); },
  'auth.reauth': function (ctx) { return authReauth_(ctx); },
  'auth.logout': function (ctx) { return authLogout_(ctx); },
  'auth.logoutAll': function (ctx) { return authLogoutAll_(ctx); },
  'pin.change': function (ctx) { return pinChange_(ctx); },
  'account.view': function (ctx) { return accountView_(ctx); },
  'session.listOwn': function (ctx) { return sessionListOwn_(ctx); },
  'session.revokeOwn': function (ctx) { return sessionRevokeOwn_(ctx); },
  'system.getPublicState': function (req) { return publicState_(req); },
  'system.health': function () { return { app_id: APP_ID }; },
  'sync.bootstrap': function (ctx) { return syncBootstrap_(ctx); },
  'sync.changes': function (ctx) { return syncChanges_(ctx); },
  'sync.push': function (ctx) { return syncPush_(ctx); },
  'sync.getOperationStatus': function (ctx) { return syncOpStatus_(ctx); },
  'check.submit': function (ctx) { return checkSubmit_(ctx); },
  'check.month': function (ctx) { return checkMonth_(ctx); },
  'doc.upload': function (ctx) { return docUpload_(ctx); },
  'abnormal.resolve': function (ctx) { return abnormalResolve_(ctx); },
  'missed.reason': function (ctx) { return missedReason_(ctx); },
  'day.confirm': function (ctx) { return dayConfirm_(ctx); },
  'template.edit': function (ctx) { return templateEdit_(ctx); },
  'template.archive': function (ctx) { return templateArchive_(ctx); },
  'template.isoList': function (ctx) { return templateIsoList_(ctx); },
  'template.isoSeed': function (ctx) { return templateIsoSeed_(ctx); },
  'library.edit': function (ctx) { return libraryEdit_(ctx); },
  'assignment.edit': function (ctx) { return assignmentEdit_(ctx); },
  'assignment.add': function (ctx) { return assignmentAdd_(ctx); },
  'machine.sync': function (ctx) { return machineSyncAction_(ctx); },
  'i18n.suggest': function (ctx) { return i18nSuggest_(ctx); },
  'report.pdf': function (ctx) { return reportPdfAction_(ctx); },
  'report.logo.get': function (ctx) { return reportLogoGet_(ctx); },
  'report.logo.set': function (ctx) { return reportLogoSet_(ctx); },
  'user.pickList': function (ctx) { return userPickList_(ctx); },
  'user.view': function (ctx) { return userView_(ctx); },
  'user.create': function (ctx) { return userCreate_(ctx); },
  'user.setRole': function (ctx) { return userSetRole_(ctx); },
  'user.lock': function (ctx) { return userLock_(ctx); },
  'user.unlock': function (ctx) { return userUnlock_(ctx); },
  'user.resetPin': function (ctx) { return userResetPin_(ctx); },
  'user.revokeSessions': function (ctx) { return userRevokeSessions_(ctx); },
  'audit.own': function (ctx) { return auditOwn_(ctx); },
  'audit.view': function (ctx) { return auditView_(ctx); },
  'backup.view': function (ctx) { return backupView_(ctx); },
  'backup.run': function (ctx) { return backupRun_(ctx); },
  'settings.edit': function (ctx) { return settingsEdit_(ctx); },
  'system.status': function (ctx) { return systemStatus_(ctx); },
  'me.link.set': function (ctx) { return meLinkSet_(ctx); },
  'sample.seed': function (ctx) { return sampleSeedAction_(ctx); }
};

/** Action không cần phiên */
var PUBLIC_ACTIONS_ = { 'auth.login': 1, 'system.getPublicState': 1, 'system.health': 1 };

/** Action được chạy khi bảo trì */
var MAINTENANCE_ALLOW_ = { 'system.health': 1, 'system.getPublicState': 1, 'auth.logout': 1 };

function doPost(e) {
  var t0 = Date.now();
  var res;
  propsReset_(true);
  try {
    var body = e && e.postData ? e.postData.contents : '';
    var req;
    try { req = JSON.parse(body); } catch (err) { req = null; }
    if (!req || typeof req !== 'object' || Array.isArray(req)) {
      res = envelope_({}, { ok: false, code: 'VALIDATION_ERROR', errors: [fieldError_('body', 'INVALID_VALUE')] });
    } else {
      res = apiDispatch_(req);
    }
  } catch (err2) {
    res = internalError_({}, err2);
  } finally {
    propsReset_(false);
  }
  res.server_ms = Date.now() - t0;
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  if (p.action === 'system.health') {
    out = { ok: true, code: 'OK', api_contract_version: API_CONTRACT_VERSION, app_id: APP_ID, server_time: isoVN_(now_()) };
  } else {
    // via:'GET' giúp app nhận ra một POST đã bị chuyển thành GET trên đường đi (bài học PoC của M&E)
    out = { ok: false, code: 'NOT_FOUND', via: 'GET', api_contract_version: API_CONTRACT_VERSION, app_id: APP_ID, server_time: isoVN_(now_()) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function publicState_(req) {
  var props = sysProps_();
  return {
    app_id: APP_ID, api_contract_version: API_CONTRACT_VERSION, server_version: SERVER_VERSION,
    maintenance_mode: props.maintenance_mode, env: props.env, min_client_version: setting_('min_client_version'),
    ready: !!prop_('BUSINESS_SPREADSHEET_ID')
  };
}

/** Phong bì phản hồi chuẩn */
function envelope_(req, r) {
  var props;
  try { props = sysProps_(); } catch (e) { props = { dataset_epoch: '', maintenance_mode: false }; }
  var pair = MSG[r.code] || MSG.INTERNAL_ERROR;
  if (r.code === 'AUTH_REQUIRED' && r.data && (r.data.reason === 'REVOKED' || r.data.reason === 'AUTH_VERSION')) pair = MSG.AUTH_REQUIRED_REVOKED;
  pair = fmtMsg_(pair, r.msgVars);
  return {
    ok: !!r.ok, code: r.code, message_vi: pair[0], message_zh: pair[1],
    data: r.data === undefined ? null : r.data,
    api_contract_version: API_CONTRACT_VERSION, dataset_epoch: props.dataset_epoch || '',
    maintenance_mode: !!props.maintenance_mode,
    operation_id: req && req.operation_id ? String(req.operation_id) : null,
    state: r.state || null, record_version: r.record_version === undefined ? null : r.record_version,
    sync_cursor: r.sync_cursor || null, server_time: isoVN_(now_()), errors: r.errors || []
  };
}

function internalError_(req, err) {
  var id = uuid_();
  console.error('INTERNAL_ERROR ' + id + ' ' + (req && req.action) + ' ' + (err && err.stack ? err.stack : err));
  return envelope_(req, { ok: false, code: 'INTERNAL_ERROR', data: { error_id: id } });
}

function errorToResponse_(req, e) {
  if (e && e.apiCode) {
    return envelope_(req, { ok: false, code: e.apiCode, data: e.apiData, errors: e.apiErrors, msgVars: e.msgVars });
  }
  return internalError_(req, e);
}

/** Điều phối một request (đã parse JSON). Luôn trả object phản hồi. */
function apiDispatch_(req) {
  try {
    return dispatchInner_(req, false);
  } catch (e) {
    return errorToResponse_(req, e);
  }
}

/**
 * auth.login {with_bootstrap: true}: kèm trang đầu của sync.bootstrap để app vào được sau một lượt gọi thay vì hai.
 * Lỗi phần dữ liệu không làm hỏng đăng nhập (app tự gọi sync.bootstrap như cũ).
 */
function loginWithBootstrap_(req, data) {
  var out = JSON.parse(JSON.stringify(data));
  try {
    var inner = {
      api_contract_version: req.api_contract_version, action: 'sync.bootstrap', payload: { budget_ms: 6000 }, token: data.token,
      dataset_epoch: sysProps_().dataset_epoch, device_id: req.device_id, app_version: req.app_version
    };
    var env = dispatchInner_(inner, false);
    if (env && env.ok && env.data) out.bootstrap = env.data;
  } catch (e) { /* app tự gọi sync.bootstrap */ }
  return out;
}

function dispatchInner_(req, viaPush) {
  if (typeof req.action !== 'string' || typeof req.payload !== 'object' || req.payload === null || Array.isArray(req.payload)) {
    throw validationError_([fieldError_('action', 'REQUIRED')]);
  }
  if (req.api_contract_version !== API_CONTRACT_VERSION) throw apiError_('CLIENT_UPDATE_REQUIRED');
  var def = ACTION_REGISTRY[req.action];
  if (!def) throw apiError_('FORBIDDEN');
  if (!HANDLERS_[req.action]) throw apiError_('FEATURE_NOT_ENABLED');
  if (req.action !== 'system.health' && req.action !== 'system.getPublicState') {
    if (cmpVersion_(req.app_version, setting_('min_client_version')) < 0) throw apiError_('CLIENT_UPDATE_REQUIRED');
    if (!isUuidV4_(req.device_id)) throw validationError_([fieldError_('device_id', 'ID_INVALID')]);
  }
  if (sysProps_().maintenance_mode && !MAINTENANCE_ALLOW_[req.action]) throw apiError_('SYSTEM_MAINTENANCE');
  if (PUBLIC_ACTIONS_[req.action]) {
    if (!prop_('BUSINESS_SPREADSHEET_ID') && req.action !== 'system.health' && req.action !== 'system.getPublicState') throw apiError_('SYSTEM_NOT_READY');
    var pub = HANDLERS_[req.action](req);
    if (req.action === 'auth.login' && req.payload.with_bootstrap && pub && pub.session_kind === 'FULL') pub = loginWithBootstrap_(req, pub);
    return envelope_(req, { ok: true, code: 'OK', data: pub });
  }
  var ctx = requireSession_(req, req.action);
  if (def.write && !isUuidV4_(req.operation_id)) throw validationError_([fieldError_('operation_id', 'ID_INVALID')]);
  ctx.auth = authorize_(ctx, req.action);
  // Hỏi lại PIN sau khi đã biết người dùng có quyền (không hỏi PIN người không có quyền)
  if (def.net === 'pin' && !verifyReauth_(ctx, req.reauth_token)) throw apiError_('REAUTH_REQUIRED');
  ctx.viaPush = !!viaPush;
  var out = HANDLERS_[req.action](ctx);
  if (out && out.__envelope) return out.__envelope; // sync.push: phản hồi giống action gốc
  var env = out && out.state === 'COMMITTED' && out.ok ? envelope_(req, out)
    : envelope_(req, { ok: true, code: 'OK', data: out, sync_cursor: out && out.sync_cursor ? String(out.sync_cursor) : null });
  if (def.write && !viaPush && env.ok && req.changes_since !== undefined && req.changes_since !== null) attachChanges_(ctx, req, env);
  return env;
}

/**
 * Ghi xong (COMMITTED): kèm luôn thay đổi từ cursor của app (như sync.changes) → app không phải gọi thêm một lượt sau mỗi lần lưu.
 */
function attachChanges_(ctx, req, env) {
  var since = Number(req.changes_since);
  if (!(since >= 0)) return;
  try {
    var c2 = Object.create(ctx);
    c2.req = { action: 'sync.changes', payload: { cursor: since, limit: 500 }, device_id: req.device_id };
    env.changes = syncChanges_(c2);
  } catch (e) { /* app tự gọi sync.changes */ }
}
