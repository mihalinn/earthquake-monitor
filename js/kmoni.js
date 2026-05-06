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
    if (typeof simMode !== 'undefined' && simMode) return;
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
// ── HSV多項式補間による震度計算（圧縮ノイズ耐性） ──────────────
// 参考: https://qiita.com/NoneType1/items/a4d2cf932e20b56ca444
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, v];
}

function getClosestIntensity(r, g, b) {
    const [h, s, v] = rgbToHsv(r, g, b);

    // 彩度が低すぎる（グレー・白・背景）は除外
    if (s < 0.5) return -3.0;
    // 極端に暗い or 極端に明るいピクセルを除外
    if (v < 0.15 || v > 0.98) return -3.0;

    let p = 0;
    if (h > 0.1476) {
        // 青〜黄 (位置 0.0〜0.6)
        p = 280.31*h**6 - 916.05*h**5 + 1142.6*h**4 - 709.95*h**3 + 234.65*h**2 - 40.27*h + 3.2217;
    } else if (h > 0.001) {
        // オレンジ〜赤 (位置 0.6〜0.9)
        p = 151.4*h**4 - 49.32*h**3 + 6.753*h**2 - 2.481*h + 0.9033;
    } else {
        // 深赤（明度で変化）(位置 0.9〜1.0)
        if (s < 0.8) return -3.0; // 県境グレーの誤検知対策
        p = -0.005171*v**2 - 0.3282*v + 1.2236;
    }

    p = Math.max(0, Math.min(1, p));
    const result = 10 * p - 3; // 位置(0〜1) → 震度(-3〜7)

    // 震度6強以上の誤検知抑制（彩度が極めて高い場合のみ許容）
    if (result > 6.0 && s < 0.85) return -3.0;

    return result;
}

// ── ビデオ連動シミュレーション ─────────────────────────────────
let simMode = false;
let simInterval = null;
const OFFSET_X = 0;
const OFFSET_Y = 0;

function processVideoFrame() {
    const videoEl = document.getElementById('sim-video');
    if (!simMode || !videoEl) return;

    const cx = parseFloat(document.getElementById('sim-crop-x')?.value) ?? 124;
    const cy = parseFloat(document.getElementById('sim-crop-y')?.value) ?? -1;
    const cw = parseFloat(document.getElementById('sim-crop-w')?.value) ?? 352;
    const ch = parseFloat(document.getElementById('sim-crop-h')?.value) ?? 400;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(videoEl, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const features = [];
    let maxV = -3.0, maxName = '';

    for (const p of obsPoints) {
        if (!p.point?.center_point || !p.location) continue;
        
        const scx = Math.round(p.point.center_point.x + OFFSET_X);
        const scy = Math.round(p.point.center_point.y + OFFSET_Y);
        
        let localMaxV = -3.0;

        // 【新兵器】中心と上下左右の1ピクセル（計5マス）だけを確認する
        const searchOffsets = [
            {dx: 0, dy: 0},   // 中心
            {dx: 0, dy: -1},  // 上
            {dx: 0, dy: 1},   // 下
            {dx: -1, dy: 0},  // 左
            {dx: 1, dy: 0}    // 右
        ];

        for (const offset of searchOffsets) {
            const targetX = scx + offset.dx;
            const targetY = scy + offset.dy;
            
            if (targetX < 0 || targetX >= canvas.width || targetY < 0 || targetY >= canvas.height) continue;

            const idx = (targetY * canvas.width + targetX) * 4;
            const v = getClosestIntensity(px[idx], px[idx+1], px[idx+2]);
            
            if (v > localMaxV) {
                localMaxV = v;
            }
        }

        if (localMaxV <= -3.0) continue;

        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.location.longitude, p.location.latitude] },
            properties: {
                name: p.name,
                intensity: localMaxV,
                color: intensityColor(localMaxV),
                size:  intensitySize(localMaxV),
            }
        });
        if (localMaxV > maxV) { maxV = localMaxV; maxName = p.name || ''; }
    }

    // デバッグ表示がONなら、サンプリング点に赤い点を描画（getImageDataの後に描画することで判定には影響させない）
    const debugMode = document.getElementById('sim-debug-toggle')?.checked;
    if (debugMode) {
        ctx.fillStyle = '#ff0000';
        for (const p of obsPoints) {
            if (!p.point?.center_point) continue;
            ctx.fillRect(p.point.center_point.x, p.point.center_point.y, 1, 1);
        }
    }

    map.getSource('kmoni-points').setData({ type: 'FeatureCollection', features });

    const badge   = document.getElementById('sim-max-int-badge');
    const valueEl = document.getElementById('sim-max-int-value');
    const pointEl = document.getElementById('sim-max-int-point');
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

    const pCtx = document.getElementById('sim-preview-canvas')?.getContext('2d');
    if (pCtx) {
        pCtx.clearRect(0, 0, 352, 400);
        pCtx.drawImage(canvas, 0, 0);
    }
}

// ── 起動 ────────────────────────────────────────────────────
async function startKmoni() {
    await loadObsPoints();

    const syncBtn = document.getElementById('sim-sync-btn');
    const videoEl = document.getElementById('sim-video');
    if (syncBtn && videoEl) {
        syncBtn.addEventListener('click', () => {
            simMode = !simMode;
            if (simMode) {
                syncBtn.style.background = 'rgba(59,130,246,0.2)';
                syncBtn.style.color = 'var(--accent)';
                syncBtn.style.borderColor = 'var(--accent)';
                syncBtn.textContent = '連動中 (クリックで解除)';
                
                const speedSelect = document.getElementById('sim-speed-select');
                if (speedSelect) videoEl.playbackRate = parseFloat(speedSelect.value);

                simInterval = setInterval(processVideoFrame, 100);
                videoEl.play();
            } else {
                syncBtn.style.background = 'var(--bg-card)';
                syncBtn.style.color = 'var(--text-hi)';
                syncBtn.style.borderColor = 'var(--border-hi)';
                syncBtn.textContent = '地図に連動させる';
                if (simInterval) clearInterval(simInterval);
            }
        });

        videoEl.addEventListener('play', () => {
            if (simMode && !simInterval) simInterval = setInterval(processVideoFrame, 100);
        });
        videoEl.addEventListener('pause', () => {
            if (simInterval) { clearInterval(simInterval); simInterval = null; }
        });

        const uploadEl = document.getElementById('sim-video-upload');
        if (uploadEl) {
            uploadEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                videoEl.src = url;
                videoEl.load();
                // プレビューの再描画なども必要なら行う
                if (simMode) {
                    videoEl.play();
                }
            });
        }
    }

    const previewWrap = document.getElementById('sim-preview-wrap');
    const adjustModal = document.getElementById('sim-adjust-wrap');
    if (previewWrap && adjustModal) {
        let expanded = false;
        previewWrap.addEventListener('click', () => {
            expanded = !expanded;
            if (expanded) {
                adjustModal.style.position = 'fixed';
                adjustModal.style.top = '50%';
                adjustModal.style.left = '50%';
                adjustModal.style.transform = 'translate(-50%, -50%)';
                adjustModal.style.width = '80vw';
                adjustModal.style.maxWidth = '800px';
                adjustModal.style.boxShadow = '0 0 0 100vw rgba(0,0,0,0.8)';
                adjustModal.style.zIndex = '99999';
                adjustModal.style.padding = '16px';
            } else {
                adjustModal.style.position = 'relative';
                adjustModal.style.top = 'auto';
                adjustModal.style.left = 'auto';
                adjustModal.style.transform = 'none';
                adjustModal.style.width = 'auto';
                adjustModal.style.maxWidth = 'none';
                adjustModal.style.boxShadow = 'none';
                adjustModal.style.zIndex = 'auto';
                adjustModal.style.padding = '0';
            }
        });
    }

    // 入力値が変わったら一時停止中でも即座に反映
    ['sim-crop-x', 'sim-crop-y', 'sim-crop-w', 'sim-crop-h', 'sim-debug-toggle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            if (simMode) processVideoFrame();
        });
    });

    const speedSelect = document.getElementById('sim-speed-select');
    if (speedSelect && videoEl) {
        speedSelect.addEventListener('change', () => {
            videoEl.playbackRate = parseFloat(speedSelect.value);
        });
    }

    kmoniLoop();
}

if (map.isStyleLoaded()) {
    startKmoni();
} else {
    map.once('load', startKmoni);
}
