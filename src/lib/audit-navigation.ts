// ============================================================================
// Audit Log Navigation Resolver — STEP 21 (rule_8 "Timeline = Navigation" 완성)
//
// 역할:
//   TimelineEvent (audit-helpers의 ClassifiedAuditEvent의 원본) →
//   (AuditTarget | null, AuditChainDetail | null)
//
// audit log 카드를 클릭했을 때 어떤 drawer를 어떤 id로 열어야 하는지,
// 그리고 카드 내부에 표시할 version/correction chain detail이 무엇인지를
// 결정한다.
//
// 핵심 결정 (STEP 21):
//   - TimelineEvent에 optional 필드 `relatedEntityType` + `relatedEntityId`
//     를 추가했다 (artwork.ts). 이는 *기존 필드 0줄 변경* + optional 확장이며,
//     도메인 객체 구조 자체는 무수정.
//
//   - Resolver는 두 필드만 읽어서 1:1 매핑한다. 과거 STEP 21 초안의
//     timestamp-based heuristic은 폐기 — store action이 이미 정확한 ref를
//     emit하므로 추측이 불필요하다.
//
//   - Chain detail (version chain, correction chain)은 도메인 객체에서
//     parent*Id / correctsReportId를 직접 읽는다. 이 부분은 store lookup이
//     필요하므로 navStore prop을 그대로 유지.
//
// Navigation 미지원 (read-only로 유지):
//   - relatedEntityType 미설정 이벤트 (state changes, 일부 legacy seed)
//   - relatedEntityType="transaction" — 사용자 spec에 미열거. Transaction은
//     container이며 contained Invoice/Contract/Settlement로 직접 진입하는 게
//     audit 컨텍스트에서 더 유용함. 향후 spec 확장 시 case 추가 가능.
// ============================================================================

import type { TimelineEvent } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type { Invoice } from "@/types/invoice";
import type { Settlement } from "@/types/settlement";
import type { TaxRecord } from "@/types/tax";
import type { Contract } from "@/types/contract";
import type { Logistics } from "@/types/logistics";
import type { ConditionReport } from "@/types/condition-report";
import type { CurationNote } from "@/types/curation";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * 사용자가 audit log 카드를 클릭했을 때 열릴 drawer를 결정하는 tagged union.
 * 각 kind는 store의 open 액션 시그니처와 1:1 대응.
 */
export type AuditTarget =
  | { kind: "contract"; id: string }              // → openContractDetail(id)
  | { kind: "curation"; artworkId: string }       // → openCurationDraft(artworkId) — auto-resolves latest
  | { kind: "invoice"; id: string }               // → openInvoiceDetail(id)
  | { kind: "receipt"; id: string }               // STEP 87 — → openReceiptDetail(id)
  | { kind: "taxInvoice"; id: string }            // STEP 89 — → openTaxInvoiceDetail(id)
  | { kind: "settlement"; id: string }            // → openSettlementDetail(id)
  | { kind: "tax"; id: string }                   // → openTaxDetail(id)
  | { kind: "logistics"; id: string }             // → openLogisticsDetail(id)
  | { kind: "conditionReport"; id: string }       // → openConditionReportEdit(id)
  | { kind: "inquiry"; id: string }               // → openInquiryDetail(id)
  | { kind: "inquiryResponse"; id: string };      // → openInquiryResponse(id)

/**
 * Audit 카드에 인라인으로 표시할 chain detail.
 *   version    Contract / CurationNote / Invoice 의 parent*Id chain.
 *              currentLabel/parentLabel은 "v1" / "v2" 형태.
 *   correction ConditionReport의 correctsReportId chain.
 *              currentLabel="수정본", parentLabel="원본".
 */
export interface AuditChainDetail {
  type: "version" | "correction";
  currentId: string;
  currentLabel: string;
  parentId: string | null;
  parentLabel: string | null;
}

export interface AuditNavigationInfo {
  target: AuditTarget | null;
  chain: AuditChainDetail | null;
}

/**
 * Resolver가 의존하는 store 슬라이스의 read-only view. 컴포넌트에서 selector로
 * 읽어 그대로 전달. timeline은 audit-helpers가 따로 처리하므로 여기 미포함.
 */
export interface AuditNavigationStoreView {
  inquiries: Record<string, Inquiry[]>;
  transactions: Record<string, Transaction[]>;
  invoices: Record<string, Invoice[]>;
  settlements: Record<string, Settlement[]>;
  taxRecords: Record<string, TaxRecord[]>;
  contracts: Record<string, Contract[]>;
  logistics: Record<string, Logistics[]>;
  conditionReports: Record<string, ConditionReport[]>;
  curationNotes: Record<string, CurationNote[]>;
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

const EMPTY: AuditNavigationInfo = { target: null, chain: null };

/**
 * 단일 진입점. event.relatedEntityType + relatedEntityId를 읽어 target을
 * 결정하고, chain이 의미 있는 도메인(Contract/Curation/Invoice/CR)에 대해서만
 * 추가로 chain detail을 lookup한다.
 *
 * 두 필드 중 하나라도 미설정이면 navigable하지 않은 이벤트로 간주 → EMPTY.
 */
export function resolveAuditEventTarget(
  event: TimelineEvent,
  artworkId: string,
  store: AuditNavigationStoreView
): AuditNavigationInfo {
  const type = event.relatedEntityType;
  const id = event.relatedEntityId;
  if (!type || !id) return EMPTY;

  switch (type) {
    case "curation":
      // id == artworkId. CurationDraftDrawer가 latest note를 자동 해석.
      return {
        target: { kind: "curation", artworkId: id },
        chain: buildCurationChain(event, id, store.curationNotes),
      };

    case "contract":
      return {
        target: { kind: "contract", id },
        chain: buildContractChain(id, artworkId, store.transactions, store.contracts),
      };

    case "invoice":
      return {
        target: { kind: "invoice", id },
        chain: buildInvoiceChain(id, artworkId, store.transactions, store.invoices),
      };

    case "settlement":
      return { target: { kind: "settlement", id }, chain: null };

    case "tax":
      return { target: { kind: "tax", id }, chain: null };

    case "logistics":
      return { target: { kind: "logistics", id }, chain: null };

    case "condition_report":
      return {
        target: { kind: "conditionReport", id },
        chain: buildConditionReportChain(id, artworkId, store.transactions, store.conditionReports),
      };

    case "inquiry":
      return { target: { kind: "inquiry", id }, chain: null };

    case "inquiry_response":
      return { target: { kind: "inquiryResponse", id }, chain: null };

    case "receipt":
      // STEP 87 — Receipt drilldown은 ReceiptDetailDrawer로 진입. AuditTarget의
      // generic "receipt" kind 사용 — chain은 향후 versioning UI 도입 시 보강.
      return { target: { kind: "receipt", id }, chain: null };

    case "tax_invoice":
      // STEP 89 — Tax Invoice drilldown은 TaxInvoiceDetailDrawer로 진입. Receipt
      // 패턴 정확 일관 — version chain은 drawer 내에서 직접 표시.
      return { target: { kind: "taxInvoice", id }, chain: null };

    case "transaction":
      // Spec 미열거 — Transaction container 자체는 audit에서 비활성. 향후
      // 필요해지면 { kind: "transaction" } 케이스를 AuditTarget에 추가 + 여기
      // 라우팅.
      return EMPTY;

    default: {
      // exhaustiveness check — 새 entity type을 추가했는데 라우팅을 빠뜨리면
      // 컴파일 타임에 잡힘.
      const _exhaustive: never = type;
      void _exhaustive;
      return EMPTY;
    }
  }
}

// ----------------------------------------------------------------------------
// Chain detail builders
// ----------------------------------------------------------------------------

/**
 * Curation chain — note의 parentCurationId 추적. 도메인 객체에서 직접 읽으므로
 * timestamp-based 매칭 불필요. event를 받는 이유: 새 버전 생성 이벤트는
 * "v1 → v2" 형태로 표시해야 하는데, 현재 store에는 v2(latest)만 살아있으므로
 * matched note는 latest다. 이 latest의 parentCurationId가 v1을 가리킨다.
 *
 * 단, "큐레이션 노트 LOCK" 같은 LOCK 시점 이벤트는 chain detail이 의미 없음
 * (해당 v 자체를 수정한 거지 새 버전이 아니므로). detail에 "이전 v(N)" 토큰이
 * 있어야만 chain 표시 — 실제 "큐레이션 노트 새 버전" 이벤트만 해당됨.
 */
function buildCurationChain(
  event: TimelineEvent,
  artworkId: string,
  curationNotes: Record<string, CurationNote[]>
): AuditChainDetail | null {
  // 새 버전 생성 이벤트만 chain 표시
  if (!event.detail || !/이전 v\d+/.test(event.detail)) return null;

  const list = curationNotes[artworkId] ?? [];
  if (list.length === 0) return null;

  const latest = list[0]; // store는 latest-first ordering
  if (!latest.parentCurationId) return null;

  const parent = list.find((n) => n.id === latest.parentCurationId) ?? null;
  return {
    type: "version",
    currentId: latest.id,
    currentLabel: `v${latest.version}`,
    parentId: latest.parentCurationId,
    parentLabel: parent ? `v${parent.version}` : null,
  };
}

/**
 * Contract chain — contract의 parentContractId 추적. id로 직접 lookup.
 */
function buildContractChain(
  contractId: string,
  artworkId: string,
  transactions: Record<string, Transaction[]>,
  contracts: Record<string, Contract[]>
): AuditChainDetail | null {
  const txIds = (transactions[artworkId] ?? []).map((t) => t.id);
  const matched = lookupById(contractId, txIds, contracts);
  if (!matched || !matched.parentContractId) return null;

  const parent = lookupById(matched.parentContractId, txIds, contracts);
  return {
    type: "version",
    currentId: matched.id,
    currentLabel: `v${matched.version}`,
    parentId: matched.parentContractId,
    parentLabel: parent ? `v${parent.version}` : null,
  };
}

/**
 * Invoice chain — invoice의 parentInvoiceId 추적.
 */
function buildInvoiceChain(
  invoiceId: string,
  artworkId: string,
  transactions: Record<string, Transaction[]>,
  invoices: Record<string, Invoice[]>
): AuditChainDetail | null {
  const txIds = (transactions[artworkId] ?? []).map((t) => t.id);
  const matched = lookupById(invoiceId, txIds, invoices);
  if (!matched || !matched.parentInvoiceId) return null;

  const parent = lookupById(matched.parentInvoiceId, txIds, invoices);
  return {
    type: "version",
    currentId: matched.id,
    currentLabel: `v${matched.version}`,
    parentId: matched.parentInvoiceId,
    parentLabel: parent ? `v${parent.version}` : null,
  };
}

/**
 * ConditionReport chain — correctsReportId 추적 (correction chain, version 아님).
 */
function buildConditionReportChain(
  reportId: string,
  artworkId: string,
  transactions: Record<string, Transaction[]>,
  conditionReports: Record<string, ConditionReport[]>
): AuditChainDetail | null {
  const txIds = (transactions[artworkId] ?? []).map((t) => t.id);
  const matched = lookupById(reportId, txIds, conditionReports);
  if (!matched || !matched.correctsReportId) return null;

  return {
    type: "correction",
    currentId: matched.id,
    currentLabel: "수정본",
    parentId: matched.correctsReportId,
    parentLabel: "원본",
  };
}

// ----------------------------------------------------------------------------
// Internal lookup
// ----------------------------------------------------------------------------

/**
 * Generic id-based lookup across tx-keyed slices.
 */
function lookupById<T extends { id: string }>(
  id: string,
  txIds: string[],
  byTxKey: Record<string, T[]>
): T | null {
  for (const txId of txIds) {
    const found = (byTxKey[txId] ?? []).find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}
