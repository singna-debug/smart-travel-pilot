
# 🚀 Vercel 배포 가이드

Smart Travel Pilot을 Vercel에 배포하는 순서입니다.

---

## 1. 배포 명령 실행
터미널에서 아래 명령어를 실행하세요.

### 💡 (중요) 컴퓨터 이름에 한글이 있는 경우
고객님처럼 PC 이름이 **"노트북"** 등 한글로 되어 있으면 에러가 납니다.
이 문제를 피해가기 위해 아래 명령어를 복사해서 사용하세요:

```powershell
$env:NODE_OPTIONS='--require ./clean-hostname.js'; npx vercel
```

(처음이라면 로그인 창이 뜹니다. GitHub 등으로 로그인해주세요.)

## 2. 설정 질문 답변 (엔터만 치면 됨)
질문이 나오면 대부분 **엔터(Enter)**만 치시면 됩니다.
- Set up and deploy? [Y/n] -> **y** (엔터)
- Which scope do you want to deploy to? -> **(본인 계정 선택)** (엔터)
- Link to existing project? [y/N] -> **n** (엔터)
- What’s your project’s name? -> **smart-travel-pilot** (엔터)
- In which directory is your code located? -> **./** (엔터)
- Want to modify these settings? [y/N] -> **n** (엔터)

## 3. 환경변수 설정 (가장 중요!)
배포가 완료되면 `Production: https://smart-travel-pilot.vercel.app` 같은 주소가 나옵니다.
하지만 **환경변수(.env.local 값)가 없어서 서비스가 에러가 날 겁니다.**

1. **Vercel 대시보드 접속**: [vercel.com](https://vercel.com/dashboard)
2. 방금 배포된 프로젝트 클릭 -> **[Settings]** -> **[Environment Variables]** 이동
3. `.env.local` 파일 내용을 복사해서 하나씩 추가하거나, **[Import .env]** 버튼을 눌러서 파일 내용을 통째로 붙여넣기 하세요.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` (줄바꿈 주의!)
   - `GOOGLE_SHEET_ID`
   - `NEXT_PUBLIC_SHEET_ID`
   - `SCRAPINGBEE_API_KEY`
   - `GEMINI_API_KEY`
   - `KAKAO_REST_API_KEY`
   - `KAKAO_ADMIN_KEY`
   - `KAKAO_CHANNEL_ID`
   - `KAKAO_SKILL_SERVER_URL` (여기에 배포된 주소 + /api/kakao-skill 입력)

4. **[Redeploy]**: 변수를 추가한 후에는 **[Deployments]** 탭에 가서 가장 최근 배포의 점 3개 메뉴(...) -> **[Redeploy]**를 해야 적용됩니다.

---

## 4. 마지막: 카카오 스킬 URL 등록
1. Vercel 배포 주소 복사 (예: `https://smart-travel-pilot.vercel.app`)
2. **[카카오 i 오픈빌더]** -> 스킬 설정
3. URL에 `배포주소/api/kakao-skill` 입력 후 저장 및 배포

준비 되셨으면 터미널에 `npx vercel`을 입력하세요!
