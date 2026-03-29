
const fs = require('fs');
const path = require('path');

const logPath = path.join(process.cwd(), 'logs', 'latest_source_text.txt');
const outPath = path.join(process.cwd(), 'debug_clean_text.txt');

try {
    if (fs.existsSync(logPath)) {
        // Read as buffer and convert to string (assuming UTF-8 or trying to auto-detect if possible, but usually fs handles UTF-8)
        // If the original file was written by Puppeteer/Node, it should be UTF-8. 
        // The issue might be the console output encoding.
        const content = fs.readFileSync(logPath, 'utf8');
        fs.writeFileSync(outPath, content, 'utf8');
        console.log('Successfully wrote to debug_clean_text.txt');
    } else {
        console.log('Log file not found at:', logPath);
    }
} catch (e) {
    console.error('Error:', e);
}
