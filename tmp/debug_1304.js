const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const line = lines[1303]; // 1304 is index 1303
console.log(`Line 1304: "${line}"`);
for (let i = 0; i < line.length; i++) {
    console.log(`${i}: ${line[i]} (${line.charCodeAt(i)})`);
}
