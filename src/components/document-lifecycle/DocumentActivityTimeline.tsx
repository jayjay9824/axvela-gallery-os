"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/artwork";
import {
  formatTimelineActorLine,
  filterTimelineForEntity,
} from "@/lib/document-lifecycle";
import type { TimelineEntityType } from "@/types/artwork";

// ============================================================================
// DocumentActivityTimeline — 도메인 entity의 *operational lifecycle* 시각화.
//
// **데이터 source**:
//   - 기존 TimelineEvent (artwork-scoped, kind: STATE_CHANGE / DOCUMENT /
//     INQUIRY / TRANSACTION / PAYMENT / NOTE)
//   - relatedEntityType / relatedEntityId로 도메인 entity와 연결
//
// **시각 정책 (사용자 spec 일관)**:
//   - Apple Wallet transaction history + DocuSign activity feed 톤
//   - 절제된 typography (text-[11.5px] / text-[10.5px] / text-[9.5px])
//   - 좌측 작은 dot + 세로 dashed line (계보 표시)
//   - 그림자 0 / 채도 낮은 색조
//   - rule_16 minimalism / NOT enterprise log table
//
// **AXVELA_TRUST_LAYER 정책 일관**:
//   - "검토자 / 승인자" 같은 Approval Workflow 데이터는 본 timeline에 노출 0건
//     (그건 STEP 101+ 이후 ApprovalSlotPlaceholder + 향후 본격 timeline)
//   - 본 timeline은 *기존 audit-derived events*만 표시 — 운영 참고 가시화.
// ============================================================================

interface DocumentActivityTimelineProps {
  /** 원본 timeline events (artwork 전체) — 호출자가 store에서 selector로 전달. */
  events: ReadonlyArray<TimelineEvent>;
  /** 어떤 도메인 entity에 대한 활동을 표시할지 — "invoice" / "contract" 등. */
  entityType: TimelineEntityType;
  /**
   * 표시 대상 entity id들. version chain의 경우 chain 전체 id를 전달하여
   * "v1 발행 → v2 새 버전 → v3 발송" 같은 누적 활동을 한 줄에 표시 가능.
   */
  entityIds: ReadonlyArray<string>;
  /** 빈 상태 메시지 — 호출자가 도메인별로 customize 가능. */
  emptyMessage?: string;
  /** 표시 한도 — 너무 길어지지 않도록 (rule_16). 초과분은 "전체 보기" 안내. */
  maxItems?: number;
  className?: string;
}

const DEFAULT_MAX = 12;

export function DocumentActivityTimeline({
  events,
  entityType,
  entityIds,
  emptyMessage = "기록된 활동이 없습니다.",
  maxItems = DEFAULT_MAX,
  className,
}: DocumentActivityTimelineProps) {
  const filtered = React.useMemo(
    () => filterTimelineForEntity(events, entityType, entityIds),
    [events, entityType, entityIds]
  );

  if (filtered.length === 0) {
    return (
      <p
        className={cn(
          "text-[11px] text-ink-subtle tracking-tightish italic",
          className
        )}
      >
        {emptyMessage}
      </p>
    );
  }

  const visible = filtered.slice(0, maxItems);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className={cn("flex flex-col", className)}>
      {visible.map((event, index) => (
        <ActivityRow
          key={event.id}
          event={event}
          isLast={index === visible.length - 1 && hiddenCount === 0}
        />
      ))}
      {hiddenCount > 0 && (
        <p className="ml-[15px] mt-2 text-[10px] text-ink-subtle/80 tracking-tightish italic">
          이전 활동 {hiddenCount}건은 표시되지 않았습니다.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Single timeline row — dot + vertical line + content
// ============================================================================

function ActivityRow({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const actorLine = formatTimelineActorLine(event);
  const formattedAt = formatActivityDateTime(event.at);

  return (
    <div className="flex gap-3 group">
      {/* Vertical lane — dot + line */}
      <div className="relative flex flex-col items-center shrink-0 pt-1">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-ink-muted shrink-0"
        />
        {!isLast && (
          <span
            aria-hidden
            className="flex-1 w-px bg-line mt-1 mb-1"
            style={{ minHeight: "20px" }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-3")}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11.5px] tracking-tightish text-ink font-medium leading-tight">
            {event.title}
          </p>
          <time
            dateTime={event.at}
            className="text-[9.5px] text-ink-subtle/80 tracking-tightish tabular-nums shrink-0"
          >
            {formattedAt}
          </time>
        </div>
        {event.detail && (
          <p className="text-[10.5px] text-ink-muted tracking-tightish mt-0.5 leading-snug">
            {event.detail}
          </p>
        )}
        <p className="text-[9.5px] text-ink-subtle/80 tracking-tightish mt-0.5">
          {actorLine}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Date formatting — Apple Wallet 스타일 ("YYYY.MM.DD HH:mm")
// ============================================================================

function formatActivityDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  } catch {
    return "—";
  }
}
