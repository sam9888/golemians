// Simple rate limiting utility for API protection
// Format: key -> { count, resetTime }

const rateLimits = new Map();

export function checkRateLimit(key, maxRequests = 100, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const record = rateLimits.get(key);

  // Reset window if expired
  if (now > record.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Increment counter
  record.count++;

  if (record.count > maxRequests) {
    const secondsUntilReset = Math.ceil((record.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: secondsUntilReset
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - record.count
  };
}

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetTime + 60000) {
      rateLimits.delete(key);
    }
  }
}, 60 * 60 * 1000);
