export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "Eres un escáner de bolsa. Extrae TODOS los ticker symbols de acciones que veas en esta imagen. Solo regresa los tickers en mayúsculas separados por comas. Ejemplo: AAPL,TSLA,NVDA,SOFI. Si no hay tickers regresa: NONE. No expliques nada, solo los tickers.";
    
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);
    
    const text = result.response.text().trim();
    res.status(200).json({ tickers: text });
    
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Error processing image with Gemini' });
  }
}
