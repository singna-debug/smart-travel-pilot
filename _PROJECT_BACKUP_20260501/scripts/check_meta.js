
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

async function checkMetadata() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
            const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']\s*\/?>/i);

            console.log("PAGE_TITLE:", titleMatch ? titleMatch[1].trim() : "Not found");
            console.log("OG_TITLE:  ", ogTitleMatch ? ogTitleMatch[1].trim() : "Not found");

        } catch (e) {
            console.error(e);
        }
    }
}

checkMetadata();
