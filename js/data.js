// Dữ liệu đã tải trên máy: đọc nhanh theo loại, tra theo ID, quyền phía client (chỉ để ẩn/hiện nút),
// danh sách máy phải kiểm kỳ này, việc chờ Trưởng bộ phận (bất thường, bỏ sót, xác nhận ngày)
import { session, todayVN } from './core.js';
import { getRecords, getMeta, queueItems, KEY } from './sync.js';
import { shiftsFrom, currentPeriod, endedPeriods, periodKey, addDaysIso, shiftAt } from './judge.js';

export { KEY };

let memo = {};
let bootMeta = null;
let usersMemo = null;

/** Xóa bộ nhớ tạm sau đồng bộ, đăng xuất */
export function invalidate() { memo = {}; bootMeta = null; usersMemo = null; }

export async function recs(type) {
  if (!memo[type]) memo[type] = await getRecords(type);
  return memo[type];
}

export async function byId(type, id) {
  if (!id) return null;
  const list = await recs(type);
  const k = KEY[type];
  return list.find((r) => r[k] === id) || null;
}

/** Bản đồ id → bản ghi */
export async function mapOf(type) {
  const k = KEY[type];
  const m = new Map();
  for (const r of await recs(type)) m.set(r[k], r);
  return m;
}

export async function boot() {
  if (!bootMeta) bootMeta = (await getMeta('bootstrap')) || {};
  return bootMeta;
}

/** Action được phép theo cấp (khối permissions của bootstrap; máy chủ vẫn kiểm lại) */
export function canSync(boot0, action) {
  const p = boot0 && boot0.permissions;
  return !!(p && Array.isArray(p.actions) && p.actions.indexOf(action) >= 0);
}
export async function can(action) { return canSync(await boot(), action); }

export function roleLevel() { return Number(session.user && session.user.role_level) || 0; }
export function isOwner() { return !!(session.user && session.user.is_system_owner && roleLevel() === 4); }

/** Danh bạ người dùng (mã, tên) để hiện người kiểm, người xử lý */
export async function users() {
  if (!usersMemo) {
    usersMemo = new Map();
    for (const u of (await getMeta('users')) || []) usersMemo.set(u.user_id, u);
  }
  return usersMemo;
}
export function userName(map, id) {
  const u = map && map.get(id);
  return u ? u.display_name || u.employee_code : (id === 'SYSTEM' ? 'Hệ thống' : '');
}

/** Khu vực phụ trách của người đang đăng nhập ([] = mọi khu vực) */
export function myAreas() {
  const a = session.user && session.user.area_ids;
  if (Array.isArray(a)) return a.filter(Boolean);
  return String(a || '').split(',').map((x) => x.trim()).filter(Boolean);
}
export function inMyAreas(areaId) {
  const mine = myAreas();
  return !mine.length || mine.includes(areaId);
}

export function shifts() { return shiftsFrom(session.settings); }

/* ---------------- Ngày (giờ Việt Nam) ---------------- */

function offsetDays() { return Number(session.settings && session.settings.__today_offset_days) || 0; }
/** Hôm nay theo máy chủ (TEST_TODAY ở THỬ) nếu có, không thì theo đồng hồ máy */
export function today() {
  const off = offsetDays();
  const t = todayVN();
  return off ? addDaysIso(t, off) : t;
}
/** Thời điểm hiện tại (ms) — dời theo ngày của máy chủ ở THỬ */
export function nowMs() { return Date.now() + offsetDays() * 86400000; }
/** Ca đang chạy: {work_date, shift, def: {no,start,end}} */
export function currentShift() {
  const list = shifts();
  const at = shiftAt(new Date(nowMs()), list);
  return { ...at, def: list.find((s) => String(s.no) === at.shift) || null };
}
/** Thứ trong tuần: 1 = Thứ Hai … 7 = Chủ nhật */
export function weekday(iso) {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
/** Ngày đầu tiên có lượt kiểm trên máy (cũ hơn thì phải hỏi máy chủ: check.month) */
export function localFrom() {
  const n = Math.max(7, Number(session.settings && session.settings.runs_sync_days) || 40);
  return addDaysIso(today(), -n);
}

/* ---------------- Mẫu, gán máy ---------------- */

/** Hạng mục phiên bản hiện tại của một mẫu, theo thứ tự */
export async function templateItems(templateId) {
  const tpl = await byId('TEMPLATE', templateId);
  return (await recs('TEMPLATE_ITEM')).filter((x) => x.template_id === templateId && (!tpl || Number(x.revision) === Number(tpl.revision)))
    .sort((a, b) => (a.step_no || 0) - (b.step_no || 0));
}

/** Lượt kiểm check.submit còn trong hàng chờ của người này: Map "assignment|period" → mục hàng chờ (mới nhất) */
export async function queuedRuns() {
  const uid = session.user && session.user.user_id;
  const tpls = await mapOf('TEMPLATE');
  const asg = await mapOf('ASSIGNMENT');
  const out = new Map();
  for (const o of await queueItems().catch(() => [])) {
    if (o.action !== 'check.submit' || o.user_id !== uid || o.dataset_epoch !== session.epoch) continue;
    const p = o.payload || {};
    const a = asg.get(p.assignment_id);
    const t = a && tpls.get(a.template_id);
    if (!t) continue;
    out.set(p.assignment_id + '|' + periodKey(t.frequency, p.work_date, t.frequency === 'SHIFT' ? String(p.shift) : ''), o);
  }
  return out;
}

/** Lượt kiểm theo "assignment|period" (bản máy chủ) */
async function runIndex() {
  const m = new Map();
  for (const r of await recs('RUN')) m.set(r.assignment_id + '|' + r.period_key, r);
  return m;
}

/** Trạng thái của một lượt: TODO · LOCAL · PARTIAL · FAIL · WARN · DONE */
export function runState(run, queued) {
  if (queued && queued.state !== 'COMMITTED') {
    const p = queued.payload || {};
    return { key: 'LOCAL', filled: (p.results || []).length };
  }
  if (!run) return { key: 'TODO' };
  if (run.status === 'PARTIAL') return { key: 'PARTIAL', filled: run.filled_count, total: run.total_count };
  if (run.fail_count) return { key: 'FAIL', n: run.fail_count };
  if (run.warn_count) return { key: 'WARN', n: run.warn_count };
  return { key: 'DONE' };
}

/**
 * Máy phải kiểm trong kỳ đang chạy (trang chủ): mỗi gán mẫu còn hiệu lực của máy đang dùng, thuộc khu vực phụ trách.
 * Trả [{asg, tpl, mac, area, items, period, run, queued, state, last}]; mẫu theo ca không có ca này → period null.
 */
export async function dueList({ all = false } = {}) {
  const now = new Date(nowMs());
  const sh = shifts();
  const [tpls, macs, areas, runIdx, queued] = [await mapOf('TEMPLATE'), await mapOf('MACHINE'), await mapOf('AREA'), await runIndex(), await queuedRuns()];
  const itemsN = new Map();
  for (const ti of await recs('TEMPLATE_ITEM')) {
    const t = tpls.get(ti.template_id);
    if (t && Number(ti.revision) === Number(t.revision)) itemsN.set(ti.template_id, (itemsN.get(ti.template_id) || 0) + 1);
  }
  const lastBy = new Map();
  for (const r of await recs('RUN')) {
    const cur = lastBy.get(r.assignment_id);
    if (!cur || String(r.checked_at) > String(cur.checked_at)) lastBy.set(r.assignment_id, r);
  }
  const out = [];
  for (const a of await recs('ASSIGNMENT')) {
    if (!a.active) continue;
    const tpl = tpls.get(a.template_id), mac = macs.get(a.machine_id);
    if (!tpl || !mac || !tpl.active || !mac.active) continue;
    if (!all && !inMyAreas(mac.area_id)) continue;
    const period = currentPeriod(tpl, now, sh);
    const k = period ? a.assignment_id + '|' + period.period_key : '';
    const run = period ? runIdx.get(k) || null : null;
    const q = period ? queued.get(k) || null : null;
    const last = lastBy.get(a.assignment_id) || null;
    out.push({
      asg: a, tpl, mac, area: areas.get(mac.area_id) || null, items: itemsN.get(tpl.template_id) || 0, period, run, queued: q,
      state: runState(run, q), last: last && (!run || last.run_id !== run.run_id) ? last : null
    });
  }
  out.sort((x, y) => String(x.mac.machine_code).localeCompare(String(y.mac.machine_code)) || String(x.tpl.template_code).localeCompare(String(y.tpl.template_code)));
  return out;
}

/* ---------------- Việc chờ Trưởng bộ phận ---------------- */

/** Bất thường còn mở thuộc khu vực phụ trách, mới trước */
export async function openAbnormals() {
  const macs = await mapOf('MACHINE');
  return (await recs('ABNORMAL')).filter((x) => x.status === 'OPEN' && inMyAreas((macs.get(x.machine_id) || {}).area_id))
    .sort((a, b) => String(b.reported_at).localeCompare(String(a.reported_at)));
}

/**
 * Kỳ đã qua mà máy chưa kiểm và chưa có lý do (missed_lookback_days ngày gần nhất).
 * Trả [{asg, tpl, mac, period_key, work_date, shift}]
 */
export async function missedPeriods() {
  const days = Math.max(1, Math.min(31, Number(session.settings && session.settings.missed_lookback_days) || 7));
  const sh = shifts();
  const now = nowMs();
  const [tpls, macs, runIdx] = [await mapOf('TEMPLATE'), await mapOf('MACHINE'), await runIndex()];
  const queued = await queuedRuns();
  const reasons = new Set((await recs('MISSED')).map((m) => m.assignment_id + '|' + m.period_key));
  const out = [];
  for (const a of await recs('ASSIGNMENT')) {
    if (!a.active) continue;
    const tpl = tpls.get(a.template_id), mac = macs.get(a.machine_id);
    if (!tpl || !mac || !tpl.active || !mac.active || !inMyAreas(mac.area_id)) continue;
    for (const p of endedPeriods(tpl, now, days, sh, a.start_date || '')) {
      const k = a.assignment_id + '|' + p.period_key;
      if (runIdx.has(k) || reasons.has(k) || queued.has(k)) continue;
      out.push({ asg: a, tpl, mac, ...p });
    }
  }
  out.sort((x, y) => y.end - x.end || String(x.mac.machine_code).localeCompare(String(y.mac.machine_code)));
  return out;
}

/** Ngày có lượt kiểm trong khu vực phụ trách mà chưa xác nhận (missed_lookback_days ngày gần nhất, cả hôm nay) */
export async function unconfirmedDays() {
  const days = Math.max(1, Math.min(31, Number(session.settings && session.settings.missed_lookback_days) || 7));
  const from = addDaysIso(today(), -days);
  const macs = await mapOf('MACHINE');
  const confirms = await recs('DAY_CONFIRM');
  const mine = myAreas();
  // Người phụ trách mọi khu vực xác nhận cả ngày ('*'); người có khu vực xác nhận từng khu vực của mình
  const covered = (wd, area) => confirms.some((c) => c.work_date === wd && (c.area_id === '*' || (mine.length && c.area_id === area)));
  const by = new Map();
  for (const r of await recs('RUN')) {
    if (r.work_date < from || r.work_date > today()) continue;
    const area = (macs.get(r.machine_id) || {}).area_id || '';
    if (!inMyAreas(area) || covered(r.work_date, area)) continue;
    const d = by.get(r.work_date) || { work_date: r.work_date, runs: 0, fail: 0, warn: 0, partial: 0 };
    d.runs++;
    d.fail += r.fail_count || 0;
    d.warn += r.warn_count || 0;
    if (r.status === 'PARTIAL') d.partial++;
    by.set(r.work_date, d);
  }
  return [...by.values()].sort((a, b) => b.work_date.localeCompare(a.work_date));
}

/** Ngày đã xác nhận cho khu vực của máy → lượt kiểm ngày đó khóa sửa */
export async function dayLocked(workDate, areaId) {
  return (await recs('DAY_CONFIRM')).some((c) => c.work_date === workDate && (c.area_id === '*' || c.area_id === areaId));
}

/** Số việc chờ của Trưởng bộ phận (nút Chờ xử lý) */
export async function pendingCount() {
  if (roleLevel() < 3) return 0;
  const [a, m, d] = [await openAbnormals(), await missedPeriods(), await unconfirmedDays()];
  return a.length + m.length + d.length;
}
