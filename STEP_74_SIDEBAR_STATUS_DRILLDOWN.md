# STEP 74 — Sidebar Artwork Status Drilldown

> **목표**: STEP 67의 기존 `artwork_state` 도메인을 그대로 재사용하여 Sidebar에
> "작품 상태" 섹션 추가. 작품 상태 metric이 *passive 분포 표시*에서
> *연결 작품 list → DetailPanel sync* 흐름으로 전환.
> Artwork-First 원칙의 시각적 정점 — 운영자의 첫 시야에서 바로 SSOT로 진입.

---

## State

- **이전**: STEP 73 / Route 141 kB
- **이번**: STEP 74 / **Route 141 kB (+0 kB — Sidebar 변경 매우 경량)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 신규 도메인

**0개** — 사용자 spec 명시대로 기존 STEP 67 `artwork_state` 도메인 재사용.

---

## Resolver 변경

기존 `resolveArtworkState` 함수의 row columns 확장:

| Before (3 cols) | After (6 cols) |
|---|---|
| 작품 (meta=artist) / 상태 / 최근 변경 | 작품 (meta=axid.code) / **작가** / 상태 / **가격** / **통화** / 최근 변경 |

사용자 spec의 "rows should include: artwork / artist / current status / price / currency / last updated" 충족.

```ts
function resolveArtworkState(payload, state) {
  const target = payload.artworkState;
  const filtered = target ? artworks.filter(a => a.state === target) : artworks;
  // sort by updatedAt desc

  rows = sorted.map(a => ({
    artworkId: a.id,
    cells: {
      artwork: { text: a.title, meta: a.axid.code },
      artist: { text: a.artist.name },
      state: { text: STATE_LABEL_KR[a.state], tone: artworkStateTone(a.state) },
      price: { text: a.priceKRW > 0 ? `₩X,XXX,XXX` : "—" },
      currency: { text: "KRW" },
      updated: { text: formatDateOnlyKR(a.updatedAt) },
    },
  }));

  return {
    title: `작품 상태 — ${stateLabel || "전체"}`,
    context: `${rows.length}건 · 최근 변경순 · 작품 이동 가능`,
    columns: [artwork, artist, state, price, currency, updated],
    rows,
  };
}
```

undefined target 처리 그대로 (전체 작품 표시) — 사용자 spec "Total count" 흐름 자연 동작.

---

## ArtworkState union (현재 도메인)

```ts
export type ArtworkState =
  | "DRAFT" | "READY" | "INQUIRY" | "DEAL"
  | "PAID" | "CLOSED" | "REOPENED" | "BROKERED";
```

**사용자 spec mentions HOLD / CANCELLED — 본 union에 부재**. 향후 union 확장 시 자동 지원되도록 resolver는 union 그대로 사용 (rule_6 lifecycle).

---

## Sidebar Integration Sites (9개)

신규 "작품 상태" 섹션 1개 추가 — Workspace NavGroup ↔ Operations NavGroup 사이.

| Site | Domain | Inherit |
|---|---|---|
| 전체 row | `artwork_state` | undefined (resolver 전체 표시) |
| DRAFT row | `artwork_state` | DRAFT |
| READY row | `artwork_state` | READY |
| INQUIRY row | `artwork_state` | INQUIRY |
| DEAL row | `artwork_state` | DEAL |
| PAID row | `artwork_state` | PAID |
| CLOSED row | `artwork_state` | CLOSED |
| REOPENED row | `artwork_state` | REOPENED |
| BROKERED row | `artwork_state` | BROKERED |

count = 0이면 ClickableMetric의 disabled 처리 (cursor-not-allowed + opacity-60).

### Render 구조 (rule_16 institutional minimalism)

```tsx
<div className="mt-5 px-2">
  <p className="px-1 mb-2 flex items-baseline justify-between">
    <span>작품 상태</span>
    <span>{artworks.length}</span>
  </p>

  {/* 전체 row — border-line bg-surface 강조 */}
  <ClickableMetric onClick={() => openDrilldown({ domain: "artwork_state" })}>
    <div className="flex items-center justify-between px-2.5 py-1 rounded-md border bg-surface">
      <span>전체</span>
      <span>{artworks.length}</span>
    </div>
  </ClickableMetric>

  {/* 8 상태별 row — STATUS_ORDER 자연 lifecycle 순서 */}
  <ul className="flex flex-col gap-0.5">
    {STATUS_ORDER.map(s => (
      <li key={s}>
        <ClickableMetric
          onClick={() => openDrilldown({ domain: "artwork_state", artworkState: s })}
          disabled={statusCounts[s] === 0}
        >
          <div className="flex items-center justify-between px-2.5 py-1 rounded-md">
            <span>{STATE_LABEL_KR[s]}</span>
            <span>{statusCounts[s]}</span>
          </div>
        </ClickableMetric>
      </li>
    ))}
  </ul>
</div>
```

**STATUS_ORDER 자연 lifecycle 순서**: DRAFT → READY → INQUIRY → DEAL → PAID → CLOSED → REOPENED → BROKERED (rule_6).

Sidebar 240px width 그대로, 신규 섹션 compact (px-2.5 py-1 row, gap-0.5).

---

## Drilldown Flow 시나리오

```
[1] 운영자 출근, 갤러리 OS 첫 화면 진입
[2] Sidebar "작품 상태" 섹션에서 분포 한눈에 확인
    │ 전체   124    │
    │ DRAFT   12   │
    │ READY   38   │
    │ INQUIRY 23   │  ← 클릭 (오늘 우선 처리할 흐름)
    │ DEAL    15   │
    │ PAID     8   │
    │ CLOSED  21   │
    │ REOPENED 5   │
    │ BROKERED 2   │
[3] openDrilldown({ domain: "artwork_state", artworkState: "INQUIRY" })
[4] OperationalDrilldownDrawer 열림 (820px)
    ┌───────────────────────────────────────────────────────────┐
    │ 작품 상태 — 문의 진행                                       │
    │ 23건 · 최근 변경순 · 작품 이동 가능                          │
    ├───────────────────────────────────────────────────────────┤
    │ 작품         작가      상태       가격         통화  최근  │
    │ The Shore  김 작가  ●문의진행  ₩3,200,000  KRW  05-04  │
    │ Quiet Hour Lee 작가 ●문의진행  ₩4,500,000  KRW  05-03  │
    │ ...                                                       │
    └───────────────────────────────────────────────────────────┘
[5] 운영자: "Quiet Hour" row 클릭
[6] setSelectedArtwork → closeDrilldown → DetailPanel sync
[7] 작품 timeline 진입 — inquiry / 거래 협상 → 다음 액션
```

---

## 변경 / 신규 파일

### 신규 (1)

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_74_SIDEBAR_STATUS_DRILLDOWN.md` | (이 문서) | 완료 보고 |

### 변경 (2 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/lib/drilldown-resolver.ts` | ~30 LOC | resolveArtworkState columns 확장 (artist + price + currency) |
| `src/components/layout/Sidebar.tsx` | ~95 LOC | "작품 상태" 신규 섹션 1개 + statusCounts useMemo + STATUS_ORDER + imports |

---

## 검증 매트릭스

### 사용자 spec 8개 검증 항목

| 항목 | 결과 |
|---|---|
| Sidebar 9 클릭 site (전체 + 8 상태) | ✅ |
| 기존 `artwork_state` 도메인 재사용 (신규 도메인 0개) | ✅ |
| Resolver 확장 (artist / price / currency 추가) | ✅ |
| Artwork-centric navigation | ✅ row.artworkId = a.id 직접 (rule_1 SSOT) |
| Institutional minimalism | ✅ Sidebar 240px 그대로, compact list |
| Read-only drilldown | ✅ destructive 0건 |
| Build / type-check / lint | ✅ Route 141 kB (+0 kB) |
| 표현 정책 영어 (valuation guarantee / official inventory certificate / certified status / legal inventory proof) | ✅ 0건 |

### 사용자 spec 8개 제약

| 제약 | 결과 |
|---|---|
| 기존 STEP 67 architecture 재사용 | ✅ types / drawer / ClickableMetric 그대로 |
| 신규 drawer 시스템 | ✅ 0개 |
| Sidebar UI redesign | ✅ 0건 (신규 섹션 추가만) |
| Artwork lifecycle / state transition 로직 | ✅ 0줄 |
| Persistence schema | ✅ 0줄 |
| Reporting / Logistics / Documents / Customer / Image / AI 도메인 | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |
| Build / type-check / lint | ✅ |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Artwork lifecycle / state-machine | 0줄 |
| ArtworkState union | 0줄 |
| Payment / Settlement / Tax / FX | 0줄 |
| AI Market Analysis | 0줄 |
| Backup / Restore | 0줄 |
| Image Lifecycle | 0줄 |
| Logistics provider | 0줄 |
| Documents Hub (STEP 51 / 72) | 0줄 |
| Customer (STEP 42 / 73) | 0줄 |
| `OperationalDrilldownDrawer` (STEP 67 / 72) | 0줄 |
| `ClickableMetric` (STEP 67) | 0줄 |
| `ReportingDrawer` (STEP 67 / 70) | 0줄 |
| `DocumentsDrawer` (STEP 72) | 0줄 |
| `CustomerViewDrawer` (STEP 73) | 0줄 |
| System Audit (STEP 65) | 0줄 |
| Persistence (STEP 27 / 27.7 / 30) | 0줄 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First (시각적 정점) | Sidebar에서 바로 작품 SSOT로 진입. 이전 STEPs는 "도메인 내부 카운트 → 작품 returns", 본 STEP은 "운영자의 첫 시야에서 즉시 작품 진입" | ✅ **정점** |
| **rule_4** Trust Layer | drilldown read-only consumer · 상태 변경 0건 · audit 0건 | ✅ 보존 |
| **rule_6** Lifecycle 시각화 | STATUS_ORDER가 자연 lifecycle (DRAFT → BROKERED) 순서 | ✅ 강화 |
| **rule_8** Timeline = Navigation 전체 완성 | Reporting / Logistics / Documents / Customer / Image / Sidebar 모두 cover — operational graph가 완전한 cycle | ✅ **완성** |
| **rule_14** 3-Column | 0줄 | ✅ |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 | ✅ |
| **rule_16** institutional minimalism | Sidebar 240px / px-2 padding 일관성 / compact row | ✅ |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ |

---

## Operational Graph 완성

```
[Sidebar] → 작품 상태 9 click ─┐
                                 ├─→ [작품] (SSOT) ─┐
[Reporting KPI / Channel / Currency] ── 22 click ─┤                   │
[Logistics] ── 다수 click ─────────────────────────┤                   │
[Documents Hub] ── 6 click ───────────────────────┤                   │
[Customer] ── 9 click ─────────────────────────────┤                   │
[Image Cleanup] ── 4 click ────────────────────────┘                   │
                                                                         │
                                                                         │
                                                       ↓ DetailPanel sync│
                                                                         │
                                                       Timeline ←────────┘
                                                       └─→ 다음 도메인 metric
                                                          → 다른 작품 ...
```

운영자는 **어느 진입점에서든 작품으로 returns** — Artwork-First 원칙의 운영 시스템 cycle 완성.

---

## 다음 STEP 후보

```
STEP 75  ImageCleanup orphan row → "외부 저장소에서 제거 요청" inline action
STEP 76  Documents row 자체 클릭 → 기존 detail drawer 통합 강화
STEP 77  Sidebar Pending Approvals → drilldown (Contract / Settlement / Tax별)
STEP 78  Audit log filter → drilldown (작품별 audit chain)
STEP 79  Customer detail channelMix entries → customer_inquiries (source filter)
```

각 STEP은 STEP 67 4-piece + 누적 패턴 그대로 활용.

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 변경 파일 2개 (resolver 확장 + Sidebar 신규 섹션)
- **0개 신규 domain** (기존 `artwork_state` 재사용)
- 9개 신규 클릭 site (전체 1 + 8 상태)
- Resolver columns 6개로 확장 (artist + price + currency 추가)
- 0 신규 라이브러리 / 0 schema / 0 visual redesign / 0 도메인 로직 변경
- STEP 67 4-piece 인프라 그대로 재사용
- Artwork-First 시각적 정점 — Sidebar에서 바로 SSOT 진입
- Operational graph 완성 — 모든 진입점이 작품으로 returns
- Route +0 kB (141 → 141 kB)

**STEP 74 완료. Sidebar = 운영자의 첫 시야 = 작품 SSOT 직진입 — Artwork-First 원칙의 시각적 정점.**
