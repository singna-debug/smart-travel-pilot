
import { fetchModeTourNative } from '../lib/crawlers/modetour-utils.js';

async function testNativeFlightMapping() {
    console.log('--- Testing Native Flight Mapping Fix ---');
    const url = 'https://www.modetour.com/package/106173541';
    const result = await fetchModeTourNative(url, false);
    
    if (result) {
        console.log('Airline:', result.airline);
        console.log('Departure Flight:', result.departureFlightNumber);
        console.log('Return Flight:', result.returnFlightNumber);
        
        if (result.departureFlightNumber && result.departureFlightNumber.includes('LJ')) {
            console.log('✅ SUCCESS: LJ Flight pattern found!');
        } else {
            console.error('❌ FAILURE: LJ Flight pattern STILL MISSING:', result.departureFlightNumber);
        }
    } else {
        console.error('❌ FAILURE: Native fetch failed');
    }
}

testNativeFlightMapping();
