const SESSION_COOKIE = 'cheddar_session';
const MEOW_URL = '/assets/Augustine%20St.m4a';
const ACTIVATION_KEYS = new Set(['Enter', ' ']);

let audio;
let meowBuffer;
let meowStart = 0;
let meowGain = 1;
let sessionCount = 0;
let globalCount = 0;

function readSessionCount() {
    const match = document.cookie.split('; ').find(c => c.startsWith(SESSION_COOKIE + '='));
    const n = match ? Number.parseInt(match.slice(SESSION_COOKIE.length + 1), 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeSessionCount(n) {
    // No Expires or Max-Age on purpose: the browser drops it when it quits.
    document.cookie = `${SESSION_COOKIE}=${n}; path=/; SameSite=Lax`;
}

// The sniff head grows from resting-head size toward the camera, overshooting slightly, and
// stays at the peak while the press is held. Release settles it back.
const HEAD_REST = 'translate(-0.8%, -4.25%) scale(0.6)';
const HEAD_PEAK = 'translate(-0.8%, -4.25%) scale(1.05)';
const SPRING = 'cubic-bezier(.34, 1.4, .5, 1)';
const REACH_MS = 190;
const MIN_HOLD_MS = 70;
const SETTLE_MS = 160;

function reach(head, headImg) {
    return Promise.all([
        headImg.animate([{ transform: HEAD_REST }, { transform: HEAD_PEAK }], { duration: REACH_MS, easing: SPRING, fill: 'forwards' }).finished,
        head.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], { duration: REACH_MS, fill: 'forwards' }).finished,
    ]).then(() => new Promise(r => setTimeout(r, MIN_HOLD_MS)));
}

function settle(head, headImg) {
    return Promise.all([
        headImg.animate([{ transform: HEAD_PEAK }, { transform: HEAD_REST }], { duration: SETTLE_MS, easing: SPRING, fill: 'forwards' }).finished,
        head.animate([{ opacity: 1 }, { opacity: 1, offset: 0.26 }, { opacity: 0 }], { duration: SETTLE_MS, fill: 'forwards' }).finished,
    ]);
}

function stopSniff(head, headImg) {
    for (const a of [...head.getAnimations(), ...headImg.getAnimations()]) a.cancel();
}

function meow() {
    if (!audio || !meowBuffer) return;
    if (audio.state === 'suspended') audio.resume();
    const source = audio.createBufferSource();
    source.buffer = meowBuffer;
    const gain = audio.createGain();
    gain.gain.value = meowGain;
    source.connect(gain).connect(audio.destination);
    source.start(0, meowStart);
}

// The recording is mostly near-silence with a quiet meow near its end, so play from just
// before the first loud sample and scale the peak to near full volume.
function measureMeow(buffer) {
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
    }
    if (peak === 0) return;
    let onset = buffer.length;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const i = buffer.getChannelData(c).findIndex(v => Math.abs(v) >= peak / 4);
        if (i >= 0) onset = Math.min(onset, i);
    }
    meowStart = Math.max(0, onset / buffer.sampleRate - 0.05);
    meowGain = Math.min(0.9 / peak, 40);
}

async function loadMeow() {
    try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        const bytes = await (await fetch(MEOW_URL)).arrayBuffer();
        meowBuffer = await audio.decodeAudioData(bytes);
        measureMeow(meowBuffer);
    } catch (e) {
        console.warn('Meow unavailable', e);
    }
}

async function loadGlobalCount() {
    const res = await fetch('/api/counts/global');
    return (await res.json()).count;
}

export async function init() {
    const head = document.querySelector('.cheddar .head');
    const button = document.querySelector('button.cheddar');
    const sessionEl = document.getElementById('session-count');
    const globalEl = document.getElementById('global-count');

    sessionCount = readSessionCount();
    sessionEl.textContent = String(sessionCount);

    const headImg = head.querySelector('img');

    async function count() {
        sessionCount = readSessionCount() + 1;
        sessionEl.textContent = String(sessionCount);
        writeSessionCount(sessionCount);
        globalCount += 1;
        globalEl.textContent = String(globalCount);
        try {
            const res = await fetch('/api/counts/global/increment', { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            globalCount = Math.max(globalCount, (await res.json()).count);
            globalEl.textContent = String(globalCount);
        } catch (e) {
            console.warn('Increment failed', e);
            try {
                globalCount = await loadGlobalCount();
            } catch {
                globalCount -= 1;
            }
            globalEl.textContent = String(globalCount);
        }
    }

    // One press at a time: null when idle, otherwise who is holding Cheddar and when the
    // reach (plus its minimum hold) is done. A release counts only if it completes the press.
    let press = null;

    function pressStart(by) {
        stopSniff(head, headImg);
        meow();
        const reached = reach(head, headImg).catch(() => {});
        press = { by, reached };
    }

    async function pressEnd(completed) {
        if (!press) return;
        const ended = press;
        press = null;
        if (completed) count();
        await ended.reached;
        if (press) return;
        try {
            await settle(head, headImg);
        } catch {
            return;
        }
        if (!press) stopSniff(head, headImg);
    }

    function overButton(e) {
        const r = button.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }

    button.addEventListener('pointerdown', e => {
        if (e.button !== 0 || press) return;
        button.setPointerCapture(e.pointerId);
        pressStart({ pointerId: e.pointerId });
    });
    button.addEventListener('pointerup', e => {
        if (press?.by.pointerId === e.pointerId) pressEnd(overButton(e));
    });
    // A touch that turns into a scroll, or a capture lost to the browser, is not a click.
    button.addEventListener('pointercancel', e => {
        if (press?.by.pointerId === e.pointerId) pressEnd(false);
    });
    button.addEventListener('lostpointercapture', e => {
        if (press?.by.pointerId === e.pointerId) pressEnd(false);
    });

    // Enter and Space press on keydown and complete on keyup. Their default activation is
    // suppressed on every keydown (auto-repeat included) and keyup, and any click a browser
    // still sends for that key is ignored, so holding a key never auto-clicks.
    let keyActivation = false;
    button.addEventListener('keydown', e => {
        if (!ACTIVATION_KEYS.has(e.key)) return;
        e.preventDefault();
        keyActivation = true;
        if (!e.repeat && !press) pressStart({ key: e.key });
    });
    button.addEventListener('keyup', e => {
        if (!ACTIVATION_KEYS.has(e.key)) return;
        e.preventDefault();
        if (press?.by.key === e.key) pressEnd(true);
        setTimeout(() => { keyActivation = false; });
    });
    button.addEventListener('blur', () => {
        keyActivation = false;
        if (press?.by.key) pressEnd(false);
    });
    // Assistive tech can activate the button with a bare click event (detail 0).
    button.addEventListener('click', e => {
        if (e.detail !== 0 || keyActivation || press) return;
        pressStart({ assistive: true });
        pressEnd(true);
    });

    await Promise.all([
        loadMeow(),
        loadGlobalCount().then(n => {
            globalCount = Math.max(globalCount, n);
            globalEl.textContent = String(globalCount);
        }, e => console.warn('Global count unavailable', e)),
    ]);
    document.documentElement.dataset.cheddarReady = 'true';
}
