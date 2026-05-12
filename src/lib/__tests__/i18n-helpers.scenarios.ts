// ============================================================================
// i18n-helpers.scenarios.ts — STEP 130 Phase 2 Commit 1b Test Scenarios
//
// **본 module 의 정체**:
//   STEP 130 Phase 2 Commit 1 (`01a1540`) 정착된 `getTitle` / `getArtistName`
//   2 pure helper 의 fallback chain 8-scenario 검증. 외부 test 라이브러리
//   0개 — inline assert helpers + runAllScenarios() runner. 기존 12 scenarios
//   파일 convention 정확 답습 (invoice-kind / format-axid-for-document 패턴).
//
// **검증 영역** (사용자 spec STEP 130 Phase 2 Commit 1b — 8 case):
//
//   getTitle fallback chain (4 case):
//     §1 titleI18n[locale] 존재 → 그대로 반환
//     §2 titleI18n[locale] 부재, titleI18n.en 존재 → en 반환
//     §3 titleI18n 전체 부재 → title (required) 반환
//     §4 titleI18n[locale] = "" 빈 문자열 → 현 거동 (nullish ??) 기준 ""
//        반환 — Deferred Item D-130-1 (의미 결정 보류)
//
//   getArtistName fallback chain (4 case):
//     §5 nameI18n[locale] 존재 → 그대로 반환
//     §6 nameI18n[locale] 부재, nameI18n.en 존재 → en 반환
//     §7 nameI18n 전체 부재, nameEn? 존재 → nameEn 반환 (옵션 c1 병행 호환)
//     §8 nameI18n + nameEn 모두 부재 → name (required) 반환
//
// **Deferred Item D-130-1 — 빈 문자열 의미 결정 보류**:
//   `01a1540` 구현 `getTitle` 은 nullish coalescing (`??`) 체인 — `""` 빈
//   문자열은 nullish 가 아니므로 그대로 반환. 운영자가 `titleI18n.ko = ""`
//   를 의도적으로 입력한 경우 (a) "공란" 표시 의도인지, (b) 다음 단계 fallback
//   진입 의도인지 spec 미명시. 본 시나리오 §4 는 *현 구현 거동* 만 lock —
//   의미 결정은 STEP 131 (Print/Drawer wire) 또는 STEP 134 (Passport surface)
//   에서 재검토. 그 시점에 truthy 체크로 전환 결정 시 `01a1540` helper 본문
//   1줄 수정 + 본 §4 갱신.
//
// **STEP 96 Translation Layer dimension 분리 정합** (반드시 명시):
//   본 helper 가 다루는 데이터는 *storage-level multilingual artwork data*
//   (영구 저장된 사용자 입력). STEP 96 `TranslationToolbar` 의 *runtime AI
//   projection* (Invoice / Receipt / TaxInvoice 등 document content 의 동적
//   번역) 과는 **별도 dimension — 통합 절대 금지**. 두 layer 의도적 분리:
//     - artwork i18n (본 helper): titleI18n? / nameI18n? optional slot,
//       artwork master record 영구 저장, 운영자 명시 입력
//     - document content 번역 (STEP 96): TranslationToolbar runtime cache,
//       AI 동적 변환, document entity schema 미변경
//   향후 STEP 131+ 에서 사용처 wire 진행 시 본 분리 원칙 유지 — Print /
//   Passport / Drawer surface 에서 두 layer 호출 시 각각 선택.
//
// **검증 회피 영역** (Commit 2+ 로 이월):
//   - useArtworkStore `currentLocale` state 동작 (Commit 2)
//   - Sidebar header locale toggle UI (Commit 3)
//   - 사용처 wire (ArtworkGrid / DetailPanel / Drawers) — STEP 131+
//
// **명시적 변경 0줄 보존 약속** (Commit 1b 작업 범위):
//   - src/lib/i18n-helpers.ts 본문 0줄
//   - src/types/artwork.ts 0줄
//   - package.json 0줄 (npx tsx 우회 유지, tsx devDep 등록은 STEP 137 분리)
//   - SCHEMA_VERSION "v1" 유지 (persistence.ts 무변경)
// ============================================================================

import type { Artist, Artwork } from "@/types/artwork";
import { getArtistName, getTitle } from "@/lib/i18n-helpers";

// ============================================================================
// Tiny assert helpers (외부 라이브러리 0)
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "I18nHelpersAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

// ============================================================================
// Test fixtures — 최소한의 valid Artwork / Artist (Required field 만 채움)
// ============================================================================

/**
 * 최소한의 valid Artist — Required: id, name. Optional 은 overrides 로 제공.
 */
function baseArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: "artist-test-001",
    name: "김지은",
    ...overrides,
  };
}

/**
 * 최소한의 valid Artwork — Required field 모두 채움. Optional 은 overrides.
 * artist field 는 기본 baseArtist() 사용 — 본 scenarios 는 Artwork.titleI18n
 * 만 검증하므로 artist 내부는 무관.
 */
function baseArtwork(overrides: Partial<Artwork> = {}): Artwork {
  return {
    id: "artwork-test-001",
    axid: { code: "AXV-2026-0001", issuedAt: "2026-05-13" },
    title: "푸른 정원",
    artist: baseArtist(),
    year: 2025,
    medium: "Oil on canvas",
    dimensions: "162.0 × 130.3 cm",
    priceKRW: 12_000_000,
    state: "READY",
    thumbnailColor: "#4A6FA5",
    inquiryCount: 0,
    updatedAt: "2026-05-13T00:00:00Z",
    ...overrides,
  };
}

// ============================================================================
// Scenario shape
// ============================================================================

interface I18nHelpersScenario {
  id: number;
  label: string;
  description: string;
  run: () => void;
}

export interface ScenarioRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: number; label: string; error: string }>;
  summary: string;
}

// ============================================================================
// Scenarios — 8 case (getTitle 4 + getArtistName 4)
// ============================================================================

export const SCENARIOS: readonly I18nHelpersScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 — getTitle: titleI18n[locale] 존재 → 그대로 반환
  // 가장 가까운 데이터 우선 — locale 명시 시 그 locale 의 값 사용.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "getTitle_direct_locale_hit",
    description: "titleI18n[locale] 명시 시 그 값 그대로 반환",
    run: () => {
      const art = baseArtwork({
        title: "푸른 정원",
        titleI18n: { en: "Blue Garden", ja: "青い庭", zh: "蓝色花园" },
      });
      assertEqual(getTitle(art, "en"), "Blue Garden", "scenario1.en_direct");
      assertEqual(getTitle(art, "ja"), "青い庭", "scenario1.ja_direct");
      assertEqual(getTitle(art, "zh"), "蓝色花园", "scenario1.zh_direct");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 — getTitle: titleI18n[locale] 부재, titleI18n.en 존재 → en fallback
  // 국제 거래 baseline 으로 영어 fallback.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "getTitle_en_fallback",
    description: "titleI18n[locale] 미정의이나 titleI18n.en 존재 시 영어 fallback",
    run: () => {
      const art = baseArtwork({
        title: "푸른 정원",
        titleI18n: { en: "Blue Garden" },
        // ja, zh 미정의
      });
      assertEqual(getTitle(art, "ja"), "Blue Garden", "scenario2.ja_to_en");
      assertEqual(getTitle(art, "zh"), "Blue Garden", "scenario2.zh_to_en");
      // ko 도 titleI18n.ko 부재 → titleI18n.en fallback (현 chain 의미)
      assertEqual(getTitle(art, "ko"), "Blue Garden", "scenario2.ko_to_en");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 — getTitle: titleI18n 전체 부재 → title (required) 반환
  // 기존 데이터 (Phase 1 ~ STEP 129) 모두 titleI18n 부재 → primary fallback
  // 으로 한국어 원문 그대로 사용. backward compat 보장.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "getTitle_primary_fallback",
    description: "titleI18n 전체 부재 시 primary title 필드 반환 (backward compat)",
    run: () => {
      const art = baseArtwork({ title: "푸른 정원" });
      // titleI18n 미정의 (overrides 미지정)
      assertEqual(art.titleI18n, undefined, "scenario3.titleI18n_undefined");
      assertEqual(getTitle(art, "en"), "푸른 정원", "scenario3.en_to_primary");
      assertEqual(getTitle(art, "ja"), "푸른 정원", "scenario3.ja_to_primary");
      assertEqual(getTitle(art, "zh"), "푸른 정원", "scenario3.zh_to_primary");
      assertEqual(getTitle(art, "ko"), "푸른 정원", "scenario3.ko_to_primary");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 — getTitle: titleI18n[locale] = "" 빈 문자열 → "" 반환 (현 거동 lock)
  // **Deferred Item D-130-1 — 의미 결정 보류**:
  //   `01a1540` 구현은 nullish coalescing (`??`) — `""` 는 nullish 가 아니므로
  //   그대로 반환. 운영자 의도가 (a) "공란 표시" 인지 (b) "다음 fallback 진입"
  //   인지 spec 미명시. 본 시나리오는 *현 구현 거동* 만 lock — STEP 131 또는
  //   134 에서 재검토. truthy 체크로 전환 결정 시 본 case 갱신.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "getTitle_empty_string_nullish_passthrough_D130_1",
    description: "titleI18n[locale] = '' 빈 문자열 → '' 그대로 반환 (현 nullish ?? 거동, D-130-1 보류)",
    run: () => {
      const art = baseArtwork({
        title: "푸른 정원",
        titleI18n: { ko: "", en: "Blue Garden" },
      });
      // ko = "" 명시 → nullish ?? 통과 → "" 반환 (en fallback 미진입)
      assertEqual(getTitle(art, "ko"), "", "scenario4.ko_empty_passthrough");
      // en = "Blue Garden" 정상 — chain 무관 control case
      assertEqual(getTitle(art, "en"), "Blue Garden", "scenario4.en_normal_control");
      // ja 미정의 → en fallback (영향 받지 않음, control)
      assertEqual(getTitle(art, "ja"), "Blue Garden", "scenario4.ja_to_en_control");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 — getArtistName: nameI18n[locale] 존재 → 그대로 반환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "getArtistName_direct_locale_hit",
    description: "nameI18n[locale] 명시 시 그 값 그대로 반환",
    run: () => {
      const artist = baseArtist({
        name: "김지은",
        nameI18n: { en: "Jieun Kim", ja: "キム ジウン", zh: "金智恩" },
      });
      assertEqual(getArtistName(artist, "en"), "Jieun Kim", "scenario5.en_direct");
      assertEqual(getArtistName(artist, "ja"), "キム ジウン", "scenario5.ja_direct");
      assertEqual(getArtistName(artist, "zh"), "金智恩", "scenario5.zh_direct");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §6 — getArtistName: nameI18n[locale] 부재, nameI18n.en 존재 → en fallback
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "getArtistName_en_fallback",
    description: "nameI18n[locale] 미정의이나 nameI18n.en 존재 시 영어 fallback",
    run: () => {
      const artist = baseArtist({
        name: "김지은",
        nameI18n: { en: "Jieun Kim" },
        // ja, zh 미정의
      });
      assertEqual(getArtistName(artist, "ja"), "Jieun Kim", "scenario6.ja_to_en");
      assertEqual(getArtistName(artist, "zh"), "Jieun Kim", "scenario6.zh_to_en");
      // ko 도 nameI18n.ko 부재 → nameI18n.en fallback (chain 의미 그대로)
      assertEqual(getArtistName(artist, "ko"), "Jieun Kim", "scenario6.ko_to_en");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §7 — getArtistName: nameI18n 전체 부재, nameEn? 존재 → nameEn fallback
  // **옵션 c1 병행 호환 검증** (사용자 결정 §9 항목 1):
  // 기존 nameEn? 정착물 (6 files: useArtworkStore / ArtworkFormDrawer / ...)
  // 무변경 보장 — nameEn 값 그대로 chain 흡수. 운영자 form 의 "작가 영문명"
  // 입력 데이터 손실 0.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 7,
    label: "getArtistName_legacy_nameEn_fallback_c1_parallel",
    description: "nameI18n 전체 부재 + 기존 nameEn? 존재 → nameEn 반환 (옵션 c1 병행 호환)",
    run: () => {
      const artist = baseArtist({
        name: "김지은",
        nameEn: "Jieun Kim",
        // nameI18n 미정의 (overrides 미지정) → 옵션 c1 병행 호환 검증
      });
      assertEqual(artist.nameI18n, undefined, "scenario7.nameI18n_undefined");
      assertEqual(artist.nameEn, "Jieun Kim", "scenario7.nameEn_present");
      // chain: nameI18n[en] (없음) → nameI18n.en (없음) → nameEn → "Jieun Kim"
      assertEqual(getArtistName(artist, "en"), "Jieun Kim", "scenario7.en_to_nameEn");
      // 다른 locale 도 동일 chain — nameEn 까지 도달
      assertEqual(getArtistName(artist, "ja"), "Jieun Kim", "scenario7.ja_to_nameEn");
      assertEqual(getArtistName(artist, "zh"), "Jieun Kim", "scenario7.zh_to_nameEn");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §8 — getArtistName: nameI18n + nameEn 모두 부재 → name (required) 반환
  // backward compat 최종 단계 — chain 전 단계 부재 시 한국어 원문 그대로.
  // 기존 데이터 (Phase 1 ~ STEP 129) 의 일부 artist (nameEn 도 미입력)
  // 호환 보장.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 8,
    label: "getArtistName_primary_name_fallback",
    description: "nameI18n + nameEn 모두 부재 시 primary name 필드 반환 (최종 fallback)",
    run: () => {
      const artist = baseArtist({ name: "김지은" });
      // nameI18n, nameEn 모두 미정의 (overrides 미지정)
      assertEqual(artist.nameI18n, undefined, "scenario8.nameI18n_undefined");
      assertEqual(artist.nameEn, undefined, "scenario8.nameEn_undefined");
      // chain 전 단계 부재 → name 반환
      assertEqual(getArtistName(artist, "en"), "김지은", "scenario8.en_to_primary");
      assertEqual(getArtistName(artist, "ja"), "김지은", "scenario8.ja_to_primary");
      assertEqual(getArtistName(artist, "zh"), "김지은", "scenario8.zh_to_primary");
      assertEqual(getArtistName(artist, "ko"), "김지은", "scenario8.ko_to_primary");
    },
  },
];

// ============================================================================
// Runner
// ============================================================================

export function runAllScenarios(): ScenarioRunResult {
  const failures: ScenarioRunResult["failures"] = [];
  let passed = 0;

  for (const sc of SCENARIOS) {
    try {
      sc.run();
      passed++;
    } catch (err) {
      failures.push({
        id: sc.id,
        label: sc.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = SCENARIOS.length - passed;
  return {
    total: SCENARIOS.length,
    passed,
    failed,
    failures,
    summary: `${passed}/${SCENARIOS.length} passed${failed > 0 ? ` (${failed} failed)` : ""}`,
  };
}
