import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://www.modetour.com/package/99693648';

async function debugScraper() {
    console.log(`[Debug] Starting scraper for: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // 페이지 이동
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('[Debug] Page loaded.');

        // 스크린샷 1 (초기)
        await page.screenshot({ path: 'debug_step1_loaded.png' });

        // 스크롤 다운
        await autoScroll(page);
        console.log('[Debug] Scrolled successfully.');

        // 추가 대기
        await new Promise(r => setTimeout(r, 3000));

        // 스크린샷 2 (스크롤 후)
        await page.screenshot({ path: 'debug_step2_scrolled.png' });

        // 텍스트 추출
        const text = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('debug_text.txt', text);
        console.log(`[Debug] Text saved (${text.length} chars).`);

        // HTML 저장 (구조 확인용)
        const html = await page.content();
        fs.writeFileSync('debug_html.html', html);

    } catch (error) {
        console.error('[Debug] Error:', error);
    } finally {
        await browser.close();
    }
}

async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

debugScraper();
