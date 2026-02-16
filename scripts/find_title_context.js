
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

async function findContext() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            // Search for the specific title part
            const keyword = "나트랑/판랑";
            const index = html.indexOf(keyword);

            if (index !== -1) {
                console.log(`Found keyword at index ${index}`);
                console.log("Context:");
                console.log(html.substring(Math.max(0, index - 150), Math.min(html.length, index + 300))); // Wider context
            } else {
                console.log("Keyword '나트랑/판랑' not found in HTML");
            }

            // Also search for JSON blocks
            const jsonMatch = html.match(/var\s+goodsInfo\s*=\s*(\{.*?\})/);
            if (jsonMatch) {
                console.log("Found goodsInfo JSON!");
                console.log(jsonMatch[1].substring(0, 200));
            }

        } catch (e) {
            console.error(e);
        }
    }
}

findContext();
