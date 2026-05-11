"use client";

/**
 * Empty-state guidance card for fresh resale transactions (STEP 14).
 *
 * Replaces the four otherwise-empty summary cards (Settlement / Tax /
 * Contract / Logistics) when the active transaction is a resale that hasn't
 * generated any child records yet. The user explicitly required:
 *
 *   "비어있는 카드 그대로 두지 말 것 / 에러처럼 보이게 하지 말 것"
 *
 * So instead of four separate empty states (which read as "something's broken"),
 * we surface one calm, informational card explaining what just happened and
 * what comes next.
 *
 * Visibility is controlled by DetailPanel; this component is purely
 * presentational — no store reads, no actions.
 */
export function NewResaleStartCard() {
  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader label="새 거래 진행 상황" hint="대기 중" />

      <div className="mt-3 rounded-md border border-line bg-surface-muted/50 px-4 py-4">
        <div className="flex items-start gap-3">
          {/* Subtle resale-tone indicator dot, matching the Resale badge */}
          <span
            aria-hidden
            className="h-2 w-2 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: "#5E3FB8" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink tracking-tight2">
              새 재판매 거래가 시작되었습니다
            </p>
            <p className="mt-1.5 text-[12px] text-ink-muted leading-relaxed tracking-tightish">
              계약, 결제, 정산, 세무, 물류 정보는
              <br />
              이후 단계에서 생성됩니다.
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              <Step label="구매자 확인 및 가격 협상" />
              <Step label="계약서 작성 및 승인" />
              <Step label="결제 등록 및 정산" />
              <Step label="물류 배정 및 인도" />
            </ul>
          </div>
        </div>

        <p className="mt-4 pt-3 border-t border-line text-[10.5px] text-ink-subtle tracking-tightish">
          이전 거래의 정산 · 계약 · 세무 · 물류 기록은 영구 보존되며
          <br />
          위 Transaction History에서 확인 가능합니다.
        </p>
      </div>
    </section>
  );
}

function Step({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-1 w-1 rounded-full bg-ink-subtle shrink-0"
      />
      <span className="text-[11.5px] text-ink-muted tracking-tightish">
        {label}
      </span>
    </li>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}
