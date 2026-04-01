import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  bandClientId: process.env.BAND_CLIENT_ID,
  bandClientSecret: process.env.BAND_CLIENT_SECRET,
  bandRedirectUri: process.env.BAND_REDIRECT_URI,
  bandState: process.env.BAND_STATE ?? "band-stock-api-state",
  yahooDefaultMarketSuffix: process.env.YAHOO_DEFAULT_MARKET_SUFFIX ?? ".KS",
  requireBandOAuth() {
    return {
      clientId: requireEnv("BAND_CLIENT_ID"),
      clientSecret: requireEnv("BAND_CLIENT_SECRET"),
      redirectUri: requireEnv("BAND_REDIRECT_URI")
    };
  }
};
