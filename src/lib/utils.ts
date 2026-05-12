import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ArtworkState } from "@/types/artwork";
import type {
  InquiryStatus,
  InquirySource,
  InquiryType,
} from "@/types/inquiry";
import type {
  TransactionStatus,
  Currency,
} from "@/types/transaction";
import type { InvoiceStatus } from "@/types/invoice";
import type { PaymentStatus, PaymentMethod } from "@/types/payment";
import type { SettlementStatus } from "@/types/settlement";
import type { TaxRecordStatus, TaxType } from "@/types/tax";
import type { ContractStatus } from "@/types/contract";
import type { CurationStatus } from "@/types/curation";
import type { LogisticsStatus } from "@/types/logistics";
import type {
  ConditionStatus,
  ReportType,
} from "@/types/condition-report";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Multi-currency money formatter.
 * KRW / JPY render with no decimals; USD / EUR with 2.
 */
export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits:
      currency === "KRW" || currency === "JPY" ? 0 : 2,
  }).format(amount);
}

export function formatRelativeKR(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ----------------------------------------------------------------------------
// Artwork state
// ----------------------------------------------------------------------------

export const STATE_LABEL_KR: Record<ArtworkState, string> = {
  DRAFT: "초안",
  READY: "전시 준비",
  INQUIRY: "문의 중",
  DEAL: "거래 진행",
  PAID: "결제 완료",
  CLOSED: "거래 종료",
  REOPENED: "재개",
  BROKERED: "재판매",
};

export const STATE_COLOR: Record<ArtworkState, string> = {
  DRAFT: "#94908A",
  READY: "#3F3F46",
  INQUIRY: "#B97A1F",
  DEAL: "#1E5FBF",
  PAID: "#1F7A4D",
  CLOSED: "#5A574F",
  REOPENED: "#3F3F46",
  BROKERED: "#5E3FB8",
};

// ----------------------------------------------------------------------------
// Inquiry
// ----------------------------------------------------------------------------

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  OPEN: "응대 대기",
  RESPONDED: "응대 완료",
  ON_HOLD: "보류",
  ESCALATED: "매니저 검토",
  CLOSED: "종결",
};

export const INQUIRY_STATUS_COLOR: Record<InquiryStatus, string> = {
  OPEN: "#B97A1F",
  RESPONDED: "#1E5FBF",
  ON_HOLD: "#94908A",
  ESCALATED: "#5E3FB8",
  CLOSED: "#5A574F",
};

export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  WEBSITE: "웹사이트",
  EMAIL: "이메일",
  SHOWROOM: "갤러리 방문",
  ART_FAIR: "아트페어",
  REFERRAL: "소개",
  COLLECTOR_VIEW: "Collector View",
  OTHER: "기타",
};

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  PRICE: "가격 문의",
  AVAILABILITY: "가용성",
  VIEWING: "실견 요청",
  DOCUMENTATION: "도큐먼트",
  GENERAL: "일반 문의",
  RESALE: "재판매",
};

// ----------------------------------------------------------------------------
// Transaction
// ----------------------------------------------------------------------------

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  NEGOTIATING: "협상 중",
  AGREED: "합의 완료",
  PAID: "결제 수령",
  SETTLED: "정산 완료",
  COMPLETED: "거래 완료",
  CANCELLED: "취소",
};

export const TRANSACTION_STATUS_COLOR: Record<TransactionStatus, string> = {
  NEGOTIATING: "#B97A1F", // amber — active, in-flight
  AGREED: "#1E5FBF",      // blue — committed
  PAID: "#1F7A4D",        // emerald — payment cleared
  SETTLED: "#2D6B47",     // forest — internal distribution done
  COMPLETED: "#5A574F",   // muted — settled, archived
  CANCELLED: "#94908A",   // muted — terminated
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  KRW: "KRW",
  USD: "USD",
  EUR: "EUR",
  JPY: "JPY",
};

// ----------------------------------------------------------------------------
// Invoice
// ----------------------------------------------------------------------------

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "초안",
  SENT: "발송 완료",
  PAID: "결제 완료",
};

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "#94908A", // muted — not yet committed
  SENT: "#1E5FBF",  // blue — committed, awaiting payment
  PAID: "#1F7A4D",  // emerald — closed
};

// ----------------------------------------------------------------------------
// Payment
// ----------------------------------------------------------------------------

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  RECEIVED: "수령 완료",
  PENDING: "확인 대기",
  FAILED: "실패",
  REFUNDED: "환불",
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  RECEIVED: "#1F7A4D", // emerald — money confirmed in
  PENDING: "#B97A1F",  // amber — in-flight
  FAILED: "#94908A",   // muted — terminated
  REFUNDED: "#5E3FB8", // purple — reversed (matches BROKERED treatment)
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "계좌이체",
  WIRE: "해외 송금",
  CARD: "카드",
  CASH: "현금",
  OTHER: "기타",
};

// ----------------------------------------------------------------------------
// Settlement
// ----------------------------------------------------------------------------

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING: "정산 대기",
  READY: "송금 준비",
  COMPLETED: "정산 완료",
};

export const SETTLEMENT_STATUS_COLOR: Record<SettlementStatus, string> = {
  PENDING: "#B97A1F",   // amber — needs review
  READY: "#1E5FBF",     // blue — committed, awaiting transfer
  COMPLETED: "#1F7A4D", // emerald — distributed
};

/** v1 hardcoded distribution policy — promote to settings in a later step. */
export const SETTLEMENT_POLICY = {
  artistRate: 0.6,
  galleryRate: 0.4,
} as const;

/**
 * Compute artist/gallery split from a total amount.
 * Uses round + remainder to guarantee artistShare + galleryShare === total
 * (no rounding loss on amounts that don't divide evenly).
 */
export function splitSettlement(total: number): {
  artistShare: number;
  galleryShare: number;
} {
  const artistShare = Math.round(total * SETTLEMENT_POLICY.artistRate);
  const galleryShare = total - artistShare;
  return { artistShare, galleryShare };
}

// ----------------------------------------------------------------------------
// Tax (rule_3 — money flow separation, final layer)
// ----------------------------------------------------------------------------

export const TAX_RECORD_STATUS_LABEL: Record<TaxRecordStatus, string> = {
  PENDING: "검토 대기",
  READY: "발행 준비",
  ISSUED: "발행 완료",
};

export const TAX_RECORD_STATUS_COLOR: Record<TaxRecordStatus, string> = {
  PENDING: "#B97A1F", // amber — needs review
  READY: "#1E5FBF",   // blue — committed, awaiting issuance
  ISSUED: "#5A574F",  // muted — archived as a permanent record
};

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  SALES_RECORD: "매출 기록",
  VAT: "부가세",
  WITHHOLDING: "원천징수",
};

/** v1 hardcoded tax policy — promote to per-artist / per-region settings later. */
export const TAX_POLICY = {
  /** 한국 부가가치세 (VAT) 표준 세율. */
  vatRate: 0.1,
  /** 원천징수 기본값 (v1: 0 — 작가 지급 단계에서 별도 산정). */
  defaultWithholdingRate: 0,
} as const;

/**
 * Compute VAT and withholding from a taxable base.
 * v1: VAT = round(base * 10%), withholding = 0.
 * The remainder math kept simple — these two numbers are independent of base
 * (they don't need to sum to base), so no rounding allocation is required.
 */
export function splitTax(taxableAmount: number): {
  vatAmount: number;
  withholdingAmount: number;
} {
  const vatAmount = Math.round(taxableAmount * TAX_POLICY.vatRate);
  const withholdingAmount = Math.round(
    taxableAmount * TAX_POLICY.defaultWithholdingRate
  );
  return { vatAmount, withholdingAmount };
}

// ----------------------------------------------------------------------------
// Contract (rule_4 — Document Trust, rule_5 — AI-Human loop)
// ----------------------------------------------------------------------------

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "초안",
  REVIEW: "검토 중",
  APPROVED: "승인 완료",
  LOCKED: "잠금",
};

export const CONTRACT_STATUS_COLOR: Record<ContractStatus, string> = {
  DRAFT: "#94908A",    // muted — AI generated, awaiting human edit
  REVIEW: "#B97A1F",   // amber — submitted, under review
  APPROVED: "#1E5FBF", // blue — approved, ready to lock
  LOCKED: "#5A574F",   // muted neutral — archived, immutable
};

/**
 * Generate an AI-style draft contract content from artwork + transaction context.
 * v1 placeholder — wire to a real model in a later step (rule_5 AI-Human loop).
 */
export function generateContractDraftContent(args: {
  artistName: string;
  artworkTitle: string;
  axidCode: string;
  year: number;
  medium: string;
  dimensions: string;
  buyerName: string;
  agreedPrice: number;
  currency: import("@/types/transaction").Currency;
}): string {
  const buyer = args.buyerName.trim() || "[구매자 정보 입력 필요]";
  const price = formatMoney(args.agreedPrice, args.currency);

  return [
    `본 계약은 ${args.artistName}의 작품 「${args.artworkTitle}」(${args.axidCode})에 대한 매매 계약입니다.`,
    "",
    `매도인: AXVELA Gallery`,
    `매수인: ${buyer}`,
    `거래 금액: ${price}`,
    "",
    "[작품 정보]",
    `- 작가: ${args.artistName}`,
    `- 제목: ${args.artworkTitle}`,
    `- 제작 연도: ${args.year}`,
    `- 매체: ${args.medium}`,
    `- 크기: ${args.dimensions}`,
    "",
    "[계약 조건]",
    "1. 갤러리는 작품의 진위와 보존 상태를 보증합니다.",
    "2. 매수인은 결제 완료 후 30일 이내에 인수합니다.",
    "3. 인수 후 7일 이내에 한해 이의 제기가 가능합니다.",
    "4. 본 계약은 양 당사자의 서명 및 LOCK으로 효력이 발생합니다.",
    "",
    "(본 초안은 AXVELA AI가 생성한 템플릿입니다. 담당자 검토 후 승인 단계로 진행하세요.)",
  ].join("\n");
}

// ----------------------------------------------------------------------------
// Curation (rule_18 — AI Layer, rule_4/5 — Document Trust + AI-Human loop)
// STEP 16
// ----------------------------------------------------------------------------

export const CURATION_STATUS_LABEL: Record<CurationStatus, string> = {
  DRAFT: "초안",
  APPROVED: "승인 완료",
  LOCKED: "잠금",
};

export const CURATION_STATUS_COLOR: Record<CurationStatus, string> = {
  DRAFT: "#94908A",    // muted — AI generated, awaiting human edit
  APPROVED: "#1E5FBF", // blue — approved, ready to lock
  LOCKED: "#5A574F",   // muted neutral — archived, immutable
};

/**
 * Generate an AI-style draft curation note from artwork context (rule_18 (a)).
 * v1: deterministic template — same shape as generateContractDraftContent.
 * 후속 STEP에서 LLM swap 인터페이스로 교체 가능.
 */
export function generateCurationDraftContent(args: {
  artistName: string;
  artistNameEn?: string;
  artworkTitle: string;
  axidCode: string;
  year: number;
  medium: string;
  dimensions: string;
}): { headline: string; subheadline: string; body: string } {
  const enSuffix = args.artistNameEn ? ` (${args.artistNameEn})` : "";

  return {
    headline: `${args.artistName}의 「${args.artworkTitle}」 — 매체와 시간이 만나는 자리`,
    subheadline: `${args.artistName}${enSuffix} · ${args.year} · ${args.medium} · ${args.dimensions}`,
    body: [
      `${args.artistName}의 「${args.artworkTitle}」(${args.year})는 ${args.medium}이라는 매체를 통해 작가 특유의 조형 언어를 응축한 작품이다. ${args.axidCode}로 식별되는 이 작품은 ${args.dimensions}의 화면 안에서 형태와 색채, 그리고 여백의 균형을 통해 관람자에게 응시의 시간을 요구한다.`,
      "",
      `매체의 물성은 시각적 표면을 넘어 작품의 의미 구조를 결정짓는 또 하나의 언어로 작동한다. 작가가 선택한 ${args.medium}은 단순한 도구가 아니라 시간성과 신체성을 동시에 환기시키는 매개로서, 화면 안에 축적된 흔적을 통해 제작 과정 자체를 가시화한다.`,
      "",
      `${args.year}년에 제작된 이 작품은 ${args.artistName}의 작업 흐름 속에서 중요한 변곡점을 보여주며, 동시에 컬렉션의 맥락에서도 깊이 있는 자리매김을 가능하게 한다. 동시대 한국 미술의 한 단면을 명료하게 응축한 작품으로 평가된다.`,
      "",
      "(본 초안은 AXVELA AI가 생성한 템플릿입니다. 담당자 검토 후 승인 단계로 진행하세요.)",
    ].join("\n"),
  };
}

/**
 * Generate an AI-style draft response to an Inquiry (rule_18 (d)).
 * 응대 type별로 가지치기된 deterministic template.
 */
export function generateInquiryResponseDraft(args: {
  collectorName: string;
  artistName: string;
  artworkTitle: string;
  inquiryType: InquiryType;
  message: string;
  priceKRW: number;
}): string {
  const greeting = args.collectorName.trim()
    ? `${args.collectorName}님,`
    : `안녕하세요,`;

  const intro = `AXVELA Gallery입니다. ${args.artistName}의 「${args.artworkTitle}」에 관심 가져 주셔서 감사합니다.`;

  let body: string;
  switch (args.inquiryType) {
    case "PRICE":
      body = `문의주신 작품의 현재 가격은 ${formatKRW(args.priceKRW)}입니다. 정식 인보이스 발행 또는 작품 실견 일정 조율이 필요하시면 회신 주시기 바랍니다.`;
      break;
    case "AVAILABILITY":
      body = `해당 작품은 현재 가용 상태입니다. 구매 의사가 확정되시면 인보이스 발행과 결제·인수 일정을 별도 안내드리겠습니다.`;
      break;
    case "VIEWING":
      body = `실견을 희망하신다고 알려주셨습니다. 갤러리 방문 가능 일정 또는 스튜디오 방문 가능 시점을 회신주시면 작품 컨디션 점검 후 응대드리겠습니다.`;
      break;
    case "DOCUMENTATION":
      body = `요청하신 도큐먼트(컨디션 리포트, 진위 보증서 등)를 별도 회신으로 안내드리겠습니다. 추가 자료가 필요하시면 회신주십시오.`;
      break;
    case "RESALE":
      body = `재판매 작품에 대한 문의로 분류되었습니다. 원소유자 정산 구조와 재판매 조건은 별도 안내드리며, 컨디션 리포트와 출처(provenance)는 요청 시 함께 송부드리겠습니다.`;
      break;
    case "GENERAL":
    default:
      body = `문의 내용을 확인하였습니다. 정확한 응대를 위해 추가 정보가 필요할 수 있으니 회신 부탁드립니다. 작품 가격, 가용성, 실견 가능 일정 모두 별도 안내드릴 수 있습니다.`;
      break;
  }

  return [
    greeting,
    "",
    intro,
    "",
    body,
    "",
    "감사합니다.",
    "AXVELA Gallery",
    "",
    "(본 초안은 AXVELA AI가 생성한 템플릿입니다. 담당자 검토 후 발송하세요.)",
  ].join("\n");
}

// ----------------------------------------------------------------------------
// Logistics (rule_21 — physical artwork delivery)
// ----------------------------------------------------------------------------

export const LOGISTICS_STATUS_LABEL: Record<LogisticsStatus, string> = {
  READY_FOR_PICKUP: "픽업 대기",
  IN_TRANSIT: "배송 중",
  DELIVERED: "인도 완료",
  CONDITION_CHECKED: "검수 완료",
};

export const LOGISTICS_STATUS_COLOR: Record<LogisticsStatus, string> = {
  READY_FOR_PICKUP: "#94908A", // muted — awaiting pickup
  IN_TRANSIT: "#B97A1F",       // amber — in motion, watch
  DELIVERED: "#1E5FBF",        // blue — handed over, awaiting condition check
  CONDITION_CHECKED: "#5A574F",// muted neutral — terminal, archived
};

/** Ordered status flow for select inputs. */
export const LOGISTICS_STATUS_ORDER: LogisticsStatus[] = [
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "DELIVERED",
  "CONDITION_CHECKED",
];

// ----------------------------------------------------------------------------
// ConditionReport (rule_4 — Document trust + rule_21 — Logistics)
// ----------------------------------------------------------------------------

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  BEFORE_SHIPMENT: "출고 전 컨디션",
  AFTER_DELIVERY: "인도 후 컨디션",
};

export const CONDITION_STATUS_LABEL: Record<ConditionStatus, string> = {
  GOOD: "양호",
  WATCH: "주의",
  DAMAGED: "손상",
};

export const CONDITION_STATUS_COLOR: Record<ConditionStatus, string> = {
  GOOD: "#1E5FBF",     // blue — all clear
  WATCH: "#B97A1F",    // amber — needs attention
  DAMAGED: "#B43A3A",  // red — damage confirmed
};

/** Ordered options for radio / select inputs. */
export const CONDITION_STATUS_ORDER: ConditionStatus[] = [
  "GOOD",
  "WATCH",
  "DAMAGED",
];

// ----------------------------------------------------------------------------
// STEP 129 — Document AXID display formatter
//
// 문서 (Invoice / Contract / Certificate / Passport export) 출력 시점에
// AXID 의 *display label* 변환. 사용자 spec #5 디자인 자산의 표기 convention
// `AX-YYYY-KR-NNNNNN` 정합. 시스템 내부 식별자 (`axid.code`) 자체는 변경 0줄
// (rule_1 Physical Root Key 보존, STEP 127 Phase 1 §2.7 옵션 Z — 디자인 표기
// 분리, 마이그레이션 0).
//
// **STEP 133 forward-compat**: AXID interface 에 `displayLabel?` 옵셔널
// 슬롯 추가 시 (Optional Slice 9회째 예정) 본 helper 가 자연 합류 — 그
// 시점에는 `displayLabel` 우선 사용, 부재 시 본 format 변환 fallback.
//
// **pure** — single argument → string, side effect 0.
// ----------------------------------------------------------------------------

/**
 * Internal axid (e.g. "AXV-2025-0001") → display format ("AX-2025-KR-000001").
 * 비표준 format (예: legacy seed data) 은 원본 그대로 반환 (fallback).
 *
 * @example
 * formatAxidForDocument({ code: "AXV-2025-0001" });
 * // → "AX-2025-KR-000001"
 * formatAxidForDocument({ code: "CUSTOM-FORMAT" });
 * // → "CUSTOM-FORMAT"  (fallback for non-standard)
 */
export function formatAxidForDocument(axid: { code: string }): string {
  // STEP 127 Phase 1 §2.7 옵션 Z — AXV-YYYY-NNNN → AX-YYYY-KR-NNNNNN
  const match = axid.code.match(/^AXV-(\d{4})-(\d+)$/);
  if (!match) return axid.code;
  const [, year, seq] = match;
  return `AX-${year}-KR-${seq.padStart(6, "0")}`;
}
