import type { Artwork, TimelineEvent } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Settlement } from "@/types/settlement";
import type { TaxRecord } from "@/types/tax";
import type { Contract } from "@/types/contract";
import type { CurationNote } from "@/types/curation";
import type { Logistics } from "@/types/logistics";
import type { ConditionReport } from "@/types/condition-report";

// ============================================================================
// Artworks
// inquiryCount mirrors the seeded MOCK_INQUIRIES below.
// ============================================================================

export const MOCK_ARTWORKS: Artwork[] = [
  {
    id: "art_001",
    axid: { code: "AXV-2025-0001", issuedAt: "2025-03-12" },
    title: "무제, 푸른 정원",
    artist: { id: "ar_01", name: "김지은", nameEn: "Jieun Kim" },
    year: 2024,
    medium: "Oil on canvas",
    dimensions: "162.0 × 130.3 cm",
    priceKRW: 28_000_000,
    state: "READY",
    thumbnailColor: "#A9B6C8",
    inquiryCount: 0,
    updatedAt: "2026-04-28T10:21:00+09:00",
  },
  {
    id: "art_002",
    axid: { code: "AXV-2025-0002", issuedAt: "2025-03-14" },
    title: "Stratum no. 7",
    artist: { id: "ar_02", name: "박현우", nameEn: "Hyunwoo Park" },
    year: 2023,
    medium: "Acrylic, gesso on linen",
    dimensions: "200.0 × 150.0 cm",
    priceKRW: 42_500_000,
    state: "INQUIRY",
    thumbnailColor: "#C9C2B5",
    inquiryCount: 2,
    updatedAt: "2026-05-01T16:02:00+09:00",
  },
  {
    id: "art_003",
    axid: { code: "AXV-2025-0003", issuedAt: "2025-03-20" },
    title: "흐름의 조각",
    artist: { id: "ar_03", name: "이서연", nameEn: "Seoyeon Lee" },
    year: 2024,
    medium: "Bronze",
    dimensions: "55 × 30 × 28 cm",
    priceKRW: 18_000_000,
    state: "DEAL",
    thumbnailColor: "#7A6E5D",
    inquiryCount: 1,
    updatedAt: "2026-05-02T09:14:00+09:00",
  },
  {
    id: "art_004",
    axid: { code: "AXV-2024-0118", issuedAt: "2024-11-02" },
    title: "Quiet Field II",
    artist: { id: "ar_04", name: "정민호", nameEn: "Minho Jung" },
    year: 2023,
    medium: "Mixed media on paper",
    dimensions: "76 × 56 cm",
    priceKRW: 6_400_000,
    state: "PAID",
    thumbnailColor: "#D8D4CB",
    inquiryCount: 1,
    updatedAt: "2026-04-21T18:40:00+09:00",
  },
  {
    id: "art_005",
    axid: { code: "AXV-2024-0079", issuedAt: "2024-08-15" },
    title: "백자 — 달의 형태",
    artist: { id: "ar_05", name: "최아름", nameEn: "Areum Choi" },
    year: 2022,
    medium: "Porcelain",
    dimensions: "Ø 38 × H 42 cm",
    priceKRW: 9_800_000,
    state: "CLOSED",
    thumbnailColor: "#EFEAE1",
    inquiryCount: 1,
    updatedAt: "2026-02-08T11:00:00+09:00",
  },
  {
    id: "art_006",
    axid: { code: "AXV-2025-0004", issuedAt: "2025-04-01" },
    title: "검은 수면 위의 빛",
    artist: { id: "ar_06", name: "한도윤", nameEn: "Doyun Han" },
    year: 2025,
    medium: "Oil and pigment on canvas",
    dimensions: "130.3 × 97.0 cm",
    priceKRW: 22_000_000,
    state: "DRAFT",
    thumbnailColor: "#3E3A35",
    inquiryCount: 0,
    updatedAt: "2026-05-03T08:02:00+09:00",
  },
  {
    id: "art_007",
    axid: { code: "AXV-2024-0211", issuedAt: "2024-12-17" },
    title: "Ridge Line",
    artist: { id: "ar_02", name: "박현우", nameEn: "Hyunwoo Park" },
    year: 2024,
    medium: "Acrylic on canvas",
    dimensions: "112.0 × 145.5 cm",
    priceKRW: 15_500_000,
    state: "BROKERED",
    thumbnailColor: "#9A8E7F",
    inquiryCount: 2,
    updatedAt: "2026-04-15T14:30:00+09:00",
  },
  {
    id: "art_008",
    axid: { code: "AXV-2025-0005", issuedAt: "2025-04-22" },
    title: "여름의 끝",
    artist: { id: "ar_07", name: "윤세라", nameEn: "Sera Yoon" },
    year: 2024,
    medium: "Watercolor on paper",
    dimensions: "42 × 56 cm",
    priceKRW: 3_200_000,
    state: "READY",
    thumbnailColor: "#E8DCC4",
    inquiryCount: 0,
    updatedAt: "2026-04-30T13:00:00+09:00",
  },
];

// ============================================================================
// Inquiries — keyed by artworkId, newest first within each list.
// ============================================================================

export const MOCK_INQUIRIES: Record<string, Inquiry[]> = {
  art_002: [
    {
      id: "inq_001",
      artworkId: "art_002",
      collectorName: "Sarah Lim",
      contact: "sarah.lim@example.com",
      inquiryType: "PRICE",
      message:
        "이 작품의 현재 가격과 배송 가능 일정이 궁금합니다. 컬렉션에 추가하기 전에 Condition Report를 받아볼 수 있을까요?",
      source: "WEBSITE",
      status: "OPEN",
      memo: "VIP 컬렉터. 지난 시즌 Park 작품 구매 이력. 5월 2주차 응대 우선.",
      createdAt: "2026-05-01T16:00:00+09:00",
      updatedAt: "2026-05-01T16:00:00+09:00",
    },
    {
      id: "inq_001b",
      artworkId: "art_002",
      collectorName: "강민정",
      contact: "minjung.kang@example.com",
      inquiryType: "VIEWING",
      message:
        "다가오는 페어 이후 스튜디오 방문이 가능할지 문의드립니다.",
      source: "EMAIL",
      status: "RESPONDED",
      memo: "응대 완료. 페어 후 일정 조율 예정.",
      createdAt: "2026-04-25T10:00:00+09:00",
      updatedAt: "2026-04-26T14:30:00+09:00",
    },
  ],
  art_003: [
    {
      id: "inq_002",
      artworkId: "art_003",
      collectorName: "리움 컬렉션",
      contact: "acquisition@leeum.example.com",
      inquiryType: "VIEWING",
      message:
        "기관 컬렉션 후보로 검토 중입니다. 실견 일정 조율 가능한지 확인 부탁드립니다.",
      source: "REFERRAL",
      status: "RESPONDED",
      memo: "실견 일정 5/7 14:00 확정. Curator 동행 예정.",
      transactionId: "tx_001", // sync layer (rule_13.5)
      createdAt: "2026-04-28T10:30:00+09:00",
      updatedAt: "2026-05-01T11:20:00+09:00",
    },
  ],
  art_004: [
    {
      id: "inq_003",
      artworkId: "art_004",
      collectorName: "김도현",
      contact: "+82-10-2345-6789",
      inquiryType: "GENERAL",
      message:
        "아트페어에서 인상 깊게 본 작품입니다. 구매 절차 안내 부탁드립니다.",
      source: "ART_FAIR",
      status: "CLOSED",
      memo: "거래 완료. 결제 처리됨.",
      transactionId: "tx_002", // sync layer (rule_13.5)
      createdAt: "2026-04-10T15:00:00+09:00",
      updatedAt: "2026-04-21T18:30:00+09:00",
    },
  ],
  art_005: [
    {
      id: "inq_004",
      artworkId: "art_005",
      collectorName: "박기훈",
      contact: "park.kihoon@example.com",
      inquiryType: "AVAILABILITY",
      message:
        "최아름 작가의 작품을 오랫동안 지켜봐 왔습니다. 구매 가능 여부 확인 부탁드립니다.",
      source: "EMAIL",
      status: "CLOSED",
      memo: "거래 종료 완료. 정산까지 정상 진행.",
      transactionId: "tx_003", // sync layer (rule_13.5)
      createdAt: "2026-01-12T10:00:00+09:00",
      updatedAt: "2026-02-08T11:00:00+09:00",
    },
  ],
  art_007: [
    // inq_006: auto-created RESALE inquiry at startResale() time (rule_13).
    // Empty collectorName — collector identity gets filled when an actual
    // buyer expresses interest. createdAt matches resale registration time.
    {
      id: "inq_006",
      artworkId: "art_007",
      collectorName: "",
      contact: "",
      inquiryType: "RESALE",
      message: "재판매 등록 — 신규 구매자 의사 미정. 응대 시 본 inquiry에 정보 기입.",
      source: "OTHER",
      status: "OPEN",
      memo: "이전 소유자: Initial Owner. 재판매 흐름의 시작점.",
      transactionId: "tx_005", // sync layer (rule_13.5) — active resale
      createdAt: "2026-04-15T14:30:00+09:00",
      updatedAt: "2026-04-15T14:30:00+09:00",
    },
    {
      id: "inq_005",
      artworkId: "art_007",
      collectorName: "Initial Owner",
      contact: "previous@owner.example",
      inquiryType: "GENERAL",
      message: "원소유자의 최초 구매 문의 기록.",
      source: "SHOWROOM",
      status: "CLOSED",
      memo: "원소유자. 재판매 결정 후 BROKERED 상태로 전환.",
      transactionId: "tx_004", // sync layer (rule_13.5) — historical, sync guarded
      createdAt: "2024-12-15T10:00:00+09:00",
      updatedAt: "2026-04-15T14:30:00+09:00",
    },
  ],
};

// ============================================================================
// Transactions — keyed by artworkId, newest first within each list.
// Seeded for artworks in DEAL+ states.
// ============================================================================

export const MOCK_TRANSACTIONS: Record<string, Transaction[]> = {
  art_003: [
    {
      id: "tx_001",
      artworkId: "art_003",
      inquiryId: "inq_002",
      buyerName: "리움 컬렉션",
      agreedPrice: 18_000_000,
      currency: "KRW",
      status: "AGREED",
      dealMemo:
        "기관 컬렉션 합의 완료. Invoice 5/8 발송 예정. Curator 입회 인수 일정 조율 중.",
      createdAt: "2026-05-02T09:14:00+09:00",
      updatedAt: "2026-05-02T11:30:00+09:00",
    },
  ],
  art_004: [
    {
      id: "tx_002",
      artworkId: "art_004",
      inquiryId: "inq_003",
      buyerName: "김도현",
      agreedPrice: 6_400_000,
      currency: "KRW",
      status: "PAID",
      dealMemo: "결제 수령 완료. 정산 단계 대기 중.",
      createdAt: "2026-04-15T14:00:00+09:00",
      updatedAt: "2026-04-21T18:40:00+09:00",
    },
  ],
  art_005: [
    {
      id: "tx_003",
      artworkId: "art_005",
      inquiryId: "inq_004",
      buyerName: "박기훈",
      agreedPrice: 9_800_000,
      currency: "KRW",
      status: "COMPLETED",
      dealMemo: "거래 종료, 정산 완료.",
      createdAt: "2026-01-25T10:00:00+09:00",
      updatedAt: "2026-02-08T11:00:00+09:00",
    },
  ],
  art_007: [
    // tx_005 (resale, NEGOTIATING) — 재판매 등록 후 새 흐름. 구매자 미정.
    // STEP 13 시드: 사용자가 art_005(CLOSED)에서 "재판매 등록"을 클릭해
    // 새 resale Transaction을 직접 생성하는 라이브 플로우와 별개로,
    // art_007은 이미 BROKERED 상태로 resale Transaction이 시드된 "after" 예시.
    {
      id: "tx_005",
      artworkId: "art_007",
      inquiryId: "inq_006",
      buyerName: "",
      agreedPrice: 15_500_000,
      currency: "KRW",
      status: "NEGOTIATING",
      dealMemo: "재판매 거래 — 이전 소유자: Initial Owner",
      createdAt: "2026-04-15T14:30:00+09:00",
      updatedAt: "2026-04-15T14:30:00+09:00",
      isResale: true,
      previousTransactionId: "tx_004",
      previousOwner: "Initial Owner",
      resaleCommissionRate: 0.15,
    },
    {
      id: "tx_004",
      artworkId: "art_007",
      inquiryId: "inq_005",
      buyerName: "Initial Owner",
      agreedPrice: 15_500_000,
      currency: "KRW",
      status: "COMPLETED",
      dealMemo:
        "원거래 종료. 재판매 등록 완료 (tx_005 신규 흐름 시작).",
      createdAt: "2024-12-20T10:00:00+09:00",
      updatedAt: "2025-01-10T15:00:00+09:00",
    },
  ],
};

// ============================================================================
// Invoices — keyed by transactionId (rule_11: Document is a child of Transaction)
// Seeded so each existing Transaction has a corresponding Invoice in a
// realistic state. Future runtime invoices are created by createInvoice() in
// the store on INQUIRY → DEAL.
// ============================================================================

export const MOCK_INVOICES: Record<string, Invoice[]> = {
  // tx_001 (AGREED, 리움 컬렉션) — invoice issued, awaiting payment
  tx_001: [
    {
      id: "inv_001",
      transactionId: "tx_001",
      amount: 18_000_000,
      currency: "KRW",
      status: "SENT",
      issuedAt: "2026-05-02T09:14:00+09:00",
      sentAt: "2026-05-02T16:20:00+09:00",
      version: 1,
      parentInvoiceId: null,
      lockedAt: "2026-05-02T16:20:00+09:00",
      isLocked: true,
    },
  ],
  // tx_002 (COMPLETED, 김도현) — invoice paid
  tx_002: [
    {
      id: "inv_002",
      transactionId: "tx_002",
      amount: 6_400_000,
      currency: "KRW",
      status: "PAID",
      issuedAt: "2026-04-15T14:00:00+09:00",
      sentAt: "2026-04-15T18:00:00+09:00",
      paidAt: "2026-04-21T18:40:00+09:00",
      version: 1,
      parentInvoiceId: null,
      lockedAt: "2026-04-15T18:00:00+09:00",
      isLocked: true,
    },
  ],
  // tx_003 (COMPLETED, 박기훈) — invoice paid
  tx_003: [
    {
      id: "inv_003",
      transactionId: "tx_003",
      amount: 9_800_000,
      currency: "KRW",
      status: "PAID",
      issuedAt: "2026-01-25T10:00:00+09:00",
      sentAt: "2026-01-25T15:30:00+09:00",
      paidAt: "2026-02-05T11:00:00+09:00",
      version: 1,
      parentInvoiceId: null,
      lockedAt: "2026-01-25T15:30:00+09:00",
      isLocked: true,
    },
  ],
  // tx_004 (original COMPLETED transaction for the BROKERED artwork) — paid
  tx_004: [
    {
      id: "inv_004",
      transactionId: "tx_004",
      amount: 15_500_000,
      currency: "KRW",
      status: "PAID",
      issuedAt: "2024-12-20T10:00:00+09:00",
      sentAt: "2024-12-20T14:30:00+09:00",
      paidAt: "2025-01-08T09:00:00+09:00",
      version: 1,
      parentInvoiceId: null,
      lockedAt: "2024-12-20T14:30:00+09:00",
      isLocked: true,
    },
  ],
};

// ============================================================================
// Payments — keyed by transactionId (rule_3, rule_11)
// Money flow separation — Payment is its own entity, never merged with Invoice.
// Seeded for transactions where money has actually been received in the demo.
// ============================================================================

export const MOCK_PAYMENTS: Record<string, Payment[]> = {
  // tx_002 (art_004 PAID) — single payment received via 계좌이체
  tx_002: [
    {
      id: "pay_001",
      invoiceId: "inv_002",
      transactionId: "tx_002",
      artworkId: "art_004",
      amount: 6_400_000,
      currency: "KRW",
      method: "BANK_TRANSFER",
      status: "RECEIVED",
      paidAt: "2026-04-21T18:40:00+09:00",
      memo: "신한은행 입금 확인 — 김도현 명의",
      createdAt: "2026-04-21T18:42:00+09:00",
      updatedAt: "2026-04-21T18:42:00+09:00",
    },
  ],
  // tx_003 (art_005 CLOSED) — payment archived
  tx_003: [
    {
      id: "pay_002",
      invoiceId: "inv_003",
      transactionId: "tx_003",
      artworkId: "art_005",
      amount: 9_800_000,
      currency: "KRW",
      method: "BANK_TRANSFER",
      status: "RECEIVED",
      paidAt: "2026-02-05T11:00:00+09:00",
      memo: "박기훈 컬렉터 입금 — KB국민은행",
      createdAt: "2026-02-05T11:05:00+09:00",
      updatedAt: "2026-02-05T11:05:00+09:00",
    },
  ],
  // tx_004 (art_007 BROKERED, original sale) — historical payment
  tx_004: [
    {
      id: "pay_003",
      invoiceId: "inv_004",
      transactionId: "tx_004",
      artworkId: "art_007",
      amount: 15_500_000,
      currency: "KRW",
      method: "WIRE",
      status: "RECEIVED",
      paidAt: "2025-01-08T09:00:00+09:00",
      memo: "Initial Owner — 해외 송금",
      createdAt: "2025-01-08T10:00:00+09:00",
      updatedAt: "2025-01-08T10:00:00+09:00",
    },
  ],
};

// ============================================================================
// Settlements — keyed by transactionId (rule_3, rule_11, rule_12)
// Internal money distribution after Payment is received. v1 default split:
// artist 60% / gallery 40% (see SETTLEMENT_POLICY in lib/utils).
// ============================================================================

export const MOCK_SETTLEMENTS: Record<string, Settlement[]> = {
  // tx_002 (art_004 PAID) — payment received, settlement pending review
  tx_002: [
    {
      id: "stl_001",
      transactionId: "tx_002",
      artworkId: "art_004",
      totalAmount: 6_400_000,
      artistShare: 3_840_000, // 60%
      galleryShare: 2_560_000, // 40%
      currency: "KRW",
      status: "PENDING",
      createdAt: "2026-04-21T18:42:00+09:00",
      updatedAt: "2026-04-21T18:42:00+09:00",
    },
  ],
  // tx_003 (art_005 CLOSED) — fully settled
  tx_003: [
    {
      id: "stl_002",
      transactionId: "tx_003",
      artworkId: "art_005",
      totalAmount: 9_800_000,
      artistShare: 5_880_000,
      galleryShare: 3_920_000,
      currency: "KRW",
      status: "COMPLETED",
      settledAt: "2026-02-08T11:00:00+09:00",
      createdAt: "2026-02-05T11:05:00+09:00",
      updatedAt: "2026-02-08T11:00:00+09:00",
    },
  ],
  // tx_004 (art_007 BROKERED, original sale) — fully settled
  tx_004: [
    {
      id: "stl_003",
      transactionId: "tx_004",
      artworkId: "art_007",
      totalAmount: 15_500_000,
      artistShare: 9_300_000,
      galleryShare: 6_200_000,
      currency: "KRW",
      status: "COMPLETED",
      settledAt: "2025-01-15T14:00:00+09:00",
      createdAt: "2025-01-08T10:00:00+09:00",
      updatedAt: "2025-01-15T14:00:00+09:00",
    },
  ],
};

// ============================================================================
// TaxRecords — keyed by transactionId (rule_3, rule_11)
// 세무 기록은 Payment / Settlement와 완전히 분리된 회계 layer입니다.
// Settlement.COMPLETED 트리거로 자동 생성되지만, 별도 엔티티로 보관됩니다.
// v1 시드: 이미 정산 완료된 거래(tx_003, tx_004)에 ISSUED 레코드 백필.
// tx_002는 Settlement PENDING이므로 TaxRecord 없음 (정산 완료 시 자동 생성).
// ============================================================================

export const MOCK_TAX_RECORDS: Record<string, TaxRecord[]> = {
  // tx_003 (art_005 CLOSED) — 매출 기록 발행 완료
  tx_003: [
    {
      id: "tax_001",
      transactionId: "tx_003",
      artworkId: "art_005",
      settlementId: "stl_002",
      taxableAmount: 9_800_000,
      vatAmount: 980_000,         // 10%
      withholdingAmount: 0,
      currency: "KRW",
      status: "ISSUED",
      taxType: "SALES_RECORD",
      issuedAt: "2026-02-10T15:00:00+09:00",
      createdAt: "2026-02-08T11:00:00+09:00",
      updatedAt: "2026-02-10T15:00:00+09:00",
    },
  ],
  // tx_004 (art_007 BROKERED, original sale) — 매출 기록 발행 완료
  tx_004: [
    {
      id: "tax_002",
      transactionId: "tx_004",
      artworkId: "art_007",
      settlementId: "stl_003",
      taxableAmount: 15_500_000,
      vatAmount: 1_550_000,
      withholdingAmount: 0,
      currency: "KRW",
      status: "ISSUED",
      taxType: "SALES_RECORD",
      issuedAt: "2025-01-20T11:00:00+09:00",
      createdAt: "2025-01-15T14:00:00+09:00",
      updatedAt: "2025-01-20T11:00:00+09:00",
    },
  ],
};

// ============================================================================
// Contracts — keyed by transactionId (rule_4, rule_11)
// AI-Human loop의 핵심 Document. LOCK + Versioning은 Invoice와 동일 패턴.
// 시드:
//  - tx_001: REVIEW 상태 — 사용자가 승인→LOCK 시연 가능
//  - tx_003: LOCKED — 완료된 거래의 immutable 계약 사례
// ============================================================================

const SEED_CONTRACT_001 = [
  "본 계약은 김선우의 작품 「Quiet Hour」(AXV-2025-0003)에 대한 매매 계약입니다.",
  "",
  "매도인: AXVELA Gallery",
  "매수인: 리움 컬렉션",
  "거래 금액: ₩18,000,000",
  "",
  "[작품 정보]",
  "- 작가: 김선우",
  "- 제목: Quiet Hour",
  "- 제작 연도: 2024",
  "- 매체: Oil on canvas",
  "- 크기: 162.0 × 130.3 cm",
  "",
  "[계약 조건]",
  "1. 갤러리는 작품의 진위와 보존 상태를 보증합니다.",
  "2. 매수인은 결제 완료 후 30일 이내에 인수합니다.",
  "3. 인수 후 7일 이내에 한해 이의 제기가 가능합니다.",
  "4. 본 계약은 양 당사자의 서명 및 LOCK으로 효력이 발생합니다.",
  "",
  "(본 초안은 AXVELA AI가 생성한 템플릿입니다. 담당자 검토 후 승인 단계로 진행하세요.)",
].join("\n");

const SEED_CONTRACT_002 = [
  "본 계약은 박지현의 작품 「Field Study #4」(AXV-2025-0005)에 대한 매매 계약입니다.",
  "",
  "매도인: AXVELA Gallery",
  "매수인: 박기훈",
  "거래 금액: ₩9,800,000",
  "",
  "[작품 정보]",
  "- 작가: 박지현",
  "- 제목: Field Study #4",
  "- 제작 연도: 2023",
  "- 매체: Acrylic on linen",
  "- 크기: 100.0 × 80.0 cm",
  "",
  "[계약 조건]",
  "1. 갤러리는 작품의 진위와 보존 상태를 보증합니다.",
  "2. 매수인은 결제 완료 후 30일 이내에 인수합니다.",
  "3. 인수 후 7일 이내에 한해 이의 제기가 가능합니다.",
  "4. 본 계약은 양 당사자의 서명 및 LOCK으로 효력이 발생합니다.",
  "",
  "양 당사자 서명 — 2026-01-26",
].join("\n");

export const MOCK_CONTRACTS: Record<string, Contract[]> = {
  // tx_001 (art_003 DEAL) — 검토 중인 계약, 사용자가 승인→LOCK 시연
  tx_001: [
    {
      id: "ctr_001",
      transactionId: "tx_001",
      artworkId: "art_003",
      version: 1,
      parentContractId: null,
      content: SEED_CONTRACT_001,
      status: "REVIEW",
      lockedAt: null,
      createdAt: "2026-05-02T10:00:00+09:00",
      updatedAt: "2026-05-02T11:45:00+09:00",
    },
  ],
  // tx_003 (art_005 CLOSED) — 완료된 거래의 LOCKED 계약 (영구 보관)
  tx_003: [
    {
      id: "ctr_002",
      transactionId: "tx_003",
      artworkId: "art_005",
      version: 1,
      parentContractId: null,
      content: SEED_CONTRACT_002,
      status: "LOCKED",
      lockedAt: "2026-01-26T14:00:00+09:00",
      createdAt: "2026-01-25T10:30:00+09:00",
      updatedAt: "2026-01-26T14:00:00+09:00",
    },
  ],
};

// ============================================================================
// Logistics — keyed by transactionId (rule_21)
// 실물 배송 도메인. Money flow / Contract와 분리.
// 시드:
//  - tx_002 (art_004 PAID): IN_TRANSIT — 사용자가 인도 → 검수 시연
//  - tx_003 (art_005 CLOSED): CONDITION_CHECKED — 완료된 사례
//  - tx_004 (art_007 BROKERED 원거래): CONDITION_CHECKED — 역사 기록
// ============================================================================

export const MOCK_LOGISTICS: Record<string, Logistics[]> = {
  tx_002: [
    {
      id: "log_001",
      artworkId: "art_004",
      transactionId: "tx_002",
      status: "IN_TRANSIT",
      carrierName: "SafeArt Logistics",
      trackingNumber: "SAL-2026-0501-A02",
      pickupDate: "2026-05-03",
      deliveryDate: "",
      memo: "온도/습도 제어 컨테이너 사용. 픽업 시 출고 전 컨디션 GOOD 확인.",
      createdAt: "2026-05-02T15:00:00+09:00",
      updatedAt: "2026-05-03T10:30:00+09:00",
    },
  ],
  tx_003: [
    {
      id: "log_002",
      artworkId: "art_005",
      transactionId: "tx_003",
      status: "CONDITION_CHECKED",
      carrierName: "SafeArt Logistics",
      trackingNumber: "SAL-2026-0125-B01",
      pickupDate: "2026-01-26",
      deliveryDate: "2026-01-28",
      memo: "양 컨디션 모두 GOOD. 박기훈 컬렉션 정상 인수.",
      createdAt: "2026-01-26T09:00:00+09:00",
      updatedAt: "2026-01-29T14:00:00+09:00",
    },
  ],
  tx_004: [
    {
      id: "log_003",
      artworkId: "art_007",
      transactionId: "tx_004",
      status: "CONDITION_CHECKED",
      carrierName: "Premium Art Transit",
      trackingNumber: "PAT-2025-0110-C03",
      pickupDate: "2025-01-12",
      deliveryDate: "2025-01-14",
      memo: "원거래 (브로커 이전). 양 측 컨디션 GOOD 확인 완료.",
      createdAt: "2025-01-12T08:30:00+09:00",
      updatedAt: "2025-01-15T16:00:00+09:00",
    },
  ],
};

// ============================================================================
// Condition Reports — keyed by transactionId (rule_4 — trust documents)
// 한 Logistics는 BEFORE_SHIPMENT + AFTER_DELIVERY 두 종류 보유 가능.
// 시드:
//  - tx_002 (IN_TRANSIT): BEFORE만 작성, AFTER는 인도 후 작성 예정
//  - tx_003 / tx_004: 양쪽 모두 GOOD으로 작성 완료
// ============================================================================

export const MOCK_CONDITION_REPORTS: Record<string, ConditionReport[]> = {
  tx_002: [
    {
      id: "rep_001",
      logisticsId: "log_001",
      artworkId: "art_004",
      transactionId: "tx_002",
      reportType: "BEFORE_SHIPMENT",
      conditionStatus: "GOOD",
      notes:
        "프레임 모서리 미세 흔적 외 손상 없음. 표면 상태 양호. 운송 보험 가입 완료.",
      imagePlaceholder: "",
      createdAt: "2026-05-03T09:30:00+09:00",
      updatedAt: "2026-05-03T09:30:00+09:00",
    },
  ],
  tx_003: [
    {
      id: "rep_002",
      logisticsId: "log_002",
      artworkId: "art_005",
      transactionId: "tx_003",
      reportType: "BEFORE_SHIPMENT",
      conditionStatus: "GOOD",
      notes: "출고 전 컨디션 양호. 표면 / 프레임 정상.",
      imagePlaceholder: "",
      createdAt: "2026-01-26T08:30:00+09:00",
      updatedAt: "2026-01-26T08:30:00+09:00",
    },
    {
      id: "rep_003",
      logisticsId: "log_002",
      artworkId: "art_005",
      transactionId: "tx_003",
      reportType: "AFTER_DELIVERY",
      conditionStatus: "GOOD",
      notes: "박기훈 컬렉션 인수 시 컨디션 정상 확인. 분쟁 없음.",
      imagePlaceholder: "",
      createdAt: "2026-01-29T14:00:00+09:00",
      updatedAt: "2026-01-29T14:00:00+09:00",
    },
  ],
  tx_004: [
    {
      id: "rep_004",
      logisticsId: "log_003",
      artworkId: "art_007",
      transactionId: "tx_004",
      reportType: "BEFORE_SHIPMENT",
      conditionStatus: "GOOD",
      notes: "원거래 출고 전. 작품 상태 양호.",
      imagePlaceholder: "",
      createdAt: "2025-01-12T08:00:00+09:00",
      updatedAt: "2025-01-12T08:00:00+09:00",
    },
    {
      id: "rep_005",
      logisticsId: "log_003",
      artworkId: "art_007",
      transactionId: "tx_004",
      reportType: "AFTER_DELIVERY",
      conditionStatus: "GOOD",
      notes: "원 컬렉터 인수 완료. 컨디션 정상.",
      imagePlaceholder: "",
      createdAt: "2025-01-15T16:00:00+09:00",
      updatedAt: "2025-01-15T16:00:00+09:00",
    },
  ],
};

// ============================================================================
// Curation Notes — keyed by artworkId, newest first within each list.
// STEP 16, rule_18 (a) — AI Layer.
// 시드:
//  - art_001 (READY): LOCKED v1 — 완성된 큐레이션 노트 (전시 준비 완료 상태)
//  - art_006 (DRAFT): 시드 없음 — 사용자가 "AI 큐레이션 초안" 버튼 클릭 시 생성 시연
// ============================================================================

const SEED_CURATION_001_HEADLINE =
  "김지은의 「무제, 푸른 정원」 — 매체와 시간이 만나는 자리";

const SEED_CURATION_001_SUBHEADLINE =
  "김지은 (Jieun Kim) · 2024 · Oil on canvas · 162.0 × 130.3 cm";

const SEED_CURATION_001_BODY = [
  "김지은의 「무제, 푸른 정원」(2024)은 Oil on canvas라는 매체를 통해 작가 특유의 조형 언어를 응축한 작품이다. AXV-2025-0001로 식별되는 이 작품은 162.0 × 130.3 cm의 화면 안에서 형태와 색채, 그리고 여백의 균형을 통해 관람자에게 응시의 시간을 요구한다.",
  "",
  "푸른빛이 지배하는 화면 안에서 작가는 정원이라는 일상적 모티프를 비구상적 색면(色面)으로 재구성한다. 캔버스 위에 겹겹이 쌓인 유화 물감의 층은 시간의 흔적을 가시화하며, 응시할수록 표면 아래에서 떠오르는 형상의 잔상을 제공한다. 매체의 물성은 시각적 표면을 넘어 작품의 의미 구조를 결정짓는 또 하나의 언어로 작동한다.",
  "",
  "2024년에 제작된 이 작품은 김지은의 작업 흐름 속에서 색면 추상으로의 본격적 진입을 보여주는 변곡점에 해당하며, 동시대 한국 회화의 한 단면을 명료하게 응축한 작품으로 평가된다. 컬렉션의 맥락에서도 깊이 있는 자리매김을 가능하게 하는 작품이다.",
].join("\n");

export const MOCK_CURATION_NOTES: Record<string, CurationNote[]> = {
  art_001: [
    {
      id: "cur_001",
      artworkId: "art_001",
      version: 1,
      parentCurationId: null,
      headline: SEED_CURATION_001_HEADLINE,
      subheadline: SEED_CURATION_001_SUBHEADLINE,
      body: SEED_CURATION_001_BODY,
      status: "LOCKED",
      lockedAt: "2026-04-28T10:00:00+09:00",
      createdAt: "2026-04-25T14:00:00+09:00",
      updatedAt: "2026-04-28T10:00:00+09:00",
    },
  ],
};

// ============================================================================
// Living Timeline — seeded events
// ============================================================================

export const MOCK_TIMELINE: Record<string, TimelineEvent[]> = {
  // art_001 (READY): STEP 16 시드 — Curation 노트 AI 생성 → 담당자 승인 → LOCK 흐름.
  // rule_5 AI-Human Loop의 전체 4-step이 timeline에 그대로 가시화됨.
  art_001: [
    {
      id: "ev_cur_001_lock",
      artworkId: "art_001",
      kind: "DOCUMENT",
      title: "큐레이션 노트 LOCK",
      detail: "v1 · 잠금 (영구 보존)",
      at: "2026-04-28T10:00:00+09:00",
      actor: "Manager · 운영자",
      actorRole: "MANAGER",
      relatedEntityType: "curation",
      relatedEntityId: "art_001",
    },
    {
      id: "ev_cur_001_approve",
      artworkId: "art_001",
      kind: "DOCUMENT",
      title: "큐레이션 노트 승인",
      detail: "v1 · 초안 → 승인 완료",
      at: "2026-04-27T11:30:00+09:00",
      actor: "Manager · 운영자",
      actorRole: "MANAGER",
      relatedEntityType: "curation",
      relatedEntityId: "art_001",
    },
    {
      id: "ev_cur_001_create",
      artworkId: "art_001",
      kind: "DOCUMENT",
      title: "큐레이션 노트 생성",
      detail: "v1 · AI 초안 생성 · 초안",
      at: "2026-04-25T14:00:00+09:00",
      actor: "AXVELA AI",
      relatedEntityType: "curation",
      relatedEntityId: "art_001",
    },
  ],
  art_002: [
    {
      id: "ev_1",
      artworkId: "art_002",
      kind: "STATE_CHANGE",
      title: "READY → INQUIRY",
      detail: "신규 컬렉터 문의 수신",
      at: "2026-05-01T16:02:00+09:00",
      actor: "System",
    },
    {
      id: "ev_2",
      artworkId: "art_002",
      kind: "INQUIRY",
      title: "Inquiry #INQ-0231",
      detail: "Sarah Lim · 가격/배송 문의",
      at: "2026-05-01T16:00:00+09:00",
      actor: "Collector",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_001",
    },
    {
      id: "ev_3",
      artworkId: "art_002",
      kind: "INQUIRY",
      title: "Inquiry 업데이트",
      detail: "강민정 · 상태 응대 대기 → 응대 완료",
      at: "2026-04-26T14:30:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_001",
    },
    {
      id: "ev_4",
      artworkId: "art_002",
      kind: "DOCUMENT",
      title: "Condition Report v1 — LOCKED",
      at: "2026-04-28T11:12:00+09:00",
      actor: "Manager · J. Han",
    },
  ],
  art_003: [
    {
      id: "ev_5a",
      artworkId: "art_003",
      kind: "DOCUMENT",
      title: "Invoice 발송",
      detail: "Invoice INV-001 · ₩18,000,000 · 발송 완료",
      at: "2026-05-02T16:20:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "invoice",
      relatedEntityId: "inv_001",
    },
    {
      id: "ev_5b",
      artworkId: "art_003",
      kind: "DOCUMENT",
      title: "Contract 검토 요청",
      detail: "v1 · DRAFT → 검토 중",
      at: "2026-05-02T11:45:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "contract",
      relatedEntityId: "ctr_001",
    },
    {
      id: "ev_5",
      artworkId: "art_003",
      kind: "TRANSACTION",
      title: "Transaction 업데이트",
      detail: "상태 협상 중 → 합의 완료 · 메모 갱신",
      at: "2026-05-02T11:30:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "transaction",
      relatedEntityId: "tx_001",
    },
    {
      id: "ev_5c",
      artworkId: "art_003",
      kind: "DOCUMENT",
      title: "Contract 생성",
      detail: "v1 · AI 초안 생성 · 초안",
      at: "2026-05-02T10:00:00+09:00",
      actor: "AXVELA AI",
      relatedEntityType: "contract",
      relatedEntityId: "ctr_001",
    },
    {
      id: "ev_6",
      artworkId: "art_003",
      kind: "TRANSACTION",
      title: "Transaction 자동 생성",
      detail: "리움 컬렉션 · ₩18,000,000 · 협상 중",
      at: "2026-05-02T09:14:00+09:00",
      actor: "System",
      relatedEntityType: "transaction",
      relatedEntityId: "tx_001",
    },
    {
      id: "ev_6a",
      artworkId: "art_003",
      kind: "DOCUMENT",
      title: "Invoice 자동 생성",
      detail: "Invoice INV-001 · ₩18,000,000 · 초안",
      at: "2026-05-02T09:14:00+09:00",
      actor: "System",
      relatedEntityType: "invoice",
      relatedEntityId: "inv_001",
    },
    {
      id: "ev_7",
      artworkId: "art_003",
      kind: "STATE_CHANGE",
      title: "INQUIRY → DEAL",
      detail: "협상 진행 후 거래 확정",
      at: "2026-05-02T09:14:00+09:00",
      actor: "Manager · J. Han",
    },
    {
      id: "ev_8",
      artworkId: "art_003",
      kind: "INQUIRY",
      title: "Inquiry 업데이트",
      detail: "리움 컬렉션 · 상태 응대 대기 → 응대 완료",
      at: "2026-05-01T11:20:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_002",
    },
    {
      id: "ev_9",
      artworkId: "art_003",
      kind: "INQUIRY",
      title: "Inquiry #INQ-0218",
      detail: "리움 컬렉션 · 실견 요청",
      at: "2026-04-28T10:30:00+09:00",
      actor: "Collector",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_002",
    },
  ],
  art_004: [
    {
      // Mirrors updateLogisticsStatus emit on log_001 (READY_FOR_PICKUP → IN_TRANSIT)
      id: "ev_15",
      artworkId: "art_004",
      kind: "TRANSACTION",
      title: "배송 상태 변경",
      detail: "픽업 대기 → 배송 중",
      at: "2026-05-03T10:30:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "logistics",
      relatedEntityId: "log_001",
    },
    {
      // Mirrors createConditionReport emit for rep_001 (BEFORE_SHIPMENT · GOOD)
      id: "ev_14",
      artworkId: "art_004",
      kind: "DOCUMENT",
      title: "Condition Report 생성",
      detail: "출고 전 컨디션 · 양호",
      at: "2026-05-03T09:30:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "condition_report",
      relatedEntityId: "rep_001",
    },
    {
      // Mirrors createLogistics emit for log_001 (READY_FOR_PICKUP, empty fields)
      id: "ev_13",
      artworkId: "art_004",
      kind: "TRANSACTION",
      title: "Logistics 생성",
      detail: "픽업 대기 · 운송사 미지정",
      at: "2026-05-02T15:00:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "logistics",
      relatedEntityId: "log_001",
    },
    {
      id: "ev_10b",
      artworkId: "art_004",
      kind: "TRANSACTION",
      title: "Settlement 자동 생성",
      detail: "₩6,400,000 · 작가 60% · 갤러리 40% · 정산 대기",
      at: "2026-04-21T18:43:00+09:00",
      actor: "System",
      relatedEntityType: "settlement",
      relatedEntityId: "stl_001",
    },
    {
      id: "ev_10a",
      artworkId: "art_004",
      kind: "PAYMENT",
      title: "결제 등록",
      detail: "₩6,400,000 · 계좌이체 · 수령 완료",
      at: "2026-04-21T18:42:00+09:00",
      actor: "Manager · J. Han",
      relatedEntityType: "invoice",
      relatedEntityId: "inv_002",
    },
    {
      id: "ev_10",
      artworkId: "art_004",
      kind: "STATE_CHANGE",
      title: "DEAL → PAID",
      detail: "결제 등록에 따른 자동 전환",
      at: "2026-04-21T18:40:00+09:00",
      actor: "System",
    },
    {
      id: "ev_11",
      artworkId: "art_004",
      kind: "TRANSACTION",
      title: "Transaction 자동 생성",
      detail: "김도현 · ₩6,400,000 · 협상 중",
      at: "2026-04-15T14:00:00+09:00",
      actor: "System",
      relatedEntityType: "transaction",
      relatedEntityId: "tx_002",
    },
    {
      id: "ev_12",
      artworkId: "art_004",
      kind: "INQUIRY",
      title: "Inquiry #INQ-0190",
      detail: "김도현 · Art Busan",
      at: "2026-04-10T15:00:00+09:00",
      actor: "Collector",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_003",
    },
  ],
  // art_007: BROKERED 상태 — Resale 시작 시점부터 추적된 이벤트 3건.
  // 원거래(tx_004)는 시스템 도입 이전이라 timeline 부재 (의도적). rule_13 시드.
  art_007: [
    {
      id: "ev_r03",
      artworkId: "art_007",
      kind: "INQUIRY",
      title: "Ownership 전환 준비",
      detail: "Resale Inquiry 자동 생성 · 신규 구매자 응대 대기",
      at: "2026-04-15T14:30:00+09:00",
      actor: "System",
      relatedEntityType: "inquiry",
      relatedEntityId: "inq_006",
    },
    {
      id: "ev_r02",
      artworkId: "art_007",
      kind: "TRANSACTION",
      title: "New Transaction 생성",
      detail: "이전 소유자: Initial Owner · 재판매 커미션 15%",
      at: "2026-04-15T14:30:00+09:00",
      actor: "Manager · 운영자",
      actorRole: "MANAGER",
      relatedEntityType: "transaction",
      relatedEntityId: "tx_005",
    },
    {
      id: "ev_r01",
      artworkId: "art_007",
      kind: "STATE_CHANGE",
      title: "Resale 시작",
      detail: "거래 종료 → 재판매 풀 · 이전 소유자 → 신규 판매 흐름 시작",
      at: "2026-04-15T14:30:00+09:00",
      actor: "Manager · 운영자",
      actorRole: "MANAGER",
    },
  ],
};
