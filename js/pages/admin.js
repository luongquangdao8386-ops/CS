// Quản trị (cần mạng): Người dùng và khu vực phụ trách, Giờ ca, Kết nối M&E, Logo trên báo cáo, Sao lưu, Nhật ký thao tác,
// Trạng thái hệ thống, Dữ liệu mẫu (máy chủ THỬ)
import { api, bi, biText, esc, badge, fmtDateTime, fmtNumber, session, uuid, resMsg, nameText, APP_BASE_URL, isValidExecUrl } from '../core.js';
import { $, $$, h, ICON, dialog, toast } from '../ui.js';
import { isWide } from '../shell.js';
import { roleLevel, isOwner, recs, boot } from '../data.js';
import { textInput, selectInput, dateInput, wireForm, readField, showErrors, writeWithPin, writeFail, busy } from '../form.js';
import { rememberReportLogo } from '../report-logo.js';
import { shiftsFrom, shiftsOk } from '../judge.js';
import { afterCommit } from '../app.js';

const errBox = (r) => `<div class="card">${esc(resMsg(r))}</div>`;
const spinner = '<div class="spinner" role="status"></div>';

/** Offline: màn quản trị chỉ hiện "Cần kết nối mạng" */
function offline(view) {
  if (navigator.onLine) return false;
  view.innerHTML = `<div class="card empty-state">${ICON.sync}<p class="muted">${bi('sync.need_network')}</p></div>`;
  return true;
}

async function confirmBox(titleKey, textKey, okKey = 'btn.confirm', kind = 'primary') {
  return dialog({ title: bi(titleKey), body: `<p>${bi(textKey)}</p>`, actions: [{ label: bi('btn.cancel'), value: false }, { label: bi(okKey), kind, value: true }] });
}

async function askText(titleKey, labelKey, { required = true } = {}) {
  const v = await dialog({
    title: bi(titleKey),
    body: `<label class="lbl">${bi(labelKey)}</label><input class="inp" id="ask-text" maxlength="300" autocomplete="off">`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.confirm'), kind: 'primary', read: (w) => $('#ask-text', w).value.trim() }]
  });
  if (v === null) return null;
  if (required && !v) { toast(bi('field.reason_required'), 'err'); return null; }
  return v;
}

/* ====================== Người dùng và khu vực phụ trách ====================== */

function userStatus(u) {
  if (!u.active) return badge('user_status.DISABLED');
  const parts = [];
  if (u.pin_locked) parts.push(badge('adm.user.pin_locked'));
  parts.push(badge(u.must_change_pin ? 'user_status.MUST_CHANGE_PIN' : 'user_status.ACTIVE'));
  return parts.join(' ');
}
const levelText = (u) => bi('level.' + u.role_level) + (u.is_system_owner ? ` <span class="badge t-navy">${bi('level.owner')}</span>` : '');

async function showTempPin(code, pin, expires) {
  const hours = session.settings && session.settings.temp_pin_hours ? session.settings.temp_pin_hours : 72;
  await dialog({
    title: `${bi('adm.user.temp_pin_title')} · ${esc(code)}`,
    body: `<p class="temp-pin" aria-label="PIN">${esc(pin)}</p>
      <p class="banner warn">${bi('adm.user.temp_pin_once', { H: hours })}</p>
      ${expires ? `<p class="muted small">${bi('adm.user.temp_pin_until')}: ${esc(fmtDateTime(expires))}</p>` : ''}`,
    actions: [{ label: bi('btn.close'), kind: 'primary', value: true }]
  });
}

function roleFields(rec, areas) {
  const lv = String(rec.role_level || 2);
  const cur = rec.area_ids || [];
  return `${selectInput('role_level', 'account.level', [1, 2, 3, 4].map((n) => [String(n), bi('level.' + n)]), lv, { empty: '' })}
    <p class="muted small">${bi('adm.user.level_hint')}</p>
    <div class="fld" data-field="area_ids"><label>${bi('account.areas')}</label>
      <p class="muted small">${bi('adm.user.areas_hint')}</p>
      <div class="area-picks">${areas.map((a) => `<label class="check"><input type="checkbox" data-area="${esc(a.area_id)}"${cur.includes(a.area_id) ? ' checked' : ''}><span>${esc(nameText(a))}</span></label>`).join('') || `<p class="muted small">${bi('adm.user.no_areas')}</p>`}</div>
      <div class="ferr" role="alert"></div></div>`;
}
function readRole(wrap) {
  return { role_level: Number(readField(wrap, 'role_level')), area_ids: $$('[data-area]', wrap).filter((i) => i.checked).map((i) => i.dataset.area) };
}
async function activeAreas() {
  return (await recs('AREA')).filter((a) => a.active !== false).sort((a, b) => String(a.area_code || a.name_vi).localeCompare(String(b.area_code || b.name_vi)));
}

async function userDialog(u) {
  const isNew = !u;
  const areas = await activeAreas();
  const wrap = h(`<div class="modal" role="dialog" aria-modal="true"><div class="modal-card form-card">
    <h2>${isNew ? bi('adm.user.add') : `${bi('btn.set_role')} · ${esc(u.employee_code)}`}</h2>
    ${isNew ? textInput('employee_code', 'adm.user.code', '', { required: true, maxlength: 40, upper: true }) : ''}
    ${textInput('display_name', 'account.display_name', u ? u.display_name : '', { required: true, maxlength: 80 })}
    ${textInput('email', 'adm.user.email', u ? u.email || '' : '', { maxlength: 120, inputmode: 'email' })}
    ${roleFields(u || { role_level: 2, area_ids: [] }, areas)}
    ${isNew ? '' : `<p class="muted small">${bi('adm.user.role_note')}</p>`}
    <p class="form-err err"></p>
    <div class="modal-actions"><button type="button" class="btn" data-x="cancel">${bi('btn.cancel')}</button><button type="button" class="btn primary" data-x="save">${bi('btn.save')}</button></div></div></div>`);
  document.body.appendChild(wrap);
  wireForm(wrap);
  return new Promise((resolve) => {
    $('[data-x="cancel"]', wrap).addEventListener('click', () => { wrap.remove(); resolve(false); });
    $('[data-x="save"]', wrap).addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const p = { display_name: readField(wrap, 'display_name'), email: readField(wrap, 'email'), ...readRole(wrap) };
      const errs = [];
      if (isNew) { p.user_id = uuid(); p.employee_code = readField(wrap, 'employee_code'); if (!p.employee_code) errs.push({ field: 'employee_code', key: 'field.required' }); } else p.user_id = u.user_id;
      if (!p.display_name) errs.push({ field: 'display_name', key: 'field.required' });
      if (errs.length) { showErrors(wrap, errs); return; }
      busy(btn, true);
      const res = isNew ? await writeWithPin('user.create', p) : await writeWithPin('user.setRole', p, { expected_version: u.record_version });
      busy(btn, false);
      if (res.ok) {
        wrap.remove();
        if (res.data && res.data.temp_pin) await showTempPin(res.data.employee_code || p.employee_code, res.data.temp_pin, res.data.temp_pin_expires_at);
        else toast(bi('form.saved'), 'ok');
        resolve(true);
        return;
      }
      if (res.code === 'VALIDATION_ERROR') { showErrors(wrap, res.errors); return; }
      wrap.remove();
      writeFail(res);
      resolve(false);
    });
  });
}

async function userAction(u, kind) {
  const payload = { user_id: u.user_id };
  if (kind === 'lock') {
    const reason = await askText('btn.lock', 'field.reason');
    if (!reason) return false;
    payload.reason = reason;
  } else if (kind === 'reset' && !await confirmBox('btn.reset_pin', 'adm.user.confirm_reset')) return false;
  else if (kind === 'revoke' && !await confirmBox('btn.revoke_sessions', 'adm.user.confirm_revoke')) return false;
  const action = { lock: 'user.lock', unlock: 'user.unlock', reset: 'user.resetPin', revoke: 'user.revokeSessions' }[kind];
  const res = await writeWithPin(action, payload, { expected_version: u.record_version });
  if (res.ok) {
    if (res.data && res.data.temp_pin) await showTempPin(u.employee_code, res.data.temp_pin, res.data.temp_pin_expires_at);
    else toast(bi('form.saved'), 'ok');
    return true;
  }
  writeFail(res);
  return false;
}

let showLocked = false;

export async function renderUsers(view, { shell }) {
  shell.setScreen({ title: 'admin.users', back: '/account' });
  if (offline(view)) return;
  view.innerHTML = spinner;
  const r = await api('user.view', {}, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const areas = new Map((await recs('AREA')).map((a) => [a.area_id, a]));
  const me = r.data.me;
  const all = r.data.items;
  const lockedN = all.filter((u) => !u.active).length;
  const items = showLocked ? all : all.filter((u) => u.active);
  const repaint = () => renderUsers(view, { shell });
  const canAct = (u) => u.user_id !== me && (!u.is_system_owner || isOwner());
  const areaText = (u) => (u.area_ids && u.area_ids.length ? u.area_ids.map((a) => esc(nameText(areas.get(a)) || a)).join(', ') : `<span class="muted">${bi('pend.all_areas')}</span>`);
  const note = (u) => (u.user_id === me ? `<span class="muted small">${bi('adm.user.self_note')}</span>` : (u.is_system_owner && !isOwner() ? `<span class="muted small">${bi('adm.user.owner_note')}</span>` : ''));
  const actions = (u) => (canAct(u) ? `<div class="row">
      <button type="button" class="btn small" data-act="role" data-id="${esc(u.user_id)}">${ICON.edit}${bi('btn.set_role')}</button>
      <button type="button" class="btn small" data-act="reset" data-id="${esc(u.user_id)}">${bi('btn.reset_pin')}</button>
      ${u.active && !u.pin_locked ? `<button type="button" class="btn small" data-act="lock" data-id="${esc(u.user_id)}">${bi('btn.lock')}</button>` : `<button type="button" class="btn small" data-act="unlock" data-id="${esc(u.user_id)}">${bi('btn.unlock')}</button>`}
      ${u.active ? `<button type="button" class="btn small" data-act="revoke" data-id="${esc(u.user_id)}">${bi('btn.revoke_sessions')}</button>` : ''}</div>` : note(u));
  const body = isWide()
    ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>${bi('adm.user.code')}</th><th>${bi('account.display_name')}</th><th>${bi('account.level')}</th><th>${bi('account.areas')}</th><th>${bi('col.status')}</th><th>${bi('adm.user.last_login')}</th><th>${bi('col.actions')}</th></tr></thead>
      <tbody>${items.map((u) => `<tr><td class="code">${esc(u.employee_code)}</td><td>${esc(u.display_name)}${u.email ? `<div class="muted small">${esc(u.email)}</div>` : ''}</td><td>${levelText(u)}</td><td class="small">${areaText(u)}</td><td>${userStatus(u)}</td>
        <td>${esc(fmtDateTime(u.last_login_at) || '—')}<div class="muted small">${bi('adm.user.sessions')}: ${u.active_sessions || 0}</div></td><td>${actions(u)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="cards">${items.map((u) => `<div class="card rec-card"><div class="rec-top"><span class="code">${esc(u.employee_code)}</span><span>${levelText(u)}</span></div>
        <div class="rec-name">${esc(u.display_name)}</div><div class="muted small">${bi('account.areas')}: ${areaText(u)}</div>
        <div class="rec-badges">${userStatus(u)}</div>
        <div class="muted small">${bi('adm.user.last_login')}: ${esc(fmtDateTime(u.last_login_at) || '—')} · ${bi('adm.user.sessions')}: ${u.active_sessions || 0}</div>
        <div class="rec-actions">${actions(u)}</div></div>`).join('')}</div>`;
  view.innerHTML = `<div class="toolbar"><div class="row"><span class="muted">${bi('adm.user.total', { N: items.length })}</span>
    <button type="button" class="btn small primary" id="u-add">${ICON.plus}${bi('adm.user.add')}</button>
    ${lockedN ? `<button type="button" class="btn small" id="u-locked">${bi(showLocked ? 'adm.user.hide_locked' : 'adm.user.show_locked', { N: lockedN })}</button>` : ''}</div></div>
    <p class="muted small">${bi('adm.user.levels_note')}</p>${body}`;
  $('#u-add', view).addEventListener('click', async () => { if (await userDialog(null)) repaint(); });
  if (lockedN) $('#u-locked', view).addEventListener('click', () => { showLocked = !showLocked; repaint(); });
  $$('[data-act]', view).forEach((b) => b.addEventListener('click', async () => {
    const u = all.find((x) => x.user_id === b.dataset.id);
    if (!u) return;
    const done = b.dataset.act === 'role' ? await userDialog(u) : await userAction(u, b.dataset.act);
    if (done) repaint();
  }));
}

/* ====================== Giờ ca ====================== */

export async function renderShifts(view, { shell }) {
  shell.setScreen({ title: 'admin.shifts', back: '/account' });
  if (offline(view)) return;
  const list = shiftsFrom(session.settings).map((s) => ({ ...s }));
  const draw = () => {
    view.innerHTML = `<section class="card"><h2>${bi('admin.shifts')}</h2>
      <p class="muted small">${bi('shf.hint')}</p>
      <div class="shift-rows">${list.map((s, i) => `<div class="shift-row" data-i="${i}"><strong>${bi('shift.name' + s.no)}</strong>
        <label>${bi('shf.start')} <input class="inp tiny-input" type="time" data-f="start" value="${esc(s.start)}"></label>
        <label>${bi('shf.end')} <input class="inp tiny-input" type="time" data-f="end" value="${esc(s.end)}"></label>
        ${list.length > 1 && i === list.length - 1 ? `<button type="button" class="icon-btn" data-del aria-label="${esc(biText('btn.delete'))}">${ICON.trash}</button>` : ''}</div>`).join('')}</div>
      <div class="row">${list.length < 4 ? `<button type="button" class="btn small" id="sf-add">${ICON.plus}<span>${bi('shf.add')}</span></button>` : ''}
        <button type="button" class="btn small primary" id="sf-save">${bi('btn.save')}</button></div>
      <p class="muted small">${bi('shf.note')}</p></section>`;
    $$('.shift-row input', view).forEach((inp) => inp.addEventListener('change', () => { list[Number(inp.closest('.shift-row').dataset.i)][inp.dataset.f] = inp.value; }));
    const add = $('#sf-add', view);
    if (add) add.addEventListener('click', () => { const last = list[list.length - 1]; list.push({ no: list.length + 1, start: last.end, end: list[0].start }); draw(); });
    const del = $('[data-del]', view);
    if (del) del.addEventListener('click', () => { list.pop(); draw(); });
    $('#sf-save', view).addEventListener('click', async (ev) => {
      const out = list.map((s) => ({ no: Number(s.no), start: s.start, end: s.end }));
      if (!shiftsOk(out)) { toast(bi('shf.invalid'), 'err'); return; }
      const reason = await askText('admin.shifts', 'field.reason', { required: false });
      if (reason === null) return;
      busy(ev.target, true);
      const res = await writeWithPin('settings.edit', { changes: { shifts_json: out }, reason });
      busy(ev.target, false);
      if (res.ok) { toast(bi('form.saved'), 'ok'); await afterCommit(); renderShifts(view, { shell }); return; }
      writeFail(res);
    });
  };
  draw();
}

/* ====================== Kết nối M&E ====================== */

export async function renderMeLink(view, { shell }) {
  shell.setScreen({ title: 'admin.me_link', back: '/account' });
  if (offline(view)) return;
  view.innerHTML = spinner;
  const r = await api('system.status', {}, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const l = r.data.me_link || {};
  view.innerHTML = `<section class="card"><h2>${bi('melink.state')}</h2>
      <div class="kv"><span>${bi('col.status')}</span><strong>${l.linked ? badge('melink.linked') : badge('melink.not_linked')}</strong></div>
      ${l.linked ? `<div class="kv"><span>${bi('melink.url')}</span><strong class="code">${esc(l.exec_url_tail)}</strong></div>
        <div class="kv"><span>${bi('mac.me_last')}</span><strong>${esc(fmtDateTime(l.last_sync_at) || '—')} ${l.last_sync_status ? esc(l.last_sync_status) : ''}</strong></div>
        ${l.last_sync_error ? `<p class="banner warn small">${esc(l.last_sync_error)}</p>` : ''}` : ''}
      <p class="muted small">${bi('melink.how_often')}</p></section>
    <section class="card"><h2>${bi(l.linked ? 'melink.change' : 'melink.set')}</h2>
      <ol class="steps small"><li>${bi('melink.step1')}</li><li>${bi('melink.step2')}</li><li>${bi('melink.step3')}</li></ol>
      ${textInput('exec_url', 'melink.url', '', { placeholder: 'https://script.google.com/macros/s/…/exec', maxlength: 300 })}
      ${textInput('key', 'melink.key', '', { maxlength: 200 })}
      <p class="form-err err"></p>
      <button type="button" class="btn primary" id="ml-save">${bi('melink.test_save')}</button></section>`;
  wireForm(view);
  $('#ml-save', view).addEventListener('click', async (ev) => {
    const url = readField(view, 'exec_url'), key = readField(view, 'key');
    const errs = [];
    if (!isValidExecUrl(url)) errs.push({ field: 'exec_url', key: 'melink.url_bad' });
    if (!key || key.length < 24) errs.push({ field: 'key', key: 'melink.key_bad' });
    if (errs.length) { showErrors(view, errs); return; }
    busy(ev.target, true);
    const res = await writeWithPin('me.link.set', { exec_url: url, key });
    busy(ev.target, false);
    if (res.ok) {
      const s = (res.data && res.data.sync) || {};
      toast(bi('melink.ok', { N: s.total_machines !== undefined ? s.total_machines : '—' }), 'ok');
      await afterCommit();
      renderMeLink(view, { shell });
      return;
    }
    if (res.code === 'VALIDATION_ERROR') { showErrors(view, res.errors); return; }
    if (res.code === 'ME_LINK_FAILED') { showMeLinkFail(view, (res.data && res.data.reason) || ''); return; }
    writeFail(res);
  });
}

/** Lý do không lấy được danh sách từ M&E và việc cần làm */
function showMeLinkFail(view, reason) {
  const r = String(reason || '');
  const key = r === 'FORBIDDEN' ? 'melink.fail_forbidden'
    : /^NON_JSON|REDIRECTED_AS_GET|NO_RESPONSE/.test(r) ? 'melink.fail_url'
      : /permission|quyền|UrlFetch/i.test(r) ? 'melink.fail_perm' : 'melink.fail_other';
  $('.form-err', view).innerHTML = `${bi(key)}<br><span class="muted small">${bi('melink.reason')}: <code>${esc(r || '—')}</code></span>`;
  toast(bi('melink.fail_title'), 'err');
}

/* ====================== Sao lưu ====================== */

const WEEKDAY = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };
const bkErr = (e) => (e === 'NO_MANIFEST' ? bi('adm.backup.no_manifest') : esc(e));

export async function renderBackup(view, { shell }) {
  shell.setScreen({ title: 'admin.backup', back: '/account' });
  if (offline(view)) return;
  if (!view.querySelector('.bk')) view.innerHTML = spinner;
  const r = await api('backup.view', {}, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const d = r.data;
  const list = d.items.length ? `<div class="cards">${d.items.map((b) => `<div class="card rec-card"><div class="rec-top"><span>${esc(fmtDateTime(b.created_at) || b.ref)}</span>${badge('backup_status.' + b.status)}</div>
        <div class="muted small">${bi('adm.backup.rows')}: ${esc(fmtNumber(b.rows))} · ${bi('adm.backup.docs')}: ${esc(fmtNumber(b.documents))}${b.retry ? ' · ' + bi('adm.backup.retry') : ''}${b.error ? ' · ' + bkErr(b.error) : ''}</div></div>`).join('')}</div>`
    : `<p class="muted">${bi('adm.backup.none')}</p>`;
  view.innerHTML = `<div class="bk">
    <section class="card"><h2>${bi('adm.backup.last')}</h2>
      <p>${d.last_backup_at ? `${esc(fmtDateTime(d.last_backup_at))} ${badge('backup_status.' + (d.last_backup_status || 'FAILED'))}` : bi('adm.backup.none')}</p>
      <p class="muted small">${bi('adm.backup.note', { D: biText('weekday.' + (WEEKDAY[d.backup_weekday] || 7)), H: String(d.backup_hour).padStart(2, '0'), N: d.keep_count })}</p>
      ${d.queued || d.running ? `<p class="banner info" id="bk-queued">${bi(d.queued ? 'adm.backup.queued' : 'adm.backup.running')}</p>` : `<button type="button" class="btn primary" id="bk-run">${bi('btn.backup_now')}</button>`}
    </section>${list}</div>`;
  const run = $('#bk-run', view);
  if (run) run.addEventListener('click', async (ev) => {
    busy(ev.target, true);
    const res = await writeWithPin('backup.run', {});
    busy(ev.target, false);
    if (res.ok) renderBackup(view, { shell }); else writeFail(res);
  });
  if (d.queued || d.running) setTimeout(() => { if (view.isConnected && $('#bk-queued', view)) renderBackup(view, { shell }); }, 5000);
}

/* ====================== Nhật ký thao tác ====================== */

const auditFilt = { action: '', from: '', to: '' };
const AUDIT_ACTIONS = ['check.', 'abnormal.', 'missed.', 'day.', 'template.', 'library.', 'assignment.', 'machine.', 'user.', 'settings.', 'me.', 'report.', 'backup.'];

function jsonLines(o) {
  if (!o || typeof o !== 'object') return '';
  return Object.keys(o).map((k) => `<div><span class="muted">${esc(k)}:</span> ${esc(typeof o[k] === 'object' ? JSON.stringify(o[k]) : String(o[k]))}</div>`).join('');
}

export async function renderAudit(view, { shell }) {
  shell.setScreen({ title: 'admin.audit', back: '/account' });
  if (offline(view)) return;
  view.innerHTML = spinner;
  const payload = {};
  if (auditFilt.action) payload.action = auditFilt.action;
  if (auditFilt.from) payload.from = auditFilt.from;
  if (auditFilt.to) payload.to = auditFilt.to;
  const r = await api('audit.view', payload, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const macs = new Map((await recs('MACHINE')).map((m) => [m.machine_id, m.machine_code]));
  const tpls = new Map((await recs('TEMPLATE')).map((t) => [t.template_id, t.template_code]));
  const ent = (a) => esc(macs.get(a.entity_id) || tpls.get(a.entity_id) || (a.entity_id ? a.entity_type : ''));
  const acts = AUDIT_ACTIONS.filter((x) => roleLevel() >= 4 || !['user.', 'settings.', 'me.', 'backup.'].includes(x));
  view.innerHTML = `<div class="filters"><div class="row">
      <select class="sel inp" id="a-act"><option value="">${esc(biText('adm.audit.all'))}</option>${acts.map((x) => `<option value="${x}"${auditFilt.action === x ? ' selected' : ''}>${esc(biText('audit_grp.' + x.replace('.', '')))}</option>`).join('')}</select>
      </div><div class="form-grid">${dateInput('a_from', 'adm.audit.from', auditFilt.from)}${dateInput('a_to', 'adm.audit.to', auditFilt.to)}</div>
      <div class="row"><button type="button" class="btn small" id="a-apply">${ICON.search}${bi('btn.filter')}</button></div></div>
    <div class="cards audit">${r.data.items.map((a) => `<details class="card rec-card"><summary><div class="rec-top"><span>${esc(fmtDateTime(a.occurred_at, true))}</span><span class="code">${ent(a)}</span></div>
        <div class="rec-name"><code>${esc(a.action)}</code></div>
        <div class="muted small">${bi('adm.audit.user')}: ${esc(a.user_name)}${a.reason ? ` · ${bi('field.reason')}: ${esc(a.reason)}` : ''}</div></summary>
        <div class="kv-grid small"><div><strong>${bi('adm.audit.before')}</strong>${jsonLines(a.before_json) || '—'}</div><div><strong>${bi('adm.audit.after')}</strong>${jsonLines(a.after_json) || '—'}</div></div></details>`).join('') || `<p class="muted">${bi('home.none_filter')}</p>`}</div>
    ${r.data.more ? `<p class="muted small">${bi('adm.audit.more')}</p>` : ''}`;
  const re = () => renderAudit(view, { shell });
  $('#a-act', view).addEventListener('change', (e) => { auditFilt.action = e.target.value; re(); });
  wireForm(view);
  $('#a-apply', view).addEventListener('click', () => {
    const f = readField(view, 'a_from'), t = readField(view, 'a_to');
    if (f === null || t === null) { toast(bi('field.invalid_date'), 'err'); return; }
    auditFilt.from = f || ''; auditFilt.to = t || ''; re();
  });
}

/* ====================== Trạng thái hệ thống ====================== */

function settingValue(s) {
  if (s.type === 'BOOL') return s.value ? '✓' : '✗';
  if (s.key === 'shifts_json' && Array.isArray(s.value)) return esc(s.value.map((x) => `${x.no}: ${x.start}–${x.end}`).join(' · '));
  if (s.type === 'JSON') return esc(JSON.stringify(s.value));
  if (s.type === 'INT' || s.type === 'NUMBER') return esc(fmtNumber(s.value));
  return esc(String(s.value ?? ''));
}

async function editSetting(s) {
  let input;
  if (s.type === 'BOOL') input = `<label class="check"><input type="checkbox" id="f-v"${s.value ? ' checked' : ''}><span>${esc(s.key)}</span></label>`;
  else if (s.options) input = `<select class="inp sel" id="f-v">${s.options.map((o) => `<option${o === s.value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else input = `<input class="inp" id="f-v" value="${esc(String(s.value ?? ''))}" ${s.type === 'INT' || s.type === 'NUMBER' ? 'inputmode="decimal"' : ''} autocomplete="off">`;
  const v = await dialog({
    title: bi('adm.status.edit_setting'),
    body: `<p><strong>${esc(s.description_vi)} · ${esc(s.description_zh)}</strong></p><p class="muted small"><code>${esc(s.key)}</code>${s.bounds ? ` · ${esc(s.bounds[0])}–${esc(s.bounds[1])}` : ''} · ${bi('adm.status.default')}: ${esc(JSON.stringify(s.default_value))}</p>
      ${input}<label class="lbl">${bi('field.reason')}</label><input class="inp" id="f-r" maxlength="300">`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.save'), kind: 'primary', read: (w) => {
      const el = $('#f-v', w);
      let val = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (s.type === 'INT' || s.type === 'NUMBER') val = Number(String(val).replace(/[\s  ]/g, '').replace(',', '.'));
      return { val, reason: $('#f-r', w).value.trim() };
    } }]
  });
  if (!v) return false;
  const res = await writeWithPin('settings.edit', { changes: { [s.key]: v.val }, reason: v.reason });
  if (res.ok) { toast(bi('form.saved'), 'ok'); await afterCommit(); return true; }
  writeFail(res);
  return false;
}

export async function renderStatus(view, { shell }) {
  shell.setScreen({ title: 'admin.status', back: '/account' });
  if (offline(view)) return;
  view.innerHTML = spinner;
  const r = await api('system.status', {}, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const d = r.data;
  const checks = d.checks.map((c) => {
    let ok = c.status === 'OK', note = c.note ? esc(c.note) : '';
    if (c.key === 'app_base_url' && c.value && c.value !== APP_BASE_URL) { ok = false; note = bi('adm.status.base_mismatch', { U: APP_BASE_URL }); }
    let val = c.value;
    if (c.key === 'spreadsheet_cells') val = fmtNumber(Number(c.value));
    if (/paused_until$/.test(c.key)) val = c.value ? fmtDateTime(c.value) : '—';
    return `<tr><td>${bi('health.' + c.key)}</td><td>${badge(ok ? 'adm.status.ok' : 'adm.status.warn')}</td><td>${esc(String(val === '' ? '—' : val))}${note ? `<div class="muted small">${note}</div>` : ''}</td></tr>`;
  }).join('');
  view.innerHTML = `<section class="card"><p class="muted small">${bi('adm.status.checked_at', { T: fmtDateTime(d.checked_at) })}</p>
      <div class="table-wrap"><table class="tbl"><tbody>${checks}</tbody></table></div></section>
    <section class="card"><h2>${bi('adm.status.settings')}</h2>
      <div class="table-wrap"><table class="tbl settings"><tbody>${d.settings.map((s) => `<tr><td>${esc(s.description_vi)} · ${esc(s.description_zh)}<div class="muted small"><code>${esc(s.key)}</code></div></td>
        <td>${settingValue(s)}</td><td>${s.readonly ? badge('adm.status.readonly') : (s.key === 'shifts_json' ? `<a class="btn small" href="#/admin/shifts">${ICON.edit}${bi('btn.edit')}</a>` : `<button type="button" class="btn small" data-set="${esc(s.key)}">${ICON.edit}${bi('btn.edit')}</button>`)}</td></tr>`).join('')}</tbody></table></div></section>`;
  $$('[data-set]', view).forEach((b) => b.addEventListener('click', async () => {
    const s = d.settings.find((x) => x.key === b.dataset.set);
    if (s && await editSetting(s)) renderStatus(view, { shell });
  }));
}

/* ====================== Logo trên báo cáo ====================== */

const LOGO_MAX_EDGE = 800;
const LOGO_MAX_BYTES = 1048576;

const blobB64 = (blob) => new Promise((ok, fail) => {
  const fr = new FileReader();
  fr.onload = () => ok(String(fr.result).split(',')[1]);
  fr.onerror = () => fail(fr.error);
  fr.readAsDataURL(blob);
});

/** Ảnh người dùng chọn → PNG/JPEG cạnh dài ≤ 800 px, ≤ 1 MB (PNG giữ nền trong suốt; quá lớn thì JPEG nền trắng) */
async function shrinkLogo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('size');
    const k = Math.min(1, LOGO_MAX_EDGE / Math.max(w0, h0));
    if (k === 1 && file.size <= LOGO_MAX_BYTES) return { b64: await blobB64(file), mime: file.type };
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    const g = cv.getContext('2d');
    const toBlob = (type, q) => new Promise((ok) => cv.toBlob(ok, type, q));
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, cv.width, cv.height);
    let blob = file.type === 'image/png' ? await toBlob('image/png') : await toBlob('image/jpeg', 0.92);
    if (blob && blob.size > LOGO_MAX_BYTES) {
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      blob = await toBlob('image/jpeg', 0.88);
    }
    if (!blob) throw new Error('encode');
    return { b64: await blobB64(blob), mime: blob.type };
  } finally { URL.revokeObjectURL(url); }
}

const logoPageHtml = (url) => `<div class="logo-page"><img class="paper-logo" src="${esc(url)}" alt=""><div class="logo-page-lines"><i></i><i></i><i></i></div></div>`;

export async function renderReportLogo(view, { shell }) {
  shell.setScreen({ title: 'admin.report_logo', back: '/account' });
  if (offline(view)) return;
  view.innerHTML = spinner;
  const r = await api('report.logo.get', {}, { retry: true });
  if (!r.ok) { view.innerHTML = errBox(r); return; }
  const cur = await rememberReportLogo(r.data.rev ? { rev: r.data.rev, mime: r.data.mime_type, b64: r.data.content_b64 } : null);
  view.innerHTML = `<section class="card"><h2>${bi('admin.report_logo')}</h2>
      <p class="muted small">${bi('logo.where')}</p>
      ${cur ? `<p class="lbl">${bi('logo.current')}</p><img class="logo-big" id="lg-cur" src="${esc(cur.url)}" alt="">
        <p class="muted small">${bi('logo.preview_note')}</p>${logoPageHtml(cur.url)}` : `<p class="banner" id="lg-none">${bi('logo.none')}</p>`}
      <p class="muted small">${bi('logo.hint')}</p>
      <div class="row"><label class="btn file${cur ? '' : ' primary'}">${ICON.upload}<span>${bi(cur ? 'logo.replace' : 'logo.upload')}</span><input type="file" id="lg-file" accept="image/png,image/jpeg" hidden></label>
        ${cur ? `<button type="button" class="btn danger" id="lg-remove">${ICON.trash}<span>${bi('logo.remove')}</span></button>` : ''}</div></section>`;
  const again = () => renderReportLogo(view, { shell });
  $('#lg-file', view).addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.type !== 'image/png' && f.type !== 'image/jpeg') { toast(bi('logo.bad_type'), 'err'); return; }
    let out;
    try { out = await shrinkLogo(f); } catch (err) { toast(bi('logo.bad_type'), 'err'); return; }
    const yes = await dialog({
      title: bi('admin.report_logo'),
      body: `<p class="muted small">${bi('logo.preview_note')}</p>${logoPageHtml(`data:${out.mime};base64,${out.b64}`)}`,
      actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.save'), kind: 'primary', value: true }]
    });
    if (!yes) return;
    const res = await writeWithPin('report.logo.set', { content_b64: out.b64, mime_type: out.mime });
    if (res.ok) { await rememberReportLogo({ rev: res.data.rev, mime: out.mime, b64: out.b64 }); toast(bi('logo.saved'), 'ok'); again(); return; }
    writeFail(res);
  });
  const rm = $('#lg-remove', view);
  if (rm) rm.addEventListener('click', async () => {
    const yes = await dialog({ title: bi('logo.remove'), body: `<p>${bi('logo.remove_confirm')}</p>`,
      actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('logo.remove'), kind: 'danger', value: true }] });
    if (!yes) return;
    const res = await writeWithPin('report.logo.set', { remove: true });
    if (res.ok) { await rememberReportLogo(null); toast(bi('logo.removed'), 'ok'); again(); return; }
    writeFail(res);
  });
}

/* ====================== Dữ liệu mẫu (chỉ máy chủ THỬ, owner) ====================== */

export async function renderSample(view, { shell }) {
  shell.setScreen({ title: 'admin.sample', back: '/account' });
  const b = await boot();
  if (b.env !== 'THU' || !isOwner()) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.forbidden')}</p></div>`; return; }
  if (offline(view)) return;
  view.innerHTML = `<section class="card"><h2>${bi('admin.sample')}</h2><p>${bi('sample.what')}</p><p class="muted small">${bi('sample.note')}</p>
    <button type="button" class="btn primary" id="sp-run">${bi('sample.run')}</button><div id="sp-out"></div></section>`;
  $('#sp-run', view).addEventListener('click', async (ev) => {
    busy(ev.target, true);
    const res = await writeWithPin('sample.seed', {});
    busy(ev.target, false);
    if (!res.ok) { writeFail(res); return; }
    const d = res.data || {};
    await afterCommit();
    $('#sp-out', view).innerHTML = d.already ? `<p class="banner info">${bi('sample.already')}</p>`
      : `<p class="banner info">${bi('sample.done', { M: d.machines, T: d.templates })}</p>
        ${Object.keys(d.temp_pins || {}).length ? `<p class="muted small">${bi('sample.pins')}</p><ul class="list">${Object.entries(d.temp_pins).map(([k, v]) => `<li><span class="code">${esc(k)}</span> · PIN <strong>${esc(v)}</strong></li>`).join('')}</ul>` : ''}`;
  });
}
