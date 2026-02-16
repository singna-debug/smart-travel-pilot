const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function getEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split(/\r?\n/).forEach(line => {
        const firstEq = line.indexOf('=');
        if (firstEq !== -1) {
            const key = line.substring(0, firstEq).trim();
            let value = line.substring(firstEq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            env[key] = value;
        }
    });
    return env;
}

const env = getEnv();
const sheetId = env.GOOGLE_SHEET_ID;
// JSON 파일 경로 (사용자 다운로드 폴더에서 발견된 것)
const jsonPath = 'C:/Users/vbxn6/Downloads/gen-lang-client-0510450295-55288ee74e9f.json';

async function init() {
    if (!sheetId) {
        console.error('❌ GOOGLE_SHEET_ID가 설정되지 않았습니다.');
        return;
    }

    console.log('🚀 구글 시트 초기화 시작 (JSON 파일 방식)...');

    try {
        let auth;
        if (fs.existsSync(jsonPath)) {
            console.log(`✅ JSON 파일을 사용합니다: ${jsonPath}`);
            const keyFile = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            auth = new google.auth.JWT({
                email: keyFile.client_email,
                key: keyFile.private_key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else {
            console.log('⚠️ JSON 파일을 찾을 수 없어 .env.local을 사용합니다.');
            const privateKey = env.GOOGLE_PRIVATE_KEY ? env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '') : null;
            auth = new google.auth.JWT({
                email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        const sheets = google.sheets({ version: 'v4', auth });

        // 현재 시트 목록 가져오기
        console.log('🔍 시트 목록 조회 중...');
        const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetList = res.data.sheets || [];

        let consultationsSheet = 'Sheet1';
        let messagesSheet = 'Sheet2';

        sheetList.forEach(s => {
            const title = s.properties.title;
            if (title === '시트1') consultationsSheet = '시트1';
            if (title === '시트2') messagesSheet = '시트2';
        });

        console.log(`📊 감지된 시트명: ${consultationsSheet}, ${messagesSheet}`);

        const consultationHeaders = [
            '상담일시', '사용자ID', '고객성함', '연락처', '목적지', '상품명', '출발일', '상품URL', '상담단계', '잔금기한', '안내발송일', '팔로업일', '상담요약'
        ];

        const messageHeaders = [
            '일시', '사용자ID', '발신자', '내용'
        ];

        console.log(`📝 ${consultationsSheet} 헤더 작성 중...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A1:M1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [consultationHeaders] },
        });

        console.log(`📝 ${messagesSheet} 헤더 작성 중...`);
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${messagesSheet}!A1:D1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [messageHeaders] },
            });
        } catch (e) {
            console.warn(`⚠️ ${messagesSheet} 업데이트 실패 (정상일 수 있음)`);
        }

        console.log('🎉 모든 헤더 작성이 완료되었습니다!');

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        if (error.message.includes('403') || error.message.includes('permission')) {
            console.log('\n👉 해결방법: 구글 시트에서 [공유]를 누르고 서비스 계정 이메일에 [편집자] 권한을 주세요!');
        }
    }
}

init();
