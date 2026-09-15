// backend/services/whatsappApi.js
// Meta WhatsApp Cloud API — send messages & download media

import axios from "axios";

const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION = "v20.0";
const WA_BASE = `https://graph.facebook.com/${WA_API_VERSION}`;

/**
 * Send a text message via WhatsApp Cloud API
 * @param {string} to - Recipient phone number (e.g. "923332529504")
 * @param {string} body - Message text (supports *bold* and _italic_)
 */
export async function sendWhatsAppMessage(to, body) {
  try {
    await axios.post(
      `${WA_BASE}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body, preview_url: false },
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
  } catch (err) {
    console.error("[WA API] Send error:", err.response?.data || err.message);
    // Don't throw — message failure shouldn't break the flow
  }
}

/**
 * Download media from WhatsApp (image, document etc.)
 * @param {string} mediaId - WhatsApp media ID
 * @returns {Promise<Buffer>} - Image buffer
 */
export async function downloadWhatsAppMedia(mediaId) {
  // Step 1: Get media URL
  const { data: mediaInfo } = await axios.get(
    `${WA_BASE}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      timeout: 10000,
    }
  );

  // Step 2: Download media bytes
  const { data: imageBuffer } = await axios.get(mediaInfo.url, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
    responseType: "arraybuffer",
    timeout: 30000,
  });

  return Buffer.from(imageBuffer);
}

/**
 * Send a template message (e.g. order confirmation)
 * Requires pre-approved template on Meta Business
 */
export async function sendTemplateMessage(to, templateName, components = []) {
  try {
    await axios.post(
      `${WA_BASE}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("[WA API] Template error:", err.response?.data || err.message);
  }
}
