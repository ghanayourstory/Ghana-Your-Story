// Work-and-pay vehicles: the route a driver works and the fare level. Route
// names describe common directions people travel; demand and fares are game
// simulation, not real figures or schedules.

export interface FleetRoute { id: string; name: string; city: string; vehicles: string[]; demand: number; note: string }
export const FLEET_ROUTES: FleetRoute[] = [
  { id: "acc_kaneshie_market", name: "Kaneshie Market loops", city: "accra", vehicles: ["pragya", "aboboyaa"], demand: 0.85, note: "Short hops between the market, the station and the side streets." },
  { id: "acc_market_haulage", name: "Market haulage (cargo)", city: "accra", vehicles: ["aboboyaa"], demand: 0.8, note: "Yams, cement and furniture from the market to homes." },
  { id: "acc_osu_airport", name: "Osu – Airport City", city: "accra", vehicles: ["taxi"], demand: 0.75, note: "Hotels, offices and the airport; fewer fares at night." },
  { id: "acc_spintex", name: "Spintex Road drops", city: "accra", vehicles: ["taxi", "pragya"], demand: 0.7, note: "Long road, long jams, steady demand." },
  { id: "acc_nima", name: "Nima neighbourhood runs", city: "accra", vehicles: ["pragya"], demand: 0.8, note: "Dense, busy, short trips." },
  { id: "ksi_kejetia", name: "Kejetia – Adum loop", city: "kumasi", vehicles: ["taxi", "pragya", "aboboyaa"], demand: 0.85, note: "The busiest square mile in the north of the forest belt." },
  { id: "tml_central", name: "Tamale Central runs", city: "tamale", vehicles: ["pragya", "taxi", "aboboyaa"], demand: 0.75, note: "Motorbikes compete hard here." },
];
export const FARE_LEVELS: Record<number, { label: string; note: string }> = {
  [-1]: { label: "Lower fare", note: "About 18% more passengers, 15% less per passenger" },
  0: { label: "Standard fare", note: "Usual occupancy" },
  1: { label: "Higher fare", note: "About 18% fewer passengers, 15% more per passenger" },
};
