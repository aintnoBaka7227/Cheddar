import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:5080/' },
    out: { type: 'string', default: '.verify-evidence' },
    port: { type: 'string', default: '9333' },
    'update-reference': { type: 'boolean', default: false },
  },
});
const OUT = resolve(args.out);
await mkdir(OUT, { recursive: true });
const REFERENCE = new URL('../reference/held-sniff-frame.png', import.meta.url).pathname;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`); };

async function openBrowser(profile) {
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
  const listeners = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method) listeners.get(m.method)?.(m.params);
  });
  const on = (method, fn) => listeners.set(method, fn);
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__meowStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { window.__meowStarts++; return start.apply(this, a); };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...rest) {
      if (target instanceof AudioDestinationNode) {
        if (!window.__speakerTap) { window.__speakerTap = this.context.createAnalyser(); window.__speakerTap.fftSize = 2048; }
        connect.call(this, window.__speakerTap);
      }
      return connect.call(this, target, ...rest);
    };
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 860, deviceScaleFactor: 1, mobile: false });
  // Browser.close quits Chrome the way a user does, so it writes persistent cookies to the
  // profile and drops session cookies. A kill would lose both and hide the difference.
  const close = async () => {
    const exited = new Promise((r) => proc.once('exit', r));
    await send('Browser.close').catch(() => {});
    const timer = setTimeout(() => proc.kill(), 5000);
    await exited;
    clearTimeout(timer);
    ws.close();
  };
  return { send, evaluate, on, close };
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

async function key(b, k, { repeats = 0, whileHeld } = {}) {
  const spec = k === 'Enter' ? { key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 } : { key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 };
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', ...spec });
  for (let i = 0; i < repeats; i++) await b.send('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: true, ...spec });
  if (whileHeld) await whileHeld();
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.windowsVirtualKeyCode });
}

const profile = await mkdtemp(join(tmpdir(), 'cheddar-verify-'));
const b = await openBrowser(profile);
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
  const center = await b.evaluate(`(() => { const r = document.querySelector('${SEL.cat}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const mouse = (type, at = center) => b.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
  const headState = () => b.evaluate(`({ opacity: Number(getComputedStyle(document.querySelector('.head')).opacity), running: document.querySelector('.head').getAnimations().filter((a) => a.playState === 'running').length + document.querySelector('.head img').getAnimations().filter((a) => a.playState === 'running').length })`);

  const beforeHold = await counts(b);
  await mouse('mousePressed');
  await sleep(600);
  const held = await headState();
  const duringHold = await counts(b);
  check('holding the press freezes Cheddar at the sniff peak (head fully shown, nothing animating)', held.opacity === 1 && held.running === 0, held);
  check('no count changes while the press is held', duringHold.session === beforeHold.session && duringHold.global === beforeHold.global, { beforeHold, duringHold });
  const base = await b.evaluate(`(() => { const i = document.querySelector('${SEL.cat} img.base'); return { animations: i.getAnimations().length, transform: getComputedStyle(i).transform }; })()`);
  check('the normal photo never moves (no animation, no transform)', base.animations === 0 && base.transform === 'none', base);
  const heldShot = await shot(b, 'held-sniff');
  const frame = await b.evaluate(`(() => { const r = document.querySelector('${SEL.cat}').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }; })()`);
  const { data: frameData } = await b.send('Page.captureScreenshot', { format: 'png', clip: frame });

  await b.evaluate(`(() => { const c = document.querySelector('${SEL.cat}'); document.body.style.background = '#000'; c.style.background = '#000'; c.querySelector('img.base').style.visibility = 'hidden'; c.querySelector('.head img').style.filter = 'brightness(0) invert(1)'; })()`);
  const { data: matteData } = await b.send('Page.captureScreenshot', { format: 'png', clip: frame });
  await b.evaluate(`(() => { const c = document.querySelector('${SEL.cat}'); document.body.style.background = ''; c.style.background = ''; c.querySelector('img.base').style.visibility = ''; c.querySelector('.head img').style.filter = ''; })()`);
  await writeFile(join(OUT, 'held-matte.png'), Buffer.from(matteData, 'base64'));

  const region = await b.evaluate(`(async () => {
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const px = (i, sx = 0, sy = 0, w = i.width, h = i.height) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(i, sx, sy, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const f = ${JSON.stringify(frame)};
    const [m, a, z] = await Promise.all([img('data:image/png;base64,${matteData}'), img(${JSON.stringify(atRest)}), img(${JSON.stringify(heldShot)})]);
    const M = px(m), W = m.width, H = m.height;
    const A = px(a, Math.round(f.x), Math.round(f.y), W, H), Z = px(z, Math.round(f.x), Math.round(f.y), W, H);
    const alpha = (x, y) => M[(Math.round(y) * W + Math.round(x)) * 4] / 255;
    let changedOutside = 0, covered = 0, lowest = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4, al = M[k] / 255;
      if (al > 0.5) { covered++; lowest = y; }
      const changed = Math.abs(A[k] - Z[k]) + Math.abs(A[k + 1] - Z[k + 1]) + Math.abs(A[k + 2] - Z[k + 2]) > 6;
      if (al === 0 && changed) changedOutside++;
    }
    // Points from tip to base of each ear in the normal photo, in its 1200x1600 pixel space.
    const ear = (points) => +Math.min(...points.map(([ix, iy]) => alpha(ix / 1200 * W, iy / 1600 * H))).toFixed(2);
    return { changedOutside, coveredShare: +(covered / (W * H)).toFixed(3), lowestRow: +(lowest / H).toFixed(3), leftEar: ear([[386, 118], [392, 140], [402, 165], [420, 200]]), rightEar: ear([[884, 286], [872, 300], [860, 320]]) };
  })()`);
  check('only the sniff head layer changes the picture (pixels changed by more than 2 levels outside its cut-out = 0)', region.changedOutside === 0, region);
  check('the normal-pose ears are hidden at the sniff peak (cut-out opaque over both ears)', region.leftEar > 0.95 && region.rightEar > 0.95, region);
  check('the sniff head stays above the paws (cut-out ends above 65% of the frame height)', region.lowestRow < 0.65, region);

  if (args['update-reference']) {
    await mkdir(new URL('../reference/', import.meta.url).pathname, { recursive: true });
    await writeFile(REFERENCE, Buffer.from(frameData, 'base64'));
    console.log(`reference updated: ${REFERENCE}`);
  }
  const reference = (await readFile(REFERENCE).catch(() => null))?.toString('base64');
  const match = reference && await b.evaluate(`(async () => {
    const img = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
    const [ref, got, mat] = await Promise.all([img('data:image/png;base64,${reference}'), img('data:image/png;base64,${frameData}'), img('data:image/png;base64,${matteData}')]);
    if (ref.width !== got.width || ref.height !== got.height) return { sizeMismatch: [ref.width, ref.height, got.width, got.height] };
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const R = px(ref), G = px(got), M = px(mat);
    let sum = 0, far = 0, n = 0;
    for (let k = 0; k < R.length; k += 4) {
      if (M[k] < 128) continue;
      const d = (Math.abs(R[k] - G[k]) + Math.abs(R[k + 1] - G[k + 1]) + Math.abs(R[k + 2] - G[k + 2])) / 3;
      sum += d; n++; if (d > 48) far++;
    }
    return { meanDiff: +(sum / n).toFixed(2), farPixels: +(far / n).toFixed(4) };
  })()`);
  check('the held sniff head matches the approved reference (mean diff < 4, <2% pixels far off)', !!match && !match.sizeMismatch && match.meanDiff < 4 && match.farPixels < 0.02, match ?? 'no reference image; run once with --update-reference after approving held-sniff.png');

  await mouse('mouseReleased');
  await sleep(500);
  const released = await headState();
  const afterRelease = await counts(b);
  check('releasing over Cheddar counts once and settles the head back', afterRelease.session === beforeHold.session + 1 && afterRelease.global >= beforeHold.global + 1 && released.opacity === 0 && released.running === 0, { afterRelease, released });

  await mouse('mousePressed');
  await mouse('mouseReleased');
  await sleep(120);
  const tapMid = await headState();
  await sleep(600);
  const tapEnd = await headState();
  check('a quick tap still shows the sniff and then settles back', tapMid.opacity > 0.9 && tapEnd.opacity === 0 && tapEnd.running === 0, { tapMid, tapEnd });

  const beforeAway = await counts(b);
  await mouse('mousePressed');
  await sleep(300);
  await mouse('mouseMoved', { x: 5, y: 5 });
  await mouse('mouseReleased', { x: 5, y: 5 });
  await sleep(600);
  const afterAway = await counts(b);
  const awayHead = await headState();
  check('releasing away from Cheddar cancels without counting', afterAway.session === beforeAway.session && afterAway.global === beforeAway.global && awayHead.opacity === 0, { beforeAway, afterAway, awayHead });

  await load(b);
  await click(b);
  const heard = await b.evaluate(`new Promise((done) => {
    const tap = window.__speakerTap, buf = new Float32Array(2048), t0 = performance.now();
    let peak = 0, firstLoudMs = null;
    (function sample() {
      const now = performance.now() - t0;
      if (tap) { tap.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); }
      if (firstLoudMs === null && peak > 0.2) firstLoudMs = Math.round(now);
      if (now < 600) setTimeout(sample, 10); else done({ tapped: !!tap, peak: +peak.toFixed(3), firstLoudMs });
    })();
  })`);
  check('the meow reaches the speakers loudly within 300ms of a click (peak > 0.2 of full scale)', heard.tapped && heard.firstLoudMs !== null && heard.firstLoudMs <= 300, heard);
  await sleep(4000);

  await load(b);
  const before = await counts(b);
  const meowsBefore = await b.evaluate('window.__meowStarts');
  for (let i = 0; i < 5; i++) { await click(b); await sleep(50); }
  await sleep(500);
  const after = await counts(b);
  const meows = (await b.evaluate('window.__meowStarts')) - meowsBefore;
  check('each of 5 clicks starts one meow', meows === 5, { meows });
  check('5 clicks add 5 to the session count', after.session === before.session + 5, { before, after });
  check('5 clicks add at least 5 to the all-time count', after.global >= before.global + 5, { before, after });
  await load(b);
  const reloaded = await counts(b);
  check('session count survives a reload', reloaded.session === after.session, reloaded);
  check('all-time count survives a reload', reloaded.global >= after.global, reloaded);

  await b.evaluate(`document.querySelector('${SEL.cat}').focus()`);
  let k0 = await counts(b);
  let kHeld;
  await key(b, 'Enter', { repeats: 3, whileHeld: async () => { await sleep(300); kHeld = await counts(b); } });
  await sleep(300);
  let k1 = await counts(b);
  check('holding Enter (1 press + 3 auto-repeats) counts once, on release', kHeld.session === k0.session && k1.session === k0.session + 1, { before: k0.session, whileHeld: kHeld.session, after: k1.session });
  await key(b, ' ', { repeats: 3 });
  await sleep(300);
  let k2 = await counts(b);
  check('holding Space (1 press + 3 auto-repeats) counts once', k2.session === k1.session + 1, { before: k1.session, after: k2.session });

  await b.evaluate(`document.querySelector('${SEL.cat}').click()`);
  await sleep(300);
  const at = await counts(b);
  check('a bare click event, as assistive tech sends, counts once', at.session === k2.session + 1, { before: k2.session, after: at.session });

  await b.evaluate(`document.cookie = 'cheddar_session=${at.session + 10}; path=/; SameSite=Lax'`);
  await click(b);
  await sleep(300);
  const tabs = await counts(b);
  check('a click adds to session clicks another tab wrote to the cookie', tabs.session === at.session + 11, { otherTabWrote: at.session + 10, after: tabs.session });

  await b.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/counts/global/increment' }] });
  b.on('Fetch.requestPaused', ({ requestId }) => b.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }));
  await click(b);
  await sleep(600);
  await b.send('Fetch.disable');
  const shownAfterFail = (await counts(b)).global;
  const server = await b.evaluate(`fetch('/api/counts/global').then((r) => r.json()).then((j) => j.count)`);
  check('a failed increment shows the server total, not a phantom click', shownAfterFail === server, { shown: shownAfterFail, server });

  const meow = await b.evaluate(`fetch('/assets/Augustine%20St.m4a').then((r) => r.arrayBuffer()).then((x) => new AudioContext().decodeAudioData(x)).then((a) => a.duration)`);
  check('meow audio decodes', meow > 0, { seconds: +meow.toFixed(2) });
  await shot(b, 'after-clicks');
  await b.close();

  const fresh = await openBrowser(profile);
  await load(fresh);
  const newSession = await counts(fresh);
  check('quitting and relaunching Chrome on the same profile resets the session count to 0', newSession.session === 0, newSession);
  check('the all-time count carries into a new browser session', newSession.global >= reloaded.global, newSession);
  await fresh.close();
} catch (e) {
  check('driver ran to completion', false, String(e.message ?? e));
  await b.close().catch(() => {});
}
await rm(profile, { recursive: true, force: true });
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed. Evidence in ${OUT}`);
process.exit(failed ? 1 : 0);
