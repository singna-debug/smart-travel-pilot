import * as fs from 'fs';

async function testFetchMobile() {
    const url = 'https://m.modetour.com/package/100634999?sno=C117876';
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36'
        }
    });
    const html = await res.text();
    fs.writeFileSync('debug-fast-mobile.html', html);

    console.log("Mobile HTML Length:", html.length);
    console.log("Contains 799,000:", html.includes('799,000'));
    console.log("Contains 799000:", html.includes('799000'));

    // Check __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
        console.log("Found __NEXT_DATA__ length:", nextDataMatch[1].length);
        fs.writeFileSync('debug-fast-mobile.json', nextDataMatch[1]);
    }
}
testFetchMobile().catch(console.error);
