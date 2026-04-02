import { Router } from "express";
import { config } from "../config.js";
import { buildBandAuthorizeUrl, exchangeBandCode } from "../services/bandClient.js";

export const authRoutes = Router();

authRoutes.get("/band/config", (_request, response) => {
  response.json({
    isConfigured: Boolean(
      config.bandClientId &&
        config.bandClientSecret &&
        config.bandRedirectUri
    ),
    redirectUri: config.bandRedirectUri ?? null
  });
});

authRoutes.get("/band/url", (_request, response) => {
  response.json({
    authorizeUrl: buildBandAuthorizeUrl()
  });
});

authRoutes.post("/band/token", async (request, response, next) => {
  try {
    const code = String(request.body?.code ?? "");
    if (!code) {
      response.status(400).json({ error: "Missing code in request body" });
      return;
    }

    const token = await exchangeBandCode(code);
    response.json(token);
  } catch (error) {
    next(error);
  }
});

authRoutes.get("/band/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code ?? "");
    if (!code) {
      response.status(400).json({ error: "Missing code query parameter" });
      return;
    }

    const state = String(request.query.state ?? "");
    const wantsJson =
      request.query.format === "json" ||
      (request.accepts(["html", "json"]) === "json" && request.query.redirect !== "true");

    if (!wantsJson) {
      const baseUrl = `${request.protocol}://${request.get("host")}`;
      const redirectUrl = new URL("/", baseUrl);
      redirectUrl.searchParams.set("band_code", code);
      if (state) {
        redirectUrl.searchParams.set("state", state);
      }

      response.redirect(302, redirectUrl.toString());
      return;
    }

    const token = await exchangeBandCode(code);
    response.json(token);
  } catch (error) {
    next(error);
  }
});
