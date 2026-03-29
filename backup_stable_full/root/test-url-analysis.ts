
import * as fs from 'fs';
import * as path from 'path';
import { crawlTravelProduct } from './lib/url-crawler';

// Load environment variables manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^"|"$/g, '');
        }
    });
}

async function test() {
    // 사용자가 제보한 문제의 URL
    const url = 'https://modeon.modetour.co.kr/package/104941375?Pcode=AVP666';
    console.log(`Testing URL: ${url}`);
    const startTime = Date.now();

    try {
        const result = await crawlTravelProduct(url);
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Duration: ${duration}s`);

        if (!result) {
            console.error('Failed to crawl product (null returned)');
            return;
        }

        console.log('Crawled Result:', JSON.stringify(result, null, 2));
        
        // 디버깅을 위한 추가 정보 출력
        // Note: crawlTravelProduct 내부의 로그를 확인하기 위해
        // 실제 실행 시의 stdout을 잘 살펴봐야 함

        // 검증 로직 추가
        console.log('\n--- Validation ---');
        const errors: string[] = [];
        
        if (!result.title || result.title.length < 5) errors.push('Title missing or too short');
        if (!result.price || result.price === '가격 정보 없음' || result.price === '0원') errors.push('Price missing or invalid');
        if (!result.airline) errors.push('Airline missing');
        if (!result.departureAirport) errors.push('Departure Airport missing');
        if (!result.duration || result.duration === '미정') errors.push('Duration missing');
        if (!result.destination || result.destination.length < 2) errors.push('Destination missing');
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!result.departureDate || !dateRegex.test(result.departureDate)) errors.push(`Departure Date invalid: ${result.departureDate}`);
        if (!result.returnDate || !dateRegex.test(result.returnDate)) errors.push(`Return Date invalid: ${result.returnDate}`);
        
        if (!result.keyPoints || result.keyPoints.length < 2) errors.push(`Key Points insufficient: ${result.keyPoints?.length || 0}`);

        if (errors.length === 0) {
            console.log('✅ ALL FIELDS VALIDATED SUCCESSFULLY!');
        } else {
            console.log('❌ VALIDATION FAILED:');
            errors.forEach(err => console.log(`  - ${err}`));
        }

        fs.writeFileSync('test_crawler_output.json', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error during test:', error);
    }
}

test();
