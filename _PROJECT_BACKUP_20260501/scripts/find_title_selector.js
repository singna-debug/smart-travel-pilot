
const urls = [
    "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
];

const targetTitle = "[설연휴특가][3색도시여행] 나트랑/판랑/달랏(나트랑1박+달랏2박) 3박5일 [4성]";

async function findExactTitle() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();

            const index = html.indexOf(targetTitle);

            if (index !== -1) {
                console.log(`Found EXACT title at index ${index}`);
                console.log("Context:");
                // Print 300 chars before and after to see tags
                console.log(html.substring(Math.max(0, index - 300), Math.min(html.length, index + 300)));
            } else {
                console.log("Exact title NOT found. Searching for partial...");
                const partial = "나트랑/판랑/달랏";
                const pIndex = html.indexOf(partial);
                if (pIndex !== -1) {
                    console.log(`Found partial '${partial}' at index ${pIndex}`);
                    console.log(html.substring(Math.max(0, pIndex - 300), Math.min(html.length, pIndex + 300)));
                } else {
                    console.log("Even partial not found.");
                }
            }

        } catch (e) {
            console.error(e);
        }
    }
}

findExactTitle();
