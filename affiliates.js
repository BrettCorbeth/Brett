/**
 * affiliates.js
 * ─────────────────────────────────────────────────────────────────
 * BuildKit Affiliate Link Engine
 *
 * Generates tracked affiliate URLs for every parts source.
 * Each click through these links earns a commission when purchased.
 *
 * Commission rates (approximate):
 *   Amazon       3–8%   — highest volume, lowest rate
 *   eBay Motors  1–4%   — huge inventory, great for used parts
 *   Summit Racing ~5%   — performance focus, higher AOV
 *   RockAuto     2–4%   — OEM & budget parts
 *   AutoZone/CJ  2–5%   — local pickup option, trust factor
 *   Jegs         3–6%   — muscle/drag parts
 *   TireRack     ~3%    — wheels & tires, very high AOV
 *
 * Sign-up links are in .env.example
 */

const AMAZON_TAG    = process.env.AMAZON_AFFILIATE_TAG  || "buildkit-20";
const EBAY_CAMPAIGN = process.env.EBAY_CAMPAIGN_ID      || "5338722222";
const SUMMIT_ID     = process.env.SUMMIT_AFFILIATE_ID   || "buildkit";
const ROCKAUTO_ID   = process.env.ROCKAUTO_AFFILIATE_ID || "buildkit";
const CJ_ID         = process.env.CJ_AFFILIATE_ID       || "buildkit";

/**
 * Build all affiliate source links for a given part search query.
 * Returns array of { name, url, commission, category } objects.
 */
function buildAffiliateLinks(searchQuery, partCategory = "") {
  const q = encodeURIComponent(searchQuery);
  const cat = partCategory.toLowerCase();

  const links = [];

  // ── Amazon Associates ──────────────────────────────────────────
  // Best for: universal parts, tools, accessories, interior
  links.push({
    name: "Amazon",
    icon: "📦",
    url: `https://www.amazon.com/s?k=${q}&tag=${AMAZON_TAG}`,
    commission: "3–8%",
    badge: "Fast Ship",
    priority: isAmazonGood(cat) ? 1 : 4,
  });

  // ── eBay Partner Network ───────────────────────────────────────
  // Best for: used OEM parts, rare/discontinued items, deals
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=6001`
    + `&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${EBAY_CAMPAIGN}`
    + `&customid=buildkit&toolid=10001&mkevt=1`;
  links.push({
    name: "eBay Motors",
    icon: "🔍",
    url: ebayUrl,
    commission: "1–4%",
    badge: "Huge Selection",
    priority: 2,
  });

  // ── Summit Racing ──────────────────────────────────────────────
  // Best for: performance parts, suspension, engine, exhaust
  if (isPerformancePart(cat)) {
    links.push({
      name: "Summit Racing",
      icon: "🏁",
      url: `https://www.summitracing.com/search?keyword=${q}&UTMSOURCE=affiliate&UTMMEDIUM=cpc&UTMCAMPAIGN=${SUMMIT_ID}`,
      commission: "~5%",
      badge: "Performance",
      priority: 1,
    });
  }

  // ── RockAuto ──────────────────────────────────────────────────
  // Best for: OEM replacement, maintenance, budget builds
  links.push({
    name: "RockAuto",
    icon: "🪨",
    url: `https://www.rockauto.com/en/partsearch/?partnum=${q}&ref=${ROCKAUTO_ID}`,
    commission: "2–4%",
    badge: "Best Price",
    priority: isOEMPart(cat) ? 1 : 5,
  });

  // ── Jegs ──────────────────────────────────────────────────────
  // Best for: muscle car, drag, American performance
  if (isDragOrMuscle(cat)) {
    links.push({
      name: "Jegs",
      icon: "🔥",
      url: `https://www.jegs.com/i/search#!#N=4294967117+${q}`,
      commission: "3–6%",
      badge: "Muscle/Drag",
      priority: 1,
    });
  }

  // ── Tire Rack ─────────────────────────────────────────────────
  // Best for: wheels, tires — very high average order value
  if (isWheelOrTire(cat)) {
    links.push({
      name: "Tire Rack",
      icon: "🛞",
      url: `https://www.tirerack.com/tires/TireSearchResults.jsp?search=${q}`,
      commission: "~3%",
      badge: "Top AOV",
      priority: 1,
    });
  }

  // ── AutoZone (via CJ Affiliate) ────────────────────────────────
  // Best for: local trust factor, same-day availability
  links.push({
    name: "AutoZone",
    icon: "🏪",
    url: `https://www.autozone.com/searchresult?searchText=${q}&cjevent=${CJ_ID}`,
    commission: "2–5%",
    badge: "Local Pickup",
    priority: isOEMPart(cat) ? 2 : 6,
  });

  // ── Advance Auto Parts (via CJ) ────────────────────────────────
  links.push({
    name: "Advance Auto",
    icon: "⚙️",
    url: `https://shop.advanceautoparts.com/find/${q}?cjevent=${CJ_ID}`,
    commission: "2–5%",
    badge: "Free Shipping $35+",
    priority: 7,
  });

  // Sort by priority (lower = better for this part type)
  links.sort((a, b) => a.priority - b.priority);

  // Return top 4 most relevant for this part
  return links.slice(0, 4).map(({ priority, ...rest }) => rest);
}

// ─── Category helpers ─────────────────────────────────────────────

function isPerformancePart(cat) {
  return /engine|exhaust|intake|suspension|brake|turbo|supercharg|intercool|forced/i.test(cat);
}

function isOEMPart(cat) {
  return /cooling|electric|sensor|oem|maintenance|replace/i.test(cat);
}

function isDragOrMuscle(cat) {
  return /drag|muscle|american|nitrous|trans|clutch/i.test(cat);
}

function isWheelOrTire(cat) {
  return /wheel|tire|tyre|rim/i.test(cat);
}

function isAmazonGood(cat) {
  return /interior|electronic|tool|accessory|light|audio/i.test(cat);
}

/**
 * Generate a tracked redirect URL through our own backend.
 * This lets us log every click for analytics and A/B testing.
 *
 * Usage: /api/affiliate/click?dest=<encoded_url>&part=<part_name>&source=<source>
 */
function buildTrackedUrl(baseUrl, partName, sourceName, req) {
  const base = `${req.protocol}://${req.get("host")}`;
  const params = new URLSearchParams({
    dest: baseUrl,
    part: partName,
    source: sourceName,
  });
  return `${base}/api/affiliate/click?${params.toString()}`;
}

module.exports = { buildAffiliateLinks, buildTrackedUrl };
