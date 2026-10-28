// Kiểm tra hôm nay: ca đang chạy, vòng tiến độ, nút quét, danh sách máy phải kiểm kỳ này theo khu vực, việc chờ Trưởng bộ phận
import { bi, biText, esc, badge, fmtDate, nameText } from '../core.js';
import { ICON } from '../ui.js';
import { isWide } from '../shell.js';
import { dueList, roleLevel, today, currentShift, nowMs, shifts, openAbnormals, missedPeriods, unconfirmedDays, users, userName } from '../data.js';
import { periodSpan } from '../judge.js';
import { scanAndOpen } from '../app.js';

let filter = 'todo';

/** Nhãn trạng thái một phiếu kỳ này */
export function stateBadge(st) {
  if (st.key === 'PARTIAL') return badge('state.PARTIAL', { N: st.filled, M: st.total });
  if (st.key === 'FAIL' || st.key === 'WARN') return badge('state.' + st.key, { N: st.n });
  return badge('state.' + st.key);
}

/** "Mỗi ca · 10 mục" */
export function freqText(tpl, items) {
  return `${bi('freq_each.' + tpl.frequency)}${items ? ` · ${bi('home.items_n', { N: items })}` : ''}`;
}

function lastText(last, um) {
  if (!last) return '';
  const res = last.fail_count ? 'state_short.FAIL' : last.warn_count ? 'state_short.WARN' : 'state_short.DONE';
  const when = last.work_date === today() ? biText('home.today') : fmtDate(last.work_date);
  return ` · ${bi('home.last')}: ${esc(when)}${last.shift ? ' ' + bi('shift.n', { N: last.shift }) : ''}, ${bi(res)}${um ? ` (${esc(userName(um, last.checked_by))})` : ''}`;
}

function ring(done, total) {
  const r = 38, c = 2 * Math.PI * r;
  const k = total ? done / total : 0;
  return `<svg class="ring" width="92" height="92" viewBox="0 0 92 92" role="img" aria-label="${esc(biText('home.ring_aria', { N: done, M: total }))}">
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="#E2E6EB" stroke-width="10"/>
    ${done ? `<circle cx="46" cy="46" r="${r}" fill="none" stroke="#17324F" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * k).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 46 46)"/>` : ''}
  </svg>`;
}

function leftText(ms) {
  if (ms <= 0) return '';
  const m = Math.round(ms / 60000);
  return biText('home.left', { H: Math.floor(m / 60), M: m % 60 });
}

export async function renderToday(view, { shell }) {
  shell.setScreen({ title: 'today.title' });
  const lvl = roleLevel();
  const list = await dueList();
  const um = await users();
  const due = list.filter((d) => d.period);
  const off = list.filter((d) => !d.period);
  const n = {
    done: due.filter((d) => !['TODO', 'PARTIAL', 'LOCAL'].includes(d.state.key)).length,
    todo: due.filter((d) => ['TODO', 'PARTIAL', 'LOCAL'].includes(d.state.key)).length,
    fail: due.filter((d) => d.state.key === 'FAIL').length,
    warn: due.filter((d) => d.state.key === 'WARN').length
  };
  const cs = currentShift();
  const sh = shifts();
  const span = cs.def ? periodSpan('SHIFT', { date: cs.work_date }, cs.shift, sh) : null;
  const t = today();
  // Việc chờ Trưởng bộ phận
  let pend = null;
  if (lvl >= 3) pend = { abn: (await openAbnormals()).length, missed: (await missedPeriods()).length, days: (await unconfirmedDays()).length };
  const pick = {
    todo: (d) => ['TODO', 'PARTIAL', 'LOCAL'].includes(d.state.key),
    fail: (d) => d.state.key === 'FAIL',
    done: (d) => !['TODO', 'PARTIAL', 'LOCAL'].includes(d.state.key),
    all: () => true
  };
  if (!pick[filter]) filter = 'todo';
  const shown = (filter === 'all' ? list : due).filter(pick[filter]);
  // Nhóm theo khu vực
  const groups = new Map();
  for (const d of shown) {
    const k = d.area ? d.area.area_id : '';
    if (!groups.has(k)) groups.set(k, { area: d.area, items: [] });
    groups.get(k).items.push(d);
  }
  const gList = [...groups.values()].sort((a, b) => String(a.area ? a.area.area_code || a.area.name_vi : '~').localeCompare(String(b.area ? b.area.area_code || b.area.name_vi : '~')));
  const item = (d) => {
    const href = d.period ? '#/check/' + encodeURIComponent(d.asg.assignment_id) : '#/m/' + encodeURIComponent(d.mac.machine_id);
    const sub = d.state.key === 'LOCAL' ? ` · ${bi('home.local_wait')}` : (d.run ? ` · ${esc(userName(um, d.run.checked_by))}` : lastText(d.last, null));
    return `<a class="due-item st-${d.state.key.toLowerCase()}${d.period ? '' : ' dim'}" href="${href}">
      <div class="due-main"><div class="due-top"><span class="code">${esc(d.mac.machine_code)}</span>${d.period ? stateBadge(d.state) : badge('state.OFF_SHIFT')}</div>
      <div class="due-name">${esc(nameText(d.mac))}</div>
      <div class="muted small">${esc(nameText(d.tpl))} · ${freqText(d.tpl, d.items)}${sub}</div></div>${ICON.chevron}</a>`;
  };
  const chips = [['todo', 'home.f_todo', n.todo], ['fail', 'home.f_fail', n.fail], ['done', 'home.f_done', n.done], ['all', 'home.f_all', list.length]];
  const shiftCard = `<section class="card shift-card">
      <div class="shift-head"><h2>${cs.def ? `${bi('shift.name' + cs.shift)} <span class="muted">${esc(cs.def.start)} – ${esc(cs.def.end)}</span>` : bi('home.no_shift')}</h2>
        ${span ? `<span class="muted small">${esc(leftText(span.end - nowMs()))}</span>` : ''}</div>
      <div class="shift-body"><div class="ring-box">${ring(n.done, due.length)}<div class="ring-num"><strong>${n.done}/${due.length}</strong><span>${bi('home.ring_unit')}</span></div></div>
        <div class="kcounts">
          <div class="kc"><strong>${n.done}</strong><span>${bi('home.c_done')}</span></div>
          <div class="kc"><strong>${n.todo}</strong><span>${bi('home.c_todo')}</span></div>
          <div class="kc red"><strong>${n.fail}</strong><span>${bi('home.c_fail')}</span></div>
          <div class="kc amber"><strong>${n.warn}</strong><span>${bi('home.c_warn')}</span></div>
        </div></div>
    </section>`;
  const pendCard = pend && (pend.abn || pend.missed || pend.days) ? `<a class="card pend-card" href="#/pending">
      <div class="pend-title">${ICON.alert}<strong>${bi('home.pending_me')}</strong>${ICON.chevron}</div>
      <div class="pend-rows">${pend.abn ? `<span class="t-red-text">${bi('pend.n_abn', { N: pend.abn })}</span>` : ''}${pend.missed ? `<span>${bi('pend.n_missed', { N: pend.missed })}</span>` : ''}${pend.days ? `<span>${bi('pend.n_days', { N: pend.days })}</span>` : ''}</div></a>` : '';
  const listHtml = `<div class="chips" role="tablist">${chips.map(([k, l, c]) => `<button type="button" class="chip${filter === k ? ' on' : ''}" data-f="${k}">${bi(l)} <b>${c}</b></button>`).join('')}</div>
    ${gList.map((g) => {
      const left = g.items.filter((d) => d.period && ['TODO', 'PARTIAL', 'LOCAL'].includes(d.state.key)).length;
      return `<div class="area-head"><h3>${g.area ? esc(nameText(g.area)) : bi('home.no_area')}</h3>${left ? `<span class="muted small">${bi('home.left_n', { N: left })}</span>` : ''}</div>
        <div class="due-list">${g.items.map(item).join('')}</div>`;
    }).join('') || `<div class="card empty-state"><p class="muted">${bi(list.length ? (filter === 'todo' ? 'home.all_done' : 'home.none_filter') : (lvl >= 3 ? 'home.no_assign_c3' : 'home.no_assign'))}</p>
      ${!list.length && lvl >= 3 ? `<a class="btn small primary" href="#/machines">${bi('nav.machines')}</a>` : ''}</div>`}
    ${off.length && filter !== 'all' ? `<p class="muted small">${bi('home.off_shift_n', { N: off.length })}</p>` : ''}`;
  const scanBtn = `<button type="button" class="scan-big" id="h-scan">${ICON.scan}<span>${bi('home.scan')}</span></button>`;
  view.innerHTML = isWide()
    ? `<div class="home-web"><div class="home-web-main">${listHtml}</div><aside class="home-web-side">${shiftCard}${scanBtn}${pendCard}</aside></div>`
    : `${shiftCard}${scanBtn}${pendCard}${listHtml}`;
  view.querySelector('#h-scan').addEventListener('click', () => scanAndOpen());
  view.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; renderToday(view, { shell }); }));
}
