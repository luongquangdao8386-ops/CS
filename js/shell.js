// Khung app sau đăng nhập (không logo công ty): header, nav 4 nút iPhone, menu trái web
import { bi, biText, esc, fmtDate, fmtDateTime, session, badge, L } from './core.js';
import { ICON, h, $, $$ } from './ui.js';
import { isIosSafariTab } from './auth.js';

/** Nav dưới của iPhone: Hôm nay · Quét · Bảng tháng · Tài khoản */
const NAV = [
  { key: 'home', label: 'nav.home', icon: 'home', path: '/' },
  { key: 'scan', label: 'nav.scan', icon: 'scan' },
  { key: 'month', label: 'nav.month', icon: 'calendar', path: '/month' },
  { key: 'account', label: 'nav.account', icon: 'user', path: '/account' }
];
/** Menu trái của web (lvl: cấp tối thiểu để hiện) */
const SIDE = [
  { key: 'home', label: 'nav.home', icon: 'home', path: '/', lvl: 1 },
  { key: 'month', label: 'nav.month', icon: 'calendar', path: '/month', lvl: 1 },
  { key: 'pending', label: 'nav.pending', icon: 'alert', path: '/pending', lvl: 3 },
  { key: 'machines', label: 'nav.machines', icon: 'equipment', path: '/machines', lvl: 1 },
  { key: 'templates', label: 'nav.templates', icon: 'checklist', path: '/templates', lvl: 3 },
  { key: 'reports', label: 'nav.reports', icon: 'reports', path: '/reports', lvl: 1 },
  { key: 'account', label: 'nav.account', icon: 'user', path: '/account', lvl: 1 }
];

export const isWide = () => window.matchMedia('(min-width: 900px)').matches;

/**
 * Dựng khung. opts: {env, onScan}. Trả API {view, setScreen, setActive, setSync, setBadge, setSessionWarn}
 */
export function mountShell(root, { env, onScan }) {
  const lvl = Number(session.user && session.user.role_level) || 0;
  const el = h(`<div class="app">
    <aside class="side" aria-label="${esc(biText('menu.title'))}">
      <div class="side-title">${bi('menu.title')}</div>
      <nav class="side-nav">
        ${SIDE.filter((it) => lvl >= it.lvl).map((it, i) => `${i && it.key === 'account' ? '<hr>' : ''}<a class="side-item" href="#${it.path}" data-nav="${it.key}">${ICON[it.icon]}<span class="side-label">${bi(it.label)}</span></a>`).join('')}
      </nav>
      <button type="button" class="scan-btn side-scan" id="side-scan">${ICON.scan}<span>${bi('nav.scan_qr')}</span></button>
    </aside>
    <div class="frame">
      <header class="hdr">
        <button type="button" class="icon-btn hdr-back" id="hdr-back" aria-label="${esc(biText('btn.back'))}" hidden>${ICON.back}</button>
        <h1 class="hdr-title" id="hdr-title"></h1>
        ${env === 'THU' ? `<span class="tag env">${bi('tag.env_test')}</span>` : ''}
        <span class="hdr-space"></span>
        <div class="hdr-actions" id="hdr-actions"></div>
        <button type="button" class="hdr-status" id="hdr-status"></button>
      </header>
      <div class="strip offline" id="st-offline" hidden>${ICON.wifiOff}<span id="st-offline-text"></span></div>
      ${isIosSafariTab() ? `<div class="strip warn" id="st-safari"><span>${bi('sync.safari_tab')}</span></div>` : ''}
      <div class="strip warn" id="st-session" hidden></div>
      <main class="view" id="view"></main>
    </div>
    <nav class="bnav bnav4" aria-label="${esc(biText('menu.title'))}">
      ${NAV.map((n) => {
        if (n.key === 'scan') return `<button type="button" class="bnav-item bnav-scan" id="bnav-scan"><span class="bnav-scan-box">${ICON.scan}</span><span class="bnav-label">${bi(n.label)}</span></button>`;
        return `<button type="button" class="bnav-item" data-nav="${n.key}" data-path="${n.path}">${ICON[n.icon]}<span class="bnav-label">${bi(n.label)}</span></button>`;
      }).join('')}
    </nav>
  </div>`);
  root.replaceChildren(el);
  const view = $('#view', el);
  let backTarget = null, onBack = null, screenHash = null;

  el.addEventListener('click', (e) => {
    const nb = e.target.closest('.bnav-item[data-path]');
    if (nb) {
      e.preventDefault();
      // Bấm lại nút của màn đang mở: lên đầu trang
      if (location.hash === '#' + nb.dataset.path) { view.scrollTop = 0; window.scrollTo(0, 0); }
      import('./router.js').then((r) => r.navigate(nb.dataset.path));
    }
  });
  $('#bnav-scan', el).addEventListener('click', () => onScan && onScan());
  $('#side-scan', el).addEventListener('click', () => onScan && onScan());
  $('#hdr-back', el).addEventListener('click', () => { if (onBack) onBack(backTarget); });
  $('#hdr-status', el).addEventListener('click', () => import('./router.js').then((r) => r.navigate('/account')));

  const api = {
    root: el,
    view,
    /** title: khóa từ điển hoặc cặp [vi, zh]; back: đường dẫn màn cha (null = không có nút); actions: [{icon, label, onClick, id, disabled}] */
    setScreen({ title, back = null, actions = [], home = false, wide = false }) {
      el.classList.toggle('is-home', !!home);
      el.classList.toggle('is-wide-page', !!wide);
      const pair = Array.isArray(title) ? title : (L[title] || [String(title), '']);
      $('#hdr-title', el).innerHTML = `<span class="vi">${esc(pair[0])}</span><span class="sep"> · </span><span class="zh">${esc(pair[1] || '')}</span>`;
      document.title = pair[0] ? `${pair[0]} · ${pair[1] || ''}` : 'Checksheet';
      backTarget = back;
      $('#hdr-back', el).hidden = back === null;
      const box = $('#hdr-actions', el);
      box.innerHTML = '';
      actions.slice(0, 2).forEach((a) => {
        const b = h(`<button type="button" class="icon-btn" ${a.id ? `id="${a.id}"` : ''} aria-label="${esc(a.label)}" title="${esc(a.label)}">${ICON[a.icon] || ''}</button>`);
        if (a.disabled) b.disabled = true;
        b.addEventListener('click', a.onClick);
        box.appendChild(b);
      });
      // Sang màn khác (đổi địa chỉ) thì lên đầu trang; vẽ lại cùng màn giữ chỗ đang xem
      const hash = location.hash || '#/';
      if (hash !== screenHash) { screenHash = hash; view.scrollTop = 0; window.scrollTo(0, 0); }
    },
    setBackHandler(fn) { onBack = fn; },
    /** Số trên mục điều hướng (Chờ xử lý: việc chờ Trưởng bộ phận); 0 thì ẩn */
    setBadge(key, n) {
      $$(`[data-nav="${key}"]`, el).forEach((x) => {
        let b = x.querySelector('.nav-badge');
        if (!n) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; x.appendChild(b); }
        b.textContent = n > 99 ? '99+' : String(n);
        b.title = biText('pend.count', { N: n });
      });
    },
    setActive(key) {
      $$('[data-nav]', el).forEach((x) => x.classList.toggle('active', x.dataset.nav === key));
    },
    /** Trạng thái đồng bộ ở góc phải header (web) */
    setSync({ offline, maintenance = false, lastSync, queued = 0, problems = 0 }) {
      const u = session.user || {};
      const lv = Number(u.role_level) || 0;
      const off = offline || maintenance;
      const pill = maintenance ? 'sync.maintenance' : offline ? 'sync.offline' : 'sync.online';
      $('#hdr-status', el).innerHTML = `<span class="pill ${off ? 't-red' : 't-green'}">${off ? ICON.wifiOff : ICON.sync}<span>${bi(pill)}</span></span>
        <span class="hdr-sync muted">${bi('sync.last')}: ${esc(fmtDateTime(lastSync) || '—')}${queued ? ` · ${bi('sync.queued_count', { N: queued })}` : ''}${problems ? ` · <span class="t-red-text">${bi('sync.failed')} ${problems}</span>` : ''}</span>
        <span class="hdr-user"><strong>${esc(u.display_name || '')}</strong> ${lv ? badge('level.' + lv) : ''}</span>`;
      const strip = $('#st-offline', el);
      strip.hidden = !off;
      $('#st-offline-text', el).innerHTML = `${bi(maintenance ? 'sys.maintenance_strip' : 'sync.offline')} — ${bi('sync.last')}: ${esc(fmtDateTime(lastSync) || '—')}${queued ? ` · ${bi('sync.queued_count', { N: queued })}` : ''}`;
    },
    /** Dải "Phiên sắp hết hạn" từ session_warn_days ngày trước hạn */
    setSessionWarn(expiresAt, onRelogin) {
      const s = $('#st-session', el);
      const warnDays = Number(session.settings.session_warn_days || 3);
      const t = Date.parse(expiresAt || '');
      if (!t || t - Date.now() > warnDays * 86400000) { s.hidden = true; return; }
      s.hidden = false;
      s.innerHTML = `<span>${bi('auth.session_warn', { D: fmtDate(expiresAt) })}</span><button type="button" class="btn tiny" id="st-relogin">${bi('btn.relogin')}</button>`;
      $('#st-relogin', s).addEventListener('click', onRelogin);
    }
  };
  return api;
}
