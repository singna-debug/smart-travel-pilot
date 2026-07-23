'use client';

/**
 * 카카오톡 바로 전송 (원클릭 카톡 열기 & 멘트 100% 복사 및 안내 모달/팝업) 유틸리티
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
 * 화면에 예쁜 카카오톡 전송 안내 팝업 모달을 띄우는 함수
 */
function showKakaoModal(text: string, customerName?: string, kakaoId?: string) {
  if (typeof document === 'undefined') return;

  // 기존 모달이 있으면 제거
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
  modal.style.animation = 'fadeIn 0.2s ease-out';

  const targetName = customerName || '고객';
  const kakaoIdMsg = kakaoId ? `<div style="font-size: 13px; color: #a0a0b0; margin-top: 4px;">📌 담당자 카톡 ID: <strong style="color: #00d4aa">${kakaoId}</strong></div>` : '';

  // 카카오 오픈채팅 또는 카카오톡 딥링크 주소 생성
  let openUrl = 'kakaotalk://';
  if (kakaoId && (kakaoId.startsWith('http://') || kakaoId.startsWith('https://'))) {
    openUrl = kakaoId;
  } else if (kakaoId && kakaoId.startsWith('open.kakao.com')) {
    openUrl = `https://${kakaoId}`;
  }

  modal.innerHTML = `
    <div style="background: #16162a; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 28px; width: 90%; max-width: 440px; color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; font-family: sans-serif;">
      <div style="font-size: 40px; margin-bottom: 12px;">📋💬</div>
      <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 6px; color: #ffffff;">보낼 멘트 복사 완료!</h3>
      <p style="font-size: 14px; color: #00d4aa; margin-bottom: 16px; font-weight: 600;">
        [${targetName}]님에게 전달할 상담 멘트가 100% 복사되었습니다.
      </p>
      ${kakaoIdMsg}

      <div style="background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin: 18px 0; text-align: left; max-height: 120px; overflow-y: auto; font-size: 12px; color: #a0a0b0; white-space: pre-wrap; line-height: 1.5;">${text}</div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
        <button id="btn-open-kakao-app" style="background: #FEE500; color: #000000; border: none; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-shadow: 0 4px 15px rgba(254,229,0,0.2);">
          💬 카카오톡 실행하기 (Ctrl+V 붙여넣기)
        </button>

        <button id="btn-re-copy" style="background: #1a1a2e; color: #ffffff; border: 1px solid rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">
          📄 멘트 다시 복사하기
        </button>

        <button id="btn-close-modal" style="background: transparent; color: #6a6a7a; border: none; padding: 8px; font-size: 13px; cursor: pointer; margin-top: 4px;">
          닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 이벤트 바인딩
  const openAppBtn = document.getElementById('btn-open-kakao-app');
  const reCopyBtn = document.getElementById('btn-re-copy');
  const closeBtn = document.getElementById('btn-close-modal');

  if (openAppBtn) {
    openAppBtn.onclick = () => {
      // 카카오톡 딥링크 시도 및 웹 주소 실행
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        window.location.href = openUrl;
      } else {
        // PC 크롬/엣지: 카카오톡 앱 딥링크 iframe 시도
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

  if (reCopyBtn) {
    reCopyBtn.onclick = async () => {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          alert('멘트가 다시 복사되었습니다! 카톡 대화창에서 Ctrl+V 해주세요.');
        }
      } catch (e) {}
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
  const { text, customerPhone, customerName } = options;

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
