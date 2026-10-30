/* 27_iso: bộ mẫu checksheet soạn từ bộ biểu mẫu ISO cơ điện của công ty (BM-CĐ-xx, người dùng yêu cầu 30/10/2026).
 * Mỗi mẫu mang mã biểu mẫu (Templates.form_code) in trên PDF Bảng tháng. Hạng mục, tiêu chuẩn lấy đúng chữ trên biểu;
 * ô "……" của biểu (điền theo nhà sản xuất / tiêu chuẩn công ty) để tiêu chuẩn "Không đặt" — Trưởng bộ phận đặt ở mẫu
 * hoặc tiêu chuẩn riêng theo máy. Hạng mục chỉ có ở một số máy/khu (diesel, xe điện, lò hơi…) không bắt buộc.
 * template.isoSeed tạo các mẫu được chọn (chưa gán máy); mẫu đã tạo (kể cả đã ngừng) không tạo lại. */

var ISO_PF_ = 'PASS_FAIL';

/** Hạng mục Đạt/Không đạt: tên, tiêu chuẩn chấp nhận (chữ), bắt buộc */
function isoPf_(vi, zh, stdVi, stdZh, req) {
  return { group_key: 'VISUAL', name_vi: vi, name_zh: zh, input_type: ISO_PF_, std_type: 'NONE', std_text_vi: stdVi || '', std_text_zh: stdZh || '', required: req !== false };
}

/** Hạng mục số: nhóm, tên, đơn vị, kiểu tiêu chuẩn (RANGE/MAX/MIN/NONE), giới hạn; o: {req, stdVi, stdZh, type: THREE_PHASE, imb} */
function isoNum_(group, vi, zh, unit, std, min, max, o) {
  o = o || {};
  var it = { group_key: group, name_vi: vi, name_zh: zh, input_type: o.type || 'NUMBER', unit: unit || '', std_type: std || 'NONE',
    std_min: min === undefined ? null : min, std_max: max === undefined ? null : max, required: o.req !== false,
    std_text_vi: o.stdVi || (std === 'NONE' || !std ? 'Theo nhà sản xuất / tiêu chuẩn công ty' : ''),
    std_text_zh: o.stdZh || (std === 'NONE' || !std ? '按厂家/公司标准' : '') };
  if (o.type === 'THREE_PHASE') it.extra_json = { imb_max: o.imb || 10 };
  return it;
}

function isoText_(vi, zh, req) {
  return { group_key: 'OTHER', name_vi: vi, name_zh: zh, input_type: 'TEXT', std_type: 'NONE', required: req === true };
}

var ISO_OPT_ = { req: false };
var ISO_STD_MFR_ = ['Theo nhà sản xuất / tiêu chuẩn công ty', '按厂家/公司标准'];

/**
 * Bộ mẫu. key = mã sheet trên biểu (duy nhất), form_code = mã biểu mẫu in trên PDF, frequency SHIFT|DAY|WEEK|MONTH.
 */
var ISO_TEMPLATES_ = [
  { key: 'BM-CĐ-03-04', form_code: 'BM-CĐ-03-04', frequency: 'SHIFT',
    name_vi: 'Kiểm tra máy đầu ca của người vận hành', name_zh: '操作员班前设备点检',
    note_vi: 'Sản xuất thực hiện; mục 1–4 (an toàn) không đạt thì không chạy máy. Thêm hạng mục riêng của máy nếu cần.',
    note_zh: '由生产执行；第1–4项（安全）不合格不得开机。可按设备增加专用项目。',
    items: [
      isoPf_('Dừng khẩn', '急停', 'Nhấn thử – máy dừng ngay', '试按—设备立即停止'),
      isoPf_('Cửa che', '防护门', 'Mở cửa – máy không chạy', '开门—设备不能运行'),
      isoPf_('Rèm quang, cảm biến an toàn', '光幕、安全传感器', 'Che – máy dừng', '遮挡—停机'),
      isoPf_('Che chắn truyền động', '传动防护罩', 'Đủ, chắc', '齐全、牢固'),
      isoPf_('Khí nén', '气压', 'Kim đồng hồ ở vùng xanh', '压力表指针在绿区'),
      isoPf_('Dầu bôi trơn / thủy lực', '润滑油/液压油', 'Đủ mức', '油位正常'),
      isoPf_('Rò rỉ dầu, khí, nước', '漏油、漏气、漏水', 'Không có', '无'),
      isoPf_('Tiếng ồn, rung, mùi lạ', '噪音、振动、异味', 'Bình thường', '正常'),
      isoPf_('Đèn báo, màn hình', '指示灯、触摸屏', 'Không báo lỗi', '无报警'),
      isoPf_('Dây điện, ổ cắm', '电线、插座', 'Không dập, không hở', '无破损、无裸露'),
      isoPf_('Tủ điện', '电柜', 'Đóng cửa, không nóng', '门已关、无过热'),
      isoPf_('Vệ sinh', '清洁', 'Không bụi giấy, dầu đọng', '无纸尘、无积油'),
      isoPf_('Vật lạ trên máy, đường giấy', '设备及纸路异物', 'Không có', '无'),
      isoPf_('Dao (nếu có)', '刀片（如有）', 'Đủ, không mẻ', '齐全、无崩口', false),
      isoPf_('Băng tải, dây đai', '输送带、皮带', 'Không rách, lệch', '无撕裂、跑偏', false),
      isoPf_('Hút bụi, hút giấy vụn', '吸尘、废纸抽吸', 'Hoạt động', '运行正常', false)
    ] },
  { key: 'BM-CĐ-07-01', form_code: 'BM-CĐ-07-01', frequency: 'SHIFT',
    name_vi: 'Nhật ký vận hành trạm biến áp & tủ điện tổng (MSB)', name_zh: '变电站及总配电柜运行记录',
    note_vi: 'Không mở cửa tủ trung thế đang mang điện để ghi số liệu. Chỉ số công tơ cuối ngày chuyển vào sổ công tơ; sự cố điện lập báo cáo sự cố.',
    note_zh: '禁止为抄表打开带电的中压柜门。日末电表读数转入电表记录；电气故障填写故障报告。',
    items: [
      isoNum_('ELEC', 'Điện áp dây U12 / U23 / U31', '线电压U12/U23/U31', 'V', 'RANGE', 380, 420, { type: 'THREE_PHASE', imb: 3 }),
      isoNum_('ELEC', 'Dòng điện I1 / I2 / I3', '电流I1/I2/I3', 'A', 'NONE', null, null, { type: 'THREE_PHASE', imb: 10 }),
      isoNum_('ELEC', 'Công suất P', '有功功率P', 'kW', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('ELEC', 'Hệ số công suất cos φ', '功率因数cos φ', '', 'MIN', 0.9),
      isoNum_('ELEC', 'Tụ bù: số cấp đang đóng', '电容投入级数', 'cấp', 'NONE', null, null, { stdVi: 'n / N cấp', stdZh: 'n/N级' }),
      isoNum_('TEMP', 'Nhiệt độ MBA', '变压器温度', '°C', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ phòng trạm', '配电房温度', '°C', 'MAX', null, 40),
      isoNum_('OTHER', 'Công tơ cuối ca – bình thường', '班末电表–平段', 'kWh', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('OTHER', 'Công tơ cuối ca – cao điểm', '班末电表–峰段', 'kWh', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('OTHER', 'Công tơ cuối ca – thấp điểm', '班末电表–谷段', 'kWh', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('OTHER', 'Công tơ cuối ca – vô công', '班末电表–无功', 'kVArh', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoPf_('MBA', '变压器', 'Mức dầu trong vạch, hạt hút ẩm chưa đổi màu quá 2/3, không rò dầu, không tiếng kêu – mùi lạ (MBA khô: quạt, bộ điều khiển nhiệt hoạt động)',
        '油位在刻度内，吸湿剂变色未超过2/3，无渗油、无异响异味（干式变：风机、温控器正常）'),
      isoPf_('Tủ MSB', '总配电柜', 'ACB / MCCB tổng đúng trạng thái, đèn báo – đồng hồ bình thường, không mùi khét, không tiếng phóng điện', '总断路器状态正确，指示灯及仪表正常，无焦味、无放电声'),
      isoPf_('Tụ bù', '电容补偿柜', 'Bộ điều khiển hoạt động, tụ không phồng – nóng bất thường, quạt tủ chạy', '控制器正常，电容无鼓胀、无异常发热，柜内风扇运转'),
      isoPf_('Thanh cái, đầu cốt', '母排、端子', 'Không đổi màu, không nóng bất thường (quan sát qua kính / súng đo nhiệt)', '无变色、无异常发热（观察窗/测温枪）'),
      isoPf_('Phòng trạm', '配电房', 'Thông gió – điều hòa hoạt động, không dột – đọng nước, không côn trùng – chuột, cửa khóa', '通风/空调正常，无漏水积水，无虫鼠，门已上锁'),
      isoPf_('Dụng cụ an toàn điện & PCCC', '电气安全工器具及消防', 'Thảm, găng, ủng cách điện, sào thao tác, biển báo, bình CO₂ sẵn sàng', '绝缘垫、手套、绝缘靴、操作杆、警示牌、CO₂灭火器齐备')
    ] },
  { key: 'BM-CĐ-07-02', form_code: 'BM-CĐ-07-02', frequency: 'SHIFT',
    name_vi: 'Nhật ký vận hành máy nén khí & máy sấy khí', name_zh: '空压机及干燥机运行记录',
    note_vi: 'Gán cho từng máy nén. Hạng mục máy sấy không bắt buộc (máy nén không kèm máy sấy bỏ trống). Giờ chạy tích lũy dùng lên lịch bảo dưỡng ở M&E.',
    note_zh: '分配给每台空压机。干燥机项目非必填（无干燥机时留空）。累计运行小时用于在M&E安排保养。',
    items: [
      { group_key: 'OTHER', name_vi: 'Trạng thái máy', name_zh: '运行状态', input_type: 'CHOICE', std_type: 'NONE', required: true,
        choices_json: [{ code: 'LOAD', vi: '● Chạy có tải', zh: '● 加载运行', result: 'OK' }, { code: 'UNLOAD', vi: '○ Chạy không tải', zh: '○ 卸载运行', result: 'OK' },
          { code: 'STOP', vi: '✕ Dừng / dự phòng', zh: '✕ 停机/备用', result: 'OK' }] },
      isoNum_('PRESS', 'Áp suất xả', '排气压力', 'bar', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ xả / nhiệt độ dầu', '排气/油温度', '°C', 'RANGE', 70, 100),
      isoNum_('TEMP', 'Máy sấy: điểm sương áp suất (PDP)', '干燥机：压力露点（PDP）', '°C', 'MAX', null, 10, ISO_OPT_),
      isoNum_('PRESS', 'Máy sấy: chênh áp lọc ΔP', '干燥机：过滤器压差ΔP', 'bar', 'MAX', null, 0.35, ISO_OPT_),
      isoNum_('PRESS', 'Áp suất ống chính', '主管压力', 'bar', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ phòng máy', '机房温度', '°C', 'MAX', null, 40),
      isoNum_('OTHER', 'Giờ chạy tổng', '累计运行小时', 'h', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoNum_('OTHER', 'Giờ có tải', '累计加载小时', 'h', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoPf_('Xả nước ngưng', '排冷凝水', 'Đã xả bình chứa, lọc, máy sấy; van xả tự động hoạt động', '已排储气罐、过滤器、干燥机冷凝水；自动排水阀正常'),
      isoPf_('Mức dầu, rò rỉ', '油位、泄漏', 'Mức dầu trong vạch; không rò rỉ dầu – khí', '油位在刻度内；无漏油、漏气'),
      isoPf_('Tiếng ồn, rung, bộ điều khiển', '噪声、振动、控制器', 'Không ồn – rung bất thường; không báo lỗi', '无异常噪声、振动；控制器无报警'),
      isoPf_('Phòng máy', '机房', 'Thông gió – hút nhiệt hoạt động, lưới lọc cửa gió sạch', '通风排热正常，进风口滤网清洁'),
      isoPf_('Bình chứa khí', '储气罐', 'Van an toàn, áp kế bình thường, còn hạn kiểm định', '安全阀、压力表正常，在检验有效期内')
    ] },
  { key: 'BM-CĐ-07-03', form_code: 'BM-CĐ-07-03', frequency: 'MONTH',
    name_vi: 'Kiểm tra chất lượng khí nén tại điểm sử dụng', name_zh: '用气点压缩空气质量检查',
    note_vi: 'TT = thổi trực tiếp lên sản phẩm (cấp 2:2:1); GT = gián tiếp (cấp 2:4:2) theo ISO 8573-1. Không đạt: thay lõi lọc, kiểm tra máy sấy, báo QA. Sửa danh sách điểm cho đúng nhà máy.',
    note_zh: 'TT=直接吹向产品（2:2:1级）；GT=间接（2:4:2级），依据ISO 8573-1。不合格：更换滤芯、检查干燥机、通知品保。请按工厂实际修改用气点。',
    items: [
      ['Máy in offset – bộ cấp giấy (thổi tách tờ)', '胶印机–飞达（分纸吹气）', 1], ['Máy in offset – bộ ra giấy (thổi đỡ tờ)', '胶印机–收纸（吹气托纸）', 1],
      ['Máy phủ UV – thổi bụi bề mặt tờ in', 'UV上光机–印张表面吹尘', 1], ['Máy cán màng – thổi tách, làm sạch', '覆膜机–分纸、清洁吹气', 1],
      ['Máy bế – thổi phế liệu, tách sản phẩm', '模切机–吹废料、分离成品', 1], ['Máy dán hộp – thổi định vị hộp', '糊盒机–定位吹气', 1],
      ['Máy ép nhũ – thổi tách giấy', '烫金机–分纸吹气', 1], ['Súng thổi vệ sinh dùng chung', '公用清洁吹枪', 0],
      ['Xi lanh, van khí nén (không tiếp xúc sản phẩm)', '气缸、气阀（不接触产品）', 0], ['Sau máy sấy trung tâm (điểm đối chứng)', '中央干燥机出口（对照点）', 0]
    ].map(function (p) {
      return isoPf_(p[0], p[1], p[2] ? 'TT: điểm sương ≤ −40 °C, dầu ≤ 0,01 mg/m³; giấy trắng thổi 30 giây không vết nước, dầu; lọc tại điểm tốt'
        : 'GT: điểm sương ≤ +3 °C, dầu ≤ 0,1 mg/m³; giấy trắng không vết nước, dầu; lọc tại điểm tốt',
        p[2] ? 'TT：露点≤−40℃，含油≤0.01mg/m³；白纸吹30秒无水油痕；终端过滤器正常' : 'GT：露点≤+3℃，含油≤0.1mg/m³；白纸无水油痕；终端过滤器正常', false);
    }).concat([isoNum_('TEMP', 'Điểm sương sau máy sấy trung tâm', '中央干燥机出口露点', '°C', 'MAX', null, 3, ISO_OPT_)]) },
  { key: 'BM-CĐ-07-04', form_code: 'BM-CĐ-07-04', frequency: 'SHIFT',
    name_vi: 'Nhật ký vận hành chiller, tháp giải nhiệt & AHU', name_zh: '冷水机组、冷却塔及空调箱运行记录',
    note_vi: 'Gán cho từng chiller (phần tháp và AHU không bắt buộc nếu theo dõi riêng). Nhiệt độ – độ ẩm phòng so với giới hạn QA.',
    note_zh: '分配给每台冷水机组（冷却塔、空调箱部分单独记录时非必填）。室内温湿度对照品保限值。',
    items: [
      isoNum_('TEMP', 'Nước lạnh cấp', '冷冻水供水', '°C', 'RANGE', 6, 8),
      isoNum_('TEMP', 'Nước lạnh hồi', '冷冻水回水', '°C', 'RANGE', 10, 13),
      isoNum_('TEMP', 'Nước giải nhiệt vào', '冷却水进水', '°C', 'MAX', null, 32),
      isoNum_('TEMP', 'Nước giải nhiệt ra', '冷却水出水', '°C', 'MAX', null, 37),
      isoNum_('PRESS', 'Áp suất môi chất – ngưng tụ', '冷媒压力–冷凝', 'bar', 'NONE'),
      isoNum_('PRESS', 'Áp suất môi chất – bay hơi', '冷媒压力–蒸发', 'bar', 'NONE'),
      isoNum_('ELEC', 'Dòng điện chiller', '冷水机组电流', 'A', 'NONE'),
      isoPf_('Tháp: mực nước – phao', '冷却塔：水位–浮球阀', 'Đúng mức, phao hoạt động', '水位正常、浮球阀正常', false),
      isoNum_('QUALITY', 'Tháp: độ dẫn điện', '冷却塔：电导率', 'µS/cm', 'NONE', null, null, ISO_OPT_),
      isoNum_('QUALITY', 'Tháp: pH', '冷却塔：pH值', '', 'NONE', null, null, ISO_OPT_),
      isoPf_('Tháp: hóa chất', '冷却塔：药剂', 'Mức bồn đủ, bơm định lượng hoạt động', '药箱液位足、计量泵正常', false),
      isoPf_('Tháp: xả đáy', '冷却塔：排污', 'Đã xả', '已排污', false),
      isoPf_('Tháp: lưới lọc, rong rêu, cặn', '冷却塔：滤网、藻类、水垢', 'Sạch', '清洁', false),
      isoNum_('TEMP', 'AHU: nhiệt độ phòng', '空调箱：室内温度', '°C', 'NONE', null, null, ISO_OPT_),
      isoNum_('QUALITY', 'AHU: độ ẩm phòng', '空调箱：室内湿度', '%RH', 'NONE', null, null, ISO_OPT_),
      isoNum_('PRESS', 'AHU: chênh áp lọc', '空调箱：过滤器压差', 'Pa', 'NONE', null, null, ISO_OPT_),
      isoPf_('AHU: quạt – dây đai – xả nước ngưng', '空调箱：风机–皮带–冷凝水排放', 'Hoạt động tốt', '运行正常', false)
    ] },
  { key: 'BM-CĐ-07-06-KT', form_code: 'BM-CĐ-07-06', frequency: 'WEEK',
    name_vi: 'Máy phát dự phòng – chạy thử không tải (hằng tuần)', name_zh: '备用发电机–空载试机（每周）',
    note_vi: 'KT: chạy không tải hằng tuần. Thử có tải và chuyển nguồn ATS dùng mẫu hằng tháng.', note_zh: 'KT：每周空载试机。带载及ATS切换测试使用每月模板。',
    items: isoGenItems_(false) },
  { key: 'BM-CĐ-07-06-CT', form_code: 'BM-CĐ-07-06', frequency: 'MONTH',
    name_vi: 'Máy phát dự phòng – chạy có tải, thử ATS (hằng tháng)', name_zh: '备用发电机–带载试机及ATS测试（每月）',
    note_vi: 'CT: chạy có tải và thử chuyển nguồn ATS hằng tháng.', note_zh: 'CT：每月带载试机及ATS切换测试。',
    items: isoGenItems_(true) },
  { key: 'BM-CĐ-07-07a', form_code: 'BM-CĐ-07-07', frequency: 'SHIFT',
    name_vi: 'Nhật ký vận hành nồi hơi', name_zh: '锅炉运行记录',
    note_vi: 'Lò phải còn hạn kiểm định; người vận hành được huấn luyện. Mực nước, áp suất vượt giới hạn hoặc van an toàn, áp kế hư: dừng lò theo quy trình, báo ngay Tổ trưởng CĐ.',
    note_zh: '锅炉须在检验有效期内；司炉工须经培训。水位、压力超限或安全阀、压力表损坏：按规程停炉并立即报告机电组长。',
    items: [
      isoNum_('PRESS', 'Áp suất hơi', '蒸汽压力', 'bar', 'NONE'),
      isoPf_('Mực nước', '水位', 'Trong vạch Min – Max', '在Min–Max之间'),
      isoNum_('TEMP', 'Nhiệt độ nước cấp', '给水温度', '°C', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ khói', '排烟温度', '°C', 'NONE'),
      isoPf_('Ngọn lửa, buồng đốt', '火焰、炉膛', 'Ổn định, bình thường', '稳定、正常'),
      isoNum_('OTHER', 'Đồng hồ nước cấp', '给水表读数', 'm³', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoNum_('OTHER', 'Nhiên liệu tiêu thụ', '燃料消耗', '', 'NONE', null, null, { stdVi: 'L · m³ · kg', stdZh: 'L·m³·kg', req: false }),
      isoPf_('Ống thủy', '水位计', 'Đã thông rửa; 2 ống thủy cùng mức', '已冲洗；两只水位计液位一致'),
      isoPf_('Áp kế', '压力表', 'Kiểm tra bằng van 3 ngả; còn hạn kiểm định', '用三通阀校对；在检定有效期内'),
      isoNum_('OTHER', 'Xả đáy theo quy trình (số lần)', '按规程排污（次数）', 'lần', 'MIN', 1),
      isoPf_('Rơ le mức nước', '水位控制', 'Bơm tự động đóng – ngắt; báo động, ngắt lò khi mức thấp', '给水泵自动启停；低水位报警及联锁停炉'),
      isoPf_('Van an toàn', '安全阀', 'Không rò; thử nâng tay theo quy trình', '无泄漏；按规程手动提升试验'),
      isoPf_('Đường ống hơi – nước – nhiên liệu', '蒸汽、水、燃料管道', 'Không rò rỉ; bảo ôn nguyên vẹn', '无泄漏；保温完好'),
      isoPf_('Hóa chất xử lý nước lò', '锅炉水处理药剂', 'Mức bồn đủ, bơm định lượng hoạt động', '药箱液位足、计量泵正常'),
      isoNum_('QUALITY', 'Độ cứng nước cấp / TDS nước lò', '给水硬度/炉水TDS', 'mg/L', 'NONE')
    ] },
  { key: 'BM-CĐ-07-07b', form_code: 'BM-CĐ-07-07', frequency: 'SHIFT',
    name_vi: 'Nhật ký vận hành lò dầu tải nhiệt', name_zh: '导热油炉运行记录',
    note_vi: 'Nhiệt độ dầu ra không vượt nhiệt độ làm việc tối đa của loại dầu; dừng đầu đốt trước, chạy bơm tuần hoàn đến khi dầu nguội.',
    note_zh: '出油温度不得超过该导热油的最高使用温度；停炉时先停燃烧器，循环泵运行至油温降低。',
    items: [
      isoNum_('TEMP', 'Nhiệt độ dầu ra', '出油温度', '°C', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ dầu về', '回油温度', '°C', 'NONE'),
      isoNum_('PRESS', 'Áp suất dầu ra', '出油压力', 'bar', 'NONE'),
      isoNum_('PRESS', 'Áp suất dầu về', '回油压力', 'bar', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ khói', '排烟温度', '°C', 'NONE'),
      isoPf_('Mức dầu bình giãn nở', '膨胀槽油位', 'Trong vạch Min – Max', '在Min–Max之间'),
      isoNum_('TEMP', 'Nhiệt độ bình giãn nở', '膨胀槽温度', '°C', 'NONE'),
      isoNum_('OTHER', 'Nhiên liệu tiêu thụ', '燃料消耗', '', 'NONE', null, null, { stdVi: 'L · m³ · kg', stdZh: 'L·m³·kg', req: false }),
      isoPf_('Bơm dầu tuần hoàn (chính / dự phòng)', '循环油泵（主/备）', 'Không ồn, rung bất thường; không rò phớt', '无异常噪声、振动；机封无泄漏'),
      isoPf_('Đường ống, mặt bích, van dầu', '油管、法兰、阀门', 'Không rò rỉ; bảo ôn nguyên vẹn', '无泄漏；保温完好'),
      isoPf_('Bình giãn nở, bình xả dầu', '膨胀槽、储油槽', 'Mức dầu, van, ống thở bình thường', '油位、阀门、呼吸管正常'),
      isoPf_('Đầu đốt – buồng đốt', '燃烧器–炉膛', 'Ngọn lửa ổn định, khói thải bình thường', '火焰稳定，排烟正常'),
      isoPf_('Bảo vệ', '保护', 'Lưu lượng / chênh áp dầu, quá nhiệt, mức dầu thấp – đèn báo, liên động hoạt động', '油流量/压差、超温、低油位–指示及联锁正常'),
      isoPf_('Áp kế, nhiệt kế, van an toàn', '压力表、温度计、安全阀', 'Hoạt động, còn hạn kiểm định', '正常，在检定有效期内'),
      isoPf_('Khu lò', '炉区', 'Bình chữa cháy, cát đủ; không vật dễ cháy, không dầu rò xuống sàn', '灭火器、沙箱齐备；无易燃物，地面无漏油')
    ] },
  { key: 'BM-CĐ-07-10', form_code: 'BM-CĐ-07-10', frequency: 'DAY',
    name_vi: 'Nhật ký vận hành hệ thống cấp nước & xử lý nước cấp', name_zh: '供水及给水处理系统运行记录',
    note_vi: 'Ghi mỗi ngày vào giờ cố định. Hạng mục của hệ thống không có thì bỏ trống. Vượt giới hạn: hoàn nguyên, xả đáy hoặc chỉnh bơm hóa chất.',
    note_zh: '每日固定时间记录。无该系统的项目留空。超限：再生、排污或调整加药泵。',
    items: [
      isoNum_('OTHER', 'Đồng hồ nước cấp tổng', '总供水表读数', 'm³', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('OTHER', 'Lưu lượng tức thời Q', '瞬时流量Q', 'm³/h', 'NONE', null, null, ISO_OPT_),
      isoNum_('PRESS', 'Áp suất cấp P', '供水压力P', 'bar', 'NONE'),
      isoNum_('QUALITY', 'Độ cứng nước mềm cấp lò hơi', '锅炉软化水硬度', 'mg/L', 'NONE', null, null, ISO_OPT_),
      isoNum_('QUALITY', 'TDS nước RO cấp tạo ẩm', '加湿RO水TDS', 'mg/L', 'NONE', null, null, ISO_OPT_),
      isoNum_('QUALITY', 'Độ dẫn điện nước tháp giải nhiệt', '冷却塔水电导率', 'µS/cm', 'NONE', null, null, ISO_OPT_),
      isoNum_('OTHER', 'Hóa chất châm', '加药量', 'L', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoPf_('Rửa lọc', '反洗', 'Đã rửa theo chu kỳ', '按周期反洗', false),
      isoPf_('Hoàn nguyên bộ làm mềm', '软化器再生', 'Đã hoàn nguyên theo chu kỳ', '按周期再生', false),
      isoNum_('OTHER', 'Muối hoàn nguyên', '再生用盐', 'kg', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false })
    ] },
  { key: 'BM-CĐ-07-11', form_code: 'BM-CĐ-07-11', frequency: 'MONTH',
    name_vi: 'Kiểm tra hệ thống thông gió & hút bụi giấy', name_zh: '通风及纸尘收集系统检查',
    note_vi: 'Gán cho từng hệ thống / quạt. Lưu lượng, áp suất giảm > 20 % so với thiết kế / lần trước: kiểm tra tắc ống, túi lọc, dây đai. Không đạt: lập phiếu sửa chữa.',
    note_zh: '分配给每个系统/风机。风量、压力较设计/上次下降>20%：检查风管堵塞、滤袋、皮带。不合格：开具维修单。',
    items: [
      isoNum_('OTHER', 'Lưu lượng', '风量', 'm³/h', 'NONE', null, null, ISO_OPT_),
      isoNum_('PRESS', 'Áp suất quạt', '风机压力', 'Pa', 'NONE', null, null, ISO_OPT_),
      isoNum_('ELEC', 'Dòng điện quạt', '风机电流', 'A', 'NONE'),
      isoNum_('PRESS', 'Chênh áp túi lọc ΔP', '滤袋压差ΔP', 'Pa', 'NONE', null, null, ISO_OPT_),
      isoNum_('OTHER', 'Độ ồn', '噪声', 'dB(A)', 'NONE', null, null, ISO_OPT_),
      isoPf_('Đường ống, chụp hút, cửa hút', '风管、吸罩、吸口', 'Không thủng, móp, hở mối nối', '无破损、变形、接口泄漏'),
      isoPf_('Bụi giấy tích tụ trong ống, chụp hút, dầm – máng cáp quanh máy', '风管、吸罩及周边梁、桥架积尘', 'Đã vệ sinh, không còn lớp bụi dày (nguy cơ cháy)', '已清理，无厚积尘（火灾隐患）'),
      isoPf_('Túi lọc / lõi lọc, cơ cấu rũ bụi', '滤袋/滤芯、清灰装置', 'Không rách; rũ bụi hoạt động', '无破损；清灰正常', false),
      isoPf_('Thùng / bao chứa bụi, cyclone', '集尘桶/袋、旋风分离器', 'Không đầy quá mức; đổ đúng nơi quy định', '未过满；按规定处置', false),
      isoPf_('Quạt: dây đai, vòng bi, rung, bu lông chân đế', '风机：皮带、轴承、振动、地脚螺栓', 'Dây đai đủ căng, không mòn; vòng bi không kêu, không nóng', '皮带张紧无磨损；轴承无异响、无过热'),
      isoPf_('Nối đất chống tĩnh điện', '防静电接地', 'Dây nối liên tục, chắc chắn', '跨接线连续、牢固'),
      isoPf_('Van chặn lửa, van một chiều, cửa xả áp nổ', '防火阀、止回阀、泄爆口', 'Hoạt động, không kẹt, không bị che chắn', '动作正常、无卡阻、无遮挡', false),
      isoPf_('Liên động quạt – máy sản xuất; lưới bảo vệ cánh quạt', '风机与生产设备联锁；叶轮防护网', 'Liên động đúng; lưới bảo vệ đủ', '联锁正常；防护网齐全')
    ] },
  { key: 'BM-CĐ-08-12', form_code: 'BM-CĐ-08-12', frequency: 'WEEK',
    name_vi: 'Kiểm soát thông số vận hành SEU', name_zh: 'SEU运行参数控制',
    note_vi: 'Giá trị chuẩn đặt theo tiêu chuẩn công ty / danh mục SEU (BM-CĐ-08-04). Không đạt ảnh hưởng EnPI: lập phiếu điều tra sai lệch; cần sửa: lập phiếu sửa chữa.',
    note_zh: '标准值按公司标准/SEU清单（BM-CĐ-08-04）设定。不合格影响EnPI：填写偏差调查单；需维修：开具维修单。',
    items: [
      isoNum_('PRESS', 'Khí nén: áp suất đặt máy nén (cắt tải)', '空压机设定压力（卸载）', 'bar', 'NONE'),
      isoNum_('PRESS', 'Khí nén: áp suất điểm dùng xa nhất', '最远用气点压力', 'bar', 'NONE'),
      isoNum_('TEMP', 'Khí nén: điểm sương máy sấy', '干燥机压力露点', '°C', 'NONE'),
      isoNum_('OTHER', 'Khí nén: tỷ lệ chạy không tải', '空压机空载率', '%', 'NONE'),
      isoPf_('Khí nén: van xả nước ngưng tự động', '自动排水阀', 'Hoạt động đúng chu kỳ', '按周期动作'),
      isoPf_('Khí nén: khóa van khí khu vực không sản xuất', '非生产区域供气阀', 'Đã khóa', '已关闭'),
      isoNum_('TEMP', 'Chiller: nhiệt độ đặt nước lạnh cấp', '冷冻水供水设定温度', '°C', 'NONE', null, null, ISO_OPT_),
      isoNum_('TEMP', 'Chiller: ΔT nước lạnh cấp – hồi', '冷冻水供回水温差ΔT', '°C', 'NONE', null, null, ISO_OPT_),
      isoPf_('Nhiệt độ – độ ẩm xưởng in, kho giấy', '印刷车间、纸库温湿度', 'Trong giới hạn QA', '在品保限值内', false),
      isoNum_('TEMP', 'Nhiệt độ nước giải nhiệt vào bình ngưng', '冷却水进冷凝器温度', '°C', 'NONE', null, null, ISO_OPT_),
      isoPf_('Lịch bật / tắt AHU, điều hòa văn phòng', '空调箱、办公空调开关时间', 'Đúng lịch', '符合时间表', false),
      isoPf_('Cửa khu điều hòa đóng kín; rèm gió chạy', '空调区门关闭严密；风幕机运行', 'Đóng kín', '关闭严密', false),
      isoPf_('Lịch bật / tắt đèn xưởng, kho, sân', '车间、仓库、室外照明开关时间', 'Đúng lịch / cài đặt', '符合时间表/设定'),
      isoPf_('Tắt đèn khu không người, đủ sáng', '无人区及自然光充足区关灯', 'Không vi phạm', '无违规'),
      isoPf_('Máy in: tắt sấy IR/UV, bơm khi chờ', '印刷机：待机关闭IR/UV干燥及泵', 'Chờ quá thời gian quy định: tắt', '待机超过规定时间：关闭'),
      isoPf_('Bế, dán, cán màng, ép nhũ: tắt khi chờ', '模切、糊盒、覆膜、烫金：待机关闭', 'Theo quy định', '按规定'),
      isoPf_('Hút bụi, quạt hút chạy theo máy chính', '纸尘收集、排风机随主机运行', 'Liên động', '联锁'),
      isoPf_('Lò hơi / lò dầu: áp suất, nhiệt độ đặt', '锅炉/导热油炉设定压力、温度', 'Đúng giá trị chuẩn', '符合标准值', false),
      isoNum_('TEMP', 'Lò hơi / lò dầu: nhiệt độ khói thải', '锅炉/导热油炉排烟温度', '°C', 'NONE', null, null, ISO_OPT_),
      isoPf_('Bảo ôn ống, van; không rò hơi / dầu', '管道阀门保温；无蒸汽/油泄漏', 'Không rò', '无泄漏', false),
      isoNum_('ELEC', 'Hệ số công suất cos φ tại tủ tổng', '总配电柜功率因数cos φ', '', 'MIN', 0.9),
      isoPf_('Tụ bù đóng đủ cấp, không quá nhiệt', '电容补偿投切正常、无过热', 'Đủ cấp, không nóng', '投切正常、无过热')
    ] },
  { key: 'BM-CĐ-09-10', form_code: 'BM-CĐ-09-10', frequency: 'MONTH',
    name_vi: 'Kiểm tra dụng cụ điện cầm tay, dây nối, ổ cắm di động', name_zh: '手持电动工具、延长线、移动插座检查',
    note_vi: 'Gán cho từng dụng cụ hoặc nhóm dụng cụ (khai trong M&E). Không đạt: dán tem đỏ "Không sử dụng", thu hồi sửa hoặc loại bỏ; ghi mã dụng cụ lỗi ở ghi chú.',
    note_zh: '分配给每件工具或工具组（在M&E登记）。不合格：贴红色“禁止使用”标签，收回维修或报废；在备注中记录不合格工具编号。',
    items: [
      isoPf_('A. Vỏ', 'A. 外壳', 'Không nứt vỡ, đủ vít, không biến dạng, cháy xém', '无裂损、螺钉齐全、无变形、无烧焦'),
      isoPf_('B. Dây dẫn', 'B. 导线', 'Không hở lõi, không dập, không nối bằng băng dính; giữ cáp đầu vào chắc', '无露芯、无压伤、无胶布接头；进线电缆固定牢靠'),
      isoPf_('C. Phích cắm, ổ cắm', 'C. 插头、插座', 'Chân cắm không cong, không cháy; đúng loại; ổ cắm không lỏng, không nứt', '插脚无弯曲、无烧痕；规格匹配；插座无松动、无裂纹'),
      isoPf_('D. Tiếp địa / cách điện kép', 'D. 接地/双重绝缘', 'Dây tiếp địa liên tục (cấp I) hoặc có ký hiệu cách điện kép (cấp II)', '接地线连续（I类）或有双重绝缘标志（II类）'),
      isoNum_('ELEC', 'E. Điện trở cách điện (500 V DC)', 'E. 绝缘电阻（500V DC）', 'MΩ', 'NONE'),
      isoPf_('F. RCD (chống dòng rò)', 'F. 漏电保护器', 'Nhấn TEST – RCD cắt; dòng tác động ≤ 30 mA', '按TEST能跳闸；额定动作电流≤30mA', false),
      isoPf_('G. Công tắc, che chắn', 'G. 开关、防护罩', 'Bật – tắt tốt, không kẹt; đủ chắn bảo vệ; chổi than không đánh lửa mạnh', '开关通断正常、无卡滞；防护罩齐全；碳刷无强烈火花'),
      isoText_('Màu tem tháng này', '本月标签颜色')
    ] },
  { key: 'BM-CĐ-09-11', form_code: 'BM-CĐ-09-11', frequency: 'SHIFT',
    name_vi: 'Kiểm tra xe nâng / thiết bị nâng trước khi sử dụng', name_zh: '叉车/起重设备使用前检查',
    note_vi: 'Không đạt: không sử dụng, báo ngay Tổ trưởng CĐ. Mục 7 cho xe dầu / gas, mục 8 cho xe điện.',
    note_zh: '不合格：停止使用，立即报告机电组长。第7项适用于内燃叉车，第8项适用于电动叉车。',
    items: [
      isoPf_('Phanh chân, phanh tay', '脚刹、手刹', 'Ăn tốt, xe không trôi', '制动有效、无溜车'),
      isoPf_('Còi, đèn chiếu sáng, đèn cảnh báo, còi lùi', '喇叭、照明灯、警示灯、倒车蜂鸣器', 'Hoạt động', '正常'),
      isoPf_('Vô lăng, hệ thống lái', '方向盘/转向系统', 'Nhẹ, không rơ', '轻便、无松旷'),
      isoPf_('Xích nâng, puli, khung nâng', '起升链条、链轮、门架', 'Không nứt, không giãn; đủ dầu mỡ', '无裂纹、无拉长；润滑良好'),
      isoPf_('Càng nâng, chốt khóa càng', '货叉及定位销', 'Không nứt, không cong; đủ chốt', '无裂纹、无弯曲；销齐全'),
      isoPf_('Xi lanh, ống dầu, gầm xe', '油缸、油管、车底', 'Không rò rỉ dầu, nhiên liệu', '无漏油、漏燃料'),
      isoPf_('Dầu thủy lực, nhớt, nước làm mát (xe dầu / gas)', '液压油、机油、冷却液（内燃车）', 'Đủ mức', '液位正常', false),
      isoPf_('Ắc quy, bộ sạc, dây sạc (xe điện)', '蓄电池、充电器、充电线（电动车）', 'Đủ điện, không rò axit, không hở', '电量足、无漏酸、无破损', false),
      isoPf_('Lốp, bánh xe', '轮胎、车轮', 'Không mòn quá giới hạn, không nứt', '无超限磨损、无裂纹'),
      isoPf_('Dây an toàn, khung bảo vệ đầu, tấm chắn tải', '安全带、护顶架、挡货架', 'Nguyên vẹn', '完好'),
      isoPf_('Cần nâng – hạ – nghiêng', '起升/下降/倾斜操纵杆', 'Hoạt động êm, đúng chiều', '动作平顺、方向正确'),
      isoPf_('Gương, biển tải trọng, bình chữa cháy trên xe, tem kiểm định', '后视镜、载荷铭牌、车载灭火器、检验标签', 'Đủ; tem kiểm định còn hạn', '齐全；检验标签有效')
    ] },
  { key: 'BM-CĐ-09-12', form_code: 'BM-CĐ-09-12', frequency: 'MONTH',
    name_vi: 'Kiểm tra an toàn định kỳ khu vực kỹ thuật', name_zh: '技术区域定期安全检查',
    note_vi: 'Gán cho từng khu (trạm biến áp, phòng tủ điện, phòng máy nén, phòng bơm, phòng chiller, phòng máy phát, khu sạc xe nâng, mái). Mục không có ở khu thì bỏ trống.',
    note_zh: '分配给每个区域（变电站、配电室、空压机房、泵房、冷水机房、发电机房、叉车充电区、屋面）。区域内无此项目留空。',
    items: [
      isoPf_('Biển cảnh báo, sơ đồ hệ thống, nội quy', '警示标识、系统图、操作规程', 'Đủ, rõ, không bong', '齐全、清晰、无脱落'),
      isoPf_('Cửa, khóa', '门锁', 'Đóng, có khóa; chỉ người được giao giữ chìa', '关闭上锁；仅授权人员持钥匙'),
      isoPf_('Lối đi, lối thoát', '通道、出口', 'Thông thoáng, không để vật tư; đèn EXIT sáng', '畅通无堆物；出口指示灯正常'),
      isoPf_('Chiếu sáng thường và đèn sự cố', '正常照明及应急照明', 'Hoạt động tốt', '工作正常'),
      isoPf_('Che chắn dây đai, khớp nối, quạt, phần mang điện', '皮带、联轴器、风扇、带电部位防护', 'Đầy đủ', '齐全', false),
      isoPf_('Tủ điện', '电柜', 'Cửa đóng, không quá nhiệt, mùi khét; cáp không hở', '柜门关闭，无过热、焦味；电缆无裸露', false),
      isoPf_('Thảm cách điện, dây tiếp địa vỏ thiết bị', '绝缘垫、设备外壳接地线', 'Có thảm trước tủ; tiếp địa bắt chắc', '柜前铺绝缘垫；接地线紧固', false),
      isoPf_('Rò rỉ dầu, nước, khí nén, môi chất lạnh, axit', '漏油、漏水、漏气、冷媒及酸液', 'Không rò rỉ', '无泄漏'),
      isoPf_('Vệ sinh', '清洁', 'Sạch; không bụi giấy, giẻ dầu, vật liệu dễ cháy', '清洁；无纸尘、油抹布、易燃物'),
      isoPf_('Thông gió, quạt hút, điều hòa phòng', '通风、排风扇、空调', 'Hoạt động; nhiệt độ đạt', '运行正常；温度符合要求', false),
      isoPf_('Van an toàn, đồng hồ áp, bình chịu áp lực', '安全阀、压力表、压力容器', 'Còn hạn kiểm định', '在检验有效期内', false),
      isoPf_('Bình chữa cháy', '灭火器', 'Đủ, đúng chỗ, kim ở vùng xanh, có tem kiểm tra', '数量足、位置对、压力在绿区、有检查标签'),
      isoPf_('Dụng cụ an toàn điện', '电气安全工器具', 'Đủ, còn hạn thử nghiệm', '齐全、在试验有效期内', false),
      isoPf_('Hóa chất, ắc quy', '化学品、蓄电池', 'Có SDS, khay chống tràn, nơi rửa mắt', '有SDS、防泄漏托盘、洗眼器', false),
      isoPf_('Lan can, thang leo, điểm neo, lối đi trên mái', '护栏、爬梯、锚固点、屋面走道', 'Nguyên vẹn', '完好', false),
      isoPf_('Chuột, chim, côn trùng', '鼠、鸟、虫', 'Không có dấu hiệu; lỗ hở đã bịt kín', '无迹象；孔洞已封堵')
    ] },
  { key: 'BM-CĐ-10-02', form_code: 'BM-CĐ-10-02', frequency: 'MONTH',
    name_vi: 'Kiểm tra bình chữa cháy hằng tháng', name_zh: '灭火器每月检查',
    note_vi: 'Gán cho từng khu (mỗi khu một thiết bị nhóm "Bình chữa cháy khu …" trong M&E). Bình không đạt: ghi mã vị trí ở ghi chú, lập phiếu sửa chữa; bình đi nạp phải có bình thay thế tạm.',
    note_zh: '分配给每个区域（在M&E中每区登记一个“…区灭火器”设备组）。不合格灭火器：在备注中记录位置编号并开具维修单；送充装须放置临时替换灭火器。',
    items: [
      isoNum_('OTHER', 'Số bình đã kiểm tra', '已检查灭火器数', 'bình', 'NONE', null, null, { stdVi: 'Đủ số bình của khu', stdZh: '本区全部灭火器' }),
      isoNum_('OTHER', 'Số bình không đạt', '不合格灭火器数', 'bình', 'MAX', null, 0),
      isoPf_('1. Áp suất', '1. 压力', 'Kim ở vùng xanh; bình CO₂ cân kiểm tra khối lượng', '指针在绿区；CO₂灭火器称重检查'),
      isoPf_('2. Chốt an toàn, niêm phong', '2. 保险销、铅封', 'Còn nguyên', '完好'),
      isoPf_('3. Vòi, loa phun', '3. 喷管、喷筒', 'Không nứt, gãy, tắc; lắp chắc chắn', '无裂纹、断裂、堵塞；连接牢固'),
      isoPf_('4. Vỏ bình, nhãn', '4. 瓶体、标签', 'Không móp, gỉ, phồng; nhãn rõ; sạch bụi giấy', '无凹陷、锈蚀、鼓包；标签清晰；无纸尘'),
      isoPf_('5. Vị trí', '5. 位置', 'Đúng vị trí trên sơ đồ; có giá / móc treo, biển báo', '与布置图一致；有支架/挂钩及标志'),
      isoPf_('6. Lối tiếp cận', '6. 取用通道', 'Thông thoáng, không bị pallet, cuộn giấy che', '畅通，无托盘、纸卷遮挡'),
      isoPf_('7. Hạn nạp lại, bảo dưỡng, kiểm định', '7. 再充装、保养、检验期限', 'Còn hạn (theo nhãn, tem)', '在有效期内（按标签）')
    ] },
  { key: 'BM-CĐ-10-03', form_code: 'BM-CĐ-10-03', frequency: 'WEEK',
    name_vi: 'Chạy thử bơm chữa cháy & kiểm tra sprinkler, họng nước', name_zh: '消防泵试运行及喷淋、消火栓检查',
    note_vi: 'Hạng mục "(hằng tháng)" làm ở tuần đầu tháng; hạng mục bơm diesel chỉ khi có. Giá trị chuẩn theo thiết kế / nhà sản xuất.',
    note_zh: '“（每月）”项目在每月第一周执行；柴油泵项目仅在有柴油泵时填写。标准值按设计/厂家要求。',
    items: [
      isoPf_('Bơm điện: chế độ tủ điều khiển, đèn báo', '电动泵：控制柜模式、指示灯', 'AUTO, không báo lỗi', 'AUTO，无故障报警'),
      isoPf_('Bơm điện: khởi động thử', '电动泵：试启动', 'Khởi động ngay, chạy êm', '立即启动，运行平稳'),
      isoNum_('PRESS', 'Bơm điện: áp suất đầu đẩy khi chạy', '电动泵：运行出口压力', 'bar', 'NONE', null, null, { stdVi: '≥ theo thiết kế', stdZh: '≥设计值' }),
      isoNum_('ELEC', 'Bơm điện: dòng điện khi chạy (pha lớn nhất)', '电动泵：运行电流（最大相）', 'A', 'NONE', null, null, { stdVi: '≤ định mức', stdZh: '≤额定值' }),
      isoNum_('OTHER', 'Bơm điện: thời gian chạy thử', '电动泵：试运行时间', 'phút', 'NONE', null, null, { stdVi: '≥ quy định công ty', stdZh: '≥公司规定' }),
      isoPf_('Bơm điện: rung, ồn, nhiệt độ ổ bi, rò rỉ phớt', '电动泵：振动、噪音、轴承温度、机封泄漏', 'Bình thường, không rò rỉ', '正常，无泄漏'),
      isoNum_('LEVEL', 'Bơm diesel: mức nhiên liệu trong bồn', '柴油泵：油箱燃油液位', '%', 'NONE', null, null, ISO_OPT_),
      isoNum_('ELEC', 'Bơm diesel: điện áp ắc quy khởi động', '柴油泵：启动蓄电池电压', 'V', 'NONE', null, null, ISO_OPT_),
      isoPf_('Bơm diesel: dầu máy, nước làm mát, ống nhiên liệu', '柴油泵：机油、冷却液、燃油管', 'Đủ mức, không rò rỉ', '液位正常，无泄漏', false),
      isoNum_('PRESS', 'Bơm diesel: áp suất đầu đẩy khi khởi động thử', '柴油泵：试启动出口压力', 'bar', 'NONE', null, null, ISO_OPT_),
      isoNum_('OTHER', 'Bơm diesel: thời gian chạy thử', '柴油泵：试运行时间', 'phút', 'NONE', null, null, ISO_OPT_),
      isoPf_('Bơm diesel: nhiệt độ nước, áp suất dầu khi chạy', '柴油泵：运行水温、机油压力', 'Trong dải nhà sản xuất', '在厂家规定范围内', false),
      isoNum_('PRESS', 'Áp suất mạng ống khi chờ', '待机管网压力', 'bar', 'NONE', null, null, { stdVi: 'Trong dải cài đặt', stdZh: '在设定范围内' }),
      isoPf_('Bơm bù áp tự chạy / tự dừng', '稳压泵自动启停', 'Đúng áp suất cài đặt', '符合设定压力'),
      isoNum_('LEVEL', 'Mực nước bể chữa cháy', '消防水池水位', 'm', 'NONE', null, null, { stdVi: '≥ theo thiết kế', stdZh: '≥设计值' }),
      isoPf_('Van chặn chính, van khu vực', '总控制阀、区域控制阀', 'Mở hết, có niêm phong', '全开，有铅封/锁'),
      isoNum_('PRESS', 'Áp suất trước van báo động', '报警阀前压力', 'bar', 'NONE'),
      isoNum_('PRESS', 'Áp suất sau van báo động', '报警阀后压力', 'bar', 'NONE'),
      isoPf_('Van phao, đường cấp bù, nắp bể (hằng tháng)', '浮球阀、补水管、水池盖板（每月）', 'Hoạt động tốt, nắp kín', '工作正常，盖板严密', false),
      isoPf_('Thử van báo động: chuông, tín hiệu về tủ (hằng tháng)', '报警阀测试：警铃、信号至主机（每月）', 'Chuông kêu, tủ báo đúng', '警铃响，主机报警正确', false),
      isoPf_('Đầu phun sprinkler (hằng tháng)', '喷头（每月）', 'Không che chắn, bụi, sơn', '无遮挡、积尘、涂漆', false),
      isoPf_('Tủ họng nước: vòi, lăng, khớp nối (hằng tháng)', '消火栓箱：水带、水枪、接口（每月）', 'Đủ, vòi không mục, thủng', '齐全，水带无老化、破洞', false),
      isoPf_('Van họng, trụ ngoài nhà, họng tiếp nước (hằng tháng)', '消火栓阀、室外消火栓、水泵接合器（每月）', 'Kín, không bị che chắn', '无泄漏、无遮挡', false)
    ] },
  { key: 'BM-CĐ-10-04', form_code: 'BM-CĐ-10-04', frequency: 'MONTH',
    name_vi: 'Kiểm tra, bảo dưỡng hệ thống báo cháy & đèn sự cố – chỉ dẫn thoát nạn', name_zh: '火灾报警系统及应急照明、疏散指示检查保养',
    note_vi: 'Hạng mục "(quý)" chỉ làm ở kỳ kiểm tra quý (tháng 3, 6, 9, 12). Lỗi: ghi zone – địa chỉ – vị trí ở ghi chú, theo dõi khắc phục qua phiếu sửa chữa.',
    note_zh: '“（季度）”项目仅在季度检查时执行（3、6、9、12月）。故障：在备注中记录回路–地址–位置，通过维修单跟踪整改。',
    items: [
      isoPf_('Tủ trung tâm: nguồn chính, đèn báo, màn hình', '报警主机：主电源、指示灯、显示屏', 'Không lỗi, không zone bị cô lập', '无故障、无屏蔽回路'),
      isoPf_('Tủ trung tâm: ắc quy dự phòng (cắt nguồn chính để thử)', '报警主机：备用电池（断主电测试）', 'Tủ chạy bằng ắc quy bình thường', '电池供电下主机正常'),
      isoNum_('ELEC', 'Điện áp ắc quy dự phòng', '备用电池电压', 'V', 'NONE', null, null, ISO_OPT_),
      isoPf_('Nhật ký sự kiện, đồng hồ của tủ', '主机事件记录、时钟', 'Ghi đủ sự kiện, giờ đúng', '记录完整、时间准确'),
      isoPf_('Giám sát đường dây: thử hở mạch / ngắn mạch (quý)', '线路监视：模拟断路/短路（季度）', 'Tủ báo lỗi đúng zone / loop', '主机正确显示故障回路', false),
      isoPf_('Liên động: bơm chữa cháy, quạt – AHU, cửa từ (quý)', '联动：消防泵、风机/空调箱、门磁（季度）', 'Liên động đúng thiết kế', '按设计联动', false),
      isoPf_('Đầu báo khói, nhiệt – thử luân phiên zone (quý)', '感烟、感温探测器–按回路轮换测试（季度）', 'Tủ nhận đúng địa chỉ / zone', '主机正确接收地址/回路', false),
      isoPf_('Đầu báo khu vực bụi giấy (bế, cắt, dán hộp)', '纸尘区域探测器（模切、切纸、糊盒）', 'Sạch, không bị che phủ', '清洁、无遮盖'),
      isoPf_('Nút ấn báo cháy (quý)', '手动报警按钮（季度）', 'Thử ngẫu nhiên đạt; nắp nguyên', '抽测合格；盖板完好', false),
      isoPf_('Chuông, còi, đèn chớp báo cháy (quý)', '警铃、警报器、声光报警器（季度）', 'Nghe, thấy rõ ở mọi khu vực', '各区域均可听到、看到', false),
      isoPf_('Đèn sự cố: nhấn TEST hoặc cắt nguồn', '应急灯：按TEST键或断电', 'Sáng ngay khi mất điện', '断电后立即点亮'),
      isoNum_('OTHER', 'Đèn sự cố: thời gian xả ắc quy (quý)', '应急灯：电池放电时间（季度）', 'phút', 'NONE', null, null, { stdVi: 'Đủ thời gian theo thiết kế', stdZh: '持续时间符合设计', req: false }),
      isoPf_('Đèn, biển chỉ dẫn thoát nạn (EXIT)', '疏散指示灯、标志（EXIT）', 'Sáng rõ, đúng hướng, không che', '明亮、方向正确、无遮挡'),
      isoPf_('Lối thoát nạn, cửa thoát nạn', '疏散通道、安全出口门', 'Không khóa, không chắn lối', '未上锁、无阻挡')
    ] },
  { key: 'BM-CĐ-11-03', form_code: 'BM-CĐ-11-03', frequency: 'DAY',
    name_vi: 'Nhật ký vận hành hệ thống xử lý nước thải', name_zh: '废水处理系统运行记录',
    note_vi: 'Giới hạn vận hành là giá trị mẫu – chỉnh theo hệ thống thực tế; giới hạn xả theo giấy phép môi trường / thỏa thuận đấu nối KCN. Vượt giới hạn: báo Tổ trưởng CĐ, lập CAR. Bùn ghi sổ chất thải.',
    note_zh: '运行限值为参考值——按实际系统调整；排放限值按环境许可/园区接管协议。超限：报告机电组长并开具纠正措施单。污泥记入废物台账。',
    items: [
      isoNum_('OTHER', 'Đồng hồ nước vào', '进水表读数', 'm³', 'NONE', null, null, { stdVi: '—', stdZh: '—' }),
      isoNum_('QUALITY', 'pH bể điều hòa', '调节池pH', '', 'RANGE', 6.5, 8.5),
      isoNum_('QUALITY', 'pH bể phản ứng', '反应池pH', '', 'NONE', null, null, ISO_OPT_),
      isoNum_('QUALITY', 'DO', '溶解氧DO', 'mg/L', 'RANGE', 2, 4),
      isoNum_('QUALITY', 'SV30', 'SV30', '%', 'RANGE', 15, 30),
      isoNum_('QUALITY', 'pH đầu ra', '出水pH', '', 'NONE', null, null, { stdVi: 'Theo giấy phép môi trường', stdZh: '按环境许可' }),
      isoPf_('Cảm quan nước đầu ra', '出水感官', 'Trong, không màu, mùi lạ', '清澈、无异色异味'),
      isoPf_('Thiết bị: bơm, máy thổi khí', '设备：水泵、鼓风机', 'Hoạt động bình thường', '运行正常'),
      isoText_('Hóa chất châm (loại – kg)', '加药（种类–kg）'),
      isoNum_('OTHER', 'Bùn xả / ép', '排泥/压泥', 'kg', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false }),
      isoNum_('QUALITY', 'COD đo nhanh', 'COD快检', 'mg/L', 'NONE', null, null, { stdVi: 'Theo giấy phép môi trường', stdZh: '按环境许可', req: false })
    ] },
  { key: 'BM-CĐ-11-04', form_code: 'BM-CĐ-11-04', frequency: 'DAY',
    name_vi: 'Nhật ký vận hành hệ thống xử lý khí thải (bụi, hơi dung môi VOC)', name_zh: '废气处理系统运行记录（粉尘、VOC）',
    note_vi: 'Gán cho từng hệ thống (than hoạt tính, tháp rửa khí, lọc bụi túi vải…). Giá trị chuẩn theo hướng dẫn vận hành / thiết kế. Than, túi lọc thải ghi sổ chất thải nguy hại.',
    note_zh: '分配给每个系统（活性炭、洗涤塔、布袋除尘等）。标准值按操作说明/设计。废活性炭、滤袋记入危废台账。',
    items: [
      isoPf_('Quạt hút', '引风机', 'Hoạt động bình thường', '运行正常'),
      isoNum_('ELEC', 'Tần số quạt', '风机频率', 'Hz', 'NONE', null, null, ISO_OPT_),
      isoNum_('ELEC', 'Dòng điện quạt', '风机电流', 'A', 'NONE'),
      isoNum_('PRESS', 'Chênh áp tầng lọc', '过滤层压差', 'Pa', 'NONE'),
      isoNum_('TEMP', 'Nhiệt độ khí vào', '进气温度', '°C', 'MAX', null, 40),
      isoNum_('QUALITY', 'Tháp rửa: pH', '洗涤塔pH', '', 'NONE', null, null, ISO_OPT_),
      isoNum_('PRESS', 'Áp rũ bụi', '清灰压力', 'bar', 'NONE', null, null, ISO_OPT_),
      isoPf_('Ống thải: cảm quan', '排气筒感官', 'Không khói, mùi bất thường', '无异常烟气、气味'),
      isoNum_('QUALITY', 'VOC đo nhanh', 'VOC快检', 'ppm', 'NONE', null, null, ISO_OPT_),
      isoPf_('Đường ống kín', '管道密封', 'Không hở, không rò', '无破损、无泄漏'),
      isoNum_('OTHER', 'Thay than hoạt tính', '更换活性炭', 'kg', 'NONE', null, null, { stdVi: '—', stdZh: '—', req: false })
    ] },
  { key: 'BM-CĐ-11-07', form_code: 'BM-CĐ-11-07', frequency: 'MONTH',
    name_vi: 'Kiểm tra khu lưu dầu – hóa chất & bộ ứng phó tràn đổ', name_zh: '油品、化学品存放区及泄漏应急包检查',
    note_vi: 'Gán cho từng khu (kho dầu mỡ, kho / tủ hóa chất, bồn dầu máy phát, kho chất thải nguy hại). Tồn tại nghiêm trọng / lặp lại: lập CAR.',
    note_zh: '分配给每个区域（油品仓库、化学品仓库/柜、发电机油罐、危废仓）。严重或重复问题：开具纠正措施单。',
    items: [
      isoPf_('Biển báo, nội quy, khóa cửa', '标识、制度、门锁', 'Đủ, rõ; hạn chế người không phận sự', '齐全清晰；限制无关人员进入'),
      isoPf_('Sàn, bờ bao, khay hứng', '地面、围堰、接油盘', 'Chống thấm, nguyên vẹn, không đọng dầu – hóa chất; đủ dung tích chứa', '防渗完好，无积存；容积足够'),
      isoPf_('Thùng chứa, nhãn', '容器、标签', 'Kín, có nắp, không rò rỉ; có tên & nhãn GHS', '密闭有盖无泄漏；有名称及GHS标签'),
      isoPf_('Phân khu hóa chất không tương thích', '不相容化学品分区', 'Để riêng (axit – kiềm, oxy hóa – dễ cháy)', '分开存放（酸—碱、氧化剂—易燃物）'),
      isoPf_('SDS & lượng tồn', 'SDS及存量', 'SDS tiếng Việt tại chỗ, đúng hóa chất; tồn ≤ mức tối đa', '现场有越南语SDS且一致；存量≤最大存量'),
      isoPf_('Thông gió, nguồn nhiệt, điện', '通风、热源、电气', 'Thông thoáng; xa nguồn nhiệt, tia lửa; không dây điện tạm', '通风良好；远离热源火花；无临时电线'),
      isoPf_('Chữa cháy, lối đi', '消防、通道', 'Bình chữa cháy còn hạn, không bị che; lối đi thông thoáng', '灭火器有效且无遮挡；通道畅通'),
      isoPf_('PPE, vòi rửa mắt', '防护用品、洗眼器', 'Đủ găng, kính, tạp dề; vòi rửa mắt hoạt động', '手套、护目镜、围裙齐全；洗眼器可用', false),
      isoPf_('Rãnh thoát nước gần khu', '附近排水沟', 'Có nắp / van chặn; chất tràn không ra cống nước mưa', '有盖板/截止阀；泄漏物不流入雨水管网'),
      isoPf_('Kho chất thải nguy hại', '危废仓', 'Biển cảnh báo; thùng có nhãn mã CTNH, đúng khu; sổ cập nhật', '设警示标识；容器标注危废代码并分区；台账已更新', false),
      isoPf_('Bộ ứng phó tràn đổ: vị trí', '泄漏应急包：位置', 'Gần khu, dễ thấy, dễ lấy, có biển chỉ dẫn', '靠近区域，醒目易取，有指示标识'),
      isoPf_('Bộ ứng phó: vật tư thấm hút', '应急包：吸附材料', 'Đủ theo danh mục (phao quây, gối thấm, tấm thấm, cát / bột thấm)', '按清单齐全（围栏索、吸附枕、吸附棉、砂/吸附粉）'),
      isoPf_('Bộ ứng phó: dụng cụ, PPE, niêm phong', '应急包：工具、防护用品、封条', 'Đủ xẻng, chổi, túi chất thải, găng, kính; niêm phong nguyên', '铲、扫帚、废物袋、手套、护目镜齐全；封条完好'),
      isoPf_('Bộ ứng phó: hướng dẫn', '应急包：处置说明', 'Có hướng dẫn xử lý tràn đổ & số điện thoại khẩn cấp', '附有泄漏处置说明及紧急联系电话')
    ] },
  { key: 'BM-CĐ-13-01', form_code: 'BM-CĐ-13-01', frequency: 'MONTH',
    name_vi: 'Kiểm tra định kỳ nhà xưởng & kết cấu trên cao', name_zh: '厂房及高处结构定期检查',
    note_vi: 'Gán cho từng nhà xưởng / kho (khai trong M&E). Mục 14–15 chỉ kiểm tra sau mưa bão (ghi ở ghi chú khi kiểm thêm). Không đạt vào Chờ xử lý; tồn tại nghiêm trọng lập CAR.',
    note_zh: '分配给每个厂房/仓库（在M&E登记）。第14–15项仅在暴雨台风后检查（加查写在备注）。不合格进入待处理；严重问题开具纠正措施单。',
    items: [
      isoPf_('Mái tôn, tấm lấy sáng, mái che', '屋面板、采光板、雨棚', 'Không thủng, dột, tốc; vít đủ, kín', '无破洞、漏水、掀起；螺钉齐全密封'),
      isoPf_('Máng xối, ống thoát nước mưa', '雨水槽、雨水管', 'Không tắc, không tràn; mối nối kín', '无堵塞、无溢流；接口密封'),
      isoPf_('Tường, vách ngăn, cột', '墙面、隔墙、柱', 'Không nứt, thấm; sơn không bong tróc', '无裂缝、渗水；油漆无剥落'),
      isoPf_('Sàn xưởng, sàn kho', '车间及仓库地面', 'Không nứt, bong; không đọng nước, dầu', '无裂缝、剥落；无积水、积油'),
      isoPf_('Cửa, cửa cuốn, rèm nhựa, cửa sổ', '门、卷帘门、塑料门帘、窗', 'Đóng kín; gioăng, chổi đáy, rèm còn tốt', '关闭严密；密封条、门底刷、门帘完好'),
      isoPf_('Rãnh thoát nước, hố ga trong xưởng', '车间排水沟、集水井', 'Có nắp, không tắc, không mùi', '有盖板、无堵塞、无异味'),
      isoPf_('Xà gồ, kèo, sàn thao tác, lan can', '檩条、屋架、操作平台、栏杆', 'Không gỉ bong, biến dạng; bu lông đủ', '无锈蚀剥落、变形；螺栓齐全'),
      isoPf_('Bụi giấy trên xà gồ, ống gió, máng đèn', '檩条、风管、灯槽纸尘', 'Không tích tụ', '无积尘'),
      isoPf_('Nước ngưng: ống gió, ống lạnh, AHU', '风管、冷水管、空调箱冷凝水', 'Không nhỏ giọt xuống máy, giấy, sản phẩm', '无滴落至设备、纸张、产品'),
      isoPf_('Đèn, máng đèn khu sản xuất, kho', '生产区及仓库灯具', 'Có chụp bảo vệ, không vỡ', '有防护罩、无破损'),
      isoPf_('Khe hở tường, mái, ống xuyên tường', '墙体、屋顶、穿墙管缝隙', 'Bịt kín; chim, chuột không lọt vào', '已封堵，鸟、鼠无法进入'),
      isoPf_('Lưới chắn côn trùng cửa sổ, ô gió', '窗户、通风口防虫网', 'Nguyên vẹn, không rách, không bụi dày', '完好、无破损、无严重积尘'),
      isoPf_('Dấu hiệu chim, côn trùng, chuột', '鸟、昆虫、鼠类迹象', 'Không phát hiện tổ, phân, xác, vết gặm', '未发现巢穴、粪便、尸体、咬痕'),
      isoPf_('Sau mưa bão: nước vào kho giấy, tủ điện, máy', '暴雨后：雨水侵入纸库、配电柜、设备', 'Không có; giấy, hàng ướt đã cách ly', '无；受潮纸张、货物已隔离', false),
      isoPf_('Sau mưa bão: biển hiệu, cây xanh, vật treo', '暴雨后：招牌、树木、悬挂物', 'Không lỏng, gãy, nghiêng, nguy cơ rơi đổ', '无松动、折断、倾斜、坠落风险', false)
    ] },
  { key: 'BM-CĐ-13-02', form_code: 'BM-CĐ-13-02', frequency: 'MONTH',
    name_vi: 'Kiểm tra kính, nhựa cứng dễ vỡ', name_zh: '玻璃及易碎硬塑检查',
    note_vi: 'Sửa danh sách hạng mục theo từng vị trí của khu (mã vị trí, vật dụng, số lượng; tối đa 60). Vỡ, nứt, thiếu: lập biên bản xử lý sự cố vỡ kính, QA xác nhận trước khi chạy lại.',
    note_zh: '按区域内每个位置修改项目清单（位置编号、物品、数量；最多60项）。破碎、裂纹、缺失：填写玻璃破碎事件处理记录，品保确认后方可恢复生产。',
    items: [
      isoPf_('Đèn, chụp đèn trên khu sản xuất', '生产区上方灯具、灯罩', 'Nguyên vẹn, có chụp bảo vệ', '完好，有防护罩'),
      isoPf_('Cửa kính, vách kính, cửa sổ', '玻璃门、玻璃隔断、窗户', 'Nguyên vẹn, không nứt', '完好、无裂纹'),
      isoPf_('Mặt kính đồng hồ, kính quan sát trên máy', '仪表玻璃、设备观察窗', 'Nguyên vẹn, không nứt', '完好、无裂纹'),
      isoPf_('Nắp, che chắn nhựa cứng trên máy', '设备硬塑盖板、防护罩', 'Nguyên vẹn, không thiếu mảnh', '完好、无缺损'),
      isoNum_('OTHER', 'Số vị trí đã kiểm tra', '已检查位置数', 'vị trí', 'NONE', null, null, { stdVi: 'Đủ vị trí trong danh mục', stdZh: '清单内全部位置' }),
      isoNum_('OTHER', 'Số vị trí vỡ, nứt, thiếu', '破损位置数', 'vị trí', 'MAX', null, 0)
    ] }
];

/** Hạng mục máy phát: withLoad = mẫu tháng (có tải, thử ATS) */
function isoGenItems_(withLoad) {
  var a = [
    isoPf_('Trước khởi động: nhớt, nước làm mát, dây đai', '启动前：机油、冷却液、皮带', 'Trong vạch Min – Max; không rò rỉ', '在Min–Max之间；无渗漏'),
    isoNum_('LEVEL', 'Nhiên liệu bồn ngày', '日用油箱油位', '%', 'NONE'),
    isoNum_('ELEC', 'Điện áp ắc quy khởi động', '启动蓄电池电压', 'V', 'NONE', null, null, { stdVi: '≥ theo nhà sản xuất; cọc bình, bộ sạc tốt', stdZh: '≥厂家要求；接线柱、充电器正常' }),
    isoPf_('Sấy nước làm mát, lọc gió, ống xả', '冷却液加热器、空气滤清器、排气管', 'Bình thường', '正常'),
    isoNum_('ELEC', 'Điện áp dây U12 / U23 / U31', '线电压U12/U23/U31', 'V', 'RANGE', 380, 420, { type: 'THREE_PHASE', imb: 3 }),
    isoNum_('ELEC', 'Tần số', '频率', 'Hz', 'RANGE', 49.5, 50.5)
  ];
  if (withLoad) {
    a.push(isoNum_('ELEC', 'Dòng điện I1 / I2 / I3 khi có tải', '带载电流I1/I2/I3', 'A', 'NONE', null, null, { type: 'THREE_PHASE', imb: 10 }));
    a.push(isoNum_('ELEC', 'Công suất tải', '负载功率', '% định mức', 'MIN', 30));
  }
  a.push(isoNum_('PRESS', 'Áp suất nhớt', '机油压力', 'bar', 'NONE'));
  a.push(isoNum_('TEMP', 'Nhiệt độ nước làm mát', '冷却液温度', '°C', 'MAX', null, 95));
  a.push(isoNum_('OTHER', 'Thời gian chạy', '运行时间', 'phút', 'MIN', withLoad ? 30 : 10));
  a.push(isoPf_('Khói thải, tiếng ồn, rung', '排烟、噪声、振动', 'Không bất thường', '无异常'));
  if (withLoad) {
    a.push(isoNum_('OTHER', 'Thử ATS: mất lưới → máy phát đóng tải', 'ATS测试：市电中断→发电机带载', 'giây', 'NONE'));
    a.push(isoPf_('Chuyển về lưới, làm mát máy', '恢复市电、冷机', 'Đúng trình tự', '程序正确'));
    a.push(isoNum_('LEVEL', 'Nhiên liệu tồn bồn chính', '主油罐存油量', 'L', 'NONE'));
  }
  a.push(isoNum_('OTHER', 'Giờ chạy tích lũy', '累计运行小时', 'h', 'NONE', null, null, { stdVi: '—', stdZh: '—' }));
  a.push(isoPf_('Sau khi thử', '试机后', 'Trả về AUTO; ATS tự động; CB máy phát đóng', '恢复AUTO；ATS自动；发电机断路器合闸'));
  return a;
}

/** UUID v4 cố định theo khóa (mẫu ISO tạo lại không trùng; chạy lại cùng lệnh không tạo hai lần) */
function isoUuid_(key) {
  var h = sha256_('iso-template:' + key).map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'[parseInt(h.charAt(16), 16) % 4] + h.slice(17, 20) + '-' + h.slice(20, 32);
}

/** Danh sách mẫu ISO cho app chọn: {key, form_code, name, frequency, items, template_id, exists} */
function isoTemplateList_() {
  var have = {};
  readRows_('Templates').forEach(function (t) { have[t.template_id] = t; });
  return ISO_TEMPLATES_.map(function (t) {
    var id = isoUuid_(t.key), cur = have[id];
    return { key: t.key, form_code: t.form_code, name_vi: t.name_vi, name_zh: t.name_zh, frequency: t.frequency, items: t.items.length,
      template_id: id, exists: !!cur, template_code: cur ? cur.template_code : '', active: cur ? cur.active !== false : null };
  });
}

/** Sheet Templates đã có cột form_code (đã chạy migrateSchema sau khi dán mã mới) */
function isoMigrated_() {
  return hdr_('Templates').cols.indexOf('form_code') >= 0;
}

/** template.isoList: danh sách mẫu ISO và mẫu nào đã tạo */
function templateIsoList_(ctx) {
  return { templates: isoTemplateList_(), migrated: isoMigrated_() };
}

/**
 * template.isoSeed {keys: [...]} — Trưởng bộ phận/Quản trị, PIN. Tạo các mẫu chọn (phiên bản 1, đang dùng, chưa gán máy);
 * mẫu đã có (kể cả đã ngừng) bỏ qua. Mẫu theo ca dùng mọi ca đang cài đặt.
 */
function templateIsoSeed_(ctx) {
  var p = ctx.req.payload || {};
  var keys = Array.isArray(p.keys) ? p.keys.map(String) : [];
  var defs = ISO_TEMPLATES_.filter(function (t) { return keys.indexOf(t.key) >= 0; });
  if (!defs.length) throw validationError_([fieldError_('keys', 'REQUIRED')]);
  if (!isoMigrated_()) throw validationError_([fieldError_('keys', 'MIGRATE_REQUIRED')]);
  var allShifts = shiftsCfg_().map(function (s) { return String(s.no); }).join(',');
  return executeWrite_(ctx, {
    entity_type: 'TEMPLATE', entity_id: '',
    build: function (st) {
      var have = {};
      readRows_('Templates').forEach(function (t) { have[t.template_id] = true; });
      var su = {}, writes = [], created = [], skipped = [];
      var nowIso = isoVN_(now_());
      var human = function (fields) { var m = {}; fields.forEach(function (f) { m[f] = { src: 'vi', state: 'HUMAN', at: nowIso }; }); return m; };
      defs.forEach(function (t) {
        var id = isoUuid_(t.key);
        if (have[id]) { skipped.push(t.key); return; }
        var row = cNew_(ctx, {
          template_id: id, template_code: allocCode_(st, su, 'TEMPLATE'), name_vi: t.name_vi, name_zh: t.name_zh, frequency: t.frequency,
          shifts: t.frequency === 'SHIFT' ? allShifts : '', revision: 1, active: true, note_vi: t.note_vi || '', note_zh: t.note_zh || '',
          form_code: t.form_code, i18n_meta: human(['name', 'note'])
        });
        writes.push({ sheet: 'Templates', mode: 'insert', row: row });
        t.items.forEach(function (it, i) {
          var errs = [];
          var std = normStd_(it, errs, 'items.' + i + '.');
          if (errs.length) throw apiError_('INTERNAL_ERROR', 'ISO ' + t.key + ' #' + (i + 1) + ' ' + errs[0].code);
          var r = Object.assign(std, {
            template_item_id: uuid_(), template_id: id, revision: 1, item_key: uuid_(), step_no: i + 1, library_item_id: '',
            name_vi: it.name_vi, name_zh: it.name_zh, std_text_vi: it.std_text_vi || '', std_text_zh: it.std_text_zh || '', how_vi: '', how_zh: '',
            required: it.required !== false, photo_on_fail: false, i18n_meta: human(['name', 'std_text'])
          });
          writes.push({ sheet: 'TemplateItems', mode: 'insert', row: cNew_(ctx, r) });
        });
        created.push({ key: t.key, template_id: id, template_code: row.template_code });
      });
      if (!created.length) throw validationError_([fieldError_('keys', 'ISO_ALL_EXIST')]);
      return {
        writes: writes, state: su, noReplay: true,
        result: { created: created, skipped: skipped },
        audit: { entity_type: 'TEMPLATE', entity_id: '', after_json: { iso_created: created.map(function (c) { return c.key + '=' + c.template_code; }), skipped: skipped } }
      };
    }
  });
}
