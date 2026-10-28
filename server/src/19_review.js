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
