// Relais Yahoo Finance de PaperView (indices, matières premières, actions, forex).
// Yahoo bloque les appels directs du navigateur (CORS) : cette fonction les fait
// à sa place. Même logique que server.mjs, utilisé pour jouer en local.
//   GET /market/chart?symbol=^NDX&interval=15m&range=1mo
//   GET /market/quotes?symbols=^NDX,GC=F

const YF = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const SYMBOL_RE = /^[\^A-Z0-9=.\-]{1,15}$/;
const INTERVALS = new Set(['1m', '5m', '15m', '30m', '60m', '1d', '1wk']);
const RANGES = new Set(['1d', '5d', '1mo', '6mo', '2y', '5y', '10y']);

// Petit cache pour ne pas solliciter Yahoo à chaque requête
const cache = new Map<string, { t: number; body: any }>();
async function yahoo(path: string, ttlMs: number) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < ttlMs) return hit.body;
  const r = await fetch(YF + path, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  const body = await r.json();
  cache.set(path, { t: Date.now(), body });
  return body;
}

async function quote(symbol: string) {
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

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop();
  try {
    if (route === 'chart') {
      const symbol = url.searchParams.get('symbol') || '';
      const interval = url.searchParams.get('interval') || '';
      const range = url.searchParams.get('range') || '';
      if (!SYMBOL_RE.test(symbol) || !INTERVALS.has(interval) || !RANGES.has(range)) {
        return json(400, { error: 'paramètres invalides' });
      }
      return json(200, await yahoo(`${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`, 15000));
    }
    if (route === 'quotes') {
      const symbols = (url.searchParams.get('symbols') || '').split(',').filter(s => SYMBOL_RE.test(s)).slice(0, 30);
      const out: Record<string, unknown> = {};
      await Promise.all(symbols.map(async s => {
        try { out[s] = await quote(s); } catch { out[s] = null; }
      }));
      return json(200, out);
    }
    return json(404, { error: 'route inconnue' });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
});
