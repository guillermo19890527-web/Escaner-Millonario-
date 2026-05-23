import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "millon-watchlist-v2";

async function loadWatchlist() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r? JSON.parse(r) : [];
  } catch { return []; }
}

async function saveWatchlist(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

async function fetchQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&includePrePost=true`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error();
    return {
      price: meta.regularMarketPrice,
      prevClose: meta.previousClose || meta.chartPreviousClose,
      preMarketPrice: meta.preMarketPrice || null,
      volume: meta.regularMarketVolume,
      avgVolume: meta.averageDailyVolume3Month || meta.averageDailyVolume10Day,
      high52: meta.fiftyTwoWeekHigh,
      low52: meta.fiftyTwoWeekLow,
      marketState: meta.marketState,
      currency: meta.currency,
      shortName: meta.shortName || symbol,
    };
  } catch {
    return null;
  }
}

const FILTERS = [
  { id: "precio", label: "Precio $2–$5", icon: "💲", check: (v) => v.precio >= 2 && v.precio <= 5 },
  { id: "recomendacion", label: "Recom 1.0–2.0", icon: "⭐", check: (v) => v.recomendacion >= 1 && v.recomendacion <= 2 },
  { id: "target", label: "Target +100%", icon: "🎯", check: (v) => v.target >= v.precio * 2 },
  { id: "capitalizacion",label: "Cap OK", icon: "🏦", check: (v) => ["large","mid","small","micro"].includes(v.capitalizacion) && v.capitalizacion!== "nano" },
  { id: "acciones", label: ">20M acciones", icon: "📊", check: (v) => v.acciones >= 20 },
  { id: "volumen", label: "Vol >500K", icon: "📈", check: (v) => v.volumen >= 500 },
  { id: "volatilidad", label: "Volatilidad >3%", icon: "⚡", check: (v) => v.volatilidad >= 3 },
  { id: "institucional", label: ">10% Institucional", icon: "🏛️", check: (v) => v.institucional >= 10 },
];

function scoreStock(s) {
  let passed = 0;
  FILTERS.forEach(f => { try { if (f.check(s)) passed++; } catch {} });
  return passed;
}

function verdictStyle(score) {
  if (score === 8) return { color: "#22c55e", label: "JOYA 💎", glow: "#22c55e" };
  if (score >= 6) return { color: "#84cc16", label: "FUERTE 🚀", glow: "#84cc16" };
  if (score >= 4) return { color: "#f59e0b", label: "REVISAR ⚠️", glow: "#f59e0b" };
  return { color: "#ef4444", label: "DÉBIL ❌", glow: "#ef4444" };
}

const CAP_OPTIONS = [
  { value: "large", label: "Large Cap >$10B" },
  { value: "mid", label: "Mid Cap $2B–$10B" },
  { value: "small", label: "Small Cap $300M–$2B" },
  { value: "micro", label: "Micro Cap <$300M" },
  { value: "nano", label: "Nano Cap <$50M" },
];

function Modal({ stock, onSave, onClose }) {
  const [form, setForm] = useState(stock || {
    ticker: "", nombre: "", precio: "", recomendacion: "", target: "",
    capitalizacion: "small", acciones: "", volumen: "", volatilidad: "",
    institucional: "", notas: "",
  });

  const set = (k, v) => setForm(p => ({...p, [k]: v }));
  const num = (k) => parseFloat(form[k]) || 0;

  const upside = num("precio") > 0
   ? (((num("target") - num("precio")) / num("precio")) * 100).toFixed(0)
    : null;

  const accionesConBudget = num("precio") > 0? Math.floor(89 / num("precio")) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#0d1526",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 16,
        padding: "28px 24px",
        width: "100%",
        maxWidth: 520,
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 0 60px rgba(34,197,94,0.1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#f8fafc", fontFamily: "Georgia, serif" }}>
            {stock? "Editar Acción" : "➕ Agregar Acción"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { k: "ticker", label: "Ticker *", ph: "SOFI", upper: true, full: false },
            { k: "nombre", label: "Nombre empresa", ph: "SoFi Technologies", full: false },
          ].map(({ k, label, ph, upper, full }) => (
            <div key={k} style={{ gridColumn: full? "1/-1" : "auto" }}>
              <FieldLabel>{label}</FieldLabel>
              <input
                value={form[k]}
                onChange={e => set(k, upper? e.target.value.toUpperCase() : e.target.value)}
                placeholder={ph}
                style={inputStyle}
              />
            </div>
          ))}

          <div>
            <FieldLabel>💲 Precio actual ($)</FieldLabel>
            <input type="number" value={form.precio} onChange={e => set("precio", e.target.value)} placeholder="3.25" style={inputStyle} step="0.01" />
            {accionesConBudget && <small style={{ color: "#475569", fontSize: 11 }}>≈ {accionesConBudget} acciones con $89</small>}
          </div>

          <div>
            <FieldLabel>🎯 Precio Objetivo ($)</FieldLabel>
            <input type="number" value={form.target} onChange={e => set("target", e.target.value)} placeholder="7.00" style={inputStyle} step="0.01" />
            {upside && <small style={{ color: upside >= 100? "#22c55e" : "#f59e0b", fontSize: 11 }}>+{upside}% upside</small>}
          </div>

          <div>
            <FieldLabel>⭐ Recom. Analistas (1–5)</FieldLabel>
            <input type="number" value={form.recomendacion} onChange={e => set("recomendacion", e.target.value)} placeholder="1.5" style={inputStyle} step="0.1" min="1" max="5" />
          </div>

          <div>
            <FieldLabel>🏦 Capitalización</FieldLabel>
            <select value={form.capitalizacion} onChange={e => set("capitalizacion", e.target.value)} style={{...inputStyle, cursor: "pointer" }}>
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
            <textarea
              value={form.notas}
              onChange={e => set("notas", e.target.value)}
              placeholder="¿Por qué tiene potencial? Catalizadores, fechas de earnings, etc."
              rows={3}
              style={{...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>🔔 Alertas de precio</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <small style={{ color: "#475569", fontSize: 11 }}>Alerta subida ($)</small>
                <input type="number" value={form.alertaAlta || ""} onChange={e => set("alertaAlta", e.target.value)} placeholder="4.50" style={{...inputStyle, marginTop: 4 }} step="0.01" />
              </div>
              <div>
                <small style={{ color: "#475569", fontSize: 11 }}>Alerta bajada ($)</small>
                <input type="number" value={form.alertaBaja || ""} onChange={e => set("alertaBaja", e.target.value)} placeholder="2.50" style={{...inputStyle, marginTop: 4 }} step="0.01" />
              </div>
            </div>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldLabel>📣 Alerta volumen (multiplicador)</FieldLabel>
            <select value={form.alertaVol || "2"} onChange={e => set("alertaVol", e.target.value)} style={{...inputStyle, cursor: "pointer" }}>
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
            onClick={() => {
              if (!form.ticker) return;
              onSave({...form, id: stock?.id || Date.now() });
            }}
            style={{
              flex: 2, padding: "12px",
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none", borderRadius: 8,
              color: "#0a0f1e", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}
          >
            {stock? "Guardar Cambios" : "Agregar al Scanner"}
          </button>
        </div>
      </div>
    </div>
  );
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
  return <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", letterSpacing: 1 }}>{children}</div>;
}

function StockRow({ stock, quote, alertsFired, onEdit, onDelete }) {
  const score = scoreStock(stock);
  const vd = verdictStyle(score);

  const price = quote?.price?? parseFloat(stock.precio)?? 0;
  const prevClose = quote?.prevClose?? price;
  const changePct = prevClose? ((price - prevClose) / prevClose * 100) : 0;
  const changeUp = changePct >= 0;

  const volRatio = quote && quote.avgVolume
   ? (quote.volume / quote.avgVolume).toFixed(1)
    : null;

  const volAlert = quote && quote.avgVolume && stock.alertaVol
   ? quote.volume >= quote.avgVolume * parseFloat(stock.alertaVol)
    : false;

  const priceAlertHigh = stock.alertaAlta && price >= parseFloat(stock.alertaAlta);
  const priceAlertLow = stock.alertaBaja && price <= parseFloat(stock.alertaBaja);
  const isPreMarket = quote?.marketState === "PRE";
  const prePrice = quote?.preMarketPrice;

  const bars = Array(8).fill(0).map((_, i) => {
    try { return FILTERS[i].check(stock)? 1 : 0; } catch { return 0; }
  });

  return (
    <div style={{
      background: "rgba(13,21,38,0.85)",
      border: `1px solid ${vd.glow}22`,
      borderLeft: `3px solid ${vd.color}`,
      borderRadius: 10,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
      overflow: "hidden",
    }}>
      {(volAlert || priceAlertHigh || priceAlertLow) && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "#ef4444",
          color: "#fff",
          fontSize: 10, fontFamily: "monospace",
          padding: "3px 10px",
          borderBottomLeftRadius: 8,
          letterSpacing: 1,
          animation: "pulse 1s infinite",
        }}>
          🔔 {volAlert? "VOL!" : ""} {priceAlertHigh? "↑PRECIO" : ""} {priceAlertLow? "↓PRECIO" : ""}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#f8fafc", letterSpacing: 2 }}>
            {stock.ticker}
          </div>
          <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
            {stock.nombre || quote?.shortName || ""}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", fontFamily: "monospace" }}>
            ${price.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: changeUp? "#22c55e" : "#ef4444", fontFamily: "monospace" }}>
            {changeUp? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          </div>
        </div>

        {isPreMarket && prePrice && (
          <div style={{
            background: "rgba(251,191,36,0.15)",
            border: "1px solid rgba(251,191,36,0.4)",
            borderRadius: 6, padding: "4px 10px",
          }}>
            <div style={{ fontSize: 9, color: "#fbbf24", fontFamily: "monospace", letterSpacing: 1 }}>PREMARKET</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", fontFamily: "monospace" }}>
              ${prePrice.toFixed(2)}
            </div>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>VOL</span>
            {volRatio && (
              <span style={{
                fontSize: 11, fontFamily: "monospace",
                color: parseFloat(volRatio) >= 2? "#22c55e" : parseFloat(volRatio) >= 1? "#f59e0b" : "#ef4444",
                fontWeight: 700,
              }}>
                {volRatio}x {parseFloat(volRatio) >= 3? "🔥" : parseFloat(volRatio) >= 2? "⚡" : ""}
              </span>
            )}
          </div>
          <div style={{ height: 6, background: "rgba(51,65,85,0.6)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: volRatio? `${Math.min(parseFloat(volRatio) / 5 * 100, 100)}%` : "0%",
              background: parseFloat(volRatio) >= 2
               ? "linear-gradient(90deg,#22c55e,#16a34a)"
                : parseFloat(volRatio) >= 1
               ? "linear-gradient(90deg,#f59e0b,#d97706)"
                : "#ef4444",
              borderRadius: 3,
              transition: "width 0.8s ease",
              boxShadow: parseFloat(volRatio) >= 2? "0 0 8px #22c55e" : "none",
            }} />
          </div>
          {quote?.volume && (
            <div style={{ fontSize: 10, color: "#334155", marginTop: 2, fontFamily: "monospace" }}>
              {(quote.volume / 1000).toFixed(0)}K hoy
            </div>
          )}
        </div>

        <div style={{
          background: `${vd.glow}20`,
          border: `1px solid ${vd.glow}50`,
          borderRadius: 8,
          padding: "6px 12px",
          textAlign: "center",
          minWidth: 60,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: vd.color, fontFamily: "monospace" }}>{score}/8</div>
          <div style={{ fontSize: 9, color: vd.color, fontFamily: "monospace", letterSpacing: 1 }}>{vd.label}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {bars.map((pass, i) => (
          <div key={i} title={FILTERS[i].label} style={{
            display: "flex", alignItems: "center", gap: 3,
            background: pass? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${pass? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 9,
            fontFamily: "monospace",
            color: pass? "#86efac" : "#fca5a5",
          }}>
            {FILTERS[i].icon} {pass? "✓" : "✗"}
          </div>
        ))}
      </div>

      {stock.notas && (
        <div style={{
          fontSize: 11, color: "#64748b", fontStyle: "italic",
          borderTop: "1px solid rgba(51,65,85,0.4)",
          paddingTop: 8,
        }}>
          📝 {stock.notas}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => onEdit(stock)} style={btnStyleSm("#64748b")}>✏️ Editar</button>
        <button onClick={() => onDelete(stock.id)} style={btnStyleSm("#ef4444")}>🗑️ Borrar</button>
      </div>
    </div>
  );
}

function btnStyleSm(color) {
  return {
    background: "transparent",
    border: `1px solid ${color}40`,
    borderRadius: 6,
    color,
    fontSize: 11,
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "monospace",
  };
}

export default function App() {
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState("all");
  const [alertsFired, setAlertsFired] = useState({});
  const intervalRef = useRef(null);

  useEffect(() => {
    loadWatchlist().then(list => {
      setWatchlist(list);
      setLoading(false);
      if (list.length > 0) fetchAllQuotes(list);
    });
  }, []);

  const fetchAllQuotes = useCallback(async (list) => {
    setRefreshing(true);
    const results = {};
    const alerts = {};
    await Promise.all((list || watchlist).map(async (s) => {
      const q = await fetchQuote(s.ticker);
      if (q) {
        results[s.ticker] = q;
        const volRatio = q.avgVolume? q.volume / q.avgVolume : 0;
        const alertThresh = parseFloat(s.alertaVol) || 2;
        alerts[s.ticker] = {
          vol: volRatio >= alertThresh,
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
    fetchAllQuotes(watchlist);
    intervalRef.current = setInterval(() => fetchAllQuotes(watchlist), 60000);
    return () => clearInterval(intervalRef.current);
  }, [watchlist]);

  const handleSave = async (stock) => {
    let updated;
    if (watchlist.find(s => s.id === stock.id)) {
      updated = watchlist.map(s => s.id === stock.id? stock : s);
    } else {
      updated = [...watchlist, stock];
    }
    setWatchlist(updated);
    await saveWatchlist(updated);
    setModal(null);
    fetchAllQuotes(updated);
  };

  const handleDelete = async (id) => {
    const updated = watchlist.filter(s => s.id!== id);
    setWatchlist(updated);
    await saveWatchlist(updated);
  };

  const filtered = watchlist.filter(s => {
    if (filter === "all") return true;
    const sc = scoreStock(s);
    if (filter === "joya") return sc === 8;
    if (filter === "fuerte") return sc >= 6 && sc < 8;
    if (filter === "revisar") return sc >= 4 && sc < 6;
    if (filter === "debil") return sc < 4;
    return true;
  }).sort((a, b) => scoreStock(b) - scoreStock(a));

  const alertCount = Object.values(alertsFired).filter(a => a.vol || a.high || a.low).length;
  const totalScore = watchlist.reduce((sum, s) => sum + scoreStock(s), 0);
  const avgScore = watchlist.length? (totalScore / watchlist.length).toFixed(1) : "–";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070d1a",
      color: "#e2e8f0",
      fontFamily: "'Georgia', serif",
      position: "relative",
    }}>
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

      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(7,13,26,0.95)",
        borderBottom: "1px solid rgba(34,197,94,0.15)",
        backdropFilter: "blur(12px)",
        padding: "0 20px",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 60, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: 1 }}>
              💎 Millón Scanner
            </div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2 }}>
              METODOLOGÍA DEL MILLÓN · YOEL SARDIÑAS
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {alertCount > 0 && (
              <div style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 6, padding: "4px 10px",
                fontSize: 12, color: "#ef4444", fontFamily: "monospace",
                animation: "pulse 1s infinite",
              }}>
                🔔 {alertCount} alerta{alertCount > 1? "s" : ""}
              </div>
            )}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>{watchlist.length}</div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>ACCIONES</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#84cc16", fontFamily: "monospace" }}>{avgScore}</div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>SCORE PROM</div>
            </div>

            <button
              onClick={() => fetchAllQuotes(watchlist)}
              disabled={refreshing}
              title="Actualizar cotizaciones"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 8, padding: "7px 12px",
                color: "#22c55e", cursor: refreshing? "wait" : "pointer",
                fontSize: 14,
                animation: refreshing? "spin 1s linear infinite" : "none",
              }}
            >
              {refreshing? "⟳" : "⟳"}
            </button>

            <button
              onClick={() => setModal("add")}
              style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                border: "none", borderRadius: 8, padding: "8px 16px",
                color: "#0a0f1e", fontWeight: 700, cursor: "pointer", fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              + Agregar
            </button>
          </div>
        </div>

        {lastUpdate && (
          <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#1e293b", fontFamily: "monospace" }}>
              Actualizado: {lastUpdate.toLocaleTimeString()} · Auto-refresh cada 60s
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 80px", position: "relative", zIndex: 1 }}>

        {watchlist.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { k: "all", label: `Todas (${watchlist.length})`, color: "#64748b" },
              { k: "joya", label: "💎 Joya", color: "#22c55e" },
              { k: "fuerte", label: "🚀 Fuerte", color: "#84cc16" },
              { k: "revisar", label: "⚠️ Revisar", color: "#f59e0b" },
              { k: "debil", label: "❌ Débil", color: "#ef4444" },
            ].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)} style={{
              background: filter === t.k ? `${t.color}20` : "transparent",
              border: `1px solid ${filter === t.k ? t.color : "#334155"}`,
              borderRadius: 20,
              padding: "5px 14px",
              color: filter === t.k ? t.color : "#475569",
              fontSize: 12,
              fontWeight: 600

              
