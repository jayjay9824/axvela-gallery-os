"use client";

import { StatusBadge } from "./StatusBadge";
import { cn, formatKRW, formatRelativeKR } from "@/lib/utils";
import {
  buildThumbnailUrl,
  THUMBNAIL_PRESETS,
} from "@/lib/image-thumbnail";
import type { Artwork } from "@/types/artwork";

interface ArtworkCardProps {
  artwork: Artwork;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function ArtworkCard({ artwork, selected, onSelect }: ArtworkCardProps) {
  return (
    <button
      onClick={() => onSelect(artwork.id)}
      className={cn(
        "group flex flex-col text-left rounded-lg overflow-hidden",
        "bg-surface border transition-all duration-150",
        selected
          ? "border-ink ring-1 ring-ink"
          : "border-line hover:border-line-strong"
      )}
    >
      {/* Thumbnail — image (if uploaded) or solid color placeholder.
          STEP 50.5: imageUrl 우선, 없으면 thumbnailColor swatch fallback.
          STEP 61: Card는 thumbnail URL convention 사용 (?w=400&q=75) — 향후
          Cloudflare Image Resizing / Vercel image transformations 활성 시 즉시
          작은 파일로 응답. data URL fallback은 그대로 원본 사용. */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        style={{ backgroundColor: artwork.thumbnailColor }}
      >
        {artwork.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={buildThumbnailUrl(artwork.imageUrl, THUMBNAIL_PRESETS.CARD)}
            alt={artwork.title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            loading="lazy"
            onError={(e) => {
              // 이미지 로딩 실패 시 placeholder fallback (브라우저가 broken
              // image icon 보이지 않도록 element 자체 hide).
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-tightish bg-white/85 text-ink backdrop-blur-sm">
            {artwork.axid.code}
          </span>
        </div>
        {artwork.inquiryCount > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/85 text-ink backdrop-blur-sm">
              <span className="h-1 w-1 rounded-full bg-status-inquiry" />
              문의 {artwork.inquiryCount}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-muted tracking-tightish truncate">
              {artwork.artist.name}
            </p>
            <h3 className="text-[14px] font-semibold text-ink tracking-tight2 truncate mt-0.5">
              {artwork.title}
            </h3>
          </div>
          <StatusBadge state={artwork.state} />
        </div>

        <div className="flex items-baseline justify-between gap-2 pt-1">
          <p className="text-[13px] text-ink font-medium tracking-tightish">
            {formatKRW(artwork.priceKRW)}
          </p>
          <p className="text-[11px] text-ink-subtle">
            {formatRelativeKR(artwork.updatedAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
