# Exit the Grind

An original board game about financial freedom and classic personal-finance lessons:
buy assets, build passive income, and escape the paycheck-to-paycheck "Grind". Plays in any browser on
desktop or phone, and installs like an app (PWA) with offline play and autosave.

## Play

**Online:** https://gantor.github.io/exit-the-grind/ (redeploys automatically on every push to `main`).
On a phone, open it and use **Share → Add to Home Screen** (iPhone) or **Install app** (Android) to play it like an app, offline too.

Locally:

```bash
npm install
npm run dev        # http://localhost:5173 on this Mac
npm run phone      # also serves on your Wi-Fi; open the "Network" URL on your phone
```

For a production build (static files in `dist/`, can be hosted anywhere):

```bash
npm run build
npm run preview
```

Deployment is handled by `.github/workflows/deploy.yml`: it runs the tests, builds, and publishes `dist/` to GitHub Pages.

## Sound & music

Sound effects are synthesized in the browser (`src/ui/sound.ts`), so there are no audio files to load.
Background music is a shuffled playlist (`public/audio/theme-*.mp3`, listed in `TRACKS` in `src/ui/music.ts`) that
crossfades between songs and dips under big sound effects. Players can mute everything from the top bar, or adjust
sound, music and skip songs in Settings (⚙︎).

## Rules in short

- Pick a career. Each has a salary, monthly expenses, and debts.
- Move around **the Grind**. Paydays pay your monthly cash flow. Deals let you buy stocks, crypto, rentals and businesses.
  Market cards bring buyers and price swings. Splurges, life events and layoffs test your cushion.
- The bank lends in $1,000 steps at 10% of the balance per month, as long as your payday stays positive.
- When **passive income > total expenses**, you escape to **Freedom Lane**, pick a dream, and win by buying it or by
  adding $50,000 to your freedom payday. In a *Quick game*, the first to escape wins.
- 1–6 players on one device, any mix of humans and computer players.

## Code map

| Path | What it is |
| --- | --- |
| `src/game/types.ts` | Data model |
| `src/game/data/` | Careers, deal cards, market/splurge/life/venture/setback cards, dreams |
| `src/game/engine.ts` | Pure rules engine: `createGame`, `applyAction(state, action)` |
| `src/game/finance.ts` | Income statement math |
| `src/game/bot.ts`, `strategy.ts` | Computer player |
| `src/game/engine.test.ts` | Rule tests + a bot simulation used to balance the game |
| `src/ui/` | React components (board, action cards, statement, setup) |

Run `npm test` to run the rules tests and print the balance table (average turns to escape per career).
