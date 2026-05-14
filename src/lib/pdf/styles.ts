// src/lib/pdf/styles.ts
//
// ============================================================================
// PDF Common Styles — STEP 132 Phase 2 Commit 1 (Foundation)
//
// **본 모듈의 역할**:
//   4 surface PDF (Invoice / Contract / Passport / Certificate) 의 공통
//   디자인 토큰 + StyleSheet. InvoicePrintView (STEP 129) 의 톤 답습:
//   - rule_16 minimalism (calm institutional, monochrome)
//   - Tailwind `black/X` opacity scale → rgba 변환 (9 토큰)
//   - Pretendard sans-serif 일관 + Courier mono (AXID 영역)
//
// **단위**: @react-pdf/renderer 기본 단위 = pt (1pt = 1/72 inch).
// **A4**: 595.28 × 841.89 pt (라이브러리 기본 처리).
//
// **forward-compat**:
//   Commit 1 = Invoice PDF 1 surface. Commit 2/3 (Contract/Passport)
//   에서 본 styles 재활용 + surface-specific styles 추가.
//
// **rule_16 minimalism**: 추가 dep 0, @react-pdf/renderer 의
// StyleSheet 만 사용.
// ============================================================================

import { StyleSheet } from "@react-pdf/renderer";
import { PRETENDARD_FAMILY } from "./fonts";

// ─── Color Tokens ────────────────────────────────────────────────
// InvoicePrintView 의 Tailwind `black/X` opacity scale 답습.
// rgba 형식 — @react-pdf/renderer 는 hex/rgb/rgba 지원.
export const pdfColors = {
  black: "#000000",
  black80: "rgba(0, 0, 0, 0.8)",
  black70: "rgba(0, 0, 0, 0.7)",
  black65: "rgba(0, 0, 0, 0.65)",
  black60: "rgba(0, 0, 0, 0.6)",
  black55: "rgba(0, 0, 0, 0.55)",
  black45: "rgba(0, 0, 0, 0.45)",
  black40: "rgba(0, 0, 0, 0.4)",
  black15: "rgba(0, 0, 0, 0.15)",
  white: "#FFFFFF",
} as const;

// ─── Typography Scale ────────────────────────────────────────────
// 단위: pt. InvoicePrintView 의 px 값을 1:1 사용.
export const pdfTypography = {
  headerGalleryName: 18,
  headerLabel: 10,
  documentSubtitle: 11,
  watermarkLabel: 14,
  watermarkSubtitle: 10.5,
  artworkTitle: 13,
  metadataField: 12,
  body: 12,
  bodySmall: 11.5,
  bodyTiny: 11,
  axidMono: 10.5,
  amount: 20,
  footnote: 10.5,
  footer: 10,
} as const;

// ─── Spacing Scale ───────────────────────────────────────────────
// 단위: pt. Tailwind `space-*` 와 비례.
export const pdfSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 32,
} as const;

// ─── Common StyleSheet ───────────────────────────────────────────
// 모든 PDF surface 가 재활용.
export const commonPDFStyles = StyleSheet.create({
  // A4 page wrapper
  page: {
    fontFamily: PRETENDARD_FAMILY,
    fontSize: pdfTypography.body,
    color: pdfColors.black,
    backgroundColor: pdfColors.white,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },

  // Header — gallery name (left) + document label (right) + subtitle
  header: {
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.black80,
    paddingBottom: pdfSpacing.xl,
    marginBottom: pdfSpacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  galleryName: {
    fontSize: pdfTypography.headerGalleryName,
    fontWeight: "bold",
    letterSpacing: -0.3,
  },
  headerLabel: {
    fontSize: pdfTypography.headerLabel,
    color: pdfColors.black60,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  documentSubtitle: {
    fontSize: pdfTypography.documentSubtitle,
    color: pdfColors.black60,
    marginTop: pdfSpacing.xs,
  },

  // PRE invoice / Pre-Contract watermark banner
  watermarkBanner: {
    borderWidth: 2,
    borderColor: pdfColors.black40,
    paddingHorizontal: pdfSpacing.lg,
    paddingVertical: pdfSpacing.md,
    marginBottom: pdfSpacing.xxl,
    alignItems: "center",
  },
  watermarkLabel: {
    fontSize: pdfTypography.watermarkLabel,
    fontWeight: "bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  watermarkSubtitle: {
    fontSize: pdfTypography.watermarkSubtitle,
    color: pdfColors.black65,
    marginTop: pdfSpacing.xs,
    textAlign: "center",
  },

  // Section divider lines
  borderTop: {
    borderTopWidth: 0.5,
    borderTopColor: pdfColors.black15,
  },
  borderBottom: {
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.black15,
  },

  // Metadata grid row (label + value)
  metadataRow: {
    flexDirection: "row",
    marginBottom: pdfSpacing.sm,
  },
  metadataLabel: {
    fontSize: pdfTypography.metadataField,
    color: pdfColors.black55,
    width: 120,
  },
  metadataValue: {
    fontSize: pdfTypography.metadataField,
    color: pdfColors.black80,
    flex: 1,
  },

  // Section heading (small uppercase label)
  sectionLabel: {
    fontSize: pdfTypography.headerLabel,
    color: pdfColors.black55,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: pdfSpacing.md,
  },

  // Artwork item card (Invoice / Passport / Certificate 공유)
  artworkCard: {
    borderWidth: 1,
    borderColor: pdfColors.black15,
    borderRadius: 4,
    padding: pdfSpacing.lg,
    marginBottom: pdfSpacing.xxl,
  },
  artworkTitle: {
    fontSize: pdfTypography.artworkTitle,
    fontWeight: "bold",
  },
  artworkArtist: {
    fontSize: pdfTypography.bodySmall,
    color: pdfColors.black70,
    marginTop: 2,
  },
  artworkMeta: {
    fontSize: pdfTypography.bodyTiny,
    color: pdfColors.black55,
    marginTop: pdfSpacing.xs,
  },
  artworkAxid: {
    fontSize: pdfTypography.axidMono,
    color: pdfColors.black55,
    fontFamily: "Courier",
    marginTop: pdfSpacing.sm,
  },

  // Amount block (large prominent figure)
  amountBlock: {
    borderTopWidth: 0.5,
    borderTopColor: pdfColors.black15,
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.black15,
    paddingVertical: pdfSpacing.xl,
    marginBottom: pdfSpacing.xxl,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  amount: {
    fontSize: pdfTypography.amount,
    fontWeight: "bold",
    letterSpacing: -0.2,
  },
  amountHint: {
    fontSize: pdfTypography.footnote,
    color: pdfColors.black55,
    textAlign: "right",
    marginTop: pdfSpacing.sm,
  },

  // Footer disclaimer
  footer: {
    fontSize: pdfTypography.footer,
    color: pdfColors.black55,
    lineHeight: 1.6,
  },
  footerVersion: {
    fontSize: pdfTypography.footer,
    color: pdfColors.black55,
    marginTop: pdfSpacing.sm,
  },
  footerGalleryAttr: {
    fontSize: pdfTypography.footer,
    color: pdfColors.black45,
    marginTop: pdfSpacing.md,
  },
});
