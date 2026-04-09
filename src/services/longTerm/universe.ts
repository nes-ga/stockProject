import type { LongTermUniverseSeed } from "../../types.js";

// Curated v1 universe. This engine reviews representative leaders after correction,
// not the entire market.
export const LONG_TERM_UNIVERSE: LongTermUniverseSeed[] = [
  { symbol: "005930", name: "삼성전자", bucket: "core_leader", tier: "core" },
  { symbol: "051900", name: "LG생활건강", bucket: "core_leader", tier: "core" },
  { symbol: "090430", name: "아모레퍼시픽", bucket: "defensive_consumer", tier: "primary" },
  { symbol: "282330", name: "BGF리테일", bucket: "defensive_consumer", tier: "primary" },
  { symbol: "000120", name: "CJ대한통운", bucket: "core_leader", tier: "primary" },
  { symbol: "036570", name: "엔씨소프트", bucket: "content_game", tier: "core" },
  { symbol: "066970", name: "엘앤에프", bucket: "growth_leader", tier: "core" },
  { symbol: "247540", name: "에코프로비엠", bucket: "growth_leader", tier: "core" },
  { symbol: "022100", name: "포스코DX", bucket: "growth_leader", tier: "primary" },
  { symbol: "079370", name: "제우스", bucket: "growth_leader", tier: "primary" },
  { symbol: "068760", name: "셀트리온제약", bucket: "growth_leader", tier: "primary" },
  { symbol: "095660", name: "네오위즈", bucket: "content_game", tier: "primary" },
  { symbol: "078340", name: "컴투스", bucket: "content_game", tier: "primary" },
  { symbol: "456040", name: "OCI", bucket: "secondary_candidate", tier: "secondary" },
  { symbol: "001800", name: "오리온홀딩스", bucket: "defensive_consumer", tier: "secondary" },
  { symbol: "190510", name: "나무가", bucket: "secondary_candidate", tier: "secondary" }
];
