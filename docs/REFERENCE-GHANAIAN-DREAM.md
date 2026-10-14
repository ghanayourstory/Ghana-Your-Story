# Ghanaian Dream reference pass for Ghana: Your Story

This note records a read-only playthrough of the Ghanaian Dream browser game and maps the observed patterns to Ghana: Your Story. It is a design reference, not a request to reproduce the other game's names, art, writing, or exact economy.

## Reference flows observed

### The home screen and daily loop

- The world HUD keeps the clock, date, cash, needs, social standing, monthly income, online presence and ranking visible while the 3D scene remains playable.
- A “Today” panel collects urgent opportunities and next steps. It can surface a time-limited property auction with a countdown, followed by goal cards such as buying a building or opening a business.
- A separate hustle screen offers a small number of quick jobs per game day. One example is a buy-carry-sell flip that asks the player to move goods across town.
- News doubles as a contextual tutorial and activity feed: new features, local happenings, property income, tenants, auction results, reminders and suggested next actions appear together.

### Work and money

- The work list shows jobs available in the current city, distance, pay, shift, certificate or degree requirements, interview status and whether the employer is hiring immediately.
- The money screen groups cash, bank, treasury bills, dollars, loans and net worth, with shortcuts for transfers, deposits, withdrawals, banking and a player market.
- Financial health is explained as separate factors such as cash cushion, debt, income versus costs and local standing. A monthly statement groups rent, business takings, wages, upkeep and household costs.
- Susu is represented as a local rotating savings group with a named organizer, not just another generic account type.

### Property, businesses and ownership

- Property browsing separates homes, cars and land. Listings show neighbourhood, price and remaining supply; luxury homes offer a virtual tour and a way to visit before deciding.
- The observed virtual tour walks through named rooms, shows the room counter and property price, and lets the player end the tour or enter the property.
- The ownership board groups assets into neighbourhood sets and business categories. Owning more of a set increases rent; completing a district set grants a local title and a stronger rent bonus.
- Player-market cards show an asset's name, street or neighbourhood, approximate monthly income, trading condition and asking price. Listings are separated into for-sale, owned and state-owned views.
- Existing assets have a readable management view: rental occupancy and lease duration, monthly rent, and vehicles with value, use, trade-in and sale actions.

### People, travel and daily needs

- People is split into chats, groups and discovery. Discovery combines who is nearby, username search, current location, contacts with call/message actions, mutual-friend suggestions and a home-entry preference.
- Group chat, party invitations, visits, calling someone out and visiting homes turn the city into a social activity layer.
- The city map has category filters for food, nightlife, beaches, offices and money, health and school, shopping, fuel, transport, and player-owned locations. Search and “show where I am” are prominent.
- Ride starts with destination categories such as home/work, food, worship, beach, health, bank, offices, football, travel and school/gym.
- Food lists Ghanaian dishes with named venues, distance, food price, delivery charge and delivery time. A tip explains the price/time trade-off between delivery and going there.
- Football shows match times, live status and the player's pending/settled picks in one place. The app explicitly labels the currency as game cash and says it has no real-money payout.

## Adaptation for Ghana: Your Story

The project already has many matching foundations: needs, daily goals, work and courses, businesses, land and construction, furnishing, homes, cars, family, relationships, food, transport, football, regional towns, festivals and Ghana-specific routines. Keep these systems and deepen them with these reference patterns:

1. **One readable Today hub:** combine urgent event/auction cards, a short set of state-aware goals, a real reward preview and a direct route to the activity. Generate suggestions from actual player state so a player is never told to buy something they already own.
2. **Preview before commitment:** add guided, room-by-room home tours for rentals and houses. Show Ghana-appropriate layouts and finishes by town and income level; let players inspect without spending money or moving their character.
3. **Progress beyond wealth:** use several milestone tracks—home/property, work/business, family/community, travel/regions and personal wellbeing. Award regional recognition for community contribution, not only asset count.
4. **Local ownership and opportunity feed:** surface tenants, lease renewals, building stages, market-day changes, land offers and public works in one chronologically readable feed. Keep prices, legal/customary steps and neighborhood supply specific to the locality.
5. **Social discovery with consent:** when the hosted multiplayer layer is ready, use nearby players, contacts, groups, parties and visits. Keep precise location optional and give clear controls for who can visit a home or see a player's status.
6. **Everyday route choices:** preserve the map categories and trip estimates, but make trotro, taxi, walking, ride-hail, intercity coach and domestic flights change cost, time, luggage and availability across regions.
7. **Keep every financial activity in-game and legible:** display the cash source, account, fee, timing and resulting balance before a commitment. Susu, MoMo, ECG/prepaid units and bank products should follow Ghanaian context and local review.

The project currently runs its save in one browser on the playable link. Real-player chat, visits, public leaderboards and player-to-player asset sales need the hosted account/save layer before they can be safely made persistent.

## Graphics direction

The reference's virtual-home tour is a useful interaction pattern, but its observed room geometry and furniture are simple, blocky and sparse. Ghana: Your Story should use the tour concept while raising the visual bar.

The project already has a substantial Three.js base: dynamic Ghana-latitude daylight, weather, rain, shadows, fog, road and facade textures, town-specific layouts, interiors, furnishing, character animation and licensed vehicle models. Its documented art gap is chiefly the procedural look and limited asset fidelity, especially buildings, street props and locally specific vehicles—not a missing 3D renderer.

Prioritize visual work in this order:

1. **Build an art bible and asset kit:** define material, scale, silhouette and color rules for Accra, the forest belt, the coast and the savanna. Improve storefronts, compound houses, courtyards, kiosks, markets, lorry stations and public buildings with more specific facades, roofs, gates, signs and clutter.
2. **Improve the close-up life:** add more natural face/hair detail, region- and occasion-appropriate clothing, better hand/face animation, and richer indoor furniture materials. Let weddings, funerals, markets, work and festivals change what people wear and what appears in the scene.
3. **Improve street composition:** vary sidewalks, drains, utility poles and ECG wires, roadside vendors, parked vehicles, shade trees, market sheds and traffic. Use instancing and distance levels so denser scenes remain practical on phones.
4. **Make interiors worth touring:** improve material response, contact shadows, window light and room dressing; use Ghanaian housing plans rather than repeating one luxury-house template. Tours should be smooth, labeled and skippable.
5. **Keep graphics tiers intentional:** high should add richer shadows, post-processing and detail; medium should preserve clear silhouettes and key Ghanaian props; low should reduce crowd/prop density and resolution without removing core scene identity.

Do not aim for generic photorealism. The distinct visual signature should come from believable Ghanaian places, materials, people and everyday activity, with better shape and light quality than the reference.
