
import { crawlForConfirmation } from './lib/crawlers/confirmation';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const url = 'https://www.modetour.com/package/104466706?MLoc=99&Pnum=104466706&ANO=81440&sno=C117876&thru=crs';
    console.log(`[TEST] Starting deep scan for: ${url}`);
    
    try {
        const result = await crawlForConfirmation(url);
        
        if (!result) {
            console.error('[TEST] ERROR: Result is null');
            return;
        }

        console.log('\n================ [분석 결과 리포트] ================');
        console.log(`제목: ${result.title}`);
        console.log(`항공사: ${result.airline}`);
        console.log(`출발 항공편: ${result.departureFlightNumber} (${result.departureTime} -> ${result.arrivalTime})`);
        console.log(`귀국 항공편: ${result.returnFlightNumber} (${result.returnDepartureTime} -> ${result.returnArrivalTime})`);
        console.log(`인클루전: ${result.inclusions?.length || 0}개`);
        console.log(`익스클루전: ${result.exclusions?.length || 0}개`);
        console.log(`호텔: ${result.hotels?.length || 0}개`);
        if (result.hotels && result.hotels[0]) {
            console.log(`  - 호텔명: ${result.hotels[0].name} / ${result.hotels[0].englishName}`);
            console.log(`  - 주소: ${result.hotels[0].address}`);
        }
        console.log(`일정표: ${result.itinerary?.length || 0}일분`);
        if (result.itinerary && result.itinerary.length > 0) {
            result.itinerary.slice(0, 2).forEach((day, i) => {
                console.log(`  Day ${i+1}: ${day.title} (${day.timeline?.length || 0}개 활동)`);
            });
        }
        console.log('==================================================\n');

        // 전체 결과 저장
        const outPath = path.join(process.cwd(), 'tmp', 'test_result.json');
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
        console.log(`[TEST] Full JSON saved to: ${outPath}`);

    } catch (e: any) {
        console.error('[TEST] EXCEPTION:', e.message);
    }
}

test();
