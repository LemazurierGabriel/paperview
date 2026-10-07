// Serveur local de PaperView : sert l'application et relaie Yahoo Finance
// (indices, matières premières, actions, forex), que le navigateur ne peut
// pas appeler directement à cause de CORS.
//
//   node server.mjs        puis ouvrir http://localhost:8420

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8420);
const YF = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const SYMBOL_RE = /^[\^A-Z0-9=.\-]{1,15}$/;
const INTERVALS = new Set(['1m', '5m', '15m', '30m', '60m', '1d', '1wk']);
const RANGES = new Set(['1d', '5d', '1mo', '6mo', '2y', '5y', '10y']);

// Petit cache pour ne pas solliciter Yahoo à chaque requête
const cache = new Map();
async function yahoo(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < ttlMs) return hit.body;
  const r = await fetch(YF + path, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  const body = await r.json();
  cache.set(path, { t: Date.now(), body });
  return body;
}

async function quote(symbol) {
  const j = await yahoo(`${encodeURIComponent(symbol)}?interval=1d&range=1d`, 4000);
  const m = j.chart?.result?.[0]?.meta;
  if (!m || m.regularMarketPrice == null) return null;
  const reg = m.currentTradingPeriod?.regular, now = Date.now() / 1000;
  return {
    price: m.regularMarketPrice,
    prevClose: m.chartPreviousClose ?? m.previousClose ?? null,
    time: m.regularMarketTime,
    open: !!reg && now >= reg.start && now < reg.end,
  };
}

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/chart') {
      const symbol = url.searchParams.get('symbol') || '';
      const interval = url.searchParams.get('interval') || '';
      const range = url.searchParams.get('range') || '';
      if (!SYMBOL_RE.test(symbol) || !INTERVALS.has(interval) || !RANGES.has(range)) {
        return sendJSON(res, 400, { error: 'paramètres invalides' });
      }
      return sendJSON(res, 200, await yahoo(`${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`, 15000));
    }

    if (url.pathname === '/api/quotes') {
      const symbols = (url.searchParams.get('symbols') || '').split(',').filter(s => SYMBOL_RE.test(s)).slice(0, 30);
      const out = {};
      await Promise.all(symbols.map(async s => {
        try { out[s] = await quote(s); } catch { out[s] = null; }
      }));
      return sendJSON(res, 200, out);
    }

    // Fichiers statiques (sans sortir du dossier de l'app)
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT + sep)) return sendJSON(res, 403, { error: 'interdit' });
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return sendJSON(res, 404, { error: 'introuvable' });
    sendJSON(res, 502, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PaperView est prêt : http://localhost:${PORT}`);
});
