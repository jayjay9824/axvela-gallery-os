// ============================================================================
// Document Trust Metadata — STEP 86 Foundation
//
// **본 파일이 정의하는 것**: AXVELA의 모든 *document-like entity*가 공유하는
// 표준 신뢰 metadata 모양 (`DocumentTrustMetadata` interface) + document type
// discriminator (`DocumentType`) + source context enum.
//
// **본 파일이 정의하지 *않는* 것**:
//   - Approval workflow 데이터 (STEP 101+)
//   - Reviewer / approver 식별 (STEP 101+)
//   - E-signature / 외부 인증 (out of scope, AXVELA_TRUST_LAYER §6.1)
//   - 법적 효력 / 공인 / compliance 단정 (out of scope, AI Direction)
//
// **핵심 설계 — view type, not stored shape**:
//   `DocumentTrustMetadata`는 *projection 타입*입니다. Invoice / Contract는
//   기존 schema (필드 이름이 도메인별로 다름 — `parentInvoiceId` /
//   `parentContractId` 등)를 그대로 유지하고, helper (`deriveInvoiceTrust` /
//   `deriveContractTrust` in `src/lib/document-trust.ts`)가 entity → 본
//   view를 *projection*합니다.
//
//   이로써:
//     - 기존 entity schema 변경 최소 (3 optional fields만 추가)
//     - 기존 데이터 100% 호환 (validateV1 / SCHEMA_VERSION 무영향)
//     - 미래 entity (Receipt / Tax Invoice / Certificate / Settlement Export)는
//       본 view shape을 직접 채택 가능
//     - Approval Workflow (STEP 101+)는 lockedBy / finalizedAt slot 위에 layer
//
// **Trust language 정책 (AXVELA_AI_DIRECTION + AXVELA_TRUST_LAYER 일관)**:
//   - 사용: "operational record" / "generated document" / "finalized version"
//     / "operational history" / "device-local activity"
//   - 금지: "legal guarantee" / "compliance verified" / "tamper-proof" /
//     "forensic record" / "certified document" / "법적 효력" / "공인 인증"
// ============================================================================

/**
 * 문서 종류 discriminator. 현재 실제 entity로 존재하는 것은 `INVOICE` /
 * `CONTRACT` 두 개. 나머지는 미래 STEP의 *예약 슬롯* — 본 enum에 등재됨으로써
 * future entity가 본 trust view shape에 자연 정착할 수 있는 anchor.
 *
 * **현재 정착**: INVOICE (STEP 7+) / CONTRACT (STEP 11+)
 * **미래 예약**:
 *   - RECEIPT          STEP 87 (Cash Receipt)
 *   - TAX_INVOICE      STEP 89 (전자세금계산서 운영 참고)
 *   - CERTIFICATE      STEP 90 (Certificate / Authenticity)
 *   - SETTLEMENT_EXPORT STEP 91 (Accountant Export package)
 */
export type DocumentType =
  | "INVOICE"
  | "CONTRACT"
  | "RECEIPT"
  | "TAX_INVOICE"
  | "CERTIFICATE"
  | "SETTLEMENT_EXPORT";

/**
 * 사람이 읽을 라벨 — Korean UI 일관 (Pretendard / 운영 톤).
 * 미래 STEP에서 entity 추가 시 *동일 dictionary에만 추가*하면 모든 trust view
 * 표시가 자동 갱신됨.
 */
export const DOCUMENT_TYPE_LABEL_KR: Readonly<Record<DocumentType, string>> = {
  INVOICE: "인보이스",
  CONTRACT: "계약서",
  RECEIPT: "영수증",
  TAX_INVOICE: "세금계산서",
  CERTIFICATE: "감정서 / 진본 증명",
  SETTLEMENT_EXPORT: "정산 내보내기",
} as const;

/**
 * 문서 record의 *origin* 컨텍스트. 운영자가 *어떻게* 이 문서가 시스템에
 * 들어왔는지 한 단어로 인지 가능하도록.
 *
 * - "auto"      AXVELA OS가 transaction state transition trigger로 자동 생성
 *               (예: INQUIRY → DEAL 시 createInvoice 자동 호출)
 * - "manual"    운영자가 명시적으로 생성 (예: 수동 invoice 새 버전 생성 +
 *               revisionReason 입력)
 * - "imported"  외부 데이터에서 import (예: STEP 52 Backup Restore JSON)
 *
 * **기존 데이터 호환**: 기존 invoices / contracts에 sourceContext 필드 부재 →
 * helper가 fallback으로 "auto" 가정 (관행적으로 자동 생성 흐름).
 */
export type DocumentSourceContext = "manual" | "auto" | "imported";

export const DOCUMENT_SOURCE_CONTEXT_LABEL_KR: Readonly<
  Record<DocumentSourceContext, string>
> = {
  manual: "운영자 직접 생성",
  auto: "흐름 자동 생성",
  imported: "외부 import",
} as const;

/**
 * 모든 document-like entity가 공유하는 *operational trust* metadata view.
 *
 * **본 shape은 storage shape이 아닌 projection view**. helper가 각 도메인
 * entity (Invoice / Contract) → 본 shape으로 projection. 미래 entity (Receipt /
 * Tax Invoice / Certificate / Settlement Export)는 본 shape 직접 채택 가능.
 *
 * **필드 분류**:
 *   - 식별:       `docType` / `version` / `parentDocumentId`
 *   - 생성:       `generatedAt` / `generatedBy` / `sourceContext`
 *   - 잠금:       `lockedAt` / `lockedBy`
 *   - 마무리:     `finalizedAt` (예: invoice PAID, contract LOCKED)
 *   - 보관:       `archivedAt` (예: 새 버전이 생성되어 본 record가 superseded)
 *   - 운영 메모:  `revisionReason?`
 *   - 동기 상태:  `deviceLocal`
 *
 * **Approval Workflow 무관 (STEP 101+ 영역)**:
 *   `lockedBy` 슬롯은 본 STEP 86에서 데이터 record용 — actor가 누구인지
 *   기록할 수 있는 자리. STEP 101+ Approval Workflow 활성 시 *동일 슬롯*에
 *   ApprovalAction.grantedBy 같은 reviewer 정보가 채워질 수 있음. 본 STEP은
 *   슬롯만 정의, 검토자 enforcement / queue / e-signature 0건.
 */
export interface DocumentTrustMetadata {
  // -- 식별 ----------------------------------------------------------------

  /** 문서 종류 discriminator. */
  docType: DocumentType;

  /** Version within the parent chain. v1 = original / chain root. */
  version: number;

  /**
   * Predecessor document id within the version chain. null for v1 (chain root).
   *
   * 도메인 entity의 `parentInvoiceId` / `parentContractId` / 미래의
   * `parentReceiptId` 등이 모두 본 generic 슬롯으로 projection.
   */
  parentDocumentId: string | null;

  // -- 생성 ----------------------------------------------------------------

  /**
   * Document record가 시스템에 생성된 ISO datetime.
   *
   * Invoice의 `issuedAt`, Contract의 `createdAt`이 모두 본 generic 슬롯으로
   * projection. 미래 entity는 본 필드 직접 사용.
   */
  generatedAt: string;

  /**
   * Actor label — 한국어 운영 톤 (예: "AXVELA OS" / "직원 · 김민수" /
   * "매니저 · 박수진" / "대표 · Jaeson Park" / "AXVELA AI").
   *
   * 기존 데이터 호환: 기존 entity에 actor 기록 부재 시 helper가 generation
   * 시점 컨텍스트에서 best-effort fallback ("AXVELA OS" 기본).
   */
  generatedBy: string;

  /** 본 record의 origin context. */
  sourceContext: DocumentSourceContext;

  // -- 잠금 / Lock --------------------------------------------------------

  /**
   * Document가 LOCK된 ISO datetime. null while editable.
   *
   * Invoice의 `lockedAt`, Contract의 `lockedAt`을 그대로 projection.
   */
  lockedAt: string | null;

  /**
   * LOCK을 수행한 actor label. null while editable.
   *
   * **STEP 86 본 STEP**: 기존 entity에 lockedBy 기록 부재 시 helper fallback
   * — Invoice의 경우 sentAt에 lock된 흐름이라 "AXVELA OS"로 derive 가능,
   * Contract의 경우 LOCKED 상태로 진입한 흐름이라 "AXVELA OS" / 운영자 fallback.
   *
   * **STEP 101+ Approval Workflow 영역**: 활성 시 ApprovalAction.grantedBy를
   * 본 슬롯에 사출 — 즉 "누가 LOCK 결정했는지"의 *공식 record*.
   */
  lockedBy: string | null;

  // -- 마무리 / Finalize --------------------------------------------------

  /**
   * Document가 *최종 상태*에 도달한 ISO datetime. null until finalized.
   *
   * 도메인별 의미:
   *   - Invoice:  PAID 진입 시점 (paidAt) — 결제 완료
   *   - Contract: LOCKED 진입 시점 (lockedAt) — 발효 가능 상태
   *   - Receipt (미래):  발급 완료 시점
   *   - Tax Invoice (미래): 발행 완료 시점 (운영 참고)
   *
   * **운영적 의미**: 본 시점 이후로 document는 *operational closure* 상태.
   * 새 version 생성 외에는 변화 없음 (rule_4).
   */
  finalizedAt: string | null;

  // -- 보관 / Archive -----------------------------------------------------

  /**
   * 본 document record가 *superseded*된 ISO datetime. null이면 active version.
   *
   * **계산 규칙**: chain 안에 본 record의 자식 (parentDocumentId가 본 record id
   * 인 다른 record)이 존재하면 archived 상태. archivedAt 자체는 *자식이
   * 생성된 시점* — 별도 schema 필드 부재 시 자식의 generatedAt으로 fallback
   * derive 가능.
   *
   * **VS finalizedAt**: finalizedAt은 *본 record 자체의 closure*, archivedAt
   * 은 *후속 record 등장으로 본 record가 historical로 demote된 시점*.
   *
   * 운영적 예: invoice v2가 PAID 후 v3가 새 버전으로 생성됨 → v2.finalizedAt
   * = v2.paidAt, v2.archivedAt = v3.issuedAt.
   */
  archivedAt: string | null;

  // -- 운영 메모 ---------------------------------------------------------

  /**
   * 새 version 생성 시 운영자가 남긴 사유 ("가격 수정" / "배송 주소 정정").
   *
   * Document Lifecycle Clarity STEP에서 Invoice에 정착됨 (`Invoice.revisionReason?`).
   * Contract는 본 슬롯 미정착 (STEP 103 Contract Approval Activation 영역).
   * 미래 entity는 본 슬롯 직접 사용.
   *
   * v1 (chain root)의 revisionReason은 의미 없음 (자식 생성 시점의 사유) —
   * 항상 undefined.
   */
  revisionReason?: string;

  // -- 동기 상태 ---------------------------------------------------------

  /**
   * 본 record가 *device-local* 상태인지. true이면 localStorage / 본 디바이스에만
   * 존재 (remote 동기 adapter에 push 안 됨), false이면 remote에도 동기화됨.
   *
   * **계산 규칙**: persistence adapter (`getActiveRemoteAdapter`)가 active이면
   * false (동기 가능), 부재이면 true (local-only). 본 STEP은 *현재 동기 상태*
   * 표시 — 본 entity 자체가 local-only인지 / 향후 remote에 push 됐는지의
   * 시점별 변화는 STEP 30 Remote Sync Adapter 영역.
   *
   * **사용 의도**: UI에서 "device-local activity" 라벨 표시, accountant export
   * (STEP 91)의 metadata 명시 등.
   */
  deviceLocal: boolean;
}

/**
 * 본 view를 derive하기 위해 helper에 전달하는 컨텍스트.
 *
 * 도메인 entity 자체에 부재한 정보 (chain의 자식 존재 여부, 동기 상태,
 * 명시적 actor)를 caller가 모아서 helper에게 명시적으로 전달.
 *
 * **순수성 정책**: helper (`deriveInvoiceTrust` / `deriveContractTrust`)는
 * store / persistence / DOM 접근 0건 — 모든 컨텍스트는 본 args로 입력.
 */
export interface DocumentTrustDeriveContext {
  /**
   * Chain 안에 본 record의 자식 (다음 version)이 존재하는지.
   *
   * **계산**: caller가 invoices array (또는 contracts)를 sweep해 parentXxxId
   * 매칭 record를 찾아 boolean으로 변환. 또는 기존 `buildInvoiceVersionChain`
   * 결과의 currentVersion role 판정 활용.
   */
  hasNewerVersion: boolean;

  /**
   * 자식 record가 존재할 경우, 그 자식의 generation timestamp. archivedAt 산출에
   * 사용. hasNewerVersion === false이면 무시.
   */
  childGeneratedAt?: string;

  /**
   * 명시적 actor — 운영자가 명시적으로 알려진 경우. 부재 시 entity의
   * `generatedBy?` field를 우선 시도, 없으면 fallback ("AXVELA OS" / "AXVELA AI"
   * — sourceContext에 따라).
   */
  explicitGeneratedBy?: string;

  /**
   * Lock 수행 actor. 부재 시 entity의 `lockedBy?` 필드 우선 시도, 없으면
   * "AXVELA OS" fallback.
   */
  explicitLockedBy?: string;

  /**
   * 본 device가 remote sync adapter active인지. true면 deviceLocal=false,
   * false (또는 undefined)면 deviceLocal=true.
   */
  remoteSyncActive?: boolean;

  /**
   * 명시적 source context override. 부재 시 entity의 `sourceContext?` field
   * 우선 시도, 없으면 "auto" fallback (관행).
   */
  explicitSourceContext?: DocumentSourceContext;
}
