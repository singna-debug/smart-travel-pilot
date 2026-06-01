
const fs = require('fs');
const text = fs.readFileSync('debug_clean_text.txt', 'utf8');
console.log('Length:', text.length);
console.log('Split \\n:', text.split('\n').length);
console.log('Split \\r:', text.split('\r').length);
console.log('Split \\r\\n:', text.split('\r\n').length);
