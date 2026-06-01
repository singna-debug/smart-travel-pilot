const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { parseTelegramInquiry } = require('./lib/ai-engine');

// 만약 GEMINI_API_KEY가 없고 GOOGLE_GENAI_API_KEY가 있으면 복사
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

async function run() {
    console.log('Using GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
    const text = '이영희님 010-1234-5678 인스타그램 보고 연락옴 일본 후쿠오카 6월 3박4일 가족여행';
    console.log('Testing text:', text);
    
    try {
        const result = await parseTelegramInquiry(text);
        console.log('Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('Error running test:', e);
        process.exit(1);
    }
}

run();
