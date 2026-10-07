'use strict';

/* =====================================================================
   Classement en ligne (Supabase). Chaque joueur a un pseudo, un id et un
   secret gardés dans son navigateur ; ses scores passent par la fonction
   submit_score (supabase/migrations), qui vérifie ce secret.
   ===================================================================== */

const PLAYER_KEY = 'paperview.player';
const lbEnabled = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const LB = { player: null, rows: [], total: 0, rank: null, loading: false, error: '', sentSig: '', timer: null, nudged: false };
const MEDALS = ['🥇', '🥈', '🥉'];

function loadPlayer() {
  try {
    const p = JSON.parse(localStorage.getItem(PLAYER_KEY));
    if (p?.id && p?.secret && p?.name) return p;
  } catch { /* stockage indisponible */ }
  return null;
}
function savePlayer() { try { localStorage.setItem(PLAYER_KEY, JSON.stringify(LB.player)); } catch { /* ignore */ } }
const randomHex = bytes => [...window.crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

async function supa(path, { method = 'GET', body, count = false } = {}) {
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: `Bearer ${CONFIG.supabaseKey}`,
      'Content-Type': 'application/json',
      ...(count ? { Prefer: 'count=exact' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || `Erreur ${r.status}`);
  if (!count) return data;
  const total = +(r.headers.get('content-range') || '').split('/')[1];
  return { data, total: isFinite(total) ? total : data.length };
}

// Statistiques envoyées : record sur toutes les parties, partie en cours, trades cumulés
function myStats() {
  const done = S.parties;
  return {
    best: Math.round(Math.max(S.points, ...done.map(p => p.points))),
    current: Math.round(S.points),
    partie: S.partie,
    equity: Math.round(account().equity * 100) / 100,
    trades: S.history.length + done.reduce((t, p) => t + p.trades, 0),
    wins: S.history.filter(h => h.pnl > 0).length + done.reduce((t, p) => t + (p.wins || 0), 0),
  };
}

async function submitScore() {
  if (!lbEnabled() || !LB.player) return;
  const st = myStats(), sig = LB.player.name + JSON.stringify(st);
  if (sig === LB.sentSig) return;
  try {
    LB.rank = await supa('rpc/submit_score', {
      method: 'POST',
      body: {
        p_id: LB.player.id, p_secret: LB.player.secret, p_name: LB.player.name,
        p_best: st.best, p_current: st.current, p_partie: st.partie,
        p_equity: st.equity, p_trades: st.trades, p_wins: st.wins,
      },
    });
    LB.sentSig = sig;
    LB.error = '';
  } catch (e) {
    LB.error = e.message;
  }
  renderWorldRank();
  if (ui.tab === 'board') loadBoard();
}

// Appelé après chaque trade fermé et chaque fin de partie
function onScoreChange() {
  if (!lbEnabled()) return;
  if (!LB.player && !LB.nudged) {
    LB.nudged = true;
    toast('Choisis un pseudo dans l\'onglet « Classement » pour te mesurer aux autres joueurs.');
  }
  clearTimeout(LB.timer);
  LB.timer = setTimeout(submitScore, 1500);
}

async function loadBoard() {
  if (!lbEnabled() || LB.loading) return;
  LB.loading = true;
  renderBoard();
  try {
    const { data, total } = await supa('players?select=id,name,best_points,current_points,partie,equity,trades,wins,updated_at'
      + '&order=best_points.desc,updated_at.asc&limit=100', { count: true });
    LB.rows = data;
    LB.total = total;
    LB.error = '';
  } catch (e) {
    LB.error = e.message;
  }
  LB.loading = false;
  renderBoard();
}

/* ---------------- Affichage ---------------- */
function timeAgo(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 90) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
function boardRow(p, pos) {
  const [, rank, color] = rankOf(p.best_points);
  const mine = LB.player && p.id === LB.player.id;
  return `<tr class="${mine ? 'current' : ''}">
    <td class="lb-pos">${pos <= 3 ? MEDALS[pos - 1] : pos}</td>
    <td class="lb-name">${esc(p.name)}${mine ? '<span class="live-tag">TOI</span>' : ''}</td>
    <td class="${cls(p.best_points)}"><b>${fmtPts(p.best_points)}</b></td>
    <td style="color:${color}">${rank}</td>
    <td class="${cls(p.current_points)}">${fmtPts(p.current_points)} <span class="muted">· partie ${p.partie}</span></td>
    <td>${fmtUSD(+p.equity)}</td>
    <td>${p.trades}</td>
    <td>${p.trades ? Math.round(p.wins / p.trades * 100) + ' %' : '—'}</td>
    <td class="muted">${timeAgo(p.updated_at)}</td>
  </tr>`;
}
function renderBoard() {
  const el = $('tab-board');
  if (!lbEnabled()) {
    el.innerHTML = '<div class="empty">Le classement en ligne n\'est pas configuré sur cette version de l\'application.</div>';
    return;
  }
  const me = LB.player;
  const cta = me ? '' : `<div class="lb-cta"><span>🏆 Tu n'es pas encore dans le classement : choisis un pseudo pour comparer ton record de points à celui des autres joueurs.</span>
    <button class="tour-btn primary" data-lb="name">Choisir un pseudo</button></div>`;
  let body;
  if (!LB.rows.length) {
    body = `<div class="empty">${LB.loading ? 'Chargement du classement…'
      : LB.error ? `Classement indisponible : ${esc(LB.error)}` : 'Personne dans le classement pour l\'instant : sois le premier !'}</div>`;
  } else {
    const inTop = me && LB.rows.some(p => p.id === me.id);
    let extra = '';
    if (me && !inTop && LB.rank) {
      const st = myStats();
      extra = '<tr class="lb-gap"><td colspan="9">…</td></tr>' + boardRow({
        id: me.id, name: me.name, best_points: st.best, current_points: st.current, partie: st.partie,
        equity: st.equity, trades: st.trades, wins: st.wins, updated_at: new Date().toISOString(),
      }, LB.rank);
    }
    body = `<table><thead><tr><th>#</th><th>Joueur</th><th>Record</th><th>Rang</th><th>Partie en cours</th>
      <th>Équité</th><th>Trades</th><th>Réussite</th><th>Actif</th></tr></thead>
      <tbody>${LB.rows.map((p, i) => boardRow(p, i + 1)).join('')}${extra}</tbody></table>`;
  }
  el.innerHTML = cta + body;
  if (ui.tab === 'board') {
    $('tabActions').innerHTML = `<span>Joueurs <b>${LB.total}</b></span>`
      + (me ? `<span>Ton rang <b>${LB.rank ? '#' + LB.rank : '—'}</b></span><button class="act" data-lb="name" title="Changer de pseudo">${esc(me.name)}</button>` : '')
      + '<button class="act" data-lb="refresh">Actualiser</button>';
  }
}
function renderWorldRank() {
  const el = $('worldRank');
  el.textContent = lbEnabled() && LB.player && LB.rank ? ` · 🏆 #${LB.rank}` : '';
  el.title = LB.player ? `${LB.player.name} : ${LB.rank ? `#${LB.rank} au classement` : 'classement en attente'}` : '';
}

/* ---------------- Pseudo ---------------- */
function openNameModal() {
  if (!lbEnabled()) return;
  $('nameErr').textContent = '';
  $('nameInput').value = LB.player?.name || '';
  $('nameModal').hidden = false;
  $('nameInput').focus();
}
async function saveName(e) {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  if (name.length < 2 || name.length > 20 || /[<>\u0000-\u001f]/.test(name)) {
    $('nameErr').textContent = 'Ton pseudo doit faire entre 2 et 20 caractères.';
    return;
  }
  const prev = LB.player;
  LB.player = { id: prev?.id || window.crypto.randomUUID(), secret: prev?.secret || randomHex(24), name };
  LB.sentSig = '';
  const btn = $('nameForm').querySelector('[type=submit]');
  btn.disabled = true;
  await submitScore();
  btn.disabled = false;
  if (LB.error) {   // pseudo déjà pris, réseau…
    $('nameErr').textContent = LB.error;
    LB.player = prev;
    renderWorldRank();
    return;
  }
  savePlayer();
  $('nameModal').hidden = true;
  toast(prev ? `Pseudo changé : ${name}.` : `Bienvenue dans le classement, ${name} ! Tu es #${LB.rank}.`, 'ok');
  loadBoard();
}

function initLeaderboard() {
  LB.player = loadPlayer();
  $('tabs').addEventListener('click', e => { if (e.target.closest('[data-tab=board]')) loadBoard(); });
  const onAction = e => {
    const b = e.target.closest('[data-lb]');
    if (!b) return;
    if (b.dataset.lb === 'name') openNameModal(); else loadBoard();
  };
  $('tab-board').addEventListener('click', onAction);
  $('tabActions').addEventListener('click', onAction);
  $('nameForm').addEventListener('submit', saveName);
  $('nameModal').addEventListener('click', e => {
    if (e.target === $('nameModal') || e.target.closest('[data-close]')) $('nameModal').hidden = true;
  });
  $('nameModal').addEventListener('keydown', e => { if (e.key === 'Escape') $('nameModal').hidden = true; });
  // Cliquer sur le score ouvre le classement
  $('score').addEventListener('click', () => document.querySelector('#tabs [data-tab=board]').click());
  renderBoard();
  renderWorldRank();
  // Premier envoi une fois les prix chargés (équité à jour), puis toutes les minutes
  setTimeout(submitScore, 5000);
  setInterval(() => { submitScore(); if (ui.tab === 'board') loadBoard(); }, 60000);
}
