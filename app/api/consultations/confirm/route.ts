import { NextRequest, NextResponse } from 'next/server';
import { updateConsultationConfirmation } from '@/lib/google-sheets';

/**
 * POST /api/consultations/confirm
 * 예약확정 시 확정상품 URL을 분석하고, 날짜를 자동 계산하여 시트를 업데이트합니다.
 * 
 * Body: { rowIndex, sheetName, confirmedProductUrl }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rowIndex, sheetName, confirmedProductUrl } = body;

        if (!rowIndex || !confirmedProductUrl) {
            return NextResponse.json(
                { success: false, error: 'rowIndex와 confirmedProductUrl이 필요합니다.' },
                { status: 400 }
            );
        }

        // 1. URL 분석하여 출발일, 귀국일, 목적지 추출
        console.log(`[Confirm] Analyzing URL: ${confirmedProductUrl}`);
        
        let departureDate = '';
        let returnDate = '';
        let destination = '';

        try {
            // 내부 crawl-analyze 요청
            const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
            const analyzeResponse = await fetch(`${baseUrl}/api/crawl-analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: confirmedProductUrl, mode: 'booking' }),
            });

            const analyzeData = await analyzeResponse.json();
            
            if (analyzeData.success && analyzeData.data?.raw) {
                const raw = analyzeData.data.raw;
                departureDate = raw.departureDate || '';
                returnDate = raw.returnDate || '';
                destination = raw.destination || '';
                console.log(`[Confirm] Extracted: departure=${departureDate}, return=${returnDate}, dest=${destination}`);
            } else {
                console.warn('[Confirm] URL analysis failed, proceeding without date extraction:', analyzeData.error);
            }
        } catch (analyzeError: any) {
            console.error('[Confirm] URL analysis error:', analyzeError.message);
            // URL 분석 실패해도 확정 처리는 계속 진행
        }

        // 2. 날짜 자동 계산
        const today = new Date();
        const confirmedDate = formatDate(today);

        // 선금일: 확정일 + 2일
        const prepaidDate = formatDate(addDays(today, 2));

        let noticeDate = '';      // 출발전안내(4주): 출발일 - 28일
        let balanceDate = '';      // 잔금일: 출발일 - 21일  
        let confirmationSent = ''; // 확정서 발송: 출발일 - 14일
        let departureNotice = '';  // 출발안내: 출발일 - 3일
        let phoneNotice = '';      // 전화 안내: 출발일 - 1일
        let happyCall = '';        // 해피콜: 귀국일 + 1일

        if (departureDate) {
            const depDate = parseDate(departureDate);
            if (depDate) {
                noticeDate = formatDate(addDays(depDate, -28));
                balanceDate = formatDate(addDays(depDate, -21));
                confirmationSent = formatDate(addDays(depDate, -14));
                departureNotice = formatDate(addDays(depDate, -3));
                phoneNotice = formatDate(addDays(depDate, -1));
            }
        }

        if (returnDate) {
            const retDate = parseDate(returnDate);
            if (retDate) {
                happyCall = formatDate(addDays(retDate, 1));
            }
        }

        console.log('[Confirm] Calculated dates:', {
            confirmedDate,
            prepaidDate,
            noticeDate,
            balanceDate,
            confirmationSent,
            departureNotice,
            phoneNotice,
            happyCall,
        });

        // 3. Google Sheets 일괄 업데이트
        const success = await updateConsultationConfirmation(
            rowIndex,
            {
                confirmedProductUrl,
                confirmedDate,
                departureDate,
                returnDate,
                destination,
                prepaidDate,
                noticeDate,
                balanceDate,
                confirmationSent,
                departureNotice,
                phoneNotice,
                happyCall,
            },
            sheetName
        );

        if (success) {
            return NextResponse.json({
                success: true,
                message: '예약확정 처리가 완료되었습니다.',
                data: {
                    status: '예약확정',
                    confirmedProductUrl,
                    confirmedDate,
                    departureDate,
                    returnDate,
                    destination,
                    prepaidDate,
                    noticeDate,
                    balanceDate,
                    confirmationSent,
                    departureNotice,
                    phoneNotice,
                    happyCall,
                },
            });
        } else {
            return NextResponse.json(
                { success: false, error: 'Google Sheets 업데이트에 실패했습니다.' },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[Confirm] Error:', error.message);
        return NextResponse.json(
            { success: false, error: '예약확정 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// ── Helper Functions ──

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // "2026-05-27" 형식
    const isoMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
    
    // "20260527" 형식
    const compactMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return new Date(parseInt(compactMatch[1]), parseInt(compactMatch[2]) - 1, parseInt(compactMatch[3]));
    }

    // 일반 Date 파싱 시도
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}
