const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function initHeaders() {
    console.log('Initializing Sheet Headers...');

    const credentialsPath = path.resolve(__dirname, '../google-credentials.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    const envPath = path.resolve(__dirname, '../.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    let sheetId = '';
    envConfig.split('\n').forEach(line => {
        if (line.startsWith('GOOGLE_SHEET_ID=')) {
            sheetId = line.split('=')[1].trim();
        }
    });

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Updated headers with 귀국일 and 기간
    const headers = [
        '상담일시', '고객성함', '연락처', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '팔로업일', '잔금기한', '안내발송일'
    ];

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: '시트1!A1:N1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] },
        });
        console.log('✅ Headers Updated!');
        console.log('Columns:', headers.join(' | '));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

initHeaders();
