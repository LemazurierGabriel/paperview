# PaperView

Application de trading fictif inspirée de TradingView : on trade avec **10 000 $ d'argent imaginaire**
sur les **vrais prix** (cryptos, Nasdaq, S&P 500, CAC 40, or, argent, pétrole, actions, EUR/USD),
on gagne des points et on se compare aux autres joueurs dans un classement en ligne.

- Graphiques en bougies (lightweight-charts v5), 12 indicateurs, 14 outils de dessin
- Ordres au marché et limite, levier, stop-loss / take-profit, liquidation
- Points, rangs, parties et classement des joueurs
- Tutoriel et exercice guidé pour débutants

## Jouer en local

```bash
node server.mjs
```

puis ouvrir http://localhost:8420. Sans `config.js` rempli, les prix Yahoo passent par `server.mjs`
et le classement en ligne est désactivé.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `app.js` | Données de marché, moteur de trading, interface |
| `indicators.js` | Indicateurs techniques et leurs panneaux |
| `drawings.js` | Outils de dessin (calque SVG) |
| `leaderboard.js` | Pseudo et classement en ligne |
| `tuto.js` | Tutoriel et exercice guidé |
| `config.js` | Adresse et clé publique du projet Supabase |
| `server.mjs` | Serveur local + relais Yahoo Finance |
| `supabase/` | Table du classement et fonction en ligne `market` (relais Yahoo) |

Sources des prix : Binance (cryptos, temps réel) et Yahoo Finance (autres marchés).
Argent 100 % fictif : ceci n'est pas un conseil en investissement.
