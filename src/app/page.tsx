import { Sidebar } from "@/components/layout/Sidebar";
import { ArtworkGrid } from "@/components/layout/ArtworkGrid";
import { DetailPanel } from "@/components/layout/DetailPanel";
import { ArtworkFormDrawer } from "@/components/artwork/ArtworkFormDrawer";
import { TransitionConfirmModal } from "@/components/artwork/TransitionConfirmModal";
import { InquiryDetailDrawer } from "@/components/inquiry/InquiryDetailDrawer";
import { InquiryCreateDrawer } from "@/components/inquiry/InquiryCreateDrawer";
import { TransactionDetailDrawer } from "@/components/transaction/TransactionDetailDrawer";
import { InvoiceDetailDrawer } from "@/components/invoice/InvoiceDetailDrawer";
import { ReceiptDetailDrawer } from "@/components/receipt/ReceiptDetailDrawer";
import { TaxInvoiceDetailDrawer } from "@/components/tax-invoice/TaxInvoiceDetailDrawer";
import { FiscalSummaryDrawer } from "@/components/fiscal/FiscalSummaryDrawer";
import { AccountantExportDrawer } from "@/components/fiscal/AccountantExportDrawer";
import { MarketInsightDrawer } from "@/components/insight/MarketInsightDrawer";
import { PaymentRegisterDrawer } from "@/components/payment/PaymentRegisterDrawer";
import { SettlementDetailDrawer } from "@/components/settlement/SettlementDetailDrawer";
import { TaxDetailDrawer } from "@/components/tax/TaxDetailDrawer";
import { ContractDetailDrawer } from "@/components/contract/ContractDetailDrawer";
import { CurationDraftDrawer } from "@/components/curation/CurationDraftDrawer";
import { LogisticsDetailDrawer } from "@/components/logistics/LogisticsDetailDrawer";
import { LogisticsOperationsDrawer } from "@/components/logistics/LogisticsOperationsDrawer";
import { ConditionReportDrawer } from "@/components/logistics/ConditionReportDrawer";
import { InquiryResponseDrawer } from "@/components/inquiry/InquiryResponseDrawer";
import { AuditLogDrawer } from "@/components/audit/AuditLogDrawer";
import { GlobalAuditDrawer } from "@/components/audit/GlobalAuditDrawer";
import { ReportingDrawer } from "@/components/reporting/ReportingDrawer";
import { DocumentsDrawer } from "@/components/documents/DocumentsDrawer";
import { CustomerViewDrawer } from "@/components/customer/CustomerViewDrawer";
import { MarketAnalysisDrawer } from "@/components/market-analysis/MarketAnalysisDrawer";
import { ImageCleanupDrawer } from "@/components/admin/ImageCleanupDrawer";
import { AuditLogViewerDrawer } from "@/components/admin/AuditLogViewerDrawer";
import { OperationalDrilldownDrawer } from "@/components/drilldown/OperationalDrilldownDrawer";
import { PersistenceProvider } from "@/components/PersistenceProvider";

export default function HomePage() {
  return (
    <PersistenceProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
        {/* Column 1 — Sidebar */}
        <Sidebar />
        {/* Column 2 — Artwork Grid */}
        <ArtworkGrid />
        {/* Column 3 — Detail Panel (Control Center) */}
        <DetailPanel />

        {/* Layers (rule_17) — never replace the layout, only overlay */}
        <ArtworkFormDrawer />
        <TransitionConfirmModal />
        <InquiryDetailDrawer />
        <InquiryCreateDrawer />
        <TransactionDetailDrawer />
        <InvoiceDetailDrawer />
        <ReceiptDetailDrawer />
        <TaxInvoiceDetailDrawer />
        <FiscalSummaryDrawer />
        <AccountantExportDrawer />
        <MarketInsightDrawer />
        <PaymentRegisterDrawer />
        <SettlementDetailDrawer />
        <TaxDetailDrawer />
        <ContractDetailDrawer />
        <CurationDraftDrawer />
        <LogisticsDetailDrawer />
        <LogisticsOperationsDrawer />
        <ConditionReportDrawer />
        <InquiryResponseDrawer />
        <AuditLogDrawer />
        <GlobalAuditDrawer />
        <ReportingDrawer />
        <DocumentsDrawer />
        <CustomerViewDrawer />
        <MarketAnalysisDrawer />
        <ImageCleanupDrawer />
        <AuditLogViewerDrawer />
        <OperationalDrilldownDrawer />
      </div>
    </PersistenceProvider>
  );
}
