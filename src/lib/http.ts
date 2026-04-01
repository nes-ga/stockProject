export async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    message?: string;
    result_code?: number;
    result_data?: unknown;
  };

  if (!response.ok) {
    const message =
      payload?.message ??
      `Request failed with status ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
}
