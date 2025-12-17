import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedSkuResult, NoveyProductDetails, SpellingAnalysis } from "../types";

// Helper to get AI instance safely
const getAiClient = () => {
  // Priority 1: Environment Variable (Vercel)
  const envKey = process.env.API_KEY;
  if (envKey && envKey.length > 0 && envKey !== 'undefined') {
    return new GoogleGenAI({ apiKey: envKey });
  }

  // Priority 2: Local Storage (Manual Entry)
  const localKey = localStorage.getItem('art_inspector_api_key');
  if (localKey) {
    return new GoogleGenAI({ apiKey: localKey });
  }

  throw new Error("API_KEY_MISSING");
};

export const hasValidApiKey = (): boolean => {
    try {
        getAiClient();
        return true;
    } catch (e) {
        return false;
    }
};

export const saveManualApiKey = (key: string) => {
    localStorage.setItem('art_inspector_api_key', key.trim());
};

// --- RETRY LOGIC FOR ROBUSTNESS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runWithRetry<T>(operation: () => Promise<T>, retries = 3, context = "Operation"): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            // Check for Rate Limit (429) or Service Unavailable (503)
            const errorMsg = error.message?.toLowerCase() || "";
            const isRateLimit = errorMsg.includes('429') || error.status === 429 || errorMsg.includes('too many requests');
            const isOverloaded = errorMsg.includes('503') || error.status === 503 || errorMsg.includes('overloaded');
            
            if (isRateLimit || isOverloaded) {
                // If Overloaded (503), wait longer (4s base) than simple Rate Limit (2s base)
                const baseWait = isOverloaded ? 4000 : 2000;
                const waitTime = baseWait * (i + 1);
                
                console.warn(`${context} hit limit/overload. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
            } else {
                // If it's a different error (e.g. Bad Request), maybe don't retry immediately or retry shorter
                console.warn(`${context} failed. Retrying... (${i + 1}/${retries})`);
                await delay(1000);
            }
        }
    }
    throw lastError;
}

/**
 * Extracts multiple SKUs, their prices, and a visual description of the product.
 */
export const extractSkuFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedSkuResult> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          {
            text: `Analyze this marketing image for Novey. 
            Identify ALL product blocks. For each product block, extract:
            1. The SKU code (Reference/Ref/Item). BE PRECISE. Distinguish '8' from 'B', '0' from 'O'.
            2. The MAIN PRICE shown visually for that specific item.
            3. A short, GENERIC VISUAL DESCRIPTION (3-5 words). Example: "Silla blanca", "Taladro amarillo", "Juego de ollas". Do not be too specific about background details.

            Context:
            - If there is a "Sale Price" and a "Regular Price" visually, grab the SALE PRICE (the main big one).
            - Convert the price to a number.
            
            Return a JSON object containing an array of product objects.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              description: "List of products found with their visual data.",
              items: {
                type: Type.OBJECT,
                properties: {
                    sku: { type: Type.STRING, description: "The SKU code detected" },
                    priceOnArt: { type: Type.NUMBER, description: "The numeric price detected visually", nullable: true },
                    visualDescription: { type: Type.STRING, description: "Generic visual description of the item type" }
                },
                required: ["sku", "visualDescription"]
              }
            }
          },
          required: ["products"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(resultText);
    
    // Clean and deduplicate based on SKU
    const rawProducts = parsed.products || [];
    
    const uniqueProducts: any[] = [];
    const seenSkus = new Set();

    for (const p of rawProducts) {
        const cleanSku = p.sku.trim();
        if (!seenSkus.has(cleanSku)) {
            seenSkus.add(cleanSku);
            uniqueProducts.push({
                sku: cleanSku,
                priceOnArt: p.priceOnArt,
                visualDescription: p.visualDescription
            });
        }
    }

    return {
      products: uniqueProducts
    };
  }, 3, "Extract SKU");
};

/**
 * Checks if the visual description from the art matches the product title from the web.
 */
export const verifyContentMatch = async (visualDescription: string, webTitle: string): Promise<boolean> => {
    if (!visualDescription || !webTitle) return true;

    // Fast pass: If web title contains specific key words from visual, assume match
    return runWithRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Act as a tolerant judge. Compare these two descriptions.
            
            Visual from Image: "${visualDescription}"
            Web Title: "${webTitle}"
            
            Are they plausibly the SAME kind of object?
            
            Rules:
            - BE TOLERANT. If visual says "Caja" or "Envase" and Web says "Pintura" or "Organizadora", it is a MATCH.
            - If visual says "Herramienta" and Web says "Taladro", it is a MATCH.
            - ONLY return FALSE if it is a blatant contradiction (e.g. Visual: "Silla" vs Web: "Estufa").
            
            Respond with JSON { match: boolean }`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        match: { type: Type.BOOLEAN }
                    },
                    required: ["match"]
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        return json.match === true;
    }, 2, "Verify Content");
}

/**
 * Analyzes the image for Spanish spelling and grammar errors.
 */
export const checkSpellingInImage = async (base64Image: string, mimeType: string): Promise<SpellingAnalysis> => {
    return runWithRetry(async () => {
      const ai = getAiClient();
      const cleanBase64 = base64Image.split(',')[1] || base64Image;
  
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            },
            {
              text: `Act as a conservative and skeptical Spanish proofreader for marketing materials.

              TASK: Identify *undeniable* spelling errors in the VISIBLE text.
              
              CRITICAL ANTI-HALLUCINATION RULES:
              1. **OCR Verification**: You must SEE the text clearly. Do not infer words that "should" be there.
              2. **Ambiguity Tolerance**: If a word appears misspelled (e.g., "resistent" instead of "resistente") but the text might be cut off, or the font is low contrast, or the last letter is stylized, **IGNORE IT**. Assume it is correct.
              3. **False Positives**: It is much worse to flag a correct word as an error than to miss an error.
              4. **Ignore**:
                 - Words with foreign roots used in marketing (e.g., "Smart", "EasyClean", "Inverter").
                 - Words that are partially obscured or at the edge of the image.
                 - Proper nouns or brand names.
              
              ONLY report an error if:
              - The word is fully visible, high contrast, and clearly spelled wrong (e.g., "Ofrta", "Cancion" without accent, "Mas" without accent meaning 'more').
              - You are 100% certain it is not an OCR mistake.

              Return a JSON object.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasErrors: { type: Type.BOOLEAN },
              corrections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    context: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["hasErrors", "corrections"]
          }
        }
      });
  
      const resultText = response.text;
      if (!resultText) return { hasErrors: false, corrections: [] };
      
      return JSON.parse(resultText) as SpellingAnalysis;
    }, 2, "Spelling Check");
};

/**
 * Uses Gemini with Google Search Grounding to validate the SKU on novey.com.pa
 */
export const validateSkuWithWeb = async (sku: string): Promise<NoveyProductDetails> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    const cleanSku = sku.replace(/-/g, '');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for product on "novey.com.pa".
      
      Query: "${sku}" OR "${cleanSku}" site:novey.com.pa
      
      Task:
      1. Find the specific product page.
      2. VERIFY: Does the result (Title, Snippet, OR URL) confirm this is the product "${sku}"?
         - If the URL contains the SKU number (e.g. .../100-123...), it is a match.
         - If the title contains the SKU, it is a match.
         - If the result is a completely different product, set found: false.
      
      Extraction:
      - title
      - price (Current price)
      - regularPrice (Before discount)
      - url
      - imageUrl (Prefer og:image)
      
      If exact SKU is not found but you see a very similar code (e.g. searching for 123-A and finding 123), suggest it in 'skuSuggestion'.
      
      Return JSON.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const data = JSON.parse(text);

      // Force valid found status if title OR URL contains SKU.
      // This is much more robust than title only.
      const skuInTitle = data.title && (data.title.includes(sku) || data.title.includes(cleanSku));
      const skuInUrl = data.url && (data.url.includes(sku) || data.url.includes(cleanSku));

      if (skuInTitle || skuInUrl) {
          data.found = true;
      }

      return {
        found: data.found,
        title: data.title,
        price: data.price,
        regularPrice: data.regularPrice,
        url: data.url,
        imageUrl: data.imageUrl,
        description: data.description,
        skuSuggestion: data.skuSuggestion
      };
    } catch (parseError) {
      return { found: false };
    }
  }, 3, "Validate Web");
};