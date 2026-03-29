
import { crawlForConfirmation } from './lib/crawlers/confirmation/index';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runTest() {
    const testUrl = 'https://www.modetour.com/package/105807354?MLoc=99&Pnum=105807354&ANO=81440&sno=C117876&thru=crs';
    console.log(`[TEST_START] URL: ${testUrl}`);
    
    try {
        const result = await crawlForConfirmation(testUrl);
        if (result) {
            console.log('[TEST_RESULT_JSON_START]');
            console.log(JSON.stringify({
                title: result.title,
                price: result.price,
                airline: result.airline,
                departureFlightNumber: result.departureFlightNumber,
                returnFlightNumber: result.returnFlightNumber,
                departureTime: result.departureTime,
                arrivalTime: result.arrivalTime,
                hotels: result.hotels?.length,
                itineraryDays: result.itinerary?.length,
                meetingInfoCount: result.meetingInfo?.length,
                cancellationPolicyLength: result.cancellationPolicy?.length,
                cancellationPolicySnippet: result.cancellationPolicy?.substring(0, 200)
            }, null, 2));
            console.log('[TEST_RESULT_JSON_END]');
        } else {
            console.log('[TEST_FAILED] Result is null');
        }
    } catch (err: any) {
        console.log('[TEST_ERROR] ' + err.message);
        console.log(err.stack);
    }
}

runTest();
