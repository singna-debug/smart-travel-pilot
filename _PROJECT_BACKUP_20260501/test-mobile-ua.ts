
import axios from 'axios';

const TARGET_URL = 'https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=BDP903&Pnum=99426643';
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";

async function testMobileUA() {
    console.log('Testing Mobile User-Agent...');
    try {
        const response = await axios.get(TARGET_URL, {
            headers: { 'User-Agent': MOBILE_UA }
        });

        const html = response.data;
        console.log(`Response length: ${html.length}`);
        console.log('Response Body:', html.substring(0, 1000));

        // Check for OG tags
        const ogTitle = html.match(/<meta property="og:title" content="(.*?)"/);
        if (ogTitle) console.log('OG Title:', ogTitle[1]);

        const priceMatch = html.match(/([\d,]+)원/);
        if (priceMatch) console.log('Price found:', priceMatch[0]);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error:', error.message);
        } else {
            console.error('Error:', error);
        }
    }
}

testMobileUA();
