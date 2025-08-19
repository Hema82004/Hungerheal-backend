require("dotenv").config();
const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testGemini() {
    try {
        const resp = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: "Say hello, Gemini!" }]
                }]
            }
        );

        console.log("✅ Gemini API Response:");
        console.log(resp.data.candidates[0].content.parts[0].text);

    } catch (err) {
        console.error("❌ Gemini API test failed");
        console.error(err.response?.data || err.message);
    }
}

testGemini();
