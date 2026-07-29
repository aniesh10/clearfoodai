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
        body: JSON.stringify({ error: 'Missing Groq API Key in environment variables' })
      };
    }

    const systemPrompt = `
      You are a food safety assistant. Analyze this ingredient label.
      User Preferences/Allergies: ${preferences.length > 0 ? preferences.join(', ') : 'None'}.

      Categorize ingredients strictly into:
      - severe_allergens: Matches preferences or FDA top allergens.
      - high_risk: Harmful additives (Nitrites, Hydrogenated oils, Red 40).
      - moderate_risk: Preservatives/sweeteners (Sucralose, BHT).
      - safe_whole_foods: Natural ingredients, spices, vitamins.
      - unverified: Unclear or unclassified ingredients.

      Return ONLY a JSON object matching this structure:
      {
        "health_score": 6.5,
        "score_label": "Moderate Health Risk",
        "score_summary": "Summary here",
        "raw_ocr": "Raw text extracted",
        "severe_allergens": [{"name": "Item", "reason": "Reason"}],
        "high_risk": [{"name": "Item", "reason": "Reason"}],
        "moderate_risk": [{"name": "Item", "reason": "Reason"}],
        "safe_whole_foods": ["Item 1"],
        "unverified": ["Item 1"]
      }
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API Error:', data);
      return {
        statusCode: response.status,
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
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to analyze image' })
    };
  }
};