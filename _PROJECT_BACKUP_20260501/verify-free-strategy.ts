import { fetchModeTourNative } from './lib/crawlers/modetour-utils';
import { scrapeForConfirmation } from './lib/crawlers/confirmation/crawler';

async function verify() {
    // Vercel 환경 시뮬레이션
    process.env.VERCEL = '1';
    
    // 유저가 언급한 문제의 상품 URL
    const testUrl = 'https://www.modetour.com/product/item.aspx?goodsNo=16110821'; 
    
    console.log('--- [PROVING FREE STRATEGY] ---');
    console.log('URL:', testUrl);
    
    console.log('\n[Phase 1] Native API with Stealth Headers');
    try {
        const nativeData = await fetchModeTourNative(testUrl, false);
        if (nativeData) {
            console.log('✅ Native Data Success!');
            console.log('Title:', nativeData.title);
            console.log('Price:', nativeData.price);
            console.log('Airline:', nativeData.airline);
            console.log('DepTime (API):', nativeData.departureTime);
        } else {
            console.log('❌ Native Data Returned Null');
        }
    } catch (e: any) {
        console.error('❌ Native Data Error:', e.message);
    }

    console.log('\n[Phase 2] Stealth HTML Fetch & EUC-KR Decode');
    try {
        const text = await scrapeForConfirmation(testUrl);
        if (text && text.length > 500) {
            console.log('✅ Scraped Text Success! Length:', text.length);
            
            // 한글 포함 여부 및 핵심 키워드 확인
            const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
            console.log('Has Korean Text:', hasKorean);
            
            // 09:30 이 텍스트에 들어있는지 확인 (유저의 "Visual Truth")
            const hasNineThirty = text.includes('09:30');
            console.log('Found "09:30" in text:', hasNineThirty);
            
            // 텍스트 샘플 출력
            console.log('\n--- Text Snippet (First 500 chars) ---');
            console.log(text.substring(0, 500).replace(/\n/g, ' '));
        } else {
            console.log('❌ Scraped Text Failed or Too Short. Length:', text?.length || 0);
        }
    } catch (e: any) {
        console.error('❌ Scrape Error:', e.message);
    }
}

verify().catch(err => console.error('FATAL:', err));
