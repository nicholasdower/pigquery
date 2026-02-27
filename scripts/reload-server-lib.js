import http from 'http';
import fs from 'fs';

const PORT = 9090;
const BUILD_DATE_FILE = 'build/dev/.build_date';

export function startReloadServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/')) {
      try {
        const buildId = fs.readFileSync(BUILD_DATE_FILE, 'utf8').trim();
        const since = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('since');
        if (since && since !== buildId) {
          console.log(`🔄 Build changed: ${since.slice(0, 24)} → ${buildId.slice(0, 24)}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ buildId }));
      } catch {
        console.error(`❌ Error reading build date from ${BUILD_DATE_FILE}`);
        res.writeHead(500);
        res.end();
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`🔄 Reload server running on http://localhost:${PORT}`);
    console.log(`   Reading build date from ${BUILD_DATE_FILE}\n`);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Is the reload server already running?`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}
