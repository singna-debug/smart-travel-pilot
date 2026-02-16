
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Manual env parser
function loadEnv(filePath: string) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
}

loadEnv('.env');
loadEnv('.env.local');

async function checkMetadata() {
    try {
        const log = (msg: string) => {
            console.log(msg);
            fs.appendFileSync('sheets-meta.txt', msg + '\n');
        };

        fs.writeFileSync('sheets-meta.txt', ''); // Clear file

        log('Checking Google Sheets Metadata...');

        let auth;
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        if (fs.existsSync(credentialsPath)) {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
            if (!jsonStr.startsWith('{')) {
                jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
            }
            const credentials = JSON.parse(jsonStr);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        if (!auth) {
            log('No credentials found. Checking env vars...');
            log('GOOGLE_SHEET_ID: ' + (process.env.GOOGLE_SHEET_ID ? 'Present' : 'Missing'));
            log('GOOGLE_SERVICE_ACCOUNT_JSON: ' + (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'Present' : 'Missing'));
            return;
        }

        const sheets = google.sheets({ version: 'v4', auth });
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            log('GOOGLE_SHEET_ID is missing.');
            return;
        }

        const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetList = response.data.sheets || [];

        log('--- Found Sheets ---');
        sheetList.forEach((s) => {
            log(`Title: "${s.properties?.title}", ID (GID): ${s.properties?.sheetId}, Index: ${s.properties?.index}`);
        });
        log('--------------------');

    } catch (error: any) {
        fs.appendFileSync('sheets-meta.txt', 'Error: ' + error.message + '\n');
        console.error('Error:', error);
    }
}

checkMetadata();
