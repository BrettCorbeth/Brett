/**
 * routes/affiliate.js
 * ─────────────────────────────────────────────────────────────────
 * Affiliate link click tracking + redirect.
 *
 * All outbound affiliate links go through /api/affiliate/click
 * so we can log every click before redirecting to the merchant.
 *
 * This data tells you:
 *   - Which parts are most clicked (= high buyer intent)
 *   - Which merchants convert best
 *   - Which build tiers are most engaged
 *   - Revenue attribution per car/build type
 */

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { trackClick, getStats, getSessionClickCount } = require("../lib/analytics");

// Prevent click spam — max 60 affiliate clicks per hour per IP
const clickLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: "Too many clicks. Are you a bot?" },
});

// ─── GET /api/affiliate/click ─────────────────────────────────────
// Tracks the click then redirects to the merchant
router.get("/click", clickLimiter, (req, res) => {
  const { dest, part, source, car, tier, session } = req.query;

  if (!dest) return res.status(400).json({ error: "Destination URL required" });

  // Validate destination is a known merchant (security: prevent open redirect abuse)
  const allowedDomains = [
    "amazon.com", "ebay.com", "summitracing.com", "rockauto.com",
    "jegs.com", "tirerack.com", "autozone.com", "advanceautoparts.com",
    "carid.com", "autoanything.com", "vividracing.com",
  ];

  let destUrl;
  try {
    destUrl = new URL(dest);
  } catch {
    return res.status(400).json({ error: "Invalid destination URL" });
  }

  const hostname = destUrl.hostname.replace(/^www\./, "");
  const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
  if (!isAllowed) {
    return res.status(403).json({ error: "Destination not in allowed merchants list" });
  }

  // Track the click
  trackClick({
    part:      part || "unknown",
    source:    source || "unknown",
    car:       car || "unknown",
    buildTier: tier || "unknown",
    sessionId: session || req.ip,
    ip:        req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Redirect to merchant
  res.redirect(302, dest);
});

// ─── GET /api/affiliate/stats ─────────────────────────────────────
// Admin dashboard data — protect this in production with auth!
// For now it's open so you can see your click data easily.
router.get("/stats", (req, res) => {
  const stats = getStats();
  res.json(stats);
});

// ─── GET /api/affiliate/stats/html ───────────────────────────────
// Simple HTML dashboard you can open in a browser
router.get("/stats/html", (req, res) => {
  const stats = getStats();

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>BuildKit — Affiliate Stats</title>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; background: #0C0D10; color: #E4E6ED; padding: 40px; }
    h1 { color: #E8FF47; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #E8FF47; font-size: 16px; margin: 32px 0 12px; border-bottom: 1px solid #252830; padding-bottom: 8px; }
    .stat { display: inline-block; background: #13151A; border: 1px solid #252830; padding: 16px 24px; margin: 8px; border-radius: 4px; }
    .stat-val { font-size: 32px; color: #E8FF47; font-weight: bold; }
    .stat-lbl { font-size: 11px; color: #5A5F72; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; color: #5A5F72; font-size: 11px; letter-spacing: 2px; padding: 8px 12px; }
    td { padding: 10px 12px; border-bottom: 1px solid #1A1D24; font-size: 13px; }
    tr:hover td { background: #13151A; }
    .source { color: #E8FF47; }
    .refresh { color: #5A5F72; font-size: 12px; margin-top: 40px; }
  </style>
  <script>setTimeout(() => location.reload(), 30000);</script>
</head>
<body>
  <h1>⚡ BUILDKIT — Affiliate Dashboard</h1>
  <p style="color:#5A5F72;font-size:13px">Auto-refreshes every 30s</p>

  <div style="margin-top:24px">
    <div class="stat"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Total Clicks</div></div>
    <div class="stat"><div class="stat-val">${stats.last24h}</div><div class="stat-lbl">Last 24h</div></div>
    <div class="stat"><div class="stat-val">${stats.last7d}</div><div class="stat-lbl">Last 7 Days</div></div>
  </div>

  <h2>Top Affiliate Sources (7d)</h2>
  <table>
    <tr><th>Source</th><th>Clicks</th></tr>
    ${stats.topSources.map(s => `<tr><td class="source">${s.name}</td><td>${s.count}</td></tr>`).join("")}
  </table>

  <h2>Top Parts Clicked (7d)</h2>
  <table>
    <tr><th>Part</th><th>Clicks</th></tr>
    ${stats.topParts.map(p => `<tr><td>${p.name}</td><td>${p.count}</td></tr>`).join("")}
  </table>

  <h2>Build Tier Engagement (7d)</h2>
  <table>
    <tr><th>Tier</th><th>Clicks</th></tr>
    ${stats.topTiers.map(t => `<tr><td>${t.name}</td><td>${t.count}</td></tr>`).join("")}
  </table>

  <h2>Recent Clicks</h2>
  <table>
    <tr><th>Time</th><th>Part</th><th>Source</th><th>Car</th><th>Tier</th></tr>
    ${stats.recentClicks.map(c => `
      <tr>
        <td style="color:#5A5F72">${new Date(c.timestamp).toLocaleTimeString()}</td>
        <td>${c.part}</td>
        <td class="source">${c.source}</td>
        <td>${c.car}</td>
        <td>${c.buildTier}</td>
      </tr>`).join("")}
  </table>

  <p class="refresh">BuildKit Backend v1.0 — ${new Date().toLocaleString()}</p>
</body>
</html>`;

  res.send(html);
});

module.exports = router;
