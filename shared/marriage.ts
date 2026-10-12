// Marriage, the Ghanaian way: you propose, your family goes to knock at their
// family's door, and the families conclude the customary marriage (or the
// nikah) in the partner's hometown. A church wedding or walima feast can
// follow if you like. Customs vary by region and faith; the steps and wording
// here are deliberately general and want review by people from each tradition.
import { TOWN_BY_ID, type RegionId } from "./ghana.ts";

/** Where each possible partner's family lives, and their faith (affects the ceremony). */
export const PARTNER_ROOTS: Record<string, { hometown: string; faith: "christian" | "muslim" }> = {
  akosua: { hometown: "kumasi", faith: "christian" },
  selasi: { hometown: "ho", faith: "christian" },
  efua: { hometown: "accra", faith: "christian" },
  fuseini: { hometown: "tamale", faith: "muslim" },
  akua_sarpong: { hometown: "sefwi_wiawso", faith: "christian" },
  ewurabena: { hometown: "cape_coast", faith: "christian" },
};

export const PROPOSAL_RING = 800;
export const KNOCKING_COST = 600;
export const CUSTOMARY_BASE = 6_000;
export const CELEBRATION_BASE = 15_000;
/** Days the family needs between the knocking and the ceremony to prepare. */
export const KNOCK_TO_CEREMONY_DAYS = 3;

export interface Custom {
  knocking: string;
  knockingText: string;
  ceremony: string;
  ceremonyText: string;
  celebration: string;
  celebrationText: string;
}

const AKAN: RegionId[] = ["ashanti", "eastern", "bono", "bono_east", "ahafo", "central", "western", "western_north"];

export function customFor(npcId: string, fallbackCity: string): Custom {
  const roots = PARTNER_ROOTS[npcId] ?? { hometown: fallbackCity, faith: "christian" as const };
  const region = TOWN_BY_ID[roots.hometown]?.region ?? "greater_accra";
  const muslim = roots.faith === "muslim";
  const knocking = AKAN.includes(region) ? "Kɔkɔɔkɔ (the knocking)" : "The knocking";
  const knockingText = "Your family goes with you to their family's house with drinks and an envelope, to ask, formally, to come in. The elders talk; you mostly keep quiet.";
  if (muslim) {
    return {
      knocking, knockingText,
      ceremony: "Nikah", ceremonyText: "The families meet with the imam; the mahr (sadaki) is agreed and given, prayers are said, and you are married.",
      celebration: "Walima feast", celebrationText: "Rice, meat and drumming for both families and half the neighbourhood.",
    };
  }
  const list =
    AKAN.includes(region) ? "the family's list: drinks, cloth, jewellery and the tiri nsa (head drink)"
    : region === "volta" || region === "oti" ? "the family's list, drinks and cloth; Ewe kente on the day"
    : region === "greater_accra" ? "the family's list, drinks and cloth; kaba and slit, the elders' prayers"
    : region === "upper_east" || region === "upper_west" ? "the bride-wealth, traditionally cattle and cowries, now often cash, with drinks for the elders"
    : "the family's list, drinks and cloth";
  return {
    knocking, knockingText,
    ceremony: "Customary marriage", ceremonyText: `The families meet in their hometown; ${list}. Questions, laughter, the families' blessing, and you are married.`,
    celebration: "Church wedding", celebrationText: "The white wedding: the church service, the reception, the photographs, the first dance.",
  };
}

export const partnerHometown = (npcId: string, fallbackCity: string) => PARTNER_ROOTS[npcId]?.hometown ?? fallbackCity;
