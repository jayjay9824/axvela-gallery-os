// ============================================================================
// API Route — POST /api/delete-image (STEP 61).
//
// Vercel Blob storage 삭제 endpoint. 클라이언트(VercelBlobImageStorageProvider
// .delete)가 JSON body로 pathname을 보내면 서버측에서 `@vercel/blob.del()` 호출.
//
// **method 선택**: HTTP DELETE 대신 POST 사용 — 일부 CDN / proxy 환경에서 DELETE
// preflight 처리 이슈 회피 (운영 안정성). 의미는 명시적으로 path가 /api/delete-image.
//
// **security 가드 (사용자 spec "안전장치"):**
//   - 환경변수 `BLOB_READ_WRITE_TOKEN` 부재 시 503 graceful 응답
//   - pathname은 "artworks/" 접두사만 허용 — path traversal 차단
//   - pathname 길이 / 형식 검증 — 비정상 입력 차단
//   - silent failure isolation — 외부 blob이 이미 부재해도 에러 없이 정상 처리
//     (idempotent — 운영자 재시도 시 안전)
//
// **rule_4 Trust Layer**: delete는 destructive action이지만 "영구 삭제 보장" /
// "무손실 보장" 표현 사용 0건. "외부 storage에서 제거 요청" 의미만 노출.
// ============================================================================

import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 안전 가드 — 본 시스템이 발급하는 pathname 접두사만 허용 (path traversal 차단)
const ALLOWED_PATHNAME_PREFIX = "artworks/";
// 비정상 길이 차단
const MAX_PATHNAME_LENGTH = 200;

interface DeleteImagePayload {
  pathname?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. 환경변수 가드
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob 환경변수(BLOB_READ_WRITE_TOKEN)가 설정되지 않았습니다.",
      },
      { status: 503 }
    );
  }

  // 2. JSON body 파싱
  let payload: DeleteImagePayload;
  try {
    payload = (await request.json()) as DeleteImagePayload;
  } catch {
    return NextResponse.json(
      { error: "JSON body 파싱 실패" },
      { status: 400 }
    );
  }

  // 3. pathname 검증
  const pathname = payload.pathname;
  if (typeof pathname !== "string" || pathname.trim() === "") {
    return NextResponse.json(
      { error: "pathname이 누락되었거나 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (pathname.length > MAX_PATHNAME_LENGTH) {
    return NextResponse.json(
      { error: "pathname 길이 초과" },
      { status: 400 }
    );
  }
  if (!pathname.startsWith(ALLOWED_PATHNAME_PREFIX)) {
    return NextResponse.json(
      {
        error: `허용되지 않은 pathname 접두사 (${ALLOWED_PATHNAME_PREFIX} 만 허용)`,
      },
      { status: 400 }
    );
  }
  // path traversal 차단 — ".." / 절대경로 / null byte 등
  if (
    pathname.includes("..") ||
    pathname.includes("\0") ||
    pathname.startsWith("/") ||
    pathname.startsWith("\\")
  ) {
    return NextResponse.json(
      { error: "비정상 pathname 형식" },
      { status: 400 }
    );
  }

  // 4. Vercel Blob del() 호출
  //    @vercel/blob의 del()은 부재한 blob에 대해서도 에러 없이 처리됨 (idempotent).
  //    네트워크 / 서비스 에러는 catch하여 502 반환.
  try {
    await del(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ ok: true, pathname });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Vercel Blob 제거 요청 실패: ${err.message}`
            : "Vercel Blob 제거 요청 실패",
      },
      { status: 502 }
    );
  }
}
