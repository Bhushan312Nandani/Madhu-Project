import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  const now = new Date();
  res.json({ timestamp: now.getTime() });
});

export default router;
