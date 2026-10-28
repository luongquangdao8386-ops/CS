// Cấu hình phía app. Chỉ 4 giá trị, không có bí mật.
// Cùng một mã chạy ở hai trang; app chọn máy chủ theo thư mục của trang:
//   /CS/     THẬT — repo CS
//   /CS-thu/ THỬ  — repo CS-thu (bản sao mã), chỉ dữ liệu mẫu
// Link /exec để trống: màn đăng nhập cho dán link tạm (lưu trên máy) tới khi điền vào đây.
(function () {
  var THAT = ''; // CS_MayChu_THAT
  var THU = '';  // CS_MayChu_THU
  var SITES = {
    '/CS/': { base: 'https://luongquangdao8386-ops.github.io/CS/', exec: THAT },
    '/CS-thu/': { base: 'https://luongquangdao8386-ops.github.io/CS-thu/', exec: THU }
  };
  var m = /^\/[^/]+\//.exec(location.pathname);
  var site = (m && SITES[m[0]]) || { base: '', exec: '' };
  window.CS_CONFIG = {
    APP_BASE_URL: site.base,
    EXEC_URL: site.exec,
    API_CONTRACT_VERSION: '1.0',
    BUILD_VERSION: '1.0.0-d1.1'
  };
})();
