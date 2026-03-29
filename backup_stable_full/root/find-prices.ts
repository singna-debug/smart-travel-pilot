import * as fs from 'fs';
const text = fs.readFileSync('debug-modetour-api.json', 'utf-8');
const data = JSON.parse(text);

function findFields(obj: any, keySubstr: string, path: string = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
        if (key.toLowerCase().includes(keySubstr)) {
            console.log(`${path}.${key}: ${obj[key]}`);
        }
        findFields(obj[key], keySubstr, `${path}.${key}`);
    }
}
findFields(data, 'price');
findFields(data, 'amount');
