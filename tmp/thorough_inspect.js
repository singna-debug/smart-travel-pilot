
const { google } = require('googleapis');
const fs = require('fs');

async function inspectSpecial() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    // 2026-04 시트 전체 데이터 (넉넉하게 읽기)
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: '2026-04!A1:AB100',
    });
    
    const rows = resp.data.values || [];
    const targets = ['송대근', '강대순', '문성필'];
    
    console.log('--- 정밀 점검 결과 ---');
    rows.forEach((row, i) => {
        const name = row[1] || '';
        // 타겟 고객이거나 2024년 날짜가 있는 경우만 출력
        let has2024 = false;
        for (let j = 18; j <= 25; j++) {
            if (row[j] && String(row[j]).includes('2024')) {
                has2024 = true;
                break;
            }
        }

        if (targets.some(t => name.includes(t)) || has2024) {
            console.log(`[Row ${i+1}] 성함: ${name}`);
            console.log(`  상태: ${row[13]} | 출발일: ${row[7]}`);
            console.log(`  날짜들(T-Y): ${row.slice(19, 25).join(' | ')}`);
            console.log(`  풀데이터 길이: ${row.length}`);
            console.log('-----------------------------');
        }
    });
}

inspectSpecial().catch(console.error);
