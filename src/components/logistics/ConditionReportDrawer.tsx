"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  REPORT_TYPE_LABEL,
  CONDITION_STATUS_LABEL,
  CONDITION_STATUS_COLOR,
  CONDITION_STATUS_ORDER,
  LOGISTICS_STATUS_LABEL,
} from "@/lib/utils";
import type {
  ConditionReport,
  ConditionStatus,
  ReportType,
} from "@/types/condition-report";
import type { Logistics } from "@/types/logistics";
import type { Artwork } from "@/types/artwork";

// ============================================================================
// Drawer wrapper — branches on request kind (create vs edit)
// ============================================================================

export function ConditionReportDrawer() {
  const conditionReportRequest = useArtworkStore(
    (s) => s.conditionReportRequest
  );
  const closeConditionReport = useArtworkStore(
    (s) => s.closeConditionReport
  );
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const logistics = useArtworkStore((s) => s.logistics);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = conditionReportRequest.kind !== "closed";

  // Resolve context based on kind
  const ctx = React.useMemo(() => {
    if (conditionReportRequest.kind === "closed") return null;

    if (conditionReportRequest.kind === "create") {
      const log = Object.values(logistics)
        .flat()
        .find((l) => l.id === conditionReportRequest.logisticsId);
      if (!log) return null;
      const artwork = artworks.find((a) => a.id === log.artworkId);
      if (!artwork) return null;
      return {
        mode: "create" as const,
        log,
        artwork,
        reportType: conditionReportRequest.reportType,
        existing: undefined as ConditionReport | undefined,
      };
    }

    // edit
    const report = Object.values(conditionReports)
      .flat()
      .find((r) => r.id === conditionReportRequest.reportId);
    if (!report) return null;
    const log = Object.values(logistics)
      .flat()
      .find((l) => l.id === report.logisticsId);
    if (!log) return null;
    const artwork = artworks.find((a) => a.id === report.artworkId);
    if (!artwork) return null;
    return {
      mode: "edit" as const,
      log,
      artwork,
      reportType: report.reportType,
      existing: report,
    };
  }, [conditionReportRequest, conditionReports, logistics, artworks]);

  return (
    <Drawer
      open={isOpen}
      onClose={closeConditionReport}
      title={
        ctx
          ? `${REPORT_TYPE_LABEL[ctx.reportType]}${
              ctx.mode === "edit" ? " · 편집" : " · 작성"
            }`
          : "컨디션 리포트"
      }
    >
      {isOpen && ctx && (
        <ReportForm
          key={
            ctx.mode === "edit" ? ctx.existing!.id : `${ctx.log.id}:${ctx.reportType}`
          }
          ctx={ctx}
          onClose={closeConditionReport}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form — handles both create and edit
// ============================================================================

interface ReportFormProps {
  ctx: {
    mode: "create" | "edit";
    log: Logistics;
    artwork: Artwork;
    reportType: ReportType;
    existing: ConditionReport | undefined;
  };
  onClose: () => void;
}

function ReportForm({ ctx, onClose }: ReportFormProps) {
  const createConditionReport = useArtworkStore(
    (s) => s.createConditionReport
  );
  const createConditionReportCorrection = useArtworkStore(
    (s) => s.createConditionReportCorrection
  );

  const isEdit = ctx.mode === "edit";

  // STEP 15 — edit mode is read-only by default. User explicitly chooses
  // "수정본 작성" to enter correction-creation mode, which keeps the original
  // record immutable and creates a NEW ConditionReport with correctsReportId.
  const [isCreatingCorrection, setIsCreatingCorrection] =
    React.useState(false);

  const isReadOnly = isEdit && !isCreatingCorrection;

  const [conditionStatus, setConditionStatus] = React.useState<ConditionStatus>(
    ctx.existing?.conditionStatus ?? "GOOD"
  );
  const [notes, setNotes] = React.useState(ctx.existing?.notes ?? "");

  // Track whether correction has actual changes vs original
  const correctionIsDirty = ctx.existing
    ? conditionStatus !== ctx.existing.conditionStatus ||
      notes !== ctx.existing.notes
    : false;

  // For AFTER_DELIVERY creates against DELIVERED logistics, surface the
  // cascade hint so the user knows the logistics will auto-flip.
  const willCascadeStatus =
    ctx.mode === "create" &&
    ctx.reportType === "AFTER_DELIVERY" &&
    ctx.log.status === "DELIVERED";

  const handleStartCorrection = () => {
    setIsCreatingCorrection(true);
  };

  const handleCancelCorrection = () => {
    // Roll back form state to original values when leaving correction mode
    setConditionStatus(ctx.existing?.conditionStatus ?? "GOOD");
    setNotes(ctx.existing?.notes ?? "");
    setIsCreatingCorrection(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return; // belt-and-braces; original is immutable

    if (isCreatingCorrection) {
      if (!correctionIsDirty) {
        // Nothing to correct — bounce back to read-only view
        setIsCreatingCorrection(false);
        return;
      }
      createConditionReportCorrection(ctx.existing!.id, {
        conditionStatus,
        notes,
      });
    } else {
      createConditionReport({
        logisticsId: ctx.log.id,
        reportType: ctx.reportType,
        conditionStatus,
        notes,
      });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Read-only banner for original reports (STEP 15, rule_4) */}
        {isReadOnly && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
            <div className="flex items-center gap-2">
              <LockMiniIcon />
              <p className="text-[11.5px] text-ink font-semibold tracking-tightish">
                Condition Report · 읽기 전용
              </p>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
              Condition Report는 작품 상태 증명 기록이므로 생성 후 수정할 수 없습니다.
              내용이 잘못된 경우 아래 “수정본 작성”으로 새 리포트를 발행할 수 있습니다.
            </p>
          </div>
        )}

        {/* Correction-mode banner */}
        {isCreatingCorrection && ctx.existing && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              수정본 작성 중 — 원본은 보존됩니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              저장 시 새 ConditionReport가 발행되며 원본
              <span className="font-mono"> {ctx.existing.id}</span>은 그대로 유지됩니다.
            </p>
          </div>
        )}

        {/* Linked artwork */}
        <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <div
            aria-hidden
            className="h-9 w-9 rounded border border-line shrink-0"
            style={{ backgroundColor: ctx.artwork.thumbnailColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 작품
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
              {ctx.artwork.title}
            </p>
            <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
              {ctx.artwork.axid.code}
            </p>
          </div>
        </div>

        {/* Report type — read-only context display */}
        <div className="mb-5 flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-line">
          <div>
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              리포트 타입
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium">
              {REPORT_TYPE_LABEL[ctx.reportType]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              배송 상태
            </p>
            <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
              {LOGISTICS_STATUS_LABEL[ctx.log.status]}
            </p>
          </div>
        </div>

        {/* AFTER_DELIVERY → CONDITION_CHECKED cascade hint */}
        {willCascadeStatus && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              저장 시 배송 상태가 자동 전환됩니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              {LOGISTICS_STATUS_LABEL.DELIVERED} →{" "}
              {LOGISTICS_STATUS_LABEL.CONDITION_CHECKED} (rule_21)
            </p>
          </div>
        )}

        <Section label="컨디션 상태">
          <ConditionRadioGroup
            value={conditionStatus}
            onChange={setConditionStatus}
            disabled={isReadOnly}
          />
        </Section>

        <Divider />

        <Section label="메모">
          <Textarea
            label=""
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="관찰 내용 / 특이사항을 기록하세요"
            disabled={isReadOnly}
          />
          {!isReadOnly && (
            <DocumentWritingAssistButton
              target="condition_report"
              buildSourceText={() => notes}
              onApply={setNotes}
              applyButtonLabel="메모에 적용"
              className="mt-2"
            />
          )}
        </Section>

        <Divider />

        {/* STEP 96 — 다국어 보기 (condition report projection) */}
        <Section label="다국어 보기">
          <TranslationToolbar
            buildSourceText={() => notes}
            domain="general"
          />
        </Section>

        <Divider />

        {/* Image placeholder — v1 not implemented */}
        <Section label="이미지">
          <div className="rounded-md border border-dashed border-line bg-surface-muted px-4 py-6 flex flex-col items-center justify-center gap-1.5">
            <CameraIcon />
            <p className="text-[11.5px] text-ink-muted tracking-tightish font-medium">
              이미지 첨부 영역
            </p>
            <p className="text-[10.5px] text-ink-subtle tracking-tightish">
              후속 단계에서 구현 예정 (v1 placeholder)
            </p>
          </div>
        </Section>

        {/* Audit trail — edit mode only */}
        {isEdit && ctx.existing && (
          <>
            <Divider />
            <Section label="기록 이력">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Meta
                  label="Report ID"
                  value={ctx.existing.id}
                  mono
                />
                <Meta
                  label="생성"
                  value={formatRelativeKR(ctx.existing.createdAt)}
                />
                <Meta
                  label="최근 수정"
                  value={formatRelativeKR(ctx.existing.updatedAt)}
                />
              </div>
            </Section>
          </>
        )}
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        {isReadOnly ? (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              닫기
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleStartCorrection}
            >
              수정본 작성
            </Button>
          </>
        ) : isCreatingCorrection ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancelCorrection}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!correctionIsDirty}
              aria-disabled={!correctionIsDirty}
            >
              저장 (수정본 생성)
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              닫기
            </Button>
            <Button type="submit" variant="primary">
              리포트 작성
            </Button>
          </>
        )}
      </footer>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function ConditionRadioGroup({
  value,
  onChange,
  disabled = false,
}: {
  value: ConditionStatus;
  onChange: (v: ConditionStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2">
      {CONDITION_STATUS_ORDER.map((s) => {
        const checked = value === s;
        const color = CONDITION_STATUS_COLOR[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-md border transition-colors text-[11.5px] font-medium tracking-tightish ${
              checked
                ? "border-line-strong bg-surface-muted"
                : "border-line bg-surface hover:bg-surface-muted"
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span style={{ color: checked ? color : undefined }}>
              {CONDITION_STATUS_LABEL[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-ink-subtle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
        {label}
      </p>
      <p
        className={`text-[12px] mt-0.5 tracking-tightish text-ink-muted ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line my-5" aria-hidden />;
}

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
