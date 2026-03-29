
import { crawlTravelProduct } from './lib/url-crawler';

async function test() {
    // 유저가 제보한 새로운 URL 패턴
    const url = 'https://www.modetour.com/package/96108147?MLoc=99&Pnum=96108147&Sno=C117876&ANO=81440&thru=crs';

    console.log(`Testing URL: ${url}`);
    const result = await crawlTravelProduct(url);

    if (result) {
        console.log('Success:', JSON.stringify(result, null, 2));
    } else {
        console.log('Failed to crawl.');
    }
}

test();
