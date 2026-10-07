'use strict';

/* =====================================================================
   PaperView — trading fictif sur prix réels
   Crypto : Binance (directement depuis le navigateur).
   Indices, matières premières, actions, forex : Yahoo Finance, relayé par
   le serveur local (server.mjs) car Yahoo bloque les appels du navigateur.
   Si une source est injoignable, ses actifs passent en prix simulés.
   Indicateurs : indicators.js · Outils de dessin : drawings.js · Tuto : tuto.js
   ===================================================================== */

const LC = window.LightweightCharts;
if (!LC) {
  document.body.innerHTML = '<p style="padding:40px">Impossible de charger la librairie de graphiques (connexion internet requise).</p>';
  throw new Error('lightweight-charts introuvable');
}

const US_HOURS = 'du lundi au vendredi, de 15h30 à 22h (heure de Paris)';
const FUT_HOURS = 'presque 24h/24, du lundi au vendredi';
const coin = (s, name, base) => ({ s, short: s.replace('USDT', ''), label: s.replace('USDT', '') + '/USDT', name, cat: 'crypto', base });
const ASSETS = [
  coin('BTCUSDT', 'Bitcoin', 65000), coin('ETHUSDT', 'Ethereum', 3200), coin('SOLUSDT', 'Solana', 150),
  coin('BNBUSDT', 'BNB', 580), coin('XRPUSDT', 'XRP', 0.6), coin('DOGEUSDT', 'Dogecoin', 0.14),
  coin('ADAUSDT', 'Cardano', 0.45), coin('AVAXUSDT', 'Avalanche', 28), coin('LINKUSDT', 'Chainlink', 14),
  coin('DOTUSDT', 'Polkadot', 6), coin('LTCUSDT', 'Litecoin', 75), coin('TRXUSDT', 'TRON', 0.15),
  { s: 'NDX', yf: '^NDX', short: 'NDX', label: 'Nasdaq 100', name: 'Indice tech US', cat: 'indices', base: 25000, hours: US_HOURS },
  { s: 'SPX', yf: '^GSPC', short: 'SPX', label: 'S&P 500', name: 'Indice US', cat: 'indices', base: 6700, hours: US_HOURS },
  { s: 'CAC40', yf: '^FCHI', short: 'CAC', label: 'CAC 40', name: 'Indice France', cat: 'indices', base: 7800, hours: 'du lundi au vendredi, de 9h à 17h30' },
  { s: 'GOLD', yf: 'GC=F', short: 'XAU', label: 'Or', name: "Once d'or", cat: 'matieres', base: 4000, hours: FUT_HOURS },
  { s: 'SILVER', yf: 'SI=F', short: 'XAG', label: 'Argent', name: "Once d'argent", cat: 'matieres', base: 48, hours: FUT_HOURS },
  { s: 'OIL', yf: 'CL=F', short: 'WTI', label: 'Pétrole WTI', name: 'Baril de brut', cat: 'matieres', base: 85, hours: FUT_HOURS },
  { s: 'AAPL', yf: 'AAPL', short: 'AAPL', label: 'Apple', name: 'Action US', cat: 'actions', base: 300, hours: US_HOURS },
  { s: 'NVDA', yf: 'NVDA', short: 'NVDA', label: 'Nvidia', name: 'Action US', cat: 'actions', base: 180, hours: US_HOURS },
  { s: 'TSLA', yf: 'TSLA', short: 'TSLA', label: 'Tesla', name: 'Action US', cat: 'actions', base: 400, hours: US_HOURS },
  { s: 'EURUSD', yf: 'EURUSD=X', short: 'EUR', label: 'EUR/USD', name: 'Euro / Dollar', cat: 'forex', base: 1.12, hours: '24h/24, du lundi au vendredi' },
];
const SYM = Object.fromEntries(ASSETS.map(x => [x.s, x]));
const CRYPTO = ASSETS.filter(x => !x.yf);
const YAHOO = ASSETS.filter(x => x.yf);
const CATS = [['all', 'Tout'], ['crypto', 'Crypto'], ['indices', 'Indices'], ['matieres', 'Matières'], ['actions', 'Actions'], ['forex', 'Forex']];
const lab = s => SYM[s]?.label ?? s;
const shortOf = s => SYM[s]?.short ?? s;

const TFS = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 };
const TF_LABEL = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1J', '1w': '1S' };
// Intervalle et profondeur demandés à Yahoo pour chaque unité de temps (4H est reconstruit à partir de l'horaire)
const TF_YF = {
  '1m': ['1m', '5d'], '5m': ['5m', '1mo'], '15m': ['15m', '1mo'], '30m': ['30m', '1mo'],
  '1h': ['60m', '6mo'], '4h': ['60m', '2y'], '1d': ['1d', '5y'], '1w': ['1wk', '10y'],
};
const CHART_TYPES = { candles: 'Bougies', ha: 'Heikin Ashi', bars: 'Barres', line: 'Ligne', area: 'Zone' };

const START_BALANCE = 10000;
const FEE = 0.0004;      // 0,04 % par côté
const MAINT = 0.9;       // liquidation quand la perte atteint 90 % de la marge
// Relais Yahoo : la fonction en ligne Supabase (config.js), sinon le serveur local server.mjs
const MARKET_API = CONFIG.supabaseUrl ? `${CONFIG.supabaseUrl}/functions/v1/market` : 'api';
const MARKET_HEADERS = CONFIG.supabaseKey ? { apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}` } : {};
const REST_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
const WS_HOSTS = ['wss://stream.binance.com:443', 'wss://data-stream.binance.vision', 'wss://stream.binance.com:9443'];
const COL = { up: '#26a69a', down: '#ef5350', blue: '#2962ff', liq: '#ff9800', limit: '#f7d000' };

// Le graphique affiche l'heure locale : on décale les timestamps UTC.
const TZ = -new Date().getTimezoneOffset() * 60;
const toCT = ms => Math.floor(ms / 1000) + TZ;
// Début du créneau contenant t (les semaines commencent le lundi)
const bucket = (t, sec) => sec === 604800 ? Math.floor((t - 345600) / sec) * sec + 345600 : Math.floor(t / sec) * sec;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newId = () => Math.random().toString(36).slice(2, 10);

/* ---------------- Formatage ---------------- */
const decimals = p => (p >= 100 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 5 : 8);
const fmtP = (p, d) => (p == null || !isFinite(p)) ? '—'
  : p.toLocaleString('fr-FR', { minimumFractionDigits: d ?? decimals(p), maximumFractionDigits: d ?? decimals(p) });
const fmtUSD = v => (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const fmtSigned = v => (v > 0 ? '+' : '') + fmtUSD(v);
const fmtPct = v => (v > 0 ? '+' : '') + (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
const fmtQty = q => q.toLocaleString('fr-FR', { maximumFractionDigits: q >= 100 ? 2 : q >= 1 ? 4 : 6 });
const fmtVol = v => v >= 1e9 ? (v / 1e9).toFixed(2) + ' Md' : v >= 1e6 ? (v / 1e6).toFixed(2) + ' M' : v >= 1e3 ? (v / 1e3).toFixed(2) + ' k' : v.toFixed(2);
const fmtDate = ms => new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const cls = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
const fmtPts = v => (v > 0 ? '+' : '') + Math.round(v).toLocaleString('fr-FR');

/* ---------------- Points & rangs ---------------- */
// 1 $ gagné = +1 point, 1 $ perdu = −1 point (sur le PnL net de chaque trade clôturé)
const RANKS = [
  [10000, 'Diamant', '#6ee7f9'], [6000, 'Platine', '#c4b5fd'], [3000, 'Or', '#f7c948'],
  [1500, 'Argent', '#cfd8dc'], [500, 'Bronze', '#d08c5b'], [0, 'Débutant', '#9598a1'],
  [-Infinity, 'Dans le rouge', '#ef5350'],
];
const rankOf = pts => RANKS.find(([min]) => pts >= min);
const num = v => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const roundP = p => +p.toFixed(decimals(p));

/* ---------------- État persistant ---------------- */
// Réglages par défaut des indicateurs (calculs et affichage dans indicators.js)
const IND_DEFAULTS = {
  sma: { on: true, period: 20 }, ema: { on: false, period: 50 }, sma200: { on: false, period: 200 },
  bb: { on: false, period: 20, mult: 2 }, vwap: { on: false }, ichi: { on: false, tenkan: 9, kijun: 26, senkou: 52 },
  sar: { on: false, step: 0.02, max: 0.2 }, vol: { on: true },
  rsi: { on: false, period: 14 }, macd: { on: false, fast: 12, slow: 26, signal: 9 },
  stoch: { on: false, k: 14, d: 3, smooth: 3 }, atr: { on: false, period: 14 },
};
function normInd(ind) {
  const out = {};
  for (const [k, def] of Object.entries(IND_DEFAULTS)) {
    const v = ind?.[k];
    out[k] = typeof v === 'boolean' ? { ...def, on: v } : { ...def, ...(v && typeof v === 'object' ? v : {}) };
  }
  return out;
}

const LS_KEY = 'paperview.v1';
function freshState(prev) {
  return {
    cash: START_BALANCE, positions: [], orders: [], history: [], seq: 1,
    points: 0, partie: (prev?.partie || 0) + 1, partieStart: Date.now(), parties: prev?.parties || [],
    sym: prev?.sym || 'BTCUSDT', tf: prev?.tf || '15m',
    ind: normInd(prev?.ind), ctype: prev?.ctype || 'candles', logScale: !!prev?.logScale,
    drawings: prev?.drawings || {},
  };
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && typeof s.cash === 'number' && SYM[s.sym] && TFS[s.tf]) {
      // Sauvegardes plus anciennes
      s.points ??= Math.round(s.history.reduce((t, h) => t + h.pnl, 0));
      s.partie ??= 1;
      s.partieStart ??= s.history[s.history.length - 1]?.time ?? Date.now();
      s.parties ??= [];
      s.orders.forEach(o => { o.trigger ??= o.side === 'long' ? 'below' : 'above'; });
      s.ind = normInd(s.ind);
      if (!CHART_TYPES[s.ctype]) s.ctype = 'candles';
      s.logScale = !!s.logScale;
      for (const [sym, list] of Object.entries(s.drawings || {})) {
        s.drawings[sym] = list.map(d => typeof d === 'number'
          ? { id: newId(), type: 'hline', color: '#9598a1', pts: [{ t: 0, p: d }] } : d);
      }
      return s;
    }
  } catch { /* stockage indisponible */ }
  return null;
}
let S = loadState() || freshState();
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* ignore */ } }

/* ---------------- Marché ---------------- */
const M = { price: {}, open24: {}, lastDir: {}, closed: {}, qtime: {} };
const feed = { mode: 'connecting', rest: null, ws: WS_HOSTS[0] };   // flux crypto (Binance)
const yahoo = { ok: null };                                           // null = pas encore testé
const isSim = sym => SYM[sym].yf ? yahoo.ok === false : feed.mode === 'sim';
const isClosed = sym => !!SYM[sym].yf && !isSim(sym) && !!M.closed[sym];
const srcLabel = sym => isSim(sym) ? 'Simulé' : SYM[sym].yf ? 'Yahoo Finance' : 'Binance';
let bars = [];

/* ---------------- Interface (non persistée) ---------------- */
const ui = { side: 'long', type: 'market', tab: 'positions', cat: 'all' };

/* =====================================================================
   Graphique
   ===================================================================== */
const chart = LC.createChart($('chart'), {
  autoSize: true,
  layout: {
    background: { type: 'solid', color: '#131722' }, textColor: '#b2b5be', fontSize: 12,
    panes: { separatorColor: '#2a2e39', separatorHoverColor: 'rgba(41, 98, 255, .25)', enableResize: true },
  },
  grid: { vertLines: { color: '#1c2030' }, horzLines: { color: '#1c2030' } },
  crosshair: { mode: LC.CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#2a2e39' },
  timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false, rightOffset: 8 },
});
const volS = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false }, 0);
volS.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
const volPoint = b => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(38,166,154,.4)' : 'rgba(239,83,80,.4)' });

// L'échelle s'élargit pour garder visibles l'entrée, le SL, le TP et les ordres en attente
function autoscaleWithLevels(original) {
  const res = original();
  const last = bars[bars.length - 1]?.close;
  if (!res || !last) return res;
  const levels = [];
  for (const p of S.positions) if (p.sym === S.sym) levels.push(p.entry, p.sl, p.tp);
  for (const o of S.orders) if (o.sym === S.sym) levels.push(o.price);
  for (const v of levels) {
    if (!v || Math.abs(v / last - 1) > 0.15) continue;
    res.priceRange.minValue = Math.min(res.priceRange.minValue, v);
    res.priceRange.maxValue = Math.max(res.priceRange.maxValue, v);
  }
  return res;
}

/* ---- Série principale (bougies, Heikin Ashi, barres, ligne, zone) ---- */
let mainS = null, markersApi = null, haArr = [];
let priceFmt = { type: 'price', precision: 2, minMove: 0.01 };
function createMainSeries() {
  if (mainS) { chart.removeSeries(mainS); priceLines = []; linesSig = ''; }
  const common = { autoscaleInfoProvider: autoscaleWithLevels, priceFormat: priceFmt };
  const ohlc = { upColor: COL.up, downColor: COL.down, ...common };
  switch (S.ctype) {
    case 'bars': mainS = chart.addSeries(LC.BarSeries, { ...ohlc, thinBars: false }, 0); break;
    case 'line': mainS = chart.addSeries(LC.LineSeries, { color: COL.blue, lineWidth: 2, ...common }, 0); break;
    case 'area': mainS = chart.addSeries(LC.AreaSeries, { lineColor: COL.blue, topColor: 'rgba(41,98,255,.35)', bottomColor: 'rgba(41,98,255,0)', lineWidth: 2, ...common }, 0); break;
    default: mainS = chart.addSeries(LC.CandlestickSeries, { ...ohlc, wickUpColor: COL.up, wickDownColor: COL.down, borderVisible: false }, 0);
  }
  mainS.priceScale().applyOptions({
    scaleMargins: { top: 0.08, bottom: 0.22 },
    mode: S.logScale ? LC.PriceScaleMode.Logarithmic : LC.PriceScaleMode.Normal,
  });
  markersApi = LC.createSeriesMarkers(mainS, []);
}
const isLineType = () => S.ctype === 'line' || S.ctype === 'area';
function haPoint(b, prev) {
  const c = (b.open + b.high + b.low + b.close) / 4;
  const o = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
  return { time: b.time, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c };
}
function mainData() {
  if (isLineType()) return bars.map(b => ({ time: b.time, value: b.close }));
  if (S.ctype === 'ha') {
    haArr = [];
    bars.forEach((b, i) => { haArr[i] = haPoint(b, haArr[i - 1]); });
    return haArr;
  }
  return bars;
}
function mainLast() {
  const n = bars.length, b = bars[n - 1];
  if (isLineType()) return { time: b.time, value: b.close };
  if (S.ctype === 'ha') return (haArr[n - 1] = haPoint(b, haArr[n - 2]));
  return b;
}
function setChartType(type) {
  if (!CHART_TYPES[type]) return;
  S.ctype = type; save();
  createMainSeries();
  if (bars.length) { mainS.setData(mainData()); updateMarkers(); }
  syncPriceLines(true);
  dirty = true;
}
function setLogScale(on) {
  S.logScale = on; save();
  mainS.priceScale().applyOptions({ mode: on ? LC.PriceScaleMode.Logarithmic : LC.PriceScaleMode.Normal });
  $('btnLog').classList.toggle('active', on);
}

/* ---------------- Barres ---------------- */
function updateBar(b) {
  if (!bars.length) return;
  const last = bars[bars.length - 1];
  if (b.time < last.time) return;
  const isNew = b.time > last.time;
  if (isNew) bars.push(b); else bars[bars.length - 1] = b;
  mainS.update(mainLast());
  volS.update(volPoint(b));
  refreshIndicators(false);
  if (isNew) updateMarkers();
  if (!hoverBar) renderLegend(b);
}
// Agrège un nouveau prix dans la bougie en cours (mode simulé et cotations Yahoo)
function tickBar(p, v, ms = Date.now()) {
  const sec = TFS[S.tf];
  const t = bucket(toCT(ms), sec);
  const last = bars[bars.length - 1];
  if (!last) return;
  if (last.time === t) updateBar({ ...last, high: Math.max(last.high, p), low: Math.min(last.low, p), close: p, volume: last.volume + v });
  else if (t > last.time) updateBar({ time: t, open: last.close, high: Math.max(last.close, p), low: Math.min(last.close, p), close: p, volume: v });
}
// Regroupe des bougies sur des créneaux de `sec` secondes (4H, alignement des données Yahoo)
function aggregate(list, sec) {
  const out = [];
  for (const b of list) {
    const t = bucket(b.time, sec), last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, b.high); last.low = Math.min(last.low, b.low);
      last.close = b.close; last.volume += b.volume;
    } else if (!last || t > last.time) out.push({ ...b, time: t });
  }
  return out;
}
function barAt(t) {
  let lo = 0, hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time === t) return bars[mid];
    if (bars[mid].time < t) lo = mid + 1; else hi = mid - 1;
  }
  return null;
}

function setPrecision(p) {
  const d = decimals(p);
  priceFmt = { type: 'price', precision: d, minMove: 1 / 10 ** d };
  mainS.applyOptions({ priceFormat: priceFmt });
  indPrecision();
}

/* ---------------- Légende OHLC ---------------- */
let hoverBar = null;
function renderLegend(b) {
  if (!b) { $('legend').innerHTML = ''; renderPaneLegends(null); return; }
  const d = decimals(b.close);
  const chg = (b.close - b.open) / b.open, c = b.close >= b.open ? 'up' : 'down';
  $('legend').innerHTML = `
    <div class="l1"><span class="t">${lab(S.sym)} · ${TF_LABEL[S.tf]} · ${srcLabel(S.sym)}</span>
      <span><span class="k">O</span><span class="${c}">${fmtP(b.open, d)}</span></span>
      <span><span class="k">H</span><span class="${c}">${fmtP(b.high, d)}</span></span>
      <span><span class="k">B</span><span class="${c}">${fmtP(b.low, d)}</span></span>
      <span><span class="k">C</span><span class="${c}">${fmtP(b.close, d)}</span></span>
      <span class="${c}">${fmtPct(chg)}</span>
      ${S.ind.vol.on && b.volume ? `<span><span class="k">Vol</span>${fmtVol(b.volume)}</span>` : ''}
    </div>
    <div class="ind">${indLegendHTML(b.time)}</div>`;
  renderPaneLegends(b.time);
}
chart.subscribeCrosshairMove(param => {
  hoverBar = param.time != null ? barAt(param.time) : null;
  renderLegend(hoverBar || bars[bars.length - 1]);
});

/* ---------------- Clic sur le graphique : prix limite ---------------- */
chart.subscribeClick(param => {
  if (!param.point || ui.type !== 'limit' || param.paneIndex > 0) return;
  const price = mainS.coordinateToPrice(param.point.y);
  if (price == null || price <= 0) return;
  $('inLimit').value = roundP(price);
  renderSummary();
});

/* ---------------- Lignes de prix (positions, ordres) ---------------- */
let priceLines = [], linesSig = '';
function syncPriceLines(force) {
  const pos = S.positions.filter(p => p.sym === S.sym);
  const ords = S.orders.filter(o => o.sym === S.sym);
  const sig = JSON.stringify([S.sym, pos.map(p => [p.id, p.sl, p.tp]), ords.map(o => o.id)]);
  if (!force && sig === linesSig) return;
  linesSig = sig;
  priceLines.forEach(l => mainS.removePriceLine(l));
  priceLines = [];
  const add = (price, color, title, style = LC.LineStyle.Solid, width = 1) =>
    priceLines.push(mainS.createPriceLine({ price, color, title, lineStyle: style, lineWidth: width, axisLabelVisible: true }));
  for (const p of pos) {
    add(p.entry, COL.blue, `${p.side === 'long' ? 'LONG' : 'SHORT'} ${fmtQty(p.qty)}`, LC.LineStyle.Solid, 2);
    if (p.sl) add(p.sl, COL.down, 'SL', LC.LineStyle.Dashed);
    if (p.tp) add(p.tp, COL.up, 'TP', LC.LineStyle.Dashed);
    if (p.lev > 1) add(liqPrice(p), COL.liq, 'Liq.', LC.LineStyle.Dotted);
  }
  for (const o of ords) add(o.price, COL.limit, orderKind(o).toUpperCase(), LC.LineStyle.Dashed);
}

/* ---------------- Marqueurs d'entrée / sortie ---------------- */
function barTimeAt(ms) {
  const t = toCT(ms);
  if (!bars.length || t < bars[0].time) return null;
  let lo = 0, hi = bars.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bars[mid].time <= t) lo = mid; else hi = mid - 1; }
  return bars[lo].time;
}
function updateMarkers() {
  const mk = [];
  const entry = (p) => {
    const t = barTimeAt(p.time); if (t == null) return;
    const long = p.side === 'long';
    mk.push({ time: t, position: long ? 'belowBar' : 'aboveBar', color: long ? COL.up : COL.down, shape: long ? 'arrowUp' : 'arrowDown', text: long ? 'Long' : 'Short' });
  };
  S.positions.filter(p => p.sym === S.sym).forEach(entry);
  S.history.filter(h => h.sym === S.sym).slice(0, 60).forEach(h => {
    entry(h);
    const t = barTimeAt(h.closeTime); if (t == null) return;
    mk.push({ time: t, position: h.side === 'long' ? 'aboveBar' : 'belowBar', color: h.pnl >= 0 ? COL.up : COL.down, shape: 'circle', text: fmtSigned(h.pnl) });
  });
  mk.sort((a, b) => a.time - b.time);
  markersApi.setMarkers(mk);
}

/* =====================================================================
   Données de marché
   ===================================================================== */
async function fetchKlines(sym, tf) {
  const x = SYM[sym];
  if (x.yf) {
    if (yahoo.ok !== false) {
      try { return await fetchYahooKlines(x, tf); } catch {
        if (yahoo.ok === true) {   // le serveur marche mais Yahoo a eu un raté : on réessaie
          toast('Graphique momentanément indisponible, nouvel essai…', 'warn');
          setTimeout(() => { if (S.sym === sym && S.tf === tf) loadChart(); }, 4000);
          return [];
        }
        yahooDown();
      }
    }
    return simKlines(sym, tf);
  }
  if (feed.mode !== 'sim') {
    const hosts = feed.rest ? [feed.rest, ...REST_HOSTS.filter(h => h !== feed.rest)] : REST_HOSTS;
    for (const h of hosts) {
      try {
        const r = await fetch(`${h}/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        feed.rest = h;
        return data.map(k => ({ time: toCT(k[0]), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
      } catch { /* hôte suivant */ }
    }
    startSim();
  }
  return simKlines(sym, tf);
}

/* ---- Yahoo Finance (via server.mjs) ---- */
async function fetchYahooKlines(x, tf) {
  const [interval, range] = TF_YF[tf];
  const r = await fetch(`${MARKET_API}/chart?symbol=${encodeURIComponent(x.yf)}&interval=${interval}&range=${range}`,
    { headers: MARKET_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const res = (await r.json()).chart?.result?.[0];
  if (!res?.timestamp) throw new Error('réponse vide');
  yahoo.ok = true;
  const q = res.indicators.quote[0];
  const raw = res.timestamp
    .map((t, i) => ({ time: toCT(t * 1000), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] || 0 }))
    .filter(b => b.open != null && b.high != null && b.low != null && b.close != null);
  return aggregate(raw, TFS[tf]).slice(-1000);
}

let quotesBusy = false;
async function pollQuotes() {
  if (yahoo.ok === false || quotesBusy) return;
  quotesBusy = true;
  try {
    const r = await fetch(`${MARKET_API}/quotes?symbols=${YAHOO.map(x => encodeURIComponent(x.yf)).join(',')}`,
      { headers: MARKET_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    yahoo.ok = true;
    for (const x of YAHOO) {
      const q = data[x.yf];
      if (!q || q.price == null) continue;
      if (q.prevClose) M.open24[x.s] = q.prevClose;
      M.closed[x.s] = !q.open;
      const fresh = q.time !== M.qtime[x.s];
      M.qtime[x.s] = q.time;
      if (x.s === S.sym && fresh && q.open) tickBar(q.price, 0, q.time * 1000);
      onPrice(x.s, q.price);
    }
  } catch {
    if (yahoo.ok !== true) yahooDown();   // serveur local absent : prix simulés
  } finally {
    quotesBusy = false;
  }
}
function yahooDown() {
  if (yahoo.ok === false) return;
  yahoo.ok = false;
  YAHOO.forEach(initSim);
  ensureSimTimer();
  toast('Indices, matières premières, actions et forex en prix simulés : lance l\'app avec « node server.mjs » pour avoir les vrais prix.', 'warn');
  dirty = true;
}

/* ---- Binance temps réel ---- */
let tickWS = null, klineWS = null, wsFails = 0, wsEverOpened = false;
function connectTickers() {
  if (feed.mode === 'sim') return;
  const streams = CRYPTO.map(x => x.s.toLowerCase() + '@miniTicker').join('/');
  const ws = new WebSocket(`${feed.ws}/stream?streams=${streams}`);
  tickWS = ws;
  // Certains réseaux laissent la connexion pendre : on abandonne au bout de 6 s
  const timeout = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 6000);
  ws.onopen = () => { clearTimeout(timeout); wsEverOpened = true; wsFails = 0; feed.mode = 'live'; dirty = true; };
  ws.onmessage = e => {
    const d = JSON.parse(e.data).data;
    if (!d || !SYM[d.s]) return;
    M.open24[d.s] = +d.o;
    onPrice(d.s, +d.c);
  };
  ws.onclose = () => {
    clearTimeout(timeout);
    if (ws !== tickWS || feed.mode === 'sim') return;
    wsFails++;
    if (!wsEverOpened && wsFails >= WS_HOSTS.length + 1) { startSim(); if (!SYM[S.sym].yf) loadChart(); return; }
    if (!wsEverOpened || wsFails > 1) {
      // Essaie le serveur suivant, et y rebranche aussi le flux de bougies
      feed.ws = WS_HOSTS[(WS_HOSTS.indexOf(feed.ws) + 1) % WS_HOSTS.length];
      connectKline();
    }
    feed.mode = 'reconnecting'; dirty = true;
    setTimeout(connectTickers, wsEverOpened ? 3000 : 300);
  };
}
function connectKline() {
  if (klineWS) { const old = klineWS; klineWS = null; old.close(); }
  if (feed.mode === 'sim' || SYM[S.sym].yf) return;
  const sym = S.sym, tf = S.tf;
  const ws = new WebSocket(`${feed.ws}/ws/${sym.toLowerCase()}@kline_${tf}`);
  klineWS = ws;
  setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 6000);
  ws.onmessage = e => {
    if (ws !== klineWS) return;
    const k = JSON.parse(e.data).k;
    if (!k) return;
    updateBar({ time: toCT(k.t), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v });
    onPrice(sym, +k.c);
  };
  ws.onclose = () => {
    if (ws !== klineWS || feed.mode === 'sim') return;
    setTimeout(() => { if (ws === klineWS) loadChart(); }, 3000); // recharge pour combler le trou
  };
}

/* ---- Prix simulés (source injoignable) ---- */
const SIM = {};
let simTimer = null;
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function initSim(x) {
  SIM[x.s] = M.price[x.s] || x.base * (0.98 + Math.random() * 0.04);
  M.open24[x.s] ??= SIM[x.s] * (1 + gauss() * 0.01);
  M.price[x.s] = SIM[x.s];
  M.closed[x.s] = false;
}
function ensureSimTimer() { simTimer ??= setInterval(simTick, 1000); }
function startSim() {
  if (feed.mode === 'sim') return;
  feed.mode = 'sim';
  [tickWS, klineWS].forEach(w => w && w.close());
  tickWS = klineWS = null;
  CRYPTO.forEach(initSim);
  ensureSimTimer();
  toast('Binance est inaccessible : cryptos en données simulées.', 'warn');
  dirty = true;
}
function simKlines(sym, tf) {
  const x = SYM[sym], sec = TFS[tf], n = 600;
  const sig = (x.yf ? 0.0005 : 0.0012) * Math.sqrt(sec / 60);
  const now = bucket(toCT(Date.now()), sec);
  const out = []; let p = 1;
  for (let i = n - 1; i >= 0; i--) {
    const o = p, c = o * Math.exp(gauss() * sig);
    out.push({
      time: now - i * sec, open: o, close: c,
      high: Math.max(o, c) * (1 + Math.abs(gauss()) * sig * 0.4),
      low: Math.min(o, c) * (1 - Math.abs(gauss()) * sig * 0.4),
      volume: (40 + Math.random() * 80) * (1 + Math.abs(c - o) / o / sig),
    });
    p = c;
  }
  const k = SIM[sym] / p;
  out.forEach(b => { b.open *= k; b.high *= k; b.low *= k; b.close *= k; });
  return out;
}
function simTick() {
  for (const x of ASSETS) {
    if (!isSim(x.s)) continue;
    const p = (SIM[x.s] *= Math.exp(gauss() * (x.yf ? 0.00025 : 0.0007)));
    if (x.s === S.sym) tickBar(p, Math.random() * 6);
    onPrice(x.s, p);
  }
}

/* =====================================================================
   Moteur de trading
   ===================================================================== */
const dirOf = side => side === 'long' ? 1 : -1;
const pnlOf = (p, mark) => dirOf(p.side) * (mark - p.entry) * p.qty;
const liqPrice = p => p.entry * (1 - dirOf(p.side) * MAINT / p.lev);
// Un ordre en attente se déclenche quand le prix descend (below) ou monte (above) jusqu'à son niveau
const orderKind = o => o.side === 'long'
  ? (o.trigger === 'below' ? 'Achat limite' : 'Achat stop')
  : (o.trigger === 'above' ? 'Vente limite' : 'Vente stop');
const triggerText = o => `si le prix ${o.trigger === 'below' ? 'descend' : 'monte'} à ${fmtP(o.price)}`;
const defaultLimit = () => { const m = M.price[S.sym]; return m ? roundP(m * (1 - dirOf(ui.side) * 0.005)) : ''; };

function onPrice(sym, p) {
  const prev = M.price[sym];
  M.price[sym] = p;
  if (prev != null && p !== prev) M.lastDir[sym] = p > prev ? 1 : -1;
  checkOrders(sym, p);
  checkPositions(sym, p);
  checkAlerts(sym, prev, p);
  dirty = true;
}

function checkOrders(sym, p) {
  for (const o of S.orders.filter(o => o.sym === sym)) {
    const hit = o.trigger === 'above' ? p >= o.price : p <= o.price;
    if (!hit) continue;
    S.orders = S.orders.filter(x => x.id !== o.id);
    openPosition({ ...o, entry: o.price, reserved: true });
    toast(`Ordre exécuté : ${o.side === 'long' ? 'Long' : 'Short'} ${shortOf(sym)} à ${fmtP(o.price)}`, 'ok');
  }
}

function checkPositions(sym, p) {
  for (const pos of S.positions.filter(x => x.sym === sym)) {
    const d = dirOf(pos.side), liq = liqPrice(pos);
    if ((p - liq) * d <= 0) closePosition(pos, liq, 'Liquidation');
    else if (pos.sl && (p - pos.sl) * d <= 0) closePosition(pos, pos.sl, 'Stop-loss');
    else if (pos.tp && (p - pos.tp) * d >= 0) closePosition(pos, pos.tp, 'Take-profit');
  }
}

function openPosition(o) {
  const fee = o.qty * o.entry * FEE;
  S.cash -= (o.reserved ? 0 : o.margin) + fee;
  S.positions.push({
    id: S.seq++, sym: o.sym, side: o.side, qty: o.qty, entry: o.entry, lev: o.lev,
    margin: o.margin, sl: o.sl || null, tp: o.tp || null, openFee: fee, time: Date.now(),
  });
  save(); updateMarkers(); dirty = true;
}

function closePosition(pos, price, reason) {
  if (!S.positions.includes(pos)) return;
  const gross = pnlOf(pos, price);
  const fee = pos.qty * price * FEE;
  S.cash += pos.margin + gross - fee;
  S.positions = S.positions.filter(x => x !== pos);
  const net = gross - fee - pos.openFee;
  const pts = Math.round(net);
  S.points += pts;
  S.history.unshift({ ...pos, exit: price, pnl: net, pnlPct: net / pos.margin, points: pts, reason, closeTime: Date.now() });
  if (S.history.length > 500) S.history.length = 500;
  save(); updateMarkers(); dirty = true;
  floatPoints(pts);
  onScoreChange();
  toast(`${reason} · ${shortOf(pos.sym)} ${pos.side === 'long' ? 'Long' : 'Short'} : ${fmtSigned(net)} → ${fmtPts(pts)} pts`, net >= 0 ? 'ok' : 'err');
}

// Fermeture demandée par le joueur : impossible quand le marché est fermé
function closeManual(pos) {
  if (isClosed(pos.sym)) {
    toast(`${lab(pos.sym)} : marché fermé. Tu pourras fermer la position à la réouverture (${SYM[pos.sym].hours}).`, 'err');
    return false;
  }
  closePosition(pos, M.price[pos.sym] ?? pos.entry, 'Manuelle');
  return true;
}

function floatPoints(pts) {
  const f = document.createElement('span');
  f.className = 'pts-float ' + cls(pts);
  f.textContent = `${fmtPts(pts)} pts`;
  const score = $('score');
  score.appendChild(f);
  score.classList.remove('bump'); void score.offsetWidth; score.classList.add('bump');
  setTimeout(() => f.remove(), 1800);
}

function endPartie() {
  const a = account();
  const wins = S.history.filter(h => h.pnl > 0).length;
  const prevBest = S.parties.length ? Math.max(...S.parties.map(p => p.points)) : null;
  const ended = { n: S.partie, points: S.points, equity: a.equity, trades: S.history.length, wins, start: S.partieStart, end: Date.now() };
  S.parties.unshift(ended);
  if (S.parties.length > 100) S.parties.length = 100;
  S = freshState(S);
  save();
  onScoreChange();
  const record = prevBest != null && ended.points > prevBest;
  toast(`Partie #${ended.n} terminée avec ${fmtPts(ended.points)} pts${record ? ' — nouveau record !' : ''}. Partie #${S.partie} : 10 000 $ et 0 point.`, 'ok');
}

function account() {
  let upnl = 0, used = 0, reserved = 0;
  for (const p of S.positions) { upnl += pnlOf(p, M.price[p.sym] ?? p.entry); used += p.margin; }
  for (const o of S.orders) reserved += o.margin;
  const equity = S.cash + used + reserved + upnl;
  return { upnl, used, reserved, equity, perf: (equity - START_BALANCE) / START_BALANCE };
}

function readOrderForm() {
  const sym = S.sym, mark = M.price[sym];
  const margin = num($('inAmount').value);
  const lev = +$('inLev').value;
  const limit = num($('inLimit').value);
  const price = ui.type === 'market' ? mark : limit;
  const sl = num($('inSL').value), tp = num($('inTP').value);
  const qty = price > 0 && margin > 0 ? margin * lev / price : 0;
  return { sym, mark, margin, lev, price, sl: sl > 0 ? sl : null, tp: tp > 0 ? tp : null, qty, side: ui.side };
}

function submitOrder() {
  const f = readOrderForm(), x = SYM[f.sym];
  const isLimit = ui.type === 'limit';
  if (!f.mark) return toast('Prix pas encore disponible, patientez une seconde.', 'err');
  if (!(f.margin > 0)) return toast('Indiquez un montant de marge.', 'err');
  if (!(f.price > 0)) return toast('Indiquez un prix limite valide.', 'err');
  if (!isLimit && isClosed(f.sym)) {
    return toast(`${x.label} : marché fermé (ouvert ${x.hours}). Tu peux placer un ordre Limite, il s'exécutera après la réouverture.`, 'err');
  }
  if (isLimit && Math.abs(f.price / f.mark - 1) < 0.0002) {
    return toast('Ton prix limite est presque égal au prix actuel : choisis « Marché », ou un prix plus haut ou plus bas.', 'err');
  }
  const fee = f.qty * f.price * FEE;
  if (f.margin + fee > S.cash + 1e-9) return toast(`Solde insuffisant (disponible : ${fmtUSD(S.cash)}).`, 'err');
  const d = dirOf(f.side);
  if (f.sl && (f.sl - f.price) * d >= 0) return toast(`Le stop-loss doit être ${d > 0 ? 'sous' : 'au-dessus'} du prix d'entrée.`, 'err');
  if (f.tp && (f.tp - f.price) * d <= 0) return toast(`Le take-profit doit être ${d > 0 ? 'au-dessus' : 'sous'} du prix d'entrée.`, 'err');

  if (!isLimit) {
    const entry = f.mark, qty = f.margin * f.lev / entry;
    openPosition({ ...f, entry, qty });
    toast(`${f.side === 'long' ? 'Achat' : 'Vente à découvert'} de ${fmtQty(qty)} ${x.short} à ${fmtP(entry)}`, 'ok');
  } else {
    const o = {
      id: S.seq++, sym: f.sym, side: f.side, price: f.price, trigger: f.price < f.mark ? 'below' : 'above',
      qty: f.qty, lev: f.lev, margin: f.margin, sl: f.sl, tp: f.tp, time: Date.now(),
    };
    S.cash -= f.margin;
    S.orders.push(o);
    save(); dirty = true;
    toast(`${orderKind(o)} placé sur ${x.short} : exécuté ${triggerText(o)} (${fmtPct(f.price / f.mark - 1)}).`, 'ok');
  }
  $('inSL').value = ''; $('inTP').value = '';
}

function cancelOrder(id) {
  const o = S.orders.find(x => x.id === id);
  if (!o) return;
  S.cash += o.margin;
  S.orders = S.orders.filter(x => x !== o);
  save(); dirty = true;
  toast('Ordre annulé.');
}

function editLevel(id, key) {
  const p = S.positions.find(x => x.id === id);
  if (!p) return;
  const label = key === 'sl' ? 'Stop-loss' : 'Take-profit';
  const v = prompt(`${label} pour ${lab(p.sym)} (${p.side}) — laisser vide pour supprimer :`, p[key] ?? '');
  if (v === null) return;
  if (v.trim() === '') { p[key] = null; save(); dirty = true; return; }
  const n = num(v), mark = M.price[p.sym], d = dirOf(p.side);
  if (!(n > 0)) return toast('Valeur invalide.', 'err');
  if (key === 'sl' && (n - mark) * d >= 0) return toast(`Le stop-loss doit être ${d > 0 ? 'sous' : 'au-dessus'} du prix actuel.`, 'err');
  if (key === 'tp' && (n - mark) * d <= 0) return toast(`Le take-profit doit être ${d > 0 ? 'au-dessus' : 'sous'} du prix actuel.`, 'err');
  p[key] = n; save(); dirty = true;
}

/* =====================================================================
   Rendu
   ===================================================================== */
let dirty = true;
function frame() {
  if (dirty) { dirty = false; renderAll(); }
  drawingsFrame();
  paneLegendsFrame();
  requestAnimationFrame(frame);
}
function renderAll() {
  renderFeed();
  renderHeader();
  renderAccount();
  renderScore();
  renderWatchlist();
  renderPositions();
  renderOrders();
  renderHistory();
  renderParties();
  renderSummary();
  syncPriceLines(false);
}

function renderFeed() {
  const x = SYM[S.sym];
  let mode, txt;
  if (isSim(S.sym)) { mode = 'sim'; txt = 'Données simulées'; }
  else if (!x.yf) { mode = feed.mode; txt = { live: 'Temps réel · Binance', connecting: 'Connexion…', reconnecting: 'Reconnexion…' }[feed.mode]; }
  else if (M.closed[S.sym] == null) { mode = 'connecting'; txt = 'Connexion…'; }
  else if (M.closed[S.sym]) { mode = 'closed'; txt = 'Marché fermé'; }
  else { mode = 'live'; txt = 'Marché ouvert · Yahoo Finance'; }
  const el = $('feedStatus');
  if (el.className !== 'feed ' + mode) el.className = 'feed ' + mode;
  const span = el.querySelector('span');
  if (span.textContent !== txt) span.textContent = txt;
  el.title = x.hours ? `Horaires : ${x.hours}` : 'Ouvert 24h/24, 7j/7';
}

function renderHeader() {
  const x = SYM[S.sym], p = M.price[S.sym], o = M.open24[S.sym];
  $('hdrSym').textContent = x.label;
  $('hdrPrice').textContent = fmtP(p);
  $('hdrPrice').className = 'hdr-price ' + (M.lastDir[S.sym] > 0 ? 'up' : M.lastDir[S.sym] < 0 ? 'down' : '');
  if (p && o) {
    const c = (p - o) / o;
    $('hdrChg').textContent = `${(p - o > 0 ? '+' : '') + fmtP(p - o, decimals(p))} (${fmtPct(c)})`;
    $('hdrChg').className = 'hdr-chg ' + cls(c);
  } else {
    $('hdrChg').textContent = '';
  }
  document.title = p ? `${x.short} ${fmtP(p)} — PaperView` : 'PaperView — Trading fictif';
}

function renderAccount() {
  const a = account();
  $('accCash').textContent = fmtUSD(S.cash);
  $('accEquity').textContent = fmtUSD(a.equity);
  $('accUpnl').textContent = fmtSigned(a.upnl); $('accUpnl').className = cls(a.upnl);
  $('accMargin').textContent = fmtUSD(a.used + a.reserved);
  $('accPerf').textContent = fmtPct(a.perf); $('accPerf').className = cls(a.perf);
}

function renderScore() {
  const [, name, color] = rankOf(S.points);
  $('scorePartie').textContent = `Partie #${S.partie}`;
  $('scorePts').textContent = fmtPts(S.points);
  $('scorePts').className = cls(S.points);
  const r = $('scoreRank');
  r.textContent = name;
  r.style.color = color;
}

/* ---- Liste de suivi ---- */
function buildWatchlist() {
  $('wlCats').innerHTML = CATS.map(([k, l]) => `<button data-cat="${k}" class="${k === ui.cat ? 'active' : ''}">${l}</button>`).join('');
  $('wlBody').innerHTML = ASSETS.map(x => `
    <div class="wl-row" data-sym="${x.s}">
      <span class="s"><b>${x.cat === 'crypto' ? x.short : x.label}<i class="badge" title="Position ouverte" hidden></i></b>
        <small>${x.name}<span class="cl" hidden> · fermé</span></small></span>
      <span class="p">—</span><span class="c">—</span>
    </div>`).join('');
}
function filterWatchlist() {
  const q = $('wlFilter').value.trim().toLowerCase();
  for (const row of $('wlBody').children) {
    const x = SYM[row.dataset.sym];
    const inCat = ui.cat === 'all' || x.cat === ui.cat;
    const match = !q || [x.short, x.label, x.name].some(t => t.toLowerCase().includes(q));
    row.hidden = !(inCat && match);
  }
}
function setCat(cat) {
  ui.cat = cat;
  document.querySelectorAll('#wlCats [data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  filterWatchlist();
}
const flashTimers = {};
function renderWatchlist() {
  const open = new Set(S.positions.map(p => p.sym));
  for (const row of $('wlBody').children) {
    const s = row.dataset.sym, p = M.price[s], o = M.open24[s];
    row.classList.toggle('active', s === S.sym);
    row.querySelector('.badge').hidden = !open.has(s);
    row.querySelector('.cl').hidden = !isClosed(s);
    const pe = row.querySelector('.p');
    const txt = fmtP(p);
    if (pe.textContent !== txt) {
      if (pe.textContent !== '—' && M.lastDir[s]) {
        pe.classList.remove('flash-up', 'flash-down');
        pe.classList.add(M.lastDir[s] > 0 ? 'flash-up' : 'flash-down');
        clearTimeout(flashTimers[s]);
        flashTimers[s] = setTimeout(() => pe.classList.remove('flash-up', 'flash-down'), 350);
      }
      pe.textContent = txt;
    }
    if (p && o) { const c = (p - o) / o; const ce = row.querySelector('.c'); ce.textContent = fmtPct(c); ce.className = 'c ' + cls(c); }
  }
}

/* ---- Positions ---- */
let posSig = '';
function renderPositions() {
  $('cntPos').textContent = S.positions.length;
  const el = $('tab-positions');
  const sig = S.positions.map(p => [p.id, p.sl, p.tp].join(':')).join('|') || 'none';
  if (sig !== posSig) {
    posSig = sig;
    if (!S.positions.length) {
      el.innerHTML = '<div class="empty">Aucune position ouverte. Passez un ordre avec le panneau de droite.</div>';
    } else {
      el.innerHTML = `<table><thead><tr>
        <th>Symbole</th><th>Côté</th><th>Taille</th><th>Entrée</th><th>Prix actuel</th><th>Levier</th>
        <th>Marge</th><th>Liquidation</th><th>Stop-loss</th><th>Take-profit</th><th>PnL</th><th></th>
        </tr></thead><tbody>${S.positions.map(p => `
        <tr data-id="${p.id}">
          <td class="sym" data-go="${p.sym}">${lab(p.sym)}</td>
          <td><span class="side-tag ${p.side}">${p.side === 'long' ? 'LONG' : 'SHORT'}</span></td>
          <td>${fmtQty(p.qty)}</td>
          <td>${fmtP(p.entry)}</td>
          <td data-f="mark">—</td>
          <td>${p.lev}×</td>
          <td>${fmtUSD(p.margin)}</td>
          <td class="muted">${p.lev > 1 ? fmtP(liqPrice(p)) : '—'}</td>
          <td><span class="edit" data-edit="sl">${p.sl ? fmtP(p.sl) : 'Ajouter'}</span></td>
          <td><span class="edit" data-edit="tp">${p.tp ? fmtP(p.tp) : 'Ajouter'}</span></td>
          <td data-f="pnl">—</td>
          <td><button class="act" data-close="${p.id}">Fermer</button></td>
        </tr>`).join('')}</tbody></table>`;
    }
  }
  for (const p of S.positions) {
    const tr = el.querySelector(`tr[data-id="${p.id}"]`);
    if (!tr) continue;
    const mark = M.price[p.sym] ?? p.entry, pnl = pnlOf(p, mark);
    tr.querySelector('[data-f=mark]').textContent = fmtP(mark) + (isClosed(p.sym) ? ' (fermé)' : '');
    const pe = tr.querySelector('[data-f=pnl]');
    pe.textContent = `${fmtSigned(pnl)} (${fmtPct(pnl / p.margin)})`;
    pe.className = cls(pnl);
  }
  if (ui.tab === 'positions') {
    const want = S.positions.length ? 'closeall' : '';
    if ($('tabActions').dataset.kind !== want) {
      $('tabActions').dataset.kind = want;
      $('tabActions').innerHTML = want ? '<button class="act" data-closeall>Tout fermer</button>' : '';
    }
  }
}

/* ---- Ordres en attente ---- */
let ordSig = '';
function renderOrders() {
  $('cntOrd').textContent = S.orders.length;
  const el = $('tab-orders');
  const sig = S.orders.map(o => o.id).join('|') || 'none';
  if (sig !== ordSig) {
    ordSig = sig;
    el.innerHTML = !S.orders.length
      ? '<div class="empty">Aucun ordre en attente. Choisis « Limite », puis clique sur le graphique pour fixer le prix.</div>'
      : `<table><thead><tr><th>Symbole</th><th>Type</th><th>Exécution</th><th>Distance</th><th>Taille</th><th>Levier</th><th>Marge réservée</th><th>SL</th><th>TP</th><th>Créé le</th><th></th></tr></thead>
        <tbody>${S.orders.map(o => `<tr data-oid="${o.id}">
          <td class="sym" data-go="${o.sym}">${lab(o.sym)}</td>
          <td><span class="side-tag ${o.side}">${orderKind(o).toUpperCase()}</span></td>
          <td>${triggerText(o)}</td>
          <td data-f="dist">—</td>
          <td>${fmtQty(o.qty)}</td><td>${o.lev}×</td><td>${fmtUSD(o.margin)}</td>
          <td>${o.sl ? fmtP(o.sl) : '—'}</td><td>${o.tp ? fmtP(o.tp) : '—'}</td>
          <td class="muted">${fmtDate(o.time)}</td>
          <td><button class="act" data-cancel="${o.id}">Annuler</button></td>
        </tr>`).join('')}</tbody></table>`;
  }
  for (const o of S.orders) {
    const cell = el.querySelector(`tr[data-oid="${o.id}"] [data-f=dist]`);
    const mark = M.price[o.sym];
    if (cell && mark) cell.textContent = fmtPct(o.price / mark - 1);
  }
}

/* ---- Historique ---- */
let histSig = '';
function renderHistory() {
  $('cntHist').textContent = S.history.length;
  const sig = S.history.length + ':' + (S.history[0]?.closeTime || 0);
  if (sig !== histSig) {
    histSig = sig;
    $('tab-history').innerHTML = !S.history.length
      ? '<div class="empty">Vos trades clôturés apparaîtront ici.</div>'
      : `<table><thead><tr><th>Symbole</th><th>Côté</th><th>Taille</th><th>Entrée</th><th>Sortie</th><th>Levier</th><th>PnL net</th><th>Rendement</th><th>Points</th><th>Motif</th><th>Ouverture</th><th>Clôture</th></tr></thead>
        <tbody>${S.history.map(h => `<tr>
          <td class="sym" data-go="${h.sym}">${lab(h.sym)}</td>
          <td><span class="side-tag ${h.side}">${h.side === 'long' ? 'LONG' : 'SHORT'}</span></td>
          <td>${fmtQty(h.qty)}</td><td>${fmtP(h.entry)}</td><td>${fmtP(h.exit)}</td><td>${h.lev}×</td>
          <td class="${cls(h.pnl)}">${fmtSigned(h.pnl)}</td><td class="${cls(h.pnl)}">${fmtPct(h.pnlPct)}</td>
          <td class="${cls(h.pnl)}">${fmtPts(h.points ?? Math.round(h.pnl))}</td>
          <td>${esc(h.reason)}</td><td class="muted">${fmtDate(h.time)}</td><td class="muted">${fmtDate(h.closeTime)}</td>
        </tr>`).join('')}</tbody></table>`;
    if (ui.tab === 'history') {
      const n = S.history.length, wins = S.history.filter(h => h.pnl > 0).length;
      const total = S.history.reduce((s, h) => s + h.pnl, 0);
      $('tabActions').innerHTML = n ? `<span>Trades <b>${n}</b></span><span>Réussite <b>${Math.round(wins / n * 100)} %</b></span><span>PnL réalisé <b class="${cls(total)}">${fmtSigned(total)}</b></span>` : '';
    }
  }
}

/* ---- Parties ---- */
let partiesSig = '';
function renderParties() {
  $('cntParties').textContent = S.partie;
  const el = $('tab-parties');
  const sig = [S.partie, S.points, S.history.length, S.parties.length].join(':');
  if (sig !== partiesSig) {
    partiesSig = sig;
    const wins = S.history.filter(h => h.pnl > 0).length;
    const current = { n: S.partie, points: S.points, equity: null, trades: S.history.length, wins, start: S.partieStart, end: null };
    const all = [current, ...S.parties];
    const best = S.parties.length ? Math.max(...all.map(p => p.points)) : null;
    el.innerHTML = `<table><thead><tr><th>Partie</th><th>Points</th><th>Rang</th><th>Équité finale</th><th>Trades</th><th>Réussite</th><th>Début</th><th>Fin</th></tr></thead>
      <tbody>${all.map(p => {
        const [, rank, color] = rankOf(p.points);
        const live = p === current;
        return `<tr class="${live ? 'current' : ''}">
          <td>Partie #${p.n}${live ? '<span class="live-tag">EN COURS</span>' : ''}</td>
          <td class="${cls(p.points)}"><b>${fmtPts(p.points)}</b>${best != null && p.points === best ? '<span class="best" title="Meilleur score">★</span>' : ''}</td>
          <td style="color:${color}">${rank}</td>
          <td ${live ? 'data-f="equity"' : ''}>${live ? '—' : fmtUSD(p.equity)}</td>
          <td>${p.trades}</td>
          <td>${p.trades ? Math.round(p.wins / p.trades * 100) + ' %' : '—'}</td>
          <td class="muted">${fmtDate(p.start)}</td>
          <td class="muted">${live ? '—' : fmtDate(p.end)}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
    if (ui.tab === 'parties') {
      $('tabActions').innerHTML = `<span>Parties terminées <b>${S.parties.length}</b></span>`
        + (S.parties.length ? `<span>Meilleur score <b class="${cls(best)}">${fmtPts(best)} pts</b></span>` : '');
    }
  }
  const eq = el.querySelector('[data-f=equity]');
  if (eq) eq.textContent = fmtUSD(account().equity);
}

/* ---- Résumé de l'ordre ---- */
function renderSummary() {
  const f = readOrderForm(), x = SYM[S.sym];
  const btn = $('btnSubmit');
  btn.classList.toggle('long', ui.side === 'long');
  btn.classList.toggle('short', ui.side === 'short');
  btn.textContent = `${ui.side === 'long' ? 'Acheter / Long' : 'Vendre / Short'} ${x.short}${ui.type === 'limit' ? ' (limite)' : ''}`;
  const ok = f.qty > 0;
  const notional = ok ? f.qty * f.price : 0;
  const liq = ok && f.lev > 1 ? liqPrice({ entry: f.price, side: f.side, lev: f.lev }) : null;
  const outcome = lvl => fmtSigned(dirOf(f.side) * (lvl - f.price) * f.qty - notional * FEE * 2);
  let exec = '';
  if (ui.type === 'limit' && ok && f.mark) {
    const o = { side: f.side, price: f.price, trigger: f.price < f.mark ? 'below' : 'above' };
    exec = `<dt>Exécution</dt><dd>${orderKind(o)} ${triggerText(o).replace('si le prix ', '')} (${fmtPct(f.price / f.mark - 1)})</dd>`;
  } else if (ui.type === 'market' && isClosed(S.sym)) {
    exec = '<dt>Marché</dt><dd class="down">fermé</dd>';
  }
  $('summary').innerHTML = `
    ${exec}
    <dt>Prix</dt><dd>${ok ? fmtP(f.price) : '—'}</dd>
    <dt>Quantité</dt><dd>${ok ? fmtQty(f.qty) + ' ' + x.short : '—'}</dd>
    <dt>Valeur de la position</dt><dd>${ok ? fmtUSD(notional) : '—'}</dd>
    <dt>Frais estimés</dt><dd>${ok ? fmtUSD(notional * FEE) : '—'}</dd>
    <dt>Prix de liquidation</dt><dd class="${liq ? 'down' : ''}">${liq ? fmtP(liq) : 'aucun (1×)'}</dd>
    ${ok && f.sl ? `<dt>Si stop-loss touché</dt><dd class="down">${outcome(f.sl)}</dd>` : ''}
    ${ok && f.tp ? `<dt>Si take-profit touché</dt><dd class="up">${outcome(f.tp)}</dd>` : ''}
    <dt>Disponible</dt><dd>${fmtUSD(S.cash)}</dd>`;
}

/* ---- Toasts ---- */
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 5000);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

/* =====================================================================
   Navigation & événements
   ===================================================================== */
let loadToken = 0;
async function loadChart() {
  const tok = ++loadToken;
  hoverBar = null;
  bars = [];
  resetDrawingState();
  mainS.setData([]); volS.setData([]); refreshIndicators(true);
  renderLegend(null);
  if (klineWS) { const old = klineWS; klineWS = null; old.close(); }   // coupe le flux de l'ancien symbole
  const data = await fetchKlines(S.sym, S.tf);
  if (tok !== loadToken || !data.length) return;
  bars = data;
  const last = bars[bars.length - 1];
  if (M.price[S.sym] == null) M.price[S.sym] = last.close;
  setPrecision(last.close);
  mainS.setData(mainData());
  volS.setData(bars.map(volPoint));
  refreshIndicators(true);
  updateMarkers();
  syncPriceLines(true);
  chart.timeScale().setVisibleLogicalRange({ from: bars.length - 140, to: bars.length + 8 });
  renderLegend(last);
  connectKline();
  if (ui.type === 'limit' && !$('inLimit').value) $('inLimit').value = defaultLimit();
  dirty = true;
}

function selectSymbol(sym) {
  if (!SYM[sym] || sym === S.sym) return;
  S.sym = sym; save();
  ['inLimit', 'inSL', 'inTP'].forEach(id => { $(id).value = ''; });
  if (ui.type === 'limit') $('inLimit').value = defaultLimit();
  dirty = true;
  loadChart();
}
function selectTF(tf) {
  S.tf = tf; save();
  document.querySelectorAll('#tfGroup button').forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
  loadChart();
}
function setSide(side) {
  ui.side = side;
  document.querySelectorAll('.side-switch [data-side]').forEach(x => x.classList.toggle('active', x.dataset.side === side));
  renderSummary();
}
function setType(type) {
  ui.type = type;
  document.querySelectorAll('.type-switch [data-type]').forEach(x => x.classList.toggle('active', x.dataset.type === type));
  $('fLimit').hidden = type !== 'limit';
  // Prix proposé un peu « meilleur » que le marché, pour que l'ordre attende vraiment
  if (type === 'limit' && !$('inLimit').value) $('inLimit').value = defaultLimit();
  updateHint(); renderSummary();
}
function updateHint() {
  const h = $('hint'), msg = drawHint();
  if (msg) { h.hidden = false; h.textContent = msg; }
  else if (ui.type === 'limit') { h.hidden = false; h.textContent = 'Cliquez sur le graphique pour fixer le prix limite'; }
  else h.hidden = true;
}
function fitChart() {
  if (!bars.length) return;
  chart.timeScale().setVisibleLogicalRange({ from: bars.length - 140, to: bars.length + 8 });
  chart.panes().forEach(p => p.getSeries().forEach(s => s.priceScale().applyOptions({ autoScale: true })));
}

function bindEvents() {
  $('tfGroup').innerHTML = Object.keys(TFS).map(tf => `<button data-tf="${tf}" class="${tf === S.tf ? 'active' : ''}">${TF_LABEL[tf]}</button>`).join('');
  $('tfGroup').addEventListener('click', e => { const b = e.target.closest('[data-tf]'); if (b) selectTF(b.dataset.tf); });

  $('chartType').innerHTML = Object.entries(CHART_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  $('chartType').value = S.ctype;
  $('chartType').addEventListener('change', e => setChartType(e.target.value));
  $('btnLog').classList.toggle('active', S.logScale);
  $('btnLog').addEventListener('click', () => setLogScale(!S.logScale));
  $('btnFit').addEventListener('click', fitChart);

  $('wlBody').addEventListener('click', e => { const r = e.target.closest('[data-sym]'); if (r) selectSymbol(r.dataset.sym); });
  $('wlCats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) setCat(b.dataset.cat); });
  $('wlFilter').addEventListener('input', filterWatchlist);

  document.querySelectorAll('.side-switch [data-side]').forEach(b => b.addEventListener('click', () => setSide(b.dataset.side)));
  document.querySelectorAll('.type-switch [data-type]').forEach(b => b.addEventListener('click', () => setType(b.dataset.type)));
  $('pctBtns').addEventListener('click', e => {
    const b = e.target.closest('[data-pct]'); if (!b) return;
    const lev = +$('inLev').value;
    const amount = S.cash * (+b.dataset.pct / 100) / (1 + lev * FEE); // garde de quoi payer les frais
    $('inAmount').value = Math.max(0, Math.floor(amount * 100) / 100);
    renderSummary();
  });
  ['inAmount', 'inLimit', 'inSL', 'inTP', 'inLev'].forEach(id => $(id).addEventListener('input', renderSummary));
  $('btnSubmit').addEventListener('click', submitOrder);
  document.querySelector('.order-panel').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submitOrder(); });

  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    ui.tab = b.dataset.tab;
    document.querySelectorAll('#tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
    ['positions', 'orders', 'history', 'parties', 'board'].forEach(t => { $('tab-' + t).hidden = t !== ui.tab; });
    $('tabActions').innerHTML = ''; $('tabActions').dataset.kind = '';
    histSig = partiesSig = ''; dirty = true;
  });
  $('tabActions').addEventListener('click', e => {
    if (!e.target.closest('[data-closeall]')) return;
    if (!confirm(`Fermer les ${S.positions.length} positions au prix du marché ?`)) return;
    const blocked = [...S.positions].filter(p => !closeManual(p)).length;
    if (blocked) toast(`${blocked} position(s) restent ouvertes : leur marché est fermé.`, 'warn');
  });
  document.querySelector('.bottom-panel').addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) return selectSymbol(go.dataset.go);
    const c = e.target.closest('[data-close]');
    if (c) { const p = S.positions.find(x => x.id === +c.dataset.close); if (p) closeManual(p); return; }
    const k = e.target.closest('[data-cancel]');
    if (k) return cancelOrder(+k.dataset.cancel);
    const ed = e.target.closest('[data-edit]');
    if (ed) editLevel(+ed.closest('tr').dataset.id, ed.dataset.edit);
  });

  $('btnReset').addEventListener('click', () => {
    if (!confirm(`Terminer la partie #${S.partie} avec ${fmtPts(S.points)} points ?\n\n`
      + 'Le solde revient à 10 000 $, les points repartent à 0 et une nouvelle partie commence. '
      + 'Les positions et ordres en cours sont abandonnés. Le score reste dans l\'onglet « Parties ».')) return;
    endPartie();
    posSig = ordSig = histSig = partiesSig = '';
    $('tabActions').innerHTML = ''; $('tabActions').dataset.kind = '';
    updateMarkers(); syncPriceLines(true); dirty = true;
  });
}

async function init() {
  buildWatchlist();
  bindEvents();
  createMainSeries();
  initIndicators();
  initDrawings();
  initLeaderboard();
  requestAnimationFrame(frame);
  pollQuotes();
  setInterval(pollQuotes, 5000);
  await loadChart();
  connectTickers();
}

// Lancé une fois tous les scripts chargés (indicators.js, drawings.js, tuto.js)
window.addEventListener('DOMContentLoaded', init);
