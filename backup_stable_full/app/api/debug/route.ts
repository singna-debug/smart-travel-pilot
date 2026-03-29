import { NextRequest, NextResponse } from 'next/server';
import { messageStore } from '@/lib/message-store';

export async function GET() {
    try {
        const { supabase } = await import('@/lib/supabase');
        let persistentLogs = [];
        let dbError = null;

        if (supabase) {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                dbError = error;
            } else {
                persistentLogs = data || [];
            }
        } else {
            dbError = "Supabase client not initialized";
        }

        const sysLogs = messageStore.getSystemLogs();

        // 민감 정보 마스킹된 환경 변수 확인
        const envKeys = [
            'GEMINI_API_KEY',
            'GOOGLE_SHEET_ID',
            'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_SERVICE_ACCOUNT_JSON',
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'KAKAO_REST_API_KEY',
            'KAKAO_CHANNEL_ID',
            'KAKAO_SKILL_SERVER_URL'
        ];

        const envStatus: Record<string, any> = {};
        envKeys.forEach(key => {
            const val = process.env[key];
            envStatus[key] = val ? {
                exists: true,
                length: val.length,
                start: val.substring(0, 5) + '...',
                is_base64: !val.trim().startsWith('{')
            } : { exists: false };
        });

        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            envStatus,
            memoryLogs: sysLogs,
            persistentLogs: persistentLogs,
            dbError: dbError
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
