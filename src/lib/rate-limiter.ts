/**
 * Simple in-memory rate limiter for API routes
 *
 * Uses sliding window algorithm to limit requests per IP/user.
 * For production, consider using Redis or Upstash for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimiterConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
}

// In-memory store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000)

/**
 * Check if request should be rate limited
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimiterConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier

  let entry = rateLimitStore.get(key)

  // Create new entry or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header (for proxied requests) or falls back to a default
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Get first IP in chain (original client)
    return forwarded.split(',')[0].trim()
  }

  // Fallback: use a hash of user-agent + accept-language for fingerprinting
  const ua = request.headers.get('user-agent') || 'unknown'
  const lang = request.headers.get('accept-language') || 'unknown'
  return `fingerprint:${hashCode(ua + lang)}`
}

/**
 * Simple hash function for fingerprinting
 */
function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Preset configurations
export const RATE_LIMITS = {
  // General API: 100 requests per minute
  general: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  // AI endpoints: 20 requests per minute (expensive)
  ai: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },
  // Storage endpoints: 30 requests per minute
  storage: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // Auth endpoints: 10 requests per minute (prevent brute force)
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
} as const

export type RateLimitPreset = keyof typeof RATE_LIMITS
