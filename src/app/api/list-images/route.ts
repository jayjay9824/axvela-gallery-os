// ============================================================================
// API Route — GET /api/list-images (STEP 62).
//
// 외부 저장소(Vercel Blob) read-only inspection endpoint. admin cleanup tool이
// "artworks/" prefix scope 안의 storage object 목록 + 메타데이터를 조회.
//
// **security 정책 (STEP 61과 동일 posture):**
//   - 환경변수 부재 → 503 graceful 응답
//   - "artworks/" prefix만 scope — 다른 path 노출 차단
//   - 읽기 전용 — 본 endpoint는 어떤 mutation도 수행하지 않음
//   - response의 url은 public (Vercel Blob 정책 — 카드 / hero에서 그대로 사용
//     중인 url과 동일 접근 수준)
//   - pagination 내부 처리 — 호출자는 단일 GET으로 전체 목록 받음. 단, 응답
//     size 폭주 방지를 위해 hard cap (HARD_LIMIT) 설정.
//
// **response shape (안정 contract — 클라이언트 lib와 매칭)**:
//   {
//     ok: true,
//     blobs: [{ pathname, url, size, uploadedAt: ISOString }],
//     totalCount: number,
//     totalSizeBytes: number,
//     truncated: boolean,  // HARD_LIMIT에 걸려 추가 blob이 더 있는 경우
//     fetchedAt: ISOString
//   }
//
// **rule_4 Trust Layer**: read-only inspection이지만 transparent 데이터 노출 —
// 운영자가 외부 호스트 측 storage usage를 정확히 파악 가능.
//
// **표현 정책**: "외부 저장소" / "storage inspection" / "fetched". "법적 보관" /
// "영구 보관" 표현 0건.
// ============================================================================

import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// scope guard — STEP 61 / 62 / upload route 모두 일관된 prefix 사용
const ALLOWED_PREFIX = "artworks/";

// 페이지당 server-side fetch size (Vercel Blob list API 권장값)
const PAGE_LIMIT = 1000;

// 응답 hard cap — 비정상 폭주 차단 (호출자 UI도 이 정도면 충분히 inspection 가능)
const HARD_LIMIT = 5000;

interface BlobSummary {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export async function GET(): Promise<NextResponse> {
  // 1. 환경변수 가드
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Vercel Blob 환경변수(BLOB_READ_WRITE_TOKEN)가 설정되지 않았습니다.",
      },
      { status: 503 }
    );
  }

  const collected: BlobSummary[] = [];
  let cursor: string | undefined = undefined;
  let totalSizeBytes = 0;
  let truncated = false;

  // 2. cursor pagination 내부 처리 — 호출자는 단일 GET으로 전체 목록 받음
  try {
    type ListResult = Awaited<ReturnType<typeof list>>;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page: ListResult = await list({
        prefix: ALLOWED_PREFIX,
        limit: PAGE_LIMIT,
        cursor,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      for (const blob of page.blobs) {
        // pathname 추가 검증 — list API가 prefix 외 결과를 줄 일은 없으나
        // 방어적 가드 (Vercel SDK 변경 / 잘못된 prefix 처리 시).
        if (!blob.pathname.startsWith(ALLOWED_PREFIX)) continue;

        collected.push({
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
          uploadedAt:
            blob.uploadedAt instanceof Date
              ? blob.uploadedAt.toISOString()
              : new Date(blob.uploadedAt).toISOString(),
        });
        totalSizeBytes += blob.size;

        if (collected.length >= HARD_LIMIT) {
          truncated = true;
          break;
        }
      }

      if (truncated) break;
      if (!page.hasMore || !page.cursor) break;
      cursor = page.cursor;
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? `Vercel Blob 조회 실패: ${err.message}`
            : "Vercel Blob 조회 실패",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    blobs: collected,
    totalCount: collected.length,
    totalSizeBytes,
    truncated,
    fetchedAt: new Date().toISOString(),
  });
}
