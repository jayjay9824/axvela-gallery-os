// ============================================================================
// Role + Permission — RBAC layer (rule_7).
//
// 권한과 데이터 가드는 분리된다:
//   - Permission 결여  → 버튼 disabled + "Owner 권한 필요" 안내 (UI 시각적 차단)
//   - Data guard 결여 → 버튼은 활성화되나 transition rule이 막음 (별개 시스템)
//
// Role 위계는 단순 순서:
//   STAFF (1) < MANAGER (2) < OWNER (3)
//
// Permission 매트릭스는 ACTION 단위로 명시적으로 선언. "이 액션을 수행할 수 있는
// 최소 등급"을 ACTION_MIN_ROLE에 적는다. helper hasPermission()은 이 한 매핑만
// 본다. 새 액션을 추가하려면 ACTION 키를 추가하고 ACTION_MIN_ROLE에 등록.
// ============================================================================

export type Role = "STAFF" | "MANAGER" | "OWNER";

/**
 * RBAC가 검사하는 액션 키. Store action 이름과 1:1 대응되지 않을 수 있음 —
 * "비즈니스 의미 단위"로 묶음 (예: contract.approve와 contract.lock은 별 키).
 *
 * 키 네이밍: `{도메인}.{동작}` snake-case-style.
 */
export type Permission =
  // Artwork
  | "artwork.create"
  | "artwork.update"
  | "artwork.transition.close"        // PAID → CLOSED — Owner 전용 (rule_7)
  // Inquiry
  | "inquiry.update"
  // Transaction
  | "transaction.update"
  // Invoice
  | "invoice.send"
  | "invoice.create_version"
  // Payment
  | "payment.register"
  // Settlement
  | "settlement.create"
  | "settlement.complete"             // Owner 승인 필요
  // Tax
  | "tax.create"
  | "tax.issue"                       // Owner 승인 필요
  // Contract
  | "contract.create"
  | "contract.update"
  | "contract.submit_review"
  | "contract.approve"                // Owner 승인 필요
  | "contract.lock"                   // Owner 승인 필요
  | "contract.create_version"
  // Logistics
  | "logistics.create"
  | "logistics.update"
  | "logistics.update_status"
  // Condition Report
  | "condition_report.create"
  | "condition_report.update"
  // Curation (rule_18 AI Layer — STEP 16)
  | "curation.create"
  | "curation.update"
  | "curation.approve"
  | "curation.lock"                   // Manager 승인 필요
  | "curation.create_version"
  // Inquiry response (rule_18 — STEP 16)
  | "inquiry.generate_response"
  | "inquiry.send_response"
  // STEP 18 — Price Suggestion (rule_18 (c)). 외부 마켓 데이터 미사용,
  // 내부 기록 기반 deterministic helper. Curation/Inquiry response와 동일
  // STAFF 등급 — 가격 결정은 인간이 하므로 generate / apply 모두 STAFF 가능.
  | "price_suggestion.generate"
  | "price_suggestion.apply"
  // STEP 23 — Cross-artwork Audit View (rule_4 trust layer 확장)
  | "audit.view_global"
  // STEP 35 — Multi-currency Reporting Layer (rule_3 Money Flow + rule_20 FX).
  // 운영 참고 리포트 — 회계 확정 / 세무 신고 권한 아님.
  | "report.view_global"
  // STEP 62 — Owner 전용 admin 도구. 외부 storage inspection / orphan candidate
  // review / remove request. read-only가 기본이지만 destructive-adjacent라
  // OWNER 등급으로 한정.
  | "image.cleanup_review"
  // STEP 65 — 시스템 운영 로그(SystemAuditEvent) 조회 + clear. OWNER 전용 —
  // device-local 운영 기록 열람 / 비움 권한.
  | "audit.view"
  // STEP 41 — Collector View. 갤러리 전체 컬렉터 (inquiries + transactions에서
  // derive) 운영 참고용. CRM 확정 등급 / 영구 마스터 데이터 권한 아님.
  | "collector.view_global";

/**
 * 각 액션을 수행 가능한 *최소 등급*. 등급이 높으면 상속됨 (Owner는 모든
 * Staff/Manager 액션 가능).
 */
export const ACTION_MIN_ROLE: Record<Permission, Role> = {
  // STAFF — 일상 운영
  "artwork.create":            "STAFF",
  "artwork.update":            "STAFF",
  "inquiry.update":            "STAFF",
  "logistics.create":          "STAFF",
  "condition_report.create":   "STAFF",
  "condition_report.update":   "STAFF",

  // MANAGER — 거래 / 문서 / 결제 진행
  "transaction.update":        "MANAGER",
  "invoice.send":              "MANAGER",
  "invoice.create_version":    "MANAGER",
  "payment.register":          "MANAGER",
  "settlement.create":         "MANAGER",
  "tax.create":                "MANAGER",
  "contract.create":           "MANAGER",
  "contract.update":           "MANAGER",
  "contract.submit_review":    "MANAGER",
  "contract.create_version":   "MANAGER",
  "logistics.update":          "MANAGER",
  "logistics.update_status":   "MANAGER",

  // OWNER — 최종 승인 / 영구 기록
  "contract.approve":          "OWNER",
  "contract.lock":             "OWNER",
  "settlement.complete":       "OWNER",
  "tax.issue":                 "OWNER",
  "artwork.transition.close":  "OWNER",

  // STEP 16 — AI Layer (rule_18). Curation은 법적 문서가 아니므로 OWNER까지
  // 가지 않고 MANAGER LOCK으로 충분 (Contract와 의도적 차등). Inquiry 응대도
  // 일상 운영 범위 — STAFF가 생성/발송 가능.
  "curation.create":           "STAFF",
  "curation.update":           "STAFF",
  "curation.approve":          "MANAGER",
  "curation.lock":             "MANAGER",
  "curation.create_version":   "MANAGER",
  "inquiry.generate_response": "STAFF",
  "inquiry.send_response":     "STAFF",

  // STEP 18 — Price Suggestion. Generate / apply 모두 STAFF — 가격 확정은
  // 사람이 하지만, AI 제안 생성과 form draft 반영은 일상 운영 범위.
  "price_suggestion.generate": "STAFF",
  "price_suggestion.apply":    "STAFF",

  // STEP 23 — 갤러리 전체 감사 로그. Staff는 단일 작품 audit만 접근 가능,
  // 시스템 전체 감사는 Manager 이상 (rule_7).
  "audit.view_global":         "MANAGER",

  // STEP 35 — Multi-currency Reporting Layer. KRW 통합 환산 리포트.
  // 운영 참고용 — 회계 확정 / 세무 신고와 무관 (UI 라벨에서도 명시).
  // Staff는 단일 작품 운영만 — 갤러리 전체 매출/정산/세무 집계는 Manager 이상.
  "report.view_global":        "MANAGER",
  // STEP 62 — Owner 전용 admin 도구
  "image.cleanup_review":      "OWNER",
  // STEP 65 — System audit log viewer (OWNER 전용)
  "audit.view":                "OWNER",

  // STEP 41 — Collector View. 갤러리 전체 컬렉터 derive view.
  // Staff는 단일 작품 운영만 — 컬렉터 cross-artwork 분석은 Manager 이상.
  "collector.view_global":     "MANAGER",
};
