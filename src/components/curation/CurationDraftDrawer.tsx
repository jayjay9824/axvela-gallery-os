"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  CURATION_STATUS_LABEL,
  CURATION_STATUS_COLOR,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { CurationNote, CurationStatus } from "@/types/curation";
import type { Artwork } from "@/types/artwork";

// ============================================================================
// Drawer wrapper — STEP 16 (rule_18 (a), rule_4 + rule_5)
//
// Auto-bootstrap behavior: on open, if no CurationNote exists for the artwork,
// the drawer immediately calls createCurationNote() to seed a v1 DRAFT.
// This keeps the user flow seamless — one click on "AI 큐레이션 초안" supporting
// action goes straight to an editable draft.
// ============================================================================

export function CurationDraftDrawer() {
  const curationDraftRequest = useArtworkStore((s) => s.curationDraftRequest);
  const closeCurationDraft = useArtworkStore((s) => s.closeCurationDraft);
  const artworks = useArtworkStore((s) => s.artworks);
  const curationNotes = useArtworkStore((s) => s.curationNotes);
  const createCurationNote = useArtworkStore((s) => s.createCurationNote);

  const isOpen = curationDraftRequest.kind === "open";
  const artworkId = isOpen ? curationDraftRequest.artworkId : null;
  const artwork: Artwork | undefined = artworkId
    ? artworks.find((a) => a.id === artworkId)
    : undefined;

  const list = artworkId ? curationNotes[artworkId] ?? [] : [];
  const latest: CurationNote | undefined = list[0];

  // Auto-create v1 DRAFT on first open if nothing exists yet.
  React.useEffect(() => {
    if (!isOpen || !artworkId || latest) return;
    createCurationNote(artworkId);
  }, [isOpen, artworkId, latest, createCurationNote]);

  return (
    <Drawer
      open={isOpen}
      onClose={closeCurationDraft}
      title={
        latest ? `큐레이션 노트 · v${latest.version}` : "큐레이션 노트"
      }
    >
      {isOpen && artwork && latest && (
        <CurationView
          key={latest.id}
          note={latest}
          artwork={artwork}
          onClose={closeCurationDraft}
        />
      )}
      {isOpen && artwork && !latest && (
        <BootstrapPlaceholder onClose={closeCurationDraft} />
      )}
    </Drawer>
  );
}

// ============================================================================
// View — branches by status
// ============================================================================

interface ViewProps {
  note: CurationNote;
  artwork: Artwork;
  onClose: () => void;
}

function CurationView(props: ViewProps) {
  if (props.note.status === "DRAFT") return <DraftCurationForm {...props} />;
  return <ReadOnlyCurationView {...props} />;
}

// ============================================================================
// DRAFT mode — editable, regenerate / approve
// ============================================================================

function DraftCurationForm({ note, artwork, onClose }: ViewProps) {
  const updateCurationNote = useArtworkStore((s) => s.updateCurationNote);
  const regenerateCurationDraft = useArtworkStore(
    (s) => s.regenerateCurationDraft
  );
  const approveCurationNote = useArtworkStore((s) => s.approveCurationNote);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const [headline, setHeadline] = React.useState(note.headline);
  const [subheadline, setSubheadline] = React.useState(note.subheadline);
  const [body, setBody] = React.useState(note.body);

  // Re-sync local state when the underlying note changes (e.g. after
  // regenerate). Compare to note id+updatedAt so we don't fight user edits.
  const lastSync = React.useRef(note.updatedAt);
  React.useEffect(() => {
    if (note.updatedAt !== lastSync.current) {
      setHeadline(note.headline);
      setSubheadline(note.subheadline);
      setBody(note.body);
      lastSync.current = note.updatedAt;
    }
  }, [note.headline, note.subheadline, note.body, note.updatedAt]);

  const isDirty =
    headline !== note.headline ||
    subheadline !== note.subheadline ||
    body !== note.body;

  const persistChanges = () => {
    if (!isDirty) return;
    updateCurationNote(note.id, { headline, subheadline, body });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistChanges();
  };

  const handleRegenerate = () => {
    if (isDirty) {
      const ok = window.confirm(
        "AI 초안을 다시 생성하면 현재 편집한 내용이 덮어쓰여집니다. 계속할까요?"
      );
      if (!ok) return;
    }
    regenerateCurationDraft(note.id);
  };

  const handleApprove = () => {
    if (isDirty) persistChanges();
    approveCurationNote(note.id);
    onClose();
  };

  const canApprove = hasPermission(currentRole, "curation.approve");
  const isEmpty =
    headline.trim().length === 0 || body.trim().length === 0;

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header note={note} artwork={artwork} />

        {/* DRAFT banner — AI-Human loop reminder (rule_5) */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
          <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
            초안 — AI 생성 후 담당자 검토 필요 (rule_5)
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
            본문 수정 후 “승인”을 누르면 편집이 잠기고, 이어서 LOCK 단계로 진행할
            수 있습니다.
          </p>
        </div>

        <Section label="헤드라인">
          <TextField
            label=""
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="작품을 한 문장으로 요약"
          />
        </Section>

        <Section label="부제">
          <TextField
            label=""
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            placeholder="작가 / 연도 / 매체 / 크기"
          />
        </Section>

        <Section label="본문">
          <Textarea
            label=""
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder="큐레이션 본문을 입력하세요"
          />
        </Section>

        <Divider />

        <Section label="문서 이력">
          <DocumentTrail note={note} />
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
        >
          AI 재생성
        </Button>
        <div className="flex items-center gap-2">
          {!canApprove && (
            <ButtonHint
              tone="permission"
              align="inline"
              text={permissionHint("curation.approve")}
            />
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handleApprove}
            disabled={!canApprove || isEmpty}
            aria-disabled={!canApprove || isEmpty}
          >
            승인
          </Button>
        </div>
      </footer>
    </form>
  );
}

// ============================================================================
// READONLY mode — APPROVED / LOCKED
// ============================================================================

function ReadOnlyCurationView({ note, artwork, onClose }: ViewProps) {
  const lockCurationNote = useArtworkStore((s) => s.lockCurationNote);
  const createCurationVersion = useArtworkStore(
    (s) => s.createCurationVersion
  );
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isApproved = note.status === "APPROVED";
  const isLocked = note.status === "LOCKED";

  const canLock = hasPermission(currentRole, "curation.lock");
  const canFork = hasPermission(currentRole, "curation.create_version");

  const handleLock = () => lockCurationNote(note.id);
  const handleNewVersion = () => createCurationVersion(note.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header note={note} artwork={artwork} />

        {/* Status banner */}
        {isApproved && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              승인 완료 — LOCK 대기
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              LOCK 후에는 immutable한 영구 문서가 되며, 수정은 새 버전 생성으로만
              가능합니다.
            </p>
          </div>
        )}
        {isLocked && (
          <div className="mb-5 px-3 py-3 rounded-md bg-surface-muted border border-line-strong flex items-start gap-2.5">
            <LockIcon />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink tracking-tightish font-semibold">
                이 문서는 잠겨 있습니다
              </p>
              <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
                v{note.version}는 영구 보관됩니다. 수정이 필요하면 아래 “새 버전
                생성”으로 v{note.version + 1} 초안을 만드세요.
              </p>
              {note.lockedAt && (
                <p className="text-[10.5px] text-ink-subtle mt-1 tracking-tightish">
                  잠금 시각 · {formatRelativeKR(note.lockedAt)}
                </p>
              )}
            </div>
          </div>
        )}

        <Section label="헤드라인">
          <TextField label="" value={note.headline} readOnly disabled />
        </Section>

        <Section label="부제">
          <TextField label="" value={note.subheadline} readOnly disabled />
        </Section>

        <Section label="본문">
          <Textarea
            label=""
            value={note.body}
            onChange={() => undefined}
            rows={14}
            readOnly
            disabled
          />
        </Section>

        <Divider />

        <Section label="문서 이력">
          <DocumentTrail note={note} />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>

        {isApproved && (
          <div className="flex items-center gap-2">
            {!canLock && (
              <ButtonHint
                tone="permission"
                align="inline"
                text={permissionHint("curation.lock")}
              />
            )}
            <Button
              type="button"
              variant="primary"
              onClick={handleLock}
              disabled={!canLock}
              aria-disabled={!canLock}
            >
              LOCK
            </Button>
          </div>
        )}
        {isLocked && (
          <div className="flex items-center gap-2">
            {!canFork && (
              <ButtonHint
                tone="permission"
                align="inline"
                text={permissionHint("curation.create_version")}
              />
            )}
            <Button
              type="button"
              variant="primary"
              onClick={handleNewVersion}
              disabled={!canFork}
              aria-disabled={!canFork}
            >
              새 버전 생성
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}

// ============================================================================
// Bootstrap placeholder — shown for the brief moment between drawer open and
// auto-create completing. In practice the create is synchronous so this
// rarely renders.
// ============================================================================

function BootstrapPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 px-6 py-5 flex items-center justify-center">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          AI 큐레이션 초안 생성 중…
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

function Header({ note, artwork }: { note: CurationNote; artwork: Artwork }) {
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

      {/* Status row */}
      <div className="mb-4 flex items-center justify-between">
        <StatusPill status={note.status} />
        <span className="text-[10.5px] text-ink-subtle font-mono tabular-nums tracking-tightish">
          v{note.version}
        </span>
      </div>
    </>
  );
}

// ============================================================================
// Document trail — version chain summary
// ============================================================================

function DocumentTrail({ note }: { note: CurationNote }) {
  const all = useArtworkStore(
    (s) => s.curationNotes[note.artworkId] ?? []
  );
  // Build chain from current note backward via parentCurationId.
  const chain: CurationNote[] = [];
  const byId = new Map(all.map((c) => [c.id, c]));
  let cur: CurationNote | undefined = note;
  while (cur) {
    chain.push(cur);
    cur = cur.parentCurationId ? byId.get(cur.parentCurationId) : undefined;
  }

  if (chain.length <= 1) {
    return (
      <p className="text-[11.5px] text-ink-subtle tracking-tightish">
        v1 — 첫 버전
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {chain.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between text-[11.5px] tracking-tightish"
        >
          <span className="text-ink-muted">
            v{c.version} · {CURATION_STATUS_LABEL[c.status]}
          </span>
          <span className="text-ink-subtle tabular-nums">
            {formatRelativeKR(c.updatedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ============================================================================
// Local primitives (mirrors ContractDetailDrawer 패턴)
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

function Divider() {
  return <div className="h-px w-full bg-line my-5" />;
}

function StatusPill({ status }: { status: CurationStatus }) {
  const color = CURATION_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{CURATION_STATUS_LABEL[status]}</span>
    </span>
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
