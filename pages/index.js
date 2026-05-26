import { useState, useEffect, useRef, useCallback } from "react";
import { extractTickersFromImage } from '../lib/extractTickersFromImage';

const CAP_OPTIONS = [
  { value: "large",  label: "Large Cap  (>$10B)" },
  { value: "mid",    label: "Mid Cap    ($2B–$10B)" },
  { value: "small",  label: "Small Cap  ($300M–$2B)" },
  { value: "micro",  label: "Micro Cap  (<$300M)" },
];

const STORAGE_KEY = "millon-watchlist-v2";

function loadWatchlist() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function saveWatchlist(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

async function fetchQuote(symbol) {
  try {
    const res = await fetch(`/api/quote?symbol=${symbol}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return null; }
}

const FILTERS = [
  { id: "precio",         label: "Precio $2–$5",       icon: "💲", check: (v) => v.precio >= 2 && v.precio <= 5 },
  { id: "recomendacion",  label: "Recom 1.0–2.0",      icon: "⭐", check: (v) => v.recomendacion >= 1 && v.recomendacion <= 2 },
  { id: "target",         label: "Target +100%",       icon: "🎯", check: (v) => v.target >= v.precio * 2 },
  { id: "capitalizacion", label: "Cap OK",             icon: "🏦", check: (v) => ["large","mid","small","micro"].includes(v.capitalizacion) },
  { id: "acciones",       label: ">20M acciones",      icon: "📊", check: (v) => v.acciones >= 20 },
  { id: "volumen",        label: "Vol >500K",          icon: "📈", check: (v) => v.volumen >= 500 },
  { id: "volatilidad",    label: "Volatilidad >3%",    icon: "⚡", check: (v) => v.volatilidad >= 3 },
  { id: "institucional",  label: ">10% Institucional", icon: "🏛️", check: (v) => v.institucional >= 10 },
];

function scoreStock(s) {
  let p = 0;
  FILTERS.forEach(f => {
    try { if (f.check(s)) p++; } catch (e) {}
  });
  return p;
}

function verdictStyle(score) {
  if (score === 8) return { color: "#22c55e", label: "JOYA 💎",    glow: "#22c55e" };
  if (score >= 6)  return { color: "#84cc16", label: "FUERTE 🚀",  glow: "#84cc16" };
  if (score >= 4)  return { color: "#f59e0b", label: "REVISAR ⚠️", glow: "#f59e0b" };
  return               { color: "#ef4444", label: "DÉBIL ❌",    glow: "#ef4444" };
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(15,23,42,0.8)",
  border: "1px solid rgba(100,116,139,0.25)",
  borderRadius: 7, color: "#e2e8f0",
  fontSize: 14, padding: "9px 12px",
  outline: "none", marginTop: 4,
};

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function btnSm(color) {
  return {
    background: "transparent", border: `1px solid ${color}40`,
    borderRadius: 6, color, fontSize: 11,
    padding: "4px 10px", cursor: "pointer", fontFamily: "monospace",
  };
}

function ImageScanner({ onAddTickers, onClose }) {
  const [dragging, setDragging]     = useState(false);
  const [preview, setPreview]       = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [found, setFound]           = useState([]);
  const [selected, setSelected]     = useState([]);
  const [manualText, setManualText] = useState("");
  const fileRef = useRef();

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      scanImageFromPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const scanImageFromPreview = async (previewData) => {
    setScanning(true);
    setFound([]);
    setSelected([]);
    let tickers = [];
    try {
      const blob = await fetch(previewData).then(r => r.blob());
      tickers = await extractTickersFromImage(blob);
    } catch (err) {
      console.error("Error OCR:", err);
      alert("No se pudo leer la imagen. Intenta con otra foto más clara.");
    }
    resolveAndSet(tickers);
  };

  const scanImage = async () => {
    if (!preview && !manualText) return;
    setScanning(true);
    setFound([]);
    setSelected([]);
    let tickers = [];
    if (manualText) {
      const matches = manualText.toUpperCase().match(/\b[A-Z]{1,5}\b/g) || [];
      const blacklist = new Set(["THE","AND","FOR","NY","A","I","AN","OF","IN","TO","IS"]);
      tickers = [...new Set(matches.filter(t => !blacklist.has(t)))];
    } else if (preview) {
      try {
        const blob = await fetch(preview).then(r => r.blob());
        tickers = await extractTickersFromImage(blob);
      } catch (err) {
        console.error("Error OCR:", err);
        alert("No se pudo leer la imagen. Intenta con otra foto más clara.");
      }
    }
    resolveAndSet(tickers);
  };

  // ✅ Sin Yahoo — muestra tickers directamente
  const resolveAndSet = (tickers) => {
    const valid = tickers
      .filter(t => t && t.length >= 2)
      .map(t => ({ ticker: t, price: null, name: t }));
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
          Sube una imagen con tickers (screenshot de watchlist, artículo, etc.) o pega el texto visible abajo para detectar automáticamente.
        </p>

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
              <div style={{ fontSize: 13, color: "#475569", fontFamily: "monospace" }}>Toca para subir imagen</div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Screenshot de watchlist, noticias, etc.</div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => processFile(e.target.files[0])} />
        </div>

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

        {found.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "monospace", marginBottom: 10 }}>
              ✅ {found.length} ticker{found.length > 1 ? "s" : ""} detectado{found.length > 1 ? "s" : ""}:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {found.map(f => (
                <div key={f.ticker}
                  onClick={() => toggleTicker(f.ticker)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: selected.includes(f.ticker) ? "rgba(34,197,94,0.1)" : "rgba(15,23,42,0.5)",
                    border: `1px solid ${selected.includes(f.ticker) ? "rgba(34,197,94,0.4)" : "rgba(51,65,85,0.4)"}`,
                    borderRadius: 8, padding: "10px 14px", cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <div>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{f.ticker}</span>
                  </div>
                  <span style={{ fontSize: 16 }}>{selected.includes(f.ticker) ? "✅" : "⬜"}</span>
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

        {found.length === 0 && !scanning && (manualText || preview) && (
          <div style={{ textAlign: "center", padding: 20, color: "#ef4444", fontFamily: "monospace", fontSize: 12 }}>
            No se encontraron tickers en la imagen.<br />
            Verifica que los símbolos sean visibles (ej: SOFI, HOOD, MARA).
          </div>
        )}
      </div>
    </div>
  );
}

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
          <button
            onClick={() => { if (!form.ticker) return; onSave({ ...form, id: stock?.id || Date.now() }); }}
            style={{
              flex: 2, padding: "12px",
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none", borderRadius: 8,
              color: "#0a0f1e", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}
          >
            {stock ? "Guardar Cambios" : "Agregar al Scanner"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockRow({ stock, quote, onEdit, onDelete }) {
  const score      = scoreStock(stock);
  const vd         = verdictStyle(score);
  const price      = quote?.price ?? parseFloat(stock.precio) ?? 0;
  const prevClose  = quote?.prevClose ?? price;
  const changePct  = pr
