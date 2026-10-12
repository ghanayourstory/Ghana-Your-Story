# Ghana: Your Story

A 3D life simulator set in real Ghana. Build a life from a rented room in Kaneshie to a mansion in Trasacco Valley, a cocoa farm in Sefwi or a guesthouse in Kintampo.

## What's in it

- **All 16 regions.** 86 towns at real coordinates, joined by the real highway corridors (N1, N6, N8, N10, N12, the Eastern Corridor…). Shortest-route intercity travel by bus, VIP coach, domestic flight (between real airports) or your own car.
- **Playable towns.** Accra (Osu, Labadi, Kaneshie, Spintex, East Legon, Trasacco, Nima, Jamestown) plus Kumasi (Adum & Kejetia), Tamale, Kintampo, Techiman, Sunyani, Wa, Bole, Sawla, Damongo, Bolgatanga, Nalerigu, Cape Coast, Sekondi-Takoradi, Ho, Koforidua, Sefwi Wiawso, Goaso and Dambai. Each has its own markets, chop bars, mosques and churches, lodges, clinics, schools and lorry station.
- **Day trips.** 45 real excursion sites, including Kintampo and Fuller falls, Bui Dam, Mole, Larabanga, Paga, Wli, Kakum, the castles, Lake Bosomtwe, Nzulezu and Wechiau.
- **Festivals and food.** Festivals in their real months, for example Homowo, Fetu Afahye, Damba, Bugum, Hogbetsotso and Kundum, plus Akwasidae on its 42-day cycle. Regional dishes include TZ, wasawasa, akple, abunuabunu, Fante and Ga kenkey, akyeke and pito.
- **Everyday life.**
  - Shopping: Melcom, Accra Mall, phone shops, carpenters' rows and furniture showrooms, and craft markets selling kente, smocks, Bolga baskets and beads.
  - Your home: furnish it (furniture appears in your 3D room and improves sleep). Dumsor nights hurt unless you have a generator or solar. Cook at home.
  - Bills: ECG bills grow with your appliances.
- **Getting around.** Bicycles, motorbikes, pragya and aboboyaa tricycles, taxis, sedans, pickups, SUVs and supercars. You need a licence from a driving school to drive. Commercial vehicles can go out on "work-and-pay".
- **Making a living.**
  - Farms with regional crops and seasons, where rain matters.
  - Courses and apprenticeships, from Suame Magazine mechanics to an MBA.
  - Vibes, a social media app: followers turn into brand deals.
  - Regional jobs and businesses, plus land and houses in every town, from a northern compound to a mansion.

## Run it

```bash
npm install
npm run dev        # game server on :8787 + Vite client on :5173 (dev tools on for test accounts)
npm test           # server tests: money, purchases, construction, betting, persistence, travel, farms, schools, shops
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

## Adding a town

1. Make sure the town is in `TOWNS` in `shared/ghana.ts` (real coordinates and region), and that a `ROAD_CORRIDORS` entry reaches it.
2. Add a `TownSpec` in `shared/regional.ts` (main and cross roads, style, palette, places). Places are laid out along the street automatically, and a realtor (and a phone shop in big towns) is added.
3. Optionally add rentals, plots and businesses (`shared/economy.ts`), farmland (`shared/life.ts`), jobs (`REGIONAL_JOBS`), excursion sites (`SITES`) and festivals (`FESTIVALS`).
4. Intercity travel, the map and the city listing pick it up automatically.

## Football data

Development uses a fictional mock league. To use a licensed provider, set `MATCH_API_URL` and `MATCH_API_KEY` (server-side only). The feed must return fixtures in the `Fixture` shape in `shared/football.ts`; anything invalid pauses betting and settlement.

## Attribution

sql.js (MIT) powers the offline demo. Region boundaries: geoBoundaries gbOpen (Runfola et al. 2020), derived from OpenStreetMap, CC BY-SA 2.0. Vehicle and phone names in the game are fictional. Real car models: see `public/vehicles/CREDITS.md` (CC BY 4.0, Sketchfab authors credited; optimised by the AsciiCity project). All art, textures, dialogue and characters are original. Real place names are used for public landmarks only; businesses are fictional.
