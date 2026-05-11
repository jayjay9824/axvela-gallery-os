// ============================================================================
// Operational Drilldown — STEP 67.
//
// 모든 도메인의 metric / count / status badge 클릭을 흡수하는 reusable navigation
// layer. 각 KPI card / status badge / count summary가 OperationalDrilldownDrawer
// 를 열어 해당 metric에 기여한 *연결 객체 list*를 보여주고, 각 row가 작품으로
// navigate (rule_1 — Artwork-First).
//
// **두 부분**:
//   1. `DrilldownPayload` — 어떤 drilldown인지 declarative하게 표현 (discriminated
//      union 형태로 domain 분기, 각 domain은 generic filter context)
//   2. `DrilldownResolverResult` — resolver가 store state를 흡수해 만들어낸 결과
//      (title / context / columns / rows). 도메인-agnostic 표 view에 그대로 주입.
//
// **작품-중심 navigation**:
//   - row.artworkId가 있으면 row 클릭 시 setSelectedArtwork → DetailPanel sync
//   - row.artworkId 부재 시 (storage orphan 등) row 자체는 non-clickable, 다른 액션
//
// **표현 정책 (사용자 spec)**:
//   - 사용: "운영 흐름" / "상세 보기" / "연결 객체" / "작품 이동" / "운영 참고"
//   - 금지: "financial guarantee" / "official accounting" / "legal audit" /
//     "investment recommendation" / "certified valuation"
// ============================================================================

import type { ArtworkState } from "./artwork";
import type { LogisticsStatus } from "./logistics";

// ----------------------------------------------------------------------------
// Domain enum — drilldown 가능 분류
// ----------------------------------------------------------------------------

export type DrilldownDomain =
  // Artwork status drilldown
  | "artwork_state"
  // Logistics
  | "logistics_status"
  | "logistics_calendar_day"
  | "logistics_awaiting_condition"
  // Reporting (KPI 카드별)
  | "reporting_invoices"
  | "reporting_settlements"
  | "reporting_tax"
  | "reporting_fx_converted"
  // Reporting Channel Mix (STEP 70)
  | "reporting_channel_inquiries"
  | "reporting_channel_customers"
  | "reporting_channel_deals"
  // Reporting Currency Breakdown (STEP 70)
  | "reporting_currency_breakdown"
  // Documents Hub (STEP 72)
  | "documents_all"
  | "documents_invoices"
  | "documents_contracts"
  | "documents_tax_records"
  | "documents_condition_reports"
  // Customer (STEP 73)
  | "customer_inquiries"
  | "customer_purchases"
  | "customer_owned_artworks"
  | "customer_segment"
  | "customer_channel"
  // Storage / Image cleanup
  | "storage_with_image"
  | "storage_external"
  | "storage_fallback"
  | "storage_orphan"
  // System Audit Log (STEP 78)
  | "audit_events"
  | "audit_category"
  | "audit_severity"
  | "audit_action";

// ----------------------------------------------------------------------------
// Payload — domain별 filter context
//
// **설계 원칙**: 한 generic shape로 모든 domain 표현 → store slice가 단일
// discriminated union으로 단순. resolver가 domain별로 적절한 필드 해석.
// ----------------------------------------------------------------------------

export interface DrilldownPayload {
  domain: DrilldownDomain;
  /** Artwork status drilldown 시 — DRAFT / READY / ... */
  artworkState?: ArtworkState;
  /** Logistics status drilldown 시 — READY_FOR_PICKUP / IN_TRANSIT / ... */
  logisticsStatus?: LogisticsStatus;
  /** Logistics calendar 특정 날짜 drilldown 시 — YYYY-MM-DD */
  isoDate?: string;
  /** Storage orphan 시 — 외부 inspection으로 받은 blob pathname 목록 */
  blobPathnames?: ReadonlyArray<string>;
  /**
   * STEP 70 — Channel Mix drilldown 시 inherits 채널 (`InquirySource`).
   * undefined면 채널 미지정 → 전체 (top-line StatCard 클릭 흐름).
   * 본 모듈은 `InquirySource` import를 회피해 string으로 보유 — 호출자가
   * source enum 값을 그대로 string으로 넘기고 resolver가 sanity check.
   */
  source?: string;
  /**
   * STEP 70 — Currency Breakdown drilldown 시 inherits 통화.
   * undefined면 전체 통화. 본 모듈은 `Currency` import 회피 — string 보유.
   */
  currency?: string;
  /**
   * STEP 72 — Documents Hub drilldown 시 inherits status filter.
   * "all" / "completed" / "inprogress" — `DocumentStatusFilter` enum 값 string 보유.
   * 본 모듈은 documents-aggregates 의존성 회피.
   */
  documentStatus?: string;
  /**
   * STEP 72 — Documents Hub drilldown 시 inherits text search query.
   * lowercase substring 매칭으로 resolver가 처리.
   */
  searchQuery?: string;
  /**
   * STEP 73 — Customer drilldown 시 inherits 고객 식별자.
   * Customer는 derived entity (deriveCustomers — id는 displayName lowercase trim).
   * 부재 시 segment / source 필드만으로 고객 list filter.
   */
  customerId?: string;
  /** STEP 73 — UI title 노출용 — 부재 시 customerId / source / segment에서 derive. */
  customerName?: string;
  /**
   * STEP 73 — Customer segment drilldown 시 inherits segment.
   * `CustomerSegment` enum 값을 string으로 보유 (type 모듈 의존성 회피).
   * "PROSPECT" / "ONE_TIME_BUYER" / "REPEAT_BUYER" / "DORMANT".
   */
  segment?: string;
  /**
   * STEP 78 — System Audit Log drilldown 시 inherits 카테고리 필터.
   * `AuditCategory` enum 값을 string으로 보유 (type 모듈 의존성 회피).
   * "image_storage" / "backup" / "restore" / "permission" / "system".
   * 부재 시 카테고리 필터 미적용.
   */
  auditCategory?: string;
  /**
   * STEP 78 — System Audit Log drilldown 시 inherits severity 필터.
   * `AuditSeverity` enum 값을 string으로 보유.
   * "info" / "warning" / "error".
   * 부재 시 severity 필터 미적용.
   */
  auditSeverity?: string;
  /**
   * STEP 78 — System Audit Log drilldown 시 inherits action 필터 (정확 일치).
   * SystemAuditEvent.action은 free string이므로 별도 enum 변환 없이 그대로.
   * 예: "orphan_remove_request_success".
   * 부재 시 action 필터 미적용. UI 통합은 본 STEP에서 미실시 — resolver만 지원
   * (향후 STEP에서 action breakdown UI 추가 시 자연 활성).
   */
  auditAction?: string;
  /**
   * Reporting drilldown 시 inherits 현재 period (filter sync — 사용자 spec).
   * undefined면 전체 기간.
   */
  periodFromIso?: string;
  periodToIso?: string;
  /**
   * UI 표시용 부가 컨텍스트 — drilldown title 아래에 노출 ("기간: 2026-04-01 ~ 04-30").
   */
  contextLabel?: string;
}

export type DrilldownRequest =
  | { kind: "closed" }
  | { kind: "open"; payload: DrilldownPayload };

// ----------------------------------------------------------------------------
// Resolver result — domain-agnostic table view input
// ----------------------------------------------------------------------------

export type DrilldownTone =
  | "neutral"
  | "info"
  | "warning"
  | "error"
  | "success";

export interface DrilldownColumn {
  key: string;
  label: string;
  /** 정렬 (기본 left). amount 등 숫자열은 right. */
  align?: "left" | "right";
  /** Tailwind width class (예: "w-32", "w-1/4"). 미지정 시 flex-1 균등. */
  widthClass?: string;
}

export interface DrilldownCellValue {
  /** 표시 텍스트. */
  text: string;
  /** 톤 — 색상 분기. */
  tone?: DrilldownTone;
  /** italic 보조 텍스트 (예: "외부 저장소"). */
  meta?: string;
}

export interface DrilldownRow {
  /** 결정성 키 — react key + sort 안정성 */
  id: string;
  /**
   * 작품 ref — 있으면 row 클릭 시 setSelectedArtwork로 DetailPanel sync.
   * 부재 시 (storage orphan 등) row는 non-clickable, 별도 액션 영역만.
   */
  artworkId?: string;
  /**
   * STEP 124 — Entity-direct detail drilldown.
   *
   * 일반적으로 row 클릭 시 artworkId 로 작품 상세로 이동하지만, 본 row 가
   * *entity 자체의 detail* 을 직접 여는 게 사용자 의도에 더 맞는 경우가 있다
   * (예: customer_inquiries drilldown 의 row 는 "이 문의 자체의 상세"). 그
   * 경우 resolver 가 detailKind / detailId 를 채우면 OperationalDrilldownDrawer
   * 의 handleRowClick 이 entity detail drawer 를 우선 열고 (artwork navigate
   * fallback). 양쪽 다 채워져 있으면 detailKind 우선.
   *
   * **Single-drawer policy (lifecycle)**: detailKind 진입 시 drilldown drawer
   * 자동 close — z-index 충돌 / 가려짐 방어. 사용자 spec STEP 124 — "drawer
   * 또는 inline panel 에 표시".
   */
  detailKind?: "inquiry" | "invoice" | "settlement" | "tax" | "tax_invoice";
  detailId?: string;
  /**
   * 컬럼 key → cell value 매핑. resolver가 columns 정의와 일치하게 채움.
   */
  cells: Record<string, DrilldownCellValue>;
}

export interface DrilldownResolverResult {
  /** Drawer 헤더 — "출고 대기 · 5건" 등 */
  title: string;
  /** Sub-header — "기간: ...", "필터: ..." 등 */
  context?: string;
  /** Empty state 메시지 — rows가 비었을 때 */
  emptyMessage?: string;
  columns: ReadonlyArray<DrilldownColumn>;
  rows: ReadonlyArray<DrilldownRow>;
}
