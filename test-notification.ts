import { getTodayNotificationMessage } from './lib/notifications-logic';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    console.log('--- Testing Telegram Notification Format ---');
    try {
        const message = await getTodayNotificationMessage();
        if (message) {
            console.log('Generated Message:');
            console.log('-----------------------------------');
            console.log(message.replace(/<br\/>/g, '\n').replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/<i>/g, '').replace(/<\/i>/g, ''));
            console.log('-----------------------------------');
        } else {
            console.log('No notifications for today.');
        }
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
