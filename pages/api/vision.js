import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
    const chatCompletion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType || "image/jpeg"};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: `Analyze this image and extract ALL stock ticker symbols you can see.
Tickers are usually 1-5 uppercase letters (like AAPL, SOFI, MARA, HOOD, RIOT, CLSK, NXL).
They may appear in watchlists, tables, charts, articles, or screeners.

Return ONLY a JSON array of ticker strings, nothing else.
Example: ["SOFI","MARA","HOOD","RIOT","CLSK"]

If you find no tickers, return: []`,
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const raw = chatCompletion.choices[0]?.message?.content?.trim() || "[]";

    // Parse safely — strip any markdown fences if present
    const clean = raw.replace(/```json|```/g, "").trim();
    let tickers = [];

    try {
      tickers = JSON.parse(clean);
      if (!Array.isArray(tickers)) tickers = [];
    } catch {
      // Fallback: extract uppercase words from the response
      const matches = raw.match(/\b[A-Z]{1,5}\b/g) || [];
      const blacklist = new Set(["THE","AND","FOR","NY","A","I","AN","OF","IN","TO","IS","IF","NO"]);
      tickers = [...new Set(matches.filter(t => !blacklist.has(t)))];
    }

    return res.status(200).json({ tickers });

  } catch (error) {
    console.error("Groq vision error:", error);
    return res.status(500).json({
      error: error.message || "Error processing image",
      tickers: [],
    });
  }
}
