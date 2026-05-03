# ⚡ BuildKit — Deployment & Monetization Guide

## Project Structure

```
buildkit/
├── backend/                  ← Node/Express API (deploy to Railway)
│   ├── server.js             ← Entry point
│   ├── routes/
│   │   ├── ai.js             ← Claude API calls (protected)
│   │   └── affiliate.js      ← Click tracking + redirect
│   ├── lib/
│   │   ├── affiliates.js     ← Link builder (THE MONEY ENGINE)
│   │   └── analytics.js      ← Click tracking store
│   ├── .env.example          ← Copy to .env and fill in keys
│   └── package.json
└── frontend/                 ← React app (deploy to Vercel)
    ├── src/App.jsx           ← Full app UI
    ├── vite.config.js
    └── package.json
```

---

## Step 1 — Local Development

### Backend
```bash
cd backend
cp .env.example .env          # Fill in your ANTHROPIC_API_KEY
npm install
npm run dev                   # Runs on http://localhost:3001
```

### Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:3001
npm install
npm run dev                   # Runs on http://localhost:5173
```

Visit http://localhost:5173 — the app is fully functional.

---

## Step 2 — Deploy Backend to Railway (free → $5/mo)

1. Go to https://railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your backend folder (or push it as its own repo)
4. Add these environment variables in Railway dashboard:
   - ANTHROPIC_API_KEY = your key
   - NODE_ENV = production
   - FRONTEND_URL = https://your-app.vercel.app (add after step 3)
   - All affiliate IDs (see affiliate sign-ups below)
5. Railway auto-detects Node.js and deploys
6. Copy your Railway URL (e.g. https://buildkit-api.railway.app)

---

## Step 3 — Deploy Frontend to Vercel (free)

1. Go to https://vercel.com and sign up with GitHub
2. Click "New Project" → import your frontend folder
3. Add environment variable:
   - VITE_API_URL = https://buildkit-api.railway.app (your Railway URL)
4. Deploy — Vercel auto-builds the React app
5. Copy your Vercel URL (e.g. https://buildkit.vercel.app)
6. Go back to Railway and set FRONTEND_URL to your Vercel URL

Done. Your app is live.

---

## Step 4 — Sign Up for Affiliate Programs

This is where you make money. Sign up for all of these — it's free.

### Amazon Associates (3–8% commission)
- URL: https://affiliate-program.amazon.com
- Apply with your website URL
- Get your tracking tag (format: yourname-20)
- Put in AMAZON_AFFILIATE_TAG in .env

### eBay Partner Network (1–4% commission)
- URL: https://partnernetwork.ebay.com
- Create account → get Campaign ID
- Put in EBAY_CAMPAIGN_ID in .env

### Summit Racing (~5% commission)
- URL: https://www.summitracing.com/info/affiliate
- Apply via their affiliate page
- Get your affiliate ID
- Put in SUMMIT_AFFILIATE_ID in .env

### RockAuto (2–4% commission)
- URL: https://www.rockauto.com/en/affiliate/
- Simple sign-up
- Put in ROCKAUTO_AFFILIATE_ID in .env

### CJ Affiliate (covers AutoZone, Advance Auto, etc.)
- URL: https://www.cj.com
- Apply → search for "AutoZone" and "Advance Auto Parts" in their marketplace
- Join those specific programs
- Put your publisher ID in CJ_AFFILIATE_ID in .env

### Tire Rack (~3% commission, HIGH order value)
- URL: https://www.tirerack.com/content/tirerack/desktop/en/about/affiliate.html
- Wheels and tires = huge average order values ($800–2000+)

### Jegs (3–6% commission)
- URL: https://www.jegs.com/i/JEGS/affiliate/0
- Good for muscle/drag builds

### CarID (3–5% commission)
- URL: https://www.carid.com/affiliate-program.html
- Broad parts catalog

---

## Step 5 — View Your Analytics

Visit: https://your-railway-url.railway.app/api/affiliate/stats/html

This shows you:
- Total clicks and trend
- Which affiliate sources get most clicks
- Which parts are most clicked (= buyer intent)
- Which build tiers users engage with most
- Recent click log

Use this data to understand what your users want.

---

## Revenue Projections

### Conservative (1,000 monthly active users)
- Avg 5 affiliate clicks per session
- 3% conversion rate on clicks
- Avg $150 order value
- Avg 4% commission
- Monthly revenue: 1,000 × 5 × 0.03 × $150 × 0.04 = **$900/mo**

### Growth (10,000 monthly active users)
- Same math = **$9,000/mo**

### At Scale (50,000 MAU)
- **$45,000/mo** — and costs are still just ~$5/mo on Railway + Vercel

### Other Revenue Streams to Add Later

1. **Shop Referrals** — Add a "Find a local installer" button.
   Charge local performance shops $50–200 per qualified lead.
   Use a simple Typeform or Cal.com for the referral flow.

2. **Build PDFs** — "Export your build plan as a PDF" (nice-to-have feature).
   Free to generate, valuable for users sharing their build.

3. **Sponsored Listings** — Once you have traffic, brands like Mishimoto,
   Eibach, and Flowmaster will pay to be the "recommended" brand for
   certain parts. Start at $500/mo per brand slot.

4. **SEO Pages** — Generate static pages like:
   "Best mods for 2019 Subaru WRX STI under $5,000"
   These rank on Google and drive free traffic → affiliate clicks.

---

## For Production — Swap In-Memory Store with Supabase

The analytics currently store clicks in memory (resets on restart).
For persistent data, replace analytics.js with Supabase:

```bash
npm install @supabase/supabase-js
```

Create a `clicks` table in Supabase:
```sql
create table clicks (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamptz default now(),
  part text,
  source text,
  car text,
  build_tier text,
  session_id text,
  ip text
);
```

Then replace the `clicks.push(event)` line in analytics.js with:
```js
await supabase.from('clicks').insert(event);
```

Supabase free tier = 500MB storage, 2GB bandwidth — plenty to start.

---

## Domain

Buy a domain on Namecheap (~$12/yr) and point it to Vercel.
Good names: buildkit.app, buildmyride.com, carbuildr.com, partstack.io
