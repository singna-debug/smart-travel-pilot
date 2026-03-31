import { NextRequest, NextResponse } from 'next/server';
import type { SecondaryResearch } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash';

/* ── 국가별 필수 입국/세관 절차 참조 데이터 ── */
const ENTRY_REQUIREMENTS: Record<string, { links: { label: string; url: string; type: 'visa' | 'arrival_card' | 'customs' | 'other'; description: string; howTo: string }[] }> = {
    '괌': {
        links: [
            { label: 'G-CNMI ETA (전자입국허가)', url: 'https://g-cnmi-eta.cbp.dhs.gov/', type: 'visa', description: '한국 국적자가 괌/사이판에 입국하기 위해 반드시 사전 신청해야 하는 전자입국허가(ETA)입니다. 45일 이내 관광 시 비자 면제이며, 대신 ETA를 발급받아야 합니다.', howTo: '공식 웹사이트(g-cnmi-eta.cbp.dhs.gov)에 접속하여 여권 정보, 항공편 정보, 체류지 주소를 입력하고 제출합니다. 승인 후 이메일로 확인서를 받으며, 출력 또는 캡처하여 공항에서 제시합니다.' },
            { label: 'Guam Electronic Declaration (전자세관신고)', url: 'https://dca.guam.gov/', type: 'customs', description: '괌 입국 시 세관 신고를 사전에 온라인으로 작성할 수 있는 전자 신고 시스템입니다. 면세 한도 초과 물품이 없더라도 작성하면 입국 수속이 빨라집니다.', howTo: 'dca.guam.gov 웹사이트에서 여권 정보와 반입 물품 정보를 입력하고 제출합니다. 완료 후 생성된 QR코드를 캡처하여 입국 시 세관에 제시합니다.' },
        ]
    },
    '사이판': {
        links: [
            { label: 'G-CNMI ETA (전자입국허가)', url: 'https://g-cnmi-eta.cbp.dhs.gov/', type: 'visa', description: '한국 국적자가 사이판(CNMI)에 입국하기 위해 반드시 사전 신청해야 하는 전자입국허가(ETA)입니다.', howTo: '공식 웹사이트(g-cnmi-eta.cbp.dhs.gov)에 접속하여 여권 정보, 항공편 정보를 입력하고 제출합니다. 승인 이메일을 받으면 완료입니다.' },
        ]
    },
    '미국': {
        links: [
            { label: 'ESTA (전자여행허가)', url: 'https://esta.cbp.dhs.gov/', type: 'visa', description: '미국 입국 전 반드시 사전 신청이 필요한 전자여행허가(ESTA)입니다. 2년간 유효하며 최대 90일 체류 가능합니다.', howTo: 'esta.cbp.dhs.gov에서 여권 정보, 이메일, 미국 내 체류 주소를 입력합니다. 수수료 $21 온라인 결제 후 보통 72시간 이내 승인됩니다.' },
        ]
    },
    '중국': {
        links: [
            { label: 'NIA 온라인 입국 카드 (PC버전)', url: 'https://s.nia.gov.cn/ArrivalCardFillingPC/', type: 'arrival_card', description: '중국 입국 시 필요한 입국 신고를 온라인으로 미리 작성할 수 있습니다. 한국 국적자는 현재 30일 무비자 입국이 가능합니다.', howTo: 'PC에서 링크 접속 후 개인 정보 및 방문 목적을 입력합니다. 생성된 QR코드를 캡처하여 입국 시 제시합니다.' },
            { label: 'NIA 온라인 입국 카드 (모바일버전)', url: 'https://s.nia.gov.cn/ArrivalCardFillingPhone/', type: 'arrival_card', description: '모바일 기기에서 간편하게 중국 입국 신고서를 작성할 수 있습니다.', howTo: '스마트폰으로 접속하여 여권 및 항공권 정보를 입력하고 QR코드를 발급받아 저장합니다.' },
        ]
    },
    '일본': {
        links: [
            { label: 'Visit Japan Web (입국심사·세관)', url: 'https://vjw-lp.digital.go.jp/ko/', type: 'arrival_card', description: '일본 입국 시 입국심사와 세관 신고를 사전에 등록할 수 있는 디지털 서비스입니다. 등록하면 QR코드로 빠르게 수속할 수 있습니다.', howTo: '웹사이트 접속 후 여권 정보, 항공편, 체류 호텔 정보를 등록합니다. 입국심사 및 세관신고 QR코드를 각각 발급받아 캡처합니다.' },
        ]
    },
    '대만': {
        links: [
            { label: '대만 온라인 입국신고서', url: 'https://oa1.immigration.gov.tw/nia_acard/acardAddAction.action', type: 'arrival_card', description: '대만 입국 전 온라인으로 입국신고서를 미리 작성하면 공항에서 종이 신고서를 쓸 필요가 없습니다.', howTo: '공식 사이트에 접속하여 여권 정보, 대만 내 숙소 주소를 입력합니다. 제출 후 생성된 승인 정보를 확인합니다.' },
        ]
    },
    '베트남': {
        links: [
            { label: '베트남 e-Visa 신청 (45일 초과 시)', url: 'https://evisa.xuatnhapcanh.gov.cn/', type: 'visa', description: '한국 국적자는 45일 이내 무비자 입국이 가능합니다. 단, 45일 이상 체류 시 반드시 e-Visa를 사전 신청해야 합니다.', howTo: '공식 사이트에서 여권 정보와 입국 예정일을 입력하고 수수료를 결제합니다. 약 3영업일 내 승인 결과를 이메일로 받습니다.' },
        ]
    },
    '태국': {
        links: [
            { label: '태국 입국 신고서 (TM6)', url: 'https://tdapp.immigration.go.th/', type: 'arrival_card', description: '태국 입국 시 전자 입국신고서(TM6)를 미리 작성하면 수속이 빨라집니다. 현재 일부 기내 작성이 병행될 수 있습니다.', howTo: '이민국 웹사이트에서 여권 정보와 체류지 정보를 입력한 후 제출합니다.' },
        ]
    },
    '필리핀': {
        links: [
            { label: 'eTravel (전자입국신고)', url: 'https://etravel.gov.ph/', type: 'arrival_card', description: '필리핀 입국을 위한 필수 사전 등록 시스템입니다. 출발 72시간 전부터 등록 가능하며 비자 없이 30일 체류 가능합니다.', howTo: 'etravel.gov.ph 사이트에서 정보를 입력하고 완료 후 생성된 QR코드를 캡처하여 제시합니다.' },
        ]
    },
    '싱가포르': {
        links: [
            { label: 'SG Arrival Card (입국신고서)', url: 'https://eservices.ica.gov.sg/sgarrivalcard/', type: 'arrival_card', description: '싱가포르 입국 전 3일 이내에 온라인으로 작성해야 하는 필수 입국 신고서입니다.', howTo: '공식 사이트에서 여권 정보 및 숙소 정보를 입력하고 확인 이메일을 수령합니다.' },
        ]
    },
    '인도네시아': {
        links: [
            { label: '인도네시아 전자 세관신고 (e-CD)', url: 'https://ecd.beacukai.go.id/', type: 'customs', description: '발리 등 인도네시아 입국 시 필수인 세관 신고 시스템입니다. VOA(도착비자)와 별도로 작성해야 합니다.', howTo: '도착 전 웹사이트에서 반입 물품 정보를 입력하고 QR코드를 생성하여 세관 통과 시 제시합니다.' },
        ]
    },
    '말레이시아': {
        links: [
            { label: 'MDAC (디지털 입국카드)', url: 'https://imigresen-online.imi.gov.my/mdac/main', type: 'arrival_card', description: '말레이시아 입국 전 3일 이내에 온라인으로 작성해야 하는 디지털 입국 신고서입니다.', howTo: '웹사이트에서 인적사항과 여행 일정을 입력한 후 제출합니다.' },
        ]
    },
    '호주': {
        links: [
            { label: '호주 ETA 신청 (안드로이드)', url: 'https://play.google.com/store/apps/details?id=au.gov.homeaffairs.eta', type: 'visa', description: '호주 입국을 위한 전자여행허가(ETA) 신청 앱입니다. 수수료 AUD 20이 발생합니다.', howTo: '앱 설치 후 여권 스캔 및 안면 인식을 통해 신청합니다.' },
            { label: '호주 ETA 신청 (애플 iOS)', url: 'https://apps.apple.com/kr/app/australianeta/id1527982364', type: 'visa', description: '아이폰용 호주 ETA 신청 전용 앱입니다.', howTo: '앱 스토어에서 앱을 다운로드하여 정보를 입력하고 수수료를 결제합니다.' },
        ]
    },
    '캐나다': {
        links: [
            { label: 'eTA (전자여행허가)', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html', type: 'visa', description: '캐나다 항공 입국 시 필수인 사전 승인 제도입니다. 5년간 유효하며 신청 비용은 CAD 7입니다.', howTo: '공식 사이트에서 정보를 입력하고 결제하면 수분 내 이메일 승인이 완료됩니다.' },
        ]
    },
    '뉴질랜드': {
        links: [
            { label: 'NZeTA (전자여행허가)', url: 'https://nzeta.immigration.govt.nz/', type: 'visa', description: '뉴질랜드 무비자 입국 전 반드시 승인받아야 하는 허가증입니다. 환경세 포함 약 5만원의 비용이 발생합니다.', howTo: '공식 웹사이트 또는 전용 앱에서 여권 정보를 입력하고 승인 결과를 기다립니다.' },
        ]
    },
};

function getHardcodedLinks(destination: string) {
    const d = destination.toLowerCase();
    for (const [key, val] of Object.entries(ENTRY_REQUIREMENTS)) {
        if (d.includes(key.toLowerCase())) return val.links;
    }
    
    // 주요 도시별 국가 매핑 (매칭 확률 향상)
    const cityMap: Record<string, string> = {
        '도쿄': '일본', '오사카': '일본', '후쿠오카': '일본', '삿포로': '일본', '나고야': '일본', '오키나와': '일본',
        '다낭': '베트남', '나트랑': '베트남', '푸꾸옥': '베트남', '하노이': '베트남', '호치민': '베트남', '달랏': '베트남', '판랑': '베트남',
        '방콕': '태국', '푸켓': '태국', '치앙마이': '태국', '파타야': '태국',
        '세부': '필리핀', '보라카이': '필리핀', '마닐라': '필리핀', '보홀': '필리핀', '클락': '필리핀',
        '타이페이': '대만', '가오슝': '대만', '타이중': '대만',
        '발리': '인도네시아', '자카르타': '인도네시아',
        '쿠알라룸푸르': '말레이시아', '코타키나발루': '말레이시아', '조호르바루': '말레이시아',
        '싱가포르': '싱가포르', '싱가폴': '싱가포르',
        '베이징': '중국', '상하이': '중국', '칭다오': '중국', '청도': '중국', '장자지에': '중국', '장가계': '중국',
        '괌': '괌', '사이판': '사이판',
        '하와이': '미국', '호놀룰루': '미국', '뉴욕': '미국', 'LA': '미국', '로스앤젤레스': '미국', '샌프란시스코': '미국', '시애틀': '미국', '라스베가스': '미국', '라스베이거스': '미국',
        '시드니': '호주', '멜버른': '호주', '브리즈번': '호주', '골드코스트': '호주', '퍼스': '호주',
        '토론토': '캐나다', '밴쿠버': '캐나다', '캘거리': '캐나다', '몬트리올': '캐나다',
        '오클랜드': '뉴질랜드', '크라이스트처치': '뉴질랜드', '퀸스타운': '뉴질랜드'
    };
    
    for (const [city, country] of Object.entries(cityMap)) {
        if (d.includes(city)) return ENTRY_REQUIREMENTS[country]?.links || null;
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, destination, travelMonth, airline, baggageNote, customGuides } = body;

        if (!apiKey) {
            console.error('[SecondaryResearch] Missing GEMINI_API_KEY');
            return NextResponse.json({ success: false, error: 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.' }, { status: 500 });
        }

        if (!destination) {
            return NextResponse.json({ success: false, error: '여행지 정보가 필요합니다.' }, { status: 400 });
        }

        const context = `[요청된 여행지/국가/도시]: ${destination} (★★★오직 이 장소를 기준으로 날씨/환전/관광지 정보 작성, 다른 나라로 착각 절대 금지)\n[상품명/설명 대상]: ${title || '일반 패키지 여행 (상품명이 없어도 이 도시의 일반적인 정보를 꼭 작성할 것)'}\n[여행 시기]: ${travelMonth || '일반 시즌'}\n[이용 항공사]: ${airline || '개별 예약'}\n[수하물 규정 참고]: ${baggageNote || '일반 규정'}`;

        const tasks = [
            {
                name: 'basics',
                prompt: `
컨텍스트: ${context}
위 여행지에 대한 현지 정보를 아래 JSON 형식으로 반환하세요. (마크다운 없이 순수 JSON만 반환)
{
  "currency": { "localCurrency": "예: JPY", "currencySymbol": "예: ¥", "calculationTip": "환산 팁 1줄", "exchangeTip": "환전 요령", "tipCulture": "팁 문화 유무" },
  "roaming": { "carriers": "통신사 로밍 안내", "simEsim": "유심/eSIM 추천", "roamingTip": "관련 꿀팁" },
  "weather": {
    "summary": "해당 월 날씨 요약 (예: 낮에는 덥고 습도가 낮아 쾌적합니다.)",
    "forecast": [
      { "date": "1일차", "tempMin": "최저기온(숫자만)", "tempMax": "최고기온(숫자만)", "description": "날씨 간략 설명" },
      { "date": "2일차", "tempMin": "최저기온(숫자만)", "tempMax": "최고기온(숫자만)", "description": "날씨 간략 설명" },
      { "date": "3일차", "tempMin": "최저기온(숫자만)", "tempMax": "최고기온(숫자만)", "description": "날씨 간략 설명" },
      { "date": "4일차", "tempMin": "최저기온(숫자만)", "tempMax": "최고기온(숫자만)", "description": "날씨 간략 설명" }
    ],
    "clothingTips": [
      { "title": "상의 & 외투", "content": "옷차림 상세 조언" },
      { "title": "신발 & 기타", "content": "신발 및 필수 아이템" },
      { "title": "하의 준비", "content": "사원 방문 등 하의 조언" },
      { "title": "수영복", "content": "물놀이 관련 준비물" }
    ],
    "packingSummary": "추천 짐싸기 요약 한 줄"
  }
}`
            },
            {
                name: 'rules',
                prompt: `
컨텍스트: ${context}
위 여행지의 세관 및 입국 규정을 생성하세요. 이 여행지(국가) 특유의 제재사항을 구체적으로 명시하되, 금(Gold) 관련 이야기는 꼭 필요한 국가가 아니면 생략하고 수하물 규정에 집중하세요. (마크다운 없이 순수 JSON만 반환)
{
  "customs": {
    "warningTitle": "해당 국가의 가장 중요한 세관 경고",
    "warningContent": "해당 경고의 구체적 설명",
    "minorEntry": "미성년자 입국 서류",
    "minorDetail": "상세 가이드",
    "dutyFree": "일반적인 면세 한도",
    "passportNote": "여권 유효기간 등 유의사항",
    "majorAlert": { "title": "핵심 주의사항", "content": "위반 사례 등", "penalty": "처벌 내역" },
    "prohibitedItems": [ { "category": "카테고리명", "items": ["항목1", "항목2"], "note": "비고" } ],
    "arrivalProcedure": { "title": "사전 입국 절차", "timing": "언제까지", "steps": [{ "step": "단계", "description": "설명" }] }
  },
  "baggage": {
    "checkedWeight": "${airline || '항공사'} 위탁수하물 제한",
    "carryonWeight": "기내수하물 제한",
    "checkedNote": "위탁수하물 상세 규정",
    "carryonNote": "기내수하물 상세 규정",
    "additionalNotes": ["수하물 팁 1", "수하물 팁 2"]
  }
}`
            },
            {
                name: 'creative',
                prompt: `
컨텍스트: ${context}
1. 위 여행지의 대표 관광지(Landmarks) 5곳을 소개하세요. 
2. ${customGuides && customGuides.length > 0 ? `[추가 가이드 요청 사항]: ${customGuides.join(', ')} 에 대한 상세 가이드북 내용을 작성하세요.` : '추가 가이드 요청 사항이 없습니다. 오직 landmarks만 채우고 customGuides는 반드시 빈 배열 []로 반환하세요.'}
(마크다운 없이 순수 JSON만 반환)
{
  "landmarks": [
    { "name": "명소 한글 이름", "nameLocal": "영문 또는 현지어 이름", "description": "1-2줄 핵심 소개", "imageUrl": "unsplash 등 이미지 URL" }
  ],
  "customGuides": [
    ${customGuides && customGuides.length > 0 ? customGuides.map((g: string) => `{ "topic": "${g}", "icon": "📝", "sections": [{ "title": "정보 요약", "type": "text", "content": "상세 내용" }] }`).join(',') : ''}
  ]
}`
            }
        ];

        console.log(`[SecondaryResearch] Start parallel tasks for: ${destination}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28000);

        try {
            const results = await Promise.all(tasks.map(async (task) => {
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            system_instruction: { 
                                parts: [{ text: "당신은 능숙한 여행 가이드북 작성 인공지능입니다. 제공된 [요청된 여행지/도시]를 기준으로 환전, 날씨, 세관, 관광지 정보를 풍부하게 작성하세요. 모든 필드를 채워야 하며, 마크다운 기호 없이 오직 JSON 객체만 반환하세요." }] 
                            },
                            contents: [{ parts: [{ text: task.prompt }] }],
                            generationConfig: { temperature: 0.1 }
                        }),
                        signal: controller.signal
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        console.error(`[Gemini Error - ${task.name}] ${res.status}: ${errText}`);
                        return { name: task.name, error: `AI 응답 실패 (${res.status})` };
                    }

                    const data = await res.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    
                    if (jsonMatch) {
                        try {
                            return { name: task.name, data: JSON.parse(jsonMatch[0]) };
                        } catch (e) {
                            return { name: task.name, error: 'JSON 파싱 실패' };
                        }
                    }
                    return { name: task.name, error: 'JSON을 찾을 수 없음' };
                } catch (e: any) {
                    console.error(`[Task Error - ${task.name}]`, e.message);
                    return { name: task.name, error: e.name === 'AbortError' ? '시간 초과' : e.message };
                }
            }));

            clearTimeout(timeoutId);

            let finalResearch: any = {
                currency: {}, roaming: {}, weather: { summary: "", forecast: [], clothingTips: [], packingSummary: "" },
                customs: { links: [], majorAlert: {}, prohibitedItems: [], arrivalProcedure: {} },
                baggage: { additionalNotes: [] },
                landmarks: [], customGuides: []
            };

            let successCount = 0;
            results.forEach(r => {
                if (r.data) {
                    successCount++;
                    if (r.data.currency) finalResearch.currency = { ...finalResearch.currency, ...r.data.currency };
                    if (r.data.roaming) finalResearch.roaming = { ...finalResearch.roaming, ...r.data.roaming };
                    if (r.data.weather) finalResearch.weather = { ...finalResearch.weather, ...r.data.weather };
                    if (r.data.customs) finalResearch.customs = { ...finalResearch.customs, ...r.data.customs };
                    if (r.data.baggage) finalResearch.baggage = { ...finalResearch.baggage, ...r.data.baggage };
                    if (r.data.landmarks) finalResearch.landmarks = r.data.landmarks;
                    if (r.data.customGuides) finalResearch.customGuides = r.data.customGuides;
                }
            });

            if (successCount === 0) {
                const errors = results.map(r => `[${r.name}] ${r.error}`).join(', ');
                return NextResponse.json({ success: false, error: `AI 조사가 실패했습니다: ${errors}` }, { status: 504 });
            }

            const verifiedLinks = getHardcodedLinks(destination);
            if (verifiedLinks) {
                finalResearch.customs.links = verifiedLinks;
            }

            return NextResponse.json({ success: true, data: finalResearch as SecondaryResearch });
        } finally {
            clearTimeout(timeoutId);
        }

    } catch (error: any) {
        console.error('[Secondary Research API] Final Catch Error:', error.message);
        return NextResponse.json({ 
            success: false, 
            error: `서버 오류가 발생했습니다: ${error.message}` 
        }, { status: 500 });
    }
}