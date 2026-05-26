export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mediaType || "image/jpeg",
                  data: imageBase64,
                }
              },
              {
                text: `You are a financial data extractor. Look at this image carefully and find ALL stock ticker symbols.
Tickers are short uppercase codes like AAPL, SOFI, MARA, HOOD, RIOT, CLSK, HOVR, KULR, ANVS.
They appear in tables, lists, watchlists, or screeners next to company names.

Return ONLY a raw JSON array of strings. No explanation, no markdown, no backticks.
Example: ["HOVR","KULR","ANVS","VIVO","NRXP"]
If none found: []`
              }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 512,
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(500).json({ error: data?.error?.message || "Gemini API error", tickers: [] });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
    console.log("Gemini raw response:", raw);

    const clean = raw.replace(/```json|```/g, "").trim();

    let tickers = [];
    try {
      tickers = JSON.parse(clean);
      if (!Array.isArray(tickers)) tickers = [];
    } catch {
      const matches = raw.match(/\b[A-Z]{1,5}\b/g) || [];
      const blacklist = new Set(["THE","AND","FOR","NY","A","I","AN","OF","IN","TO","IS","IF","NO","YOU","ARE","JSON"]);
      tickers = [...new Set(matches.filter(t => !blacklist.has(t)))];
    }

    console.log("Tickers found:", tickers);
    return res.status(200).json({ tickers });

  } catch (error) {
    console.error("Vision error:", error);
    return res.status(500).json({
      error: error.message || "Error processing image",
      tickers: [],
    });
  }
}
