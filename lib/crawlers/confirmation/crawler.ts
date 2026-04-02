
/**
 * 확정서 제작 전용 브라우저 크롤러
 * 다른 모드와 공유하지 않고 오직 확정서 제작을 위한 딥 스캐닝(스크롤, 클릭)을 수행합니다.
 */

export interface ConfirmationScrapeOptions {
    url: string;
}

export async function scrapeForConfirmation(url: string): Promise<string | null> {
    const isVercel = process.env.VERCEL === '1';
    if (isVercel) return null;

    console.log(`[Confirmation/Crawler] Deep Scanning Start: ${url}`);
    
    let browser;
    try {
        const puppeteer = (await import('puppeteer')).default;
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // [최적화] 이미지, 폰트, 스타일시트 로딩 차단 (텍스트 위주 스캔으로 속도 2배 향상)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else if (resourceType === 'stylesheet' && !url.includes('modetour.com')) {
                // 모드투어는 레이아웃 파싱을 위해 스타일이 필요할 수 있어 제외, 나머지는 차단
                req.abort();
            } else {
                req.continue();
            }
        });

        // 페이지 이동
        console.log('[Confirmation/Crawler] Navigating...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // --- 1 & 2. [핵심] 빠른 딥 스크롤 + 버튼 클릭 병행 (최적화 버전) ---
        await page.evaluate(async () => {
            const distance = 2500; 
            const delay = 400;    
            const totalSteps = 8;
            let currentScroll = 0;
            let simpleBtnClicked = false;

            for (let i = 0; i < totalSteps; i++) {
                window.scrollBy(0, distance);
                currentScroll += distance;
                await new Promise(r => setTimeout(r, delay));

                // 버튼 체크 및 클릭
                if (!simpleBtnClicked) {
                    const btns = Array.from(document.querySelectorAll('button, a, span')) as HTMLElement[];
                    const simpleBtn = btns.find(b => 
                        (b.innerText?.includes('간략일정') || b.innerText?.includes('상세일정 펼치기')) && 
                        b.offsetParent !== null
                    );
                    
                    if (simpleBtn) {
                        simpleBtn.click();
                        simpleBtnClicked = true;
                        // 클릭 후 펼쳐지는 시간을 위해 추가 대기
                        await new Promise(r => setTimeout(r, 1200)); 
                    }
                }
            }
            window.scrollTo(0, 0); 
        });
        
        // 최종 렌더링 완료를 위한 안전 대기
        await new Promise(r => setTimeout(r, 2000)); 

        // --- 3. 특정 섹션 대기 ---
        if (url.includes('modetour.com')) {
            await page.waitForSelector('.itinerary_wrap, .inclusion_wrap', { timeout: 3000 }).catch(() => null);
        }

        // --- 4. 데이터 추출 ---
        const content = await page.evaluate(() => {
            // [추가] 모드투어 전용 핵심 컨테이너 직접 추출
            const containerSelectors = ['.itinerary_wrap', '.inclusion_wrap', '.air_info', '.hotel_info', '.schedule_detail', '.schedule_wrap'];
            let containerData = '';
            
            containerSelectors.forEach(sel => {
                const el = document.querySelector(sel) as HTMLElement;
                if (el && el.innerText.length > 20) {
                    containerData += `\n--- [데이터 컨테이너: ${sel}] ---\n${el.innerText}\n----------------\n`;
                }
            });

            // 하이라이트 섹션 (상품 포인트 등)
            const keywords = ['상품 POINT', '상품포인트', '특전', '여행 필수 정보', '항공여정', '항공 정보', '미팅 정보'];
            let highlights = '';
            const allElements = Array.from(document.querySelectorAll('div, section, article, h2, h3'));
            const sections = allElements.filter(el => 
                keywords.some(k => (el as HTMLElement).innerText?.includes(k))
            );
            sections.forEach(s => {
                const text = (s as HTMLElement).innerText;
                if (text.length > 50 && text.length < 5000) {
                    highlights += `\n--- [섹션: ${keywords.find(k => text.includes(k))}] ---\n${text}\n----------------\n`;
                }
            });

            // 스크립트/스타일 제거
            const scripts = document.querySelectorAll('script, style, noscript, svg');
            scripts.forEach(s => s.remove());

            // 이미지 목록
            const images = document.querySelectorAll('img');
            const imageUrls = new Set<string>();
            images.forEach(img => {
                if (img.src && img.src.startsWith('http')) {
                    imageUrls.add(`[IMG: ${img.src}]`);
                }
            });

            const visibleText = document.body.innerText;
            const imgBlock = Array.from(imageUrls).join('\n');
            const finalContent = `${document.title}\n\n${containerData}\n\n${highlights}${visibleText}\n\n--- [이미지 목록] ---\n${imgBlock}`;
            return finalContent;
        });

        console.log(`[Confirmation/Crawler] Scraped Length: ${content.length}`);
        return content;

    } catch (error) {
        console.error('[Confirmation/Crawler] Error:', error);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
