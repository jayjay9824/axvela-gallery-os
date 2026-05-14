\# STEP 131.5 Phase 2 — Commit 5: MobileBlockNotice (Closure)



Status: COMPLETE

Commit Hash: 6422744

Parent Commit: 1d9fab3 (Commit 4: PassportUnfoldView mobile-native wire)

Branch: claude/step127-architecture-review

Date: 2026-05-14

Decision: 옵션 Z (Desktop Only + Mobile 차단 안내)



\---



\## 1. 핵심 결정 — 옵션 Z 채택



STEP 131.5 Phase 2 Commit 5 (Closure) 의 결정 영역은 Mobile Web 정책. 사용자 직관 ("모바일은 보류하고 웹(컴퓨터용 위주로)") 에 따라 옵션 Z 확정.



옵션 비교:

\- X: Mobile Web 제거 + Native App 별도 (선택 안 함, 사용자 우려 "이미지 안 좋아질 수도")

\- Y: 현재 유지 mobile + desktop 공존 (선택 안 함, 첫 인상 약함 우려)

\- Z: Desktop Only + Mobile 차단 안내 (채택)



옵션 Z 선택 이유:

1\. 가역적 변경 — "보류" = 미루다 의미, 추후 mobile 재개 시 mount 1줄 제거로 끝

2\. rule\_14 (3-column desktop) 보호 — Desktop layout 0 변경

3\. D-COMMIT-5-1 (viewMode === "grid" 모바일 카드 깨짐) 우회 — 차단으로 해결 보다 빠름



\---



\## 2. 구현 영역



신규 컴포넌트 — src/components/layout/MobileBlockNotice.tsx

\- viewport < 1024px 진입 시 전체 화면 overlay

\- SSR/CSR hydration safe (mounted 패턴)

\- "use client" directive

\- export default function MobileBlockNotice()



디자인 (manifesto rule\_16 정합):

\- 흰 배경 + AXVELA OS 로고 + Pretendard 미니멀

\- "데스크탑 환경에서 이용해주세요" 안내

\- Footer: STEP 131.5 · DESKTOP ONLY



진입점 mount — src/app/layout.tsx

\- import MobileBlockNotice from "@/components/layout/MobileBlockNotice"

\- body 안 children 다음에 MobileBlockNotice 추가

\- Default import 채택 — Next.js 14.2.15 server component 호환



\---



\## 3. Manifesto Rule 정합



\- rule\_14 (3-column desktop layout 보호): Desktop UI 0 변경

\- rule\_16 (Apple/OpenAI 미니멀 + Pretendard): 정합

\- rule\_17 (레이어 추가, 레이아웃 변경 0): overlay 만 추가



\---



\## 4. 검증 결과



1\. TypeScript (npx tsc --noEmit): PASS

2\. ESLint (npm run lint): PASS (0 errors, 0 warnings)

3\. Build (npm run build): PASS (7 routes generated)

4\. git diff stat: 정합 (6 insertions, 2 deletions in layout.tsx)



로컬 작동 검증:

\- Mobile viewport (663x464px): 차단 화면 등장 (PASS)

\- Desktop viewport (>= 1024px): 정상 AXVELA 화면 (PASS)



\---



\## 5. Deferred Items 정리



\- D-COMMIT-5-1: viewMode === "grid" 모바일 카드 layout 깨짐 → 옵션 Z 채택으로 차단 우회

\- D-COMMIT-5-2: 모바일 진입 시 viewMode === "passport" 자동 선택 → 옵션 Z 채택으로 무의미

\- D-COMMIT-5-3: Mobile Web 차단 결정 → 옵션 Z 확정

\- D-COMMIT-5-4: Native App 별도 STEP → STEP 200+ 보류



\---



\## 6. 4-Layer 백업 정합



\- 로컬 (Desktop\\axvela-fresh\\axvela-gallery-os): 6422744 정착

\- GitHub (origin/claude/step127-architecture-review): Push 완료

\- ZIP: 본 STEP 종료 시 백업

\- Vercel main: 자동 빌드 트리거됨 (preview deployment)



\---



\## 7. 진행 과정 요약 (개발 일지)



본 Commit 5 는 다음 위기/극복 과정을 거쳤다:



1\. ZIP 진실 발견 — 첨부 ZIP 이 STEP 129 까지만 포함된 정합 어긋남 발견. GitHub SSOT 신뢰로 새 clone 결정.

2\. 빈 파일 위기 — VS Code 가 새 파일 저장 실패 (Length 0). 메모장 우회 작전으로 디스크 100% 저장 달성.

3\. Server/Client component 정합 — Unsupported Server Component type undefined 에러. export default + default import 패턴으로 해결.

4\. Dev server 캐시 정리 — .next 폴더 삭제 + 재시작으로 모듈 캐시 해소.



\---



\## 8. STEP 131.5 종료



본 Commit 5 로 STEP 131.5 Phase 2 완료. Phase 1 (Architecture Review) + Phase 2 (Foundation → Sidebar/TopNav → ArtworkGrid 반응형 → PassportUnfoldView mobile-native → MobileBlockNotice closure) 흐름 정착.



다음 STEP: STEP 132 (Phase 1 Architecture Review 준비됨)



\---



End of STEP 131.5 Phase 2 Commit 5 (Closure) Report

