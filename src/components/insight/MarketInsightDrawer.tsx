// ============================================================================
// MarketInsightDrawer.tsx — STEP 92 Operational Intelligence Drawer
//
// **본 module이 무엇인가**:
//   `marketInsightRequest` store overlay state로 열리는 read-only drawer.
//   `OperationalInsightSnapshot` (Layer 1+2) + `OperationalInsightSummary`
//   (Layer 3)를 *Bloomberg Terminal + McKinsey + museum-grade calmness* 톤으로
//   표시.
//
// **본 module이 *아닌* 것**:
//   ❌ 가격 예측 / 가치 평가 UI
//   ❌ 자동 추천 button
//   ❌ AI 강조 hype 톤
//   ❌ enterprise dashboard noise
//
// **사용자 spec UX 정확 매칭**:
//   - Bloomberg Terminal: tabular-nums / borders / monospace numerals / 단일 day
//     velocity 명시
//   - McKinsey operational dashboard: numbered hierarchy / 3-line overview /
//     6 category structured
//   - Museum-grade calmness: 그림자 0 / 화려한 색상 0 / disclaimer footer / "운영
//     보조" 톤
//
// **AI Direction §1 / §10 정합**:
//   - "운영 신호" / "참고 신호" / "패턴 감지" / "데이터 부족" 톤만 사용
//   - "AI 예측" / "확정 시장가" / "투자 가치" / "자동 추천" 0건
//   - rule_5 AI-Human Loop — drawer는 사용자 명시 trigger 시만 열림
//
// **Manifesto rule 보존**:
//   - rule_15 Primary 1개 — 본 drawer는 *read-only*, primary action 부재 (period
//     switcher만 secondary control)
//   - rule_16 Apple/OpenAI minimalism — 그림자 0 / border-line / 단색 위주
//   - rule_17 drawer layer — 3-Column 위 overlay
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  deriveOperationalInsightSnapshot,
  INSIGHT_DIRECTION_GLYPH,
  INSIGHT_DIRECTION_LABEL_KR,
  INSIGHT_PERIOD_LABEL_KR,
  type InsightPeriod,
} from "@/lib/operational-insight";
import {
  generateInsightSummary,
  type CategorySummary,
  type InsightSignificanceLevel,
} from "@/lib/operational-insight-summary";

// ============================================================================
// Period switcher — STEP 92 specific (7d / 14d / 30d), STEP 88 패턴 답습
// ============================================================================

const PERIOD_ORDER: readonly InsightPeriod[] = ["7d", "14d", "30d"] as const;

function PeriodSwitcher({
  value,
  onChange,
}: {
  value: InsightPeriod;
  onChange: (next: InsightPeriod) => void;
}) {
  return (
    <div className="inline-flex border border-line rounded-sm overflow-hidden">
      {PERIOD_ORDER.map((p, i) => {
        const active = p === value;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 text-[11px] tracking-wider transition-colors ${
              i > 0 ? "border-l border-line" : ""
            } ${
              active
                ? "bg-ink text-surface"
                : "bg-surface text-ink-subtle hover:bg-surface-subtle"
            }`}
          >
            {INSIGHT_PERIOD_LABEL_KR[p]}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Significance → visual treatment
// ============================================================================

function significanceClass(level: InsightSignificanceLevel): {
  ring: string;
  glyph: string;
  label: string;
} {
  switch (level) {
    case "high":
      return {
        ring: "border-ink/40",
        glyph: "text-ink",
        label: "주의 신호",
      };
    case "medium":
      return {
        ring: "border-line",
        glyph: "text-ink-subtle",
        label: "보조 신호",
      };
    case "low":
      return {
        ring: "border-line/60",
        glyph: "text-ink-subtle/70",
        label: "안정 흐름",
      };
    case "noise":
      return {
        ring: "border-line/40 border-dashed",
        glyph: "text-ink-subtle/50",
        label: "데이터 부족",
      };
  }
}

// ============================================================================
// Category section — Bloomberg Terminal 톤 (tabular-nums + glyph + observation)
// ============================================================================

function CategorySection({
  index,
  summary,
}: {
  index: number;
  summary: CategorySummary;
}) {
  const sig = significanceClass(summary.significance);
  const glyph = INSIGHT_DIRECTION_GLYPH[summary.direction];
  const dirLabel = INSIGHT_DIRECTION_LABEL_KR[summary.direction];

  return (
    <section className={`border ${sig.ring} bg-surface px-4 py-3.5`}>
      {/* Header — index + category title + direction glyph + significance badge */}
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] tracking-[0.2em] text-ink-subtle/70 uppercase tabular-nums">
            §{index}
          </span>
          <h3 className="text-[13px] font-medium text-ink truncate">
            {summary.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[14px] leading-none ${sig.glyph} tabular-nums`}>
            {glyph}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle/70">
            {dirLabel}
          </span>
        </div>
      </header>

      {/* Headline — single sentence, factual */}
      <p className="text-[13px] leading-relaxed text-ink mb-2">
        {summary.headline}
      </p>

      {/* Observations — McKinsey style enumeration */}
      {summary.observations.length > 0 && (
        <ul className="space-y-1">
          {summary.observations.map((obs, i) => (
            <li
              key={i}
              className="text-[11.5px] leading-relaxed text-ink-subtle tabular-nums"
            >
              <span className="text-ink-subtle/50 mr-1.5 select-none">·</span>
              {obs}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================================
// Drawer body
// ============================================================================

function MarketInsightBody({ artworkId }: { artworkId?: string }) {
  const [period, setPeriod] = React.useState<InsightPeriod>("14d");

  const artworks = useArtworkStore((s) => s.artworks);
  const inquiriesBySlice = useArtworkStore((s) => s.inquiries);
  const transactionsBySlice = useArtworkStore((s) => s.transactions);
  const settlementsBySlice = useArtworkStore((s) => s.settlements);

  /**
   * Store slices are stored as `Record<artworkId|txId, Entity[]>` — flatten to
   * a single readonly array for the pure derive layer (rule_11 chain agnostic).
   */
  function flattenSlice<T>(slice: unknown): T[] {
    if (Array.isArray(slice)) return slice as T[];
    if (slice && typeof slice === "object") {
      return Object.values(slice as Record<string, T[]>).flat();
    }
    return [];
  }

  const inquiries = React.useMemo(
    () => flattenSlice<import("@/types/inquiry").Inquiry>(inquiriesBySlice),
    [inquiriesBySlice]
  );
  const transactions = React.useMemo(
    () =>
      flattenSlice<import("@/types/transaction").Transaction>(transactionsBySlice),
    [transactionsBySlice]
  );
  const settlements = React.useMemo(
    () =>
      flattenSlice<import("@/types/settlement").Settlement>(settlementsBySlice),
    [settlementsBySlice]
  );

  // 매 drawer open 시점의 *now* 캡처 — 결정성 보장 + drawer 닫고 다시 열면 갱신
  const now = React.useMemo(() => new Date().toISOString(), []);

  const snapshot = React.useMemo(
    () =>
      deriveOperationalInsightSnapshot({
        artworks,
        inquiries,
        transactions,
        settlements,
        period,
        now,
      }),
    [artworks, inquiries, transactions, settlements, period, now]
  );

  const summary = React.useMemo(
    () => generateInsightSummary(snapshot),
    [snapshot]
  );

  // Artwork-aware context (사용자가 DetailPanel ZONE 5에서 진입 시)
  const focusedArtwork = artworkId
    ? artworks.find((a) => a.id === artworkId)
    : null;

  const categoryOrder: Array<keyof typeof summary.categories> = [
    "inquiry",
    "save",
    "artist",
    "settlement",
    "funnel",
    "activity",
  ];

  const generatedAtFormatted = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(snapshot.generatedAt));
    } catch {
      return snapshot.generatedAt;
    }
  }, [snapshot.generatedAt]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar — period switcher + meta ──────────────────────────── */}
      <div className="px-5 py-4 border-b border-line bg-surface-subtle/40">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-[14px] font-medium text-ink">
              갤러리 운영 신호
            </h2>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              실 운영 데이터 기반 패턴 감지 · 가격 예측 / 추천 무관
            </p>
          </div>
          <PeriodSwitcher value={period} onChange={setPeriod} />
        </div>
        <div className="flex items-center justify-between gap-3 text-[10.5px] text-ink-subtle tabular-nums">
          <span>생성 {generatedAtFormatted}</span>
          {focusedArtwork && (
            <span className="truncate">
              컨텍스트: {focusedArtwork.title} · {focusedArtwork.artist?.name ?? ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview — 3-line institutional summary */}
        <section className="px-5 py-4 border-b border-line">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-ink-subtle/70 mb-2.5">
            Overview · {INSIGHT_PERIOD_LABEL_KR[snapshot.period]}
          </h3>
          <ol className="space-y-1.5">
            {summary.overview.map((line, i) => (
              <li
                key={i}
                className="text-[12.5px] leading-relaxed text-ink flex items-baseline gap-2.5"
              >
                <span className="text-[10px] text-ink-subtle/60 tabular-nums shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 6 categories — Bloomberg/McKinsey hierarchy */}
        <div className="p-5 space-y-3.5">
          {categoryOrder.map((key, i) => (
            <CategorySection
              key={key}
              index={i + 1}
              summary={summary.categories[key]}
            />
          ))}
        </div>

        {/* Disclaimer footer — AI Direction §1 / §10 */}
        <footer className="px-5 py-4 border-t border-line bg-surface-subtle/30">
          <ul className="space-y-1">
            {summary.disclaimer.map((line, i) => (
              <li
                key={i}
                className="text-[10.5px] leading-relaxed text-ink-subtle/80"
              >
                {line}
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// Top-level drawer
// ============================================================================

export function MarketInsightDrawer() {
  const request = useArtworkStore((s) => s.marketInsightRequest);
  const closeMarketInsight = useArtworkStore((s) => s.closeMarketInsight);

  const open = request.kind === "open";
  const artworkId = request.kind === "open" ? request.artworkId : undefined;

  return (
    <Drawer
      open={open}
      onClose={closeMarketInsight}
      title="갤러리 운영 신호"
      widthClass="w-[560px]"
    >
      {open && <MarketInsightBody artworkId={artworkId} />}
    </Drawer>
  );
}
