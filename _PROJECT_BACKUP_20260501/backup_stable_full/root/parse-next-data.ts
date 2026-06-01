import * as fs from 'fs';

const html = fs.readFileSync('debug-modetour-ssr.txt', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

if (match) {
    try {
        const data = JSON.parse(match[1]);
        fs.writeFileSync('debug-next-data.json', JSON.stringify(data, null, 2));
        console.log('Successfully saved debug-next-data.json');
    } catch (e) {
        console.error('Failed to parse:', e);
    }
} else {
    console.log('No NEXT_DATA found');
}
