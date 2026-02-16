import { google } from 'googleapis';
import { ConsultationData } from '@/types';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';

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
            // console.log('[Google Sheets] JSON 파일 인증 사용:', credentialsPath);
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        // 방법 2: 환경변수 JSON (Vercel 등)
        if (!auth && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();

            // 만약 따옴표로 감싸져 있다면 제거
            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                jsonStr = jsonStr.substring(1, jsonStr.length - 1);
            }

            // 리터럴 \n 및 \" 처리 (Vercel 환경변수 등에서 발생 가능)
            jsonStr = jsonStr.replace(/\\n/g, '\n').replace(/\\"/g, '"');

            if (!jsonStr.startsWith('{')) {
                jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
            }

            const credentials = JSON.parse(jsonStr);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        if (!auth) {
            throw new Error('Google 인증 정보를 찾을 수 없습니다. google-credentials.json 파일 또는 GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 필요합니다.');
        }

        const sheetsClient = google.sheets({ version: 'v4', auth });
        // console.log('[Google Sheets] 클라이언트 생성 성공');
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
        let messagesSheet = 'Sheet2';
        let consultationsGid = 0;
        let messagesGid = 0;

        sheetList.forEach((s: any) => {
            const title = s.properties.title;
            const gid = s.properties.sheetId;
            if (title === '시트1' || title === 'Sheet1') {
                consultationsSheet = title;
                consultationsGid = gid;
            }
            if (title === '시트2' || title === 'Sheet2') {
                messagesSheet = title;
                messagesGid = gid;
            }
        });

        return { consultationsSheet, messagesSheet, consultationsGid, messagesGid };
    } catch (e) {
        return { consultationsSheet: 'Sheet1', messagesSheet: 'Sheet2', consultationsGid: 0, messagesGid: 0 };
    }
}

/**
 * 상담 데이터를 Google Sheets에 추가합니다.
 */
export async function appendConsultationToSheet(data: ConsultationData): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const { consultationsSheet } = await getSheetTitles(sheets, sheetId);

        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

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
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A:L`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row],
            },
        });

        console.log('상담 데이터가 Google Sheets에 기록되었습니다.');
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
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const log = (msg: string) => {
            console.log(msg);
        };

        const { consultationsSheet, consultationsGid } = await getSheetTitles(sheets, sheetId);

        // 1. 기존 데이터 조회
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A:N`,
        });

        const rows = response.data.values || [];
        const rowsToDelete: number[] = []; // 삭제할 행 번호들 (1-based)
        let oldDestination = '';

        // 성함 또는 연락처로 매칭
        const safePhone = data.customer.phone || '';
        const targetPhone = safePhone.replace(/[^0-9]/g, ''); // 숫자만 남김
        log(`[Upsert] 탐색 시작 (${data.customer.name}, ${targetPhone})`);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowName = (row[1] || '').trim();
            const rowPhone = (row[2] || '').replace(/[^0-9]/g, '');

            let matched = false;
            // 1. 전화번호 매칭
            if (targetPhone && targetPhone.length > 5 && rowPhone === targetPhone) {
                matched = true;
                log(`[Upsert] 매칭 성공(전화번호) - 행: ${i + 1}`);
            }
            // 2. 이름 매칭
            else if (data.customer.name !== '미정' && rowName === data.customer.name && (!targetPhone || targetPhone.length <= 5)) {
                matched = true;
                log(`[Upsert] 매칭 성공(이름) - 행: ${i + 1}`);
            }

            if (matched) {
                rowsToDelete.push(i + 1);
                oldDestination = row[3] || '';
            }
        }

        // 여행지가 변경되었는지 확인 및 요약 업데이트
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
        ];

        // 2. 행 삭제 (역순으로 삭제해야 인덱스 꼬임 방지)
        if (rowsToDelete.length > 0) {
            rowsToDelete.sort((a, b) => b - a); // 내림차순 정렬
            log(`[Upsert] 삭제할 행 목록: ${rowsToDelete.join(', ')}`);

            const requests = rowsToDelete.map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId: consultationsGid,
                        dimension: 'ROWS',
                        startIndex: rowIndex - 1,
                        endIndex: rowIndex,
                    },
                },
            }));

            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: { requests },
                });
                log(`[Upsert] ${rowsToDelete.length}개 행 삭제 성공`);
            } catch (deleteError: any) {
                log(`[Upsert] 행 삭제 실패: ${deleteError.message}`);
            }
        } else {
            log('[Upsert] 삭제할 기존 행 없음 (신규 추가)');
        }

        // 새 데이터 추가
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A:N`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        });
        log('[Upsert] 새 데이터 추가 완료');
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
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            console.error('❌ GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        console.log(`📊 시트 초기화 시도 중... (ID: ${sheetId.substring(0, 5)}...)`);

        // 1. 상담 요약 시트 (사용자 맞춤 순서)
        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '팔로업일', '잔금기한', '안내발송일'
        ];

        // 2. 메시지 로그 시트
        const messageHeaders = [
            '일시', '사용자ID', '발신자', '내용'
        ];

        const { consultationsSheet, messagesSheet } = await getSheetTitles(sheets, sheetId);

        // 상담 요약 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A1:L1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [consultationHeaders] },
        });
        console.log(`✅ ${consultationsSheet} (상담 요약) 헤더 초기화 완료`);

        // Sheet2 업데이트
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${messagesSheet}!A1:D1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [messageHeaders] },
            });
            console.log(`✅ ${messagesSheet} (메시지 로그) 헤더 초기화 완료`);
        } catch (e: any) {
            if (e.message?.includes('exceeds the sheet bounds') || e.message?.includes('not find range')) {
                console.log(`ℹ️ ${messagesSheet}가 없습니다. 수동으로 하단 [+] 버튼을 눌러 시트를 추가해주세요.`);
            } else {
                console.warn(`⚠️ ${messagesSheet} 초기화 중 주의사항:`, e.message);
            }
        }

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
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return false;

        const { messagesSheet } = await getSheetTitles(sheets, sheetId);
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        const row = [timestamp, visitorId, sender === 'user' ? '고객' : 'AI상담사', content];

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${messagesSheet}!A:D`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] },
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
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return [];
        }

        const { consultationsSheet } = await getSheetTitles(sheets, sheetId);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A:N`,
        });

        const rows = response.data.values || [];
        const history: ConsultationData[] = [];

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
                    timestamp: row[0],
                    visitor_id: '',
                });
            }
        }

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
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return [];
        }

        const { consultationsSheet } = await getSheetTitles(sheets, sheetId);

        // console.log('[Google Sheets] 상담 목록 새로고침...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!A:N`,
        });

        const rows = response.data.values || [];
        const consultations: ConsultationData[] = [];
        const processedKeys = new Set<string>(); // 중복 방지용 키 집합

        // 역순으로 순회 (최신 데이터가 아래에 있으므로, 아래부터 읽어야 최신 우선)
        for (let i = rows.length - 1; i >= 1; i--) {
            const row = rows[i];

            // 이름이나 폰번호가 없으면 유효하지 않은 데이터로 간주
            if (!row[1] && !row[2]) continue;

            const timestamp = row[0];
            const name = row[1] || '미정';
            const phone = row[2] || '미정';

            // 고유 키 생성: 이름+전화번호 (전화번호가 없으면 이름만으로)
            const uniqueKey = phone !== '미정' ? `${name}-${phone}` : name;

            // 이미 처리된(더 최신의) 데이터가 있으면 스킵 (중복 제거)
            if (processedKeys.has(uniqueKey)) continue;

            processedKeys.add(uniqueKey);

            consultations.push({
                timestamp: timestamp,
                customer: {
                    name: name,
                    phone: phone,
                },
                trip: {
                    destination: row[3] || '',
                    departure_date: row[4] || '',
                    return_date: row[5] || '',    // F column
                    duration: row[6] || '',       // G column
                    product_name: row[7] || '',   // H column
                    url: row[8] || '',            // I column
                },
                summary: row[9] || '',            // J column (상담요약)
                automation: {
                    status: (row[10] as ConsultationData['automation']['status']) || '상담중', // K column
                    next_followup: row[11] || '',      // L column
                    balance_due_date: row[12] || '',   // M column
                    notice_date: row[13] || '',        // N column
                },
                sheetRowIndex: i + 1, // 1-based index (실제 시트 행 번호)
                visitor_id: '',       // 시트에는 visitor_id가 없으므로 공란 (매칭 시 채워짐)
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
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return [];

        const { messagesSheet } = await getSheetTitles(sheets, sheetId);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${messagesSheet}!A:D`,
        });

        const rows = response.data.values || [];
        const messages: any[] = [];

        // 첫 번째 행 제외
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[1] === visitorId) {
                messages.push({
                    timestamp: row[0],
                    role: row[2] === 'AI상담사' ? 'assistant' : 'user',
                    content: row[3] || '',
                });
            }
        }

        return messages;
    } catch (error) {
        console.error('메시지 조회 오류:', error);
        return [];
    }
}

/**
 * 모든 메시지 로그를 조회합니다 (대시보드 통계용).
 */
export async function getAllMessages(): Promise<any[]> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return [];

        const { messagesSheet } = await getSheetTitles(sheets, sheetId);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${messagesSheet}!A:D`,
        });

        const rows = response.data.values || [];
        const allMessages: any[] = [];

        // 첫 번째 행 제외
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            allMessages.push({
                timestamp: row[0],
                visitorId: row[1],
                sender: row[2],
                content: row[3] || '',
            });
        }

        return allMessages;
    } catch (error) {
        console.error('전체 메시지 조회 오류:', error);
        return [];
    }
}

/**
 * Google Sheets에서 특정 행을 삭제합니다.
 */
export async function deleteConsultationFromSheet(rowIndex: number): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        // 스프레드시트 정보 가져오기
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = spreadsheet.data.sheets?.[0];
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

        console.log(`[Google Sheets] 행 ${rowIndex} 삭제 완료`);
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
export async function updateConsultationStatus(rowIndex: number, status: string): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const { consultationsSheet } = await getSheetTitles(sheets, sheetId);

        // K열(11번째)이 상담단계 컬럼
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${consultationsSheet}!K${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[status]],
            },
        });

        console.log(`[Google Sheets] 행 ${rowIndex} 상태 업데이트: ${status}`);
        cachedConsultations = null; // 캐시 초기화
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 상태 업데이트 오류:', error.message);
        return false;
    }
}
