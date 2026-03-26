import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SecondaryResearch } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

/* ── 국가별 필수 입국/세관 절차 참조 데이터 ── */
const ENTRY_REQUIREMENTS: Record<string, { links: { label: string; url: string; type: string; description: string; howTo: string }[] }> = {
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
            { label: 'ESTA (전자여행허가)', url: 'https://esta.cbp.dhs.gov/', type: 'visa', description: '미국 입국 전 반드시 사전 신청이 필요한 전자여행허가(ESTA)입니다. 2년간 유효하며 비자 면제 프로그램(VWP) 자격 국가인 한국 국적자에게 적용됩니다.', howTo: 'esta.cbp.dhs.gov에서 여권 정보, 이메일, 미국 내 체류 주소를 입력합니다. 수수료 $21 온라인 결제 후 보통 72시간 이내 승인됩니다.' },
        ]
    },
    '일본': {
        links: [
            { label: 'Visit Japan Web (입국심사·세관)', url: 'https://www.vjw.digital.go.jp/', type: 'arrival_card', description: '일본 입국 시 입국심사와 세관 신고를 사전에 등록할 수 있는 디지털 서비스입니다. 등록하면 종이 신고서 없이 QR코드로 빠르게 수속할 수 있습니다.', howTo: 'Visit Japan Web 사이트에서 계정 생성 후 여권 정보, 항공편, 체류 호텔 정보를 등록합니다. 입국심사 및 세관신고 QR코드를 각각 발급받아 캡처합니다.' },
        ]
    },
    '대만': {
        links: [
            { label: '대만 온라인 입국신고서 (TWAC)', url: 'https://niaspeedy.immigration.gov.tw/', type: 'arrival_card', description: '대만 입국 전 온라인으로 입국신고서를 미리 작성할 수 있습니다. 작성 시 공항에서 종이 신고서를 쓸 필요 없어 수속이 빨라집니다.', howTo: '공식 사이트에 접속하여 여권 정보, 항공편, 대만 내 숙소 주소를 입력합니다. 제출 후 생성된 QR코드를 저장하여 입국 심사 시 제시합니다.' },
        ]
    },
    '베트남': {
        links: [
            { label: '베트남 e-Visa 신청', url: 'https://evisa.xuatnhapcanh.gov.vn/', type: 'visa', description: '한국 국적자는 45일 이내 무비자 입국이 가능합니다. 45일 초과 체류 시 e-Visa를 사전 신청해야 합니다.', howTo: '공식 사이트에서 여권 사진, 여권 정보, 입국 예정일을 입력하고 수수료 $25를 결제합니다. 3영업일 내 승인 결과를 이메일로 안내받습니다.' },
        ]
    },
    '태국': {
        links: [
            { label: '태국 입국 신고서 (TM6 온라인)', url: 'https://tdapp.immigration.go.th/', type: 'arrival_card', description: '태국 입국 시 전자 입국신고서(TM6 Digital)를 미리 작성하면 종이 신고서 작성 없이 빠른 수속이 가능합니다.', howTo: '태국 이민국 앱 또는 공식 웹사이트에서 여권 정보와 체류지 정보를 입력한 후 제출합니다.' },
        ]
    },
    '캐나다': {
        links: [
            { label: 'eTA (전자여행허가) 신청', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html', type: 'visa', description: '캐나다 항공 입국 시 반드시 eTA를 사전 신청해야 합니다. 육로/해로 입국 시에는 불필요합니다. 최대 5년간 유효합니다.', howTo: '공식 사이트에서 여권 정보를 입력하고 CAD $7를 결제합니다. 대부분 수 분 이내 이메일로 승인 결과를 받습니다.' },
        ]
    },
    '호주': {
        links: [
            { label: 'ETA (전자여행허가) 신청', url: 'https://www.eta.homeaffairs.gov.au/', type: 'visa', description: '호주 입국 전 반드시 ETA를 신청해야 합니다. 한국 국적자는 ETA 대상이며, 1년간 유효하고 1회 체류 최대 3개월입니다.', howTo: 'Australian ETA 앱을 다운로드하여 여권을 스캔하고, 셀카를 촬영한 후 신청합니다. 수수료 AUD $20가 부과되며, 보통 수 시간 내 승인됩니다.' },
        ]
    },
};

function getHardcodedLinks(destination: string) {
    for (const [key, val] of Object.entries(ENTRY_REQUIREMENTS)) {
        if (destination.includes(key)) {
            return val.links;
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { destination, airline, airport, customGuides, travelMonth, baggageNote } = body;

        if (!destination) {
            return NextResponse.json(
                { success: false, error: '여행지 정보가 필요합니다.' },
                { status: 400 }
            );
        }

        // 커스텀 가이드 프롬프트
        const customGuidesJson = customGuides && customGuides.length > 0
            ? customGuides.map((g: string) => JSON.stringify({
                topic: g,
                icon: "📋",
                sections: [
                    { title: "시설 정보 및 이용법", type: "steps", steps: [{ step: "단계명", detail: "상세 설명" }] },
                    { title: "추천 동선", type: "route", route: ["장소1", "장소2", "장소3"] },
                    { title: "추천 메뉴 / 필수 체험", type: "list", items: ["항목1", "항목2"] },
                    { title: "운영 정보", type: "table", headers: ["항목", "시간", "비고"], rows: [["시설명", "09:00~18:00", "비고"]] },
                    { title: "꿀팁", type: "text", content: "유용한 팁 텍스트" }
                ]
            })).join(',\n')
            : '';

        const prompt = `당신은 한국인 여행자를 위한 프리미엄 여행 가이드 전문가입니다.
아래 정보를 바탕으로 고객에게 전달할 여행 준비 가이드를 JSON 형식으로 작성하세요.

**여행지:** ${destination}
**여행 시기(월):** ${travelMonth || '현재'}
**항공사:** ${airline || '미정'}
**출발 공항:** ${airport || '미정'}
${baggageNote ? `\n**여행사 수하물 규정 원문 (최우선 참조):**\n${baggageNote}\n` : ''}

반드시 아래 JSON 형식만 반환하세요. 마크다운이나 코드 블록 없이 순수 JSON만 반환하세요.
모든 텍스트는 한국어로 작성하세요. **텍스트에 이모지를 절대 사용하지 마세요.** 깔끔하고 전문적인 문체로 작성하세요.
각 필드를 매우 상세하고 실용적으로 작성하세요.

{
  "currency": {
    "localCurrency": "현지 화폐 코드 (예: VND, JPY)",
    "currencySymbol": "화폐 기호 (예: ₫, ¥, ฿)",
    "calculationTip": "한국인이 빠르고 정확하게 암산할 수 있는 가장 대중적이고 정확한 환산 공식 1줄 (예: 베트남 동(VND)은 '0을 하나 빼고 2로 나누기=원', 대만 달러는 '곱하기 40=원' 등). 장황한 설명 없이 핵심 공식 1줄만 정확히 작성하세요.",
    "exchangeTip": "환전 추천 방법: 공항/현지/카드 사용 비교, 이중환전 여부, 추천 환전소 등",
    "tipCulture": "현지 팁 문화 상세: 상황별(레스토랑, 마사지, 택시 등) 팁 금액과 관례"
  },
  "roaming": {
    "carriers": "SKT, KT, LG U+ 각 통신사별 대표 로밍 요금제와 신청 방법 안내",
    "simEsim": "현지 유심/eSIM 추천: 구매 장소(공항, 세븐일레븐 등), 가격대, 추천 통신사(예: 대만 Chunghwa, 일본 Softbank), 데이터 플랜",
    "roamingTip": "현지 통신 관련 꿀팁 (예: 특정 지역 신호 약함, 구글지도 오프라인 저장 권장 등)"
  },
  "weather": {
    "month": "${travelMonth || '해당 월'}",
    "temperature": "평균 기온 및 강수량 정보 (예: 최저 20도/최고 28도, 건기)",
    "clothing": "현지 날씨에 맞는 추천 복장 및 필수 준비물 (예: 얇은 긴소매, 선글라스, 우산 등)"
  },
  "customs": {
    "warningTitle": "가장 중요한 반입 금지/주의 사항 제목 (예: 전자담배 절대 반입 금지)",
    "warningContent": "해당 경고에 대한 상세 설명. 벌금, 처벌 수준 등 구체적으로.",
    "minorEntry": "만 14세 미만 미성년자 부모 동반 입국 시 기본 필요 서류 (간략히)",
    "minorDetail": "만 14세 미만 미성년자 입국 시 필요한 영문 서류(가족관계증명서 등) 및 공증(부모 미동반 시 동의서 등) 가이드 상세",
    "dutyFree": "면세 한도: 담배, 주류, 현금 등 항목별로 구체적 수량/금액 기재",
    "passportNote": "여권 유의사항: 유효기간, 무비자 체류 기간, 훼손 여권 관련 등",
    "links": [
      { 
        "label": "비자(또는 전자입국허가) 신청 공식 사이트", 
        "url": "실제 해당 국가 정부 공식 URL", 
        "type": "visa",
        "description": "어떨 때 이 비자가 필요한지 상세히 (예: 한국 국적 90일 이내 관광 시 무비자이나, 특정 조건 시 필요함 등)",
        "howTo": "신청 방법 상세 (예: 공식 홈페이지 접속 후 여권 정보 및 사진 업로드, 결제 후 3일 내 승인)"
      },
      { 
        "label": "온라인 입국 신고서 및 세관 신고 (공식)", 
        "url": "실제 해당 국가 공식 URL", 
        "type": "arrival_card",
        "description": "대상자 및 필요 여부 (예: 모든 외국인 입국자 필수 작성, 종이 신고서 대신 사용 가능)",
        "howTo": "신청 단계 (예: QR 코드 접속 후 인적사항 및 건강상태 입력, 완료 후 생성된 QR 캡처)"
      },
      { 
        "label": "공식 세관 규정 및 반입 제한 안내", 
        "url": "해당 국가 관세청 공식 URL", 
        "type": "customs",
        "description": "세관 신고가 필요한 경우 (예: 면세 범위를 초과하는 주류/담배 소지 시, 일정 금액 이상의 외화 소지 시)",
        "howTo": "신고 방법 (예: 입국 심사 전 세관 구역 '신고 있음' 라인 이동 후 서류 제출)"
      }
    ],
    "majorAlert": {
      "title": "가장 핵심적인 반입 금지 및 주의사항 제목 (예: 육류 가공품 반입 절대 금지)",
      "content": "해당 주의사항에 대한 상세 설명 및 이유",
      "penalty": "위반 시 처벌 내용 (예: 최소 20만 TWD 벌금)"
    },
    "prohibitedItems": [
      {
        "category": "절대 반입 금지 (검역 대상)",
        "items": ["육류 및 가공품(육포, 소시지, 햄, 스팸, 순대 등)", "생과일/생채소", "유제품"],
        "note": "라면(고기 성분 수프 등) 포함 여부 및 구체적 유의사항"
      },
      {
        "category": "의약품 및 식품",
        "items": ["본인 복용 목적 의약품만 허용", "처방전 지침"],
        "note": "김치/반찬류 기내 반입 금지 등 식품 관련 규정"
      }
    ],
    "arrivalProcedure": {
      "title": "필수 사전 입국 절차 (예: 온라인 입국신고서 TWAC)",
      "timing": "작성 권장 시기 (예: 출발 48~72시간 전)",
      "steps": [
        { "step": "홈페이지 접속 및 언어 선택", "description": "공식 사이트 접속 및 한국어 설정 방법" },
        { "step": "정보 입력 및 제출", "description": "여권 정보, 항공편, 체류지 정보 입력 가이드" },
        { "step": "입국 심사", "description": "공항 도착 후 심사대에서 여권만 제시하면 됨 등 절차 안내" }
      ]
    }
  },
  "landmarks": [
    {
      "name": "관광지 한국어 이름",
      "nameLocal": "관광지 현지어/영어 이름",
      "description": "1~2줄 핵심 소개와 추천 이유",
      "imageUrl": "해당 관광지의 고화질 이미지 URL (unsplash 등 무료 이미지 저장소 또는 구글 검색 기반 URL)"
    }
  ],
  "baggage": {
    "checkedWeight": "${airline || '해당 항공사'} 위탁수하물 무게제한 (예: 15kg, 23kg). **수하물 규정이 위 원문에 명시되어 있다면 반드시 그 무게를 적으세요.** 개수(1개 등)는 포함하지 말고 오직 무게와 단위만 작성하세요.",
    "carryonWeight": "기내수하물 무게제한 (예: 7kg, 10kg). 개수는 포함하지 말고 오직 무게와 단위만 작성하세요.",
    "checkedNote": "위탁수하물 크기 및 개수 제한 상세 (예: 1개 무료, 세변의 합 등)",
    "carryonNote": "기내수하물 크기 제한 및 액체류 규정 상세",
    "additionalNotes": ["추가 주의사항 1 (예: 보조배터리 기내만)", "추가 주의사항 2"]
  },
  "customGuides": [${customGuidesJson ? customGuidesJson : ''}]
}

landmarks는 5~6개를 배열로 반환하세요.
customGuides의 각 항목은 topic, icon, sections 배열을 가집니다.
sections의 type은 "steps", "table", "list", "text", "route" 중 하나입니다.
${customGuides && customGuides.length > 0 ? `\n커스텀 가이드 요청 주제: ${customGuides.join(', ')}` : 'customGuides는 빈 배열 []로 반환하세요.'}

중요: 대한민국 국적자 기준 무비자 입국이 가능한 국가는 불필요한 이민국 링크를 생성하지 마세요.
customs.links 배열에는 실제 입국 전 온라인 신청이 필요한 절차(ETA, e-Visa, 전자세관신고 등)만 포함하세요.
links 순서: visa 타입 먼저, 그 다음 arrival_card, 마지막 customs 순서로 정렬하세요.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
        }

        const result = await response.json();
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // JSON 추출 및 정제
        let jsonStr = responseText.trim();
        
        // ```json ... ``` 래퍼 제거
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        
        // JSON 객체 추출
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        let research: SecondaryResearch;
        try {
            research = JSON.parse(jsonStr);
        } catch (e) {
            // 2차 시도: 제어 문자 정리
            try {
                const cleaned = jsonStr
                    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                research = JSON.parse(cleaned);
            } catch (err: any) {
                console.error("JSON parse failed:", err.message);
                console.error("Raw response (first 500 chars):", responseText.substring(0, 500));
                throw new Error('2차 조사 데이터를 불러오는 데 실패했습니다. 다시 시도해 주세요.');
            }
        }

        // 기본값 보장
        if (!research.currency) research.currency = { localCurrency: '', currencySymbol: '', calculationTip: '', exchangeTip: '', tipCulture: '' };
        if (!research.roaming) research.roaming = { carriers: '', simEsim: '' };
        if (!research.weather) research.weather = { month: travelMonth || '', temperature: '', clothing: '' };
        if (!research.customs) research.customs = { warningTitle: '', warningContent: '', minorEntry: '', minorDetail: '', dutyFree: '', passportNote: '', links: [], majorAlert: { title: '', content: '' }, prohibitedItems: [], arrivalProcedure: { title: '', steps: [] } };
        else {
            research.customs.minorDetail = research.customs.minorDetail || '';
            research.customs.links = research.customs.links || [];
            research.customs.majorAlert = research.customs.majorAlert || { title: '', content: '' };
            research.customs.prohibitedItems = research.customs.prohibitedItems || [];
            research.customs.arrivalProcedure = research.customs.arrivalProcedure || { title: '', steps: [] };
        }

        // ★ 핵심: 하드코딩된 검증 완료 링크로 교체 (정확도 보장)
        const verifiedLinks = getHardcodedLinks(destination);
        if (verifiedLinks) {
            research.customs.links = verifiedLinks as any;
        }
        
        if (!research.baggage || typeof research.baggage === 'string') {
            research.baggage = {
                checkedWeight: typeof research.baggage === 'string' ? research.baggage : '확인 필요',
                carryonWeight: '확인 필요',
                checkedNote: '', carryonNote: '', additionalNotes: []
            };
        } else {
            research.baggage.checkedWeight = research.baggage.checkedWeight || '확인 필요';
            research.baggage.carryonWeight = research.baggage.carryonWeight || '확인 필요';
            research.baggage.checkedNote = research.baggage.checkedNote || '';
            research.baggage.carryonNote = research.baggage.carryonNote || '';
            research.baggage.additionalNotes = research.baggage.additionalNotes || [];
        }
        if (!research.currency.currencySymbol) research.currency.currencySymbol = '';

        // links_instruction 같은 불필요한 필드 제거
        delete (research as any).links_instruction;
        delete (research as any).instructions;

        return NextResponse.json({ success: true, data: research });
    } catch (error: any) {
        console.error('[Secondary Research API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}


