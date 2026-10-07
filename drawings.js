'use strict';

/* =====================================================================
   Outils de dessin façon TradingView, sur un calque SVG posé sur le
   panneau principal. Les points sont stockés en (temps, prix) : les
   dessins suivent le zoom, le défilement et les changements d'unité.
   Stockage : S.drawings[symbole] = [{ id, type, color, pts: [{ t, p }], text? }]
   ===================================================================== */

const ICON = {
  cursor: '<path d="M6 3l12 9-5.5 1.2 2.7 6.1-2.3 1-2.7-6.2L6 18z" fill="currentColor" stroke="none"/>',
  trend: '<line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="1.8"/><circle cx="20" cy="4" r="1.8"/>',
  ray: '<line x1="4" y1="19" x2="22" y2="5"/><circle cx="4" cy="19" r="1.8"/><circle cx="12" cy="13" r="1.8"/>',
  hline: '<line x1="2" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="1.8"/>',
  vline: '<line x1="12" y1="2" x2="12" y2="22"/><circle cx="12" cy="12" r="1.8"/>',
  channel: '<line x1="3" y1="15" x2="17" y2="5"/><line x1="7" y1="20" x2="21" y2="10"/><line x1="5" y1="17.5" x2="19" y2="7.5" stroke-dasharray="2 2"/>',
  fib: '<line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  measure: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  long: '<rect x="4" y="4" width="16" height="9" fill="rgba(38,166,154,.35)" stroke="#26a69a"/><rect x="4" y="13" width="16" height="6" fill="rgba(239,83,80,.35)" stroke="#ef5350"/>',
  short: '<rect x="4" y="4" width="16" height="6" fill="rgba(239,83,80,.35)" stroke="#ef5350"/><rect x="4" y="10" width="16" height="9" fill="rgba(38,166,154,.35)" stroke="#26a69a"/>',
  text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
  brush: '<path d="M4 18c3-1 3-5 6-5s2 5 6 3 3-8 5-9"/>',
  alert: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path d="M6 8h4M14 8h4"/>',
  hide: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const svgIcon = inner => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// n = nombre de clics pour tracer l'outil
const TOOLS = [
  { id: 'cursor', name: 'Curseur', key: 'Échap' },
  { sep: true },
  { id: 'trend', name: 'Ligne de tendance', key: 'Alt+T', n: 2 },
  { id: 'ray', name: 'Rayon (ligne prolongée)', key: 'Alt+Y', n: 2 },
  { id: 'hline', name: 'Ligne horizontale (support / résistance)', key: 'Alt+H', n: 1 },
  { id: 'vline', name: 'Ligne verticale', key: 'Alt+V', n: 1 },
  { id: 'channel', name: 'Canal parallèle', key: 'Alt+C', n: 3 },
  { sep: true },
  { id: 'fib', name: 'Retracement de Fibonacci', key: 'Alt+F', n: 2 },
  { id: 'rect', name: 'Rectangle (zone)', key: 'Alt+R', n: 2 },
  { id: 'measure', name: 'Mesure (écart de prix et durée)', key: 'Alt+M', n: 2 },
  { sep: true },
  { id: 'long', name: 'Position longue (risque / gain)', key: 'Alt+L', n: 2 },
  { id: 'short', name: 'Position courte (risque / gain)', key: 'Alt+S', n: 2 },
  { sep: true },
  { id: 'text', name: 'Texte', key: 'Alt+X', n: 1 },
  { id: 'brush', name: 'Pinceau (dessin libre)', key: 'Alt+B', n: 0 },
  { id: 'alert', name: 'Alerte de prix', key: 'Alt+A', n: 1 },
  { sep: true },
  { id: 'magnet', name: 'Aimant : colle les points aux prix des bougies', toggle: true },
  { id: 'hide', name: 'Masquer / afficher les dessins', toggle: true },
  { id: 'clear', name: 'Supprimer tous les dessins de ce graphique' },
];
const TOOL = Object.fromEntries(TOOLS.filter(t => t.id).map(t => [t.id, t]));
const DRAW_COLORS = ['#2962ff', '#26a69a', '#ef5350', '#f7a600', '#ab47bc', '#d1d4dc'];
const FIB = [[0, '#787b86'], [0.236, '#ef5350'], [0.382, '#81c784'], [0.5, '#4caf50'], [0.618, '#009688'], [0.786, '#64b5f6'], [1, '#787b86']];
const HINTS = {
  trend: ['Clique sur le point de départ de la ligne', 'Clique sur le point d\'arrivée'],
  ray: ['Clique sur le point de départ du rayon', 'Clique pour donner la direction'],
  hline: ['Clique sur le prix où placer la ligne'],
  vline: ['Clique sur la bougie où placer la ligne'],
  channel: ['Clique sur le début du canal', 'Clique sur la fin du canal', 'Clique pour fixer la largeur du canal'],
  fib: ['Clique sur le début du mouvement (creux ou sommet)', 'Clique sur la fin du mouvement'],
  rect: ['Clique sur un coin de la zone', 'Clique sur le coin opposé'],
  measure: ['Clique sur le point de départ de la mesure', 'Clique sur le point d\'arrivée'],
  long: ['Clique sur ton prix d\'entrée', 'Clique sur ton stop-loss (l\'objectif se place à 2 fois le risque)'],
  short: ['Clique sur ton prix d\'entrée', 'Clique sur ton stop-loss (l\'objectif se place à 2 fois le risque)'],
  text: ['Clique là où placer le texte'],
  brush: ['Maintiens le clic et dessine'],
  alert: ['Clique sur le prix qui doit déclencher l\'alerte'],
};

const D = { tool: 'cursor', color: '#2962ff', draft: null, sel: null, drag: null, down: null, brushing: false, magnet: false, hidden: false, ver: 0, sig: '', undo: [] };
const drawList = () => (S.drawings[S.sym] ||= []);
const layer = () => $('drawLayer');

/* ---------------- Coordonnées ---------------- */
function geo() {
  const ts = chart.timeScale(), x0 = ts.logicalToCoordinate(0), x1 = ts.logicalToCoordinate(1);
  if (x0 == null || x1 == null || !mainS) return null;
  return {
    x0, sp: (x1 - x0) || 1, W: ts.width(), H: chart.panes()[0].getHeight(),
    PS: mainS.priceScale().width(), TH: ts.height(), TB: $('chart').clientHeight - ts.height(),
  };
}
// Position (fractionnaire) dans la liste des bougies, prolongée avant et après
function logicalOfTime(t) {
  const n = bars.length, sec = TFS[S.tf];
  if (!n) return 0;
  if (t >= bars[n - 1].time) return n - 1 + (t - bars[n - 1].time) / sec;
  if (t <= bars[0].time) return (t - bars[0].time) / sec;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (bars[mid].time <= t) lo = mid; else hi = mid; }
  return lo + (t - bars[lo].time) / (bars[hi].time - bars[lo].time);
}
function timeOfLogical(L) {
  const n = bars.length, sec = TFS[S.tf];
  if (L >= n - 1) return bars[n - 1].time + Math.round((L - (n - 1)) * sec);
  if (L <= 0) return bars[0].time + Math.round(L * sec);
  const i = Math.floor(L);
  return bars[i].time + Math.round((L - i) * (bars[i + 1].time - bars[i].time));
}
// Point sous la souris ; les points se calent sur les bougies (et sur leurs prix avec l'aimant)
function toPoint(e, g, exact = false) {
  const r = $('chart').getBoundingClientRect();
  const x = e.clientX - r.left, y = Math.min(Math.max(e.clientY - r.top, 0), g.H);
  const Lf = (x - g.x0) / g.sp, L = exact ? Lf : Math.round(Lf);
  let p = mainS.coordinateToPrice(y);
  if (D.magnet && !exact && L >= 0 && L < bars.length) {
    const b = bars[L];
    let best = p, dist = Infinity;
    for (const v of [b.open, b.high, b.low, b.close]) {
      const dy = Math.abs(mainS.priceToCoordinate(v) - y);
      if (dy < dist) { dist = dy; best = v; }
    }
    if (dist < 40) p = best;
  }
  return { t: timeOfLogical(L), p, L: Math.round(Lf), x, y };
}

/* ---------------- Rendu SVG ---------------- */
const f1 = v => Math.round(v * 10) / 10;
const ln = (a, b, c, w = 1.6, dash = '') =>
  `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const hitLn = (a, b) => `<line class="hit" x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="transparent" stroke-width="12"/>`;
const box = (x, y, w, h, attrs) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(w, 0))}" height="${f1(Math.max(h, 0))}" ${attrs}/>`;
const txt = (x, y, s, c, attrs = '') => `<text x="${f1(x)}" y="${f1(y)}" fill="${c}" font-size="11" font-family="Segoe UI, sans-serif" ${attrs}>${esc(s)}</text>`;
// Étiquette sur fond coloré (anchor : start | middle | end), gardée dans la largeur maxW si fournie
function tag(x, y, s, bg, fg = '#fff', anchor = 'middle', maxW = Infinity) {
  const w = s.length * 6.3 + 12;
  let left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  left = Math.max(2, Math.min(left, maxW - w - 2));
  return box(left, y - 10, w, 19, `rx="3" fill="${bg}"`) + txt(left + w / 2, y + 4, s, fg, 'text-anchor="middle"');
}
const priceTag = (g, y, p, bg) => box(g.W + 1, y - 9, g.PS - 2, 18, `rx="2" fill="${bg}"`)
  + txt(g.W + g.PS / 2, y + 4, fmtP(p, priceFmt.precision), '#fff', 'text-anchor="middle"');
const fmtT = t => new Date((t - TZ) * 1000).toLocaleString('fr-FR', TFS[S.tf] >= 86400
  ? { day: '2-digit', month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeTag = (g, x, t, bg) => { const s = fmtT(t), w = s.length * 6.3 + 14; return box(x - w / 2, g.TB + 2, w, 18, `rx="2" fill="${bg}"`) + txt(x, g.TB + 15, s, '#fff', 'text-anchor="middle"'); };
function fmtDur(s) {
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d} j${h ? ` ${h} h` : ''}` : h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
function chanOffset(d) {
  if (!d.pts[2]) return 0;
  const [p0, p1, p2] = d.pts, L0 = logicalOfTime(p0.t), L1 = logicalOfTime(p1.t), L2 = logicalOfTime(p2.t);
  const onLine = L1 === L0 ? p0.p : p0.p + (p1.p - p0.p) * (L2 - L0) / (L1 - L0);
  return p2.p - onLine;
}
function posRender(d, P, g, Y, dir) {
  const [e, s, t] = d.pts, xa = Math.min(P[0].x, P[1].x), xb = Math.max(P[0].x, P[1].x, xa + 40);
  const ye = Y(e.p), ys = Y(s.p), yt = Y(t.p), xm = (xa + xb) / 2;
  const risk = Math.abs(e.p - s.p), ratio = risk ? Math.abs(t.p - e.p) / risk : 0;
  const gain = dir * (t.p / e.p - 1), loss = dir * (s.p / e.p - 1);
  const away = (y, from) => y + (y < from ? -14 : 14);   // étiquette à l'extérieur de la zone
  const body = box(xa, Math.min(ye, yt), xb - xa, Math.abs(yt - ye), 'fill="#26a69a" fill-opacity="0.2" stroke="#26a69a" class="hit-area"')
    + box(xa, Math.min(ye, ys), xb - xa, Math.abs(ys - ye), 'fill="#ef5350" fill-opacity="0.2" stroke="#ef5350" class="hit-area"')
    + ln({ x: xa, y: ye }, { x: xb, y: ye }, '#9598a1', 1.4)
    + tag(xm, away(yt, ye), `Objectif ${fmtP(t.p)} (${fmtPct(gain)})`, '#26a69a', '#fff', 'middle', g.W)
    + tag(xm, away(ys, ye), `Stop ${fmtP(s.p)} (${fmtPct(loss)})`, '#ef5350', '#fff', 'middle', g.W)
    + tag(xm, ye, `${dir > 0 ? 'Long' : 'Short'} · ratio 1:${ratio.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`, '#2a2e39', '#fff', 'middle', g.W);
  return { body, handles: [{ x: P[0].x, y: ye }, { x: xb, y: ys }, { x: xb, y: yt }] };
}

const RENDER = {
  trend: (d, P) => ({ body: ln(P[0], P[1], d.color) + hitLn(P[0], P[1]), handles: P }),
  ray(d, P) {
    const [a, b] = P, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const far = { x: a.x + dx / len * 5000, y: a.y + dy / len * 5000 };
    return { body: ln(a, far, d.color) + hitLn(a, far), handles: P };
  },
  hline(d, P, g) {
    const y = P[0].y, a = { x: 0, y }, b = { x: g.W, y };
    const hx = P[0].x > 10 && P[0].x < g.W - 10 ? P[0].x : g.W / 2;
    return { body: ln(a, b, d.color) + hitLn(a, b), handles: [{ x: hx, y }], axis: priceTag(g, y, d.pts[0].p, d.color) };
  },
  alert(d, P, g) {
    const y = P[0].y, a = { x: 0, y }, b = { x: g.W, y };
    return {
      body: ln(a, b, '#ff9800', 1.4, '6 4') + hitLn(a, b) + tag(10, y - 13, `🔔 Alerte ${fmtP(d.pts[0].p)}`, '#ff9800', '#131722', 'start'),
      handles: [{ x: g.W / 2, y }], axis: priceTag(g, y, d.pts[0].p, '#ff9800'),
    };
  },
  vline(d, P, g) {
    const x = P[0].x, a = { x, y: 0 }, b = { x, y: g.H };
    return { body: ln(a, b, d.color) + hitLn(a, b), handles: [{ x, y: g.H / 2 }], axis: timeTag(g, x, d.pts[0].t, d.color) };
  },
  channel(d, P, g, Y) {
    const [a, b] = P, off = chanOffset(d);
    const a2 = { x: a.x, y: Y(d.pts[0].p + off) }, b2 = { x: b.x, y: Y(d.pts[1].p + off) };
    const am = { x: a.x, y: Y(d.pts[0].p + off / 2) }, bm = { x: b.x, y: Y(d.pts[1].p + off / 2) };
    const poly = `<polygon class="hit-area" points="${[a, b, b2, a2].map(p => f1(p.x) + ',' + f1(p.y)).join(' ')}" fill="${d.color}" fill-opacity="0.08"/>`;
    return {
      body: poly + ln(a, b, d.color) + ln(a2, b2, d.color) + ln(am, bm, d.color, 1, '4 4') + hitLn(a, b) + hitLn(a2, b2),
      handles: [a, b, { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 }],
    };
  },
  fib(d, P, g, Y) {
    const [a, b] = P, p0 = d.pts[0].p, p1 = d.pts[1].p;
    const xa = Math.min(a.x, b.x), xb = Math.max(a.x, b.x, xa + 40);
    let body = ln(a, b, '#787b86', 1, '3 3'), prev = null;
    const ys = FIB.map(([lv]) => Y(p1 + (p0 - p1) * lv));
    FIB.forEach(([lv, c], i) => {
      const price = p1 + (p0 - p1) * lv, y = ys[i];
      if (prev != null) body += box(xa, Math.min(y, prev), xb - xa, Math.abs(y - prev), `fill="${c}" fill-opacity="0.07"`);
      body += ln({ x: xa, y }, { x: xb, y }, c, 1.2) + txt(xa + 4, y - 4, `${lv} (${fmtP(price)})`, c);
      prev = y;
    });
    body += box(xa, Math.min(...ys), xb - xa, Math.max(...ys) - Math.min(...ys), 'fill="transparent" class="hit-area"');
    return { body, handles: P };
  },
  rect(d, P) {
    const [a, b] = P;
    return {
      body: box(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y),
        `fill="${d.color}" fill-opacity="0.15" stroke="${d.color}" stroke-width="1.4" class="hit-area"`),
      handles: P,
    };
  },
  measure(d, P, g) {
    const [a, b] = P, [q0, q1] = d.pts, dp = q1.p - q0.p, c = dp >= 0 ? '#2962ff' : '#ef5350';
    const nb = Math.round(logicalOfTime(q1.t) - logicalOfTime(q0.t));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const l1 = `${dp > 0 ? '+' : ''}${fmtP(dp, decimals(Math.abs(q0.p)))} (${fmtPct(dp / q0.p)})`;
    const l2 = `${Math.abs(nb)} bougie${Math.abs(nb) > 1 ? 's' : ''} · ${fmtDur(Math.abs(q1.t - q0.t))}`;
    const w = Math.max(l1.length, l2.length) * 6.3 + 16, ly = Math.min(Math.max(a.y, b.y) + 8, g.H - 40);
    const lx = Math.max(2, Math.min(mx - w / 2, g.W - w - 2));
    return {
      body: box(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), `fill="${c}" fill-opacity="0.18" class="hit-area"`)
        + ln({ x: mx, y: a.y }, { x: mx, y: b.y }, c, 1.4) + ln({ x: a.x, y: my }, { x: b.x, y: my }, c, 1.4)
        + box(lx, ly, w, 36, `rx="4" fill="${c}"`)
        + txt(lx + w / 2, ly + 15, l1, '#fff', 'text-anchor="middle" font-weight="600"') + txt(lx + w / 2, ly + 30, l2, '#fff', 'text-anchor="middle"'),
      handles: P,
    };
  },
  long: (d, P, g, Y) => posRender(d, P, g, Y, 1),
  short: (d, P, g, Y) => posRender(d, P, g, Y, -1),
  text(d, P) {
    const a = P[0], s = d.text || 'Texte', w = s.length * 7.4 + 14;
    return {
      body: box(a.x - 4, a.y - 16, w, 24, 'rx="4" fill="#131722" fill-opacity="0.75" class="hit-area"')
        + `<text x="${f1(a.x + 3)}" y="${f1(a.y + 1)}" fill="${d.color}" font-size="13" font-weight="600" font-family="Segoe UI, sans-serif">${esc(s)}</text>`,
      handles: [a],
    };
  },
  brush(d, P) {
    const pts = P.map(p => f1(p.x) + ',' + f1(p.y)).join(' ');
    return {
      body: `<polyline points="${pts}" fill="none" stroke="${d.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
        + `<polyline class="hit" points="${pts}" fill="none" stroke="transparent" stroke-width="12"/>`,
      handles: [],
    };
  },
};

function renderDrawings() {
  const svg = layer(), g = bars.length ? geo() : null;
  if (!g) { svg.innerHTML = ''; return; }
  const X = t => g.x0 + logicalOfTime(t) * g.sp, Y = p => mainS.priceToCoordinate(p) ?? NaN;
  const list = D.hidden ? [] : [...drawList()];
  if (D.draft) list.push(D.draft);
  let body = '', axis = '';
  for (const raw of list) {
    // Aperçu d'une position en cours de tracé : on calcule déjà stop et objectif
    const d = raw === D.draft && (raw.type === 'long' || raw.type === 'short') ? finishShape({ ...raw, pts: raw.pts.map(q => ({ ...q })) }) : raw;
    const P = d.pts.map(q => ({ x: X(q.t), y: Y(q.p) }));
    if (P.some(p => !isFinite(p.x) || !isFinite(p.y))) continue;
    const r = RENDER[d.type]?.(d, P, g, Y);
    if (!r) continue;
    const sel = D.sel === d.id;
    body += `<g class="dw${sel ? ' sel' : ''}" data-id="${d.id}">${r.body}${sel ? r.handles.map((h, i) =>
      `<circle class="handle" data-h="${i}" cx="${f1(h.x)}" cy="${f1(h.y)}" r="5" fill="#131722" stroke="${d.color || '#2962ff'}" stroke-width="1.6"/>`).join('') : ''}</g>`;
    if (r.axis) axis += r.axis;
    else if (sel && d.type !== 'brush') d.pts.forEach((q, i) => { axis += priceTag(g, P[i].y, q.p, '#2962ff') + timeTag(g, P[i].x, q.t, '#2962ff'); });
  }
  svg.innerHTML = `<defs><clipPath id="dwClip"><rect x="0" y="0" width="${g.W}" height="${g.H}"/></clipPath></defs>`
    + `<g clip-path="url(#dwClip)">${body}</g>${axis}`;
}
// Appelé à chaque image : ne redessine que si la vue ou les dessins ont changé
function drawingsFrame() {
  if (!mainS) return;
  if (!bars.length) { if (D.sig) { layer().innerHTML = ''; D.sig = ''; } return; }
  const ts = chart.timeScale(), last = bars[bars.length - 1].close;
  const sig = [D.ver, S.sym, S.tf, bars.length, ts.logicalToCoordinate(0), ts.logicalToCoordinate(1), ts.width(),
    chart.panes()[0].getHeight(), mainS.priceToCoordinate(last), mainS.priceToCoordinate(last * 1.01)].join('|');
  if (sig === D.sig) return;
  D.sig = sig;
  renderDrawings();
}

/* ---------------- Création ---------------- */
function createAt(pt) {
  const tool = D.tool, spec = TOOL[tool], q = { t: pt.t, p: pt.p };
  if (tool === 'brush') {
    D.draft = { id: newId(), type: 'brush', color: D.color, pts: [q] };
    D.brushing = true;
    return;
  }
  if (spec.n === 1) {
    const d = { id: newId(), type: tool, color: tool === 'alert' ? '#ff9800' : D.color, pts: [q] };
    if (tool === 'text') {
      const s = prompt('Texte à afficher sur le graphique :', '');
      if (!s || !s.trim()) return setTool('cursor');
      d.text = s.trim().slice(0, 80);
    }
    if (tool === 'alert') toast(`Alerte créée : tu seras prévenu quand ${shortOf(S.sym)} touchera ${fmtP(q.p)}.`, 'ok');
    return commit(d);
  }
  if (!D.draft) {
    D.draft = { id: newId(), type: tool, color: D.color, pts: [q, { ...q }] };
  } else {
    D.draft.pts[D.draft.pts.length - 1] = q;
    if (D.draft.pts.length >= spec.n) return commit(finishShape(D.draft));
    D.draft.pts.push({ ...q });
  }
  D.ver++;
  updateHint();
}
// Position longue / courte : 2 clics (entrée, stop) ; l'objectif est placé à 2 fois le risque
function finishShape(d) {
  if (d.type !== 'long' && d.type !== 'short') return d;
  const dir = d.type === 'long' ? 1 : -1, [e, s] = d.pts;
  const stop = (e.p - s.p) * dir > 0 ? s.p : e.p * (1 - dir * 0.01);
  let tEnd = s.t;
  if (logicalOfTime(tEnd) - logicalOfTime(e.t) < 5) tEnd = timeOfLogical(Math.round(logicalOfTime(e.t)) + 20);
  d.pts = [e, { t: tEnd, p: stop }, { t: tEnd, p: e.p + 2 * (e.p - stop) }];
  return d;
}
function commit(d) {
  pushUndo();
  drawList().push(d);
  D.draft = null;
  save();
  setTool('cursor');
  select(d.id);
}

/* ---------------- Sélection, déplacement, édition ---------------- */
function select(id) {
  D.sel = id;
  renderDrawMenu();
  D.ver++;
}
function dragTo(pt) {
  const dr = D.drag, d = drawList().find(x => x.id === dr.id);
  if (!d) return;
  dr.moved = true;
  const o = dr.orig, q = { t: pt.t, p: pt.p };
  if (dr.h == null) {
    // Tout le dessin se déplace (d'un nombre entier de bougies)
    const dL = pt.L - dr.start.L, dP = pt.p - dr.start.p, priceOnly = d.type === 'hline' || d.type === 'alert';
    d.pts = o.map(v => ({
      t: priceOnly ? v.t : timeOfLogical(logicalOfTime(v.t) + dL),
      p: d.type === 'vline' ? v.p : v.p + dP,
    }));
  } else if (d.type === 'hline' || d.type === 'alert') d.pts[0] = { t: o[0].t, p: pt.p };
  else if (d.type === 'vline') d.pts[0] = { t: pt.t, p: o[0].p };
  else if (d.type === 'long' || d.type === 'short') {
    if (dr.h === 0) d.pts[0] = q;
    else { d.pts[dr.h] = q; d.pts[3 - dr.h] = { t: pt.t, p: o[3 - dr.h].p }; }   // stop et objectif partagent la date de fin
  } else d.pts[dr.h] = q;
  D.ver++;
}
function finishDrag() {
  const dr = D.drag;
  D.drag = null;
  syncCapture();
  if (dr.moved) {
    D.undo.push({ sym: S.sym, json: dr.snap });
    if (D.undo.length > 50) D.undo.shift();
    save();
  }
  D.ver++;
}
function pushUndo() {
  D.undo.push({ sym: S.sym, json: JSON.stringify(drawList()) });
  if (D.undo.length > 50) D.undo.shift();
}
function undo() {
  const u = D.undo.pop();
  if (!u) return toast('Rien à annuler.');
  S.drawings[u.sym] = JSON.parse(u.json);
  select(null); save();
  if (u.sym !== S.sym) toast(`Annulation appliquée sur ${lab(u.sym)}.`);
}
function deleteSel() {
  if (!D.sel) return;
  pushUndo();
  S.drawings[S.sym] = drawList().filter(x => x.id !== D.sel);
  select(null); save();
}
function clearDrawings() {
  if (!drawList().length) return toast('Aucun dessin sur ce graphique.');
  if (!confirm(`Supprimer les ${drawList().length} dessins de ${lab(S.sym)} ? (Ctrl+Z pour annuler)`)) return;
  pushUndo();
  S.drawings[S.sym] = [];
  select(null); save();
}
// Remplit le panneau d'ordre à partir d'un outil Position longue / courte
function prepareOrder(d) {
  const [e, s, t] = d.pts, mark = M.price[S.sym];
  setSide(d.type === 'long' ? 'long' : 'short');
  const near = mark && Math.abs(e.p / mark - 1) < 0.001;
  if (!near) $('inLimit').value = roundP(e.p);
  setType(near ? 'market' : 'limit');
  $('inSL').value = roundP(s.p);
  $('inTP').value = roundP(t.p);
  renderSummary();
  const btn = $('btnSubmit');
  btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
  btn.scrollIntoView({ block: 'nearest' });
  toast(near ? 'Ordre au marché préparé avec ton stop et ton objectif : choisis la marge, vérifie le résumé, puis valide.'
    : 'Ordre limite préparé à ton prix d\'entrée, avec ton stop et ton objectif : choisis la marge, vérifie le résumé, puis valide.', 'ok');
}
function renderDrawMenu() {
  const m = $('drawMenu'), d = D.sel && drawList().find(x => x.id === D.sel);
  if (!d) { m.hidden = true; return; }
  const colorable = !['long', 'short', 'fib', 'measure', 'alert'].includes(d.type);
  m.innerHTML = `<span class="dm-name">${TOOL[d.type].name}</span>
    ${colorable ? DRAW_COLORS.map(c => `<button class="sw${d.color === c ? ' on' : ''}" data-color="${c}" style="background:${c}" title="Couleur"></button>`).join('') : ''}
    ${d.type === 'text' ? '<button data-act="text">Modifier le texte</button>' : ''}
    ${d.type === 'long' || d.type === 'short' ? '<button data-act="order" class="dm-primary">Préparer l\'ordre</button>' : ''}
    <button data-act="del" title="Supprimer (Suppr)">${svgIcon(ICON.clear)}</button>`;
  m.hidden = false;
}

/* ---------------- Outils ---------------- */
function setTool(id) {
  id = id || 'cursor';
  if (id !== D.tool) D.draft = null;
  D.tool = id;
  D.brushing = false;
  if (id !== 'cursor') select(null);
  syncToolbar(); syncCapture(); updateHint();
  if (id === 'cursor') { try { chart.clearCrosshairPosition(); } catch { /* ignore */ } }
  D.ver++;
}
function drawHint() {
  if (D.tool === 'cursor') return '';
  const steps = HINTS[D.tool] || [''], n = D.draft ? D.draft.pts.length - 1 : 0;
  return `${steps[Math.min(n, steps.length - 1)]} (Échap pour annuler)`;
}
function setMagnet(on) {
  D.magnet = on;
  chart.applyOptions({ crosshair: { mode: on ? LC.CrosshairMode.Magnet : LC.CrosshairMode.Normal } });
  syncToolbar();
}
function syncToolbar() {
  document.querySelectorAll('#drawBar [data-tool]').forEach(b => {
    const id = b.dataset.tool;
    b.classList.toggle('active', id === 'magnet' ? D.magnet : id === 'hide' ? D.hidden : id === D.tool);
  });
}
function syncCapture() { layer().classList.toggle('capturing', D.tool !== 'cursor' || !!D.drag); }
function resetDrawingState() {
  D.draft = null; D.drag = null; D.sel = null;
  renderDrawMenu();
  syncCapture();
  D.ver++;
}
// Suit la souris avec le réticule du graphique pendant le tracé
function syncCrosshair(pt) {
  try {
    if (pt.L >= 0 && pt.L < bars.length) chart.setCrosshairPosition(pt.p, bars[pt.L].time, mainS);
    else chart.clearCrosshairPosition();
  } catch { /* ignore */ }
}

/* ---------------- Alertes de prix ---------------- */
let audioCtx = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    [0, 0.22].forEach(dt => {
      const o = audioCtx.createOscillator(), gn = audioCtx.createGain(), t0 = audioCtx.currentTime + dt;
      o.frequency.value = 880;
      gn.gain.setValueAtTime(0.15, t0);
      gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      o.connect(gn).connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    });
  } catch { /* son indisponible */ }
}
function checkAlerts(sym, prev, p) {
  const list = S.drawings[sym];
  if (!list || prev == null) return;
  const hit = list.filter(d => d.type === 'alert' && ((prev < d.pts[0].p && p >= d.pts[0].p) || (prev > d.pts[0].p && p <= d.pts[0].p)));
  if (!hit.length) return;
  S.drawings[sym] = list.filter(d => !hit.includes(d));
  if (hit.some(d => d.id === D.sel)) select(null);
  save();
  D.ver++;
  hit.forEach(d => toast(`🔔 Alerte ${lab(sym)} : le prix a atteint ${fmtP(d.pts[0].p)}.`, 'warn'));
  beep();
}

/* ---------------- Capture d'écran ---------------- */
function takeShot() {
  const base = chart.takeScreenshot(true, false), el = $('chart');
  const scale = base.width / el.clientWidth;
  const out = document.createElement('canvas');
  out.width = base.width; out.height = base.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(base, 0, 0);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, el.clientWidth * scale, el.clientHeight * scale);
    ctx.scale(scale, scale);
    const title = `${lab(S.sym)} · ${TF_LABEL[S.tf]} · ${new Date().toLocaleString('fr-FR')} · PaperView`;
    ctx.font = '600 13px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(19,23,34,.9)';
    ctx.fillRect(8, 6, ctx.measureText(title).width + 16, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 16, 23);
    out.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `paperview-${shortOf(S.sym)}-${S.tf}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast('Capture enregistrée dans tes téléchargements.', 'ok');
    });
  };
  img.onerror = () => toast('Capture impossible.', 'err');
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${el.clientWidth}" height="${el.clientHeight}">${layer().innerHTML}</svg>`;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
}

/* ---------------- Événements ---------------- */
function onDown(e) {
  if (e.button !== 0 || !bars.length) return;
  const g = geo();
  if (!g) return;
  if (D.tool !== 'cursor') {
    e.preventDefault();
    const pt = toPoint(e, g, D.tool === 'brush');
    createAt(pt);
    D.down = { x: e.clientX, y: e.clientY };
    if (D.tool === 'brush') capturePointer(e);
    return;
  }
  const gEl = e.target.closest('[data-id]');
  const d = gEl && drawList().find(x => x.id === gEl.dataset.id);
  if (!d) return;
  e.preventDefault();
  e.stopPropagation();
  select(d.id);
  const h = e.target.closest('.handle');
  D.drag = { id: d.id, h: h ? +h.dataset.h : null, start: toPoint(e, g), orig: d.pts.map(q => ({ ...q })), snap: JSON.stringify(drawList()), moved: false };
  syncCapture();
  capturePointer(e);
}
function capturePointer(e) {
  try { layer().setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
}
function onMove(e) {
  if (!bars.length) return;
  const g = geo();
  if (!g) return;
  if (D.drag) { dragTo(toPoint(e, g)); return; }
  if (D.tool === 'cursor') return;
  const pt = toPoint(e, g, D.tool === 'brush');
  syncCrosshair(pt);
  if (!D.draft) return;
  if (D.tool === 'brush') {
    if (!D.brushing) return;
    const last = D.draft.pts[D.draft.pts.length - 1];
    const lx = g.x0 + logicalOfTime(last.t) * g.sp, ly = mainS.priceToCoordinate(last.p);
    if (Math.hypot(pt.x - lx, pt.y - ly) < 3) return;
    D.draft.pts.push({ t: pt.t, p: pt.p });
  } else {
    D.draft.pts[D.draft.pts.length - 1] = { t: pt.t, p: pt.p };
  }
  D.ver++;
}
function onUp(e) {
  if (D.drag) { finishDrag(); return; }
  if (D.tool === 'brush' && D.draft) {
    const d = D.draft;
    D.draft = null; D.brushing = false;
    if (d.pts.length > 1) commit(d); else D.ver++;
    return;
  }
  // Cliquer-glisser pour tracer : relâcher loin du point de départ vaut un second clic
  if (D.draft && D.down && D.draft.pts.length === 2 && Math.hypot(e.clientX - D.down.x, e.clientY - D.down.y) > 8) {
    const g = geo();
    if (g) createAt(toPoint(e, g));
  }
  D.down = null;
}
function onDblClick(e) {
  const gEl = e.target.closest('[data-id]');
  const d = gEl && drawList().find(x => x.id === gEl.dataset.id);
  if (d?.type === 'text') editText(d);
}
function editText(d) {
  const s = prompt('Modifier le texte :', d.text || '');
  if (s === null || !s.trim()) return;
  pushUndo();
  d.text = s.trim().slice(0, 80);
  save(); D.ver++;
}
function onMenu(e) {
  const b = e.target.closest('button');
  const d = b && D.sel && drawList().find(x => x.id === D.sel);
  if (!d) return;
  if (b.dataset.color) { pushUndo(); d.color = b.dataset.color; save(); renderDrawMenu(); D.ver++; }
  else if (b.dataset.act === 'text') editText(d);
  else if (b.dataset.act === 'order') prepareOrder(d);
  else if (b.dataset.act === 'del') deleteSel();
}
function onKey(e) {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === 'Escape') {
    if (D.tool !== 'cursor' || D.draft) setTool('cursor');
    else if (D.sel) select(null);
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && D.sel) { e.preventDefault(); deleteSel(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const t = TOOLS.find(x => x.key?.toLowerCase() === 'alt+' + e.key.toLowerCase());
    if (t) { e.preventDefault(); setTool(t.id); }
  }
}
// Le calque laisse passer la molette vers le graphique (zoom) même au-dessus d'un dessin
function forwardWheel(e) {
  const svg = layer();
  const target = document.elementsFromPoint(e.clientX, e.clientY).find(el => el !== svg && !svg.contains(el) && $('chart').contains(el));
  if (!target) return;
  e.preventDefault();
  target.dispatchEvent(new WheelEvent('wheel', e));
}

function initDrawings() {
  $('drawBar').innerHTML = TOOLS.map(t => t.sep ? '<div class="dsep"></div>'
    : `<button data-tool="${t.id}" title="${t.name}${t.key ? ` (${t.key})` : ''}">${svgIcon(ICON[t.id])}</button>`).join('');
  $('drawBar').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    const id = b.dataset.tool;
    if (id === 'magnet') return setMagnet(!D.magnet);
    if (id === 'hide') { D.hidden = !D.hidden; syncToolbar(); D.ver++; return; }
    if (id === 'clear') return clearDrawings();
    setTool(D.tool === id ? 'cursor' : id);
  });
  const svg = layer();
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('dblclick', onDblClick);
  svg.addEventListener('wheel', forwardWheel, { passive: false });
  svg.addEventListener('pointerleave', () => { if (D.tool !== 'cursor') { try { chart.clearCrosshairPosition(); } catch { /* ignore */ } } });
  chart.subscribeClick(() => { if (D.sel) select(null); });
  document.addEventListener('keydown', onKey);
  $('drawMenu').addEventListener('click', onMenu);
  $('btnShot').addEventListener('click', takeShot);
  syncToolbar();
}
