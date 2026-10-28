// Chạy app tĩnh dưới /CS/ và /CS-thu/ (giống GitHub Pages) + chặn request tới /exec bằng máy chủ giả lập (Code.gs chạy trong Node)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { freshServer } from '../helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
export const EXEC = 'https://script.google.com/macros/s/TESTONLY_fake_cs_deployment_id_00/exec';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

export function startStatic() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const site = /^\/(CS|CS-thu)\//.exec(u.pathname);
      if (!site) { res.writeHead(404); res.end(); return; }
      let p = decodeURIComponent(u.pathname.slice(site[0].length)) || 'index.html';
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, origin: `http://127.0.0.1:${srv.address().port}` }));
  });
}

/**
 * Mở trình duyệt; mọi POST tới EXEC đi vào máy chủ giả lập `env`.
 * now: giờ cố định (ISO) cho đồng hồ trình duyệt — đặt cùng giờ với máy chủ giả (freshServer({now})).
 * site: 'CS-thu' (mặc định) hoặc 'CS'. offline(): chặn mạng tới máy chủ.
 */
export async function openApp({ env = freshServer(), viewport = { width: 390, height: 844 }, mobile = true, site = 'CS-thu', now = null, hash = '' } = {}) {
  const { srv, origin } = await startStatic();
  const base = `${origin}/${site}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : undefined,
    serviceWorkers: 'block'
  });
  if (now) await context.clock.setFixedTime(new Date(now));
  const calls = [];
  const state = { down: false };
  await context.route('https://lh3.googleusercontent.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG_1X1, 'base64') }));
  await context.route('https://drive.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG_1X1, 'base64') }));
  await context.route(EXEC + '**', async (route) => {
    if (state.down) { await route.abort('internetdisconnected'); return; }
    const req = route.request();
    let body;
    if (req.method() === 'GET') body = JSON.stringify(env.get({}));
    else {
      const parsed = JSON.parse(req.postData() || '{}');
      calls.push(parsed.action);
      env.g.dbReset_();
      body = JSON.stringify(env.post(parsed));
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }).catch(() => {});
  });
  const ns = site.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  await context.addInitScript(([k, exec]) => { try { localStorage.setItem(k, exec); } catch (e) { /* bỏ qua */ } }, [ns + '.exec_url', EXEC]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(base + hash);
  return {
    env, page, context, browser, base, calls, consoleErrors,
    /** Mất mạng: request tới máy chủ lỗi và trình duyệt báo offline */
    async offline(on = true) { state.down = on; await context.setOffline(on); },
    async close() { await browser.close(); srv.close(); }
  };
}

export const SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
