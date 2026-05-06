const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3003;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/json; charset=utf-8',
    '.gif':  'image/gif',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
};

const ROOT = __dirname;

function proxyKmoni(targetUrl, res) {
    const parsed = url.parse(targetUrl);
    let done = false;

    const req = http.request({
        hostname: parsed.hostname,
        port: 80,
        path: parsed.path,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'http://www.kmoni.bosai.go.jp/',
        },
        timeout: 8000,
    }, (upRes) => {
        if (done) return; done = true;
        res.writeHead(upRes.statusCode, {
            'Content-Type': upRes.headers['content-type'] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        upRes.pipe(res);
    });

    req.on('timeout', () => { if (!done) { done = true; req.destroy(); res.writeHead(504); res.end(); } });
    req.on('error',   () => { if (!done) { done = true; res.writeHead(502); res.end(); } });
    req.end();
}

http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const pathname = decodeURIComponent(url.parse(req.url).pathname);

    // ── 強震モニタ 最新時刻 ──
    if (pathname === '/api/kmoni/latest') {
        proxyKmoni('http://www.kmoni.bosai.go.jp/webservice/server/pros/latest.json', res);
        return;
    }

    // ── 強震モニタ リアルタイム震度GIF ──
    if (pathname.startsWith('/api/kmoni/realtime/')) {
        const ts   = pathname.split('/').pop();
        const date = ts.substring(0, 8);
        proxyKmoni(
            `http://www.kmoni.bosai.go.jp/data/map_img/RealTimeImg/jma_s/${date}/${ts}.jma_s.gif`,
            res
        );
        return;
    }

    // ── 記録リスト取得 API ──
    if (req.method === 'GET' && pathname === '/api/recordings') {
        const dir = path.join(ROOT, 'recordings');
        if (!fs.existsSync(dir)) {
            res.writeHead(200); res.end(JSON.stringify([])); return;
        }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(files));
        return;
    }

    // ── 記録データ取得 API ──
    if (req.method === 'GET' && pathname.startsWith('/api/recordings/')) {
        const filename = pathname.split('/').pop();
        const filePath = path.join(ROOT, 'recordings', filename);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // ── データ記録 API ──
    if (req.method === 'POST' && pathname === '/api/record') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const dir = path.join(ROOT, 'recordings');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                const filename = `record_${Date.now()}.json`;
                fs.writeFileSync(path.join(dir, filename), body);
                console.log(`[Recorder] Saved: ${filename}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', file: filename }));
            } catch (e) {
                res.writeHead(400); res.end('Invalid JSON');
            }
        });
        return;
    }

    // ── 静的ファイル ──
    let p = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(ROOT, p);
    if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    // サーバー起動と同時にバックグラウンド監視を開始
    startBackgroundMonitor();
});

// ═══════════════════════════════════════════════════════════════
// 24時間バックグラウンド監視・記録ロジック
// ═══════════════════════════════════════════════════════════════

let isRecording = false;
let sessionBuffer = [];
let recordingStartTime = 0;
const BUFFER_MAX_TIME = 10 * 60 * 1000; // 10分間保持

async function startBackgroundMonitor() {
    console.log('[Monitor] Background monitoring started.');
    
    // EEW監視ループ (5秒おき)
    setInterval(async () => {
        try {
            const res = await fetch('http://www.kmoni.bosai.go.jp/webservice/hypo/eew/latest.json');
            const data = await res.json();
            
            if (data.result && data.result.status === 'success' && data.alertflg) {
                // EEW検知
                if (!isRecording) {
                    console.log('[Monitor] Earthquake detected! Starting recording...');
                    isRecording = true;
                    recordingStartTime = Date.now();
                }
                addToBuffer('eew', data);
            } else {
                // EEWなし
                if (isRecording) {
                    // 揺れが収まってから少し待って保存
                    if (Date.now() - recordingStartTime > 60000) { // 最低1分は記録
                        saveBufferToFile();
                    }
                }
            }
        } catch (e) {
            // エラー時は静かに
        }
    }, 5000);

    // 強震モニタ監視ループ (2秒おき: サーバー負荷軽減のため少し長めに)
    setInterval(async () => {
        // 記録中のみ詳細データを取得（または常に直近数分を保持しても良いが、今回はシンプルに記録中のみ）
        if (!isRecording) return;

        try {
            // 本来はGIF解析が必要だが、サーバー側で複雑な解析を避けるため
            // 最新時刻のJSONを記録し、画像URLを特定できるようにする
            const res = await fetch('http://www.kmoni.bosai.go.jp/webservice/server/pros/latest.json');
            const data = await res.json();
            addToBuffer('kmoni_time', data);
        } catch (e) {}
    }, 2000);
}

function addToBuffer(type, data) {
    sessionBuffer.push({ ts: Date.now(), type, data });
    // バッファが長すぎる場合は古いものを削除
    const now = Date.now();
    while (sessionBuffer.length > 0 && now - sessionBuffer[0].ts > BUFFER_MAX_TIME) {
        sessionBuffer.shift();
    }
}

function saveBufferToFile() {
    if (sessionBuffer.length === 0) return;
    
    const dir = path.join(ROOT, 'recordings');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `auto_record_${Date.now()}.json`;
    const payload = {
        eventId: 'auto_eew',
        recordedAt: new Date().toISOString(),
        records: sessionBuffer
    };

    fs.writeFileSync(path.join(dir, filename), JSON.stringify(payload, null, 2));
    console.log(`[Monitor] Auto-recording saved: ${filename}`);
    
    // リセット
    sessionBuffer = [];
    isRecording = false;
}
