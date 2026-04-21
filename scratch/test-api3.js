const fs = require('fs');

const data = JSON.parse(fs.readFileSync('api-dump.json', 'utf8'));

function search(obj, query) {
    if (typeof obj === 'string' && obj.includes(query)) {
        return obj;
    }
    if (Array.isArray(obj)) {
        for (let i=0; i<obj.length; i++) {
            const res = search(obj[i], query);
            if (res) return res;
        }
    } else if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const res = search(obj[key], query);
            if (res) return `[${key}]: ${res}`;
        }
    }
    return null;
}

console.log('Search "이동":', search(data, '이동'));
console.log('Search "조식":', search(data, '조식'));
