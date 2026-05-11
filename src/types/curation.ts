// ============================================================================
// CurationNote — Artwork에 직접 귀속되는 큐레이션 문서 (rule_4, rule_5, rule_18).
//
// AI-Human Loop (rule_5):
//   AI 초안 생성 (createCurationNote)
//   → 인간 수정 (updateCurationNote — DRAFT 상태에서만)
//   → 승인 (approveCurationNote — DRAFT → APPROVED, 편집 잠김)
//   → 잠금 (lockCurationNote — APPROVED → LOCKED, immutable)
//
// LOCK 이후 수정 필요 시 createCurationVersion()으로 새 DRAFT 생성. 기존 버전은
// 영구 보존 (삭제 금지, rule_4). parentCurationId로 chain 추적.
//
// Contract와의 차이:
//   - Contract는 Transaction 종속 (rule_11) — 거래 단위
//   - CurationNote는 Artwork 직접 종속 (rule_1) — 작품 단위, 거래 이전부터 존재 가능
//   - Contract는 4-stage (DRAFT → REVIEW → APPROVED → LOCKED) — 법적 문서, 검토자 분리
//   - CurationNote는 3-stage — 문서 신뢰는 같지만 검토 분리 단계 불필요
// ============================================================================

import type { Artwork } from "./artwork";

/**
 * Curation lifecycle.
 * - DRAFT     초안 — AI 생성 직후, 편집 가능
 * - APPROVED  승인 완료 — 편집 잠김, LOCK 대기
 * - LOCKED    잠금 — immutable, 수정은 새 버전 생성으로만 가능
 */
export type CurationStatus = "DRAFT" | "APPROVED" | "LOCKED";

export interface CurationNote {
  id: string;
  /** Artwork-first (rule_1) — 거래보다 상위. */
  artworkId: Artwork["id"];

  /** Version number within the parent chain. v1 = original. */
  version: number;
  /** Predecessor curation in the version chain. null for v1. */
  parentCurationId: string | null;

  /** 한 줄 헤드라인 — 작품을 한 문장으로 요약. AI 생성, 인간 편집. */
  headline: string;
  /** 부제 — 작가/연도/매체 등 메타 1줄. AI 생성. */
  subheadline: string;
  /** 본문 — 작품 해설 텍스트. AI 생성, 인간 편집. */
  body: string;

  status: CurationStatus;
  /** ISO datetime when status flipped to LOCKED. null until then. */
  lockedAt: string | null;

  // Audit
  createdAt: string;
  updatedAt: string;
}

/**
 * Editable fields of a CurationNote. updateCurationNote()는 DRAFT 상태에서만
 * 적용되며, APPROVED/LOCKED는 silent no-op (rule_4).
 */
export interface CurationNoteUpdate {
  headline?: string;
  subheadline?: string;
  body?: string;
}
