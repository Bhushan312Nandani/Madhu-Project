import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

// JSON file ka path (server ke andar ek "data" folder banao)
const dataFile = path.resolve("data/contactMessages.json");

// Ensure file exists
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// POST: Save contact form data
router.post("/", (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !phone || !message) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  const newMessage = {
    id: Date.now(),
    name,
    email,
    phone,
    message,
  };

  const existingData = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
  existingData.push(newMessage);
  fs.writeFileSync(dataFile, JSON.stringify(existingData, null, 2));

  res.json({ message: "Message received successfully!", data: newMessage });
});

// GET: Fetch all messages (for testing/admin)
router.get("/", (req, res) => {
  const existingData = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
  res.json(existingData);
});

export default router;
