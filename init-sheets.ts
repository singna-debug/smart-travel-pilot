
import dotenv from 'dotenv';
import { initializeSheetHeaders } from './lib/google-sheets';

dotenv.config({ path: '.env.local' });

async function init() {
    console.log('🚀 Google Sheets 초기화 시작...');
    const success = await initializeSheetHeaders();
    if (success) {
        console.log('✅ 헤더 초기화 완료! 이제 시트를 확인해보세요.');
    } else {
        console.error('❌ 초기화 실패. .env.local 설정을 확인해주세요.');
    }
}

init();
