/* 11_library: thư viện hạng mục kiểm tra (có sẵn ~30 hạng mục, Trưởng bộ phận/Quản trị thêm, sửa) và kiểm tra tiêu chuẩn
 * dùng chung cho hạng mục trong mẫu. Tiêu chuẩn mặc định chỉ là ví dụ: từng mẫu/máy đặt theo tài liệu nhà sản xuất. */

var LV_CHOICES_ = [
  { code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'FAIL' },
  { code: 'NORMAL', vi: 'Bình thường', zh: '正常', result: 'OK' },
  { code: 'HIGH', vi: 'Cao', zh: '偏高', result: 'WARN' }
];

/** [nhóm, tên Việt, tên Trung, kiểu nhập, đơn vị, kiểu tiêu chuẩn, min, max, chú ý dưới, chú ý trên, thêm] */
var LIBRARY_SEED_ = [
  ['TEMP', 'Nhiệt độ dầu', '油温', 'NUMBER', '°C', 'RANGE', 30, 60, null, 55],
  ['TEMP', 'Nhiệt độ khí xả', '排气温度', 'NUMBER', '°C', 'MAX', null, 100, null, 95],
  ['TEMP', 'Nhiệt độ vòng bi', '轴承温度', 'NUMBER', '°C', 'MAX', null, 80, null, 70],
  ['TEMP', 'Nhiệt độ động cơ', '电机温度', 'NUMBER', '°C', 'MAX', null, 90, null, 80],
  ['TEMP', 'Nhiệt độ nước làm mát vào', '冷却水进水温度', 'NUMBER', '°C', 'RANGE', 25, 32, null, null],
  ['TEMP', 'Nhiệt độ nước làm mát ra', '冷却水出水温度', 'NUMBER', '°C', 'RANGE', 25, 32, null, null],
  ['TEMP', 'Nhiệt độ tủ điện', '电柜温度', 'NUMBER', '°C', 'MAX', null, 40, null, 35],
  ['TEMP', 'Nhiệt độ phòng', '室温', 'NUMBER', '°C', 'MAX', null, 35, null, null],
  ['PRESS', 'Áp suất khí nén', '压缩空气压力', 'NUMBER', 'bar', 'RANGE', 6, 8, 6.2, 7.8],
  ['PRESS', 'Áp suất dầu', '油压', 'NUMBER', 'MPa', 'RANGE', 0.3, 0.5, null, null],
  ['PRESS', 'Áp suất nước', '水压', 'NUMBER', 'bar', 'MIN', 2, null, 2.2, null],
  ['PRESS', 'Chênh áp lọc', '过滤器压差', 'NUMBER', 'bar', 'MAX', null, 0.7, null, 0.6],
  ['PRESS', 'Áp cao gas lạnh', '制冷剂高压', 'NUMBER', 'bar', 'NONE', null, null, null, null],
  ['PRESS', 'Áp thấp gas lạnh', '制冷剂低压', 'NUMBER', 'bar', 'NONE', null, null, null, null],
  ['ELEC', 'Điện áp', '电压', 'NUMBER', 'V', 'TOL', null, null, null, null, { nominal: 380, tol: 5 }],
  ['ELEC', 'Dòng điện 3 pha', '三相电流', 'THREE_PHASE', 'A', 'MAX', null, 50, null, null, { extra: { imb_max: 10, imb_warn: 8 } }],
  ['ELEC', 'Hệ số công suất', '功率因数', 'NUMBER', '', 'MIN', 0.9, null, null, null],
  ['ELEC', 'Điện trở cách điện', '绝缘电阻', 'NUMBER', 'MΩ', 'MIN', 1, null, null, null],
  ['ELEC', 'Tần số', '频率', 'NUMBER', 'Hz', 'RANGE', 49.5, 50.5, null, null],
  ['MECH', 'Độ rung', '振动', 'NUMBER', 'mm/s', 'MAX', null, 4.5, null, 3.5],
  ['MECH', 'Tiếng ồn', '噪音', 'NUMBER', 'dB', 'MAX', null, 85, null, null],
  ['MECH', 'Tốc độ quay', '转速', 'NUMBER', 'rpm', 'NONE', null, null, null, null],
  ['MECH', 'Dây đai', '皮带', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Căng đều, không nứt', '张紧均匀，无裂纹'] }],
  ['LEVEL', 'Mức dầu', '油位', 'CHOICE', '', 'NONE', null, null, null, null, { choices: LV_CHOICES_, text: ['Giữa vạch Min – Max', '在 Min – Max 刻度之间'] }],
  ['LEVEL', 'Mức nước', '水位', 'CHOICE', '', 'NONE', null, null, null, null, { choices: LV_CHOICES_ }],
  ['LEVEL', 'Lưu lượng', '流量', 'NUMBER', 'm³/h', 'NONE', null, null, null, null],
  ['QUALITY', 'Điểm sương khí nén', '压缩空气露点', 'NUMBER', '°C', 'MAX', null, 3, null, null],
  ['QUALITY', 'pH nước', '水的pH值', 'NUMBER', '', 'RANGE', 6.5, 8.5, null, null],
  ['QUALITY', 'Độ dẫn điện của nước', '水的电导率', 'NUMBER', 'µS/cm', 'NONE', null, null, null, null],
  ['VISUAL', 'Rò rỉ dầu, khí, nước', '漏油/漏气/漏水', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Không rò rỉ', '无泄漏'] }],
  ['VISUAL', 'Vệ sinh máy', '设备清洁', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Sạch, không bụi bẩn, không vật lạ', '清洁，无灰尘，无异物'] }],
  ['VISUAL', 'Bu lông, che chắn an toàn', '螺栓、安全防护罩', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Chặt, đủ che chắn', '紧固，防护齐全'] }],
  ['VISUAL', 'Đèn báo, nút dừng khẩn', '指示灯、急停按钮', 'PASS_FAIL', '', 'NONE', null, null, null, null, { text: ['Hoạt động bình thường', '功能正常'] }],
  ['OTHER', 'Ghi chú khác', '其他备注', 'TEXT', '', 'NONE', null, null, null, null]
];

function librarySeedRows_() {
  var nowIso = isoVN_(now_());
  return LIBRARY_SEED_.map(function (r, i) {
    var x = r[10] || {};
    var row = {
      item_id: 'LIB-' + ('00' + (i + 1)).slice(-3), group_key: r[0], name_vi: r[1], name_zh: r[2], input_type: r[3], unit: r[4],
      std_type: r[5], std_min: r[6], std_max: r[7], std_nominal: x.nominal === undefined ? null : x.nominal,
      std_tol_pct: x.tol === undefined ? null : x.tol, warn_lo: r[8], warn_hi: r[9], choices_json: x.choices || null,
      extra_json: x.extra || null, std_text_vi: x.text ? x.text[0] : '', std_text_zh: x.text ? x.text[1] : '', how_vi: '', how_zh: '',
      sort_order: i + 1, active: true, builtin: true,
      i18n_meta: { name: { src: 'vi', state: 'HUMAN', at: nowIso } }
    };
    return cNewSystem_(row);
  });
}

/** Nạp thư viện có sẵn còn thiếu (setup, migrateSchema) — không ghi đè hạng mục đã sửa */
function seedLibrary_() {
  var have = {};
  readRows_('LibraryItems').forEach(function (r) { have[r.item_id] = true; });
  var add = librarySeedRows_().filter(function (r) { return !have[r.item_id]; });
  if (add.length) systemWrite_(add.map(function (r) { return { sheet: 'LibraryItems', mode: 'insert', row: r }; }));
  return add.length;
}

/* ---------------- Kiểm tra hạng mục (thư viện và mẫu) ---------------- */

var CHOICE_CODE_RE_ = /^[A-Z0-9_]{1,20}$/;

function numField_(errs, prefix, name, v, required) {
  if (v === null || v === undefined || v === '') {
    if (required) errs.push(fieldError_(prefix + name, 'REQUIRED'));
    return null;
  }
  var n = Number(v);
  if (!isFinite(n)) { errs.push(fieldError_(prefix + name, 'INVALID_VALUE')); return null; }
  return n;
}

/**
 * Chuẩn hóa phần tiêu chuẩn của một hạng mục; lỗi ghi vào errs (field có tiền tố, vd "items.3.std_min").
 * Trả object các trường STD (chưa gồm tên/cách kiểm song ngữ — phần đó qua applyTranslations_).
 */
function normStd_(p, errs, prefix) {
  prefix = prefix || '';
  var it = {};
  it.input_type = INPUT_TYPES_.indexOf(p.input_type) >= 0 ? p.input_type : null;
  if (!it.input_type) errs.push(fieldError_(prefix + 'input_type', 'INVALID_VALUE'));
  it.group_key = ITEM_GROUPS_.indexOf(p.group_key) >= 0 ? p.group_key : 'OTHER';
  it.unit = trimStr_(p.unit).slice(0, 20);
  it.std_type = 'NONE';
  it.std_min = null; it.std_max = null; it.std_nominal = null; it.std_tol_pct = null; it.warn_lo = null; it.warn_hi = null;
  it.choices_json = null; it.extra_json = null;
  if (it.input_type === 'NUMBER' || it.input_type === 'THREE_PHASE') {
    it.std_type = STD_TYPES_.indexOf(p.std_type) >= 0 ? p.std_type : 'NONE';
    if (it.std_type === 'RANGE') {
      it.std_min = numField_(errs, prefix, 'std_min', p.std_min, true);
      it.std_max = numField_(errs, prefix, 'std_max', p.std_max, true);
      if (it.std_min !== null && it.std_max !== null && !(it.std_min < it.std_max)) errs.push(fieldError_(prefix + 'std_max', 'STD_INVALID'));
    } else if (it.std_type === 'MAX') {
      it.std_max = numField_(errs, prefix, 'std_max', p.std_max, true);
    } else if (it.std_type === 'MIN') {
      it.std_min = numField_(errs, prefix, 'std_min', p.std_min, true);
    } else if (it.std_type === 'TOL') {
      it.std_nominal = numField_(errs, prefix, 'std_nominal', p.std_nominal, true);
      it.std_tol_pct = numField_(errs, prefix, 'std_tol_pct', p.std_tol_pct, true);
      if (it.std_tol_pct !== null && !(it.std_tol_pct > 0 && it.std_tol_pct < 100)) errs.push(fieldError_(prefix + 'std_tol_pct', 'INVALID_VALUE'));
    }
    it.warn_lo = numField_(errs, prefix, 'warn_lo', p.warn_lo, false);
    it.warn_hi = numField_(errs, prefix, 'warn_hi', p.warn_hi, false);
    if (it.input_type === 'THREE_PHASE') {
      var ex = p.extra_json || {};
      var imbMax = numField_(errs, prefix, 'imb_max', ex.imb_max, false);
      var imbWarn = numField_(errs, prefix, 'imb_warn', ex.imb_warn, false);
      if (imbMax !== null && !(imbMax > 0 && imbMax < 100)) errs.push(fieldError_(prefix + 'imb_max', 'INVALID_VALUE'));
      it.extra_json = { imb_max: imbMax === null ? 10 : imbMax };
      if (imbWarn !== null) it.extra_json.imb_warn = imbWarn;
    }
  } else if (it.input_type === 'CHOICE') {
    var cs = Array.isArray(p.choices_json) ? p.choices_json : [];
    var seen = {}, okN = 0, bad = cs.length < 2 || cs.length > 8;
    var out = cs.map(function (c) {
      c = c || {};
      var code = trimStr_(c.code).toUpperCase();
      var vi = trimStr_(c.vi).slice(0, 60), zh = trimStr_(c.zh).slice(0, 60);
      var res = CHOICE_RESULTS_.indexOf(c.result) >= 0 ? c.result : 'OK';
      if (!CHOICE_CODE_RE_.test(code) || seen[code] || (!vi && !zh)) bad = true;
      seen[code] = true;
      if (res === 'OK') okN++;
      return { code: code, vi: vi, zh: zh, result: res };
    });
    if (bad || !okN) errs.push(fieldError_(prefix + 'choices_json', 'CHOICES_REQUIRED'));
    it.choices_json = out;
  }
  return it;
}

/* ---------------- library.edit ---------------- */

var LIB_I18N_ = ['name', 'std_text', 'how'];

/**
 * library.edit {item_id, group_key, name_vi|name_zh, input_type, unit, std_*, warn_*, choices_json, extra_json, std_text_*, how_*,
 *   sort_order, active}. Hạng mục mới: item_id là UUID do app tạo, expected_version 0.
 */
function libraryEdit_(ctx) {
  var p = ctx.req.payload || {};
  var id = p.item_id;
  var cur = id ? findOne_('LibraryItems', 'item_id', id) : null;
  if (!cur && !isUuidV4_(id)) throw validationError_([fieldError_('item_id', 'ID_INVALID')]);
  var errs = [];
  var std = normStd_(p, errs, '');
  requireOneLang_(errs, p, cur, 'name');
  if (errs.length) throw validationError_(errs);
  var tr = applyTranslations_('LibraryItems', LIB_I18N_, p, cur);
  return executeWrite_(ctx, {
    entity_type: 'LIBRARY_ITEM', entity_id: id,
    build: function () {
      var now = cur ? findOne_('LibraryItems', 'item_id', id) : null;
      if (cur && !now) throw apiError_('NOT_FOUND');
      if (now) assertVersion_(ctx, now, 'LIBRARY_ITEM', 'LibraryItems');
      if (!now && findRowNums_('LibraryItems', 'item_id', id).length) throw validationError_([fieldError_('item_id', 'ID_EXISTS')]);
      var row = Object.assign({}, now || {}, std, tr.values, { item_id: id, i18n_meta: tr.meta });
      delete row.__row;
      row.sort_order = p.sort_order !== undefined && isFinite(Number(p.sort_order)) ? Number(p.sort_order) : (now ? now.sort_order : 999);
      row.active = p.active === undefined ? (now ? now.active : true) : !!p.active;
      if (!now) { row.builtin = false; cNew_(ctx, row); } else cUpdate_(ctx, row);
      return {
        writes: [{ sheet: 'LibraryItems', mode: now ? 'update' : 'insert', row: row }],
        result: { item: projectRow_(ctx, row), record_version: row.record_version },
        record_version: row.record_version,
        audit: { entity_type: 'LIBRARY_ITEM', entity_id: id, before_json: now ? { name_vi: now.name_vi, std_type: now.std_type } : null, after_json: { name_vi: row.name_vi, std_type: row.std_type, active: row.active } }
      };
    }
  });
}
