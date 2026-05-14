// src/app/api/pdf/invoice/[id]/route.tsx
//
// ============================================================================
// API Route — POST /api/pdf/invoice/[id] — STEP 132 Phase 2 Commit 1
//
// **본 route 의 목적**:
//   Invoice PDF 발급 server-side endpoint. Client 가 Zustand store 에서 invoice
//   / artwork / transaction 데이터를 POST body 로 전송, server 가
//   @react-pdf/renderer 로 PDF binary 생성 → application/pdf 응답.
//
// **데이터 흐름 (Phase 1 §3.5 정합)**:
//   - Zustand store 는 client-only — server 가 직접 access 불가능
//   - 따라서 client 가 POST body 로 데이터 전달 (server 는 stateless)
//   - [id] path param 은 defense-in-depth (body.invoice.id 와 일치 검증)
//
// **rule_4 Trust Layer 가드**:
//   - 가드 위치: 본 route (server-side, 단일 책임 분리, InvoicePDFDocument 는 pure)
//   - 정책: invoice.isLocked === true 만 발급. DRAFT (isLocked === false) 차단.
//   - 표준 답습: InvoiceDetailDrawer (`return invoice.isLocked ? Locked : Editable`)
//
// **응답 status 분류**:
//   - 200: PDF binary (application/pdf)
//   - 400: invalid JSON body
//   - 422: body validation fail (locale / missing fields / id mismatch)
//   - 403: rule_4 가드 위반 (DRAFT invoice PDF 거부)
//   - 500: PDF render fail (renderToBuffer 예외)
//
// **Runtime**:
//   - `nodejs` 명시 (renderToBuffer 는 Node.js Buffer 필요, edge runtime 부적합)
//   - `dynamic = "force-dynamic"` — 캐싱 0, 매 요청 신선 PDF
//
// **rule_16 minimalism**: @react-pdf/renderer + Next.js NextResponse 만 사용.
// 추가 dep 0.
// ============================================================================

import * as React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { DocumentLocale } from "@/lib/document-locale";
import { InvoicePDFDocument } from "@/components/invoice/InvoicePDFDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  invoice: Invoice;
  artwork: Artwork | null;
  transaction: Transaction | null;
  locale: DocumentLocale;
  galleryName?: string;
}

function isValidLocale(value: unknown): value is DocumentLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh";
}

function validateBody(
  body: unknown,
): { ok: true; parsed: RequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (!b.invoice || typeof b.invoice !== "object") {
    return { ok: false, error: "body.invoice is required (object)." };
  }
  if ("artwork" in b && b.artwork !== null && typeof b.artwork !== "object") {
    return { ok: false, error: "body.artwork must be object or null." };
  }
  if (
    "transaction" in b &&
    b.transaction !== null &&
    typeof b.transaction !== "object"
  ) {
    return { ok: false, error: "body.transaction must be object or null." };
  }
  if (!isValidLocale(b.locale)) {
    return {
      ok: false,
      error: `body.locale must be one of ko|en|ja|zh. Received: ${String(b.locale)}`,
    };
  }
  if (b.galleryName !== undefined && typeof b.galleryName !== "string") {
    return { ok: false, error: "body.galleryName must be string if provided." };
  }

  return {
    ok: true,
    parsed: {
      invoice: b.invoice as Invoice,
      artwork: (b.artwork ?? null) as Artwork | null,
      transaction: (b.transaction ?? null) as Transaction | null,
      locale: b.locale,
      galleryName: b.galleryName as string | undefined,
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // 2. Validate body shape
  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const { invoice, artwork, transaction, locale, galleryName } =
    validation.parsed;

  // 3. Defense in depth — id 일치 검증
  if (invoice.id !== params.id) {
    return NextResponse.json(
      { error: "Invoice id in body does not match path param." },
      { status: 422 },
    );
  }

  // 4. rule_4 Trust Layer 가드 — LOCKED 만 발급
  if (!invoice.isLocked) {
    return NextResponse.json(
      {
        error:
          "PDF generation requires LOCKED invoice. DRAFT cannot be issued.",
        invoiceStatus: invoice.status,
      },
      { status: 403 },
    );
  }

  // 5. PDF 생성
  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      <InvoicePDFDocument
        invoice={invoice}
        artwork={artwork}
        transaction={transaction}
        locale={locale}
        galleryName={galleryName}
      />,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "PDF rendering failed.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  // 6. Binary response — application/pdf
  // Buffer → Uint8Array view (복사 0) + as BodyInit (TS lib 비호환 acknowledge, runtime 정합)
  const shortId = invoice.id.slice(-8).toUpperCase();
  const filename = `invoice-${shortId}.pdf`;
  const pdfBytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return new NextResponse(pdfBytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBytes.byteLength.toString(),
    },
  });
}
