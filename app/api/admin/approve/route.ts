import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Service Role 최고 관리자 클라이언트 생성
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// GET 또는 POST /api/admin/approve?email=6750064@naver.com
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const targetEmail = searchParams.get('email') || '6750064@naver.com';

        const adminSupabase = getAdminSupabase();
        if (!adminSupabase) {
            return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, { status: 500 });
        }

        // 1. 유저 목록 검색
        const { data: usersData, error: listErr } = await adminSupabase.auth.admin.listUsers();
        if (listErr) {
            return NextResponse.json({ success: false, error: listErr.message }, { status: 500 });
        }

        const targetUser = usersData.users.find(u => u.email === targetEmail);
        if (!targetUser) {
            return NextResponse.json({ success: false, error: `해당 이메일(${targetEmail})의 가입자를 찾을 수 없습니다.` }, { status: 404 });
        }

        // 2. 유저 이메일 인증 및 메타데이터 approved로 강제 즉시 승인!
        const { data: updatedUser, error: updateErr } = await adminSupabase.auth.admin.updateUserById(
            targetUser.id,
            {
                email_confirm: true,
                user_metadata: {
                    ...targetUser.user_metadata,
                    status: 'approved'
                }
            }
        );

        if (updateErr) {
            return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `🎉 [${targetEmail}] 계정 승인이 성공적으로 완료되었습니다! 지금 바로 로그인 가능합니다.`,
            user: updatedUser
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || '승인 처리 오류' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
