// ============================================================================
// MarketAnalysisDrawer — STEP 45 (rule_18 (b)).
//
// 단일 작품에 대한 AI 시장 분석 commentary view. 6 sections (Market Position
// / Comparable Summary / Liquidity / Demand / Pricing Confidence / Risk Notes)
// 를 deterministic generator로 derive해 표시.
//
// **데이터 정책 (사용자 spec):**
//   - 신규 도메인 store slice 0개 · pure read-only aggregation
//   - 분석은 매 drawer open 시 useMemo로 재계산 (store에 보관 0)
//   - 실제 AI API 호출 0건 — generateMarketAnalysis() pure function
//   - MarketSignal 구조 변경 0줄 — gatherMarketSignals() 결과만 read-only 소비
//
// **표현 정책:**
//   - "참고 분석" / "운영 참고" / "시장 신호 기반" 사용
//   - "감정가" / "확정 시장가" / "투자 수익 보장" 표현 0건 (disclaimer 부정형 외)
//
// **UI 위치 (rule_14 + rule_17):**
//   - 3-Column 레이아웃 무변경
//   - Drawer 720px width — 6 section 카드 형태
//   - DetailPanel "AI 시장 분석" 인라인 버튼 → 진입
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { cn } from "@/lib/utils";
import { gatherMarketSignals } from "@/lib/market-data";
import { computeGalleryMedianPriceKRW } from "@/lib/axvela-price";
import {
  generateMarketAnalysis,
  formatKRW,
  MARKET_POSITION_LABEL_KR,
  LIQUIDITY_LABEL_KR,
  DEMAND_LABEL_KR,
} from "@/lib/market-analysis-generator";
import {
  exportMarketAnalysis,
  type MarketAnalysisExportFormat,
} from "@/lib/market-analysis-export";
import type {
  MarketAnalysisReport,
  MarketPositionSection,
  ComparableSummarySection,
  LiquiditySection,
  DemandSection,
  PricingConfidenceSection,
  RiskNote,
} from "@/types/market-analysis";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const RECENT_INQUIRY_DAYS = 30;
const ACTIVE_INQUIRY_STATUSES = new Set(["OPEN", "RESPONDED", "ESCALATED"]);
const PAID_TX_STATUSES = new Set(["PAID", "SETTLED", "COMPLETED"]);

// ----------------------------------------------------------------------------
// Drawer
// ----------------------------------------------------------------------------

export function MarketAnalysisDrawer() {
  const request = useArtworkStore((s) => s.marketAnalysisRequest);
  const closeView = useArtworkStore((s) => s.closeMarketAnalysis);
  const artworks = useArtworkStore((s) => s.artworks);
  const transactions = useArtworkStore((s) => s.transactions);
  const payments = useArtworkStore((s) => s.payments);
  const inquiries = useArtworkStore((s) => s.inquiries);
  const priceSuggestions = useArtworkStore((s) => s.priceSuggestions);

  const isOpen = request.kind === "open";
  const artworkId = request.kind === "open" ? request.artworkId : null;

  const artwork = React.useMemo(
    () => (artworkId ? artworks.find((a) => a.id === artworkId) ?? null : null),
    [artworks, artworkId]
  );

  // Generator input — useMemo chain. 모든 상위 store slice는 read-only,
  // 새 핵심 계산 로직 0개 (helper들은 STEP 18/19/29에서 이미 정의됨).
  const report = React.useMemo<MarketAnalysisReport | null>(() => {
    if (!artwork) return null;

    // 1. Market signals (STEP 19/29 — already deterministic, read-only consumer)
    const signals = gatherMarketSignals({
      artworkId: artwork.id,
      artistName: artwork.artist.name,
      allArtworks: artworks,
      allTransactions: transactions,
      allPayments: payments,
      allInquiries: inquiries,
    });

    // 2. Latest price suggestion (STEP 18 — read-only)
    const latestSuggestion = priceSuggestions[artwork.id]?.[0] ?? null;

    // 3. Same-artist KRW transaction count (PAID/SETTLED/COMPLETED only)
    let artistTransactionCount = 0;
    let artistArtworkCount = 0;
    const sameArtistArtworkIds: string[] = [];
    for (const a of artworks) {
      if (a.artist.name === artwork.artist.name) {
        if (a.priceKRW > 0) artistArtworkCount += 1;
        sameArtistArtworkIds.push(a.id);
      }
    }
    for (const aid of sameArtistArtworkIds) {
      const txs = transactions[aid] ?? [];
      for (const t of txs) {
        if (t.currency === "KRW" && PAID_TX_STATUSES.has(t.status)) {
          artistTransactionCount += 1;
        }
      }
    }

    // 4. Own transaction count
    const ownTxs = transactions[artwork.id] ?? [];
    const ownTransactionCount = ownTxs.length;

    // 5. Inquiry counts
    const ownInq = inquiries[artwork.id] ?? [];
    const totalInquiryCount = ownInq.length;
    const recentCutoff = Date.now() - RECENT_INQUIRY_DAYS * 24 * 60 * 60 * 1000;
    let recentInquiryCount = 0;
    let activeInquiryCount = 0;
    for (const i of ownInq) {
      if (i.createdAt) {
        const t = new Date(i.createdAt).getTime();
        if (!Number.isNaN(t) && t >= recentCutoff) recentInquiryCount += 1;
      }
      if (ACTIVE_INQUIRY_STATUSES.has(i.status)) activeInquiryCount += 1;
    }

    // 6. Gallery KRW median (STEP 18 helper, read-only)
    const galleryMedianKRW = computeGalleryMedianPriceKRW(artworks);

    return generateMarketAnalysis({
      artwork,
      signals,
      latestSuggestion,
      artistTransactionCount,
      artistArtworkCount,
      ownTransactionCount,
      totalInquiryCount,
      recentInquiryCount,
      activeInquiryCount,
      galleryMedianKRW,
    });
  }, [artwork, artworks, transactions, payments, inquiries, priceSuggestions]);

  // STEP 46 — Market Analysis Export. Drawer에 표시 중인 report 객체를 그대로
  // PDF로 직렬화. Report 부재 시 silent no-op (footer button 자체가 report
  // 분기 안에서만 렌더되므로 추가 가드는 defensive).
  const handleExport = React.useCallback(
    (format: MarketAnalysisExportFormat) => {
      if (!report) return;
      exportMarketAnalysis(format, report);
    },
    [report]
  );

  return (
    <Drawer
      open={isOpen}
      onClose={closeView}
      title="AI 참고 분석"
      widthClass="w-[720px]"
    >
      {isOpen && report && artwork && (
        <div className="flex flex-col h-full">
          {/* Disclaimer banner */}
          <div className="border-b border-line px-6 py-3 shrink-0 bg-surface">
            <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
              <span className="text-ink font-medium">참고 분석 · 시장 신호 기반</span>{" "}
              · 내부 거래 / 외부 reference 신호에서 자동 derive — 감정가 또는
              확정 시장가가 아닙니다.
            </p>
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-line shrink-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
              분석 대상
            </p>
            <h3 className="mt-1 text-[16px] font-medium tracking-tight text-ink">
              {artwork.title}
            </h3>
            <p className="text-[11.5px] text-ink-muted tracking-tightish">
              {artwork.artist.name} · {formatKRW(artwork.priceKRW)}
            </p>
            <p className="mt-2 text-[10px] text-ink-subtle tracking-tightish">
              생성 시각 · {report.generatedAt.replace("T", " ").slice(0, 16)} ·
              신호 {report.metadata.signalCount}건 ·{" "}
              {report.metadata.providers.join(" / ") || "—"}
            </p>
          </div>

          {/* Body — 6 sections */}
          <div className="flex-1 overflow-y-auto scroll-clean px-6 py-5 flex flex-col gap-5">
            <SectionCard
              index="01"
              title="Market Position"
              subtitle="갤러리 가격 위치"
              accent={POSITION_ACCENT[report.marketPosition.tier]}
              badge={MARKET_POSITION_LABEL_KR[report.marketPosition.tier]}
              commentary={report.marketPosition.commentary}
            >
              <PositionMetrics section={report.marketPosition} />
            </SectionCard>

            <SectionCard
              index="02"
              title="Comparable Signals"
              subtitle="동일 작가 비교 거래"
              commentary={report.comparableSummary.commentary}
            >
              <ComparableMetrics section={report.comparableSummary} />
            </SectionCard>

            <SectionCard
              index="03"
              title="Liquidity"
              subtitle="유동성 신호"
              accent={LIQUIDITY_ACCENT[report.liquiditySignal.level]}
              badge={LIQUIDITY_LABEL_KR[report.liquiditySignal.level]}
              commentary={report.liquiditySignal.commentary}
            >
              <LiquidityMetrics section={report.liquiditySignal} />
            </SectionCard>

            <SectionCard
              index="04"
              title="Demand"
              subtitle="문의 / 수요 신호"
              accent={DEMAND_ACCENT[report.demandSignal.level]}
              badge={DEMAND_LABEL_KR[report.demandSignal.level]}
              commentary={report.demandSignal.commentary}
            >
              <DemandMetrics section={report.demandSignal} />
            </SectionCard>

            <SectionCard
              index="05"
              title="Pricing Confidence"
              subtitle="참고 가격 신호 신뢰도"
              badge={
                report.pricingConfidence.hasSuggestion
                  ? report.pricingConfidence.confidenceLabel
                  : "참고 신호 부재"
              }
              accent={
                !report.pricingConfidence.hasSuggestion
                  ? "muted"
                  : report.pricingConfidence.latestConfidence !== null &&
                    report.pricingConfidence.latestConfidence >= 0.75
                  ? "positive"
                  : report.pricingConfidence.latestConfidence !== null &&
                    report.pricingConfidence.latestConfidence >= 0.5
                  ? "neutral"
                  : "warning"
              }
              commentary={report.pricingConfidence.commentary}
            >
              <PricingMetrics section={report.pricingConfidence} />
            </SectionCard>

            <SectionCard
              index="06"
              title="Risk / Caution Notes"
              subtitle="주의 사항"
              commentary=""
            >
              <RiskNotesList notes={report.riskNotes.notes} />
            </SectionCard>

            {/* Footnote */}
            <div className="mt-1 pt-4 border-t border-dashed border-line">
              <p className="text-[10px] text-ink-subtle tracking-tightish leading-relaxed">
                본 분석은 휴리스틱 기반 운영 참고용입니다. 가격 결정 / 거래 권유
                / 투자 수익 보장과 무관합니다.
                {report.metadata.hasExternalSignals && (
                  <>
                    {" "}외부 reference 신호는 옥션 / 마켓플레이스의 참고 데이터이며
                    실 낙찰가가 아닐 수 있습니다.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Footer — STEP 46 PDF Export + close (STEP 44 customer-export 패턴) */}
          <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-between bg-surface">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
                내보내기
              </span>
              <ExportButton
                label="PDF"
                onClick={() => handleExport("pdf")}
                disabled={!report}
              />
            </div>
            <Button type="button" variant="ghost" onClick={closeView}>
              닫기
            </Button>
          </footer>
        </div>
      )}

      {isOpen && (!report || !artwork) && (
        <div className="flex items-center justify-center h-full">
          <p className="text-[12px] text-ink-subtle tracking-tightish">
            분석 대상 작품을 찾을 수 없습니다.
          </p>
        </div>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------------
// Footer — Export button (STEP 44 customer-export 패턴 그대로)
// ----------------------------------------------------------------------------

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}

// ----------------------------------------------------------------------------
// SectionCard — 6개 섹션 공통 wrapper
// ----------------------------------------------------------------------------

type Accent = "positive" | "neutral" | "warning" | "muted";

function SectionCard({
  index,
  title,
  subtitle,
  badge,
  accent,
  commentary,
  children,
}: {
  index: string;
  title: string;
  subtitle: string;
  badge?: string;
  accent?: Accent;
  commentary: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-surface px-4 py-4">
      <header className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] font-mono text-ink-subtle tracking-[0.06em] tabular-nums">
            {index}
          </span>
          <h4 className="text-[13px] font-semibold tracking-tightish text-ink truncate">
            {title}
          </h4>
          <span className="text-[10px] text-ink-subtle tracking-tightish truncate">
            · {subtitle}
          </span>
        </div>
        {badge && (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full border text-[10px] tracking-tightish shrink-0",
              ACCENT_CLASS[accent ?? "neutral"]
            )}
          >
            {badge}
          </span>
        )}
      </header>
      {commentary && (
        <p className="text-[12px] text-ink-muted tracking-tightish leading-relaxed mb-3">
          {commentary}
        </p>
      )}
      {children}
    </section>
  );
}

const ACCENT_CLASS: Record<Accent, string> = {
  positive: "border-ink text-ink bg-surface",
  neutral: "border-line text-ink-muted bg-surface",
  warning: "border-amber-700 text-amber-700 bg-surface",
  muted: "border-line text-ink-subtle bg-surface-muted",
};

const POSITION_ACCENT: Record<string, Accent> = {
  ABOVE_MEDIAN: "positive",
  AT_MEDIAN: "neutral",
  BELOW_MEDIAN: "neutral",
  INSUFFICIENT_DATA: "muted",
};

const LIQUIDITY_ACCENT: Record<string, Accent> = {
  STRONG: "positive",
  MODERATE: "neutral",
  LIMITED: "warning",
  INSUFFICIENT_DATA: "muted",
};

const DEMAND_ACCENT: Record<string, Accent> = {
  ELEVATED: "positive",
  STEADY: "neutral",
  LOW: "warning",
  NONE: "muted",
};

// ----------------------------------------------------------------------------
// Per-section metrics
// ----------------------------------------------------------------------------

function PositionMetrics({ section }: { section: MarketPositionSection }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        label="중간가 대비"
        value={
          section.ratioToMedian !== null
            ? `${(section.ratioToMedian * 100).toFixed(0)}%`
            : "—"
        }
      />
      <Stat
        label="작가 작품 보유"
        value={`${section.artistArtworkCount}점`}
      />
    </div>
  );
}

function ComparableMetrics({ section }: { section: ComparableSummarySection }) {
  const rows: Array<{ label: string; value: string; hint: string }> = [];

  rows.push({
    label: "내부 거래 평균",
    value:
      section.internalArtistAvgKRW !== null
        ? formatKRW(section.internalArtistAvgKRW)
        : "—",
    hint:
      section.internalArtistAvgKRW !== null
        ? `sample ${section.internalArtistSampleSize}`
        : "신호 없음",
  });

  rows.push({
    label: "외부 reference 평균",
    value:
      section.externalArtistAvgKRW !== null
        ? formatKRW(section.externalArtistAvgKRW)
        : "—",
    hint:
      section.externalArtistAvgKRW !== null
        ? `sample ${section.externalArtistSampleSize} · 외부`
        : "신호 없음",
  });

  if (section.recentSale) {
    rows.push({
      label: "최근 거래",
      value: formatKRW(section.recentSale.valueKRW),
      hint: `${section.recentSale.isExternal ? "외부 reference" : "내부 기록"} · ${section.recentSale.freshness.slice(0, 10)}`,
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {rows.map((r) => (
        <Stat key={r.label} label={r.label} value={r.value} hint={r.hint} />
      ))}
    </div>
  );
}

function LiquidityMetrics({ section }: { section: LiquiditySection }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <Stat
        label="작가 거래 (KRW)"
        value={`${section.artistTransactionCount}건`}
        hint="PAID 이상"
      />
      <Stat
        label="본 작품 transaction"
        value={`${section.ownTransactionCount}건`}
      />
      <Stat
        label="self-resale"
        value={section.hasSelfResale ? "있음" : "없음"}
        hint={
          section.selfResaleValueKRW !== null
            ? formatKRW(section.selfResaleValueKRW)
            : ""
        }
      />
    </div>
  );
}

function DemandMetrics({ section }: { section: DemandSection }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="누적 문의" value={`${section.totalInquiryCount}건`} />
      <Stat
        label="최근 30일"
        value={`${section.recentInquiryCount}건`}
      />
      <Stat
        label="진행 중"
        value={`${section.activeInquiryCount}건`}
      />
    </div>
  );
}

function PricingMetrics({ section }: { section: PricingConfidenceSection }) {
  if (!section.hasSuggestion || !section.latestRange) {
    return (
      <div className="rounded-md border border-dashed border-line px-3 py-3 text-center">
        <p className="text-[11px] text-ink-subtle tracking-tightish">
          참고 가격 신호가 아직 생성되지 않음
        </p>
      </div>
    );
  }
  const { low, mid, high, currency } = section.latestRange;
  const fmt = (n: number) =>
    currency === "KRW"
      ? formatKRW(n)
      : `${currency} ${n.toLocaleString("en-US")}`;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat
        label="신뢰도"
        value={`${(((section.latestConfidence ?? 0) * 100) | 0)}%`}
        hint={section.confidenceLabel}
      />
      <Stat label="Low" value={fmt(low)} />
      <Stat label="Mid" value={fmt(mid)} hint="제안 중심값" />
      <Stat label="High" value={fmt(high)} />
    </div>
  );
}

function RiskNotesList({ notes }: { notes: RiskNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-[11px] text-ink-subtle tracking-tightish">
        주의 사항 없음.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {notes.map((n, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-md border px-2.5 py-2",
            SEVERITY_CLASS[n.severity]
          )}
        >
          <span
            className={cn(
              "shrink-0 mt-1 h-1.5 w-1.5 rounded-full",
              SEVERITY_DOT_CLASS[n.severity]
            )}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-ink tracking-tightish leading-relaxed">
              {n.message}
            </p>
            <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle">
              {SEVERITY_LABEL[n.severity]}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const SEVERITY_CLASS: Record<RiskNote["severity"], string> = {
  HIGH: "border-amber-700 bg-amber-50/40",
  MEDIUM: "border-line bg-surface-muted",
  LOW: "border-line bg-surface",
};

const SEVERITY_DOT_CLASS: Record<RiskNote["severity"], string> = {
  HIGH: "bg-amber-700",
  MEDIUM: "bg-ink-muted",
  LOW: "bg-ink-subtle",
};

const SEVERITY_LABEL: Record<RiskNote["severity"], string> = {
  HIGH: "주의",
  MEDIUM: "참고",
  LOW: "안내",
};

// ----------------------------------------------------------------------------
// Common Stat card
// ----------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-subtle font-medium">
        {label}
      </span>
      <span className="text-[13.5px] tabular-nums tracking-tight text-ink font-medium mt-0.5">
        {value}
      </span>
      {hint && (
        <span className="text-[9.5px] tracking-tightish text-ink-subtle mt-0.5">
          {hint}
        </span>
      )}
    </div>
  );
}
