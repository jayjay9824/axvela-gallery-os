"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// ApprovalSlotPlaceholder — Approval Workflow가 활성화되기 전까지의 *예약 자리*.
//
// **사용자 spec (Reserved Slot 항목 7)**:
//   "DO NOT implement real approval workflow."
//   "ONLY reserve future UI slots."
//   "Must visually communicate: 'future-ready architecture' WITHOUT fake functionality."
//
// **AXVELA_TRUST_LAYER.md 정책 일관**:
//   - Approval Workflow는 STEP 101~112 예약 (Fiscal Layer 정착 후)
//   - 본 컴포넌트는 그 자리만 잡고 "STEP 101+ 예정" 명시
//   - 향후 STEP 101+에서 동일 위치에 실제 ApprovalAction chain 표시 컴포넌트로 교체
//
// **시각 정책**:
//   - STEP UX-1 "준비 중" 패턴 일관
//   - disabled / muted 톤 — 운영자가 "지금은 활성 안 됨"을 즉시 인지
//   - rule_16 minimalism — 작은 typography / 그림자 0
//
// **표현 정책**:
//   - 사용: "준비 중" / "STEP 101+ 예정" / "Approval Workflow 정착 후 활성"
//   - 금지: "법적 효력" / "공인 승인" / "compliance verified"
// ============================================================================

interface ApprovalSlotPlaceholderProps {
  /**
   * 어떤 도메인의 approval slot인지 — display label에 반영.
   * "Invoice" / "Contract" / "Tax Invoice" 등.
   */
  documentLabel: string;
  className?: string;
}

export function ApprovalSlotPlaceholder({
  documentLabel,
  className,
}: ApprovalSlotPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2.5 rounded-md",
        "bg-surface-muted/40 border border-line/60",
        className
      )}
      aria-label={`${documentLabel} 승인 워크플로우 — 준비 중`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.16em] text-ink-subtle font-semibold">
          승인 워크플로우
        </span>
        <span className="text-[9px] uppercase tracking-[0.14em] text-ink-subtle/70 italic">
          준비 중
        </span>
      </div>
      <SlotRow label="검토자" />
      <SlotRow label="최종 승인" />
      <p className="text-[9.5px] text-ink-subtle/70 italic tracking-tightish mt-0.5 leading-snug">
        Approval Workflow는 향후 STEP에서 활성됩니다 — 현재는 RBAC 권한 게이트만
        적용됩니다.
      </p>
    </div>
  );
}

function SlotRow({ label }: { label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10.5px] text-ink-subtle/80 tracking-tightish">
        {label}
      </span>
      <span className="text-[9.5px] text-ink-subtle/60 tracking-tightish italic">
        STEP 101+ 예정
      </span>
    </div>
  );
}
