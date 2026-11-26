// App (js/judge.js, tô màu khi gõ) và máy chủ (17_judge.js, đánh giá lại khi lưu) phải cho cùng kết quả trên cùng bộ ví dụ:
// đánh giá Đạt / Cần chú ý / Không đạt, chữ tiêu chuẩn, ca của một thời điểm, khóa kỳ, các kỳ của bảng tháng, mốc kỳ
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../../js/judge.js';
import { freshServer } from '../helpers.mjs';

/** Bản ghi từ máy chủ chạy trong vm (khác realm) → object thường để so sánh */
const plain = (x) => JSON.parse(JSON.stringify(x));

const ITEMS = [
  { input_type: 'NUMBER', unit: '°C', std_type: 'RANGE', std_min: 30, std_max: 60, warn_hi: 55 },
  { input_type: 'NUMBER', unit: 'bar', std_type: 'RANGE', std_min: 6, std_max: 8, warn_lo: 6.2, warn_hi: 7.8 },
  { input_type: 'NUMBER', unit: 'mm/s', std_type: 'MAX', std_max: 4.5, warn_hi: 3.5 },
  { input_type: 'NUMBER', unit: 'MΩ', std_type: 'MIN', std_min: 1 },
  { input_type: 'NUMBER', unit: 'V', std_type: 'TOL', std_nominal: 380, std_tol_pct: 5 },
  { input_type: 'NUMBER', unit: 'rpm', std_type: 'NONE' },
  { input_type: 'THREE_PHASE', unit: 'A', std_type: 'MAX', std_max: 50, extra_json: { imb_max: 10, imb_warn: 8 } },
  { input_type: 'THREE_PHASE', unit: 'A', std_type: 'NONE', extra_json: {} },
  { input_type: 'THREE_PHASE', unit: 'A', std_type: 'NONE', extra_json: { imb_max: 10 }, std_text_vi: 'Theo định mức tủ', std_text_zh: '按配电柜额定值' },
  { input_type: 'THREE_PHASE', unit: 'V', std_type: 'TOL', std_nominal: 380, std_tol_pct: 5, extra_json: { imb_max: 10 } },
  { input_type: 'CHOICE', choices_json: [{ code: 'OK', vi: 'Đủ', zh: '充足', result: 'OK' }, { code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'WARN' }, { code: 'BELOW_MIN', vi: 'Dưới min', zh: '低于下限', result: 'FAIL' }] },
  { input_type: 'CHOICE', choices_json: [{ code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'FAIL' }, { code: 'NORMAL', vi: 'Bình thường', zh: '正常', result: 'OK' }, { code: 'HIGH', vi: 'Cao', zh: '偏高', result: 'WARN' }] },
  { input_type: 'PASS_FAIL', std_text_vi: 'Không rò rỉ', std_text_zh: '无泄漏' },
  { input_type: 'TEXT' }
];
const INPUTS = [
  {}, { value: 29.9 }, { value: 30 }, { value: 54.9 }, { value: 55 }, { value: 60 }, { value: 60.01 }, { value: 6.2 }, { value: 7.8 }, { value: 5.4 },
  { value: 3.5 }, { value: 4.5 }, { value: 4.51 }, { value: 0.99 }, { value: 361 }, { value: 360.9 }, { value: 399 }, { value: 399.1 }, { value: '' }, { value: null },
  { values: [40, 41, 44] }, { values: [40, 41, 49] }, { values: [40, 41, 46] }, { values: [51, 50, 50] }, { values: [0, 0, 0] }, { values: [40, null, 41] },
  { choice: 'LOW' }, { choice: 'NORMAL' }, { choice: 'HIGH' }, { choice: 'X' }, { pass: true }, { pass: false }, { text: ' ' }, { text: 'ok' }
];

test('đánh giá và chữ tiêu chuẩn: app = máy chủ', () => {
  const env = freshServer();
  const g = env.g;
  let n = 0;
  for (const it of ITEMS) {
    const full = g.effItem_(it, null);
    const cli = J.effItem(it, null);
    for (const lang of ['vi', 'zh']) assert.equal(J.stdText(cli, lang), g.stdText_(full, lang), `stdText ${lang} ${JSON.stringify(it)}`);
    for (const inp of INPUTS) {
      const s = g.judgeItem_(full, inp), c = J.judgeItem(cli, inp);
      assert.equal(c.result, s.result, `${JSON.stringify(it)} ${JSON.stringify(inp)}`);
      assert.equal(c.imb, s.imb, `imb ${JSON.stringify(inp)}`);
      n++;
    }
  }
  // Tiêu chuẩn riêng theo máy (overrides theo item_key)
  const ti = { item_key: 'k1', input_type: 'NUMBER', unit: '°C', std_type: 'MAX', std_max: 60 };
  const ov = { k1: { std_type: 'MAX', std_max: 65, warn_hi: 62 } };
  for (const v of [59, 61, 63, 66]) assert.equal(J.judgeItem(J.effItem(ti, ov), { value: v }).result, g.judgeItem_(g.effItem_(ti, ov), { value: v }).result);
  // Tiêu chuẩn riêng là trọn bộ: ngưỡng Cần chú ý để trống ở máy không lấy ngưỡng của mẫu
  const ti2 = { item_key: 'k2', input_type: 'NUMBER', unit: '°C', std_type: 'RANGE', std_min: 70, std_max: 100, warn_hi: 95 };
  const ov2 = { k2: { unit: '°C', std_type: 'MAX', std_min: null, std_max: 110, std_nominal: null, std_tol_pct: null, warn_lo: null, warn_hi: null, extra_json: null } };
  for (const v of [60, 96, 105, 111]) {
    assert.equal(J.judgeItem(J.effItem(ti2, ov2), { value: v }).result, g.judgeItem_(g.effItem_(ti2, ov2), { value: v }).result, String(v));
  }
  assert.deepEqual([60, 96, 105, 111].map((v) => J.judgeItem(J.effItem(ti2, ov2), { value: v }).result), ['OK', 'OK', 'OK', 'FAIL']);
  assert.equal(J.stdText(J.effItem(ti2, ov2)), '≤ 110 °C');
  assert.ok(n > 300);
});

test('ca, kỳ, các kỳ của bảng tháng, mốc kỳ: app = máy chủ (ca mặc định và ca 2 kíp 12 giờ)', () => {
  const env = freshServer();
  const g = env.g;
  const cfgs = [J.DEFAULT_SHIFTS, [{ no: 1, start: '07:00', end: '19:00' }, { no: 2, start: '19:00', end: '07:00' }]];
  for (const cfg of cfgs) {
    env.g.writeSetting_('shifts_json', cfg, 'TEST');
    g.dbReset_();
    const sh = J.shiftsFrom({ shifts_json: g.shiftsCfg_() });
    for (const t of ['2026-10-28T05:59:00+07:00', '2026-10-28T06:00:00+07:00', '2026-10-28T13:59:00+07:00', '2026-10-28T14:00:00+07:00', '2026-10-28T21:30:00+07:00',
      '2026-10-28T23:59:00+07:00', '2026-10-29T02:00:00+07:00', '2026-10-29T06:59:00+07:00', '2026-10-29T07:00:00+07:00', '2026-12-31T23:00:00+07:00']) {
      assert.deepEqual(J.shiftAt(t, sh), plain(g.shiftAt_(new Date(t))), t);
    }
    for (const freq of ['SHIFT', 'DAY', 'WEEK', 'MONTH']) {
      for (const ym of ['2026-10', '2026-02', '2026-12', '2027-01']) {
        for (const s of freq === 'SHIFT' ? sh.map((x) => String(x.no)) : ['']) {
          const a = J.monthPeriods(freq, ym, s), b = plain(g.monthPeriods_(freq, ym, s));
          assert.deepEqual(a, b, `${freq} ${ym} ${s}`);
          for (const p of a) assert.deepEqual(J.periodSpan(freq, p, s, sh), plain(g.periodSpan_(freq, p, s)), `${freq} ${p.key}`);
        }
      }
    }
    for (const d of ['2026-01-01', '2026-12-28', '2027-01-03', '2026-10-28']) {
      for (const f of ['SHIFT', 'DAY', 'WEEK', 'MONTH']) assert.equal(J.periodKey(f, d, '2'), g.periodKey_(f, d, '2'));
    }
  }
});

test('ca của mẫu theo Giờ ca đang cài: app = máy chủ; ca đã bớt không thành kỳ bỏ sót, không là kỳ đang chạy', () => {
  const env = freshServer();
  const g = env.g;
  const two = [{ no: 1, start: '07:00', end: '19:00' }, { no: 2, start: '19:00', end: '07:00' }];
  env.g.writeSetting_('shifts_json', two, 'TEST');
  g.dbReset_();
  const sh = J.shiftsFrom({ shifts_json: g.shiftsCfg_() });
  for (const s of ['1,2,3', '3', '2,1', '', '1, 2']) {
    assert.deepEqual(J.tplShifts({ shifts: s }, sh), plain(g.tplShifts_({ shifts: s })), s);
  }
  const tpl = { frequency: 'SHIFT', shifts: '1,2,3' };
  const ended = J.endedPeriods(tpl, Date.parse('2026-10-29T08:00:00+07:00'), 2, sh);
  assert.ok(ended.length > 0);
  assert.ok(ended.every((p) => p.shift === '1' || p.shift === '2'), JSON.stringify(ended));
  // Mẫu chỉ còn ca đã bớt: không có kỳ đang chạy
  assert.equal(J.currentPeriod({ frequency: 'SHIFT', shifts: '3' }, new Date('2026-10-29T08:00:00+07:00'), sh), null);
  assert.equal(J.currentPeriod(tpl, new Date('2026-10-29T08:00:00+07:00'), sh).shift, '1');
});
