import { config } from "../config.js";
import { readJson } from "../lib/http.js";
import { createLogger, toErrorContext } from "../lib/logger.js";
import type { BandPost } from "../types.js";

const BAND_AUTH_URL = "https://auth.band.us/oauth2/authorize";
const BAND_TOKEN_URL = "https://auth.band.us/oauth2/token";
const BAND_API_URL = "https://openapi.band.us";
const logger = createLogger("bandClient");

type BandEnvelope<T> = {
  result_code: number;
  result_data: T;
};

type BandsResponse = {
  items: Array<{
    band_key: string;
    name: string;
    cover: string | null;
    member_count: number;
  }>;
};

type PostsResponse = {
  items: Array<{
    post_key: string;
    content: string;
    created_at?: string;
    author?: {
      name?: string;
    };
    photos?: Array<{ url: string }>;
  }>;
};

type PostResponse = {
  post_key: string;
  content: string;
  created_at?: string;
  author?: {
    name?: string;
  };
  photos?: Array<{ url: string }>;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
};

function toBandPost(post: PostsResponse["items"][number] | PostResponse): BandPost {
  return {
    postKey: post.post_key,
    content: post.content ?? "",
    author: post.author?.name,
    createdAt: post.created_at,
    photos: post.photos?.map((photo) => photo.url),
    raw: post
  };
}

export function buildBandAuthorizeUrl(): string {
  const { clientId, redirectUri } = config.requireBandOAuth();
  const url = new URL(BAND_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", config.bandState);
  return url.toString();
}

export async function exchangeBandCode(code: string) {
  logger.info("exchangeBandCode:start", {
    codeLength: code.length
  });
  const { clientId, clientSecret, redirectUri } = config.requireBandOAuth();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch(BAND_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  try {
    const token = await readJson<TokenResponse>(response);
    logger.info("exchangeBandCode:success", {
      tokenType: token.token_type,
      expiresIn: token.expires_in
    });
    return token;
  } catch (error) {
    logger.error("exchangeBandCode:failed", toErrorContext(error));
    throw error;
  }
}

export async function fetchBands(accessToken: string) {
  logger.info("fetchBands:start", {
    tokenLength: accessToken.length
  });
  const url = new URL("/v2.1/bands", BAND_API_URL);
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url);
    const payload = await readJson<BandEnvelope<BandsResponse>>(response);
    logger.info("fetchBands:success", {
      count: payload.result_data.items.length
    });
    return payload.result_data.items;
  } catch (error) {
    logger.error("fetchBands:failed", toErrorContext(error));
    throw error;
  }
}

export async function fetchBandPosts(params: {
  accessToken: string;
  bandKey: string;
  limit?: number;
}) {
  logger.info("fetchBandPosts:start", {
    bandKey: params.bandKey,
    limit: params.limit ?? 10
  });
  const url = new URL("/v2/band/posts", BAND_API_URL);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("band_key", params.bandKey);
  if (params.limit) {
    url.searchParams.set("locale", "ko_KR");
  }

  try {
    const response = await fetch(url);
    const payload = await readJson<BandEnvelope<PostsResponse>>(response);
    const items = payload.result_data.items.slice(0, params.limit ?? 10);
    logger.info("fetchBandPosts:success", {
      bandKey: params.bandKey,
      count: items.length
    });
    return items.map(toBandPost);
  } catch (error) {
    logger.error("fetchBandPosts:failed", {
      bandKey: params.bandKey,
      ...toErrorContext(error)
    });
    throw error;
  }
}

export async function fetchBandPost(params: {
  accessToken: string;
  bandKey: string;
  postKey: string;
}) {
  logger.info("fetchBandPost:start", {
    bandKey: params.bandKey,
    postKey: params.postKey
  });
  const url = new URL("/v2.1/band/post", BAND_API_URL);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("band_key", params.bandKey);
  url.searchParams.set("post_key", params.postKey);

  try {
    const response = await fetch(url);
    const payload = await readJson<BandEnvelope<PostResponse>>(response);
    const post = toBandPost(payload.result_data);
    logger.info("fetchBandPost:success", {
      bandKey: params.bandKey,
      postKey: params.postKey,
      contentLength: post.content.length
    });
    return post;
  } catch (error) {
    logger.error("fetchBandPost:failed", {
      bandKey: params.bandKey,
      postKey: params.postKey,
      ...toErrorContext(error)
    });
    throw error;
  }
}
