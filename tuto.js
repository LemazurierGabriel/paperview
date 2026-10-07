'use strict';

/* =====================================================================
   Tutoriel : présentation de l'écran (TOUR) puis exercice guidé (EXO)
   où le joueur passe lui-même ses ordres, vérifiés en direct.
   Utilise l'état et les helpers globaux définis dans app.js.
   ===================================================================== */

const TUTO_KEY = 'paperview.tutoDone';
const tutoDone = () => { try { return localStorage.getItem(TUTO_KEY) === '1'; } catch { return false; } };
const markTutoDone = () => { try { localStorage.setItem(TUTO_KEY, '1'); } catch { /* ignore */ } };

const CANDLE_SVG = `
<svg class="tour-svg" viewBox="0 0 320 130" aria-label="Anatomie d'une bougie">
  <g font-size="11" fill="#b2b5be" font-family="inherit">
    <line x1="45" y1="12" x2="45" y2="118" stroke="#26a69a" stroke-width="2"/>
    <rect x="33" y="34" width="24" height="56" rx="2" fill="#26a69a"/>
    <text x="66" y="16">Plus haut</text>
    <text x="66" y="38" fill="#fff">Clôture</text>
    <text x="66" y="93">Ouverture</text>
    <text x="66" y="121">Plus bas</text>
    <line x1="205" y1="12" x2="205" y2="118" stroke="#ef5350" stroke-width="2"/>
    <rect x="193" y="34" width="24" height="56" rx="2" fill="#ef5350"/>
    <text x="226" y="16">Plus haut</text>
    <text x="226" y="38">Ouverture</text>
    <text x="226" y="93" fill="#fff">Clôture</text>
    <text x="226" y="121">Plus bas</text>
  </g>
</svg>`;

/* ---------------- Présentation de l'écran ---------------- */
const TOUR = [
  {
    wide: true,
    title: 'Bienvenue sur PaperView',
    body: `
      <p>Ici, tu apprends à trader avec <b>10 000 $ d'argent fictif</b> sur les <b>vrais prix</b> : cryptos, Nasdaq, CAC 40, or, actions…
      Tu peux te tromper autant que tu veux : rien n'est réel.</p>
      <p>Ce tuto te présente l'écran et les notions essentielles en <b>13 étapes</b> (environ 3 minutes),
      puis un <b>exercice guidé</b> où tu passes tes premiers ordres toi-même.</p>
      <p class="muted">Navigation : flèches ← → du clavier, Échap pour quitter.</p>`,
    next: "C'est parti",
    actions: [{ label: "Aller direct à l'exercice", run: () => tourStart(EXO) }],
  },
  {
    target: '.chart-wrap',
    wide: true,
    title: 'Le graphique en bougies',
    body: `
      <p>Chaque <b>bougie</b> résume l'évolution du prix sur une période :</p>
      ${CANDLE_SVG}
      <ul>
        <li><b class="up">Verte</b> : le prix a monté (il clôture au-dessus de son ouverture).</li>
        <li><b class="down">Rouge</b> : le prix a baissé.</li>
        <li>Les <b>mèches</b> montrent le plus haut et le plus bas atteints.</li>
      </ul>
      <p>En haut à gauche s'affichent O, H, B, C (ouverture, haut, bas, clôture) de la bougie survolée.
      Molette pour zoomer, cliquer-glisser pour se déplacer.</p>`,
  },
  {
    target: '#tfGroup',
    place: 'bottom',
    title: 'Les unités de temps',
    body: `
      <p>Elles fixent la durée d'une bougie : en <b>15m</b>, chaque bougie couvre 15 minutes ; en <b>1J</b>, une journée.</p>
      <p><b>Astuce :</b> regarde d'abord une unité longue (4H, 1J) pour voir la <b>tendance de fond</b>,
      puis une courte (5m, 15m) pour choisir ton moment d'entrée.</p>`,
  },
  {
    target: ['#chartType', '#btnShot'],
    place: 'bottom',
    title: 'Type de graphique et indicateurs',
    body: `
      <p>Le menu <b>Bougies</b> change l'affichage : Heikin Ashi (bougies lissées, tendance plus lisible), barres, ligne, zone.</p>
      <p><b><i>ƒx</i> Indicateurs</b> ouvre la liste, avec une explication pour chacun et des réglages modifiables :</p>
      <ul>
        <li><b>Sur le graphique</b> : moyennes mobiles (tendance), Bollinger (volatilité), VWAP, Ichimoku, SAR parabolique, volume.</li>
        <li><b>Dans un panneau</b> : RSI (suracheté / survendu), MACD (changement de tendance), Stochastique, ATR (volatilité).</li>
      </ul>
      <p>Survole un indicateur dans la légende et clique sur <b>×</b> pour le retirer.
      <b>Log</b> passe en échelle logarithmique, <b>Recentrer</b> revient aux dernières bougies, l'appareil photo fait une capture.</p>`,
  },
  {
    target: '#drawBar',
    place: 'right',
    title: 'Les outils de dessin',
    body: `
      <ul>
        <li><b>Lignes de tendance, horizontales, canaux</b> : repère supports, résistances et tendances.</li>
        <li><b>Fibonacci</b> : trace-le du début à la fin d'un mouvement ; les niveaux 0,382 / 0,5 / 0,618 sont des zones de rebond fréquentes.</li>
        <li><b>Mesure</b> : écart de prix, pourcentage et durée entre deux points.</li>
        <li><b>Position longue / courte</b> : 2 clics (entrée puis stop), l'objectif se place à 2 fois le risque.
          Sélectionne-la puis <b>Préparer l'ordre</b> pour remplir le panneau d'ordre automatiquement.</li>
        <li><b>Alerte</b> : un son et un message quand le prix touche ton niveau.</li>
      </ul>
      <p class="muted">Clique sur un dessin pour le sélectionner, le déplacer ou changer sa couleur. Suppr pour l'effacer, Ctrl+Z pour annuler,
      Échap pour revenir au curseur. Raccourcis : Alt+T (tendance), Alt+H (horizontale), Alt+F (Fibonacci), Alt+L (position longue)…</p>`,
  },
  {
    target: '.watchlist',
    place: 'left',
    title: 'La liste de suivi',
    body: `
      <p>Les actifs disponibles, triés par catégorie : <b>cryptos</b>, <b>indices</b> (Nasdaq, S&amp;P 500, CAC 40),
      <b>matières premières</b> (or, argent, pétrole), <b>actions</b> et <b>forex</b>. Clique sur une ligne pour afficher son graphique.</p>
      <p><b>Horaires :</b> les cryptos s'échangent 24h/24. Les autres marchés ferment la nuit et le week-end
      (mention <span style="color:#ff9800">fermé</span>) : le prix ne bouge plus et les ordres au marché sont bloqués.</p>
      <p>Un point bleu à côté d'un actif = tu as une position ouverte dessus.</p>`,
  },
  {
    target: '.side-switch',
    place: 'left',
    title: 'Long ou Short : le sens de ton pari',
    body: `
      <p><b class="up">Long (acheter)</b> : tu gagnes si le prix <b>monte</b>.</p>
      <div class="tour-ex">Tu achètes à 100 $, le prix passe à 110 $ → <b class="up">+10 %</b>.</div>
      <p><b class="down">Short (vendre)</b> : tu gagnes si le prix <b>baisse</b>.</p>
      <div class="tour-ex">Tu vends à 100 $, le prix tombe à 90 $ → <b class="up">+10 %</b>. S'il monte à 110 $ → <b class="down">−10 %</b>.</div>
      <p>Tu peux donc gagner dans les deux sens, à condition d'avoir raison sur la direction.</p>`,
  },
  {
    target: '.type-switch',
    place: 'left',
    title: 'Ordre au marché ou limite',
    body: `
      <p><b>Marché</b> : exécution <b>immédiate</b> au prix actuel.</p>
      <p><b>Limite</b> : tu choisis un prix et l'ordre <b>attend</b> que le marché l'atteigne, puis s'exécute tout seul.</p>
      <ul>
        <li>Prix <b>sous</b> le cours actuel → tu achètes moins cher si le prix redescend.</li>
        <li>Prix <b>au-dessus</b> → tu achètes seulement si le prix casse ce niveau.</li>
      </ul>
      <p><b>Astuce :</b> en mode Limite, clique sur le graphique pour fixer le prix. Les ordres en attente s'affichent en jaune.</p>`,
  },
  {
    target: ['#fAmount', '#fLev'],
    place: 'left',
    wide: true,
    title: 'La marge et le levier',
    body: `
      <p>La <b>marge</b>, c'est l'argent que tu engages. Le <b>levier</b> multiplie la taille de ta position…
      <b>et donc tes gains ET tes pertes</b> :</p>
      <table>
        <caption>Avec 1 000 $ de marge</caption>
        <thead><tr><th>Levier</th><th>Position</th><th>Prix +2 %</th><th>Prix −2 %</th></tr></thead>
        <tbody>
          <tr><td>1×</td><td>1 000 $</td><td class="up">+20 $</td><td class="down">−20 $</td></tr>
          <tr><td>10×</td><td>10 000 $</td><td class="up">+200 $</td><td class="down">−200 $</td></tr>
          <tr><td>50×</td><td>50 000 $</td><td class="up">+1 000 $</td><td class="down">liquidé</td></tr>
        </tbody>
      </table>
      <p><b>Liquidation</b> : si ta perte atteint 90 % de ta marge, la position est fermée de force.
      À 10×, une baisse d'environ 9 % suffit ; à 50×, moins de 2 %.</p>
      <p><b>Conseil :</b> quand tu débutes, reste entre 1× et 3×.</p>`,
  },
  {
    target: '#fSLTP',
    place: 'left',
    title: 'Stop-loss et take-profit',
    body: `
      <p><b class="down">Stop-loss (SL)</b> : le prix auquel ta position est <b>coupée automatiquement</b> pour limiter la perte.</p>
      <p><b class="up">Take-profit (TP)</b> : le prix auquel ton gain est <b>encaissé automatiquement</b>.</p>
      <div class="tour-ex">Long à 100 $ · SL à 97 $ (risque −3 %) · TP à 106 $ (objectif +6 %).<br>
      Le gain visé vaut 2 fois le risque (ratio 1:2) : même en n'ayant raison <b>qu'une fois sur deux</b>, tu es gagnant.</div>
      <p><b>Règle d'or :</b> place toujours un stop-loss. Tu pourras le modifier ensuite depuis le tableau des positions.</p>`,
  },
  {
    target: ['#summary', '#btnSubmit'],
    place: 'left',
    title: 'Vérifie avant de valider',
    body: `
      <p>Le résumé calcule tout pour toi : <b>quantité</b>, <b>valeur de la position</b>, <b>frais</b>
      (0,04 % à l'ouverture et à la fermeture), <b>prix de liquidation</b>, et ce que tu gagnes ou perds
      si ton SL ou ton TP est touché.</p>
      <p>Si la perte possible au stop-loss te semble trop grosse, réduis la marge ou le levier.</p>`,
  },
  {
    target: '.bottom-panel',
    place: 'top',
    before: () => document.querySelector('#tabs [data-tab=positions]')?.click(),
    title: 'Suivre tes positions',
    body: `
      <p><b>Positions</b> : tes trades ouverts avec leur <b>PnL</b> (profit and loss : ton gain ou ta perte) en direct.
      Clique sur un SL ou un TP pour le modifier, ou sur <b>Fermer</b> pour sortir au prix du marché.</p>
      <p><b>Ordres en attente</b> : tes ordres limite pas encore exécutés.<br>
      <b>Historique</b> : tes trades fermés et ton taux de réussite.<br>
      <b>Parties</b> : tes scores passés.</p>
      <p>Sur le graphique, ton entrée apparaît en bleu, le SL en rouge et le TP en vert.</p>`,
  },
  {
    target: '#score',
    place: 'bottom',
    title: 'Points, rangs et parties',
    body: `
      <p>À chaque trade fermé : <b class="up">1 $ gagné = +1 point</b>, <b class="down">1 $ perdu = −1 point</b>.</p>
      <p>Monte en rang : <b style="color:#d08c5b">Bronze</b> (500), <b style="color:#cfd8dc">Argent</b> (1 500),
      <b style="color:#f7c948">Or</b> (3 000), <b style="color:#c4b5fd">Platine</b> (6 000), <b style="color:#6ee7f9">Diamant</b> (10 000).</p>
      <p><b>Réinitialiser</b> termine la partie : retour à 10 000 $ et 0 point. Ton score reste dans l'onglet Parties : essaie de battre ton record !</p>`,
  },
  {
    wide: true,
    title: "Les 5 règles d'or",
    body: `
      <ol>
        <li><b>Risque peu par trade</b> : au maximum 1 à 2 % de ton capital (100 à 200 $ ici) si le stop-loss est touché.</li>
        <li><b>Toujours un stop-loss</b>, décidé avant d'entrer.</li>
        <li><b>Un levier faible</b> tant que tu débutes.</li>
        <li><b>Pas de vengeance</b> après une perte : aucun trade impulsif pour « se refaire ».</li>
        <li><b>Relis tes trades</b> dans l'historique : qu'est-ce qui a marché, qu'est-ce qui a raté ?</li>
      </ol>
      <div class="tour-ex"><b>Et maintenant, la pratique :</b> l'exercice guidé te fait passer tes deux premiers ordres,
      étape par étape. Je vérifie chaque action en direct.</div>
      <p class="muted">Tu peux revoir ce tuto à tout moment avec le bouton « ? Tuto » en haut.</p>`,
    next: 'Terminer',
    actions: [{ label: "Commencer l'exercice", primary: true, run: () => tourStart(EXO) }],
  },
];

/* ---------------- Exercice guidé ---------------- */
const exo = { startSeq: 0 };
const pNow = () => M.price[S.sym];
const ratioOf = (sl, tp, p) => (tp - p) / (p - sl);
const pctOf = id => { const v = num($(id).value), p = pNow(); return v > 0 && p ? v / p - 1 : null; };
const fmtRatio = r => r.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const stOk = t => `<span class="st-ok">✓ ${t}</span>`;
const stBad = t => `<span class="st-bad">${t}</span>`;
const stWait = t => `<span class="st-wait">${t}</span>`;
const exoPos = () => S.positions.filter(p => p.sym === 'BTCUSDT' && p.id >= exo.startSeq).pop();
const exoOrder = () => S.orders.filter(o => o.sym === 'ETHUSDT' && o.id >= exo.startSeq).pop();

const EXO = [
  {
    wide: true,
    before: () => { exo.startSeq = S.seq; },
    title: 'Exercice guidé : tes deux premiers ordres',
    body: `
      <p>Tu vas passer <b>toi-même</b> deux ordres :</p>
      <ol>
        <li><b>Mission 1</b> : acheter du Bitcoin au prix actuel, protégé par un stop-loss et un take-profit.</li>
        <li><b>Mission 2</b> : placer un ordre limite pour acheter de l'Ethereum un peu moins cher.</li>
      </ol>
      <p>À chaque étape, fais l'action demandée dans l'application : je vérifie en direct et je t'explique ce que tu fais.
      Si tu bloques, le lien « Le faire pour moi » le fait à ta place.</p>`,
    next: 'Commencer',
  },
  {
    target: '.wl-row[data-sym="BTCUSDT"]', place: 'left', auto: true,
    before: () => { $('wlFilter').value = ''; setCat('crypto'); },
    title: 'Mission 1 · Choisis le Bitcoin',
    body: `<p>Clique sur la ligne <b>BTC</b> dans la liste de suivi pour afficher son graphique.</p>
      <p class="muted">Le Bitcoin s'échange 24h/24 et 7j/7 : idéal pour s'entraîner à toute heure.</p>`,
    check: () => S.sym === 'BTCUSDT',
    help: () => selectSymbol('BTCUSDT'),
  },
  {
    target: '.side-switch', place: 'left', auto: true,
    title: 'Tu paries sur la hausse',
    body: `<p>Tu penses que le prix va <b>monter</b> ? Clique sur <b class="up">Acheter / Long</b>.</p>
      <p class="muted">Si tu pensais qu'il allait baisser, tu choisirais Short.</p>`,
    check: () => ui.side === 'long',
    help: () => setSide('long'),
  },
  {
    target: '.type-switch', place: 'left', auto: true,
    title: 'Un ordre au marché',
    body: '<p>Clique sur <b>Marché</b> : ton ordre sera exécuté tout de suite, au prix actuel.</p>',
    check: () => ui.type === 'market',
    help: () => setType('market'),
  },
  {
    target: '#fAmount', place: 'left', focus: '#inAmount',
    title: 'Combien tu engages',
    body: `<p>Dans le champ <b>Marge</b>, efface le montant et tape <b>500</b>.</p>
      <p>500 $, c'est 5 % de ton capital : on ne met jamais tout sur un seul trade.</p>`,
    check: () => num($('inAmount').value) === 500,
    status: done => {
      const v = num($('inAmount').value);
      if (done) return stOk('500 $ engagés, tu gardes 95 % de ton capital à l\'abri.');
      return isNaN(v) ? stWait('Tape 500 dans le champ Marge…') : stBad(`Tu as mis ${fmtUSD(v)} : il faut 500.`);
    },
    help: () => { $('inAmount').value = '500'; renderSummary(); },
  },
  {
    target: '#fLev', place: 'left', focus: '#inLev', auto: true,
    title: 'Pas de levier',
    body: `<p>Dans <b>Levier</b>, choisis <b>1×</b>.</p>
      <p>Sans levier, si le Bitcoin fait +1 %, ta position fait +1 %, et tu ne peux pas être liquidé.</p>`,
    check: () => $('inLev').value === '1',
    status: done => done ? stOk('Levier 1× : aucun risque de liquidation.') : stBad(`Levier actuel : ${$('inLev').value}×. Choisis 1×.`),
    help: () => { $('inLev').value = '1'; renderSummary(); },
  },
  {
    target: '#fSL', place: 'left', focus: '#inSL',
    title: 'Ton stop-loss : environ −2 %',
    body: () => `<p>Le Bitcoin vaut <b>${fmtP(pNow())}</b>.</p>
      <p>Place ton stop-loss <b>environ 2 % plus bas</b>, soit à peu près <b>${fmtP(pNow() * 0.98, 0)}</b> :
      tape ce prix dans le champ <b>Stop-loss</b>.</p>
      <p class="muted">Si le prix tombe jusque-là, la position se ferme toute seule : ta perte reste petite.</p>`,
    check: () => { const r = pctOf('inSL'); return r != null && r <= -0.01 && r >= -0.04; },
    status: done => {
      const v = num($('inSL').value), r = pctOf('inSL');
      if (isNaN(v)) return stWait('En attente de ton stop-loss…');
      if (r == null) return stBad('Valeur invalide.');
      if (done) return stOk(`Stop à ${fmtPct(r)} du prix : parfait !`);
      if (r >= 0) return stBad('Pour un Long, le stop-loss doit être SOUS le prix actuel.');
      if (r > -0.01) return stBad(`Stop à ${fmtPct(r)} : trop proche, la moindre petite baisse le déclencherait. Vise environ −2 %.`);
      return stBad(`Stop à ${fmtPct(r)} : trop loin, tu risquerais trop. Vise environ −2 %.`);
    },
    help: () => { $('inSL').value = roundP(pNow() * 0.98); renderSummary(); },
  },
  {
    target: '#fTP', place: 'left', focus: '#inTP',
    title: 'Ton objectif : environ +4 %',
    body: () => `<p>Vise <b>2 fois ce que tu risques</b> : avec un stop à −2 %, ton take-profit se place vers <b>+4 %</b>,
      soit environ <b>${fmtP(pNow() * 1.04, 0)}</b>. Tape ce prix dans <b>Take-profit</b>.</p>`,
    check: () => {
      const p = pNow(), sl = num($('inSL').value), tp = num($('inTP').value);
      return sl > 0 && sl < p && tp > p && tp / p - 1 <= 0.12 && ratioOf(sl, tp, p) >= 1.5;
    },
    status: done => {
      const p = pNow(), sl = num($('inSL').value), tp = num($('inTP').value);
      if (isNaN(tp)) return stWait('En attente de ton take-profit…');
      if (!(sl > 0 && sl < p)) return stBad('Il manque un stop-loss valide : reviens à l\'étape précédente.');
      if (!(tp > p)) return stBad('Pour un Long, le take-profit doit être AU-DESSUS du prix actuel.');
      const r = tp / p - 1, ratio = ratioOf(sl, tp, p);
      if (done) return stOk(`Objectif à ${fmtPct(r)} · ratio risque/gain 1:${fmtRatio(ratio)}`);
      if (r > 0.12) return stBad(`Objectif à ${fmtPct(r)} : très loin, il risque de ne jamais être atteint. Vise environ +4 %.`);
      return stBad(`Objectif à ${fmtPct(r)} pour un risque de ${fmtPct(sl / p - 1)} : ratio 1:${fmtRatio(ratio)}. Vise au moins 2 fois ton risque.`);
    },
    help: () => {
      const p = pNow(), sl = num($('inSL').value);
      $('inTP').value = roundP(sl > 0 && sl < p ? p + 2 * (p - sl) : p * 1.04);
      renderSummary();
    },
  },
  {
    target: '#summary', place: 'left',
    title: 'Lis le résumé avant de valider',
    body: () => {
      const f = readOrderForm(), n = f.qty * f.price;
      const outcome = lvl => dirOf(f.side) * (lvl - f.price) * f.qty - n * FEE * 2;
      return `<p>Le résumé te dit tout <b>avant</b> d'entrer :</p>
        <ul>
          <li>Tu achètes <b>${fmtQty(f.qty)} BTC</b> pour <b>${fmtUSD(n)}</b> (frais : ${fmtUSD(n * FEE)}).</li>
          ${f.sl ? `<li>Si ton stop-loss est touché : <b class="down">${fmtSigned(outcome(f.sl))}</b>.</li>` : ''}
          ${f.tp ? `<li>Si ton objectif est atteint : <b class="up">${fmtSigned(outcome(f.tp))}</b>.</li>` : ''}
        </ul>
        <p>Tu connais ta perte maximale à l'avance : c'est ça, <b>gérer son risque</b>.</p>`;
    },
    next: "J'ai compris",
  },
  {
    target: '#btnSubmit', place: 'left', auto: true,
    title: 'À toi : ouvre ta position !',
    body: '<p>Clique sur le bouton vert <b class="up">Acheter / Long BTC</b>.</p>',
    check: () => !!exoPos(),
    status: done => done ? stOk('Position ouverte !') : stWait('En attente de ton clic sur le bouton vert…'),
  },
  {
    target: '.bottom-panel', place: 'top',
    before: () => document.querySelector('#tabs [data-tab=positions]')?.click(),
    title: 'Bravo, ta position est ouverte !',
    body: `<p>Elle apparaît dans l'onglet <b>Positions</b>. La colonne <b>PnL</b> (ton gain ou ta perte) bouge en direct avec le prix.</p>
      <p class="muted">Juste après l'achat, il est proche de 0 : il suit ensuite chaque mouvement du prix.</p>`,
    status: () => {
      const p = exoPos();
      if (!p) return '';
      const pnl = pnlOf(p, M.price[p.sym] ?? p.entry);
      return `<span class="${cls(pnl)}">PnL en direct : <b>${fmtSigned(pnl)}</b> (${fmtPct(pnl / p.margin)})</span>`;
    },
  },
  {
    target: '.chart-wrap', place: 'inside',
    title: 'Ton trade sur le graphique',
    body: `<p>La ligne <b style="color:#2962ff">bleue</b> marque ton prix d'entrée, la <b class="down">rouge pointillée</b> ton stop-loss
      et la <b class="up">verte pointillée</b> ton take-profit.</p>
      <p>Tu n'as plus rien à faire : si le prix touche l'une des deux, la position se ferme toute seule et tes points sont comptés.
      Tu peux aussi la fermer toi-même avec « Fermer ».</p>`,
  },
  {
    wide: true,
    title: "Mission 2 · L'ordre limite",
    body: `<p>Tu aimerais acheter de l'<b>Ethereum</b>, mais un peu moins cher qu'aujourd'hui.</p>
      <p>Plutôt que de surveiller l'écran, tu places un <b>ordre limite</b> : il attend tout seul que le prix descende jusqu'à ton niveau,
      puis s'exécute automatiquement.</p>`,
    next: 'Continuer',
    actions: [{ label: 'Terminer ici', run: () => tourEnd() }],
  },
  {
    target: '.wl-row[data-sym="ETHUSDT"]', place: 'left', auto: true,
    before: () => { $('wlFilter').value = ''; setCat('crypto'); },
    title: "Choisis l'Ethereum",
    body: '<p>Clique sur la ligne <b>ETH</b> dans la liste de suivi.</p>',
    check: () => S.sym === 'ETHUSDT',
    help: () => selectSymbol('ETHUSDT'),
  },
  {
    target: ['.side-switch', '.type-switch'], place: 'left', auto: true,
    title: 'Passe en mode Limite',
    body: '<p>Garde <b class="up">Acheter / Long</b> sélectionné, puis clique sur <b>Limite</b>.</p>',
    check: () => ui.type === 'limit' && ui.side === 'long',
    status: done => {
      if (done) return stOk('Mode Limite activé : un champ « Prix limite » est apparu.');
      return ui.side !== 'long' ? stBad('Repasse sur « Acheter / Long ».') : stWait('Clique sur « Limite »…');
    },
    help: () => { setSide('long'); setType('limit'); },
  },
  {
    target: '.chart-wrap', place: 'inside',
    before: () => { $('inLimit').value = ''; renderSummary(); },
    title: "Choisis ton prix d'achat",
    body: () => `<p>L'Ethereum vaut <b>${fmtP(pNow())}</b>.</p>
      <p><b>Clique sur le graphique un peu en dessous</b> de la dernière bougie, vers <b>${fmtP(pNow() * 0.99, 0)}</b> (environ −1 %).</p>
      <p class="muted">Tu peux aussi taper le prix dans le champ « Prix limite » à droite.</p>`,
    check: () => { const r = pctOf('inLimit'); return ui.type === 'limit' && r != null && r <= -0.002 && r >= -0.03; },
    status: done => {
      const v = num($('inLimit').value), r = pctOf('inLimit');
      if (ui.type !== 'limit') return stBad('Repasse en mode « Limite ».');
      if (isNaN(v)) return stWait('En attente de ton prix : clique sur le graphique…');
      if (r == null) return stBad('Valeur invalide.');
      if (done) return stOk(`Achat si l'Ethereum descend à ${fmtP(v)} (${fmtPct(r)}).`);
      if (r >= 0) return stBad(`Prix au-dessus du cours actuel (${fmtPct(r)}) : ce serait un achat « stop », qui attend une hausse. Pour cet exercice, clique plus bas.`);
      if (r > -0.002) return stBad(`Trop proche (${fmtPct(r)}) : ce serait presque un ordre au marché. Clique un peu plus bas.`);
      return stBad(`Trop loin (${fmtPct(r)}) : l'ordre risque de ne jamais s'exécuter. Reste entre −0,2 % et −3 %.`);
    },
    help: () => { setType('limit'); $('inLimit').value = roundP(pNow() * 0.99); renderSummary(); },
  },
  {
    target: '#btnSubmit', place: 'left', auto: true,
    title: 'Place ton ordre',
    body: `<p>Clique sur <b class="up">Acheter / Long ETH (limite)</b>.</p>
      <p class="muted">Ta marge est mise de côté pendant que l'ordre attend.</p>`,
    check: () => !!exoOrder() || S.positions.some(p => p.sym === 'ETHUSDT' && p.id >= exo.startSeq),
    status: done => done ? stOk('Ordre placé !') : stWait('En attente de ton clic sur le bouton…'),
  },
  {
    target: '.bottom-panel', place: 'top',
    before: () => document.querySelector('#tabs [data-tab=orders]')?.click(),
    title: 'Ton ordre attend',
    body: `<p>Il apparaît dans <b>Ordres en attente</b>, et sur le graphique sous forme de <b style="color:#f7d000">ligne jaune</b>.</p>
      <p>Dès que le prix touche ton niveau, il devient une position ouverte, tout seul, même si tu regardes un autre actif.
      Tu peux l'annuler à tout moment avec « Annuler ».</p>`,
    status: () => {
      const o = exoOrder();
      if (!o) return S.positions.some(p => p.sym === 'ETHUSDT' && p.id >= exo.startSeq) ? stOk('Ton ordre vient d\'être exécuté !') : '';
      const mark = M.price[o.sym];
      return mark ? stWait(`ETH vaut ${fmtP(mark)} · encore ${fmtPct(o.price / mark - 1)} avant l'exécution.`) : '';
    },
  },
  {
    wide: true,
    title: 'Exercice terminé, bravo !',
    body: `<p>Tu sais maintenant :</p>
      <ul>
        <li>choisir un actif et le sens de ton pari (Long ou Short) ;</li>
        <li>passer un ordre au marché avec une <b>mise raisonnable</b> ;</li>
        <li>protéger un trade avec un <b>stop-loss</b> et un <b>take-profit</b> en ratio 1:2 ;</li>
        <li>placer un <b>ordre limite</b> qui attend ton prix.</li>
      </ul>
      <p><b>Pour la suite :</b> essaie un Short quand un marché baisse, et découvre le Nasdaq, le CAC 40 ou l'or
      (catégories en haut de la liste). Attention à leurs horaires : quand ils sont fermés, le prix ne bouge pas.</p>`,
    next: 'Terminer',
  },
];

/* ---------------- Moteur du tutoriel ---------------- */
const tour = { steps: TOUR, i: 0, active: false, timer: null, sawFalse: false, advancing: false, status: null };
const curStep = () => tour.steps[tour.i];
const inExo = () => tour.steps === EXO;

function tourStart(steps = TOUR, i = 0) {
  setTool(null);
  tour.steps = steps;
  tour.active = true;
  document.body.classList.add('touring');
  $('tour').hidden = false;
  tourShow(i);
}

function tourEnd() {
  clearInterval(tour.timer);
  tour.active = false;
  document.body.classList.remove('touring');
  $('tour').classList.remove('free');
  $('tour').hidden = true;
  markTutoDone();
}

function tourNext() {
  if (tour.i >= tour.steps.length - 1) tourEnd();
  else tourShow(tour.i + 1);
}

function tourShow(i) {
  clearInterval(tour.timer);
  tour.i = Math.max(0, Math.min(i, tour.steps.length - 1));
  const st = curStep(), n = tour.steps.length, last = tour.i === n - 1;
  st.before?.();
  Object.assign(tour, { sawFalse: false, advancing: false, status: null });
  // Pendant l'exercice, l'application reste cliquable autour de la carte
  $('tour').classList.toggle('free', inExo() && !!st.target);

  const label = inExo()
    ? (tour.i === 0 ? 'Exercice guidé' : `Exercice · étape ${tour.i} / ${n - 1}`)
    : (tour.i === 0 ? 'Tutoriel' : `Étape ${tour.i} / ${n - 1}`);
  const actions = (st.actions || []).map((a, k) => ({ ...a, k }));
  const actionBtn = a => `<button class="tour-btn ${a.primary ? 'primary' : 'secondary'}" data-act="action" data-k="${a.k}">${a.label}</button>`;
  const card = $('tourCard');
  card.classList.toggle('wide', !!st.wide);
  card.innerHTML = `
    <div class="tour-step">${label}</div>
    <h3 id="tourTitle">${st.title}</h3>
    <div class="tour-body">${typeof st.body === 'function' ? st.body() : st.body}</div>
    ${st.check || st.status ? '<div class="tour-status" id="tourStatus"></div>' : ''}
    ${st.help ? '<div class="tour-helpbar"><button class="tour-help" data-act="help">Le faire pour moi</button></div>' : ''}
    <div class="tour-progress"><i style="width:${(tour.i / (n - 1)) * 100}%"></i></div>
    <div class="tour-nav">
      ${last ? '<span class="tour-skip"></span>' : `<button class="tour-skip" data-act="skip">${inExo() ? "Quitter l'exercice" : 'Passer le tuto'}</button>`}
      ${tour.i > 0 ? '<button class="tour-btn secondary" data-act="prev">Précédent</button>' : ''}
      ${actions.filter(a => !a.primary).map(actionBtn).join('')}
      <button class="tour-btn ${actions.some(a => a.primary) ? 'secondary' : 'primary'}" data-act="next">${st.next || (last ? 'Terminer' : 'Suivant')}</button>
      ${actions.filter(a => a.primary).map(actionBtn).join('')}
    </div>`;
  card.scrollTop = 0;
  tourPlace(true);
  if (st.check || st.status) {
    tourTick();
    tour.timer = setInterval(tourTick, 250);
  }
  const focusEl = st.focus ? document.querySelector(st.focus) : card.querySelector('[data-act=next]:not(:disabled)');
  focusEl?.focus({ preventScroll: true });
}

// Vérifie l'action attendue et met à jour le retour en direct
function tourTick() {
  if (!tour.active) return;
  const st = curStep(), card = $('tourCard');
  const done = st.check ? !!st.check() : true;
  if (!done) tour.sawFalse = true;
  const next = card.querySelector('[data-act=next]');
  if (next) {
    next.disabled = !done;
    next.classList.toggle('ready', done && !!st.check);
  }
  const box = $('tourStatus');
  if (box) {
    const html = st.status
      ? st.status(done)
      : (done ? stOk(tour.sawFalse ? 'Bravo !' : 'Déjà fait !') : stWait('En attente de ton action…'));
    if (html !== tour.status) {
      box.innerHTML = html;
      tour.status = html;
      tourPlace(false);
    }
  }
  // Une action faite pendant l'étape (et non déjà faite avant) fait avancer tout seul
  if (done && st.auto && tour.sawFalse && !tour.advancing) {
    tour.advancing = true;
    const idx = tour.i, steps = tour.steps;
    setTimeout(() => { if (tour.active && tour.steps === steps && tour.i === idx) tourNext(); }, 900);
  }
}

// Rectangle englobant les éléments ciblés par l'étape (null = étape centrée)
function tourTargetRect(st, scroll) {
  if (!st.target) return null;
  const els = [].concat(st.target).map(s => document.querySelector(s)).filter(e => e && e.getClientRects().length);
  if (!els.length) return null;
  if (scroll) {
    els[0].scrollIntoView({ block: 'nearest' });
    // Sur mobile la carte occupe le bas de l'écran : on remonte la cible en haut
    if (innerWidth <= 700) window.scrollBy({ top: els[0].getBoundingClientRect().top - 16, behavior: 'instant' });
  }
  const rs = els.map(e => e.getBoundingClientRect());
  const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
  const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

function tourPlace(scroll = false) {
  if (!tour.active) return;
  const st = curStep(), spot = $('tourSpot'), card = $('tourCard');
  const vw = innerWidth, vh = innerHeight, pad = 6, gap = 14, m = 12;
  const px = v => Math.round(v) + 'px';
  const r = tourTargetRect(st, scroll);
  const w = card.offsetWidth, h = card.offsetHeight;

  if (!r) {
    spot.className = 'tour-spot center';
    Object.assign(spot.style, { left: px(vw / 2), top: px(vh / 2), width: '0px', height: '0px' });
    Object.assign(card.style, { left: px((vw - w) / 2), top: px(Math.max(m, (vh - h) / 2)) });
    return;
  }
  const s = { left: r.left - pad, top: r.top - pad, width: r.width + 2 * pad, height: r.height + 2 * pad };
  spot.className = 'tour-spot';
  Object.assign(spot.style, { left: px(s.left), top: px(s.top), width: px(s.width), height: px(s.height) });

  if (vw <= 700) { card.style.left = card.style.top = ''; return; } // carte en bas d'écran (CSS)

  const clampX = x => Math.min(Math.max(x, m), vw - w - m);
  const clampY = y => Math.min(Math.max(y, m), vh - h - m);
  const fits = ([x, y]) => x >= m && y >= m && x + w <= vw - m && y + h <= vh - m;
  // À l'intérieur de la cible, en haut à gauche : laisse visibles les dernières bougies (à droite)
  const inside = [clampX(s.left + 16), clampY(s.top + 56)];
  const spots = {
    right: [s.left + s.width + gap, clampY(s.top)],
    left: [s.left - gap - w, clampY(s.top)],
    bottom: [clampX(s.left), s.top + s.height + gap],
    top: [clampX(s.left), s.top - gap - h],
  };
  const pos = st.place === 'inside' ? inside
    : [st.place || 'right', 'right', 'left', 'bottom', 'top'].map(k => spots[k]).find(fits) || inside;
  Object.assign(card.style, { left: px(pos[0]), top: px(pos[1]) });
}

$('tourCard').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const st = curStep();
  switch (btn.dataset.act) {
    case 'next': tourNext(); break;
    case 'prev': tourShow(tour.i - 1); break;
    case 'skip': tourEnd(); break;
    case 'help': st.help?.(); tourTick(); break;
    case 'action': st.actions[+btn.dataset.k].run(); break;
  }
});

document.addEventListener('keydown', e => {
  if (!tour.active) return;
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
  if (e.key === 'Escape') tourEnd();
  else if (e.key === 'Enter' && typing && inExo()) { /* pas d'envoi d'ordre au clavier pendant l'exercice */ }
  else if (typing) return;
  else if (e.key === 'ArrowRight') { const nb = $('tourCard').querySelector('[data-act=next]'); if (nb && !nb.disabled) tourNext(); }
  else if (e.key === 'ArrowLeft') tourShow(tour.i - 1);
  else return;
  e.preventDefault();
  e.stopPropagation();
}, true);

window.addEventListener('resize', () => tourPlace(false));
$('btnTuto').addEventListener('click', () => tourStart(TOUR));

// Premier lancement : on laisse le graphique se charger avant d'ouvrir le tuto
if (!tutoDone()) setTimeout(() => tourStart(TOUR), 900);
