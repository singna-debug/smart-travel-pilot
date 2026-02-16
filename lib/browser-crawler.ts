import puppeteer from 'puppeteer';

// 데스크탑 User-Agent (일반적인 크롬)
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeWithBrowser(url: string): Promise<string | null> {
    console.log(`[Browser] 데스크탑 모드 시작: ${url}`);
    let browser;
    try {
        // Singleton 제거하고 매번 깨끗한 브라우저 실행 (안정성 확보)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // 1. 데스크탑 환경 설정
        // await page.setUserAgent(DESKTOP_UA); // Modetour blocking issue?
        await page.setViewport({ width: 1920, height: 1080 });

        // 2. 리소스 차단 (속도 최적화 - 스타일시트 허용)
        // await page.setRequestInterception(true);
        /*
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });
        */

        // 타임아웃 60초, DOM 로드 시점까지만 대기 (이후 수동 로딩)
        console.log('[Browser] 페이지 이동 (Timeout 60s, domcontentloaded)...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 1. 초기 로딩 대기 (최소한의 텍스트)
        try {
            await page.waitForFunction(() => {
                return document.body.innerText.length > 200;
            }, { timeout: 3000 });
        } catch (e) {
            console.log('[Browser] 초기 로딩 대기 실패, 스크롤 진행');
        }

        console.log('[Browser] 스크롤 다운 (Optimized - 8000px)...');
        await page.evaluate(async () => {
            const maxScroll = 8000;
            const scrollStep = 1000;
            let currentScroll = 0;

            while (currentScroll < maxScroll && currentScroll < document.body.scrollHeight) {
                currentScroll += scrollStep;
                window.scrollTo(0, currentScroll);
                await new Promise(resolve => setTimeout(resolve, 200)); // 0.2s wait
            }
        });

        // 2. 전체 콘텐츠 로딩 대기 (스크롤 후 텍스트 증가 확인)
        try {
            await page.waitForFunction(() => {
                return document.body.innerText.length > 2500;
            }, { timeout: 7000 });
        } catch (e) {
            console.log('[Browser] 전체 콘텐츠 로딩 대기 실패 (시간 초과), 계속 진행');
        }

        // 안정화 대기 시간 단축 (0.5초)
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[Browser] 텍스트 추출...');
        const content = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script, style, noscript, svg, img, header, footer');
            scripts.forEach(s => s.remove());

            // Prefix 없이 제목 + 본문 (단순화: debug-scraper.ts 방식)
            return `${document.title}\n\n${document.body.innerText}`;
        });

        console.log(`[Browser] 추출 완료: ${content.length}자 (SIMPLE LOGIC)`);
        return content;

    } catch (error) {
        console.error('[Browser] 오류:', error);
        return null; // fallback to ScrapingBee
    } finally {
        if (browser) await browser.close();
    }
}
