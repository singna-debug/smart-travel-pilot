
import { fetchModeTourNative } from './lib/crawlers/modetour-utils';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugNative() {
    const testUrl = 'https://www.modetour.com/package/105807354?MLoc=99&Pnum=105807354&ANO=81440&sno=C117876&thru=crs';
    console.log(`[DEBUG] Fetching Native for: ${testUrl}`);
    
    // 이 함수는 내부적으로 console.log(CCTV 1)을 찍으므로 그 결과를 보면 됨
    const result = await fetchModeTourNative(testUrl, false);
    
    if (result) {
        console.log('[DEBUG_KEYS]', Object.keys(result));
        console.log('[DEBUG_HOTELS]', result.hotels?.length);
        console.log('[DEBUG_MEETING]', result.meetingInfo?.length);
        console.log('[DEBUG_INCLUSIONS]', result.inclusions?.length);
        console.log('[DEBUG_POLICY]', result.cancellationPolicy ? 'EXIST' : 'MISSING');
    }
}

debugNative();
