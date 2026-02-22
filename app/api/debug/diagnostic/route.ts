import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function maskKey(key: string | undefined) {
    if (!key) return 'Missing';
    if (key.length < 8) return 'Short Key';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

export async function GET(request: NextRequest) {
    const diagnostics: any = {
        platform: {
            VERCEL: process.env.VERCEL === '1',
            NODE_ENV: process.env.NODE_ENV,
            REGION: process.env.VERCEL_REGION || 'local',
        },
        env: {
            SCRAPINGBEE_KEY: maskKey(process.env.SCRAPINGBEE_API_KEY),
            GEMINI_KEY: maskKey(process.env.GEMINI_API_KEY),
            GOOGLE_SHEET_ID: maskKey(process.env.GOOGLE_SHEET_ID),
            GOOGLE_CREDENTIALS: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'Present' : 'Missing',
        },
        connectivity: {
            scrapingbee: 'pending',
            gemini: 'pending',
            google_sheets: 'pending'
        }
    };

    // Check ScrapingBee Connectivity
    try {
        if (process.env.SCRAPINGBEE_API_KEY) {
            const res = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=https://httpbin.org/get`, {
                signal: AbortSignal.timeout(5000)
            });
            const data = await res.json();
            diagnostics.connectivity.scrapingbee = res.ok && data.url ? 'OK' : `Failed (${res.status})`;
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

    // Check Google Sheets Connectivity
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

        if (sheetId && jsonStr) {
            // we use the logic from google-sheets.ts but inlined or imported
            // to avoid circular dependency if any, we'll do a simple check
            let auth;
            let credentials;
            try {
                let cleanJson = jsonStr.trim();
                if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
                    cleanJson = cleanJson.substring(1, cleanJson.length - 1);
                }
                if (!cleanJson.startsWith('{')) {
                    cleanJson = Buffer.from(cleanJson, 'base64').toString('utf8');
                }
                credentials = JSON.parse(cleanJson);
                auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/spreadsheets.readonly'],
                });
                const sheets = google.sheets({ version: 'v4', auth });
                const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
                diagnostics.connectivity.google_sheets = `OK (Title: ${response.data.properties?.title})`;
            } catch (parsErr: any) {
                // Try fallback replace if initial parse fails
                try {
                    let cleanJson = jsonStr.trim();
                    if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
                        cleanJson = cleanJson.substring(1, cleanJson.length - 1);
                    }
                    if (!cleanJson.startsWith('{')) {
                        cleanJson = Buffer.from(cleanJson, 'base64').toString('utf8');
                    }
                    const fallbackJson = cleanJson.replace(/\\n/g, '\n');
                    credentials = JSON.parse(fallbackJson);
                    auth = new google.auth.GoogleAuth({
                        credentials,
                        scopes: ['https://www.googleapis.com/spreadsheets.readonly'],
                    });
                    const sheets = google.sheets({ version: 'v4', auth });
                    const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
                    diagnostics.connectivity.google_sheets = `OK via Fallback (Title: ${response.data.properties?.title})`;
                } catch (e2: any) {
                    diagnostics.connectivity.google_sheets = `Auth/Fetch Error: ${e2.message}`;
                }
            }
        } else {
            diagnostics.connectivity.google_sheets = `Missing Config (SheetID: ${sheetId ? 'OK' : 'No'}, JSON: ${jsonStr ? 'OK' : 'No'})`;
        }
    } catch (e: any) {
        diagnostics.connectivity.google_sheets = `Critical Error: ${e.message}`;
    }

    return NextResponse.json(diagnostics);
}
