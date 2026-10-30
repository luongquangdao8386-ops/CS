/* 04_i18n: lời báo song ngữ cho mã kết quả */

var MSG = {
  OK: ['Thành công', '成功'],
  AUTH_REQUIRED: ['Cần đăng nhập lại', '需要重新登录'],
  AUTH_REQUIRED_REVOKED: ['Phiên đã bị thu hồi hoặc quyền đã thay đổi', '会话已撤销或权限已变更'],
  SESSION_EXPIRED: ['Phiên đăng nhập đã hết hạn', '登录会话已过期'],
  AUTH_FAILED: ['Mã nhân viên hoặc PIN không đúng', '工号或PIN错误'],
  PIN_LOCKED: ['Tạm khóa do nhập sai PIN nhiều lần, thử lại sau {n} phút', '因多次输错PIN已暂时锁定，请 {n} 分钟后重试'],
  LOGIN_PAUSED: ['Đăng nhập đang tạm dừng, thử lại sau {n} phút', '登录已暂停，请 {n} 分钟后重试'],
  ACCOUNT_DISABLED: ['Tài khoản đã bị khóa, liên hệ quản trị', '账户已被停用，请联系管理员'],
  MUST_CHANGE_PIN: ['Bạn đang dùng PIN tạm, hãy đặt PIN mới', '您正在使用临时PIN，请设置新PIN'],
  TEMP_PIN_EXPIRED: ['PIN tạm đã hết hạn, liên hệ quản trị để cấp lại', '临时PIN已过期，请联系管理员重新发放'],
  REAUTH_REQUIRED: ['Nhập lại PIN để tiếp tục', '请重新输入PIN以继续'],
  DATASET_RESET: ['Dữ liệu đã được đặt lại, cần tải lại', '数据已重置，需重新加载'],
  SYSTEM_MAINTENANCE: ['Hệ thống đang bảo trì', '系统维护中'],
  FORBIDDEN: ['Không có quyền', '无权限'],
  VALIDATION_ERROR: ['Dữ liệu chưa hợp lệ', '数据无效'],
  VERSION_CONFLICT: ['Xung đột, cần xử lý', '冲突，需处理'],
  DUPLICATE_OPERATION: ['Thao tác đã được ghi trước đó', '该操作此前已保存'],
  OPERATION_ID_REUSED: ['Mã thao tác bị dùng lại với nội dung khác', '操作编号被用于不同内容'],
  NOT_FOUND: ['Không tìm thấy', '未找到'],
  FEATURE_NOT_ENABLED: ['Chức năng chưa bật', '功能尚未启用'],
  CLIENT_UPDATE_REQUIRED: ['Cần cập nhật app, nháp vẫn được giữ', '需要更新应用，草稿仍会保留'],
  SERVER_BUSY: ['Máy chủ đang bận, thử lại sau ít giây', '服务器繁忙，请稍后重试'],
  QUOTA_EXCEEDED: ['Đã hết hạn mức của Google hôm nay', '今日谷歌配额已用尽'],
  INTERNAL_ERROR: ['Lỗi máy chủ', '服务器错误'],
  SYSTEM_NOT_READY: ['Máy chủ chưa được cài đặt', '服务器尚未初始化'],
  RECOVERY_REQUIRED: ['Thao tác ghi chưa hoàn tất, cần phục hồi', '写入未完成，需要恢复'],
  ME_LINK_FAILED: ['Không lấy được danh sách thiết bị từ M&E', '无法从 M&E 获取设备列表']
};

/** Lời báo cho mã con trong errors[] */
var SUB_MSG = {
  ID_INVALID: ['Mã định danh không hợp lệ', '标识无效'],
  ID_EXISTS: ['Mã định danh đã tồn tại', '标识已存在'],
  CODE_DUPLICATE: ['Mã đã được dùng', '编号已被使用'],
  CODE_INVALID: ['Mã chỉ gồm chữ hoa, số và . _ / -', '编号只能包含大写字母、数字及 . _ / -'],
  PIN_WEAK: ['PIN quá dễ đoán, hãy chọn PIN khác', 'PIN过于简单，请换一个'],
  PIN_FORMAT: ['PIN phải gồm đúng 6 chữ số', 'PIN必须为6位数字'],
  PIN_SAME: ['PIN mới phải khác PIN hiện tại', '新PIN不能与当前PIN相同'],
  REQUIRED: ['Bắt buộc nhập', '必填'],
  REQUIRED_ONE_LANGUAGE: ['Nhập ít nhất một thứ tiếng', '请至少填写一种语言'],
  INVALID_VALUE: ['Giá trị không hợp lệ', '值无效'],
  INVALID_DATE: ['Ngày không hợp lệ', '日期无效'],
  NOT_FOUND: ['Không tìm thấy hồ sơ liên quan', '未找到相关记录'],
  NEEDS_NETWORK: ['Cần kết nối mạng', '需要网络连接'],
  FILE_TOO_LARGE: ['Tệp quá lớn', '文件过大'],
  FILE_TYPE: ['Loại tệp không được hỗ trợ', '不支持的文件类型'],
  URL_INVALID: ['Liên kết không đúng dạng …/exec của Apps Script', '链接不是 Apps Script 的 …/exec 格式'],
  SELF_ACTION: ['Không thao tác lên chính mình', '不能对自己执行此操作'],
  LAST_ADMIN: ['Phải còn ít nhất một tài khoản Quản trị đang hoạt động', '必须保留至少一个启用的管理员账号'],
  STATUS_INVALID: ['Trạng thái hiện tại không cho thao tác này', '当前状态不允许此操作'],
  // Checksheet
  STD_INVALID: ['Tiêu chuẩn chưa hợp lệ (giá trị từ phải nhỏ hơn giá trị đến)', '标准无效（最小值须小于最大值）'],
  CHOICES_REQUIRED: ['Kiểu chọn cần ít nhất hai lựa chọn, có lựa chọn Đạt', '选择型至少两个选项，且须有合格项'],
  ITEMS_REQUIRED: ['Mẫu cần ít nhất một hạng mục', '模板至少需要一个项目'],
  SHIFTS_REQUIRED: ['Kiểm theo ca: chọn ít nhất một ca', '按班点检：至少选择一个班次'],
  ISO_ALL_EXIST: ['Các mẫu đã chọn đều đã được tạo', '所选模板均已创建'],
  MIGRATE_REQUIRED: ['Máy chủ chưa chạy migrateSchema (thiếu cột form_code)', '服务器尚未运行migrateSchema（缺少form_code列）'],
  FORM_CODE_LONG: ['Mã biểu mẫu tối đa 40 ký tự', '表单编号最多40个字符'],
  SHIFTS_INVALID: ['Giờ các ca không hợp lệ', '班次时间无效'],
  FAIL_NOTE_REQUIRED: ['Mục Không đạt phải có ghi chú', '不合格项目须填写备注'],
  PERIOD_INVALID: ['Ngày/ca của lượt kiểm không hợp lệ', '点检日期/班次无效'],
  PERIOD_TOO_OLD: ['Lượt kiểm quá cũ để ghi', '点检记录过旧，无法保存'],
  RUN_EXISTS: ['Máy này đã có người kiểm trong ca/kỳ này', '该设备本班次/周期已有人点检'],
  RUN_LOCKED: ['Ngày này trưởng bộ phận đã xác nhận, không sửa được', '该日已由部门主管确认，不能修改'],
  NOT_ASSIGNED: ['Máy chưa được gán mẫu này hoặc đã ngừng', '设备未分配该模板或已停用'],
  MACHINE_INACTIVE: ['Máy đã ngừng dùng', '设备已停用'],
  TEMPLATE_INACTIVE: ['Mẫu đã ngừng dùng', '模板已停用'],
  REVISION_UNKNOWN: ['Không có phiên bản mẫu này', '不存在该模板版本'],
  ASSIGNMENT_EXISTS: ['Máy đã được gán mẫu này', '设备已分配该模板'],
  FUTURE_DATE: ['Không xác nhận ngày chưa tới', '不能确认未来日期'],
  ALREADY_CONFIRMED: ['Ngày này đã được xác nhận', '该日已确认'],
  ME_LINK_FAILED: ['Không kết nối được M&E (kiểm tra link /exec và mã kết nối)', '无法连接 M&E（请检查 /exec 链接和连接密钥）'],
  KEY_FORMAT: ['Mã kết nối phải dài ít nhất 24 ký tự', '连接密钥至少24个字符']
};

function fmtMsg_(pair, vars) {
  if (!vars) return pair;
  return pair.map(function (s) {
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  });
}

/** Lỗi API: ném ra ở mọi tầng, dispatcher đổi thành phản hồi */
function apiError_(code, data, errors, msgVars) {
  var e = new Error(code);
  e.apiCode = code;
  e.apiData = data || null;
  e.apiErrors = errors || [];
  e.msgVars = msgVars || null;
  return e;
}

/** Một dòng errors[] */
function fieldError_(field, subCode, row) {
  var m = SUB_MSG[subCode] || [subCode, subCode];
  return { row: row === undefined ? null : row, field: field || null, code: subCode, message_vi: m[0], message_zh: m[1] };
}

function validationError_(errs) {
  return apiError_('VALIDATION_ERROR', null, errs);
}
