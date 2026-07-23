import { NextRequest, NextResponse } from 'next/server';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = parseInt(searchParams.get('period') || '30', 10);

        // 1. 신규 vs 재방문
        const newVsReturning = [
            { name: '신규 고객', value: Math.round(period * 3.2), color: '#6366f1' },
            { name: '재방문 고객', value: Math.round(period * 1.3), color: '#22d3ee' },
        ];
        const totalRecords = newVsReturning[0].value + newVsReturning[1].value;

        // 2. 유입 경로
        const inquirySource = [
            { name: '네이버 블로그', value: Math.round(period * 1.8), converted: Math.round(period * 0.5), conversionRate: 28, color: '#8b5cf6' },
            { name: '카카오톡 채널', value: Math.round(period * 1.5), converted: Math.round(period * 0.6), conversionRate: 40, color: '#06b6d4' },
            { name: '인스타그램 및 페이스북', value: Math.round(period * 0.7), converted: Math.round(period * 0.1), conversionRate: 14, color: '#f59e0b' },
            { name: '당근마켓', value: Math.round(period * 0.3), converted: Math.round(period * 0.05), conversionRate: 17, color: '#ef4444' },
            { name: '닷컴', value: Math.round(period * 0.2), converted: Math.round(period * 0.04), conversionRate: 20, color: '#10b981' }
        ];
        const totalSourceInquiries = inquirySource.reduce((acc, curr) => acc + curr.value, 0);

        // 3. 인기 여행지
        const topDestinations = [
            { name: '후쿠오카', inquiries: Math.round(period * 1.5), bookings: Math.round(period * 0.6), color: '#6366f1' },
            { name: '다낭', inquiries: Math.round(period * 1.1), bookings: Math.round(period * 0.3), color: '#22d3ee' },
            { name: '오사카', inquiries: Math.round(period * 0.9), bookings: Math.round(period * 0.25), color: '#f59e0b' },
            { name: '도쿄', inquiries: Math.round(period * 0.6), bookings: Math.round(period * 0.15), color: '#10b981' },
            { name: '방콕', inquiries: Math.round(period * 0.4), bookings: Math.round(period * 0.1), color: '#ef4444' }
        ];

        // 4. 문의 대비 전환
        const convertedCount = inquirySource.reduce((acc, curr) => acc + curr.converted, 0);
        const conversionRate = Math.round((convertedCount / totalRecords) * 100);
        const conversionData = [
            { name: '총 문의', value: totalRecords, color: '#6366f1' },
            { name: '예약 전환', value: convertedCount, color: '#22d3ee' },
            { name: '상담중/미전환', value: totalRecords - convertedCount, color: '#334155' },
        ];

        // 5. 전환 추이 및 소스별 추이 생성 (일별, 주별, 월별)
        const conversionTrend = [];
        const sourceTrends: Record<string, any[]> = {};
        
        inquirySource.forEach(s => {
            sourceTrends[s.name] = [];
        });

        const today = new Date();
        const steps = period <= 7 ? 7 : period <= 30 ? 5 : 6;
        const daysPerStep = period <= 7 ? 1 : period <= 30 ? 6 : 15;

        for (let i = steps - 1; i >= 0; i--) {
            const d = subDays(today, i * daysPerStep);
            let label = '';
            if (period <= 7) {
                label = format(d, 'MM/dd');
            } else if (period <= 30) {
                const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                label = format(weekStart, 'MM/dd') + '~';
            } else {
                const monthStart = startOfMonth(d);
                label = format(monthStart, 'yyyy/MM');
            }

            // 시뮬레이션 데이터
            const scale = (steps - i) / steps; // 최근으로 올수록 문의 증가하는 추세 연출
            const inq = Math.round((period / steps) * (0.8 + Math.random() * 0.4) * (0.9 + scale * 0.2));
            const cvt = Math.round(inq * (0.2 + Math.random() * 0.15));

            conversionTrend.push({
                name: label,
                '문의': inq,
                '전환': cvt,
                '전환율': inq > 0 ? Math.round((cvt / inq) * 100) : 0
            });

            // 소스별
            inquirySource.forEach(s => {
                const share = s.name === '네이버 블로그' ? 0.4 : s.name === '카카오톡 채널' ? 0.3 : 0.1;
                const sInq = Math.max(1, Math.round(inq * share));
                const sCvt = Math.round(sInq * (s.conversionRate / 100));
                sourceTrends[s.name].push({
                    name: label,
                    '문의': sInq,
                    '전환': sCvt,
                    '전환율': s.conversionRate
                });
            });
        }

        // 6. 예약 리드타임
        const leadTimeData = [
            { name: '7일 이내', value: Math.round(period * 0.4) },
            { name: '8~14일', value: Math.round(period * 0.8) },
            { name: '15~30일', value: Math.round(period * 1.5) },
            { name: '31~60일', value: Math.round(period * 1.1) },
            { name: '61일 이상', value: Math.round(period * 0.7) }
        ];

        return NextResponse.json({
            success: true,
            data: {
                period,
                totalRecords,
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
        console.error('[Dummy Analytics API] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch dummy analytics' }, { status: 500 });
    }
}
