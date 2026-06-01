
import { crawlForConfirmation } from './lib/crawlers/confirmation/index';
import * as dotenv from 'dotenv';
import path from 'path';

// .env.local 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runTest() {
    const testUrl = 'https://www.modetour.com/package/105807354?MLoc=99&Pnum=105807354&ANO=81440&sno=C117876&thru=crs';
    console.log(`[Test] Starting Confirmation Crawl for: ${testUrl}`);
    
    try {
        const result = await crawlForConfirmation(testUrl);
        
        if (result) {
            console.log('--- [SUCCESS] Analysis Completed ---');
            console.log('Title:', result.title);
            console.log('Price:', result.price);
            console.log('Airline:', result.airline);
            console.log('Flight Num:', result.departureFlightNumber, '/', result.returnFlightNumber);
            console.log('Flight Time:', result.departureTime, '/', result.returnDepartureTime);
            console.log('Itinerary Days:', result.itinerary?.length);
            console.log('Meeting Info:', result.meetingInfo?.length > 0 ? 'Extracted' : 'Missing');
            console.log('Cancel Policy Sample:', result.cancellationPolicy?.substring(0, 100) + '...');
            
            // 데이터 무결성 체크
            if (!result.departureFlightNumber || result.departureFlightNumber === '') {
                console.warn('[WARN] Flight Number is missing!');
            }
            if (!result.cancellationPolicy || result.cancellationPolicy.length < 10) {
                console.warn('[WARN] Cancellation Policy is missing or too short!');
            }
        } else {
            console.error('--- [FAILED] Result is null ---');
        }
    } catch (error: any) {
        console.error('--- [CRIT] Runtime Error Detected ---');
        console.error(error.stack || error.message);
    }
}

runTest();
