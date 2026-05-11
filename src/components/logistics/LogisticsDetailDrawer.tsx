"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  LOGISTICS_STATUS_LABEL,
  LOGISTICS_STATUS_COLOR,
  LOGISTICS_STATUS_ORDER,
  TRANSACTION_STATUS_LABEL,
} from "@/lib/utils";
import type {
  Logistics,
  LogisticsStatus,
} from "@/types/logistics";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function LogisticsDetailDrawer() {
  const logisticsDetailRequest = useArtworkStore(
    (s) => s.logisticsDetailRequest
  );
  const closeLogisticsDetail = useArtworkStore((s) => s.closeLogisticsDetail);
  const logistics = useArtworkStore((s) => s.logistics);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = logisticsDetailRequest.kind === "open";

  const log: Logistics | undefined = isOpen
    ? Object.values(logistics)
        .flat()
        .find((l) => l.id === logisticsDetailRequest.logisticsId)
    : undefined;

  const transaction: Transaction | undefined = log
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === log.transactionId)
    : undefined;

  const artwork: Artwork | undefined = log
    ? artworks.find((a) => a.id === log.artworkId)
    : undefined;

  return (
    <Drawer
      open={isOpen}
      onClose={closeLogisticsDetail}
      title="배송 관리"
    >
      {isOpen && log && transaction && artwork && (
        <LogisticsForm
          key={log.id}
          log={log}
          transaction={transaction}
          artwork={artwork}
          onClose={closeLogisticsDetail}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface LogisticsFormProps {
  log: Logistics;
  transaction: Transaction;
  artwork: Artwork;
  onClose: () => void;
}

function LogisticsForm({
  log,
  transaction,
  artwork,
  onClose,
}: LogisticsFormProps) {
  const updateLogistics = useArtworkStore((s) => s.updateLogistics);
  const updateLogisticsStatus = useArtworkStore(
    (s) => s.updateLogisticsStatus
  );
  // STEP 50 — Logistics provider sync 진입점
  const syncLogisticsFromProvider = useArtworkStore(
    (s) => s.syncLogisticsFromProvider
  );

  // STEP 15 — Logistics is locked once it reaches DELIVERED or CONDITION_CHECKED
  // (rule_4 Document Trust). UI mirrors the store guard.
  const isLocked = log.status === "DELIVERED" || log.status === "CONDITION_CHECKED";

  const [carrierName, setCarrierName] = React.useState(log.carrierName);
  const [trackingNumber, setTrackingNumber] = React.useState(log.trackingNumber);
  const [pickupDate, setPickupDate] = React.useState(log.pickupDate);
  const [deliveryDate, setDeliveryDate] = React.useState(log.deliveryDate);
  const [memo, setMemo] = React.useState(log.memo);
  const [status, setStatus] = React.useState<LogisticsStatus>(log.status);

  // STEP 50 — log prop이 sync 후 새로 전달되면 form state 동기화
  // (sync는 store 직접 patch — drawer는 외부 변경 반영)
  React.useEffect(() => {
    setCarrierName(log.carrierName);
    setTrackingNumber(log.trackingNumber);
    setStatus(log.status);
  }, [log.carrierName, log.trackingNumber, log.status]);

  const handleSync = React.useCallback(() => {
    if (isLocked) return;
    syncLogisticsFromProvider(log.id);
  }, [isLocked, syncLogisticsFromProvider, log.id]);

  const isDirty =
    carrierName !== log.carrierName ||
    trackingNumber !== log.trackingNumber ||
    pickupDate !== log.pickupDate ||
    deliveryDate !== log.deliveryDate ||
    memo !== log.memo ||
    status !== log.status;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return; // belt-and-braces; store also guards
    if (!isDirty) return;

    // Apply non-status patch first (silent in timeline)
    const fieldsChanged =
      carrierName !== log.carrierName ||
      trackingNumber !== log.trackingNumber ||
      pickupDate !== log.pickupDate ||
      deliveryDate !== log.deliveryDate ||
      memo !== log.memo;
    if (fieldsChanged) {
      updateLogistics(log.id, {
        carrierName,
        trackingNumber,
        pickupDate,
        deliveryDate,
        memo,
      });
    }

    // Apply status transition (emits dedicated timeline event)
    if (status !== log.status) {
      updateLogisticsStatus(log.id, status);
    }

    onClose();
  };

  const statusOptions = LOGISTICS_STATUS_ORDER.map((s) => ({
    value: s,
    label: LOGISTICS_STATUS_LABEL[s],
  }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Read-only banner (STEP 15) — locked logistics, immutable per rule_4 */}
        {isLocked && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
            <div className="flex items-center gap-2">
              <LockMiniIcon />
              <p className="text-[11.5px] text-ink font-semibold tracking-tightish">
                {LOGISTICS_STATUS_LABEL[log.status]} · 읽기 전용
              </p>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
              배송 완료 이후 물류 기록은 감사 가능한 기록으로 보존되며 수정할 수 없습니다.
            </p>
          </div>
        )}

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

        {/* Status pill (current) + select */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              현재 상태
            </p>
            <div className="mt-1.5">
              <StatusPill status={log.status} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              생성
            </p>
            <p className="text-[11.5px] text-ink-muted mt-1 tracking-tightish">
              {formatRelativeKR(log.createdAt)}
            </p>
          </div>
        </div>

        <Section label="배송 상태">
          <Select
            label="상태"
            value={status}
            onChange={(e) => setStatus(e.target.value as LogisticsStatus)}
            options={statusOptions}
            hint="변경 시 Living Timeline에 ‘배송 상태 변경’ 이벤트가 추가됩니다."
            disabled={isLocked}
          />
        </Section>

        <Divider />

        <Section label="운송 정보">
          <TextField
            label="운송사"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="예: SafeArt Logistics"
            disabled={isLocked}
          />
          <TextField
            label="운송장 번호"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="예: SAL-2026-XXXX"
            disabled={isLocked}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="픽업일"
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              disabled={isLocked}
            />
            <TextField
              label="인도일"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              disabled={isLocked}
            />
          </div>
        </Section>

        <Divider />

        <Section label="메모">
          <Textarea
            label=""
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={4}
            placeholder="특이사항, 보험, 연락처 등"
            disabled={isLocked}
          />
          {!isLocked && (
            <DocumentWritingAssistButton
              target="shipment_summary"
              buildSourceText={() => memo}
              buildContext={() =>
                `Logistics ${log.id} · ${log.status} · 작품 ${artwork?.title ?? ""} · 운송사 ${carrierName ?? ""}`
              }
              onApply={setMemo}
              applyButtonLabel="메모에 적용"
              className="mt-2"
            />
          )}
        </Section>

        <Divider />

        {/* STEP 96 — 다국어 보기 (shipment summary projection) */}
        <Section label="다국어 보기">
          <TranslationToolbar
            buildSourceText={() =>
              `배송 ${log.id} · 작품 ${artwork?.title ?? "-"} · 운송사 ${carrierName ?? "-"} · 상태 ${log.status}${memo.trim().length > 0 ? `. 메모: ${memo}` : ""}`
            }
            domain="general"
          />
        </Section>

        <Divider />

        {/* STEP 50 — Provider Sync 섹션. rule_21 외부 hook. */}
        <ProviderSyncSection
          log={log}
          isLocked={isLocked}
          onSync={handleSync}
        />
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          {isLocked ? "닫기" : "닫기"}
        </Button>
        {!isLocked && (
          <Button
            type="submit"
            variant="primary"
            disabled={!isDirty}
            aria-disabled={!isDirty}
          >
            저장
          </Button>
        )}
      </footer>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: LogisticsStatus }) {
  const color = LOGISTICS_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{LOGISTICS_STATUS_LABEL[status]}</span>
    </span>
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

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// STEP 50 — Provider Sync section
//
// rule_21 외부 hook. Mock LogisticsProvider 결과를 Logistics record의 옵셔널
// provider 필드(`providerLastSyncedAt` / `providerNote` /
// `providerEstimatedDelivery` 등)로 patch 후 표시.
//
// 표현 정책: "운영 참고" / "provider 기준" / "최근 조회 시점" 사용.
// "배송 보장" / "보험 보장" / "확정 도착" / "법적 효력" 0건.
// ---------------------------------------------------------------------------

function ProviderSyncSection({
  log,
  isLocked,
  onSync,
}: {
  log: Logistics;
  isLocked: boolean;
  onSync: () => void;
}) {
  const hasSynced = !!log.providerLastSyncedAt;
  const lastSyncedRel = hasSynced
    ? formatRelativeKR(log.providerLastSyncedAt as string)
    : null;

  return (
    <Section label="Provider Sync">
      <div className="rounded-md border border-line bg-surface-muted/40 px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11.5px] font-medium text-ink tracking-tightish">
              운영 참고 sync
            </span>
            {log.providerIsMock && (
              <span className="text-[9.5px] tracking-tightish px-1.5 py-0.5 rounded-full border border-line text-ink-subtle bg-surface italic shrink-0">
                Mock provider
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={isLocked}
            aria-disabled={isLocked}
          >
            물류 상태 동기화
          </Button>
        </div>

        {!hasSynced ? (
          <p className="text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed italic">
            아직 provider sync 기록 없음. 운송사 측 상태 / tracking을 가져오려면
            상단 버튼을 누르세요. 결과는 운영 참고용이며 배송 / 도착 / 보험을
            보장하지 않습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <ProviderRow label="Provider" value={log.providerId ?? "—"} />
            <ProviderRow label="Tracking ID" value={log.trackingNumber || "—"} mono />
            <ProviderRow label="Carrier" value={log.carrierName || "—"} />
            <ProviderRow
              label="추정 인도일"
              value={log.providerEstimatedDelivery || "—"}
              hint="provider 추정 · 확정 도착이 아닙니다"
            />
            <ProviderRow
              label="최근 조회 시점"
              value={lastSyncedRel ?? "—"}
            />
            {log.providerNote && (
              <div className="mt-1.5 pt-2 border-t border-line">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium mb-1">
                  Status note (provider 기준)
                </p>
                <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
                  {log.providerNote}
                </p>
              </div>
            )}
          </div>
        )}

        {isLocked && (
          <p className="mt-2 text-[10px] text-ink-subtle tracking-tightish italic">
            ※ 배송 완료 이후 record는 immutable — 추가 sync는 비활성화됩니다.
          </p>
        )}
      </div>
    </Section>
  );
}

function ProviderRow({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium">
        {label}
      </span>
      <div className="min-w-0">
        <p
          className={
            mono
              ? "text-[11.5px] font-mono text-ink truncate"
              : "text-[11.5px] text-ink truncate tracking-tightish"
          }
        >
          {value}
        </p>
        {hint && (
          <p className="text-[9.5px] text-ink-subtle tracking-tightish italic mt-0.5">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
