/* 28_daily: bộ mẫu checksheet HẰNG NGÀY cho 7 loại máy (người dùng yêu cầu 05/11/2026), làm cùng cách bộ mẫu ISO (27_iso):
 * mỗi mẫu có khóa cố định HN-xx → template_id = isoUuid_(khóa), Trưởng bộ phận/Quản trị chọn để tạo (template.isoList {set:'DAILY'},
 * template.isoSeed), không tạo trùng. Tần suất DAY (sửa sang theo ca ở màn Sửa mẫu khi cần).
 * Quy ước của người dùng: "theo nhà sản xuất / cài đặt / thiết kế / định mức" = tiêu chuẩn Không đặt (NONE) kèm chữ — đặt số ở mẫu
 * hoặc ở Tiêu chuẩn riêng của từng máy; hạng mục "(nếu có)" không bắt buộc, máy không có thì bỏ ở Tiêu chuẩn riêng (overrides off).
 * [Mức] = chọn Đủ (Đạt) / Thấp (Cần chú ý) / Dưới min (Không đạt). Không đặt mã biểu mẫu (không phải biểu ISO; sửa được ở mẫu). */

/** Chữ tiêu chuẩn cho hạng mục số không đặt giới hạn: [Việt, 中文] */
var DAILY_MFR_ = ['Theo nhà sản xuất', '按厂家要求'];
var DAILY_SET_ = ['Theo cài đặt', '按设定值'];
var DAILY_DESIGN_ = ['Theo thiết kế', '按设计值'];
var DAILY_RATED_ = ['≤ định mức', '≤额定值'];
var DAILY_LOG_ = ['Chỉ ghi', '仅记录'];

/** Lựa chọn của hạng mục [Mức] */
var DAILY_LEVEL_CHOICES_ = [
  { code: 'OK', vi: 'Đủ', zh: '充足', result: 'OK' },
  { code: 'LOW', vi: 'Thấp', zh: '偏低', result: 'WARN' },
  { code: 'BELOW_MIN', vi: 'Dưới min', zh: '低于下限', result: 'FAIL' }
];

/** [Mức]: Đủ / Thấp (cảnh báo) / Dưới min (không đạt) */
function dailyLevel_(vi, zh) {
  return { group_key: 'LEVEL', name_vi: vi, name_zh: zh, input_type: 'CHOICE', std_type: 'NONE', required: true,
    choices_json: DAILY_LEVEL_CHOICES_.map(function (c) { return Object.assign({}, c); }) };
}

/** [Số] không đặt giới hạn (NONE) với chữ tiêu chuẩn txt; o: {req, type, imb} như isoNum_ */
function dailyFree_(group, vi, zh, unit, txt, o) {
  return isoNum_(group, vi, zh, unit, 'NONE', null, null, Object.assign({ stdVi: txt[0], stdZh: txt[1] }, o || {}));
}

/** [Số] định mức ± % (TOL) */
function dailyTol_(group, vi, zh, unit, nominal, tolPct, o) {
  var it = isoNum_(group, vi, zh, unit, 'TOL', null, null, o);
  it.std_nominal = nominal;
  it.std_tol_pct = tolPct;
  return it;
}

var DAILY_OPT_ = { req: false };

/** Bộ mẫu hằng ngày. key cố định (duy nhất, không trùng khóa ISO), frequency DAY */
var DAILY_TEMPLATES_ = [
  { key: 'HN-01', form_code: '', frequency: 'DAY',
    name_vi: 'Máy phát điện – kiểm tra hằng ngày (máy đứng chờ)', name_zh: '发电机–每日点检（待机状态）',
    note_vi: 'Kiểm lúc máy đứng chờ, không chạy máy. Chạy thử tuần/tháng dùng mẫu ISO BM-CĐ-07-06. Điện áp ắc quy: đặt theo nhà sản xuất ở Tiêu chuẩn riêng của máy.',
    note_zh: '在待机状态下检查，不启动发电机。每周/每月试机使用ISO模板BM-CĐ-07-06。蓄电池电压：在设备专用标准中按厂家要求设定。',
    items: [
      isoPf_('Bộ điều khiển ở AUTO, không báo lỗi', '控制器处于AUTO，无报警'),
      isoPf_('ATS ở chế độ tự động', 'ATS处于自动模式'),
      dailyLevel_('Mức dầu nhớt', '机油油位'),
      dailyLevel_('Mức nước làm mát', '冷却液液位'),
      isoNum_('LEVEL', 'Mức nhiên liệu bồn ngày', '日用油箱燃油液位', '%', 'MIN', 50),
      dailyFree_('ELEC', 'Điện áp ắc quy', '蓄电池电压', 'V', DAILY_MFR_),
      isoPf_('Bộ sạc ắc quy hoạt động', '蓄电池充电器工作正常'),
      isoPf_('Bộ sấy nước làm mát hoạt động', '冷却液加热器工作正常'),
      isoPf_('Không rò rỉ dầu, nhớt, nước', '无燃油、机油、水泄漏'),
      isoPf_('Cửa gió thông thoáng, phòng máy sạch', '进出风口通畅，机房清洁'),
      dailyFree_('OTHER', 'Số giờ chạy tích lũy', '累计运行小时', 'h', DAILY_LOG_)
    ] },
  { key: 'HN-02', form_code: '', frequency: 'DAY',
    name_vi: 'Phòng điện – kiểm tra hằng ngày', name_zh: '配电室–每日点检',
    note_vi: 'Gán cho từng phòng điện (khai mỗi phòng là một thiết bị trong M&E). Lưới 400 V thì sửa điện áp định mức. Dòng điện tổng: đặt ≤ định mức tủ ở Tiêu chuẩn riêng của máy.',
    note_zh: '分配给每个配电室（在M&E中每个配电室登记为一台设备）。400V电网请修改额定电压。总电流：在设备专用标准中设定≤配电柜额定值。',
    items: [
      isoNum_('TEMP', 'Nhiệt độ phòng', '室内温度', '°C', 'MAX', null, 35),
      dailyTol_('ELEC', 'Điện áp thanh cái tổng', '总母线电压', 'V', 380, 5, { type: 'THREE_PHASE', imb: 10 }),
      dailyFree_('ELEC', 'Dòng điện tổng', '总电流', 'A', ['Theo định mức tủ', '按配电柜额定值'], { type: 'THREE_PHASE', imb: 10 }),
      isoNum_('ELEC', 'Hệ số công suất cos φ', '功率因数cos φ', '', 'MIN', 0.9),
      isoPf_('Đồng hồ, đèn báo trên tủ bình thường', '柜面仪表、指示灯正常'),
      isoPf_('Tụ bù hoạt động bình thường', '电容补偿装置运行正常'),
      isoPf_('Không mùi khét, tiếng kêu lạ, phóng điện', '无焦味、异响、放电'),
      isoPf_('Quạt thông gió / điều hòa phòng hoạt động', '通风风扇/空调运行正常'),
      isoPf_('Phòng khô, không dột, không để đồ', '室内干燥、无漏水、无堆放杂物'),
      isoPf_('Cửa tủ đóng; biển báo, dụng cụ an toàn đủ', '柜门关闭；警示牌、安全工器具齐全')
    ] },
  { key: 'HN-03', form_code: '', frequency: 'DAY',
    name_vi: 'Máy nén khí – kiểm tra hằng ngày', name_zh: '空压机–每日点检',
    note_vi: 'Gán cho từng máy nén. Áp suất khí ra, nhiệt độ đầu nén: đặt theo cài đặt / nhà sản xuất ở Tiêu chuẩn riêng của máy. Máy sấy dùng mẫu máy sấy riêng.',
    note_zh: '分配给每台空压机。排气压力、机头温度：在设备专用标准中按设定值/厂家要求设定。干燥机使用单独的干燥机模板。',
    items: [
      dailyFree_('PRESS', 'Áp suất khí ra', '排气压力', 'bar', DAILY_SET_),
      dailyFree_('TEMP', 'Nhiệt độ khí ra đầu nén', '机头排气温度', '°C', DAILY_MFR_),
      dailyLevel_('Mức dầu', '油位'),
      isoPf_('Không báo lỗi, không báo thay lọc', '无故障报警、无更换滤芯提示'),
      isoPf_('Van xả nước ngưng hoạt động', '冷凝水排水阀工作正常'),
      isoPf_('Không rò rỉ dầu, khí', '无漏油、漏气'),
      isoPf_('Không ồn, rung bất thường', '无异常噪声、振动'),
      isoPf_('Két làm mát, lọc gió sạch', '冷却器、空气滤清器清洁'),
      isoNum_('TEMP', 'Nhiệt độ phòng máy', '机房温度', '°C', 'MAX', null, 40),
      dailyFree_('OTHER', 'Số giờ chạy', '运行小时', 'h', DAILY_LOG_)
    ] },
  { key: 'HN-04', form_code: '', frequency: 'DAY',
    name_vi: 'Máy sấy lạnh – kiểm tra hằng ngày', name_zh: '冷冻式干燥机–每日点检',
    note_vi: 'Gán cho từng máy sấy lạnh (khai trong M&E là thiết bị riêng).', note_zh: '分配给每台冷冻式干燥机（在M&E中单独登记）。',
    items: [
      isoNum_('TEMP', 'Điểm sương áp suất', '压力露点', '°C', 'MAX', null, 10),
      isoPf_('Đồng hồ gas trong vùng xanh', '冷媒压力表在绿区'),
      isoPf_('Xả nước ngưng tự động hoạt động', '自动排水工作正常'),
      isoPf_('Dàn ngưng sạch, quạt chạy', '冷凝器清洁、风扇运转'),
      isoPf_('Không báo lỗi', '无故障报警'),
      isoPf_('Không rò rỉ khí, dầu', '无漏气、漏油')
    ] },
  { key: 'HN-05', form_code: '', frequency: 'DAY',
    name_vi: 'Máy sấy hấp thụ – kiểm tra hằng ngày', name_zh: '吸附式干燥机–每日点检',
    note_vi: 'Điểm sương ≤ −40 °C theo cấp máy (máy cấp −70 °C: sửa ở Tiêu chuẩn riêng của máy). Áp suất tháp làm việc: đặt theo nhà sản xuất.',
    note_zh: '露点≤−40℃，按设备等级（−70℃等级的设备：在设备专用标准中修改）。工作塔压力：按厂家要求设定。',
    items: [
      isoNum_('TEMP', 'Điểm sương áp suất', '压力露点', '°C', 'MAX', null, -40),
      dailyFree_('PRESS', 'Áp suất tháp làm việc', '工作塔压力', 'bar', DAILY_MFR_),
      isoPf_('Tháp tái sinh xả về gần 0 bar', '再生塔泄压至接近0 bar'),
      isoPf_('Chuyển tháp đúng chu kỳ', '切换塔按周期动作'),
      isoPf_('Chỉ thị độ ẩm ở màu khô', '湿度指示器显示干燥色'),
      isoPf_('Ống tiêu âm không ra bụi hạt hút ẩm', '消音器无吸附剂粉尘排出'),
      isoPf_('Lọc trước/sau không báo chênh áp, đã xả nước', '前置/后置过滤器无压差报警，已排水'),
      isoPf_('Không báo lỗi, không rò rỉ khí', '无故障报警、无漏气')
    ] },
  { key: 'HN-06', form_code: '', frequency: 'DAY',
    name_vi: 'Chiller – kiểm tra hằng ngày', name_zh: '冷水机组–每日点检',
    note_vi: 'Gán cho từng chiller. Chiller giải nhiệt gió: bỏ hai mục nước giải nhiệt; giải nhiệt nước: bỏ mục dàn ngưng (Tiêu chuẩn riêng của máy). Tháp giải nhiệt kiểm ở mẫu bơm.',
    note_zh: '分配给每台冷水机组。风冷机组：取消两项冷却水项目；水冷机组：取消冷凝器项目（设备专用标准）。冷却塔在水泵模板中检查。',
    items: [
      dailyFree_('TEMP', 'Nhiệt độ nước lạnh vào', '冷冻水进水温度', '°C', DAILY_SET_),
      dailyFree_('TEMP', 'Nhiệt độ nước lạnh ra', '冷冻水出水温度', '°C', DAILY_SET_),
      dailyFree_('TEMP', 'Nhiệt độ nước giải nhiệt vào (nếu có)', '冷却水进水温度（如有）', '°C', DAILY_DESIGN_, DAILY_OPT_),
      dailyFree_('TEMP', 'Nhiệt độ nước giải nhiệt ra (nếu có)', '冷却水出水温度（如有）', '°C', DAILY_DESIGN_, DAILY_OPT_),
      dailyFree_('PRESS', 'Áp suất hút môi chất', '冷媒吸气压力', 'bar', DAILY_MFR_),
      dailyFree_('PRESS', 'Áp suất đẩy môi chất', '冷媒排气压力', 'bar', DAILY_MFR_),
      dailyFree_('ELEC', 'Dòng điện máy nén', '压缩机电流', 'A', ['≤ định mức (A hoặc % tải)', '≤额定值（A或负载%）']),
      dailyLevel_('Mức dầu máy nén', '压缩机油位'),
      isoPf_('Không báo lỗi', '无故障报警'),
      isoPf_('Không ồn, rung bất thường', '无异常噪声、振动'),
      isoPf_('Không rò rỉ nước, dầu, gas', '无漏水、漏油、漏冷媒'),
      isoPf_('Dàn ngưng sạch, quạt chạy đủ (nếu có)', '冷凝器清洁、风扇全部运转（如有）', '', '', false)
    ] },
  { key: 'HN-07', form_code: '', frequency: 'DAY',
    name_vi: 'Hệ bơm chiller – kiểm tra hằng ngày (từng bơm)', name_zh: '冷水系统水泵–每日点检（每台泵）',
    note_vi: 'Gán cho từng bơm (khai mỗi bơm là một thiết bị trong M&E). Bơm không có biến tần / không cấp cho tháp: bỏ mục đó ở Tiêu chuẩn riêng của máy.',
    note_zh: '分配给每台水泵（在M&E中每台泵登记为一台设备）。无变频器/不供冷却塔的泵：在设备专用标准中取消该项目。',
    items: [
      isoPf_('Bơm chạy; bơm dự phòng ở AUTO', '水泵运行；备用泵处于AUTO'),
      dailyFree_('PRESS', 'Áp suất hút', '吸入压力', 'bar', DAILY_DESIGN_),
      dailyFree_('PRESS', 'Áp suất đẩy', '排出压力', 'bar', DAILY_DESIGN_),
      dailyFree_('ELEC', 'Dòng điện động cơ', '电机电流', 'A', DAILY_RATED_),
      isoPf_('Không rò rỉ phớt, mặt bích', '机封、法兰无泄漏'),
      isoPf_('Không ồn, rung, nóng ổ bi bất thường', '无异常噪声、振动、轴承发热'),
      isoPf_('Biến tần không báo lỗi (nếu có)', '变频器无故障报警（如有）', '', '', false),
      isoPf_('Áp suất / mức nước bình giãn nở đạt', '膨胀罐压力/水位正常'),
      isoPf_('Tháp giải nhiệt: mức nước bể, quạt, phao châm nước (nếu có)', '冷却塔：水池水位、风机、补水浮球阀（如有）', '', '', false)
    ] }
];
