// Quét QR bằng camera (jsQR khi không có BarcodeDetector, như M&E) hoặc nhập mã máy
import { bi, biText, esc } from './core.js';
import { getRecords } from './sync.js';
import { h, $, ICON } from './ui.js';

const CROCK_RE = /^[0-9A-HJKMNP-TV-Z]{20}$/;
export function normalizeKey(s) {
  const t = String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return CROCK_RE.test(t) ? t : null;
}

/**
 * Phân loại chuỗi quét/nhập. Tem QR M&E đang dán trên máy: link …/ME/#/r/<mã> (hoặc /ME-thu/) — Checksheet đọc mã QR đó.
 * Nhập tay: mã QR 20 ký tự hoặc mã thiết bị (TB-0007).
 */
export function parseScan(raw, manual = false) {
  const s = String(raw || '').trim();
  const m = /#\/r\/([0-9A-Za-z-]{20,24})(?:[?#/]|$)/.exec(s);
  if (m && /^https:\/\//i.test(s)) {
    const key = normalizeKey(m[1]);
    return key ? { kind: 'qr', key } : { kind: 'foreign', raw: s };
  }
  if (/^[a-z]+:\/\//i.test(s)) return { kind: 'foreign', raw: s };
  const key = normalizeKey(s);
  if (key) return { kind: 'qr', key };
  if (manual && /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,31}$/.test(s)) return { kind: 'code', code: s.toUpperCase() };
  return { kind: 'foreign', raw: s };
}

/** Tìm máy trong dữ liệu đã tải trên máy (dùng được khi mất mạng) */
export async function resolveScan(p) {
  if (p.kind === 'foreign') return { qr_state: 'FOREIGN', raw: p.raw };
  const list = await getRecords('MACHINE');
  const hit = list.find((x) => (p.kind === 'qr' ? x.qr_key === p.key : x.machine_code === p.code));
  if (!hit) return { qr_state: 'UNAVAILABLE' };
  if (!hit.active) return { qr_state: 'INACTIVE', machine_id: hit.machine_id };
  return { qr_state: 'OK', machine_id: hit.machine_id, code: hit.machine_code };
}

export function qrStateText(st) {
  return { FOREIGN: 'qr_foreign', UNAVAILABLE: 'qr_unavailable', INACTIVE: 'qr_inactive' }[st];
}

/**
 * Mở màn quét. onResult(raw, info) với info = {method, ms_to_decode, manual}.
 * Trả hàm đóng.
 */
export function openScanner({ onResult, onClose }) {
  const el = h(`<div class="scanner" role="dialog" aria-modal="true">
    <div class="scanner-top"><button type="button" class="icon-btn light" id="sc-close" aria-label="${esc(biText('back'))}">${ICON.back}</button>
      <h2>${bi('scan')}</h2></div>
    <div class="scanner-view"><video id="sc-video" playsinline muted autoplay></video><div class="scanner-frame" aria-hidden="true"></div></div>
    <p class="scanner-status" id="sc-status">${bi('scan_hint')}</p>
    <form class="scanner-manual" id="sc-form"><input id="sc-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="TB-0007" aria-label="${esc(biText('manual_code'))}">
      <button type="submit" class="btn primary small">${bi('manual_code')}</button></form>
  </div>`);
  document.body.appendChild(el);
  const video = $('#sc-video', el);
  const status = $('#sc-status', el);
  let stream = null, stopped = false, worker = null, timer = null, busy = false;
  const t0 = performance.now();
  let method = null;

  function stop() {
    stopped = true;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (worker) worker.terminate();
    el.remove();
  }
  function done(raw, manual) {
    const info = { method: manual ? 'manual' : method, ms_to_decode: Math.round(performance.now() - t0), manual };
    stop();
    onResult && onResult(raw, info);
  }
  $('#sc-close', el).addEventListener('click', () => { stop(); onClose && onClose(); });
  $('#sc-form', el).addEventListener('submit', (e) => { e.preventDefault(); const v = $('#sc-input', el).value.trim(); if (v) done(v, true); });

  (async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status.innerHTML = 'Không có camera · 无摄像头 — ' + bi('manual_code');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      status.innerHTML = `Không mở được camera (${esc(e.name)}) · 无法打开摄像头 — ${bi('manual_code')}`;
      return;
    }
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});
    let detector = null;
    if ('BarcodeDetector' in window) {
      try {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) { detector = null; }
    }
    method = detector ? 'BarcodeDetector' : 'jsQR';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!detector) {
      worker = new Worker('js/qr-worker.js');
      worker.onmessage = (ev) => { busy = false; if (ev.data && !stopped) done(ev.data, false); };
      worker.onerror = () => { busy = false; };
    }
    let frame = 0;
    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2 && !busy) {
        if (detector) {
          try {
            const codes = await detector.detect(video);
            if (codes.length && codes[0].rawValue) { done(codes[0].rawValue, false); return; }
          } catch (e) { /* bỏ qua khung lỗi */ }
        } else {
          // Lượt chẵn: cả khung thu nhỏ ≤640 px; lượt lẻ: vùng giữa (khung ngắm) gần độ phân giải gốc ≤800 px —
          // đọc được mã nhỏ, ở xa hoặc hiện trên màn hình máy tính mà khung thu nhỏ làm mất chi tiết
          const vw = video.videoWidth, vh = video.videoHeight;
          let sx = 0, sy = 0, sw = vw, sh = vh, max = 640;
          if (frame++ % 2) { sw = sh = Math.round(Math.min(vw, vh) * 0.8); sx = (vw - sw) >> 1; sy = (vh - sh) >> 1; max = 800; }
          const s = Math.min(1, max / Math.max(sw, sh));
          canvas.width = Math.round(sw * s); canvas.height = Math.round(sh * s);
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          busy = true;
          worker.postMessage({ data: img.data.buffer, width: img.width, height: img.height }, [img.data.buffer]);
        }
      }
      timer = setTimeout(tick, 150);
    };
    tick();
  })();
  return stop;
}
