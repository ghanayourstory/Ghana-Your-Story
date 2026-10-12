// Life beyond Accra. Every regional capital plus the towns players asked for
// (Kintampo, Techiman, Bole, Sawla) is a playable street scene with its own
// food, trade, worship, lodging and day trips. Excursion sites and festivals
// are real and sit at their real locations; festival months follow the
// traditional calendar (Islamic festivals drift a little each year).
import type { District, DistrictStyle, Effects, Job, Place, PlaceKind, Service } from "./world.ts";
import type { RegionId } from "./ghana.ts";

// ---------------------------------------------------------------------------
// Food and drink from every corner of the country.

const S = (s: Service) => s;

export const REGIONAL_SERVICES: Record<string, Service> = {
  // North
  tz: S({ id: "tz", name: "Tuo zaafi (TZ) with ayoyo soup", verb: "Eat TZ", cost: 15, minutes: 35, effects: { hunger: 60, energy: 4, social: 3 }, hours: [11, 22], note: "Millet or maize TZ, green ayoyo and dawadawa." }),
  wasawasa: S({ id: "wasawasa", name: "Wasawasa with shito & fried fish", verb: "Eat wasawasa", cost: 12, minutes: 25, effects: { hunger: 45, energy: 4, social: 3 }, hours: [7, 20], note: "Yam-flour crumbs from the Upper West, steamed and spiced." }),
  koko_koose: S({ id: "koko_koose", name: "Hausa koko, koose & bofrot", verb: "Have koko", cost: 8, minutes: 15, effects: { hunger: 25, energy: 6, social: 2 }, hours: [5, 11] }),
  tubaani: S({ id: "tubaani", name: "Tubaani with shito & oil", verb: "Eat tubaani", cost: 10, minutes: 20, effects: { hunger: 35, energy: 3 }, hours: [8, 20] }),
  pito: S({ id: "pito", name: "Calabash of pito", verb: "Drink pito", cost: 6, minutes: 45, effects: { social: 10, energy: -3, hunger: 4 }, hours: [12, 23], note: "Fermented millet beer brewed by the women of the north." }),
  brukina: S({ id: "brukina", name: "Brukina (millet & milk)", verb: "Drink brukina", cost: 7, minutes: 10, effects: { hunger: 14, energy: 6 } }),
  chichinga: S({ id: "chichinga", name: "Chichinga (spiced kebab)", verb: "Buy chichinga", cost: 10, minutes: 10, effects: { hunger: 14, social: 3 }, hours: [17, 24] }),
  guinea_fowl: S({ id: "guinea_fowl", name: "Grilled guinea fowl & TZ", verb: "Eat guinea fowl", cost: 60, minutes: 50, effects: { hunger: 65, health: 2, social: 6 }, hours: [12, 22] }),
  // Middle belt and forest
  abenkwan: S({ id: "abenkwan", name: "Fufu & abenkwan (palm nut soup) with goat", verb: "Eat fufu & abenkwan", cost: 50, minutes: 45, effects: { hunger: 70, energy: -4, social: 5 }, hours: [10, 21] }),
  omo_tuo: S({ id: "omo_tuo", name: "Omo tuo & groundnut soup", verb: "Eat omo tuo", cost: 45, minutes: 40, effects: { hunger: 62, social: 5 }, hours: [11, 20], note: "Sunday's rice balls." }),
  ampesi: S({ id: "ampesi", name: "Ampesi with kontomire stew", verb: "Eat ampesi", cost: 30, minutes: 30, effects: { hunger: 50, health: 2 }, hours: [8, 20] }),
  mpotompoto: S({ id: "mpotompoto", name: "Mpotompoto (cocoyam pottage)", verb: "Eat mpotompoto", cost: 25, minutes: 25, effects: { hunger: 45, health: 2 }, hours: [9, 19] }),
  abunuabunu: S({ id: "abunuabunu", name: "Fufu & abunuabunu (kontomire soup)", verb: "Eat abunuabunu", cost: 40, minutes: 45, effects: { hunger: 66, health: 3, energy: -3 }, hours: [10, 21], note: "The Bono favourite: green soup with mushrooms and snails." }),
  kokonte: S({ id: "kokonte", name: "Kokonte & groundnut soup", verb: "Eat kokonte", cost: 25, minutes: 35, effects: { hunger: 58, energy: -2 }, hours: [10, 21] }),
  fried_yam: S({ id: "fried_yam", name: "Fried yam, chofi & pepper", verb: "Buy fried yam", cost: 15, minutes: 15, effects: { hunger: 30, social: 2 }, hours: [15, 24] }),
  roasted_plantain: S({ id: "roasted_plantain", name: "Kofi Brokeman (roast plantain & groundnuts)", verb: "Buy roast plantain", cost: 8, minutes: 10, effects: { hunger: 20 } }),
  red_red: S({ id: "red_red", name: "Red red with fried plantain", verb: "Eat red red", cost: 20, minutes: 25, effects: { hunger: 48, health: 1 }, hours: [9, 20] }),
  palm_wine: S({ id: "palm_wine", name: "Fresh palm wine", verb: "Drink palm wine", cost: 10, minutes: 45, effects: { social: 10, energy: -3 }, hours: [9, 20] }),
  // Coast
  fante_kenkey: S({ id: "fante_kenkey", name: "Fante kenkey, fried fish & pepper", verb: "Eat Fante kenkey", cost: 25, minutes: 25, effects: { hunger: 55, health: 1, social: 3 }, hours: [7, 21] }),
  akyeke: S({ id: "akyeke", name: "Akyeke with avocado & fried fish", verb: "Eat akyeke", cost: 25, minutes: 25, effects: { hunger: 50, health: 2 }, hours: [8, 20], note: "Cassava couscous from the Nzema coast." }),
  // Volta and Oti
  akple: S({ id: "akple", name: "Akple & fetri detsi with crab", verb: "Eat akple", cost: 40, minutes: 40, effects: { hunger: 62, health: 2, social: 4 }, hours: [10, 21] }),
  abolo: S({ id: "abolo", name: "Abolo, one-man-thousand & shito", verb: "Eat abolo", cost: 15, minutes: 20, effects: { hunger: 35, social: 2 }, hours: [8, 21] }),
  lake_fish: S({ id: "lake_fish", name: "Grilled Volta tilapia & banku", verb: "Eat lake tilapia", cost: 55, minutes: 45, effects: { hunger: 60, health: 2, social: 5 }, hours: [11, 22] }),
  // Daily life
  lodge: S({ id: "lodge", name: "Room for the night", verb: "Book a room", cost: 180, minutes: 480, effects: { energy: 64, hunger: -16, health: 4 }, hours: [18, 10], note: "Fan, mosquito net, bucket of hot water on request." }),
  mosque: S({ id: "mosque", name: "Prayers & greetings", verb: "Pray", cost: 0, minutes: 60, effects: { social: 10, reputation: 1 } }),
  jumah: S({ id: "jumah", name: "Jumu'ah (Friday prayers)", verb: "Attend Jumu'ah", cost: 0, minutes: 90, effects: { social: 14, reputation: 2 }, hours: [12, 15], days: [5] }),
  market_haggle: S({ id: "market_haggle", name: "Walk the market", verb: "Browse & haggle", cost: 0, minutes: 60, effects: { social: 8, charisma: 1, energy: -6 } }),
  lorry_chat: S({ id: "lorry_chat", name: "Chat with drivers at the station", verb: "Chat with drivers", cost: 0, minutes: 30, effects: { social: 6 } }),
  smock_fitting: S({ id: "smock_fitting", name: "Get measured for a smock", verb: "Order a smock", cost: 450, minutes: 60, effects: { social: 6, reputation: 3, charisma: 1 }, note: "Hand-woven strips sewn into a batakari." }),
  kente_viewing: S({ id: "kente_viewing", name: "Watch the kente weavers", verb: "Watch the weavers", cost: 20, minutes: 60, effects: { social: 6, charisma: 1 } }),
  libation: S({ id: "libation", name: "Pour libation with the priest", verb: "Pay respects", cost: 15, minutes: 40, effects: { social: 5, reputation: 1 }, note: "A small bottle of schnapps, poured for the ancestors." }),
  street_football: S({ id: "street_football", name: "Gutter-to-gutter football", verb: "Play football", cost: 0, minutes: 75, effects: { fitness: 1, social: 12, energy: -16, hunger: -8 }, hours: [15, 19], note: "Two stones for goalposts, one ball, thirty players." }),
  boxing: S({ id: "boxing", name: "Boxing training", verb: "Train", cost: 20, minutes: 90, effects: { fitness: 2, health: 3, energy: -24, hunger: -12 }, hours: [6, 19], note: "Bukom has produced world champions. The coaches don't let you forget it." }),
  ga_kenkey: S({ id: "ga_kenkey", name: "Ga kenkey, fried fish & shito", verb: "Eat Ga kenkey", cost: 18, minutes: 20, effects: { hunger: 52, social: 3 }, hours: [7, 22] }),
  seamstress: S({ id: "seamstress", name: "Kaba & slit / shirt from the seamstress", verb: "Sew an outfit", cost: 280, minutes: 60, effects: { social: 6, reputation: 2, charisma: 1 } }),
};

// ---------------------------------------------------------------------------
// Excursion sites: real places, reached as day trips from a base town.

export interface Site {
  id: string;
  name: string;
  region: RegionId;
  at: { lat: number; lon: number };
  /** Districts (playable towns) that run day trips here. */
  from: string[];
  fee: number; // entry + transport, base cedis
  minutes: number;
  effects: Effects;
  kind: "waterfall" | "wildlife" | "heritage" | "nature" | "lake" | "beach" | "craft" | "dam" | "spiritual";
  blurb: string;
}

const site = (s: Site) => s;

export const SITES: Site[] = [
  // Bono East / Bono
  site({ id: "kintampo_falls", name: "Kintampo Waterfalls", region: "bono_east", at: { lat: 8.0938, lon: -1.7171 }, from: ["kintampo", "techiman"], fee: 60, minutes: 240, kind: "waterfall", effects: { social: 16, health: 4, energy: -12, fitness: 1 }, blurb: "The Pumpum river drops 70 metres in three steps through the forest. Bring a towel." }),
  site({ id: "fuller_falls", name: "Fuller Falls", region: "bono_east", at: { lat: 7.9978, lon: -1.7936 }, from: ["kintampo"], fee: 50, minutes: 210, kind: "waterfall", effects: { social: 12, health: 3, energy: -10 }, blurb: "The Oyoko river cascades over limestone steps, then vanishes underground." }),
  site({ id: "centre_of_ghana", name: "Geographical Centre of Ghana", region: "bono_east", at: { lat: 7.95, lon: -1.03 }, from: ["kintampo"], fee: 30, minutes: 150, kind: "heritage", effects: { social: 8 }, blurb: "Stand at the very middle of the country. Everyone takes the same photo." }),
  site({ id: "buabeng_fiema", name: "Boabeng-Fiema Monkey Sanctuary", region: "bono_east", at: { lat: 7.92, lon: -1.68 }, from: ["techiman", "kintampo"], fee: 50, minutes: 210, kind: "wildlife", effects: { social: 12, health: 2 }, blurb: "Mona and colobus monkeys, sacred to the villagers, given proper funerals when they die." }),
  site({ id: "tano_grove", name: "Tano Sacred Grove, Tanoboase", region: "bono_east", at: { lat: 7.65, lon: -1.88 }, from: ["techiman"], fee: 40, minutes: 180, kind: "spiritual", effects: { social: 8, health: 2 }, blurb: "Caves and rock shelters where the Bono people hid from raiders, guarded by the river god Tano." }),
  site({ id: "bui_dam", name: "Bui Dam & Bui National Park", region: "bono", at: { lat: 8.2789, lon: -2.2364 }, from: ["sunyani", "bole"], fee: 90, minutes: 300, kind: "dam", effects: { social: 14, energy: -10 }, blurb: "400 MW of hydro on the Black Volta, a boat ride past hippos and the gorge they flooded." }),
  // Savannah / Northern / North East
  site({ id: "mole_park", name: "Mole National Park safari walk", region: "savannah", at: { lat: 9.2617, lon: -1.8481 }, from: ["damongo", "tamale", "sawla"], fee: 150, minutes: 300, kind: "wildlife", effects: { social: 18, health: 3, energy: -14, fitness: 1 }, blurb: "Walk with an armed ranger to the waterhole. The elephants come at noon; the baboons come for your lunch." }),
  site({ id: "larabanga_mosque", name: "Larabanga Mosque", region: "savannah", at: { lat: 9.2205, lon: -1.8614 }, from: ["damongo", "sawla", "tamale"], fee: 40, minutes: 150, kind: "heritage", effects: { social: 10, reputation: 1 }, blurb: "Sudano-Sahelian mud and timber, said to date from the 1400s. Ghana's oldest mosque." }),
  site({ id: "mystic_stone", name: "Larabanga Mystic Stone", region: "savannah", at: { lat: 9.214, lon: -1.856 }, from: ["damongo"], fee: 20, minutes: 90, kind: "spiritual", effects: { social: 6 }, blurb: "Road builders moved it three times. Three times it came back, they say." }),
  site({ id: "bole_mosque", name: "Bole Mud Mosque", region: "savannah", at: { lat: 9.035, lon: -2.485 }, from: ["bole"], fee: 20, minutes: 90, kind: "heritage", effects: { social: 8, reputation: 1 }, blurb: "One of the ancient mud-and-timber mosques of the Gonja kingdom." }),
  site({ id: "black_volta", name: "Black Volta canoe trip, Bamboi", region: "savannah", at: { lat: 8.15, lon: -2.03 }, from: ["bole", "sawla"], fee: 70, minutes: 240, kind: "nature", effects: { social: 12, health: 2, energy: -8 }, blurb: "Paddle the river that marks Ghana's border, past fishermen and kingfishers." }),
  site({ id: "daboya_smock", name: "Daboya smock weavers", region: "savannah", at: { lat: 9.53, lon: -1.38 }, from: ["tamale"], fee: 50, minutes: 240, kind: "craft", effects: { social: 10, charisma: 1 }, blurb: "Watch narrow strips woven on wooden looms, dyed in indigo, sewn into the smocks the whole north wears." }),
  site({ id: "gambaga_escarpment", name: "Gambaga Escarpment", region: "north_east", at: { lat: 10.53, lon: -0.43 }, from: ["nalerigu"], fee: 30, minutes: 180, kind: "nature", effects: { social: 8, health: 3, fitness: 1, energy: -10 }, blurb: "Climb the cliff for a view across the whole White Volta basin." }),
  site({ id: "naa_jaringa_wall", name: "Naa Jaringa Defence Wall", region: "north_east", at: { lat: 10.527, lon: -0.368 }, from: ["nalerigu"], fee: 15, minutes: 60, kind: "heritage", effects: { social: 6 }, blurb: "Built to defend Nalerigu against slave raiders, using stones, mud and (legend says) honey." }),
  // Upper East / Upper West
  site({ id: "paga_crocodiles", name: "Paga Crocodile Pond", region: "upper_east", at: { lat: 10.985, lon: -1.113 }, from: ["bolgatanga"], fee: 50, minutes: 150, kind: "wildlife", effects: { social: 12 }, blurb: "Sit on a sacred crocodile's back while the guide waves a live chicken. Nobody has been bitten. Yet." }),
  site({ id: "pikworo", name: "Pikworo Slave Camp, Paga", region: "upper_east", at: { lat: 10.98, lon: -1.13 }, from: ["bolgatanga"], fee: 40, minutes: 120, kind: "heritage", effects: { social: 6, reputation: 1 }, blurb: "Rock bowls carved for captives' meals and the 'punishment rock'. Hard, necessary history." }),
  site({ id: "sirigu", name: "Sirigu painted houses & pottery", region: "upper_east", at: { lat: 10.843, lon: -0.94 }, from: ["bolgatanga"], fee: 50, minutes: 180, kind: "craft", effects: { social: 10, charisma: 1 }, blurb: "Women paint the walls of their compounds in black, white and red geometry." }),
  site({ id: "tongo_hills", name: "Tongo Hills & Tengzug shrines", region: "upper_east", at: { lat: 10.7, lon: -0.8 }, from: ["bolgatanga"], fee: 60, minutes: 210, kind: "spiritual", effects: { social: 10, health: 2, energy: -10 }, blurb: "Whistling rocks, shrines and Tallensi compounds. Shirts off before you enter the shrine." }),
  site({ id: "wechiau_hippos", name: "Wechiau Hippo Sanctuary", region: "upper_west", at: { lat: 9.83, lon: -2.68 }, from: ["wa"], fee: 80, minutes: 300, kind: "wildlife", effects: { social: 14, health: 2, energy: -10 }, blurb: "A dugout canoe on the Black Volta, a dozen hippos snorting at a respectful distance." }),
  site({ id: "gwollu_wall", name: "Gwollu Slave Defence Wall", region: "upper_west", at: { lat: 10.983, lon: -2.217 }, from: ["wa"], fee: 40, minutes: 240, kind: "heritage", effects: { social: 6 }, blurb: "Walls Koro Limann's ancestors built against Babatu's raiders. President Limann is buried here." }),
  // Ashanti / Ahafo / Western North
  site({ id: "lake_bosomtwe", name: "Lake Bosomtwe", region: "ashanti", at: { lat: 6.5044, lon: -1.4126 }, from: ["adum"], fee: 70, minutes: 270, kind: "lake", effects: { social: 14, health: 3, energy: -8 }, blurb: "A meteorite crater lake. Fishermen paddle planks, not canoes, out of respect for the lake." }),
  site({ id: "bonwire_kente", name: "Bonwire kente village", region: "ashanti", at: { lat: 6.783, lon: -1.453 }, from: ["adum"], fee: 40, minutes: 180, kind: "craft", effects: { social: 10, charisma: 1 }, blurb: "Where kente was born, according to Bonwire. Every pattern has a name and a proverb." }),
  site({ id: "ntonso_adinkra", name: "Ntonso adinkra village", region: "ashanti", at: { lat: 6.86, lon: -1.47 }, from: ["adum"], fee: 35, minutes: 150, kind: "craft", effects: { social: 8, charisma: 1 }, blurb: "Carve a calabash stamp, boil the badie bark dye, print your own Gye Nyame." }),
  site({ id: "bia_park", name: "Bia National Park", region: "western_north", at: { lat: 6.55, lon: -3.08 }, from: ["sefwi_wiawso", "goaso"], fee: 90, minutes: 300, kind: "nature", effects: { social: 10, health: 4, energy: -12 }, blurb: "Rainforest giants, forest elephants and chimpanzees on the Ivorian border." }),
  site({ id: "cocoa_farm", name: "Cocoa farm visit", region: "western_north", at: { lat: 6.25, lon: -2.45 }, from: ["sefwi_wiawso", "goaso", "adum"], fee: 40, minutes: 180, kind: "nature", effects: { social: 8, business: 1 }, blurb: "Split a pod, taste the sweet pulp, help turn the beans on the drying mats." }),
  // Central / Western
  site({ id: "kakum", name: "Kakum canopy walkway", region: "central", at: { lat: 5.3497, lon: -1.3831 }, from: ["cape_coast"], fee: 90, minutes: 210, kind: "nature", effects: { social: 14, health: 2, energy: -8 }, blurb: "Seven rope bridges, forty metres above the rainforest floor. Don't look down. Look down." }),
  site({ id: "cape_coast_castle", name: "Cape Coast Castle tour", region: "central", at: { lat: 5.1037, lon: -1.2414 }, from: ["cape_coast"], fee: 60, minutes: 150, kind: "heritage", effects: { social: 8, reputation: 2 }, blurb: "The dungeons, the Door of No Return, and the silence afterwards." }),
  site({ id: "elmina_castle", name: "Elmina Castle (St George's)", region: "central", at: { lat: 5.0828, lon: -1.3486 }, from: ["cape_coast"], fee: 60, minutes: 180, kind: "heritage", effects: { social: 8, reputation: 2 }, blurb: "Built by the Portuguese in 1482. The oldest European building south of the Sahara." }),
  site({ id: "hans_cottage", name: "Hans Cottage crocodile lake", region: "central", at: { lat: 5.1856, lon: -1.2833 }, from: ["cape_coast"], fee: 40, minutes: 120, kind: "wildlife", effects: { social: 8 }, blurb: "Lunch by the lake while the crocodiles sun themselves below the deck." }),
  site({ id: "busua", name: "Busua Beach", region: "western", at: { lat: 4.805, lon: -1.935 }, from: ["takoradi"], fee: 50, minutes: 300, kind: "beach", effects: { social: 14, health: 4, energy: -6 }, blurb: "Surf lessons, lobster and the quietest sunsets on the coast." }),
  site({ id: "nzulezu", name: "Nzulezu stilt village", region: "western", at: { lat: 5.0156, lon: -2.3778 }, from: ["takoradi"], fee: 90, minutes: 330, kind: "heritage", effects: { social: 14, energy: -10 }, blurb: "A whole village on stilts over Lake Tadane, reached by canoe through the raffia swamp." }),
  site({ id: "ankasa", name: "Ankasa rainforest", region: "western", at: { lat: 5.27, lon: -2.64 }, from: ["takoradi"], fee: 80, minutes: 330, kind: "nature", effects: { social: 8, health: 5, energy: -12 }, blurb: "Ghana's wettest, richest forest. Bamboo cathedrals and butterflies." }),
  // Eastern / Greater Accra
  site({ id: "boti_falls", name: "Boti Falls", region: "eastern", at: { lat: 6.2, lon: -0.218 }, from: ["koforidua"], fee: 50, minutes: 210, kind: "waterfall", effects: { social: 12, health: 3, energy: -8 }, blurb: "Twin 'male and female' falls; when they meet in the mist there's a rainbow." }),
  site({ id: "umbrella_rock", name: "Umbrella Rock", region: "eastern", at: { lat: 6.2167, lon: -0.1833 }, from: ["koforidua"], fee: 30, minutes: 150, kind: "nature", effects: { social: 8, fitness: 1, energy: -8 }, blurb: "A giant boulder balanced on another. Twelve people can sit under it." }),
  site({ id: "aburi_gardens", name: "Aburi Botanical Gardens", region: "eastern", at: { lat: 5.848, lon: -0.175 }, from: ["koforidua", "east_legon", "osu"], fee: 40, minutes: 210, kind: "nature", effects: { social: 10, health: 4 }, blurb: "1890 botanical gardens on the cool Akwapim ridge. Picnics, palms and a hollow silk-cotton tree." }),
  site({ id: "akosombo", name: "Akosombo Dam & Dodi Island cruise", region: "eastern", at: { lat: 6.2997, lon: 0.0597 }, from: ["koforidua", "ho", "spintex"], fee: 160, minutes: 360, kind: "dam", effects: { social: 16, energy: -10 }, blurb: "The dam that made Lake Volta, then a boat party to Dodi Island with a live band." }),
  site({ id: "kwahu_paragliding", name: "Kwahu Easter paragliding", region: "eastern", at: { lat: 6.65, lon: -0.73 }, from: ["koforidua"], fee: 650, minutes: 300, kind: "nature", effects: { social: 22, reputation: 3, energy: -12 }, blurb: "Tandem flight off Odweanoma mountain while half of Accra parties in Kwahu for Easter." }),
  site({ id: "shai_hills", name: "Shai Hills Resource Reserve", region: "greater_accra", at: { lat: 5.92, lon: 0.07 }, from: ["spintex", "east_legon"], fee: 50, minutes: 240, kind: "wildlife", effects: { social: 10, health: 3, energy: -10 }, blurb: "Baboons, antelope and the caves of the Shai people, an hour from Accra." }),
  site({ id: "ada_estuary", name: "Ada estuary & Songor lagoon", region: "greater_accra", at: { lat: 5.78, lon: 0.63 }, from: ["spintex", "labadi"], fee: 120, minutes: 330, kind: "beach", effects: { social: 16, health: 3, energy: -8 }, blurb: "Where the Volta meets the sea. Jet skis, island huts and turtles in season." }),
  // Volta / Oti
  site({ id: "wli_falls", name: "Wli Waterfalls", region: "volta", at: { lat: 7.1239, lon: 0.5922 }, from: ["ho"], fee: 70, minutes: 300, kind: "waterfall", effects: { social: 16, health: 4, energy: -12, fitness: 1 }, blurb: "West Africa's highest falls, full of fruit bats. The upper falls are a proper climb." }),
  site({ id: "afadjato", name: "Mount Afadja climb", region: "volta", at: { lat: 7.05, lon: 0.6 }, from: ["ho"], fee: 50, minutes: 270, kind: "nature", effects: { social: 10, health: 4, fitness: 2, energy: -16 }, blurb: "Ghana's highest mountain (885 m). The summit view reaches Togo." }),
  site({ id: "tafi_atome", name: "Tafi Atome Monkey Sanctuary", region: "volta", at: { lat: 6.93, lon: 0.37 }, from: ["ho"], fee: 40, minutes: 180, kind: "wildlife", effects: { social: 10 }, blurb: "Hold out a banana and the mona monkeys climb your arm." }),
  site({ id: "keta_lagoon", name: "Keta lagoon & Fort Prinzenstein", region: "volta", at: { lat: 5.9178, lon: 0.9895 }, from: ["ho"], fee: 70, minutes: 300, kind: "beach", effects: { social: 12, energy: -8 }, blurb: "A sandbar town between sea and lagoon, half-eaten by the waves, still beautiful." }),
  site({ id: "volta_ferry", name: "Volta Lake ferry, Dambai", region: "oti", at: { lat: 8.07, lon: 0.17 }, from: ["dambai"], fee: 30, minutes: 120, kind: "lake", effects: { social: 10 }, blurb: "Cross the lake with traders, goats, motorbikes and a preacher." }),
  site({ id: "kyabobo", name: "Kyabobo National Park", region: "oti", at: { lat: 8.4, lon: 0.6 }, from: ["dambai"], fee: 80, minutes: 300, kind: "nature", effects: { social: 10, health: 4, energy: -12 }, blurb: "Mountains on the Togo border, butterflies and Breast Mountain." }),
];

export const SITE_BY_ID: Record<string, Site> = Object.fromEntries(SITES.map((s) => [s.id, s]));

/** One "day trip" service per site, offered by the tour desk in each base town. */
for (const s of SITES) {
  REGIONAL_SERVICES[`trip_${s.id}`] = { id: `trip_${s.id}`, name: s.name, verb: "Go", cost: s.fee, minutes: s.minutes, effects: s.effects, hours: [6, 15], note: s.blurb, site: s.id };
}

// ---------------------------------------------------------------------------
// Festivals: attendable in their months, in their home towns.

export interface Festival {
  id: string;
  name: string;
  people: string;
  months: number[]; // 1..12
  districts: string[];
  /** Akwasidae: every 42 days (always a Sunday). */
  cycle42?: boolean;
  effects: Effects;
  cost: number;
  blurb: string;
}

export const FESTIVALS: Festival[] = [
  { id: "homowo", name: "Homowo", people: "Ga", months: [8], districts: ["jamestown", "labadi", "osu"], effects: { social: 20, reputation: 2, hunger: 30 }, cost: 30, blurb: "'Hooting at hunger': kpokpoi and palm-nut soup sprinkled through the streets by the chiefs." },
  { id: "chale_wote", name: "Chale Wote Street Art Festival", people: "Accra", months: [8], districts: ["jamestown"], effects: { social: 22, charisma: 1 }, cost: 20, blurb: "Jamestown's streets become a gallery, a stage and a block party." },
  { id: "detty_december", name: "Detty December", people: "Accra", months: [12], districts: ["osu", "labadi", "east_legon"], effects: { social: 26, energy: -18, charisma: 1 }, cost: 250, blurb: "Concerts, beach raves and the whole diaspora at home." },
  { id: "fetu_afahye", name: "Fetu Afahye", people: "Oguaa (Fante)", months: [9], districts: ["cape_coast"], effects: { social: 22, reputation: 2 }, cost: 30, blurb: "Asafo companies march, the Omanhene rides in a palanquin, and Cape Coast parties for a week." },
  { id: "kundum", name: "Kundum", people: "Ahanta & Nzema", months: [8, 9, 10, 11], districts: ["takoradi"], effects: { social: 18, fitness: 1 }, cost: 20, blurb: "A harvest festival of drumming and all-night dancing to drive away evil spirits." },
  { id: "akwasidae", name: "Akwasidae at Manhyia", people: "Asante", months: [], cycle42: true, districts: ["adum"], effects: { social: 20, reputation: 3 }, cost: 20, blurb: "The Asantehene sits in state under huge umbrellas; chiefs pay homage, talking drums speak." },
  { id: "apoo", name: "Apoo", people: "Bono (Techiman & Wenchi)", months: [4, 5], districts: ["techiman"], effects: { social: 18, charisma: 1 }, cost: 20, blurb: "A week when anyone may mock the powerful in song, and the chief must take it." },
  { id: "kwafie", name: "Kwafie", people: "Dormaa & Bono", months: [12, 1], districts: ["sunyani"], effects: { social: 16, reputation: 2 }, cost: 20, blurb: "Fires, purification of the ancestral stools and a durbar of chiefs." },
  { id: "damba", name: "Damba", people: "Dagomba, Gonja, Mamprusi & Wala", months: [8, 9], districts: ["tamale", "damongo", "bole", "wa", "nalerigu"], effects: { social: 22, reputation: 2 }, cost: 30, blurb: "Horsemen in smocks, dancers spinning, and the Damba drums for the Prophet's birthday." },
  { id: "bugum", name: "Bugum (Fire Festival)", people: "Dagomba", months: [6, 7], districts: ["tamale", "nalerigu", "sawla"], effects: { social: 18, energy: -8 }, cost: 10, blurb: "At night the whole town runs through the streets with torches of dry grass." },
  { id: "kobine", name: "Kobine", people: "Dagaaba (Lawra)", months: [9, 10], districts: ["wa"], effects: { social: 16, fitness: 1 }, cost: 20, blurb: "Harvest thanks with the gyil xylophone, and dancers in a cloud of dust." },
  { id: "samanpiid", name: "Samanpiid", people: "Gurune (Bolgatanga)", months: [11, 12], districts: ["bolgatanga"], effects: { social: 16 }, cost: 15, blurb: "Thanksgiving for the harvest with smocks, horses and the war dance." },
  { id: "hogbetsotso", name: "Hogbetsotso", people: "Anlo Ewe", months: [11], districts: ["ho"], effects: { social: 20, reputation: 2 }, cost: 30, blurb: "The exodus from Notsie, re-enacted. Chiefs in kente, drums and agbadza dancers." },
  { id: "odwira", name: "Odwira", people: "Akuapem", months: [9, 10], districts: ["koforidua"], effects: { social: 16, reputation: 2 }, cost: 20, blurb: "Purification and the new yam, with a grand durbar at Akropong." },
  { id: "ngmayem", name: "Ngmayem", people: "Krobo", months: [10], districts: ["koforidua"], effects: { social: 18 }, cost: 20, blurb: "Millet harvest festival of the Krobo. Beads everywhere." },
  { id: "kwahu_easter", name: "Kwahu Easter", people: "Kwahu", months: [3, 4], districts: ["koforidua"], effects: { social: 24, energy: -14 }, cost: 120, blurb: "The whole country drives up the mountain for four days of homecoming parties." },
  { id: "yam_festival", name: "New Yam Festival", people: "Oti & Volta", months: [8, 9], districts: ["dambai", "ho", "kintampo"], effects: { social: 16, hunger: 25 }, cost: 15, blurb: "Nobody eats new yam until the gods and ancestors have had theirs." },
];

for (const f of FESTIVALS) {
  REGIONAL_SERVICES[`fest_${f.id}`] = {
    id: `fest_${f.id}`, name: f.name, verb: "Join in", cost: f.cost, minutes: 180, effects: f.effects, hours: [9, 23], note: f.blurb,
    months: f.months.length ? f.months : undefined, cycle42: f.cycle42, festival: f.id,
  };
}

// ---------------------------------------------------------------------------
// Towns: one walkable street scene each.

const PAL = {
  savanna: { walls: ["#C28A57", "#B9824F", "#D2A36E", "#A86F44", "#E3CBA4", "#8C5A3C"], roofs: ["#6B4A33", "#7A7A72", "#5B4636"], ground: "#C29A6B", accent: "#2E7D4F" },
  forest: { walls: ["#E9DCC3", "#C9B48F", "#D98C5F", "#9FB89A", "#F0E6D2", "#7FA3B8"], roofs: ["#8E5B3E", "#6E7076", "#9C4F2E"], ground: "#A0643F", accent: "#C8452C" },
  coast: { walls: ["#F4E3C1", "#5FA8A0", "#E9B872", "#F7F3E8", "#D46A4C", "#BFD8D2"], roofs: ["#3E5641", "#8A3B2E", "#6D6875"], ground: "#D8C7A0", accent: "#0E7C86" },
  city: { walls: ["#D9C9A3", "#E3A857", "#C47A5A", "#B8B8AA", "#8FA8C0", "#E8D5B5"], roofs: ["#7A6A5A", "#8E5B3E", "#6B7076"], ground: "#9E7A5C", accent: "#F2B705" },
};

type PlaceSpec = {
  id: string;
  name: string;
  kind: PlaceKind;
  services?: string[];
  open?: [number, number];
  blurb: string;
  sign?: string;
  size?: [number, number, number];
  geo?: { lat: number; lon: number };
  beach?: boolean;
};

interface TownSpec {
  id: string;
  city: string;
  name: string;
  tagline: string;
  mood: string;
  style: DistrictStyle;
  geo: { lat: number; lon: number };
  roads: { main: string; cross: string };
  bearing: number;
  costOfLiving: number;
  crowd: number;
  traffic: number;
  nightlife: number;
  palette: keyof typeof PAL;
  landmark: string;
  places: PlaceSpec[];
}

const DEFAULT_SIZE: Partial<Record<PlaceKind, [number, number, number]>> = {
  market: [24, 14, 6], food: [9, 7, 3.4], church: [12, 14, 9], mosque: [12, 12, 9], clinic: [12, 10, 7], school: [14, 10, 7], bank: [11, 9, 8],
  shrine: [6, 6, 3.2], lodge: [12, 10, 6], tour: [8, 6, 3.4], shop: [10, 8, 4], dealer: [16, 10, 5], work: [14, 10, 6], landmark: [14, 10, 8], nightlife: [10, 8, 4], furniture: [14, 9, 4], realtor: [9, 8, 5], phone: [8, 7, 4],
};
const KIND_COLOR: Partial<Record<PlaceKind, string>> = { mosque: "#E8DCC0", church: "#F2EEE4", clinic: "#F4F4EE", bank: "#E8D5B5", lodge: "#E9B872", tour: "#5FA8A0", dealer: "#D9D4C7" };

/**
 * Lay places out along the main street: transport at the west end, then pack
 * buildings by width on whichever side has room (coastal towns build only on
 * the landward side; beach bars go on the sand).
 */
function layout(t: TownSpec): Place[] {
  const coastal = t.style === "coastal";
  const cursor: Record<string, number> = { "-1": -76, "1": -54 };
  const limit: Record<string, number> = { "-1": 75, "1": 93 };
  const out: Place[] = [];
  let beachX = -20;
  let n = 0;
  for (const s of t.places) {
    let pos: [number, number];
    const base = s.size ?? DEFAULT_SIZE[s.kind] ?? [10, 8, 4];
    const size: [number, number, number] = coastal ? [Math.round(base[0] * 0.8), base[1], base[2]] : [...base];
    if (s.kind === "transport") pos = [-62, coastal ? -14 : 14];
    else if (s.beach && coastal) { pos = [beachX, 30]; beachX += 34; }
    else {
      const sides = coastal ? ["-1"] : ["-1", "1"];
      const side = sides.reduce((best, sd) => (cursor[sd] < cursor[best] ? sd : best), sides[0]);
      if (cursor[side] + size[0] > limit[side]) size[0] = Math.max(6, Math.floor(limit[side] - cursor[side]));
      pos = [cursor[side] + size[0] / 2, Number(side) * 16];
      cursor[side] += size[0] + 3;
    }
    n++;
    out.push({
      id: s.id, district: t.id, name: s.name, kind: s.kind, sign: s.sign ?? s.name.toUpperCase(), pos, size,
      color: KIND_COLOR[s.kind] ?? PAL[t.palette].walls[(n * 3) % PAL[t.palette].walls.length],
      open: s.open ?? (s.kind === "transport" || s.kind === "lodge" || s.kind === "clinic" ? [0, 24] : [7, 20]),
      services: s.services ?? [], blurb: s.blurb, geo: s.geo,
    });
  }
  return out;
}

export const tripsFrom = (d: string) => SITES.filter((s) => s.from.includes(d)).map((s) => `trip_${s.id}`);
export const festsIn = (d: string) => FESTIVALS.filter((f) => f.districts.includes(d)).map((f) => `fest_${f.id}`);

const station = (id: string, name: string, blurb: string): PlaceSpec => ({ id, name, kind: "transport", services: ["lorry_chat"], blurb });
const lodge = (id: string, name: string, blurb = "Clean rooms, a ceiling fan and a mosquito net."): PlaceSpec => ({ id, name, kind: "lodge", services: ["lodge"], blurb });
const tour = (id: string, name: string, district: string, blurb: string): PlaceSpec => ({ id, name, kind: "tour", services: [...tripsFrom(district), ...festsIn(district)], open: [6, 19], blurb });

const TOWNS_SPEC: TownSpec[] = [
  {
    id: "airport_city", city: "accra", name: "Airport City", tagline: "Kotoka, glass towers and private hangars", mood: "Accra's business district by the runway: hotels, airline offices and the roar of jets.",
    style: "corporate", geo: { lat: 5.6052, lon: -0.1718 }, roads: { main: "Liberation Road", cross: "Airport Bypass" }, bearing: 0,
    costOfLiving: 1.45, crowd: 0.55, traffic: 0.8, nightlife: 0.5, palette: "city", landmark: "Kotoka International Airport",
    places: [
      station("airport_stop", "Airport Junction", "Taxis, ride apps and the shuttle to the terminals."),
      { id: "kotoka", name: "Kotoka International Airport (Terminal 3)", kind: "airport", services: ["view", "coffee"], open: [0, 24], size: [30, 16, 14], blurb: "Domestic flights to Kumasi, Tamale, Takoradi, Wa, Ho and Sunyani; international to the world.", geo: { lat: 5.6052, lon: -0.1668 } },
      { id: "hangar_office", name: "General Aviation Hangars", kind: "hangar", open: [7, 19], size: [22, 14, 10], blurb: "Private hangars for business aviation. Leases, sales and maintenance." },
      { id: "aircraft_dealer", name: "Skyline Aviation Sales", kind: "dealer", open: [9, 18], size: [16, 10, 8], blurb: "Light aircraft, turboprops, business jets and helicopters." },
      { id: "airport_hotel", name: "Runway View Hotel", kind: "lodge", services: ["lodge", "coffee"], open: [0, 24], size: [16, 12, 22], blurb: "Business hotel with a rooftop bar facing the runway." },
      { id: "airport_bank", name: "Coastline Bank (Airport City)", kind: "bank", open: [8, 17], blurb: "Corporate banking and the FX desk." },
    ],
  },
  {
    id: "nima", city: "accra", name: "Nima", tagline: "The zongo that raised half of Accra", mood: "Dense, loud, devout and generous. Kiosks, mosques, gutter football and the best waakye at dawn.",
    style: "market", geo: { lat: 5.5833, lon: -0.1963 }, roads: { main: "Nima Highway", cross: "Mamobi Road" }, bearing: 5,
    costOfLiving: 0.65, crowd: 1, traffic: 0.8, nightlife: 0.35, palette: "city", landmark: "Nima Market",
    places: [
      station("nima_station", "Nima Station", "Trotros to Circle, Accra Central and Madina."),
      { id: "nima_market", name: "Nima Market", kind: "market", services: ["market_haggle", "koko_koose", "tubaani"], blurb: "Dried fish, kola nuts, spices, cloth and secondhand everything." },
      { id: "nima_mosque", name: "Nima Central Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "The call to prayer sets the rhythm of the day." },
      { id: "zongo_waakye", name: "Hajia's Zongo Waakye", kind: "food", services: ["waakye", "tubaani", "koko_koose", "chichinga"], open: [5, 22], blurb: "Waakye in leaves, gari, spaghetti, wele and egg. Queue from 5am." },
      { id: "nima_pitch", name: "Nima Astro Pitch", kind: "landmark", services: ["street_football"], open: [6, 21], blurb: "Future Black Stars, every afternoon." },
      { id: "nima_barber", name: "Lion Heart Barbering", kind: "shop", services: ["haircut"], open: [8, 22], blurb: "Fades, line-ups and political arguments." },
      { id: "mamobi_polyclinic", name: "Mamobi Polyclinic", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Crowded mornings, caring nurses." },
      { id: "nima_tailor", name: "Zongo Tailors", kind: "shop", services: ["seamstress"], open: [8, 20], blurb: "Kaftans and jalabiyas sewn by Friday." },
    ],
  },
  {
    id: "jamestown", city: "accra", name: "Jamestown", tagline: "Old Accra, lighthouse and boxing", mood: "Ga fishing community: canoes, smoke from the fish ovens, boxing gyms and street art.",
    style: "coastal", geo: { lat: 5.5333, lon: -0.2128 }, roads: { main: "High Street", cross: "Hansen Road" }, bearing: 80,
    costOfLiving: 0.7, crowd: 0.85, traffic: 0.55, nightlife: 0.45, palette: "coast", landmark: "Jamestown Lighthouse",
    places: [
      station("jamestown_stop", "Jamestown Stop", "Trotros to Accra Central and Kaneshie."),
      { id: "jamestown_lighthouse", name: "Jamestown Lighthouse", kind: "landmark", services: ["view", ...festsIn("jamestown")], open: [8, 18], blurb: "Climb the red-and-white tower for the best view of old Accra.", geo: { lat: 5.5325, lon: -0.212 } },
      { id: "james_fort", name: "James Fort", kind: "landmark", services: ["view"], open: [9, 17], blurb: "British fort from 1673, later a prison. The waves still hit the walls.", geo: { lat: 5.5318, lon: -0.2105 } },
      { id: "bukom_gym", name: "Bukom Boxing Gym", kind: "gym", services: ["boxing"], open: [6, 20], blurb: "Ring ropes, punching bags made from sacks, and champions on the walls." },
      { id: "ga_kenkey_spot", name: "Auntie Naa's Kenkey", kind: "food", services: ["ga_kenkey", "banku", "sobolo"], open: [7, 22], blurb: "Ga kenkey, hot fried fish and pepper ground in an asanka." },
      { id: "fish_smokers", name: "Fish Smoking Yards", kind: "market", services: ["market_haggle"], blurb: "Women smoke herrings over clay ovens all day." },
      { id: "ga_shrine", name: "Sakumo Shrine (Ga traditional)", kind: "shrine", services: ["libation"], open: [6, 18], blurb: "Where the Wulomo, the Ga traditional priest, keeps the old rites." },
      { id: "ga_mantse", name: "Ga Mantse Palace", kind: "landmark", services: ["view"], open: [9, 17], blurb: "Seat of the Ga paramount chief." },
      { id: "jamestown_harbour", name: "Jamestown Fishing Harbour", kind: "market", services: ["banku", "view"], blurb: "Painted canoes, nets and the morning catch.", beach: true },
    ],
  },
  {
    id: "adum", city: "kumasi", name: "Adum & Kejetia", tagline: "The Garden City's beating heart", mood: "Busy, proud and loud. Kejetia's maze of stalls, kente and fufu bars.",
    style: "market", geo: { lat: 6.6935, lon: -1.6244 }, roads: { main: "Prempeh II Street", cross: "Harper Road" }, bearing: 15,
    costOfLiving: 0.9, crowd: 1, traffic: 0.95, nightlife: 0.55, palette: "city", landmark: "Kejetia Market",
    places: [
      station("kejetia_station", "Kejetia Lorry Park", "Trotros and buses to every corner of the country. The STC and VIP buses leave from here."),
      { id: "kejetia_market", name: "Kejetia Market", kind: "market", services: ["market_haggle", "roasted_plantain", "koko_koose"], blurb: "One of West Africa's biggest markets: ten thousand stalls under one roof.", geo: { lat: 6.6966, lon: -1.6233 }, size: [26, 16, 9] },
      { id: "maame_akos", name: "Maame Akos Chop Bar", kind: "food", services: ["abenkwan", "omo_tuo", "ampesi", "mpotompoto", "kokonte"], open: [8, 21], blurb: "Fufu pounded by two strong men in rhythm. Goat abenkwan on Sundays." },
      { id: "manhyia", name: "Manhyia Palace", kind: "landmark", services: ["view", ...festsIn("adum")], open: [9, 17], blurb: "Seat of the Asantehene. The museum holds the history of the Golden Stool.", geo: { lat: 6.7065, lon: -1.6153 }, size: [16, 12, 8] },
      { id: "kumasi_melcom", name: "Melcom Adum", kind: "shop", services: [], open: [8, 21], blurb: "Mattresses, fridges, gas cookers and back-to-school everything." },
      { id: "sokoban", name: "Sokoban Wood Village", kind: "furniture", services: [], open: [7, 18], blurb: "Hundreds of carpenters and sawmills. Order a bed frame, collect it Saturday." },
      { id: "suame_magazine", name: "Suame Magazine", kind: "dealer", services: [], open: [7, 19], blurb: "The biggest informal engineering cluster in Africa. They can fix anything, or build it from scratch." },
      { id: "kath", name: "Komfo Anokye Teaching Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "The big hospital on Bantama hill.", geo: { lat: 6.6977, lon: -1.6297 } },
      { id: "knust_city", name: "KNUST Short Courses", kind: "school", services: ["course"], open: [8, 20], blurb: "Kwame Nkrumah University of Science and Technology runs evening and weekend programmes." },
      { id: "kumasi_bank", name: "Coastline Bank (Adum)", kind: "bank", open: [8, 17], blurb: "Accounts and the FX desk." },
      { id: "kumasi_mosque", name: "Kumasi Central Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Zongo life gathers here after prayers." },
      { id: "bantama_church", name: "Wesley Methodist Cathedral", kind: "church", services: ["church"], open: [6, 20], blurb: "Big choir, bigger hats." },
      lodge("garden_city_lodge", "Garden City Guesthouse"),
      tour("kumasi_tours", "Ashanti Tours Desk", "adum", "Day trips to Lake Bosomtwe, Bonwire kente and Ntonso adinkra."),
      { id: "okomfo_sword", name: "Okomfo Anokye Sword Site", kind: "shrine", services: ["view", "libation"], open: [8, 18], blurb: "The sword the priest Okomfo Anokye drove into the ground. Legend says if it's pulled out, the Asante kingdom falls." },
      { id: "kumasi_spot", name: "Highlife Spot", kind: "nightlife", services: ["beach_bar", "palm_wine"], open: [16, 2], blurb: "Plastic chairs, cold beer and old highlife records." },
    ],
  },
  {
    id: "tamale", city: "tamale", name: "Tamale Central", tagline: "Motorbikes, smocks and shea", mood: "Hot, flat and friendly. Ten thousand motorbikes and the call to prayer.",
    style: "savanna", geo: { lat: 9.4034, lon: -0.8424 }, roads: { main: "Bolgatanga Road", cross: "Salaga Road" }, bearing: 0,
    costOfLiving: 0.7, crowd: 0.75, traffic: 0.7, nightlife: 0.35, palette: "savanna", landmark: "Tamale Central Mosque",
    places: [
      station("tamale_station", "Tamale Lorry Station", "Buses to Kumasi and Accra, trotros to Bolga, Yendi and Damongo."),
      { id: "tamale_market", name: "Tamale Central Market", kind: "market", services: ["market_haggle", "koko_koose", "brukina"], blurb: "Shea butter, dawadawa, guinea fowl, smocks and leather.", geo: { lat: 9.4034, lon: -0.8424 } },
      { id: "hajia_tz", name: "Hajia Memuna's TZ Joint", kind: "food", services: ["tz", "tubaani", "guinea_fowl", "chichinga"], open: [7, 22], blurb: "The ayoyo soup is slippery and perfect." },
      { id: "tamale_mosque", name: "Tamale Central Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "The whole town stops on Friday afternoon.", size: [16, 14, 12] },
      { id: "tamale_cultural", name: "Centre for National Culture", kind: "landmark", services: ["view", "smock_fitting", ...festsIn("tamale")], open: [8, 18], blurb: "Smock weavers, leather workers and drummers." },
      { id: "tamale_melcom", name: "Melcom Tamale", kind: "shop", open: [8, 21], blurb: "Fans, fridges and generators for the hot season." },
      { id: "tamale_motors", name: "Motor King Dealers", kind: "dealer", open: [7, 19], blurb: "Motorbikes, pragyas and bicycles. Tamale rides on two wheels." },
      { id: "tamale_carpenters", name: "Tamale Carpenters' Row", kind: "furniture", open: [7, 18], blurb: "Beds, benches and wardrobes in hard savanna wood." },
      { id: "uds_tamale", name: "University for Development Studies", kind: "school", services: ["course"], open: [8, 20], blurb: "UDS: medicine, agriculture and community development." },
      { id: "tamale_hospital", name: "Tamale Teaching Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Serves the whole north.", geo: { lat: 9.3906, lon: -0.8352 } },
      { id: "tamale_bank", name: "Coastline Bank (Tamale)", kind: "bank", open: [8, 17], blurb: "Accounts and transfers." },
      { id: "shea_coop", name: "Pagsung Shea Butter Co-op", kind: "work", open: [6, 18], blurb: "Women crack, roast, grind and knead shea nuts into butter by hand." },
      lodge("tamale_lodge", "Savanna Guesthouse"),
      tour("tamale_tours", "Northern Tours Desk", "tamale", "Mole safaris, Larabanga, Daboya weavers, Damba and the fire festival."),
      { id: "tamale_pito", name: "Pito Bar", kind: "nightlife", services: ["pito", "chichinga"], open: [12, 23], blurb: "Calabashes of pito under the neem tree." },
    ],
  },
  {
    id: "kintampo", city: "kintampo", name: "Kintampo", tagline: "The centre of Ghana", mood: "A truckers' town on the great north road. Yams, waterfalls and long-distance drivers.",
    style: "town", geo: { lat: 8.0563, lon: -1.7307 }, roads: { main: "Kumasi–Tamale Highway (N10)", cross: "Kintampo Market Road" }, bearing: 0,
    costOfLiving: 0.65, crowd: 0.55, traffic: 0.7, nightlife: 0.3, palette: "forest", landmark: "Kintampo Waterfalls",
    places: [
      station("kintampo_station", "Kintampo Lorry Station", "Every bus between Kumasi and Tamale stops here for chop."),
      { id: "kintampo_market", name: "Kintampo Market", kind: "market", services: ["market_haggle", "fried_yam"], blurb: "Mountains of yam, and the trucks that carry them south." },
      { id: "highway_chop", name: "Highway Chop Bar", kind: "food", services: ["abunuabunu", "red_red", "tz", "fried_yam", "koko_koose"], open: [5, 23], blurb: "Drivers eat first. Then everyone else." },
      tour("kintampo_falls_gate", "Kintampo Waterfalls Gate", "kintampo", "Guides to Kintampo and Fuller falls, the centre of Ghana and the monkey sanctuary."),
      lodge("kintampo_lodge", "Centre Point Lodge"),
      { id: "kintampo_hospital", name: "Kintampo Municipal Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Home of a famous health research centre." },
      { id: "kintampo_mosque", name: "Kintampo Zongo Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Hausa, Gonja and Mo neighbours pray together." },
      { id: "kintampo_church", name: "Catholic Church, Kintampo", kind: "church", services: ["church"], open: [6, 20], blurb: "Sunday mass in Twi and English." },
      { id: "kintampo_yam", name: "Yam Truck Depot", kind: "work", open: [5, 18], blurb: "Load 3,000 tubers onto a truck to Accra before noon." },
      { id: "kintampo_dealer", name: "Pragya & Motor Depot", kind: "dealer", open: [7, 18], blurb: "Pragya tricycles, aboboyaa and motorbikes." },
    ],
  },
  {
    id: "techiman", city: "techiman", name: "Techiman", tagline: "The food basket's market", mood: "Market days are wild: traders from Burkina, Togo and Côte d'Ivoire.",
    style: "town", geo: { lat: 7.5866, lon: -1.9381 }, roads: { main: "Kumasi–Tamale Road (N10)", cross: "Wenchi Road" }, bearing: 0,
    costOfLiving: 0.7, crowd: 0.85, traffic: 0.8, nightlife: 0.35, palette: "forest", landmark: "Techiman Market",
    places: [
      station("techiman_station", "Techiman Lorry Park", "Trucks of tomatoes, yam and maize head south all night."),
      { id: "techiman_market", name: "Techiman Market", kind: "market", services: ["market_haggle", "fried_yam", "roasted_plantain"], blurb: "One of West Africa's biggest food markets. Wednesday to Friday it never sleeps.", size: [26, 16, 7] },
      { id: "techiman_chop", name: "Auntie Yaa's Chop Bar", kind: "food", services: ["abunuabunu", "ampesi", "kokonte", "red_red"], open: [8, 21], blurb: "Abunuabunu with bush meat and mushrooms." },
      tour("techiman_tours", "Bono East Tours", "techiman", "Tano Sacred Grove, Boabeng-Fiema monkeys, Kintampo falls and Apoo."),
      lodge("techiman_lodge", "Market Rest Lodge"),
      { id: "techiman_hospital", name: "Holy Family Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "The Catholic hospital on the hill." },
      { id: "techiman_bank", name: "Coastline Bank (Techiman)", kind: "bank", open: [8, 17], blurb: "Traders' accounts and mobile money float." },
      { id: "techiman_dealer", name: "Techiman Motors", kind: "dealer", open: [7, 18], blurb: "Pragya, aboboyaa, motorbikes and tired tokunbo pickups." },
      { id: "techiman_church", name: "Pentecost Church, Techiman", kind: "church", services: ["church"], open: [6, 20], blurb: "Tambourines and testimony." },
    ],
  },
  {
    id: "sunyani", city: "sunyani", name: "Sunyani", tagline: "Ghana's cleanest city", mood: "Green, orderly and calm. Civil servants, students and cashew money.",
    style: "town", geo: { lat: 7.3349, lon: -2.3123 }, roads: { main: "Kumasi Road", cross: "Berekum Road" }, bearing: 0,
    costOfLiving: 0.8, crowd: 0.55, traffic: 0.55, nightlife: 0.4, palette: "forest", landmark: "Sunyani Cenotaph",
    places: [
      station("sunyani_station", "Sunyani Main Station", "VIP buses to Accra and Kumasi; trotros to Berekum and Dormaa."),
      { id: "sunyani_market", name: "Sunyani Central Market", kind: "market", services: ["market_haggle", "roasted_plantain"], blurb: "Cashew, plantain, cocoyam and kente-print cloth." },
      { id: "sunyani_chop", name: "Bono Kitchen", kind: "food", services: ["abunuabunu", "abenkwan", "ampesi", "red_red"], open: [8, 21], blurb: "Abunuabunu like grandmother makes." },
      { id: "sunyani_cenotaph", name: "Sunyani Cenotaph", kind: "landmark", services: ["view", ...festsIn("sunyani")], blurb: "Memorial to the soldiers of both world wars, in the middle of the city.", geo: { lat: 7.3369, lon: -2.3283 } },
      { id: "uenr", name: "University of Energy & Natural Resources", kind: "school", services: ["course"], open: [8, 20], blurb: "UENR: forestry, energy and agribusiness." },
      { id: "sunyani_melcom", name: "Melcom Sunyani", kind: "shop", open: [8, 21], blurb: "Everything for the house." },
      { id: "sunyani_hospital", name: "Sunyani Regional Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "sunyani_bank", name: "Coastline Bank (Sunyani)", kind: "bank", open: [8, 17], blurb: "Accounts and transfers." },
      lodge("sunyani_lodge", "Cashew Tree Lodge"),
      tour("sunyani_tours", "Bono Tours Desk", "sunyani", "Bui Dam and the Black Volta gorge, plus the Kwafie festival."),
      { id: "sunyani_cashew", name: "Cashew Warehouse", kind: "work", open: [7, 17], blurb: "Grade, weigh and bag raw cashew nuts for export." },
    ],
  },
  {
    id: "wa", city: "wa", name: "Wa", tagline: "Palace, xylophones and the Black Volta", mood: "Dusty and dignified. The Wa Naa's palace, mosques and Dagaaba music.",
    style: "savanna", geo: { lat: 10.0601, lon: -2.5099 }, roads: { main: "Kumasi Road", cross: "Tumu Road" }, bearing: 0,
    costOfLiving: 0.62, crowd: 0.55, traffic: 0.45, nightlife: 0.35, palette: "savanna", landmark: "Wa Naa's Palace",
    places: [
      station("wa_station", "Wa Lorry Station", "Buses south via Bole and Kintampo; trotros to Lawra, Nandom and Tumu."),
      { id: "wa_market", name: "Wa Central Market", kind: "market", services: ["market_haggle", "koko_koose", "brukina"], blurb: "Shea butter, groundnuts, millet, guinea fowl eggs." },
      { id: "wasawasa_joint", name: "Mma Fati's Wasawasa", kind: "food", services: ["wasawasa", "tz", "tubaani", "guinea_fowl"], open: [7, 21], blurb: "The best wasawasa in the Upper West, people swear." },
      { id: "wa_palace", name: "Wa Naa's Palace", kind: "landmark", services: ["view", ...festsIn("wa")], open: [8, 18], blurb: "A Sudano-Sahelian mud palace. Greet the elders before you take photos.", geo: { lat: 10.0607, lon: -2.5025 }, size: [18, 14, 7] },
      { id: "wa_mosque", name: "Wa Central Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Wa has more mosques than any town its size." },
      { id: "wa_university", name: "SDD University of Business & Integrated Development Studies", kind: "school", services: ["course"], open: [8, 20], blurb: "The Upper West's university." },
      { id: "wa_hospital", name: "Wa Regional Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "wa_dealer", name: "Wa Motorbike Market", kind: "dealer", open: [7, 18], blurb: "Motorbikes, tricycles and bicycles." },
      lodge("wa_lodge", "Upland Guesthouse"),
      tour("wa_tours", "Upper West Tours", "wa", "Wechiau hippos, Gwollu wall and the Kobine festival in Lawra."),
      { id: "wa_pito", name: "Gyil & Pito Bar", kind: "nightlife", services: ["pito"], open: [14, 23], blurb: "A xylophone player, a calabash and a crowd." },
    ],
  },
  {
    id: "bole", city: "bole", name: "Bole", tagline: "Gonja country, cashew and gold", mood: "A small savanna town with an ancient mosque, cashew orchards and the Black Volta nearby.",
    style: "savanna", geo: { lat: 9.0333, lon: -2.4833 }, roads: { main: "Bole–Bamboi Road (N12)", cross: "Sawla Road" }, bearing: 0,
    costOfLiving: 0.55, crowd: 0.4, traffic: 0.35, nightlife: 0.2, palette: "savanna", landmark: "Bole Mud Mosque",
    places: [
      station("bole_station", "Bole Lorry Stop", "Buses to Wa and Kumasi, trotros to Sawla and Bamboi."),
      { id: "bole_market", name: "Bole Market", kind: "market", services: ["market_haggle", "koko_koose"], blurb: "Market day draws villages from all around. Cashew, shea and yams." },
      { id: "bole_chop", name: "Mma Ayishetu's Food", kind: "food", services: ["tz", "tubaani", "fried_yam", "wasawasa"], open: [7, 21], blurb: "TZ with dried okro soup and dawadawa." },
      { id: "bole_mosque_place", name: "Bole Mud Mosque", kind: "mosque", services: ["mosque", "jumah", "view"], open: [5, 21], blurb: "Mud and timber, centuries old.", size: [12, 12, 9] },
      { id: "bole_cashew", name: "Cashew Buying Centre", kind: "work", open: [7, 17], blurb: "Weigh farmers' cashew, pay out, load the trucks." },
      lodge("bole_lodge", "Bole Guesthouse"),
      tour("bole_tours", "Gonja Trips", "bole", "Bui Dam via Bamboi, Black Volta canoe trips and the Damba festival."),
      { id: "bole_clinic", name: "Bole District Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Small and busy." },
      { id: "bole_dealer", name: "Bole Motor Yard", kind: "dealer", open: [7, 18], blurb: "Second-hand motorbikes and tricycles." },
    ],
  },
  {
    id: "sawla", city: "sawla", name: "Sawla", tagline: "Junction town of the west", mood: "Where the Wa road meets the Tamale road. Trucks, groundnuts and patience.",
    style: "savanna", geo: { lat: 9.2833, lon: -2.4167 }, roads: { main: "Wa–Kumasi Road (N12)", cross: "Tamale–Sawla Road" }, bearing: 0,
    costOfLiving: 0.5, crowd: 0.35, traffic: 0.4, nightlife: 0.15, palette: "savanna", landmark: "Sawla Junction",
    places: [
      station("sawla_station", "Sawla Junction", "Everything going between Wa, Tamale and Kumasi passes through here."),
      { id: "sawla_market", name: "Sawla Market", kind: "market", services: ["market_haggle", "brukina"], blurb: "Groundnuts, maize and smoked fish." },
      { id: "sawla_chop", name: "Junction Food Joint", kind: "food", services: ["tz", "tubaani", "koko_koose", "chichinga"], open: [5, 22], blurb: "Open early for the first buses." },
      { id: "sawla_mosque", name: "Sawla Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Whitewashed and quiet." },
      lodge("sawla_lodge", "Junction Rest House"),
      tour("sawla_tours", "Savannah Trips", "sawla", "Mole National Park from the west, Larabanga and the Black Volta."),
      { id: "sawla_clinic", name: "Sawla Health Centre", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Nurses, malaria tests and ORS." },
    ],
  },
  {
    id: "damongo", city: "damongo", name: "Damongo", tagline: "Gateway to Mole", mood: "Capital of the Savannah Region: rangers, students and the road to the elephants.",
    style: "savanna", geo: { lat: 9.0833, lon: -1.8167 }, roads: { main: "Tamale–Sawla Road", cross: "Mole Road" }, bearing: 0,
    costOfLiving: 0.55, crowd: 0.35, traffic: 0.35, nightlife: 0.2, palette: "savanna", landmark: "Mole National Park",
    places: [
      station("damongo_station", "Damongo Station", "Trotros to Tamale, Larabanga and Sawla."),
      { id: "damongo_market", name: "Damongo Market", kind: "market", services: ["market_haggle", "koko_koose"], blurb: "Shea, dawadawa and baskets." },
      { id: "damongo_chop", name: "Ranger's Chop Joint", kind: "food", services: ["tz", "guinea_fowl", "tubaani"], open: [7, 21], blurb: "Guinea fowl soup the rangers swear by." },
      tour("mole_desk", "Mole Safari Desk", "damongo", "Mole safari walks, Larabanga mosque and the mystic stone."),
      lodge("damongo_lodge", "Savannah Lodge"),
      { id: "damongo_agric", name: "Damongo Agricultural College", kind: "school", services: ["course"], open: [8, 18], blurb: "Farming, animal husbandry and agribusiness." },
      { id: "damongo_mosque", name: "Damongo Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Friday is the town's busiest hour." },
      { id: "damongo_clinic", name: "West Gonja Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "The region's main hospital." },
    ],
  },
  {
    id: "bolgatanga", city: "bolgatanga", name: "Bolgatanga", tagline: "Baskets, leather and painted houses", mood: "Bolga: craft capital of the north, on the edge of the Sahel.",
    style: "savanna", geo: { lat: 10.7856, lon: -0.8514 }, roads: { main: "Navrongo Road", cross: "Bawku Road" }, bearing: 0,
    costOfLiving: 0.6, crowd: 0.6, traffic: 0.5, nightlife: 0.35, palette: "savanna", landmark: "Bolga Crafts Market",
    places: [
      station("bolga_station", "Bolga Lorry Station", "Buses to Tamale and Kumasi; trotros to Paga, Navrongo and Bawku."),
      { id: "bolga_market", name: "Bolga Central Market", kind: "market", services: ["market_haggle", "koko_koose", "brukina"], blurb: "Every third day the market swells with baskets, hats, leather and livestock." },
      { id: "bolga_crafts", name: "Bolga Crafts Village", kind: "shop", open: [8, 18], blurb: "Straw baskets, fugu smocks, leather bags and Sirigu pottery." },
      { id: "bolga_chop", name: "Frafra Kitchen", kind: "food", services: ["tz", "tubaani", "guinea_fowl", "chichinga"], open: [7, 22], blurb: "TZ with bra (bitter leaf) soup." },
      { id: "bolga_pito", name: "Pito Bar, Zaare", kind: "nightlife", services: ["pito"], open: [12, 23], blurb: "Pito so fresh it's still warm." },
      { id: "bolga_tech", name: "Bolgatanga Technical University", kind: "school", services: ["course"], open: [8, 20], blurb: "Engineering, fashion and agriculture." },
      { id: "bolga_hospital", name: "Upper East Regional Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "bolga_mosque", name: "Bolga Central Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Next to the market." },
      { id: "bolga_church", name: "Catholic Cathedral, Bolga", kind: "church", services: ["church"], open: [6, 20], blurb: "Masses in Gurune and English." },
      lodge("bolga_lodge", "Sahel Guesthouse"),
      tour("bolga_tours", "Upper East Tours", "bolgatanga", "Paga crocodiles, Pikworo, Sirigu, Tongo hills and Samanpiid."),
      { id: "bolga_dealer", name: "Bolga Motor Yard", kind: "dealer", open: [7, 18], blurb: "Motorbikes and tricycles, some from across the Burkina border." },
    ],
  },
  {
    id: "nalerigu", city: "nalerigu", name: "Nalerigu", tagline: "Seat of the Nayiri", mood: "Capital of the Mamprugu kingdom and the North East Region.",
    style: "savanna", geo: { lat: 10.5276, lon: -0.3698 }, roads: { main: "Walewale–Nalerigu Road", cross: "Gambaga Road" }, bearing: 0,
    costOfLiving: 0.5, crowd: 0.35, traffic: 0.3, nightlife: 0.15, palette: "savanna", landmark: "Naa Jaringa Wall",
    places: [
      station("nalerigu_station", "Nalerigu Station", "Trotros to Walewale, Gambaga and Tamale."),
      { id: "nalerigu_market", name: "Nalerigu Market", kind: "market", services: ["market_haggle"], blurb: "Guinea fowl, millet and shea." },
      { id: "nalerigu_chop", name: "Mamprusi Kitchen", kind: "food", services: ["tz", "tubaani", "guinea_fowl"], open: [7, 21], blurb: "TZ, always TZ." },
      { id: "baptist_medical", name: "Baptist Medical Centre", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "The mission hospital the whole North East relies on." },
      { id: "nalerigu_mosque", name: "Nalerigu Mosque", kind: "mosque", services: ["mosque", "jumah"], open: [4, 22], blurb: "Near the Nayiri's palace." },
      lodge("nalerigu_lodge", "Escarpment Guesthouse"),
      tour("nalerigu_tours", "Mamprugu Trips", "nalerigu", "The Gambaga escarpment and the Naa Jaringa wall."),
    ],
  },
  {
    id: "cape_coast", city: "cape_coast", name: "Cape Coast", tagline: "Castles, schools and the Atlantic", mood: "Old, proud and coastal. Students, fishermen and history.",
    style: "coastal", geo: { lat: 5.1053, lon: -1.2466 }, roads: { main: "Kotokuraba Road", cross: "Commercial Street" }, bearing: 80,
    costOfLiving: 0.85, crowd: 0.6, traffic: 0.55, nightlife: 0.5, palette: "coast", landmark: "Cape Coast Castle",
    places: [
      station("cape_station", "Kotokuraba Station", "Buses to Accra and Takoradi; trotros to Elmina and Kakum."),
      { id: "kotokuraba", name: "Kotokuraba Market", kind: "market", services: ["market_haggle", "fante_kenkey"], blurb: "Smoked fish, Fante kenkey and wax print." },
      { id: "cape_chop", name: "Auntie Ekua's Kenkey House", kind: "food", services: ["fante_kenkey", "red_red", "kokonte"], open: [7, 21], blurb: "Fante kenkey wrapped in dried plantain leaves, with pepper and fried fish." },
      { id: "cape_castle_place", name: "Cape Coast Castle", kind: "landmark", services: ["view", ...festsIn("cape_coast")], open: [9, 17], blurb: "A UNESCO World Heritage site, and a place of grief.", geo: { lat: 5.1037, lon: -1.2414 }, size: [18, 14, 10] },
      { id: "ucc", name: "University of Cape Coast", kind: "school", services: ["course", "coworking"], open: [8, 20], blurb: "UCC: Ghana's teacher-training giant.", geo: { lat: 5.1157, lon: -1.2903 } },
      { id: "cape_hospital", name: "Cape Coast Teaching Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "cape_melcom", name: "Melcom Cape Coast", kind: "shop", open: [8, 21], blurb: "Household goods and school supplies." },
      { id: "cape_church", name: "Christ Church Cathedral", kind: "church", services: ["church"], open: [6, 20], blurb: "One of the oldest Anglican churches in West Africa." },
      lodge("cape_lodge", "Oguaa Guesthouse"),
      tour("cape_tours", "Central Region Tours", "cape_coast", "Kakum canopy, Elmina and Cape Coast castles, Hans Cottage and Fetu Afahye."),
      { id: "cape_beach_bar", name: "Castle Beach Bar", kind: "nightlife", services: ["beach_bar", "swim"], open: [12, 1], blurb: "Drinks with the castle walls glowing behind you.", beach: true },
    ],
  },
  {
    id: "takoradi", city: "takoradi", name: "Sekondi-Takoradi", tagline: "Oil City by the sea", mood: "Twin city of harbour, rail and offshore oil money.",
    style: "coastal", geo: { lat: 4.8975, lon: -1.7603 }, roads: { main: "Liberation Road", cross: "Market Circle Road" }, bearing: 80,
    costOfLiving: 1.0, crowd: 0.7, traffic: 0.65, nightlife: 0.6, palette: "coast", landmark: "Market Circle",
    places: [
      station("takoradi_station", "Takoradi Station", "Buses to Accra, Kumasi and Elubo; trotros along the coast."),
      { id: "market_circle", name: "Market Circle", kind: "market", services: ["market_haggle", "fante_kenkey"], blurb: "The round market at the heart of Takoradi.", geo: { lat: 4.8968, lon: -1.7556 } },
      { id: "nzema_kitchen", name: "Nzema Kitchen", kind: "food", services: ["akyeke", "fante_kenkey", "abenkwan"], open: [7, 21], blurb: "Akyeke with fried fish and fresh avocado." },
      { id: "takoradi_harbour", name: "Takoradi Harbour", kind: "work", open: [6, 20], blurb: "Ghana's first deep-water port: cocoa, manganese and oil-rig supply ships." },
      { id: "oilfield_services", name: "Offshore Services Base", kind: "work", open: [6, 20], blurb: "Logistics, welding and safety for the Jubilee oilfield." },
      { id: "takoradi_melcom", name: "Melcom Takoradi", kind: "shop", open: [8, 21], blurb: "Everything for the house." },
      { id: "effia_hospital", name: "Effia-Nkwanta Regional Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "takoradi_bank", name: "Coastline Bank (Takoradi)", kind: "bank", open: [8, 17], blurb: "Accounts and the FX desk." },
      lodge("takoradi_lodge", "Harbour View Guesthouse"),
      tour("takoradi_tours", "Western Tours", "takoradi", "Busua, Nzulezu, Ankasa and the Kundum festival."),
      { id: "takoradi_beach_bar", name: "Beach Road Lounge", kind: "nightlife", services: ["beach_bar", "club"], open: [16, 3], blurb: "Oil money, highlife and grilled lobster.", beach: true },
    ],
  },
  {
    id: "ho", city: "ho", name: "Ho", tagline: "Hills, kente and Ewe hospitality", mood: "A green, hilly town under Mount Adaklu. Akple, palm wine and choirs.",
    style: "town", geo: { lat: 6.6008, lon: 0.4713 }, roads: { main: "Ho–Accra Road", cross: "Kpando Road" }, bearing: 0,
    costOfLiving: 0.75, crowd: 0.55, traffic: 0.5, nightlife: 0.45, palette: "forest", landmark: "Mount Adaklu",
    places: [
      station("ho_station", "Ho Main Station", "Buses to Accra; trotros to Hohoe, Kpando and Aflao."),
      { id: "ho_market", name: "Ho Central Market", kind: "market", services: ["market_haggle", "abolo"], blurb: "Kente from Agotime, smoked fish, gari and garden eggs." },
      { id: "ho_chop", name: "Mama Dzifa's Akple Spot", kind: "food", services: ["akple", "abolo", "red_red", "lake_fish"], open: [8, 21], blurb: "Akple with okro soup and crab claws." },
      { id: "uhas", name: "University of Health & Allied Sciences", kind: "school", services: ["course"], open: [8, 20], blurb: "UHAS: nurses, doctors and pharmacists." },
      { id: "ho_hospital", name: "Ho Teaching Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "ho_church", name: "E.P. Church, Ho", kind: "church", services: ["church"], open: [6, 20], blurb: "Evangelical Presbyterian hymns in Ewe." },
      { id: "ho_melcom", name: "Melcom Ho", kind: "shop", open: [8, 21], blurb: "Household goods." },
      lodge("ho_lodge", "Adaklu View Lodge"),
      tour("ho_tours", "Volta Tours", "ho", "Wli falls, Mount Afadja, Tafi Atome, Keta, Akosombo and Hogbetsotso."),
      { id: "ho_shrine", name: "Traditional Shrine, Ho-Bankoe", kind: "shrine", services: ["libation"], open: [6, 18], blurb: "Ewe traditional shrine. Ask the priest before you enter." },
      { id: "ho_palm_wine", name: "Palm Wine Joint", kind: "nightlife", services: ["palm_wine"], open: [10, 22], blurb: "Tapped this morning." },
    ],
  },
  {
    id: "koforidua", city: "koforidua", name: "Koforidua", tagline: "Beads, hills and Kwahu Easter", mood: "Capital of the Eastern Region: bead market, Jackson Park and the road to the mountains.",
    style: "town", geo: { lat: 6.094, lon: -0.2591 }, roads: { main: "Accra Road", cross: "Jackson Park Road" }, bearing: 20,
    costOfLiving: 0.85, crowd: 0.6, traffic: 0.6, nightlife: 0.45, palette: "forest", landmark: "Jackson Park",
    places: [
      station("kof_station", "Koforidua Main Station", "Buses to Accra and Kumasi; trotros to Boti, Somanya and Nkawkaw."),
      { id: "bead_market", name: "Koforidua Bead Market", kind: "market", services: ["market_haggle"], open: [7, 18], blurb: "Krobo glass beads, recycled bottles reborn. Busiest on Thursdays." },
      { id: "kof_chop", name: "Auntie Abena's Chop Bar", kind: "food", services: ["abenkwan", "ampesi", "kokonte", "palm_wine"], open: [8, 21], blurb: "Fufu, kokonte and palm wine from the hills." },
      { id: "jackson_park", name: "Jackson Park", kind: "landmark", services: ["view", ...festsIn("koforidua")], blurb: "The town's green heart, venue of every rally and concert." },
      { id: "ktu", name: "Koforidua Technical University", kind: "school", services: ["course"], open: [8, 20], blurb: "Engineering, fashion and hospitality." },
      { id: "kof_hospital", name: "Eastern Regional Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
      { id: "kof_melcom", name: "Melcom Koforidua", kind: "shop", open: [8, 21], blurb: "Household goods." },
      lodge("kof_lodge", "Hilltop Guesthouse"),
      tour("kof_tours", "Eastern Tours", "koforidua", "Boti Falls, Umbrella Rock, Aburi, Akosombo, Kwahu paragliding, Odwira and Ngmayem."),
    ],
  },
  {
    id: "sefwi_wiawso", city: "sefwi_wiawso", name: "Sefwi Wiawso", tagline: "Cocoa and timber country", mood: "Deep forest, red earth and cocoa money every harvest.",
    style: "town", geo: { lat: 6.2058, lon: -2.4891 }, roads: { main: "Wiawso Road", cross: "Bibiani Road" }, bearing: 0,
    costOfLiving: 0.65, crowd: 0.45, traffic: 0.4, nightlife: 0.25, palette: "forest", landmark: "Cocoa sheds",
    places: [
      station("wiawso_station", "Wiawso Station", "Trotros to Bibiani, Juaboso and Kumasi."),
      { id: "wiawso_market", name: "Wiawso Market", kind: "market", services: ["market_haggle", "roasted_plantain"], blurb: "Plantain, cocoyam, snails and bush meat." },
      { id: "wiawso_chop", name: "Forest Chop Bar", kind: "food", services: ["abenkwan", "ampesi", "abunuabunu"], open: [8, 21], blurb: "Snail and mushroom light soup." },
      { id: "cocoa_shed", name: "Cocoa Purchasing Shed", kind: "work", open: [7, 17], blurb: "Weigh, grade and bag farmers' dried beans for COCOBOD." },
      lodge("wiawso_lodge", "Forest Rest Lodge"),
      tour("wiawso_tours", "Forest Trips", "sefwi_wiawso", "Bia National Park and cocoa farm visits."),
      { id: "wiawso_clinic", name: "Sefwi Wiawso Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Snakebite serum always in stock." },
      { id: "wiawso_church", name: "Methodist Church, Wiawso", kind: "church", services: ["church"], open: [6, 20], blurb: "Harvest thanksgiving is the event of the year." },
    ],
  },
  {
    id: "goaso", city: "goaso", name: "Goaso", tagline: "Gold, cocoa and forest", mood: "Capital of Ahafo. Miners, cocoa farmers and timber trucks.",
    style: "town", geo: { lat: 6.8036, lon: -2.5172 }, roads: { main: "Goaso–Kumasi Road", cross: "Mim Road" }, bearing: 0,
    costOfLiving: 0.65, crowd: 0.4, traffic: 0.4, nightlife: 0.25, palette: "forest", landmark: "Goaso forest",
    places: [
      station("goaso_station", "Goaso Station", "Trotros to Kumasi, Sunyani and Kenyasi."),
      { id: "goaso_market", name: "Goaso Market", kind: "market", services: ["market_haggle", "roasted_plantain"], blurb: "Forest produce and mining-town prices." },
      { id: "goaso_chop", name: "Ahafo Chop Bar", kind: "food", services: ["abenkwan", "abunuabunu", "ampesi"], open: [8, 21], blurb: "Fufu and palm soup." },
      { id: "goaso_cocoa", name: "Ahafo Cocoa Shed", kind: "work", open: [7, 17], blurb: "Buy and grade cocoa beans." },
      lodge("goaso_lodge", "Ahafo Guesthouse"),
      tour("goaso_tours", "Ahafo Trips", "goaso", "Cocoa farms and Bia forest."),
      { id: "goaso_clinic", name: "Goaso Municipal Hospital", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Open day and night." },
    ],
  },
  {
    id: "dambai", city: "dambai", name: "Dambai", tagline: "Where the lake crosses the road", mood: "Capital of Oti: ferries, fish and the Eastern Corridor.",
    style: "town", geo: { lat: 8.07, lon: 0.179 }, roads: { main: "Dambai–Nkwanta Road", cross: "Ferry Road" }, bearing: 0,
    costOfLiving: 0.6, crowd: 0.4, traffic: 0.35, nightlife: 0.2, palette: "forest", landmark: "Dambai ferry",
    places: [
      station("dambai_station", "Dambai Ferry Landing", "Ferries across Lake Volta; trotros to Nkwanta, Jasikan and Hohoe."),
      { id: "dambai_market", name: "Dambai Fish Market", kind: "market", services: ["market_haggle"], blurb: "Lake tilapia, smoked herrings and yam." },
      { id: "dambai_chop", name: "Lakeside Chop", kind: "food", services: ["lake_fish", "akple", "fried_yam"], open: [8, 21], blurb: "Tilapia from the lake this morning." },
      lodge("dambai_lodge", "Lakeview Lodge"),
      tour("dambai_tours", "Oti Trips", "dambai", "The Volta ferry, Kyabobo park and the New Yam Festival."),
      { id: "dambai_clinic", name: "Dambai Health Centre", kind: "clinic", services: ["clinic", "pharmacy"], blurb: "Nurses and a pharmacy." },
      { id: "dambai_church", name: "Catholic Church, Dambai", kind: "church", services: ["church"], open: [6, 20], blurb: "Mass, then the market." },
    ],
  },
];

const NO_REALTOR = new Set(["jamestown", "airport_city"]);
const BIG_TOWNS = new Set(["airport_city", "adum", "tamale", "takoradi", "sunyani", "ho", "koforidua", "techiman", "bolgatanga", "wa", "kintampo"]);
for (const t of TOWNS_SPEC) {
  const short = t.name.split(/[ &-]/)[0];
  if (!NO_REALTOR.has(t.id)) t.places.push({ id: `${t.id}_realtor`, name: `${short} Land & Homes`, kind: "realtor", open: [8, 18], size: [9, 8, 5], blurb: "Plots with proper indentures, houses for rent, and a surveyor who answers his phone." });
  if (BIG_TOWNS.has(t.id)) t.places.push({ id: `${t.id}_phones`, name: `${short} Phone Centre`, kind: "phone", open: [8, 21], size: [8, 7, 4], blurb: "Phones, chargers, screen guards and someone who can unlock anything." });
}

export const REGIONAL_DISTRICTS: District[] = TOWNS_SPEC.map((t) => ({
  id: t.id, name: t.name, tagline: t.tagline, mood: t.mood, style: t.style, city: t.city, geo: t.geo, roads: t.roads, bearing: t.bearing,
  costOfLiving: t.costOfLiving, crowd: t.crowd, traffic: t.traffic, nightlife: t.nightlife, palette: PAL[t.palette], landmark: t.landmark, prestige: 0,
}));

export const REGIONAL_PLACES: Place[] = TOWNS_SPEC.flatMap(layout);

// ---------------------------------------------------------------------------
// Jobs in the regions.

const J = (j: Job) => j;
export const REGIONAL_JOBS: Record<string, Job> = {
  kejetia_trader: J({ id: "kejetia_trader", title: "Kejetia shop assistant", placeId: "kejetia_market", pay: 110, hours: 8, shiftWindow: [6, 11], requires: {}, energyCost: 30, skillGain: { business: 1, charisma: 1 }, blurb: "Sell cloth for Auntie Akua and learn to haggle in Twi." }),
  fitter: J({ id: "fitter", title: "Fitting shop apprentice", placeId: "suame_magazine", pay: 95, hours: 8, shiftWindow: [7, 11], requires: {}, energyCost: 36, skillGain: { work: 2, fitness: 1 }, blurb: "Engines, gearboxes and grease. Master Kwaku shouts, but he teaches." }),
  shea_processor: J({ id: "shea_processor", title: "Shea butter processor", placeId: "shea_coop", pay: 85, hours: 7, shiftWindow: [6, 10], requires: {}, energyCost: 34, skillGain: { fitness: 1, business: 1 }, blurb: "Roast, grind and knead nuts into butter with the co-op women." }),
  waterfall_guide: J({ id: "waterfall_guide", title: "Waterfalls tour guide", placeId: "kintampo_falls_gate", pay: 120, hours: 6, shiftWindow: [7, 11], requires: { charisma: 8 }, energyCost: 26, skillGain: { charisma: 2, fitness: 1 }, blurb: "Lead visitors down the steps and tell the legend of the falls." }),
  yam_loader: J({ id: "yam_loader", title: "Yam truck loader", placeId: "kintampo_yam", pay: 95, hours: 6, shiftWindow: [5, 10], requires: {}, energyCost: 40, skillGain: { fitness: 2 }, blurb: "Pack tubers into a truck bound for Agbogbloshie." }),
  cashew_clerk: J({ id: "cashew_clerk", title: "Cashew warehouse clerk", placeId: "sunyani_cashew", pay: 160, hours: 8, shiftWindow: [7, 10], weekdaysOnly: true, requires: { work: 10 }, energyCost: 24, skillGain: { work: 1, business: 1 }, blurb: "Grade nuts, weigh bags, keep the ledger straight." }),
  cashew_buyer: J({ id: "cashew_buyer", title: "Cashew buying agent", placeId: "bole_cashew", pay: 140, hours: 7, shiftWindow: [7, 10], requires: { business: 6 }, energyCost: 26, skillGain: { business: 2 }, blurb: "Weigh farmers' nuts and pay out fairly. Fairness is your brand." }),
  harbour_clerk: J({ id: "harbour_clerk", title: "Harbour tally clerk", placeId: "takoradi_harbour", pay: 230, hours: 8, shiftWindow: [6, 10], salaried: true, weekdaysOnly: true, requires: { work: 15 }, energyCost: 28, skillGain: { work: 2 }, blurb: "Count every bag of cocoa and tonne of manganese onto the ships." }),
  rig_technician: J({ id: "rig_technician", title: "Offshore technician", placeId: "oilfield_services", pay: 900, hours: 10, shiftWindow: [5, 8], salaried: true, requires: { work: 45, fitness: 25 }, energyCost: 45, skillGain: { work: 3, fitness: 1 }, blurb: "Two weeks on the rig, two weeks off. The money is serious." }),
  cocoa_clerk: J({ id: "cocoa_clerk", title: "Cocoa purchasing clerk", placeId: "cocoa_shed", pay: 150, hours: 8, shiftWindow: [7, 10], requires: { work: 8 }, energyCost: 24, skillGain: { business: 1, work: 1 }, blurb: "Moisture meter, scale and the farmers' trust." }),
  ahafo_cocoa_clerk: J({ id: "ahafo_cocoa_clerk", title: "Cocoa purchasing clerk", placeId: "goaso_cocoa", pay: 150, hours: 8, shiftWindow: [7, 10], requires: { work: 8 }, energyCost: 24, skillGain: { business: 1, work: 1 }, blurb: "Weigh and grade the season's beans." }),
  teacher_tamale: J({ id: "teacher_tamale", title: "Teaching assistant", placeId: "uds_tamale", pay: 210, hours: 7, shiftWindow: [7, 9], weekdaysOnly: true, salaried: true, requires: { work: 20 }, energyCost: 26, skillGain: { work: 1, charisma: 2 }, blurb: "Tutorials for first-year students." }),
  park_ranger: J({ id: "park_ranger", title: "Park ranger assistant", placeId: "mole_desk", pay: 140, hours: 8, shiftWindow: [5, 8], requires: { fitness: 15 }, energyCost: 36, skillGain: { fitness: 2, charisma: 1 }, blurb: "Escort walking safaris and count elephants at the waterhole." }),
  basket_weaver: J({ id: "basket_weaver", title: "Basket weaver", placeId: "bolga_crafts", pay: 90, hours: 7, shiftWindow: [7, 12], requires: {}, energyCost: 22, skillGain: { business: 1, charisma: 1 }, blurb: "Twist dyed elephant grass into the famous Bolga baskets." }),
  bead_maker: J({ id: "bead_maker", title: "Bead maker", placeId: "bead_market", pay: 100, hours: 7, shiftWindow: [7, 12], requires: {}, energyCost: 22, skillGain: { business: 1, charisma: 1 }, blurb: "Crush bottles, fill clay moulds, fire the kiln, string the beads." }),
  lodge_receptionist: J({ id: "lodge_receptionist", title: "Lodge receptionist", placeId: "cape_lodge", pay: 120, hours: 8, shiftWindow: [6, 14], requires: { charisma: 6 }, energyCost: 22, skillGain: { charisma: 1, business: 1 }, blurb: "Check in tourists and find them a taxi to Kakum." }),
};
