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

// 날짜 자동 포맷터 (예: 20260412 -> 2026-04-12)
export function autoFormatDateString(val: string | undefined): string {
    if (!val) return '';
    let cleanStr = String(val).trim();
    if (/^\d{8}(\s*\(.*\))?$/.test(cleanStr)) {
        return cleanStr.replace(/^(\d{4})(\d{2})(\d{2})(.*)$/, '$1-$2-$3$4').trim();
    } else if (/^\d{6}(\s*\(.*\))?$/.test(cleanStr)) {
        return cleanStr.replace(/^(\d{2})(\d{2})(\d{2})(.*)$/, '20$1-$2-$3$4').trim();
    } else if (/^\d{4}\.\d{1,2}\.\d{1,2}(\s*\(.*\))?$/.test(cleanStr)) {
        return cleanStr.replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(.*)$/, (_, y, m, d, rest) =>
            `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${rest}`
        ).trim();
    }
    return cleanStr;
}

export function getGoogleSheetsClient() {
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
export async function getSheetTitles(sheets: any, spreadsheetId: string) {
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
            '상담일시', '고객성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '등록방식', '팔로업일',
            '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id', 'inquiry_info_backup'
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${month}!A1:Z1`,
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
export async function applyDropdownValidation(sheets: any, spreadsheetId: string, sheetGid: number) {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        // 상담단계 (N열, index 13)
                        setDataValidation: {
                            range: {
                                sheetId: sheetGid,
                                startRowIndex: 1,
                                startColumnIndex: 13, // N열
                                endColumnIndex: 14,
                            },
                            rule: {
                                condition: {
                                    type: 'ONE_OF_LIST',
                                    values: [
                                        { userEnteredValue: '상담중' },
                                        { userEnteredValue: '예약확정' },
                                        { userEnteredValue: '선금완료' },
                                        { userEnteredValue: '잔금완료' },
                                        { userEnteredValue: '여행완료' },
                                        { userEnteredValue: '취소/보류' }
                                    ]
                                },
                                showCustomUi: true,
                                strict: false
                            }
                        }
                    },
                    {
                        // 재방문여부 (E열, index 4)
                        setDataValidation: {
                            range: {
                                sheetId: sheetGid,
                                startRowIndex: 1,
                                startColumnIndex: 4, // E열
                                endColumnIndex: 5,
                            },
                            rule: {
                                condition: {
                                    type: 'ONE_OF_LIST',
                                    values: [
                                        { userEnteredValue: '재방문' },
                                        { userEnteredValue: '신규고객' }
                                    ]
                                },
                                showCustomUi: true,
                                strict: false
                            }
                        }
                    },
                    {
                        // 유입경로 (F열, index 5)
                        setDataValidation: {
                            range: {
                                sheetId: sheetGid,
                                startRowIndex: 1,
                                startColumnIndex: 5, // F열
                                endColumnIndex: 6,
                            },
                            rule: {
                                condition: {
                                    type: 'ONE_OF_LIST',
                                    values: [
                                        { userEnteredValue: '네이버 블로그' },
                                        { userEnteredValue: '카카오톡 채널' },
                                        { userEnteredValue: '인스타그램 및 페이스북' },
                                        { userEnteredValue: '당근마켓' },
                                        { userEnteredValue: '닷컴' },
                                        { userEnteredValue: '지인소개' },
                                        { userEnteredValue: '기존고객' },
                                        { userEnteredValue: '전화문의' },
                                        { userEnteredValue: '매장방문' },
                                        { userEnteredValue: '기타' }
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

        // 시트에 추가할 행 데이터 (A-Z, 26개 컬럼)
        const row = [
            timestamp,                          // A: 상담일시 (0)
            data.customer.name,                 // B: 고객성함 (1)
            data.customer.phone,                // C: 연락처 (2)
            data.trip.travelers_count || '',    // D: 총인원 (3)
            data.automation.recurringCustomer || '신규고객', // E: 재방문여부 (4)
            data.automation.inquirySource || '', // F: 유입경로 (5)
            data.trip.destination,              // G: 목적지 (6)
            data.trip.departure_date,           // H: 출발일 (7)
            data.trip.return_date || '',        // I: 귀국일 (8)
            data.trip.duration || '',           // J: 기간 (9)
            data.trip.product_name,             // K: 상품명 (10)
            data.trip.url,                      // L: 상품URL (11)
            data.summary || '',                 // M: 상담요약 (12)
            data.automation.status,             // N: 상담단계 (13)
            data.source || '수동상담',           // O: 등록방식 (14)
            data.automation.next_followup,      // P: 팔로업일 (15)
            data.automation.confirmed_product || '', // Q: 확정상품 (16)
            data.automation.confirmed_date || '',    // R: 예약확정일 (17)
            data.automation.prepaid_date || '',      // S: 선금일 (18)
            data.automation.notice_date || '',       // T: 출발전안내(4주) (19)
            data.automation.balance_date || '',      // U: 잔금일 (20)
            data.automation.confirmation_sent || '', // V: 확정서 발송 (21)
            data.automation.departure_notice || '',  // W: 출발안내 (22)
            data.automation.phone_notice || '',      // X: 전화 안내 (23)
            data.automation.happy_call || '',        // Y: 해피콜 (24)
            data.visitor_id || '',                  // Z: visitor_id (25)
            data.automation.inquiry_info_backup || '', // AA: inquiry_info_backup (26)
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${targetSheet}!A:AA`,
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
                range: `${sheetTitle}!A:Z`,
            });
            const rows = resp.data.values || [];

            for (let i = rows.length - 1; i >= 1; i--) {
                const row = rows[i];
                const rowVisitorId = (row[25] || '').trim(); // Z열: visitor_id (index 25)
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
                    oldDestination = row[6] || ''; // G열: 목적지 (index 6)

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
            timestamp,                          // A: 상담일시 (0)
            data.customer.name,                 // B: 고객성함 (1)
            data.customer.phone,                // C: 연락처 (2)
            data.trip.travelers_count || '',    // D: 총인원 (3)
            data.automation.recurringCustomer || '신규고객', // E: 재방문여부 (4)
            data.automation.inquirySource || '', // F: 유입경로 (5)
            data.trip.destination,              // G: 목적지 (6)
            data.trip.departure_date,           // H: 출발일 (7)
            data.trip.return_date || '',        // I: 귀국일 (8)
            data.trip.duration || '',           // J: 기간 (9)
            data.trip.product_name,             // K: 상품명 (10)
            data.trip.url,                      // L: 상품URL (11)
            data.summary || updatedSummary,     // M: 상담요약 (12)
            data.automation.status,             // N: 상담단계 (13)
            data.source || '수동상담',           // O: 등록방식 (14)
            data.automation.next_followup,      // P: 팔로업일 (15)
            data.automation.confirmed_product || '', // Q: 확정상품 (16)
            data.automation.confirmed_date || '',    // R: 예약확정일 (17)
            data.automation.prepaid_date || '',      // S: 선금일 (18)
            data.automation.notice_date || '',       // T: 출발전안내(4주) (19)
            data.automation.balance_date || '',      // U: 잔금일 (20)
            data.automation.confirmation_sent || '', // V: 확정서 발송 (21)
            data.automation.departure_notice || '',  // W: 출발안내 (22)
            data.automation.phone_notice || '',      // X: 전화 안내 (23)
            data.automation.happy_call || '',        // Y: 해피콜 (24)
            data.visitor_id || '',                  // Z: visitor_id (25)
            data.automation.inquiry_info_backup || '', // AA: inquiry_info_backup (26)
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
            range: `${targetSheet}!A:AA`,
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

        // 1. 상담 요약 시트
        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '등록방식', '팔로업일',
            '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id'
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
            range: `${consultationsSheet}!A1:Z1`,
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
                        startColumnIndex: 13, // N 열 (상담단계)
                        endColumnIndex: 14,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '상담중' },
                                { userEnteredValue: '예약확정' },
                                { userEnteredValue: '선금완료' },
                                { userEnteredValue: '잔금완료' },
                                { userEnteredValue: '여행완료' },
                                { userEnteredValue: '취소/보류' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            });
            dropdownRequests.push({
                // 재방문여부 (E열, index 4)
                setDataValidation: {
                    range: {
                        sheetId: gid,
                        startRowIndex: 1,
                        startColumnIndex: 4, // E열
                        endColumnIndex: 5,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '재방문' },
                                { userEnteredValue: '신규고객' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            });
            dropdownRequests.push({
                // 유입경로 (F열, index 5)
                setDataValidation: {
                    range: {
                        sheetId: gid,
                        startRowIndex: 1,
                        startColumnIndex: 5, // F열
                        endColumnIndex: 6,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '네이버 블로그' },
                                { userEnteredValue: '카카오톡 채널' },
                                { userEnteredValue: '인스타그램 및 페이스북' },
                                { userEnteredValue: '당근마켓' },
                                { userEnteredValue: '닷컴' },
                                { userEnteredValue: '지인소개' },
                                { userEnteredValue: '기존고객' },
                                { userEnteredValue: '전화문의' },
                                { userEnteredValue: '매장방문' },
                                { userEnteredValue: '기타' }
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
            console.log(`✅ 모든 시트 상담단계(N열) 드롭다운 적용 완료`);
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
        if (!customerPhone || customerPhone === '미정') return [];

        // 캐싱된 모든 데이터를 가져옴 (fetchAllSheetData는 내부적으로 1분 캐시 사용)
        const allRows = await fetchAllSheetData(false);
        const historyRows = allRows.filter(row => row[2] === customerPhone);

        const history: ConsultationData[] = [];
        for (const row of historyRows) {
            history.push({
                customer: {
                    name: row[1] || '미정',
                    phone: row[2] || '미정',
                },
                trip: {
                    travelers_count: row[3] || '',    // D: 총인원 (index 3)
                    destination: row[6] || '',        // G: 목적지 (index 6)
                    departure_date: autoFormatDateString(row[7]),     // H: 출발일 (index 7)
                    return_date: autoFormatDateString(row[8]),        // I: 귀국일 (index 8)
                    duration: row[9] || '',           // J: 기간 (index 9)
                    product_name: row[10] || '',      // K: 상품명 (index 10)
                    url: row[11] || '',               // L: 상품URL (index 11)
                },
                summary: row[12] || '',               // M: 상담요약 (index 12)
                automation: {
                    status: row[13] as ConsultationData['automation']['status'] || '상담중', // N: 상담단계 (index 13)
                    recurringCustomer: row[4],        // E: 재방문여부 (index 4)
                    inquirySource: row[5],            // F: 유입경로 (index 5)
                    next_followup: autoFormatDateString(row[15]),     // P: 팔로업일 (index 15)
                    confirmed_product: row[16] || '', // Q: 확정상품 (index 16)
                    confirmed_date: autoFormatDateString(row[17]),    // R: 예약확정일 (index 17)
                    prepaid_date: autoFormatDateString(row[18]),      // S: 선금일 (index 18)
                    notice_date: autoFormatDateString(row[19]),       // T: 출발전안내(4주) (index 19)
                    balance_date: autoFormatDateString(row[20]),      // U: 잔금일 (index 20)
                    confirmation_sent: autoFormatDateString(row[21]), // V: 확정서 발송 (index 21)
                    departure_notice: autoFormatDateString(row[22]),  // W: 출발안내 (index 22)
                    phone_notice: autoFormatDateString(row[23]),      // X: 전화 안내 (index 23)
                    happy_call: autoFormatDateString(row[24]),        // Y: 해피콜 (index 24)
                    inquiry_info_backup: row[26] || '',               // AA: 백업 (index 26)
                },
                source: row[14] || '',                // O: 등록방식 (index 14)
                timestamp: row[0],
                visitor_id: row[25] || '',            // Z: visitor_id (index 25)
                sheetName: row._sheetName,
                sheetRowIndex: row._rowIndex,
                sheetGid: row._sheetGid,
            });
        }

        // 최신순 정렬 (기존 sort로직 유지하려 했으나 히스토리는 시간순이 일반적)
        history.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

        return history;
    } catch (error) {
        console.error('상담 이력 조회 오류:', error);
        return [];
    }
}

let cachedAllData: any[] | null = null;
let lastDataFetchTime = 0;
const DATA_CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * 모든 시트의 데이터를 batchGet으로 한 번에 가져와 캐싱하는 공통 함수
 */
async function fetchAllSheetData(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh && cachedAllData && (Date.now() - lastDataFetchTime < DATA_CACHE_DURATION)) {
        return cachedAllData;
    }

    const sheets = getGoogleSheetsClient();
    const sheetId = cleanEnv('GOOGLE_SHEET_ID');

    if (!sheetId) return [];

    const { monthlySheets, consultationsSheet: fallbackSheet, sheetList } = await getSheetTitles(sheets, sheetId);
    // 월별 시트가 있으면 최신순(역순)으로 정렬하여 읽기
    const sheetsToRead = monthlySheets.length > 0 ? [...monthlySheets].sort().reverse() : [fallbackSheet];

    // BatchGet을 사용하여 모든 시트 데이터를 한 번의 API 호출로 가져옴
    const ranges = sheetsToRead.map(s => `${s}!A:Z`);
    const resp = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId,
        ranges: ranges,
    });

    const allRows: any[] = [];
    resp.data.valueRanges?.forEach((valueRange, index) => {
        const sName = sheetsToRead[index];
        const rows = valueRange.values || [];
        if (rows.length > 1) {
            for (let i = 1; i < rows.length; i++) {
                const row: any = rows[i];
                row._sheetName = sName;
                row._rowIndex = i + 1;
                row._sheetGid = sheetList.find((s: any) => s.properties.title === sName)?.properties?.sheetId || 0;
                allRows.push(row);
            }
        }
    });

    // 최신순 정렬 (상담일시 기준)
    allRows.sort((a, b) => {
        const dateA = new Date(a[0] || 0).getTime();
        const dateB = new Date(b[0] || 0).getTime();
        return dateB - dateA;
    });

    cachedAllData = allRows;
    lastDataFetchTime = Date.now();
    return allRows;
}

/**
 * 모든 상담 내역을 조회합니다 (대시보드용).
 * 성능 최적화를 위해 1분간 캐싱합니다.
 */
export async function getAllConsultations(forceRefresh = false): Promise<ConsultationData[]> {
    try {
        if (!cleanEnv('GOOGLE_SHEET_ID')) return [];

        const allRows = await fetchAllSheetData(forceRefresh);

        const consultations: ConsultationData[] = [];
        for (const row of allRows) {
            if (!row[1] && !row[2]) continue;

            const name = row[1] || '미정';
            const phone = row[2] || '미정';

            consultations.push({
                timestamp: row[0],
                customer: { name, phone },
                trip: {
                    travelers_count: row[3] || '',    // D: 총인원 (index 3)
                    destination: row[6] || '',        // G: 목적지 (index 6)
                    departure_date: autoFormatDateString(row[7]),     // H: 출발일 (index 7)
                    return_date: autoFormatDateString(row[8]),        // I: 귀국일 (index 8)
                    duration: row[9] || '',           // J: 기간 (index 9)
                    product_name: row[10] || '',      // K: 상품명 (index 10)
                    url: row[11] || '',               // L: 상품URL (index 11)
                },
                summary: row[12] || '',               // M: 상담요약 (index 12)
                automation: {
                    status: (row[13] as ConsultationData['automation']['status']) || '상담중', // N: 상담단계 (index 13)
                    recurringCustomer: row[4],        // E: 재방문여부 (index 4)
                    inquirySource: row[5],            // F: 유입경로 (index 5)
                    next_followup: autoFormatDateString(row[15]),     // P: 팔로업일 (index 15)
                    confirmed_product: row[16] || '', // Q: 확정상품 (index 16)
                    confirmed_date: autoFormatDateString(row[17]),    // R: 예약확정일 (index 17)
                    prepaid_date: autoFormatDateString(row[18]),      // S: 선금일 (index 18)
                    notice_date: autoFormatDateString(row[19]),       // T: 출발전안내(4주) (index 19)
                    balance_date: autoFormatDateString(row[20]),      // U: 잔금일 (index 20)
                    confirmation_sent: autoFormatDateString(row[21]), // V: 확정서 발송 (index 21)
                    departure_notice: autoFormatDateString(row[22]),  // W: 출발안내 (index 22)
                    phone_notice: autoFormatDateString(row[23]),      // X: 전화 안내 (index 23)
                    happy_call: autoFormatDateString(row[24]),        // Y: 해피콜 (index 24)
                    inquiry_info_backup: row[26] || '',               // AA: 백업 (index 26)
                },
                source: row[14] || '수동등록',        // O: 등록방식 (index 14)
                visitor_id: row[25] || '',            // Z: visitor_id (index 25)
                sheetName: row._sheetName,
                sheetRowIndex: row._rowIndex,
                sheetGid: row._sheetGid,
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
 * 특정 전화번호로 모든 월별 시트에서 이전 상담 이력을 조회합니다.
 * 재방문 고객의 과거 여행 내역을 보여주기 위함.
 */
export async function getCustomerHistory(phone: string): Promise<{
    consultationDate: string;
    productName: string;
    productUrl: string;
    departureDate: string;
    destination: string;
    status: string;
    sheetName: string;
}[]> {
    try {
        if (!phone || phone === '미정') return [];

        const allRows = await fetchAllSheetData(); // Shared batchGet cache (0 API calls typically)

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const history: {
            consultationDate: string;
            productName: string;
            productUrl: string;
            departureDate: string;
            destination: string;
            status: string;
            sheetName: string;
        }[] = [];

        for (const row of allRows) {
            const rowPhone = (row[2] || '').replace(/[^0-9]/g, '');
            if (rowPhone && rowPhone === cleanPhone) {
                history.push({
                    consultationDate: row[0] || '',
                    productName: row[10] || '',
                    productUrl: row[11] || '',
                    departureDate: row[7] || '',
                    destination: row[6] || '',
                    status: row[13] || '',
                    sheetName: row._sheetName || '',
                });
            }
        }

        // 날짜순 정렬 (오래된 것부터)
        history.sort((a, b) => {
            const da = new Date(a.consultationDate || a.departureDate || 0).getTime();
            const db = new Date(b.consultationDate || b.departureDate || 0).getTime();
            return da - db;
        });

        return history;
    } catch (error) {
        console.error('[getCustomerHistory] Error:', error);
        return [];
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
 * 상태가 '상담중', '견적제공', '취소' 등으로 변경되면 예약 관련 정보(Q, R, S열)를 자동으로 비웁니다.
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

        // 업데이트할 값들 준비
        const data = [
            {
                range: `${targetSheetName}!N${rowIndex}`,
                values: [[status]]
            }
        ];

        // 예약 정보 초기화가 필요한 상태들
        const resetStatuses = ['상담중', '견적제공', '취소', '취소/보류', '상담완료'];
        if (resetStatuses.includes(status)) {
            console.log(`[Google Sheets] 상태가 ${status}로 변경되어 모든 예약/일정 정보(Q-Y)를 초기화합니다.`);

            // AA열(백업)에서 원래 정보를 읽어와 복원 시도 (상담중으로 되돌릴 때만)
            if (status === '상담중') {
                try {
                    const resp = await sheets.spreadsheets.values.get({
                        spreadsheetId: sheetId,
                        range: `${targetSheetName}!A${rowIndex}:AA${rowIndex}`,
                    });
                    const row = resp.data.values?.[0];
                    const backupJson = row?.[26]; // AA: index 26

                    if (backupJson) {
                        const backup = JSON.parse(backupJson);
                        console.log('[Google Sheets] 원본 정보 복원:', backup);
                        data.push({
                            range: `${targetSheetName}!G${rowIndex}:L${rowIndex}`,
                            values: [[
                                backup.destination || '',
                                backup.departureDate || '',
                                backup.returnDate || '',
                                backup.duration || '',
                                backup.productName || '',
                                backup.productUrl || ''
                            ]]
                        });
                    }
                } catch (e: any) {
                    console.error('[Google Sheets] 백업 원복 실패:', e.message);
                }
            }

            data.push({
                range: `${targetSheetName}!Q${rowIndex}:Y${rowIndex}`,
                values: [['', '', '', '', '', '', '', '', '']]
                // Q=확정상품, R=예약확정일, S=선금일, T=출발전안내(4주), U=잔금일, V=확정서, W=출발안내, X=전화안내, Y=해피콜
            });
        }

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data
            },
        });

        console.log(`[Google Sheets] ${targetSheetName} 행 ${rowIndex} 상태 업데이트: ${status}`);
        cachedConsultations = null; // 캐시 초기화
        cachedAllData = null; // 공통 캐시도 초기화
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 상태 업데이트 오류:', error.message);
        return false;
    }
}

/**
 * 특정 상담의 개별 필드를 업데이트합니다.
 * 필드명 → 시트 컬럼 매핑:
 *   B=고객성함, C=연락처, D=총인원, E=재방문여부, F=유입경로,
 *   G=목적지, H=출발일, I=귀국일, J=기간, K=상품명, L=상품URL,
 *   M=상담요약, N=상담단계, P=팔로업일
 */
const FIELD_TO_COLUMN: Record<string, string> = {
    visitorName: 'B', visitorPhone: 'C', travelersCount: 'D',
    recurringCustomer: 'E', inquirySource: 'F', destination: 'G',
    departureDate: 'H', returnDate: 'I', duration: 'J',
    productName: 'K', productUrl: 'L', summary: 'M',
    status: 'N', nextFollowup: 'P',
    confirmedProduct: 'Q', confirmedDate: 'R',
    prepaidDate: 'S', noticeDate: 'T', balanceDate: 'U',
    confirmationSent: 'V', departureNotice: 'W', phoneNotice: 'X', happyCall: 'Y',
    inquiryInfoBackup: 'AA',
};

export async function updateConsultationField(
    rowIndex: number,
    field: string,
    value: string,
    sheetName?: string
): Promise<boolean> {
    try {
        if (field === 'status') {
            return await updateConsultationStatus(rowIndex, value, sheetName);
        }

        const column = FIELD_TO_COLUMN[field];
        if (!column) {
            console.error(`[Google Sheets] 알 수 없는 필드: ${field}`);
            return false;
        }

        // 날짜 필드인 경우 자동 포맷 적용 (시트에 저장될 때)
        const dateFields = ['departureDate', 'returnDate', 'confirmedDate', 'prepaidDate', 'noticeDate', 'balanceDate', 'confirmationSent', 'departureNotice', 'phoneNotice', 'happyCall', 'nextFollowup'];
        let finalValue = value;
        if (dateFields.includes(field)) {
            finalValue = autoFormatDateString(value);
        }

        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');
        if (!sheetId) return false;

        const targetSheetName = sheetName || '시트1';

        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${targetSheetName}!${column}${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[finalValue]] },
        });

        console.log(`[Google Sheets] ${targetSheetName} 행 ${rowIndex} ${field}(${column}) 업데이트: ${finalValue}`);
        cachedConsultations = null;
        cachedAllData = null; // 모든 캐시 초기화 (대시보드 동기화 보장)
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 필드 업데이트 오류:', error.message);
        return false;
    }
}

/**
 * 예약확정 시 확정상품 URL 및 자동 계산 날짜를 일괄 업데이트합니다.
 * 컬럼 매핑 (0-indexed):
 *   G(6)=목적지, H(7)=출발일, I(8)=귀국일,
 *   N(13)=상담단계, Q(16)=확정상품, R(17)=예약확정일,
 *   S(18)=선금일, T(19)=출발전안내(4주), U(20)=잔금일,
 *   V(21)=확정서 발송, W(22)=출발안내, X(23)=전화 안내, Y(24)=해피콜
 */
export async function updateConsultationConfirmation(
    rowIndex: number,
    data: {
        confirmedProductUrl: string;
        confirmedDate: string;
        departureDate: string;
        returnDate: string;
        destination: string;
        prepaidDate: string;
        noticeDate: string;
        balanceDate: string;
        confirmationSent: string;
        departureNotice: string;
        phoneNotice: string;
        happyCall: string;
    },
    sheetName?: string
): Promise<boolean> {
    try {
        const sheets = getGoogleSheetsClient();
        const sheetId = cleanEnv('GOOGLE_SHEET_ID');

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ID가 설정되지 않았습니다.');
            return false;
        }

        const targetSheetName = sheetName || '시트1';

        // Batch update multiple columns at once
        const updates = [
            { range: `${targetSheetName}!G${rowIndex}`, values: [[data.destination]] },
            { range: `${targetSheetName}!H${rowIndex}`, values: [[data.departureDate]] },
            { range: `${targetSheetName}!I${rowIndex}`, values: [[data.returnDate]] },
            { range: `${targetSheetName}!N${rowIndex}`, values: [['예약확정']] },
            { range: `${targetSheetName}!Q${rowIndex}`, values: [[data.confirmedProductUrl]] },
            { range: `${targetSheetName}!R${rowIndex}`, values: [[data.confirmedDate]] },
            { range: `${targetSheetName}!S${rowIndex}`, values: [[data.prepaidDate]] },
            { range: `${targetSheetName}!T${rowIndex}`, values: [[data.noticeDate]] },
            { range: `${targetSheetName}!U${rowIndex}`, values: [[data.balanceDate]] },
            { range: `${targetSheetName}!V${rowIndex}`, values: [[data.confirmationSent]] },
            { range: `${targetSheetName}!W${rowIndex}`, values: [[data.departureNotice]] },
            { range: `${targetSheetName}!X${rowIndex}`, values: [[data.phoneNotice]] },
            { range: `${targetSheetName}!Y${rowIndex}`, values: [[data.happyCall]] },
        ];

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates,
            },
        });

        console.log(`[Google Sheets] ${targetSheetName} 행 ${rowIndex} 예약확정 일괄 업데이트 완료`);
        cachedConsultations = null; // 캐시 초가화
        cachedAllData = null; // 공통 캐시도 초기화
        return true;
    } catch (error: any) {
        console.error('[Google Sheets] 예약확정 업데이트 오류:', error.message);
        return false;
    }
}
