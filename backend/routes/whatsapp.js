// backend/routes/whatsapp.js
// Meta WhatsApp Cloud API webhook
// Secured: HMAC-SHA256 signature verification + admin-only bot

import express from "express";
import crypto from "crypto";
import { handleWhatsAppMessage } from "../services/whatsappBot.js";

const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

// ─── Webhook Verification (GET) ───────────────────────────────────────────────
// Meta calls this endpoint to verify your webhook URL
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WA Webhook] Verified successfully ✅");
    return res.status(200).send(challenge);
  }

  console.warn("[WA Webhook] Verification failed — token mismatch");
  res.sendStatus(403);
});

// ─── Receive Messages (POST) ──────────────────────────────────────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Raw body for signature verification
  async (req, res) => {
    // 1. Verify Meta signature (HMAC-SHA256)
    const signature = req.headers["x-hub-signature-256"];
    if (!verifySignature(req.body, signature)) {
      console.warn("[WA Webhook] Invalid signature — possible spoofing attempt");
      return res.sendStatus(401);
    }

    // 2. Parse body
    const body = JSON.parse(req.body.toString());

    // 3. Acknowledge immediately (Meta requires <5s response)
    res.sendStatus(200);

    // 4. Process async
    try {
      if (body.object !== "whatsapp_business_account") return;

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== "messages") continue;

          const messages = change.value?.messages || [];
          for (const message of messages) {
            // Process each message asynchronously
            handleWhatsAppMessage(message).catch(err => {
              console.error("[WA Webhook] Handler error:", err.message);
            });
          }
        }
      }
    } catch (err) {
      console.error("[WA Webhook] Parse error:", err.message);
    }
  }
);

// ─── Signature Verification ───────────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  if (!signature || !APP_SECRET) return false;

  try {
    const expectedSig = "sha256=" + crypto
      .createHmac("sha256", APP_SECRET)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

export default router;
