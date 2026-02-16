import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        success: true,
        data: {
            summary: {
                newInquiriesCount: 0,
                confirmedCount: 0,
                completedCount: 0,
                reminderCount: 0,
            },
            schedule: {
                balanceDueCount: 0,
                travelNoticeCount: 0,
                postTripCount: 0,
            },
            lists: {
                recentInquiries: [],
                confirmedInquiries: [],
                completedInquiries: [],
                needReminders: [],
                balanceDueTargets: [],
                travelNoticeTargets: [],
                postTripTargets: [],
            }
        },
    });
}
