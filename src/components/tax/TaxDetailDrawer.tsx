"use client";

import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatMoney,
  formatRelativeKR,
  TAX_RECORD_STATUS_LABEL,
  TAX_RECORD_STATUS_COLOR,
  TAX_TYPE_LABEL,
  TAX_POLICY,
  TRANSACTION_STATUS_LABEL,
  SETTLEMENT_STATUS_LABEL,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import { MoneyAmount } from "@/components/shared/MoneyAmount";
import type { TaxRecord, TaxRecordStatus } from "@/types/tax";
import type { Settlement } from "@/types/settlement";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function TaxDetailDrawer() {
  const taxDetailRequest = useArtworkStore((s) => s.taxDetailRequest);
  const closeTaxDetail = useArtworkStore((s) => s.closeTaxDetail);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const settlements = useArtworkStore((s) => s.settlements);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = taxDetailRequest.kind === "open";

  const taxRecord: TaxRecord | undefined = isOpen
    ? Object.values(taxRecords)
        .flat()
        .find((t) => t.id === taxDetailRequest.taxRecordId)
    : undefined;

  const settlement: Settlement | undefined = taxRecord
    ? Object.values(settlements)
        .flat()
        .find((s) => s.id === taxRecord.settlementId)
    : undefined;

  const transaction: Transaction | undefined = taxRecord
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === taxRecord.transactionId)
    : undefined;

  const artwork: Artwork | undefined = taxRecord
    ? artworks.find((a) => a.id === taxRecord.artworkId)
    : undefined;

  return (
    <Drawer open={isOpen} onClose={closeTaxDetail} title="세무 기록 상세">
      {isOpen && taxRecord && transaction && artwork && (
        <TaxView
          key={taxRecord.id}
          taxRecord={taxRecord}
          settlement={settlement}
          transaction={transaction}
          artwork={artwork}
          onClose={closeTaxDetail}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// View
// ============================================================================

interface TaxViewProps {
  taxRecord: TaxRecord;
  settlement: Settlement | undefined;
  transaction: Transaction;
  artwork: Artwork;
  onClose: () => void;
}

function TaxView({
  taxRecord,
  settlement,
  transaction,
  artwork,
  onClose,
}: TaxViewProps) {
  const issueTaxRecord = useArtworkStore((s) => s.issueTaxRecord);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isIssued = taxRecord.status === "ISSUED";
  const canIssue = hasPermission(currentRole, "tax.issue");
  const buttonDisabled = isIssued || !canIssue;

  const handleIssue = () => {
    if (buttonDisabled) return;
    issueTaxRecord(taxRecord.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Separation notice — rule_3 trust signal */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <p className="text-[11px] text-ink tracking-tightish font-medium">
            TaxRecord는 Payment / Settlement와 분리된 세무 기록입니다.
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
            결제 / 정산 데이터와 독립적으로 회계·세무 시스템에서 관리됩니다.
          </p>
        </div>

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

        {/* Linked Transaction + Settlement */}
        <div className="mb-5 px-3 py-2 rounded-md border border-line space-y-1.5">
          <div>
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 Transaction
            </p>
            <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
              {transaction.buyerName.trim() || "(구매자 미지정)"} ·{" "}
              {TRANSACTION_STATUS_LABEL[transaction.status]}
            </p>
          </div>
          {settlement && (
            <div className="pt-1.5 border-t border-line">
              <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
                연결된 Settlement
              </p>
              <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
                <span className="font-mono">{settlement.id}</span> ·{" "}
                {SETTLEMENT_STATUS_LABEL[settlement.status]}
              </p>
            </div>
          )}
        </div>

        {/* Status + tax type */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              상태
            </p>
            <div className="mt-1.5">
              <StatusPill status={taxRecord.status} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              세무 유형
            </p>
            <p className="text-[12px] text-ink mt-1 tracking-tightish font-medium">
              {TAX_TYPE_LABEL[taxRecord.taxType]}
            </p>
          </div>
        </div>

        <Divider />

        {/* Taxable base — headline */}
        <Section label="과세 기준 금액">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-semibold text-ink tracking-tight2 tabular-nums">
                {formatMoney(taxRecord.taxableAmount, taxRecord.currency)}
              </span>
              <span className="text-[11px] text-ink-subtle tracking-tightish font-mono">
                {taxRecord.currency}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish">
              Settlement 기준 — 환율 Lock 적용
            </p>
          </div>
        </Section>

        <Divider />

        {/* Tax breakdown */}
        <Section label="세금 내역">
          <div className="space-y-3">
            <BreakdownLine
              label="부가세 (VAT)"
              pct={`${Math.round(TAX_POLICY.vatRate * 100)}%`}
              amount={taxRecord.vatAmount}
              currency={taxRecord.currency}
              fxRate={taxRecord.fxRateUsed}
              emphasized
            />
            <BreakdownLine
              label="원천세"
              pct={null}
              amount={taxRecord.withholdingAmount}
              currency={taxRecord.currency}
              fxRate={taxRecord.fxRateUsed}
              muted={taxRecord.withholdingAmount === 0}
              hint={
                taxRecord.withholdingAmount === 0
                  ? "v1 기본값 (작가 지급 단계에서 별도 산정)"
                  : undefined
              }
            />
          </div>
          <p className="mt-3 text-[10.5px] text-ink-subtle tracking-tightish">
            v1 세율은 한국 기준입니다 — 해외 거래 / 작가 등록번호별 분기는 후속
            단계에서 분리됩니다.
          </p>
        </Section>

        <Divider />

        {/* STEP 34 — FX Reference 섹션 */}
        <Section label="FX 환산 기준">
          <FXReferencePanel taxRecord={taxRecord} />
        </Section>

        <Divider />

        {/* Audit trail */}
        <Section label="기록 이력">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Meta label="TaxRecord ID" value={taxRecord.id} mono />
            <Meta label="생성" value={formatRelativeKR(taxRecord.createdAt)} />
            {taxRecord.issuedAt ? (
              <Meta
                label="발행"
                value={formatRelativeKR(taxRecord.issuedAt)}
              />
            ) : (
              <Meta label="발행" value="—" muted />
            )}
            <Meta
              label="최근 갱신"
              value={formatRelativeKR(taxRecord.updatedAt)}
            />
          </div>
        </Section>

        {isIssued ? (
          <div className="mt-5 px-3 py-2.5 rounded-md bg-surface-muted border border-line-strong">
            <p className="text-[11.5px] text-ink tracking-tightish font-medium">
              발행 완료된 기록입니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              세무 신고 완료 후 영구 보관 — 수정이 필요한 경우 회계팀과
              상의하세요.
            </p>
          </div>
        ) : (
          <div className="mt-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              세무 발행 완료 시 자동 처리됩니다
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-ink-muted tracking-tightish">
              <li>· 발행 일시 기록</li>
              <li>· Living Timeline에 발행 이벤트 기록</li>
              <li>· Payment / Settlement 객체는 변경 없음 (rule_3)</li>
            </ul>
          </div>
        )}
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        {!isIssued && !canIssue && (
          <ButtonHint
            tone="permission"
            align="inline"
            text={permissionHint("tax.issue")}
          />
        )}
        <Button
          type="button"
          variant="primary"
          onClick={handleIssue}
          disabled={buttonDisabled}
          aria-disabled={buttonDisabled}
        >
          {isIssued ? "발행 완료됨" : "세무 발행 완료"}
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
  hint,
}: {
  label: string;
  pct: string | null;
  amount: number;
  currency: TaxRecord["currency"];
  /**
   * STEP 36 — 외화 거래 시 즉석 KRW 환산을 위한 fxRate. KRW 거래면 무시.
   * TaxRecord.fxRateUsed propagate (Settlement → Tax 환율 일관). display only.
   */
  fxRate?: number;
  emphasized?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  const convertedKRW =
    currency !== "KRW" && typeof fxRate === "number"
      ? Math.round(amount * fxRate)
      : undefined;

  return (
    <div>
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
              {pct}
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
      {hint && (
        <p className="mt-0.5 text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: TaxRecordStatus }) {
  const color = TAX_RECORD_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{TAX_RECORD_STATUS_LABEL[status]}</span>
    </span>
  );
}

// ============================================================================
// FX Reference panel (STEP 34 — Settlement FX Conversion propagate)
// ============================================================================

function FXReferencePanel({ taxRecord }: { taxRecord: TaxRecord }) {
  // KRW 거래 — FX 무관
  if (taxRecord.currency === "KRW") {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        KRW 거래 — FX 환산 없음
      </p>
    );
  }

  // 외화 거래이지만 FX ref 없음 (Settlement에 invoice fx ref가 없었음)
  if (
    !taxRecord.fxReferenceInvoiceId ||
    taxRecord.fxRateUsed === undefined
  ) {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        본 tax record는 FX reference 없이 생성됨 — 회계 신고 시 환율 별도 확인
        필요
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta
        label="환율"
        value={`1 ${taxRecord.currency} = ${taxRecord.fxRateUsed.toLocaleString(
          "en-US",
          { maximumFractionDigits: 4 }
        )} KRW`}
      />
      <Meta
        label="참조 Invoice"
        value={taxRecord.fxReferenceInvoiceId}
        mono
      />
      {typeof taxRecord.taxableAmountKRW === "number" && (
        <Meta
          label="과세표준 (KRW 환산)"
          value={formatMoney(taxRecord.taxableAmountKRW, "KRW")}
        />
      )}
      <div className="col-span-2 mt-1 px-2.5 py-1.5 rounded border border-line bg-surface-muted">
        <p className="text-[10.5px] text-ink-muted tracking-tightish leading-relaxed">
          Invoice lock 시점 환율 기준 (Settlement 경유) — 이후 환율 변동에도
          변경되지 않습니다
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
