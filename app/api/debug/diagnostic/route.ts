import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const diagnostics = {
        env: {
            SCRAPINGBEE_API_KEY_PRESENT: !!process.env.SCRAPINGBEE_API_KEY,
            GEMINI_API_KEY_PRESENT: !!process.env.GEMINI_API_KEY,
            VERCEL: process.env.VERCEL || 'not set',
            NODE_ENV: process.env.NODE_ENV || 'not set',
        },
        connectivity: {
            scrapingbee: 'pending',
            gemini: 'pending'
        }
    };

    // Check ScrapingBee Connectivity (no JS scenario, just a simple request)
    try {
        if (process.env.SCRAPINGBEE_API_KEY) {
            const res = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=https://httpbin.org/get`, {
                signal: AbortSignal.timeout(5000)
            });
            diagnostics.connectivity.scrapingbee = res.ok ? 'OK' : `Failed (${res.status})`;
        } else {
            diagnostics.connectivity.scrapingbee = 'No API Key';
        }
    } catch (e: any) {
        diagnostics.connectivity.scrapingbee = `Error: ${e.message}`;
    }

    // Check Gemini Connectivity
    try {
        if (process.env.GEMINI_API_KEY) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
                signal: AbortSignal.timeout(5000)
            });
            diagnostics.connectivity.gemini = res.ok ? 'OK' : `Failed (${res.status})`;
        } else {
            diagnostics.connectivity.gemini = 'No API Key';
        }
    } catch (e: any) {
        diagnostics.connectivity.gemini = `Error: ${e.message}`;
    }

    return NextResponse.json(diagnostics);
}
