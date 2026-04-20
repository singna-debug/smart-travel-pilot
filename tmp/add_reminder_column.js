
const { google } = require('googleapis');
const fs = require('fs');

async function addReminderColumn() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const doc = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = doc.data.sheets;
    
    for (const sheet of sheetList) {
        const title = sheet.properties.title;
        if (!/^\d{4}-\d{2}$/.test(title)) continue;
        
        console.log(`[${title}] AB열(특정날 리마인드) 추가 중...`);
        
        // AB1은 28번째 컬럼입니다. 0-based index로는 27입니다.
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${title}!A1:AB1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { 
                values: [
                    ['날짜', '성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '등록방식', '팔로업일', '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id', 'inquiry_info_backup', '특정날 리마인드']
                ]
            }
        });
    }
    console.log('모든 월별 시트 헤더 업데이트 완료.');
}

addReminderColumn().catch(console.error);
