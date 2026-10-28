/* 25_report: logo công ty trên báo cáo và PDF bảng tháng của từng máy (bộ dựng PDF lấy từ M&E d4.11).
 * Logo công ty: tệp riêng tư trong thư mục dữ liệu app, Settings giữ ID tệp và mã phiên bản; Quản trị tải lên/gỡ trong app.
 * PDF dựng bằng Google Docs (khổ A4 ngang): đầu trang logo, tiêu đề hai thứ tiếng, thông tin máy, ô tóm tắt, bảng tháng
 * (hạng mục × ngày, ô Cần chú ý nền vàng, Không đạt nền đỏ, bỏ sót "–"), bất thường và cách xử lý, khối ký. */

function fmtDateVN_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

/** Nhãn hai thứ tiếng từ từ điển của app (i18n/labels.json chép vào Code.gs lúc build) */
function lab_(key, vars) {
  var p = LABELS[key] || [key, key];
  var vi = p[0], zh = p[1];
  if (vars) Object.keys(vars).forEach(function (k) { vi = vi.split('{' + k + '}').join(vars[k]); zh = zh.split('{' + k + '}').join(vars[k]); });
  return vi + ' · ' + zh;
}

var REPORT_LOGO_MAX_BYTES_ = 1048576;
var PDF_C_ = {
  navy: '#17324F', ink: '#1F2933', muted: '#5B6875', line: '#C9D3DF', head: '#E6ECF3', zebra: '#F7F9FC', tile: '#F1F5F9', white: '#FFFFFF',
  good: '#1E7B4A', bad: '#B42318', bar: '#2A78D6', elec: '#EB6834', water: '#2A78D6', elecLight: '#F6C1AA', waterLight: '#AFCBEF'
};
var PDF_STYLE_BUDGET_MS_ = 12000;
var PDF_LOGO_PX_H_ = 56;   // chiều cao logo đầu trang (Docs tính px ≈ 0,75 pt → khoảng 42 pt, 1,5 cm)
var PDF_MARGIN_ = 40;
var PDF_BAR_PT_ = 7;       // cỡ chữ của thanh; mỗi ký tự khối tính rộng tối đa 1 em (7 pt) để thanh dài nhất không tràn dòng dù phông thay thế rộng

/* ---------------- Logo báo cáo ---------------- */

/** Tệp logo đang dùng (Blob) hoặc null khi chưa có / tệp đã mất */
function reportLogoBlob_() {
  var id = setting_('report_logo_file_id');
  if (!id) return null;
  try {
    var f = DriveApp.getFileById(String(id));
    if (f.isTrashed()) return null;
    return f.getBlob();
  } catch (e) { return null; }
}

function reportLogoRev_() { return String(setting_('report_logo_rev') || ''); }

/** report.logo.get: logo cho bản xem trước và Excel trên máy ({rev: ''} khi chưa có) */
function reportLogoGet_(ctx) {
  var b = reportLogoBlob_();
  if (!b) return { rev: '' };
  return { rev: reportLogoRev_(), mime_type: b.getContentType(), content_b64: b64_(b.getBytes()) };
}

/**
 * report.logo.set {content_b64, mime_type: image/png | image/jpeg} hoặc {remove: true} — C4, PIN.
 * Ảnh ≤ 1 MB (app thu nhỏ trước khi gửi); cùng nội dung với logo đang dùng → trả luôn, không tạo tệp mới.
 */
function reportLogoSet_(ctx) {
  var p = ctx.req.payload || {};
  var by = ctx.user.user_id;
  var oldId = String(setting_('report_logo_file_id') || '');
  var before = { rev: reportLogoRev_() };
  var audit = function (after) {
    writeAudit_({ user_id: by, device_id: ctx.req.device_id, action: 'report.logo.set', entity_type: 'SETTINGS', entity_id: 'report_logo',
      before_json: before, after_json: after, operation_id: ctx.req.operation_id || '', auth_basis: authBasis_(ctx) });
  };
  if (p.remove === true) {
    withWriteLock_(function () {
      writeSetting_('report_logo_file_id', '', by);
      writeSetting_('report_logo_rev', '', by);
      audit({ rev: '' });
    });
    if (oldId) { try { trashQuietly_(DriveApp.getFileById(oldId)); } catch (e) { /* bỏ qua */ } }
    return { rev: '' };
  }
  var errs = [];
  if (p.mime_type !== 'image/png' && p.mime_type !== 'image/jpeg') errs.push(fieldError_('mime_type', 'FILE_TYPE'));
  if (typeof p.content_b64 !== 'string' || !p.content_b64) errs.push(fieldError_('content_b64', 'REQUIRED'));
  if (errs.length) throw validationError_(errs);
  var bytes;
  try { bytes = b64d_(p.content_b64); } catch (e) { throw validationError_([fieldError_('content_b64', 'INVALID_VALUE')]); }
  if (!bytes.length) throw validationError_([fieldError_('content_b64', 'REQUIRED')]);
  if (bytes.length > REPORT_LOGO_MAX_BYTES_) throw validationError_([fieldError_('content_b64', 'FILE_TOO_LARGE')]);
  if (!magicOk_(bytes, p.mime_type)) throw validationError_([fieldError_('mime_type', 'FILE_TYPE')]);
  var rev = b64url_(sha256_(bytes)).slice(0, 16);
  if (rev === before.rev && reportLogoBlob_()) return { rev: rev };
  var file = appFolder_().createFile(Utilities.newBlob(bytes, p.mime_type, 'report-logo.' + DOC_MIME_[p.mime_type].ext));
  try {
    withWriteLock_(function () {
      writeSetting_('report_logo_file_id', file.getId(), by);
      writeSetting_('report_logo_rev', rev, by);
      audit({ rev: rev, bytes: bytes.length, mime_type: p.mime_type });
    });
  } catch (e) {
    trashQuietly_(file);
    throw e;
  }
  if (oldId && oldId !== file.getId()) { try { trashQuietly_(DriveApp.getFileById(oldId)); } catch (e2) { /* bỏ qua */ } }
  return { rev: rev };
}

/* ---------------- Khung PDF dùng chung ---------------- */

function pdfAttrs_(o) {
  var A = DocumentApp.Attribute, out = {};
  Object.keys(o).forEach(function (k) { out[A[k]] = o[k]; });
  return out;
}

/** Chữ của cả phần tử: cỡ, màu, đậm, nghiêng (editAsText dùng được cho đoạn, ô, hàng, bảng) */
function pdfText_(el, size, color, bold, italic) {
  var t = el.editAsText();
  if (size) t.setFontSize(size);
  if (color) t.setForegroundColor(color);
  if (bold !== undefined && bold !== null) t.setBold(!!bold);
  if (italic !== undefined && italic !== null) t.setItalic(!!italic);
  return el;
}

function pdfPara_(p, o) {
  if (o.align) p.setAlignment(DocumentApp.HorizontalAlignment[o.align]);
  p.setSpacingBefore(o.before || 0);
  p.setSpacingAfter(o.after || 0);
  if (o.line) p.setLineSpacing(o.line);
  if (o.text !== undefined) pdfText_(p, o.size, o.color, o.bold, o.italic);
  return p;
}

/**
 * Tạo tài liệu tạm: khổ A4 (ngang khi `wide`), lề, đầu trang có logo (nếu có), chân trang một dòng.
 * Trả {doc, body, width (pt dùng được), t0, logo}.
 */
function pdfStart_(opts) {
  var doc = DocumentApp.create(NAME_PREFIX + 'TMP_' + uuid_());
  var body = doc.getBody();
  var pageW = opts.wide ? 842 : 595, pageH = opts.wide ? 595 : 842;
  body.setPageWidth(pageW);
  body.setPageHeight(pageH);
  var logo = opts.logo === undefined ? reportLogoBlob_() : opts.logo;
  body.setMarginLeft(PDF_MARGIN_).setMarginRight(PDF_MARGIN_).setMarginBottom(44).setMarginTop(logo ? 84 : 40);
  if (logo) {
    try {
      var hs = doc.addHeader();
      var hp = hs.getParagraphs()[0] || hs.appendParagraph('');
      pdfPara_(hp, { align: 'LEFT' });
      var img = hp.appendInlineImage(logo);
      var w0 = img.getWidth(), h0 = img.getHeight();
      var h = PDF_LOGO_PX_H_, w = w0 && h0 ? Math.round(h * w0 / h0) : h;
      if (w > 220) { w = 220; h = w0 && h0 ? Math.round(w * h0 / w0) : h; }
      img.setWidth(w).setHeight(h);
    } catch (e) { logo = null; body.setMarginTop(40); }
  }
  if (opts.footer) {
    var fs = doc.addFooter();
    var fp = fs.getParagraphs()[0] || fs.appendParagraph('');
    fp.setText(opts.footer);
    pdfPara_(fp, { align: 'CENTER', text: true, size: 7, color: PDF_C_.muted });
  }
  return { doc: doc, body: body, width: pageW - 2 * PDF_MARGIN_, t0: Date.now(), logo: !!logo };
}

/** Lưu, đổi sang PDF, bỏ tệp tạm vào thùng rác */
function pdfFinish_(pd) {
  var id = pd.doc.getId();
  try {
    pd.doc.saveAndClose();
    return DriveApp.getFileById(id).getAs('application/pdf').getBytes();
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* bỏ qua */ }
  }
}

function pdfTimeLeft_(pd) { return Date.now() - pd.t0 < PDF_STYLE_BUDGET_MS_; }

/** Khối tiêu đề: dòng Việt to, dòng Trung dưới, căn giữa (dùng đoạn trống đầu thân tài liệu) */
function pdfTitle_(pd, vi, zh) {
  var p0 = pd.body.getParagraphs()[0];
  p0.setText(vi || zh || '');
  pdfPara_(p0, { align: 'CENTER', after: zh && vi ? 2 : 10, text: true, size: 16, color: PDF_C_.navy, bold: true });
  if (zh && vi) pdfPara_(pd.body.appendParagraph(zh), { align: 'CENTER', after: 10, text: true, size: 12, color: PDF_C_.navy, bold: true });
}

function pdfHeading_(pd, text, before) {
  return pdfPara_(pd.body.appendParagraph(text), { before: before === undefined ? 12 : before, after: 4, text: true, size: 10, color: PDF_C_.navy, bold: true });
}

function pdfNote_(pd, text) {
  return pdfPara_(pd.body.appendParagraph(text), { before: 2, text: true, size: 8, color: PDF_C_.muted, italic: true });
}

/** Bảng không viền, đệm ô nhỏ */
function pdfPlain_(t) {
  t.setBorderWidth(0);
  return t;
}

function pdfCellPad_(c, v, h) {
  c.setPaddingTop(v).setPaddingBottom(v).setPaddingLeft(h).setPaddingRight(h);
  return c;
}

/** Căn mọi đoạn trong ô */
function pdfCellAlign_(c, align) {
  var A = DocumentApp.HorizontalAlignment[align];
  for (var i = 0; i < c.getNumChildren(); i++) {
    var ch = c.getChild(i);
    if (ch.getType() === DocumentApp.ElementType.PARAGRAPH) ch.asParagraph().setAlignment(A);
  }
}

/** Thông tin hai cột: trái (kỳ, khu vực, lọc), phải (số báo cáo, ngày lập, người lập — căn phải). lines = [[nhãn, giá trị]] */
function pdfMeta_(pd, left, right) {
  var fmt = function (l) { return l[1] ? l[0] + ': ' + l[1] : l[0]; };
  var t = pdfPlain_(pd.body.appendTable([[left.map(fmt).join('\n'), right.map(fmt).join('\n')]]));
  t.setColumnWidth(0, Math.round(pd.width * 0.56)).setColumnWidth(1, pd.width - Math.round(pd.width * 0.56));
  pdfText_(t, 9, PDF_C_.ink);
  var r = t.getRow(0);
  pdfCellPad_(r.getCell(0), 2, 0);
  pdfCellPad_(r.getCell(1), 2, 0);
  pdfCellAlign_(r.getCell(1), 'RIGHT');
  return t;
}

/** Ô số tóm tắt: tối đa 4 ô một hàng; mỗi ô nhãn nhỏ xám + số đậm. items = [{label, value}] */
function pdfTiles_(pd, items) {
  if (!items.length) return null;
  var per = 4; // cố định 4 cột: ít ô thì ô vẫn cỡ vừa, phần còn lại trống (không nền)
  var rows = [];
  for (var i = 0; i < items.length; i += per) {
    var row = [];
    for (var j = 0; j < per; j++) row.push('');
    rows.push(row);
  }
  var t = pd.body.appendTable(rows);
  t.setBorderWidth(3).setBorderColor(PDF_C_.white);
  var w = Math.floor(pd.width / per);
  for (var k = 0; k < per; k++) t.setColumnWidth(k, w);
  items.forEach(function (it, n) {
    var c = t.getCell(Math.floor(n / per), n % per);
    c.setBackgroundColor(PDF_C_.tile);
    pdfCellPad_(c, 5, 7);
    var p0 = c.getChild(0).asParagraph();
    p0.setText(it.label);
    pdfText_(p0, 8, PDF_C_.muted, false);
    var p1 = c.appendParagraph(it.value);
    pdfPara_(p1, { before: 2, text: true, size: it.value.length > 18 ? 10 : 13, color: PDF_C_.navy, bold: true });
    if (it.note) pdfPara_(c.appendParagraph(it.note), { text: true, size: 7, color: PDF_C_.muted, bold: false });
  });
  return t;
}

/**
 * Biểu đồ thanh ngang bằng ký tự khối (chữ của tài liệu, in nét): [nhãn | thanh | số]. Một chuỗi → một màu, không chú giải;
 * số ghi bằng màu chữ thường. items = [{label, value (null = không vẽ), text (chữ ở cột số), light (thanh nhạt: thiếu một phần)}]
 */
function pdfBars_(pd, title, items, color, lightColor) {
  if (!items.length) return;
  pdfHeading_(pd, title, 10);
  var max = 0;
  items.forEach(function (it) { if (it.value !== null && it.value > max) max = it.value; });
  var wl = Math.round(pd.width * 0.3), wv = Math.round(pd.width * 0.2), wb = pd.width - wl - wv;
  var maxChars = Math.max(10, Math.min(60, Math.floor((wb - 8) / PDF_BAR_PT_)));
  var cells = items.map(function (it) {
    var n = it.value === null || !(max > 0) ? 0 : Math.max(it.value > 0 ? 1 : 0, Math.round(it.value / max * maxChars));
    return [it.label, n ? new Array(n + 1).join('\u2588') : '', it.text];
  });
  var t = pdfPlain_(pd.body.appendTable(cells));
  t.setColumnWidth(0, wl).setColumnWidth(1, wb).setColumnWidth(2, wv);
  pdfText_(t, 8, PDF_C_.ink);
  items.forEach(function (it, i) {
    var r = t.getRow(i);
    for (var c = 0; c < 3; c++) pdfCellPad_(r.getCell(c), 1, 2);
    var bar = r.getCell(1);
    if (bar.getText()) pdfText_(bar, PDF_BAR_PT_, it.light ? lightColor || color : color);
    if (it.value === null) pdfText_(r.getCell(2), 8, PDF_C_.muted, false, true);
  });
}

/**
 * Độ rộng cột (pt) theo nội dung: ước lượng số ký tự (dòng dài nhất trong ô, lấy mức 90 % các dòng để một ô quá dài không chiếm hết),
 * cột số/ngày hẹp, cột chữ có trần; thiếu chỗ thì co theo tỷ lệ nhưng không nhỏ hơn 26 pt; thừa chỗ thì giãn cho kín khổ.
 */
function pdfColWidths_(head, rows, types, avail, fixed0) {
  var n = head.length;
  var longest = function (s) { return String(s || '').split('\n').reduce(function (m, x) { return Math.max(m, x.length); }, 0); };
  var ideal = [];
  for (var c = 0; c < n; c++) {
    if (fixed0 && c === 0) { ideal.push(fixed0); continue; }
    var lens = rows.map(function (r) { return longest(r[c]); }).sort(function (a, b) { return a - b; });
    var p90 = lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))] : 0;
    var hl = longest(head[c]);
    var ty = types[c] || 'text';
    var cap = ty === 'num' || ty === 'money' || ty === 'date' ? 16 : (ty === 'time' ? 16 : (ty === 'code' ? 18 : 42));
    var chars = Math.min(cap, Math.max(p90, Math.min(hl, cap), ty === 'num' ? 4 : (ty === 'code' ? 7 : 6)));
    ideal.push(chars * 5 + 12); // ~5 pt mỗi ký tự ở cỡ 7–8, đệm ô 2 × 5 pt + 2
  }
  var free = avail - (fixed0 || 0);
  var flex = ideal.slice(fixed0 ? 1 : 0);
  var sum = flex.reduce(function (a, b) { return a + b; }, 0);
  var out = flex.map(function (w) { return w * free / sum; });
  if (sum > free) {
    // Co: cột nhỏ hơn 26 pt nâng lên 26, phần thiếu trừ đều vào các cột còn lại theo tỷ lệ
    for (var k = 0; k < 4; k++) {
      var under = 0, rest = 0;
      out.forEach(function (w) { if (w < 26) under += 26 - w; else rest += w; });
      if (!under) break;
      if (!(rest > 0)) break;
      out = out.map(function (w) { return w < 26 ? 26 : w - under * w / rest; });
    }
  }
  out = out.map(function (w) { return Math.floor(w); });
  return fixed0 ? [fixed0].concat(out) : out;
}

/**
 * Bảng dữ liệu có định dạng: tiêu đề nền xám nhạt chữ đậm, viền mảnh, cột # (khi `numbered`), số/tiền căn phải, ngày căn giữa,
 * hàng xen kẽ (≤ 300 dòng). types[i]: num | money | date | time | code | text. cellColor(r, c) → màu chữ riêng của ô (vd Đạt/Không đạt).
 */
function pdfTable_(pd, head, rows, types, opts) {
  opts = opts || {};
  var numbered = !!opts.numbered;
  var h = numbered ? ['#'].concat(head) : head.slice();
  var ty = numbered ? ['num'].concat(types) : types.slice();
  var data = rows.map(function (r, i) { return numbered ? [String(i + 1)].concat(r) : r; });
  if (!data.length) data = [h.map(function (x, i) { return i === (numbered ? 1 : 0) ? (opts.empty || lab_('field.no_records')) : ''; })];
  var t = pd.body.appendTable([h].concat(data));
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var widths = pdfColWidths_(h, data, ty, pd.width, numbered ? 24 : 0);
  widths.forEach(function (w, i) { t.setColumnWidth(i, w); });
  var fs = opts.fontSize || (h.length > 9 ? 7 : 8);
  pdfText_(t, fs, PDF_C_.ink);
  var hr = t.getRow(0);
  pdfText_(hr, fs, PDF_C_.navy, true);
  for (var c = 0; c < h.length; c++) {
    var hc = hr.getCell(c);
    hc.setBackgroundColor(PDF_C_.head);
    hc.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    if (ty[c] === 'num' || ty[c] === 'money') pdfCellAlign_(hc, 'RIGHT');
    else if (ty[c] === 'date') pdfCellAlign_(hc, 'CENTER');
  }
  if (!rows.length) { pdfText_(t.getRow(1), fs, PDF_C_.muted, false, true); return t; }
  var zebra = data.length <= 300;
  var alignCols = [];
  ty.forEach(function (x, i) { if (x === 'num' || x === 'money') alignCols.push([i, 'RIGHT']); else if (x === 'date') alignCols.push([i, 'CENTER']); });
  for (var r = 1; r <= data.length; r++) {
    if (!pdfTimeLeft_(pd)) break;
    var row = t.getRow(r);
    if (numbered) pdfText_(row.getCell(0), fs, PDF_C_.muted);
    if (zebra && r % 2 === 0) for (var z = 0; z < h.length; z++) row.getCell(z).setBackgroundColor(PDF_C_.zebra);
    for (var a = 0; a < alignCols.length; a++) {
      var cell = row.getCell(alignCols[a][0]);
      if (cell.getNumChildren()) cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment[alignCols[a][1]]);
    }
    if (opts.cellColor) {
      for (var cc = numbered ? 1 : 0; cc < h.length; cc++) {
        var col = opts.cellColor(r - 1, numbered ? cc - 1 : cc);
        if (col) pdfText_(row.getCell(cc), fs, col, true);
      }
    }
  }
  return t;
}

/** Bảng nhãn – giá trị (hồ sơ, phiếu): cột nhãn nền nhạt */
function pdfKv_(pd, kv) {
  var data = kv.length ? kv : [[lab_('field.no_records'), '']];
  var t = pd.body.appendTable(data);
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var wl = Math.round(pd.width * 0.32);
  t.setColumnWidth(0, wl).setColumnWidth(1, pd.width - wl);
  pdfText_(t, 9, PDF_C_.ink);
  for (var i = 0; i < data.length; i++) {
    if (!pdfTimeLeft_(pd)) break;
    var c = t.getRow(i).getCell(0);
    c.setBackgroundColor(PDF_C_.tile);
    pdfText_(c, 8, PDF_C_.muted, true);
  }
  return t;
}

/** Khối ký: Người lập (có tên người tạo khi biết) · Trưởng bộ phận; dòng hướng dẫn ký, khoảng trống để ký */
function pdfSign_(pd, preparedName) {
  var spacer = pd.body.appendParagraph('');
  pdfPara_(spacer, { before: 14 });
  var hint = lab_('rpt.sign_hint');
  var t = pdfPlain_(pd.body.appendTable([
    [lab_('rpt.prepared_by'), lab_('rpt.approved_by')],
    [hint, hint],
    ['\n\n\n', '\n\n\n'],
    [preparedName || '', '']
  ]));
  var half = Math.floor(pd.width / 2);
  t.setColumnWidth(0, half).setColumnWidth(1, pd.width - half);
  pdfText_(t, 9, PDF_C_.ink);
  pdfText_(t.getRow(0), 9, PDF_C_.navy, true);
  pdfText_(t.getRow(1), 7, PDF_C_.muted, false, true);
  pdfText_(t.getRow(3), 9, PDF_C_.ink, true);
  for (var r = 0; r < 4; r++) for (var c = 0; c < 2; c++) { pdfCellPad_(t.getRow(r).getCell(c), 1, 4); pdfCellAlign_(t.getRow(r).getCell(c), 'CENTER'); }
  return t;
}


/* ---------------- PDF bảng tháng của một máy ---------------- */

var PDF_CELL_C_ = {
  WARN: { bg: '#FFF4D6', fg: '#7A4D00' }, FAIL: { bg: '#FDECEA', fg: '#9B2C20' }, MISS: { bg: '#EEF1F4', fg: '#52606D' }, OKMARK: { fg: '#1E7B4A' }
};

/** Chữ ngắn trong ô bảng tháng */
function gridCellText_(r) {
  if (!r || r.result === 'EMPTY') return '';
  if (r.input_type === 'NUMBER') return fmtNumVi_(r.value);
  if (r.input_type === 'THREE_PHASE') return Array.isArray(r.values) ? fmtNumVi_(Math.max.apply(null, r.values.filter(function (x) { return x !== null; }))) : '';
  if (r.result === 'OK') return '✓';
  if (r.result === 'WARN') return '!';
  return '✕';
}

/**
 * Lưới một mẫu (một ca nếu kiểm theo ca): hạng mục × kỳ trong tháng. Trả {head, rows, colors, counts, people}.
 * colors[r][c] = {bg, fg}; counts = {due, done, fail, warn}.
 */
function monthGrid_(md, tpl, shift, people) {
  var periods = monthPeriods_(tpl.frequency, md.ym, shift);
  var asg = md.assignments.filter(function (a) { return a.template_id === tpl.template_id; })[0] || null;
  var runs = md.runs.filter(function (r) { return r.template_id === tpl.template_id && (tpl.frequency !== 'SHIFT' || String(r.shift) === String(shift)); });
  var runBy = {};
  runs.forEach(function (r) { runBy[r.period_key] = r; });
  var missedBy = {};
  md.missed.forEach(function (m) { if (m.template_id === tpl.template_id) missedBy[m.period_key] = m; });
  var items = templateItems_(tpl.template_id, tpl.revision);
  var keys = items.map(function (it) { return { key: it.item_key, vi: it.name_vi, zh: it.name_zh, std: stdText_(effItem_(it, asg ? asg.overrides_json : null), 'vi') }; });
  // Hạng mục chỉ có ở phiên bản cũ (đã bỏ khỏi mẫu) nhưng có kết quả trong tháng: vẫn hiện để không mất số liệu
  runs.forEach(function (r) {
    (r.results_json || []).forEach(function (x) {
      if (!keys.some(function (k) { return k.key === x.item_key; })) keys.push({ key: x.item_key, vi: x.name_vi, zh: x.name_zh, std: x.std_vi || '' });
    });
  });
  var nowMs = now_().getTime();
  var counts = { due: 0, done: 0, fail: 0, warn: 0 };
  var state = periods.map(function (per) {
    var sp = periodSpan_(tpl.frequency, per, shift);
    var run = runBy[per.key] || null;
    var started = sp.start <= nowMs, ended = sp.end <= nowMs;
    var inScope = !asg || !asg.start_date || per.last >= asg.start_date;
    if (run) { counts.due++; counts.done++; counts.fail += run.fail_count || 0; counts.warn += run.warn_count || 0; } else if (ended && inScope && asg && asg.active) counts.due++;
    return { run: run, miss: !run && ended && inScope && !!asg && asg.active, excused: !!missedBy[per.key], future: !started };
  });
  var head = ['#', lab_('rpt.col_item'), lab_('rpt.col_std')].concat(periods.map(function (p) { return p.label; }));
  var rows = [], colors = [];
  keys.forEach(function (k, i) {
    var row = [String(i + 1), (k.vi || '') + (k.zh ? '\n' + k.zh : ''), k.std || ''];
    var col = [null, null, null];
    state.forEach(function (st) {
      if (st.run) {
        var x = (st.run.results_json || []).filter(function (y) { return y.item_key === k.key; })[0];
        row.push(gridCellText_(x));
        col.push(x && (x.result === 'WARN' || x.result === 'FAIL') ? PDF_CELL_C_[x.result] : (x && x.result === 'OK' && gridCellText_(x) === '✓' ? PDF_CELL_C_.OKMARK : null));
      } else if (st.miss) { row.push('–'); col.push(PDF_CELL_C_.MISS); } else { row.push(''); col.push(null); }
    });
    rows.push(row); colors.push(col);
  });
  // Người kiểm (số thứ tự, chú thích dưới bảng) và trưởng bộ phận xác nhận ngày
  var who = ['', lab_('rpt.row_checker'), ''], conf = ['', lab_('rpt.row_confirm'), ''];
  var wc = [null, null, null], cc = [null, null, null];
  state.forEach(function (st, j) {
    if (st.run) {
      if (!people.map[st.run.checked_by]) { people.list.push(st.run.checked_by); people.map[st.run.checked_by] = people.list.length; }
      who.push(String(people.map[st.run.checked_by])); wc.push(null);
    } else { who.push(st.miss ? '–' : ''); wc.push(st.miss ? PDF_CELL_C_.MISS : null); }
    var per = periods[j];
    var ok = (tpl.frequency === 'DAY' || tpl.frequency === 'SHIFT') && dayLocked_(per.date, md.machine.area_id, md.confirms);
    conf.push(ok ? '✓' : ''); cc.push(ok ? PDF_CELL_C_.OKMARK : null);
  });
  rows.push(who, conf); colors.push(wc, cc);
  return { head: head, rows: rows, colors: colors, counts: counts, nCols: head.length };
}

/** Bảng lưới tháng trong PDF: cột hẹp đều cho các kỳ, ô màu theo kết quả */
function pdfGrid_(pd, g) {
  var t = pd.body.appendTable([g.head].concat(g.rows));
  t.setBorderWidth(1).setBorderColor(PDF_C_.line);
  var nPer = g.nCols - 3;
  var wNo = 16, wStd = 70, wItem = 122;
  var wPer = Math.max(14, Math.floor((pd.width - wNo - wStd - wItem) / Math.max(1, nPer)));
  if (nPer <= 6) { wPer = Math.floor((pd.width - wNo - wItem - wStd) / nPer); }
  t.setColumnWidth(0, wNo).setColumnWidth(1, wItem).setColumnWidth(2, wStd);
  for (var c = 3; c < g.nCols; c++) t.setColumnWidth(c, wPer);
  var fs = nPer > 20 ? 6 : 7;
  pdfText_(t, fs, PDF_C_.ink);
  var hr = t.getRow(0);
  pdfText_(hr, fs, PDF_C_.navy, true);
  for (var h = 0; h < g.nCols; h++) {
    var hc = hr.getCell(h);
    hc.setBackgroundColor(PDF_C_.head);
    pdfCellPad_(hc, 1, 1);
    if (h >= 3) pdfCellAlign_(hc, 'CENTER');
  }
  for (var r = 0; r < g.rows.length; r++) {
    if (!pdfTimeLeft_(pd)) break;
    var row = t.getRow(r + 1);
    var extra = r >= g.rows.length - 2;
    for (var c2 = 0; c2 < g.nCols; c2++) {
      var cell = row.getCell(c2);
      pdfCellPad_(cell, 1, 1);
      if (c2 >= 3) pdfCellAlign_(cell, 'CENTER');
      var col = g.colors[r][c2];
      if (col) {
        if (col.bg) cell.setBackgroundColor(col.bg);
        pdfText_(cell, fs, col.fg, true);
      }
    }
    if (extra) { row.getCell(1).setBackgroundColor(PDF_C_.tile); pdfText_(row.getCell(1), fs, PDF_C_.navy, true); }
    pdfText_(row.getCell(0), fs, PDF_C_.muted);
  }
  return t;
}

/**
 * report.pdf {machine_id, ym, template_id?, shift?} — PDF bảng tháng của một máy. Mẫu kiểm theo ca: mỗi ca một bảng
 * (hoặc đúng ca chọn). Trả {file_name, report_code, content_b64}.
 */
function reportPdfAction_(ctx) {
  var p = ctx.req.payload || {};
  var md = monthData_(p.machine_id, trimStr_(p.ym));
  var tpls = md.templates.filter(function (t) { return !p.template_id || t.template_id === p.template_id; });
  if (!tpls.length) throw validationError_([fieldError_('template_id', 'NOT_ASSIGNED')]);
  var code = withWriteLock_(function () {
    var st = readState_(), su = {};
    var c = allocCode_(st, su, 'REPORT');
    stateWrite_(st, su, ctx.user.user_id);
    writeAudit_({ user_id: ctx.user.user_id, device_id: ctx.req.device_id, action: 'report.pdf', entity_type: 'MACHINE', entity_id: md.machine.machine_id,
      before_json: null, after_json: { report_code: c, ym: md.ym, template_id: p.template_id || '' }, operation_id: '', auth_basis: authBasis_(ctx) });
    return c;
  });
  var mac = md.machine;
  var macName = (mac.name_vi || '') + (mac.name_zh ? ' · ' + mac.name_zh : '');
  var title = lab_('rpt.title');
  var nowIso = isoVN_(now_());
  var footer = title + ' · ' + code + ' · ' + mac.machine_code + ' · ' + lab_('rpt.generated_at') + ' ' + fmtDateVN_(nowIso) + ' ' + nowIso.slice(11, 16);
  var pd = pdfStart_({ wide: true, footer: footer });
  var tp = LABELS['rpt.title'] || ['', ''];
  pdfTitle_(pd, tp[0].toUpperCase(), tp[1]);
  var areaName = md.area ? (md.area.area_code ? md.area.area_code + ' · ' : '') + (md.area.name_vi || '') + (md.area.name_zh ? ' · ' + md.area.name_zh : '') : '';
  pdfMeta_(pd, [
    [lab_('rpt.machine'), mac.machine_code + ' · ' + macName],
    [lab_('rpt.area'), areaName || '—'],
    [lab_('rpt.month'), md.ym.slice(5, 7) + '/' + md.ym.slice(0, 4)]
  ], [
    [lab_('rpt.number'), code],
    [lab_('rpt.generated_at'), fmtDateVN_(nowIso) + ' ' + nowIso.slice(11, 16)],
    [lab_('rpt.prepared_by'), ctx.user.display_name]
  ]);
  var people = { list: [], map: {} };
  var shiftsAll = shiftsCfg_();
  tpls.forEach(function (tpl) {
    var shifts = tpl.frequency === 'SHIFT' ? String(tpl.shifts || '').split(',').filter(String) : [''];
    if (tpl.frequency === 'SHIFT' && p.shift && shifts.indexOf(String(p.shift)) >= 0) shifts = [String(p.shift)];
    shifts.forEach(function (sh) {
      var g = monthGrid_(md, tpl, sh, people);
      var shTxt = '';
      if (sh) {
        var sc = shiftsAll.filter(function (x) { return String(x.no) === sh; })[0];
        shTxt = ' · ' + lab_('rpt.shift', { N: sh }) + (sc ? ' (' + sc.start + ' – ' + sc.end + ')' : '');
      }
      pdfHeading_(pd, tpl.template_code + ' · ' + (tpl.name_vi || tpl.name_zh) + ' · ' + lab_('freq.' + tpl.frequency) + shTxt + ' · ' + lab_('rpt.revision', { N: tpl.revision }), 8);
      var rate = g.counts.due ? Math.round(g.counts.done / g.counts.due * 1000) / 10 : 0;
      pdfTiles_(pd, [
        { label: lab_('rpt.tile_runs'), value: g.counts.done + '/' + g.counts.due },
        { label: lab_('rpt.tile_rate'), value: String(rate).replace('.', ',') + ' %' },
        { label: lab_('rpt.tile_fail'), value: String(g.counts.fail) },
        { label: lab_('rpt.tile_warn'), value: String(g.counts.warn) }
      ]);
      pdfGrid_(pd, g);
    });
  });
  var dir = userDirectory_();
  var nm = function (id) { var u = dir[id]; return u ? u.employee_code + ' ' + u.display_name : ''; };
  pdfNote_(pd, lab_('rpt.legend') + (people.list.length ? ' · ' + lab_('rpt.checkers') + ': ' + people.list.map(function (id, i) { return (i + 1) + ' = ' + nm(id); }).join(', ') : ''));
  var abn = md.abnormals.filter(function (a) { return tpls.some(function (t) { return t.template_id === a.template_id; }); })
    .sort(function (a, b) { return String(a.work_date + a.shift).localeCompare(String(b.work_date + b.shift)); });
  pdfHeading_(pd, lab_('rpt.abnormals'), 10);
  pdfTable_(pd, [lab_('rpt.col_date'), lab_('rpt.col_item'), lab_('rpt.col_value'), lab_('rpt.col_std'), lab_('rpt.col_note'), lab_('rpt.col_resolution'), lab_('rpt.col_status')],
    abn.map(function (a) {
      return [fmtDateVN_(a.work_date) + (a.shift ? ' · ' + lab_('rpt.shift', { N: a.shift }).split(' · ')[0] : ''), a.item_name_vi || a.item_name_zh, a.value_text, a.std_text,
        a.note || '', (a.resolution_vi || a.resolution_zh || '') + (a.resolved_by ? ' (' + nm(a.resolved_by) + ')' : ''), lab_('abn_status.' + a.status)];
    }), ['date', 'text', 'text', 'text', 'text', 'text', 'text'],
    { numbered: true, empty: lab_('rpt.no_abnormals'), cellColor: function (r, c) { return c === 6 ? (abn[r].status === 'OPEN' ? PDF_C_.bad : PDF_C_.good) : null; } });
  var miss = md.missed.filter(function (m) { return tpls.some(function (t) { return t.template_id === m.template_id; }); });
  if (miss.length) {
    pdfHeading_(pd, lab_('rpt.missed_reasons'), 10);
    pdfTable_(pd, [lab_('rpt.col_date'), lab_('rpt.col_reason'), lab_('rpt.col_by')],
      miss.map(function (m) { return [fmtDateVN_(m.work_date) + (m.shift ? ' · ' + m.shift : ''), m.reason_vi || m.reason_zh, nm(m.recorded_by)]; }), ['date', 'text', 'text'], { numbered: true });
  }
  pdfSign_(pd, ctx.user.display_name);
  var bytes = pdfFinish_(pd);
  return { file_name: code + '_' + mac.machine_code + '_' + md.ym + '.pdf', report_code: code, mime_type: 'application/pdf', content_b64: b64_(bytes) };
}
