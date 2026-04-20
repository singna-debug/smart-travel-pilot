
const { google } = require('googleapis');
const fs = require('fs');

async function fixMoonData() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    // 문성필: Row 15 (index 14)
    // 컬럼 매핑:
    // T(19): notice_date, U(20): balance_date, V(21): confirmation_sent
    // W(22): departure_notice, X(23): phone_notice, Y(24): happy_call
    
    const dates = [
        '2026-04-15', // T: 출발전안내(4주)
        '2026-04-22', // U: 잔금일
        '2026-04-29', // V: 확정서 발송
        '2026-05-10', // W: 출발안내
        '2026-05-12', // X: 전화 안내
        '2026-05-19'  // Y: 해피콜
    ];
    
    console.log('[문성필] 날짜 데이터 복구 중...');
    
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '2026-04!T15:Y15',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [dates] }
    });
    
    console.log('데이터 수정 완료!');
}

fixMoonData().catch(console.error);
