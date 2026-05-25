import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method!== "POST") return res.status(405).end();

  const { imageBase64, mediaType } = req.body;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae todos los tickers bursátiles de esta imagen. Responde SOLO JSON sin backticks: {"tickers":[{"symbol":"AAPL","name":"Apple Inc."}]}. Si no hay tickers, devuelve {"tickers":[]}`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mediaType || "image/jpeg"};base64,${imageBase64}`
            }
          }
        ]
      }],
      model: "llama-3.2-90b-vision-preview",
      max_tokens: 1000,
    });

    const content = chatCompletion.choices[0]?.message?.content || '{"tickers":[]}';
    const jsonData = JSON.parse(content);
    res.status(200).json(jsonData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: err.message } });
  }
}
