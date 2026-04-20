
const { google } = require('googleapis');
const fs = require('fs');

async function lastRecheck() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    const sheetTitle = '2026-04';
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A40:Z55`,
    });
    
    const rows = resp.data.values || [];
    console.log('--- Rows 40-55 Inspection ---');
    rows.forEach((row, i) => {
        const rowIndex = i + 40;
        console.log(`[Row ${rowIndex}] Name: ${row[1]} | T-Y: ${row.slice(19, 25).join(' | ')}`);
    });
}

lastRecheck().catch(console.error);
