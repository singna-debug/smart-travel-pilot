
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

async function checkTitle() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/gi);
            const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/gi);
            const h3Match = html.match(/<h3[^>]*>(.*?)<\/h3>/gi);
            const h4Match = html.match(/<h4[^>]*>(.*?)<\/h4>/gi);

            console.log("--- H1 Tags ---");
            if (h1Match) h1Match.forEach(m => console.log(m.replace(/<[^>]+>/g, '').trim()));

            console.log("--- H2 Tags ---");
            if (h2Match) h2Match.forEach(m => console.log(m.replace(/<[^>]+>/g, '').trim()));

            console.log("--- H3 Tags ---");
            if (h3Match) h3Match.forEach(m => console.log(m.replace(/<[^>]+>/g, '').trim()));

            console.log("--- H4 Tags ---");
            if (h4Match) h4Match.forEach(m => console.log(m.replace(/<[^>]+>/g, '').trim()));

            // Check specific classes if known, otherwise just stick to headers for now

        } catch (e) {
            console.error(e);
        }
    }
}

checkTitle();
