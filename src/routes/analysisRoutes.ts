import { Router } from "express";
import { z } from "zod";
import { fetchBandPost } from "../services/bandClient.js";
import { analyzeRecommendations, analyzeSymbols } from "../services/stockAnalysis.js";
import { extractStockSymbols } from "../services/symbolExtractor.js";

export const analysisRoutes = Router();

const analysisSchema = z
  .object({
    accessToken: z.string().min(1).optional(),
    bandKey: z.string().min(1).optional(),
    postKey: z.string().min(1).optional(),
    postText: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.postText || (value.accessToken && value.bandKey && value.postKey)), {
    message: "Provide postText or accessToken + bandKey + postKey"
  });

const recommendationSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latestMentionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().min(1).optional()
});

const recommendationBatchSchema = z.object({
  items: z.array(recommendationSchema).min(1)
});

analysisRoutes.post("/from-post", async (request, response, next) => {
  try {
    const input = analysisSchema.parse(request.body);
    const post =
      input.postText != null
        ? {
            postKey: input.postKey,
            content: input.postText
          }
        : await fetchBandPost({
            accessToken: input.accessToken!,
            bandKey: input.bandKey!,
            postKey: input.postKey!
          });

    const symbols = extractStockSymbols(post.content);
    if (!symbols.length) {
      response.status(422).json({
        error: "No stock symbols found in the post",
        post
      });
      return;
    }

    const analyses = await analyzeSymbols(symbols);
    response.json({
      post,
      symbols,
      analyses
    });
  } catch (error) {
    next(error);
  }
});

analysisRoutes.post("/recommendations", async (request, response, next) => {
  try {
    const input = recommendationBatchSchema.parse(request.body);
    const analyses = await analyzeRecommendations(input.items);
    response.json({
      count: analyses.length,
      analyses
    });
  } catch (error) {
    next(error);
  }
});
