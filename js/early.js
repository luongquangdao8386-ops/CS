// Chạy trước khi vẽ trang (script thường trong <head>): máy đã có ảnh nền riêng (Quản trị → Ảnh nền, js/bg.js) thì gắn lớp bg-login /
// bg-home ngay, để màn chờ và màn đăng nhập không chớp ảnh mặc định trong lúc js/bg.js lấy ảnh riêng từ Cache Storage của máy.
// Tiền tố theo thư mục trang như storageNs (js/core.js): /CS/ → cs, /CS-thu/ → cs_thu (khóa localStorage cs.bg / cs_thu.bg).
(function () {
  try {
    var m = /^\/([^/]+)\//.exec(location.pathname || '');
    var seg = m ? m[1].toLowerCase().replace(/[^a-z0-9]+/g, '_') : '';
    var ns = seg.indexOf('cs') === 0 ? seg : 'cs';
    var f = JSON.parse(localStorage.getItem(ns + '.bg') || '{}') || {};
    if (f.login && f.login.on) document.documentElement.classList.add('bg-login');
    if (f.home && f.home.on) document.documentElement.classList.add('bg-home');
  } catch (e) { /* không có localStorage: dùng ảnh mặc định */ }
})();
