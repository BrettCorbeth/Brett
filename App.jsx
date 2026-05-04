import { useState, useRef, useCallback } from "react";

// ─── Config ────────────────────────────────────────────────────────
// Change this to your deployed backend URL for production
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const toB64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// Session ID — persists for this browser session (for analytics attribution)
const SESSION_ID = Math.random().toString(36).slice(2);

// ─── API helpers ───────────────────────────────────────────────────
const api = {
  search: (query) =>
    fetch(`${API}/api/ai/search`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }).then(r => r.json()),

  analyzeVision: (images, buildType, car) =>
    fetch(`${API}/api/ai/analyze-vision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, buildType, car }),
    }).then(r => r.json()),

  generateBuild: (car, visionAnalysis, buildType, budget) =>
    fetch(`${API}/api/ai/generate-build`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ car, visionAnalysis, buildType, budget }),
    }).then(r => r.json()),

  // Affiliate click — goes through backend for tracking then redirects
  affiliateClick: (dest, part, source, car, tier) => {
    const params = new URLSearchParams({
      dest, part, source,
      car: car ? `${car.year} ${car.make} ${car.model}` : "unknown",
      tier, session: SESSION_ID,
    });
    window.open(`${API}/api/affiliate/click?${params}`, "_blank", "noopener");
  },
};

// ─── Constants ─────────────────────────────────────────────────────
const TIERS = [
  { id: "budget",   label: "Weekend Warrior", color: "#4ADE80", icon: "🔧", desc: "Best bang for buck" },
  { id: "street",   label: "Street Build",    color: "#FB923C", icon: "🏁", desc: "Serious upgrades, daily-able" },
  { id: "fullsend", label: "Full Send",        color: "#F472B6", icon: "🔥", desc: "No compromises" },
];

const BUILD_TYPES = [
  "JDM / Import", "Euro Spec", "American Muscle", "Stance / Static",
  "Off-Road / Lifted", "Track / Time Attack", "Restomod / Classic",
  "Drag Build", "Drift", "Daily Driver+",
];

// ─── Styles ────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0C0D10; --surface:#13151A; --surface2:#1A1D24;
    --border:#252830; --text:#E4E6ED; --muted:#5A5F72; --accent:#E8FF47; --danger:#FF4D6D;
  }
  body { background:var(--bg); color:var(--text); font-family:'Barlow',sans-serif; }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:var(--bg)} ::-webkit-scrollbar-thumb{background:var(--border)}
  .app{min-height:100vh;display:flex;flex-direction:column}
  .nav{display:flex;align-items:center;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:50;padding:0 32px}
  .nav-logo{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:var(--accent);padding:18px 24px 18px 0;border-right:1px solid var(--border);margin-right:8px}
  .nav-tab{padding:20px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:color .2s,border-color .2s;background:none;border-left:none;border-right:none;border-top:none;margin-bottom:-1px}
  .nav-tab:hover{color:var(--text)} .nav-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
  .section{padding:40px 32px;max-width:1200px;margin:0 auto;width:100%}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:24px}
  .input{width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:12px 16px;font-family:'Barlow',sans-serif;font-size:14px;outline:none;border-radius:3px;transition:border-color .2s}
  .input:focus{border-color:var(--accent)} .input::placeholder{color:var(--muted)}
  select.input{cursor:pointer} select.input option{background:var(--surface2)}
  .btn{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;padding:12px 24px;border-radius:3px;transition:all .15s;border:none}
  .btn-accent{background:var(--accent);color:#0C0D10} .btn-accent:hover{background:#d4eb00;transform:translateY(-1px)} .btn-accent:disabled{opacity:.4;cursor:not-allowed;transform:none}
  .btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)} .btn-outline:hover{border-color:var(--text)}
  .btn-ghost{background:transparent;color:var(--muted);border:1px solid transparent} .btn-ghost:hover{color:var(--text);border-color:var(--border)}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
  .label{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;display:block}
  .h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(36px,6vw,72px);font-weight:900;letter-spacing:-0.5px;line-height:1;text-transform:uppercase}
  .h2{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
  .h3{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .badge{display:inline-block;padding:3px 10px;border-radius:2px;font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .tag{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:3px;font-size:13px;color:var(--text);cursor:pointer;transition:all .15s}
  .tag:hover{border-color:var(--accent);color:var(--accent)} .tag.selected{background:rgba(232,255,71,.1);border-color:var(--accent);color:var(--accent)}
  .dropzone{border:2px dashed var(--border);border-radius:6px;padding:48px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s}
  .dropzone:hover,.dropzone.drag-over{border-color:var(--accent);background:rgba(232,255,71,.03)}
  .inspo-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:3px;display:block}
  .budget-bar{height:8px;background:var(--surface2);border-radius:4px;overflow:hidden}
  .budget-fill{height:100%;border-radius:4px;transition:width .6s cubic-bezier(.34,1.2,.64,1)}
  .spinner{width:24px;height:24px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:spin .7s linear infinite;display:inline-block}
  @keyframes spin{to{transform:rotate(360deg)}}
  .pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 1.5s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
  .search-result{padding:14px 16px;border:1px solid var(--border);border-radius:3px;cursor:pointer;transition:all .15s;background:var(--surface2);display:flex;justify-content:space-between;align-items:flex-start}
  .search-result:hover{border-color:var(--accent);background:rgba(232,255,71,.04)}
  .part-row{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}
  .part-row:last-child{border-bottom:none}
  .part-check{width:18px;height:18px;border-radius:3px;border:2px solid var(--border);background:transparent;cursor:pointer;flex-shrink:0;margin-top:2px;appearance:none;position:relative;transition:all .15s}
  .part-check:checked{background:var(--accent);border-color:var(--accent)}
  .part-check:checked::after{content:'✓';position:absolute;top:-2px;left:2px;font-size:12px;color:#0C0D10;font-weight:900}

  /* Affiliate link button */
  .aff-btn{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--border);border-radius:2px;background:transparent;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:all .15s;text-decoration:none}
  .aff-btn:hover{border-color:var(--accent);color:var(--accent);background:rgba(232,255,71,.06)}
  .aff-btn .commission{font-size:9px;color:#4ADE80;margin-left:2px}

  @media(max-width:768px){.grid-2,.grid-3{grid-template-columns:1fr}.section{padding:24px 16px}.nav{padding:0 16px}}
`;

// ─── Components ────────────────────────────────────────────────────

function AffiliateButtons({ links, part, car, tier }) {
  if (!links || links.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
      {links.map((link, i) => (
        <button key={i} className="aff-btn"
          onClick={() => api.affiliateClick(link.url, part, link.name, car, tier)}
          title={`~${link.commission} commission`}>
          {link.icon} {link.name}
          {link.badge && <span style={{ color: "#FB923C", fontSize: "9px" }}>{link.badge}</span>}
          <span className="commission">{link.commission}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("garage");
  const [garage, setGarage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [inspoImages, setInspoImages] = useState([]);
  const [buildType, setBuildType] = useState("");
  const [activeTier, setActiveTier] = useState("street");
  const [buildData, setBuildData] = useState(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [checkedParts, setCheckedParts] = useState({});
  const [budget, setBudget] = useState(5000);
  const [visionAnalysis, setVisionAnalysis] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [manualCar, setManualCar] = useState({ year: "", make: "", model: "", trim: "", mileage: "" });
  const [addMode, setAddMode] = useState("manual");
  const fileRef = useRef();

  // ── Garage ──────────────────────────────────────────────────────
  const searchCar = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResults([]);
    const data = await api.search(searchQuery);
    if (data.error) setSearchError(data.error);
    else setSearchResults(data.listings || []);
    setSearchLoading(false);
  };

  const addManualCar = () => {
    if (!manualCar.year || !manualCar.make || !manualCar.model) return;
    setGarage({ ...manualCar, source: "My Garage", price: 0 });
    setTab("vision");
  };

  // ── Vision ──────────────────────────────────────────────────────
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith("image/"));
    await addImages(files);
  }, []);

  const addImages = async (files) => {
    const newImgs = await Promise.all(files.slice(0, 6).map(async f => ({
      id: Date.now() + Math.random(),
      url: URL.createObjectURL(f),
      b64: await toB64(f),
      mediaType: f.type,
      name: f.name,
    })));
    setInspoImages(prev => [...prev, ...newImgs].slice(0, 8));
  };

  const analyzeVision = async () => {
    setVisionLoading(true);
    setVisionAnalysis(null);
    const images = inspoImages.map(i => ({ b64: i.b64, mediaType: i.mediaType }));
    const data = await api.analyzeVision(images, buildType, garage);
    if (!data.error) setVisionAnalysis(data);
    setVisionLoading(false);
  };

  // ── Build ────────────────────────────────────────────────────────
  const generateBuild = async () => {
    if (!garage) return;
    setBuildLoading(true);
    setBuildError("");
    setBuildData(null);
    const data = await api.generateBuild(garage, visionAnalysis, buildType, budget);
    if (data.error) { setBuildError(data.error); setBuildLoading(false); return; }
    setBuildData(data);
    setBuildLoading(false);
    setTab("build");
  };

  // ── Budget ───────────────────────────────────────────────────────
  const getTierTotal = (tier) => {
    if (!buildData) return 0;
    return buildData.categories.reduce((sum, cat) =>
      sum + (cat.tiers[tier] || []).reduce((s, p) => s + (p.price || 0), 0), 0);
  };
  const getCheckedTotal = (tier) => {
    if (!buildData) return 0;
    return buildData.categories.reduce((sum, cat) =>
      sum + (cat.tiers[tier] || [])
        .filter((_, pi) => checkedParts[`${cat.name}-${tier}-${pi}`])
        .reduce((s, p) => s + p.price, 0), 0);
  };

  const TIER = TIERS.find(t => t.id === activeTier);
  const tierTotal = getTierTotal(activeTier);
  const checkedTotal = getCheckedTotal(activeTier);
  const carLabel = garage ? `${garage.year} ${garage.make} ${garage.model}` : "";

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo">⚡ BUILDKIT</div>
          {[
            { id: "garage", label: "01 · Garage" },
            { id: "vision", label: "02 · Vision" },
            { id: "build",  label: "03 · Build" },
          ].map(t => (
            <button key={t.id} className={`nav-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          {garage && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="pulse-dot" />
              <span style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "1px" }}>
                {carLabel}
              </span>
            </div>
          )}
        </nav>

        {/* ══ GARAGE ══ */}
        {tab === "garage" && (
          <div className="section">
            <div style={{ marginBottom: "40px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "12px" }}>Step 01</div>
              <div className="h1" style={{ marginBottom: "12px" }}>Your Build<br /><span style={{ color: "var(--accent)" }}>Starts Here</span></div>
              <p style={{ color: "var(--muted)", fontSize: "15px", maxWidth: "500px", lineHeight: 1.6 }}>
                Add a car you already own, or search across Facebook Marketplace, AutoTrader, CarGurus, and Cars.com.
              </p>
            </div>

            {garage && (
              <div className="card" style={{ marginBottom: "24px", borderColor: "var(--accent)", background: "rgba(232,255,71,.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11px", letterSpacing: "3px", color: "var(--accent)", marginBottom: "6px" }}>CURRENT BUILD CAR</div>
                    <div className="h2">{carLabel} {garage.trim || ""}</div>
                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                      {garage.mileage ? `${Number(garage.mileage).toLocaleString()} mi · ` : ""}
                      {garage.price ? `$${Number(garage.price).toLocaleString()} · ` : ""}
                      {garage.source}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button className="btn btn-accent" onClick={() => setTab("vision")}>Continue →</button>
                    <button className="btn btn-ghost" onClick={() => { setGarage(null); setBuildData(null); }}>Change</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              <button className={`btn ${addMode === "manual" ? "btn-accent" : "btn-outline"}`} onClick={() => setAddMode("manual")}>I Already Own a Car</button>
              <button className={`btn ${addMode === "search" ? "btn-accent" : "btn-outline"}`} onClick={() => setAddMode("search")}>Search for a Car</button>
            </div>

            {addMode === "manual" && (
              <div className="card">
                <div className="h3" style={{ marginBottom: "24px" }}>Add Your Car</div>
                <div className="grid-2" style={{ marginBottom: "16px" }}>
                  {[
                    { key: "year", label: "Year", ph: "2018" },
                    { key: "make", label: "Make", ph: "Subaru" },
                    { key: "model", label: "Model", ph: "WRX STI" },
                    { key: "trim", label: "Trim (optional)", ph: "Limited" },
                    { key: "mileage", label: "Mileage", ph: "65,000" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input className="input" placeholder={f.ph} value={manualCar[f.key]}
                        onChange={e => setManualCar(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-accent" onClick={addManualCar}
                  disabled={!manualCar.year || !manualCar.make || !manualCar.model}>
                  Add to Garage →
                </button>
              </div>
            )}

            {addMode === "search" && (
              <div>
                <div className="card" style={{ marginBottom: "16px" }}>
                  <div className="h3" style={{ marginBottom: "8px" }}>Search Listings</div>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
                    Searches AutoTrader, Facebook Marketplace, CarGurus, Cars.com & Craigslist. Results powered by AI market data.
                  </p>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input className="input" placeholder='e.g. "2018 Subaru WRX under $25k Texas"'
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchCar()} />
                    <button className="btn btn-accent" onClick={searchCar} disabled={searchLoading} style={{ whiteSpace: "nowrap" }}>
                      {searchLoading ? "Searching…" : "Search →"}
                    </button>
                  </div>
                  {searchError && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>{searchError}</p>}
                </div>
                {searchLoading && (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    <div className="spinner" style={{ margin: "0 auto 16px" }} />
                    <div style={{ fontSize: "13px", letterSpacing: "2px" }}>SCANNING LISTINGS…</div>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {searchResults.map((car, i) => (
                      <div key={i} className="search-result" onClick={() => { setGarage(car); setTab("vision"); }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "18px", fontWeight: 700 }}>
                            {car.year} {car.make} {car.model} {car.trim}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                            {Number(car.mileage).toLocaleString()} mi · {car.location} · <span style={{ color: "var(--accent)" }}>{car.source}</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.5 }}>{car.description}</div>
                          <div style={{ fontSize: "11px", color: "#4ADE80", marginTop: "4px" }}>{car.condition} condition · Listed {car.daysListed} days ago</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "24px" }}>
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "24px", fontWeight: 900, color: "var(--accent)" }}>
                            ${Number(car.price).toLocaleString()}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "8px" }}>Select →</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ VISION ══ */}
        {tab === "vision" && (
          <div className="section">
            <div style={{ marginBottom: "40px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "12px" }}>Step 02</div>
              <div className="h1" style={{ marginBottom: "12px" }}>Define Your<br /><span style={{ color: "var(--accent)" }}>Vision</span></div>
              <p style={{ color: "var(--muted)", fontSize: "15px", maxWidth: "480px", lineHeight: 1.6 }}>Drop inspiration images and choose a build style. AI reads the vibe and maps it to real parts.</p>
            </div>

            {!garage && (
              <div className="card" style={{ marginBottom: "24px", borderColor: "var(--danger)" }}>
                <p style={{ color: "var(--danger)", fontSize: "14px" }}>⚠️ Add your car in Step 01 first.</p>
              </div>
            )}

            <div className="grid-2" style={{ gap: "32px", alignItems: "start" }}>
              <div>
                <div className="h3" style={{ marginBottom: "16px" }}>Inspiration Images</div>
                <div
                  className={`dropzone ${dragOver ? "drag-over" : ""}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "12px" }}>📸</div>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "16px", fontWeight: 700, letterSpacing: "2px", marginBottom: "8px" }}>DROP IMAGES HERE</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Cars, wheels, body kits, interiors — anything that inspires your build</div>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={e => addImages([...e.target.files])} />
                </div>
                {inspoImages.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {inspoImages.map(img => (
                      <div key={img.id} style={{ position: "relative" }}>
                        <img src={img.url} alt="inspo" className="inspo-img" />
                        <button onClick={() => setInspoImages(p => p.filter(i => i.id !== img.id))}
                          style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,.8)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontSize: "14px", lineHeight: "24px" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="card">
                  <div className="h3" style={{ marginBottom: "16px" }}>Build Style</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {BUILD_TYPES.map(bt => (
                      <button key={bt} className={`tag ${buildType === bt ? "selected" : ""}`} onClick={() => setBuildType(bt)}>{bt}</button>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="h3" style={{ marginBottom: "16px" }}>Total Build Budget</div>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "40px", fontWeight: 900, color: "var(--accent)", marginBottom: "12px" }}>
                    ${budget.toLocaleString()}
                  </div>
                  <input type="range" min={500} max={100000} step={500} value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--accent)", marginBottom: "8px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", letterSpacing: "1px" }}>
                    <span>$500</span><span>$25K</span><span>$50K</span><span>$100K</span>
                  </div>
                </div>

                {visionAnalysis && (
                  <div className="card" style={{ borderColor: "var(--accent)", background: "rgba(232,255,71,.04)" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "3px", color: "var(--accent)", marginBottom: "12px" }}>AI VISION ANALYSIS</div>
                    <div className="h3" style={{ marginBottom: "6px" }}>{visionAnalysis.style}</div>
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>{visionAnalysis.vibe}</div>
                    {visionAnalysis.estimatedBudgetRange && (
                      <div style={{ fontSize: "13px", color: "#4ADE80", marginBottom: "12px" }}>Estimated range: {visionAnalysis.estimatedBudgetRange}</div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                      {(visionAnalysis.keyElements || []).map((el, i) => (
                        <span key={i} className="badge" style={{ background: "rgba(232,255,71,.1)", color: "var(--accent)", border: "1px solid rgba(232,255,71,.3)" }}>{el}</span>
                      ))}
                    </div>
                    {visionAnalysis.notes && <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>{visionAnalysis.notes}</div>}
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {(inspoImages.length > 0 || buildType) && (
                    <button className="btn btn-outline" onClick={analyzeVision} disabled={visionLoading || !garage}>
                      {visionLoading ? "Analyzing…" : "Analyze Vision"}
                    </button>
                  )}
                  <button className="btn btn-accent" onClick={generateBuild}
                    disabled={!garage || buildLoading || (!buildType && inspoImages.length === 0)}>
                    {buildLoading ? "Generating Plan…" : "Generate Build Plan →"}
                  </button>
                </div>

                {buildLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--muted)", fontSize: "13px" }}>
                    <div className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px" }} />
                    Sourcing parts across the web for your {buildType || "build"}…
                  </div>
                )}
                {buildError && <p style={{ color: "var(--danger)", fontSize: "13px" }}>{buildError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ══ BUILD ══ */}
        {tab === "build" && (
          <div className="section">
            {!buildData ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
                <div className="h2" style={{ marginBottom: "12px" }}>No Build Plan Yet</div>
                <p style={{ color: "var(--muted)", marginBottom: "24px" }}>Complete Steps 01 and 02 to generate your build plan.</p>
                <button className="btn btn-accent" onClick={() => setTab(garage ? "vision" : "garage")}>
                  {garage ? "Go to Vision →" : "Add Your Car →"}
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "8px" }}>
                    Build Plan · {carLabel}
                  </div>
                  <div className="h1" style={{ marginBottom: "8px" }}>{buildData.buildName}</div>
                  <p style={{ color: "var(--muted)", fontSize: "14px", maxWidth: "600px", lineHeight: 1.6 }}>{buildData.buildSummary}</p>
                </div>

                {/* Tier picker */}
                <div className="grid-3" style={{ marginBottom: "32px" }}>
                  {TIERS.map(t => {
                    const total = getTierTotal(t.id);
                    const over = total > budget;
                    const active = activeTier === t.id;
                    return (
                      <div key={t.id} className="card" style={{ cursor: "pointer", borderColor: active ? t.color : "var(--border)", background: active ? `${t.color}0D` : "var(--surface)" }}
                        onClick={() => setActiveTier(t.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <span style={{ fontSize: "20px" }}>{t.icon}</span>
                          <div>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "15px", fontWeight: 800, letterSpacing: "1px", color: active ? t.color : "var(--text)" }}>{t.label}</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>{t.desc}</div>
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "28px", fontWeight: 900, color: over ? "var(--danger)" : t.color, marginBottom: "8px" }}>
                          ${total.toLocaleString()}
                        </div>
                        <div className="budget-bar">
                          <div className="budget-fill" style={{ width: `${Math.min(100, (total/budget)*100)}%`, background: over ? "var(--danger)" : t.color }} />
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                          {over ? `$${(total-budget).toLocaleString()} over budget` : `$${(budget-total).toLocaleString()} left`}
                        </div>
                        {buildData.tierSummaries?.[t.id] && (
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "10px", lineHeight: 1.5 }}>{buildData.tierSummaries[t.id]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Active tier bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", padding: "16px 20px", border: `1px solid ${TIER.color}`, borderRadius: "4px", background: `${TIER.color}0A` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>{TIER.icon}</span>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "20px", fontWeight: 800, color: TIER.color }}>{TIER.label}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>Check off parts as you source them</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "13px", color: "var(--muted)", letterSpacing: "1px" }}>SELECTED / TIER TOTAL</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "22px", fontWeight: 900, color: TIER.color }}>
                      ${checkedTotal.toLocaleString()} <span style={{ fontSize: "14px", color: "var(--muted)" }}>/ ${tierTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Categories */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {buildData.categories.map((cat, ci) => {
                    const parts = cat.tiers[activeTier] || [];
                    if (parts.length === 0) return null;
                    const catTotal = parts.reduce((s, p) => s + (p.price || 0), 0);
                    const catChecked = parts.filter((_, pi) => checkedParts[`${cat.name}-${activeTier}-${pi}`]).reduce((s, p) => s + p.price, 0);

                    return (
                      <div key={ci} style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "16px" }}>{cat.icon}</span>
                            <div className="h3" style={{ fontSize: "15px" }}>{cat.name}</div>
                          </div>
                          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                            {catChecked > 0 && <span style={{ fontSize: "13px", color: TIER.color, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>${catChecked.toLocaleString()} picked</span>}
                            <span style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "'Barlow Condensed',sans-serif" }}>${catTotal.toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ padding: "0 20px", background: "var(--surface)" }}>
                          {parts.map((part, pi) => {
                            const key = `${cat.name}-${activeTier}-${pi}`;
                            const isChecked = !!checkedParts[key];
                            const pColor = part.priority === "must" ? "#EF4444" : part.priority === "recommended" ? "#F59E0B" : "var(--muted)";

                            return (
                              <div key={pi} className="part-row" style={{ opacity: isChecked ? 1 : 0.8 }}>
                                <input type="checkbox" className="part-check" checked={isChecked}
                                  onChange={() => setCheckedParts(p => ({ ...p, [key]: !p[key] }))} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "16px", fontWeight: 700, color: isChecked ? TIER.color : "var(--text)" }}>
                                      {part.part}
                                    </span>
                                    {part.brand && <span style={{ fontSize: "12px", color: "var(--muted)" }}>· {part.brand}</span>}
                                    <span className="badge" style={{ background: `${pColor}1A`, color: pColor, border: `1px solid ${pColor}44`, fontSize: "9px" }}>
                                      {part.priority}
                                    </span>
                                  </div>
                                  {part.note && <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "6px" }}>{part.note}</div>}

                                  {/* Affiliate buttons — this is where revenue happens */}
                                  <AffiliateButtons
                                    links={part.affiliateLinks}
                                    part={part.part}
                                    car={garage}
                                    tier={activeTier}
                                  />
                                </div>
                                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "20px", fontWeight: 800, color: isChecked ? TIER.color : "var(--text)", flexShrink: 0, marginLeft: "12px" }}>
                                  ${(part.price || 0).toLocaleString()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pro Tips */}
                {buildData.proTips?.length > 0 && (
                  <div className="card" style={{ marginTop: "24px", borderColor: "#F59E0B", background: "rgba(245,158,11,.05)" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#F59E0B", marginBottom: "12px" }}>💡 PRO TIPS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {buildData.proTips.map((tip, i) => (
                        <div key={i} style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, paddingLeft: "12px", borderLeft: "2px solid #F59E0B44" }}>{tip}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sticky footer */}
                <div style={{ position: "sticky", bottom: 0, padding: "16px 24px", background: "var(--bg)", borderTop: "1px solid var(--border)", marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", letterSpacing: "2px", color: "var(--muted)", textTransform: "uppercase" }}>Parts Selected</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "28px", fontWeight: 900, color: TIER.color }}>
                      ${checkedTotal.toLocaleString()}
                      <span style={{ fontSize: "16px", color: "var(--muted)", marginLeft: "8px" }}>/ ${budget.toLocaleString()} budget</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, maxWidth: "300px" }}>
                    <div className="budget-bar" style={{ height: "10px" }}>
                      <div className="budget-fill" style={{ width: `${Math.min(100,(checkedTotal/budget)*100)}%`, background: checkedTotal > budget ? "var(--danger)" : TIER.color }} />
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                      {checkedTotal > budget
                        ? `$${(checkedTotal-budget).toLocaleString()} over budget`
                        : `$${(budget-checkedTotal).toLocaleString()} remaining`}
                    </div>
                  </div>
                  <button className="btn btn-outline" onClick={() => setTab("vision")}>← Adjust Vision</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
