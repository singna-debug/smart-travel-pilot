// 디버깅용 테스트 스크립트
import * as fs from 'fs';
import * as path from 'path';

// .env.local 직접 로드
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // 따옴표 제거
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
    console.log('.env.local 로드 완료');
}

console.log('SCRAPINGBEE:', process.env.SCRAPINGBEE_API_KEY ? `${process.env.SCRAPINGBEE_API_KEY?.substring(0, 10)}...` : 'NOT FOUND');
console.log('GROQ:', process.env.GROQ_API_KEY ? `${process.env.GROQ_API_KEY?.substring(0, 10)}...` : 'NOT FOUND');

// 크롤러 테스트
import { crawlTravelProduct } from './lib/url-crawler';

async function test() {
    console.log('\n=== URL 분석 테스트 ===');

    const url = 'https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=BDP903&Pnum=99426643';
    console.log('테스트 URL:', url);

    const result = await crawlTravelProduct(url);

    if (result) {
        console.log('\n=== 분석 결과 ===');
        console.log('제목:', result.title);
        console.log('목적지:', result.destination);
        console.log('가격:', result.price);
        console.log('기간:', result.duration);
        console.log('특전:', result.specialOffers?.slice(0, 3));
        console.log('코스:', result.courses?.slice(0, 3));
        console.log('포함:', result.inclusions?.slice(0, 3));
    } else {
        console.log('분석 실패!');
    }
}

test().catch(console.error);
