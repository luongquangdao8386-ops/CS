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
