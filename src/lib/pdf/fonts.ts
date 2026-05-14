// src/lib/pdf/fonts.ts
//
// ============================================================================
// PDF Font Registration — STEP 132 Phase 2 Commit 1 (Foundation)
//
// **본 모듈의 역할**:
//   @react-pdf/renderer 의 Font.register() 를 통해 Pretendard ttf 폰트를
//   PDF 렌더링 엔진에 등록. ensureFontsRegistered() 는 idempotent —
//   여러 번 호출되어도 1회만 실제 등록.
//
// **Pretendard 출처** (STEP 132 Phase B 정착):
//   - 자산: Pretendard-1.3.9.zip release asset (GitHub orioncactus/pretendard)
//   - 버전: v1.3.9 (tag-locked, 매니페스토 "기술 스택 고정" 정합)
//   - License: SIL Open Font License 1.1 (OFL, 상업 / 임베드 OK)
//   - 사용 variant: alternative/ TTF (PDF 호환 최적, fontkit 정합)
//   - 위치: public/fonts/Pretendard-{Regular,Bold}.ttf
//
// **호출 정책**:
//   PDF 생성 직전 (renderToBuffer / renderToStream 호출 직전)
//   ensureFontsRegistered() 를 1회 호출. 중복 호출 안전 (registered flag 차단).
//
// **server-side only**:
//   본 모듈은 `path` (Node.js)를 import. Client component import 시
//   webpack 빌드 에러 가능. API route / server component 에서만 사용.
//
// **rule_16 minimalism**: 외부 라이브러리 1개 (@react-pdf/renderer) +
// Node.js path 표준 모듈만. 추가 dep 0.
// ============================================================================

import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

/**
 * Pretendard 폰트를 @react-pdf/renderer 에 등록한다.
 * 여러 번 호출되어도 안전 (idempotent).
 *
 * **호출 시점**: PDF 생성 (renderToBuffer / renderToStream) 직전.
 * **Side effect**: Font.register() 가 모듈 전역 state 변경.
 *
 * @example
 *   import { ensureFontsRegistered } from "@/lib/pdf/fonts";
 *   ensureFontsRegistered();
 *   const buffer = await renderToBuffer(<MyDocument />);
 */
export function ensureFontsRegistered(): void {
  if (registered) return;

  const fontsDir = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: "Pretendard",
    fonts: [
      {
        src: path.join(fontsDir, "Pretendard-Regular.ttf"),
        fontWeight: "normal",
      },
      {
        src: path.join(fontsDir, "Pretendard-Bold.ttf"),
        fontWeight: "bold",
      },
    ],
  });

  registered = true;
}

/**
 * Pretendard family name — StyleSheet 의 `fontFamily` 속성에 사용.
 *
 * @example
 *   import { PRETENDARD_FAMILY } from "@/lib/pdf/fonts";
 *   const styles = StyleSheet.create({
 *     body: { fontFamily: PRETENDARD_FAMILY, fontSize: 12 },
 *   });
 */
export const PRETENDARD_FAMILY = "Pretendard" as const;
