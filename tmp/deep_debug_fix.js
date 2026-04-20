
const { google } = require('googleapis');
const fs = require('fs');

async function debugAndFix() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    const sheetTitle = '2026-04';
    
    console.log(`[DEBUG] ${sheetTitle} 데이터 직접 분석 중...`);
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:Z60`, // 60행까지 정밀 분석
    });
    
    const rows = resp.data.values || [];
    const updates = [];
    const targets = ['문성필', '강대순', '송대근'];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[1] || '';
        const t2y = row.slice(19, 25).join(' | ');
        
        console.log(`Row ${i+1} (${name}): T-Y=[${t2y}]`);

        let needsFix = targets.some(t => name.includes(t));
        for (let j = 19; j <= 24; j++) {
            if (row[j] && String(row[j]).includes('2024')) {
                needsFix = true;
                break;
            }
        }

        if (needsFix) {
            let depStr = row[7] || '';
            let retStr = row[8] || '';

            // 출발일이 2024면 2026으로 보정
            if (depStr.includes('2024')) depStr = depStr.replace('2024', '2026');
            if (retStr.includes('2024')) retStr = retStr.replace('2024', '2026');
            
            // 만약 출발일이 아예 없으면 상담요약이나 시트 제목 참고
            if (!depStr || depStr.length < 5) depStr = '2026-05-13'; // 문성필 기준 안전값

            const depDate = new Date(depStr.split(' ')[0].replace(/\./g, '-'));
            if (!isNaN(depDate.getTime())) {
                const addDays = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };
                const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

                const n = formatDate(addDays(depDate, -28));
                const b = formatDate(addDays(depDate, -21));
                const c = formatDate(addDays(depDate, -14));
                const d = formatDate(addDays(depDate, -3));
                const p = formatDate(addDays(depDate, -1));
                const h = formatDate(addDays(depDate, 6));

                updates.push({
                    range: `${sheetTitle}!T${i+1}:Y${i+1}`,
                    values: [[n, b, c, d, p, h]]
                });
                console.log(`  [MATCH] Row ${i+1} 수정 예약됨.`);
            }
        }
    }

    if (updates.length > 0) {
        console.log(`${updates.length}건 업데이트 실행...`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
        });
        console.log('완성!');
    } else {
        console.log('수정할 대상을 하나도 못 찾았습니다. 로직 점검 필요.');
    }
}

debugAndFix().catch(console.error);
