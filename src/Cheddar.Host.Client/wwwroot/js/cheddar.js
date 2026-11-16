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

function sniff(head) {
    head.classList.remove('sniffing');
    void head.offsetWidth;
    head.classList.add('sniffing');
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

    head.addEventListener('animationend', () => head.classList.remove('sniffing'));

    async function click() {
        sniff(head);
        meow();
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

    button.addEventListener('pointerdown', e => {
        if (e.button === 0) click();
    });
    // A key press sniffs once on keydown. Its own default activation is suppressed on every
    // keydown (auto-repeat included) and keyup, and any click a browser still sends for that
    // key is ignored, so holding a key never auto-clicks into the shared total.
    let keyActivation = false;
    button.addEventListener('keydown', e => {
        if (!ACTIVATION_KEYS.has(e.key)) return;
        e.preventDefault();
        keyActivation = true;
        if (!e.repeat) click();
    });
    button.addEventListener('keyup', e => {
        if (!ACTIVATION_KEYS.has(e.key)) return;
        e.preventDefault();
        setTimeout(() => { keyActivation = false; });
    });
    // Assistive tech can activate the button with a bare click event (detail 0).
    button.addEventListener('click', e => {
        if (e.detail === 0 && !keyActivation) click();
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
