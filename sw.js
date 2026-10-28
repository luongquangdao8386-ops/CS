// Service Worker của Checksheet — phạm vi thư mục của trang (/CS/ THẬT, /CS-thu/ THỬ); chỉ quản lý cache của chính trang này
// (cs-shell-* ở /CS/, cs_thu-shell-* ở /CS-thu/ — cùng quy tắc storageNs trong js/core.js). Chung origin github.io với M&E:
// tiền tố "cs" không đụng cache "me-*" của M&E.
const VERSION = '1.0.0-d1.1';
const BUILD_HASH = '734688baf7c7'; // tools/build.mjs ghi mã băm nội dung các tệp vỏ app
const NS = (() => {
  const m = /^\/([^/]+)\//.exec(self.location.pathname);
  const seg = m ? m[1].toLowerCase().replace(/[^a-z0-9]+/g, '_') : '';
  return seg.startsWith('cs') ? seg : 'cs';
})();
const PREFIX = NS + '-shell-';
const SHELL = PREFIX + VERSION + '-' + BUILD_HASH;
const FILES = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/core.js', 'js/dict.js', 'js/auth.js', 'js/sync.js', 'js/ui.js', 'js/scan.js', 'js/media.js', 'js/qr-worker.js',
  'js/router.js', 'js/std-edit.js', 'js/data.js', 'js/judge.js', 'js/shell.js', 'js/app.js', 'js/form.js', 'js/xlsx.js', 'js/report-logo.js',
  'js/pages/home.js', 'js/pages/today.js', 'js/pages/check.js', 'js/pages/month.js', 'js/pages/history.js', 'js/pages/pending.js', 'js/pages/machines.js', 'js/pages/templates.js',
  'js/pages/reports.js', 'js/pages/account.js', 'js/pages/drafts.js', 'js/pages/admin.js',
  'vendor/jsQR-1.4.0.js',
  'assets/brand/cs-tile.svg', 'assets/bg/factory.jpg', 'assets/bg/home.jpg', 'assets/icons/apple-touch-icon.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];

// Tải vỏ app từ máy chủ gốc theo mã bản (?v=BUILD_HASH, lưu dưới tên tệp thường): ngay sau khi phát hành, CDN của
// GitHub Pages có thể còn trả tệp cũ vài phút → không có ?v thì cache bản mới lẫn tệp cũ (bài học M&E d2.9).
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(FILES.map(async (f) => {
      const r = await fetch(new Request(f + (f.includes('?') ? '&' : '?') + 'v=' + BUILD_HASH, { cache: 'reload' }));
      if (!r.ok) throw new Error('precache ' + f + ' ' + r.status);
      await c.put(new Request(f), r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // không chặn script.google.com, Drive
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: SHELL }).then((hit) => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: SHELL, ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
