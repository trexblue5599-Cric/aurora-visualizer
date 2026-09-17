/* ═══════════════════════════════════════════════════════
   AURORA — Landing + Player (Part 1/2)
   ═══════════════════════════════════════════════════════ */

document.getElementById('year').textContent = new Date().getFullYear();

/* ── Toast ── */
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

/* ── Ripple on buttons ── */
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.add('clicked');
        setTimeout(() => btn.classList.remove('clicked'), 50);
    });
});

/* ── Placeholder downloads ── */
document.getElementById('apkBtn').addEventListener('click', () => {
    toast('📱 <span class="accent">Android APK</span> coming soon!');
});
document.getElementById('exeBtn').addEventListener('click', () => {
    toast('💻 <span class="accent">Windows EXE</span> coming soon!');
});

/* ── Hero background orbs ── */
(function heroBg() {
    const c = document.getElementById('bgCanvas');
    if (!c) return;
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
    (function loop() {
        t += 0.006;
        x.fillStyle = '#05060a';
        x.fillRect(0, 0, W, H);

        orbs.forEach((o, i) => {
            o.x += o.vx; o.y += o.vy;
            if (o.x < 0 || o.x > 1) o.vx *= -1;
            if (o.y < 0 || o.y > 1) o.vy *= -1;

            const cx = o.x * W, cy = o.y * H;
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
    })();
})();

/* ═══════════════════════════════════════════════════════
   PLAYER
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

/* ── Canvas + Audio ── */
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

/* ── UI ── */
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
const modes = ['◉ Bars', '◎ Radial', '〜 Wave', '✦ Nebula'];
let stars    = [];
let streaks  = [];
let barPeaks = new Float32Array(128);

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

/* ── Play/pause ── */
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
        micStream = await getMicStream();
        micSource = audioCtx.createMediaStreamSource(micStream);
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

/* ── Nebula entities ── */
function initStars() {
    stars = [];
    streaks = [];
    const count = 220;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.42;
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * maxR;
        stars.push({
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
            vx: 0, vy: 0,
            size: Math.random() * 1.6 + 0.4,
            hue: 240 + Math.random() * 100,
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.02 + Math.random() * 0.05
        });
    }
}

function spawnStreak(bass) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (2 + bass * 6) * DPR;
    streaks.push({
        x: W / 2, y: H / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: 240 + Math.random() * 120,
        length: 40 + Math.random() * 60
    });
}

window.addEventListener('resize', () => { initStars(); });
/* ── Render loop ── */
let rotation = 0;
let hueShift = 0;
let lastBass = 0;

function draw() {
    if (!visualizerRunning) return;
    requestAnimationFrame(draw);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5,6,10,0.18)';
    ctx.fillRect(0, 0, W, H);

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    hueShift += 0.08;
    rotation += 0.004;

    let sumAll = 0;
    for (let i = 0; i < freqData.length; i++) sumAll += freqData[i];
    const energy = sumAll / freqData.length / 255;

    let bassSum = 0;
    for (let i = 0; i < 10; i++) bassSum += freqData[i];
    const bass = bassSum / 10 / 255;

    let trebleSum = 0;
    const tStart = Math.floor(freqData.length * 0.7);
    for (let i = tStart; i < freqData.length; i++) trebleSum += freqData[i];
    const treble = trebleSum / (freqData.length - tStart) / 255;

    if (bass - lastBass > 0.15 && bass > 0.35) {
        for (let k = 0; k < 3; k++) spawnStreak(bass);
    }
    lastBass = bass;

    if      (mode === 0) drawBars(energy);
    else if (mode === 1) drawRadial(energy);
    else if (mode === 2) drawWave(energy);
    else                 drawNebula(energy, bass, treble);
}

/* ═══════════════════════════════════════════
   MODE 0 — BARS
   ═══════════════════════════════════════════ */
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
    ctx.shadowBlur = 0;
}

/* ═══════════════════════════════════════════
   MODE 1 — RADIAL
   ═══════════════════════════════════════════ */
function drawRadial(energy) {
    const cx = W / 2, cy = H / 2;
    const bars   = 128;
    const step   = Math.floor(freqData.length / bars);
    const baseR  = Math.min(W, H) * 0.16;
    const maxLen = Math.min(W, H) * 0.32;

    if (!drawRadial.prev || drawRadial.prev.length !== bars) {
        drawRadial.prev = new Float32Array(bars);
    }
    const prev = drawRadial.prev;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    ctx.shadowBlur = 0;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 1.4);
    coreGrad.addColorStop(0, `hsla(${(hueShift * 0.4) % 360 + 260}, 100%, 70%, ${0.35 + energy * 0.5})`);
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

        prev[i] += (v - prev[i]) * 0.35;
        const smoothed = prev[i];

        const angle = (i / bars) * Math.PI * 2;
        const len   = baseR + smoothed * maxLen;
        const x1 = Math.cos(angle) * baseR;
        const y1 = Math.sin(angle) * baseR;
        const x2 = Math.cos(angle) * len;
        const y2 = Math.sin(angle) * len;

        const hue = (i / bars) * 360 + (hueShift * 0.4) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, ${55 + smoothed * 25}%, ${0.35 + smoothed * 0.65})`;
        ctx.lineWidth   = (2 + smoothed * 3) * DPR;
        ctx.shadowBlur  = 14 * DPR * smoothed;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `hsla(${(hueShift * 0.4) % 360 + 260}, 100%, 75%, 0.6)`;
    ctx.lineWidth   = 2 * DPR;
    ctx.shadowBlur  = 18 * DPR;
    ctx.shadowColor = `hsla(${(hueShift * 0.4) % 360 + 260}, 100%, 65%, 1)`;
    ctx.beginPath();
    ctx.arc(0, 0, baseR * (1 + energy * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
}

/* ═══════════════════════════════════════════
   MODE 2 — WAVE
   ═══════════════════════════════════════════ */
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
    ctx.shadowBlur = 0;
}

/* ═══════════════════════════════════════════
   MODE 3 — NEBULA
   ═══════════════════════════════════════════ */
function drawNebula(energy, bass, treble) {
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.5;

    /* 1. Rotating nebula cloud */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation * 0.6);

    const cloudR = maxR * (0.55 + bass * 0.5);
    const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, cloudR);
    const h1 = (hueShift * 0.6) % 360 + 250;
    const h2 = (hueShift * 0.6) % 360 + 320;
    cloud.addColorStop(0,    `hsla(${h1}, 100%, 65%, ${0.12 + energy * 0.35})`);
    cloud.addColorStop(0.45, `hsla(${h2}, 100%, 55%, ${0.06 + energy * 0.22})`);
    cloud.addColorStop(1,    'transparent');
    ctx.shadowBlur = 0;
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.arc(0, 0, cloudR, 0, Math.PI * 2);
    ctx.fill();

    for (let s = 0; s < 5; s++) {
        const arcR = cloudR * (0.35 + s * 0.14);
        const hue = (h1 + s * 30) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.05 + energy * 0.25})`;
        ctx.lineWidth = (1 + treble * 2) * DPR;
        ctx.shadowBlur = 14 * DPR * (0.3 + energy);
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.7)`;
        ctx.beginPath();
        ctx.arc(0, 0, arcR, s * 1.2, s * 1.2 + Math.PI * 1.4);
        ctx.stroke();
    }
    ctx.restore();

    /* 2. Stars */
    for (let s of stars) {
        const dx = s.x - cx, dy = s.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;

        const push = 0.05 + bass * 1.4;
        s.vx += nx * push * 0.3;
        s.vy += ny * push * 0.3;

        const swirl = 0.12 + treble * 0.8;
        s.vx += -ny * swirl * 0.15;
        s.vy +=  nx * swirl * 0.15;

        s.vx *= 0.96;
        s.vy *= 0.96;

        s.x += s.vx;
        s.y += s.vy;

        if (dist > maxR) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * maxR * 0.15;
            s.x = cx + Math.cos(a) * r;
            s.y = cy + Math.sin(a) * r;
            s.vx = 0; s.vy = 0;
        }

        s.twinkle += s.twinkleSpeed + treble * 0.15;
        const tw = 0.55 + Math.sin(s.twinkle) * 0.45;

        const hue = (s.hue + hueShift * 0.5) % 360;
        const size = s.size * (1 + bass * 2) * DPR;

        ctx.fillStyle = `hsla(${hue}, 100%, 82%, ${tw * (0.6 + energy * 0.4)})`;
        ctx.shadowBlur = 8 * DPR * (0.4 + energy);
        ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.9)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    /* 3. Streaks */
    ctx.shadowBlur = 0;
    for (let i = streaks.length - 1; i >= 0; i--) {
        const st = streaks[i];
        st.x += st.vx;
        st.y += st.vy;
        st.vx *= 0.97;
        st.vy *= 0.97;
        st.life -= 0.02;

        if (st.life <= 0) {
            streaks.splice(i, 1);
            continue;
        }

        const backX = st.x - st.vx * st.length * 0.4;
        const backY = st.y - st.vy * st.length * 0.4;

        const grad = ctx.createLinearGradient(backX, backY, st.x, st.y);
        grad.addColorStop(0, `hsla(${st.hue}, 100%, 75%, 0)`);
        grad.addColorStop(1, `hsla(${st.hue}, 100%, 85%, ${st.life})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 * DPR * st.life;
        ctx.shadowBlur = 12 * DPR * st.life;
        ctx.shadowColor = `hsla(${st.hue}, 100%, 75%, ${st.life})`;
        ctx.beginPath();
        ctx.moveTo(backX, backY);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();
    }

    /* 4. Core pulse */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowBlur = 0;
    const coreR = (20 + bass * 90) * DPR;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    coreGrad.addColorStop(0, `hsla(${(hueShift * 0.8) % 360 + 260}, 100%, 85%, ${0.5 + bass * 0.5})`);
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
}

/* ── Init visualizer ── */
function initVisualizer() {
    resize();
    initStars();
    draw();
}

/* ── Keyboard ── */
document.addEventListener('keydown', e => {
    if (!playerSection.classList.contains('active')) return;
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    if (e.key === 'm' || e.key === 'M') modeBtn.click();
    if (e.key === 'f' || e.key === 'F') fullscreenBtn.click();
    if (e.key === 'Escape') backBtn.click();
});

/* ── Drag & drop ── */
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        if (!playerSection.classList.contains('active')) playNowBtn.click();
        setTimeout(() => loadFile(file), 200);
    }
});
