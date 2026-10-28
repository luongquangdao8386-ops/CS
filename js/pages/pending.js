// Chờ xử lý (Trưởng bộ phận): mục Không đạt chưa xử lý, máy bỏ sót kỳ kiểm, ngày chưa xác nhận — cần mạng để ghi
import { bi, esc, fmtDate, fmtDateTime, nameText, uuid } from '../core.js';
import { ICON, dialog, toast, $, $$ } from '../ui.js';
import { openAbnormals, missedPeriods, unconfirmedDays, mapOf, recs, roleLevel, myAreas, today, users, userName, weekday } from '../data.js';
import { addDaysIso } from '../judge.js';
import { writeOnline, writeWithPin, writeFail, oneLang, busy } from '../form.js';
import { app, afterCommit } from '../app.js';
import { periodLabel } from './check.js';

let tab = 'abn';

/** Hỏi một ô chữ (cách xử lý, lý do). Trả chuỗi hoặc null */
async function askText(titleHtml, labelKey, hintHtml = '') {
  const v = await dialog({
    title: titleHtml,
    body: `${hintHtml}<label class="lbl" for="ask-text">${bi(labelKey)}</label><textarea class="inp" id="ask-text" rows="3" maxlength="500"></textarea>
      <p class="muted small">${bi('pend.one_lang')}</p>`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.save'), kind: 'primary', read: (w) => $('#ask-text', w).value.trim() }]
  });
  if (v === null || v === undefined) return null;
  if (!v) { toast(bi('field.required'), 'err'); return null; }
  return v;
}

export async function renderPending(view, { shell }) {
  shell.setScreen({ title: 'nav.pending', back: '/' });
  if (roleLevel() < 3) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.forbidden')}</p></div>`; return; }
  const [abn, missed, days] = [await openAbnormals(), await missedPeriods(), await unconfirmedDays()];
  const macs = await mapOf('MACHINE');
  const areas = await mapOf('AREA');
  const um = await users();
  const docs = await recs('DOCUMENT');
  const online = navigator.onLine && !app.offline;
  const dis = online ? '' : ' disabled';
  const mine = myAreas();
  const again = () => renderPending(view, { shell });
  const tabs = [['abn', 'pend.tab_abn', abn.length], ['missed', 'pend.tab_missed', missed.length], ['days', 'pend.tab_days', days.length]];
  const backLimit = addDaysIso(today(), -7);
  let body = '';
  if (tab === 'abn') {
    body = abn.map((a) => {
      const m = macs.get(a.machine_id) || {};
      const nPh = docs.filter((d) => d.parent_run_id === a.run_id && d.item_key === a.item_key).length;
      return `<div class="card abn-card">
        <div class="row between"><span class="code">${esc(m.machine_code || '')}</span><span class="badge t-red">${bi('res.FAIL')}</span></div>
        <div class="rec-name">${esc(nameText(m))}</div>
        <div><strong>${esc(a.item_name_vi || a.item_name_zh)}</strong>${a.item_name_zh && a.item_name_vi ? ` <span class="zh">${esc(a.item_name_zh)}</span>` : ''}</div>
        <div>${bi('pend.value')}: <strong class="t-red-text">${esc(a.value_text || '—')}</strong> · ${bi('chk.std')}: ${esc(a.std_text || '—')}</div>
        ${a.note ? `<div class="abn-note">${esc(a.note)}</div>` : ''}
        <div class="muted small">${esc(fmtDate(a.work_date))}${a.shift ? ' · ' + bi('shift.n', { N: a.shift }) : ''} · ${esc(userName(um, a.reported_by))} · ${esc(fmtDateTime(a.reported_at))}${nPh ? ' · ' + bi('chk.photos_saved', { N: nPh }) : ''}</div>
        <div class="row"><button type="button" class="btn small primary" data-resolve="${esc(a.abnormal_id)}"${dis}>${ICON.check}<span>${bi('pend.resolve')}</span></button>
          <a class="btn small" href="#/month?m=${encodeURIComponent(a.machine_id)}&ym=${esc(String(a.work_date).slice(0, 7))}">${ICON.calendar}<span>${bi('nav.month')}</span></a></div>
      </div>`;
    }).join('') || `<div class="card empty-state"><p class="muted">${bi('pend.none_abn')}</p></div>`;
  } else if (tab === 'missed') {
    body = missed.map((x) => `<div class="card">
        <div class="row between"><span class="code">${esc(x.mac.machine_code)}</span><span class="badge t-grey">${bi('state.MISSED')}</span></div>
        <div class="rec-name">${esc(nameText(x.mac))}</div>
        <div class="muted small">${esc(nameText(x.tpl))} · ${periodLabel(x.tpl.frequency, x.work_date, x.shift)}</div>
        <div class="row"><button type="button" class="btn small" data-reason="${esc(x.asg.assignment_id)}|${esc(x.work_date)}|${esc(x.shift)}"${dis}>${ICON.edit}<span>${bi('pend.write_reason')}</span></button>
          ${x.work_date >= backLimit ? `<a class="btn small" href="#/check/${encodeURIComponent(x.asg.assignment_id)}?d=${x.work_date}${x.shift ? '&s=' + x.shift : ''}">${ICON.checklist}<span>${bi('month.backfill')}</span></a>` : ''}</div>
      </div>`).join('') || `<div class="card empty-state"><p class="muted">${bi('pend.none_missed')}</p></div>`;
  } else {
    body = days.map((d) => {
      const miss = missed.filter((x) => x.work_date === d.work_date).length;
      return `<div class="card">
        <div class="row between"><strong>${bi('weekday.' + weekday(d.work_date))} ${esc(fmtDate(d.work_date))}</strong>${d.work_date === today() ? `<span class="badge t-navy">${bi('home.today')}</span>` : ''}</div>
        <div class="kv"><span>${bi('rpt.tile_runs')}</span><strong>${d.runs}${d.partial ? ` <span class="muted small">(${bi('pend.partial_n', { N: d.partial })})</span>` : ''}</strong></div>
        <div class="kv"><span>${bi('rpt.tile_fail')}</span><strong class="${d.fail ? 't-red-text' : ''}">${d.fail}</strong></div>
        <div class="kv"><span>${bi('rpt.tile_warn')}</span><strong class="${d.warn ? 't-amber-text' : ''}">${d.warn}</strong></div>
        ${miss ? `<p class="banner warn small">${bi('pend.day_missed', { N: miss })}</p>` : ''}
        <div class="row"><button type="button" class="btn small primary" data-confirm="${esc(d.work_date)}"${dis}>${ICON.lock}<span>${bi('pend.confirm_day')}</span></button></div>
      </div>`;
    }).join('') || `<div class="card empty-state"><p class="muted">${bi('pend.none_days')}</p></div>`;
  }
  view.innerHTML = `<p class="muted small">${bi('pend.areas')}: ${mine.length ? mine.map((a) => esc(nameText(areas.get(a)) || a)).join(', ') : bi('pend.all_areas')}</p>
    <div class="chips" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-tab="${k}">${bi(l)} <b>${n}</b></button>`).join('')}</div>
    ${online ? '' : `<p class="banner warn">${bi('sync.need_network')}</p>`}
    ${tab === 'days' ? `<p class="muted small">${bi('pend.confirm_hint')}</p>` : ''}
    <div class="cards">${body}</div>`;
  $$('[data-tab]', view).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; again(); }));
  $$('[data-resolve]', view).forEach((b) => b.addEventListener('click', async () => {
    const a = abn.find((x) => x.abnormal_id === b.dataset.resolve);
    if (!a) return;
    const text = await askText(bi('pend.resolve'), 'pend.resolution', `<p><strong>${esc(a.item_name_vi || a.item_name_zh)}</strong>: ${esc(a.value_text)}</p>`);
    if (!text) return;
    busy(b, true);
    const res = await writeOnline('abnormal.resolve', { abnormal_id: a.abnormal_id, ...oneLang('resolution', text) }, { expected_version: a.record_version });
    if (res.ok) { toast(bi('pend.resolved'), 'ok'); await afterCommit(); again(); return; }
    busy(b, false);
    writeFail(res);
  }));
  $$('[data-reason]', view).forEach((b) => b.addEventListener('click', async () => {
    const [aid, wd, s] = b.dataset.reason.split('|');
    const text = await askText(bi('pend.write_reason'), 'pend.reason');
    if (!text) return;
    busy(b, true);
    const res = await writeOnline('missed.reason', { missed_id: uuid(), assignment_id: aid, work_date: wd, shift: s, ...oneLang('reason', text) });
    if (res.ok) { toast(bi('form.saved'), 'ok'); await afterCommit(); again(); return; }
    busy(b, false);
    writeFail(res);
  }));
  $$('[data-confirm]', view).forEach((b) => b.addEventListener('click', async () => {
    const wd = b.dataset.confirm;
    const ok = await dialog({
      title: bi('pend.confirm_day'),
      body: `<p>${bi('pend.confirm_q', { D: fmtDate(wd) })}</p><p class="muted small">${bi('pend.confirm_lock')}</p>`,
      actions: [{ label: bi('btn.cancel'), value: false }, { label: bi('pend.confirm_day'), kind: 'primary', value: true }]
    });
    if (!ok) return;
    busy(b, true);
    const res = await writeWithPin('day.confirm', { work_date: wd });
    if (res.ok) { toast(bi('pend.confirmed', { D: fmtDate(wd) }), 'ok'); await afterCommit(); again(); return; }
    busy(b, false);
    writeFail(res);
  }));
}

