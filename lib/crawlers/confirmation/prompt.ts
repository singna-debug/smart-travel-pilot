/**
 * ★ 확정서 전용 프롬프트 (v3.6 - 소요시간 추가 + 상세일정 간소화) ★
 */
export const CONFIRMATION_PROMPT = `여행 상품 분석. JSON만 반환. 설명/마크다운/이모지 금지.

규칙 (할루시네이션 절대 금지):
1. Native API Data의 기본정보(상품명/가격/일정구조)가 100% 정답이다.
2. ★가장 중요 (일정 간소화): timeline의 \`description\`에 도시 소개, 역사, 기후 등 가이드북 성격의 긴 설명은 절대 넣지 마라! 오직 실제 이동 및 관광활동 내용만 짧게 복사해라.
3. ★창작 금지: timeline의 \`title\`과 \`description\`은 절대 스스로 요약하거나 창작하지 마라! 제공된 데이터 문장을 그대로 사용하되, 불필요한 서술만 제외해라.
4. 본문의 간략일정에 나오는 모든 관광지/이동/식사/체험을 빠짐없이 timeline에 넣어라. 마지막 날짜까지 모든 일차를 반드시 작성하라.
5. meals의 식사 정보: "O", "X" 기호 절대 금지. "호텔식", "불포함", "현지식" 등 구체적인 단어를 찾아 적어라.
6. ★항공 소요시간 필수★: departureFlightNumber, returnFlightNumber 외에 **duration** (예: "02:05 소요", "1시간 20분") 필드를 반드시 채워라. <항공 일정 내역>에서 "소요" 라는 단어 옆의 시간을 찾아라.
7. HH:mm 형식의 출발/도착 시간(departureTime 등)을 누락 없이 채워라.
8. JSON 외 텍스트 출력 절대 금지.

JSON Schema:
{
  "title": "상품명",
  "destination": "국가 도시",
  "price": "숫자만",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "duration": "N박 M일",
  "airline": "항공사",
  "departureFlightNumber": "편명",
  "returnFlightNumber": "편명",
  "departureAirport": "공항",
  "departureTime": "HH:mm",
  "arrivalTime": "HH:mm",
  "flightDuration": "가는편 소요시간",
  "returnDepartureTime": "HH:mm",
  "returnArrivalTime": "HH:mm",
  "returnFlightDuration": "오는편 소요시간",
  "hotels": [{"name": "호텔명", "address": "주소"}],
  "meetingInfo": [{"type": "미팅장소|수속카운터", "location": "장소", "time": "HH:mm", "description": "설명"}],
  "itinerary": [
    {
      "day": "1일차",
      "date": "날짜",
      "title": "일정제목",
      "transport": {
        "flightNo": "편명",
        "airline": "항공사",
        "departureCity": "출발",
        "departureTime": "HH:mm",
        "arrivalCity": "도착",
        "arrivalTime": "HH:mm",
        "duration": "소요시간"
      },
      "timeline": [{"type": "location|default", "title": "장소명", "description": "활동내용 (긴 설명 제외)"}],
      "hotel": "호텔",
      "meals": {"breakfast": "호텔식/불포함 등", "lunch": "메뉴명/불포함 등", "dinner": "메뉴명/불포함 등"}
    }
  ],
  "inclusions": ["포함사항"],
  "exclusions": ["불포함사항"],
  "keyPoints": ["핵심특징"],
  "cancellationPolicy": "취소규정"
}`;
