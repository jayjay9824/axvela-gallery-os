"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/artwork/StatusBadge";
import { useArtworkStore } from "@/store/useArtworkStore";

export function TransitionConfirmModal() {
  const transitionRequest = useArtworkStore((s) => s.transitionRequest);
  const closeTransition = useArtworkStore((s) => s.closeTransition);
  const transitionState = useArtworkStore((s) => s.transitionState);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = transitionRequest.kind === "open";

  const artwork =
    transitionRequest.kind === "open"
      ? artworks.find((a) => a.id === transitionRequest.artworkId)
      : undefined;

  const transition =
    transitionRequest.kind === "open" ? transitionRequest.transition : null;

  const ready = isOpen && artwork && transition;

  const handleConfirm = () => {
    if (!ready) return;
    transitionState(artwork.id, transition.to);
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeTransition}
      title="상태 전환 확인"
      footer={
        ready ? (
          <>
            <Button variant="ghost" size="md" onClick={closeTransition}>
              취소
            </Button>
            <Button variant="primary" size="md" onClick={handleConfirm}>
              {transition.primaryLabel}
            </Button>
          </>
        ) : null
      }
    >
      {ready ? (
        <div className="flex flex-col gap-5">
          {/* Artwork identity */}
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="h-10 w-10 rounded border border-line shrink-0"
              style={{ backgroundColor: artwork.thumbnailColor }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink truncate tracking-tight2">
                {artwork.title}
              </p>
              <p className="text-[11px] text-ink-subtle font-mono mt-0.5">
                {artwork.axid.code}
              </p>
            </div>
          </div>

          {/* Transition arrow */}
          <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-md bg-surface-muted border border-line">
            <StatusBadge state={transition.from} />
            <ArrowRight />
            <StatusBadge state={transition.to} />
          </div>

          {/* Description */}
          <div>
            <p className="text-[13px] font-medium text-ink tracking-tightish mb-1.5">
              {transition.primaryLabel}
            </p>
            <p className="text-[12.5px] text-ink-muted leading-relaxed tracking-tightish">
              {transition.description}
            </p>
          </div>

          {/* Effects */}
          {transition.effects.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mb-2">
                이 전환의 효과
              </p>
              <ul className="flex flex-col gap-1.5">
                {transition.effects.map((effect, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] text-ink tracking-tightish"
                  >
                    <span aria-hidden className="text-ink-subtle mt-0.5 shrink-0">
                      ·
                    </span>
                    <span>{effect}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footnote */}
          <p className="text-[10.5px] text-ink-subtle leading-relaxed tracking-tightish pt-1 border-t border-line">
            전환 즉시 Living Timeline에 기록되며 updatedAt이 갱신됩니다.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
