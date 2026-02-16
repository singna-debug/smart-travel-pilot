const fs = require('fs');

// Mock sleep and types
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function quickFetch(url, retries = 2) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        let text = decoder.decode(buffer);

        console.log(`[QuickFetch] Status: ${response.status}, HTML Length: ${text.length}`);
        return { html: text };

    } catch (error) {
        if (retries > 0) {
            console.log(`[QuickFetch] Retry (${retries} left): ${url}`);
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        throw error;
    }
}

function htmlToText(html) {
    let processed = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<[^>]+>/g, '');

    return processed.replace(/\s+/g, ' ').trim();
}

async function test() {
    const url = 'https://www.modetour.com/package/97890872?MLoc=99&Pnum=97890872&Sno=C117876&ANO=81440&thru=crs';
    console.log('Testing URL:', url);

    try {
        const { html } = await quickFetch(url);
        fs.writeFileSync('scripts/debug_html.html', html);
        const text = htmlToText(html);
        console.log('Plain Text Length:', text.length);
        console.log('HTML written to scripts/debug_html.html');

        if (text.length <= 500) {
            console.error('ERROR: Content too short!');
        } else {
            console.log('SUCCESS: Content length is okay.');
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

test();
