// backend/routes/expiry.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Optional: simple shelf-life fallback
const shelfLifeDB = {
  milk: 7, bread: 5, eggs: 21, yogurt: 14, bananas: 4, "cereal bar": 180,
  "canned food": 720, juice: 365, rice: 365, pasta: 365,
};

function addDays(ymd, days) {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

router.post("/predict-expiry", async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    // 1) Download image and convert to base64
    const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const mimeType = imgResp.headers["content-type"] || "image/jpeg";
    const base64 = Buffer.from(imgResp.data).toString("base64");

    // 2) Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are a food donation assistant.
From this product image, extract a STRICT JSON object with these keys:

{
  "foodName": string | null,
  "brand": string | null,
  "expiryDate": string | null,  // YYYY-MM-DD if visible
  "manufactureDate": string | null, // YYYY-MM-DD if visible
  "category": string | null
}

Rules:
- Output JSON ONLY. No markdown, no text before/after.
- If a field is not visible, use null.
- If a printed/label date is clearly visible, set expiryDate to it (YYYY-MM-DD).
`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType } },
    ]);

    // 3) Parse Gemini output safely
    let raw = result.response.text().trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
    }

    let extracted;
    try {
      extracted = JSON.parse(raw);
    } catch (e) {
      console.error("Gemini raw output (unparseable):", raw);
      return res.status(500).json({ error: "Invalid AI response format" });
    }

    // 4) Fallback when expiryDate missing: try manufacture + shelf life
    if (!extracted.expiryDate && extracted.manufactureDate) {
      const key = (extracted.foodName || "").toLowerCase();
      const days = shelfLifeDB[key];
      if (days) {
        const est = addDays(extracted.manufactureDate, days);
        if (est) {
          extracted.expiryDate = est;
          extracted.estimatedExpiry = true;
        }
      }
    }

    // 5) Minimal response your Flutter expects
    return res.json({
      foodName: extracted.foodName || "",
      foodType: extracted.category || "",
      expiryDate: extracted.expiryDate || "",
      estimatedExpiry: !!extracted.estimatedExpiry,
    });
  } catch (err) {
    console.error("predict-expiry error:", err.message);
    return res.status(500).json({ error: "Prediction failed" });
  }
});

module.exports = router;
