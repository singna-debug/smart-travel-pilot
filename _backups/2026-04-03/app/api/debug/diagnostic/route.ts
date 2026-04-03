
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
        
        if (!fs.existsSync(debugPath)) {
            return NextResponse.json({ 
                success: false, 
                message: '아직 수행된 분석 기록이 없습니다. 확정서 제작에서 URL 분석을 먼저 실행해주세요.' 
            });
        }

        const data = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
        
        return new NextResponse(
            `<html>
                <head>
                    <title>Crawler Diagnostic Log (Detailed)</title>
                    <style>
                        body { background: #010409; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; padding: 20px; line-height: 1.6; }
                        pre { background: #0d1117; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #30363d; color: #8b949e; font-size: 13px; }
                        .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
                        .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
                        .bg-success { background: #238636; color: #fff; }
                        .bg-fail { background: #da3633; color: #fff; }
                        .bg-warn { background: #9e6a03; color: #fff; }
                        h2, h3 { color: #58a6ff; margin-top: 0; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px; }
                        .item-label { color: #8b949e; font-size: 12px; display: block; }
                        .item-value { font-size: 16px; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <h2>🛰️ 실서버 크롤러 정밀 진단</h2>
                    
                    <div class="grid">
                        <div class="card">
                            <span class="item-label">분석 URL</span>
                            <div class="item-value" style="word-break: break-all;">${data.url}</div>
                        </div>
                        <div class="card">
                            <span class="item-label">마지막 시도 시간</span>
                            <div class="item-value">${data.timestamp}</div>
                        </div>
                    </div>

                    <div class="grid">
                        <div class="card">
                            <span class="item-label">Native API 상태 (Status Codes)</span>
                            <div class="item-value">
                                ${data.nativeStatuses ? data.nativeStatuses.map((s: number) => 
                                    `<span class="status-badge ${s === 200 ? 'bg-success' : 'bg-fail'}">${s}</span>`
                                ).join(' ') : '<span class="status-badge bg-warn">기록 없음</span>'}
                            </div>
                        </div>
                        <div class="card">
                            <span class="item-label">Native 데이터 수집</span>
                            <div class="item-value">
                                <span class="status-badge ${data.hasNativeData ? 'bg-success' : 'bg-fail'}">${data.hasNativeData ? 'SUCCESS' : 'FAILED'}</span>
                                ${data.nativeDataSummary ? `<span style="font-size: 12px; color: #8b949e; margin-left: 10px;">(${data.nativeDataSummary.itineraryDays}일치 일정 확보)</span>` : ''}
                            </div>
                        </div>
                        <div class="card">
                            <span class="item-label">Gemini AI 분석</span>
                            <div class="item-value">
                                <span class="status-badge ${data.geminiResult === 'SUCCESS' ? 'bg-success' : 'bg-fail'}">${data.geminiResult || 'NO_ATTEMPT'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h3>1. AI 추출 샘플 (Gemini Sample)</h3>
                        <pre>${JSON.stringify(data.geminiSample || {}, null, 2)}</pre>
                    </div>

                    <div class="card">
                        <h3>2. AI가 읽은 원문 샘플 (Scraped Text)</h3>
                        <p style="font-size: 12px; color: #8b949e;">총 길이: ${data.textLength} 자</p>
                        <pre>${(data.textSample || '').substring(0, 3000)}...</pre>
                    </div>

                    <div class="card">
                        <h3>3. 최종 병합 결과 (Final Result)</h3>
                        <pre>${JSON.stringify(data.finalResult || {}, null, 2)}</pre>
                    </div>
                </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
