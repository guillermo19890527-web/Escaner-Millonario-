export async function extractTickersFromImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType: file.type
          })
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Error en el servidor');
        }
        const data = await res.json();
        resolve(data.tickers || []);
      } catch (error) {
        console.error('Error llamando a /api/vision:', error);
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
