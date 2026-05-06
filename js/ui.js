// ── 時計 ──────────────────────────────
const WEEKDAYS = ['日','月','火','水','木','金','土'];
function tickClock() {
    if (window.isPlaybackMode) return;
    const now = new Date();
    const hhmm = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    const ss   = String(now.getSeconds()).padStart(2, '0');
    const date = now.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' });
    const wd   = WEEKDAYS[now.getDay()];

    // 地図右上
    document.getElementById('map-clock-time').textContent = `${hhmm}:${ss}`;
    document.getElementById('map-clock-date').textContent = `${date} (${wd})`;
}
setInterval(tickClock, 1000);
tickClock();

// ── タブ／パネル ──────────────────────
const slidePanel = document.getElementById('slide-panel');
let activeTab = 'monitor';

document.querySelectorAll('.rail-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.panel;

        if (activeTab === target && slidePanel.classList.contains('open')) {
            slidePanel.classList.remove('open');
            btn.classList.remove('active');
            activeTab = null;
            applyTabLayers(null);
            return;
        }

        document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById('panel-' + target).classList.add('active');
        slidePanel.classList.add('open');
        activeTab = target;
        applyTabLayers(target);
    });
});

function applyTabLayers(tab) {
    if (!window.mapReady) return;
    const setVis = (id, show) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    };
    setVis('kmoni-circles',         tab === 'monitor' || tab === 'sim');
    setVis('eqinfo-epicenter-ring',  tab === 'eqinfo');
    setVis('eqinfo-epicenter-dot',   tab === 'eqinfo');

    if (tab === 'monitor' && typeof stopSimIfActive === 'function') stopSimIfActive();
}

window.addEventListener('mapReady', () => applyTabLayers(activeTab), { once: true });

// 起動時: 強震モニタパネルを開いておく
document.querySelector('.rail-btn[data-panel="monitor"]').click();
