
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

async function debugJson() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            // Look for JSON structures containing the title part
            const regex = /"(:?GOODS_NAME|TITLE|PRD_NM|HNAME)":\s*"(.*?)"/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match[2].includes("나트랑")) {
                    console.log(`Found candidate Key: ${match[1]}, Value: ${match[2]}`);
                }
            }

            // Look for the specific pattern seen in previous logs
            // "IN": [ ... "AIR_CODE": "7C2...
            // It seems to be part of a larger JSON object, possibly `goodsInfo` or `itinerary`.

            // Try to dump the goodsName or similar variable
            const varMatch = html.match(/var\s+([a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\});/);
            if (varMatch) {
                console.log(`Found variable: ${varMatch[1]}`);
                if (varMatch[2].includes("나트랑")) {
                    console.log("Variable contains '나트랑'. Dumping first 500 chars:");
                    console.log(varMatch[2].substring(0, 500));
                }
            }

        } catch (e) {
            console.error(e);
        }
    }
}

debugJson();
