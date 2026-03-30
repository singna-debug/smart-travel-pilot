
/**
 * 확정서 제작 전용 브라우저 크롤러
 * ── 최적화 v2: Puppeteer 타이밍 단축, Vercel Cheerio 개선 ──
 */

export interface ConfirmationScrapeOptions {
    url: string;
}

export async function scrapeForConfirmation(url: string): Promise<string | null> {
    const isVercel = process.env.VERCEL === '1';
    
    // --- [Vercel 전용 경량 스크래퍼 (Cheerio)] ---
    if (isVercel) {
        console.log(`[Confirmation/Crawler] Vercel: Cheerio scraping ${url}`);
        try {
            const browserHeaders = {
                'referer': 'https://www.modetour.com/',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'cache-control': 'max-age=0',
                'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            };

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { 
                headers: browserHeaders, 
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                console.error(`[Confirmation/Crawler] Fetch Failed: ${response.status}`);
                return null;
            }
            
            // EUC-KR 디코딩
            const buffer = await response.arrayBuffer();
            let html = new TextDecoder('euc-kr').decode(buffer);
            if (html.includes('charset="utf-8"') || html.includes('charset="UTF-8"')) {
                html = new TextDecoder('utf-8').decode(buffer);
            }
            
            const cheerioModule = await import('cheerio');
            const $ = cheerioModule.load(html);

            // ★ Vercel 환경에서 NEXT_DATA가 비어있을 수 있으므로 직접 내부 API(XHR) 호출 ★
            let internalApiData = '';
            try {
                const urlObj = new URL(url);
                const pnum = urlObj.searchParams.get('pnum') || urlObj.searchParams.get('Pnum');
                const sno = urlObj.searchParams.get('sno') || urlObj.searchParams.get('sNo');
                const ano = urlObj.searchParams.get('ano') || urlObj.searchParams.get('aNo');
                const productNo = pnum || sno || ano || '';

                if (productNo && url.includes('modetour.com')) {
                    const apiHeaders = {
                        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
                        'accept': 'application/json, text/plain, */*'
                    };
                    const ts = Date.now();
                    const fetchOptions = { headers: apiHeaders, cache: 'no-store' as RequestCache };
                    const [resSch, resPoint, resDetail] = await Promise.all([
                        fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}&_ts=${ts}`, fetchOptions).then(r=>r.ok?r.json():null),
                        fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}&_ts=${ts}`, fetchOptions).then(r=>r.ok?r.json():null),
                        fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}&_ts=${ts}`, fetchOptions).then(r=>r.ok?r.json():null)
                    ]);
                    
                    let cleanSchedule = '';
                    try {
                        const s = resSch?.result?.scheduleItemList || [];
                        s.forEach((day: any) => {
                            cleanSchedule += `\n[${day.first}일차 - ${day.date ? day.date.substring(0,10) : ''}]\n`;
                            const acts = day.ortherActions || [];
                            acts.forEach((a: any) => {
                                if (a.itiServiceName || a.itiSummaryDes || a.itiPlaceName) {
                                    cleanSchedule += `- [${a.itiServiceName || ''}] ${a.itiPlaceName || ''} ${a.itiSummaryDes ? ' : ' + a.itiSummaryDes : ''}\n`;
                                    if (a.detailDes) {
                                        let cDet = a.detailDes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                                        if (cDet.length > 300) cDet = cDet.substring(0, 300) + '...';
                                        cleanSchedule += `  설명: ${cDet}\n`;
                                    }
                                }
                            });
                            const meals = day.listMealPlace || [];
                            meals.forEach((m: any) => {
                                cleanSchedule += `- [식사 - ${m.itiServiceName || ''}] ${m.itiSummaryDes || ''}\n`;
                            });
                            const hotels = day.listHotelPlace || [];
                            hotels.forEach((h: any) => {
                                cleanSchedule += `- [숙박] ${h.placeNameK || h.placeNameE || ''}\n`;
                            });
                        });
                    } catch(e) { cleanSchedule = '일정 파싱 실패'; }

                    let cleanDetail = '';
                    try {
                        const d = resDetail?.result || {};
                        cleanDetail += `상품명: ${d.productName || ''}\n`;
                        cleanDetail += `미팅장소: ${d.meetingPlace2 || ''}\n`;
                        cleanDetail += `미팅시간: ${d.meetingTime || ''}\n`;
                        const inc = d.includedNote ? d.includedNote.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                        const uninc = d.unincludedNote ? d.unincludedNote.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                        cleanDetail += `포함사항: ${inc}\n`;
                        cleanDetail += `불포함사항: ${uninc}\n`;
                    } catch(e) { cleanDetail = '상세 파싱 실패'; }

                    internalApiData = `\n--- [Internal API DATA (CLEANED)] ---\n<여행 상세 정보>\n${cleanDetail}\n\n<일정표 정보>\n${cleanSchedule}\n----------------\n`;
                    console.log(`[Confirmation/Crawler] Internal API fetched: ${internalApiData.length} chars`);
                }
            } catch (apiErr) {
                console.warn('[Confirmation/Crawler] Internal API Fetch Error:', apiErr);
            }

            // NEXT_DATA 추출
            let nextDataContent = '';
            try {
                const nextDataJson = $('#__NEXT_DATA__').html();
                if (nextDataJson) {
                    const parsed = JSON.parse(nextDataJson);
                    const props = parsed.props?.pageProps || {};
                    const productData = props.productData || props.product || props.initialState?.product || props.initialState || props;
                    
                    if (productData) {
                        const relevantData: any = {
                            title: productData.PName || productData.title || props.title,
                            itinerary: productData.Itinerary || productData.itineraries || props.itinerary,
                            flights: productData.AirInfo || productData.flights || props.airInfo,
                            hotels: productData.HotelInfo || productData.hotels || props.hotels,
                            inclusions: productData.Inclusion || productData.inclusions || props.inclusions,
                            exclusions: productData.Exclusion || productData.exclusions || props.exclusions,
                            schedules: productData.Schedules || productData.schedules || props.schedules
                        };
                        nextDataContent = `\n--- [NEXT_DATA] ---\n${JSON.stringify(relevantData, null, 2)}\n----------------\n`;
                    }
                }
            } catch (jsonErr) {
                console.warn('[Confirmation/Crawler] NEXT_DATA Parse Error:', jsonErr);
            }
            
            // 핵심 컨테이너 추출
            const containerSelectors = ['.itinerary_wrap', '.inclusion_wrap', '.air_info', '.hotel_info', '.schedule_detail', '.schedule_wrap'];
            let containerData = '';
            containerSelectors.forEach(sel => {
                const text = $(sel).text().trim();
                if (text.length > 20) {
                    containerData += `\n--- [${sel}] ---\n${text}\n`;
                }
            });

            // 하이라이트 섹션
            const keywords = ['상품 POINT', '상품포인트', '특전', '여행 필수 정보', '항공여정', '항공 정보', '미팅 정보'];
            let highlights = '';
            $('div, section, article, h2, h3').each((_, el) => {
                const text = $(el).text().trim();
                if (keywords.some(k => text.includes(k)) && text.length > 50 && text.length < 5000) {
                    highlights += `\n--- [섹션] ---\n${text}\n`;
                }
            });

            $('script, style, noscript, svg').remove();
            const visibleText = $('body').text()
                .replace(/\t/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .replace(/\s\s+/g, ' ')
                .trim()
                .substring(0, 8000);

            const title = $('title').text();
            const finalContent = `${title}\n\n${internalApiData}\n\n${nextDataContent}\n\n${containerData}\n\n${highlights}\n\n[Body]\n${visibleText}`;
            console.log(`[Confirmation/Crawler] Cheerio result: ${finalContent.length} chars`);
            return finalContent;
        } catch (error) {
            console.error('[Confirmation/Crawler] Vercel Cheerio Error:', error);
            return null;
        }
    }

    // --- [로컬 Puppeteer 크롤러 v3 - 초고속] ---
    console.time('[Confirm/Crawler] Puppeteer');
    console.log(`[Confirm/Crawler] Puppeteer Start: ${url}`);
    
    let browser;
    try {
        const puppeteer = (await import('puppeteer')).default;
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // 리소스 차단 (CSS도 차단 → 속도 3배)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const rt = req.resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(rt)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // 페이지 이동 (타임아웃 12초)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });

        // 빠른 스크롤 4회 (150ms 대기) + 간략일정 버튼 클릭
        await page.evaluate(async () => {
            for (let i = 0; i < 4; i++) {
                window.scrollBy(0, 3000);
                await new Promise(r => setTimeout(r, 150));
                const btns = Array.from(document.querySelectorAll('button, a, span')) as HTMLElement[];
                const simpleBtn = btns.find(b => b.innerText?.includes('간략일정') && b.offsetParent !== null);
                if (simpleBtn) { simpleBtn.click(); await new Promise(r => setTimeout(r, 500)); break; }
            }
            window.scrollTo(0, 0);
        });

        // 대기 1000ms (컨텐츠 로딩 - 시간 넉넉히)
        await new Promise(r => setTimeout(r, 1000));

        // 섹션 대기 (3초 - 정확도 우선)
        if (url.includes('modetour.com')) {
            await page.waitForSelector('.itinerary_wrap, .inclusion_wrap', { timeout: 3000 }).catch(() => null);
        }

        // ★ 핵심 컨테이너 추출 (일정 빠짐없이 + 총 28000자 캡)
        const content = await page.evaluate(() => {
            const MAX_TOTAL = 28000;
            const selectors = ['.itinerary_wrap', '.inclusion_wrap', '.air_info', '.hotel_info', '.schedule_detail', '.schedule_wrap', '.product_point', '.tit_product'];
            let result = document.title + '\n';
            selectors.forEach(sel => {
                if (result.length >= MAX_TOTAL) return;
                const el = document.querySelector(sel) as HTMLElement;
                if (el && el.innerText.length > 20) {
                    const remaining = MAX_TOTAL - result.length;
                    result += `\n[${sel}]\n${el.innerText.substring(0, Math.min(10000, remaining))}\n`;
                }
            });

            // 항공/미팅/불포함 키워드 섹션 (남은 여유분으로)
            if (result.length < MAX_TOTAL) {
                const keywords = ['항공여정', '항공 정보', '미팅 정보', '상품 POINT', '특전', '불포함', '포함사항'];
                document.querySelectorAll('div, section').forEach(el => {
                    if (result.length >= MAX_TOTAL) return;
                    const t = (el as HTMLElement).innerText || '';
                    if (t.length > 30 && t.length < 5000 && keywords.some(k => t.includes(k))) {
                        const remaining = MAX_TOTAL - result.length;
                        result += `\n[섹션]\n${t.substring(0, remaining)}\n`;
                    }
                });
            }

            return result.substring(0, MAX_TOTAL);
        });

        console.timeEnd('[Confirm/Crawler] Puppeteer');
        console.log(`[Confirm/Crawler] Result: ${content.length} chars (capped at 18K)`);
        return content;

    } catch (error) {
        console.error('[Confirm/Crawler] Puppeteer Error:', error);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
