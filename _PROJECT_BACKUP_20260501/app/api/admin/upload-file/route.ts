import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ 
            success: false, 
            error: '서버 환경 변수가 설정되지 않았습니다.' 
        }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const filePath = formData.get('filePath') as string;

        if (!file || !filePath) {
            return NextResponse.json({ 
                success: false, 
                error: '파일 또는 파일 경로가 누락되었습니다.' 
            }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        
        // service_role 키를 사용하므로 RLS를 우방하고 바로 업로드 가능
        const { data, error } = await supabase.storage
            .from('confirmations')
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type
            });

        if (error) throw error;

        // 공용 URL 생성
        const { data: { publicUrl } } = supabase.storage
            .from('confirmations')
            .getPublicUrl(filePath);

        return NextResponse.json({ 
            success: true, 
            publicUrl 
        });

    } catch (error: any) {
        console.error('[Upload API Error]:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
