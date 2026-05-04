/**
 * routes/ai.js
 * ─────────────────────────────────────────────────────────────────
 * AI endpoints — all Claude API calls live here, never on the client.
 * This protects your API key and lets you add rate limiting per user.
 */

const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const rateLimit = require("express-rate-limit");
const { buildAffiliateLinks } = require("../lib/affiliates");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Rate limiters ────────────────────────────────────────────────
// Generous limits — this is a free app, but we protect against abuse

const buildLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 build plans per hour per IP
  message: { error: "Too many build requests. Try again in an hour." },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 15,                    // 15 searches per minute per IP
  message: { error: "Too many searches. Slow down a little." },
});

const visionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many vision analyses. Try again in an hour." },
});

// ─── POST /api/ai/search ──────────────────────────────────────────
// Search for car listings across platforms
router.post("/search", searchLimiter, async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: "Query required" });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: "You are a car listing search API. Return ONLY valid JSON arrays with no markdown, no commentary.",
      messages: [{
        role: "user",
        content: `Generate 6 realistic used car listings matching: "${query}"
Return a JSON array where each item has:
{ "year": number, "make": string, "model": string, "trim": string, "mileage": number, "price": number, "location": string, "source": string, "condition": string, "description": string, "daysListed": number }

Sources must vary across: "Facebook Marketplace", "AutoTrader", "CarGurus", "Cars.com", "Craigslist", "Dealer"
Prices and mileage must be realistic for the year/make/model.
Condition: one of "Excellent", "Very Good", "Good", "Fair"
Descriptions should mention real details: title status, owners, any issues, notable features.`
      }],
    });

    const raw = msg.content[0].text.replace(/```json|```/g, "").trim();
    const listings = JSON.parse(raw);
    res.json({ listings });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed. Please try again." });
  }
});

// ─── POST /api/ai/analyze-vision ─────────────────────────────────
// Analyze inspiration images to detect build style
router.post("/analyze-vision", visionLimiter, async (req, res) => {
  const { images, buildType, car } = req.body;
  // images: array of { b64: string, mediaType: string }

  try {
    let content = [];

    if (images && images.length > 0) {
      content.push({
        type: "text",
        text: `Analyze these ${images.length} car inspiration image(s) for a ${car?.year || ""} ${car?.make || ""} ${car?.model || ""} build.${buildType ? ` Stated style: ${buildType}.` : ""} Identify the build aesthetic.`,
      });
      images.forEach(img => {
        content.push({
          type: "image",
          source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.b64 },
        });
      });
      content.push({
        type: "text",
        text: `Return ONLY this JSON (no markdown):
{"style":"string","vibe":"1-sentence description","keyElements":["el1","el2","el3","el4","el5"],"colorPalette":["color1","color2","color3"],"buildType":"string","estimatedBudgetRange":"$X,000–$X,000","notes":"2-sentence build philosophy"}`,
      });
    } else {
      content.push({
        type: "text",
        text: `For a ${buildType} build on a ${car?.year} ${car?.make} ${car?.model}, return ONLY this JSON:
{"style":"${buildType}","vibe":"1-sentence description","keyElements":["el1","el2","el3","el4","el5"],"colorPalette":["color1","color2","color3"],"buildType":"${buildType}","estimatedBudgetRange":"$X,000–$X,000","notes":"2-sentence build philosophy"}`,
      });
    }

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: "You are an expert car build stylist. Return only valid JSON.",
      messages: [{ role: "user", content }],
    });

    const raw = msg.content[0].text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: "Vision analysis failed." });
  }
});

// ─── POST /api/ai/generate-build ─────────────────────────────────
// Core endpoint — generates the full tiered build plan with affiliate links
router.post("/generate-build", buildLimiter, async (req, res) => {
  const { car, visionAnalysis, buildType, budget } = req.body;

  if (!car) return res.status(400).json({ error: "Car details required" });

  const context = visionAnalysis
    ? `Build style: ${visionAnalysis.style}. Key elements: ${visionAnalysis.keyElements?.join(", ")}. Notes: ${visionAnalysis.notes}`
    : `Build style: ${buildType || "Street Build"}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: "You are an expert automotive build planner with deep knowledge of aftermarket parts. Return ONLY valid JSON with no markdown.",
      messages: [{
        role: "user",
        content: `Create a complete car build plan:

Car: ${car.year} ${car.make} ${car.model} ${car.trim || ""}
Build context: ${context}
Total budget: $${budget?.toLocaleString() || "10,000"}

Return this exact JSON structure:
{
  "buildName": "Creative build name",
  "buildSummary": "2-sentence description of this build's philosophy",
  "categories": [
    {
      "name": "Category Name",
      "icon": "emoji",
      "tiers": {
        "budget": [
          {
            "part": "Exact part name",
            "brand": "Brand name",
            "price": 299,
            "searchQuery": "exact search string to find this on eBay/Amazon",
            "priority": "must",
            "note": "Why this part matters for this build"
          }
        ],
        "street": [ ... same structure ... ],
        "fullsend": [ ... same structure ... ]
      }
    }
  ],
  "tierSummaries": {
    "budget": "What this tier achieves",
    "street": "What this tier achieves",
    "fullsend": "What this tier achieves"
  },
  "proTips": ["tip1", "tip2", "tip3"]
}

Include ALL these categories: Suspension & Handling, Engine Performance, Intake & Exhaust, Brakes, Wheels & Tires, Exterior / Aero, Interior, Cooling System, Electronics & Safety.
Add "Forced Induction" category if build style calls for it.

Rules:
- 3–5 parts per tier per category
- Priority: "must" | "recommended" | "nice-to-have"
- Prices must be realistic USD market prices
- Budget tier = entry-level brands (Moog, Monroe, K&N, Flowmaster)
- Street tier = mid-range (Bilstein, Eibach, Mishimoto, Borla)
- Full Send tier = premium (Öhlins, Brembo, HKS, Akrapovič)
- searchQuery must be specific enough to find exact part on eBay/Amazon
- Parts must be appropriate for this specific car make/model/year`,
      }],
    });

    const raw = msg.content[0].text.replace(/```json|```/g, "").trim();
    const buildData = JSON.parse(raw);

    // ── Inject affiliate links server-side ────────────────────────
    // This is where the money is made. Every part gets tracked links.
    buildData.categories = buildData.categories.map(cat => {
      ["budget", "street", "fullsend"].forEach(tier => {
        if (!cat.tiers[tier]) return;
        cat.tiers[tier] = cat.tiers[tier].map(part => ({
          ...part,
          affiliateLinks: buildAffiliateLinks(part.searchQuery || part.part, cat.name),
        }));
      });
      return cat;
    });

    res.json(buildData);
  } catch (err) {
    console.error("Build generation error:", err);
    res.status(500).json({ error: "Build generation failed. Please try again." });
  }
});

module.exports = router;
