/* 29_feed: cửa chỉ-đọc "ngày có hồ sơ" cho app ISO · 体系管理 (1.0.0-d1.5, theo Phần K hướng dẫn của app ISO — hợp đồng).
 * App ISO (máy chủ ISO, mỗi giờ) hỏi: mã biểu nào có lượt kiểm vào ngày nào. Không cần phiên; khóa bằng mã kết nối FEED_KEY_ISO trong
 * Thuộc tính tập lệnh (tạo bằng adminCreateFeedKeyIso, chép sang app ISO → Quản trị → Kết nối M&E / Checksheet). Riêng với mã
 * kết nối M&E (ME_FEED_KEY) mà Checksheet dùng để lấy thiết bị.
 *
 *   POST {api_contract_version:'1.0', action:'feed.isoEvidence', payload:{key, since:'YYYY-MM-DD', client:'ISO'}, device_id, app_version}
 *   → data = {app_id:'CS', items:[{form_code, date, count}], server_time}
 *
 * Ngày có hồ sơ = ngày làm việc (Runs.work_date) của lượt kiểm thuộc mẫu có Templates.form_code; count = số lượt kiểm trong ngày của
 * các mẫu mang mã đó (mẫu đã ngừng vẫn tính lượt cũ; lượt đã xóa — archived_at — không tính). Chỉ trả mã biểu, ngày, số lượt:
 * không có tên máy, người kiểm, kết quả hay ảnh. App ISO không ghi gì sang Checksheet. */

var ISO_FEED_DAYS_ = 400;        // since cũ hơn hôm nay − 400 ngày thì tự cắt
var ISO_FEED_MAX_ITEMS_ = 60000; // tối đa của hợp đồng (giữ các ngày gần nhất)
var ISO_FEED_MIN_KEY_ = 24;      // mã ngắn hơn coi như chưa đặt (giống feed.equipment của M&E)

/** feed.isoEvidence {key, since?, client?} — public, chỉ đọc; thiếu hoặc sai mã → FORBIDDEN */
function feedIsoEvidence_(req) {
  var p = req.payload || {};
  var want = prop_('FEED_KEY_ISO') || '';
  if (want.length < ISO_FEED_MIN_KEY_ || !ctEqualStr_(String(p.key || ''), want)) throw apiError_('FORBIDDEN');
  var today = todayVN_();
  var floor = addDaysIso_(today, -ISO_FEED_DAYS_);
  var since = trimStr_(p.since);
  if (!isDateStr_(since) || since < floor) since = floor;
  return { app_id: APP_ID, items: isoEvidenceItems_(since, today), server_time: isoVN_(now_()) };
}

/** [{form_code, date, count}] của các ngày làm việc trong [since, today], mới nhất trước khi phải cắt */
function isoEvidenceItems_(since, today) {
  var tc = tableCache_(['Templates', 'Runs'], readState_());
  var codeOf = {};
  tc.rows('Templates').forEach(function (t) {
    var c = trimStr_(t.form_code);
    if (c) codeOf[t.template_id] = c;
  });
  var counts = {};
  tc.rows('Runs').forEach(function (r) {
    if (r.archived_at) return;
    var code = codeOf[r.template_id];
    var d = String(r.work_date || '');
    if (!code || !isDateStr_(d) || d < since || d > today) return;
    var k = code + '\n' + d;
    counts[k] = (counts[k] || 0) + 1;
  });
  var items = Object.keys(counts).map(function (k) {
    var i = k.indexOf('\n');
    return { form_code: k.slice(0, i), date: k.slice(i + 1), count: counts[k] };
  });
  items.sort(function (a, b) {
    return a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.form_code < b.form_code ? -1 : (a.form_code > b.form_code ? 1 : 0));
  });
  return items.slice(0, ISO_FEED_MAX_ITEMS_);
}

/**
 * Chạy từ trình soạn: tạo mã kết nối cho app ISO (một lần) và in ra nhật ký để chép sang app ISO → Tài khoản → Quản trị →
 * Kết nối M&E / Checksheet → thẻ App Checksheet. Đã có mã thì in lại mã cũ (không đổi, app ISO vẫn chạy).
 * Muốn đổi mã (lộ mã): xóa FEED_KEY_ISO trong Thuộc tính tập lệnh rồi chạy lại, dán mã mới bên app ISO.
 */
function adminCreateFeedKeyIso() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty('FEED_KEY_ISO');
  if (!k || k.length < ISO_FEED_MIN_KEY_) {
    k = b64url_(randomSecret32_());
    props.setProperty('FEED_KEY_ISO', k);
    log_('Đã tạo mã kết nối mới cho app ISO.');
  }
  log_('Mã kết nối cho app ISO: ' + k);
  log_('Chép mã này và link /exec của máy chủ Checksheet này sang app ISO → Tài khoản → Quản trị → Kết nối M&E / Checksheet → thẻ App Checksheet. Không gửi mã qua chat.');
}
