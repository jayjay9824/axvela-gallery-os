# AXVELA Gallery OS — MVP Foundation

Artwork-Centric Operating System for Galleries.
이 저장소는 **MVP 기반 셸**입니다 — 본격 모듈(Governance, Tokenization, Federation, Insurance, Privacy, Blockchain) 은 포함되어 있지 않습니다.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 구조

```
axvela-gallery-os/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root, Pretendard, ko lang
│   │   ├── page.tsx            # 3-column shell (Sidebar / Grid / Detail)
│   │   └── globals.css         # Pretendard CDN + base styles
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx     # 메뉴 + Work Queue
│   │   │   ├── ArtworkGrid.tsx # 작품 리스트 (홈)
│   │   │   └── DetailPanel.tsx # 상태 기반 Control Center
│   │   ├── artwork/
│   │   │   ├── ArtworkCard.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── SearchBar.tsx
│   │   └── ui/
│   │       └── Button.tsx      # primary / secondary / ghost
│   ├── lib/
│   │   ├── mock-data.ts        # Artworks + Timeline events
│   │   └── utils.ts            # cn, formatKRW, state labels
│   ├── store/
│   │   └── useArtworkStore.ts  # selection, query, state filter
│   └── types/
│       └── artwork.ts          # Artwork, AXID, ArtworkState, TimelineEvent
├── tailwind.config.ts          # canvas, surface, line, status.* tokens
├── next.config.js
├── tsconfig.json               # @/* → ./src/*
└── package.json
```

## 매니페스토 매핑

| 규칙 | 구현 위치 |
|---|---|
| `rule_1` Artwork-first | `types/artwork.ts`, `mock-data.ts` |
| `rule_6` State machine | `STATE_LABEL_KR`, `STATE_ACTIONS` |
| `rule_8` Timeline = Navigation | `DetailPanel` Living Timeline |
| `rule_9` Work Queue (no notifications) | `Sidebar` |
| `rule_10` 홈 ≠ 대시보드 | `ArtworkGrid` (작품 리스트) |
| `rule_14` 3-Column layout | `app/page.tsx` |
| `rule_15` 버튼 ≤3, Primary 1 | `DetailPanel.STATE_ACTIONS` |
| `rule_16` Apple/OpenAI 미니멀 | `tailwind.config.ts` 토큰 |

## 디자인 토큰

- `canvas` `#F8F7F4` — 페이지 배경 (warm off-white)
- `surface` `#FFFFFF` — 카드/패널
- `line` `#E8E6E1` — 헤어라인 보더
- `ink` `#0F0F0F` — 본문 텍스트
- `status.{draft|ready|inquiry|deal|paid|closed|brokered}`

## 다음 단계

이 셸은 **기반(foundation)**입니다. 이후 추가될 항목:

1. Transaction / Document Drawer (rule_17 — 레이아웃 변경 금지, 레이어만)
2. Payment / Settlement / Tax 분리 모듈 (rule_3)
3. Document trust layer (Version, Approval, LOCK — rule_4)
4. AI human-loop (초안 → 수정 → 승인 → LOCK — rule_5)
5. RBAC 가드 (rule_7)
