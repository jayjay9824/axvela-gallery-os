"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  INQUIRY_TYPE_LABEL,
  INQUIRY_SOURCE_LABEL,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { Inquiry } from "@/types/inquiry";
import type { Artwork } from "@/types/artwork";

// ============================================================================
// Inquiry Response Drawer — STEP 16 (rule_18 (d), rule_5 AI-Human loop)
//
// Auto-bootstrap: on open, if responseStatus is undefined (no draft yet), the
// drawer immediately calls generateInquiryResponse() to seed an AI draft. One
// click on "AI 응대 초안" supporting button → editable draft.
//
// 2-mode lifecycle:
//   DRAFT: editable, with "AI 재생성" + "발송 처리" buttons
//   SENT:  immutable read-only, displays sent text + sentAt timestamp
//
// rule_4 — once SENT, the response cannot be edited or re-sent.
// rule_8 — generation emits one timeline event (actor: AXVELA AI), send emits
//          one event (actor: 운영자). 한 사용자 액션 = 한 timeline 이벤트.
// ============================================================================

export function InquiryResponseDrawer() {
  const inquiryResponseRequest = useArtworkStore(
    (s) => s.inquiryResponseRequest
  );
  const closeInquiryResponse = useArtworkStore(
    (s) => s.closeInquiryResponse
  );
  const inquiries = useArtworkStore((s) => s.inquiries);
  const artworks = useArtworkStore((s) => s.artworks);
  const generateInquiryResponse = useArtworkStore(
    (s) => s.generateInquiryResponse
  );

  const isOpen = inquiryResponseRequest.kind === "open";
  const inquiryId = isOpen ? inquiryResponseRequest.inquiryId : null;

  const inquiry: Inquiry | undefined = inquiryId
    ? Object.values(inquiries)
        .flat()
        .find((i) => i.id === inquiryId)
    : undefined;

  const artwork: Artwork | undefined = inquiry
    ? artworks.find((a) => a.id === inquiry.artworkId)
    : undefined;

  // Auto-generate the very first draft on open if none exists.
  React.useEffect(() => {
    if (!isOpen || !inquiry) return;
    if (inquiry.responseStatus !== undefined) return;
    generateInquiryResponse(inquiry.id);
  }, [
    isOpen,
    inquiry,
    inquiry?.responseStatus,
    generateInquiryResponse,
  ]);

  return (
    <Drawer
      open={isOpen}
      onClose={closeInquiryResponse}
      title="AI 응대 초안"
    >
      {isOpen && inquiry && artwork && (
        <ResponseView
          key={inquiry.id}
          inquiry={inquiry}
          artwork={artwork}
          onClose={closeInquiryResponse}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// View — branches by responseStatus
// ============================================================================

interface ResponseViewProps {
  inquiry: Inquiry;
  artwork: Artwork;
  onClose: () => void;
}

function ResponseView(props: ResponseViewProps) {
  // While the draft is being generated for the very first time, show a
  // placeholder. In practice this is a single render frame.
  if (props.inquiry.responseStatus === undefined) {
    return <BootstrapPlaceholder onClose={props.onClose} />;
  }
  if (props.inquiry.responseStatus === "SENT") {
    return <SentResponseView {...props} />;
  }
  return <DraftResponseForm {...props} />;
}

// ============================================================================
// DRAFT mode — editable, regenerate + send
// ============================================================================

function DraftResponseForm({ inquiry, artwork, onClose }: ResponseViewProps) {
  const generateInquiryResponse = useArtworkStore(
    (s) => s.generateInquiryResponse
  );
  const sendInquiryResponse = useArtworkStore(
    (s) => s.sendInquiryResponse
  );
  const currentRole = useArtworkStore((s) => s.currentRole);

  const [body, setBody] = React.useState(inquiry.responseDraft ?? "");

  // Re-sync local state if the store-side draft changes (e.g. after regenerate).
  const lastSync = React.useRef(inquiry.responseGeneratedAt);
  React.useEffect(() => {
    if (inquiry.responseGeneratedAt !== lastSync.current) {
      setBody(inquiry.responseDraft ?? "");
      lastSync.current = inquiry.responseGeneratedAt;
    }
  }, [inquiry.responseDraft, inquiry.responseGeneratedAt]);

  const isDirty = body !== (inquiry.responseDraft ?? "");
  const isEmpty = body.trim().length === 0;

  const canRegenerate = hasPermission(
    currentRole,
    "inquiry.generate_response"
  );
  const canSend = hasPermission(currentRole, "inquiry.send_response");

  const handleRegenerate = () => {
    if (isDirty) {
      const ok = window.confirm(
        "AI 초안을 다시 생성하면 현재 편집한 내용이 덮어쓰여집니다. 계속할까요?"
      );
      if (!ok) return;
    }
    generateInquiryResponse(inquiry.id);
  };

  const handleSend = () => {
    sendInquiryResponse(inquiry.id, body);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header inquiry={inquiry} artwork={artwork} />

        {/* DRAFT banner — AI-Human loop reminder (rule_5) */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
          <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
            응대 초안 — 발송 전 검토 필요 (rule_5)
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
            본문을 다듬은 뒤 “발송 처리”를 누르면 본 응대는 영구 기록되며 이후
            수정할 수 없습니다.
          </p>
        </div>

        <Section label="컬렉터 메시지">
          <div className="rounded-md bg-surface-muted border border-line p-3">
            <p className="text-[12px] text-ink leading-relaxed tracking-tightish whitespace-pre-wrap">
              {inquiry.message || "(메시지 없음)"}
            </p>
          </div>
        </Section>

        <Section label="응답 본문">
          <Textarea
            label=""
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder="응답 본문을 입력하세요"
          />
          {inquiry.responseGeneratedAt && (
            <p className="mt-1.5 text-[10.5px] text-ink-subtle tracking-tightish">
              AI 초안 생성 · {formatRelativeKR(inquiry.responseGeneratedAt)}
            </p>
          )}
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleRegenerate}
          disabled={!canRegenerate}
          aria-disabled={!canRegenerate}
        >
          AI 재생성
        </Button>
        <div className="flex items-center gap-2">
          {!canSend && (
            <ButtonHint
              tone="permission"
              align="inline"
              text={permissionHint("inquiry.send_response")}
            />
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handleSend}
            disabled={!canSend || isEmpty}
            aria-disabled={!canSend || isEmpty}
          >
            발송 처리
          </Button>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// SENT mode — immutable record
// ============================================================================

function SentResponseView({
  inquiry,
  artwork,
  onClose,
}: ResponseViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header inquiry={inquiry} artwork={artwork} />

        <div className="mb-5 px-3 py-3 rounded-md bg-surface-muted border border-line-strong flex items-start gap-2.5">
          <LockIcon />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink tracking-tightish font-semibold">
              응대 발송 완료 — 영구 기록
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              발송된 응대는 immutable한 기록으로 보존됩니다. 추가 응대가 필요하면
              새로운 Inquiry로 진행해주세요.
            </p>
            {inquiry.respondedAt && (
              <p className="text-[10.5px] text-ink-subtle mt-1 tracking-tightish">
                발송 시각 · {formatRelativeKR(inquiry.respondedAt)}
              </p>
            )}
          </div>
        </div>

        <Section label="컬렉터 메시지">
          <div className="rounded-md bg-surface-muted border border-line p-3">
            <p className="text-[12px] text-ink leading-relaxed tracking-tightish whitespace-pre-wrap">
              {inquiry.message || "(메시지 없음)"}
            </p>
          </div>
        </Section>

        <Section label="발송된 응답">
          <Textarea
            label=""
            value={inquiry.responseDraft ?? ""}
            onChange={() => undefined}
            rows={14}
            readOnly
            disabled
          />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>
    </div>
  );
}

// ============================================================================
// Bootstrap placeholder
// ============================================================================

function BootstrapPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 px-6 py-5 flex items-center justify-center">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          AI 응대 초안 생성 중…
        </p>
      </div>
      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>
    </div>
  );
}

// ============================================================================
// Shared header
// ============================================================================

function Header({ inquiry, artwork }: { inquiry: Inquiry; artwork: Artwork }) {
  const collectorName = inquiry.collectorName.trim();
  return (
    <>
      {/* Linked artwork */}
      <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
        <div
          aria-hidden
          className="h-9 w-9 rounded border border-line shrink-0"
          style={{ backgroundColor: artwork.thumbnailColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            연결된 작품
          </p>
          <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
            {artwork.title}
          </p>
          <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
            {artwork.axid.code}
          </p>
        </div>
      </div>

      {/* Collector + meta */}
      <div className="mb-5 px-3 py-3 rounded-md border border-line">
        {collectorName ? (
          <>
            <p className="text-[13px] font-semibold text-ink tracking-tight2">
              {collectorName}
            </p>
            {inquiry.contact && (
              <p className="text-[11.5px] text-ink-muted tracking-tightish mt-0.5">
                {inquiry.contact}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-ink-muted italic tracking-tightish">
            컬렉터 정보 미입력
          </p>
        )}
        <p className="mt-2 text-[11px] text-ink-muted tracking-tightish">
          {INQUIRY_TYPE_LABEL[inquiry.inquiryType]}
          <span className="mx-1.5 text-ink-subtle">·</span>
          {INQUIRY_SOURCE_LABEL[inquiry.source]}
          <span className="mx-1.5 text-ink-subtle">·</span>
          {formatRelativeKR(inquiry.createdAt)}
        </p>
      </div>
    </>
  );
}

// ============================================================================
// Local primitives
// ============================================================================

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mb-2">
        {label}
      </h3>
      {children}
    </section>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
