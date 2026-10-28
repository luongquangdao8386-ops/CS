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
