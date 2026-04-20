
const { google } = require('googleapis');
const fs = require('fs');

async function bulkFix2024Dates() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const doc = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = doc.data.sheets;
    
    console.log('전체 시트 2024년 오염 데이터 복구 시작...');

    for (const sheet of sheetList) {
        const title = sheet.properties.title;
        if (!/^\d{4}-\d{2}$/.test(title)) continue;
        
        console.log(`[${title}] 스캔 중...`);
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${title}!A1:AB1000`,
        });
        
        const rows = resp.data.values || [];
        if (rows.length <= 1) continue;

        const updates = [];
        let sheetFixCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const departureDateStr = row[7] || ''; // H: 출발일
            const returnDateStr = row[8] || '';    // I: 귀국일
            
            // 2025년~2027년 사이의 미래 출발인지 확인
            if (!departureDateStr.includes('2025') && !departureDateStr.includes('2026') && !departureDateStr.includes('2027')) continue;

            // T(19) ~ Y(24) 중 하나라도 2024년이 포함되어 있는지 확인
            let isContaminated = false;
            for (let j = 19; j <= 24; j++) {
                if (row[j] && row[j].includes('2024')) {
                    isContaminated = true;
                    break;
                }
            }

            if (isContaminated) {
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
                        // 귀국일 없으면 대략 출발 + 4일로 계산 (안전 보조)
                        happyCall = formatDate(addDays(depDate, 6));
                    }

                    updates.push({
                        range: `${title}!T${i+1}:Y${i+1}`,
                        values: [[noticeDate, balanceDate, confirmationSent, departureNotice, phoneNotice, happyCall]]
                    });
                    sheetFixCount++;
                }
            }
        }

        if (updates.length > 0) {
            console.log(`  [${title}] ${sheetFixCount}개 행 복구 대상 발견. 업데이트 실행...`);
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
        }
    }
    console.log('모든 시트 데이터 복구 프로세스 완료.');
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

bulkFix2024Dates().catch(console.error);
