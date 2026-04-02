
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";

config({ path: ".env.local" });

const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

async function testAllModels() {
    console.log("Searching for working Gemini models...");
    const modelsToTest = [
        "gemini-2.0-flash", 
        "gemini-1.5-flash", 
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    for (const m of modelsToTest) {
        try {
            console.log(`Testing model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Say 'Active'");
            const text = result.response.text();
            if (text.includes("Active")) {
                console.log(`\n>>> SUCCESS! Model '${m}' is working correctly. <<<\n`);
                return m;
            }
        } catch (e) {
            console.log(`Failed for ${m}: ${e.message.substring(0, 100)}`);
        }
    }
    console.log("\nCould not find any working model from the predefined list.\n");
    return null;
}

testAllModels();
