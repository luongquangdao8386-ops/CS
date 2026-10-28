// Cấu hình phía app. Chỉ 4 giá trị, không có bí mật.
// Cùng một mã chạy ở hai trang; app chọn máy chủ theo thư mục của trang:
//   /CS/     THẬT — repo CS
//   /CS-thu/ THỬ  — repo CS-thu (bản sao mã), chỉ dữ liệu mẫu
// Link /exec để trống: màn đăng nhập cho dán link tạm (lưu trên máy) tới khi điền vào đây.
// Hiện chưa có máy chủ THẬT: trang /CS/ tạm dùng máy chủ THỬ (app hiện nhãn THỬ). Khi có THẬT thì điền THAT vào /CS/,
// trang thử chuyển sang /CS-thu/; máy đã đăng nhập THỬ tự xóa dữ liệu cũ khi đổi máy chủ.
(function () {
  var THAT = ''; // CS_MayChu_THAT
  var THU = 'https://script.google.com/macros/s/AKfycbyZyurV0sBS4Tqu48P_QoM0e9OuYpeTXh1aP9-U_w5W7Sz5r9ezDlbmDzaHtvhLU2vr/exec'; // CS_MayChu_THU
  var SITES = {
    '/CS/': { base: 'https://luongquangdao8386-ops.github.io/CS/', exec: THAT || THU },
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
