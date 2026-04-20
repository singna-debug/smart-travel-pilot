import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NOTE: We MUST use the service_role key to manage storage buckets and policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ 
            success: false, 
            error: '환경 변수(URL 또는 Service Role Key)가 설정되지 않았습니다.' 
        }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const bucketName = 'confirmations';

    try {
        console.log(`[Storage Setup] Checking for bucket: ${bucketName}`);
        
        // 1. 버킷 존재 여부 확인 및 생성
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) throw listError;

        const bucketExists = buckets.some(b => b.name === bucketName);

        if (!bucketExists) {
            console.log(`[Storage Setup] Creating bucket: ${bucketName}`);
            const { error: createError } = await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
            });
            if (createError) throw createError;
        } else {
            console.log(`[Storage Setup] Bucket already exists: ${bucketName}`);
            // 이미 존재한다면 public으로 전환 시도 (안정성 확보)
            await supabase.storage.updateBucket(bucketName, { public: true });
        }

        // 2. 정책(Policy) 설정 - 익명 사용자의 읽기 권한 보장
        // SQL을 직접 실행할 수 없으므로, 스토리지 API를 통해 확인이 어렵지만 
        // 버킷이 'public: true'이면 대부분의 경우 읽기는 가능합니다.
        // 다만 업로드는 anon key로 수행하므로, 스토리지 설정에서 'Allow anonymous uploads'가 체크되어야 합니다.

        return NextResponse.json({ 
            success: true, 
            message: `Supabase Storage '${bucketName}' 버킷이 성공적으로 준비되었습니다.`,
            details: bucketExists ? '이미 존재함 (Public 설정 업데이트)' : '새로 생성됨'
        });

    } catch (error: any) {
        console.error('[Storage Setup API] Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
