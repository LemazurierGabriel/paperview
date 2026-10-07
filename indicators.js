'use strict';

/* =====================================================================
   Indicateurs techniques : calculs, séries (sur le graphique ou dans un
   panneau séparé), menu de réglages et légendes.
   Les réglages sont dans S.ind (valeurs par défaut : IND_DEFAULTS, app.js).
   ===================================================================== */

/* ---------------- Calculs ---------------- */
// Tableaux alignés sur les bougies ; null tant qu'il n'y a pas assez de données.
const closesOf = b => b.map(x => x.close);
function smaArr(src, n) {
  const out = new Array(src.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    sum += v; cnt++;
    if (cnt > n) sum -= src[i - n];
    if (cnt >= n) out[i] = sum / n;
  }
  return out;
}
function emaArr(src, n) {
  const out = new Array(src.length).fill(null), k = 2 / (n + 1);
  let e = null, cnt = 0, sum = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    cnt++;
    if (cnt < n) { sum += v; continue; }
    e = cnt === n ? (sum + v) / n : v * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
// Moyenne de Wilder (RSI, ATR)
function rmaArr(src, n) {
  const out = new Array(src.length).fill(null);
  let e = null, cnt = 0, sum = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    cnt++;
    if (cnt < n) { sum += v; continue; }
    e = cnt === n ? (sum + v) / n : (e * (n - 1) + v) / n;
    out[i] = e;
  }
  return out;
}
const hh = (b, i, n) => { let m = -Infinity; for (let j = i - n + 1; j <= i; j++) m = Math.max(m, b[j].high); return m; };
const ll = (b, i, n) => { let m = Infinity; for (let j = i - n + 1; j <= i; j++) m = Math.min(m, b[j].low); return m; };
const toPts = (b, arr, color) => {
  const out = [];
  arr.forEach((v, i) => {
    if (v == null || !isFinite(v)) return;
    out.push(color ? { time: b[i].time, value: v, color: color(i, v) } : { time: b[i].time, value: v });
  });
  return out;
};

function bollinger(b, c) {
  const cl = closesOf(b), n = c.period, mid = smaArr(cl, n), up = [], lo = [];
  for (let i = 0; i < b.length; i++) {
    if (mid[i] == null) { up[i] = lo[i] = null; continue; }
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (cl[j] - mid[i]) ** 2;
    const sd = Math.sqrt(v / n);
    up[i] = mid[i] + c.mult * sd;
    lo[i] = mid[i] - c.mult * sd;
  }
  return [toPts(b, up), toPts(b, mid), toPts(b, lo)];
}
// VWAP remis à zéro chaque jour (sans objet au-delà de l'unité de temps journalière)
function vwap(b) {
  if (TFS[S.tf] >= 86400) return [[]];
  const out = [];
  let day = null, pv = 0, vv = 0;
  for (const x of b) {
    const d = Math.floor(x.time / 86400);
    if (d !== day) { day = d; pv = 0; vv = 0; }
    const tp = (x.high + x.low + x.close) / 3, w = x.volume > 0 ? x.volume : 1;
    pv += tp * w; vv += w;
    out.push({ time: x.time, value: pv / vv });
  }
  return [out];
}
function ichimoku(b, c) {
  const n = b.length, sec = TFS[S.tf], shift = c.kijun - 1;
  const mid = (i, p) => i >= p - 1 ? (hh(b, i, p) + ll(b, i, p)) / 2 : null;
  // Le nuage est projeté dans le futur : on prolonge l'axe du temps
  const timeAt = i => i < n ? b[i].time : b[n - 1].time + (i - n + 1) * sec;
  const ten = [], kij = [], sa = [], sb = [], ch = [];
  for (let i = 0; i < n; i++) {
    const t = mid(i, c.tenkan), k = mid(i, c.kijun), s = mid(i, c.senkou);
    if (t != null) ten.push({ time: b[i].time, value: t });
    if (k != null) kij.push({ time: b[i].time, value: k });
    if (t != null && k != null) sa.push({ time: timeAt(i + shift), value: (t + k) / 2 });
    if (s != null) sb.push({ time: timeAt(i + shift), value: s });
    if (i - shift >= 0) ch.push({ time: b[i - shift].time, value: b[i].close });
  }
  return [ten, kij, sa, sb, ch];
}
function sar(b, c) {
  const out = new Array(b.length).fill(null);
  if (b.length < 3) return [[]];
  let up = b[1].close >= b[0].close, af = c.step, ep = up ? b[0].high : b[0].low, s = up ? b[0].low : b[0].high;
  for (let i = 1; i < b.length; i++) {
    s += af * (ep - s);
    const p1 = b[i - 1], p2 = b[Math.max(0, i - 2)];
    if (up) {
      s = Math.min(s, p1.low, p2.low);
      if (b[i].low < s) { up = false; s = ep; ep = b[i].low; af = c.step; }
      else if (b[i].high > ep) { ep = b[i].high; af = Math.min(af + c.step, c.max); }
    } else {
      s = Math.max(s, p1.high, p2.high);
      if (b[i].high > s) { up = true; s = ep; ep = b[i].high; af = c.step; }
      else if (b[i].low < ep) { ep = b[i].low; af = Math.min(af + c.step, c.max); }
    }
    out[i] = s;
  }
  return [toPts(b, out, (i, v) => v < b[i].close ? '#26a69a' : '#ef5350')];
}
function rsi(b, c) {
  const n = c.period, out = new Array(b.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < b.length; i++) {
    const ch = b[i].close - b[i - 1].close, g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= n) { ag += g / n; al += l / n; if (i < n) continue; }
    else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; }
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return [toPts(b, out)];
}
function macd(b, c) {
  const cl = closesOf(b), f = emaArr(cl, c.fast), s = emaArr(cl, c.slow);
  const m = cl.map((_, i) => f[i] != null && s[i] != null ? f[i] - s[i] : null);
  const sig = emaArr(m, c.signal);
  const hist = m.map((v, i) => v != null && sig[i] != null ? v - sig[i] : null);
  const histColor = (i, v) => {
    const p = hist[i - 1];
    if (v >= 0) return p != null && v < p ? '#b2dfdb' : '#26a69a';
    return p != null && v > p ? '#ffcdd2' : '#ef5350';
  };
  return [toPts(b, hist, histColor), toPts(b, m), toPts(b, sig)];
}
function stoch(b, c) {
  const raw = b.map((x, i) => {
    if (i < c.k - 1) return null;
    const h = hh(b, i, c.k), l = ll(b, i, c.k);
    return h === l ? 50 : (x.close - l) / (h - l) * 100;
  });
  const k = smaArr(raw, c.smooth), d = smaArr(k, c.d);
  return [toPts(b, k), toPts(b, d)];
}
function atr(b, c) {
  const tr = b.map((x, i) => i === 0 ? x.high - x.low
    : Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)));
  return [toPts(b, rmaArr(tr, c.period))];
}

/* ---------------- Catalogue ---------------- */
// series : [type de série, couleur, options, nom dans la légende]
const IND = {
  sma: {
    name: 'Moyenne mobile (MM)', desc: 'Moyenne des N dernières clôtures : lisse le prix et montre la tendance.',
    params: [['period', 'Période', 2, 500]], label: c => `MM ${c.period}`,
    series: [['Line', '#f7a600']], calc: (b, c) => [toPts(b, smaArr(closesOf(b), c.period))],
  },
  ema: {
    name: 'Moyenne mobile exponentielle (EMA)', desc: 'Comme la MM, mais réagit plus vite aux prix récents.',
    params: [['period', 'Période', 2, 500]], label: c => `EMA ${c.period}`,
    series: [['Line', '#ab47bc']], calc: (b, c) => [toPts(b, emaArr(closesOf(b), c.period))],
  },
  sma200: {
    name: 'Moyenne mobile longue', desc: 'La MM 200 : la tendance de fond, très surveillée par les traders.',
    params: [['period', 'Période', 2, 500]], label: c => `MM ${c.period}`,
    series: [['Line', '#e91e63', { lineWidth: 2 }]], calc: (b, c) => [toPts(b, smaArr(closesOf(b), c.period))],
  },
  bb: {
    name: 'Bandes de Bollinger', desc: 'Enveloppe autour de la moyenne : s\'écarte quand le marché s\'agite, se resserre avant les gros mouvements.',
    params: [['period', 'Période', 2, 200], ['mult', 'Écart-type', 0.5, 5, 0.5]], label: c => `BB ${c.period}, ${c.mult}`,
    series: [['Line', 'rgba(41,98,255,.85)', {}, 'Haut'], ['Line', 'rgba(41,98,255,.5)', { lineStyle: LC.LineStyle.Dashed }, 'Milieu'], ['Line', 'rgba(41,98,255,.85)', {}, 'Bas']],
    calc: bollinger,
  },
  vwap: {
    name: 'VWAP', desc: 'Prix moyen de la journée pondéré par les volumes : repère des grands acteurs (intraday).',
    params: [], label: () => 'VWAP', series: [['Line', '#00bcd4', { lineWidth: 2 }]], calc: vwap,
  },
  ichi: {
    name: 'Ichimoku', desc: 'Système japonais complet : tendance, supports et résistances projetés dans le futur.',
    params: [['tenkan', 'Tenkan', 2, 100], ['kijun', 'Kijun', 2, 100], ['senkou', 'Senkou B', 2, 200]],
    label: c => `Ichimoku ${c.tenkan}, ${c.kijun}, ${c.senkou}`, full: true,
    series: [['Line', '#2962ff', {}, 'Tenkan'], ['Line', '#b71c1c', {}, 'Kijun'], ['Line', 'rgba(38,166,154,.9)', {}, 'SSA'],
      ['Line', 'rgba(239,83,80,.9)', {}, 'SSB'], ['Line', 'rgba(76,175,80,.6)', {}, 'Chikou']],
    calc: ichimoku,
  },
  sar: {
    name: 'SAR parabolique', desc: 'Points sous le prix en tendance haussière, au-dessus en baissière : un stop suiveur tout fait.',
    params: [['step', 'Pas', 0.005, 0.1, 0.005], ['max', 'Max', 0.05, 1, 0.05]], label: c => `SAR ${c.step}, ${c.max}`,
    series: [['Line', '#f7a600', { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.6 }]], calc: sar,
  },
  vol: { name: 'Volume', desc: 'Quantité échangée sur chaque bougie, en bas du graphique.', params: [], special: true },
  rsi: {
    pane: true, name: 'RSI', desc: 'Force du mouvement, de 0 à 100. Au-dessus de 70 : suracheté ; sous 30 : survendu.',
    params: [['period', 'Période', 2, 100]], label: c => `RSI ${c.period}`, levels: [70, 30], fixed: 2,
    series: [['Line', '#7e57c2']], calc: rsi,
  },
  macd: {
    pane: true, name: 'MACD', desc: 'Écart entre deux moyennes : quand la ligne bleue croise l\'orange, la tendance peut changer.',
    params: [['fast', 'Rapide', 2, 100], ['slow', 'Lente', 2, 200], ['signal', 'Signal', 2, 100]],
    label: c => `MACD ${c.fast}, ${c.slow}, ${c.signal}`,
    series: [['Histogram', '#26a69a', {}, 'Histo'], ['Line', '#2962ff', {}, 'MACD'], ['Line', '#ff6d00', {}, 'Signal']], calc: macd,
  },
  stoch: {
    pane: true, name: 'Stochastique', desc: 'Où se situe la clôture dans la fourchette récente (0-100). Au-dessus de 80 : haut ; sous 20 : bas.',
    params: [['k', '%K', 2, 100], ['d', '%D', 1, 50], ['smooth', 'Lissage', 1, 50]], label: c => `Stoch ${c.k}, ${c.d}, ${c.smooth}`,
    levels: [80, 20], fixed: 2, series: [['Line', '#2962ff', {}, '%K'], ['Line', '#ff6d00', {}, '%D']], calc: stoch,
  },
  atr: {
    pane: true, name: 'ATR', desc: 'Taille moyenne d\'une bougie (volatilité) : aide à placer un stop-loss ni trop serré ni trop large.',
    params: [['period', 'Période', 2, 100]], label: c => `ATR ${c.period}`, series: [['Line', '#ef5350']], calc: atr,
  },
};

/* ---------------- Séries ---------------- */
const indS = {};      // clé -> séries du graphique
const indData = {};   // clé -> données calculées (une liste par série)

function indFmt(def) {
  if (!def.pane) return priceFmt;
  if (def.fixed != null) return { type: 'price', precision: def.fixed, minMove: 10 ** -def.fixed };
  const d = Math.min(8, decimals(bars[bars.length - 1]?.close || 100) + 1);
  return { type: 'price', precision: d, minMove: 10 ** -d };
}
function indPrecision() {
  for (const [k, list] of Object.entries(indS)) list.forEach(s => s.applyOptions({ priceFormat: indFmt(IND[k]) }));
}

// Recrée toutes les séries d'indicateurs (les oscillateurs ont chacun leur panneau)
function rebuildIndicators() {
  for (const k of Object.keys(indS)) { indS[k].forEach(s => chart.removeSeries(s)); delete indS[k]; }
  for (let i = chart.panes().length - 1; i >= 1; i--) if (!chart.panes()[i].getSeries().length) chart.removePane(i);
  let pane = 1;
  for (const [k, def] of Object.entries(IND)) {
    if (def.special || !S.ind[k]?.on) continue;
    const pi = def.pane ? pane++ : 0;
    indS[k] = def.series.map(([type, color, extra]) => chart.addSeries(LC[type + 'Series'], {
      color, lineWidth: 1, priceLineVisible: false, lastValueVisible: !!def.pane, crosshairMarkerVisible: false,
      priceFormat: indFmt(def), ...extra,
    }, pi));
    (def.levels || []).forEach(v => indS[k][0].createPriceLine({
      price: v, color: '#5d606b', lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false,
    }));
  }
  chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 4 : 1));
  refreshIndicators(true);
  paneLegendSig = '';
}

function refreshIndicators(full) {
  for (const [k, def] of Object.entries(IND)) {
    const series = indS[k];
    if (!series) { delete indData[k]; continue; }
    const data = bars.length ? def.calc(bars, S.ind[k]) : series.map(() => []);
    indData[k] = data;
    series.forEach((s, j) => {
      const arr = data[j] || [];
      if (full || def.full || !arr.length) s.setData(arr);
      else s.update(arr[arr.length - 1]);
    });
  }
  volS.applyOptions({ visible: S.ind.vol.on });
}

/* ---------------- Légendes ---------------- */
function valAt(arr, t) {
  let lo = 0, hi = (arr?.length || 0) - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time === t) return arr[mid].value;
    if (arr[mid].time < t) lo = mid + 1; else hi = mid - 1;
  }
  return null;
}
function legendItem(k, t) {
  const def = IND[k], fmt = indFmt(def);
  const vals = (indData[k] || []).map((arr, j) => {
    const v = valAt(arr, t), [, color, , name] = def.series[j];
    const txt = v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: fmt.precision, maximumFractionDigits: fmt.precision });
    return `<span style="color:${color}">${name ? `<span class="k">${name}</span>` : ''}${txt}</span>`;
  }).join(' ');
  return `<span class="leg-item"><span class="leg-name">${def.label(S.ind[k])}</span>${vals}<button class="leg-x" data-ind-off="${k}" title="Retirer l'indicateur">×</button></span>`;
}
function indLegendHTML(t) {
  return Object.keys(indS).filter(k => !IND[k].pane).map(k => legendItem(k, t)).join('');
}
function renderPaneLegends(t) {
  const box = $('paneLegends');
  const keys = Object.keys(IND).filter(k => IND[k].pane && indS[k]);
  if (box.children.length !== keys.length) {
    box.innerHTML = keys.map(() => '<div class="pane-legend"></div>').join('');
    paneLegendSig = '';
  }
  t ??= bars[bars.length - 1]?.time;
  keys.forEach((k, i) => { box.children[i].innerHTML = t == null ? '' : legendItem(k, t); });
}
// Place chaque légende en haut de son panneau (les panneaux sont redimensionnables)
let paneLegendSig = '';
function paneLegendsFrame() {
  const box = $('paneLegends');
  if (!box.children.length) return;
  const top0 = $('chart').getBoundingClientRect().top;
  const tops = chart.panes().slice(1).map(p => { const el = p.getHTMLElement(); return el ? Math.round(el.getBoundingClientRect().top - top0) : 0; });
  const sig = tops.join(',');
  if (sig === paneLegendSig) return;
  paneLegendSig = sig;
  [...box.children].forEach((el, i) => { el.style.top = (tops[i] ?? 0) + 4 + 'px'; });
}

/* ---------------- Menu des indicateurs ---------------- */
function buildIndMenu() {
  const row = ([k, d]) => `
    <div class="ind-row">
      <label class="ind-check"><input type="checkbox" data-k="${k}" ${S.ind[k].on ? 'checked' : ''}>
        <span><b>${d.name}</b><small>${d.desc}</small></span></label>
      <span class="ind-params">${(d.params || []).map(([p, l, min, max, step]) =>
        `<label title="${l}"><em>${l}</em><input type="number" data-k="${k}" data-p="${p}" min="${min}" max="${max}" step="${step || 1}" value="${S.ind[k][p]}"></label>`).join('')}</span>
    </div>`;
  const all = Object.entries(IND);
  $('indMenu').innerHTML = `
    <div class="ind-head"><span>Indicateurs</span><button class="ind-close" data-close title="Fermer">×</button></div>
    <div class="ind-sec">Sur le graphique</div>${all.filter(([, d]) => !d.pane).map(row).join('')}
    <div class="ind-sec">Dans un panneau séparé</div>${all.filter(([, d]) => d.pane).map(row).join('')}`;
}
function toggleIndMenu(show) {
  const m = $('indMenu');
  show ??= m.hidden;
  m.hidden = !show;
  $('btnInd').classList.toggle('active', show);
  if (!show) return;
  const area = m.parentElement.getBoundingClientRect(), r = $('btnInd').getBoundingClientRect();
  m.style.top = (r.bottom - area.top + 4) + 'px';
  m.style.left = Math.max(8, Math.min(r.left - area.left, area.width - m.offsetWidth - 8)) + 'px';
}
function initIndicators() {
  buildIndMenu();
  rebuildIndicators();
  $('btnInd').addEventListener('click', () => toggleIndMenu());
  $('indMenu').addEventListener('click', e => { if (e.target.closest('[data-close]')) toggleIndMenu(false); });
  $('indMenu').addEventListener('change', e => {
    const el = e.target, k = el.dataset.k;
    if (!k) return;
    if (el.type === 'checkbox') {
      S.ind[k].on = el.checked;
      rebuildIndicators();
    } else {
      const [, , min, max] = IND[k].params.find(p => p[0] === el.dataset.p);
      const v = num(el.value);
      if (!isFinite(v)) { el.value = S.ind[k][el.dataset.p]; return; }
      S.ind[k][el.dataset.p] = el.value = Math.min(max, Math.max(min, v));
      if (S.ind[k].on) refreshIndicators(true);
    }
    save();
    renderLegend(hoverBar || bars[bars.length - 1]);
  });
  document.addEventListener('pointerdown', e => {
    if (!$('indMenu').hidden && !e.target.closest('#indMenu, #btnInd')) toggleIndMenu(false);
  });
  // Croix dans les légendes : retire l'indicateur
  const off = e => {
    const b = e.target.closest('[data-ind-off]');
    if (!b) return;
    S.ind[b.dataset.indOff].on = false;
    save(); rebuildIndicators(); buildIndMenu();
    renderLegend(hoverBar || bars[bars.length - 1]);
  };
  $('legend').addEventListener('click', off);
  $('paneLegends').addEventListener('click', off);
}
