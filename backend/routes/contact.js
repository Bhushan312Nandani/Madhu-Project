// backend/routes/contact.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateMessageWithAI } from "../services/aiModeration.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, "../data/contactMessages.json");

// Ensure file exists
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
}

const WHATSAPP_NUMBER = "923332529504";

// POST: Validate with AI and Save contact form data
router.post("/", async (req, res) => {
  try {
    const { name, phone, message, topic = "General Inquiry" } = req.body;

    if (!name || !name.trim()) {
      return res.status(422).json({ success: false, message: "Please enter your name." });
    }

    if (!phone || !phone.trim()) {
      return res.status(422).json({ success: false, message: "Please enter your WhatsApp / phone number." });
    }

    if (!message || !message.trim()) {
      return res.status(422).json({ success: false, message: "Please write your message or inquiry." });
    }

    // Run Hugging Face AI validation & NLP spam/gibberish filter
    const aiResult = await validateMessageWithAI(message, name, phone);

    if (!aiResult.isValid) {
      return res.status(422).json({
        success: false,
        message: aiResult.reason || "Invalid or inappropriate inquiry detected.",
        aiFiltered: true,
      });
    }

    // Format clean professional message for WhatsApp
    const waText = 
      `*New Inquiry - MadhuShud Cold-Pressed Oils* 🌿\n\n` +
      `👤 *Customer:* ${name.trim()}\n` +
      `📱 *Phone:* ${phone.trim()}\n` +
      `📋 *Topic:* ${topic.trim()}\n\n` +
      `💬 *Message:*\n${message.trim()}\n\n` +
      `📍 *Mills Location:* Sadique Faqeer Chowk, Mithi, Tharparkar`;

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

    // Save message to contactMessages.json
    const newMessage = {
      id: "MSG-" + Date.now().toString(36).toUpperCase(),
      name: name.trim(),
      phone: phone.trim(),
      topic: topic.trim(),
      message: message.trim(),
      aiVerified: true,
      aiConfidence: aiResult.confidence || 0.9,
      aiCategory: aiResult.category || "Valid Inquiry",
      whatsappUrl,
      createdAt: new Date().toISOString(),
    };

    let existingData = [];
    try {
      if (fs.existsSync(dataFile)) {
        existingData = JSON.parse(fs.readFileSync(dataFile, "utf-8") || "[]");
      }
    } catch {
      existingData = [];
    }

    existingData.unshift(newMessage);
    // Keep last 500 messages
    if (existingData.length > 500) existingData = existingData.slice(0, 500);

    fs.writeFileSync(dataFile, JSON.stringify(existingData, null, 2));

    console.log(`[CONTACT] ✅ New AI-verified message from ${name} (${phone})`);

    return res.status(200).json({
      success: true,
      message: "Message verified successfully! Opening WhatsApp...",
      whatsappUrl,
      data: newMessage,
    });
  } catch (err) {
    console.error("[CONTACT] Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error processing message." });
  }
});

// GET: Fetch all messages (for admin panel)
router.get("/", (req, res) => {
  try {
    const existingData = JSON.parse(fs.readFileSync(dataFile, "utf-8") || "[]");
    res.json(existingData);
  } catch {
    res.json([]);
  }
});

export default router;
