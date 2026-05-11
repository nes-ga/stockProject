import type { StockUniverseItem } from "../types.js";

export type CorporateAliasProfile = {
  code: string;
  aliases: string[];
};

export const corporateAliasProfiles: CorporateAliasProfile[] = [
  {
    code: "036570",
    aliases: ["엔씨소프트", "NCSOFT", "NCsoft", "NC Soft", "NC소프트", "엔씨", "NC"]
  },
  {
    code: "042660",
    aliases: ["한화오션", "대우조선해양", "DSME"]
  }
];

const corporateAliasByCode = new Map(corporateAliasProfiles.map((profile) => [profile.code, profile]));

export function normalizeCorporateName(value: string): string {
  return value.replace(/[^0-9A-Z\uAC00-\uD7A3]+/giu, "").toUpperCase();
}

function appendUnique(values: string[], value: string | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || values.some((item) => normalizeCorporateName(item) === normalizeCorporateName(normalized))) {
    return;
  }

  values.push(normalized);
}

export function getCorporateAliasCandidates(item: Pick<StockUniverseItem, "code" | "name" | "aliases">): string[] {
  const candidates: string[] = [];
  appendUnique(candidates, item.name);

  for (const alias of item.aliases ?? []) {
    appendUnique(candidates, alias);
  }

  for (const alias of corporateAliasByCode.get(item.code)?.aliases ?? []) {
    appendUnique(candidates, alias);
  }

  return candidates;
}

export function applyCorporateAliasesToUniverseItem(item: StockUniverseItem): StockUniverseItem {
  const candidates = getCorporateAliasCandidates(item);
  const aliases = candidates.filter((candidate) => normalizeCorporateName(candidate) !== normalizeCorporateName(item.name));

  return {
    ...item,
    aliases
  };
}

export function buildCorporateNameLookup(items: StockUniverseItem[]) {
  const lookup = new Map<string, StockUniverseItem>();

  for (const item of items) {
    for (const candidate of getCorporateAliasCandidates(item)) {
      lookup.set(`${item.market}:${normalizeCorporateName(candidate)}`, item);
    }
  }

  return lookup;
}
