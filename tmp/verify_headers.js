const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function verify() {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        let auth;
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        if (fs.existsSync(credentialsPath)) {
            auth = new google.auth.GoogleAuth({
                credentials: JSON.parse(fs.readFileSync(credentialsPath, 'utf8')),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        }
        
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: '2026-03!A1:W1',
        });
        
        console.log('Current Headers (2026-03):');
        console.log(JSON.stringify(res.data.values[0], null, 2));
        console.log(`Column Count: ${res.data.values[0].length}`);

    } catch (error) {
        console.error('Verification failed:', error.message);
    }
}

verify();
