
const fs = require('fs');
const path = require('path');
const { scrapeWithBrowser } = require('./lib/browser-crawler');

// Load environment variables manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function test() {
    const url = 'https://www.modetour.com/package/99693648';
    console.log(`Testing URL: ${url}`);

    try {
        const content = await scrapeWithBrowser(url);
        if (!content) {
            console.error('Failed to scrape content (null returned)');
            return;
        }

        console.log(`Scraped content length: ${content.length}`);

        // Save content to analyze
        fs.writeFileSync('test-scraped-content.txt', content, 'utf8');
        console.log('Saved scraped content to test-scraped-content.txt');

        // Check for "상품 POINT" or specific keywords
        if (content.includes('상품 POINT') || content.includes('상품포인트')) {
            console.log('Found "상품 POINT" keyword!');
        } else {
            console.log('Could NOT find "상품 POINT" keyword in content.');
        }

        if (content.includes('노쇼핑') || content.includes('노옵션')) {
            console.log('Found "노쇼핑/노옵션" keyword!');
        } else {
            console.log('Could NOT find "노쇼핑/노옵션" keyword.');
        }

    } catch (error) {
        console.error('Error during test:', error);
    }
}

test();
