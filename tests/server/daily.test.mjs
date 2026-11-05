// d1.3: bộ mẫu hằng ngày cho 7 loại máy (HN-01…07) làm cùng cách bộ mẫu ISO; bỏ hạng mục "nếu có" theo từng máy (overrides off)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../../js/judge.js';
import { freshServer, ownerClient, userClient, uuid, OWNER_PIN } from '../helpers.mjs';

const NOW = '2026-11-05T08:00:00+07:00';
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };
const KEYS = ['HN-01', 'HN-02', 'HN-03', 'HN-04', 'HN-05', 'HN-06', 'HN-07'];
/** Hạng mục của một mẫu hằng ngày đã tạo, theo thứ tự */
const itemsOf = (env, key) => {
  const id = env.g.isoUuid_(key);
  return env.rows('TemplateItems').filter((x) => x.template_id === id).sort((a, b) => a.step_no - b.step_no);
};
const byName = (list, vi) => { const x = list.find((i) => i.name_vi === vi); assert.ok(x, vi); return x; };

test('template.isoList {set:DAILY}: 7 mẫu theo ngày, khóa cố định không trùng bộ ISO; mặc định vẫn là bộ ISO', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  const d = ok(owner.call('template.isoList', { set: 'DAILY' })).data;
  assert.equal(d.set, 'DAILY');
  assert.deepEqual(d.templates.map((t) => t.key), KEYS);
  for (const t of d.templates) {
    assert.equal(t.frequency, 'DAY', t.key);
    assert.equal(t.set, 'DAILY');
    assert.equal(t.form_code, '', 'không phải biểu ISO: không có mã biểu mẫu');
    assert.equal(t.exists, false);
    assert.ok(t.items > 0 && t.items <= 60, t.key);
    assert.ok(env.g.isUuidV4_(t.template_id));
  }
  assert.deepEqual(d.templates.map((t) => t.items), [11, 10, 10, 6, 8, 12, 9], 'số hạng mục đúng danh sách của người dùng');
  const iso = ok(owner.call('template.isoList', {})).data;
  assert.equal(iso.set, 'ISO');
  assert.equal(iso.templates.length, 23);
  const isoIds = new Set(iso.templates.map((t) => t.template_id));
  assert.ok(d.templates.every((t) => !isoIds.has(t.template_id)), 'không trùng id mẫu ISO');
  // Ghi chú mẫu vừa ô sửa mẫu (≤ 300 ký tự)
  for (const t of env.g.DAILY_TEMPLATES_) {
    assert.ok(t.note_vi.length <= 300 && t.note_zh.length <= 300, t.key);
    assert.ok(t.name_vi && t.name_zh, t.key);
  }
});

test('template.isoSeed bộ hằng ngày: kiểu nhập, tiêu chuẩn đúng danh sách; "theo nhà sản xuất/cài đặt/thiết kế" = Không đặt; không tạo trùng', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  assert.equal(owner.write('template.isoSeed', { keys: ['HN-01'] }).code, 'REAUTH_REQUIRED');
  ok(owner.pin(OWNER_PIN));
  const r = ok(owner.write('template.isoSeed', { keys: KEYS }));
  assert.equal(r.data.created.length, 7);
  const tpls = env.rows('Templates');
  for (const k of KEYS) {
    const t = tpls.find((x) => x.template_id === env.g.isoUuid_(k));
    assert.equal(t.frequency, 'DAY');
    assert.equal(t.shifts, '');
    assert.equal(t.form_code, '');
    assert.equal(t.revision, 1);
  }
  const all = env.rows('TemplateItems');
  // [Mức]: Đủ (Đạt) / Thấp (Cần chú ý) / Dưới min (Không đạt)
  const levels = all.filter((x) => x.input_type === 'CHOICE');
  assert.equal(levels.length, 4, 'mức dầu nhớt, nước làm mát (máy phát), dầu máy nén khí, dầu máy nén chiller');
  for (const l of levels) assert.deepEqual(l.choices_json.map((c) => [c.vi, c.result]), [['Đủ', 'OK'], ['Thấp', 'WARN'], ['Dưới min', 'FAIL']]);
  // Máy phát
  const g = itemsOf(env, 'HN-01');
  assert.deepEqual([byName(g, 'Mức nhiên liệu bồn ngày').std_type, byName(g, 'Mức nhiên liệu bồn ngày').std_min, byName(g, 'Mức nhiên liệu bồn ngày').unit], ['MIN', 50, '%']);
  const bat = byName(g, 'Điện áp ắc quy');
  assert.deepEqual([bat.std_type, bat.unit, bat.std_text_vi], ['NONE', 'V', 'Theo nhà sản xuất']);
  assert.equal(byName(g, 'Số giờ chạy tích lũy').std_text_vi, 'Chỉ ghi');
  // Phòng điện: điện áp 3 pha 380 ± 5 %, dòng 3 pha theo định mức tủ lệch ≤ 10 %, cos φ ≥ 0,9, phòng ≤ 35
  const e = itemsOf(env, 'HN-02');
  const v = byName(e, 'Điện áp thanh cái tổng');
  assert.deepEqual([v.input_type, v.std_type, v.std_nominal, v.std_tol_pct, v.extra_json.imb_max], ['THREE_PHASE', 'TOL', 380, 5, 10]);
  assert.equal(env.g.stdText_(env.g.effItem_(v, null), 'vi'), '380 V ± 5 % (361 – 399 V) mỗi pha, lệch ≤ 10 %');
  const cur = byName(e, 'Dòng điện tổng');
  assert.deepEqual([cur.input_type, cur.std_type, cur.extra_json.imb_max], ['THREE_PHASE', 'NONE', 10]);
  assert.equal(env.g.stdText_(env.g.effItem_(cur, null), 'vi'), 'Theo định mức tủ, lệch ≤ 10 %');
  assert.equal(env.g.stdText_(env.g.effItem_(cur, null), 'zh'), '按配电柜额定值，不平衡 ≤ 10 %');
  assert.deepEqual([byName(e, 'Hệ số công suất cos φ').std_type, byName(e, 'Hệ số công suất cos φ').std_min], ['MIN', 0.9]);
  assert.deepEqual([byName(e, 'Nhiệt độ phòng').std_type, byName(e, 'Nhiệt độ phòng').std_max], ['MAX', 35]);
  // Máy nén khí, máy sấy
  const c = itemsOf(env, 'HN-03');
  assert.equal(byName(c, 'Áp suất khí ra').std_text_vi, 'Theo cài đặt');
  assert.deepEqual([byName(c, 'Nhiệt độ phòng máy').std_type, byName(c, 'Nhiệt độ phòng máy').std_max], ['MAX', 40]);
  assert.equal(byName(itemsOf(env, 'HN-04'), 'Điểm sương áp suất').std_max, 10);
  assert.equal(byName(itemsOf(env, 'HN-05'), 'Điểm sương áp suất').std_max, -40);
  // Chiller, bơm: mục "(nếu có)" không bắt buộc, còn lại bắt buộc
  const ch = itemsOf(env, 'HN-06');
  assert.equal(byName(ch, 'Nhiệt độ nước giải nhiệt vào (nếu có)').std_text_vi, 'Theo thiết kế');
  assert.equal(byName(ch, 'Nhiệt độ nước lạnh ra').std_text_vi, 'Theo cài đặt');
  const opt = all.filter((x) => x.required === false).map((x) => x.name_vi).sort();
  assert.deepEqual(opt, ['Biến tần không báo lỗi (nếu có)', 'Dàn ngưng sạch, quạt chạy đủ (nếu có)', 'Nhiệt độ nước giải nhiệt ra (nếu có)',
    'Nhiệt độ nước giải nhiệt vào (nếu có)', 'Tháp giải nhiệt: mức nước bể, quạt, phao châm nước (nếu có)']);
  assert.ok(all.filter((x) => /\(nếu có\)/.test(x.name_vi)).every((x) => x.required === false));
  // Mọi hạng mục số "Không đặt" đều có chữ tiêu chuẩn; tên đủ hai thứ tiếng
  for (const it of all) {
    assert.ok(it.name_vi && it.name_zh, it.name_vi);
    if ((it.input_type === 'NUMBER' || it.input_type === 'THREE_PHASE') && it.std_type === 'NONE') assert.ok(it.std_text_vi && it.std_text_zh, it.name_vi);
  }
  // Chạy lại không tạo trùng; bộ ISO vẫn tạo được bình thường
  assert.equal(owner.write('template.isoSeed', { keys: KEYS }).errors[0].code, 'ISO_ALL_EXIST');
  assert.ok(owner.call('template.isoList', { set: 'DAILY' }).data.templates.every((t) => t.exists));
  ok(owner.write('template.isoSeed', { keys: ['BM-CĐ-07-02', 'HN-01'] }));
  assert.equal(env.rows('Templates').length, 8);
});

test('bỏ hạng mục "nếu có" theo từng máy: chỉ mục không bắt buộc; không hiện, không tính thiếu; tiêu chuẩn riêng sửa số đề xuất', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  ok(owner.pin(OWNER_PIN));
  ok(owner.write('template.isoSeed', { keys: ['HN-06'] }));
  const tid = env.g.isoUuid_('HN-06');
  const items = itemsOf(env, 'HN-06');
  const key = (n) => byName(items, n).item_key;
  const mac = env.rows('Machines').find((m) => m.active);
  const aid = uuid();
  // Mục bắt buộc không bỏ được
  let r = owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: tid, overrides: { [key('Không báo lỗi')]: { off: true } } });
  assert.equal(r.code, 'VALIDATION_ERROR');
  assert.equal(r.errors[0].code, 'OFF_REQUIRED');
  // Chiller giải nhiệt gió: bỏ hai mục nước giải nhiệt; dòng máy nén theo % tải ≤ 95
  const ov = {
    [key('Nhiệt độ nước giải nhiệt vào (nếu có)')]: { off: true },
    [key('Nhiệt độ nước giải nhiệt ra (nếu có)')]: { off: true },
    [key('Dòng điện máy nén')]: { unit: '%', std_type: 'MAX', std_max: 95 },
    [key('Nhiệt độ nước lạnh ra')]: { std_type: 'RANGE', std_min: 6, std_max: 8 }
  };
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: tid, overrides: ov }));
  const asg = env.rows('Assignments').find((a) => a.assignment_id === aid);
  assert.deepEqual(asg.overrides_json[key('Nhiệt độ nước giải nhiệt vào (nếu có)')], { off: true });
  // App và máy chủ cùng cách hiểu off
  for (const ti of items) {
    const s = env.g.effItem_(ti, asg.overrides_json), c = J.effItem(ti, asg.overrides_json);
    assert.equal(!!c.off, !!s.off, ti.name_vi);
    assert.equal(J.stdText(c, 'vi'), env.g.stdText_(s, 'vi'), ti.name_vi);
  }
  // Mẫu sau này đổi mục sang bắt buộc → off không còn tác dụng
  assert.equal(env.g.effItem_({ ...byName(items, 'Nhiệt độ nước giải nhiệt vào (nếu có)'), required: true }, asg.overrides_json).off, undefined);

  const kt = userClient(env, 'KT1', 2, '583920');
  const fill = {
    'Nhiệt độ nước lạnh vào': { value: 12 }, 'Nhiệt độ nước lạnh ra': { value: 7 }, 'Áp suất hút môi chất': { value: 3.2 },
    'Áp suất đẩy môi chất': { value: 11 }, 'Dòng điện máy nén': { value: 97, note: 'Tải cao' }, 'Mức dầu máy nén': { choice: 'LOW' },
    'Không báo lỗi': { pass: true }, 'Không ồn, rung bất thường': { pass: true }, 'Không rò rỉ nước, dầu, gas': { pass: true },
    'Dàn ngưng sạch, quạt chạy đủ (nếu có)': { pass: true }
  };
  const results = Object.entries(fill).map(([n, x]) => ({ item_key: key(n), ...x }));
  r = ok(kt.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-11-05', results }));
  const run = r.data.run;
  assert.equal(run.total_count, 10, '12 hạng mục − 2 mục máy không có');
  assert.equal(run.filled_count, 10);
  assert.equal(run.status, 'DONE', 'đủ hết hạng mục của máy này');
  assert.equal(run.period_key, '2026-11-05');
  assert.ok(!run.results_json.some((x) => /giải nhiệt/.test(x.name_vi)), 'không lưu mục máy không có');
  const cur = run.results_json.find((x) => x.name_vi === 'Dòng điện máy nén');
  assert.deepEqual([cur.result, cur.std_vi], ['FAIL', '≤ 95 %'], 'số đề xuất đặt riêng cho máy');
  assert.equal(run.results_json.find((x) => x.name_vi === 'Mức dầu máy nén').result, 'WARN');
  assert.equal(run.results_json.find((x) => x.name_vi === 'Nhiệt độ nước lạnh ra').std_vi, '6 – 8 °C');
  assert.equal(run.fail_count, 1);
  assert.equal(run.warn_count, 1);
  // PDF bảng tháng không có dòng mục máy không có; có tiêu chuẩn riêng
  ok(owner.call('report.pdf', { machine_id: mac.machine_id, ym: '2026-11', template_id: tid }));
  const doc = [...env.drive._docs.values()].pop();
  assert.doesNotMatch(doc.text(), /nước giải nhiệt/);
  assert.match(doc.text(), /≤ 95 %/);
  assert.match(doc.text(), /Dàn ngưng sạch/);
});

test('lượt kiểm cũ có giá trị ở mục đã bỏ: vẫn giữ giá trị (không mất số liệu)', () => {
  const env = freshServer({ now: NOW });
  const owner = ownerClient(env);
  env.g.dbReset_();
  env.g.seedSample_('SYSTEM');
  ok(owner.pin(OWNER_PIN));
  ok(owner.write('template.isoSeed', { keys: ['HN-07'] }));
  const tid = env.g.isoUuid_('HN-07');
  const items = itemsOf(env, 'HN-07');
  const vfd = byName(items, 'Biến tần không báo lỗi (nếu có)').item_key;
  const mac = env.rows('Machines').find((m) => m.active);
  const aid = uuid();
  ok(owner.write('assignment.edit', { assignment_id: aid, machine_id: mac.machine_id, template_id: tid }));
  const runId = uuid();
  let r = ok(owner.write('check.submit', { run_id: runId, assignment_id: aid, template_revision: 1, work_date: '2026-11-05', results: [{ item_key: vfd, pass: true }] }));
  assert.equal(r.data.run.total_count, 9);
  // Bỏ mục biến tần ở máy này rồi sửa lượt cũ, app vẫn gửi giá trị biến tần → giữ
  const a = env.rows('Assignments').find((x) => x.assignment_id === aid);
  ok(owner.write('assignment.edit', { assignment_id: aid, overrides: { [vfd]: { off: true } } }, { expected_version: a.record_version }));
  r = ok(owner.write('check.submit', { run_id: runId, results: [{ item_key: vfd, pass: true }, { item_key: items[0].item_key, pass: true }] }, { expected_version: 1 }));
  assert.equal(r.data.run.total_count, 9);
  assert.ok(r.data.run.results_json.some((x) => x.item_key === vfd && x.result === 'OK'));
  // Lượt mới không gửi mục biến tần → không tính
  r = ok(owner.write('check.submit', { run_id: uuid(), assignment_id: aid, template_revision: 1, work_date: '2026-11-04', results: [{ item_key: items[0].item_key, pass: true }] }));
  assert.equal(r.data.run.total_count, 8);
  // Gỡ off (gửi overrides rỗng) → hạng mục trở lại
  const a2 = env.rows('Assignments').find((x) => x.assignment_id === aid);
  ok(owner.write('assignment.edit', { assignment_id: aid, overrides: {} }, { expected_version: a2.record_version }));
  assert.equal(env.rows('Assignments').find((x) => x.assignment_id === aid).overrides_json, null);
  // offSkip: app = máy chủ
  const runs = env.rows('Runs');
  const e = J.effItem(byName(items, 'Biến tần không báo lỗi (nếu có)'), { [vfd]: { off: true } });
  assert.equal(J.offSkip(e, runs), env.g.offSkip_(env.g.effItem_(byName(items, 'Biến tần không báo lỗi (nếu có)'), { [vfd]: { off: true } }), runs));
  assert.equal(J.offSkip(e, runs), false, 'có lượt mang giá trị biến tần → vẫn hiện dòng');
  assert.equal(J.offSkip(e, runs.filter((x) => x.run_id !== runId)), true);
});
