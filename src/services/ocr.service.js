// src/services/ocr.service.js

const { 
  OPENAI_API_KEY, 
  OPENAI_BASE_URL, 
  OPENAI_MODEL,
  OPENAI_INPUT_PROMPT,
  OPENAI_MAX_OUTPUT_TOKENS 
} = require('../config/env');

const extractOCR = async (userId, body) => {
  const { imageUrl } = body;

  if (!userId || !imageUrl) {
    throw new Error('imageUrl is required');
  }

  const aiResponse = await callOpenAIVision(imageUrl);

  const parsedData = parseOCRResponse(aiResponse);

  return parsedData;
};

const callOpenAIVision = async (imageUrl) => {
  console.log('Calling OpenAI Vision API with imageUrl:', imageUrl);

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: OPENAI_INPUT_PROMPT
            },
            {
              type: 'input_image',
              image_url: imageUrl
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "medicine_schema",
          schema: {
            type: "object",
            properties: {
              medicine_name: { type: "string" },
              generic_name: { type: "string" },
              strength: { type: "string" },
              form: { type: "string" }
            },
            required: ["medicine_name", "generic_name", "strength", "form"],
            additionalProperties: false
          }
        }
      },
      max_output_tokens: 100
    }),
  });

  const responseBody = await response.json();

  if (!response.ok) {
    console.error('OpenAI Error:', responseBody);
    throw new Error('OpenAI API failed');
  }

  return responseBody;
};

const parseOCRResponse = (aiResponse) => {
  try {
    const content = aiResponse.output[0].content[0];

    let raw;

    // ✅ Preferred (json_schema)
    if (content.json) {
      raw = content.json;
    } 
    // ✅ Fallback (if model still returns text)
    else if (content.text) {
      let text = content.text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      raw = JSON.parse(text);
    } 
    else {
      throw new Error('Invalid OCR response format');
    }

    return {
      medicineName: normalizeValue(raw.medicine_name),
      genericName: normalizeValue(raw.generic_name),
      strength: normalizeValue(raw.strength),
      form: normalizeValue(raw.form)
    };

  } catch (err) {
    console.error('OCR FULL RESPONSE:', JSON.stringify(aiResponse, null, 2));
    throw new Error('OCR parsing failed');
  }
};

const normalizeValue = (val) => {
  if (!val || val === 'NC') return null;
  return val;
};

module.exports = {
  extractOCR,
};