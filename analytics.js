/**
 * analytics.js
 * ─────────────────────────────────────────────────────────────────
 * Lightweight in-memory click tracker.
 *
 * For production, swap the in-memory store with:
 *   - Supabase (free tier, Postgres): https://supabase.com
 *   - PlanetScale (free tier, MySQL): https://planetscale.com
 *   - Upstash Redis (free tier):      https://upstash.com
 *
 * Each click event tells you:
 *   - Which part was clicked
 *   - Which affiliate source (Amazon, eBay, etc.)
 *   - What car/build it was for
 *   - Timestamp + session ID (for conversion attribution)
 */

// In-memory store — resets on server restart
// Replace with DB calls for production
const clicks = [];
const sessionCounts = {};

function trackClick({ part, source, car, buildTier, sessionId, ip, userAgent }) {
  const event = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    part,
    source,
    car,
    buildTier,
    sessionId,
    ip: anonymizeIp(ip),          // privacy-safe
    userAgent,
  };

  clicks.push(event);

  // Track per-session click count (rate limiting signal)
  sessionCounts[sessionId] = (sessionCounts[sessionId] || 0) + 1;

  if (process.env.ENABLE_CLICK_TRACKING === "true") {
    console.log(`[CLICK] ${source} | ${part} | ${car} | tier:${buildTier}`);
  }

  return event;
}

function getStats() {
  const now = Date.now();
  const last24h = clicks.filter(c => now - new Date(c.timestamp) < 86400000);
  const last7d  = clicks.filter(c => now - new Date(c.timestamp) < 604800000);

  // Top sources by click count
  const bySource = {};
  last7d.forEach(c => { bySource[c.source] = (bySource[c.source] || 0) + 1; });

  // Top parts by click count
  const byPart = {};
  last7d.forEach(c => { byPart[c.part] = (byPart[c.part] || 0) + 1; });

  // Top build tiers
  const byTier = {};
  last7d.forEach(c => { byTier[c.buildTier] = (byTier[c.buildTier] || 0) + 1; });

  return {
    total: clicks.length,
    last24h: last24h.length,
    last7d: last7d.length,
    topSources: sortByValue(bySource).slice(0, 5),
    topParts:   sortByValue(byPart).slice(0, 10),
    topTiers:   sortByValue(byTier),
    recentClicks: clicks.slice(-20).reverse(),
  };
}

function getSessionClickCount(sessionId) {
  return sessionCounts[sessionId] || 0;
}

// ─── Helpers ──────────────────────────────────────────────────────

function anonymizeIp(ip) {
  if (!ip) return "unknown";
  // Remove last octet for IPv4 privacy
  return ip.replace(/\.\d+$/, ".xxx");
}

function sortByValue(obj) {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));
}

module.exports = { trackClick, getStats, getSessionClickCount };
