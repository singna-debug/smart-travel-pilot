


async function testServer(port: number) {
    const url = `http://localhost:${port}/api/analyze-url`;
    console.log(`Checking port ${port}...`);
    try {
        // 상품 URL
        const targetUrl = 'https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=BDP903&Pnum=99426643';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [targetUrl] })
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response length: ${text.length}`);
        if (response.ok) {
            console.log('Success!', text.substring(0, 500));
            return true;
        } else {
            console.log('Error Body:', text.substring(0, 500));
            return false;
        }
    } catch (error) {
        console.log(`Connection failed on port ${port}:`, (error as any).message);
        return false;
    }
}

async function run() {
    if (await testServer(3000)) return;
    if (await testServer(3001)) return;
    console.log('All attempts failed.');
}

run();
