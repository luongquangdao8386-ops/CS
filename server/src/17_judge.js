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
