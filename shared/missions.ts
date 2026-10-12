// Story arcs: longer goals that walk you through each life system from start
// to finish. Steps can be done in any order; the next unfinished one is shown
// as the hint. Progress is checked by the server against your real state, so
// it can't be skipped or faked, and every arc pays out once when it's done.
// None of them is required, and none is about faith or money alone.

export interface MissionStep {
  id: string;
  label: string;
  hint: string;
}
export interface MissionArc {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  steps: MissionStep[];
  /** Fictional GH₵ paid when every step is done. */
  reward: number;
  reputation: number;
}

const S = (id: string, label: string, hint: string): MissionStep => ({ id, label, hint });

export const MISSIONS: MissionArc[] = [
  {
    id: "new_in_town", icon: "🧳", title: "New in the city", reward: 300, reputation: 3,
    blurb: "A bag, a phone and a dream. Find your feet.",
    steps: [
      S("has_job", "Get a job", "Doors that say 'hiring' have work. Loaders and trotro mates need no experience."),
      S("shifts_3", "Work three shifts", "Turn up at your workplace during shift hours."),
      S("momo_used", "Put money in MoMo or the bank", "At a bank, a MoMo agent, or SikaBank on your phone."),
      S("talked_3", "Get to know three people", "Walk up to anyone with a name tag and talk."),
    ],
  },
  {
    id: "home_ties", icon: "🏡", title: "Home ties", reward: 200, reputation: 2,
    blurb: "Accra is busy, but home is home.",
    steps: [
      S("family_called", "Call home", "Phone → Family."),
      S("went_home", "Visit the family house", "Travel to your hometown and visit whoever is in."),
      S("chore", "Help out at home", "Fetch water, sweep or help cook at the family house."),
      S("helped_family", "Help when someone asks", "When a relative asks for help with something, send what you can on MoMo."),
    ],
  },
  {
    id: "wheels", icon: "🚗", title: "Wheels", reward: 500, reputation: 2,
    blurb: "From trotro passenger to driver.",
    steps: [
      S("enrolled_licence", "Enrol for a licence", "Driving (B) or riding (A) lessons at a college or the lorry station."),
      S("licence", "Pass the road test", "Finish your lessons, then drive the examiner's route."),
      S("own_vehicle", "Own a car or motorbike", "Dealers sell new and used; motorbikes are cheapest."),
      S("serviced", "Keep it legal and running", "Service it at the fitters by a station, or renew its insurance."),
    ],
  },
  {
    id: "hustle", icon: "🏪", title: "From hustle to business", reward: 1_000, reputation: 4,
    blurb: "Start with a head pan, end with staff.",
    steps: [
      S("traded", "Make a sale from market stock", "Buy stock at a market, sell it at a station or market."),
      S("own_business", "Own a business", "Kiosks, chop bars, barbershops: see the business listings in each town."),
      S("hired", "Hire someone", "Interview an attendant or a manager at your business."),
      S("biz_profit", "Make GH₵1,000 profit", "Across all your businesses, after costs and wages."),
    ],
  },
  {
    id: "roots", icon: "🧱", title: "Roots", reward: 2_000, reputation: 10,
    blurb: "Land, blocks, and a key of your own.",
    steps: [
      S("own_land", "Buy land", "Plots are listed at real-estate offices."),
      S("building_started", "Start building", "Choose a design and pay for the foundation."),
      S("building_done", "Finish the building", "Pay each stage as the workers finish the last."),
      S("moved_in_or_rent", "Move in or rent it out", "From the building's page."),
    ],
  },
  {
    id: "across_ghana", icon: "🇬🇭", title: "Across Ghana", reward: 800, reputation: 5,
    blurb: "Sixteen regions, one country.",
    steps: [
      S("regions_3", "Spend time in three regions", "Buses leave the big lorry stations; flights from Kotoka."),
      S("festival", "Join a festival", "Each town's tour desk knows what's on; check the Today card."),
      S("dishes_3", "Eat three regional dishes", "TZ, akple, Fante kenkey, abenkwan, red red…"),
      S("regional_friend", "Make a friend outside Accra", "Talk to the townspeople until they count you a friend."),
    ],
  },
  {
    id: "community", icon: "🤝", title: "Part of the community", reward: 400, reputation: 6,
    blurb: "People know your name.",
    steps: [
      S("saturday_event", "Go to a funeral or wedding", "Saturdays, all over town. Bring a donation or gift."),
      S("close_friend", "Become close to someone", "Keep talking, keep showing up, help when asked."),
      S("standing_25", "Reach 25 standing", "Good work, generosity and being around all count."),
    ],
  },
  {
    id: "someone_special", icon: "❤️", title: "Someone special", reward: 150, reputation: 2,
    blurb: "If you want it. Entirely optional.",
    steps: [
      S("date", "Go on a date", "Get to know someone well, then ask them out."),
      S("partner", "Become a couple", "Dates, time and honesty."),
    ],
  },
];
MISSIONS.push({
  id: "family_of_your_own", icon: "💍", title: "A family of your own", reward: 500, reputation: 5,
  blurb: "Optional, and only if it's right. Marriage joins two families.",
  steps: [
    S("engaged", "Get engaged", "Once you're a couple and very close, ask in person (People → your partner)."),
    S("knocked", "The knocking", "Go with your family to your partner's family house in their hometown."),
    S("married", "The marriage ceremony", "A few days after the knocking, the families meet again: customary marriage or nikah."),
  ],
});
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export interface MissionState {
  done: string[];
  /** Arcs already paid out. */
  paid: string[];
}
