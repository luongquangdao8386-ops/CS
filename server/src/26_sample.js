/* 26_sample: dữ liệu mẫu cho máy chủ THỬ (khu vực, thiết bị, 3 mẫu checksheet, gán máy, tài khoản MAU-*) để thử app
 * khi chưa nối M&E. Nối M&E rồi thì thiết bị mẫu tự ngừng ở lần lấy danh sách tiếp theo (không có trong M&E). */

var SAMPLE_AREAS_ = [['KV-A', 'Xưởng A', 'A车间'], ['KV-B', 'Xưởng B', 'B车间'], ['KV-D', 'Phòng điện', '配电室']];
var SAMPLE_MACHINES_ = [
  ['TB-0007', 'Máy nén khí 01', '空压机01', 0, 'Máy nén khí', '空压机'],
  ['TB-0008', 'Máy nén khí 02', '空压机02', 0, 'Máy nén khí', '空压机'],
  ['TB-0012', 'Máy sấy khí', '冷干机', 0, 'Máy sấy khí', '冷干机'],
  ['TB-0031', 'Chiller 01', '冷水机01', 1, 'Chiller', '冷水机'],
  ['TB-0102', 'Tủ điện tổng MSB', '总配电柜', 2, 'Tủ điện', '配电柜']
];
/** [tên Việt, tên Trung, tần suất, ca, số thứ tự hạng mục trong thư viện, máy (chỉ số trong SAMPLE_MACHINES_)] */
var SAMPLE_TEMPLATES_ = [
  ['Máy nén khí – hằng ca', '空压机 – 每班点检', 'SHIFT', '1,2,3', [1, 2, 9, 12, 16, 15, 20, 24, 30, 31], [0, 1]],
  ['Chiller – hằng ngày', '冷水机 – 每日点检', 'DAY', '', [5, 6, 13, 14, 16, 30], [2, 3]],
  ['Tủ điện – hằng tuần', '配电柜 – 每周点检', 'WEEK', '', [7, 15, 18, 33, 31], [4]]
];

function seedSample_(byUserId) {
  if (!isTestEnv_()) throw new Error('Chỉ chạy ở máy chủ THỬ (ENV=THU).');
  var nowIso = isoVN_(now_());
  var areas = readRows_('Areas');
  if (areas.some(function (a) { return a.source === 'SAMPLE'; })) return { already: true };
  var lib = {};
  readRows_('LibraryItems').forEach(function (r) { lib[r.item_id] = r; });
  var writes = [];
  var areaIds = SAMPLE_AREAS_.map(function (a) {
    var id = uuid_();
    writes.push({ sheet: 'Areas', mode: 'insert', row: cNewSystem_({ area_id: id, area_code: a[0], name_vi: a[1], name_zh: a[2], parent_area_id: '', active: true, source: 'SAMPLE', synced_at: nowIso }) });
    return id;
  });
  var macIds = SAMPLE_MACHINES_.map(function (m) {
    var id = uuid_();
    writes.push({ sheet: 'Machines', mode: 'insert', row: cNewSystem_({ machine_id: id, machine_code: m[0], name_vi: m[1], name_zh: m[2], area_id: areaIds[m[3]], me_status: 'RUNNING', category_vi: m[4], category_zh: m[5], model: '', qr_key: newQrKey_(), active: true, source: 'SAMPLE', synced_at: nowIso }) });
    return id;
  });
  var tplCodes = [];
  withWriteLock_(function () {
    var st = readState_(), su = {};
    SAMPLE_TEMPLATES_.forEach(function () { tplCodes.push(allocCode_(st, su, 'TEMPLATE')); });
    stateWrite_(st, su, SYSTEM_USER);
  });
  SAMPLE_TEMPLATES_.forEach(function (t, ti) {
    var tid = uuid_();
    writes.push({ sheet: 'Templates', mode: 'insert', row: cNewSystem_({ template_id: tid, template_code: tplCodes[ti], name_vi: t[0], name_zh: t[1], frequency: t[2], shifts: t[3], revision: 1, active: true, note_vi: '', note_zh: '', i18n_meta: { name: { src: 'vi', state: 'HUMAN', at: nowIso } } }) });
    t[4].forEach(function (n, i) {
      var li = lib['LIB-' + ('00' + n).slice(-3)];
      if (!li) return;
      var row = { template_item_id: uuid_(), template_id: tid, revision: 1, item_key: uuid_(), step_no: i + 1, required: true, photo_on_fail: false, library_item_id: li.item_id, i18n_meta: li.i18n_meta };
      STD_COLS_.split(' ').forEach(function (f) { row[f] = li[f]; });
      writes.push({ sheet: 'TemplateItems', mode: 'insert', row: cNewSystem_(row) });
    });
    t[5].forEach(function (mi) {
      writes.push({ sheet: 'Assignments', mode: 'insert', row: cNewSystem_({ assignment_id: uuid_(), machine_id: macIds[mi], template_id: tid, active: true, overrides_json: null, start_date: todayVN_(), note: '' }) });
    });
  });
  systemWrite_(writes, { action: 'sample.seed', entity_type: 'SYSTEM', after_json: { machines: macIds.length, templates: SAMPLE_TEMPLATES_.length, by: byUserId || SYSTEM_USER } });
  // Tài khoản mẫu: PIN tạm 72 giờ, đăng nhập lần đầu phải đổi PIN
  var users = [['MAU-KT', 'Người kiểm MẪU', 2], ['MAU-C3', 'Trưởng bộ phận MẪU', 3], ['MAU-C1', 'Tra cứu MẪU', 1]];
  var pins = {};
  withWriteLock_(function () {
    var have = {};
    readRows_('Users').forEach(function (u) { have[u.employee_code] = true; });
    var add = [];
    users.forEach(function (u) {
      if (have[u[0]]) return;
      var pin = randomPin_(u[0]);
      var rec = newPinRecord_(pin);
      pins[u[0]] = pin;
      add.push({
        user_id: uuid_(), employee_code: u[0], display_name: u[1], email: '', role_level: u[2], active: true, pin_hash: rec.pin_hash, salt: rec.salt,
        pin_hash_version: rec.pin_hash_version, failed_attempts: 0, locked_until: '', created_at: nowIso, updated_at: nowIso, auth_version: 1,
        is_system_owner: false, must_change_pin: true, temp_pin_expires_at: isoVN_(new Date(now_().getTime() + setting_('temp_pin_hours') * 3600000)),
        pin_changed_at: '', failed_window_started_at: '', last_login_at: '', record_version: 1, created_by: SYSTEM_USER, updated_by: SYSTEM_USER, area_ids: ''
      });
    });
    if (add.length) {
      insertRows_('Users', add);
      var st = readState_();
      var rev = Number(stateGet_(st, 'sync_revision', 0)) + 1;
      stateWrite_(st, { sync_revision: ['INT', rev], 'table_rev.Users': ['INT', rev] }, SYSTEM_USER);
    }
  });
  cache_().remove('users:dir');
  DB_.userDir = null;
  return { machines: macIds.length, templates: SAMPLE_TEMPLATES_.length, temp_pins: pins };
}

/** Chạy từ trình soạn ở máy chủ THỬ: in PIN tạm của tài khoản mẫu vào nhật ký thực thi */
function adminSeedSample() {
  dbReset_();
  var out = seedSample_(SYSTEM_USER);
  if (out.already) { log_('Đã có dữ liệu mẫu — không tạo thêm.'); return; }
  log_('Đã tạo dữ liệu mẫu: ' + out.machines + ' thiết bị, ' + out.templates + ' mẫu checksheet. PIN tạm (đổi khi đăng nhập lần đầu): ' +
    Object.keys(out.temp_pins).map(function (k) { return k + ' = ' + out.temp_pins[k]; }).join(', '));
}

/** sample.seed (owner, PIN, chỉ THỬ): như adminSeedSample, PIN tạm trả một lần trong phản hồi */
function sampleSeedAction_(ctx) {
  if (!isTestEnv_()) throw apiError_('FEATURE_NOT_ENABLED');
  return seedSample_(ctx.user.user_id);
}
