const fs = require('fs');
const path = require('path');

// .env.local 직접 파싱
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
        const key = line.substring(0, idx).trim();
        let val = line.substring(idx + 1).trim();
        env[key] = val;
    }
});

async function testGemini() {
    console.log('=== Gemini API Test ===');
    console.log('API Key:', env.GEMINI_API_KEY?.substring(0, 15) + '...');

    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        console.log('Model created. Testing...');

        const result = await model.generateContent('Hello, please respond with just "OK"');
        const response = result.response.text();

        console.log('SUCCESS!');
        console.log('Response:', response);

    } catch (error) {
        console.log('FAILED!');
        console.log('Error:', error.message);
        console.log('Status:', error.status);
    }
}

testGemini();
