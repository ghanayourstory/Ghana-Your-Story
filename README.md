# Sika City

A 3D life simulator set in real Accra, Ghana. Build a life from a rented room in Kaneshie to a home in Trasacco Valley.

## Run it

```bash
npm install
npm run dev        # game server on :8787 + Vite client on :5173 (dev tools on for test accounts)
npm test           # 32 server tests: money, purchases, construction, betting, persistence
npm run typecheck
npm run build && npm start        # production: server serves dist/ on :8787
npm run build:demo                # self-contained offline demo (engine runs in the browser)
```

Requires Node 22.18+ (uses built-in `node:sqlite` and TypeScript type stripping, no server dependencies).

## Architecture

- `shared/` — game rules and data shared by server and client: real-geography cities (`cities.ts`, `geo.ts`), districts and places (`world.ts`), people (`people.ts`), economy (`economy.ts`), goals and life events (`progress.ts`), football validation and payouts (`football.ts`).
- `server/` — the authoritative engine. Every action runs in one SQL transaction with an idempotency key; money moves only through the double-entry-style ledger (`ledger.ts`), and balances can be re-derived and audited. The game clock advances only from real play time (capped) and timed actions.
- `src/` — React UI + three.js world (`src/world/`): procedural districts, traffic, crowds, weather, sky, interiors, construction sites, sound.
- `scripts/import-osm.mjs` — imports real streets and building footprints from OpenStreetMap per district (needs network access to overpass-api.de).

## Adding a city

1. Mark it `playable: true` in `shared/cities.ts`.
2. Add its districts (real coordinates, road names, bearing) to `DISTRICTS` in `shared/world.ts` with `city: "<id>"`.
3. Add places, jobs, rentals, plots and businesses in that city's districts.
4. Intercity travel (`INTERCITY_MODES`) opens automatically for playable cities once wired into the travel action.

## Football data

Development uses a fictional mock league. To use a licensed provider, set `MATCH_API_URL` and `MATCH_API_KEY` (server-side only). The feed must return fixtures in the `Fixture` shape in `shared/football.ts`; anything invalid pauses betting and settlement.

## Attribution

sql.js (MIT) powers the offline demo. All art, textures, dialogue and characters are original. Real place names are used for public landmarks only; businesses are fictional.
