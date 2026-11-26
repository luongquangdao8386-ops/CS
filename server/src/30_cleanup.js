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
