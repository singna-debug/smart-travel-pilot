import { NextRequest, NextResponse } from 'next/server';
import { appendConsultationToSheet } from '@/lib/google-sheets';
import type { ConsultationData, AnalysisResult, SingleResult } from '@/types';

// 연락처 포맷팅 (010-XXXX-XXXX)
function formatPhone(phoneStr: string): string {
    if (!phoneStr) return '';
    const numericStr = phoneStr.replace(/[^0-9]/g, '');
    if (numericStr.length === 11 && numericStr.startsWith('010')) {
        return `${numericStr.slice(0, 3)}-${numericStr.slice(3, 7)}-${numericStr.slice(7)}`;
    } else if (numericStr.length === 10 && numericStr.startsWith('010')) {
        return `${numericStr.slice(0, 3)}-${numericStr.slice(3, 6)}-${numericStr.slice(6)}`;
    }
    return numericStr;
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDateString(dateStr: string): string {
    if (!dateStr) return '';
    // 이미 YYYY-MM-DD 형태인지 대략 확인
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        return dateStr.trim();
    }
    // 예: "2026.02.25", "26. 2. 25", "2026/02/25", "2026-02-25 (수)"
    const match = dateStr.match(/(\d{2,4})[-\.\/년]\s*(\d{1,2})[-\.\/월]\s*(\d{1,2})/);
    if (match) {
        let year = match[1];
        if (year.length === 2) year = `20${year}`;
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

// 기간 포맷팅 (X박Y일)
function formatDurationString(durationStr: string): string {
    if (!durationStr) return '';
    let str = durationStr.trim();
    // "3박 4일" -> "3박4일"
    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일?/);
    if (boxDayMatch) {
        return `${boxDayMatch[1]}박${boxDayMatch[2]}일`;
    }
    // "5일" -> "4박5일"
    const onlyDayMatch = str.match(/^(\d+)\s*일$/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박${days}일`;
    }
    // "4박" -> "4박5일"
    const onlyBoxMatch = str.match(/^(\d+)\s*박$/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박${nights + 1}일`;
    }
    return str.replace(/\s+/g, ''); // 그 외 경우 띄어쓰기 정도만 제거
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            customerName,
            customerPhone,
            destination: formDestination,
            departureDate: formDepartureDate,
            duration: formDuration,
            returnDate: formReturnDate,
            status: formStatus,
            interestedProduct: formInterestedProduct,
            memo,
            analysisData,
            isComparison
        } = body;

        if (!customerName) {
            return NextResponse.json(
                { success: false, error: '고객 이름은 필수입니다. 이름이 있어야 저장됩니다.' },
                { status: 400 }
            );
        }

        // 데이터 구성 (폼 입력값 우선, 없으면 분석 데이터에서 추출)
        let name = customerName;
        // 구글 시트에서 010이 10으로 저장되는 것을 방지하기 위해 강제로 문자열 처리 (') 및 010-XXXX-XXXX 포맷 적용
        let formattedPhone = formatPhone(String(customerPhone || ''));
        let phone = formattedPhone ? `'${formattedPhone}` : '';
        let productName = formInterestedProduct || '';
        let url = body.productUrl || ''; // 수동 입력 URL 우선
        let destination = formDestination || '';
        let departureDate = formDepartureDate || '';
        let duration = formDuration || '';
        let returnDate = formReturnDate || '';
        // 상담요약 구성: 사용자가 직접 입력한 메모(상담 내용 요약)만 저장합니다.
        const summaryText = memo || '';

        if (isComparison && analysisData.products && analysisData.products.length > 0) {
            if (!productName) productName = `[비교분석] ${analysisData.products[0].raw.title} 외 ${analysisData.products.length - 1}건`;

            // 여러 URL을 "1. url \n 2. url" 형식으로 구성하여 구글 시트에서 클릭 가능하게 함
            url = analysisData.products
                .map((p: any, idx: number) => `${idx + 1}. ${p.url}`)
                .join('\n');

            if (!destination) destination = analysisData.products[0].raw.destination || '';
            if (!departureDate) departureDate = analysisData.products[0].raw.departureDate || '';
            if (!duration) duration = analysisData.products[0].raw.duration || '';
        } else if (!isComparison && analysisData.raw) {
            if (!productName) productName = analysisData.raw.title;
            url = analysisData.raw.url;
            if (!destination) destination = analysisData.raw.destination || '';
            if (!departureDate) departureDate = analysisData.raw.departureDate || '';
            if (!duration) duration = analysisData.raw.duration || '';
        }

        // 포맷팅 적용
        departureDate = formatDateString(departureDate);
        returnDate = formatDateString(returnDate);
        duration = formatDurationString(duration);

        // 귀국일이 비어있고 출발일과 기간(X박Y일) 정보가 있으면 자동 계산
        if (departureDate && !returnDate && duration) {
            const durationMatch = duration.match(/\d+박\s*(\d+)일/);
            if (durationMatch) {
                const daysToAdd = parseInt(durationMatch[1], 10) - 1;
                if (daysToAdd >= 0) {
                    const d = new Date(departureDate);
                    if (!isNaN(d.getTime())) {
                        d.setDate(d.getDate() + daysToAdd);
                        const rYear = d.getFullYear();
                        const rMonth = String(d.getMonth() + 1).padStart(2, '0');
                        const rDay = String(d.getDate()).padStart(2, '0');
                        returnDate = `${rYear}-${rMonth}-${rDay}`;
                    }
                }
            }
        }

        // 팔로업일 자동 계산 (상담일로부터 2일 뒤, 한국시간 기준)
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60000 + new Date().getTimezoneOffset() * 60000);
        const followUpDate = new Date(kstNow);
        followUpDate.setDate(kstNow.getDate() + 2);
        const nextFollowUp = `${followUpDate.getFullYear()}-${String(followUpDate.getMonth() + 1).padStart(2, '0')}-${String(followUpDate.getDate()).padStart(2, '0')}`;

        const consultationData: ConsultationData = {
            customer: {
                name: name,
                phone: phone,
            },
            trip: {
                destination: destination,
                departure_date: departureDate,
                return_date: returnDate,
                duration: duration,
                product_name: productName,
                url: url,
            },
            summary: summaryText.substring(0, 50000),
            source: '수동등록',
            automation: {
                status: (formStatus as any) || '상담중',
                next_followup: nextFollowUp,
                balance_due_date: '',
                notice_date: '',
            },
            timestamp: kstNow.toISOString(),
            visitor_id: 'admin-analyzer',
        };

        const success = await appendConsultationToSheet(consultationData);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { success: false, error: '구글 시트 저장에 실패했습니다. 관리자에게 문의하세요.' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Save Consultation API Error:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
