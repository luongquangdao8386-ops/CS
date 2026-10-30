/* =====================================================================
 * Checksheet · 点检表 — máy chủ Google Apps Script
 * 00_config: hằng số, Settings mặc định, khóa SystemState
 * Lõi (PIN, phiên, ghi có xác nhận, đồng bộ, hàng chờ offline) lấy từ app M&E đã chạy THẬT.
 * ===================================================================== */

var APP_ID = 'CS';
var SERVER_VERSION = '1.0.0-d1.2';
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
