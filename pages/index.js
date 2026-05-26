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
    <div style={{ fontSize: 11, color: "#647
