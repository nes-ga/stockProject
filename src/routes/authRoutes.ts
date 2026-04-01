import { Router } from "express";
import { buildBandAuthorizeUrl, exchangeBandCode } from "../services/bandClient.js";

export const authRoutes = Router();

authRoutes.get("/band/url", (_request, response) => {
  response.json({
    authorizeUrl: buildBandAuthorizeUrl()
  });
});

authRoutes.get("/band/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code ?? "");
    if (!code) {
      response.status(400).json({ error: "Missing code query parameter" });
      return;
    }

    const token = await exchangeBandCode(code);
    response.json(token);
  } catch (error) {
    next(error);
  }
});
