exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, preferences } = JSON.parse(event.body);
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing GROQ_API_KEY environment variable in Netlify' })
      };
    }

    const systemPrompt = `You are a food safety assistant. Analyze this ingredient label image based on user preferences: ${preferences && preferences.length ? preferences.join(', ') : 'None'}. Return a JSON object with keys: health_score (number 1-10), score_label (string), score_summary (string), raw_ocr (string), allergens (array of objects with name and reason), unhealthy (array of objects with name and reason), moderate (array of objects with name and reason), green (array of strings), unverified (array of strings).`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok || data.error || !data.choices) {
      console.error('Groq Error Detail:', JSON.stringify(data));
      return {
        statusCode: response.status || 500,
        body: JSON.stringify({ error: data.error?.message || 'Groq API request failed' })
      };
    }

    const resultJson = JSON.parse(data.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultJson)
    };

  } catch (error) {
    console.error('Handler catch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to analyze image' })
    };
  }
};
