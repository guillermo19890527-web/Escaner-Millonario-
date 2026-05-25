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
        model: "claude-opus-4-5",
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
              text: "Eres un experto en mercados financieros. Analiza esta imagen cuidadosamente y extrae TODOS los símbolos/tickers de acciones que puedas ver, aunque la imagen sea pequeña u oscura. Los tickers son palabras en MAYÚSCULAS de 1-5 letras como NIO, TSLA, AAPL, SOFI, MARA, HOOD, RIOT. Ignora palabras comunes como THE, AND, FOR, USD. Responde ÚNICAMENTE con un array JSON, ejemplo: [\"NIO\",\"TSLA\",\"AAPL\"]. Sin explicación."
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
