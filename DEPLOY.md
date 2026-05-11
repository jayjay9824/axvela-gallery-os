# DEPLOY.md — Vercel 배포 가이드

> AXVELA Gallery OS를 Vercel에 배포해 production URL을 발급받고, 이후 변경사항을
> push할 때마다 자동 재배포하는 흐름.

---

## 사전 요구

- **GitHub 계정** (또는 GitLab / Bitbucket)
- **Vercel 계정** (https://vercel.com — GitHub로 sign in 가능, 무료)
- **로컬 환경에 git 설치** (Vercel CLI 직접 배포도 가능 — 아래 방법 B 참고)

---

## 방법 A — GitHub 연결 (가장 추천)

### 1단계 — GitHub 저장소 생성

1. https://github.com/new 접속
2. Repository name: `axvela-gallery-os` (원하는 이름)
3. **Private** 추천 (Vercel은 private repo도 무료)
4. README / .gitignore / license 추가 안 함 (이미 ZIP에 포함됨)
5. "Create repository" 클릭 → 비어있는 repo 생성됨

### 2단계 — ZIP 압축 해제 + git 초기화

```bash
# ZIP 압축 해제 후 이동
cd ~/Downloads
unzip axvela-step50-5-image-upload-bugfix.zip
cd axvela-gallery-os

# git 초기화 + 첫 커밋
git init
git add .
git commit -m "Initial commit — AXVELA Gallery OS STEP 50.5"

# GitHub에 push (URL은 1단계 직후 GitHub가 보여줌)
git branch -M main
git remote add origin https://github.com/<your-username>/axvela-gallery-os.git
git push -u origin main
```

### 3단계 — Vercel에서 import

1. https://vercel.com/new 접속
2. "Import Git Repository" → GitHub 권한 부여
3. `axvela-gallery-os` 선택 → "Import"
4. 설정 화면이 뜨면 **그대로 두고** "Deploy" 클릭
   - Framework Preset: **Next.js** (자동 인식됨)
   - Build Command: `next build` (vercel.json에 명시됨)
   - Output Directory: `.next` (vercel.json에 명시됨)
   - Install Command: `npm install`
   - Region: **Seoul (icn1)** (vercel.json에 명시됨)
5. 1~2분 후 배포 완료 → `https://axvela-gallery-os-<random>.vercel.app` 형태의 URL 발급

### 4단계 — 도메인 (선택)

- Vercel Dashboard → Project → Settings → Domains
- 무료 `*.vercel.app` 서브도메인 변경 가능
- 또는 보유한 커스텀 도메인 연결

### 5단계 — 자동 재배포

이후 로컬에서 변경사항을 push할 때마다 Vercel이 자동 빌드 + 배포:

```bash
# 코드 변경 후
git add .
git commit -m "STEP 51 — feature description"
git push
# → Vercel이 자동으로 재빌드해서 production URL 갱신 (1~2분)
```

**Pull Request preview**도 자동 — branch별 임시 URL 발급되어 production 배포 전에 확인 가능.

---

## 방법 B — Vercel CLI 직접 배포 (GitHub 없이)

git 사용을 원치 않거나 빠르게 한 번 띄워보고 싶을 때.

### 1단계 — Vercel CLI 설치

```bash
npm install -g vercel
```

### 2단계 — 로그인

```bash
vercel login
# 이메일 입력 → 메일 받은 magic link 클릭
```

### 3단계 — 배포

```bash
cd /path/to/axvela-gallery-os
vercel
# 첫 실행 시 몇 가지 질문에 답:
#   - "Set up and deploy?" → Y
#   - "Which scope?" → 본인 계정
#   - "Link to existing project?" → N
#   - "What's your project's name?" → axvela-gallery-os (또는 원하는 이름)
#   - "In which directory is your code located?" → ./
#   - 나머지 자동 감지 — 그대로 Y
```

### 4단계 — Production 배포

```bash
vercel --prod
```

이후 코드 변경 시 다시 `vercel --prod` 실행.

---

## 점검 체크리스트

배포 후 production URL에서 다음 점검:

- [ ] 메인 페이지 로딩 — 작품 그리드 + Sidebar + DetailPanel 3-Column
- [ ] 작품 클릭 → DetailPanel 정보 표시
- [ ] **Sidebar "보고서" → ReportingDrawer 열림 + 모든 클릭 정상 작동** (STEP 50.5 BUGFIX 검증)
  - 기간 chip 클릭
  - 사용자 지정 date input
  - CSV / PDF 다운로드
  - 닫기 버튼
- [ ] Customer / Market Analysis Drawer 정상
- [ ] 작품 추가 → **이미지 업로드** → 카드에 표시 (STEP 50.5 신규 기능 검증)
- [ ] 작품 편집 → 이미지 교체 / 제거
- [ ] 새로고침 후 데이터 유지 (localStorage persistence)

---

## 환경변수

현재 STEP 50까지는 **외부 API 0건** (모든 provider가 deterministic mock) → **환경변수 불필요**.

향후 실제 provider 연결 시 (예: DHL / FedEx / S3 storage) Vercel Dashboard → Project → Settings → Environment Variables에서 추가:

```
DHL_API_KEY=<key>
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
```

코드에서 `process.env.DHL_API_KEY`로 접근.

---

## 배포 설정 파일 (이미 포함됨)

ZIP에 다음 파일들이 이미 포함되어 Vercel이 자동 인식:

| 파일 | 역할 |
|---|---|
| `package.json` | dependencies + scripts |
| `next.config.js` | Next.js 설정 (reactStrictMode) |
| `vercel.json` | Vercel framework / region / build 명시 |
| `.nvmrc` | Node 버전 20.x 고정 |
| `.eslintrc.json` | next/core-web-vitals (lint 자동화) |
| `.gitignore` | node_modules / .next / .vercel 제외 |
| `tsconfig.json` | TypeScript 설정 |
| `tailwind.config.ts` | Tailwind 설정 |
| `postcss.config.js` | PostCSS 설정 |

추가 설정 필요 없음 — ZIP 압축 해제 → git push → Vercel import 한 번으로 끝.

---

## 자주 묻는 질문

### Q. Persistence(localStorage)는 production에서도 작동하나?
A. 네. localStorage는 브라우저에 저장되므로 사용자 디바이스별로 독립적. Vercel server와 무관.

### Q. 여러 사용자가 동시에 사용해도 되나?
A. 현재 STEP 50.5까지는 **single-user** 운영 도구 — 모든 데이터가 브라우저에 저장됨. 멀티 사용자 / 서버 데이터베이스 연결은 별도 STEP에서 진행 필요.

### Q. 이미지 업로드 결과는 어디에?
A. STEP 50.5 기준 data URL inline 저장 → localStorage에 그대로 들어감. 외부 storage(S3 등) 연결은 별도 STEP.

### Q. Vercel 무료 플랜으로 충분한가?
A. 네. Hobby 플랜은 commercial 사용 외 모든 케이스에 충분 — 100GB 대역폭 / 무제한 배포 / 도메인 연결 모두 무료.

### Q. 배포 실패하면?
A. Vercel Dashboard → Project → Deployments → 실패한 build 클릭 → 로그 확인.
가장 흔한 원인:
- Node 버전 mismatch → `.nvmrc`로 20.x 고정됨
- Lint 에러 → `.eslintrc.json` 포함됨
- TypeScript 에러 → 로컬에서 `npm run type-check`로 사전 확인

---

## 배포 후 Iteration 흐름

```
1. 로컬에서 코드 수정
   ↓
2. npm run dev로 미리보기 (http://localhost:3000)
   ↓
3. npm run type-check && npm run build (사전 검증)
   ↓
4. git add . && git commit -m "..." && git push
   ↓
5. Vercel 자동 빌드 (Dashboard에서 진행 상황 실시간 확인)
   ↓
6. 1~2분 후 production URL에 반영됨
```

---

**준비 완료. https://vercel.com/new 에서 시작하세요.**
