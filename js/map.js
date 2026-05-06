const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {},
        layers: []
    },
    center: [139, 36.5],
    zoom: 4.7,
    minZoom: 3,
    maxZoom: 14,
    dragRotate: false,
    touchPitch: false,
    attributionControl: false
});

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${url}`);
    return res.json();
}

map.on('load', async () => {
    const [worldRaw, prefRaw, cityRaw, subdivRaw] = await Promise.all([
        fetchJSON('./data/world.json'),
        fetchJSON('./data/pref.geojson'),
        fetchJSON('./data/city.json'),
        fetchJSON('./data/jma_subdivision.geojson'),
    ]);

    // ── 背景色 ──
    map.addLayer({
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#060c17' }
    });

    // ── 周辺国 ──
    const worldGeo = topojson.feature(worldRaw, worldRaw.objects.countries);
    worldGeo.features = worldGeo.features.filter(f => String(f.id) !== '392');
    map.addSource('world', { type: 'geojson', data: worldGeo });
    map.addLayer({
        id: 'world-fill',
        type: 'fill',
        source: 'world',
        paint: { 'fill-color': '#080e1a', 'fill-outline-color': '#1e3048' }
    });

    // ── 都道府県（塗り）──
    map.addSource('pref', { type: 'geojson', data: prefRaw });
    map.addLayer({
        id: 'pref-fill',
        type: 'fill',
        source: 'pref',
        paint: { 'fill-color': '#0c1626' }
    });

    // ── 細分区域（薄い線）──
    const cityKey = Object.keys(cityRaw.objects)[0];
    const cityGeo = topojson.feature(cityRaw, cityRaw.objects[cityKey]);
    map.addSource('city', { type: 'geojson', data: cityGeo });
    map.addLayer({
        id: 'city-line',
        type: 'line',
        source: 'city',
        minzoom: 6.5,
        paint: { 'line-color': '#2a3f55', 'line-width': 0.4 }
    });

    // ── JMA細分区域 ──
    map.addSource('subdiv', { type: 'geojson', data: subdivRaw });
    map.addLayer({
        id: 'subdiv-line',
        type: 'line',
        source: 'subdiv',
        paint: { 'line-color': '#c8d8e8', 'line-width': 0.25, 'line-opacity': 0.35 }
    });

    // ── 強震モニタ ──
    map.addSource('kmoni-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
        id: 'kmoni-circles',
        type: 'circle',
        source: 'kmoni-points',
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'],
                4, 3,
                10, 6
            ],
            'circle-color':        ['get', 'color'],
            'circle-opacity':      0.9,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#0e1321'
        }
    });

    // ── 都道府県（枠線）──
    map.addLayer({
        id: 'pref-line',
        type: 'line',
        source: 'pref',
        paint: { 'line-color': '#d0e4f7', 'line-width': 0.8 }
    });

    // ── 地震情報 震源地 ──
    map.addSource('eqinfo-epicenter', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
        id: 'eqinfo-epicenter-ring',
        type: 'circle',
        source: 'eqinfo-epicenter',
        paint: {
            'circle-radius': 14,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.85
        }
    });
    map.addLayer({
        id: 'eqinfo-epicenter-dot',
        type: 'circle',
        source: 'eqinfo-epicenter',
        paint: {
            'circle-radius': 7,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.95,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff'
        }
    });

    // ── EEW 予報円 ──
    map.addSource('eew-waves', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
        id: 'eew-p-wave',
        type: 'line',
        source: 'eew-waves',
        filter: ['==', 'type', 'P'],
        paint: { 'line-color': '#4da6ff', 'line-width': 1.5, 'line-opacity': 0.8 }
    });
    map.addLayer({
        id: 'eew-s-wave',
        type: 'line',
        source: 'eew-waves',
        filter: ['==', 'type', 'S'],
        paint: { 'line-color': '#ff4d4d', 'line-width': 2.5, 'line-opacity': 0.9 }
    });

    // ── EEW 震央 ──
    map.addSource('eew-epicenter', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
        id: 'eew-epicenter-mark',
        type: 'line',
        source: 'eew-epicenter',
        paint: {
            'line-color': '#ff0000',
            'line-width': 3,
            'line-opacity': 1
        }
    });
    map.addLayer({
        id: 'eew-epicenter-mark-white',
        type: 'line',
        source: 'eew-epicenter',
        paint: {
            'line-color': '#ffffff',
            'line-width': 5,
            'line-opacity': 0.9
        }
    });
    // 白線を赤線の下に配置
    map.moveLayer('eew-epicenter-mark-white', 'eew-epicenter-mark');

    // 震央の中心ドット
    map.addLayer({
        id: 'eew-epicenter-center',
        type: 'circle',
        source: 'eew-epicenter',
        filter: ['==', '$type', 'Point'], // 点データのみ
        paint: {
            'circle-radius': 3,
            'circle-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ff0000'
        }
    });

    window.mapReady = true;
    window.dispatchEvent(new Event('mapReady'));
    console.log('[Map] 読み込み完了');
});

const HOME = { center: [139, 36.5], zoom: 4.7 };
document.getElementById('home-btn').addEventListener('click', () => {
    map.easeTo({ ...HOME, duration: 600 });
});
