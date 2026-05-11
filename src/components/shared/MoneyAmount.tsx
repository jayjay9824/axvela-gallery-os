// ============================================================================
// MoneyAmount — STEP 36 (Settlement Currency-aware Net)
//
// Settlement / Tax / Invoice 등 다양한 곳에서 화폐 금액을 일관되게 표시하기
// 위한 작은 view helper. **계산 로직 0줄 변경 — display only**.
//
// 정책:
//   - KRW 금액은 단일 라인 (₩XX,XXX,XXX)
//   - 외화 금액은 메인 라인 (예: USD 1,000.00) + 보조 라인 (≈ ₩1,375,000)
//     — 사용자가 원통화와 KRW 환산을 동시에 인지 가능
//   - convertedKRW 부재 (fxSnapshot 없는 외화) 시 메인 라인만 + 작은 회색
//     "환산 정보 없음" 보조 라인
//
// 사용 예:
//   <MoneyAmount amount={1000} currency="USD" convertedKRW={1375000} />
//   <MoneyAmount amount={48200000} currency="KRW" />
//
// rule_3 (Money Flow 분리 — view에서도 명확) + rule_20 (FX) 정합.
// "회계 확정" / "법적 효력" 표현 0건.
// ============================================================================

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/transaction";

const KRW_FORMATTER = new Intl.NumberFormat("ko-KR");
const NUM_FORMATTER = new Intl.NumberFormat("en-US");

export function formatKRWInline(amount: number): string {
  return `₩${KRW_FORMATTER.format(Math.round(amount))}`;
}

export function formatForeignAmount(amount: number, currency: Currency): string {
  if (currency === "KRW") return formatKRWInline(amount);
  return `${currency} ${NUM_FORMATTER.format(amount)}`;
}

interface MoneyAmountProps {
  amount: number;
  currency: Currency;
  /** 외화일 때만 의미 있음. 부재 시 "환산 정보 없음" 보조 라벨 표시. */
  convertedKRW?: number;
  /** 강조 (메인 amount = 더 큰 숫자) — Settlement netToArtist 등에 사용 */
  emphasized?: boolean;
  /** 흐릿하게 — Settlement platformFee 등 부수 항목에 사용 */
  muted?: boolean;
  /** 우측 정렬 (테이블 내부 등) */
  align?: "left" | "right";
}

export function MoneyAmount({
  amount,
  currency,
  convertedKRW,
  emphasized,
  muted,
  align = "right",
}: MoneyAmountProps) {
  const isKRW = currency === "KRW";

  const mainText = isKRW
    ? formatKRWInline(amount)
    : formatForeignAmount(amount, currency);

  const mainCls = cn(
    "tabular-nums tracking-tight2",
    emphasized
      ? "text-[14px] text-ink font-semibold"
      : muted
      ? "text-[13px] text-ink-subtle"
      : "text-[13px] text-ink-muted"
  );

  const containerCls = cn(
    "flex flex-col",
    align === "right" ? "items-end" : "items-start"
  );

  // KRW 거래는 단일 라인
  if (isKRW) {
    return (
      <span className={containerCls}>
        <span className={mainCls}>{mainText}</span>
      </span>
    );
  }

  // 외화 거래
  return (
    <span className={containerCls}>
      <span className={mainCls}>{mainText}</span>
      {convertedKRW !== undefined ? (
        <span className="text-[10.5px] tabular-nums tracking-tightish text-ink-subtle mt-0.5">
          ≈ {formatKRWInline(convertedKRW)}
        </span>
      ) : (
        <span className="text-[10px] tracking-tightish text-amber-700 mt-0.5">
          환산 정보 없음
        </span>
      )}
    </span>
  );
}
