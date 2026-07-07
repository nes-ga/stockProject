import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  alertWebhookSecret: process.env.ALERT_WEBHOOK_SECRET,
  alertCooldownMs: Number(process.env.ALERT_COOLDOWN_MS ?? 10 * 60 * 1000),
  alertMinChangePercent: Number(process.env.ALERT_MIN_CHANGE_PERCENT ?? 7),
  alertMinVolumeRatio: Number(process.env.ALERT_MIN_VOLUME_RATIO ?? 3),
  alertMinTurnoverKrw: Number(process.env.ALERT_MIN_TURNOVER_KRW ?? 3_000_000_000),
  alertRequireBreakout: process.env.ALERT_REQUIRE_BREAKOUT === "true",
  yahooDefaultMarketSuffix: process.env.YAHOO_DEFAULT_MARKET_SUFFIX ?? ".KS",
  naverSearchClientId: process.env.NAVER_SEARCH_CLIENT_ID,
  naverSearchClientSecret: process.env.NAVER_SEARCH_CLIENT_SECRET,
  ecosApiKey: process.env.ECOS_API_KEY,
  ecosKoreaM2StatCode: process.env.ECOS_KOREA_M2_STAT_CODE,
  ecosKoreaM2ItemCode: process.env.ECOS_KOREA_M2_ITEM_CODE,
  ecosKoreaM2Cycle: process.env.ECOS_KOREA_M2_CYCLE ?? "M",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-5.2"
};
