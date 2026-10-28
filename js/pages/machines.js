// Thiết bị: lấy một chiều từ M&E (chỉ sửa thiết bị ở M&E). Danh sách, chi tiết máy, mẫu đã gán và kỳ này,
// gán/ngừng gán mẫu, tiêu chuẩn riêng của máy; "Cập nhật từ M&E" cho Trưởng bộ phận.
import { bi, biText, esc, uuid, nameText, fmtDateTime } from '../core.js';
import { ICON, dialog, toast, h, $, $$ } from '../ui.js';
import { isWide } from '../shell.js';
import { recs, byId, mapOf, roleLevel, boot, dueList, inMyAreas, templateItems } from '../data.js';
import { writeOnline, writeFail, showErrors, busy } from '../form.js';
import { app, afterCommit } from '../app.js';
import { overrideEditorHtml, wireOverrides, readOverride } from '../std-edit.js';
import { stateBadge, freqText } from './today.js';
import { periodLabel } from './check.js';

// Mặc định hiện mọi máy đang dùng (máy chưa gán mẫu cũng thấy, để gán mẫu)
const filt = { q: '', area: '', only: 'all' };

async function meSyncInfo() {
  const b = await boot();
  const l = b.me_link || {};
  return l.linked ? `${bi('mac.me_last')}: ${esc(fmtDateTime(l.last_sync_at) || '—')}${l.last_sync_status && l.last_sync_status !== 'OK' ? ` · <span class="t-red-text">${esc(l.last_sync_status)}</span>` : ''}` : `<span class="t-amber-text">${bi('mac.me_not_linked')}</span>`;
}

async function syncFromMe(btn) {
  busy(btn, true);
  const res = await writeOnline('machine.sync', {});
  busy(btn, false);
  if (res.ok) {
    const d = res.data || {};
    const m = d.machines || {};
    toast(d.unchanged ? bi('mac.sync_unchanged') : bi('mac.sync_done', { A: m.added || 0, U: m.updated || 0, D: m.deactivated || 0 }), 'ok');
    await afterCommit();
    return true;
  }
  writeFail(res);
  return false;
}

export async function renderMachines(view, { shell }) {
  shell.setScreen({ title: 'nav.machines', back: isWide() ? null : '/account' });
  const areas = await mapOf('AREA');
  const asg = await recs('ASSIGNMENT');
  const tpls = await mapOf('TEMPLATE');
  const nAsg = new Map();
  asg.filter((a) => a.active).forEach((a) => nAsg.set(a.machine_id, (nAsg.get(a.machine_id) || []).concat([a])));
  const all = (await recs('MACHINE')).filter((m) => inMyAreas(m.area_id));
  const q = filt.q.trim().toLowerCase();
  const list = all.filter((m) => {
    if (filt.area && m.area_id !== filt.area) return false;
    if (filt.only === 'assigned' && !nAsg.has(m.machine_id)) return false;
    if (filt.only === 'unassigned' && (nAsg.has(m.machine_id) || !m.active)) return false;
    if (filt.only === 'inactive' && m.active) return false;
    if (filt.only !== 'inactive' && !m.active) return false;
    if (q && !(m.machine_code + ' ' + nameText(m) + ' ' + (m.model || '') + ' ' + (m.category_vi || '')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => String(a.machine_code).localeCompare(String(b.machine_code)));
  const usedAreas = [...new Set(all.map((m) => m.area_id).filter(Boolean))].map((id) => areas.get(id)).filter(Boolean)
    .sort((a, b) => String(a.area_code || a.name_vi).localeCompare(String(b.area_code || b.name_vi)));
  const c3 = roleLevel() >= 3;
  const online = navigator.onLine && !app.offline;
  const tplNames = (m) => (nAsg.get(m.machine_id) || []).map((a) => tpls.get(a.template_id)).filter(Boolean).map((t) => esc(nameText(t))).join(', ');
  const rows = list.map((m) => isWide()
    ? `<tr data-href="#/m/${encodeURIComponent(m.machine_id)}"><td class="code">${esc(m.machine_code)}</td><td>${esc(nameText(m))}${m.active ? '' : ` <span class="badge t-grey">${bi('mac.inactive')}</span>`}</td>
        <td>${esc(nameText(areas.get(m.area_id)))}</td><td class="small">${tplNames(m) || `<span class="muted">${bi('mac.no_tpl')}</span>`}</td><td class="small muted">${esc(m.model || '')}</td></tr>`
    : `<a class="card rec-card link-card" href="#/m/${encodeURIComponent(m.machine_id)}">
        <div class="rec-top"><span class="code">${esc(m.machine_code)}</span>${m.active ? '' : `<span class="badge t-grey">${bi('mac.inactive')}</span>`}</div>
        <div class="rec-name">${esc(nameText(m))}</div>
        <div class="muted small">${esc(nameText(areas.get(m.area_id)))}${tplNames(m) ? ' · ' + tplNames(m) : ` · ${bi('mac.no_tpl')}`}</div></a>`).join('');
  view.innerHTML = `<div class="toolbar">
      <div class="search"><input class="inp" id="mc-q" type="search" placeholder="${esc(biText('mac.search'))}" value="${esc(filt.q)}" autocomplete="off"></div>
      <div class="row">
        <select class="inp sel" id="mc-area"><option value="">${esc(biText('mac.all_areas'))}</option>${usedAreas.map((a) => `<option value="${esc(a.area_id)}"${a.area_id === filt.area ? ' selected' : ''}>${esc(nameText(a))}</option>`).join('')}</select>
        <select class="inp sel" id="mc-only">${['all', 'assigned', 'unassigned', 'inactive'].map((k) => `<option value="${k}"${filt.only === k ? ' selected' : ''}>${esc(biText('mac.only_' + k))}</option>`).join('')}</select>
        ${c3 ? `<button type="button" class="btn small" id="mc-sync"${online ? '' : ' disabled'}>${ICON.sync}<span>${bi('mac.sync_me')}</span></button>` : ''}
      </div>
      <p class="muted small">${await meSyncInfo()} · ${bi('mac.me_hint')}</p>
    </div>
    <p class="muted small">${bi('mac.count', { N: list.length })}</p>
    <div id="mc-list">${list.length ? (isWide() ? `<div class="table-wrap"><table class="tbl clickable"><thead><tr><th>${bi('mac.code')}</th><th>${bi('mac.name')}</th><th>${bi('rpt.area')}</th><th>${bi('mac.templates')}</th><th>${bi('mac.model')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="cards">${rows}</div>`)
      : `<div class="card empty-state"><p class="muted">${bi(all.length ? 'home.none_filter' : 'mac.none')}</p></div>`}</div>`;
  const again = () => renderMachines(view, { shell });
  let t = null;
  $('#mc-q', view).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { filt.q = e.target.value; again(); }, 250); });
  $('#mc-area', view).addEventListener('change', (e) => { filt.area = e.target.value; again(); });
  $('#mc-only', view).addEventListener('change', (e) => { filt.only = e.target.value; again(); });
  $$('tr[data-href]', view).forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  const sb = $('#mc-sync', view);
  if (sb) sb.addEventListener('click', async () => { if (await syncFromMe(sb)) again(); });
  // Giữ con trỏ ở ô tìm sau khi vẽ lại
  if (filt.q) { const i = $('#mc-q', view); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

export async function renderMachine(view, { shell, params }) {
  shell.setScreen({ title: 'mac.detail', back: '/machines' });
  const mac = await byId('MACHINE', params.machine);
  if (!mac) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.not_found')}</p></div>`; return; }
  const area = await byId('AREA', mac.area_id);
  const tpls = await mapOf('TEMPLATE');
  const asgs = (await recs('ASSIGNMENT')).filter((a) => a.machine_id === mac.machine_id);
  const due = (await dueList({ all: true })).filter((d) => d.mac.machine_id === mac.machine_id);
  const c3 = roleLevel() >= 3;
  const online = navigator.onLine && !app.offline;
  const dis = online ? '' : ' disabled';
  const active = asgs.filter((a) => a.active);
  const stopped = asgs.filter((a) => !a.active);
  const asgCard = (a) => {
    const t = tpls.get(a.template_id);
    if (!t) return '';
    const d = due.find((x) => x.asg.assignment_id === a.assignment_id);
    const nOv = a.overrides_json ? Object.keys(a.overrides_json).length : 0;
    return `<div class="card asg-card">
      <div class="row between"><strong>${esc(nameText(t))}</strong>${d && d.period ? stateBadge(d.state) : (t.active ? '' : `<span class="badge t-grey">${bi('tpl.archived')}</span>`)}</div>
      <div class="muted small">${esc(t.template_code)} · ${freqText(t, d ? d.items : 0)}${d && d.period ? ' · ' + periodLabel(t.frequency, d.period.work_date, d.period.shift) : ''}${nOv ? ' · ' + bi('mac.own_std_n', { N: nOv }) : ''}</div>
      <div class="row">
        ${d && d.period && t.active ? `<a class="btn small primary" href="#/check/${encodeURIComponent(a.assignment_id)}">${ICON.checklist}<span>${bi('mac.check_now')}</span></a>` : ''}
        ${c3 ? `<button type="button" class="btn small" data-ov="${esc(a.assignment_id)}"${dis}>${ICON.edit}<span>${bi('mac.own_std')}</span></button>
          <button type="button" class="btn small" data-stop="${esc(a.assignment_id)}"${dis}>${ICON.x}<span>${bi('mac.unassign')}</span></button>` : ''}
      </div></div>`;
  };
  view.innerHTML = `<section class="card mac-card">
      <div class="mac-top"><span class="code">${esc(mac.machine_code)}</span>${mac.active ? '' : `<span class="badge t-grey">${bi('mac.inactive')}</span>`}</div>
      <div class="mac-name">${esc(nameText(mac))}</div>
      <div class="kv"><span>${bi('rpt.area')}</span><strong>${esc(nameText(area) || '—')}</strong></div>
      ${mac.category_vi || mac.category_zh ? `<div class="kv"><span>${bi('mac.category')}</span><strong>${esc(nameText(mac, 'category'))}</strong></div>` : ''}
      ${mac.model ? `<div class="kv"><span>${bi('mac.model')}</span><strong>${esc(mac.model)}</strong></div>` : ''}
      ${mac.me_status ? `<div class="kv"><span>${bi('mac.me_status')}</span><strong>${esc(mac.me_status)}</strong></div>` : ''}
      <p class="muted small">${bi('mac.from_me', { T: fmtDateTime(mac.synced_at) || '—' })}</p>
      <div class="row"><a class="btn small" href="#/month?m=${encodeURIComponent(mac.machine_id)}">${ICON.calendar}<span>${bi('nav.month')}</span></a>
        <a class="btn small" href="#/reports?m=${encodeURIComponent(mac.machine_id)}">${ICON.reports}<span>${bi('nav.reports')}</span></a></div>
    </section>
    <h2 class="sec-title">${bi('mac.templates')}</h2>
    ${active.map(asgCard).join('') || `<div class="card empty-state asg-empty"><p class="muted">${bi(c3 ? 'mac.no_tpl_c3' : 'mac.no_tpl')}</p></div>`}
    ${c3 && mac.active ? `<div class="row"><button type="button" class="btn small primary" id="mc-assign"${dis}>${ICON.plus}<span>${bi('mac.assign')}</span></button></div>` : ''}
    ${stopped.length ? `<p class="muted small">${bi('mac.stopped')}: ${stopped.map((a) => esc(nameText(tpls.get(a.template_id)))).join(', ')}</p>` : ''}
    ${online || !c3 ? '' : `<p class="banner warn">${bi('sync.need_network')}</p>`}`;
  const again = () => renderMachine(view, { shell, params });
  const ab = $('#mc-assign', view);
  if (ab) ab.addEventListener('click', async () => {
    const used = new Set(active.map((a) => a.template_id));
    const free = [...tpls.values()].filter((t) => t.active && !used.has(t.template_id)).sort((a, b) => String(a.template_code).localeCompare(String(b.template_code)));
    if (!free.length) { toast(bi('mac.assign_none')); return; }
    const tid = await dialog({
      title: bi('mac.assign'),
      body: `<label class="lbl" for="as-t">${bi('mac.pick_template')}</label><select class="inp sel" id="as-t">${free.map((t) => `<option value="${esc(t.template_id)}">${esc(t.template_code)} · ${esc(nameText(t))} (${esc(biText('freq_each.' + t.frequency))})</option>`).join('')}</select>`,
      actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('mac.assign'), kind: 'primary', read: (w) => $('#as-t', w).value }]
    });
    if (!tid) return;
    // Hiện ngay thẻ mẫu "Đang lưu…" (máy chủ Apps Script ghi mất vài giây); lỗi thì gỡ thẻ và báo
    const t = tpls.get(tid);
    const temp = h(`<div class="card asg-card saving"><div class="row between"><strong>${esc(nameText(t))}</strong><span class="badge t-navy"><span class="spinner tiny"></span> ${bi('mac.saving')}</span></div>
      <div class="muted small">${esc(t.template_code)} · ${bi('freq_each.' + t.frequency)}</div></div>`);
    const empty = view.querySelector('.asg-empty');
    if (empty) empty.replaceWith(temp); else ab.closest('.row').before(temp);
    busy(ab, true);
    const old = stopped.find((a) => a.template_id === tid);
    const res = old
      ? await writeOnline('assignment.edit', { assignment_id: old.assignment_id, active: true }, { expected_version: old.record_version })
      : await writeOnline('assignment.edit', { assignment_id: uuid(), machine_id: mac.machine_id, template_id: tid });
    if (res.ok) { toast(bi('mac.assigned_ok', { T: nameText(t) }), 'ok'); await afterCommit(); if (view.isConnected) again(); return; }
    temp.remove();
    busy(ab, false);
    writeFail(res);
  });
  $$('[data-stop]', view).forEach((b) => b.addEventListener('click', async () => {
    const a = asgs.find((x) => x.assignment_id === b.dataset.stop);
    const ok = await dialog({ title: bi('mac.unassign'), body: `<p>${bi('mac.unassign_q', { T: nameText(tpls.get(a.template_id)) })}</p>`,
      actions: [{ label: bi('btn.cancel'), value: false }, { label: bi('mac.unassign'), kind: 'danger', value: true }] });
    if (!ok) return;
    const card = b.closest('.asg-card');
    card.classList.add('saving');
    busy(b, true);
    const res = await writeOnline('assignment.edit', { assignment_id: a.assignment_id, active: false }, { expected_version: a.record_version });
    if (res.ok) { toast(bi('form.saved'), 'ok'); await afterCommit(); if (view.isConnected) again(); return; }
    card.classList.remove('saving');
    busy(b, false);
    writeFail(res);
  }));
  $$('[data-ov]', view).forEach((b) => b.addEventListener('click', async () => {
    const a = asgs.find((x) => x.assignment_id === b.dataset.ov);
    if (await overridesDialog(a, tpls.get(a.template_id))) again();
  }));
}

/** Tiêu chuẩn riêng của máy cho các hạng mục số của mẫu (vd máy cũ chạy nóng hơn: dầu ≤ 65 °C) */
async function overridesDialog(a, tpl) {
  const items = (await templateItems(tpl.template_id)).filter((x) => x.input_type === 'NUMBER' || x.input_type === 'THREE_PHASE');
  if (!items.length) { toast(bi('ov.no_numeric')); return false; }
  const ov = a.overrides_json || {};
  const v = await dialog({
    title: `${bi('mac.own_std')} · ${esc(nameText(tpl))}`, wide: true,
    body: `<p class="muted small">${bi('ov.hint')}</p>${items.map((ti, i) => overrideEditorHtml(ti, ov[ti.item_key], i)).join('')}<p class="form-err err"></p>`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.save'), kind: 'primary', read: (w) => w }],
    onOpen: (w) => wireOverrides(w),
    keepOpen: async (w) => {
      const errs = [];
      const out = {};
      $$('.ov', w).forEach((box) => { const o = readOverride(box, errs); if (o) out[box.dataset.key] = o; });
      if (errs.length) { showErrors(w, errs); toast(bi('form.fix_errors'), 'err'); return false; }
      const res = await writeOnline('assignment.edit', { assignment_id: a.assignment_id, overrides: out }, { expected_version: a.record_version });
      if (res.ok) return true;
      if (res.code === 'VALIDATION_ERROR') { showErrors(w, (res.errors || []).map((e) => ({ ...e, field: String(e.field || '').replace(/^overrides\.[^.]+\./, '') }))); $('.form-err', w).textContent = (res.errors || []).map((e) => e.message_vi || e.code).join(' · '); return false; }
      writeFail(res);
      return false;
    }
  });
  if (!v) return false;
  toast(bi('form.saved'), 'ok');
  await afterCommit();
  return true;
}

