"use client";

import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatMoney,
  formatRelativeKR,
  SETTLEMENT_STATUS_LABEL,
  SETTLEMENT_STATUS_COLOR,
  SETTLEMENT_POLICY,
  TRANSACTION_STATUS_LABEL,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import { MoneyAmount } from "@/components/shared/MoneyAmount";
import type { Settlement, SettlementStatus } from "@/types/settlement";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function SettlementDetailDrawer() {
  const settlementDetailRequest = useArtworkStore(
    (s) => s.settlementDetailRequest
  );
  const closeSettlementDetail = useArtworkStore(
    (s) => s.closeSettlementDetail
  );
  const settlements = useArtworkStore((s) => s.settlements);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = settlementDetailRequest.kind === "open";

  const settlement: Settlement | undefined = isOpen
    ? Object.values(settlements)
        .flat()
        .find((s) => s.id === settlementDetailRequest.settlementId)
    : undefined;

  const transaction: Transaction | undefined = settlement
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === settlement.transactionId)
    : undefined;

  const artwork: Artwork | undefined = transaction
    ? artworks.find((a) => a.id === transaction.artworkId)
    : undefined;

  return (
    <Drawer
      open={isOpen}
      onClose={closeSettlementDetail}
      title="정산 상세"
    >
      {isOpen && settlement && transaction && artwork && (
        <SettlementView
          key={settlement.id}
          settlement={settlement}
          transaction={transaction}
          artwork={artwork}
          onClose={closeSettlementDetail}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// View
// ============================================================================

interface SettlementViewProps {
  settlement: Settlement;
  transaction: Transaction;
  artwork: Artwork;
  onClose: () => void;
}

function SettlementView({
  settlement,
  transaction,
  artwork,
  onClose,
}: SettlementViewProps) {
  const completeSettlement = useArtworkStore((s) => s.completeSettlement);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isCompleted = settlement.status === "COMPLETED";
  const canComplete = hasPermission(currentRole, "settlement.complete");
  const buttonDisabled = isCompleted || !canComplete;

  const handleComplete = () => {
    if (buttonDisabled) return;
    completeSettlement(settlement.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Linked artwork */}
        <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <div
            aria-hidden
            className="h-9 w-9 rounded border border-line shrink-0"
            style={{ backgroundColor: artwork.thumbnailColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 작품
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
              {artwork.title}
            </p>
            <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
              {artwork.axid.code}
            </p>
          </div>
        </div>

        {/* Linked transaction */}
        <div className="mb-5 px-3 py-2 rounded-md border border-line">
          <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            연결된 Transaction
          </p>
          <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
            {transaction.buyerName.trim() || "(구매자 미지정)"} ·{" "}
            {TRANSACTION_STATUS_LABEL[transaction.status]}
          </p>
        </div>

        {/* Status */}
        <div className="mb-5">
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            상태
          </p>
          <div className="mt-1.5">
            <StatusPill status={settlement.status} />
          </div>
        </div>

        <Divider />

        {/* Total */}
        <Section label="총 정산액">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-semibold text-ink tracking-tight2 tabular-nums">
                {formatMoney(settlement.totalAmount, settlement.currency)}
              </span>
              <span className="text-[11px] text-ink-subtle tracking-tightish font-mono">
                {settlement.currency}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish">
              결제 수령액 기준 — 환율 Lock 적용
            </p>
          </div>
        </Section>

        <Divider />

        {/* Breakdown */}
        <Section label="분배 내역">
          <div className="space-y-3">
            <BreakdownLine
              label="작가 정산"
              pct={SETTLEMENT_POLICY.artistRate}
              amount={settlement.artistShare}
              currency={settlement.currency}
              fxRate={settlement.fxRateUsed}
              emphasized
            />
            <BreakdownLine
              label="갤러리 수수료"
              pct={SETTLEMENT_POLICY.galleryRate}
              amount={settlement.galleryShare}
              currency={settlement.currency}
              fxRate={settlement.fxRateUsed}
            />
            {typeof settlement.platformFee === "number" &&
              settlement.platformFee > 0 && (
                <BreakdownLine
                  label="플랫폼 수수료"
                  pct={null}
                  amount={settlement.platformFee}
                  currency={settlement.currency}
                  fxRate={settlement.fxRateUsed}
                  muted
                />
              )}
          </div>
          <p className="mt-3 text-[10.5px] text-ink-subtle tracking-tightish">
            v1 분배율은 기본값입니다 — 작가별 약정율은 후속 단계에서 설정으로
            분리됩니다.
          </p>
        </Section>

        <Divider />

        {/* STEP 34 — FX Reference 섹션 */}
        <Section label="FX 환산 기준">
          <FXReferencePanel settlement={settlement} />
        </Section>

        <Divider />

        {/* STEP 95 — AI 정리 보조 (settlement_summary) */}
        <Section label="AI 정리 보조">
          <DocumentWritingAssistButton
            target="settlement_summary"
            buildSourceText={() =>
              `정산 ${settlement.id} · 작품 ${artwork?.title ?? "-"} / ${artwork?.artist.name ?? "-"} · 총 정산액 ${formatMoney(
                settlement.totalAmount,
                settlement.currency,
              )} · 작가 분배 ${formatMoney(
                settlement.artistShare,
                settlement.currency,
              )} · 갤러리 분배 ${formatMoney(
                settlement.galleryShare,
                settlement.currency,
              )}.`
            }
            buildContext={() =>
              `Settlement ${settlement.id} · ${settlement.status}`
            }
            onApply={(text) => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(() => {});
              }
            }}
            applyButtonLabel="복사"
          />
        </Section>

        <Divider />

        {/* STEP 96 — 다국어 보기 (settlement projection) */}
        <Section label="다국어 보기">
          <TranslationToolbar
            buildSourceText={() =>
              `정산 ${settlement.id} · 작품 ${artwork?.title ?? "-"} / ${artwork?.artist.name ?? "-"} · 총 정산액 ${formatMoney(
                settlement.totalAmount,
                settlement.currency,
              )} · 작가 분배 ${formatMoney(
                settlement.artistShare,
                settlement.currency,
              )} · 갤러리 분배 ${formatMoney(
                settlement.galleryShare,
                settlement.currency,
              )}.`
            }
            domain="general"
          />
        </Section>

        <Divider />

        {/* Audit trail */}
        <Section label="정산 이력">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Meta label="Settlement ID" value={settlement.id} mono />
            <Meta label="생성" value={formatRelativeKR(settlement.createdAt)} />
            {settlement.settledAt ? (
              <Meta
                label="완료"
                value={formatRelativeKR(settlement.settledAt)}
              />
            ) : (
              <Meta label="완료" value="—" muted />
            )}
            <Meta label="최근 갱신" value={formatRelativeKR(settlement.updatedAt)} />
          </div>
        </Section>

        {isCompleted ? (
          <div className="mt-5 px-3 py-2.5 rounded-md bg-status-paid/5 border border-status-paid/30">
            <p className="text-[11.5px] text-status-paid tracking-tightish font-medium">
              정산 완료된 거래입니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              작가·갤러리 분배가 완료되었습니다. 거래 종료(CLOSED) 전환은 작품
              상세에서 별도로 진행하세요.
            </p>
          </div>
        ) : (
          <div className="mt-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              정산 완료 시 자동 처리됩니다
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-ink-muted tracking-tightish">
              <li>· Transaction → 정산 완료</li>
              <li>· Living Timeline에 분배 내역 기록</li>
              <li>· 작품 상태 변경 없음 (CLOSED 전환은 수동)</li>
            </ul>
          </div>
        )}
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        {!isCompleted && !canComplete && (
          <ButtonHint
            tone="permission"
            align="inline"
            text={permissionHint("settlement.complete")}
          />
        )}
        <Button
          type="button"
          variant="primary"
          onClick={handleComplete}
          disabled={buttonDisabled}
          aria-disabled={buttonDisabled}
        >
          {isCompleted ? "정산 완료됨" : "정산 완료"}
        </Button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function BreakdownLine({
  label,
  pct,
  amount,
  currency,
  fxRate,
  emphasized,
  muted,
}: {
  label: string;
  pct: number | null;
  amount: number;
  currency: Settlement["currency"];
  /**
   * STEP 36 — 외화 거래 시 즉석 KRW 환산을 위한 fxRate. KRW 거래면 무시.
   * Settlement.fxRateUsed propagate — fxSnapshot lock 시점 환율 기준이라 view
   * 시점과 무관, read-only.
   */
  fxRate?: number;
  emphasized?: boolean;
  muted?: boolean;
}) {
  // 외화 거래 + fxRate 있음 → KRW 환산 즉석 계산. 도메인 로직 변경 0,
  // display only.
  const convertedKRW =
    currency !== "KRW" && typeof fxRate === "number"
      ? Math.round(amount * fxRate)
      : undefined;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={`text-[12.5px] tracking-tightish ${
            emphasized
              ? "text-ink font-medium"
              : muted
              ? "text-ink-subtle"
              : "text-ink-muted"
          }`}
        >
          {label}
        </span>
        {pct !== null && (
          <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono tabular-nums">
            {Math.round(pct * 100)}%
          </span>
        )}
      </div>
      <MoneyAmount
        amount={amount}
        currency={currency}
        convertedKRW={convertedKRW}
        emphasized={emphasized}
        muted={muted}
      />
    </div>
  );
}

function StatusPill({ status }: { status: SettlementStatus }) {
  const color = SETTLEMENT_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{SETTLEMENT_STATUS_LABEL[status]}</span>
    </span>
  );
}

// ============================================================================
// FX Reference panel (STEP 34 — Settlement FX Conversion)
// ============================================================================

function FXReferencePanel({ settlement }: { settlement: Settlement }) {
  // KRW 거래 — FX 무관
  if (settlement.currency === "KRW") {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        KRW 거래 — FX 환산 없음
      </p>
    );
  }

  // 외화 거래이지만 invoice fx ref 없음 (pre-STEP32 invoice / unknown pair / no locked invoice)
  if (
    !settlement.fxReferenceInvoiceId ||
    settlement.fxRateUsed === undefined
  ) {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        본 settlement는 invoice FX snapshot 없이 생성됨 — 정산 시 환율 미반영
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta
        label="환율 쌍"
        value={`${settlement.fxBaseCurrency} → ${settlement.fxQuoteCurrency}`}
        mono
      />
      <Meta
        label="환율"
        value={`1 ${settlement.fxBaseCurrency} = ${settlement.fxRateUsed.toLocaleString(
          "en-US",
          { maximumFractionDigits: 4 }
        )} ${settlement.fxQuoteCurrency}`}
      />
      <Meta
        label="참조 Invoice"
        value={settlement.fxReferenceInvoiceId}
        mono
      />
      {typeof settlement.convertedTotalKRW === "number" && (
        <Meta
          label="총 정산액 (KRW 환산)"
          value={formatMoney(settlement.convertedTotalKRW, "KRW")}
        />
      )}
      <div className="col-span-2 mt-1 px-2.5 py-1.5 rounded border border-line bg-surface-muted">
        <p className="text-[10.5px] text-ink-muted tracking-tightish leading-relaxed">
          Invoice lock 시점 환율 기준 — 이후 환율 변동에도 변경되지 않습니다
        </p>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
        {label}
      </p>
      <p
        className={`text-[12px] mt-0.5 tracking-tightish ${
          muted ? "text-ink-subtle" : "text-ink-muted"
        } ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line my-5" aria-hidden />;
}
