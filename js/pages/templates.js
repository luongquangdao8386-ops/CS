// Mẫu checksheet (Trưởng bộ phận, Quản trị): danh sách, sửa mẫu (tần suất, ca, hạng mục từ thư viện, tiêu chuẩn), gán cho
// nhiều máy, ngừng dùng; thư viện hạng mục. Sửa hạng mục = phiên bản mới; lượt kiểm cũ giữ tiêu chuẩn lúc kiểm.
import { bi, biText, esc, uuid, nameText, biName, api, resMsg } from '../core.js';
import { ICON, dialog, toast, $, $$ } from '../ui.js';
import { isWide } from '../shell.js';
import { recs, byId, mapOf, roleLevel, shifts, templateItems, inMyAreas } from '../data.js';
import { bilingualInputs, wireForm, showErrors, writeOnline, writeWithPin, writeFail, busy } from '../form.js';
import { app, afterCommit } from '../app.js';
import { navigate } from '../router.js';
import { itemEditorHtml, readItem, wireItems, GROUPS } from '../std-edit.js';
import { stdText } from '../judge.js';

const FREQS = ['SHIFT', 'DAY', 'WEEK', 'MONTH'];
let showArchived = false;

function needC3(view) {
  if (roleLevel() >= 3) return false;
  view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.forbidden')}</p></div>`;
  return true;
}

export function freqLabel(tpl) {
  const s = tpl.frequency === 'SHIFT' && tpl.shifts ? ' · ' + String(tpl.shifts).split(',').map((x) => biText('shift.n', { N: x })).join(', ') : '';
  return `${bi('freq_each.' + tpl.frequency)}${esc(s)}`;
}

export async function renderTemplates(view, { shell }) {
  shell.setScreen({ title: 'nav.templates', back: '/account' });
  if (needC3(view)) return;
  const tpls = (await recs('TEMPLATE')).filter((t) => showArchived || t.active).sort((a, b) => String(a.template_code).localeCompare(String(b.template_code)));
  const asg = await recs('ASSIGNMENT');
  const items = await recs('TEMPLATE_ITEM');
  const all = await recs('TEMPLATE');
  const archivedN = all.filter((t) => !t.active).length;
  const nItems = (t) => items.filter((x) => x.template_id === t.template_id && Number(x.revision) === Number(t.revision)).length;
  const nMac = (t) => asg.filter((a) => a.template_id === t.template_id && a.active).length;
  const online = navigator.onLine && !app.offline;
  const rows = tpls.map((t) => isWide()
    ? `<tr data-href="#/templates/${encodeURIComponent(t.template_id)}"><td class="code">${esc(t.template_code)}${t.form_code ? `<div class="muted small">${esc(t.form_code)}</div>` : ''}</td><td>${biName(t)}${t.active ? '' : ` <span class="badge t-grey">${bi('tpl.archived')}</span>`}</td>
        <td>${freqLabel(t)}</td><td class="num">${nItems(t)}</td><td class="num">${nMac(t)}</td><td class="num">${t.revision}</td></tr>`
    : `<a class="card rec-card link-card" href="#/templates/${encodeURIComponent(t.template_id)}">
        <div class="rec-top"><span class="code">${esc(t.template_code)}${t.form_code ? ` <span class="muted small">· ${esc(t.form_code)}</span>` : ''}</span>${t.active ? '' : `<span class="badge t-grey">${bi('tpl.archived')}</span>`}</div>
        <div class="rec-name">${biName(t)}</div>
        <div class="muted small">${freqLabel(t)} · ${bi('home.items_n', { N: nItems(t) })} · ${bi('tpl.machines_n', { N: nMac(t) })} · ${bi('rpt.revision', { N: t.revision })}</div></a>`).join('');
  view.innerHTML = `<div class="toolbar"><div class="row">
      <a class="btn small primary${online ? '' : ' disabled'}" href="#/templates/new">${ICON.plus}<span>${bi('tpl.new')}</span></a>
      <a class="btn small" href="#/templates/library">${ICON.library}<span>${bi('tpl.library')}</span></a>
      <button type="button" class="btn small" id="tp-iso"${online ? '' : ' disabled'}>${ICON.plus}<span>${bi('tpl.iso_btn')}</span></button>
      ${archivedN ? `<button type="button" class="btn small" id="tp-arch">${bi(showArchived ? 'tpl.hide_archived' : 'tpl.show_archived', { N: archivedN })}</button>` : ''}</div></div>
    ${online ? '' : `<p class="banner warn">${bi('sync.need_network')}</p>`}
    <p class="muted small">${bi('tpl.list_hint')}</p>
    ${tpls.length ? (isWide() ? `<div class="table-wrap"><table class="tbl clickable"><thead><tr><th>${bi('tpl.code')}</th><th>${bi('tpl.name')}</th><th>${bi('tpl.frequency')}</th><th>${bi('tpl.items')}</th><th>${bi('tpl.machines')}</th><th>${bi('tpl.revision')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="cards">${rows}</div>`)
      : `<div class="card empty-state"><p class="muted">${bi('tpl.none')}</p></div>`}`;
  $$('tr[data-href]', view).forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  const ab = $('#tp-arch', view);
  if (ab) ab.addEventListener('click', () => { showArchived = !showArchived; renderTemplates(view, { shell }); });
  $('#tp-iso', view).addEventListener('click', async (ev) => { if (await isoDialog(ev.currentTarget)) renderTemplates(view, { shell }); });
}

/**
 * Bộ mẫu theo biểu ISO cơ điện (BM-CĐ-xx): máy chủ giữ sẵn nội dung; chọn mẫu → PIN → tạo (chưa gán máy).
 * Mẫu đã tạo (kể cả đã ngừng) không tạo lại.
 */
async function isoDialog(btn) {
  busy(btn, true);
  const r = await api('template.isoList', {}, { retry: true });
  busy(btn, false);
  if (!r.ok) { toast(esc(resMsg(r)), 'err'); return false; }
  const list = r.data.templates || [];
  const left = list.filter((t) => !t.exists);
  const row = (t) => `<label class="check lib-pick iso-pick"><input type="checkbox" value="${esc(t.key)}"${t.exists ? ' disabled' : ' checked'}>
    <span><span class="code">${esc(t.form_code)}</span> ${esc(nameText(t))}
    <span class="muted small"> · ${bi('freq_each.' + t.frequency)} · ${bi('home.items_n', { N: t.items })}${t.exists ? ` · <span class="badge t-grey">${bi('tpl.iso_exists', { C: t.template_code })}</span>` : ''}</span></span></label>`;
  const keys = await dialog({
    title: bi('tpl.iso_title'),
    wide: true,
    body: `<p class="muted small">${bi('tpl.iso_hint')}</p>
      ${r.data.migrated === false ? `<p class="banner warn" id="iso-migrate">${bi('tpl.iso_migrate')}</p>` : ''}
      ${left.length ? `<label class="check"><input type="checkbox" id="iso-all" checked><span>${bi('tpl.iso_all', { N: left.length })}</span></label>` : `<p class="muted">${bi('tpl.iso_none_left')}</p>`}
      <div class="lib-list" id="iso-list">${list.map(row).join('')}</div>`,
    actions: [{ label: bi('btn.cancel'), value: null }].concat(left.length && r.data.migrated !== false
      ? [{ label: bi('tpl.iso_create'), kind: 'primary', read: (w) => $$('#iso-list input:checked', w).map((i) => i.value) }] : []),
    onOpen: (w) => {
      const all = $('#iso-all', w);
      if (all) all.addEventListener('change', () => { $$('#iso-list input:not([disabled])', w).forEach((i) => { i.checked = all.checked; }); });
    }
  });
  if (!keys || !keys.length) return false;
  busy(btn, true);
  const res = await writeWithPin('template.isoSeed', { keys });
  busy(btn, false);
  if (res.ok) { toast(bi('tpl.iso_created', { N: (res.data.created || []).length }), 'ok'); await afterCommit(); return true; }
  writeFail(res);
  return false;
}

/** Chọn hạng mục từ thư viện (nhiều mục một lần) */
async function pickFromLibrary() {
  const lib = (await recs('LIBRARY_ITEM')).filter((x) => x.active !== false).sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  const body = GROUPS.map((g) => {
    const list = lib.filter((x) => (x.group_key || 'OTHER') === g);
    if (!list.length) return '';
    return `<h3 class="lib-group">${bi('grp.' + g)}</h3>${list.map((x) => `<label class="check lib-pick"><input type="checkbox" value="${esc(x.item_id)}"><span>${esc(x.name_vi || x.name_zh)}${x.name_zh && x.name_vi ? ` <span class="zh">${esc(x.name_zh)}</span>` : ''}
      <span class="muted small"> · ${bi('input_type.' + x.input_type)}${stdText(x, 'vi') ? ' · ' + esc(stdText(x, 'vi')) : ''}</span></span></label>`).join('')}`;
  }).join('');
  const ids = await dialog({
    title: bi('tpl.add_from_lib'),
    body: `<p class="muted small">${bi('tpl.lib_hint')}</p><div class="lib-list">${body}</div>`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('tpl.add_selected'), kind: 'primary', read: (w) => $$('input[type=checkbox]:checked', w).map((i) => i.value) }]
  });
  if (!ids || !ids.length) return [];
  return ids.map((id) => {
    const x = lib.find((l) => l.item_id === id);
    const it = { ...x, library_item_id: x.item_id, item_key: '', required: true, photo_on_fail: false };
    delete it.item_id;
    return it;
  });
}

export async function renderTemplateForm(view, { shell, params }) {
  const isNew = !params.id;
  const tpl = isNew ? null : await byId('TEMPLATE', params.id);
  shell.setScreen({ title: isNew ? 'tpl.new' : 'tpl.edit', back: '/templates' });
  if (needC3(view)) return;
  if (!isNew && !tpl) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.not_found')}</p></div>`; return; }
  const sh = shifts();
  const items = isNew ? [] : (await templateItems(tpl.template_id)).map((x) => ({ ...x }));
  const id = isNew ? uuid() : tpl.template_id;
  let freq = tpl ? tpl.frequency : 'SHIFT';
  const curShifts = tpl ? String(tpl.shifts || '').split(',').filter(Boolean) : sh.map((s) => String(s.no));
  const asg = isNew ? [] : (await recs('ASSIGNMENT')).filter((a) => a.template_id === id && a.active);
  const macs = await mapOf('MACHINE');
  const online = navigator.onLine && !app.offline;

  view.innerHTML = `<div class="tpl-form">
    <section class="card">
      ${isNew ? '' : `<div class="row between"><span class="code">${esc(tpl.template_code)}</span><span class="muted small">${bi('rpt.revision', { N: tpl.revision })} · ${bi('tpl.machines_n', { N: asg.length })}</span></div>`}
      ${bilingualInputs('name', tpl, { labelKey: 'tpl.name', maxlength: 120 })}
      <div class="form-grid">
        <div class="fld" data-field="frequency"><label for="f-frequency">${bi('tpl.frequency')} <span class="req">*</span></label>
          <select class="inp sel" id="f-frequency">${FREQS.map((f) => `<option value="${f}"${f === freq ? ' selected' : ''}>${esc(biText('freq_each.' + f))}</option>`).join('')}</select><div class="ferr"></div></div>
        <div class="fld" data-field="shifts" id="shift-box"${freq === 'SHIFT' ? '' : ' hidden'}><label>${bi('tpl.shifts')}</label>
          <div class="row">${sh.map((s) => `<label class="check"><input type="checkbox" data-shift="${s.no}"${curShifts.includes(String(s.no)) ? ' checked' : ''}><span>${bi('shift.name' + s.no)} <span class="muted small">${esc(s.start)}–${esc(s.end)}</span></span></label>`).join('')}</div><div class="ferr"></div></div>
      </div>
      <div class="fld" data-field="form_code"><label for="f-form_code">${bi('tpl.form_code')}</label>
        <input class="inp" id="f-form_code" maxlength="40" autocomplete="off" value="${esc(tpl ? tpl.form_code || '' : '')}" placeholder="BM-CĐ-07-02"><div class="muted small">${bi('tpl.form_code_hint')}</div><div class="ferr"></div></div>
      ${bilingualInputs('note', tpl, { labelKey: 'tpl.note', required: false, maxlength: 300, area: true })}
      ${isNew ? '' : `<p class="muted small">${bi('tpl.revision_hint')}</p>`}
    </section>
    <h2 class="sec-title">${bi('tpl.items')} <span class="muted" id="tp-count"></span></h2>
    <div id="tp-items"></div>
    <div class="row"><button type="button" class="btn small" id="tp-lib">${ICON.library}<span>${bi('tpl.add_from_lib')}</span></button>
      <button type="button" class="btn small" id="tp-blank">${ICON.plus}<span>${bi('tpl.add_blank')}</span></button></div>
    <p class="form-err err"></p>
    <div class="row form-actions"><button type="button" class="btn primary" id="tp-save"${online ? '' : ' disabled'}>${bi('btn.save')}</button>
      <a class="btn" href="#/templates">${bi('btn.cancel')}</a></div>
    ${online ? '' : `<p class="banner warn">${bi('sync.need_network')}</p>`}
    ${isNew ? '' : `<section class="card"><h2>${bi('tpl.assigned')}</h2>
      ${asg.length ? `<div class="chips">${asg.map((a) => { const m = macs.get(a.machine_id); return m ? `<a class="chip" href="#/m/${encodeURIComponent(m.machine_id)}">${esc(m.machine_code)}</a>` : ''; }).join('')}</div>` : `<p class="muted">${bi('tpl.assigned_none')}</p>`}
      <div class="row"><button type="button" class="btn small primary" id="tp-assign"${online && tpl.active ? '' : ' disabled'}>${ICON.plus}<span>${bi('tpl.assign')}</span></button>
        <button type="button" class="btn small${tpl.active ? ' danger' : ''}" id="tp-archive"${online ? '' : ' disabled'}>${ICON.archive}<span>${bi(tpl.active ? 'tpl.archive' : 'tpl.unarchive')}</span></button></div>
      <p class="muted small">${bi('tpl.archive_hint')}</p></section>`}
  </div>`;
  wireForm(view);
  const box = $('#tp-items', view);
  // Ô đang mở (đang sửa) giữ mở qua các lần vẽ lại; hạng mục cũ thu gọn, hạng mục mới thêm thì mở
  const open = new Set();
  // Đọc lại các ô đang sửa trước mỗi lần vẽ lại danh sách (thêm/xóa/đổi thứ tự): sửa tại chỗ để giữ đúng đối tượng trong `open`
  const sync = () => { $$('.ie', box).forEach((b, i) => { Object.assign(items[i], readItem(b, [])); if (b.classList.contains('closed')) open.delete(items[i]); else open.add(items[i]); }); };
  const draw = () => {
    box.innerHTML = items.map((it, i) => itemEditorHtml(it, i, { move: true, del: true, count: items.length, closed: !open.has(it) })).join('') || `<div class="card empty-state"><p class="muted">${bi('tpl.no_items')}</p></div>`;
    $('#tp-count', view).textContent = items.length ? `(${items.length})` : '';
    wireItems(box);
  };
  draw();
  box.addEventListener('click', (e) => {
    const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]'), del = e.target.closest('[data-del]');
    if (!up && !down && !del) return;
    sync();
    if (up) { const i = Number(up.dataset.up); [items[i - 1], items[i]] = [items[i], items[i - 1]]; }
    if (down) { const i = Number(down.dataset.down); [items[i + 1], items[i]] = [items[i], items[i + 1]]; }
    if (del) items.splice(Number(del.dataset.del), 1);
    draw();
  });
  $('#f-frequency', view).addEventListener('change', (e) => { freq = e.target.value; $('#shift-box', view).hidden = freq !== 'SHIFT'; });
  $('#tp-lib', view).addEventListener('click', async () => { sync(); const add = await pickFromLibrary(); add.forEach((x) => open.add(x)); items.push(...add); draw(); });
  $('#tp-blank', view).addEventListener('click', () => {
    sync();
    const blank = { item_key: '', name_vi: '', name_zh: '', group_key: 'OTHER', input_type: 'NUMBER', std_type: 'RANGE', required: true };
    open.add(blank);
    items.push(blank);
    draw();
    const last = $$('.ie', box).pop();
    if (last) { last.scrollIntoView({ block: 'center' }); $('[data-k="name_vi"]', last).focus(); }
  });
  $('#tp-save', view).addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    sync();
    const errs = [];
    const its = $$('.ie', box).map((b, i) => readItem(b, errs, 'items.' + i + '.'));
    const p = {
      template_id: id, name_vi: $('#f-name_vi', view).value.trim(), name_zh: $('#f-name_zh', view).value.trim(),
      note_vi: $('#f-note_vi', view).value.trim(), note_zh: $('#f-note_zh', view).value.trim(),
      form_code: $('#f-form_code', view).value.trim(),
      frequency: $('#f-frequency', view).value, shifts: $$('[data-shift]', view).filter((c) => c.checked).map((c) => c.dataset.shift), items: its
    };
    if (!p.name_vi && !p.name_zh) errs.push({ field: 'name', key: 'field.one_lang' });
    if (p.frequency === 'SHIFT' && !p.shifts.length) errs.push({ field: 'shifts', key: 'tpl.shifts_required' });
    if (!its.length) errs.push({ field: 'items', key: 'tpl.items_required' });
    its.forEach((it, i) => { if (!it.name_vi && !it.name_zh) errs.push({ field: 'items.' + i + '.name_vi', key: 'field.one_lang' }); });
    if (errs.length) { showItemErrors(view, errs); return; }
    busy(btn, true);
    const res = await writeOnline('template.edit', p, { expected_version: tpl ? tpl.record_version : 0 });
    busy(btn, false);
    if (res.ok) {
      const d = res.data || {};
      toast(d.new_revision && !isNew ? bi('tpl.saved_rev', { N: d.template ? d.template.revision : '' }) : bi('form.saved'), 'ok');
      await afterCommit();
      navigate('/templates/' + encodeURIComponent(id), { replace: true });
      return;
    }
    if (res.code === 'VALIDATION_ERROR') { showItemErrors(view, res.errors || []); return; }
    writeFail(res);
  });
  const as = $('#tp-assign', view);
  if (as) as.addEventListener('click', async () => { if (await assignDialog(tpl, asg)) renderTemplateForm(view, { shell, params }); });
  const ar = $('#tp-archive', view);
  if (ar) ar.addEventListener('click', async () => {
    const ok = await dialog({ title: bi(tpl.active ? 'tpl.archive' : 'tpl.unarchive'), body: `<p>${bi(tpl.active ? 'tpl.archive_q' : 'tpl.unarchive_q')}</p>`,
      actions: [{ label: bi('btn.cancel'), value: false }, { label: bi(tpl.active ? 'tpl.archive' : 'tpl.unarchive'), kind: tpl.active ? 'danger' : 'primary', value: true }] });
    if (!ok) return;
    const res = await writeOnline('template.archive', { template_id: tpl.template_id, active: !tpl.active }, { expected_version: tpl.record_version });
    if (res.ok) { toast(bi('form.saved'), 'ok'); await afterCommit(); renderTemplateForm(view, { shell, params }); return; }
    writeFail(res);
  });
}

/** Lỗi theo trường của máy chủ: "items.3.std_max" → ô của hạng mục 3 */
function showItemErrors(view, errors) {
  const general = [];
  $$('.ferr', view).forEach((e) => { e.textContent = ''; });
  $$('.bad', view).forEach((e) => e.classList.remove('bad'));
  let first = null;
  for (const e of errors) {
    const m = /^items\.(\d+)\.(.+)$/.exec(e.field || '');
    const msg = e.message_vi ? `${e.message_vi} · ${e.message_zh || ''}` : biText(e.key || e.code);
    let box = null;
    if (m) {
      const card = $(`.ie[data-ie="${m[1]}"]`, view);
      if (card) card.classList.remove('closed');
      const f = m[2] === 'name' ? 'name_vi' : m[2];
      box = card && ($(`[data-field="${f}"] > .ferr`, card) || $('.ie-preview', card));
    } else box = $(`[data-field="${(e.field || '').replace(/_(vi|zh)$/, '')}"] > .ferr`, view) || $(`[data-field="${e.field}"] > .ferr`, view);
    if (box) { box.textContent = msg; (box.closest('.fld, .bi-pair, .ie') || box).classList.add('bad'); if (!first) first = box; } else general.push(msg);
  }
  $('.form-err', view).textContent = general.join(' · ');
  if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  toast(bi('form.fix_errors'), 'err');
}

/** Gán mẫu cho nhiều máy một lần (lọc theo khu vực, tìm theo mã/tên) */
async function assignDialog(tpl, asg) {
  const have = new Set(asg.map((a) => a.machine_id));
  const areas = await mapOf('AREA');
  const list = (await recs('MACHINE')).filter((m) => m.active && !have.has(m.machine_id) && inMyAreas(m.area_id))
    .sort((a, b) => String(a.machine_code).localeCompare(String(b.machine_code)));
  if (!list.length) { toast(bi('tpl.assign_none_left')); return false; }
  const ids = await dialog({
    title: `${bi('tpl.assign')} · ${esc(nameText(tpl))}`,
    body: `<input class="inp" id="as-q" placeholder="${esc(biText('mac.search'))}" autocomplete="off">
      <div class="lib-list" id="as-list">${list.map((m) => `<label class="check lib-pick" data-q="${esc((m.machine_code + ' ' + nameText(m) + ' ' + nameText(areas.get(m.area_id))).toLowerCase())}"><input type="checkbox" value="${esc(m.machine_id)}"><span><span class="code">${esc(m.machine_code)}</span> ${esc(nameText(m))} <span class="muted small">${esc(nameText(areas.get(m.area_id)))}</span></span></label>`).join('')}</div>`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('tpl.assign'), kind: 'primary', read: (w) => $$('#as-list input:checked', w).map((i) => i.value) }],
    onOpen: (w) => { const q = $('#as-q', w); q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); $$('[data-q]', w).forEach((l) => { l.hidden = !!t && !l.dataset.q.includes(t); }); }); }
  });
  if (!ids || !ids.length) return false;
  const btn = document.getElementById('tp-assign');
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  toast(`<span class="spinner tiny"></span> ${bi('tpl.assigning', { N: ids.length })}`);
  const res = await writeOnline('assignment.add', { template_id: tpl.template_id, machine_ids: ids });
  if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
  if (res.ok) { toast(bi('tpl.assigned_n', { N: (res.data.added || 0) + (res.data.reactivated || 0) }), 'ok'); await afterCommit(); return true; }
  writeFail(res);
  return false;
}

/* ---------------- Thư viện hạng mục ---------------- */

export async function renderLibrary(view, { shell }) {
  shell.setScreen({ title: 'tpl.library', back: '/templates' });
  if (needC3(view)) return;
  const lib = (await recs('LIBRARY_ITEM')).sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  const online = navigator.onLine && !app.offline;
  view.innerHTML = `<div class="toolbar"><div class="row"><button type="button" class="btn small primary" id="lb-new"${online ? '' : ' disabled'}>${ICON.plus}<span>${bi('lib.new')}</span></button></div></div>
    <p class="muted small">${bi('lib.hint')}</p>
    ${GROUPS.map((g) => {
      const list = lib.filter((x) => (x.group_key || 'OTHER') === g);
      if (!list.length) return '';
      return `<h2 class="grp-title">${bi('grp.' + g)}</h2><div class="cards">${list.map((x) => `<div class="card rec-card${x.active === false ? ' dim' : ''}">
        <div class="rec-top"><strong>${biName(x)}</strong>${x.active === false ? `<span class="badge t-grey">${bi('tpl.archived')}</span>` : ''}</div>
        <div class="muted small">${bi('input_type.' + x.input_type)}${stdText(x, 'vi') ? ' · ' + bi('chk.std') + ': ' + esc(stdText(x, 'vi')) : ''}${x.builtin ? ' · ' + bi('lib.builtin') : ''}</div>
        <div class="row"><button type="button" class="btn tiny" data-edit="${esc(x.item_id)}"${online ? '' : ' disabled'}>${ICON.edit}<span>${bi('btn.edit')}</span></button></div></div>`).join('')}</div>`;
    }).join('')}`;
  const again = () => renderLibrary(view, { shell });
  const open = async (x) => {
    const isNew = !x;
    const it = x || { group_key: 'OTHER', input_type: 'NUMBER', std_type: 'RANGE' };
    const v = await dialog({
      title: bi(isNew ? 'lib.new' : 'lib.edit'),
      wide: true,
      body: `<div class="lib-edit">${itemEditorHtml(it, 0)}<label class="check"><input type="checkbox" id="lb-active"${it.active === false ? '' : ' checked'}><span>${bi('lib.active')}</span></label><p class="form-err err"></p></div>`,
      actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.save'), kind: 'primary', read: (w) => w }],
      onOpen: (w) => wireItems(w),
      keepOpen: async (w) => {
        const errs = [];
        const p = readItem($('.ie', w), errs);
        delete p.item_key; delete p.library_item_id; delete p.required; delete p.photo_on_fail;
        p.item_id = isNew ? uuid() : x.item_id;
        p.active = $('#lb-active', w).checked;
        if (!p.name_vi && !p.name_zh) errs.push({ field: 'name_vi', key: 'field.one_lang' });
        if (errs.length) { showErrors(w, errs); return false; }
        const res = await writeOnline('library.edit', p, { expected_version: isNew ? 0 : x.record_version });
        if (res.ok) return true;
        if (res.code === 'VALIDATION_ERROR') { showErrors(w, res.errors); return false; }
        writeFail(res);
        return false;
      }
    });
    if (v) { toast(bi('form.saved'), 'ok'); await afterCommit(); again(); }
  };
  $('#lb-new', view).addEventListener('click', () => open(null));
  $$('[data-edit]', view).forEach((b) => b.addEventListener('click', () => open(lib.find((x) => x.item_id === b.dataset.edit))));
}

