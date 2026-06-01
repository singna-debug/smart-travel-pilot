import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    console.log("Starting test...");
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        console.error("No API key");
        return;
    }
    
    const context = `[요청된 여행지/국가/도시]: 청도 (★★★오직 이 장소를 기준으로 날씨/환전/관광지 정보 작성, 다른 나라로 착각 절대 금지)
[상품명/설명 대상]: 일반 패키지 여행 (상품명이 없어도 이 도시의 일반적인 정보를 꼭 작성할 것)
[여행 시기]: 일반 시즌
[이용 항공사]: 빙명시
[수하물 규정 참고]: 일반 규정`;

    const prompt = `컨텍스트: ${context}\n위 여행지에 대한 현지 정보를 아래 JSON 형식으로 반환하세요. (마크다운 없이 순수 JSON만 반환)\n{ "currency": { "calculationTip": "환산 팁 1줄", "exchangeTip": "환전 요령", "tipCulture": "팁 문화 유무" } }`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            system_instruction: { 
                parts: [{ text: "당신은 능숙한 여행 가이드북 작성 인공지능입니다. 제공된 [요청된 여행지/도시]를 기준으로 환전, 날씨, 세관, 관광지 정보를 풍부하게 작성하세요. [상품명/설명]이 없거나 '비명시'로 되어 있더라도, 거절하지 말고 해당 도시(여행지)의 일반적인 여행 정보를 기준으로 반드시 모든 필드를 채워야 합니다. 다른 국가(예: 청도인데 베트남으로 착각)로 착각하는 할루시네이션만 주의하세요." }] 
            },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 }
        })
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
