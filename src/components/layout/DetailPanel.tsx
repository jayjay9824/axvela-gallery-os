"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { StatusBadge } from "@/components/artwork/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  ButtonHint,
  AI_DRAFT_AFFORDANCE,
  FUTURE_LABEL,
} from "@/components/ui/ButtonHint";
import { InquirySummary } from "@/components/inquiry/InquirySummary";
import { TransactionSummary } from "@/components/transaction/TransactionSummary";
import { SettlementSummary } from "@/components/settlement/SettlementSummary";
import { TaxSummary } from "@/components/tax/TaxSummary";
import { ContractSummary } from "@/components/contract/ContractSummary";
import { CurationSummary } from "@/components/curation/CurationSummary";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";
import { LogisticsSummary } from "@/components/logistics/LogisticsSummary";
import { TransactionHistory } from "@/components/transaction/TransactionHistory";
import { NewResaleStartCard } from "@/components/transaction/NewResaleStartCard";
import {
  getActiveTransaction,
  hasTransactionChildren,
  hasTransactionHistory,
} from "@/lib/transaction-helpers";
import { getTransition } from "@/lib/state-machine";
import {
  cn,
  formatKRW,
  formatRelativeKR,
  STATE_LABEL_KR,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import type { ArtworkState, TimelineEvent } from "@/types/artwork";

/**
 * Static supporting actions per state — these are NOT state transitions.
 * State transitions are driven by the state machine via getTransition() (rule_6).
 *
 * STEP 17 — Supporting action 메타데이터 확장:
 *   wired       핸들러가 실제 연결되어 있음 (활성 버튼).
 *   isAi        AI 초안 생성 버튼 — 활성 상태에서도 "AI 초안 — 담당자 검토 필요"
 *               annotation을 표시 (rule_5).
 *   futureHint  미구현 placeholder임을 알리는 helper text. wired=false일 때 노출.
 *               기본값 "준비 중" — 일부 항목은 *명시적 navigation 정보*를 담는
 *               예외적 hint 사용 (예: "작품 편집에서 변경" / "자동 보관 완료").
 *
 * STEP UX-1 (Action Clarity) — *어디로 가는지 모호한* hint 모두 제거. 아래 정책:
 *   - 모호한 hint 0건 (예: "다른 카드에서 진행" / "Inquiry 상세에서 변경" 금지)
 *   - 미구현 액션은 모두 "준비 중" fallback (FUTURE_LABEL)
 *   - 명시적 navigation 정보가 있는 경우만 futureHint 사용 (예: 작품 편집)
 *   - secondary / tertiary는 button shape 아닌 *작은 텍스트 링크 톤*으로 렌더
 *     (rule_15 "Primary 1개" 정책 강화 — Primary 검은색 버튼이 유일한 button)
 */
interface SupportingActionMeta {
  label: string;
  wired?: boolean;
  isAi?: boolean;
  futureHint?: string;
}

const SUPPORTING_ACTIONS: Record<
  ArtworkState,
  { secondary?: SupportingActionMeta; tertiary?: SupportingActionMeta }
> = {
  // STEP UX-1 — Action Clarity Layer.
  // 모호한 futureHint ("다른 카드에서 진행" / "Inquiry 상세에서 변경") 모두 제거
  // → wired=false 액션은 자동으로 FUTURE_LABEL ("준비 중") fallback.
  // *어디로 가야 하는지 명시된* hint만 유지: "작품 편집에서 변경" / "자동 보관 완료".
  // 사용자 spec: "NEVER leave actions ambiguous" / 모호한 instructional helper text 0건.
  DRAFT: {
    secondary: { label: "AI 큐레이션 초안", wired: true, isAi: true },
  },
  READY: {
    secondary: { label: "Collector View 공유" },
    // 명시적 — 사용자가 "작품 편집" 어디로 가야 할지 알 수 있음
    tertiary: { label: "가격 조정", futureHint: "작품 편집에서 변경" },
  },
  INQUIRY: {
    secondary: { label: "AI 응대 초안", wired: true, isAi: true },
    tertiary: { label: "보류" },
  },
  DEAL: {
    secondary: { label: "Contract 검토" },
    tertiary: { label: "보류" },
  },
  PAID: {
    secondary: { label: "물류 배정" },
    tertiary: { label: "Tax 분류" },
  },
  CLOSED: {
    // 액션 아닌 *상태 설명* — 그대로 유지
    secondary: { label: "Document 보관", futureHint: "자동 보관 완료" },
  },
  REOPENED: {
    secondary: { label: "기록 보기" },
  },
  BROKERED: {
    secondary: { label: "원소유자 정산 확인" },
  },
};

/** States that show the Inquiry summary.
 *  STEP 49 — DRAFT / READY 추가. 이전에는 INQUIRY 이상에서만 노출되었으나
 *  manual inquiry creation 진입점("+ 문의 추가")을 보여주려면 READY 단계부터
 *  섹션이 필요. DRAFT도 포함 — 운영자가 작품 등록 직후 사전 문의를 기록할 수
 *  있도록. 빈 상태 UI는 기존 그대로 (rule_10 "비어있는 카드 그대로 두지 말 것"
 *  은 리스트 자체가 아닌 *분기*에 한정 — 섹션 헤더는 상시 노출 정책). */
const INQUIRY_VISIBLE_STATES: ArtworkState[] = [
  "DRAFT",
  "READY",
  "INQUIRY",
  "DEAL",
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

/** States that show the Transaction summary (≥ DEAL). */
const TRANSACTION_VISIBLE_STATES: ArtworkState[] = [
  "DEAL",
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

/** States that show the Settlement summary (≥ PAID). */
const SETTLEMENT_VISIBLE_STATES: ArtworkState[] = [
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

/** States that show the Tax summary (≥ PAID — same gate as Settlement). */
const TAX_VISIBLE_STATES: ArtworkState[] = [
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

/** States that show the Contract summary (≥ DEAL — same gate as Transaction). */
const CONTRACT_VISIBLE_STATES: ArtworkState[] = [
  "DEAL",
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

/** States that show the Logistics summary (≥ PAID — physical delivery starts post-payment). */
const LOGISTICS_VISIBLE_STATES: ArtworkState[] = [
  "PAID",
  "CLOSED",
  "BROKERED",
  "REOPENED",
];

export function DetailPanel() {
  const artworks = useArtworkStore((s) => s.artworks);
  const timeline = useArtworkStore((s) => s.timeline);
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const payments = useArtworkStore((s) => s.payments);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const contracts = useArtworkStore((s) => s.contracts);
  const logistics = useArtworkStore((s) => s.logistics);
  const inquiries = useArtworkStore((s) => s.inquiries);
  // STEP UX-3 — needed for ZONE 2 (operational context) zone label visibility:
  // 라벨은 Curation 또는 Inquiry zone에 *실제로 컨텐츠가 있을 때만* 렌더 (사용자 spec §2).
  const curationNotes = useArtworkStore((s) => s.curationNotes);
  const selectedId = useArtworkStore((s) => s.selectedArtworkId);
  const openEdit = useArtworkStore((s) => s.openEdit);
  const openTransition = useArtworkStore((s) => s.openTransition);
  const openPaymentRegister = useArtworkStore(
    (s) => s.openPaymentRegister
  );
  const openCurationDraft = useArtworkStore((s) => s.openCurationDraft);
  const openInquiryResponse = useArtworkStore(
    (s) => s.openInquiryResponse
  );
  const openAuditLog = useArtworkStore((s) => s.openAuditLog);
  // STEP 45 — AI Market Analysis (rule_18 (b)) 진입점.
  const openMarketAnalysis = useArtworkStore((s) => s.openMarketAnalysis);
  // STEP 92 — Operational Intelligence drawer 진입점.
  const openMarketInsight = useArtworkStore((s) => s.openMarketInsight);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const artwork = artworks.find((a) => a.id === selectedId);

  if (!artwork) {
    return (
      <aside className="w-[380px] shrink-0 h-full border-l border-line bg-surface flex items-center justify-center">
        <div className="text-center px-8">
          <p className="text-[13px] text-ink-muted tracking-tightish">
            작품을 선택하면 여기에 상세 정보가 표시됩니다.
          </p>
        </div>
      </aside>
    );
  }

  const transition = getTransition(artwork.state);
  const supporting = SUPPORTING_ACTIONS[artwork.state];
  const events = timeline[artwork.id] ?? [];
  const showInquiry = INQUIRY_VISIBLE_STATES.includes(artwork.state);
  const showTransaction = TRANSACTION_VISIBLE_STATES.includes(artwork.state);
  const showSettlement = SETTLEMENT_VISIBLE_STATES.includes(artwork.state);
  const showTax = TAX_VISIBLE_STATES.includes(artwork.state);
  const showContract = CONTRACT_VISIBLE_STATES.includes(artwork.state);
  const showLogistics = LOGISTICS_VISIBLE_STATES.includes(artwork.state);

  // Multi-Transaction context (STEP 14, rule_13 follow-through)
  // History section appears whenever the artwork has > 1 transaction.
  const showHistory = hasTransactionHistory(transactions, artwork.id);

  // Fresh-resale empty state: the active tx is a resale AND has zero
  // child records yet. In that case we replace the four otherwise-empty
  // Money/Document/Logistics summaries with one guidance card to avoid
  // an "is something broken?" moment for the user.
  const activeTx = getActiveTransaction(transactions, artwork.id);
  const isFreshResale =
    activeTx?.isResale === true &&
    !hasTransactionChildren(activeTx.id, {
      invoices,
      payments,
      settlements,
      taxRecords,
      contracts,
      logistics,
    });

  /**
   * DEAL → PAID is now driven by Payment registration (rule_3, STEP 7).
   * The Primary button in DEAL state opens the Payment register drawer
   * instead of the generic state transition modal. The transition itself
   * is cascaded by registerPayment() in the store.
   */
  const isDealAwaitingPayment = artwork.state === "DEAL";
  const targetInvoice = isDealAwaitingPayment
    ? (transactions[artwork.id] ?? [])
        .map((t) => (invoices[t.id] ?? [])[0])
        .find((i) => i && i.status !== "PAID")
    : undefined;

  const handlePrimary = () => {
    if (isDealAwaitingPayment && targetInvoice) {
      openPaymentRegister(targetInvoice.id);
    } else {
      openTransition(artwork.id);
    }
  };

  /**
   * STEP 16 — Wire the AI-related supporting buttons (rule_18).
   * Other states' supporting buttons remain non-functional placeholders for
   * subsequent STEPs (e.g. "Collector View 공유", "물류 배정", etc.).
   *
   * DRAFT     → "AI 큐레이션 초안" → CurationDraftDrawer (rule_18 (a))
   * INQUIRY   → "AI 응대 초안"     → InquiryResponseDrawer for latest OPEN inquiry
   *                                  (rule_18 (d))
   *
   * STEP 17 — INQUIRY state는 actionable inquiry가 실제 존재할 때만 wired.
   * 이론적으로 state machine이 INQUIRY 상태 진입 시 inquiry 보장하지만,
   * 방어적으로 데이터 가드 추가 — 없으면 버튼 disabled + "응대 가능한 문의 없음"
   * hint 노출.
   */
  const inquiryActionableTarget =
    artwork.state === "INQUIRY"
      ? (() => {
          const list = inquiries[artwork.id] ?? [];
          return (
            list.find((i) => i.status === "OPEN") ??
            list.find((i) => i.status === "ESCALATED") ??
            list.find((i) => i.status === "ON_HOLD") ??
            list[0]
          );
        })()
      : undefined;

  const handleSecondary = () => {
    if (artwork.state === "DRAFT") {
      openCurationDraft(artwork.id);
      return;
    }
    if (artwork.state === "INQUIRY" && inquiryActionableTarget) {
      openInquiryResponse(inquiryActionableTarget.id);
      return;
    }
    // Other states: no-op (placeholder remains for future wiring).
  };

  /**
   * Whether the secondary button has both a real handler AND the runtime data
   * needed to act. STEP 17 introduces the second clause for the INQUIRY case —
   * an actionable inquiry must exist. The button is disabled with an
   * appropriate ButtonHint in either failure path.
   */
  const secondaryMeta = supporting.secondary;
  const isSecondaryHandlerWired = secondaryMeta?.wired === true;
  const isSecondaryDataReady =
    artwork.state !== "INQUIRY" || inquiryActionableTarget !== undefined;
  const isSecondaryActive =
    isSecondaryHandlerWired && isSecondaryDataReady;

  const primaryLabel =
    isDealAwaitingPayment && targetInvoice
      ? "결제 등록"
      : transition?.primaryLabel;

  // PAID → CLOSED is the only RBAC-gated transition (rule_7). Other
  // transitions are unrestricted at the role layer.
  const isPaidToClosed =
    transition !== null &&
    artwork.state === "PAID" &&
    transition.to === "CLOSED";
  const primaryBlockedByRole =
    isPaidToClosed && !hasPermission(currentRole, "artwork.transition.close");

  return (
    <aside className="flex flex-col w-[380px] shrink-0 h-full border-l border-line bg-surface overflow-y-auto scroll-clean">
      {/* Hero — image (if uploaded) or solid color block.
          STEP 50.5: imageUrl 우선, 없으면 thumbnailColor fallback. */}
      <div
        className="relative h-[220px] w-full shrink-0 overflow-hidden"
        style={{ backgroundColor: artwork.thumbnailColor }}
      >
        {artwork.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="absolute top-3 left-4">
          <span className="inline-flex items-center rounded px-2 py-1 text-[10.5px] font-medium tracking-tightish bg-white/85 text-ink backdrop-blur-sm font-mono">
            {artwork.axid.code}
          </span>
        </div>
        <div className="absolute top-3 right-4">
          <StatusBadge state={artwork.state} />
        </div>
      </div>

      {/* Identity — STEP UX-3: pt-5 pb-4 (tightened from pb-5) for density */}
      <div className="px-6 pt-5 pb-4 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              {artwork.artist.name}
              {artwork.artist.nameEn && (
                <span className="text-ink-subtle">
                  {" "}
                  · {artwork.artist.nameEn}
                </span>
              )}
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-ink tracking-tight2 leading-tight">
              {artwork.title}
            </h2>
            <p className="mt-1 text-[12px] text-ink-muted leading-snug">
              {artwork.year} · {artwork.medium}
            </p>
            <p className="text-[12px] text-ink-muted leading-snug">{artwork.dimensions}</p>
          </div>
          <button
            onClick={() => openEdit(artwork.id)}
            type="button"
            aria-label="작품 편집"
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium text-ink-muted hover:text-ink hover:bg-surface-muted tracking-tightish transition-colors"
          >
            <PencilIcon />
            편집
          </button>
        </div>

        <div className="mt-3.5 flex items-baseline justify-between">
          <span className="text-[11px] text-ink-subtle tracking-tightish">
            현재가
          </span>
          <span className="text-[16px] font-semibold text-ink tracking-tight2 tabular-nums">
            {formatKRW(artwork.priceKRW)}
          </span>
        </div>
      </div>

      {/* ── ZONE 1 — NEXT REQUIRED ACTION (STEP UX-3) ──────────────────
          Highest priority zone. The first thing the user must answer when
          entering Detail Panel: "What should I do now?" (사용자 spec §1).
          State badge is already shown in Hero — Section header omits the
          duplicate state hint (사용자 spec §2 — reduce duplicate labels). */}
      <ZoneLabel>다음 작업</ZoneLabel>

      {/* State-based Actions — Control Center (rule_6, rule_15) */}
      <section className="px-6 pt-2 pb-5 border-b border-line">
        <SectionHeader
          label="상태 기반 액션"
          hint={transition ? "전환 가능" : "현재 단계 유지"}
        />
        <div className="mt-3 flex flex-col gap-2">
          {transition ? (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-between"
                onClick={handlePrimary}
                disabled={primaryBlockedByRole}
                aria-disabled={primaryBlockedByRole}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold tracking-[0.14em] text-white/55 uppercase">
                    다음
                  </span>
                  <span>{primaryLabel}</span>
                </span>
                <ChevronRightIcon />
              </Button>
              {primaryBlockedByRole && (
                <ButtonHint
                  tone="permission"
                  text={permissionHint("artwork.transition.close")}
                />
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-line px-3 py-3 text-center">
              <p className="text-[12px] text-ink-muted tracking-tightish">
                다음 상태가 정의되어 있지 않습니다
              </p>
              <p className="text-[10.5px] text-ink-subtle mt-0.5 tracking-tightish">
                재배정은 작품 편집을 통해 가능합니다
              </p>
            </div>
          )}

          {(supporting.secondary || supporting.tertiary) && (
            <div className="mt-3 pt-3 border-t border-line/50 flex flex-col gap-1">
              {/* STEP UX-1 — visual separation. Primary 검은색 버튼이 유일한 button.
                  secondary / tertiary는 작은 텍스트 링크 톤 (rule_15 "Primary 1개"). */}
              <span className="text-[9px] uppercase tracking-[0.16em] text-ink-subtle font-semibold mb-0.5">
                추가 작업
              </span>
              {supporting.secondary && (
                <SecondaryActionRow
                  meta={supporting.secondary}
                  isHandlerWired={isSecondaryHandlerWired}
                  isDataReady={isSecondaryDataReady}
                  isActive={isSecondaryActive}
                  onClick={handleSecondary}
                />
              )}
              {supporting.tertiary && (
                <SecondaryActionRow
                  meta={supporting.tertiary}
                  isHandlerWired={false}
                  isDataReady={false}
                  isActive={false}
                />
              )}
            </div>
          )}
        </div>

        {transition && (
          <p className="mt-3 text-[10.5px] text-ink-subtle tracking-tightish flex items-center gap-1.5">
            <StatusBadge state={transition.from} className="!py-0.5 !px-2" />
            <ArrowMiniIcon />
            <StatusBadge state={transition.to} className="!py-0.5 !px-2" />
          </p>
        )}
      </section>

      {/* ── ZONE 2 — ACTIVE OPERATIONAL CONTEXT (STEP UX-3) ────────────
          Curation 노트 + Inquiry 활동. 작품의 *현재 운영 상태*를 narrative으로
          전달. 빈 zone은 라벨도 함께 숨김 (사용자 spec §2 — visual noise reduction). */}
      {(showInquiry || hasArtworkCuration(curationNotes, artwork.id)) && (
        <ZoneLabel>운영 컨텍스트</ZoneLabel>
      )}

      {/* Curation summary — visible whenever a CurationNote exists for this
          artwork (STEP 16, rule_18 (a)). Renders null if none — no state gate
          since curation can exist from DRAFT through CLOSED/BROKERED. Placed
          before commercial sections because it describes the artwork itself. */}
      <CurationSummary artworkId={artwork.id} />

      {/* Inquiry summary — visible from INQUIRY onward */}
      {showInquiry && <InquirySummary artworkId={artwork.id} />}

      {/* ── ZONE 3 — DOCUMENT & TRANSACTION (STEP UX-3) ────────────────
          Transaction + History + Contract. Contract is a *document* (rule_4)
          and naturally belongs with transaction context — STEP UX-3 moved it
          here from the previous fiscal block. Visible from DEAL onward. */}
      {showTransaction && <ZoneLabel>거래 & 문서</ZoneLabel>}

      {/* Transaction summary — visible from DEAL onward */}
      {showTransaction && <TransactionSummary artworkId={artwork.id} />}

      {/* Transaction History — multi-tx context, only when > 1 tx (rule_13, STEP 14) */}
      {showHistory && <TransactionHistory artworkId={artwork.id} />}

      {/* Contract summary — STEP UX-3: moved to DOCUMENT zone (was previously
          between Tax and Logistics in the fiscal block). Document feels more
          natural alongside Transaction (rule_4 — document is child of tx). */}
      {showContract && !isFreshResale && <ContractSummary artworkId={artwork.id} />}

      {/* ── ZONE 4 — FISCAL & OPERATIONAL COMPLETION (STEP UX-3) ──────
          Settlement + Tax + Logistics. Visible from PAID onward. Receipt 발행
          기록은 Payment trigger 자동 흐름 (STEP 87)으로 별도 drawer에 자연
          편입 — 본 zone은 *recurring fiscal flow*만 (사용자 spec §4 — fiscal
          embedded, not segmented as separate accounting blocks). */}
      {!isFreshResale && (showSettlement || showTax || showLogistics) && (
        <ZoneLabel>정산 & 운영 완료</ZoneLabel>
      )}

      {/* Money / Document / Logistics summaries — replaced by a single
          guidance card when the active tx is a fresh resale with no
          children yet (STEP 14, user requirement: "비어있는 카드 그대로 두지 말 것"). */}
      {isFreshResale ? (
        <NewResaleStartCard />
      ) : (
        <>
          {/* Settlement summary — visible from PAID onward (rule_3, rule_12) */}
          {showSettlement && <SettlementSummary artworkId={artwork.id} />}

          {/* Tax summary — visible from PAID onward (rule_3 — accounting layer) */}
          {showTax && <TaxSummary artworkId={artwork.id} />}

          {/* Logistics summary — visible from PAID onward (rule_21 — physical delivery + condition check) */}
          {showLogistics && <LogisticsSummary artworkId={artwork.id} />}
        </>
      )}

      {/* ── ZONE 5 — AI / MARKET INSIGHT (STEP UX-3 + STEP 92) ─────────
          Two complementary CTAs: per-artwork commentary (STEP 45) +
          gallery-wide operational signals (STEP 92).
          AI Direction §10 보존 — *참고* 톤 / "AI가 가격 예측" 절대 금지. */}
      <ZoneLabel>AI 참고</ZoneLabel>
      <section className="px-6 pt-1 pb-4 border-b border-line space-y-2">
        <button
          type="button"
          onClick={() => openMarketAnalysis(artwork.id)}
          className="group w-full flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-muted/40"
        >
          <span className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-[12px] font-medium text-ink tracking-tightish">
              AI 참고 분석
            </span>
            <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
              운영 보조 신호 — 인간 판단이 우선
            </span>
          </span>
          <ChevronRightIcon />
        </button>
        <button
          type="button"
          onClick={() => openMarketInsight(artwork.id)}
          className="group w-full flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-muted/40"
        >
          <span className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-[12px] font-medium text-ink tracking-tightish">
              갤러리 운영 신호
            </span>
            <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
              문의 / 정산 / 활동 패턴 — 가격 예측 무관
            </span>
          </span>
          <ChevronRightIcon />
        </button>
        {/* STEP 95 — AI 정리 보조 (artwork_description) */}
        <DocumentWritingAssistButton
          target="artwork_description"
          buildSourceText={() =>
            `${artwork.title} · ${artwork.artist.name} · ${artwork.medium} · ${artwork.dimensions ?? ""}`
          }
          buildContext={() => `Artwork ${artwork.id} · ${artwork.state}`}
          onApply={(text) => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(text).catch(() => {});
            }
          }}
          applyButtonLabel="복사"
          className="pt-1"
        />
        {/* STEP 96 — 다국어 보기 (artwork description projection) */}
        <TranslationToolbar
          buildSourceText={() =>
            `${artwork.title} · ${artwork.artist.name} · ${artwork.medium}${artwork.dimensions ? ` · ${artwork.dimensions}` : ""}`
          }
          domain="artwork_description"
          className="pt-3"
        />
      </section>

      {/* ── ZONE 6 — TIMELINE / ACTIVITY (STEP UX-3) ──────────────────
          Living Timeline (rule_8). Self-labeled by h3, no zone label needed.
          AI Market Insight CTA was moved to ZONE 5 — Timeline header keeps
          only Audit Log access (감사 흐름과 자연 연관). */}
      <section className="px-6 py-5 flex-1">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
            Living Timeline
          </h3>
          <button
            type="button"
            onClick={() => openAuditLog(artwork.id)}
            className="text-[10.5px] text-ink-muted enabled:hover:text-ink tracking-tightish transition-colors underline-offset-2 enabled:hover:underline"
          >
            감사 로그 보기
          </button>
        </div>
        {events.length > 0 ? (
          <ol className="mt-4 flex flex-col">
            {events.map((ev, i) => (
              <TimelineItem
                key={ev.id}
                event={ev}
                isLast={i === events.length - 1}
              />
            ))}
          </ol>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-line p-4">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              아직 기록된 이벤트가 없습니다.
            </p>
            <p className="mt-1 text-[11px] text-ink-subtle">
              상태 전환·Inquiry·Transaction 발생 시 자동으로 누적됩니다.
            </p>
          </div>
        )}
      </section>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ArrowMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * STEP UX-3 — Detail Panel Information Density.
 *
 * Zone-level group label that introduces a *priority zone* in the panel.
 * Sits between sections as a subtle macro-grouping (one level above
 * SectionHeader). Unlike Sidebar group headers (UX-2), zone labels here
 * have *less* visual weight to avoid stacking emphasis with the existing
 * SectionHeader system inside each sub-summary component.
 *
 * Render rules:
 *   - Always tiny (<= 10px) and dimmed (text-ink-subtle/65)
 *   - No border, no background — purely a text marker
 *   - Padding chosen so the label "belongs to the next section" visually
 *
 * 사용자 spec §1 (priority zones) + §2 (visual noise reduction) 동시 충족.
 */
function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pt-4 pb-1.5">
      <span className="text-[9.5px] uppercase tracking-[0.2em] text-ink-subtle/70 font-semibold">
        {children}
      </span>
    </div>
  );
}

/**
 * STEP UX-3 — Visibility predicate for the ZONE 2 label.
 *
 * CurationSummary는 latest CurationNote가 없으면 null을 반환하므로 zone
 * label만 외로 보이는 *상황을 회피*하기 위해 본 helper로 동일 조건 검사.
 * (사용자 spec §2 — visual noise reduction: empty zone에 라벨만 떠있으면
 * 운영자에게 "여기 비어있는 게 있어야 하나?" 질문을 주게 됨)
 */
function hasArtworkCuration(
  notes: Record<string, { id: string }[]>,
  artworkId: string
): boolean {
  return (notes[artworkId] ?? []).length > 0;
}

function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const dotClass =
    event.kind === "STATE_CHANGE"
      ? "bg-ink"
      : event.kind === "INQUIRY"
      ? "bg-status-inquiry"
      : event.kind === "TRANSACTION"
      ? "bg-status-deal"
      : event.kind === "DOCUMENT"
      ? "bg-status-paid"
      : event.kind === "PAYMENT"
      ? "bg-status-paid"
      : "bg-ink-subtle";

  return (
    <li className="relative pl-5">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full",
          dotClass
        )}
      />
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[3px] top-3.5 bottom-0 w-px bg-line"
        />
      )}
      <div className="pb-4">
        <p className="text-[12.5px] font-medium text-ink tracking-tightish">
          {event.title}
        </p>
        {event.detail && (
          <p className="mt-0.5 text-[11.5px] text-ink-muted tracking-tightish">
            {event.detail}
          </p>
        )}
        <p className="mt-1 text-[10.5px] text-ink-subtle">
          {formatRelativeKR(event.at)}
          {event.actor && ` · ${event.actor}`}
        </p>
      </div>
    </li>
  );
}

// ============================================================================
// STEP UX-1 — SecondaryActionRow
//
// 작은 텍스트 링크 톤의 추가 작업 행. Primary 검은색 버튼이 유일한 *button shape*가
// 되도록 시각적 무게를 의도적으로 낮춤 (rule_15 "Primary 1개" 정책 강화).
//
// **상태별 표현**:
//   - wired + dataReady + 활성: 검은 텍스트 + hover 강조 + 클릭 가능
//   - wired + !dataReady: 검은 텍스트 + 데이터 가드 inline 라벨 (예: "응대 가능한 문의 없음")
//   - !wired (placeholder): 흐린 텍스트 + "준비 중" pill (사용자 spec — 명시적 disabled)
//   - AI 액션: 검은 텍스트 + italic AI affordance hint
//
// **사용자 spec 준수**:
//   - 모호한 instructional helper 0건 — wired=false 시 자동 "준비 중" fallback
//   - 클릭 가능 시 즉시 동작 (Primary와 동일 흐름)
//   - 클릭 불가 시 명시적 disabled 톤 (애매한 "다른 카드에서 진행" 류 0건)
// ============================================================================

function SecondaryActionRow({
  meta,
  isHandlerWired,
  isDataReady,
  isActive,
  onClick,
}: {
  meta: SupportingActionMeta;
  isHandlerWired: boolean;
  isDataReady: boolean;
  isActive: boolean;
  onClick?: () => void;
}) {
  const isDisabled = !isActive;

  // hint 우선순위 (기존 로직 보존): placeholder > data_guard > AI affordance > 없음
  const hint: { text: string; tone: "future" | "data_guard" | "ai" } | null =
    !isHandlerWired
      ? { text: meta.futureHint ?? FUTURE_LABEL, tone: "future" }
      : !isDataReady
        ? { text: "응대 가능한 문의 없음", tone: "data_guard" }
        : meta.isAi
          ? { text: AI_DRAFT_AFFORDANCE, tone: "ai" }
          : null;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={cn(
        "flex items-center justify-between gap-2 py-1.5 px-1.5 -mx-1.5 rounded text-left",
        "transition-colors",
        isDisabled
          ? "cursor-not-allowed"
          : "hover:bg-surface-muted cursor-pointer"
      )}
    >
      <span
        className={cn(
          "text-[11.5px] tracking-tightish",
          isDisabled ? "text-ink-subtle" : "text-ink"
        )}
      >
        {meta.label}
      </span>
      {hint && (
        <span
          className={cn(
            "text-[9.5px] tracking-tightish shrink-0",
            hint.tone === "ai"
              ? "italic text-ink-subtle"
              : hint.tone === "data_guard"
                ? "text-status-inquiry/80"
                : "text-ink-subtle/70"
          )}
        >
          {hint.text}
        </span>
      )}
    </button>
  );
}
