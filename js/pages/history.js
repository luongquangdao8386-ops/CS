// Lịch sử kiểm: các lượt kiểm gần đây của mọi máy trong khu vực phụ trách (còn trên máy: runs_sync_days ngày gần nhất),
// lọc theo kết quả, khu vực, ô tìm (mã/tên máy, người kiểm); bấm một lượt để mở phiếu
import { bi, biText, esc, fmtDateTime, fmtDate, nameText } from '../core.js';
import { ICON, setViewHtml, wireSearch, freshFilters, listChunk, wireMore, $, $$ } from '../ui.js';
import { isWide } from '../shell.js';
import { recs, mapOf, inMyAreas, users, userName, localFrom, queuedRuns } from '../data.js';
import { stateBadge } from './today.js';
import { periodLabel } from './check.js';

const INIT = { q: '', res: 'all', area: '' };
const f = { ...INIT };

function runState(r) {
  if (r.status === 'PARTIAL') return { key: 'PARTIAL', filled: r.filled_count, total: r.total_count };
  if (r.fail_count) return { key: 'FAIL', n: r.fail_count };
  if (r.warn_count) return { key: 'WARN', n: r.warn_count };
  return { key: 'DONE' };
}

export async function renderHistory(view, ctx) {
  const { shell } = ctx;
  shell.setScreen({ title: 'hist.title', back: '/' });
  freshFilters(ctx, f, INIT);
  const [macs, tpls, areas, um] = [await mapOf('MACHINE'), await mapOf('TEMPLATE'), await mapOf('AREA'), await users()];
  const queued = [...(await queuedRuns()).values()].filter((o) => o.state !== 'COMMITTED').map((o) => o.payload.run_id);
  const all = (await recs('RUN')).filter((r) => { const m = macs.get(r.machine_id); return m && inMyAreas(m.area_id); })
    .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const q = f.q.trim().toLowerCase();
  const pick = { all: () => true, fail: (r) => r.fail_count > 0, warn: (r) => !r.fail_count && r.warn_count > 0, ok: (r) => r.status === 'DONE' && !r.fail_count && !r.warn_count, partial: (r) => r.status === 'PARTIAL' };
  const list = all.filter((r) => {
    const m = macs.get(r.machine_id);
    if (f.area && m.area_id !== f.area) return false;
    if (!pick[f.res](r)) return false;
    if (q && !`${m.machine_code} ${nameText(m)} ${userName(um, r.checked_by)}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const n = (k) => all.filter(pick[k]).length;
  const usedAreas = [...new Set(all.map((r) => macs.get(r.machine_id).area_id).filter(Boolean))].map((id) => areas.get(id)).filter(Boolean);
  const { shown, more } = listChunk('history', list, JSON.stringify(f));
  const href = (r) => `#/check/${encodeURIComponent(r.assignment_id)}?d=${r.work_date}${r.shift ? '&s=' + r.shift : ''}`;
  const failNames = (r) => (r.results_json || []).filter((x) => x.result === 'FAIL').map((x) => x.name_vi || x.name_zh);
  const rows = isWide()
    ? `<div class="table-wrap"><table class="tbl clickable"><thead><tr><th>${bi('hist.checked_at')}</th><th>${bi('home.col_period')}</th><th>${bi('mac.code')}</th><th>${bi('mac.name')}</th><th>${bi('check.template')}</th><th>${bi('col.status')}</th><th>${bi('hist.fail_items')}</th><th>${bi('rpt.row_checker')}</th></tr></thead>
      <tbody>${shown.map((r) => { const m = macs.get(r.machine_id), t = tpls.get(r.template_id); return `<tr data-href="${href(r)}">
        <td>${esc(fmtDateTime(r.checked_at))}</td><td>${t ? periodLabel(t.frequency, r.work_date, r.shift) : esc(fmtDate(r.work_date))}</td><td class="code">${esc(m.machine_code)}</td><td>${esc(nameText(m))}</td>
        <td>${esc(nameText(t))}</td><td>${stateBadge(runState(r))}</td><td class="small t-red-text">${esc(failNames(r).join(', '))}</td><td>${esc(userName(um, r.checked_by))}</td></tr>`; }).join('')}</tbody></table></div>`
    : `<div class="due-list">${shown.map((r) => { const m = macs.get(r.machine_id), t = tpls.get(r.template_id), st = runState(r); return `<a class="due-item st-${st.key.toLowerCase()}" href="${href(r)}">
        <div class="due-main"><div class="due-top"><span class="code">${esc(m.machine_code)}</span>${stateBadge(st)}</div>
        <div class="due-name">${esc(nameText(m))}</div>
        <div class="muted small">${t ? periodLabel(t.frequency, r.work_date, r.shift) : ''} · ${esc(nameText(t))}</div>
        <div class="muted small">${esc(userName(um, r.checked_by))} · ${esc(fmtDateTime(r.checked_at))}</div>
        ${failNames(r).length ? `<div class="small t-red-text">${esc(failNames(r).join(', '))}</div>` : ''}</div>${ICON.chevron}</a>`; }).join('')}</div>`;
  const chips = [['all', 'home.f_all'], ['fail', 'state_short.FAIL'], ['warn', 'state_short.WARN'], ['ok', 'state_short.DONE'], ['partial', 'hist.partial']];
  setViewHtml(view, `<div class="toolbar">
      <div class="search"><input class="inp" id="hs-q" type="search" placeholder="${esc(biText('hist.search'))}" value="${esc(f.q)}" autocomplete="off"></div>
      ${usedAreas.length > 1 ? `<div class="row"><select class="inp sel" id="hs-area"><option value="">${esc(biText('mac.all_areas'))}</option>${usedAreas.map((a) => `<option value="${esc(a.area_id)}"${a.area_id === f.area ? ' selected' : ''}>${esc(nameText(a))}</option>`).join('')}</select></div>` : ''}
      <div class="chips">${chips.map(([k, l]) => `<button type="button" class="chip${f.res === k ? ' on' : ''}" data-res="${k}">${bi(l)} <b>${n(k)}</b></button>`).join('')}</div>
    </div>
    <p class="muted small">${bi('hist.window', { D: fmtDate(localFrom()) })}${queued.length ? ' · ' + bi('hist.queued_n', { N: queued.length }) : ''}</p>
    ${list.length ? rows + more : `<div class="card empty-state"><p class="muted">${bi(all.length ? 'home.none_filter' : 'hist.none')}</p></div>`}`);
  const again = () => renderHistory(view, ctx);
  wireSearch(view, '#hs-q', (v) => { f.q = v; }, again);
  const ar = $('#hs-area', view);
  if (ar) ar.onchange = (e) => { f.area = e.target.value; again(); };
  $$('[data-res]', view).forEach((b) => { b.onclick = () => { f.res = b.dataset.res; again(); }; });
  $$('tr[data-href]', view).forEach((tr) => { tr.onclick = () => { location.hash = tr.dataset.href; }; });
  wireMore(view, again);
}
