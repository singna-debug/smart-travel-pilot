
const KAKAO_API_URL = 'http://localhost:3000/api/kakao-skill';

async function testKakaoSkill(utterance: string) {
    console.log(`\n🤖 Sending message: "${utterance}"`);

    const payload = {
        intent: {
            id: 'test-intent-id',
            name: 'test-intent'
        },
        userRequest: {
            timezone: 'Asia/Seoul',
            params: { ignoreMe: 'true' },
            block: { id: 'test-block-id', name: 'test-block' },
            utterance: utterance,
            lang: 'ko',
            user: {
                id: 'test-user-' + Date.now(),
                type: 'botUserKey',
                properties: {}
            }
        },
        bot: { id: 'test-bot-id', name: 'test-bot' },
        action: {
            name: 'test-action',
            clientExtra: {},
            params: {},
            id: 'test-action-id',
            detailParams: {}
        }
    };

    try {
        const startTime = Date.now();
        const response = await fetch(KAKAO_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const endTime = Date.now();

        if (!response.ok) {
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log(`✅ Response received in ${(endTime - startTime) / 1000}s`);

        // 전체 응답 구조 출력
        console.log(JSON.stringify(data, null, 2));

        const simpleText = data.template?.outputs?.[0]?.simpleText?.text;
        if (simpleText) {
            console.log('\n💬 Bot Reply Length:', simpleText.length);
        }

    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

// 테스트 시나리오
(async () => {
    // URL 분석 테스트 (10초 타임아웃 확인용)
    await testKakaoSkill('https://www.modetour.com/package/10903335 이 상품 어때?');
})();
