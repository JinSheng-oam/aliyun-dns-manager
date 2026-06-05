const loginFailures = new Map<string, number[]>();
const globalForRateLimit = globalThis as typeof globalThis & {
    __loginFailureCleanupInterval?: ReturnType<typeof setInterval>;
};

// Cleans up entries periodically
// to prevent memory leaks if many IPs attack.
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Use global interval to persist across module reloads in dev (though not perfect)
// and avoid creating multiple intervals
if (!globalForRateLimit.__loginFailureCleanupInterval) {
    globalForRateLimit.__loginFailureCleanupInterval = setInterval(() => {
        const now = Date.now();
        const windowSeconds = Number(process.env.LOGIN_WINDOW_SECONDS) || 60;
        const windowStart = now - windowSeconds * 1000;

        for (const [ip, timestamps] of loginFailures.entries()) {
            const validTimestamps = timestamps.filter(t => t > windowStart);
            if (validTimestamps.length === 0) {
                loginFailures.delete(ip);
            } else {
                loginFailures.set(ip, validTimestamps);
            }
        }
    }, CLEANUP_INTERVAL);
}

export function isRateLimited(ip: string): boolean {
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
    const windowSeconds = Number(process.env.LOGIN_WINDOW_SECONDS) || 60;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const timestamps = loginFailures.get(ip) || [];
    const recentFailures = timestamps.filter(t => t > windowStart);

    // Update map if we filtered out old entries
    if (recentFailures.length !== timestamps.length) {
        if (recentFailures.length === 0) {
            loginFailures.delete(ip);
        } else {
            loginFailures.set(ip, recentFailures);
        }
    }

    return recentFailures.length >= maxAttempts;
}

export function recordLoginFailure(ip: string) {
    const now = Date.now();
    const timestamps = loginFailures.get(ip) || [];
    timestamps.push(now);
    loginFailures.set(ip, timestamps);
}

export function clearLoginFailures(ip: string) {
    loginFailures.delete(ip);
}
