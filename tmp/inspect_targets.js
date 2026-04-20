
const { google } = require('googleapis');
const fs = require('fs');

async function inspectTargets() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: '2026-04!A1:AA100',
    });
    
    const rows = resp.data.values || [];
    const targets = ['송대근', '강대순', '문성필'];
    
    console.log('--- Targeted Rows Inspection ---');
    rows.forEach((row, i) => {
        if (row[1] && targets.some(t => row[1].includes(t))) {
            console.log(`Row ${i+1} (${row[1]}):`);
            console.log(`  H (Dep): ${row[7]}`);
            console.log(`  T-Y: ${row.slice(19, 25).join(' | ')}`);
        }
    });
}

inspectTargets().catch(console.error);
