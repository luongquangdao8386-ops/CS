// Nháp chờ đồng bộ (lượt kiểm, ảnh lưu khi mất mạng) và Xử lý xung đột
import { bi, esc, fmtDateTime, fmtNumber, fmtDate, badge, session, L, nameText } from '../core.js';
import { ICON, toast, dialog, $ } from '../ui.js';
import { queueItems, recentDone, exportBackup, deleteQueued, requeue, rebaseQueued } from '../sync.js';
import { app, syncNow } from '../app.js';
import { navigate } from '../router.js';
import { shareFileNow } from '../media.js';
import { daysBetween, today, mapOf } from '../data.js';

const TABS = ['queued', 'failed', 'conflict', 'rejected', 'old'];
const TAB_LABEL = { queued: 'sync.queued', failed: 'sync.failed', conflict: 'sync.conflict', rejected: 'draft.rejected', old: 'draft.old_epoch' };
let curTab = 'queued';

function tabOf(o) {
  if (o.dataset_epoch !== session.epoch) return 'old';
  if (o.state === 'CONFLICT') return 'conflict';
  if (o.state === 'REJECTED') return 'rejected';
  if (o.last_code && !['UNKNOWN_RESULT', 'NETWORK_ERROR'].includes(o.last_code) && o.state === 'QUEUED') return 'failed';
  return 'queued';
}

function actionLabel(a) { return L['action.' + a] ? bi('action.' + a) : esc(a); }

/** "TB-0007 · Máy nén khí 01 · Ca 1 28/10/2026" cho lượt kiểm và ảnh của nó */
async function describer() {
  const asg = await mapOf('ASSIGNMENT'), macs = await mapOf('MACHINE');
  const all = await queueItems();
  const runs = new Map(all.filter((o) => o.action === 'check.submit').map((o) => [o.entity_id, o.payload]));
  return (o) => {
    const p = o.action === 'check.submit' ? o.payload : runs.get(o.parent_id);
    if (!p) return '';
    const a = asg.get(p.assignment_id);
    const m = a && macs.get(a.machine_id);
    return `${m ? esc(m.machine_code) + ' · ' + esc(nameText(m)) + ' · ' : ''}${p.shift ? bi('shift.n', { N: p.shift }) + ' ' : ''}${esc(fmtDate(p.work_date))}`;
  };
}

function photoCount(o) {
  const p = o.payload || {};
  return p.mime_type && /^image\//.test(p.mime_type) ? 1 : 0;
}

const backupFile = async () => { const blob = await exportBackup(); shareFileNow(new File([blob], `cs-du-phong-${Date.now()}.json`, { type: 'application/json' })); };

export async function renderDrafts(view, { shell }) {
  shell.setScreen({ title: 'draft.title', back: '/account' });
  const uid = session.user && session.user.user_id;
  const all = await queueItems();
  const mine = all.filter((o) => o.user_id === uid);
  const other = all.length - mine.length;
  const by = {};
  TABS.forEach((t) => { by[t] = []; });
  mine.forEach((o) => by[tabOf(o)].push(o));
  const online = navigator.onLine && !app.offline;
  const list = by[curTab];
  const sent = curTab === 'queued' ? (await recentDone()).slice(0, 20) : [];
  const desc = await describer();
  view.innerHTML = `<div class="chips tabs">${TABS.map((t) => `<button type="button" class="chip${t === curTab ? ' on' : ''}" data-tab="${t}">${bi(TAB_LABEL[t])} <span class="count">${by[t].length}</span></button>`).join('')}</div>
    ${other ? `<p class="muted small">${bi('draft.other_user', { N: other })}</p>` : ''}
    <div class="row"><button type="button" class="btn small primary" id="dr-sync" ${online ? '' : 'disabled'}>${ICON.sync}<span>${bi('btn.sync_now')}</span></button>
      <button type="button" class="btn small" id="dr-backup">${ICON.download}<span>${bi('btn.export_backup')}</span></button></div>
    ${online ? '' : `<p class="muted small">${bi('sync.need_network')}</p>`}
    <div class="cards">${list.map((o) => {
      const size = JSON.stringify(o.payload || {}).length;
      const n = photoCount(o);
      const left = curTab === 'old' ? Math.max(0, 30 - (daysBetween((o.rejected_at || o.local_created_at || '').slice(0, 10), today()) || 0)) : null;
      return `<div class="card rec-card" data-op="${esc(o.operation_id)}">
        <div class="rec-top"><strong>${actionLabel(o.action)}</strong>${badge('op_state.' + (o.blocked && o.state === 'QUEUED' ? 'BLOCKED' : (o.state === 'SENDING' ? 'SENDING' : o.state)))}</div>
        <div class="small">${desc(o)}</div>
        <div class="muted small">${bi('draft.created')}: ${esc(fmtDateTime(o.local_created_at))}</div>
        ${o.blocked && o.state === 'QUEUED' ? `<div class="muted small">${bi('draft.blocked_hint')}</div>` : ''}
        <div class="muted small">${n ? bi('draft.photos', { N: n }) + ' · ' : ''}${bi('draft.size')}: ${fmtNumber(Math.ceil(size / 1024))} KB${o.last_code ? ` · ${bi('draft.error_code')}: <code>${esc(o.last_code)}</code>` : ''}</div>
        ${(o.errors || []).map((e) => `<div class="err small">${esc(e.message_vi || e.code)} · ${esc(e.message_zh || '')}</div>`).join('')}
        ${left !== null ? `<div class="muted small">${bi('draft.auto_delete', { N: left })}</div>` : ''}
        <div class="row">
          ${curTab === 'failed' ? `<button type="button" class="btn tiny" data-retry="${esc(o.operation_id)}">${bi('btn.retry')}</button>` : ''}
          ${curTab === 'conflict' ? `<a class="btn tiny primary" href="#/account/conflict/${esc(o.operation_id)}">${bi('conflict.title')}</a>` : ''}
          ${curTab !== 'old' ? `<button type="button" class="btn tiny danger" data-del="${esc(o.operation_id)}">${ICON.trash}<span>${bi('btn.delete_draft')}</span></button>` : ''}
        </div></div>`;
    }).join('') || `<div class="card empty-state"><p class="muted">${bi('draft.empty')}</p></div>`}</div>
    ${sent.length ? `<h2 class="sent-title">${bi('draft.recent_sent')}</h2><div class="cards" id="dr-sent">${sent.map((o) => `<div class="card rec-card" data-done="${esc(o.operation_id)}">
        <div class="rec-top"><strong>${actionLabel(o.action)}</strong>${badge('op_state.COMMITTED')}</div>
        <div class="muted small">${bi('draft.created')}: ${esc(fmtDateTime(o.local_created_at))} · ${bi('draft.sent_at')}: ${esc(fmtDateTime(o.committed_at))}</div>
        ${o.photo_n ? `<div class="muted small">${bi('draft.photos', { N: o.photo_n })}${o.size_kb ? ` · ${bi('draft.size')}: ${fmtNumber(o.size_kb)} KB` : ''}</div>` : ''}
      </div>`).join('')}</div>` : ''}`;
  const again = () => renderDrafts(view, { shell });
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { curTab = b.dataset.tab; again(); }));
  view.querySelector('#dr-sync').addEventListener('click', async (e) => { e.currentTarget.disabled = true; await syncNow(); again(); });
  view.querySelector('#dr-backup').addEventListener('click', backupFile);
  view.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', async () => { await requeue(b.dataset.retry); await syncNow({ quiet: true }); again(); }));
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok1 = await dialog({ title: bi('btn.delete_draft'), body: `<p>${bi('draft.delete_confirm')}</p>`, actions: [{ label: bi('btn.cancel'), value: false }, { label: bi('btn.delete_draft'), kind: 'danger', value: true }] });
    if (!ok1) return;
    const ok2 = await dialog({ title: bi('btn.delete_draft'), body: `<p><strong>${bi('draft.delete_confirm')}</strong></p>`, actions: [{ label: bi('btn.cancel'), kind: 'primary', value: false }, { label: bi('btn.delete_draft'), kind: 'danger', value: true }] });
    if (!ok2) return;
    await deleteQueued(b.dataset.del);
    again();
  }));
}

/** Xung đột: lượt kiểm đã bị người khác (Trưởng bộ phận) sửa trước khi bản của tôi lên máy chủ */
export async function renderConflict(view, { shell, params }) {
  shell.setScreen({ title: 'conflict.title', back: '/account/drafts' });
  const op = (await queueItems()).find((o) => o.operation_id === params.op);
  if (!op || op.state !== 'CONFLICT') { view.innerHTML = `<div class="card">${bi('err.not_found')}</div>`; return; }
  const desc = await describer();
  view.innerHTML = `<div class="card"><p><strong>${actionLabel(op.action)}</strong> · ${esc(fmtDateTime(op.local_created_at))}</p><p class="small">${desc(op)}</p>
    <p class="muted small">${bi('conflict.help_run')}</p>
    <div class="row"><button type="button" class="btn small" id="cf-backup">${bi('btn.export_backup')}</button>
    <button type="button" class="btn small" id="cf-server">${bi('btn.use_server')}</button>
    <button type="button" class="btn small primary" id="cf-edit">${bi('conflict.mine_on_top')}</button></div></div>`;
  $('#cf-backup', view).addEventListener('click', backupFile);
  $('#cf-server', view).addEventListener('click', async () => {
    const ok = await dialog({ title: bi('btn.use_server'), body: `<p>${bi('conflict.use_server_confirm')}</p>`, actions: [{ label: bi('btn.cancel'), value: false }, { label: bi('btn.use_server'), kind: 'primary', value: true }] });
    if (!ok) return;
    await deleteQueued(op.operation_id);
    navigate('/account/drafts', { replace: true });
  });
  $('#cf-edit', view).addEventListener('click', async () => {
    const ver = op.conflict && (op.conflict.server_version ?? op.conflict.record_version);
    if (ver === undefined || ver === null) { toast(bi('conflict.help_run')); return; }
    await rebaseQueued(op.operation_id, ver);
    toast(bi('conflict.rebased'), 'ok');
    await syncNow({ quiet: true });
    navigate('/account/drafts', { replace: true });
  });
}
