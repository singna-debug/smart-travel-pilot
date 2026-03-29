import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 시트에 없는 항목들 정리 (Supabase에서 삭제)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({
                success: false,
                error: '삭제할 항목이 없습니다.'
            }, { status: 400 });
        }

        // Supabase가 설정되어 있을 경우에만 삭제 시도
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            // visitor_id로 매칭되는 항목들 삭제
            const { error } = await supabase
                .from('consultations')
                .delete()
                .in('visitor_id', ids);

            if (error) {
                console.error('Supabase 삭제 오류:', error);
                // 에러가 나더라도 프론트에서 필터링을 위해 success 반환
                return NextResponse.json({
                    success: true,
                    message: '로컬에서만 정리됨',
                    deletedCount: ids.length
                });
            }

            return NextResponse.json({
                success: true,
                message: 'Supabase에서 삭제 완료',
                deletedCount: ids.length
            });
        }

        // Supabase가 없으면 로컬 정리만
        return NextResponse.json({
            success: true,
            message: '로컬에서만 정리됨',
            deletedCount: ids.length
        });

    } catch (error) {
        console.error('Cleanup API 오류:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}
