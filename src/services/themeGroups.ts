import type { ThemeGroup, ThemeName } from "../types.js";

export const themeGroups: ThemeGroup[] = [
  {
    name: "AI",
    label: "AI / 플랫폼",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["035420", "035720", "181710", "304100", "041020"]
  },
  {
    name: "Semiconductor",
    label: "반도체",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["005930", "000660", "042700", "000990", "058470", "403870"]
  },
  {
    name: "Battery",
    label: "2차전지",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["373220", "006400", "003670", "086520", "247540", "066970"]
  },
  {
    name: "AutoIndustrial",
    label: "자동차 / 산업재",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["005380", "000270", "012330", "241560", "042670", "064350"]
  },
  {
    name: "Materials",
    label: "철강 / 화학",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["005490", "004020", "010130", "011170", "011780", "051910"]
  },
  {
    name: "Construction",
    label: "건설 / 인프라",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["000720", "006360", "375500", "294870", "034020", "052690"]
  },
  {
    name: "Consumer",
    label: "소비 / 코스메틱",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["090430", "051900", "383220", "008770", "271560", "282330"]
  },
  {
    name: "Healthcare",
    label: "헬스케어 / 바이오",
    category: "Defensive",
    benchmark: "KOSDAQ",
    tickers: ["207940", "068270", "000100", "128940", "196170", "298380"]
  },
  {
    name: "Staples",
    label: "필수소비재",
    category: "Defensive",
    benchmark: "KOSPI",
    tickers: ["033780", "004370", "280360", "001680", "007070", "097950"]
  },
  {
    name: "Financial",
    label: "금융",
    category: "Macro",
    benchmark: "KOSPI",
    tickers: ["105560", "055550", "086790", "316140", "138040", "000810"]
  },
  {
    name: "Energy",
    label: "에너지 / 전력",
    category: "Macro",
    benchmark: "KOSPI",
    tickers: ["015760", "010120", "267260", "298040", "034020", "010950"]
  }
];

export const themeGroupByName = new Map<ThemeName, ThemeGroup>(themeGroups.map((group) => [group.name, group]));

export function getThemeGroupByName(name: ThemeName) {
  return themeGroupByName.get(name);
}
