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

async function listModels() {
    console.log('=== List Available Models ===');
    console.log('API Key:', env.GEMINI_API_KEY);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`
        );
        const data = await response.json();

        if (data.error) {
            console.log('ERROR:', data.error.message);
            console.log('Code:', data.error.code);
        } else if (data.models) {
            console.log('\nAvailable Models:');
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName})`);
            });
        } else {
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log('FAILED:', error.message);
    }
}

listModels();
