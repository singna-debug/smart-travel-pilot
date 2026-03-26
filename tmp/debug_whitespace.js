const fs = require('fs');
const path = 'c:/Users/vbxn6/.gemini/antigravity/scratch/smart-travel-pilot/app/confirmation/[id]/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
console.log('Line 1147 content:');
const line1147 = lines[1146]; // 0-indexed
console.log(JSON.stringify(line1147));
for (let i = 0; i < line1147.length; i++) {
    console.log(`${i}: ${line1147[i]} (${line1147.charCodeAt(i)})`);
}
