// backend/services/geminiVision.js
// Uses Gemini 1.5 Flash to auto-generate product descriptions from images

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate rich product description from an image buffer
 * @param {Buffer} imageBuffer - Raw image bytes
 * @param {string} mimeType - e.g. "image/jpeg"
 * @param {string} hint - Optional hint: product name, weight, price
 * @returns {Promise<ProductInfo>}
 */
export async function generateProductInfo(imageBuffer, mimeType = "image/jpeg", hint = "") {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

  const prompt = `
You are an expert product copywriter for an online oil shop called MadhuShud.
Analyze this product image and generate complete product information.

${hint ? `Product hint from seller: "${hint}"` : ""}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "name": "Full product name (max 60 chars)",
  "shortDesc": "One compelling sentence (max 120 chars)",
  "description": "Rich 3-paragraph description covering: what it is, health benefits, how to use. (150-200 words)",
  "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "category": "one of: oils, seeds, herbs, organic",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "weight": "detected weight/volume (e.g. 250ml, 500g) or null",
  "slug": "url-friendly-name-from-product-name"
}

Guidelines:
- Name must be professional and marketable
- Description must sound natural, NOT AI-generated
- Benefits must be health-focused and accurate
- All text in English
- slug: lowercase, hyphens only, no special chars
`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();
    
    // Extract JSON even if wrapped in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Gemini response");
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error("[GeminiVision] Error:", err.message);
    // Return a basic fallback so flow doesn't break
    return {
      name: hint || "New Product",
      shortDesc: "Premium quality oil from MadhuShud.",
      description: "A premium quality product from MadhuShud. Pure, natural, and carefully sourced for the best health benefits.",
      benefits: ["100% Pure", "Natural ingredients", "Health benefits", "Premium quality", "MadhuShud certified"],
      category: "oils",
      tags: ["pure", "natural", "premium", "oil", "health"],
      weight: null,
      slug: (hint || "new-product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    };
  }
}

/**
 * Generate a plain text product description update
 * (used when admin updates description via WhatsApp text)
 */
export async function improveDescription(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(
    `Improve this product description for an oil shop. Keep it natural, not AI-sounding. Max 200 words: "${text}"`
  );
  return result.response.text().trim();
}
