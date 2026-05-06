/**
 * player.js
 * 保存されたJSONデータを読み込み、地図上に再現するモジュール
 */

let playbackData = null;
let playbackIndex = 0;
let playbackTimer = null;
let isPlaying = false;
window.isPlaybackMode = false;

/**
 * 記録リストを更新
 */
async function refreshRecordList() {
    const select = document.getElementById('record-select');
    if (!select) return;

    try {
        const res = await fetch('/api/recordings');
        const files = await res.json();

        // 既存の選択肢をクリア（最初の1つ以外）
        while (select.options.length > 1) select.remove(1);

        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            // ファイル名から日付を読みやすく変換 (record_171... -> 12:34:56)
            const ts = parseInt(f.replace('record_', '').replace('.json', ''));
            const date = new Date(ts);
            opt.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('[Player] Failed to fetch list', e);
    }
}

/**
 * 再生・一時停止のトグル
 */
async function toggleRecordPlayback() {
    const select = document.getElementById('record-select');
    const btn = document.getElementById('record-play-btn');
    const filename = select.value;

    if (!filename) {
        alert('再生するデータを選択してください');
        return;
    }

    if (isPlaying) {
        // 停止
        stopPlayback();
    } else {
        // 開始
        btn.innerHTML = '<i class="fa-solid fa-pause" style="margin-right: 4px;"></i>一時停止';
        isPlaying = true;
        window.isPlaybackMode = true;
        
        if (!playbackData || playbackData.filename !== filename) {
            await loadPlaybackData(filename);
        }
        startPlaybackLoop();
    }
}

function stopPlayback() {
    const btn = document.getElementById('record-play-btn');
    btn.innerHTML = '<i class="fa-solid fa-play" style="margin-right: 4px;"></i>再生';
    isPlaying = false;
    window.isPlaybackMode = false;
    if (playbackTimer) clearTimeout(playbackTimer);
}

/**
 * データのロード
 */
async function loadPlaybackData(filename) {
    console.log(`[Player] Loading ${filename}...`);
    try {
        const res = await fetch(`/api/recordings/${filename}`);
        const data = await res.json();
        playbackData = {
            filename: filename,
            records: data.records
        };
        playbackIndex = 0;
        console.log(`[Player] Loaded ${data.records.length} records`);
    } catch (e) {
        console.error('[Player] Load failed', e);
    }
}

/**
 * 再生ループ
 */
function startPlaybackLoop() {
    if (!isPlaying || !playbackData) return;

    const record = playbackData.records[playbackIndex];
    if (!record) {
        console.log('[Player] Reached end of records');
        stopPlayback();
        playbackIndex = 0;
        return;
    }

    // データの種類に応じて描画
    applyRecordToMap(record);

    // 次のレコードとの時間差を計算（簡易的に1秒固定、またはタイムスタンプ差）
    const next = playbackData.records[playbackIndex + 1];
    let delay = 1000;
    if (next) {
        delay = next.ts - record.ts;
        if (delay < 0 || delay > 5000) delay = 1000; // 異常値は1秒に
    }

    playbackIndex++;
    playbackTimer = setTimeout(startPlaybackLoop, delay);
}

/**
 * レコードの内容を地図・UIに反映
 */
function applyRecordToMap(record) {
    const { ts, type, data } = record;

    // 時刻を更新
    updatePlaybackClock(ts);

    if (type === 'kmoni') {
        // 強震モニタデータの復元
        const features = data.points.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: getObsPointCoords(p.n) },
            properties: { name: p.n, intensity: p.i, color: intensityColor(p.i) }
        })).filter(f => f.geometry.coordinates);

        map.getSource('kmoni-points')?.setData({ type: 'FeatureCollection', features });
        updateIntBadge('max-int-badge', 'max-int-value', 'max-int-point', data.maxInt, data.maxPoint);
    } 
    else if (type === 'eew') {
        // EEW情報の復元
        renderEew(data);
        // 波の描画は eew.js の updateWaves が currentTestMock または lastEew を見ているので、
        // 擬似的に lastEew を上書きするか、ここでも描画ロジックを呼ぶ必要がある。
        // 今回はシンプルに renderEew でUIだけ更新。
    }
}

// 観測点名から座標を引く（kmoni.jsのobsPointsを利用）
function getObsPointCoords(name) {
    if (!window.obsPoints) return null;
    const p = window.obsPoints.find(p => p.name === name);
    return p ? [p.location.longitude, p.location.latitude] : null;
}

function updatePlaybackClock(timestamp) {
    const weekdays = ['日','月','火','水','木','金','土'];
    const now = new Date(timestamp);
    const hhmm = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    const ss   = String(now.getSeconds()).padStart(2, '0');
    const date = now.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' });
    const wd   = weekdays[now.getDay()];

    const timeEl = document.getElementById('map-clock-time');
    const dateEl = document.getElementById('map-clock-date');
    if (timeEl) timeEl.textContent = `${hhmm}:${ss}`;
    if (dateEl) dateEl.textContent = `${date} (${wd})`;
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(refreshRecordList, 1000);
});
