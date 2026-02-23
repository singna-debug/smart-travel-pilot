import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SecondaryResearch } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const apiKey = (process.env.GEMINI_API_KEY || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { destination, airline, airport, customGuides } = body;

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
**항공사:** ${airline || '미정'}
**출발 공항:** ${airport || '미정'}

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
    "carriers": "SKT, KT, LG U+ 각 통신사별 로밍 요금/방법 안내",
    "simEsim": "현지 유심/eSIM 추천: 구매 장소, 가격대, 추천 통신사, 데이터 플랜"
  },
  "customs": {
    "warningTitle": "가장 중요한 반입 금지/주의 사항 제목 (예: 전자담배 절대 반입 금지)",
    "warningContent": "해당 경고에 대한 상세 설명. 벌금, 처벌 수준 등 구체적으로.",
    "minorEntry": "만 14세 미만 미성년자 입국 시 필요 서류를 상세히. 부모 동반/미동반 각각 설명.",
    "dutyFree": "면세 한도: 담배, 주류, 현금 등 항목별로 구체적 수량/금액 기재",
    "passportNote": "여권 유의사항: 유효기간, 무비자 체류 기간, 훼손 여권 관련 등"
  },
  "landmarks": [
    {
      "name": "관광지 한국어 이름",
      "nameLocal": "관광지 현지어/영어 이름",
      "description": "1~2줄 핵심 소개와 추천 이유"
    }
  ],
  "baggage": {
    "checkedWeight": "${airline || '해당 항공사'} 위탁수하물 무게제한 (예: 15kg, 23kg). 개수(1개 등)는 포함하지 말고 오직 무게와 단위만 작성하세요.",
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
- steps: steps 배열 [{step: "단계명", detail: "설명"}]
- table: headers와 rows 배열
- list: items 배열
- text: content 문자열
- route: route 배열 (순서대로 방문할 장소)
각 커스텀 가이드는 해당 주제에 맞게 3~6개의 sections를 구성하세요.
시설 정보, 이용법, 추천 동선, 추천 메뉴, 운영시간 등을 체계적으로 구성하세요.
${customGuides && customGuides.length > 0 ? `\n커스텀 가이드 요청 주제: ${customGuides.join(', ')}` : 'customGuides는 빈 배열 []로 반환하세요.'}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // JSON 추출
        let jsonStr = responseText
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        let research: SecondaryResearch;
        try {
            research = JSON.parse(jsonStr);
        } catch {
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) {
                research = JSON.parse(match[0]);
            } else {
                throw new Error('AI 응답을 JSON으로 파싱할 수 없습니다.');
            }
        }

        // 기본값 보장
        if (!research.currency) research.currency = { localCurrency: '', currencySymbol: '', calculationTip: '', exchangeTip: '', tipCulture: '' };
        if (!research.roaming) research.roaming = { carriers: '', simEsim: '' };
        if (!research.customs) research.customs = { warningTitle: '', warningContent: '', minorEntry: '', dutyFree: '', passportNote: '' };
        if (!research.baggage || typeof research.baggage === 'string') {
            research.baggage = {
                checkedWeight: typeof research.baggage === 'string' ? research.baggage : '확인 필요',
                carryonWeight: '확인 필요',
                checkedNote: '', carryonNote: '', additionalNotes: []
            };
        } else {
            // 필드별 누락 방지
            research.baggage.checkedWeight = research.baggage.checkedWeight || '확인 필요';
            research.baggage.carryonWeight = research.baggage.carryonWeight || '확인 필요';
            research.baggage.checkedNote = research.baggage.checkedNote || '';
            research.baggage.carryonNote = research.baggage.carryonNote || '';
            research.baggage.additionalNotes = research.baggage.additionalNotes || [];
        }
        if (!research.currency.currencySymbol) research.currency.currencySymbol = '';

        return NextResponse.json({ success: true, data: research });
    } catch (error: any) {
        console.error('[Secondary Research API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
