import { KakaoSkillResponse } from '@/types';

/**
 * 카카오 i 오픈빌더 스킬 응답을 생성합니다.
 */
export function createKakaoTextResponse(text: string): KakaoSkillResponse {
    return {
        version: '2.0',
        template: {
            outputs: [
                {
                    simpleText: {
                        text: text || '죄송합니다. 답변을 생성하지 못했습니다.',
                    },
                },
            ],
        },
    };
}

/**
 * 처리 중임을 알리는 비동기 응답(useCallback)을 생성합니다.
 */
export function createKakaoCallbackResponse(): KakaoSkillResponse {
    return {
        version: '2.0',
        useCallback: true,
        template: {
            outputs: [
                {
                    simpleText: {
                        text: '요청하신 내용을 확인하고 있어요... 잠시만 기다려주세요! ⏳',
                    },
                },
            ],
        },
    };
}

/**
 * 퀵리플라이가 포함된 응답을 생성합니다.
 */
export function createKakaoResponseWithQuickReplies(
    text: string,
    quickReplies: Array<{ label: string; messageText: string }>
): KakaoSkillResponse {
    // 퀵어플라이 강제 비활성화
    return {
        version: '2.0',
        template: {
            outputs: [
                {
                    simpleText: {
                        text: text || '내용을 선택해주세요.',
                    },
                },
            ],
            // quickReplies: [] // 빈 배열로도 보내지 않음
        },
    };
}

/**
 * 카드 형태의 응답을 생성합니다.
 */
export function createKakaoCardResponse(
    title: string,
    description: string,
    buttons?: Array<{ label: string; webLinkUrl?: string }>
): KakaoSkillResponse {
    return {
        version: '2.0',
        template: {
            outputs: [
                {
                    basicCard: {
                        title: title,
                        description: description,
                        buttons: buttons?.map(btn => ({
                            label: btn.label,
                            action: btn.webLinkUrl ? 'webLink' : 'message',
                            webLinkUrl: btn.webLinkUrl,
                        })),
                    },
                },
            ],
        },
    };
}

/**
 * 에러 응답을 생성합니다.
 */
export function createKakaoErrorResponse(errorMessage?: string): KakaoSkillResponse {
    return createKakaoTextResponse(
        errorMessage || '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🙏'
    );
}
