
async function testKakao() {
    try {
        const response = await fetch('https://brave-poets-love.loca.lt/api/kakao-skill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userRequest: {
                    utterance: "제주도 여행 추천해줘",
                    user: { id: "test-local-user", properties: { nickname: "Tester" } }
                }
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Test failed:', e);
    }
}

testKakao();
