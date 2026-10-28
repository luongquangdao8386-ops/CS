// Bảng tháng của một máy: iPhone là lịch + chi tiết ngày; web là bảng như phiếu giấy (hạng mục × kỳ), biểu đồ xu hướng,
// bất thường trong tháng. Tháng còn trên máy đọc ngay (cả khi mất mạng); tháng cũ hơn hỏi máy chủ (check.month).
import { bi, biText, esc, api, resMsg, fmtDate, fmtDateTime, nameText } from '../core.js';
import { ICON, $, $$ } from '../ui.js';
import { isWide } from '../shell.js';
import { recs, byId, today, nowMs, shifts, localFrom, weekday, inMyAreas, users, userName } from '../data.js';
import { monthPeriods, periodSpan, fmtNumVi, stdText, stdBounds, numOrNull } from '../judge.js';
import { stateBadge } from './home.js';

const state = { m: '', ym: '', t: '', shift: '', item: '', day: '' };

export function ymOf(iso) { return iso.slice(0, 7); }
export function addMonths(ym, n) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}
export function ymLabel(ym) { return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`; }

/**
 * Dữ liệu một tháng của một máy: {machine, area, runs, abnormals, missed, confirms, assignments, templates, items, source}
 * items: hạng mục phiên bản hiện tại theo mẫu (Map template_id → [..]) để sắp dòng.
 */
export async function monthData(machineId, ym) {
  const first = ym + '-01';
  const local = first >= localFrom() || ym === ymOf(today());
  if (!local) {
    if (!navigator.onLine) return { ok: false, code: 'NETWORK_ERROR' };
    const r = await api('check.month', { machine_id: machineId, ym }, { retry: true });
    if (!r.ok) return r;
    const d = r.data;
    const items = new Map();
    for (const ti of await recs('TEMPLATE_ITEM')) (items.get(ti.template_id) || items.set(ti.template_id, []).get(ti.template_id)).push(ti);
    return { ok: true, source: 'server', machine: d.machine, area: d.area, runs: d.runs, abnormals: d.abnormals, missed: d.missed, confirms: d.confirms, assignments: d.assignments, templates: d.templates, items };
  }
  const mac = await byId('MACHINE', machineId);
  if (!mac) return { ok: false, code: 'NOT_FOUND' };
  const inM = (r) => String(r.work_date || '').slice(0, 7) === ym;
  const assignments = (await recs('ASSIGNMENT')).filter((a) => a.machine_id === machineId);
  const runs = (await recs('RUN')).filter((r) => r.machine_id === machineId && inM(r));
  const tplIds = new Set([...assignments.map((a) => a.template_id), ...runs.map((r) => r.template_id)]);
  const items = new Map();
  for (const ti of await recs('TEMPLATE_ITEM')) if (tplIds.has(ti.template_id)) (items.get(ti.template_id) || items.set(ti.template_id, []).get(ti.template_id)).push(ti);
  return {
    ok: true, source: 'local', machine: mac, area: await byId('AREA', mac.area_id), runs,
    abnormals: (await recs('ABNORMAL')).filter((a) => a.machine_id === machineId && inM(a) && a.status !== 'CANCELLED'),
    missed: (await recs('MISSED')).filter((x) => x.machine_id === machineId && inM(x)),
    confirms: (await recs('DAY_CONFIRM')).filter((c) => inM(c) && (c.area_id === '*' || c.area_id === mac.area_id)),
    assignments, templates: (await recs('TEMPLATE')).filter((t) => tplIds.has(t.template_id)), items
  };
}

/** Trạng thái ô của một kỳ: FAIL · WARN · DONE · PARTIAL · MISSED (bỏ sót) · REASON (bỏ sót có lý do) · '' (chưa tới/chưa gán)
 * — cùng quy tắc với bảng của PDF (25_report.js): bỏ sót khi kỳ đã hết, gán còn hiệu lực và kỳ không trước ngày gán */
function cellState(run, missedRec, span, asg, per) {
  if (run) return run.status === 'PARTIAL' ? 'PARTIAL' : run.fail_count ? 'FAIL' : run.warn_count ? 'WARN' : 'DONE';
  if (missedRec) return 'REASON';
  if (span.end > nowMs()) return '';
  if (!asg || !asg.active || (asg.start_date && per.last < asg.start_date)) return '';
  return 'MISSED';
}

/**
 * Mô hình bảng: mỗi (gán mẫu, ca) một bảng: {asg, tpl, shift, rows:[{item_key, name_vi, name_zh, unit, std_vi, input_type, std}], cols:[{key,label,date,last,run,missed,state}]}
 */
export function monthModel(d, ym, { templateId = '', shift = '' } = {}) {
  const sh = shifts();
  const out = [];
  const asgByTpl = new Map(d.assignments.map((a) => [a.template_id, a]));
  for (const tpl of d.templates) {
    if (templateId && tpl.template_id !== templateId) continue;
    const asg = asgByTpl.get(tpl.template_id) || null;
    const tRuns = d.runs.filter((r) => r.template_id === tpl.template_id);
    if (!asg && !tRuns.length) continue;
    const shiftList = tpl.frequency === 'SHIFT' ? String(tpl.shifts || '').split(',').filter(Boolean) : [''];
    // Ca có lượt kiểm mà mẫu đã bỏ ca đó: vẫn hiện
    tRuns.forEach((r) => { if (tpl.frequency === 'SHIFT' && r.shift && !shiftList.includes(String(r.shift))) shiftList.push(String(r.shift)); });
    for (const s of shiftList) {
      if (shift && tpl.frequency === 'SHIFT' && s !== shift) continue;
      const runByKey = new Map(tRuns.filter((r) => tpl.frequency !== 'SHIFT' || String(r.shift) === s).map((r) => [r.period_key, r]));
      const missByKey = new Map(d.missed.filter((m) => m.template_id === tpl.template_id).map((m) => [m.period_key, m]));
      const cols = monthPeriods(tpl.frequency, ym, s).map((p) => {
        const run = runByKey.get(p.key) || null;
        const missed = missByKey.get(p.key) || null;
        const span = periodSpan(tpl.frequency, p, s, sh);
        return { ...p, shift: s, run, missed, state: cellState(run, missed, span, asg, p) };
      });
      // Dòng: hạng mục phiên bản hiện tại, thêm hạng mục chỉ có trong lượt cũ
      const rows = [];
      const seen = new Set();
      const cur = (d.items.get(tpl.template_id) || []).filter((x) => Number(x.revision) === Number(tpl.revision)).sort((a, b) => a.step_no - b.step_no);
      cur.forEach((ti) => { seen.add(ti.item_key); rows.push({ item_key: ti.item_key, name_vi: ti.name_vi, name_zh: ti.name_zh, unit: ti.unit, input_type: ti.input_type, std_vi: stdText(ti, 'vi'), std: ti }); });
      tRuns.forEach((r) => (r.results_json || []).forEach((x) => {
        if (seen.has(x.item_key)) return;
        seen.add(x.item_key);
        rows.push({ item_key: x.item_key, name_vi: x.name_vi, name_zh: x.name_zh, unit: x.unit, input_type: x.input_type, std_vi: x.std_vi, std: { ...(x.std || {}), input_type: x.input_type } });
      }));
      out.push({ asg, tpl, shift: s, rows, cols });
    }
  }
  return out;
}

/** Chữ trong một ô của bảng */
export function cellText(res) {
  if (!res) return '';
  if (res.input_type === 'PASS_FAIL') return res.pass === true ? '✓' : res.pass === false ? '✗' : '';
  if (res.input_type === 'NUMBER') return res.value === null || res.value === undefined ? '' : fmtNumVi(res.value);
  if (res.input_type === 'THREE_PHASE') return Array.isArray(res.values) ? res.values.map(fmtNumVi).join('/') : '';
  if (res.input_type === 'CHOICE') return String(res.value_text || '').split(' · ')[0];
  if (res.input_type === 'TEXT') return res.text ? '✎' : '';
  return res.value_text || '';
}

/** Bảng hạng mục × kỳ (web, xem trước báo cáo) */
export function gridHtml(g, { clickable = true } = {}) {
  const resBy = g.cols.map((c) => new Map(((c.run && c.run.results_json) || []).map((r) => [r.item_key, r])));
  const t = today();
  const tdHead = g.cols.map((c) => `<th class="gc-h${weekday(c.date) === 7 && g.tpl.frequency !== 'WEEK' && g.tpl.frequency !== 'MONTH' ? ' sun' : ''}${c.date <= t && c.last >= t ? ' today' : ''}">${esc(c.label)}</th>`).join('');
  const rowHtml = (row) => `<tr${clickable && (row.input_type === 'NUMBER' || row.input_type === 'THREE_PHASE') ? ` class="trend-row" data-item="${esc(row.item_key)}"` : ''}>
    <th class="gc-item"><span class="vi">${esc(row.name_vi || row.name_zh)}</span>${row.name_zh && row.name_vi ? `<span class="zh">${esc(row.name_zh)}</span>` : ''}</th>
    <td class="gc-std">${esc(row.std_vi || '')}</td>
    ${g.cols.map((c, k) => {
      const r = resBy[k].get(row.item_key);
      if (!r) return `<td class="gc st-${c.state ? c.state.toLowerCase() : 'none'}">${c.state === 'MISSED' ? '–' : c.state === 'REASON' ? '·' : ''}</td>`;
      const cls = r.result === 'FAIL' ? 'res-fail' : r.result === 'WARN' ? 'res-warn' : r.result === 'OK' ? 'res-ok' : '';
      return `<td class="gc ${cls}" title="${esc((r.value_text || '') + (r.note ? ' — ' + r.note : ''))}">${esc(cellText(r))}</td>`;
    }).join('')}</tr>`;
  return `<div class="table-wrap grid-wrap"><table class="tbl mgrid">
    <thead><tr><th class="gc-item">${bi('rpt.col_item')}</th><th class="gc-std">${bi('rpt.col_std')}</th>${tdHead}</tr></thead>
    <tbody>${g.rows.map(rowHtml).join('')}
      <tr class="gc-foot"><th class="gc-item" colspan="2">${bi('rpt.row_checker')}</th>${g.cols.map((c) => `<td class="gc">${c.run ? esc(initials(c.run.__by || '')) : ''}</td>`).join('')}</tr>
    </tbody></table></div>`;
}
function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  return p.length ? p[p.length - 1].slice(0, 6) : '';
}

/** Cuộn bảng tới cột hôm nay (tháng đang chạy, màn hẹp không thấy hết 31 cột) */
export function scrollGridsToToday(root) {
  root.querySelectorAll('.grid-wrap').forEach((w) => {
    const th = w.querySelector('.gc-h.today');
    if (th && w.scrollWidth > w.clientWidth) w.scrollLeft = Math.max(0, th.offsetLeft - w.clientWidth * 0.6);
  });
}

/** Biểu đồ xu hướng một hạng mục số: đường giá trị, dải tiêu chuẩn, điểm tô theo kết quả (chạm để xem số) */
export function trendSvg(g, itemKey) {
  const row = g.rows.find((r) => r.item_key === itemKey);
  if (!row) return '';
  const pts = [];
  g.cols.forEach((c, k) => {
    const r = c.run && (c.run.results_json || []).find((x) => x.item_key === itemKey);
    if (!r) return;
    let v = null;
    if (r.input_type === 'NUMBER') v = numOrNull(r.value);
    else if (Array.isArray(r.values)) { const a = r.values.map(numOrNull).filter((x) => x !== null); v = a.length ? Math.max(...a) : null; }
    if (v !== null) pts.push({ k, v, res: r.result, label: c.label, text: r.value_text, date: c.date });
  });
  if (!pts.length) return `<p class="muted small">${bi('month.trend_none')}</p>`;
  const b = stdBounds(row.std || {});
  const W = 640, H = 200, L = 44, R = 12, T = 12, B = 26;
  const vals = pts.map((p) => p.v).concat([b.min, b.max].filter((x) => x !== null));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const n = g.cols.length;
  const x = (k) => L + (n <= 1 ? 0 : (k / (n - 1)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const band = b.min !== null || b.max !== null
    ? `<rect class="tr-band" x="${L}" y="${y(b.max !== null ? b.max : hi).toFixed(1)}" width="${W - L - R}" height="${(y(b.min !== null ? b.min : lo) - y(b.max !== null ? b.max : hi)).toFixed(1)}"/>` : '';
  const lim = [b.min, b.max].filter((v) => v !== null).map((v) => `<line class="tr-lim" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tr-lim-t" x="${W - R}" y="${(y(v) - 4).toFixed(1)}" text-anchor="end">${esc(fmtNumVi(v))}</text>`).join('');
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const xl = g.cols.map((c, k) => (k % Math.max(1, Math.ceil(n / 10)) === 0 || k === n - 1 ? `<text class="tr-ax" x="${x(k).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(c.label)}</text>` : '')).join('');
  return `<figure class="trend">
    <figcaption><strong>${esc(row.name_vi || row.name_zh)}</strong>${row.name_zh && row.name_vi ? ` <span class="zh">${esc(row.name_zh)}</span>` : ''}${row.unit ? ` <span class="muted">(${esc(row.unit)})</span>` : ''}
      ${row.std_vi ? `<span class="muted small"> · ${bi('chk.std')}: ${esc(row.std_vi)}</span>` : ''}${row.input_type === 'THREE_PHASE' ? `<span class="muted small"> · ${bi('month.trend_max_phase')}</span>` : ''}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img" aria-label="${esc(biText('month.trend_aria', { N: pts.length }))}">
      ${ticks.map((t) => `<line class="tr-grid" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="tr-ax" x="${L - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(fmtNumVi(Math.round(t * 100) / 100))}</text>`).join('')}
      ${band}${lim}
      <path class="tr-line" d="${path}"/>
      ${pts.map((p) => `<g class="tr-pt" data-tip="${esc(`${p.label} · ${fmtDate(p.date)}: ${p.text || fmtNumVi(p.v)} — ${biText('res.' + p.res)}`)}">
        <circle class="tr-hit" cx="${x(p.k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="12"/>
        <circle class="tr-dot res-${String(p.res).toLowerCase()}" cx="${x(p.k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5"/></g>`).join('')}
      ${xl}
    </svg>
    <div class="trend-tip muted small" aria-live="polite">${bi('month.trend_tap')}</div>
  </figure>`;
}

function wireTrend(root) {
  $$('.trend', root).forEach((fig) => {
    const tip = $('.trend-tip', fig);
    $$('.tr-pt', fig).forEach((g) => {
      const show = () => { tip.textContent = g.dataset.tip; $$('.tr-pt.on', fig).forEach((x) => x.classList.remove('on')); g.classList.add('on'); };
      g.addEventListener('mouseenter', show);
      g.addEventListener('click', show);
    });
  });
}

/** Máy được chọn cho Bảng tháng: ?m= hoặc lần chọn trước hoặc máy đầu tiên có gán mẫu trong khu vực phụ trách */
async function machineChoices() {
  const asg = await recs('ASSIGNMENT');
  const withAsg = new Set(asg.filter((a) => a.active).map((a) => a.machine_id));
  return (await recs('MACHINE')).filter((m) => (withAsg.has(m.machine_id) || m.active) && inMyAreas(m.area_id))
    .sort((a, b) => (withAsg.has(b.machine_id) - withAsg.has(a.machine_id)) || String(a.machine_code).localeCompare(String(b.machine_code)))
    .map((m) => ({ m, assigned: withAsg.has(m.machine_id) }));
}

export async function renderMonth(view, { shell, query }) {
  shell.setScreen({ title: 'nav.month', wide: true });
  const choices = await machineChoices();
  if (query.m) state.m = query.m;
  if (query.ym && /^\d{4}-\d{2}$/.test(query.ym)) state.ym = query.ym;
  if (!state.ym) state.ym = ymOf(today());
  if (!state.m || !choices.some((c) => c.m.machine_id === state.m)) {
    const first = choices.find((c) => c.assigned);
    state.m = query.m || (first ? first.m.machine_id : '');
  }
  if (!state.m) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('month.no_machine')}</p></div>`; return; }
  const ym = state.ym;
  const again = () => renderMonth(view, { shell, query: {} });
  const go = (patch) => { Object.assign(state, patch); again(); };
  const um = await users();
  const head = `<div class="month-bar">
      <select class="inp sel" id="mo-m" aria-label="${esc(biText('rpt.machine'))}">${choices.map((c) => `<option value="${esc(c.m.machine_id)}"${c.m.machine_id === state.m ? ' selected' : ''}>${esc(c.m.machine_code)} · ${esc(nameText(c.m))}</option>`).join('')}</select>
      <div class="month-nav"><button type="button" class="icon-btn" id="mo-prev" aria-label="${esc(biText('month.prev'))}">${ICON.back}</button>
        <strong>${bi('period.month', { M: ymLabel(ym) })}</strong>
        <button type="button" class="icon-btn" id="mo-next" aria-label="${esc(biText('month.next'))}"${ym >= ymOf(today()) ? ' disabled' : ''}>${ICON.chevron}</button></div>
    </div>`;
  view.innerHTML = head + '<div class="loading"><div class="spinner small"></div></div>';
  const wireHead = () => {
    $('#mo-m', view).addEventListener('change', (e) => go({ m: e.target.value, t: '', shift: '', item: '', day: '' }));
    $('#mo-prev', view).addEventListener('click', () => go({ ym: addMonths(ym, -1), day: '' }));
    $('#mo-next', view).addEventListener('click', () => go({ ym: addMonths(ym, 1), day: '' }));
  };
  wireHead();
  const d = await monthData(state.m, ym);
  if (!d.ok) {
    view.innerHTML = head + `<div class="card empty-state"><p class="muted">${d.code === 'NETWORK_ERROR' ? bi('month.need_network') : esc(resMsg(d))}</p></div>`;
    wireHead();
    return;
  }
  d.runs.forEach((r) => { r.__by = userName(um, r.checked_by); });
  const model = monthModel(d, ym);
  const t = today();
  const srcNote = d.source === 'server' ? `<p class="muted small">${bi('month.from_server')}</p>` : '';
  if (!model.length) {
    view.innerHTML = head + `<div class="card empty-state"><p class="muted">${bi('month.no_data')}</p><a class="btn small" href="#/m/${encodeURIComponent(state.m)}">${bi('check.machine')}</a></div>`;
    wireHead();
    return;
  }
  const abn = d.abnormals.slice().sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)));
  const abnHtml = `<section class="card"><h2>${bi('rpt.abnormals')} <span class="muted">${abn.length}</span></h2>
    ${abn.length ? `<div class="abn-list">${abn.map((a) => `<div class="abn-row">
      <div class="abn-top"><span>${esc(fmtDate(a.work_date))}${a.shift ? ' · ' + bi('shift.n', { N: a.shift }) : ''}</span>${a.status === 'RESOLVED' ? `<span class="badge t-green">${bi('abn_status.RESOLVED')}</span>` : `<span class="badge t-red">${bi('abn_status.OPEN')}</span>`}</div>
      <div><strong>${esc(a.item_name_vi || a.item_name_zh)}</strong>: ${esc(a.value_text)} <span class="muted small">(${bi('chk.std')}: ${esc(a.std_text)})</span></div>
      ${a.note ? `<div class="muted small">${esc(a.note)}</div>` : ''}
      ${a.status === 'RESOLVED' ? `<div class="small">${bi('pend.resolution')}: ${esc([a.resolution_vi, a.resolution_zh].filter(Boolean).join(' · '))} — ${esc(userName(um, a.resolved_by))}</div>` : ''}</div>`).join('')}</div>` : `<p class="muted">${bi('month.no_abn')}</p>`}</section>`;

  if (isWide()) {
    // Web: chọn mẫu + ca (một bảng), biểu đồ xu hướng, bất thường
    const tabs = model.map((g, i) => ({ i, key: g.tpl.template_id + '|' + g.shift, label: `${nameText(g.tpl)}${g.shift ? ' · ' + biText('shift.n', { N: g.shift }) : ''}` }));
    let cur = tabs.find((x) => x.key === state.t + '|' + state.shift) || tabs[0];
    const g = model[cur.i];
    const runsN = g.cols.filter((c) => c.run).length, due = g.cols.filter((c) => c.state).length;
    const failN = g.cols.reduce((s, c) => s + (c.run ? c.run.fail_count || 0 : 0), 0), warnN = g.cols.reduce((s, c) => s + (c.run ? c.run.warn_count || 0 : 0), 0);
    const missN = g.cols.filter((c) => c.state === 'MISSED').length;
    if (!state.item || !g.rows.some((r) => r.item_key === state.item)) { const fr = g.rows.find((r) => r.input_type === 'NUMBER' || r.input_type === 'THREE_PHASE'); state.item = fr ? fr.item_key : ''; }
    view.innerHTML = head + srcNote + `
      ${tabs.length > 1 ? `<div class="chips">${tabs.map((x) => `<button type="button" class="chip${x === cur ? ' on' : ''}" data-tab="${esc(x.key)}">${esc(x.label)}</button>`).join('')}</div>` : ''}
      <div class="kpis small-kpis">
        <div class="kpi"><span class="kpi-label">${bi('rpt.tile_runs')}</span><span class="kpi-value">${runsN}/${due}</span></div>
        <div class="kpi"><span class="kpi-label">${bi('rpt.tile_fail')}</span><span class="kpi-value t-red-text">${failN}</span></div>
        <div class="kpi"><span class="kpi-label">${bi('rpt.tile_warn')}</span><span class="kpi-value t-amber-text">${warnN}</span></div>
        <div class="kpi"><span class="kpi-label">${bi('month.missed')}</span><span class="kpi-value">${missN}</span></div>
      </div>
      <section class="card"><div class="row between"><h2>${esc(nameText(g.tpl))}${g.shift ? ' · ' + bi('shift.name' + g.shift) : ''}</h2>
        <a class="btn small" href="#/reports?m=${encodeURIComponent(state.m)}&ym=${ym}">${ICON.reports}<span>${bi('nav.reports')}</span></a></div>
        <p class="muted small">${bi('rpt.legend')}</p>${gridHtml(g)}</section>
      ${state.item ? `<section class="card">${trendSvg(g, state.item)}<p class="muted small">${bi('month.trend_pick')}</p></section>` : ''}
      ${abnHtml}`;
    wireHead();
    $$('[data-tab]', view).forEach((b) => b.addEventListener('click', () => { const [tt, ss] = b.dataset.tab.split('|'); go({ t: tt, shift: ss, item: '' }); }));
    $$('.trend-row', view).forEach((tr) => tr.addEventListener('click', () => go({ item: tr.dataset.item })));
    $$('.trend-row', view).forEach((tr) => tr.classList.toggle('on', tr.dataset.item === state.item));
    wireTrend(view);
    scrollGridsToToday(view);
    return;
  }

  // iPhone: lịch tháng, mỗi ngày tô theo kết quả xấu nhất trong ngày; chạm ngày xem chi tiết
  const byDay = new Map();
  const rank = { FAIL: 5, MISSED: 4, PARTIAL: 3, WARN: 2, REASON: 1, DONE: 0 };
  for (const g of model) {
    if (g.tpl.frequency !== 'SHIFT' && g.tpl.frequency !== 'DAY') continue;
    for (const c of g.cols) {
      if (!c.state) continue;
      const x = byDay.get(c.date) || { worst: null, list: [] };
      x.list.push({ g, c });
      if (x.worst === null || rank[c.state] > rank[x.worst]) x.worst = c.state;
      byDay.set(c.date, x);
    }
  }
  const y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = weekday(ym + '-01') - 1;
  if (!state.day || ymOf(state.day) !== ym) state.day = ym === ymOf(t) ? t : ym + '-01';
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank"></span>');
  for (let k = 1; k <= n; k++) {
    const iso = `${ym}-${String(k).padStart(2, '0')}`;
    const x = byDay.get(iso);
    const st = x ? x.worst.toLowerCase() : (iso > t ? 'future' : 'none');
    const dots = x ? x.list.filter((e) => e.c.shift).map((e) => `<i class="dot st-${e.c.state.toLowerCase()}"></i>`).join('') : '';
    cells.push(`<button type="button" class="cal-cell st-${st}${iso === state.day ? ' sel' : ''}${iso === t ? ' today' : ''}" data-day="${iso}"><span class="cal-n">${k}</span><span class="cal-dots">${dots}</span></button>`);
  }
  // Chi tiết ngày đang chọn + các mẫu tuần/tháng
  const sel = byDay.get(state.day);
  const dayRows = (sel ? sel.list : []).map(({ g, c }) => {
    const r = c.run;
    const st = c.state === 'MISSED' ? '<span class="badge t-grey">' + bi('state.MISSED') + '</span>' : c.state === 'REASON' ? '<span class="badge t-grey">' + bi('state.REASON') + '</span>' : stateBadge(r.status === 'PARTIAL' ? { key: 'PARTIAL', filled: r.filled_count, total: r.total_count } : r.fail_count ? { key: 'FAIL', n: r.fail_count } : r.warn_count ? { key: 'WARN', n: r.warn_count } : { key: 'DONE' });
    const fails = r ? (r.results_json || []).filter((x) => x.result === 'FAIL' || x.result === 'WARN') : [];
    const href = g.asg ? `#/check/${encodeURIComponent(g.asg.assignment_id)}?d=${c.date}${c.shift ? '&s=' + c.shift : ''}` : '';
    return `<div class="day-run">
      <div class="row between"><strong>${esc(nameText(g.tpl))}${c.shift ? ' · ' + bi('shift.name' + c.shift) : ''}</strong>${st}</div>
      ${r ? `<div class="muted small">${esc(r.__by || '')} · ${esc(fmtDateTime(r.checked_at))} · ${bi('chk.filled_n', { N: r.filled_count, M: r.total_count })}</div>` : ''}
      ${c.missed ? `<div class="muted small">${bi('pend.reason')}: ${esc([c.missed.reason_vi, c.missed.reason_zh].filter(Boolean).join(' · '))}</div>` : ''}
      ${fails.map((x) => `<div class="small ${x.result === 'FAIL' ? 't-red-text' : 't-amber-text'}">${esc(x.name_vi || x.name_zh)}: ${esc(x.value_text)} (${esc(x.std_vi || '')})${x.note ? ' — ' + esc(x.note) : ''}</div>`).join('')}
      ${href && (r || c.state === 'MISSED') ? `<a class="btn tiny" href="${href}">${bi(r ? 'month.open_run' : 'month.backfill')}</a>` : ''}
    </div>`;
  }).join('');
  const longer = model.filter((g) => g.tpl.frequency === 'WEEK' || g.tpl.frequency === 'MONTH').map((g) => `<section class="card"><h3>${esc(nameText(g.tpl))} · ${bi('freq.' + g.tpl.frequency)}</h3>
    <div class="per-row">${g.cols.map((c) => `<span class="per-cell st-${(c.state || 'none').toLowerCase()}" title="${esc(c.label)}">${esc(c.label)}</span>`).join('')}</div></section>`).join('');
  view.innerHTML = head + srcNote + `<section class="card cal-card">
      <div class="cal-grid cal-head">${[1, 2, 3, 4, 5, 6, 7].map((w) => `<span>${bi('wd_short.' + w)}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="cal-legend small"><span><i class="dot st-done"></i>${bi('res.OK')}</span><span><i class="dot st-warn"></i>${bi('res.WARN')}</span><span><i class="dot st-fail"></i>${bi('res.FAIL')}</span><span><i class="dot st-missed"></i>${bi('state.MISSED')}</span></div>
    </section>
    <section class="card"><h2>${bi('weekday.' + weekday(state.day))} ${esc(fmtDate(state.day))}</h2>${dayRows || `<p class="muted">${bi('month.day_none')}</p>`}</section>
    ${longer}${abnHtml}`;
  wireHead();
  $$('[data-day]', view).forEach((b) => b.addEventListener('click', () => go({ day: b.dataset.day })));
}

