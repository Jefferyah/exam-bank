/**
 * Safe JSON.parse wrapper — returns fallback on parse failure instead of throwing.
 */
export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
