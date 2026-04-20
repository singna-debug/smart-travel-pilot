
const { google } = require('googleapis');
const fs = require('fs');

async function inspect() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: '2026-04!A15:AB15',
    });
    
    const row = resp.data.values[0];
    if (row) {
        row.forEach((val, i) => {
            console.log(`[${i}] (${String.fromCharCode(65 + (i % 26))}): ${val}`);
        });
    } else {
        console.log('Row not found');
    }
}

inspect().catch(console.error);
