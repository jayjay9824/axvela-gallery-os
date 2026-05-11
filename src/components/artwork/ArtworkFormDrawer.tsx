"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ArtworkUploadHero } from "./ArtworkUploadHero";
import { ArtworkAIAssistButton } from "./ArtworkAIAssistButton";
import { TabBar, type TabDefinition } from "@/components/ui/TabBar";
import type { ImageUploadResult } from "@/types/image-storage-provider";
import { useArtworkStore, type ArtworkInput } from "@/store/useArtworkStore";
import { STATE_LABEL_KR, formatMoney, cn } from "@/lib/utils";
import { hasPermission, permissionHint } from "@/lib/rbac";
import {
  confidenceLabel,
  type PriceSuggestion,
} from "@/types/price-suggestion";
import type { Artwork, ArtworkState } from "@/types/artwork";
// Artwork UX Enhancement — Material chip preset + Size auto-conversion
import { ARTWORK_MATERIAL_PRESETS } from "@/lib/artwork-material-presets";
import {
  parseDimensionsString,
  formatDimensionsString,
  buildSizeReferenceLabel,
  koreanCanvasNoToDimensions,
  KOREAN_CANVAS_NO_LIST,
  type SizeUnit,
} from "@/lib/artwork-size-conversion";

const STATE_OPTIONS = (Object.keys(STATE_LABEL_KR) as ArtworkState[]).map(
  (s) => ({
    value: s,
    label: `${STATE_LABEL_KR[s]} · ${s}`,
  })
);

const DEFAULT_COLOR = "#A9B6C8";

// ── STEP 118 — 4-Tab structure (Phase 4 Stage 2) ────────────────────────────
// 사용자 spec 정조준 — Image-first hierarchy (STEP 116 합류) + 큐레이션 inline
// fields functional 진입 (STEP 119 합류). 9-tab over-scope 지양 — Artwork own
// data 만 담당하는 정직한 4-tab.
type TabKey = "image" | "artwork" | "curation" | "pricing";

const TAB_DEFINITIONS: readonly TabDefinition<TabKey>[] = [
  { key: "image", label: "이미지" },
  { key: "artwork", label: "작품 정보" },
  { key: "curation", label: "큐레이션" },
  { key: "pricing", label: "거래" },
];

// ============================================================================
// Drawer wrapper — reads editor state and mounts the form
// ============================================================================

export function ArtworkFormDrawer() {
  const editor = useArtworkStore((s) => s.editor);
  const closeEditor = useArtworkStore((s) => s.closeEditor);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = editor.kind !== "closed";
  const editingArtwork =
    editor.kind === "edit"
      ? artworks.find((a) => a.id === editor.id) ?? null
      : null;

  return (
    <Drawer
      open={isOpen}
      onClose={closeEditor}
      title={editor.kind === "edit" ? "작품 편집" : "작품 추가"}
    >
      {isOpen && (
        <ArtworkForm
          key={editingArtwork?.id ?? "new"}
          artwork={editingArtwork}
          onCancel={closeEditor}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface ArtworkFormProps {
  artwork: Artwork | null;
  onCancel: () => void;
}

type FieldErrors = Partial<
  Record<
    "title" | "artistName" | "year" | "medium" | "dimensions" | "priceKRW",
    string
  >
>;

function ArtworkForm({ artwork, onCancel }: ArtworkFormProps) {
  const createArtwork = useArtworkStore((s) => s.createArtwork);
  const updateArtwork = useArtworkStore((s) => s.updateArtwork);
  // STEP 117 — Artwork registration draft (Phase 4 §4.4 Draft-safe).
  // 신규 등록 모드 (artwork === null) 에서만 hydrate 사용. 편집 모드는 기존
  // record 가 진실 source — draft 와 무관.
  const artworkDraft = useArtworkStore((s) => s.artworkDraft);
  const saveArtworkDraft = useArtworkStore((s) => s.saveArtworkDraft);

  const isEdit = artwork !== null;

  // ── STEP 117 — Drafted input fallback (신규 등록 모드만) ──────────────────
  // mount 시점에 한 번 derive — Drawer 재open / isOpen toggle 시 ArtworkForm
  // 이 unmount → mount 되므로 매 진입마다 최신 draft 반영. 편집 모드는 항상
  // undefined (artwork prop 우선).
  const draftedInput = !isEdit ? artworkDraft?.data : undefined;

  // ---- Form state -----------------------------------------------------------
  const [title, setTitle] = React.useState(
    artwork?.title ?? draftedInput?.title ?? "",
  );
  const [artistName, setArtistName] = React.useState(
    artwork?.artist.name ?? draftedInput?.artistName ?? ""
  );
  const [artistNameEn, setArtistNameEn] = React.useState(
    artwork?.artist.nameEn ?? draftedInput?.artistNameEn ?? ""
  );
  const [year, setYear] = React.useState(
    artwork?.year?.toString() ??
      (draftedInput?.year ? draftedInput.year.toString() : "")
  );
  const [medium, setMedium] = React.useState(
    artwork?.medium ?? draftedInput?.medium ?? ""
  );
  // Artwork UX Enhancement — Structured size input (replaces single string)
  // **persistence compatibility**: 기존 `dimensions: string` 그대로 사용. 폼 진입 시
  // legacy 문자열을 best-effort parse, 저장 시 다시 직렬화. parse 실패 시
  // structured 입력은 빈 상태로 시작 (사용자가 새로 입력).
  // STEP 117 — draft 의 dimensions 도 동일 parse path 통과 (legacy 호환).
  const initialSize = React.useMemo(
    () =>
      parseDimensionsString(
        artwork?.dimensions ?? draftedInput?.dimensions ?? undefined
      ),
    [artwork?.dimensions, draftedInput?.dimensions]
  );
  const [sizeUnit, setSizeUnit] = React.useState<SizeUnit>(
    initialSize?.unit ?? "cm"
  );
  const [sizeWidth, setSizeWidth] = React.useState(
    initialSize?.width !== undefined ? String(initialSize.width) : ""
  );
  const [sizeHeight, setSizeHeight] = React.useState(
    initialSize?.height !== undefined ? String(initialSize.height) : ""
  );
  const [sizeDepth, setSizeDepth] = React.useState(
    initialSize?.depth !== undefined ? String(initialSize.depth) : ""
  );
  // 호수 입력 도우미 — 별도 dropdown, 적용 시 width/height에 반영 (cm 단위)
  const [canvasNoInput, setCanvasNoInput] = React.useState<string>("");
  const [priceRaw, setPriceRaw] = React.useState(
    artwork?.priceKRW?.toString() ??
      (draftedInput?.priceKRW ? draftedInput.priceKRW.toString() : "")
  );
  const [state, setState] = React.useState<ArtworkState>(
    artwork?.state ?? draftedInput?.state ?? "DRAFT"
  );
  const [thumbnailColor, setThumbnailColor] = React.useState(
    artwork?.thumbnailColor ?? draftedInput?.thumbnailColor ?? DEFAULT_COLOR
  );
  // STEP 50.5 — Optional artwork image. 부재 시 thumbnailColor 사용.
  // STEP 53 — single imageUrl state → bundled imageMeta (url + storageKey +
  // provider 메타). 기존 record(STEP 50.5에서 imageUrl만 있는 데이터) 편집 시
  // url만 hydrate되고 나머지 필드는 부재 — UI는 그대로 표시 (Local image fallback).
  // STEP 117 — 신규 등록 모드에서 draftedInput 의 6 image 필드도 동일 hydrate
  // 경로 사용 (편집 모드 artwork 와 동형).
  const [imageMeta, setImageMeta] = React.useState<
    ImageUploadResult | undefined
  >(() => {
    const src = artwork ?? draftedInput;
    if (!src?.imageUrl) return undefined;
    return {
      url: src.imageUrl,
      storageKey: src.imageStorageKey ?? "",
      providerId: src.imageProvider ?? "",
      // 기존 record는 isReal 알 수 없음 — false로 가정 (LocalPreview로 취급)
      isReal: false,
      size: src.imageSize ?? 0,
      mimeType: src.imageMimeType ?? "",
      uploadedAt: src.imageUploadedAt ?? "",
    };
  });

  // ── STEP 118 합류 — STEP 119 의 5 curation fields functional 진입 ────────
  // 모두 free-form string, 모두 optional. 편집 모드에서 기존 artwork 의 5 fields
  // hydrate, 새 작품 등록 시 빈 문자열 시작 (submit 시 빈 문자열 → undefined).
  // STEP 117 — 신규 등록 모드에서 draftedInput 의 5 fields 도 동일 hydrate.
  const [description, setDescription] = React.useState(
    artwork?.description ?? draftedInput?.description ?? ""
  );
  const [curationDraft, setCurationDraft] = React.useState(
    artwork?.curationDraft ?? draftedInput?.curationDraft ?? ""
  );
  const [exhibitionText, setExhibitionText] = React.useState(
    artwork?.exhibitionText ?? draftedInput?.exhibitionText ?? ""
  );
  const [artistNote, setArtistNote] = React.useState(
    artwork?.artistNote ?? draftedInput?.artistNote ?? ""
  );
  const [provenanceNote, setProvenanceNote] = React.useState(
    artwork?.provenanceNote ?? draftedInput?.provenanceNote ?? ""
  );

  // ── STEP 118 — 4-tab UI state ────────────────────────────────────────────
  // Tab 1 image / Tab 2 작품 정보 / Tab 3 큐레이션 / Tab 4 거래.
  // 새 작품 등록 시 image-first hierarchy 정합 (STEP 116) — Tab 1 시작.
  // STEP 126 Phase 2 — 4-panel conditional toggle 구조를 4-section 상시 mount
  // + sticky anchor navigation 으로 전환. activeTab state 는 보존 — Phase 3
  // 에서 scrollIntoView trigger, Phase 4 에서 IntersectionObserver setter 가
  // 사용. 현재(Phase 2)는 TabBar 클릭만 setter 호출 (panel 토글 효과는 없음).
  const [activeTab, setActiveTab] = React.useState<TabKey>("image");

  // STEP 126 Phase 2 — Section refs. Phase 3 scrollIntoView target / Phase 4
  // IntersectionObserver observe target.
  const imageSectionRef = React.useRef<HTMLElement | null>(null);
  const artworkSectionRef = React.useRef<HTMLElement | null>(null);
  const curationSectionRef = React.useRef<HTMLElement | null>(null);
  const pricingSectionRef = React.useRef<HTMLElement | null>(null);

  const [submitted, setSubmitted] = React.useState(false);

  // ---- Validation -----------------------------------------------------------
  const errors: FieldErrors = React.useMemo(() => {
    const e: FieldErrors = {};
    if (!title.trim()) e.title = "필수 항목입니다";
    if (!artistName.trim()) e.artistName = "필수 항목입니다";
    const yearNum = Number(year);
    const currentYear = new Date().getFullYear();
    if (
      !year ||
      isNaN(yearNum) ||
      yearNum < 1800 ||
      yearNum > currentYear + 1
    ) {
      e.year = `1800–${currentYear + 1} 사이의 연도를 입력하세요`;
    }
    if (!medium.trim()) e.medium = "필수 항목입니다";
    // Artwork UX Enhancement — 구조화 크기 검증 (legacy single string 대체)
    const widthNum = Number.parseFloat(sizeWidth);
    const heightNum = Number.parseFloat(sizeHeight);
    if (
      !sizeWidth.trim() ||
      !sizeHeight.trim() ||
      !Number.isFinite(widthNum) ||
      !Number.isFinite(heightNum) ||
      widthNum <= 0 ||
      heightNum <= 0
    ) {
      e.dimensions = "가로 / 세로를 0보다 큰 숫자로 입력하세요";
    }
    const priceNum = Number(priceRaw);
    if (!priceRaw || isNaN(priceNum) || priceNum <= 0) {
      e.priceKRW = "0보다 큰 금액을 입력하세요";
    }
    return e;
  }, [
    title,
    artistName,
    year,
    medium,
    sizeWidth,
    sizeHeight,
    priceRaw,
  ]);

  const isValid = Object.keys(errors).length === 0;

  // ---- Formatted values -----------------------------------------------------
  const priceDisplay = priceRaw
    ? Number(priceRaw).toLocaleString("ko-KR")
    : "";

  const handlePriceChange = (val: string) => {
    setPriceRaw(val.replace(/[^\d]/g, ""));
  };

  const handleYearChange = (val: string) => {
    setYear(val.replace(/[^\d]/g, "").slice(0, 4));
  };

  // ---- Submit ---------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isValid) return;

    const input: ArtworkInput = {
      title: title.trim(),
      artistName: artistName.trim(),
      artistNameEn: artistNameEn.trim() || undefined,
      year: Number(year),
      medium: medium.trim(),
      // Artwork UX Enhancement — structured fields → legacy "<W> × <H> [× <D>] <unit>" 직렬화
      // 기존 데이터 표기와 호환 ("162.0 × 130.3 cm")
      dimensions: formatDimensionsString({
        width: Number.parseFloat(sizeWidth),
        height: Number.parseFloat(sizeHeight),
        depth: sizeDepth.trim() ? Number.parseFloat(sizeDepth) : undefined,
        unit: sizeUnit,
      }),
      priceKRW: Number(priceRaw),
      state,
      thumbnailColor,
      // STEP 53 — imageMeta(ImageUploadResult)을 5 옵셔널 필드로 펼침.
      // imageMeta가 undefined면 모든 image 필드도 undefined → 이미지 제거.
      imageUrl: imageMeta?.url,
      imageStorageKey: imageMeta?.storageKey || undefined,
      imageProvider: imageMeta?.providerId || undefined,
      imageMimeType: imageMeta?.mimeType || undefined,
      imageSize: imageMeta?.size || undefined,
      imageUploadedAt: imageMeta?.uploadedAt || undefined,
      // STEP 118 합류 — STEP 119 5 curation fields functional 진입.
      // 빈 문자열 / whitespace-only → undefined (compact projection,
      // STEP 119 의 collectCurationData helper 와 동일 정책).
      description: description.trim() || undefined,
      curationDraft: curationDraft.trim() || undefined,
      exhibitionText: exhibitionText.trim() || undefined,
      artistNote: artistNote.trim() || undefined,
      provenanceNote: provenanceNote.trim() || undefined,
    };

    if (isEdit && artwork) {
      updateArtwork(artwork.id, input);
    } else {
      createArtwork(input);
    }
    onCancel();
  };

  // ---- STEP 117 — 임시 저장 (Phase 4 §4.4 Draft-safe) ---------------------
  // 신규 등록 모드 (isEdit === false) 에서만 의미 있음. 사용자의 *명시적*
  // 클릭 시점 form snapshot 그대로 보존 — validation 미통과 데이터도 보존.
  // 사용자 의도 우선 (빈 title 도 기록). 편집 모드에서는 활성되지 않음 (UI
  // 측 button render 자체가 isEdit === false 조건부).
  const handleSaveDraft = () => {
    // 부분 입력 방어 — sizeWidth/Height 가 비어 있거나 NaN 이면 빈 문자열
    // dimensions 보존. width/height 둘 다 valid 숫자일 때만 직렬화.
    const widthNum = Number.parseFloat(sizeWidth);
    const heightNum = Number.parseFloat(sizeHeight);
    const depthRaw = sizeDepth.trim()
      ? Number.parseFloat(sizeDepth)
      : undefined;
    const depthValid =
      depthRaw !== undefined && Number.isFinite(depthRaw) ? depthRaw : undefined;
    const dimensions =
      Number.isFinite(widthNum) && Number.isFinite(heightNum)
        ? formatDimensionsString({
            width: widthNum,
            height: heightNum,
            depth: depthValid,
            unit: sizeUnit,
          })
        : "";

    // priceKRW / year — Number conversion 실패 시 0 fallback (ArtworkInput 의
    // type 충족 위한 minimum). 사용자가 차후 form 재진입 시 빈 칸으로 표시될
    // 수 있도록 priceRaw / year 의 *문자열* 도 같이 보존되면 더 정확하지만,
    // ArtworkInput shape 그대로 유지 정책 — 0 이면 priceKRW.toString() 이
    // "0" 이 되어 form 재진입 시 "0" 표시 (사용자가 빈 칸 의도였다면 직접
    // clear). 이는 v1 trade-off — backward compat 우선.
    const priceNum = Number(priceRaw);
    const yearNum = Number(year);

    const input: ArtworkInput = {
      title: title.trim(),
      artistName: artistName.trim(),
      artistNameEn: artistNameEn.trim() || undefined,
      year: Number.isFinite(yearNum) ? yearNum : 0,
      medium: medium.trim(),
      dimensions,
      priceKRW: Number.isFinite(priceNum) ? priceNum : 0,
      state,
      thumbnailColor,
      imageUrl: imageMeta?.url,
      imageStorageKey: imageMeta?.storageKey || undefined,
      imageProvider: imageMeta?.providerId || undefined,
      imageMimeType: imageMeta?.mimeType || undefined,
      imageSize: imageMeta?.size || undefined,
      imageUploadedAt: imageMeta?.uploadedAt || undefined,
      description: description.trim() || undefined,
      curationDraft: curationDraft.trim() || undefined,
      exhibitionText: exhibitionText.trim() || undefined,
      artistNote: artistNote.trim() || undefined,
      provenanceNote: provenanceNote.trim() || undefined,
    };

    saveArtworkDraft(input);
    onCancel();
  };

  const showError = (key: keyof FieldErrors) =>
    submitted ? errors[key] : undefined;

  // ---- Render ---------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {isEdit && artwork && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              AXID
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 font-mono tracking-tightish">
              {artwork.axid.code}
            </p>
          </div>
        )}

        {/* STEP 118 — 4-Tab Registration Structure (Phase 4 Stage 2).
            사용자 spec 정조준 — Tab 1 이미지 (STEP 116 Hero 합류) / Tab 2 작품
            정보 (기본 정보 + 작품 정보 통합) / Tab 3 큐레이션 (STEP 119 5 inline
            fields functional 진입) / Tab 4 거래 (가격/상태). 9-tab over-scope
            지양 — Artwork own data 만 담당하는 정직한 4-tab. */}
        <TabBar
          tabs={TAB_DEFINITIONS}
          activeKey={activeTab}
          onChange={setActiveTab}
          ariaLabel="작품 등록 단계"
          className="mb-5"
        />

        {/* STEP 126 Phase 2 — 4 section 동시 mount. 기존 4-panel 토글
            (activeTab === "x" && ...) 제거. activeTab state 는 보존 (Phase 3
            scrollIntoView / Phase 4 IntersectionObserver 합류 예정).
            gap-8 inter-section spacing — 사용자 spec UX 구조 보존 (전체
            workflow 가 하나의 document). */}
        <div className="flex flex-col gap-8">
          {/* ─── Section: 이미지 (STEP 116 Hero 합류, 상시 mount) ──────── */}
          <section id="form-section-image" ref={imageSectionRef}>
            {/* STEP 116 — Image-First Registration Hero. */}
            <ArtworkUploadHero
              imageUrl={imageMeta?.url}
              onImageChange={setImageMeta}
              fallbackColor={thumbnailColor}
              onColorChange={setThumbnailColor}
              imageProvider={imageMeta?.providerId || undefined}
              imageWasFallback={imageMeta?.wasFallback}
              imageSize={imageMeta?.size}
            />

            {/* STEP 61 — 외부 storage 영구 제거 secondary action. */}
            {isEdit &&
              artwork &&
              imageMeta?.providerId === "vercel_blob" &&
              imageMeta.url === artwork.imageUrl && (
                <div className="mt-5">
                  <RemoveFromStorageAction
                    artworkId={artwork.id}
                    onRemoved={() => setImageMeta(undefined)}
                  />
                </div>
              )}
          </section>

          {/* ─── Section: 작품 정보 (제목 / 작가 / 연도 / 매체 / 치수) ─── */}
          {/* STEP 126 Phase 2 — title 의 autoFocus 제거: 4 section 상시 mount
              상태에서 autoFocus 가 Drawer open 직후 title 로 강제 포커스 →
              브라우저 자동 scroll 로 image-first hierarchy (STEP 116) 무력화.
              사용자는 Hero 부터 시각 진입 후 의도적으로 title 영역 도달. */}
          <section id="form-section-artwork" ref={artworkSectionRef}>
            <FormSection label="기본 정보">
              <TextField
                label="제목"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={showError("title")}
                placeholder="예: 무제, 푸른 정원"
              />
              <TextField
                label="작가"
                required
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                error={showError("artistName")}
                placeholder="예: 김지은"
              />
              <TextField
                label="작가 영문명"
                value={artistNameEn}
                onChange={(e) => setArtistNameEn(e.target.value)}
                placeholder="예: Jieun Kim"
                hint="선택 입력"
              />
            </FormSection>

            <Divider />

            <FormSection label="작품 정보">
              <TextField
                label="제작 연도"
                required
                inputMode="numeric"
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                error={showError("year")}
                placeholder="2024"
                maxLength={4}
              />
              <TextField
                label="작품 재료(Material)"
                required
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                error={showError("medium")}
                placeholder="예: Oil on Canvas"
                hint="자유 입력 가능 — 아래 chip은 자주 쓰이는 재료 가이드"
              />
              {/* STEP 94 — AI 보조 (artwork_metadata insertion point #1) */}
              <ArtworkAIAssistButton
                rawMaterial={medium}
                rawTitle={title}
                onApplyMaterial={setMedium}
                onApplyTitle={setTitle}
              />
              {/* Artwork UX Enhancement — Material preset chip strip (자유 입력 보조) */}
              <MaterialPresetChips currentValue={medium} onPick={setMedium} />
              {/* Artwork UX Enhancement — 구조화 크기 입력 + 자동 환산 reference */}
              <SizeInputRow
                unit={sizeUnit}
                onUnitChange={setSizeUnit}
                width={sizeWidth}
                onWidthChange={setSizeWidth}
                height={sizeHeight}
                onHeightChange={setSizeHeight}
                depth={sizeDepth}
                onDepthChange={setSizeDepth}
                error={showError("dimensions")}
              />
              {/* 호수 입력 도우미 — 사용자가 호수 선택 시 width/height에 자동 반영 (cm) */}
              <CanvasNoHelper
                value={canvasNoInput}
                onChange={setCanvasNoInput}
                onApply={(no) => {
                  const ref = koreanCanvasNoToDimensions(no);
                  if (!ref) return;
                  setSizeUnit("cm");
                  setSizeWidth(String(ref.widthCm));
                  setSizeHeight(String(ref.heightCm));
                }}
              />
            </FormSection>
          </section>

          {/* ─── Section: 큐레이션 (STEP 119 5 inline fields functional) ─── */}
          <section id="form-section-curation" ref={curationSectionRef}>
            <FormSection label="큐레이션 / 전시 / 기록">
              {/* STEP 118 합류 — STEP 119 5 inline fields functional 진입.
                  모두 free-form, optional. CurationNote (formal entity) 와는
                  별도 dimension — Artwork master record 직접 inline. */}
              <CurationTextField
                label="작품 설명"
                hint="자유 텍스트 — 매체/치수 외 자유 해설"
                value={description}
                onChange={setDescription}
                placeholder="예: 이 작품은 2024년 작가의 베니스 비엔날레 출품 시리즈 중 하나로..."
                rows={3}
              />
              <CurationTextField
                label="큐레이션 초안"
                hint="CurationNote 만들기 전 quick note 또는 보조 메모"
                value={curationDraft}
                onChange={setCurationDraft}
                placeholder="간단한 큐레이션 메모"
                rows={3}
              />
              <CurationTextField
                label="전시 설명"
                hint="전시 컨텍스트 / 전시 기획서 텍스트"
                value={exhibitionText}
                onChange={setExhibitionText}
                placeholder="예: 2024 베니스 비엔날레 한국관 출품작"
                rows={3}
              />
              <CurationTextField
                label="작가 메모 (Artist Note)"
                hint="작가 본인의 work statement"
                value={artistNote}
                onChange={setArtistNote}
                placeholder="작가가 직접 남긴 작품 노트"
                rows={3}
              />
              <CurationTextField
                label="Provenance / 소장 이력"
                hint="출처 / 이전 소유자 / 전시 이력 메모"
                value={provenanceNote}
                onChange={setProvenanceNote}
                placeholder="예: 1990년 작가 직접 매입 → 2010년 OOO 갤러리 → 현재"
                rows={3}
              />
            </FormSection>
          </section>

          {/* ─── Section: 거래 (가격 / 상태) ─────────────────────────── */}
          <section id="form-section-pricing" ref={pricingSectionRef}>
            <FormSection label="거래">
              <TextField
                label="가격"
                required
                inputMode="numeric"
                value={priceDisplay}
                onChange={(e) => handlePriceChange(e.target.value)}
                error={showError("priceKRW")}
                placeholder="0"
                suffix="KRW"
              />
              {/* STEP 18 — AXVELA AI Price Suggestion (rule_18 (c)) */}
              {isEdit && artwork && (
                <PriceSuggestionPanel
                  artwork={artwork}
                  onApplyMid={(midValue) => setPriceRaw(midValue.toString())}
                />
              )}
              <Select
                label="상태"
                required
                value={state}
                onChange={(e) => setState(e.target.value as ArtworkState)}
                options={STATE_OPTIONS}
                hint={
                  isEdit
                    ? "상태 전환 시 Living Timeline에 기록됩니다"
                    : "신규 작품은 보통 초안(DRAFT)에서 시작합니다"
                }
              />
            </FormSection>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        {/* STEP 117 — 임시 저장 버튼 (신규 등록 모드만). Phase 4 §4.4 Draft-safe
            정착 — 사용자가 4-tab form 진행 중 일시 중단해도 입력 손실 0건.
            편집 모드에서는 미렌더 (편집은 직접 update 의미 — draft 무관). */}
        {!isEdit && (
          <Button type="button" variant="ghost" onClick={handleSaveDraft}>
            임시 저장
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={submitted && !isValid}
        >
          {isEdit ? "변경 저장" : "작품 추가"}
        </Button>
      </footer>
    </form>
  );
}

// ============================================================================
// Internal layout helpers
// ============================================================================

function FormSection({
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

// ── STEP 118 — CurationTextField helper (Tab 3 Curation surface) ────────────
// STEP 119 5 inline fields functional 입력 surface. multi-line textarea 기반,
// rule_16 minimal 톤 (점선/그림자 0, 큰 padding, 상태 색상만). free-form input
// — validation 미진입 (v1 free-form).
function CurationTextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-ink tracking-tight">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          // Layout — 큰 padding, 한국어 가독성 우선
          "w-full px-3 py-2.5 text-[13px] leading-relaxed",
          "bg-surface border border-line rounded-md",
          "placeholder:text-ink-subtle/60",
          // Focus state — minimal ring
          "outline-none focus:border-ink/40 focus:ring-1 focus:ring-ink/15",
          // Disable resize — 일관 height
          "resize-y min-h-[68px]",
          "transition-colors duration-150",
        )}
      />
      {hint && (
        <p className="text-[10.5px] text-ink-subtle/80 leading-snug">{hint}</p>
      )}
    </div>
  );
}

// ============================================================================
// PriceSuggestionPanel — STEP 18 (rule_18 (c) AI Price Suggestion)
//
// ArtworkFormDrawer 안에서만 mount. 가격 입력 필드 아래 인라인 표시.
//
// 주요 흐름:
//   1. 사용자가 "AXVELA AI 가격 제안" 버튼 클릭
//   2. store.generatePriceSuggestionForArtwork(artworkId) 호출
//      — 새 PriceSuggestion record + "AI 가격 제안 생성" timeline 이벤트
//      — artwork.priceKRW 무변경
//   3. 생성된 suggestion이 카드로 표시 (Low / Mid / High / confidence / rationale)
//   4. "Mid 가격 적용" 버튼 클릭 시:
//      - store.applyPriceSuggestion(artworkId, suggestionId) 호출
//        ("AI 가격 제안 적용" timeline + appliedAt 마킹)
//      - onApplyMid(midValue) 콜백 → 폼의 priceRaw state만 업데이트
//      - artwork.priceKRW는 여전히 무변경, 폼 저장 시 일반 흐름이 갱신
//
// rule_5 AI-Human Loop 명시: AI 초안 → 담당자 승인(클릭) → 폼 반영 → 저장.
// ============================================================================

interface PriceSuggestionPanelProps {
  artwork: Artwork;
  onApplyMid: (midValue: number) => void;
}

function PriceSuggestionPanel({
  artwork,
  onApplyMid,
}: PriceSuggestionPanelProps) {
  const currentRole = useArtworkStore((s) => s.currentRole);
  const priceSuggestions = useArtworkStore((s) => s.priceSuggestions);
  const generateForArtwork = useArtworkStore(
    (s) => s.generatePriceSuggestionForArtwork
  );
  const applySuggestion = useArtworkStore((s) => s.applyPriceSuggestion);

  // Latest suggestion이 있으면 표시 (drawer 재오픈 시에도 유지됨)
  const list = priceSuggestions[artwork.id] ?? [];
  const latest: PriceSuggestion | null = list[0] ?? null;

  const canGenerate = hasPermission(currentRole, "price_suggestion.generate");
  const canApply = hasPermission(currentRole, "price_suggestion.apply");

  const handleGenerate = () => {
    if (!canGenerate) return;
    generateForArtwork(artwork.id);
  };

  const handleApplyMid = () => {
    if (!latest || !canApply) return;
    applySuggestion(artwork.id, latest.id);
    onApplyMid(latest.suggestedMid);
  };

  return (
    <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3 flex flex-col gap-3">
      {/* Header: title + generate/regenerate button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold tracking-tightish text-ink">
            참고 가격 신호
          </span>
          <span className="text-[10.5px] italic text-ink-subtle tracking-tightish">
            AXVELA AI 운영 참고 — 담당자 검토 필요
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          {latest ? "다시 생성" : "참고 신호 생성"}
        </Button>
      </div>

      {!canGenerate && (
        <p className="text-[10.5px] text-ink-subtle italic tracking-tightish">
          {permissionHint("price_suggestion.generate")}
        </p>
      )}

      {/* Suggestion card (if generated) */}
      {latest && <SuggestionCard suggestion={latest} />}

      {/* Apply button + disclaimer */}
      {latest && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleApplyMid}
            disabled={!canApply}
          >
            Mid 가격 적용 — {formatMoney(latest.suggestedMid, latest.currency)}
          </Button>
          {!canApply && (
            <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
              {permissionHint("price_suggestion.apply")}
            </span>
          )}
          <p className="text-[10.5px] text-ink-subtle leading-relaxed tracking-tightish">
            적용 시 폼의 가격 입력만 갱신됩니다. 실제 가격 변경은 폼 저장 후
            반영됩니다.
          </p>
        </div>
      )}

      {/* Always-visible disclaimer line */}
      <p
        className={cn(
          "text-[10.5px] text-ink-subtle leading-relaxed tracking-tightish",
          latest ? "" : "border-t border-line pt-2"
        )}
      >
        외부 시장 데이터가 아닌 내부 거래 기록 기반 v1 제안입니다. 최종 가격은
        갤러리 담당자가 결정합니다.
      </p>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: PriceSuggestion }) {
  const { suggestedLow, suggestedMid, suggestedHigh, currency, confidence, rationale, appliedAt, sourceRefs, fxSnapshots } =
    suggestion;
  const confLabel = confidenceLabel(confidence);
  const confPct = Math.round(confidence * 100);

  // STEP 29 — sourceRefs에서 external market signal 존재 여부 검출
  const hasExternalRef = sourceRefs.some(
    (ref) => ref.kind === "market_signal" && ref.isExternal === true
  );

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-col gap-2.5">
      {/* Range row — Low / Mid / High */}
      <div className="grid grid-cols-3 gap-2">
        <RangeCell label="Low" amount={suggestedLow} currency={currency} muted />
        <RangeCell label="Mid" amount={suggestedMid} currency={currency} highlighted />
        <RangeCell label="High" amount={suggestedHigh} currency={currency} muted />
      </div>

      {/* Confidence + external badge + applied marker */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
            신뢰도
          </span>
          <span className="text-[11px] tabular-nums tracking-tightish text-ink-muted">
            {confPct}% · {confLabel}
          </span>
          {/* STEP 29 — External reference 포함 안내 (사용자 spec) */}
          {hasExternalRef && (
            <span
              className="text-[9.5px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded border border-line text-ink-subtle bg-surface-muted"
              title="옥션 / 마켓플레이스 reference 신호가 참고 신호에 포함되었습니다"
            >
              EXT REF
            </span>
          )}
        </div>
        {appliedAt && (
          <span className="text-[10px] tracking-tightish text-status-deal font-medium">
            ✓ 폼에 적용됨
          </span>
        )}
      </div>

      {/* Rationale list */}
      {rationale.length > 0 && (
        <ul className="flex flex-col gap-0.5 pt-1.5 border-t border-line">
          {rationale.map((line, idx) => (
            <li
              key={idx}
              className="text-[10.5px] text-ink-muted leading-relaxed tracking-tightish flex gap-1.5"
            >
              <span className="text-ink-subtle shrink-0" aria-hidden>
                ·
              </span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ul>
      )}

      {/* STEP 31 — FX snapshot footer (외부 신호 사용 시에만) */}
      {fxSnapshots && fxSnapshots.length > 0 && (
        <div className="flex flex-col gap-0.5 pt-1.5 border-t border-line">
          {fxSnapshots.map((fx) => (
            <div
              key={fx.id}
              className="flex items-center gap-1.5 text-[9.5px] tracking-tightish text-ink-subtle"
              title={`Provider: ${fx.provider}${fx.sourceNote ? ` — ${fx.sourceNote}` : ""}`}
            >
              <span className="font-semibold uppercase tracking-[0.08em]">FX</span>
              <span className="tabular-nums">
                {fx.baseCurrency}→{fx.quoteCurrency} {fx.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </span>
              <span aria-hidden>·</span>
              <span>{fx.provider}</span>
              <span aria-hidden>·</span>
              <span>{fx.fetchedAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RangeCellProps {
  label: string;
  amount: number;
  currency: PriceSuggestion["currency"];
  muted?: boolean;
  highlighted?: boolean;
}

function RangeCell({ label, amount, currency, muted, highlighted }: RangeCellProps) {
  return (
    <div
      className={cn(
        "rounded px-2 py-1.5 flex flex-col gap-0.5",
        highlighted
          ? "bg-surface-muted border border-line-strong"
          : muted
            ? "bg-surface border border-line"
            : ""
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold tracking-[0.14em] uppercase",
          highlighted ? "text-ink" : "text-ink-subtle"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[12px] tabular-nums tracking-tightish",
          highlighted ? "text-ink font-semibold" : "text-ink-muted"
        )}
      >
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

// ============================================================================
// STEP 61 — RemoveFromStorageAction
//
// 외부 storage(Vercel Blob)에서 이미지 영구 제거 secondary action. confirm dialog
// 거친 후 store deleteArtworkImage 호출 → 외부 host 측 제거 요청 (failure silent)
// + record 5 image 필드 갱신 + timeline event. 호출 후 form의 imageMeta도
// undefined로 set해 즉시 시각 반영.
//
// **secondary action UI 정책 (사용자 spec)**:
//   - text-only link (button 변형 ghost)
//   - red 톤 절제 — destructive action임을 명시하되 색상 강조 최소화
//   - confirm + 로딩 상태 표시
// ============================================================================

function RemoveFromStorageAction({
  artworkId,
  onRemoved,
}: {
  artworkId: string;
  onRemoved: () => void;
}) {
  const deleteArtworkImage = useArtworkStore((s) => s.deleteArtworkImage);
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (busy) return;
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      [
        "외부 저장소에서 이미지 제거 요청을 보냅니다.",
        "",
        "- 작품 record의 image 메타데이터가 함께 비워집니다.",
        "- 외부 호스트 측 처리 결과는 idempotent — 이미 부재해도 정상 처리됩니다.",
        "- 외부 호출 실패 시 record는 갱신되며 외부 잔존 이미지는 운영 참고 helper로 일괄 정리 가능합니다.",
        "",
        "계속하시겠습니까?",
      ].join("\n")
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteArtworkImage(artworkId);
      onRemoved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-disabled={busy || undefined}
      className={cn(
        "self-start text-[10.5px] tracking-tightish underline-offset-2",
        "transition-colors",
        busy
          ? "text-ink-subtle cursor-not-allowed opacity-60"
          : "text-status-deal/80 hover:text-status-deal hover:underline"
      )}
      title="외부 저장소에서 이미지 제거 요청 + record 갱신"
    >
      {busy ? "제거 요청 중..." : "외부 저장소에서 제거 요청"}
    </button>
  );
}

// ============================================================================
// Artwork UX Enhancement — Material preset chip strip
//
// 자유 입력 medium 필드의 보조 가이드. preset chip 클릭 시 input value를 그대로
// chip의 라벨로 교체. enum 강제 0건 — 사용자는 chip 외 임의 문자열 자유 입력.
// 현재 입력값과 일치하는 chip은 활성 톤 (subtle ring) — 사용자가 어떤 preset을
// 사용 중인지 시각적 피드백.
// ============================================================================

function MaterialPresetChips({
  currentValue,
  onPick,
}: {
  currentValue: string;
  onPick: (next: string) => void;
}) {
  const trimmed = currentValue.trim().toLowerCase();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold mr-1">
        자주 쓰이는 재료
      </span>
      {ARTWORK_MATERIAL_PRESETS.map((preset) => {
        const isActive = trimmed === preset.toLowerCase();
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onPick(preset)}
            aria-pressed={isActive}
            className={cn(
              "h-6 px-2 rounded-full border text-[10px] tracking-tightish transition-colors",
              isActive
                ? "bg-ink/5 border-line-strong text-ink"
                : "bg-surface border-line text-ink-subtle hover:border-line-strong hover:text-ink"
            )}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Artwork UX Enhancement — 구조화 크기 입력 + 자동 환산 reference
//
// 단일 텍스트 필드 → 가로 / 세로 / (옵션) 깊이 + 단위 토글 구조. 입력 변경 시
// 반대 단위 + 호수 reference label 자동 갱신.
//
// **persistence**: 본 컴포넌트는 입력만 — 직렬화는 form submit 시 호출자가
// `formatDimensionsString(...)` 호출하여 legacy 문자열로 변환.
//
// **rule_16 minimalism**: text-first / 작은 typography / chart 없음 / 그림자 0.
// ============================================================================

function SizeInputRow({
  unit,
  onUnitChange,
  width,
  onWidthChange,
  height,
  onHeightChange,
  depth,
  onDepthChange,
  error,
}: {
  unit: SizeUnit;
  onUnitChange: (next: SizeUnit) => void;
  width: string;
  onWidthChange: (next: string) => void;
  height: string;
  onHeightChange: (next: string) => void;
  depth: string;
  onDepthChange: (next: string) => void;
  error?: string;
}) {
  // 자동 환산 reference label — 두 값 모두 유효할 때만 표시
  const wNum = Number.parseFloat(width);
  const hNum = Number.parseFloat(height);
  const dNum = depth.trim() ? Number.parseFloat(depth) : undefined;
  const referenceLabel =
    Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0
      ? buildSizeReferenceLabel({
          width: wNum,
          height: hNum,
          depth: dNum,
          unit,
        })
      : "";

  const numericGuard = (val: string) => val.replace(/[^\d.]/g, "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] tracking-[0.08em] uppercase text-ink-subtle font-semibold">
          크기 <span className="text-status-deal">*</span>
        </label>
        {/* 단위 토글 */}
        <div
          className="inline-flex items-center rounded-md border border-line bg-surface overflow-hidden shrink-0"
          role="group"
          aria-label="단위 선택"
        >
          <SizeUnitButton
            label="cm"
            active={unit === "cm"}
            onClick={() => onUnitChange("cm")}
          />
          <SizeUnitButton
            label="inch"
            active={unit === "inch"}
            onClick={() => onUnitChange("inch")}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <SizeNumberInput
          value={width}
          onChange={(v) => onWidthChange(numericGuard(v))}
          placeholder="가로"
          aria-label={`가로 (${unit})`}
        />
        <span className="text-ink-subtle text-[12px]">×</span>
        <SizeNumberInput
          value={height}
          onChange={(v) => onHeightChange(numericGuard(v))}
          placeholder="세로"
          aria-label={`세로 (${unit})`}
        />
        <span className="text-ink-subtle text-[12px]">×</span>
        <SizeNumberInput
          value={depth}
          onChange={(v) => onDepthChange(numericGuard(v))}
          placeholder="깊이 (선택)"
          aria-label={`깊이 (${unit})`}
        />
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {unit}
        </span>
      </div>
      {referenceLabel && (
        <span className="text-[9.5px] text-ink-subtle italic tracking-tightish leading-snug">
          자동 환산 참고: {referenceLabel}
        </span>
      )}
      {error && (
        <span className="text-[10px] text-status-deal tracking-tightish">
          {error}
        </span>
      )}
    </div>
  );
}

function SizeUnitButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-6 px-2.5 text-[10px] tracking-tightish transition-colors",
        active
          ? "bg-ink text-canvas font-medium"
          : "bg-surface text-ink-subtle hover:bg-surface-muted"
      )}
    >
      {label}
    </button>
  );
}

function SizeNumberInput({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  "aria-label"?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-[88px] h-8 px-2 rounded-md text-[11.5px] tracking-tightish tabular-nums",
        "bg-surface text-ink border border-line",
        "focus:outline-none focus:border-line-strong",
        "placeholder:text-ink-subtle/70"
      )}
      {...rest}
    />
  );
}

// ============================================================================
// Artwork UX Enhancement — 한국 호수 입력 도우미
//
// dropdown 선택 후 [적용] 클릭 시 width/height에 cm 단위 대표값 자동 반영.
// 호수는 *F형 기준 참고값* 표기 일관 — 운영 참고 only, 공인 규격 / 법적
// 효력과 무관 (rule_16 + 사용자 spec language policy).
// ============================================================================

function CanvasNoHelper({
  value,
  onChange,
  onApply,
}: {
  value: string;
  onChange: (next: string) => void;
  onApply: (no: number) => void;
}) {
  const handleApply = () => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    onApply(n);
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
        호수 입력 도우미
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 pl-2.5 pr-7 rounded-md text-[10.5px] tracking-tightish tabular-nums",
          "bg-surface text-ink border border-line",
          "focus:outline-none focus:border-line-strong",
          "appearance-none cursor-pointer transition-colors",
          "[background-image:url('data:image/svg+xml;utf8,<svg fill=%22none%22 stroke=%22%236B6B6B%22 stroke-width=%221.5%22 viewBox=%220 0 24 24%22 xmlns=%22http://www.w3.org/2000/svg%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22 /></svg>')] [background-repeat:no-repeat] [background-position:right_0.5rem_center] [background-size:0.875rem_0.875rem]"
        )}
        aria-label="한국 호수 (F형 기준)"
      >
        <option value="">호수 선택…</option>
        {KOREAN_CANVAS_NO_LIST.map((no) => (
          <option key={no} value={no}>
            {no}호
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleApply}
        disabled={!value}
        aria-disabled={!value || undefined}
        className={cn(
          "h-7 px-2.5 rounded-md text-[10.5px] tracking-tightish border transition-colors",
          !value
            ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
            : "bg-surface text-ink border-line hover:bg-surface-muted hover:border-line-strong"
        )}
      >
        적용
      </button>
      <span className="text-[9.5px] text-ink-subtle italic tracking-tightish">
        F형 기준 참고값 — 운영 참고용
      </span>
    </div>
  );
}
