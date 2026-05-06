const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3010;

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
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
