// 데스크탑 User-Agent (일반적인 크롬)
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ScrapeOptions {
    skipClicks?: boolean;
}

export async function scrapeWithBrowser(url: string, options: ScrapeOptions = {}): Promise<string | null> {
    const isVercel = process.env.VERCEL === '1';
    if (isVercel) {
        console.log('[Browser] Vercel 환경에서는 Puppeteer 실행이 불가능하므로 스킵합니다.');
        return null;
    }

    const { skipClicks = false } = options;
    console.log(`[Browser] 데스크탑 모드 시작: ${url} (skipClicks: ${skipClicks})`);
    
    let browser;
    try {
        // Vercel 서버리스 크래시 방지를 위해 동적 임포트 사용
        const puppeteer = (await import('puppeteer')).default;
        
        // Singleton 제거하고 매번 깨끗한 브라우저 실행 (안정성 확보)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        page.on('console', msg => console.log('\x1b[36m[Page]\x1b[0m', msg.text()));

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

        console.log('[Browser] 스크롤 다운 (Optimized - 12000px)...');
        await page.evaluate(async () => {
            const maxScroll = 12000; // 충분히 깊게 스크롤
            const scrollStep = 1000;
            let currentScroll = 0;

            while (currentScroll < maxScroll && currentScroll < document.body.scrollHeight) {
                currentScroll += scrollStep;
                window.scrollTo(0, currentScroll);
                await new Promise(resolve => setTimeout(resolve, 300)); // 조금 더 여유 있게 대기
            }
        });

        // 2. 전체 콘텐츠 로딩 대기 (스크롤 후 텍스트 증가 확인)
        try {
            await page.waitForFunction(() => {
                return document.body.innerText.length > 2500;
            }, { timeout: 10000 });
        } catch (e) {
            console.log('[Browser] 전체 콘텐츠 로딩 대기 실패 (시간 초과), 계속 진행');
        }

        if (!skipClicks) {
            console.log('[Browser] 숨겨진 정보 로딩을 위한 클릭 처리...');
            try {
                await page.evaluate(async () => {
                    const keywords = ['더보기', '자세히 보기', '자세히보기', '펼치기', '상세보기', '상세', '호텔정보', '숙박정보', '포함', '불포함', '일정', '항공'];
                    const elements = Array.from(document.querySelectorAll('button, a, div.btn, span.btn, [role="button"]')) as HTMLElement[];

                    for (const el of elements) {
                        const text = (el.innerText || el.textContent || '').trim();
                        if (text.length > 0 && text.length < 15 && keywords.some(k => text.includes(k))) {
                            try {
                                if (el.offsetParent !== null) {
                                    el.click();
                                    await new Promise(r => setTimeout(r, 400));
                                }
                            } catch (e) {}
                        }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e) {}
        }

        // --- 일반 모드에서는 간단한 스크롤만 수행 ---
        await page.evaluate(async () => {
            window.scrollTo(0, document.body.scrollHeight / 2);
            await new Promise(r => setTimeout(r, 500));
            window.scrollTo(0, 0);
        });

        const content = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script, style, noscript, svg');
            scripts.forEach(s => s.remove());

            const images = document.querySelectorAll('img');
            const imageUrls = new Set<string>();
            images.forEach(img => {
                if (img.src && typeof img.src === 'string' && img.src.startsWith('http')) {
                    imageUrls.add(`[IMG: ${img.src}]`);
                }
            });

            const visibleText = document.body.innerText;
            const imgBlock = Array.from(imageUrls).join('\n');
            return `${document.title}\n\n${visibleText}\n\n--- [이미지 목록] ---\n${imgBlock}`;
        });

        console.log(`[Browser] 추출 완료: ${content.length}자`);
        return content;

    } catch (error) {
        console.error('[Browser] 오류:', error);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
