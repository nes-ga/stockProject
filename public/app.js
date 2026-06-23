import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers
} from "/vendor/lightweight-charts/lightweight-charts.standalone.production.mjs";

const STORAGE_KEY = "stock-project-recommendations-v2";
const LEGACY_STORAGE_KEY = "band-stock-recommendations-v2";
const UI_STATE_STORAGE_KEY = "stock-project-ui-state-v1";
const SCAN_STATE_STORAGE_KEY = "stock-project-recommendation-scan-state-v1";
const PAGE_SIZE_ALL = 999;
const DEFAULT_CATEGORY = "longTerm";
const DIVIDEND_CATEGORY = "dividend";
const DEFAULT_LONG_TERM_BUCKET = "buy";
const DEFAULT_SWING_BUCKET = "execution";
const DEFAULT_SWING_PROFILE = "default";
const SWING_LOOKBACK_DAYS = 45;
const SERVER_RECOMMENDATION_REFRESH_INTERVAL_MS = 60 * 1000;
const RECOMMENDATION_SCAN_POLL_INTERVAL_MS = 3000;
const DEFAULT_VISIBLE_TRADING_SESSIONS = 45;
const CHART_RIGHT_ANCHOR_OFFSET = 0.5;
const MIN_VISIBLE_TRADING_SESSIONS = 12;
const WHEEL_ZOOM_STEP = 1.18;
const DEFAULT_VISIBLE_MARKET_WATCH_SESSIONS = {
  minute1: 90,
  minute5: 78,
  minute30: 26,
  minute60: 20,
  daily: 45,
  weekly: 52,
  yearly: 8
};
const SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 10 * 1000;
const LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS = 30 * 1000;
const ACTIVE_ANALYSIS_REFRESH_INTERVAL_MS = 5 * 1000;
const MARKET_WATCH_REFRESH_INTERVAL_MS = 15 * 1000;
const MARKET_WATCH_MODAL_REFRESH_INTERVAL_MS = 7 * 1000;
const MARKET_FLOW_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const ONLINE_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000;
const DEFAULT_MARKET_FLOW_RANGE = "6M";
const MARKET_FLOW_CHART_RANGES = ["3M", "6M", "1Y", "2Y"];
const APP_VIEWS = ["news", "index", "history", "analysis", "movers"];
const PAGE_SIZE_OPTIONS = new Set([5, 10, PAGE_SIZE_ALL]);
const CLOSED_HISTORY_OUTCOME_FILTERS = new Set(["all", "profit", "loss", "other"]);
const HANGUL_BASE = 44032;
const HANGUL_END = 55203;
const CHOSUNG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ"
];

const defaultRecommendationCatalog = [
  {
    key: "엔씨소프트",
    name: "엔씨소프트",
    symbol: "036570",
    anchorDate: "2026-03-22",
    note: "215000원 이하 1차매수",
    longTermInsightNote: "안정화 더 필요 | 총점 77점 | 낙폭 76% | 실적 둔화 | 바닥 미완성",
    longTermInsightKeywords: ["안정화 필요", "총점 77점", "낙폭 76%", "실적 둔화", "바닥 미완성"]
  },
  {
    key: "TIGER 미국30년국채커버드콜액티브(H)",
    name: "TIGER 미국30년국채커버드콜액티브(H)",
    symbol: "476550",
    anchorDate: "2026-03-12",
    note: "7445원 1차매수",
    longTermInsightNote: "엔진 제외 | 조정 부족 | 대표성 부족 | 바닥 미완성",
    longTermInsightKeywords: ["엔진 제외", "조정 부족", "대표성 부족", "바닥 미완성"]
  },
  {
    key: "포스코DX",
    name: "포스코DX",
    symbol: "022100",
    anchorDate: "2026-03-12",
    latestMentionDate: "2026-03-12",
    note: "31550원 이하 1차매수",
    longTermInsightNote: "깊은 조정 재검토 | 총점 79점 | 낙폭 44% | 실적 개선 | 바닥 미완성",
    longTermInsightKeywords: ["깊은 조정", "총점 79점", "낙폭 44%", "실적 개선", "바닥 미완성"]
  },
  {
    key: "CJ대한통운",
    name: "CJ대한통운",
    symbol: "000120",
    anchorDate: "2026-03-05",
    note: "112800원 이하 1차매수",
    longTermInsightNote: "대표주 조정 관찰 | 총점 80점 | 낙폭 31% | 실적 개선 | 바닥 형성 중",
    longTermInsightKeywords: ["대표주 조정", "총점 80점", "낙폭 31%", "실적 개선", "바닥 형성 중"]
  },
  {
    key: "제우스",
    name: "제우스",
    symbol: "079370",
    anchorDate: "2026-03-02",
    latestMentionDate: "2026-03-05",
    note: "17600원 아래 분할매수",
    longTermInsightNote: "엔진 제외 | 적자 심화 | 낙폭 27% | 바닥 미완성",
    longTermInsightKeywords: ["엔진 제외", "적자 심화", "낙폭 27%", "바닥 미완성"]
  },
  {
    key: "나무가",
    name: "나무가",
    symbol: "190510",
    anchorDate: "2026-02-27",
    latestMentionDate: "2026-03-05",
    note: "22500원 이하 1차매수",
    longTermInsightNote: "안정화 더 필요 | 총점 65점 | 낙폭 40% | 실적 개선 | 바닥 미완성",
    longTermInsightKeywords: ["안정화 필요", "총점 65점", "낙폭 40%", "실적 개선", "바닥 미완성"]
  },
  {
    key: "OCI",
    name: "OCI",
    symbol: "456040",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록",
    longTermInsightNote: "엔진 제외 | 적자 심화 | 낙폭 43% | 바닥 형성 중",
    longTermInsightKeywords: ["엔진 제외", "적자 심화", "낙폭 43%", "바닥 형성 중"]
  },
  {
    key: "아모레퍼시픽",
    name: "아모레퍼시픽",
    symbol: "090430",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록",
    longTermInsightNote: "대표주 조정 관찰 | 총점 83점 | 낙폭 34% | 실적 개선 | 바닥 형성 중",
    longTermInsightKeywords: ["대표주 조정", "총점 83점", "낙폭 34%", "실적 개선", "바닥 형성 중"]
  },
  {
    key: "KODEX 2차전지산업레버리지",
    name: "KODEX 2차전지산업레버리지",
    symbol: "462330",
    anchorDate: "2025-07-28",
    note: "AS 글에서 삭제 전 목록",
    longTermInsightNote: "엔진 제외 | 대표성 부족 | 낙폭 62% | 실적 둔화",
    longTermInsightKeywords: ["엔진 제외", "대표성 부족", "낙폭 62%", "실적 둔화"]
  },
  {
    key: "셀트리온제약",
    name: "셀트리온제약",
    symbol: "068760",
    anchorDate: "2025-07-25",
    note: "53700원 이하 또는 다음날 시가 이하",
    longTermInsightNote: "안정화 더 필요 | 총점 66점 | 낙폭 49% | 실적 개선 | 바닥 미완성",
    longTermInsightKeywords: ["안정화 필요", "총점 66점", "낙폭 49%", "실적 개선", "바닥 미완성"]
  },
  {
    key: "엘앤에프",
    name: "엘앤에프",
    symbol: "066970",
    anchorDate: "2025-07-25",
    note: "64500원 이하 1차매수",
    longTermInsightNote: "엔진 제외 | 부채 부담 | 낙폭 47% | 실적 둔화",
    longTermInsightKeywords: ["엔진 제외", "부채 부담", "낙폭 47%", "실적 둔화"]
  },
  {
    key: "에코프로비엠",
    name: "에코프로비엠",
    symbol: "247540",
    anchorDate: "2025-07-24",
    note: "112000원 이하 1차매수",
    longTermInsightNote: "대표주 조정 관찰 | 총점 77점 | 낙폭 33% | 실적 개선 | 바닥 형성 중",
    longTermInsightKeywords: ["대표주 조정", "총점 77점", "낙폭 33%", "실적 개선", "바닥 형성 중"]
  },
  {
    key: "네오위즈",
    name: "네오위즈",
    symbol: "095660",
    anchorDate: "2025-07-14",
    note: "최근추천 이후 AS 글 언급",
    longTermInsightNote: "엔진 제외 | 거래대금 부족 | 낙폭 26% | 실적 개선",
    longTermInsightKeywords: ["엔진 제외", "거래대금 부족", "낙폭 26%", "실적 개선"]
  },
  {
    key: "BGF리테일",
    name: "BGF리테일",
    symbol: "282330",
    anchorDate: "2025-07-28",
    note: "112500원 이하 1차매수",
    longTermInsightNote: "깊은 조정 재검토 | 총점 82점 | 낙폭 40% | 업황 안정화 | 바닥 형성 중",
    longTermInsightKeywords: ["깊은 조정", "총점 82점", "낙폭 40%", "업황 안정화", "바닥 형성 중"]
  },
  {
    key: "LG생활건강",
    name: "LG생활건강",
    symbol: "051900",
    anchorDate: "2025-07-15",
    note: "330000원 이하부터 손절가 구간까지",
    longTermInsightNote: "엔진 제외 | 사업 훼손 우려 | 낙폭 48% | 실적 둔화",
    longTermInsightKeywords: ["엔진 제외", "사업 훼손 우려", "낙폭 48%", "실적 둔화"]
  },
  {
    key: "삼성전자",
    name: "삼성전자",
    symbol: "005930",
    anchorDate: "2024-11-01",
    note: "59000원 이하 중기 1차매수",
    longTermInsightNote: "엔진 제외 | 조정 부족 | 낙폭 8% | 실적 개선",
    longTermInsightKeywords: ["엔진 제외", "조정 부족", "낙폭 8%", "실적 개선"]
  },
  {
    key: "오리온홀딩스",
    name: "오리온홀딩스",
    symbol: "001800",
    anchorDate: "2025-05-29",
    note: "박스권 저항대 돌파 여부 관찰",
    longTermInsightNote: "엔진 제외 | 조정 부족 | 거래대금 부족 | 실적 개선",
    longTermInsightKeywords: ["엔진 제외", "조정 부족", "거래대금 부족", "실적 개선"]
  },
  {
    key: "컴투스",
    name: "컴투스",
    symbol: "078340",
    anchorDate: "2024-08-29",
    note: "40050원 이하부터 손절가 구간 분할매수",
    longTermInsightNote: "엔진 제외 | 거래대금 부족 | 낙폭 37% | 실적 개선 | 바닥 형성 중",
    longTermInsightKeywords: ["엔진 제외", "거래대금 부족", "낙폭 37%", "실적 개선", "바닥 형성 중"]
  }
];

const stockMasterSeed = [
  { code: "005930", name: "삼성전자", market: "KOSPI", aliases: ["삼전"] },
  { code: "000660", name: "SK하이닉스", market: "KOSPI", aliases: ["하이닉스", "skh"] },
  { code: "035420", name: "NAVER", market: "KOSPI", aliases: ["네이버"] },
  { code: "005380", name: "현대차", market: "KOSPI", aliases: ["현차"] },
  { code: "012330", name: "현대모비스", market: "KOSPI", aliases: ["모비스"] },
  { code: "068270", name: "셀트리온", market: "KOSPI", aliases: [] },
  { code: "207940", name: "삼성바이오로직스", market: "KOSPI", aliases: ["삼바"] },
  { code: "373220", name: "LG에너지솔루션", market: "KOSPI", aliases: ["엘지엔솔", "lg엔솔"] },
  { code: "051910", name: "LG화학", market: "KOSPI", aliases: [] },
  { code: "006400", name: "삼성SDI", market: "KOSPI", aliases: [] },
  { code: "035720", name: "카카오", market: "KOSPI", aliases: [] },
  { code: "105560", name: "KB금융", market: "KOSPI", aliases: [] },
  { code: "055550", name: "신한지주", market: "KOSPI", aliases: [] },
  { code: "034020", name: "두산에너빌리티", market: "KOSPI", aliases: ["두빌"] },
  { code: "017670", name: "SK텔레콤", market: "KOSPI", aliases: ["에스케이텔레콤"] },
  { code: "032830", name: "삼성생명", market: "KOSPI", aliases: [] },
  { code: "086790", name: "하나금융지주", market: "KOSPI", aliases: ["하나금융"] },
  { code: "003550", name: "LG", market: "KOSPI", aliases: [] },
  { code: "028260", name: "삼성물산", market: "KOSPI", aliases: [] },
  { code: "066570", name: "LG전자", market: "KOSPI", aliases: [] },
  { code: "096770", name: "SK이노베이션", market: "KOSPI", aliases: ["sk이노"] },
  { code: "259960", name: "크래프톤", market: "KOSPI", aliases: [] },
  { code: "011200", name: "HMM", market: "KOSPI", aliases: ["에이치엠엠"] },
  { code: "090430", name: "아모레퍼시픽", market: "KOSPI", aliases: [] },
  { code: "051900", name: "LG생활건강", market: "KOSPI", aliases: [] },
  { code: "000270", name: "기아", market: "KOSPI", aliases: [] },
  { code: "003670", name: "포스코퓨처엠", market: "KOSPI", aliases: ["포퓨"] },
  { code: "036570", name: "엔씨소프트", market: "KOSPI", aliases: ["NCSOFT", "NCsoft", "NC Soft", "NC소프트", "엔씨", "NC"] },
  { code: "000120", name: "CJ대한통운", market: "KOSPI", aliases: [] },
  { code: "456040", name: "OCI", market: "KOSPI", aliases: [] },
  { code: "001800", name: "오리온홀딩스", market: "KOSPI", aliases: [] },
  { code: "282330", name: "BGF리테일", market: "KOSPI", aliases: [] },
  { code: "035900", name: "JYP Ent.", market: "KOSDAQ", aliases: ["jyp"] },
  { code: "041510", name: "에스엠", market: "KOSDAQ", aliases: ["sm"] },
  { code: "263750", name: "펄어비스", market: "KOSDAQ", aliases: [] },
  { code: "247540", name: "에코프로비엠", market: "KOSDAQ", aliases: ["에코비엠"] },
  { code: "086520", name: "에코프로", market: "KOSDAQ", aliases: [] },
  { code: "091990", name: "셀트리온헬스케어", market: "KOSDAQ", aliases: [] },
  { code: "196170", name: "알테오젠", market: "KOSDAQ", aliases: [] },
  { code: "028300", name: "HLB", market: "KOSDAQ", aliases: ["에이치엘비"] },
  { code: "095660", name: "네오위즈", market: "KOSDAQ", aliases: [] },
  { code: "078340", name: "컴투스", market: "KOSDAQ", aliases: [] },
  { code: "068760", name: "셀트리온제약", market: "KOSDAQ", aliases: [] },
  { code: "066970", name: "엘앤에프", market: "KOSDAQ", aliases: [] },
  { code: "022100", name: "포스코DX", market: "KOSDAQ", aliases: ["포디엑스"] },
  { code: "079370", name: "제우스", market: "KOSDAQ", aliases: [] },
  { code: "190510", name: "나무가", market: "KOSDAQ", aliases: [] },
  { code: "476550", name: "TIGER 미국30년국채커버드콜액티브(H)", market: "ETF", aliases: ["tiger 미국30년"] },
  { code: "462330", name: "KODEX 2차전지산업레버리지", market: "ETF", aliases: ["kodex 2차전지"] }
];

const corporateAliasSeed = new Map([
  ["036570", ["엔씨소프트", "NCSOFT", "NCsoft", "NC Soft", "NC소프트", "엔씨", "NC"]],
  ["042660", ["한화오션", "대우조선해양", "DSME"]]
]);

const indexWatchSeed = [
  {
    key: "KOSPI",
    name: "KOSPI",
    symbol: "KRX:KOSPI",
    category: "지수",
    status: "ready",
    note: "국내 대표 지수 흐름을 차트와 함께 확인하는 기본 보드입니다."
  },
  {
    key: "KOSDAQ",
    name: "KOSDAQ",
    symbol: "KRX:KOSDAQ",
    category: "지수",
    status: "ready",
    note: "성장주와 중소형주 흐름을 함께 보는 보조 지수입니다."
  },
  {
    key: "USDKRW",
    name: "달러 / 원",
    symbol: "KRW=X",
    category: "환율",
    status: "ready",
    note: "네이버 대신 별도 환율 시세 소스로 동일 차트 형식에 맞춰 표시합니다."
  },
  {
    key: "GOLD",
    name: "국제 금",
    symbol: "GC=F",
    category: "원자재",
    status: "ready",
    note: "국제 금 선물 기준으로 같은 카드/팝업 차트 형식에 맞춰 확장했습니다."
  },
  {
    key: "WTI",
    name: "WTI",
    symbol: "CL=F",
    category: "원자재",
    status: "ready",
    note: "서부텍사스원유 선물 기준으로 원자재 흐름을 같은 카드/팝업 구조에서 확인합니다."
  },
  {
    key: "BTC",
    name: "비트코인",
    symbol: "BTC-USD",
    category: "가상자산",
    status: "ready",
    note: "비트코인 달러 기준 시세를 같은 카드와 차트 팝업 흐름으로 확인합니다."
  }
];

const fundamentalsGuideText = [
  "재무지표는 네이버 금융 기준 최근 2개 연간과 최대 8개 분기 흐름을 보여줍니다.",
  "분기 데이터는 최대 8개까지 보여주며, 실제 확정 분기와 추정 분기(E)를 표에서 분리해서 표시합니다.",
  "ETF나 지수형 상품은 기업 재무제표가 없어 표시되지 않을 수 있습니다."
].join("\n");
const businessAreaGuideText = [
  "사업 포트폴리오 맵은 현재 기업개요 문장을 바탕으로 자동 추정한 원형 그래프입니다.",
  "정확한 매출 비중 공시가 아니라, 어떤 사업 축으로 회사를 이해하면 좋은지 빠르게 보여주는 참고용 맵입니다.",
  "추후 사업부문 매출 비중 데이터가 연결되면 같은 UI에 실제 비중으로 교체할 수 있습니다."
].join("\n");
const businessAreaPalette = ["#c45a2d", "#177245", "#2563eb", "#d97706", "#7c3aed", "#0f766e"];

const fundamentalMetricGuides = {
  "매출액": "회사가 일정 기간 동안 올린 전체 매출입니다. 외형 성장 속도를 볼 때 먼저 확인합니다.",
  "영업이익": "본업으로 벌어들인 이익입니다. 일회성보다 사업 체력 판단에 더 유용합니다.",
  "순이익": "영업외손익과 세금까지 반영한 최종 이익입니다. 주주에게 귀속되는 결과에 가깝습니다.",
  "ROE": "자기자본 대비 얼마나 이익을 냈는지 보여주는 수익성 지표입니다. 높을수록 자본 효율이 좋습니다.",
  "부채비율": "자기자본 대비 부채 규모입니다. 일반적으로 너무 높으면 재무 부담이 큰 편입니다.",
  "EPS": "주당순이익입니다. 순이익을 발행주식 수로 나눈 값으로, 주당 이익 수준을 보여줍니다.",
  "BPS": "주당순자산입니다. 회사의 순자산을 주식 수로 나눈 값으로, 자산가치 참고용입니다.",
  "PER": "주가를 주당순이익으로 나눈 값입니다. 이익 대비 현재 주가가 얼마나 비싼지 볼 때 씁니다.",
  "PBR": "주가를 주당순자산으로 나눈 값입니다. 자산가치 대비 현재 주가 수준을 볼 때 씁니다."
};
const fundamentalMetricDefinitions = [
  { key: "revenue", label: "매출액", digits: 0 },
  { key: "operatingIncome", label: "영업이익", digits: 0 },
  { key: "netIncome", label: "순이익", digits: 0 },
  { key: "roe", label: "ROE", digits: 2, suffix: "%" },
  { key: "debtRatio", label: "부채비율", digits: 2, suffix: "%" },
  { key: "eps", label: "EPS", digits: 0 },
  { key: "bps", label: "BPS", digits: 0 },
  { key: "per", label: "PER", digits: 2 },
  { key: "pbr", label: "PBR", digits: 2 }
];

const timeframes = ["daily", "weekly", "monthly"];
const timeframeLabels = {
  daily: "일봉",
  weekly: "주봉",
  monthly: "월봉"
};
const marketWatchMinuteTimeframes = ["minute1", "minute5", "minute30", "minute60"];
const marketWatchTimeframes = [...marketWatchMinuteTimeframes, "daily", "weekly", "yearly"];
const marketWatchPrimaryTimeframeGroups = ["minute", "daily", "weekly", "yearly"];
const marketWatchTimeframeLabels = {
  minute: "분봉",
  minute1: "1분",
  minute5: "5분",
  minute30: "30분",
  minute60: "1시간",
  daily: "일봉",
  weekly: "주봉",
  yearly: "연봉"
};
const moversScoreGuideText = [
  "점수는 0~100점으로 계산됩니다.",
  "등락률: 7% / 12% / 20% 구간에서 가점",
  "거래량: 20일 평균 대비 2배 이상일 때 가점, 3배·6배 구간에서 추가 가점",
  "기술 신호: 20일·60일 고점 돌파 또는 저점 이탈 시 가점",
  "종가 위치: 급등주는 고가 부근, 급락주는 저가 부근 유지 시 가점",
  "거래대금: 300억 / 1000억 이상일 때 가점",
  "해석: 80점 이상 폭발, 60점 이상 강함, 그 미만 관찰"
].join("\n");
const swingScoreGuideText = [
  `스윙 엔진은 최근 ${SWING_LOOKBACK_DAYS}거래일을 기준으로 봅니다.`,
  "첫 단계는 기준봉입니다. 가격과 거래량이 함께 붙으면서 시세의 축이 세워져야 합니다.",
  "그 다음은 눌림입니다. 거래량이 줄고, 기준봉 저점이나 핵심 가격대를 크게 훼손하지 않는 조정이 나와야 합니다.",
  "눌림이 충분히 진행되면 분할매수 구간을 따로 잡습니다. 보통 돌파선 근처에서 버티는지와 이탈선이 명확한지가 핵심입니다.",
  "재돌파가 나와도 너무 멀리 달아나면 추격보다 확인 구간으로 둡니다.",
  "이탈은 기준봉 저점이나 눌림 저점을 훼손해 구조가 무너진 경우입니다.",
  "화면에는 점수 대신 현재 상태와 진입 구간, 이탈 기준을 중심으로 표시합니다."
].join("\n");
const MARKET_EVENT_GROUP_ORDER = ["macro", "policy", "market", "earnings", "news"];
const MARKET_EVENT_CATEGORY_LABELS = {
  earnings: "실적",
  macro: "매크로",
  policy: "정책 / 규제",
  market: "시장",
  news: "기타"
};
const MARKET_EVENT_CATEGORY_BADGE_LABELS = {
  earnings: "실적",
  macro: "매크로",
  policy: "정책",
  market: "시장",
  news: "기타"
};
const MARKET_EVENT_IMPORTANCE_LABELS = {
  high: "높음",
  medium: "보통",
  low: "낮음"
};
const defaultRecommendationBySymbol = new Map(defaultRecommendationCatalog.map((item) => [item.symbol, item]));
const persistedUiState = loadUiState();

let recommendationCatalog = loadCatalog();
let currentCategory = isValidCategory(persistedUiState?.currentCategory) ? persistedUiState.currentCategory : DEFAULT_CATEGORY;
let currentLongTermBucket = isValidLongTermBucket(persistedUiState?.currentLongTermBucket)
  ? persistedUiState.currentLongTermBucket
  : DEFAULT_LONG_TERM_BUCKET;
let currentSwingBucket = isValidSwingBucket(persistedUiState?.currentSwingBucket)
  ? persistedUiState.currentSwingBucket
  : DEFAULT_SWING_BUCKET;
let currentSwingProfile = isValidSwingProfile(persistedUiState?.currentSwingProfile)
  ? persistedUiState.currentSwingProfile
  : DEFAULT_SWING_PROFILE;
let currentAnalysis = null;
let selectedKey = typeof persistedUiState?.selectedKey === "string" ? persistedUiState.selectedKey : getFilteredInitialKey();
let activeChart = null;
let resizeObserver = null;
let itemsPerPage = PAGE_SIZE_OPTIONS.has(Number(persistedUiState?.itemsPerPage)) ? Number(persistedUiState.itemsPerPage) : 5;
let currentPage = Number.isInteger(persistedUiState?.currentPage) && persistedUiState.currentPage > 0 ? persistedUiState.currentPage : 1;
let activeView = resolveInitialAppView(persistedUiState?.activeView);
let hasLoadedMovers = false;
let stockSearchQuery = "";
let selectedStockOption = null;
let stockSearchUniverse = [];
let stockUniverseLoaded = false;
let stockUniverseLoading = false;
let marketWatchItems = new Map();
let marketWatchLoaded = false;
let marketWatchLoading = false;
let marketWatchChartState = null;
let marketWatchChartViewportByKey = new Map();
let marketWatchTimeframeByKey = new Map(indexWatchSeed.map((item) => [item.key, "daily"]));
let activeMarketWatchKey = null;
let marketWatchRefreshTimer = null;
let marketWatchFetchedAt = "";
const marketOperationEventToastIds = new Set();
let marketEventCalendarPayload = null;
let marketEventCalendarLoaded = false;
let marketEventCalendarLoading = false;
let marketEventCalendarError = "";
let marketEventCalendarSelectedDate = "";
let marketEventCalendarVisibleMonth = "";
let marketEventCalendarExpandedGroups = new Set();
let marketFlowPayload = null;
let marketFlowLoaded = false;
let marketFlowLoading = false;
let marketFlowError = "";
let marketFlowRefreshTimer = null;
let marketFlowMarketChartState = null;
let marketFlowThemeChartState = null;
let marketFlowHistory = [];
let marketFlowThemeHistory = [];
let marketFlowSelectedRange = DEFAULT_MARKET_FLOW_RANGE;
let marketFlowSelectedThemes = new Set();
let recommendationHistoryPayload = null;
let recommendationHistoryLoaded = false;
let recommendationHistoryLoading = false;
let recommendationHistoryError = "";
let recommendationHistoryClosedMonth = "";
let recommendationHistoryClosedSearch = "";
let recommendationHistoryClosedOutcomeFilter = "all";
let recommendationHistoryCurrentStageFilter = "all";
let activeHistoryChartItem = null;
let historyChartState = null;
let historyChartLoading = false;
let stockModalPointerDownOnBackdrop = false;
let marketEventModalPointerDownOnBackdrop = false;
let themeDetailModalPointerDownOnBackdrop = false;
let serverDividendPicksLoaded = false;
let serverLongTermPicksLoaded = false;
let dividendEtfRecommendations = [];
let selectedDividendEtfSymbol = null;
const serverSwingPicksLoadedByProfile = {
  default: false,
  smallcap: false
};
const recommendationUniverseScanLoadingByCategory = {
  longTerm: false,
  dividend: false,
  swing: false,
  "swing:smallcap": false
};
hydrateRecommendationUniverseScanLoadingFromSessions();
let swingPatternByKey = new Map();
let realtimeStockSnapshots = new Map();
let stockSnapshotRefreshTimer = null;
let stockSnapshotLoading = false;
let lastVisibleStockSnapshotSignature = "";
let activeAnalysisRefreshTimer = null;
let activeAnalysisRealtimeLoading = false;
let onlinePresenceHeartbeatTimer = null;
let serverRecommendationRefreshTimer = null;
let serverRecommendationSyncInFlight = false;
let recommendationUniverseScanPollTimer = null;
const activeRecommendationScanRequestKeys = new Set();
let latestRiseMovers = [];
let latestFallMovers = [];
let toastSequence = 0;
const toastDismissTimers = new Map();

const appTabs = document.querySelector("#appTabs");
const newsView = document.querySelector("#newsView");
const indexView = document.querySelector("#indexView");
const historyView = document.querySelector("#historyView");
const analysisView = document.querySelector("#analysisView");
const moversView = document.querySelector("#moversView");
const stockSelector = document.querySelector("#stockSelector");
const results = document.querySelector("#results");
const summaryBar = document.querySelector("#summaryBar");
const errorBox = document.querySelector("#errorBox");
const statusBadge = document.querySelector("#statusBadge");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const pageStatus = document.querySelector("#pageStatus");
const prevPageBtn = document.querySelector("#prevPageBtn");
const nextPageBtn = document.querySelector("#nextPageBtn");
const runUniverseRecommendationBtn = document.querySelector("#runUniverseRecommendationBtn");
const openAddStockBtn = document.querySelector("#openAddStockBtn");
const recommendationScopeTitle = document.querySelector("#recommendationScopeTitle");
const recommendationScopeHelp = document.querySelector("#recommendationScopeHelp");
const stockModal = document.querySelector("#stockModal");
const stockModalTitle = document.querySelector("#stockModalTitle");
const closeStockModalBtn = document.querySelector("#closeStockModalBtn");
const cancelStockModalBtn = document.querySelector("#cancelStockModalBtn");
const indexChartModal = document.querySelector("#indexChartModal");
const closeIndexChartModalBtn = document.querySelector("#closeIndexChartModalBtn");
const indexChartModalTitle = document.querySelector("#indexChartModalTitle");
const indexChartModalMeta = document.querySelector("#indexChartModalMeta");
const indexChartModalPrice = document.querySelector("#indexChartModalPrice");
const indexChartModalChange = document.querySelector("#indexChartModalChange");
const indexChartModalToolbar = document.querySelector("#indexChartModalToolbar");
const indexChartModalLegend = document.querySelector("#indexChartModalLegend");
const indexChartModalContainer = document.querySelector("#indexChartModalContainer");
const indexChartModalTooltip = document.querySelector("#indexChartModalTooltip");
const indexChartModalStartDate = document.querySelector("#indexChartModalStartDate");
const indexChartModalEndDate = document.querySelector("#indexChartModalEndDate");
const swingScoreModal = document.querySelector("#swingScoreModal");
const closeSwingScoreModalBtn = document.querySelector("#closeSwingScoreModalBtn");
const swingScoreModalMeta = document.querySelector("#swingScoreModalMeta");
const swingScoreModalBody = document.querySelector("#swingScoreModalBody");
const marketEventModal = document.querySelector("#marketEventModal");
const closeMarketEventModalBtn = document.querySelector("#closeMarketEventModalBtn");
const marketEventModalMeta = document.querySelector("#marketEventModalMeta");
const marketEventModalBody = document.querySelector("#marketEventModalBody");
const themeDetailModal = document.querySelector("#themeDetailModal");
const closeThemeDetailModalBtn = document.querySelector("#closeThemeDetailModalBtn");
const themeDetailModalTitle = document.querySelector("#themeDetailModalTitle");
const themeDetailModalMeta = document.querySelector("#themeDetailModalMeta");
const themeDetailModalBody = document.querySelector("#themeDetailModalBody");
const stockForm = document.querySelector("#stockForm");
const stockSearchInput = document.querySelector("#stockSearchInput");
const stockSearchResults = document.querySelector("#stockSearchResults");
const selectedStockCard = document.querySelector("#selectedStockCard");
const indexWatchList = document.querySelector("#indexWatchList");
const recommendationHistoryStatusBadge = document.querySelector("#recommendationHistoryStatusBadge");
const recommendationHistorySummary = document.querySelector("#recommendationHistorySummary");
const openHistoryMatrixModalBtn = document.querySelector("#openHistoryMatrixModalBtn");
const historyMatrixModal = document.querySelector("#historyMatrixModal");
const closeHistoryMatrixModalBtn = document.querySelector("#closeHistoryMatrixModalBtn");
const historyMatrixModalBody = document.querySelector("#historyMatrixModalBody");
const historyChartModal = document.querySelector("#historyChartModal");
const closeHistoryChartModalBtn = document.querySelector("#closeHistoryChartModalBtn");
const historyChartModalTitle = document.querySelector("#historyChartModalTitle");
const historyChartModalMeta = document.querySelector("#historyChartModalMeta");
const historyChartModalSummary = document.querySelector("#historyChartModalSummary");
const historyChartModalContainer = document.querySelector("#historyChartModalContainer");
const historyChartModalTooltip = document.querySelector("#historyChartModalTooltip");
const historyChartModalStartDate = document.querySelector("#historyChartModalStartDate");
const historyChartModalEndDate = document.querySelector("#historyChartModalEndDate");
const recommendationHistoryCurrentCases = document.querySelector("#recommendationHistoryCurrentCases");
const recommendationHistoryClosedCases = document.querySelector("#recommendationHistoryClosedCases");
const historyClosedMonthSelect = document.querySelector("#historyClosedMonthSelect");
const historyClosedSearchInput = document.querySelector("#historyClosedSearchInput");
const marketEventCalendarBoard = document.querySelector("#marketEventCalendarBoard");
const marketFlowBoard = document.querySelector("#marketFlowBoard");
const marketFlowBoardBody = document.querySelector("#marketFlowBoardBody");
const marketFlowStatusBadge = document.querySelector("#marketFlowStatusBadge");
const refreshMarketFlowBtn = document.querySelector("#refreshMarketFlowBtn");
const moversRiseThemesList = document.querySelector("#moversRiseThemesList");
const moversFallThemesList = document.querySelector("#moversFallThemesList");
const stockNameInput = document.querySelector("#stockNameInput");
const stockSymbolInput = document.querySelector("#stockSymbolInput");
const stockPriceInput = document.querySelector("#stockPriceInput");
const stockDateInput = document.querySelector("#stockDateInput");
const stockCategoryTabs = document.querySelector("#stockCategoryTabs");
const swingProfileTabs = document.querySelector("#swingProfileTabs");
const longTermBucketTabs = document.querySelector("#longTermBucketTabs");
const swingBucketTabs = document.querySelector("#swingBucketTabs");
const stockCategorySelect = document.querySelector("#stockCategorySelect");
const longTermBucketField = document.querySelector("#longTermBucketField");
const longTermBucketSelect = document.querySelector("#longTermBucketSelect");
const reviewBucketLabel = document.querySelector("#reviewBucketLabel");
const dividendInfoField = document.querySelector("#dividendInfoField");
const latestDividendDateInput = document.querySelector("#latestDividendDateInput");
const latestDividendAmountInput = document.querySelector("#latestDividendAmountInput");
const stockNoteInput = document.querySelector("#stockNoteInput");
const moversStatusBadge = document.querySelector("#moversStatusBadge");
const moversSummaryBar = document.querySelector("#moversSummaryBar");
const moversErrorBox = document.querySelector("#moversErrorBox");
const moversMarketSelect = document.querySelector("#moversMarketSelect");
const moversLimitSelect = document.querySelector("#moversLimitSelect");
const moversMinChangeInput = document.querySelector("#moversMinChangeInput");
const moversMinVolumeInput = document.querySelector("#moversMinVolumeInput");
const moversMinScoreInput = document.querySelector("#moversMinScoreInput");
const refreshMoversBtn = document.querySelector("#refreshMoversBtn");
const riseMoversList = document.querySelector("#riseMoversList");
const fallMoversList = document.querySelector("#fallMoversList");
const riseCountLabel = document.querySelector("#riseCountLabel");
const fallCountLabel = document.querySelector("#fallCountLabel");
const onlinePresenceBadge = document.querySelector("#onlinePresenceBadge");
const onlinePresenceCount = document.querySelector("#onlinePresenceCount");
const scoreGuideIcons = document.querySelectorAll("[data-score-guide]");
const toastViewport = document.querySelector("#toastViewport");

window.showAppToast = showAppToast;

toastViewport?.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-toast-dismiss]");
  if (!closeButton) {
    return;
  }

  const toast = closeButton.closest("[data-toast-id]");
  if (!toast) {
    return;
  }

  dismissToast(toast.dataset.toastId);
});

initializeApp();

appTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) {
    return;
  }

  const view = button.dataset.view;
  if (!view || view === activeView) {
    return;
  }

  switchAppView(view);
});

window.addEventListener("hashchange", () => {
  const hashView = resolveHashAppView();
  if (!hashView || hashView === activeView) {
    return;
  }

  switchAppView(hashView);
});

window.addEventListener("focus", () => {
  void syncServerRecommendations({ silent: true });
  void sendOnlinePresenceHeartbeat();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void syncServerRecommendations({ silent: true });
    void sendOnlinePresenceHeartbeat();
  }
});

indexWatchList?.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-index-open]");
  if (!trigger) {
    return;
  }

  const key = trigger.dataset.indexOpen;
  if (!key) {
    return;
  }

  openIndexChartModal(key);
});

marketEventCalendarBoard?.addEventListener("click", (event) => {
  const searchButton = event.target.closest("[data-calendar-search]");
  if (searchButton) {
    void searchMarketEventCalendar();
    return;
  }

  const navigationButton = event.target.closest("[data-calendar-nav]");
  if (navigationButton) {
    const direction = navigationButton.dataset.calendarNav;
    if (direction === "prev" || direction === "next") {
      marketEventCalendarVisibleMonth = addMonthsToMonthKey(
        marketEventCalendarVisibleMonth || getMonthKeyFromDate(getTodayInSeoulDateText()),
        direction === "prev" ? -1 : 1
      );
      renderMarketEventCalendarBoard();
    }
    return;
  }

  const dateButton = event.target.closest("[data-calendar-date]");
  if (dateButton) {
    const nextDate = dateButton.dataset.calendarDate;
    if (nextDate) {
      marketEventCalendarSelectedDate = nextDate;
      marketEventCalendarVisibleMonth = getMonthKeyFromDate(nextDate);
      marketEventCalendarExpandedGroups = new Set();
      renderMarketEventCalendarBoard();
      openMarketEventModal(nextDate);
    }
    return;
  }

  const expandButton = event.target.closest("[data-event-group-expand]");
  if (expandButton) {
    const groupKey = expandButton.dataset.eventGroupExpand;
    if (groupKey) {
      if (marketEventCalendarExpandedGroups.has(groupKey)) {
        marketEventCalendarExpandedGroups.delete(groupKey);
      } else {
        marketEventCalendarExpandedGroups.add(groupKey);
      }
      renderMarketEventCalendarBoard();
    }
  }
});

indexChartModalToolbar?.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-index-timeframe-group]");
  if (groupButton && activeMarketWatchKey) {
    const group = groupButton.dataset.indexTimeframeGroup;
    if (group !== "minute") {
      return;
    }

    const snapshot = marketWatchItems.get(activeMarketWatchKey);
    const minuteTimeframe = getDefaultMarketWatchMinuteTimeframe(snapshot, marketWatchTimeframeByKey.get(activeMarketWatchKey));
    if (!minuteTimeframe || marketWatchTimeframeByKey.get(activeMarketWatchKey) === minuteTimeframe) {
      return;
    }

    marketWatchTimeframeByKey.set(activeMarketWatchKey, minuteTimeframe);
    renderIndexChartModal();
    return;
  }

  const button = event.target.closest("[data-index-timeframe]");
  if (!button || !activeMarketWatchKey) {
    return;
  }

  const timeframe = button.dataset.indexTimeframe;
  if (!marketWatchTimeframes.includes(timeframe)) {
    return;
  }

  if (marketWatchTimeframeByKey.get(activeMarketWatchKey) === timeframe) {
    return;
  }

  marketWatchTimeframeByKey.set(activeMarketWatchKey, timeframe);
  renderIndexChartModal();
});

stockSelector.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-key]");
  if (deleteButton) {
    const key = deleteButton.dataset.deleteKey;
    if (key) {
      removeStock(key);
    }
    return;
  }

  const etfButton = event.target.closest("[data-dividend-etf-symbol]");
  if (etfButton) {
    const symbol = etfButton.dataset.dividendEtfSymbol;
    if (!symbol) {
      return;
    }

    const item = createDividendEtfAnalysisItem(symbol);
    if (!item) {
      return;
    }

    selectedDividendEtfSymbol = symbol;
    selectedKey = null;
    renderSelector();
    await runAnalysisForRecommendation(item);
    return;
  }

  const button = event.target.closest("[data-stock-key]");
  if (!button) {
    return;
  }

  const key = button.dataset.stockKey;
  if (!key) {
    return;
  }

  selectedDividendEtfSymbol = null;
  selectedKey = key;
  renderSelector();
  await runAnalysisByKey(key);
});

pageSizeSelect.addEventListener("change", () => {
  itemsPerPage = Number(pageSizeSelect.value) || 10;
  currentPage = 1;
  renderSelector();
});

stockCategoryTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) {
    return;
  }

  const category = button.dataset.category;
  if (!category || category === currentCategory) {
    return;
  }

  currentCategory = category;
  currentPage = 1;
  selectedKey = getFilteredCatalog()[0]?.key ?? null;
  startStockSnapshotAutoRefresh();
  renderCategoryTabs();
  renderLongTermBucketTabs();
  renderSwingBucketTabs();
  renderSelector();
  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
    return;
  }

  renderEmptyResultsForCurrentFilter();
});

swingProfileTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-swing-profile]");
  if (!button || currentCategory !== "swing") {
    return;
  }

  const nextProfile = button.dataset.swingProfile;
  if (!isValidSwingProfile(nextProfile) || nextProfile === currentSwingProfile) {
    return;
  }

  currentSwingProfile = nextProfile;
  currentPage = 1;
  selectedKey = getFilteredCatalog()[0]?.key ?? null;
  renderSwingProfileTabs();
  renderSwingBucketTabs();
  renderSelector();
  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
    return;
  }

  renderEmptyResultsForCurrentFilter();
});

longTermBucketTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-long-term-bucket]");
  if (!button || isSwingCategory(currentCategory)) {
    return;
  }

  const nextBucket = button.dataset.longTermBucket;
  if (!isValidLongTermBucket(nextBucket) || nextBucket === currentLongTermBucket) {
    return;
  }

  currentLongTermBucket = nextBucket;
  currentPage = 1;
  selectedKey = getFilteredCatalog()[0]?.key ?? null;
  renderLongTermBucketTabs();
  renderSelector();
  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
    return;
  }

  renderEmptyResultsForCurrentFilter();
});

swingBucketTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-swing-bucket]");
  if (!button || currentCategory !== "swing") {
    return;
  }

  const nextBucket = button.dataset.swingBucket;
  if (!isValidSwingBucket(nextBucket) || nextBucket === currentSwingBucket) {
    return;
  }

  currentSwingBucket = nextBucket;
  currentPage = 1;
  selectedKey = getFilteredCatalog()[0]?.key ?? null;
  renderSwingBucketTabs();
  renderSelector();
  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
    return;
  }

  renderEmptyResultsForCurrentFilter();
});

prevPageBtn.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderSelector();
});

nextPageBtn.addEventListener("click", () => {
  currentPage = Math.min(getTotalPages(), currentPage + 1);
  renderSelector();
});

runUniverseRecommendationBtn?.addEventListener("click", () => {
  void runRecommendationUniverseScan();
});

openAddStockBtn.addEventListener("click", () => {
  openStockModal();
});

closeStockModalBtn.addEventListener("click", closeStockModal);
cancelStockModalBtn.addEventListener("click", closeStockModal);
closeIndexChartModalBtn?.addEventListener("click", closeIndexChartModal);
closeSwingScoreModalBtn?.addEventListener("click", closeSwingScoreModal);
openHistoryMatrixModalBtn?.addEventListener("click", openHistoryMatrixModal);
closeHistoryMatrixModalBtn?.addEventListener("click", closeHistoryMatrixModal);
closeHistoryChartModalBtn?.addEventListener("click", closeHistoryChartModal);
closeMarketEventModalBtn?.addEventListener("click", closeMarketEventModal);
closeThemeDetailModalBtn?.addEventListener("click", closeThemeDetailModal);
historyClosedMonthSelect?.addEventListener("change", () => {
  recommendationHistoryClosedMonth = historyClosedMonthSelect.value;
  renderRecommendationHistoryBoard();
});
historyClosedSearchInput?.addEventListener("input", () => {
  recommendationHistoryClosedSearch = historyClosedSearchInput.value;
  renderRecommendationHistoryBoard();
});

stockModal.addEventListener("pointerdown", (event) => {
  stockModalPointerDownOnBackdrop = event.target === stockModal;
});

stockModal.addEventListener("click", (event) => {
  if (event.target === stockModal && stockModalPointerDownOnBackdrop) {
    closeStockModal();
  }

  stockModalPointerDownOnBackdrop = false;
});

indexChartModal?.addEventListener("click", (event) => {
  if (event.target === indexChartModal) {
    closeIndexChartModal();
  }
});

refreshMarketFlowBtn?.addEventListener("click", () => {
  void loadMarketFlow({ forceRefresh: true, toast: true });
});

marketFlowBoardBody?.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-market-flow-theme-detail]");
  if (detailButton) {
    openThemeDetailModal(detailButton.dataset.marketFlowThemeDetail);
    return;
  }

  const rangeButton = event.target.closest("[data-market-flow-range]");
  if (rangeButton) {
    const range = rangeButton.dataset.marketFlowRange;
    if (range && range !== marketFlowSelectedRange) {
      marketFlowSelectedRange = range;
      void loadMarketFlow({ historiesOnly: true });
    }
    return;
  }

  const button = event.target.closest("[data-market-flow-theme]");
  if (!button || !marketFlowPayload) {
    return;
  }

  const theme = button.dataset.marketFlowTheme;
  if (!theme) {
    return;
  }

  if (marketFlowSelectedThemes.has(theme)) {
    if (marketFlowSelectedThemes.size === 1) {
      return;
    }
    marketFlowSelectedThemes.delete(theme);
  } else {
    marketFlowSelectedThemes.add(theme);
  }

  renderMarketFlowBoard();
});

swingScoreModal?.addEventListener("click", (event) => {
  if (event.target === swingScoreModal) {
    closeSwingScoreModal();
  }
});

historyMatrixModal?.addEventListener("click", (event) => {
  if (event.target === historyMatrixModal) {
    closeHistoryMatrixModal();
  }
});

historyChartModal?.addEventListener("click", (event) => {
  if (event.target === historyChartModal) {
    closeHistoryChartModal();
  }
});

recommendationHistoryCurrentCases?.addEventListener("click", (event) => {
  const stageFilter = event.target.closest("[data-history-current-stage-filter]");
  if (stageFilter) {
    const nextStage = stageFilter.dataset.historyCurrentStageFilter;
    recommendationHistoryCurrentStageFilter = recommendationHistoryCurrentStageFilter === nextStage ? "all" : nextStage;
    renderRecommendationHistoryBoard();
    return;
  }

  const trigger = event.target.closest("[data-history-chart-symbol]");
  if (!trigger) {
    return;
  }

  void openHistoryChartModal({
    symbol: trigger.dataset.historyChartSymbol,
    profile: trigger.dataset.historyChartProfile
  });
});

recommendationHistoryCurrentCases?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const stageFilter = event.target.closest("[data-history-current-stage-filter]");
  if (stageFilter) {
    event.preventDefault();
    const nextStage = stageFilter.dataset.historyCurrentStageFilter;
    recommendationHistoryCurrentStageFilter = recommendationHistoryCurrentStageFilter === nextStage ? "all" : nextStage;
    renderRecommendationHistoryBoard();
    return;
  }

  const trigger = event.target.closest("[data-history-chart-symbol]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  void openHistoryChartModal({
    symbol: trigger.dataset.historyChartSymbol,
    profile: trigger.dataset.historyChartProfile
  });
});
recommendationHistoryClosedCases?.addEventListener("click", (event) => {
  const outcomeFilter = event.target.closest("[data-history-closed-outcome-filter]");
  if (outcomeFilter) {
    const nextFilter = outcomeFilter.dataset.historyClosedOutcomeFilter;
    recommendationHistoryClosedOutcomeFilter = CLOSED_HISTORY_OUTCOME_FILTERS.has(nextFilter) ? nextFilter : "all";
    renderRecommendationHistoryBoard();
    return;
  }

  const trigger = event.target.closest("[data-history-chart-symbol]");
  if (!trigger) {
    return;
  }

  openHistoryChartModal({
    symbol: trigger.dataset.historyChartSymbol,
    profile: trigger.dataset.historyChartProfile
  });
});
recommendationHistoryClosedCases?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const outcomeFilter = event.target.closest("[data-history-closed-outcome-filter]");
  if (outcomeFilter) {
    event.preventDefault();
    const nextFilter = outcomeFilter.dataset.historyClosedOutcomeFilter;
    recommendationHistoryClosedOutcomeFilter = CLOSED_HISTORY_OUTCOME_FILTERS.has(nextFilter) ? nextFilter : "all";
    renderRecommendationHistoryBoard();
    return;
  }

  const trigger = event.target.closest("[data-history-chart-symbol]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  openHistoryChartModal({
    symbol: trigger.dataset.historyChartSymbol,
    profile: trigger.dataset.historyChartProfile
  });
});

marketEventModal?.addEventListener("pointerdown", (event) => {
  marketEventModalPointerDownOnBackdrop = event.target === marketEventModal;
});

marketEventModal?.addEventListener("click", (event) => {
  if (event.target === marketEventModal && marketEventModalPointerDownOnBackdrop) {
    closeMarketEventModal();
  }

  marketEventModalPointerDownOnBackdrop = false;
});

themeDetailModal?.addEventListener("pointerdown", (event) => {
  themeDetailModalPointerDownOnBackdrop = event.target === themeDetailModal;
});

themeDetailModal?.addEventListener("click", (event) => {
  if (event.target === themeDetailModal && themeDetailModalPointerDownOnBackdrop) {
    closeThemeDetailModal();
  }

  themeDetailModalPointerDownOnBackdrop = false;
});

marketEventModalBody?.addEventListener("click", (event) => {
  const expandButton = event.target.closest("[data-event-group-expand]");
  if (!expandButton) {
    return;
  }

  const groupKey = expandButton.dataset.eventGroupExpand;
  if (!groupKey) {
    return;
  }

  if (marketEventCalendarExpandedGroups.has(groupKey)) {
    marketEventCalendarExpandedGroups.delete(groupKey);
  } else {
    marketEventCalendarExpandedGroups.add(groupKey);
  }

  renderMarketEventModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stockModal.classList.contains("hidden")) {
    closeStockModal();
    return;
  }

  if (event.key === "Escape" && indexChartModal && !indexChartModal.classList.contains("hidden")) {
    closeIndexChartModal();
    return;
  }

  if (event.key === "Escape" && swingScoreModal && !swingScoreModal.classList.contains("hidden")) {
    closeSwingScoreModal();
    return;
  }

  if (event.key === "Escape" && historyMatrixModal && !historyMatrixModal.classList.contains("hidden")) {
    closeHistoryMatrixModal();
    return;
  }

  if (event.key === "Escape" && historyChartModal && !historyChartModal.classList.contains("hidden")) {
    closeHistoryChartModal();
    return;
  }

  if (event.key === "Escape" && marketEventModal && !marketEventModal.classList.contains("hidden")) {
    closeMarketEventModal();
    return;
  }

  if (event.key === "Escape" && themeDetailModal && !themeDetailModal.classList.contains("hidden")) {
    closeThemeDetailModal();
  }
});

stockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = buildStockFromForm();
  if (!item) {
    return;
  }

  recommendationCatalog = [...recommendationCatalog, item];
  currentCategory = resolveRecommendationCategory(item.category);
  if (item.category !== "swing") {
    currentLongTermBucket = item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET;
  }
  startStockSnapshotAutoRefresh();
  selectedKey = item.key;
  currentPage = getTotalPagesForCount(getFilteredCatalog().length);
  saveCatalog();
  if (item.category === "swing") {
    await refreshSwingPatternSnapshots();
  }
  closeStockModal();
  renderCategoryTabs();
  renderLongTermBucketTabs();
  renderSwingBucketTabs();
  renderSelector();
  showAppToast({
    title: "추천 종목 추가",
    message: `${item.name}을 ${getCategoryDisplayLabel(item.category ?? DEFAULT_CATEGORY)} 목록에 추가했습니다.`,
    tone: "positive"
  });
  await runAnalysisByKey(item.key);
});

stockSearchInput?.addEventListener("input", () => {
  stockSearchQuery = stockSearchInput.value.trim();
  if (
    selectedStockOption &&
    stockSearchInput.value.trim() !== `${selectedStockOption.name} (${selectedStockOption.code})`
  ) {
    clearSelectedStockOption();
  }
  renderStockSearchResults();
});

stockCategorySelect?.addEventListener("change", () => {
  syncLongTermBucketField();
});

stockSearchResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-stock-code]");
  if (!button) {
    return;
  }

  const code = button.dataset.stockCode;
  if (!code) {
    return;
  }

  const item = stockSearchUniverse.find((candidate) => candidate.code === code);
  if (!item) {
    return;
  }

  selectStockOption(item);
});

refreshMoversBtn?.addEventListener("click", async () => {
  await loadMovers({ toast: true });
});

results.addEventListener("click", (event) => {
  const fundamentalsButton = event.target.closest("[data-fundamentals-scroll]");
  if (fundamentalsButton) {
    const targetId = fundamentalsButton.dataset.fundamentalsTarget;
    const direction = fundamentalsButton.dataset.fundamentalsScroll;
    if (targetId && direction) {
      const container = document.getElementById(targetId);
      if (container) {
        const distance = Math.max(container.clientWidth * 0.72, 220);
        container.scrollBy({
          left: direction === "prev" ? -distance : distance,
          behavior: "smooth"
        });
      }
    }
    return;
  }

  const scoreExplainButton = event.target.closest("[data-score-explain-toggle]");
  if (scoreExplainButton) {
    openSwingScoreModal(scoreExplainButton);
    return;
  }

  const button = event.target.closest("[data-timeframe]");
  if (!button || !currentAnalysis) {
    return;
  }

  const timeframe = button.dataset.timeframe;
  if (!timeframes.includes(timeframe)) {
    return;
  }

  currentAnalysis.activeTimeframe = timeframe;
  updateChartView(timeframe);
});

async function initializeApp() {
  initOnlinePresence();
  updateUniverseRecommendationButton();
  stockSearchUniverse = buildStockSearchUniverse();
  await loadServerDividendPicks();
  await loadServerLongTermPicks();
  await loadServerSwingPicks("default");
  await loadServerSwingPicks("smallcap");
  await refreshSwingPatternSnapshots();
  restoreUiState();
  hydrateRecommendationUniverseScanLoadingFromSessions();
  applyScoreGuideTooltips();
  renderAppTabs();
  renderCategoryTabs();
  renderLongTermBucketTabs();
  renderSwingBucketTabs();
  updateUniverseRecommendationButton();
  syncLongTermBucketField();
  renderIndexWatchList();
  renderMarketEventCalendarBoard();
  renderMarketFlowBoard();
  renderRecommendationHistoryBoard();
  renderMoversThemeLists();
  renderSelector();
  renderStockSearchResults();

  if (selectedKey) {
    void runAnalysisByKey(selectedKey);
  }

  void restoreRecommendationUniverseScanSessions();
  void loadStockUniverse();
  void loadMarketWatch();
  void loadMarketEventCalendar();
  void loadMarketFlow();
  void loadRecommendationHistory({ background: true });
  void loadMovers({ background: true, preserveMoversUi: true });
  void loadRealtimeStockSnapshots({ background: true });
  startMarketWatchAutoRefresh();
  startMarketFlowAutoRefresh();
  startStockSnapshotAutoRefresh();
  startActiveAnalysisAutoRefresh();
  startServerRecommendationAutoRefresh();
}

function initOnlinePresence() {
  void sendOnlinePresenceHeartbeat();
  startOnlinePresenceHeartbeat();
}

function startOnlinePresenceHeartbeat() {
  if (onlinePresenceHeartbeatTimer) {
    clearInterval(onlinePresenceHeartbeatTimer);
  }

  onlinePresenceHeartbeatTimer = window.setInterval(() => {
    void sendOnlinePresenceHeartbeat();
  }, ONLINE_PRESENCE_HEARTBEAT_INTERVAL_MS);
}

function getOnlinePresenceViewerId() {
  const storageKey = "stockmon-online-viewer-id";

  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `viewer-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch (_error) {
    return `viewer-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function renderOnlinePresence(payload) {
  if (!onlinePresenceBadge || !onlinePresenceCount) {
    return;
  }

  const nextCount = Number.isFinite(payload?.onlineCount) ? Math.max(0, Math.trunc(payload.onlineCount)) : null;
  onlinePresenceCount.textContent = nextCount == null ? "-" : new Intl.NumberFormat("ko-KR").format(nextCount);
  onlinePresenceBadge.classList.toggle("loading", nextCount == null);
  onlinePresenceBadge.setAttribute(
    "aria-label",
    nextCount == null ? "online 사용자 수를 불러오는 중" : `현재 online ${nextCount}명`
  );
}

async function sendOnlinePresenceHeartbeat() {
  try {
    const response = await fetch("/analysis/online-presence/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        viewerId: getOnlinePresenceViewerId(),
        page: window.location.pathname
      })
    });

    if (!response.ok) {
      throw new Error(`온라인 상태를 불러오지 못했습니다. (${response.status})`);
    }

    renderOnlinePresence(await response.json());
  } catch (_error) {
    renderOnlinePresence(null);
  }
}

function startServerRecommendationAutoRefresh() {
  if (serverRecommendationRefreshTimer) {
    clearInterval(serverRecommendationRefreshTimer);
  }

  serverRecommendationRefreshTimer = window.setInterval(() => {
    void syncServerRecommendations({ silent: true });
  }, SERVER_RECOMMENDATION_REFRESH_INTERVAL_MS);
}

function mergeRecommendations(baseItems, incomingItems) {
  const merged = new Map();

  for (const item of baseItems) {
    const normalized = normalizeRecommendation(item);
    merged.set(normalized.key, normalized);
  }

  for (const item of incomingItems) {
    const normalized = normalizeRecommendation(item);
    if (!merged.has(normalized.key)) {
      merged.set(normalized.key, normalized);
    }
  }

  return [...merged.values()];
}

function preferLongTermRecommendation(existingItem, nextItem) {
  if (isServerUniverseRecommendation(nextItem) && !isServerUniverseRecommendation(existingItem)) {
    return nextItem;
  }

  if (!isServerUniverseRecommendation(nextItem) && isServerUniverseRecommendation(existingItem)) {
    return existingItem;
  }

  return nextItem;
}

function dedupeLongTermRecommendations(items) {
  const deduped = [];
  const indexBySymbol = new Map();

  for (const item of items) {
    const normalized = normalizeRecommendation(item);
    if ((normalized.category ?? DEFAULT_CATEGORY) !== DEFAULT_CATEGORY || !normalized.symbol) {
      deduped.push(normalized);
      continue;
    }

    const existingIndex = indexBySymbol.get(normalized.symbol);
    if (existingIndex == null) {
      indexBySymbol.set(normalized.symbol, deduped.length);
      deduped.push(normalized);
      continue;
    }

    deduped[existingIndex] = preferLongTermRecommendation(deduped[existingIndex], normalized);
  }

  return deduped;
}

function isServerUniverseRecommendation(item) {
  return item?.source === "server-universe";
}

function removeOverlappingSmallcapSwingRecommendations(items) {
  const defaultSwingSymbols = new Set(
    items
      .filter(
        (item) =>
          (item.category ?? DEFAULT_CATEGORY) === "swing" &&
          isServerUniverseRecommendation(item) &&
          resolveSwingProfile(item.swingProfile) === "default"
      )
      .map((item) => item.symbol)
  );

  return items.filter(
    (item) =>
      !(
        (item.category ?? DEFAULT_CATEGORY) === "swing" &&
        isServerUniverseRecommendation(item) &&
        resolveSwingProfile(item.swingProfile) === "smallcap" &&
        defaultSwingSymbols.has(item.symbol)
      )
  );
}

function syncServerLongTermRecommendations(baseItems, incomingItems) {
  const preserved = baseItems.filter((item) => (item.category ?? DEFAULT_CATEGORY) !== DEFAULT_CATEGORY || !isServerUniverseRecommendation(item));
  const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
  return dedupeLongTermRecommendations(mergeRecommendations(normalizedIncoming, preserved));
}

function syncServerDividendRecommendations(baseItems, incomingItems) {
  const preserved = baseItems.filter((item) => (item.category ?? DEFAULT_CATEGORY) !== DIVIDEND_CATEGORY || !isServerUniverseRecommendation(item));
  const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
  return mergeRecommendations(normalizedIncoming, preserved);
}

function syncServerSwingRecommendations(baseItems, incomingItems, profile = DEFAULT_SWING_PROFILE) {
  const preserved = baseItems.filter(
    (item) =>
      (item.category ?? DEFAULT_CATEGORY) !== "swing" ||
      !isServerUniverseRecommendation(item) ||
      resolveSwingProfile(item.swingProfile) !== profile
  );
  const normalizedIncoming = incomingItems.map((item) => normalizeRecommendation(item));
  return removeOverlappingSmallcapSwingRecommendations(mergeRecommendations(normalizedIncoming, preserved));
}

function syncSelectedKeyWithCatalog() {
  const visibleKeys = new Set(recommendationCatalog.map((item) => item.key));
  const filteredKeys = new Set(getFilteredCatalog().map((item) => item.key));
  if (!selectedKey || !visibleKeys.has(selectedKey) || !filteredKeys.has(selectedKey)) {
    selectedKey = getFilteredInitialKey();
  }
}

async function loadServerLongTermPicks(force = false) {
  if (serverLongTermPicksLoaded && !force) {
    return false;
  }

  try {
    const response = await fetch("/analysis/server-long-term-picks");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "서버 중장기 종목을 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    const nextCatalog = syncServerLongTermRecommendations(recommendationCatalog, items);
    const changed = JSON.stringify(nextCatalog) !== JSON.stringify(recommendationCatalog);
    recommendationCatalog = nextCatalog;
    if (changed) {
      saveCatalog();
    }
    syncSelectedKeyWithCatalog();
    return changed;
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    serverLongTermPicksLoaded = true;
  }
}

async function loadServerDividendPicks(force = false) {
  if (serverDividendPicksLoaded && !force) {
    return false;
  }

  try {
    const response = await fetch("/analysis/server-dividend-picks");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "서버 배당 종목을 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.stocks) ? payload.stocks : Array.isArray(payload.items) ? payload.items : [];
    dividendEtfRecommendations = Array.isArray(payload.etfs) ? payload.etfs : [];
    const nextCatalog = syncServerDividendRecommendations(recommendationCatalog, items);
    const changed = JSON.stringify(nextCatalog) !== JSON.stringify(recommendationCatalog);
    recommendationCatalog = nextCatalog;
    if (changed) {
      saveCatalog();
    }
    syncSelectedKeyWithCatalog();
    return changed;
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    serverDividendPicksLoaded = true;
  }
}

async function loadServerSwingPicks(profile = DEFAULT_SWING_PROFILE, force = false) {
  const resolvedProfile = resolveSwingProfile(profile);
  if (serverSwingPicksLoadedByProfile[resolvedProfile] && !force) {
    return false;
  }

  try {
    const response = await fetch(`/analysis/server-swing-picks?profile=${encodeURIComponent(resolvedProfile)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "서버 스윙 종목을 불러오지 못했습니다.");
    }

    const executionItems = Array.isArray(payload.executionItems) ? payload.executionItems : [];
    const watchItems = Array.isArray(payload.watchItems) ? payload.watchItems : [];
    const items =
      executionItems.length || watchItems.length
        ? [
            ...executionItems.map((item) => ({ ...item, bucket: "execution", swingProfile: resolvedProfile })),
            ...watchItems.map((item) => ({ ...item, bucket: "watch", swingProfile: resolvedProfile }))
          ]
          : Array.isArray(payload.items)
          ? payload.items.map((item) => ({ ...item, swingProfile: resolvedProfile }))
          : [];
    const nextCatalog = syncServerSwingRecommendations(recommendationCatalog, items, resolvedProfile);
    const changed = JSON.stringify(nextCatalog) !== JSON.stringify(recommendationCatalog);
    recommendationCatalog = nextCatalog;
    if (changed) {
      saveCatalog();
    }

    const visibleKeys = new Set(recommendationCatalog.map((item) => item.key));
    for (const key of [...swingPatternByKey.keys()]) {
      if (!visibleKeys.has(key)) {
        swingPatternByKey.delete(key);
      }
    }

    syncSelectedKeyWithCatalog();
    return changed;
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    serverSwingPicksLoadedByProfile[resolvedProfile] = true;
  }
}

async function syncServerRecommendations(options = {}) {
  if (serverRecommendationSyncInFlight) {
    return;
  }

  serverRecommendationSyncInFlight = true;

  try {
    const [dividendChanged, longTermChanged, swingChanged, smallcapSwingChanged] = await Promise.all([
      loadServerDividendPicks(true),
      loadServerLongTermPicks(true),
      loadServerSwingPicks("default", true),
      loadServerSwingPicks("smallcap", true)
    ]);

    if (!dividendChanged && !longTermChanged && !swingChanged && !smallcapSwingChanged) {
      return;
    }

    if (swingChanged || smallcapSwingChanged) {
      await refreshSwingPatternSnapshots();
    }

    renderCategoryTabs();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    renderSelector();

    if (selectedKey) {
      await runAnalysisByKey(selectedKey);
    }

    if (!options.silent) {
      const defaultSwingItems = recommendationCatalog.filter(
        (item) => (item.category ?? DEFAULT_CATEGORY) === "swing" && resolveSwingProfile(item.swingProfile) === "default"
      );
      const smallcapSwingItems = recommendationCatalog.filter(
        (item) => (item.category ?? DEFAULT_CATEGORY) === "swing" && resolveSwingProfile(item.swingProfile) === "smallcap"
      );
      const executionCount = defaultSwingItems.filter((item) => item.swingBucket === "execution").length;
      const watchCount = defaultSwingItems.filter((item) => item.swingBucket === "watch").length;
      const smallcapExecutionCount = smallcapSwingItems.filter((item) => item.swingBucket === "execution").length;
      const smallcapWatchCount = smallcapSwingItems.filter((item) => item.swingBucket === "watch").length;
      const dividendCount = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === DIVIDEND_CATEGORY).length;
      showSummary(
        `서버 추천 종목을 다시 반영했습니다. 배당 ${dividendCount}개 / 배당 상장지수펀드 ${dividendEtfRecommendations.length}개 / 기본 스윙 매수후보 ${executionCount}개·관심후보 ${watchCount}개 / 소형 스윙 매수후보 ${smallcapExecutionCount}개·관심후보 ${smallcapWatchCount}개입니다.`
      );
    }
  } catch (error) {
    console.error(error);
  } finally {
    serverRecommendationSyncInFlight = false;
  }
}

async function refreshSwingPatternSnapshots() {
  const swingItems = recommendationCatalog.filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing");
  if (!swingItems.length) {
    swingPatternByKey = new Map();
    return;
  }

  try {
    const next = new Map();

    for (const profile of ["default", "smallcap"]) {
      const profileItems = swingItems.filter((item) => resolveSwingProfile(item.swingProfile) === profile);
      if (!profileItems.length) {
        continue;
      }

      const response = await fetch("/analysis/smart-money-patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile,
          items: profileItems.map((item) => ({
            name: item.name,
            symbol: item.symbol,
            note: item.note
          })),
          filters: {
            lookbackTradingDays: SWING_LOOKBACK_DAYS
          }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "스윙 패턴 상태를 불러오지 못했습니다.");
      }

      const bySymbol = new Map(profileItems.map((item) => [item.symbol, item.key]));
      for (const analysis of Array.isArray(payload.analyses) ? payload.analyses : []) {
        const key = bySymbol.get(analysis.symbol);
        if (key) {
          next.set(key, analysis);
        }
      }
    }

    swingPatternByKey = next;
  } catch (error) {
    console.error(error);
  }
}

function renderAppTabs() {
  if (appTabs) {
    for (const tab of appTabs.querySelectorAll("[data-view]")) {
      tab.classList.toggle("active", tab.dataset.view === activeView);
    }
  }

  newsView?.classList.toggle("hidden", activeView !== "news");
  indexView?.classList.toggle("hidden", activeView !== "index");
  historyView?.classList.toggle("hidden", activeView !== "history");
  analysisView?.classList.toggle("hidden", activeView !== "analysis");
  moversView?.classList.toggle("hidden", activeView !== "movers");
}

async function loadRecommendationHistory(options = {}) {
  if (recommendationHistoryLoading) {
    return;
  }

  const isBackground = Boolean(options.background && recommendationHistoryLoaded);
  recommendationHistoryLoading = true;
  recommendationHistoryError = "";
  if (!isBackground) {
    renderRecommendationHistoryBoard();
  }

  try {
    const response = await fetch("/analysis/recommendation-history/swing");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "추천 히스토리를 불러오지 못했습니다.");
    }

    recommendationHistoryPayload = payload;
    recommendationHistoryLoaded = true;
  } catch (error) {
    recommendationHistoryError = error instanceof Error ? error.message : "추천 히스토리를 불러오지 못했습니다.";
  } finally {
    recommendationHistoryLoading = false;
    renderRecommendationHistoryBoard();
  }
}

function getHistoryClosedMonth(item) {
  if (typeof item?.closedMonth === "string" && /^\d{4}-\d{2}$/.test(item.closedMonth)) {
    return item.closedMonth;
  }
  if (typeof item?.closedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.closedDate)) {
    return item.closedDate.slice(0, 7);
  }
  if (typeof item?.dataDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dataDate)) {
    return item.dataDate.slice(0, 7);
  }
  return "";
}

function formatHistoryMonthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return month || "-";
  }
  const [year, monthText] = month.split("-");
  return `${year}년 ${monthText}월`;
}

function getHistoryClosedMonthOptions(payload, closedCases) {
  const payloadMonths = Array.isArray(payload?.closedMonths)
    ? payload.closedMonths.filter((item) => typeof item?.month === "string" && /^\d{4}-\d{2}$/.test(item.month))
    : [];
  if (payloadMonths.length) {
    return payloadMonths;
  }

  return [...new Set(closedCases.map(getHistoryClosedMonth).filter(Boolean))]
    .sort((left, right) => right.localeCompare(left))
    .map((month) => ({
      month,
      label: formatHistoryMonthLabel(month),
      closedCaseCount: closedCases.filter((item) => getHistoryClosedMonth(item) === month).length
    }));
}

function ensureHistoryClosedMonthSelection(monthOptions) {
  if (!monthOptions.length) {
    recommendationHistoryClosedMonth = "all";
    return;
  }

  if (!recommendationHistoryClosedMonth) {
    recommendationHistoryClosedMonth = monthOptions[0].month;
    return;
  }

  if (
    recommendationHistoryClosedMonth !== "all" &&
    !monthOptions.some((item) => item.month === recommendationHistoryClosedMonth)
  ) {
    recommendationHistoryClosedMonth = monthOptions[0].month;
  }
}

function filterHistoryClosedCases(closedCases) {
  const selectedMonth = recommendationHistoryClosedMonth || "all";
  const normalizedSearch = normalizeSearchText(recommendationHistoryClosedSearch);

  return closedCases.filter((item) => {
    const matchesMonth = selectedMonth === "all" || getHistoryClosedMonth(item) === selectedMonth;
    if (!matchesMonth) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [item.name, item.symbol, item.profile, item.historyOutcome?.label]
      .map((value) => normalizeSearchText(value ?? ""))
      .some((value) => value.includes(normalizedSearch));
  });
}

function getHistoryClosedOutcomeGroup(item) {
  const outcome = item?.historyOutcome ?? {};
  const category = outcome.category;
  const result = outcome.returnBasis?.result;
  const type = outcome.type;

  if (category === "profit" || type === "target_hit" || type === "drift_profit_exit") {
    return "profit";
  }

  if (category === "loss" || type === "stop_broken" || type === "market_shock_stop") {
    return "loss";
  }

  if (!category && (result === "profit" || result === "loss")) {
    return result;
  }

  return "other";
}

function filterHistoryClosedCasesByOutcome(closedCases) {
  const selectedOutcome = CLOSED_HISTORY_OUTCOME_FILTERS.has(recommendationHistoryClosedOutcomeFilter)
    ? recommendationHistoryClosedOutcomeFilter
    : "all";
  if (selectedOutcome === "all") {
    return closedCases;
  }
  return closedCases.filter((item) => getHistoryClosedOutcomeGroup(item) === selectedOutcome);
}

function shouldDisplayClosedHistoryCase(item) {
  return item?.lifecycleStatus === "closed" && getExecutedBuyCountForHistoryItem(item) > 0 && item?.historyOutcome?.includeInReturnStats !== false;
}

function getClosedHistoryCasePriority(item) {
  return [
    item?.profile === "default" ? 1 : 0,
    item?.entryBucket !== "watch" ? 1 : 0,
    item?.closedDate ?? "",
    item?.openedDate ?? ""
  ];
}

function compareClosedHistoryCasePriority(left, right) {
  const leftPriority = getClosedHistoryCasePriority(left);
  const rightPriority = getClosedHistoryCasePriority(right);
  for (let index = 0; index < leftPriority.length; index += 1) {
    if (rightPriority[index] !== leftPriority[index]) {
      return String(rightPriority[index]).localeCompare(String(leftPriority[index]));
    }
  }
  return String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "ko");
}

function dedupeClosedHistoryCases(cases) {
  const grouped = new Map();
  for (const item of cases) {
    const key = item?.symbol ?? item?.id;
    if (!key) {
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.values()]
    .map((items) => [...items].sort(compareClosedHistoryCasePriority)[0])
    .filter(Boolean);
}

function getDisplayClosedHistoryCases(payload, cases) {
  const serverClosedCases = Array.isArray(payload?.closedCases) ? payload.closedCases : null;
  return serverClosedCases?.length
    ? serverClosedCases.filter(shouldDisplayClosedHistoryCase)
    : dedupeClosedHistoryCases(cases.filter(shouldDisplayClosedHistoryCase));
}

function shouldDisplayCurrentRecommendationCandidate(item) {
  if (item?.sourceBucket !== "watch") {
    return true;
  }
  // Existing history cases stay visible after an execution -> watch downgrade.
  // Otherwise live but not-yet-entered names disappear from the current board.
  if (item?.hasHistoryCase && item?.historyCase?.lifecycleStatus !== "closed") {
    return true;
  }
  return Boolean(
      item?.hasHistoryCase &&
      item?.hasEntryAssumption &&
      item?.historyCase?.lifecycleStatus !== "closed" &&
      item?.historyCase?.historyOutcome?.type !== "stop_broken" &&
      item?.historyCase?.historyOutcome?.type !== "market_shock_stop"
  );
}

function renderHistoryClosedFilterControls(monthOptions, totalClosedCount, filteredClosedCount) {
  if (historyClosedMonthSelect) {
    const selectedMonth = recommendationHistoryClosedMonth || "all";
    historyClosedMonthSelect.innerHTML = [
      `<option value="all"${selectedMonth === "all" ? " selected" : ""}>전체 종료월 (${formatNumber(totalClosedCount)})</option>`,
      ...monthOptions.map((item) => {
        const count = Number(item.closedCaseCount) || 0;
        return `<option value="${escapeHtml(item.month)}"${selectedMonth === item.month ? " selected" : ""}>${escapeHtml(item.label ?? formatHistoryMonthLabel(item.month))} (${formatNumber(count)})</option>`;
      })
    ].join("");
  }

  if (historyClosedSearchInput && historyClosedSearchInput.value !== recommendationHistoryClosedSearch) {
    historyClosedSearchInput.value = recommendationHistoryClosedSearch;
  }

  const activeOption = monthOptions.find((item) => item.month === recommendationHistoryClosedMonth);
  if (openHistoryMatrixModalBtn) {
    const monthLabel =
      recommendationHistoryClosedMonth === "all"
        ? "전체"
        : activeOption?.label ?? formatHistoryMonthLabel(recommendationHistoryClosedMonth);
    openHistoryMatrixModalBtn.textContent = `교차 검증 매트릭스 (${monthLabel} ${formatNumber(filteredClosedCount)})`;
  }
}

function renderRecommendationHistoryBoard() {
  if (!recommendationHistorySummary || !recommendationHistoryCurrentCases || !recommendationHistoryClosedCases) {
    return;
  }

  if (recommendationHistoryStatusBadge) {
    recommendationHistoryStatusBadge.className = `status-badge ${
      recommendationHistoryLoading ? "loading" : recommendationHistoryError ? "error" : recommendationHistoryLoaded ? "done" : "idle"
    }`;
    recommendationHistoryStatusBadge.textContent = recommendationHistoryLoading
      ? "로딩 중"
      : recommendationHistoryError
        ? "오류"
        : recommendationHistoryLoaded
          ? "반영 완료"
          : "대기 중";
  }

  if (recommendationHistoryLoading && !recommendationHistoryPayload) {
    recommendationHistoryCurrentCases.classList.add("history-placeholder");
    recommendationHistoryClosedCases.classList.add("history-placeholder");
    recommendationHistoryCurrentCases.innerHTML = `<div class="history-placeholder">현재 후보 목록을 불러오는 중입니다.</div>`;
    recommendationHistoryClosedCases.innerHTML = `<div class="history-placeholder">종료 케이스를 준비 중입니다.</div>`;
    renderHistoryMatrixModalBody();
    return;
  }

  if (recommendationHistoryError) {
    recommendationHistoryCurrentCases.classList.add("history-placeholder");
    recommendationHistoryClosedCases.classList.add("history-placeholder");
    recommendationHistoryCurrentCases.innerHTML = `<div class="history-placeholder">${escapeHtml(recommendationHistoryError)}</div>`;
    recommendationHistoryClosedCases.innerHTML = `<div class="history-placeholder">히스토리 파일 또는 서버 로그를 확인해 주세요.</div>`;
    renderHistoryMatrixModalBody();
    return;
  }

  const payload = recommendationHistoryPayload;
  const summary = payload?.summary ?? {};
  const cases = Array.isArray(payload?.cases) ? payload.cases : [];
  const currentCandidates = Array.isArray(payload?.currentCandidates)
    ? payload.currentCandidates.filter(shouldDisplayCurrentRecommendationCandidate)
    : [];
  const currentCases = cases.filter((item) => item.lifecycleStatus === "current");
  const closedCases = getDisplayClosedHistoryCases(payload, cases);
  const closedMonthOptions = getHistoryClosedMonthOptions(payload, closedCases);
  ensureHistoryClosedMonthSelection(closedMonthOptions);
  const filteredClosedCases = filterHistoryClosedCases(closedCases);
  const returnStatsCases = cases.filter(
    (item) =>
      getExecutedBuyCountForHistoryItem(item) > 0 &&
      item.historyOutcome?.includeInReturnStats !== false &&
      Number.isFinite(Number(item.unrealizedReturnPct))
  );
  const secondOrMore = cases.filter((item) => item.executedBuyCount >= 2);
  const profitExitCases = cases.filter((item) => item.historyOutcome?.type === "target_hit" || item.historyOutcome?.type === "drift_profit_exit");
  const averageReturn =
    returnStatsCases.length > 0
      ? returnStatsCases.reduce((sum, item) => sum + Number(item.unrealizedReturnPct), 0) / returnStatsCases.length
      : undefined;

  recommendationHistorySummary.innerHTML = [
    renderHistorySummaryCard("추적 케이스", formatNumber(summary.openedCases ?? cases.length), `${escapeHtml(payload?.asOfDate ?? "-")} 기준`, ""),
    renderHistorySummaryCard("현재 후보", formatNumber(summary.currentExecutionCount ?? currentCandidates.length), "오늘 기준 매수 후보", "neutral"),
    renderHistorySummaryCard("종료 케이스", formatNumber(summary.closedCaseCount ?? closedCases.length), "후보 이탈/종료 검증 대상", closedCases.length ? "negative" : ""),
    renderHistorySummaryCard(
      "평균 수익률",
      averageReturn == null ? "-" : formatPercent(averageReturn),
      "체결 평균가 대비",
      averageReturn == null ? "" : averageReturn >= 0 ? "positive" : "negative"
    ),
    renderHistorySummaryCard("수익 종료", formatNumber(summary.profitExitCases ?? profitExitCases.length), "슈팅/완만 상승 종료", "positive")
  ].join("");

  recommendationHistoryCurrentCases.classList.remove("history-placeholder");
  recommendationHistoryClosedCases.classList.remove("history-placeholder");
  renderHistoryClosedFilterControls(closedMonthOptions, closedCases.length, filteredClosedCases.length);
  recommendationHistoryCurrentCases.innerHTML = renderHistoryCurrentCandidateList(currentCandidates, currentCases);
  recommendationHistoryClosedCases.innerHTML = renderHistoryClosedCasePanel(filteredClosedCases, {
    emptyText:
      closedCases.length === 0
        ? "아직 종료 케이스가 없습니다. 현재 추천 중인 종목은 왼쪽 현재 상태에서 따로 추적합니다."
        : "선택한 종료월 또는 검색어에 맞는 종료 케이스가 없습니다.",
    limit: PAGE_SIZE_ALL,
    mode: "closed"
  });
  renderHistoryMatrixModalBody();
}

function renderHistorySummaryCard(label, value, description, tone = "") {
  return `
    <article class="history-summary-card ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function getExecutedBuyCountForHistoryItem(item) {
  const count = Number(item?.executedBuyCount ?? item?.historyCase?.executedBuyCount ?? item?.postEntryOutcome?.executedBuyCount);
  const executedBuys = item?.executedBuys ?? item?.historyCase?.executedBuys ?? item?.postEntryOutcome?.executedBuys;
  const maxStage = Array.isArray(executedBuys)
    ? Math.max(
        0,
        ...executedBuys
          .map((buy) => Number(buy?.stage))
          .filter((stage) => Number.isFinite(stage) && stage > 0)
      )
    : 0;
  if (maxStage > 0) {
    return maxStage;
  }
  return Number.isFinite(count) ? count : 0;
}

function openHistoryMatrixModal() {
  renderHistoryMatrixModalBody();
  historyMatrixModal?.classList.remove("hidden");
}

function closeHistoryMatrixModal() {
  historyMatrixModal?.classList.add("hidden");
}

function closeHistoryChartModal() {
  historyChartModal?.classList.add("hidden");
  activeHistoryChartItem = null;
  historyChartLoading = false;
  cleanupHistoryChart();
}

function cleanupHistoryChart() {
  if (historyChartState?.resizeObserver) {
    historyChartState.resizeObserver.disconnect();
  }
  if (historyChartState?.chart) {
    historyChartState.chart.remove();
  }
  historyChartState = null;
  historyChartModalTooltip?.classList.add("hidden");
}

function findHistoryChartItem(symbol, profile) {
  if (!symbol) {
    return null;
  }

  const payload = recommendationHistoryPayload;
  const currentCandidates = Array.isArray(payload?.currentCandidates) ? payload.currentCandidates : [];
  const currentCases = Array.isArray(payload?.cases)
    ? payload.cases.filter((item) => item.lifecycleStatus === "current")
    : [];
  const closedCases = Array.isArray(payload?.cases)
    ? payload.cases.filter(shouldDisplayClosedHistoryCase)
    : [];
  const matchesSymbol = (item) => item?.symbol === symbol || item?.historyCase?.symbol === symbol;
  const matchesProfile = (item) => !profile || item?.profile === profile || item?.historyCase?.profile === profile;

  return (
    currentCandidates.find((item) => matchesSymbol(item) && matchesProfile(item)) ??
    currentCases.find((item) => matchesSymbol(item) && matchesProfile(item)) ??
    closedCases.find((item) => matchesSymbol(item) && matchesProfile(item)) ??
    null
  );
}

function getHistoryChartDisplayItem(item) {
  const historyCase = item?.historyCase ?? item;
  const outcome = item?.postEntryOutcome ?? {};
  const buyPlan = historyCase?.buyPlan ?? item?.buyPlan;
  const averageBuyPrice = historyCase?.averageBuyPrice ?? outcome.averageBuyPrice;
  return {
    key: item?.key ?? historyCase?.id ?? `${historyCase?.name ?? ""}-${historyCase?.symbol ?? ""}`,
    name: item?.name ?? historyCase?.name,
    symbol: item?.symbol ?? historyCase?.symbol,
    profile: item?.profile ?? historyCase?.profile,
    anchorDate: item?.anchorDate ?? historyCase?.openedDate ?? historyCase?.dataDate,
    latestMentionDate: item?.latestMentionDate ?? historyCase?.dataDate,
    bucket: item?.bucket ?? historyCase?.entryBucket,
    averageBuyPrice,
    averageBuyPriceLabel: Number.isFinite(Number(averageBuyPrice)) ? "평균 매수가" : "1차 매수가",
    displayBuyPrice: Number.isFinite(Number(averageBuyPrice)) ? averageBuyPrice : buyPlan?.firstBuyPrice,
    latestClose: historyCase?.latestClose ?? outcome.latestClose,
    unrealizedReturnPct: historyCase?.unrealizedReturnPct ?? outcome.unrealizedReturnPct,
    executedBuyCount: historyCase?.executedBuyCount ?? outcome.executedBuyCount,
    buyPlan
  };
}

function renderHistoryChartModalShell(item, options = {}) {
  const displayItem = getHistoryChartDisplayItem(item);
  if (historyChartModalTitle) {
    historyChartModalTitle.textContent = `${displayItem.name ?? "-"} 차트`;
  }
  if (historyChartModalMeta) {
    historyChartModalMeta.textContent = `${displayItem.symbol ?? "-"} / ${displayItem.profile ?? "-"} / ${displayItem.bucket ?? "-"}`;
  }

  if (historyChartModalSummary) {
    if (options.error) {
      historyChartModalSummary.innerHTML = `<div class="history-placeholder">${escapeHtml(options.error)}</div>`;
    } else if (options.loading) {
      historyChartModalSummary.innerHTML = `<div class="history-placeholder">차트 데이터를 불러오는 중입니다.</div>`;
    } else {
      const returnValue = Number(displayItem.unrealizedReturnPct);
      const returnClass = Number.isFinite(returnValue) && returnValue > 0 ? "positive" : Number.isFinite(returnValue) && returnValue < 0 ? "negative" : "neutral";
      historyChartModalSummary.innerHTML = [
        renderHistoryChartSummaryItem("현재가", formatNumber(displayItem.latestClose), ""),
        renderHistoryChartSummaryItem(displayItem.averageBuyPriceLabel, formatNumber(displayItem.displayBuyPrice), ""),
        renderHistoryChartSummaryItem("수익률", Number.isFinite(returnValue) ? formatPercent(returnValue) : "-", returnClass),
        renderHistoryChartSummaryItem("체결 단계", `${formatNumber(displayItem.executedBuyCount ?? 0)}차`, "")
      ].join("");
    }
  }

  if (historyChartModalStartDate) {
    historyChartModalStartDate.textContent = "-";
  }
  if (historyChartModalEndDate) {
    historyChartModalEndDate.textContent = "-";
  }
}

function renderHistoryChartSummaryItem(label, value, tone = "") {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong class="${escapeHtml(tone)}">${escapeHtml(value)}</strong>
    </article>
  `;
}

async function openHistoryChartModal(input = {}) {
  const item = findHistoryChartItem(input.symbol, input.profile);
  if (!item) {
    showAppToast({
      title: "차트 열기 실패",
      message: "추천 히스토리에서 해당 종목을 찾지 못했습니다.",
      tone: "negative"
    });
    return;
  }

  const displayItem = getHistoryChartDisplayItem(item);
  activeHistoryChartItem = displayItem;
  historyChartLoading = true;
  historyChartModal?.classList.remove("hidden");
  cleanupHistoryChart();
  renderHistoryChartModalShell(item, { loading: true });

  try {
    const response = await fetch("/analysis/realtime-stock-detail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: displayItem.key,
        name: displayItem.name,
        symbol: displayItem.symbol,
        anchorDate: displayItem.anchorDate,
        category: "swing"
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "차트 데이터를 불러오지 못했습니다.");
    }

    if (activeHistoryChartItem?.symbol !== displayItem.symbol || activeHistoryChartItem?.profile !== displayItem.profile) {
      return;
    }

    const latestClose = typeof payload.latestClose === "number" ? payload.latestClose : displayItem.latestClose;
    const averageBuyPrice = displayItem.averageBuyPrice;
    const unrealizedReturnPct =
      typeof averageBuyPrice === "number" && Number.isFinite(averageBuyPrice) && averageBuyPrice !== 0 && typeof latestClose === "number"
        ? ((latestClose - averageBuyPrice) / averageBuyPrice) * 100
        : displayItem.unrealizedReturnPct;
    activeHistoryChartItem = {
      ...displayItem,
      latestClose,
      unrealizedReturnPct
    };
    renderHistoryChartModalShell(activeHistoryChartItem);
    syncHistoryChartModal(payload.chartWindow?.points ?? [], activeHistoryChartItem);
  } catch (error) {
    console.error(error);
    renderHistoryChartModalShell(item, {
      error: error instanceof Error ? error.message : "차트 데이터를 불러오지 못했습니다."
    });
  } finally {
    historyChartLoading = false;
  }
}

function syncHistoryChartModal(points, item) {
  if (!historyChartModalContainer || !Array.isArray(points) || !points.length) {
    return;
  }

  if (!historyChartState) {
    historyChartState = createMarketWatchChartState(historyChartModalContainer, historyChartModalTooltip);
  }

  const movingAverageConfig = getMarketWatchMovingAverageConfig("daily");
  historyChartState.points = points;
  historyChartState.movingAverageConfig = movingAverageConfig;

  historyChartState.candleSeries.setData(points.map((point) => ({
    time: point.date,
    open: point.open ?? point.close,
    high: point.high ?? point.close,
    low: point.low ?? point.close,
    close: point.close
  })));
  historyChartState.volumeSeries.setData(points.map((point) => ({
    time: point.date,
    value: point.volume ?? 0,
    color: (point.close ?? 0) >= (point.open ?? point.close ?? 0) ? "rgba(216,76,63,0.34)" : "rgba(47,110,229,0.3)"
  })));

  for (const [index, series] of historyChartState.movingAverageSeries.entries()) {
    const config = movingAverageConfig[index];
    if (!config) {
      series.setData([]);
      continue;
    }
    series.applyOptions({ color: config.color });
    series.setData(buildIndexMovingAverage(points, config.period));
  }

  const priceLines = [];
  if (typeof item.averageBuyPrice === "number" && Number.isFinite(item.averageBuyPrice) && item.averageBuyPrice > 0) {
    priceLines.push(
      historyChartState.candleSeries.createPriceLine({
        price: item.averageBuyPrice,
        color: "rgba(202, 138, 4, 0.95)",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "평균 매수가"
      })
    );
  }
  if (typeof item.buyPlan?.stopLossPrice === "number" && Number.isFinite(item.buyPlan.stopLossPrice) && item.buyPlan.stopLossPrice > 0) {
    priceLines.push(
      historyChartState.candleSeries.createPriceLine({
        price: item.buyPlan.stopLossPrice,
        color: "rgba(185, 28, 28, 0.95)",
        lineStyle: LineStyle.Dotted,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "손절가"
      })
    );
  }

  for (const priceLine of historyChartState.priceLines ?? []) {
    historyChartState.candleSeries.removePriceLine(priceLine);
  }
  historyChartState.priceLines = priceLines;
  historyChartState.chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, points.length - DEFAULT_VISIBLE_TRADING_SESSIONS) - 1,
    to: points.length - 1 + CHART_RIGHT_ANCHOR_OFFSET
  });

  if (historyChartModalStartDate) {
    historyChartModalStartDate.textContent = points[0]?.date ?? "-";
  }
  if (historyChartModalEndDate) {
    historyChartModalEndDate.textContent = points.at(-1)?.date ?? "-";
  }
}

function renderHistoryMatrixModalBody() {
  if (!historyMatrixModalBody) {
    return;
  }

  if (recommendationHistoryLoading && !recommendationHistoryPayload) {
    historyMatrixModalBody.innerHTML = `<div class="history-placeholder">교차 검증 데이터를 불러오는 중입니다.</div>`;
    return;
  }

  if (recommendationHistoryError) {
    historyMatrixModalBody.innerHTML = `<div class="history-placeholder">${escapeHtml(recommendationHistoryError)}</div>`;
    return;
  }

  const payload = recommendationHistoryPayload;
  const cases = Array.isArray(payload?.cases) ? payload.cases : [];
  const closedCases = getDisplayClosedHistoryCases(payload, cases);
  const closedMonthOptions = getHistoryClosedMonthOptions(payload, closedCases);
  ensureHistoryClosedMonthSelection(closedMonthOptions);
  const filteredClosedCases = filterHistoryClosedCases(closedCases);
  const currentCandidates = Array.isArray(payload?.currentCandidates)
    ? payload.currentCandidates.filter(shouldDisplayCurrentRecommendationCandidate)
    : [];
  const activeMonth = closedMonthOptions.find((item) => item.month === recommendationHistoryClosedMonth);
  const monthLabel =
    recommendationHistoryClosedMonth === "all"
      ? "전체 종료월"
      : activeMonth?.label ?? formatHistoryMonthLabel(recommendationHistoryClosedMonth);

  historyMatrixModalBody.innerHTML = `
    <div class="history-modal-summary">
      <article>
        <span>${escapeHtml(monthLabel)} 종료</span>
        <strong>${formatNumber(filteredClosedCases.length)}</strong>
      </article>
      <article>
        <span>현재 후보</span>
        <strong>${formatNumber(currentCandidates.length)}</strong>
      </article>
    </div>
    ${renderHistoryMatrix(payload?.summary ?? {}, filteredClosedCases, {
      emptyText:
        closedCases.length === 0
          ? "현재 종료 케이스가 없어 교차 검증 매트릭스는 비어 있습니다. 진행 중 후보는 현재 추천 상태에서 별도 추적합니다."
          : "선택한 종료월 또는 검색어에 맞는 종료 케이스가 없습니다."
    })}
  `;
}

function renderHistoryMatrix(_summary, cases, options = {}) {
  if (!cases.length) {
    return `<div class="history-placeholder">${escapeHtml(options.emptyText ?? "아직 표시할 스윙 히스토리 케이스가 없습니다.")}</div>`;
  }

  const rows = [
    ["슈팅 수익", cases.filter((item) => item.historyOutcome?.type === "target_hit").length],
    ["완만 상승", cases.filter((item) => item.historyOutcome?.type === "drift_profit_exit").length],
    ["시장충격 유예", cases.filter((item) => item.historyOutcome?.type === "market_shock_grace").length],
    ["손절 종료", cases.filter((item) => item.historyOutcome?.type === "stop_broken" || item.historyOutcome?.type === "market_shock_stop").length],
    ["시간 종료", cases.filter((item) => item.historyOutcome?.type === "stale_timeout").length]
  ];

  return `
    <div class="history-matrix">
      <div class="history-matrix-row history-matrix-head">
        <span>체결 가정</span>
        <span>케이스</span>
        <span>비중</span>
      </div>
      ${rows
        .map(([label, count]) => {
          const ratio = cases.length ? (Number(count) / cases.length) * 100 : 0;
          return `
            <div class="history-matrix-row">
              <span>${escapeHtml(label)}</span>
              <strong>${formatNumber(Number(count))}</strong>
              <span>${formatUnsignedPercent(ratio)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getHistoryRecommendationStartDate(item) {
  const historyCase = item?.historyCase ?? item;
  return (
    historyCase?.openedDate ??
    historyCase?.initialSnapshot?.anchorDate ??
    item?.anchorDate ??
    item?.latestMentionDate ??
    historyCase?.dataDate ??
    ""
  );
}

function getCurrentHistoryExecutedBuyCount(item) {
  return getExecutedBuyCountForHistoryItem(item);
}

function sortCurrentHistoryRowsByRecent(rows) {
  return [...rows].sort((left, right) => {
    const leftDate = getHistoryRecommendationStartDate(left);
    const rightDate = getHistoryRecommendationStartDate(right);
    if (rightDate !== leftDate) {
      return rightDate.localeCompare(leftDate);
    }
    return String(left.name ?? left.historyCase?.name ?? "").localeCompare(String(right.name ?? right.historyCase?.name ?? ""), "ko");
  });
}

function renderHistoryCurrentCandidateCard(item) {
  const historyCase = item.historyCase;
  const hasHistoryCase = Boolean(item.hasHistoryCase && historyCase);
  const liveOutcome = item.postEntryOutcome ?? {};
  const executedBuyCount = getCurrentHistoryExecutedBuyCount(item);
  const executedBuys = hasHistoryCase ? historyCase?.executedBuys : item.postEntryOutcome?.executedBuys;
  const buyPlan = historyCase?.buyPlan ?? item.buyPlan;
  const returnValue = Number(hasHistoryCase ? historyCase?.unrealizedReturnPct : liveOutcome.unrealizedReturnPct);
  const averageBuyPrice = hasHistoryCase ? historyCase?.averageBuyPrice : liveOutcome.averageBuyPrice;
  const displayBuyPrice = Number.isFinite(Number(averageBuyPrice)) ? averageBuyPrice : buyPlan?.firstBuyPrice;
  const displayBuyPriceLabel = Number.isFinite(Number(averageBuyPrice)) ? "평균" : "1차";
  const latestClose = hasHistoryCase ? historyCase?.latestClose ?? liveOutcome.latestClose : liveOutcome.latestClose;
  const returnClass = Number.isFinite(returnValue) && returnValue > 0 ? "positive" : Number.isFinite(returnValue) && returnValue < 0 ? "negative" : "neutral";
  const returnBadge = Number.isFinite(returnValue)
    ? `<span class="history-case-return ${returnClass}">${formatPercent(returnValue)}</span>`
    : "";
  const bucketLabel = item.sourceBucket === "watch" ? "관찰 후보" : "매수 후보";
  const startDate = getHistoryRecommendationStartDate(item);
  const thirdBuyStatusHtml = renderThirdBuyExecutionStatus(historyCase ?? item, item);

  return `
    <article
      class="history-case-card current"
      role="button"
      tabindex="0"
      data-history-chart-symbol="${escapeHtml(item.symbol ?? historyCase?.symbol ?? "")}"
      data-history-chart-profile="${escapeHtml(item.profile ?? historyCase?.profile ?? "")}"
      aria-label="${escapeHtml(item.name ?? historyCase?.name ?? "-")} 차트 열기"
    >
      <div class="history-case-main">
        <div class="history-case-copy">
          <div class="history-case-head">
            <div>
              <div class="history-case-title-line">
                <strong>${escapeHtml(item.name ?? historyCase?.name ?? "-")}</strong>
                ${renderHistoryExecutionBadge(executedBuyCount)}
              </div>
              <span>${escapeHtml(item.symbol ?? historyCase?.symbol ?? "-")} / ${escapeHtml(item.profile ?? historyCase?.profile ?? "-")} / ${escapeHtml(bucketLabel)}</span>
            </div>
            <div class="history-case-tail">
              ${returnBadge}
            </div>
          </div>
          <div class="history-case-metrics">
            <span>추천 ${escapeHtml(startDate || "-")}</span>
            <span>현재가 ${formatNumber(latestClose)}</span>
            <span>${escapeHtml(displayBuyPriceLabel)} ${formatNumber(displayBuyPrice)}</span>
          </div>
        </div>
        ${renderHistoryBuyLevels(buyPlan, executedBuys, {
          highlightMode: "deepest",
          stagedBuyDiagnostics: historyCase?.stagedBuyDiagnostics,
          recommendation: item
        })}
        ${thirdBuyStatusHtml}
      </div>
    </article>
  `;
}

function renderHistoryCurrentStageSummary(enteredRows) {
  const stageGroups = [
    { stage: "all", label: "전체", description: "전체 후보", items: enteredRows },
    { stage: 1, label: "1차", description: "1차 체결" },
    { stage: 2, label: "2차", description: "2차 체결" },
    { stage: 3, label: "3차", description: "3차 이상 체결" }
  ].map((group) =>
    group.stage === "all"
      ? group
      : {
          ...group,
          items: enteredRows.filter((item) => Math.min(3, getCurrentHistoryExecutedBuyCount(item)) === group.stage)
        }
  );

  return `
    <div class="history-current-stage-summary">
      ${stageGroups
        .map((group) => `
          <button
            class="history-current-stage-card stage-${group.stage} ${recommendationHistoryCurrentStageFilter === String(group.stage) ? "active" : ""}"
            type="button"
            data-history-current-stage-filter="${group.stage}"
            aria-pressed="${recommendationHistoryCurrentStageFilter === String(group.stage) ? "true" : "false"}"
          >
            <div class="history-current-stage-card-head">
              <div>
                <strong>${escapeHtml(group.label)}</strong>
                <span>${escapeHtml(group.description)}</span>
              </div>
              <em>${formatNumber(group.items.length)}</em>
            </div>
          </button>
        `)
        .join("")}
    </div>
  `;
}

function renderHistoryCurrentCandidateList(currentCandidates, currentCases) {
  const rowKey = (item) => `${item?.profile ?? item?.historyCase?.profile ?? ""}:${item?.symbol ?? item?.historyCase?.symbol ?? ""}`;
  const rowsByKey = new Map(currentCandidates.map((item) => [rowKey(item), item]));

  for (const item of currentCases) {
    const key = rowKey(item);
    if (rowsByKey.has(key) || getExecutedBuyCountForHistoryItem(item) <= 0) {
      continue;
    }

    rowsByKey.set(key, {
      name: item.name,
      symbol: item.symbol,
      profile: item.profile,
      bucket: item.currentRecommendation?.bucket ?? item.entryBucket,
      sourceBucket: item.currentRecommendation?.sourceBucket ?? "watch",
      hasHistoryCase: true,
      hasEntryAssumption: true,
      historyCase: item
    });
  }

  const rows = [...rowsByKey.values()];
  const enteredRows = sortCurrentHistoryRowsByRecent(rows);
  const validStageFilters = new Set(["all", "1", "2", "3"]);
  if (!validStageFilters.has(String(recommendationHistoryCurrentStageFilter))) {
    recommendationHistoryCurrentStageFilter = "all";
  }

  if (!enteredRows.length) {
    return `<div class="history-placeholder">현재 추천 후보가 없습니다.</div>`;
  }

  const filteredRows =
    recommendationHistoryCurrentStageFilter === "all"
      ? enteredRows
      : enteredRows.filter(
          (item) => Math.min(3, getCurrentHistoryExecutedBuyCount(item)) === Number(recommendationHistoryCurrentStageFilter)
        );

  return `
    ${renderHistoryCurrentStageSummary(enteredRows)}
    <div class="history-case-list">
      ${
        filteredRows.length
          ? filteredRows.slice(0, 36).map(renderHistoryCurrentCandidateCard).join("")
          : `<div class="history-placeholder">선택한 체결 단계의 현재 추천 후보가 없습니다.</div>`
      }
    </div>
  `;
}

function renderHistoryClosedOutcomeTabs(cases) {
  const activeFilter = CLOSED_HISTORY_OUTCOME_FILTERS.has(recommendationHistoryClosedOutcomeFilter)
    ? recommendationHistoryClosedOutcomeFilter
    : "all";
  const tabItems = [
    { key: "all", label: "전체", description: "종료", count: cases.length },
    { key: "profit", label: "수익", description: "목표/상승", count: cases.filter((item) => getHistoryClosedOutcomeGroup(item) === "profit").length },
    { key: "loss", label: "손절", description: "손절/손실", count: cases.filter((item) => getHistoryClosedOutcomeGroup(item) === "loss").length },
    { key: "other", label: "기타", description: "시간/제외", count: cases.filter((item) => getHistoryClosedOutcomeGroup(item) === "other").length }
  ];

  return `
    <div class="history-closed-outcome-tabs" role="tablist" aria-label="종료 케이스 결과 필터">
      ${tabItems
        .map((item) => `
          <button
            class="history-closed-outcome-tab ${item.key} ${activeFilter === item.key ? "active" : ""}"
            type="button"
            role="tab"
            aria-selected="${activeFilter === item.key ? "true" : "false"}"
            data-history-closed-outcome-filter="${escapeHtml(item.key)}"
          >
            <span>${escapeHtml(item.label)}</span>
            <strong>${formatNumber(item.count)}</strong>
            <em>${escapeHtml(item.description)}</em>
          </button>
        `)
        .join("")}
    </div>
  `;
}

function renderHistoryClosedCasePanel(cases, options = {}) {
  if (!CLOSED_HISTORY_OUTCOME_FILTERS.has(recommendationHistoryClosedOutcomeFilter)) {
    recommendationHistoryClosedOutcomeFilter = "all";
  }

  const filteredCases = filterHistoryClosedCasesByOutcome(cases);
  const emptyText = cases.length
    ? "선택한 종료 유형에 맞는 케이스가 없습니다."
    : options.emptyText;

  return `
    ${renderHistoryClosedOutcomeTabs(cases)}
    ${renderHistoryCaseList(filteredCases, {
      ...options,
      emptyText
    })}
  `;
}

function renderHistoryCaseList(cases, options = {}) {
  if (!cases.length) {
    return `<div class="history-placeholder">${escapeHtml(options.emptyText ?? "최근 케이스가 없습니다.")}</div>`;
  }

  const limit = options.limit ?? 12;
  const mode = options.mode ?? "history";

  return `
    <div class="history-case-list">
      ${cases
        .slice(0, limit)
        .map((item) => {
          const outcome = item.historyOutcome ?? getActiveHistoryOutcome(item.executedBuyCount);
          const displayReturnValue =
            mode === "closed" && Number.isFinite(Number(outcome?.returnBasis?.returnPct))
              ? Number(outcome.returnBasis.returnPct)
              : Number(item.unrealizedReturnPct);
          const returnClass = displayReturnValue > 0 ? "positive" : displayReturnValue < 0 ? "negative" : "neutral";
          const statusLabel = mode === "closed" ? outcome.label : item.lifecycleStatus === "current" ? "현재" : "기록";
          const statusClass = mode === "closed" ? "closed" : item.lifecycleStatus === "current" ? "current" : "neutral";
          const openedDate = item.openedDate ?? item.initialSnapshot?.anchorDate;
          const closedDate = item.closedDate ?? item.dataDate;
          const priceLabel = mode === "closed" ? "종료가" : "현재가";
          const metricsHtml = `
            <div class="history-case-metrics">
              <span>${priceLabel} ${formatNumber(item.latestClose)}</span>
              <span>평균 ${formatNumber(item.averageBuyPrice)}</span>
              ${mode === "closed" ? `<span>추천 ${escapeHtml(openedDate ?? "-")} / 종료 ${escapeHtml(closedDate ?? "-")}</span>` : ""}
              ${renderHistoryOutcomeChip(outcome)}
            </div>
          `;
          return `
            <article
              class="history-case-card ${escapeHtml(statusClass)}"
              role="${mode === "closed" ? "button" : "article"}"
              tabindex="${mode === "closed" ? "0" : "-1"}"
              data-history-chart-symbol="${mode === "closed" ? escapeHtml(item.symbol ?? "") : ""}"
              data-history-chart-profile="${mode === "closed" ? escapeHtml(item.profile ?? "") : ""}"
              aria-label="${mode === "closed" ? `${escapeHtml(item.name ?? "-")} 차트 열기` : ""}"
            >
              <div class="history-case-main">
                <div class="history-case-copy">
                  <div class="history-case-head">
                    <div>
                      <div class="history-case-title-line">
                        <strong>${escapeHtml(item.name ?? "-")}</strong>
                        ${renderHistoryExecutionBadge(item.executedBuyCount)}
                      </div>
                      <span>${escapeHtml(item.symbol ?? "-")} / ${escapeHtml(item.profile ?? "-")}</span>
                    </div>
                    <div class="history-case-tail">
                      <span class="history-status-pill ${escapeHtml(statusClass)}">${escapeHtml(statusLabel)}</span>
                      ${Number.isFinite(displayReturnValue) ? `<span class="history-case-return ${returnClass}">${formatPercent(displayReturnValue)}</span>` : ""}
                    </div>
                  </div>
                  ${mode === "closed" ? "" : metricsHtml}
                </div>
                ${renderHistoryBuyLevels(item.buyPlan, item.executedBuys, {
                  stagedBuyDiagnostics: item.stagedBuyDiagnostics,
                  recommendation: item.currentRecommendation
                })}
                ${renderThirdBuyExecutionStatus(item, item.currentRecommendation)}
                ${mode === "closed" ? metricsHtml : ""}
                ${mode === "closed" ? renderHistoryOutcomeBasis(outcome) : ""}
                ${mode === "closed" ? renderHistoryClosedReason(outcome) : ""}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHistoryExecutionBadge(executedBuyCount) {
  const count = Number(executedBuyCount) || 0;
  if (count <= 0) {
    return "";
  }

  return `<span class="history-execution-badge stage-${Math.min(3, count)}">${formatNumber(count)}차 체결</span>`;
}

function getActiveHistoryOutcome(executedBuyCount) {
  return Number(executedBuyCount) > 0
    ? { label: "진행 중", category: "active", description: "현재 추천 목록에 남아 있습니다." }
    : { label: "현재 후보", category: "active", description: "현재 추천 목록에 남아 있습니다." };
}

function renderHistoryOutcomeChip(outcome) {
  if (!outcome?.label) {
    return "";
  }

  return `<span class="history-outcome-chip ${escapeHtml(outcome.category ?? "neutral")}" title="${escapeHtml(outcome.description ?? "")}">${escapeHtml(outcome.label)}</span>`;
}

function renderHistoryOutcomeBasis(outcome) {
  const basis = outcome?.returnBasis;
  if (!basis) {
    return "";
  }

  const returnValue = Number(basis.returnPct);
  const returnClass = Number.isFinite(returnValue) && returnValue > 0 ? "positive" : Number.isFinite(returnValue) && returnValue < 0 ? "negative" : "neutral";
  const resultLabel =
    basis.result === "profit"
      ? "수익"
      : basis.result === "loss"
        ? "손절/손실"
        : basis.result === "excluded"
          ? "미체결"
          : "중립";
  const thresholdText =
    basis.thresholdLabel && Number.isFinite(Number(basis.thresholdPct))
      ? `${basis.thresholdLabel} ${formatPercent(Number(basis.thresholdPct)).replace("+", "")}`
      : basis.thresholdLabel && Number.isFinite(Number(basis.stopLossPrice))
        ? `${basis.thresholdLabel} ${formatNumber(basis.stopLossPrice)}`
        : "";

  return `
    <div class="history-outcome-basis">
      <span>${escapeHtml(resultLabel)}</span>
      <strong class="${escapeHtml(returnClass)}">${Number.isFinite(returnValue) ? formatPercent(returnValue) : "-"}</strong>
      <em>
        ${escapeHtml(basis.basisPriceLabel ?? "기준가")} ${formatNumber(basis.basisPrice)}
        → ${escapeHtml(basis.comparePriceLabel ?? "비교가")} ${formatNumber(basis.comparePrice)}
        ${thresholdText ? ` / ${escapeHtml(thresholdText)}` : ""}
      </em>
    </div>
  `;
}

function renderHistoryClosedReason(outcome) {
  if (!outcome?.description && !outcome?.closeBasis?.rule) {
    return "";
  }

  const stopText =
    Number.isFinite(Number(outcome?.returnBasis?.stopLossPrice))
      ? `손절가 ${formatNumber(outcome.returnBasis.stopLossPrice)} 기준입니다.`
      : "";
  const parts = [outcome?.closeBasis?.rule, stopText, outcome?.description].filter(Boolean);

  return `
    <p class="history-case-reason">${escapeHtml(parts.join(" "))}</p>
  `;
}

function getReasonList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function hasReason(value, reason) {
  return getReasonList(value).some((item) => item === reason || item.startsWith(`${reason}:`));
}

function getStageDiagnostic(stagedBuyDiagnostics, stage) {
  const touches = Array.isArray(stagedBuyDiagnostics?.stageTouches) ? stagedBuyDiagnostics.stageTouches : [];
  return touches.find((item) => Number(item?.stage) === Number(stage));
}

function formatHistoryBuyDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return match ? `${match[2]}-${match[3]}` : "";
}

function getThirdBuyExecutionStatus(historyCase, recommendation) {
  const stagedBuyDiagnostics = historyCase?.stagedBuyDiagnostics;
  const thirdTouch = getStageDiagnostic(stagedBuyDiagnostics, 3);
  const recommendationReasons = [
    ...getReasonList(recommendation?.reasons),
    ...getReasonList(historyCase?.currentRecommendation?.reasons),
    ...getReasonList(historyCase?.decisionSnapshot?.reasons)
  ];
  const blockedByEngine = recommendationReasons.some((reason) =>
    reason === "third_buy_confirmation_required" ||
    reason === "third_buy_not_confirmed" ||
    reason === "execution_blocked_by_deep_entry_policy"
  );
  const effectiveBuyPlan = stagedBuyDiagnostics?.buyPlan ?? historyCase?.buyPlan;
  const thirdPrice = thirdTouch?.price ?? effectiveBuyPlan?.thirdBuyPrice;
  const originalThirdPrice = effectiveBuyPlan?.originalThirdBuyPrice;
  const adjustedThirdPrice = effectiveBuyPlan?.adjustedThirdBuyPrice;

  if (Number(thirdTouch?.stage) !== 3 && !Number.isFinite(Number(thirdPrice)) && !blockedByEngine) {
    return undefined;
  }

  if (blockedByEngine) {
    return {
      tone: "blocked",
      label: "3차 보류",
      detail: "지지/캔들/거래량/ENV 확인 전"
    };
  }

  if (thirdTouch?.status === "executed") {
    return {
      tone: "executed",
      label: "3차 체결",
      detail: thirdTouch.confirmedDate ?? thirdTouch.touchedDate ?? "체결 기록"
    };
  }

  if (thirdTouch?.mode === "confirmation_required") {
    return {
      tone: "pending",
      label: "3차 확인 필요",
      detail: Number.isFinite(Number(thirdPrice)) ? `${formatNumber(thirdPrice)} 기준` : "가격 도달 전"
    };
  }

  if (thirdTouch?.mode === "not_reached") {
    return {
      tone: "waiting",
      label: "3차 대기",
      detail: Number.isFinite(Number(thirdPrice)) ? `${formatNumber(thirdPrice)} 미도달` : "계획가 없음"
    };
  }

  if (thirdTouch?.mode === "waiting_reclaim") {
    return {
      tone: "blocked",
      label: "3차 회복 대기",
      detail: Number.isFinite(Number(thirdPrice)) ? `${formatNumber(thirdPrice)} 회복 전` : "회복 확인 전"
    };
  }

  if (thirdTouch?.mode === "stop_zone") {
    return {
      tone: "blocked",
      label: "3차 중단",
      detail: "손절 구간 우선"
    };
  }

  return {
    tone: "waiting",
    label: "3차 대기",
    detail: Number.isFinite(Number(thirdPrice)) ? `${formatNumber(thirdPrice)} 기준` : "계획가 없음"
  };
}

function renderThirdBuyExecutionStatus(historyCase, recommendation) {
  const status = getThirdBuyExecutionStatus(historyCase, recommendation);
  if (!status) {
    return "";
  }

  return `
    <div class="history-third-buy-status ${escapeHtml(status.tone)}">
      <span>${escapeHtml(status.label)}</span>
      <strong>${escapeHtml(status.detail)}</strong>
    </div>
  `;
}

function renderHistoryBuyLevels(buyPlan, executedBuys, options = {}) {
  const rawExecutedStages = (Array.isArray(executedBuys) ? executedBuys : [])
    .map((buy) => Number(buy?.stage))
    .filter((stage) => Number.isFinite(stage) && stage > 0);
  const deepestExecutedStage = rawExecutedStages.length ? Math.max(...rawExecutedStages) : 0;
  const executedStages = new Set(
    options.highlightMode === "deepest" && deepestExecutedStage > 0 ? [deepestExecutedStage] : rawExecutedStages
  );
  const executedByStage = new Map(
    (Array.isArray(executedBuys) ? executedBuys : [])
      .filter((buy) => Number.isFinite(Number(buy?.stage)))
      .map((buy) => [Number(buy.stage), buy])
  );
  const plannedBuys = buyPlan
    ? [
        { stage: 1, price: buyPlan.firstBuyPrice },
        { stage: 2, price: buyPlan.secondBuyPrice },
        {
          stage: 3,
          price: buyPlan.thirdBuyPrice,
          originalPrice: buyPlan.originalThirdBuyPrice,
          adjusted: Number.isFinite(Number(buyPlan.adjustedThirdBuyPrice))
        }
      ].filter((buy) => Number.isFinite(Number(buy.price)))
    : [];
  const fallbackBuys = Array.isArray(executedBuys)
    ? executedBuys.filter((buy) => Number.isFinite(Number(buy?.price)))
    : [];
  const buys = plannedBuys.length ? plannedBuys : fallbackBuys;
  if (!buys.length) {
    return "";
  }
  const thirdBuyAdjustmentNote =
    buyPlan?.adjustedThirdBuyPrice && Number.isFinite(Number(buyPlan.originalThirdBuyPrice))
      ? `<div class="history-buy-adjustment-note">3차 조정 ${formatNumber(buyPlan.originalThirdBuyPrice)} -> ${formatNumber(buyPlan.adjustedThirdBuyPrice)}</div>`
      : "";

  return `
    <div class="history-buy-levels">
      ${[...buys]
        .sort((left, right) => Number(left.stage ?? 0) - Number(right.stage ?? 0))
        .map((buy) => {
          const stage = Number(buy.stage ?? 0);
          const diagnostic = getStageDiagnostic(options.stagedBuyDiagnostics, stage);
          const thirdStatus = stage === 3 ? getThirdBuyExecutionStatus(
            {
              buyPlan,
              stagedBuyDiagnostics: options.stagedBuyDiagnostics
            },
            options.recommendation
          ) : undefined;
          const stageClass = stage >= 1 && stage <= 3 ? `stage-${stage}` : "stage-extra";
          const executionClass = executedStages.has(stage) ? "executed" : "pending";
          const confirmationClass = thirdStatus?.tone === "blocked"
            ? "confirmation-blocked"
            : thirdStatus?.tone === "pending"
              ? "confirmation-required"
              : "";
          const statusLabel =
            stage === 3 && thirdStatus?.tone === "blocked"
              ? "보류"
              : stage === 3 && thirdStatus?.tone === "pending"
                ? "확인"
                : diagnostic?.touchedDate && executionClass === "pending"
                  ? "터치"
                  : "";
          const executedBuy = executedByStage.get(stage);
          const buyDate = formatHistoryBuyDate(
            executedBuy?.date ?? diagnostic?.executedDate ?? diagnostic?.confirmedDate ?? diagnostic?.touchedDate
          );
          return `
            <span class="history-buy-level ${escapeHtml(stageClass)} ${executionClass} ${escapeHtml(confirmationClass)}">
              <em>${formatNumber(stage)}차 매수가${statusLabel ? ` · ${escapeHtml(statusLabel)}` : ""}</em>
              <strong><span>${formatNumber(buy.price)}</span>${buyDate ? `<small>${escapeHtml(buyDate)}</small>` : ""}</strong>
            </span>
          `;
        })
        .join("")}
      ${thirdBuyAdjustmentNote}
    </div>
  `;
}

function formatUnsignedPercent(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}%`;
}

function getMarketWatchMovingAverageConfig(timeframe) {
  if (isMarketWatchMinuteTimeframe(timeframe)) {
    return [
      { key: "fast", label: "5봉선", period: 5, className: "fast-line", color: "#177245" },
      { key: "short", label: "20봉선", period: 20, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "60봉선", period: 60, className: "long-line", color: "#2563eb" }
    ];
  }

  if (timeframe === "weekly") {
    return [
      { key: "fast", label: "5주선", period: 5, className: "fast-line", color: "#177245" },
      { key: "short", label: "20주선", period: 20, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "60주선", period: 60, className: "long-line", color: "#2563eb" },
      { key: "extended", label: "120주선", period: 120, className: "extended-line", color: "#7c3aed" }
    ];
  }

  if (timeframe === "yearly") {
    return [
      { key: "short", label: "3년선", period: 3, className: "short-line", color: "#d84c3f" },
      { key: "long", label: "5년선", period: 5, className: "long-line", color: "#2563eb" }
    ];
  }

  return [
    { key: "fast", label: "5일선", period: 5, className: "fast-line", color: "#177245" },
    { key: "short", label: "20일선", period: 20, className: "short-line", color: "#d84c3f" },
    { key: "long", label: "60일선", period: 60, className: "long-line", color: "#2563eb" },
    { key: "extended", label: "120일선", period: 120, className: "extended-line", color: "#7c3aed" }
  ];
}

function renderIndexWatchList() {
  if (!indexWatchList) {
    return;
  }

  indexWatchList.innerHTML = indexWatchSeed
    .map((item) => {
      const snapshot = marketWatchItems.get(item.key);
      const displayMetrics = snapshot ? getMarketWatchDisplayMetrics(snapshot, "daily") : null;
      const marketWatchDisplayDate = displayMetrics?.latestDate ?? getMarketWatchDisplayDate();
      const trendClass =
        displayMetrics?.changePercent > 0 ? "positive" : displayMetrics?.changePercent < 0 ? "negative" : "neutral";
      const priceDirectionClass =
        displayMetrics?.changeAmount > 0 ? "positive" : displayMetrics?.changeAmount < 0 ? "negative" : "neutral";
      const priceDirectionValue = displayMetrics?.changeAmount;
      const categoryLabel = item.category;
      const pillLabel =
        item.status === "planned"
          ? "추가 예정"
          : marketWatchLoading && !snapshot
            ? "불러오는 중"
            : snapshot?.error
              ? "연동 실패"
              : displayMetrics?.changePercent != null
                ? "차트 보기"
                : "연동 준비";

      if (item.status === "ready") {
        return `
          <button class="index-watch-card index-watch-trigger" type="button" data-index-open="${escapeHtml(item.key)}">
            <div class="index-watch-head">
              <div>
                <span class="index-watch-name">${escapeHtml(item.name)}</span>
                <span class="index-watch-meta">${escapeHtml(categoryLabel)} / ${escapeHtml(item.symbol)}</span>
              </div>
              <span class="index-watch-pill ${escapeHtml(item.status)}">${pillLabel}</span>
            </div>
            ${
              displayMetrics?.changePercent != null && displayMetrics?.price != null
                ? `
                  <div class="index-watch-card-body">
                    <div class="index-watch-card-price ${priceDirectionClass}">
                      <span class="index-watch-card-price-value">${formatDecimal(displayMetrics.price)}</span>
                      <span class="index-watch-card-price-state">${formatSignedPointDelta(priceDirectionValue)}</span>
                    </div>
                    <div class="index-watch-card-change ${trendClass}">${formatPercent(displayMetrics.changePercent)}</div>
                    <div class="index-watch-card-hint">${escapeHtml(marketWatchDisplayDate)} 기준 · 카드를 누르면 차트가 열립니다.</div>
                  </div>
                `
                : `
                  <div class="index-watch-placeholder">
                    ${
                      snapshot?.error
                        ? escapeHtml(snapshot.error)
                        : marketWatchLoading
                          ? "지수 데이터를 불러오는 중입니다."
                          : "지수 데이터를 준비 중입니다."
                    }
                  </div>
                `
            }
          </button>
        `;
      }

      return `
        <article class="index-watch-card planned-card">
          <div class="index-watch-head">
            <div>
              <span class="index-watch-name">${escapeHtml(item.name)}</span>
              <span class="index-watch-meta">${escapeHtml(categoryLabel)} / ${escapeHtml(item.symbol)}</span>
            </div>
            <span class="index-watch-pill ${escapeHtml(item.status)}">${pillLabel}</span>
          </div>
          <div class="index-watch-note">${escapeHtml(item.note)}</div>
        </article>
      `;
    })
    .join("");
}

function getMarketFlowStateLabel(type, value) {
  if (type === "global") {
    if (value === "RISK_ON") {
      return "위험 선호";
    }
    if (value === "RISK_OFF") {
      return "위험 회피";
    }
    return "중립";
  }

  if (type === "local") {
    if (value === "STRONG") {
      return "국내 강세";
    }
    if (value === "SELECTIVE") {
      return "선별 장세";
    }
    if (value === "DEFENSIVE") {
      return "방어 장세";
    }
    return "국내 약세";
  }

  if (value === "AGGRESSIVE") {
    return "공격 모드";
  }
  if (value === "SELECTIVE") {
    return "선별 모드";
  }
  if (value === "DEFENSIVE") {
    return "방어 모드";
  }
  return "중립 모드";
}

function formatMarketFlowDateTime(value) {
  if (!value) {
    return "기준 시각 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatMarketFlowDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatMarketFlowAxisDate(value) {
  if (!value) {
    return "";
  }

  const dateValue = typeof value === "object" && value !== null
    ? `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
    : String(value);
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return dateValue;
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

function getMarketFlowCycleLabel(cycle) {
  if (cycle === "ACCUMULATION") {
    return "매집";
  }
  if (cycle === "MARKUP") {
    return "상승";
  }
  if (cycle === "OVERHEAT") {
    return "과열";
  }
  if (cycle === "DISTRIBUTION") {
    return "분산";
  }
  return "하락";
}

function getMarketFlowToneClass(value) {
  if (value === "RISK_ON" || value === "STRONG" || value === "AGGRESSIVE" || value === "MARKUP") {
    return "positive";
  }
  if (value === "RISK_OFF" || value === "DEFENSIVE" || value === "DECLINE" || value === "DISTRIBUTION") {
    return "negative";
  }
  if (value === "OVERHEAT") {
    return "warning";
  }
  return "neutral";
}

function getMarketFlowScoreColor(score) {
  if (score >= 75) {
    return "hot";
  }
  if (score >= 60) {
    return "strong";
  }
  if (score >= 50) {
    return "balanced";
  }
  return "early";
}

function interpretTheme(snapshot) {
  const score = snapshot.score ?? 0;
  const change = snapshot.change5d ?? 0;

  if (score < 50 && change > 0) {
    return "초기 유입";
  }
  if (score >= 50 && score < 75 && change > 0) {
    return "추세 진행";
  }
  if (score >= 75 && change <= 0) {
    return "과열/분배";
  }
  if (score < 40 && change <= 0) {
    return "관심 없음";
  }
  return "중립";
}

function formatThemeRotationChange(value) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return {
      className: "neutral",
      label: "-"
    };
  }

  if (value > 0) {
    return {
      className: "positive",
      label: `▲ ${formatDecimal(Math.abs(value), 2)}%`
    };
  }

  return {
    className: "negative",
    label: `▼ ${formatDecimal(Math.abs(value), 2)}%`
  };
}

function buildThemeRotationTable(snapshots) {
  const sorted = [...(snapshots ?? [])].sort((left, right) => right.score - left.score);
  const topThemes = new Set(sorted.slice(0, 3).map((item) => item.theme));
  const bottomThemes = new Set(sorted.slice(-3).map((item) => item.theme));

  return sorted.map((item, index) => ({
    rank: index + 1,
    theme: item.theme,
    label: item.label,
    category: item.category,
    score: item.score,
    scoreColor: getMarketFlowScoreColor(item.score),
    cycleLabel: getMarketFlowCycleLabel(item.cycle),
    cycleTone: getMarketFlowToneClass(item.cycle),
    interpretation: interpretTheme(item),
    change1d: formatThemeRotationChange(item.change1d),
    change5d: formatThemeRotationChange(item.change5d),
    change20d: formatThemeRotationChange(item.change20d),
    isTop: topThemes.has(item.theme),
    isBottom: bottomThemes.has(item.theme)
  }));
}

function buildThemeRotationSummary(table) {
  if (!table.length) {
    return "테마 로테이션 데이터가 아직 충분하지 않습니다.";
  }

  const top = table.slice(0, 2).map((item) => item.label).join(", ");
  const bottom = table.slice(-2).map((item) => item.label).join(", ");
  return `현재 시장은 ${top} 중심으로 자금이 유입되고 있으며, ${bottom} 테마는 상대적으로 약세입니다.`;
}

function renderThemeScoreBubbles(themes, toneClass) {
  if (!themes.length) {
    return `<div class="market-flow-theme-bubble-empty">표시할 테마 없음</div>`;
  }

  return `
    <div class="market-flow-theme-bubble-list">
      ${themes
        .map(
          (item) => `
            <span class="market-flow-theme-bubble ${escapeHtml(toneClass)}">
              <span class="market-flow-theme-bubble-name">${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(formatDecimal(item.score, 0))}</strong>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function getMarketFlowThemeColor(theme) {
  const palette = {
    AI: "#1f6feb",
    Semiconductor: "#005f73",
    Battery: "#2a9d8f",
    AutoIndustrial: "#5c7cfa",
    Materials: "#8c6d46",
    Construction: "#c97b2b",
    Consumer: "#d1495b",
    Healthcare: "#2f855a",
    Staples: "#6b7280",
    Financial: "#5a3ec8",
    Energy: "#d97706"
  };

  return palette[theme] ?? "#2f8fd9";
}

function ensureMarketFlowSelectedThemes() {
  const availableThemes = new Set((marketFlowPayload?.themeRotation?.snapshots ?? []).map((item) => item.theme));
  marketFlowSelectedThemes = new Set([...marketFlowSelectedThemes].filter((theme) => availableThemes.has(theme)));

  if (!marketFlowSelectedThemes.size && marketFlowPayload?.themeRotation?.topThemes?.length) {
    marketFlowPayload.themeRotation.topThemes.slice(0, Math.min(3, marketFlowPayload.themeRotation.topThemes.length)).forEach((item) => {
      marketFlowSelectedThemes.add(item.theme);
    });
  }
}

function renderMarketFlowChartEmpty(container, title, description) {
  container.innerHTML = `
    <div class="market-flow-chart-empty">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function getLineSeriesTooltipValue(param, series) {
  const data = param?.seriesData?.get(series);
  if (!data || !("value" in data) || typeof data.value !== "number") {
    return undefined;
  }

  return data.value;
}

function createMarketFlowHoverTooltip(container) {
  const tooltip = document.createElement("div");
  tooltip.className = "market-flow-hover-tooltip hidden";
  container.appendChild(tooltip);
  return tooltip;
}

function renderMarketFlowHoverTooltip(params) {
  const { container, tooltip, point, time, rows } = params;
  if (!tooltip || !point || !time || !rows.length) {
    tooltip?.classList.add("hidden");
    return;
  }

  const left = Math.min(point.x + 16, Math.max(16, container.clientWidth - 220));
  const top = Math.max(point.y - 16, 12);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.remove("hidden");
  tooltip.innerHTML = `
    <div class="market-flow-hover-date">${escapeHtml(formatKoreanChartDate(String(time)))}</div>
    ${rows
      .map(
        (row) => `
          <div class="market-flow-hover-row">
            <span class="market-flow-hover-key">
              <span class="market-flow-hover-swatch" style="background:${escapeHtml(row.color)};"></span>
              ${escapeHtml(row.label)}
            </span>
            <strong class="market-flow-hover-value">${escapeHtml(formatDecimal(row.value, 2))}</strong>
          </div>
        `
      )
      .join("")}
  `;
}

function cleanupMarketFlowChart(stateKey) {
  const state = stateKey === "market" ? marketFlowMarketChartState : marketFlowThemeChartState;
  if (!state) {
    return;
  }

  state.resizeObserver?.disconnect();
  state.chart?.remove();
  if (stateKey === "market") {
    marketFlowMarketChartState = null;
    return;
  }
  marketFlowThemeChartState = null;
}

function renderMarketFlowRangeButtons() {
  return MARKET_FLOW_CHART_RANGES.map((range) => `
    <button
      type="button"
      class="market-flow-range-button ${range === marketFlowSelectedRange ? "active" : ""}"
      data-market-flow-range="${escapeHtml(range)}"
    >
      ${escapeHtml(range)}
    </button>
  `).join("");
}

function syncMarketFlowMarketChart() {
  const container = document.querySelector("#marketFlowHistoryChartContainer");
  if (!container) {
    return;
  }

  cleanupMarketFlowChart("market");
  container.innerHTML = "";
  const sortedHistory = [...marketFlowHistory].sort((left, right) => left.date.localeCompare(right.date));
  const uniqueDates = [...new Set(sortedHistory.map((item) => item.date))];
  if (uniqueDates.length < 2) {
    renderMarketFlowChartEmpty(
      container,
      "시장 흐름 데이터 축적 중",
      `현재 저장된 일자 수가 ${String(uniqueDates.length || 0)}일이라 추세 차트를 그릴 수 없습니다.`
    );
    return;
  }

  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#33506e"
    },
    grid: {
      vertLines: { color: "rgba(47, 143, 217, 0.08)" },
      horzLines: { color: "rgba(47, 143, 217, 0.1)" }
    },
    rightPriceScale: {
      borderColor: "rgba(47, 143, 217, 0.16)"
    },
    timeScale: {
      borderColor: "rgba(47, 143, 217, 0.16)",
      tickMarkFormatter: (time) => formatMarketFlowAxisDate(time)
    },
    crosshair: {
      mode: CrosshairMode.Normal
    }
  });
  const tooltip = createMarketFlowHoverTooltip(container);

  const seriesEntries = [
    {
      title: "Global",
      color: "#1f6feb",
      values: sortedHistory.map((item) => ({ time: item.date, value: item.globalScore }))
    },
    {
      title: "Local",
      color: "#db8c1f",
      values: sortedHistory.map((item) => ({ time: item.date, value: item.localScore }))
    },
    {
      title: "Theme",
      color: "#2f855a",
      values: sortedHistory.map((item) => ({ time: item.date, value: item.themeRotationScore }))
    }
  ].map((seriesItem) => {
    const series = chart.addSeries(LineSeries, {
      color: seriesItem.color,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      title: seriesItem.title
    });
    series.setData(seriesItem.values);
    return {
      label: seriesItem.title,
      color: seriesItem.color,
      series
    };
  });

  chart.subscribeCrosshairMove((param) => {
    if (!param.point || !param.time || !param.seriesData?.size) {
      tooltip.classList.add("hidden");
      return;
    }

    const rows = seriesEntries
      .map((entry) => {
        const data = param.seriesData.get(entry.series);
        const value = data && "value" in data ? data.value : undefined;
        return typeof value === "number"
          ? {
              label: entry.label,
              color: entry.color,
              value
            }
          : null;
      })
      .filter(Boolean);

    renderMarketFlowHoverTooltip({
      container,
      tooltip,
      point: param.point,
      time: param.time,
      rows
    });
  });

  chart.timeScale().fitContent();

  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({
      width: container.clientWidth,
      height: container.clientHeight
    });
  });
  resizeObserver.observe(container);

  marketFlowMarketChartState = {
    chart,
    resizeObserver,
    tooltip
  };
}

function syncMarketFlowThemeChart() {
  const container = document.querySelector("#marketFlowThemeChartContainer");
  if (!container) {
    return;
  }

  cleanupMarketFlowChart("theme");
  ensureMarketFlowSelectedThemes();
  container.innerHTML = "";

  const grouped = new Map();
  for (const entry of marketFlowThemeHistory ?? []) {
    const items = grouped.get(entry.theme) ?? [];
    items.push(entry);
    grouped.set(entry.theme, items);
  }

  const selectedHistory = [...marketFlowSelectedThemes].flatMap((theme) => grouped.get(theme) ?? []);
  const uniqueDates = [...new Set(selectedHistory.map((item) => item.date))].sort((left, right) => left.localeCompare(right));
  if (uniqueDates.length < 2) {
    renderMarketFlowChartEmpty(
      container,
      "테마 로테이션 데이터 축적 중",
      `현재 저장된 일자 수가 ${String(uniqueDates.length || 0)}일이라 추세 차트를 그릴 수 없습니다.`
    );
    return;
  }

  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#33506e"
    },
    grid: {
      vertLines: { color: "rgba(47, 143, 217, 0.08)" },
      horzLines: { color: "rgba(47, 143, 217, 0.1)" }
    },
    rightPriceScale: {
      borderColor: "rgba(47, 143, 217, 0.16)"
    },
    timeScale: {
      borderColor: "rgba(47, 143, 217, 0.16)",
      tickMarkFormatter: (time) => formatMarketFlowAxisDate(time)
    },
    crosshair: {
      mode: CrosshairMode.Normal
    }
  });
  const tooltip = createMarketFlowHoverTooltip(container);
  const seriesEntries = [];

  for (const theme of marketFlowSelectedThemes) {
    const history = (grouped.get(theme) ?? []).sort((left, right) => left.date.localeCompare(right.date));
    if (!history.length) {
      continue;
    }

    const series = chart.addSeries(LineSeries, {
      color: getMarketFlowThemeColor(theme),
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      title: history[0]?.label ?? theme
    });
    series.setData(history.map((item) => ({
      time: item.date,
      value: item.score
    })));
    seriesEntries.push({
      label: history[0]?.label ?? theme,
      color: getMarketFlowThemeColor(theme),
      series
    });
  }

  chart.subscribeCrosshairMove((param) => {
    if (!param.point || !param.time || !param.seriesData?.size) {
      tooltip.classList.add("hidden");
      return;
    }

    const rows = seriesEntries
      .map((entry) => {
        const data = param.seriesData.get(entry.series);
        const value = data && "value" in data ? data.value : undefined;
        return typeof value === "number"
          ? {
              label: entry.label,
              color: entry.color,
              value
            }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.value - left.value);

    renderMarketFlowHoverTooltip({
      container,
      tooltip,
      point: param.point,
      time: param.time,
      rows
    });
  });

  chart.timeScale().fitContent();

  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({
      width: container.clientWidth,
      height: container.clientHeight
    });
  });
  resizeObserver.observe(container);

  marketFlowThemeChartState = {
    chart,
    resizeObserver,
    tooltip
  };
}

function renderMarketFlowMeter(label, score, maxScore, toneClass) {
  const ratio = maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : 0;
  return `
    <article class="market-flow-meter-card">
      <div class="market-flow-meter-head">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatDecimal(score, 1))} / ${escapeHtml(formatDecimal(maxScore, 0))}</strong>
      </div>
      <div class="market-flow-meter-track">
        <span class="market-flow-meter-fill ${escapeHtml(toneClass)}" style="width:${ratio}%;"></span>
      </div>
    </article>
  `;
}

function formatMarketFlowTurnover(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  if (value >= 100_000_000) {
    return `${formatDecimal(value / 100_000_000, 0)}억`;
  }

  return formatDecimal(value, 0);
}

function findMarketFlowTheme(theme) {
  return (marketFlowPayload?.themeRotation?.snapshots ?? []).find((item) => item.theme === theme);
}

function openThemeDetailModal(theme) {
  if (!themeDetailModal || !theme) {
    return;
  }

  renderThemeDetailModal(theme);
  themeDetailModal.classList.remove("hidden");
}

function closeThemeDetailModal() {
  themeDetailModalPointerDownOnBackdrop = false;
  themeDetailModal?.classList.add("hidden");
}

function renderThemeDetailModal(theme) {
  const snapshot = findMarketFlowTheme(theme);
  if (!snapshot || !themeDetailModalTitle || !themeDetailModalMeta || !themeDetailModalBody) {
    return;
  }

  const members = Array.isArray(snapshot.members) ? snapshot.members : [];
  const latestDate = members.find((item) => item.latestDate)?.latestDate ?? snapshot.date;
  themeDetailModalTitle.textContent = `${snapshot.label} 대표 종목`;
  themeDetailModalMeta.textContent = `${snapshot.category} / ${snapshot.memberCount}개 반영 / 점수 ${formatDecimal(snapshot.score, 0)} / ${formatMarketFlowDate(latestDate)} 기준`;

  if (!members.length) {
    themeDetailModalBody.innerHTML = `<div class="empty-state"><p>구성 종목 상세 데이터가 아직 없습니다.</p></div>`;
    return;
  }

  const rows = members
    .map((item) => {
      const changeClass = (item.change1d ?? 0) > 0 ? "positive" : (item.change1d ?? 0) < 0 ? "negative" : "neutral";
      const volumeRatio =
        typeof item.currentTurnover === "number" && typeof item.averageTurnover20 === "number" && item.averageTurnover20 > 0
          ? item.currentTurnover / item.averageTurnover20
          : undefined;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.name ?? item.symbol)}</strong>
            <span class="theme-detail-symbol">${escapeHtml(item.symbol)}</span>
          </td>
          <td>${escapeHtml(formatDecimal(item.latestClose, 0))}</td>
          <td><span class="market-flow-change ${changeClass}">${escapeHtml(formatPercent(item.change1d))}</span></td>
          <td>${escapeHtml(formatPercent(item.change5d))}</td>
          <td>${escapeHtml(formatPercent(item.change20d))}</td>
          <td>${escapeHtml(formatMarketFlowTurnover(item.currentTurnover))}</td>
          <td>${escapeHtml(volumeRatio != null ? `${formatDecimal(volumeRatio, 2)}배` : "-")}</td>
        </tr>
      `;
    })
    .join("");

  themeDetailModalBody.innerHTML = `
    <div class="theme-detail-summary">
      <span>사이클 <strong>${escapeHtml(getMarketFlowCycleLabel(snapshot.cycle))}</strong></span>
      <span>20일 상대수익 <strong>${escapeHtml(formatPercent(snapshot.relativeReturn20d))}</strong></span>
      <span>거래대금 <strong>${escapeHtml(snapshot.volumeRatio != null ? `${formatDecimal(snapshot.volumeRatio, 2)}배` : "-")}</strong></span>
    </div>
    <div class="theme-detail-table-shell">
      <table class="theme-detail-table">
        <thead>
          <tr>
            <th>종목명</th>
            <th>현재가</th>
            <th>1일</th>
            <th>5일</th>
            <th>20일</th>
            <th>거래대금</th>
            <th>20일 대비</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderMarketFlowBoard() {
  if (!marketFlowBoardBody || !marketFlowStatusBadge) {
    return;
  }

  cleanupMarketFlowChart("market");
  cleanupMarketFlowChart("theme");

  if (marketFlowLoading && !marketFlowPayload) {
    marketFlowStatusBadge.className = "status-badge loading";
    marketFlowStatusBadge.textContent = "로딩 중";
    marketFlowBoardBody.innerHTML = `
      <div class="empty-state">
        <p>시장 흐름 데이터를 계산하는 중입니다.</p>
      </div>
    `;
    return;
  }

  if (!marketFlowPayload) {
    marketFlowStatusBadge.className = `status-badge ${marketFlowError ? "error" : "neutral"}`;
    marketFlowStatusBadge.textContent = marketFlowError ? "불러오기 실패" : "대기 중";
    marketFlowBoardBody.innerHTML = marketFlowError
      ? `<div class="error-box">${escapeHtml(marketFlowError)}</div>`
      : `
        <div class="empty-state">
          <p>시장 흐름 데이터를 기다리는 중입니다.</p>
        </div>
      `;
    return;
  }

  ensureMarketFlowSelectedThemes();

  const payload = marketFlowPayload;
  const toneClass = getMarketFlowToneClass(payload.marketMode);
  marketFlowStatusBadge.className = `status-badge ${marketFlowLoading ? "loading" : toneClass}`;
  marketFlowStatusBadge.textContent = marketFlowLoading ? "갱신 중" : getMarketFlowStateLabel("mode", payload.marketMode);
  const topThemes = payload.themeRotation.topThemes ?? [];
  const bottomThemes = payload.themeRotation.bottomThemes ?? [];
  const selectedThemes = payload.themeRotation.snapshots.filter((item) => marketFlowSelectedThemes.has(item.theme));
  const notes = [...new Set(payload.notes ?? [])];
  const themeTable = buildThemeRotationTable(payload.themeRotation.snapshots ?? []);
  const themeTableSummary = buildThemeRotationSummary(themeTable);
  const marketHistoryDates = [...new Set(marketFlowHistory.map((item) => item.date))].sort((left, right) => left.localeCompare(right));
  const themeHistoryDates = [...new Set(marketFlowThemeHistory.map((item) => item.date))].sort((left, right) => left.localeCompare(right));
  const marketHistoryLabel = marketHistoryDates.length >= 2
    ? `${formatMarketFlowDate(marketHistoryDates[0])} ~ ${formatMarketFlowDate(marketHistoryDates.at(-1))}`
    : marketHistoryDates[0]
      ? `${formatMarketFlowDate(marketHistoryDates[0])}부터 축적 중`
      : "히스토리 없음";
  const themeHistoryLabel = themeHistoryDates.length >= 2
    ? `${formatMarketFlowDate(themeHistoryDates[0])} ~ ${formatMarketFlowDate(themeHistoryDates.at(-1))}`
    : themeHistoryDates[0]
      ? `${formatMarketFlowDate(themeHistoryDates[0])}부터 축적 중`
      : "히스토리 없음";
  const generatedAtLabel = formatMarketFlowDateTime(payload.generatedAt);
  const rankingRows = themeTable
    .map((item) => {
      const rowClass = item.isTop ? "top" : item.isBottom ? "bottom" : "";
      return `
        <tr class="market-flow-table-row ${rowClass}" data-market-flow-theme-detail="${escapeHtml(item.theme)}">
          <td>
            <span class="market-flow-rank-pill ${item.isTop ? "top" : item.isBottom ? "bottom" : ""}">${escapeHtml(String(item.rank))}</span>
          </td>
          <td>
            <div class="market-flow-theme-cell">
              <span class="market-flow-theme-dot" style="background:${escapeHtml(getMarketFlowThemeColor(item.theme))};"></span>
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <div class="market-flow-theme-sub">${escapeHtml(item.isTop ? "Top 3 주도" : item.isBottom ? "Bottom 3 약세" : "중간 구간")}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(item.category)}</td>
          <td><span class="market-flow-score-pill ${escapeHtml(item.scoreColor)}">${escapeHtml(formatDecimal(item.score, 0))}</span></td>
          <td><span class="market-flow-cycle-pill ${escapeHtml(item.cycleTone)}">${escapeHtml(item.cycleLabel)}</span></td>
          <td><span class="market-flow-interpret-pill">${escapeHtml(item.interpretation)}</span></td>
          <td><span class="market-flow-change ${item.change1d.className}">${escapeHtml(item.change1d.label)}</span></td>
          <td><span class="market-flow-change ${item.change5d.className}">${escapeHtml(item.change5d.label)}</span></td>
          <td><span class="market-flow-change ${item.change20d.className}">${escapeHtml(item.change20d.label)}</span></td>
        </tr>
      `;
    })
    .join("");

  marketFlowBoardBody.innerHTML = `
    ${marketFlowError ? `<div class="error-box market-flow-error-box">${escapeHtml(marketFlowError)}</div>` : ""}
    <div class="market-flow-summary-grid">
      <article class="market-flow-summary-card ${escapeHtml(getMarketFlowToneClass(payload.global.state))}">
        <span class="market-flow-summary-label">글로벌 상태</span>
        <strong>${escapeHtml(getMarketFlowStateLabel("global", payload.global.state))}</strong>
        <span class="market-flow-summary-meta">${escapeHtml(formatDecimal(payload.global.normalizedScore, 1))} / 4.0</span>
      </article>
      <article class="market-flow-summary-card ${escapeHtml(getMarketFlowToneClass(payload.local.state))}">
        <span class="market-flow-summary-label">국내 상태</span>
        <strong>${escapeHtml(getMarketFlowStateLabel("local", payload.local.state))}</strong>
        <span class="market-flow-summary-meta">${escapeHtml(formatDecimal(payload.local.normalizedScore, 1))} / 6.0</span>
      </article>
      <article class="market-flow-summary-card ${escapeHtml(toneClass)}">
        <span class="market-flow-summary-label">시장 모드</span>
        <strong>${escapeHtml(getMarketFlowStateLabel("mode", payload.marketMode))}</strong>
        <span class="market-flow-summary-meta">${escapeHtml(generatedAtLabel)} 기준</span>
      </article>
      <article class="market-flow-summary-card market-flow-theme-summary positive">
        <span class="market-flow-summary-label">주도 테마 Top 3</span>
        ${renderThemeScoreBubbles(topThemes, "positive")}
      </article>
      <article class="market-flow-summary-card market-flow-theme-summary negative">
        <span class="market-flow-summary-label">약세 테마 Bottom 3</span>
        ${renderThemeScoreBubbles(bottomThemes, "negative")}
      </article>
    </div>

    <div class="market-flow-meter-grid">
      ${renderMarketFlowMeter("글로벌 점수", payload.global.normalizedScore, 4, getMarketFlowToneClass(payload.global.state))}
      ${renderMarketFlowMeter("국내 점수", payload.local.normalizedScore, 6, getMarketFlowToneClass(payload.local.state))}
      ${renderMarketFlowMeter("테마 순환 점수", payload.themeRotation.score, 100, "positive")}
    </div>

    <div class="market-flow-content-grid">
      <section class="market-flow-panel">
        <div class="market-flow-panel-head">
          <h3>테마 로테이션 랭킹</h3>
          <span class="market-flow-panel-meta">총 ${escapeHtml(String(payload.themeRotation.themeCount))}개 테마</span>
        </div>
        <div class="market-flow-table-shell">
          <table class="market-flow-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>테마명</th>
                <th>카테고리</th>
                <th>점수</th>
                <th>상태</th>
                <th>해석</th>
                <th>1일</th>
                <th>5일</th>
                <th>20일</th>
              </tr>
            </thead>
            <tbody>${rankingRows}</tbody>
          </table>
        </div>
        <div class="market-flow-table-summary">${escapeHtml(themeTableSummary)}</div>
      </section>

      <div class="market-flow-side-panels">
        <section class="market-flow-panel market-flow-chart-panel">
          <div class="market-flow-panel-head">
            <div>
              <h3>시장 흐름 차트</h3>
              <span class="market-flow-panel-meta">글로벌 / 국내 / 테마 점수 · ${escapeHtml(marketHistoryLabel)}</span>
            </div>
            <div class="market-flow-range-list">
              ${renderMarketFlowRangeButtons()}
            </div>
          </div>
          <div id="marketFlowHistoryChartContainer" class="market-flow-chart"></div>
          <div class="market-flow-chart-caption">기본 범위는 ${escapeHtml(marketFlowSelectedRange)}이며, 최근 시장 온도 변화를 3개 축으로 보여줍니다.</div>
        </section>

        <section class="market-flow-panel market-flow-chart-panel">
          <div class="market-flow-panel-head">
            <div>
              <h3>테마 사이클 차트</h3>
              <span class="market-flow-panel-meta">테마별 순환 점수 · ${escapeHtml(themeHistoryLabel)}</span>
            </div>
            <div class="market-flow-range-list">
              ${renderMarketFlowRangeButtons()}
            </div>
          </div>
          <div class="market-flow-theme-toggle-list">
            ${
              payload.themeRotation.snapshots
                .map((item) => {
                  const active = marketFlowSelectedThemes.has(item.theme);
                  return `
                    <button
                      class="market-flow-theme-toggle ${active ? "active" : ""}"
                      type="button"
                      data-market-flow-theme="${escapeHtml(item.theme)}"
                    >
                      <span class="market-flow-theme-dot" style="background:${escapeHtml(getMarketFlowThemeColor(item.theme))};"></span>
                      ${escapeHtml(item.label)}
                    </button>
                  `;
                })
                .join("")
            }
          </div>
          <div id="marketFlowThemeChartContainer" class="market-flow-chart"></div>
          <div class="market-flow-chart-caption">
            ${selectedThemes.length ? escapeHtml(selectedThemes.map((item) => item.label).join(" · ")) : "표시할 테마를 선택해 주세요."}
          </div>
        </section>
      </div>
    </div>

    <section class="market-flow-interpretation">
      <div class="market-flow-panel-head">
        <h3>자동 해석</h3>
      </div>
      <p class="market-flow-interpretation-copy">${escapeHtml(payload.interpretation)}</p>
      <div class="market-flow-note-list">
        ${notes.map((note) => `<span class="market-flow-note-chip">${escapeHtml(note)}</span>`).join("")}
      </div>
    </section>
  `;

  window.requestAnimationFrame(() => {
    syncMarketFlowMarketChart();
    syncMarketFlowThemeChart();
  });
}

function buildMarketFlowHistoryUrls(forceRefresh) {
  const suffix = forceRefresh ? `&forceRefresh=true` : "";
  return {
    market: `/api/market-flow/history?range=${encodeURIComponent(marketFlowSelectedRange)}${suffix}`,
    themes: `/api/market-flow/themes/history?range=${encodeURIComponent(marketFlowSelectedRange)}${suffix}`
  };
}

async function loadMarketFlow(options = {}) {
  if (marketFlowLoading) {
    return;
  }

  const shouldFetchSummary = !options.historiesOnly;
  const isBackground = Boolean(options.background && marketFlowLoaded && shouldFetchSummary);
  marketFlowLoading = true;
  if (!isBackground) {
    renderMarketFlowBoard();
  }

  try {
    if (shouldFetchSummary) {
      const summaryResponse = await fetch(`/analysis/market-flow${options.forceRefresh ? "?forceRefresh=true" : ""}`);
      const summaryPayload = await summaryResponse.json();
      if (!summaryResponse.ok) {
        throw new Error(summaryPayload.error ?? "시장 흐름 데이터를 불러오지 못했습니다.");
      }

      marketFlowPayload = summaryPayload;
      marketFlowLoaded = true;
      ensureMarketFlowSelectedThemes();
    }

    const { market, themes } = buildMarketFlowHistoryUrls(options.forceRefresh);
    const [marketHistoryResponse, themeHistoryResponse] = await Promise.all([
      fetch(market),
      fetch(themes)
    ]);
    const [marketHistoryPayload, themeHistoryPayload] = await Promise.all([
      marketHistoryResponse.json(),
      themeHistoryResponse.json()
    ]);

    if (!marketHistoryResponse.ok) {
      throw new Error(marketHistoryPayload.error ?? "시장 흐름 히스토리를 불러오지 못했습니다.");
    }

    if (!themeHistoryResponse.ok) {
      throw new Error(themeHistoryPayload.error ?? "테마 로테이션 히스토리를 불러오지 못했습니다.");
    }

    marketFlowHistory = Array.isArray(marketHistoryPayload) ? marketHistoryPayload : [];
    marketFlowThemeHistory = Array.isArray(themeHistoryPayload) ? themeHistoryPayload : [];
    marketFlowError = "";
    ensureMarketFlowSelectedThemes();

    if (options.toast) {
      showAppToast({
        title: "시장 흐름 갱신",
        message: `${getMarketFlowStateLabel("mode", marketFlowPayload.marketMode)} / 주도 테마 ${marketFlowPayload.themeRotation.topThemes.map((item) => item.label).join(", ")}`,
        tone: "positive"
      });
    }
  } catch (error) {
    console.error(error);
    marketFlowError = error instanceof Error ? error.message : "시장 흐름 데이터를 불러오지 못했습니다.";
  } finally {
    marketFlowLoading = false;
    renderMarketFlowBoard();
  }
}

function startMarketFlowAutoRefresh() {
  if (marketFlowRefreshTimer) {
    clearInterval(marketFlowRefreshTimer);
  }

  marketFlowRefreshTimer = window.setInterval(() => {
    if (activeView !== "index") {
      return;
    }

    void loadMarketFlow({ background: true });
  }, MARKET_FLOW_REFRESH_INTERVAL_MS);
}

async function loadMarketEventCalendar(options = {}) {
  if (marketEventCalendarLoading) {
    return;
  }

  const isBackground = Boolean(options.background && marketEventCalendarLoaded);
  marketEventCalendarLoading = true;
  if (!isBackground || !marketEventCalendarPayload) {
    renderMarketEventCalendarBoard();
  }

  try {
    const response = await fetch("/analysis/market-event-calendar");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "시장 이벤트 캘린더를 불러오지 못했습니다.");
    }

    setMarketEventCalendarPayload(payload);
    marketEventCalendarLoaded = true;
    marketEventCalendarError = "";
    syncMarketEventCalendarSelection();
  } catch (error) {
    console.error(error);
    marketEventCalendarError = error instanceof Error ? error.message : "시장 이벤트 캘린더를 불러오지 못했습니다.";
    if (!marketEventCalendarPayload) {
      marketEventCalendarSelectedDate = getTodayInSeoulDateText();
      marketEventCalendarVisibleMonth = getMonthKeyFromDate(marketEventCalendarSelectedDate);
    }
  } finally {
    marketEventCalendarLoading = false;
    renderMarketEventCalendarBoard();
  }
}

async function searchMarketEventCalendar() {
  if (marketEventCalendarLoading) {
    return;
  }

  marketEventCalendarLoading = true;
  marketEventCalendarError = "";
  renderMarketEventCalendarBoard();

  try {
    const response = await fetch("/analysis/market-event-calendar/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "시장 이벤트 일정을 검색하지 못했습니다.");
    }

    setMarketEventCalendarPayload(payload);
    marketEventCalendarLoaded = true;
    syncMarketEventCalendarSelection();
    showAppToast({
      title: "일정 검색 완료",
      message: `시장 이벤트 ${payload.events?.length ?? 0}건을 캘린더에 반영했습니다.`,
      tone: "positive"
    });
  } catch (error) {
    console.error(error);
    marketEventCalendarError = error instanceof Error ? error.message : "시장 이벤트 일정을 검색하지 못했습니다.";
    showAppToast({
      title: "일정 검색 실패",
      message: marketEventCalendarError,
      tone: "negative"
    });
  } finally {
    marketEventCalendarLoading = false;
    renderMarketEventCalendarBoard();
  }
}

function setMarketEventCalendarPayload(payload) {
  marketEventCalendarPayload = {
    generatedAt: payload.generatedAt,
    timezone: payload.timezone,
    events: Array.isArray(payload.events) ? payload.events : [],
    summaries: Array.isArray(payload.summaries) ? payload.summaries : []
  };
}

function syncMarketEventCalendarSelection() {
  const today = getTodayInSeoulDateText();
  const dates = getSortedMarketEventDates();

  if (dates.includes(marketEventCalendarSelectedDate)) {
    marketEventCalendarVisibleMonth = marketEventCalendarVisibleMonth || getMonthKeyFromDate(marketEventCalendarSelectedDate);
    return;
  }

  if (dates.includes(today)) {
    marketEventCalendarSelectedDate = today;
  } else {
    marketEventCalendarSelectedDate = dates.find((date) => date >= today) ?? dates[0] ?? today;
  }

  marketEventCalendarVisibleMonth = getMonthKeyFromDate(marketEventCalendarSelectedDate);
  marketEventCalendarExpandedGroups = new Set();
}

function renderMarketEventCalendarBoard() {
  if (!marketEventCalendarBoard) {
    return;
  }

  const payload = marketEventCalendarPayload ?? {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Seoul",
    events: [],
    summaries: []
  };
  const today = getTodayInSeoulDateText();
  const selectedDate = marketEventCalendarSelectedDate || getTodayInSeoulDateText();
  const visibleMonth = marketEventCalendarVisibleMonth || getMonthKeyFromDate(selectedDate);
  const eventsByDate = groupMarketEventsByDate(payload.events);
  const summariesByDate = new Map((payload.summaries ?? []).map((summary) => [summary.date, summary]));
  const highImportanceCount = payload.events.filter((event) => event.importance === "high").length;
  const upcomingCount = payload.events.filter((event) => event.date >= today).length;

  marketEventCalendarBoard.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Market Event Calendar</h2>
        <p class="field-help">실적, 거시지표, 정책 일정을 달력에서 훑고 선택한 날짜의 상세 이벤트를 아래 패널에서 확인합니다.</p>
      </div>
    </div>
    <div class="market-event-toolbar">
      <div class="market-event-stat-list">
        <span class="market-event-stat-chip">월간 일정 ${escapeHtml(String(payload.events.length))}건</span>
        <span class="market-event-stat-chip emphasis">High ${escapeHtml(String(highImportanceCount))}건</span>
        <span class="market-event-stat-chip">예정 ${escapeHtml(String(upcomingCount))}건</span>
      </div>
      <div class="market-event-month-nav">
        <button class="ghost-button small-button" type="button" data-calendar-nav="prev">이전</button>
        <strong>${escapeHtml(formatMarketEventMonthLabel(visibleMonth))}</strong>
        <span class="market-event-today-chip">오늘 ${escapeHtml(formatMarketEventTodayLabel(today))}</span>
        <button class="ghost-button small-button" type="button" data-calendar-nav="next">다음</button>
        <button class="primary-button small-button market-event-search-button" type="button" data-calendar-search ${
          marketEventCalendarLoading ? "disabled" : ""
        }>${marketEventCalendarLoading ? "검색 중..." : "일정 검색"}</button>
      </div>
    </div>
    <div class="market-event-legend">
      <span class="market-event-legend-item"><span class="market-event-priority-flag">!</span>High 중요 일정</span>
      <span class="market-event-legend-copy">색이 들어간 날짜는 일정이 있는 날입니다. 날짜를 클릭하면 상세 내용을 볼 수 있습니다.</span>
    </div>
    ${
      marketEventCalendarError
        ? `<div class="error-box market-event-error-box">${escapeHtml(marketEventCalendarError)}</div>`
        : ""
    }
    <div class="market-event-panel-body">
      <div class="market-event-calendar-shell">
        ${renderEventCalendarGrid(visibleMonth, summariesByDate, selectedDate)}
      </div>
    </div>
  `;
}

function renderEventCalendarGrid(visibleMonth, summariesByDate, selectedDate) {
  const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
  const cells = buildMarketEventCalendarCells(visibleMonth)
    .map((cell) =>
      cell.type === "blank" ? renderEmptyEventCalendarCell() : renderEventCalendarCell(cell, summariesByDate.get(cell.date), selectedDate)
    )
    .join("");

  return `
    <div class="market-event-calendar-grid">
      <div class="market-event-weekdays">
        ${weekdayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="market-event-cells">
        ${cells}
      </div>
    </div>
  `;
}

function renderEmptyEventCalendarCell() {
  return '<div class="market-event-calendar-cell empty" aria-hidden="true"></div>';
}

function renderEventCalendarCell(cell, summary, selectedDate) {
  const isSelected = cell.date === selectedDate;
  const isToday = cell.date === getTodayInSeoulDateText();
  const classNames = [
    "market-event-calendar-cell",
    isSelected ? "selected" : "",
    summary ? "has-events" : "",
    summary?.earningsCount ? "has-earnings" : "",
    summary?.macroCount ? "has-macro" : "",
    summary?.otherCount ? "has-other" : "",
    summary?.hasHighImportance ? "high-importance" : "",
    isToday ? "today" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button class="${classNames}" type="button" data-calendar-date="${escapeHtml(cell.date)}">
      <span class="market-event-calendar-day-row">
        <span class="market-event-calendar-day">${escapeHtml(String(cell.dayNumber))}</span>
        <span class="market-event-calendar-day-flags">
          ${isToday ? '<span class="market-event-calendar-today-badge">오늘</span>' : ""}
          ${summary?.hasHighImportance ? '<span class="market-event-priority-flag">!</span>' : ""}
        </span>
      </span>
      ${
        summary
          ? `
            <span class="market-event-calendar-summary" aria-hidden="true">
              <span class="market-event-calendar-icon-row">
                ${summary.earningsCount ? '<i class="market-event-calendar-icon earnings" title="실적"></i>' : ""}
                ${summary.macroCount ? '<i class="market-event-calendar-icon macro" title="매크로"></i>' : ""}
                ${summary.otherCount ? '<i class="market-event-calendar-icon other" title="정책·시장·뉴스"></i>' : ""}
              </span>
            </span>
          `
          : ""
      }
    </button>
  `;
}

function renderEventDetailPanel(selectedDate, events, summary) {
  const grouped = new Map();
  for (const event of events) {
    const items = grouped.get(event.category) ?? [];
    items.push(event);
    grouped.set(event.category, items);
  }

  const sections = MARKET_EVENT_GROUP_ORDER.filter((category) => grouped.has(category))
    .map((category) => {
      const items = grouped.get(category) ?? [];
      const expandKey = `${selectedDate}:${category}`;
      const expanded = marketEventCalendarExpandedGroups.has(expandKey);
      const initialCount = category === "earnings" ? 4 : 5;
      const visibleItems = expanded ? items : items.slice(0, initialCount);

      return `
        <section class="market-event-detail-group">
          <div class="market-event-detail-group-head">
            <div class="market-event-detail-group-title">
              ${renderEventCategoryBadge(category)}
              <strong>${escapeHtml(MARKET_EVENT_CATEGORY_LABELS[category])}</strong>
            </div>
            <span class="market-event-detail-count">${escapeHtml(String(items.length))}건</span>
          </div>
          <div class="market-event-detail-list">
            ${visibleItems.map((item) => renderEventDetailItem(item)).join("")}
          </div>
          ${
            items.length > initialCount
              ? `
                <button class="ghost-button small-button market-event-detail-expand" type="button" data-event-group-expand="${escapeHtml(expandKey)}">
                  ${expanded ? "접기" : `+${items.length - initialCount}건 더 보기`}
                </button>
              `
              : ""
          }
        </section>
      `;
    })
    .join("");

  return `
    <section class="market-event-detail-panel">
      <div class="market-event-detail-head">
        <div>
          <span class="section-meta">선택한 날짜</span>
          <h3>${escapeHtml(formatKoreanChartDate(selectedDate))}</h3>
          <p class="field-help">
            ${
              summary
                ? `실적 ${summary.earningsCount}건 / 매크로 ${summary.macroCount}건 / 기타 ${summary.otherCount}건`
                : "선택한 날짜에 등록된 이벤트가 없으면 빈 상태로 표시됩니다."
            }
          </p>
        </div>
      </div>
      ${
        sections
          ? sections
          : `
            <div class="empty-state market-event-detail-empty">
              <p>선택한 날짜에 예정된 이벤트가 없습니다.</p>
              <p>중요 일정이 있는 날짜를 눌러 상세 목록을 확인하세요.</p>
            </div>
          `
      }
    </section>
  `;
}

function openMarketEventModal(dateText) {
  if (!marketEventModal) {
    return;
  }

  marketEventCalendarSelectedDate = dateText;
  marketEventCalendarExpandedGroups = new Set();
  renderMarketEventModal();
  marketEventModal.classList.remove("hidden");
}

function closeMarketEventModal() {
  marketEventModal?.classList.add("hidden");
}

function renderMarketEventModal() {
  if (!marketEventModalMeta || !marketEventModalBody) {
    return;
  }

  const payload = marketEventCalendarPayload ?? {
    events: [],
    summaries: []
  };
  const selectedDate = marketEventCalendarSelectedDate || getTodayInSeoulDateText();
  const eventsByDate = groupMarketEventsByDate(payload.events);
  const summariesByDate = new Map((payload.summaries ?? []).map((summary) => [summary.date, summary]));
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedSummary = summariesByDate.get(selectedDate);

  marketEventModalMeta.textContent = selectedSummary
    ? `실적 ${selectedSummary.earningsCount}건 / 매크로 ${selectedSummary.macroCount}건 / 기타 ${selectedSummary.otherCount}건`
    : "선택한 날짜에 예정된 이벤트를 팝업에서 확인합니다.";
  marketEventModalBody.innerHTML = renderEventDetailPanel(selectedDate, selectedEvents, selectedSummary);
}

function renderEventDetailItem(event) {
  const meta = [event.time, event.companyName ? `${event.companyName}${event.ticker ? ` (${event.ticker})` : ""}` : event.location]
    .filter(Boolean)
    .join(" / ");

  return `
    <article class="market-event-detail-item">
      <div class="market-event-detail-item-main">
        <div class="market-event-detail-item-top">
          <strong>${escapeHtml(event.title)}</strong>
          <span class="market-event-importance ${escapeHtml(event.importance)}">${escapeHtml(MARKET_EVENT_IMPORTANCE_LABELS[event.importance])}</span>
        </div>
        <div class="market-event-detail-item-meta">
          ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
          <span>${escapeHtml(MARKET_EVENT_CATEGORY_BADGE_LABELS[event.category])}</span>
        </div>
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      </div>
    </article>
  `;
}

function renderEventCategoryBadge(category) {
  return `<span class="market-event-category-badge ${escapeHtml(category)}">${escapeHtml(MARKET_EVENT_CATEGORY_BADGE_LABELS[category])}</span>`;
}

function getSortedMarketEventDates() {
  return [...new Set((marketEventCalendarPayload?.events ?? []).map((event) => event.date))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function groupMarketEventsByDate(events) {
  const map = new Map();

  for (const event of events ?? []) {
    const items = map.get(event.date) ?? [];
    items.push(event);
    map.set(event.date, items);
  }

  return map;
}

function buildMarketEventCalendarCells(monthKey) {
  const firstDate = `${monthKey}-01`;
  const [year, month] = monthKey.split("-").map(Number);
  const firstDateObject = new Date(`${firstDate}T00:00:00Z`);
  const weekStartOffset = (firstDateObject.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: weekStartOffset }, () => ({ type: "blank" }));

  for (let index = 0; index < daysInMonth; index += 1) {
    const date = addUtcDays(firstDate, index);
    cells.push({
      type: "date",
      date,
      dayNumber: Number(date.slice(8, 10))
    });
  }

  const trailingBlankCount = (7 - (cells.length % 7 || 7)) % 7;
  for (let index = 0; index < trailingBlankCount; index += 1) {
    cells.push({ type: "blank" });
  }

  return cells;
}

function getTodayInSeoulDateText() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getMonthKeyFromDate(dateText) {
  return typeof dateText === "string" ? dateText.slice(0, 7) : "";
}

function getMarketWatchDisplayDate() {
  return getTodayInSeoulDateText();
}

function addMonthsToMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, (month ?? 1) - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMarketEventMonthLabel(monthKey) {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(date);
}

function formatMarketEventTodayLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(date);
}

const macroThemeRules = [
  { label: "반도체/전자", keywords: ["반도체", "전자부품", "전자집적", "디스플레이", "광학", "센서"] },
  { label: "소프트웨어/플랫폼", keywords: ["소프트웨어", "정보서비스", "포털", "데이터베이스", "컴퓨터 프로그래밍"] },
  { label: "통신/네트워크장비", keywords: ["통신", "방송 장비", "네트워크", "무선", "유선"] },
  { label: "바이오/헬스케어", keywords: ["의약품", "의료", "제약", "바이오", "건강", "진단", "치과"] },
  { label: "2차전지/소재", keywords: ["전지", "배터리", "양극재", "음극재", "리튬", "소재"] },
  { label: "전력/인프라", keywords: ["전동기", "발전기", "전력", "케이블", "전기장비", "배전", "변압기"] },
  { label: "기계/로봇/자동화", keywords: ["특수목적용 기계", "일반목적용 기계", "기계장비", "로봇", "자동화", "금형"] },
  { label: "자동차/부품", keywords: ["자동차", "트레일러", "차체", "차량", "내장재"] },
  { label: "화학/소재", keywords: ["화학", "플라스틱", "고무", "합성수지", "도료", "비금속광물"] },
  { label: "철강/금속", keywords: ["1차 금속", "철강", "주조", "비철", "금속", "알루미늄"] },
  { label: "건설/부동산", keywords: ["건설", "토목", "부동산", "엔지니어링"] },
  { label: "유통/소비재", keywords: ["도매", "소매", "유통", "백화점", "생활용품"] },
  { label: "음식료/농식품", keywords: ["식료품", "음료", "농업", "수산", "사료", "축산"] },
  { label: "엔터/콘텐츠", keywords: ["영화", "비디오", "방송", "음악", "오락", "광고", "출판", "게임"] },
  { label: "물류/운송", keywords: ["운수", "창고", "육상", "항공", "해상", "물류"] },
  { label: "금융", keywords: ["은행", "보험", "금융", "증권", "여신"] },
  { label: "에너지/원자재", keywords: ["석유", "가스", "광업", "에너지", "석탄"] }
];

function mapSectorToMacroTheme(sector) {
  if (!sector) {
    return "";
  }

  for (const rule of macroThemeRules) {
    if (rule.keywords.some((keyword) => sector.includes(keyword))) {
      return rule.label;
    }
  }

  return sector;
}

function buildMoverThemes(items, direction) {
  const grouped = new Map();

  for (const item of items) {
    const sector = getSectorLabel(item.symbol);
    if (!sector) {
      continue;
    }

    const macroTheme = mapSectorToMacroTheme(sector);
    const existing = grouped.get(macroTheme) ?? {
      theme: macroTheme,
      direction,
      items: [],
      sectors: new Set()
    };
    existing.items.push(item);
    existing.sectors.add(sector);
    grouped.set(macroTheme, existing);
  }

  return [...grouped.values()]
    .map((group) => {
      const avgScore =
        group.items.reduce((sum, item) => sum + (item.alertScore ?? 0), 0) / Math.max(group.items.length, 1);
      const avgChangePercent =
        group.items.reduce((sum, item) => sum + Math.abs(item.changePercent ?? 0), 0) / Math.max(group.items.length, 1);
      const topItems = [...group.items]
        .sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0))
        .slice(0, 3)
        .map((item) => ({
          name: item.name,
          changePercent: item.changePercent ?? 0
        }));

      return {
        theme: group.theme,
        direction: group.direction,
        count: group.items.length,
        sectorCount: group.sectors.size,
        sectors: [...group.sectors].slice(0, 2),
        avgScore,
        avgChangePercent,
        topItems
      };
    })
    .sort((left, right) => {
      const countPriority = Number(right.count >= 2) - Number(left.count >= 2);
      if (countPriority !== 0) {
        return countPriority;
      }
      if (right.avgScore !== left.avgScore) {
        return right.avgScore - left.avgScore;
      }
      if (right.avgChangePercent !== left.avgChangePercent) {
        return right.avgChangePercent - left.avgChangePercent;
      }
      return right.count - left.count;
    })
    .slice(0, 5);
}

function renderMoversThemeLists() {
  renderMoversThemeList(moversRiseThemesList, buildMoverThemes(latestRiseMovers, "rise"), "rise");
  renderMoversThemeList(moversFallThemesList, buildMoverThemes(latestFallMovers, "fall"), "fall");
}

function renderMoversThemeList(container, themes, direction) {
  if (!container) {
    return;
  }

  if (!hasLoadedMovers) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "급등" : "급락"} 테마를 계산하는 중입니다.</p>
      </div>
    `;
    return;
  }

  if (!themes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "강하게 묶이는 급등 업종이 아직 없습니다." : "강하게 묶이는 급락 업종이 아직 없습니다."}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = themes
    .map((theme, index) => {
      const trendClass = direction === "rise" ? "positive" : "negative";
      const countBadges = [
        theme.sectorCount > 1
          ? `<span class="movers-theme-count-badge">업종 ${escapeHtml(String(theme.sectorCount))}</span>`
          : "",
        `<span class="movers-theme-count-badge">종목 ${escapeHtml(String(theme.count))}</span>`
      ]
        .filter(Boolean)
        .join("");
      const representatives = theme.topItems
        .map(
          (item) =>
            `<span class="movers-theme-chip">${escapeHtml(item.name)} <strong class="${trendClass}">${formatPercent(
              item.changePercent
            )}</strong></span>`
        )
        .join("");
      const sectorSummary = theme.sectors.length ? theme.sectors.join(" / ") : "";
      return `
        <article class="movers-theme-card ${direction}">
          <div class="movers-theme-main">
            <span class="movers-theme-rank">${index + 1}</span>
            <div class="movers-theme-copy">
              <h3>${escapeHtml(theme.theme)}</h3>
              ${sectorSummary ? `<div class="movers-theme-subtitle">${escapeHtml(sectorSummary)}</div>` : ""}
            </div>
          </div>
          <div class="movers-theme-stat">
            <span class="movers-theme-label">평균 점수</span>
            <span class="movers-theme-value">${escapeHtml(String(Math.round(theme.avgScore)))}</span>
          </div>
          <div class="movers-theme-stat">
            <span class="movers-theme-label">평균 등락률</span>
            <span class="movers-theme-value ${trendClass}">${direction === "rise" ? "+" : "-"}${escapeHtml(
              theme.avgChangePercent.toFixed(2)
            )}%</span>
          </div>
          <div class="movers-theme-tail">${countBadges}</div>
          <div class="movers-theme-representatives">${representatives}</div>
        </article>
      `;
    })
    .join("");
}

function switchAppView(view) {
  activeView = APP_VIEWS.includes(view) ? view : "analysis";
  renderAppTabs();
  persistUiState();

  if (activeView === "analysis") {
    void loadRealtimeStockSnapshots({ background: true });
    void refreshCurrentAnalysisRealtime({ background: true });
  }

  if (activeView === "index") {
    if (!marketWatchLoaded && !marketWatchLoading) {
      void loadMarketWatch();
    } else {
      renderIndexWatchList();
    }

    if (!marketEventCalendarLoaded && !marketEventCalendarLoading) {
      void loadMarketEventCalendar();
    } else {
      renderMarketEventCalendarBoard();
    }

    if (!marketFlowLoaded && !marketFlowLoading) {
      void loadMarketFlow();
    } else {
      renderMarketFlowBoard();
    }
  }

  if (activeView === "history") {
    if (!recommendationHistoryLoaded && !recommendationHistoryLoading) {
      void loadRecommendationHistory();
    } else {
      renderRecommendationHistoryBoard();
    }
  }

  if (activeView === "movers" && !hasLoadedMovers) {
    void loadMovers();
  }
}

function getMarketOperationEventTone(event) {
  return event?.status === "active" ? "negative" : "neutral";
}

function getMarketOperationEventLabel(event) {
  const typeLabel = event?.eventType === "sidecar" ? "사이드카" : "서킷브레이커";
  const marketLabel = event?.market || "시장";
  return `${marketLabel} ${typeLabel}`;
}

function notifyMarketOperationEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return;
  }

  for (const event of events.slice(0, 5)) {
    if (!event?.id || marketOperationEventToastIds.has(event.id)) {
      continue;
    }

    marketOperationEventToastIds.add(event.id);
    showAppToast({
      title: getMarketOperationEventLabel(event),
      message: [event.title, event.occurredAt].filter(Boolean).join(" / "),
      tone: getMarketOperationEventTone(event),
      duration: 9000
    });
  }
}

async function loadMarketWatch(options = {}) {
  if (marketWatchLoading) {
    return;
  }

  const isBackground = Boolean(options.background && marketWatchLoaded);
  const isIndexModalOpen = Boolean(activeMarketWatchKey && indexChartModal && !indexChartModal.classList.contains("hidden"));
  marketWatchLoading = true;
  if (!isBackground) {
    renderIndexWatchList();
  }

  try {
    const response = await fetch("/analysis/market-watch");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "지수 데이터를 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    marketWatchFetchedAt = typeof payload.fetchedAt === "string" ? payload.fetchedAt : "";
    marketWatchItems = new Map(items.map((item) => [item.key, item]));
    notifyMarketOperationEvents(payload.events);
    marketWatchLoaded = true;
  } catch (error) {
    console.error(error);
  } finally {
    marketWatchLoading = false;
    if (!isBackground || !isIndexModalOpen) {
      renderIndexWatchList();
    }
    if (activeMarketWatchKey && indexChartModal && !indexChartModal.classList.contains("hidden")) {
      renderIndexChartModal();
    }
  }
}

function getMarketWatchRefreshInterval() {
  return activeMarketWatchKey && indexChartModal && !indexChartModal.classList.contains("hidden")
    ? MARKET_WATCH_MODAL_REFRESH_INTERVAL_MS
    : MARKET_WATCH_REFRESH_INTERVAL_MS;
}

function startMarketWatchAutoRefresh() {
  if (marketWatchRefreshTimer) {
    clearInterval(marketWatchRefreshTimer);
  }

  marketWatchRefreshTimer = window.setInterval(() => {
    if (activeView !== "index") {
      return;
    }

    void loadMarketWatch({ background: true });
  }, getMarketWatchRefreshInterval());
}

function cleanupMarketWatchCharts() {
  if (marketWatchChartState) {
    const visibleRange = marketWatchChartState.chart?.timeScale().getVisibleLogicalRange?.();
    if (
      visibleRange &&
      Number.isFinite(visibleRange.from) &&
      Number.isFinite(visibleRange.to) &&
      marketWatchChartState.viewportKey
    ) {
      marketWatchChartViewportByKey.set(marketWatchChartState.viewportKey, {
        from: visibleRange.from,
        to: visibleRange.to
      });
    }

    marketWatchChartState.resizeObserver?.disconnect();
    clearMarketWatchExtremaMarkers(marketWatchChartState);
    if (marketWatchChartState.visibleRangeHandler) {
      marketWatchChartState.chart?.timeScale().unsubscribeVisibleLogicalRangeChange?.(marketWatchChartState.visibleRangeHandler);
    }
    if (marketWatchChartState.wheelTarget && marketWatchChartState.wheelHandler) {
      marketWatchChartState.wheelTarget.removeEventListener("wheel", marketWatchChartState.wheelHandler);
    }
    marketWatchChartState.chart?.remove();
    marketWatchChartState = null;
  }
}

function getMarketWatchViewportKey(snapshotKey, timeframe) {
  return `${snapshotKey}:${timeframe}`;
}

function isMarketWatchMinuteTimeframe(timeframe) {
  return marketWatchMinuteTimeframes.includes(timeframe);
}

function getAvailableMarketWatchTimeframes(snapshot) {
  return marketWatchTimeframes.filter((option) => snapshot?.chartSets?.[option]?.points?.length);
}

function getDefaultMarketWatchMinuteTimeframe(snapshot, preferredTimeframe) {
  const availableMinuteTimeframes = marketWatchMinuteTimeframes.filter((option) => snapshot?.chartSets?.[option]?.points?.length);
  if (!availableMinuteTimeframes.length) {
    return null;
  }

  if (availableMinuteTimeframes.includes(preferredTimeframe)) {
    return preferredTimeframe;
  }

  if (availableMinuteTimeframes.includes("minute30")) {
    return "minute30";
  }

  return availableMinuteTimeframes[0];
}

function getMarketWatchPrimaryTimeframeGroups(snapshot) {
  return marketWatchPrimaryTimeframeGroups.filter((option) =>
    option === "minute"
      ? marketWatchMinuteTimeframes.some((timeframe) => snapshot?.chartSets?.[timeframe]?.points?.length)
      : snapshot?.chartSets?.[option]?.points?.length
  );
}

function getMarketWatchChartTime(point) {
  const intradayMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(point?.date ?? ""));
  if (intradayMatch) {
    const [, year, month, day, hour, minute] = intradayMatch;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) / 1000;
  }

  return point.date;
}

function getChartTimeKey(time) {
  if (time && typeof time === "object" && "year" in time && "month" in time && "day" in time) {
    return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
  }

  return String(time);
}

function buildIndexMovingAverage(points, period) {
  const result = [];

  for (let index = 0; index < points.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const window = points.slice(index - period + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.close, 0) / period;
    result.push({
      time: getMarketWatchChartTime(points[index]),
      value: average
    });
  }

  return result;
}

function buildMarketWatchChartSignature(points, timeframe, movingAverageConfig) {
  return JSON.stringify({
    timeframe,
    movingAveragePeriods: movingAverageConfig.map((config) => config.period),
    points: points.map((point) => [
      point.date,
      point.open,
      point.high,
      point.low,
      point.close,
      point.volume
    ])
  });
}

function clearMarketWatchExtremaMarkers(state) {
  state.extremaMarkers?.setMarkers([]);
}

function getMarketWatchVisiblePoints(points, range) {
  if (!Array.isArray(points) || !points.length || !range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    return [];
  }

  const from = Math.max(0, Math.floor(range.from));
  const to = Math.min(points.length - 1, Math.ceil(range.to));
  if (to < from) {
    return [];
  }

  return points.slice(from, to + 1).filter((point) => Number.isFinite(point?.high) && Number.isFinite(point?.low));
}

function getMarketWatchPercentChange(currentPrice, basePrice) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(basePrice) || basePrice === 0) {
    return null;
  }

  return ((currentPrice - basePrice) / basePrice) * 100;
}

function updateMarketWatchVisibleExtremaLines(state) {
  const range = state.chart?.timeScale().getVisibleLogicalRange?.();
  const visiblePoints = getMarketWatchVisiblePoints(state.points, range);
  const referencePrice = state.points.at(-1)?.close;
  if (!visiblePoints.length || !Number.isFinite(referencePrice) || referencePrice === 0) {
    clearMarketWatchExtremaMarkers(state);
    return;
  }

  let highPoint = visiblePoints[0];
  let lowPoint = visiblePoints[0];
  for (const point of visiblePoints) {
    if ((point.high ?? point.close) > (highPoint.high ?? highPoint.close)) {
      highPoint = point;
    }
    if ((point.low ?? point.close) < (lowPoint.low ?? lowPoint.close)) {
      lowPoint = point;
    }
  }

  const highPrice = highPoint.high ?? highPoint.close;
  const lowPrice = lowPoint.low ?? lowPoint.close;
  const highDrawdownPercent = getMarketWatchPercentChange(referencePrice, highPrice);
  const lowReboundPercent = getMarketWatchPercentChange(referencePrice, lowPrice);
  const markers = [];

  if (Number.isFinite(highPrice) && Number.isFinite(highDrawdownPercent)) {
    markers.push({
      time: getMarketWatchChartTime(highPoint),
      position: "atPriceTop",
      price: highPrice,
      color: "rgba(216, 76, 63, 0.95)",
      shape: "arrowDown",
      text: `고점 대비 ${formatPercent(highDrawdownPercent)}`
    });
  }

  if (Number.isFinite(lowPrice) && Number.isFinite(lowReboundPercent)) {
    markers.push({
      time: getMarketWatchChartTime(lowPoint),
      position: "atPriceBottom",
      price: lowPrice,
      color: "rgba(47, 110, 229, 0.95)",
      shape: "arrowUp",
      text: `저점 대비 ${formatPercent(lowReboundPercent)}`
    });
  }

  markers.sort((left, right) => String(left.time).localeCompare(String(right.time)));
  state.extremaMarkers?.setMarkers(markers);
}

function createMarketWatchChartState(container, tooltip) {
  const chart = createChart(container, {
    width: container.clientWidth || 640,
    height: 420,
    layout: {
      background: { type: ColorType.Solid, color: "#fffaf1" },
      textColor: "#695d4e",
      fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
    },
    grid: {
      vertLines: { color: "rgba(31,26,20,0.04)" },
      horzLines: { color: "rgba(31,26,20,0.06)" }
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(159,62,25,0.24)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: false
      },
      horzLine: {
        color: "rgba(159,62,25,0.2)",
        width: 1,
        style: LineStyle.Dashed
      }
    },
    rightPriceScale: {
      borderColor: "rgba(31,26,20,0.08)",
      scaleMargins: {
        top: 0.08,
        bottom: 0.26
      }
    },
    timeScale: {
      borderColor: "rgba(31,26,20,0.08)",
      timeVisible: true,
      secondsVisible: false
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false
    },
    handleScale: {
      mouseWheel: false,
      pinch: true,
      axisPressedMouseMove: true
    }
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#d84c3f",
    downColor: "#2f6ee5",
    borderUpColor: "#d84c3f",
    borderDownColor: "#2f6ee5",
    wickUpColor: "#d84c3f",
    wickDownColor: "#2f6ee5",
    priceLineVisible: false
  });

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "",
    priceLineVisible: false,
    lastValueVisible: false
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.78,
      bottom: 0
    }
  });

  const movingAverageSeries = [
    chart.addSeries(LineSeries, {
      color: "#177245",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    }),
    chart.addSeries(LineSeries, {
      color: "#d84c3f",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    }),
    chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    }),
    chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    })
  ];

  const state = {
    chart,
    resizeObserver: null,
    candleSeries,
    volumeSeries,
    movingAverageSeries,
    movingAverageConfig: [],
    container,
    tooltip,
    points: [],
    pointByTimeKey: new Map(),
    extremaMarkers: createSeriesMarkers(candleSeries, [], { autoScale: true }),
    viewportKey: null,
    wheelTarget: container,
    wheelHandler: null,
    visibleRangeHandler: null
  };

  state.wheelHandler = (event) => {
    applyLatestAnchoredWheelZoom(event, state.chart, state.points);
  };
  container.addEventListener("wheel", state.wheelHandler, { passive: false });
  state.visibleRangeHandler = () => {
    updateMarketWatchVisibleExtremaLines(state);
  };
  state.chart.timeScale().subscribeVisibleLogicalRangeChange(state.visibleRangeHandler);

  chart.subscribeCrosshairMove((param) => {
    if (!state.tooltip || !param.point || !param.time || !param.seriesData.size) {
      state.tooltip?.classList.add("hidden");
      return;
    }

    const candleData = param.seriesData.get(state.candleSeries);
    if (!candleData || !("open" in candleData)) {
      state.tooltip.classList.add("hidden");
      return;
    }

    const point = state.pointByTimeKey.get(getChartTimeKey(param.time)) ?? state.points.find((candidate) => candidate.date === String(param.time));
    if (!point) {
      state.tooltip.classList.add("hidden");
      return;
    }

    const left = Math.min(param.point.x + 16, state.container.clientWidth - 190);
    const top = Math.max(param.point.y - 16, 12);
    state.tooltip.style.left = `${left}px`;
    state.tooltip.style.top = `${top}px`;
    state.tooltip.classList.remove("hidden");
    const movingAverageTooltipHtml = state.movingAverageConfig
      .map((config, index) => {
        const value = getLineSeriesTooltipValue(param, state.movingAverageSeries[index]);
        return `<div>${escapeHtml(config.label)} ${formatDecimal(value)}</div>`;
      })
      .join("");

    state.tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(point.date))}</div>
      <div>시가 ${formatDecimal(candleData.open)}</div>
      <div>고가 ${formatDecimal(candleData.high)}</div>
      <div>저가 ${formatDecimal(candleData.low)}</div>
      <div>종가 ${formatDecimal(candleData.close)}</div>
      ${movingAverageTooltipHtml}
      <div>거래량 ${formatNumber(point.volume)}</div>
    `;
  });

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    chart.applyOptions({ width: entry.contentRect.width });
  });
  resizeObserver.observe(container);
  state.resizeObserver = resizeObserver;

  return state;
}

function syncMarketWatchChart({ container, tooltip, snapshot, timeframe }) {
  if (!container) {
    return;
  }

  const chartWindow = snapshot?.chartSets?.[timeframe] ?? snapshot?.chartSets?.daily;
  const points = chartWindow?.points;
  if (!points?.length) {
    return;
  }

  const movingAverageConfig = getMarketWatchMovingAverageConfig(timeframe);
  const viewportKey = getMarketWatchViewportKey(snapshot.key, timeframe);
  const savedViewport = marketWatchChartViewportByKey.get(viewportKey);
  const previousViewportKey = marketWatchChartState?.viewportKey ?? null;
  const currentVisibleRange = marketWatchChartState?.chart?.timeScale().getVisibleLogicalRange?.();
  if (
    previousViewportKey &&
    previousViewportKey !== viewportKey &&
    currentVisibleRange &&
    Number.isFinite(currentVisibleRange.from) &&
    Number.isFinite(currentVisibleRange.to)
  ) {
    marketWatchChartViewportByKey.set(previousViewportKey, {
      from: currentVisibleRange.from,
      to: currentVisibleRange.to
    });
  }

  if (!marketWatchChartState || marketWatchChartState.container !== container) {
    cleanupMarketWatchCharts();
    marketWatchChartState = createMarketWatchChartState(container, tooltip);
  }

  marketWatchChartState.container = container;
  marketWatchChartState.tooltip = tooltip;
  marketWatchChartState.points = points;
  marketWatchChartState.pointByTimeKey = new Map(points.map((point) => [String(getMarketWatchChartTime(point)), point]));
  marketWatchChartState.viewportKey = viewportKey;
  marketWatchChartState.movingAverageConfig = movingAverageConfig;

  const dataSignature = buildMarketWatchChartSignature(points, timeframe, movingAverageConfig);
  if (previousViewportKey === viewportKey && marketWatchChartState.dataSignature === dataSignature) {
    return;
  }

  const candleSeriesData = points.map((point) => ({
    time: getMarketWatchChartTime(point),
    open: point.open ?? point.close,
    high: point.high ?? point.close,
    low: point.low ?? point.close,
    close: point.close
  }));
  marketWatchChartState.candleSeries.setData(candleSeriesData);

  const volumeSeriesData = points.map((point) => ({
    time: getMarketWatchChartTime(point),
    value: point.volume ?? 0,
    color:
      (point.close ?? 0) >= (point.open ?? point.close ?? 0) ? "rgba(216,76,63,0.34)" : "rgba(47,110,229,0.3)"
  }));
  marketWatchChartState.volumeSeries.setData(volumeSeriesData);

  for (const [index, series] of marketWatchChartState.movingAverageSeries.entries()) {
    const config = movingAverageConfig[index];
    if (!config) {
      series.setData([]);
      continue;
    }

    series.applyOptions({ color: config.color });
    const movingAverageData = buildIndexMovingAverage(points, config.period);
    series.setData(movingAverageData);
  }

  if (tooltip) {
    tooltip.classList.add("hidden");
  }

  const chartPointCount = points.length;
  if (
    currentVisibleRange &&
    previousViewportKey === viewportKey &&
    Number.isFinite(currentVisibleRange.from) &&
    Number.isFinite(currentVisibleRange.to)
  ) {
    marketWatchChartState.chart.timeScale().setVisibleLogicalRange(currentVisibleRange);
  } else if (savedViewport) {
    marketWatchChartState.chart.timeScale().setVisibleLogicalRange(savedViewport);
  } else {
    setDefaultMarketWatchVisibleRange(marketWatchChartState.chart, chartPointCount, timeframe);
  }
  updateMarketWatchVisibleExtremaLines(marketWatchChartState);
  marketWatchChartState.dataSignature = dataSignature;
}

function setDefaultMarketWatchVisibleRange(chart, pointCount, timeframe) {
  const visibleSessions = DEFAULT_VISIBLE_MARKET_WATCH_SESSIONS[timeframe] ?? DEFAULT_VISIBLE_TRADING_SESSIONS;
  if (!Number.isFinite(pointCount) || pointCount <= 0) {
    chart.timeScale().fitContent();
    return;
  }

  const endIndex = pointCount - 1;
  const startIndex = Math.max(0, pointCount - visibleSessions);

  chart.timeScale().setVisibleLogicalRange({
    from: startIndex - 1,
    to: endIndex + 0.5
  });
}

function openIndexChartModal(key) {
  activeMarketWatchKey = key;
  indexChartModal?.classList.remove("hidden");
  startMarketWatchAutoRefresh();
  window.requestAnimationFrame(() => {
    renderIndexChartModal();
  });
  void loadMarketWatch({ background: true });
}

function closeIndexChartModal() {
  activeMarketWatchKey = null;
  cleanupMarketWatchCharts();
  indexChartModal?.classList.add("hidden");
  startMarketWatchAutoRefresh();
}

function openSwingScoreModal(button) {
  if (!swingScoreModal || !swingScoreModalBody || !swingScoreModalMeta) {
    return;
  }

  const label = button.dataset.scoreLabel ?? "상태";
  const description = decodeURIComponent(button.dataset.scoreDescription ?? "");
  const summary = decodeURIComponent(button.dataset.scoreSummary ?? "");
  const guide = decodeURIComponent(button.dataset.scoreGuide ?? "");
  const action = decodeURIComponent(button.dataset.scoreAction ?? "");
  const entry = decodeURIComponent(button.dataset.scoreEntry ?? "");
  const invalidation = decodeURIComponent(button.dataset.scoreInvalidation ?? "");
  const reasons = JSON.parse(decodeURIComponent(button.dataset.scoreReasons ?? "%5B%5D"));

  swingScoreModalMeta.textContent = label;
  swingScoreModalBody.innerHTML = `
    <div class="swing-pattern-summary">${escapeHtml(summary)}</div>
    <div class="swing-pattern-copy">${escapeHtml(description)}</div>
    ${action ? `<div class="swing-pattern-copy"><strong>전략:</strong> ${escapeHtml(action)}</div>` : ""}
    ${
      entry || invalidation
        ? `
          <div class="swing-reason-list">
            ${entry ? `<span class="swing-reason-chip">진입 구간 ${escapeHtml(entry)}</span>` : ""}
            ${invalidation ? `<span class="swing-reason-chip">이탈 기준 ${escapeHtml(invalidation)}</span>` : ""}
          </div>
        `
        : ""
    }
    <div class="swing-pattern-copy">${escapeHtml(guide).replaceAll("\n", "<br>")}</div>
    <div class="swing-reason-list">
      ${(Array.isArray(reasons) ? reasons : [])
        .map((reason) => `<span class="swing-reason-chip">${escapeHtml(reason)}</span>`)
        .join("")}
    </div>
  `;
  swingScoreModal.classList.remove("hidden");
}

function closeSwingScoreModal() {
  swingScoreModal?.classList.add("hidden");
}

function renderIndexChartModal() {
  if (!activeMarketWatchKey) {
    return;
  }

  const seed = indexWatchSeed.find((item) => item.key === activeMarketWatchKey);
  const snapshot = marketWatchItems.get(activeMarketWatchKey);
  if (!seed || !snapshot || !indexChartModalContainer || !indexChartModalTooltip) {
    return;
  }

  const requestedTimeframe = marketWatchTimeframeByKey.get(activeMarketWatchKey) ?? "daily";
  const availableTimeframes = getAvailableMarketWatchTimeframes(snapshot);
  const timeframe = availableTimeframes.includes(requestedTimeframe) ? requestedTimeframe : availableTimeframes[0] ?? "daily";
  const chartWindow = snapshot.chartSets?.[timeframe] ?? snapshot.chartSets?.daily;
  const movingAverageConfig = getMarketWatchMovingAverageConfig(timeframe);
  const displayMetrics = getMarketWatchDisplayMetrics(snapshot, timeframe);
  const trendClass =
    displayMetrics.changePercent > 0 ? "positive" : displayMetrics.changePercent < 0 ? "negative" : "neutral";

  if (indexChartModalTitle) {
    indexChartModalTitle.textContent = seed.name;
  }
  if (indexChartModalMeta) {
    indexChartModalMeta.textContent = `${seed.category} / ${seed.symbol}`;
  }
  if (indexChartModalPrice) {
    indexChartModalPrice.textContent = formatDecimal(displayMetrics.price);
  }
  if (indexChartModalChange) {
    indexChartModalChange.className = `index-chart-modal-change ${trendClass}`;
    indexChartModalChange.textContent = `${formatPercent(displayMetrics.changePercent)} / ${formatSignedDecimal(displayMetrics.changeAmount)}`;
  }
  if (indexChartModalToolbar) {
    const primaryOptions = getMarketWatchPrimaryTimeframeGroups(snapshot);
    const minuteOptions = marketWatchMinuteTimeframes.filter((option) => snapshot.chartSets?.[option]?.points?.length);
    const primaryButtons = primaryOptions
      .map((option) => {
        const active = option === "minute" ? isMarketWatchMinuteTimeframe(timeframe) : option === timeframe;
        const dataAttribute = option === "minute" ? `data-index-timeframe-group="minute"` : `data-index-timeframe="${option}"`;
        return `
          <button
            class="timeframe-tab ${active ? "active" : ""}"
            type="button"
            ${dataAttribute}
          >
            ${marketWatchTimeframeLabels[option]}
          </button>
        `;
      })
      .join("");
    const minuteButtons = isMarketWatchMinuteTimeframe(timeframe)
      ? `
        <div class="market-watch-sub-toolbar">
          ${minuteOptions
            .map(
              (option) => `
                <button
                  class="timeframe-tab sub-tab ${option === timeframe ? "active" : ""}"
                  type="button"
                  data-index-timeframe="${option}"
                >
                  ${marketWatchTimeframeLabels[option]}
                </button>
              `
            )
            .join("")}
        </div>
      `
      : "";
    indexChartModalToolbar.innerHTML = `
      <div class="market-watch-main-toolbar">${primaryButtons}</div>
      ${minuteButtons}
    `;
  }
  if (indexChartModalLegend) {
    indexChartModalLegend.innerHTML = movingAverageConfig
      .map(
        (line) => `
          <span class="legend-item"><span class="legend-line ${line.className}"></span>${line.label}</span>
        `
      )
      .join("");
  }
  if (indexChartModalStartDate) {
    indexChartModalStartDate.textContent = chartWindow?.startDate ?? "-";
  }
  if (indexChartModalEndDate) {
    indexChartModalEndDate.textContent = chartWindow?.endDate ?? "-";
  }

  indexChartModalTooltip.classList.add("hidden");
  syncMarketWatchChart({
    container: indexChartModalContainer,
    tooltip: indexChartModalTooltip,
    snapshot,
    timeframe
  });
}

function normalizeSearchText(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function extractChosung(value) {
  return [...String(value)]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= HANGUL_BASE && code <= HANGUL_END) {
        return CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)] ?? char;
      }
      return char;
    })
    .join("");
}

function combineAliases(...aliasGroups) {
  const aliases = [];
  for (const group of aliasGroups) {
    if (!Array.isArray(group)) {
      continue;
    }
    for (const alias of group) {
      const normalizedAlias = typeof alias === "string" ? alias.trim() : "";
      if (!normalizedAlias || aliases.some((item) => normalizeSearchText(item) === normalizeSearchText(normalizedAlias))) {
        continue;
      }
      aliases.push(normalizedAlias);
    }
  }
  return aliases;
}

function createStockSearchEntry(item) {
  const aliases = combineAliases(item.aliases, corporateAliasSeed.get(item.code));
  return {
    ...item,
    aliases,
    sector: item.sector,
    normalizedName: normalizeSearchText(item.name),
    normalizedCode: normalizeSearchText(item.code),
    chosung: extractChosung(item.name),
    normalizedAliases: aliases.map((alias) => normalizeSearchText(alias))
  };
}

function buildStockSearchUniverse() {
  const unique = new Map();

  for (const item of defaultRecommendationCatalog) {
    if (!unique.has(item.symbol)) {
      unique.set(item.symbol, {
        code: item.symbol,
        name: item.name,
        market: "WATCHLIST",
        sector: undefined,
        aliases: []
      });
    }
  }

  for (const item of stockMasterSeed) {
    unique.set(item.code, item);
  }

  return [...unique.values()].map(createStockSearchEntry);
}

function mergeStockUniverse(remoteItems) {
  const merged = new Map();

  for (const item of buildStockSearchUniverse()) {
    merged.set(item.code, item);
  }

  for (const item of remoteItems) {
    const previous = merged.get(item.code);
    merged.set(item.code, createStockSearchEntry({
      code: item.code,
      name: item.name,
      market: item.market || "KRX",
      sector: item.sector,
      aliases: combineAliases(previous?.aliases, item.aliases)
    }));
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

async function loadStockUniverse() {
  if (stockUniverseLoading || stockUniverseLoaded) {
    return;
  }

  stockUniverseLoading = true;
  renderStockSearchResults();

  try {
    const response = await fetch("/analysis/stock-universe");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "전체 종목 목록을 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    stockSearchUniverse = mergeStockUniverse(items);
    stockUniverseLoaded = true;
    repairRecommendationsFromUniverse(items);
  renderMoversThemeLists();
    if (hasLoadedMovers && activeView === "movers") {
      void loadMovers();
    }
  } catch (error) {
    console.error(error);
  } finally {
    stockUniverseLoading = false;
    renderStockSearchResults();
  }
}

function repairRecommendationsFromUniverse(items) {
  const universeNameByCode = new Map(
    items
      .filter((item) => typeof item?.code === "string" && typeof item?.name === "string")
      .map((item) => [item.code, item.name])
  );
  const selectedSymbol = recommendationCatalog.find((item) => item.key === selectedKey)?.symbol ?? null;

  let changed = false;
  recommendationCatalog = recommendationCatalog.map((item) => {
    const repaired = repairRecommendationText(item, universeNameByCode.get(item.symbol));
    if (
      repaired.name !== item.name ||
      repaired.key !== item.key ||
      repaired.note !== item.note
    ) {
      changed = true;
    }
    return repaired;
  });

  if (!changed) {
    return;
  }

  if (selectedSymbol) {
    selectedKey = recommendationCatalog.find((item) => item.symbol === selectedSymbol)?.key ?? selectedKey;
  }

  saveCatalog();
  renderSelector();

  if (selectedKey) {
    const repairedSelected = recommendationCatalog.find((item) => item.key === selectedKey);
    if (repairedSelected) {
      void runAnalysisByKey(repairedSelected.key);
    }
  }
}

function getStockSearchResults(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return stockSearchUniverse.slice(0, 12);
  }

  const ranked = stockSearchUniverse
    .map((item) => {
      let score = 0;

      if (item.normalizedCode === normalizedQuery) {
        score += 120;
      } else if (item.normalizedCode.startsWith(normalizedQuery)) {
        score += 100;
      }

      if (item.normalizedName === normalizedQuery) {
        score += 95;
      } else if (item.normalizedName.startsWith(normalizedQuery)) {
        score += 80;
      } else if (item.normalizedName.includes(normalizedQuery)) {
        score += 55;
      }

      if (item.chosung.startsWith(query)) {
        score += 70;
      } else if (item.chosung.includes(query)) {
        score += 45;
      }

      if (item.normalizedAliases.some((alias) => alias === normalizedQuery)) {
        score += 60;
      } else if (item.normalizedAliases.some((alias) => alias.startsWith(normalizedQuery))) {
        score += 40;
      }

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.item.name.localeCompare(right.item.name, "ko");
    });

  return ranked.slice(0, 20).map((entry) => entry.item);
}

function renderStockSearchResults() {
  if (!stockSearchResults) {
    return;
  }

  if (stockUniverseLoading && !stockUniverseLoaded && !stockSearchQuery) {
    stockSearchResults.innerHTML = `<div class="stock-search-empty">전체 종목 목록을 불러오는 중입니다...</div>`;
    return;
  }

  const results = getStockSearchResults(stockSearchQuery);
  if (!results.length) {
    stockSearchResults.innerHTML = `<div class="stock-search-empty">검색 결과가 없습니다. 종목명, 종목코드, 초성으로 다시 찾아보세요.</div>`;
    return;
  }

  stockSearchResults.innerHTML = results
    .map((item) => {
      const selected = selectedStockOption?.code === item.code;
      return `
        <button class="stock-search-item ${selected ? "selected" : ""}" type="button" data-stock-code="${escapeHtml(item.code)}">
          <span class="stock-search-item-head">
            <span class="stock-search-name">${escapeHtml(item.name)}</span>
            <span class="stock-search-code">${escapeHtml(item.code)}</span>
          </span>
          <span class="stock-search-meta">${escapeHtml(item.market)} / 초성 ${escapeHtml(item.chosung)}</span>
        </button>
      `;
    })
    .join("");
}

function selectStockOption(item) {
  selectedStockOption = item;
  stockNameInput.value = item.name;
  stockSymbolInput.value = item.code;

  if (selectedStockCard) {
    selectedStockCard.classList.remove("hidden");
    selectedStockCard.innerHTML = `
      <span class="selected-stock-label">선택된 종목</span>
      <span class="selected-stock-name">${escapeHtml(item.name)}</span>
      <span class="selected-stock-meta">${escapeHtml(item.code)} / ${escapeHtml(item.market)}</span>
    `;
  }

  if (stockSearchInput) {
    stockSearchInput.value = `${item.name} (${item.code})`;
  }

  renderStockSearchResults();
  showAppToast({
    title: "종목 선택",
    message: `${item.name} (${item.code})을 입력 폼에 반영했습니다.`,
    tone: "neutral",
    duration: 2600
  });
  stockPriceInput.focus();
}

function clearSelectedStockOption() {
  selectedStockOption = null;
  stockNameInput.value = "";
  stockSymbolInput.value = "";
  if (selectedStockCard) {
    selectedStockCard.classList.add("hidden");
    selectedStockCard.innerHTML = "";
  }
}

function getMoversFilters() {
  return {
    market: moversMarketSelect?.value || "all",
    limit: Number(moversLimitSelect?.value || 5),
    minChangePercent: Number(moversMinChangeInput?.value || 5),
    minVolumeRatio: Number(moversMinVolumeInput?.value || 2),
    minAlertScore: Number(moversMinScoreInput?.value || 40)
  };
}

async function loadMovers(options = {}) {
  const filters = getMoversFilters();
  const preserveMoversUi = Boolean(options.preserveMoversUi);
  const shouldNotify = Boolean(options.toast);
  setMoversStatus("loading", "\uC21C\uC704 \uC870\uD68C \uC911");
  showMoversSummary("");
  showMoversError("");

  if (riseMoversList && !preserveMoversUi) {
    riseMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB4F1\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
  }
  if (fallMoversList && !preserveMoversUi) {
    fallMoversList.innerHTML = `<div class="empty-state"><p>\uAE09\uB77D\uC8FC \uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...</p></div>`;
  }

  try {
    const [risePayload, fallPayload] = await Promise.all([
      fetchMoversByDirection("rise", filters),
      fetchMoversByDirection("fall", filters)
    ]);

    hasLoadedMovers = true;
    latestRiseMovers = risePayload.analyses;
    latestFallMovers = fallPayload.analyses;
    renderMoversThemeLists();
    renderMoversList(riseMoversList, risePayload.analyses, "rise");
    renderMoversList(fallMoversList, fallPayload.analyses, "fall");

    if (riseCountLabel) {
      riseCountLabel.textContent = `${risePayload.analyses.length}개`;
    }
    if (fallCountLabel) {
      fallCountLabel.textContent = `${fallPayload.analyses.length}개`;
    }

    setMoversStatus("done", "\uC870\uD68C \uC644\uB8CC");
    showMoversSummary(
      `${filters.market === "all" ? "\uC804\uCCB4 \uC2DC\uC7A5" : filters.market} \uAE30\uC900\uC73C\uB85C \uAE09\uB4F1 ${risePayload.analyses.length}\uAC1C, \uAE09\uB77D ${fallPayload.analyses.length}\uAC1C\uB97C \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4.`
    );
    if (shouldNotify) {
      showAppToast({
        title: "급등락 순위 갱신",
        message: `${filters.market === "all" ? "전체 시장" : filters.market} 기준 급등 ${risePayload.analyses.length}개, 급락 ${fallPayload.analyses.length}개를 표시했습니다.`,
        tone: "positive"
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "\uC21C\uC704\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
    setMoversStatus("error", "\uC870\uD68C \uC2E4\uD328");
    showMoversError(message);
    latestRiseMovers = [];
    latestFallMovers = [];
    hasLoadedMovers = true;
    renderMoversThemeLists();
    renderMoversList(riseMoversList, [], "rise");
    renderMoversList(fallMoversList, [], "fall");
    if (riseCountLabel) {
      riseCountLabel.textContent = "0개";
    }
    if (fallCountLabel) {
      fallCountLabel.textContent = "0개";
    }
    if (shouldNotify) {
      showAppToast({
        title: "급등락 순위 오류",
        message,
        tone: "negative",
        duration: 5200
      });
    }
  }
}

async function fetchMoversByDirection(direction, filters) {
  const params = new URLSearchParams({
    direction,
    market: filters.market,
    limit: String(filters.limit),
    minChangePercent: String(filters.minChangePercent),
    minVolumeRatio: String(filters.minVolumeRatio),
    minAlertScore: String(filters.minAlertScore)
  });

  const response = await fetch(`/analysis/korean-movers?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "급등/급락 순위를 불러오지 못했습니다.");
  }

  return {
    ...payload,
    analyses: Array.isArray(payload.analyses) ? payload.analyses : []
  };
}

function renderMoversList(container, items, direction) {
  if (!container) {
    return;
  }

  if (!items?.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${direction === "rise" ? "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAE09\uB4F1\uC8FC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAE09\uB77D\uC8FC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item, index) => {
      const changeClass = (item.changePercent ?? 0) >= 0 ? "positive" : "negative";
      const sector = getSectorLabel(item.symbol);
      const signalLabel =
        item.signal === "explosive" ? "\uD3ED\uBC1C" : item.signal === "strong" ? "\uAC15\uD568" : "\uAD00\uCC30";
      const edgeMetricLabel = direction === "rise" ? "\uACE0\uC810 \uB3CC\uD30C" : "\uC800\uC810 \uC774\uD0C8";
      const edgeMetricValue =
        direction === "rise"
          ? item.breakout60d
            ? "60\uC77C"
            : item.breakout20d
              ? "20\uC77C"
              : "-"
          : item.breakdown60d
            ? "60\uC77C"
            : item.breakdown20d
              ? "20\uC77C"
              : "-";

      return `
        <article class="mover-card ${direction}">
          <div class="mover-row">
            <div class="mover-title">
              <span class="mover-rank">${index + 1}</span>
              <div class="mover-copy">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="mover-meta">${escapeHtml(item.symbol)} / ${escapeHtml(item.market)}${sector ? ` / ${escapeHtml(sector)}` : ""} / \uC810\uC218 ${escapeHtml(String(item.alertScore))} ${renderInfoIcon(moversScoreGuideText, "점수 기준 안내")}</div>
              </div>
            </div>
            <div class="mover-price-line">
              <span class="mover-price">${formatNumber(item.price)}\uC6D0</span>
              <span class="mover-change ${changeClass}">${formatPercent(item.changePercent)}</span>
            </div>
            <div class="mover-metrics-inline">
              <span class="mover-metric-chip">\uAC70\uB798 ${formatMultiplier(item.volumeRatio20d)}</span>
              <span class="mover-metric-chip">\uB300\uAE08 ${formatKoreanEok(item.estimatedTurnover)}</span>
              <span class="mover-metric-chip">${edgeMetricLabel} ${edgeMetricValue}</span>
              <span class="mover-metric-chip">${direction === "rise" ? "\uACE0\uAC00\uBD80\uADFC" : "\uC800\uAC00\uBD80\uADFC"} ${direction === "rise" ? (item.closedNearHigh ? "\uC720\uC9C0" : "-") : item.closedNearLow ? "\uC720\uC9C0" : "-"}</span>
            </div>
            <span class="signal-pill ${escapeHtml(item.signal)}">${signalLabel}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyScoreGuideTooltips() {
  for (const icon of scoreGuideIcons) {
    icon.setAttribute("data-tooltip", moversScoreGuideText);
  }
}

function renderInfoIcon(text, label = "안내") {
  return `<span class="inline-info-icon" data-tooltip="${escapeHtml(text)}" aria-label="${escapeHtml(label)}" tabindex="0">i</span>`;
}

function isThirdBuyExecutionBlockedRecommendation(item) {
  return (
    hasReason(item?.reasons, "third_buy_confirmation_required") ||
    hasReason(item?.reasons, "third_buy_not_confirmed") ||
    hasReason(item?.reasons, "execution_blocked_by_deep_entry_policy")
  );
}

function renderSwingExecutionGuardBadge(item) {
  if (item?.category !== "swing" || !isThirdBuyExecutionBlockedRecommendation(item)) {
    return "";
  }

  return `
    <span class="stock-card-guard-pill blocked">
      3차 보류 · 지지 확인 전
    </span>
  `;
}

function getSectorLabel(symbol) {
  const item = stockSearchUniverse.find((candidate) => candidate.code === symbol);
  if (!item || typeof item.sector !== "string" || !item.sector.trim()) {
    return "";
  }

  return item.sector.trim();
}

function renderSelector() {
  const pagedItems = getPagedItems();
  const stockCards = pagedItems
    .map((item) => {
      const selected = item.key === selectedKey;
      const swingPattern = item.category === "swing" ? swingPatternByKey.get(item.key)?.pattern : null;
      const swingAssessment = item.category === "swing" ? getSwingAssessment(swingPattern) : null;
      const swingTradePlan = item.category === "swing" ? getSwingCardTradePlan(item.note, swingPattern, item.swingBucket) : null;
      const titleText = item.category === "swing" ? `${item.name} (${item.symbol})` : item.name;
      const metaText = item.category === "swing" ? "" : `${item.symbol} / ${item.anchorDate}`;
      const dividendInfoLine = buildDividendInfoLine(item);
      const longTermBucketLabel = item.category === "swing" ? "" : getNonSwingBucketLabel(item.category, item.longTermBucket);
      const swingBucketLabel = item.category === "swing" ? getSwingBucketLabel(item.swingBucket) : "";
      const groupPillHtml = longTermBucketLabel
        ? `<span class="stock-card-group-pill ${escapeHtml(item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET)}">${escapeHtml(longTermBucketLabel)}</span>`
        : swingBucketLabel
          ? `<span class="stock-card-group-pill ${escapeHtml(item.swingBucket === "watch" ? "watch" : "buy")}">${escapeHtml(swingBucketLabel)}</span>`
          : "";
      const longTermInsightNote = item.category === "swing" ? "" : item.longTermInsightNote ?? item.note;
      const longTermInsightKeywords = Array.isArray(item.longTermInsightKeywords) ? item.longTermInsightKeywords : null;
      const longTermKeywords =
        item.category === "swing"
          ? []
          : longTermInsightKeywords?.length
            ? longTermInsightKeywords
            : extractLongTermKeywords(longTermInsightNote, item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET);
      const longTermNoteSummary =
        item.category === "swing"
          ? ""
          : longTermInsightKeywords?.length
            ? longTermInsightKeywords.slice(0, 4).join(" / ")
            : formatLongTermSummary(longTermInsightNote, item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET);
      const realtimeLine = renderStockRealtimeLine(item);
      const swingExecutionTradeHtml =
        item.category === "swing" && swingTradePlan && item.swingBucket !== "watch"
          ? `
            <span class="stock-card-trade-grid">
              <span class="stock-card-trade-item stock-card-trade-item-buy">
                <span class="stock-card-trade-label">매수가</span>
                <span class="stock-card-trade-value stock-card-trade-value-group">
                  ${
                    swingTradePlan.buyLevels.length
                      ? `
                        <span class="stock-card-trade-badges">
                          ${swingTradePlan.buyLevels
                            .map((level) => `<span class="stock-card-trade-badge">${escapeHtml(level)}</span>`)
                            .join("")}
                        </span>
                      `
                      : `<span class="stock-card-trade-summary">${escapeHtml(swingTradePlan.buySummary)}</span>`
                  }
                </span>
              </span>
              <span class="stock-card-trade-item">
                <span class="stock-card-trade-label">손절가</span>
                <span class="stock-card-trade-value">${escapeHtml(swingTradePlan.stop)}</span>
              </span>
            </span>
          `
          : "";
      const swingGuardHtml = renderSwingExecutionGuardBadge(item);
      const swingStatusHtml =
        item.category === "swing" && (swingAssessment || swingGuardHtml)
          ? `
            <span class="stock-card-badges">
              ${
                swingAssessment
                  ? `
                    <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">상태: ${escapeHtml(swingAssessment.label)}</span>
                    <span class="stock-pattern-score">최근 ${SWING_LOOKBACK_DAYS}거래일 기준 / ${escapeHtml(swingAssessment.action)}</span>
                  `
                  : ""
              }
              ${swingGuardHtml}
            </span>
          `
          : "";
      return `
        <article class="stock-card ${selected ? "selected" : ""}">
          <span class="stock-card-head">
            <button class="stock-card-select" type="button" data-stock-key="${escapeHtml(item.key)}">
              <span class="stock-card-name">${escapeHtml(titleText)}</span>
              ${metaText ? `<span class="stock-card-meta">${escapeHtml(metaText)}</span>` : ""}
              ${dividendInfoLine ? `<span class="stock-card-meta">${escapeHtml(dividendInfoLine)}</span>` : ""}
              ${realtimeLine}
              ${swingStatusHtml}
              ${
                item.category === "swing"
                  ? ""
                  : longTermKeywords.length
                    ? `
                      <span class="stock-card-keywords" title="${escapeHtml(longTermInsightNote ?? "")}">
                        ${longTermKeywords
                          .map(
                            (keyword) =>
                              `<span class="stock-card-keyword ${escapeHtml(item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET)}">${escapeHtml(keyword)}</span>`
                          )
                          .join("")}
                      </span>
                    `
                    : `<span class="stock-card-note">${escapeHtml(longTermNoteSummary || longTermInsightNote || "")}</span>`
              }
            </button>
            ${groupPillHtml}
            <button class="stock-card-delete" type="button" data-delete-key="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.name)} 삭제">×</button>
          </span>
          ${
            swingExecutionTradeHtml
              ? `<button class="stock-card-select stock-card-trade-select" type="button" data-stock-key="${escapeHtml(item.key)}">${swingExecutionTradeHtml}</button>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  if (isDividendCategory(currentCategory)) {
    const filteredCount = getFilteredCatalog().length;
    const stockSectionIntro = renderDividendSectionIntro(
      "Dividend Recommendation Stocks",
      "기존 배당 추천 종목 엔진 결과를 그대로 유지합니다.",
      `${filteredCount}개`
    );
    const stockSectionBody = stockCards || `<div class="empty-state"><p>${getCurrentFilterEmptyMessage()}</p></div>`;
    stockSelector.innerHTML = `
      ${stockSectionIntro}
      <div class="stock-selector-list">
        ${stockSectionBody}
      </div>
      ${renderDividendEtfSection()}
    `;
  } else {
    stockSelector.innerHTML = stockCards;
  }

  if (!pagedItems.length && !isDividendCategory(currentCategory)) {
    stockSelector.innerHTML = `<div class="empty-state"><p>${getCurrentFilterEmptyMessage()}</p></div>`;
  }

  updatePaginationUi();
  maybePrefetchVisibleRealtimeSnapshots();
  persistUiState();
}

function isValidAppView(view) {
  return APP_VIEWS.includes(view);
}

function resolveHashAppView() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  return isValidAppView(hash) ? hash : null;
}

function resolveInitialAppView(savedView) {
  const hashView = resolveHashAppView();
  if (hashView) {
    return hashView;
  }

  return isValidAppView(savedView) ? savedView : "analysis";
}

function syncAppViewHash(view) {
  if (!isValidAppView(view)) {
    return;
  }

  const nextHash = `#${view}`;
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistUiState() {
  const payload = {
    activeView,
    currentCategory,
    currentLongTermBucket,
    currentSwingBucket,
    currentSwingProfile,
    selectedKey,
    itemsPerPage,
    currentPage
  };

  try {
    localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }

  syncAppViewHash(activeView);
}

function restoreUiState() {
  if (pageSizeSelect) {
    pageSizeSelect.value = PAGE_SIZE_OPTIONS.has(itemsPerPage) ? String(itemsPerPage) : "5";
  }

  if (!getFilteredCatalog().some((item) => item.key === selectedKey)) {
    selectedKey = getFilteredInitialKey();
  }

  currentPage = Math.min(Math.max(1, currentPage), getTotalPagesForCount(getFilteredCatalog().length));
}

function getRealtimeSnapshotKey(item) {
  return item?.key ?? item?.symbol ?? "";
}

function getVisibleStockSnapshotSignature() {
  return getPagedItems()
    .map((item) => getRealtimeSnapshotKey(item))
    .filter(Boolean)
    .join("|");
}

function getStockSnapshotRefreshInterval() {
  return currentCategory === "swing"
    ? SWING_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS
    : LONG_TERM_STOCK_SNAPSHOT_REFRESH_INTERVAL_MS;
}

function getStockRealtimeLineSignature(item) {
  const snapshot = realtimeStockSnapshots.get(getRealtimeSnapshotKey(item));
  if (snapshot?.error) {
    return `error:${snapshot.error}`;
  }

  if (typeof snapshot?.latestClose !== "number") {
    return "pending";
  }

  return JSON.stringify([
    snapshot.latestClose,
    snapshot.changePercent ?? null,
    snapshot.changeAmount ?? null,
    snapshot.latestDate ?? ""
  ]);
}

function renderStockRealtimeLine(item) {
  const liveKey = escapeHtml(getRealtimeSnapshotKey(item));
  const liveSignature = escapeHtml(getStockRealtimeLineSignature(item));
  const snapshot = realtimeStockSnapshots.get(getRealtimeSnapshotKey(item));
  if (snapshot?.error) {
    return `<span class="stock-card-live-row muted" data-live-stock-key="${liveKey}" data-live-stock-signature="${liveSignature}">${escapeHtml(snapshot.error)}</span>`;
  }

  if (typeof snapshot?.latestClose !== "number") {
    return `<span class="stock-card-live-row muted" data-live-stock-key="${liveKey}" data-live-stock-signature="${liveSignature}">실시간 시세 대기</span>`;
  }

  const trendClass =
    snapshot.changePercent > 0 ? "positive" : snapshot.changePercent < 0 ? "negative" : "neutral";
  const changeText =
    snapshot.changePercent == null
      ? "-"
      : `${formatPercent(snapshot.changePercent)} / ${formatSignedDecimal(snapshot.changeAmount ?? 0)}`;
  const latestDateText = snapshot.latestDate ? `${escapeHtml(snapshot.latestDate)} 기준` : "실시간";

  return `
    <span class="stock-card-live-row ${trendClass}" data-live-stock-key="${liveKey}" data-live-stock-signature="${liveSignature}">
      <span class="stock-card-live-price">${formatNumber(snapshot.latestClose)}원</span>
      <span class="stock-card-live-change">${changeText}</span>
      <span class="stock-card-live-stamp">${latestDateText}</span>
    </span>
  `;
}

function updateRealtimeSnapshotRows() {
  if (!stockSelector) {
    return;
  }

  const itemByKey = new Map(getPagedItems().map((item) => [getRealtimeSnapshotKey(item), item]));
  for (const row of stockSelector.querySelectorAll("[data-live-stock-key]")) {
    const item = itemByKey.get(row.dataset.liveStockKey);
    if (!item) {
      continue;
    }

    const nextSignature = getStockRealtimeLineSignature(item);
    if (row.dataset.liveStockSignature !== nextSignature) {
      row.outerHTML = renderStockRealtimeLine(item).trim();
    }
  }
}

function maybePrefetchVisibleRealtimeSnapshots() {
  if (activeView !== "analysis") {
    return;
  }

  const signature = getVisibleStockSnapshotSignature();
  if (!signature || signature === lastVisibleStockSnapshotSignature) {
    return;
  }

  void loadRealtimeStockSnapshots({ background: true });
}

async function loadRealtimeStockSnapshots(options = {}) {
  if (stockSnapshotLoading) {
    return;
  }

  const visibleItems = getPagedItems();
  if (!visibleItems.length) {
    realtimeStockSnapshots = new Map();
    lastVisibleStockSnapshotSignature = "";
    renderSelector();
    return;
  }

  stockSnapshotLoading = true;
  try {
    const response = await fetch("/analysis/realtime-stocks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: visibleItems.map((item) => ({
          key: item.key,
          name: item.name,
          symbol: item.symbol,
          category: item.category ?? DEFAULT_CATEGORY
        }))
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "실시간 시세를 불러오지 못했습니다.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    realtimeStockSnapshots = new Map(
      items.map((item) => [item.key ?? item.symbol, item])
    );
    lastVisibleStockSnapshotSignature = getVisibleStockSnapshotSignature();
    if (options.background) {
      updateRealtimeSnapshotRows();
    } else {
      renderSelector();
    }
  } catch (error) {
    console.error(error);
    if (!options.background) {
      showError(error instanceof Error ? error.message : "실시간 시세를 불러오지 못했습니다.");
    }
  } finally {
    stockSnapshotLoading = false;
  }
}

function startStockSnapshotAutoRefresh() {
  if (stockSnapshotRefreshTimer) {
    clearInterval(stockSnapshotRefreshTimer);
  }

  stockSnapshotRefreshTimer = window.setInterval(() => {
    if (activeView !== "analysis") {
      return;
    }

    void loadRealtimeStockSnapshots({ background: true });
  }, getStockSnapshotRefreshInterval());
}

function renderCategoryTabs() {
  if (!stockCategoryTabs) {
    return;
  }

  for (const tab of stockCategoryTabs.querySelectorAll("[data-category]")) {
    tab.classList.toggle("active", tab.dataset.category === currentCategory);
  }

  renderSwingProfileTabs();
  renderRecommendationScopePanel();
}

function getRecommendationScanLoadingKey(category = currentCategory, swingProfile = currentSwingProfile) {
  return isSwingCategory(category) && swingProfile === "smallcap" ? "swing:smallcap" : category;
}

function getRecommendationScanLabel(category, swingProfile = DEFAULT_SWING_PROFILE) {
  if (category === "swing") {
    return getSwingProfileLabel(resolveSwingProfile(swingProfile));
  }

  return category === DIVIDEND_CATEGORY ? "배당" : "중장기";
}

function readRecommendationScanSessions() {
  try {
    const raw = localStorage.getItem(SCAN_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeRecommendationScanSessions(sessions) {
  try {
    localStorage.setItem(SCAN_STATE_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    return;
  }
}

function rememberRecommendationScanSession(category, swingProfile = DEFAULT_SWING_PROFILE) {
  const resolvedProfile = resolveSwingProfile(swingProfile);
  const scopeKey = getRecommendationScanLoadingKey(category, resolvedProfile);
  const sessions = readRecommendationScanSessions();
  sessions[scopeKey] = {
    category,
    swingProfile: resolvedProfile,
    label: getRecommendationScanLabel(category, resolvedProfile),
    startedAt: new Date().toISOString()
  };
  writeRecommendationScanSessions(sessions);
  return scopeKey;
}

function forgetRecommendationScanSession(scopeKey) {
  const sessions = readRecommendationScanSessions();
  if (!sessions[scopeKey]) {
    return;
  }

  delete sessions[scopeKey];
  writeRecommendationScanSessions(sessions);
}

function getRecommendationScanSessionEntries() {
  return Object.entries(readRecommendationScanSessions()).filter(([, session]) => {
    if (!session || typeof session !== "object") {
      return false;
    }

    return session.category === DEFAULT_CATEGORY || session.category === DIVIDEND_CATEGORY || session.category === "swing";
  });
}

function hydrateRecommendationUniverseScanLoadingFromSessions() {
  for (const [scopeKey] of getRecommendationScanSessionEntries()) {
    if (scopeKey in recommendationUniverseScanLoadingByCategory) {
      recommendationUniverseScanLoadingByCategory[scopeKey] = true;
    }
  }
}

async function fetchRecommendationScanStatus(category, swingProfile = DEFAULT_SWING_PROFILE) {
  const params = new URLSearchParams({
    category,
    swingProfile: resolveSwingProfile(swingProfile)
  });
  const response = await fetch(`/analysis/recommendation-universe-scan/status?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "추천 검색 상태를 확인하지 못했습니다.");
  }

  return payload;
}

async function handleRestoredRecommendationScanCompletion(scopeKey, session, statusPayload) {
  const label = session.label || getRecommendationScanLabel(session.category, session.swingProfile);
  recommendationUniverseScanLoadingByCategory[scopeKey] = false;
  forgetRecommendationScanSession(scopeKey);
  await syncServerRecommendations({ silent: true });
  updateUniverseRecommendationButton();

  const result = statusPayload?.job?.result;
  const diffCount = Array.isArray(result?.universeDiff?.changes) ? result.universeDiff.changes.length : 0;
  const countText =
    result?.category === "swing"
      ? `매수후보 ${result.executionCount ?? 0}개, 관심후보 ${result.watchCount ?? 0}개`
      : result?.category === DIVIDEND_CATEGORY
        ? `후보 ${result.buyCount ?? 0}개, 관찰군 ${result.watchCount ?? 0}개`
        : `매수후보 ${result?.buyCount ?? 0}개, 관찰군 ${result?.watchCount ?? 0}개`;

  showSummary(`${label} 추천 검색이 완료되어 결과를 다시 불러왔습니다.${result ? ` ${countText}를 반영했습니다.` : ""}`);
  showAppToast({
    title: `${label} 추천 검색 완료`,
    message: result ? `${countText}를 반영했습니다.` : "새로고침 전 진행 중이던 검색 결과를 다시 불러왔습니다.",
    tone: diffCount ? "positive" : "neutral"
  });
}

async function reconcileRecommendationScanSession(scopeKey, session) {
  const statusPayload = await fetchRecommendationScanStatus(session.category, session.swingProfile);
  const label = session.label || getRecommendationScanLabel(session.category, session.swingProfile);

  if (statusPayload.running || statusPayload.status === "running") {
    recommendationUniverseScanLoadingByCategory[scopeKey] = true;
    updateUniverseRecommendationButton();
    showSummary(`${label} 추천 검색이 계속 진행 중입니다. 완료되면 결과를 자동으로 갱신합니다.`);
    return true;
  }

  if (statusPayload.status === "completed") {
    await handleRestoredRecommendationScanCompletion(scopeKey, session, statusPayload);
    return false;
  }

  if (statusPayload.status === "failed") {
    recommendationUniverseScanLoadingByCategory[scopeKey] = false;
    forgetRecommendationScanSession(scopeKey);
    updateUniverseRecommendationButton();
    showAppToast({
      title: `${label} 추천 검색 실패`,
      message: statusPayload.job?.error || "새로고침 전 진행 중이던 검색이 실패했습니다.",
      tone: "negative",
      duration: 5200
    });
    return false;
  }

  recommendationUniverseScanLoadingByCategory[scopeKey] = false;
  forgetRecommendationScanSession(scopeKey);
  updateUniverseRecommendationButton();
  return false;
}

async function pollRecommendationUniverseScanSessions() {
  const entries = getRecommendationScanSessionEntries();
  if (!entries.length) {
    if (recommendationUniverseScanPollTimer) {
      window.clearInterval(recommendationUniverseScanPollTimer);
      recommendationUniverseScanPollTimer = null;
    }
    return;
  }

  let hasRunning = false;
  for (const [scopeKey, session] of entries) {
    if (activeRecommendationScanRequestKeys.has(scopeKey)) {
      hasRunning = true;
      continue;
    }

    try {
      const running = await reconcileRecommendationScanSession(scopeKey, session);
      hasRunning = hasRunning || running;
    } catch (error) {
      console.error(error);
      hasRunning = true;
    }
  }

  if (!hasRunning && recommendationUniverseScanPollTimer) {
    window.clearInterval(recommendationUniverseScanPollTimer);
    recommendationUniverseScanPollTimer = null;
  }
}

function startRecommendationUniverseScanPolling() {
  if (recommendationUniverseScanPollTimer) {
    return;
  }

  recommendationUniverseScanPollTimer = window.setInterval(() => {
    void pollRecommendationUniverseScanSessions();
  }, RECOMMENDATION_SCAN_POLL_INTERVAL_MS);
}

async function restoreRecommendationUniverseScanSessions() {
  const entries = getRecommendationScanSessionEntries();
  if (!entries.length) {
    return;
  }

  for (const [scopeKey, session] of entries) {
    recommendationUniverseScanLoadingByCategory[scopeKey] = true;
  }
  updateUniverseRecommendationButton();
  await pollRecommendationUniverseScanSessions();
  if (getRecommendationScanSessionEntries().length) {
    startRecommendationUniverseScanPolling();
  }
}

function updateUniverseRecommendationButton() {
  if (!runUniverseRecommendationBtn) {
    return;
  }

  const isCurrentCategoryLoading =
    recommendationUniverseScanLoadingByCategory[getRecommendationScanLoadingKey(currentCategory, currentSwingProfile)] === true;
  runUniverseRecommendationBtn.disabled = isCurrentCategoryLoading;
  if (!isCurrentCategoryLoading) {
    runUniverseRecommendationBtn.textContent = isDividendCategory(currentCategory)
      ? "배당 추천 검색"
      : isSwingCategory(currentCategory)
        ? `${getSwingProfileLabel(currentSwingProfile)} 추천 검색`
        : "중장기 추천 검색";
    return;
  }

  runUniverseRecommendationBtn.textContent = isDividendCategory(currentCategory)
    ? "배당 추천 검색 중..."
    : isSwingCategory(currentCategory)
      ? `${getSwingProfileLabel(currentSwingProfile)} 추천 검색 중...`
      : "중장기 추천 검색 중...";
}

function renderRecommendationScopePanel() {
  const categoryLabel = getCategoryDisplayLabel(currentCategory);
  const activeBucketLabel = isSwingCategory(currentCategory)
    ? getSwingBucketLabel(currentSwingBucket)
    : getNonSwingBucketLabel(currentCategory, currentLongTermBucket);

  if (recommendationScopeTitle) {
    recommendationScopeTitle.textContent = isSwingCategory(currentCategory)
      ? `${categoryLabel} 추천 / ${getSwingProfileLabel(currentSwingProfile)} / ${activeBucketLabel}`
      : `${categoryLabel} 추천 / ${activeBucketLabel}`;
  }

  if (recommendationScopeHelp) {
    recommendationScopeHelp.textContent = isSwingCategory(currentCategory)
      ? currentSwingProfile === "smallcap"
        ? "상단 스윙 탭 아래에서 소형 스윙 엔진을 고르고, 소형주형 기준으로 추린 매수후보와 관심후보를 같은 화면에서 넘겨보며 관리합니다."
        : "상단에서 스윙 흐름을 고르고, 매수후보와 관심후보를 같은 화면에서 넘겨보며 직접 종목을 추가하거나 추천 검색 결과를 붙여서 관리합니다."
      : isDividendCategory(currentCategory)
        ? "배당 탭은 배당 추천 종목과 별도 배당 상장지수펀드 섹션을 함께 보여 주되, 상장지수펀드는 점수 엔진이 아닌 전용 필터 목록으로 분리해 관리합니다."
        : "상단에서 중장기 흐름을 유지한 채 매수후보군과 관찰군을 나눠 보고, 필요한 종목은 바로 추가하거나 추천 검색으로 채워 넣을 수 있습니다.";
  }

  if (openAddStockBtn) {
    openAddStockBtn.textContent = isSwingCategory(currentCategory)
      ? `${getSwingProfileLabel(currentSwingProfile)} 추천 추가`
      : isDividendCategory(currentCategory)
        ? "배당 종목 추가"
        : "중장기 추천 추가";
  }

  updateUniverseRecommendationButton();
}

function renderSwingProfileTabs() {
  if (!swingProfileTabs) {
    return;
  }

  const isVisible = currentCategory === "swing";
  swingProfileTabs.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    return;
  }

  const counts = getSwingProfileCounts();
  for (const tab of swingProfileTabs.querySelectorAll("[data-swing-profile]")) {
    const profile = tab.dataset.swingProfile;
    if (!isValidSwingProfile(profile)) {
      continue;
    }

    tab.classList.toggle("active", profile === currentSwingProfile);
    tab.textContent = `${getSwingProfileLabel(profile)} ${counts[profile]}개`;
  }
}

function renderLongTermBucketTabs() {
  if (!longTermBucketTabs) {
    return;
  }

  const isVisible = !isSwingCategory(currentCategory);
  longTermBucketTabs.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    renderRecommendationScopePanel();
    return;
  }

  const counts = getLongTermBucketCounts(currentCategory);
  for (const tab of longTermBucketTabs.querySelectorAll("[data-long-term-bucket]")) {
    const bucket = tab.dataset.longTermBucket;
    if (!isValidLongTermBucket(bucket)) {
      continue;
    }

    tab.classList.toggle("active", bucket === currentLongTermBucket);
    tab.textContent = `${getNonSwingBucketLabel(currentCategory, bucket)} ${counts[bucket]}개`;
  }

  renderRecommendationScopePanel();
}

function renderSwingBucketTabs() {
  if (!swingBucketTabs) {
    return;
  }

  const isVisible = currentCategory === "swing";
  swingBucketTabs.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    renderRecommendationScopePanel();
    return;
  }

  const counts = getSwingBucketCounts();
  for (const tab of swingBucketTabs.querySelectorAll("[data-swing-bucket]")) {
    const bucket = tab.dataset.swingBucket;
    if (!isValidSwingBucket(bucket)) {
      continue;
    }

    tab.classList.toggle("active", bucket === currentSwingBucket);
    tab.textContent = `${getSwingBucketLabel(bucket)} ${counts[bucket]}개`;
  }

  renderRecommendationScopePanel();
}

async function runRecommendationUniverseScan() {
  const requestedCategory = isSwingCategory(currentCategory)
    ? "swing"
    : isDividendCategory(currentCategory)
      ? DIVIDEND_CATEGORY
      : DEFAULT_CATEGORY;
  const requestedSwingProfile = isSwingCategory(currentCategory) ? currentSwingProfile : DEFAULT_SWING_PROFILE;
  const requestedLoadingKey = getRecommendationScanLoadingKey(requestedCategory, requestedSwingProfile);
  if (recommendationUniverseScanLoadingByCategory[requestedLoadingKey]) {
    return;
  }
  const requestedLabel =
    requestedCategory === "swing"
      ? getSwingProfileLabel(requestedSwingProfile)
      : requestedCategory === DIVIDEND_CATEGORY
        ? "배당"
        : "중장기";

  recommendationUniverseScanLoadingByCategory[requestedLoadingKey] = true;
  rememberRecommendationScanSession(requestedCategory, requestedSwingProfile);
  activeRecommendationScanRequestKeys.add(requestedLoadingKey);
  startRecommendationUniverseScanPolling();
  updateUniverseRecommendationButton();
  showError("");
  showSummary(`${requestedLabel} universe 검색을 시작했습니다. 종목 수가 많아 시간이 걸릴 수 있습니다.`);
  showAppToast({
    title: `${requestedLabel} 추천 검색`,
    message: "검색을 시작했습니다. 결과가 준비되면 목록을 갱신합니다.",
    tone: "neutral",
    duration: 2600
  });

  let scanStarted = false;
  try {
    const response = await fetch("/analysis/recommendation-universe-scan?async=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        category: requestedCategory,
        swingProfile: requestedSwingProfile
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? `${requestedLabel} universe 검색을 실행하지 못했습니다.`);
    }

    if (payload.accepted) {
      scanStarted = true;
      activeRecommendationScanRequestKeys.delete(requestedLoadingKey);
      showSummary(`${requestedLabel} universe 검색이 서버에서 진행 중입니다. 완료되면 결과를 자동으로 갱신합니다.`);
      await pollRecommendationUniverseScanSessions();
      startRecommendationUniverseScanPolling();
      return;
    }

    if (payload.category === "swing") {
      const executionItems = Array.isArray(payload.executionItems) ? payload.executionItems : [];
      const watchItems = Array.isArray(payload.watchItems) ? payload.watchItems : [];
      const items =
        executionItems.length || watchItems.length
          ? [
              ...executionItems.map((item) => ({ ...item, bucket: "execution", swingProfile: requestedSwingProfile })),
              ...watchItems.map((item) => ({ ...item, bucket: "watch", swingProfile: requestedSwingProfile }))
            ]
          : Array.isArray(payload.items)
            ? payload.items.map((item) => ({ ...item, swingProfile: requestedSwingProfile }))
            : [];

      recommendationCatalog = syncServerSwingRecommendations(recommendationCatalog, items, requestedSwingProfile);
      serverSwingPicksLoadedByProfile[requestedSwingProfile] = true;
      await refreshSwingPatternSnapshots();

      if (currentCategory === "swing" && currentSwingProfile === requestedSwingProfile) {
        currentPage = 1;
        if (currentSwingBucket === "execution" && !executionItems.length && watchItems.length) {
          currentSwingBucket = "watch";
        } else if (currentSwingBucket === "watch" && !watchItems.length && executionItems.length) {
          currentSwingBucket = "execution";
        }
        selectedKey = getFilteredCatalog()[0]?.key ?? null;
      }

      saveCatalog();
      syncSelectedKeyWithCatalog();
      renderCategoryTabs();
      renderLongTermBucketTabs();
      renderSwingBucketTabs();
      renderSelector();

      if (currentCategory === "swing" && currentSwingProfile === requestedSwingProfile && selectedKey) {
        await runAnalysisByKey(selectedKey);
      }

      const swingDiffCount = Array.isArray(payload.universeDiff?.changes) ? payload.universeDiff.changes.length : 0;
      showSummary(
        `${requestedLabel} universe 검색이 완료되었습니다. 매수후보 ${payload.executionCount ?? executionItems.length}개 / 관심후보 ${payload.watchCount ?? watchItems.length}개를 반영했습니다.${swingDiffCount ? ` 변화 ${swingDiffCount}건을 알림 기준으로 처리했습니다.` : " 변화 종목은 없었습니다."}`
      );
      showAppToast({
        title: `${requestedLabel} 추천 검색 완료`,
        message: `매수후보 ${payload.executionCount ?? executionItems.length}개, 관심후보 ${payload.watchCount ?? watchItems.length}개를 반영했습니다.`,
        tone: swingDiffCount ? "positive" : "neutral"
      });
      return;
    }

    if (payload.category === DIVIDEND_CATEGORY) {
      const items = Array.isArray(payload.items) ? payload.items : [];
      recommendationCatalog = syncServerDividendRecommendations(recommendationCatalog, items);
      serverDividendPicksLoaded = true;

      if (currentCategory === DIVIDEND_CATEGORY) {
        currentPage = 1;
        if (currentLongTermBucket === "buy" && !payload.buyCount && payload.watchCount) {
          currentLongTermBucket = "watch";
        } else if (currentLongTermBucket === "watch" && !payload.watchCount && payload.buyCount) {
          currentLongTermBucket = "buy";
        }
        selectedKey = getFilteredCatalog()[0]?.key ?? null;
      }

      saveCatalog();
      syncSelectedKeyWithCatalog();
      renderCategoryTabs();
      renderLongTermBucketTabs();
      renderSwingBucketTabs();
      renderSelector();

      if (currentCategory === DIVIDEND_CATEGORY && selectedKey) {
        await runAnalysisByKey(selectedKey);
      }

      const dividendDiffCount = Array.isArray(payload.universeDiff?.changes) ? payload.universeDiff.changes.length : 0;
      showSummary(
        `배당 universe 검색이 완료되었습니다. 후보 ${payload.buyCount ?? 0}개 / 관찰군 ${payload.watchCount ?? 0}개를 반영했습니다.${dividendDiffCount ? ` 변화 ${dividendDiffCount}건을 알림 기준으로 처리했습니다.` : " 변화 종목은 없었습니다."}`
      );
      showAppToast({
        title: "배당 추천 검색 완료",
        message: `후보 ${payload.buyCount ?? 0}개, 관찰군 ${payload.watchCount ?? 0}개를 반영했습니다.`,
        tone: dividendDiffCount ? "positive" : "neutral"
      });
      return;
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    recommendationCatalog = syncServerLongTermRecommendations(recommendationCatalog, items);
    serverLongTermPicksLoaded = true;

    if (currentCategory === DEFAULT_CATEGORY) {
      currentPage = 1;
      if (currentLongTermBucket === "buy" && !payload.buyCount && payload.watchCount) {
        currentLongTermBucket = "watch";
      } else if (currentLongTermBucket === "watch" && !payload.watchCount && payload.buyCount) {
        currentLongTermBucket = "buy";
      }
      selectedKey = getFilteredCatalog()[0]?.key ?? null;
    }

    saveCatalog();
    syncSelectedKeyWithCatalog();
    renderCategoryTabs();
    renderLongTermBucketTabs();
    renderSwingBucketTabs();
    renderSelector();

    if (currentCategory === DEFAULT_CATEGORY && selectedKey) {
      await runAnalysisByKey(selectedKey);
    }

    const longTermDiffCount = Array.isArray(payload.universeDiff?.changes) ? payload.universeDiff.changes.length : 0;
    showSummary(
      `중장기 universe 검색이 완료되었습니다. 매수후보 ${payload.buyCount ?? 0}개 / 관찰군 ${payload.watchCount ?? 0}개를 반영했습니다.${longTermDiffCount ? ` 변화 ${longTermDiffCount}건을 알림 기준으로 처리했습니다.` : " 변화 종목은 없었습니다."}`
    );
    showAppToast({
      title: "중장기 추천 검색 완료",
      message: `매수후보 ${payload.buyCount ?? 0}개, 관찰군 ${payload.watchCount ?? 0}개를 반영했습니다.`,
      tone: longTermDiffCount ? "positive" : "neutral"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "universe 검색 중 오류가 발생했습니다.";
    console.error(error);
    showError(message);
    showSummary("");
    showAppToast({
      title: `${requestedLabel} 추천 검색 실패`,
      message,
      tone: "negative",
      duration: 5200
    });
  } finally {
    activeRecommendationScanRequestKeys.delete(requestedLoadingKey);
    if (!scanStarted) {
      recommendationUniverseScanLoadingByCategory[requestedLoadingKey] = false;
      forgetRecommendationScanSession(requestedLoadingKey);
    }
    updateUniverseRecommendationButton();
  }
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return dedupeLongTermRecommendations(defaultRecommendationCatalog.map(normalizeRecommendation));
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return dedupeLongTermRecommendations(defaultRecommendationCatalog.map(normalizeRecommendation));
    }

    const normalized = dedupeLongTermRecommendations(parsed.filter(isValidRecommendation).map(normalizeRecommendation)).map(repairRecommendationText);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return normalized;
  } catch {
    return dedupeLongTermRecommendations(defaultRecommendationCatalog.map(normalizeRecommendation));
  }
}

function saveCatalog() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recommendationCatalog));
}

function isValidRecommendation(item) {
  return Boolean(
    item &&
      typeof item.key === "string" &&
      typeof item.name === "string" &&
      typeof item.symbol === "string" &&
      typeof item.anchorDate === "string"
  );
}

function normalizeRecommendation(item) {
  const category = resolveRecommendationCategory(item?.category);
  const swingProfile = category === "swing" ? resolveSwingProfile(item?.swingProfile) : undefined;
  const normalizedName = typeof item?.name === "string" ? item.name : typeof item?.symbol === "string" ? item.symbol : "종목";
  const normalizedSymbol = typeof item?.symbol === "string" ? item.symbol : "";
  const baseKey =
    typeof item?.key === "string" && item.key.trim()
      ? item.key.trim()
      : createRecommendationKey(normalizedName, normalizedSymbol, category, swingProfile);
  return {
    ...item,
    key: scopeRecommendationKey(baseKey, category, swingProfile),
    category,
    longTermBucket: category === "swing" ? undefined : resolveLongTermBucket(item),
    swingBucket: category === "swing" ? resolveSwingBucket(item) : undefined,
    swingProfile,
    source: typeof item?.source === "string" ? item.source : undefined
  };
}

function resolveLongTermBucket(item) {
  if (item?.longTermBucket === "watch") {
    return "watch";
  }

  if (item?.longTermBucket === "buy") {
    return "buy";
  }

  return inferLongTermBucketFromNote(item?.note);
}

function inferLongTermBucketFromNote(note) {
  const normalizedNote = typeof note === "string" ? note.toLowerCase() : "";
  if (!normalizedNote) {
    return DEFAULT_LONG_TERM_BUCKET;
  }

  const watchKeywords = ["관찰", "돌파 여부", "삭제 전 목록", "as 글", "언급"];
  return watchKeywords.some((keyword) => normalizedNote.includes(keyword)) ? "watch" : "buy";
}

function isValidLongTermBucket(value) {
  return value === "buy" || value === "watch";
}

function resolveSwingProfile(value) {
  return value === "smallcap" ? "smallcap" : DEFAULT_SWING_PROFILE;
}

function isValidSwingProfile(value) {
  return value === "default" || value === "smallcap";
}

function getSwingProfileLabel(profile) {
  return profile === "smallcap" ? "소형 스윙" : "기본 스윙";
}

function isSwingCategory(category) {
  return category === "swing";
}

function isDividendCategory(category) {
  return category === DIVIDEND_CATEGORY;
}

function resolveRecommendationCategory(category) {
  if (category === "swing") {
    return "swing";
  }

  if (category === DIVIDEND_CATEGORY) {
    return DIVIDEND_CATEGORY;
  }

  return DEFAULT_CATEGORY;
}

function scopeRecommendationKey(key, category, swingProfile = DEFAULT_SWING_PROFILE) {
  if (!key) {
    return key;
  }

  if (category === DEFAULT_CATEGORY) {
    return key.replace(/-(dividend|swing(?:-smallcap)?)$/u, "");
  }

  if (category === "swing") {
    const suffix = swingProfile === "smallcap" ? "swing-smallcap" : "swing";
    return key.endsWith(`-${suffix}`) ? key : `${key}-${suffix}`;
  }

  return key.endsWith(`-${category}`) ? key : `${key}-${category}`;
}

function isValidCategory(value) {
  return value === "swing" || value === DIVIDEND_CATEGORY || value === DEFAULT_CATEGORY;
}

function resolveSwingBucket(item) {
  if (item?.swingBucket === "watch" || item?.bucket === "watch") {
    return "watch";
  }

  if (
    item?.swingBucket === "execution" ||
    item?.swingBucket === "execution_ready" ||
    item?.swingBucket === "execution_probe" ||
    item?.bucket === "execution" ||
    item?.bucket === "execution_ready" ||
    item?.bucket === "execution_probe"
  ) {
    return "execution";
  }

  return DEFAULT_SWING_BUCKET;
}

function isValidSwingBucket(value) {
  return value === "execution" || value === "watch";
}

function getSwingBucketLabel(bucket) {
  return bucket === "watch" ? "관심후보" : "매수후보";
}

function getLongTermBucketLabel(bucket) {
  return bucket === "watch" ? "관찰군" : "매수후보군";
}

function getDividendBucketLabel(bucket) {
  return bucket === "watch" ? "관찰군" : "배당후보군";
}

function getNonSwingBucketLabel(category, bucket) {
  return isDividendCategory(category) ? getDividendBucketLabel(bucket) : getLongTermBucketLabel(bucket);
}

function getCategoryDisplayLabel(category) {
  if (isSwingCategory(category)) {
    return "스윙";
  }

  if (isDividendCategory(category)) {
    return "배당";
  }

  return "중장기";
}

function formatDividendAmount(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return `${formatNumber(value)}원`;
}

function formatDividendYield(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return `${formatDecimal(value, 2)}%`;
}

function formatExpenseRatio(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return `${formatDecimal(value, 2)}%`;
}

function formatDividendEtfCategory(category) {
  if (category === "dividend growth") {
    return "배당 성장";
  }

  if (category === "high dividend") {
    return "고배당";
  }

  return category || "-";
}

function buildDividendEtfDisplayNote(item) {
  const parts = [item?.category === "dividend growth" ? "배당 성장형 상장지수펀드" : "고배당 상장지수펀드"];

  if (item?.distributionStability === "stable") {
    parts.push("분배 흐름이 비교적 안정적");
  }

  if ((item?.expenseRatio ?? 1) <= 0.15) {
    parts.push("총보수 부담이 낮음");
  } else if ((item?.expenseRatio ?? 1) <= 0.5) {
    parts.push("기본 보수 조건 충족");
  }

  parts.push(item?.category === "dividend growth" ? "장기 보유 검토 가능" : "방어형 배분 후보");

  return parts.slice(0, 3).join(" / ");
}

function renderDividendSectionIntro(title, caption, meta = "") {
  return `
    <section class="recommendation-subsection">
      <div class="section-head recommendation-subsection-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="field-help">${escapeHtml(caption)}</p>
        </div>
        ${meta ? `<span class="section-meta">${escapeHtml(meta)}</span>` : ""}
      </div>
    </section>
  `;
}

function renderDividendEtfSection() {
  const items = Array.isArray(dividendEtfRecommendations) ? dividendEtfRecommendations : [];
  const intro = renderDividendSectionIntro(
    "배당 상장지수펀드",
    "배당 중심 상장지수펀드만 별도 필터로 추려서 표시합니다. 종목형 배당 점수는 적용하지 않습니다.",
    `${items.length}개`
  );

  if (!items.length) {
    return `
      ${intro}
      <section class="dividend-etf-section">
        <div class="empty-state">
          <p>현재 조건에 맞는 배당 상장지수펀드가 없습니다.</p>
        </div>
      </section>
    `;
  }

  return `
    ${intro}
    <section class="dividend-etf-section">
      <div class="dividend-etf-list">
        ${items
          .map(
            (item) => `
              <article class="dividend-etf-card ${selectedDividendEtfSymbol === item.symbol ? "selected" : ""}">
                <button class="dividend-etf-button" type="button" data-dividend-etf-symbol="${escapeHtml(item.symbol)}">
                  <div class="dividend-etf-card-head">
                    <div>
                      <h4>${escapeHtml(item.name || item.symbol)}</h4>
                      <p class="dividend-etf-symbol">${escapeHtml(item.symbol)}</p>
                    </div>
                    <span class="dividend-etf-category">${escapeHtml(formatDividendEtfCategory(item.category))}</span>
                  </div>
                  <div class="dividend-etf-metrics">
                    <span class="dividend-etf-metric-chip">배당수익률 ${escapeHtml(formatDividendYield(item.dividendYield))}</span>
                    <span class="dividend-etf-metric-chip">총보수 ${escapeHtml(formatExpenseRatio(item.expenseRatio))}</span>
                    <span class="dividend-etf-metric-chip">분배 이력 ${escapeHtml(formatNumber(item.dividendHistoryYears))}년</span>
                  </div>
                  <p class="dividend-etf-note">${escapeHtml(buildDividendEtfDisplayNote(item))}</p>
                </button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function getDividendHistoryEntries(item) {
  if (!isDividendCategory(item?.category)) {
    return [];
  }

  if (Array.isArray(item?.etfDividendHistory) && item.etfDividendHistory.length) {
    return item.etfDividendHistory
      .slice(0, 4)
      .map((entry, index) => ({
        label: typeof entry?.label === "string" && entry.label ? entry.label : `최근 ${index + 1}`,
        dividendDateLabel:
          typeof entry?.dividendDateLabel === "string" && entry.dividendDateLabel
            ? entry.dividendDateLabel
            : typeof entry?.label === "string" && entry.label
              ? entry.label
              : "-",
        dividendAmount:
          typeof entry?.dividendAmount === "number" && Number.isFinite(entry.dividendAmount) ? entry.dividendAmount : undefined,
        dividendYield:
          typeof entry?.dividendYield === "number" && Number.isFinite(entry.dividendYield) ? entry.dividendYield : undefined
      }));
  }

  const history = Array.isArray(item?.fundamentals?.dividendHistory) ? item.fundamentals.dividendHistory.slice(-4) : [];
  if (!history.length) {
    const explicitDate = typeof item?.latestDividendDate === "string" && item.latestDividendDate ? item.latestDividendDate : "";
    const explicitAmount =
      typeof item?.latestDividendAmount === "number" && Number.isFinite(item.latestDividendAmount)
        ? item.latestDividendAmount
        : undefined;

    return explicitDate || explicitAmount != null
      ? [
          {
            label: "최근 배당",
            dividendDateLabel: explicitDate || "-",
            dividendAmount: explicitAmount,
            dividendYield: undefined
          }
        ]
      : [];
  }

  return history
    .slice()
    .reverse()
    .map((entry, index) => {
      const explicitDate =
        index === 0 && typeof item?.latestDividendDate === "string" && item.latestDividendDate
          ? item.latestDividendDate
          : "";
      const explicitAmount =
        index === 0 && typeof item?.latestDividendAmount === "number" && Number.isFinite(item.latestDividendAmount)
          ? item.latestDividendAmount
          : undefined;

      return {
        label: typeof entry?.label === "string" && entry.label ? entry.label : `최근 ${index + 1}`,
        dividendDateLabel:
          explicitDate ||
          (typeof entry?.dividendDateLabel === "string" && entry.dividendDateLabel
            ? entry.dividendDateLabel
            : typeof entry?.label === "string" && entry.label
              ? entry.label
              : "-"),
        dividendAmount:
          explicitAmount ??
          (typeof entry?.dividendAmount === "number" && Number.isFinite(entry.dividendAmount)
            ? entry.dividendAmount
            : undefined),
        dividendYield:
          typeof entry?.dividendYield === "number" && Number.isFinite(entry.dividendYield) ? entry.dividendYield : undefined
      };
    });
}

function buildDividendInfoLine(item) {
  if (!isDividendCategory(item?.category)) {
    return "";
  }

  const isEtfHistory = Array.isArray(item?.etfDividendHistory) && item.etfDividendHistory.length;
  const latestHistory = getDividendHistoryEntries(item)[0];
  const date =
    typeof item?.latestDividendDate === "string" && item.latestDividendDate
      ? item.latestDividendDate
      : latestHistory?.dividendDateLabel ?? "";
  const amountValue =
    typeof item?.latestDividendAmount === "number" && Number.isFinite(item.latestDividendAmount)
      ? item.latestDividendAmount
      : latestHistory?.dividendAmount;
  const amountText = amountValue != null ? formatDividendAmount(amountValue) : "";
  const yieldText = formatDividendYield(latestHistory?.dividendYield);
  const dateLabel = isEtfHistory ? "최근 분배일" : "최근 배당일";
  const amountLabel = isEtfHistory ? "분배금" : "배당액";
  const yieldLabel = isEtfHistory ? "추정 분배수익률" : "추정 배당수익률";

  return [`${dateLabel} ${date || "-"}`, `${amountLabel} ${amountText || "-"}`, `${yieldLabel} ${yieldText}`].join(" / ");
}

function buildDividendHistoryPanel(item) {
  if (!isDividendCategory(item?.category)) {
    return "";
  }

  const isEtfHistory = Array.isArray(item?.etfDividendHistory) && item.etfDividendHistory.length;
  const entries = getDividendHistoryEntries(item);
  const historyTitle = isEtfHistory ? "최근 상장지수펀드 분배 이력" : "최근 4년 배당 이력";
  const historyEmpty = isEtfHistory ? "최근 상장지수펀드 분배일과 분배금을 아직 불러오지 못했습니다." : "최근 4년 배당일과 배당액을 아직 불러오지 못했습니다.";
  const yieldHeader = isEtfHistory ? "추정 분배수익률" : "추정 배당수익률";
  const emptyLabel = isEtfHistory ? "분배 데이터 없음" : "배당 데이터 없음";
  if (!entries.length) {
    return `
      <div class="dividend-history-block">
        <div class="dividend-history-head">
          <strong>${historyTitle}</strong>
          <span>${emptyLabel}</span>
        </div>
        <div class="dividend-history-empty">${historyEmpty}</div>
      </div>
    `;
  }

  return `
    <div class="dividend-history-block">
      <div class="dividend-history-head">
        <strong>${historyTitle}</strong>
        <span>최신순</span>
      </div>
      <div class="dividend-history-table" role="table" aria-label="${historyTitle}">
        <div class="dividend-history-row dividend-history-row-head" role="row">
          <span role="columnheader">구분</span>
          <span role="columnheader">배당일</span>
          <span role="columnheader">배당액</span>
          <span role="columnheader">${yieldHeader}</span>
        </div>
        ${entries
          .map(
            (entry, index) => `
              <div class="dividend-history-row" role="row">
                <span role="cell">${escapeHtml(index === 0 ? `최근 ${entry.label}` : entry.label)}</span>
                <span role="cell">${escapeHtml(entry.dividendDateLabel || "-")}</span>
                <span role="cell">${escapeHtml(formatDividendAmount(entry.dividendAmount))}</span>
                <span role="cell">${escapeHtml(formatDividendYield(entry.dividendYield))}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function getEngineDisplayLabel(category) {
  return isDividendCategory(category) ? "배당 엔진" : "중장기 엔진";
}

function getEnginePanelTitle(category) {
  return isDividendCategory(category) ? "배당 지표" : "중장기 지표";
}

function getEngineBucketLabel(category, group) {
  if (isDividendCategory(category)) {
    return group === "watch candidate" ? "배당 관찰군" : "배당 후보군";
  }

  return formatLongTermGroupLabel(group);
}

function getEngineReviewExclusionText(category) {
  return isDividendCategory(category) ? "배당 엔진 대상에서 제외" : "중장기 대표주 엔진 대상에서 제외";
}

function getEngineReviewEmptyText(category) {
  return isDividendCategory(category) ? "평가 가능한 배당 엔진 결과가 없습니다." : "평가 가능한 중장기 엔진 결과가 없습니다.";
}

function getMarketWatchDisplayMetrics(snapshot, timeframe = "daily") {
  if (timeframe === "daily") {
    return {
      price: snapshot?.price,
      changeAmount: snapshot?.changeAmount,
      changePercent: snapshot?.changePercent,
      latestDate: snapshot?.latestDate ?? snapshot?.chartSets?.daily?.endDate
    };
  }

  const chartWindow = snapshot?.chartSets?.[timeframe] ?? snapshot?.chartSets?.daily;
  const points = chartWindow?.points ?? [];
  const latestPoint = points.at(-1);
  const previousPoint = points.at(-2);

  if (latestPoint && previousPoint) {
    const changeAmount = latestPoint.close - previousPoint.close;
    return {
      price: latestPoint.close,
      changeAmount,
      changePercent: previousPoint.close === 0 ? undefined : (changeAmount / previousPoint.close) * 100,
      latestDate: latestPoint.date
    };
  }

  return {
    price: snapshot?.price,
    changeAmount: snapshot?.changeAmount,
    changePercent: snapshot?.changePercent,
    latestDate: snapshot?.latestDate
  };
}

function looksCorruptedText(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return /�/.test(trimmed) || /\?{2,}/.test(trimmed);
}

function repairRecommendationText(item, fallbackName) {
  const source = defaultRecommendationBySymbol.get(item.symbol);
  const next = { ...item };
  const previousName = next.name;
  const repairedName =
    typeof fallbackName === "string" && fallbackName.trim()
      ? fallbackName.trim()
      : looksCorruptedText(next.name)
        ? source?.name ?? next.name
      : next.name;

  if (repairedName) {
    next.name = repairedName;
  }

  const category = resolveRecommendationCategory(next.category);
  const swingProfile = resolveSwingProfile(next.swingProfile);
  const previousDefaultKey = createRecommendationKey(previousName, next.symbol, category, swingProfile);
  if (looksCorruptedText(next.key) || (next.name !== previousName && next.key === previousDefaultKey)) {
    next.key = createRecommendationKey(
      next.name,
      next.symbol,
      category,
      swingProfile
    );
  }

  if (looksCorruptedText(next.note)) {
    next.note = source?.note;
  }

  if (!next.longTermInsightNote && typeof source?.longTermInsightNote === "string") {
    next.longTermInsightNote = source.longTermInsightNote;
  }

  if (
    (!Array.isArray(next.longTermInsightKeywords) || !next.longTermInsightKeywords.length) &&
    Array.isArray(source?.longTermInsightKeywords) &&
    source.longTermInsightKeywords.length
  ) {
    next.longTermInsightKeywords = [...source.longTermInsightKeywords];
  }

  return next;
}

function getFilteredInitialKey() {
  return getFilteredCatalog()[0]?.key ?? null;
}

function getFilteredCatalog() {
  const filtered = recommendationCatalog.filter((item) => {
    if ((item.category ?? DEFAULT_CATEGORY) !== currentCategory) {
      return false;
    }

    if (isSwingCategory(currentCategory)) {
      return (
        resolveSwingProfile(item.swingProfile) === currentSwingProfile &&
        (item.swingBucket ?? DEFAULT_SWING_BUCKET) === currentSwingBucket
      );
    }

    return (item.longTermBucket ?? DEFAULT_LONG_TERM_BUCKET) === currentLongTermBucket;
  });
  if (!isSwingCategory(currentCategory)) {
    return filtered;
  }

  return [...filtered].sort((left, right) => compareSwingItems(left, right));
}

function getPagedItems() {
  const filteredCatalog = getFilteredCatalog();
  if (itemsPerPage === PAGE_SIZE_ALL) {
    return filteredCatalog;
  }

  const start = (currentPage - 1) * itemsPerPage;
  return filteredCatalog.slice(start, start + itemsPerPage);
}

function getTotalPages() {
  return getTotalPagesForCount(getFilteredCatalog().length);
}

function getTotalPagesForCount(count) {
  if (itemsPerPage === PAGE_SIZE_ALL) {
    return 1;
  }

  return Math.max(1, Math.ceil(count / itemsPerPage));
}

function updatePaginationUi() {
  const totalPages = getTotalPages();
  currentPage = Math.min(currentPage, totalPages);
  pageStatus.textContent = `${currentPage} / ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
  prevPageBtn.style.opacity = prevPageBtn.disabled ? "0.5" : "1";
  nextPageBtn.style.opacity = nextPageBtn.disabled ? "0.5" : "1";
}

function removeStock(key) {
  const removedItem = recommendationCatalog.find((item) => item.key === key);
  recommendationCatalog = recommendationCatalog.filter((item) => item.key !== key);
  swingPatternByKey.delete(key);
  if (!recommendationCatalog.length) {
    recommendationCatalog = [];
    selectedKey = null;
    currentAnalysis = null;
    cleanupChart();
    saveCatalog();
    renderSelector();
    setStatus("idle", "대기 중");
    showSummary("");
    showError("");
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>등록된 종목이 없습니다. 종목을 추가해주세요.</p></div>`;
    return;
  }

  if (selectedKey === key) {
    selectedKey = getFilteredCatalog()[0]?.key ?? recommendationCatalog[0]?.key ?? null;
  }

  currentPage = Math.min(currentPage, getTotalPages());
  saveCatalog();
  renderLongTermBucketTabs();
  renderSwingBucketTabs();
  renderSelector();
  if (removedItem?.category === "swing") {
    void refreshSwingPatternSnapshots().then(() => {
      renderSwingBucketTabs();
      renderSelector();
    });
  }
  if (selectedKey) {
    runAnalysisByKey(selectedKey);
  }
}

function openStockModal() {
  stockForm.reset();
  if (stockModalTitle) {
    stockModalTitle.textContent = isSwingCategory(currentCategory)
      ? `${getSwingProfileLabel(currentSwingProfile)} 추천 추가`
      : isDividendCategory(currentCategory)
        ? "배당 종목 추가"
        : "중장기 추천 추가";
  }
  if (stockCategorySelect) {
    stockCategorySelect.value = currentCategory;
  }
  if (longTermBucketSelect) {
    longTermBucketSelect.value = currentLongTermBucket;
  }
  syncLongTermBucketField();
  stockSearchQuery = "";
  clearSelectedStockOption();
  if (stockSearchInput) {
    stockSearchInput.value = "";
  }
  if (!stockUniverseLoaded) {
    void loadStockUniverse();
  }
  renderStockSearchResults();
  showError("");
  stockModal.classList.remove("hidden");
  stockSearchInput.focus();
}

function closeStockModal() {
  stockModalPointerDownOnBackdrop = false;
  stockModal.classList.add("hidden");
}

function buildStockFromForm() {
  const name = stockNameInput.value.trim();
  const symbol = stockSymbolInput.value.trim();
  const anchorDate = stockDateInput.value;
  const category = resolveRecommendationCategory(stockCategorySelect?.value);
  const swingProfile = category === "swing" ? currentSwingProfile : undefined;
  const longTermBucket = category === "swing" ? undefined : isValidLongTermBucket(longTermBucketSelect?.value) ? longTermBucketSelect.value : DEFAULT_LONG_TERM_BUCKET;
  const swingBucket = category === "swing" ? currentSwingBucket : undefined;
  const recommendedPrice = Number(stockPriceInput.value);
  const extraNote = stockNoteInput.value.trim();
  const latestDividendDate = isDividendCategory(category) ? latestDividendDateInput?.value || undefined : undefined;
  const parsedDividendAmount = latestDividendAmountInput?.value ? Number(latestDividendAmountInput.value) : undefined;
  const latestDividendAmount =
    isDividendCategory(category) && parsedDividendAmount != null && Number.isFinite(parsedDividendAmount) && parsedDividendAmount >= 0
      ? parsedDividendAmount
      : undefined;

  if (!selectedStockOption || !name || !symbol || !anchorDate || !Number.isFinite(recommendedPrice) || recommendedPrice <= 0) {
    showError("먼저 검색 결과에서 종목을 선택하고 추천가와 기준일을 입력해주세요.");
    return null;
  }

  const key = createRecommendationKey(name, symbol, category, swingProfile);
  if (
    recommendationCatalog.some(
      (item) =>
        item.key === key ||
        (item.symbol === symbol &&
          (item.category ?? DEFAULT_CATEGORY) === category &&
          (!isSwingCategory(category) || resolveSwingProfile(item.swingProfile) === swingProfile))
    )
  ) {
    showError("같은 탭에는 동일한 종목을 중복 등록할 수 없습니다.");
    return null;
  }

  return {
    key,
    name,
    symbol,
    category,
    source: "manual",
    longTermBucket,
    swingBucket,
    swingProfile,
    latestDividendDate,
    latestDividendAmount,
    anchorDate,
    note: [formatNumber(recommendedPrice) + "원 기준", extraNote].filter(Boolean).join(" / ")
  };
}

function syncLongTermBucketField() {
  const category = resolveRecommendationCategory(stockCategorySelect?.value);
  const isNonSwing = !isSwingCategory(category);
  const isDividend = isDividendCategory(category);
  longTermBucketField?.classList.toggle("hidden", !isNonSwing);
  dividendInfoField?.classList.toggle("hidden", !isDividend);
  if (longTermBucketSelect) {
    longTermBucketSelect.disabled = !isNonSwing;
    if (isNonSwing && !isValidLongTermBucket(longTermBucketSelect.value)) {
      longTermBucketSelect.value = DEFAULT_LONG_TERM_BUCKET;
    }
  }

  if (reviewBucketLabel) {
    reviewBucketLabel.textContent = isDividendCategory(category) ? "배당 분류" : "중장기 분류";
  }

  const buyOption = longTermBucketSelect?.querySelector('option[value="buy"]');
  const watchOption = longTermBucketSelect?.querySelector('option[value="watch"]');
  if (buyOption) {
    buyOption.textContent = isDividendCategory(category) ? "배당후보군" : "매수후보군";
  }
  if (watchOption) {
    watchOption.textContent = "관찰군";
  }

  if (latestDividendDateInput) {
    latestDividendDateInput.disabled = !isDividend;
    if (!isDividend) {
      latestDividendDateInput.value = "";
    }
  }

  if (latestDividendAmountInput) {
    latestDividendAmountInput.disabled = !isDividend;
    if (!isDividend) {
      latestDividendAmountInput.value = "";
    }
  }
}

function getLongTermBucketCounts(category = DEFAULT_CATEGORY) {
  return recommendationCatalog
    .filter((item) => (item.category ?? DEFAULT_CATEGORY) === category)
    .reduce(
      (counts, item) => {
        const bucket = item.longTermBucket === "watch" ? "watch" : "buy";
        counts[bucket] += 1;
        return counts;
      },
      { buy: 0, watch: 0 }
    );
}

function getSwingProfileCounts() {
  return recommendationCatalog
    .filter((item) => (item.category ?? DEFAULT_CATEGORY) === "swing")
    .reduce(
      (counts, item) => {
        const profile = resolveSwingProfile(item.swingProfile);
        counts[profile] += 1;
        return counts;
      },
      { default: 0, smallcap: 0 }
    );
}

function getSwingBucketCounts() {
  return recommendationCatalog
    .filter(
      (item) =>
        (item.category ?? DEFAULT_CATEGORY) === "swing" && resolveSwingProfile(item.swingProfile) === currentSwingProfile
    )
    .reduce(
      (counts, item) => {
        const bucket = item.swingBucket === "watch" ? "watch" : "execution";
        counts[bucket] += 1;
        return counts;
      },
      { execution: 0, watch: 0 }
    );
}

function getCurrentFilterEmptyMessage() {
  if (isSwingCategory(currentCategory)) {
    return currentSwingBucket === "watch"
      ? `${getSwingProfileLabel(currentSwingProfile)} 관심후보 탭에는 아직 종목이 없습니다. 엔진 스캔 결과가 들어오면 여기에 표시됩니다.`
      : `${getSwingProfileLabel(currentSwingProfile)} 매수후보 탭에는 아직 종목이 없습니다. 엔진 스캔 결과가 들어오면 여기에 표시됩니다.`;
  }

  return `${getNonSwingBucketLabel(currentCategory, currentLongTermBucket)}에는 아직 등록된 종목이 없습니다. 종목 추가로 시작해보세요.`;
}

function renderEmptyResultsForCurrentFilter() {
  currentAnalysis = null;
  cleanupChart();
  showSummary("");
  showError("");
  results.classList.add("empty");
  results.innerHTML = `<div class="empty-state"><p>${getCurrentFilterEmptyMessage()}</p></div>`;
}

function createRecommendationKey(name, symbol, category = DEFAULT_CATEGORY, swingProfile = DEFAULT_SWING_PROFILE) {
  const baseKey = `${name}-${symbol}`;
  return scopeRecommendationKey(baseKey, resolveRecommendationCategory(category), resolveSwingProfile(swingProfile));
}

function getRecentKoreaBusinessDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - 1);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDividendEtfAnalysisItem(symbol) {
  const item = dividendEtfRecommendations.find((candidate) => candidate.symbol === symbol);
  if (!item) {
    return null;
  }

  const latestHistory = Array.isArray(item.dividendHistory) ? item.dividendHistory[0] : null;

  return {
    key: `dividend-etf-${item.symbol}`,
    name: item.name,
    symbol: item.symbol,
    anchorDate: getRecentKoreaBusinessDate(),
    category: DIVIDEND_CATEGORY,
    longTermBucket: "watch",
    note: buildDividendEtfDisplayNote(item),
    etfCategory: formatDividendEtfCategory(item.category),
    etfExpenseRatio: item.expenseRatio,
    etfDividendHistory: Array.isArray(item.dividendHistory) ? item.dividendHistory : [],
    latestDividendDate: latestHistory?.dividendDateLabel,
    latestDividendAmount: latestHistory?.dividendAmount
  };
}

async function runAnalysisForRecommendation(item) {
  setStatus("loading", "분석 중");
  showSummary("");
  showError("");
  results.classList.remove("empty");
  results.innerHTML = `<div class="empty-state"><p>${escapeHtml(item.name)}  데이터를 불러오는 중입니다...</p></div>`;

  try {
    const response = await fetch("/analysis/recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items: [item] })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "분석 요청에 실패했습니다.");
    }

    const analysis = payload.analyses?.[0];
    if (!analysis) {
      throw new Error("분석 결과가 없습니다.");
    }

    let swingPatternAnalysis = null;
    if (item.category === "swing") {
      try {
        const profile = resolveSwingProfile(item.swingProfile);
        const swingResponse = await fetch("/analysis/smart-money-patterns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            profile,
            items: [
              {
                name: item.name,
                symbol: item.symbol,
                note: item.note
              }
            ],
            filters: {
              lookbackTradingDays: SWING_LOOKBACK_DAYS
            }
          })
        });
        const swingPayload = await swingResponse.json();
        if (!swingResponse.ok) {
          throw new Error(swingPayload.error ?? "스윙 패턴 결과를 불러오지 못했습니다.");
        }

        swingPatternAnalysis = Array.isArray(swingPayload.analyses) ? swingPayload.analyses[0] ?? null : null;
        if (swingPatternAnalysis) {
          swingPatternByKey.set(item.key, swingPatternAnalysis);
        }
      } catch (error) {
        console.error(error);
      }
    }

    currentAnalysis = enrichAnalysis(analysis, item, swingPatternAnalysis);
    if (item.category !== "swing" && currentAnalysis.longTermReview) {
      const insightChanged = applyLongTermInsightToCatalog(
        item.key,
        currentAnalysis.longTermReview,
        item.category ?? DEFAULT_CATEGORY
      );
      if (insightChanged) {
        renderSelector();
      }
    }
    results.classList.remove("empty");
    results.innerHTML = renderCard(currentAnalysis);
    mountInteractiveChart(
      currentAnalysis.chartSets[currentAnalysis.activeTimeframe],
      currentAnalysis.tradingAnchorDate,
      currentAnalysis.swingTradeOverlay,
      { showEnvelope: currentAnalysis.category === "swing" }
    );
    void refreshCurrentAnalysisRealtime({ background: true });
    setStatus("done", "완료");
    if (item.category === "swing" && currentAnalysis.swingAssessment) {
      showSummary(
        `${item.name} 분석이 완료되었습니다. 최근 ${SWING_LOOKBACK_DAYS}거래일 기준 ${currentAnalysis.swingAssessment.label} 상태입니다.`
      );
    } else if (item.category !== "swing" && currentAnalysis.longTermReview) {
      showSummary(`${item.name} 분석이 완료되었습니다.`);
    } else {
      showSummary(`${item.name} 분석이 완료되었습니다. 확대/축소, 드래그 이동, 툴팁을 지원합니다.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    setStatus("error", "오류");
    showError(message);
    results.classList.add("empty");
    results.innerHTML = `<div class="empty-state"><p>오류를 해결한 뒤 다시 선택해주세요.</p></div>`;
  }
}

async function runAnalysisByKey(key) {
  const item = recommendationCatalog.find((candidate) => candidate.key === key);
  if (!item) {
    return;
  }

  await runAnalysisForRecommendation(item);
}

function enrichAnalysis(analysis, item, swingPatternAnalysis = null) {
  const daily = analysis.chartWindow.points;
  const swingPattern = swingPatternAnalysis?.pattern ?? null;
  const swingTradeOverlay =
    item.swingBucket === "watch"
      ? null
      : getSwingTradeOverlay(item.note, swingPattern);
  return {
    key: item.key,
    ...analysis,
    category: item.category ?? DEFAULT_CATEGORY,
    longTermReview: analysis.longTermReview ?? null,
    swingBucket: item.swingBucket,
    swingPatternAnalysis,
    swingAssessment: swingPattern ? getSwingAssessment(swingPattern) : null,
    swingTradeOverlay,
    chartSets: {
      daily: toChartPoints(daily),
      weekly: aggregateCandles(daily, "weekly"),
      monthly: aggregateCandles(daily, "monthly")
    },
    activeTimeframe: "daily"
  };
}

function averageDefinedNumbers(values) {
  const normalized = (Array.isArray(values) ? values : []).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!normalized.length) {
    return undefined;
  }

  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

function ratioNumber(value, base) {
  if (typeof value !== "number" || !Number.isFinite(value) || typeof base !== "number" || !Number.isFinite(base) || base === 0) {
    return undefined;
  }

  return value / base;
}

function formatRealtimeSyncLabel(value) {
  if (!value) {
    return "실시간 시세 동기화 대기";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "실시간 시세 갱신 완료";
  }

  return `실시간 갱신 ${date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })}`;
}

function applyRealtimeDetailToAnalysis(analysis, detail) {
  const dailyPoints = Array.isArray(detail?.chartWindow?.points) ? detail.chartWindow.points : [];
  const latestPoint = dailyPoints.at(-1);
  if (!latestPoint) {
    return analysis;
  }

  const latestClose = typeof detail.latestClose === "number" ? detail.latestClose : latestPoint.close;

  const afterAnchorPoints = dailyPoints.filter((point) => point.date >= analysis.tradingAnchorDate);
  const referencePoints = afterAnchorPoints.length ? afterAnchorPoints : [latestPoint];
  const highestPoint = referencePoints.reduce((best, point) => (point.close > best.close ? point : best), referencePoints[0]);
  const lowestPoint = referencePoints.reduce((best, point) => (point.close < best.close ? point : best), referencePoints[0]);
  const avgVolume20Latest = averageDefinedNumbers(dailyPoints.slice(-20).map((point) => point.volume));

  return {
    ...analysis,
    resolvedSymbol: detail.resolvedSymbol ?? analysis.resolvedSymbol,
    latestClose,
    latestDate: detail.latestDate ?? latestPoint.date,
    latestVolume: latestPoint.volume,
    latestVolumeVs20d: ratioNumber(latestPoint.volume, avgVolume20Latest),
    returnSinceAnchor: analysis.anchorClose ? ((latestClose - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.returnSinceAnchor,
    maxGainPercent: analysis.anchorClose ? ((highestPoint.close - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.maxGainPercent,
    maxDrawdownPercent: analysis.anchorClose ? ((lowestPoint.close - analysis.anchorClose) / analysis.anchorClose) * 100 : analysis.maxDrawdownPercent,
    highestClose: {
      date: highestPoint.date,
      close: highestPoint.close
    },
    lowestClose: {
      date: lowestPoint.date,
      close: lowestPoint.close
    },
    chartWindow: detail.chartWindow,
    chartSets: {
      daily: toChartPoints(dailyPoints),
      weekly: aggregateCandles(dailyPoints, "weekly"),
      monthly: aggregateCandles(dailyPoints, "monthly")
    }
  };
}

function syncLiveMetric(selector, text) {
  const node = results.querySelector(selector);
  if (node) {
    node.textContent = text;
  }
}

function updateCurrentAnalysisDom(analysis, fetchedAt) {
  const returnClass =
    analysis.returnSinceAnchor > 0 ? "positive" : analysis.returnSinceAnchor < 0 ? "negative" : "neutral";
  const activeRange = getChartSeriesRange(analysis.chartSets?.[analysis.activeTimeframe]);
  const returnPill = results.querySelector("[data-live-return-pill]");
  if (returnPill) {
    returnPill.className = `return-pill ${returnClass}`;
    returnPill.textContent = formatPercent(analysis.returnSinceAnchor);
  }

  syncLiveMetric("[data-live-current-price]", formatNumber(analysis.latestClose));
  syncLiveMetric("[data-live-max-gain]", formatPercent(analysis.maxGainPercent));
  syncLiveMetric("[data-live-max-drawdown]", formatPercent(analysis.maxDrawdownPercent));
  syncLiveMetric("[data-live-highest-close]", formatNumber(analysis.highestClose.close));
  syncLiveMetric("[data-live-lowest-close]", formatNumber(analysis.lowestClose.close));
  syncLiveMetric("[data-live-latest-volume-ratio]", formatMultiplier(analysis.latestVolumeVs20d));
  syncLiveMetric("[data-live-chart-start]", activeRange.startDate);
  syncLiveMetric("[data-live-chart-end]", activeRange.endDate);
  syncLiveMetric("[data-live-sync-line]", formatRealtimeSyncLabel(fetchedAt));

  const fundamentalsPriceReference = results.querySelector(".fundamentals-price-reference");
  if (fundamentalsPriceReference) {
    fundamentalsPriceReference.textContent = `가격 기준: ${formatNumber(analysis.latestClose)}원 (${analysis.latestDate} 종가)`;
  }
}

async function refreshCurrentAnalysisRealtime(options = {}) {
  if (activeAnalysisRealtimeLoading || activeView !== "analysis" || !currentAnalysis || !selectedKey) {
    return;
  }

  const item = recommendationCatalog.find((candidate) => candidate.key === selectedKey);
  if (!item) {
    return;
  }

  activeAnalysisRealtimeLoading = true;
  try {
    const response = await fetch("/analysis/realtime-stock-detail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: item.key,
        name: item.name,
        symbol: item.symbol,
        anchorDate: item.anchorDate,
        category: item.category ?? DEFAULT_CATEGORY
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "실시간 차트를 불러오지 못했습니다.");
    }

    currentAnalysis = applyRealtimeDetailToAnalysis(currentAnalysis, payload);
    if (!options.chartOnly) {
      updateCurrentAnalysisDom(currentAnalysis, payload.fetchedAt);
    }
    updateInteractiveChartData(
      currentAnalysis.chartSets[currentAnalysis.activeTimeframe],
      currentAnalysis.tradingAnchorDate,
      currentAnalysis.swingTradeOverlay,
      { showEnvelope: currentAnalysis.category === "swing" }
    );
  } catch (error) {
    console.error(error);
    if (!options.background) {
      showError(error instanceof Error ? error.message : "실시간 차트를 불러오지 못했습니다.");
    }
  } finally {
    activeAnalysisRealtimeLoading = false;
  }
}

function startActiveAnalysisAutoRefresh() {
  if (activeAnalysisRefreshTimer) {
    clearInterval(activeAnalysisRefreshTimer);
  }

  activeAnalysisRefreshTimer = window.setInterval(() => {
    void refreshCurrentAnalysisRealtime({ background: true, chartOnly: true });
  }, ACTIVE_ANALYSIS_REFRESH_INTERVAL_MS);
}

function toChartPoints(points) {
  let previousClose = null;
  return points.map((point) => {
    const chartPoint = normalizeChartPoint(point, previousClose);
    previousClose = chartPoint.close ?? previousClose;
    return chartPoint;
  });
}

function aggregateCandles(points, timeframe) {
  const buckets = new Map();
  let previousClose = null;

  for (const point of points) {
    const normalizedPoint = normalizeChartPoint(point, previousClose);
    previousClose = normalizedPoint.close ?? previousClose;

    const key = timeframe === "weekly" ? getWeekKey(point.date) : point.date.slice(0, 7);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        time: point.date,
        open: normalizedPoint.open,
        high: normalizedPoint.high,
        low: normalizedPoint.low,
        close: normalizedPoint.close,
        value: normalizedPoint.value
      });
      continue;
    }

    existing.high = Math.max(existing.high, normalizedPoint.high);
    existing.low = Math.min(existing.low, normalizedPoint.low);
    existing.close = normalizedPoint.close;
    existing.value += normalizedPoint.value;
  }

  return [...buckets.values()];
}

function getWeekKey(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isNonTradingPoint(point) {
  return (
    (point.open ?? 0) === 0 &&
    (point.high ?? 0) === 0 &&
    (point.low ?? 0) === 0 &&
    (point.volume ?? 0) === 0
  );
}

function normalizeChartPoint(point, previousClose) {
  const isHalted = isNonTradingPoint(point);
  const referenceClose = previousClose ?? point.close;
  const open = isHalted ? referenceClose : point.open ?? point.close;
  const high = isHalted ? referenceClose : point.high ?? point.close;
  const low = isHalted ? referenceClose : point.low ?? point.close;
  const close = point.close ?? referenceClose;

  return {
    time: point.date,
    open,
    high,
    low,
    close,
    value: point.volume ?? 0,
    isWhitespace: false,
    isHalted
  };
}

function showAppToast(input = {}) {
  if (!toastViewport) {
    return;
  }

  const payload =
    typeof input === "string"
      ? { message: input }
      : input && typeof input === "object"
        ? input
        : {};
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "알림";
  const message = typeof payload.message === "string" && payload.message.trim() ? payload.message.trim() : "";
  if (!message) {
    return;
  }

  const tone = payload.tone === "positive" || payload.tone === "negative" ? payload.tone : "neutral";
  const duration = Number.isFinite(payload.duration) ? Math.max(1800, Number(payload.duration)) : 4200;
  const speaker = typeof payload.speaker === "string" && payload.speaker.trim() ? payload.speaker.trim() : "스윙엔진";
  const moodLabel = tone === "positive" ? "좋아요" : tone === "negative" ? "주의해요" : "알려드려요";
  const toastId = `toast-${toastSequence += 1}`;
  const toast = document.createElement("article");
  toast.className = `app-toast ${tone}`;
  toast.dataset.toastId = toastId;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="app-toast-avatar" aria-hidden="true">
      <img src="/assets/stockmon-wave.webp" alt="" loading="lazy" decoding="async" />
    </div>
    <div class="app-toast-bubble">
      <div class="app-toast-head">
        <div class="app-toast-title-wrap">
          <span class="app-toast-speaker">${escapeHtml(speaker)}</span>
          <span class="app-toast-title">${escapeHtml(title)}</span>
        </div>
        <button class="app-toast-close" type="button" data-toast-dismiss aria-label="닫기">×</button>
      </div>
      <p class="app-toast-message">${escapeHtml(message)}</p>
      <div class="app-toast-tail-copy">${escapeHtml(moodLabel)}</div>
    </div>
  `;

  toastViewport.append(toast);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  const timerId = window.setTimeout(() => {
    dismissToast(toastId);
  }, duration);
  toastDismissTimers.set(toastId, timerId);
}

function dismissToast(toastId) {
  if (!toastId || !toastViewport) {
    return;
  }

  const timerId = toastDismissTimers.get(toastId);
  if (timerId) {
    window.clearTimeout(timerId);
    toastDismissTimers.delete(toastId);
  }

  const toast = toastViewport.querySelector(`[data-toast-id="${toastId}"]`);
  if (!toast || toast.classList.contains("is-leaving")) {
    return;
  }

  toast.classList.remove("is-visible");
  toast.classList.add("is-leaving");
  window.setTimeout(() => {
    toast.remove();
  }, 220);
}

function setStatus(kind, text) {
  statusBadge.className = `status-badge ${kind}`;
  statusBadge.textContent = text;
}

function showSummary(text) {
  if (!text) {
    summaryBar.classList.add("hidden");
    summaryBar.textContent = "";
    return;
  }
  summaryBar.classList.remove("hidden");
  summaryBar.textContent = text;
}

function showError(text) {
  if (!text) {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    return;
  }
  errorBox.classList.remove("hidden");
  errorBox.textContent = text;
}

function setMoversStatus(kind, text) {
  if (!moversStatusBadge) {
    return;
  }
  moversStatusBadge.className = `status-badge ${kind}`;
  moversStatusBadge.textContent = text;
}

function showMoversSummary(text) {
  if (!moversSummaryBar) {
    return;
  }
  if (!text) {
    moversSummaryBar.classList.add("hidden");
    moversSummaryBar.textContent = "";
    return;
  }
  moversSummaryBar.classList.remove("hidden");
  moversSummaryBar.textContent = text;
}

function showMoversError(text) {
  if (!moversErrorBox) {
    return;
  }
  if (!text) {
    moversErrorBox.classList.add("hidden");
    moversErrorBox.textContent = "";
    return;
  }
  moversErrorBox.classList.remove("hidden");
  moversErrorBox.textContent = text;
}

function formatLongTermGroupLabel(group) {
  return group === "buy candidate" ? "매수 가능 후보군" : "관찰 후보군";
}

function formatLongTermLabel(label) {
  switch (label) {
    case "leader correction watch":
      return "대표주 조정 관찰";
    case "deep value review":
      return "깊은 조정 재검토";
    case "base-forming candidate":
      return "베이스 형성 후보";
    case "contrarian accumulation candidate":
      return "역발상 매집 후보";
    case "needs more stabilization":
      return "안정화 더 필요";
    case "dividend_income_core":
      return "배당 코어";
    case "dividend_growth_candidate":
      return "배당 성장형";
    case "dividend_stable_payer":
      return "안정 배당";
    case "dividend_watch_payout_risk":
      return "배당성향 점검";
    case "dividend_watch_growth_slowing":
      return "배당 성장 둔화";
    case "dividend_watch_financial_repair":
      return "재무 보수 점검";
    case "dividend_trap_risk":
      return "배당 함정 주의";
    case "dividend_irregular_history":
      return "배당 이력 불규칙";
    default:
      return label ?? "-";
  }
}

const REVIEW_REASON_LABELS = {
  deep_correction: "깊은 조정",
  long_consolidation: "긴 박스권",
  constructive_higher_lows: "저점 높임 흐름",
  accumulation_support: "매집 수급 지지",
  trend_improving: "추세 개선",
  financial_stable: "재무 안정",
  leader_quality: "대표주 성격",
  v_shaped_correction: "V자 반등 후 검증 필요",
  base_too_short: "베이스 기간 짧음",
  higher_low_quality_weak: "저점 높임 품질 약함",
  trend_not_confirmed: "추세 확인 미완료",
  price_extended: "가격 이격 과열",
  financial_repair_needed: "재무 보수 필요",
  secondary_recovery_watch_only: "2차 반등 구간 관찰",
  deep_value_requires_more_confirmation: "깊은 조정 추가 확인 필요",
  leader_correction_still_early: "대표주 조정 초기 구간",
  label_deep_value_review: "깊은 조정 재검토 구간",
  label_needs_more_stabilization: "안정화 추가 필요",
  "contrarian accumulation candidate": "역발상 매집 후보",
  totalScore_low: "총점 기준 미달",
  trend_not_constructive: "추세 구조 미완성",
  price_outside_review_range: "검토 가격 범위 이탈",
  recent_low_break_fresh: "최근 저점 이탈 여파",
  higher_low_count_insufficient: "저점 높임 횟수 부족",
  higher_low_quality_low: "저점 높임 품질 낮음",
  base_duration_short: "베이스 기간 부족",
  stabilizationScore_low: "안정화 점수 부족",
  watch_needs_stabilization: "안정화 대기",
  watch_deep_value: "깊은 조정 관찰",
  watch_leader_correction: "대표주 조정 관찰",
  watch_trend_not_confirmed: "추세 확인 대기",
  watch_financial_repair: "재무 보수 관찰",
  watch_secondary_recovery: "2차 반등 관찰",
  long_dividend_history: "장기 배당 이력",
  dividend_stable: "배당 흐름 안정",
  dividend_growth_consistent: "배당 성장 지속",
  dividend_safe: "배당 안전성 양호",
  tradable_liquidity: "거래 유동성 양호",
  dividend_history_short: "배당 이력 짧음",
  recent_dividend_cut: "최근 배당 삭감",
  dividend_safety_weak: "배당 안전성 약함",
  payout_ratio_elevated: "배당성향 높음",
  dividend_growth_slowing: "배당 성장 둔화",
  financial_durability_weak: "재무 내구성 약함",
  price_structure_weak: "가격 지지 약함",
  price_support_broken: "가격 지지 이탈",
  dividend_data_limited: "배당 데이터 부족",
  dividend_trap_risk: "배당 함정 위험",
  dividend_irregular_history: "배당 이력 불규칙",
  dividend_watch_payout_risk: "배당성향 점검 필요",
  dividend_watch_growth_slowing: "배당 성장 둔화 관찰",
  dividend_watch_financial_repair: "재무 보수 관찰",
  high_yield_after_price_collapse: "급락 뒤 고배당",
  payout_ratio_dangerous: "배당성향 과도",
  payout_high_with_deteriorating_momentum: "배당성향 높고 실적 둔화",
  earnings_deteriorating: "이익 흐름 둔화",
  repeated_profit_weakness: "반복적 실적 부진",
  dividend_continuity_weak: "배당 연속성 약함",
  dividend_support_weak: "배당 뒷받침 약함",
  "ETF/ETN is out of scope for the dividend engine.": "ETF/ETN은 배당 엔진 대상이 아닙니다.",
  "Average turnover is below the dividend review floor.": "평균 거래대금이 배당 검토 기준에 못 미칩니다.",
  "ETF/ETN is out of scope for the long-term leader engine.": "ETF/ETN은 중장기 엔진 대상이 아닙니다.",
  "Price has not corrected enough from the prior high.": "이전 고점 대비 조정 폭이 부족합니다.",
  "Average turnover is below the long-term review floor.": "평균 거래대금이 중장기 검토 기준에 못 미칩니다.",
  "Long-term moving-average structure still looks broken.": "장기 이동평균 구조가 아직 무너져 있습니다.",
  "Representative status is too weak for the curated long-term framework.": "대표주 기준이 약해 중장기 프레임에 맞지 않습니다.",
  "persistent losses with worsening momentum": "적자 지속과 실적 악화",
  "dangerous debt structure": "부채 구조 위험",
  "business deterioration looks structural": "사업 훼손 우려"
};

function formatReviewReason(reason) {
  if (typeof reason !== "string") {
    return "-";
  }

  const trimmed = reason.trim();
  return REVIEW_REASON_LABELS[trimmed] ?? trimmed;
}

function renderReviewReasonChips(values) {
  return Array.isArray(values)
    ? values.map((value) => `<span class="swing-reason-chip">${escapeHtml(formatReviewReason(value))}</span>`).join("")
    : "";
}

function formatDividendReviewSummary(summary) {
  if (typeof summary !== "string" || !summary.trim()) {
    return "";
  }

  const parts = summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const labels = [];

  for (const part of parts) {
    const streakMatch = part.match(/^(\d+)y dividend streak$/i);
    if (streakMatch) {
      labels.push(`연속배당 ${Number(streakMatch[1])}년`);
      continue;
    }

    const yieldMatch = part.match(/^yield\s+(.+)$/i);
    if (yieldMatch && !/n\/a/i.test(yieldMatch[1])) {
      labels.push(`배당수익률 ${yieldMatch[1]}`);
      continue;
    }

    const payoutMatch = part.match(/^payout\s+(.+)$/i);
    if (payoutMatch && !/n\/a/i.test(payoutMatch[1])) {
      labels.push(`배당성향 ${payoutMatch[1]}`);
      continue;
    }

    const growthMatch = part.match(/^dps cagr\s+(.+)$/i);
    if (growthMatch && !/limited/i.test(growthMatch[1])) {
      labels.push(`배당성장률 ${growthMatch[1]}`);
      continue;
    }

    const watchMatch = part.match(/^watch:\s*(.+)$/i);
    if (watchMatch) {
      const reasons = watchMatch[1]
        .split(",")
        .map((value) => formatReviewReason(value))
        .filter(Boolean);
      labels.push(...reasons.slice(0, 2));
      continue;
    }

    if (/dividend profile intact/i.test(part)) {
      labels.push("배당 흐름 양호");
      continue;
    }

    if (/growth limited/i.test(part)) {
      labels.push("배당 성장 제한적");
      continue;
    }

    labels.push(formatReviewReason(part));
  }

  return labels.filter(Boolean).slice(0, 4).join(" / ");
}

function formatLongTermFundamentalTrend(trend) {
  switch (trend) {
    case "improving":
      return "개선";
    case "weakening":
      return "약화";
    case "cyclical_downturn":
      return "순환 둔화";
    default:
      return "-";
  }
}

function extractLongTermKeywords(note, bucket = DEFAULT_LONG_TERM_BUCKET) {
  if (typeof note !== "string" || !note.trim()) {
    return [];
  }

  const segments = note
    .split(/[|,/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const keywords = [];

  const pushKeyword = (label) => {
    if (!label || keywords.includes(label) || keywords.length >= 5) {
      return;
    }

    keywords.push(label);
  };

  for (const segment of segments) {
    const normalized = segment.toLowerCase();
    if (!normalized) {
      continue;
    }

    if (
      normalized.includes("중장기 관찰 후보군") ||
      normalized.includes("중장기 매수 가능 후보군") ||
      normalized.includes("watch candidate") ||
      normalized.includes("buy candidate")
    ) {
      continue;
    }

    if (normalized.includes("깊은 조정 재검토") || normalized.includes("deep value review")) {
      pushKeyword("깊은 조정");
      continue;
    }

    if (normalized.includes("베이스 형성 후보") || normalized.includes("base-forming candidate")) {
      pushKeyword("베이스 형성");
      continue;
    }

    if (normalized.includes("역발상 매집 후보") || normalized.includes("contrarian accumulation candidate")) {
      pushKeyword("역발상 매집");
      continue;
    }

    if (normalized.includes("대표주 조정 관찰") || normalized.includes("leader correction watch")) {
      pushKeyword("대표주 조정");
      continue;
    }

    if (normalized.includes("안정화 더 필요") || normalized.includes("needs more stabilization")) {
      pushKeyword("안정화 필요");
      continue;
    }

    const totalMatch = normalized.match(/(?:total|총점)\s*(\d+)/i);
    if (totalMatch) {
      pushKeyword(`총점 ${Number(totalMatch[1])}점`);
      continue;
    }

    const drawdownMatch = normalized.match(/(?:drawdown|낙폭)\s*(-?\d+(?:\.\d+)?)%/i);
    if (drawdownMatch) {
      pushKeyword(`낙폭 ${Math.round(Math.abs(Number(drawdownMatch[1])))}%`);
      continue;
    }

    const firstBuyMatch = segment.match(/(\d[\d,]*)원[^|]*1차\s*매수/i);
    if (firstBuyMatch) {
      pushKeyword(`1차매수 ${Number(firstBuyMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}원`);
      continue;
    }

    const splitBuyMatch = segment.match(/(\d[\d,]*)원[^|]*분할매수/i);
    if (splitBuyMatch) {
      pushKeyword(`분할매수 ${Number(splitBuyMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}원`);
      continue;
    }

    const belowPriceMatch = segment.match(/(\d[\d,]*)원\s*이하/i);
    if (belowPriceMatch) {
      pushKeyword(`기준가 ${Number(belowPriceMatch[1].replaceAll(",", "")).toLocaleString("ko-KR")}원`);
      if (normalized.includes("매수")) {
        pushKeyword("매수 구간");
      }
      continue;
    }

    if (normalized.includes("손절가 구간")) {
      pushKeyword("손절 구간");
      continue;
    }

    if (normalized.includes("다음날 시가 이하") || normalized.includes("시가 이하")) {
      pushKeyword("시가 이하");
      continue;
    }

    if (normalized.includes("중기 1차매수")) {
      pushKeyword("중기 1차매수");
      continue;
    }

    const belowHighMatch = normalized.match(/(?:고점 대비\s*|)(\d+(?:\.\d+)?)%\s+below/i);
    if (belowHighMatch) {
      pushKeyword(`고점 대비 ${Math.round(Number(belowHighMatch[1]))}%↓`);
      continue;
    }

    if (normalized.includes("profit trend improving") || normalized.includes("실적 개선")) {
      pushKeyword("실적 개선");
      continue;
    }

    if (normalized.includes("temporary loss still weak") || normalized.includes("적자 구간")) {
      pushKeyword("적자 구간");
      continue;
    }

    if (normalized.includes("cyclical downturn stabilizing") || normalized.includes("업황 안정화")) {
      pushKeyword("업황 안정화");
      continue;
    }

    if (normalized.includes("profitable and structurally intact") || normalized.includes("흑자 구조")) {
      pushKeyword("흑자 구조");
      continue;
    }

    if (normalized.includes("deteriorating_financial_momentum") || normalized.includes("실적 둔화")) {
      pushKeyword("실적 둔화");
      continue;
    }

    if (normalized.includes("ma120 turning upward") || normalized.includes("ma120 상향")) {
      pushKeyword("MA120 상향");
      continue;
    }

    if (normalized.includes("ma120 flattening") || normalized.includes("ma120 평탄")) {
      pushKeyword("MA120 평탄");
      continue;
    }

    if (normalized.includes("ma120 still falling") || normalized.includes("ma120 하락")) {
      pushKeyword("MA120 하락");
      continue;
    }

    if (normalized.includes("higher lows forming") || normalized.includes("바닥 안정화")) {
      pushKeyword("바닥 안정화");
      continue;
    }

    if (normalized.includes("base forming but still incomplete") || normalized.includes("바닥 형성 중")) {
      pushKeyword("바닥 형성 중");
      continue;
    }

    if (normalized.includes("base not formed yet") || normalized.includes("바닥 미완성")) {
      pushKeyword("바닥 미완성");
      continue;
    }

    if (normalized.includes("overextended above ma120") || normalized.includes("이격 과열")) {
      pushKeyword("이격 과열");
      continue;
    }

    if (normalized.includes("worsening_debt")) {
      pushKeyword("부채 부담");
      continue;
    }

    if (normalized.includes("unclear_business_model")) {
      pushKeyword("사업 가시성 약함");
      continue;
    }

    if (normalized.includes("삭제 전 목록")) {
      pushKeyword("삭제 전 목록");
      continue;
    }

    if (normalized.includes("돌파 여부") || normalized.includes("돌파 관찰")) {
      pushKeyword("돌파 관찰");
      continue;
    }

    if (normalized.includes("as 글") && normalized.includes("언급")) {
      pushKeyword("AS 재언급");
      continue;
    }

    if (normalized.includes("관찰")) {
      pushKeyword("관찰");
      continue;
    }
  }

  if (keywords.length) {
    return keywords;
  }

  const compact = note.trim().replace(/\s+/g, " ");
  const maxLength = bucket === "buy" ? 30 : 24;
  return [compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact];
}

function formatLongTermSummary(note, bucket = DEFAULT_LONG_TERM_BUCKET) {
  const keywords = extractLongTermKeywords(note, bucket).slice(0, 4);
  if (!keywords.length) {
    return "";
  }

  return keywords.join(" / ");
}

function buildLongTermInsightFromReview(review, category = DEFAULT_CATEGORY) {
  const candidate = review?.candidate;
  if (!candidate) {
    return null;
  }

  const bucket = candidate.candidateGroup === "watch candidate" ? "watch" : "buy";
  const keywords =
    category === DIVIDEND_CATEGORY
      ? [
          formatLongTermLabel(candidate.label),
          `총점 ${candidate.scores.totalScore}점`,
          candidate.dividendMetrics?.latestDividendYield != null
            ? `배당수익률 ${candidate.dividendMetrics.latestDividendYield.toFixed(1)}%`
            : null,
          candidate.dividendMetrics?.consecutiveDividendYears
            ? `연속배당 ${candidate.dividendMetrics.consecutiveDividendYears}년`
            : null,
          candidate.dividendMetrics?.payoutRatio != null ? `배당성향 ${Math.round(candidate.dividendMetrics.payoutRatio)}%` : null
        ].filter(Boolean)
      : [
          formatLongTermLabel(candidate.label),
          `총점 ${candidate.scores.totalScore}점`,
          candidate.drawdownPct != null ? `낙폭 ${Math.round(Math.abs(candidate.drawdownPct))}%` : null,
          candidate.baseStructure.isStabilizing
            ? "바닥 안정화"
            : candidate.baseStructure.higherLowCount >= 2
              ? "바닥 형성 중"
              : "바닥 미완성",
          candidate.financials?.financialMomentum === "deteriorating"
            ? "실적 둔화"
            : candidate.financials?.operatingProfitTrend === "improving" || candidate.financials?.netIncomeTrend === "improving"
              ? "실적 개선"
              : null
        ].filter(Boolean);

  return {
    bucket,
    note: keywords.join(" | "),
    keywords
  };
}

function applyLongTermInsightToCatalog(key, review, category = DEFAULT_CATEGORY) {
  const insight = buildLongTermInsightFromReview(review, category);
  if (!insight) {
    return false;
  }

  let changed = false;
  recommendationCatalog = recommendationCatalog.map((item) => {
    if (item.key !== key || (item.category ?? DEFAULT_CATEGORY) === "swing") {
      return item;
    }

    const next = {
      ...item,
      // Keep the current bucket stable during single-item analysis.
      // Universe scans or explicit edits should own bucket movement.
      longTermBucket: isValidLongTermBucket(item.longTermBucket) ? item.longTermBucket : insight.bucket,
      longTermInsightNote: insight.note,
      longTermInsightKeywords: insight.keywords
    };

    if (JSON.stringify(next) !== JSON.stringify(item)) {
      changed = true;
    }

    return next;
  });

  if (changed) {
    saveCatalog();
  }

  return changed;
}

function getLongTermReviewAssessment(review, category = DEFAULT_CATEGORY) {
  const candidate = review?.candidate;
  if (!candidate) {
    return {
      className: "broken",
      groupLabel: "관찰 제외",
      statusLabel: "엔진 대상 아님",
      action: getEngineReviewExclusionText(category),
      summary: formatReviewReason(review?.filterReasons?.[0] ?? getEngineReviewEmptyText(category))
    };
  }

  if (review.enginePass && candidate.candidateGroup === "buy candidate") {
    return {
      className: "ready",
      groupLabel: getEngineBucketLabel(category, candidate.candidateGroup),
      statusLabel: formatLongTermLabel(candidate.label),
      action: category === DIVIDEND_CATEGORY ? "배당 후보군 검토 가능" : "분할매수 검토 가능",
      summary:
        category === DIVIDEND_CATEGORY
          ? formatDividendReviewSummary(candidate.reasonSummary)
          : formatLongTermSummary(candidate.reasonSummary, "buy")
    };
  }

  return {
    className:
      candidate.label === "deep value review" ||
      candidate.label === "dividend_trap_risk" ||
      candidate.label === "dividend_watch_payout_risk"
        ? "caution"
        : "watch",
    groupLabel: getEngineBucketLabel(category, candidate.candidateGroup),
    statusLabel: formatLongTermLabel(candidate.label),
    action: review.enginePass ? "관찰 유지" : "엔진 조건 미충족",
    summary:
      category === DIVIDEND_CATEGORY
        ? formatDividendReviewSummary(candidate.reasonSummary)
        : formatLongTermSummary(candidate.reasonSummary, candidate.candidateGroup === "buy candidate" ? "buy" : "watch")
  };
}

function formatVolumeProfileRatio(value) {
  return Number.isFinite(value) ? `${formatDecimal(value, 2)}x` : "-";
}

function formatVolumeProfilePrice(value) {
  return Number.isFinite(value) ? formatNumber(value) : "-";
}

function formatVolumeProfilePercent(value) {
  return Number.isFinite(value) ? `${formatDecimal(value * 100, 1)}%` : "-";
}

function renderSwingVolumeProfilePanel(profile) {
  if (!profile?.baseTerm) {
    return "";
  }
  const advanced = profile.advancedVolumeProfile ?? profile.baseTerm.advancedVolumeProfile ?? {};

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>스윙 매물대 분석</h4>
          <div class="swing-pattern-copy">${escapeHtml(profile.summary ?? profile.baseTerm.comment ?? "")}</div>
        </div>
        <span class="stock-pattern-pill ${profile.score > 8 ? "complete" : profile.score < -8 ? "caution" : "watch"}">${formatSignedDecimal(profile.score)}점</span>
      </div>
      <div class="metric-grid swing-metric-grid">
        <div class="metric">
          <span class="metric-label">단기 위/아래 매물비</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfileRatio(profile.shortTerm?.supplyRatio))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">스윙 매물대 점수</span>
          <span class="metric-value">${formatSignedDecimal(profile.score)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">주요 단기 매물대</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePrice(profile.shortTerm?.nearestMajorVolumePrice))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">추격 위험</span>
          <span class="metric-value">${formatNumber(profile.chaseRiskBySupply)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">돌파 신뢰도</span>
          <span class="metric-value">${formatNumber(profile.breakoutReliabilityBySupply)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 지지 품질</span>
          <span class="metric-value">${formatNumber(profile.pullbackSupportQuality)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">다음 저항 여력</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePercent(advanced.upsideToResistance))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">손익비</span>
          <span class="metric-value">${escapeHtml(formatDecimal(advanced.rewardRiskRatio, 2))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">POC / VA</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePrice(advanced.pocPrice))} / ${escapeHtml(formatVolumeProfilePrice(advanced.valueAreaLow))}~${escapeHtml(formatVolumeProfilePrice(advanced.valueAreaHigh))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">리테스트</span>
          <span class="metric-value">${formatSignedDecimal(advanced.retestSuccessScore ?? 0, 0)} / ${formatSignedDecimal(advanced.retestFailureRisk ?? 0, 0)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Profile 신뢰도</span>
          <span class="metric-value">${formatNumber(advanced.profileReliability)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">동적 bin / ATR</span>
          <span class="metric-value">${escapeHtml(formatDecimal(advanced.dynamicBinSize, 2))} / ${escapeHtml(formatDecimal(advanced.atr14, 2))}</span>
        </div>
      </div>
      <div class="swing-pattern-copy">매물대 점수는 보조 지표이며 단독 매수 신호가 아닙니다.</div>
    </section>
  `;
}

function renderLongTermVolumeProfilePanel(profile) {
  if (!profile?.oneYear) {
    return "";
  }

  const representative = profile.threeYear?.lookbackDays >= 480 ? profile.threeYear : profile.twoYear?.lookbackDays >= 240 ? profile.twoYear : profile.oneYear;
  const advanced = profile.advancedVolumeProfile ?? representative?.advancedVolumeProfile ?? {};
  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>중장기 매물대 분석</h4>
        </div>
        <span class="stock-pattern-pill ${profile.score > 12 ? "complete" : profile.score < -10 ? "caution" : "watch"}">${formatSignedDecimal(profile.score)}점</span>
      </div>
      <div class="metric-grid swing-metric-grid">
        <div class="metric">
          <span class="metric-label">장기 위/아래 매물비</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfileRatio(representative?.supplyRatio))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">중장기 매물대 점수</span>
          <span class="metric-value">${formatSignedDecimal(profile.score)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">장기 주요 매물대</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePrice(representative?.nearestMajorVolumePrice))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">장기 박스권 돌파</span>
          <span class="metric-value">${formatSignedDecimal(profile.longBoxBreakoutScore)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">장기 위 매물 부담</span>
          <span class="metric-value">${formatSignedDecimal(profile.longOverheadSupplyRisk)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">보유 품질</span>
          <span class="metric-value">${formatSignedDecimal(profile.holdingQualityBySupply)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">구조 돌파 신뢰도</span>
          <span class="metric-value">${formatSignedDecimal(profile.structuralBreakoutReliability ?? 0, 0)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">POC / VA</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePrice(advanced.pocPrice))} / ${escapeHtml(formatVolumeProfilePrice(advanced.valueAreaLow))}~${escapeHtml(formatVolumeProfilePrice(advanced.valueAreaHigh))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">다음 저항 여력</span>
          <span class="metric-value">${escapeHtml(formatVolumeProfilePercent(advanced.upsideToResistance))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Profile 신뢰도</span>
          <span class="metric-value">${formatNumber(advanced.profileReliability)}점</span>
        </div>
        <div class="metric">
          <span class="metric-label">동적 bin / ATR</span>
          <span class="metric-value">${escapeHtml(formatDecimal(advanced.dynamicBinSize, 2))} / ${escapeHtml(formatDecimal(advanced.atr14, 2))}</span>
        </div>
      </div>
    </section>
  `;
}

function renderLongTermReviewPanel(review, category = DEFAULT_CATEGORY, item = null) {
  if (!review) {
    return "";
  }

  const assessment = getLongTermReviewAssessment(review, category);
  const candidate = review.candidate;
  const engineLabel = getEngineDisplayLabel(category);
  const candidateGroupLabel = candidate ? getEngineBucketLabel(category, candidate.candidateGroup) : "-";
  const dividendHistoryPanel = buildDividendHistoryPanel(item);
  const metricGrid = candidate
    ? category === DIVIDEND_CATEGORY
      ? `
            <div class="metric-grid swing-metric-grid">
              <div class="metric">
                <span class="metric-label">후보군</span>
                <span class="metric-value">${escapeHtml(candidateGroupLabel)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">${escapeHtml(engineLabel)} 라벨</span>
                <span class="metric-value">${escapeHtml(formatLongTermLabel(candidate.label))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">총점</span>
                <span class="metric-value">${candidate.scores.totalScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">배당수익률</span>
                <span class="metric-value">${escapeHtml(formatDividendYield(candidate.dividendMetrics?.latestDividendYield))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">연속 배당</span>
                <span class="metric-value">${formatNumber(candidate.dividendMetrics?.consecutiveDividendYears)}년</span>
              </div>
              <div class="metric">
                <span class="metric-label">배당성향</span>
                <span class="metric-value">${candidate.dividendMetrics?.payoutRatio != null ? `${formatDecimal(candidate.dividendMetrics.payoutRatio)}%` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">이익 커버리지</span>
                <span class="metric-value">${candidate.dividendMetrics?.earningsCoverageRatio != null ? `${formatDecimal(candidate.dividendMetrics.earningsCoverageRatio)}x` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">최근 배당 삭감</span>
                <span class="metric-value">${formatNumber(candidate.dividendMetrics?.recentDividendCutCount)}회</span>
              </div>
              <div class="metric">
                <span class="metric-label">배당 안정성</span>
                <span class="metric-value">${candidate.scores.dividendStabilityScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">배당 성장성</span>
                <span class="metric-value">${candidate.scores.dividendGrowthScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">배당 안전성</span>
                <span class="metric-value">${candidate.scores.dividendSafetyScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">재무 내구성</span>
                <span class="metric-value">${candidate.scores.financialDurabilityScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">유동성</span>
                <span class="metric-value">${candidate.scores.liquidityScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">가격 보조점수</span>
                <span class="metric-value">${candidate.scores.priceSupportScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">함정 위험</span>
                <span class="metric-value">${candidate.dividendMetrics?.trapRiskScore != null ? `${formatNumber(candidate.dividendMetrics.trapRiskScore)}점` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">매출 추세</span>
                <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.revenueTrend))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">영업이익 추세</span>
                <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.operatingProfitTrend))}</span>
              </div>
            </div>
        `
      : `
            <div class="metric-grid swing-metric-grid">
              <div class="metric">
                <span class="metric-label">후보군</span>
                <span class="metric-value">${escapeHtml(candidateGroupLabel)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">${escapeHtml(engineLabel)} 라벨</span>
                <span class="metric-value">${escapeHtml(formatLongTermLabel(candidate.label))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">총점</span>
                <span class="metric-value">${candidate.scores.totalScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">고점 대비</span>
                <span class="metric-value">${formatPercent(candidate.drawdownPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA120 기울기</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma120Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">MA240 기울기</span>
                <span class="metric-value">${formatSignedDecimal(candidate.structure.ma240Slope)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">최근 저점 경과</span>
                <span class="metric-value">${formatNumber(candidate.baseStructure.daysSinceLastLowBreak)}일</span>
              </div>
              <div class="metric">
                <span class="metric-label">저점 대비 거리</span>
                <span class="metric-value">${formatPercent(candidate.baseStructure.distanceFromLowPct)}</span>
              </div>
              <div class="metric">
                <span class="metric-label">베이스 기간</span>
                <span class="metric-value">${formatNumber(candidate.baseStructure.baseDurationDays)}일</span>
              </div>
              <div class="metric">
                <span class="metric-label">고점 경과</span>
                <span class="metric-value">${formatNumber(candidate.baseStructure.daysSincePeak)}일</span>
              </div>
              <div class="metric">
                <span class="metric-label">Higher-low 품질</span>
                <span class="metric-value">${candidate.baseStructure.higherLowQualityScore != null ? `${formatNumber(candidate.baseStructure.higherLowQualityScore)}점` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">축적 시그널</span>
                <span class="metric-value">${candidate.liquidity?.accumulationSignal != null ? `${formatNumber(candidate.liquidity.accumulationSignal)}점` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">대표성 점수</span>
                <span class="metric-value">${candidate.scores.leaderScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">조정 점수</span>
                <span class="metric-value">${candidate.scores.correctionScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">추세 점수</span>
                <span class="metric-value">${candidate.scores.trendScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">안정화 점수</span>
                <span class="metric-value">${candidate.scores.stabilizationScore}점</span>
              </div>
              <div class="metric">
                <span class="metric-label">재무 점수</span>
                <span class="metric-value">${candidate.scores?.financialScore ?? "-"}${candidate.scores?.financialScore != null ? "점" : ""}</span>
              </div>
              <div class="metric">
                <span class="metric-label">매물대 보조점수</span>
                <span class="metric-value">${candidate.scores?.volumeProfileScore != null ? `${formatSignedDecimal(candidate.scores.volumeProfileScore)}점` : "-"}</span>
              </div>
              <div class="metric">
                <span class="metric-label">매출 추세</span>
                <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.revenueTrend ?? candidate.fundamentals?.revenueTrend))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">영업이익 추세</span>
                <span class="metric-value">${escapeHtml(formatLongTermFundamentalTrend(candidate.financials?.operatingProfitTrend ?? candidate.fundamentals?.operatingProfitTrend))}</span>
              </div>
              <div class="metric">
                <span class="metric-label">ROE / 부채비율</span>
                <span class="metric-value">${(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe) != null ? `${formatSignedDecimal(candidate.financials?.latestRoe ?? candidate.fundamentals?.latestRoe)}%` : "-"} / ${(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio) != null ? `${formatDecimal(candidate.financials?.latestDebtRatio ?? candidate.fundamentals?.latestDebtRatio)}%` : "-"}</span>
              </div>
            </div>
        `
    : "";

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>${escapeHtml(getEnginePanelTitle(category))}</h4>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(assessment.className)}">${escapeHtml(assessment.groupLabel)}</span>
      </div>
      ${metricGrid}
      ${dividendHistoryPanel}
    </section>
  `;
}

function renderCard(item) {
  const returnClass =
    item.returnSinceAnchor > 0 ? "positive" : item.returnSinceAnchor < 0 ? "negative" : "neutral";
  const dividendInfoLine = buildDividendInfoLine(item);

  return `
    <article class="result-card">
      <div class="card-head">
        <div class="title-wrap">
          <h3>${escapeHtml(item.name || item.shortName || item.symbol)}</h3>
          <div class="meta-line">
            ${escapeHtml(item.symbol)} / 기준일 ${escapeHtml(item.anchorDate)} / 실제 거래일 ${escapeHtml(item.tradingAnchorDate)}
          </div>
          <div class="meta-line" data-live-sync-line>실시간 시세 동기화 대기</div>
          ${dividendInfoLine ? `<div class="meta-line">${escapeHtml(dividendInfoLine)}</div>` : ""}
          ${
            item.swingAssessment
              ? `<div class="meta-line">스윙 판정 ${escapeHtml(item.swingAssessment.label)} / ${escapeHtml(item.swingAssessment.action)}</div>`
              : ""
          }
        </div>
        <div class="return-pill ${returnClass}" data-live-return-pill>
          ${formatPercent(item.returnSinceAnchor)}
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">기준일 종가</span>
          <span class="metric-value">${formatNumber(item.anchorClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">현재 종가</span>
          <span class="metric-value" data-live-current-price>${formatNumber(item.latestClose)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 상승</span>
          <span class="metric-value" data-live-max-gain>${formatPercent(item.maxGainPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최대 하락</span>
          <span class="metric-value" data-live-max-drawdown>${formatPercent(item.maxDrawdownPercent)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최고 종가</span>
          <span class="metric-value" data-live-highest-close>${formatNumber(item.highestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최저 종가</span>
          <span class="metric-value" data-live-lowest-close>${formatNumber(item.lowestClose.close)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">기준일 거래량 배수</span>
          <span class="metric-value">${formatMultiplier(item.anchorVolumeVs20dBefore)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">최근 거래량 배수</span>
          <span class="metric-value" data-live-latest-volume-ratio>${formatMultiplier(item.latestVolumeVs20d)}</span>
        </div>
      </div>

      <div class="chart-wrap">
        <div class="chart-toolbar">
          ${timeframes
            .map(
              (timeframe) => `
                <button class="timeframe-tab ${timeframe === item.activeTimeframe ? "active" : ""}" type="button" data-timeframe="${timeframe}">
                  ${timeframeLabels[timeframe]}
                </button>
              `
            )
            .join("")}
        </div>
        <div class="chart-box interactive-chart-box">
          <div class="chart-hint">마우스 휠로 확대/축소, 드래그로 이동, 십자선 툴팁을 지원합니다.</div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-line ma5"></span>5일선</span>
            <span class="legend-item"><span class="legend-line ma20"></span>20일선</span>
            <span class="legend-item"><span class="legend-line ma60"></span>60일선</span>
            <span class="legend-item"><span class="legend-line ma120"></span>120일선</span>
            ${
              item.category === "swing"
                ? `
                  <span class="legend-item"><span class="legend-line envelope-upper"></span>엔벨로프 상단</span>
                  <span class="legend-item"><span class="legend-line envelope-lower"></span>엔벨로프 하단</span>
                `
                : ""
            }
          </div>
          <div id="chartStack" class="chart-stack">
            <div id="priceChartContainer" class="chart-canvas chart-canvas-price"></div>
            <div id="volumeChartContainer" class="chart-canvas chart-canvas-volume"></div>
          </div>
          <div id="chartTooltip" class="chart-tooltip hidden"></div>
          <div class="chart-caption">
            <span class="timeframe-caption">${timeframeLabels[item.activeTimeframe]}</span>
            <span data-live-chart-start>${escapeHtml(item.chartWindow.startDate)}</span>
            <span data-live-chart-end>${escapeHtml(item.chartWindow.endDate)}</span>
          </div>
        </div>
      </div>

      ${renderSwingPatternPanel(item.swingPatternAnalysis, item.swingAssessment)}
      ${item.category === "swing" ? renderSwingVolumeProfilePanel(item.swingPatternAnalysis?.pattern?.swingVolumeProfile) : ""}
      ${item.category !== "swing" ? renderLongTermReviewPanel(item.longTermReview, item.category ?? DEFAULT_CATEGORY, item) : ""}
      ${item.category !== "swing" ? renderLongTermVolumeProfilePanel(item.longTermReview?.candidate?.longTermVolumeProfile) : ""}

      <div class="fundamentals-wrap">
        ${renderFundamentals(item.fundamentals, {
          latestClose: item.latestClose,
          latestDate: item.latestDate,
          sectorLabel: getSectorLabel(item.symbol),
          stockName: item.name || item.shortName || item.symbol
        })}
      </div>
    </article>
  `;
}

function compareSwingItems(left, right) {
  const leftAssessment = getSwingAssessment(swingPatternByKey.get(left.key)?.pattern);
  const rightAssessment = getSwingAssessment(swingPatternByKey.get(right.key)?.pattern);
  const leftRank = leftAssessment?.rank ?? 0;
  const rightRank = rightAssessment?.rank ?? 0;
  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  const leftScore = leftAssessment?.sortScore ?? -1;
  const rightScore = rightAssessment?.sortScore ?? -1;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return right.anchorDate.localeCompare(left.anchorDate);
}

function resolveLegacySwingStatus(pattern) {
  if (!pattern) {
    return "none";
  }
  if (pattern.stage === "breakout" && pattern.matched && pattern.actionable) {
    return "breakout_confirmed";
  }
  if (
    pattern.stage === "breakout" &&
    pattern.matched &&
    typeof pattern.referenceCloseVsBreakoutLevelPercent === "number" &&
    pattern.referenceCloseVsBreakoutLevelPercent > 8
  ) {
    return "breakout_extended";
  }
  if (pattern.stage === "breakout" && pattern.matched) {
    return "breakout_ready";
  }
  if (pattern.stage === "setup" && pattern.matched && pattern.actionable) {
    return "buy_ready";
  }
  if (pattern.stage === "setup" && pattern.matched) {
    return "pullback_ready";
  }
  return pattern.stage === "setup" ? "pivot_formed" : "none";
}

function getSwingAssessment(pattern) {
  if (!pattern) {
    return null;
  }

  const status = pattern.status ?? resolveLegacySwingStatus(pattern);
  const rankScore = pattern.finalRankScore ?? pattern.regimeAdjustedScore ?? pattern.patternScore ?? 0;
  const statusMap = {
    none: {
      label: "관찰 전",
      className: "watch",
      rank: 0,
      description: "기준봉과 눌림 구조가 아직 분할매수 관점에서 충분히 잡히지 않았습니다.",
      action: "구조 확인이 먼저"
    },
    pivot_formed: {
      label: "기준봉 형성",
      className: "watch",
      rank: 2,
      description: "거래량과 가격이 붙는 기준봉은 보였지만, 아직 눌림이 충분히 진행되지는 않았습니다.",
      action: "눌림 확인 대기"
    },
    pullback_early: {
      label: "눌림 초기",
      className: "watch",
      rank: 3,
      description: "기준봉 이후 조정이 시작됐지만, 시간이나 가격 소화가 아직 더 필요합니다.",
      action: "성급한 진입 금지"
    },
    pullback_ready: {
      label: "눌림 완성",
      className: "setup",
      rank: 4,
      description: "거래량이 식으면서 눌림 구조가 어느 정도 정리됐고, 이제 기준 가격대를 다시 확인할 수 있는 구간입니다.",
      action: "분할매수 준비"
    },
    buy_ready: {
      label: "1차 매수 가능",
      className: "setup",
      rank: 6,
      description: "눌림이 충분히 진행됐고 현재 가격이 분할매수 구간 근처에서 버티는 상태입니다.",
      action: "1차 분할매수 가능"
    },
    breakout_extended: {
      label: "추격 금지",
      className: "caution",
      rank: 2,
      description: "돌파 구조 자체는 살아 있지만 가격이 너무 멀리 달아나 신규 진입은 불리한 상태입니다.",
      action: "눌림 재형성 대기"
    },
    breakout_ready: {
      label: "재돌파 대기",
      className: "ready",
      rank: 5,
      description: "구조는 살아 있지만 바로 추격하기보다 돌파선 안착이나 재확인을 기다리는 편이 좋습니다.",
      action: "재돌파 확인 대기"
    },
    breakout_confirmed: {
      label: "재돌파 확인",
      className: "complete",
      rank: 7,
      description: "눌림 뒤 재돌파가 확인된 상태입니다. 추격보다 보유·눌림 재확인을 함께 봐야 합니다.",
      action: "추격보다 재확인"
    },
    broken: {
      label: "이탈",
      className: "broken",
      rank: 1,
      description: "기준봉 저점이나 눌림 저점이 훼손돼 구조가 무너진 상태입니다.",
      action: "관찰 종료"
    }
  };
  const base = statusMap[status] ?? statusMap.none;
  return {
    ...base,
    status,
    sortScore: rankScore
  };
}

function getSwingStructureLabel(pattern) {
  if (!pattern) {
    return "-";
  }
  if (pattern.stage === "breakout") {
    return "재돌파 확인 단계";
  }
  if (pattern.setupType === "time_correction") {
    return "시간 조정형";
  }
  if (pattern.setupType === "volatile_power_digestion") {
    return "변동성 소화형";
  }
  if (pattern.stage === "setup") {
    return "가격 눌림형";
  }
  return "구조 관찰";
}

function formatSwingPriceBand(low, high) {
  if (typeof low !== "number" && typeof high !== "number") {
    return "-";
  }
  if (typeof low === "number" && typeof high === "number") {
    return `${formatNumber(Math.max(low, high))}원 ~ ${formatNumber(Math.min(low, high))}원`;
  }
  const single = typeof high === "number" ? high : low;
  return single == null ? "-" : `${formatNumber(single)}원`;
}

function parseSwingPlanSegment(note, label) {
  if (typeof note !== "string" || !note.trim()) {
    return null;
  }

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = note.match(new RegExp(`(?:^|\\|)\\s*${escapedLabel}\\s*([^|]+)`));
  return match?.[1]?.trim() ?? null;
}

function parsePriceNumbers(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const matches = [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)];
  return matches
    .filter((match) => isLikelyPriceMatch(text, match[0], match.index ?? 0))
    .map((match) => Number.parseFloat(match[0].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function isLikelyPriceMatch(text, rawValue, index) {
  const normalized = String(rawValue ?? "").replaceAll(",", "");
  if (!normalized) {
    return false;
  }

  const nextText = text.slice(index + String(rawValue).length, index + String(rawValue).length + 2);
  if (nextText.startsWith("원")) {
    return true;
  }

  const integerPart = normalized.split(".")[0] ?? normalized;
  return integerPart.length >= 4 || String(rawValue).includes(",");
}

function collectPriceMatches(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => ({
    value: Number.parseFloat(match[0].replaceAll(",", "")),
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    raw: match[0]
  })).filter((entry) => Number.isFinite(entry.value) && entry.value > 0 && isLikelyPriceMatch(text, entry.raw, entry.index));
}

function findPricesNearLabels(note, labels, options = {}) {
  if (typeof note !== "string" || !note.trim()) {
    return [];
  }

  const {
    searchBefore = true,
    searchAfter = true,
    maxGapBefore = 10,
    maxGapAfter = 10,
    collectAll = false
  } = options;
  const numberMatches = collectPriceMatches(note);
  if (!numberMatches.length) {
    return [];
  }

  const candidates = [];
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\|)\\s*(${escapedLabel})(?=\\s|[:：]|$)`, "g");
    for (const match of note.matchAll(regex)) {
      const prefix = match[0] ?? "";
      const captured = match[1] ?? label;
      const labelIndex = (match.index ?? 0) + prefix.lastIndexOf(captured);
      const labelEnd = labelIndex + captured.length;
      const nearby = [];

      if (searchBefore) {
        const beforeMatches = numberMatches
          .filter((entry) => entry.end <= labelIndex && labelIndex - entry.end <= maxGapBefore)
          .sort((left, right) => right.end - left.end);
        nearby.push(...beforeMatches);
      }

      if (searchAfter) {
        const afterMatches = numberMatches
          .filter((entry) => entry.index >= labelEnd && entry.index - labelEnd <= maxGapAfter)
          .sort((left, right) => left.index - right.index);
        nearby.push(...afterMatches);
      }

      if (!nearby.length) {
        continue;
      }

      if (collectAll) {
        candidates.push(...nearby.map((entry) => entry.value));
      } else {
        candidates.push(nearby[0].value);
      }
    }
  }

  return [...new Set(candidates)];
}

function parseSwingPlanNumbersFromNote(note) {
  const buySegment =
    parseSwingPlanSegment(note, "매수가") ??
    parseSwingPlanSegment(note, "매수") ??
    parseSwingPlanSegment(note, "구간");
  const stopSegment =
    parseSwingPlanSegment(note, "손절가") ??
    parseSwingPlanSegment(note, "손절");
  const buyPricesFromSegment = parsePriceNumbers(buySegment);
  const stopPricesFromSegment = parsePriceNumbers(stopSegment);
  const buyPricesFromNearby =
    buyPricesFromSegment.length
      ? []
      : findPricesNearLabels(note, ["매수가", "매수"], {
          searchBefore: true,
          searchAfter: true,
          maxGapBefore: 12,
          maxGapAfter: 18,
          collectAll: true
        });
  const stopPricesFromNearby =
    stopPricesFromSegment.length
      ? []
      : findPricesNearLabels(note, ["손절가", "손절"], {
          searchBefore: true,
          searchAfter: true,
          maxGapBefore: 4,
          maxGapAfter: 12,
          collectAll: false
        });

  return {
    buyPrices: [...new Set([...buyPricesFromSegment, ...buyPricesFromNearby])],
    stopPrice: [...stopPricesFromSegment, ...stopPricesFromNearby][0]
  };
}

function deriveThreeStepSwingBuyPrices(buyPrices, stopPrice) {
  const normalizedStopPrice = Number.isFinite(stopPrice) && stopPrice > 0 ? Math.round(stopPrice * 100) / 100 : undefined;
  const normalizedBuyPrices = [...new Set(
    (Array.isArray(buyPrices) ? buyPrices : [])
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value * 100) / 100)
  )].sort((left, right) => right - left);

  if (normalizedBuyPrices.length >= 3 || normalizedStopPrice == null) {
    return normalizedBuyPrices;
  }

  const firstBuyPrice = normalizedBuyPrices[0];
  if (!Number.isFinite(firstBuyPrice) || firstBuyPrice <= normalizedStopPrice) {
    return normalizedBuyPrices;
  }

  const riskBand = firstBuyPrice - normalizedStopPrice;
  return [
    firstBuyPrice,
    normalizedStopPrice + riskBand * 0.67,
    normalizedStopPrice + riskBand * 0.33
  ].map((value) => Math.round(value * 100) / 100);
}

function sanitizeSwingTradeLevels(buyPrices, stopPrice) {
  const normalizedStopPrice =
    Number.isFinite(stopPrice) && stopPrice > 0
      ? Math.round(stopPrice * 100) / 100
      : undefined;
  const stagedBuyPrices = deriveThreeStepSwingBuyPrices(buyPrices, normalizedStopPrice);
  const normalizedBuyPrices = [...new Set(
    stagedBuyPrices
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value * 100) / 100)
  )]
    .filter((value) => normalizedStopPrice == null || value > normalizedStopPrice)
    .sort((left, right) => right - left);

  return {
    buyPrices: normalizedBuyPrices,
    stopPrice: normalizedStopPrice
  };
}

function getSwingTradeOverlay(note, pattern) {
  const notePlan = parseSwingPlanNumbersFromNote(note);
  const patternBuyPrices =
    pattern?.buyPlan
      ? [pattern.buyPlan.firstBuyPrice, pattern.buyPlan.secondBuyPrice, pattern.buyPlan.thirdBuyPrice]
      : pattern && (typeof pattern.entryZoneLow === "number" || typeof pattern.entryZoneHigh === "number")
        ? [pattern.entryZoneHigh, pattern.entryZoneLow]
        : [];
  const buyPrices = notePlan.buyPrices.length ? notePlan.buyPrices : patternBuyPrices;
  const stopPriceRaw = notePlan.stopPrice;
  const stopPriceFromNote =
    Number.isFinite(stopPriceRaw) && stopPriceRaw > 0
      ? Math.round(stopPriceRaw * 100) / 100
      : undefined;
  const stopPriceFromPattern =
    pattern && typeof pattern.buyPlan?.stopLossPrice === "number" && pattern.buyPlan.stopLossPrice > 0
      ? Math.round(pattern.buyPlan.stopLossPrice * 100) / 100
      : pattern && typeof pattern.invalidationPrice === "number" && pattern.invalidationPrice > 0
        ? Math.round(pattern.invalidationPrice * 100) / 100
        : undefined;
  const sanitized = sanitizeSwingTradeLevels(buyPrices, stopPriceFromNote ?? stopPriceFromPattern);

  return {
    buyPrices: sanitized.buyPrices,
    stopPrice: sanitized.stopPrice
  };
}

function getSwingCardTradePlan(note, pattern, swingBucket = DEFAULT_SWING_BUCKET) {
  const overlay = getSwingTradeOverlay(note, pattern);
  const buyPlan = pattern?.buyPlan;
  const isExecutionBucket = swingBucket !== "watch";
  const buyLevelsFromPlan = buyPlan
    ? [buyPlan.firstBuyPrice, buyPlan.secondBuyPrice, buyPlan.thirdBuyPrice]
      .filter((price) => Number.isFinite(price) && price > 0)
      .map(formatSwingCardBuyBadge)
    : [];
  const buyLevelsFromOverlay = buyPlan || isExecutionBucket
    ? overlay.buyPrices.map(formatSwingCardBuyBadge)
    : [];
  const buyFromNote = parseSwingPlanSegment(note, "매수가") ?? parseSwingPlanSegment(note, "매수");
  const buyLevelsFromNote =
    !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && buyFromNote
      ? splitSwingTradeSegments(buyFromNote).map((segment, index) => formatSwingBuyLevel(segment, index))
      : [];
  const buySummaryFromPattern =
    !buyLevelsFromOverlay.length && !buyLevelsFromPlan.length && pattern
      ? `진입 구간 ${formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh)}`
      : null;
  const stopFromPattern =
    typeof overlay.stopPrice === "number" && overlay.stopPrice > 0
      ? `${formatNumber(overlay.stopPrice)}원`
      : null;
  const stopFromNote = parseSwingPlanSegment(note, "손절가") ?? parseSwingPlanSegment(note, "손절");
  const buyLevels = buyLevelsFromOverlay.length ? buyLevelsFromOverlay : buyLevelsFromPlan.length ? buyLevelsFromPlan : buyLevelsFromNote;

  return {
    buyLevels,
    buySummary: buySummaryFromPattern ?? (buyLevels.length ? "-" : buyFromNote ?? "-"),
    stop: stopFromPattern ?? stopFromNote ?? "-"
  };
}

function formatSwingCardBuyBadge(price, index) {
  return `${index + 1}차 ${formatNumber(price)}`;
}

function splitSwingTradeSegments(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  return text
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function formatSwingBuyLevel(segment, index) {
  const trimmed = String(segment ?? "").trim();
  if (!trimmed) {
    return "";
  }

  if (/[1-9]차/.test(trimmed) || /^진입\s*구간/.test(trimmed)) {
    return trimmed;
  }

  return `${index + 1}차 ${trimmed}`;
}

function renderSwingPatternPanel(swingPatternAnalysis, swingAssessment) {
  if (!swingPatternAnalysis || !swingPatternAnalysis.pattern || !swingAssessment) {
    return "";
  }

  const pattern = swingPatternAnalysis.pattern;
  const scoreReasons = encodeURIComponent(JSON.stringify(pattern.reasons?.length ? pattern.reasons : [pattern.summary]));
  const scoreDescription = encodeURIComponent(swingAssessment.description);
  const scoreSummary = encodeURIComponent(pattern.summary ?? "");
  const scoreGuide = encodeURIComponent(swingScoreGuideText);
  const scoreAction = encodeURIComponent(swingAssessment.action);
  const scoreEntry = encodeURIComponent(formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh));
  const scoreInvalidation = encodeURIComponent(
    typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}원` : "-"
  );
  const priceLocation =
    pattern.referenceCloseVsBreakoutLevelPercent == null
      ? "-"
      : `돌파선 ${pattern.referenceCloseVsBreakoutLevelPercent.toFixed(1)}% / 피크 ${
          pattern.referenceCloseVsPeakPercent == null ? "-" : `${pattern.referenceCloseVsPeakPercent.toFixed(1)}%`
        }`;

  return `
    <section class="swing-pattern-panel">
      <div class="swing-pattern-head">
        <div>
          <h4>스윙 패턴 판정</h4>
        </div>
        <span class="stock-pattern-pill ${escapeHtml(swingAssessment.className)}">${escapeHtml(swingAssessment.label)}</span>
      </div>

      <div class="metric-grid swing-metric-grid">
        <button
          class="metric metric-button"
          type="button"
          data-score-explain-toggle="modal"
          data-score-label="${escapeHtml(swingAssessment.label)}"
          data-score-description="${escapeHtml(scoreDescription)}"
          data-score-summary="${escapeHtml(scoreSummary)}"
          data-score-guide="${escapeHtml(scoreGuide)}"
          data-score-action="${escapeHtml(scoreAction)}"
          data-score-entry="${escapeHtml(scoreEntry)}"
          data-score-invalidation="${escapeHtml(scoreInvalidation)}"
          data-score-reasons="${escapeHtml(scoreReasons)}"
        >
          <span class="metric-label">상태 설명</span>
          <span class="metric-value">${escapeHtml(swingAssessment.label)}</span>
          <span class="metric-hint">눌러서 전략 보기</span>
        </button>
        <div class="metric">
          <span class="metric-label">기준 윈도우</span>
          <span class="metric-value">${SWING_LOOKBACK_DAYS}거래일</span>
        </div>
        <div class="metric">
          <span class="metric-label">내부 구조</span>
          <span class="metric-value">${escapeHtml(getSwingStructureLabel(pattern))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">진입 구간</span>
          <span class="metric-value">${escapeHtml(formatSwingPriceBand(pattern.entryZoneLow, pattern.entryZoneHigh))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">이탈 기준</span>
          <span class="metric-value">${typeof pattern.invalidationPrice === "number" ? `${formatNumber(pattern.invalidationPrice)}원` : "-"}</span>
        </div>
        <div class="metric">
          <span class="metric-label">선행 수급일</span>
          <span class="metric-value">${escapeHtml(pattern.leadInDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">급등 피크일</span>
          <span class="metric-value">${escapeHtml(pattern.surgePeakDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">급등 유지</span>
          <span class="metric-value">${
            pattern.surgeContinuationSessions == null
              ? "-"
              : `${escapeHtml(String(pattern.surgeContinuationSessions + 1))}거래일`
          }</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 구간</span>
          <span class="metric-value">${escapeHtml(pattern.pullbackStartDate ?? "-")} ~ ${escapeHtml(pattern.pullbackEndDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">눌림 범위</span>
          <span class="metric-value">${pattern.pullbackRangePercent == null ? "-" : `${escapeHtml(pattern.pullbackRangePercent.toFixed(1))}%`}</span>
        </div>
        <div class="metric">
          <span class="metric-label">돌파일</span>
          <span class="metric-value">${escapeHtml(pattern.breakoutDate ?? "-")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">현재 가격 위치</span>
          <span class="metric-value">${escapeHtml(priceLocation)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">${pattern.stage === "breakout" ? "돌파 후 경과" : "피크 후 경과"}</span>
          <span class="metric-value">${
            pattern.stage === "breakout"
              ? pattern.sessionsSinceBreakout == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSinceBreakout))}거래일`
              : pattern.sessionsSincePeak == null
                ? "-"
                : `${escapeHtml(String(pattern.sessionsSincePeak))}거래일`
          }</span>
        </div>
      </div>
    </section>
  `;
}

function cleanupChart() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (activeChart) {
    clearInteractivePriceLines(activeChart);
    if (activeChart.wheelTarget && activeChart.wheelHandler) {
      activeChart.wheelTarget.removeEventListener("wheel", activeChart.wheelHandler);
    }
    activeChart.priceChart.remove();
    activeChart.volumeChart.remove();
    activeChart = null;
  }
}

function buildInteractiveCandleSeriesData(points) {
  return points.map((point) =>
    point.isWhitespace
      ? {
          time: point.time
        }
      : {
          time: point.time,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close
        }
  );
}

function buildInteractiveVolumeSeriesData(points) {
  return points.map((point) =>
    point.isWhitespace
      ? {
          time: point.time
        }
      : {
          time: point.time,
          value: point.value,
          color: point.isHalted
            ? "rgba(120, 128, 140, 0.22)"
            : point.close >= point.open
              ? "rgba(216,76,63,0.35)"
              : "rgba(47,110,229,0.32)"
        }
  );
}

function buildInteractiveChartSignature(points, anchorDate, swingTradeOverlay = null, showEnvelope = false) {
  return JSON.stringify({
    anchorDate,
    showEnvelope,
    buyPrices: swingTradeOverlay?.buyPrices ?? [],
    stopPrice: swingTradeOverlay?.stopPrice ?? null,
    points: points.map((point) => [
      point.time,
      point.open,
      point.high,
      point.low,
      point.close,
      point.value,
      Boolean(point.isWhitespace),
      Boolean(point.isHalted)
    ])
  });
}

function buildInteractiveOverlaySignature(anchorDate, swingTradeOverlay = null, showEnvelope = false) {
  return JSON.stringify({
    anchorDate,
    showEnvelope,
    buyPrices: swingTradeOverlay?.buyPrices ?? [],
    stopPrice: swingTradeOverlay?.stopPrice ?? null
  });
}

function areInteractiveChartPointsEqual(left, right) {
  return (
    left?.time === right?.time &&
    left?.open === right?.open &&
    left?.high === right?.high &&
    left?.low === right?.low &&
    left?.close === right?.close &&
    left?.value === right?.value &&
    Boolean(left?.isWhitespace) === Boolean(right?.isWhitespace) &&
    Boolean(left?.isHalted) === Boolean(right?.isHalted)
  );
}

function canPatchLatestInteractivePoint(previousPoints, nextPoints) {
  if (!Array.isArray(previousPoints) || !Array.isArray(nextPoints) || previousPoints.length !== nextPoints.length || nextPoints.length === 0) {
    return false;
  }

  for (let index = 0; index < nextPoints.length - 1; index += 1) {
    if (!areInteractiveChartPointsEqual(previousPoints[index], nextPoints[index])) {
      return false;
    }
  }

  return previousPoints.at(-1)?.time === nextPoints.at(-1)?.time;
}

function updateLatestSeriesPoint(series, previousData, nextData) {
  const nextPoint = nextData.at(-1);
  if (!nextPoint) {
    series.setData(nextData);
    return;
  }

  if (previousData.length === nextData.length && previousData.at(-1)?.time === nextPoint.time) {
    series.update(nextPoint);
    return;
  }

  series.setData(nextData);
}

function clearInteractivePriceLines(chartEntry) {
  if (!chartEntry?.priceLines?.length) {
    chartEntry.priceLines = [];
    return;
  }

  for (const priceLine of chartEntry.priceLines) {
    chartEntry.candleSeries.removePriceLine(priceLine);
  }
  chartEntry.priceLines = [];
}

function resolveInteractiveAnchorPoint(points, anchorDate) {
  if (!Array.isArray(points) || !points.length) {
    return undefined;
  }

  const visiblePoints = points.filter((point) => !point.isWhitespace);
  if (!visiblePoints.length) {
    return undefined;
  }

  return (
    visiblePoints.find((point) => point.time === anchorDate) ??
    [...visiblePoints].reverse().find((point) => point.time <= anchorDate) ??
    visiblePoints[0]
  );
}

function applyInteractivePriceLines(chartEntry, points, anchorDate, swingTradeOverlay = null) {
  clearInteractivePriceLines(chartEntry);

  const buyPrices = Array.isArray(swingTradeOverlay?.buyPrices)
    ? swingTradeOverlay.buyPrices.filter((price) => Number.isFinite(price) && price > 0)
    : [];
  const hasTradeOverlay = buyPrices.length > 0 || (typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0);
  const anchorPoint = resolveInteractiveAnchorPoint(points, anchorDate);

  if (!chartEntry.showEnvelope && !hasTradeOverlay && anchorPoint?.close != null) {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price: anchorPoint.close,
        color: "rgba(159,62,25,0.85)",
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        title: `기준일 ${anchorDate}`
      })
    );
  }

  buyPrices.forEach((price, index) => {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price,
        color: "rgba(202, 138, 4, 0.95)",
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: buyPrices.length > 1 ? `${index + 1}차 매수` : "매수가"
      })
    );
  });

  if (typeof swingTradeOverlay?.stopPrice === "number" && swingTradeOverlay.stopPrice > 0) {
    chartEntry.priceLines.push(
      chartEntry.candleSeries.createPriceLine({
        price: swingTradeOverlay.stopPrice,
        color: "rgba(185, 28, 28, 0.95)",
        lineStyle: LineStyle.Dotted,
        lineWidth: 2,
        axisLabelVisible: true,
        title: "손절가"
      })
    );
  }
}

function getInteractiveTimeScaleOptions(isSwingChart) {
  return {
    borderColor: "rgba(31,26,20,0.12)",
    borderVisible: !isSwingChart,
    visible: !isSwingChart,
    timeVisible: true,
    secondsVisible: false,
    rightOffset: CHART_RIGHT_ANCHOR_OFFSET,
    rightBarStaysOnScroll: true,
    ticksVisible: !isSwingChart,
    tickMarkFormatter: isSwingChart ? () => "" : undefined
  };
}

function updateInteractiveChartData(points, anchorDate, swingTradeOverlay = null, options = {}) {
  if (!activeChart) {
    mountInteractiveChart(points, anchorDate, swingTradeOverlay, options);
    return;
  }

  const showEnvelope = Boolean(options.showEnvelope ?? activeChart.showEnvelope);
  const dataSignature = buildInteractiveChartSignature(points, anchorDate, swingTradeOverlay, showEnvelope);
  const overlaySignature = buildInteractiveOverlaySignature(anchorDate, swingTradeOverlay, showEnvelope);
  const previousPoints = activeChart.chartState.points;
  if (activeChart.showEnvelope !== showEnvelope) {
    const timeScaleOptions = getInteractiveTimeScaleOptions(showEnvelope);
    activeChart.priceChart.applyOptions({ timeScale: timeScaleOptions });
    activeChart.volumeChart.applyOptions({ timeScale: timeScaleOptions });
  }
  activeChart.chartState.points = points;
  activeChart.anchorDate = anchorDate;
  activeChart.swingTradeOverlay = swingTradeOverlay;
  activeChart.showEnvelope = showEnvelope;

  if (!options.resetVisibleRange && activeChart.dataSignature === dataSignature) {
    return;
  }

  if (
    !options.resetVisibleRange &&
    activeChart.overlaySignature === overlaySignature &&
    canPatchLatestInteractivePoint(previousPoints, points)
  ) {
    updateLatestSeriesPoint(
      activeChart.candleSeries,
      buildInteractiveCandleSeriesData(previousPoints),
      buildInteractiveCandleSeriesData(points)
    );
    updateLatestSeriesPoint(
      activeChart.volumeSeries,
      buildInteractiveVolumeSeriesData(previousPoints),
      buildInteractiveVolumeSeriesData(points)
    );
    updateLatestSeriesPoint(activeChart.ma5Series, buildMovingAverage(previousPoints, 5), buildMovingAverage(points, 5));
    updateLatestSeriesPoint(activeChart.ma20Series, buildMovingAverage(previousPoints, 20), buildMovingAverage(points, 20));
    updateLatestSeriesPoint(activeChart.ma60Series, buildMovingAverage(previousPoints, 60), buildMovingAverage(points, 60));
    updateLatestSeriesPoint(activeChart.ma120Series, buildMovingAverage(previousPoints, 120), buildMovingAverage(points, 120));
    const previousEnvelopeBands = showEnvelope ? buildEnvelopeBands(previousPoints) : null;
    const envelopeBands = showEnvelope ? buildEnvelopeBands(points) : null;
    updateLatestSeriesPoint(activeChart.envelopeUpperSeries, previousEnvelopeBands?.upper ?? [], envelopeBands?.upper ?? []);
    updateLatestSeriesPoint(activeChart.envelopeLowerSeries, previousEnvelopeBands?.lower ?? [], envelopeBands?.lower ?? []);
    activeChart.dataSignature = dataSignature;
    return;
  }

  activeChart.candleSeries.setData(buildInteractiveCandleSeriesData(points));
  activeChart.volumeSeries.setData(buildInteractiveVolumeSeriesData(points));
  activeChart.ma5Series.setData(buildMovingAverage(points, 5));
  activeChart.ma20Series.setData(buildMovingAverage(points, 20));
  activeChart.ma60Series.setData(buildMovingAverage(points, 60));
  activeChart.ma120Series?.setData(buildMovingAverage(points, 120));
  const envelopeBands = showEnvelope ? buildEnvelopeBands(points) : null;
  activeChart.envelopeUpperSeries.setData(envelopeBands?.upper ?? []);
  activeChart.envelopeLowerSeries.setData(envelopeBands?.lower ?? []);
  applyInteractivePriceLines(activeChart, points, anchorDate, swingTradeOverlay);

  if (options.resetVisibleRange) {
    setDefaultVisibleTradingRange(activeChart.priceChart, points);
  }
  activeChart.dataSignature = dataSignature;
  activeChart.overlaySignature = overlaySignature;
}

function mountInteractiveChart(points, anchorDate, swingTradeOverlay = null, options = {}) {
  const priceContainer = document.querySelector("#priceChartContainer");
  const volumeContainer = document.querySelector("#volumeChartContainer");
  const stack = document.querySelector("#chartStack");
  const tooltip = document.querySelector("#chartTooltip");
  if (!priceContainer || !volumeContainer || !stack || !tooltip) {
    return;
  }

  cleanupChart();

  const isSwingChart = Boolean(options.showEnvelope);
  const commonChartOptions = {
    width: stack.clientWidth || 840,
    layout: {
      background: { type: ColorType.Solid, color: "#fdfaf4" },
      textColor: "#695d4e",
      fontFamily: '"Segoe UI", "Noto Sans KR", sans-serif'
    },
    grid: {
      vertLines: { color: "rgba(31,26,20,0.05)", style: LineStyle.Dashed },
      horzLines: { color: "rgba(31,26,20,0.08)", style: LineStyle.Dashed }
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(159,62,25,0.45)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: false
      },
      horzLine: { color: "rgba(159,62,25,0.25)", width: 1, style: LineStyle.Dashed }
    },
    rightPriceScale: {
      borderColor: "rgba(31,26,20,0.12)"
    },
    timeScale: getInteractiveTimeScaleOptions(isSwingChart),
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true
    },
    handleScale: {
      mouseWheel: false,
      pinch: true,
      axisPressedMouseMove: true
    }
  };

  const priceChart = createChart(priceContainer, {
    ...commonChartOptions,
    height: 330
  });
  const volumeChart = createChart(volumeContainer, {
    ...commonChartOptions,
    height: 120
  });

  const candleSeries = priceChart.addSeries(CandlestickSeries, {
    upColor: "#d84c3f",
    downColor: "#2f6ee5",
    borderUpColor: "#d84c3f",
    borderDownColor: "#2f6ee5",
    wickUpColor: "#d84c3f",
    wickDownColor: "#2f6ee5",
    priceLineVisible: false
  });

  const volumeSeries = volumeChart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceLineVisible: false,
    lastValueVisible: false
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.08,
      bottom: 0
    }
  });

  const ma5Series = priceChart.addSeries(LineSeries, {
    color: "#177245",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const ma20Series = priceChart.addSeries(LineSeries, {
    color: "#d84c3f",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const ma60Series = priceChart.addSeries(LineSeries, {
    color: "#2563eb",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const ma120Series = priceChart.addSeries(LineSeries, {
    color: "#9333ea",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const envelopeUpperSeries = priceChart.addSeries(LineSeries, {
    color: "#7c3aed",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const envelopeLowerSeries = priceChart.addSeries(LineSeries, {
    color: "#0891b2",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });
  const chartState = {
    points
  };
  const showEnvelope = isSwingChart;
  const envelopeBands = showEnvelope ? buildEnvelopeBands(points) : null;
  const wheelHandler = (event) => {
    applyLatestAnchoredWheelZoom(event, priceChart, chartState.points);
  };

  candleSeries.setData(buildInteractiveCandleSeriesData(points));
  volumeSeries.setData(buildInteractiveVolumeSeriesData(points));
  ma5Series.setData(buildMovingAverage(points, 5));
  ma20Series.setData(buildMovingAverage(points, 20));
  ma60Series.setData(buildMovingAverage(points, 60));
  ma120Series.setData(buildMovingAverage(points, 120));
  envelopeUpperSeries.setData(envelopeBands?.upper ?? []);
  envelopeLowerSeries.setData(envelopeBands?.lower ?? []);

  let syncingRange = false;
  const syncVisibleRange = (sourceChart, targetChart) => {
    sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (syncingRange || range == null) {
        return;
      }
      syncingRange = true;
      targetChart.timeScale().setVisibleLogicalRange(range);
      syncingRange = false;
    });
  };
  syncVisibleRange(priceChart, volumeChart);
  syncVisibleRange(volumeChart, priceChart);

  priceChart.subscribeCrosshairMove((param) => {
    if (!param.point || !param.time || !param.seriesData.size) {
      tooltip.classList.add("hidden");
      return;
    }

    const currentPoints = activeChart?.chartState?.points ?? chartState.points;
    const candleData = param.seriesData.get(candleSeries);
    if (!candleData || !("open" in candleData)) {
      const point = currentPoints.find((candidate) => candidate.time === String(param.time));
      if (!point?.isWhitespace) {
        tooltip.classList.add("hidden");
        return;
      }

      const left = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
      const top = Math.max(param.point.y - 18, 12);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.classList.remove("hidden");
      tooltip.innerHTML = `
        <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
        <div>${point?.isHalted ? "거래정지" : "거래 없음"}</div>
      `;
      return;
    }

    const point = currentPoints.find((candidate) => candidate.time === String(param.time));

    const left = Math.min(param.point.x + 18, priceContainer.clientWidth - 180);
    const top = Math.max(param.point.y - 18, 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove("hidden");
    tooltip.innerHTML = `
      <div class="tooltip-date">${escapeHtml(formatKoreanChartDate(String(param.time)))}</div>
      ${point?.isHalted ? `<div>거래정지</div>` : ""}
      <div>시가 ${formatNumber(candleData.open)}</div>
      <div>고가 ${formatNumber(candleData.high)}</div>
      <div>저가 ${formatNumber(candleData.low)}</div>
      <div>종가 ${formatNumber(candleData.close)}</div>
      <div>5일선 ${formatNumber(getLineSeriesTooltipValue(param, ma5Series))}</div>
      <div>20일선 ${formatNumber(getLineSeriesTooltipValue(param, ma20Series))}</div>
      <div>60일선 ${formatNumber(getLineSeriesTooltipValue(param, ma60Series))}</div>
      <div>120일선 ${formatNumber(getLineSeriesTooltipValue(param, ma120Series))}</div>
      <div>거래량 ${formatNumber(point?.value)}</div>
    `;
  });

  setDefaultVisibleTradingRange(priceChart, points);
  stack.addEventListener("wheel", wheelHandler, { passive: false });

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    const width = entry.contentRect.width;
    priceChart.applyOptions({ width });
    volumeChart.applyOptions({ width });
  });
  resizeObserver.observe(stack);

  activeChart = {
    priceChart,
    volumeChart,
    priceContainer,
    volumeContainer,
    candleSeries,
    volumeSeries,
    ma5Series,
    ma20Series,
    ma60Series,
    ma120Series,
    envelopeUpperSeries,
    envelopeLowerSeries,
    chartState,
    anchorDate,
    swingTradeOverlay,
    showEnvelope,
    wheelTarget: stack,
    wheelHandler,
    priceLines: [],
    dataSignature: buildInteractiveChartSignature(points, anchorDate, swingTradeOverlay, showEnvelope),
    overlaySignature: buildInteractiveOverlaySignature(anchorDate, swingTradeOverlay, showEnvelope)
  };
  applyInteractivePriceLines(activeChart, points, anchorDate, swingTradeOverlay);
}

function buildMovingAverage(points, period) {
  const result = [];
  const tradingPoints = points.filter((point) => !point.isWhitespace && typeof point.close === "number");

  for (let index = 0; index < tradingPoints.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const window = tradingPoints.slice(index - period + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.close, 0) / period;
    result.push({
      time: tradingPoints[index].time,
      value: average
    });
  }
  return result;
}

function buildEnvelopeBands(points, period = 20, bandPercent = 10) {
  const movingAverage = buildMovingAverage(points, period);
  const multiplier = bandPercent / 100;

  return {
    upper: movingAverage.map((point) => ({
      time: point.time,
      value: point.value * (1 + multiplier)
    })),
    lower: movingAverage.map((point) => ({
      time: point.time,
      value: point.value * (1 - multiplier)
    }))
  };
}

function setDefaultVisibleTradingRange(priceChart, points, visibleSessions = DEFAULT_VISIBLE_TRADING_SESSIONS) {
  const tradingIndexes = getTradingLogicalIndexes(points);

  if (!tradingIndexes.length) {
    priceChart.timeScale().fitContent();
    return;
  }

  const endIndex = tradingIndexes.at(-1);
  const startIndex = tradingIndexes[Math.max(0, tradingIndexes.length - visibleSessions)];
  priceChart.timeScale().setVisibleLogicalRange({
    from: startIndex - 1,
    to: endIndex + CHART_RIGHT_ANCHOR_OFFSET
  });
}

function getTradingLogicalIndexes(points) {
  return points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => !point.isWhitespace && typeof point.close === "number")
    .map(({ index }) => index);
}

function getLatestAnchoredVisibleRange(points, visibleSpan) {
  const tradingIndexes = getTradingLogicalIndexes(points);
  if (!tradingIndexes.length) {
    return null;
  }

  const latestIndex = tradingIndexes.at(-1);
  const rightEdge = latestIndex + CHART_RIGHT_ANCHOR_OFFSET;
  const maxSpan = Math.max(MIN_VISIBLE_TRADING_SESSIONS, rightEdge + 1);
  const clampedSpan = Math.min(Math.max(visibleSpan, MIN_VISIBLE_TRADING_SESSIONS), maxSpan);

  return {
    from: Math.max(-1, rightEdge - clampedSpan),
    to: rightEdge
  };
}

function applyLatestAnchoredVisibleSpan(chart, points, visibleSpan) {
  const range = getLatestAnchoredVisibleRange(points, visibleSpan);
  if (!range) {
    chart.timeScale().fitContent();
    return;
  }

  chart.timeScale().setVisibleLogicalRange(range);
}

function applyLatestAnchoredWheelZoom(event, chart, points) {
  if (!Array.isArray(points) || !points.length || !event.deltaY) {
    return;
  }

  event.preventDefault();
  const currentRange = chart.timeScale().getVisibleLogicalRange?.();
  const currentSpan =
    currentRange && Number.isFinite(currentRange.from) && Number.isFinite(currentRange.to)
      ? currentRange.to - currentRange.from
      : DEFAULT_VISIBLE_TRADING_SESSIONS;
  const wheelUnits = Math.min(6, Math.max(1, Math.abs(event.deltaY) / 100));
  const zoomFactor = WHEEL_ZOOM_STEP ** wheelUnits;
  const nextSpan = event.deltaY > 0 ? currentSpan * zoomFactor : currentSpan / zoomFactor;

  applyLatestAnchoredVisibleSpan(chart, points, nextSpan);
}

function getChartSeriesRange(points) {
  const normalized = Array.isArray(points) ? points.filter((point) => point?.time) : [];
  return {
    startDate: normalized[0]?.time ?? "-",
    endDate: normalized.at(-1)?.time ?? "-"
  };
}

function updateChartView(timeframe) {
  if (!currentAnalysis) {
    return;
  }

  for (const tab of results.querySelectorAll(".timeframe-tab")) {
    tab.classList.toggle("active", tab.dataset.timeframe === timeframe);
  }

  const caption = results.querySelector(".timeframe-caption");
  if (caption) {
    caption.textContent = timeframeLabels[timeframe];
  }
  const range = getChartSeriesRange(currentAnalysis.chartSets[timeframe]);
  syncLiveMetric("[data-live-chart-start]", range.startDate);
  syncLiveMetric("[data-live-chart-end]", range.endDate);

  updateInteractiveChartData(
    currentAnalysis.chartSets[timeframe],
    currentAnalysis.tradingAnchorDate,
    currentAnalysis.swingTradeOverlay,
    {
      resetVisibleRange: true,
      showEnvelope: currentAnalysis.category === "swing"
    }
  );
}

function renderFundamentals(fundamentals, priceContext) {
  const priceReference =
    priceContext?.latestClose != null
      ? `가격 기준: ${formatNumber(priceContext.latestClose)}원${priceContext?.latestDate ? ` (${priceContext.latestDate} 종가)` : ""}`
      : "";
  const businessProfileHtml = renderBusinessProfile(fundamentals, priceContext);
  const hasAnnualHistory = Array.isArray(fundamentals?.annualHistory) && fundamentals.annualHistory.length > 0;
  const hasQuarterlyHistory = Array.isArray(fundamentals?.quarterlyHistory) && fundamentals.quarterlyHistory.length > 0;
  const hasFinancials = Boolean(fundamentals?.annual || fundamentals?.quarterly || hasAnnualHistory || hasQuarterlyHistory);

  if (!hasFinancials && !businessProfileHtml) {
    return `
      <section class="fundamentals-panel empty-fundamentals">
        <div class="fundamentals-head">
          <h4>재무지표 ${renderInfoIcon(fundamentalsGuideText, "재무지표 안내")}</h4>
          ${priceReference ? `<span>${escapeHtml(priceReference)}</span>` : ""}
        </div>
        <p>이 종목은 재무 데이터를 찾지 못했거나 ETF여서 표시할 재무지표가 없습니다.</p>
      </section>
    `;
  }

  return `
      <section class="fundamentals-panel">
        <div class="fundamentals-head">
          <h4>재무지표 ${renderInfoIcon(fundamentalsGuideText, "재무지표 안내")}</h4>
          <span>${escapeHtml(fundamentals?.source || "데이터 없음")}</span>
        </div>
        ${priceReference ? `<div class="fundamentals-price-reference">${escapeHtml(priceReference)}</div>` : ""}
        ${businessProfileHtml}
        ${
          hasFinancials
            ? `
              ${renderQuarterlyHistoryTable(fundamentals)}
            `
            : `<div class="fundamental-empty">재무 수치는 아직 비어 있지만, 사업 포트폴리오 맵은 먼저 확인할 수 있습니다.</div>`
        }
      </section>
  `;
}

function renderBusinessProfile(fundamentals, priceContext) {
  const businessAreas = getBusinessAreasForRender(fundamentals, priceContext?.sectorLabel);
  const businessSummary = typeof fundamentals?.businessSummary === "string" ? fundamentals.businessSummary.trim() : "";
  if (!businessAreas.length && !businessSummary) {
    return "";
  }

  const profileSource =
    fundamentals?.businessAreasSource ||
    (priceContext?.sectorLabel ? `업종 기준 기본 맵 · ${priceContext.sectorLabel}` : "사업 개요 기반 추정");

  return `
    <section class="business-profile-panel">
      <div class="business-profile-head">
        <div>
          <h5>사업 포트폴리오 맵 ${renderInfoIcon(businessAreaGuideText, "사업 포트폴리오 안내")}</h5>
          <div class="business-profile-copy">한 종목이 가진 여러 사업 축을 원형 그래프로 빠르게 읽는 보드입니다.</div>
        </div>
        <span class="business-profile-source">${escapeHtml(profileSource)}</span>
      </div>

      <div class="business-profile-layout">
        <div class="business-profile-chart-wrap">
          <div class="business-profile-chart" style="background:${escapeHtml(buildBusinessAreaGradient(businessAreas))};">
            <div class="business-profile-chart-hole">
              <strong>${escapeHtml(priceContext?.stockName || "사업 구조")}</strong>
              <span>${escapeHtml(String(businessAreas.length || 1))}개 축</span>
            </div>
          </div>
        </div>

        <div class="business-profile-legend">
          ${businessAreas
            .map(
              (area, index) => `
                <div class="business-profile-item">
                  <span class="business-profile-swatch" style="background:${escapeHtml(getBusinessAreaColor(index))};"></span>
                  <div class="business-profile-item-copy">
                    <strong>${escapeHtml(area.label)}</strong>
                    <span>${escapeHtml(String(area.weight))}%</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>

      ${
        businessSummary
          ? `<div class="business-profile-summary">${escapeHtml(truncateText(businessSummary, 210))}</div>`
          : ""
      }
    </section>
  `;
}

function getBusinessAreasForRender(fundamentals, sectorLabel) {
  if (Array.isArray(fundamentals?.businessAreas) && fundamentals.businessAreas.length) {
    return fundamentals.businessAreas
      .filter((item) => item && typeof item.label === "string" && Number.isFinite(item.weight))
      .slice(0, 5);
  }

  if (!sectorLabel) {
    return [];
  }

  return [
    {
      label: sectorLabel,
      weight: 100,
      source: "sector_fallback"
    }
  ];
}

function getBusinessAreaColor(index) {
  return businessAreaPalette[index % businessAreaPalette.length];
}

function buildBusinessAreaGradient(areas) {
  if (!areas.length) {
    return "conic-gradient(#d8cdbd 0 100%)";
  }

  let cursor = 0;
  const stops = areas.map((area, index) => {
    const start = cursor;
    const end = Math.min(100, cursor + area.weight);
    cursor = end;
    return `${getBusinessAreaColor(index)} ${start}% ${end}%`;
  });

  if (cursor < 100) {
    stops.push(`rgba(121, 103, 82, 0.12) ${cursor}% 100%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

function renderFundamentalBlock(title, period, description = "") {
  if (!period) {
    return `
      <div class="fundamental-block">
        <div class="fundamental-title">${title}</div>
        ${description ? `<div class="fundamental-copy">${escapeHtml(description)}</div>` : ""}
        <div class="fundamental-empty">데이터 없음</div>
      </div>
    `;
  }

  return `
    <div class="fundamental-block">
      <div class="fundamental-title">${title}</div>
      ${description ? `<div class="fundamental-copy">${escapeHtml(description)}</div>` : ""}
      <div class="fundamental-period">${escapeHtml(period.label)}</div>
      <dl class="fundamental-list">
        ${fundamentalMetricDefinitions.map((metric) => renderFundamentalItem(metric, period?.[metric.key])).join("")}
      </dl>
    </div>
  `;
}

function buildFundamentalsTablePeriods(history, fallback, limit = 8) {
  const items = Array.isArray(history) ? history.filter(Boolean) : [];
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    const key = item?.label;
    if (!key || seen.has(key)) {
      continue;
    }
    deduped.push(item);
    seen.add(key);
  }

  if ((!deduped.length || (fallback?.label && !seen.has(fallback.label))) && fallback?.label) {
    deduped.push(fallback);
  }

  return deduped.slice(-limit);
}

function renderQuarterlyHistoryTable(fundamentals) {
  const annualPeriods = buildFundamentalsTablePeriods(fundamentals?.annualHistory, fundamentals?.annual, 2);
  const actualQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyHistory, fundamentals?.quarterly, 8);
  const estimatedQuarterlyPeriods = buildFundamentalsTablePeriods(fundamentals?.quarterlyEstimateHistory, undefined, 8);
  if (!annualPeriods.length && !actualQuarterlyPeriods.length && !estimatedQuarterlyPeriods.length) {
    return "";
  }

  const tableId = "fundamentalsQuarterlyHistory";
  const annualHeader = annualPeriods.length
    ? `<th colspan="${annualPeriods.length}" class="fundamentals-group annual">연간</th>`
    : "";
  const actualQuarterlyHeader = actualQuarterlyPeriods.length
    ? `<th colspan="${actualQuarterlyPeriods.length}" class="fundamentals-group quarterly">실제 분기</th>`
    : "";
  const estimatedQuarterlyHeader = estimatedQuarterlyPeriods.length
    ? `<th colspan="${estimatedQuarterlyPeriods.length}" class="fundamentals-group estimated">추정 분기 (E)</th>`
    : "";
  const annualCells = annualPeriods
    .map(
      (period, index) => {
        const needsSectionEnd = index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
        return `<th class="fundamentals-period-head annual ${needsSectionEnd ? "section-end" : ""}">${escapeHtml(period.label)}</th>`;
      }
    )
    .join("");
  const actualQuarterlyCells = actualQuarterlyPeriods
    .map(
      (period, index) =>
        `<th class="fundamentals-period-head quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${escapeHtml(period.label)}</th>`
    )
    .join("");
  const estimatedQuarterlyCells = estimatedQuarterlyPeriods
    .map(
      (period, index) =>
        `<th class="fundamentals-period-head estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${escapeHtml(period.label)}</th>`
    )
    .join("");
  return `
    <section class="fundamentals-history-section">
      <div class="fundamentals-history-head">
        <div>
          <h5>재무 흐름 표</h5>
          <p>최근 2개 연간, 실제 분기 최대 8개를 우선 보여주고 추정 분기(E)는 별도 구간으로 분리합니다.</p>
        </div>
        <div class="fundamentals-scroll-controls">
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="prev" data-fundamentals-target="${tableId}" aria-label="이전 재무 구간 보기">‹</button>
          <button type="button" class="fundamentals-scroll-button" data-fundamentals-scroll="next" data-fundamentals-target="${tableId}" aria-label="다음 재무 구간 보기">›</button>
        </div>
      </div>
      <div id="${tableId}" class="fundamentals-table-scroll">
        <table class="fundamentals-table">
          <thead>
            <tr>
              <th rowspan="2" class="fundamentals-sticky-col">지표</th>
              ${annualHeader}
              ${actualQuarterlyHeader}
              ${estimatedQuarterlyHeader}
            </tr>
            <tr>
              ${annualCells}
              ${actualQuarterlyCells}
              ${estimatedQuarterlyCells}
            </tr>
          </thead>
          <tbody>
            ${fundamentalMetricDefinitions
              .map(
                (metric) => `
                  <tr>
                    <th class="fundamentals-sticky-col">${metric.label}${renderInfoIcon(fundamentalMetricGuides[metric.label], `${metric.label} 설명`)}</th>
                    ${annualPeriods
                      .map(
                        (period, index) => {
                          const needsSectionEnd =
                            index === annualPeriods.length - 1 && (actualQuarterlyPeriods.length || estimatedQuarterlyPeriods.length);
                          return `<td class="annual ${needsSectionEnd ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`;
                        }
                      )
                      .join("")}
                    ${actualQuarterlyPeriods
                      .map(
                        (period, index) =>
                          `<td class="quarterly ${index === 0 && annualPeriods.length ? "section-start" : ""} ${index === actualQuarterlyPeriods.length - 1 && estimatedQuarterlyPeriods.length ? "section-end" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
                      )
                      .join("")}
                    ${estimatedQuarterlyPeriods
                      .map(
                        (period, index) =>
                          `<td class="estimated ${index === 0 && (annualPeriods.length || actualQuarterlyPeriods.length) ? "section-start" : ""}">${formatFundamentalMetricValue(metric, period?.[metric.key])}</td>`
                      )
                      .join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderFundamentalItem(metric, value) {
  const guide = fundamentalMetricGuides[metric.label];
  return `
    <div class="fundamental-item">
      <dt>${metric.label}${guide ? ` ${renderInfoIcon(guide, `${metric.label} 설명`)}` : ""}</dt>
      <dd>${formatFundamentalMetricValue(metric, value)}</dd>
    </div>
  `;
}

function formatFundamentalMetricValue(metric, value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  if ((metric?.digits ?? 0) > 0) {
    return `${new Intl.NumberFormat("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: metric.digits
    }).format(value)}${metric.suffix ?? ""}`;
  }

  return `${formatNumber(value)}${metric?.suffix ?? ""}`;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

function truncateText(value, maxLength = 210) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatDecimal(value, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedDecimal(value, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value, digits)}`;
}

function formatSignedPointDelta(value, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "(0.00)";
  }

  const sign = value > 0 ? "+" : "";
  return `(${sign}${formatDecimal(value, digits)})`;
}

function formatMultiplier(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}x`;
}

function formatKoreanEok(value) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value / 100000000)}\uC5B5`;
}

function formatKoreanChartDate(value) {
  if (!value) {
    return "-";
  }

  const intradayMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value));
  if (intradayMatch) {
    const [, year, month, day, hour, minute] = intradayMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC"
      }).format(date);
    }
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
