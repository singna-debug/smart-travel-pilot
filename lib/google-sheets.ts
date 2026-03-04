import { google } from 'googleapis';
import { ConsultationData } from '@/types';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';

// 환경변수에서 보이지 않는 제어 문자(\r, \n 등)를 제거하는 헬퍼
function cleanEnv(key: string): string | undefined {
    const val = process.env[key];
    if (!val) return undefined;
    return val.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// 한국 시간(KST, UTC+9) 반환 헬퍼
function getKSTDate(): Date {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 9 * 60 * 60000);
}

// Google Sheets 클라이언트 초기화
// 캐시 데이터 전역 변수 (모듈 스코프)
let cachedConsultations: ConsultationData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 60초

function getGoogleSheetsClient() {
    try {
        let auth;

        // 방법 1: JSON 파일 직접 읽기 (가장 안정적)
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        if (fs.existsSync(credentialsPath)) {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        // 방법 2: 환경변수 JSON (Vercel 등)
        if (!auth && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();

            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                jsonStr = jsonStr.substring(1, jsonStr.length - 1);
            }

            if (!jsonStr.startsWith('{')) {
                try {
                    jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
                } catch (e) {
                    console.error('[Google Sheets] Base64 decoding failed');
                }
            }

            try {
                // [Extreme Clean] 모든 제어 문자(ASCII 0-31, 127) 제거.
                const cleanJson = jsonStr
                    .replace(/[\x00-\x1F\x7F]/g, '')
                    .trim();

                const credentials = JSON.parse(cleanJson);
                auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
            } catch (e: any) {
                console.error('[Google Sheets] JSON Parse Error (Env):', e.message);
                try {
                    const fallbackJson = jsonStr.replace(/\\n/g, '\n');
                    const credentials = JSON.parse(fallbackJson);
                    auth = new google.auth.GoogleAuth({
                        credentials,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                    });
                } catch (e2) {
                    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON 파싱 실패: ${e.message}`);
                }
            }
        }

        if (!auth) {
            throw new Error('Google 인증 정보를 찾을 수 없습니다. google-credentials.json 파일 또는 GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 필요합니다.');
        }

        const sheetsClient = google.sheets({ version: 'v4', auth });
        return sheetsClient;
    } catch (error: any) {
        console.error('[Google Sheets] 클라이언트 생성 오류:', error.message);
        throw error;
    }
}

/**
 * 시트명이 'Sheet1' 또는 '시트1' 등으로 다를 수 있어 동적으로 확인합니다.
 */
async function getSheetTitles(sheets: any, spreadsheetId: string) {
    try {
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = response.data.sheets || [];

        let consultationsSheet = 'Sheet1';
        let consultationsGid = 0;
        let messagesSheet = 'Messages';
        let messagesGid = 0;

        // 월별 시트 목록 및 GID 매핑
        const monthlySheets: string[] = [];
        const monthGids: Record<string, number> = {};
        const monthPattern = /^\d{4}-\d{2}$/;

        sheetList.forEach((s: any) => {
            const title = s.properties.title;
            const gid = s.properties.sheetId;

            if (monthPattern.test(title)) {
                monthlySheets.push(title);
                monthGids[title] = gid;
            }

            if (title === '시트1' || title === 'Sheet1') {
                consultationsSheet = title;
                consultationsGid = gid;
            }

            if (title === 'Messages' || title === '대화내역' || title === '메시지') {
                messagesSheet = title;
                messagesGid = gid;
            }
        });

        // 월별 시트가 있으면 가장 최신 달을 기본 상담 시트로 설정
        if (monthlySheets.length > 0) {
            monthlySheets.sort().reverse();
            consultationsSheet = monthlySheets[0];
            consultationsGid = monthGids[consultationsSheet] || 0;
        }

        return { consultationsSheet, consultationsGid, messagesSheet, messagesGid, monthlySheets, monthGids, sheetList };
    } catch (e) {
        return { consultationsSheet: 'Sheet1', consultationsGid: 0, monthlySheets: [], monthGids: {}, sheetList: [] };
    }
}

/**
 * 특정 월의 시트 GID를 가져옵니다.
 */
export async function getMonthSheetGid(month?: string): Promise<number> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');
        if (!sheetId) return 0;

        const targetMonth = month || format(new Date(), 'yyyy-MM');
        const { monthGids } = await getSheetTitles(sheets, sheetId);

        return (monthGids as Record<string, number>)[targetMonth] || 0;
    } catch (error) {
        return 0;
    }
}

/**
 * 특정 월의 시트를 가져오거나 없으면 생성합니다.
 */
async function getOrCreateMonthlySheet(sheets: any, spreadsheetId: string, month: string) {
    try {
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = response.data.sheets || [];
        const existingSheet = sheetList.find((s: any) => s.properties.title === month);

        if (existingSheet) {
            return { title: month, gid: existingSheet.properties.sheetId };
        }

        // '시트1' 또는 'Sheet1'이 있고, 목표하는 시트(month)가 없으면 '시트1'을 이름 변경 시도
        const defaultSheet = sheetList.find((s: any) => s.properties.title === '시트1' || s.properties.title === 'Sheet1');
        if (defaultSheet) {
            // 해당 시트의 내용을 확인하여 비어있으면 이름 변경 (실제 구현에선 안전을 위해 이름 변경만 수행하거나 새로 생성)
            // 여기서는 사용자 요청에 따라 이름 변경을 우선 시도
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        updateSheetProperties: {
                            properties: {
                                sheetId: defaultSheet.properties.sheetId,
                                title: month,
                            },
                            fields: 'title',
                        }
                    }]
                }
            });
            console.log(`[Google Sheets] '${defaultSheet.properties.title}'를 '${month}'로 변경했습니다.`);
            return { title: month, gid: defaultSheet.properties.sheetId };
        }

        // 시트가 없으면 신규 생성
        const addSheetResponse = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: month }
                    }
                }]
            }
        });

        const newSheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;

        // 헤더 초기화
        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '팔로업일', '잔금기한', '안내발송일', '유입경로'
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${month}!A1:O1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [consultationHeaders] },
        });

        await applyDropdownValidation(sheets, spreadsheetId, newSheetId);

        return { title: month, gid: newSheetId };
    } catch (error) {
        console.error(`[Google Sheets] 월별 시트(${month}) 처리 오류:`, error);
        throw error;
    }
}

/**
 * 상담단계 열(K열)에 드롭다운 데이터 유효성 검사를 추가합니다.
 */
async function applyDropdownValidation(sheets: any, spreadsheetId: string, sheetGid: number) {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        setDataValidation: {
                            range: {
                                sheetId: sheetGid,
                                startRowIndex: 1, // 헤더 다음 줄부터
                                startColumnIndex: 10, // K 열
                                endColumnIndex: 11,
                            },
                            rule: {
                                condition: {
                                    type: 'ONE_OF_LIST',
                                    values: [
                                        { userEnteredValue: '상담중' },
                                        { userEnteredValue: '견적제공' },
                                        { userEnteredValue: '예약확정' },
                                        { userEnteredValue: '결제완료' },
                                        { userEnteredValue: '취소/보류' }
                                    ]
                                },
                                showCustomUi: true,
                                strict: false
                            }
                        }
                    }
                ]
            }
        });
    } catch (error) {
        console.error(`[Google Sheets] 드롭다운 적용 오류 (GID: ${sheetGid}):`, error);
    }
}

/**
 * 12개월분 시트를 미리 생성합니다.
 */
export async function preCreateMonthlySheets(year?: string): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');
        if (!sheetId) return false;

        const targetYear = year || format(new Date(), 'yyyy');
        const months = Array.from({ length: 12 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, '0')}`);

        console.log(`[Google Sheets] ${targetYear}년도 12개월 시트 생성을 시작합니다...`);

        for (const month of months) {
            await getOrCreateMonthlySheet(sheets, sheetId, month);
        }

        console.log(`[Google Sheets] ${targetYear}년도 시트 생성 완료`);
        return true;
    } catch (error) {
        console.error('[Google Sheets] 월별 시트 일괄 생성 실패:', error);
        return false;
    }
}

/**
 * 상담 데이터를 Google Sheets에 추가합니다.
 */
export async function appendConsultationToSheet(data: ConsultationData): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const currentMonth = format(getKSTDate(), 'yyyy-MM');
        const { title: targetSheet } = await getOrCreateMonthlySheet(sheets, sheetId, currentMonth);

        const timestamp = format(getKSTDate(), 'yyyy-MM-dd HH:mm:ss');

        // 시트에 추가할 행 데이터 (이미지 기준 순서 조정)
        const row = [
            timestamp,                          // A: 상담일시
            data.customer.name,                 // B: 고객성함
            data.customer.phone,                // C: 연락처
            data.trip.destination,              // D: 목적지
            data.trip.departure_date,           // E: 출발일
            data.trip.return_date || '',        // F: 귀국일 (New)
            data.trip.duration || '',           // G: 기간 (New)
            data.trip.product_name,             // H: 상품명
            data.trip.url,                      // I: 상품URL
            data.summary || '',                 // J: 상담요약
            data.automation.status,             // K: 상담단계
            data.automation.next_followup,      // L: 팔로업일
            data.automation.balance_due_date,   // M: 잔금기한
            data.automation.notice_date,        // N: 안내발송일
            data.source || '카카오톡',           // O: 유입경로 (기본값 카카오톡)
            data.visitor_id || '',              // P: visitor_id
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${targetSheet}!A:O`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row],
            },
        });

        console.log(`상담 데이터가 Google Sheets (${targetSheet})에 기록되었습니다.`);
        cachedConsultations = null; // 캐시 초기화
        return true;
    } catch (error) {
        console.error('Google Sheets 기록 오류:', error);
        return false;
    }
}

/**
 * 상담 데이터를 Google Sheets에 추가하거나 업데이트(Upsert)합니다.
 * 순서 보장을 위해 기존 행이 있으면 삭제하고 맨 아래(최신)에 새로 추가합니다.
 */
export async function upsertConsultationToSheet(data: ConsultationData): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const log = (msg: string) => {
            console.log(msg);
        };

        const { monthlySheets, consultationsSheet: fallbackSheet, consultationsGid: fallbackGid } = await getSheetTitles(sheets, sheetId);

        // 검색할 시트 목록 (월별 시트 + 기본 시트)
        const sheetsToSearch = monthlySheets.length > 0 ? monthlySheets : [fallbackSheet];

        let foundRow: any[] | null = null;
        let foundSheet = '';
        let foundGid = 0;
        let foundRowIndex = -1;
        let oldDestination = '';

        // 성함 또는 연락처로 매칭
        const safePhone = data.customer.phone || '';
        const targetPhone = safePhone.replace(/[^0-9]/g, ''); // 숫자만 남김
        log(`[Upsert] 탐색 시작 (${data.customer.name}, ${targetPhone})`);

        // 모든 시트를 돌며 최신 매칭 항목 찾기
        for (const sheetTitle of sheetsToSearch) {
            const resp = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sheetTitle}!A:O`,
            });
            const rows = resp.data.values || [];

            for (let i = rows.length - 1; i >= 1; i--) {
                const row = rows[i];
                const rowVisitorId = (row[15] || '').trim(); // P열: visitor_id
                const rowName = (row[1] || '').trim();
                const rowPhone = (row[2] || '').replace(/[^0-9]/g, '');

                let matched = false;
                // 1순위: visitor_id 일치
                if (data.visitor_id && rowVisitorId === data.visitor_id) matched = true;
                // 2순위: 연락처 일치
                else if (targetPhone && targetPhone.length > 5 && rowPhone === targetPhone) matched = true;
                // 3순위: 성함 일치 (연락처가 없을 때만)
                else if (data.customer.name !== '미정' && rowName === data.customer.name && (!targetPhone || targetPhone.length <= 5)) matched = true;

                if (matched) {
                    foundRow = row;
                    foundSheet = sheetTitle;
                    foundRowIndex = i + 1;
                    oldDestination = row[3] || '';

                    // GID 찾기 위해 다시 조회 (or sheetTitle이 '시트1'이면 fallbackGid 사용)
                    if (sheetTitle === fallbackSheet) foundGid = fallbackGid;
                    else {
                        const sInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
                        const s = sInfo.data.sheets?.find((s: any) => s.properties.title === sheetTitle);
                        foundGid = s?.properties?.sheetId || 0;
                    }
                    break;
                }
            }
            if (foundRow) break;
        }

        // 여행지 변경 확인 및 요약 업데이트
        let updatedSummary = data.summary || '';
        if (oldDestination && data.trip.destination && oldDestination !== data.trip.destination) {
            const historyNote = `[이력: 전에는 ${oldDestination} 여행지를 고려했었다]`;
            if (!updatedSummary.includes(historyNote)) {
                updatedSummary = `${updatedSummary} ${historyNote}`.trim();
            }
        }

        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        const newRow = [
            timestamp,                          // A: 상담일시
            data.customer.name,                 // B: 고객성함
            data.customer.phone,                // C: 연락처
            data.trip.destination,              // D: 목적지
            data.trip.departure_date,           // E: 출발일
            data.trip.return_date || '',        // F: 귀국일
            data.trip.duration || '',           // G: 기간
            data.trip.product_name,             // H: 상품명
            data.trip.url,                      // I: 상품URL
            updatedSummary,                     // J: 상담요약
            data.automation.status,             // K: 상담단계
            data.automation.next_followup,      // L: 팔로업일
            data.automation.balance_due_date,   // M: 잔금기한
            data.automation.notice_date,        // N: 안내발송일
            data.source || '카카오톡',           // O: 유입경로
            data.visitor_id || '',              // P: visitor_id
        ];

        // 2. 행 삭제
        if (foundRowIndex > 0) {
            log(`[Upsert] 기존 데이터 발견: ${foundSheet}, 행 ${foundRowIndex}. 삭제 실행.`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: foundGid,
                                dimension: 'ROWS',
                                startIndex: foundRowIndex - 1,
                                endIndex: foundRowIndex,
                            },
                        },
                    }],
                },
            });
        }

        // 3. 새 데이터 추가 (현재 월 시트에)
        const currentMonth = format(new Date(), 'yyyy-MM');
        const { title: targetSheet } = await getOrCreateMonthlySheet(sheets, sheetId, currentMonth);

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${targetSheet}!A:O`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        });
        log(`[Upsert] 새 데이터 추가 완료 (${targetSheet})`);
        cachedConsultations = null; // 캐시 초기화
        return true;
    } catch (error: any) {
        // Simple console error is not enough, try to write to log file too
        try {
            console.error('[Upsert Error]', error);
        } catch { }
        console.error('Google Sheets Upsert 치명적 오류:', error.message);
        return false;
    }
}

/**
 * 시트 헤더를 초기화합니다 (Consultations & Messages)
 */
export async function initializeSheetHeaders(): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('❌ GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        console.log(`📊 시트 초기화 시도 중... (ID: ${sheetId.substring(0, 5)}...)`);

        // 1. 상담 요약 시트 (사용자 맞춤 순서)
        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '팔로업일', '잔금기한', '안내발송일', '유입경로'
        ];

        // 2. 메시지 로그 시트
        const messageHeaders = [
            '일시', '사용자ID', '발신자', '내용'
        ];

        // 12개월 시트 생성
        await preCreateMonthlySheets();

        const { consultationsSheet, consultationsGid, messagesSheet, messagesGid, monthlySheets, monthGids } = await getSheetTitles(sheets, sheetId);

        // Messages 시트가 없으면 생성
        let targetMessagesSheet = messagesSheet;
        if (!messagesGid) {
            console.log('➕ Messages 시트 생성 중...');
            try {
                const addSheetResponse = await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: {
                        requests: [{
                            addSheet: { properties: { title: 'Messages' } }
                        }]
                    }
                });
                targetMessagesSheet = 'Messages';
            } catch (e) {
                console.error('Messages 시트 생성 실패 (이미 존재할 수 있음)');
            }
        }

        // 상담 요약 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A1:O1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [consultationHeaders] },
        });

        // 메시지 로그 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${targetMessagesSheet}!A1:D1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [messageHeaders] },
        });

        // 모든 시트에 드롭다운 적용
        const dropdownRequests: any[] = [];
        const gidsToUpdate = new Set<number>();
        if (consultationsGid) gidsToUpdate.add(consultationsGid);
        for (const m of monthlySheets) {
            const gid = (monthGids as Record<string, number>)[m];
            if (gid !== undefined) gidsToUpdate.add(gid);
        }

        for (const gid of gidsToUpdate) {
            dropdownRequests.push({
                setDataValidation: {
                    range: {
                        sheetId: gid,
                        startRowIndex: 1, // 헤더 다음 줄부터
                        startColumnIndex: 10, // K 열 (상담단계)
                        endColumnIndex: 11,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '상담중' },
                                { userEnteredValue: '견적제공' },
                                { userEnteredValue: '예약확정' },
                                { userEnteredValue: '결제완료' },
                                { userEnteredValue: '상담완료' },
                                { userEnteredValue: '취소/보류' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            });
        }

        if (dropdownRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: { requests: dropdownRequests }
            });
            console.log(`✅ 모든 시트 상담단계(K열) 드롭다운 적용 완료`);
        }

        console.log(`✅ ${consultationsSheet} (상담 요약) 헤더 초기화 완료`);

        return true;
    } catch (error: any) {
        console.error('❌ 시트 헤더 초기화 치명적 오류:', error.message);
        if (error.message?.includes('403') || error.message?.includes('permission')) {
            console.error('👉 해결방법: 구글 시트 우측 상단 [공유] 클릭 -> 서비스 계정 이메일을 추가하고 [편집자] 권한을 주세요.');
            console.error(`📧 서비스 계정: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
        }
        return false;
    }
}

/**
 * 대화 메시지를 Google Sheets에 개별적으로 기록합니다.
 */
export async function appendMessageToSheet(visitorId: string, sender: 'user' | 'assistant', content: string): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');
        if (!sheetId) return false;

        const { messagesSheet } = await getSheetTitles(sheets, sheetId);
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${messagesSheet}!A:D`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [[timestamp, visitorId, sender, content]]
            }
        });

        return true;
    } catch (error) {
        console.error('메시지 시트 기록 오류:', error);
        return false;
    }
}

/**
 * 특정 고객의 상담 이력을 조회합니다.
 */
export async function getConsultationHistory(customerPhone: string): Promise<ConsultationData[]> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) return [];

        const { monthlySheets, consultationsSheet: fallbackSheet } = await getSheetTitles(sheets, sheetId);
        const sheetsToSearch = monthlySheets.length > 0 ? monthlySheets : [fallbackSheet];
        const history: ConsultationData[] = [];

        for (const sName of sheetsToSearch) {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sName}!A:O`,
            });

            const rows = response.data.values || [];

            // 첫 번째 행(헤더)은 제외
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[2] === customerPhone) { // 연락처(C)로 매칭
                    history.push({
                        customer: {
                            name: row[1] || '미정',
                            phone: row[2] || '미정',
                        },
                        trip: {
                            destination: row[3] || '',
                            departure_date: row[4] || '',
                            return_date: row[5] || '',    // F column
                            duration: row[6] || '',       // G column
                            product_name: row[7] || '',   // H column
                            url: row[8] || '',            // I column
                        },
                        summary: row[9] || '',            // J column
                        automation: {
                            status: row[10] as ConsultationData['automation']['status'] || '상담중', // K column
                            next_followup: row[11] || '',      // L column
                            balance_due_date: row[12] || '',   // M column
                            notice_date: row[13] || '',        // N column
                        },
                        source: row[14] || '',               // O column
                        timestamp: row[0],
                        sheetName: sName,
                        sheetRowIndex: i + 1,
                        visitor_id: '',
                    });
                }
            }
        }

        // 오래된순 정렬 (상담일시 기준) - 사용자가 신규상담이 밑으로 내려가길 원함
        history.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

        return history;
    } catch (error) {
        console.error('상담 이력 조회 오류:', error);
        return [];
    }
}

/**
 * 모든 상담 내역을 조회합니다 (대시보드용).
 */
/**
 * 모든 상담 내역을 조회합니다 (대시보드용).
 * 성능 최적화를 위해 1분간 캐싱합니다.
 */
export async function getAllConsultations(forceRefresh = false): Promise<ConsultationData[]> {
    try {
        // 캐시 유효성 확인
        if (!forceRefresh && cachedConsultations && (Date.now() - lastFetchTime < CACHE_DURATION)) {
            // console.log('[Google Sheets] 캐시된 상담 목록 반환');
            return cachedConsultations;
        }

        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            return [];
        }

        const { monthlySheets, consultationsSheet: fallbackSheet, sheetList } = await getSheetTitles(sheets, sheetId);

        // 모든 월별 시트 + 기본 시트에서 데이터 수집
        const sheetsToRead = monthlySheets.length > 0 ? monthlySheets : [fallbackSheet];
        const allRows: any[] = [];

        for (const sName of sheetsToRead) {
            const resp = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sName}!A:O`,
            });
            const rows = resp.data.values || [];
            if (rows.length > 1) {
                // 헤더 제외하고 시트명 포함하여 저장
                for (let i = 1; i < rows.length; i++) {
                    const row: any = rows[i];
                    row._sheetName = sName;
                    row._rowIndex = i + 1;
                    row._sheetGid = sheetList.find((s: any) => s.properties.title === sName)?.properties?.sheetId || 0;
                    allRows.push(row);
                }
            }
        }

        const consultations: ConsultationData[] = [];
        const processedKeys = new Set<string>();

        // 최신순 정렬 (상담일시 기준) - 중복 제거 시 최신 데이터를 남기기 위함
        allRows.sort((a, b) => {
            const dateA = new Date(a[0] || 0).getTime();
            const dateB = new Date(b[0] || 0).getTime();
            return dateB - dateA;
        });

        for (const row of allRows) {
            if (!row[1] && !row[2]) continue;

            const name = row[1] || '미정';
            const phone = row[2] || '미정';
            const uniqueKey = phone !== '미정' ? `${name}-${phone}` : name;

            if (processedKeys.has(uniqueKey)) continue;
            processedKeys.add(uniqueKey);

            consultations.push({
                timestamp: row[0],
                customer: { name, phone },
                trip: {
                    destination: row[3] || '',
                    departure_date: row[4] || '',
                    return_date: row[5] || '',
                    duration: row[6] || '',
                    product_name: row[7] || '',
                    url: row[8] || '',
                },
                summary: row[9] || '',
                automation: {
                    status: (row[10] as ConsultationData['automation']['status']) || '상담중',
                    next_followup: row[11] || '',
                    balance_due_date: row[12] || '',
                    notice_date: row[13] || '',
                },
                source: row[14] || '',
                sheetRowIndex: row._rowIndex,
                sheetName: row._sheetName,
                sheetGid: row._sheetGid,
                visitor_id: '',
            });
        }

        // 캐시 업데이트
        cachedConsultations = consultations;
        lastFetchTime = Date.now();

        return consultations;
    } catch (error) {
        console.error('전체 상담 조회 오류:', error);
        return cachedConsultations || []; // 오류 시 이전 캐시라도 반환
    }
}

/**
 * 특정 사용자의 대화 내역 전체를 조회합니다 (시트 기반).
 */
export async function getMessagesByVisitorId(visitorId: string): Promise<any[]> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');
        if (!sheetId) return [];

        const { messagesSheet } = await getSheetTitles(sheets, sheetId);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${messagesSheet}!A:D`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        // 헤더 제외하고 visitorId로 필터링
        const filtered = rows.slice(1)
            .filter(row => row[1] === visitorId)
            .map(row => ({
                timestamp: row[0],
                visitorId: row[1],
                role: row[2], // 'user' or 'assistant'
                content: row[3]
            }));

        return filtered;
    } catch (error) {
        console.error('메시지 조회 오류:', error);
        return [];
    }
}

/**
 * 모든 메시지 로그를 조회합니다 (대시보드 통계용).
 */
export async function getAllMessages(): Promise<any[]> {
    return [];
}

/**
 * Google Sheets에서 특정 행을 삭제합니다.
 */
export async function deleteConsultationFromSheet(rowIndex: number, sheetName?: string): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        // 시트명 확인
        const targetSheetName = sheetName || '시트1';
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties.title === targetSheetName);
        const sheetGid = sheet?.properties?.sheetId || 0;

        // 행 삭제 요청
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetGid,
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1, // 0-indexed
                                endIndex: rowIndex,       // exclusive
                            },
                        },
                    },
                ],
            },
        });

        console.log(`[Google Sheets] ${targetSheetName} 행 ${rowIndex} 삭제 완료`);
        cachedConsultations = null; // 캐시 초기화
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 삭제 오류:', error.message);
        return false;
    }
}

/**
 * Google Sheets에서 특정 상담의 상태를 업데이트합니다.
 */
export async function updateConsultationStatus(rowIndex: number, status: string, sheetName?: string): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const targetSheetName = sheetName || '시트1';

        // K열(11번째)이 상담단계 컬럼
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${targetSheetName}!K${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[status]],
            },
        });

        console.log(`[Google Sheets] ${targetSheetName} 행 ${rowIndex} 상태 업데이트: ${status}`);
        cachedConsultations = null; // 캐시 초기화
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 상태 업데이트 오류:', error.message);
        return false;
    }
}
