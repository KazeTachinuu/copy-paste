const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 300 // Max requests per IP per window (allows ~3 devices polling every 10s)
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

const requestCounts = new Map();

// Periodic cleanup of rate limiting map
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestCounts.entries()) {
        const validTimestamps = timestamps.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
        if (validTimestamps.length === 0) {
            requestCounts.delete(ip);
        } else {
            requestCounts.set(ip, validTimestamps);
        }
    }
}, RATE_LIMIT_CLEANUP_INTERVAL);

export const rateLimiter = (req, res, next) => {
    // Skip rate limiting for health check only
    if (req.path === '/health') {
        return next();
    }

    const ip = req.ip;
    const now = Date.now();

    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
    }

    const requests = requestCounts.get(ip);
    const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);

    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        const oldestRequest = recentRequests[0];
        const timeUntilExpiry = RATE_LIMIT_WINDOW_MS - (now - oldestRequest);
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
