import * as fs from 'fs';
import * as path from 'path';
import { crawlForConfirmation } from './lib/url-crawler';

// .env.local 로드
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

async function test() {
    console.log('=== ScrapingBee 통합 테스트 시작 ===');
    const testUrl = 'https://www.modetour.com/package/102840987?MLoc=99&Pnum=102840987&Sno=C117876&ANO=81440&thru=crs';

    // Puppeteer를 강제로 실패하게 하거나 ScrapingBee가 호출되는지 로그로 확인
    // 현재 구현은 scrapeWithBrowser가 먼저 호출되므로, 
    // 로컬에서는 Puppeteer가 작동하겠지만 운영 환경 가상 시뮬레이션을 위해 로그 확인이 중요함.

    const result = await crawlForConfirmation(testUrl);

    if (result) {
        console.log('\n=== 분석 결과 요약 ===');
        console.log('제목:', result.title);
        console.log('항공편:', result.flightCode, result.departureTime, '->', result.arrivalTime);
        console.log('일정표 일수:', result.itinerary?.length || 0);

        if (result.itinerary && result.itinerary.length > 0) {
            console.log('\n1일차 활동:', result.itinerary[0].activities);
            console.log('1일차 교통:', result.itinerary[0].transportation);
        }

        fs.writeFileSync('scrapingbee-test-result.json', JSON.stringify(result, null, 2), 'utf-8');
        console.log('\n상세 결과가 scrapingbee-test-result.json에 저장되었습니다.');
    } else {
        console.log('분석 실패!');
    }
}

test().catch(console.error);
