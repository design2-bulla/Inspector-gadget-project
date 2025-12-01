

import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedSkuResult, NoveyProductDetails, SpellingAnalysis } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts multiple SKUs AND their associated visual prices from a provided image.
 */
export const extractSkuFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedSkuResult> => {
  try {
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

            Context:
            - A "product block" usually consists of a product image, a price, and a SKU.
            - If there is a "Sale Price" and a "Regular Price" visually, grab the SALE PRICE (the main big one).
            - Convert the price to a number (e.g. if image says "$12.99", return 12.99).
            - If no price is clearly associated with the SKU, return null for price.
            
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
                    priceOnArt: { type: Type.NUMBER, description: "The numeric price value detected visually next to this SKU", nullable: true }
                },
                required: ["sku"]
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
    
    // Simple dedup logic: keep the first occurrence of a SKU
    const uniqueProducts: any[] = [];
    const seenSkus = new Set();

    for (const p of rawProducts) {
        const cleanSku = p.sku.trim();
        if (!seenSkus.has(cleanSku)) {
            seenSkus.add(cleanSku);
            uniqueProducts.push({
                sku: cleanSku,
                priceOnArt: p.priceOnArt
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
 * Analyzes the image for Spanish spelling and grammar errors.
 */
export const checkSpellingInImage = async (base64Image: string, mimeType: string): Promise<SpellingAnalysis> => {
    try {
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
              text: `Act as a strict Spanish proofreader for a retail catalog. Analyze ALL visible text.
              
              Identify spelling errors, specifically:
              1. Missing accents/tildes (CRITICAL). Even in UPPERCASE words or small legal text. 
                 Examples: "CREDITO" -> "CRÉDITO", "DIAS" -> "DÍAS", "TELEVISION" -> "TELEVISIÓN", "VALIDO" -> "VÁLIDO".
              2. Typos in common words.
              3. Incorrect abbreviations.

              Ignore:
              - Product codes (SKUs), Model numbers, Prices.
              - Brand names (e.g., "Novey", "Samsung", "DeWalt", "Hisense").
              - English terms commonly used (e.g., "OFF", "Sale", "Black Friday", "Cyber Week", "Smart TV").
              - URLs or hashtags.

              Return a JSON object with:
              - hasErrors: boolean
              - corrections: array of objects { original: "wrong word", suggestion: "correct word", context: "short reason" }`
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for the product with SKU "${sku}" specifically on the website "novey.com.pa".
      
      Return a JSON object (strictly valid JSON) with:
      - found: boolean
      - title: The full name of the product.
      - price: The CURRENT selling price (e.g. "$12.99").
      - regularPrice: The original price BEFORE discount (if visible).
      - url: The direct link to the product.
      - imageUrl: Direct URL to the product image.
      
      If you cannot find the specific SKU on Novey, set "found" to false.`,
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
        description: data.description
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