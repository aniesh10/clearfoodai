exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, preferences } = JSON.parse(event.body);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY in Netlify environment variables' })
      };
    }

    // Extract raw base64 data and mime type
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `You are an expert food safety and nutrition analyst. Analyze this food label image based on user preferences: ${preferences && preferences.length ? preferences.join(', ') : 'None'}.

Categorize ALL extracted ingredients into strictly one of these 5 categories:

1. "allergens": Ingredients that specifically trigger the selected user preferences/allergies (e.g., peanuts, dairy, wheat, soy). If no preference matches, do not put safe foods here.
2. "unhealthy": Artificial additives, trans fats, hydrogenated oils, artificial dyes, high-fructose corn syrup, ultra-processed preservatives, or excessive harmful chemicals.
3. "moderate": Ingredients to consume in moderation (e.g., added cane sugar, palm oil, moderate sodium, natural sweeteners, refined flours).
4. "whole_green": Minimally processed, nutritious whole foods (e.g., oats, nuts, seeds, whole grains, natural spices, sea salt, water).
5. "unverified": Ingredients that are unreadable, truncated, or ambiguous (e.g., "Flavoring #3", partial text).

RULES:
- Standard table salt and modest cane sugar belong in "moderate", NOT "unhealthy", unless extreme excess is present.
- If a user did NOT flag an allergy (e.g., milk/peanuts), place that ingredient into "whole_green" or "moderate" based on its nutritional profile.

Return ONLY a JSON object matching this schema:
{
  "health_score": number (1-10),
  "score_label": string ("Excellent" | "Good" | "Moderate" | "Poor" | "Unhealthy"),
  "score_color": string ("emerald" | "green" | "amber" | "orange" | "red"),
  "score_summary": string,
  "raw_ocr": string,
  "allergens": [ { "name": string, "reason": string } ],
  "unhealthy": [ { "name": string, "reason": string } ],
  "moderate": [ { "name": string, "reason": string } ],
  "whole_green": [ string ],
  "unverified": [ string ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Gemini Error:', JSON.stringify(data));
      return {
        statusCode: response.status || 500,
        body: JSON.stringify({ error: data.error?.message || 'Gemini API request failed' })
      };
    }

    const jsonText = data.candidates[0].content.parts[0].text;
    const resultJson = JSON.parse(jsonText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultJson)
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to process image' })
    };
  }
};
