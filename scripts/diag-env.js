const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env.local') });

let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
console.log('Original start:', jsonStr.substring(0, 50));

try {
    if (jsonStr.startsWith('"')) {
        console.log('Outer quotes detected, attempting first parse...');
        jsonStr = JSON.parse(jsonStr);
        console.log('After first parse start:', jsonStr.substring(0, 50));
    }

    const obj = JSON.parse(jsonStr);
    console.log('Success! Project ID:', obj.project_id);
} catch (e) {
    console.error('Failed:', e.message);
    // If that failed, try basic replacement
    let fallback = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
    if (fallback.startsWith('"')) fallback = fallback.substring(1, fallback.length - 1);
    fallback = fallback.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    try {
        JSON.parse(fallback);
        console.log('Fallback success!');
    } catch (e2) {
        console.error('Fallback also failed:', e2.message);
    }
}
