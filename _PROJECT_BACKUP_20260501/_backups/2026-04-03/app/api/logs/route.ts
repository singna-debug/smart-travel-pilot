import { NextRequest, NextResponse } from 'next/server';
import { messageStore } from '@/lib/message-store';

// 활동 로그 조회
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    let logs = messageStore.getActivityLogs(limit);

    // 타입 필터링
    if (type) {
        logs = logs.filter(log => log.type === type);
    }

    return NextResponse.json({
        success: true,
        data: logs.map(log => ({
            id: log.id,
            type: log.type,
            message: log.message,
            visitorName: log.visitorName,
            destination: log.destination,
            timestamp: log.timestamp.toISOString(),
        })),
    });
}
