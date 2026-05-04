/**
 * server.js
 * ─────────────────────────────────────────────────────────────────
 * BuildKit Backend — Express API Server
 *
 * Deploy to Railway:   https://railway.app  (free tier available)
 * Deploy to Render:    https://render.com   (free tier, sleeps after 15min)
 * Deploy to Fly.io:    https://fly.io       (generous free tier)
 *
 * Local dev: npm run dev
 * Production: npm start
 */

require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const aiRoutes        = require("./routes/ai");
const affiliateRoutes = require("./routes/affiliate");

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────

app.use(express.json({ limit: "15mb" })); // 15mb for base64 images
app.use(express.urlencoded({ extended: true }));

// CORS — only allow your frontend domain
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5173",
    // Add your production domain here:
    // "https://buildkit.app",
    // "https://www.buildkit.app",
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

// Global rate limit — 200 requests per 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP." },
}));

// ─── Routes ───────────────────────────────────────────────────────

app.use("/api/ai",        aiRoutes);
app.use("/api/affiliate", affiliateRoutes);

// Health check — used by Railway/Render to confirm server is up
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    service:   "BuildKit API",
    version:   "1.0.0",
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || "development",
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    name:      "BuildKit API",
    version:   "1.0.0",
    endpoints: {
      search:        "POST /api/ai/search",
      analyzeVision: "POST /api/ai/analyze-vision",
      generateBuild: "POST /api/ai/generate-build",
      affiliateClick: "GET /api/affiliate/click",
      stats:         "GET /api/affiliate/stats",
      statsDashboard: "GET /api/affiliate/stats/html",
      health:        "GET /health",
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ⚡ BuildKit Backend running
  ───────────────────────────────────
  Local:   http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health
  Stats:   http://localhost:${PORT}/api/affiliate/stats/html
  Mode:    ${process.env.NODE_ENV || "development"}
  `);
});
