import { NextRequest, NextResponse } from 'next/server';
import { appendConsultationToSheet } from '@/lib/google-sheets';
import type { ConsultationData } from '@/types';
import { calculateAutomationDates, getTodayString } from '@/lib/date-calculator';
import { crawlTravelProduct } from '@/lib/url-crawler';

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
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        return dateStr.trim();
    }
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
    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일?/);
    if (boxDayMatch) {
        return `${boxDayMatch[1]}박${boxDayMatch[2]}일`;
    }
    const onlyDayMatch = str.match(/^(\d+)\s*일$/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박${days}일`;
    }
    const onlyBoxMatch = str.match(/^(\d+)\s*박$/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박${nights + 1}일`;
    }
    return str.replace(/\s+/g, '');
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
            isComparison,
            confirmedProduct,
            confirmedDate,
            recurringCustomer: formRecurringCustomer, // Renamed to avoid conflict with `automation.recurringCustomer`
            inquirySource: formInquirySource, // Renamed to avoid conflict with `automation.inquirySource`
            source: formSource,
            travelersCount // Added travelersCount here
        } = body;

        if (!customerName) {
            return NextResponse.json(
                { success: false, error: '고객 이름은 필수입니다. 이름이 있어야 저장됩니다.' },
                { status: 400 }
            );
        }

        // 1. 데이터 구성
        let name = customerName;
        let formattedPhone = formatPhone(String(customerPhone || ''));
        let phone = formattedPhone ? `'${formattedPhone}` : '';
        let productName = formInterestedProduct || '';
        let url = body.productUrl || '';
        let destination = formDestination || '';
        let departureDate = formDepartureDate || '';
        let duration = formDuration || '';
        let returnDate = formReturnDate || '';
        let status = formStatus || '상담중';
        const summaryText = memo || '';

        // AI 데이터에서 추출
        if (isComparison && analysisData?.products && analysisData.products.length > 0) {
            if (!productName || productName.includes('외')) {
                productName = analysisData.products.map((p: any) => p.raw.title).join(', ');
            }
            url = analysisData.products.map((p: any) => p.url).join(', ');
            if (!destination) destination = analysisData.products[0].raw.destination || '';
            if (!departureDate) departureDate = analysisData.products[0].raw.departureDate || '';
            if (!duration) duration = analysisData.products[0].raw.duration || '';
        } else if (!isComparison && analysisData?.raw) {
            if (!productName) productName = analysisData.raw.title;
            url = analysisData.raw.url;
            if (!destination) destination = analysisData.raw.destination || '';
            if (!departureDate) departureDate = analysisData.raw.departureDate || '';
            if (!duration) duration = analysisData.raw.duration || '';
        }

        // 2. 포맷팅
        departureDate = formatDateString(departureDate);
        returnDate = formatDateString(returnDate);
        duration = formatDurationString(duration);

        // 3. 확정상품 URL 분석 (Strict: URL이 있으면 크롤러 결과가 최우선)
        let finalConfirmedProduct = confirmedProduct || '';
        if (finalConfirmedProduct && finalConfirmedProduct.startsWith('http')) {
            try {
                const crawled = await crawlTravelProduct(finalConfirmedProduct);
                if (crawled) {
                    // 크롤링된 정보가 있으면 기존 폼 데이터보다 우선함
                    if (crawled.departureDate) {
                        departureDate = formatDateString(crawled.departureDate);
                    }
                    if (crawled.returnDate) {
                        returnDate = formatDateString(crawled.returnDate);
                    }
                    if (crawled.duration) {
                        duration = formatDurationString(crawled.duration);
                    }
                    
                    // 귀국일이 없는데 기간이 있다면 계산
                    if (departureDate && !returnDate && duration) {
                        const daysMatch = duration.match(/(\d+)일/);
                        if (daysMatch) {
                            const daysToAdd = parseInt(daysMatch[1], 10) - 1;
                            const d = new Date(departureDate);
                            if (!isNaN(d.getTime())) {
                                d.setDate(d.getDate() + daysToAdd);
                                returnDate = d.toISOString().split('T')[0];
                            }
                        }
                    }
                }
            } catch (crawlErr) {
                console.warn('[Crawl Error] 확정상품 URL 분석 실패:', crawlErr);
            }
        }

        // 4. 귀국일 자동 계산
        if (departureDate && !returnDate && duration) {
            const daysMatch = duration.match(/(\d+)일/);
            if (daysMatch) {
                const daysToAdd = parseInt(daysMatch[1], 10) - 1;
                const d = new Date(departureDate);
                if (!isNaN(d.getTime()) && daysToAdd >= 0) {
                    d.setDate(d.getDate() + daysToAdd);
                    returnDate = d.toISOString().split('T')[0];
                }
            }
        }

        // 5. 예약확정일 처리
        let finalConfirmedDate = confirmedDate || '';
        if (status === '예약확정' && !finalConfirmedDate) {
            finalConfirmedDate = getTodayString();
        }

        // 6. 모든 자동화 날짜 계산
        const automationDates = calculateAutomationDates({
            departureDateStr: departureDate,
            returnDateStr: returnDate,
            confirmedDateStr: finalConfirmedDate
        });

        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60000 + new Date().getTimezoneOffset() * 60000);

        const consultationData: ConsultationData = {
            customer: { name, phone },
            trip: {
                destination,
                departure_date: departureDate,
                return_date: returnDate,
                duration,
                product_name: productName,
                url,
                travelers_count: travelersCount || '', // New field: 총인원
            },
            summary: summaryText.substring(0, 50000),
            source: formSource || '수동등록',
            automation: {
                status: status,
                next_followup: automationDates.next_followup,
                recurringCustomer: formRecurringCustomer || '신규고객',
                inquirySource: formInquirySource || '',
                confirmed_product: finalConfirmedProduct,
                confirmed_date: finalConfirmedDate,
                prepaid_date: automationDates.prepaid_date,
                notice_date: automationDates.notice_date,
                balance_date: automationDates.balance_date,
                confirmation_sent: automationDates.confirmation_sent,
                departure_notice: automationDates.departure_notice,
                phone_notice: automationDates.phone_notice,
                happy_call: automationDates.happy_call,
                inquiry_info_backup: JSON.stringify({
                    destination,
                    departureDate,
                    returnDate,
                    duration,
                    productName,
                    productUrl: url,
                }),
            },
            timestamp: kstNow.toISOString(),
            visitor_id: body.visitorId || `admin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        };

        const success = await appendConsultationToSheet(consultationData);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { success: false, error: '구글 시트 저장에 실패했습니다.' },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Save Consultation API Error:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류: ' + error.message },
            { status: 500 }
        );
    }
}
