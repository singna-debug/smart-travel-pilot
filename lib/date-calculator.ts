import { addDays, subDays, format, parse, isValid } from 'date-fns';

/**
 * 출발일 기준으로 자동화 날짜들을 계산합니다.
 */
export function calculateAutomationDates(departureDateStr: string) {
    // 다양한 날짜 형식 파싱 시도
    let departureDate: Date | null = null;
    let formattedDateStr = departureDateStr;

    const formats = [
        'yyyy-MM-dd',
        'yyyy/MM/dd',
        'yyyy.MM.dd',
        'MM/dd/yyyy',
        'MM-dd-yyyy',
    ];

    for (const fmt of formats) {
        try {
            const parsed = parse(departureDateStr, fmt, new Date());
            if (isValid(parsed)) {
                departureDate = parsed;
                formattedDateStr = format(parsed, 'yyyy-MM-dd');
                break;
            }
        } catch {
            continue;
        }
    }

    // ISO 형식 시도
    if (!departureDate) {
        const isoDate = new Date(departureDateStr);
        if (isValid(isoDate)) {
            departureDate = isoDate;
            formattedDateStr = format(isoDate, 'yyyy-MM-dd');
        }
    }

    if (!departureDate) {
        return {
            balance_due_date: '날짜 파싱 불가',
            notice_date: '날짜 파싱 불가',
            next_followup: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
        };
    }

    return {
        // 잔금 입금 기한: 출발일 - 30일
        balance_due_date: format(subDays(departureDate, 30), 'yyyy-MM-dd'),
        // 여행 전 주의사항 발송일: 출발일 - 3일
        notice_date: format(subDays(departureDate, 3), 'yyyy-MM-dd'),
        // 팔로업: 오늘 + 2일
        next_followup: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    };
}

/**
 * 출발일과 기간(예: 3박5일) 정보를 바탕으로 귀국일을 계산합니다.
 */
export function calculateReturnDate(departureDateStr: string, durationStr: string): string {
    if (!departureDateStr || !durationStr) return '';

    // 출발일 파싱
    let departureDate: Date | null = null;
    const formats = ['yyyy-MM-dd', 'yyyy/MM/dd', 'yyyy.MM.dd'];
    for (const fmt of formats) {
        try {
            const parsed = parse(departureDateStr, fmt, new Date());
            if (isValid(parsed)) {
                departureDate = parsed;
                break;
            }
        } catch { continue; }
    }
    if (!departureDate) return '';

    // 기간에서 '일' 추출 (예: 3박5일 -> 5)
    // "5일", "3박 5일" 등
    const daysMatch = durationStr.match(/(\d+)일/);
    if (!daysMatch) return '';

    const days = parseInt(daysMatch[1], 10);
    // 여행 기간이 5일이면, 출발일 포함해서 5일째 되는 날이 귀국일?
    // 보통 3박 5일이면 출발일(1일차) + 4일 = 5일차(귀국)
    // 날짜 계산: addDays(start, days - 1)

    // 여행사 용어에서 'N일'은 꽉 채운 일정이므로, 도착일은 start + (N-1)일인 경우가 많음.
    // 하지만 3박5일의 경우 '5일'째 되는 날 도착함.
    // 예: 1일 출발 -> 5일 도착. (1(1), 2(2), 3(3), 4(4), 5(5)) -> 차이 4일.
    // 따라서 addDays(start, days - 1)이 맞음.

    if (days > 0) {
        return format(addDays(departureDate, days - 1), 'yyyy-MM-dd');
    }

    return '';
}

/**
 * 자연어에서 날짜를 추출합니다.
 */
export function extractDateFromText(text: string): string | null {
    // YYYY-MM-DD 형식
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return isoMatch[0];
    }

    // YYYY년 MM월 DD일 형식
    const koreanFullMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanFullMatch) {
        const [, year, month, day] = koreanFullMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // MM월 DD일 형식 (현재 년도 가정)
    const koreanMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanMatch) {
        const [, month, day] = koreanMatch;
        const year = new Date().getFullYear();
        // 이미 지난 달이면 내년으로
        const targetDate = new Date(year, parseInt(month) - 1, parseInt(day));
        if (targetDate < new Date()) {
            return `${year + 1}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
}

export function getTodayString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}
