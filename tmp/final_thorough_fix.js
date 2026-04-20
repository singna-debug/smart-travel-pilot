
const { google } = require('googleapis');
const fs = require('fs');

async function finalThoroughFix() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const sheetTitle = '2026-04';
    console.log(`[${sheetTitle}] 정밀 일괄 복구 시작...`);
    
    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:AB1000`,
    });
    
    const rows = resp.data.values || [];
    if (rows.length <= 1) return;

    const updates = [];
    let fixCount = 0;
    const targetNames = ['송대근', '강대순', '문성필'];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const name = row[1] || '';
        const departureDateStr = row[7] || ''; // H: 출발일
        const returnDateStr = row[8] || '';    // I: 귀국일
        
        let shouldFix = false;

        // 이름 조건
        if (targetNames.some(t => name.includes(t))) {
            shouldFix = true;
        }

        // 2024년 날짜 포함 조건 (T~Y열)
        for (let j = 19; j <= 24; j++) {
            if (row[j] && String(row[j]).includes('2024')) {
                shouldFix = true;
                break;
            }
        }

        if (shouldFix && departureDateStr && (departureDateStr.includes('2026') || departureDateStr.includes('2025'))) {
            const depDate = parseDate(departureDateStr);
            const retDate = parseDate(returnDateStr);

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
                    happyCall = formatDate(addDays(depDate, 6)); // 귀국일 없으면 출발 + 6일
                }

                updates.push({
                    range: `${sheetTitle}!T${i+1}:Y${i+1}`,
                    values: [[noticeDate, balanceDate, confirmationSent, departureNotice, phoneNotice, happyCall]]
                });
                console.log(`  [Fix Target] Row ${i+1} (${name}): ${departureDateStr} 기준 복구 완료`);
                fixCount++;
            }
        }
    }

    if (updates.length > 0) {
        console.log(`총 ${fixCount}개 행 업데이트 실행 중...`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        console.log('업데이트 성공!');
    } else {
        console.log('복구할 항목을 찾지 못했습니다.');
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

finalThoroughFix().catch(console.error);
