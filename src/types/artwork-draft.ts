// ============================================================================
// AXVELA — Artwork Registration Draft Foundation (STEP 117)
// ============================================================================
//
// **본 모듈의 정체**:
//   ArtworkFormDrawer (신규 등록) 의 *진행 중 상태* 를 임시 보관하는 type
//   foundation. 사용자가 4-tab form 을 진행하다 drawer 를 닫더라도 입력 내용을
//   잃지 않도록 *명시적 임시 저장* 흐름을 지원.
//
//   사용자 spec & `AXVELA_WORKFLOW_ARCHITECTURE.md §4.4` 인용:
//     "Drawer 닫혀도 workflow 보존. 모든 multi-step form 은 partial state
//      저장 가능. 사용자 의도하지 않은 데이터 손실 0건."
//
// **본 module 이 담당하는 영역 (MVP scope)**:
//   - 명시적 "임시 저장" 버튼 클릭 시 draft data 보관
//   - Sidebar "이어 작성" entry 의 preview label / relative time helper
//   - Submit 성공 시 자동 clear (createArtwork action 측 책임)
//   - 단일 draft 정책 (한 시점에 하나의 draft) — future expansion path 명확
//
// **본 module 이 담당하지 *않는* 영역 (future STEP)**:
//   - Cancel 시 자동 silent save (사용자 의도 모호 — scope 절제)
//   - Auto-save (debounce) — UX/race-condition 별도 검토
//   - Multiple drafts — 본 module 의 ArtworkDraftState 는 single record
//   - 편집 모드 draft — 신규 등록만 (편집은 직접 update, draft 의미 0)
//
// **Persistence schema 영향 — Optional Slice 패턴 (STEP 87/89 정확 답습)**:
//   - `PersistedState.artworkDraft?: ArtworkDraftState` — optional slice
//   - `validateV1` 의 required keys 미추가 (legacy 호환)
//   - `hydrateFromStorage` 부재 시 undefined fallback (forward-only)
//   - `SCHEMA_VERSION "v1"` 변경 0줄
//
// **Phase 4 §4 정합**:
//   §4.1 Additive only ✅ 신규 type, 기존 타입 변경 0줄
//   §4.2 Optional slot ✅ artworkDraft? optional slice
//   §4.3 No migration  ✅ validateV1 required 미수정
//   §4.4 Draft-safe    ✅ 본 STEP 의 핵심 영역
//   §4.5 Backward compat ✅ legacy 데이터 (artworkDraft 부재) 자연 호환
//   §4.8 AI not priority ✅ AI 미포함, pure data
// ============================================================================

import type { ArtworkInput } from "@/store/useArtworkStore";

// ----------------------------------------------------------------------------
// Core type — 진행 중 form state + meta
// ----------------------------------------------------------------------------

/**
 * 진행 중 작품 등록의 임시 저장 상태.
 *
 * `data` 는 현재 form 의 모든 4-tab fields 를 담는 ArtworkInput. 사용자가
 * 임시 저장 버튼을 누른 *그 시점* 의 form snapshot. validation 미통과 상태도
 * 그대로 저장 가능 (사용자가 의도하면 빈 title 도 보존).
 *
 * 단일 draft 정책 (v1) — 한 시점에 하나의 draft. 새 임시 저장은 기존 draft
 * 를 덮어씀. future expansion 시 `additionalDrafts?: ArtworkDraftState[]`
 * 형태로 추가 가능 (현 슬롯 그대로 보존).
 */
export interface ArtworkDraftState {
  /**
   * 진행 중 form snapshot. 4-tab 의 모든 fields (title / artistName /
   * artistNameEn / year / medium / dimensions / priceKRW / state /
   * thumbnailColor / image meta 6 fields / 5 curation fields) 포함.
   *
   * **부분 입력 허용** — title 빈 문자열도 보존. validation 미통과 여부는
   * draft hydration 후 form 재진입 시 사용자에게 자연 표시 (submitted=false
   * 상태이므로 error message 미노출).
   */
  data: ArtworkInput;

  /** Draft 시작 시각 — ISO datetime. 첫 번째 임시 저장 시점. */
  startedAt: string;

  /**
   * 마지막 임시 저장 시각 — ISO datetime. 동일 draft 를 여러 번 갱신 시
   * 매번 갱신. Sidebar "이어 작성" entry 의 relative time 표시 source.
   */
  lastEditedAt: string;
}

// ----------------------------------------------------------------------------
// Helpers — Sidebar entry preview / relative time
// ----------------------------------------------------------------------------

/**
 * Sidebar "이어 작성" entry 의 preview label 추출.
 *
 * 우선순위:
 *   1) title 에 비공백 문자 있음 → trim 한 title (최대 24자, 초과 시 ellipsis)
 *   2) artistName 에 비공백 문자 있음 → trim 한 artistName (최대 24자)
 *   3) 둘 다 비어있음 → "(제목 없음)"
 *
 * 24자 cap 은 Sidebar 240px 폭 + 한국어 평균 글자폭 고려한 visual 한계.
 */
export function extractDraftPreviewLabel(draft: ArtworkDraftState): string {
  const MAX = 24;
  const t = draft.data.title?.trim() ?? "";
  if (t.length > 0) {
    return t.length > MAX ? `${t.slice(0, MAX)}…` : t;
  }
  const a = draft.data.artistName?.trim() ?? "";
  if (a.length > 0) {
    return a.length > MAX ? `${a.slice(0, MAX)}…` : a;
  }
  return "(제목 없음)";
}

/**
 * Relative time 한국어 표기.
 *
 *   - 60초 미만: "방금"
 *   - 60분 미만: "{n}분 전"
 *   - 24시간 미만: "{n}시간 전"
 *   - 어제 (24~48시간): "어제"
 *   - 30일 미만: "{n}일 전"
 *   - 30일 이상: ISO date "YYYY-MM-DD" (정확 정보 우선)
 *
 * `now` 인자 — 테스트 결정성을 위해 명시적 주입 가능. 미지정 시 Date.now().
 *
 * **방어**: invalid ISO 또는 future timestamp → ISO date fallback (음수 분
 * 표시 회피 — Date.parse 에 의해 NaN 반환되는 경우 포함).
 */
export function formatDraftRelativeTime(
  iso: string,
  now: number = Date.now()
): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);

  const diffMs = now - t;
  if (diffMs < 0) {
    // future timestamp — clock skew 등 방어, 정확 정보 fallback
    return iso.slice(0, 10);
  }

  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (diffMs < MIN) return "방금";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MIN)}분 전`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}시간 전`;
  if (diffMs < 2 * DAY) return "어제";
  if (diffMs < 30 * DAY) return `${Math.floor(diffMs / DAY)}일 전`;

  return iso.slice(0, 10);
}
