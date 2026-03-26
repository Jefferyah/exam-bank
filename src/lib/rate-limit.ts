/**
 * Simple in-memory sliding window rate limiter.
 * For production with multiple instances, replace with Redis-backed solution.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 600_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000);

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
}

/**
 * Check if a request is within rate limits.
 *
 * @param key      Unique identifier (e.g. userId, IP, or "userId:endpoint")
 * @param config   Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    retryAfterSeconds: null,
  };
}

// ── Pre-configured limiters for common use cases ──

/** Strict: 5 requests per 60 seconds (login, password change) */
export const AUTH_RATE_LIMIT = { limit: 5, windowSeconds: 60 };

/** AI endpoints: 10 requests per 60 seconds */
export const AI_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

/** General write: 30 requests per 60 seconds */
export const WRITE_RATE_LIMIT = { limit: 30, windowSeconds: 60 };

/** Destructive: 5 requests per 60 seconds (reset, delete) */
export const DESTRUCTIVE_RATE_LIMIT = { limit: 5, windowSeconds: 60 };
