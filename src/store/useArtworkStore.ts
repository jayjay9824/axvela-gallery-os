import { create } from "zustand";
import type {
  Artwork,
  ArtworkState,
  TimelineEvent,
} from "@/types/artwork";
import type {
  Inquiry,
  InquiryStatus,
  InquirySource,
  InquiryType,
} from "@/types/inquiry";
import type {
  Transaction,
  TransactionStatus,
  Currency,
} from "@/types/transaction";
import type { Invoice } from "@/types/invoice";
// STEP 129 — rule_3 Money Flow Separation defense in depth layer (b):
// registerPayment 진입 시 PRE invoice silent reject guard (STEP 127 Phase 1 §2.4).
import { canRegisterPaymentFor } from "@/lib/invoice-helpers";
import type { FXRate } from "@/types/fx";
import type {
  Payment,
  PaymentMethod,
} from "@/types/payment";
import type {
  Receipt,
  ReceiptStatus,
  ReceiptDeliveryStatus,
} from "@/types/receipt";
import type {
  TaxInvoice,
  TaxInvoiceCreateInput,
} from "@/types/tax-invoice";
import type { Settlement } from "@/types/settlement";
import type { TaxRecord } from "@/types/tax";
import type { Contract } from "@/types/contract";
import type {
  CurationNote,
  CurationNoteUpdate,
  CurationStatus,
} from "@/types/curation";
import type { Logistics, LogisticsStatus } from "@/types/logistics";
import type {
  ConditionReport,
  ConditionStatus,
  ReportType,
} from "@/types/condition-report";
import type { Role, Permission } from "@/types/role";
import type { PriceSuggestion } from "@/types/price-suggestion";
import { hasPermission, actorLabel, ROLE_RANK, ROLE_LABEL_KR } from "@/lib/rbac";
import { isHistoricalTransaction } from "@/lib/transaction-helpers";
import {
  generatePriceSuggestion,
  computeGalleryMedianPriceKRW,
} from "@/lib/axvela-price";
import { gatherMarketSignals } from "@/lib/market-data";
import { fetchLogisticsSync } from "@/lib/logistics-provider";
import { createFXSnapshot } from "@/lib/fx-provider";
import { deleteImageByProvider } from "@/lib/image-storage-provider";
import {
  loadBackupMetadata,
  markBackupCompleted as markBackupCompletedInStorage,
  clearBackupMetadata,
} from "@/lib/backup-metadata";
import type {
  SystemAuditEvent,
  SystemAuditEventInput,
  AuditCategory,
} from "@/types/audit-event";
import {
  loadAuditLog,
  saveAuditLog,
  appendAuditEventToList,
  clearAuditLog as clearAuditLogStorage,
  // STEP 84 — saveAuditLog 직후 trim / save-fail 신호 폴링용
  consumeAuditLogTrimFlag,
  consumeAuditLogSaveFailFlag,
} from "@/lib/audit-log-storage";
// STEP 84 — system audit 신호 발행 (3-layer guard: re-entry / cooldown / sessionOnce)
import { emitSystemAuditSignal } from "@/lib/system-audit-signals";
import type {
  DrilldownPayload,
  DrilldownRequest,
} from "@/types/drilldown";
import {
  getActiveAdapter,
  type PersistedState,
  SCHEMA_VERSION,
} from "@/lib/persistence";
// STEP 130 Phase 2 Commit 2 — UI display locale slice (rule_5 사용자 명시 선택,
// AI 자동 변경 금지). DocumentLocale = STEP 96 정착 (AILocale alias, 4-locale
// ko/en/ja/zh). DEFAULT_DOCUMENT_LOCALE = "ko" — 갤러리 운영 baseline.
import {
  DEFAULT_DOCUMENT_LOCALE,
  type DocumentLocale,
} from "@/lib/document-locale";
// STEP 131 Phase 2 Commit 2 — ArtworkGrid surface display mode slice
// (rule_5 사용자 명시 선택, AI 자동 토글 금지). 본 type-only import 는
// runtime 의존 0건 (TypeScript erase 후 0 byte). ViewMode 단일 진실 원천 =
// `src/components/artwork/ViewModeToggle.tsx:76` (Commit 1 정착물).
import type { ViewMode } from "@/components/artwork/ViewModeToggle";
import type { ArtworkDraftState } from "@/types/artwork-draft";
import {
  MOCK_ARTWORKS,
  MOCK_TIMELINE,
  MOCK_INQUIRIES,
  MOCK_TRANSACTIONS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_SETTLEMENTS,
  MOCK_TAX_RECORDS,
  MOCK_CONTRACTS,
  MOCK_CURATION_NOTES,
  MOCK_LOGISTICS,
  MOCK_CONDITION_REPORTS,
} from "@/lib/mock-data";
import { getTransition, type TransitionDef } from "@/lib/state-machine";
import {
  STATE_LABEL_KR,
  INQUIRY_STATUS_LABEL,
  INQUIRY_TYPE_LABEL,
  INQUIRY_SOURCE_LABEL,
  TRANSACTION_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  SETTLEMENT_STATUS_LABEL,
  TAX_RECORD_STATUS_LABEL,
  TAX_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  CURATION_STATUS_LABEL,
  LOGISTICS_STATUS_LABEL,
  REPORT_TYPE_LABEL,
  CONDITION_STATUS_LABEL,
  splitSettlement,
  splitTax,
  generateContractDraftContent,
  generateCurationDraftContent,
  generateInquiryResponseDraft,
  formatMoney,
} from "@/lib/utils";

// ----------------------------------------------------------------------------
// UI request types
// ----------------------------------------------------------------------------

export type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; id: string };

export type TransitionRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string; transition: TransitionDef };

export type InquiryDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; inquiryId: string };

/**
 * STEP 49 — Manual Inquiry Creation request slice. 작품 컨텍스트(artworkId)에서
 * 신규 inquiry를 직접 생성하기 위한 lightweight drawer 상태. UI 슬라이스 —
 * PersistedState 무관 (사용자 spec "Persistence schema 변경 금지" 준수).
 */
export type InquiryCreateRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

export type TransactionDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; transactionId: string };

export type InvoiceDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; invoiceId: string };

/**
 * STEP 87 — Receipt detail overlay request. Driven by receiptId. The drawer
 * shows print/PDF/send-prepare actions for ISSUED receipts (read-only metadata
 * + lifecycle), or edit fields for DRAFT receipts.
 */
export type ReceiptDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; receiptId: string };

/**
 * STEP 89 — Tax Invoice detail overlay request. Driven by taxInvoiceId.
 * The drawer shows print/PDF/send-prepare actions for ISSUED tax invoices
 * (read-only metadata + lifecycle), or edit fields (amount/VAT/total/
 * businessType/memo) for DRAFT tax invoices.
 */
export type TaxInvoiceDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; taxInvoiceId: string };

/**
 * STEP 91 — Accountant Export overlay request. Pure UI state (no persistence) —
 * 실제 export package는 매 호출 시 helper로 *재계산*. The drawer locally manages
 * period selection (monthly/quarterly/yearly), CSV preview/download CTA,
 * pending-items display.
 */
export type AccountantExportRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 92 — Market Insight overlay request. UI state only — no per-snapshot
 * persistence (insights are *derived* from existing slices on demand).
 * Drawer locally manages period selection (7d / 14d / 30d).
 *
 * Optional `artworkId` allows opening the drawer in artwork-aware mode (예:
 * DetailPanel ZONE 5 entry — 해당 artwork 주변 신호 highlight 가능). 부재 시
 * gallery-wide insight (Sidebar 진입 등 future entry) 표시.
 */
export type MarketInsightRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId?: string };

/**
 * STEP 88 — Fiscal Summary overlay request. UI state only — no per-summary
 * persistence (the aggregate is *derived* from existing slices on demand).
 * The drawer locally manages period selection (monthly/quarterly/yearly).
 */
export type FiscalSummaryRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * Payment registration overlay request.
 * Driven by an invoiceId — the Payment is always registered against a specific
 * Invoice (rule_3). The drawer auto-fills amount/currency from the Invoice.
 */
export type PaymentRegisterRequest =
  | { kind: "closed" }
  | { kind: "open"; invoiceId: string };

/**
 * Settlement detail / completion overlay request.
 * Driven by a settlementId — the Drawer shows breakdown and completion action.
 */
export type SettlementDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; settlementId: string };

/**
 * TaxRecord detail / issuance overlay request.
 * Driven by a taxRecordId — the Drawer shows tax breakdown and issuance action.
 */
export type TaxDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; taxRecordId: string };

/**
 * Contract detail / approval overlay request.
 * Driven by a contractId — the Drawer shows content (editable in DRAFT,
 * read-only in REVIEW/APPROVED/LOCKED) and stage transition actions.
 */
export type ContractDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; contractId: string };

/**
 * Logistics detail overlay request — for editing carrier / tracking / dates /
 * memo / status of an existing Logistics record.
 */
export type LogisticsDetailRequest =
  | { kind: "closed" }
  | { kind: "open"; logisticsId: string };

/**
 * ConditionReport overlay request — supports both "create new" and "edit
 * existing" via discriminated union. Create needs (logisticsId, reportType)
 * for context; edit needs the reportId.
 */
export type ConditionReportRequest =
  | { kind: "closed" }
  | { kind: "create"; logisticsId: string; reportType: ReportType }
  | { kind: "edit"; reportId: string };

/**
 * STEP 16 — Curation Draft drawer overlay request.
 * Driven by an artworkId — drawer auto-resolves whether to show DRAFT (editable),
 * APPROVED (read-only + LOCK), or LOCKED (read-only + 새 버전) based on the
 * latest CurationNote for that artwork. If none exists, drawer auto-calls
 * createCurationNote() to seed a v1 DRAFT.
 */
export type CurationDraftRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

/**
 * STEP 16 — Inquiry response drawer overlay request.
 * Driven by an inquiryId — drawer shows the AI-generated draft (editable
 * if responseStatus===DRAFT, read-only if SENT). Auto-generates an initial
 * draft on first open if responseStatus is undefined.
 */
export type InquiryResponseRequest =
  | { kind: "closed" }
  | { kind: "open"; inquiryId: string };

/**
 * STEP 20 — Audit Log drawer overlay request.
 * Driven by an artworkId — drawer shows ALL TimelineEvents for that artwork
 * with classification (domain / actor type / emphasis / version chain), filter
 * chips, and emphasis markers. Read-only — TimelineEvent itself is unchanged.
 */
export type AuditLogRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

/**
 * STEP 23 — Cross-artwork Audit Log (rule_4 trust layer 확장).
 *
 * 전체 갤러리의 timeline event를 한 화면에서 보는 read-only overlay state.
 * artwork-scoped AuditLogRequest와 별개 슬라이스 — 두 view는 동시에 열릴 수
 * 없도록 GlobalAuditDrawer 내부에서 처리하지만, store 슬라이스 자체는 독립.
 *
 * 권한: `audit.view_global` (MANAGER 이상). Staff는 단일 작품 audit만 접근.
 * 권한 부족 시 Sidebar 진입점이 disabled + permissionHint, drawer는 여전히
 * 닫힌 상태 유지.
 */
export type GlobalAuditRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 35 — Multi-currency Reporting Drawer 상태. RBAC 가드 (Manager 이상).
 * Audit drawer 패턴과 동일.
 */
export type ReportingRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 51 — Documents Hub request slice. 4개 문서 도메인 (Invoice / Contract /
 * TaxRecord / ConditionReport)을 통합 read-only 검색 view로 묶기 위한 UI 슬라이스.
 *
 * **read-only utility** — rule_1 Artwork-First 보존: 본 drawer는 검색만 담당,
 * 신규 생성 / 편집 0건 (각 항목 클릭 시 기존 도메인 detail drawer 재사용).
 *
 * Persistence 무관 — UI 슬라이스 (validateV1 무영향).
 */
export type DocumentsRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 54 — Logistics Operations View 상태. 갤러리 전체 logistics를 한 화면에서
 * KPI / 필터 / 검색하는 1급 운영 view. RBAC 가드 (Manager+ — Reporting / Documents
 * 일관). 본 drawer는 검색 utility — 신규 생성/편집 0건, row 클릭 시 기존
 * LogisticsDetailDrawer 재사용.
 *
 * Persistence 무관 — UI 슬라이스 (validateV1 무영향).
 */
export type LogisticsOperationsRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 62 — Image Cleanup Admin Tool 상태. 외부 저장소 inspection + orphan
 * candidate review + remove request. read-only by default. RBAC: OWNER 전용
 * (`image.cleanup_review` permission).
 *
 * Persistence 무관 — UI 슬라이스 (validateV1 무영향).
 */
export type ImageCleanupRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 65 — System Audit Log Viewer drawer 상태. OWNER 전용 (`audit.view`).
 * 시스템 운영 기록(SystemAuditEvent[]) 조회 + 필터링 + (옵션) clear.
 *
 * **기존 `AuditLogRequest`(artwork-scoped TimelineEvent viewer)와 별개** —
 * system-level operational record를 다루는 별도 drawer.
 *
 * Persistence 무관 — UI 슬라이스 (validateV1 무영향). 본 drawer가 표시하는
 * 데이터(`auditEvents`)는 별도 localStorage 키 `axvela.audit.v1`에 영속화 —
 * PersistedState / SCHEMA_VERSION 무관.
 */
export type SystemAuditLogRequest =
  | { kind: "closed" }
  | { kind: "open" };

/**
 * STEP 41 — Collector View Drawer 상태. RBAC 가드 (Manager 이상).
 * `selectedCollectorId`는 master-detail UI에서 우측 패널이 보여줄 collector.
 * null이면 "왼쪽에서 선택" empty state.
 */
export type CollectorViewRequest =
  | { kind: "closed" }
  | { kind: "open"; selectedCollectorId: string | null };

/**
 * STEP 45 — AI Market Analysis Drawer 상태. 단일 작품 컨텍스트 view.
 * `artworkId`로 분석 대상 작품 식별. RBAC 가드 없음 — 작품 detail 자체에
 * 접근 가능하면 분석 view도 가능 (audit single-artwork view와 같은 정책).
 *
 * **UI 슬라이스이므로 PersistedState에 포함되지 않음** (사용자 spec
 * "Persistence schema 변경 금지" 준수). 도메인 데이터 슬라이스 0개 추가.
 */
export type MarketAnalysisRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

/**
 * Payload for registerPayment(). The store fills in id / status / refs / audit.
 */
export interface PaymentInput {
  invoiceId: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  /** Date the buyer actually paid (ISO string, may be date-only YYYY-MM-DD). */
  paidAt: string;
  memo?: string;
}

export interface ArtworkInput {
  title: string;
  artistName: string;
  artistNameEn?: string;
  year: number;
  medium: string;
  dimensions: string;
  priceKRW: number;
  state: ArtworkState;
  thumbnailColor: string;
  /** STEP 50.5 — Optional artwork image (data URL or external host URL). 부재 시 placeholder 사용. */
  imageUrl?: string;
  // ── STEP 53 — Image storage provider 메타 (모두 옵셔널) ──────────────────
  imageStorageKey?: string;
  imageProvider?: string;
  imageMimeType?: string;
  imageSize?: number;
  imageUploadedAt?: string;
  // ── STEP 119 합류 — Curation Connected Data (5 optional inline fields) ──
  // STEP 119 에서 type 정착, STEP 118 에서 functional 입력 surface 진입.
  // 모두 free-form string, validation 미진입 (future STEP). 모두 optional →
  // backward compat 100%, 기존 호출자 변경 0줄.
  description?: string;
  curationDraft?: string;
  exhibitionText?: string;
  artistNote?: string;
  provenanceNote?: string;
}

export interface InquiryUpdate {
  collectorName?: string;
  contact?: string;
  inquiryType?: InquiryType;
  message?: string;
  source?: InquirySource;
  status?: InquiryStatus;
  memo?: string;
}

/**
 * STEP 49 — Manual Inquiry Creation input. 운영자가 직접 inquiry를 생성할 때
 * 폼이 전달하는 payload. id / createdAt / updatedAt은 store가 채움.
 *
 * 사용자 spec: "priority" 필드는 현재 `Inquiry` 타입에 부재 → "Inquiry 구조
 * 변경 0줄" 정책 준수해 미포함. 향후 별도 STEP에서 priority enum 추가 검토.
 */
export interface InquiryCreateInput {
  collectorName: string;
  contact: string;
  inquiryType: InquiryType;
  message: string;
  source: InquirySource;
  /** 초기값은 폼 default `OPEN`을 권장 — 다른 status도 허용 (재진입 시나리오) */
  status?: InquiryStatus;
  memo?: string;
}

export interface TransactionUpdate {
  buyerName?: string;
  agreedPrice?: number;
  currency?: Currency;
  status?: TransactionStatus;
  dealMemo?: string;
}

/**
 * Editable fields on a DRAFT Invoice. Locked invoices reject all updates;
 * see createInvoiceVersion() to fork a locked document into a new editable
 * draft (rule_4 — Document trust layer).
 */
export interface InvoiceUpdate {
  amount?: number;
  currency?: Currency;
}

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

interface ArtworkUIState {
  // Data
  artworks: Artwork[];
  timeline: Record<string, TimelineEvent[]>;
  inquiries: Record<string, Inquiry[]>;
  transactions: Record<string, Transaction[]>;
  /** Invoices keyed by transactionId (rule_11). */
  invoices: Record<string, Invoice[]>;
  /** Payments keyed by transactionId (rule_3). */
  payments: Record<string, Payment[]>;
  /**
   * STEP 87 — Receipts keyed by transactionId (rule_3 — Money Flow Separation
   * 위 separate document; rule_4 — Document Trust Layer / rule_11 — chain).
   * Receipt는 Payment의 *acknowledgement document* — Payment registration 시점에
   * 자동 생성 (DRAFT) → 운영자가 발행 (ISSUED + LOCK).
   */
  receipts: Record<string, Receipt[]>;
  /**
   * STEP 89 — Tax Invoices keyed by transactionId (rule_3 + rule_11).
   * 사업자용 세금계산서 운영 record. *수동 발행*이 기본 — Receipt와 달리
   * Payment cascade 자동 생성 0건 (사업자만 대상이므로 운영자가 의도적
   * 결정해야 함).
   */
  taxInvoices: Record<string, TaxInvoice[]>;
  /** Settlements keyed by transactionId (rule_3, rule_12). */
  settlements: Record<string, Settlement[]>;
  /** TaxRecords keyed by transactionId (rule_3 — accounting layer). */
  taxRecords: Record<string, TaxRecord[]>;
  /** Contracts keyed by transactionId (rule_4 — Document Trust, rule_5 — AI-Human loop). */
  contracts: Record<string, Contract[]>;
  /** Logistics keyed by transactionId (rule_21 — physical delivery). */
  logistics: Record<string, Logistics[]>;
  /** Condition reports keyed by transactionId (rule_4 — trust documents). */
  conditionReports: Record<string, ConditionReport[]>;
  /**
   * Curation notes keyed by artworkId (rule_18 (a), rule_4 trust layer, STEP 16).
   * Artwork-first (rule_1) — Curation은 거래 이전 단계의 작품 단위 문서이므로
   * transactionId가 아닌 artworkId를 부모 키로 사용.
   */
  curationNotes: Record<string, CurationNote[]>;

  /**
   * STEP 18 — AI 가격 제안 keyed by artworkId (rule_18 (c)).
   * 같은 작품에 여러 suggestion 가능 (재실행 시 새 record 추가). 각 record는
   * deterministic helper의 출력을 보관 — id / createdAt / appliedAt 메타 추가.
   */
  priceSuggestions: Record<string, PriceSuggestion[]>;

  /**
   * STEP 117 — Artwork registration draft (단일 record 정책 v1).
   *
   * `AXVELA_WORKFLOW_ARCHITECTURE.md §4.4 Draft-safe` 정착 — 사용자가 신규
   * 작품 등록을 시작했지만 완료 전에 drawer 를 닫는 경우, 진행 중 입력이
   * 영구 손실되지 않도록 임시 저장. 사용자의 *명시적* 임시 저장 버튼 클릭
   * 시점에만 set (auto-save / cancel-silent-save 거부 — scope 절제).
   *
   * Lifecycle:
   *   - undefined (default)        → 진행 중 draft 없음, Sidebar entry 비표시
   *   - ArtworkDraftState 보유      → Sidebar "이어 작성" entry 표시
   *   - createArtwork 성공          → 자동 undefined (auto-clear)
   *   - clearArtworkDraft 호출      → undefined (수동)
   *
   * 옵셔널 슬롯 — PersistedState.artworkDraft? 와 동일 정책. 편집 모드는
   * 본 slice 무관 (편집은 기존 record 직접 update).
   */
  artworkDraft?: ArtworkDraftState;

  // UI state
  selectedArtworkId: string | null;
  query: string;
  stateFilter: ArtworkState | "ALL";
  editor: EditorState;
  transitionRequest: TransitionRequest;
  inquiryDetailRequest: InquiryDetailRequest;
  /** STEP 49 — Manual Inquiry Creation drawer 상태. */
  inquiryCreateRequest: InquiryCreateRequest;
  transactionDetailRequest: TransactionDetailRequest;
  invoiceDetailRequest: InvoiceDetailRequest;
  /** STEP 87 — Receipt detail drawer (print/PDF/send-prepare actions). */
  receiptDetailRequest: ReceiptDetailRequest;
  /** STEP 89 — Tax Invoice detail drawer (DRAFT edit / ISSUED print/PDF/send). */
  taxInvoiceDetailRequest: TaxInvoiceDetailRequest;
  /** STEP 88 — Fiscal Summary drawer (operational VAT/fiscal overview). */
  fiscalSummaryRequest: FiscalSummaryRequest;
  /** STEP 91 — Accountant Export drawer (CSV handoff package). */
  accountantExportRequest: AccountantExportRequest;
  /** STEP 92 — Market Insight drawer (operational intelligence). */
  marketInsightRequest: MarketInsightRequest;
  paymentRegisterRequest: PaymentRegisterRequest;
  settlementDetailRequest: SettlementDetailRequest;
  taxDetailRequest: TaxDetailRequest;
  contractDetailRequest: ContractDetailRequest;
  logisticsDetailRequest: LogisticsDetailRequest;
  conditionReportRequest: ConditionReportRequest;
  /** STEP 16 — Curation drawer overlay state (rule_18 (a)). */
  curationDraftRequest: CurationDraftRequest;
  /** STEP 16 — Inquiry response drawer overlay state (rule_18 (d)). */
  inquiryResponseRequest: InquiryResponseRequest;
  /** STEP 20 — Audit Log drawer overlay state (rule_7 + rule_8 follow-through). */
  auditLogRequest: AuditLogRequest;
  /** STEP 23 — Cross-artwork Audit Log overlay state (rule_4 — Manager 이상 전용). */
  globalAuditRequest: GlobalAuditRequest;
  /** STEP 35 — Multi-currency Reporting drawer 상태. */
  reportingRequest: ReportingRequest;
  /** STEP 51 — Documents Hub drawer 상태. */
  documentsRequest: DocumentsRequest;
  /** STEP 54 — Logistics Operations View drawer 상태. */
  logisticsOperationsRequest: LogisticsOperationsRequest;

  /** STEP 62 — Image Cleanup Admin Tool drawer 상태. OWNER 전용. */
  imageCleanupRequest: ImageCleanupRequest;

  /**
   * STEP 65 — System-level audit events. artworkId-less 운영 기록.
   * **별도 localStorage 키** `axvela.audit.v1`에 영속화 — PersistedState 무관
   * (validateV1 / SCHEMA_VERSION 0줄 변경). hydrate은 PersistenceProvider
   * mount 시 1회 (backup-metadata와 동일 패턴).
   *
   * 배열 순서: 최신이 index 0 (descending by createdAt). cap MAX_AUDIT_EVENTS.
   */
  auditEvents: SystemAuditEvent[];

  /** STEP 65 — System Audit Log Viewer drawer 상태. OWNER 전용. */
  systemAuditLogRequest: SystemAuditLogRequest;

  /**
   * STEP 67 — Operational Drilldown drawer 상태. 모든 도메인의 metric / count
   * / status badge 클릭이 본 슬라이스로 흡수됨. 단일 reusable drawer가 payload를
   * 받아 resolver 통해 적절한 domain 표 렌더.
   */
  drilldownRequest: DrilldownRequest;

  /**
   * STEP 59 — 백업 metadata. 도메인 데이터와 분리된 UI metadata.
   * `PersistedState`에는 포함되지 않음 (별도 localStorage 키로 영속화).
   * 백업 다운로드 성공 시 `markBackupCompleted()` 액션이 갱신.
   */
  backupMetadata: {
    lastBackupAt: string | null;
  };
  /** STEP 41 — Collector View drawer 상태. */
  collectorViewRequest: CollectorViewRequest;
  /** STEP 45 — AI Market Analysis drawer 상태. */
  marketAnalysisRequest: MarketAnalysisRequest;

  // Session (rule_7 — RBAC)
  /**
   * Current operator role. Drives both UI affordance (button disabled +
   * permission hint) and store action guards (silent no-op when permission
   * is insufficient — guards never emit timeline events).
   *
   * v1: single global role, switched manually via the sidebar role switcher
   * for demo purposes. Production would derive this from auth.
   */
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  /** Permission predicate — same logic as rbac.hasPermission, scoped to current role. */
  can: (permission: Permission) => boolean;

  // ── STEP 130 Phase 2 Commit 2 — Display Locale (UI session 슬라이스) ──────
  //
  // **본 슬라이스의 정체**:
  //   UI 표시 언어 (Sidebar header locale toggle, future ArtworkGrid / DetailPanel
  //   / Drawer 의 artwork title / artist name projection). `currentLocale` 의
  //   값에 따라 i18n-helpers (`getTitle` / `getArtistName`, STEP 130 Commit 1
  //   `01a1540` 정착) 가 다른 locale projection 반환.
  //
  // **rule_5 AI-Human Loop 정합** (필수 명시):
  //   - `currentLocale` 은 *사용자 명시 선택* — Sidebar locale toggle 클릭으로만 set.
  //   - AI 자동 변경 절대 금지 — Translation Layer (STEP 96) 가 자동 호출 0건.
  //   - 운영자의 표시 의도 = 단일 진실 원천 (사용자 spec rule_5).
  //
  // **STEP 96 Translation Layer 와의 dimension 분리** (필수 명시 — 통합 절대 금지):
  //   - `currentLocale` (본 슬라이스) = *storage-level artwork i18n* 표시 선택.
  //     artwork.titleI18n? / artist.nameI18n? optional slot 의 어떤 locale projection
  //     을 화면에 보여줄지 결정. 운영자 명시 입력 데이터 read.
  //   - `TranslationToolbar` (STEP 96) = *runtime AI projection* 의 target locale.
  //     Invoice / Receipt / TaxInvoice 등 document content 의 동적 AI 번역.
  //     local state, ephemeral cache, document entity schema 미변경.
  //   - 두 layer 의도적 별도 dimension — 통합 절대 금지. 두 locale 은 같은 enum
  //     (DocumentLocale = AILocale) 을 공유하지만, *어디서 어떻게 사용되는가* 가 다름.
  //
  // **STEP 130 Phase 1 §store rationale** (currentLocale 의미 lock):
  //   - currentLocale = UI 표시 언어 선택 (어떤 데이터를 보여줄지)
  //   - 데이터 영구 저장 언어 아님 — artwork.title / artist.name 의 *원본* 은
  //     항상 한국어 baseline (rule_1 Physical Root Key 일관).
  //   - `getTitle(artwork, currentLocale)` chain 의 *입력* 으로만 사용 — fallback
  //     chain 의 최종은 항상 원본 한국어 (Phase 1 ~ STEP 129 데이터 호환).
  //
  // **Deferred Item D-130-1 reference** (i18n-helpers.scenarios §4):
  //   `getTitle` 의 nullish `??` chain 거동상 `titleI18n[locale] = ""` 빈 문자열
  //   은 nullish 아님 → 그대로 반환 (공란 표시). 의미 결정 (공란 vs 다음 fallback)
  //   STEP 131 또는 134 재검토. 본 슬라이스는 currentLocale 의 *값 selection* 만
  //   담당 — 빈 문자열 fallback 정책은 helper 본문 영역.
  //
  // **Persistence 정책 — 옵션 P1 (Persistence 0)** (필수 명시):
  //   본 슬롯은 `PersistedState` interface (src/lib/persistence.ts §59) 에
  //   *추가되지 않음* → 자연 미 persist. 브라우저 재시작 시 항상 DEFAULT_DOCUMENT_LOCALE
  //   ("ko") 로 초기화. 사용자 spec §9 항목 2 (P1 채택) 정확 정합.
  //
  //   `currentRole` 과 동일 패턴 — 기존 정착물 (line 641, RBAC 슬라이스) 도
  //   PersistedState 부재로 자연 미 persist. UI session state 의 표준 정책.
  //
  // **resetAllData 정합**:
  //   `resetAllData()` 호출 시 DEFAULT_DOCUMENT_LOCALE 로 복귀 (사용자 spec §9
  //   항목 3). `currentRole` 은 reset 시 *보존* 되는 정책과 의도적 분리 — locale 은
  //   UI 표시 선호도이므로 도메인 초기화와 함께 자연스럽게 baseline 복귀가 일관성.
  currentLocale: DocumentLocale;
  /**
   * Display locale setter — 단순 setter (Sidebar header toggle 진입점).
   *
   * **rule_5 AI-Human Loop**: 사용자 명시 클릭으로만 호출. AI 자동 호출 금지.
   * **audit log emit 0건**: locale 전환은 운영 기록 가치 미존재 (display 선호도
   * 영역). `setCurrentRole` 의 권한 변경 audit (STEP 82) 정착물과 의도적 분리.
   */
  setLocale: (locale: DocumentLocale) => void;

  // ── STEP 131 Phase 2 Commit 2 — ArtworkGrid Display Mode (UI session) ────
  //
  // **본 슬라이스의 정체**:
  //   ArtworkGrid surface 의 카드 렌더 분기. "grid" / "passport" 2-state.
  //     - "grid"     → 기존 ArtworkCard (일반 SaaS 카드, STEP 1~129 정착물)
  //     - "passport" → PassportCard (Closed Passport, STEP 131 신설)
  //   양 mode 의 데이터 진입점은 동일 (`artworks` store 구독, rule_1 SSOT).
  //   시각만 분기.
  //
  // **rule_5 AI-Human Loop**: ViewModeToggle (Commit 1 정착) 의 사용자 명시
  // 클릭으로만 set. AI 자동 토글 절대 금지.
  //
  // **사용자 §8 항목 1, 2, 3, 6 결정 정합** (STEP 131 Phase 1):
  //   - 항목 1 (toggle 위치): Grid header (Commit 2 wire)
  //   - 항목 2 (공존 방식): ArtworkCard + PassportCard 둘 다 보존, 본 슬라이스
  //     로 토글
  //   - 항목 3 (확장 방식): ArtworkGrid 확장 + viewMode 분기 (PassportListView
  //     신설 폐기, ~120 LOC 절약 정합)
  //   - 항목 6 (persist): P1 — PersistedState 미추가, 세션마다 "grid" 초기화
  //
  // **STEP 130 Commit 2 currentLocale P1 패턴 답습**:
  //   - currentLocale 도 P1 (Persistence 0) — UI session state 표준
  //   - 본 viewMode 슬라이스는 그 패턴 정확 답습. PersistedState interface 미추가,
  //     partialize 수정 0건, 브라우저 재시작 시 "grid" 자동 초기화.
  //   - currentRole (RBAC) / currentLocale / 본 viewMode = UI session state 의
  //     일관 정책 (모두 P1).
  //
  // **resetAllData 정합**:
  //   `resetAllData()` 호출 시 "grid" 로 복귀 (STEP 130 currentLocale 정합).
  //   currentRole 의 reset 시 보존 정책과 의도적 분리 — viewMode 도 UI 표시
  //   선호도이므로 도메인 초기화와 함께 baseline 복귀가 일관성.
  //
  // **ViewMode 타입**: `src/components/artwork/ViewModeToggle.tsx:76` 단일
  // 진실 원천 (Commit 1 정착물). 본 store 는 type-only import — runtime
  // 의존 0건.
  viewMode: ViewMode;
  /**
   * View mode setter — 단순 setter (Grid header ViewModeToggle 진입점).
   *
   * **rule_5**: 사용자 명시 클릭, AI 자동 토글 금지.
   * **audit log emit 0건**: setLocale 정합 (display 선호도 영역).
   */
  setViewMode: (mode: ViewMode) => void;

  // Selection / filter
  select: (id: string | null) => void;
  setQuery: (q: string) => void;
  setStateFilter: (s: ArtworkState | "ALL") => void;

  // Editor (Artwork create/edit drawer)
  openCreate: () => void;
  openEdit: (id: string) => void;
  closeEditor: () => void;

  // Artwork CRUD
  createArtwork: (input: ArtworkInput) => string;
  updateArtwork: (id: string, input: ArtworkInput) => void;

  // STEP 117 — Artwork registration draft (Phase 4 §4.4 Draft-safe).
  /**
   * 진행 중 신규 등록 form 의 임시 저장. 사용자가 임시 저장 버튼을 클릭한
   * *그 시점* 의 form snapshot 을 그대로 저장. validation 미통과 데이터도
   * 보존 (사용자 의도 우선). 기존 draft 가 있으면 덮어씀 (단일 record v1).
   *
   * `startedAt` — 기존 draft 가 있으면 보존 (첫 시작 시점 유지), 없으면 현재
   * 시점. `lastEditedAt` — 항상 현재 시점.
   */
  saveArtworkDraft: (input: ArtworkInput) => void;
  /**
   * Draft 명시적 clear. createArtwork 성공 시 자동 호출되며, 사용자가 Sidebar
   * 등에서 명시적으로 폐기할 때도 호출 가능.
   */
  clearArtworkDraft: () => void;

  /**
   * STEP 61 — 작품 이미지 외부 storage 측 제거 + record 갱신.
   *
   * 흐름:
   *   1. artwork lookup (없으면 silent no-op)
   *   2. provider가 vercel_blob (외부 storage) → dispatcher.deleteImageByProvider
   *      호출. failure는 silent (외부 host에 잔존해도 record는 정상 갱신 — orphan
   *      cleanup helper로 향후 일괄 처리 가능).
   *   3. provider가 local_preview_v1 (base64 inline) → 외부 호출 skip — 단순
   *      record 5 image 필드 + imageUrl undefined로 set.
   *   4. timeline event 추가 (audit trail — operator가 이미지를 제거했다는 사실
   *      자체는 명시 기록).
   *
   * **destructive action — 호출자가 confirm 거쳐야 함** (UI 측 책임). store는
   * confirm 검증하지 않음 — UI / API 직접 호출자에게 위임.
   *
   * 반환: 비동기 — provider call 결과를 기다림. 단 외부 실패 시에도 record는
   * 갱신됨 (silent fallback policy).
   */
  deleteArtworkImage: (id: string) => Promise<void>;

  // State transitions (rule_6)
  openTransition: (artworkId: string) => void;
  closeTransition: () => void;
  transitionState: (artworkId: string, to: ArtworkState) => void;

  // Inquiry
  openInquiryDetail: (inquiryId: string) => void;
  closeInquiryDetail: () => void;
  updateInquiry: (inquiryId: string, patch: InquiryUpdate) => void;

  // STEP 49 — Manual Inquiry Creation. 운영자가 작품 컨텍스트에서 신규 inquiry를
  // 직접 생성. timeline event "Inquiry 직접 생성" + 정책상 READY/BROKERED일 때만
  // INQUIRY로 자동 state transition (canonical state machine 경로).
  openInquiryCreate: (artworkId: string) => void;
  closeInquiryCreate: () => void;
  createInquiry: (artworkId: string, input: InquiryCreateInput) => string | null;

  // Transaction
  openTransactionDetail: (transactionId: string) => void;
  closeTransactionDetail: () => void;
  updateTransaction: (
    transactionId: string,
    patch: TransactionUpdate
  ) => void;
  /**
   * Buyer-sync entry point (rule_13.5). Updates the Transaction's buyerName
   * AND mirrors the change to the linked Inquiry's collectorName in a single
   * atomic set(). Guards against historical transactions — only the active
   * (newest) tx for an artwork accepts buyer mutations; older tx are
   * immutable per rule_4 (Document Trust).
   *
   * Existing TransactionDetailDrawer's `updateTransaction` also auto-cascades
   * to the linked Inquiry when buyer changes — this dedicated action is the
   * programmatic shortcut for code that only needs to touch buyer.
   */
  updateBuyer: (transactionId: string, buyer: string) => void;
  /**
   * Price-only entry point (STEP 14). Updates `agreedPrice` (and optionally
   * `currency`) on the *active* transaction. Mirrors the dedicated-entry
   * pattern of `updateBuyer`. Silent no-op for historical transactions
   * (rule_4 immutability — STEP 14 read-only guard).
   */
  updatePrice: (
    transactionId: string,
    agreedPrice: number,
    currency?: Currency
  ) => void;
  /**
   * Resale loop entry point (rule_13). Validates artwork is CLOSED, then
   * cascades the CLOSED → BROKERED transition which creates a fresh
   * Transaction with isResale=true AND an auto-Inquiry (type: RESALE).
   * Idempotent under the state guard: calling on a non-CLOSED artwork is a no-op.
   *
   * `startResale` is the canonical name (matches ARCHITECTURE.md Diagram 3).
   * `createResaleTransaction` is kept as an alias for backward compatibility.
   */
  startResale: (artworkId: string) => void;
  /** @deprecated Use startResale. Kept for backward compat. */
  createResaleTransaction: (artworkId: string) => void;

  // Invoice
  openInvoiceDetail: (invoiceId: string) => void;
  closeInvoiceDetail: () => void;
  sendInvoice: (invoiceId: string) => void;
  /** Patch a DRAFT invoice. Silently no-ops on locked documents (rule_4). */
  updateInvoice: (invoiceId: string, patch: InvoiceUpdate) => void;
  /**
   * Fork a locked Invoice into a new editable DRAFT version (rule_4).
   * Returns the new invoice id; also re-targets the open drawer to it.
   *
   * **Document Lifecycle Clarity STEP**: optional `revisionReason` parameter.
   * 호출자(InvoiceDetailDrawer "새 버전 생성")가 사용자 입력을 수집한 후 전달.
   * timeline event detail + Invoice.revisionReason 양쪽에 reflect.
   */
  createInvoiceVersion: (
    parentInvoiceId: string,
    revisionReason?: string
  ) => string | null;

  // Payment (rule_3 — money flow separation)
  openPaymentRegister: (invoiceId: string) => void;
  closePaymentRegister: () => void;
  registerPayment: (input: PaymentInput) => void;

  // STEP 87 — Receipt (Cash Receipt — Payment의 acknowledgement document)
  openReceiptDetail: (receiptId: string) => void;
  closeReceiptDetail: () => void;
  /**
   * 명시적 receipt 생성 — auto-create flow가 fallback에 실패한 경우 운영자가
   * 직접 생성하기 위한 manual fallback. 일반적으로는 registerPayment 시점에
   * 자동 생성되므로 본 액션 호출 빈도는 낮음. 반환값은 새 receipt id.
   */
  createReceipt: (paymentId: string) => string | null;
  /**
   * DRAFT → ISSUED 전환 (= LOCK + finalizedAt 설정). 일단 ISSUED로 진입한
   * receipt는 수정 불가 — `createReceiptVersion`으로만 재발행.
   */
  issueReceipt: (receiptId: string) => void;
  /**
   * Locked Receipt를 새 DRAFT version으로 fork (rule_4). 옵셔널 `revisionReason`
   * — Invoice 패턴 일관 (예: "금액 정정" / "수신자 정보 수정").
   */
  createReceiptVersion: (
    parentReceiptId: string,
    revisionReason?: string
  ) => string | null;
  /**
   * Print 액션 시점 기록 — `receipt.lastPrintedAt` 갱신 + timeline event emit.
   * 본 액션은 *audit memo* 수준 — 실제 인쇄는 `window.print()`를 호출자가 수행.
   */
  markReceiptPrinted: (receiptId: string) => void;
  /**
   * PDF export 시점 기록 — `receipt.lastPdfExportedAt` 갱신 + timeline event.
   * 실제 PDF 파일은 사용자 디바이스에 저장 (서버 0 byte) — browser native
   * print-to-PDF 흐름을 운영자가 수동 트리거.
   */
  markReceiptPdfExported: (receiptId: string) => void;
  /**
   * "고객 발송 준비" 액션 — `receipt.deliveryStatus = "prepared"` + 옵셔널
   * `recipientContact` 메모 + timeline event. **실제 외부 API 발송 0건** —
   * 운영자가 외부 도구로 직접 처리. STEP 87 spec: future-ready 슬롯만 채움.
   */
  prepareReceiptForSend: (
    receiptId: string,
    recipientContact?: string
  ) => void;

  // STEP 89 — Tax Invoice (전자세금계산서 운영 record, 사업자용)
  openTaxInvoiceDetail: (taxInvoiceId: string) => void;
  closeTaxInvoiceDetail: () => void;
  /**
   * 명시적 Tax Invoice 생성 — Receipt와 달리 *수동* 발행이 기본 (사업자만 대상).
   * Default 값은 linked Invoice의 amount 기반 — `vatBasis`에 따라 공급가액/VAT
   * 자동 계산 (한국 갤러리 기본 vat_inclusive). 반환값은 새 Tax Invoice id.
   */
  createTaxInvoice: (input: TaxInvoiceCreateInput) => string | null;
  /**
   * DRAFT Tax Invoice의 amount/vat/total/businessType/memo 편집 (DRAFT 한정).
   * ISSUED는 LOCK이라 본 액션 호출 시 no-op.
   */
  updateTaxInvoiceDraft: (
    taxInvoiceId: string,
    updates: {
      amount?: number;
      vatAmount?: number;
      totalAmount?: number;
      businessType?: TaxInvoice["businessType"];
      memo?: string;
    }
  ) => void;
  /**
   * DRAFT → ISSUED 전환 (= LOCK + finalizedAt 설정). Receipt 패턴 정확 일치.
   * ISSUED 후 직접 수정 금지 — `createTaxInvoiceVersion`으로만 재발행 (rule_4).
   */
  issueTaxInvoice: (taxInvoiceId: string) => void;
  /**
   * Locked Tax Invoice를 새 DRAFT version으로 fork (rule_4). 옵셔널
   * `revisionReason` — Invoice / Receipt 패턴 정확 일관.
   */
  createTaxInvoiceVersion: (
    parentTaxInvoiceId: string,
    revisionReason?: string
  ) => string | null;
  /** Print 시점 기록 — Receipt 패턴 답습. 실제 인쇄는 호출자가 window.print(). */
  markTaxInvoicePrinted: (taxInvoiceId: string) => void;
  /** PDF export 시점 기록 — browser native print-to-PDF flow. */
  markTaxInvoicePdfExported: (taxInvoiceId: string) => void;
  /**
   * "고객 발송 준비" — `deliveryStatus = "prepared"` + recipientContact 메모.
   * **실제 외부 API 발송 0건** — Receipt 패턴 정확 일치. 외부 회계 SaaS 연동은
   * 미래 STEP에서 결정.
   */
  prepareTaxInvoiceForSend: (
    taxInvoiceId: string,
    recipientContact?: string
  ) => void;

  // STEP 88 — Fiscal Summary (operational VAT/fiscal overview, derived layer)
  /**
   * Open the Fiscal Summary drawer. Pure UI action — no per-summary state
   * persistence. The drawer reads existing slices (invoices / receipts /
   * settlements / taxRecords / transactions) and computes the aggregate via
   * `buildFiscalSummaryAggregate` on render.
   */
  openFiscalSummary: () => void;
  /** Close the Fiscal Summary drawer. */
  closeFiscalSummary: () => void;

  // STEP 91 — Accountant Export (CSV handoff package, pure UI overlay)
  /** Open the Accountant Export drawer. CSV는 매 render 시점 helper로 재계산. */
  openAccountantExport: () => void;
  /** Close the Accountant Export drawer. */
  closeAccountantExport: () => void;

  // STEP 92 — Market Insight (operational intelligence)
  /**
   * Open the Market Insight drawer. Optional `artworkId` enables artwork-aware
   * entry (예: DetailPanel ZONE 5). 부재 시 gallery-wide signal 표시.
   */
  openMarketInsight: (artworkId?: string) => void;
  /** Close the Market Insight drawer. */
  closeMarketInsight: () => void;

  // Settlement (rule_3, rule_12 — internal distribution layer)
  openSettlementDetail: (settlementId: string) => void;
  closeSettlementDetail: () => void;
  /**
   * Manually create a Settlement for a Transaction. No-ops if one already
   * exists (rule_12: one settlement per transaction in v1) or if the
   * transaction has no received payments.
   * Returns the new settlement id, or null on no-op.
   */
  createSettlement: (transactionId: string) => string | null;
  /**
   * Mark a Settlement as COMPLETED — this is the canonical trigger for
   * Transaction.status PAID → SETTLED (rule_3 cascade) AND TaxRecord
   * auto-creation. Artwork state is NOT auto-changed — operator must move
   * PAID → CLOSED separately.
   */
  completeSettlement: (settlementId: string) => void;

  // Tax (rule_3 — accounting layer, separate from money flow)
  openTaxDetail: (taxRecordId: string) => void;
  closeTaxDetail: () => void;
  /**
   * Manual fallback for the rare case where Settlement.COMPLETED cascade did
   * not produce a TaxRecord (e.g. seeded historical data). Computes VAT from
   * the parent Settlement and creates a PENDING SALES_RECORD.
   * Returns the new taxRecord id, or null on no-op.
   */
  createTaxRecord: (settlementId: string) => string | null;
  /**
   * Mark a TaxRecord as ISSUED — final step in the accounting layer.
   * Sets issuedAt and emits a Living Timeline event. No further cascade.
   */
  issueTaxRecord: (taxRecordId: string) => void;

  // Contract (rule_4 — Document Trust, rule_5 — AI-Human loop)
  openContractDetail: (contractId: string) => void;
  closeContractDetail: () => void;
  /**
   * Create a new DRAFT Contract for a Transaction. Pre-fills content with an
   * AI-generated template (rule_5). v1: one contract per transaction at a time
   * (excluding versioning chain). Returns the new contract id, or null on no-op.
   */
  createContract: (transactionId: string) => string | null;
  /** Edit content on a DRAFT contract. No-ops on REVIEW / APPROVED / LOCKED. */
  updateContract: (contractId: string, content: string) => void;
  /** Submit DRAFT for staff review. DRAFT → REVIEW. */
  submitContractForReview: (contractId: string) => void;
  /** Approve a contract under review. REVIEW → APPROVED. */
  approveContract: (contractId: string) => void;
  /** Lock an approved contract — immutable. APPROVED → LOCKED. */
  lockContract: (contractId: string) => void;
  /**
   * Fork a LOCKED Contract into a new editable DRAFT (rule_4 versioning).
   * Returns the new contract id; also re-targets the open drawer to it.
   */
  createContractVersion: (parentContractId: string) => string | null;

  // Logistics (rule_21 — physical delivery)
  openLogisticsDetail: (logisticsId: string) => void;
  closeLogisticsDetail: () => void;
  /**
   * Create a new Logistics record (READY_FOR_PICKUP, empty fields). One
   * Logistics per transaction in v1 — silently no-ops if already exists.
   * Returns the new logistics id, or null on no-op.
   */
  createLogistics: (transactionId: string) => string | null;
  /**
   * Patch carrier / tracking / dates / memo on a Logistics record. Status is
   * NOT touched here — use updateLogisticsStatus for transitions. Silent
   * no-op if no field actually changed.
   */
  updateLogistics: (
    logisticsId: string,
    patch: Partial<
      Pick<
        Logistics,
        "carrierName" | "trackingNumber" | "pickupDate" | "deliveryDate" | "memo"
      >
    >
  ) => void;
  /**
   * Transition Logistics status — emits a dedicated "배송 상태 변경" timeline
   * event. No-ops if status unchanged. CONDITION_CHECKED is also auto-set by
   * createConditionReport when an AFTER_DELIVERY report is filed against a
   * DELIVERED logistics record.
   */
  updateLogisticsStatus: (
    logisticsId: string,
    newStatus: LogisticsStatus
  ) => void;

  /**
   * STEP 50 — Logistics provider sync (rule_21).
   *
   * Mock LogisticsProvider 호출 → 결과를 record의 옵셔널 provider 필드로 patch +
   * 정책상 forward-only non-locking transition (READY_FOR_PICKUP → IN_TRANSIT)
   * 만 자동 적용. 실제 외부 네트워크 호출 0건 (deterministic mock).
   *
   * 정책:
   *   - DELIVERED / CONDITION_CHECKED record: silent no-op (immutable rule_4)
   *   - provider 실패 (null 반환): silent fallback, timeline 오염 0
   *   - trackingNumber / carrierName: 비어있을 때만 채움 (operator 입력 보존)
   *   - DELIVERED / CONDITION_CHECKED 자동 전환 0건 (operator 명시 필요)
   */
  syncLogisticsFromProvider: (logisticsId: string) => void;

  /**
   * STEP 58 — Bulk provider sync. 여러 logistics record를 순차로 sync.
   * 각 record는 기존 syncLogisticsFromProvider 흐름 그대로 — 본 액션은
   * orchestrator. 한 record 실패해도 다음 진행 (failure 격리).
   *
   * 반환: 결과 카운트 — UI에 toast / inline 표시.
   *   - ok: provider call 성공 + record 갱신
   *   - skipped: locked status (DELIVERED / CONDITION_CHECKED) — 무시
   *   - failed: provider null 반환 / record not found
   */
  bulkSyncLogisticsFromProvider: (logisticsIds: string[]) => {
    ok: number;
    skipped: number;
    failed: number;
  };

  // Condition Reports (rule_4 — trust documents tied to logistics)
  openConditionReportCreate: (
    logisticsId: string,
    reportType: ReportType
  ) => void;
  openConditionReportEdit: (reportId: string) => void;
  closeConditionReport: () => void;
  /**
   * Create a new condition report. Idempotent on (logisticsId, reportType) —
   * v1 allows at most one BEFORE_SHIPMENT and one AFTER_DELIVERY per logistics.
   * If reportType=AFTER_DELIVERY and parent logistics is DELIVERED, the
   * logistics is auto-cascaded to CONDITION_CHECKED (rule_21).
   * Returns the new report id, or null on no-op.
   */
  createConditionReport: (input: {
    logisticsId: string;
    reportType: ReportType;
    conditionStatus: ConditionStatus;
    notes: string;
    imagePlaceholder?: string;
  }) => string | null;
  /**
   * @deprecated STEP 15 — ConditionReport is immutable after creation
   * (rule_4 Document Trust). This action is now a silent no-op for all
   * existing report ids; it remains in the interface only to avoid breaking
   * callers. Use `createConditionReportCorrection` to issue a revised report.
   */
  updateConditionReport: (
    reportId: string,
    patch: Partial<
      Pick<ConditionReport, "conditionStatus" | "notes" | "imagePlaceholder">
    >
  ) => void;
  /**
   * STEP 15 — Issue a correction for an existing ConditionReport.
   *
   * The original is preserved unchanged. A new ConditionReport is created
   * with the same `logisticsId` / `reportType` and `correctsReportId` pointing
   * at the original. Subsequent corrections form a chain via `correctsReportId`.
   *
   * Returns the new report id, or null if the original is not found or the
   * parent logistics is locked at a state that prohibits new audit records.
   * (Currently no logistics state blocks correction creation — corrections
   * remain valid even after CONDITION_CHECKED, since a discrepancy may be
   * discovered later.)
   */
  createConditionReportCorrection: (
    originalReportId: string,
    input: {
      conditionStatus: ConditionStatus;
      notes: string;
      imagePlaceholder?: string;
    }
  ) => string | null;

  // --- Curation (rule_18 (a), rule_4 + rule_5 — STEP 16) -------------------
  openCurationDraft: (artworkId: string) => void;
  closeCurationDraft: () => void;
  /**
   * Create a new DRAFT CurationNote v1. Pre-fills with AI-generated content
   * (deterministic template, rule_5).
   *
   * Idempotent: if any non-LOCKED CurationNote already exists for the artwork,
   * refuses (returns the existing DRAFT/APPROVED id instead). To fork from a
   * LOCKED predecessor, use createCurationVersion() — guarantees no parallel
   * editing chains (rule_4).
   *
   * Returns the new (or existing latest non-LOCKED) curation id, or null on
   * permission failure / artwork not found.
   */
  createCurationNote: (artworkId: string) => string | null;
  /**
   * Patch headline / subheadline / body on a DRAFT CurationNote. Silent no-op
   * if status is not DRAFT (rule_4 immutability post-approval).
   */
  updateCurationNote: (curationId: string, patch: CurationNoteUpdate) => void;
  /**
   * Re-generate the AI draft content of an existing DRAFT CurationNote.
   * Overwrites the existing DRAFT body — emits a new "AI 초안 재생성" timeline
   * event (actor: "AXVELA AI"). Silent no-op if not DRAFT.
   */
  regenerateCurationDraft: (curationId: string) => void;
  /** DRAFT → APPROVED. Editing locked. RBAC: curation.approve (MANAGER). */
  approveCurationNote: (curationId: string) => void;
  /** APPROVED → LOCKED. Permanent. RBAC: curation.lock (MANAGER). */
  lockCurationNote: (curationId: string) => void;
  /**
   * Fork a new DRAFT v(n+1) from a LOCKED CurationNote. The previous LOCKED
   * version remains intact (rule_4 — past is preserved). Re-runs the AI
   * generator to seed new content; human can then edit.
   * Returns the new curation id, or null if parent isn't LOCKED.
   */
  createCurationVersion: (parentCurationId: string) => string | null;

  // --- Inquiry Response (rule_18 (d) — STEP 16) ----------------------------
  openInquiryResponse: (inquiryId: string) => void;
  closeInquiryResponse: () => void;
  /**
   * Generate (or re-generate) an AI draft response on the inquiry. Updates
   * responseDraft + responseStatus="DRAFT" + responseGeneratedAt. Silent
   * no-op if inquiry already SENT (rule_4 immutability) or permission missing.
   * Emits a single "AI 응대 초안 생성" timeline event with actor: "AXVELA AI".
   */
  generateInquiryResponse: (inquiryId: string) => void;
  /**
   * Send the response. Marks responseStatus="SENT" + respondedAt=now and
   * cascades Inquiry.status: OPEN → RESPONDED if currently OPEN. Locks the
   * responseDraft as a permanent record. Silent no-op if no DRAFT exists or
   * already SENT.
   */
  sendInquiryResponse: (inquiryId: string, finalText: string) => void;

  // --- AI Price Suggestion (rule_18 (c), STEP 18) --------------------------
  /**
   * Generate a deterministic price suggestion for the artwork.
   *   - Tier 1 (paid + payment): confidence 0.82
   *   - Tier 2 (가격만): confidence 0.62
   *   - Tier 3 (둘 다 없음): confidence 0.35 with gallery median fallback
   *
   * **artwork.priceKRW를 변경하지 않는다.** Suggestion record만 추가.
   * Emits "AXVELA AI 가격 제안 생성" timeline event. Silent no-op on missing
   * permission. Returns the new suggestion id (or null on no-op).
   */
  generatePriceSuggestionForArtwork: (artworkId: string) => string | null;
  /**
   * Mark a suggestion as applied. **Form-side helper** — emits "AI 가격 제안
   * 적용" timeline event and stamps `appliedAt`, but does NOT modify
   * artwork.priceKRW directly. The form drawer reads the suggestion's
   * suggestedMid and updates its local input state; subsequent normal save
   * flow (updateArtwork) commits the actual price change.
   */
  applyPriceSuggestion: (artworkId: string, suggestionId: string) => void;

  // --- Audit Log overlay (rule_7 + rule_8 follow-through, STEP 20) ---------
  openAuditLog: (artworkId: string) => void;
  closeAuditLog: () => void;

  /** STEP 23 — Cross-artwork Audit (rule_4 trust layer). MANAGER 이상만 동작. */
  openGlobalAudit: () => void;
  closeGlobalAudit: () => void;
  /** STEP 35 — Multi-currency Reporting open/close. RBAC: MANAGER 이상. */
  openReporting: () => void;
  closeReporting: () => void;

  // STEP 51 — Documents Hub. RBAC 가드 (rule_7 — Manager 이상, Reporting과 일관).
  // 검색만 — 4개 문서 도메인 (Invoice / Contract / TaxRecord / ConditionReport)
  // 통합 read-only view. 항목 클릭 시 기존 detail drawer 재사용.
  openDocuments: () => void;
  closeDocuments: () => void;

  // STEP 54 — Logistics Operations View. RBAC 가드 (Manager+, Reporting / Documents
  // 일관). 갤러리 전체 logistics + KPI / 필터 / 검색 view — read-only utility.
  // row 클릭 시 작품 select + 기존 LogisticsDetailDrawer 재사용.
  openLogisticsOperations: () => void;
  closeLogisticsOperations: () => void;

  // STEP 62 — Image Cleanup Admin Tool. OWNER 전용 (`image.cleanup_review`).
  // 외부 저장소 inspection + orphan candidate review + remove request. read-only
  // by default. destructive bulk delete UX 부재 (사용자 spec 명시).
  openImageCleanup: () => void;
  closeImageCleanup: () => void;

  // STEP 65 — System Audit Log Layer. SystemAuditEvent[] 슬라이스 + 4 actions.
  // **artwork-linked TimelineEvent와 별개** — system / admin 운영 기록.
  // hydrate은 PersistenceProvider mount 시 1회 (backup-metadata와 동일).

  /**
   * 신규 audit event 추가. `id` / `createdAt` / `actorRole` / `actorLabel`은
   * store가 자동 채움. localStorage에도 즉시 저장 (cap 적용 후).
   *
   * **권한 가드 부재** — 본 action은 store 내부에서 호출되거나 admin UI에서
   * 호출되므로 자체 RBAC 가드 없음. 호출하는 도메인 액션이 이미 RBAC 통과한 후
   * 부수효과로 audit 기록.
   */
  appendAuditEvent: (input: SystemAuditEventInput) => void;

  /**
   * Audit log 전체 비움. OWNER 권한 필수 (`audit.view` permission). store +
   * localStorage 모두 비움. 실행 직후 "audit.clear" 자체 audit event 추가
   * (clear가 일어났음을 기록 — 자기참조 단일 entry로 시작 상태).
   */
  clearAuditEvents: () => void;

  /**
   * 카테고리별 필터된 audit list 반환. read-only selector helper — 결과는
   * 호출 시점 snapshot, store change 시 자동 재계산 안 됨 (UI는 useMemo 사용
   * 권장). 결정성 보장 — 같은 입력 → 같은 출력 순서 (최신 → 오래된 순).
   */
  getAuditEventsByCategory: (
    category: AuditCategory | "all"
  ) => SystemAuditEvent[];

  /**
   * 최근 `limit`개 audit event 반환 (전체 기간). limit이 0 또는 음수면 빈 배열.
   * UI는 보통 `auditEvents` selector + `useMemo`로 직접 slice 권장.
   */
  getRecentAuditEvents: (limit: number) => SystemAuditEvent[];

  /** STEP 65 — System audit log viewer drawer open/close. OWNER 전용 RBAC 가드. */
  openSystemAuditLog: () => void;
  closeSystemAuditLog: () => void;

  /**
   * STEP 67 — Operational Drilldown open/close. payload는 어떤 domain + 어떤
   * filter context인지 declarative 표현. drawer가 resolver로 rows 계산.
   * RBAC 가드 부재 — drilldown은 read-only 확장이며 진입 시점 (KPI 카드 등)이
   * 이미 권한 게이트 적용 위치.
   */
  openDrilldown: (payload: DrilldownPayload) => void;
  closeDrilldown: () => void;

  /**
   * STEP 65 — Audit log hydrate. localStorage `axvela.audit.v1`에서 1회 load →
   * store sync. PersistenceProvider mount effect가 호출.
   */
  hydrateAuditEvents: () => void;

  // STEP 59 — Backup Reminder. PersistenceProvider mount 시 hydrate, BackupSection
  // 다운로드 성공 시 mark. 별도 localStorage 키 (`axvela.backup.metadata.v1`)에
  // 영속화 — PersistedState 무영향.
  hydrateBackupMetadata: () => void;
  markBackupCompleted: () => void;
  /** STEP 41 — Collector View open/close + select. RBAC: MANAGER 이상. */
  openCollectorView: () => void;
  closeCollectorView: () => void;
  selectCollector: (collectorId: string | null) => void;

  // STEP 45 — AI Market Analysis (rule_18 (b)). 단일 작품 분석 view 진입점.
  // RBAC 가드 없음 — 작품 detail 접근 가능하면 분석 view도 가능.
  openMarketAnalysis: (artworkId: string) => void;
  closeMarketAnalysis: () => void;

  // --- STEP 27 — Persistence Layer ----------------------------------------
  /**
   * 영속 저장된 도메인 데이터로 store hydrate. 클라이언트 mount 시 1회 호출.
   * 저장된 데이터 없거나 invalid면 silent no-op (mock data 그대로 유지).
   */
  hydrateFromStorage: () => void;

  /**
   * 모든 도메인 데이터 + UI 슬라이스를 초기 mock 상태로 재로드 + storage clear.
   * 개발 / 데모 / 사용자 명시 reset 액션.
   */
  resetAllData: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function genAxid(year: number, seq: number) {
  return {
    code: `AXV-${year}-${String(seq).padStart(4, "0")}`,
    issuedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * STEP 15 — Logistics immutability check.
 *
 * Once a Logistics record reaches DELIVERED or CONDITION_CHECKED, its data
 * (carrier, tracking, dates, memo) becomes an audit record and is no longer
 * mutable. Both store guards and UI read-only banners use this single
 * predicate. Returns false for unknown statuses (defensive).
 */
function isLogisticsLocked(status: LogisticsStatus): boolean {
  return status === "DELIVERED" || status === "CONDITION_CHECKED";
}

// ----------------------------------------------------------------------------
// Store impl
// ----------------------------------------------------------------------------

export const useArtworkStore = create<ArtworkUIState>((set, get) => ({
  artworks: MOCK_ARTWORKS,
  timeline: MOCK_TIMELINE,
  inquiries: MOCK_INQUIRIES,
  transactions: MOCK_TRANSACTIONS,
  invoices: MOCK_INVOICES,
  payments: MOCK_PAYMENTS,
  // STEP 87 — Receipts seed empty. Auto-created when registerPayment runs;
  // existing seeded payments do not auto-backfill receipts (history은 그대로
  // 보존, *forward-only* policy). 운영자는 필요 시 createReceipt manual fallback
  // 사용 가능.
  receipts: {},
  // STEP 89 — Tax Invoices seed empty. *수동 발행* 기본 (사업자만 대상),
  // Payment cascade 자동 생성 0건. 운영자가 TransactionSummary CTA 또는
  // future Documents Hub에서 명시적 createTaxInvoice 호출.
  taxInvoices: {},
  settlements: MOCK_SETTLEMENTS,
  taxRecords: MOCK_TAX_RECORDS,
  contracts: MOCK_CONTRACTS,
  curationNotes: MOCK_CURATION_NOTES,
  // STEP 18 — 갤러리 v1 시드는 비어 있음. 사용자가 작품 편집 시 AI 버튼으로 생성.
  priceSuggestions: {},
  logistics: MOCK_LOGISTICS,
  conditionReports: MOCK_CONDITION_REPORTS,
  // STEP 117 — Artwork registration draft 시드. 단일 record 정책 v1, 진행 중
  // 임시 저장 부재 시 undefined (Sidebar entry 자연 비표시). hydrateFromStorage
  // 가 persisted draft 발견 시 덮어쓸 수 있음.
  artworkDraft: undefined,

  selectedArtworkId: "art_002",
  query: "",
  stateFilter: "ALL",
  editor: { kind: "closed" },
  transitionRequest: { kind: "closed" },
  inquiryDetailRequest: { kind: "closed" },
  inquiryCreateRequest: { kind: "closed" },
  transactionDetailRequest: { kind: "closed" },
  invoiceDetailRequest: { kind: "closed" },
  receiptDetailRequest: { kind: "closed" },
  taxInvoiceDetailRequest: { kind: "closed" },
  fiscalSummaryRequest: { kind: "closed" },
  accountantExportRequest: { kind: "closed" },
  marketInsightRequest: { kind: "closed" },
  paymentRegisterRequest: { kind: "closed" },
  settlementDetailRequest: { kind: "closed" },
  taxDetailRequest: { kind: "closed" },
  contractDetailRequest: { kind: "closed" },
  logisticsDetailRequest: { kind: "closed" },
  conditionReportRequest: { kind: "closed" },
  curationDraftRequest: { kind: "closed" },
  inquiryResponseRequest: { kind: "closed" },
  auditLogRequest: { kind: "closed" },
  globalAuditRequest: { kind: "closed" },
  reportingRequest: { kind: "closed" },
  documentsRequest: { kind: "closed" },
  logisticsOperationsRequest: { kind: "closed" },
  imageCleanupRequest: { kind: "closed" },
  // STEP 65 — System audit log slice. PersistenceProvider mount 시
  // hydrateAuditEvents() 호출 → 실제 값 주입. SSR-safe.
  auditEvents: [],
  systemAuditLogRequest: { kind: "closed" },
  // STEP 67 — Drilldown 초기 닫힘. payload는 open 시 set.
  drilldownRequest: { kind: "closed" },
  // STEP 59 — 초기엔 null. PersistenceProvider mount effect가 localStorage에서
  // hydrateBackupMetadata() 호출 → 실제 값 주입. SSR-safe (window guard 내부).
  backupMetadata: { lastBackupAt: null },
  collectorViewRequest: { kind: "closed" },
  marketAnalysisRequest: { kind: "closed" },

  // --- Session / RBAC (rule_7) ---------------------------------------------
  // Default to MANAGER — the most common operator profile. Owner/Staff are
  // selectable via sidebar role switcher to demonstrate gating behavior.
  currentRole: "MANAGER",

  // --- STEP 130 Phase 2 Commit 2 — Display Locale 초기값 ----------------------
  // DEFAULT_DOCUMENT_LOCALE = "ko" 재활용 (§8 발견 — STEP 96 정착물 `document-
  // locale.ts:82`). 옵션 P1 (Persistence 0) 채택 — PersistedState 미추가로
  // 자연 미 persist, 브라우저 재시작 시 항상 "ko" 로 초기화. 사용자 spec §9
  // 항목 2 정확 정합.
  currentLocale: DEFAULT_DOCUMENT_LOCALE,

  // --- STEP 131 Phase 2 Commit 2 — ArtworkGrid Display Mode 초기값 ----------
  // 사용자 §8 항목 6 결정 정합 — default = "grid" (기존 ArtworkCard 정착물
  // 우선, 운영자 baseline). P1 (Persistence 0) 채택 — currentLocale 패턴 답습,
  // PersistedState 미추가, 브라우저 재시작 시 "grid" 자동 초기화.
  viewMode: "grid",
  // STEP 82 — Permission Change Audit. role 전환 자체를 system audit log에
  // 영속화. RoleSwitcher markup은 0줄 변경 (audit는 store 내부에서 처리).
  //
  // **순서 정책**: appendAuditEvent를 set 직전에 호출 → audit event의
  // actorRole은 "변경을 초래한" 이전 role로 기록됨 (RBAC convention 일관:
  // "X (with permission Y) performed action Z"). set 이후 호출 시 actorRole이
  // 새 role이 되어 의미 혼동 — 의도적으로 회피.
  //
  // **Idempotent**: 같은 role 재선택은 noise이므로 audit 0건 (사용자가 같은
  // 메뉴 항목 다시 클릭하는 케이스 graceful).
  setCurrentRole: (role) => {
    const fromRole = get().currentRole;
    if (fromRole === role) {
      // 같은 role 재선택 — set만 (no-op이지만 reference equality 영향 없도록)
      set({ currentRole: role });
      return;
    }
    const previousLevel = ROLE_RANK[fromRole];
    const nextLevel = ROLE_RANK[role];
    // STEP 82 audit — append BEFORE set (actor = 이전 role, target = 새 role).
    let action: "role_promote" | "role_demote" | "role_switch";
    if (nextLevel > previousLevel) action = "role_promote";
    else if (nextLevel < previousLevel) action = "role_demote";
    else action = "role_switch"; // 동일 level — 향후 4번째 role 추가 시 활성
    get().appendAuditEvent({
      category: "permission",
      action,
      severity: "info",
      targetType: "role",
      targetRef: role,
      message: `권한 변경 — ${ROLE_LABEL_KR[fromRole]} → ${ROLE_LABEL_KR[role]}`,
      metadata: {
        fromRole,
        toRole: role,
        previousLevel,
        nextLevel,
        deviceLocal: true,
        changedAt: new Date().toISOString(),
      },
    });
    set({ currentRole: role });
  },
  can: (permission) => hasPermission(get().currentRole, permission),

  // --- STEP 130 Phase 2 Commit 2 — Display Locale setter ---------------------
  // 단순 setter — set({ currentLocale: locale }). audit log emit 0건 (display
  // 선호도 영역, `setCurrentRole` 의 STEP 82 권한 변경 audit 정착물과 의도적
  // 분리). rule_5 AI-Human Loop 정합 — 사용자 명시 클릭 (Sidebar locale toggle,
  // Commit 3 영역) 으로만 호출 진입. AI 자동 호출 절대 금지.
  setLocale: (locale) => set({ currentLocale: locale }),

  // --- STEP 131 Phase 2 Commit 2 — ArtworkGrid Display Mode setter ----------
  // 단순 setter — set({ viewMode: mode }). audit log emit 0건. rule_5 — 사용자
  // 명시 클릭 (Grid header ViewModeToggle, 본 commit wire) 으로만 호출. AI
  // 자동 토글 절대 금지. setLocale 패턴 정확 답습.
  setViewMode: (mode) => set({ viewMode: mode }),

  // --- Selection / filter ---------------------------------------------------
  select: (id) => set({ selectedArtworkId: id }),
  setQuery: (q) => set({ query: q }),
  setStateFilter: (s) => set({ stateFilter: s }),

  // --- Editor ---------------------------------------------------------------
  openCreate: () => set({ editor: { kind: "create" } }),
  openEdit: (id) => set({ editor: { kind: "edit", id } }),
  closeEditor: () => set({ editor: { kind: "closed" } }),

  // --- Artwork CRUD ---------------------------------------------------------
  createArtwork: (input) => {
    const id = genId("art");
    const seq = get().artworks.length + 1;
    const newArtwork: Artwork = {
      id,
      axid: genAxid(input.year, seq),
      title: input.title,
      artist: {
        id: genId("ar"),
        name: input.artistName,
        nameEn: input.artistNameEn,
      },
      year: input.year,
      medium: input.medium,
      dimensions: input.dimensions,
      priceKRW: input.priceKRW,
      state: input.state,
      thumbnailColor: input.thumbnailColor,
      imageUrl: input.imageUrl,
      imageStorageKey: input.imageStorageKey,
      imageProvider: input.imageProvider,
      imageMimeType: input.imageMimeType,
      imageSize: input.imageSize,
      imageUploadedAt: input.imageUploadedAt,
      // STEP 119 합류 — 5 curation fields pass-through. 모두 optional →
      // 부재 시 undefined fallback (backward compat 100%).
      description: input.description,
      curationDraft: input.curationDraft,
      exhibitionText: input.exhibitionText,
      artistNote: input.artistNote,
      provenanceNote: input.provenanceNote,
      inquiryCount: 0,
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      artworks: [newArtwork, ...s.artworks],
      selectedArtworkId: id,
      stateFilter: "ALL",
      query: "",
      // STEP 117 — Submit 성공 시 draft auto-clear. Phase 4 §4.4 정착 —
      // 작품이 정식 record 로 promote 되었으므로 임시 저장은 의미 0.
      // 기존 draft 부재 시에도 undefined → undefined 무영향.
      artworkDraft: undefined,
    }));
    return id;
  },

  // --- STEP 117 — Artwork registration draft (Phase 4 §4.4 Draft-safe) -----
  saveArtworkDraft: (input) => {
    const now = new Date().toISOString();
    set((s) => ({
      artworkDraft: {
        data: input,
        // 기존 draft 의 startedAt 보존 (첫 시작 시점 유지). 부재 시 현재 시점.
        startedAt: s.artworkDraft?.startedAt ?? now,
        lastEditedAt: now,
      },
    }));
  },

  clearArtworkDraft: () => {
    set({ artworkDraft: undefined });
  },

  updateArtwork: (id, input) => {
    const now = new Date().toISOString();
    set((s) => ({
      artworks: s.artworks.map((a) =>
        a.id === id
          ? {
              ...a,
              title: input.title,
              year: input.year,
              medium: input.medium,
              dimensions: input.dimensions,
              priceKRW: input.priceKRW,
              state: input.state,
              thumbnailColor: input.thumbnailColor,
              imageUrl: input.imageUrl,
              imageStorageKey: input.imageStorageKey,
              imageProvider: input.imageProvider,
              imageMimeType: input.imageMimeType,
              imageSize: input.imageSize,
              imageUploadedAt: input.imageUploadedAt,
              // STEP 119 합류 — 5 curation fields pass-through.
              description: input.description,
              curationDraft: input.curationDraft,
              exhibitionText: input.exhibitionText,
              artistNote: input.artistNote,
              provenanceNote: input.provenanceNote,
              artist: {
                ...a.artist,
                name: input.artistName,
                nameEn: input.artistNameEn,
              },
              updatedAt: now,
            }
          : a
      ),
    }));
  },

  // STEP 61 — 작품 이미지 외부 storage 측 제거 + record 갱신.
  // 외부 host 호출은 best-effort (failure silent), record 갱신은 항상 수행.
  deleteArtworkImage: async (id) => {
    const state = get();
    const artwork = state.artworks.find((a) => a.id === id);
    if (!artwork) return;
    if (!artwork.imageUrl) return; // 이미 이미지 없음

    // 1. 외부 storage 측 제거 시도 (vercel_blob 등). LocalPreview는 dispatcher가
    //    silent skip. failure는 catch — record 갱신은 그대로 진행 (외부 host에
    //    잔존해도 사용자 흐름은 유지, orphan cleanup helper로 향후 일괄 처리).
    if (artwork.imageProvider && artwork.imageStorageKey) {
      try {
        await deleteImageByProvider(
          artwork.imageProvider,
          artwork.imageStorageKey
        );
      } catch (err) {
        // silent — 운영 안정성 우선
        // eslint-disable-next-line no-console
        console.warn(
          "[axvela-image-delete] external storage 제거 요청 실패 (record는 갱신):",
          err instanceof Error ? err.message : err
        );
      }
    }

    // 2. record 5 image 필드 + imageUrl undefined로 set + updatedAt 갱신
    const now = new Date().toISOString();
    const wasExternal = artwork.imageProvider === "vercel_blob";

    set((s) => ({
      artworks: s.artworks.map((a) =>
        a.id === id
          ? {
              ...a,
              imageUrl: undefined,
              imageStorageKey: undefined,
              imageProvider: undefined,
              imageMimeType: undefined,
              imageSize: undefined,
              imageUploadedAt: undefined,
              updatedAt: now,
            }
          : a
      ),
    }));

    // 3. timeline event — audit trail (rule_4 / rule_8). NOTE kind 사용
    //    (artwork-level free-form note — entity ref 없는 audit 카드).
    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: id,
      kind: "NOTE",
      title: "이미지 제거",
      detail: wasExternal
        ? "외부 저장소에서 제거 요청 완료 · record 갱신"
        : "fallback image record 제거",
      at: now,
      actor: actorLabel(state.currentRole),
    };
    set((s) => ({
      timeline: {
        ...s.timeline,
        [id]: [event, ...(s.timeline[id] ?? [])],
      },
    }));

    // 4. STEP 65 — System audit log (artwork-linked entry로 기록). artwork
    //    timeline은 작품 lifecycle, system audit log는 운영 활동 — 두 layer
    //    모두 기록. drawer에서 artwork와 함께 lookup 가능 (targetType/Ref).
    get().appendAuditEvent({
      category: "image_storage",
      action: wasExternal
        ? "image_storage.artwork_image.removed"
        : "image_storage.fallback_image.removed",
      severity: "info",
      targetType: "artwork",
      targetRef: id,
      message: wasExternal
        ? "작품 이미지 외부 저장소 제거 요청 + record 갱신"
        : "작품 fallback image record 제거",
      metadata: artwork.imageStorageKey
        ? {
            artworkId: id,
            artworkTitle: artwork.title,
            pathname: artwork.imageStorageKey,
            provider: artwork.imageProvider,
          }
        : { artworkId: id, artworkTitle: artwork.title },
    });
  },
  openTransition: (artworkId) => {
    const artwork = get().artworks.find((a) => a.id === artworkId);
    if (!artwork) return;
    const transition = getTransition(artwork.state);
    if (!transition) return;
    set({
      transitionRequest: { kind: "open", artworkId, transition },
    });
  },

  closeTransition: () => set({ transitionRequest: { kind: "closed" } }),

  transitionState: (artworkId, to) => {
    const state = get();
    const artwork = state.artworks.find((a) => a.id === artworkId);
    if (!artwork) return;

    const transition = getTransition(artwork.state);
    if (!transition || transition.to !== to) return;

    // RBAC guard (rule_7) — PAID → CLOSED is Owner-only (거래 종결 권한).
    // Other transitions are not RBAC-gated; they're guarded by the state
    // machine itself + downstream business checks.
    if (artwork.state === "PAID" && to === "CLOSED") {
      if (!hasPermission(state.currentRole, "artwork.transition.close")) return;
    }

    // Historical-safety note (STEP 14, rule_4):
    //
    // No explicit historical-tx guard is needed here because every cascade
    // branch below either creates a *new* transaction (INQUIRY→DEAL,
    // CLOSED→BROKERED) or doesn't touch the transactions slice at all
    // (READY→INQUIRY, DEAL→PAID, etc.). Existing tx are never mutated by
    // a state transition — only prepended onto. Verified: 2026-05-04.

    const from = artwork.state;
    const now = new Date().toISOString();
    const isReadyToInquiry = from === "READY" && to === "INQUIRY";
    const isInquiryToDeal = from === "INQUIRY" && to === "DEAL";
    const isClosedToBrokered = from === "CLOSED" && to === "BROKERED";

    // 1. Update artwork. inquiryCount bumps on READY→INQUIRY (real inquiry)
    //    and on CLOSED→BROKERED (auto Resale inquiry — rule_13).
    const newArtworks = state.artworks.map((a) => {
      if (a.id !== artworkId) return a;
      return {
        ...a,
        state: to,
        updatedAt: now,
        inquiryCount:
          isReadyToInquiry || isClosedToBrokered
            ? a.inquiryCount + 1
            : a.inquiryCount,
      };
    });

    // 2. STATE_CHANGE event — title is the standard "FROM → TO" except for
    //    CLOSED → BROKERED which gets "Resale 시작" so the timeline reads
    //    as the resale-loop entry point (rule_13).
    const stateEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "STATE_CHANGE",
      title: isClosedToBrokered ? "Resale 시작" : `${from} → ${to}`,
      detail: isClosedToBrokered
        ? "거래 종료 → 재판매 풀 · 이전 소유자 → 신규 판매 흐름 시작"
        : `${STATE_LABEL_KR[from]} → ${STATE_LABEL_KR[to]} · ${transition.primaryLabel}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
    };

    let newInquiries = state.inquiries;
    let newTransactions = state.transactions;
    let newInvoices = state.invoices;
    let newTimelineList: TimelineEvent[] = [
      stateEvent,
      ...(state.timeline[artworkId] ?? []),
    ];

    // 3a. READY → INQUIRY: auto-create empty Inquiry
    if (isReadyToInquiry) {
      const newInquiry: Inquiry = {
        id: genId("inq"),
        artworkId,
        collectorName: "",
        contact: "",
        inquiryType: "GENERAL",
        message: "",
        source: "OTHER",
        status: "OPEN",
        memo: "",
        createdAt: now,
        updatedAt: now,
      };
      newInquiries = {
        ...state.inquiries,
        [artworkId]: [newInquiry, ...(state.inquiries[artworkId] ?? [])],
      };

      const inquiryEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "INQUIRY",
        title: "Inquiry 자동 생성",
        detail:
          "READY → INQUIRY 전환과 함께 생성. 컬렉터 정보 입력 필요.",
        at: now,
        actor: "System",
        relatedEntityType: "inquiry",
        relatedEntityId: newInquiry.id,
      };
      newTimelineList = [
        inquiryEvent,
        stateEvent,
        ...(state.timeline[artworkId] ?? []),
      ];
    }

    // 3b. INQUIRY → DEAL: auto-create Transaction + DRAFT Invoice (rule_11)
    if (isInquiryToDeal) {
      const latestInquiry: Inquiry | undefined =
        state.inquiries[artworkId]?.[0];

      const newTransaction: Transaction = {
        id: genId("tx"),
        artworkId,
        inquiryId: latestInquiry?.id ?? "",
        buyerName: latestInquiry?.collectorName ?? "",
        agreedPrice: artwork.priceKRW,
        currency: "KRW",
        status: "NEGOTIATING",
        dealMemo: "",
        createdAt: now,
        updatedAt: now,
      };
      newTransactions = {
        ...state.transactions,
        [artworkId]: [
          newTransaction,
          ...(state.transactions[artworkId] ?? []),
        ],
      };

      // Wire reverse pointer on the source Inquiry (rule_13.5 sync layer).
      // Future buyer-edits in either drawer will resolve the partner record
      // via this id without scanning the whole transactions slice.
      if (latestInquiry) {
        newInquiries = {
          ...state.inquiries,
          [artworkId]: state.inquiries[artworkId].map((i) =>
            i.id === latestInquiry.id
              ? { ...i, transactionId: newTransaction.id, updatedAt: now }
              : i
          ),
        };
      }

      // Invoice DRAFT — money snapshotted from Transaction (rule_20 FX lock)
      const newInvoice: Invoice = {
        id: genId("inv"),
        transactionId: newTransaction.id,
        amount: newTransaction.agreedPrice,
        currency: newTransaction.currency,
        status: "DRAFT",
        issuedAt: now,
        version: 1,
        parentInvoiceId: null,
        lockedAt: null,
        isLocked: false,
      };
      newInvoices = {
        ...state.invoices,
        [newTransaction.id]: [newInvoice],
      };

      const buyerLabel = latestInquiry?.collectorName?.trim()
        ? latestInquiry.collectorName
        : "구매자 미지정";
      const txEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "TRANSACTION",
        title: "Transaction 자동 생성",
        detail: `${buyerLabel} · ${formatMoney(
          artwork.priceKRW,
          "KRW"
        )} · 협상 중`,
        at: now,
        actor: "System",
        relatedEntityType: "transaction",
        relatedEntityId: newTransaction.id,
      };
      const invoiceEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "DOCUMENT",
        title: "Invoice 자동 생성",
        detail: `${formatMoney(newInvoice.amount, newInvoice.currency)} · ${
          INVOICE_STATUS_LABEL[newInvoice.status]
        }`,
        at: now,
        actor: "System",
        relatedEntityType: "invoice",
        relatedEntityId: newInvoice.id,
      };
      newTimelineList = [
        invoiceEvent,
        txEvent,
        stateEvent,
        ...(state.timeline[artworkId] ?? []),
      ];
    }

    // 3c. CLOSED → BROKERED: open the resale loop (rule_13).
    //
    // Existing transactions remain UNTOUCHED — resale is implemented as a
    // NEW Transaction. The previous Transaction's COMPLETED status, Invoice
    // history, Settlement, Tax records, and Logistics records all stay
    // intact and continue to render in their respective drawers as
    // historical truth (immutability — rule_4 trust layer).
    //
    // Three timeline events emitted in this order (oldest→newest in array,
    // newest at index 0 after prepend):
    //   1. STATE_CHANGE: "Resale 시작" (the stateEvent, already prepared above)
    //   2. TRANSACTION:  "New Transaction 생성"
    //   3. INQUIRY:      "Ownership 전환 준비"
    if (isClosedToBrokered) {
      // Find the most recent prior transaction to inherit previousOwner from.
      const priorList = state.transactions[artworkId] ?? [];
      const priorTx = priorList[0];
      const previousOwner =
        priorTx?.buyerName?.trim() || "이전 소유자 미상";
      const previousTransactionId = priorTx?.id;

      const resaleTx: Transaction = {
        id: genId("tx"),
        artworkId,
        // Resale starts with no inquiry yet — buyer not identified.
        inquiryId: "",
        buyerName: "",
        // Re-list at the artwork's listed price; will be re-negotiated.
        agreedPrice: artwork.priceKRW,
        currency: priorTx?.currency ?? "KRW",
        status: "NEGOTIATING",
        dealMemo: `재판매 거래 — 이전 소유자: ${previousOwner}`,
        createdAt: now,
        updatedAt: now,
        // Resale-specific fields (rule_13)
        isResale: true,
        previousTransactionId,
        previousOwner,
        resaleCommissionRate: 0.15, // v1: 15% hardcoded
      };
      newTransactions = {
        ...state.transactions,
        // Newest first — resale tx becomes the "latest" while priors retained.
        [artworkId]: [resaleTx, ...priorList],
      };

      // Auto-create a Resale Inquiry (rule_13). Empty collector — the
      // inquiry exists as the marker that this artwork is now actively
      // listed for resale; collector identity gets filled when an actual
      // buyer expresses interest. Bind the inquiry to the new resale tx
      // so the existing TransactionSummary "Inquiry로부터 인계" affordance
      // resolves correctly.
      const resaleInquiry: Inquiry = {
        id: genId("inq"),
        artworkId,
        collectorName: "",
        contact: "",
        inquiryType: "RESALE",
        message: "재판매 등록 — 신규 구매자 의사 미정. 응대 시 본 inquiry에 정보 기입.",
        source: "OTHER",
        status: "OPEN",
        memo: `이전 소유자: ${previousOwner}. 재판매 흐름의 시작점.`,
        // Forward pointer (rule_13.5 sync layer) — bidirectional ref between
        // tx_resale and inquiry_resale enables O(1) buyer/collector sync.
        transactionId: resaleTx.id,
        createdAt: now,
        updatedAt: now,
      };
      newInquiries = {
        ...state.inquiries,
        [artworkId]: [resaleInquiry, ...(state.inquiries[artworkId] ?? [])],
      };
      // Bind inquiry id back into the resale tx (single source of truth)
      resaleTx.inquiryId = resaleInquiry.id;

      const newTxEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "TRANSACTION",
        title: "New Transaction 생성",
        detail: `이전 소유자: ${previousOwner} · 재판매 커미션 15%`,
        at: now,
        actor: actorLabel(state.currentRole),
        actorRole: state.currentRole,
        relatedEntityType: "transaction",
        relatedEntityId: resaleTx.id,
      };
      const ownershipEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "INQUIRY",
        title: "Ownership 전환 준비",
        detail: "Resale Inquiry 자동 생성 · 신규 구매자 응대 대기",
        at: now,
        actor: "System",
        relatedEntityType: "inquiry",
        relatedEntityId: resaleInquiry.id,
      };
      newTimelineList = [
        ownershipEvent,
        newTxEvent,
        stateEvent,
        ...(state.timeline[artworkId] ?? []),
      ];
    }

    set({
      artworks: newArtworks,
      timeline: { ...state.timeline, [artworkId]: newTimelineList },
      inquiries: newInquiries,
      transactions: newTransactions,
      invoices: newInvoices,
      transitionRequest: { kind: "closed" },
    });
  },

  // --- Inquiry --------------------------------------------------------------
  openInquiryDetail: (inquiryId) =>
    set({ inquiryDetailRequest: { kind: "open", inquiryId } }),

  closeInquiryDetail: () =>
    set({ inquiryDetailRequest: { kind: "closed" } }),

  // STEP 49 — Manual Inquiry Creation 진입점.
  openInquiryCreate: (artworkId) => {
    if (!artworkId) return;
    set({ inquiryCreateRequest: { kind: "open", artworkId } });
  },
  closeInquiryCreate: () =>
    set({ inquiryCreateRequest: { kind: "closed" } }),

  // STEP 49 — Manual Inquiry Creation 핵심 액션.
  //
  // 정책 (사용자 spec):
  //   - timeline event "Inquiry 직접 생성" + actor=현재 role + relatedEntity=inquiry
  //   - state transition은 canonical state machine 경로일 때만:
  //       READY → INQUIRY  (transitionState의 자동 inquiry 생성과 같은 의미를
  //                         반대 방향으로 — 운영자가 "이미 inquiry 있음" 의도 명시)
  //       BROKERED → INQUIRY  (재판매 문의 접수 — 사용자 spec 외 canonical 경로)
  //   - 이외 상태 (DRAFT / INQUIRY / DEAL / PAID / CLOSED / REOPENED): 상태 무변경
  //
  // 반환값: 생성된 inquiry id (실패 시 null).
  createInquiry: (artworkId, input) => {
    const state = get();
    const artwork = state.artworks.find((a) => a.id === artworkId);
    if (!artwork) return null;

    const now = new Date().toISOString();
    const newInquiry: Inquiry = {
      id: genId("inq"),
      artworkId,
      collectorName: (input.collectorName ?? "").trim(),
      contact: (input.contact ?? "").trim(),
      inquiryType: input.inquiryType,
      message: (input.message ?? "").trim(),
      source: input.source,
      status: input.status ?? "OPEN",
      memo: (input.memo ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    const inquiryEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "INQUIRY",
      title: "Inquiry 직접 생성",
      detail: newInquiry.collectorName
        ? `${newInquiry.collectorName} · ${INQUIRY_TYPE_LABEL[newInquiry.inquiryType]} · ${INQUIRY_SOURCE_LABEL[newInquiry.source]}`
        : `${INQUIRY_TYPE_LABEL[newInquiry.inquiryType]} · ${INQUIRY_SOURCE_LABEL[newInquiry.source]}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "inquiry",
      relatedEntityId: newInquiry.id,
    };

    // 상태 전환 정책 — canonical 경로만 자동 적용.
    const shouldTransition =
      artwork.state === "READY" || artwork.state === "BROKERED";
    const nextEvents: TimelineEvent[] = [inquiryEvent];
    let nextArtworks = state.artworks;

    if (shouldTransition) {
      const stateEvent: TimelineEvent = {
        id: genId("ev"),
        artworkId,
        kind: "STATE_CHANGE",
        title: `${artwork.state} → INQUIRY`,
        detail: `${STATE_LABEL_KR[artwork.state]} → ${STATE_LABEL_KR.INQUIRY} · 신규 문의 직접 생성과 함께 전환`,
        at: now,
        actor: actorLabel(state.currentRole),
        actorRole: state.currentRole,
      };
      // state 변경 시 inquiry event를 먼저, state event 다음 (사용자 가독성 — inquiry가 원인)
      nextEvents.push(stateEvent);
      nextArtworks = state.artworks.map((a) =>
        a.id === artworkId
          ? { ...a, state: "INQUIRY" as ArtworkState, updatedAt: now }
          : a
      );
    }

    set((s) => ({
      artworks: nextArtworks,
      inquiries: {
        ...s.inquiries,
        [artworkId]: [newInquiry, ...(s.inquiries[artworkId] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [...nextEvents, ...(s.timeline[artworkId] ?? [])],
      },
      // drawer는 호출자가 닫음 (UI 정책 — 폼이 명시적으로 onCancel 호출)
    }));

    return newInquiry.id;
  },

  updateInquiry: (inquiryId, patch) => {
    const state = get();

    let foundInquiry: Inquiry | undefined;
    let foundArtworkId: string | undefined;
    for (const [aid, list] of Object.entries(state.inquiries)) {
      const inq = list.find((i) => i.id === inquiryId);
      if (inq) {
        foundInquiry = inq;
        foundArtworkId = aid;
        break;
      }
    }
    if (!foundInquiry || !foundArtworkId) return;

    const old = foundInquiry;
    const artworkId = foundArtworkId;
    const now = new Date().toISOString();

    const updated: Inquiry = {
      ...old,
      collectorName: patch.collectorName ?? old.collectorName,
      contact: patch.contact ?? old.contact,
      inquiryType: patch.inquiryType ?? old.inquiryType,
      message: patch.message ?? old.message,
      source: patch.source ?? old.source,
      status: patch.status ?? old.status,
      memo: patch.memo ?? old.memo,
      updatedAt: now,
    };

    const changes: string[] = [];
    if (patch.status !== undefined && patch.status !== old.status) {
      changes.push(
        `상태 ${INQUIRY_STATUS_LABEL[old.status]} → ${
          INQUIRY_STATUS_LABEL[patch.status]
        }`
      );
    }
    if (patch.memo !== undefined && (patch.memo ?? "") !== (old.memo ?? "")) {
      changes.push("메모 갱신");
    }
    const profileChanged =
      (patch.collectorName !== undefined &&
        patch.collectorName !== old.collectorName) ||
      (patch.contact !== undefined && patch.contact !== old.contact) ||
      (patch.inquiryType !== undefined &&
        patch.inquiryType !== old.inquiryType) ||
      (patch.message !== undefined && patch.message !== old.message) ||
      (patch.source !== undefined && patch.source !== old.source);
    if (profileChanged) changes.push("컬렉터·문의 정보 갱신");

    const detail = changes.length > 0 ? changes.join(" · ") : "정보 갱신";

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "INQUIRY",
      title: "Inquiry 업데이트",
      detail,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "inquiry",
      relatedEntityId: inquiryId,
    };

    // Buyer-sync cascade (rule_13.5): when collectorName changes on an
    // inquiry that's bound to a Transaction, mirror the value to the tx's
    // buyerName. Guard: only sync if the linked tx is the *active* (newest)
    // tx for the artwork — historical (older) tx are immutable per rule_4.
    let nextTransactions = state.transactions;
    const collectorChanged =
      patch.collectorName !== undefined &&
      patch.collectorName !== old.collectorName;
    if (collectorChanged && updated.transactionId) {
      const txList = state.transactions[artworkId] ?? [];
      const activeTx = txList[0];
      // Only mirror when the bound tx is the newest one (active resale or
      // current deal). If user is editing a historical inquiry whose tx is
      // no longer active, sync is silently skipped.
      if (activeTx && activeTx.id === updated.transactionId) {
        nextTransactions = {
          ...state.transactions,
          [artworkId]: txList.map((t) =>
            t.id === activeTx.id
              ? { ...t, buyerName: updated.collectorName, updatedAt: now }
              : t
          ),
        };
      }
    }

    set((s) => ({
      inquiries: {
        ...s.inquiries,
        [artworkId]: (s.inquiries[artworkId] ?? []).map((i) =>
          i.id === inquiryId ? updated : i
        ),
      },
      transactions: nextTransactions,
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));
  },

  // --- Transaction ----------------------------------------------------------
  openTransactionDetail: (transactionId) =>
    set({
      transactionDetailRequest: { kind: "open", transactionId },
    }),

  closeTransactionDetail: () =>
    set({ transactionDetailRequest: { kind: "closed" } }),

  updateTransaction: (transactionId, patch) => {
    const state = get();

    // Historical guard (STEP 14, rule_4 immutability).
    // Silent no-op for historical (non-active) transactions — no state
    // mutation, no timeline event. The single source of truth for what
    // counts as "historical" lives in transaction-helpers.ts.
    if (isHistoricalTransaction(state.transactions, transactionId)) return;

    let foundTx: Transaction | undefined;
    let foundArtworkId: string | undefined;
    for (const [aid, list] of Object.entries(state.transactions)) {
      const tx = list.find((t) => t.id === transactionId);
      if (tx) {
        foundTx = tx;
        foundArtworkId = aid;
        break;
      }
    }
    if (!foundTx || !foundArtworkId) return;

    const old = foundTx;
    const artworkId = foundArtworkId;
    const now = new Date().toISOString();

    const updated: Transaction = {
      ...old,
      buyerName: patch.buyerName ?? old.buyerName,
      agreedPrice: patch.agreedPrice ?? old.agreedPrice,
      currency: patch.currency ?? old.currency,
      status: patch.status ?? old.status,
      dealMemo: patch.dealMemo ?? old.dealMemo,
      updatedAt: now,
    };

    // Build smart change summary for the timeline detail line
    const changes: string[] = [];
    if (patch.status !== undefined && patch.status !== old.status) {
      changes.push(
        `상태 ${TRANSACTION_STATUS_LABEL[old.status]} → ${
          TRANSACTION_STATUS_LABEL[patch.status]
        }`
      );
    }
    const newCurrency = patch.currency ?? old.currency;
    if (
      patch.agreedPrice !== undefined &&
      patch.agreedPrice !== old.agreedPrice
    ) {
      changes.push(
        `가격 ${formatMoney(old.agreedPrice, old.currency)} → ${formatMoney(
          patch.agreedPrice,
          newCurrency
        )}`
      );
    } else if (patch.currency !== undefined && patch.currency !== old.currency) {
      changes.push(`통화 ${old.currency} → ${patch.currency}`);
    }
    if (
      patch.buyerName !== undefined &&
      patch.buyerName !== old.buyerName
    ) {
      changes.push("구매자 갱신");
    }
    if (
      patch.dealMemo !== undefined &&
      (patch.dealMemo ?? "") !== (old.dealMemo ?? "")
    ) {
      changes.push("메모 갱신");
    }

    const detail = changes.length > 0 ? changes.join(" · ") : "정보 갱신";

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "TRANSACTION",
      title: "Transaction 업데이트",
      detail,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "transaction",
      relatedEntityId: transactionId,
    };

    set((s) => {
      // Buyer-sync cascade (rule_13.5): when buyerName changes on the
      // *active* transaction (artwork's newest tx), mirror to its linked
      // Inquiry's collectorName. Historical tx are immutable per rule_4 —
      // their buyer was already snapshotted in their downstream Settlement
      // / Tax / Contract records.
      const txList = s.transactions[artworkId] ?? [];
      const activeTx = txList[0];
      const isActive = activeTx?.id === transactionId;
      const buyerChanged =
        patch.buyerName !== undefined && patch.buyerName !== old.buyerName;

      let nextInquiries = s.inquiries;
      if (isActive && buyerChanged && updated.inquiryId) {
        const inqList = s.inquiries[artworkId] ?? [];
        nextInquiries = {
          ...s.inquiries,
          [artworkId]: inqList.map((i) =>
            i.id === updated.inquiryId
              ? {
                  ...i,
                  collectorName: updated.buyerName,
                  updatedAt: now,
                }
              : i
          ),
        };
      }

      return {
        transactions: {
          ...s.transactions,
          [artworkId]: txList.map((t) =>
            t.id === transactionId ? updated : t
          ),
        },
        inquiries: nextInquiries,
        timeline: {
          ...s.timeline,
          [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
        },
      };
    });
  },

  // --- Buyer sync (rule_13.5) -----------------------------------------------
  // Dedicated programmatic entry point for buyer-only mutations. Equivalent
  // to updateTransaction({buyerName}) but bypasses the full patch path and
  // emits a more specific timeline event ("구매자 갱신"). Used when calling
  // code only knows the buyer string and not other tx fields.
  //
  // Historical guard: only the active (newest) tx for an artwork accepts
  // buyer mutations. Older tx are immutable (rule_4). Silent no-op when:
  //   - tx not found
  //   - tx is historical (not artwork.transactions[0])
  //   - buyer string equals current buyerName (no-op)
  updateBuyer: (transactionId, buyer) => {
    const state = get();

    // Historical guard (STEP 14) — uses single source of truth helper
    if (isHistoricalTransaction(state.transactions, transactionId)) return;

    // Locate tx + parent artwork
    let foundTx: Transaction | undefined;
    let foundArtworkId: string | undefined;
    for (const [aid, list] of Object.entries(state.transactions)) {
      const tx = list.find((t) => t.id === transactionId);
      if (tx) {
        foundTx = tx;
        foundArtworkId = aid;
        break;
      }
    }
    if (!foundTx || !foundArtworkId) return;

    const artworkId = foundArtworkId;
    const txList = state.transactions[artworkId] ?? [];
    const activeTx = txList[0];

    // Defensive — should be redundant after the guard above, kept as belt-and-braces
    if (!activeTx || activeTx.id !== transactionId) return;

    // No-op when nothing changes
    const trimmed = buyer.trim();
    if (trimmed === foundTx.buyerName) return;

    const now = new Date().toISOString();
    const updatedTx: Transaction = {
      ...foundTx,
      buyerName: trimmed,
      updatedAt: now,
    };

    // Mirror to linked Inquiry (if any)
    const inqList = state.inquiries[artworkId] ?? [];
    const linkedInquiry = updatedTx.inquiryId
      ? inqList.find((i) => i.id === updatedTx.inquiryId)
      : undefined;
    const nextInquiries = linkedInquiry
      ? {
          ...state.inquiries,
          [artworkId]: inqList.map((i) =>
            i.id === linkedInquiry.id
              ? { ...i, collectorName: trimmed, updatedAt: now }
              : i
          ),
        }
      : state.inquiries;

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "TRANSACTION",
      title: "구매자 갱신",
      detail: trimmed
        ? `구매자: ${trimmed}${
            linkedInquiry ? " · Inquiry collector 동기화" : ""
          }`
        : "구매자 정보 비움",
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "transaction",
      relatedEntityId: transactionId,
    };

    set((s) => ({
      transactions: {
        ...s.transactions,
        [artworkId]: (s.transactions[artworkId] ?? []).map((t) =>
          t.id === transactionId ? updatedTx : t
        ),
      },
      inquiries: nextInquiries,
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));
  },

  // --- Price entry (STEP 14) ------------------------------------------------
  // Single-field updater for `agreedPrice` (and optional `currency`). Mirrors
  // the dedicated-entry pattern of `updateBuyer`. Useful for callers that
  // only need to touch price without sending the full TransactionUpdate
  // patch shape. Same historical guard semantics (rule_4).
  updatePrice: (transactionId, agreedPrice, currency) => {
    const state = get();

    if (isHistoricalTransaction(state.transactions, transactionId)) return;

    let foundTx: Transaction | undefined;
    let foundArtworkId: string | undefined;
    for (const [aid, list] of Object.entries(state.transactions)) {
      const tx = list.find((t) => t.id === transactionId);
      if (tx) {
        foundTx = tx;
        foundArtworkId = aid;
        break;
      }
    }
    if (!foundTx || !foundArtworkId) return;

    // No-op when nothing changes
    const newPrice = Math.max(0, Math.floor(agreedPrice));
    const newCurrency = currency ?? foundTx.currency;
    if (
      newPrice === foundTx.agreedPrice &&
      newCurrency === foundTx.currency
    ) {
      return;
    }

    const artworkId = foundArtworkId;
    const now = new Date().toISOString();
    const updatedTx: Transaction = {
      ...foundTx,
      agreedPrice: newPrice,
      currency: newCurrency,
      updatedAt: now,
    };

    const detail =
      newCurrency !== foundTx.currency
        ? `가격 ${formatMoney(foundTx.agreedPrice, foundTx.currency)} → ${formatMoney(newPrice, newCurrency)} · 통화 변경`
        : `가격 ${formatMoney(foundTx.agreedPrice, foundTx.currency)} → ${formatMoney(newPrice, newCurrency)}`;

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "TRANSACTION",
      title: "가격 갱신",
      detail,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "transaction",
      relatedEntityId: transactionId,
    };

    set((s) => ({
      transactions: {
        ...s.transactions,
        [artworkId]: (s.transactions[artworkId] ?? []).map((t) =>
          t.id === transactionId ? updatedTx : t
        ),
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));
  },

  // --- Resale loop (rule_13) ------------------------------------------------
  // Programmatic entry point for resale registration. The DetailPanel
  // CLOSED state Primary button surfaces the same flow through the
  // confirmation modal (openTransition → modal → transitionState), giving
  // the user a chance to read the effects list before committing. Both
  // routes converge on transitionState's CLOSED → BROKERED branch where
  // the cascade (resale Transaction + auto-Inquiry + 3 timeline events) lives.
  startResale: (artworkId) => {
    const state = get();
    const artwork = state.artworks.find((a) => a.id === artworkId);
    if (!artwork) return;
    if (artwork.state !== "CLOSED") return; // resale only valid from CLOSED
    // Delegates the entire cascade — keeps the implementation single-pathed.
    get().transitionState(artworkId, "BROKERED");
  },
  /** @deprecated alias for startResale — preserved to avoid breaking callers. */
  createResaleTransaction: (artworkId) => {
    get().startResale(artworkId);
  },

  // --- Invoice (rule_4 — Document trust layer) ------------------------------
  openInvoiceDetail: (invoiceId) =>
    set({ invoiceDetailRequest: { kind: "open", invoiceId } }),

  closeInvoiceDetail: () =>
    set({ invoiceDetailRequest: { kind: "closed" } }),

  sendInvoice: (invoiceId) => {
    const state = get();

    // Locate invoice + its parent transactionId
    let foundInv: Invoice | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.invoices)) {
      const inv = list.find((i) => i.id === invoiceId);
      if (inv) {
        foundInv = inv;
        foundTxId = txId;
        break;
      }
    }
    if (!foundInv || !foundTxId) return;
    if (foundInv.status !== "DRAFT") return; // already sent or paid
    if (foundInv.isLocked) return;           // defensive — DRAFT shouldn't be locked

    // Locate parent transaction → artworkId
    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const artworkId = tx.artworkId;
    const now = new Date().toISOString();

    // STEP 32 — FX lock at SENT/LOCKED transition. KRW 인보이스는 capture
    // 안 함 (갤러리 base currency, 변환 불필요). createFXSnapshot이 unknown
    // pair 등으로 null 반환 시에도 fxSnapshot 미저장 + invoice는 정상 lock
    // (방어적 — FX 시스템 부재가 lock 흐름을 차단하지 않음).
    let fxSnapshot: FXRate | undefined;
    let fxBaseCurrency: Currency | undefined;
    let fxQuoteCurrency: Currency | undefined;
    if (foundInv.currency !== "KRW") {
      const snap = createFXSnapshot(foundInv.currency, "KRW");
      if (snap) {
        fxSnapshot = snap;
        fxBaseCurrency = snap.baseCurrency;
        fxQuoteCurrency = snap.quoteCurrency;
      }
    }

    // SENT + LOCK applied atomically (rule_4)
    const updated: Invoice = {
      ...foundInv,
      status: "SENT",
      sentAt: now,
      isLocked: true,
      lockedAt: now,
      // STEP 32 FX lock — undefined for KRW invoices (or unknown pair fallback)
      fxSnapshot,
      fxBaseCurrency,
      fxQuoteCurrency,
    };

    // Timeline detail — FX 정보를 Audit / Export에서 자연스럽게 노출
    const fxDetailSuffix = fxSnapshot
      ? ` · FX ${fxSnapshot.baseCurrency}/${fxSnapshot.quoteCurrency} ${fxSnapshot.rate.toLocaleString(
          "en-US",
          { maximumFractionDigits: 4 }
        )} locked at ${fxSnapshot.fetchedAt.slice(0, 10)}`
      : "";

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "DOCUMENT",
      title: "Invoice 발송 · 잠금",
      detail: `v${updated.version} · ${formatMoney(
        updated.amount,
        updated.currency
      )} · ${INVOICE_STATUS_LABEL.SENT} · 이후 수정 불가${fxDetailSuffix}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
    };

    set((s) => ({
      invoices: {
        ...s.invoices,
        [foundTxId!]: (s.invoices[foundTxId!] ?? []).map((i) =>
          i.id === invoiceId ? updated : i
        ),
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));
  },

  /**
   * Patch editable fields on a DRAFT invoice. Locked documents are silently
   * rejected — UI must call createInvoiceVersion() to fork instead.
   */
  updateInvoice: (invoiceId, patch) => {
    const state = get();

    let foundInv: Invoice | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.invoices)) {
      const inv = list.find((i) => i.id === invoiceId);
      if (inv) {
        foundInv = inv;
        foundTxId = txId;
        break;
      }
    }
    if (!foundInv || !foundTxId) return;
    if (foundInv.isLocked) return; // rule_4 — locked documents are immutable

    // No-op if nothing actually changed
    const nextAmount = patch.amount ?? foundInv.amount;
    const nextCurrency = patch.currency ?? foundInv.currency;
    if (
      nextAmount === foundInv.amount &&
      nextCurrency === foundInv.currency
    ) {
      return;
    }

    const updated: Invoice = {
      ...foundInv,
      amount: nextAmount,
      currency: nextCurrency,
    };

    set((s) => ({
      invoices: {
        ...s.invoices,
        [foundTxId!]: (s.invoices[foundTxId!] ?? []).map((i) =>
          i.id === invoiceId ? updated : i
        ),
      },
    }));
  },

  /**
   * Fork a locked Invoice into a new DRAFT version (rule_4 — Document trust).
   * The previous version remains untouched in the chain. The new version
   * starts as DRAFT (editable, unlocked) with version+1 and parentInvoiceId
   * pointing to the source. The drawer is re-targeted to the new version
   * so the staff member can edit immediately.
   */
  createInvoiceVersion: (parentInvoiceId, revisionReason) => {
    const state = get();

    let parent: Invoice | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.invoices)) {
      const inv = list.find((i) => i.id === parentInvoiceId);
      if (inv) {
        parent = inv;
        foundTxId = txId;
        break;
      }
    }
    if (!parent || !foundTxId) return null;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return null;

    const artworkId = tx.artworkId;
    const now = new Date().toISOString();

    // Document Lifecycle Clarity STEP — revisionReason normalize
    const trimmedReason = revisionReason?.trim();
    const reason =
      trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined;

    const newInvoice: Invoice = {
      id: genId("inv"),
      transactionId: parent.transactionId,
      amount: parent.amount,
      currency: parent.currency,
      status: "DRAFT",
      issuedAt: now,
      // sentAt / paidAt deliberately undefined — fresh draft
      version: parent.version + 1,
      parentInvoiceId: parent.id,
      lockedAt: null,
      isLocked: false,
      // Document Lifecycle Clarity STEP — revision reason 영속화
      revisionReason: reason,
    };

    // Document Lifecycle Clarity STEP — timeline detail에 사유 reflect
    const baseDetail = `v${parent.version} → v${newInvoice.version} · ${formatMoney(
      newInvoice.amount,
      newInvoice.currency
    )} · 초안`;
    const detailWithReason = reason
      ? `${baseDetail} · 사유: ${reason}`
      : baseDetail;

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "DOCUMENT",
      title: "Invoice 새 버전 생성",
      detail: detailWithReason,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "invoice",
      relatedEntityId: newInvoice.id,
    };

    set((s) => ({
      invoices: {
        ...s.invoices,
        [foundTxId!]: [newInvoice, ...(s.invoices[foundTxId!] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
      // Re-target the drawer to the new draft so editing continues seamlessly
      invoiceDetailRequest: { kind: "open", invoiceId: newInvoice.id },
    }));

    return newInvoice.id;
  },

  // --- Payment (rule_3 — money flow separation) -----------------------------
  openPaymentRegister: (invoiceId) =>
    set({ paymentRegisterRequest: { kind: "open", invoiceId } }),

  closePaymentRegister: () =>
    set({ paymentRegisterRequest: { kind: "closed" } }),

  /**
   * Register a Payment against a specific Invoice. This is the canonical
   * trigger for the AGREED → PAID + DEAL → PAID cascade. We deliberately
   * keep Payment, Invoice, Transaction, and Artwork as separate domains
   * (rule_3 / rule_11) and only synchronize them here, in one atomic update.
   */
  registerPayment: (input) => {
    const state = get();

    // Locate the parent chain: Invoice → Transaction → Artwork
    let invoice: Invoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.invoices)) {
      const inv = list.find((i) => i.id === input.invoiceId);
      if (inv) {
        invoice = inv;
        transactionId = txId;
        break;
      }
    }
    if (!invoice || !transactionId) return;

    // STEP 129 — rule_3 Money Flow Separation defense in depth layer (b):
    // PRE invoice (pro-forma) 는 registerPayment trigger 절대 발생 금지 — 실제
    // money flow 없음. silent reject 정책 (UI layer (c) 가 disabled 안내 담당).
    // STEP 127 Phase 1 §2.4 의 🔴 CRITICAL 4-layer 방어 중 store-side layer.
    if (!canRegisterPaymentFor(invoice)) return;

    const transaction = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === transactionId);
    if (!transaction) return;

    const artwork = state.artworks.find((a) => a.id === transaction.artworkId);
    if (!artwork) return;

    const artworkId = artwork.id;
    const now = new Date().toISOString();
    // Normalize paidAt — accept date-only "YYYY-MM-DD" by appending T00:00.
    const paidAtISO = input.paidAt.length === 10
      ? `${input.paidAt}T00:00:00+09:00`
      : input.paidAt;

    // 1. Create Payment (RECEIVED — gallery confirmed funds)
    const payment: Payment = {
      id: genId("pay"),
      invoiceId: invoice.id,
      transactionId: transaction.id,
      artworkId: artwork.id,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      status: "RECEIVED",
      paidAt: paidAtISO,
      memo: input.memo?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Cascade → Invoice.status = PAID (rule_4 — Document state flows from money flow)
    //    Defensive lock: if somehow paying a still-DRAFT invoice, lock it now.
    const updatedInvoice: Invoice = {
      ...invoice,
      status: "PAID",
      paidAt: paidAtISO,
      isLocked: true,
      lockedAt: invoice.lockedAt ?? now,
    };

    // 3. Cascade → Transaction.status = PAID
    const updatedTransaction: Transaction = {
      ...transaction,
      status: "PAID",
      updatedAt: now,
    };

    // 4. Cascade → Artwork.state DEAL → PAID (rule_6, only if currently DEAL)
    const willTransitionArtwork = artwork.state === "DEAL";
    const updatedArtwork: Artwork = willTransitionArtwork
      ? { ...artwork, state: "PAID", updatedAt: now }
      : artwork;

    // 5. Timeline events — primary (PAYMENT) + secondary (STATE_CHANGE if moved)
    //    + Settlement (auto-create per rule_3, rule_12)
    const paymentEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "PAYMENT",
      title: "결제 등록",
      detail: `${formatMoney(payment.amount, payment.currency)} · ${
        PAYMENT_METHOD_LABEL[payment.method]
      } · ${TRANSACTION_STATUS_LABEL.PAID}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "invoice",
      relatedEntityId: invoice.id,
    };

    const stateChangeEvent: TimelineEvent | null = willTransitionArtwork
      ? {
          id: genId("ev"),
          artworkId,
          kind: "STATE_CHANGE",
          title: `${STATE_LABEL_KR.DEAL} → ${STATE_LABEL_KR.PAID}`,
          detail: "결제 등록에 따른 자동 전환",
          at: now,
          actor: "System",
        }
      : null;

    // Settlement auto-create (PENDING) — only if no settlement exists yet
    const existingSettlement = (state.settlements[transaction.id] ?? [])[0];
    let newSettlement: Settlement | null = null;
    let settlementEvent: TimelineEvent | null = null;
    if (!existingSettlement) {
      const { artistShare, galleryShare } = splitSettlement(payment.amount);
      newSettlement = {
        id: genId("stl"),
        transactionId: transaction.id,
        artworkId,
        totalAmount: payment.amount,
        artistShare,
        galleryShare,
        currency: payment.currency,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };
      settlementEvent = {
        id: genId("ev"),
        artworkId,
        kind: "TRANSACTION",
        title: "Settlement 자동 생성",
        detail: `${formatMoney(
          newSettlement.totalAmount,
          newSettlement.currency
        )} · 작가 ${formatMoney(artistShare, payment.currency)} · 갤러리 ${formatMoney(
          galleryShare,
          payment.currency
        )} · ${SETTLEMENT_STATUS_LABEL.PENDING}`,
        at: now,
        actor: "System",
        relatedEntityType: "settlement",
        relatedEntityId: newSettlement.id,
      };
    }

    const newTimelineList: TimelineEvent[] = [
      ...(settlementEvent ? [settlementEvent] : []),
      paymentEvent,
      ...(stateChangeEvent ? [stateChangeEvent] : []),
      ...(state.timeline[artworkId] ?? []),
    ];

    // STEP 87 — Cash Receipt 자동 생성 (rule_3 / rule_4 / rule_11).
    //   Payment registration = receipt 자동 trigger. DRAFT 상태로 생성되며,
    //   운영자가 ReceiptDetailDrawer에서 issueReceipt() 트리거 시 ISSUED + LOCK.
    //   Invoice 패턴 답습 (snapshot amount/currency, version=1, parent=null).
    //
    //   **deviceLocal 정책**: receipt는 *device-local 운영 record*로 시작 —
    //   외부 발송 / 동기는 별개 흐름 (STEP 87 send-ready 슬롯).
    const newReceipt: Receipt = {
      id: genId("rec"),
      paymentId: payment.id,
      transactionId: transaction.id,
      artworkId,
      amount: payment.amount,
      currency: payment.currency,
      status: "DRAFT",
      issuedAt: now,
      version: 1,
      parentReceiptId: null,
      lockedAt: null,
      isLocked: false,
      sourceContext: "auto",
      deliveryStatus: "not_prepared",
    };
    const receiptCreatedEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "DOCUMENT",
      title: "영수증 자동 생성",
      detail: `${formatMoney(
        newReceipt.amount,
        newReceipt.currency
      )} · 초안 — 발행 전`,
      at: now,
      actor: "System",
      relatedEntityType: "receipt",
      relatedEntityId: newReceipt.id,
    };
    newTimelineList.unshift(receiptCreatedEvent);

    // 6. Apply atomically
    set((s) => ({
      payments: {
        ...s.payments,
        [transaction.id]: [payment, ...(s.payments[transaction.id] ?? [])],
      },
      receipts: {
        ...s.receipts,
        [transaction.id]: [newReceipt, ...(s.receipts[transaction.id] ?? [])],
      },
      invoices: {
        ...s.invoices,
        [transaction.id]: (s.invoices[transaction.id] ?? []).map((i) =>
          i.id === invoice.id ? updatedInvoice : i
        ),
      },
      transactions: {
        ...s.transactions,
        [artworkId]: (s.transactions[artworkId] ?? []).map((t) =>
          t.id === transaction.id ? updatedTransaction : t
        ),
      },
      artworks: willTransitionArtwork
        ? s.artworks.map((a) => (a.id === artworkId ? updatedArtwork : a))
        : s.artworks,
      settlements: newSettlement
        ? {
            ...s.settlements,
            [transaction.id]: [
              newSettlement!,
              ...(s.settlements[transaction.id] ?? []),
            ],
          }
        : s.settlements,
      timeline: { ...s.timeline, [artworkId]: newTimelineList },
      paymentRegisterRequest: { kind: "closed" },
    }));
  },

  // --- STEP 87 — Receipt (Cash Receipt — Payment의 acknowledgement document) ---
  openReceiptDetail: (receiptId) =>
    set({ receiptDetailRequest: { kind: "open", receiptId } }),

  closeReceiptDetail: () =>
    set({ receiptDetailRequest: { kind: "closed" } }),

  // --- STEP 88 — Fiscal Summary (operational fiscal/VAT overview, derived) ---
  openFiscalSummary: () => set({ fiscalSummaryRequest: { kind: "open" } }),
  closeFiscalSummary: () => set({ fiscalSummaryRequest: { kind: "closed" } }),

  // STEP 91 — Accountant Export
  openAccountantExport: () =>
    set({ accountantExportRequest: { kind: "open" } }),
  closeAccountantExport: () =>
    set({ accountantExportRequest: { kind: "closed" } }),

  // STEP 92 — Market Insight (operational intelligence)
  openMarketInsight: (artworkId) =>
    set({
      marketInsightRequest: artworkId
        ? { kind: "open", artworkId }
        : { kind: "open" },
    }),
  closeMarketInsight: () =>
    set({ marketInsightRequest: { kind: "closed" } }),

  /**
   * Manual fallback for when the auto-trigger in registerPayment didn't run
   * (e.g. data restored from a backup with payments but no receipts). Creates
   * a fresh DRAFT receipt against the most recent active version of the chain.
   */
  createReceipt: (paymentId) => {
    const state = get();

    // Locate Payment → Transaction → Artwork
    let payment: Payment | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.payments)) {
      const p = list.find((x) => x.id === paymentId);
      if (p) {
        payment = p;
        transactionId = txId;
        break;
      }
    }
    if (!payment || !transactionId) return null;

    const transaction = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === transactionId);
    if (!transaction) return null;

    const artwork = state.artworks.find((a) => a.id === transaction.artworkId);
    if (!artwork) return null;

    const now = new Date().toISOString();
    const newReceipt: Receipt = {
      id: genId("rec"),
      paymentId: payment.id,
      transactionId: transaction.id,
      artworkId: artwork.id,
      amount: payment.amount,
      currency: payment.currency,
      status: "DRAFT",
      issuedAt: now,
      version: 1,
      parentReceiptId: null,
      lockedAt: null,
      isLocked: false,
      sourceContext: "manual",
      deliveryStatus: "not_prepared",
    };
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: artwork.id,
      kind: "DOCUMENT",
      title: "영수증 수동 생성",
      detail: `${formatMoney(newReceipt.amount, newReceipt.currency)} · 초안`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: newReceipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transaction.id]: [newReceipt, ...(s.receipts[transaction.id] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artwork.id]: [ev, ...(s.timeline[artwork.id] ?? [])],
      },
    }));

    return newReceipt.id;
  },

  /**
   * DRAFT → ISSUED. Lock + finalizedAt + lockedBy + timeline. Silent no-op
   * if already locked (rule_4 immutability) or if receipt cannot be located.
   */
  issueReceipt: (receiptId) => {
    const state = get();
    let receipt: Receipt | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.receipts)) {
      const r = list.find((x) => x.id === receiptId);
      if (r) {
        receipt = r;
        transactionId = txId;
        break;
      }
    }
    if (!receipt || !transactionId) return;
    if (receipt.isLocked || receipt.status === "ISSUED") return; // already finalized

    const now = new Date().toISOString();
    const updatedReceipt: Receipt = {
      ...receipt,
      status: "ISSUED",
      finalizedAt: now,
      lockedAt: now,
      isLocked: true,
      lockedBy: actorLabel(state.currentRole),
    };
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: receipt.artworkId,
      kind: "DOCUMENT",
      title: "영수증 발행 완료",
      detail: `v${receipt.version} · ${formatMoney(
        receipt.amount,
        receipt.currency
      )} · LOCK 적용`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: receipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transactionId!]: (s.receipts[transactionId!] ?? []).map((r) =>
          r.id === receipt!.id ? updatedReceipt : r
        ),
      },
      timeline: {
        ...s.timeline,
        [receipt!.artworkId]: [
          ev,
          ...(s.timeline[receipt!.artworkId] ?? []),
        ],
      },
    }));
  },

  /**
   * Fork a locked Receipt into a new editable DRAFT. Mirrors
   * createInvoiceVersion — optional `revisionReason` (Document Lifecycle
   * Clarity pattern). Returns the new receipt id; also re-targets the open
   * drawer to it.
   */
  createReceiptVersion: (parentReceiptId, revisionReason) => {
    const state = get();
    let parent: Receipt | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.receipts)) {
      const r = list.find((x) => x.id === parentReceiptId);
      if (r) {
        parent = r;
        transactionId = txId;
        break;
      }
    }
    if (!parent || !transactionId) return null;

    const trimmed = revisionReason?.trim();
    const now = new Date().toISOString();
    const newReceipt: Receipt = {
      id: genId("rec"),
      paymentId: parent.paymentId,
      transactionId: parent.transactionId,
      artworkId: parent.artworkId,
      amount: parent.amount,
      currency: parent.currency,
      status: "DRAFT",
      issuedAt: now,
      version: parent.version + 1,
      parentReceiptId: parent.id,
      lockedAt: null,
      isLocked: false,
      sourceContext: "manual",
      revisionReason: trimmed && trimmed.length > 0 ? trimmed : undefined,
      deliveryStatus: "not_prepared",
    };

    const detail = [
      `v${parent.version} → v${newReceipt.version}`,
      formatMoney(newReceipt.amount, newReceipt.currency),
      "초안",
      ...(newReceipt.revisionReason
        ? [`사유: ${newReceipt.revisionReason}`]
        : []),
    ].join(" · ");
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: parent.artworkId,
      kind: "DOCUMENT",
      title: "영수증 새 버전 생성",
      detail,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: newReceipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transactionId!]: [
          newReceipt,
          ...(s.receipts[transactionId!] ?? []),
        ],
      },
      timeline: {
        ...s.timeline,
        [parent!.artworkId]: [ev, ...(s.timeline[parent!.artworkId] ?? [])],
      },
      receiptDetailRequest: { kind: "open", receiptId: newReceipt.id },
    }));

    return newReceipt.id;
  },

  /**
   * Print 액션 시점 기록 — `lastPrintedAt` 갱신 + timeline event emit. 본
   * 액션은 *audit memo* 수준 — 실제 인쇄는 호출자(ReceiptDetailDrawer)가
   * `window.print()`로 수행. 이 액션은 그 흐름의 *전*에 호출되어 기록만 남김.
   */
  markReceiptPrinted: (receiptId) => {
    const state = get();
    let receipt: Receipt | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.receipts)) {
      const r = list.find((x) => x.id === receiptId);
      if (r) {
        receipt = r;
        transactionId = txId;
        break;
      }
    }
    if (!receipt || !transactionId) return;

    const now = new Date().toISOString();
    const updatedReceipt: Receipt = { ...receipt, lastPrintedAt: now };
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: receipt.artworkId,
      kind: "DOCUMENT",
      title: "영수증 인쇄",
      detail: `v${receipt.version} · ${formatMoney(
        receipt.amount,
        receipt.currency
      )}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: receipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transactionId!]: (s.receipts[transactionId!] ?? []).map((r) =>
          r.id === receipt!.id ? updatedReceipt : r
        ),
      },
      timeline: {
        ...s.timeline,
        [receipt!.artworkId]: [
          ev,
          ...(s.timeline[receipt!.artworkId] ?? []),
        ],
      },
    }));
  },

  markReceiptPdfExported: (receiptId) => {
    const state = get();
    let receipt: Receipt | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.receipts)) {
      const r = list.find((x) => x.id === receiptId);
      if (r) {
        receipt = r;
        transactionId = txId;
        break;
      }
    }
    if (!receipt || !transactionId) return;

    const now = new Date().toISOString();
    const updatedReceipt: Receipt = { ...receipt, lastPdfExportedAt: now };
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: receipt.artworkId,
      kind: "DOCUMENT",
      title: "영수증 PDF 저장",
      detail: `v${receipt.version} · ${formatMoney(
        receipt.amount,
        receipt.currency
      )}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: receipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transactionId!]: (s.receipts[transactionId!] ?? []).map((r) =>
          r.id === receipt!.id ? updatedReceipt : r
        ),
      },
      timeline: {
        ...s.timeline,
        [receipt!.artworkId]: [
          ev,
          ...(s.timeline[receipt!.artworkId] ?? []),
        ],
      },
    }));
  },

  /**
   * "고객 발송 준비" — deliveryStatus="prepared" + 옵셔널 recipientContact
   * 메모 + timeline event. **외부 API 발송 0건** (사용자 spec 영구 정책).
   * 운영자가 외부 도구 (이메일 / 메신저 / 인쇄 후 직접 전달)로 후속 처리.
   */
  prepareReceiptForSend: (receiptId, recipientContact) => {
    const state = get();
    let receipt: Receipt | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.receipts)) {
      const r = list.find((x) => x.id === receiptId);
      if (r) {
        receipt = r;
        transactionId = txId;
        break;
      }
    }
    if (!receipt || !transactionId) return;

    const now = new Date().toISOString();
    const trimmed = recipientContact?.trim();
    const updatedReceipt: Receipt = {
      ...receipt,
      deliveryStatus: "prepared",
      preparedForSendAt: now,
      preparedForSendBy: actorLabel(state.currentRole),
      recipientContact:
        trimmed && trimmed.length > 0 ? trimmed : receipt.recipientContact,
    };
    const detailParts = [
      `v${receipt.version}`,
      `${formatMoney(receipt.amount, receipt.currency)}`,
      "발송 준비 완료",
    ];
    if (trimmed && trimmed.length > 0) {
      detailParts.push(`수신: ${trimmed}`);
    }
    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: receipt.artworkId,
      kind: "DOCUMENT",
      title: "영수증 고객 발송 준비",
      detail: detailParts.join(" · "),
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "receipt",
      relatedEntityId: receipt.id,
    };

    set((s) => ({
      receipts: {
        ...s.receipts,
        [transactionId!]: (s.receipts[transactionId!] ?? []).map((r) =>
          r.id === receipt!.id ? updatedReceipt : r
        ),
      },
      timeline: {
        ...s.timeline,
        [receipt!.artworkId]: [
          ev,
          ...(s.timeline[receipt!.artworkId] ?? []),
        ],
      },
    }));
  },

  // ============================================================================
  // STEP 89 — Tax Invoice (전자세금계산서 운영 record)
  //
  // **수동 발행 기본** — 사업자만 대상이므로 Receipt와 달리 Payment cascade
  // 자동 생성 0건. 운영자가 TransactionSummary CTA에서 명시적 발행.
  //
  // **rule_4 lifecycle**: DRAFT (편집 가능) → ISSUED (LOCK + finalizedAt) →
  //   createTaxInvoiceVersion으로 새 DRAFT fork.
  //
  // **STEP 86 anchor 두 번째 사용처** — Receipt 패턴 정확 재사용.
  // ============================================================================

  openTaxInvoiceDetail: (taxInvoiceId) =>
    set({ taxInvoiceDetailRequest: { kind: "open", taxInvoiceId } }),

  closeTaxInvoiceDetail: () =>
    set({ taxInvoiceDetailRequest: { kind: "closed" } }),

  createTaxInvoice: (input) => {
    const state = get();
    const { invoiceId, vatBasis = "vat_inclusive" } = input;

    // Lookup linked Invoice + Transaction + Artwork
    let invoice: Invoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.invoices)) {
      const i = list.find((x) => x.id === invoiceId);
      if (i) {
        invoice = i;
        transactionId = txId;
        break;
      }
    }
    if (!invoice || !transactionId) return null;

    let tx: Transaction | undefined;
    for (const txList of Object.values(state.transactions)) {
      const t = txList.find((x) => x.id === transactionId);
      if (t) {
        tx = t;
        break;
      }
    }
    if (!tx) return null;

    // VAT 계산 — vatBasis에 따라 (한국 갤러리 retail 표준은 vat_inclusive)
    const invoiceAmount = invoice.amount;
    let amount: number;
    let vatAmount: number;
    let totalAmount: number;
    if (vatBasis === "tax_exempt") {
      amount = invoiceAmount;
      vatAmount = 0;
      totalAmount = invoiceAmount;
    } else if (vatBasis === "vat_exclusive") {
      amount = invoiceAmount;
      vatAmount = Math.round(invoiceAmount * 0.1);
      totalAmount = amount + vatAmount;
    } else {
      // vat_inclusive (default for Korean galleries)
      amount = Math.round(invoiceAmount / 1.1);
      vatAmount = invoiceAmount - amount;
      totalAmount = invoiceAmount;
    }

    // Optional latest receipt for chain reference
    const latestReceipt = state.receipts[transactionId]?.[0];

    const now = new Date().toISOString();
    const newTaxInvoice: TaxInvoice = {
      id: genId("tax-inv"),
      invoiceId: invoice.id,
      receiptId: input.receiptId ?? latestReceipt?.id,
      transactionId,
      artworkId: tx.artworkId,
      // (customerId omitted — Invoice doesn't track customer directly.
      //  Future STEP can resolve via tx.inquiryId → inquiry.collectorId.)
      amount,
      vatAmount,
      totalAmount,
      currency: invoice.currency,
      status: "DRAFT",
      businessType: input.businessType ?? "business",
      memo: input.memo,
      issuedAt: now,
      version: 1,
      parentTaxInvoiceId: null,
      lockedAt: null,
      isLocked: false,
      generatedBy: actorLabel(state.currentRole),
      sourceContext: "manual",
      deliveryStatus: "not_prepared",
      externalSyncStatus: "not_synced",
    };

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 생성",
      detail: `v1 · ${formatMoney(totalAmount, newTaxInvoice.currency)} (공급가액 ${formatMoney(amount, newTaxInvoice.currency)} + VAT ${formatMoney(vatAmount, newTaxInvoice.currency)})`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: newTaxInvoice.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: [
          newTaxInvoice,
          ...(s.taxInvoices[transactionId!] ?? []),
        ],
      },
      timeline: {
        ...s.timeline,
        [tx!.artworkId]: [ev, ...(s.timeline[tx!.artworkId] ?? [])],
      },
      taxInvoiceDetailRequest: {
        kind: "open",
        taxInvoiceId: newTaxInvoice.id,
      },
    }));

    return newTaxInvoice.id;
  },

  updateTaxInvoiceDraft: (taxInvoiceId, updates) => {
    const state = get();
    let target: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === taxInvoiceId);
      if (ti) {
        target = ti;
        transactionId = txId;
        break;
      }
    }
    if (!target || !transactionId) return;
    // ISSUED는 LOCK이라 무시 (rule_4)
    if (target.status !== "DRAFT" || target.isLocked) return;

    const updated: TaxInvoice = {
      ...target,
      amount: updates.amount ?? target.amount,
      vatAmount: updates.vatAmount ?? target.vatAmount,
      totalAmount: updates.totalAmount ?? target.totalAmount,
      businessType: updates.businessType ?? target.businessType,
      memo: updates.memo !== undefined ? updates.memo : target.memo,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: (s.taxInvoices[transactionId!] ?? []).map((ti) =>
          ti.id === target!.id ? updated : ti
        ),
      },
    }));
  },

  issueTaxInvoice: (taxInvoiceId) => {
    const state = get();
    let target: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === taxInvoiceId);
      if (ti) {
        target = ti;
        transactionId = txId;
        break;
      }
    }
    if (!target || !transactionId) return;
    if (target.status === "ISSUED" || target.isLocked) return;

    const now = new Date().toISOString();
    const updated: TaxInvoice = {
      ...target,
      status: "ISSUED",
      finalizedAt: now,
      lockedAt: now,
      isLocked: true,
      lockedBy: actorLabel(state.currentRole),
    };

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: target.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 발행 완료",
      detail: `v${target.version} · ${formatMoney(target.totalAmount, target.currency)} · LOCK`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: target.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: (s.taxInvoices[transactionId!] ?? []).map((ti) =>
          ti.id === target!.id ? updated : ti
        ),
      },
      timeline: {
        ...s.timeline,
        [target!.artworkId]: [ev, ...(s.timeline[target!.artworkId] ?? [])],
      },
    }));
  },

  createTaxInvoiceVersion: (parentTaxInvoiceId, revisionReason) => {
    const state = get();
    let parent: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === parentTaxInvoiceId);
      if (ti) {
        parent = ti;
        transactionId = txId;
        break;
      }
    }
    if (!parent || !transactionId) return null;
    // Parent must be ISSUED + LOCKED (rule_4 — only forks from finalized version)
    if (!parent.isLocked) return null;

    const now = new Date().toISOString();
    const newTaxInvoice: TaxInvoice = {
      ...parent,
      id: genId("tax-inv"),
      status: "DRAFT",
      version: parent.version + 1,
      parentTaxInvoiceId: parent.id,
      lockedAt: null,
      isLocked: false,
      finalizedAt: undefined,
      lockedBy: undefined,
      issuedAt: now,
      revisionReason,
      generatedBy: actorLabel(state.currentRole),
      sourceContext: "manual",
      // Reset print/send/sync metadata for new version
      lastPrintedAt: undefined,
      lastPdfExportedAt: undefined,
      deliveryStatus: "not_prepared",
      preparedForSendAt: undefined,
      preparedForSendBy: undefined,
      recipientContact: undefined,
      sentAt: undefined,
      sentBy: undefined,
      sentChannel: undefined,
      externalSyncStatus: "not_synced",
      syncedAt: undefined,
      externalReferenceId: undefined,
    };

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: parent.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 새 버전 생성",
      detail: `v${parent.version} → v${newTaxInvoice.version}${revisionReason ? ` · ${revisionReason}` : ""}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: newTaxInvoice.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: [
          newTaxInvoice,
          ...(s.taxInvoices[transactionId!] ?? []),
        ],
      },
      timeline: {
        ...s.timeline,
        [parent!.artworkId]: [ev, ...(s.timeline[parent!.artworkId] ?? [])],
      },
    }));

    return newTaxInvoice.id;
  },

  markTaxInvoicePrinted: (taxInvoiceId) => {
    const state = get();
    let target: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === taxInvoiceId);
      if (ti) {
        target = ti;
        transactionId = txId;
        break;
      }
    }
    if (!target || !transactionId) return;

    const now = new Date().toISOString();
    const updated: TaxInvoice = { ...target, lastPrintedAt: now };

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: target.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 인쇄",
      detail: `v${target.version} · 인쇄 시점 기록`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: target.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: (s.taxInvoices[transactionId!] ?? []).map((ti) =>
          ti.id === target!.id ? updated : ti
        ),
      },
      timeline: {
        ...s.timeline,
        [target!.artworkId]: [ev, ...(s.timeline[target!.artworkId] ?? [])],
      },
    }));
  },

  markTaxInvoicePdfExported: (taxInvoiceId) => {
    const state = get();
    let target: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === taxInvoiceId);
      if (ti) {
        target = ti;
        transactionId = txId;
        break;
      }
    }
    if (!target || !transactionId) return;

    const now = new Date().toISOString();
    const updated: TaxInvoice = { ...target, lastPdfExportedAt: now };

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: target.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 PDF 저장",
      detail: `v${target.version} · 운영 record`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: target.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: (s.taxInvoices[transactionId!] ?? []).map((ti) =>
          ti.id === target!.id ? updated : ti
        ),
      },
      timeline: {
        ...s.timeline,
        [target!.artworkId]: [ev, ...(s.timeline[target!.artworkId] ?? [])],
      },
    }));
  },

  prepareTaxInvoiceForSend: (taxInvoiceId, recipientContact) => {
    const state = get();
    let target: TaxInvoice | undefined;
    let transactionId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxInvoices)) {
      const ti = list.find((x) => x.id === taxInvoiceId);
      if (ti) {
        target = ti;
        transactionId = txId;
        break;
      }
    }
    if (!target || !transactionId) return;

    const now = new Date().toISOString();
    const trimmed = recipientContact?.trim();
    const updated: TaxInvoice = {
      ...target,
      deliveryStatus: "prepared",
      preparedForSendAt: now,
      preparedForSendBy: actorLabel(state.currentRole),
      recipientContact:
        trimmed && trimmed.length > 0 ? trimmed : target.recipientContact,
    };

    const detailParts = [
      `v${target.version}`,
      formatMoney(target.totalAmount, target.currency),
      "발송 준비 완료",
    ];
    if (trimmed && trimmed.length > 0) {
      detailParts.push(`수신: ${trimmed}`);
    }

    const ev: TimelineEvent = {
      id: genId("ev"),
      artworkId: target.artworkId,
      kind: "DOCUMENT",
      title: "세금계산서 고객 발송 준비",
      detail: detailParts.join(" · "),
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax_invoice",
      relatedEntityId: target.id,
    };

    set((s) => ({
      taxInvoices: {
        ...s.taxInvoices,
        [transactionId!]: (s.taxInvoices[transactionId!] ?? []).map((ti) =>
          ti.id === target!.id ? updated : ti
        ),
      },
      timeline: {
        ...s.timeline,
        [target!.artworkId]: [ev, ...(s.timeline[target!.artworkId] ?? [])],
      },
    }));
  },

  // --- Settlement (rule_3, rule_12 — internal distribution) -----------------
  openSettlementDetail: (settlementId) =>
    set({ settlementDetailRequest: { kind: "open", settlementId } }),

  closeSettlementDetail: () =>
    set({ settlementDetailRequest: { kind: "closed" } }),

  /**
   * Manual fallback for the rare case where Payment cascade did not produce
   * a Settlement (e.g. seeded historical data without one). Computes total
   * from RECEIVED payments and applies the v1 60/40 split.
   */
  createSettlement: (transactionId) => {
    const state = get();

    // Locate transaction → artwork
    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === transactionId);
    if (!tx) return null;

    // Idempotent: if a settlement already exists, no-op.
    if ((state.settlements[transactionId] ?? []).length > 0) return null;

    // Sum RECEIVED payments for this transaction
    const txPayments = (state.payments[transactionId] ?? []).filter(
      (p) => p.status === "RECEIVED"
    );
    if (txPayments.length === 0) return null;

    const totalAmount = txPayments.reduce((sum, p) => sum + p.amount, 0);
    const currency = txPayments[0].currency;
    const { artistShare, galleryShare } = splitSettlement(totalAmount);

    // STEP 34 — FX reference. KRW 거래는 무관 (모든 fx* fields undefined).
    // 외화 거래는 같은 transaction의 locked invoice 중 가장 높은 version + 같은
    // currency를 선택하여 fxSnapshot read-only 참조. invoice가 없거나 fxSnapshot
    // 없으면 (KRW invoice / pre-STEP32 record / unknown pair fallback 등) 전부
    // undefined — Settlement 계산 흐름은 무영향.
    let fxReferenceInvoiceId: string | undefined;
    let fxRateUsed: number | undefined;
    let fxBaseCurrency: Currency | undefined;
    let fxQuoteCurrency: Currency | undefined;
    let convertedTotalKRW: number | undefined;

    if (currency !== "KRW") {
      const txInvoices = (state.invoices[transactionId] ?? []).filter(
        (inv) => inv.isLocked && inv.currency === currency && inv.fxSnapshot
      );
      // 가장 최신 version 선택 (createInvoiceVersion chain의 head)
      const latestLocked = txInvoices.length > 0
        ? txInvoices.reduce((acc, cur) =>
            cur.version > acc.version ? cur : acc
          )
        : undefined;
      if (latestLocked && latestLocked.fxSnapshot) {
        fxReferenceInvoiceId = latestLocked.id;
        fxRateUsed = latestLocked.fxSnapshot.rate;
        fxBaseCurrency = latestLocked.fxSnapshot.baseCurrency;
        fxQuoteCurrency = latestLocked.fxSnapshot.quoteCurrency;
        convertedTotalKRW = Math.round(totalAmount * fxRateUsed);
      }
    }

    const now = new Date().toISOString();
    const settlement: Settlement = {
      id: genId("stl"),
      transactionId,
      artworkId: tx.artworkId,
      totalAmount,
      artistShare,
      galleryShare,
      currency,
      status: "PENDING",
      // STEP 34 FX ref — KRW 거래 / pre-STEP32 invoice 등에서 모두 undefined
      fxReferenceInvoiceId,
      fxRateUsed,
      fxBaseCurrency,
      fxQuoteCurrency,
      convertedTotalKRW,
      createdAt: now,
      updatedAt: now,
    };

    // Timeline detail — FX 정보를 Audit / Export에서 자연 노출
    const fxDetailSuffix = fxReferenceInvoiceId && fxRateUsed
      ? ` · FX from Invoice ${fxReferenceInvoiceId} · ${fxBaseCurrency}/${fxQuoteCurrency} ${fxRateUsed.toLocaleString(
          "en-US",
          { maximumFractionDigits: 4 }
        )}`
      : "";

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "TRANSACTION",
      title: "Settlement 생성",
      detail: `${formatMoney(totalAmount, currency)} · 작가 ${formatMoney(
        artistShare,
        currency
      )} · 갤러리 ${formatMoney(galleryShare, currency)} · ${
        SETTLEMENT_STATUS_LABEL.PENDING
      }${fxDetailSuffix}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "settlement",
      relatedEntityId: settlement.id,
    };

    set((s) => ({
      settlements: {
        ...s.settlements,
        [transactionId]: [
          settlement,
          ...(s.settlements[transactionId] ?? []),
        ],
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));

    return settlement.id;
  },

  /**
   * Mark a Settlement as COMPLETED. Cascades:
   *   - Transaction PAID → SETTLED (rule_3, rule_6)
   *   - TaxRecord auto-created (PENDING, SALES_RECORD) — rule_3 accounting layer
   *
   * Settlement object itself is updated in place (status / settledAt). The
   * TaxRecord is a separate entity — never merged into Settlement (rule_3).
   * Artwork state is NOT auto-changed (rule_6 — operator controls CLOSED).
   */
  completeSettlement: (settlementId) => {
    const state = get();

    // RBAC guard (rule_7) — Owner only (final money distribution authority)
    if (!hasPermission(state.currentRole, "settlement.complete")) return;

    // Locate settlement
    let settlement: Settlement | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.settlements)) {
      const stl = list.find((s) => s.id === settlementId);
      if (stl) {
        settlement = stl;
        foundTxId = txId;
        break;
      }
    }
    if (!settlement || !foundTxId) return;
    if (settlement.status === "COMPLETED") return; // already done

    // Locate parent transaction → artwork
    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const artworkId = tx.artworkId;
    const now = new Date().toISOString();

    const updated: Settlement = {
      ...settlement,
      status: "COMPLETED",
      settledAt: now,
      updatedAt: now,
    };

    // Cascade Transaction PAID → SETTLED (only from PAID; respect off-flow)
    const willTransitionTransaction = tx.status === "PAID";
    const updatedTransaction: Transaction = willTransitionTransaction
      ? { ...tx, status: "SETTLED", updatedAt: now }
      : tx;

    // Auto-create TaxRecord (PENDING, SALES_RECORD) — rule_3 accounting layer
    // Only if no TaxRecord yet exists for this transaction (idempotent).
    const existingTax = (state.taxRecords[foundTxId] ?? [])[0];
    let newTaxRecord: TaxRecord | null = null;
    let taxCreatedEvent: TimelineEvent | null = null;
    if (!existingTax) {
      const { vatAmount, withholdingAmount } = splitTax(updated.totalAmount);
      newTaxRecord = {
        id: genId("tax"),
        transactionId: tx.id,
        artworkId,
        settlementId: updated.id,
        taxableAmount: updated.totalAmount,
        vatAmount,
        withholdingAmount,
        currency: updated.currency,
        status: "PENDING",
        taxType: "SALES_RECORD",
        createdAt: now,
        updatedAt: now,
      };
      taxCreatedEvent = {
        id: genId("ev"),
        artworkId,
        kind: "TRANSACTION",
        title: "TaxRecord 자동 생성",
        detail: `${TAX_TYPE_LABEL.SALES_RECORD} · 과세 ${formatMoney(
          newTaxRecord.taxableAmount,
          newTaxRecord.currency
        )} · VAT ${formatMoney(vatAmount, newTaxRecord.currency)} · ${
          TAX_RECORD_STATUS_LABEL.PENDING
        }`,
        at: now,
        actor: "System",
        relatedEntityType: "tax",
        relatedEntityId: newTaxRecord.id,
      };
    }

    const settlementEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "TRANSACTION",
      title: "Settlement 완료",
      detail: `${formatMoney(
        updated.totalAmount,
        updated.currency
      )} 분배 완료 · 작가 ${formatMoney(
        updated.artistShare,
        updated.currency
      )} · 갤러리 ${formatMoney(updated.galleryShare, updated.currency)}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "settlement",
      relatedEntityId: settlementId,
    };

    const txEvent: TimelineEvent | null = willTransitionTransaction
      ? {
          id: genId("ev"),
          artworkId,
          kind: "TRANSACTION",
          title: "Transaction 상태 변경",
          detail: `${TRANSACTION_STATUS_LABEL.PAID} → ${TRANSACTION_STATUS_LABEL.SETTLED}`,
          at: now,
          actor: "System",
          relatedEntityType: "transaction",
          relatedEntityId: tx.id,
        }
      : null;

    set((s) => ({
      settlements: {
        ...s.settlements,
        [foundTxId!]: (s.settlements[foundTxId!] ?? []).map((stl) =>
          stl.id === settlementId ? updated : stl
        ),
      },
      transactions: willTransitionTransaction
        ? {
            ...s.transactions,
            [artworkId]: (s.transactions[artworkId] ?? []).map((t) =>
              t.id === tx.id ? updatedTransaction : t
            ),
          }
        : s.transactions,
      taxRecords: newTaxRecord
        ? {
            ...s.taxRecords,
            [foundTxId!]: [
              newTaxRecord!,
              ...(s.taxRecords[foundTxId!] ?? []),
            ],
          }
        : s.taxRecords,
      timeline: {
        ...s.timeline,
        [artworkId]: [
          ...(taxCreatedEvent ? [taxCreatedEvent] : []),
          ...(txEvent ? [txEvent] : []),
          settlementEvent,
          ...(s.timeline[artworkId] ?? []),
        ],
      },
    }));
  },

  // --- Tax (rule_3 — accounting layer, separate from Payment / Settlement) --
  openTaxDetail: (taxRecordId) =>
    set({ taxDetailRequest: { kind: "open", taxRecordId } }),

  closeTaxDetail: () => set({ taxDetailRequest: { kind: "closed" } }),

  /**
   * Manual fallback: create a TaxRecord from a COMPLETED Settlement when the
   * automatic cascade did not fire (e.g. seeded historical data). The new
   * record is PENDING, taxType=SALES_RECORD, VAT computed at 10%.
   */
  createTaxRecord: (settlementId) => {
    const state = get();

    // Locate settlement → transaction → artwork
    let settlement: Settlement | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.settlements)) {
      const stl = list.find((s) => s.id === settlementId);
      if (stl) {
        settlement = stl;
        foundTxId = txId;
        break;
      }
    }
    if (!settlement || !foundTxId) return null;
    // Idempotent: one TaxRecord per transaction in v1.
    if ((state.taxRecords[foundTxId] ?? []).length > 0) return null;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return null;

    const now = new Date().toISOString();
    const { vatAmount, withholdingAmount } = splitTax(settlement.totalAmount);

    // STEP 34 — FX reference propagate from Settlement (read-only).
    // Settlement에 fx ref가 없으면 (KRW 거래 등) 모든 fx* 필드 undefined.
    const taxableAmountKRW =
      settlement.convertedTotalKRW !== undefined
        ? settlement.convertedTotalKRW
        : undefined;

    const taxRecord: TaxRecord = {
      id: genId("tax"),
      transactionId: tx.id,
      artworkId: tx.artworkId,
      settlementId: settlement.id,
      taxableAmount: settlement.totalAmount,
      vatAmount,
      withholdingAmount,
      currency: settlement.currency,
      status: "PENDING",
      taxType: "SALES_RECORD",
      // STEP 34 FX ref propagate
      taxableAmountKRW,
      fxReferenceInvoiceId: settlement.fxReferenceInvoiceId,
      fxRateUsed: settlement.fxRateUsed,
      createdAt: now,
      updatedAt: now,
    };

    // Timeline detail — FX 정보 자연 노출 (audit / export 자동 호환)
    const fxDetailSuffix =
      settlement.fxReferenceInvoiceId && settlement.fxRateUsed
        ? ` · FX from Invoice ${settlement.fxReferenceInvoiceId} · ${settlement.fxBaseCurrency}/${settlement.fxQuoteCurrency} ${settlement.fxRateUsed.toLocaleString(
            "en-US",
            { maximumFractionDigits: 4 }
          )}`
        : "";

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "TRANSACTION",
      title: "TaxRecord 생성",
      detail: `${TAX_TYPE_LABEL.SALES_RECORD} · 과세 ${formatMoney(
        taxRecord.taxableAmount,
        taxRecord.currency
      )} · VAT ${formatMoney(vatAmount, taxRecord.currency)} · ${
        TAX_RECORD_STATUS_LABEL.PENDING
      }${fxDetailSuffix}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "tax",
      relatedEntityId: taxRecord.id,
    };

    set((s) => ({
      taxRecords: {
        ...s.taxRecords,
        [foundTxId!]: [taxRecord, ...(s.taxRecords[foundTxId!] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));

    return taxRecord.id;
  },

  /**
   * Mark a TaxRecord as ISSUED — final accounting step. Sets issuedAt and
   * emits a Living Timeline event. No further cascade — TaxRecord is the
   * terminal node in the rule_3 chain.
   */
  issueTaxRecord: (taxRecordId) => {
    const state = get();

    // RBAC guard (rule_7) — Owner only (final accounting record)
    if (!hasPermission(state.currentRole, "tax.issue")) return;

    // Locate tax record
    let taxRecord: TaxRecord | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.taxRecords)) {
      const tr = list.find((t) => t.id === taxRecordId);
      if (tr) {
        taxRecord = tr;
        foundTxId = txId;
        break;
      }
    }
    if (!taxRecord || !foundTxId) return;
    if (taxRecord.status === "ISSUED") return; // already issued

    // Locate artwork (for timeline)
    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const now = new Date().toISOString();
    const updated: TaxRecord = {
      ...taxRecord,
      status: "ISSUED",
      issuedAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "TRANSACTION",
      title: "TaxRecord 발행 완료",
      detail: `${TAX_TYPE_LABEL[updated.taxType]} · VAT ${formatMoney(
        updated.vatAmount,
        updated.currency
      )} · ${TAX_RECORD_STATUS_LABEL.ISSUED}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "tax",
      relatedEntityId: taxRecordId,
    };

    set((s) => ({
      taxRecords: {
        ...s.taxRecords,
        [foundTxId!]: (s.taxRecords[foundTxId!] ?? []).map((tr) =>
          tr.id === taxRecordId ? updated : tr
        ),
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));
  },

  // --- Contract (rule_4 — Document Trust, rule_5 — AI-Human loop) -----------
  openContractDetail: (contractId) =>
    set({ contractDetailRequest: { kind: "open", contractId } }),

  closeContractDetail: () =>
    set({ contractDetailRequest: { kind: "closed" } }),

  /**
   * Create a new DRAFT Contract. Pre-fills content with an AI-generated
   * template based on artwork + transaction context (rule_5). v1: one
   * contract chain per transaction at a time — no-op if any non-LOCKED
   * version already exists. Use createContractVersion() to fork from a
   * LOCKED parent.
   */
  createContract: (transactionId) => {
    const state = get();

    // Locate transaction → artwork
    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === transactionId);
    if (!tx) return null;

    const artwork = state.artworks.find((a) => a.id === tx.artworkId);
    if (!artwork) return null;

    // Idempotent: don't create a parallel chain. If any contract exists for
    // this transaction (regardless of status), refuse — operator must use
    // createContractVersion() to fork from a LOCKED predecessor instead.
    if ((state.contracts[transactionId] ?? []).length > 0) return null;

    const now = new Date().toISOString();
    const content = generateContractDraftContent({
      artistName: artwork.artist.name,
      artworkTitle: artwork.title,
      axidCode: artwork.axid.code,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
      buyerName: tx.buyerName,
      agreedPrice: tx.agreedPrice,
      currency: tx.currency,
    });

    const contract: Contract = {
      id: genId("ctr"),
      transactionId: tx.id,
      artworkId: artwork.id,
      version: 1,
      parentContractId: null,
      content,
      status: "DRAFT",
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: artwork.id,
      kind: "DOCUMENT",
      title: "Contract 생성",
      detail: `v${contract.version} · AI 초안 생성 · ${
        CONTRACT_STATUS_LABEL.DRAFT
      }`,
      at: now,
      actor: "AXVELA AI",
      relatedEntityType: "contract",
      relatedEntityId: contract.id,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [tx.id]: [contract, ...(s.contracts[tx.id] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artwork.id]: [event, ...(s.timeline[artwork.id] ?? [])],
      },
    }));

    return contract.id;
  },

  /**
   * Patch the editable `content` of a DRAFT contract. Silently no-ops on
   * REVIEW / APPROVED / LOCKED (rule_4 — only DRAFTs are editable).
   */
  updateContract: (contractId, content) => {
    const state = get();

    let foundCtr: Contract | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.contracts)) {
      const ctr = list.find((c) => c.id === contractId);
      if (ctr) {
        foundCtr = ctr;
        foundTxId = txId;
        break;
      }
    }
    if (!foundCtr || !foundTxId) return;
    if (foundCtr.status !== "DRAFT") return; // immutable beyond DRAFT

    // No-op if content unchanged
    if (foundCtr.content === content) return;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const now = new Date().toISOString();
    const updated: Contract = {
      ...foundCtr,
      content,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "Contract 수정",
      detail: `v${updated.version} · 본문 수정`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [foundTxId!]: (s.contracts[foundTxId!] ?? []).map((c) =>
          c.id === contractId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));
  },

  /**
   * Submit a DRAFT contract for staff review (DRAFT → REVIEW). The content
   * becomes read-only at this stage; further edits require approveContract
   * to be reverted (not implemented in v1) or createContractVersion after lock.
   */
  submitContractForReview: (contractId) => {
    const state = get();

    let foundCtr: Contract | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.contracts)) {
      const ctr = list.find((c) => c.id === contractId);
      if (ctr) {
        foundCtr = ctr;
        foundTxId = txId;
        break;
      }
    }
    if (!foundCtr || !foundTxId) return;
    if (foundCtr.status !== "DRAFT") return;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const now = new Date().toISOString();
    const updated: Contract = {
      ...foundCtr,
      status: "REVIEW",
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "Contract 검토 요청",
      detail: `v${updated.version} · ${CONTRACT_STATUS_LABEL.DRAFT} → ${CONTRACT_STATUS_LABEL.REVIEW}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [foundTxId!]: (s.contracts[foundTxId!] ?? []).map((c) =>
          c.id === contractId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));
  },

  /**
   * Approve a contract under review (REVIEW → APPROVED). No-ops otherwise.
   * The contract is still not locked — operator must explicitly call
   * lockContract() to make it immutable (rule_4 — separate approval and lock).
   */
  approveContract: (contractId) => {
    const state = get();

    // RBAC guard (rule_7) — silent no-op + UI hint, no timeline pollution
    if (!hasPermission(state.currentRole, "contract.approve")) return;

    let foundCtr: Contract | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.contracts)) {
      const ctr = list.find((c) => c.id === contractId);
      if (ctr) {
        foundCtr = ctr;
        foundTxId = txId;
        break;
      }
    }
    if (!foundCtr || !foundTxId) return;
    if (foundCtr.status !== "REVIEW") return;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const now = new Date().toISOString();
    const updated: Contract = {
      ...foundCtr,
      status: "APPROVED",
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "Contract 승인",
      detail: `v${updated.version} · ${CONTRACT_STATUS_LABEL.REVIEW} → ${CONTRACT_STATUS_LABEL.APPROVED}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [foundTxId!]: (s.contracts[foundTxId!] ?? []).map((c) =>
          c.id === contractId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));
  },

  /**
   * Lock an approved contract (APPROVED → LOCKED). Immutable thereafter —
   * any modification requires createContractVersion() (rule_4).
   */
  lockContract: (contractId) => {
    const state = get();

    // RBAC guard (rule_7) — Owner only
    if (!hasPermission(state.currentRole, "contract.lock")) return;

    let foundCtr: Contract | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.contracts)) {
      const ctr = list.find((c) => c.id === contractId);
      if (ctr) {
        foundCtr = ctr;
        foundTxId = txId;
        break;
      }
    }
    if (!foundCtr || !foundTxId) return;
    if (foundCtr.status !== "APPROVED") return;

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return;

    const now = new Date().toISOString();
    const updated: Contract = {
      ...foundCtr,
      status: "LOCKED",
      lockedAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "Contract LOCK",
      detail: `v${updated.version} · ${CONTRACT_STATUS_LABEL.APPROVED} → ${CONTRACT_STATUS_LABEL.LOCKED} · 이후 수정 불가`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [foundTxId!]: (s.contracts[foundTxId!] ?? []).map((c) =>
          c.id === contractId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));
  },

  /**
   * Fork a LOCKED Contract into a new DRAFT version (rule_4 versioning).
   * The previous version remains untouched. The new version copies content
   * with version+1 and parentContractId pointing to the source. Drawer is
   * re-targeted to the new draft so editing continues seamlessly.
   */
  createContractVersion: (parentContractId) => {
    const state = get();

    let parent: Contract | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.contracts)) {
      const ctr = list.find((c) => c.id === parentContractId);
      if (ctr) {
        parent = ctr;
        foundTxId = txId;
        break;
      }
    }
    if (!parent || !foundTxId) return null;
    if (parent.status !== "LOCKED") return null; // only fork from locked

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === foundTxId);
    if (!tx) return null;

    const now = new Date().toISOString();
    const newContract: Contract = {
      id: genId("ctr"),
      transactionId: parent.transactionId,
      artworkId: parent.artworkId,
      version: parent.version + 1,
      parentContractId: parent.id,
      content: parent.content,
      status: "DRAFT",
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "DOCUMENT",
      title: "Contract 새 버전 생성",
      detail: `v${parent.version} → v${newContract.version} · ${CONTRACT_STATUS_LABEL.DRAFT}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "contract",
      relatedEntityId: newContract.id,
    };

    set((s) => ({
      contracts: {
        ...s.contracts,
        [foundTxId!]: [newContract, ...(s.contracts[foundTxId!] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
      // Re-target drawer to new draft so editing continues seamlessly
      contractDetailRequest: { kind: "open", contractId: newContract.id },
    }));

    return newContract.id;
  },

  // --- Logistics (rule_21 — physical artwork delivery) ---------------------
  openLogisticsDetail: (logisticsId) =>
    set({ logisticsDetailRequest: { kind: "open", logisticsId } }),

  closeLogisticsDetail: () =>
    set({ logisticsDetailRequest: { kind: "closed" } }),

  /**
   * Create a new Logistics record (READY_FOR_PICKUP, empty fields).
   * Idempotent: silently no-ops if any logistics already exists for the tx.
   */
  createLogistics: (transactionId) => {
    const state = get();

    const tx = Object.values(state.transactions)
      .flat()
      .find((t) => t.id === transactionId);
    if (!tx) return null;

    // One logistics per transaction in v1
    if ((state.logistics[transactionId] ?? []).length > 0) return null;

    const now = new Date().toISOString();
    const logistics: Logistics = {
      id: genId("log"),
      artworkId: tx.artworkId,
      transactionId: tx.id,
      status: "READY_FOR_PICKUP",
      carrierName: "",
      trackingNumber: "",
      pickupDate: "",
      deliveryDate: "",
      memo: "",
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: tx.artworkId,
      kind: "TRANSACTION",
      title: "Logistics 생성",
      detail: `${LOGISTICS_STATUS_LABEL.READY_FOR_PICKUP} · 운송사 미지정`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "logistics",
      relatedEntityId: logistics.id,
    };

    set((s) => ({
      logistics: {
        ...s.logistics,
        [tx.id]: [logistics, ...(s.logistics[tx.id] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [tx.artworkId]: [event, ...(s.timeline[tx.artworkId] ?? [])],
      },
    }));

    return logistics.id;
  },

  /**
   * Patch non-status fields on a Logistics record. No timeline event for
   * silent metadata edits — only status changes (via updateLogisticsStatus)
   * earn a timeline event. Silent no-op if patch contains no actual changes.
   */
  updateLogistics: (logisticsId, patch) => {
    const state = get();

    let foundLog: Logistics | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.logistics)) {
      const log = list.find((l) => l.id === logisticsId);
      if (log) {
        foundLog = log;
        foundTxId = txId;
        break;
      }
    }
    if (!foundLog || !foundTxId) return;

    // STEP 15 — immutability guard (rule_4).
    // Once delivery is confirmed, carrier / tracking / dates / memo become
    // audit data and are no longer mutable. Silent no-op + no timeline event.
    if (isLogisticsLocked(foundLog.status)) return;

    // Detect actual changes
    const merged = { ...foundLog, ...patch };
    const hasChanges =
      merged.carrierName !== foundLog.carrierName ||
      merged.trackingNumber !== foundLog.trackingNumber ||
      merged.pickupDate !== foundLog.pickupDate ||
      merged.deliveryDate !== foundLog.deliveryDate ||
      merged.memo !== foundLog.memo;
    if (!hasChanges) return;

    const now = new Date().toISOString();
    const updated: Logistics = {
      ...merged,
      updatedAt: now,
    };

    set((s) => ({
      logistics: {
        ...s.logistics,
        [foundTxId!]: (s.logistics[foundTxId!] ?? []).map((l) =>
          l.id === logisticsId ? updated : l
        ),
      },
    }));
  },

  /**
   * Transition Logistics status — emits a "배송 상태 변경" timeline event.
   * Silent no-op if status unchanged. Used both manually (drawer) and via
   * cascade from createConditionReport (AFTER_DELIVERY → CONDITION_CHECKED).
   */
  updateLogisticsStatus: (logisticsId, newStatus) => {
    const state = get();

    let foundLog: Logistics | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.logistics)) {
      const log = list.find((l) => l.id === logisticsId);
      if (log) {
        foundLog = log;
        foundTxId = txId;
        break;
      }
    }
    if (!foundLog || !foundTxId) return;
    if (foundLog.status === newStatus) return;

    // STEP 15 — immutability guard (rule_4).
    // DELIVERED and CONDITION_CHECKED are terminal: status cannot be reverted
    // or further mutated via the manual action. The legitimate
    // DELIVERED → CONDITION_CHECKED transition happens via the inline cascade
    // in createConditionReport (AFTER_DELIVERY), which uses set() directly
    // and therefore bypasses this guard intentionally.
    if (isLogisticsLocked(foundLog.status)) return;

    const prevStatus = foundLog.status;
    const now = new Date().toISOString();
    const updated: Logistics = {
      ...foundLog,
      status: newStatus,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundLog.artworkId,
      kind: "TRANSACTION",
      title: "배송 상태 변경",
      detail: `${LOGISTICS_STATUS_LABEL[prevStatus]} → ${LOGISTICS_STATUS_LABEL[newStatus]}`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "logistics",
      relatedEntityId: logisticsId,
    };

    set((s) => ({
      logistics: {
        ...s.logistics,
        [foundTxId!]: (s.logistics[foundTxId!] ?? []).map((l) =>
          l.id === logisticsId ? updated : l
        ),
      },
      timeline: {
        ...s.timeline,
        [foundLog.artworkId]: [event, ...(s.timeline[foundLog.artworkId] ?? [])],
      },
    }));
  },

  // STEP 50 — Logistics Provider Sync (rule_21 외부 hook).
  //
  // Mock LogisticsProvider 호출 결과를 record의 옵셔널 provider 필드로 patch.
  // 정책 분기 (사용자 spec):
  //   - DELIVERED / CONDITION_CHECKED record: silent no-op (immutable rule_4)
  //   - provider 실패 (null 반환): silent fallback — timeline 오염 0
  //   - trackingNumber / carrierName: 빈 값일 때만 채움 (operator 입력 보존)
  //   - status 자동 전환: forward-only non-locking 만 — READY_FOR_PICKUP →
  //     IN_TRANSIT 단 1개 경로. DELIVERED / CONDITION_CHECKED는 operator
  //     명시 필요 (rule_5 + rule_6)
  syncLogisticsFromProvider: (logisticsId) => {
    const state = get();

    // 1. Find logistics record + parent transaction id
    let foundLog: Logistics | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.logistics)) {
      const log = list.find((l) => l.id === logisticsId);
      if (log) {
        foundLog = log;
        foundTxId = txId;
        break;
      }
    }
    if (!foundLog || !foundTxId) return;

    // 2. Immutability guard (rule_4) — silent no-op
    if (isLogisticsLocked(foundLog.status)) return;

    // 3. Provider call — failure 격리. null 반환 시 silent fallback.
    const result = fetchLogisticsSync({
      logisticsId: foundLog.id,
      artworkId: foundLog.artworkId,
      transactionId: foundLog.transactionId,
      currentStatus: foundLog.status,
      trackingNumber: foundLog.trackingNumber,
      carrierName: foundLog.carrierName,
      createdAt: foundLog.createdAt,
    });
    if (!result) return; // silent — timeline 오염 0

    // 4. Patch policy:
    //    - provider 메타데이터: 항상 set (sync 시점 audit)
    //    - trackingNumber / carrierName: 빈 값일 때만 채움 (operator 보존)
    //    - status 자동 전환: forward-only non-locking 만 적용
    const now = new Date().toISOString();

    let nextStatus = foundLog.status;
    let statusChanged = false;
    if (
      foundLog.status === "READY_FOR_PICKUP" &&
      result.suggestedStatus === "IN_TRANSIT"
    ) {
      nextStatus = "IN_TRANSIT";
      statusChanged = true;
    }
    // 다른 모든 suggestedStatus는 무시 — DELIVERED / CONDITION_CHECKED는 operator
    // 명시 필요. 동일 status 재추천도 무시.

    const fillTracking =
      foundLog.trackingNumber.trim() === "" && result.trackingId.trim() !== "";
    const fillCarrier =
      foundLog.carrierName.trim() === "" && result.carrierName.trim() !== "";

    const updated: Logistics = {
      ...foundLog,
      status: nextStatus,
      trackingNumber: fillTracking
        ? result.trackingId
        : foundLog.trackingNumber,
      carrierName: fillCarrier ? result.carrierName : foundLog.carrierName,
      providerLastSyncedAt: result.fetchedAt,
      providerId: result.providerId,
      providerIsMock: result.isMock,
      providerNote: result.providerNote,
      providerEstimatedDelivery: result.estimatedDelivery,
      updatedAt: now,
    };

    // 5. Timeline event — kind "TRANSACTION" (기존 logistics 이벤트 컨벤션 일관)
    //    NOTE: TimelineEventKind에 "LOGISTICS" 미정의 — 기존 패턴 그대로.
    const detailParts: string[] = ["Provider 동기화"];
    if (statusChanged) {
      detailParts.push(
        `${LOGISTICS_STATUS_LABEL[foundLog.status]} → ${LOGISTICS_STATUS_LABEL[nextStatus]}`
      );
    } else {
      detailParts.push(
        `${LOGISTICS_STATUS_LABEL[foundLog.status]} 유지`
      );
    }
    detailParts.push(result.providerNote);
    if (result.isMock) detailParts.push("mock provider");
    const detail = detailParts.join(" · ");

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundLog.artworkId,
      kind: "TRANSACTION",
      title: "Logistics provider sync",
      detail,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "logistics",
      relatedEntityId: foundLog.id,
    };

    set((s) => ({
      logistics: {
        ...s.logistics,
        [foundTxId!]: (s.logistics[foundTxId!] ?? []).map((l) =>
          l.id === logisticsId ? updated : l
        ),
      },
      timeline: {
        ...s.timeline,
        [foundLog!.artworkId]: [
          event,
          ...(s.timeline[foundLog!.artworkId] ?? []),
        ],
      },
    }));
  },

  /**
   * STEP 58 — Bulk provider sync orchestrator. 본 액션은 단순히 per-record
   * `syncLogisticsFromProvider`를 호출해 각자의 흐름 (provider call + state
   * patch + timeline event)을 그대로 사용. 한 record 실패해도 다음 진행.
   *
   * **Pre-classification** — 호출 전에 locked / unlocked 분리해서 카운트.
   * locked는 syncLogisticsFromProvider가 silent no-op이라 호출자가 결과를
   * 알 수 없음 → 본 wrapper에서 미리 분류.
   *
   * **failed 카운트 추정** — provider가 null 반환 시 syncLogisticsFromProvider
   * 가 silent return하므로 외부에서 직접 알 수 없음. 호출 전후 logistics record
   * 의 `providerLastSyncedAt` / `updatedAt`을 비교해 변경 여부 추정.
   */
  bulkSyncLogisticsFromProvider: (logisticsIds) => {
    const beforeState = get();

    // 1. Locked 분류 (skip count)
    const lookup = new Map<string, Logistics>();
    for (const list of Object.values(beforeState.logistics)) {
      for (const log of list) lookup.set(log.id, log);
    }

    let skipped = 0;
    const candidates: string[] = [];
    for (const id of logisticsIds) {
      const log = lookup.get(id);
      if (!log) {
        // record not found — failed로 분류
        continue;
      }
      if (isLogisticsLocked(log.status)) {
        skipped += 1;
        continue;
      }
      candidates.push(id);
    }

    // 2. 후보 record들 sync 호출. 결과는 호출 후 record 변경 여부로 판단.
    let ok = 0;
    let failed = 0;
    for (const id of candidates) {
      const before = lookup.get(id);
      if (!before) {
        failed += 1;
        continue;
      }
      // syncLogisticsFromProvider 호출 — 자체 흐름 (timeline / patch / locked guard)
      get().syncLogisticsFromProvider(id);

      // 호출 후 state 재조회. providerLastSyncedAt 갱신 여부로 성공 판단.
      const afterState = get();
      let after: Logistics | undefined;
      for (const list of Object.values(afterState.logistics)) {
        const found = list.find((l) => l.id === id);
        if (found) {
          after = found;
          break;
        }
      }
      if (
        after &&
        after.providerLastSyncedAt &&
        after.providerLastSyncedAt !== before.providerLastSyncedAt
      ) {
        ok += 1;
      } else {
        failed += 1;
      }
    }

    // record not found도 failed에 포함
    failed += logisticsIds.length - skipped - candidates.length;

    return { ok, skipped, failed };
  },

  // --- Condition Reports (rule_4 — trust documents) ------------------------
  openConditionReportCreate: (logisticsId, reportType) =>
    set({
      conditionReportRequest: { kind: "create", logisticsId, reportType },
    }),

  openConditionReportEdit: (reportId) =>
    set({ conditionReportRequest: { kind: "edit", reportId } }),

  closeConditionReport: () =>
    set({ conditionReportRequest: { kind: "closed" } }),

  /**
   * Create a new ConditionReport. v1: one BEFORE_SHIPMENT + one AFTER_DELIVERY
   * per logistics maximum (idempotent). If reportType=AFTER_DELIVERY and the
   * parent logistics is currently DELIVERED, the logistics is auto-cascaded
   * to CONDITION_CHECKED with its own status timeline event.
   */
  createConditionReport: (input) => {
    const state = get();

    // Locate parent logistics
    let parentLog: Logistics | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.logistics)) {
      const log = list.find((l) => l.id === input.logisticsId);
      if (log) {
        parentLog = log;
        foundTxId = txId;
        break;
      }
    }
    if (!parentLog || !foundTxId) return null;

    // Idempotent: refuse duplicate (same logistics + reportType)
    const existing = (state.conditionReports[foundTxId] ?? []).find(
      (r) =>
        r.logisticsId === parentLog!.id && r.reportType === input.reportType
    );
    if (existing) return null;

    const now = new Date().toISOString();
    const report: ConditionReport = {
      id: genId("rep"),
      logisticsId: parentLog.id,
      artworkId: parentLog.artworkId,
      transactionId: parentLog.transactionId,
      reportType: input.reportType,
      conditionStatus: input.conditionStatus,
      notes: input.notes,
      imagePlaceholder: input.imagePlaceholder ?? "",
      createdAt: now,
      updatedAt: now,
    };

    const reportEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId: parentLog.artworkId,
      kind: "DOCUMENT",
      title: "Condition Report 생성",
      detail: `${REPORT_TYPE_LABEL[report.reportType]} · ${
        CONDITION_STATUS_LABEL[report.conditionStatus]
      }`,
      at: now,
      actor: "Manager · J. Han",
      relatedEntityType: "condition_report",
      relatedEntityId: report.id,
    };

    // Cascade: AFTER_DELIVERY on DELIVERED logistics → CONDITION_CHECKED
    const willCascadeStatus =
      input.reportType === "AFTER_DELIVERY" && parentLog.status === "DELIVERED";

    const cascadedLogistics: Logistics | null = willCascadeStatus
      ? { ...parentLog, status: "CONDITION_CHECKED", updatedAt: now }
      : null;

    const cascadeEvent: TimelineEvent | null = willCascadeStatus
      ? {
          id: genId("ev"),
          artworkId: parentLog.artworkId,
          kind: "TRANSACTION",
          title: "배송 상태 변경",
          detail: `${LOGISTICS_STATUS_LABEL.DELIVERED} → ${LOGISTICS_STATUS_LABEL.CONDITION_CHECKED}`,
          at: now,
          actor: "System",
          relatedEntityType: "logistics",
          relatedEntityId: parentLog.id,
        }
      : null;

    set((s) => ({
      conditionReports: {
        ...s.conditionReports,
        [foundTxId!]: [
          report,
          ...(s.conditionReports[foundTxId!] ?? []),
        ],
      },
      logistics: cascadedLogistics
        ? {
            ...s.logistics,
            [foundTxId!]: (s.logistics[foundTxId!] ?? []).map((l) =>
              l.id === parentLog!.id ? cascadedLogistics : l
            ),
          }
        : s.logistics,
      timeline: {
        ...s.timeline,
        [parentLog!.artworkId]: [
          ...(cascadeEvent ? [cascadeEvent] : []),
          reportEvent,
          ...(s.timeline[parentLog!.artworkId] ?? []),
        ],
      },
    }));

    return report.id;
  },

  /**
   * Patch fields on an existing ConditionReport. Silent no-op if patch
   * yields no actual changes. Emits a "Condition Report 업데이트" event.
   */
  /**
   * @deprecated STEP 15 — silent no-op.
   *
   * ConditionReport is immutable post-create (rule_4 Document Trust). This
   * action is preserved in the interface for backward compatibility with
   * pre-STEP-15 callers, but does nothing. To revise an assessment, use
   * `createConditionReportCorrection` which preserves the original record
   * and creates a new one with `correctsReportId` set.
   */
  updateConditionReport: (_reportId, _patch) => {
    return;
  },

  /**
   * STEP 15 — Issue a correction for an existing ConditionReport.
   * The original is preserved unchanged; a new report is appended to the
   * same logistics with `correctsReportId` pointing at the original.
   */
  createConditionReportCorrection: (originalReportId, input) => {
    const state = get();

    // Locate original report + parent transactionId
    let originalReport: ConditionReport | undefined;
    let foundTxId: string | undefined;
    for (const [txId, list] of Object.entries(state.conditionReports)) {
      const r = list.find((rep) => rep.id === originalReportId);
      if (r) {
        originalReport = r;
        foundTxId = txId;
        break;
      }
    }
    if (!originalReport || !foundTxId) return null;

    const now = new Date().toISOString();
    const correction: ConditionReport = {
      id: genId("rep"),
      logisticsId: originalReport.logisticsId,
      artworkId: originalReport.artworkId,
      transactionId: originalReport.transactionId,
      reportType: originalReport.reportType,
      conditionStatus: input.conditionStatus,
      notes: input.notes,
      imagePlaceholder: input.imagePlaceholder ?? "",
      correctsReportId: originalReportId,
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: originalReport.artworkId,
      kind: "DOCUMENT",
      title: "Condition Report 수정본 생성",
      detail: `${REPORT_TYPE_LABEL[correction.reportType]} · ${
        CONDITION_STATUS_LABEL[correction.conditionStatus]
      } · 원본: ${originalReportId}`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "condition_report",
      relatedEntityId: correction.id,
    };

    set((s) => ({
      conditionReports: {
        ...s.conditionReports,
        [foundTxId!]: [
          correction,
          ...(s.conditionReports[foundTxId!] ?? []),
        ],
      },
      timeline: {
        ...s.timeline,
        [originalReport!.artworkId]: [
          event,
          ...(s.timeline[originalReport!.artworkId] ?? []),
        ],
      },
    }));

    return correction.id;
  },

  // ==========================================================================
  // STEP 16 — AI Layer (rule_18) Implementation
  // ==========================================================================
  // Pattern reference: createContract / approveContract / lockContract chain.
  // Differences from Contract:
  //   - Curation은 Artwork에 직접 종속 (rule_1) — transactionId 필드 없음
  //   - 3-stage (DRAFT → APPROVED → LOCKED) — REVIEW 단계 없음 (법적 문서 아님)
  //   - LOCK 권한이 OWNER가 아닌 MANAGER (Contract.lock과 의도적 차등)
  //
  // Inquiry 응대는 Inquiry 객체 자체에 인라인 필드 (responseDraft / responseStatus
  // 등)로 저장. 별도 도메인 객체를 만들지 않음 — version chain 불필요한 단일
  // 텍스트이며, Inquiry 단위의 일회성 응대이기 때문.
  // ==========================================================================

  // --- Curation Drawer overlay --------------------------------------------
  openCurationDraft: (artworkId) =>
    set({ curationDraftRequest: { kind: "open", artworkId } }),
  closeCurationDraft: () =>
    set({ curationDraftRequest: { kind: "closed" } }),

  // --- Curation actions ---------------------------------------------------
  createCurationNote: (artworkId) => {
    const state = get();

    // RBAC (rule_7) — silent no-op on permission failure.
    if (!hasPermission(state.currentRole, "curation.create")) return null;

    const artwork = state.artworks.find((a) => a.id === artworkId);
    if (!artwork) return null;

    // Idempotent: if any non-LOCKED CurationNote exists, return its id rather
    // than creating a parallel chain. To make a successor of a LOCKED note,
    // operator must use createCurationVersion() explicitly (rule_4).
    const existing = state.curationNotes[artworkId] ?? [];
    const liveDraft = existing.find(
      (c) => c.status === "DRAFT" || c.status === "APPROVED"
    );
    if (liveDraft) return liveDraft.id;

    // Determine version number — chains continue from the previous LOCKED.
    const prevLocked = existing.find((c) => c.status === "LOCKED");
    const nextVersion = prevLocked ? prevLocked.version + 1 : 1;
    const parentId = prevLocked?.id ?? null;

    const now = new Date().toISOString();
    const draft = generateCurationDraftContent({
      artistName: artwork.artist.name,
      artistNameEn: artwork.artist.nameEn,
      artworkTitle: artwork.title,
      axidCode: artwork.axid.code,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
    });

    const note: CurationNote = {
      id: genId("cur"),
      artworkId: artwork.id,
      version: nextVersion,
      parentCurationId: parentId,
      headline: draft.headline,
      subheadline: draft.subheadline,
      body: draft.body,
      status: "DRAFT",
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: artwork.id,
      kind: "DOCUMENT",
      title: "큐레이션 노트 생성",
      detail: `v${note.version} · AI 초안 생성 · ${
        CURATION_STATUS_LABEL.DRAFT
      }`,
      at: now,
      actor: "AXVELA AI",
      relatedEntityType: "curation",
      relatedEntityId: artwork.id,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [artwork.id]: [note, ...(s.curationNotes[artwork.id] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artwork.id]: [event, ...(s.timeline[artwork.id] ?? [])],
      },
    }));

    return note.id;
  },

  updateCurationNote: (curationId, patch) => {
    const state = get();
    if (!hasPermission(state.currentRole, "curation.update")) return;

    let foundNote: CurationNote | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.curationNotes)) {
      const n = list.find((c) => c.id === curationId);
      if (n) {
        foundNote = n;
        foundArtId = artId;
        break;
      }
    }
    if (!foundNote || !foundArtId) return;

    // rule_4 — only DRAFT is editable. APPROVED/LOCKED는 silent no-op.
    if (foundNote.status !== "DRAFT") return;

    // Determine actually-changed fields (avoid noise updates).
    const willChangeHeadline =
      patch.headline !== undefined && patch.headline !== foundNote.headline;
    const willChangeSubheadline =
      patch.subheadline !== undefined &&
      patch.subheadline !== foundNote.subheadline;
    const willChangeBody =
      patch.body !== undefined && patch.body !== foundNote.body;

    if (!willChangeHeadline && !willChangeSubheadline && !willChangeBody) {
      return;
    }

    const now = new Date().toISOString();
    const updated: CurationNote = {
      ...foundNote,
      headline: willChangeHeadline ? patch.headline! : foundNote.headline,
      subheadline: willChangeSubheadline
        ? patch.subheadline!
        : foundNote.subheadline,
      body: willChangeBody ? patch.body! : foundNote.body,
      updatedAt: now,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [foundArtId!]: (s.curationNotes[foundArtId!] ?? []).map((c) =>
          c.id === curationId ? updated : c
        ),
      },
    }));
  },

  regenerateCurationDraft: (curationId) => {
    const state = get();
    if (!hasPermission(state.currentRole, "curation.update")) return;

    let foundNote: CurationNote | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.curationNotes)) {
      const n = list.find((c) => c.id === curationId);
      if (n) {
        foundNote = n;
        foundArtId = artId;
        break;
      }
    }
    if (!foundNote || !foundArtId) return;
    if (foundNote.status !== "DRAFT") return; // rule_4

    const artwork = state.artworks.find((a) => a.id === foundArtId);
    if (!artwork) return;

    const now = new Date().toISOString();
    const fresh = generateCurationDraftContent({
      artistName: artwork.artist.name,
      artistNameEn: artwork.artist.nameEn,
      artworkTitle: artwork.title,
      axidCode: artwork.axid.code,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
    });

    const updated: CurationNote = {
      ...foundNote,
      headline: fresh.headline,
      subheadline: fresh.subheadline,
      body: fresh.body,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: artwork.id,
      kind: "DOCUMENT",
      title: "큐레이션 노트 AI 재생성",
      detail: `v${foundNote.version} · 초안 재생성`,
      at: now,
      actor: "AXVELA AI",
      relatedEntityType: "curation",
      relatedEntityId: artwork.id,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [foundArtId!]: (s.curationNotes[foundArtId!] ?? []).map((c) =>
          c.id === curationId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [artwork.id]: [event, ...(s.timeline[artwork.id] ?? [])],
      },
    }));
  },

  approveCurationNote: (curationId) => {
    const state = get();
    if (!hasPermission(state.currentRole, "curation.approve")) return;

    let foundNote: CurationNote | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.curationNotes)) {
      const n = list.find((c) => c.id === curationId);
      if (n) {
        foundNote = n;
        foundArtId = artId;
        break;
      }
    }
    if (!foundNote || !foundArtId) return;
    if (foundNote.status !== "DRAFT") return;

    const now = new Date().toISOString();
    const updated: CurationNote = {
      ...foundNote,
      status: "APPROVED",
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundArtId,
      kind: "DOCUMENT",
      title: "큐레이션 노트 승인",
      detail: `v${foundNote.version} · ${CURATION_STATUS_LABEL.DRAFT} → ${
        CURATION_STATUS_LABEL.APPROVED
      }`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "curation",
      relatedEntityId: foundArtId,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [foundArtId!]: (s.curationNotes[foundArtId!] ?? []).map((c) =>
          c.id === curationId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [foundArtId!]: [event, ...(s.timeline[foundArtId!] ?? [])],
      },
    }));
  },

  lockCurationNote: (curationId) => {
    const state = get();
    if (!hasPermission(state.currentRole, "curation.lock")) return;

    let foundNote: CurationNote | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.curationNotes)) {
      const n = list.find((c) => c.id === curationId);
      if (n) {
        foundNote = n;
        foundArtId = artId;
        break;
      }
    }
    if (!foundNote || !foundArtId) return;
    if (foundNote.status !== "APPROVED") return;

    const now = new Date().toISOString();
    const updated: CurationNote = {
      ...foundNote,
      status: "LOCKED",
      lockedAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundArtId,
      kind: "DOCUMENT",
      title: "큐레이션 노트 LOCK",
      detail: `v${foundNote.version} · 잠금 (영구 보존)`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "curation",
      relatedEntityId: foundArtId,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [foundArtId!]: (s.curationNotes[foundArtId!] ?? []).map((c) =>
          c.id === curationId ? updated : c
        ),
      },
      timeline: {
        ...s.timeline,
        [foundArtId!]: [event, ...(s.timeline[foundArtId!] ?? [])],
      },
    }));
  },

  createCurationVersion: (parentCurationId) => {
    const state = get();
    if (!hasPermission(state.currentRole, "curation.create_version")) {
      return null;
    }

    let parent: CurationNote | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.curationNotes)) {
      const n = list.find((c) => c.id === parentCurationId);
      if (n) {
        parent = n;
        foundArtId = artId;
        break;
      }
    }
    if (!parent || !foundArtId) return null;
    if (parent.status !== "LOCKED") return null;

    // Refuse if a non-LOCKED descendant already exists (no parallel chains).
    const list = state.curationNotes[foundArtId] ?? [];
    const liveAhead = list.find(
      (c) => c.status === "DRAFT" || c.status === "APPROVED"
    );
    if (liveAhead) return liveAhead.id;

    const artwork = state.artworks.find((a) => a.id === foundArtId);
    if (!artwork) return null;

    const now = new Date().toISOString();
    const draft = generateCurationDraftContent({
      artistName: artwork.artist.name,
      artistNameEn: artwork.artist.nameEn,
      artworkTitle: artwork.title,
      axidCode: artwork.axid.code,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
    });

    const successor: CurationNote = {
      id: genId("cur"),
      artworkId: artwork.id,
      version: parent.version + 1,
      parentCurationId: parent.id,
      headline: draft.headline,
      subheadline: draft.subheadline,
      body: draft.body,
      status: "DRAFT",
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: artwork.id,
      kind: "DOCUMENT",
      title: "큐레이션 노트 새 버전",
      detail: `v${successor.version} · AI 초안 재생성 (이전 v${parent.version}는 영구 보존)`,
      at: now,
      actor: "AXVELA AI",
      relatedEntityType: "curation",
      relatedEntityId: artwork.id,
    };

    set((s) => ({
      curationNotes: {
        ...s.curationNotes,
        [foundArtId!]: [successor, ...(s.curationNotes[foundArtId!] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artwork.id]: [event, ...(s.timeline[artwork.id] ?? [])],
      },
    }));

    return successor.id;
  },

  // --- Inquiry Response Drawer overlay ------------------------------------
  openInquiryResponse: (inquiryId) =>
    set({ inquiryResponseRequest: { kind: "open", inquiryId } }),
  closeInquiryResponse: () =>
    set({ inquiryResponseRequest: { kind: "closed" } }),

  // --- Inquiry Response actions -------------------------------------------
  generateInquiryResponse: (inquiryId) => {
    const state = get();
    if (!hasPermission(state.currentRole, "inquiry.generate_response")) return;

    let foundInquiry: Inquiry | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.inquiries)) {
      const i = list.find((q) => q.id === inquiryId);
      if (i) {
        foundInquiry = i;
        foundArtId = artId;
        break;
      }
    }
    if (!foundInquiry || !foundArtId) return;

    // rule_4 — once SENT, response is immutable. Re-generation is forbidden;
    // operator must create a new Inquiry to start fresh correspondence.
    if (foundInquiry.responseStatus === "SENT") return;

    const artwork = state.artworks.find((a) => a.id === foundArtId);
    if (!artwork) return;

    const now = new Date().toISOString();
    const draftBody = generateInquiryResponseDraft({
      collectorName: foundInquiry.collectorName,
      artistName: artwork.artist.name,
      artworkTitle: artwork.title,
      inquiryType: foundInquiry.inquiryType,
      message: foundInquiry.message,
      priceKRW: artwork.priceKRW,
    });

    const wasFirstGeneration = foundInquiry.responseStatus === undefined;

    const updated: Inquiry = {
      ...foundInquiry,
      responseDraft: draftBody,
      responseStatus: "DRAFT",
      responseGeneratedAt: now,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundArtId,
      kind: "INQUIRY",
      title: wasFirstGeneration
        ? "AI 응대 초안 생성"
        : "AI 응대 초안 재생성",
      detail: `${foundInquiry.collectorName.trim() || "(컬렉터 미지정)"} · ${
        foundInquiry.inquiryType
      }`,
      at: now,
      actor: "AXVELA AI",
      relatedEntityType: "inquiry_response",
      relatedEntityId: inquiryId,
    };

    set((s) => ({
      inquiries: {
        ...s.inquiries,
        [foundArtId!]: (s.inquiries[foundArtId!] ?? []).map((q) =>
          q.id === inquiryId ? updated : q
        ),
      },
      timeline: {
        ...s.timeline,
        [foundArtId!]: [event, ...(s.timeline[foundArtId!] ?? [])],
      },
    }));
  },

  sendInquiryResponse: (inquiryId, finalText) => {
    const state = get();
    if (!hasPermission(state.currentRole, "inquiry.send_response")) return;

    const trimmed = finalText.trim();
    if (trimmed.length === 0) return; // 빈 응답 발송 거부

    let foundInquiry: Inquiry | undefined;
    let foundArtId: string | undefined;
    for (const [artId, list] of Object.entries(state.inquiries)) {
      const i = list.find((q) => q.id === inquiryId);
      if (i) {
        foundInquiry = i;
        foundArtId = artId;
        break;
      }
    }
    if (!foundInquiry || !foundArtId) return;

    // 발송은 DRAFT 상태에서만. SENT 재발송 / 미생성 발송 금지.
    if (foundInquiry.responseStatus !== "DRAFT") return;

    const now = new Date().toISOString();
    const updated: Inquiry = {
      ...foundInquiry,
      responseDraft: finalText,
      responseStatus: "SENT",
      respondedAt: now,
      // OPEN → RESPONDED cascade. 다른 status (ESCALATED, ON_HOLD 등)는 보존.
      status:
        foundInquiry.status === "OPEN" ? "RESPONDED" : foundInquiry.status,
      updatedAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId: foundArtId,
      kind: "INQUIRY",
      title: "Inquiry 응대 발송",
      detail: `${foundInquiry.collectorName.trim() || "(컬렉터 미지정)"} · ${
        foundInquiry.status === "OPEN" ? "응대 대기 → 응대 완료" : "응대 추가"
      }`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
      relatedEntityType: "inquiry_response",
      relatedEntityId: inquiryId,
    };

    set((s) => ({
      inquiries: {
        ...s.inquiries,
        [foundArtId!]: (s.inquiries[foundArtId!] ?? []).map((q) =>
          q.id === inquiryId ? updated : q
        ),
      },
      timeline: {
        ...s.timeline,
        [foundArtId!]: [event, ...(s.timeline[foundArtId!] ?? [])],
      },
    }));
  },

  // ==========================================================================
  // STEP 18 — AI Price Suggestion (rule_18 (c))
  // ==========================================================================
  // Deterministic helper. Generate는 artwork.priceKRW를 변경하지 않으며,
  // apply도 form-side helper일 뿐 — 실제 가격 변경은 form 저장 시 updateArtwork
  // 흐름이 담당한다 (rule_5 AI-Human Loop · 인간이 최종 결정).

  generatePriceSuggestionForArtwork: (artworkId) => {
    const state = get();

    // RBAC guard (rule_7)
    if (!hasPermission(state.currentRole, "price_suggestion.generate"))
      return null;

    const artwork = state.artworks.find((a) => a.id === artworkId);
    if (!artwork) return null;

    // Aggregate the artwork's transactions (across all tx-keyed slices).
    const artworkTxs = state.transactions[artworkId] ?? [];
    const txIds = artworkTxs.map((t) => t.id);

    // Aggregate the artwork's payments — payments are tx-keyed, flatten the
    // ones tied to *this* artwork's transactions only.
    const artworkPayments = txIds.flatMap(
      (txId) => state.payments[txId] ?? []
    );

    // Tier 3 fallback signal — gallery median across all artworks with priceKRW > 0.
    const galleryMedian = computeGalleryMedianPriceKRW(state.artworks);

    // STEP 19 — Market signals (internal v1). External provider 미활성 →
    // 모든 신호 internal source. provider 한 번 호출, suggestion sourceRefs로 누적.
    const marketSignals = gatherMarketSignals({
      artworkId,
      artistName: artwork.artist.name,
      allArtworks: state.artworks,
      allTransactions: state.transactions,
      allPayments: state.payments,
      allInquiries: state.inquiries,
    });

    const now = new Date().toISOString();
    const body = generatePriceSuggestion(
      artwork,
      artworkTxs,
      artworkPayments,
      galleryMedian,
      marketSignals
    );

    const suggestion: PriceSuggestion = {
      ...body,
      id: genId("psg"),
      createdAt: now,
    };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "DOCUMENT",
      title: "AXVELA AI 가격 제안 생성",
      detail: `${formatMoney(suggestion.suggestedLow, suggestion.currency)} ~ ${formatMoney(
        suggestion.suggestedHigh,
        suggestion.currency
      )} · 신뢰도 ${(suggestion.confidence * 100).toFixed(0)}%`,
      at: now,
      actor: "AXVELA AI",
      // 본 STEP에서는 PriceSuggestion 전용 viewer drawer 없음 — relatedEntity
      // ref 미설정으로 audit 카드는 비-clickable. 향후 PriceSuggestionDrawer
      // 도입 시 TimelineEntityType에 "price_suggestion" 추가하고 ref 채움.
    };

    set((s) => ({
      priceSuggestions: {
        ...s.priceSuggestions,
        [artworkId]: [suggestion, ...(s.priceSuggestions[artworkId] ?? [])],
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));

    return suggestion.id;
  },

  applyPriceSuggestion: (artworkId, suggestionId) => {
    const state = get();

    // RBAC guard
    if (!hasPermission(state.currentRole, "price_suggestion.apply")) return;

    const list = state.priceSuggestions[artworkId] ?? [];
    const target = list.find((s) => s.id === suggestionId);
    if (!target) return;

    // Idempotent: 이미 applied된 경우 silent no-op (timeline noise 방지).
    if (target.appliedAt) return;

    const now = new Date().toISOString();
    const updated: PriceSuggestion = { ...target, appliedAt: now };

    const event: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "DOCUMENT",
      title: "AI 가격 제안 적용",
      detail: `Mid 가격 ${formatMoney(
        target.suggestedMid,
        target.currency
      )}을 작품 편집 폼에 반영. 저장 시 artwork.priceKRW 갱신.`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
    };

    set((s) => ({
      priceSuggestions: {
        ...s.priceSuggestions,
        [artworkId]: (s.priceSuggestions[artworkId] ?? []).map((sg) =>
          sg.id === suggestionId ? updated : sg
        ),
      },
      timeline: {
        ...s.timeline,
        [artworkId]: [event, ...(s.timeline[artworkId] ?? [])],
      },
    }));
  },

  // ==========================================================================
  // STEP 20 — Audit Log overlay (rule_7 + rule_8 follow-through)
  // ==========================================================================
  // 단순 open/close — 기존 timeline 슬라이스를 그대로 재사용. 신규 데이터
  // 슬라이스도, 신규 store 액션도 없음. 분류·필터링은 모두 lib/audit-helpers의
  // 순수 함수가 담당. RBAC 게이트도 없음 (read-only audit view).

  openAuditLog: (artworkId) =>
    set({ auditLogRequest: { kind: "open", artworkId } }),
  closeAuditLog: () => set({ auditLogRequest: { kind: "closed" } }),

  // STEP 23 — Cross-artwork Audit. RBAC 가드 (rule_7) — 권한 부족 시 silent
  // no-op. Sidebar 진입점이 disabled + hint이므로 정상 흐름에서는 도달 안 함.
  openGlobalAudit: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "audit.view_global")) return;
    set({ globalAuditRequest: { kind: "open" } });
  },
  closeGlobalAudit: () => set({ globalAuditRequest: { kind: "closed" } }),

  // STEP 35 — Multi-currency Reporting. RBAC 가드 (rule_7) — Manager 이상.
  // 운영 참고용 리포트 — 회계 확정 / 세무 신고 권한 아님 (UI 라벨에서 명시).
  // 데이터 source는 invoices / settlements / taxRecords slice를 read-only로
  // 사용 — 도메인 로직 0줄 변경, pure presentation.
  openReporting: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "report.view_global")) return;
    set({ reportingRequest: { kind: "open" } });
  },
  closeReporting: () => set({ reportingRequest: { kind: "closed" } }),

  // STEP 51 — Documents Hub. RBAC 가드 (Reporting과 같은 권한).
  // read-only 검색이지만 갤러리 전체 문서를 보는 권한이 필요 → Manager 이상.
  openDocuments: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "report.view_global")) return;
    set({ documentsRequest: { kind: "open" } });
  },
  closeDocuments: () => set({ documentsRequest: { kind: "closed" } }),

  // STEP 54 — Logistics Operations View. RBAC: Manager+ (Reporting / Documents
  // 와 같은 `report.view_global` 권한). 갤러리 전체 logistics + 컨텍스트를 한
  // 화면에서 KPI / 필터 / 검색하는 1급 운영 view. read-only — 신규 생성/편집
  // 0건, row 클릭은 기존 LogisticsDetailDrawer 재사용.
  openLogisticsOperations: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "report.view_global")) return;
    set({ logisticsOperationsRequest: { kind: "open" } });
  },
  closeLogisticsOperations: () =>
    set({ logisticsOperationsRequest: { kind: "closed" } }),

  // STEP 62 — Image Cleanup Admin Tool. OWNER 전용 RBAC.
  // 외부 저장소 inspection + orphan candidate review + remove request UI.
  openImageCleanup: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "image.cleanup_review")) return;
    set({ imageCleanupRequest: { kind: "open" } });
  },
  closeImageCleanup: () =>
    set({ imageCleanupRequest: { kind: "closed" } }),

  // STEP 65 — System Audit Log Layer impls.
  // 별도 localStorage 키 `axvela.audit.v1` (audit-log-storage.ts) — PersistedState
  // 무관. hydrate은 PersistenceProvider mount 시 1회.

  hydrateAuditEvents: () => {
    const events = loadAuditLog();
    set({ auditEvents: events });
  },

  appendAuditEvent: (input) => {
    const state = get();
    const event: SystemAuditEvent = {
      id: genId("aud"),
      createdAt: new Date().toISOString(),
      actorRole: state.currentRole,
      actorLabel: actorLabel(state.currentRole),
      ...input,
    };
    const nextList = appendAuditEventToList(state.auditEvents, event);
    set({ auditEvents: nextList });
    // localStorage 즉시 반영 — UI 외 reload 후에도 보존
    saveAuditLog(nextList);
    // STEP 84 — 저장 결과 신호 폴링 + system audit 발행. 무한 loop 차단은
    // emitSystemAuditSignal의 3-layer guard가 담당:
    //   1. Re-entry guard — 본 emit이 또 appendAuditEvent를 호출해 또 trim이
    //      발생할 가능성을 차단 (isEmitting 동기 flag).
    //   2. sessionOnce — system_audit_capped는 device 세션당 1회만.
    //   3. Cooldown 30초 — system_storage_save_failed는 spam 방지 (storage가
    //      반복 실패해도 30초당 1건만).
    // **정확성**: consume*Flag()는 read & reset이므로 같은 사건이 두 번 신호
    // 되지 않음. 두 신호는 독립이라 순서 무관.
    if (consumeAuditLogTrimFlag()) {
      emitSystemAuditSignal(
        "system_audit_capped",
        "warning",
        `운영 로그 cap 도달 — 가장 오래된 entry부터 자동 정리됨 (cap ${500}건)`,
        {
          sessionOnce: true,
          metadata: {
            cappedAt: new Date().toISOString(),
            maxEvents: 500,
          },
        }
      );
    }
    if (consumeAuditLogSaveFailFlag()) {
      emitSystemAuditSignal(
        "system_storage_save_failed",
        "warning",
        "운영 로그 저장 실패 — localStorage 접근 실패 (recoverable)",
        {
          cooldownMs: 30_000,
          metadata: {
            failedAt: new Date().toISOString(),
            storageKey: "axvela.audit.v1",
          },
        }
      );
    }
  },

  clearAuditEvents: () => {
    const state = get();
    // OWNER 전용 가드 — 권한 부족 시 silent no-op (timeline 오염 방지)
    if (!hasPermission(state.currentRole, "audit.view")) return;

    // localStorage 키 자체 제거
    clearAuditLogStorage();
    // 자기참조 entry 추가 — clear가 일어났음 자체를 기록 (transparent)
    const clearEvent: SystemAuditEvent = {
      id: genId("aud"),
      createdAt: new Date().toISOString(),
      actorRole: state.currentRole,
      actorLabel: actorLabel(state.currentRole),
      category: "system",
      action: "audit.clear",
      severity: "warning",
      message: "운영 로그 비움",
    };
    const nextList = [clearEvent];
    set({ auditEvents: nextList });
    saveAuditLog(nextList);
  },

  getAuditEventsByCategory: (category) => {
    const all = get().auditEvents;
    if (category === "all") return all;
    return all.filter((e) => e.category === category);
  },

  getRecentAuditEvents: (limit) => {
    if (limit <= 0) return [];
    return get().auditEvents.slice(0, limit);
  },

  openSystemAuditLog: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "audit.view")) return;
    set({ systemAuditLogRequest: { kind: "open" } });
  },

  closeSystemAuditLog: () =>
    set({ systemAuditLogRequest: { kind: "closed" } }),

  // STEP 67 — Drilldown open/close. 단순 — payload는 호출자가 declarative하게
  // 만들어 전달, drawer가 resolver로 흡수해 표 렌더.
  openDrilldown: (payload: DrilldownPayload) =>
    set({ drilldownRequest: { kind: "open", payload } }),
  closeDrilldown: () => set({ drilldownRequest: { kind: "closed" } }),

  // STEP 59 — Backup Reminder. 별도 localStorage 키에서 hydrate / mark.
  // PersistenceProvider mount 시 hydrateBackupMetadata() 1회 호출 → store 동기화.
  hydrateBackupMetadata: () => {
    const meta = loadBackupMetadata();
    set({ backupMetadata: { lastBackupAt: meta.lastBackupAt } });
  },
  markBackupCompleted: () => {
    const next = markBackupCompletedInStorage();
    set({ backupMetadata: { lastBackupAt: next.lastBackupAt } });
  },

  // STEP 41 — Collector View. RBAC 가드 (rule_7) — Manager 이상.
  // 갤러리 전체 컬렉터 (Inquiry.collectorName + Transaction.buyerName에서 derive).
  // 운영 참고용 — CRM 확정 등급 / 영구 마스터 데이터 권한 아님.
  openCollectorView: () => {
    const state = get();
    if (!hasPermission(state.currentRole, "collector.view_global")) return;
    set({
      collectorViewRequest: { kind: "open", selectedCollectorId: null },
    });
  },
  closeCollectorView: () =>
    set({ collectorViewRequest: { kind: "closed" } }),
  selectCollector: (collectorId) => {
    const state = get();
    if (state.collectorViewRequest.kind !== "open") return;
    set({
      collectorViewRequest: {
        kind: "open",
        selectedCollectorId: collectorId,
      },
    });
  },

  // STEP 45 — AI Market Analysis (rule_18 (b)). 단일 작품 분석 view 진입점.
  // **신규 도메인 store slice 0개 · 새 핵심 계산 0줄** — 분석 자체는 drawer
  // 내부에서 deterministic helper로 derive (priceSuggestions / market signals
  // 이 모두 read-only). 본 액션은 UI request 슬라이스만 set/unset.
  openMarketAnalysis: (artworkId) => {
    if (!artworkId) return;
    set({ marketAnalysisRequest: { kind: "open", artworkId } });
  },
  closeMarketAnalysis: () =>
    set({ marketAnalysisRequest: { kind: "closed" } }),

  // ==========================================================================
  // STEP 27 — Persistence Layer
  // ==========================================================================
  // PersistenceProvider가 mount 시 hydrateFromStorage()를, 매 store 변경 시
  // (debounced) save를 호출. 본 store는 adapter 인스턴스를 직접 알지 못하고,
  // hydrate / reset 액션을 통해서만 외부와 상호작용. 저장 자체는 provider가 담당.

  hydrateFromStorage: () => {
    const adapter = getActiveAdapter();
    const persisted = adapter.load();
    if (!persisted) return; // 저장된 데이터 없거나 invalid — mock data 그대로 유지

    set({
      artworks: persisted.artworks,
      timeline: persisted.timeline,
      inquiries: persisted.inquiries,
      transactions: persisted.transactions,
      invoices: persisted.invoices,
      payments: persisted.payments,
      // STEP 87 — receipts는 옵셔널 슬라이스 (PersistedState backward compat).
      // legacy 데이터에 receipts 부재 시 빈 객체로 fallback (forward-only policy).
      receipts: persisted.receipts ?? {},
      // STEP 89 — taxInvoices 옵셔널 슬라이스 (legacy v1 backward compat).
      taxInvoices: persisted.taxInvoices ?? {},
      settlements: persisted.settlements,
      taxRecords: persisted.taxRecords,
      contracts: persisted.contracts,
      curationNotes: persisted.curationNotes,
      logistics: persisted.logistics,
      conditionReports: persisted.conditionReports,
      priceSuggestions: persisted.priceSuggestions,
      // STEP 117 — artworkDraft 옵셔널 슬라이스 (legacy v1 backward compat).
      // legacy 데이터 (STEP 117 이전) 부재 시 undefined fallback. forward-only
      // policy — 빈 객체 fallback 부적절 (단일 record 의미).
      artworkDraft: persisted.artworkDraft,
    });
  },

  resetAllData: () => {
    const adapter = getActiveAdapter();
    adapter.clear();
    // STEP 59 — 백업 metadata도 함께 clear (사용자 시나리오: "초기화" 의도면
    // 백업 흔적도 함께 사라지는 것이 일관성 있음).
    clearBackupMetadata();

    set({
      // 도메인 슬라이스 — mock 재로드
      artworks: MOCK_ARTWORKS,
      timeline: MOCK_TIMELINE,
      inquiries: MOCK_INQUIRIES,
      transactions: MOCK_TRANSACTIONS,
      invoices: MOCK_INVOICES,
      payments: MOCK_PAYMENTS,
      receipts: {},
      taxInvoices: {},
      settlements: MOCK_SETTLEMENTS,
      taxRecords: MOCK_TAX_RECORDS,
      contracts: MOCK_CONTRACTS,
      curationNotes: MOCK_CURATION_NOTES,
      logistics: MOCK_LOGISTICS,
      conditionReports: MOCK_CONDITION_REPORTS,
      priceSuggestions: {},
      // STEP 117 — Reset 시 진행 중 임시 저장도 함께 clear (사용자가 "초기화"
      // 의도면 draft 잔존은 일관성에 어긋남).
      artworkDraft: undefined,

      // UI 슬라이스 — closed/default 복원
      selectedArtworkId: "art_002",
      query: "",
      stateFilter: "ALL",
      editor: { kind: "closed" },
      transitionRequest: { kind: "closed" },
      inquiryDetailRequest: { kind: "closed" },
      inquiryCreateRequest: { kind: "closed" },
      transactionDetailRequest: { kind: "closed" },
      invoiceDetailRequest: { kind: "closed" },
      receiptDetailRequest: { kind: "closed" },
      taxInvoiceDetailRequest: { kind: "closed" },
      fiscalSummaryRequest: { kind: "closed" },
      accountantExportRequest: { kind: "closed" },
      marketInsightRequest: { kind: "closed" },
      paymentRegisterRequest: { kind: "closed" },
      settlementDetailRequest: { kind: "closed" },
      taxDetailRequest: { kind: "closed" },
      contractDetailRequest: { kind: "closed" },
      logisticsDetailRequest: { kind: "closed" },
      conditionReportRequest: { kind: "closed" },
      curationDraftRequest: { kind: "closed" },
      inquiryResponseRequest: { kind: "closed" },
      auditLogRequest: { kind: "closed" },
      globalAuditRequest: { kind: "closed" },
      reportingRequest: { kind: "closed" },
      documentsRequest: { kind: "closed" },
      logisticsOperationsRequest: { kind: "closed" },
      imageCleanupRequest: { kind: "closed" },
      // STEP 65 — Reset 시 systemAuditLogRequest는 close.
      // **auditEvents 자체는 의도적으로 보존** — 시드 reset은 도메인 데이터를
      // 비우는 행위이지 운영 기록을 지우는 것은 아님. 사용자가 audit 자체를
      // 비우려면 OWNER 전용 clearAuditEvents를 별도 호출해야 함.
      systemAuditLogRequest: { kind: "closed" },
      // STEP 67 — Drilldown은 transient navigation — reset 시 close
      drilldownRequest: { kind: "closed" },
      // STEP 59 — reset 시 백업 metadata도 함께 clear (사용자가 "초기화" 의도면
      // 백업 흔적도 함께 지우는 것이 일관성). localStorage 측은 별도 helper에서 처리.
      backupMetadata: { lastBackupAt: null },
      collectorViewRequest: { kind: "closed" },
      marketAnalysisRequest: { kind: "closed" },

      // STEP 130 Phase 2 Commit 2 — Display locale 도 초기값 복귀.
      // 사용자 spec §9 항목 3 정합 — resetAllData 시 locale 도 DEFAULT_DOCUMENT_LOCALE
      // ("ko") baseline 으로 복귀. `currentRole` 의 reset 시 보존 정책과 의도적
      // 분리 — locale 은 UI 표시 선호도이므로 도메인 초기화와 함께 baseline 복귀가
      // 일관성 (운영자가 "초기화" 의도면 표시 언어도 갤러리 baseline 복귀가 자연).
      currentLocale: DEFAULT_DOCUMENT_LOCALE,

      // STEP 131 Phase 2 Commit 2 — ArtworkGrid Display Mode 도 baseline 복귀.
      // 사용자 §8 항목 6 정합 — default = "grid". currentLocale 패턴 답습
      // (도메인 초기화 시 UI 표시 선호도도 baseline 복귀 일관성).
      viewMode: "grid",
    });

    // STEP 81 — backup metadata clear audit. resetAllData가 도메인 데이터를
    // mock으로 되돌릴 때 백업 흔적(lastBackupAt)도 함께 사라지므로, 이 행위
    // 자체를 운영 기록에 transparent하게 남김. severity info — 의도된 사용자
    // 행동 (시드 reset). auditEvents 슬라이스는 set({...})에서 의도적으로
    // 제외되어 보존되므로 본 append가 자연 누적.
    get().appendAuditEvent({
      category: "backup",
      action: "backup_metadata_cleared",
      severity: "info",
      message: "백업 metadata clear — 시드 reset 동반",
      metadata: {
        clearedAt: new Date().toISOString(),
      },
    });
  },
}));
