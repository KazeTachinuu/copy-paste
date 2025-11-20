import { RATE_LIMIT } from '../../config/constants.js';

const requestCounts = new Map();

// Periodic cleanup of rate limiting map
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestCounts.entries()) {
    const validTimestamps = timestamps.filter(time => now - time < RATE_LIMIT.WINDOW_MS);
    if (validTimestamps.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, validTimestamps);
    }
  }
}, RATE_LIMIT.CLEANUP_INTERVAL);

export const rateLimiter = (req, res, next) => {
  // Skip rate limiting for health check only
  if (req.path === '/health') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress;

  if (!ip) {
    console.error('Rate limiter: No IP address');
    return res.status(403).json({ error: 'Unable to process request' });
  }

  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip);
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT.WINDOW_MS);

  if (recentRequests.length >= RATE_LIMIT.MAX_REQUESTS) {
    const oldestRequest = recentRequests[0];
    const timeUntilExpiry = RATE_LIMIT.WINDOW_MS - (now - oldestRequest);
    const secondsUntilExpiry = Math.ceil(timeUntilExpiry / 1000);

    res.setHeader('Retry-After', secondsUntilExpiry);
    return res.status(429).json({
      error: `Too many requests. Please try again in ${secondsUntilExpiry} seconds.`
    });
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  next();
};
