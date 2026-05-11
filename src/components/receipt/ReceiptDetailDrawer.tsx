"use client";

// ============================================================================
// ReceiptDetailDrawer — STEP 87 — Cash Receipt 운영 surface
//
// **본 drawer가 무엇을 하는가**:
//   1. DRAFT receipt: "발행" 버튼으로 ISSUED 진입 (LOCK)
//   2. ISSUED receipt: [프린트] / [PDF 저장] / [고객 발송 준비] 액션 + 메타 표시
//   3. Version chain: 새 버전 생성 / 이전 버전 표시 (Invoice Document Lifecycle 패턴)
//   4. 발송 흐름: deliveryStatus 라벨 + 발송 준비 시각 / 운영자 / 수신자 contact
//
// **사용자 spec §1 PRINT SUPPORT**:
//   - [프린트] → markReceiptPrinted() + window.print() (browser native)
//   - [PDF 저장] → markReceiptPdfExported() + window.print() (사용자가 dialog
//     에서 "PDF로 저장" 선택 — browser native, 외부 라이브러리 0개)
//   - [고객 발송 준비] → 메모 입력 modal → prepareReceiptForSend(receiptId, contact)
//
// **사용자 spec §2 CUSTOMER SEND READY**:
//   - 실제 이메일/SMS 발송 0건
//   - 복사용 고객 전달 요약 (clipboard helper)
//   - future email/SMS API integration slot 표시 (deliveryStatus 라벨)
//
// **사용자 spec §6 UX PRINCIPLE**:
//   - "발급 후 바로 고객에게 전달 가능한 문서" 느낌
//   - tax office software 톤 *금지*
//   - 간단하고 고급스럽게 (rule_16 minimalism + Apple/OpenAI tone)
//
// **AI Direction / Trust Layer 정책 일관**:
//   - 사용 표현: "발급 기록" / "운영 참고 영수증" / "거래 확인용" / "고객 전달용" /
//     "발송 준비 완료"
//   - 금지: "법적 증빙" / "국세청 발급" / "세무 신고" / "공식 세무 효력"
// ============================================================================

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";
import {
  RECEIPT_STATUS_LABEL_KR,
  RECEIPT_DELIVERY_STATUS_LABEL_KR,
} from "@/types/receipt";
import type { Receipt, ReceiptDeliveryStatus } from "@/types/receipt";
import { ReceiptPrintView } from "./ReceiptPrintView";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";

export function ReceiptDetailDrawer() {
  const request = useArtworkStore((s) => s.receiptDetailRequest);
  const closeReceiptDetail = useArtworkStore((s) => s.closeReceiptDetail);

  const isOpen = request.kind === "open";
  const receiptId = isOpen ? request.receiptId : null;

  // Locate receipt + chain context
  const receiptsBucket = useArtworkStore((s) => s.receipts);
  const artworks = useArtworkStore((s) => s.artworks);
  const transactions = useArtworkStore((s) => s.transactions);

  const issueReceipt = useArtworkStore((s) => s.issueReceipt);
  const createReceiptVersion = useArtworkStore((s) => s.createReceiptVersion);
  const markReceiptPrinted = useArtworkStore((s) => s.markReceiptPrinted);
  const markReceiptPdfExported = useArtworkStore(
    (s) => s.markReceiptPdfExported
  );
  const prepareReceiptForSend = useArtworkStore(
    (s) => s.prepareReceiptForSend
  );

  // Find the target receipt + sibling chain
  const { receipt, allInTransaction } = React.useMemo(() => {
    if (!receiptId) return { receipt: null, allInTransaction: [] as Receipt[] };
    for (const list of Object.values(receiptsBucket)) {
      const r = list.find((x) => x.id === receiptId);
      if (r) return { receipt: r, allInTransaction: list };
    }
    return { receipt: null, allInTransaction: [] };
  }, [receiptId, receiptsBucket]);

  const transaction = React.useMemo(() => {
    if (!receipt) return null;
    return (
      Object.values(transactions)
        .flat()
        .find((t) => t.id === receipt.transactionId) ?? null
    );
  }, [receipt, transactions]);

  const artwork = React.useMemo(() => {
    if (!receipt) return null;
    return artworks.find((a) => a.id === receipt.artworkId) ?? null;
  }, [receipt, artworks]);

  // Version chain — head 부터 root 까지 backward parent 따라 수집.
  const versionChain = React.useMemo(() => {
    if (!receipt) return [] as Receipt[];
    const byId = new Map(allInTransaction.map((r) => [r.id, r] as const));
    const ofPayment = allInTransaction.filter(
      (r) => r.paymentId === receipt.paymentId
    );
    // chain head = 같은 paymentId 안에서 자식 없는 가장 신선한 record
    const hasChild = new Set(
      ofPayment
        .map((r) => r.parentReceiptId)
        .filter((id): id is string => id !== null)
    );
    const heads = ofPayment.filter((r) => !hasChild.has(r.id));
    const head =
      heads.find((r) => isAncestor(r, receipt.id, byId)) ??
      heads[0] ??
      receipt;

    const result: Receipt[] = [];
    const visited = new Set<string>();
    let cur: Receipt | undefined = head;
    while (cur && !visited.has(cur.id)) {
      result.push(cur);
      visited.add(cur.id);
      cur = cur.parentReceiptId ? byId.get(cur.parentReceiptId) : undefined;
    }
    return result; // head → root order (latest 먼저)
  }, [receipt, allInTransaction]);

  const hasNewerVersion = React.useMemo(() => {
    if (!receipt) return false;
    return allInTransaction.some(
      (r) => r.parentReceiptId === receipt.id && r.paymentId === receipt.paymentId
    );
  }, [receipt, allInTransaction]);

  // Send-prepare 입력 modal 상태
  const [sendPrepareOpen, setSendPrepareOpen] = React.useState(false);
  const [sendContactInput, setSendContactInput] = React.useState("");

  // Reset modal state when receipt changes
  React.useEffect(() => {
    setSendPrepareOpen(false);
    setSendContactInput(receipt?.recipientContact ?? "");
  }, [receipt?.id, receipt?.recipientContact]);

  if (!receipt) {
    return (
      <Drawer
        open={isOpen}
        onClose={closeReceiptDetail}
        title="영수증 상세"
        widthClass="w-[520px]"
      >
        <div className="p-6 text-[13px] text-ink-subtle">
          영수증을 찾을 수 없습니다.
        </div>
      </Drawer>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Action handlers
  // ──────────────────────────────────────────────────────────

  const handleIssue = () => {
    if (receipt.status !== "DRAFT") return;
    issueReceipt(receipt.id);
  };

  const handlePrint = () => {
    markReceiptPrinted(receipt.id);
    // 짧은 tick 후 print — store update가 print view에 반영되도록.
    if (typeof window !== "undefined") {
      window.setTimeout(() => window.print(), 50);
    }
  };

  const handlePdfSave = () => {
    markReceiptPdfExported(receipt.id);
    // browser native print dialog → 사용자가 "PDF로 저장" 선택.
    // 외부 PDF 라이브러리 0개 (사용자 spec §1).
    if (typeof window !== "undefined") {
      window.setTimeout(() => window.print(), 50);
    }
  };

  const handleSendPrepareConfirm = () => {
    prepareReceiptForSend(receipt.id, sendContactInput.trim() || undefined);
    setSendPrepareOpen(false);
  };

  const handleNewVersion = () => {
    if (typeof window === "undefined") return;
    const reason = window.prompt(
      "새 버전 생성 사유 (선택 — 비워둘 수 있음)",
      ""
    );
    if (reason === null) return; // 취소
    createReceiptVersion(receipt.id, reason || undefined);
  };

  const handleCopySummary = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    const summary = buildCustomerSummary(receipt, artwork?.title ?? null);
    navigator.clipboard.writeText(summary).catch(() => {
      // best-effort — clipboard API 거부 시 silent (운영 흐름 방해 회피)
    });
  };

  const isLocked = receipt.isLocked || receipt.status === "ISSUED";
  const deliveryStatus: ReceiptDeliveryStatus =
    receipt.deliveryStatus ?? "not_prepared";

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={closeReceiptDetail}
        title={`영수증 · v${receipt.version}`}
        widthClass="w-[520px]"
      >
        {/* Body — print 시 본 영역은 숨겨지고, 별도 mount된 ReceiptPrintView만 보임. */}
        <div className="receipt-drawer-body flex flex-col h-full">
          {/* Status banner */}
          <div className="px-6 pt-4 pb-3 border-b border-line">
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
              <StatusDot status={receipt.status} />
              <span>{RECEIPT_STATUS_LABEL_KR[receipt.status]}</span>
              {hasNewerVersion && (
                <span className="text-ink-subtle/70">· 새 버전 존재</span>
              )}
            </div>
            {isLocked && receipt.finalizedAt && (
              <p className="mt-1.5 text-[11.5px] text-ink-muted">
                발행 완료 ·{" "}
                <span className="tabular-nums">
                  {formatDateTime(receipt.finalizedAt)}
                </span>
                {receipt.lockedBy && (
                  <span className="text-ink-subtle"> · {receipt.lockedBy}</span>
                )}
              </p>
            )}
            <p className="mt-1 text-[10.5px] text-ink-subtle">
              운영 참고 영수증 · 거래 확인용 · 고객 전달용
            </p>
          </div>

          {/* Amount */}
          <div className="px-6 py-5 border-b border-line">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle">
              수령 금액
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink tracking-tight">
              {formatMoney(receipt.amount, receipt.currency)}
            </p>
            {transaction && (
              <p className="mt-1 text-[10.5px] text-ink-subtle font-mono tabular-nums">
                거래 · {transaction.id} · 결제 · {receipt.paymentId}
              </p>
            )}
          </div>

          {/* Item */}
          {artwork && (
            <div className="px-6 py-4 border-b border-line">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle mb-2">
                거래 항목
              </p>
              <p className="text-[13px] font-medium text-ink">
                {artwork.title || "(제목 없음)"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                {artwork.artist.name || "—"}
                {artwork.year ? ` · ${artwork.year}` : ""}
              </p>
            </div>
          )}

          {/* Action area — ISSUED 시 print/PDF/send, DRAFT 시 issue */}
          <div className="px-6 py-4 border-b border-line">
            {!isLocked ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-ink-subtle">
                  초안 상태 · 발행 시 잠금 적용 (rule_4)
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleIssue}
                  className="self-start"
                >
                  영수증 발행
                </Button>
                <p className="text-[10.5px] text-ink-subtle/80 mt-1">
                  발행 후 [프린트] / [PDF 저장] / [고객 발송 준비] 사용
                  가능합니다.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handlePrint}
                  >
                    프린트
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handlePdfSave}
                  >
                    PDF 저장
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSendPrepareOpen((v) => !v)}
                  >
                    고객 발송 준비
                  </Button>
                </div>
                {receipt.lastPrintedAt && (
                  <p className="text-[10.5px] text-ink-subtle">
                    최근 인쇄 ·{" "}
                    <span className="tabular-nums">
                      {formatDateTime(receipt.lastPrintedAt)}
                    </span>
                  </p>
                )}
                {receipt.lastPdfExportedAt && (
                  <p className="text-[10.5px] text-ink-subtle">
                    최근 PDF 저장 ·{" "}
                    <span className="tabular-nums">
                      {formatDateTime(receipt.lastPdfExportedAt)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Send-prepare modal (inline) */}
          {sendPrepareOpen && isLocked && (
            <div className="px-6 py-4 border-b border-line bg-surface-muted/30">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle mb-2">
                고객 발송 준비
              </p>
              <label className="block text-[11.5px] text-ink-muted mb-1.5">
                수신자 contact (이메일 / 전화번호 / 식별 메모)
              </label>
              <input
                type="text"
                value={sendContactInput}
                onChange={(e) => setSendContactInput(e.target.value)}
                placeholder="예: customer@example.com"
                className="w-full h-9 px-3 text-[12.5px] border border-line rounded-md bg-surface text-ink focus:outline-none focus:border-ink-muted"
              />
              <p className="mt-1.5 text-[10.5px] text-ink-subtle/80">
                실제 발송은 본 STEP에서 지원하지 않습니다 — *발송 준비 완료*
                상태 기록 + 운영 참고 메모만 저장됩니다. 외부 도구로 직접
                전달해주세요.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSendPrepareConfirm}
                >
                  발송 준비 기록
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSendPrepareOpen(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySummary}
                  className="ml-auto"
                >
                  요약 복사
                </Button>
              </div>
            </div>
          )}

          {/* Delivery status panel */}
          {isLocked && (
            <div className="px-6 py-4 border-b border-line">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle mb-2">
                발송 상태
              </p>
              <div className="flex items-center gap-2 text-[11.5px] text-ink">
                <DeliveryDot status={deliveryStatus} />
                <span>{RECEIPT_DELIVERY_STATUS_LABEL_KR[deliveryStatus]}</span>
              </div>
              {receipt.preparedForSendAt && (
                <p className="mt-1.5 text-[10.5px] text-ink-subtle">
                  준비 시각 ·{" "}
                  <span className="tabular-nums">
                    {formatDateTime(receipt.preparedForSendAt)}
                  </span>
                  {receipt.preparedForSendBy && (
                    <span> · {receipt.preparedForSendBy}</span>
                  )}
                </p>
              )}
              {receipt.recipientContact && (
                <p className="mt-1 text-[10.5px] text-ink-subtle">
                  수신자 · {receipt.recipientContact}
                </p>
              )}
              {!receipt.preparedForSendAt && (
                <p className="mt-1 text-[10.5px] text-ink-subtle/70">
                  아직 발송 준비가 시작되지 않았습니다.
                </p>
              )}
              {/* future-ready hint */}
              <p className="mt-2 text-[10px] text-ink-subtle/60 italic">
                외부 발송 연동 (이메일 / SMS API)은 추후 STEP에서 추가 예정 —
                본 STEP에서는 운영 메모 수준입니다.
              </p>
            </div>
          )}

          {/* Version chain */}
          {versionChain.length > 1 && (
            <div className="px-6 py-4 border-b border-line">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle mb-2">
                버전 이력
              </p>
              <ul className="flex flex-col gap-1">
                {versionChain.map((r) => {
                  const isCurrent = r.id === receipt.id;
                  return (
                    <li
                      key={r.id}
                      className={
                        "flex items-center justify-between text-[11.5px] tabular-nums px-2 py-1 rounded-sm border " +
                        (isCurrent
                          ? "bg-surface border-line-strong text-ink font-medium"
                          : "bg-transparent border-line/40 text-ink-muted")
                      }
                    >
                      <span>v{r.version}</span>
                      <span className="text-[10.5px]">
                        {RECEIPT_STATUS_LABEL_KR[r.status]}
                        {r.id === receipt.id && hasNewerVersion
                          ? " · 자식 존재"
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* STEP 95 — AI 정리 보조 (receipt) */}
          <div className="px-6 pb-4">
            <DocumentWritingAssistButton
              target="receipt"
              buildSourceText={() =>
                `영수증 v${receipt.version} · 금액 ${formatMoney(
                  receipt.amount,
                  receipt.currency,
                )} · 작품 ${artwork?.title ?? "-"} · 상태 ${
                  RECEIPT_STATUS_LABEL_KR[receipt.status]
                }.`
              }
              buildContext={() =>
                `Receipt ${receipt.id} · ${receipt.status} · 작품 ${
                  artwork?.title ?? ""
                }`
              }
              onApply={(text) => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(text).catch(() => {});
                }
              }}
              applyButtonLabel="복사"
            />
          </div>

          {/* STEP 96 — 다국어 보기 (receipt translation projection) */}
          <div className="px-6 pb-4">
            <TranslationToolbar
              buildSourceText={() =>
                `영수증 v${receipt.version} · 금액 ${formatMoney(
                  receipt.amount,
                  receipt.currency,
                )} · 작품 ${artwork?.title ?? "-"} · 상태 ${
                  RECEIPT_STATUS_LABEL_KR[receipt.status]
                }.`
              }
              domain="invoice"
            />
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 mt-auto border-t border-line bg-surface flex items-center gap-2">
            {isLocked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNewVersion}
              >
                새 버전 생성
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeReceiptDetail}
              className="ml-auto"
            >
              닫기
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Hidden printable area — only visible during window.print() */}
      {isLocked && (
        <div className="hidden print:block">
          <ReceiptPrintView
            receipt={receipt}
            artwork={artwork}
            transaction={transaction}
            customerLabel={receipt.recipientContact}
          />
        </div>
      )}
    </>
  );
}

// ============================================================================
// helpers
// ============================================================================

function isAncestor(
  candidate: Receipt,
  targetId: string,
  byId: Map<string, Receipt>
): boolean {
  let cur: Receipt | undefined = candidate;
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    if (cur.id === targetId) return true;
    visited.add(cur.id);
    cur = cur.parentReceiptId ? byId.get(cur.parentReceiptId) : undefined;
  }
  return false;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function StatusDot({ status }: { status: Receipt["status"] }) {
  const cls = status === "ISSUED" ? "bg-ink" : "bg-ink-subtle";
  return <span className={"inline-block h-1.5 w-1.5 rounded-full " + cls} />;
}

function DeliveryDot({ status }: { status: ReceiptDeliveryStatus }) {
  const cls =
    status === "prepared"
      ? "bg-ink"
      : status === "pending_external"
        ? "bg-ink-muted"
        : "bg-ink-subtle";
  return <span className={"inline-block h-1.5 w-1.5 rounded-full " + cls} />;
}

/**
 * 고객 전달용 요약 — 운영자가 수기로 메신저 / 이메일에 붙여넣기 위한 간단한
 * plain-text 형식. 운영 톤 (사용자 spec §4 준수).
 */
function buildCustomerSummary(
  receipt: Receipt,
  artworkTitle: string | null
): string {
  const lines: string[] = [
    "[운영 참고 영수증]",
    `발급 시각: ${formatDateTime(receipt.issuedAt)}`,
    `금액: ${formatMoney(receipt.amount, receipt.currency)}`,
  ];
  if (artworkTitle) lines.push(`작품: ${artworkTitle}`);
  lines.push("거래 확인용 · 고객 전달용");
  lines.push("(AXVELA Gallery 운영 기록)");
  return lines.join("\n");
}
