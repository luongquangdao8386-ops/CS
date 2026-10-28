/**
 * Checksheet · 点检表 — Code.gs 1.0.0-d1.1
 * TỆP TẠO TỰ ĐỘNG từ server/src/*.js bằng "npm run build". Không sửa tay.
 * Dán toàn bộ nội dung vào tệp Code.gs của dự án Apps Script Checksheet.
 * Không chứa ID, khóa bí mật hay dữ liệu: các giá trị đó nằm trong Thuộc tính tập lệnh.
 */

// ===== 00_config.js =====
/* =====================================================================
 * Checksheet · 点检表 — máy chủ Google Apps Script
 * 00_config: hằng số, Settings mặc định, khóa SystemState
 * Lõi (PIN, phiên, ghi có xác nhận, đồng bộ, hàng chờ offline) lấy từ app M&E đã chạy THẬT.
 * ===================================================================== */

var APP_ID = 'CS';
var SERVER_VERSION = '1.0.0-d1.1';
var API_CONTRACT_VERSION = '1.0';
var SCHEMA_VERSION = '1.0.0';
var TZ = 'Asia/Ho_Chi_Minh';
var TZ_OFFSET_MIN = 7 * 60; // Việt Nam không có giờ mùa hè
var RELEASED_DOT = 1;

var SCHEMA_DOTS_ = { '1.0.0': 1 };
var NAME_PREFIX = 'CS_';    // tên spreadsheet, thư mục Drive

/** Bản ghi do máy chủ tạo thay mặt hệ thống (lấy thiết bị từ M&E, dịch nền, trigger). */
var SYSTEM_USER = 'SYSTEM';

/** Ca mặc định: ca 3 qua nửa đêm tính vào ngày bắt đầu ca */
var DEFAULT_SHIFTS_ = [{ no: 1, start: '06:00', end: '14:00' }, { no: 2, start: '14:00', end: '22:00' }, { no: 3, start: '22:00', end: '06:00' }];

/**
 * Settings mặc định.
 * [khóa, kiểu, mặc định, gửi xuống client, đợt, mô tả Việt, mô tả Trung]
 */
var SETTINGS_DEFAULTS = [
  ['session_days', 'INT', 30, true, 1, 'Số ngày của phiên đăng nhập', '登录会话天数'],
  ['session_warn_days', 'INT', 3, true, 1, 'Cảnh báo trước khi phiên hết hạn (ngày)', '会话到期前提醒天数'],
  ['change_pin_session_minutes', 'INT', 10, false, 1, 'Hạn phiên đổi PIN (phút)', '修改PIN会话时限（分钟）'],
  ['reauth_window_minutes', 'INT', 5, true, 1, 'Hạn của lần nhập lại PIN (phút)', '重新输入PIN有效时间（分钟）'],
  ['temp_pin_hours', 'INT', 72, false, 1, 'Hạn PIN tạm (giờ)', '临时PIN有效期（小时）'],
  ['max_sessions_per_user', 'INT', 10, false, 1, 'Số phiên tối đa mỗi người', '每人最多会话数'],
  ['login_fail_limit', 'INT', 5, false, 1, 'Số lần sai PIN trước khi khóa', '锁定前允许输错PIN次数'],
  ['login_fail_window_minutes', 'INT', 15, false, 1, 'Cửa sổ đếm lần sai (phút)', '输错计数时间窗（分钟）'],
  ['login_lock_minutes', 'INT', 15, false, 1, 'Thời gian khóa (phút)', '锁定时长（分钟）'],
  ['login_global_fail_limit', 'INT', 30, false, 1, 'Số lần sai toàn hệ thống trước khi tạm dừng', '全系统暂停登录前的输错次数'],
  ['login_global_window_minutes', 'INT', 10, false, 1, 'Cửa sổ đếm sai toàn hệ thống (phút)', '全系统输错计数时间窗（分钟）'],
  ['login_global_pause_minutes', 'INT', 10, false, 1, 'Thời gian tạm dừng đăng nhập (phút)', '暂停登录时长（分钟）'],
  ['auth_attempts_retention_days', 'INT', 90, false, 1, 'Số ngày giữ nhật ký đăng nhập', '登录记录保留天数'],
  ['offline_unlock_attempts', 'INT', 5, true, 1, 'Số lần mở khóa ngoại tuyến sai trước khi khóa', '离线解锁锁定前允许输错次数'],
  ['offline_lock_minutes', 'INT', 15, true, 1, 'Thời gian khóa mở khóa ngoại tuyến (phút)', '离线解锁锁定时长（分钟）'],
  ['offline_max_lockouts', 'INT', 3, true, 1, 'Số lần bị khóa liên tiếp trước khi xóa dữ liệu đăng nhập trên máy', '连续锁定次数上限（超出则清除本机登录数据）'],
  ['offline_pbkdf2_iterations', 'INT', 200000, true, 1, 'Số vòng PBKDF2 cho mở khóa ngoại tuyến', '离线解锁PBKDF2迭代次数'],
  ['offline_probe_seconds', 'INT', 12, true, 1, 'Thời gian chờ máy chủ khi mở app (giây)', '打开应用时等待服务器时间（秒）'],
  ['machine_translation_enabled', 'BOOL', true, false, 1, 'Bật dịch máy', '启用机器翻译'],
  ['mt_chunk_chars', 'INT', 1000, false, 1, 'Độ dài tối đa mỗi đoạn dịch', '每段翻译最大字符数'],
  ['mt_max_fields_per_request', 'INT', 20, false, 1, 'Số trường dịch tối đa mỗi lần lưu', '每次保存最多翻译字段数'],
  ['mt_sync_budget_seconds', 'INT', 6, false, 1, 'Thời gian dịch tối đa khi lưu (giây)', '保存时翻译最长时间（秒）'],
  ['mt_daily_budget', 'INT', 3000, false, 1, 'Số lượt dịch tối đa mỗi ngày', '每日最多翻译次数'],
  ['app_base_url', 'STRING', '', false, 1, 'Địa chỉ app', '应用地址'],
  ['min_client_version', 'STRING', '1.0.0', true, 1, 'Phiên bản app tối thiểu', '最低应用版本'],
  ['client_timeout_seconds', 'INT', 30, true, 1, 'Thời gian chờ request thường (giây)', '普通请求超时（秒）'],
  ['client_long_timeout_seconds', 'INT', 55, true, 1, 'Thời gian chờ request dài (giây)', '长请求超时（秒）'],
  ['sync_page_size', 'INT', 500, true, 1, 'Số dòng mỗi trang đồng bộ', '同步每页行数'],
  ['doc_max_bytes', 'INT', 10485760, true, 1, 'Dung lượng tối đa mỗi tệp (byte)', '单个文件最大字节数'],
  ['doc_mobile_upload_max_bytes', 'INT', 5242880, true, 1, 'Dung lượng tối đa mỗi tệp khi tải lên từ điện thoại (byte)', '手机上传单个文件最大字节数'],
  ['photo_max_edge_px', 'INT', 1600, true, 1, 'Cạnh dài tối đa của ảnh (px)', '照片最长边（像素）'],
  ['photo_jpeg_quality', 'NUMBER', 0.8, true, 1, 'Chất lượng JPEG của ảnh', '照片JPEG质量'],
  ['photo_thumb_edge_px', 'INT', 400, true, 1, 'Cạnh dài của ảnh nhỏ (px)', '缩略图最长边（像素）'],
  ['backup_weekday', 'ENUM', 'SUNDAY', false, 1, 'Ngày sao lưu trong tuần', '每周备份日'],
  ['backup_hour', 'INT', 1, false, 1, 'Giờ sao lưu', '备份时间'],
  ['backup_keep_count', 'INT', 8, false, 1, 'Số bản sao lưu giữ lại', '保留备份份数'],
  // Checksheet
  ['shifts_json', 'JSON', DEFAULT_SHIFTS_, true, 1, 'Giờ các ca (ca qua nửa đêm tính vào ngày bắt đầu ca)', '班次时间（跨午夜的班次计入开始日期）'],
  ['runs_sync_days', 'INT', 40, true, 1, 'Số ngày lượt kiểm giữ trên máy', '本机保留点检记录天数'],
  ['missed_lookback_days', 'INT', 7, true, 1, 'Số ngày xem lại máy bỏ sót', '回看漏检天数'],
  ['check_backdate_days', 'INT', 7, false, 1, 'Lượt kiểm ghi muộn tối đa (ngày, khi mất mạng)', '离线补交点检最长天数'],
  ['report_logo_file_id', 'STRING', '', false, 1, 'Tệp logo trên báo cáo (Drive)', '报表标志文件（云端硬盘）'],
  ['report_logo_rev', 'STRING', '', true, 1, 'Phiên bản logo trên báo cáo', '报表标志版本']
];

/** Khóa SystemState ban đầu. Bộ đếm `code_seq.*`, `table_rev.*` thêm khi dùng. */
var SYSTEM_STATE_INITIAL = [
  ['dataset_epoch', 'STRING', ''],
  ['maintenance_mode', 'BOOL', false],
  ['sync_revision', 'INT', 0],
  ['schema_version', 'STRING', SCHEMA_VERSION],
  ['login_paused_until', 'DATETIME', ''],
  ['mt_paused_until', 'DATETIME', ''],
  ['last_backup_at', 'DATETIME', ''],
  ['last_backup_ref', 'STRING', ''],
  ['last_backup_status', 'ENUM', ''],
  ['last_restore_at', 'DATETIME', ''],
  ['restored_from_ref', 'STRING', ''],
  ['restored_backup_at', 'DATETIME', ''],
  ['restored_by', 'STRING', ''],
  ['me_last_sync_at', 'DATETIME', ''],
  ['me_last_sync_status', 'STRING', ''],
  ['me_last_sync_error', 'STRING', ''],
  ['me_source_rev', 'STRING', '']
];

/** Mẫu mã hiển thị. yymm: true khi có phần năm-tháng. */
var CODE_PATTERNS = {
  TEMPLATE: { prefix: 'MS', digits: 4, yymm: false, sheet: 'Templates', col: 'template_code' },
  REPORT: { prefix: 'BC', digits: 3, yymm: true, sheet: null, col: null }
};

/** Loại hồ sơ của ảnh (Documents.entity_type) */
var DOC_ENTITY_SHEETS_ = { RUN: { sheet: 'Runs', key: 'run_id' }, ABNORMAL: { sheet: 'Abnormals', key: 'abnormal_id' } };

/** Trường không dịch tự động. Tên trường gốc (không hậu tố _vi/_zh). */
var NO_MT_FIELDS = {
  Settings: ['description']
};

/** Kiểu nhập của hạng mục và kiểu tiêu chuẩn */
var INPUT_TYPES_ = ['NUMBER', 'THREE_PHASE', 'CHOICE', 'PASS_FAIL', 'TEXT'];
var STD_TYPES_ = ['RANGE', 'MAX', 'MIN', 'TOL', 'NONE'];
var ITEM_GROUPS_ = ['TEMP', 'PRESS', 'ELEC', 'MECH', 'LEVEL', 'QUALITY', 'VISUAL', 'OTHER'];
var FREQUENCIES_ = ['SHIFT', 'DAY', 'WEEK', 'MONTH'];
var CHOICE_RESULTS_ = ['OK', 'WARN', 'FAIL'];

// ===== 01_util.js =====
/* 01_util: thời gian, UUID, byte, băm, mã hóa (phụ lục 1.5 mục 3.1, 3.3, 3.5) */

function now_() {
  return new Date();
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** Đổi Date sang các phần ngày giờ theo giờ Việt Nam (+07:00, không có giờ mùa hè). */
function vnParts_(d) {
  var t = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return {
    y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    hh: t.getUTCHours(), mi: t.getUTCMinutes(), ss: t.getUTCSeconds()
  };
}

/** ISO 8601 có múi giờ, vd 2026-10-07T08:00:00+07:00 */
function isoVN_(d) {
  if (!d) return '';
  var p = vnParts_(d);
  return p.y + '-' + pad2_(p.m) + '-' + pad2_(p.d) + 'T' + pad2_(p.hh) + ':' + pad2_(p.mi) + ':' + pad2_(p.ss) + '+07:00';
}

/** YYYY-MM-DD theo giờ Việt Nam */
function dateVN_(d) {
  var p = vnParts_(d);
  return p.y + '-' + pad2_(p.m) + '-' + pad2_(p.d);
}

/** yymm từ một ngày YYYY-MM-DD hoặc Date */
function yymm_(v) {
  var s = (v instanceof Date) ? dateVN_(v) : String(v);
  var m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return '';
  return m[1].slice(2) + m[2];
}

function parseTime_(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  var t = Date.parse(String(s));
  return isNaN(t) ? null : new Date(t);
}

function isDateStr_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  var d = new Date(String(s) + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === String(s);
}

function unixNow_() {
  return Math.floor(now_().getTime() / 1000);
}

/** UUID v4 chữ thường do máy chủ sinh (3.3) */
function uuid_() {
  return Utilities.getUuid().toLowerCase();
}

var UUID_V4_RE_ = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isUuidV4_(s) {
  return typeof s === 'string' && UUID_V4_RE_.test(s);
}

/* ---------- byte ---------- */

/** Chuỗi → byte UTF-8 (byte có dấu như Java) */
function utf8Bytes_(s) {
  return Utilities.newBlob(String(s)).getBytes();
}

/** Byte có dấu → 0..255 */
function u8_(b) {
  return b & 0xFF;
}

function sha256_(bytesOrString) {
  if (typeof bytesOrString === 'string') {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytesOrString, Utilities.Charset.UTF_8);
  }
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytesOrString);
}

/** HMAC-SHA256(value, key) — dùng overload (byte[] value, byte[] key) */
function hmac256_(valueBytes, keyBytes) {
  return Utilities.computeHmacSha256Signature(valueBytes, keyBytes);
}

function b64_(bytes) {
  return Utilities.base64Encode(bytes);
}

function b64d_(s) {
  return Utilities.base64Decode(s);
}

/** Base64url không đệm (3.5) */
function b64url_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function b64urlDecode_(s) {
  var t = String(s);
  while (t.length % 4) t += '=';
  return Utilities.base64DecodeWebSafe(t);
}

/** So sánh hai mảng byte theo thời gian hằng: XOR cộng dồn, không dừng sớm. */
function ctEqualBytes_(a, b) {
  var n = Math.max(a.length, b.length);
  var diff = a.length ^ b.length;
  for (var i = 0; i < n; i++) {
    var x = i < a.length ? u8_(a[i]) : 0;
    var y = i < b.length ? u8_(b[i]) : 0;
    diff |= (x ^ y);
  }
  return diff === 0;
}

function ctEqualStr_(a, b) {
  return ctEqualBytes_(utf8Bytes_(a || ''), utf8Bytes_(b || ''));
}

/** 16 byte ngẫu nhiên = 16 byte đầu SHA-256(2 UUID) (3.5) */
function randomBytes16_() {
  return sha256_(Utilities.getUuid() + Utilities.getUuid()).slice(0, 16);
}

/** 32 byte bí mật = SHA-256(3 UUID) (3.14) */
function randomSecret32_() {
  return sha256_(Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
}

var CROCKFORD_ = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Mã hóa nChars ký tự Crockford base32 từ các bit đầu của mảng byte */
function crockford_(bytes, nChars) {
  var out = '';
  var bitBuf = 0, bitLen = 0, i = 0;
  while (out.length < nChars) {
    if (bitLen < 5) {
      bitBuf = ((bitBuf << 8) | u8_(bytes[i++])) & 0xFFFF;
      bitLen += 8;
    }
    var idx = (bitBuf >> (bitLen - 5)) & 31;
    bitLen -= 5;
    out += CROCKFORD_.charAt(idx);
  }
  return out;
}

/** qr_key: 20 ký tự Crockford (100 bit) từ SHA-256(2 UUID) (2.8) */
function newQrKey_() {
  return crockford_(sha256_(Utilities.getUuid() + Utilities.getUuid()), 20);
}

var QR_KEY_RE_ = /^[0-9A-HJKMNP-TV-Z]{20}$/;

/** Chuẩn hóa chuỗi nhập tay: bỏ cách/gạch, chữ hoa, O→0, I/L→1 */
function normalizeQrKey_(s) {
  var t = String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return QR_KEY_RE_.test(t) ? t : null;
}

/** JSON ổn định (khóa sắp xếp) để băm payload */
function stableStringify_(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify_).join(',') + ']';
  if (typeof v === 'object') {
    var keys = Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + stableStringify_(v[k]); }).join(',') + '}';
  }
  return JSON.stringify(v);
}

var SECRET_KEYS_ = ['pin', 'current_pin', 'new_pin', 'token', 'reauth_token', 'temp_pin'];

/** Bỏ khóa bí mật khỏi bản sao payload trước khi ghi log/Operations (3.15) */
function redact_(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact_);
  var out = {};
  Object.keys(obj).forEach(function (k) {
    if (SECRET_KEYS_.indexOf(k) >= 0) return;
    if (k === 'content_b64' || k === 'thumb_b64') { out[k] = '[' + String(obj[k] || '').length + ' chars]'; return; }
    out[k] = redact_(obj[k]);
  });
  return out;
}

function clone_(o) {
  return JSON.parse(JSON.stringify(o));
}

function trimStr_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** So sánh phiên bản dạng a.b.c (bỏ phần -poc...) */
function cmpVersion_(a, b) {
  var pa = String(a || '0').split('-')[0].split('.').map(Number);
  var pb = String(b || '0').split('-')[0].split('.').map(Number);
  for (var i = 0; i < 3; i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Trong một request (doPost/doGet) ScriptProperties chỉ đọc một lần; hàm chạy tay thì đọc trực tiếp */
var PROPS_MEMO_ = null, PROPS_MEMO_ON_ = false;

function propsReset_(on) {
  PROPS_MEMO_ = null;
  PROPS_MEMO_ON_ = !!on;
}

function prop_(key) {
  if (!PROPS_MEMO_ON_) return PropertiesService.getScriptProperties().getProperty(key);
  if (!PROPS_MEMO_) PROPS_MEMO_ = PropertiesService.getScriptProperties().getProperties() || {};
  var v = PROPS_MEMO_[key];
  return v === undefined ? null : v;
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
  if (PROPS_MEMO_) PROPS_MEMO_[key] = String(value);
}

function delProp_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
  if (PROPS_MEMO_) delete PROPS_MEMO_[key];
}

function envName_() {
  return prop_('ENV') || 'THU';
}

function isTestEnv_() {
  return envName_() === 'THU';
}

function cache_() {
  return CacheService.getScriptCache();
}

// ===== 02_schema.js =====
/* 02_schema: sheet và cột của Checksheet */

/**
 * Bộ cột C cho bảng nghiệp vụ. `sync_revision` là mốc đồng bộ của dòng (sync.changes lấy dòng đổi sau cursor).
 */
var C_COLS = ['dataset_epoch', 'record_version', 'sync_revision', 'created_at', 'created_by', 'updated_at', 'updated_by', 'archived_at'];

/** Cột tiêu chuẩn dùng chung của thư viện hạng mục và hạng mục trong mẫu */
var STD_COLS_ = 'group_key name_vi name_zh input_type unit std_type std_min std_max std_nominal std_tol_pct warn_lo warn_hi ' +
  'choices_json extra_json std_text_vi std_text_zh how_vi how_zh';

/**
 * book: B = Nghiệp vụ, S = Bảo mật. c: thêm bộ C. i18n: thêm `i18n_meta`.
 * cols: tên cột cách nhau bằng dấu cách; kiểu suy theo tên (colType_), ghi đè bằng "ten:KIEU".
 */
var SHEETS = {
  // ---- Nghiệp vụ ----
  Settings: { book: 'B', dot: 1, key: 'setting_key', i18n: true,
    cols: 'setting_key value:STRING value_type description_vi description_zh updated_at updated_by' },
  SystemState: { book: 'B', dot: 1, key: 'state_key',
    cols: 'state_key value:STRING value_type updated_at updated_by' },
  Glossary: { book: 'B', dot: 1, key: 'glossary_id', c: true,
    cols: 'glossary_id term_vi term_zh note active approved_by approved_at' },
  // Khu vực và thiết bị: chỉ máy chủ ghi, lấy một chiều từ M&E (area_id = location_id, machine_id = equipment_id của M&E)
  Areas: { book: 'B', dot: 1, key: 'area_id', c: true,
    cols: 'area_id area_code name_vi name_zh parent_area_id active source synced_at' },
  Machines: { book: 'B', dot: 1, key: 'machine_id', c: true,
    cols: 'machine_id machine_code name_vi name_zh area_id me_status category_vi category_zh model qr_key active source synced_at' },
  LibraryItems: { book: 'B', dot: 1, key: 'item_id', c: true, i18n: true,
    cols: 'item_id ' + STD_COLS_ + ' sort_order active builtin' },
  Templates: { book: 'B', dot: 1, key: 'template_id', c: true, i18n: true,
    cols: 'template_id template_code name_vi name_zh frequency shifts revision active note_vi note_zh' },
  // Mỗi lần sửa mẫu = một phiên bản mới (đủ các dòng); item_key giữ nguyên qua các phiên bản (tiêu chuẩn riêng theo máy dựa vào đó)
  TemplateItems: { book: 'B', dot: 1, key: 'template_item_id', c: true, i18n: true,
    cols: 'template_item_id template_id revision item_key step_no ' + STD_COLS_ + ' required photo_on_fail library_item_id' },
  Assignments: { book: 'B', dot: 1, key: 'assignment_id', c: true,
    cols: 'assignment_id machine_id template_id active overrides_json start_date note' },
  // Một lượt kiểm = một dòng (kết quả từng hạng mục và tiêu chuẩn lúc kiểm nằm trong results_json)
  Runs: { book: 'B', dot: 1, key: 'run_id', c: true,
    cols: 'run_id machine_id template_id template_revision assignment_id frequency period_key work_date shift status results_json ' +
      'filled_count total_count fail_count warn_count checked_by checked_at note' },
  Abnormals: { book: 'B', dot: 1, key: 'abnormal_id', c: true, i18n: true,
    cols: 'abnormal_id run_id machine_id template_id item_key item_name_vi item_name_zh value_text std_text result note ' +
      'period_key work_date shift reported_by reported_at status resolution_vi resolution_zh resolved_by resolved_at' },
  MissedReasons: { book: 'B', dot: 1, key: 'missed_id', c: true, i18n: true,
    cols: 'missed_id assignment_id machine_id template_id period_key work_date shift reason_vi reason_zh recorded_by recorded_at' },
  DayConfirms: { book: 'B', dot: 1, key: 'confirm_id', c: true,
    cols: 'confirm_id work_date area_id confirmed_by confirmed_at summary_json' },
  Documents: { book: 'B', dot: 1, key: 'document_id', c: true,
    cols: 'document_id entity_type entity_id parent_run_id kind drive_file_id mime_type access_scope active managed_folder_id ' +
      'owned_by_app drive_sharing_state sharing_updated_at sharing_error_code size_bytes thumb_drive_file_id item_key' },
  AuditLogs: { book: 'B', dot: 1, key: 'audit_id',
    cols: 'audit_id occurred_at user_id device_id action entity_type entity_id before_json after_json operation_id ' +
      'import_batch_id dataset_epoch reason auth_basis' },
  Operations: { book: 'B', dot: 1, key: 'operation_id',
    cols: 'operation_id user_id device_id entity_type entity_id expected_version received_at state result_code sync_revision ' +
      'committed_at dataset_epoch action payload_hash intent_json progress_json result_json' },

  // ---- Bảo mật ----
  Users: { book: 'S', dot: 1, key: 'user_id',
    cols: 'user_id employee_code display_name email role_level active pin_hash salt pin_hash_version failed_attempts ' +
      'locked_until created_at updated_at auth_version is_system_owner must_change_pin temp_pin_expires_at pin_changed_at ' +
      'failed_window_started_at last_login_at record_version created_by updated_by area_ids' },
  Sessions: { book: 'S', dot: 1, key: 'session_id',
    cols: 'session_id token_hash user_id device_id issued_at expires_at revoked_at auth_version dataset_epoch app_id ' +
      'origin_key session_kind last_seen_at revoke_reason device_label' },
  AuthAttempts: { book: 'S', dot: 1, key: 'attempt_id',
    cols: 'attempt_id occurred_at employee_code_hash device_id outcome attempt_kind user_id' }
};

var TYPE_OVERRIDES_ = {
  drive_file_id: 'STRING', managed_folder_id: 'STRING', thumb_drive_file_id: 'STRING',
  employee_code_hash: 'STRING', token_hash: 'STRING', payload_hash: 'STRING', pin_hash: 'STRING', salt: 'STRING',
  qr_key: 'STRING', origin_key: 'STRING', area_ids: 'STRING', item_key: 'STRING', period_key: 'STRING',
  record_version: 'INT', sync_revision: 'INT', role_level: 'INT', auth_version: 'INT', failed_attempts: 'INT',
  size_bytes: 'INT', revision: 'INT', template_revision: 'INT', step_no: 'INT', sort_order: 'INT', expected_version: 'INT',
  shift: 'STRING', shifts: 'STRING',
  filled_count: 'INT', total_count: 'INT', fail_count: 'INT', warn_count: 'INT',
  std_min: 'NUMBER', std_max: 'NUMBER', std_nominal: 'NUMBER', std_tol_pct: 'NUMBER', warn_lo: 'NUMBER', warn_hi: 'NUMBER',
  active: 'BOOL', owned_by_app: 'BOOL', must_change_pin: 'BOOL', is_system_owner: 'BOOL', builtin: 'BOOL', required: 'BOOL',
  photo_on_fail: 'BOOL', i18n_meta: 'JSON', schema_version: 'STRING', email: 'STRING', note: 'STRING',
  start_date: 'DATE', work_date: 'DATE'
};

/** Kiểu cột suy theo tên. */
function colType_(name) {
  if (TYPE_OVERRIDES_[name]) return TYPE_OVERRIDES_[name];
  if (/^can_/.test(name)) return 'BOOL';
  if (/_json$/.test(name)) return 'JSON';
  if (/_id$/.test(name)) return 'ID';
  if (/_code$/.test(name)) return 'CODE';
  if (/_at$/.test(name) || /_until$/.test(name)) return 'DATETIME';
  if (/_date$/.test(name)) return 'DATE';
  return 'STRING';
}

var TEXT_FORMAT_TYPES_ = { ID: 1, CODE: 1, DATE: 1, DATETIME: 1, JSON: 1, STRING: 1, ENUM: 1 };

var schemaCache_ = {};

/** Danh sách cột và kiểu của một sheet: {cols:[name], types:{name:type}} */
function sheetSchema_(name) {
  if (schemaCache_[name]) return schemaCache_[name];
  var def = SHEETS[name];
  if (!def) throw new Error('Unknown sheet ' + name);
  var cols = [], types = {};
  def.cols.split(/\s+/).filter(String).forEach(function (spec) {
    var p = spec.split(':');
    cols.push(p[0]);
    types[p[0]] = p[1] || colType_(p[0]);
  });
  if (def.c) C_COLS.forEach(function (c) { if (cols.indexOf(c) < 0) { cols.push(c); types[c] = colType_(c); } });
  if (def.i18n && cols.indexOf('i18n_meta') < 0) { cols.push('i18n_meta'); types.i18n_meta = 'JSON'; }
  schemaCache_[name] = { cols: cols, types: types, key: def.key, book: def.book, dot: def.dot };
  return schemaCache_[name];
}

/** Sheet thuộc đợt ≤ dot */
function sheetsForDot_(dot) {
  return Object.keys(SHEETS).filter(function (n) { return SHEETS[n].dot <= dot; });
}

/** Giá trị JS → ô Sheet */
function toCell_(type, v) {
  if (v === null || v === undefined) return '';
  switch (type) {
    case 'BOOL': return v === true || v === 'TRUE' || v === 'true';
    case 'INT':
    case 'NUMBER':
      if (v === '') return '';
      var n = Number(v);
      return isNaN(n) ? '' : n;
    case 'JSON': {
      var s = typeof v === 'string' ? v : JSON.stringify(v);
      if (s.length > 50000) throw new Error('JSON cell too large');
      return s;
    }
    default: return String(v);
  }
}

/** Ô Sheet → giá trị JS */
function fromCell_(type, v) {
  switch (type) {
    case 'BOOL': return v === true || v === 'TRUE' || v === 'true';
    case 'INT':
    case 'NUMBER':
      if (v === '' || v === null || v === undefined) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    case 'DATE':
      if (v instanceof Date) return dateVN_(v);
      return v === null || v === undefined ? '' : String(v);
    case 'DATETIME':
      if (v instanceof Date) return isoVN_(v);
      return v === null || v === undefined ? '' : String(v);
    case 'JSON':
      if (v === '' || v === null || v === undefined) return null;
      try { return JSON.parse(String(v)); } catch (e) { return null; }
    default:
      return v === null || v === undefined ? '' : String(v);
  }
}

// ===== 03_db.js =====
/* 03_db: đọc/ghi Sheet theo tên cột; SystemState; Settings */

var DB_ = { books: {}, sheets: {}, headers: {}, settings: null };

/** Xóa bộ nhớ đệm trong một lần chạy (dùng trong test và sau setup) */
function dbReset_() {
  DB_ = { books: {}, sheets: {}, headers: {}, settings: null };
  if (PROPS_MEMO_ON_) propsReset_(true);
}

function book_(b) {
  if (!DB_.books[b]) {
    var id = prop_(b === 'S' ? 'SECURITY_SPREADSHEET_ID' : 'BUSINESS_SPREADSHEET_ID');
    if (!id) throw apiError_('SYSTEM_NOT_READY');
    DB_.books[b] = SpreadsheetApp.openById(id);
  }
  return DB_.books[b];
}

function sh_(name) {
  if (!DB_.sheets[name]) {
    var s = sheetSchema_(name);
    var sheet = book_(s.book).getSheetByName(name);
    if (!sheet) throw apiError_('SYSTEM_NOT_READY', { missing_sheet: name });
    DB_.sheets[name] = sheet;
  }
  return DB_.sheets[name];
}

/** Hàng tiêu đề thực tế của sheet (có thể nhiều cột hơn schema sau migrate) */
function hdr_(name) {
  if (!DB_.headers[name]) {
    var sheet = sh_(name);
    var n = sheet.getLastColumn();
    setHeader_(name, n > 0 ? sheet.getRange(1, 1, 1, n).getValues()[0] : []);
  }
  return DB_.headers[name];
}

/** Ghi nhớ tiêu đề trong lượt chạy; bỏ các cột trống ở cuối (không tên thì không đọc/ghi) */
function setHeader_(name, row) {
  var cols = row.map(function (v) { return v === null || v === undefined ? '' : String(v); });
  while (cols.length && cols[cols.length - 1] === '') cols.pop();
  var idx = {};
  cols.forEach(function (c, i) { if (c) idx[c] = i; });
  DB_.headers[name] = { cols: cols, idx: idx };
  return DB_.headers[name];
}

function rowToObj_(name, h, r, rowNum) {
  var types = sheetSchema_(name).types;
  var o = { __row: rowNum };
  for (var j = 0; j < h.cols.length; j++) {
    var c = h.cols[j];
    if (!c) continue;
    o[c] = fromCell_(types[c] || 'STRING', r[j]);
  }
  return o;
}

function objToRow_(name, h, o) {
  var types = sheetSchema_(name).types;
  return h.cols.map(function (c) { return toCell_(types[c] || 'STRING', o[c]); });
}

/**
 * Đọc toàn bộ dòng dữ liệu. Bảng trống: 1 lần gọi Sheets (getLastRow); có dữ liệu: đọc tiêu đề cùng dữ liệu trong một
 * getValues (getLastRow + getLastColumn + getValues = 3 lần; trước là 4 vì đọc tiêu đề riêng).
 */
function readRows_(name) {
  var sheet = sh_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var n = DB_.headers[name] ? DB_.headers[name].cols.length : sheet.getLastColumn();
  if (!n) return [];
  var vals = sheet.getRange(1, 1, last, n).getValues();
  var h = setHeader_(name, vals[0]);
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) continue;
    out.push(rowToObj_(name, h, vals[i], i + 1));
  }
  return out;
}

/* ---------------- Đệm bảng theo phiên bản bảng (đăng nhập/đồng bộ đọc hàng chục bảng) ---------------- */

var TBL_CHUNK_ = 30000;      // ký tự mỗi ô đệm (≤ 100 KB kể cả chữ Việt/Trung 3 byte)
var TBL_CACHE_V_ = 1;        // tăng khi đổi cách chuyển ô → bản ghi (rowToObj_/fromCell_); dán Code.gs mới không làm mất đệm
var TBL_MAX_CHUNKS_ = 40;    // bảng lớn hơn ~1,2 triệu ký tự thì không đệm

function tblKey_(name, st) {
  var props = sysProps_();
  return 'tb' + TBL_CACHE_V_ + ':' + name + ':' + Number(stateGet_(st, 'table_rev.' + name, 0)) + ':' + (props.dataset_epoch || '') + ':' +
    (st.map.schema_version || '') + ':' + (st.map.last_restore_at || '') + ':' + (st.map.last_reset_at || '');
}

/**
 * Bộ đọc bảng có đệm CacheService theo table_rev: bảng không đổi phiên bản từ lần đọc trước thì không gọi Sheets.
 * Mọi ghi qua executeWrite_ tăng table_rev của bảng đã ghi — cùng điều kiện mà sync.changes dựa vào để biết bảng đổi.
 * st = readState_(). Trả {rows(name)}: bản sao mới mỗi lần (người gọi được sửa thoải mái).
 */
function tableCache_(names, st) {
  var c = cache_();
  var keys = {};
  names.forEach(function (n) { keys[n] = tblKey_(n, st); });
  var metas = {}, chunks = {};
  try {
    metas = c.getAll(names.map(function (n) { return keys[n]; })) || {};
    var need = [];
    names.forEach(function (n) { var m = Number(metas[keys[n]] || 0); for (var i = 0; i < m; i++) need.push(keys[n] + ':' + i); });
    if (need.length) chunks = c.getAll(need) || {};
  } catch (e) { metas = {}; chunks = {}; }
  return {
    rows: function (n) {
      var k = keys[n] || tblKey_(n, st);
      var m = Number(metas[k] || 0);
      if (m) {
        var parts = [];
        for (var i = 0; i < m; i++) { var v = chunks[k + ':' + i]; if (v === null || v === undefined) { parts = null; break; } parts.push(v); }
        if (parts) { try { return JSON.parse(parts.join('')); } catch (e) { /* đọc lại từ Sheets */ } }
      }
      var rows = readRows_(n);
      try {
        var js = JSON.stringify(rows);
        if (js.length <= TBL_CHUNK_ * TBL_MAX_CHUNKS_) {
          var put = {}, cnt = 0;
          for (var j = 0; j < js.length; j += TBL_CHUNK_) put[k + ':' + (cnt++)] = js.slice(j, j + TBL_CHUNK_);
          put[k] = String(cnt);
          c.putAll(put, 21600);
          metas[k] = String(cnt);
          Object.keys(put).forEach(function (pk) { if (pk !== k) chunks[pk] = put[pk]; });
        }
      } catch (e2) { /* đầy đệm: bỏ qua */ }
      return rows;
    }
  };
}

/** Đọc các dòng từ dòng `fromRow` tới cuối (đọc phần đuôi, vd AuthAttempts) */
function readTail_(name, maxRows) {
  var sheet = sh_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - maxRows + 1);
  var h = hdr_(name);
  var vals = sheet.getRange(start, 1, last - start + 1, h.cols.length).getValues();
  return vals.map(function (r, i) { return rowToObj_(name, h, r, start + i); });
}

function readRowAt_(name, rowNum) {
  var h = hdr_(name);
  var r = sh_(name).getRange(rowNum, 1, 1, h.cols.length).getValues()[0];
  return rowToObj_(name, h, r, rowNum);
}

/** Tìm các số dòng có ô `col` khớp nguyên ô `value` */
function findRowNums_(name, col, value) {
  if (value === null || value === undefined || value === '') return [];
  var sheet = sh_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var h = hdr_(name);
  var ci = h.idx[col];
  if (ci === undefined) throw new Error('Unknown column ' + name + '.' + col);
  var found = sheet.getRange(2, ci + 1, last - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findAll();
  return found.map(function (r) { return r.getRow(); });
}

function findOne_(name, col, value) {
  var rows = findRowNums_(name, col, value);
  if (!rows.length) return null;
  return readRowAt_(name, rows[0]);
}

function findAll_(name, col, value) {
  return findRowNums_(name, col, value).map(function (r) { return readRowAt_(name, r); });
}

function ensureRows_(sheet, needLastRow, name) {
  var max = sheet.getMaxRows();
  if (needLastRow > max) {
    var add = needLastRow - max + 500;
    sheet.insertRowsAfter(max, add);
    applyColumnFormats_(sheet, name, max + 1, add);
  }
}

/** Thêm dòng ở cuối; trả số dòng đầu tiên */
function insertRows_(name, objs) {
  if (!objs.length) return 0;
  var sheet = sh_(name);
  var h = hdr_(name);
  var start = sheet.getLastRow() + 1;
  ensureRows_(sheet, start + objs.length - 1, name);
  var values = objs.map(function (o) { return objToRow_(name, h, o); });
  sheet.getRange(start, 1, values.length, h.cols.length).setValues(values);
  objs.forEach(function (o, i) { o.__row = start + i; });
  return start;
}

/** Ghi đè cả dòng */
function writeRow_(name, rowNum, obj) {
  var h = hdr_(name);
  sh_(name).getRange(rowNum, 1, 1, h.cols.length).setValues([objToRow_(name, h, obj)]);
}

/** Ghi một vài ô của một dòng */
function writeCells_(name, rowNum, partial) {
  var h = hdr_(name);
  var types = sheetSchema_(name).types;
  var sheet = sh_(name);
  Object.keys(partial).forEach(function (c) {
    if (c === '__row') return;
    var ci = h.idx[c];
    if (ci === undefined) throw new Error('Unknown column ' + name + '.' + c);
    sheet.getRange(rowNum, ci + 1).setValue(toCell_(types[c] || 'STRING', partial[c]));
  });
}

/** Định dạng ô Văn bản cho cột ID/CODE/DATE/DATETIME/JSON/STRING/ENUM (3.1) ở các dòng mới thêm */
function applyColumnFormats_(sheet, name, fromRow, numRows) {
  var types = sheetSchema_(name).types;
  var n = sheet.getLastColumn();
  var header = n > 0 ? sheet.getRange(1, 1, 1, n).getValues()[0] : [];
  header.forEach(function (c, i) {
    var t = types[String(c)] || 'STRING';
    if (TEXT_FORMAT_TYPES_[t]) sheet.getRange(fromRow, i + 1, numRows, 1).setNumberFormat('@');
  });
}

/* ---------------- SystemState ---------------- */

function parseStateValue_(type, v) {
  var s = v === null || v === undefined ? '' : String(v);
  if (type === 'INT' || type === 'NUMBER') return s === '' ? 0 : Number(s);
  if (type === 'BOOL') return s === 'true' || s === 'TRUE';
  if (type === 'JSON') { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  if (v instanceof Date) return isoVN_(v);
  return s;
}

function stateValueToCell_(type, v) {
  if (type === 'JSON') return JSON.stringify(v);
  if (type === 'BOOL') return v ? 'true' : 'false';
  return v === null || v === undefined ? '' : String(v);
}

/** Đọc SystemState (đọc thẳng Sheet; dùng dưới khóa ghi) */
function readState_() {
  var rows = readRows_('SystemState');
  var st = { map: {}, rows: {} };
  rows.forEach(function (r) {
    st.map[r.state_key] = parseStateValue_(r.value_type, r.value);
    st.rows[r.state_key] = { row: r.__row, type: r.value_type };
  });
  return st;
}

function stateGet_(st, key, def) {
  return Object.prototype.hasOwnProperty.call(st.map, key) ? st.map[key] : def;
}

/** Ghi nhiều khóa SystemState; khóa mới thêm dòng. updates: {key: [type, value]} */
function stateWrite_(st, updates, by) {
  var nowIso = isoVN_(now_());
  var inserts = [];
  Object.keys(updates).forEach(function (k) {
    var type = updates[k][0], val = updates[k][1];
    if (st.rows[k]) {
      writeCells_('SystemState', st.rows[k].row, { value: stateValueToCell_(type, val), updated_at: nowIso, updated_by: by || SYSTEM_USER });
    } else {
      inserts.push({ state_key: k, value: stateValueToCell_(type, val), value_type: type, updated_at: nowIso, updated_by: by || SYSTEM_USER });
    }
    st.map[k] = val;
  });
  if (inserts.length) {
    insertRows_('SystemState', inserts);
    inserts.forEach(function (o) { st.rows[o.state_key] = { row: o.__row, type: o.value_type }; });
  }
}

/** SystemState qua cache `sys:state` (TTL 60 giây, 3.7) */
function sysStateCached_() {
  var c = cache_().get('sys:state');
  if (c) return JSON.parse(c);
  var st = readState_().map;
  var small = {
    perm_version: st.perm_version || 1,
    login_paused_until: st.login_paused_until || '',
    mt_paused_until: st.mt_paused_until || '',
    last_reset_at: st.last_reset_at || '',
    last_restore_at: st.last_restore_at || '',
    restored_backup_at: st.restored_backup_at || '',
    schema_version: st.schema_version || ''
  };
  cache_().put('sys:state', JSON.stringify(small), 60);
  return small;
}

/** ScriptProperties không bí mật qua cache `sys:props` (TTL 30 giây) */
function sysProps_() {
  var c = cache_().get('sys:props');
  if (c) return JSON.parse(c);
  var props = {
    dataset_epoch: prop_('DATASET_EPOCH') || '',
    maintenance_mode: prop_('MAINTENANCE_MODE') === 'true',
    env: envName_()
  };
  cache_().put('sys:props', JSON.stringify(props), 30);
  return props;
}

/* ---------------- Settings ---------------- */

function parseSetting_(type, v) {
  if (type === 'INT' || type === 'NUMBER') return v === '' ? null : Number(v);
  if (type === 'BOOL') return String(v) === 'true' || String(v) === 'TRUE' || v === true;
  if (type === 'JSON') { try { return JSON.parse(String(v)); } catch (e) { return null; } }
  return String(v);
}

/** Settings: Sheet → cache 60 giây; thiếu khóa thì lấy mặc định */
function settings_() {
  if (DB_.settings) return DB_.settings;
  var c = cache_().get('cfg:settings');
  var map;
  if (c) {
    map = JSON.parse(c);
  } else {
    map = {};
    SETTINGS_DEFAULTS.forEach(function (d) { map[d[0]] = d[2]; });
    try {
      readRows_('Settings').forEach(function (r) { map[r.setting_key] = parseSetting_(r.value_type, r.value); });
    } catch (e) {
      // trước setup: dùng mặc định
    }
    cache_().put('cfg:settings', JSON.stringify(map), 60);
  }
  DB_.settings = map;
  return map;
}

function setting_(key) {
  var m = settings_();
  if (Object.prototype.hasOwnProperty.call(m, key)) return m[key];
  for (var i = 0; i < SETTINGS_DEFAULTS.length; i++) if (SETTINGS_DEFAULTS[i][0] === key) return SETTINGS_DEFAULTS[i][2];
  return null;
}

/**
 * Đọc nhiều dòng theo số dòng: gom các dòng liền nhau thành một lần đọc; quá nhiều khúc thì đọc một lần cả khoảng
 * từ dòng nhỏ nhất tới lớn nhất rồi lọc (lượt kiểm của một máy rải rác trong sheet).
 */
function readRowsByNums_(name, nums) {
  if (!nums.length) return [];
  var h = hdr_(name);
  var sorted = nums.slice().sort(function (a, b) { return a - b; });
  var blocks = [];
  sorted.forEach(function (n) {
    var b = blocks[blocks.length - 1];
    if (b && n === b.end + 1) b.end = n; else blocks.push({ start: n, end: n });
  });
  var sheet = sh_(name);
  var out = [];
  if (blocks.length > 20) {
    var lo = sorted[0], hi = sorted[sorted.length - 1];
    var want = {};
    sorted.forEach(function (n) { want[n] = true; });
    var vals = sheet.getRange(lo, 1, hi - lo + 1, h.cols.length).getValues();
    vals.forEach(function (r, i) { if (want[lo + i]) out.push(rowToObj_(name, h, r, lo + i)); });
    return out;
  }
  blocks.forEach(function (b) {
    var vals = sheet.getRange(b.start, 1, b.end - b.start + 1, h.cols.length).getValues();
    vals.forEach(function (r, i) { out.push(rowToObj_(name, h, r, b.start + i)); });
  });
  return out;
}

// ===== 04_i18n.js =====
/* 04_i18n: lời báo song ngữ cho mã kết quả */

var MSG = {
  OK: ['Thành công', '成功'],
  AUTH_REQUIRED: ['Cần đăng nhập lại', '需要重新登录'],
  AUTH_REQUIRED_REVOKED: ['Phiên đã bị thu hồi hoặc quyền đã thay đổi', '会话已撤销或权限已变更'],
  SESSION_EXPIRED: ['Phiên đăng nhập đã hết hạn', '登录会话已过期'],
  AUTH_FAILED: ['Mã nhân viên hoặc PIN không đúng', '工号或PIN错误'],
  PIN_LOCKED: ['Tạm khóa do nhập sai PIN nhiều lần, thử lại sau {n} phút', '因多次输错PIN已暂时锁定，请 {n} 分钟后重试'],
  LOGIN_PAUSED: ['Đăng nhập đang tạm dừng, thử lại sau {n} phút', '登录已暂停，请 {n} 分钟后重试'],
  ACCOUNT_DISABLED: ['Tài khoản đã bị khóa, liên hệ quản trị', '账户已被停用，请联系管理员'],
  MUST_CHANGE_PIN: ['Bạn đang dùng PIN tạm, hãy đặt PIN mới', '您正在使用临时PIN，请设置新PIN'],
  TEMP_PIN_EXPIRED: ['PIN tạm đã hết hạn, liên hệ quản trị để cấp lại', '临时PIN已过期，请联系管理员重新发放'],
  REAUTH_REQUIRED: ['Nhập lại PIN để tiếp tục', '请重新输入PIN以继续'],
  DATASET_RESET: ['Dữ liệu đã được đặt lại, cần tải lại', '数据已重置，需重新加载'],
  SYSTEM_MAINTENANCE: ['Hệ thống đang bảo trì', '系统维护中'],
  FORBIDDEN: ['Không có quyền', '无权限'],
  VALIDATION_ERROR: ['Dữ liệu chưa hợp lệ', '数据无效'],
  VERSION_CONFLICT: ['Xung đột, cần xử lý', '冲突，需处理'],
  DUPLICATE_OPERATION: ['Thao tác đã được ghi trước đó', '该操作此前已保存'],
  OPERATION_ID_REUSED: ['Mã thao tác bị dùng lại với nội dung khác', '操作编号被用于不同内容'],
  NOT_FOUND: ['Không tìm thấy', '未找到'],
  FEATURE_NOT_ENABLED: ['Chức năng chưa bật', '功能尚未启用'],
  CLIENT_UPDATE_REQUIRED: ['Cần cập nhật app, nháp vẫn được giữ', '需要更新应用，草稿仍会保留'],
  SERVER_BUSY: ['Máy chủ đang bận, thử lại sau ít giây', '服务器繁忙，请稍后重试'],
  QUOTA_EXCEEDED: ['Đã hết hạn mức của Google hôm nay', '今日谷歌配额已用尽'],
  INTERNAL_ERROR: ['Lỗi máy chủ', '服务器错误'],
  SYSTEM_NOT_READY: ['Máy chủ chưa được cài đặt', '服务器尚未初始化'],
  RECOVERY_REQUIRED: ['Thao tác ghi chưa hoàn tất, cần phục hồi', '写入未完成，需要恢复'],
  ME_LINK_FAILED: ['Không lấy được danh sách thiết bị từ M&E', '无法从 M&E 获取设备列表']
};

/** Lời báo cho mã con trong errors[] */
var SUB_MSG = {
  ID_INVALID: ['Mã định danh không hợp lệ', '标识无效'],
  ID_EXISTS: ['Mã định danh đã tồn tại', '标识已存在'],
  CODE_DUPLICATE: ['Mã đã được dùng', '编号已被使用'],
  CODE_INVALID: ['Mã chỉ gồm chữ hoa, số và . _ / -', '编号只能包含大写字母、数字及 . _ / -'],
  PIN_WEAK: ['PIN quá dễ đoán, hãy chọn PIN khác', 'PIN过于简单，请换一个'],
  PIN_FORMAT: ['PIN phải gồm đúng 6 chữ số', 'PIN必须为6位数字'],
  PIN_SAME: ['PIN mới phải khác PIN hiện tại', '新PIN不能与当前PIN相同'],
  REQUIRED: ['Bắt buộc nhập', '必填'],
  REQUIRED_ONE_LANGUAGE: ['Nhập ít nhất một thứ tiếng', '请至少填写一种语言'],
  INVALID_VALUE: ['Giá trị không hợp lệ', '值无效'],
  INVALID_DATE: ['Ngày không hợp lệ', '日期无效'],
  NOT_FOUND: ['Không tìm thấy hồ sơ liên quan', '未找到相关记录'],
  NEEDS_NETWORK: ['Cần kết nối mạng', '需要网络连接'],
  FILE_TOO_LARGE: ['Tệp quá lớn', '文件过大'],
  FILE_TYPE: ['Loại tệp không được hỗ trợ', '不支持的文件类型'],
  URL_INVALID: ['Liên kết không đúng dạng …/exec của Apps Script', '链接不是 Apps Script 的 …/exec 格式'],
  SELF_ACTION: ['Không thao tác lên chính mình', '不能对自己执行此操作'],
  LAST_ADMIN: ['Phải còn ít nhất một tài khoản Quản trị đang hoạt động', '必须保留至少一个启用的管理员账号'],
  STATUS_INVALID: ['Trạng thái hiện tại không cho thao tác này', '当前状态不允许此操作'],
  // Checksheet
  STD_INVALID: ['Tiêu chuẩn chưa hợp lệ (giá trị từ phải nhỏ hơn giá trị đến)', '标准无效（最小值须小于最大值）'],
  CHOICES_REQUIRED: ['Kiểu chọn cần ít nhất hai lựa chọn, có lựa chọn Đạt', '选择型至少两个选项，且须有合格项'],
  ITEMS_REQUIRED: ['Mẫu cần ít nhất một hạng mục', '模板至少需要一个项目'],
  SHIFTS_REQUIRED: ['Kiểm theo ca: chọn ít nhất một ca', '按班点检：至少选择一个班次'],
  SHIFTS_INVALID: ['Giờ các ca không hợp lệ', '班次时间无效'],
  FAIL_NOTE_REQUIRED: ['Mục Không đạt phải có ghi chú', '不合格项目须填写备注'],
  PERIOD_INVALID: ['Ngày/ca của lượt kiểm không hợp lệ', '点检日期/班次无效'],
  PERIOD_TOO_OLD: ['Lượt kiểm quá cũ để ghi', '点检记录过旧，无法保存'],
  RUN_EXISTS: ['Máy này đã có người kiểm trong ca/kỳ này', '该设备本班次/周期已有人点检'],
  RUN_LOCKED: ['Ngày này trưởng bộ phận đã xác nhận, không sửa được', '该日已由部门主管确认，不能修改'],
  NOT_ASSIGNED: ['Máy chưa được gán mẫu này hoặc đã ngừng', '设备未分配该模板或已停用'],
  MACHINE_INACTIVE: ['Máy đã ngừng dùng', '设备已停用'],
  TEMPLATE_INACTIVE: ['Mẫu đã ngừng dùng', '模板已停用'],
  REVISION_UNKNOWN: ['Không có phiên bản mẫu này', '不存在该模板版本'],
  ASSIGNMENT_EXISTS: ['Máy đã được gán mẫu này', '设备已分配该模板'],
  FUTURE_DATE: ['Không xác nhận ngày chưa tới', '不能确认未来日期'],
  ALREADY_CONFIRMED: ['Ngày này đã được xác nhận', '该日已确认'],
  ME_LINK_FAILED: ['Không kết nối được M&E (kiểm tra link /exec và mã kết nối)', '无法连接 M&E（请检查 /exec 链接和连接密钥）'],
  KEY_FORMAT: ['Mã kết nối phải dài ít nhất 24 ký tự', '连接密钥至少24个字符']
};

function fmtMsg_(pair, vars) {
  if (!vars) return pair;
  return pair.map(function (s) {
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  });
}

/** Lỗi API: ném ra ở mọi tầng, dispatcher đổi thành phản hồi */
function apiError_(code, data, errors, msgVars) {
  var e = new Error(code);
  e.apiCode = code;
  e.apiData = data || null;
  e.apiErrors = errors || [];
  e.msgVars = msgVars || null;
  return e;
}

/** Một dòng errors[] */
function fieldError_(field, subCode, row) {
  var m = SUB_MSG[subCode] || [subCode, subCode];
  return { row: row === undefined ? null : row, field: field || null, code: subCode, message_vi: m[0], message_zh: m[1] };
}

function validationError_(errs) {
  return apiError_('VALIDATION_ERROR', null, errs);
}

// ===== 05_lock.js =====
/* 05_lock: khóa ghi chung (phụ lục 1.5 mục 3.15) */

var LOCK_DEPTH_ = 0;

/**
 * Chạy fn dưới ScriptLock. Chờ quá 10 giây → SERVER_BUSY.
 * Gọi lồng nhau thì dùng lại khóa đang giữ. Luôn flush trước khi nhả khóa,
 * kể cả khi fn ném lỗi sau khi đã ghi (vd ghi lần sai PIN rồi báo AUTH_FAILED).
 */
function withWriteLock_(fn) {
  if (LOCK_DEPTH_ > 0) return fn();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw apiError_('SERVER_BUSY');
  LOCK_DEPTH_++;
  try {
    return fn();
  } finally {
    LOCK_DEPTH_--;
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

// ===== 06_auth.js =====
/* 06_auth: PIN, đăng nhập, token, phiên, hỏi lại PIN, đổi PIN (lấy từ M&E) */

function pepperKey_() {
  var p = prop_('PIN_PEPPER_V1');
  if (!p) throw apiError_('SYSTEM_NOT_READY');
  return b64d_(p);
}

function tokenKey_() {
  var p = prop_('TOKEN_SECRET_V1');
  if (!p) throw apiError_('SYSTEM_NOT_READY');
  return b64d_(p);
}

/** pin_hash = Base64(HMAC-SHA256(key = pepper, message = salt ‖ PIN)) (3.5) */
function pinHash_(pin, saltBytes, keyBytes) {
  var msg = saltBytes.concat(utf8Bytes_(pin));
  return b64_(hmac256_(msg, keyBytes));
}

/** employee_code_hash = base64url(HMAC-SHA256(key, "emp:" + MÃ)) (3.5) */
function empHash_(code, keyBytes) {
  return b64url_(hmac256_(utf8Bytes_('emp:' + code), keyBytes || pepperKey_()));
}

function normEmpCode_(s) {
  return trimStr_(s).toUpperCase();
}

/** Lý do PIN yếu, hoặc null (3.5). */
function pinWeakReason_(pin, employeeCode, currentPin) {
  if (!/^\d{6}$/.test(String(pin))) return 'PIN_FORMAT';
  if (/^(\d)\1{5}$/.test(pin)) return 'PIN_WEAK';
  if ('0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0) return 'PIN_WEAK';
  var digits = String(employeeCode || '').replace(/\D/g, '');
  if (digits.length) {
    var last6 = digits.length >= 6 ? digits.slice(-6) : ('000000' + digits).slice(-6);
    if (pin === last6) return 'PIN_WEAK';
  }
  if (currentPin && pin === currentPin) return 'PIN_WEAK';
  return null;
}

/** Sinh PIN 6 số ngẫu nhiên không yếu (PIN tạm, 3.6) */
function randomPin_(employeeCode) {
  for (var i = 0; i < 50; i++) {
    var b = sha256_(Utilities.getUuid());
    var n = ((u8_(b[0]) << 16) | (u8_(b[1]) << 8) | u8_(b[2])) % 1000000;
    var pin = ('000000' + n).slice(-6);
    if (!pinWeakReason_(pin, employeeCode)) return pin;
  }
  throw new Error('Cannot generate PIN');
}

/** Salt và hash mới cho một PIN */
function newPinRecord_(pin) {
  var salt = randomBytes16_();
  return { salt: b64_(salt), pin_hash: pinHash_(pin, salt, pepperKey_()), pin_hash_version: 'HMAC256-v1' };
}

function verifyPinAgainst_(user, pin) {
  var key = pepperKey_();
  if (!user || !user.salt || !user.pin_hash) {
    pinHash_(pin, sha256_('fake-salt').slice(0, 16), key); // giữ thời gian tương đương
    return false;
  }
  return ctEqualStr_(pinHash_(pin, b64d_(user.salt), key), user.pin_hash);
}

/* ---------------- AuthAttempts ---------------- */

function logAttempt_(kind, outcome, empHash, user, req) {
  insertRows_('AuthAttempts', [{
    attempt_id: uuid_(), occurred_at: isoVN_(now_()), employee_code_hash: empHash || '',
    device_id: isUuidV4_(req.device_id) ? req.device_id : '', outcome: outcome, attempt_kind: kind,
    user_id: user ? user.user_id : ''
  }]);
}

/** Đếm lần sai LOGIN toàn hệ thống trong cửa sổ (đọc phần đuôi AuthAttempts) */
function countRecentGlobalFails_(windowMin) {
  var since = now_().getTime() - windowMin * 60000;
  var tail = readTail_('AuthAttempts', 600);
  var n = 0;
  for (var i = tail.length - 1; i >= 0; i--) {
    var t = parseTime_(tail[i].occurred_at);
    if (!t) continue;
    if (t.getTime() < since) break;
    if (tail[i].attempt_kind === 'LOGIN' && tail[i].outcome === 'FAILED') n++;
  }
  return n;
}

/**
 * Ghi một lần sai theo người (Users) hoặc theo mã không tồn tại (CacheService).
 * Trả {locked: bool, retry: giây}.
 */
function registerFailure_(user, empHash) {
  var lim = setting_('login_fail_limit'), win = setting_('login_fail_window_minutes'), lockMin = setting_('login_lock_minutes');
  var t = now_().getTime();
  if (user) {
    var ws = parseTime_(user.failed_window_started_at);
    var count;
    if (!ws || t - ws.getTime() > win * 60000) { count = 1; ws = new Date(t); } else { count = (user.failed_attempts || 0) + 1; }
    var upd = { failed_attempts: count, failed_window_started_at: isoVN_(ws) };
    var locked = false;
    if (count >= lim) {
      upd = { failed_attempts: 0, failed_window_started_at: '', locked_until: isoVN_(new Date(t + lockMin * 60000)) };
      locked = true;
    }
    writeCells_('Users', user.__row, upd);
    cache_().remove('us:' + user.user_id);
    return { locked: locked, retry: lockMin * 60 };
  }
  var c = cache_();
  var fc = c.get('fc:' + empHash);
  var st = fc ? JSON.parse(fc) : null;
  if (!st || t - st.ws > win * 60000) st = { n: 1, ws: t }; else st.n++;
  if (st.n >= lim) {
    c.put('lk:' + empHash, String(t + lockMin * 60000), lockMin * 60);
    c.remove('fc:' + empHash);
    return { locked: true, retry: lockMin * 60 };
  }
  c.put('fc:' + empHash, JSON.stringify(st), win * 60);
  return { locked: false, retry: 0 };
}

/** Thời gian còn khóa (giây) theo người hoặc theo mã không tồn tại; 0 nếu không khóa */
function lockedRemaining_(user, empHash) {
  var t = now_().getTime();
  if (user) {
    var lu = parseTime_(user.locked_until);
    return lu && lu.getTime() > t ? Math.ceil((lu.getTime() - t) / 1000) : 0;
  }
  var lk = cache_().get('lk:' + empHash);
  return lk && Number(lk) > t ? Math.ceil((Number(lk) - t) / 1000) : 0;
}

function lockedError_(retry) {
  return apiError_('PIN_LOCKED', { retry_after_seconds: retry }, null, { n: Math.max(1, Math.ceil(retry / 60)) });
}

/* ---------------- Token và Sessions ---------------- */

function signToken_(sid, exp) {
  return b64url_(hmac256_(utf8Bytes_('v1.' + sid + '.' + exp), tokenKey_()));
}

function tokenHash_(token) {
  return b64url_(sha256_(token));
}

function sessionSeconds_(kind) {
  if (kind === 'CHANGE_PIN') return setting_('change_pin_session_minutes') * 60;
  var testSec = isTestEnv_() ? Number(prop_('TEST_SESSION_SECONDS') || 0) : 0;
  if (testSec > 0) return testSec;
  return setting_('session_days') * 86400;
}

/** Tạo phiên mới (dưới khóa ghi). Trả {token, expires_at, session_id} */
function createSession_(user, kind, req) {
  var sid = uuid_();
  var exp = unixNow_() + sessionSeconds_(kind);
  var token = 'v1.' + sid + '.' + exp + '.' + signToken_(sid, exp);
  var nowIso = isoVN_(now_());
  var p = req.payload || {};
  insertRows_('Sessions', [{
    session_id: sid, token_hash: tokenHash_(token), user_id: user.user_id,
    device_id: isUuidV4_(req.device_id) ? req.device_id : '', issued_at: nowIso,
    expires_at: isoVN_(new Date(exp * 1000)), revoked_at: '', auth_version: user.auth_version || 0,
    dataset_epoch: sysProps_().dataset_epoch, app_id: APP_ID, origin_key: '', session_kind: kind,
    last_seen_at: nowIso, revoke_reason: '', device_label: trimStr_(p.device_label).slice(0, 60)
  }]);
  if (kind === 'FULL') enforceMaxSessions_(user.user_id);
  return { token: token, expires_at: isoVN_(new Date(exp * 1000)), session_id: sid };
}

function isSessionActive_(s, tMs) {
  if (s.revoked_at) return false;
  var e = parseTime_(s.expires_at);
  return !!e && e.getTime() > tMs;
}

function enforceMaxSessions_(userId) {
  var max = setting_('max_sessions_per_user');
  var t = now_().getTime();
  var act = findAll_('Sessions', 'user_id', userId).filter(function (s) {
    return s.session_kind === 'FULL' && isSessionActive_(s, t);
  });
  if (act.length <= max) return;
  act.sort(function (a, b) { return String(a.issued_at) < String(b.issued_at) ? -1 : 1; });
  act.slice(0, act.length - max).forEach(function (s) { revokeSessionRow_(s, 'LIMIT'); });
}

/** Thu hồi một phiên: ghi Sheet trước rồi mới ghi cache (3.7) */
function revokeSessionRow_(s, reason) {
  writeCells_('Sessions', s.__row, { revoked_at: isoVN_(now_()), revoke_reason: reason });
  cache_().put('rv:' + s.session_id, reason === 'DATASET_RESET' ? 'DATASET_RESET' : '1', 21600);
  cache_().remove('ss:' + s.session_id);
}

/** Tăng auth_version, thu hồi mọi phiên còn hiệu lực của người dùng (dưới khóa ghi) */
function bumpAuthVersion_(user, extraUserFields) {
  var oldV = user.auth_version || 0;
  var newV = oldV + 1;
  var upd = extraUserFields || {};
  upd.auth_version = newV;
  upd.updated_at = isoVN_(now_());
  writeCells_('Users', user.__row, upd);
  var t = now_().getTime();
  findAll_('Sessions', 'user_id', user.user_id).forEach(function (s) {
    if (isSessionActive_(s, t)) {
      writeCells_('Sessions', s.__row, { revoked_at: isoVN_(now_()), revoke_reason: 'AUTH_VERSION' });
      cache_().remove('ss:' + s.session_id);
    }
  });
  var c = cache_();
  c.put('av:' + user.user_id, String(newV), 21600);
  c.remove('us:' + user.user_id);
  c.remove('scope:' + user.user_id + ':' + oldV);
  user.auth_version = newV;
  return newV;
}

function publicUser_(u) {
  return {
    user_id: u.user_id, employee_code: u.employee_code, display_name: u.display_name,
    role_level: u.role_level, is_system_owner: !!u.is_system_owner, area_ids: areaList_(u.area_ids)
  };
}

/** Danh sách khu vực của người dùng (chuỗi cách nhau bằng dấu phẩy); rỗng = mọi khu vực */
function areaList_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(String);
}

/** Users không có pin_hash/salt, qua cache `us:` TTL 600 giây */
function userCached_(uid) {
  var c = cache_().get('us:' + uid);
  if (c) return JSON.parse(c);
  var u = findOne_('Users', 'user_id', uid);
  if (!u) return null;
  delete u.pin_hash; delete u.salt;
  cache_().put('us:' + uid, JSON.stringify(u), 600);
  return u;
}

/* ---------------- auth.login ---------------- */

// App gửi lại đúng request đăng nhập (cùng login_id) khi mất phản hồi: trả lại kết quả lần đầu trong 5 phút,
// không tính thêm lần sai, không tạo thêm phiên. Khóa cache băm cả mã NV + PIN + máy nên không dùng được cho PIN khác.
var LOGIN_REPLAY_SECONDS_ = 300;
var LOGIN_REPLAY_CODES_ = { AUTH_FAILED: 1, PIN_LOCKED: 1, ACCOUNT_DISABLED: 1, TEMP_PIN_EXPIRED: 1, MUST_CHANGE_PIN: 1 };

function loginReplayKey_(req, code, pin) {
  var lid = (req.payload || {}).login_id;
  if (!isUuidV4_(lid)) return null;
  return 'ln:' + b64url_(sha256_(lid + '|' + code + '|' + pin + '|' + String(req.device_id || '')));
}

function authLogin_(req) {
  var p = req.payload || {};
  var code = normEmpCode_(p.employee_code);
  var pin = String(p.pin === undefined || p.pin === null ? '' : p.pin);
  if (!code || code.length > 40) throw validationError_([fieldError_('employee_code', 'REQUIRED')]);
  if (!/^\d{6}$/.test(pin)) throw validationError_([fieldError_('pin', 'PIN_FORMAT')]);

  var rk = loginReplayKey_(req, code, pin);
  if (rk) {
    var hit = cache_().get(rk);
    if (hit) {
      var h = JSON.parse(hit);
      if (h.ok) return h.data;
      throw apiError_(h.code, h.data, null, h.vars);
    }
  }
  try {
    var out = authLoginCheck_(req, code, pin);
    if (rk) cache_().put(rk, JSON.stringify({ ok: true, data: out }), LOGIN_REPLAY_SECONDS_);
    return out;
  } catch (e) {
    if (rk && e && LOGIN_REPLAY_CODES_[e.apiCode]) {
      cache_().put(rk, JSON.stringify({ ok: false, code: e.apiCode, data: e.apiData, vars: e.msgVars }), LOGIN_REPLAY_SECONDS_);
    }
    throw e;
  }
}

function authLoginCheck_(req, code, pin) {
  var key = pepperKey_();
  var eh = empHash_(code, key);
  var t = now_().getTime();

  // Tạm dừng toàn hệ thống: không kiểm PIN, không tính lượt
  var ss = sysStateCached_();
  var paused = parseTime_(ss.login_paused_until);
  if (paused && paused.getTime() > t) {
    var retryP = Math.ceil((paused.getTime() - t) / 1000);
    withWriteLock_(function () { logAttempt_('LOGIN', 'PAUSED', eh, null, req); });
    throw apiError_('LOGIN_PAUSED', { retry_after_seconds: retryP }, null, { n: Math.max(1, Math.ceil(retryP / 60)) });
  }

  var user = findOne_('Users', 'employee_code', code);
  if (sysProps_().maintenance_mode) throw apiError_('SYSTEM_MAINTENANCE');
  var preLocked = lockedRemaining_(user, eh);
  if (preLocked > 0) {
    withWriteLock_(function () { logAttempt_('LOGIN', 'LOCKED', eh, user, req); });
    throw lockedError_(preLocked);
  }

  // HMAC ngoài khóa
  var okPin = verifyPinAgainst_(user, pin);

  return withWriteLock_(function () {
    if (user) {
      var pre = user;
      user = readRowAt_('Users', pre.__row);
      // PIN vừa bị đổi bởi request khác trong lúc tính HMAC: tính lại theo bản mới
      if (user.pin_hash !== pre.pin_hash || user.salt !== pre.salt) okPin = verifyPinAgainst_(user, pin);
    }
    var rem = lockedRemaining_(user, eh);
    if (rem > 0) {
      logAttempt_('LOGIN', 'LOCKED', eh, user, req);
      throw lockedError_(rem);
    }
    if (!okPin) {
      var f = registerFailure_(user, eh);
      logAttempt_('LOGIN', 'FAILED', eh, user, req);
      var gLim = setting_('login_global_fail_limit');
      if (countRecentGlobalFails_(setting_('login_global_window_minutes')) >= gLim) {
        var st = readState_();
        stateWrite_(st, { login_paused_until: ['DATETIME', isoVN_(new Date(t + setting_('login_global_pause_minutes') * 60000))] });
        cache_().remove('sys:state');
      }
      if (f.locked) throw lockedError_(f.retry);
      throw apiError_('AUTH_FAILED');
    }
    if (!user.active) {
      logAttempt_('LOGIN', 'DISABLED', eh, user, req);
      throw apiError_('ACCOUNT_DISABLED');
    }
    var upd = {};
    if (user.failed_attempts || user.failed_window_started_at || user.locked_until) {
      upd.failed_attempts = 0; upd.failed_window_started_at = ''; upd.locked_until = '';
    }
    if (user.must_change_pin) {
      var tExp = parseTime_(user.temp_pin_expires_at);
      if (!tExp || tExp.getTime() <= t) {
        if (Object.keys(upd).length) writeCells_('Users', user.__row, upd);
        logAttempt_('LOGIN', 'TEMP_PIN_EXPIRED', eh, user, req);
        throw apiError_('TEMP_PIN_EXPIRED');
      }
      if (Object.keys(upd).length) writeCells_('Users', user.__row, upd);
      var cs = createSession_(user, 'CHANGE_PIN', req);
      logAttempt_('LOGIN', 'MUST_CHANGE_PIN', eh, user, req);
      throw apiError_('MUST_CHANGE_PIN', { token: cs.token, expires_at: cs.expires_at, session_kind: 'CHANGE_PIN', user: publicUser_(user) });
    }
    upd.last_login_at = isoVN_(now_());
    writeCells_('Users', user.__row, upd);
    cache_().remove('us:' + user.user_id);
    var s = createSession_(user, 'FULL', req);
    logAttempt_('LOGIN', 'SUCCESS', eh, user, req);
    return { token: s.token, expires_at: s.expires_at, session_kind: 'FULL', user: publicUser_(user) };
  });
}

/* ---------------- Kiểm phiên ở mỗi request ---------------- */

function authRequired_(reason) {
  return apiError_('AUTH_REQUIRED', { reason: reason });
}

/** Các bước 1–7 của 3.7. Trả ctx {sid, session, user, req} */
function requireSession_(req, action) {
  var token = req.token;
  if (!token || typeof token !== 'string') throw authRequired_('INVALID');
  var parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !isUuidV4_(parts[1]) || !/^\d{1,12}$/.test(parts[2])) throw authRequired_('INVALID');
  var sid = parts[1], exp = Number(parts[2]);
  if (!ctEqualStr_(signToken_(sid, exp), parts[3])) throw authRequired_('INVALID');
  var nowSec = unixNow_();
  if (exp <= nowSec) throw apiError_('SESSION_EXPIRED');

  var c = cache_();
  var got = c.getAll(['ss:' + sid, 'rv:' + sid]);
  if (got['rv:' + sid]) throw got['rv:' + sid] === 'DATASET_RESET' ? apiError_('DATASET_RESET') : authRequired_('REVOKED');
  var ss = got['ss:' + sid] ? JSON.parse(got['ss:' + sid]) : null;
  if (!ss) {
    var row = findOne_('Sessions', 'session_id', sid);
    if (!row) throw authRequired_('INVALID');
    ss = {
      row: row.__row, user_id: row.user_id, token_hash: row.token_hash, session_kind: row.session_kind,
      auth_version: row.auth_version || 0, dataset_epoch: row.dataset_epoch, revoked_at: row.revoked_at,
      revoke_reason: row.revoke_reason, last_seen_at: row.last_seen_at
    };
    c.put('ss:' + sid, JSON.stringify(ss), Math.max(1, Math.min(21600, exp - nowSec)));
  }
  if (!ctEqualStr_(ss.token_hash, tokenHash_(token))) throw authRequired_('INVALID');
  // Phiên bị thu hồi do Xóa sạch/khôi phục: báo DATASET_RESET để app xóa dữ liệu cũ, giữ nháp thành "Nháp thế hệ dữ liệu cũ"
  if (ss.revoked_at && ss.revoke_reason === 'DATASET_RESET') throw apiError_('DATASET_RESET');
  if (ss.revoked_at) throw authRequired_(ss.revoke_reason === 'AUTH_VERSION' ? 'AUTH_VERSION' : 'REVOKED');

  var u = userCached_(ss.user_id);
  if (!u || !u.active) throw authRequired_('REVOKED');
  var av = c.get('av:' + ss.user_id);
  if (Number(ss.auth_version) !== Number(u.auth_version || 0) || (av !== null && av !== undefined && Number(av) !== Number(ss.auth_version))) {
    throw authRequired_('AUTH_VERSION');
  }
  var props = sysProps_();
  if (ss.dataset_epoch !== props.dataset_epoch || req.dataset_epoch !== props.dataset_epoch) throw apiError_('DATASET_RESET');
  if (ss.session_kind === 'CHANGE_PIN' && action !== 'pin.change' && action !== 'auth.logout') {
    throw apiError_('MUST_CHANGE_PIN');
  }
  // last_seen_at tối đa 1 lần/60 phút
  var ls = parseTime_(ss.last_seen_at);
  if (!ls || nowSec * 1000 - ls.getTime() > 3600000) {
    try {
      var nowIso = isoVN_(now_());
      // Số dòng trong cache có thể đã lệch nếu trigger xóa bớt dòng Sessions: kiểm lại trước khi ghi
      var rn = ss.row;
      if (!rn || sh_('Sessions').getRange(rn, 1).getValue() !== sid) rn = (findOne_('Sessions', 'session_id', sid) || {}).__row;
      if (rn) { writeCells_('Sessions', rn, { last_seen_at: nowIso }); ss.row = rn; }
      ss.last_seen_at = nowIso;
      c.put('ss:' + sid, JSON.stringify(ss), Math.max(1, Math.min(21600, exp - nowSec)));
    } catch (e) { /* không chặn request */ }
  }
  return { sid: sid, session: ss, user: u, req: req, token: token };
}

/* ---------------- auth.reauth ---------------- */

function signReauth_(payloadB64) {
  return b64url_(hmac256_(utf8Bytes_('r1.' + payloadB64), tokenKey_()));
}

function makeReauthToken_(ctx) {
  var exp = unixNow_() + setting_('reauth_window_minutes') * 60;
  var payload = b64url_(utf8Bytes_(JSON.stringify({
    session_id: ctx.sid, user_id: ctx.user.user_id, auth_version: ctx.user.auth_version || 0, exp: exp
  })));
  return { reauth_token: 'r1.' + payload + '.' + signReauth_(payload), expires_at: isoVN_(new Date(exp * 1000)) };
}

function verifyReauth_(ctx, rt) {
  if (!rt || typeof rt !== 'string') return false;
  var parts = rt.split('.');
  if (parts.length !== 3 || parts[0] !== 'r1') return false;
  if (!ctEqualStr_(signReauth_(parts[1]), parts[2])) return false;
  var p;
  try { p = JSON.parse(Utilities.newBlob(b64urlDecode_(parts[1])).getDataAsString()); } catch (e) { return false; }
  return p.exp > unixNow_() && p.session_id === ctx.sid && p.user_id === ctx.user.user_id &&
    Number(p.auth_version) === Number(ctx.user.auth_version || 0);
}

/**
 * Kiểm PIN của người đang có phiên (reauth, đổi PIN): chung bộ đếm theo người.
 * HMAC tính ngoài khóa; trong khóa đọc lại dòng, kiểm khóa lần nữa và tính lại nếu PIN vừa đổi.
 * PIN đúng → onOk(user mới đọc, empHash) chạy trong cùng khóa.
 */
function checkOwnPin_(ctx, pin, kind, onOk) {
  pin = String(pin === undefined || pin === null ? '' : pin);
  if (!/^\d{6}$/.test(pin)) throw validationError_([fieldError_(kind === 'CHANGE_PIN' ? 'current_pin' : 'pin', 'PIN_FORMAT')]);
  var pre = findOne_('Users', 'user_id', ctx.user.user_id);
  var rem0 = lockedRemaining_(pre, null);
  if (rem0 > 0) throw lockedError_(rem0);
  var ok = verifyPinAgainst_(pre, pin);
  var eh = empHash_(pre.employee_code);
  return withWriteLock_(function () {
    var u = readRowAt_('Users', pre.__row);
    var rem = lockedRemaining_(u, null);
    if (rem > 0) throw lockedError_(rem);
    if (u.pin_hash !== pre.pin_hash || u.salt !== pre.salt) ok = verifyPinAgainst_(u, pin);
    if (!ok) {
      var f = registerFailure_(u, eh);
      logAttempt_(kind, 'FAILED', eh, u, ctx.req);
      if (f.locked) throw lockedError_(f.retry);
      throw apiError_('AUTH_FAILED');
    }
    return onOk(u, eh);
  });
}

function authReauth_(ctx) {
  checkOwnPin_(ctx, (ctx.req.payload || {}).pin, 'REAUTH', function (u, eh) {
    if (u.failed_attempts || u.failed_window_started_at) {
      writeCells_('Users', u.__row, { failed_attempts: 0, failed_window_started_at: '' });
      cache_().remove('us:' + u.user_id);
    }
    logAttempt_('REAUTH', 'SUCCESS', eh, u, ctx.req);
  });
  return makeReauthToken_(ctx);
}

/* ---------------- pin.change ---------------- */

function pinChange_(ctx) {
  var p = ctx.req.payload || {};
  var cur = String(p.current_pin || ''), nw = String(p.new_pin || '');
  var rec = /^\d{6}$/.test(nw) ? newPinRecord_(nw) : null; // HMAC ngoài khóa
  return checkOwnPin_(ctx, cur, 'CHANGE_PIN', function (u, eh) {
    var weak = pinWeakReason_(nw, u.employee_code, cur);
    if (weak) throw validationError_([fieldError_('new_pin', weak)]);
    var nowIso = isoVN_(now_());
    bumpAuthVersion_(u, {
      pin_hash: rec.pin_hash, salt: rec.salt, pin_hash_version: rec.pin_hash_version, must_change_pin: false,
      temp_pin_expires_at: '', pin_changed_at: nowIso, failed_attempts: 0, failed_window_started_at: '', locked_until: ''
    });
    logAttempt_('CHANGE_PIN', 'SUCCESS', eh, u, ctx.req);
    writeAudit_({
      user_id: u.user_id, device_id: ctx.req.device_id, action: 'pin.change', entity_type: 'USER', entity_id: u.user_id,
      before_json: null, after_json: { pin_changed_at: nowIso }, operation_id: '', auth_basis: 'ROLE_LEVEL'
    });
    var s = createSession_(u, 'FULL', ctx.req);
    return { token: s.token, expires_at: s.expires_at, session_kind: 'FULL', user: publicUser_(u) };
  });
}

/* ---------------- logout ---------------- */

function authLogout_(ctx) {
  withWriteLock_(function () {
    var row = findOne_('Sessions', 'session_id', ctx.sid);
    if (row && !row.revoked_at) revokeSessionRow_(row, 'LOGOUT');
  });
  return { logged_out: true };
}

function authLogoutAll_(ctx) {
  withWriteLock_(function () {
    var u = findOne_('Users', 'user_id', ctx.user.user_id);
    bumpAuthVersion_(u, {});
    writeAudit_({
      user_id: u.user_id, device_id: ctx.req.device_id, action: 'auth.logoutAll', entity_type: 'USER', entity_id: u.user_id,
      before_json: null, after_json: { auth_version: u.auth_version }, operation_id: ctx.req.operation_id || '', auth_basis: 'ROLE_LEVEL'
    });
  });
  return { logged_out_all: true };
}

function accountView_(ctx) {
  var u = ctx.user;
  return {
    user: publicUser_(u), session_kind: ctx.session.session_kind,
    last_login_at: u.last_login_at, pin_changed_at: u.pin_changed_at
  };
}

/* ---------------- Phiên của chính mình (4.4.14) ---------------- */

/** session.listOwn: các phiên FULL còn hiệu lực của người gọi; không trả token_hash */
function sessionListOwn_(ctx) {
  var t = now_().getTime();
  var items = findAll_('Sessions', 'user_id', ctx.user.user_id).filter(function (s) {
    return s.session_kind === 'FULL' && isSessionActive_(s, t);
  }).map(function (s) {
    return {
      session_id: s.session_id, device_label: s.device_label, issued_at: s.issued_at, last_seen_at: s.last_seen_at,
      expires_at: s.expires_at, current: s.session_id === ctx.sid
    };
  });
  items.sort(function (a, b) { return String(b.issued_at).localeCompare(String(a.issued_at)); });
  return { items: items };
}

/** session.revokeOwn {session_id}: thu hồi một phiên khác của chính mình (máy này dùng Đăng xuất) */
function sessionRevokeOwn_(ctx) {
  var id = (ctx.req.payload || {}).session_id;
  if (!isUuidV4_(id)) throw validationError_([fieldError_('session_id', 'ID_INVALID')]);
  return withWriteLock_(function () {
    var s = findOne_('Sessions', 'session_id', id);
    if (!s || s.user_id !== ctx.user.user_id) throw apiError_('NOT_FOUND');
    if (!s.revoked_at) {
      revokeSessionRow_(s, 'LOGOUT');
      writeAudit_({
        user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'session.revokeOwn', entity_type: 'SESSION', entity_id: id,
        before_json: null, after_json: { revoked: true }, operation_id: '', auth_basis: 'ROLE_LEVEL'
      });
    }
    return { revoked: true, session_id: id };
  });
}

/* ---------------- Danh sách người (chọn người phụ trách, hiện tên) ---------------- */

/** Bản đồ user_id → {employee_code, display_name, active} qua cache 10 phút (không có PIN, email).
 *  Thao tác sửa người dùng phải remove('users:dir'). */
function userDirectory_() {
  if (DB_.userDir) return DB_.userDir;
  var c = cache_().get('users:dir');
  var m;
  if (c) {
    m = JSON.parse(c);
  } else {
    m = {};
    readRows_('Users').forEach(function (u) { m[u.user_id] = { employee_code: u.employee_code, display_name: u.display_name, active: !!u.active }; });
    try { cache_().put('users:dir', JSON.stringify(m), 600); } catch (e) { /* quá cỡ cache: đọc lại lần sau */ }
  }
  DB_.userDir = m;
  return m;
}

var NAME_FIELDS_ = {
  updated_by: 'updated_by_name', created_by: 'created_by_name', checked_by: 'checked_by_name', reported_by: 'reported_by_name',
  resolved_by: 'resolved_by_name', recorded_by: 'recorded_by_name', confirmed_by: 'confirmed_by_name'
};

/** Tên hiển thị của người phụ trách/người sửa gắn vào bản ghi gửi client */
function annotateNames_(o) {
  if (!o) return o;
  var dir = null;
  Object.keys(NAME_FIELDS_).forEach(function (f) {
    if (!o[f] || o[f] === SYSTEM_USER) return;
    if (!dir) dir = userDirectory_();
    var u = dir[o[f]];
    if (u) o[NAME_FIELDS_[f]] = u.display_name;
  });
  return o;
}

/** user.pickList: chỉ user_id, mã, tên hiển thị của người đang hoạt động */
function userPickList_() {
  var dir = userDirectory_();
  var items = Object.keys(dir).filter(function (id) { return dir[id].active; }).map(function (id) {
    return { user_id: id, employee_code: dir[id].employee_code, display_name: dir[id].display_name };
  });
  items.sort(function (a, b) { return String(a.employee_code).localeCompare(String(b.employee_code)); });
  return { items: items };
}

// ===== 07_perm.js =====
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

// ===== 08_ops.js =====
/* 08_ops: Operations (chống ghi trùng), mã hiển thị, AuditLogs, dịch máy (lấy từ M&E) */

/** Băm payload chuẩn hóa: action, hồ sơ, expected_version, epoch, người dùng (1.4 §10.3.1) */
function payloadHash_(ctx) {
  var req = ctx.req;
  var norm = normalizeForHash_(req.payload || {});
  return b64url_(sha256_(stableStringify_({
    action: req.action, expected_version: req.expected_version === undefined ? null : req.expected_version,
    dataset_epoch: req.dataset_epoch, user_id: ctx.user.user_id, payload: norm
  })));
}

function normalizeForHash_(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(normalizeForHash_);
  var out = {};
  Object.keys(o).forEach(function (k) {
    if (SECRET_KEYS_.indexOf(k) >= 0) return;
    if ((k === 'content_b64' || k === 'thumb_b64') && typeof o[k] === 'string') { out[k] = 'sha:' + b64url_(sha256_(o[k])); return; }
    out[k] = normalizeForHash_(o[k]);
  });
  return out;
}

function writeAudit_(a) {
  var lim = function (v) {
    if (v === null || v === undefined) return '';
    var s = JSON.stringify(redact_(v));
    return s.length > 4000 ? JSON.stringify({ truncated: true, size: s.length }) : s;
  };
  insertRows_('AuditLogs', [{
    audit_id: uuid_(), occurred_at: isoVN_(now_()), user_id: a.user_id, device_id: isUuidV4_(a.device_id) ? a.device_id : '',
    action: a.action, entity_type: a.entity_type || '', entity_id: a.entity_id || '', before_json: lim(a.before_json),
    after_json: lim(a.after_json), operation_id: a.operation_id || '', import_batch_id: a.import_batch_id || '',
    dataset_epoch: sysProps_().dataset_epoch, reason: a.reason || '', auth_basis: a.auth_basis || ''
  }]);
}

/** Phản hồi khi operation_id đã có (3.15) */
function existingOpResponse_(ctx, ex, hash) {
  if (ex.user_id !== ctx.user.user_id || ex.payload_hash !== hash || ex.action !== ctx.req.action) {
    throw apiError_('OPERATION_ID_REUSED');
  }
  if (ex.state === 'COMMITTED') {
    var data = ex.result_json || null;
    return { ok: true, code: 'DUPLICATE_OPERATION', state: 'COMMITTED', data: data, record_version: data ? data.record_version : null };
  }
  if (ex.state === 'PREPARED') return replayPrepared_(ctx, ex);
  throw apiError_('RECOVERY_REQUIRED', { operation_state: ex.state });
}

/** Ghi các dòng của kế hoạch. Chế độ replay: bỏ qua dòng đã có/đã áp. */
function applyWrites_(writes, replay) {
  var inserts = {};
  writes.forEach(function (w) {
    if (w.mode === 'insert') {
      if (replay) {
        var key = sheetSchema_(w.sheet).key;
        if (findRowNums_(w.sheet, key, w.row[key]).length) return;
      }
      (inserts[w.sheet] = inserts[w.sheet] || []).push(w.row);
    } else if (w.mode === 'update') {
      var keyU = sheetSchema_(w.sheet).key;
      var rn = findRowNums_(w.sheet, keyU, w.row[keyU])[0];
      if (!rn) throw apiError_('RECOVERY_REQUIRED', { missing: w.sheet });
      if (replay && w.row.record_version !== undefined) {
        var cur = readRowAt_(w.sheet, rn);
        if ((cur.record_version || 0) >= w.row.record_version) return;
      }
      if (w.partial) writeCells_(w.sheet, rn, w.row); else writeRow_(w.sheet, rn, w.row);
    }
  });
  Object.keys(inserts).forEach(function (s) { insertRows_(s, inserts[s]); });
}

function replayPrepared_(ctx, ex) {
  var intent = ex.intent_json;
  if (!intent || !intent.writes) throw apiError_('RECOVERY_REQUIRED', { operation_state: 'PREPARED' });
  var st = readState_();
  applyWrites_(intent.writes, true);
  var su = {};
  Object.keys(intent.state || {}).forEach(function (k) {
    var v = intent.state[k];
    if (v[0] === 'INT' && Number(stateGet_(st, k, 0)) >= Number(v[1])) return;
    su[k] = v;
  });
  if (Object.keys(su).length) stateWrite_(st, su, ctx.user.user_id);
  if (intent.audit) writeAudit_(intent.audit);
  writeCells_('Operations', ex.__row, {
    state: 'COMMITTED', result_code: 'OK', committed_at: isoVN_(now_()), result_json: JSON.stringify(intent.result || null)
  });
  return { ok: true, code: 'DUPLICATE_OPERATION', state: 'COMMITTED', data: intent.result || null, record_version: intent.result ? intent.result.record_version : null };
}

/**
 * Thực hiện một thao tác ghi có xác nhận COMMITTED.
 * opts.build(st) chạy dưới khóa ghi, trả {writes, state, result, audit, record_version, noReplay}.
 *  - writes: [{sheet, mode:'insert'|'update', row, partial?}]
 *  - state: {khóa SystemState: [kiểu, giá trị]} (vd code_seq)
 *  - audit: {action, entity_type, entity_id, before_json, after_json, reason}
 */
function executeWrite_(ctx, opts) {
  var req = ctx.req;
  var hash = payloadHash_(ctx);
  return withWriteLock_(function () {
    // Bảo trì vừa bật: ghi đã qua bước kiểm ở dispatcher cũng dừng dưới khóa ghi
    if (PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE') === 'true') throw apiError_('SYSTEM_MAINTENANCE');
    var ex = findOne_('Operations', 'operation_id', req.operation_id);
    if (ex) return existingOpResponse_(ctx, ex, hash);
    var st = readState_();
    var plan = opts.build(st);
    var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
    var nowIso = isoVN_(now_());
    var touched = {};
    plan.writes.forEach(function (w) {
      if (sheetSchema_(w.sheet).cols.indexOf('sync_revision') >= 0) w.row.sync_revision = rev;
      touched[w.sheet] = true;
    });
    var su = plan.state || {};
    su.sync_revision = ['INT', rev];
    Object.keys(touched).forEach(function (s) { su['table_rev.' + s] = ['INT', rev]; });
    var audit = null;
    if (plan.audit) {
      audit = {
        user_id: ctx.user.user_id, device_id: req.device_id, action: req.action, entity_type: plan.audit.entity_type,
        entity_id: plan.audit.entity_id, before_json: plan.audit.before_json || null, after_json: plan.audit.after_json || null,
        operation_id: req.operation_id, reason: plan.audit.reason || '', auth_basis: plan.audit.auth_basis || authBasis_(ctx)
      };
    }
    var intent = plan.noReplay ? { no_replay: true } : { writes: plan.writes, state: su, audit: audit, result: plan.result };
    var intentStr = JSON.stringify(intent);
    if (intentStr.length > 40000) intentStr = JSON.stringify({ too_large: true });
    var opRow = {
      operation_id: req.operation_id, user_id: ctx.user.user_id, device_id: isUuidV4_(req.device_id) ? req.device_id : '',
      entity_type: opts.entity_type || '', entity_id: opts.entity_id || '',
      expected_version: req.expected_version === undefined ? '' : req.expected_version, received_at: nowIso,
      state: 'PREPARED', result_code: '', sync_revision: rev, committed_at: '', dataset_epoch: sysProps_().dataset_epoch,
      action: req.action, payload_hash: hash, intent_json: intentStr, progress_json: '', result_json: ''
    };
    insertRows_('Operations', [opRow]);
    applyWrites_(plan.writes, false);
    stateWrite_(st, su, ctx.user.user_id);
    if (audit) writeAudit_(audit);
    writeCells_('Operations', opRow.__row, {
      state: 'COMMITTED', result_code: 'OK', committed_at: isoVN_(now_()), result_json: JSON.stringify(plan.result || null)
    });
    return { ok: true, code: 'OK', state: 'COMMITTED', data: plan.result || null, record_version: plan.record_version };
  });
}

/* ---------------- Mã hiển thị (3.3) ---------------- */

var MANUAL_CODE_RE_ = /^[A-Z0-9][A-Z0-9._\/-]{0,31}$/;

function codeExists_(sheet, col, code) {
  return findRowNums_(sheet, col, code).length > 0;
}

/**
 * Cấp mã hiển thị dưới khóa ghi (mã máy chủ cấp, không nhập tay).
 * su: object state update để ghi bộ đếm. Trả mã.
 */
function allocCode_(st, su, kind, bizDate) {
  var pat = CODE_PATTERNS[kind];
  var ym = pat.yymm ? yymm_(bizDate || now_()) : '';
  var key = 'code_seq.' + pat.prefix + (pat.yymm ? '.' + ym : '');
  var n = Number(stateGet_(st, key, 0));
  var code;
  for (var guard = 0; guard < 100000; guard++) {
    n++;
    var num = String(n);
    while (num.length < pat.digits) num = '0' + num;
    code = pat.prefix + '-' + (pat.yymm ? ym + '-' : '') + num;
    if (!pat.sheet || !codeExists_(pat.sheet, pat.col, code)) break;
  }
  st.map[key] = n;
  su[key] = ['INT', n];
  return code;
}

/** Bộ cột C cho dòng mới */
function cNew_(ctx, row) {
  var nowIso = isoVN_(now_());
  row.dataset_epoch = sysProps_().dataset_epoch;
  row.record_version = 1;
  row.created_at = nowIso; row.created_by = ctx.user.user_id;
  row.updated_at = nowIso; row.updated_by = ctx.user.user_id;
  row.archived_at = '';
  return row;
}

function cUpdate_(ctx, row) {
  row.record_version = (row.record_version || 0) + 1;
  row.updated_at = isoVN_(now_());
  row.updated_by = ctx.user.user_id;
  return row;
}

/** So expected_version với bản trên máy chủ (dưới khóa) */
function assertVersion_(ctx, current, entityType, sheet) {
  var ev = ctx.req.expected_version;
  if (ev === undefined || ev === null || Number(ev) !== Number(current.record_version || 0)) {
    var server = projectRow_(ctx, current);
    throw apiError_('VERSION_CONFLICT', { entity_type: entityType, server: server, server_version: current.record_version });
  }
}

/** Ghi lỗi validation cho ID client tạo (3.3) */
function assertNewId_(sheet, field, id) {
  if (!isUuidV4_(id)) throw validationError_([fieldError_(field, 'ID_INVALID')]);
  if (findRowNums_(sheet, sheetSchema_(sheet).key, id).length) throw validationError_([fieldError_(field, 'ID_EXISTS')]);
}

/* ---------------- Dịch máy (2.3) ---------------- */

/** Commit Excel không dịch (2.3 quy tắc 9): trường cần dịch đặt PENDING cho runBackgroundJobs */
var MT_DEFER_ = false;

function mtEnabled_() {
  if (!setting_('machine_translation_enabled')) return false;
  var paused = parseTime_(sysStateCached_().mt_paused_until);
  return !(paused && paused.getTime() > now_().getTime());
}

/** Dịch một chuỗi; lỗi thì trả null. Cache theo SHA-256(nguồn + chiều). */
function mtTranslate_(text, from, to) {
  if (!text) return '';
  if (isTestEnv_() && prop_('TEST_MT_FAIL') === 'true') return null;
  var ck = 'mt:' + b64url_(sha256_(from + '>' + to + ':' + text));
  var c = cache_().get(ck);
  if (c !== null && c !== undefined) return c;
  try {
    var out = LanguageApp.translate(text, from === 'zh' ? 'zh-CN' : from, to === 'zh' ? 'zh-CN' : to, { contentType: 'text' });
    if (out && out.length < 90000) cache_().put(ck, out, 21600);
    return out;
  } catch (e) {
    var msg = String(e && e.message || e);
    if (/quota|limit|too many/i.test(msg)) {
      try {
        withWriteLock_(function () {
          var st = readState_();
          stateWrite_(st, { mt_paused_until: ['DATETIME', isoVN_(new Date(now_().getTime() + 86400000))] });
        });
        cache_().remove('sys:state');
      } catch (e2) { /* bỏ qua */ }
    }
    return null;
  }
}

/**
 * Điền bên còn thiếu của các cặp trường *_vi/*_zh theo 2.3 (quy tắc 1, 5, 7).
 * fields: tên trường gốc (vd ['name']). current: bản ghi hiện có (khi sửa) hoặc null.
 * Trả {values: {name_vi, name_zh}, meta: i18n_meta mới}. Gọi NGOÀI khóa ghi.
 */
function applyTranslations_(sheet, fields, input, current) {
  var noMt = NO_MT_FIELDS[sheet] || [];
  var meta = current && current.i18n_meta ? clone_(current.i18n_meta) : {};
  var values = {};
  var budgetEnd = now_().getTime() + setting_('mt_sync_budget_seconds') * 1000;
  var nowIso = isoVN_(now_());
  var has = function (k) { return Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined && input[k] !== null; };

  function oneSide(f, src, text) {
    var kv = f + '_vi', kz = f + '_zh';
    values[kv] = src === 'vi' ? text : '';
    values[kz] = src === 'zh' ? text : '';
    if (noMt.indexOf(f) >= 0) { meta[f] = { src: src, state: 'MANUAL_REQUIRED', at: nowIso }; return; }
    var tgt = src === 'vi' ? 'zh' : 'vi';
    // Cả chuỗi trùng thuật ngữ đã duyệt: lấy từ điển, không cần dịch máy (2.3 quy tắc 4)
    var g = glossaryExact_(text, src, tgt);
    if (g) { values[tgt === 'zh' ? kz : kv] = g; meta[f] = { src: src, state: 'GLOSSARY', at: nowIso }; return; }
    if (MT_DEFER_ || !mtEnabled_() || now_().getTime() > budgetEnd) { meta[f] = { src: src, state: 'PENDING', at: nowIso }; return; }
    var out = translateText_(text, src, tgt);
    if (out) {
      values[tgt === 'zh' ? kz : kv] = out.text;
      meta[f] = { src: src, state: out.state, at: nowIso };
    } else {
      meta[f] = { src: src, state: 'PENDING', at: nowIso };
    }
  }

  fields.forEach(function (f) {
    var kv = f + '_vi', kz = f + '_zh';
    var curVi = current ? trimStr_(current[kv]) : '', curZh = current ? trimStr_(current[kz]) : '';
    var newVi = has(kv) ? trimStr_(input[kv]) : curVi;
    var newZh = has(kz) ? trimStr_(input[kz]) : curZh;
    var m = meta[f] || null;

    if (current && m && (m.state === 'MACHINE' || m.state === 'PENDING')) {
      var src = m.src, tgt = src === 'vi' ? 'zh' : 'vi';
      var srcNew = src === 'vi' ? newVi : newZh, srcCur = src === 'vi' ? curVi : curZh;
      var tgtNew = tgt === 'vi' ? newVi : newZh, tgtCur = tgt === 'vi' ? curVi : curZh;
      var tgtTouched = has(f + '_' + tgt) && tgtNew !== '' && tgtNew !== tgtCur;
      if (tgtTouched) {
        if (!srcNew) { oneSide(f, tgt, tgtNew); return; }
        values[kv] = newVi; values[kz] = newZh;
        meta[f] = { src: src, state: 'HUMAN', at: nowIso };
        return;
      }
      if (!srcNew) { values[kv] = ''; values[kz] = ''; delete meta[f]; return; }
      if (srcNew !== srcCur || m.state === 'PENDING') { oneSide(f, src, srcNew); return; }
      values[kv] = curVi; values[kz] = curZh;
      return;
    }

    if (newVi && newZh) {
      values[kv] = newVi; values[kz] = newZh;
      if (!current || newVi !== curVi || newZh !== curZh || !m) {
        meta[f] = { src: m ? m.src : (has(kv) ? 'vi' : 'zh'), state: 'HUMAN', at: nowIso };
      }
      return;
    }
    if (!newVi && !newZh) { values[kv] = ''; values[kz] = ''; delete meta[f]; return; }
    var s1 = newVi ? 'vi' : 'zh';
    var t1 = newVi || newZh;
    if (current && m && m.state === 'MANUAL_REQUIRED' && t1 === (s1 === 'vi' ? curVi : curZh)) {
      values[kv] = newVi; values[kz] = newZh;
      return;
    }
    oneSide(f, s1, t1);
  });
  // Đã dùng "Gợi ý dịch" và người dùng tick đã kiểm tra: HUMAN kèm assisted (2.3)
  (Array.isArray(input.i18n_assisted) ? input.i18n_assisted : []).forEach(function (f) {
    if (fields.indexOf(f) >= 0 && meta[f] && meta[f].state === 'HUMAN') meta[f].assisted = true;
  });
  return { values: values, meta: meta };
}

/** Kiểm bắt buộc một thứ tiếng (3.9) */
function requireOneLang_(errs, input, current, f) {
  var vi = input[f + '_vi'] !== undefined ? trimStr_(input[f + '_vi']) : (current ? trimStr_(current[f + '_vi']) : '');
  var zh = input[f + '_zh'] !== undefined ? trimStr_(input[f + '_zh']) : (current ? trimStr_(current[f + '_zh']) : '');
  if (!vi && !zh) errs.push(fieldError_(f, 'REQUIRED_ONE_LANGUAGE'));
}

/* ---------------- Chiếu dữ liệu ra client ---------------- */

/** Bỏ khóa nội bộ, gắn tên người */
function projectRow_(ctx, row) {
  if (!row) return null;
  var out = {};
  Object.keys(row).forEach(function (k) { if (k !== '__row') out[k] = row[k]; });
  return annotateNames_(out);
}

/* ---------------- Ghi của hệ thống (trigger, lấy thiết bị từ M&E, dịch nền) ---------------- */

/**
 * Ghi các dòng không qua thao tác người dùng: tăng sync_revision, table_rev của bảng đã ghi (để app đồng bộ thấy),
 * không có Operations. Gọi dưới khóa ghi hoặc tự lấy khóa. audit: {action, entity_type, entity_id, after_json} (tùy chọn).
 */
function systemWrite_(writes, audit) {
  if (!writes.length) return 0;
  return withWriteLock_(function () {
    var st = readState_();
    var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
    var touched = {};
    writes.forEach(function (w) {
      if (sheetSchema_(w.sheet).cols.indexOf('sync_revision') >= 0) w.row.sync_revision = rev;
      touched[w.sheet] = true;
    });
    applyWrites_(writes, false);
    var su = { sync_revision: ['INT', rev] };
    Object.keys(touched).forEach(function (s) { su['table_rev.' + s] = ['INT', rev]; });
    stateWrite_(st, su, SYSTEM_USER);
    if (audit) writeAudit_({ user_id: SYSTEM_USER, action: audit.action, entity_type: audit.entity_type || '', entity_id: audit.entity_id || '', before_json: null, after_json: audit.after_json || null, auth_basis: 'SYSTEM' });
    return rev;
  });
}

/** Bộ cột C cho dòng do hệ thống tạo */
function cNewSystem_(row) {
  var nowIso = isoVN_(now_());
  row.dataset_epoch = sysProps_().dataset_epoch;
  row.record_version = 1;
  row.created_at = nowIso; row.created_by = SYSTEM_USER;
  row.updated_at = nowIso; row.updated_by = SYSTEM_USER;
  row.archived_at = '';
  return row;
}

// ===== 09_api.js =====
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

// ===== 10_machines.js =====
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

// ===== 11_library.js =====
/* 11_library: thư viện hạng mục kiểm tra (có sẵn ~30 hạng mục, Trưởng bộ phận/Quản trị thêm, sửa) và kiểm tra tiêu chuẩn
 * dùng chung cho hạng mục trong mẫu. Tiêu chuẩn mặc định chỉ là ví dụ: từng mẫu/máy đặt theo tài liệu nhà sản xuất. */

var LV_CHOICES_ = [
  { code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'FAIL' },
  { code: 'NORMAL', vi: 'Bình thường', zh: '正常', result: 'OK' },
  { code: 'HIGH', vi: 'Cao', zh: '偏高', result: 'WARN' }
];

/** [nhóm, tên Việt, tên Trung, kiểu nhập, đơn vị, kiểu tiêu chuẩn, min, max, chú ý dưới, chú ý trên, thêm] */
var LIBRARY_SEED_ = [
  ['TEMP', 'Nhiệt độ dầu', '油温', 'NUMBER', '°C', 'RANGE', 30, 60, null, 55],
  ['TEMP', 'Nhiệt độ khí xả', '排气温度', 'NUMBER', '°C', 'MAX', null, 100, null, 95],
  ['TEMP', 'Nhiệt độ vòng bi', '轴承温度', 'NUMBER', '°C', 'MAX', null, 80, null, 70],
  ['TEMP', 'Nhiệt độ động cơ', '电机温度', 'NUMBER', '°C', 'MAX', null, 90, null, 80],
  ['TEMP', 'Nhiệt độ nước làm mát vào', '冷却水进水温度', 'NUMBER', '°C', 'RANGE', 25, 32, null, null],
  ['TEMP', 'Nhiệt độ nước làm mát ra', '冷却水出水温度', 'NUMBER', '°C', 'RANGE', 25, 32, null, null],
  ['TEMP', 'Nhiệt độ tủ điện', '电柜温度', 'NUMBER', '°C', 'MAX', null, 40, null, 35],
  ['TEMP', 'Nhiệt độ phòng', '室温', 'NUMBER', '°C', 'MAX', null, 35, null, null],
  ['PRESS', 'Áp suất khí nén', '压缩空气压力', 'NUMBER', 'bar', 'RANGE', 6, 8, 6.2, 7.8],
  ['PRESS', 'Áp suất dầu', '油压', 'NUMBER', 'MPa', 'RANGE', 0.3, 0.5, null, null],
  ['PRESS', 'Áp suất nước', '水压', 'NUMBER', 'bar', 'MIN', 2, null, 2.2, null],
  ['PRESS', 'Chênh áp lọc', '过滤器压差', 'NUMBER', 'bar', 'MAX', null, 0.7, null, 0.6],
  ['PRESS', 'Áp cao gas lạnh', '制冷剂高压', 'NUMBER', 'bar', 'NONE', null, null, null, null],
  ['PRESS', 'Áp thấp gas lạnh', '制冷剂低压', 'NUMBER', 'bar', 'NONE', null, null, null, null],
  ['ELEC', 'Điện áp', '电压', 'NUMBER', 'V', 'TOL', null, null, null, null, { nominal: 380, tol: 5 }],
  ['ELEC', 'Dòng điện 3 pha', '三相电流', 'THREE_PHASE', 'A', 'MAX', null, 50, null, null, { extra: { imb_max: 10, imb_warn: 8 } }],
  ['ELEC', 'Hệ số công suất', '功率因数', 'NUMBER', '', 'MIN', 0.9, null, null, null],
  ['ELEC', 'Điện trở cách điện', '绝缘电阻', 'NUMBER', 'MΩ', 'MIN', 1, null, null, null],
  ['ELEC', 'Tần số', '频率', 'NUMBER', 'Hz', 'RANGE', 49.5, 50.5, null, null],
  ['MECH', 'Độ rung', '振动', 'NUMBER', 'mm/s', 'MAX', null, 4.5, null, 3.5],
  ['MECH', 'Tiếng ồn', '噪音', 'NUMBER', 'dB', 'MAX', null, 85, null, null],
  ['MECH', 'Tốc độ quay', '转速', 'NUMBER', 'rpm', 'NONE', null, null, null, null],
  ['MECH', 'Dây đai', '皮带', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Căng đều, không nứt', '张紧均匀，无裂纹'] }],
  ['LEVEL', 'Mức dầu', '油位', 'CHOICE', '', 'NONE', null, null, null, null, { choices: LV_CHOICES_, text: ['Giữa vạch Min – Max', '在 Min – Max 刻度之间'] }],
  ['LEVEL', 'Mức nước', '水位', 'CHOICE', '', 'NONE', null, null, null, null, { choices: LV_CHOICES_ }],
  ['LEVEL', 'Lưu lượng', '流量', 'NUMBER', 'm³/h', 'NONE', null, null, null, null],
  ['QUALITY', 'Điểm sương khí nén', '压缩空气露点', 'NUMBER', '°C', 'MAX', null, 3, null, null],
  ['QUALITY', 'pH nước', '水的pH值', 'NUMBER', '', 'RANGE', 6.5, 8.5, null, null],
  ['QUALITY', 'Độ dẫn điện của nước', '水的电导率', 'NUMBER', 'µS/cm', 'NONE', null, null, null, null],
  ['VISUAL', 'Rò rỉ dầu, khí, nước', '漏油/漏气/漏水', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Không rò rỉ', '无泄漏'] }],
  ['VISUAL', 'Vệ sinh máy', '设备清洁', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Sạch, không bụi bẩn, không vật lạ', '清洁，无灰尘，无异物'] }],
  ['VISUAL', 'Bu lông, che chắn an toàn', '螺栓、安全防护罩', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Chặt, đủ che chắn', '紧固，防护齐全'] }],
  ['VISUAL', 'Đèn báo, nút dừng khẩn', '指示灯、急停按钮', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Hoạt động bình thường', '功能正常'] }],
  ['OTHER', 'Ghi chú khác', '其他备注', 'TEXT', '', 'NONE', null, null, null, null]
];

function librarySeedRows_() {
  var nowIso = isoVN_(now_());
  return LIBRARY_SEED_.map(function (r, i) {
    var x = r[10] || {};
    var row = {
      item_id: 'LIB-' + ('00' + (i + 1)).slice(-3), group_key: r[0], name_vi: r[1], name_zh: r[2], input_type: r[3], unit: r[4],
      std_type: r[5], std_min: r[6], std_max: r[7], std_nominal: x.nominal === undefined ? null : x.nominal,
      std_tol_pct: x.tol === undefined ? null : x.tol, warn_lo: r[8], warn_hi: r[9], choices_json: x.choices || null,
      extra_json: x.extra || null, std_text_vi: x.text ? x.text[0] : '', std_text_zh: x.text ? x.text[1] : '', how_vi: '', how_zh: '',
      sort_order: i + 1, active: true, builtin: true,
      i18n_meta: { name: { src: 'vi', state: 'HUMAN', at: nowIso } }
    };
    return cNewSystem_(row);
  });
}

/** Nạp thư viện có sẵn còn thiếu (setup, migrateSchema) — không ghi đè hạng mục đã sửa */
function seedLibrary_() {
  var have = {};
  readRows_('LibraryItems').forEach(function (r) { have[r.item_id] = true; });
  var add = librarySeedRows_().filter(function (r) { return !have[r.item_id]; });
  if (add.length) systemWrite_(add.map(function (r) { return { sheet: 'LibraryItems', mode: 'insert', row: r }; }));
  return add.length;
}

/* ---------------- Kiểm tra hạng mục (thư viện và mẫu) ---------------- */

var CHOICE_CODE_RE_ = /^[A-Z0-9_]{1,20}$/;

function numField_(errs, prefix, name, v, required) {
  if (v === null || v === undefined || v === '') {
    if (required) errs.push(fieldError_(prefix + name, 'REQUIRED'));
    return null;
  }
  var n = Number(v);
  if (!isFinite(n)) { errs.push(fieldError_(prefix + name, 'INVALID_VALUE')); return null; }
  return n;
}

/**
 * Chuẩn hóa phần tiêu chuẩn của một hạng mục; lỗi ghi vào errs (field có tiền tố, vd "items.3.std_min").
 * Trả object các trường STD (chưa gồm tên/cách kiểm song ngữ — phần đó qua applyTranslations_).
 */
function normStd_(p, errs, prefix) {
  prefix = prefix || '';
  var it = {};
  it.input_type = INPUT_TYPES_.indexOf(p.input_type) >= 0 ? p.input_type : null;
  if (!it.input_type) errs.push(fieldError_(prefix + 'input_type', 'INVALID_VALUE'));
  it.group_key = ITEM_GROUPS_.indexOf(p.group_key) >= 0 ? p.group_key : 'OTHER';
  it.unit = trimStr_(p.unit).slice(0, 20);
  it.std_type = 'NONE';
  it.std_min = null; it.std_max = null; it.std_nominal = null; it.std_tol_pct = null; it.warn_lo = null; it.warn_hi = null;
  it.choices_json = null; it.extra_json = null;
  if (it.input_type === 'NUMBER' || it.input_type === 'THREE_PHASE') {
    it.std_type = STD_TYPES_.indexOf(p.std_type) >= 0 ? p.std_type : 'NONE';
    if (it.std_type === 'RANGE') {
      it.std_min = numField_(errs, prefix, 'std_min', p.std_min, true);
      it.std_max = numField_(errs, prefix, 'std_max', p.std_max, true);
      if (it.std_min !== null && it.std_max !== null && !(it.std_min < it.std_max)) errs.push(fieldError_(prefix + 'std_max', 'STD_INVALID'));
    } else if (it.std_type === 'MAX') {
      it.std_max = numField_(errs, prefix, 'std_max', p.std_max, true);
    } else if (it.std_type === 'MIN') {
      it.std_min = numField_(errs, prefix, 'std_min', p.std_min, true);
    } else if (it.std_type === 'TOL') {
      it.std_nominal = numField_(errs, prefix, 'std_nominal', p.std_nominal, true);
      it.std_tol_pct = numField_(errs, prefix, 'std_tol_pct', p.std_tol_pct, true);
      if (it.std_tol_pct !== null && !(it.std_tol_pct > 0 && it.std_tol_pct < 100)) errs.push(fieldError_(prefix + 'std_tol_pct', 'INVALID_VALUE'));
    }
    it.warn_lo = numField_(errs, prefix, 'warn_lo', p.warn_lo, false);
    it.warn_hi = numField_(errs, prefix, 'warn_hi', p.warn_hi, false);
    if (it.input_type === 'THREE_PHASE') {
      var ex = p.extra_json || {};
      var imbMax = numField_(errs, prefix, 'imb_max', ex.imb_max, false);
      var imbWarn = numField_(errs, prefix, 'imb_warn', ex.imb_warn, false);
      if (imbMax !== null && !(imbMax > 0 && imbMax < 100)) errs.push(fieldError_(prefix + 'imb_max', 'INVALID_VALUE'));
      it.extra_json = { imb_max: imbMax === null ? 10 : imbMax };
      if (imbWarn !== null) it.extra_json.imb_warn = imbWarn;
    }
  } else if (it.input_type === 'CHOICE') {
    var cs = Array.isArray(p.choices_json) ? p.choices_json : [];
    var seen = {}, okN = 0, bad = cs.length < 2 || cs.length > 8;
    var out = cs.map(function (c) {
      c = c || {};
      var code = trimStr_(c.code).toUpperCase();
      var vi = trimStr_(c.vi).slice(0, 60), zh = trimStr_(c.zh).slice(0, 60);
      var res = CHOICE_RESULTS_.indexOf(c.result) >= 0 ? c.result : 'OK';
      if (!CHOICE_CODE_RE_.test(code) || seen[code] || (!vi && !zh)) bad = true;
      seen[code] = true;
      if (res === 'OK') okN++;
      return { code: code, vi: vi, zh: zh, result: res };
    });
    if (bad || !okN) errs.push(fieldError_(prefix + 'choices_json', 'CHOICES_REQUIRED'));
    it.choices_json = out;
  }
  return it;
}

/* ---------------- library.edit ---------------- */

var LIB_I18N_ = ['name', 'std_text', 'how'];

/**
 * library.edit {item_id, group_key, name_vi|name_zh, input_type, unit, std_*, warn_*, choices_json, extra_json, std_text_*, how_*,
 *   sort_order, active}. Hạng mục mới: item_id là UUID do app tạo, expected_version 0.
 */
function libraryEdit_(ctx) {
  var p = ctx.req.payload || {};
  var id = p.item_id;
  var cur = id ? findOne_('LibraryItems', 'item_id', id) : null;
  if (!cur && !isUuidV4_(id)) throw validationError_([fieldError_('item_id', 'ID_INVALID')]);
  var errs = [];
  var std = normStd_(p, errs, '');
  requireOneLang_(errs, p, cur, 'name');
  if (errs.length) throw validationError_(errs);
  var tr = applyTranslations_('LibraryItems', LIB_I18N_, p, cur);
  return executeWrite_(ctx, {
    entity_type: 'LIBRARY_ITEM', entity_id: id,
    build: function () {
      var now = cur ? findOne_('LibraryItems', 'item_id', id) : null;
      if (cur && !now) throw apiError_('NOT_FOUND');
      if (now) assertVersion_(ctx, now, 'LIBRARY_ITEM', 'LibraryItems');
      if (!now && findRowNums_('LibraryItems', 'item_id', id).length) throw validationError_([fieldError_('item_id', 'ID_EXISTS')]);
      var row = Object.assign({}, now || {}, std, tr.values, { item_id: id, i18n_meta: tr.meta });
      delete row.__row;
      row.sort_order = p.sort_order !== undefined && isFinite(Number(p.sort_order)) ? Number(p.sort_order) : (now ? now.sort_order : 999);
      row.active = p.active === undefined ? (now ? now.active : true) : !!p.active;
      if (!now) { row.builtin = false; cNew_(ctx, row); } else cUpdate_(ctx, row);
      return {
        writes: [{ sheet: 'LibraryItems', mode: now ? 'update' : 'insert', row: row }],
        result: { item: projectRow_(ctx, row), record_version: row.record_version },
        record_version: row.record_version,
        audit: { entity_type: 'LIBRARY_ITEM', entity_id: id, before_json: now ? { name_vi: now.name_vi, std_type: now.std_type } : null, after_json: { name_vi: row.name_vi, std_type: row.std_type, active: row.active } }
      };
    }
  });
}

// ===== 12_docs.js =====
/* 12_docs: ảnh của lượt kiểm (mục Không đạt) trên Drive, "ai có link: xem" để app hiện bằng link ảnh (như ảnh hiện trường M&E) */

var DOC_MIME_ = {
  'image/jpeg': { magic: [0xFF, 0xD8, 0xFF], ext: 'jpg' },
  'image/png': { magic: [0x89, 0x50, 0x4E, 0x47], ext: 'png' }
};

function magicOk_(bytes, mime) {
  var m = DOC_MIME_[mime];
  if (!m) return false;
  for (var i = 0; i < m.magic.length; i++) if (u8_(bytes[i]) !== m.magic[i]) return false;
  return true;
}

function appFolder_() {
  var id = prop_('DRIVE_ROOT_FOLDER_ID');
  if (!id) throw apiError_('SYSTEM_NOT_READY');
  return DriveApp.getFolderById(id);
}

function trashQuietly_(f) {
  if (!f) return;
  try { f.setTrashed(true); } catch (e) { /* bỏ qua */ }
}

/**
 * doc.upload {document_id, entity_type: RUN, entity_id: run_id, item_key, kind: PHOTO_CHECK, mime_type, content_b64, thumb_b64}
 * Chạy được từ hàng chờ offline (đi sau lượt kiểm cùng run_id). Người kiểm của lượt hoặc cấp ≥ 3.
 */
function docUpload_(ctx) {
  var p = ctx.req.payload || {};
  var errs = [];
  if (!isUuidV4_(p.document_id)) errs.push(fieldError_('document_id', 'ID_INVALID'));
  var et = DOC_ENTITY_SHEETS_[p.entity_type];
  if (!et) errs.push(fieldError_('entity_type', 'INVALID_VALUE'));
  if (!isUuidV4_(p.entity_id)) errs.push(fieldError_('entity_id', 'ID_INVALID'));
  if (p.kind !== 'PHOTO_CHECK') errs.push(fieldError_('kind', 'INVALID_VALUE'));
  if (!DOC_MIME_[p.mime_type]) errs.push(fieldError_('mime_type', 'FILE_TYPE'));
  if (typeof p.content_b64 !== 'string' || !p.content_b64) errs.push(fieldError_('content_b64', 'REQUIRED'));
  if (Number(ctx.req.expected_version || 0) !== 0) errs.push(fieldError_('expected_version', 'INVALID_VALUE'));
  if (errs.length) throw validationError_(errs);
  var entity = findOne_(et.sheet, et.key, p.entity_id);
  if (!entity || entity.archived_at) throw validationError_([fieldError_('entity_id', 'NOT_FOUND')]);
  var owner = entity.checked_by || entity.reported_by;
  if (owner !== ctx.user.user_id && Number(ctx.user.role_level) < 3) throw apiError_('FORBIDDEN');

  // Đã có thao tác này → không tạo thêm file
  var ex = findOne_('Operations', 'operation_id', ctx.req.operation_id);
  if (ex) return withWriteLock_(function () { return existingOpResponse_(ctx, ex, payloadHash_(ctx)); });
  if (findRowNums_('Documents', 'document_id', p.document_id).length) throw validationError_([fieldError_('document_id', 'ID_EXISTS')]);

  var bytes = b64d_(p.content_b64);
  if (bytes.length > setting_('doc_max_bytes')) throw validationError_([fieldError_('content_b64', 'FILE_TOO_LARGE')]);
  if (!magicOk_(bytes, p.mime_type)) throw validationError_([fieldError_('mime_type', 'FILE_TYPE')]);
  var thumbBytes = null;
  if (typeof p.thumb_b64 === 'string' && p.thumb_b64) {
    thumbBytes = b64d_(p.thumb_b64);
    if (thumbBytes.length > 2000000 || !magicOk_(thumbBytes, 'image/jpeg')) throw validationError_([fieldError_('thumb_b64', 'FILE_TYPE')]);
  }
  // Drive: ngoài khóa ghi
  var folder = appFolder_();
  var file = folder.createFile(Utilities.newBlob(bytes, p.mime_type, p.document_id + '.' + DOC_MIME_[p.mime_type].ext));
  var thumb = thumbBytes ? folder.createFile(Utilities.newBlob(thumbBytes, 'image/jpeg', p.document_id + '_thumb.jpg')) : null;
  var sharing = 'NOT_SHARED', sharingErr = '';
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    if (thumb) thumb.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    sharing = 'LINK_SHARED';
  } catch (e) {
    sharing = 'FAILED'; sharingErr = String(e && e.message || e).slice(0, 80);
  }
  var nowIso = isoVN_(now_());
  var res;
  try {
    res = executeWrite_(ctx, {
      entity_type: 'DOCUMENT', entity_id: p.document_id,
      build: function () {
        if (findRowNums_('Documents', 'document_id', p.document_id).length) throw validationError_([fieldError_('document_id', 'ID_EXISTS')]);
        var row = cNew_(ctx, {
          document_id: p.document_id, entity_type: p.entity_type, entity_id: p.entity_id,
          parent_run_id: p.entity_type === 'RUN' ? p.entity_id : (entity.run_id || ''), kind: p.kind, drive_file_id: file.getId(),
          mime_type: p.mime_type, access_scope: 'LINK_VIEW', active: true, managed_folder_id: folder.getId(), owned_by_app: true,
          drive_sharing_state: sharing, sharing_updated_at: nowIso, sharing_error_code: sharingErr, size_bytes: bytes.length,
          thumb_drive_file_id: thumb ? thumb.getId() : '', item_key: trimStr_(p.item_key).slice(0, 60)
        });
        return {
          writes: [{ sheet: 'Documents', mode: 'insert', row: row }],
          result: { document_id: p.document_id, record_version: 1, record: projectDoc_(ctx, row) },
          record_version: 1,
          audit: { entity_type: 'DOCUMENT', entity_id: p.document_id, before_json: null, after_json: { kind: p.kind, entity_type: p.entity_type, entity_id: p.entity_id, size_bytes: bytes.length } }
        };
      }
    });
  } catch (e) {
    trashQuietly_(file); trashQuietly_(thumb);
    throw e;
  }
  if (res.code === 'DUPLICATE_OPERATION') { trashQuietly_(file); trashQuietly_(thumb); }
  return res;
}

/** Bỏ ID thư mục; ảnh chưa chia sẻ được thì không gửi ID tệp */
function projectDoc_(ctx, d) {
  var o = projectRow_(ctx, d);
  delete o.managed_folder_id;
  if (d.drive_sharing_state !== 'LINK_SHARED') { delete o.drive_file_id; delete o.thumb_drive_file_id; }
  return o;
}

// ===== 13_sync.js =====
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

// ===== 14_templates.js =====
/* 14_templates: mẫu checksheet có phiên bản. Sửa hạng mục = phiên bản mới (đủ các dòng); lượt kiểm cũ giữ tiêu chuẩn lúc kiểm
 * (results_json), nên sửa mẫu không làm sai số liệu các tháng trước. item_key giữ nguyên qua phiên bản. */

var TPL_ITEM_SIG_ = ['item_key', 'group_key', 'name_vi', 'name_zh', 'input_type', 'unit', 'std_type', 'std_min', 'std_max', 'std_nominal',
  'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json', 'std_text_vi', 'std_text_zh', 'how_vi', 'how_zh', 'required',
  'photo_on_fail', 'library_item_id'];
var TPL_ITEM_I18N_ = ['name', 'std_text', 'how'];
var MAX_TEMPLATE_ITEMS_ = 60;

/** Các dòng hạng mục của một phiên bản, theo thứ tự */
function templateItems_(templateId, revision, rows) {
  return (rows || findAll_('TemplateItems', 'template_id', templateId)).filter(function (r) {
    return r.template_id === templateId && Number(r.revision) === Number(revision) && !r.archived_at;
  }).sort(function (a, b) { return (a.step_no || 0) - (b.step_no || 0); });
}

function itemSig_(it) {
  return stableStringify_(TPL_ITEM_SIG_.map(function (f) {
    var v = it[f];
    if (v === undefined || v === '') v = null;
    if (f === 'required' || f === 'photo_on_fail') v = !!v;
    return v;
  }));
}

/** Ca của mẫu: chuỗi "1,3" từ mảng hoặc chuỗi; chỉ số ca đang có trong Settings */
function normShifts_(v) {
  var have = shiftsCfg_().map(function (s) { return String(s.no); });
  var list = (Array.isArray(v) ? v : String(v || '').split(',')).map(function (x) { return String(x).trim(); })
    .filter(function (x, i, a) { return have.indexOf(x) >= 0 && a.indexOf(x) === i; });
  list.sort();
  return list.join(',');
}

/**
 * template.edit {template_id, name_vi|name_zh, frequency, shifts, note_vi|note_zh, items:[…]} (expected_version khi sửa)
 * Mẫu mới: template_id là UUID do app tạo. Hạng mục: item_key có sẵn (giữ khi sửa) hoặc để trống (hạng mục mới).
 */
function templateEdit_(ctx) {
  var p = ctx.req.payload || {};
  var id = p.template_id;
  var cur = id ? findOne_('Templates', 'template_id', id) : null;
  if (!cur && !isUuidV4_(id)) throw validationError_([fieldError_('template_id', 'ID_INVALID')]);
  var errs = [];
  requireOneLang_(errs, p, cur, 'name');
  var freq = p.frequency !== undefined ? p.frequency : (cur ? cur.frequency : null);
  if (FREQUENCIES_.indexOf(freq) < 0) errs.push(fieldError_('frequency', 'INVALID_VALUE'));
  var shifts = freq === 'SHIFT' ? normShifts_(p.shifts !== undefined ? p.shifts : (cur ? cur.shifts : '')) : '';
  if (freq === 'SHIFT' && !shifts) errs.push(fieldError_('shifts', 'SHIFTS_REQUIRED'));
  var curItems = cur ? templateItems_(id, cur.revision) : [];
  var byKey = {};
  curItems.forEach(function (r) { byKey[r.item_key] = r; });
  var itemsIn = Array.isArray(p.items) ? p.items : null;
  if (!cur && !itemsIn) itemsIn = [];
  if (itemsIn && (!itemsIn.length || itemsIn.length > MAX_TEMPLATE_ITEMS_)) errs.push(fieldError_('items', 'ITEMS_REQUIRED'));
  var norm = null;
  if (itemsIn) {
    var keys = {};
    norm = itemsIn.map(function (x, i) {
      x = x || {};
      var pre = 'items.' + i + '.';
      var std = normStd_(x, errs, pre);
      var key = trimStr_(x.item_key);
      if (!key || keys[key]) key = uuid_();
      keys[key] = true;
      var old = byKey[key] || null;
      var tmpErrs = [];
      requireOneLang_(tmpErrs, x, null, 'name');
      tmpErrs.forEach(function (e) { e.field = pre + 'name'; errs.push(e); });
      return { x: x, std: std, key: key, old: old };
    });
  }
  if (errs.length) throw validationError_(errs);
  var trT = applyTranslations_('Templates', ['name', 'note'], p, cur);
  var items = norm ? norm.map(function (n, i) {
    var tr = applyTranslations_('TemplateItems', TPL_ITEM_I18N_, n.x, n.old);
    return Object.assign({}, n.std, tr.values, {
      item_key: n.key, step_no: i + 1, required: n.x.required === undefined ? true : !!n.x.required, photo_on_fail: !!n.x.photo_on_fail,
      library_item_id: trimStr_(n.x.library_item_id), i18n_meta: tr.meta
    });
  }) : null;
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: id,
    build: function (st) {
      var now = cur ? findOne_('Templates', 'template_id', id) : null;
      if (cur && !now) throw apiError_('NOT_FOUND');
      if (now) assertVersion_(ctx, now, 'TEMPLATE', 'Templates');
      if (!now && findRowNums_('Templates', 'template_id', id).length) throw validationError_([fieldError_('template_id', 'ID_EXISTS')]);
      var su = {};
      var nowItems = now ? templateItems_(id, now.revision) : [];
      var changed = !now;
      if (items && now) {
        var a = nowItems.map(itemSig_).join('|'), b = items.map(itemSig_).join('|');
        changed = a !== b;
      }
      var row = Object.assign({}, now || {}, trT.values, { template_id: id, frequency: freq, shifts: shifts, i18n_meta: trT.meta });
      delete row.__row;
      if (p.active !== undefined) row.active = !!p.active; else if (!now) row.active = true;
      var writes = [];
      if (!now) {
        row.template_code = allocCode_(st, su, 'TEMPLATE');
        row.revision = 1;
        cNew_(ctx, row);
      } else {
        if (changed) row.revision = Number(now.revision || 1) + 1;
        cUpdate_(ctx, row);
      }
      if (changed) {
        items.forEach(function (it) {
          var r = Object.assign({}, it, { template_item_id: uuid_(), template_id: id, revision: row.revision });
          writes.push({ sheet: 'TemplateItems', mode: 'insert', row: cNew_(ctx, r) });
        });
      }
      writes.unshift({ sheet: 'Templates', mode: now ? 'update' : 'insert', row: row });
      var outItems = changed ? writes.slice(1).map(function (w) { return projectRow_(ctx, w.row); }) : nowItems.map(function (r) { return projectRow_(ctx, r); });
      return {
        writes: writes, state: su,
        result: { template: projectRow_(ctx, row), items: outItems, new_revision: changed, record_version: row.record_version },
        record_version: row.record_version,
        audit: {
          entity_type: 'TEMPLATE', entity_id: id, before_json: now ? { revision: now.revision, name_vi: now.name_vi, frequency: now.frequency } : null,
          after_json: { revision: row.revision, name_vi: row.name_vi, frequency: row.frequency, shifts: row.shifts, items: items ? items.length : nowItems.length }
        }
      };
    }
  });
}

/** template.archive {template_id, active} — ngừng/dùng lại mẫu (máy đã gán không còn phải kiểm theo mẫu đã ngừng) */
function templateArchive_(ctx) {
  var p = ctx.req.payload || {};
  if (!isUuidV4_(p.template_id)) throw validationError_([fieldError_('template_id', 'ID_INVALID')]);
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: p.template_id,
    build: function () {
      var now = findOne_('Templates', 'template_id', p.template_id);
      if (!now) throw apiError_('NOT_FOUND');
      assertVersion_(ctx, now, 'TEMPLATE', 'Templates');
      var row = Object.assign({}, now, { active: !!p.active });
      delete row.__row;
      cUpdate_(ctx, row);
      return {
        writes: [{ sheet: 'Templates', mode: 'update', row: row }],
        result: { template: projectRow_(ctx, row), record_version: row.record_version }, record_version: row.record_version,
        audit: { entity_type: 'TEMPLATE', entity_id: p.template_id, before_json: { active: now.active }, after_json: { active: row.active } }
      };
    }
  });
}

// ===== 15_admin.js =====
/* 15_admin: hàm chạy từ trình soạn Apps Script và trigger (lấy từ M&E)
 * Tên không có hậu tố "_" để hiện trong menu Chạy; không có tham số. */

function log_(msg) {
  Logger.log(msg);
}

/** Tạo một sheet với hàng tiêu đề, cố định hàng 1, định dạng ô theo kiểu (3.1) */
function createSheet_(book, name) {
  var s = sheetSchema_(name);
  var sheet = book.insertSheet(name);
  var cols = s.cols;
  if (sheet.getMaxColumns() < cols.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  formatColumns_(sheet, name, cols, 0);
  return sheet;
}

/** Đặt định dạng Văn bản (@) cho các cột ID/CODE/DATE/DATETIME/JSON/STRING/ENUM từ vị trí fromIdx; gom cột liền nhau */
function formatColumns_(sheet, name, headerCols, fromIdx) {
  var types = sheetSchema_(name).types;
  var rows = Math.max(1, sheet.getMaxRows() - 1);
  var i = fromIdx;
  while (i < headerCols.length) {
    if (!TEXT_FORMAT_TYPES_[types[headerCols[i]] || 'STRING']) { i++; continue; }
    var j = i;
    while (j + 1 < headerCols.length && TEXT_FORMAT_TYPES_[types[headerCols[j + 1]] || 'STRING']) j++;
    sheet.getRange(2, i + 1, rows, j - i + 1).setNumberFormat('@');
    i = j + 1;
  }
}

function settingRow_(d) {
  var v = d[1] === 'JSON' ? JSON.stringify(d[2]) : (d[1] === 'BOOL' ? (d[2] ? 'true' : 'false') : String(d[2]));
  return { setting_key: d[0], value: v, value_type: d[1], description_vi: d[5], description_zh: d[6], updated_at: isoVN_(now_()), updated_by: SYSTEM_USER, i18n_meta: { description: { src: 'vi', state: 'HUMAN', at: isoVN_(now_()) } } };
}

/** Dựng môi trường mới (THỬ hoặc THẬT). Đã có BUSINESS_SPREADSHEET_ID thì dừng. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('BUSINESS_SPREADSHEET_ID')) {
    log_('Đã cài đặt trước đó — không làm gì. Muốn thêm sheet/cột thì chạy migrateSchema.');
    return;
  }
  // ENV đặt tay trước setup: quên đặt ở dự án THẬT thì THẬT chạy như THỬ (TEST_*, dữ liệu mẫu) — nên bắt buộc
  var env = String(props.getProperty('ENV') || '').trim();
  if (env !== 'THU' && env !== 'THAT') {
    throw new Error('Chưa đặt thuộc tính ENV (hoặc sai). Cài đặt dự án → Thuộc tính tập lệnh → thêm ENV = THAT (máy chủ dùng thật) hoặc THU (máy chủ thử), rồi chạy lại setup.');
  }
  props.setProperty('ENV', env);
  adminSetupSecrets();
  var suffix = env === 'THU' ? '_THU' : '';
  var parent = DriveApp.createFolder(NAME_PREFIX + 'HeThong' + suffix);
  var dataFolder = parent.createFolder(NAME_PREFIX + 'Data' + suffix);
  var backupFolder = parent.createFolder(NAME_PREFIX + 'Backups' + suffix);
  var biz = SpreadsheetApp.create(NAME_PREFIX + 'NghiepVu' + suffix);
  var sec = SpreadsheetApp.create(NAME_PREFIX + 'BaoMat' + suffix);
  biz.setSpreadsheetTimeZone(TZ);
  sec.setSpreadsheetTimeZone(TZ);
  DriveApp.getFileById(biz.getId()).moveTo(parent);
  DriveApp.getFileById(sec.getId()).moveTo(parent);
  props.setProperties({
    BUSINESS_SPREADSHEET_ID: biz.getId(), SECURITY_SPREADSHEET_ID: sec.getId(),
    DRIVE_ROOT_FOLDER_ID: dataFolder.getId(), DRIVE_BACKUP_FOLDER_ID: backupFolder.getId(),
    DATASET_EPOCH: uuid_(), MAINTENANCE_MODE: 'false'
  });
  dbReset_();
  sheetsForDot_(RELEASED_DOT).forEach(function (name) {
    createSheet_(sheetSchema_(name).book === 'S' ? sec : biz, name);
  });
  [biz, sec].forEach(function (b) {
    b.getSheets().forEach(function (s) { if (!SHEETS[s.getName()]) b.deleteSheet(s); });
  });
  dbReset_();
  seedBaseRows_();
  clearSysCaches_();
  log_('Xong setup. ENV=' + env + '. Đã tạo ' + sheetsForDot_(RELEASED_DOT).length + ' sheet trong thư mục ' + parent.getName() +
    '. Bước tiếp theo: đặt SETUP_OWNER_CODE, SETUP_OWNER_NAME, SETUP_OWNER_TEMP_PIN rồi chạy adminSetupOwner.');
  installTriggers();
}

/** Nạp Settings, SystemState, thư viện hạng mục còn thiếu (dùng chung cho setup và migrateSchema) */
function seedBaseRows_() {
  withWriteLock_(function () {
    var have = {};
    readRows_('Settings').forEach(function (r) { have[r.setting_key] = true; });
    var add = SETTINGS_DEFAULTS.filter(function (d) { return d[4] <= RELEASED_DOT && !have[d[0]]; }).map(settingRow_);
    if (add.length) insertRows_('Settings', add);

    var st = readState_();
    var su = {};
    SYSTEM_STATE_INITIAL.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(st.map, k[0])) su[k[0]] = [k[1], k[2]];
    });
    su.dataset_epoch = ['STRING', prop_('DATASET_EPOCH')];
    su.maintenance_mode = ['BOOL', prop_('MAINTENANCE_MODE') === 'true'];
    su.schema_version = ['STRING', SCHEMA_VERSION];
    stateWrite_(st, su, SYSTEM_USER);
    // Thư viện hạng mục có sẵn (nhiệt độ, áp suất, điện, cơ khí…)
    seedLibrary_();
  });
}

/** Thêm sheet/cột/Settings còn thiếu; chạy nhiều lần vẫn cùng kết quả */
function migrateSchema() {
  if (!prop_('BUSINESS_SPREADSHEET_ID')) throw new Error('Chưa setup');
  dbReset_();
  var added = [];
  sheetsForDot_(RELEASED_DOT).forEach(function (name) {
    var s = sheetSchema_(name);
    var book = book_(s.book);
    var sheet = book.getSheetByName(name);
    if (!sheet) { createSheet_(book, name); added.push(name); return; }
    var n = sheet.getLastColumn();
    var header = n ? sheet.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
    var missing = s.cols.filter(function (c) { return header.indexOf(c) < 0; });
    if (missing.length) {
      if (sheet.getMaxColumns() < header.length + missing.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), header.length + missing.length - sheet.getMaxColumns());
      }
      sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      added.push(name + '(' + missing.join(',') + ')');
    }
    // Định dạng Văn bản cho mọi cột kiểu chuỗi, kể cả cột cũ vừa đổi kiểu (vd. due_revision)
    formatColumns_(sheet, name, header.concat(missing), 0);
  });
  dbReset_();
  seedBaseRows_();
  clearSysCaches_();
  log_('migrateSchema xong. Thêm: ' + (added.length ? added.join('; ') : 'không có') + '. schema_version=' + SCHEMA_VERSION);
}

function clearSysCaches_() {
  cache_().removeAll(['sys:props', 'sys:state', 'cfg:settings']);
}

/** Sinh PIN_PEPPER_V1, TOKEN_SECRET_V1 nếu chưa có; không ghi đè */
function adminSetupSecrets() {
  var props = PropertiesService.getScriptProperties();
  ['PIN_PEPPER_V1', 'TOKEN_SECRET_V1'].forEach(function (k) {
    if (props.getProperty(k)) { log_(k + ': đã có, giữ nguyên.'); return; }
    props.setProperty(k, b64_(randomSecret32_()));
    log_(k + ': đã tạo.');
  });
}

/** Tạo owner đầu tiên từ SETUP_OWNER_CODE, SETUP_OWNER_NAME, SETUP_OWNER_TEMP_PIN; xóa ba khóa ngay sau khi dùng */
function adminSetupOwner() {
  if (!prop_('BUSINESS_SPREADSHEET_ID')) throw new Error('Chưa setup — chạy setup trước.');
  var code = normEmpCode_(prop_('SETUP_OWNER_CODE'));
  var name = trimStr_(prop_('SETUP_OWNER_NAME'));
  var pin = trimStr_(prop_('SETUP_OWNER_TEMP_PIN'));
  if (!code || !name || !pin) throw new Error('Thiếu SETUP_OWNER_CODE / SETUP_OWNER_NAME / SETUP_OWNER_TEMP_PIN trong Thuộc tính tập lệnh.');
  if (!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(code)) throw new Error('Mã nhân viên chỉ gồm chữ, số, dấu . _ -');
  var weak = pinWeakReason_(pin, code, null);
  if (weak) throw new Error('PIN tạm không hợp lệ hoặc quá dễ đoán (' + weak + '). Chọn 6 số khác.');
  dbReset_();
  var created = withWriteLock_(function () {
    var users = readRows_('Users');
    if (users.some(function (u) { return u.is_system_owner && u.active && Number(u.role_level) === 4; })) {
      return 'EXISTS';
    }
    if (users.some(function (u) { return u.employee_code === code; })) throw new Error('Mã nhân viên đã tồn tại: ' + code);
    var rec = newPinRecord_(pin);
    var nowIso = isoVN_(now_());
    insertRows_('Users', [{
      user_id: uuid_(), employee_code: code, display_name: name, email: '', role_level: 4, active: true,
      pin_hash: rec.pin_hash, salt: rec.salt, pin_hash_version: rec.pin_hash_version, failed_attempts: 0, locked_until: '',
      created_at: nowIso, updated_at: nowIso, auth_version: 1, is_system_owner: true, must_change_pin: true,
      temp_pin_expires_at: isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000)), pin_changed_at: '',
      failed_window_started_at: '', last_login_at: '', record_version: 1, created_by: SYSTEM_USER, updated_by: SYSTEM_USER, area_ids: ''
    }]);
    return 'CREATED';
  });
  ['SETUP_OWNER_CODE', 'SETUP_OWNER_NAME', 'SETUP_OWNER_TEMP_PIN'].forEach(delProp_);
  if (created === 'EXISTS') log_('Đã có owner đang hoạt động — không tạo thêm. Đã xóa 3 khóa SETUP_OWNER_*.');
  else log_('Đã tạo owner ' + code + ' (cấp 4). Đăng nhập bằng PIN tạm trong 72 giờ, app sẽ bắt đổi PIN. Đã xóa 3 khóa SETUP_OWNER_*.');
}

/**
 * Owner quên PIN (cả THỬ lẫn THẬT): trong app không ai được động tới owner trừ chính owner,
 * nên người giữ tài khoản Google cấp PIN tạm từ trình soạn. Đặt OWNER_RESET_TEMP_PIN (6 số) rồi chạy hàm này;
 * khóa tự xóa ngay, không ghi PIN vào log. Owner đăng nhập bằng PIN tạm trong 72 giờ và phải đổi PIN; mọi phiên cũ bị thu hồi.
 */
function adminResetOwnerPin() {
  if (!prop_('BUSINESS_SPREADSHEET_ID')) throw new Error('Chưa setup — chạy setup trước.');
  var pin = trimStr_(prop_('OWNER_RESET_TEMP_PIN'));
  delProp_('OWNER_RESET_TEMP_PIN');
  if (!pin) throw new Error('Thiếu OWNER_RESET_TEMP_PIN (6 số) trong Thuộc tính tập lệnh.');
  dbReset_();
  var code = withWriteLock_(function () {
    var owners = readRows_('Users').filter(function (u) { return u.is_system_owner && Number(u.role_level) === 4; });
    if (!owners.length) throw new Error('Chưa có owner — dùng adminSetupOwner.');
    if (owners.length > 1) throw new Error('Có hơn một owner — sửa tay sheet Users trước.');
    var u = owners[0];
    var weak = pinWeakReason_(pin, u.employee_code, null);
    if (weak) throw new Error('PIN tạm không hợp lệ hoặc quá dễ đoán (' + weak + '). Chọn 6 số khác.');
    var rec = newPinRecord_(pin);
    bumpAuthVersion_(u, {
      pin_hash: rec.pin_hash, salt: rec.salt, pin_hash_version: rec.pin_hash_version, must_change_pin: true,
      temp_pin_expires_at: isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000)),
      failed_attempts: 0, failed_window_started_at: '', locked_until: '', active: true
    });
    writeAudit_({ user_id: SYSTEM_USER, action: 'user.resetPin', entity_type: 'USER', entity_id: u.user_id, before_json: null, after_json: { temp_pin_issued: true, by: 'adminResetOwnerPin' }, auth_basis: 'OWNER' });
    return u.employee_code;
  });
  log_('Đã cấp PIN tạm cho owner ' + code + ' (hạn 72 giờ). Mọi phiên cũ của owner đã bị thu hồi; đăng nhập rồi đổi PIN ngay. Đã xóa OWNER_RESET_TEMP_PIN.');
}

var TRIGGER_FUNCS_ = ['syncMachinesHourly', 'runBackgroundJobs', 'backupData'];

/** Xóa trigger trùng tên rồi tạo lại đúng 3 trigger định kỳ: lấy thiết bị từ M&E mỗi giờ, dịch bù mỗi 3 giờ, sao lưu hằng tuần */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (TRIGGER_FUNCS_.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncMachinesHourly').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('runBackgroundJobs').timeBased().everyHours(3).create();
  var wd = ScriptApp.WeekDay[String(setting_('backup_weekday') || 'SUNDAY')] || ScriptApp.WeekDay.SUNDAY;
  ScriptApp.newTrigger('backupData').timeBased().onWeekDay(wd).atHour(Number(setting_('backup_hour'))).inTimezone(TZ).create();
  var names = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  log_('Đã cài trigger: ' + names.join(', '));
}

/**
 * Kết nối M&E từ trình soạn (thay cho màn Quản trị → Kết nối M&E): đặt ME_EXEC_URL (link /exec của máy chủ M&E) và
 * ME_FEED_KEY (mã kết nối tạo bằng adminCreateFeedKey bên M&E) trong Thuộc tính tập lệnh rồi chạy hàm này để lấy danh sách lần đầu.
 */
function adminSyncMachinesNow() {
  dbReset_();
  var out = syncMachines_(true);
  log_('Đã lấy danh sách từ M&E: ' + JSON.stringify(out));
}

function setMaintenance_(on) {
  setProp_('MAINTENANCE_MODE', on ? 'true' : 'false');
  withWriteLock_(function () {
    var st = readState_();
    stateWrite_(st, { maintenance_mode: ['BOOL', !!on] }, SYSTEM_USER);
  });
  cache_().removeAll(['sys:props', 'sys:state']);
}

function adminMaintenanceOn() { setMaintenance_(true); log_('Đã BẬT bảo trì.'); }
function adminMaintenanceOff() { setMaintenance_(false); log_('Đã TẮT bảo trì.'); }

function adminClearLoginPause() {
  withWriteLock_(function () {
    var st = readState_();
    stateWrite_(st, { login_paused_until: ['DATETIME', ''] }, SYSTEM_USER);
  });
  cache_().remove('sys:state');
  log_('Đã gỡ tạm dừng đăng nhập.');
}

function adminFlushAuthCache() {
  var keys = [];
  readRows_('Sessions').forEach(function (s) { keys.push('ss:' + s.session_id); });
  readRows_('Users').forEach(function (u) { keys.push('us:' + u.user_id); });
  keys.push('users:dir');
  for (var i = 0; i < keys.length; i += 500) cache_().removeAll(keys.slice(i, i + 500));
  log_('Đã xóa ' + keys.length + ' khóa cache phiên/người dùng.');
}

/* syncMachinesHourly (lấy thiết bị từ M&E mỗi giờ) ở 10_machines.js; runBackgroundJobs (dịch bù) ở 21_i18n.js;
   backupData (sao lưu hằng tuần) ở 23_backup.js */

// ===== 16_assign.js =====
/* 16_assign: gán mẫu cho máy và tiêu chuẩn riêng theo từng máy (overrides_json, khóa theo item_key của hạng mục) */

var OVERRIDE_FIELDS_ = ['unit', 'std_type', 'std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi', 'extra_json'];

/** Kiểm và chuẩn hóa tiêu chuẩn riêng theo hạng mục của phiên bản hiện tại của mẫu */
function normOverrides_(ov, items, errs) {
  if (ov === undefined || ov === null) return null;
  if (typeof ov !== 'object' || Array.isArray(ov)) { errs.push(fieldError_('overrides', 'INVALID_VALUE')); return null; }
  var byKey = {};
  items.forEach(function (r) { byKey[r.item_key] = r; });
  var out = {};
  Object.keys(ov).forEach(function (k) {
    var o = ov[k];
    if (!o || typeof o !== 'object' || !Object.keys(o).length) return;
    var ti = byKey[k];
    if (!ti) { errs.push(fieldError_('overrides.' + k, 'NOT_FOUND')); return; }
    if (ti.input_type !== 'NUMBER' && ti.input_type !== 'THREE_PHASE') { errs.push(fieldError_('overrides.' + k, 'INVALID_VALUE')); return; }
    var merged = Object.assign({}, ti, o, { input_type: ti.input_type });
    var std = normStd_(merged, errs, 'overrides.' + k + '.');
    var keep = {};
    OVERRIDE_FIELDS_.forEach(function (f) { keep[f] = std[f]; });
    out[k] = keep;
  });
  return Object.keys(out).length ? out : null;
}

/**
 * assignment.edit {assignment_id, machine_id, template_id, active, overrides, note} — gán (mới) hoặc sửa tiêu chuẩn riêng, ngừng gán.
 */
function assignmentEdit_(ctx) {
  var p = ctx.req.payload || {};
  var id = p.assignment_id;
  var cur = id ? findOne_('Assignments', 'assignment_id', id) : null;
  if (!cur && !isUuidV4_(id)) throw validationError_([fieldError_('assignment_id', 'ID_INVALID')]);
  var machineId = cur ? cur.machine_id : p.machine_id;
  var templateId = cur ? cur.template_id : p.template_id;
  var tpl = findOne_('Templates', 'template_id', templateId);
  var mac = findOne_('Machines', 'machine_id', machineId);
  var errs = [];
  if (!tpl) errs.push(fieldError_('template_id', 'NOT_FOUND'));
  if (!mac) errs.push(fieldError_('machine_id', 'NOT_FOUND'));
  if (errs.length) throw validationError_(errs);
  var items = templateItems_(templateId, tpl.revision);
  var ov = p.overrides !== undefined ? normOverrides_(p.overrides, items, errs) : (cur ? cur.overrides_json : null);
  if (errs.length) throw validationError_(errs);
  return executeWrite_(ctx, {
    entity_type: 'ASSIGNMENT', entity_id: id,
    build: function () {
      var now = cur ? findOne_('Assignments', 'assignment_id', id) : null;
      if (now) assertVersion_(ctx, now, 'ASSIGNMENT', 'Assignments');
      var active = p.active === undefined ? (now ? now.active : true) : !!p.active;
      if (active) {
        var dup = findAll_('Assignments', 'machine_id', machineId).some(function (a) {
          return a.assignment_id !== id && a.template_id === templateId && a.active && !a.archived_at;
        });
        if (dup) throw validationError_([fieldError_('template_id', 'ASSIGNMENT_EXISTS')]);
        if (!now && !mac.active) throw validationError_([fieldError_('machine_id', 'MACHINE_INACTIVE')]);
      }
      var row = Object.assign({}, now || {}, {
        assignment_id: id, machine_id: machineId, template_id: templateId, active: active, overrides_json: ov,
        note: p.note !== undefined ? trimStr_(p.note).slice(0, 300) : (now ? now.note : ''),
        start_date: now ? now.start_date : todayVN_()
      });
      delete row.__row;
      if (now) cUpdate_(ctx, row); else cNew_(ctx, row);
      return {
        writes: [{ sheet: 'Assignments', mode: now ? 'update' : 'insert', row: row }],
        result: { assignment: projectRow_(ctx, row), record_version: row.record_version }, record_version: row.record_version,
        audit: { entity_type: 'ASSIGNMENT', entity_id: id, before_json: now ? { active: now.active, overrides_json: now.overrides_json } : null, after_json: { machine_id: machineId, template_id: templateId, active: active, overrides_json: ov } }
      };
    }
  });
}

/** assignment.add {template_id, machine_ids[]} — gán một mẫu cho nhiều máy (bỏ qua máy đã gán; gán lại máy đã ngừng gán) */
function assignmentAdd_(ctx) {
  var p = ctx.req.payload || {};
  var ids = Array.isArray(p.machine_ids) ? p.machine_ids.filter(function (x, i, a) { return typeof x === 'string' && x && a.indexOf(x) === i; }) : [];
  if (!ids.length || ids.length > 500) throw validationError_([fieldError_('machine_ids', 'REQUIRED')]);
  var tpl = findOne_('Templates', 'template_id', p.template_id);
  if (!tpl) throw validationError_([fieldError_('template_id', 'NOT_FOUND')]);
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: p.template_id,
    build: function () {
      var macs = {};
      readRows_('Machines').forEach(function (m) { macs[m.machine_id] = m; });
      var mine = readRows_('Assignments').filter(function (a) { return a.template_id === p.template_id && !a.archived_at; });
      var writes = [], added = 0, skipped = 0, reactivated = 0;
      ids.forEach(function (mid) {
        var m = macs[mid];
        if (!m || !m.active) { skipped++; return; }
        var ex = mine.filter(function (a) { return a.machine_id === mid; });
        if (ex.some(function (a) { return a.active; })) { skipped++; return; }
        if (ex.length) {
          var row = Object.assign({}, ex[0], { active: true });
          delete row.__row;
          cUpdate_(ctx, row);
          writes.push({ sheet: 'Assignments', mode: 'update', row: row });
          reactivated++;
          return;
        }
        writes.push({ sheet: 'Assignments', mode: 'insert', row: cNew_(ctx, { assignment_id: uuid_(), machine_id: mid, template_id: p.template_id, active: true, overrides_json: null, start_date: todayVN_(), note: '' }) });
        added++;
      });
      return {
        writes: writes,
        result: { added: added, reactivated: reactivated, skipped: skipped, assignments: writes.map(function (w) { return projectRow_(ctx, w.row); }) },
        audit: { entity_type: 'TEMPLATE', entity_id: p.template_id, before_json: null, after_json: { added: added, reactivated: reactivated, skipped: skipped } }
      };
    }
  });
}

// ===== 17_judge.js =====
/* 17_judge: tiêu chuẩn hiệu lực (mẫu + tiêu chuẩn riêng theo máy), đánh giá Đạt / Cần chú ý / Không đạt, ca và kỳ kiểm.
 * App có bản cùng quy tắc ở js/judge.js (tests/server/judge.test.mjs so hai bản trên cùng bộ ví dụ). */

/** Trường tiêu chuẩn được ghi đè theo từng máy (Assignments.overrides_json, khóa theo item_key) */
var STD_FIELDS_ = ['unit', 'std_type', 'std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json', 'std_text_vi', 'std_text_zh'];
var ITEM_COPY_FIELDS_ = ['item_key', 'template_item_id', 'step_no', 'group_key', 'name_vi', 'name_zh', 'input_type', 'how_vi', 'how_zh', 'required', 'photo_on_fail'];

function numOrNull_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/** Hạng mục hiệu lực của một máy: hạng mục của mẫu + tiêu chuẩn riêng (nếu có) */
function effItem_(ti, overrides) {
  var o = {};
  ITEM_COPY_FIELDS_.concat(STD_FIELDS_).forEach(function (f) { o[f] = ti[f] === undefined ? null : ti[f]; });
  var ov = overrides && ti.item_key ? overrides[ti.item_key] : null;
  if (ov && typeof ov === 'object') {
    STD_FIELDS_.forEach(function (f) { if (ov[f] !== undefined && ov[f] !== null && ov[f] !== '') o[f] = ov[f]; });
    o.overridden = true;
  }
  return o;
}

/** Giới hạn đạt {min, max} theo kiểu tiêu chuẩn; null = không giới hạn phía đó */
function stdBounds_(it) {
  var min = numOrNull_(it.std_min), max = numOrNull_(it.std_max);
  switch (it.std_type) {
    case 'RANGE': return { min: min, max: max };
    case 'MAX': return { min: null, max: max };
    case 'MIN': return { min: min, max: null };
    case 'TOL': {
      var nom = numOrNull_(it.std_nominal), t = numOrNull_(it.std_tol_pct);
      if (nom === null || t === null) return { min: null, max: null };
      var d = Math.abs(nom) * t / 100;
      return { min: Math.round((nom - d) * 1e6) / 1e6, max: Math.round((nom + d) * 1e6) / 1e6 };
    }
    default: return { min: null, max: null };
  }
}

function judgeNum_(it, v) {
  var n = numOrNull_(v);
  if (n === null) return 'EMPTY';
  var b = stdBounds_(it);
  if (b.min !== null && n < b.min) return 'FAIL';
  if (b.max !== null && n > b.max) return 'FAIL';
  var wl = numOrNull_(it.warn_lo), wh = numOrNull_(it.warn_hi);
  if ((wl !== null && n <= wl) || (wh !== null && n >= wh)) return 'WARN';
  return 'OK';
}

/** Lệch pha (%) = độ lệch lớn nhất so với trung bình / trung bình */
function imbalancePct_(vals) {
  var avg = (vals[0] + vals[1] + vals[2]) / 3;
  if (!(avg > 0)) return 0;
  var dev = Math.max(Math.abs(vals[0] - avg), Math.abs(vals[1] - avg), Math.abs(vals[2] - avg));
  return Math.round(dev / avg * 1000) / 10;
}

/**
 * Đánh giá một hạng mục. input: {value, values:[R,S,T], choice, pass, text}
 * Trả {result: OK|WARN|FAIL|EMPTY, imb?}
 */
function judgeItem_(it, input) {
  input = input || {};
  switch (it.input_type) {
    case 'NUMBER': return { result: judgeNum_(it, input.value) };
    case 'THREE_PHASE': {
      var raw = Array.isArray(input.values) ? input.values : [];
      var vals = [0, 1, 2].map(function (i) { return numOrNull_(raw[i]); });
      if (vals.some(function (x) { return x === null; })) return { result: 'EMPTY' };
      var ex = it.extra_json || {};
      var imbMax = numOrNull_(ex.imb_max), imbWarn = numOrNull_(ex.imb_warn);
      if (imbMax === null) imbMax = 10;
      var imb = imbalancePct_(vals);
      var per = vals.map(function (x) { return judgeNum_(it, x); });
      if (per.indexOf('FAIL') >= 0 || imb > imbMax) return { result: 'FAIL', imb: imb };
      if (per.indexOf('WARN') >= 0 || (imbWarn !== null && imb >= imbWarn)) return { result: 'WARN', imb: imb };
      return { result: 'OK', imb: imb };
    }
    case 'CHOICE': {
      var cs = Array.isArray(it.choices_json) ? it.choices_json : [];
      for (var i = 0; i < cs.length; i++) if (cs[i] && cs[i].code === input.choice) return { result: CHOICE_RESULTS_.indexOf(cs[i].result) >= 0 ? cs[i].result : 'OK' };
      return { result: 'EMPTY' };
    }
    case 'PASS_FAIL':
      if (input.pass === true) return { result: 'OK' };
      if (input.pass === false) return { result: 'FAIL' };
      return { result: 'EMPTY' };
    case 'TEXT':
      return { result: trimStr_(input.text) ? 'OK' : 'EMPTY' };
    default:
      return { result: 'EMPTY' };
  }
}

/** Số kiểu Việt: phần lẻ dấu phẩy, tối đa 3 chữ số lẻ */
function fmtNumVi_(n) {
  if (n === null || n === undefined || n === '' || !isFinite(Number(n))) return '';
  var s = String(Math.round(Number(n) * 1000) / 1000);
  return s.replace('.', ',');
}

/** Chữ tiêu chuẩn hiện cho người kiểm và trên báo cáo. lang: 'vi' | 'zh' */
function stdText_(it, lang) {
  var u = it.unit ? ' ' + it.unit : '';
  var b = stdBounds_(it);
  var t = '';
  switch (it.std_type) {
    case 'RANGE': t = fmtNumVi_(b.min) + ' – ' + fmtNumVi_(b.max) + u; break;
    case 'MAX': t = '≤ ' + fmtNumVi_(b.max) + u; break;
    case 'MIN': t = '≥ ' + fmtNumVi_(b.min) + u; break;
    case 'TOL': t = fmtNumVi_(it.std_nominal) + u + ' ± ' + fmtNumVi_(it.std_tol_pct) + ' % (' + fmtNumVi_(b.min) + ' – ' + fmtNumVi_(b.max) + u + ')'; break;
    default: t = '';
  }
  if (it.input_type === 'THREE_PHASE') {
    var ex = it.extra_json || {};
    var imbMax = numOrNull_(ex.imb_max);
    t = (t ? t + (lang === 'zh' ? '（每相）' : ' mỗi pha') : '') + (lang === 'zh' ? '，不平衡 ≤ ' : ', lệch ≤ ') + fmtNumVi_(imbMax === null ? 10 : imbMax) + ' %';
  } else if (it.input_type === 'CHOICE') {
    var cs = Array.isArray(it.choices_json) ? it.choices_json : [];
    t = cs.filter(function (c) { return c && c.result === 'OK'; }).map(function (c) { return lang === 'zh' ? (c.zh || c.vi) : (c.vi || c.zh); }).join(' / ');
  }
  var custom = trimStr_(lang === 'zh' ? (it.std_text_zh || it.std_text_vi) : (it.std_text_vi || it.std_text_zh));
  if (it.input_type === 'PASS_FAIL' || it.input_type === 'TEXT' || !t) return custom || t;
  return t;
}

/* ---------------- Ca và kỳ kiểm ---------------- */

function hhmmMin_(s) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  var h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Ca hợp lệ từ Settings (1–4 ca, giờ HH:MM, số ca không trùng) */
function shiftsOk_(list) {
  if (!Array.isArray(list) || !list.length || list.length > 4) return false;
  var seen = {};
  return list.every(function (s) {
    if (!s || seen[s.no] || [1, 2, 3, 4].indexOf(Number(s.no)) < 0) return false;
    seen[s.no] = true;
    var a = hhmmMin_(s.start), b = hhmmMin_(s.end);
    return a !== null && b !== null && a !== b;
  });
}

function shiftsCfg_() {
  var s = setting_('shifts_json');
  if (!shiftsOk_(s)) s = DEFAULT_SHIFTS_;
  return s.slice().sort(function (a, b) { return Number(a.no) - Number(b.no); });
}

function addDaysIso_(iso, n) {
  var d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tuần ISO (Thứ Hai đầu tuần): 2026-W44 */
function isoWeekKey_(iso) {
  var d = new Date(iso + 'T00:00:00Z');
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thứ Năm của tuần quyết định năm
  var y = d.getUTCFullYear();
  var w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + (w < 10 ? '0' : '') + w;
}

/** Khóa kỳ từ tần suất, ngày làm việc và ca */
function periodKey_(freq, workDate, shift) {
  if (freq === 'SHIFT') return workDate + '#' + shift;
  if (freq === 'DAY') return workDate;
  if (freq === 'WEEK') return isoWeekKey_(workDate);
  if (freq === 'MONTH') return workDate.slice(0, 7);
  return '';
}

/**
 * Ngày làm việc và ca của một thời điểm. Ngày làm việc bắt đầu lúc vào ca đầu tiên (mặc định 06:00):
 * 02:00 ngày 29 thuộc ca 3 của ngày 28.
 */
function shiftAt_(d) {
  var p = vnParts_(d);
  var date = p.y + '-' + pad2_(p.m) + '-' + pad2_(p.d);
  var min = p.hh * 60 + p.mi;
  var shifts = shiftsCfg_();
  var dayStart = hhmmMin_(shifts[0].start);
  var workDate = min >= dayStart ? date : addDaysIso_(date, -1);
  var no = '';
  shifts.forEach(function (s) {
    var a = hhmmMin_(s.start), b = hhmmMin_(s.end);
    var inS = a < b ? (min >= a && min < b) : (min >= a || min < b);
    if (inS && !no) no = String(s.no);
  });
  return { work_date: workDate, shift: no };
}

/** Hôm nay theo giờ Việt Nam (THỬ: TEST_TODAY nếu đặt) */
function todayVN_() {
  if (isTestEnv_()) {
    var t = prop_('TEST_TODAY');
    if (t && isDateStr_(t)) return t;
  }
  return dateVN_(now_());
}

/**
 * Các kỳ (cột) của bảng tháng theo tần suất: ngày (theo ca hoặc cả ngày), tuần ISO có ngày trong tháng, hoặc cả tháng.
 * Trả [{key, label, date, last}] — date: ngày đầu của kỳ trong tháng, last: ngày cuối của kỳ trong tháng.
 */
function monthPeriods_(freq, ym, shift) {
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  var days = [];
  for (var d = 1; d <= n; d++) days.push(ym + '-' + pad2_(d));
  if (freq === 'SHIFT' || freq === 'DAY') {
    return days.map(function (iso, i) { return { key: periodKey_(freq, iso, shift), label: String(i + 1), date: iso, last: iso }; });
  }
  if (freq === 'WEEK') {
    var out = [], seen = {};
    days.forEach(function (iso) {
      var k = isoWeekKey_(iso);
      if (seen[k]) { seen[k].last = iso; return; }
      seen[k] = { key: k, label: 'W' + k.slice(-2), date: iso, last: iso };
      out.push(seen[k]);
    });
    return out;
  }
  return [{ key: ym, label: ym.slice(5, 7) + '/' + ym.slice(0, 4), date: days[0], last: days[n - 1] }];
}

function vnMs_(iso, min) { return Date.parse(iso + 'T00:00:00+07:00') + min * 60000; }

/**
 * Mốc bắt đầu và kết thúc (ms) của một kỳ: ca theo giờ ca (ca qua nửa đêm kết thúc ngày hôm sau; ca bắt đầu trước giờ vào ca đầu
 * tiên thuộc ngày hôm sau), ngày từ giờ vào ca đầu tiên tới hôm sau, tuần Thứ Hai–Chủ nhật, tháng trọn tháng.
 * Kỳ chưa kết thúc thì chưa tính là bỏ sót; kỳ chưa bắt đầu để trống.
 */
function periodSpan_(freq, per, shift) {
  var shifts = shiftsCfg_();
  var dayStart = hhmmMin_(shifts[0].start);
  if (freq === 'SHIFT') {
    var s = shifts.filter(function (x) { return String(x.no) === String(shift); })[0] || shifts[0];
    var a = hhmmMin_(s.start), b = hhmmMin_(s.end);
    var startDate = a < dayStart ? addDaysIso_(per.date, 1) : per.date;
    var endDate = b <= a ? addDaysIso_(startDate, 1) : startDate;
    return { start: vnMs_(startDate, a), end: vnMs_(endDate, b) };
  }
  if (freq === 'DAY') return { start: vnMs_(per.date, dayStart), end: vnMs_(addDaysIso_(per.date, 1), dayStart) };
  if (freq === 'WEEK') {
    var d = new Date(per.date + 'T00:00:00Z');
    var wd = d.getUTCDay() || 7;
    var mon = addDaysIso_(per.date, 1 - wd);
    return { start: vnMs_(mon, dayStart), end: vnMs_(addDaysIso_(mon, 7), dayStart) };
  }
  return { start: vnMs_(per.date, dayStart), end: vnMs_(addDaysIso_(per.last, 1), dayStart) };
}

// ===== 18_checks.js =====
/* 18_checks: ghi lượt kiểm (check.submit, chạy được từ hàng chờ offline) và dữ liệu bảng tháng của một máy (check.month).
 * Máy chủ tự đánh giá lại từng hạng mục theo tiêu chuẩn hiệu lực (không tin kết quả app gửi), lưu kèm tiêu chuẩn lúc kiểm,
 * mục Không đạt sinh dòng Abnormals (Trưởng bộ phận xử lý). */

/** Ngày đã được trưởng bộ phận xác nhận cho khu vực của máy → lượt kiểm khóa sửa */
function dayLocked_(workDate, areaId, confirms) {
  return (confirms || findAll_('DayConfirms', 'work_date', workDate)).some(function (c) {
    return c.work_date === workDate && !c.archived_at && (c.area_id === '*' || c.area_id === areaId);
  });
}

/** Chuỗi giá trị đã nhập để hiện trong danh sách bất thường, báo cáo */
function valueText_(it, r) {
  var u = it.unit ? ' ' + it.unit : '';
  if (it.input_type === 'NUMBER') return r.value === null || r.value === undefined ? '' : fmtNumVi_(r.value) + u;
  if (it.input_type === 'THREE_PHASE') {
    if (!Array.isArray(r.values)) return '';
    return r.values.map(fmtNumVi_).join(' / ') + u + (r.imb !== undefined && r.imb !== null ? ' (' + fmtNumVi_(r.imb) + ' %)' : '');
  }
  if (it.input_type === 'CHOICE') {
    var c = (it.choices_json || []).filter(function (x) { return x.code === r.choice; })[0];
    return c ? (c.vi || c.zh) + (c.zh && c.vi ? ' · ' + c.zh : '') : '';
  }
  if (it.input_type === 'PASS_FAIL') return r.pass === true ? 'Đạt · 合格' : (r.pass === false ? 'Không đạt · 不合格' : '');
  return trimStr_(r.text);
}

/** Chuẩn hóa một kết quả nhập */
function normInput_(it, x) {
  x = x || {};
  var o = { note: trimStr_(x.note).slice(0, 500) };
  if (it.input_type === 'NUMBER') o.value = numOrNull_(x.value);
  else if (it.input_type === 'THREE_PHASE') {
    var v = Array.isArray(x.values) ? x.values : [];
    o.values = [0, 1, 2].map(function (i) { return numOrNull_(v[i]); });
    if (o.values.every(function (y) { return y === null; })) o.values = null;
  } else if (it.input_type === 'CHOICE') o.choice = trimStr_(x.choice).toUpperCase() || null;
  else if (it.input_type === 'PASS_FAIL') o.pass = x.pass === true ? true : (x.pass === false ? false : null);
  else if (it.input_type === 'TEXT') o.text = trimStr_(x.text).slice(0, 500);
  return o;
}

/**
 * Đánh giá cả lượt kiểm. Trả {results, counts, errs}.
 * Mỗi kết quả lưu tên, kiểu nhập, tiêu chuẩn hiệu lực và chữ tiêu chuẩn lúc kiểm (sửa mẫu/tiêu chuẩn sau này không đổi kết quả cũ).
 */
function evaluateRun_(items, overrides, inputs) {
  var byKey = {};
  (inputs || []).forEach(function (x) { if (x && x.item_key) byKey[x.item_key] = x; });
  var errs = [];
  var c = { filled: 0, total: 0, fail: 0, warn: 0 };
  var results = items.map(function (ti, i) {
    var it = effItem_(ti, overrides);
    var inp = normInput_(it, byKey[ti.item_key]);
    var j = judgeItem_(it, inp);
    var r = {
      item_key: ti.item_key, template_item_id: ti.template_item_id, step_no: ti.step_no, group_key: ti.group_key,
      name_vi: ti.name_vi, name_zh: ti.name_zh, input_type: it.input_type, unit: it.unit || '',
      std: {}, std_vi: stdText_(it, 'vi'), std_zh: stdText_(it, 'zh'), result: j.result, note: inp.note
    };
    STD_FIELDS_.forEach(function (f) { if (it[f] !== null && it[f] !== undefined && it[f] !== '') r.std[f] = it[f]; });
    ['value', 'values', 'choice', 'pass', 'text'].forEach(function (f) { if (inp[f] !== undefined) r[f] = inp[f]; });
    if (j.imb !== undefined) r.imb = j.imb;
    r.value_text = valueText_(it, r);
    if (it.overridden) r.overridden = true;
    c.total++;
    if (j.result !== 'EMPTY') c.filled++;
    if (j.result === 'FAIL') { c.fail++; if (!r.note) errs.push(fieldError_('results.' + i + '.note', 'FAIL_NOTE_REQUIRED')); }
    if (j.result === 'WARN') c.warn++;
    return r;
  });
  return { results: results, counts: c, errs: errs };
}

/**
 * check.submit {run_id, assignment_id, template_revision, work_date, shift, checked_at, results:[…], note}
 * Lượt mới: expected_version 0. Sửa lượt đã có (cùng kỳ, chưa xác nhận ngày): expected_version = record_version hiện tại.
 */
function checkSubmit_(ctx) {
  var p = ctx.req.payload || {};
  if (!isUuidV4_(p.run_id)) throw validationError_([fieldError_('run_id', 'ID_INVALID')]);
  var cur = findOne_('Runs', 'run_id', p.run_id);
  var asg = findOne_('Assignments', 'assignment_id', cur ? cur.assignment_id : p.assignment_id);
  if (!asg) throw validationError_([fieldError_('assignment_id', 'NOT_ASSIGNED')]);
  var tpl = findOne_('Templates', 'template_id', asg.template_id);
  var mac = findOne_('Machines', 'machine_id', asg.machine_id);
  if (!tpl || !mac) throw validationError_([fieldError_('assignment_id', 'NOT_ASSIGNED')]);
  if (!cur) {
    if (!asg.active || asg.archived_at) throw validationError_([fieldError_('assignment_id', 'NOT_ASSIGNED')]);
    if (!mac.active) throw validationError_([fieldError_('machine_id', 'MACHINE_INACTIVE')]);
    if (!tpl.active) throw validationError_([fieldError_('template_id', 'TEMPLATE_INACTIVE')]);
  }
  var rev = cur ? Number(cur.template_revision) : (Number(p.template_revision) || Number(tpl.revision));
  var items = templateItems_(tpl.template_id, rev);
  if (!items.length) throw validationError_([fieldError_('template_revision', 'REVISION_UNKNOWN')]);
  // Kỳ kiểm: tính lại từ ngày làm việc và ca (không tin period_key app gửi)
  var wd = cur ? cur.work_date : trimStr_(p.work_date);
  var shift = cur ? String(cur.shift || '') : trimStr_(p.shift);
  var freq = tpl.frequency;
  var errs = [];
  if (!isDateStr_(wd)) errs.push(fieldError_('work_date', 'PERIOD_INVALID'));
  if (freq === 'SHIFT') { if (String(tpl.shifts || '').split(',').indexOf(shift) < 0) errs.push(fieldError_('shift', 'PERIOD_INVALID')); } else shift = '';
  if (!errs.length && !cur) {
    var today = todayVN_();
    var back = Number(setting_('check_backdate_days') || 7);
    if (wd > addDaysIso_(today, 1)) errs.push(fieldError_('work_date', 'PERIOD_INVALID'));
    else if (wd < addDaysIso_(today, -back)) errs.push(fieldError_('work_date', 'PERIOD_TOO_OLD'));
  }
  if (errs.length) throw validationError_(errs);
  var periodKey = periodKey_(freq, wd, shift);
  var ev = evaluateRun_(items, asg.overrides_json, p.results);
  if (ev.errs.length) throw validationError_(ev.errs);
  var checkedAt = parseTime_(p.checked_at);
  if (!checkedAt || checkedAt.getTime() > now_().getTime() + 15 * 60000) checkedAt = now_();
  return executeWrite_(ctx, {
    entity_type: 'RUN', entity_id: p.run_id,
    build: function () {
      var now = findOne_('Runs', 'run_id', p.run_id);
      var lvl = Number(ctx.user.role_level);
      if (now) {
        assertVersion_(ctx, now, 'RUN', 'Runs');
        if (now.checked_by !== ctx.user.user_id && lvl < 3) throw apiError_('FORBIDDEN');
      } else {
        var dup = findAll_('Runs', 'assignment_id', asg.assignment_id).filter(function (r) { return r.period_key === periodKey && !r.archived_at; })[0];
        if (dup) throw apiError_('VALIDATION_ERROR', { existing: projectRow_(ctx, dup) }, [fieldError_('run_id', 'RUN_EXISTS')]);
      }
      if (dayLocked_(wd, mac.area_id)) throw validationError_([fieldError_('work_date', 'RUN_LOCKED')]);
      var row = Object.assign({}, now || {}, {
        run_id: p.run_id, machine_id: asg.machine_id, template_id: tpl.template_id, template_revision: rev, assignment_id: asg.assignment_id,
        frequency: freq, period_key: periodKey, work_date: wd, shift: shift,
        status: ev.counts.filled === ev.counts.total ? 'DONE' : 'PARTIAL', results_json: ev.results,
        filled_count: ev.counts.filled, total_count: ev.counts.total, fail_count: ev.counts.fail, warn_count: ev.counts.warn,
        checked_by: now ? now.checked_by : ctx.user.user_id, checked_at: now ? now.checked_at : isoVN_(checkedAt),
        note: trimStr_(p.note).slice(0, 500)
      });
      delete row.__row;
      if (now) cUpdate_(ctx, row); else cNew_(ctx, row);
      var writes = [{ sheet: 'Runs', mode: now ? 'update' : 'insert', row: row }];
      // Bất thường: một dòng mỗi mục Không đạt; mục hết Không đạt khi sửa lượt → Đã hủy; mục đã xử lý giữ nguyên
      var olds = now ? findAll_('Abnormals', 'run_id', p.run_id).filter(function (a) { return a.status === 'OPEN' && !a.archived_at; }) : [];
      var openByKey = {};
      olds.forEach(function (a) { openByKey[a.item_key] = a; });
      var abn = [];
      ev.results.forEach(function (r) {
        if (r.result !== 'FAIL') return;
        var a = openByKey[r.item_key];
        var fields = {
          run_id: p.run_id, machine_id: asg.machine_id, template_id: tpl.template_id, item_key: r.item_key, item_name_vi: r.name_vi,
          item_name_zh: r.name_zh, value_text: r.value_text, std_text: r.std_vi, result: 'FAIL', note: r.note, period_key: periodKey,
          work_date: wd, shift: shift
        };
        if (a) {
          delete openByKey[r.item_key];
          var u = Object.assign({}, a, fields);
          delete u.__row;
          cUpdate_(ctx, u);
          writes.push({ sheet: 'Abnormals', mode: 'update', row: u });
          abn.push(u);
        } else {
          var n = cNew_(ctx, Object.assign({ abnormal_id: uuid_(), reported_by: row.checked_by, reported_at: isoVN_(now_()), status: 'OPEN', resolution_vi: '', resolution_zh: '', resolved_by: '', resolved_at: '' }, fields));
          writes.push({ sheet: 'Abnormals', mode: 'insert', row: n });
          abn.push(n);
        }
      });
      Object.keys(openByKey).forEach(function (k) {
        var x = Object.assign({}, openByKey[k], { status: 'CANCELLED' });
        delete x.__row;
        cUpdate_(ctx, x);
        writes.push({ sheet: 'Abnormals', mode: 'update', row: x });
      });
      return {
        writes: writes,
        result: { run: projectRow_(ctx, row), abnormals: abn.map(function (a) { return projectRow_(ctx, a); }), record_version: row.record_version },
        record_version: row.record_version,
        audit: {
          entity_type: 'RUN', entity_id: p.run_id, before_json: now ? { fail_count: now.fail_count, status: now.status } : null,
          after_json: { machine_id: asg.machine_id, period_key: periodKey, status: row.status, fail_count: row.fail_count, warn_count: row.warn_count }
        }
      };
    }
  });
}

/** Dữ liệu một tháng của một máy (dòng gốc): lượt kiểm, bất thường, lý do bỏ sót, xác nhận ngày, gán mẫu, mẫu */
function monthData_(machineId, ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) throw validationError_([fieldError_('ym', 'INVALID_VALUE')]);
  var mac = findOne_('Machines', 'machine_id', machineId);
  if (!mac) throw apiError_('NOT_FOUND');
  var inMonth = function (r) { return String(r.work_date || '').slice(0, 7) === ym && !r.archived_at; };
  var runs = readRowsByNums_('Runs', findRowNums_('Runs', 'machine_id', mac.machine_id)).filter(inMonth);
  var abn = readRowsByNums_('Abnormals', findRowNums_('Abnormals', 'machine_id', mac.machine_id)).filter(function (a) { return inMonth(a) && a.status !== 'CANCELLED'; });
  var missed = readRowsByNums_('MissedReasons', findRowNums_('MissedReasons', 'machine_id', mac.machine_id)).filter(inMonth);
  var confirms = readRows_('DayConfirms').filter(function (c) { return inMonth(c) && (c.area_id === '*' || c.area_id === mac.area_id); });
  var asg = findAll_('Assignments', 'machine_id', mac.machine_id).filter(function (a) { return !a.archived_at; });
  var tplIds = {};
  asg.forEach(function (a) { tplIds[a.template_id] = true; });
  runs.forEach(function (r) { tplIds[r.template_id] = true; });
  var templates = readRows_('Templates').filter(function (t) { return tplIds[t.template_id]; });
  var area = mac.area_id ? findOne_('Areas', 'area_id', mac.area_id) : null;
  return { machine: mac, area: area, ym: ym, runs: runs, abnormals: abn, missed: missed, confirms: confirms, assignments: asg, templates: templates };
}

/** check.month {machine_id, ym} — lượt kiểm, bất thường, lý do bỏ sót, xác nhận ngày của một máy trong một tháng */
function checkMonth_(ctx) {
  var p = ctx.req.payload || {};
  var md = monthData_(p.machine_id, trimStr_(p.ym));
  var pr = function (list) { return list.map(function (r) { return projectRow_(ctx, r); }); };
  return {
    machine: projectRow_(ctx, md.machine), area: md.area ? projectRow_(ctx, md.area) : null, ym: md.ym, runs: pr(md.runs), abnormals: pr(md.abnormals),
    missed: pr(md.missed), confirms: pr(md.confirms), assignments: pr(md.assignments), templates: pr(md.templates)
  };
}

// ===== 19_review.js =====
/* 19_review: việc của Trưởng bộ phận — xử lý mục Không đạt, ghi lý do máy bỏ sót, xác nhận ngày (khóa sửa lượt kiểm ngày đó) */

/** abnormal.resolve {abnormal_id, resolution_vi|resolution_zh} — đánh dấu Đã xử lý kèm cách xử lý */
function abnormalResolve_(ctx) {
  var p = ctx.req.payload || {};
  var cur = isUuidV4_(p.abnormal_id) ? findOne_('Abnormals', 'abnormal_id', p.abnormal_id) : null;
  if (!cur) throw apiError_('NOT_FOUND');
  var errs = [];
  requireOneLang_(errs, p, null, 'resolution');
  if (errs.length) throw validationError_(errs);
  var tr = applyTranslations_('Abnormals', ['resolution'], p, cur);
  return executeWrite_(ctx, {
    entity_type: 'ABNORMAL', entity_id: p.abnormal_id,
    build: function () {
      var now = findOne_('Abnormals', 'abnormal_id', p.abnormal_id);
      assertVersion_(ctx, now, 'ABNORMAL', 'Abnormals');
      if (now.status !== 'OPEN') throw validationError_([fieldError_('status', 'STATUS_INVALID')]);
      var row = Object.assign({}, now, tr.values, { status: 'RESOLVED', resolved_by: ctx.user.user_id, resolved_at: isoVN_(now_()), i18n_meta: tr.meta });
      delete row.__row;
      cUpdate_(ctx, row);
      return {
        writes: [{ sheet: 'Abnormals', mode: 'update', row: row }],
        result: { abnormal: projectRow_(ctx, row), record_version: row.record_version }, record_version: row.record_version,
        audit: { entity_type: 'ABNORMAL', entity_id: p.abnormal_id, before_json: { status: 'OPEN' }, after_json: { status: 'RESOLVED', resolution_vi: row.resolution_vi } }
      };
    }
  });
}

/** missed.reason {missed_id, assignment_id, work_date, shift, reason_vi|reason_zh} — lý do máy bỏ sót một kỳ */
function missedReason_(ctx) {
  var p = ctx.req.payload || {};
  if (!isUuidV4_(p.missed_id)) throw validationError_([fieldError_('missed_id', 'ID_INVALID')]);
  var cur = findOne_('MissedReasons', 'missed_id', p.missed_id);
  var asg = findOne_('Assignments', 'assignment_id', cur ? cur.assignment_id : p.assignment_id);
  if (!asg) throw validationError_([fieldError_('assignment_id', 'NOT_ASSIGNED')]);
  var tpl = findOne_('Templates', 'template_id', asg.template_id);
  var wd = cur ? cur.work_date : trimStr_(p.work_date);
  var shift = cur ? String(cur.shift || '') : (tpl.frequency === 'SHIFT' ? trimStr_(p.shift) : '');
  var errs = [];
  requireOneLang_(errs, p, null, 'reason');
  if (!isDateStr_(wd) || wd > todayVN_()) errs.push(fieldError_('work_date', 'PERIOD_INVALID'));
  if (tpl.frequency === 'SHIFT' && String(tpl.shifts || '').split(',').indexOf(shift) < 0) errs.push(fieldError_('shift', 'PERIOD_INVALID'));
  if (errs.length) throw validationError_(errs);
  var periodKey = periodKey_(tpl.frequency, wd, shift);
  var tr = applyTranslations_('MissedReasons', ['reason'], p, cur);
  return executeWrite_(ctx, {
    entity_type: 'MISSED', entity_id: p.missed_id,
    build: function () {
      var now = findOne_('MissedReasons', 'missed_id', p.missed_id);
      if (now) assertVersion_(ctx, now, 'MISSED', 'MissedReasons');
      else {
        var hasRun = findAll_('Runs', 'assignment_id', asg.assignment_id).some(function (r) { return r.period_key === periodKey && !r.archived_at; });
        if (hasRun) throw validationError_([fieldError_('period_key', 'STATUS_INVALID')]);
      }
      var row = Object.assign({}, now || {}, tr.values, {
        missed_id: p.missed_id, assignment_id: asg.assignment_id, machine_id: asg.machine_id, template_id: asg.template_id,
        period_key: periodKey, work_date: wd, shift: shift, recorded_by: ctx.user.user_id, recorded_at: isoVN_(now_()), i18n_meta: tr.meta
      });
      delete row.__row;
      if (now) cUpdate_(ctx, row); else cNew_(ctx, row);
      return {
        writes: [{ sheet: 'MissedReasons', mode: now ? 'update' : 'insert', row: row }],
        result: { missed: projectRow_(ctx, row), record_version: row.record_version }, record_version: row.record_version,
        audit: { entity_type: 'MISSED', entity_id: p.missed_id, before_json: null, after_json: { period_key: periodKey, machine_id: asg.machine_id, reason_vi: row.reason_vi } }
      };
    }
  });
}

/**
 * day.confirm {work_date, area_ids?} (nhập lại PIN) — Trưởng bộ phận xác nhận ngày cho khu vực mình phụ trách.
 * Người không gán khu vực xác nhận cho mọi khu vực (area_id = '*'). Ngày đã xác nhận: lượt kiểm ngày đó khóa sửa.
 */
function dayConfirm_(ctx) {
  var p = ctx.req.payload || {};
  var wd = trimStr_(p.work_date);
  if (!isDateStr_(wd)) throw validationError_([fieldError_('work_date', 'INVALID_DATE')]);
  if (wd > todayVN_()) throw validationError_([fieldError_('work_date', 'FUTURE_DATE')]);
  var mine = userAreas_(ctx.user);
  var want = Array.isArray(p.area_ids) && p.area_ids.length ? p.area_ids.map(String) : (mine.length ? mine : ['*']);
  if (mine.length && want.some(function (a) { return mine.indexOf(a) < 0; })) throw apiError_('FORBIDDEN');
  return executeWrite_(ctx, {
    entity_type: 'DAY', entity_id: wd,
    build: function () {
      var have = findAll_('DayConfirms', 'work_date', wd).filter(function (c) { return !c.archived_at; });
      var todo = want.filter(function (a) { return !have.some(function (c) { return c.area_id === a || c.area_id === '*'; }); });
      if (!todo.length) throw validationError_([fieldError_('work_date', 'ALREADY_CONFIRMED')]);
      var macArea = {};
      readRows_('Machines').forEach(function (m) { macArea[m.machine_id] = m.area_id; });
      var runs = findAll_('Runs', 'work_date', wd).filter(function (r) { return !r.archived_at; });
      var writes = todo.map(function (a) {
        var rs = runs.filter(function (r) { return a === '*' || macArea[r.machine_id] === a; });
        var summary = {
          runs: rs.length, done: rs.filter(function (r) { return r.status === 'DONE'; }).length,
          fail_items: rs.reduce(function (s, r) { return s + (r.fail_count || 0); }, 0),
          warn_items: rs.reduce(function (s, r) { return s + (r.warn_count || 0); }, 0)
        };
        return { sheet: 'DayConfirms', mode: 'insert', row: cNew_(ctx, { confirm_id: uuid_(), work_date: wd, area_id: a, confirmed_by: ctx.user.user_id, confirmed_at: isoVN_(now_()), summary_json: summary }) };
      });
      return {
        writes: writes,
        result: { confirms: writes.map(function (w) { return projectRow_(ctx, w.row); }) },
        audit: { entity_type: 'DAY', entity_id: wd, before_json: null, after_json: { areas: todo } }
      };
    }
  });
}

// ===== 20_users.js =====
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

// ===== 21_i18n.js =====
/* 21_i18n: từ điển thuật ngữ khi dịch, gợi ý dịch, dịch bù (lấy từ M&E).
 * Thuật ngữ chỉ dùng dòng active có approved_by; cả chuỗi trùng → GLOSSARY; chứa thuật ngữ → token ⟦n⟧ rồi dịch. */

/** Thuật ngữ đã duyệt, cache 600 giây (3.9) */
function glossaryTerms_() {
  if (DB_.glossary) return DB_.glossary;
  var c = cache_().get('glossary:approved');
  var list;
  if (c) {
    list = JSON.parse(c);
  } else {
    list = readRows_('Glossary').filter(function (g) {
      return g.active && g.approved_by && !g.archived_at && trimStr_(g.term_vi) && trimStr_(g.term_zh);
    }).map(function (g) { return { vi: trimStr_(g.term_vi), zh: trimStr_(g.term_zh) }; });
    try { cache_().put('glossary:approved', JSON.stringify(list), 600); } catch (e) { /* quá cỡ: đọc lại lần sau */ }
  }
  DB_.glossary = list;
  return list;
}

function normTerm_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function escapeRe_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cả chuỗi trùng một thuật ngữ: trả bản đích, không thì null */
function glossaryExact_(text, src, tgt) {
  var n = normTerm_(text);
  if (!n) return null;
  var terms = glossaryTerms_();
  for (var i = 0; i < terms.length; i++) if (normTerm_(terms[i][src]) === n) return terms[i][tgt];
  return null;
}

/** Mã hiển thị, model/serial dạng mã, số kèm đơn vị: giữ nguyên qua token */
var KEEP_RE_ = /\b[A-Z]{1,6}-[0-9A-Z]{2,}(?:-[0-9A-Z]+)*\b|\d+(?:[.,]\d+)?\s?(?:kVA|kWh|kW|kg\/h|t\/h|m³\/h|m3\/h|MPa|bar|°C|Hz|mm\/s|mm|kg|dB|rpm|MΩ|V|A)(?![A-Za-z])/g;

/**
 * Dịch có thuật ngữ (2.3 quy tắc 4). Trả {text, state: 'GLOSSARY'|'MACHINE'} hoặc null khi dịch lỗi.
 * Người gọi kiểm mtEnabled_ trước khi cần dịch máy.
 */
function translateText_(text, src, tgt) {
  var exact = glossaryExact_(text, src, tgt);
  if (exact) return { text: exact, state: 'GLOSSARY' };
  var tokens = [];
  var put = function (v) { tokens.push(v); return '⟦' + (tokens.length - 1) + '⟧'; };
  var work = String(text);
  glossaryTerms_().filter(function (t) { return t[src]; })
    .sort(function (a, b) { return b[src].length - a[src].length; })
    .forEach(function (t) {
      work = work.replace(new RegExp(escapeRe_(t[src]), 'gi'), function () { return put(t[tgt]); });
    });
  work = work.replace(KEEP_RE_, function (m) { return put(m); });
  var out = mtTranslate_(work, src, tgt);
  if (!out) return null;
  // Máy dịch hay thêm "。"/"." cuối câu cho nhãn ngắn ("Kiểm tra dầu" → "检查机油。"): nguồn không có thì bỏ
  if (!/[.。!?！？…]\s*$/.test(String(text))) out = String(out).replace(/\s*[。.]\s*$/, '');
  if (!tokens.length) return { text: out, state: 'MACHINE' };
  // Thiếu hoặc thừa token → coi như dịch lỗi
  var seen = {};
  var bad = false;
  var res = out.replace(/⟦\s*(\d+)\s*⟧/g, function (m, d) {
    var i = Number(d);
    if (i >= tokens.length || seen[i]) { bad = true; return m; }
    seen[i] = true;
    return tokens[i];
  });
  if (bad || Object.keys(seen).length !== tokens.length) return null;
  return { text: res, state: 'MACHINE' };
}

/** Bảng có dịch máy (dịch bù) — trường gốc */
var MT_SHEETS_ = {
  LibraryItems: ['name', 'std_text', 'how'], Templates: ['name', 'note'], TemplateItems: ['name', 'std_text', 'how'],
  Abnormals: ['resolution'], MissedReasons: ['reason']
};

/**
 * Dịch một trường PENDING của một dòng và ghi (không tăng record_version, 2.3 quy tắc 8).
 * Gọi ngoài khóa ghi; ghi dưới khóa sau khi so lại bản gốc. Trả true nếu đã ghi.
 */
function fillPendingField_(sheet, r, f, actorId, opId) {
  var m = r.i18n_meta && r.i18n_meta[f];
  if (!m || m.state !== 'PENDING') return false;
  var tgt = m.src === 'vi' ? 'zh' : 'vi';
  var srcText = trimStr_(r[f + '_' + m.src]);
  if (!srcText) return false;
  var tr = translateText_(srcText, m.src, tgt);
  if (!tr) return false;
  var key = sheetSchema_(sheet).key;
  return withWriteLock_(function () {
    var rn = findRowNums_(sheet, key, r[key])[0];
    if (!rn) return false;
    var cur = readRowAt_(sheet, rn);
    if (trimStr_(cur[f + '_' + m.src]) !== srcText) return false;
    var meta = cur.i18n_meta || {};
    if (!meta[f] || meta[f].state !== 'PENDING') return false;
    meta[f] = { src: m.src, state: tr.state, at: isoVN_(now_()) };
    var st = readState_();
    var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
    var upd = { i18n_meta: meta };
    if (sheetSchema_(sheet).cols.indexOf('sync_revision') >= 0) upd.sync_revision = rev;
    upd[f + '_' + tgt] = tr.text;
    writeCells_(sheet, rn, upd);
    var su = { sync_revision: ['INT', rev] };
    su['table_rev.' + sheet] = ['INT', rev];
    stateWrite_(st, su, actorId);
    writeAudit_({ user_id: actorId, action: 'i18n.machineTranslate', entity_type: sheet, entity_id: r[key], before_json: null, after_json: { field: f, state: tr.state }, operation_id: opId || '', auth_basis: actorId === SYSTEM_USER ? 'SYSTEM' : 'ROLE_LEVEL' });
    return true;
  });
}

/** Mỗi 3 giờ: dịch bù trường PENDING; dịch bù không tăng record_version */
function runBackgroundJobs() {
  if (prop_('MAINTENANCE_MODE') === 'true') return;
  var t0 = Date.now();
  dbReset_();
  if (!mtEnabled_()) { recordTriggerRun_('runBackgroundJobs', t0); return; }
  var done = 0;
  Object.keys(MT_SHEETS_).forEach(function (sheet) {
    if (Date.now() - t0 > 150000) return;
    readRows_(sheet).forEach(function (r) {
      if (Date.now() - t0 > 150000 || !r.i18n_meta || !mtEnabled_()) return;
      MT_SHEETS_[sheet].forEach(function (f) {
        if (fillPendingField_(sheet, r, f, SYSTEM_USER)) done++;
      });
    });
  });
  recordTriggerRun_('runBackgroundJobs', t0);
  log_('runBackgroundJobs: dịch bù ' + done + ' trường.');
}

/* ---------------- Gợi ý dịch ---------------- */

/** i18n.suggest {text, from}: trả bản dịch gợi ý, không lưu gì (form mẫu, thư viện hạng mục) */
function i18nSuggest_(ctx) {
  var p = ctx.req.payload || {};
  var from = p.from === 'zh' ? 'zh' : 'vi', to = from === 'vi' ? 'zh' : 'vi';
  var text = trimStr_(p.text);
  if (!text) throw validationError_([fieldError_('text', 'REQUIRED')]);
  if (text.length > 2000) throw validationError_([fieldError_('text', 'INVALID_VALUE')]);
  if (!setting_('machine_translation_enabled')) throw apiError_('FEATURE_NOT_ENABLED');
  var tr = translateText_(text, from, to);
  if (!tr) throw apiError_('SERVER_BUSY');
  return { text: tr.text, from: from, to: to, state: tr.state };
}

// ===== 23_backup.js =====
/* 23_backup: sao lưu có kiểm chứng (hằng tuần + Sao lưu ngay), lấy từ M&E.
 * Bản sao ở thư mục Backups riêng tư: <yyyy-mm-dd_HHmm>/ gồm 2 spreadsheet + manifest.json.
 * ScriptProperties không nằm trong bản sao. Không chép ảnh. Khôi phục làm thủ công (hỏi người code). */

/** Sheet ghi không qua sync_revision (đăng nhập, phiên): không dùng để kiểm chứng số dòng */
var BACKUP_VOLATILE_ = { AuthAttempts: 1, Sessions: 1, AuditLogs: 1, Operations: 1 };

function backupRoot_() {
  var id = prop_('DRIVE_BACKUP_FOLDER_ID');
  if (!id) throw new Error('Chưa có DRIVE_BACKUP_FOLDER_ID');
  return DriveApp.getFolderById(id);
}

/** Số dòng dữ liệu (trừ tiêu đề) từng sheet đã biết của một spreadsheet */
function countRows_(ss, out) {
  ss.getSheets().forEach(function (sh) {
    if (SHEETS[sh.getName()]) out[sh.getName()] = Math.max(0, sh.getLastRow() - 1);
  });
  return out;
}

function backupStamp_(d) {
  var iso = isoVN_(d);
  return iso.slice(0, 10) + '_' + iso.slice(11, 13) + iso.slice(14, 16);
}

/** Đọc manifest.json của một thư mục sao lưu, null nếu không có/hỏng */
function readManifest_(folder) {
  var it = folder.getFilesByName('manifest.json');
  if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString()); } catch (e) { return null; }
}

/** Danh sách thư mục sao lưu, mới nhất trước: [{folder, name, manifest}] */
function listBackups_() {
  var out = [];
  var it = backupRoot_().getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (!/^\d{4}-\d{2}-\d{2}_\d{4}/.test(f.getName())) continue;
    out.push({ folder: f, name: f.getName(), manifest: readManifest_(f) });
  }
  out.sort(function (a, b) { return a.name < b.name ? 1 : a.name > b.name ? -1 : 0; });
  return out;
}

/** Trigger chạy một lần của backupData (Sao lưu ngay, chạy lại sau INCONSISTENT) */
function oneShotIds_() {
  try { return JSON.parse(prop_('BACKUP_ONESHOT_IDS') || '[]'); } catch (e) { return []; }
}
function scheduleBackupOnce_(afterMs) {
  var t = ScriptApp.newTrigger('backupData').timeBased().after(afterMs).create();
  var ids = oneShotIds_();
  ids.push(t.getUniqueId());
  setProp_('BACKUP_ONESHOT_IDS', JSON.stringify(ids));
  return t.getUniqueId();
}
function clearOneShotTriggers_() {
  var ids = oneShotIds_();
  if (!ids.length) return;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupData' && ids.indexOf(t.getUniqueId()) >= 0) ScriptApp.deleteTrigger(t);
  });
  setProp_('BACKUP_ONESHOT_IDS', '[]');
}

/**
 * Trigger hằng tuần và "Sao lưu ngay" (6.5.4). Chạy được cả khi bảo trì (thủ tục khôi phục bước 2).
 * VERIFIED: số dòng bản sao khớp và sync_revision không đổi; INCONSISTENT: có ghi trong lúc chép (chạy lại một lần sau 15 phút);
 * FAILED: lỗi hoặc số dòng lệch khi không có ghi.
 */
function backupData() {
  var t0 = Date.now();
  try { return backupDataRun_(); } finally { recordTriggerRun_('backupData', t0); }
}

function backupDataRun_() {
  clearOneShotTriggers_();
  var isRetry = prop_('BACKUP_RETRY_PENDING') === 'true';
  if (isRetry) delProp_('BACKUP_RETRY_PENDING');
  dbReset_();
  var started = now_();
  var stamp = backupStamp_(started);
  var root = backupRoot_();
  var folder = root.createFolder(stamp);
  // Mọi bước sau khi có thư mục đều trong try: lỗi gì cũng ghi được manifest FAILED kèm lý do
  var manifest = {
    app_id: APP_ID, created_at: isoVN_(started), folder: stamp, server_version: SERVER_VERSION, retry: isRetry,
    status: 'FAILED', consistent: false, counts: {}, copied_counts: {}, files: {}
  };
  try {
    var st0 = readState_();
    var rev0 = Number(stateGet_(st0, 'sync_revision', 0));
    var bizId = prop_('BUSINESS_SPREADSHEET_ID'), secId = prop_('SECURITY_SPREADSHEET_ID');
    manifest.env = envName_();
    manifest.schema_version = stateGet_(st0, 'schema_version', SCHEMA_VERSION);
    manifest.dataset_epoch = sysProps_().dataset_epoch;
    manifest.sync_revision = rev0;
    countRows_(SpreadsheetApp.openById(bizId), manifest.counts);
    countRows_(SpreadsheetApp.openById(secId), manifest.counts);
    manifest.documents = manifest.counts.Documents || 0;
    var bizCopy = DriveApp.getFileById(bizId).makeCopy(NAME_PREFIX + 'NghiepVu_' + stamp, folder);
    var secCopy = DriveApp.getFileById(secId).makeCopy(NAME_PREFIX + 'BaoMat_' + stamp, folder);
    manifest.files = { business: bizCopy.getId(), security: secCopy.getId() };
    countRows_(SpreadsheetApp.openById(bizCopy.getId()), manifest.copied_counts);
    countRows_(SpreadsheetApp.openById(secCopy.getId()), manifest.copied_counts);
    dbReset_();
    var rev1 = Number(stateGet_(readState_(), 'sync_revision', 0));
    manifest.sync_revision_end = rev1;
    var mismatch = Object.keys(manifest.counts).filter(function (k) {
      return !BACKUP_VOLATILE_[k] && manifest.counts[k] !== manifest.copied_counts[k];
    });
    manifest.mismatch = mismatch;
    if (rev1 !== rev0) manifest.status = 'INCONSISTENT';
    else manifest.status = mismatch.length ? 'FAILED' : 'VERIFIED';
    manifest.consistent = manifest.status === 'VERIFIED';
  } catch (e) {
    manifest.status = 'FAILED';
    manifest.error = String(e && e.message || e).slice(0, 200);
  }
  manifest.finished_at = isoVN_(now_());
  folder.createFile(Utilities.newBlob(JSON.stringify(manifest, null, 2), 'application/json', 'manifest.json'));
  withWriteLock_(function () {
    var st = readState_();
    stateWrite_(st, {
      last_backup_at: ['DATETIME', manifest.created_at], last_backup_ref: ['STRING', stamp], last_backup_status: ['ENUM', manifest.status]
    }, SYSTEM_USER);
  });
  cache_().remove('sys:state');
  if (manifest.status === 'INCONSISTENT' && !isRetry) {
    setProp_('BACKUP_RETRY_PENDING', 'true');
    scheduleBackupOnce_(15 * 60000);
  }
  var trashed = pruneBackups_();
  log_('backupData: ' + stamp + ' → ' + manifest.status + (trashed ? '; đã chuyển ' + trashed + ' bản cũ vào thùng rác' : '') + '.');
  return manifest;
}

/** Giữ backup_keep_count bản VERIFIED mới nhất; thư mục cũ hơn bản giữ cuối cùng vào thùng rác (chỉ trong Backups) */
function pruneBackups_() {
  var keep = Number(setting_('backup_keep_count') || 8);
  var list = listBackups_();
  var verified = list.filter(function (b) { return b.manifest && b.manifest.status === 'VERIFIED'; });
  if (verified.length <= keep) return 0;
  var cut = verified[keep - 1].name;
  var n = 0;
  list.forEach(function (b) {
    if (b.name >= cut) return;
    var it = b.folder.getFiles();
    while (it.hasNext()) it.next().setTrashed(true);
    b.folder.setTrashed(true);
    n++;
  });
  return n;
}

/* ---------------- Action ---------------- */

/** backup.view: danh sách bản, trạng thái kiểm chứng, lần gần nhất, đang chờ chạy (C4) */
/** Bản sao lưu mất bao lâu tối đa (thời hạn trigger 6 phút + dư) trước khi coi thư mục không manifest là thất bại */
var BACKUP_RUNNING_MS_ = 30 * 60000;

/** Thư mục chưa có manifest.json: đang chạy nếu tạo chưa quá 30 phút, quá thì thất bại (trigger bị dừng giữa chừng) */
function backupRunningRef_(b, nowMs) {
  if (b.manifest) return false;
  var n = b.name;
  var t = Date.parse(n.slice(0, 10) + 'T' + n.slice(11, 13) + ':' + n.slice(13, 15) + ':00+07:00');
  return !isNaN(t) && nowMs - t < BACKUP_RUNNING_MS_;
}

function backupView_(ctx) {
  var st = readState_();
  var nowMs = now_().getTime();
  var running = false;
  var items = listBackups_().slice(0, 30).map(function (b) {
    var m = b.manifest || {};
    var total = 0;
    Object.keys(m.counts || {}).forEach(function (k) { if (!BACKUP_VOLATILE_[k]) total += m.counts[k]; });
    var isRunning = backupRunningRef_(b, nowMs);
    if (isRunning) running = true;
    return {
      ref: b.name, created_at: m.created_at || '', finished_at: m.finished_at || '', status: isRunning ? 'RUNNING' : (m.status || 'FAILED'), consistent: !!m.consistent,
      schema_version: m.schema_version || '', rows: total, documents: m.documents || 0, retry: !!m.retry,
      error: m.error || (b.manifest || isRunning ? '' : 'NO_MANIFEST'), mismatch: m.mismatch || []
    };
  });
  return {
    items: items, queued: oneShotIds_().length > 0, running: running,
    last_backup_at: stateGet_(st, 'last_backup_at', ''), last_backup_ref: stateGet_(st, 'last_backup_ref', ''), last_backup_status: stateGet_(st, 'last_backup_status', ''),
    last_restore_at: stateGet_(st, 'last_restore_at', ''), restored_from_ref: stateGet_(st, 'restored_from_ref', ''),
    backup_weekday: setting_('backup_weekday'), backup_hour: setting_('backup_hour'), keep_count: setting_('backup_keep_count')
  };
}

/** backup.run: tạo trigger chạy một lần cho backupData, trả QUEUED (C4, PIN) */
function backupRun_(ctx) {
  if (oneShotIds_().length) return { status: 'QUEUED', already: true };
  var nowMs = now_().getTime();
  if (listBackups_().some(function (b) { return backupRunningRef_(b, nowMs); })) return { status: 'QUEUED', already: true };
  withWriteLock_(function () {
    scheduleBackupOnce_(1000);
    writeAudit_({ user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'backup.run', entity_type: 'BACKUP', entity_id: '',
      before_json: null, after_json: { status: 'QUEUED' }, operation_id: ctx.req.operation_id || '', auth_basis: authBasis_(ctx) });
  });
  return { status: 'QUEUED', already: false };
}


// ===== 24_system.js =====
/* 24_system: nhật ký thao tác, cấu hình, trạng thái hệ thống (lấy từ M&E, bỏ phần quyền theo module) */

/* ---------------- Nhật ký thao tác ---------------- */

function projectAudit_(ctx, a, dir) {
  var o = {
    audit_id: a.audit_id, occurred_at: a.occurred_at, user_id: a.user_id, action: a.action, entity_type: a.entity_type, entity_id: a.entity_id,
    before_json: a.before_json || null, after_json: a.after_json || null, reason: a.reason || '', operation_id: a.operation_id || '',
    auth_basis: a.auth_basis || ''
  };
  var u = dir[a.user_id];
  o.user_name = u ? u.employee_code + ' · ' + u.display_name : a.user_id;
  return o;
}

/** audit.own: nhật ký thao tác và trạng thái đồng bộ (Operations) của chính mình */
function auditOwn_(ctx) {
  var uid = ctx.user.user_id;
  var dir = userDirectory_();
  var logs = findAll_('AuditLogs', 'user_id', uid).sort(function (a, b) { return String(b.occurred_at).localeCompare(String(a.occurred_at)); })
    .slice(0, 200).map(function (a) { return projectAudit_(ctx, a, dir); });
  var ops = findAll_('Operations', 'user_id', uid).sort(function (a, b) { return String(b.received_at).localeCompare(String(a.received_at)); })
    .slice(0, 100).map(function (o) {
      return { operation_id: o.operation_id, action: o.action, entity_type: o.entity_type, entity_id: o.entity_id, state: o.state, result_code: o.result_code, received_at: o.received_at, committed_at: o.committed_at };
    });
  return { items: logs, operations: ops };
}

var ADMIN_ACTION_PREFIX_ = ['user.', 'auth.', 'session.', 'pin.', 'settings.', 'system.', 'backup.', 'me.', 'report.logo', 'sample.'];

/** audit.view {entity_id?, user_id?, action?, from?, to?, limit?}: Trưởng bộ phận, Quản trị (Trưởng bộ phận không xem thao tác quản trị) */
function auditView_(ctx) {
  var p = ctx.req.payload || {};
  var lvl = Number(ctx.user.role_level);
  var dir = userDirectory_();
  var limit = Math.min(500, Number(p.limit) || 200);
  var from = p.from && isDateStr_(p.from) ? p.from : '', to = p.to && isDateStr_(p.to) ? p.to : '';
  var items = [];
  var rows = readRows_('AuditLogs');
  for (var i = rows.length - 1; i >= 0 && items.length < limit; i--) {
    var a = rows[i];
    var act = String(a.action || '');
    if (lvl < 4 && ADMIN_ACTION_PREFIX_.some(function (x) { return act.indexOf(x) === 0; })) continue;
    if (p.entity_id && a.entity_id !== p.entity_id) continue;
    if (p.user_id && a.user_id !== p.user_id) continue;
    if (p.action && act.indexOf(p.action) !== 0) continue;
    var day = String(a.occurred_at).slice(0, 10);
    if (from && day < from) continue;
    if (to && day > to) continue;
    items.push(projectAudit_(ctx, a, dir));
  }
  items.sort(function (x, y) { return String(y.occurred_at).localeCompare(String(x.occurred_at)); });
  return { items: items, more: items.length >= limit };
}

/* ---------------- Cấu hình ---------------- */

/** Khóa không sửa trong màn Cấu hình (logo sửa ở màn riêng) */
var SETTINGS_READONLY_ = { report_logo_file_id: 1, report_logo_rev: 1 };
var SETTINGS_BOUNDS_ = {
  session_days: [1, 90], session_warn_days: [0, 30], change_pin_session_minutes: [5, 60], reauth_window_minutes: [1, 30], temp_pin_hours: [1, 168],
  max_sessions_per_user: [1, 50], login_fail_limit: [3, 20], login_fail_window_minutes: [1, 120], login_lock_minutes: [1, 1440],
  login_global_fail_limit: [5, 1000], login_global_window_minutes: [1, 120], login_global_pause_minutes: [1, 1440], auth_attempts_retention_days: [7, 3650],
  offline_unlock_attempts: [3, 20], offline_lock_minutes: [1, 1440], offline_max_lockouts: [1, 10], offline_pbkdf2_iterations: [150000, 2000000],
  offline_probe_seconds: [3, 30], mt_chunk_chars: [200, 5000], mt_max_fields_per_request: [1, 100], mt_sync_budget_seconds: [1, 20], mt_daily_budget: [0, 100000],
  client_timeout_seconds: [10, 60], client_long_timeout_seconds: [20, 300],
  sync_page_size: [100, 2000], doc_max_bytes: [1048576, 52428800], doc_mobile_upload_max_bytes: [1048576, 52428800],
  photo_max_edge_px: [640, 4096], photo_jpeg_quality: [0.5, 0.95], photo_thumb_edge_px: [120, 1024], backup_hour: [0, 23], backup_keep_count: [2, 52],
  runs_sync_days: [7, 120], missed_lookback_days: [1, 31], check_backdate_days: [0, 31]
};
var SETTINGS_ENUMS_ = {
  backup_weekday: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
};

function settingsList_() {
  var s = settings_();
  return SETTINGS_DEFAULTS.filter(function (d) { return d[4] <= RELEASED_DOT; }).map(function (d) {
    return {
      key: d[0], type: d[1], value: s[d[0]], default_value: d[2], client: !!d[3], description_vi: d[5], description_zh: d[6],
      readonly: !!SETTINGS_READONLY_[d[0]], bounds: SETTINGS_BOUNDS_[d[0]] || null, options: SETTINGS_ENUMS_[d[0]] || null
    };
  });
}

/** Chuẩn hóa và kiểm một giá trị Settings; ném VALIDATION_ERROR */
function parseSettingInput_(def, v) {
  var key = def[0], type = def[1];
  var bad = function () { return validationError_([fieldError_(key, key === 'shifts_json' ? 'SHIFTS_INVALID' : 'INVALID_VALUE')]); };
  if (type === 'INT' || type === 'NUMBER') {
    var n = Number(v);
    if (v === '' || v === null || !isFinite(n) || (type === 'INT' && Math.floor(n) !== n)) throw bad();
    var b = SETTINGS_BOUNDS_[key];
    if (b && (n < b[0] || n > b[1])) throw bad();
    return n;
  }
  if (type === 'BOOL') { if (typeof v !== 'boolean') throw bad(); return v; }
  if (type === 'ENUM') { if ((SETTINGS_ENUMS_[key] || []).indexOf(v) < 0) throw bad(); return v; }
  if (type === 'JSON') {
    var arr;
    try { arr = typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { throw bad(); }
    if (key === 'shifts_json') {
      if (!shiftsOk_(arr)) throw bad();
      return arr.map(function (s) { return { no: Number(s.no), start: String(s.start), end: String(s.end) }; });
    }
    if (!Array.isArray(arr)) throw bad();
    return arr;
  }
  var s = trimStr_(v);
  if (key === 'app_base_url' && s && !/^https:\/\/[^\s]+\/$/.test(s)) throw bad();
  if (key === 'min_client_version' && !/^\d+\.\d+\.\d+$/.test(s)) throw bad();
  if (s.length > 500) throw bad();
  return s;
}

function writeSetting_(key, value, by) {
  var def = SETTINGS_DEFAULTS.filter(function (d) { return d[0] === key; })[0];
  var cell = def[1] === 'JSON' ? JSON.stringify(value) : (def[1] === 'BOOL' ? (value ? 'true' : 'false') : String(value));
  var rn = findRowNums_('Settings', 'setting_key', key)[0];
  var nowIso = isoVN_(now_());
  if (rn) writeCells_('Settings', rn, { value: cell, updated_at: nowIso, updated_by: by });
  else insertRows_('Settings', [Object.assign(settingRow_(def), { value: cell, updated_by: by })]);
  // Cài đặt gửi xuống app nằm trong bootstrap: tăng mốc để app tải lại
  var st = readState_();
  var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
  stateWrite_(st, { sync_revision: ['INT', rev], 'table_rev.Settings': ['INT', rev], settings_rev: ['INT', rev] }, by);
  cache_().remove('cfg:settings');
  DB_.settings = null;
}

/** settings.edit {changes: {key: value}, reason} — Quản trị, PIN */
function settingsEdit_(ctx) {
  var p = ctx.req.payload || {};
  var changes = p.changes && typeof p.changes === 'object' ? p.changes : null;
  if (!changes || !Object.keys(changes).length) throw validationError_([fieldError_('changes', 'REQUIRED')]);
  var parsed = {};
  var errs = [];
  Object.keys(changes).forEach(function (k) {
    var def = SETTINGS_DEFAULTS.filter(function (d) { return d[0] === k; })[0];
    if (!def || def[4] > RELEASED_DOT || SETTINGS_READONLY_[k]) { errs.push(fieldError_(k, 'INVALID_VALUE')); return; }
    try { parsed[k] = parseSettingInput_(def, changes[k]); } catch (e) { errs.push(fieldError_(k, k === 'shifts_json' ? 'SHIFTS_INVALID' : 'INVALID_VALUE')); }
  });
  if (parsed.client_long_timeout_seconds !== undefined || parsed.client_timeout_seconds !== undefined) {
    var shortT = parsed.client_timeout_seconds !== undefined ? parsed.client_timeout_seconds : setting_('client_timeout_seconds');
    var longT = parsed.client_long_timeout_seconds !== undefined ? parsed.client_long_timeout_seconds : setting_('client_long_timeout_seconds');
    if (longT < shortT) errs.push(fieldError_('client_long_timeout_seconds', 'INVALID_VALUE'));
  }
  if (errs.length) throw validationError_(errs);
  var before = {};
  Object.keys(parsed).forEach(function (k) { before[k] = setting_(k); });
  withWriteLock_(function () {
    Object.keys(parsed).forEach(function (k) { writeSetting_(k, parsed[k], ctx.user.user_id); });
    writeAudit_({ user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'settings.edit', entity_type: 'SETTINGS', entity_id: Object.keys(parsed).join(','),
      before_json: before, after_json: parsed, operation_id: ctx.req.operation_id || '', reason: trimStr_(p.reason).slice(0, 300), auth_basis: authBasis_(ctx) });
  });
  cache_().remove('cfg:settings');
  DB_.settings = null;
  if (['backup_weekday', 'backup_hour'].some(function (k) { return parsed[k] !== undefined && parsed[k] !== before[k]; })) {
    try { installTriggers(); } catch (e) { console.warn('installTriggers ' + (e && e.message)); }
  }
  return { settings: settingsList_() };
}

/* ---------------- Trạng thái hệ thống (healthCheck) ---------------- */

/** Ghi thời gian chạy trigger (24 giờ gần nhất) để healthCheck báo tổng phút */
function recordTriggerRun_(fn, startMs) {
  try {
    var now = Date.now();
    var list = JSON.parse(prop_('TRIGGER_RUNS') || '[]').filter(function (r) { return now - r.s < 86400000; });
    list.push({ f: fn, s: startMs, ms: now - startMs });
    setProp_('TRIGGER_RUNS', JSON.stringify(list.slice(-80)));
  } catch (e) { /* không chặn trigger */ }
}

var TEMP_PROP_KEYS_ = ['SETUP_OWNER_CODE', 'SETUP_OWNER_NAME', 'SETUP_OWNER_TEMP_PIN', 'OWNER_RESET_TEMP_PIN'];
var TEST_PROP_KEYS_ = ['TEST_TODAY', 'TEST_SESSION_SECONDS', 'TEST_MT_FAIL'];

/** Kết quả kiểm tra: [{key, status: 'OK'|'WARN', value, note}] */
function healthRows_() {
  var rows = [];
  var add = function (key, ok, value, note) { rows.push({ key: key, status: ok ? 'OK' : 'WARN', value: value === undefined ? '' : value, note: note || '' }); };
  dbReset_();
  var st = readState_();
  var props = sysProps_();
  add('schema_version', String(stateGet_(st, 'schema_version', '')) === SCHEMA_VERSION, stateGet_(st, 'schema_version', ''), SCHEMA_VERSION);
  add('server_version', true, SERVER_VERSION);
  add('dataset_epoch', !!props.dataset_epoch, String(props.dataset_epoch || '').slice(0, 8));
  add('env', true, envName_());
  var leftover = TEMP_PROP_KEYS_.concat(isTestEnv_() ? [] : TEST_PROP_KEYS_).filter(function (k) { return prop_(k) !== null && prop_(k) !== ''; });
  add('temp_props', !leftover.length, leftover.join(', '), leftover.length ? 'Xóa ở Cài đặt dự án → Thuộc tính tập lệnh' : '');
  add('maintenance', !props.maintenance_mode, props.maintenance_mode ? 'ON' : 'OFF');
  var trig = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  var missing = TRIGGER_FUNCS_.filter(function (f) { return trig.indexOf(f) < 0; });
  add('triggers', !missing.length, trig.join(', '), missing.length ? 'Thiếu: ' + missing.join(', ') + ' — chạy installTriggers' : '');
  var runs = [];
  try { runs = JSON.parse(prop_('TRIGGER_RUNS') || '[]'); } catch (e) { runs = []; }
  var minutes = Math.round(runs.filter(function (r) { return Date.now() - r.s < 86400000; }).reduce(function (s, r) { return s + r.ms; }, 0) / 600) / 100;
  add('trigger_minutes_24h', minutes < 90, minutes);
  // Kết nối M&E: đã đặt link + mã, lần lấy gần nhất thành công và chưa quá 3 giờ
  var me = meLinkInfo_(st);
  var lst = parseTime_(me.last_sync_at);
  add('me_link', me.linked && me.last_sync_status === 'OK' && lst && now_().getTime() - lst.getTime() < 3 * 3600000,
    me.linked ? (me.last_sync_status || '—') + (me.last_sync_at ? ' · ' + String(me.last_sync_at).slice(0, 16).replace('T', ' ') : '') : 'NOT_LINKED',
    me.linked ? (me.last_sync_error || '') : 'Tài khoản → Quản trị → Kết nối M&E');
  var macs = readRows_('Machines');
  add('machines', macs.some(function (m) { return m.active; }), macs.filter(function (m) { return m.active; }).length + ' / ' + macs.length);
  var lb = stateGet_(st, 'last_backup_at', ''), lbs = stateGet_(st, 'last_backup_status', '');
  var lbt = parseTime_(lb);
  add('last_backup', lbs === 'VERIFIED' && lbt && now_().getTime() - lbt.getTime() < 8 * 86400000, (lb ? lb.slice(0, 16).replace('T', ' ') : '') + (lbs ? ' · ' + lbs : ''), stateGet_(st, 'last_backup_ref', ''));
  var mtp = parseTime_(stateGet_(st, 'mt_paused_until', ''));
  add('mt_paused_until', !(mtp && mtp.getTime() > now_().getTime()), stateGet_(st, 'mt_paused_until', ''));
  var lpu = parseTime_(stateGet_(st, 'login_paused_until', ''));
  add('login_paused_until', !(lpu && lpu.getTime() > now_().getTime()), stateGet_(st, 'login_paused_until', ''));
  var base = String(setting_('app_base_url') || '');
  add('app_base_url', !!base, base, base ? '' : 'Chưa điền app_base_url');
  add('report_logo', true, setting_('report_logo_rev') ? 'ON' : 'OFF');
  var cells = 0;
  [prop_('BUSINESS_SPREADSHEET_ID'), prop_('SECURITY_SPREADSHEET_ID')].forEach(function (id) {
    if (!id) return;
    SpreadsheetApp.openById(id).getSheets().forEach(function (s) { cells += s.getMaxRows() * s.getMaxColumns(); });
  });
  add('spreadsheet_cells', cells < 5000000, cells);
  return rows;
}

/** Chạy từ trình soạn: in kết quả kiểm tra */
function healthCheck() {
  var rows = healthRows_();
  rows.forEach(function (r) { log_((r.status === 'OK' ? 'ĐẠT     ' : 'CẢNH BÁO') + '  ' + r.key + ': ' + r.value + (r.note ? ' (' + r.note + ')' : '')); });
  return rows;
}

/** system.status (Quản trị): kết quả healthCheck + Settings + kết nối M&E */
function systemStatus_(ctx) {
  dbReset_();
  return { checks: healthRows_(), settings: settingsList_(), me_link: meLinkInfo_(readState_()), checked_at: isoVN_(now_()) };
}

// ===== 25_report.js =====
/* 25_report: logo công ty trên báo cáo và PDF bảng tháng của từng máy (bộ dựng PDF lấy từ M&E d4.11).
 * Logo công ty: tệp riêng tư trong thư mục dữ liệu app, Settings giữ ID tệp và mã phiên bản; Quản trị tải lên/gỡ trong app.
 * PDF dựng bằng Google Docs (khổ A4 ngang): đầu trang logo, tiêu đề hai thứ tiếng, thông tin máy, ô tóm tắt, bảng tháng
 * (hạng mục × ngày, ô Cần chú ý nền vàng, Không đạt nền đỏ, bỏ sót "–"), bất thường và cách xử lý, khối ký. */

function fmtDateVN_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

/** Nhãn hai thứ tiếng từ từ điển của app (i18n/labels.json chép vào Code.gs lúc build) */
function lab_(key, vars) {
  var p = LABELS[key] || [key, key];
  var vi = p[0], zh = p[1];
  if (vars) Object.keys(vars).forEach(function (k) { vi = vi.split('{' + k + '}').join(vars[k]); zh = zh.split('{' + k + '}').join(vars[k]); });
  return vi + ' · ' + zh;
}

var REPORT_LOGO_MAX_BYTES_ = 1048576;
var PDF_C_ = {
  navy: '#17324F', ink: '#1F2933', muted: '#5B6875', line: '#C9D3DF', head: '#E6ECF3', zebra: '#F7F9FC', tile: '#F1F5F9', white: '#FFFFFF',
  good: '#1E7B4A', bad: '#B42318', bar: '#2A78D6', elec: '#EB6834', water: '#2A78D6', elecLight: '#F6C1AA', waterLight: '#AFCBEF'
};
var PDF_STYLE_BUDGET_MS_ = 12000;
var PDF_LOGO_PX_H_ = 56;   // chiều cao logo đầu trang (Docs tính px ≈ 0,75 pt → khoảng 42 pt, 1,5 cm)
var PDF_MARGIN_ = 40;
var PDF_BAR_PT_ = 7;       // cỡ chữ của thanh; mỗi ký tự khối tính rộng tối đa 1 em (7 pt) để thanh dài nhất không tràn dòng dù phông thay thế rộng

/* ---------------- Logo báo cáo ---------------- */

/** Tệp logo đang dùng (Blob) hoặc null khi chưa có / tệp đã mất */
function reportLogoBlob_() {
  var id = setting_('report_logo_file_id');
  if (!id) return null;
  try {
    var f = DriveApp.getFileById(String(id));
    if (f.isTrashed()) return null;
    return f.getBlob();
  } catch (e) { return null; }
}

function reportLogoRev_() { return String(setting_('report_logo_rev') || ''); }

/** report.logo.get: logo cho bản xem trước và Excel trên máy ({rev: ''} khi chưa có) */
function reportLogoGet_(ctx) {
  var b = reportLogoBlob_();
  if (!b) return { rev: '' };
  return { rev: reportLogoRev_(), mime_type: b.getContentType(), content_b64: b64_(b.getBytes()) };
}

/**
 * report.logo.set {content_b64, mime_type: image/png | image/jpeg} hoặc {remove: true} — C4, PIN.
 * Ảnh ≤ 1 MB (app thu nhỏ trước khi gửi); cùng nội dung với logo đang dùng → trả luôn, không tạo tệp mới.
 */
function reportLogoSet_(ctx) {
  var p = ctx.req.payload || {};
  var by = ctx.user.user_id;
  var oldId = String(setting_('report_logo_file_id') || '');
  var before = { rev: reportLogoRev_() };
  var audit = function (after) {
    writeAudit_({ user_id: by, device_id: ctx.req.device_id, action: 'report.logo.set', entity_type: 'SETTINGS', entity_id: 'report_logo',
      before_json: before, after_json: after, operation_id: ctx.req.operation_id || '', auth_basis: authBasis_(ctx) });
  };
  if (p.remove === true) {
    withWriteLock_(function () {
      writeSetting_('report_logo_file_id', '', by);
      writeSetting_('report_logo_rev', '', by);
      audit({ rev: '' });
    });
    if (oldId) { try { trashQuietly_(DriveApp.getFileById(oldId)); } catch (e) { /* bỏ qua */ } }
    return { rev: '' };
  }
  var errs = [];
  if (p.mime_type !== 'image/png' && p.mime_type !== 'image/jpeg') errs.push(fieldError_('mime_type', 'FILE_TYPE'));
  if (typeof p.content_b64 !== 'string' || !p.content_b64) errs.push(fieldError_('content_b64', 'REQUIRED'));
  if (errs.length) throw validationError_(errs);
  var bytes;
  try { bytes = b64d_(p.content_b64); } catch (e) { throw validationError_([fieldError_('content_b64', 'INVALID_VALUE')]); }
  if (!bytes.length) throw validationError_([fieldError_('content_b64', 'REQUIRED')]);
  if (bytes.length > REPORT_LOGO_MAX_BYTES_) throw validationError_([fieldError_('content_b64', 'FILE_TOO_LARGE')]);
  if (!magicOk_(bytes, p.mime_type)) throw validationError_([fieldError_('mime_type', 'FILE_TYPE')]);
  var rev = b64url_(sha256_(bytes)).slice(0, 16);
  if (rev === before.rev && reportLogoBlob_()) return { rev: rev };
  var file = appFolder_().createFile(Utilities.newBlob(bytes, p.mime_type, 'report-logo.' + DOC_MIME_[p.mime_type].ext));
  try {
    withWriteLock_(function () {
      writeSetting_('report_logo_file_id', file.getId(), by);
      writeSetting_('report_logo_rev', rev, by);
      audit({ rev: rev, bytes: bytes.length, mime_type: p.mime_type });
    });
  } catch (e) {
    trashQuietly_(file);
    throw e;
  }
  if (oldId && oldId !== file.getId()) { try { trashQuietly_(DriveApp.getFileById(oldId)); } catch (e2) { /* bỏ qua */ } }
  return { rev: rev };
}

/* ---------------- Khung PDF dùng chung ---------------- */

function pdfAttrs_(o) {
  var A = DocumentApp.Attribute, out = {};
  Object.keys(o).forEach(function (k) { out[A[k]] = o[k]; });
  return out;
}

/** Chữ của cả phần tử: cỡ, màu, đậm, nghiêng (editAsText dùng được cho đoạn, ô, hàng, bảng) */
function pdfText_(el, size, color, bold, italic) {
  var t = el.editAsText();
  if (size) t.setFontSize(size);
  if (color) t.setForegroundColor(color);
  if (bold !== undefined && bold !== null) t.setBold(!!bold);
  if (italic !== undefined && italic !== null) t.setItalic(!!italic);
  return el;
}

function pdfPara_(p, o) {
  if (o.align) p.setAlignment(DocumentApp.HorizontalAlignment[o.align]);
  p.setSpacingBefore(o.before || 0);
  p.setSpacingAfter(o.after || 0);
  if (o.line) p.setLineSpacing(o.line);
  if (o.text !== undefined) pdfText_(p, o.size, o.color, o.bold, o.italic);
  return p;
}

/**
 * Tạo tài liệu tạm: khổ A4 (ngang khi `wide`), lề, đầu trang có logo (nếu có), chân trang một dòng.
 * Trả {doc, body, width (pt dùng được), t0, logo}.
 */
function pdfStart_(opts) {
  var doc = DocumentApp.create(NAME_PREFIX + 'TMP_' + uuid_());
  var body = doc.getBody();
  var pageW = opts.wide ? 842 : 595, pageH = opts.wide ? 595 : 842;
  body.setPageWidth(pageW);
  body.setPageHeight(pageH);
  var logo = opts.logo === undefined ? reportLogoBlob_() : opts.logo;
  body.setMarginLeft(PDF_MARGIN_).setMarginRight(PDF_MARGIN_).setMarginBottom(44).setMarginTop(logo ? 84 : 40);
  if (logo) {
    try {
      var hs = doc.addHeader();
      var hp = hs.getParagraphs()[0] || hs.appendParagraph('');
      pdfPara_(hp, { align: 'LEFT' });
      var img = hp.appendInlineImage(logo);
      var w0 = img.getWidth(), h0 = img.getHeight();
      var h = PDF_LOGO_PX_H_, w = w0 && h0 ? Math.round(h * w0 / h0) : h;
      if (w > 220) { w = 220; h = w0 && h0 ? Math.round(w * h0 / w0) : h; }
      img.setWidth(w).setHeight(h);
    } catch (e) { logo = null; body.setMarginTop(40); }
  }
  if (opts.footer) {
    var fs = doc.addFooter();
    var fp = fs.getParagraphs()[0] || fs.appendParagraph('');
    fp.setText(opts.footer);
    pdfPara_(fp, { align: 'CENTER', text: true, size: 7, color: PDF_C_.muted });
  }
  return { doc: doc, body: body, width: pageW - 2 * PDF_MARGIN_, t0: Date.now(), logo: !!logo };
}

/** Lưu, đổi sang PDF, bỏ tệp tạm vào thùng rác */
function pdfFinish_(pd) {
  var id = pd.doc.getId();
  try {
    pd.doc.saveAndClose();
    return DriveApp.getFileById(id).getAs('application/pdf').getBytes();
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* bỏ qua */ }
  }
}

function pdfTimeLeft_(pd) { return Date.now() - pd.t0 < PDF_STYLE_BUDGET_MS_; }

/** Khối tiêu đề: dòng Việt to, dòng Trung dưới, căn giữa (dùng đoạn trống đầu thân tài liệu) */
function pdfTitle_(pd, vi, zh) {
  var p0 = pd.body.getParagraphs()[0];
  p0.setText(vi || zh || '');
  pdfPara_(p0, { align: 'CENTER', after: zh && vi ? 2 : 10, text: true, size: 16, color: PDF_C_.navy, bold: true });
  if (zh && vi) pdfPara_(pd.body.appendParagraph(zh), { align: 'CENTER', after: 10, text: true, size: 12, color: PDF_C_.navy, bold: true });
}

function pdfHeading_(pd, text, before) {
  return pdfPara_(pd.body.appendParagraph(text), { before: before === undefined ? 12 : before, after: 4, text: true, size: 10, color: PDF_C_.navy, bold: true });
}

function pdfNote_(pd, text) {
  return pdfPara_(pd.body.appendParagraph(text), { before: 2, text: true, size: 8, color: PDF_C_.muted, italic: true });
}

/** Bảng không viền, đệm ô nhỏ */
function pdfPlain_(t) {
  t.setBorderWidth(0);
  return t;
}

function pdfCellPad_(c, v, h) {
  c.setPaddingTop(v).setPaddingBottom(v).setPaddingLeft(h).setPaddingRight(h);
  return c;
}

/** Căn mọi đoạn trong ô */
function pdfCellAlign_(c, align) {
  var A = DocumentApp.HorizontalAlignment[align];
  for (var i = 0; i < c.getNumChildren(); i++) {
    var ch = c.getChild(i);
    if (ch.getType() === DocumentApp.ElementType.PARAGRAPH) ch.asParagraph().setAlignment(A);
  }
}

/** Thông tin hai cột: trái (kỳ, khu vực, lọc), phải (số báo cáo, ngày lập, người lập — căn phải). lines = [[nhãn, giá trị]] */
function pdfMeta_(pd, left, right) {
  var fmt = function (l) { return l[1] ? l[0] + ': ' + l[1] : l[0]; };
  var t = pdfPlain_(pd.body.appendTable([[left.map(fmt).join('\n'), right.map(fmt).join('\n')]]));
  t.setColumnWidth(0, Math.round(pd.width * 0.56)).setColumnWidth(1, pd.width - Math.round(pd.width * 0.56));
  pdfText_(t, 9, PDF_C_.ink);
  var r = t.getRow(0);
  pdfCellPad_(r.getCell(0), 2, 0);
  pdfCellPad_(r.getCell(1), 2, 0);
  pdfCellAlign_(r.getCell(1), 'RIGHT');
  return t;
}

/** Ô số tóm tắt: tối đa 4 ô một hàng; mỗi ô nhãn nhỏ xám + số đậm. items = [{label, value}] */
function pdfTiles_(pd, items) {
  if (!items.length) return null;
  var per = 4; // cố định 4 cột: ít ô thì ô vẫn cỡ vừa, phần còn lại trống (không nền)
  var rows = [];
  for (var i = 0; i < items.length; i += per) {
    var row = [];
    for (var j = 0; j < per; j++) row.push('');
    rows.push(row);
  }
  var t = pd.body.appendTable(rows);
  t.setBorderWidth(3).setBorderColor(PDF_C_.white);
  var w = Math.floor(pd.width / per);
  for (var k = 0; k < per; k++) t.setColumnWidth(k, w);
  items.forEach(function (it, n) {
    var c = t.getCell(Math.floor(n / per), n % per);
    c.setBackgroundColor(PDF_C_.tile);
    pdfCellPad_(c, 5, 7);
    var p0 = c.getChild(0).asParagraph();
    p0.setText(it.label);
    pdfText_(p0, 8, PDF_C_.muted, false);
    var p1 = c.appendParagraph(it.value);
    pdfPara_(p1, { before: 2, text: true, size: it.value.length > 18 ? 10 : 13, color: PDF_C_.navy, bold: true });
    if (it.note) pdfPara_(c.appendParagraph(it.note), { text: true, size: 7, color: PDF_C_.muted, bold: false });
  });
  return t;
}

/**
 * Biểu đồ thanh ngang bằng ký tự khối (chữ của tài liệu, in nét): [nhãn | thanh | số]. Một chuỗi → một màu, không chú giải;
 * số ghi bằng màu chữ thường. items = [{label, value (null = không vẽ), text (chữ ở cột số), light (thanh nhạt: thiếu một phần)}]
 */
function pdfBars_(pd, title, items, color, lightColor) {
  if (!items.length) return;
  pdfHeading_(pd, title, 10);
  var max = 0;
  items.forEach(function (it) { if (it.value !== null && it.value > max) max = it.value; });
  var wl = Math.round(pd.width * 0.3), wv = Math.round(pd.width * 0.2), wb = pd.width - wl - wv;
  var maxChars = Math.max(10, Math.min(60, Math.floor((wb - 8) / PDF_BAR_PT_)));
  var cells = items.map(function (it) {
    var n = it.value === null || !(max > 0) ? 0 : Math.max(it.value > 0 ? 1 : 0, Math.round(it.value / max * maxChars));
    return [it.label, n ? new Array(n + 1).join('\u2588') : '', it.text];
  });
  var t = pdfPlain_(pd.body.appendTable(cells));
  t.setColumnWidth(0, wl).setColumnWidth(1, wb).setColumnWidth(2, wv);
  pdfText_(t, 8, PDF_C_.ink);
  items.forEach(function (it, i) {
    var r = t.getRow(i);
    for (var c = 0; c < 3; c++) pdfCellPad_(r.getCell(c), 1, 2);
    var bar = r.getCell(1);
    if (bar.getText()) pdfText_(bar, PDF_BAR_PT_, it.light ? lightColor || color : color);
    if (it.value === null) pdfText_(r.getCell(2), 8, PDF_C_.muted, false, true);
  });
}

/**
 * Độ rộng cột (pt) theo nội dung: ước lượng số ký tự (dòng dài nhất trong ô, lấy mức 90 % các dòng để một ô quá dài không chiếm hết),
 * cột số/ngày hẹp, cột chữ có trần; thiếu chỗ thì co theo tỷ lệ nhưng không nhỏ hơn 26 pt; thừa chỗ thì giãn cho kín khổ.
 */
function pdfColWidths_(head, rows, types, avail, fixed0) {
  var n = head.length;
  var longest = function (s) { return String(s || '').split('\n').reduce(function (m, x) { return Math.max(m, x.length); }, 0); };
  var ideal = [];
  for (var c = 0; c < n; c++) {
    if (fixed0 && c === 0) { ideal.push(fixed0); continue; }
    var lens = rows.map(function (r) { return longest(r[c]); }).sort(function (a, b) { return a - b; });
    var p90 = lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))] : 0;
    var hl = longest(head[c]);
    var ty = types[c] || 'text';
    var cap = ty === 'num' || ty === 'money' || ty === 'date' ? 16 : (ty === 'time' ? 16 : (ty === 'code' ? 18 : 42));
    var chars = Math.min(cap, Math.max(p90, Math.min(hl, cap), ty === 'num' ? 4 : (ty === 'code' ? 7 : 6)));
    ideal.push(chars * 5 + 12); // ~5 pt mỗi ký tự ở cỡ 7–8, đệm ô 2 × 5 pt + 2
  }
  var free = avail - (fixed0 || 0);
  var flex = ideal.slice(fixed0 ? 1 : 0);
  var sum = flex.reduce(function (a, b) { return a + b; }, 0);
  var out = flex.map(function (w) { return w * free / sum; });
  if (sum > free) {
    // Co: cột nhỏ hơn 26 pt nâng lên 26, phần thiếu trừ đều vào các cột còn lại theo tỷ lệ
    for (var k = 0; k < 4; k++) {
      var under = 0, rest = 0;
      out.forEach(function (w) { if (w < 26) under += 26 - w; else rest += w; });
      if (!under) break;
      if (!(rest > 0)) break;
      out = out.map(function (w) { return w < 26 ? 26 : w - under * w / rest; });
    }
  }
  out = out.map(function (w) { return Math.floor(w); });
  return fixed0 ? [fixed0].concat(out) : out;
}

/**
 * Bảng dữ liệu có định dạng: tiêu đề nền xám nhạt chữ đậm, viền mảnh, cột # (khi `numbered`), số/tiền căn phải, ngày căn giữa,
 * hàng xen kẽ (≤ 300 dòng). types[i]: num | money | date | time | code | text. cellColor(r, c) → màu chữ riêng của ô (vd Đạt/Không đạt).
 */
function pdfTable_(pd, head, rows, types, opts) {
  opts = opts || {};
  var numbered = !!opts.numbered;
  var h = numbered ? ['#'].concat(head) : head.slice();
  var ty = numbered ? ['num'].concat(types) : types.slice();
  var data = rows.map(function (r, i) { return numbered ? [String(i + 1)].concat(r) : r; });
  if (!data.length) data = [h.map(function (x, i) { return i === (numbered ? 1 : 0) ? (opts.empty || lab_('field.no_records')) : ''; })];
  var t = pd.body.appendTable([h].concat(data));
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var widths = pdfColWidths_(h, data, ty, pd.width, numbered ? 24 : 0);
  widths.forEach(function (w, i) { t.setColumnWidth(i, w); });
  var fs = opts.fontSize || (h.length > 9 ? 7 : 8);
  pdfText_(t, fs, PDF_C_.ink);
  var hr = t.getRow(0);
  pdfText_(hr, fs, PDF_C_.navy, true);
  for (var c = 0; c < h.length; c++) {
    var hc = hr.getCell(c);
    hc.setBackgroundColor(PDF_C_.head);
    hc.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    if (ty[c] === 'num' || ty[c] === 'money') pdfCellAlign_(hc, 'RIGHT');
    else if (ty[c] === 'date') pdfCellAlign_(hc, 'CENTER');
  }
  if (!rows.length) { pdfText_(t.getRow(1), fs, PDF_C_.muted, false, true); return t; }
  var zebra = data.length <= 300;
  var alignCols = [];
  ty.forEach(function (x, i) { if (x === 'num' || x === 'money') alignCols.push([i, 'RIGHT']); else if (x === 'date') alignCols.push([i, 'CENTER']); });
  for (var r = 1; r <= data.length; r++) {
    if (!pdfTimeLeft_(pd)) break;
    var row = t.getRow(r);
    if (numbered) pdfText_(row.getCell(0), fs, PDF_C_.muted);
    if (zebra && r % 2 === 0) for (var z = 0; z < h.length; z++) row.getCell(z).setBackgroundColor(PDF_C_.zebra);
    for (var a = 0; a < alignCols.length; a++) {
      var cell = row.getCell(alignCols[a][0]);
      if (cell.getNumChildren()) cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment[alignCols[a][1]]);
    }
    if (opts.cellColor) {
      for (var cc = numbered ? 1 : 0; cc < h.length; cc++) {
        var col = opts.cellColor(r - 1, numbered ? cc - 1 : cc);
        if (col) pdfText_(row.getCell(cc), fs, col, true);
      }
    }
  }
  return t;
}

/** Bảng nhãn – giá trị (hồ sơ, phiếu): cột nhãn nền nhạt */
function pdfKv_(pd, kv) {
  var data = kv.length ? kv : [[lab_('field.no_records'), '']];
  var t = pd.body.appendTable(data);
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var wl = Math.round(pd.width * 0.32);
  t.setColumnWidth(0, wl).setColumnWidth(1, pd.width - wl);
  pdfText_(t, 9, PDF_C_.ink);
  for (var i = 0; i < data.length; i++) {
    if (!pdfTimeLeft_(pd)) break;
    var c = t.getRow(i).getCell(0);
    c.setBackgroundColor(PDF_C_.tile);
    pdfText_(c, 8, PDF_C_.muted, true);
  }
  return t;
}

/** Khối ký: Người lập (có tên người tạo khi biết) · Trưởng bộ phận; dòng hướng dẫn ký, khoảng trống để ký */
function pdfSign_(pd, preparedName) {
  var spacer = pd.body.appendParagraph('');
  pdfPara_(spacer, { before: 14 });
  var hint = lab_('rpt.sign_hint');
  var t = pdfPlain_(pd.body.appendTable([
    [lab_('rpt.prepared_by'), lab_('rpt.approved_by')],
    [hint, hint],
    ['\n\n\n', '\n\n\n'],
    [preparedName || '', '']
  ]));
  var half = Math.floor(pd.width / 2);
  t.setColumnWidth(0, half).setColumnWidth(1, pd.width - half);
  pdfText_(t, 9, PDF_C_.ink);
  pdfText_(t.getRow(0), 9, PDF_C_.navy, true);
  pdfText_(t.getRow(1), 7, PDF_C_.muted, false, true);
  pdfText_(t.getRow(3), 9, PDF_C_.ink, true);
  for (var r = 0; r < 4; r++) for (var c = 0; c < 2; c++) { pdfCellPad_(t.getRow(r).getCell(c), 1, 4); pdfCellAlign_(t.getRow(r).getCell(c), 'CENTER'); }
  return t;
}


/* ---------------- PDF bảng tháng của một máy ---------------- */

var PDF_CELL_C_ = {
  WARN: { bg: '#FFF4D6', fg: '#7A4D00' }, FAIL: { bg: '#FDECEA', fg: '#9B2C20' }, MISS: { bg: '#EEF1F4', fg: '#52606D' }, OKMARK: { fg: '#1E7B4A' }
};

/** Chữ ngắn trong ô bảng tháng */
function gridCellText_(r) {
  if (!r || r.result === 'EMPTY') return '';
  if (r.input_type === 'NUMBER') return fmtNumVi_(r.value);
  if (r.input_type === 'THREE_PHASE') return Array.isArray(r.values) ? fmtNumVi_(Math.max.apply(null, r.values.filter(function (x) { return x !== null; }))) : '';
  if (r.result === 'OK') return '✓';
  if (r.result === 'WARN') return '!';
  return '✕';
}

/**
 * Lưới một mẫu (một ca nếu kiểm theo ca): hạng mục × kỳ trong tháng. Trả {head, rows, colors, counts, people}.
 * colors[r][c] = {bg, fg}; counts = {due, done, fail, warn}.
 */
function monthGrid_(md, tpl, shift, people) {
  var periods = monthPeriods_(tpl.frequency, md.ym, shift);
  var asg = md.assignments.filter(function (a) { return a.template_id === tpl.template_id; })[0] || null;
  var runs = md.runs.filter(function (r) { return r.template_id === tpl.template_id && (tpl.frequency !== 'SHIFT' || String(r.shift) === String(shift)); });
  var runBy = {};
  runs.forEach(function (r) { runBy[r.period_key] = r; });
  var missedBy = {};
  md.missed.forEach(function (m) { if (m.template_id === tpl.template_id) missedBy[m.period_key] = m; });
  var items = templateItems_(tpl.template_id, tpl.revision);
  var keys = items.map(function (it) { return { key: it.item_key, vi: it.name_vi, zh: it.name_zh, std: stdText_(effItem_(it, asg ? asg.overrides_json : null), 'vi') }; });
  // Hạng mục chỉ có ở phiên bản cũ (đã bỏ khỏi mẫu) nhưng có kết quả trong tháng: vẫn hiện để không mất số liệu
  runs.forEach(function (r) {
    (r.results_json || []).forEach(function (x) {
      if (!keys.some(function (k) { return k.key === x.item_key; })) keys.push({ key: x.item_key, vi: x.name_vi, zh: x.name_zh, std: x.std_vi || '' });
    });
  });
  var nowMs = now_().getTime();
  var counts = { due: 0, done: 0, fail: 0, warn: 0 };
  var state = periods.map(function (per) {
    var sp = periodSpan_(tpl.frequency, per, shift);
    var run = runBy[per.key] || null;
    var started = sp.start <= nowMs, ended = sp.end <= nowMs;
    var inScope = !asg || !asg.start_date || per.last >= asg.start_date;
    if (run) { counts.due++; counts.done++; counts.fail += run.fail_count || 0; counts.warn += run.warn_count || 0; } else if (ended && inScope && asg && asg.active) counts.due++;
    return { run: run, miss: !run && ended && inScope && !!asg && asg.active, excused: !!missedBy[per.key], future: !started };
  });
  var head = ['#', lab_('rpt.col_item'), lab_('rpt.col_std')].concat(periods.map(function (p) { return p.label; }));
  var rows = [], colors = [];
  keys.forEach(function (k, i) {
    var row = [String(i + 1), (k.vi || '') + (k.zh ? '\n' + k.zh : ''), k.std || ''];
    var col = [null, null, null];
    state.forEach(function (st) {
      if (st.run) {
        var x = (st.run.results_json || []).filter(function (y) { return y.item_key === k.key; })[0];
        row.push(gridCellText_(x));
        col.push(x && (x.result === 'WARN' || x.result === 'FAIL') ? PDF_CELL_C_[x.result] : (x && x.result === 'OK' && gridCellText_(x) === '✓' ? PDF_CELL_C_.OKMARK : null));
      } else if (st.miss) { row.push('–'); col.push(PDF_CELL_C_.MISS); } else { row.push(''); col.push(null); }
    });
    rows.push(row); colors.push(col);
  });
  // Người kiểm (số thứ tự, chú thích dưới bảng) và trưởng bộ phận xác nhận ngày
  var who = ['', lab_('rpt.row_checker'), ''], conf = ['', lab_('rpt.row_confirm'), ''];
  var wc = [null, null, null], cc = [null, null, null];
  state.forEach(function (st, j) {
    if (st.run) {
      if (!people.map[st.run.checked_by]) { people.list.push(st.run.checked_by); people.map[st.run.checked_by] = people.list.length; }
      who.push(String(people.map[st.run.checked_by])); wc.push(null);
    } else { who.push(st.miss ? '–' : ''); wc.push(st.miss ? PDF_CELL_C_.MISS : null); }
    var per = periods[j];
    var ok = (tpl.frequency === 'DAY' || tpl.frequency === 'SHIFT') && dayLocked_(per.date, md.machine.area_id, md.confirms);
    conf.push(ok ? '✓' : ''); cc.push(ok ? PDF_CELL_C_.OKMARK : null);
  });
  rows.push(who, conf); colors.push(wc, cc);
  return { head: head, rows: rows, colors: colors, counts: counts, nCols: head.length };
}

/** Bảng lưới tháng trong PDF: cột hẹp đều cho các kỳ, ô màu theo kết quả */
function pdfGrid_(pd, g) {
  var t = pd.body.appendTable([g.head].concat(g.rows));
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var nPer = g.nCols - 3;
  var wNo = 16, wStd = 70, wItem = 122;
  var wPer = Math.max(14, Math.floor((pd.width - wNo - wStd - wItem) / Math.max(1, nPer)));
  if (nPer <= 6) { wPer = Math.floor((pd.width - wNo - wItem - wStd) / nPer); }
  t.setColumnWidth(0, wNo).setColumnWidth(1, wItem).setColumnWidth(2, wStd);
  for (var c = 3; c < g.nCols; c++) t.setColumnWidth(c, wPer);
  var fs = nPer > 20 ? 6 : 7;
  pdfText_(t, fs, PDF_C_.ink);
  var hr = t.getRow(0);
  pdfText_(hr, fs, PDF_C_.navy, true);
  for (var h = 0; h < g.nCols; h++) {
    var hc = hr.getCell(h);
    hc.setBackgroundColor(PDF_C_.head);
    pdfCellPad_(hc, 1, 1);
    if (h >= 3) pdfCellAlign_(hc, 'CENTER');
  }
  for (var r = 0; r < g.rows.length; r++) {
    if (!pdfTimeLeft_(pd)) break;
    var row = t.getRow(r + 1);
    var extra = r >= g.rows.length - 2;
    for (var c2 = 0; c2 < g.nCols; c2++) {
      var cell = row.getCell(c2);
      pdfCellPad_(cell, 1, 1);
      if (c2 >= 3) pdfCellAlign_(cell, 'CENTER');
      var col = g.colors[r][c2];
      if (col) {
        if (col.bg) cell.setBackgroundColor(col.bg);
        pdfText_(cell, fs, col.fg, true);
      }
    }
    if (extra) { row.getCell(1).setBackgroundColor(PDF_C_.tile); pdfText_(row.getCell(1), fs, PDF_C_.navy, true); }
    pdfText_(row.getCell(0), fs, PDF_C_.muted);
  }
  return t;
}

/**
 * report.pdf {machine_id, ym, template_id?, shift?} — PDF bảng tháng của một máy. Mẫu kiểm theo ca: mỗi ca một bảng
 * (hoặc đúng ca chọn). Trả {file_name, report_code, content_b64}.
 */
function reportPdfAction_(ctx) {
  var p = ctx.req.payload || {};
  var md = monthData_(p.machine_id, trimStr_(p.ym));
  var tpls = md.templates.filter(function (t) { return !p.template_id || t.template_id === p.template_id; });
  if (!tpls.length) throw validationError_([fieldError_('template_id', 'NOT_ASSIGNED')]);
  var code = withWriteLock_(function () {
    var st = readState_(), su = {};
    var c = allocCode_(st, su, 'REPORT');
    stateWrite_(st, su, ctx.user.user_id);
    writeAudit_({ user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'report.pdf', entity_type: 'MACHINE', entity_id: md.machine.machine_id,
      before_json: null, after_json: { report_code: c, ym: md.ym, template_id: p.template_id || '' }, operation_id: '', auth_basis: authBasis_(ctx) });
    return c;
  });
  var mac = md.machine;
  var macName = (mac.name_vi || '') + (mac.name_zh ? ' · ' + mac.name_zh : '');
  var title = lab_('rpt.title');
  var nowIso = isoVN_(now_());
  var footer = title + ' · ' + code + ' · ' + mac.machine_code + ' · ' + lab_('rpt.generated_at') + ' ' + fmtDateVN_(nowIso) + ' ' + nowIso.slice(11, 16);
  var pd = pdfStart_({ wide: true, footer: footer });
  var tp = LABELS['rpt.title'] || ['', ''];
  pdfTitle_(pd, tp[0].toUpperCase(), tp[1]);
  var areaName = md.area ? (md.area.area_code ? md.area.area_code + ' · ' : '') + (md.area.name_vi || '') + (md.area.name_zh ? ' · ' + md.area.name_zh : '') : '';
  pdfMeta_(pd, [
    [lab_('rpt.machine'), mac.machine_code + ' · ' + macName],
    [lab_('rpt.area'), areaName || '—'],
    [lab_('rpt.month'), md.ym.slice(5, 7) + '/' + md.ym.slice(0, 4)]
  ], [
    [lab_('rpt.number'), code],
    [lab_('rpt.generated_at'), fmtDateVN_(nowIso) + ' ' + nowIso.slice(11, 16)],
    [lab_('rpt.prepared_by'), ctx.user.display_name]
  ]);
  var people = { list: [], map: {} };
  var shiftsAll = shiftsCfg_();
  tpls.forEach(function (tpl) {
    var shifts = tpl.frequency === 'SHIFT' ? String(tpl.shifts || '').split(',').filter(String) : [''];
    if (tpl.frequency === 'SHIFT' && p.shift && shifts.indexOf(String(p.shift)) >= 0) shifts = [String(p.shift)];
    shifts.forEach(function (sh) {
      var g = monthGrid_(md, tpl, sh, people);
      var shTxt = '';
      if (sh) {
        var sc = shiftsAll.filter(function (x) { return String(x.no) === sh; })[0];
        shTxt = ' · ' + lab_('rpt.shift', { N: sh }) + (sc ? ' (' + sc.start + ' – ' + sc.end + ')' : '');
      }
      pdfHeading_(pd, tpl.template_code + ' · ' + (tpl.name_vi || tpl.name_zh) + ' · ' + lab_('freq.' + tpl.frequency) + shTxt + ' · ' + lab_('rpt.revision', { N: tpl.revision }), 8);
      var rate = g.counts.due ? Math.round(g.counts.done / g.counts.due * 1000) / 10 : 0;
      pdfTiles_(pd, [
        { label: lab_('rpt.tile_runs'), value: g.counts.done + '/' + g.counts.due },
        { label: lab_('rpt.tile_rate'), value: String(rate).replace('.', ',') + ' %' },
        { label: lab_('rpt.tile_fail'), value: String(g.counts.fail) },
        { label: lab_('rpt.tile_warn'), value: String(g.counts.warn) }
      ]);
      pdfGrid_(pd, g);
    });
  });
  var dir = userDirectory_();
  var nm = function (id) { var u = dir[id]; return u ? u.employee_code + ' ' + u.display_name : ''; };
  pdfNote_(pd, lab_('rpt.legend') + (people.list.length ? ' · ' + lab_('rpt.checkers') + ': ' + people.list.map(function (id, i) { return (i + 1) + ' = ' + nm(id); }).join(', ') : ''));
  var abn = md.abnormals.filter(function (a) { return tpls.some(function (t) { return t.template_id === a.template_id; }); })
    .sort(function (a, b) { return String(a.work_date + a.shift).localeCompare(String(b.work_date + b.shift)); });
  pdfHeading_(pd, lab_('rpt.abnormals'), 10);
  pdfTable_(pd, [lab_('rpt.col_date'), lab_('rpt.col_item'), lab_('rpt.col_value'), lab_('rpt.col_std'), lab_('rpt.col_note'), lab_('rpt.col_resolution'), lab_('rpt.col_status')],
    abn.map(function (a) {
      return [fmtDateVN_(a.work_date) + (a.shift ? ' · ' + lab_('rpt.shift', { N: a.shift }).split(' · ')[0] : ''), a.item_name_vi || a.item_name_zh, a.value_text, a.std_text,
        a.note || '', (a.resolution_vi || a.resolution_zh || '') + (a.resolved_by ? ' (' + nm(a.resolved_by) + ')' : ''), lab_('abn_status.' + a.status)];
    }), ['date', 'text', 'text', 'text', 'text', 'text', 'text'],
    { numbered: true, empty: lab_('rpt.no_abnormals'), cellColor: function (r, c) { return c === 6 ? (abn[r].status === 'OPEN' ? PDF_C_.bad : PDF_C_.good) : null; } });
  var miss = md.missed.filter(function (m) { return tpls.some(function (t) { return t.template_id === m.template_id; }); });
  if (miss.length) {
    pdfHeading_(pd, lab_('rpt.missed_reasons'), 10);
    pdfTable_(pd, [lab_('rpt.col_date'), lab_('rpt.col_reason'), lab_('rpt.col_by')],
      miss.map(function (m) { return [fmtDateVN_(m.work_date) + (m.shift ? ' · ' + m.shift : ''), m.reason_vi || m.reason_zh, nm(m.recorded_by)]; }), ['date', 'text', 'text'], { numbered: true });
  }
  pdfSign_(pd, ctx.user.display_name);
  var bytes = pdfFinish_(pd);
  return { file_name: code + '_' + mac.machine_code + '_' + md.ym + '.pdf', report_code: code, mime_type: 'application/pdf', content_b64: b64_(bytes) };
}

// ===== 26_sample.js =====
/* 26_sample: dữ liệu mẫu cho máy chủ THỬ (khu vực, thiết bị, 3 mẫu checksheet, gán máy, tài khoản MAU-*) để thử app
 * khi chưa nối M&E. Nối M&E rồi thì thiết bị mẫu tự ngừng ở lần lấy danh sách tiếp theo (không có trong M&E). */

var SAMPLE_AREAS_ = [['KV-A', 'Xưởng A', 'A车间'], ['KV-B', 'Xưởng B', 'B车间'], ['KV-D', 'Phòng điện', '配电室']];
var SAMPLE_MACHINES_ = [
  ['TB-0007', 'Máy nén khí 01', '空压机01', 0, 'Máy nén khí', '空压机'],
  ['TB-0008', 'Máy nén khí 02', '空压机02', 0, 'Máy nén khí', '空压机'],
  ['TB-0012', 'Máy sấy khí', '冷干机', 0, 'Máy sấy khí', '冷干机'],
  ['TB-0031', 'Chiller 01', '冷水机01', 1, 'Chiller', '冷水机'],
  ['TB-0102', 'Tủ điện tổng MSB', '总配电柜', 2, 'Tủ điện', '配电柜']
];
/** [tên Việt, tên Trung, tần suất, ca, số thứ tự hạng mục trong thư viện, máy (chỉ số trong SAMPLE_MACHINES_)] */
var SAMPLE_TEMPLATES_ = [
  ['Máy nén khí – hằng ca', '空压机 – 每班点检', 'SHIFT', '1,2,3', [1, 2, 9, 12, 16, 15, 20, 24, 30, 31], [0, 1]],
  ['Chiller – hằng ngày', '冷水机 – 每日点检', 'DAY', '', [5, 6, 13, 14, 16, 30], [2, 3]],
  ['Tủ điện – hằng tuần', '配电柜 – 每周点检', 'WEEK', '', [7, 15, 18, 33, 31], [4]]
];

function seedSample_(byUserId) {
  if (!isTestEnv_()) throw new Error('Chỉ chạy ở máy chủ THỬ (ENV=THU).');
  var nowIso = isoVN_(now_());
  var areas = readRows_('Areas');
  if (areas.some(function (a) { return a.source === 'SAMPLE'; })) return { already: true };
  var lib = {};
  readRows_('LibraryItems').forEach(function (r) { lib[r.item_id] = r; });
  var writes = [];
  var areaIds = SAMPLE_AREAS_.map(function (a) {
    var id = uuid_();
    writes.push({ sheet: 'Areas', mode: 'insert', row: cNewSystem_({ area_id: id, area_code: a[0], name_vi: a[1], name_zh: a[2], parent_area_id: '', active: true, source: 'SAMPLE', synced_at: nowIso }) });
    return id;
  });
  var macIds = SAMPLE_MACHINES_.map(function (m) {
    var id = uuid_();
    writes.push({ sheet: 'Machines', mode: 'insert', row: cNewSystem_({ machine_id: id, machine_code: m[0], name_vi: m[1], name_zh: m[2], area_id: areaIds[m[3]], me_status: 'RUNNING', category_vi: m[4], category_zh: m[5], model: '', qr_key: newQrKey_(), active: true, source: 'SAMPLE', synced_at: nowIso }) });
    return id;
  });
  var tplCodes = [];
  withWriteLock_(function () {
    var st = readState_(), su = {};
    SAMPLE_TEMPLATES_.forEach(function () { tplCodes.push(allocCode_(st, su, 'TEMPLATE')); });
    stateWrite_(st, su, SYSTEM_USER);
  });
  SAMPLE_TEMPLATES_.forEach(function (t, ti) {
    var tid = uuid_();
    writes.push({ sheet: 'Templates', mode: 'insert', row: cNewSystem_({ template_id: tid, template_code: tplCodes[ti], name_vi: t[0], name_zh: t[1], frequency: t[2], shifts: t[3], revision: 1, active: true, note_vi: '', note_zh: '', i18n_meta: { name: { src: 'vi', state: 'HUMAN', at: nowIso } } }) });
    t[4].forEach(function (n, i) {
      var li = lib['LIB-' + ('00' + n).slice(-3)];
      if (!li) return;
      var row = { template_item_id: uuid_(), template_id: tid, revision: 1, item_key: uuid_(), step_no: i + 1, required: true, photo_on_fail: false, library_item_id: li.item_id, i18n_meta: li.i18n_meta };
      STD_COLS_.split(' ').forEach(function (f) { row[f] = li[f]; });
      writes.push({ sheet: 'TemplateItems', mode: 'insert', row: cNewSystem_(row) });
    });
    t[5].forEach(function (mi) {
      writes.push({ sheet: 'Assignments', mode: 'insert', row: cNewSystem_({ assignment_id: uuid_(), machine_id: macIds[mi], template_id: tid, active: true, overrides_json: null, start_date: todayVN_(), note: '' }) });
    });
  });
  systemWrite_(writes, { action: 'sample.seed', entity_type: 'SYSTEM', after_json: { machines: macIds.length, templates: SAMPLE_TEMPLATES_.length, by: byUserId || SYSTEM_USER } });
  // Tài khoản mẫu: PIN tạm 72 giờ, đăng nhập lần đầu phải đổi PIN
  var users = [['MAU-KT', 'Người kiểm MẪU', 2], ['MAU-C3', 'Trưởng bộ phận MẪU', 3], ['MAU-C1', 'Tra cứu MẪU', 1]];
  var pins = {};
  withWriteLock_(function () {
    var have = {};
    readRows_('Users').forEach(function (u) { have[u.employee_code] = true; });
    var add = [];
    users.forEach(function (u) {
      if (have[u[0]]) return;
      var pin = randomPin_(u[0]);
      var rec = newPinRecord_(pin);
      pins[u[0]] = pin;
      add.push({
        user_id: uuid_(), employee_code: u[0], display_name: u[1], email: '', role_level: u[2], active: true, pin_hash: rec.pin_hash, salt: rec.salt,
        pin_hash_version: rec.pin_hash_version, failed_attempts: 0, locked_until: '', created_at: nowIso, updated_at: nowIso, auth_version: 1,
        is_system_owner: false, must_change_pin: true, temp_pin_expires_at: isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000)),
        pin_changed_at: '', failed_window_started_at: '', last_login_at: '', record_version: 1, created_by: SYSTEM_USER, updated_by: SYSTEM_USER, area_ids: ''
      });
    });
    if (add.length) {
      insertRows_('Users', add);
      var st = readState_();
      var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
      stateWrite_(st, { sync_revision: ['INT', rev], 'table_rev.Users': ['INT', rev] }, SYSTEM_USER);
    }
  });
  cache_().remove('users:dir');
  DB_.userDir = null;
  return { machines: macIds.length, templates: SAMPLE_TEMPLATES_.length, temp_pins: pins };
}

/** Chạy từ trình soạn ở máy chủ THỬ: in PIN tạm của tài khoản mẫu vào nhật ký thực thi */
function adminSeedSample() {
  dbReset_();
  var out = seedSample_(SYSTEM_USER);
  if (out.already) { log_('Đã có dữ liệu mẫu — không tạo thêm.'); return; }
  log_('Đã tạo dữ liệu mẫu: ' + out.machines + ' thiết bị, ' + out.templates + ' mẫu checksheet. PIN tạm (đổi khi đăng nhập lần đầu): ' +
    Object.keys(out.temp_pins).map(function (k) { return k + ' = ' + out.temp_pins[k]; }).join(', '));
}

/** sample.seed (owner, PIN, chỉ THỬ): như adminSeedSample, PIN tạm trả một lần trong phản hồi */
function sampleSeedAction_(ctx) {
  if (!isTestEnv_()) throw apiError_('FEATURE_NOT_ENABLED');
  return seedSample_(ctx.user.user_id);
}

// ===== i18n/labels.json =====
/** Bản chép từ điển nhãn của app (5.3) cho email, Excel, lời báo */
var LABELS = {"rpt.title":["Phiếu kiểm tra thiết bị","设备点检表"],"rpt.machine":["Thiết bị","设备"],"rpt.area":["Khu vực","区域"],"rpt.month":["Tháng","月份"],"rpt.number":["Số","编号"],"rpt.generated_at":["Lập lúc","编制时间"],"rpt.prepared_by":["Người lập","编制"],"rpt.approved_by":["Trưởng bộ phận","部门主管"],"rpt.sign_hint":["Ký, ghi rõ họ tên","签名"],"rpt.col_item":["Hạng mục","项目"],"rpt.col_std":["Tiêu chuẩn","标准"],"rpt.row_checker":["Người kiểm","点检人"],"rpt.row_confirm":["Trưởng BP xác nhận","主管确认"],"rpt.shift":["Ca {N}","{N}班"],"rpt.revision":["phiên bản {N}","第{N}版"],"rpt.tile_runs":["Lượt kiểm","点检次数"],"rpt.tile_rate":["Hoàn thành","完成率"],"rpt.tile_fail":["Không đạt","不合格"],"rpt.tile_warn":["Cần chú ý","需关注"],"rpt.legend":["Số = giá trị đo; ✓ Đạt; nền vàng = Cần chú ý; nền đỏ = Không đạt; – = bỏ sót; ô trống = chưa tới kỳ","数值=测量值；✓ 合格；黄底=需关注；红底=不合格；– =漏检；空白=未到期"],"rpt.checkers":["Người kiểm","点检人"],"rpt.abnormals":["Bất thường và xử lý","异常与处理"],"rpt.col_date":["Ngày","日期"],"rpt.col_value":["Kết quả","结果"],"rpt.col_note":["Ghi chú","备注"],"rpt.col_resolution":["Xử lý","处理"],"rpt.col_status":["Trạng thái","状态"],"rpt.no_abnormals":["Không có bất thường trong tháng","本月无异常"],"rpt.missed_reasons":["Lý do bỏ sót","漏检原因"],"rpt.col_reason":["Lý do","原因"],"rpt.col_by":["Người ghi","记录人"],"freq.SHIFT":["Mỗi ca","每班"],"freq.DAY":["Mỗi ngày","每日"],"freq.WEEK":["Mỗi tuần","每周"],"freq.MONTH":["Mỗi tháng","每月"],"abn_status.OPEN":["Chưa xử lý","未处理","red"],"abn_status.RESOLVED":["Đã xử lý","已处理","green"],"abn_status.CANCELLED":["Đã hủy","已取消","grey"],"field.no_records":["Chưa có dữ liệu","暂无数据"]};
