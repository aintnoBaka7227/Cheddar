import { spawn } from 'node:child_process';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:5080/' },
    out: { type: 'string', default: '.verify-evidence' },
    port: { type: 'string', default: '9333' },
  },
});
const OUT = resolve(args.out);
await mkdir(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`); };

async function openBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'cheddar-verify-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${args.port}`, `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 100 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${args.port}/json`)).json(); } catch { await sleep(100); }
  }
  if (!targets) throw new Error('Chrome DevTools endpoint never came up');
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 860, deviceScaleFactor: 1, mobile: false });
  const close = async () => { ws.close(); proc.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }); };
  return { send, evaluate, close };
}

const SEL = { cat: 'button.cheddar', session: '#session-count', global: '#global-count' };

async function load(b) {
  await b.send('Page.navigate', { url: args.url });
  for (let i = 0; i < 100; i++) {
    const ready = await b.evaluate(`(() => { const g = document.querySelector('${SEL.global}'); return !!document.querySelector('${SEL.cat}') && !!g && /^\\d+$/.test(g.textContent.trim()) && document.documentElement.dataset.cheddarReady === 'true'; })()`).catch(() => false);
    if (ready) return;
    await sleep(100);
  }
  throw new Error('page never became interactive (cat button, numeric all-time count, data-cheddar-ready)');
}
const counts = (b) => b.evaluate(`({ session: Number(document.querySelector('${SEL.session}').textContent), global: Number(document.querySelector('${SEL.global}').textContent) })`);
async function click(b) {
  const { x, y } = await b.evaluate(`(() => { const r = document.querySelector('${SEL.cat}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function shot(b, name) {
  const { data } = await b.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  return `data:image/png;base64,${data}`;
}

const b = await openBrowser();
try {
  await load(b);
  const fit = await b.evaluate(`(() => {
    const r = document.querySelector('${SEL.cat}').getBoundingClientRect();
    const i = document.querySelector('${SEL.cat} img.base');
    const q = i.getBoundingClientRect();
    return { loaded: i.complete && i.naturalWidth > 0, offset: Math.max(Math.abs(q.x - r.x), Math.abs(q.y - r.y), Math.abs(q.width - r.width), Math.abs(q.height - r.height)) };
  })()`);
  check('the normal photo is loaded and fills the cat frame exactly', fit.loaded && fit.offset < 1, fit);
  const atRest = await shot(b, 'at-rest');
  await click(b);
  await b.evaluate(`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 100; })`);
  const midSniff = await shot(b, 'mid-sniff');
  await b.evaluate(`document.getAnimations().forEach((a) => a.finish())`);

  const diff = await b.evaluate(`(async () => {
    const r = document.querySelector('${SEL.cat}').getBoundingClientRect();
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [a, z] = await Promise.all([img(${JSON.stringify(atRest)}), img(${JSON.stringify(midSniff)})]);
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const A = px(a), Z = px(z), W = a.width;
    const cx = r.x + r.width * 0.525, cy = r.y + r.height * 0.27, rx = r.width * 0.32, ry = r.height * 0.26;
    let outsideChanged = 0, insideChanged = 0, inside = 0;
    for (let y = Math.ceil(r.y); y < Math.floor(r.bottom); y++) for (let x = Math.ceil(r.x); x < Math.floor(r.right); x++) {
      const k = (y * W + x) * 4;
      const changed = Math.abs(A[k] - Z[k]) + Math.abs(A[k + 1] - Z[k + 1]) + Math.abs(A[k + 2] - Z[k + 2]) > 0;
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e > 1.02) { if (changed) outsideChanged++; } else { inside++; if (changed) insideChanged++; }
    }
    return { outsideChanged, insideChangedRatio: +(insideChanged / inside).toFixed(3) };
  })()`);
  check('only the head changes during the sniff (pixels changed outside head oval = 0)', diff.outsideChanged === 0, diff);
  check('the sniff head is visible (>80% of head oval pixels changed)', diff.insideChangedRatio > 0.8, diff);

  await load(b);
  const before = await counts(b);
  for (let i = 0; i < 5; i++) { await click(b); await sleep(50); }
  await sleep(500);
  const after = await counts(b);
  check('5 clicks add 5 to the session count', after.session === before.session + 5, { before, after });
  check('5 clicks add at least 5 to the all-time count', after.global >= before.global + 5, { before, after });
  await load(b);
  const reloaded = await counts(b);
  check('session count survives a reload', reloaded.session === after.session, reloaded);
  check('all-time count survives a reload', reloaded.global >= after.global, reloaded);

  const meow = await b.evaluate(`fetch('/assets/Augustine%20St.m4a').then((r) => r.arrayBuffer()).then((x) => new AudioContext().decodeAudioData(x)).then((a) => a.duration)`);
  check('meow audio decodes', meow > 0, { seconds: +meow.toFixed(2) });
  await shot(b, 'after-clicks');
  await b.close();

  const fresh = await openBrowser();
  await load(fresh);
  const newSession = await counts(fresh);
  check('a new browser session starts the session count at 0', newSession.session === 0, newSession);
  check('the all-time count carries into a new browser session', newSession.global >= reloaded.global, newSession);
  await fresh.close();
} catch (e) {
  check('driver ran to completion', false, String(e.message ?? e));
  await b.close().catch(() => {});
}
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed. Evidence in ${OUT}`);
process.exit(failed ? 1 : 0);
