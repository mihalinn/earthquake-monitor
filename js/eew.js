// ═══════════════════════════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════════════════════════

const EEW_API       = 'https://api.p2pquake.net/v2/history?codes=556&limit=1';
const EEW_ACTIVE_MS = 10 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
// ユーティリティ
// ═══════════════════════════════════════════════════════════════

function parseJST(str) {
    return new Date(str.replace(/\//g, '-').replace(' ', 'T') + '+09:00');
}

function eewMaxScale(eew) {
    if (!eew.areas?.length) return -1;
    return Math.max(...eew.areas.map(a => Math.floor(a.scaleFrom)));
}

// ═══════════════════════════════════════════════════════════════
// 描画
// ═══════════════════════════════════════════════════════════════

function renderEew(eew) {
    const section = document.getElementById('eew-section');
    const badge   = document.getElementById('monitor-eew-badge');
    if (!section) return;

    const active = eew && !eew.cancelled && !eew.test &&
                   (Date.now() - parseJST(eew.issue.time).getTime()) < EEW_ACTIVE_MS;

    section.style.display = active ? '' : 'none';
    if (badge) badge.style.display = active ? '' : 'none';
    if (!active) return;

    const eq   = eew.earthquake;
    const hypo = eq?.hypocenter;
    const maxS = eewMaxScale(eew);
    const info = SCALE_INFO[maxS] || { cls: 'int-none', label: '--' };
    const mag  = hypo?.magnitude > 0 ? `M${hypo.magnitude.toFixed(1)}` : 'M--';
    const dep  = hypo?.depth >= 0    ? `${Math.round(hypo.depth)}km`   : '--';
    const hms  = parseJST(eew.issue.time)
                    .toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const intBadge = document.getElementById('eew-int-badge');
    intBadge.className   = `int-badge ${info.cls}`;
    intBadge.textContent = info.label;

    document.getElementById('eew-name').textContent   = hypo?.name || '震央不明';
    document.getElementById('eew-detail').textContent = `${mag}  深さ${dep}`;
    document.getElementById('eew-serial').textContent = `第${eew.issue.serial}報`;
    document.getElementById('eew-time').textContent   = hms;
}

function createCircleFeature(lng, lat, radiusKm, type) {
    if (radiusKm <= 0) return null;
    const points = 128; // 滑らかさアップ
    const coords = [];
    const kmPerLat = 111.32;
    const kmPerLng = 111.32 * Math.cos(lat * Math.PI / 180);
    
    for (let i = 0; i <= points; i++) {
        const angle = (i * 360 / points) * Math.PI / 180;
        const dx = radiusKm * Math.cos(angle);
        const dy = radiusKm * Math.sin(angle);
        coords.push([lng + (dx / kmPerLng), lat + (dy / kmPerLat)]);
    }
    
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { type: type }
    };
}

function createCrossFeatures(lng, lat, sizeKm) {
    const kmPerLat = 111.32;
    const kmPerLng = 111.32 * Math.cos(lat * Math.PI / 180);
    const dLat = sizeKm / kmPerLat;
    const dLng = sizeKm / kmPerLng;

    return [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [lng - dLng, lat - dLat],
                    [lng + dLng, lat + dLat]
                ]
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [lng - dLng, lat + dLat],
                    [lng + dLng, lat - dLat]
                ]
            }
        }
    ];
}

// ═══════════════════════════════════════════════════════════════
// ポーリング
// ═══════════════════════════════════════════════════════════════

let lastEew = null;

async function eewLoop() {
    if (window.isPlaybackMode) {
        setTimeout(eewLoop, 5000);
        return;
    }
    try {
        const res = await fetch(EEW_API);
        if (!res.ok) throw new Error(`EEW API ${res.status}`);
        const items = await res.json();
        lastEew = items[0] ?? null;
        
        // レコーダーに記録
        if (window.Recorder && lastEew) {
            window.Recorder.add('eew', lastEew);
        }

        // テスト中以外の場合のみ、本番データをレンダリング
        if (!eewTestInterval) {
            renderEew(lastEew);
        }
    } catch (e) {
        console.warn('[eew]', e.message);
    }
    setTimeout(eewLoop, 5000);
}

eewLoop();

// ── 波の描画更新（requestAnimationFrameで最高に滑らかに） ──

function updateWaves() {
    if (!window.mapReady || window.isPlaybackMode) {
        requestAnimationFrame(updateWaves);
        return;
    }

    let eew = null;
    let startTime = 0;
    let epicenter = null;

    if (eewTestInterval) {
        // テストモード時
        eew = currentTestMock;
        startTime = testStartTime;
        if (eew) epicenter = [eew.earthquake.hypocenter.longitude, eew.earthquake.hypocenter.latitude];
    } else if (lastEew && !lastEew.cancelled && !lastEew.test) {
        // 本番データ時
        const eqTime = parseJST(lastEew.earthquake.time || lastEew.issue.time).getTime();
        if ((Date.now() - eqTime) < EEW_ACTIVE_MS) {
            eew = lastEew;
            startTime = eqTime;
            epicenter = [eew.earthquake.hypocenter.longitude, eew.earthquake.hypocenter.latitude];
        }
    }

    if (eew && epicenter && epicenter[0] > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0 && elapsed < 600) {
            const waveFeatures = [
                createCircleFeature(epicenter[0], epicenter[1], elapsed * 7.0, 'P'),
                createCircleFeature(epicenter[0], epicenter[1], elapsed * 3.5, 'S')
            ].filter(Boolean);
            map.getSource('eew-waves')?.setData({ type: 'FeatureCollection', features: waveFeatures });

            // 震央の「×」印と中心点を描画
            const crossFeatures = createCrossFeatures(epicenter[0], epicenter[1], 8); // 8kmサイズに縮小
            const centerPoint = {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: epicenter }
            };
            map.getSource('eew-epicenter')?.setData({
                type: 'FeatureCollection',
                features: [...crossFeatures, centerPoint]
            });
        } else {
            map.getSource('eew-waves')?.setData({ type: 'FeatureCollection', features: [] });
            map.getSource('eew-epicenter')?.setData({ type: 'FeatureCollection', features: [] });
        }
    } else {
        map.getSource('eew-waves')?.setData({ type: 'FeatureCollection', features: [] });
        map.getSource('eew-epicenter')?.setData({ type: 'FeatureCollection', features: [] });
    }
    requestAnimationFrame(updateWaves);
}

requestAnimationFrame(updateWaves);

// ── プロ仕様テストモード ──
let eewTestInterval = null;
let testStartTime   = 0;
let currentTestMock = null;

window.triggerTestEew = function() {
    if (eewTestInterval) clearInterval(eewTestInterval);
    
    console.log('[EEW] Starting Sequential Test Simulation');
    let serial = 1;
    const epicenter = [137.24, 37.5]; 
    testStartTime = Date.now();
    
    const update = () => {
        const now = new Date();
        const timeStr = now.getFullYear() + '/' + 
                        String(now.getMonth()+1).padStart(2, '0') + '/' + 
                        String(now.getDate()).padStart(2, '0') + ' ' + 
                        String(now.getHours()).padStart(2, '0') + ':' + 
                        String(now.getMinutes()).padStart(2, '0') + ':' + 
                        String(now.getSeconds()).padStart(2, '0');
        
        const mag   = Math.min(7.6, 6.2 + (serial * 0.15));
        const scale = Math.min(70, 45 + (serial * 2.5));
        
        currentTestMock = {
            issue: { time: timeStr, serial: String(serial) },
            earthquake: {
                time: timeStr,
                hypocenter: { name: "石川県能登地方", magnitude: mag, depth: 10, longitude: epicenter[0], latitude: epicenter[1] },
            },
            areas: [{ scaleFrom: scale }],
            cancelled: false,
            test: false
        };
        
        renderEew(currentTestMock);

        // 地図に震源を表示（円の描画はupdateWaves側に任せる）
        if (window.mapReady) {
            if (serial === 1) {
                map.easeTo({ center: epicenter, zoom: 7, duration: 1000 });
            }
        }

        serial++;
        if (serial > 100) { 
            clearInterval(eewTestInterval);
            eewTestInterval = null;
            currentTestMock = null;
            console.log('[EEW] Sequential Test Finished');
        }
    };

    update();
    eewTestInterval = setInterval(update, 2000); 
};
