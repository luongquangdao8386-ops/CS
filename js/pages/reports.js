// Báo cáo: phiếu kiểm tra tháng của một máy (như phiếu giấy) có logo công ty — xem trước, tải PDF (máy chủ dựng),
// tải Excel (dựng trên máy, dùng được cả khi mất mạng với tháng còn trên máy)
import { bi, biText, esc, api, resMsg, fmtDate, fmtDateTime, nameText, b64ToBytes, session } from '../core.js';
import { ICON, toast, dialog, $ } from '../ui.js';
import { recs, today, inMyAreas, users, userName } from '../data.js';
import { busy } from '../form.js';
import { shareFileNow } from '../media.js';
import { loadXlsx, workbookFile } from '../xlsx.js';
import { reportLogo, logoBytes, logoSize } from '../report-logo.js';
import { monthData, monthModel, gridHtml, cellText, ymOf, addMonths, ymLabel, scrollGridsToToday } from './month.js';

const f = { m: '', ym: '', t: '', shift: '' };

export async function renderReports(view, { shell, query }) {
  shell.setScreen({ title: 'nav.reports', wide: true });
  if (query.m) f.m = query.m;
  if (query.ym && /^\d{4}-\d{2}$/.test(query.ym)) f.ym = query.ym;
  if (!f.ym) f.ym = ymOf(today());
  const asgAll = await recs('ASSIGNMENT');
  const withAsg = new Set(asgAll.map((a) => a.machine_id));
  const macs = (await recs('MACHINE')).filter((m) => withAsg.has(m.machine_id) && inMyAreas(m.area_id))
    .sort((a, b) => String(a.machine_code).localeCompare(String(b.machine_code)));
  if (!f.m || !macs.some((m) => m.machine_id === f.m)) f.m = macs.length ? macs[0].machine_id : '';
  if (!f.m) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('month.no_machine')}</p></div>`; return; }
  const again = () => renderReports(view, { shell, query: {} });
  const tpls = (await recs('TEMPLATE')).filter((t) => asgAll.some((a) => a.machine_id === f.m && a.template_id === t.template_id));
  const head = `<div class="toolbar rp-filters">
      <select class="inp sel" id="rp-m" aria-label="${esc(biText('rpt.machine'))}">${macs.map((m) => `<option value="${esc(m.machine_id)}"${m.machine_id === f.m ? ' selected' : ''}>${esc(m.machine_code)} · ${esc(nameText(m))}</option>`).join('')}</select>
      <div class="month-nav"><button type="button" class="icon-btn" id="rp-prev" aria-label="${esc(biText('month.prev'))}">${ICON.back}</button>
        <strong>${bi('period.month', { M: ymLabel(f.ym) })}</strong>
        <button type="button" class="icon-btn" id="rp-next" aria-label="${esc(biText('month.next'))}"${f.ym >= ymOf(today()) ? ' disabled' : ''}>${ICON.chevron}</button></div>
      ${tpls.length > 1 ? `<select class="inp sel" id="rp-t"><option value="">${esc(biText('rp.all_templates'))}</option>${tpls.map((t) => `<option value="${esc(t.template_id)}"${t.template_id === f.t ? ' selected' : ''}>${esc(nameText(t))}</option>`).join('')}</select>` : ''}
      <div class="row"><button type="button" class="btn small primary" id="rp-pdf">${ICON.file}<span>${bi('rp.pdf')}</span></button>
        <button type="button" class="btn small" id="rp-xlsx">${ICON.excel}<span>${bi('rp.excel')}</span></button></div>
    </div>`;
  view.innerHTML = head + '<div class="loading"><div class="spinner small"></div></div>';
  const wire = () => {
    $('#rp-m', view).addEventListener('change', (e) => { f.m = e.target.value; f.t = ''; again(); });
    $('#rp-prev', view).addEventListener('click', () => { f.ym = addMonths(f.ym, -1); again(); });
    $('#rp-next', view).addEventListener('click', () => { f.ym = addMonths(f.ym, 1); again(); });
    const ts = $('#rp-t', view);
    if (ts) ts.addEventListener('change', (e) => { f.t = e.target.value; again(); });
  };
  wire();
  const d = await monthData(f.m, f.ym);
  if (!d.ok) {
    view.innerHTML = head + `<div class="card empty-state"><p class="muted">${d.code === 'NETWORK_ERROR' ? bi('month.need_network') : esc(resMsg(d))}</p></div>`;
    wire();
    return;
  }
  const um = await users();
  d.runs.forEach((r) => { r.__by = userName(um, r.checked_by); });
  const model = monthModel(d, f.ym, { templateId: f.t });
  const logo = await reportLogo().catch(() => null);
  const checkers = [...new Set(d.runs.map((r) => r.__by).filter(Boolean))];
  const abn = d.abnormals.slice().sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)));
  const missedRows = model.flatMap((g) => g.cols.filter((c) => c.state === 'REASON').map((c) => ({ g, c })));
  const tiles = (() => {
    const cols = model.flatMap((g) => g.cols);
    const due = cols.filter((c) => c.state).length, done = cols.filter((c) => c.run).length;
    return { due, done, rate: due ? Math.round(done / due * 100) : 0, fail: d.runs.reduce((s, r) => s + (r.fail_count || 0), 0), warn: d.runs.reduce((s, r) => s + (r.warn_count || 0), 0) };
  })();
  view.innerHTML = head + `
    ${d.source === 'server' ? `<p class="muted small">${bi('month.from_server')}</p>` : ''}
    ${logo ? '' : `<p class="muted small">${bi('rp.no_logo')}${session.user && Number(session.user.role_level) >= 4 ? ` <a href="#/admin/report-logo">${bi('admin.report_logo')}</a>` : ''}</p>`}
    <div class="paper rp-paper">
      <div class="paper-head">${logo ? `<img class="paper-logo" src="${esc(logo.url)}" alt="">` : ''}
        <div class="paper-title"><div class="pt-vi">${esc(biText('rpt.title').split(' · ')[0].toUpperCase())}</div><div class="pt-zh">${esc(biText('rpt.title').split(' · ')[1] || '')}</div></div>
        <div class="paper-meta-r small">${bi('rpt.month')}: <strong>${esc(ymLabel(f.ym))}</strong><br>${bi('rpt.generated_at')}: ${esc(fmtDateTime(new Date().toISOString()))}</div></div>
      <div class="paper-meta small"><span>${bi('rpt.machine')}: <strong>${esc(d.machine.machine_code)} · ${esc(nameText(d.machine))}</strong></span>
        <span>${bi('rpt.area')}: <strong>${esc(nameText(d.area) || '—')}</strong></span>${d.machine.model ? `<span>${bi('mac.model')}: ${esc(d.machine.model)}</span>` : ''}</div>
      <div class="paper-tiles">
        <div class="paper-tile"><span>${bi('rpt.tile_runs')}</span><strong>${tiles.done}/${tiles.due}</strong></div>
        <div class="paper-tile"><span>${bi('rpt.tile_rate')}</span><strong>${tiles.rate} %</strong></div>
        <div class="paper-tile"><span>${bi('rpt.tile_fail')}</span><strong class="t-red-text">${tiles.fail}</strong></div>
        <div class="paper-tile"><span>${bi('rpt.tile_warn')}</span><strong class="t-amber-text">${tiles.warn}</strong></div>
      </div>
      ${model.map((g) => `<h3 class="paper-sec">${esc(nameText(g.tpl))}${g.shift ? ' · ' + bi('shift.name' + g.shift) : ''} <span class="muted small">(${esc(g.tpl.template_code)} · ${bi('freq_each.' + g.tpl.frequency)})</span></h3>${gridHtml(g, { clickable: false })}`).join('') || `<p class="muted">${bi('month.no_data')}</p>`}
      <p class="muted small">${bi('rpt.legend')}</p>
      <h3 class="paper-sec">${bi('rpt.abnormals')}</h3>
      ${abn.length ? `<div class="table-wrap"><table class="tbl paper-tbl"><thead><tr><th>${bi('rp.date')}</th><th>${bi('rpt.col_item')}</th><th>${bi('pend.value')}</th><th>${bi('rpt.col_std')}</th><th>${bi('chk.note')}</th><th>${bi('pend.resolution')}</th></tr></thead>
        <tbody>${abn.map((a) => `<tr><td>${esc(fmtDate(a.work_date))}${a.shift ? ' · ' + esc(biText('shift.n', { N: a.shift })) : ''}</td><td>${esc(a.item_name_vi || a.item_name_zh)}</td><td class="t-red-text">${esc(a.value_text)}</td><td>${esc(a.std_text)}</td><td>${esc(a.note || '')}</td>
          <td>${a.status === 'RESOLVED' ? esc([a.resolution_vi, a.resolution_zh].filter(Boolean).join(' · ')) + ` <span class="muted small">(${esc(userName(um, a.resolved_by))})</span>` : `<span class="badge t-red">${bi('abn_status.OPEN')}</span>`}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted small">${bi('month.no_abn')}</p>`}
      ${missedRows.length ? `<h3 class="paper-sec">${bi('rp.missed_reasons')}</h3><div class="table-wrap"><table class="tbl paper-tbl"><tbody>${missedRows.map(({ g, c }) => `<tr><td>${esc(fmtDate(c.date))}${c.shift ? ' · ' + esc(biText('shift.n', { N: c.shift })) : ''}</td><td>${esc(nameText(g.tpl))}</td><td>${esc([c.missed.reason_vi, c.missed.reason_zh].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="paper-sign">
        <div><div>${bi('rpt.checkers')}</div><div class="sign-name">${esc(checkers.join(', ') || '—')}</div></div>
        <div><div>${bi('rpt.approved_by')}</div><div class="sign-line"></div><div class="muted small">${bi('rpt.sign_hint')}</div></div>
      </div>
    </div>`;
  wire();
  scrollGridsToToday(view);
  $('#rp-pdf', view).addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    if (!navigator.onLine) { toast(bi('sync.need_network'), 'err'); return; }
    busy(btn, true);
    const payload = { machine_id: f.m, ym: f.ym };
    if (f.t) payload.template_id = f.t;
    const r = await api('report.pdf', payload, { retry: true });
    busy(btn, false);
    if (!r.ok) { toast(esc(resMsg(r)), 'err'); return; }
    const file = new File([b64ToBytes(r.data.content_b64)], r.data.file_name, { type: r.data.mime_type || 'application/pdf' });
    offerFile(file, bi('rp.pdf_ready', { C: r.data.report_code }));
  });
  $('#rp-xlsx', view).addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    busy(btn, true);
    try {
      const file = await buildExcel(d, model, logo, um);
      busy(btn, false);
      offerFile(file, bi('rp.excel_ready'));
    } catch (e) {
      busy(btn, false);
      toast(esc(e && e.message), 'err');
    }
  });
}

/** Tệp đã sẵn sàng: iPhone chỉ mở bảng Chia sẻ trong một lần chạm mới, nên đưa nút "Mở / lưu tệp" */
function offerFile(file, titleHtml) {
  dialog({
    title: titleHtml,
    body: `<p class="muted small">${esc(file.name)}</p><button type="button" class="btn primary block" id="of-open">${ICON.download}<span>${bi('rp.open_file')}</span></button>`,
    actions: [{ label: bi('btn.close'), value: true }],
    onOpen: (w) => $('#of-open', w).addEventListener('click', () => { shareFileNow(file).catch(() => {}); })
  });
}

/** Excel: mỗi mẫu/ca một sheet như phiếu giấy (logo ở sheet đầu), thêm sheet Bất thường */
async function buildExcel(d, model, logo, um) {
  const X = await loadXlsx();
  const wb = X.utils.book_new();
  const used = new Set();
  const sheetName = (s) => {
    let n = String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Sheet';
    let k = 1, out = n;
    while (used.has(out)) out = `${n.slice(0, 25)} ${++k}`;
    used.add(out);
    return out;
  };
  const top = logo ? 4 : 0; // chừa chỗ cho logo
  const title = biText('rpt.title').toUpperCase();
  model.forEach((g) => {
    const aoa = [];
    for (let i = 0; i < top; i++) aoa.push([]);
    aoa.push([title]);
    aoa.push([`${biText('rpt.machine')}: ${d.machine.machine_code} · ${nameText(d.machine)}`, '', `${biText('rpt.area')}: ${nameText(d.area)}`]);
    aoa.push([`${biText('rpt.month')}: ${ymLabel(d.ym || f.ym)}`, '', `${nameText(g.tpl)}${g.shift ? ' · ' + biText('shift.n', { N: g.shift }) : ''} (${g.tpl.template_code})`]);
    aoa.push([]);
    aoa.push([biText('rpt.col_item'), biText('rpt.col_std'), ...g.cols.map((c) => c.label)]);
    const resBy = g.cols.map((c) => new Map(((c.run && c.run.results_json) || []).map((r) => [r.item_key, r])));
    g.rows.forEach((row) => {
      aoa.push([nameText(row), row.std_vi || '', ...g.cols.map((c, k) => {
        const r = resBy[k].get(row.item_key);
        if (!r) return c.state === 'MISSED' ? '–' : '';
        const t = cellText(r);
        const n = Number(String(t).replace(',', '.'));
        return r.input_type === 'NUMBER' && t !== '' && Number.isFinite(n) ? n : t;
      })]);
    });
    aoa.push([biText('rpt.row_checker'), '', ...g.cols.map((c) => (c.run ? c.run.__by || '' : ''))]);
    aoa.push([]);
    aoa.push([biText('rpt.legend')]);
    const ws = X.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 34 }, { wch: 22 }, ...g.cols.map(() => ({ wch: g.tpl.frequency === 'MONTH' ? 12 : 7 }))];
    X.utils.book_append_sheet(wb, ws, sheetName(`${g.tpl.template_code}${g.shift ? ' C' + g.shift : ''}`));
  });
  const ab = [[biText('rpt.abnormals')], [], [biText('rp.date'), biText('rpt.col_item'), biText('pend.value'), biText('rpt.col_std'), biText('chk.note'), biText('col.status'), biText('pend.resolution')]];
  d.abnormals.forEach((a) => ab.push([fmtDate(a.work_date) + (a.shift ? ' · ' + biText('shift.n', { N: a.shift }) : ''), nameText({ name_vi: a.item_name_vi, name_zh: a.item_name_zh }), a.value_text, a.std_text, a.note || '',
    biText('abn_status.' + a.status), [a.resolution_vi, a.resolution_zh].filter(Boolean).join(' · ') + (a.resolved_by ? ` (${userName(um, a.resolved_by)})` : '')]));
  const ws2 = X.utils.aoa_to_sheet(ab);
  ws2['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 34 }];
  X.utils.book_append_sheet(wb, ws2, sheetName(biText('rpt.abnormals').split(' · ')[0]));
  let image = null;
  if (logo) {
    const sz = await logoSize(logo, 56);
    image = { sheet: 1, bytes: logoBytes(logo), mime: logo.mime, wPx: sz.w, hPx: sz.h };
  }
  return workbookFile(X, wb, `phieu-kiem-tra_${d.machine.machine_code}_${f.ym}.xlsx`, image);
}

