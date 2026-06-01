import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { differenceInDays, startOfDay, subDays, format, startOfWeek, startOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = parseInt(searchParams.get('period') || '30', 10); // 7, 30, 90

        const consultations = await getAllConsultations();
        const todayObj = startOfDay(new Date());
        const cutoff = subDays(todayObj, period);

        // 날짜 파싱 헬퍼
        const parseD = (dStr?: string | null) => {
            if (!dStr) return null;
            const cleanStr = dStr.replace('(완료)', '').trim().replace(' ', 'T');
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return null;
            return startOfDay(d);
        };

        // 기간 내 상담건만 필터
        const filtered = consultations.filter(c => {
            const d = parseD(c.timestamp);
            if (!d) return false;
            return d >= cutoff && d <= todayObj;
        });

        // ═══════════════════════════════════════════════
        // 1. 신규 vs 재방문 (도넛 차트)
        // ═══════════════════════════════════════════════
        let newCount = 0;
        let returningCount = 0;
        filtered.forEach(c => {
            const val = (c.automation.recurringCustomer || '').trim();
            if (val === '재방문' || val === 'Y' || val === '예' || val === 'O') {
                returningCount++;
            } else {
                newCount++;
            }
        });
        const newVsReturning = [
            { name: '신규 고객', value: newCount, color: '#6366f1' },
            { name: '재방문 고객', value: returningCount, color: '#22d3ee' },
        ];

        // ═══════════════════════════════════════════════
        // 2. 유입 경로 비율 및 전환율 (도넛 차트)
        // ═══════════════════════════════════════════════
        const paidStatuses = ['예약확정', '선금완료', '잔금완료', '결제완료', '확정', '전액결제', '여행완료'];
        const sourceMap: Record<string, { total: number; converted: number }> = {};
        
        filtered.forEach(c => {
            const src = (c.automation.inquirySource || '').trim();
            if (!src || src.includes('수동')) return;

            if (!sourceMap[src]) sourceMap[src] = { total: 0, converted: 0 };
            sourceMap[src].total++;
            if (paidStatuses.includes(c.automation.status)) {
                sourceMap[src].converted++;
            }
        });

        const sourceColors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#ec4899'];
        const inquirySource = Object.entries(sourceMap)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 7)
            .map(([name, { total, converted }], idx) => ({
                name,
                value: total,
                converted,
                conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
                color: sourceColors[idx % sourceColors.length],
            }));

        const totalSourceInquiries = inquirySource.reduce((acc, curr) => acc + curr.value, 0);

        // ═══════════════════════════════════════════════
        // 3. 주요 방문 국가/도시 TOP 5 (도넛 차트)
        // ═══════════════════════════════════════════════
        const destMap: Record<string, { inquiries: number; bookings: number }> = {};
        filtered.forEach(c => {
            let dest = (c.trip.destination || '').trim();
            if (!dest) return;
            if (dest.includes(' ')) {
                const parts = dest.split(' ');
                dest = parts[parts.length - 1]; 
            }
            if (dest.includes('/')) {
                dest = dest.split('/')[0];
            }
            
            if (!destMap[dest]) destMap[dest] = { inquiries: 0, bookings: 0 };
            destMap[dest].inquiries++;
            if (paidStatuses.includes(c.automation.status)) {
                destMap[dest].bookings++;
            }
        });

        const destColors = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444'];
        const topDestinations = Object.entries(destMap)
            .sort((a, b) => b[1].inquiries - a[1].inquiries)
            .slice(0, 5)
            .map(([name, { inquiries, bookings }], idx) => ({
                name,
                inquiries,
                bookings,
                color: destColors[idx % destColors.length],
            }));

        // ═══════════════════════════════════════════════
        // 4. 문의 대비 결제 전환율 (막대 차트)
        // ═══════════════════════════════════════════════
        const totalInquiries = filtered.length;
        const convertedCount = filtered.filter(c => paidStatuses.includes(c.automation.status)).length;
        const consultingCount = totalInquiries - convertedCount;
        const conversionRate = totalInquiries > 0 ? Math.round((convertedCount / totalInquiries) * 100) : 0;

        const conversionData = [
            { name: '총 문의', value: totalInquiries, color: '#6366f1' },
            { name: '예약 전환', value: convertedCount, color: '#22d3ee' },
            { name: '상담중/미전환', value: consultingCount, color: '#334155' },
        ];

        // ═══════════════════════════════════════════════
        // 5. 전환 추이 및 유입경로별 추이 (꺾은선 차트)
        // ═══════════════════════════════════════════════
        const trendBuckets: Record<string, { total: number; converted: number }> = {};
        const sourceTrendsMap: Record<string, Record<string, { total: number; converted: number }>> = {};

        filtered.forEach(c => {
            const d = parseD(c.timestamp);
            if (!d) return;
            const src = (c.automation.inquirySource || '').trim();
            if (src.includes('수동')) return; // 수동 제외

            let key: string;
            if (period <= 7) {
                key = format(d, 'MM/dd');
            } else if (period <= 30) {
                const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                key = format(weekStart, 'MM/dd') + '~';
            } else {
                const monthStart = startOfMonth(d);
                key = format(monthStart, 'yyyy/MM');
            }

            // 전체 추이
            if (!trendBuckets[key]) trendBuckets[key] = { total: 0, converted: 0 };
            trendBuckets[key].total++;
            if (paidStatuses.includes(c.automation.status)) {
                trendBuckets[key].converted++;
            }

            // 소스별 추이
            if (src) {
                if (!sourceTrendsMap[src]) sourceTrendsMap[src] = {};
                if (!sourceTrendsMap[src][key]) sourceTrendsMap[src][key] = { total: 0, converted: 0 };
                sourceTrendsMap[src][key].total++;
                if (paidStatuses.includes(c.automation.status)) {
                    sourceTrendsMap[src][key].converted++;
                }
            }
        });

        const conversionTrend = Object.entries(trendBuckets)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, { total, converted }]) => ({
                name,
                문의: total,
                전환: converted,
                전환율: total > 0 ? Math.round((converted / total) * 100) : 0,
            }));

        const sourceTrends: Record<string, any[]> = {};
        Object.entries(sourceTrendsMap).forEach(([src, buckets]) => {
            sourceTrends[src] = Object.entries(buckets)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([name, { total, converted }]) => ({
                    name,
                    문의: total,
                    전환: converted,
                    전환율: total > 0 ? Math.round((converted / total) * 100) : 0,
                }));
        });


        // ═══════════════════════════════════════════════
        // 6. 예약 리드타임 (가로 막대 차트)
        //    출발일 - 예약일(timestamp 또는 confirmed_date) = 며칠 전에 예약?
        // ═══════════════════════════════════════════════
        const leadTimeBuckets: Record<string, number> = {
            '7일 이내': 0,
            '8~14일': 0,
            '15~30일': 0,
            '31~60일': 0,
            '61일 이상': 0,
        };

        filtered.forEach(c => {
            const depDate = parseD(c.trip.departure_date);
            const bookDate = parseD(c.automation.confirmed_date) || parseD(c.timestamp);
            if (!depDate || !bookDate) return;
            const leadDays = differenceInDays(depDate, bookDate);
            if (leadDays < 0) return; // 출발일이 예약일보다 이전인 경우 무시
            if (leadDays <= 7) leadTimeBuckets['7일 이내']++;
            else if (leadDays <= 14) leadTimeBuckets['8~14일']++;
            else if (leadDays <= 30) leadTimeBuckets['15~30일']++;
            else if (leadDays <= 60) leadTimeBuckets['31~60일']++;
            else leadTimeBuckets['61일 이상']++;
        });

        const leadTimeData = Object.entries(leadTimeBuckets).map(([name, value]) => ({
            name,
            value,
        }));

        return NextResponse.json({
            success: true,
            data: {
                period,
                totalRecords: filtered.length,
                totalSourceInquiries,
                newVsReturning,
                inquirySource,
                topDestinations,
                conversionData,
                conversionRate,
                conversionTrend,
                sourceTrends,
                leadTimeData,
            },
        });
    } catch (error) {
        console.error('[Analytics API] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch analytics data' }, { status: 500 });
    }
}
