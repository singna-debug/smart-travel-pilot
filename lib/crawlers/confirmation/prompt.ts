/**
 * ★ 확정서 전용 프롬프트 (v3.5 - 할루시네이션 완벽 차단) ★
 */
export const CONFIRMATION_PROMPT = `여행 상품 분석. JSON만 반환. 설명/마크다운/이모지 금지.

규칙 (할루시네이션 절대 금지):
1. Native API Data의 기본정보(상품명/가격/일정구조)가 100% 정답이다.
2. ★★★ 가장 중요 (창작 금지): timeline의 \`title\`과 \`description\`은 절대 스스로 요약하거나 창작하지 마라! 제공된 데이터(특히 Native 일정 데이터)에 적힌 문장을 토시 하나 틀리지 않고 100% 원본 그대로 복사(Copy & Paste)해야 한다.
3. 본문의 간략일정에 나오는 모든 관광지/이동/식사/체험을 빠짐없이 timeline에 넣어라. 1일차뿐만 아니라 마지막 날짜(2일차, 3일차 등)까지 **모든 일차의 전일정**을 반드시 작성하라.
4. 불포함사항(exclusions), 미팅정보(meetingInfo), 포함사항(inclusions)도 있는 그대로 추출.
5. meals의 식사 정보: "O", "X" 기호 절대 금지. 본문에 있는 "호텔식", "불포함", "현지식(와규스키야끼)" 등 구체적인 단어를 찾아 그래로 적어라.
6. JSON 외 텍스트 출력 절대 금지.

JSON:
{"title":"상품명","destination":"국가 도시","price":"숫자만","departureDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD","duration":"N박 M일","airline":"항공사","departureFlightNumber":"편명","returnFlightNumber":"편명","departureAirport":"공항","departureTime":"HH:mm","arrivalTime":"HH:mm","returnDepartureTime":"HH:mm","returnArrivalTime":"HH:mm","hotels":[{"name":"호텔명","address":"주소"}],"meetingInfo":[{"type":"미팅장소|수속카운터","location":"장소","time":"HH:mm","description":"설명"}],"itinerary":[{"day":"1일차","date":"날짜","title":"일정제목","transport":{"flightNo":"편명","airline":"항공사","departureCity":"출발","departureTime":"HH:mm","arrivalCity":"도착","arrivalTime":"HH:mm"},"timeline":[{"type":"location|default","title":"창작 금지! 원본 그대로 복사","description":"창작 금지! 원본 그대로 복사"}],"hotel":"호텔","meals":{"breakfast":"호텔식/불포함 등","lunch":"메뉴명/불포함 등","dinner":"메뉴명/불포함 등"}}],"inclusions":["포함사항"],"exclusions":["불포함사항"],"keyPoints":["핵심3~5개"],"cancellationPolicy":"취소규정","notices":["유의사항"]}`;
