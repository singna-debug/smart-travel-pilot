
import { crawlForConfirmation } from '../lib/crawlers/confirmation/index.js';

async function verifyDetailedMapping() {
    console.log('--- Final JSON Audit for Modetour 106173541 ---');
    const result = await crawlForConfirmation('https://www.modetour.com/package/106173541');
    
    if (result) {
        console.log('Title:', result.title);
        console.log('Airline:', result.airline);
        console.log('Departure Flight:', result.departureFlightNumber);
        console.log('Return Flight:', result.returnFlightNumber);
        console.log('Departure Time:', result.departureTime);
        console.log('Itinerary Days:', result.itinerary?.length);
        
        if (result.departureFlightNumber && (result.departureFlightNumber.includes('LJ') || result.departureFlightNumber.includes('120'))) {
            console.log('✅ SUCCESS: Flight Number captured correctly!');
        } else {
            console.error('❌ FAILURE: Flight Number still missing or incorrect:', result.departureFlightNumber);
        }
    } else {
        console.error('❌ FAILURE: Analysis result is null');
    }
}

verifyDetailedMapping();
