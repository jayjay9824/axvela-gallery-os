// ============================================================================
// InquiryCreateDrawer — STEP 49 (Manual Inquiry Creation).
//
// 작품 컨텍스트(artworkId)에서 운영자가 신규 inquiry를 직접 입력하는 lightweight
// drawer. 기존 InquiryDetailDrawer / InquiryForm 패턴과 톤 일관 유지하지만 별도
// 컴포넌트로 분리 — create vs edit 모드 분기로 인한 복잡도 회피.
//
// **기존 흐름과의 관계:**
//   - InquiryDetailDrawer (STEP 8/16/48): 기존 inquiry 편집
//   - InquiryCreateDrawer (STEP 49): 신규 inquiry 직접 생성
//   - 양쪽 모두 STEP 48 CustomerSuggestList 재사용 — 동일 UX
//
// **표현 정책:**
//   - "추천 후보" / "운영 참고" 사용 (STEP 48과 동일)
//   - "확정 고객 매칭" / "자동 연결됨" 0건
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  useArtworkStore,
  type InquiryCreateInput,
} from "@/store/useArtworkStore";
import {
  INQUIRY_TYPE_LABEL,
  INQUIRY_SOURCE_LABEL,
} from "@/lib/utils";
import { deriveCustomers } from "@/lib/customer-aggregates";
import {
  suggestCustomers,
  type CustomerSuggestion,
} from "@/lib/customer-suggest";
import { CustomerSuggestList } from "@/components/inquiry/CustomerSuggestList";
import type { InquirySource, InquiryType } from "@/types/inquiry";

const SOURCE_OPTIONS = (
  Object.keys(INQUIRY_SOURCE_LABEL) as InquirySource[]
).map((s) => ({ value: s, label: INQUIRY_SOURCE_LABEL[s] }));

const TYPE_OPTIONS = (Object.keys(INQUIRY_TYPE_LABEL) as InquiryType[]).map(
  (s) => ({ value: s, label: INQUIRY_TYPE_LABEL[s] })
);

// ============================================================================
// Drawer wrapper
// ============================================================================

export function InquiryCreateDrawer() {
  const request = useArtworkStore((s) => s.inquiryCreateRequest);
  const closeCreate = useArtworkStore((s) => s.closeInquiryCreate);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = request.kind === "open";
  const artworkId = request.kind === "open" ? request.artworkId : null;

  const artwork = React.useMemo(
    () => (artworkId ? artworks.find((a) => a.id === artworkId) ?? null : null),
    [artworks, artworkId]
  );

  return (
    <Drawer open={isOpen} onClose={closeCreate} title="문의 추가">
      {isOpen && artwork && (
        <InquiryCreateForm
          key={artwork.id}
          artworkId={artwork.id}
          artworkTitle={artwork.title}
          artworkAxid={artwork.axid.code}
          artworkColor={artwork.thumbnailColor}
          onCancel={closeCreate}
        />
      )}
      {isOpen && !artwork && (
        <div className="flex items-center justify-center h-full">
          <p className="text-[12px] text-ink-subtle tracking-tightish">
            대상 작품을 찾을 수 없습니다.
          </p>
        </div>
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface InquiryCreateFormProps {
  artworkId: string;
  artworkTitle: string;
  artworkAxid: string;
  artworkColor: string;
  onCancel: () => void;
}

function InquiryCreateForm({
  artworkId,
  artworkTitle,
  artworkAxid,
  artworkColor,
  onCancel,
}: InquiryCreateFormProps) {
  const createInquiry = useArtworkStore((s) => s.createInquiry);
  const allInquiries = useArtworkStore((s) => s.inquiries);
  const allTransactions = useArtworkStore((s) => s.transactions);
  const allInvoices = useArtworkStore((s) => s.invoices);

  // Form state — 신규 생성이므로 모두 빈/기본값에서 시작
  const [collectorName, setCollectorName] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [inquiryType, setInquiryType] = React.useState<InquiryType>("PRICE");
  const [source, setSource] = React.useState<InquirySource>("EMAIL");
  const [message, setMessage] = React.useState("");
  const [memo, setMemo] = React.useState("");

  // STEP 48 — Customer Suggest data pipeline (InquiryDetailDrawer와 동일 패턴)
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

  const suggestions = React.useMemo<CustomerSuggestion[]>(() => {
    return suggestCustomers(collectorName, contact, customers, {
      maxResults: 4,
      exclude: { name: collectorName, contact },
    });
  }, [collectorName, contact, customers]);

  const handleSelectSuggestion = React.useCallback(
    (s: CustomerSuggestion) => {
      const c = s.customer;
      setCollectorName(c.displayName);
      // 사용자 의도 보존 — 이미 입력된 contact는 덮어쓰지 않음
      setContact((current) => (current.trim() === "" ? c.primaryContact : current));
    },
    []
  );

  const isValid =
    collectorName.trim().length > 0 || contact.trim().length > 0 || message.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const input: InquiryCreateInput = {
      collectorName: collectorName.trim(),
      contact: contact.trim(),
      inquiryType,
      message: message.trim(),
      source,
      status: "OPEN",
      memo: memo.trim(),
    };
    const id = createInquiry(artworkId, input);
    if (id) onCancel();
  };

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

        {/* Intake hint */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-inquiry/5 border border-status-inquiry/30">
          <p className="text-[11.5px] text-status-inquiry tracking-tightish font-medium">
            신규 Inquiry 직접 생성
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish leading-relaxed">
            전화 / 이메일 / 현장 대화 / 아트페어 상담 등으로 들어온 문의를 직접
            기록합니다. 저장 시 작품이 READY / BROKERED 상태이면 INQUIRY로
            자동 전환됩니다.
          </p>
        </div>

        <FormSection label="컬렉터 정보">
          <TextField
            label="컬렉터 이름"
            value={collectorName}
            onChange={(e) => setCollectorName(e.target.value)}
            placeholder="예: Sarah Lim"
            autoFocus
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
          {/* STEP 48 패턴 재사용 — 추천일 뿐 자동 연결 0건 */}
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
            placeholder="컬렉터로부터 받은 문의 내용을 그대로 옮겨 적습니다."
            rows={4}
          />
          <Textarea
            label="내부 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="응대 우선순위 / 의도 / 컨텍스트 등 내부 메모"
            rows={2}
          />
        </FormSection>
      </div>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={!isValid}>
          저장
        </Button>
      </footer>
    </form>
  );
}

// ============================================================================
// Helpers (InquiryDetailDrawer FormSection / Divider 패턴과 동일 톤)
// ============================================================================

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold mb-2.5">
        {label}
      </h4>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-line my-5" />;
}
