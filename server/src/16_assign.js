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
