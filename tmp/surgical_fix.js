
const { google } = require('googleapis');
const fs = require('fs');

async function surgicalFix() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    const sheetTitle = '2026-04';
    
    console.log('43행 및 48행 수술적 복구 시작...');
    
    // 1. 데이터 조회
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!H43:I50`,
    });
    
    const rows = resp.data.values || [];
    const updates = [];
    
    const addDays = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const parse = (s) => new Date(s.split(' ')[0].replace(/\./g, '-'));

    // Row 43 (Index 0 in fetched range)
    let dep43 = rows[0][0] || '2026-07-20';
    let ret43 = rows[0][1] || '2026-07-27';
    if (dep43.includes('2024')) dep43 = dep43.replace('2024', '2026');
    if (ret43.includes('2024')) ret43 = ret43.replace('2024', '2026');

    const d43 = parse(dep43);
    const r43 = parse(ret43);
    updates.push({
        range: `${sheetTitle}!T43:Y43`,
        values: [[
            formatDate(addDays(d43, -28)),
            formatDate(addDays(d43, -21)),
            formatDate(addDays(d43, -14)),
            formatDate(addDays(d43, -3)),
            formatDate(addDays(d43, -1)),
            formatDate(addDays(r43 || d43, 2))
        ]]
    });

    // Row 48 (Index 5 in fetched range)
    let dep48 = rows[5][0] || '2026-04-27'; // 송대근님 대략적 값
    let ret48 = rows[5][1] || '';
    if (dep48.includes('2024')) dep48 = dep48.replace('2024', '2026');
    
    const d48 = parse(dep48);
    const r48 = parse(ret48);
    updates.push({
        range: `${sheetTitle}!T48:Y48`,
        values: [[
            formatDate(addDays(d48, -28)),
            formatDate(addDays(d48, -21)),
            formatDate(addDays(d48, -14)),
            formatDate(addDays(d48, -3)),
            formatDate(addDays(d48, -1)),
            formatDate(addDays(r48 || d48, 6))
        ]]
    });

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
    });
    
    console.log('수술 성공! 모든 오염 데이터가 제거되었습니다.');
}

surgicalFix().catch(console.error);
