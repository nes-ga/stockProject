import { config } from "../config.js";
import { readJson } from "../lib/http.js";
import type { BandPost } from "../types.js";

const BAND_AUTH_URL = "https://auth.band.us/oauth2/authorize";
const BAND_TOKEN_URL = "https://auth.band.us/oauth2/token";
const BAND_API_URL = "https://openapi.band.us";

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

  return readJson<TokenResponse>(response);
}

export async function fetchBands(accessToken: string) {
  const url = new URL("/v2.1/bands", BAND_API_URL);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await readJson<BandEnvelope<BandsResponse>>(response);
  return payload.result_data.items;
}

export async function fetchBandPosts(params: {
  accessToken: string;
  bandKey: string;
  limit?: number;
}) {
  const url = new URL("/v2/band/posts", BAND_API_URL);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("band_key", params.bandKey);
  if (params.limit) {
    url.searchParams.set("locale", "ko_KR");
  }

  const response = await fetch(url);
  const payload = await readJson<BandEnvelope<PostsResponse>>(response);
  const items = payload.result_data.items.slice(0, params.limit ?? 10);
  return items.map(toBandPost);
}

export async function fetchBandPost(params: {
  accessToken: string;
  bandKey: string;
  postKey: string;
}) {
  const url = new URL("/v2.1/band/post", BAND_API_URL);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("band_key", params.bandKey);
  url.searchParams.set("post_key", params.postKey);

  const response = await fetch(url);
  const payload = await readJson<BandEnvelope<PostResponse>>(response);
  return toBandPost(payload.result_data);
}
