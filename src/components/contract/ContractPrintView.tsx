"use client";

// ============================================================================
// ContractPrintView — STEP 129 — 매매 계약서 인쇄 surface
//
// **본 컴포넌트의 목적**:
//   `window.print()` 호출 시 *오직 본 영역만* 풀-스크린 인쇄. 나머지 모든
//   UI 는 `@media print` CSS 로 숨김. browser native print-to-PDF 흐름이
//   본 layout 을 그대로 PDF 로 저장. STEP 89 TaxInvoicePrintView 패턴 답습.
//
// **Contract 상태별 분기**:
//   - DRAFT/REVIEW: 본문 보기 / 작업 중 표시 (인쇄는 가능하나 운영 톤 약함)
//   - APPROVED: 승인 완료 표시
//   - LOCKED: 최종 본 (정식 매매 계약서 출력)
//
// **AI-Human Loop (rule_5)** 보존:
//   본 view 는 *읽기·인쇄 surface* — Contract.content 의 AI 초안 / 인간 수정
//   / 승인 / LOCK 4-stage 모두 입력 layer (DraftDrawer) 영역. 본 PrintView
//   는 그 결과물의 인쇄용 표기.
//
// **STEP 132 forward-compat**:
//   현재 browser native `window.print()` — STEP 132 (Server-side PDF
//   Architecture) 진입 시 신규 영역 (Contract 포함) server-side 전환 결정
//   (사용자 결정 2026-05-12).
//
// **AXID 표기**: `formatAxidForDocument` helper 사용 — display label 분리
// (STEP 127 Phase 1 §2.7 옵션 Z).
//
// **rule_16 minimalism**: 외부 라이브러리 0 / pure React + Tailwind +
// browser native @media print. 그림자 0 / chart 0 / monochrome / 작은
// typography. luxury archive 톤 아닌 institutional contract 톤.
// ============================================================================

import * as React from "react";
import type { Contract } from "@/types/contract";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import {
  formatMoney,
  CONTRACT_STATUS_LABEL,
  formatAxidForDocument,
} from "@/lib/utils";

interface Props {
  contract: Contract;
  artwork: Artwork | null;
  transaction: Transaction | null;
  /** Gallery info — 운영자가 settings 에서 설정 가능. */
  galleryName?: string;
}

/**
 * 매매 계약서 인쇄 layout. `window.print()` 트리거 시 전체 페이지.
 * Contract.content (free-form 본문, AI 초안 + 인간 수정) 가 핵심 surface.
 */
export function ContractPrintView({
  contract,
  artwork,
  transaction,
  galleryName = "AXVELA Gallery",
}: Props) {
  const createdAtFormatted = formatPrintDate(contract.createdAt);
  const lockedAtFormatted = contract.lockedAt
    ? formatPrintDate(contract.lockedAt)
    : null;

  const isLocked = contract.status === "LOCKED";
  const docTitleKR = isLocked ? "매매 계약서" : "매매 계약서 (초안)";

  return (
    <section
      data-contract-print-id={contract.id}
      data-contract-status={contract.status}
      className="contract-print-area mx-auto max-w-[680px] bg-white text-black p-12 print:p-10 print:max-w-none print:w-full print:min-h-screen"
      aria-label={docTitleKR}
    >
      {/* Header — Gallery + Contract 분류 */}
      <header className="border-b border-black/80 pb-5 mb-7">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[18px] font-semibold tracking-tight2 text-black">
            {galleryName}
          </h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/60">
            SALE CONTRACT
          </span>
        </div>
        <p className="mt-1 text-[13px] font-semibold tracking-tightish text-black">
          {docTitleKR}
        </p>
        <p className="mt-0.5 text-[10.5px] text-black/55 italic tracking-tightish">
          운영 참고용 발급 기록 · 작품 매매 거래 확인
        </p>
      </header>

      {/* DRAFT/REVIEW/APPROVED 안내 banner (LOCKED 이외) */}
      {!isLocked && (
        <div className="mb-7 border-2 border-black/30 px-4 py-3 text-center">
          <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-black">
            {CONTRACT_STATUS_LABEL[contract.status]}
          </p>
          <p className="mt-1 text-[10.5px] text-black/65 tracking-tightish">
            본 문서는 아직 LOCK 되지 않은 작업본입니다. 정식 계약은 LOCKED 상태
            진입 시점에 성립됩니다.
          </p>
        </div>
      )}

      {/* Top metadata grid */}
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-6 text-[12px] text-black/80 mb-7">
        <dt className="text-black/55">계약서 번호</dt>
        <dd className="font-mono tabular-nums text-black">
          {formatContractNumber(contract)}
        </dd>

        <dt className="text-black/55">작성 시각</dt>
        <dd className="tabular-nums">{createdAtFormatted}</dd>

        {lockedAtFormatted && (
          <>
            <dt className="text-black/55">LOCK 시각</dt>
            <dd className="tabular-nums">{lockedAtFormatted}</dd>
          </>
        )}

        <dt className="text-black/55">상태</dt>
        <dd>
          {CONTRACT_STATUS_LABEL[contract.status]} · v{contract.version}
        </dd>

        {transaction && (
          <>
            <dt className="text-black/55">구매자</dt>
            <dd>{transaction.buyerName?.trim() || "—"}</dd>
          </>
        )}

        {contract.lockedBy && (
          <>
            <dt className="text-black/55">LOCK 담당자</dt>
            <dd>{contract.lockedBy}</dd>
          </>
        )}
      </dl>

      {/* Artwork — 거래 대상 작품 */}
      {artwork && (
        <section className="mb-7">
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-black/55 mb-3">
            거래 대상 작품
          </h2>
          <div className="border border-black/15 rounded-md p-4">
            <p className="text-[13px] font-medium text-black">
              {artwork.title || "(제목 없음)"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-black/70">
              {artwork.artist.name || "—"}
              {artwork.year ? ` · ${artwork.year}` : ""}
            </p>
            {(artwork.medium || artwork.dimensions) && (
              <p className="mt-1 text-[11px] text-black/55">
                {artwork.medium ?? ""}
                {artwork.medium && artwork.dimensions ? " · " : ""}
                {artwork.dimensions ?? ""}
              </p>
            )}
            <p className="mt-2 text-[10.5px] text-black/55 font-mono tracking-tightish">
              {formatAxidForDocument(artwork.axid)}
            </p>
            {transaction && transaction.agreedPrice > 0 && (
              <p className="mt-2 pt-2 border-t border-black/10 text-[11.5px] text-black tabular-nums">
                합의 금액 ·{" "}
                <span className="font-semibold">
                  {formatMoney(transaction.agreedPrice, transaction.currency)}
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Contract body — free-form text (AI 초안 + 인간 수정, rule_5) */}
      <section className="mb-7">
        <h2 className="text-[10px] uppercase tracking-[0.18em] text-black/55 mb-3">
          계약 본문
        </h2>
        <div className="border-t border-black/15 pt-5 pb-2">
          <div className="text-[12px] leading-[1.85] text-black whitespace-pre-wrap tracking-tightish">
            {contract.content || "(본문 미작성)"}
          </div>
        </div>
      </section>

      {/* Signature placeholder block */}
      <section className="mb-7 pt-5 border-t border-black/15">
        <div className="grid grid-cols-2 gap-8 text-[11px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/55 mb-3">
              매도인 / Gallery
            </p>
            <p className="text-black tracking-tightish">{galleryName}</p>
            <div className="mt-12 border-t border-black/40 pt-1 text-[10px] text-black/55">
              서명 / Signature
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/55 mb-3">
              매수인 / Buyer
            </p>
            <p className="text-black tracking-tightish">
              {transaction?.buyerName?.trim() || "—"}
            </p>
            <div className="mt-12 border-t border-black/40 pt-1 text-[10px] text-black/55">
              서명 / Signature
            </div>
          </div>
        </div>
      </section>

      {/* Footer — operational disclaimer */}
      <footer className="text-[10px] text-black/55 leading-[1.6]">
        <p>
          본 매매 계약서는 갤러리 운영 참고용 발급 기록입니다. 작품 매매 거래
          확인 문서로 발행되었습니다.
        </p>
        <p className="mt-2 tabular-nums">
          v{contract.version}
          {contract.parentContractId ? " · 이전 버전 chain 보존" : ""}
        </p>
        <p className="mt-3 text-black/45">
          {galleryName} · device-local activity record
        </p>
      </footer>

      {/* Print-only CSS — 본 영역만 인쇄, 나머지 UI 모두 숨김. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .contract-print-area,
          .contract-print-area * {
            visibility: visible;
          }
          .contract-print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            box-shadow: none;
          }
          @page {
            margin: 14mm;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================================================
// Helpers — pure formatting
// ============================================================================

function formatPrintDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function formatContractNumber(contract: Contract): string {
  const short = contract.id.slice(-8).toUpperCase();
  return `CT-${short}`;
}
