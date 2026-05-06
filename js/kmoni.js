// ── カラーテーブル (−3.0 ～ 7.0 / 0.1刻み) ─────────────────
const KMONI_COLOR_TABLE = [
    [-3.0,0,0,205],[-2.9,0,7,209],[-2.8,0,14,214],[-2.7,0,21,218],[-2.6,0,28,223],
    [-2.5,0,36,227],[-2.4,0,43,231],[-2.3,0,50,236],[-2.2,0,57,240],[-2.1,0,64,245],
    [-2.0,0,72,250],[-1.9,0,85,238],[-1.8,0,99,227],[-1.7,0,112,216],[-1.6,0,126,205],
    [-1.5,0,140,194],[-1.4,0,153,183],[-1.3,0,167,172],[-1.2,0,180,161],[-1.1,0,194,150],
    [-1.0,0,208,139],[-0.9,6,212,130],[-0.8,12,216,121],[-0.7,18,220,113],[-0.6,25,224,104],
    [-0.5,31,228,96],[-0.4,37,233,88],[-0.3,44,237,79],[-0.2,50,241,71],[-0.1,56,245,62],
    [0.0,63,250,54],[0.1,75,250,49],[0.2,88,250,45],[0.3,100,251,41],[0.4,113,251,37],
    [0.5,125,252,33],[0.6,138,252,28],[0.7,151,253,24],[0.8,163,253,20],[0.9,176,254,16],
    [1.0,189,255,12],[1.1,195,254,10],[1.2,202,254,9],[1.3,208,254,8],[1.4,215,254,7],
    [1.5,222,255,5],[1.6,228,254,4],[1.7,235,255,3],[1.8,241,254,2],[1.9,248,255,1],
    [2.0,255,255,0],[2.1,254,251,0],[2.2,254,248,0],[2.3,254,244,0],[2.4,254,241,0],
    [2.5,255,238,0],[2.6,254,234,0],[2.7,255,231,0],[2.8,254,227,0],[2.9,255,224,0],
    [3.0,255,221,0],[3.1,254,213,0],[3.2,254,205,0],[3.3,254,197,0],[3.4,254,190,0],
    [3.5,255,182,0],[3.6,254,174,0],[3.7,255,167,0],[3.8,254,159,0],[3.9,255,151,0],
    [4.0,255,144,0],[4.1,254,136,0],[4.2,254,128,0],[4.3,254,121,0],[4.4,254,113,0],
    [4.5,255,106,0],[4.6,254,98,0],[4.7,255,90,0],[4.8,254,83,0],[4.9,255,75,0],
    [5.0,255,68,0],[5.1,254,61,0],[5.2,253,54,0],[5.3,252,47,0],[5.4,251,40,0],
    [5.5,250,33,0],[5.6,249,27,0],[5.7,248,20,0],[5.8,247,13,0],[5.9,246,6,0],
    [6.0,245,0,0],[6.1,238,0,0],[6.2,230,0,0],[6.3,223,0,0],[6.4,215,0,0],
    [6.5,208,0,0],[6.6,200,0,0],[6.7,192,0,0],[6.8,185,0,0],[6.9,177,0,0],
    [7.0,170,0,0],
];

const KMONI_RGB = new Map();
KMONI_COLOR_TABLE.forEach(([v,r,g,b]) => KMONI_RGB.set(`${r},${g},${b}`, v));

function intensityColor(v) {
    const idx = Math.round((Math.max(-3, Math.min(7, v)) + 3) * 10);
    const c = KMONI_COLOR_TABLE[idx];
    return c ? `rgb(${c[1]},${c[2]},${c[3]})` : '#fff';
}

function intensitySize(v) {
    if (v >= 5.0) return 6;
    if (v >= 3.0) return 5;
    if (v >= 1.0) return 4;
    if (v >= 0.0) return 3;
    return 2;
}

function floatToJmaClass(v) {
    if (v >= 6.5) return { cls: 'int-7',  label: '7'  };
    if (v >= 6.0) return { cls: 'int-6u', label: '6強' };
    if (v >= 5.5) return { cls: 'int-6l', label: '6弱' };
    if (v >= 5.0) return { cls: 'int-5u', label: '5強' };
    if (v >= 4.5) return { cls: 'int-5l', label: '5弱' };
    if (v >= 3.5) return { cls: 'int-4',  label: '4'  };
    if (v >= 2.5) return { cls: 'int-3',  label: '3'  };
    if (v >= 1.5) return { cls: 'int-2',  label: '2'  };
    if (v >= 0.5) return { cls: 'int-1',  label: '1'  };
    return null;
}

// ── 観測点・キャンバス ────────────────────────────────────────
let obsPoints = [];
let lastTime  = '';

const canvas = document.getElementById('kmoni-canvas');
const ctx    = canvas.getContext('2d', { willReadFrequently: true });

async function loadObsPoints() {
    const res = await fetch('./data/obs_points.json');
    obsPoints = await res.json();
    console.log(`[kmoni] 観測点 ${obsPoints.length} 件`);
}

// ── UI 更新 ─────────────────────────────────────────────────
function setStatus(state) {
    const dot = document.getElementById('kmoni-dot');
    const lbl = document.getElementById('kmoni-status');
    dot.className = 'dot ' + (state === 'on' ? 'dot-on' : state === 'err' ? 'dot-err' : 'dot-off');
    lbl.textContent = '強震モニタ: ' + (state === 'on' ? '接続中' : state === 'err' ? 'エラー' : '未接続');
}

function updateUI(maxV, maxName) {
    const badge   = document.getElementById('max-int-badge');
    const valueEl = document.getElementById('max-int-value');
    const pointEl = document.getElementById('max-int-point');
    const info    = floatToJmaClass(maxV);

    if (info) {
        badge.className = 'int-badge ' + info.cls;
        badge.style.background = '';
        badge.textContent = info.label;
    } else {
        badge.className = 'int-badge';
        badge.style.background = intensityColor(maxV);
        badge.textContent = maxV.toFixed(1);
    }
    valueEl.textContent = `計測値  ${maxV.toFixed(1)}`;
    pointEl.textContent = maxName || '−−';
}

// ── GIF 解析 ─────────────────────────────────────────────────
function processGif(ts) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const features = [];
            let maxV = -3.0, maxName = '';

            for (const p of obsPoints) {
                if (!p.point?.center_point || !p.location) continue;
                const x = p.point.center_point.x;
                const y = p.point.center_point.y;
                const i = (y * canvas.width + x) * 4;
                const v = KMONI_RGB.get(`${px[i]},${px[i+1]},${px[i+2]}`) ?? -3.0;

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.location.longitude, p.location.latitude] },
                    properties: {
                        name: p.name,
                        intensity: v,
                        color: intensityColor(v),
                        size:  intensitySize(v),
                    }
                });
                if (v > maxV) { maxV = v; maxName = p.name || ''; }
            }

            map.getSource('kmoni-points').setData({ type: 'FeatureCollection', features });
            updateUI(maxV, maxName);
            resolve();
        };
        img.onerror = () => reject(new Error('GIF load failed'));
        img.src = `/api/kmoni/realtime/${ts}`;
    });
}

// ── メインループ ─────────────────────────────────────────────
async function kmoniLoop() {
    if (simMode) return;
    try {
        const res  = await fetch('/api/kmoni/latest');
        if (!res.ok) throw new Error(`latest ${res.status}`);
        const data = await res.json();
        const displayTime = data.latest_time;

        if (displayTime !== lastTime) {
            lastTime = displayTime;
            const ts = displayTime.replace(/[- /:]/g, '');
            await processGif(ts);
        }
        setStatus('on');
    } catch (e) {
        setStatus('err');
        console.warn('[kmoni]', e.message);
    }
    setTimeout(kmoniLoop, 1000);
}

// ── シミュレーション ──────────────────────────────────────────
let simMode = false;
let simDate = null;
let simTimer = null;

function simTs(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function simUpdateClock(d) {
    const p = n => String(n).padStart(2, '0');
    document.getElementById('map-clock-time').textContent =
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    document.getElementById('map-clock-date').textContent =
        `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} [再生中]`;
    document.getElementById('sim-time').textContent =
        `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function simStep() {
    if (!simMode) return;
    const speed = parseInt(document.getElementById('sim-speed').value) || 1;
    simUpdateClock(simDate);
    try {
        await processGif(simTs(simDate));
    } catch(e) {
        console.warn('[sim] データなし:', simTs(simDate));
    }
    simDate = new Date(simDate.getTime() + 1000);
    simTimer = setTimeout(simStep, 1000 / speed);
}

function startSim() {
    const val = document.getElementById('sim-datetime').value;
    if (!val) return;
    simMode = true;
    simDate = new Date(val);
    if (simTimer) clearTimeout(simTimer);
    const btn = document.getElementById('sim-play-btn');
    btn.textContent = '⏹ 停止';
    btn.classList.add('active');
    setStatus('on');
    simStep();
}

function stopSim() {
    simMode = false;
    if (simTimer) { clearTimeout(simTimer); simTimer = null; }
    const btn = document.getElementById('sim-play-btn');
    btn.textContent = '▶ 再生';
    btn.classList.remove('active');
    document.getElementById('sim-time').textContent = '';
    kmoniLoop();
}

// ── 起動 ────────────────────────────────────────────────────
async function startKmoni() {
    await loadObsPoints();

    document.getElementById('sim-play-btn').addEventListener('click', () => {
        simMode ? stopSim() : startSim();
    });

    document.querySelectorAll('.sim-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('sim-datetime').value = btn.dataset.ts;
        });
    });

    kmoniLoop();
}

if (map.isStyleLoaded()) {
    startKmoni();
} else {
    map.once('load', startKmoni);
}
