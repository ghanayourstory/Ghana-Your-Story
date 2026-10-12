# Ghana: Your Story: where the build stands against the foundation brief

Last checked: game build v11. This is the Stage 0 "discovery" note from the foundation brief, kept up to date as we go.

## What exists today

**Stack.** Browser game: Vite + React 18 + TypeScript, 3D with three.js. A Node 22 server (`server/`) with SQLite is the authoritative engine: every action is validated there, runs in one database transaction with an idempotency key, and money only moves through a double-entry ledger that is audited in tests. The playable link runs the *same* engine inside the browser (sql.js, saved in IndexedDB) so it works without hosting.

**State model.** One player row (needs, skills, home, job, clock, daily goals, settings) plus tables for accounts and ledger, relationships, dates, plots, buildings, businesses, vehicles, farms, courses, items and the action log. The client never decides balances, ownership, construction or results; it renders the state the engine returns.

**World.** All 16 regions, 86 towns at real coordinates, real highway corridors; 20 playable towns with streets, places, opening hours, NPCs with routines, traffic, hawkers, weather, day/night and a soundscape.

**Life systems in place.**
- Character creator.
- Six needs plus mood, moodlets and a needs-speed setting.
- Skills, jobs with shifts and promotion, courses, farms, businesses, land and construction stages, rentals.
- A walk-in Sims-style home with poses and activities, furnishing, vehicles you can drive, rides that drive you, intercity travel.
- Bank, mobile-money fees, dollars, T-bills, loans and a full statement.
- Relationships, dates, Vibes social app, football, life events.
- Today's hustle: three daily goals with swap, rewards and a streak.

## Stage 1 checklist ("one excellent day in one neighbourhood")

| Item | State |
|---|---|
| Character creator and starter household | ✅ hometown choice and a family there (no language / priorities choice yet) |
| Interactive home and nearby street | ✅ dollhouse home, Kaneshie street |
| Neighbourhood map with a real transport route | ✅ trotro, taxi, ride app; rides drive you there |
| One job and one self-employed hustle | ✅ jobs; ✅ market trading: buy stock, carry it, sell it, with spoilage, demand and rush hours |
| Food routine and a social/family interaction | ✅ food; ✅ family: call, send MoMo, visit; they ask for help and send parcels |
| Needs, skills, a daily goal | ✅ |
| Cash, bank/mobile wallet and a ledger | ✅ cash, MoMo wallet and bank, all in the ledger |
| Starter property with an upgrade/construction stage | ✅ |
| Server-backed save, relogin, second device | ❌ **on the playable link saves live in one browser.** The server exists and is tested, but it isn't hosted. |
| Every action answers what/where/how long/cost/what changes | ⚠️ most actions show cost and time; not all show "what changes / can I undo" |
| Help, settings, accessibility | ✅ graphics, sound, needs speed, interface size, reduced motion; ⚠️ no captions yet |

## Biggest risks

1. **Cross-device saves.** Needs the server hosted with a real database and accounts. This is the one gap that can't be closed inside the playable link.
2. **Authenticity review.** Place names, food, language and housing come from research, not from reviewers in each region. The brief asks for paid, credited local reviewers before shipping.
3. **Art quality.** Buildings and props are procedural. Real car models are CC BY; real trotro, okada and building models need asset sources (blocked network hosts) or commissioned art.
4. **Performance on low-end phones.** High quality (ambient occlusion, bloom) is desktop-only; medium and low need regular testing on a mid-range Android.

## Next slices, in order

1. Host the server (accounts, Postgres or SQLite with backups) so one character works on phone and laptop. *(Deferred by the owner: "we will handle hosting later".)*
2. "What changes / can I undo" on every confirm button.
3. Family members you can meet in the 3D world when you visit, not only through the phone.
4. Traffic that reacts to your car: braking, honking, police stops for driving without a licence.
5. Captions for important sounds; colour-safe need bars.
