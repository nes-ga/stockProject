import type { ThemeGroup, ThemeName } from "../types.js";

export const themeGroups: ThemeGroup[] = [
  {
    name: "AI",
    label: "AI / 플랫폼",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["035420", "035720", "181710", "304100", "041020"],
    members: [
      { symbol: "035420", name: "NAVER" },
      { symbol: "035720", name: "카카오" },
      { symbol: "181710", name: "NHN" },
      { symbol: "304100", name: "솔트룩스" },
      { symbol: "041020", name: "폴라리스오피스" }
    ]
  },
  {
    name: "Semiconductor",
    label: "반도체",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["005930", "000660", "042700", "000990", "058470", "403870"],
    members: [
      { symbol: "005930", name: "삼성전자" },
      { symbol: "000660", name: "SK하이닉스" },
      { symbol: "042700", name: "한미반도체" },
      { symbol: "000990", name: "DB하이텍" },
      { symbol: "058470", name: "리노공업" },
      { symbol: "403870", name: "HPSP" }
    ]
  },
  {
    name: "Battery",
    label: "2차전지",
    category: "Growth",
    benchmark: "KOSDAQ",
    tickers: ["373220", "006400", "003670", "086520", "247540", "066970"],
    members: [
      { symbol: "373220", name: "LG에너지솔루션" },
      { symbol: "006400", name: "삼성SDI" },
      { symbol: "003670", name: "포스코퓨처엠" },
      { symbol: "086520", name: "에코프로" },
      { symbol: "247540", name: "에코프로비엠" },
      { symbol: "066970", name: "엘앤에프" }
    ]
  },
  {
    name: "AutoIndustrial",
    label: "자동차 / 산업재",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["005380", "000270", "012330", "241560", "042670", "064350"],
    members: [
      { symbol: "005380", name: "현대차" },
      { symbol: "000270", name: "기아" },
      { symbol: "012330", name: "현대모비스" },
      { symbol: "241560", name: "두산밥캣" },
      { symbol: "042670", name: "HD현대인프라코어" },
      { symbol: "064350", name: "현대로템" }
    ]
  },
  {
    name: "Defense",
    label: "방산 / 항공우주",
    category: "Defensive",
    benchmark: "KOSPI",
    tickers: ["012450", "079550", "047810", "272210", "064350", "103140"],
    members: [
      { symbol: "012450", name: "한화에어로스페이스" },
      { symbol: "079550", name: "LIG넥스원" },
      { symbol: "047810", name: "한국항공우주" },
      { symbol: "272210", name: "한화시스템" },
      { symbol: "064350", name: "현대로템" },
      { symbol: "103140", name: "풍산" }
    ]
  },
  {
    name: "Materials",
    label: "철강 / 화학",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["005490", "004020", "010130", "011170", "011780", "051910"],
    members: [
      { symbol: "005490", name: "POSCO홀딩스" },
      { symbol: "004020", name: "현대제철" },
      { symbol: "010130", name: "고려아연" },
      { symbol: "011170", name: "롯데케미칼" },
      { symbol: "011780", name: "금호석유" },
      { symbol: "051910", name: "LG화학" }
    ]
  },
  {
    name: "Construction",
    label: "건설 / 인프라",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["000720", "006360", "375500", "294870", "034020", "052690"],
    members: [
      { symbol: "000720", name: "현대건설" },
      { symbol: "006360", name: "GS건설" },
      { symbol: "375500", name: "DL이앤씨" },
      { symbol: "294870", name: "HDC현대산업개발" },
      { symbol: "034020", name: "두산에너빌리티" },
      { symbol: "052690", name: "한전기술" }
    ]
  },
  {
    name: "Consumer",
    label: "소비 / 화장품",
    category: "Cyclical",
    benchmark: "KOSPI",
    tickers: ["090430", "051900", "383220", "008770", "271560", "282330"],
    members: [
      { symbol: "090430", name: "아모레퍼시픽" },
      { symbol: "051900", name: "LG생활건강" },
      { symbol: "383220", name: "F&F" },
      { symbol: "008770", name: "호텔신라" },
      { symbol: "271560", name: "오리온" },
      { symbol: "282330", name: "BGF리테일" }
    ]
  },
  {
    name: "Healthcare",
    label: "헬스케어 / 바이오",
    category: "Defensive",
    benchmark: "KOSDAQ",
    tickers: ["207940", "068270", "000100", "128940", "196170", "298380"],
    members: [
      { symbol: "207940", name: "삼성바이오로직스" },
      { symbol: "068270", name: "셀트리온" },
      { symbol: "000100", name: "유한양행" },
      { symbol: "128940", name: "한미약품" },
      { symbol: "196170", name: "알테오젠" },
      { symbol: "298380", name: "에이비엘바이오" }
    ]
  },
  {
    name: "Staples",
    label: "필수소비재",
    category: "Defensive",
    benchmark: "KOSPI",
    tickers: ["033780", "004370", "280360", "001680", "007070", "097950"],
    members: [
      { symbol: "033780", name: "KT&G" },
      { symbol: "004370", name: "농심" },
      { symbol: "280360", name: "롯데웰푸드" },
      { symbol: "001680", name: "대상" },
      { symbol: "007070", name: "GS리테일" },
      { symbol: "097950", name: "CJ제일제당" }
    ]
  },
  {
    name: "Financial",
    label: "금융",
    category: "Macro",
    benchmark: "KOSPI",
    tickers: ["105560", "055550", "086790", "316140", "138040", "000810"],
    members: [
      { symbol: "105560", name: "KB금융" },
      { symbol: "055550", name: "신한지주" },
      { symbol: "086790", name: "하나금융지주" },
      { symbol: "316140", name: "우리금융지주" },
      { symbol: "138040", name: "메리츠금융지주" },
      { symbol: "000810", name: "삼성화재" }
    ]
  },
  {
    name: "Energy",
    label: "에너지 / 전력",
    category: "Macro",
    benchmark: "KOSPI",
    tickers: ["015760", "010120", "267260", "298040", "034020", "010950"],
    members: [
      { symbol: "015760", name: "한국전력" },
      { symbol: "010120", name: "LS ELECTRIC" },
      { symbol: "267260", name: "HD현대일렉트릭" },
      { symbol: "298040", name: "효성중공업" },
      { symbol: "034020", name: "두산에너빌리티" },
      { symbol: "010950", name: "S-Oil" }
    ]
  }
];

export const themeGroupByName = new Map<ThemeName, ThemeGroup>(themeGroups.map((group) => [group.name, group]));

export function getThemeGroupByName(name: ThemeName) {
  return themeGroupByName.get(name);
}
