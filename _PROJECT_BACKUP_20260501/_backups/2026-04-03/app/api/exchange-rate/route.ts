import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 캐시: 10분간 유지
let cachedRates: any = null;
let lastFetch = 0;
const CACHE_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = (searchParams.get('from') || 'KRW').toUpperCase();
        const to = (searchParams.get('to') || 'USD').toUpperCase();

        // 캐시 유효 || 새로 가져오기
        if (!cachedRates || Date.now() - lastFetch > CACHE_MS) {
            // 무료 API: exchangerate-api.com 또는 open.er-api.com
            const res = await fetch(
                `https://open.er-api.com/v6/latest/${from}`,
                { signal: AbortSignal.timeout(5000) }
            );
            if (res.ok) {
                const data = await res.json();
                cachedRates = data;
                lastFetch = Date.now();
            } else {
                throw new Error(`Exchange rate API error: ${res.status}`);
            }
        }

        const rate = cachedRates?.rates?.[to];
        if (!rate) {
            return NextResponse.json(
                { success: false, error: `환율 정보를 찾을 수 없습니다: ${from} → ${to}` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                from,
                to,
                rate,
                updated: cachedRates.time_last_update_utc || new Date().toISOString(),
            }
        });
    } catch (error: any) {
        console.error('[Exchange Rate API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
