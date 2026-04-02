
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";

config({ path: ".env.local" });

const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
    console.log("Testing potential Gemini models...");
    const models = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-pro",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b"
    ];

    for (const m of models) {
        try {
            process.stdout.write(`Testing ${m}... `);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("hi");
            if (result.response.text()) {
                console.log("SUCCESS!");
                console.log(`\n>>> FOUND WORKING MODEL: ${m} <<<\n`);
                return m;
            }
        } catch (e) {
            console.log(`FAILED (${e.message.substring(0, 50)})`);
        }
    }
    return null;
}

testModels();
