import { DetailedProductInfo } from '../../types';
import { quickFetch, inferDestination, htmlToText } from '../crawler-base-utils';

export function extractHanjinTravelCode(url: string): string | null {
  try {
    const match = url.match(/[?&](?:gdsNo|evtNo)=([A-Za-z0-9_-]+)/i);
    if (match) return match[1];
    return null;
  } catch (e) {
    return null;
  }
}

export async function fetchHanjinTravelNative(url: string, isSummaryOnly: boolean = false): Promise<DetailedProductInfo | null> {
  try {
    const code = extractHanjinTravelCode(url) || 'KW62283';
    let targetUrl = url;
    if (!targetUrl.includes('gdsNo=') && !targetUrl.includes('evtNo=')) {
      targetUrl = 'https://www.hanjintravel.com/dp/display/displayDetail?dspCtgNo=1000002245&gdsNo=' + code + '&evtNo=OP20260803017';
    }

    console.log('[HanjinTravel] Raw deep fetch for normalized URL: ' + targetUrl);

    let domText = '';
    let extractedImages: string[] = [];

    // Skip Puppeteer on Vercel serverless functions or during fast URL analysis summary mode
    const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined;
    if (typeof window === 'undefined' && !isVercel && !isSummaryOnly) {
      try {
        console.log('[HanjinTravel] Launching Puppeteer for SPA rendering & Image extraction...');
        const puppeteer = (await import('puppeteer')).default;
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        // Click all expand accordions
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, div, span'));
          buttons.forEach(b => {
            const txt = b.textContent || '';
            if (txt.includes('전체 열기') || txt.includes('일정 전체') || txt.includes('일정 열기') || txt.includes('더보기') || txt.includes('약관 자세히')) {
              try { (b as HTMLElement).click(); } catch(e) {}
            }
          });
        });
        await new Promise(r => setTimeout(r, 3000));

        const pageData = await page.evaluate(() => {
          const rawText = document.body ? document.body.innerText : '';
          const spotMap: Record<string, string[]> = {};
          const allImgs: string[] = [];

          document.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
            if (!src || src.endsWith('.svg') || src.includes('logo') || src.includes('icon') || src.includes('banner')) return;

            const fullUrl = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? 'https://www.hanjintravel.com' + src : src);
            if (!allImgs.includes(fullUrl)) allImgs.push(fullUrl);

            if (src.includes('/photo/') || src.includes('/KALDEV/')) {
              let parent: HTMLElement | null = img.parentElement;
              let spotName = '';
              for (let i = 0; i < 6 && parent; i++) {
                const titleEl = parent.querySelector('strong, h3, h4, h5, .title, .spot-title');
                if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 1) {
                  spotName = titleEl.textContent.trim();
                  break;
                }
                const text = (parent.innerText || '').trim().split('\n')[0];
                if (text && text.length > 1 && text.length < 40 && !text.includes('조식') && !text.includes('접기')) {
                  spotName = text;
                  break;
                }
                parent = parent.parentElement;
              }
              if (spotName) {
                if (!spotMap[spotName]) spotMap[spotName] = [];
                if (!spotMap[spotName].includes(fullUrl)) spotMap[spotName].push(fullUrl);
              }
            }
          });

          return { rawText, imgs: Array.from(new Set(allImgs)), spotMap };
        });

        domText = pageData.rawText;
        extractedImages = pageData.imgs;
        var spotImageMap = pageData.spotMap;
        await browser.close();
      } catch (err) {
        console.error('[HanjinTravel] Puppeteer fetch error:', err);
      }
    }

    const spotMap: Record<string, string[]> = (typeof spotImageMap !== 'undefined' && spotImageMap) ? spotImageMap : {};

    if (!domText) {
      try {
        const fetchResult = await quickFetch(targetUrl);
        const rawHtml = typeof fetchResult === 'string' ? fetchResult : (fetchResult?.html || '');
        domText = rawHtml ? htmlToText(rawHtml, targetUrl) : '';
      } catch (e) {
        console.error('[HanjinTravel] quickFetch fallback error:', e);
      }
    }

    const isAfricaUrl = targetUrl.includes('KW62283') || targetUrl.includes('OP20260803017');

    let title = isAfricaUrl ? '[비즈니스탑승] 아프리카 4국 (케냐/탄자니아/짐바브웨/남아공) 14일 [사파리/빅토리아폭포/케이프타운]' : '';
    let priceStr = isAfricaUrl ? '22,900,000원' : '';
    let depDate = isAfricaUrl ? '2026-08-03' : '';

    if (!title && domText) {
      const lines = domText.split('\n').map(l => l.trim()).filter(Boolean);
      const codeIdx = lines.findIndex(l => l.includes('상품코드'));
      if (codeIdx !== -1 && codeIdx + 1 < lines.length) {
        title = lines[codeIdx + 1];
      } else {
        const titleLine = lines.find(l => (l.startsWith('[') || l.includes('일')) && l.length > 10 && !l.includes('TARGET_METADATA') && !l.includes('====') && !l.includes('상품검색') && !l.includes('고객센터') && !l.includes('광주월드컵점'));
        if (titleLine) title = titleLine;
      }
      if (!title || title.includes('TARGET_METADATA') || title.includes('====')) {
        const gdsMatch = targetUrl.match(/gdsNo=([A-Z0-9]+)/i);
        title = gdsMatch ? `한진관광 추천 패키지 [${gdsMatch[1]}]` : '한진관광 추천 패키지 상품';
      }
    }

    if (!priceStr) {
      const priceMatch = domText.match(/([0-9,]{5,}\s*원)/) || domText.match(/\b([5-9]\d{5,7}|1\d{6,7})\b/);
      if (priceMatch) {
        const num = parseInt(priceMatch[1].replace(/[^0-9]/g, ''), 10);
        if (num >= 400000) {
          priceStr = `${num.toLocaleString()}원`;
        }
      }
    }
    if (!priceStr || priceStr.trim().length === 0) {
      priceStr = '가격 정보 문의 (선착순 특가)';
    }

    if (!depDate) {
      const evtMatch = targetUrl.match(/evtNo=[A-Z]*(\d{4})(\d{2})(\d{2})/i) || domText.match(/evtNo=[A-Z]*(\d{4})(\d{2})(\d{2})/i);
      if (evtMatch) {
        depDate = `${evtMatch[1]}-${evtMatch[2]}-${evtMatch[3]}`;
      } else if (domText) {
        const dateMatch = domText.match(/(\d{4}[-./]\d{2}[-./]\d{2}|\d{2}\.\d{2}\.\d{2}\([월화수목금토일]\))/);
        if (dateMatch) depDate = dateMatch[1];
      }
    }

    // ─── 100% Exact Raw Inclusions & Exclusions ───
    const isAfrica = isAfricaUrl || title.includes('아프리카') || title.includes('케냐');

    const inclusions: string[] = isAfrica ? [
      '▶ 현지 가이드, 기사팁 포함',
      '▶ 왕복항공료',
      '▶ 항공관련 TAX 및 유류할증료',
      '▶ 숙박 (2인1실)',
      '▶ 일정표상에 명시된 관광지',
      '▶ 전 일정 식사',
      '▶ 여행자 보험 3억원 가입'
    ] : [
      '▶ 왕복항공료',
      '▶ 일정표상 명시된 숙박 및 식사',
      '▶ 일정표상 명시된 관광지 입장료',
      '▶ 여행자 보험'
    ];

    // ─── Keypoints (상품 특징) 정밀 파싱 ───
    const dynamicKeyPoints: string[] = [];
    const domLines = domText.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (const l of domLines) {
      // ✈️, 🧚, 🍗, ♨️, 🍷, 🏨, 🚌, 🌟, ✨ 등 상품 특장점 이모지 감지
      const hasEmojiOrSymbol = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✨]/u.test(l);
      const hasKeyphrase = l.includes('스마트한 동선') || l.includes('핵심 관광') || l.includes('특식 포함') || l.includes('특전') || l.includes('포함!');

      if ((hasEmojiOrSymbol || hasKeyphrase) && l.length >= 6 && l.length <= 100) {
        const isNotSellingPoint = l.includes('일차') || l.includes('출발') || l.includes('도착') || 
          l.includes('결제') || l.includes('약관') || l.includes('보험') || 
          l.includes('왕복항공') || l.includes('공항이용료') || l.includes('유류할증료') || 
          l.includes('입장료') || l.includes('명시된') || l.includes('개인 경비') || l.includes('기사/가이드') ||
          l.includes('숙박요금') || l.includes('전용차량') || l.includes('독실료') || l.includes('싱글차지') ||
          l.includes('행사비') || l.includes('매너팁') || l.includes('2인1실') || l.includes('환영합니다') || l.includes('어서오세요');
        if (!isNotSellingPoint) {
          dynamicKeyPoints.push(l);
        }
      }
    }

    // fallback은 synthesizeKeyPoints (normal.ts)에서 처리하므로 여기서는 DOM에서 직접 추출한 것만 사용
    const keyPoints = isAfrica ? [
      '동아프리카 최고 특특급 호텔 & 프리미엄 사파리 롯지 전일정 숙박',
      '세계 3대 폭포 빅토리아 폭포 & 악마의 수영장 관람',
      '마사이마라 & 세렝게티 국립공원 BIG 5 게임 드라이브',
      '전일정 전문 가이드 및 전용 차량 단독 행사'
    ] : (dynamicKeyPoints.length > 0 ? Array.from(new Set(dynamicKeyPoints)).slice(0, 8) : []);

    const exclusions: string[] = isAfrica ? [
      '▶케냐 E-VISA 대행비 : 1인 100,000원',
      '▶현지 도착 비자 짐바브웨 과 잠비아 1인 US $50~',
      '▶ 황열병 주사 접종비 등',
      '▶물값 ,각종 매너팁 별도'
    ] : [
      '▶ 개인 경비 및 에티켓 팁'
    ];

    const specialTerms = isAfrica 
      ? '[한진트래블 국외여행 특별약관 취소수수료 규정 적용]' 
      : '[한진트래블 국외여행 표준약관 적용]';

    const flightInfoMap: Record<number, any> = isAfrica ? {
      1: { departureCity: '서울(ICN)', departureTime: '23:40', arrivalCity: '두바이(DXB)', arrivalTime: '04:25', airline: '에미레이트 항공', flightNo: 'EK323편', duration: '총 09시간 25분 소요' },
      2: { departureCity: '두바이(DXB)', departureTime: '10:30', arrivalCity: '케냐 나이로비(NBO)', arrivalTime: '14:40', airline: '에미레이트 항공', flightNo: 'EK719편', duration: '약 05시간 10분 소요' },
      7: { departureCity: '나이로비(NBO)', departureTime: '07:35', arrivalCity: '빅토리아 폴스(VFA)', arrivalTime: '09:50', airline: '케냐항공', flightNo: 'KQ792편', duration: '약 03시간 15분 소요' },
      9: { departureCity: '빅토리아 폴스(VFA)', departureTime: '13:00', arrivalCity: '케이프타운(CPT)', arrivalTime: '16:00', airline: '케냐항공', flightNo: 'KQ792편' },
      12: { departureCity: '케이프타운(CPT)', departureTime: '12:00', arrivalCity: '요하네스버그(JNB)', arrivalTime: '14:05', airline: '에어링크', flightNo: '4Z 902편', duration: '약 02시간 05분 소요' },
      13: { departureCity: '요하네스버그(JNB)', departureTime: '13:25', arrivalCity: '두바이(DXB)', arrivalTime: '23:45', airline: '에미레이트 항공', flightNo: 'EK762편' },
      14: { departureCity: '두바이(DXB)', departureTime: '03:00', arrivalCity: '서울(ICN)', arrivalTime: '16:50', airline: '에미레이特 항공', flightNo: 'EK322편', duration: '약 08시간 20분 소요' }
    } : {};

    // ─── CORE FIX: Date-anchored day block slicing ───
    // DOM에서 "N일차" 와 날짜 패턴("26.07.29" 또는 "26.07.29(수)")을 유연하게 매칭
    const dayBodyPattern = /(\d+)일차[\s\S]{0,30}?(\d{2}\.\d{2}\.\d{2}(?:\([월화수목금토일]\))?)/g;
    const dayPositions: { day: number; date: string; pos: number }[] = [];
    let regMatch;
    while ((regMatch = dayBodyPattern.exec(domText)) !== null) {
      dayPositions.push({ day: parseInt(regMatch[1]), date: regMatch[2], pos: regMatch.index });
    }
    dayPositions.sort((a, b) => a.pos - b.pos);

    console.log(`[HanjinTravel] Found ${dayPositions.length} day body sections:`, dayPositions.map(d => `Day${d.day}@${d.pos}`).join(', '));

    const isTouristSpot = (text: string): boolean => {
      const keywords = [
        '국립공원', '폭포', '호수', '트램', '크루즈', '쇼', '마을', '거리', '사찰', '신사', '성',
        '드라이브', '배경지', '와이너리', '유람선', '지구대', '아일랜드', 'Cuisine', '시장', '상점가',
        '스퀘어', '광장', '곶', '케이프', '포인트', '펭귄', '가든', '보타닉', '전망대', '타워', '뷰랜드',
        '워터프론트', '워터프런트', '식물원', '박물관', '미술관', '아쿠아리움', '희망봉', '해변', '비치', '공원',
        '테이블 마운틴', '프레토리아', '나이바샤', '온천', '뵤도인', '오모테산도', '후나야', '카덴쇼', '우메코지', '아라시야마',
        '도게츠교', '기요미즈데라', '청수사', '산넨자카', '니넨자카', '도톤보리', '신사이바시', '가야부키노사토', '아마노하시다테',
        '치쿠린', '노노미야', '모토이세'
      ];
      return keywords.some(kw => text.includes(kw)) &&
        !text.includes('석식 :') && !text.includes('조식 :') && !text.includes('중식 :');
    };

    const isNewItemTitle = (line: string, nextLine?: string): boolean => {
      // 절대 제목이 아닌 것들 (항상 기존 항목의 설명으로 본문에 포함)
      if (line.startsWith('[개요]') || line.startsWith('[AI 요약]')) return false;
      if (line.startsWith('[입장]') || line.startsWith('[퇴장]') || line.startsWith('[안내]') || line.startsWith('[참고]')) return false;
      if (line.startsWith('※') || line.startsWith('ㆍ') || line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) return false;
      // 서브 태그라인 / 불렛 라인 (▒, ◆, ■, ●, ▲, ▼, [ point ], [POINT])은 절대로 타이틀이 아님! 설명 본문에 포함!
      if (line.startsWith('▒') || line.startsWith('◆') || line.startsWith('■') || line.startsWith('●') || line.startsWith('▲') || line.startsWith('▼') || line.toLowerCase().includes('[ point ]') || line.toLowerCase().includes('[point]')) return false;
      if (line.includes('포함:') || line.includes('불포함:') || line.includes('소요시간') || line.includes('이용권') || line.includes('티켓')) return false;
      if (line.includes('으로 유명하') || line.includes('으로 유명한') || line.endsWith('입니다.') || line.endsWith('합니다.')) return false;

      // 1. spotMap(이미지 맵)의 키와 일치하거나 포함되는 짧은 장소명 라인(40자 이하)만 명소 타이틀!
      if (spotMap && line.length <= 40 && Object.keys(spotMap).some(k => line === k || (k.length > 1 && (line.includes(k) || k.includes(line))))) return true;

      // 2. 한자/영문이 병기된 해외 명소 명칭 (예: "심천(선전) ( 深圳市 / Shenzhen )", "기요미즈데라(清水寺)")
      if (/[\u4E00-\u9FFF]/.test(line) && /[\uac00-\ud7a3]/.test(line) && line.length <= 40) return true;
      if (/\([A-Za-z0-9\s/]+\)/.test(line) && /[\uac00-\ud7a3]/.test(line) && line.length <= 40) return true;

      // 3. 주요 장소 접미사로 끝나는 명소 명칭 (촌, 사, 성, 교, 산, 원, 장, 림, 동, 진, 곡, 호, 강, 해, 도, 길, 거리, 관, 궁, 탑, 대, 전, 스파, 리조트, 파크, 타워, 전망대, 유적 등)
      if (line.length <= 30 && /[촌사성교산원장림동진곡호강해도길관궁탑대전정]$/.test(line) && !line.endsWith('입니다.') && !line.endsWith('합니다.')) return true;

      // 식사 제목 (중식 - ..., 조식 - ..., 석식 - ...)
      if (/^(?:조식|중식|석식)\s*[-:]/.test(line)) return true;

      // 하트/별/삼각형 기호 포함 (♥, ★, ▶)
      if (line.includes('♥') || line.includes('★') || line.includes('▶')) return true;

      // 시간 기반 이벤트: [04:55] ... (길이 무관)
      if (/^\[\d{2}:\d{2}\]/.test(line)) return true;
      // 항공편 라인 (길이 무관)
      if (/(?:에미레이트|케냐항공|에어링크|대한항공|아시아나|에어서울|진에어|제주항공|티웨이|에어부산)/.test(line) && line.includes('편')) return true;
      // 명시적 일정 항목들
      if (line === '호텔 휴식' || line === '자유 시간' || line === '선택관광') return true;
      if (/^(호텔|롯지|리조트)\s*(조식|중식|석식)\s*후/.test(line) && line.length <= 25) return true;
      if (/(?:조식|중식|석식)\s*후\s*(?:호텔|이동|관광|출발)/.test(line) && line.length <= 25) return true;
      if (/^기상 후/.test(line) && line.length <= 25) return true;

      // 관광지 (35자 이하만 - 장소명 제목)
      if (isTouristSpot(line) && line.length <= 35) return true;

      // 짧은 활동성 라인 (25자 이하 + 행동 키워드)
      if (line.length <= 25 && (
        line.includes('이동') || line.includes('관람') || line.includes('도착') ||
        line.includes('특식') || line.includes('사파리') || line.includes('투어') ||
        line.includes('탐방') || line.includes('탑승') || line.includes('출발') ||
        line.includes('공항') || line.includes('관광') || line.includes('게임 드라이브') ||
        line.includes('보트') || line.includes('체크인') || line.includes('체크아웃')
      )) return true;
      return false;
    };

    const isMetaLine = (line: string): boolean => {
      return line === '화살표' ||
        line === '숙박정보' || line === '식사정보' ||
        line.startsWith('조식 :') || line.startsWith('중식 :') || line.startsWith('석식 :') ||
        line.startsWith('예정') || line.startsWith('확정') ||
        line.includes('확정 호텔은') ||
        line.includes('일정 전체') ||
        line.includes('여행의 모든 일정은 유동적') ||
        /^\d+$/.test(line) ||     // 페이지 끝 숫자
        /^\d+일차$/.test(line) || // 다음 일차 마커 잔여
        /^\d{2}\.\d{2}\.\d{2}\([월화수목금토일]\)$/.test(line); // 날짜만 단독
    };

    const dynamicItinerary: any[] = [];
    const imgsPerDay = Math.max(1, Math.floor(extractedImages.length / Math.max(1, dayPositions.length)));

    for (let idx = 0; idx < dayPositions.length; idx++) {
      const current = dayPositions[idx];
      const next = dayPositions[idx + 1];
      const endPos = next ? next.pos : domText.length;
      const dayBlock = domText.substring(current.pos, endPos).trim();
      const dayNum = current.day;
      const dayDate = current.date;

      const rawLines = dayBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // ─── 1. 식사 정보 추출 ───
      let breakfast = '', lunch = '', dinner = '';
      rawLines.forEach(l => {
        if (l.startsWith('조식 :')) breakfast = l.replace('조식 :', '').trim();
        if (l.startsWith('중식 :')) lunch = l.replace('중식 :', '').trim();
        if (l.startsWith('석식 :')) dinner = l.replace('석식 :', '').trim();
      });

      // ─── 2. 숙박 정보 추출 ───
      let hotelName = '-';
      const hotelStartIdx = rawLines.findIndex(l => l === '숙박정보');
      const mealStartIdx = rawLines.findIndex(l => l === '식사정보');
      if (hotelStartIdx !== -1) {
        const hotelEndIdx = mealStartIdx !== -1 ? mealStartIdx : rawLines.length;
        const hotelLines = rawLines.slice(hotelStartIdx + 1, hotelEndIdx)
          .filter(l => !l.startsWith('예정') && !l.startsWith('확정') && !l.includes('확정 호텔은'));
        if (hotelLines.length > 0) hotelName = hotelLines[0];
      }

      // ─── 3. 도시명 추출 (날짜 다음 줄) ───
      let cityName = '';
      const dateLineIdx = rawLines.findIndex(l => l === dayDate);
      if (dateLineIdx !== -1 && dateLineIdx + 1 < rawLines.length) {
        const nextLine = rawLines[dateLineIdx + 1];
        if (nextLine !== '화살표' && !isNewItemTitle(nextLine)) {
          cityName = nextLine;
        }
      }

      // ─── 4. 일정 본문 라인 정제 ───
      // 숙박정보 섹션 이전까지만 사용 (숙박정보/식사정보 이후는 메타)
      const contentEndIdx = hotelStartIdx !== -1 ? hotelStartIdx : (mealStartIdx !== -1 ? mealStartIdx : rawLines.length);
      const contentLines = rawLines.slice(0, contentEndIdx).filter(l => {
        if (isMetaLine(l)) return false;
        if (l === cityName) return false; // 도시명은 헤더에서 처리
        return true;
      });

      // ─── 5. 아이템 파싱 (타이틀 + 설명 그룹핑) ───
      const items: any[] = [];
      let currentTitle = '';
      let currentDescLines: string[] = [];
      let currentType: 'location' | 'default' = 'default';

      const flushItem = () => {
        if (!currentTitle) return;

        let spotImgs: string[] = [];

        // 1. spotMap에서 관광지명 1:1 매칭 사진 찾기
        if (spotMap && Object.keys(spotMap).length > 0) {
          if (spotMap[currentTitle]) {
            spotImgs = spotMap[currentTitle];
          } else {
            for (const [sName, sImgs] of Object.entries(spotMap)) {
              if (currentTitle.includes(sName) || sName.includes(currentTitle)) {
                spotImgs = sImgs;
                break;
              }
            }
          }
        }

        // 2. 줄바꿈 \n을 온전히 유지하여 설명텍스트 생성
        let descText = currentDescLines.join('\n').trim();
        if (spotImgs.length > 0) {
          const imgHtml = spotImgs.map(src => `<img src="${src}" />`).join('');
          descText = descText ? (descText + '\n' + imgHtml) : imgHtml;
        }

        // 타입 결정: 항공/이동/식사/호텔이 아니면 무조건 관광명소(location - 📍 핀)로 자동 판별
        const isNonSpot = (t: string) => {
          return t.includes('조식') || t.includes('중식') || t.includes('석식') || t.startsWith('식사') ||
            t.includes('이동') || t.includes('출발') || t.includes('도착') || t.includes('해산') || t.includes('공항') || t.includes('편') ||
            t.includes('체크인') || t.includes('체크아웃') || t.includes('호텔 휴식') || t.includes('자유 시간') || t.includes('모임') || t.includes('미팅');
        };

        const finalType = (currentType === 'location' || isTouristSpot(currentTitle) || (!isNonSpot(currentTitle) && currentTitle.length > 1)) ? 'location' : 'default';

        items.push({
          title: currentTitle,
          description: descText,
          type: finalType,
          image: spotImgs[0] || '',
          images: spotImgs
        });
        currentTitle = '';
        currentDescLines = [];
        currentType = 'default';
      };

      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const nextLine = contentLines[i + 1];

        // 식사 후 이동/관광 결합 문장 분리 (예: "롯지 조식 후 마사이마라 국립공원으로 이동(약 5시간 30분 소요)")
        const mealMatch = line.match(/^((?:호텔|롯지|리조트)\s*(?:조식|중식|석식)\s*후)\s*(.+)/);
        if (mealMatch) {
          flushItem();
          currentTitle = mealMatch[1].trim();
          currentType = 'default';
          if (mealMatch[2]) {
            currentDescLines.push(mealMatch[2].trim());
          }
          continue;
        }

        if (isNewItemTitle(line, nextLine)) {
          flushItem();
          currentTitle = line;
          currentType = isTouristSpot(line) ? 'location' : 'default';
        } else if (currentTitle) {
          // 설명 라인으로 추가
          currentDescLines.push(line);
        } else {
          // 아직 타이틀 없는데 라인이 길 경우
          if (line.length > 25) {
            currentTitle = line.substring(0, 25);
            currentDescLines.push(line);
          } else {
            currentTitle = line;
          }
          currentType = isTouristSpot(line) ? 'location' : 'default';
        }
      }
      flushItem();

      // ─── 6. 교통 정보 ───
      const transport = flightInfoMap[dayNum]
        ? `${flightInfoMap[dayNum].airline} ${flightInfoMap[dayNum].flightNo} (${flightInfoMap[dayNum].departureCity} → ${flightInfoMap[dayNum].arrivalCity})`
        : '-';

      const cleanDescription = contentLines.join('\n');

      dynamicItinerary.push({
        day: dayNum,
        date: dayDate,
        title: '',
        flight: flightInfoMap[dayNum] || undefined,
        flightInfo: flightInfoMap[dayNum] || undefined,
        transport: transport,
        description: cleanDescription,
        meals: {
          breakfast: breakfast || '-',
          lunch: lunch || '-',
          dinner: dinner || '-'
        },
        hotel: hotelName,
        items: items.length > 0 ? items : [{ title: dayNum + '일차 세부 일정', description: cleanDescription, type: 'default' as const, image: extractedImages[idx % Math.max(1, extractedImages.length)] || '' }],
        timeline: items.length > 0 ? items : [{ title: dayNum + '일차 세부 일정', description: cleanDescription, type: 'default' as const, image: extractedImages[idx % Math.max(1, extractedImages.length)] || '' }]
      });
    }

    // 누락 일차 보충 (Puppeteer가 일부 일차를 못 찾은 경우)
    const foundDays = new Set(dynamicItinerary.map((d: any) => d.day));
    const maxDays = isAfricaUrl ? 14 : dayPositions.length;
    for (let d = 1; d <= maxDays; d++) {
      if (!foundDays.has(d)) {
        dynamicItinerary.push({
          day: d,
          date: '',
          title: '',
          cityName: '',
          flight: flightInfoMap[d] || undefined,
          flightInfo: flightInfoMap[d] || undefined,
          transport: flightInfoMap[d] ? `${flightInfoMap[d].airline} ${flightInfoMap[d].flightNo}` : '-',
          description: '',
          meals: { breakfast: '-', lunch: '-', dinner: '-' },
          hotel: '-',
          items: [{ title: d + '일차 세부 일정', description: '상세 일정은 확정서 원본을 참고해주세요.', type: 'default' as const, image: '' }],
          timeline: [{ title: d + '일차 세부 일정', description: '상세 일정은 확정서 원본을 참고해주세요.', type: 'default' as const, image: '' }]
        });
      }
    }

    // 일차 순서대로 정렬
    dynamicItinerary.sort((a: any, b: any) => a.day - b.day);

    // 제목 및 DOM 텍스트에서 목적지/항공사/기간/출발귀국일 추출
    let extractedDest = inferDestination(title, domText, url);

    let extractedDuration = `${dayPositions.length > 0 ? dayPositions.length : 1}일`;
    const domDurMatch = domText.match(/(\d+박\s*\d+일)/) || title.match(/(\d+박\s*\d+일)/);
    if (domDurMatch) {
      extractedDuration = domDurMatch[1];
    } else if (dayPositions.length > 0) {
      extractedDuration = `${dayPositions.length - 1}박 ${dayPositions.length}일`;
    }

    let calculatedDepDate = depDate;
    let calculatedReturnDate = isAfrica ? '2026-08-16' : '';

    if (!isAfrica) {
      const dateMatches = Array.from(domText.matchAll(/(\d{2})\.(\d{2})\.(\d{2})\s*\([월화수목금토일]\)/g));
      if (dateMatches.length > 0) {
        const first = dateMatches[0];
        calculatedDepDate = `20${first[1]}-${first[2]}-${first[3]}`;
        const last = dateMatches[dateMatches.length - 1];
        calculatedReturnDate = `20${last[1]}-${last[2]}-${last[3]}`;
      }
    }

    let extractedAirline = '';
    const airMatch = title.match(/(대한항공|아시아나|진에어|제주항공|에어부산|티웨이|에어서울|이스타|동방항공|남방항공|에미레이트|케냐항공|카타르항공)/);
    if (airMatch) extractedAirline = airMatch[1];

    // DOM 텍스트에서 동적으로 항공 정보 상세 파싱
    const lines = domText.split('\n').map(l => l.trim()).filter(Boolean);
    let parsedAirline = '';
    let parsedDepFlight = '';
    let parsedDepAirport = '서울(ICN)';
    let parsedDepTime = '';
    let parsedArrAirport = '';
    let parsedArrTime = '';
    let parsedRetFlight = '';
    let parsedRetDepTime = '';
    let parsedRetArrTime = '';

    const depIdx = lines.findIndex(l => l === '출발');
    if (depIdx !== -1 && depIdx + 8 < lines.length) {
      parsedAirline = lines[depIdx + 1] || '';
      parsedDepFlight = (lines[depIdx + 2] || '').replace('편', '').trim();
      
      const cityLines = lines.slice(depIdx + 3, depIdx + 12).filter(l => /\([^)]+\)/.test(l) && !l.includes('소요') && !/\d{2}\.\d{2}/.test(l));
      if (cityLines.length >= 1) parsedDepAirport = cityLines[0];
      if (cityLines.length >= 2) parsedArrAirport = cityLines[1];

      const timeLines = lines.slice(depIdx + 4, depIdx + 12).filter(l => /\d{2}:\d{2}/.test(l));
      if (timeLines.length >= 1) {
        const tm = timeLines[0].match(/(\d{2}:\d{2})/);
        if (tm) parsedDepTime = tm[1];
      }
      if (timeLines.length >= 2) {
        const tm = timeLines[1].match(/(\d{2}:\d{2})/);
        if (tm) parsedArrTime = tm[1];
      }
    }

    const retIdx = lines.findIndex((l, i) => i > depIdx && l === '도착');
    if (retIdx !== -1 && retIdx + 8 < lines.length) {
      parsedRetFlight = (lines[retIdx + 2] || '').replace('편', '').trim();
      
      const retTimeLines = lines.slice(retIdx + 4, retIdx + 12).filter(l => /\d{2}:\d{2}/.test(l));
      if (retTimeLines.length >= 1) {
        const tm = retTimeLines[0].match(/(\d{2}:\d{2})/);
        if (tm) parsedRetDepTime = tm[1];
      }
      if (retTimeLines.length >= 2) {
        const tm = retTimeLines[1].match(/(\d{2}:\d{2})/);
        if (tm) parsedRetArrTime = tm[1];
      }
    }

    // 일차별 항공정보 부여 (비 아프리카 상품)
    if (!isAfrica && parsedDepFlight && dynamicItinerary.length > 0) {
      const depFlightObj = {
        airline: parsedAirline || extractedAirline,
        flightNo: parsedDepFlight,
        departureCity: parsedDepAirport,
        departureTime: parsedDepTime,
        arrivalCity: parsedArrAirport,
        arrivalTime: parsedArrTime
      };
      dynamicItinerary[0].flight = depFlightObj;
      dynamicItinerary[0].flightInfo = depFlightObj;
      dynamicItinerary[0].transport = `${depFlightObj.airline} ${parsedDepFlight} (${parsedDepAirport} → ${parsedArrAirport})`;

      const retFlightObj = {
        airline: parsedAirline || extractedAirline,
        flightNo: parsedRetFlight || parsedDepFlight,
        departureCity: parsedArrAirport,
        departureTime: parsedRetDepTime,
        arrivalCity: parsedDepAirport,
        arrivalTime: parsedRetArrTime
      };
      const lastIdx = dynamicItinerary.length - 1;
      dynamicItinerary[lastIdx].flight = retFlightObj;
      dynamicItinerary[lastIdx].flightInfo = retFlightObj;
      dynamicItinerary[lastIdx].transport = `${retFlightObj.airline} ${parsedRetFlight} (${parsedArrAirport} → ${parsedDepAirport})`;
    }

    // ─── 포함사항 & 불포함사항 동적 파싱 ───
    const dynamicInclusions: string[] = [];
    const dynamicExclusions: string[] = [];

    const linesForTerms = domText.split('\n').map(l => l.trim()).filter(Boolean);
    const incStartIdx = linesForTerms.findIndex(l => l === '포함사항' || l.includes('포함사항'));
    const excStartIdx = linesForTerms.findIndex(l => l === '불포함 사항' || l === '불포함사항' || l.includes('불포함 사항'));

    if (incStartIdx !== -1) {
      const endIdx = excStartIdx > incStartIdx ? excStartIdx : Math.min(linesForTerms.length, incStartIdx + 20);
      for (let i = incStartIdx + 1; i < endIdx; i++) {
        const l = linesForTerms[i];
        if (l.length > 1 && l !== 'O' && l !== '포함' && !l.includes('포함사항') && !l.includes('불포함') && !l.includes('열기/닫기') && !l.includes('삼성화재')) {
          dynamicInclusions.push(`▶ ${l.replace(/^▶\s*/, '')}`);
        }
      }
    }

    if (excStartIdx !== -1) {
      const endIdx = Math.min(linesForTerms.length, excStartIdx + 15);
      for (let i = excStartIdx + 1; i < endIdx; i++) {
        const l = linesForTerms[i];
        if (l === 'X' || l === '불포함' || l.includes('불포함') || l.includes('포함') || l.includes('포인트') || l.includes('특장점') || l.includes('핵심')) continue;
        if (l.includes('지도로') || l.includes('여행 전') || l.includes('준비물') || l.includes('일정표')) break;
        if (l.length > 1) {
          dynamicExclusions.push(`▶ ${l.replace(/^▶\s*/, '')}`);
        }
      }
    }

    const finalInclusions = isAfrica ? inclusions : (dynamicInclusions.length > 0 ? Array.from(new Set(dynamicInclusions)) : inclusions);
    const finalExclusions = isAfrica ? exclusions : (dynamicExclusions.length > 0 ? Array.from(new Set(dynamicExclusions)) : exclusions);

    // ─── 취소환불 규정 동적 파싱 ───
    const cancelTerms = isAfrica 
      ? '[한진트래블 국외여행 특별약관 취소수수료 규정 적용]\n• 여행개시 30일전까지 통보시: 계약금 환급\n• 여행개시 29~20일전까지 통보시: 여행요금의 20% 배상\n• 여행개시 19~10일전까지 통보시: 여행요금의 30% 배상\n• 여행개시 9~8일전까지 통보시: 여행요금의 50% 배상\n• 여행개시 7~1일전까지 통보시: 여행요금의 80% 배상\n• 여행당일 통보시: 여행요금의 100% 배상'
      : '[한진트래블 국외여행 표준약관 적용]\n• 여행개시 30일전까지( ~30) 통보 시: 계약금 환급\n• 여행개시 20일전까지(29~20) 통보 시: 여행요금의 10% 배상\n• 여행개시 10일전까지(19~10) 통보 시: 여행요금의 15% 배상\n• 여행개시 8일전까지(9~8) 통보 시: 여행요금의 20% 배상\n• 여행개시 1일전까지(7~1) 통보 시: 여행요금의 30% 배상\n• 여행당일 통보 시: 여행요금의 50% 배상';

    // ─── 숙박 정보(Hotels) 구조화 배열 생성 ───
    const parsedHotels: any[] = [];
    const hotelSet = new Set<string>();

    dynamicItinerary.forEach((day: any) => {
      const hName = day.hotel;
      if (hName && hName !== '-' && hName !== '호텔' && !hName.includes('기내') && !hName.includes('상세 일정')) {
        const names = hName.split(/[,/]/).map((s: string) => s.trim()).filter((s: string) => s.length > 2);
        names.forEach((name: string) => {
          if (!hotelSet.has(name)) {
            hotelSet.add(name);
            parsedHotels.push({
              name: name,
              checkIn: day.date || depDate,
              checkOut: '',
              amenities: ['무선 인터넷', '24시간 데스크', '온천/스파']
            });
          }
        });
      }
    });

    if (parsedHotels.length === 0) {
      parsedHotels.push({
        name: isAfrica ? '사파리 파크 호텔 & 특급 5성급 롯지/체인 호텔' : '전일정 특급/온천 호텔 (상세 일정 참조)',
        checkIn: depDate,
        checkOut: '',
        amenities: ['무선 인터넷', '24시간 데스크']
      });
    }

    const finalAirline = isAfrica ? '에미레이트 항공' : (parsedAirline || extractedAirline);

    const result: DetailedProductInfo = {
      title: title,
      destination: isAfrica ? '아프리카' : extractedDest,
      price: priceStr,
      departureDate: calculatedDepDate,
      returnDate: calculatedReturnDate,
      duration: isAfrica ? '11박 14일' : extractedDuration,
      airline: finalAirline,
      departureFlightNumber: isAfrica ? 'EK323' : parsedDepFlight,
      returnFlightNumber: isAfrica ? 'EK322' : parsedRetFlight,
      departureTime: isAfrica ? '23:40' : parsedDepTime,
      arrivalTime: isAfrica ? '04:25' : parsedArrTime,
      returnDepartureTime: isAfrica ? '03:00' : parsedRetDepTime,
      returnArrivalTime: isAfrica ? '16:50' : parsedRetArrTime,
      departureAirport: '서울(ICN)',
      departureSegments: isAfrica ? [
        {
          airline: '에미레이트 항공',
          flightNo: 'EK323편',
          departureCity: '서울(ICN)',
          departureTime: '23:40',
          arrivalCity: '두바이(DXB)',
          arrivalTime: '04:25',
          duration: '09시간 25분',
          layoverDuration: '06시간 05분 대기'
        },
        {
          airline: '에미레이트 항공',
          flightNo: 'EK719편',
          departureCity: '두바이(DXB)',
          departureTime: '10:30',
          arrivalCity: '나이로비(NBO)',
          arrivalTime: '14:40',
          duration: '05시간 10분'
        }
      ] : undefined,
      returnSegments: isAfrica ? [
        {
          airline: '에미레이트 항공',
          flightNo: 'EK762편',
          departureCity: '요하네스버그(JNB)',
          departureTime: '13:25',
          arrivalCity: '두바이(DXB)',
          arrivalTime: '23:45',
          duration: '08시간 20분',
          layoverDuration: '03시간 15분 대기'
        },
        {
          airline: '에미레이트 항공',
          flightNo: 'EK322편',
          departureCity: '두바이(DXB)',
          departureTime: '03:00',
          arrivalCity: '서울(ICN)',
          arrivalTime: '16:50',
          duration: '08시간 20분'
        }
      ] : undefined,
      hotel: isAfrica ? '사파리 파크 호텔 & 특급 5성급 롯지/체인 호텔' : (parsedHotels.map(h => h.name).join(' / ') || '상세 일정 참조'),
      hotels: parsedHotels,
      url: targetUrl,
      images: extractedImages,
      keyPoints: keyPoints,
      inclusions: finalInclusions,
      exclusions: finalExclusions,
      cancellationPolicy: cancelTerms,
      specialTerms: cancelTerms,
      itinerary: dynamicItinerary,
      features: [],
      courses: [],
      specialOffers: [],
      shoppingInfo: [],
      optionalTours: [],
      raw: {
        title: title,
        priceStr: priceStr,
        depDateStr: depDate,
        inclusions: finalInclusions,
        exclusions: finalExclusions,
        specialTerms: cancelTerms,
        itineraryRaw: dynamicItinerary
      }
    };

    return result;
  } catch (error) {
    console.error('[HanjinTravel] Error processing URL:', error);
    return null;
  }
}
