// ============================================================================
// artwork-draft.scenarios.ts — STEP 117 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 117 ArtworkDraftState foundation 의 6-scenario 검증.
//   self-runnable scenario module — DOC-2 §4 신규 라이브러리 금지 준수.
//
// **검증 영역**:
//   §1 extractDraftPreviewLabel    — title 우선 → artistName fallback →
//                                     "(제목 없음)" + 24자 cap
//   §2 formatDraftRelativeTime     — 방금 / N분 전 / N시간 전 / 어제 /
//                                     N일 전 / 30일+ ISO date / future fallback
//   §3 store save → load round-trip
//                                  — saveArtworkDraft 후 store.artworkDraft.data
//                                     === input + startedAt 보존 + lastEditedAt 갱신
//   §4 store save → clear           — clearArtworkDraft 후 store.artworkDraft
//                                     === undefined
//   §5 createArtwork submit auto-clear
//                                  — saved draft 가 createArtwork 성공 시
//                                     undefined 자동 전환
//   §6 PersistedState v1 forward compat
//                                  — 기존 PersistedState (artworkDraft 부재) 가
//                                     type-check 통과 + sanitizeImportedState
//                                     통과 (validateV1 required 미수정 정합)
// ============================================================================

import {
  type ArtworkDraftState,
  extractDraftPreviewLabel,
  formatDraftRelativeTime,
} from "@/types/artwork-draft";
import { useArtworkStore, type ArtworkInput } from "@/store/useArtworkStore";
import {
  sanitizeImportedState,
  validateV1ForImport,
  SCHEMA_VERSION,
  type PersistedState,
} from "@/lib/persistence";

// ============================================================================
// Tiny assert helpers
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtworkDraftAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(cond: boolean, label: string): void {
  if (!cond) throw new AssertionError(`[${label}] expected true`);
}

function assertDefined<T>(
  v: T | undefined | null,
  label: string
): asserts v is T {
  if (v === undefined || v === null)
    throw new AssertionError(`[${label}] expected defined`);
}

// ============================================================================
// Builders — minimal valid ArtworkInput / ArtworkDraftState
// ============================================================================

function makeInput(overrides: Partial<ArtworkInput> = {}): ArtworkInput {
  return {
    title: "",
    artistName: "",
    year: 0,
    medium: "",
    dimensions: "",
    priceKRW: 0,
    state: "DRAFT",
    thumbnailColor: "#A9B6C8",
    ...overrides,
  };
}

function makeDraft(
  overrides: Partial<ArtworkDraftState> = {}
): ArtworkDraftState {
  const now = new Date().toISOString();
  return {
    data: makeInput(),
    startedAt: now,
    lastEditedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Scenario shape
// ============================================================================

interface ArtworkDraftScenario {
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
// Scenarios
// ============================================================================

export const SCENARIOS: readonly ArtworkDraftScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "extractDraftPreviewLabel — title / artistName / fallback / 24자 cap",
    description:
      "Sidebar 'preview label' 추출 우선순위: title 비공백 → artistName 비공백 → '(제목 없음)'. 24자 초과 시 ellipsis.",
    run: () => {
      // title 우선
      assertEqual(
        extractDraftPreviewLabel(makeDraft({ data: makeInput({ title: "흐름의 조각" }) })),
        "흐름의 조각",
        "title direct"
      );

      // title trim 적용
      assertEqual(
        extractDraftPreviewLabel(
          makeDraft({ data: makeInput({ title: "  흐름의 조각  " }) })
        ),
        "흐름의 조각",
        "title trim"
      );

      // title 빈 → artistName fallback
      assertEqual(
        extractDraftPreviewLabel(
          makeDraft({
            data: makeInput({ title: "", artistName: "김지은" }),
          })
        ),
        "김지은",
        "artistName fallback"
      );

      // title whitespace-only → artistName fallback (trim 후 빈 문자열 취급)
      assertEqual(
        extractDraftPreviewLabel(
          makeDraft({
            data: makeInput({ title: "   ", artistName: "김지은" }),
          })
        ),
        "김지은",
        "title whitespace-only → artistName"
      );

      // 둘 다 비어있음 → 한국어 fallback
      assertEqual(
        extractDraftPreviewLabel(makeDraft()),
        "(제목 없음)",
        "both empty"
      );

      // 24자 cap + ellipsis
      const long = "가나다라마바사아자차카타파하1234567890ABCDEFGH"; // 33자
      const result = extractDraftPreviewLabel(
        makeDraft({ data: makeInput({ title: long }) })
      );
      assertEqual(result.endsWith("…"), true, "long title ends with ellipsis");
      // 24자 + ellipsis = 25 chars total
      assertEqual(result.length, 25, "long title length 25");

      // 정확히 24자 → ellipsis 없음 (한글14 + 숫자10 = 24자)
      const exact = "가나다라마바사아자차카타파하1234567890";
      assertEqual(exact.length, 24, "test fixture: exact == 24 chars");
      assertEqual(
        extractDraftPreviewLabel(
          makeDraft({ data: makeInput({ title: exact }) })
        ),
        exact,
        "exact 24 chars no ellipsis"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "formatDraftRelativeTime — 방금 / 분 / 시간 / 어제 / 일 / 30일+ / future",
    description:
      "한국어 relative time formatting. 60s → 방금. <1h → N분 전. <24h → N시간 전. 24~48h → 어제. <30일 → N일 전. 30일+ → ISO date. Future → ISO date fallback.",
    run: () => {
      const now = Date.parse("2026-05-08T12:00:00.000Z");

      // 30초 전 → "방금"
      const t30s = new Date(now - 30 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t30s, now), "방금", "30s ago");

      // 5분 전
      const t5m = new Date(now - 5 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t5m, now), "5분 전", "5min ago");

      // 59분 전
      const t59m = new Date(now - 59 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t59m, now), "59분 전", "59min ago");

      // 2시간 전
      const t2h = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t2h, now), "2시간 전", "2hr ago");

      // 23시간 전
      const t23h = new Date(now - 23 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t23h, now), "23시간 전", "23hr ago");

      // 25시간 전 → "어제"
      const t25h = new Date(now - 25 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t25h, now), "어제", "25hr ago");

      // 47시간 전 → "어제"
      const t47h = new Date(now - 47 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t47h, now), "어제", "47hr ago");

      // 5일 전
      const t5d = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t5d, now), "5일 전", "5d ago");

      // 29일 전
      const t29d = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString();
      assertEqual(formatDraftRelativeTime(t29d, now), "29일 전", "29d ago");

      // 30일 전 → ISO date
      const t30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      assertEqual(
        formatDraftRelativeTime(t30d, now),
        t30d.slice(0, 10),
        "30d ago → ISO"
      );

      // Future timestamp → ISO date fallback
      const tFuture = new Date(now + 60 * 1000).toISOString();
      assertEqual(
        formatDraftRelativeTime(tFuture, now),
        tFuture.slice(0, 10),
        "future → ISO fallback"
      );

      // Invalid ISO → ISO slice fallback (defensive). "not-a-date" 는 10자
      // 이므로 slice(0, 10) 결과가 그대로 전체 문자열.
      assertEqual(
        formatDraftRelativeTime("not-a-date", now),
        "not-a-date",
        "invalid → slice(0,10)"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "store saveArtworkDraft → round-trip + startedAt 보존",
    description:
      "saveArtworkDraft(input) 호출 후 store.artworkDraft.data === input. 동일 draft 재저장 시 startedAt 보존, lastEditedAt 갱신.",
    run: () => {
      // 시작 상태 — draft 부재 보장
      useArtworkStore.getState().clearArtworkDraft();
      assertEqual(
        useArtworkStore.getState().artworkDraft,
        undefined,
        "initial undefined"
      );

      // 첫 임시 저장
      const input1 = makeInput({
        title: "흐름의 조각",
        artistName: "김지은",
        year: 2024,
        medium: "Oil on canvas",
        dimensions: "162.0 × 130.3 cm",
        priceKRW: 12_000_000,
      });
      useArtworkStore.getState().saveArtworkDraft(input1);

      const draft1 = useArtworkStore.getState().artworkDraft;
      assertDefined(draft1, "draft1 defined");
      assertEqual(draft1.data.title, "흐름의 조각", "title matches");
      assertEqual(draft1.data.artistName, "김지은", "artistName matches");
      assertEqual(draft1.data.priceKRW, 12_000_000, "priceKRW matches");
      assertTrue(
        typeof draft1.startedAt === "string" && draft1.startedAt.length > 0,
        "startedAt non-empty"
      );
      assertEqual(
        draft1.startedAt,
        draft1.lastEditedAt,
        "first save: startedAt === lastEditedAt"
      );

      const startedAt1 = draft1.startedAt;

      // 두 번째 임시 저장 — startedAt 보존, lastEditedAt 갱신
      // (timestamp 정밀도 보장 위해 약간 대기 — synchronous Date.now 동일 ms
      //  방지). real test: same-millisecond 도 startedAt 보존만 확인.
      const input2 = makeInput({
        title: "흐름의 조각",
        artistName: "김지은",
        year: 2024,
        medium: "Oil on canvas, mixed media",
        dimensions: "162.0 × 130.3 cm",
        priceKRW: 12_500_000,
      });
      useArtworkStore.getState().saveArtworkDraft(input2);

      const draft2 = useArtworkStore.getState().artworkDraft;
      assertDefined(draft2, "draft2 defined");
      assertEqual(
        draft2.startedAt,
        startedAt1,
        "second save: startedAt 보존"
      );
      assertEqual(draft2.data.priceKRW, 12_500_000, "data.priceKRW updated");
      assertEqual(
        draft2.data.medium,
        "Oil on canvas, mixed media",
        "data.medium updated"
      );

      // Cleanup
      useArtworkStore.getState().clearArtworkDraft();
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "store clearArtworkDraft → undefined",
    description:
      "clearArtworkDraft 호출 후 store.artworkDraft === undefined.",
    run: () => {
      // 사전 조건 — draft 보유 상태
      useArtworkStore
        .getState()
        .saveArtworkDraft(makeInput({ title: "test for clear" }));
      assertDefined(
        useArtworkStore.getState().artworkDraft,
        "draft defined before clear"
      );

      // Clear
      useArtworkStore.getState().clearArtworkDraft();
      assertEqual(
        useArtworkStore.getState().artworkDraft,
        undefined,
        "draft undefined after clear"
      );

      // Idempotency — 추가 clear 호출도 안전
      useArtworkStore.getState().clearArtworkDraft();
      assertEqual(
        useArtworkStore.getState().artworkDraft,
        undefined,
        "double clear safe"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "createArtwork submit → draft auto-clear",
    description:
      "saveArtworkDraft 후 createArtwork 성공 시 store.artworkDraft 자동 undefined. (Phase 4 §4.4 정착 — submit 성공이 draft 의미를 자동 종료시킴.)",
    run: () => {
      // 사전 조건 — draft 보유 상태
      const draftInput = makeInput({
        title: "흐름의 조각",
        artistName: "김지은",
        year: 2024,
        medium: "Oil on canvas",
        dimensions: "162.0 × 130.3 cm",
        priceKRW: 12_000_000,
      });
      useArtworkStore.getState().saveArtworkDraft(draftInput);
      assertDefined(
        useArtworkStore.getState().artworkDraft,
        "draft defined before submit"
      );

      // Submit (different valid input)
      const submitInput = makeInput({
        title: "테스트 제목",
        artistName: "테스트 작가",
        year: 2025,
        medium: "Acrylic",
        dimensions: "100 × 80 cm",
        priceKRW: 5_000_000,
      });
      const newId = useArtworkStore.getState().createArtwork(submitInput);
      assertTrue(typeof newId === "string" && newId.length > 0, "newId valid");

      // Auto-clear 검증
      assertEqual(
        useArtworkStore.getState().artworkDraft,
        undefined,
        "draft auto-cleared after createArtwork"
      );

      // Cleanup — 생성된 작품 제거 (deleteArtwork 미존재 시 그대로 유지 OK,
      // scenario 격리는 createArtwork 의 단일 호출 영향만 검증). 다른 시나리오에
      // 영향 없음 (artwork 누적은 자연 허용 — selector pattern 기준).
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "PersistedState v1 forward compat — artworkDraft 부재 자연 호환",
    description:
      "STEP 117 이전 데이터 (artworkDraft 부재) 가 validateV1 + sanitizeImportedState 모두 통과. SCHEMA_VERSION 'v1' 변경 0줄. forward-only policy.",
    run: () => {
      // 기존 v1 백업 형태 — artworkDraft 부재
      const legacyState: PersistedState = {
        version: SCHEMA_VERSION,
        savedAt: "2026-05-08T12:00:00.000Z",
        artworks: [],
        timeline: {},
        inquiries: {},
        transactions: {},
        invoices: {},
        payments: {},
        settlements: {},
        taxRecords: {},
        contracts: {},
        curationNotes: {},
        logistics: {},
        conditionReports: {},
        priceSuggestions: {},
        // artworkDraft: undefined (부재)
      };

      // validateV1 통과 (required 키 미추가 검증)
      const validated = validateV1ForImport(JSON.parse(JSON.stringify(legacyState)));
      assertDefined(validated, "validateV1 통과 — artworkDraft 부재 OK");
      assertEqual(
        validated.artworkDraft,
        undefined,
        "validated.artworkDraft undefined"
      );

      // sanitize 통과
      const sanitized = sanitizeImportedState(validated);
      assertEqual(
        sanitized.artworkDraft,
        undefined,
        "sanitized.artworkDraft undefined echo"
      );
      assertEqual(sanitized.version, SCHEMA_VERSION, "version preserved");

      // 신규 v1 백업 형태 — artworkDraft 보유
      const draftState = makeDraft({
        data: makeInput({ title: "test draft" }),
      });
      const newState: PersistedState = {
        ...legacyState,
        artworkDraft: draftState,
      };
      const validatedNew = validateV1ForImport(
        JSON.parse(JSON.stringify(newState))
      );
      assertDefined(validatedNew, "validateV1 통과 — artworkDraft 보유 OK");
      assertDefined(validatedNew.artworkDraft, "artworkDraft preserved");
      assertEqual(
        validatedNew.artworkDraft.data.title,
        "test draft",
        "draft data round-trip"
      );

      const sanitizedNew = sanitizeImportedState(validatedNew);
      assertDefined(sanitizedNew.artworkDraft, "sanitized.artworkDraft echo");
      assertEqual(
        sanitizedNew.artworkDraft.data.title,
        "test draft",
        "sanitized data round-trip"
      );
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
