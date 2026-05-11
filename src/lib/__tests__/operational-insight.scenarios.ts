// ============================================================================
// operational-insight.scenarios.ts — STEP 92 Test Scenarios
//
// **본 module이 무엇인가**:
//   사용자 spec 6 categories + 결정성 + honest signal 검증. STEP 90의
//   `fiscal-derive.scenarios.ts` 패턴 정확 답습 (inline assert helpers + self-
//   runnable runner, 외부 test 라이브러리 0개).
//
// **검증 covered**:
//   §1 Inquiry Trends — increase / decrease / steady / repeated contacts
//   §2 Save Patterns — repeated engagement detection
//   §3 Artist Activity — top ranking / direction
//   §4 Settlement Analytics — timing / delayed signal
//   §5 Transaction Funnel — conversion rates
//   §6 Gallery Activity — spike detection / repeat interactions
//   결정성    — same input → same output
//   honest    — insufficient data → "insufficient" (not fake numbers)
//
// **사용 방법**:
//   ```
//   npx tsx -e "import {runAllScenarios} from './src/lib/__tests__/operational-insight.scenarios'; console.log(runAllScenarios().summary);"
//   ```
// ============================================================================

import {
  deriveOperationalInsightSnapshot,
  type InsightPeriod,
} from "@/lib/operational-insight";
import { generateInsightSummary } from "@/lib/operational-insight-summary";
import type { Artwork } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type { Settlement } from "@/types/settlement";

// ============================================================================
// Tiny assert helpers — *no external library* (STEP 90 패턴 답습)
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalInsightAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertGte(actual: number, expected: number, label: string): void {
  if (actual < expected) {
    throw new AssertionError(
      `[${label}] expected >= ${expected} but got ${actual}`
    );
  }
}

function assertContainsString(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      `[${label}] string "${haystack}" does not contain "${needle}"`
    );
  }
}

// ============================================================================
// Fixture builders — minimal entity shapes (deterministic timestamps)
// ============================================================================

const NOW = "2026-05-07T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const DAY = 86_400_000;

function daysAgo(n: number): string {
  return new Date(NOW_MS - n * DAY).toISOString();
}

function fxArtwork(overrides: Partial<Artwork> & { artistName?: string } = {}): Artwork {
  const { artistName, ...rest } = overrides;
  return {
    id: "art-1",
    axid: { code: "AXV-2026-0001", scannedAt: NOW },
    title: "Sample Artwork",
    artist: { id: "artist-x", name: artistName ?? "Artist X" },
    year: 2024,
    medium: "oil on canvas",
    dimensions: "100×80 cm",
    priceKRW: 1_000_000,
    state: "AVAILABLE",
    thumbnailColor: "#cccccc",
    inquiryCount: 0,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
    ...rest,
  } as Artwork;
}

function fxInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: "inq-x",
    artworkId: "art-1",
    collectorName: "",
    contact: "[email protected]",
    inquiryType: "PRICE",
    message: "interest",
    source: "WEBSITE",
    status: "OPEN",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    ...overrides,
  } as Inquiry;
}

function fxTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-x",
    artworkId: "art-1",
    inquiryId: "inq-x",
    status: "NEGOTIATING",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    ...overrides,
  } as unknown as Transaction;
}

function fxSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: "set-x",
    transactionId: "tx-x",
    artworkId: "art-1",
    totalAmount: 1_000_000,
    artistShare: 600_000,
    galleryShare: 400_000,
    currency: "KRW",
    status: "PENDING",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    ...overrides,
  };
}

// ============================================================================
// Scenarios
// ============================================================================

export interface InsightScenario {
  id: number;
  label: string;
  description: string;
  run: () => void;
}

export const SCENARIOS: readonly InsightScenario[] = [
  // §1 Inquiry Trends — increase
  {
    id: 1,
    label: "§1 Inquiry — increase direction",
    description:
      "현재 14일 8건 vs 직전 14일 2건 → direction increase + observations에 \"증가\"",
    run: () => {
      const inquiries: Inquiry[] = [
        ...Array.from({ length: 8 }, (_, i) =>
          fxInquiry({
            id: `inq-cur-${i}`,
            createdAt: daysAgo(1 + i),
            contact: `c${i}@x.com`,
          })
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          fxInquiry({
            id: `inq-prev-${i}`,
            createdAt: daysAgo(16 + i),
            contact: `p${i}@x.com`,
          })
        ),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertEqual(snap.inquiry.direction, "increase", "s1.direction");
      assertEqual(snap.inquiry.currentCount, 8, "s1.current");
      assertEqual(snap.inquiry.previousCount, 2, "s1.previous");
      const sum = generateInsightSummary(snap);
      assertContainsString(sum.categories.inquiry.headline, "증가", "s1.headline");
    },
  },

  // §1 Inquiry Trends — decrease
  {
    id: 2,
    label: "§1 Inquiry — decrease direction",
    description: "현재 2건 vs 직전 8건 → direction decrease",
    run: () => {
      const inquiries: Inquiry[] = [
        ...Array.from({ length: 2 }, (_, i) =>
          fxInquiry({
            id: `inq-cur-${i}`,
            createdAt: daysAgo(1 + i),
            contact: `c${i}@x.com`,
          })
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          fxInquiry({
            id: `inq-prev-${i}`,
            createdAt: daysAgo(16 + i),
            contact: `p${i}@x.com`,
          })
        ),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertEqual(snap.inquiry.direction, "decrease", "s2.direction");
      const sum = generateInsightSummary(snap);
      assertContainsString(sum.categories.inquiry.headline, "감소", "s2.headline");
    },
  },

  // §1 Inquiry — repeated contacts (same contact + same artwork ≥ 2)
  {
    id: 3,
    label: "§1 Inquiry — repeated contacts pattern",
    description: "동일 collector × 동일 artwork ≥ 2회 inquiry → repeatedContacts > 0",
    run: () => {
      const inquiries: Inquiry[] = [
        fxInquiry({ id: "i1", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(1) }),
        fxInquiry({ id: "i2", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(3) }),
        fxInquiry({ id: "i3", contact: "[email protected]", artworkId: "art-2", createdAt: daysAgo(5) }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork(), fxArtwork({ id: "art-2", title: "Other" })],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertGte(snap.inquiry.repeatedContacts, 1, "s3.repeated");
    },
  },

  // §2 Save Patterns — repeated engagement
  {
    id: 4,
    label: "§2 Save — repeated engagement detected",
    description: "동일 collector × 동일 artwork ≥ 2회 → repeatedEngagementCount > 0",
    run: () => {
      const inquiries: Inquiry[] = [
        fxInquiry({ id: "i1", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(1) }),
        fxInquiry({ id: "i2", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(3) }),
        fxInquiry({ id: "i3", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(5) }),
        fxInquiry({ id: "i4", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(7) }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertGte(snap.save.repeatedEngagementCount, 1, "s4.engagement");
      assertEqual(snap.save.saveTrackingUnavailable, true, "s4.honest");
      const sum = generateInsightSummary(snap);
      assertContainsString(sum.categories.save.headline, "반복 engagement", "s4.headline");
    },
  },

  // §3 Artist Activity — top ranking
  {
    id: 5,
    label: "§3 Artist — top activity ranking",
    description: "Artist Y 5건 + Artist Z 2건 → topArtists[0].label === 'Artist Y'",
    run: () => {
      const artworks: Artwork[] = [
        fxArtwork({ id: "art-y1", artistName: "Artist Y" }),
        fxArtwork({ id: "art-z1", artistName: "Artist Z" }),
      ];
      const inquiries: Inquiry[] = [
        ...Array.from({ length: 5 }, (_, i) =>
          fxInquiry({
            id: `iy-${i}`,
            artworkId: "art-y1",
            contact: `cy${i}@x.com`,
            createdAt: daysAgo(1 + i),
          })
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          fxInquiry({
            id: `iz-${i}`,
            artworkId: "art-z1",
            contact: `cz${i}@x.com`,
            createdAt: daysAgo(1 + i),
          })
        ),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks,
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertGte(snap.artist.topArtists.length, 1, "s5.toplen");
      assertEqual(snap.artist.topArtists[0].label, "Artist Y", "s5.topartist");
    },
  },

  // §4 Settlement Analytics — delayed signal
  {
    id: 6,
    label: "§4 Settlement — delayed signal (30+ days PENDING)",
    description: "PENDING settlement 35일 전 createdAt → delayedCount > 0",
    run: () => {
      const settlements: Settlement[] = [
        fxSettlement({
          id: "set-old",
          status: "PENDING",
          createdAt: daysAgo(35),
          updatedAt: daysAgo(35),
        }),
        fxSettlement({
          id: "set-fresh",
          status: "COMPLETED",
          createdAt: daysAgo(5),
          settledAt: daysAgo(2),
          updatedAt: daysAgo(2),
        }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries: [],
        transactions: [],
        settlements,
        period: "30d",
        now: NOW,
      });
      assertGte(snap.settlement.delayedCount, 1, "s6.delayed");
      const sum = generateInsightSummary(snap);
      assertContainsString(sum.categories.settlement.headline, "지연", "s6.headline");
      assertEqual(sum.categories.settlement.significance, "high", "s6.high");
    },
  },

  // §4 Settlement — avg timing
  {
    id: 7,
    label: "§4 Settlement — average timing calculation",
    description: "createdAt → settledAt 5일 settlement 2건 → avgDaysToSettle == 5",
    run: () => {
      const settlements: Settlement[] = [
        fxSettlement({
          id: "s1",
          status: "COMPLETED",
          createdAt: daysAgo(10),
          settledAt: daysAgo(5),
        }),
        fxSettlement({
          id: "s2",
          status: "COMPLETED",
          createdAt: daysAgo(8),
          settledAt: daysAgo(3),
        }),
        fxSettlement({
          id: "s3",
          status: "COMPLETED",
          createdAt: daysAgo(6),
          settledAt: daysAgo(1),
        }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries: [],
        transactions: [],
        settlements,
        period: "14d",
        now: NOW,
      });
      // 모두 5일이므로 avg == 5 (epsilon 회피하기 위해 정확한 정수)
      assertEqual(snap.settlement.avgDaysToSettle, 5, "s7.avg");
      assertEqual(snap.settlement.completedCount, 3, "s7.completed");
    },
  },

  // §5 Transaction Funnel — conversion
  {
    id: 8,
    label: "§5 Funnel — inquiry → hold → settlement conversion",
    description:
      "10 inquiry → 4 HOLD → 2 settled → inquiryToHoldRate 0.4 + holdToSettlementRate 0.5",
    run: () => {
      const inquiries: Inquiry[] = Array.from({ length: 10 }, (_, i) =>
        fxInquiry({
          id: `i${i}`,
          contact: `c${i}@x.com`,
          createdAt: daysAgo(1 + i),
        })
      );
      const transactions: Transaction[] = Array.from({ length: 4 }, (_, i) =>
        fxTransaction({
          id: `t${i}`,
          inquiryId: `i${i}`,
          status: i < 2 ? "PAID" : "NEGOTIATING",
          createdAt: daysAgo(2 + i),
        })
      );
      const settlements: Settlement[] = Array.from({ length: 2 }, (_, i) =>
        fxSettlement({
          id: `s${i}`,
          status: "COMPLETED",
          createdAt: daysAgo(3 + i),
          settledAt: daysAgo(1 + i),
        })
      );
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries,
        transactions,
        settlements,
        period: "14d",
        now: NOW,
      });
      assertEqual(snap.funnel.inquiryCount, 10, "s8.inq");
      assertEqual(snap.funnel.holdCount, 4, "s8.hold");
      assertEqual(snap.funnel.paidCount, 2, "s8.paid");
      assertEqual(snap.funnel.settledCount, 2, "s8.set");
      assertEqual(snap.funnel.inquiryToHoldRate, 0.4, "s8.r1");
      assertEqual(snap.funnel.holdToSettlementRate, 0.5, "s8.r2");
    },
  },

  // §6 Gallery Activity — spike detection
  {
    id: 9,
    label: "§6 Activity — spike detection",
    description: "단일 day 10건 + 다른 day 1건씩 → spikeDetected true",
    run: () => {
      const inquiries: Inquiry[] = [
        // Spike day: 10건 in same day (3일 전)
        ...Array.from({ length: 10 }, (_, i) =>
          fxInquiry({
            id: `spike-${i}`,
            contact: `s${i}@x.com`,
            createdAt: new Date(NOW_MS - 3 * DAY + i * 1000).toISOString(),
          })
        ),
        // Other days: 1건씩
        fxInquiry({
          id: "o1",
          contact: "[email protected]",
          createdAt: daysAgo(5),
        }),
        fxInquiry({
          id: "o2",
          contact: "[email protected]",
          createdAt: daysAgo(7),
        }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertEqual(snap.activity.spikeDetected, true, "s9.spike");
      const sum = generateInsightSummary(snap);
      assertContainsString(sum.categories.activity.headline, "burst", "s9.headline");
    },
  },

  // §6 Activity — repeat interaction collectors
  {
    id: 10,
    label: "§6 Activity — repeat interaction collectors",
    description: "동일 collector × 다른 artwork 둘 이상 → repeatInteractionCollectors > 0",
    run: () => {
      const inquiries: Inquiry[] = [
        fxInquiry({ id: "i1", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(1) }),
        fxInquiry({ id: "i2", contact: "[email protected]", artworkId: "art-2", createdAt: daysAgo(3) }),
        fxInquiry({ id: "i3", contact: "[email protected]", artworkId: "art-1", createdAt: daysAgo(5) }),
      ];
      const snap = deriveOperationalInsightSnapshot({
        artworks: [
          fxArtwork(),
          fxArtwork({ id: "art-2", title: "Other" }),
        ],
        inquiries,
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertGte(snap.activity.repeatInteractionCollectors, 1, "s10.repeat");
      assertEqual(snap.activity.trafficTrackingUnavailable, true, "s10.honest");
    },
  },

  // Insufficient data — honest signal (no fake confidence)
  {
    id: 11,
    label: "Honest signal — insufficient data",
    description:
      "0 inquiries / 0 transactions / 0 settlements → 모든 카테고리 insufficient or empty",
    run: () => {
      const snap = deriveOperationalInsightSnapshot({
        artworks: [fxArtwork()],
        inquiries: [],
        transactions: [],
        settlements: [],
        period: "14d",
        now: NOW,
      });
      assertEqual(snap.inquiry.direction, "insufficient", "s11.inq");
      assertEqual(snap.settlement.insufficient, true, "s11.set");
      assertEqual(snap.funnel.insufficient, true, "s11.fun");

      const sum = generateInsightSummary(snap);
      // 모든 sufficient-가짜-숫자 회피 - significance 'noise' 또는 'low' 표시
      assertContainsString(
        sum.categories.inquiry.headline,
        "데이터가 충분하지 않습니다",
        "s11.honest-headline"
      );
    },
  },

  // Determinism — same input → same output
  {
    id: 12,
    label: "Determinism — same input → same output",
    description: "동일 입력으로 두 번 호출 → JSON.stringify 결과 완전 일치",
    run: () => {
      const inquiries: Inquiry[] = [
        fxInquiry({ id: "i1", contact: "[email protected]", createdAt: daysAgo(2) }),
        fxInquiry({ id: "i2", contact: "[email protected]", createdAt: daysAgo(4) }),
        fxInquiry({ id: "i3", contact: "[email protected]", createdAt: daysAgo(6) }),
      ];
      const input = {
        artworks: [fxArtwork()],
        inquiries,
        transactions: [] as Transaction[],
        settlements: [] as Settlement[],
        period: "14d" as InsightPeriod,
        now: NOW,
      };
      const a = generateInsightSummary(deriveOperationalInsightSnapshot(input));
      const b = generateInsightSummary(deriveOperationalInsightSnapshot(input));
      assertEqual(JSON.stringify(a), JSON.stringify(b), "s12.deterministic");
    },
  },
] as const;

// ============================================================================
// Runner (STEP 90 패턴 정확 답습)
// ============================================================================

export interface ScenarioRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: number; label: string; error: string }>;
  summary: string;
}

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
