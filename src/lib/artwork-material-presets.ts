// ============================================================================
// Artwork Material Presets — Artwork UX Enhancement (Material chip strip).
//
// 자유 입력 가능한 medium 필드의 *입력 가이드*. 사용자가 chip 클릭 시 input에
// 해당 문자열을 그대로 채움. enum 강제 0건 — 사용자는 preset 외 자유 입력 가능.
//
// **설계 원칙**:
//   - persistence schema 영향 0건 — `Artwork.medium: string` 그대로 사용.
//   - 기존 작품 데이터 호환 — preset 외 임의 문자열도 정상 저장 / 표시.
//   - 본 list는 "자주 쓰이는 표현" 기준이며, 갤러리 / 작가별 표현 다양성 존중.
//
// **표현 정책**:
//   - 한국어 + 영어 병기 (한국 갤러리 컨텍스트 + 국제 거래 표기 일관)
//   - 공식 표준이 아닌 *운영 참고* 라벨
// ============================================================================

/**
 * 자주 사용되는 작품 재료 preset. ArtworkFormDrawer의 Material chip strip 표시용.
 *
 * **순서**: 사용 빈도 (canvas 회화 → 종이 → 조각 → 사진/디지털 → 영상/설치) 기준.
 * 갤러리 운영자가 가장 자주 입력하는 항목이 앞쪽에 위치하여 클릭 효율 ↑.
 *
 * **확장**: 본 list에 없는 재료는 사용자가 input에 자유 입력 (preset은 가이드일 뿐).
 */
export const ARTWORK_MATERIAL_PRESETS: ReadonlyArray<string> = [
  "Oil on Canvas",
  "Acrylic on Canvas",
  "Mixed Media",
  "Ink on Paper",
  "Watercolor on Paper",
  "Photography",
  "Digital Print",
  "Sculpture",
  "Bronze",
  "Ceramic",
  "Installation",
  "Video",
];
