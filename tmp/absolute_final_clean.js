
const { google } = require('googleapis');
const fs = require('fs');

async function absoluteFinalClean() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const sheetTitle = '2026-04';
    console.log(`[${sheetTitle}] 2024 -> 2026 강제 변환 시작...`);
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:AB1000`,
    });
    
    const rows = resp.data.values || [];
    if (rows.length <= 1) return;

    const updates = [];
    let fixCount = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 8) continue;

        let has2024Error = false;
        // 일정 칸(T~Y: 19~24) 검사
        for (let j = 19; j <= 24; j++) {
            if (row[j] && String(row[j]).includes('2024')) {
                has2024Error = true;
                break;
            }
        }

        if (has2024Error) {
            let depStr = row[7] || ''; // H: 출발일
            let retStr = row[8] || ''; // I: 귀국일

            // 출발일이 2024년이면 2026년으로 강제 변경
            if (depStr.includes('2024')) {
                depStr = depStr.replace('2024', '2026');
            }
            if (retStr.includes('2024')) {
                retStr = retStr.replace('2024', '2026');
            }

            const depDate = parseDate(depStr);
            const retDate = parseDate(retStr);

            if (depDate) {
                const noticeDate = formatDate(addDays(depDate, -28));
                const balanceDate = formatDate(addDays(depDate, -21));
                const confirmationSent = formatDate(addDays(depDate, -14));
                const departureNotice = formatDate(addDays(depDate, -3));
                const phoneNotice = formatDate(addDays(depDate, -1));
                let happyCall = '';
                
                if (retDate) {
                    happyCall = formatDate(addDays(retDate, 2));
                } else {
                    happyCall = formatDate(addDays(depDate, 6)); 
                }

                updates.push({
                    range: `${sheetTitle}!H${i+1}:Y${i+1}`, // H열부터 Y열까지 한꺼번에 업데이트
                    values: [[depStr, retStr, row[9], row[10], row[11], row[12], row[13], row[14], row[15], row[16], row[17], row[18], noticeDate, balanceDate, confirmationSent, departureNotice, phoneNotice, happyCall]]
                });
                console.log(`  [Fix] Row ${i+1} (${row[1]}): 2024년 오류 데이터 2026년으로 갱신`);
                fixCount++;
            }
        }
    }

    if (updates.length > 0) {
        console.log(`총 ${fixCount}개 행 수정 데이터 전송 중...`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        console.log('최종 복구 성공!');
    } else {
        console.log('수정할 2024년 데이터를 찾지 못했습니다.');
    }
}

// ── Helper Functions ──
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    let clean = dateStr.split(' ')[0].replace(/\./g, '-');
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
}

absoluteFinalClean().catch(console.error);
