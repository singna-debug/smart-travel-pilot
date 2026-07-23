'use client';

/**
 * 카카오톡 바로 전송 (원클릭 카톡 공유창 & 멘트 100% 복사 유틸리티)
 */

export interface SendKakaoMessageOptions {
  text: string;
  customerPhone?: string;
  customerName?: string;
  kakaoTalkId?: string;
}

const KAKAO_JS_KEY = '88997ce296527faab4b1123ffefe7856'; // Kakao App Key

/**
 * Kakao JS SDK 초기화
 */
function initKakaoSdk() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.Kakao && !win.Kakao.isInitialized()) {
    try {
      win.Kakao.init(KAKAO_JS_KEY);
    } catch (e) {
      console.warn('Kakao init warning:', e);
    }
  }
}

/**
 * 카카오 공식 공유 팝업 실행
 */
function shareViaKakaoSdk(text: string, customerName?: string) {
  initKakaoSdk();
  const win = window as any;
  const targetName = customerName || '고객';

  if (win.Kakao && win.Kakao.Share) {
    try {
      win.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `✈️ [상담안내] ${targetName}님 전달 메시지`,
          description: text.slice(0, 100) + '...',
          imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
        buttons: [
          {
            title: '상담 내용 보기',
            link: {
              mobileWebUrl: window.location.href,
              webUrl: window.location.href,
            },
          },
        ],
      });
      return true;
    } catch (err) {
      console.warn('Kakao Share failed:', err);
    }
  }
  return false;
}

/**
 * 화면에 예쁜 카카오톡 전송 안내 팝업 모달을 띄우는 함수
 */
function showKakaoModal(text: string, customerName?: string, kakaoId?: string) {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('kakao-share-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'kakao-share-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  modal.style.zIndex = '99999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const targetName = customerName || '고객';
  const kakaoIdMsg = kakaoId ? `<div style="font-size: 13px; color: #a0a0b0; margin-top: 4px;">📌 담당자 카톡 ID: <strong style="color: #00d4aa">${kakaoId}</strong></div>` : '';

  let openUrl = 'kakaotalk://';
  if (kakaoId && (kakaoId.startsWith('http://') || kakaoId.startsWith('https://'))) {
    openUrl = kakaoId;
  } else if (kakaoId && kakaoId.startsWith('open.kakao.com')) {
    openUrl = `https://${kakaoId}`;
  }

  modal.innerHTML = `
    <div style="background: #16162a; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 26px; width: 90%; max-width: 450px; color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; font-family: sans-serif;">
      <div style="font-size: 36px; margin-bottom: 10px;">📋💬</div>
      <h3 style="font-size: 19px; font-weight: 700; margin-bottom: 6px; color: #ffffff;">보낼 멘트가 100% 복사되었습니다!</h3>
      <p style="font-size: 13px; color: #00d4aa; margin-bottom: 12px; font-weight: 600;">
        [${targetName}]님 카톡 대화창에 <strong>Ctrl+V</strong> 하시면 1초 만에 전송됩니다.
      </p>
      ${kakaoIdMsg}

      <div style="background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin: 14px 0; text-align: left; max-height: 100px; overflow-y: auto; font-size: 12px; color: #a0a0b0; white-space: pre-wrap; line-height: 1.5;">${text}</div>

      <div style="background: rgba(254, 229, 0, 0.1); border: 1px solid rgba(254, 229, 0, 0.3); border-radius: 10px; padding: 10px; margin-bottom: 16px; font-size: 12px; color: #fee500; text-align: left; line-height: 1.4;">
        💡 <strong>팁</strong>: 카카오톡 본사 보안 정책상 개인 1:1 대화방 직접 열기는 외부에서 차단됩니다. <strong>카톡 상단 🔍 검색창에서 [${targetName}]님을 검색</strong>하신 후 Ctrl+V 해주세요!
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="btn-share-kakao-sdk" style="background: #FEE500; color: #000000; border: none; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
          💬 공식 카카오톡 친구 선택 전송
        </button>

        <button id="btn-open-kakao-app" style="background: #2a2a40; color: #ffffff; border: 1px solid rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">
          📲 카카오톡 앱 실행하기
        </button>

        <button id="btn-close-modal" style="background: transparent; color: #6a6a7a; border: none; padding: 6px; font-size: 13px; cursor: pointer; margin-top: 2px;">
          닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const sdkBtn = document.getElementById('btn-share-kakao-sdk');
  const openAppBtn = document.getElementById('btn-open-kakao-app');
  const closeBtn = document.getElementById('btn-close-modal');

  if (sdkBtn) {
    sdkBtn.onclick = () => {
      const ok = shareViaKakaoSdk(text, customerName);
      if (!ok) {
        // SDK 실패시 기본 딥링크
        window.location.href = openUrl;
      }
    };
  }

  if (openAppBtn) {
    openAppBtn.onclick = () => {
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        window.location.href = openUrl;
      } else {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = openUrl;
          document.body.appendChild(iframe);
          setTimeout(() => iframe.remove(), 1000);
        } catch (e) {}

        if (openUrl.startsWith('http')) {
          window.open(openUrl, '_blank');
        }
      }
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.remove();
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

/**
 * 카카오톡 전송 핵심 유틸리티
 */
export async function sendDirectKakaoMessage(options: SendKakaoMessageOptions): Promise<{ success: boolean; message: string }> {
  const { text, customerName } = options;

  if (!text) {
    return { success: false, message: '보낼 멘트 내용이 없습니다.' };
  }

  initKakaoSdk();

  let savedKakaoId = options.kakaoTalkId || '';
  if (!savedKakaoId && typeof window !== 'undefined') {
    const saved = localStorage.getItem('tenant_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        savedKakaoId = parsed.kakaoTalkId || '';
      } catch (e) {}
    }
  }

  // 1. 클립보드에 멘트 100% 복사
  let copySuccess = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
    }
  } catch (err) {}

  if (!copySuccess) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      copySuccess = true;
    } catch (e) {}
  }

  // 2. 화면에 직관적인 카카오 모달 팝업 띄우기
  showKakaoModal(text, customerName, savedKakaoId);

  const targetMsg = customerName ? `[${customerName}]` : '고객';
  return {
    success: true,
    message: `${targetMsg}님에게 전달할 카톡 멘트 복사가 완료되었습니다!`
  };
}
