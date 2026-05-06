// ═══════════════════════════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════════════════════════

const EQ_API = 'https://api.p2pquake.net/v2/history?codes=551&limit=100';

const SCALE_INFO = {
    10: { cls: 'int-1',  label: '1'   },
    20: { cls: 'int-2',  label: '2'   },
    30: { cls: 'int-3',  label: '3'   },
    40: { cls: 'int-4',  label: '4'   },
    45: { cls: 'int-5l', label: '5弱' },
    50: { cls: 'int-5u', label: '5強' },
    55: { cls: 'int-6l', label: '6弱' },
    60: { cls: 'int-6u', label: '6強' },
    70: { cls: 'int-7',  label: '7'   },
};

const SCALE_COLORS = {
    10: '#2563eb', 20: '#0891b2', 30: '#16a34a', 40: '#ca8a04',
    45: '#ea580c', 50: '#dc2626', 55: '#b91c1c', 60: '#7f1d1d', 70: '#7e22ce',
};

const TSUNAMI_LABELS = {
    Checking:     { text: '津波調査中',     color: '#f97316' },
    NonEffective: { text: '若干の海面変動', color: '#f97316' },
    Watch:        { text: '津波注意報',     color: '#ef4444' },
    Warning:      { text: '津波警報',       color: '#7e22ce' },
};

// 同一地震の複数エントリ（震度速報→震源情報→各地震度）を重複排除し最も詳しいものを残す
const TYPE_PRIORITY = {
    DetailScale: 5, ScaleAndDestination: 4, Destination: 3, ScalePrompt: 2, Foreign: 1, Other: 0
};

const ISSUE_TYPE_LABEL = {
    ScalePrompt:         '震度速報',
    Destination:         '震源情報',
    ScaleAndDestination: '震度・震源',
    DetailScale:         '各地震度',
    Foreign:             '遠地地震',
    Other:               'その他',
};

// ═══════════════════════════════════════════════════════════════
// データ取得・加工
// ═══════════════════════════════════════════════════════════════

function deduplicateEqItems(items) {
    const seen = new Map();
    for (const item of items) {
        const key = item.earthquake?.time ?? item.id;
        const pri = TYPE_PRIORITY[item.issue?.type] ?? 0;
        const cur = seen.get(key);
        if (!cur || (TYPE_PRIORITY[cur.issue?.type] ?? 0) < pri) seen.set(key, item);
    }
    return [...seen.values()].slice(0, 15);
}

function formatTime(timeStr) {
    const m = timeStr.match(/\d{4}\/(\d{2}\/\d{2}) (\d{2}:\d{2})/);
    return m ? { date: m[1], hm: m[2] } : { date: '--/--', hm: '--:--' };
}

async function fetchEqInfo() {
    const res = await fetch(EQ_API);
    if (!res.ok) throw new Error(`EQ API ${res.status}`);
    return deduplicateEqItems(await res.json());
}

// ═══════════════════════════════════════════════════════════════
// 描画
// ═══════════════════════════════════════════════════════════════

let selectedEqId = null;
let eqInfoCache  = [];

function renderEqList(items) {
    const container = document.getElementById('eqinfo-list');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `<div class="panel-empty"><i class="fa-solid fa-circle-dot"></i><span>地震情報なし</span></div>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const eq        = item.earthquake;
        const hypo      = eq.hypocenter;
        const info      = SCALE_INFO[eq.maxScale] || { cls: 'int-none', label: '--' };
        const t         = formatTime(eq.time);
        const mag       = hypo.magnitude > 0 ? `M${hypo.magnitude.toFixed(1)}` : 'M--';
        const dep       = hypo.depth >= 0    ? `${hypo.depth}km`               : '--';
        const tsu       = TSUNAMI_LABELS[eq.domesticTsunami];
        const tsuHTML   = tsu ? `<span class="eq-tsunami-badge" style="background:${tsu.color}">${tsu.text}</span>` : '';
        const typeLabel = ISSUE_TYPE_LABEL[item.issue?.type] ?? '';
        const sel       = item.id === selectedEqId ? ' selected' : '';

        return `<div class="eq-card${sel}" data-id="${item.id}">
            <div class="int-badge ${info.cls}">${info.label}</div>
            <div class="eq-card-info">
                <div class="eq-name">${hypo.name || '震源不明'}</div>
                <div class="eq-meta">${mag}  深さ${dep} ${tsuHTML}</div>
                <div class="eq-type-label">${typeLabel}</div>
            </div>
            <div class="eq-time">${t.date}<br>${t.hm}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.eq-card').forEach(card => {
        card.addEventListener('click', () => {
            const item = items.find(i => i.id === card.dataset.id);
            if (item) selectEq(item, items);
        });
    });
}

function selectEq(item, allItems) {
    selectedEqId = item.id;
    renderEqList(allItems);

    const hypo = item.earthquake.hypocenter;
    if (hypo.latitude > 0 && hypo.longitude > 0) {
        map.easeTo({ center: [hypo.longitude, hypo.latitude], zoom: 6, duration: 600 });
        map.getSource('eqinfo-epicenter').setData({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [hypo.longitude, hypo.latitude] },
                properties: { color: SCALE_COLORS[item.earthquake.maxScale] || '#888888' }
            }]
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 起動・ポーリング
// ═══════════════════════════════════════════════════════════════

async function eqinfoLoop() {
    if (window.isPlaybackMode) {
        setTimeout(eqinfoLoop, 60000);
        return;
    }
    try {
        const items = await fetchEqInfo();
        eqInfoCache = items;
        if (selectedEqId && !items.find(i => i.id === selectedEqId)) {
            selectedEqId = null;
            map.getSource('eqinfo-epicenter').setData({ type: 'FeatureCollection', features: [] });
        }
        renderEqList(items);
    } catch (e) {
        console.warn('[eqinfo]', e.message);
    }
    setTimeout(eqinfoLoop, 60_000);
}

if (window.mapReady) {
    eqinfoLoop();
} else {
    window.addEventListener('mapReady', eqinfoLoop, { once: true });
}
