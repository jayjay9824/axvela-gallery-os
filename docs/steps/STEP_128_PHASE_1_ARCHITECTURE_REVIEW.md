# STEP 128 — Phase 1 Architecture Review (AXVELA PASSPORT + Multilingual + AXID Multi-Layer + PDF Decision Matrix)

**작성 시점**: 2026-05-12
**Baseline**: `75e300b` (STEP 127 완전 종결 — ZIP package + index update)
**Branch**: `claude/step127-architecture-review` (Phase 1.0 검증 → Phase 1.1 분석, 단일 doc-only 산출)
**작업 성격**: 분석·설계·옵션 비교·STEP 분리 재정의·보존 약속 검증 — **코드 변경 0줄**, **AXVELA_*.md 6 영구 정책 본문 변경 0줄**, **rule_14 / rule_17 본문 직접 수정 0줄** (amendment 제안만 본 doc 에 명시)

---

## §0 Executive Summary

사용자 spec #5 의 4 영역 (AXID 2-layer / Multilingual schema policy / AXVELA PASSPORT / PDF architecture) 을 architecture review. **결론 요약**:

1. **AXID 2-layer** — 현재 single `code: string` free-form 정착. 사용자 spec 의 4-component 분해 (internal id + display label + UNIQUE index + QR security) 는 *추가 옵셔널 슬롯 + helper layer* 로 완전 흡수 가능, persistence v1 boundary 무손상. **Optional Slice 9회째 후보**.
2. **Multilingual schema policy** — `artist.nameEn?` 가 *이미 부분 multilingual* 정착 (single-locale partial). 사용자 spec 의 full multilingual 확장은 **옵션 (B) Optional Slice + (C) Locale-aware getter helper 의 hybrid** 가 최적 — v2 migration (옵션 A) 은 정책 위반으로 비권장.
3. **AXVELA PASSPORT** — PASSPORT-1_SPEC.md §12 가 *"기존 Drawer 시스템 제거 금지"* 명시 → **Dual-layer 분리 architecture 옵션 (A) 채택 가능** (Passport UI = 작품 중심 공식 기록 / 기존 Drawer = 운영·admin workflow). rule_14 (3-Column) 와 rule_17 (Layer UI) **본문 amendment 불필요** — Passport 가 *new layer dimension* 로 자연 합류 (rule 위반 아닌 rule 확장).
4. **PDF architecture** — STEP 127 Phase 2 의 `window.print` 결정은 *Receipt / TaxInvoice* 류의 단순 문서에 충분. PASSPORT 디자인 자산 (`PASSPORT-1.png` 의 leather/gold/luxury archive 톤) 의 **production-quality 재현은 server-side PDF (Puppeteer / Playwright) 가 유일 옵션** — 단, 신규 라이브러리 도입은 **STEP 132 의 별도 dependency-introduction STEP** 으로 분리 필요. 본 STEP 128 은 *방향성 결정만* (server-side PDF 채택), 라이브러리 채택은 STEP 132 시점으로 보류.
5. **rule_14 / rule_17 amendment 제안** — 직접 수정 0줄. Passport architecture 채택 시 *clarifying note* 만 본 doc 의 §6 에 권장 문구 명시 (사용자 검토 후 별도 doc-only STEP 에서 정책 문서 갱신).

**STEP 129~135 revised roadmap** (§7) — STEP 127 Phase 1 의 기존 STEP 128~130 roadmap 을 본 review 결정에 맞춰 *재정의* (STEP 129 = ContractDraftDrawer + PrintView, STEP 130 = i18n Layer, STEP 131 = Closed Passport Card + List View, STEP 132 = Server-side PDF, STEP 133 = Expanded Passport + In-Passport Navigation, STEP 134 = AI Cultural Intelligence, STEP 135 = Timeline + Provenance + Cross-link).

---

## §1 사실관계 사전 검증 로그 (Phase 1.0)

STEP 127 Phase 1 의 14_PERMANENT_POLICIES.md 부재 발견 패턴 답습 — Phase 1.1 진입 *전* 사용자 spec 의 가정과 worktree 실재 사이의 gap 검증.

### §1.1 AXID 정착물 — 현재 형식

| 항목 | 실재 |
|------|------|
| Type 정의 | [src/types/artwork.ts:33-36](src/types/artwork.ts:33) — `AXID { code: string; issuedAt: string }` |
| `code` field 의미 | free-form string, JSDoc 예시 `"AXV-2025-0001"` |
| Generator | [src/store/useArtworkStore.ts:1275-1278](src/store/useArtworkStore.ts:1275) — `genAxid(year, seq)` 가 `AXV-${year}-${String(seq).padStart(4, "0")}` 생성 |
| Validator | **부재** — 형식 강제 0, runtime check 0 |
| Multi-layer | **부재** — single `code` field, display/index/security 분리 0 |
| 사용처 | 28+ 위치 (drawers / aggregates / utils / mock-data / scenarios) — 전부 `artwork.axid.code` 접근 |
| Mock data | 모두 `AXV-YYYY-NNNN` 4-digit format ([src/lib/mock-data.ts:21~](src/lib/mock-data.ts:21)) |

**결론**: AXID 는 *single-layer free-form string* 정착 상태. 사용자 spec 의 다층 (immutable id / display / UNIQUE index / QR security) 은 **현재 시스템에 부재** — 본 STEP 128 의 §2 분석 대상.

### §1.2 title / artist 필드 타입

[src/types/artwork.ts:41-42](src/types/artwork.ts:41):

```typescript
title: string;                          // primitive — 0 multilingual
artist: Artist;                         // object
// Artist (line 23-27):
//   id: string;
//   name: string;                      // primary (현재 ko 가정)
//   nameEn?: string;                   // 부분 multilingual — 이미 정착!
```

**관찰**: `artist.nameEn?` 가 STEP 1~14 foundation 시점부터 **부분 multilingual 정착**. `title` 은 plain string. → §3 multilingual policy 분석의 *anchor* 로 활용 가능 (Optional Slice 패턴이 artist 도메인에서 이미 검증됨).

### §1.3 Persistence SCHEMA_VERSION + validateV1

[src/lib/persistence.ts:43,233-260](src/lib/persistence.ts:43):

| 항목 | 값 |
|------|-----|
| `SCHEMA_VERSION` | `"v1" as const` |
| `validateV1` required keys | 15 개 — `version, savedAt, artworks, timeline, inquiries, transactions, invoices, payments, settlements, taxRecords, contracts, curationNotes, logistics, conditionReports, priceSuggestions` |
| Optional 슬라이스 | 3 개 — `receipts?, taxInvoices?, artworkDraft?` |
| Field-level 검증 | **부재** — slice 존재만 확인, 개별 entity field 검증 0 |
| `migrate()` switch | v1 case 만 정착, v0/v2 case 부재 (별도 STEP 진입 시 case 추가) |

**결론**: persistence schema 는 *forward-compat 친화적* — 신규 옵셔널 field 추가 시 자동 호환. 본 STEP 128 의 §2 (AXID 다층) / §3 (multilingual) 분석의 *기술적 기반* 으로 확인.

### §1.4 Drawer System 정착물

```
Glob src/components/**/*Drawer.tsx → 29 files
```

| 그룹 | 파일 수 | 비고 |
|------|--------|------|
| Primitive | 1 — `src/components/ui/Drawer.tsx` | single-drawer policy 의 root, ESC + body scroll lock + backdrop / panel inert |
| Domain drawer | 28 — artwork / contract / curation / customer / documents / drilldown / fiscal / inquiry / insight / invoice / logistics / market-analysis / payment / receipt / reporting / settlement / tax / tax-invoice / transaction / admin (2) / audit (2) | 모두 Drawer primitive 사용, single-drawer policy 답습 (STEP 124/125 정착) |
| Metadata | `detailKind?: "inquiry"|"invoice"|"settlement"|"tax"|"tax_invoice"` + `detailId?: string` — [src/types/drilldown.ts:216-217](src/types/drilldown.ts:216) | OperationalDrilldownDrawer 의 row click → 해당 detail drawer 진입 분기 |

**결론**: drawer system 은 *광범위·정착·일관성 보장* 상태. PASSPORT architecture 도입 시 본 시스템과의 *공존* 가능성이 §4 분석의 핵심.

### §1.5 PDF / print 정착물

| 정착물 | 위치 | 비고 |
|--------|------|------|
| ReceiptPrintView (STEP 87) | [src/components/receipt/ReceiptPrintView.tsx](src/components/receipt/ReceiptPrintView.tsx) ~226 LOC | A4 영수증 layout, `@media print` 활용 |
| TaxInvoicePrintView (STEP 89) | [src/components/tax-invoice/TaxInvoicePrintView.tsx](src/components/tax-invoice/TaxInvoicePrintView.tsx) ~247 LOC | A4 세금계산서 layout |
| `window.print()` 호출 | [ReceiptDetailDrawer.tsx:169,178](src/components/receipt/ReceiptDetailDrawer.tsx:169) + [TaxInvoiceDetailDrawer.tsx:157,163](src/components/tax-invoice/TaxInvoiceDetailDrawer.tsx:157) | 4 호출처, 50ms `setTimeout` 으로 mount 후 호출 |
| 외부 PDF 라이브러리 | **0개** — `@react-pdf` / `puppeteer` / `playwright` / `jsPDF` / `html2canvas` 모두 부재 (package.json 확인) |

**결론**: STEP 87/89 PrintView 패턴은 *실재 정착* (사용자 메모리 정확). 신규 PDF 라이브러리 도입은 본 STEP 의 §5 분석 대상.

### §1.6 STEP 127 정착물 무손상

```
git grep -n "invoiceKind\|getInvoiceKind" src/
→ src/types/invoice.ts (옵셔널 슬롯)
→ src/lib/invoice-helpers.ts (helper)
→ src/lib/__tests__/invoice-kind.scenarios.ts (5 scenarios)
```

**결론**: STEP 127 Phase 2 산출물 (Optional Slice 8회째 답습) **모두 보존**. 본 STEP 128 작업이 STEP 127 의 임의 회귀 위험 없음.

### §1.7 Phase 1.0 종합 — Phase 1.1 진입 보류 여부

| 검증 항목 | gap 발견 | 진입 보류 사유 |
|----------|---------|--------------|
| AXID 형식 | ❌ 없음 (single-layer 정착, multi-layer 분석 자체가 본 STEP 영역) | 진입 가능 |
| title/artist | ❌ 없음 (artist 부분 multilingual 이미 정착, 분석 anchor) | 진입 가능 |
| SCHEMA_VERSION | ❌ 없음 (v1 + 15 required + 3 optional 슬라이스 정확) | 진입 가능 |
| Drawer system | ❌ 없음 (29 files, single-drawer policy 답습) | 진입 가능 |
| PDF/print | ❌ 없음 (STEP 87/89 PrintView 실재) | 진입 가능 |
| STEP 127 정착물 | ❌ 없음 (invoiceKind/getInvoiceKind 보존) | 진입 가능 |

→ **Phase 1.1 진입 승인** (STEP 127 의 14_PERMANENT_POLICIES.md 부재 발견 같은 큰 misrepresentation 0건).

---

## §2 AXID 2-Layer System 분석 (영역 1)

### §2.1 사용자 spec 의 4-component 분해

| Component | 사용자 의도 | 현재 시스템 |
|-----------|----------|------------|
| (A) Internal immutable id | 시스템 내부 정체성 — 변경 절대 금지, 외부 노출 안 함 | `Artwork.id: string` (별도 정착, axid 와 분리됨) |
| (B) `axid_display` | 사용자/buyer/문서 표기 — 다양한 format 가능 (`AX-2025-KR-000001` 등) | `axid.code: string` (free-form, 현재 `AXV-YYYY-NNNN` 만) |
| (C) UNIQUE index | 검색·조회 정합성 — `display` 값 변경되어도 안정 | **부재** — `axid.code` 가 곧 검색 key (변경 시 외부 reference 깨짐) |
| (D) QR routing security | QR code → 작품 detail routing, tampering 방지 | **부재** — QR 기능 0, security layer 0 |

### §2.2 옵션 분석 — 4-component 도입 전략

**옵션 (A) — `axid` 자체 확장 (옵셔널 슬롯)**

```typescript
// 권장 schema (STEP 132/133 단계 진입 시점에 정착)
export interface AXID {
  code: string;          // 기존 — display 의미 보존 (e.g. "AXV-2025-0001")
  issuedAt: string;      // 기존
  // ── STEP 132/133 (예상) 추가 옵셔널 슬롯 ──
  displayLabel?: string; // (B) 사용자/buyer 표기 — code 와 다른 format 가능 (e.g. "AX-2025-KR-000001")
  routingToken?: string; // (D) QR security token — short random hash
}
```

- **장점**: schema 변경 1 곳, 기존 사용처 28+ 무변경 (모두 `axid.code` 그대로 사용)
- **단점**: `axid.code` 의 의미 모호 (internal 인가 display 인가) — JSDoc 으로 명시 필요
- Optional Slice 9회째 답습

**옵션 (B) — 별도 entity 분리**

```typescript
// 새 entity
export interface ArtworkDisplayIdentifier { artworkId: string; label: string; locale?: string; }
```

- **장점**: 의미 명확
- **단점**: 신규 entity → persistence slice 추가 → SCHEMA_VERSION 변경 위험 (validateV1 required 확장 시) — 정책 friction

**옵션 (C) — `Artwork` 직접 inline 필드 추가**

```typescript
// Artwork 에 직접 추가
displayAxid?: string;
qrRoutingToken?: string;
```

- **장점**: 단순
- **단점**: `axid` namespace 의 의미 분산 — 데이터 응집도 저하

**권장**: **옵션 (A)** — AXID interface 확장 + `code` 의 의미를 *internal immutable identifier* 로 lock (JSDoc 명시), `displayLabel?` 가 사용자 표기 담당. `code` 는 변경 0줄 정책 (rule_1 Physical Root Key 보존).

### §2.3 UNIQUE index (C) — 검색 / 정합성 layer

**현재 정합성**: `axid.code` 가 곧 검색 substring match key ([ArtworkGrid.tsx:26](src/components/layout/ArtworkGrid.tsx:26)). `displayLabel?` 도입 시 ArtworkGrid search 가 *both formats* match 하도록 helper 분기 (STEP 128 외 별도 STEP).

**runtime UNIQUE 검증**: 현재 부재 — generator 가 `${year}-${seq}` 형식이라 seq 충돌 시 중복 가능 (extreme corner case, mock 단계 무영향). production 시 별도 validator 정착 권장.

### §2.4 QR routing security (D)

- 사용자 spec 의 QR routing 은 *작품 detail 진입 trigger* + *tampering 방지* 의 2-purpose.
- 현재 시스템에 QR 기능 0 — `qrRoutingToken?` slot 만 정착 후 STEP 132/133 시점에 QR 생성 / scan / verify 로직 추가.
- security 측면: `routingToken` 은 *non-secret* short hash (e.g. 8-char base62) 권장 — secret 이 아니므로 client-side 생성 가능.

### §2.5 마이그레이션 전략

| 옵션 | 기존 데이터 | 신규 데이터 | 호환성 |
|------|-----------|-----------|--------|
| (X) 즉시 전환 | regenerate (모든 `code` 변경) | 신 format | ❌ 외부 reference 깨짐 |
| (Y) 병행 | 기존 그대로 | 신 format `code` | ⚠️ mixed format DB |
| (Z) **옵션 (A) + display 분리** | `code` 그대로 / `displayLabel?` 부재 → fallback `code` | 신규 `displayLabel?` 채움 | ✅ **0 마이그레이션** |

→ **권장**: **옵션 Z** (STEP 127 Phase 1 §2.7 AXID 옵션 Z 와 동일 결정 — 시스템 내부 식별자 변경 0, 디자인 표기만 분리 layer).

### §2.6 §2 결론 + 보존 약속 영향도

**결론**:
1. AXID 4-component 분해는 **Optional Slice 9회째 도입** 으로 v1 boundary 무손상 가능.
2. `axid.code` 의 *의미* 를 JSDoc 으로 internal immutable identifier 로 lock — rule_1 Physical Root Key 보존.
3. `displayLabel?` / `routingToken?` 옵셔널 슬롯 도입은 **STEP 133 (Expanded Passport)** 시점이 적합 — Passport UI 가 *display label* 의 첫 사용처가 됨.

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| rule_1 Artwork-First (Physical Root Key) | ☑ 무손상 | `code` 의미가 internal id 로 명확화 — rule_1 강화 |
| Persistence v1 boundary | ☑ 무손상 | SCHEMA_VERSION 변경 0, validateV1 0줄 |
| STEP 117 Optional Slice 패턴 | ☑ 답습 (9회째) | STEP 127 = 8회 → 본 도입 = 9회 |

---

## §3 Multilingual-Compatible Schema Policy (영역 2)

### §3.1 옵션 비교 표

| 옵션 | 정책 위반 | 데이터 마이그레이션 | 기존 사용처 영향 | locale switching 지원 | 추천도 |
|------|----------|-----------------|-----------------|---------------------|--------|
| (A) v2 migration (전체 schema 재정의) | 🔴 **rule_4 / DOC-2 §3 / Phase 4 §4.3 위반** | 전체 hard migration 필요 | 28+ 위치 변경 | ✅ | ❌ **비권장** |
| (B) Optional Slice — `titleI18n?: Record<Locale, string>` / `artistNameI18n?: ...` | ✅ 정책 정합 | 0 (기존 데이터 `title: string` 그대로) | 0 (사용처 fallback) | ✅ via getter | ✅ |
| (C) Locale-aware getter helper layer — `getTitle(artwork, locale)` 만 도입, schema 무변경 | ✅ 정책 정합 | 0 | 0 (단, locale switching 시 fallback 1개만) | ⚠️ 부분 — locale 별 텍스트 0 | 부분 |

**관찰**: `artist.nameEn?` 이 이미 옵션 (B) 답습 (single-locale partial). 본 패턴을 *full multilingual* 로 확장 가능.

### §3.2 권장 hybrid — (B) Optional Slice + (C) Helper layer

```typescript
// STEP 130 (i18n Layer) 진입 시점 (예상 schema, 본 STEP 128 은 type 정의 0줄)
export type Locale = "ko" | "en"; // v1 — extensible

export interface Artwork {
  // 기존 (변경 0줄)
  title: string;                     // primary, default locale (ko 가정) — backward compat
  artist: Artist;                    // artist.nameEn? 도 보존

  // 신규 옵셔널 슬롯 (Optional Slice 패턴 답습)
  titleI18n?: Partial<Record<Locale, string>>;
  // artist.nameEn 은 그대로 두고, 향후 nameI18n? 추가 시 nameEn 을 자연 흡수 가능
}

// Helper (별도 helpers.ts 신규)
export function getTitle(artwork: Artwork, locale: Locale = "ko"): string {
  return artwork.titleI18n?.[locale] ?? artwork.title;
}

export function getArtistName(artist: Artist, locale: Locale = "ko"): string {
  if (locale === "en") return artist.nameEn ?? artist.name;
  return artist.name;
}
```

- 모든 UI 호출처가 `getTitle(artwork, currentLocale)` / `getArtistName(artist, currentLocale)` 호출 — 28+ 사용처 1회 마이그레이션
- 옵션 (B) Optional Slice 도입 + 옵션 (C) Helper layer 결합

### §3.3 SCHEMA_VERSION v1 유지 가능성 정량

| 변경 | persistence 영향 | SCHEMA_VERSION |
|------|-----------------|----------------|
| `titleI18n?` 추가 | 0줄 (validateV1 의 artworks 슬라이스 array 검증만 — 개별 entity field 비검증) | "v1" 유지 |
| `Locale` type 정의 | 0줄 (persistence 미사용, runtime helper 만) | "v1" 유지 |
| Helper 추가 | 0줄 (lib/ 신규 파일, persistence 미관여) | "v1" 유지 |

→ **SCHEMA_VERSION "v1" 100% 유지 가능**.

### §3.4 §3 결론 + 보존 약속 영향도

**결론**:
1. Multilingual 도입은 **Optional Slice + Helper layer hybrid** 채택, v1 boundary 무손상.
2. `titleI18n? / artistNameI18n?` 옵셔널 슬롯 도입은 **STEP 130 (i18n Layer)** 시점.
3. helper 도입은 *단일 derivation point* — UI 호출처 28+ 가 모두 `getTitle / getArtistName` 만 호출 (STEP 127 의 `getInvoiceKind` 패턴 답습).

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| Persistence v1 boundary | ☑ 무손상 | SCHEMA_VERSION 0줄 |
| STEP 117 Optional Slice | ☑ 답습 (10회째 — STEP 130 시점) | invoiceKind = 8 → AXID = 9 → multilingual = 10 |
| rule_1 Artwork-First | ☑ 무손상 | `title: string` 보존, getter 가 derive |

---

## §4 AXVELA PASSPORT Architecture 분석 (영역 3)

### §4.1 PASSPORT-1_SPEC.md 의 핵심 결정

| § | 요지 |
|---|------|
| §1~2 | Closed Passport 형태의 카드 (leather, gold typography, luxury archive 느낌) — 기존 grid card 대체 |
| §3 | Passport List View — physical object library 느낌 |
| §4 | Passport Open Interaction — drawer/modal 금지, *Passport 자체가 펼쳐짐* |
| §5~6 | Expanded Passport 구조 + 우측 9-row Index (PROVENANCE / INQUIRY / INVOICE / SETTLEMENT / TAX / LOGISTICS / CERTIFICATE / AI CULTURAL INTELLIGENCE / TRANSACTION TIMELINE) |
| §7 | **In-Passport Navigation** — *외부 modal / 새로운 drawer / 전체 overlay 금지*, 모든 detail 은 *paper 영역 내부* slide transition |
| §8~9 | AI CULTURAL INTELLIGENCE 강조 — Bloomberg Terminal × Apple editorial minimalism |
| §10~11 | Condition Analysis + Transaction Timeline (museum archive logbook 톤) |
| **§12** | **기존 Drawer 시스템 제거 금지** — operational/admin workflow 용으로 유지. Passport vs Drawer = 작품 중심 공식 기록 vs 운영 OS |
| §13~15 | 개발 방향 / UI 규칙 / 최종 목표 — Cultural Asset Operating System |

### §4.2 rule_14 (3-Column Layout) 와의 충돌 분석

**현재 rule_14**: Sidebar 240px / Grid flex-1 / Detail 380px 의 3-column 고정 layout (production 정착, 28 drawer 가 본 layout 안에서 작동).

**Passport spec 의 List View** (§3): "Closed Passport 카드 배열" — 현재 `Grid (flex-1)` 위치를 차지하면 자연 합류. Sidebar 240px / Detail 380px 그대로.

**Passport spec 의 Expanded Passport** (§5, §7): *In-Passport Navigation* 만 허용, drawer/modal 금지. → Detail 380px 가 *Passport open 시* 어떻게 작동하는가가 핵심 질문.

**충돌 분석 옵션**:

| 옵션 | rule_14 정합 | 구현 부담 |
|------|------------|----------|
| (A) **Dual-layer 분리** — Passport List View 는 Grid 위치에서 발현, Expanded Passport 도 Grid 영역 내 (Detail 380px 와 무관). Detail 380px 는 *기존 drawer 의 selectedArtwork 표시 그대로* 유지. | ✅ rule_14 본문 변경 0줄 | Passport 가 Grid 영역에서 full-width 모드 진입 (overlay 아닌 *영역 점유* — Detail 380px 와 공존 또는 hide) |
| (B) **Passport mode 진입 시 3-column 일시 해제** — rule_14 amendment 필요 ("Passport mode 진입 시 Detail 380px hide") | ⚠️ rule_14 본문 amendment 필요 | rule_14 의 *layout 정의 자체* 가 Passport mode 와 incompatible — 정책 위반 |
| (C) **Passport 가 Detail 380px 안에 mount** | ✅ rule_14 정합 | 380px 안에서 Closed Passport / Expanded Passport 표현 불가능 (사용자 spec 의 leather 느낌·9-row index 표시 공간 부족) — **현실적 불가능** |

→ **권장**: **옵션 (A)** — Passport 가 Grid (flex-1) 영역 안에서 발현, Detail 380px 와 *동일 viewport 공존* (또는 Passport open 시 Detail 자동 hide via `passportOpen` UI state).

### §4.3 rule_17 (Layer UI) 와의 충돌 분석

**현재 rule_17**: Drawer / Modal layer UI 정착 — 모든 detail interaction 은 layer 위에서 (3-column 변경 0). 28 drawer + nested modal 패턴.

**Passport spec §7**: *In-Passport Navigation* — drawer / modal / overlay 금지. *Paper 영역 내부 slide transition* 만 허용.

**핵심 통찰**: rule_17 은 *운영 / admin workflow* 의 정책 — Passport spec §12 가 "기존 Drawer 유지 (운영/admin)" 명시. → **rule_17 은 운영 영역에서 정착 유지, Passport 영역은 별도 navigation paradigm** 으로 *dimension 분리* 가능.

**충돌 해소 방식**:
- rule_17 본문 변경 0줄
- Passport architecture 는 *new layer dimension* 로 자연 합류 (drawer 와 *교체* 가 아닌 *공존*)
- 운영자 (gallery admin) — drawer 위주, buyer/collector — Passport 위주 (페르소나 별 UI surface 분리)

### §4.4 STEP 124/125 single-drawer policy 와의 충돌 분석

**현재 STEP 124/125 정착**: single-drawer policy — drawer 위에 drawer 띄울 시 detail 진입 source drawer 자동 close. detailKind/detailId metadata.

**Passport spec §7**: 외부 drawer 안 띄움 → single-drawer policy *trigger 발생 0*. 충돌 없음.

**Passport mode 진입 시 drawer 와의 관계**:
- 옵션 (A) — Passport open 시 모든 drawer auto-close (single-drawer policy 답습)
- 옵션 (B) — Passport 와 drawer 가 *별도 layer dimension* — Passport 가 Grid (flex-1) 영역 점유, drawer 는 rule_17 layer 그대로 (z-index 분리)

**권장**: 옵션 (A) — Passport open 시 drawer auto-close. single-drawer policy *답습 + 확장* (drawer 외 Passport 도 같은 정책 적용).

### §4.5 Image-First Hierarchy (STEP 116) 와의 정합

**현재 STEP 116**: ArtworkFormDrawer 최상단 ArtworkUploadHero 정착.

**Passport spec §2 Closed Passport**: front cover 에 artwork title / artist / year / medium / status chips. 이미지 *위치 미명시* — leather cover 의 *시각 통합* 영역.

**Passport spec §5 Expanded Passport**: "RIGHT PAPER AREA — artwork metadata / image / status / index list" — image 가 paper area 안 mount.

**정합**: image-first hierarchy 는 *registration UI* 영역 (ArtworkFormDrawer), *Passport UI* 는 *공식 기록 표기* 영역 — 두 surface 의 의도 분리. STEP 116 무손상 + Passport 의 image 위치 자유.

### §4.6 Two-Layer Curation Model (STEP 119) 와의 정합

**현재 STEP 119**: Artwork inline 5 fields (description/curationDraft/exhibitionText/artistNote/provenanceNote) + 별도 CurationNote entity (formal lifecycle).

**Passport spec §6 우측 Index**: PROVENANCE 가 9-row 중 1 row → Passport 안에서 *provenanceNote inline + CurationNote 진입 가능*. Two-Layer Curation 의 *두 layer 모두 Passport 안에서 자연 노출 가능*.

**정합**: STEP 119 무손상, Passport 가 *두 layer 의 통합 view* 제공.

### §4.7 §4 결론 + 채택 옵션

**3 옵션 비교**:

| 옵션 | 정책 friction | UI 일관성 | 개발 부담 | 사용자 spec 정합 |
|------|-------------|---------|----------|----------------|
| (A) **Passport architecture 채택 + Dual-layer 분리** (rule amendment 0줄) | ✅ 0 | ✅ Passport + drawer 공존 | 중 | ✅ §12 정합 |
| (B) Passport architecture 채택 + Manifesto amendment (rule_14/17 본문 정정) | ⚠️ amendment 필요 | ✅ 단일 paradigm | 중-고 | △ §12 명시 위반 |
| (C) Passport architecture 보류 (현재 drawer 시스템 유지) | ✅ 0 | △ Passport spec 미반영 | 0 | ❌ 사용자 spec 미충족 |

→ **권장**: **옵션 (A)** — rule amendment 0줄, dual-layer 분리. Passport spec §12 의 "기존 Drawer 유지" 정합. 사용자 spec 의 본질 (작품 중심 공식 기록 surface) 충족.

### §4.8 Passport 도입 시 *new* policy 명시 (rule 본문 변경 0줄)

본 STEP 128 의 review doc 안에 *clarifying note* 로만 명시 (사용자 검토 후 별도 doc-only STEP 에서 정책 문서 갱신):

> **Passport architecture 채택 시 정책 정합 (clarifying note, rule 본문 amendment 아님)**:
> - rule_14 3-column layout 은 *운영 / admin workflow* 의 layout — Sidebar 240px / Grid (Passport List View 또는 Card grid) / Detail 380px 유지.
> - rule_17 Drawer / Modal layer 는 *운영 surface* 의 navigation paradigm — Passport surface 는 *In-Passport Navigation* (paper 영역 내부 slide) 별도 paradigm.
> - 두 surface 는 *dimension 분리* — Passport open 시 drawer auto-close (single-drawer policy 답습 + 확장).

---

## §5 PDF Architecture Decision Matrix (영역 4)

### §5.1 STEP 127 Phase 2 의 `window.print` 결정 — 정정 필요성 분석

**STEP 127 결정 근거** (Phase 1 §2.5):
- Receipt (STEP 87) / TaxInvoice (STEP 89) 류 *단순 행정 문서* 는 browser `window.print()` + Tailwind `@media print` 로 production-quality 충족.
- 신규 dependency 0, bundle 부담 0.

**Passport 디자인 자산 (`PASSPORT-1.png`) 의 톤**:
- leather cover (dark navy)
- gold typography
- emboss seal texture
- low reflection
- luxury archive 느낌

→ **browser print 의 한계**:
- CSS `text-shadow` / `box-shadow` / `linear-gradient` 등은 print engine 별로 다르게 렌더 (특히 Safari ↔ Chrome ↔ Edge 격차 큼).
- font-face embedding 은 가능하나 한글 글리프 / weight variant 모두 정확 재현은 어려움.
- emboss seal texture 같은 *raster 효과* 는 print engine 무관 background-image 으로 해결 가능하나 *고해상도 출력* 시 quality 저하.

→ **결론**: Receipt / TaxInvoice 류는 `window.print` 충분. **Passport export (PDF 형태로 buyer 에게 전달) 는 server-side PDF 가 필요**. STEP 127 결정은 *유효 범위 한정 정정* 필요.

### §5.2 PDF tech stack 비교 표

| 옵션 | dependency 크기 | quality | bundle 영향 | Vercel 호환 | 한글 폰트 처리 | Passport leather 톤 재현 | 추천도 |
|------|--------------|---------|----------|----------|------------|----------------------|--------|
| **`window.print()`** (현재) | 0 | A4 단순 OK / leather 톤 ❌ | 0 kB | ✅ | △ 시스템 폰트 의존 | ❌ 불가능 | Receipt / TaxInvoice 만 |
| `@react-pdf/renderer` | +500 kB | △ DOM 별개 tree, layout 재작성 | +500 kB | ✅ | font register 별도 | △ 부분 (텍스처 raster 어려움) | 중 |
| `jsPDF + html2canvas` | +300 kB | ❌ font glyph 누락 다발 | +300 kB | ✅ | ❌ 한글 깨짐 | ❌ | ❌ |
| `html-to-image` (canvas) | +200 kB | △ raster 이미지 → 검색·접근성 손실 | +200 kB | ✅ | ✅ (raster) | ⚠️ DPI 한계 | ❌ |
| **Puppeteer** (server) | server-side, 250MB Chromium | ✅ 완벽 (Chrome 엔진 1:1) | 0 (client bundle 무관) | ✅ Vercel Functions edge 제한 — Node runtime 필요 | ✅ | ✅ **재현 가능** | **A** |
| **Playwright** (server) | server-side, 추가 browser | ✅ 완벽 (Chromium / Firefox / WebKit) | 0 | ✅ Node runtime | ✅ | ✅ **재현 가능** | A |
| `pdf-lib` (manual layout) | +200 kB client | △ layout 수동 (시간 비용 큼) | +200 kB | ✅ | font register 별도 | ❌ texture 불가능 | ❌ |

### §5.3 권장 — server-side PDF 채택 범위 *신규 영역만* (사용자 결정 2026-05-12 반영)

**본 STEP 128 의 결정** (사용자 정정): **server-side PDF 채택 범위 = *신규 영역만***.

| 범위 | 결정 |
|------|------|
| **신규 영역** — Invoice / Contract / Certificate / Passport export | **server-side PDF 채택** |
| **기존 영역** — ReceiptPrintView (STEP 87) + TaxInvoicePrintView (STEP 89) 의 `window.print()` **4 곳** 정착물 | **그대로 보존** — 회귀 risk 차단 |
| **전면 전환 여부** (기존 영역도 server-side 로?) | **STEP 132 별도 결정** — 본 STEP 128 보류 |

**근거** (사용자 spec):
- Phase 1.0 §1.5 검증에서 STEP 87/89 `window.print()` 4 호출처 활성 사용 확인.
- 기존 정착물 보존 = 회귀 risk 차단.
- 신규 영역만 server-side = STEP 132 scope 합리적 유지.

**라이브러리 후보 — 3 후보 동등** (사용자 정정):

| 후보 | 본 STEP 128 의 입장 |
|------|---------------------|
| Puppeteer (server-side, Chromium) | 본 STEP 선호 표명 **0** — STEP 132 시점 검토 |
| Playwright (server-side, multi-browser) | 본 STEP 선호 표명 **0** — STEP 132 시점 검토 |
| **`react-pdf`** (client / server hybrid) | **사용자 추가 — 동등 후보**. 본 STEP 선호 표명 **0** — STEP 132 시점 검토 |

→ 라이브러리 결정은 **STEP 132 (Server-side PDF Architecture)** 진입 시 3 후보를 *Vercel 빌드 환경 실험 + 디자인 시안 재현 정확도 정량 비교 후* 결정. **본 STEP 128 에서 사용자 선호 표명 없음**.

**STEP 132 진입 시 검토 항목** (3 후보 공통):
- Vercel Functions / Edge Runtime / Node Runtime 호환 (size limit / cold-start)
- 한글 폰트 embedding 전략 (Noto Sans KR / Noto Serif KR / system fallback)
- leather texture / gold foil 재현 CSS 정합성 검증
- PDF rendering latency 정량
- 사용자 측 hosting 환경 (Vercel / 자체 host / Cloudflare) 호환

### §5.4 §5 결론 + 보존 약속 영향도

**결론** (사용자 결정 2026-05-12 반영):
1. STEP 127 Phase 2 의 `window.print` 결정은 *Receipt/TaxInvoice 범위 한정* 으로 유효 — **기존 4 곳 정착물 보존** (회귀 risk 차단).
2. **신규 영역만** (Invoice / Contract / Certificate / Passport export) **server-side PDF 채택**.
3. 전면 전환 여부 (Receipt / TaxInvoice 도 server-side 로?) 는 **STEP 132 별도 결정**.
4. 라이브러리 후보 = Puppeteer / Playwright / **react-pdf** **3 후보 동등** — STEP 132 진입 시 정량 비교 후 결정. 본 STEP 128 선호 표명 0.

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| 신규 dependency 0 (STEP 127 hard constraint) | ⚠️ **STEP 132 시점 위반 — 별도 STEP 진입 정당화** | server-side PDF 도입은 본 STEP 128 review 의 결정 사항 |
| STEP 87/89 PrintView 패턴 | ☑ 답습 유지 (Receipt/TaxInvoice 영역) | Passport 영역은 별도 server-side path |

---

## §6 Manifesto Amendment 검토 (영역 5)

### §6.1 본 STEP 128 결정에 따른 amendment 필요성

| Rule | 현재 본문 | Passport 도입 시 영향 | amendment 필요? |
|------|---------|-------------------|---------------|
| rule_14 (3-column) | Sidebar 240px / Grid flex-1 / Detail 380px | Passport List View 는 Grid 영역 발현 — layout 정합 | ❌ **본문 amendment 불필요** (clarifying note 만) |
| rule_17 (Drawer/Modal layer) | Drawer / Modal layer UI | Passport 는 별도 dimension (in-passport navigation) — drawer 와 공존 | ❌ **본문 amendment 불필요** (clarifying note 만) |
| rule_1 (Artwork-First) | AXID = Physical Root Key | AXID `code` 의 internal id 의미 강화 + `displayLabel?` 분리 | ❌ 변경 0 (강화) |
| rule_5 (AI-Human Loop) | AI 초안 → 인간 수정 → 승인 → LOCK | Passport AI Cultural Intelligence 도 동일 정책 (사용자 명시 trigger only, fake confidence 0) | ❌ 변경 0 |

→ **결론**: rule_14 / rule_17 / rule_1 / rule_5 본문 amendment **0줄**. *clarifying note* 만 본 review doc 의 §4.8 에 명시.

### §6.2 권장 clarifying note 문구 (별도 doc-only STEP 진입 시 활용)

본 review doc 의 §4.8 인용:

> **Passport architecture 채택 시 정책 정합 clarifying note (rule 본문 amendment 아님)**:
> - rule_14 3-column layout — *운영 / admin workflow* layout, Sidebar 240px / Grid (Passport List View 또는 Card grid) / Detail 380px 유지.
> - rule_17 Drawer / Modal layer — *운영 surface* navigation paradigm. Passport surface 는 *In-Passport Navigation* (paper 영역 내부 slide) 별도 paradigm.
> - 두 surface 는 *dimension 분리* — Passport open 시 drawer auto-close (single-drawer policy 답습 + 확장).
> - rule_1 Physical Root Key: `axid.code` = internal immutable identifier, `displayLabel?` = 사용자 표기.

이 note 는 **본 review doc 안에만** 존재 — 정책 문서 (AXVELA_*.md) 본문 변경은 사용자 명시 승인 후 별도 doc-only STEP 진입 시 반영.

---

## §7 STEP 129~135 Revised Roadmap

### §7.1 STEP 127 Phase 1 의 기존 roadmap → 본 STEP 128 결정 반영 재정의

**기존 (STEP 127 Phase 1 §3 기준)**:
- STEP 128 = Invoice/Contract Preview/Send/Lock + PrintView + PRE filter + ContractDraftDrawer
- STEP 129 = GalleryTemplate 2-tier + 한·영 dual layout
- STEP 130 = 5-tab navigation review (별도)

**재정의 (본 STEP 128 review 결정 반영)**:

| STEP | 명칭 | scope | 의존성 | risk |
|------|------|-------|--------|------|
| **129** | **ContractDraftDrawer + Invoice/Contract PrintView + PRE Filter Direct Add** | 기존 STEP 127 Phase 1 의 STEP 128 정의 그대로 (ContractDraftDrawer / 2 PrintView / fiscal-summary·reporting-aggregates PRE filter 직접 추가 / payment guard / send button label 분기) | STEP 127 Phase 2 (invoiceKind / getInvoiceKind 정착) | 🟢 Medium-Low |
| **130** | **Internationalization Layer** | locale switching infra (Locale type + getter helper layer: `getTitle / getArtistName / getLabel`) + UI locale state slice + Optional Slice `titleI18n?` 도입 (Optional Slice 10회째) | STEP 129 + §3 권장 hybrid | 🟢 Medium |
| **131** | **Closed Passport Card + List View** | Passport UI foundation — Closed Passport 카드 컴포넌트 신설 + List View grid 안 배치 (rule_14 정합) + leather/gold typography 정착 + `docs/design/passport/` 의 디자인 자산 (PASSPORT-1.png) 의 git add 진입 | STEP 130 (locale switching) | 🟡 Medium |
| **132** | **Server-side PDF Architecture** | Puppeteer / Playwright 채택 결정 + Vercel host 호환 검증 + 한글 폰트 embedding + leather texture 재현 + Receipt/TaxInvoice 의 server-side fallback 옵션 검토 (browser print 보존 + server PDF 옵션) | STEP 131 (Passport UI 정착, PDF target) | 🟡 High (신규 dependency + deployment 영향) |
| **133** | **Expanded Passport + In-Passport Navigation** | Expanded Passport UI + 9-row Index (PROVENANCE / INQUIRY / INVOICE / SETTLEMENT / TAX / LOGISTICS / CERTIFICATE / AI / TIMELINE) + paper 영역 내부 slide transition + `axid.displayLabel?` + `axid.routingToken?` 옵셔널 슬롯 도입 (Optional Slice 9회째) | STEP 132 (PDF rendering 정합) | 🟡 High (UI 광범위) |
| **134** | **AI Cultural Intelligence Section** | Passport 의 AI section UI (Bloomberg × Apple editorial) — STEP 92 operational-insight 의 재사용 + Passport 영역 표현 + condition analysis (UV scan / restoration history mock) + cultural significance | STEP 133 | 🟡 Medium-High |
| **135** | **Transaction Timeline + Provenance + Cross-link Integration** | Passport timeline (museum archive logbook) + STEP 119 inline + CurationNote integration + invoice/contract/receipt/settlement cross-link (single-drawer policy 답습) | STEP 134 | 🟡 Medium |

### §7.2 각 STEP 의 Phase 분리 권장

STEP 127 패턴 답습 — 각 STEP 마다 Phase 1 (architecture review doc-only) → Phase 2 (implementation) 분리:

| STEP | Phase 1 | Phase 2 |
|------|---------|---------|
| 129 | 1-day 분량 — ContractDraftDrawer scope 확정 | 1~2 day — implementation |
| 130 | 2-day — i18n strategy, locale switching trigger 위치, getter helper 범위 | 2~3 day |
| 131 | 2-day — Closed Passport card design tokens, animation 정책 | 3~5 day (UI 광범위) |
| 132 | **3-day** — Puppeteer vs Playwright 결정, Vercel 호환성 spike, font embedding strategy | 2~3 day (라이브러리 결정 후) |
| 133 | 3-day — Expanded Passport detail layout, In-Passport Navigation API | 5+ day |
| 134 | 2-day — AI section integration with STEP 92 | 2~3 day |
| 135 | 2-day — cross-link strategy | 3~5 day |

### §7.3 §7 결론

STEP 129~135 = **7 STEP**, 각 STEP Phase 1/2 분리 → 총 14 turn 의 작업. 본 STEP 128 review 가 *전체 roadmap 의 architecture anchor*.

---

## §8 보존 약속 검증표 (9 항목 × 본 STEP 128 결정)

본 STEP 128 의 *각 결정* 이 9 보존 약속에 미치는 영향 정량 (STEP 127 Phase 1 §6 패턴 답습):

| # | 보존 약속 | STEP 128 review 결정 |
|---|----------|--------------------|
| 1 | 🔴 **Phase 1 Fiscal frozen (실제 정의 부재 상태)** | ☑ **영향 없음** — fiscal helpers 0줄 변경. STEP 129 의 fiscal-summary/reporting-aggregates PRE filter 직접 추가는 STEP 127 Phase 1 §11.2 검증 결과 frozen 외부 |
| 2 | 🔴 **rule_5 AI-Human Loop keyword immutability** | ☑ **무손상** — Passport AI Cultural Intelligence section (STEP 134) 도 동일 정책 (사용자 명시 trigger only, fake confidence 0, "운영 참고" 표현). keyword 변경 0 |
| 3 | 🔴 **Persistence v1 boundary** | ☑ **무손상** — SCHEMA_VERSION "v1" 변경 0, validateV1 0줄. STEP 130 의 titleI18n? / STEP 133 의 axid.displayLabel? / axid.routingToken? 모두 Optional Slice 패턴 답습 (9회·10회째). |
| 4 | 🔴 **rule_14 3-column layout** | ☑ **본문 amendment 0줄** — Passport architecture 옵션 (A) 채택 시 layout 정합 (clarifying note 만, §4.8 / §6.2) |
| 5 | 🔴 **STEP 117 Draft/Resume + Optional Slice 패턴** | ☑ **답습** — STEP 130 multilingual (10회) + STEP 133 AXID 확장 (9회) 모두 Optional Slice 답습 |
| 6 | 🔴 **STEP 118 ArtworkFormDrawer 4-tab over-scope rejection** | ☑ **무손상** — ArtworkFormDrawer (registration UI) 와 Passport (공식 기록 UI) 는 별도 surface, 4-tab 의미 보존 |
| 7 | 🔴 **STEP 124/125 single-drawer policy + detailKind/detailId** | ☑ **답습 + 확장** — Passport open 시 drawer auto-close (single-drawer policy 답습), detailKind/detailId metadata 는 OperationalDrilldownDrawer 영역 그대로 |
| 8 | 🔴 **Image-First hierarchy (ArtworkFormDrawer)** | ☑ **무손상** — STEP 116 ArtworkUploadHero (registration surface) 와 Passport image (공식 기록 surface) 는 별도 의도 |
| 9 | 🔴 **Two-Layer Curation Model** | ☑ **무손상** — Passport §6 Index 의 PROVENANCE / curation 영역이 *두 layer 의 통합 view* 제공, 분리 원칙 보존 |

→ **9/9 ☑ 무손상**. 본 STEP 128 review 의 결정 어느 것도 보존 약속 위반 0.

---

## §9 사용자 결정 필요 항목 체크리스트

✅ **2026-05-12 사용자 명시 결정 완료** — 10 항목 모두 확정. 8 항목 권장안 그대로 승인 + 2 항목 정정 + 1 항목 인지. 각 항목 결정 근거:

- [x] **항목 1**: §2 AXID 4-component 분해 — **옵션 (A) AXID interface 확장** 승인 (`displayLabel?` / `routingToken?` 옵셔널 슬롯, `code` 의 internal id 의미 lock). **근거**: Optional Slice 9회째 답습 + rule_1 Physical Root Key (`code` = internal id) 강화 + 외부 reference 영향 0.
- [x] **항목 2**: §2.5 AXID 마이그레이션 — **옵션 (Z)** 승인 (디자인 표기 분리, 마이그레이션 0). **근거**: 기존 `axid.code` 변경 0줄, 28+ 사용처 무손상, persistence v1 무영향.
- [x] **항목 3**: §3 Multilingual — **옵션 (B) Optional Slice + (C) Helper hybrid** 승인 (`titleI18n?` + `getTitle / getArtistName` helper). **근거**: `artist.nameEn?` 이 이미 부분 multilingual 정착 — 본 패턴을 full multilingual 로 자연 확장. SCHEMA_VERSION "v1" 100% 유지.
- [x] **항목 4**: §4 PASSPORT architecture — **옵션 (A) Dual-layer 분리** 승인 (rule amendment 0줄, Passport UI vs 기존 Drawer 공존). **근거**: PASSPORT-1_SPEC.md §12 "기존 Drawer 시스템 제거 금지" 명시 정합 + rule_14/17 본문 amendment 0줄.
- [x] **항목 5**: §4.4 Passport mode 진입 시 drawer auto-close — single-drawer policy 답습·확장 승인. **근거**: STEP 124/125 정착 정책의 자연 확장, z-index 충돌 방어, dimension 분리 정합.
- [x] **항목 6 (사용자 정정)**: §5 PDF architecture — **server-side PDF 방향성 승인 — 단, 채택 범위 *신규 영역만* 으로 한정**. *신규 영역 (Invoice / Contract / Certificate / Passport export) 만 server-side PDF*. 기존 `ReceiptPrintView` (STEP 87) / `TaxInvoicePrintView` (STEP 89) 의 `window.print()` **4 곳** 정착물은 **보존**. **전면 전환 여부는 STEP 132 별도 결정**. **근거** (사용자 spec): Phase 1.0 §1.5 검증에서 STEP 87/89 window.print() 4 곳 활성 사용 확인 → 회귀 risk 차단 + STEP 132 scope 합리적 유지.
- [x] **항목 7 (사용자 정정)**: §5.2 라이브러리 후보 — **Puppeteer / Playwright / `react-pdf` 3 후보 동등**. 본 STEP 128 에서 선호 표명 **없음**. **STEP 132 진입 시 3 후보를 Vercel 빌드 환경 실험 + 디자인 시안 재현 정확도 정량 비교 후 결정**. **근거** (사용자 spec): react-pdf 가 client/server hybrid 옵션으로 Vercel 정합성·한글 폰트 측면에서 동등 검토 가치. 본 STEP 에서 임의 선호 표명 회피.
- [x] **항목 8**: §6 rule_14 / rule_17 / rule_1 / rule_5 본문 amendment 0줄 + clarifying note (§4.8 / §6.2) 만 doc 안 — 정책 문서 갱신은 사용자 명시 승인 후 별도 doc-only STEP 진입. **근거**: 본문 변경 risk 회피 + 정책 문서 변경의 명시적 결정 과정 보존.
- [x] **항목 9**: §7 STEP 129~135 revised roadmap **7 STEP 승인** (각 Phase 1/2 분리). **근거**: STEP 127 패턴 답습 (사실관계 사전 검증 → 분석 doc → 사용자 결정 → implementation), 각 STEP 의 revert 단위 보존.
- [x] **항목 10 (인지)**: §7.3 **14 turn 추정 인지**. 실제 진행 시 사실관계 검증 단계 발견 사항으로 인한 추가 turn 가능 (현실적 **30~40 turn**). **일정 못 박지 않음** — 사용자 인지 항목 (사용자 spec).

### §9.1 본 결정 결과의 production 영향

| 영역 | Phase 1 결정 → production 영향 |
|------|------------------------------|
| AXID 옵셔널 슬롯 도입 (§2) | STEP 133 (Expanded Passport) 시점에 production 진입 |
| Multilingual hybrid (§3) | STEP 130 (i18n Layer) 시점에 production 진입 |
| PASSPORT Dual-layer (§4) | STEP 131~135 의 UI 영역 |
| server-side PDF 신규 영역만 (§5 정정) | STEP 132 시점에 라이브러리 결정 + production 진입. 기존 4 곳 window.print() 무손상 보존 |
| Manifesto clarifying note (§6) | 별도 doc-only STEP 진입 시점 |

---

## §10 Phase 1.0 grep 결과 raw

### AXID grep
```
src/types/artwork.ts:33:  export interface AXID {
src/types/artwork.ts:34:    code: string;        // e.g. "AXV-2025-0001"
src/types/artwork.ts:35:    issuedAt: string;    // ISO date
src/store/useArtworkStore.ts:1275:  function genAxid(year: number, seq: number) {
src/store/useArtworkStore.ts:1277:    code: `AXV-${year}-${String(seq).padStart(4, "0")}`,
src/store/useArtworkStore.ts:1431:    axid: genAxid(input.year, seq),
+ 24 추가 usage sites (드로어/aggregates/utils/mock-data/scenarios)
```

### title / artist
```
src/types/artwork.ts:23:  export interface Artist {
src/types/artwork.ts:25:    name: string;
src/types/artwork.ts:26:    nameEn?: string;             // 이미 부분 multilingual
src/types/artwork.ts:41:    title: string;               // primitive, multilingual 0
src/types/artwork.ts:42:    artist: Artist;
```

### SCHEMA_VERSION
```
src/lib/persistence.ts:42:  export const STORAGE_KEY = "axvela.gallery.v1";
src/lib/persistence.ts:43:  export const SCHEMA_VERSION = "v1" as const;
src/lib/persistence.ts:236-252:  validateV1 required 15 keys (위 §1.3 표 참조)
```

### Drawer system
```
Glob src/components/**/*Drawer.tsx → 29 files
  - ui/Drawer.tsx (primitive)
  - 28 domain drawers (artwork/contract/curation/customer/documents/drilldown/fiscal/inquiry/insight/invoice/logistics/market-analysis/payment/receipt/reporting/settlement/tax/tax-invoice/transaction/admin×2/audit×2)
src/types/drilldown.ts:216-217:  detailKind / detailId metadata
```

### PDF / print
```
src/components/receipt/ReceiptPrintView.tsx (STEP 87)
src/components/receipt/ReceiptDetailDrawer.tsx:169,178  window.print()
src/components/tax-invoice/TaxInvoicePrintView.tsx (STEP 89)
src/components/tax-invoice/TaxInvoiceDetailDrawer.tsx:157,163  window.print()
package.json: 외부 PDF 라이브러리 0개 (@react-pdf / puppeteer / playwright / jsPDF / html2canvas 부재)
```

### STEP 127 정착물
```
src/types/invoice.ts: invoiceKind? optional slot
src/lib/invoice-helpers.ts: getInvoiceKind helper
src/lib/__tests__/invoice-kind.scenarios.ts: 5 scenarios + runAllScenarios
```

---

## §11 다음 단계 — Phase 1 종결 후 진행

본 doc 작성 + ZIP package + STEP_INDEX/HANDOFF 갱신 단일 commit 후:

1. **사용자 본 review 검토** — §9 체크리스트의 10 항목 결정.
2. 승인 후 → **STEP 129 entry briefing 별도 작성** (Phase 1 architecture review pattern 답습, 사실관계 사전 검증 + analysis doc → 사용자 승인 → implementation).
3. STEP 129~135 = 7 STEP × 각 Phase 1/2 분리 = **14 turn 의 incremental 작업**.
4. PASSPORT-1.png + PASSPORT-1_SPEC.md 의 git add 는 STEP 131 (Closed Passport Card) 진입 시점 으로 보류 — 본 STEP 128 종결 시점에는 untracked 보존.

---

## §12 revert / rollback 시나리오

본 review 자체는 doc-only — revert 비용 0.

| 의도 | 명령 |
|------|------|
| 본 STEP 128 review 자체 폐기 (재설계) | doc 갱신 후 사용자 재승인 — 코드 0줄 영향 |
| 결정 옵션 변경 (예: §4 옵션 A → 옵션 B) | 본 doc §4/§6 갱신, STEP 129~135 roadmap 재정의 |
| Passport architecture 자체 보류 (§4 옵션 C) | STEP 131~135 삭제, STEP 129~130 만 유지 |
| Server-side PDF 방향성 폐기 (§5) | STEP 132 삭제, browser print 보존 + Passport export 별도 정책 |
