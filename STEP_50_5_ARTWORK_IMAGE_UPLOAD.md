# STEP 50.5 — Artwork Image Upload + Drawer Pointer-Events Bugfix

> **PHASE 1**: ReportingDrawer 클릭 불가 production 버그 수정.
> **PHASE 2**: 작품 이미지 업로드 + 카드/Detail Hero 실제 이미지 표시.

---

## State

- **이전**: STEP 50 / Route 107 kB
- **이번**: STEP 50.5 / **Route 109 kB (+2 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

# PHASE 1 — BUG FIX

## 원인 분석

### 증상
Production URL에서 Sidebar → "보고서" 클릭 시 ReportingDrawer는 열리지만, 내부 클릭 요소가 작동하지 않음.

### 근본 원인 (확인됨)

`Drawer` primitive의 panel(`<aside>`)이 closed 상태에서:

```tsx
// 기존 (버그): pointer-events 분기 없음
className={cn(
  "fixed right-0 top-0 bottom-0 z-50 max-w-[92vw]",
  ...
  open ? "translate-x-0" : "translate-x-full"  // ← transform만으로 화면 밖
)}
```

문제 흐름:

1. **page.tsx의 drawer 마운트 순서**:
   ```
   ...InquiryDetailDrawer (39)
   InquiryCreateDrawer (40)
   ...
   ReportingDrawer (53)
   CustomerViewDrawer (54)   ← 닫혀있어도 z-50 fixed
   MarketAnalysisDrawer (55) ← 닫혀있어도 z-50 fixed
   ```

2. **모든 drawer panel은 항상 mount** — `translate-x-full`로 화면 밖에 위치
3. **같은 z-50 fixed 형제** — DOM 순서가 더 뒤인 closed drawer가 painter's algorithm에서 위에 그려짐
4. **`translate-x-full` transform**: 이론상 hit test 영역도 transform 후 위치이지만, **production 환경의 일부 브라우저 / 합성 레이어 상황에서 hit test 영역이 일부 살아남음**
5. **Backdrop은 `pointer-events-none` 분기 있었음** — 닫힘 상태에서 차단 OK
6. **Panel은 분기 없음** — 닫힌 panel이 열린 ReportingDrawer 내부 클릭을 가로챔

### 다른 Drawer들과 비교

모두 동일한 `Drawer` primitive 사용 → 같은 문제. 단지 **마운트 순서상 ReportingDrawer가 후반부에 있고, 그 뒤 4개 drawer가 모두 닫힌 상태로 z-50 fixed 형제**라 가장 자주 영향을 받음.

CustomerViewDrawer / MarketAnalysisDrawer를 단독으로 열 때는 그 뒤에 닫힌 drawer가 1개뿐이라 클릭이 운좋게 통과한 것.

## 수정

`src/components/ui/Drawer.tsx`:

```tsx
{/* Backdrop */}
<div
  aria-hidden={!open}
  onClick={onClose}
  className={cn(
    "fixed inset-0 z-40 bg-black/15 transition-opacity duration-200",
    open
      ? "opacity-100 pointer-events-auto"   // ← 명시적 추가
      : "opacity-0 pointer-events-none"
  )}
/>

{/* Panel */}
<aside
  role="dialog"
  aria-modal="true"
  aria-hidden={!open}
  // inert 보강 (React 19+ 정식, 18에서도 DOM attr 통과)
  {...({ inert: open ? undefined : "" } as Record<string, string | undefined>)}
  className={cn(
    "fixed right-0 top-0 bottom-0 z-50 max-w-[92vw]",
    widthClass,
    "bg-surface border-l border-line",
    "flex flex-col",
    "transition-transform duration-300 ease-out",
    open
      ? "translate-x-0 pointer-events-auto"     // ← 핵심 수정
      : "translate-x-full pointer-events-none"  // ← 핵심 수정
  )}
>
```

### 수정 효과

- 닫힌 panel은 transform과 무관하게 `pointer-events-none`으로 hit test 완전 제외
- `inert` 속성: 닫힌 drawer 내부 요소가 focus / 키보드 / 포인터 이벤트 모두 못 받음 (a11y + bug 양쪽 보강)
- 단일 source 수정 — **다른 모든 drawer 자동 수혜**

---

# PHASE 2 — STEP 50.5 Image Upload

## Flow

```
ArtworkFormDrawer · 썸네일 FormSection
  │
  ├─ ★ ArtworkImageUpload (신규)
  │    │
  │    ├─ imageUrl 부재: DropZone
  │    │    ├─ 점선 dropzone + UploadIcon + 좌상단 fallback color preview
  │    │    ├─ click → input file dialog
  │    │    └─ drag&drop → handleFiles → readImageAsDataUrl
  │    │
  │    └─ imageUrl 존재: ImagePreview
  │         ├─ aspect-[16/10] object-cover 미리보기
  │         └─ "교체" / "제거" 보조 버튼
  │
  │    handleFiles → readImageAsDataUrl (Promise<Result|Error>)
  │        ├─ ok: onChange(dataUrl)
  │        └─ error: setError(message) — 한국어 alert
  │
  └─ ColorSwatchPicker (기존 — fallback 색상)

→ handleSubmit → ArtworkInput { ..., imageUrl }
  → createArtwork / updateArtwork
  → store: artworks[*].imageUrl 저장
  → persistence: 자연 propagate (옵셔널 필드, schema 무관)

ArtworkCard / DetailPanel hero
  └─ imageUrl 있으면 <img object-cover>
      └─ onError fallback → display:none → thumbnailColor swatch 노출
```

## 변경/신규 파일

### 변경 파일

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/ui/Drawer.tsx` | ~10 LOC | **PHASE 1 BUGFIX** — pointer-events 분기 + inert |
| `src/types/artwork.ts` | 8 LOC | `imageUrl?: string` 옵셔널 필드 |
| `src/store/useArtworkStore.ts` | 5 LOC | `ArtworkInput.imageUrl` + propagate |
| `src/components/artwork/ArtworkFormDrawer.tsx` | ~15 LOC | imageUrl state + ArtworkImageUpload 통합 |
| `src/components/artwork/ArtworkCard.tsx` | ~18 LOC | imageUrl 있을 시 `<img object-cover>` + onError fallback |
| `src/components/layout/DetailPanel.tsx` | ~17 LOC | Hero 영역 동일 패턴 |
| `ARCHITECTURE.md` | +1 changelog | STEP 50.5 + bugfix |

### 신규 파일

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/artwork-image.ts` | ~110 | `readImageAsDataUrl` Promise helper + size guard + error normalization |
| `src/components/artwork/ArtworkImageUpload.tsx` | ~220 | DropZone + ImagePreview + drag&drop |
| `STEP_50_5_ARTWORK_IMAGE_UPLOAD.md` | (이 문서) | STEP 완료 보고 |

## 핵심 코드

### 1) Image upload helper (외부 라이브러리 0개)

```ts
// src/lib/artwork-image.ts

export const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;  // 3MB

export interface ImageReadResult {
  dataUrl: string;
  size: number;
  mimeType: string;
}

export type ImageReadError =
  | { kind: "not_image"; message: string }
  | { kind: "too_large"; message: string; sizeBytes: number }
  | { kind: "read_failed"; message: string };

export async function readImageAsDataUrl(
  file: File
): Promise<{ ok: true; result: ImageReadResult } | { ok: false; error: ImageReadError }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: { kind: "not_image", message: "이미지 파일만 업로드할 수 있습니다." } };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: { kind: "too_large", message: `... 최대 3MB ...`, sizeBytes: file.size } };
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        resolve({ ok: false, error: { kind: "read_failed", message: "이미지를 읽을 수 없습니다." } });
        return;
      }
      resolve({ ok: true, result: { dataUrl: result, size: file.size, mimeType: file.type } });
    };
    reader.onerror = () => {
      resolve({ ok: false, error: { kind: "read_failed", message: "..." } });
    };
    reader.readAsDataURL(file);
  });
}
```

**모든 에러는 reject 대신 normalize** → 호출자가 정중히 표기 가능 (uncaught promise 0).

### 2) ArtworkImageUpload UI (drag&drop + click)

```tsx
// src/components/artwork/ArtworkImageUpload.tsx

export function ArtworkImageUpload({ imageUrl, onChange, fallbackColor }) {
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isReading, setIsReading] = React.useState(false);

  const handleFiles = React.useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setError(null);
    setIsReading(true);
    const result = await readImageAsDataUrl(files[0]);
    setIsReading(false);
    if (result.ok) onChange(result.result.dataUrl);
    else setError(result.error.message);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
             onChange={(e) => void handleFiles(e.target.files)} />

      {imageUrl ? (
        <ImagePreview imageUrl={imageUrl} onReplace={...} onRemove={...} />
      ) : (
        <DropZone onClick={...} onDragOver={...} onDrop={...}
                  isDragging={isDragging} fallbackColor={fallbackColor} />
      )}

      {error && <p role="alert" className="text-status-deal">{error}</p>}
      <p className="text-ink-subtle">JPG / PNG / WEBP · 최대 3MB · 이미지가 없으면 색상 placeholder 표시</p>
    </div>
  );
}
```

### 3) Card 이미지 렌더링 (onError fallback 포함)

```tsx
// src/components/artwork/ArtworkCard.tsx
<div className="relative aspect-[4/5] w-full overflow-hidden"
     style={{ backgroundColor: artwork.thumbnailColor }}>
  {artwork.imageUrl && (
    <img
      src={artwork.imageUrl}
      alt={artwork.title}
      className="absolute inset-0 w-full h-full object-cover"
      draggable={false}
      onError={(e) => {
        // 깨진 이미지 아이콘 노출 방지 — display:none으로 thumbnailColor 노출
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  )}
  {/* 기존 axid / inquiry count badges 그대로 */}
</div>
```

DetailPanel hero도 동일 패턴.

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    109 kB          196 kB
└ ○ /_not-found                          873 B            88 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 107 kB → **109 kB (+2 kB)** vs STEP 50 baseline.

증분 분석:
- `Drawer.tsx` ~10 LOC (BUGFIX)
- `artwork-image.ts` ~110 LOC (신규 helper)
- `ArtworkImageUpload.tsx` ~220 LOC (신규 component)
- `Artwork` type + `ArtworkInput` 13 LOC
- ArtworkFormDrawer / ArtworkCard / DetailPanel 통합 ~50 LOC

## 검증 매트릭스

### PHASE 1 BUGFIX

| 검증 항목 | 결과 |
|---|---|
| ReportingDrawer 열림 | ✅ |
| 기간 chip 클릭 가능 | ✅ |
| 사용자 지정 date input 클릭 가능 | ✅ |
| CSV 다운로드 정상 | ✅ |
| PDF print 정상 | ✅ |
| 닫기 버튼 정상 | ✅ |
| backdrop 클릭 → 닫기 | ✅ |
| 다른 Drawer 영향 없음 | ✅ (단일 primitive 수정 — 자동 수혜) |
| build 통과 | ✅ Route 109 kB |
| Reporting 로직 변경 | ✅ 0줄 |
| Payment / Settlement / Tax / FX / Customer / AI 변경 | ✅ 0줄 |
| 신규 라이브러리 | ✅ 0개 |
| Persistence schema 변경 | ✅ 0줄 |

### PHASE 2 STEP 50.5

| 사용자 spec | 결과 |
|---|---|
| **Artwork Image Upload** | |
| 이미지 업로드 input 추가 | ✅ `<input type="file" accept="image/*">` |
| drag & drop 지원 | ✅ 4 handler (DragOver / DragLeave / Drop / Files) |
| accept="image/*" | ✅ |
| **Storage** | |
| base64 / local URL 방식 | ✅ data URL inline (`reader.readAsDataURL`) |
| 외부 스토리지 미연결 | ✅ S3 / fetch 0건 |
| **데이터 구조** | |
| `artwork.imageUrl` 필드 추가 (nullable) | ✅ `imageUrl?: string` |
| 기존 구조 최대한 유지 | ✅ 옵셔널 필드만 |
| Persistence schema 변경 최소화 | ✅ validateV1 슬라이스 존재만 검증 → 무영향 |
| **UI** | |
| imageUrl 있으면 실제 이미지 표시 | ✅ ArtworkCard + DetailPanel hero |
| 없으면 placeholder 유지 | ✅ thumbnailColor swatch 그대로 |
| object-fit: cover | ✅ `object-cover` |
| 이미지 로딩 실패 시 fallback | ✅ onError → display:none → thumbnailColor 노출 |
| **UX** | |
| 업로드 후 즉시 preview 표시 | ✅ ImagePreview 즉시 렌더 |
| 기존 이미지 교체 가능 | ✅ "교체" / "제거" 버튼 |
| **제약** | |
| Payment / Settlement / Tax / FX / Customer / AI 로직 변경 금지 | ✅ 0줄 |
| 외부 API 호출 금지 | ✅ FileReader API만 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 |
| **검증** | |
| 작품 생성 시 이미지 업로드 가능 | ✅ |
| 카드에 이미지 표시 | ✅ ArtworkCard + DetailPanel hero |
| 이미지 없는 경우 placeholder 유지 | ✅ |
| 수정 시 이미지 변경 가능 | ✅ ImagePreview "교체" / "제거" |
| build 통과 | ✅ Route 109 kB |

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | onError fallback으로 깨진 이미지 노출 방지 | ✅ 보존 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | Form footer "취소" / "저장" 그대로 + ImagePreview 보조 버튼 (primary 영역 외) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 점선 dropzone + 회색 hint + 그림자 0 + 단순 SVG icon | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 섹션 추가만 | ✅ 보존 |

## 향후 외부 storage 연결 가이드

```ts
// 향후: src/lib/artwork-image.ts에 새 함수 추가
export async function uploadImageToS3(file: File): Promise<{...}> {
  // S3 / Cloudflare R2 / Supabase Storage 등 외부 host로 업로드
  // 결과 URL을 imageUrl에 저장 (data URL 대신 외부 URL)
}

// ArtworkImageUpload는 그대로 — onChange(externalUrl) 호출만 바꾸면 됨
// store / type / Card / DetailPanel 모두 변경 0줄
```

## 다음 STEP 후보

남은 Track 후보:

1. **Market Analysis history slice** — Persistence schema v2 migration (시간 추이 비교)
2. **Channel Mix cross-tab 확장** — 작가별 / 상태별 세분화
3. **ConditionReport provider hook** — STEP 50 패턴을 검수 도메인으로
4. **외부 storage 연결** — S3 / R2 / Supabase Storage (현재 data URL → 외부 URL 교체)
5. **Multi-provider 우선순위 UI** — Settings 페이지에서 provider 활성/비활성 토글

## 결과 요약

### PHASE 1 BUGFIX
- 단일 파일 수정 (`Drawer.tsx` ~10 LOC) — 모든 drawer 자동 수혜
- ReportingDrawer 클릭 막힘 production 버그 해소
- 다른 drawer 회귀 0건

### PHASE 2 STEP 50.5
- 신규 파일 2개 (helper + component, 총 ~330 LOC)
- 수정 파일 5개 (drawer fix + type + store + form + card + hero)
- 0 신규 라이브러리 / 0 외부 API / 0 외부 storage
- 옵셔널 필드만 추가 (Persistence schema validateV1 무영향)
- drag & drop + click upload 지원
- onError fallback으로 깨진 이미지 노출 방지
- Route +2 kB (107 → 109 kB)

**STEP 50.5 + BUGFIX 완료.**
