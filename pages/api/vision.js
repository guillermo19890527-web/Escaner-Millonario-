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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Analyze this image and extract ALL stock ticker symbols you can see.
Tickers are usually 1-5 uppercase letters (like AAPL, SOFI, MARA, HOOD, RIOT, CLSK).
They may appear in watchlists, tables, charts, articles, or screeners.

Return ONLY a JSON array of ticker strings, nothing else.
Example: ["SOFI","MARA","HOOD","RIOT","CLSK"]

If you find no tickers, return: []`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || "Claude API error");
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();

    let tickers = [];
    try {
      tickers = JSON.parse(clean);
      if (!Array.isArray(tickers)) tickers = [];
    } catch {
      const matches = raw.match(/\b[A-Z]{1,5}\b/g) || [];
      const blacklist = new Set(["THE","AND","FOR","NY","A","I","AN","OF","IN","TO","IS","IF","NO"]);
      tickers = [...new Set(matches.filter(t => !blacklist.has(t)))];
    }

    return res.status(200).json({ tickers });

  } catch (error) {
    console.error("Claude vision error:", error);
    return res.status(500).json({
      error: error.message || "Error processing image",
      tickers: [],
    });
  }
}
