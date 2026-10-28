/* 13_sync: sync.bootstrap, sync.changes, sync.push, sync.getOperationStatus (cùng giao thức như M&E)
 * Lượt kiểm, bất thường, lý do bỏ sót, xác nhận ngày, ảnh chỉ gửi xuống máy trong runs_sync_days ngày gần nhất
 * (bất thường còn mở luôn gửi); tháng cũ hơn xem qua check.month (cần mạng). */

var SYNC_ENTITIES_ = [
  { type: 'AREA', sheet: 'Areas' },
  { type: 'MACHINE', sheet: 'Machines' },
  { type: 'LIBRARY_ITEM', sheet: 'LibraryItems' },
  { type: 'TEMPLATE', sheet: 'Templates' },
  { type: 'TEMPLATE_ITEM', sheet: 'TemplateItems', currentRev: true },
  { type: 'ASSIGNMENT', sheet: 'Assignments' },
  { type: 'RUN', sheet: 'Runs', window: true },
  { type: 'ABNORMAL', sheet: 'Abnormals', window: true },
  { type: 'MISSED', sheet: 'MissedReasons', window: true },
  { type: 'DAY_CONFIRM', sheet: 'DayConfirms', window: true },
  { type: 'DOCUMENT', sheet: 'Documents', window: true }
];

function syncFromDate_() {
  return addDaysIso_(todayVN_(), -Math.max(7, Number(setting_('runs_sync_days') || 40)));
}

/** Dòng → bản ghi gửi client; null nếu không gửi (ngoài cửa sổ, phiên bản mẫu cũ, đã gỡ) */
function syncProject_(ctx, ent, row, aux) {
  if (ent.currentRev) {
    if (!aux.tplRev) { aux.tplRev = {}; (aux.tc ? aux.tc.rows('Templates') : readRows_('Templates')).forEach(function (t) { aux.tplRev[t.template_id] = Number(t.revision); }); }
    if (aux.tplRev[row.template_id] !== Number(row.revision)) return null;
  }
  if (ent.window) {
    if (!aux.from) aux.from = syncFromDate_();
    if (ent.type === 'DOCUMENT') {
      if (!row.active || String(row.created_at).slice(0, 10) < aux.from) return null;
    } else if (ent.type === 'ABNORMAL') {
      if (row.status === 'CANCELLED') return null;
      if (row.status !== 'OPEN' && String(row.work_date) < aux.from) return null;
    } else if (String(row.work_date) < aux.from) return null;
  }
  return ent.type === 'DOCUMENT' ? projectDoc_(ctx, row) : projectRow_(ctx, row);
}

function syncBootstrap_(ctx) {
  var p = ctx.req.payload || {};
  var pageSize = Math.min(2000, setting_('sync_page_size') || 500);
  var tok = String(p.page_token || '0:0').split(':');
  var ei = Number(tok[0]) || 0, off = Number(tok[1]) || 0;
  var st = readState_();
  var cursor = p.page_token && p.sync_cursor ? Number(p.sync_cursor) : Number(stateGet_(st, 'sync_revision', 0));
  var ents = SYNC_ENTITIES_;
  var tc = tableCache_(ents.slice(ei).map(function (e) { return e.sheet; }).concat(['Templates']), st);
  var aux = { tc: tc };
  var records = {};
  var count = 0;
  var next = null;
  var t0 = Date.now();
  var budget = Math.max(2000, Math.min(15000, Number(p.budget_ms) || 15000));
  for (; ei < ents.length; ei++) {
    var ent = ents[ei];
    if (count && Date.now() - t0 > budget) { next = ei + ':0'; break; }
    var rows = tc.rows(ent.sheet);
    var list = records[ent.type] = records[ent.type] || [];
    for (var i = off; i < rows.length; i++) {
      if (count >= pageSize || Date.now() - t0 > budget) { next = ei + ':' + i; break; }
      if (rows[i].archived_at) continue;
      var o = syncProject_(ctx, ent, rows[i], aux);
      if (o) { list.push(o); count++; }
    }
    off = 0;
    if (next) break;
  }
  var out = { records: records, next_page_token: next, sync_cursor: String(cursor) };
  if (!p.page_token) {
    out.user = publicUser_(ctx.user);
    out.settings = clientSettings_();
    out.permissions = permissionSummary_(ctx);
    out.server_version = SERVER_VERSION;
    out.released_dot = releasedDot_();
    out.env = envName_();
    out.server_today = todayVN_();
    out.me_link = { linked: meLinked_(), last_sync_at: stateGet_(st, 'me_last_sync_at', ''), last_sync_status: stateGet_(st, 'me_last_sync_status', '') };
    out.users = userDirList_();
    out.settings_rev = Number(stateGet_(st, 'settings_rev', 0));
  }
  return out;
}

/** Tên người dùng (mã, tên hiển thị, cấp, khu vực) để hiện người kiểm, người xử lý */
function userDirList_() {
  var dir = userDirectory_();
  return Object.keys(dir).map(function (id) { return { user_id: id, employee_code: dir[id].employee_code, display_name: dir[id].display_name, active: dir[id].active }; });
}

function clientSettings_() {
  var s = settings_();
  var out = {};
  SETTINGS_DEFAULTS.forEach(function (d) { if (d[3]) out[d[0]] = s[d[0]]; });
  out.shifts_json = shiftsCfg_();
  return out;
}

function syncChanges_(ctx) {
  var p = ctx.req.payload || {};
  var cursor = Number(p.cursor);
  if (!(cursor >= 0)) throw validationError_([fieldError_('cursor', 'INVALID_VALUE')]);
  var limit = Math.min(500, Number(p.limit) || 500);
  var st = readState_();
  var head = Number(stateGet_(st, 'sync_revision', 0));
  var changes = [];
  var ents = SYNC_ENTITIES_.filter(function (ent) { return Number(stateGet_(st, 'table_rev.' + ent.sheet, 0)) > cursor; });
  var tc = ents.length ? tableCache_(ents.map(function (e) { return e.sheet; }).concat(['Templates']), st) : null;
  var aux = { tc: tc };
  ents.forEach(function (ent) {
    var key = sheetSchema_(ent.sheet).key;
    tc.rows(ent.sheet).forEach(function (r) {
      if (!(Number(r.sync_revision || 0) > cursor)) return;
      var o = r.archived_at ? null : syncProject_(ctx, ent, r, aux);
      // Hạng mục của phiên bản mẫu cũ không gửi xóa (app chỉ dùng phiên bản hiện tại của mẫu)
      if (!o && ent.currentRev && !r.archived_at) return;
      changes.push({
        entity_type: ent.type, entity_id: r[key], op: o ? 'UPSERT' : 'TOMBSTONE',
        record_version: r.record_version, sync_revision: r.sync_revision, data: o
      });
    });
  });
  changes.sort(function (a, b) { return a.sync_revision - b.sync_revision; });
  var hasMore = false;
  if (changes.length > limit) {
    var cut = changes[limit - 1].sync_revision;
    var k = limit;
    while (k < changes.length && changes[k].sync_revision === cut) k++;
    hasMore = k < changes.length;
    changes = changes.slice(0, k);
  }
  var nextCursor = hasMore ? changes[changes.length - 1].sync_revision : head;
  var out = {
    changes: changes, next_cursor: String(nextCursor), has_more: hasMore,
    perm_version: 1, sync_cursor: String(nextCursor), server_today: todayVN_(), server_version: SERVER_VERSION,
    released_dot: releasedDot_()
  };
  if (Number(stateGet_(st, 'table_rev.Users', 0)) > cursor) out.users = userDirList_();
  out.settings_rev = Number(stateGet_(st, 'settings_rev', 0));
  return out;
}

/** Một thao tác của hàng chờ offline */
function syncPush_(ctx) {
  var op = (ctx.req.payload || {}).op;
  if (!op || typeof op !== 'object' || typeof op.action !== 'string') throw validationError_([fieldError_('op', 'REQUIRED')]);
  var def = ACTION_REGISTRY[op.action];
  if (!def) throw apiError_('FORBIDDEN');
  if (def.net === 'pin') throw apiError_('REAUTH_REQUIRED');
  if (def.net !== 'offline') throw validationError_([fieldError_('op.action', 'NEEDS_NETWORK')]);
  var inner = {
    api_contract_version: ctx.req.api_contract_version, action: op.action, payload: op.payload || {},
    token: ctx.req.token, operation_id: op.operation_id, dataset_epoch: ctx.req.dataset_epoch,
    device_id: ctx.req.device_id, expected_version: op.expected_version, app_version: ctx.req.app_version,
    client_time: op.local_created_at
  };
  var env;
  try {
    env = dispatchInner_(inner, true);
  } catch (e) {
    env = errorToResponse_(inner, e);
  }
  return { __envelope: env };
}

function syncOpStatus_(ctx) {
  var id = (ctx.req.payload || {}).operation_id;
  if (!isUuidV4_(id)) throw validationError_([fieldError_('operation_id', 'ID_INVALID')]);
  var ex = findOne_('Operations', 'operation_id', id);
  if (!ex || ex.user_id !== ctx.user.user_id) return { operation_id: id, state: 'NOT_FOUND' };
  return {
    operation_id: id, state: ex.state, result_code: ex.result_code, action: ex.action,
    committed_at: ex.committed_at, result: ex.result_json || null,
    record_version: ex.result_json ? ex.result_json.record_version : null
  };
}
