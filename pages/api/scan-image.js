export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  try {
    const { image } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image
              }
            },
            {
              type: "text",
              text: "Extrae todos los tickers de acciones de esta imagen. Responde ÚNICAMENTE con un array JSON válido, ejemplo: [\"NIO\",\"TSLA\"]. Sin texto adicional."
            }
          ]
        }]
      })
    });
    const data = await response.json();
    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, "").trim();
    const tickers = JSON.parse(clean);
    res.status(200).json({ tickers });
  } catch (err) {
    console.error(err);
    res.status(200).json({ tickers: [] });
  }
}
