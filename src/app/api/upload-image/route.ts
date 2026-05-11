// ============================================================================
// API Route — POST /api/upload-image (STEP 57).
//
// Vercel Blob storage 업로드 endpoint. 클라이언트(VercelBlobImageStorageProvider)
// 가 multipart/form-data로 file을 보내면 서버측에서 `@vercel/blob.put()` 호출 후
// 결과 URL + pathname 반환.
//
// **보안 / 운영 정책:**
//   - 환경변수 `BLOB_READ_WRITE_TOKEN` 부재 시 503 graceful 응답 — 클라이언트가
//     catch → LocalPreviewProvider로 fallback (사용자 흐름 끊김 0건).
//   - 입력 가드 — image/* MIME + 3MB 한도 (dispatcher와 일관).
//   - public access — Vercel Blob의 url은 카드 / hero `<img src>`에 그대로 사용.
//   - 파일명은 timestamp + random suffix로 collision 회피 + audit 추적성.
//
// **rule_4 Trust Layer**: 업로드 결과는 `url + pathname`만 반환 — 클라이언트가
// 그 값으로 ImageUploadResult를 구성해 store에 영속화. 외부 URL은 immutable —
// 한 번 업로드된 이미지는 외부 host에 그대로 보존.
// ============================================================================

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

// Node.js runtime — @vercel/blob의 put()은 server-side에서만 동작.
// edge runtime은 일부 features 제한이 있으므로 명시적으로 nodejs 사용.
export const runtime = "nodejs";

// 입력 가드 — dispatcher와 일관 (3MB).
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  // 1. 환경변수 가드 — 토큰 부재 시 graceful 503.
  //    클라이언트는 503을 catch하고 LocalPreviewProvider로 fallback.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob 환경변수(BLOB_READ_WRITE_TOKEN)가 설정되지 않았습니다.",
      },
      { status: 503 }
    );
  }

  // 2. multipart/form-data 파싱
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "form-data 파싱 실패" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file 필드가 누락되었습니다." },
      { status: 400 }
    );
  }

  // 3. 입력 가드 — dispatcher와 일관 (이중 가드 — 클라이언트가 우회해도 서버에서 차단)
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "이미지 파일만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `이미지 크기 한도 초과 (최대 ${MAX_IMAGE_SIZE_BYTES} bytes).`,
      },
      { status: 413 }
    );
  }

  // 4. 파일명 생성 — timestamp + random suffix
  //    (audit 추적성 + collision 회피).
  const ext = pickExtension(file.type);
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const pathname = `artworks/${ts}-${rand}${ext}`;

  // 5. Vercel Blob put — public access (img src로 그대로 사용)
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      // STEP 57 v1: addRandomSuffix는 이미 pathname에 random suffix가 있으므로 false
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Vercel Blob 업로드 실패: ${err.message}`
            : "Vercel Blob 업로드 실패",
      },
      { status: 502 }
    );
  }
}

function pickExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      // 모르면 빈 문자열 — Vercel Blob이 mime을 자체 처리
      return "";
  }
}
