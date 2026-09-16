/* ═══════════════════════════════════════════════════════
   AURORA — Landing + Player
   ═══════════════════════════════════════════════════════ */

document.getElementById('year').textContent = new Date().getFullYear();

/* ───────────────────────────────────────────
   Toast helper
   ─────────────────────────────────────────── */
let toastEl;
function toast(msg, duration = 2400) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), duration);
}

/* ───────────────────────────────────────────
   Button click ripple
   ─────────────────────────────────────────── */
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 50);
    });
});

/* ───────────────────────────────────────────
   PLACEHOLDER DOWNLOAD BUTTONS
   ─────────────────────────────────────────── */
document.getElementById('apkBtn').addEventListener('click', () => {
    toast('📱 <span class="accent">Android APK</span> coming soon — build in progress!');
    // When ready, replace with:
    // window.location.href = 'downloads/aurora.apk';
});

document.getElementById('exeBtn').addEventListener('click', () => {
    toast('💻 <span class="accent">Windows EXE</span> coming soon — build in progress!');
    // When ready, replace with:
    // window.location.href = 'downloads/aurora-setup.exe';
});

/* ───────────────────────────────────────────
   HERO ambient background canvas
   ─────────────────────────────────────────── */
(function heroBg() {
    const c = document.getElementById('bgCanvas');
    const x = c.getContext('2d');
    let W, H, DPR;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = c.width  = c.offsetWidth  * DPR;
        H = c.height = c.offsetHeight * DPR;
    }
    resize();
    window.addEventListener('resize', resize);

    const orbs = Array.from({ length: 5 }, () => ({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0006,
        vy: (Math.random() - 0.5) * 0.0006,
        r: 0.25 + Math.random() * 0.25,
        hue: 250 + Math.random() * 80
    }));

    let t = 0;
    function loop() {
        t += 0.006;
        x.fillStyle = '#05060a';
        x.fillRect(0, 0, W, H);

        orbs.forEach((o, i) => {
            o.x += o.vx; o.y += o.vy;
            if (o.x < 0 || o.x > 1) o.vx *= -1;
            if (o.y < 0 || o.y > 1) o.vy *= -1;

            const cx = o.x * W;
            const cy = o.y * H;
            const r  = o.r * Math.min(W, H) * (1 + Math.sin(t + i) * 0.15);

            const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, `hsla(${o.hue + t * 30}, 100%, 60%, 0.35)`);
            g.addColorStop(1, 'transparent');
            x.fillStyle = g;
            x.beginPath();
            x.arc(cx, cy, r, 0, Math.PI * 2);
            x.fill();
        });

        requestAnimationFrame(loop);
    }
    loop();
})();

/* ═══════════════════════════════════════════════════════
   PLAYER + VISUALIZER
   ═══════════════════════════════════════════════════════ */

const playerSection = document.getElementById('playerSection');
const playNowBtn    = document.getElementById('playNowBtn');
const backBtn       = document.getElementById('backBtn');

let visualizerRunning = false;

playNowBtn.addEventListener('click', () => {
    playerSection.classList.add('active');
    document.body.classList.add('locked');
    if (!visualizerRunning) {
        visualizerRunning = true;
        initVisualizer();
    }
});

backBtn.addEventListener('click', () => {
    playerSection.classList.remove('active');
    document.body.classList.remove('locked');
});

/* ── Canvas + Audio setup ── */
const canvas = document.getElementById('visualizer');
const ctx    = canvas.getContext('2d');

let W, H, DPR;
function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width  = window.innerWidth  * DPR;
    H = canvas.height = window.innerHeight * DPR;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 0.82;

const gainNode = audioCtx.createGain();
gainNode.gain.value = 0.8;
analyser.connect(gainNode);
gainNode.connect(audioCtx.destination);

const freqData = new Uint8Array(analyser.frequencyBinCount);
const timeData = new Uint8Array(analyser.fftSize);

const audioEl  = new Audio();
audioEl.crossOrigin = 'anonymous';
const sourceEl = audioCtx.createMediaElementSource(audioEl);
sourceEl.connect(analyser);

let micStream = null;
let micSource = null;

/* ── UI elements ── */
const fileInput     = document.getElementById('fileInput');
const playBtn       = document.getElementById('playBtn');
const playIcon      = document.getElementById('playIcon');
const seek          = document.getElementById('seek');
const time          = document.getElementById('time');
const volume        = document.getElementById('volume');
const micBtn        = document.getElementById('micBtn');
const modeBtn       = document.getElementById('modeBtn');
const trackName     = document.getElementById('trackName');
const trackMeta     = document.getElementById('trackMeta');
const hint          = document.getElementById('hint');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const playPath  = 'M8 5v14l11-7z';
const pausePath = 'M6 5h4v14H6zM14 5h4v14h-4z';

let mode = 0;
const modes = ['◉ Bars', '◎ Radial', '〜 Wave', '✧ Particles'];
let particles = [];
let barPeaks  = new Float32Array(128);

/* ── File upload ── */
fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadFile(file);
});

function loadFile(file) {
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    trackName.textContent = file.name.replace(/\.[^/.]+$/, '');
    trackMeta.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type.split('/')[1] || 'audio'}`;
    hint.classList.add('hidden');
    audioCtx.resume();
    audioEl.play();
    playIcon.querySelector('path').setAttribute('d', pausePath);
}

/* ── Play / pause ── */
playBtn.addEventListener('click', () => {
    if (micStream) { stopMic(); return; }
    if (!audioEl.src) return;
    if (audioEl.paused) {
        audioCtx.resume();
        audioEl.play();
        playIcon.querySelector('path').setAttribute('d', pausePath);
    } else {
        audioEl.pause();
        playIcon.querySelector('path').setAttribute('d', playPath);
    }
});

audioEl.addEventListener('ended', () => {
    playIcon.querySelector('path').setAttribute('d', playPath);
});

/* ── Seek ── */
audioEl.addEventListener('loadedmetadata', () => {
    seek.max = audioEl.duration;
    updateTime();
});
audioEl.addEventListener('timeupdate', () => {
    seek.value = audioEl.currentTime;
    updateTime();
});
seek.addEventListener('input', () => {
    audioEl.currentTime = parseFloat(seek.value);
});

function updateTime() {
    const fmt = s => {
        if (!isFinite(s)) return '0:00';
        const m   = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };
    time.textContent = `${fmt(audioEl.currentTime)} / ${fmt(audioEl.duration)}`;
}

/* ── Volume ── */
volume.addEventListener('input', () => {
    gainNode.gain.value = parseFloat(volume.value);
});

/* ── Mic ── */
async function getMicStream() {
    const constraints = {
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    };
    if (navigator.mediaDevices?.getUserMedia) {
        return navigator.mediaDevices.getUserMedia(constraints);
    }
    const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia;
    if (legacy) return new Promise((res, rej) => legacy.call(navigator, constraints, res, rej));
    throw new Error('Microphone API not available');
}

micBtn.addEventListener('click', async () => {
    if (micStream) { stopMic(); return; }
    try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        micStream  = await getMicStream();
        micSource  = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(analyser);
        audioEl.pause();
        trackName.textContent = 'Live Microphone';
        trackMeta.textContent = 'Streaming real-time input';
        hint.classList.add('hidden');
        micBtn.classList.add('active');
        micBtn.textContent = '⏹ Stop Mic';
        playIcon.querySelector('path').setAttribute('d', pausePath);
    } catch (err) {
        toast('❌ Mic access denied: ' + err.message);
    }
});

function stopMic() {
    if (micSource) micSource.disconnect();
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    micStream = null; micSource = null;
    micBtn.classList.remove('active');
    micBtn.textContent = '🎤 Use Mic';
    playIcon.querySelector('path').setAttribute('d', playPath);
}

/* ── Mode switch ── */
modeBtn.addEventListener('click', () => {
    mode = (mode + 1) % modes.length;
    modeBtn.textContent = modes[mode];
    barPeaks.fill(0);
});

/* ── Fullscreen ── */
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
});

/* ── Particles ── */
function initParticles() {
    particles = [];
    const count = 160;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.6,
            hue: Math.random() * 60 + 250
        });
    }
}
window.addEventListener('resize', initParticles);

/* ── Rendering ── */
let rotation = 0;
let hueShift = 0;

function draw() {
    if (!visualizerRunning) return;
    requestAnimationFrame(draw);

    ctx.fillStyle = 'rgba(5,6,10,0.22)';
    ctx.fillRect(0, 0, W, H);

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    hueShift += 0.25;
    rotation += 0.004;

    const avg    = freqData.reduce((a, b) => a + b, 0) / freqData.length;
    const energy = avg / 255;

    if      (mode === 0) drawBars(energy);
    else if (mode === 1) drawRadial(energy);
    else if (mode === 2) drawWave(energy);
    else                 drawParticles(energy);
}

function drawBars(energy) {
    const bars  = 128;
    const step  = Math.floor(freqData.length / bars);
    const gap   = 2 * DPR;
    const barW  = (W - gap * (bars + 1)) / bars;
    const maxH  = H * 0.75;

    for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += freqData[i * step + j];
        let v = (sum / step) / 255;
        v = Math.pow(v, 1.4);

        const h = v * maxH;
        const x = gap + i * (barW + gap);
        const y = H - h - H * 0.08;

        if (v > barPeaks[i]) barPeaks[i] = v;
        else barPeaks[i] *= 0.985;

        const hue  = (i / bars) * 80 + hueShift % 360 + 250;
        const grad = ctx.createLinearGradient(x, y, x, H);
        grad.addColorStop(0,   `hsla(${hue}, 100%, 70%, 0.95)`);
        grad.addColorStop(0.5, `hsla(${hue + 30}, 100%, 55%, 0.75)`);
        grad.addColorStop(1,   `hsla(${hue + 60}, 100%, 40%, 0.15)`);

        ctx.shadowBlur  = 18 * DPR * v;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
        ctx.fillStyle   = grad;
        ctx.fillRect(x, y, barW, h);

        const py = H - barPeaks[i] * maxH - H * 0.08 - 4 * DPR;
        ctx.shadowBlur = 12 * DPR;
        ctx.fillStyle  = `hsla(${hue + 40}, 100%, 80%, 0.95)`;
        ctx.fillRect(x, py, barW, 3 * DPR);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, 1)`;
        ctx.fillRect(x, H - H * 0.08 + 4 * DPR, barW, Math.min(h * 0.35, H * 0.15));
        ctx.globalAlpha = 1;
    }
}

function drawRadial(energy) {
    const cx = W / 2, cy = H / 2;
    const bars    = 180;
    const step    = Math.floor(freqData.length / bars);
    const baseR   = Math.min(W, H) * 0.16;
    const maxLen  = Math.min(W, H) * 0.32;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 1.4);
    coreGrad.addColorStop(0, `hsla(${hueShift % 360 + 260}, 100%, 70%, ${0.35 + energy * 0.5})`);
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 1.4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += freqData[i * step + j];
        let v = (sum / step) / 255;
        v = Math.pow(v, 1.5);

        const angle = (i / bars) * Math.PI * 2;
        const len   = baseR + v * maxLen;
        const x1 = Math.cos(angle) * baseR;
        const y1 = Math.sin(angle) * baseR;
        const x2 = Math.cos(angle) * len;
        const y2 = Math.sin(angle) * len;

        const hue = (i / bars) * 360 + hueShift % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, ${55 + v * 25}%, ${0.35 + v * 0.65})`;
        ctx.lineWidth   = (2 + v * 3) * DPR;
        ctx.shadowBlur  = 16 * DPR * v;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = `hsla(${hueShift % 360 + 260}, 100%, 75%, 0.6)`;
    ctx.lineWidth   = 2 * DPR;
    ctx.shadowBlur  = 24 * DPR;
    ctx.shadowColor = `hsla(${hueShift % 360 + 260}, 100%, 65%, 1)`;
    ctx.beginPath();
    ctx.arc(0, 0, baseR * (1 + energy * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawWave(energy) {
    const mid = H * 0.5;
    const amp = H * 0.28;

    for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        const hue = (hueShift + layer * 25) % 360 + 250;
        ctx.strokeStyle = `hsla(${hue}, 100%, ${60 + layer * 5}%, ${0.9 - layer * 0.18})`;
        ctx.lineWidth   = (3 - layer * 0.5) * DPR;
        ctx.shadowBlur  = 20 * DPR;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;

        for (let i = 0; i < timeData.length; i += 2) {
            const x = (i / timeData.length) * W;
            const t = (timeData[i] - 128) / 128;
            const y = mid + t * amp * (1 + energy * 0.5) + Math.sin(i * 0.01 + layer) * 10 * DPR;
            if (i === 0) ctx.moveTo(x, y);
            else         ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawParticles(energy) {
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.45;

    for (let p of particles) {
        const dx = p.x - cx, dy = p.y - cy;
        const dist  = Math.hypot(dx, dy) || 1;
        const force = energy * 3 + 0.3;
        p.vx += (dx / dist) * force * 0.3;
        p.vy += (dy / dist) * force * 0.3;
        p.vx *= 0.96; p.vy *= 0.96;
        p.x  += p.vx; p.y  += p.vy;

        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

        const hue = (p.hue + hueShift) % 360;
        const r   = p.r * (1 + energy * 2) * DPR;
        ctx.fillStyle   = `hsla(${hue}, 100%, 70%, ${0.35 + energy * 0.55})`;
        ctx.shadowBlur  = 15 * DPR * energy;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grad.addColorStop(0, `hsla(${hueShift % 360 + 260}, 100%, 65%, ${energy * 0.4})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Init visualizer (lazy) ── */
function initVisualizer() {
    resize();
    initParticles();
    draw();
}

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
    if (!playerSection.classList.contains('active')) return;
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    if (e.key === 'm' || e.key === 'M') modeBtn.click();
    if (e.key === 'f' || e.key === 'F') fullscreenBtn.click();
    if (e.key === 'Escape') backBtn.click();
});

/* ── Drag & drop anywhere ── */
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        if (!playerSection.classList.contains('active')) playNowBtn.click();
        setTimeout(() => loadFile(file), 200);
    }
});