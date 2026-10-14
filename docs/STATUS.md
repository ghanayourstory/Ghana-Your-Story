# Ghana: Your Story: where the build stands against the foundation brief

Last checked: game build v22; rebuild pass updated 2026-10-14. This is the Stage 0 "discovery" note from the foundation brief, kept up to date as we go.

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
| Character creator and starter household | ✅ hometown, languages and priorities, and a family there |
| Interactive home and nearby street | ✅ dollhouse home, Kaneshie street |
| Neighbourhood map with a real transport route | ✅ trotro, taxi, ride app; rides drive you there |
| One job and one self-employed hustle | ✅ jobs; ✅ market trading: buy stock, carry it, sell it, with spoilage, demand and rush hours |
| Food routine and a social/family interaction | ✅ food; ✅ family: call, send MoMo, visit; they ask for help and send parcels |
| Needs, skills, a daily goal | ✅ |
| Cash, bank/mobile wallet and a ledger | ✅ cash, MoMo wallet and bank, all in the ledger |
| Starter property with an upgrade/construction stage | ✅ |
| Server-backed save, relogin, second device | ❌ **on the playable link saves live in one browser.** The server exists and is tested, but it isn't hosted. |
| Every action answers what/where/how long/cost/what changes | ✅ big decisions show time, cost, what changes and whether it can be undone before you confirm |
| Help, settings, accessibility | ✅ graphics, sound, needs speed, interface size, reduced motion, sound captions |

## Biggest risks

1. **Cross-device saves.** Needs the server hosted with a real database and accounts. This is the one gap that can't be closed inside the playable link.
2. **Authenticity review.** Place names, food, language and housing come from research, not from reviewers in each region. The brief asks for paid, credited local reviewers before shipping.
3. **Art quality.** Buildings and props are procedural. Real car models are CC BY; real trotro, okada and building models need asset sources (blocked network hosts) or commissioned art.
4. **Performance on low-end phones.** High quality (ambient occlusion, bloom) is desktop-only; medium and low need regular testing on a mid-range Android.

## Stage 2 progress ("make the city feel inhabited")

- ✅ Dumsor: a deterministic load-shedding timetable by area; outages darken streets and homes, block screens without a generator, and add a mood.
- ✅ Practical driving/riding test driven in 3D; server checks place, course stage, one attempt a day and plausible results. *Known limit:* the fault count comes from the player's browser, so a determined cheat could fake a pass; fine for a single-player demo, to be hardened before multiplayer (e.g. server replay of the route).
- ✅ Nine new jobs across trades, care, night work and licence-gated gig work.
- ✅ Gig shifts you drive: ride-app and delivery pick-ups and drop-offs, paid per trip less fuel, one shift a day, checked by the server (trip count comes from the browser; same caveat as the road test).
- ✅ Illness and the clinic: malaria (rainy seasons, a net helps), flu (Harmattan) and stomach trouble (low hygiene); clinic and pharmacy treatments; mild, explained, and off when needs are off.
- ✅ Dumsor at junctions: lights go dark and a traffic warden directs cars.
- ✅ Weekly rhythm: two market days per market (cheaper stock, double demand), Sunday service at every church, Saturday funerals and weddings you attend with a donation or gift (canopies, chairs and guests in 3D).
- ✅ Prepaid electricity units: drawn down daily by what you own, solar cuts the draw, empty meter darkens the home and blocks screens until you top up in SikaBank. Water, refuse and data stay a monthly bill.
- ✅ Named people commute: they walk in from the trotro stop, between places, and off home as their schedule changes.
- ✅ Foundation across all 20 playable towns (checked by a test): church and mosque, everyday jobs with shifts that fit opening hours, licence lessons, at least two named people with routines, Saturday events. Funeral and wedding customs, venues and dress vary by region.
- ✅ Languages and priorities: chosen at the start, changeable in Settings; shared language speeds friendship, priorities weight moodlets and daily goals (never a penalty).
- ✅ Family routines: school, work and worship by region; chores at the family house with regional cooking; only whoever is home appears outside.
- ✅ Festivals where you are and at home on the Today card; street residents who commute in the morning and come home at night, in every town.
- ⏳ Water as its own bill line if it adds play; learning languages in play.

## Stage 3 progress ("deepen life systems")

Acceptance from the brief: each system has a useful start-to-finish path, meaningful costs, feedback and persistent state.

| System | Path today |
|---|---|
| Education & careers | ✅ courses → certificates/licences → gated jobs → ranks and promotion |
| Business operations & staff | ✅ trade → buy → hire attendants/manager → wages → upgrade → sell |
| Property, construction, rentals | ✅ rent → buy land → staged build → live in or rent out → upgrade |
| Furnishing | ✅ shops → items → comfort, mood and home activities |
| Transport ownership | ✅ licence → buy → wear, service, insurance, police checks → work-and-pay or gig work → sell |
| Family & relationships | ✅ family routines, calls, help, visits, chores; friends, dates, partners; proposal → knocking → customary marriage or nikah in the partner's hometown → shared household (spouse pays half, at home inside and out); children by birth or adoption, the naming, school, time together, monthly costs. ⏳ children growing into adults with their own lives |
| Story missions | ✅ eight arcs checked by the server against real state, paid once |
| Events | ✅ life events, Saturday funerals/weddings, festivals |

## Stage 4 progress ("connect the regions")

Acceptance from the brief: intercity movement changes available work, contacts, costs, routines, places and stories, not just the background.

| Changes when you move | Today |
|---|---|
| Work | ✅ local jobs in every town (and regional ones: oil, harbour, cocoa, shea, tourism); jobs lapse after a week away |
| Trade | ✅ regional produce bought at the source, priced by road distance, luggage on buses, spoilage on the way |
| Contacts | ✅ townspeople and regional characters; phone calls keep friendships alive across distance |
| Costs | ✅ prices, rents and wages follow each town's cost of living |
| Routines | ✅ market days, worship days and customs, dumsor groups, festivals by town |
| Places | ✅ 20 playable towns, day trips to real sites |
| Stories | ✅ six regional arcs; marriage happens in the partner's hometown |
| Rural spokes | ✅ five villages around hubs (Bonwire, Nyankpala, Elmina, Paga, Wli) with their own work and rooms |
| ⏳ | more towns per region; regional content packs reviewed by people from each region |

## Stage 5 progress ("community, competition and civic play")

The brief's acceptance is about human players: disconnect recovery, privacy, server-settled rewards. **Anything involving other real players needs the hosted server**, so it isn't built yet. Solo pieces that are:

| Item | State |
|---|---|
| Minigames | ✅ oware (Abapa rules), played and validated on the server, opponent strength grows with your wins |
| Parties and visits | ✅ host a party for people you know (NPCs); ❌ other players visiting needs hosting |
| Civic play | ✅ monthly communal clean-up; ⏳ further civic features need local review first, as the brief says |
| Collectibles | ✅ regions, sites, festivals, dishes (Ghana app), oware record |
| Life score / replay | ✅ eight-part life score and milestones |
| Player markets, leaderboards, multiplayer | ❌ need hosting, accounts, moderation and anti-cheat |

## Stage 6 progress ("commercial readiness")

| Item | State |
|---|---|
| Save migration | ✅ additive schema migrations on load, tested with every new column |
| Backups / moving device | ✅ download and restore a save file (offline play); ❌ real accounts and recovery need hosting |
| Onboarding, help, settings, accessibility | ✅ intro, update notes, needs pace, interface size, reduced motion, captions |
| Performance | ✅ quality levels; ⏳ needs testing on a mid-range Android |
| Localization | ❌ English only; Twi/Ewe/Ga/Dagbani UI needs translators |
| Telemetry, moderation, support, release process | ❌ need hosting and a team |
| Monetization review | ❌ not started; the brief rules out pay-to-win and coercive paywalls |

## Full rebuild pass (in progress)

This is an end-to-end rebuild of the player-facing game: its live world, character movement, interface and everyday play loop. The existing action engine and save/ledger contract remain the persistence boundary so a rebuilt client does not erase players' homes, progress or balances.

- ✅ New persistent in-world frame with location, clock, wallet, needs, mood, monthly cash flow, net worth, standing and urgent life alerts.
- ✅ Daily goals open their relevant activity instead of sending every goal back to the same Today sheet; the Phone & apps hub keeps access to the full set of game systems.
- ✅ Movement now accelerates and turns with easing; the motion-captured gait is synced to ground speed, sideways recording-room drift is removed, and stance-phase foot locking with two-bone IK keeps skinned characters' ankles planted while their bodies travel. Low-graphics characters use a smoother speed-coupled stride, NPCs turn through corners, and walking adds quiet surface-aware footfalls.
- ✅ High graphics adds adaptive, high-quality ambient occlusion; the pass turns off when measured frame time is poor and disposes cleanly when graphics quality changes.
- ⏳ The 3D world, character animation and core day-to-day play loop still need a full art and interaction pass. TypeScript and the offline demo build pass for this slice; gait needs a visual pass in the game, and no cross-device save or mobile performance claim is made here.

## Next slices, in order

1. Host the server (accounts, Postgres or SQLite with backups) so one character works on phone and laptop. *(Deferred by the owner.)*
2. Regional refinement pass, one region at a time: hand-written characters to replace the generated townsfolk, local reviewers for names, language and customs.
3. Festival days as 3D events (durbars, processions) like the Saturday funerals.
4. Learn a language through lessons or time spent in a town.
