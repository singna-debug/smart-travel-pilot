
import fs from 'fs';

const url = 'https://www.modetour.com/package/100955975';

async function testFetch() {
    console.log(`[Diagnostic] Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const html = await response.text();
        fs.writeFileSync('tmp/modetour_raw.html', html);
        console.log(`[Diagnostic] Saved to tmp/modetour_raw.html (Length: ${html.length})`);

        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        console.log(`[Diagnostic] NextData Found: ${!!nextDataMatch}`);
        if (nextDataMatch) {
            fs.writeFileSync('tmp/next_data_sample.json', nextDataMatch[1]);
            console.log(`[Diagnostic] NextData Sample Saved to tmp/next_data_sample.json (Length: ${nextDataMatch[1].length})`);
        }

        // 특정 키워드 존재 여부 체크
        const keywords = ['편명', '미팅', '호텔', 'itinerary', 'departureDate'];
        keywords.forEach(k => {
            console.log(`[Diagnostic] Keyword "${k}" count: ${html.split(k).length - 1}`);
        });

    } catch (e) {
        console.error(`[Diagnostic] Error: ${e.message}`);
    }
}

testFetch();
