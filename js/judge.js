// Đánh giá Đạt / Cần chú ý / Không đạt, chữ tiêu chuẩn, ca và kỳ kiểm — cùng quy tắc với máy chủ (server/src/17_judge.js;
// tests/server/judge.test.mjs so hai bản trên cùng bộ ví dụ). App dùng để tô màu ngay khi gõ; máy chủ đánh giá lại khi lưu.

export const STD_FIELDS = ['unit', 'std_type', 'std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json', 'std_text_vi', 'std_text_zh'];
const ITEM_COPY = ['item_key', 'template_item_id', 'step_no', 'group_key', 'name_vi', 'name_zh', 'input_type', 'how_vi', 'how_zh', 'required', 'photo_on_fail', 'i18n_meta'];
export const DEFAULT_SHIFTS = [{ no: 1, start: '06:00', end: '14:00' }, { no: 2, start: '14:00', end: '22:00' }, { no: 3, start: '22:00', end: '06:00' }];

export function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Hạng mục hiệu lực của một máy: hạng mục của mẫu + tiêu chuẩn riêng (overrides theo item_key) */
export function effItem(ti, overrides) {
  const o = {};
  ITEM_COPY.concat(STD_FIELDS).forEach((f) => { o[f] = ti[f] === undefined ? null : ti[f]; });
  const ov = overrides && ti.item_key ? overrides[ti.item_key] : null;
  if (ov && typeof ov === 'object') {
    STD_FIELDS.forEach((f) => { if (ov[f] !== undefined && ov[f] !== null && ov[f] !== '') o[f] = ov[f]; });
    o.overridden = true;
  }
  return o;
}

export function stdBounds(it) {
  const min = numOrNull(it.std_min), max = numOrNull(it.std_max);
  switch (it.std_type) {
    case 'RANGE': return { min, max };
    case 'MAX': return { min: null, max };
    case 'MIN': return { min, max: null };
    case 'TOL': {
      const nom = numOrNull(it.std_nominal), t = numOrNull(it.std_tol_pct);
      if (nom === null || t === null) return { min: null, max: null };
      const d = Math.abs(nom) * t / 100;
      return { min: Math.round((nom - d) * 1e6) / 1e6, max: Math.round((nom + d) * 1e6) / 1e6 };
    }
    default: return { min: null, max: null };
  }
}

function judgeNum(it, v) {
  const n = numOrNull(v);
  if (n === null) return 'EMPTY';
  const b = stdBounds(it);
  if (b.min !== null && n < b.min) return 'FAIL';
  if (b.max !== null && n > b.max) return 'FAIL';
  const wl = numOrNull(it.warn_lo), wh = numOrNull(it.warn_hi);
  if ((wl !== null && n <= wl) || (wh !== null && n >= wh)) return 'WARN';
  return 'OK';
}

export function imbalancePct(vals) {
  const avg = (vals[0] + vals[1] + vals[2]) / 3;
  if (!(avg > 0)) return 0;
  const dev = Math.max(Math.abs(vals[0] - avg), Math.abs(vals[1] - avg), Math.abs(vals[2] - avg));
  return Math.round(dev / avg * 1000) / 10;
}

/** input: {value, values:[R,S,T], choice, pass, text} → {result: OK|WARN|FAIL|EMPTY, imb?} */
export function judgeItem(it, input = {}) {
  switch (it.input_type) {
    case 'NUMBER': return { result: judgeNum(it, input.value) };
    case 'THREE_PHASE': {
      const raw = Array.isArray(input.values) ? input.values : [];
      const vals = [0, 1, 2].map((i) => numOrNull(raw[i]));
      if (vals.some((x) => x === null)) return { result: 'EMPTY' };
      const ex = it.extra_json || {};
      let imbMax = numOrNull(ex.imb_max);
      const imbWarn = numOrNull(ex.imb_warn);
      if (imbMax === null) imbMax = 10;
      const imb = imbalancePct(vals);
      const per = vals.map((x) => judgeNum(it, x));
      if (per.includes('FAIL') || imb > imbMax) return { result: 'FAIL', imb };
      if (per.includes('WARN') || (imbWarn !== null && imb >= imbWarn)) return { result: 'WARN', imb };
      return { result: 'OK', imb };
    }
    case 'CHOICE': {
      const c = (Array.isArray(it.choices_json) ? it.choices_json : []).find((x) => x && x.code === input.choice);
      return { result: c ? (['OK', 'WARN', 'FAIL'].includes(c.result) ? c.result : 'OK') : 'EMPTY' };
    }
    case 'PASS_FAIL':
      if (input.pass === true) return { result: 'OK' };
      if (input.pass === false) return { result: 'FAIL' };
      return { result: 'EMPTY' };
    case 'TEXT':
      return { result: String(input.text || '').trim() ? 'OK' : 'EMPTY' };
    default:
      return { result: 'EMPTY' };
  }
}

/** Số kiểu Việt: phần lẻ dấu phẩy, tối đa 3 chữ số lẻ */
export function fmtNumVi(n) {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '';
  return String(Math.round(Number(n) * 1000) / 1000).replace('.', ',');
}

/** Chữ tiêu chuẩn. lang: 'vi' | 'zh' */
export function stdText(it, lang = 'vi') {
  const u = it.unit ? ' ' + it.unit : '';
  const b = stdBounds(it);
  let t = '';
  switch (it.std_type) {
    case 'RANGE': t = `${fmtNumVi(b.min)} – ${fmtNumVi(b.max)}${u}`; break;
    case 'MAX': t = `≤ ${fmtNumVi(b.max)}${u}`; break;
    case 'MIN': t = `≥ ${fmtNumVi(b.min)}${u}`; break;
    case 'TOL': t = `${fmtNumVi(it.std_nominal)}${u} ± ${fmtNumVi(it.std_tol_pct)} % (${fmtNumVi(b.min)} – ${fmtNumVi(b.max)}${u})`; break;
    default: t = '';
  }
  if (it.input_type === 'THREE_PHASE') {
    const ex = it.extra_json || {};
    const imbMax = numOrNull(ex.imb_max);
    t = (t ? t + (lang === 'zh' ? '（每相）' : ' mỗi pha') : '') + (lang === 'zh' ? '，不平衡 ≤ ' : ', lệch ≤ ') + fmtNumVi(imbMax === null ? 10 : imbMax) + ' %';
  } else if (it.input_type === 'CHOICE') {
    t = (Array.isArray(it.choices_json) ? it.choices_json : []).filter((c) => c && c.result === 'OK').map((c) => (lang === 'zh' ? (c.zh || c.vi) : (c.vi || c.zh))).join(' / ');
  }
  const custom = String((lang === 'zh' ? (it.std_text_zh || it.std_text_vi) : (it.std_text_vi || it.std_text_zh)) || '').trim();
  if (it.input_type === 'PASS_FAIL' || it.input_type === 'TEXT' || !t) return custom || t;
  return t;
}

/** Ngưỡng Cần chú ý dạng chữ: "≥ 55", "≤ 6,2 / ≥ 7,8", "lệch ≥ 8 %" ('' khi không có) */
export function warnText(it) {
  const wl = numOrNull(it.warn_lo), wh = numOrNull(it.warn_hi);
  const parts = [];
  if (wl !== null) parts.push('≤ ' + fmtNumVi(wl));
  if (wh !== null) parts.push('≥ ' + fmtNumVi(wh));
  if (it.input_type === 'THREE_PHASE') {
    const iw = numOrNull((it.extra_json || {}).imb_warn);
    if (iw !== null) parts.push('lệch ≥ ' + fmtNumVi(iw) + ' %');
  }
  return parts.join(' / ');
}

/* ---------------- Ca và kỳ kiểm ---------------- */

export function hhmmMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export function shiftsOk(list) {
  if (!Array.isArray(list) || !list.length || list.length > 4) return false;
  const seen = {};
  return list.every((s) => {
    if (!s || seen[s.no] || ![1, 2, 3, 4].includes(Number(s.no))) return false;
    seen[s.no] = true;
    const a = hhmmMin(s.start), b = hhmmMin(s.end);
    return a !== null && b !== null && a !== b;
  });
}

export function shiftsFrom(settings) {
  const s = settings && settings.shifts_json;
  return (shiftsOk(s) ? s : DEFAULT_SHIFTS).slice().sort((a, b) => Number(a.no) - Number(b.no));
}

export function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isoWeekKey(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + (w < 10 ? '0' : '') + w;
}

export function periodKey(freq, workDate, shift) {
  if (freq === 'SHIFT') return workDate + '#' + shift;
  if (freq === 'DAY') return workDate;
  if (freq === 'WEEK') return isoWeekKey(workDate);
  if (freq === 'MONTH') return workDate.slice(0, 7);
  return '';
}

const p2 = (n) => String(n).padStart(2, '0');

/** Ngày làm việc và ca của một thời điểm (ngày làm việc bắt đầu lúc vào ca đầu tiên) */
export function shiftAt(date, shifts) {
  const t = new Date((date instanceof Date ? date.getTime() : Date.parse(date)) + 7 * 3600 * 1000);
  const iso = `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
  const min = t.getUTCHours() * 60 + t.getUTCMinutes();
  const dayStart = hhmmMin(shifts[0].start);
  const workDate = min >= dayStart ? iso : addDaysIso(iso, -1);
  let no = '';
  for (const s of shifts) {
    const a = hhmmMin(s.start), b = hhmmMin(s.end);
    const inS = a < b ? (min >= a && min < b) : (min >= a || min < b);
    if (inS) { no = String(s.no); break; }
  }
  return { work_date: workDate, shift: no };
}

/** Các kỳ (cột) của bảng tháng — như monthPeriods_ của máy chủ */
export function monthPeriods(freq, ym, shift) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= n; d++) days.push(`${ym}-${p2(d)}`);
  if (freq === 'SHIFT' || freq === 'DAY') return days.map((iso, i) => ({ key: periodKey(freq, iso, shift), label: String(i + 1), date: iso, last: iso }));
  if (freq === 'WEEK') {
    const out = [], seen = {};
    days.forEach((iso) => {
      const k = isoWeekKey(iso);
      if (seen[k]) { seen[k].last = iso; return; }
      seen[k] = { key: k, label: 'W' + k.slice(-2), date: iso, last: iso };
      out.push(seen[k]);
    });
    return out;
  }
  return [{ key: ym, label: `${ym.slice(5, 7)}/${ym.slice(0, 4)}`, date: days[0], last: days[n - 1] }];
}

const vnMs = (iso, min) => Date.parse(iso + 'T00:00:00+07:00') + min * 60000;

/** Mốc bắt đầu/kết thúc (ms) của một kỳ — như periodSpan_ của máy chủ */
export function periodSpan(freq, per, shift, shifts) {
  const dayStart = hhmmMin(shifts[0].start);
  if (freq === 'SHIFT') {
    const s = shifts.find((x) => String(x.no) === String(shift)) || shifts[0];
    const a = hhmmMin(s.start), b = hhmmMin(s.end);
    const startDate = a < dayStart ? addDaysIso(per.date, 1) : per.date;
    const endDate = b <= a ? addDaysIso(startDate, 1) : startDate;
    return { start: vnMs(startDate, a), end: vnMs(endDate, b) };
  }
  if (freq === 'DAY') return { start: vnMs(per.date, dayStart), end: vnMs(addDaysIso(per.date, 1), dayStart) };
  if (freq === 'WEEK') {
    const wd = new Date(per.date + 'T00:00:00Z').getUTCDay() || 7;
    const mon = addDaysIso(per.date, 1 - wd);
    return { start: vnMs(mon, dayStart), end: vnMs(addDaysIso(mon, 7), dayStart) };
  }
  return { start: vnMs(per.date, dayStart), end: vnMs(addDaysIso(per.last, 1), dayStart) };
}

/**
 * Kỳ hiện tại của một mẫu tại thời điểm `now`: {period_key, work_date, shift} hoặc null khi mẫu theo ca mà giờ này
 * không thuộc ca nào của mẫu (vd mẫu chỉ ca 1, đang ca 2).
 */
export function currentPeriod(tpl, now, shifts) {
  const at = shiftAt(now, shifts);
  if (tpl.frequency === 'SHIFT') {
    const allowed = String(tpl.shifts || '').split(',').filter(Boolean);
    if (!at.shift || !allowed.includes(at.shift)) return null;
    return { period_key: periodKey('SHIFT', at.work_date, at.shift), work_date: at.work_date, shift: at.shift };
  }
  return { period_key: periodKey(tpl.frequency, at.work_date, ''), work_date: at.work_date, shift: '' };
}

/** Kỳ ngay trước kỳ đang chạy và các kỳ đã kết thúc trong `days` ngày gần nhất (để tính máy bỏ sót) */
export function endedPeriods(tpl, nowMs, days, shifts, startDate = '') {
  const out = [];
  const today = shiftAt(new Date(nowMs), shifts).work_date;
  const seen = new Set();
  for (let i = days; i >= 0; i--) {
    const d = addDaysIso(today, -i);
    if (startDate && d < startDate) continue;
    const list = tpl.frequency === 'SHIFT' ? String(tpl.shifts || '').split(',').filter(Boolean) : [''];
    for (const sh of list) {
      const key = periodKey(tpl.frequency, d, sh);
      if (seen.has(key)) continue;
      seen.add(key);
      const per = tpl.frequency === 'WEEK' ? { date: d, last: d } : tpl.frequency === 'MONTH' ? { date: d.slice(0, 8) + '01', last: lastOfMonth(d) } : { date: d, last: d };
      const sp = periodSpan(tpl.frequency, per, sh, shifts);
      if (sp.end <= nowMs && sp.end > nowMs - (days + 1) * 86400000) out.push({ period_key: key, work_date: tpl.frequency === 'SHIFT' || tpl.frequency === 'DAY' ? d : per.date, shift: sh, end: sp.end });
    }
  }
  return out;
}

function lastOfMonth(iso) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  return `${iso.slice(0, 7)}-${p2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}
