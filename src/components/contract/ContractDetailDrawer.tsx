"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
  TRANSACTION_STATUS_LABEL,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { Contract, ContractStatus } from "@/types/contract";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";
// STEP 129 — Contract 인쇄 surface mount (LOCKED 한정)
import { ContractPrintView } from "./ContractPrintView";
// Document Lifecycle Clarity STEP — parity with Invoice drawer (Timeline + Approval slot only)
import { DocumentActivityTimeline } from "@/components/document-lifecycle/DocumentActivityTimeline";
import { ApprovalSlotPlaceholder } from "@/components/document-lifecycle/ApprovalSlotPlaceholder";
// STEP 132 Phase 2 Commit 2 — Server-side PDF download helper
import { downloadContractPDF } from "@/lib/pdf/client";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function ContractDetailDrawer() {
  const contractDetailRequest = useArtworkStore(
    (s) => s.contractDetailRequest
  );
  const closeContractDetail = useArtworkStore((s) => s.closeContractDetail);
  const contracts = useArtworkStore((s) => s.contracts);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = contractDetailRequest.kind === "open";

  const contract: Contract | undefined = isOpen
    ? Object.values(contracts)
        .flat()
        .find((c) => c.id === contractDetailRequest.contractId)
    : undefined;

  const transaction: Transaction | undefined = contract
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === contract.transactionId)
    : undefined;

  const artwork: Artwork | undefined = contract
    ? artworks.find((a) => a.id === contract.artworkId)
    : undefined;

  const parent: Contract | undefined = contract?.parentContractId
    ? Object.values(contracts)
        .flat()
        .find((c) => c.id === contract.parentContractId)
    : undefined;

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={closeContractDetail}
        title={contract ? `계약 상세 · v${contract.version}` : "계약 상세"}
      >
        {isOpen && contract && transaction && artwork && (
          <ContractView
            key={contract.id}
            contract={contract}
            transaction={transaction}
            artwork={artwork}
            parent={parent}
            onClose={closeContractDetail}
          />
        )}
      </Drawer>

      {/* STEP 129 — Hidden printable area. LOCKED contract 한정 (DRAFT/REVIEW
          /APPROVED 단계 인쇄 미지원 — 정식 매매 계약서는 LOCK 후 출력).
          STEP 87/89 PrintView 패턴 답습. */}
      {isOpen && contract && transaction && artwork && contract.status === "LOCKED" && (
        <div className="hidden print:block">
          <ContractPrintView contract={contract} artwork={artwork} transaction={transaction} />
        </div>
      )}
    </>
  );
}

// ============================================================================
// View — branches by status
// ============================================================================

interface ContractViewProps {
  contract: Contract;
  transaction: Transaction;
  artwork: Artwork;
  parent: Contract | undefined;
  onClose: () => void;
}

function ContractView(props: ContractViewProps) {
  if (props.contract.status === "DRAFT") {
    return <DraftContractForm {...props} />;
  }
  return <ReadOnlyContractView {...props} />;
}

// ============================================================================
// DRAFT mode — editable, save / submit-for-review
// ============================================================================

function DraftContractForm({
  contract,
  transaction,
  artwork,
  parent,
  onClose,
}: ContractViewProps) {
  const updateContract = useArtworkStore((s) => s.updateContract);
  const submitContractForReview = useArtworkStore(
    (s) => s.submitContractForReview
  );
  // Document Lifecycle Clarity STEP — timeline events scoped to this artwork
  const timelineForArtwork = useArtworkStore(
    (s) => s.timeline[transaction.artworkId] ?? []
  );

  const [content, setContent] = React.useState(contract.content);
  const isDirty = content !== contract.content;

  const persistChanges = () => {
    if (!isDirty) return;
    updateContract(contract.id, content);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistChanges();
  };

  const handleSubmitForReview = () => {
    if (isDirty) persistChanges();
    submitContractForReview(contract.id);
    onClose();
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header
          contract={contract}
          transaction={transaction}
          artwork={artwork}
          parent={parent}
        />

        {/* DRAFT banner — AI-Human loop reminder (rule_5) */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
          <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
            초안 — AI 생성 후 담당자 검토 필요 (rule_5)
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
            본문 수정 후 “검토 요청”을 누르면 검토자 승인 단계로 넘어가며, 그
            시점부터 본문은 잠깁니다.
          </p>
        </div>

        <Section label="계약 본문">
          <Textarea
            label=""
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="계약 내용을 입력하세요"
          />
        </Section>

        <Divider />

        <Section label="문서 이력">
          <DocumentTrail contract={contract} />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Activity timeline parity with Invoice drawer.
            Contract의 createdAt / submittedForReview / approved / locked 등 state 변화는
            store가 이미 TimelineEvent로 emit. 본 영역은 그 events만 필터하여 표시 —
            "검토자/승인자" 같은 Approval Workflow 데이터는 STEP 101+ 까지 표시 안 됨. */}
        <Section label="문서 활동">
          <DocumentActivityTimeline
            events={timelineForArtwork}
            entityType="contract"
            entityIds={[contract.id]}
            emptyMessage="이 계약서의 운영 활동이 아직 기록되지 않았습니다."
          />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Approval Workflow reserved slot.
            실제 Approval chain은 STEP 101+ 활성화 시 표시. */}
        <Section label="승인">
          <ApprovalSlotPlaceholder documentLabel="Contract" />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="submit"
          variant="secondary"
          disabled={!isDirty}
          aria-disabled={!isDirty}
        >
          저장
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmitForReview}
          disabled={content.trim().length === 0}
          aria-disabled={content.trim().length === 0}
        >
          검토 요청
        </Button>
      </footer>
    </form>
  );
}

// ============================================================================
// READONLY mode — REVIEW / APPROVED / LOCKED
// ============================================================================

function ReadOnlyContractView({
  contract,
  transaction,
  artwork,
  parent,
  onClose,
}: ContractViewProps) {
  const approveContract = useArtworkStore((s) => s.approveContract);
  const lockContract = useArtworkStore((s) => s.lockContract);
  const createContractVersion = useArtworkStore(
    (s) => s.createContractVersion
  );
  const currentRole = useArtworkStore((s) => s.currentRole);
  // Document Lifecycle Clarity STEP — timeline events scoped to this artwork
  const timelineForArtwork = useArtworkStore(
    (s) => s.timeline[transaction.artworkId] ?? []
  );

  const isReview = contract.status === "REVIEW";
  const isApproved = contract.status === "APPROVED";
  const isLocked = contract.status === "LOCKED";

  const canApprove = hasPermission(currentRole, "contract.approve");
  const canLock = hasPermission(currentRole, "contract.lock");

  const handleApprove = () => approveContract(contract.id);
  const handleLock = () => lockContract(contract.id);

  // STEP 129 — 인쇄 / PDF 저장 (browser native window.print). LOCKED 상태
  // 한정 — 정식 매매 계약서 출력. STEP 87/89 패턴 답습.
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.setTimeout(() => window.print(), 50);
    }
  };

  // STEP 132 Phase 2 Commit 2 — Server-side PDF 다운로드 (LOCKED 한정).
  // rule_4 가드는 server route 에서 contract.status === "LOCKED" 검증.
  const [isDownloadingPDF, setIsDownloadingPDF] = React.useState(false);
  const handleDownloadPDF = async () => {
    if (isDownloadingPDF) return;
    setIsDownloadingPDF(true);
    try {
      const result = await downloadContractPDF({
        contract,
        artwork,
        transaction,
        locale: "ko",
      });
      if (!result.ok) {
        alert(`PDF 다운로드 실패: ${result.error}`);
      }
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleNewVersion = () => createContractVersion(contract.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header
          contract={contract}
          transaction={transaction}
          artwork={artwork}
          parent={parent}
        />

        {/* Status banner */}
        {isReview && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-inquiry/5 border border-status-inquiry/30">
            <p className="text-[11.5px] text-status-inquiry tracking-tightish font-medium">
              검토 중 — 본문 수정 불가
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              검토자 승인 후 LOCK 단계로 진행할 수 있습니다.
            </p>
          </div>
        )}
        {isApproved && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              승인 완료 — LOCK 대기
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              LOCK 후에는 immutable한 영구 문서가 되며, 수정은 새 버전 생성으로만
              가능합니다.
            </p>
          </div>
        )}
        {isLocked && (
          <div className="mb-5 px-3 py-3 rounded-md bg-surface-muted border border-line-strong flex items-start gap-2.5">
            <LockIcon />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink tracking-tightish font-semibold">
                이 문서는 잠겨 있습니다
              </p>
              <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
                v{contract.version}는 영구 보관됩니다. 수정이 필요하면 아래
                “새 버전 생성”으로 v{contract.version + 1} 초안을 만드세요.
              </p>
              {contract.lockedAt && (
                <p className="text-[10.5px] text-ink-subtle mt-1 tracking-tightish">
                  잠금 시각 · {formatRelativeKR(contract.lockedAt)}
                </p>
              )}
            </div>
          </div>
        )}

        <Section label="계약 본문">
          <Textarea
            label=""
            value={contract.content}
            onChange={() => undefined}
            rows={16}
            readOnly
            disabled
          />
        </Section>

        <Divider />

        <Section label="문서 이력">
          <DocumentTrail contract={contract} />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Activity timeline parity with Invoice drawer.
            Contract의 createdAt / submittedForReview / approved / locked 등 state 변화는
            store가 이미 TimelineEvent로 emit. 본 영역은 그 events만 필터하여 표시 —
            "검토자/승인자" 같은 Approval Workflow 데이터는 STEP 101+ 까지 표시 안 됨. */}
        <Section label="문서 활동">
          <DocumentActivityTimeline
            events={timelineForArtwork}
            entityType="contract"
            entityIds={[contract.id]}
            emptyMessage="이 계약서의 운영 활동이 아직 기록되지 않았습니다."
          />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Approval Workflow reserved slot.
            실제 Approval chain은 STEP 101+ 활성화 시 표시. */}
        <Section label="승인">
          <ApprovalSlotPlaceholder documentLabel="Contract" />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>

        {/* State-conditional Primary action */}
        {isReview && (
          <div className="flex items-center gap-2">
            {!canApprove && (
              <ButtonHint
                tone="permission"
                align="inline"
                text={permissionHint("contract.approve")}
              />
            )}
            <Button
              type="button"
              variant="primary"
              onClick={handleApprove}
              disabled={!canApprove}
              aria-disabled={!canApprove}
            >
              승인
            </Button>
          </div>
        )}
        {isApproved && (
          <div className="flex items-center gap-2">
            {!canLock && (
              <ButtonHint
                tone="permission"
                align="inline"
                text={permissionHint("contract.lock")}
              />
            )}
            <Button
              type="button"
              variant="primary"
              onClick={handleLock}
              disabled={!canLock}
              aria-disabled={!canLock}
            >
              LOCK
            </Button>
          </div>
        )}
        {/* STEP 129 — LOCKED 시 인쇄 button (LOCK 진입 후 정식 매매 계약서 출력) */}
        {isLocked && (
          <Button type="button" variant="ghost" onClick={handlePrint}>
            인쇄 / PDF 저장
          </Button>
        )}
        {/* STEP 132 Phase 2 Commit 2 — Server-side PDF 다운로드 (LOCKED 한정) */}
        {isLocked && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDownloadPDF}
            disabled={isDownloadingPDF}
            aria-disabled={isDownloadingPDF}
          >
            {isDownloadingPDF ? "다운로드 중..." : "PDF 다운로드"}
          </Button>
        )}
        {isLocked && (
          <Button type="button" variant="primary" onClick={handleNewVersion}>
            새 버전 생성
          </Button>
        )}
      </footer>
    </div>
  );
}

// ============================================================================
// Shared header
// ============================================================================

function Header({
  contract,
  transaction,
  artwork,
  parent,
}: {
  contract: Contract;
  transaction: Transaction;
  artwork: Artwork;
  parent: Contract | undefined;
}) {
  return (
    <>
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

      {/* Status + version chain */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            상태
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusPill status={contract.status} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            버전
          </p>
          <p className="text-[14px] text-ink mt-1 font-mono tabular-nums tracking-tight2">
            v{contract.version}
          </p>
          {parent && (
            <p className="text-[10.5px] text-ink-subtle mt-0.5 tracking-tightish">
              v{parent.version}에서 파생
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Document trail
// ============================================================================

function DocumentTrail({ contract }: { contract: Contract }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta label="Contract ID" value={contract.id} mono />
      <Meta label="생성" value={formatRelativeKR(contract.createdAt)} />
      <Meta label="최근 수정" value={formatRelativeKR(contract.updatedAt)} />
      {contract.lockedAt ? (
        <Meta label="잠금" value={formatRelativeKR(contract.lockedAt)} />
      ) : (
        <Meta label="잠금" value="—" muted />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: ContractStatus }) {
  const color = CONTRACT_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{CONTRACT_STATUS_LABEL[status]}</span>
    </span>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-ink-muted shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
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
      {label && (
        <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          {label}
        </h3>
      )}
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line my-5" aria-hidden />;
}
