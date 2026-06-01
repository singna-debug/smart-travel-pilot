# Smart Travel Pilot ✈️

AI 기반 여행 상담 챗봇 시스템입니다. 웹과 카카오톡 채널을 통해 자동화된 여행 상담을 제공하고, Google Sheets에 상담 데이터를 자동으로 기록합니다.

## ✨ 주요 기능

### 🤖 AI 여행 상담
- 20년 경력 베테랑 여행 실장 페르소나
- 이모지를 활용한 친근한 응대
- 심리적 구매 트리거 사용
- 주도적 상담 (질문으로 끝내기)

### 📊 자동 데이터 추출
- **URL 크롤링**: 여행 상품 링크에서 가격, 포함사항, 일정 자동 추출
- **날짜 계산**: 잔금 기한(D-30), 안내 발송일(D-3), 팔로업(+2일) 자동 계산
- **정보 추출**: 고객명, 연락처, 목적지, 출발일 자동 인식

### 🔗 API 연동
- **카카오톡 채널**: i 오픈빌더 스킬 서버 연동
- **Google Sheets**: 상담 데이터 자동 기록

## 🚀 빠른 시작

### 1. 설치

```bash
cd smart-travel-pilot
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 수정하세요:

```env
# Google Sheets API
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your-google-sheet-id

# OpenAI API (선택사항)
OPENAI_API_KEY=your-openai-api-key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인하세요!

## 📁 프로젝트 구조

```
smart-travel-pilot/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # 웹 채팅 API
│   │   ├── kakao-skill/route.ts # 카카오 스킬 서버
│   │   └── sheets/route.ts      # Google Sheets API
│   ├── globals.css              # 스타일
│   ├── layout.tsx               # 레이아웃
│   └── page.tsx                 # 메인 페이지
├── components/
│   └── ChatInterface.tsx        # 채팅 UI
├── lib/
│   ├── ai-engine.ts             # AI 응답 로직
│   ├── date-calculator.ts       # 날짜 계산
│   ├── google-sheets.ts         # Google Sheets 연동
│   ├── kakao-response.ts        # 카카오 응답 포맷터
│   └── url-crawler.ts           # URL 크롤링
├── types/
│   └── index.ts                 # TypeScript 타입
└── .env.local                   # 환경변수
```

## 🔧 카카오 i 오픈빌더 연동

### 사전 준비
1. [카카오 디벨로퍼스](https://developers.kakao.com/) 앱 생성
2. [카카오톡 채널 관리자센터](https://center-pf.kakao.com/) 비즈니스 채널 생성
3. [카카오 i 오픈빌더](https://chatbot.kakao.com/) 챗봇 생성

### 스킬 등록
1. 오픈빌더 > 스킬 > 스킬 생성
2. URL: `https://your-domain.vercel.app/api/kakao-skill`
3. 메서드: POST

### 시나리오 블록 설정
1. 시나리오 > 블록 생성
2. 발화 패턴 설정
3. 스킬 연결

## 📊 Google Sheets 연동

### 서비스 계정 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. Google Sheets API 사용 설정
3. 서비스 계정 생성 및 JSON 키 다운로드

### 시트 설정
1. 상담 기록용 Google Sheets 생성
2. 서비스 계정 이메일로 편집자 권한 공유
3. 시트 ID를 `.env.local`에 추가

### 헤더 초기화
```bash
curl -X POST http://localhost:3000/api/sheets
```

## 📋 상담 데이터 형식

```json
{
  "customer": {
    "name": "고객성함",
    "phone": "010-1234-5678"
  },
  "trip": {
    "destination": "오사카",
    "product_name": "오사카 3박4일 패키지",
    "departure_date": "2026-03-15",
    "url": "https://..."
  },
  "automation": {
    "status": "상담중",
    "balance_due_date": "2026-02-13",
    "notice_date": "2026-03-12",
    "next_followup": "2026-02-09"
  },
  "summary": "오사카 여행 상담 - 상담중"
}
```

## 🚢 배포

### Vercel 배포

```bash
npm install -g vercel
vercel
```

환경변수를 Vercel 대시보드에서 설정하세요.

## 📄 라이선스

MIT License
