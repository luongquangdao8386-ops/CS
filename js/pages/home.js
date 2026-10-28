// Trang chủ (cùng khuôn với trang chủ M&E): biểu tượng app + Checksheet trên nền nhà máy, ô Chờ bạn xử lý, lịch tuần,
// lưới ô chức năng có số đếm; web thêm bảng Phiếu kỳ này
import { bi, biText, esc, fmtDate, session, nameText } from '../core.js';
import { brandHtml, ICON } from '../ui.js';
import { isWide } from '../shell.js';
import { recs, dueList, roleLevel, today, weekday, openAbnormals, missedPeriods, unconfirmedDays, users, userName, weekSummary } from '../data.js';
import { queueItems } from '../sync.js';
import { addDaysIso } from '../judge.js';
import { navigate } from '../router.js';
import { stateBadge } from './today.js';
import { periodLabel } from './check.js';

const TODO = ['TODO', 'PARTIAL', 'LOCAL'];

/** Ô "Chờ bạn xử lý" (Trưởng bộ phận, Quản trị) */
async function pendingHtml() {
  if (roleLevel() < 3) return '';
  const [abn, missed, days] = [(await openAbnormals()).length, (await missedPeriods()).length, (await unconfirmedDays()).length];
  if (!abn && !missed && !days) return '';
  return `<a class="card pend-card" href="#/pending">
    <div class="pend-title">${ICON.alert}<strong>${bi('home.pending_me')}</strong>${ICON.chevron}</div>
    <div class="pend-rows">${abn ? `<span class="t-red-text">${bi('pend.n_abn', { N: abn })}</span>` : ''}${missed ? `<span>${bi('pend.n_missed', { N: missed })}</span>` : ''}${days ? `<span>${bi('pend.n_days', { N: days })}</span>` : ''}</div></a>`;
}

/** Lịch tuần: mỗi ngày số phiếu Đạt / Cần chú ý / Không đạt / bỏ sót; ngày tới: số phiếu phải kiểm */
async function weekHtml() {
  const t = today();
  const from = addDaysIso(t, 1 - weekday(t));
  const to = addDaysIso(from, 6);
  const sum = await weekSummary(from, 7);
  const chip = (cls, n, key) => (n ? `<span class="day-item wk-${cls}" title="${esc(biText(key))}">${cls === 'ok' ? '✓' : cls === 'warn' ? '!' : cls === 'fail' ? '✕' : cls === 'missed' ? '–' : ''} ${n}</span>` : '');
  return `<section class="card home-week">
    <div class="card-head"><h2>${bi('home.week')}</h2><span class="muted">${esc(fmtDate(from))} – ${esc(fmtDate(to))}</span>
      <a class="btn tiny" href="#/month">${ICON.calendar}<span>${bi('nav.month')}</span></a></div>
    <div class="week">${sum.map((x) => {
      const items = x.date > t
        ? (x.due ? `<span class="day-item wk-plan" title="${esc(biText('home.wk_plan'))}">${x.due} ${bi('home.ring_unit')}</span>` : '')
        : chip('ok', x.ok, 'res.OK') + chip('warn', x.warn + x.partial, 'res.WARN') + chip('fail', x.fail, 'res.FAIL') + chip('missed', x.missed, 'state.MISSED')
          + (x.date === t && x.pending ? `<span class="day-item wk-plan">${bi('home.wk_left', { N: x.pending })}</span>` : '');
      const tag = x.date === t ? 'a' : 'div';
      return `<${tag} class="day${x.date === t ? ' today' : ''}"${x.date === t ? ' href="#/today"' : ''}><div class="day-head"><span>${bi('wd_short.' + weekday(x.date))}</span><span class="day-num">${esc(x.date.slice(8, 10))}/${esc(x.date.slice(5, 7))}</span></div>
        <div class="day-items">${items}</div></${tag}>`;
    }).join('')}</div>
    <div class="cal-legend small"><span>✓ ${bi('state_short.DONE')}</span><span>! ${bi('state_short.WARN')}</span><span>✕ ${bi('state_short.FAIL')}</span><span>– ${bi('state.MISSED')}</span></div></section>`;
}

/** Lưới ô chức năng (3 cột như M&E, không có ô Quét — Quét ở nav/menu); Trưởng bộ phận, Quản trị đủ 9 ô */
async function gridHtml(due) {
  const lvl = roleLevel();
  const uid = session.user && session.user.user_id;
  const left = due.filter((d) => d.period && TODO.includes(d.state.key)).length;
  const fail = due.filter((d) => d.period && d.state.key === 'FAIL').length;
  const macs = (await recs('MACHINE')).filter((m) => m.active).length;
  const tpls = (await recs('TEMPLATE')).filter((t) => t.active).length;
  const lib = (await recs('LIBRARY_ITEM')).filter((x) => x.active !== false).length;
  const q = (await queueItems().catch(() => [])).filter((o) => o.user_id === uid && o.dataset_epoch === session.epoch).length;
  const from7 = addDaysIso(today(), -6);
  const runs7 = (await recs('RUN')).filter((r) => r.work_date >= from7).length;
  const pend = lvl >= 3 ? (await openAbnormals()).length + (await missedPeriods()).length + (await unconfirmedDays()).length : 0;
  const tiles = [
    { key: 'today', icon: 'checklist', href: '/today', tail: left ? bi('home.left_n', { N: left }) : (due.length ? bi('home.all_done_short') : ''), red: fail ? bi('home.fail_n', { N: fail }) : '' },
    { key: 'month', icon: 'calendar', href: '/month' },
    { key: 'history', icon: 'file', href: '/history', tail: runs7 ? bi('hist.n7', { N: runs7 }) : '' },
    { key: 'pending', icon: 'alert', href: '/pending', lvl: 3, red: pend ? bi('pend.count', { N: pend }) : '', tail: pend ? '' : bi('home.none_pending') },
    { key: 'machines', icon: 'equipment', href: '/machines', tail: macs ? bi('mac.count', { N: macs }) : '' },
    { key: 'templates', icon: 'work', href: '/templates', lvl: 3, tail: tpls ? bi('tpl.count', { N: tpls }) : '' },
    { key: 'library', icon: 'library', href: '/templates/library', lvl: 3, tail: lib ? bi('home.items_n', { N: lib }) : '' },
    { key: 'reports', icon: 'reports', href: '/reports' },
    { key: 'drafts', icon: 'sync', href: '/account/drafts', tail: q ? bi('sync.queued_count', { N: q }) : bi('home.none_drafts') }
  ].filter((x) => !x.lvl || lvl >= x.lvl);
  return `<section class="grid9" aria-label="${esc(biText('menu.title'))}">${tiles.map((x) => {
    return `<a class="tile" href="#${x.href}">${ICON[x.icon]}<span class="tile-label">${bi('tile.' + x.key)}</span>${x.red ? `<span class="tile-count t-red-text">${x.red}</span>` : ''}${x.tail ? `<span class="tile-count">${x.tail}</span>` : ''}</a>`;
  }).join('')}</section>`;
}

/** Bảng Phiếu kỳ này (web): máy phải kiểm kỳ đang chạy, chưa kiểm và Không đạt lên trước */
async function todayTableHtml(due) {
  const um = await users();
  const rank = { FAIL: 0, TODO: 1, PARTIAL: 2, LOCAL: 3, WARN: 4, DONE: 5 };
  const rows = due.filter((d) => d.period).sort((a, b) => (rank[a.state.key] - rank[b.state.key]) || String(a.mac.machine_code).localeCompare(String(b.mac.machine_code)));
  return `<section class="card home-today"><div class="card-head"><h2>${bi('home.today_table')}</h2><a class="btn tiny" href="#/today">${ICON.checklist}<span>${bi('tile.today')}</span></a></div>
    ${rows.length ? `<div class="table-wrap"><table class="tbl clickable"><thead><tr>
      <th>${bi('mac.code')}</th><th>${bi('mac.name')}</th><th>${bi('rpt.area')}</th><th>${bi('check.template')}</th><th>${bi('home.col_period')}</th><th>${bi('col.status')}</th><th>${bi('rpt.row_checker')}</th></tr></thead>
      <tbody>${rows.map((d) => `<tr data-href="/check/${encodeURIComponent(d.asg.assignment_id)}"><td class="code">${esc(d.mac.machine_code)}</td><td>${esc(nameText(d.mac))}</td>
        <td>${esc(nameText(d.area))}</td><td>${esc(nameText(d.tpl))}</td><td>${periodLabel(d.tpl.frequency, d.period.work_date, d.period.shift)}</td>
        <td>${stateBadge(d.state)}</td><td>${d.run ? esc(userName(um, d.run.checked_by)) : ''}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted">${bi('home.no_assign')}</p>`}</section>`;
}

export async function renderHome(view, { shell }) {
  shell.setScreen({ title: 'nav.home', home: true });
  const wide = isWide();
  const u = session.user || {};
  const t = today();
  const due = await dueList();
  view.innerHTML = `<div class="home">
    <div class="home-hero">${brandHtml()}<div class="home-who">${esc(u.display_name || '')} · ${bi('level.' + roleLevel())}<br>${bi('weekday.' + weekday(t))} ${esc(fmtDate(t))}</div></div>
    <div class="home-body${wide ? ' wide' : ''}">
      <div class="home-left">${await pendingHtml()}${await weekHtml()}</div>
      <div class="home-right">${await gridHtml(due)}</div>
      ${wide ? `<div class="home-bottom">${await todayTableHtml(due)}</div>` : ''}
    </div></div>`;
  view.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => navigate(tr.dataset.href)));
}
