import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { supabase } from '@/lib/supabase';

// 상담 목록 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '50');

        let consultations: any[] = [];

        // 1. Supabase에서 데이터 가져오기 시도
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            const { data, error } = await supabase
                .from('consultations')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                consultations = data.map(c => ({
                    timestamp: c.created_at,
                    visitor_id: c.visitor_id,
                    customer: { name: c.customer_name, phone: c.customer_phone },
                    trip: {
                        destination: c.destination,
                        product_name: c.product_name,
                        departure_date: c.departure_date,
                        url: c.url
                    },
                    automation: { status: c.status },
                    summary: c.summary
                }));
            }
        }

        const refresh = searchParams.get('refresh') === 'true';

        // 2. Google Sheets에서 데이터 가져오기 (항상 수행, refresh 파라미터에 따라 캐시 우회)
        const sheetData = await getAllConsultations(refresh);

        // 3. 데이터 병합 (중복 제거 및 최신 데이터 우선)
        const mergedMap = new Map<string, any>();

        // (1) Supabase 데이터 먼저 맵에 등록
        consultations.forEach(c => {
            const key = c.visitor_id;
            mergedMap.set(key, c);
        });

        // (2) Sheet 데이터 병합
        sheetData.forEach(item => {
            // Sheet 데이터는 visitor_id가 없을 수 있음.
            // 기존 Supabase 데이터와 매칭 시도 (전화번호+이름)
            let matchKey = '';

            // 전화번호로 매칭 시도
            if (item.customer.phone !== '미정') {
                for (const [key, val] of mergedMap.entries()) {
                    if (val.customer.phone === item.customer.phone) {
                        matchKey = key;
                        break;
                    }
                }
            }

            // 이름으로 매칭 시도 (전화번호 매칭 실패 시)
            if (!matchKey && item.customer.name !== '미정') {
                for (const [key, val] of mergedMap.entries()) {
                    if (val.customer.name === item.customer.name && val.customer.phone === '미정') {
                        matchKey = key;
                        break;
                    }
                }
            }

            if (matchKey) {
                // 매칭된 경우: 더 최신 데이터로 업데이트 (타임스탬프 비교)
                const existing = mergedMap.get(matchKey);
                const sheetTime = new Date(item.timestamp || 0).getTime();
                const dbTime = new Date(existing.timestamp || 0).getTime();

                // 시트 데이터가 더 최신이거나 비슷하면(같은 날), 시트 내용(요약 등)을 우선할 수 있음
                // 여기서는 시트가 '상담원 수동 업데이트'의 원천이라 보고 시트 내용을 덮어씌움 (단, ID는 유지)
                mergedMap.set(matchKey, {
                    ...existing,
                    ...item, // 시트 데이터로 덮어쓰기 (요약, 상태 등)
                    visitor_id: existing.visitor_id, // ID는 유지
                    timestamp: sheetTime > dbTime ? item.timestamp : existing.timestamp
                });
            } else {
                // 매칭 안됨: 새로운 데이터로 추가
                // 임시 ID 생성 (프론트엔드 키 용도)
                const tempId = `sheet-${item.customer.phone}-${item.timestamp}`;
                mergedMap.set(tempId, { ...item, visitor_id: tempId });
            }
        });

        // 맵 -> 배열 변환
        const mergedList = Array.from(mergedMap.values());

        // 날짜순 정렬 (최신순)
        mergedList.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
        });

        // 최종 리스트 교체
        consultations = mergedList;

        // 상태 필터링
        if (status) {
            consultations = consultations.filter(c => c.automation.status === status);
        }

        // 검색 필터링
        if (search) {
            const lowerSearch = search.toLowerCase();
            consultations = consultations.filter(c =>
                c.customer.name.toLowerCase().includes(lowerSearch) ||
                c.trip.destination.toLowerCase().includes(lowerSearch) ||
                c.trip.product_name.toLowerCase().includes(lowerSearch)
            );
        }

        // 제한 적용
        const limitedData = consultations.slice(0, limit);

        // 응답 형식으로 변환
        const responseData = limitedData.map(c => ({
            id: c.visitor_id || `sheet-${c.customer.phone}-${c.timestamp}`,
            visitorName: c.customer.name,
            visitorPhone: c.customer.phone,
            destination: c.trip.destination,
            productName: c.trip.product_name,
            departureDate: c.trip.departure_date,
            status: c.automation.status,
            lastMessage: c.summary || '시트 기록됨',
            lastMessageAt: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
            messageCount: 1,
            sheetRowIndex: c.sheetRowIndex,
            sheetName: c.sheetName,
            sheetGid: c.sheetGid,
        }));

        return NextResponse.json({
            success: true,
            data: responseData,
            total: consultations.length,
        });
    } catch (error) {
        console.error('상담 목록 조회 API 오류:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
