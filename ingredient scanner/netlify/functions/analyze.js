exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, preferences } = JSON.parse(event.body);
    const GROQ_API_KEY = process.env.GROQ_API_KEY; // Securely pulled from Netlify environment variables

    if (!GROQ_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error: Missing API Key' })
      };
    }

    const systemPrompt = `
      You are an expert food safety & OCR assistant. Analyze the ingredient label image.
      User Active Preferences/Allergies: ${preferences.join(', ')}.

      Categorize extracted ingredients strictly into these 5 groups:
      1. severe_allergens: Matches user preferences/allergies or top FDA allergens.
      2. high_risk: Harmful additives (e.g., Nitrites, Hydrogenated oils, Red 40).
      3. moderate_risk: Controversial preservatives/sweeteners (e.g., Sucralose, BHT).
      4. safe_whole_foods: Natural ingredients, spices, vitamins, whole foods.
      5. unverified: Ingredients that cannot be clearly classified or read.

      Return ONLY a valid JSON object matching this exact structure with no extra text or markdown code blocks:
      {
        "health_score": 6.5,
        "score_label": "Moderate Health Risk",
        "score_summary": "Short 1-sentence summary explanation",
        "raw_ocr": "Exact raw text read from label",
        "severe_allergens": [{"name": "Item Name", "reason": "Reason/Flag"}],
        "high_risk": [{"name": "Item Name", "reason": "Reason/Flag"}],
        "moderate_risk": [{"name": "Item Name", "reason": "Reason/Flag"}],
        "safe_whole_foods": ["Item 1", "Item 2"],
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
    const resultJson = JSON.parse(data.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultJson)
    };

  } catch (error) {
    console.error('Error analyzing label:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze image' })
    };
  }
};