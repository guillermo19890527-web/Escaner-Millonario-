import { useState, useRef, useCallback } from "react";

const ACCENT = "#00ff88";
const BG = "#0a0f1e";
const CARD = "#0d1528";
const BORDER = "#1a2a4a";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, padding: "1rem",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  modal: {
    background: CARD, border: `1px solid ${BORDER}`,
    borderRadius: "16px", width: "100%", maxWidth: "480px",
    maxHeight: "90vh", overflowY: "auto",
    boxShadow: `0 0 60px rgba(0,255,136,0.08), 0 24px 48px rgba(0,0,0,0.6)`,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "1.25rem 1.5rem", borderBottom: `1px solid ${BORDER}`,
  },
  title: {
    fontSize: "1.1rem", fontWeight: 700, color: "#fff",
    letterSpacing: "-0.02em", margin: 0,
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
  closeBtn: {
    background: "none", border: "none", color: "#4a6080",
    cursor: "pointer", fontSize: "1.2rem", padding: "4px",
    lineHeight: 1, transition: "color 0.2s",
  },
  body: { padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" },
  dropZone: (dragging, hasImage) => ({
    border: `2px dashed ${dragging ? ACCENT : hasImage ? "#1a3a2a" : BORDER}`,
    borderRadius: "12px",
    background: dragging ? "rgba(0,255,136,0.04)" : hasImage ? "rgba(0,255,136,0.02)" : "rgba(255,255,255,0.01)",
    minHeight: "180px", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
    transition: "all 0.25s", position: "relative", overflow: "hidden",
  }),
  preview: {
    width: "100%", height: "100%", objectFit: "contain",
    maxHeight: "220px", borderRadius: "10px", display: "block",
  },
  dropLabel: {
    color: "#4a6080", fontSize: "0.8rem", textAlign: "center",
    padding: "2rem 1rem", lineHeight: 1.7,
  },
  dropIcon: { fontSize: "2rem", marginBottom: "0.5rem", display: "block" },
  scanBtn: (loading) => ({
    background: loading ? "#0d2a1a" : `linear-gradient(135deg, ${ACCENT}, #00cc66)`,
    color: loading ? ACCENT : "#000",
    border: loading ? `1px solid ${ACCENT}` : "none",
    borderRadius: "10px", padding: "0.875rem",
    fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "default" : "pointer",
    letterSpacing: "0.05em", transition: "all 0.2s",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    fontFamily: "'IBM Plex Mono', monospace",
  }),
  statusBar: (type) => ({
    background: type === "error" ? "rgba(255,60,60,0.08)" : "rgba(0,255,136,0.06)",
    border: `1px solid ${type === "error" ? "rgba(255,60,60,0.3)" : "rgba(0,255,136,0.2)"}`,
    borderRadius: "8px", padding: "0.75rem 1rem",
    fontSize: "0.78rem", color: type === "error" ? "#ff6060" : ACCENT,
    lineHeight: 1.5,
  }),
  tickerGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: "0.5rem", marginTop: "0.25rem",
  },
  tickerChip: {
    background: "rgba(0,255,136,0.05)", border: `1px solid rgba(0,255,136,0.2)`,
    borderRadius: "8px", padding: "0.5rem 0.75rem",
    display: "flex", flexDirection: "column", gap: "2px",
  },
  tickerSymbol: { color: ACCENT, fontWeight: 700, fontSize: "0.85rem" },
  tickerName: { color: "#4a6080", fontSize: "0.7rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  addBtn: {
    background: "none", border: `1px solid ${BORDER}`,
    borderRadius: "6px", padding: "0.35rem 0.6rem",
    color: "#4a6080", cursor: "pointer", fontSize: "0.7rem",
    marginTop: "4px", transition: "all 0.2s", fontFamily: "'IBM Plex Mono', monospace",
  },
  sectionLabel: { color: "#4a6080", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.25rem" },
  pulse: `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`,
};

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 16, height: 16 }}>
      <svg viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite", width: 16, height: 16 }}>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
      </svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EscanerIA({ onAddTickers, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "error"|"info", text }
  const [tickers, setTickers] = useState([]); // [{ symbol, name }]
  const fileRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setStatus({ type: "error", text: "Solo se aceptan imágenes (JPG, PNG, WEBP)." });
      return;
    }
    setImageFile(file);
    setTickers([]);
    setStatus(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);
      // extract base64 (strip prefix)
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const scanImage = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setStatus({ type: "info", text: "🤖 Analizando imagen con IA..." });
    setTickers([]);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageFile.type || "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  type: "text",
                  text: `Analiza esta imagen financiera. Extrae TODOS los tickers (símbolos bursátiles) que veas.
Responde SOLO con JSON válido, sin texto extra, sin backticks:
{
  "tickers": [
    { "symbol": "AAPL", "name": "Apple Inc." },
    { "symbol": "NIO", "name": "NIO Inc." }
  ]
}
Reglas:
- symbol: siempre en MAYÚSCULAS, 1-5 caracteres
- name: nombre completo de la empresa si lo reconoces, si no pon ""
- Si no hay tickers bursátiles, devuelve { "tickers": [] }`,
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error.message);

      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .replace(/```json|```/g, "")
        .trim();

      const parsed = JSON.parse(text);
      const found = parsed.tickers || [];

      if (found.length === 0) {
        setStatus({ type: "error", text: "No se detectaron tickers en la imagen. Intenta con otra captura." });
      } else {
        setStatus({ type: "info", text: `✅ ${found.length} ticker${found.length > 1 ? "s" : ""} detectado${found.length > 1 ? "s" : ""}` });
        setTickers(found);
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const addTicker = (symbol) => {
    if (onAddTickers) onAddTickers([symbol]);
  };

  const addAll = () => {
    if (onAddTickers) onAddTickers(tickers.map((t) => t.symbol));
    if (onClose) onClose();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        .escaner-close:hover { color: #fff !important; }
        .add-btn:hover { background: rgba(0,255,136,0.08) !important; border-color: rgba(0,255,136,0.4) !important; color: #00ff88 !important; }
        .scan-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,255,136,0.25); }
      `}</style>
      <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
        <div style={styles.modal}>
          {/* Header */}
          <div style={styles.header}>
            <h2 style={styles.title}>
              <span>📡</span> Escáner IA
            </h2>
            <button className="escaner-close" style={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div style={styles.body}>
            <p style={{ color: "#4a6080", fontSize: "0.8rem", margin: 0, lineHeight: 1.6 }}>
              Sube cualquier imagen — watchlist, artículo, captura — y la IA detecta los tickers automáticamente.
            </p>

            {/* Drop zone */}
            <div
              style={styles.dropZone(dragging, !!imagePreview)}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" style={styles.preview} />
              ) : (
                <div style={styles.dropLabel}>
                  <span style={styles.dropIcon}>📷</span>
                  Arrastra una imagen aquí<br />
                  o toca para seleccionar
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {/* Scan button */}
            <button
              className="scan-btn"
              style={styles.scanBtn(loading)}
              onClick={scanImage}
              disabled={!imageBase64 || loading}
            >
              {loading ? <><Spinner /> Analizando...</> : "🔍 Detectar Tickers con IA"}
            </button>

            {/* Status */}
            {status && (
              <div style={styles.statusBar(status.type)}>
                {status.text}
              </div>
            )}

            {/* Results */}
            {tickers.length > 0 && (
              <div>
                <p style={styles.sectionLabel}>Tickers detectados</p>
                <div style={styles.tickerGrid}>
                  {tickers.map((t) => (
                    <div key={t.symbol} style={styles.tickerChip}>
                      <span style={styles.tickerSymbol}>{t.symbol}</span>
                      {t.name && <span style={styles.tickerName}>{t.name}</span>}
                      <button className="add-btn" style={styles.addBtn} onClick={() => addTicker(t.symbol)}>
                        + Agregar
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add all */}
                <button
                  onClick={addAll}
                  style={{
                    marginTop: "0.75rem", width: "100%",
                    background: "rgba(0,255,136,0.08)",
                    border: `1px solid rgba(0,255,136,0.3)`,
                    borderRadius: "8px", padding: "0.7rem",
                    color: ACCENT, cursor: "pointer", fontSize: "0.82rem",
                    fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: "0.04em", transition: "all 0.2s",
                  }}
                >
                  ✅ Agregar todos a watchlist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
