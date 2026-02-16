const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const logFile = path.resolve(__dirname, 'test-output.txt');
const log = (msg) => {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
};

async function testConnection() {
    fs.writeFileSync(logFile, '--- Google Sheets Connection Test (JSON File) ---\n');

    try {
        // Read credentials from JSON file
        const credentialsPath = path.resolve(__dirname, '../google-credentials.json');
        log(`Credentials Path: ${credentialsPath}`);
        log(`File Exists: ${fs.existsSync(credentialsPath)}`);

        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        log(`Email: ${credentials.client_email}`);
        log(`Project: ${credentials.project_id}`);

        // Read sheet ID from .env.local
        const envPath = path.resolve(__dirname, '../.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        let sheetId = '';
        envConfig.split('\n').forEach(line => {
            if (line.startsWith('GOOGLE_SHEET_ID=')) {
                sheetId = line.split('=')[1].trim();
            }
        });
        log(`Sheet ID: ${sheetId}`);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        log('Auth created');

        const sheets = google.sheets({ version: 'v4', auth });
        log('Sheets client created, calling API...');

        const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

        log('✅ SUCCESS!');
        log(`Title: ${res.data.properties.title}`);
        log(`Tabs: ${res.data.sheets.map(s => s.properties.title).join(', ')}`);

    } catch (error) {
        log('❌ FAILED');
        log(`Error: ${error.message}`);
        if (error.response) {
            log(`Status: ${error.response.status}`);
            log(`Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    log('--- Test Complete ---');
}

testConnection();
