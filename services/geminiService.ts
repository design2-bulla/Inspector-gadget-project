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

/**
 * Extracts multiple SKUs, their prices, and a visual description of the product.
 */
export const extractSkuFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedSkuResult> => {
  try {
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
            1. The SKU code (Reference/Ref/Item).
            2. The MAIN PRICE shown visually for that specific item.
            3. A short VISUAL DESCRIPTION of the product associated with that SKU (e.g. "Red plastic chair", "Drill set", "Toilet seat").

            Context:
            - A "product block" usually consists of a product image, a price, and a SKU.
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
                    visualDescription: { type: Type.STRING, description: "Short visual description of the item (3-5 words)" }
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

  } catch (error) {
    console.error("Error extracting SKU:", error);
    throw error;
  }
};

/**
 * Checks if the visual description from the art matches the product title from the web.
 */
export const verifyContentMatch = async (visualDescription: string, webTitle: string): Promise<boolean> => {
    if (!visualDescription || !webTitle) return true; // Can't compare, assume safe

    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Compare these two product descriptions. 
            Visual from Image: "${visualDescription}"
            Web Title: "${webTitle}"
            
            Are they describing the SAME TYPE of object? 
            Return TRUE if they are compatible (e.g. "Silla" vs "Silla de playa").
            Return FALSE if they are completely different objects (e.g. "Silla" vs "Olla", "Taladro" vs "Lámpara").
            
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
        // If match is TRUE, then there is NO mismatch.
        // If match is FALSE, there IS a mismatch.
        // We want to return 'true' if they MATCH.
        return json.match === true;

    } catch (e) {
        console.error("Error verifying content match", e);
        return true; // Default to passing in case of error
    }
}

/**
 * Analyzes the image for Spanish spelling and grammar errors.
 */
export const checkSpellingInImage = async (base64Image: string, mimeType: string): Promise<SpellingAnalysis> => {
    try {
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
              text: `Act as a strict Spanish proofreader for a retail catalog. 
              
              CRITICAL RULES TO AVOID HALLUCINATIONS:
              1. ONLY analyze text that is CLEARLY VISIBLE and LEGIBLE in the image.
              2. DO NOT invent words. If a word is not in the image, DO NOT report it.
              3. If you see ANY mark above a vowel (pixel, dust, artistic design), assume it is an accent. DO NOT correct words that might have an accent in a weird font.
              
              Identify spelling errors, specifically:
              1. Missing accents/tildes (CRITICAL). Even in UPPERCASE words or small legal text. 
                 Examples: "CREDITO" -> "CRÉDITO", "DIAS" -> "DÍAS", "TELEVISION" -> "TELEVISIÓN", "VALIDO" -> "VÁLIDO".
              2. Typos in common words.
              3. Incorrect abbreviations.

              Ignore:
              - Product codes (SKUs), Model numbers like "50A6NV", Prices.
              - Brand names (e.g., "Novey", "Samsung", "DeWalt", "Hisense", "Garden Basics").
              - English terms commonly used (e.g., "OFF", "Sale", "Black Friday", "Cyber Week", "Smart TV", "UHD", "4K").
              - URLs or hashtags.

              Return a JSON object with:
              - hasErrors: boolean
              - corrections: array of objects { original: "wrong word", suggestion: "correct word", context: "short phrase from the image where the error appears" }`
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
  
    } catch (error) {
      console.error("Error checking spelling:", error);
      return { hasErrors: false, corrections: [] };
    }
  };

/**
 * Uses Gemini with Google Search Grounding to validate the SKU on novey.com.pa
 */
export const validateSkuWithWeb = async (sku: string): Promise<NoveyProductDetails> => {
  try {
    const ai = getAiClient();
    
    // Create variations of the SKU to improve search hit rate
    const cleanSku = sku.replace(/-/g, ''); // Remove hyphens
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Perform a thorough search for the product on "novey.com.pa".
      
      Search Strategy:
      1. Search for SKU "${sku}".
      2. If not found, search for SKU "${cleanSku}" (without hyphens).
      3. Look for the specific product page on novey.com.pa.

      Extraction Rules:
      - title: The full name of the product.
      - price: The CURRENT selling price (e.g. "$12.99").
      - regularPrice: The original price BEFORE discount (if visible).
      - url: The direct link to the product.
      - imageUrl: Look for the main product image. Preferably extract the 'og:image' meta tag URL if available in the snippet, or the main product image URL. It must be a direct link (ending in .jpg, .png, etc.) if possible.
      
      If you cannot find the specific SKU on Novey:
      - Set "found" to false.
      - If you found a VERY similar product (e.g. same product but SKU format is different, like N0123 vs 123), return that SKU in the "skuSuggestion" field.
      
      Return a JSON object (strictly valid JSON).`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const data = JSON.parse(text);
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
      console.error("Failed to parse validation JSON:", text);
      return { found: false };
    }

  } catch (error) {
    console.error("Error validating SKU with web:", error);
    return { found: false };
  }
};