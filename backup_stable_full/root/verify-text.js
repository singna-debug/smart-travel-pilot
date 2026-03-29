const fs = require('fs');

const text = fs.readFileSync('debug_text.txt', 'utf-8');
console.log('Text length:', text.length);
console.log('Includes 타이페이:', text.includes('타이페이'));
console.log('Includes 949,000:', text.includes('949,000'));
console.log('Includes 포함사항:', text.includes('포함사항'));
console.log('Includes 불포함사항:', text.includes('불포함사항'));

// Extract snippet
const titleMatch = text.match(/타이페이.*?3박/);
if (titleMatch) console.log('Snippet:', titleMatch[0]);
