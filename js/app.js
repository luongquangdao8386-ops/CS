// Điều khiển app sau đăng nhập: khung, định tuyến, đồng bộ nền, quét QR máy
import { bi, esc, session, resMsg } from './core.js';
import { getMeta, pullChanges, queueItems, flushQueue, takeWriteChanges } from './sync.js';
import { mountShell, isWide } from './shell.js';
import { route, match, currentPath, queryParams, navigate, back, startRouter, refresh, lastNavKind } from './router.js';
import { invalidate, boot as bootData, dueList, pendingCount } from './data.js';
import { toast, dialog, reloadFreshHtml, wireReloadFresh, resetListChunks } from './ui.js';
import { openScanner, parseScan, resolveScan, qrStateText } from './scan.js';

export const app = {
  shell: null,
  offline: false,
  /** máy chủ đang bảo trì (SYSTEM_MAINTENANCE): chỉ xem dữ liệu trên máy */
  maintenance: false,
  /** do main.js gán: đăng xuất, đăng nhập lại, xử lý lỗi phiên */
  onLogout: null,
  onRelogin: null,
  onSessionError: null
};

let lastWide = null;
let renderSeq = 0;

async function renderRoute() {
  const seq = ++renderSeq;
  const path = currentPath();
  const m = match(path);
  const shell = app.shell;
  if (!m) { navigate('/', { replace: true }); return; }
  shell.setActive(m.route.opts.nav || '');
  shell.setBackHandler((target) => back(target || '/'));
  const main = shell.view;
  main.className = 'view';
  // Mỗi địa chỉ một khung nội dung riêng: màn trước tải chậm xong muộn chỉ vẽ vào khung cũ đã gỡ
  const hash = location.hash || '#/';
  let view = main.firstElementChild;
  const redraw = !!view && view.classList.contains('view-page') && view.dataset.hash === hash;
  if (!redraw) {
    const fresh = document.createElement('div');
    fresh.className = 'view-page';
    fresh.dataset.hash = hash;
    main.replaceChildren(fresh);
    view = fresh;
    view.innerHTML = '<div class="loading"><div class="spinner small" aria-hidden="true"></div></div>';
  }
  const mod = path.split('/').slice(0, 2).join('/');
  const kind = lastNavKind();
  const entered = mod !== main.dataset.path && kind !== 'pop' && kind !== 'refresh';
  if (entered) resetListChunks();
  main.dataset.path = mod;
  // Màn đã bị thay không được đổi tiêu đề/nút trên header nữa
  const pageShell = Object.assign(Object.create(shell), { setScreen: (o) => { if (seq === renderSeq) shell.setScreen(o); } });
  try {
    await m.route.handler(view, { params: m.params, query: Object.fromEntries(queryParams()), shell: pageShell, app, seq, entered, isCurrent: () => seq === renderSeq });
  } catch (e) {
    if (seq !== renderSeq) return;
    view.innerHTML = `<div class="card"><p class="banner warn">${bi('err.client')}: ${esc(e && e.message)}</p>${reloadFreshHtml()}</div>`;
    wireReloadFresh(view);
    console.error(e);
  }
}

/** Cập nhật dải đồng bộ và số việc chờ */
export async function updateSyncStatus() {
  if (!app.shell) return;
  const q = await queueItems().catch(() => []);
  const mine = q.filter((o) => o.user_id === (session.user && session.user.user_id) && o.dataset_epoch === session.epoch);
  const problems = mine.filter((o) => o.state === 'CONFLICT' || o.state === 'REJECTED').length;
  app.shell.setSync({ offline: app.offline || !navigator.onLine, maintenance: !!app.maintenance, lastSync: await getMeta('last_sync'), queued: mine.length - problems, problems });
  try { app.shell.setBadge('pending', await pendingCount()); } catch (e) { console.warn(e); }
}

let syncing = null;

async function runSync() {
  const f = await flushQueue();
  if (f.stopped_code === 'SYSTEM_MAINTENANCE') { await setMaintenance(true); return { ok: false, code: f.stopped_code, committed: f.committed }; }
  if (f.stopped_code && app.onSessionError && await app.onSessionError({ code: f.stopped_code, data: f.response && f.response.data })) return { ok: false, code: f.stopped_code, handled: true, committed: f.committed };
  const r = await pullChanges();
  if (r.code === 'SYSTEM_MAINTENANCE') { await setMaintenance(true); return { ...r, committed: f.committed }; }
  invalidate();
  app.offline = false;
  if (r.ok && app.maintenance) { app.maintenance = false; toast(bi('sys.maintenance_over'), 'ok'); }
  await updateSyncStatus();
  if (!r.ok) {
    if (app.onSessionError && await app.onSessionError(r)) return { ...r, handled: true, committed: f.committed };
    return { ...r, committed: f.committed };
  }
  return { ok: true, committed: f.committed, applied: r.applied || 0 };
}

/** Máy chủ đang bảo trì: app chỉ xem dữ liệu trên máy; mỗi phút hỏi lại */
export async function setMaintenance(on) {
  app.maintenance = on;
  if (on) app.offline = true;
  await updateSyncStatus();
}

let rechecking = false;
async function recheckMaintenance() {
  if (!app.shell || !app.maintenance || rechecking || !navigator.onLine || document.visibilityState !== 'visible') return;
  rechecking = true;
  try {
    const r = await syncNow({ quiet: true });
    if (r && r.ok) refresh();
  } finally { rechecking = false; }
}
setInterval(recheckMaintenance, 60000);

/**
 * Đồng bộ ngay: gửi hàng chờ rồi lấy thay đổi. Trả {ok, code, committed}.
 * Hai lần gọi trùng nhau dùng chung một lượt, không gửi hai lần.
 */
export async function syncNow({ quiet = false } = {}) {
  if (!navigator.onLine) { if (!quiet) toast(bi('sync.need_network'), 'err'); return { ok: false, code: 'NETWORK_ERROR' }; }
  const r = await (syncing || (syncing = runSync().finally(() => { syncing = null; })));
  if (!r.ok) { if (!quiet && !r.handled) toast(esc(resMsg(r)), 'err'); return r; }
  if (r.committed) toast(bi('sync.committed_n', { N: r.committed }), 'ok');
  else if (!quiet) toast(bi('sync.done'), 'ok');
  return r;
}

/** Sau một thao tác ghi COMMITTED: lấy thay đổi (dùng luôn thay đổi máy chủ gửi kèm phản hồi ghi nếu cùng cursor) */
export async function afterCommit() {
  const r = await pullChanges({ first: takeWriteChanges(await getMeta('cursor')) });
  invalidate();
  await updateSyncStatus();
  return r;
}

/** Mở máy vừa quét: một mẫu đang tới kỳ → vào thẳng màn kiểm; nhiều mẫu → màn máy để chọn */
export async function openMachine(machineId, { replace = false } = {}) {
  const due = (await dueList({ all: true })).filter((d) => d.mac.machine_id === machineId && d.period);
  if (due.length === 1) { navigate('/check/' + encodeURIComponent(due[0].asg.assignment_id), { replace }); return; }
  navigate('/m/' + encodeURIComponent(machineId), { replace });
}

/** Quét QR từ nav/menu */
export function scanAndOpen() {
  openScanner({
    onResult: async (raw, info) => {
      const r = await resolveScan(parseScan(raw, info.manual));
      await openResolved(r);
    }
  });
}

export async function openResolved(r) {
  if (r.qr_state === 'OK' && r.machine_id) { await openMachine(r.machine_id); return; }
  if (r.qr_state === 'INACTIVE' && r.machine_id) { navigate('/m/' + encodeURIComponent(r.machine_id)); toast(bi('qr_inactive')); return; }
  await dialog({
    title: bi('nav.scan'),
    body: `<p>${bi(qrStateText(r.qr_state) || 'qr_unavailable')}</p>${r.qr_state === 'FOREIGN' && r.raw ? `<p class="raw">${esc(r.raw.slice(0, 300))}</p>` : ''}`,
    actions: [{ label: bi('btn.close'), kind: 'primary', value: true }]
  });
}

function registerRoutes() {
  const lazy = (mod, fn) => async (view, ctx) => { const m = await import(mod); return m[fn](view, ctx); };
  route('/', lazy('./pages/home.js', 'renderHome'), { nav: 'home' });
  route('/today', lazy('./pages/today.js', 'renderToday'), { nav: 'today' });
  route('/check/:assignment', lazy('./pages/check.js', 'renderCheck'), { nav: 'today' });
  route('/m/:machine', lazy('./pages/machines.js', 'renderMachine'), { nav: 'machines' });
  route('/month', lazy('./pages/month.js', 'renderMonth'), { nav: 'month' });
  route('/history', lazy('./pages/history.js', 'renderHistory'), { nav: 'home' });
  route('/pending', lazy('./pages/pending.js', 'renderPending'), { nav: 'pending' });
  route('/machines', lazy('./pages/machines.js', 'renderMachines'), { nav: 'machines' });
  route('/templates', lazy('./pages/templates.js', 'renderTemplates'), { nav: 'templates' });
  route('/templates/library', lazy('./pages/templates.js', 'renderLibrary'), { nav: 'templates' });
  route('/templates/new', lazy('./pages/templates.js', 'renderTemplateForm'), { nav: 'templates' });
  route('/templates/:id', lazy('./pages/templates.js', 'renderTemplateForm'), { nav: 'templates' });
  route('/reports', lazy('./pages/reports.js', 'renderReports'), { nav: 'reports' });
  route('/account', lazy('./pages/account.js', 'renderAccount'), { nav: 'account' });
  route('/account/drafts', lazy('./pages/drafts.js', 'renderDrafts'), { nav: 'account' });
  route('/account/conflict/:op', lazy('./pages/drafts.js', 'renderConflict'), { nav: 'account' });
  route('/admin/users', lazy('./pages/admin.js', 'renderUsers'), { nav: 'account' });
  route('/admin/status', lazy('./pages/admin.js', 'renderStatus'), { nav: 'account' });
  route('/admin/shifts', lazy('./pages/admin.js', 'renderShifts'), { nav: 'account' });
  route('/admin/me-link', lazy('./pages/admin.js', 'renderMeLink'), { nav: 'account' });
  route('/admin/report-logo', lazy('./pages/admin.js', 'renderReportLogo'), { nav: 'account' });
  route('/admin/backup', lazy('./pages/admin.js', 'renderBackup'), { nav: 'account' });
  route('/admin/audit', lazy('./pages/admin.js', 'renderAudit'), { nav: 'account' });
  route('/admin/sample', lazy('./pages/admin.js', 'renderSample'), { nav: 'account' });
  // Link tem QR M&E mở trong app (vd quét bằng Camera rồi chọn mở bằng Checksheet)
  route('/r/:key', async (view, ctx) => {
    const r = await resolveScan(parseScan(ctx.params.key, true));
    if (r.qr_state === 'OK') { await openMachine(r.machine_id, { replace: true }); return; }
    navigate('/', { replace: true });
    await openResolved(r);
  }, { nav: '' });
}

let routesReady = false;

/** Vào app (sau đăng nhập hoặc mở khóa ngoại tuyến) */
export async function enterApp(root, { offline = false, maintenance = false } = {}) {
  app.offline = offline || maintenance;
  app.maintenance = maintenance;
  invalidate();
  const b = await bootData();
  if (!routesReady) { registerRoutes(); routesReady = true; }
  app.shell = mountShell(root, { env: b.env, onScan: scanAndOpen });
  app.shell.setSessionWarn(session.expires_at, () => app.onRelogin && app.onRelogin());
  await updateSyncStatus();
  lastWide = isWide();
  startRouter(renderRoute);
  await renderRoute();
  // Vào app khi có mạng: gửi nháp của người này ở nền
  if (!offline) sendMineInBackground();
}

async function hasMineQueued() {
  const uid = session.user && session.user.user_id;
  return !!uid && (await queueItems().catch(() => [])).some((o) => o.user_id === uid && o.dataset_epoch === session.epoch && o.state !== 'REJECTED' && o.state !== 'CONFLICT');
}

async function sendMineInBackground() {
  if (!navigator.onLine || !app.shell || !(await hasMineQueued())) return;
  refreshAfterSend(await syncNow({ quiet: true }));
}

// Đổi giữa bố cục iPhone và web khi xoay/kéo cửa sổ: vẽ lại màn hiện tại (không vẽ lại khi đang gõ trong màn kiểm)
window.addEventListener('resize', () => {
  if (!app.shell) return;
  const w = isWide();
  if (w === lastWide) return;
  lastWide = w;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest('.view')) return;
  refresh();
});

// Màn xem (Hôm nay, Bảng tháng, Chờ xử lý, máy) vẽ lại sau khi tự gửi nháp xong.
// Không vẽ lại màn nhập (kiểm tra, sửa mẫu), khi đang mở hộp thoại hoặc đang gõ.
const VIEW_PAGE = /^\/(today|history|month|pending|machines|m\/[^/]+|account(\/drafts)?)?$/;
export function refreshAfterSend(r) {
  if (!app.shell) return;
  const path = currentPath();
  if (!r || !(r.committed || r.applied) || !VIEW_PAGE.test(path) || document.querySelector('.modal')) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('.view')) return;
  refresh();
}

window.addEventListener('online', async () => {
  app.offline = false;
  await updateSyncStatus();
  const r = app.shell && await hasMineQueued() ? await syncNow({ quiet: true }) : null;
  refreshAfterSend(r);
});
window.addEventListener('offline', () => { updateSyncStatus(); if (app.shell && currentPath().startsWith('/account')) refresh(); });

// Quay lại app/tab: lần đồng bộ cuối quá 1 phút thì lấy thay đổi của người khác; có thay đổi thì vẽ lại màn xem đang mở
let lastReturnSync = 0;
async function syncOnReturn() {
  if (app.maintenance) return recheckMaintenance();
  if (!app.shell || app.offline || !navigator.onLine || document.visibilityState !== 'visible') return;
  const last = Date.parse((await getMeta('last_sync')) || '') || 0;
  if (Date.now() - Math.max(last, lastReturnSync) < 60000) return;
  lastReturnSync = Date.now();
  refreshAfterSend(await syncNow({ quiet: true }));
}
document.addEventListener('visibilitychange', syncOnReturn);
window.addEventListener('focus', syncOnReturn);
// Trang Hôm nay đổi theo ca: mỗi phút vẽ lại nếu sang ca mới (không khi đang gõ)
let lastShiftKey = '';
setInterval(async () => {
  if (!app.shell || !['/', '/today'].includes(currentPath())) return;
  const { currentShift } = await import('./data.js');
  const s = currentShift();
  const k = s.work_date + '#' + s.shift;
  if (lastShiftKey && k !== lastShiftKey) refresh();
  lastShiftKey = k;
}, 60000);
