// src/app/api/pdf/contract/[id]/route.tsx
//
// API Route — POST /api/pdf/contract/[id] — STEP 132 Phase 2 Commit 2
// InvoicePDFRoute 답습. G-1 정책: contract.status === "LOCKED" 만 발급.

import * as React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Contract } from "@/types/contract";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { DocumentLocale } from "@/lib/document-locale";
import { ContractPDFDocument } from "@/components/contract/ContractPDFDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  contract: Contract;
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

  if (!b.contract || typeof b.contract !== "object") {
    return { ok: false, error: "body.contract is required (object)." };
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
      contract: b.contract as Contract,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const { contract, artwork, transaction, locale, galleryName } =
    validation.parsed;

  if (contract.id !== params.id) {
    return NextResponse.json(
      { error: "Contract id in body does not match path param." },
      { status: 422 },
    );
  }

  if (contract.status !== "LOCKED") {
    return NextResponse.json(
      {
        error:
          "PDF generation requires LOCKED contract. DRAFT / REVIEW / APPROVED cannot be issued.",
        contractStatus: contract.status,
      },
      { status: 403 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      <ContractPDFDocument
        contract={contract}
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

  const shortId = contract.id.slice(-8).toUpperCase();
  const filename = `contract-${shortId}.pdf`;
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
