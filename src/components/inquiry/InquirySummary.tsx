"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatRelativeKR,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_COLOR,
  INQUIRY_TYPE_LABEL,
  INQUIRY_SOURCE_LABEL,
} from "@/lib/utils";

interface InquirySummaryProps {
  artworkId: string;
}

export function InquirySummary({ artworkId }: InquirySummaryProps) {
  const inquiries = useArtworkStore((s) => s.inquiries);
  const openInquiryDetail = useArtworkStore((s) => s.openInquiryDetail);
  // STEP 49 — Manual Inquiry Creation 진입점
  const openInquiryCreate = useArtworkStore((s) => s.openInquiryCreate);

  const list = inquiries[artworkId] ?? [];
  const latest = list[0];

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Inquiry"
        hint={list.length > 0 ? `총 ${list.length}건` : "협상의 시작점"}
        onAdd={() => openInquiryCreate(artworkId)}
      />

      {latest ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row */}
            <div className="flex items-center justify-between mb-2.5">
              <StatusPill status={latest.status} />
              <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                {formatRelativeKR(latest.createdAt)}
              </span>
            </div>

            {/* Collector */}
            {latest.collectorName.trim() ? (
              <>
                <p className="text-[13px] font-semibold text-ink tracking-tight2">
                  {latest.collectorName}
                </p>
                {latest.contact && (
                  <p className="text-[11.5px] text-ink-muted tracking-tightish mt-0.5">
                    {latest.contact}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] text-ink-muted tracking-tightish italic">
                컬렉터 정보 입력 필요
              </p>
            )}

            {/* Type · Source */}
            <p className="mt-2 text-[11px] text-ink-muted tracking-tightish">
              {INQUIRY_TYPE_LABEL[latest.inquiryType]}
              <span className="mx-1.5 text-ink-subtle">·</span>
              {INQUIRY_SOURCE_LABEL[latest.source]}
            </p>

            {/* Message preview */}
            {latest.message && (
              <p className="mt-2.5 text-[12px] text-ink-muted leading-relaxed tracking-tightish line-clamp-2">
                “{latest.message}”
              </p>
            )}

            {/* STEP 16 — Response status (rule_18 (d)).
                DRAFT: 작성 중 표시. SENT: 영구 발송 기록 표시. undefined: 표시 없음. */}
            {latest.responseStatus === "SENT" && latest.respondedAt && (
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                  응대 발송
                </span>
                <span className="text-[10.5px] text-ink-muted tabular-nums tracking-tightish">
                  {formatRelativeKR(latest.respondedAt)}
                </span>
              </div>
            )}
            {latest.responseStatus === "DRAFT" && (
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                  AI 응대 초안 작성 중
                </span>
                {latest.responseGeneratedAt && (
                  <span className="text-[10.5px] text-ink-muted tabular-nums tracking-tightish">
                    {formatRelativeKR(latest.responseGeneratedAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-2.5">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openInquiryDetail(latest.id)}
            >
              <span>문의 상세</span>
              <ChevronRightIcon />
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            현재 등록된 문의가 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
            상단 “+ 문의 추가”로 직접 입력하거나 READY → INQUIRY 전환 시
            자동으로 생성됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: keyof typeof INQUIRY_STATUS_LABEL }) {
  const color = INQUIRY_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{INQUIRY_STATUS_LABEL[status]}</span>
    </span>
  );
}

function SectionHeader({
  label,
  hint,
  onAdd,
}: {
  label: string;
  hint?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      <div className="flex items-center gap-3">
        {hint && (
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            {hint}
          </span>
        )}
        {/* STEP 49 — Manual Inquiry Creation 진입점.
            audit log / market analysis inline 버튼과 동일 패턴. */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="text-[10.5px] text-ink-muted enabled:hover:text-ink tracking-tightish transition-colors underline-offset-2 enabled:hover:underline"
          >
            + 문의 추가
          </button>
        )}
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
