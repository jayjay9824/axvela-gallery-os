// src/lib/pdf/client.ts
//
// ============================================================================
// PDF Client Helper — STEP 132 Phase 2 Commit 1 (Foundation)
//
// **본 모듈의 목적**:
//   Client-side 에서 server PDF endpoint 호출 → blob → 다운로드 trigger.
//   Commit 2 의 InvoiceDetailDrawer 미리보기/다운로드 UI 에서 호출 예정.
//
// **흐름**:
//   1. fetch POST /api/pdf/invoice/[id] with body (invoice/artwork/transaction/locale)
//   2. response.ok 검증, 실패 시 server JSON error 추출 (rule_4 가드 메시지 등)
//   3. response.blob() → Blob → URL.createObjectURL
//   4. <a download> trigger (customer-export.ts triggerDownload 패턴 답습)
//   5. URL.revokeObjectURL cleanup (setTimeout 1초)
//
// **rule_4 가드**: server route (route.tsx) 가 invoice.isLocked 검증 —
// DRAFT 시 403 응답 → 본 helper 가 { ok: false, error, status: 403 } 반환.
//
// **rule_16 minimalism**: 표준 fetch + DOM API 만. 추가 dep 0.
//
// **client-side only**: `document` / `URL.createObjectURL` 사용 — server
// component / API route 에서 import 금지 (webpack 빌드 에러 가능).
// ============================================================================

import type { Invoice } from "@/types/invoice";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { DocumentLocale } from "@/lib/document-locale";

export interface DownloadInvoicePDFInput {
  invoice: Invoice;
  artwork: Artwork | null;
  transaction: Transaction | null;
  locale: DocumentLocale;
  galleryName?: string;
}

export type DownloadInvoicePDFResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

/**
 * Invoice PDF 를 server-side 에서 생성 + 즉시 다운로드 trigger.
 *
 * **흐름**: fetch → blob → <a download> click → revokeObjectURL.
 *
 * **rule_4 정합**: server route 가 invoice.isLocked 가드. DRAFT 시 403 응답
 * → 본 helper 가 `{ ok: false, error, status: 403 }` 반환.
 *
 * @example
 *   const result = await downloadInvoicePDF({
 *     invoice, artwork, transaction, locale: "ko",
 *   });
 *   if (!result.ok) {
 *     console.error(result.error);
 *     // toast.error(result.error);
 *   }
 */
export async function downloadInvoicePDF(
  input: DownloadInvoicePDFInput,
): Promise<DownloadInvoicePDFResult> {
  const { invoice, artwork, transaction, locale, galleryName } = input;

  // 1. fetch POST
  let response: Response;
  try {
    response = await fetch(`/api/pdf/invoice/${invoice.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice,
        artwork,
        transaction,
        locale,
        galleryName,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `네트워크 오류: ${err.message}`
          : "네트워크 오류 (오프라인 또는 API route 접근 불가).",
    };
  }

  // 2. HTTP 상태 검증 — server JSON error 추출 시도
  if (!response.ok) {
    let serverError = `PDF 생성 실패 (HTTP ${response.status}).`;
    try {
      const json = (await response.json()) as { error?: unknown };
      if (typeof json.error === "string") serverError = json.error;
    } catch {
      // JSON parse 실패 — fallback message 유지
    }
    return { ok: false, error: serverError, status: response.status };
  }

  // 3. blob 읽기
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `PDF blob 읽기 실패: ${err.message}`
          : "PDF blob 읽기 실패.",
    };
  }

  // 4. 다운로드 trigger (server-side filename 헤더와 일관)
  const shortId = invoice.id.slice(-8).toUpperCase();
  const filename = `invoice-${shortId}.pdf`;
  triggerDownload(blob, filename);

  return { ok: true };
}

/**
 * Blob 을 즉시 다운로드 trigger.
 * `customer-export.ts` 의 triggerDownload 패턴 답습 (프로젝트 단일 표준).
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
