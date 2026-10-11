// Goals, milestones and life events.

/** A compact snapshot the server builds to evaluate goals. */
export interface ProgressSnapshot {
  shiftsWorked: number;
  hasJob: boolean;
  bankMinor: number;
  netWorthMinor: number;
  tbillsBought: number;
  friends: number; // NPCs at affinity ≥ 40
  closeFriends: number;
  partner: boolean;
  businesses: number;
  plots: number;
  housesBuilt: number;
  vehicles: string[];
  homeDistrict: string;
  ownsHome: boolean;
  reputation: number;
  districtsVisited: number;
  usdMinor: number;
  betsWon: number;
  maxBusinessLevel: number;
  regionsVisited: number;
  sitesVisited: number;
  dishesTasted: number;
  festivals: number;
  followers: number;
  harvests: number;
  certificates: number;
  licensed: boolean;
  furnishingPoints: number;
  ownsMansion: boolean;
  carCount: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  chapter: number;
  check: (s: ProgressSnapshot) => boolean;
  progress?: (s: ProgressSnapshot) => [number, number];
  reward: { cash?: number; reputation?: number };
  achievement?: boolean;
}

const money = (cedi: number) => cedi * 100;

export const GOALS: Goal[] = [
  { id: "first_job", title: "Find work", description: "Get hired anywhere in the city.", chapter: 1, check: (s) => s.hasJob, reward: { reputation: 2 } },
  { id: "first_pay", title: "First pay day", description: "Complete your first shift.", chapter: 1, check: (s) => s.shiftsWorked >= 1, progress: (s) => [Math.min(s.shiftsWorked, 1), 1], reward: { cash: 100 } },
  { id: "explorer", title: "Know your city", description: "Visit four neighbourhoods.", chapter: 1, check: (s) => s.districtsVisited >= 4, progress: (s) => [Math.min(s.districtsVisited, 4), 4], reward: { reputation: 3 } },
  { id: "first_friend", title: "Somebody knows your name", description: "Become friends with someone (affinity 40).", chapter: 1, check: (s) => s.friends >= 1, progress: (s) => [Math.min(s.friends, 1), 1], reward: { reputation: 3 } },
  { id: "savings_5k", title: "Rainy-day fund", description: "Have GH₵5,000 in the bank.", chapter: 2, check: (s) => s.bankMinor >= money(5000), progress: (s) => [Math.min(s.bankMinor, money(5000)), money(5000)], reward: { cash: 250 } },
  { id: "tbill", title: "Boring is beautiful", description: "Buy your first treasury bill.", chapter: 2, check: (s) => s.tbillsBought >= 1, reward: { reputation: 2 } },
  { id: "hustle_20", title: "Steady hands", description: "Work 20 shifts.", chapter: 2, check: (s) => s.shiftsWorked >= 20, progress: (s) => [Math.min(s.shiftsWorked, 20), 20], reward: { cash: 500, reputation: 3 } },
  { id: "first_business", title: "Your own hustle", description: "Buy your first business.", chapter: 3, check: (s) => s.businesses >= 1, reward: { reputation: 5 } },
  { id: "first_plot", title: "Land is life", description: "Buy a plot of land.", chapter: 3, check: (s) => s.plots >= 1, reward: { reputation: 5 } },
  { id: "net_100k", title: "Six figures", description: "Reach GH₵100,000 net worth.", chapter: 3, check: (s) => s.netWorthMinor >= money(100_000), progress: (s) => [Math.max(0, Math.min(s.netWorthMinor, money(100_000))), money(100_000)], reward: { reputation: 5 } },
  { id: "first_house", title: "Your own roof", description: "Finish building a house.", chapter: 4, check: (s) => s.housesBuilt >= 1, reward: { reputation: 10 } },
  { id: "business_lvl3", title: "Growing pains", description: "Upgrade a business to level 3.", chapter: 4, check: (s) => s.maxBusinessLevel >= 3, reward: { reputation: 4 } },
  { id: "love", title: "Somebody special", description: "Start a relationship.", chapter: 4, check: (s) => s.partner, reward: { reputation: 3 } },
  { id: "car", title: "Wheels", description: "Buy a car.", chapter: 4, check: (s) => s.carCount >= 1, reward: { reputation: 3 } },
  { id: "net_1m", title: "Cedi millionaire", description: "Reach GH₵1,000,000 net worth.", chapter: 5, check: (s) => s.netWorthMinor >= money(1_000_000), progress: (s) => [Math.max(0, Math.min(s.netWorthMinor, money(1_000_000))), money(1_000_000)], reward: { reputation: 10 } },
  { id: "the_v8", title: "The V8", description: "Drive the Savanna V8 through the Valley gate.", chapter: 5, check: (s) => s.vehicles.includes("v8"), reward: { reputation: 10 } },
  { id: "the_dream", title: "The Sika City dream", description: "Own a home in Trasacco Valley.", chapter: 5, check: (s) => s.ownsHome && s.homeDistrict === "trasacco", reward: { reputation: 20 } },
  // Life across Ghana
  { id: "travel_3", title: "Beyond Accra", description: "Visit three of Ghana's regions.", chapter: 2, check: (s) => s.regionsVisited >= 3, progress: (s) => [Math.min(s.regionsVisited, 3), 3], reward: { reputation: 3 } },
  { id: "sites_5", title: "See Ghana", description: "Take five day trips: waterfalls, castles, parks.", chapter: 3, check: (s) => s.sitesVisited >= 5, progress: (s) => [Math.min(s.sitesVisited, 5), 5], reward: { cash: 400, reputation: 3 } },
  { id: "dishes_12", title: "Taste of Ghana", description: "Try twelve local dishes and drinks.", chapter: 2, check: (s) => s.dishesTasted >= 12, progress: (s) => [Math.min(s.dishesTasted, 12), 12], reward: { reputation: 3 } },
  { id: "licence", title: "Licensed", description: "Get a driving or riding licence.", chapter: 2, check: (s) => s.licensed, reward: { reputation: 2 } },
  { id: "furnished", title: "Make it home", description: "Furnish your home (12 comfort points).", chapter: 2, check: (s) => s.furnishingPoints >= 12, progress: (s) => [Math.min(s.furnishingPoints, 12), 12], reward: { reputation: 3 } },
  { id: "first_harvest", title: "Back to the land", description: "Bring in your first harvest.", chapter: 3, check: (s) => s.harvests >= 1, reward: { cash: 300, reputation: 3 } },
  { id: "certified", title: "Certified", description: "Complete a course or apprenticeship.", chapter: 2, check: (s) => s.certificates >= 1, reward: { reputation: 3 } },
  { id: "followers_10k", title: "Influencer", description: "Reach 10,000 followers.", chapter: 3, check: (s) => s.followers >= 10_000, progress: (s) => [Math.min(s.followers, 10_000), 10_000], reward: { reputation: 5 } },
  { id: "mansion", title: "Mansion life", description: "Build a mansion.", chapter: 5, check: (s) => s.ownsMansion, reward: { reputation: 15 } },
  // Achievements (hidden-ish extras)
  { id: "ach_all_regions", title: "All sixteen", description: "Visit every region of Ghana.", chapter: 0, achievement: true, check: (s) => s.regionsVisited >= 16, reward: {} },
  { id: "ach_festivals", title: "Festival soul", description: "Attend five different festivals.", chapter: 0, achievement: true, check: (s) => s.festivals >= 5, reward: {} },
  { id: "ach_celebrity", title: "Celebrity", description: "Reach 100,000 followers.", chapter: 0, achievement: true, check: (s) => s.followers >= 100_000, reward: {} },
  { id: "ach_supercar", title: "Ten centimetres of clearance", description: "Own the Vettore Furia.", chapter: 0, achievement: true, check: (s) => s.vehicles.includes("supercar"), reward: {} },
  { id: "ach_dollar", title: "Dollarised", description: "Hold $1,000 in your foreign-currency account.", chapter: 0, achievement: true, check: (s) => s.usdMinor >= 100_000, reward: {} },
  { id: "ach_respected", title: "Respected", description: "Reach 50 community standing.", chapter: 0, achievement: true, check: (s) => s.reputation >= 50, reward: {} },
  { id: "ach_tipster", title: "Ebo would be proud", description: "Win 3 football predictions.", chapter: 0, achievement: true, check: (s) => s.betsWon >= 3, reward: {} },
  { id: "ach_beloved", title: "Beloved", description: "Have three close friends.", chapter: 0, achievement: true, check: (s) => s.closeFriends >= 3, reward: {} },
];

export const GOAL_BY_ID: Record<string, Goal> = Object.fromEntries(GOALS.map((g) => [g.id, g]));

// ---------------------------------------------------------------------------
// Life events. Rolled once per game day by the server.

export interface EventChoice {
  id: string;
  label: string;
  cost?: number; // cedis
  effects: Partial<Record<"energy" | "hunger" | "health" | "social" | "reputation", number>>;
  result: string;
}

export interface LifeEvent {
  id: string;
  title: string;
  text: string;
  weight: number;
  minDay?: number;
  choices?: EventChoice[];
  /** Applied immediately for events without choices. */
  auto?: { effects: EventChoice["effects"]; cash?: number; businessMultiplier?: number };
}

export const LIFE_EVENTS: LifeEvent[] = [
  { id: "dumsor", title: "Dumsor", text: "The lights went off across the city for most of the day. Businesses earned less today.", weight: 3, auto: { effects: { social: -2 }, businessMultiplier: 0.7 } },
  {
    id: "cousin_fees", title: "A call from your cousin", text: "Your cousin Kojo needs GH₵300 for school fees. Your auntie is on the line too.", weight: 2, minDay: 2,
    choices: [
      { id: "pay", label: "Send GH₵300", cost: 300, effects: { social: 8, reputation: 3 }, result: "Kojo sends a voice note thanking you. Your auntie tells everybody you're doing well." },
      { id: "half", label: "Send GH₵100", cost: 100, effects: { social: 3, reputation: 1 }, result: "\"Small small,\" says your auntie. It helps." },
      { id: "decline", label: "Not this time", effects: { social: -6, reputation: -2 }, result: "The family WhatsApp goes quiet. Awkward." },
    ],
  },
  {
    id: "malaria", title: "Fever and chills", text: "You've been shivering all night. It feels like malaria.", weight: 1.5, minDay: 3,
    choices: [
      { id: "clinic", label: "Go to the clinic (GH₵180)", cost: 180, effects: { health: 10, energy: -10 }, result: "Dr. Adjei confirms it early. Treatment starts today." },
      { id: "herbs", label: "Try herbs and rest", effects: { health: -18, energy: -25 }, result: "You sweat it out. It's a rough couple of days." },
    ],
  },
  {
    id: "funeral", title: "A funeral in the family", text: "Your father's cousin has passed. The funeral is on Saturday, and everyone is contributing.", weight: 1.2, minDay: 5,
    choices: [
      { id: "attend", label: "Attend and contribute GH₵250", cost: 250, effects: { social: 10, reputation: 5, energy: -15 }, result: "Red and black cloth, brass bands and family you haven't seen in years." },
      { id: "send", label: "Send GH₵120", cost: 120, effects: { reputation: 1 }, result: "Your contribution is announced over the speakers." },
      { id: "skip", label: "Skip it", effects: { reputation: -5, social: -5 }, result: "People noticed." },
    ],
  },
  { id: "street_win", title: "Lucky find", text: "A trader pressed a GH₵50 note into your hand: \"You helped my daughter with her bags last week!\"", weight: 1, auto: { effects: { social: 4 }, cash: 50 } },
  { id: "flood", title: "Flash flood", text: "Heavy rain flooded the gutters. Trotros are crawling and outdoor businesses suffered.", weight: 1.2, auto: { effects: { energy: -5 }, businessMultiplier: 0.8 } },
  {
    id: "wedding", title: "Wedding invitation", text: "Your old classmate is getting married this weekend. Aso-ebi is GH₵400.", weight: 1, minDay: 4,
    choices: [
      { id: "go", label: "Buy the aso-ebi and go", cost: 400, effects: { social: 18, reputation: 3, energy: -10 }, result: "You dance until your shoes give up." },
      { id: "gift", label: "Send a gift (GH₵100)", cost: 100, effects: { social: 4 }, result: "They send a photo of the cake. Lovely." },
      { id: "no", label: "Decline politely", effects: { social: -3 }, result: "Maybe the next one." },
    ],
  },
  { id: "festival", title: "Festival weekend", text: "Drums and processions fill the streets. Everyone is in a good mood.", weight: 0.8, auto: { effects: { social: 8 }, businessMultiplier: 1.2 } },
  { id: "pickpocket", title: "Pickpocket!", text: "Somebody lifted GH₵60 from your pocket in the crowd.", weight: 0.8, minDay: 3, auto: { effects: { social: -4 }, cash: -60 } },
];
