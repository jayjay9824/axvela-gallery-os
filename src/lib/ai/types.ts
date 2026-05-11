// AXVELA AI Integration Protocol — Type Definitions
// =====================================================
// 정착 시점: STEP 93 (2026-05-07).
// 정합: AXVELA_AI_INTEGRATION.md §2 (5 Insertion Points) + §3 (Protocol Shape) + §5 (Forbidden Outputs).
//
// Architecture position (AI_INTEGRATION §1):
//   AXVELA = "operational software with intelligence layers"
//   NOT AI-first product / autonomous agent / valuation engine.
//
// AI 역할 (AI_INTEGRATION §1.2):
//   - Normalize / Rewrite (institutional tone) / Summarize / Translate / Explain structured data
//   - NEVER: pricing prediction / valuation / authenticity / legal-final / autonomous decision
//
// Hallucination 최소화 원칙 (AI_INTEGRATION §1.3):
//   real operational data → derived insight (deterministic) → AI summarization (assistive) → human final
//   AI는 raw operational metrics를 직접 생성하지 않는다.
// =====================================================

// -----------------------------------------------------
// 1. Insertion Kind (5 카테고리, AI_INTEGRATION §2 정확 매칭)
// -----------------------------------------------------

export type AIAssistKind =
  | "artwork_metadata" //   §2.1 Artwork Metadata Assist (캔버스에 유채 → Oil on Canvas)
  | "document_writing" //   §2.2 Document Writing Assist (short notes → institutional rewrite)
  | "condition_compare" //  §2.3 Condition Compare Summary (LiDAR variance → institutional summary)
  | "operational_insight" //§2.4 Operational Insight Summary (STEP 92 snapshot → rewrite)
  | "translation"; //       §2.5 Translation Layer (KO/EN/JA/ZH gallery operational)

export const AI_ASSIST_KINDS: readonly AIAssistKind[] = [
  "artwork_metadata",
  "document_writing",
  "condition_compare",
  "operational_insight",
  "translation",
] as const;

export const AI_ASSIST_KIND_LABEL_KR: Record<AIAssistKind, string> = {
  artwork_metadata: "작품 메타데이터 보조",
  document_writing: "문서 작성 보조",
  condition_compare: "Condition 비교 요약",
  operational_insight: "운영 신호 요약",
  translation: "번역 보조",
};

// -----------------------------------------------------
// 2. Locale (AI_INTEGRATION §2.5 + §6.4)
// -----------------------------------------------------

export type AILocale = "ko" | "en" | "ja" | "zh";

export const AI_LOCALES: readonly AILocale[] = ["ko", "en", "ja", "zh"] as const;

export const AI_LOCALE_LABEL_KR: Record<AILocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

// -----------------------------------------------------
// 3. Provider (AI_INTEGRATION §7 — server-side only)
// -----------------------------------------------------

export type AIProvider = "anthropic" | "openai" | "gemini";

export const AI_PROVIDER_LABEL: Record<AIProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

// -----------------------------------------------------
// 4. Per-Kind Input / Output Schemas (AI_INTEGRATION §2)
// -----------------------------------------------------

// §2.1 — Artwork Metadata Assist
export interface ArtworkMetadataInput {
  rawTitle?: string;
  rawMaterial?: string; // e.g. "캔버스에 유채"
  rawCategory?: string;
  rawNotes?: string;
}
export interface ArtworkMetadataOutput {
  normalizedTitle?: string;
  normalizedMaterial?: string; // e.g. "Oil on Canvas"
  suggestedCategory?: string;
  cleanedNotes?: string;
  normalizationNotes: string[]; // explanation of changes (always array, may be empty)
}

// §2.2 — Document Writing Assist
export type DocumentWritingTarget =
  | "invoice"
  | "receipt"
  | "condition_report"
  | "settlement_summary"
  | "shipment_summary"
  | "artwork_description";

export const DOCUMENT_WRITING_TARGETS: readonly DocumentWritingTarget[] = [
  "invoice",
  "receipt",
  "condition_report",
  "settlement_summary",
  "shipment_summary",
  "artwork_description",
] as const;

export interface DocumentWritingInput {
  documentType: DocumentWritingTarget;
  shortNotes: string;
  contextSummary?: string; // optional — artwork/transaction/customer context
}
export interface DocumentWritingOutput {
  rewrittenText: string;
  toneNotes: string[];
}

// §2.3 — Condition Compare Summary
export type SurfaceClassification = "minor" | "moderate" | "significant";

export interface SurfaceVarianceMetric {
  region: string; // e.g. "lower-right-edge"
  deltaMM: number;
  classification: SurfaceClassification;
}
export interface DepthVariationMetric {
  region: string;
  deltaMM: number;
}
export interface VisualDifferenceMetric {
  region: string;
  similarity: number; // 0..1
}
export interface ConditionCompareInput {
  baselineCapturedAt: string; // ISO datetime
  currentCapturedAt: string;
  surfaceVarianceMetrics: SurfaceVarianceMetric[];
  depthVariationMetrics?: DepthVariationMetric[];
  visualDifferenceMetrics?: VisualDifferenceMetric[];
}
export interface ConditionCompareOutput {
  summary: string; // institutional tone single sentence
  observationLines: string[];
  reviewRequired: boolean;
}

// §2.4 — Operational Insight Summary (STEP 92 snapshot integration)
// Note: full snapshot type lives in operational-insight.ts;
// here we use a structural minimum to avoid circular deps.
export interface OperationalInsightInputSummaryShape {
  period: "7d" | "14d" | "30d";
  generatedAtISO: string;
  // Simplified passthrough — server route binds the actual snapshot type.
  snapshot: unknown;
  artworkContext?: { artworkId: string; artworkTitle: string };
}
export interface OperationalInsightOutput {
  overview: string[]; // up to 3 lines
  categoryRewrites: {
    kind:
      | "inquiry"
      | "save"
      | "artist"
      | "settlement"
      | "funnel"
      | "activity";
    headline: string;
    observations: string[]; // 1-3 lines
  }[];
}

// §2.5 — Translation Layer
export type TranslationDomain =
  | "artwork_description"
  | "invoice"
  | "general";

export interface TranslationInput {
  sourceText: string;
  sourceLocale: AILocale;
  targetLocale: AILocale;
  domain?: TranslationDomain;
}
export interface TranslationOutput {
  translatedText: string;
  notes: string[];
}

// -----------------------------------------------------
// 5. Discriminated Union Maps (type-safe per kind)
// -----------------------------------------------------

export interface AIAssistInputMap {
  artwork_metadata: ArtworkMetadataInput;
  document_writing: DocumentWritingInput;
  condition_compare: ConditionCompareInput;
  operational_insight: OperationalInsightInputSummaryShape;
  translation: TranslationInput;
}

export interface AIAssistOutputMap {
  artwork_metadata: ArtworkMetadataOutput;
  document_writing: DocumentWritingOutput;
  condition_compare: ConditionCompareOutput;
  operational_insight: OperationalInsightOutput;
  translation: TranslationOutput;
}

// -----------------------------------------------------
// 6. Request / Response Shapes (AI_INTEGRATION §3.2)
// -----------------------------------------------------

export type AIAssistRequest<K extends AIAssistKind = AIAssistKind> = {
  [Kind in K]: {
    kind: Kind;
    input: AIAssistInputMap[Kind];
    locale?: AILocale;
    meta?: { gallerySlug?: string; userId?: string };
  };
}[K];

export type AIUnavailableReason =
  | "disabled" //                AXVELA_AI_ENABLED=false (default safe mode, AI_INTEGRATION §4.1)
  | "kind_disabled" //           Per-kind flag off (AI_INTEGRATION §4.2)
  | "provider_not_configured" // API key 부재 / provider env 부재
  | "rate_limit" //              Provider rate limit
  | "provider_error" //          Provider 5xx / network error
  | "output_rejected" //         Forbidden phrase 검출 (AI_INTEGRATION §5)
  | "timeout"; //                Provider call timeout

export const AI_UNAVAILABLE_REASON_LABEL_KR: Record<AIUnavailableReason, string> = {
  disabled: "AI 비활성 상태",
  kind_disabled: "해당 보조 기능 비활성",
  provider_not_configured: "AI Provider 설정 부재",
  rate_limit: "요청 한도 초과 — 잠시 후 다시 시도",
  provider_error: "AI Provider 응답 오류",
  output_rejected: "안전 가이드라인에 따라 응답을 거부",
  timeout: "AI 응답 시간 초과",
};

export interface AIAssistMeta {
  provider: AIProvider;
  model: string;
  generatedAtISO: string;
  locale: AILocale;
  inputTokens?: number;
  outputTokens?: number;
}

export type AIAssistResponse<K extends AIAssistKind = AIAssistKind> =
  | { status: "ok"; kind: K; output: AIAssistOutputMap[K]; meta: AIAssistMeta }
  | {
      status: "ai_unavailable";
      kind: K;
      reason: AIUnavailableReason;
      fallback?: AIAssistOutputMap[K];
    }
  | { status: "validation_error"; kind: K; errors: string[] };

// -----------------------------------------------------
// 7. Forbidden Phrases (AI_INTEGRATION §5 — output guard)
// -----------------------------------------------------
// 검출은 substring match (case-insensitive, locale-agnostic).
// 다음 phrase 중 하나라도 검출되면 status="ai_unavailable", reason="output_rejected".
// 추가만 허용, 삭제 금지 (AI_INTEGRATION §9.1).

export const FORBIDDEN_OUTPUT_PHRASES: readonly string[] = [
  // §5.1 가격 / 가치 (AI Direction §1)
  "estimated price",
  "estimated value",
  "investment return",
  "appreciation potential",
  "price increase forecast",
  "fair market value confirmed",
  "확정 시장가",
  "투자 수익",
  "예상 수익",
  "투자 가치 보장",
  // §5.2 진위 / 감정
  "authenticity confirmed",
  "forgery suspected",
  "forgery confirmed",
  "정품 확인",
  "원작자 확정",
  "감정 결과 확정",
  // §5.3 법적 / 세무
  "법적 효력 보장",
  "세무 신고 완료",
  "vat 면세 확정",
  "원천징수 확정",
  "compliance verified",
  "tax filing complete",
  // §5.4 condition / 손상
  "damage confirmed",
  "손상 확정",
  "authenticity compromised",
  "insurance claim warranted",
  // §5.5 자율 추천 / 결정
  "buy this work",
  "sell this work",
  "구매 권장합니다",
  "판매 권장합니다",
] as const;

// -----------------------------------------------------
// 8. Helpers — type guards / narrowing
// -----------------------------------------------------

export const isAIAssistKind = (value: unknown): value is AIAssistKind =>
  typeof value === "string" &&
  (AI_ASSIST_KINDS as readonly string[]).includes(value);

export const isAILocale = (value: unknown): value is AILocale =>
  typeof value === "string" && (AI_LOCALES as readonly string[]).includes(value);

export const isAIAssistRequest = (
  value: unknown,
): value is AIAssistRequest => {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; input?: unknown };
  return isAIAssistKind(v.kind) && !!v.input && typeof v.input === "object";
};

// Output-guard substring detection (case-insensitive).
// Returns first matched phrase, or null if clean.
export const detectForbiddenPhrase = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_OUTPUT_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
};

// -----------------------------------------------------
// 9. Const exports (test scenarios + UI consumption)
// -----------------------------------------------------

export const AI_ASSIST_PROTOCOL_VERSION = "1.0.0" as const;
export const AI_ASSIST_PROTOCOL_DOC = "AXVELA_AI_INTEGRATION.md" as const;
