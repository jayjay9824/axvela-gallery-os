// ============================================================================
// i18n-helpers.ts — STEP 130 — Internationalization Layer Helpers
//
// **본 module 의 정체**:
//   Artwork / Artist 의 *storage-level multilingual data* 단일 derivation
//   point. `getTitle(artwork, locale)` + `getArtistName(artist, locale)` 의
//   2 pure helper.
//
// **STEP 96 Translation Layer 와의 dimension 분리** (STEP 130 Phase 1 §1):
//   - STEP 96 `TranslationToolbar` = *runtime AI projection*. 원본 한국어
//     텍스트 1개 → AI 동적 변환 → target locale 출력. local state, ephemeral
//     cache, document entity schema 0줄.
//   - STEP 130 본 helper = *storage-level multilingual data*. artwork master
//     record 의 영구 저장된 다국어 데이터. titleI18n? / nameI18n? optional
//     slot 직접 read.
//   - 두 layer 의도적 별도 dimension (Two-Layer Curation Model 패턴 답습).
//
// **DocumentLocale 재활용** (STEP 130 Phase 1 §2):
//   STEP 96 의 `DocumentLocale` (= `AILocale`, 4-locale ko/en/ja/zh) 그대로
//   재활용 — UI / AI infra / storage layer 가 모두 같은 enum 공유. drift 방지.
//
// **convention 답습**:
//   - `src/lib/invoice-helpers.ts` (STEP 127) 와 동일 pattern — pure, type-only
//     derivation, external dependency 0, tree-shake 안전.
//   - 호출처는 본 helper 만 호출 — `artwork.titleI18n` 직접 접근 0건 (single
//     derivation point).
// ============================================================================

import type { Artwork, Artist } from "@/types/artwork";
import type { DocumentLocale } from "@/lib/document-locale";

/**
 * Artwork 의 locale-aware title derivation.
 *
 * **Fallback chain** (STEP 130 Phase 1 §3.2):
 *   1. `artwork.titleI18n?.[locale]` — 명시된 locale 의 다국어 텍스트 우선
 *   2. `artwork.titleI18n?.en` — 영어 fallback (국제 거래 baseline)
 *   3. `artwork.title` — primary field (보통 ko, 갤러리 baseline, **항상 정의됨**)
 *
 * **rationale**:
 *   - 가장 가까운 데이터 우선 (locale 명시 시 그 locale)
 *   - 부재 시 en (국제 거래) → primary (운영자 baseline) 순으로 점진 fallback
 *   - chain 의 최종은 항상 `artwork.title` (required field) — 반환값 보장
 *
 * **STEP 96 Translation Layer 와의 dimension 분리**: 본 helper 는 *영구 저장
 * 데이터* read. runtime AI projection (STEP 96) 은 별도 layer — 두 layer 모두
 * 호출 측에서 명시 선택.
 *
 * **pure** — side effect 0, single artwork + locale → string. tree-shake 안전.
 *
 * @example
 * getTitle({ title: "푸른 정원", titleI18n: { en: "Blue Garden" } }, "en");
 * // → "Blue Garden"
 *
 * @example
 * getTitle({ title: "푸른 정원" }, "en");
 * // → "푸른 정원" (titleI18n 미정의, primary fallback)
 *
 * @example
 * getTitle({ title: "푸른 정원", titleI18n: { en: "Blue Garden" } }, "ja");
 * // → "Blue Garden" (ja 미정의, en fallback)
 */
export function getTitle(artwork: Artwork, locale: DocumentLocale): string {
  return artwork.titleI18n?.[locale] ?? artwork.titleI18n?.en ?? artwork.title;
}

/**
 * Artist 의 locale-aware name derivation.
 *
 * **Fallback chain** (STEP 130 Phase 1 §5 옵션 c1 채택 — 병행):
 *   1. `artist.nameI18n?.[locale]` — 명시된 locale 의 다국어 이름 우선
 *   2. `artist.nameI18n?.en` — 영어 fallback (국제 거래 baseline)
 *   3. `artist.nameEn` — *legacy slot* fallback (locale === "en" 시 의미 동일)
 *   4. `artist.name` — primary field (보통 ko, **항상 정의됨**)
 *
 * **rationale (옵션 c1 병행)**:
 *   - 신규 `nameI18n?` 도입 시 기존 `nameEn?` 정착물 (6 files: useArtworkStore /
 *     ArtworkFormDrawer / types/artwork / mock-data / DetailPanel / ArtworkGrid)
 *     무변경 — 회귀 위험 0 (additive only).
 *   - 운영자가 form 의 "작가 영문명" 입력 그대로 유지 → 데이터 손실 0.
 *   - 미래 `nameEn?` deprecation 시 본 helper 만 갱신 → 호출처 무영향.
 *
 * **STEP 96 Translation Layer 와의 dimension 분리**: 본 helper 는 *영구 저장
 * 사용자 입력 데이터* read. runtime AI 변환 (STEP 96) 과는 별도 layer.
 *
 * **pure** — side effect 0, single artist + locale → string. tree-shake 안전.
 *
 * @example
 * getArtistName({ id: "a1", name: "김지은", nameI18n: { en: "Jieun Kim" } }, "en");
 * // → "Jieun Kim"
 *
 * @example
 * getArtistName({ id: "a1", name: "김지은", nameEn: "Jieun Kim" }, "en");
 * // → "Jieun Kim" (legacy nameEn fallback)
 *
 * @example
 * getArtistName({ id: "a1", name: "김지은" }, "en");
 * // → "김지은" (모든 영문 slot 미정의, primary fallback)
 *
 * @example
 * getArtistName({ id: "a1", name: "김지은", nameI18n: { en: "Jieun Kim" } }, "ja");
 * // → "Jieun Kim" (ja 미정의, en fallback)
 */
export function getArtistName(
  artist: Artist,
  locale: DocumentLocale,
): string {
  // 1. nameI18n[locale] — 명시 locale 우선
  const i18nDirect = artist.nameI18n?.[locale];
  if (i18nDirect) return i18nDirect;

  // 2. nameI18n.en — 영어 fallback
  const i18nEn = artist.nameI18n?.en;
  if (i18nEn) return i18nEn;

  // 3. legacy nameEn — locale === "en" 시 의미 동일, 다른 locale 시 영어 fallback
  if (artist.nameEn) return artist.nameEn;

  // 4. primary name — required field, 항상 반환 보장
  return artist.name;
}
