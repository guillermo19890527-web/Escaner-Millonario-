import { useState, useEffect, useRef, useCallback } from "react";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "millon-watchlist-v2";
function loadWatchlist() {
  try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; }
  catch { return []; }
}
function saveWatchlist(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// ─── QUOTE (via API route) ────────────────────────────────────────────────────
async function fetchQuote(symbol) {
  try {
    const res = await fetch(`/api/quote?symbol=${symbol}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return null; }
}

// ─── TICKER EXTRACTOR FROM IMAGE TEXT ────────────────────────────────────────
function extractTickersFromText(text) {
  // Match typical US stock tickers: 1-5 uppercase letters
  const matches = text.match(/\b[A-Z]{1,5}\b/g) || [];
  // Filter out common non-ticker words
  const blacklist = new Set(["THE","AND","FOR","NYSE","ETF","SEC","CEO","IPO","EPS","PE","AI","IT","US","USD","ETF","A","I"]);
  return [...new Set(matches.filter(t => !blacklist.has(t)))];
}

// ─── FILTROS ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "precio",        label: "Precio $2–$5",       icon: "💲", check: (v) => v.precio >= 2 && v.precio <= 5 },
  { id: "recomendacion", label: "Recom 1.0–2.0",      icon: "⭐", check: (v) => v.recomendacion >= 1 && v.recomendacion <= 2 },
  { id: "target",        label: "Target +100%",       icon: "🎯", check: (v) => v.target >= v.precio * 2 },
  { id: "capitalizacion",label: "Cap OK",             icon: "🏦", check: (v) => ["large","mid","small","micro"].includes(v.capitalizacion) },
  { id: "acciones",      label: ">20M acciones",      icon: "📊", check: (v) => v.acciones >= 20 },
  { id: "volumen",       label: "Vol >500K",          icon: "📈", check: (v) => v.volumen >= 500 },
  { id: "volatilidad",   label: "Volatilidad >3%",    icon: "⚡", check: (v) => v.volatilidad >= 3 },
  { id: "institucional", label: ">10% Institucional", icon: "🏛️", check: (v) => v.institucional >= 10 },
];

function scoreStock(s) {
  let p = 0;
  FILTERS.forEach(f => { try { if (f.check(s)) p++; } catch {} });
  return p;
}

function verdictStyle(score) {
  if (score === 8) return { color: "#22c55e", label: "JOYA 💎",    glow: "#22c55e" };
  if (score >= 6)  return { color: "#84cc16", label: "FUERTE 🚀",  glow: "#84cc16" };
  if (score >= 4)  return { color: "#f59e0b", label: "REVISAR ⚠️", glow: "#f59e0b" };
  return              { color: "#ef4444", label: "DÉBIL ❌",    glow: "#ef4444" };
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(15,23,42,0.8)",
  border: "1px solid rgba(100,116,139,0.25)",
  borderRadius: 7, color: "#e2e8f0",
  fontSize: 14, padding: "9px 12px",
  outline: "none", marginTop: 4,
};

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", letterSpacing: 1 }}>{children}</div>;
}

function btnSm(color) {
  return {
    background: "transparent", border: `1px solid ${color}40`,
    borderRadius: 6, color, fontSize: 11,
    padding: "4px 10px", cursor: "pointer", fontFamily: "monospace",
  };
}

// ─── IMAGE SCANNER MODAL ─────────────────────────────────────────────────────
function ImageScanner({ onAddTickers, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState([]);
  const [manualText, setManualText] = useState("");
  const fileRef = useRef();

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const scanImage = async () => {
    if (!preview && !manualText) return;
    setScanning(true);
    setFound([]);
    setSelected([]);

    // Extract tickers from manual text or image filename hint
    let tickers = [];
    if (manualText) {
      tickers = extractTickersFromText(manualText.toUpperCase());
    } else {
      // For image: ask user to also type the text visible, or show instructions
      tickers = extractTickersFromText(manualText.toUpperCase());
    }

    // Validate tickers against Yahoo Finance via our API
    const valid = [];
    await Promise.all(tickers.map(async (t) => {
      const q = await fetchQuote(t);
      if (q && q.price) valid.push({ ticker: t, name: q.shortName, price: q.price });
    }));

    setFound(valid);
    setSelected(valid.map(v => v.ticker));
    setScanning(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) processFile(file);
  };

  const toggleTicker = (t) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleAdd = () => {
    const toAdd = found.filter(f => selected.includes(f.ticker));
    onAddTickers(toAdd);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#0d1526", border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 0 60px rgba(34,197,94,0.1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#f8fafc", fontFamily: "Georgia, serif" }}>
            📸 Escáner de Imagen
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <p style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace", marginBottom: 16 }}>
          Sube una imagen con tickers (screenshot de watchlist, artículo, etc.) y pega el texto visible abajo para detectar automáticamente.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? "#22c55e" : "rgba(34,197,94,0.3)"}`,
            borderRadius: 12, padding: "24px 16px",
            textAlign: "center", cursor: "pointer",
            background: dragging ? "rgba(34,197,94,0.05)" : "transparent",
            transition: "all 0.2s", marginBottom: 16,
          }}
        >
          {preview ? (
            <img src={preview} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
          ) : (
            <>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
              <div style={{ fontSize: 13, color: "#475569", fontFamily: "monospace" }}>
                Toca para subir imagen
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                Screenshot de watchlist, noticias, etc.
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => processFile(e.target.files[0])} />
        </div>

        {/* Manual text input */}
        <FieldLabel>📝 Pega o escribe los tickers/texto de la imagen</FieldLabel>
        <textarea
          value={manualText}
          onChange={e => setManualText(e.target.value)}
          placeholder={"Ej: SOFI HOOD MARA RIOT CLSK\nO pega texto completo del artículo..."}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", marginBottom: 16 }}
        />

        <button
          onClick={scanImage}
          disabled={scanning || (!preview && !manualText)}
          style={{
            width: "100%", padding: "12px",
            background: scanning ? "rgba(34,197,94,0.3)" : "linear-gradient(135deg,#22c55e,#16a34a)",
            border: "none", borderRadius: 8,
            color: "#0a0f1e", fontWeight: 700, cursor: scanning ? "wait" : "pointer",
            fontSize: 14, marginBottom: 20,
          }}
        >
          {scanning ? "🔍 Escaneando..." : "🔍 Detectar Tickers"}
        </button>

        {/* Results */}
        {found.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "monospace", marginBottom: 10 }}>
              ✅ {found.length} ticker{found.length > 1 ? "s" : ""} válido{found.length > 1 ? "s" : ""} encontrado{found.length > 1 ? "s" : ""}:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {found.map(f => (
                <div key={f.ticker}
                  onClick={() => toggleTicker(f.ticker)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: selected.includes(f.ticker) ? "rgba(34,197,94,0.1)" : "rgba(15,23,42,0.5)",
                    border: `1px solid ${selected.includes(f.ticker) ? "rgba(34,197,94,0.4)" : "rgba(51,65,85,0.4)"}`,
                    borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{f.ticker}</span>
                    <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{f.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "monospace", color: "#22c55e", fontSize: 14 }}>${f.price?.toFixed(2)}</span>
                    <span style={{ fontSize: 16 }}>{selected.includes(f.ticker) ? "✅" : "⬜"}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={selected.length === 0}
              style={{
                width: "100%", padding: "12px",
                background: selected.length > 0 ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(34,197,94,0.2)",
                border: "none", borderRadius: 8,
                color: "#0a0f1e", fontWeight: 700,
                cursor: selected.length > 0 ? "pointer" : "default",
                fontSize: 14,
              }}
            >
              ➕ Agregar {selected.length} acción{selected.length !== 1 ? "es" : ""} al Scanner
            </button>
          </>
        )}

        {found.length === 0 && !scanning && manualText && (
          <div style={{ textAlign: "center", padding: 20, color: "#ef4444", fontFamily: "monospace", fontSize: 12 }}>
            No se encontraron tickers válidos en Yahoo Finance.<br/>
            Verifica que los símbolos sean correctos (ej: SOFI, HOOD, MARA).
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL AGREGAR/EDITAR ─────────────────────────────────────────────────────
const CAP_OPTIONS = [
  { value: "large", label: "Large Cap >$10B" },
  { value: "mid",   label: "Mid Cap $2B–$10B" },
  { value: "small", label: "Small Cap $300M–$2B" },
  { value: "micro", label: "Micro Cap <$300M" },
  { value: "nano",  label: "Nano Cap <$50M" },
];

function Modal({ stock, onSave, onClose }) {
  const [form, setForm] = useState(stock || {
    ticker: "", nombre: "", precio: "", recomendacion: "", target: "",
    capitalizacion: "small", acciones: "", volumen: "", volatilidad: "",
    institucional: "", notas: "", alertaAlta: "", alertaBaja: "", alertaVol: "2",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const num = (k) => parseFloat(form[k]) || 0;
  const upside = num("precio") > 0 ? (((num("target") - num("precio")) / num("precio")) * 100).toFixed(0) : null;
  const accionesConBudget = num("precio") > 0 ? Math.floor(89 / num("precio")) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#0d1526", border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 0 60px rgba(34,197,94,0.1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#f8fafc", fontFamily: "Georgia, serif" }}>
            {stock ? "Editar Acción" : "➕ Agregar Acción"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <FieldLabel>Ticker *</FieldLabel>
            <input value={form.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="SOFI" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Nombre empresa</FieldLabel>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="SoFi Technologies" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>💲 Precio actual ($)</FieldLabel>
            <input type="number" value={form.precio} onChange={e => set("precio", e.target.value)} placeholder="3.25" style={inputStyle} step="0.01" />
            {accionesConBudget && <small style={{ color: "#475569", fontSize: 11 }}>≈ {accionesConBudget} acciones con $89</small>}
          </div>
          <div>
            <FieldLabel>🎯 Precio Objetivo ($)</FieldLabel>
            <input type="number" value={form.target} onChange={e => set("target", e.target.value)} placeholder="7.00" style={inputStyle} step="0.01" />
            {upside && <small style={{ color: Number(upside) >= 100 ? "#22c55e" : "#f59e0b", fontSize: 11 }}>+{upside}% upside</small>}
          </div>
          <div>
            <FieldLabel>⭐ Recom. Analistas (1–5)</FieldLabel>
            <input type="number" value={form.recomendacion} onChange={e => set("recomendacion", e.target.value)} placeholder="1.5" style={inputStyle} step="0.1" min="1" max="5" />
          </div>
          <div>
            <FieldLabel>🏦 Capitalización</FieldLabel>
            <select value={form.capitalizacion} onChange={e => set("capitalizacion", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CAP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>📊 Acciones circulación (M)</FieldLabel>
            <input type="number" value={form.acciones} onChange={e => set("acciones", e.target.value)} placeholder="85" style={inputStyle} step="0.1" />
          </div>
          <div>
            <FieldLabel>📈 Volumen prom. diario (K)</FieldLabel>
            <input type="number" value={form.volumen} onChange={e => set("volumen", e.target.value)} placeholder="1200" style={inputStyle} step="1" />
          </div>
          <div>
            <FieldLabel>⚡ Volatilidad semanal (%)</FieldLabel>
            <input type="number" value={form.volatilidad} onChange={e => set("volatilidad", e.target.value)} placeholder="5.2" style={inputStyle} step="0.1" />
          </div>
          <div>
            <FieldLabel>🏛️ % Institucional</FieldLabel>
            <input type="number" value={form.institucional} onChange={e => set("institucional", e.target.value)} placeholder="35" style={inputStyle} step="0.1" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>📝 Notas / Tesis</FieldLabel>
            <textarea value={form.notas} onChange={e => set("notas", e.target.value)}
              placeholder="¿Por qué tiene potencial? Catalizadores, fechas de earnings, etc."
              rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>🔔 Alertas de precio</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <small style={{ color: "#475569", fontSize: 11 }}>Alerta subida ($)</small>
                <input type="number" value={form.alertaAlta || ""} onChange={e => set("alertaAlta", e.target.value)} placeholder="4.50" style={{ ...inputStyle, marginTop: 4 }} step="0.01" />
              </div>
              <div>
                <small style={{ color: "#475569", fontSize: 11 }}>Alerta bajada ($)</small>
                <input type="number" value={form.alertaBaja || ""} onChange={e => set("alertaBaja", e.target.value)} placeholder="2.50" style={{ ...inputStyle, marginTop: 4 }} step="0.01" />
              </div>
            </div>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>📣 Alerta volumen (multiplicador)</FieldLabel>
            <select value={form.alertaVol || "2"} onChange={e => set("alertaVol", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="1.5">1.5x promedio</option>
              <option value="2">2x promedio (default)</option>
              <option value="3">3x promedio 🔥</option>
              <option value="5">5x promedio 🚨</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", background: "transparent",
            border: "1px solid rgba(100,116,139,0.3)", borderRadius: 8,
            color: "#64748b", cursor: "pointer", fontSize: 14,
          }}>Cancelar</button>
          <button onClick={() => { if (!form.ticker) return; onSave({ ...form, id: stock?.id || Date.now() }); }}
            style={{
              flex: 2, padding: "12px",
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none", borderRadius: 8,
              color: "#0a0f1e", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}>
            {stock ? "Guardar Cambios" : "Agregar al Scanner"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── STOCK ROW ────────────────────────────────────────────────────────────────
function StockRow({ stock, quote, onEdit, onDelete }) {
  const score = scoreStock(stock);
  const vd = verdictStyle(score);
  const price = quote?.price ?? parseFloat(stock.precio) ?? 0;
  const prevClose = quote?.prevClose ?? price;
  const changePct = prevClose ? ((price - prevClose) / prevClose * 100) : 0;
  const changeUp = changePct >= 0;
  const volRatio = quote?.avgVolume ? (quote.volume / quote.avgVolume).toFixed(1) : null;
  const volAlert = quote?.avgVolume && stock.alertaVol ? quote.volume >= quote.avgVolume * parseFloat(stock.alertaVol) : false;
  const priceAlertHigh = stock.alertaAlta && price >= parseFloat(stock.alertaAlta);
  const priceAlertLow  = stock.alertaBaja && price <= parseFloat(stock.alertaBaja);
  const isPreMarket = quote?.marketState === "PRE";
  const prePrice = quote?.preMarketPrice;
  const bars = Array(8).fill(0).map((_, i) => { try { return FILTERS[i].check(stock) ? 1 : 0; } catch { return 0; } });

  return (
    <div style={{
      background: "rgba(13,21,38,0.85)", border: `1px solid ${vd.glow}22`,
      borderLeft: `3px solid ${vd.color}`, borderRadius: 10,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
    }}>
      {(volAlert || priceAlertHigh || priceAlertLow) && (
        <div style={{
          position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff",
          fontSize: 10, fontFamily: "monospace", padding: "3px 10px",
          borderBottomLeftRadius: 8, letterSpacing: 1, animation: "pulse 1s infinite",
        }}>
          🔔 {volAlert ? "VOL!" : ""} {priceAlertHigh ? "↑PRECIO" : ""} {priceAlertLow ? "↓PRECIO" : ""}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#f8fafc", letterSpacing: 2 }}>{stock.ticker}</div>
          <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
            {stock.nombre || quote?.shortName || ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", fontFamily: "monospace" }}>${price.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: changeUp ? "#22c55e" : "#ef4444", fontFamily: "monospace" }}>
            {changeUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          </div>
        </div>
        {isPreMarket && prePrice && (
          <div style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 6, padding: "4px 10px" }}>
            <div style={{ fontSize: 9, color: "#fbbf24", fontFamily: "monospace", letterSpacing: 1 }}>PREMARKET</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", fontFamily: "monospace" }}>${prePrice.toFixed(2)}</div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>VOL</span>
            {volRatio && (
              <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: parseFloat(volRatio) >= 2 ? "#22c55e" : parseFloat(volRatio) >= 1 ? "#f59e0b" : "#ef4444" }}>
                {volRatio}x {parseFloat(volRatio) >= 3 ? "🔥" : parseFloat(volRatio) >= 2 ? "⚡" : ""}
              </span>
            )}
          </div>
          <div style={{ height: 6, background: "rgba(51,65,85,0.6)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, transition: "width 0.8s ease",
              width: volRatio ? `${Math.min(parseFloat(volRatio) / 5 * 100, 100)}%` : "0%",
              background: parseFloat(volRatio) >= 2 ? "linear-gradient(90deg,#22c55e,#16a34a)" : parseFloat(volRatio) >= 1 ? "linear-gradient(90deg,#f59e0b,#d97706)" : "#ef4444",
              boxShadow: parseFloat(volRatio) >= 2 ? "0 0 8px #22c55e" : "none",
            }} />
          </div>
          {quote?.volume && <div style={{ fontSize: 10, color: "#334155", marginTop: 2, fontFamily: "monospace" }}>{(quote.volume / 1000).toFixed(0)}K hoy</div>}
        </div>
        <div style={{ background: `${vd.glow}20`, border: `1px solid ${vd.glow}50`, borderRadius: 8, padding: "6px 12px", textAlign: "center", minWidth: 60 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: vd.color, fontFamily: "monospace" }}>{score}/8</div>
          <div style={{ fontSize: 9, color: vd.color, fontFamily: "monospace", letterSpacing: 1 }}>{vd.label}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {bars.map((pass, i) => (
          <div key={i} title={FILTERS[i].label} style={{
            display: "flex", alignItems: "center", gap: 3,
            background: pass ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${pass ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: 4, padding: "2px 6px", fontSize: 9, fontFamily: "monospace",
            color: pass ? "#86efac" : "#fca5a5",
          }}>
            {FILTERS[i].icon} {pass ? "✓" : "✗"}
          </div>
        ))}
      </div>
      {stock.notas && (
        <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", borderTop: "1px solid rgba(51,65,85,0.4)", paddingTop: 8 }}>
          📝 {stock.notas}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => onEdit(stock)} style={btnSm("#64748b")}>✏️ Editar</button>
        <button onClick={() => onDelete(stock.id)} style={btnSm("#ef4444")}>🗑️ Borrar</button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState("all");
  const [alertsFired, setAlertsFired] = useState({});
  const intervalRef = useRef(null);

  useEffect(() => {
    const list = loadWatchlist();
    setWatchlist(list);
    setLoading(false);
    if (list.length > 0) fetchAllQuotes(list);
  }, []);

  const fetchAllQuotes = useCallback(async (list) => {
    setRefreshing(true);
    const results = {};
    const alerts = {};
    await Promise.all((list || watchlist).map(async (s) => {
      const q = await fetchQuote(s.ticker);
      if (q) {
        results[s.ticker] = q;
        const volRatio = q.avgVolume ? q.volume / q.avgVolume : 0;
        alerts[s.ticker] = {
          vol: volRatio >= (parseFloat(s.alertaVol) || 2),
          high: s.alertaAlta && q.price >= parseFloat(s.alertaAlta),
          low: s.alertaBaja && q.price <= parseFloat(s.alertaBaja),
        };
      }
    }));
    setQuotes(results);
    setAlertsFired(alerts);
    setLastUpdate(new Date());
    setRefreshing(false);
  }, [watchlist]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    intervalRef.current = setInterval(() => fetchAllQuotes(watchlist), 60000);
    return () => clearInterval(intervalRef.current);
  }, [watchlist, fetchAllQuotes]);

  const handleSave = (stock) => {
    let updated;
    if (watchlist.find(s => s.id === stock.id)) {
      updated = watchlist.map(s => s.id === stock.id ? stock : s);
    } else {
      updated = [...watchlist, stock];
    }
    setWatchlist(updated);
    saveWatchlist(updated);
    setModal(null);
    fetchAllQuotes(updated);
  };

  const handleDelete = (id) => {
    const updated = watchlist.filter(s => s.id !== id);
    setWatchlist(updated);
    saveWatchlist(updated);
  };

  // Called from ImageScanner with validated tickers
  const handleAddFromImage = (tickers) => {
    const newStocks = tickers.map(t => ({
      id: Date.now() + Math.random(),
      ticker: t.ticker,
      nombre: t.name || "",
      precio: t.price || "",
      recomendacion: "", target: "", capitalizacion: "small",
      acciones: "", volumen: "", volatilidad: "", institucional: "",
      notas: "📸 Agregado vía escáner de imagen",
      alertaAlta: "", alertaBaja: "", alertaVol: "2",
    }));
    const updated = [...watchlist, ...newStocks];
    setWatchlist(updated);
    saveWatchlist(updated);
    fetchAllQuotes(updated);
  };

  const filtered = watchlist.filter(s => {
    if (filter === "all") return true;
    const sc = scoreStock(s);
    if (filter === "joya")    return sc === 8;
    if (filter === "fuerte")  return sc >= 6 && sc < 8;
    if (filter === "revisar") return sc >= 4 && sc < 6;
    if (filter === "debil")   return sc < 4;
    return true;
  }).sort((a, b) => scoreStock(b) - scoreStock(a));

  const alertCount = Object.values(alertsFired).filter(a => a.vol || a.high || a.low).length;
  const avgScore = watchlist.length ? (watchlist.reduce((s, x) => s + scoreStock(x), 0) / watchlist.length).toFixed(1) : "–";

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", color: "#e2e8f0", fontFamily: "'Georgia', serif", position: "relative" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        select option { background: #0d1526; }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
      }} />

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(7,13,26,0.95)", borderBottom: "1px solid rgba(34,197,94,0.15)",
        backdropFilter: "blur(12px)", padding: "0 20px",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, height: 60, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: 1 }}>💎 Millón Scanner</div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2 }}>METODOLOGÍA DEL MILLÓN · YOEL SARDIÑAS</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {alertCount > 0 && (
              <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#ef4444", fontFamily: "monospace", animation: "pulse 1s infinite" }}>
                🔔 {alertCount} alerta{alertCount > 1 ? "s" : ""}
              </div>
            )}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>{watchlist.length}</div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>ACCIONES</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#84cc16", fontFamily: "monospace" }}>{avgScore}</div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>SCORE</div>
            </div>
            <button onClick={() => fetchAllQuotes(watchlist)} disabled={refreshing} style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8, padding: "7px 11px", color: "#22c55e",
              cursor: refreshing ? "wait" : "pointer", fontSize: 14,
              animation: refreshing ? "spin 1s linear infinite" : "none", display: "inline-block",
            }}>⟳</button>
            {/* Image Scanner button */}
            <button onClick={() => setShowScanner(true)} style={{
              background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)",
              borderRadius: 8, padding: "7px 11px", color: "#a78bfa",
              cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
            }}>📸</button>
            <button onClick={() => setModal("add")} style={{
              background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none",
              borderRadius: 8, padding: "8px 14px", color: "#0a0f1e",
              fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
            }}>+ Agregar</button>
          </div>
        </div>
        {lastUpdate && (
          <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#1e293b", fontFamily: "monospace" }}>
              Actualizado: {lastUpdate.toLocaleTimeString()} · Auto-refresh 60s
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 80px", position: "relative", zIndex: 1 }}>
        {watchlist.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { k: "all",     label: `Todas (${watchlist.length})`, color: "#64748b" },
              { k: "joya",    label: "💎 Joya",    color: "#22c55e" },
              { k: "fuerte",  label: "🚀 Fuerte",  color: "#84cc16" },
              { k: "revisar", label: "⚠️ Revisar", color: "#f59e0b" },
              { k: "debil",   label: "❌ Débil",   color: "#ef4444" },
            ].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)} style={{
                background: filter === t.k ? `${t.color}20` : "transparent",
                border: `1px solid ${filter === t.k ? t.color : "rgba(51,65,85,0.5)"}`,
                borderRadius: 20, padding: "5px 14px",
                color: filter === t.k ? t.color : "#475569",
                fontSize: 12, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#334155" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
            <div style={{ fontFamily: "monospace" }}>Cargando watchlist...</div>
          </div>
        ) : watchlist.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", border: "2px dashed rgba(34,197,94,0.15)", borderRadius: 16, color: "#1e293b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 20, color: "#334155", marginBottom: 8, fontFamily: "Georgia,serif" }}>Tu scanner está vacío</div>
            <div style={{ fontSize: 13, color: "#1e293b", marginBottom: 24, fontFamily: "monospace" }}>
              Agrega acciones manualmente o usa el escáner 📸 para detectar desde una imagen
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setModal("add")} style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none",
                borderRadius: 10, padding: "12px 24px", color: "#0a0f1e", fontWeight: 700, cursor: "pointer", fontSize: 14,
              }}>+ Agregar acción</button>
              <button onClick={() => setShowScanner(true)} style={{
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)",
                borderRadius: 10, padding: "12px 24px", color: "#a78bfa", cursor: "pointer", fontSize: 14, fontWeight: 700,
              }}>📸 Escanear imagen</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(s => (
              <StockRow key={s.id} stock={s} quote={quotes[s.ticker]} alertsFired={alertsFired[s.ticker]} onEdit={setModal} onDelete={handleDelete} />
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#334155", fontFamily: "monospace" }}>No hay acciones en esta categoría</div>
            )}
          </div>
        )}
      </div>

      {modal && <Modal stock={modal === "add" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}
      {showScanner && <ImageScanner onAddTickers={handleAddFromImage} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
