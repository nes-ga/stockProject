import { Router } from "express";
import { z } from "zod";
import { fetchBands, fetchBandPost, fetchBandPosts } from "../services/bandClient.js";

export const bandRoutes = Router();

const listPostsSchema = z.object({
  accessToken: z.string().min(1),
  bandKey: z.string().min(1),
  limit: z.coerce.number().int().positive().max(50).optional()
});

bandRoutes.get("/bands", async (request, response, next) => {
  try {
    const accessToken = String(request.query.accessToken ?? "");
    if (!accessToken) {
      response.status(400).json({ error: "Missing accessToken query parameter" });
      return;
    }

    const bands = await fetchBands(accessToken);
    response.json({ items: bands });
  } catch (error) {
    next(error);
  }
});

bandRoutes.get("/posts", async (request, response, next) => {
  try {
    const input = listPostsSchema.parse(request.query);
    const posts = await fetchBandPosts(input);
    response.json({ items: posts });
  } catch (error) {
    next(error);
  }
});

bandRoutes.get("/post", async (request, response, next) => {
  try {
    const accessToken = String(request.query.accessToken ?? "");
    const bandKey = String(request.query.bandKey ?? "");
    const postKey = String(request.query.postKey ?? "");
    if (!accessToken || !bandKey || !postKey) {
      response
        .status(400)
        .json({ error: "accessToken, bandKey, postKey query parameters are required" });
      return;
    }

    const post = await fetchBandPost({ accessToken, bandKey, postKey });
    response.json({ item: post });
  } catch (error) {
    next(error);
  }
});
