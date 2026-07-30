const { extractHanaTourPkgCd, fetchHanaTourNative } = require('./lib/crawlers/hanatour-utils');

async function test() {
    const testUrl = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=APP2382609017CB&prePage=major-products';
    console.log('Testing URL:', testUrl);
    
    const pkgCd = extractHanaTourPkgCd(testUrl);
    console.log('Extracted pkgCd:', pkgCd);

    const result = await fetchHanaTourNative(testUrl, false);
    console.log('--- RESULT SUMMARY ---');
    if (!result) {
        console.log('Result is NULL!');
        return;
    }

    console.log('Title:', result.title);
    console.log('Price:', result.price);
    console.log('Airline:', result.airline);
    console.log('Departure Flight:', result.departureFlightNumber);
    console.log('Return Flight:', result.returnFlightNumber);
    console.log('Itinerary Days:', result.itinerary ? result.itinerary.length : 0);
    if (result.itinerary && result.itinerary[0]) {
        console.log('Day 1 Title:', result.itinerary[0].title);
        console.log('Day 1 Items Count:', result.itinerary[0].items ? result.itinerary[0].items.length : 0);
        if (result.itinerary[0].items && result.itinerary[0].items[0]) {
            console.log('First Item:', JSON.stringify(result.itinerary[0].items[0], null, 2));
        }
    }
    console.log('MeetingInfo:', JSON.stringify(result.meetingInfo, null, 2));
    console.log('CancellationPolicy:', result.cancellationPolicy ? result.cancellationPolicy.substring(0, 100) : 'EMPTY');
}

test();
