// src/components/contract/ContractPDFDocument.tsx
//
// ContractPDFDocument — STEP 132 Phase 2 Commit 2
// InvoicePDFDocument 답습. Pre/Final 분기 없음, 금액 블록 없음, content 영역 추가.

import * as React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Contract } from "@/types/contract";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { DocumentLocale } from "@/lib/document-locale";
import { commonPDFStyles } from "@/lib/pdf/styles";
import { ensureFontsRegistered } from "@/lib/pdf/fonts";
import { formatAxidForDocument } from "@/lib/utils";
import { getTitle, getArtistName } from "@/lib/i18n-helpers";

interface Props {
  contract: Contract;
  artwork: Artwork | null;
  transaction: Transaction | null;
  locale: DocumentLocale;
  galleryName?: string;
}

const CONTRACT_STATUS_LABEL: Record<Contract["status"], string> = {
  DRAFT: "초안",
  REVIEW: "검토 중",
  APPROVED: "승인 완료",
  LOCKED: "잠금 (영구 보존)",
};

export function ContractPDFDocument({
  contract,
  artwork,
  transaction,
  locale,
  galleryName = "AXVELA Gallery",
}: Props): React.JSX.Element {
  ensureFontsRegistered();

  const createdAtFormatted = formatPdfDateTime(contract.createdAt);
  const updatedAtFormatted = formatPdfDateTime(contract.updatedAt);
  const lockedAtFormatted = contract.lockedAt
    ? formatPdfDateTime(contract.lockedAt)
    : null;

  return (
    <Document>
      <Page size="A4" style={commonPDFStyles.page}>
        <View style={commonPDFStyles.header}>
          <View style={commonPDFStyles.headerRow}>
            <Text style={commonPDFStyles.galleryName}>{galleryName}</Text>
            <Text style={commonPDFStyles.headerLabel}>CONTRACT</Text>
          </View>
          <Text style={commonPDFStyles.documentSubtitle}>
            매매 계약서 · 운영 참고용 발급 기록
          </Text>
        </View>

        <View style={{ marginBottom: 28 }}>
          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>계약 번호</Text>
            <Text style={commonPDFStyles.metadataValue}>
              {formatContractNumber(contract)}
            </Text>
          </View>
          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>생성 시각</Text>
            <Text style={commonPDFStyles.metadataValue}>{createdAtFormatted}</Text>
          </View>
          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>최근 수정</Text>
            <Text style={commonPDFStyles.metadataValue}>{updatedAtFormatted}</Text>
          </View>
          {lockedAtFormatted && (
            <View style={commonPDFStyles.metadataRow}>
              <Text style={commonPDFStyles.metadataLabel}>잠금 시각</Text>
              <Text style={commonPDFStyles.metadataValue}>{lockedAtFormatted}</Text>
            </View>
          )}
          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>상태</Text>
            <Text style={commonPDFStyles.metadataValue}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </Text>
          </View>
          {transaction && (
            <View style={commonPDFStyles.metadataRow}>
              <Text style={commonPDFStyles.metadataLabel}>매수인</Text>
              <Text style={commonPDFStyles.metadataValue}>
                {transaction.buyerName?.trim() || "—"}
              </Text>
            </View>
          )}
        </View>

        {artwork && (
          <View>
            <Text style={commonPDFStyles.sectionLabel}>대상 작품</Text>
            <View style={commonPDFStyles.artworkCard}>
              <Text style={commonPDFStyles.artworkTitle}>
                {getTitle(artwork, locale) || "(제목 없음)"}
              </Text>
              <Text style={commonPDFStyles.artworkArtist}>
                {getArtistName(artwork.artist, locale) || "—"}
                {artwork.year ? ` · ${artwork.year}` : ""}
              </Text>
              {(artwork.medium || artwork.dimensions) && (
                <Text style={commonPDFStyles.artworkMeta}>
                  {artwork.medium ?? ""}
                  {artwork.medium && artwork.dimensions ? " · " : ""}
                  {artwork.dimensions ?? ""}
                </Text>
              )}
              <Text style={commonPDFStyles.artworkAxid}>
                {formatAxidForDocument(artwork.axid)}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 24, marginBottom: 24 }}>
          <Text style={commonPDFStyles.sectionLabel}>계약 내용</Text>
          <Text style={{ fontSize: 10, lineHeight: 1.6, color: "#222222" }}>
            {contract.content || "(본문 없음)"}
          </Text>
        </View>

        <View>
          <Text style={commonPDFStyles.footer}>
            본 계약서는 갤러리 운영 참고용 발급 기록이며, 양 당사자 간 매매 합의 내용을 정리한 문서입니다.
          </Text>
          <Text style={commonPDFStyles.footerVersion}>
            v{contract.version}
            {contract.parentContractId ? " · 재작성본" : ""}
          </Text>
          <Text style={commonPDFStyles.footerGalleryAttr}>
            {galleryName} · device-local activity record
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function formatPdfDateTime(iso: string): string {
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
  return `CTR-${short}`;
}
