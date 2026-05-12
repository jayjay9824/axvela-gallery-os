// ============================================================================
// AXVELA core types
// Artwork = Single Source of Truth (rule_1)
// ============================================================================

import type { ArtworkRegistrationStatus } from "./artwork-registration-status";
// STEP 130 — Multilingual schema 정착 (Optional Slice 10회째). DocumentLocale
// 재활용 (STEP 96 정착물, 4-locale ko/en/ja/zh, AILocale alias). 신설 `Locale`
// type 폐기 결정 (STEP 130 Phase 1 review §2 + §8).
import type { DocumentLocale } from "@/lib/document-locale";

/**
 * State machine per rule_6.
 *   DRAFT → READY → INQUIRY → DEAL → PAID → CLOSED
 *   CLOSED → REOPENED | BROKERED
 */
export type ArtworkState =
  | "DRAFT"
  | "READY"
  | "INQUIRY"
  | "DEAL"
  | "PAID"
  | "CLOSED"
  | "REOPENED"
  | "BROKERED";

export interface Artist {
  id: string;
  /**
   * Primary artist name (default `ko`, gallery baseline).
   *
   * **STEP 130 의미 lock**: 본 field 는 *primary locale (ko 가정) 의 이름*.
   * 다국어 표시 시 `nameI18n?[locale]` 우선, 미정의 시 본 field fallback.
   * **변경 0줄 정책 — rule_1 일관 (Physical Root Key 영구 보존)**.
   */
  name: string;
  /**
   * Legacy English name slot (Foundation 시점 정착, 6 files 사용처).
   *
   * **STEP 130 정합**: 본 field 는 *backward compat 보존*. 신규 다국어 입력은
   * `nameI18n?` 우선, 본 field 는 `nameI18n?.en` 부재 시 fallback chain 의 일부.
   * `getArtistName(artist, "en")` helper 가 `nameI18n?.en ?? nameEn ?? name`
   * chain 흡수 — 호출처 28+ 무변경 (옵션 c1 병행, STEP 130 Phase 1 review §5).
   * 미래 deprecation 결정 시 별도 STEP.
   */
  nameEn?: string;
  /**
   * STEP 130 — Multilingual name slot (Optional Slice 10회째 답습).
   *
   * **persistence v1 호환**: 옵셔널 슬롯 — 기존 Artist 데이터 (Phase 1 ~
   * STEP 129) 모두 undefined 상태 보존. validateV1 무변경, SCHEMA_VERSION
   * "v1" 변경 0. 자연 forward-compat.
   *
   * **사용 정책**:
   *   - `getArtistName(artist, locale)` 호출이 단일 derivation point (STEP 127
   *     `getInvoiceKind` 패턴 답습).
   *   - 호출처는 본 field 직접 접근 금지 — helper layer 만 호출.
   *   - chain: `nameI18n?[locale] ?? (locale === "en" ? nameEn : undefined)
   *           ?? name`.
   *
   * **rule_5 AI-Human Loop**: 본 field 는 *사용자 명시 입력* 데이터. AI 동적
   * 변환 (STEP 96 TranslationToolbar) 와는 별도 dimension — runtime AI projection
   * 은 본 field 미사용.
   */
  nameI18n?: Partial<Record<DocumentLocale, string>>;
}

/**
 * AXID = Physical Root Key (rule_1).
 * Connects the physical artwork to its digital record.
 */
export interface AXID {
  code: string;        // e.g. "AXV-2025-0001"
  issuedAt: string;    // ISO date
}

export interface Artwork {
  id: string;
  axid: AXID;
  /**
   * Primary artwork title (default `ko`, gallery baseline).
   *
   * **STEP 130 의미 lock**: 본 field 는 *primary locale 의 제목*. 다국어 표시
   * 시 `titleI18n?[locale]` 우선, 미정의 시 본 field fallback. **변경 0줄
   * 정책** — rule_1 Physical Root Key 일관 + Phase 1 ~ STEP 129 모든 데이터
   * 호환.
   */
  title: string;
  /**
   * STEP 130 — Multilingual title slot (Optional Slice 10회째 답습).
   *
   * **persistence v1 호환**: 옵셔널 슬롯 — 기존 Artwork 데이터 (Phase 1 ~
   * STEP 129) 모두 undefined 상태 보존. validateV1 무변경, SCHEMA_VERSION
   * "v1" 변경 0.
   *
   * **사용 정책**:
   *   - `getTitle(artwork, locale)` 호출이 단일 derivation point (STEP 127
   *     `getInvoiceKind` 패턴 답습).
   *   - 호출처는 본 field 직접 접근 금지 — helper layer 만 호출.
   *   - chain: `titleI18n?[locale] ?? titleI18n?["en"] ?? title`.
   *
   * **STEP 96 Translation Layer 와의 dimension 분리**: 본 field 는 *영구
   * 저장된 사용자 입력 다국어 데이터*. STEP 96 TranslationToolbar 의 *runtime
   * AI projection* 과는 별도 layer (STEP 130 Phase 1 review §1 Two-Layer
   * Curation Model 패턴 답습).
   *
   * **사용처 wire**: 본 STEP 130 = infrastructure 정착만, 사용처 (Drawer /
   * Print / Passport / ArtworkGrid) wire 는 STEP 131+ 점진적 적용.
   */
  titleI18n?: Partial<Record<DocumentLocale, string>>;
  artist: Artist;
  year: number;
  medium: string;
  dimensions: string;            // "162.0 × 130.3 cm"
  priceKRW: number;
  state: ArtworkState;
  thumbnailColor: string;        // placeholder swatch color (fallback)
  /**
   * STEP 50.5 — Optional artwork image. Data URL (base64) 권장 — 이번 STEP은
   * 외부 스토리지 미연결, 모든 이미지는 브라우저 메모리/persistence에 inline
   * 저장. 부재 시 thumbnailColor placeholder 사용. 향후 STEP에서 외부 storage
   * (S3 등) 연결 시 본 필드는 그대로 두고 URL만 외부 host로 교체.
   *
   * STEP 53 — `<img src>`로 사용. provider가 LocalPreview면 data URL,
   * 향후 실 provider면 외부 host URL. UI 단에서는 분기 없이 그대로 사용.
   */
  imageUrl?: string;

  // ── STEP 53 — Image storage provider 메타데이터 (5 옵셔널 필드) ──────────
  // 모두 옵셔널 — Persistence schema 변경 최소화 (validateV1은 슬라이스 *존재*만
  // 검증, 필드 단위 강제 없음). 기존 record (STEP 50.5에서 imageUrl만 있는
  // 데이터)는 본 필드들 부재 상태로 hydrate되며, UI는 부재 시 fallback 라벨.
  //
  // 향후 외부 storage 연결 시: imageUrl만 외부 host로 교체되고, 나머지 필드는
  // provider별로 자동 채워짐 (delete / replace 시 storageKey 식별자 필요).

  /**
   * 향후 delete / replace 시 식별자. Provider별 의미 다름 (S3 key / R2 key /
   * Vercel Blob id 등). LocalPreviewProvider는 client-side ad-hoc id.
   */
  imageStorageKey?: string;
  /** Provider 식별 ("local_preview_v1" / "vercel_blob_v1" / "r2_v1" / ...). */
  imageProvider?: string;
  /** MIME type ("image/jpeg" / "image/png" / "image/webp" 등). */
  imageMimeType?: string;
  /** Original file size (bytes). audit / 경고 표시용. */
  imageSize?: number;
  /** ISO datetime — 업로드 시각. */
  imageUploadedAt?: string;

  inquiryCount: number;
  updatedAt: string;             // ISO datetime

  // ── STEP 114 — Phase 4 Operational Lifecycle (optional slot) ────────────
  // **Two-Dimension State Model**:
  //   - `state` (rule_6, 기존): sales lifecycle 8-state
  //   - `registrationStatus` (본 STEP): operational/registration lifecycle 10-state
  //
  // 두 dimension 은 *별도 union* — TypeScript 가 type-distinct 처리, 충돌 0건.
  // 두 dimension 의 mapping (자동 derive) 은 STEP 117/122 영역.
  //
  // **Optional slot — backward compat 보장**:
  //   - validateV1 / SCHEMA_VERSION "v1" 변경 0줄
  //   - 기존 데이터 (registrationStatus 부재) 자동 호환 (undefined fallback)
  //   - 사용자 명시 click 으로만 set (rule_5 / Phase 4 §4.4 draft-safe)
  //
  // **Spec source**: AXVELA_WORKFLOW_ARCHITECTURE.md §3.1
  registrationStatus?: ArtworkRegistrationStatus;

  // ── STEP 119 — Curation Connected Data (5 optional inline fields) ───────
  //
  // 사용자 spec STEP 119 (#9 Curation as Connected Data) 정확 매칭. Artwork
  // master record 에 *직접 연결되는* 큐레이션 / 전시 / 작가 / provenance inline
  // 데이터.
  //
  // **CurationNote (별도 entity) 와의 dimension 분리**:
  //   - `CurationNote` (src/types/curation.ts) — 공식 큐레이션 문서 (DRAFT/
  //     APPROVED/LOCKED 3-stage, version chain, AI-Human Loop 정착).
  //   - 본 5 fields — Artwork 직접 inline data, 별도 lifecycle 없음, free-form
  //     plain text.
  //
  // 두 layer 는 의도적 *별도 dimension*: 정식 큐레이션 카탈로그 텍스트는 →
  // CurationNote 로, 작품 마스터에 붙는 light note 는 → 본 fields 로.
  //
  // **Optional slot — backward compat 보장**:
  //   - validateV1 / SCHEMA_VERSION "v1" 변경 0줄
  //   - 기존 mock-data.ts 모든 artwork 자동 호환 (undefined fallback)
  //   - 모두 free-form string, validation 미진입 (future STEP)
  //
  // **Spec source**: AXVELA_WORKFLOW_ARCHITECTURE.md §3.1 + 사용자 spec STEP 119 #9.
  // **Helper module**: src/types/artwork-curation-data.ts (key union + labels + helpers).

  /** 작품 설명 — 자유 텍스트, free-form. 매체/치수 외 자유 해설. */
  description?: string;
  /** 큐레이션 초안 — CurationNote 만들기 전 quick note 또는 보조 메모. */
  curationDraft?: string;
  /** 전시 설명 — 전시 컨텍스트 / 전시 기획서 텍스트. */
  exhibitionText?: string;
  /** 작가 메모 — 작가 본인의 work statement / artist statement. */
  artistNote?: string;
  /** Provenance / 소장 이력 메모 — 출처 / 이전 소유자 / 전시 이력. */
  provenanceNote?: string;
}

/**
 * Living Timeline event (rule_8).
 * Every event ties back to a Transaction / Document / Payment.
 */
export type TimelineEventKind =
  | "STATE_CHANGE"
  | "DOCUMENT"
  | "INQUIRY"
  | "TRANSACTION"
  | "PAYMENT"
  | "NOTE";

/**
 * STEP 21 — Domain entity types that audit log events can navigate to.
 * Optional reference on TimelineEvent (`relatedEntityType` + `relatedEntityId`)
 * is populated by store actions that emit events tied to a specific source
 * entity. The audit log uses these to dispatch to the appropriate drawer.
 *
 * "curation" 은 예외적으로 `relatedEntityId = artworkId` — `CurationDraftDrawer`
 * 가 latest CurationNote를 자동 resolve하기 때문 (rule_1 — Artwork 직접 종속).
 *
 * State changes / system cascades / free-form notes는 entity ref 없이 emit되며,
 * 이 경우 audit 카드는 비-clickable 상태가 됨 (cursor / hover 효과 없음).
 */
export type TimelineEntityType =
  | "contract"
  | "curation"
  | "inquiry"
  | "inquiry_response"
  | "invoice"
  | "logistics"
  | "condition_report"
  | "receipt"
  | "settlement"
  | "tax"
  | "tax_invoice"
  | "transaction";

export interface TimelineEvent {
  id: string;
  artworkId: string;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  at: string; // ISO datetime
  actor?: string;
  /**
   * Role under which this event was performed (rule_7 RBAC audit).
   * Optional — System-emitted cascades and pre-RBAC seed data leave this
   * undefined. Set by every RBAC-gated store action.
   */
  actorRole?: "STAFF" | "MANAGER" | "OWNER";
  /**
   * STEP 21 — Optional reference for audit log navigation (rule_8).
   * Set by store actions that emit events tied to a specific domain entity.
   * Audit log cards become clickable when this is populated; otherwise they
   * remain read-only display.
   */
  relatedEntityType?: TimelineEntityType;
  /**
   * STEP 21 — Entity-specific id for navigation. For "curation" this is the
   * artworkId (drawer resolves latest); for all other types it is the entity's
   * primary id (contractId / settlementId / taxRecordId / logisticsId / etc.).
   */
  relatedEntityId?: string;
}
