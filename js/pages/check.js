// Kiểm tra máy: một phiếu = một máy × một mẫu × một kỳ (ca/ngày/tuần/tháng).
// Mỗi hạng mục hiện tiêu chuẩn ngay cạnh ô nhập; gõ tới đâu tô màu tới đó (Đạt / Cần chú ý / Không đạt) mà không vẽ lại
// ô đang gõ (iPhone giữ bàn phím số). Không đạt bắt buộc ghi chú, chụp ảnh được. Lưu vào hàng chờ trên máy, có mạng tự gửi.
import { bi, biText, esc, session, uuid, isoNowVN, fmtDate, fmtDateTime, nameText, blobToB64 } from '../core.js';
import { ICON, toast, dialog, $, $$ } from '../ui.js';
import { enqueue } from '../sync.js';
import { byId, recs, templateItems, roleLevel, can, today, nowMs, shifts, dayLocked, users, userName, queuedRuns } from '../data.js';
import { effItem, judgeItem, stdText, warnText, fmtNumVi, stdBounds, currentPeriod, periodKey, periodSpan, addDaysIso, isoWeekKey } from '../judge.js';
import { loadFormDraft, saveFormDraft, clearFormDraft } from '../form.js';
import { processPhoto } from '../media.js';
import { app, syncNow, updateSyncStatus } from '../app.js';
import { navigate } from '../router.js';

const MAX_PHOTOS = 3;
const BACKDATE_DAYS = 7;

/** Ô số: "5,4" và "5.4" đều được; trống → null; sai → NaN */
export function parseNum(raw) {
  const t = String(raw ?? '').trim().replace(/[\s  ]/g, '');
  if (!t) return null;
  if (!/^[-+]?\d+(?:[.,]\d+)?$/.test(t) && !/^[-+]?[.,]\d+$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

/** Chữ một kỳ: "Ca 1 · 早班 · 28/10/2026", "Tuần 44 · 第44周 (26/10 – 01/11/2026)", "Tháng 10/2026" */
export function periodLabel(freq, workDate, shift) {
  if (freq === 'SHIFT') return `${bi('shift.name' + shift)} · ${esc(fmtDate(workDate))}`;
  if (freq === 'WEEK') {
    const wd = new Date(workDate + 'T00:00:00Z').getUTCDay() || 7;
    const mon = addDaysIso(workDate, 1 - wd), sun = addDaysIso(mon, 6);
    return `${bi('period.week', { N: isoWeekKey(workDate).slice(-2) })} (${esc(fmtDate(mon).slice(0, 5))} – ${esc(fmtDate(sun))})`;
  }
  if (freq === 'MONTH') return bi('period.month', { M: workDate.slice(5, 7) + '/' + workDate.slice(0, 4) });
  return esc(fmtDate(workDate));
}

/** Hạng mục của lượt đã kiểm theo phiên bản mẫu cũ: dựng lại từ kết quả đã lưu (tên, kiểu nhập, tiêu chuẩn lúc kiểm) */
function itemsFromRun(run, tplByKey) {
  return (run.results_json || []).map((r) => {
    const ti = tplByKey.get(r.item_key) || {};
    return { ...(r.std || {}), item_key: r.item_key, step_no: r.step_no, group_key: r.group_key, name_vi: r.name_vi, name_zh: r.name_zh, input_type: r.input_type, unit: r.unit, how_vi: ti.how_vi || '', how_zh: ti.how_zh || '', photo_on_fail: !!ti.photo_on_fail };
  });
}

/** Giá trị nhập (chuỗi như người dùng gõ) từ một kết quả đã lưu */
function valFromResult(r) {
  const v = { note: r.note || '' };
  if (r.value !== undefined && r.value !== null) v.value = fmtNumVi(r.value);
  if (Array.isArray(r.values)) v.values = r.values.map((x) => (x === null ? '' : fmtNumVi(x)));
  if (r.choice) v.choice = r.choice;
  if (r.pass === true || r.pass === false) v.pass = r.pass;
  if (r.text) v.text = r.text;
  return v;
}

/** Kỳ mặc định khi mẫu theo ca không có ca đang chạy: ca gần nhất đã bắt đầu của mẫu */
function lastStartedShiftPeriod(tpl, sh) {
  const allowed = String(tpl.shifts || '').split(',').filter(Boolean);
  const now = nowMs();
  for (let back = 0; back <= 1; back++) {
    const d = addDaysIso(today(), -back);
    const cands = allowed.map((s) => ({ s, sp: periodSpan('SHIFT', { date: d }, s, sh) })).filter((x) => x.sp.start <= now).sort((a, b) => b.sp.start - a.sp.start);
    if (cands.length) return { work_date: d, shift: cands[0].s, period_key: periodKey('SHIFT', d, cands[0].s) };
  }
  return null;
}

export async function renderCheck(view, { shell, params, query }) {
  shell.setScreen({ title: 'check.title', back: '/' });
  const asg = await byId('ASSIGNMENT', params.assignment);
  const tpl = asg && await byId('TEMPLATE', asg.template_id);
  const mac = asg && await byId('MACHINE', asg.machine_id);
  if (!asg || !tpl || !mac) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('err.not_found')}</p><a class="btn small" href="#/">${bi('nav.home')}</a></div>`; return; }
  const area = await byId('AREA', mac.area_id);
  const sh = shifts();
  const lvl = roleLevel();
  const me = session.user && session.user.user_id;
  const um = await users();

  // ---- Kỳ kiểm: ?d=ngày&s=ca (ghi bù kỳ đã qua) hoặc kỳ đang chạy ----
  let per = null;
  if (query.d && /^\d{4}-\d{2}-\d{2}$/.test(query.d)) {
    const s = tpl.frequency === 'SHIFT' ? String(query.s || '') : '';
    per = { work_date: query.d, shift: s, period_key: periodKey(tpl.frequency, query.d, s) };
  } else {
    per = currentPeriod(tpl, new Date(nowMs()), sh);
  }
  let offShift = false;
  if (!per) { per = lastStartedShiftPeriod(tpl, sh); offShift = true; }
  if (!per) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('check.no_period')}</p></div>`; return; }

  // ---- Lượt đã có trong kỳ (bản máy chủ) và bản trong hàng chờ của tôi ----
  const runs = (await recs('RUN')).filter((r) => r.assignment_id === asg.assignment_id);
  const run = runs.find((r) => r.period_key === per.period_key) || null;
  const queued = (await queuedRuns()).get(asg.assignment_id + '|' + per.period_key) || null;
  const prev = runs.filter((r) => r.period_key !== per.period_key && String(r.work_date) <= per.work_date)
    .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const prevVal = new Map((prev && prev.results_json || []).map((r) => [r.item_key, r.value_text]));

  // ---- Hạng mục ----
  const tplItems = await templateItems(tpl.template_id);
  const tplByKey = new Map(tplItems.map((x) => [x.item_key, x]));
  const rev = run ? Number(run.template_revision) : (queued ? Number(queued.payload.template_revision) || Number(tpl.revision) : Number(tpl.revision));
  const raw = run && Number(run.template_revision) !== Number(tpl.revision) ? itemsFromRun(run, tplByKey) : tplItems;
  const items = raw.map((ti) => (run && Number(run.template_revision) !== Number(tpl.revision) ? { ...effItem(ti, null), how_vi: ti.how_vi, how_zh: ti.how_zh } : effItem(ti, asg.overrides_json)));
  if (!items.length) { view.innerHTML = `<div class="card empty-state"><p class="muted">${bi('check.no_items')}</p></div>`; return; }

  // ---- Quyền sửa ----
  const locked = await dayLocked(per.work_date, mac.area_id);
  const canCheck = await can('check.submit');
  const others = run && run.checked_by !== me && lvl < 3;
  const tooOld = !run && per.work_date < addDaysIso(today(), -BACKDATE_DAYS);
  const ro = !canCheck || locked || others || tooOld || !mac.active || (!run && (!asg.active || !tpl.active));
  const roWhy = !canCheck ? 'check.ro_level' : locked ? 'check.ro_locked' : others ? 'check.ro_others' : tooOld ? 'check.ro_old' : 'check.ro_inactive';

  // ---- Giá trị ban đầu: nháp đang gõ > bản trong hàng chờ > bản máy chủ ----
  const draftKey = 'check:' + asg.assignment_id + '|' + per.period_key;
  const vals = {};
  const fromResults = (list) => { for (const r of list || []) vals[r.item_key] = valFromResult(r); };
  if (run) fromResults(run.results_json);
  let overallNote = run ? run.note || '' : '';
  if (queued) {
    const p = queued.payload;
    fromResults(p.results);
    overallNote = p.note || '';
  }
  const draft = !ro ? await loadFormDraft(draftKey) : null;
  if (draft && draft.vals) { Object.assign(vals, draft.vals); overallNote = draft.note ?? overallNote; }
  const runId = run ? run.run_id : (queued ? queued.payload.run_id : (draft && draft.run_id) || uuid());
  const photos = {}; // item_key → [{id, b64, thumb_b64, url}]
  items.forEach((it) => { if (!vals[it.item_key]) vals[it.item_key] = {}; });
  const docs = run ? (await recs('DOCUMENT')).filter((d) => d.parent_run_id === run.run_id) : [];

  // ---- Đánh giá một hạng mục từ chuỗi đang gõ ----
  const evalItem = (it) => {
    const v = vals[it.item_key] || {};
    const input = {};
    let bad = false;
    if (it.input_type === 'NUMBER') { const n = parseNum(v.value); if (Number.isNaN(n)) bad = true; else input.value = n; }
    else if (it.input_type === 'THREE_PHASE') {
      const arr = [0, 1, 2].map((i) => parseNum((v.values || [])[i]));
      if (arr.some((x) => Number.isNaN(x))) bad = true; else input.values = arr;
    } else if (it.input_type === 'CHOICE') input.choice = v.choice || null;
    else if (it.input_type === 'PASS_FAIL') input.pass = v.pass;
    else input.text = v.text || '';
    if (bad) return { result: 'BAD', input };
    return { ...judgeItem(it, input), input };
  };
  const msgOf = (it, j) => {
    if (j.result === 'BAD') return biText('chk.bad_number');
    if (it.input_type === 'NUMBER' && (j.result === 'FAIL' || j.result === 'WARN')) {
      const b = stdBounds(it), n = j.input.value, u = it.unit || '';
      if (j.result === 'FAIL' && b.min !== null && n < b.min) return biText('chk.below', { D: fmtNumVi(Math.round((b.min - n) * 1000) / 1000), U: u });
      if (j.result === 'FAIL' && b.max !== null && n > b.max) return biText('chk.above', { D: fmtNumVi(Math.round((n - b.max) * 1000) / 1000), U: u });
      return biText('chk.near');
    }
    if (it.input_type === 'THREE_PHASE' && (j.result === 'FAIL' || j.result === 'WARN')) {
      const b = stdBounds(it);
      const out = (j.input.values || []).some((x) => (b.min !== null && x < b.min) || (b.max !== null && x > b.max));
      if (j.result === 'FAIL') return biText(out ? 'chk.phase_out' : 'chk.imb_high', { P: fmtNumVi(j.imb) });
      return biText('chk.near');
    }
    return '';
  };

  // ---- Vẽ ----
  const pill = (r) => bi('res.' + (r === 'BAD' ? 'EMPTY' : r));
  const stdLine = (it) => {
    const s = stdText(it, 'vi'), z = stdText(it, 'zh');
    const w = warnText(it);
    const pv = prevVal.get(it.item_key);
    const std = s ? `${bi('chk.std')}: <b>${esc(s)}</b>${z && z !== s ? ` <span class="zh">${esc(z)}</span>` : ''}` : '';
    return [std, w ? `${bi('chk.warn_at')} ${esc(w)}` : '', it.overridden ? `<span class="tag">${bi('chk.own_std')}</span>` : '', pv ? `${bi('chk.prev')}: ${esc(pv)}` : ''].filter(Boolean).join(' · ');
  };
  const inputHtml = (it, i) => {
    const v = vals[it.item_key];
    const dis = ro ? ' disabled' : '';
    if (it.input_type === 'NUMBER') {
      return `<div class="ci-num"><label for="v-${i}">${bi('chk.measure')}</label>
        <input class="inp ci-inp" id="v-${i}" data-i="${i}" data-f="value" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${esc(v.value || '')}"${dis}>
        <span class="ci-unit">${esc(it.unit || '')}</span></div>`;
    }
    if (it.input_type === 'THREE_PHASE') {
      return `<div class="ci-3p">${['R', 'S', 'T'].map((ph, k) => `<div><label for="v-${i}-${k}">${bi('chk.phase', { P: ph })}${it.unit ? ` (${esc(it.unit)})` : ''}</label>
        <input class="inp ci-inp" id="v-${i}-${k}" data-i="${i}" data-f="values" data-k="${k}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${esc((v.values || [])[k] || '')}"${dis}></div>`).join('')}</div>
        <div class="ci-imb muted small">${bi('chk.imb')}: <b data-imb="${i}">—</b></div>`;
    }
    if (it.input_type === 'CHOICE') {
      return `<div class="ci-opts">${(it.choices_json || []).map((c) => `<button type="button" class="opt res-${(c.result || 'OK').toLowerCase()}${v.choice === c.code ? ' on' : ''}" data-i="${i}" data-choice="${esc(c.code)}"${dis}><span class="vi">${esc(c.vi || c.zh)}</span><span class="zh">${esc(c.zh || '')}</span></button>`).join('')}</div>`;
    }
    if (it.input_type === 'PASS_FAIL') {
      return `<div class="ci-opts two"><button type="button" class="opt res-ok${v.pass === true ? ' on' : ''}" data-i="${i}" data-pass="1"${dis}>${bi('res.PASS')}</button>
        <button type="button" class="opt res-fail${v.pass === false ? ' on' : ''}" data-i="${i}" data-pass="0"${dis}>${bi('res.NOT_PASS')}</button></div>`;
    }
    return `<textarea class="inp ci-text" id="v-${i}" data-i="${i}" data-f="text" rows="2" maxlength="500"${dis}>${esc(v.text || '')}</textarea>`;
  };
  const itemHtml = (it, i) => {
    const how = it.how_vi || it.how_zh ? `<div class="ci-how muted small">${bi('chk.how')}: ${esc([it.how_vi, it.how_zh].filter(Boolean).join(' · '))}</div>` : '';
    const nDocs = docs.filter((d) => d.item_key === it.item_key).length;
    return `<div class="ci" id="ci-${i}" data-i="${i}">
      <div class="ci-head"><div class="ci-name"><div class="vi">${esc(it.name_vi || it.name_zh)}</div>${it.name_zh && it.name_vi ? `<div class="zh">${esc(it.name_zh)}</div>` : ''}</div><span class="ci-pill" id="pill-${i}"></span></div>
      <div class="ci-std small">${stdLine(it) || `<span class="muted">${bi('chk.no_std')}</span>`}</div>
      ${inputHtml(it, i)}
      <div class="ci-msg" id="msg-${i}" hidden></div>
      ${how}
      <div class="ci-note" id="note-${i}" hidden>
        <label for="n-${i}" id="nl-${i}"></label>
        <textarea class="inp" id="n-${i}" data-i="${i}" data-f="note" rows="2" maxlength="500"${ro ? ' disabled' : ''}>${esc(vals[it.item_key].note || '')}</textarea>
        ${ro ? '' : `<div class="row ci-photo"><label class="btn small">${ICON.camera}<span>${bi('chk.photo')}</span><input type="file" accept="image/*" capture="environment" data-photo="${i}" hidden></label><span class="muted small" id="pc-${i}"></span></div>`}
        ${nDocs ? `<div class="muted small">${bi('chk.photos_saved', { N: nDocs })}</div>` : ''}
        <div class="muted small ci-tell" id="tell-${i}" hidden>${bi('chk.tell_c3')}</div>
      </div>
      ${ro ? '' : `<button type="button" class="link-btn small" id="addn-${i}" data-addnote="${i}">＋ ${bi('chk.add_note')}</button>`}
    </div>`;
  };
  let lastGroup = null;
  const body = items.map((it, i) => {
    const g = it.group_key || 'OTHER';
    const head = g !== lastGroup ? `<h2 class="grp-title">${bi('grp.' + g)}</h2>` : '';
    lastGroup = g;
    return head + itemHtml(it, i);
  }).join('');
  const checker = run ? userName(um, run.checked_by) : (session.user && session.user.display_name);
  view.innerHTML = `<div class="ck-root"><div class="check-page">
    <section class="card mac-card">
      <div class="mac-top"><span class="code">${esc(mac.machine_code)}</span><span class="per-chip">${periodLabel(tpl.frequency, per.work_date, per.shift)}${tpl.frequency === 'SHIFT' ? (() => { const d = sh.find((x) => String(x.no) === per.shift); return d ? ` · ${esc(d.start)} – ${esc(d.end)}` : ''; })() : ''}</span></div>
      <div class="mac-name">${esc(nameText(mac))}</div>
      <div class="muted small">${area ? esc(nameText(area)) + ' · ' : ''}${bi('check.template')}: ${esc(nameText(tpl))} (${bi('rpt.revision', { N: rev })})</div>
      <div class="muted small">${bi('rpt.row_checker')}: ${esc(checker || '')}${run ? ' · ' + esc(fmtDateTime(run.checked_at)) : ''}</div>
      <div class="row mac-links"><a class="btn tiny" href="#/month?m=${encodeURIComponent(mac.machine_id)}">${ICON.calendar}<span>${bi('nav.month')}</span></a>
        <a class="btn tiny" href="#/m/${encodeURIComponent(mac.machine_id)}">${ICON.equipment}<span>${bi('check.machine')}</span></a>
        ${ro ? '' : `<button type="button" class="btn tiny" id="ck-period">${ICON.calendar}<span>${bi('check.change_period')}</span></button>`}</div>
    </section>
    ${offShift && !query.d ? `<p class="banner warn">${bi('check.off_shift')}</p>` : ''}
    ${ro ? `<p class="banner warn">${bi(roWhy)}</p>` : ''}
    ${queued ? `<p class="banner info">${bi('check.queued_note')}</p>` : ''}
    ${run && !ro ? `<p class="banner info">${bi('check.editing')}</p>` : ''}
    <div class="ck-progress"><div class="row between small"><span>${bi('chk.filled')} <b id="ck-filled"></b></span><span id="ck-pct"></span></div><div class="bar-track"><div class="bar-fill" id="ck-bar"></div></div></div>
    ${body}
    <div class="fld"><label for="ck-note">${bi('chk.overall_note')}</label><textarea class="inp" id="ck-note" rows="2" maxlength="500"${ro ? ' disabled' : ''}>${esc(overallNote)}</textarea></div>
    <div class="ck-spacer"></div>
  </div>
  ${ro ? '' : `<div class="ck-bar" id="ck-foot">
    <div class="ck-sum small"><span id="ck-s-filled"></span><span class="t-red-text" id="ck-s-fail"></span><span class="t-amber-text" id="ck-s-warn"></span></div>
    <div class="ck-left small" id="ck-left" hidden></div>
    <button type="button" class="btn primary block" id="ck-save">${bi('btn.save')}</button>
    <div class="muted small center">${bi('chk.offline_ok')}</div>
  </div>`}</div>`;
  // Sự kiện gắn vào khung con (vẽ lại cùng màn thay khung, không gắn chồng)
  const R = view.firstElementChild;

  // ---- Tô màu một hạng mục (không đụng ô đang gõ) ----
  const results = new Array(items.length);
  const paint = (i) => {
    const it = items[i];
    const j = evalItem(it);
    results[i] = j;
    const card = $('#ci-' + i, R);
    card.className = 'ci st-' + j.result.toLowerCase();
    $('#pill-' + i, R).innerHTML = pill(j.result);
    const m = msgOf(it, j);
    const mb = $('#msg-' + i, R);
    mb.hidden = !m; mb.textContent = m;
    const imb = $(`[data-imb="${i}"]`, R);
    if (imb) imb.textContent = j.imb !== undefined ? fmtNumVi(j.imb) + ' %' : '—';
    const v = vals[it.item_key];
    const fail = j.result === 'FAIL';
    const nb = $('#note-' + i, R);
    const wantNote = fail || !!(v.note && v.note.trim()) || nb.dataset.open === '1';
    nb.hidden = !wantNote;
    $('#nl-' + i, R).innerHTML = fail ? `${bi('chk.note_required')} <span class="req">*</span>` : bi('chk.note');
    const tell = $('#tell-' + i, R);
    if (tell) tell.hidden = !fail;
    const add = $('#addn-' + i, R);
    if (add) add.hidden = wantNote;
    const pc = $('#pc-' + i, R);
    if (pc) pc.textContent = (photos[it.item_key] || []).length ? biText('chk.photo_n', { N: photos[it.item_key].length }) : '';
    card.classList.toggle('need-note', fail && !(v.note || '').trim() && card.dataset.tried === '1');
  };
  const summary = () => {
    const filled = results.filter((j) => j && j.result !== 'EMPTY' && j.result !== 'BAD').length;
    const fail = results.filter((j) => j && j.result === 'FAIL').length;
    const warn = results.filter((j) => j && j.result === 'WARN').length;
    const pct = Math.round(filled / items.length * 100);
    $('#ck-filled', R).textContent = `${filled}/${items.length}`;
    $('#ck-pct', R).textContent = pct + ' %';
    $('#ck-bar', R).style.width = pct + '%';
    if (!ro) {
      $('#ck-s-filled', R).innerHTML = bi('chk.filled_n', { N: filled, M: items.length });
      $('#ck-s-fail', R).innerHTML = fail ? bi('chk.fail_n', { N: fail }) : '';
      $('#ck-s-warn', R).innerHTML = warn ? bi('chk.warn_n', { N: warn }) : '';
      const left = items.length - filled;
      const lb = $('#ck-left', R);
      lb.hidden = !left || !filled;
      lb.innerHTML = left ? bi('chk.left_n', { N: left }) : '';
    }
    return { filled, fail, warn };
  };
  items.forEach((_, i) => paint(i));
  summary();

  // ---- Nháp trên máy: rời màn, tắt app vẫn còn chữ đang gõ ----
  let draftTimer = null;
  const saveDraftSoon = () => {
    if (ro) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { saveFormDraft(draftKey, { run_id: runId, vals, note: $('#ck-note', R).value }); }, 400);
  };

  // ---- Sự kiện ----
  R.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'ck-note') { saveDraftSoon(); return; }
    if (!t.dataset || t.dataset.i === undefined || !t.dataset.f) return;
    const i = Number(t.dataset.i), it = items[i];
    const v = vals[it.item_key];
    if (t.dataset.f === 'values') { v.values = v.values || ['', '', '']; v.values[Number(t.dataset.k)] = t.value; } else v[t.dataset.f] = t.value;
    paint(i); summary(); saveDraftSoon();
  });
  R.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b && !ro && (b.dataset.choice !== undefined || b.dataset.pass !== undefined)) {
      const i = Number(b.dataset.i), it = items[i];
      const v = vals[it.item_key];
      if (b.dataset.choice !== undefined) v.choice = v.choice === b.dataset.choice ? null : b.dataset.choice;
      else { const want = b.dataset.pass === '1'; v.pass = v.pass === want ? undefined : want; }
      $$(`button[data-i="${i}"]`, R).forEach((x) => x.classList.toggle('on', x.dataset.choice !== undefined ? x.dataset.choice === v.choice : (x.dataset.pass === '1' ? v.pass === true : v.pass === false)));
      paint(i); summary(); saveDraftSoon();
      if (results[i].result === 'FAIL') setTimeout(() => { const n = $('#n-' + i, R); if (n && !n.value) n.focus(); }, 50);
      return;
    }
    const an = e.target.closest('[data-addnote]');
    if (an) { const i = Number(an.dataset.addnote); $('#note-' + i, R).dataset.open = '1'; paint(i); $('#n-' + i, R).focus(); }
  });
  R.addEventListener('change', async (e) => {
    const f = e.target.closest('input[data-photo]');
    if (!f) return;
    const i = Number(f.dataset.photo), it = items[i];
    const file = f.files && f.files[0];
    f.value = '';
    if (!file) return;
    const list = photos[it.item_key] = photos[it.item_key] || [];
    if (list.length >= MAX_PHOTOS) { toast(bi('chk.photo_max', { N: MAX_PHOTOS }), 'err'); return; }
    try {
      const p = await processPhoto(file);
      list.push({ id: uuid(), b64: await blobToB64(p.main), thumb_b64: await blobToB64(p.thumb) });
      paint(i);
    } catch (err) { toast(bi('chk.photo_fail'), 'err'); }
  });
  const pb = $('#ck-period', R);
  if (pb) pb.addEventListener('click', () => pickPeriod(tpl, per, sh, asg));

  const sv = $('#ck-save', R);
  if (sv) sv.addEventListener('click', async () => {
    // Kiểm trước khi lưu: số sai, Không đạt thiếu ghi chú
    let first = null;
    items.forEach((it, i) => {
      const j = results[i];
      const card = $('#ci-' + i, R);
      card.dataset.tried = '1';
      const needNote = j.result === 'FAIL' && !(vals[it.item_key].note || '').trim();
      if ((j.result === 'BAD' || needNote) && first === null) first = i;
      paint(i);
    });
    const s = summary();
    if (first !== null) {
      const j = results[first];
      toast(bi(j.result === 'BAD' ? 'chk.bad_number' : 'chk.need_note'), 'err');
      const card = $('#ci-' + first, R);
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const target = j.result === 'BAD' ? card.querySelector('.ci-inp') : $('#n-' + first, R);
      if (target) setTimeout(() => target.focus(), 300);
      return;
    }
    if (!s.filled) { toast(bi('chk.nothing'), 'err'); return; }
    sv.disabled = true;
    try {
      const out = [];
      items.forEach((it, i) => {
        const j = results[i];
        const v = vals[it.item_key];
        const note = (v.note || '').trim();
        if (j.result === 'EMPTY' && !note) return;
        const r = { item_key: it.item_key, note };
        if (it.input_type === 'NUMBER') r.value = j.input.value;
        else if (it.input_type === 'THREE_PHASE') r.values = j.input.values;
        else if (it.input_type === 'CHOICE') r.choice = j.input.choice;
        else if (it.input_type === 'PASS_FAIL') r.pass = j.input.pass === undefined ? null : j.input.pass;
        else r.text = j.input.text;
        out.push(r);
      });
      const payload = {
        run_id: runId, assignment_id: asg.assignment_id, template_revision: rev, work_date: per.work_date, shift: per.shift,
        checked_at: run ? run.checked_at : (queued ? queued.payload.checked_at : isoNowVN()), results: out, note: $('#ck-note', R).value.trim()
      };
      await enqueue('check.submit', payload, {
        entity_type: 'RUN', entity_id: runId, expected_version: run ? Number(run.record_version) || 0 : 0, chain: true,
        merge: (o, n) => ({ ...n, checked_at: o.checked_at })
      });
      for (const [key, list] of Object.entries(photos)) {
        for (const p of list) {
          await enqueue('doc.upload', { document_id: p.id, entity_type: 'RUN', entity_id: runId, item_key: key, kind: 'PHOTO_CHECK', mime_type: 'image/jpeg', content_b64: p.b64, thumb_b64: p.thumb_b64 },
            { entity_type: 'DOCUMENT', entity_id: p.id, parent_id: runId });
        }
      }
      clearTimeout(draftTimer);
      await clearFormDraft(draftKey);
      toast(bi(s.fail ? 'chk.saved_fail' : 'chk.saved'), 'ok');
      await updateSyncStatus();
      navigate('/', { replace: true });
      if (navigator.onLine && !app.offline) syncNow({ quiet: true });
    } catch (err) {
      sv.disabled = false;
      toast(esc(err && err.message), 'err');
    }
  });
}

/** Đổi kỳ (ghi bù kỳ đã qua trong 7 ngày) */
async function pickPeriod(tpl, per, sh, asg) {
  const dates = [];
  for (let k = 0; k <= BACKDATE_DAYS; k++) dates.push(addDaysIso(today(), -k));
  const allowed = String(tpl.shifts || '').split(',').filter(Boolean);
  const v = await dialog({
    title: bi('check.change_period'),
    body: `<label class="lbl" for="pp-d">${bi('check.work_date')}</label>
      <select class="inp sel" id="pp-d">${dates.map((d) => `<option value="${d}"${d === per.work_date ? ' selected' : ''}>${esc(fmtDate(d))}${tpl.frequency === 'WEEK' ? ' · W' + isoWeekKey(d).slice(-2) : ''}</option>`).join('')}</select>
      ${tpl.frequency === 'SHIFT' ? `<label class="lbl" for="pp-s">${bi('check.shift')}</label><select class="inp sel" id="pp-s">${allowed.map((s) => `<option value="${s}"${s === per.shift ? ' selected' : ''}>${esc(biText('shift.name' + s))}</option>`).join('')}</select>` : ''}
      <p class="muted small">${bi('check.period_hint', { N: BACKDATE_DAYS })}</p>`,
    actions: [{ label: bi('btn.cancel'), value: null }, { label: bi('btn.open'), kind: 'primary', read: (w) => ({ d: $('#pp-d', w).value, s: tpl.frequency === 'SHIFT' ? $('#pp-s', w).value : '' }) }]
  });
  if (!v) return;
  const now = currentPeriod(tpl, new Date(nowMs()), sh);
  if (now && now.work_date === v.d && now.shift === v.s) { navigate('/check/' + encodeURIComponent(asg.assignment_id), { replace: true }); return; }
  navigate(`/check/${encodeURIComponent(asg.assignment_id)}?d=${v.d}${v.s ? '&s=' + v.s : ''}`, { replace: true });
}
