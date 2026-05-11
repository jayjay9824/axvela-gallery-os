"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// ButtonHint — STEP 17 (rule_15 / rule_16 polish).
//
// 버튼 옆 또는 아래에 부속되는 작은 helper text의 단일 출처. 4가지 의미 단위:
//
//   permission    RBAC로 차단됨 — "Owner 권한 필요" 등 (lib/rbac.permissionHint)
//   future        아직 구현되지 않은 placeholder — "준비 중" / "다음 단계에서 제공"
//   data_guard    데이터 조건 미충족 — "응대 가능한 문의 없음" / "결제 대기 중" 등
//                 권한과 다른 별개 게이트(rule_7 — 권한 vs 데이터 가드 분리).
//   ai            AI affordance 안내 — "AI 초안 — 담당자 검토 필요"
//                 disabled가 아닌 활성 버튼에도 사용. 정보성 annotation.
//
// 색조는 의도적으로 모두 절제된 톤. data_guard만 약하게 status-inquiry 톤을
// 차용해 "가드 걸림" 신호. 그 외는 ink-subtle. ai는 italic로 다른 disabled
// 사유와 시각적 구분.
//
// align:
//   below   버튼 아래 줄로 표시 (기본). DetailPanel / Summary 카드 / Drawer body.
//   inline  버튼 옆 같은 줄. Drawer footer의 horizontal flex 안.
// ============================================================================

export type ButtonHintTone =
  | "permission"
  | "future"
  | "data_guard"
  | "ai";

export type ButtonHintAlign = "below" | "inline";

interface ButtonHintProps {
  text: string;
  tone?: ButtonHintTone;
  align?: ButtonHintAlign;
  className?: string;
}

const TONE_COLOR: Record<ButtonHintTone, string> = {
  permission: "text-ink-subtle",
  future: "text-ink-subtle",
  data_guard: "text-status-inquiry/80",
  ai: "text-ink-subtle italic",
};

export function ButtonHint({
  text,
  tone = "future",
  align = "below",
  className,
}: ButtonHintProps) {
  if (align === "inline") {
    return (
      <span
        role="note"
        className={cn(
          "text-[10.5px] tracking-tightish",
          TONE_COLOR[tone],
          className
        )}
      >
        {text}
      </span>
    );
  }
  return (
    <p
      role="note"
      className={cn(
        "text-[10.5px] tracking-tightish text-center",
        TONE_COLOR[tone],
        className
      )}
    >
      {text}
    </p>
  );
}

// ----------------------------------------------------------------------------
// Shared label constants — single source of truth for placeholder messaging.
// ----------------------------------------------------------------------------

/** 미구현 기능 placeholder. 단기 후속 단계에서 제공 예정. */
export const FUTURE_LABEL = "준비 중";

/** 명시적으로 다음 STEP에서 제공 예정인 기능 (장기). */
export const FUTURE_LATER_LABEL = "다음 단계에서 제공";

/**
 * @deprecated STEP UX-1 — Action Clarity Layer 정책 위반.
 *
 * "다른 카드에서 진행" 라벨은 *어디로 가야 하는지 모호*하여 사용자가 클릭 후
 * 어떤 행동을 취해야 할지 알 수 없음. 신규 사용 0건. 기존 사용처는 모두
 * `FUTURE_LABEL` ("준비 중") 또는 *명시적 navigation*으로 교체.
 *
 * 본 export는 backward-compat용으로 유지되나 *어떤 신규 코드도 import 금지*.
 * 컴파일 시점 사용 검사: STEP UX-1 이후 본 상수 import는 실수로 간주.
 */
export const REDUNDANT_LABEL = "다른 카드에서 진행";

/** AI 초안 생성 버튼에 부속되는 안내 문구 (rule_5). */
export const AI_DRAFT_AFFORDANCE = "AI 초안 — 담당자 검토 필요";
