export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&includePrePost=true`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No meta data");

    res.status(200).json({
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
