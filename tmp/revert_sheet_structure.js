
const { google } = require('googleapis');
const fs = require('fs');

async function revertSheetStructure() {
    const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '17aVvFt29xlEvW5na0zvqN7B5HPOqxt55AzFJuabn2fk';
    
    const doc = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = doc.data.sheets;
    
    console.log('시트 구조 원복 시작 (AA열 삭제)...');
    
    const requests = [];
    for (const sheet of sheetList) {
        const title = sheet.properties.title;
        const sheetId = sheet.properties.sheetId;
        
        // 월별 시트만 대상
        if (!/^\d{4}-\d{2}$/.test(title)) continue;
        
        console.log(`[${title}] 처리 중...`);
        
        // AA열 (index 26) 삭제
        requests.push({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 26,
                    endIndex: 27
                }
            }
        });
        
        // 헤더 표준화 (A-AA, 27개 컬럼)
        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '등록방식', '팔로업일',
            '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id', 'inquiry_info_backup'
        ];
        
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${title}!A1:AA1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [consultationHeaders] }
        });
    }
    
    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        console.log('모든 시트 구조 원복 완료.');
    }
}

revertSheetStructure().catch(console.error);
