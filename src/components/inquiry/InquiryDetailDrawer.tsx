"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  useArtworkStore,
  type InquiryUpdate,
} from "@/store/useArtworkStore";
import {
  formatRelativeKR,
  INQUIRY_STATUS_LABEL,
  INQUIRY_TYPE_LABEL,
  INQUIRY_SOURCE_LABEL,
} from "@/lib/utils";
import { deriveCustomers } from "@/lib/customer-aggregates";
import {
  suggestCustomers,
  type CustomerSuggestion,
} from "@/lib/customer-suggest";
import { CustomerSuggestList } from "@/components/inquiry/CustomerSuggestList";
import type {
  Inquiry,
  InquiryStatus,
  InquirySource,
  InquiryType,
} from "@/types/inquiry";

const STATUS_OPTIONS = (
  Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]
).map((s) => ({ value: s, label: INQUIRY_STATUS_LABEL[s] }));

const SOURCE_OPTIONS = (
  Object.keys(INQUIRY_SOURCE_LABEL) as InquirySource[]
).map((s) => ({ value: s, label: INQUIRY_SOURCE_LABEL[s] }));

const TYPE_OPTIONS = (Object.keys(INQUIRY_TYPE_LABEL) as InquiryType[]).map(
  (s) => ({ value: s, label: INQUIRY_TYPE_LABEL[s] })
);

// ============================================================================
// Drawer wrapper
// ============================================================================

export function InquiryDetailDrawer() {
  const inquiryDetailRequest = useArtworkStore((s) => s.inquiryDetailRequest);
  const closeInquiryDetail = useArtworkStore((s) => s.closeInquiryDetail);
  const inquiries = useArtworkStore((s) => s.inquiries);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = inquiryDetailRequest.kind === "open";

  const inquiry: Inquiry | undefined = isOpen
    ? Object.values(inquiries)
        .flat()
        .find((i) => i.id === inquiryDetailRequest.inquiryId)
    : undefined;

  const artwork = inquiry
    ? artworks.find((a) => a.id === inquiry.artworkId)
    : undefined;

  return (
    <Drawer open={isOpen} onClose={closeInquiryDetail} title="문의 상세">
      {isOpen && inquiry && artwork && (
        <InquiryForm
          key={inquiry.id}
          inquiry={inquiry}
          artworkTitle={artwork.title}
          artworkAxid={artwork.axid.code}
          artworkColor={artwork.thumbnailColor}
          onCancel={closeInquiryDetail}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface InquiryFormProps {
  inquiry: Inquiry;
  artworkTitle: string;
  artworkAxid: string;
  artworkColor: string;
  onCancel: () => void;
}

function InquiryForm({
  inquiry,
  artworkTitle,
  artworkAxid,
  artworkColor,
  onCancel,
}: InquiryFormProps) {
  const updateInquiry = useArtworkStore((s) => s.updateInquiry);

  // STEP 48 — Customer Suggest용 store 슬라이스 read-only 추출.
  // deriveCustomers는 매번 가벼움 (mock data scale) — drawer가 닫혀있는 동안에는
  // 컴포넌트 자체가 unmount이므로 cost 영향 0.
  const allInquiries = useArtworkStore((s) => s.inquiries);
  const allTransactions = useArtworkStore((s) => s.transactions);
  const allInvoices = useArtworkStore((s) => s.invoices);

  const [collectorName, setCollectorName] = React.useState(
    inquiry.collectorName
  );
  const [contact, setContact] = React.useState(inquiry.contact);
  const [inquiryType, setInquiryType] = React.useState<InquiryType>(
    inquiry.inquiryType
  );
  const [message, setMessage] = React.useState(inquiry.message);
  const [source, setSource] = React.useState<InquirySource>(inquiry.source);
  const [status, setStatus] = React.useState<InquiryStatus>(inquiry.status);
  const [memo, setMemo] = React.useState(inquiry.memo ?? "");

  // STEP 48 — Customer Suggest. CustomerViewDrawer / ReportingDrawer 패턴과 동일.
  const invoiceFxLookup = React.useMemo(() => {
    const lookup: Record<string, { fxRate?: number }> = {};
    for (const invList of Object.values(allInvoices)) {
      for (const inv of invList) {
        const existing = lookup[inv.transactionId];
        if (!existing || inv.isLocked) {
          lookup[inv.transactionId] = { fxRate: inv.fxSnapshot?.rate };
        }
      }
    }
    return lookup;
  }, [allInvoices]);

  const customers = React.useMemo(() => {
    const flatInq = Object.values(allInquiries).flat();
    const flatTx = Object.values(allTransactions).flat();
    return deriveCustomers(flatInq, flatTx, invoiceFxLookup);
  }, [allInquiries, allTransactions, invoiceFxLookup]);

  // 추천 후보 — collectorName / contact 입력값 기반. 이미 form에 들어있는
  // 값과 정확히 일치하는 customer는 제외 (이미 반영된 후보 노출은 의미 없음).
  const suggestions = React.useMemo<CustomerSuggestion[]>(() => {
    return suggestCustomers(collectorName, contact, customers, {
      maxResults: 4,
      exclude: { name: collectorName, contact },
    });
  }, [collectorName, contact, customers]);

  // 후보 클릭 → form 입력값 채움. **저장은 별도 — 사용자가 명시적으로 저장**
  // 버튼 클릭해야 inquiry 업데이트. "자동 연결" 0건 — 추천일 뿐.
  const handleSelectSuggestion = React.useCallback(
    (s: CustomerSuggestion) => {
      const c = s.customer;
      setCollectorName(c.displayName);
      // 연락처는 비어있을 때만 채움 — 사용자가 의도적으로 입력한 contact를 덮어쓰지 않음
      setContact((current) => {
        if (current.trim() === "") return c.primaryContact;
        return current;
      });
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: InquiryUpdate = {
      collectorName: collectorName.trim(),
      contact: contact.trim(),
      inquiryType,
      message: message.trim(),
      source,
      status,
      memo: memo.trim(),
    };
    updateInquiry(inquiry.id, patch);
    onCancel();
  };

  const isEmpty = !inquiry.collectorName.trim();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Linked artwork header */}
        <div className="mb-5 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <div
            aria-hidden
            className="h-9 w-9 rounded border border-line shrink-0"
            style={{ backgroundColor: artworkColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 작품
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
              {artworkTitle}
            </p>
            <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
              {artworkAxid}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2">
          <Meta label="생성" value={formatRelativeKR(inquiry.createdAt)} />
          <Meta label="최근 갱신" value={formatRelativeKR(inquiry.updatedAt)} />
        </div>

        {isEmpty && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-inquiry/5 border border-status-inquiry/30">
            <p className="text-[11.5px] text-status-inquiry tracking-tightish font-medium">
              자동 생성된 Inquiry입니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              컬렉터 정보와 문의 내용을 입력해 주세요.
            </p>
          </div>
        )}

        <FormSection label="컬렉터 정보">
          <TextField
            label="컬렉터 이름"
            value={collectorName}
            onChange={(e) => setCollectorName(e.target.value)}
            placeholder="예: Sarah Lim"
            autoFocus={isEmpty}
          />
          <TextField
            label="연락처"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="이메일 또는 전화번호"
          />
          <Select
            label="유입 경로"
            value={source}
            onChange={(e) => setSource(e.target.value as InquirySource)}
            options={SOURCE_OPTIONS}
          />
          {/* STEP 48 — Inquiry intake 시 기존 고객 후보 추천. 추천일 뿐
              자동 연결되지 않음 (rule_5 AI-Human Loop 정책 일관). */}
          <CustomerSuggestList
            suggestions={suggestions}
            onSelect={handleSelectSuggestion}
          />
        </FormSection>

        <Divider />

        <FormSection label="문의 내용">
          <Select
            label="문의 종류"
            value={inquiryType}
            onChange={(e) => setInquiryType(e.target.value as InquiryType)}
            options={TYPE_OPTIONS}
          />
          <Textarea
            label="메시지"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="컬렉터의 문의 내용을 입력하세요"
            rows={4}
          />
        </FormSection>

        <Divider />

        <FormSection label="갤러리 운영">
          <Select
            label="상태"
            value={status}
            onChange={(e) => setStatus(e.target.value as InquiryStatus)}
            options={STATUS_OPTIONS}
            hint="상태 변경 시 Living Timeline에 기록됩니다"
          />
          <Textarea
            label="내부 메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="컬렉터에게는 보이지 않는 내부용 메모"
            rows={3}
          />
        </FormSection>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" variant="primary">
          변경 저장
        </Button>
      </footer>
    </form>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
        {label}
      </p>
      <p className="text-[12px] text-ink-muted mt-0.5 tracking-tightish">
        {value}
      </p>
    </div>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line my-5" aria-hidden />;
}
