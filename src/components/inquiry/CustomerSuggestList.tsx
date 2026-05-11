// ============================================================================
// CustomerSuggestList — STEP 48.
//
// InquiryDetailDrawer 안에 inline으로 노출되는 작고 절제된 추천 후보 리스트.
// "기존 고객 후보 · 운영 참고" 톤. 클릭 시 부모 form의 collectorName + contact
// 입력값을 채워주는 콜백 호출 — 저장 흐름은 기존 updateInquiry 그대로.
//
// **표현 정책:**
//   - "기존 고객 후보" / "추천 후보" / "운영 참고" 사용
//   - "확정 고객 매칭" / "자동 연결됨" 0건 — disclaimer / 부정형으로만 등장
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_SEGMENT_LABEL_KR,
  CUSTOMER_KIND_LABEL_KR,
} from "@/lib/customer-aggregates";
import {
  SUGGEST_REASON_LABEL_KR,
  type CustomerSuggestion,
} from "@/lib/customer-suggest";

interface CustomerSuggestListProps {
  suggestions: CustomerSuggestion[];
  /** 사용자가 후보를 클릭 → form 상태 업데이트 */
  onSelect: (suggestion: CustomerSuggestion) => void;
}

export function CustomerSuggestList({
  suggestions,
  onSelect,
}: CustomerSuggestListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className="mt-2 rounded-md border border-line bg-surface-muted/60 px-3 py-2.5"
      role="region"
      aria-label="기존 고객 후보"
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          기존 고객 후보
        </span>
        <span className="text-[10px] text-ink-subtle tracking-tightish italic">
          운영 참고 · 추천일 뿐 자동 연결되지 않습니다
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <li key={s.customer.id}>
            <SuggestionRow suggestion={s} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onSelect,
}: {
  suggestion: CustomerSuggestion;
  onSelect: (s: CustomerSuggestion) => void;
}) {
  const c = suggestion.customer;
  const additional = c.allContacts.length > 1 ? ` (+${c.allContacts.length - 1})` : "";
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className={cn(
        "w-full text-left rounded-md border border-line bg-surface px-2.5 py-1.5",
        "hover:border-ink/60 hover:bg-canvas transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ink/30"
      )}
      aria-label={`${c.displayName} 추천 후보로 선택`}
    >
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[12px] font-medium text-ink tracking-tightish truncate">
            {c.displayName}
          </span>
          <span className="text-[10px] text-ink-subtle tracking-tightish shrink-0">
            · {CUSTOMER_KIND_LABEL_KR[c.kind]}
          </span>
        </div>
        <span className="text-[9.5px] text-ink-subtle tracking-tightish shrink-0 italic">
          {SUGGEST_REASON_LABEL_KR[suggestion.reason]}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5 min-w-0">
        <span className="text-[10.5px] font-mono text-ink-muted tracking-tightish truncate">
          {c.primaryContact}
          {additional && (
            <span className="text-ink-subtle">{additional}</span>
          )}
        </span>
        <span className="text-[9.5px] text-ink-subtle tracking-tightish shrink-0">
          {CUSTOMER_SEGMENT_LABEL_KR[c.segment]}
          {c.transactionIds.length > 0 && ` · 거래 ${c.transactionIds.length}건`}
        </span>
      </div>
    </button>
  );
}
