// 수정된 fetchModeTourNative를 직접 테스트
async function test() {
    // 동적으로 import
    const { fetchModeTourNative } = await import('./lib/crawlers/modetour-utils.ts');
    
    const url = 'https://www.modetour.com/package/106173541';
    console.log('Testing fetchModeTourNative...');
    const result = await fetchModeTourNative(url, false);
    
    if (!result) {
        console.log('RESULT: null (failed)');
        return;
    }
    
    console.log('\n=== Result Summary ===');
    console.log('title:', result.title?.substring(0, 50));
    console.log('departureDate:', result.departureDate);
    console.log('returnDate:', result.returnDate);
    console.log('airline:', result.airline);
    console.log('departureFlightNumber:', result.departureFlightNumber);
    console.log('returnFlightNumber:', result.returnFlightNumber);
    console.log('departureTime:', result.departureTime);
    console.log('arrivalTime:', result.arrivalTime);
    console.log('returnDepartureTime:', result.returnDepartureTime);
    console.log('returnArrivalTime:', result.returnArrivalTime);
    console.log('duration:', result.duration);
    console.log('departureCityName:', result.departureAirport);
    console.log('itinerary count:', result.itinerary?.length);
    console.log('hotels count:', result.hotels?.length);
    console.log('inclusions count:', result.inclusions?.length);
    console.log('exclusions count:', result.exclusions?.length);
    console.log('keyPoints count:', result.keyPoints?.length);
    
    if (result.itinerary?.length > 0) {
        console.log('\n=== Itinerary Day 1 ===');
        const d1 = result.itinerary[0];
        console.log('day:', d1.day);
        console.log('title:', d1.title);
        console.log('date:', d1.date);
        console.log('hotel:', d1.hotel?.substring(0, 80));
        console.log('timeline items:', d1.timeline?.length);
        if (d1.timeline?.length > 0) {
            d1.timeline.slice(0, 3).forEach((t, i) => {
                console.log(`  [${i}] type=${t.type}, title="${t.title}", desc="${t.description?.substring(0, 60)}"`);
            });
        }
        console.log('transport:', JSON.stringify(d1.transport));
        
        console.log('\n=== Itinerary Day 2 ===');
        const d2 = result.itinerary[1];
        console.log('day:', d2.day);
        console.log('title:', d2.title);
        console.log('timeline items:', d2.timeline?.length);
        if (d2.timeline?.length > 0) {
            d2.timeline.slice(0, 5).forEach((t, i) => {
                console.log(`  [${i}] type=${t.type}, title="${t.title}", desc="${t.description?.substring(0, 60)}"`);
            });
        }
    }
}

test().catch(console.error);
