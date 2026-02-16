
import http from 'http';
import fetch from 'node-fetch';

const CALLBACK_PORT = 3001;
const TARGET_URL = 'http://localhost:3000/api/kakao-skill';
const TEST_PRODUCT_URL = 'https://www.modetour.com/package/99693648';

async function testKakaoCallback() {
    console.log('[Test] Starting Kakao Callback Test...');

    // 1. Start a simple server to receive the callback
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log(`[Test] Callback received!`);
            console.log(`[Test] Method: ${req.method}`);
            console.log(`[Test] Body length: ${body.length}`);

            try {
                const json = JSON.parse(body);
                console.log('[Test] Body preview:', JSON.stringify(json).substring(0, 200) + '...');
            } catch (e) {
                console.log('[Test] Body is not JSON:', body.substring(0, 200));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));

            console.log('[Test] Callback verification successful. Closing server.');
            server.close();
            process.exit(0);
        });
    });

    server.listen(CALLBACK_PORT, async () => {
        console.log(`[Test] Callback server listening on port ${CALLBACK_PORT}`);

        // 2. Send the request to the main application
        const payload = {
            intent: { id: 'test', name: 'test' },
            userRequest: {
                timezone: 'Asia/Seoul',
                params: { ignoreMe: 'true' },
                block: { id: 'test', name: 'test' },
                utterance: `${TEST_PRODUCT_URL} 분석해줘`,
                lang: 'ko',
                user: { id: 'test-user-1234', type: 'test', properties: {} },
                callbackUrl: `http://localhost:${CALLBACK_PORT}/callback`
            },
            bot: { id: 'test', name: 'test' },
            action: { name: 'test', clientExtra: {}, params: {}, id: 'test', detailParams: {} }
        };

        console.log(`[Test] Sending POST request to ${TARGET_URL}...`);
        try {
            const response = await fetch(TARGET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`[Test] Response Status: ${response.status}`);
            const responseBody = await response.json();
            console.log(`[Test] Immediate Response:`, JSON.stringify(responseBody, null, 2));

            if (responseBody.useCallback === true) {
                console.log('[Test] SUCCESS: Received useCallback: true');
                console.log('[Test] Waiting for callback (timeout 30s)...');
            } else {
                console.error('[Test] FAILURE: Did not receive useCallback: true');
                server.close();
                process.exit(1);
            }

        } catch (error) {
            console.error('[Test] Request failed:', error);
            server.close();
            process.exit(1);
        }
    });

    // Timeout
    setTimeout(() => {
        console.error('[Test] Timeout! Callback was not received in time.');
        server.close();
        process.exit(1);
    }, 45000);
}

testKakaoCallback();
