// Ảnh: thu nhỏ trước khi gửi (bỏ EXIF/GPS), chia sẻ tệp, link ảnh Drive (lấy từ M&E)
import { session } from './core.js';

function canvasToBlob(c, type, q) {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), type, q));
}

/** Kích thước ảnh đã xoay theo EXIF, đọc từ thẻ img (chỉ đọc đầu tệp, chưa giải mã cả ảnh); không đọc được → null */
function imageSize(file) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (v) => { URL.revokeObjectURL(url); res(v); };
    img.onload = () => done(img.naturalWidth && img.naturalHeight ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/*
 * Ảnh camera Android (50 MP, 8160×6120): giải mã thẳng về ≤ maxEdge bằng createImageBitmap (thu nhỏ ở luồng giải mã) — không giữ
 * bitmap cỡ gốc ~200 MB rồi mới vẽ thu nhỏ (máy RAM thấp chậm, có khi văng app). Chỉ trình duyệt Chromium (Android, máy tính):
 * đã kiểm xoay EXIF đúng; Safari/iPhone (ảnh 12 MP) giữ cách cũ. Không đúng kích thước yêu cầu → bỏ, giải mã như cũ.
 */
async function decodeScaled(file, maxEdge) {
  const ua = navigator.userAgent;
  if (!/Chrome\//.test(ua) || /iPhone|iPad|iPod/.test(ua)) return null;
  const sz = await imageSize(file);
  if (!sz || Math.max(sz.w, sz.h) <= maxEdge) return null;
  const s = maxEdge / Math.max(sz.w, sz.h);
  const tw = Math.max(1, Math.round(sz.w * s)), th = Math.max(1, Math.round(sz.h * s));
  try {
    const bmp = await createImageBitmap(file, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
    if (bmp.width === tw && bmp.height === th) return { src: bmp, w: sz.w, h: sz.h, how: 'createImageBitmap-resize', close: () => bmp.close && bmp.close() };
    if (bmp.close) bmp.close();
  } catch (e) { /* trình duyệt không nhận tùy chọn thu nhỏ: giải mã cỡ gốc */ }
  return null;
}

async function decodeImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, how: 'createImageBitmap', close: () => bmp.close && bmp.close() };
  } catch (e) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, how: 'img', close: () => URL.revokeObjectURL(url) };
  }
}

function drawScaled(src, w, h, edge) {
  const s = Math.min(1, edge / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Vẽ thẳng vào canvas đích (≤1600 px, JPEG 0,8) và bản nhỏ 400 px; không tạo canvas cỡ gốc; bỏ EXIF/GPS */
export async function processPhoto(file) {
  const st = session.settings || {};
  const maxEdge = st.photo_max_edge_px || 1600, thumbEdge = st.photo_thumb_edge_px || 400, q = st.photo_jpeg_quality || 0.8;
  const t0 = performance.now();
  const d = (await decodeScaled(file, maxEdge)) || await decodeImage(file);
  const big = drawScaled(d.src, d.w, d.h, maxEdge);
  // Bản nhỏ vẽ từ bản ≤1600 px, không vẽ lại từ ảnh gốc
  const small = drawScaled(big, big.width, big.height, thumbEdge);
  d.close();
  const main = await canvasToBlob(big, 'image/jpeg', q);
  const thumb = await canvasToBlob(small, 'image/jpeg', 0.75);
  const out = { main, thumb, src_w: d.w, src_h: d.h, out_w: big.width, out_h: big.height, how: d.how, in_bytes: file.size, in_type: file.type, ms: Math.round(performance.now() - t0) };
  big.width = big.height = small.width = small.height = 0;
  return out;
}

/** Máy cảm ứng (iPhone/iPad/Android) mới dùng bảng Chia sẻ; máy tính tải thẳng bằng <a download> (2.6) */
export function isTouchMobile() {
  return /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Bước 2 trên iPhone: gọi share ngay trong trình xử lý chạm, không await trước đó */
export function shareFileNow(file) {
  if (isTouchMobile() && navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: file.name });
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return Promise.resolve();
}

/** URL ảnh "ai có link: xem" (lh3 đọc được bằng thẻ img, như ảnh hiện trường M&E) */
export function photoUrls(driveFileId, w = 400) {
  return {
    thumbnail: `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w${w}`,
    lh3: `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFileId)}=w${w}`
  };
}
