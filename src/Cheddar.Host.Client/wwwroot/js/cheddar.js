const SESSION_COOKIE = 'cheddar_session';
const MEOW_URL = '/assets/Augustine%20St.m4a';

let audio;
let meowBuffer;
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
    source.connect(audio.destination);
    source.start();
}

async function loadMeow() {
    try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        const bytes = await (await fetch(MEOW_URL)).arrayBuffer();
        meowBuffer = await audio.decodeAudioData(bytes);
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
        sessionCount += 1;
        sessionEl.textContent = String(sessionCount);
        writeSessionCount(sessionCount);
        globalCount += 1;
        globalEl.textContent = String(globalCount);
        try {
            const res = await fetch('/api/counts/global/increment', { method: 'POST' });
            globalCount = Math.max(globalCount, (await res.json()).count);
            globalEl.textContent = String(globalCount);
        } catch (e) {
            console.warn('Increment failed', e);
        }
    }

    button.addEventListener('pointerdown', e => {
        if (e.button === 0) click();
    });
    button.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            click();
        }
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
