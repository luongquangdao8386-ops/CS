/* 10_machines: lấy khu vực và thiết bị một chiều từ M&E (action feed.equipment của máy chủ M&E, khóa bằng mã kết nối)
 * Thiết bị chỉ sửa ở M&E; Checksheet không có thêm/sửa thiết bị. Máy mất khỏi M&E, bị lưu trữ hoặc Ngừng sử dụng → ngừng kiểm
 * (lịch sử giữ nguyên). ID giữ nguyên ID của M&E nên đổi tên, đổi khu vực không làm sai lịch sử. */

var ME_EXEC_RE_ = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/;

/** Gọi feed.equipment của M&E. Mất phản hồi (chặng chuyển hướng của Google) thì thử lại tối đa 3 lần. */
function meFetchWith_(url, key, sinceRev) {
  var dev = prop_('ME_FEED_DEVICE_ID');
  if (!isUuidV4_(dev)) { dev = uuid_(); setProp_('ME_FEED_DEVICE_ID', dev); }
  var body = JSON.stringify({
    api_contract_version: '1.0', action: 'feed.equipment', payload: { key: key, since_rev: sinceRev || '', client: APP_ID },
    device_id: dev, app_version: SERVER_VERSION
  });
  var json = null, lastErr = '';
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: body, muteHttpExceptions: true, followRedirects: true });
      var text = resp.getContentText();
      try { json = JSON.parse(text); } catch (e) { json = null; lastErr = 'NON_JSON_' + resp.getResponseCode(); }
      if (json && json.via !== 'GET') break;
      if (json) lastErr = 'REDIRECTED_AS_GET';
      json = null;
    } catch (e2) { lastErr = String(e2 && e2.message || e2).slice(0, 120); }
    Utilities.sleep(1500);
  }
  if (!json) throw apiError_('ME_LINK_FAILED', { reason: lastErr || 'NO_RESPONSE' }, [fieldError_('exec_url', 'ME_LINK_FAILED')]);
  if (!json.ok) throw apiError_('ME_LINK_FAILED', { reason: json.code || 'ERROR' }, [fieldError_('key', 'ME_LINK_FAILED')]);
  return json.data || {};
}

function meLinked_() { return !!(prop_('ME_EXEC_URL') && prop_('ME_FEED_KEY')); }

function areaRowFrom_(loc, nowIso) {
  return {
    area_id: String(loc.location_id), area_code: trimStr_(loc.location_code), name_vi: trimStr_(loc.name_vi), name_zh: trimStr_(loc.name_zh),
    parent_area_id: trimStr_(loc.parent_location_id), active: loc.active !== false && !loc.archived, source: 'ME', synced_at: nowIso
  };
}

function machineRowFrom_(eq, nowIso) {
  return {
    machine_id: String(eq.equipment_id), machine_code: trimStr_(eq.equipment_code), name_vi: trimStr_(eq.name_vi), name_zh: trimStr_(eq.name_zh),
    area_id: trimStr_(eq.location_id), me_status: trimStr_(eq.status), category_vi: trimStr_(eq.category_vi), category_zh: trimStr_(eq.category_zh),
    model: trimStr_(eq.model), qr_key: trimStr_(eq.qr_key), active: !eq.archived && eq.status !== 'RETIRED', source: 'ME', synced_at: nowIso
  };
}

/** Các dòng thay đổi để khớp danh sách mới (thêm, sửa, ngừng dòng không còn trong nguồn) */
function diffRows_(sheet, key, incoming, fields, counts) {
  var cur = {};
  readRows_(sheet).forEach(function (r) { cur[r[key]] = r; });
  var writes = [], seen = {};
  var nowIso = isoVN_(now_());
  incoming.forEach(function (n) {
    if (!n[key] || seen[n[key]]) return;
    seen[n[key]] = true;
    var old = cur[n[key]];
    if (!old) { writes.push({ sheet: sheet, mode: 'insert', row: cNewSystem_(n) }); counts.added++; return; }
    var diff = fields.some(function (f) { return String(old[f] === null || old[f] === undefined ? '' : old[f]) !== String(n[f] === null || n[f] === undefined ? '' : n[f]); });
    if (!diff) return;
    var row = Object.assign({}, old, n);
    delete row.__row;
    row.record_version = (old.record_version || 0) + 1;
    row.updated_at = nowIso; row.updated_by = SYSTEM_USER;
    writes.push({ sheet: sheet, mode: 'update', row: row });
    if (old.active && !n.active) counts.deactivated++; else counts.updated++;
  });
  Object.keys(cur).forEach(function (id) {
    var old = cur[id];
    if (seen[id] || !old.active) return;
    var row = Object.assign({}, old, { active: false, record_version: (old.record_version || 0) + 1, updated_at: nowIso, updated_by: SYSTEM_USER });
    delete row.__row;
    writes.push({ sheet: sheet, mode: 'update', row: row });
    counts.deactivated++;
  });
  return writes;
}

function noteMeSync_(status, error, rev) {
  withWriteLock_(function () {
    var st = readState_();
    var su = { me_last_sync_at: ['DATETIME', isoVN_(now_())], me_last_sync_status: ['STRING', status], me_last_sync_error: ['STRING', error || ''] };
    if (rev !== undefined) su.me_source_rev = ['STRING', String(rev)];
    stateWrite_(st, su, SYSTEM_USER);
  });
}

/** Lấy danh sách từ M&E và ghi thay đổi. force: bỏ qua mốc phiên bản nguồn (lấy đủ). */
function syncMachines_(force, link) {
  var url = link ? link.url : prop_('ME_EXEC_URL'), key = link ? link.key : prop_('ME_FEED_KEY');
  if (!url || !key) throw apiError_('ME_LINK_FAILED', { reason: 'NOT_LINKED' }, [fieldError_('exec_url', 'REQUIRED')]);
  var since = force ? '' : String(stateGet_(readState_(), 'me_source_rev', '') || '');
  var data;
  try {
    data = meFetchWith_(url, key, since);
  } catch (e) {
    noteMeSync_('FAILED', (e.apiData && e.apiData.reason) || String(e.message || e).slice(0, 120));
    throw e;
  }
  if (data.unchanged) { noteMeSync_('OK', '', data.rev); return { unchanged: true, rev: data.rev }; }
  var nowIso = isoVN_(now_());
  var ca = { added: 0, updated: 0, deactivated: 0 }, cm = { added: 0, updated: 0, deactivated: 0 };
  var areas = (data.locations || []).map(function (l) { return areaRowFrom_(l, nowIso); });
  var machines = (data.equipment || []).map(function (q) { return machineRowFrom_(q, nowIso); });
  var writes = withWriteLock_(function () {
    return diffRows_('Areas', 'area_id', areas, ['area_code', 'name_vi', 'name_zh', 'parent_area_id', 'active', 'source'], ca)
      .concat(diffRows_('Machines', 'machine_id', machines,
        ['machine_code', 'name_vi', 'name_zh', 'area_id', 'me_status', 'category_vi', 'category_zh', 'model', 'qr_key', 'active', 'source'], cm));
  });
  if (writes.length) systemWrite_(writes, { action: 'machine.sync', entity_type: 'MACHINE', after_json: { areas: ca, machines: cm, rev: data.rev } });
  noteMeSync_('OK', '', data.rev);
  return { unchanged: false, rev: data.rev, areas: ca, machines: cm, total_machines: machines.length };
}

/** Trigger mỗi giờ */
function syncMachinesHourly() {
  var t0 = Date.now();
  propsReset_(true);
  try {
    dbReset_();
    if (!prop_('BUSINESS_SPREADSHEET_ID') || !meLinked_()) return;
    syncMachines_(false);
  } catch (e) {
    console.warn('syncMachinesHourly ' + (e && e.apiCode ? e.apiCode + ' ' + JSON.stringify(e.apiData) : e));
  } finally {
    try { recordTriggerRun_('syncMachinesHourly', t0); } catch (e2) { /* bỏ qua */ }
    propsReset_(false);
  }
}

/** machine.sync: Trưởng bộ phận/Quản trị bấm "Cập nhật từ M&E" */
function machineSyncAction_(ctx) {
  var out = syncMachines_(true);
  out.last_sync_at = isoVN_(now_());
  return out;
}

/** me.link.set {exec_url, key}: lưu link /exec M&E và mã kết nối (Quản trị + PIN); thử kết nối trước khi lưu */
function meLinkSet_(ctx) {
  var p = ctx.req.payload || {};
  var url = trimStr_(p.exec_url), key = trimStr_(p.key);
  var errs = [];
  if (!ME_EXEC_RE_.test(url)) errs.push(fieldError_('exec_url', 'URL_INVALID'));
  if (key.length < 24 || key.length > 200) errs.push(fieldError_('key', 'KEY_FORMAT'));
  if (errs.length) throw validationError_(errs);
  var out = syncMachines_(true, { url: url, key: key });
  setProp_('ME_EXEC_URL', url);
  setProp_('ME_FEED_KEY', key);
  withWriteLock_(function () {
    writeAudit_({ user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'me.link.set', entity_type: 'SYSTEM', entity_id: 'ME_LINK', before_json: null, after_json: { exec_url_tail: url.slice(-12), linked: true }, operation_id: ctx.req.operation_id || '', auth_basis: authBasis_(ctx) });
  });
  cache_().remove('sys:props');
  return { linked: true, sync: out };
}

/** Trạng thái kết nối M&E cho màn quản trị (không lộ mã kết nối) */
function meLinkInfo_(st) {
  var url = prop_('ME_EXEC_URL') || '';
  return {
    linked: meLinked_(), exec_url_tail: url ? '…' + url.slice(-14) : '',
    last_sync_at: stateGet_(st, 'me_last_sync_at', ''), last_sync_status: stateGet_(st, 'me_last_sync_status', ''),
    last_sync_error: stateGet_(st, 'me_last_sync_error', '')
  };
}
