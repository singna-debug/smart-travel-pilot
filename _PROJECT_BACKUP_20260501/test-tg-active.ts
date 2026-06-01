import { sendTelegramMessage } from './lib/telegram';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    console.log('--- Sending Test Telegram Message ---');
    const result = await sendTelegramMessage("🛠 <b>Smart Travel Pilot</b>\n텔레그램 알림 연결 테스트 메시지입니다.");
    if (result.success) {
        console.log('✅ Test Message Sent Successfully!');
    } else {
        console.error('❌ Test Message Failed:', result.error);
    }
}

test();
