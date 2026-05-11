# Artwork UX Enhancement — Material + Size Conversion — Completion Report

## State

**STEP 84 baseline (147 kB) → Artwork UX (149 kB).**
Build / type-check / lint all green.
Route delta: **+2 kB** (artwork-material-presets.ts + artwork-size-conversion.ts + 3 new sub-components in ArtworkFormDrawer).
ZIP: `axvela-artwork-material-size-ux.zip`.

**Scoped Subset 진행** — Image normalization / Multi-currency FX는 별도 STEP으로 분리.

---

## 1. 현재 ArtworkForm 구조 분석

### 기존 form 구조 (변경 전)
```
ArtworkFormDrawer
├ FormSection "기본 정보"
│  ├ TextField "작품명"
│  ├ TextField "작가" / "작가 영문명"
├ FormSection "작품 정보"
│  ├ TextField "제작 연도"
│  ├ TextField "매체"           ← 자유 입력 only, 가이드 부재
│  └ TextField "크기"           ← 단일 string ("162.0 × 130.3 cm")
└ FormSection "거래"
   ├ TextField "가격" (KRW)
   ├ STEP 18 AI Price Suggestion (별도 영역)
   └ ...
```

### Artwork type (변경 0건)
```typescript
interface Artwork {
  ...
  medium: string;        // ← 그대로 사용
  dimensions: string;    // ← "162.0 × 130.3 cm" 그대로 사용
  ...
}
```

**핵심 통찰**: `medium` / `dimensions`는 plain string 필드. 본 STEP은 *UI 입력 흐름 개선*만 하고 *데이터 모델은 그대로* — 폼 진입 시 string parse, 저장 시 동일 형식 string으로 직렬화.

---

## 2. 변경 파일 목록

| File | Change | LOC |
|---|---|---|
| `src/lib/artwork-material-presets.ts` | **신규** — preset chip 12개 list | 38 |
| `src/lib/artwork-size-conversion.ts` | **신규** — 환산 + parse + 호수 reference | 288 |
| `src/components/artwork/ArtworkFormDrawer.tsx` | UI 변경 + 3 sub-components 추가 | ~280 |
| `ARCHITECTURE.md` | entry append | ~8 KB |
| `STEP_ARTWORK_MATERIAL_SIZE_UX_COMPLETE.md` | 본 보고서 | — |

### 변경 파일 0건 (사용자 spec 준수)
- 모든 image upload 관련 파일 (`ArtworkImageUpload.tsx`, `image-*.ts`, `/api/upload-image`)
- 모든 FX / currency 파일
- Payment / Settlement / Tax / Invoice / AI / Logistics / Documents 도메인
- Audit / Backup / Permission 도메인
- 3-column layout
- `package.json` (신규 라이브러리 0개)

---

## 3. 신규 helper 목록

### `src/lib/artwork-material-presets.ts` (38 LOC)
```typescript
export const ARTWORK_MATERIAL_PRESETS: ReadonlyArray<string> = [
  "Oil on Canvas",
  "Acrylic on Canvas",
  "Mixed Media",
  "Ink on Paper",
  "Watercolor on Paper",
  "Photography",
  "Digital Print",
  "Sculpture",
  "Bronze",
  "Ceramic",
  "Installation",
  "Video",
];
```

**원칙**: 자유 입력 보조 — 사용자는 preset 외 임의 문자열 자유 입력 가능. enum 강제 0건.

### `src/lib/artwork-size-conversion.ts` (288 LOC)

**Pure conversion math**:
- `cmToInch(cm)` — 1 inch = 2.54 cm 정확값
- `inchToCm(inch)` — 소수점 첫째 자리 반올림

**Parse / format — legacy 호환**:
- `parseDimensionsString(raw): ParsedDimensions | null` — best-effort parser
- `formatDimensionsString(parsed): string` — 직렬화 (기존 표기와 호환)

**Korean canvas reference**:
- `KOREAN_CANVAS_F_SIZES` — 1호 ~ 200호 F형 reference table (20 entries)
- `KOREAN_CANVAS_NO_LIST` — UI dropdown용 호수 list
- `lookupKoreanCanvasNo(width, height)` — ±5% tolerance 매칭 (가로/세로 swap 허용)
- `koreanCanvasNoToDimensions(no)` — 호수 → 대표 cm

**High-level**:
- `buildSizeReferenceLabel(parsed)` — drawer inline reference 라벨 한 줄

---

## 4. Material preset 설계

### Chip 12개 — 사용 빈도 순서
```
Canvas 회화: Oil on Canvas / Acrylic on Canvas / Mixed Media
Paper:       Ink on Paper / Watercolor on Paper
Photography/Digital: Photography / Digital Print
Sculpture:   Sculpture / Bronze / Ceramic
Installation/Video: Installation / Video
```

### UX
```
[작품 재료(Material) *]
[Oil on canvas______________________]      ← 자유 입력 가능
hint: "자유 입력 가능 — 아래 chip은 자주 쓰이는 재료 가이드"

자주 쓰이는 재료
[Oil on Canvas] [Acrylic on Canvas] [Mixed Media] [Ink on Paper]
[Watercolor on Paper] [Photography] [Digital Print] [Sculpture]
[Bronze] [Ceramic] [Installation] [Video]
                         ↑
                 활성 chip은 ring border + ink 텍스트
                 (현재 입력값과 일치 시)
```

### 동작
- chip 클릭 → input value 그대로 chip 라벨로 교체
- 사용자가 input 직접 편집 → 일치 chip 활성, 불일치 chip 모두 비활성
- 활성 chip 표시: `bg-ink/5 + border-line-strong + text-ink`
- 비활성 chip 표시: `bg-surface + border-line + text-ink-subtle + hover:border-line-strong`

---

## 5. Size conversion 설계

### 구조화 입력 UI
```
[크기 *]                              [cm | inch] ← 단위 토글
[가로__] × [세로__] × [깊이__(선택)] cm

자동 환산 참고: ≈ 63.78 × 51.30 inch · 100호 (F형 기준)
                        ↑
                  반대 단위 + 호수 reference (매칭 시만)

호수 입력 도우미  [호수 선택… ▾] [적용]   F형 기준 참고값 — 운영 참고용
                                        ↑
                                  호수 적용 시 width/height 자동 채움 (cm 단위로)
```

### 동작 흐름

**입력 시**:
1. 사용자가 cm 단위로 162.0 / 130.3 입력
2. `buildSizeReferenceLabel` 자동 호출
3. \"≈ 63.78 × 51.30 inch · 100호 (F형 기준)\" 표시

**단위 토글 시**:
1. cm → inch 토글 클릭
2. width / height 입력값은 그대로 유지 (사용자가 새 단위로 다시 입력)
3. reference label은 새 단위 기준으로 갱신

**호수 적용 시**:
1. dropdown에서 \"100호\" 선택 → [적용] 클릭
2. `koreanCanvasNoToDimensions(100)` → `{widthCm: 162.2, heightCm: 130.3}`
3. setSizeUnit(\"cm\") + setSizeWidth(\"162.2\") + setSizeHeight(\"130.3\")
4. reference label 자동 갱신

### 매칭 정책 — `lookupKoreanCanvasNo`
- 가로 / 세로 max값이 호수 widthCm과 ±5% 이내
- 가로 / 세로 min값이 호수 heightCm과 ±5% 이내
- 가로/세로 swap 허용 (작품은 세로/가로 자유)
- 비-F형 작품은 매칭 실패 (정상) — 호수 표시 안 함

### Legacy 호환 round-trip
```
입력 (legacy):     "162.0 × 130.3 cm"
↓ parseDimensionsString
parsed:           { width: 162, height: 130.3, depth: undefined, unit: "cm" }
↓ UI 편집 (예: depth 5cm 추가)
edited:           { width: 162, height: 130.3, depth: 5, unit: "cm" }
↓ formatDimensionsString (저장 시)
serialized:       "162.0 × 130.3 × 5.0 cm"
```

### 지원 입력 형식 (parser tolerance)
- `"162.0 × 130.3 cm"` — 표준
- `"162 x 130 cm"` — x (소문자)
- `"162.0×130.3×5.0 cm"` — depth + 공백 없음
- `"63.78 x 51.30 inch"` — inch 단위
- `"162.0 × 130.3"` — 단위 부재 (cm 가정)
- 실패 → null → drawer가 빈 상태로 시작 (사용자 새로 입력)

---

## 6. Persistence 영향 분석

### Schema 변경 0건 ✅
| Type | 상태 |
|---|---|
| `Artwork.medium: string` | **그대로** — 자유 입력 string 유지 |
| `Artwork.dimensions: string` | **그대로** — \"162.0 × 130.3 cm\" 형식 유지 |
| `ArtworkInput` interface | **그대로** — 동일 string 필드 |
| `validateV1` | **그대로** — 검증 로직 무영향 |
| `SCHEMA_VERSION` | **그대로** — v1 유지 |
| `PersistedState` shape | **그대로** |

### Round-trip 검증
- 기존 데이터 (\"162.0 × 130.3 cm\") → form 진입 → parse → 구조화 표시 → 편집 / 그대로 → 저장 → 동일 string 형식
- 새 데이터 (구조화 입력) → 저장 → \"162.0 × 130.3 cm\" 형식 → 다음 진입 시 parse 성공

### 기존 작품 데이터 migration 0건 ✅
- localStorage / backup JSON / persistence schema 모두 무영향
- 사용자 기존 작품 record는 자연스럽게 새 UI와 호환

---

## 7. Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                 — No ESLint warnings or errors
✓ npx next build                — Route 149 kB / First Load 236 kB (+2 kB)
```

### Validation Checklist (사용자 spec)
| 항목 | 결과 |
|---|---|
| Material preset chip 클릭 정상 | ✅ chip → input value 즉시 교체 |
| 자유 입력 정상 | ✅ chip 외 임의 문자열 가능 |
| 기존 medium 데이터 표시 정상 | ✅ legacy data 그대로 표시 |
| cm → inch 변환 정상 | ✅ buildSizeReferenceLabel inline 표시 |
| inch → cm 변환 정상 | ✅ 단위 토글 시 동일 helper |
| 호수 reference 정상 | ✅ ±5% tolerance 매칭 + dropdown 적용 |
| build / type-check / lint 통과 | ✅ 모두 통과 |
| Route delta | ✅ +2 kB (149 kB) |

### Forbidden Language Verification
```
$ grep -rnE "정확한 규격 보장|certified conversion|법적 효력|공인 규격" \
    src/lib/artwork-size-conversion.ts \
    src/lib/artwork-material-presets.ts \
    src/components/artwork/ArtworkFormDrawer.tsx

→ 1 hit at artwork-size-conversion.ts:147 — JSDoc comment "운영 참고용 only,
  공인 규격 / 법적 효력 무관" (negative form 정책 명시)
→ UI / message / hint / placeholder 노출 0건
```

권장 표현 사용:
- \"운영 참고\" / \"자동 환산 참고\" / \"호수 기준 참고값\" / \"F형 기준\"
- 모든 helper 라벨이 부정형 disclaimer 호환

### AXVELA AI Direction Policy 준수
- ✅ AI / Market Intelligence 영역 무관 (form input UX만)
- ✅ 금지 표현 0건 (AI Estimated Price / 감정가 / 확정 시장가 등 무관)
- ✅ rule_5 AI-Human Loop 일관 (AI 자동 0건, 모든 입력 사용자 명시)

---

## 8. 영향 범위 요약

### 직접 변경 (3 파일)
1. `artwork-material-presets.ts` (신규)
2. `artwork-size-conversion.ts` (신규)
3. `ArtworkFormDrawer.tsx` (form fields + 3 sub-components)

### 0줄 변경 (사용자 spec 제약 준수)
- Image upload 관련 모든 파일
- FX / currency 모든 파일
- Payment / Settlement / Tax / Invoice / AI / Logistics / Documents
- Audit / Backup / Permission (STEP 65/78/80~85)
- Persistence schema / `Artwork` type / `ArtworkInput` interface
- 3-column layout
- `package.json`

### 자연 통합 (코드 변경 0줄)
- `ArtworkCard` — `dimensions: string` 그대로 사용 (\"162.0 × 130.3 cm\" 표시)
- `DetailPanel` — `medium` / `dimensions` 그대로 표시
- `Documents Hub` — Artwork 데이터 그대로
- Backup / Restore — Artwork 데이터 그대로
- Audit log — Artwork 변경 audit 자연 발생

---

## 9. Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_1 Artwork-First** | Artwork form은 작품 entity 진입점 — 입력 UX 개선이 가장 직접적 영향 |
| **rule_4 Trust Layer 보존** | 모든 환산 / 호수 매칭은 \"운영 참고\" 명시 — 정확 규격 / 법적 효력 무관 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 모든 입력 사용자 명시 trigger |
| **rule_7 RBAC** | `artwork.create` / `artwork.update` 권한 가드 (STEP 27 그대로) — 본 변경 무영향 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | form footer button 한도 그대로 |
| **rule_16 미니멀 디자인** | text-first / 작은 typography (text-[9.5px]/[10px]/[10.5px]/[11.5px]) / tabular-nums / 그림자 0 |
| **rule_17 Layer UI** | drawer 그대로 — sub-component는 inline |
| **AXVELA AI Direction** | AI / Market Intelligence 무관, 금지 표현 0건 |

---

## 🎯 Mid-update 직전 마지막 변경

이번 ZIP은 **mid-update phase 직전 마지막 변경**입니다. 

### 이 ZIP에 포함된 모든 변경 (이번 세션)
1. STEP 78 — Audit Log Filter Drilldown
2. STEP 81 — Backup / Restore Audit
3. STEP 82 — Permission Change Audit
4. STEP 83 — Audit Event Export
5. STEP 85 — Audit Trend Visualization
6. **AXVELA AI Direction 정책 영구 기록**
7. STEP 84 — System Health / Storage Capacity Audit
8. **Artwork UX Enhancement** (Material + Size) ⭐ 방금

총 **8개 변경**, Route 141 → 149 kB (+8 kB).

### 다음 단계
1. GitHub push → Vercel 자동 배포
2. 며칠 ~ 1주일 실 사용 검증
3. 검증 후 다음 라운드 결정:
   - Image normalization 별도 STEP (STEP 84 system signals 위 안전하게)
   - Multi-currency + FX 별도 STEP (Tax phase와 연결 검토)
   - STEP 86 Tax phase 시작 (Cash Receipt Layer)
   - STEP 99 Gallery-Controlled Visibility (Phase 3 사전 작업)
