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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
                text: `Analyze this image and extract ALL stock ticker symbols you can see.
Tickers are 1-5 uppercase letters (AAPL, SOFI, MARA, HOOD, RIOT, CLSK).
Return ONLY a JSON array, nothing else.
Example: ["SOFI","MARA","HOOD","RIOT"]
If no tickers found, return: []`
              }
            ]
          }]
        }),
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
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
    console.error("Gemini vision error:", error);
    return res.status(500).json({
      error: error.message || "Error processing image",
      tickers: [],
    });
  }
}
