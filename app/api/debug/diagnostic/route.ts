
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
        
        // HTML 출력을 위해 정리된 JSON 반환
        return new NextResponse(
            `<html>
                <head>
                    <title>Crawler Diagnostic Log</title>
                    <style>
                        body { background: #0f172a; color: #e2e8f0; font-family: monospace; padding: 20px; line-height: 1.5; }
                        pre { background: #1e293b; padding: 15px; border-radius: 8px; overflow-x: auto; border: 1px solid #334155; }
                        .status-success { color: #10b981; font-weight: bold; }
                        .status-fail { color: #ef4444; font-weight: bold; }
                        h2 { border-bottom: 2px solid #334155; padding-bottom: 10px; color: #38bdf8; }
                    </style>
                </head>
                <body>
                    <h2>🔍 Crawler 실시간 진단 로그</h2>
                    <p>마지막 분석 시간: ${data.timestamp || 'N/A'}</p>
                    <p>분석 URL: <a href="${data.url}" target="_blank" style="color: #fbbf24;">${data.url}</a></p>
                    <p>텍스트 길이: ${data.textLength || 0} 자</p>
                    <p>Native 데이터 여부: <span class="${data.hasNativeData ? 'status-success' : 'status-fail'}">${data.hasNativeData ? 'YES' : 'NO'}</span></p>
                    <p>Gemini 분석 결과: <span class="${data.geminiResult === 'SUCCESS' ? 'status-success' : 'status-fail'}">${data.geminiResult}</span></p>
                    
                    <h3>1. Gemini 수집 현황 (Sample)</h3>
                    <pre>${JSON.stringify(data.geminiSample || {}, null, 2)}</pre>
                    
                    <h3>2. 최종 조립 결과 (Final Result)</h3>
                    <pre>${JSON.stringify(data.finalResult || {}, null, 2)}</pre>
                    
                    <h3>3. 수집된 원본 텍스트 샘플 (Top 2000)</h3>
                    <pre>${(data.textSample || '').substring(0, 2000)}</pre>
                </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
