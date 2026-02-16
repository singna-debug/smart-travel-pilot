
import { spawn } from 'child_process';

async function testLocalRequest() {
    console.log('Sending test request to localhost:3000...');

    try {
        const response = await fetch('http://localhost:3000/api/kakao-skill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                intent: {
                    id: 'test-intent',
                    name: 'Test Intent'
                },
                userRequest: {
                    timezone: 'Asia/Seoul',
                    params: { surface: 'Builder' },
                    block: { id: 'test-block', name: 'Test Block' },
                    utterance: '일본 여행 상담해줘',
                    lang: 'ko',
                    user: {
                        id: 'test-user-1234',
                        type: 'appUserId',
                        properties: {
                            nickname: 'TestUser'
                        }
                    }
                },
                bot: { id: 'test-bot', name: 'Test Bot' },
                action: {
                    name: 'test_action',
                    clientExtra: null,
                    params: {},
                    id: 'test-action',
                    detailParams: {}
                }
            })
        });

        console.log('Response Status:', response.status);
        const text = await response.text();
        console.log('Response Body:', text);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testLocalRequest();
