// ============================================================================
// Artwork Size Conversion — Artwork UX Enhancement (Size auto-conversion).
//
// 작품 크기 입력의 자동 환산 + 한국 canvas 호수(F형) reference helper.
// **모든 환산은 운영 참고용** — certified / 법적 효력 / 공인 규격과 무관.
//
// **설계 원칙**:
//   - persistence schema 영향 0건 — `Artwork.dimensions: string` 그대로 사용.
//   - 기존 데이터 호환 — best-effort parser로 \"162.0 × 130.3 cm\" 같은 legacy
//     문자열을 구조화하되, parse 실패 시 plain text fallback (drawer가 처리).
//   - serialize는 일관 형식 (\"<W> × <H> cm\" 또는 \"<W> × <H> × <D> cm\") —
//     기존 데이터 표기와 호환.
//   - 호수는 *F형 기준* reference만 (P형 / M형 / 기타는 향후 확장 시).
//
// **표현 정책 (사용자 spec)**:
//   - 사용: \"운영 참고\" / \"자동 환산 참고\" / \"호수 기준 참고값\" /
//     \"F형 기준\"
//   - 금지: \"정확한 규격 보장\" / \"certified conversion\" / \"법적 효력\" /
//     \"공인 규격\"
// ============================================================================

// ----------------------------------------------------------------------------
// Unit & types
// ----------------------------------------------------------------------------

export type SizeUnit = "cm" | "inch";

export interface ParsedDimensions {
  /** Width 값 (입력 단위 기준). */
  width: number;
  /** Height 값 (입력 단위 기준). */
  height: number;
  /** Depth 값 (옵셔널 — 평면 작품은 부재). */
  depth?: number;
  /** 입력 단위 — \"cm\" | \"inch\". */
  unit: SizeUnit;
}

// ----------------------------------------------------------------------------
// Pure conversion math
// ----------------------------------------------------------------------------

/** 1 inch = 2.54 cm (정확값, 국제 표준). */
const INCH_TO_CM = 2.54;

/** cm → inch (소수점 둘째 자리 반올림). */
export function cmToInch(cm: number): number {
  if (!Number.isFinite(cm)) return 0;
  return Math.round((cm / INCH_TO_CM) * 100) / 100;
}

/** inch → cm (소수점 첫째 자리 반올림 — 갤러리 표기 일관). */
export function inchToCm(inch: number): number {
  if (!Number.isFinite(inch)) return 0;
  return Math.round(inch * INCH_TO_CM * 10) / 10;
}

// ----------------------------------------------------------------------------
// Parse / format — legacy "162.0 × 130.3 cm" string ↔ structured
// ----------------------------------------------------------------------------

/**
 * Legacy dimensions 문자열을 structured 객체로 best-effort parse.
 *
 * 지원 형식 (대소문자 / 공백 / 단위 표기 유연):
 *   - \"162.0 × 130.3 cm\"
 *   - \"162 x 130 cm\"
 *   - \"162.0×130.3×5.0 cm\"
 *   - \"63.78 x 51.30 inch\"
 *   - \"162.0 × 130.3\" (단위 부재 시 cm 가정)
 *
 * **실패 시 null 반환** — 호출자(drawer)가 plain text fallback 모드로 표시.
 */
export function parseDimensionsString(
  raw: string | undefined | null
): ParsedDimensions | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // 단위 추출 — 끝에 \"cm\" / \"inch\" / \"in\" 또는 부재
  const unitMatch = s.match(/(cm|inch|in|inches)\s*$/i);
  let unit: SizeUnit = "cm";
  let rest = s;
  if (unitMatch) {
    const u = unitMatch[1].toLowerCase();
    unit = u === "cm" ? "cm" : "inch";
    rest = s.slice(0, s.length - unitMatch[0].length).trim();
  }

  // 숫자 토큰 추출 — × 또는 x 또는 * 구분자, 공백 허용
  const tokens = rest
    .split(/[×x*]/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length < 2 || tokens.length > 3) return null;

  const numbers = tokens.map((t) => Number.parseFloat(t));
  if (numbers.some((n) => !Number.isFinite(n) || n <= 0)) return null;

  return {
    width: numbers[0],
    height: numbers[1],
    depth: numbers[2],
    unit,
  };
}

/**
 * Structured 객체 → \"<W> × <H> cm\" 형식 문자열로 직렬화.
 *
 * 기존 데이터 표기 (\"162.0 × 130.3 cm\")와 호환되는 형식 — × 기호 사용.
 * depth가 있으면 \"<W> × <H> × <D> <unit>\" 3차원 표기.
 *
 * 빈 입력 / 0 / 음수 시 빈 문자열 반환 (호출자가 \"필수\" 검증).
 */
export function formatDimensionsString(parsed: ParsedDimensions): string {
  const { width, height, depth, unit } = parsed;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "";
  if (width <= 0 || height <= 0) return "";

  const parts = [formatNumber(width), formatNumber(height)];
  if (depth !== undefined && Number.isFinite(depth) && depth > 0) {
    parts.push(formatNumber(depth));
  }
  return `${parts.join(" × ")} ${unit}`;
}

function formatNumber(n: number): string {
  // 정수면 .0 표기 (162 → \"162.0\"), 소수는 그대로 (130.3 → \"130.3\")
  // 기존 데이터 표기 일관: \"162.0 × 130.3 cm\"
  if (Number.isInteger(n)) return n.toFixed(1);
  // 소수점 둘째 자리까지 — inch 환산 결과도 깔끔하게
  return (Math.round(n * 100) / 100).toString();
}

// ----------------------------------------------------------------------------
// Korean canvas 호수 — F형 reference table
// ----------------------------------------------------------------------------

/**
 * 한국 갤러리에서 자주 쓰이는 F형 (Figure) canvas 호수 → cm 매핑.
 *
 * **주의**: 본 매핑은 *대표값*이며 실제 작품 / 캔버스 제조사별로 미세한
 * 차이가 있을 수 있음. 사용자 spec \"호수 기준 참고값\" 정책 일관 — 운영
 * 참고용 only, 공인 규격 / 법적 효력 무관.
 *
 * P형 / M형은 향후 확장 시 추가. 현 STEP은 F형 단독 (한국 갤러리 운영
 * 가장 흔한 표기).
 *
 * 출처: 한국 화방 표준 (대중적 reference). 갤러리별 미세 차이 가능.
 */
export interface KoreanCanvasSize {
  no: number; // 호수 (1, 2, 3, 4, 6, 8, ...)
  widthCm: number;
  heightCm: number;
}

export const KOREAN_CANVAS_F_SIZES: ReadonlyArray<KoreanCanvasSize> = [
  { no: 1, widthCm: 22.7, heightCm: 15.8 },
  { no: 2, widthCm: 24.2, heightCm: 19.0 },
  { no: 3, widthCm: 27.3, heightCm: 22.0 },
  { no: 4, widthCm: 33.4, heightCm: 24.2 },
  { no: 6, widthCm: 40.9, heightCm: 31.8 },
  { no: 8, widthCm: 45.5, heightCm: 37.9 },
  { no: 10, widthCm: 53.0, heightCm: 45.5 },
  { no: 12, widthCm: 60.6, heightCm: 50.0 },
  { no: 15, widthCm: 65.2, heightCm: 53.0 },
  { no: 20, widthCm: 72.7, heightCm: 60.6 },
  { no: 25, widthCm: 80.3, heightCm: 65.2 },
  { no: 30, widthCm: 90.9, heightCm: 72.7 },
  { no: 40, widthCm: 100.0, heightCm: 80.3 },
  { no: 50, widthCm: 116.7, heightCm: 91.0 },
  { no: 60, widthCm: 130.3, heightCm: 97.0 },
  { no: 80, widthCm: 145.5, heightCm: 112.1 },
  { no: 100, widthCm: 162.2, heightCm: 130.3 },
  { no: 120, widthCm: 193.9, heightCm: 130.3 },
  { no: 150, widthCm: 227.3, heightCm: 181.8 },
  { no: 200, widthCm: 259.0, heightCm: 193.9 },
];

/**
 * 입력된 width × height (cm)에 가장 근접한 F형 호수를 찾음.
 *
 * **매칭 정책**:
 *   - width / height의 *최대값*이 호수 표 widthCm과 ±5% 이내, 동시에 *최소값*이
 *     heightCm과 ±5% 이내일 때 해당 호수로 매칭 (가로/세로 swap 허용 — 작품은
 *     세로/가로 자유).
 *   - 매칭 안 되면 null 반환.
 *
 * **비-F형 작품**: 정확한 P형 / M형 / 임의 비율 작품은 매칭 실패가 정상.
 * 매칭 실패 = \"표준 F형 호수 대응 없음\" — 운영 참고에 호수 표시 안 함.
 */
export function lookupKoreanCanvasNo(
  widthCm: number,
  heightCm: number
): KoreanCanvasSize | null {
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;
  if (widthCm <= 0 || heightCm <= 0) return null;

  const maxInput = Math.max(widthCm, heightCm);
  const minInput = Math.min(widthCm, heightCm);
  const TOLERANCE = 0.05; // ±5%

  for (const size of KOREAN_CANVAS_F_SIZES) {
    const maxRef = Math.max(size.widthCm, size.heightCm);
    const minRef = Math.min(size.widthCm, size.heightCm);
    const maxRatio = Math.abs(maxInput - maxRef) / maxRef;
    const minRatio = Math.abs(minInput - minRef) / minRef;
    if (maxRatio <= TOLERANCE && minRatio <= TOLERANCE) {
      return size;
    }
  }
  return null;
}

/**
 * 호수 번호 → 대표 cm. 사용자가 \"20호\" 입력 시 자동 채움 보조 함수.
 * 등록되지 않은 호수는 null.
 */
export function koreanCanvasNoToDimensions(
  no: number
): KoreanCanvasSize | null {
  return KOREAN_CANVAS_F_SIZES.find((s) => s.no === no) ?? null;
}

/**
 * 사용 가능한 호수 list (UI dropdown 표시용 — 1호 ~ 200호).
 * `KOREAN_CANVAS_F_SIZES`의 `no` 필드만 추출한 ReadonlyArray.
 */
export const KOREAN_CANVAS_NO_LIST: ReadonlyArray<number> =
  KOREAN_CANVAS_F_SIZES.map((s) => s.no);

// ----------------------------------------------------------------------------
// High-level — UI 부가 라벨용 reference 문자열 생성
// ----------------------------------------------------------------------------

/**
 * 입력 단위 기준의 width/height/depth로부터 *반대 단위 + 호수 reference*
 * 한 줄을 생성. drawer 입력 inline display용.
 *
 * 예 (cm 입력):
 *   \"≈ 63.78 × 51.30 inch · 100호 (F형 기준)\"
 *
 * 예 (inch 입력, 호수 매칭 없음):
 *   \"≈ 162.0 × 130.0 cm\"
 *
 * 빈 입력 / 잘못된 입력 시 빈 문자열 반환 — 호출자가 그대로 노출 / 숨김 결정.
 */
export function buildSizeReferenceLabel(parsed: ParsedDimensions): string {
  const { width, height, depth, unit } = parsed;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "";
  if (width <= 0 || height <= 0) return "";

  // 반대 단위 환산
  const oppositeUnit: SizeUnit = unit === "cm" ? "inch" : "cm";
  const conv =
    unit === "cm"
      ? {
          width: cmToInch(width),
          height: cmToInch(height),
          depth: depth !== undefined ? cmToInch(depth) : undefined,
        }
      : {
          width: inchToCm(width),
          height: inchToCm(height),
          depth: depth !== undefined ? inchToCm(depth) : undefined,
        };

  const oppositeStr = formatDimensionsString({
    width: conv.width,
    height: conv.height,
    depth: conv.depth,
    unit: oppositeUnit,
  });

  // 호수 reference — cm 단위 기준으로 매칭 시도
  const widthCm = unit === "cm" ? width : inchToCm(width);
  const heightCm = unit === "cm" ? height : inchToCm(height);
  const canvasMatch = lookupKoreanCanvasNo(widthCm, heightCm);

  const parts = [`≈ ${oppositeStr}`];
  if (canvasMatch) {
    parts.push(`${canvasMatch.no}호 (F형 기준)`);
  }
  return parts.join(" · ");
}
