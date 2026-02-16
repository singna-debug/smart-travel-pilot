
# 📊 Google Sheets API 연동 가이드

Smart Travel Pilot 챗봇의 상담 내역을 구글 스프레드시트에 자동 저장하기 위한 설정 방법입니다.

---

## 1. 구글 클라우드 프로젝트 생성
1. **[Google Cloud Console](https://console.cloud.google.com/)** 접속
2. 좌측 상단 프로젝트 선택 -> **[새 프로젝트]** 클릭
3. 프로젝트 이름 입력 후 **[만들기]**

## 2. Google Sheets API 활성화
1. 좌측 메뉴 **[API 및 서비스]** -> **[라이브러리]**
2. 검색창에 `Google Sheets API` 검색
3. **[사용]** 버튼 클릭

## 3. 서비스 계정 생성 및 키 발급 (중요!)
1. 좌측 메뉴 **[API 및 서비스]** -> **[사용자 인증 정보]**
2. 상단 **[+ 사용자 인증 정보 만들기]** -> **[서비스 계정]** 선택
3. 계정 이름 입력 (예: `smart-travel-bot`) 후 [완료]
4. 생성된 서비스 계정 이메일 주소 복사 (이메일 형태: `...@...iam.gserviceaccount.com`)
   - 👉 `.env.local`의 `GOOGLE_SERVICE_ACCOUNT_EMAIL`에 입력
5. 생성된 계정 클릭 -> **[키]** 탭 -> **[키 추가]** -> **[새 키 만들기]** -> **JSON** 선택 -> [만들기]
6. 다운로드된 JSON 파일을 열어서 `private_key` 값 전체 복사
   - (`-----BEGIN PRIVATE KEY-----` 부터 `-----END PRIVATE KEY-----` 까지 전체)
   - 👉 `.env.local`의 `GOOGLE_PRIVATE_KEY`에 입력 (큰따옴표 안에 줄바꿈 문자 `\n` 유지하며 한 줄로 입력하거나, 그냥 복사 붙여넣기 하면 자동으로 처리될 수 있음)

## 4. 스프레드시트 공유 설정
1. 데이터를 저장할 **구글 스프레드시트**를 새로 만듭니다. (또는 기존 시트 사용)
2. 시트 주소창의 URL에서 ID 부분 복사
   - `https://docs.google.com/spreadsheets/d/`**`1ABCDEF...XYZ`**`/edit...`
   - 👉 `.env.local`의 `GOOGLE_SHEET_ID`에 입력
3. 우측 상단 **[공유]** 버튼 클릭
4. 아까 복사한 **서비스 계정 이메일 주소**를 추가하고 **[편집자]** 권한 부여 후 [완료]

---

### ✅ 요약: .env.local에 넣을 값
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY`: 다운로드 받은 JSON 파일 안의 `private_key` 값
- `GOOGLE_SHEET_ID`: 스프레드시트 URL 중간의 ID 값
