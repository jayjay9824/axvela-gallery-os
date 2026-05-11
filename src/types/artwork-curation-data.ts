// ============================================================================
// AXVELA — Artwork Curation Data Foundation (STEP 119)
// ============================================================================
//
// **본 모듈의 정체**:
//   Artwork master record 에 *직접 연결되는* 큐레이션 / 전시 / 작가 / provenance
//   inline data 의 type foundation. 사용자 spec STEP 119 (#9 Curation as
//   Connected Data) 정확 매칭.
//
//   사용자 spec 인용:
//     "큐레이션은 거래 후 별도 생성이 아닙니다. Artwork 생성 시점부터:
//      - 작품 설명 / 큐레이션 초안 / 전시 설명 / 작가 메모 / provenance note 를
//      연결 가능하게 해주세요. 즉: Artwork Master Record 내부의 connected data로
//      구조화."
//
// **CurationNote (별도 entity) 와의 dimension 분리**:
//   - `CurationNote` (src/types/curation.ts) — 공식 큐레이션 문서.
//     DRAFT/APPROVED/LOCKED 3-stage, version chain, AI-Human Loop 정착.
//   - `ArtworkCurationData` (본 module) — Artwork 직접 inline data.
//     별도 lifecycle 없음, plain string, free-form, optional.
//
//   두 dimension 분리:
//     - 정식 큐레이션 카탈로그 텍스트  → CurationNote (lifecycle, audit)
//     - 작품 마스터에 붙는 light note → ArtworkCurationData (inline)
//
// **Why flatten on Artwork (not nested struct)**:
//   사용자 spec "Artwork master record 내부의 connected data" 명시 — 즉 Artwork
//   field 로 직접 합류. nested object 는 "connected" intent 와 약간 어긋나며,
//   사용 convenience (artwork.description 직접 접근) 도 떨어짐. Artist / AXID 의
//   nested struct 는 의미적으로 sub-entity 이지만, 이 5 fields 는 plain text
//   metadata.
//
// **Phase 4 §4 Implementation Constraints 정합**:
//   §4.1 Additive only           ✓  신규 5 optional fields on Artwork
//   §4.2 Optional slot priority   ✓  모든 field optional, 모두 string
//   §4.3 No persistence migration ✓  validateV1 / SCHEMA_VERSION 변경 0줄
//   §4.5 Backward compat          ✓  기존 mock-data.ts artwork 모두 자연 호환
//
// **외부 라이브러리 0개**.
// ============================================================================

import type { Artwork } from "./artwork";

// ----------------------------------------------------------------------------
// 1. Field key union — 5 keys (사용자 spec 정확 매칭)
// ----------------------------------------------------------------------------

/**
 * Artwork 의 curation/connected data 5 fields key union.
 *
 * 사용자 spec 정확 매칭:
 *   - description       작품 설명
 *   - curationDraft     큐레이션 초안 (CurationNote 만들기 전 quick note)
 *   - exhibitionText    전시 설명
 *   - artistNote        작가 메모 / work statement
 *   - provenanceNote    provenance / 소장 이력
 */
export type ArtworkCurationDataKey =
  | "description"
  | "curationDraft"
  | "exhibitionText"
  | "artistNote"
  | "provenanceNote";

// ----------------------------------------------------------------------------
// 2. Canonical Ordered List — UI 진입 순서
// ----------------------------------------------------------------------------

export const ARTWORK_CURATION_DATA_KEYS: readonly ArtworkCurationDataKey[] = [
  "description",
  "curationDraft",
  "exhibitionText",
  "artistNote",
  "provenanceNote",
] as const;

// ----------------------------------------------------------------------------
// 3. Display Labels — Korean (gallery internal tone)
// ----------------------------------------------------------------------------

export const ARTWORK_CURATION_DATA_LABEL_KR: Record<
  ArtworkCurationDataKey,
  string
> = {
  description: "작품 설명",
  curationDraft: "큐레이션 초안",
  exhibitionText: "전시 설명",
  artistNote: "작가 메모",
  provenanceNote: "Provenance 메모",
};

// ----------------------------------------------------------------------------
// 4. Display Labels — English (international)
// ----------------------------------------------------------------------------

export const ARTWORK_CURATION_DATA_LABEL_EN: Record<
  ArtworkCurationDataKey,
  string
> = {
  description: "Description",
  curationDraft: "Curation Draft",
  exhibitionText: "Exhibition Text",
  artistNote: "Artist Note",
  provenanceNote: "Provenance Note",
};

// ----------------------------------------------------------------------------
// 5. Helper — hasAnyCurationData
// ----------------------------------------------------------------------------

/**
 * Artwork 에 5 curation fields 중 *하나라도* non-empty 값이 있는지 검사.
 *
 * UI 에서 "Curation 정보 있음" 표시 / Tab 4 active indicator / 큐레이션 노트
 * 진입 가이드 등에 활용.
 *
 * Pure — side effect 0건.
 */
export const hasAnyCurationData = (artwork: Artwork): boolean => {
  return ARTWORK_CURATION_DATA_KEYS.some((key) => {
    const value = artwork[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

// ----------------------------------------------------------------------------
// 6. Helper — collectCurationData
// ----------------------------------------------------------------------------

/**
 * Artwork 에서 5 curation fields 만 추출하여 partial record 반환.
 *
 * 부재 / 빈 문자열 field 는 결과에서 제외 (compact projection). UI 표시 / export
 * / search indexing 등에 유용.
 *
 * Pure — side effect 0건.
 */
export const collectCurationData = (
  artwork: Artwork,
): Partial<Record<ArtworkCurationDataKey, string>> => {
  const result: Partial<Record<ArtworkCurationDataKey, string>> = {};
  for (const key of ARTWORK_CURATION_DATA_KEYS) {
    const value = artwork[key];
    if (typeof value === "string" && value.trim().length > 0) {
      result[key] = value;
    }
  }
  return result;
};

// ----------------------------------------------------------------------------
// 7. Type guard — ArtworkCurationDataKey
// ----------------------------------------------------------------------------

/**
 * 외부 input (URL / form / persisted state) 으로 들어온 값이 valid curation
 * data key 인지 검증. case-sensitive.
 */
export const isArtworkCurationDataKey = (
  value: unknown,
): value is ArtworkCurationDataKey =>
  typeof value === "string" &&
  (ARTWORK_CURATION_DATA_KEYS as readonly string[]).includes(value);
