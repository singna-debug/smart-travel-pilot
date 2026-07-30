import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { getTenantIdFromHeaderOrQuery } from '@/lib/tenant';

// 상담 목록 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '50');
        const tenantId = getTenantIdFromHeaderOrQuery(request);
        const refresh = searchParams.get('refresh') === 'true';

        // 테넌트 구글 시트에서 최신 데이터 즉시 조회 (새로고침 보장)
        const allData = await getAllConsultations(true, tenantId);
        console.log(`[Chats API Debug] tenantId: ${tenantId}, fetched ${allData.length} items from sheets`);

        // 데이터 병합 및 중복 처리
        const consultationsByDay = new Map<string, any>();
        const normalizePhone = (p: string) => (p || '').replace(/[^0-9]/g, '');
        const getDay = (ts: string) => {
            if (!ts) return '';
            const match = ts.match(/\d{4}-\d{2}-\d{2}/);
            return match ? match[0] : ts.slice(0, 10);
        };

        allData.forEach((item, index) => {
            const phone = normalizePhone(item.customer.phone);
            const name = (item.customer.name || '').trim();
            
            // 헤더 행 제외
            if (name === '고객성함' || phone === '연락처') return;
            if (!name && !phone) return;

            const day = getDay(item.timestamp);
            const key = item.visitor_id || (phone ? `${phone}-${day}-${index}` : `${name}-${day}-${index}`);

            if (consultationsByDay.has(key)) {
                const existing = consultationsByDay.get(key);
                const existingTime = new Date(existing.timestamp || 0).getTime();
                const itemTime = new Date(item.timestamp || 0).getTime();

                if (itemTime > existingTime) {
                    const prevInquiries = existing.previousInquiries || [];
                    prevInquiries.push({
                        timestamp: existing.timestamp,
                        destination: existing.trip.destination,
                        productName: existing.trip.product_name,
                        summary: existing.summary
                    });
                    consultationsByDay.set(key, { ...item, previousInquiries: prevInquiries });
                } else {
                    const prevInquiries = existing.previousInquiries || [];
                    prevInquiries.push({
                        timestamp: item.timestamp,
                        destination: item.trip.destination,
                        productName: item.trip.product_name,
                        summary: item.summary
                    });
                    existing.previousInquiries = prevInquiries;
                }
            } else {
                consultationsByDay.set(key, { ...item, previousInquiries: [] });
            }
        });

        // 맵 -> 배열 변환 및 정렬
        let mergedList = Array.from(consultationsByDay.values());
        mergedList.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
        });

        // 상태 필터링
        if (status) {
            mergedList = mergedList.filter(c => c.automation.status === status);
        }

        // 검색 필터링
        if (search) {
            const lowerSearch = search.toLowerCase();
            mergedList = mergedList.filter(c =>
                c.customer.name.toLowerCase().includes(lowerSearch) ||
                (c.trip.destination || '').toLowerCase().includes(lowerSearch) ||
                (c.trip.product_name || '').toLowerCase().includes(lowerSearch)
            );
        }

        const limitedData = mergedList.slice(0, limit);

        // 응답 형식으로 변환
        const responseData = limitedData.map(c => ({
            id: c.visitor_id || `merged-${normalizePhone(c.customer.phone)}-${c.timestamp}`,
            visitorName: c.customer.name,
            visitorPhone: c.customer.phone,
            travelersCount: c.trip.travelers_count || '',
            recurringCustomer: c.automation.recurringCustomer || '',
            inquirySource: c.automation.inquirySource || '',
            destination: c.trip.destination,
            departureDate: c.trip.departure_date,
            returnDate: c.trip.return_date || '',
            duration: c.trip.duration || '',
            productName: c.trip.product_name,
            productUrl: c.trip.url || '',
            summary: c.summary || '',
            status: c.automation.status,
            source: c.source || '',
            nextFollowup: c.automation.next_followup || '',
            confirmedProduct: c.automation.confirmed_product || '',
            confirmedDate: c.automation.confirmed_date || '',
            prepaid_date: c.automation.prepaid_date || '', 
            prepaidDate: c.automation.prepaid_date || '',  
            noticeDate: c.automation.notice_date || '',
            balanceDate: c.automation.balance_date || '',
            confirmationSent: c.automation.confirmation_sent || '',
            departureNotice: c.automation.departure_notice || '',
            phoneNotice: c.automation.phone_notice || '',
            happyCall: c.automation.happy_call || '',
            inquiry_info_backup: c.automation.inquiry_info_backup || '',
            isBotEnabled: c.is_bot_enabled !== false,
            lastMessage: c.summary || '시트 기록됨',
            lastMessageAt: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
            messageCount: 1,
            sheetRowIndex: c.sheetRowIndex,
            sheetName: c.sheetName,
            sheetGid: c.sheetGid,
            specific_reminder_date: c.specific_reminder_date || '',
            previousInquiries: c.previousInquiries || [],
        }));

        return NextResponse.json({
            success: true,
            data: responseData,
            total: mergedList.length,
        });
    } catch (error) {
        console.error('상담 목록 조회 API 오류:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
