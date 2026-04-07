export async function readJson<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let payload: unknown;

  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    const preview = rawText.replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `Request failed to parse JSON from ${response.url || "unknown url"} with status ${response.status} ${response.statusText}${preview ? `: ${preview}` : ""}`
    );
  }

  if (!response.ok) {
    const typedPayload = payload as {
      message?: string;
      error?: string;
    };
    const message =
      typedPayload?.message ??
      typedPayload?.error ??
      `Request failed with status ${response.status} ${response.statusText} (${response.url || "unknown url"})`;
    throw new Error(message);
  }

  return payload as T;
}
