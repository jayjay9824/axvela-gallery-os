import type { ArtworkState } from "@/types/artwork";

/**
 * Canonical state machine per AXVELA Manifesto rule_6.
 *
 *   DRAFT → READY → INQUIRY → DEAL → PAID → CLOSED → BROKERED
 *                     ↑                                   │
 *                     └──────── (resale loop) ────────────┘
 *
 * Each `from` state has at most one allowed next state.
 * Free-form transitions (e.g. via the Edit form) bypass this and are
 * considered an admin-style override — they do NOT generate timeline events.
 */
export interface TransitionDef {
  from: ArtworkState;
  to: ArtworkState;
  /** Korean label shown on the primary action button. */
  primaryLabel: string;
  /** One-sentence summary of what this transition means in operational terms. */
  description: string;
  /** Concrete effects of completing this transition — used in the confirm modal. */
  effects: string[];
}

export const TRANSITIONS: TransitionDef[] = [
  {
    from: "DRAFT",
    to: "READY",
    primaryLabel: "전시 준비 완료",
    description:
      "작품 정보 검토를 마치고 전시·판매 가능 상태로 전환합니다.",
    effects: ["Collector View 공유 가능", "Inquiry 접수 가능"],
  },
  {
    from: "READY",
    to: "INQUIRY",
    primaryLabel: "문의 접수",
    description:
      "컬렉터로부터 정식 문의를 받아 협상 단계로 진입합니다.",
    effects: [
      "Inquiry 레코드 자동 생성 (컬렉터 정보 입력 필요)",
      "협상·응대 기록 시작",
      "AI 응대 초안 생성 가능",
    ],
  },
  {
    from: "INQUIRY",
    to: "DEAL",
    primaryLabel: "거래 확정",
    description:
      "문의가 합의에 이르러 정식 거래로 전환됩니다. Invoice 발행 단계로 넘어갑니다.",
    effects: [
      "Transaction 레코드 자동 생성 (구매자·가격 인계)",
      "Invoice·Contract 작성 단계 진입",
      "가격 변경 제한",
    ],
  },
  {
    from: "DEAL",
    to: "PAID",
    primaryLabel: "결제 완료",
    description: "결제 수령이 확인되어 정산·물류 단계로 진입합니다.",
    effects: ["정산(Settlement) 시작 가능", "물류·배송 배정 가능"],
  },
  {
    from: "PAID",
    to: "CLOSED",
    primaryLabel: "거래 종료",
    description: "정산과 물류가 완료되어 거래를 공식 종료합니다.",
    effects: ["정산·세무 기록 보관", "재판매 등록 가능"],
  },
  {
    from: "CLOSED",
    to: "BROKERED",
    primaryLabel: "Resale 시작",
    description: "거래가 종료된 작품을 재판매 풀에 등록합니다.",
    effects: [
      "previousOwner 정보 자동 이관",
      "새로운 Transaction 생성 (isResale: true)",
      "Resale Inquiry 자동 생성 (구매자 의사 미정)",
    ],
  },
  {
    from: "BROKERED",
    to: "INQUIRY",
    primaryLabel: "재판매 문의 접수",
    description:
      "재판매 작품에 대한 문의가 들어와 협상 단계로 다시 진입합니다.",
    effects: ["원소유자 정산 구조 적용", "기존 거래 기록 보존"],
  },
];

const TRANSITION_MAP: Map<ArtworkState, TransitionDef> = new Map(
  TRANSITIONS.map((t) => [t.from, t])
);

/**
 * Returns the next allowed transition from the current state, or null if
 * the state has no defined onward transition (terminal / off-flow).
 */
export function getTransition(from: ArtworkState): TransitionDef | null {
  return TRANSITION_MAP.get(from) ?? null;
}

/**
 * Returns all allowed next states from the given state.
 * Currently each state has at most one — kept as array for forward compatibility.
 */
export function getAllowedNextStates(from: ArtworkState): ArtworkState[] {
  const t = TRANSITION_MAP.get(from);
  return t ? [t.to] : [];
}
