# STEP — Scoped Document Trust & Lifecycle Clarity — Completion Report

## State

**STEP UX-1 baseline (150 kB) → Document Lifecycle (154 kB).**
Build / type-check / lint all green.
Route delta: **+4 kB** (5 new components + 1 helper module + drawer wiring).
ZIP: `axvela-document-lifecycle-clarity.zip`.

---

## 1. 현재 invoice/contract lifecycle UX 분석

### 분석 결과
- ✅ **Invoice 도메인** 이미 상당히 정착 — version chain (parentInvoiceId) / FX snapshot / 상태 머신 / Lock 표시
- ✅ **Contract 도메인** 동일 수준 — DRAFT/REVIEW/APPROVED/LOCKED/SENT
- ✅ **TimelineEvent 시스템** — relatedEntityType + relatedEntityId 으로 Invoice/Contract 활동 이미 추적 중
- ❌ **그러나 UI에서**: 단순 metadata grid + "이 문서는 잠겨 있습니다" + "새 버전 생성" button만 노출 → 사용자 통증

### 식별된 missing operational visibility layers
1. ❌ "지금 뭐 해야 하지?" 답이 없음
2. ❌ Locked 톤이 *기술적/죽은 느낌* (institutional/operational 아님)
3. ❌ Version 관계 시각화 부재 (어느 게 *현재 활성*인지 모호)
4. ❌ Activity timeline 부재 (누가 / 언제 / 무슨 일 발생했는지)
5. ❌ State badge 산발 (lock / status 따로 표시)
6. ❌ 새 버전 생성 시 *왜* 생성됐는지 기록 안 됨
7. ❌ Approval Workflow architecture 신호 부재

---

## 2. 변경 파일 목록

| File | Change | LOC |
|---|---|---|
| `src/lib/document-lifecycle.ts` | **신규** — pure helpers | ~250 |
| `src/components/document-lifecycle/NextActionBanner.tsx` | **신규** | ~80 |
| `src/components/document-lifecycle/DocumentActivityTimeline.tsx` | **신규** | ~150 |
| `src/components/document-lifecycle/VersionHistoryStrip.tsx` | **신규** | ~120 |
| `src/components/document-lifecycle/ApprovalSlotPlaceholder.tsx` | **신규** | ~70 |
| `src/components/document-lifecycle/StateBadgeStrip.tsx` | **신규** | ~80 |
| `src/types/invoice.ts` | `revisionReason?` 옵셔널 필드 추가 | +5 |
| `src/store/useArtworkStore.ts` | `createInvoiceVersion(...)` signature 확장 | +30 |
| `src/components/invoice/InvoiceDetailDrawer.tsx` | 5 컴포넌트 wiring + locked 톤 재작성 | ~150 |
| `src/components/contract/ContractDetailDrawer.tsx` | parity (Activity + Approval slot only) | ~50 |
| `ARCHITECTURE.md` | entry append | ~10 KB |
| `STEP_DOCUMENT_LIFECYCLE_CLARITY_COMPLETE.md` | 본 보고서 | — |

**신규 폴더**: `src/components/document-lifecycle/` (5 컴포넌트, 향후 Receipt / Certificate / Tax Invoice 도메인 자연 확장 가능)

---

## 3. 7개 spec 항목 — 적용 결과

### ✅ 1. Document Activity Timeline (Invoice + Contract 양쪽)
Apple Wallet / DocuSign 톤. TimelineEvent에서 derive — *기존 audit-derived events*만 표시.
- 좌측 작은 dot + 세로 dashed line (계보)
- timestamp + actor (직원/매니저/대표 라벨) + title + detail
- maxItems=12 + overflow 안내

### ✅ 2. Locked Document UX rewrite (Invoice)
```
BEFORE:  "이 문서는 잠겨 있습니다"
AFTER:   "이 문서는 최종 발송본입니다" / "결제 완료된 발송본입니다" / "이전 발행본입니다"
         + 최종 발송 시각 prominent
         + 잠금 시각
         + 생성 사유 (있으면)
```

### ✅ 3. Next Required Action (Invoice)
NextActionBanner — drawer 최상단:
- DRAFT → "발송 필요" (primary 검은 left-border)
- SENT → "결제 등록 가능" (info)
- PAID → "정산 진행 가능" (info)
- archived → "새 버전 존재" (neutral)

### ✅ 4. Version History Visualization (Invoice)
VersionHistoryStrip:
- v3 (현재) — bg-surface + border-line-strong 강조
- v2 — bg-surface-muted 흐림 + "→ v3로 대체됨"
- v1 — bg-transparent 더 흐림 + "이전 발행본"
- 단일 version chain 시 자동 숨김

### ✅ 5. Revision Reason Field (Invoice)
`Invoice.revisionReason?: string` 옵셔널 필드:
- `window.prompt`로 옵셔널 입력 (rule_16 minimalism — 큰 modal 회피)
- 취소 시 새 버전 생성 안 함, 빈 입력 시 사유 없이 생성
- TimelineEvent detail에 `· 사유: 가격 수정` 형식으로 reflect
- v1 호환, validateV1 무영향

### ✅ 6. State Badge Refinement (Invoice)
StateBadgeStrip — monochrome:
- 초안 / 발송 완료 / 결제 완료 / 잠금 / 새 버전 존재
- ink / ink-muted / ink-subtle 톤만 (rainbow 0)
- dot은 sent/paid에만 (의미 있는 상태 신호)

### ✅ 7. Approval Workflow Reserved Slot (Invoice + Contract)
ApprovalSlotPlaceholder:
- "검토자 / 최종 승인" 자리만 표시
- "STEP 101+ 예정" / "준비 중" 라벨
- 운영자에게 *future-ready architecture* 신호
- AXVELA_TRUST_LAYER 정책 일관

---

## 4. Scoped Subset 전략 — 명확한 분리

### ✅ 이번 STEP 구현
- Document Activity Timeline (Invoice + Contract)
- Locked UX (Invoice)
- Next Action banner (Invoice)
- Version History (Invoice)
- Revision Reason (Invoice)
- State Badges (Invoice)
- Approval Slot Reserved (Invoice + Contract)

### ❌ 이번 STEP 제외 (정책 / 데이터 / scope)
- Contract NextAction → STEP 103 (state machine REVIEW/APPROVED은 approval territory)
- Contract VersionHistory → STEP 103
- 검토 거절 + 메모 UI → STEP 103
- 진짜 검토자/승인자 데이터 → STEP 101+ Approval Workflow
- 고객 열람 추적 → out of scope (email integration 부재)
- 전자서명 → out of scope
- Receipt / Certificate / Tax Invoice 도메인 → STEP 86~91 Fiscal Layer

---

## 5. Persistence Impact

**Schema 변경 1줄 — v1 호환**:
- `Invoice.revisionReason?: string` 옵셔널 필드 추가
- `validateV1` 무영향 (옵셔널 필드 추가는 schema breaking change 0건)
- `SCHEMA_VERSION` 유지
- 기존 데이터 영향 0건 (기존 invoice의 revisionReason은 undefined)
- 새 invoice는 빈 사유로 생성되거나, prompt 응답 시 채워짐

---

## 6. AI / Trust Layer 정책 준수

### AXVELA_AI_DIRECTION.md 정책 준수 ✓
- AI / Market Intelligence 영역 무관 (document lifecycle 전용)
- 금지 표현 0건 (verified): "AI Estimated Price", "확정 시장가", "투자 보장" 등
- rule_5 AI-Human Loop 일관 (AI 자동 생성 0건, 모든 action 사용자 명시)

### AXVELA_TRUST_LAYER.md 정책 준수 ✓
- Approval Workflow 본격 구현 0건
- 검토자/최종승인자 데이터 0건 — ApprovalSlotPlaceholder "준비 중" 표시만
- Reserved slot 정책 정확 구현 — 향후 STEP 101+ 활성 시 동일 위치에 실제 컴포넌트로 교체
- RBAC 변경 0줄 (hasPermission / ROLE_RANK 그대로)

### Forbidden Language Verification
```
$ grep -rnE "법적 효력|공인 승인|compliance verified|tamper-proof|forensic record|certified approval" \
    src/lib/document-lifecycle.ts \
    src/components/document-lifecycle/ \
    src/components/invoice/ \
    src/components/contract/

→ 0 matches in UI / message / hint / placeholder
```

권장 표현 사용:
- "다음 작업" / "최종 발송본" / "결제 완료된 발송본" / "이전 발행본" / "잠금 시각" / "생성 사유" / "준비 중" / "STEP 101+ 예정" / "운영 활동" / "(기록 없음)"

---

## 7. Build / Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                 — No ESLint warnings or errors
✓ npx next build                — Route 154 kB / First Load 241 kB (+4 kB)
```

| 검증 항목 | 결과 |
|---|---|
| Document Activity Timeline (Invoice + Contract) | ✅ |
| Locked Document 운영 톤 재작성 | ✅ |
| Next Required Action 1개 (Invoice) | ✅ STEP UX-1 정책 일관 |
| Version History Visualization (Invoice) | ✅ |
| Revision Reason persistence (Invoice) | ✅ v1 호환 |
| State Badge Refinement (Invoice) | ✅ monochrome |
| Approval Workflow Reserved Slot | ✅ AXVELA_TRUST_LAYER 정책 |
| 신규 라이브러리 추가 | ✅ 0개 |
| Build / type-check / lint | ✅ 모두 통과 |

---

## 8. Before / After UX Reasoning

### BEFORE — 사용자가 본 화면 (production)
```
이 문서는 잠겨 있습니다
발송 완료 — 이 버전은 수정할 수 없습니다.
잠금 시각 · N분 전

청구 금액
[금액] [통화]

FX 환율 스냅샷
[fx panel]

문서 이력
Invoice ID  inv_xxx
발행        N분 전
발송        N분 전
결제        —

[취소]  [새 버전 생성]
```
운영자 통증: *"지금 뭐 해야 하지? / 누가 만들었지? / 어느 version이 활성이지? / 사용 가능한 다음 action은?"*

### AFTER — 이번 STEP 적용 후
```
[다음 작업]  결제 등록 가능
            결제 확인 후 작품 상세에서 결제를 등록하세요.

[발송 완료] [잠금]                         ← multi-state badges

🔒 이 문서는 최종 발송본입니다.
   현재 버전(v1)은 보호 상태이며 수정할 수 없습니다.
   변경이 필요한 경우 새 버전을 생성하세요.
   최종 발송 · N분 전
   잠금 시각 · N분 전

청구 금액 / FX 환율 스냅샷 / 문서 이력 (기존 그대로)

[버전 이력]
v3 (현재)  발송 완료              ₩2,000,000,000  ← 강조
v2         → v3로 대체됨           ₩1,950,000,000  ← 흐림
v1         이전 발행본              ₩1,800,000,000  ← 더 흐림

[문서 활동]
●  Invoice 새 버전 생성             2026.05.07 09:44
│  v2 → v3 · ₩2,000,000,000 · 초안 · 사유: 가격 수정
│  매니저 · J. Han
●  Invoice 발송                     2026.05.07 09:25
│  v2 발송 — Lock 적용
│  대표 · Jaeson Park
●  Invoice 생성                     2026.05.07 09:12
   v1 초안 자동 생성
   AXVELA OS

[승인 워크플로우 — 준비 중]
검토자       STEP 101+ 예정
최종 승인     STEP 101+ 예정
Approval Workflow는 향후 STEP에서 활성됩니다 — 현재는 RBAC 권한 게이트만 적용됩니다.
```

운영자 즉시 인지: *"다음 결제 등록 가능 / 매니저가 가격 수정으로 새 버전 생성 / 대표가 발송 / 향후 검토자/승인자 자리 예약됨"*.

**예상 효과**: 사용자 spec "이 STEP은 ~70% '느낌 죽었다' 통증 해결" 충족.

---

## 9. Risk Assessment

**🟡 Medium Risk** — Invoice locked view는 daily-use 핵심 surface.

| 영역 | 변경 |
|---|---|
| Invoice locked view rendering | 5개 신규 section 삽입 (회귀 영향 가능) |
| `createInvoiceVersion` signature | 옵셔널 매개변수 추가 (기존 호출자 영향 0) |
| Persistence schema | 옵셔널 필드 추가 (v1 호환, 기존 데이터 영향 0) |
| Contract drawer | 2개 section 삽입 (Activity + Approval slot only) |
| 다른 모든 도메인 (Inquiry/Transaction/Settlement/Tax/FX/Customer/Logistics/Image/Audit/Backup/Permission/Export/Trend/Drilldown) | **0줄 변경** |
| Sidebar / 3-Column / Artwork form / state-machine | **0줄 변경** |
| package.json | **0줄** |

---

## 10. 다음 STEP 권장 (mid-update 검증 후)

```
[지금]      이 ZIP 배포 + 며칠 사용 검증
            → "느낌 죽었다" 통증이 해결되었는지
            → Activity timeline이 운영자에게 명확한지
            → "다음 작업" 라벨이 자연스러운지
   ↓
[검증 후]   다음 후보:
   🅐 STEP 86 — Document Trust Metadata (Phase 1 Fiscal 시작, ~250 LOC, 🟡)
       → Receipt / Certificate / Tax Invoice 도메인 entity 정착
   🅑 STEP UX-2 — Sidebar Grouping (~150 LOC, 🟢 low)
   🅒 STEP UX-3 — Detail Panel Reordering (~300 LOC, 🟠)
```

**제 추천**: 🅐 STEP 86 — Document Lifecycle 인프라가 자리 잡았으니 다음은 *fiscal entity* 정착. Receipt / Certificate / Tax Invoice가 들어오면 같은 lifecycle 컴포넌트들이 자연 재사용됨 (Scoped Subset 전략의 효과).

---

## 11. Composability — 향후 도메인 확장

본 STEP의 5개 컴포넌트는 모두 *재사용 가능*:

| 컴포넌트 | Invoice | Contract | Receipt (STEP 87) | Certificate (STEP 90) | Tax Invoice (STEP 89) |
|---|---|---|---|---|---|
| `NextActionBanner` | ✅ | 🟡 STEP 103 | ✅ | ✅ | ✅ |
| `DocumentActivityTimeline` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `VersionHistoryStrip` | ✅ | 🟡 STEP 103 | 🟡 (단순 receipt는 무관) | ✅ | ✅ |
| `ApprovalSlotPlaceholder` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `StateBadgeStrip` | ✅ | 🟡 STEP 103 | ✅ | ✅ | ✅ |

각 fiscal domain STEP에서 본 컴포넌트들을 그대로 import → 일관된 운영 경험.
