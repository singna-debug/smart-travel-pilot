const { extractHanaTourPkgCd, fetchHanaTourNative } = require('./lib/crawlers/hanatour-utils');

async function test() {
    const testUrl = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=APP2382609017CB&prePage=major-products';
    const result = await fetchHanaTourNative(testUrl, false);
    if (!result || !result.itinerary) {
        console.log('No result or itinerary!');
        return;
    }

    console.log('Total Days:', result.itinerary.length);
    result.itinerary.forEach((day, dIdx) => {
        console.log(`--- DAY ${dIdx + 1}: ${day.title} ---`);
        (day.timeline || []).forEach((item, iIdx) => {
            if (item.image || item.description?.includes('<img')) {
                console.log(`  [Item ${iIdx + 1}] ${item.title}`);
                console.log(`    image prop:`, item.image);
                const descImgs = (item.description || '').match(/src=["']?([^"'\s>]+)["']?/gi);
                console.log(`    desc imgs:`, descImgs);
            }
        });
    });
}

test();
