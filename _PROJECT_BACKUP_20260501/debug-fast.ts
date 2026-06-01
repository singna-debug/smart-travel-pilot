import * as fs from 'fs';

async function testFetch() {
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    fs.writeFileSync('debug-fast.html', html);

    console.log("HTML Length:", html.length);
    console.log("Contains 799,000:", html.includes('799,000') || html.includes('799000'));

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
        console.log("Found __NEXT_DATA__, length:", nextDataMatch[1].length);
        const data = JSON.parse(nextDataMatch[1]);
        fs.writeFileSync('debug-fast-next.json', JSON.stringify(data, null, 2));
    }
}
testFetch().catch(console.error);
