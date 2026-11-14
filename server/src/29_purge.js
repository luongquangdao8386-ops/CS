/* 29_purge: xóa hẳn mẫu checksheet (d1.5).
 * - Mẫu chưa có dữ liệu kiểm (lượt kiểm, bất thường, lý do bỏ sót): Trưởng bộ phận / Quản trị xóa được (PIN).
 * - Mẫu đã có dữ liệu kiểm: chỉ owner; gõ chữ XÓA; số đếm phải khớp lúc xem trước (PIN).
 * Xóa dòng thật trong Sheet: mẫu, mọi phiên bản hạng mục, gán máy, lượt kiểm, bất thường, lý do bỏ sót, dòng ảnh
 * (tệp ảnh trên Drive chuyển vào thùng rác). Chỉ xóa theo template_id nên mẫu khác không bị đụng.
 * Mã MS không cấp lại: bộ đếm code_seq.MS chỉ tăng. Điện thoại tự tải lại dữ liệu (settings_rev đổi như khi đổi cài đặt)
 * nên bỏ mẫu đã xóa mà không phải đăng nhập lại — cả app bản cũ cũng vậy. */

var PURGE_MAX_ = 30;
var PURGE_COUNT_KEYS_ = ['runs', 'abnormals', 'missed', 'documents'];

function purgeIds_(p) {
  var ids = Array.isArray(p.template_ids) ? p.template_ids.map(trimStr_) : [];
  var errs = [];
  if (!ids.length || ids.length > PURGE_MAX_) errs.push(fieldError_('template_ids', 'REQUIRED'));
  ids.forEach(function (id, i) { if (!isUuidV4_(id) || ids.indexOf(id) !== i) errs.push(fieldError_('template_ids.' + i, 'ID_INVALID')); });
  if (errs.length) throw validationError_(errs);
  return ids;
}

/**
 * Đếm những gì sẽ bị xóa theo từng mẫu (đọc thẳng Sheet, chỉ vài cột). Mẫu không có trong Sheet → NOT_FOUND.
 * Trả {list: [{template_id, template_code, …số đếm, has_history}], runIds: [], files: [drive id]}
 */
function purgeScan_(ids) {
  var by = {};
  readRows_('Templates').forEach(function (t) {
    if (ids.indexOf(t.template_id) < 0) return;
    by[t.template_id] = {
      template_id: t.template_id, template_code: t.template_code, name_vi: t.name_vi, name_zh: t.name_zh, form_code: t.form_code || '',
      active: !!t.active, revision: Number(t.revision) || 1, items: 0, assignments: 0, assignments_active: 0, runs: 0, abnormals: 0,
      abnormals_open: 0, missed: 0, documents: 0, first_date: '', last_date: ''
    };
  });
  var missing = ids.filter(function (id) { return !by[id]; });
  if (missing.length) throw apiError_('NOT_FOUND', { template_ids: missing });
  var span = function (o, d) {
    d = String(d || '').slice(0, 10);
    if (!d) return;
    if (!o.first_date || d < o.first_date) o.first_date = d;
    if (!o.last_date || d > o.last_date) o.last_date = d;
  };
  readCols_('TemplateItems', ['template_id']).forEach(function (r) { if (by[r.template_id]) by[r.template_id].items++; });
  readCols_('Assignments', ['template_id', 'active']).forEach(function (r) {
    var o = by[r.template_id];
    if (!o) return;
    o.assignments++;
    if (r.active) o.assignments_active++;
  });
  var runOf = {};
  readCols_('Runs', ['template_id', 'work_date']).forEach(function (r) {
    var o = by[r.template_id];
    if (!o) return;
    o.runs++;
    runOf[r.run_id] = o;
    span(o, r.work_date);
  });
  readCols_('Abnormals', ['template_id', 'status', 'run_id']).forEach(function (r) {
    var o = by[r.template_id];
    if (!o) return;
    o.abnormals++;
    if (r.status === 'OPEN') o.abnormals_open++;
  });
  readCols_('MissedReasons', ['template_id', 'work_date']).forEach(function (r) {
    var o = by[r.template_id];
    if (!o) return;
    o.missed++;
    span(o, r.work_date);
  });
  var files = [];
  readCols_('Documents', ['parent_run_id', 'drive_file_id', 'thumb_drive_file_id']).forEach(function (d) {
    var o = runOf[d.parent_run_id];
    if (!o) return;
    o.documents++;
    if (d.drive_file_id) files.push(d.drive_file_id);
    if (d.thumb_drive_file_id) files.push(d.thumb_drive_file_id);
  });
  var list = ids.map(function (id) {
    var o = by[id];
    o.has_history = o.runs + o.abnormals + o.missed + o.documents > 0;
    return o;
  });
  return { list: list, runIds: Object.keys(runOf), files: files };
}

/** "XÓA", "xoa", "Xóa" … đều được */
function purgeConfirmOk_(s) {
  var t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').trim().toUpperCase();
  return t === 'XOA';
}

/** template.purgeInfo {template_ids} (C3): xem trước số dòng sẽ bị xóa, ai được xóa, lần sao lưu gần nhất */
function templatePurgeInfo_(ctx) {
  var ids = purgeIds_(ctx.req.payload || {});
  var scan = purgeScan_(ids);
  var st = readState_();
  return {
    templates: scan.list, is_owner: levelAllows_(ctx.user, { level: 'O' }),
    last_backup_at: stateGet_(st, 'last_backup_at', ''), last_backup_status: stateGet_(st, 'last_backup_status', '')
  };
}

/**
 * template.purge {template_ids, confirm_text?, expect: {template_id: {runs, abnormals, missed, documents}}} (C3, PIN)
 * Mẫu có dữ liệu kiểm: chỉ owner, confirm_text = XÓA, expect phải khớp số đếm hiện tại (có người vừa kiểm thêm → xem lại).
 */
function templatePurge_(ctx) {
  var p = ctx.req.payload || {};
  var ids = purgeIds_(p);
  var isOwner = levelAllows_(ctx.user, { level: 'O' });
  var expect = p.expect && typeof p.expect === 'object' ? p.expect : {};
  var files = [];
  var res = executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: ids.length === 1 ? ids[0] : '',
    build: function (st) {
      var scan = purgeScan_(ids);
      var hist = scan.list.filter(function (o) { return o.has_history; });
      if (hist.length && !isOwner) {
        throw apiError_('VALIDATION_ERROR', { templates: scan.list }, hist.map(function (o) { return fieldError_('template_ids.' + ids.indexOf(o.template_id), 'PURGE_OWNER_ONLY'); }));
      }
      if (hist.length && !purgeConfirmOk_(p.confirm_text)) throw validationError_([fieldError_('confirm_text', 'CONFIRM_TEXT')]);
      var changed = scan.list.filter(function (o) {
        var e = expect[o.template_id] || {};
        return PURGE_COUNT_KEYS_.some(function (k) { return Number(e[k] || 0) !== o[k]; });
      });
      if (changed.length) {
        throw apiError_('VALIDATION_ERROR', { templates: scan.list }, changed.map(function (o) { return fieldError_('template_ids.' + ids.indexOf(o.template_id), 'PURGE_COUNTS_CHANGED'); }));
      }
      files = scan.files;
      var tot = { templates: ids.length, items: 0, assignments: 0, runs: 0, abnormals: 0, missed: 0, documents: 0 };
      scan.list.forEach(function (o) { Object.keys(tot).forEach(function (k) { if (k !== 'templates') tot[k] += o[k]; }); });
      var writes = ['Documents'].map(function (s) { return { sheet: s, mode: 'delete', col: 'parent_run_id', values: scan.runIds }; })
        .filter(function (w) { return w.values.length; })
        .concat(['Abnormals', 'MissedReasons', 'Runs', 'Assignments', 'TemplateItems', 'Templates'].map(function (s) {
          return { sheet: s, mode: 'delete', col: 'template_id', values: ids };
        }));
      var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
      return {
        writes: writes,
        // App mọi máy (cả bản cũ) thấy settings_rev đổi → tải lại toàn bộ dữ liệu → bỏ mẫu đã xóa, không phải đăng nhập lại
        state: { settings_rev: ['INT', rev] },
        result: { purged: scan.list.map(function (o) { return { template_id: o.template_id, template_code: o.template_code }; }), counts: tot },
        audit: {
          entity_type: 'TEMPLATE', entity_id: ids.length === 1 ? ids[0] : '', reason: 'PURGE',
          before_json: { templates: scan.list.map(function (o) { return { c: o.template_code, n: String(o.name_vi || o.name_zh || '').slice(0, 40), runs: o.runs, abn: o.abnormals, missed: o.missed, docs: o.documents, asg: o.assignments, items: o.items }; }) },
          after_json: { purged: ids.length, counts: tot }
        }
      };
    }
  });
  // Tệp ảnh trên Drive: ngoài khóa ghi, vào thùng rác (còn lấy lại được 30 ngày); quá giờ thì để lại, không ảnh hưởng app
  if (res && res.code === 'OK' && files.length && res.data) {
    var t0 = Date.now(), n = 0;
    for (var i = 0; i < files.length && Date.now() - t0 < 25000; i++) {
      try { DriveApp.getFileById(files[i]).setTrashed(true); n++; } catch (e) { /* tệp đã mất: bỏ qua */ }
    }
    res.data.files_trashed = n;
  }
  return res;
}
