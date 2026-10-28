/* 14_templates: mẫu checksheet có phiên bản. Sửa hạng mục = phiên bản mới (đủ các dòng); lượt kiểm cũ giữ tiêu chuẩn lúc kiểm
 * (results_json), nên sửa mẫu không làm sai số liệu các tháng trước. item_key giữ nguyên qua phiên bản. */

var TPL_ITEM_SIG_ = ['item_key', 'group_key', 'name_vi', 'name_zh', 'input_type', 'unit', 'std_type', 'std_min', 'std_max', 'std_nominal',
  'std_tol_pct', 'warn_lo', 'warn_hi', 'choices_json', 'extra_json', 'std_text_vi', 'std_text_zh', 'how_vi', 'how_zh', 'required',
  'photo_on_fail', 'library_item_id'];
var TPL_ITEM_I18N_ = ['name', 'std_text', 'how'];
var MAX_TEMPLATE_ITEMS_ = 60;

/** Các dòng hạng mục của một phiên bản, theo thứ tự */
function templateItems_(templateId, revision, rows) {
  return (rows || findAll_('TemplateItems', 'template_id', templateId)).filter(function (r) {
    return r.template_id === templateId && Number(r.revision) === Number(revision) && !r.archived_at;
  }).sort(function (a, b) { return (a.step_no || 0) - (b.step_no || 0); });
}

function itemSig_(it) {
  return stableStringify_(TPL_ITEM_SIG_.map(function (f) {
    var v = it[f];
    if (v === undefined || v === '') v = null;
    if (f === 'required' || f === 'photo_on_fail') v = !!v;
    return v;
  }));
}

/** Ca của mẫu: chuỗi "1,3" từ mảng hoặc chuỗi; chỉ số ca đang có trong Settings */
function normShifts_(v) {
  var have = shiftsCfg_().map(function (s) { return String(s.no); });
  var list = (Array.isArray(v) ? v : String(v || '').split(',')).map(function (x) { return String(x).trim(); })
    .filter(function (x, i, a) { return have.indexOf(x) >= 0 && a.indexOf(x) === i; });
  list.sort();
  return list.join(',');
}

/**
 * template.edit {template_id, name_vi|name_zh, frequency, shifts, note_vi|note_zh, items:[…]} (expected_version khi sửa)
 * Mẫu mới: template_id là UUID do app tạo. Hạng mục: item_key có sẵn (giữ khi sửa) hoặc để trống (hạng mục mới).
 */
function templateEdit_(ctx) {
  var p = ctx.req.payload || {};
  var id = p.template_id;
  var cur = id ? findOne_('Templates', 'template_id', id) : null;
  if (!cur && !isUuidV4_(id)) throw validationError_([fieldError_('template_id', 'ID_INVALID')]);
  var errs = [];
  requireOneLang_(errs, p, cur, 'name');
  var freq = p.frequency !== undefined ? p.frequency : (cur ? cur.frequency : null);
  if (FREQUENCIES_.indexOf(freq) < 0) errs.push(fieldError_('frequency', 'INVALID_VALUE'));
  var shifts = freq === 'SHIFT' ? normShifts_(p.shifts !== undefined ? p.shifts : (cur ? cur.shifts : '')) : '';
  if (freq === 'SHIFT' && !shifts) errs.push(fieldError_('shifts', 'SHIFTS_REQUIRED'));
  var curItems = cur ? templateItems_(id, cur.revision) : [];
  var byKey = {};
  curItems.forEach(function (r) { byKey[r.item_key] = r; });
  var itemsIn = Array.isArray(p.items) ? p.items : null;
  if (!cur && !itemsIn) itemsIn = [];
  if (itemsIn && (!itemsIn.length || itemsIn.length > MAX_TEMPLATE_ITEMS_)) errs.push(fieldError_('items', 'ITEMS_REQUIRED'));
  var norm = null;
  if (itemsIn) {
    var keys = {};
    norm = itemsIn.map(function (x, i) {
      x = x || {};
      var pre = 'items.' + i + '.';
      var std = normStd_(x, errs, pre);
      var key = trimStr_(x.item_key);
      if (!key || keys[key]) key = uuid_();
      keys[key] = true;
      var old = byKey[key] || null;
      var tmpErrs = [];
      requireOneLang_(tmpErrs, x, null, 'name');
      tmpErrs.forEach(function (e) { e.field = pre + 'name'; errs.push(e); });
      return { x: x, std: std, key: key, old: old };
    });
  }
  if (errs.length) throw validationError_(errs);
  var trT = applyTranslations_('Templates', ['name', 'note'], p, cur);
  var items = norm ? norm.map(function (n, i) {
    var tr = applyTranslations_('TemplateItems', TPL_ITEM_I18N_, n.x, n.old);
    return Object.assign({}, n.std, tr.values, {
      item_key: n.key, step_no: i + 1, required: n.x.required === undefined ? true : !!n.x.required, photo_on_fail: !!n.x.photo_on_fail,
      library_item_id: trimStr_(n.x.library_item_id), i18n_meta: tr.meta
    });
  }) : null;
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: id,
    build: function (st) {
      var now = cur ? findOne_('Templates', 'template_id', id) : null;
      if (cur && !now) throw apiError_('NOT_FOUND');
      if (now) assertVersion_(ctx, now, 'TEMPLATE', 'Templates');
      if (!now && findRowNums_('Templates', 'template_id', id).length) throw validationError_([fieldError_('template_id', 'ID_EXISTS')]);
      var su = {};
      var nowItems = now ? templateItems_(id, now.revision) : [];
      var changed = !now;
      if (items && now) {
        var a = nowItems.map(itemSig_).join('|'), b = items.map(itemSig_).join('|');
        changed = a !== b;
      }
      var row = Object.assign({}, now || {}, trT.values, { template_id: id, frequency: freq, shifts: shifts, i18n_meta: trT.meta });
      delete row.__row;
      if (p.active !== undefined) row.active = !!p.active; else if (!now) row.active = true;
      var writes = [];
      if (!now) {
        row.template_code = allocCode_(st, su, 'TEMPLATE');
        row.revision = 1;
        cNew_(ctx, row);
      } else {
        if (changed) row.revision = Number(now.revision || 1) + 1;
        cUpdate_(ctx, row);
      }
      if (changed) {
        items.forEach(function (it) {
          var r = Object.assign({}, it, { template_item_id: uuid_(), template_id: id, revision: row.revision });
          writes.push({ sheet: 'TemplateItems', mode: 'insert', row: cNew_(ctx, r) });
        });
      }
      writes.unshift({ sheet: 'Templates', mode: now ? 'update' : 'insert', row: row });
      var outItems = changed ? writes.slice(1).map(function (w) { return projectRow_(ctx, w.row); }) : nowItems.map(function (r) { return projectRow_(ctx, r); });
      return {
        writes: writes, state: su,
        result: { template: projectRow_(ctx, row), items: outItems, new_revision: changed, record_version: row.record_version },
        record_version: row.record_version,
        audit: {
          entity_type: 'TEMPLATE', entity_id: id, before_json: now ? { revision: now.revision, name_vi: now.name_vi, frequency: now.frequency } : null,
          after_json: { revision: row.revision, name_vi: row.name_vi, frequency: row.frequency, shifts: row.shifts, items: items ? items.length : nowItems.length }
        }
      };
    }
  });
}

/** template.archive {template_id, active} — ngừng/dùng lại mẫu (máy đã gán không còn phải kiểm theo mẫu đã ngừng) */
function templateArchive_(ctx) {
  var p = ctx.req.payload || {};
  if (!isUuidV4_(p.template_id)) throw validationError_([fieldError_('template_id', 'ID_INVALID')]);
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: p.template_id,
    build: function () {
      var now = findOne_('Templates', 'template_id', p.template_id);
      if (!now) throw apiError_('NOT_FOUND');
      assertVersion_(ctx, now, 'TEMPLATE', 'Templates');
      var row = Object.assign({}, now, { active: !!p.active });
      delete row.__row;
      cUpdate_(ctx, row);
      return {
        writes: [{ sheet: 'Templates', mode: 'update', row: row }],
        result: { template: projectRow_(ctx, row), record_version: row.record_version }, record_version: row.record_version,
        audit: { entity_type: 'TEMPLATE', entity_id: p.template_id, before_json: { active: now.active }, after_json: { active: row.active } }
      };
    }
  });
}
