const https = require('https');

const url = 'https://www.modetour.com/package/97890872?MLoc=99&Pnum=97890872&Sno=C117876&ANO=81440&thru=crs';

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function dumpNextData() {
    try {
        const html = await fetchHtml(url);
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (nextDataMatch) {
            const nextData = JSON.parse(nextDataMatch[1]);

            function search(obj, path = '') {
                if (!obj || typeof obj !== 'object') return;
                for (const key in obj) {
                    if (key.toLowerCase().includes('price')) {
                        console.log(`PATH: ${path}.${key} VALUE: ${obj[key]}`);
                    }
                    if (path.split('.').length < 10) {
                        search(obj[key], `${path}.${key}`);
                    }
                }
            }
            search(nextData.props?.pageProps, 'pageProps');

        } else {
            console.log('NEXT_DATA not found');
        }
    } catch (e) {
        console.error(e);
    }
}

dumpNextData();
