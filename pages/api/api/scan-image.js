export default async function handler(req, res) {
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
            source: { type: "base64", media_type: "image/jpeg", data: image }
          },
          {
            type: "text",
            text: "Extrae todos los tickers de acciones que veas. Responde SOLO con JSON array: [\"NIO\",\"TSLA\"]. Sin explicación."
          }
        ]
      }]
    })
  });
  const data = await response.json();
  const tickers = JSON.parse(data.content[0].text);
  res.json({ tickers });
}
