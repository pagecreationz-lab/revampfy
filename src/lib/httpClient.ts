export async function readJsonSafe<T = any>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { error: raw } as T;
  }
}
