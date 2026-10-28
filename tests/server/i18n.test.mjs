// Mọi khóa nhãn app dùng đều có trong i18n/labels.json (đủ Việt + Trung): khóa viết thẳng trong mã và các họ khóa ghép động
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const labels = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'labels.json'), 'utf8'));
const files = [];
for (const dir of ['js', 'js/pages']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.js') && f !== 'dict.js') files.push(path.join(ROOT, dir, f));
const actions = new Set([...fs.readFileSync(path.join(ROOT, 'server', 'src', '07_perm.js'), 'utf8').matchAll(/'([a-z]+\.[a-zA-Z.]+)\|/g)].map((m) => m[1]));
// Chuỗi có dấu chấm nhưng không phải nhãn (tên tệp trong gói xlsx, tiền tố ghép khóa)
const NOT_LABEL = new Set(['drawing_me1.xml', 'label.check', 'mac.only_', 'shift.name']);

test('khóa nhãn viết thẳng trong mã đều có trong từ điển', () => {
  const missing = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/'([a-z][a-z0-9_]*(?:\.[a-zA-Z0-9_]+)+)'/g)) {
      const k = m[1];
      if (/\.(js|mjs|svg|png|jpg|json|css|html|xlsx|webmanifest)$/.test(k) || actions.has(k) || NOT_LABEL.has(k)) continue;
      if (!labels[k]) missing.add(`${k} (${path.basename(f)})`);
    }
    for (const m of src.matchAll(/\b(?:bi|biText|badge)\(\s*'([a-z][a-z0-9_]*)'/g)) if (!labels[m[1]]) missing.add(`${m[1]} (${path.basename(f)})`);
  }
  assert.deepEqual([...missing], []);
});

test('họ khóa ghép động đủ thành viên', () => {
  const fam = {
    'state.': ['TODO', 'LOCAL', 'PARTIAL', 'FAIL', 'WARN', 'DONE', 'OFF_SHIFT', 'MISSED', 'REASON'],
    'state_short.': ['DONE', 'FAIL', 'WARN'],
    'res.': ['OK', 'WARN', 'FAIL', 'EMPTY', 'PASS', 'NOT_PASS'],
    'grp.': ['TEMP', 'PRESS', 'ELEC', 'MECH', 'LEVEL', 'QUALITY', 'VISUAL', 'OTHER'],
    'input_type.': ['NUMBER', 'THREE_PHASE', 'CHOICE', 'PASS_FAIL', 'TEXT'],
    'std_type.': ['RANGE', 'MAX', 'MIN', 'TOL', 'NONE'],
    'freq.': ['SHIFT', 'DAY', 'WEEK', 'MONTH'],
    'freq_each.': ['SHIFT', 'DAY', 'WEEK', 'MONTH'],
    'shift.name': ['1', '2', '3', '4'],
    'weekday.': ['1', '2', '3', '4', '5', '6', '7'],
    'wd_short.': ['1', '2', '3', '4', '5', '6', '7'],
    'level.': ['1', '2', '3', '4', 'owner'],
    'abn_status.': ['OPEN', 'RESOLVED', 'CANCELLED'],
    'op_state.': ['QUEUED', 'SENDING', 'COMMITTED', 'REJECTED', 'CONFLICT', 'UNKNOWN', 'BLOCKED'],
    'user_status.': ['ACTIVE', 'DISABLED', 'MUST_CHANGE_PIN'],
    'backup_status.': ['VERIFIED', 'INCONSISTENT', 'FAILED', 'RUNNING'],
    'mac.only_': ['assigned', 'unassigned', 'all', 'inactive'],
    'audit_grp.': ['check', 'abnormal', 'missed', 'day', 'template', 'library', 'assignment', 'machine', 'user', 'settings', 'me', 'report', 'backup'],
    'action.': ['check.submit', 'doc.upload']
  };
  // Dòng kiểm tra sức khỏe máy chủ (24_system.js add('khóa', …))
  fam['health.'] = [...fs.readFileSync(path.join(ROOT, 'server', 'src', '24_system.js'), 'utf8').matchAll(/\badd\('([a-z_0-9]+)'/g)].map((m) => m[1]);
  const missing = [];
  for (const [p, list] of Object.entries(fam)) for (const k of list) if (!labels[p + k]) missing.push(p + k);
  assert.deepEqual(missing, []);
});

test('mỗi nhãn đủ hai thứ tiếng', () => {
  const bad = Object.entries(labels).filter(([k, v]) => k !== '_comment' && (!Array.isArray(v) || !String(v[0] || '').trim() || !String(v[1] || '').trim())).map(([k]) => k);
  assert.deepEqual(bad, []);
});
