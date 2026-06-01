
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

async function checkScripts() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
            if (scriptMatches) {
                console.log(`Found ${scriptMatches.length} script tags.`);
                for (const script of scriptMatches) {
                    if (script.includes("나트랑")) {
                        console.log("--- Found keyword in script ---");
                        // Print the surrounding context
                        const index = script.indexOf("나트랑");
                        console.log(script.substring(Math.max(0, index - 100), Math.min(script.length, index + 200)));
                    }
                }
            } else {
                console.log("No scripts found.");
            }

        } catch (e) {
            console.error(e);
        }
    }
}

checkScripts();
