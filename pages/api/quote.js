export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  // Try multiple endpoints
  const urls = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&includePrePost=true`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&includePrePost=true`,
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/",
    "Cache-Control": "no-cache",
  };

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || !meta.regularMarketPrice) continue;

      return res.status(200).json({
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
      });
    } catch (e) {
      continue;
    }
  }

  // Fallback: try unofficial endpoint
  try {
    const fallback = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
      { headers }
    );
    if (fallback.ok) {
      const fd = await fallback.json();
      const q = fd?.quoteResponse?.result?.[0];
      if (q) {
        return res.status(200).json({
          price: q.regularMarketPrice,
          prevClose: q.regularMarketPreviousClose,
          preMarketPrice: q.preMarketPrice || null,
          volume: q.regularMarketVolume,
          avgVolume: q.averageDailyVolume3Month || q.averageDailyVolume10Day,
          high52: q.fiftyTwoWeekHigh,
          low52: q.fiftyTwoWeekLow,
          marketState: q.marketState,
          currency: q.currency,
          shortName: q.shortName || q.longName || symbol,
        });
      }
    }
  } catch (e) {}

  return res.status(503).json({ error: "No se pudo obtener el precio. Mercado cerrado o símbolo inválido." });
}
