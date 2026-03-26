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
            console.log('[Browser] 숨겨진 정보(더보기, 호텔정보 등) 로딩을 위한 클릭 처리...');
            try {
            await page.evaluate(async () => {
                // 클릭할 키워드 목록
                const keywords = ['더보기', '자세히 보기', '자세히보기', '펼치기', '상세보기', '상세', '호텔정보', '호텔 정보', '숙박정보', '포함', '불포함', '일정'];
                
                // 모두투어 전용: 일정표 더보기 버튼 클래스들
                const specSelectors = ['.btn_more', '.btn_detail', '.itinerary_more', 'a[onclick*="getSchedule"]'];
                
                // 1. 특정 셀렉터 우선 시도
                for (const sel of specSelectors) {
                    const els = document.querySelectorAll(sel);
                    for (const el of Array.from(els) as HTMLElement[]) {
                        if (el.offsetParent !== null) { // 보이는 것만
                            el.click();
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }
                }

                // 2. 키워드 기반 클릭
                const elements = Array.from(document.querySelectorAll('button, a, div.btn, span.btn, div[role="button"], span[role="button"]')) as HTMLElement[];

                let clickedCount = 0;
                for (const el of elements) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (text.length > 0 && text.length < 15 && keywords.some(k => text.includes(k))) {
                        try {
                            if (el.offsetParent !== null) { // 화면에 보이는 것만 클릭
                                el.click();
                                clickedCount++;
                                await new Promise(r => setTimeout(r, 300));
                            }
                        } catch (e) { }
                    }
                }
                console.log(`[Browser In-Page] 클릭된 버튼 수: ${clickedCount}`);
            });
            // 모달이나 추가 콘텐츠가 로드될 시간 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.log('[Browser] 클릭 처리 중 오류 발생 (무시하고 진행)', e);
            }
        } else {
            console.log('[Browser] skipClicks=true이므로 클릭 처리를 건너뜁니다.');
        }

        const content = await page.evaluate(() => {
            // 상품포인트/특약 등 핵심 섹션 추출 강화
            const keywords = ['상품 POINT', '상품포인트', '상품 핵심 포인트', '핵심포인트', '특전', '여행 필수 정보'];
            let highlights = '';
            
            // 1. 키워드 기반 섹션 찾기
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

            // 2. 기호(♥, #, ★)로 시작하는 의미 있는 문장들 수집
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n');
            const markers = ['♥', '★', '■', '#', '[특전]', '▶'];
            const importantLines = lines.filter(line => 
                markers.some(m => line.trim().startsWith(m)) && line.trim().length > 5
            ).slice(0, 30);
            
            if (importantLines.length > 0) {
                highlights += `\n--- [주요 특징 추출] ---\n${importantLines.join('\n')}\n----------------\n\n`;
            }

            // img 태그를 제외한 스크립트, 스타일 등만 제거
            const scripts = document.querySelectorAll('script, style, noscript, svg, header, footer');
            scripts.forEach(s => s.remove());

            // 페이지 내 모든 이미지 수집
            const images = document.querySelectorAll('img');
            const imageUrls = new Set<string>();
            images.forEach(img => {
                if (img.src && typeof img.src === 'string' && img.src.startsWith('http')) {
                    imageUrls.add(`[IMG: ${img.src}]`);
                }
            });

            // 눈에 보이는 텍스트 추출
            const visibleText = document.body.innerText;

            // 텍스트와 이미지 결합
            const imgBlock = Array.from(imageUrls).join('\n');
            return `${document.title}\n\n${highlights}${visibleText}\n\n--- [페이지 내 발견된 이미지 목록] ---\n${imgBlock}`;
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
