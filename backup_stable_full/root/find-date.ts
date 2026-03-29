import * as fs from 'fs';
const html = fs.readFileSync('debug-fast.html', 'utf-8');
console.log("Contains 2026:", html.includes('2026'));
console.log("Contains 04.18:", html.includes('04.18'));
console.log("Contains 04-18:", html.includes('04-18'));
console.log("Contains 4월 18일:", html.includes('4월 18일'));
