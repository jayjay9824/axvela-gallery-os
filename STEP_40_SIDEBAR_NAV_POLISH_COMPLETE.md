# STEP 40 — Sidebar Nav Polish 완료

Sidebar의 미구현 7개 항목이 클릭 가능한 버튼처럼 보이지만 실제 navigation이
없어 사용자 혼란을 유발하던 문제 해결. **rule_10 (홈 = 작품 리스트) 정신 유지**
하면서, 시각·접근성 모두에서 disabled 상태를 명시적으로 표현. 도메인 로직 /
3-Column 레이아웃 / 신규 페이지/Drawer 0줄 변경.

> 본 STEP은 시각 검증 단계 (STEP 14~26 누적 13개 작업 후) 사용자가 직접 발견
> 한 UX 결함을 즉시 patch하는 polish STEP. 누적 시각 회귀 0%로 유지하면서
> "왜 클릭이 안 되지?"라는 의문 자체를 제거.

핵심 결정:
- **HTML `<button disabled>` 자체로 클릭 차단** — `pointer-events: none`이나
  manual `onClick` 가드 없이 표준 HTML disabled 속성만으로 클릭 + 포커스 +
  keyboard activation 모두 자연 차단. tabindex 자연 skip.
- **추가 a11y 명시** — `aria-disabled="true"` (스크린리더용) + `tabIndex={-1}`
  (이중 안전망) + 마우스 hover 시 `title` attribute로 hint 노출 (네이티브
  툴팁).
- **rule_7 disabled 패턴 일관성** — 기존 "전체 감사 로그" 진입점이 권한 부족
  시 사용하던 `text-ink-subtle opacity-60 cursor-not-allowed` 스타일을 그대로
  채택 → 시스템 전체에서 disabled 시각 언어 통일.
- **Hint 라벨** — 항목별로 의미 있는 안내 ("작품 상세에서 접근" / "준비 중" /
  "작품 상태 액션에서 접근"). 단순 "Coming Soon"이 아닌 **사용자가 실제로 어디
  로 가야 하는지** 알려주는 actionable hint (rule_10 정신 — 작품 중심 흐름
  강조).
- **레이아웃** — `flex justify-between` (label 좌측 / hint 우측). `truncate +
  max-w-[7.5rem]`로 좁은 sidebar에서 wrap 차단. hint는 `text-[9.5px]` 작게.
- **Active vs Disabled 시각 차이** — active는 `bg-surface-muted text-ink
  font-medium` (강조), disabled는 `text-ink-subtle opacity-60` (dim). 일반
  hover 가능 항목과 명확히 구분.
- **상호 배타 가드** — `isDisabled = !!item.disabled && !item.active`로 active와
  disabled 동시 true 시 active가 우선 (데이터 정의에서도 그렇게 보장하지만
  defensive check).

---

## 1. 현재 코드 분석

**STEP 40 진입 시점 (v34 + STEP 24 + STEP 26 baseline):**

| 항목 | 진입 시점 | STEP 40 종료 |
|---|---|---|
| Sidebar `NavItem` 인터페이스 | `{ label, active?, badge? }` 3 필드 | + `disabled?` + `hint?` 2 필드 |
| `PRIMARY` (Workspace) | `[작품(active), 거래, 문서, Collector View]` 모두 무조건 클릭 가능 | "작품"만 active, 나머지 3개 disabled + hint |
| `SECONDARY` (Operations) | `[AI 워크플로우, 보고서, 고객, 설정]` 모두 무조건 클릭 가능 | 4개 모두 disabled + hint |
| `NavGroup` 렌더 | active vs not-active 2-way state, 모든 not-active 항목 hover 가능 | active / disabled / normal 3-way state |
| 감사 영역 ("전체 감사 로그") | RBAC 기반 disabled 처리 이미 존재 (STEP 23) | **무수정** |
| RoleSwitcher / SyncStatus / ResetDataButton | 각자 정상 작동 | **무수정** |
| Pending Approval Queue (rule_9 Work Queue) | 클릭 시 detail drawer 진입 (이미 작동) | **무수정** |

**의존 관계:**
- `Sidebar.tsx` 안에서만 변경 — 외부 모듈 추가 import 0개
- `cn` (utils) / `cva` 같은 기존 유틸 그대로 사용
- 새 컴포넌트 / 새 store 슬라이스 / 새 액션 0개

순환 import 0건. 본 STEP은 **단일 파일 patch** — 단순한 변경 범위.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/components/layout/Sidebar.tsx` | (a) `NavItem` interface에 `disabled?: boolean` + `hint?: string` 2 필드 추가 (~6 LOC). (b) `PRIMARY` 배열의 거래/문서/Collector View 3개 항목에 `disabled: true` + 항목별 hint 추가. (c) `SECONDARY` 배열 4개 항목 모두 `disabled: true` + hint 추가. (d) `NavGroup` 컴포넌트 render 로직 — 2-way (active vs not-active) → 3-way (active / disabled / normal). disabled 분기 시 HTML `disabled` + `aria-disabled` + `tabIndex={-1}` + `title=hint` + 시각 (`text-ink-subtle opacity-60 cursor-not-allowed`) + hint 라벨 우측 정렬 표시 (~30 LOC). 다른 모든 부분 (Header / 감사 영역 / Pending Approval Queue / RoleSwitcher / SyncStatus / ResetDataButton / `Sidebar` 메인 함수) 0줄 변경. |
| `ARCHITECTURE.md` | STEP 40 changelog |

---

## 3. 신규 파일 목록

| 파일 | 역할 |
|---|---|
| `STEP_40_SIDEBAR_NAV_POLISH_COMPLETE.md` | 본 문서 |

신규 컴포넌트 / 스토어 슬라이스 / 라이브러리 / 페이지 0개. 이 STEP은 **순수
patch** — 단일 파일 안에서 완결.

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/components/layout/RoleSwitcher.tsx` | RBAC 전환 컴포넌트 — 그대로 작동 |
| `src/lib/rbac.ts` | 권한 매트릭스 무관 |
| `src/lib/persistence.ts` (STEP 27/27.7/30) | SyncStatus 표시는 그대로 |
| `src/store/useArtworkStore.ts` | 도메인 store 0줄 |
| `src/components/audit/*` (STEP 20/21/23/24/25/26) | audit 영역 무관 |
| `src/components/audit/AuditFilterBar.tsx` (STEP 24) | 0줄 |
| `src/components/audit/AuditTrailVisualization.tsx` (STEP 26) | 0줄 |
| `src/components/audit/AuditExportBar.tsx` (STEP 25) | 0줄 |
| TimelineEvent / Money Flow / Contract / Invoice / Tax / Settlement / Logistics / Curation / Inquiry / 모든 도메인 store / mock-data | 0줄 변경 |
| Persistence (STEP 27 / 27.7 / 30) / FX (STEP 31 / 32 / 34) / Market Data (STEP 19 / 29) / AI (STEP 16 / 18) | 0줄 변경 |
| 3-Column 레이아웃 / 다른 모든 Drawer / 모든 Detail Panel 컴포넌트 | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 NavItem 인터페이스 확장

```ts
interface NavItem {
  label: string;
  active?: boolean;
  badge?: number;
  /** STEP 40 — navigation 미지원 시 true. */
  disabled?: boolean;
  /** STEP 40 — disabled 시 우측에 작게 표시할 안내. */
  hint?: string;
}
```

### 5.2 Data — 항목별 hint 정책

```ts
const PRIMARY: NavItem[] = [
  { label: "작품", active: true },
  { label: "거래",          disabled: true, hint: "작품 상세에서 접근" },
  { label: "문서",          disabled: true, hint: "작품 상세에서 접근" },
  { label: "Collector View", disabled: true, hint: "준비 중" },
];

const SECONDARY: NavItem[] = [
  { label: "AI 워크플로우", disabled: true, hint: "작품 상태 액션에서 접근" },
  { label: "보고서",        disabled: true, hint: "준비 중" },
  { label: "고객",          disabled: true, hint: "준비 중" },
  { label: "설정",          disabled: true, hint: "준비 중" },
];
```

힌트 분류 정책:
- **"작품 상세에서 접근"** — Detail Panel + Drawer로 이미 접근 가능한 도메인
  (거래 / 문서). rule_10 정신 강조.
- **"작품 상태 액션에서 접근"** — DetailPanel "상태 기반 액션" + ArtworkFormDrawer의
  AI Curation/Price Suggestion 등으로 흐르는 도메인 (AI 워크플로우).
- **"준비 중"** — 향후 STEP에서 구현 예정 (Collector View / 보고서 / 고객 /
  설정).

### 5.3 NavGroup — 3-way render

```tsx
function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="px-2">
      <p className="...">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isDisabled = !!item.disabled && !item.active;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled || undefined}
                tabIndex={isDisabled ? -1 : undefined}
                title={isDisabled ? item.hint : undefined}
                className={cn(
                  "flex items-center w-full px-2.5 py-2 rounded-md text-[13px] tracking-tightish transition-colors",
                  item.active
                    ? "bg-surface-muted text-ink font-medium"
                    : isDisabled
                    ? "text-ink-subtle opacity-60 cursor-not-allowed"
                    : "text-ink-muted hover:text-ink hover:bg-surface-muted"
                )}
              >
                <span className="flex-1 text-left truncate">{item.label}</span>
                {isDisabled && item.hint && (
                  <span
                    className="ml-2 text-[9.5px] tracking-tightish text-ink-subtle truncate shrink-0 max-w-[7.5rem]"
                    aria-hidden
                  >
                    {item.hint}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

세 가지 시각 상태:
| 상태 | className 패턴 |
|---|---|
| **active** | `bg-surface-muted text-ink font-medium` |
| **normal** | `text-ink-muted hover:text-ink hover:bg-surface-muted` |
| **disabled** | `text-ink-subtle opacity-60 cursor-not-allowed` |

접근성:
- `disabled={true}` — 표준 HTML 클릭 + Enter/Space + tab focus 모두 차단
- `aria-disabled="true"` — 스크린리더에 비활성 상태 명시 (이중 안전망)
- `tabIndex={-1}` — 더더욱 명시적 keyboard skip (브라우저 차이 방어)
- `title=hint` — 마우스 hover 시 네이티브 툴팁 (sidebar 좁아 hint 잘릴 시 보완)

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    76.4 kB         163 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 24 (Audit Filters 강화) | 74.5 kB | — |
| STEP 26 (Audit Visualization) | 76.2 kB | +1.7 |
| **STEP 40 (Sidebar Nav Polish)** | **76.4 kB** | **+0.2** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_7** RBAC | ✅ | 기존 disabled 시각 언어 (`text-ink-subtle opacity-60 cursor-not-allowed`)를 nav에도 일관 적용. 권한 vs 미구현 둘 다 같은 비활성 표현 → 시스템 일관성 ↑ |
| **rule_10** 홈 = 작품 리스트 | ✅ **강화** | 미구현 항목들이 사이드바에 무책임하게 노출되던 상태에서, "작품 상세에서 접근" hint로 작품 중심 흐름을 명시적으로 가이드 |
| **rule_14** 3-Column | ✅ 0줄 | Sidebar / Artwork Grid / Detail Panel 레이아웃 무변경 |
| **rule_15** Primary 1개 | ✅ | "작품"만 active 강조 — 시각적으로 유일한 활성 navigation |
| **rule_16** 디자인 톤 | ✅ | 그림자 0, 여백 중심, 절제된 회색 톤 — disabled 항목도 dim하게만 표현 |
| 도메인 로직 변경 | ✅ 0줄 | 단일 컴포넌트 UI patch만 |
| TimelineEvent 구조 변경 | ✅ 0줄 | |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 변경 | ✅ 0줄 | |
| 3-Column 레이아웃 변경 | ✅ 0줄 | |
| Backend / 외부 라이브러리 추가 | ✅ 0건 / 0개 | |
| 신규 페이지 / Drawer | ✅ 0개 | 사용자 spec 명시 준수 |
| 작품 항목 active 유지 | ✅ | 클릭 가능 + 시각 강조 그대로 |
| 비활성 항목 클릭 시 무동작 | ✅ | HTML `disabled`로 보장 |
| Hover 시 clickable처럼 보이지 않음 | ✅ | hover 효과 제거 (`text-ink-subtle opacity-60 cursor-not-allowed`만) |
| Global Audit 진입점 정상 | ✅ | 별도 컴포넌트 (전체 감사 로그 버튼) — 무수정 |
| RoleSwitcher 정상 | ✅ 0줄 | |
| SyncStatus 정상 | ✅ 0줄 | |
| `aria-disabled="true"` | ✅ | |
| `tabIndex={-1}` | ✅ | |
| Active vs disabled 시각 차이 명확 | ✅ | active = `text-ink font-medium`, disabled = `text-ink-subtle opacity-60` |

---

## 8. 검증 시나리오

### A — "작품" active 정상

1. 페이지 로드 → 사이드바 "작품"이 `bg-surface-muted text-ink font-medium`으로 강조 표시
2. **기대**: 클릭 가능 (이미 active이므로 변화 없지만 hover 효과 정상)

### B — 거래 항목 disabled

1. 사이드바 "거래" 마우스 over
2. **기대**:
   - cursor `not-allowed` 표시
   - `bg-surface-muted` hover 적용 안 됨
   - 우측에 작은 회색 텍스트 "작품 상세에서 접근"
   - 마우스 잠시 머무르면 네이티브 툴팁 "작품 상세에서 접근"
3. 클릭 시도 → **아무 일 안 일어남** (HTML `disabled`)

### C — 문서 / Collector View / AI 워크플로우 / 보고서 / 고객 / 설정 — 모두 같은 패턴

각 항목별 hint 라벨 정확:
- 문서: "작품 상세에서 접근"
- Collector View: "준비 중"
- AI 워크플로우: "작품 상태 액션에서 접근"
- 보고서: "준비 중"
- 고객: "준비 중"
- 설정: "준비 중"

### D — Keyboard tab 흐름

1. 페이지 로드 → Tab 키 반복
2. **기대**: "작품" 항목엔 포커스 가능, 비활성 7개 항목은 모두 skip. RoleSwitcher / "전체 감사 로그" 버튼 / Reset 버튼 등은 정상 포커스.

### E — 스크린리더 (NVDA / VoiceOver)

1. 비활성 항목 위 포커스 시도
2. **기대**: "비활성 (dimmed) 버튼 — 거래" 같은 announcement (`aria-disabled="true"` 활성 시 스크린리더 표준)

### F — 좁은 화면 / 긴 한국어 라벨

1. 사이드바 폭 좁힘 (DevTools)
2. **기대**: hint가 `truncate max-w-[7.5rem]`로 잘림 — wrap 발생 안 함. label도 `truncate` — 라벨 자체가 길어도 한 줄 유지.

### G — Manager → Owner 권한 전환 시 정상

1. RoleSwitcher → Owner
2. **기대**: 비활성 nav 항목들은 모두 그대로 비활성 (RBAC와 무관, 미구현 상태). "전체 감사 로그"만 권한에 따라 활성/비활성.

### H — Persistence (STEP 27/27.7/30) 호환

1. F5 새로고침
2. **기대**: 상태 영속 — "작품"만 active 그대로, 다른 항목 disabled 그대로.

### I — 다른 영역 무영향

1. "전체 감사 로그" 클릭 → GlobalAuditDrawer 정상 (STEP 23/24/26 통합 그대로)
2. RoleSwitcher 클릭 → 권한 전환 정상
3. 저장 데이터 초기화 → 정상
4. Pending Approval Queue 항목 클릭 → 해당 detail drawer 진입 정상
5. **기대**: 모든 영역 사용자 시각 검증 통과한 상태 유지

### J — 도메인 흐름 무영향

1. 작품 클릭 → DetailPanel → Inquiry 응답 / Invoice 발송 / Settlement / Tax / Logistics / Resale 등 모든 도메인 액션
2. **기대**: 본 STEP은 sidebar UI patch만 — 모든 도메인 흐름 v34+STEP24+STEP26 baseline과 동일 동작.

### K — Audit drawer 무영향

1. 작품 클릭 → "감사 로그 보기" → AuditLogDrawer
2. STEP 24 6-axis 필터 + STEP 26 시각화 모두 정상
3. Sidebar "전체 감사 로그" 클릭 → GlobalAuditDrawer 정상
4. **기대**: 시각 검증 통과한 상태 100% 보존.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Hint가 한 항목당 한 줄 | 좁은 sidebar에서 일부 hint 잘릴 가능성 — `title` attribute로 보완 | 추후 sidebar collapse/expand 토글 추가 시 더 넓은 view 가능 |
| "준비 중" 항목들이 4개 (Collector View / 보고서 / 고객 / 설정) | 시각적으로 disabled 항목이 많아 sidebar가 부정적 인상 | 후속 STEP에서 의미 있는 진입점으로 점진 전환 (STEP 35 보고서 / STEP 41 Collector View 등) |
| 미구현 항목은 단순 placeholder | 클릭 자체가 차단 — modal로 "이 기능은 X에서 가능합니다" 안내 표시 등은 안 함 | hint + title attribute로 충분하다고 판단. 추후 사용자 피드백 시 확장 가능 |
| `aria-disabled` + HTML `disabled` 둘 다 적용 | 일부 스크린리더는 disabled 항목 자체를 announcement에서 skip하지만 현재 구현은 명시적이라 안전 | 의도된 동작 |
| Active 항목 onClick 부재 | 현재 "작품"이 active이므로 새로 클릭할 일 없음 — 향후 다른 항목이 active 가능해지면 onClick 필요 | 본 STEP 범위 외 |
| Hint 다국어 부재 | 모두 한국어 하드코딩 | i18n 작업 시 함께 처리 |

---

## 10. 다음 STEP 후보

본 STEP은 누적 시각 검증 통과 후 발견된 polish 결함을 수습. 이제 본격 기능
고도화 가능:

1. **STEP 38 — Saved Filter Preset** — 본 STEP 24의 자주 쓰는 필터 조합을
   사용자별 저장. STEP 26 시각화도 preset과 함께 즉시 복원. Persistence 슬라이스
   1개 추가. **본 STEP 24/26 audit 영역 자연스러운 후속**.
2. **STEP 35 — Multi-currency Reporting Layer** — "보고서" 항목 활성화 +
   KRW 통일 환산 리포트. 본 STEP 40에서 disabled 처리한 "보고서"가 의미 있는
   진입점으로 변환.
3. **STEP 41 — Collector View** — 본 STEP 40에서 "준비 중"으로 표시한 Collector
   View 구현. 고객별 보유 작품 + 거래 이력.
4. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현.
5. **STEP 36 — Settlement Currency-aware Net** — splitSettlement / splitTax
   helper에 currency 파라미터.
6. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price
   suggestion 실 AI API.
7. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
8. **STEP 30.5 — Periodic Pull / Polling** — multi-device 자동 갱신.
9. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step
   approval.
10. **STEP 39 — Audit Heatmap** — 7일 × N주 grid heatmap 추가.
