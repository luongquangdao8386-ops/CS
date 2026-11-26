/* 30_cleanup: dọn dữ liệu kỹ thuật cũ để bảng tính không phình mãi (chạy trong runBackgroundJobs, tối đa 1 lần/ngày).
 * - Sessions: phiên đã hết hạn hoặc bị thu hồi quá 30 ngày (phiên còn hiệu lực không đụng).
 * - AuthAttempts: lần đăng nhập cũ hơn auth_attempts_retention_days (Cấu hình, mặc định 90 ngày).
 * - Operations: thao tác đã ghi xong (COMMITTED) quá 90 ngày — chỉ dùng để chống ghi trùng khi app gửi lại; thao tác chưa xong giữ nguyên.
 * Không xóa AuditLogs (nhật ký thao tác là hồ sơ) và không xóa dữ liệu nghiệp vụ. Xóa dưới khóa ghi, mỗi bảng tối đa CLEANUP_MAX_ROWS_ dòng/lần. */

var CLEANUP_SESSION_DAYS_ = 30;
var CLEANUP_OPS_DAYS_ = 90;
var CLEANUP_MAX_ROWS_ = 20000;
var CLEANUP_EVERY_MS_ = 20 * 3600000;

/** Dọn; force = chạy ngay (bỏ qua mốc 1 lần/ngày). Trả số dòng đã xóa mỗi bảng hoặc null khi chưa tới lượt */
function cleanupOld_(force) {
  var nowMs = now_().getTime();
  var day = 86400000;
  var ms = function (v) { var t = parseTime_(v); return t ? t.getTime() : 0; };
  var ids = function (name, cols, pred) {
    var key = sheetSchema_(name).key;
    return readCols_(name, cols).filter(pred).slice(0, CLEANUP_MAX_ROWS_).map(function (r) { return r[key]; });
  };
  return withWriteLock_(function () {
    var st = readState_();
    var last = ms(stateGet_(st, 'last_cleanup_at', ''));
    if (!force && last && nowMs - last < CLEANUP_EVERY_MS_) return null;
    var sCut = nowMs - CLEANUP_SESSION_DAYS_ * day;
    var aCut = nowMs - Math.max(7, Number(setting_('auth_attempts_retention_days') || 90)) * day;
    var oCut = nowMs - CLEANUP_OPS_DAYS_ * day;
    var out = {
      sessions: deleteWhere_('Sessions', 'session_id', ids('Sessions', ['expires_at', 'revoked_at'], function (r) {
        var e = ms(r.expires_at), v = ms(r.revoked_at);
        return (v && v < sCut) || (e && e < sCut);
      })),
      auth_attempts: deleteWhere_('AuthAttempts', 'attempt_id', ids('AuthAttempts', ['occurred_at'], function (r) {
        var t = ms(r.occurred_at);
        return t && t < aCut;
      })),
      operations: deleteWhere_('Operations', 'operation_id', ids('Operations', ['state', 'received_at'], function (r) {
        var t = ms(r.received_at);
        return r.state === 'COMMITTED' && t && t < oCut;
      }))
    };
    stateWrite_(st, { last_cleanup_at: ['DATETIME', isoVN_(now_())], last_cleanup_counts: ['STRING', JSON.stringify(out)] }, SYSTEM_USER);
    return out;
  });
}

/** Chạy tay từ trình soạn: dọn ngay và in số dòng đã xóa */
function adminCleanupNow() {
  dbReset_();
  log_('Đã dọn dữ liệu cũ: ' + JSON.stringify(cleanupOld_(true)));
}

/**
 * Lượt kiểm lưu trước d1.6 bị tính "Kiểm dở" chỉ vì mục không bắt buộc để trống: tính lại theo mục bắt buộc của đúng phiên bản mẫu
 * (Xong = có ít nhất một mục đã nhập và mọi mục bắt buộc đã nhập). Chỉ đổi status (không đổi record_version, không đụng nội dung);
 * tăng sync_revision để điện thoại nhận trạng thái mới. Ghi theo khúc 50 lượt để không giữ khóa ghi lâu. Trả số lượt đã đổi.
 */
function recomputePartialRuns_() {
  var runs = readRowsWhere_('Runs', ['status'], function (r) { return r.status === 'PARTIAL'; });
  if (!runs.length) return 0;
  var req = {};
  readRows_('TemplateItems').forEach(function (t) { req[t.template_id + '|' + Number(t.revision) + '|' + t.item_key] = t.required !== false; });
  var writes = [];
  runs.forEach(function (r) {
    if (r.archived_at) return;
    var filled = 0, missingReq = 0;
    (r.results_json || []).forEach(function (x) {
      var isReq = req[r.template_id + '|' + Number(r.template_revision) + '|' + x.item_key];
      if (!x.result || x.result === 'EMPTY') { if (isReq !== false) missingReq++; } else filled++;
    });
    if (filled > 0 && !missingReq) writes.push({ sheet: 'Runs', mode: 'update', partial: true, row: { run_id: r.run_id, status: 'DONE' } });
  });
  for (var i = 0; i < writes.length; i += 50) {
    systemWrite_(writes.slice(i, i + 50), { action: 'run.recomputeStatus', entity_type: 'RUN', after_json: { done: Math.min(50, writes.length - i) } });
  }
  return writes.length;
}

/** Một lần sau khi lên d1.6 (runBackgroundJobs gọi): tính lại các lượt "Kiểm dở" cũ */
function recomputePartialRunsOnce_() {
  if (stateGet_(readState_(), 'runs_status_v2', false)) return null;
  var n = recomputePartialRuns_();
  withWriteLock_(function () { var st = readState_(); stateWrite_(st, { runs_status_v2: ['BOOL', true] }, SYSTEM_USER); });
  return n;
}

/** Chạy tay từ trình soạn: tính lại ngay các lượt "Kiểm dở" */
function adminRecomputeRunStatus() {
  dbReset_();
  log_('Đã tính lại trạng thái: ' + recomputePartialRuns_() + ' lượt kiểm chuyển sang Xong.');
}
