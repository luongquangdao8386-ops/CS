// Ô sửa một hạng mục kiểm tra (mẫu checksheet, thư viện hạng mục) và ô sửa tiêu chuẩn riêng theo máy.
// Kiểu nhập: số · dòng 3 pha · chọn mức · đạt/không đạt · ghi chữ. Kiểu tiêu chuẩn: khoảng · tối đa · tối thiểu · định mức ± % · không có.
import { bi, biText, esc } from './core.js';
import { $, $$, ICON } from './ui.js';
import { stdText, warnText, fmtNumVi } from './judge.js';
import { parseNum } from './pages/check.js';

export const INPUT_TYPES = ['NUMBER', 'THREE_PHASE', 'CHOICE', 'PASS_FAIL', 'TEXT'];
export const STD_TYPES = ['RANGE', 'MAX', 'MIN', 'TOL', 'NONE'];
export const GROUPS = ['TEMP', 'PRESS', 'ELEC', 'MECH', 'LEVEL', 'QUALITY', 'VISUAL', 'OTHER'];
const NUM_FIELDS = { RANGE: ['std_min', 'std_max'], MAX: ['std_max'], MIN: ['std_min'], TOL: ['std_nominal', 'std_tol_pct'], NONE: [] };
export const DEFAULT_CHOICES = [
  { code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'FAIL' },
  { code: 'NORMAL', vi: 'Bình thường', zh: '正常', result: 'OK' },
  { code: 'HIGH', vi: 'Cao', zh: '偏高', result: 'WARN' }
];

const numVal = (v) => (v === null || v === undefined || v === '' ? '' : fmtNumVi(v));
const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${label}</option>`;
const fld = (k, labelKey, inner, cls = '') => `<div class="fld ${cls}" data-field="${k}"><label>${bi(labelKey)}</label>${inner}<div class="ferr"></div></div>`;
const txt = (k, v, extra = '') => `<input class="inp" type="text" data-k="${k}" value="${esc(v ?? '')}" autocomplete="off" ${extra}>`;
const num = (k, v) => `<input class="inp" type="text" inputmode="decimal" data-k="${k}" value="${esc(numVal(v))}" autocomplete="off">`;

/** Phần tiêu chuẩn số (dùng cả ở tiêu chuẩn riêng theo máy) */
export function stdFieldsHtml(it) {
  const st = it.std_type || 'NONE';
  const ex = it.extra_json || {};
  return `<div class="ie-std form-grid" data-for="NUMBER THREE_PHASE">
      ${fld('std_type', 'ie.std_type', `<select class="inp sel" data-k="std_type">${STD_TYPES.map((s) => opt(s, st, biText('std_type.' + s))).join('')}</select>`)}
      ${fld('std_min', 'ie.std_min', num('std_min', it.std_min), 'sf sf-RANGE sf-MIN')}
      ${fld('std_max', 'ie.std_max', num('std_max', it.std_max), 'sf sf-RANGE sf-MAX')}
      ${fld('std_nominal', 'ie.std_nominal', num('std_nominal', it.std_nominal), 'sf sf-TOL')}
      ${fld('std_tol_pct', 'ie.std_tol_pct', num('std_tol_pct', it.std_tol_pct), 'sf sf-TOL')}
      ${fld('warn_lo', 'ie.warn_lo', num('warn_lo', it.warn_lo))}
      ${fld('warn_hi', 'ie.warn_hi', num('warn_hi', it.warn_hi))}
      ${fld('imb_max', 'ie.imb_max', num('imb_max', ex.imb_max ?? (it.input_type === 'THREE_PHASE' ? 10 : '')), 'only-3p')}
      ${fld('imb_warn', 'ie.imb_warn', num('imb_warn', ex.imb_warn), 'only-3p')}
    </div>`;
}

function choiceRow(c, j) {
  return `<div class="ch-row" data-ch="${j}">
    <input class="inp" type="text" data-c="vi" value="${esc(c.vi || '')}" placeholder="${esc(biText('i18n.lang_vi'))}" maxlength="60">
    <input class="inp" type="text" data-c="zh" value="${esc(c.zh || '')}" placeholder="${esc(biText('i18n.lang_zh'))}" maxlength="60">
    <select class="inp sel" data-c="result">${['OK', 'WARN', 'FAIL'].map((r) => opt(r, c.result || 'OK', biText('res.' + r))).join('')}</select>
    <input type="hidden" data-c="code" value="${esc(c.code || '')}">
    <button type="button" class="icon-btn" data-ch-del aria-label="${esc(biText('btn.delete'))}">${ICON.x}</button></div>`;
}

/**
 * Ô sửa một hạng mục. i: số thứ tự; opts: {move, del} có nút lên/xuống/xóa (trong mẫu)
 */
export function itemEditorHtml(it, i, { move = false, del = false, count = 0 } = {}) {
  const t = it.input_type || 'NUMBER';
  const choices = Array.isArray(it.choices_json) && it.choices_json.length ? it.choices_json : DEFAULT_CHOICES;
  return `<div class="ie card it-${t}" data-ie="${i}" data-key="${esc(it.item_key || '')}" data-lib="${esc(it.library_item_id || '')}">
    <div class="ie-head"><span class="ie-no">${i + 1}</span><strong class="ie-title">${esc(it.name_vi || it.name_zh || biText('ie.new_item'))}</strong><span class="grow"></span>
      ${move ? `<button type="button" class="icon-btn" data-up="${i}" aria-label="${esc(biText('ie.up'))}"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
        <button type="button" class="icon-btn" data-down="${i}" aria-label="${esc(biText('ie.down'))}"${i === count - 1 ? ' disabled' : ''}>${ICON.down}</button>` : ''}
      ${del ? `<button type="button" class="icon-btn" data-del="${i}" aria-label="${esc(biText('btn.delete'))}">${ICON.trash}</button>` : ''}</div>
    <div class="form-grid">
      ${fld('name_vi', 'ie.name_vi', txt('name_vi', it.name_vi, 'maxlength="200"'))}
      ${fld('name_zh', 'ie.name_zh', txt('name_zh', it.name_zh, 'maxlength="200"'))}
      ${fld('group_key', 'ie.group', `<select class="inp sel" data-k="group_key">${GROUPS.map((g) => opt(g, it.group_key || 'OTHER', biText('grp.' + g))).join('')}</select>`)}
      ${fld('input_type', 'ie.input_type', `<select class="inp sel" data-k="input_type">${INPUT_TYPES.map((x) => opt(x, t, biText('input_type.' + x))).join('')}</select>`)}
      ${fld('unit', 'ie.unit', txt('unit', it.unit, 'maxlength="20" placeholder="°C, bar, A…"'), 'only-num')}
    </div>
    ${stdFieldsHtml({ ...it, input_type: t })}
    <div class="ie-choices" data-field="choices_json"><label class="lbl">${bi('ie.choices')}</label>
      <div class="ch-list">${choices.map(choiceRow).join('')}</div>
      <button type="button" class="btn tiny" data-ch-add>${ICON.plus}<span>${bi('ie.choice_add')}</span></button><div class="ferr"></div></div>
    <div class="form-grid">
      ${fld('std_text_vi', 'ie.std_text_vi', txt('std_text_vi', it.std_text_vi, 'maxlength="200"'))}
      ${fld('std_text_zh', 'ie.std_text_zh', txt('std_text_zh', it.std_text_zh, 'maxlength="200"'))}
      ${fld('how_vi', 'ie.how_vi', txt('how_vi', it.how_vi, 'maxlength="300"'))}
      ${fld('how_zh', 'ie.how_zh', txt('how_zh', it.how_zh, 'maxlength="300"'))}
    </div>
    <div class="row ie-flags">
      <label class="check"><input type="checkbox" data-k="required"${it.required === false ? '' : ' checked'}><span>${bi('ie.required')}</span></label>
      <label class="check"><input type="checkbox" data-k="photo_on_fail"${it.photo_on_fail ? ' checked' : ''}><span>${bi('ie.photo_on_fail')}</span></label>
    </div>
    <div class="ie-preview small"></div>
  </div>`;
}

/** Đọc lại một ô sửa hạng mục thành object gửi máy chủ. Số sai → errs.push({field}) */
export function readItem(box, errs = [], prefix = '') {
  const g = (k) => { const el = $(`[data-k="${k}"]`, box); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : undefined; };
  const n = (k) => {
    const v = g(k);
    if (v === undefined || v === '') return null;
    const x = parseNum(v);
    if (Number.isNaN(x)) { errs.push({ field: prefix + k, key: 'field.number_bad' }); return null; }
    return x;
  };
  const it = {
    item_key: box.dataset.key || '', library_item_id: box.dataset.lib || '', group_key: g('group_key'), name_vi: g('name_vi'), name_zh: g('name_zh'),
    input_type: g('input_type'), unit: g('unit') || '', std_text_vi: g('std_text_vi') || '', std_text_zh: g('std_text_zh') || '',
    how_vi: g('how_vi') || '', how_zh: g('how_zh') || '', required: g('required') !== false, photo_on_fail: !!g('photo_on_fail')
  };
  it.std_type = 'NONE';
  ['std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi'].forEach((k) => { it[k] = null; });
  it.choices_json = null; it.extra_json = null;
  if (it.input_type === 'NUMBER' || it.input_type === 'THREE_PHASE') {
    it.std_type = g('std_type') || 'NONE';
    for (const k of NUM_FIELDS[it.std_type] || []) it[k] = n(k);
    it.warn_lo = n('warn_lo'); it.warn_hi = n('warn_hi');
    if (it.input_type === 'THREE_PHASE') {
      const im = n('imb_max'), iw = n('imb_warn');
      it.extra_json = { imb_max: im === null ? 10 : im };
      if (iw !== null) it.extra_json.imb_warn = iw;
    }
  } else {
    it.unit = '';
  }
  if (it.input_type === 'CHOICE') {
    const used = new Set();
    it.choices_json = $$('.ch-row', box).map((r, j) => {
      const c = { vi: $('[data-c="vi"]', r).value.trim(), zh: $('[data-c="zh"]', r).value.trim(), result: $('[data-c="result"]', r).value, code: $('[data-c="code"]', r).value };
      let code = /^[A-Z0-9_]{1,20}$/.test(c.code) && !used.has(c.code) ? c.code : '';
      if (!code) { let k = j + 1; while (used.has('OPT' + k)) k++; code = 'OPT' + k; }
      used.add(code);
      return { ...c, code };
    }).filter((c) => c.vi || c.zh);
  }
  return it;
}

/** Ẩn/hiện ô theo kiểu nhập/kiểu tiêu chuẩn, xem trước chữ tiêu chuẩn */
export function refreshItem(box) {
  const it = readItem(box, []);
  box.className = box.className.replace(/\bit-[A-Z_]+\b/g, '').trim() + ' it-' + it.input_type;
  const numeric = it.input_type === 'NUMBER' || it.input_type === 'THREE_PHASE';
  $$('[data-for]', box).forEach((x) => { x.hidden = !x.dataset.for.split(' ').includes(it.input_type); });
  $$('.only-num', box).forEach((x) => { x.hidden = !numeric; });
  $$('.only-3p', box).forEach((x) => { x.hidden = it.input_type !== 'THREE_PHASE'; });
  const st = $('[data-k="std_type"]', box);
  $$('.sf', box).forEach((x) => { x.hidden = !st || !x.classList.contains('sf-' + st.value); });
  const ch = $('.ie-choices', box);
  if (ch) ch.hidden = it.input_type !== 'CHOICE';
  const title = $('.ie-title', box);
  if (title) title.textContent = it.name_vi || it.name_zh || biText('ie.new_item');
  const pv = $('.ie-preview', box);
  if (pv) {
    const s = stdText(it, 'vi'), w = warnText(it);
    pv.innerHTML = s || w ? `${bi('chk.std')}: <b>${esc(s || '—')}</b>${w ? ` · ${bi('chk.warn_at')} ${esc(w)}` : ''}` : `<span class="muted">${bi('chk.no_std')}</span>`;
  }
}

/** Gắn sự kiện cho mọi ô sửa hạng mục trong root (gọi lại sau mỗi lần vẽ) */
export function wireItems(root) {
  $$('.ie', root).forEach((box) => {
    refreshItem(box);
    box.addEventListener('input', () => refreshItem(box));
    box.addEventListener('change', () => refreshItem(box));
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-ch-add]')) {
        const list = $('.ch-list', box);
        if ($$('.ch-row', list).length >= 8) return;
        list.insertAdjacentHTML('beforeend', choiceRow({ result: 'OK' }, $$('.ch-row', list).length));
        refreshItem(box);
      }
      const d = e.target.closest('[data-ch-del]');
      if (d) { d.closest('.ch-row').remove(); refreshItem(box); }
    });
  });
}

/** Ô sửa tiêu chuẩn riêng của một hạng mục số (màn máy) */
export function overrideEditorHtml(ti, ov, i) {
  const cur = { ...ti, ...(ov || {}) };
  return `<div class="ov card it-${ti.input_type}" data-ov="${i}" data-key="${esc(ti.item_key)}">
    <div class="ie-head"><strong>${esc(ti.name_vi || ti.name_zh)}</strong>${ti.name_zh && ti.name_vi ? ` <span class="zh">${esc(ti.name_zh)}</span>` : ''}<span class="grow"></span>
      <label class="check"><input type="checkbox" data-own${ov ? ' checked' : ''}><span>${bi('ov.own')}</span></label></div>
    <div class="muted small">${bi('ov.template_std')}: ${esc(stdText(ti, 'vi') || '—')}${warnText(ti) ? ' · ' + bi('chk.warn_at') + ' ' + esc(warnText(ti)) : ''}</div>
    <div class="ov-body"${ov ? '' : ' hidden'}>
      <input type="hidden" data-k="input_type" value="${esc(ti.input_type)}">
      ${fld('unit', 'ie.unit', txt('unit', cur.unit, 'maxlength="20"'))}
      ${stdFieldsHtml(cur)}
      <div class="ie-preview small"></div>
    </div></div>`;
}

export function wireOverrides(root) {
  $$('.ov', root).forEach((box) => {
    const body = $('.ov-body', box);
    const upd = () => {
      body.hidden = !$('[data-own]', box).checked;
      const st = $('[data-k="std_type"]', box);
      $$('.sf', box).forEach((x) => { x.hidden = !x.classList.contains('sf-' + st.value); });
      $$('.only-3p', box).forEach((x) => { x.hidden = box.classList.contains('it-THREE_PHASE') === false; });
      const it = readOverride(box, []);
      $('.ie-preview', box).innerHTML = it ? `${bi('chk.std')}: <b>${esc(stdText({ ...it, input_type: $('[data-k="input_type"]', box).value }, 'vi') || '—')}</b>` : '';
    };
    upd();
    box.addEventListener('input', upd);
    box.addEventListener('change', upd);
  });
}

/** Tiêu chuẩn riêng đọc từ ô (null = dùng tiêu chuẩn của mẫu) */
export function readOverride(box, errs) {
  if (!$('[data-own]', box).checked) return null;
  const it = readItem(box, errs, 'overrides.' + box.dataset.key + '.');
  const o = { unit: it.unit, std_type: it.std_type };
  ['std_min', 'std_max', 'std_nominal', 'std_tol_pct', 'warn_lo', 'warn_hi'].forEach((k) => { o[k] = it[k]; });
  if (it.extra_json) o.extra_json = it.extra_json;
  return o;
}
