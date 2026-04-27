# 기획서 → CSV SSOT 마이그레이션 — 발견 사항

> 본 리팩토링(plan: spicy-tinkering-wigderson)은 **문서/CSV만** 수정한다.
> 마이그레이션 중 발견되는 코드↔CSV↔기획서 불일치는 **여기에 기록만** 하고
> 별도 작업으로 처리한다 (회귀 추적 어려움 방지).

작성 시작: 2026-04-27

---

## Phase A — sin_system.md (2026-04-27)

### F-A1. sin_relations.csv 재설계 미반영 (HIGH)

**현황**:
- `docs/game_design/sin_system.md` L468-478: 2026-04-24 재설계 매트릭스 — **동류/강화/중립/대립** 4유형, 배율 ×2 / ×1.5 / ×1 / ×-2
- `src/data/sin_relations.csv`: 옛 설계 — `create / amplify / oppose / neutral / require` 5유형, `morale_delta` 컬럼

**문제**:
- 기획서 본문이 사실상 SSOT 역할 중. CSV가 코드에서 로드되더라도 신설계 효과를 못 냄.
- 매트릭스 적용 범위(긍정 사건만, 부정 사건은 원본 Δ)도 CSV에 표현되지 않음.

**처리 방안 (별도 작업)**:
- sin_relations.csv 컬럼 재설계: `from, to, relation, multiplier, description, description_key`
- relation enum: `kindred / amplify / neutral / oppose` (동류/강화/중립/대립)
- multiplier: 2 / 1.5 / 1 / -2
- 코드 사이드(SinSystem.js / SinUtils.js)에서 새 컬럼 참조하도록 동기 수정
- bonds 변동 계산 시 매트릭스 lookup 함수 추가

**Phase A 본문 처리**:
- 매트릭스 표 본문 유지 (현재 SSOT라서). CSV 갱신 후 → 본문은 "→ sin_relations.csv 참조" 한 줄로 축약 가능.

---

### F-A2. sin_rampage_chain.csv 옛 사기 시스템 잔재 (HIGH)

**현황**:
- `src/data/sin_rampage_chain.csv` 컬럼: `sin, target, morale_delta, description` — **morale_delta 기반**
- 기획서 §2 L21: "사기(Morale) 시스템 완전 제거. 죄종 7수치 = 영웅이 현재 가진 7가지 감정의 누적치"
- `docs/game_design/sin_system.md` L146-156, L528-536: 폭주 매트릭스 본문이 sinStats 기반 결과 (예: "wrath +1", "food -2", "20% 확률" 등)

**문제**:
- CSV의 `morale_delta` 컬럼은 더 이상 의미 없음 (사기 폐기).
- 본문 폭주 결과(`wrath_combat_rise`, `rampage_greed_steal_food` 등)는 balance.csv의 `rampage_*` 키로 분산되어 있음.

**처리 방안 (별도 작업)**:
- sin_rampage_chain.csv 폐기 또는 재설계. 후보:
  - 옵션 A: 컬럼 재설계 → `sin, target, sin_delta_target, sin_delta_kind, prob, action_key, description`
  - 옵션 B: 폐기하고 balance.csv `rampage_*` 키 + locale_data.csv 서사 텍스트로 충분히 표현
- 코드(SinSystem.js)에서 어디를 참조하는지 확인 필요.

**Phase A 본문 처리**:
- L146-156 폭주 표: 본문 유지하되 "효과" 컬럼은 `[balance.csv:rampage_*]` 키 참조로 치환 (대응 키 다 있음).
- L528-536 §4 연쇄반응 표: 동일 정보 중복이므로 본문 표 제거 + "→ §2 폭주 구간 참조" 한 줄.

---

### F-A3. 고양 구간 장점·단점 효과 — 수치 키 미존재 (MEDIUM)

**현황**:
- `docs/game_design/sin_system.md` L94-100 (장점), L123-129 (단점): 수치 박힘 (`+15%`, `+10%`, `+20%`, `2배`, `10% 확률`, `-20%`, `+1/턴` 등)
- `balance.csv`: 대응 키 없음. `traits.csv`에도 고양 구간 효과는 없음 (특성 시스템과 별도).

**문제**:
- 코드가 이 효과를 실제 적용하는지 불명. `balance.csv`에 키가 없으면 미구현 상태일 가능성 높음.

**처리 방안 (별도 작업)**:
- balance.csv에 elevated 효과 키 추가 후보:
  - `elevated_wrath_combat_atk_mult,0.15`
  - `elevated_pride_party_combat_mult,0.10`
  - `elevated_greed_resource_mult,0.20`
  - `elevated_envy_node_reveal,1`
  - `elevated_lust_bonds_mult,2.0`
  - `elevated_gluttony_hp_regen_mult,2.0`
  - `elevated_sloth_stamina_recovery_mult,2.0`
  - 단점도 동일 패턴: `elevated_wrath_bonds_lock,1` 등
- 코드에서 sinStats 12~17 구간 진입 시 이 효과를 적용하는지 검증 후 추가/수정.

**Phase A 본문 처리**:
- 효과 설명 텍스트는 유지 (의미 표현). 수치 부분만 `[balance.csv:키 — 미정]` 표기로 처리하거나, 일단 본문 표를 유지하되 마지막에 "*수치는 추후 balance.csv 키로 이전 예정 — F-A3*" 주석.
- **결정**: 일단 본문 그대로 유지하고 §2 표 끝에 finding 참조 주석만 추가. 키 추가는 코드 검증과 묶어 별도 PR.

---

### F-A4. 임계 이벤트 결과 수치 — 코드 미구현 가능성 (MEDIUM)

**현황**:
- `docs/game_design/sin_system.md` L186-270: 7죄종 임계 이벤트 선택지별 결과 (HP -50%, 분노 -3, 수치 15로, 골드 -50%, 식량 -30% 등)
- `balance.csv`: critical_event_* 키는 **확률 보정용만** 존재. 결과 수치(HP/자원 변동) 키 없음.

**문제**:
- 결과 수치들이 어디에서 처리되는지 불명. EventSystem.js / event_effects.csv에 매핑이 있는지 검증 필요.
- 이벤트로 구현된다면 events.csv id에 등록되어 있어야 함.

**처리 방안 (별도 작업)**:
- 코드 검증: EventSystem이 임계(20 도달) 이벤트를 처리하는 경로 확인
- events.csv에 7개 임계 이벤트 등록 + event_effects.csv에 결과 수치 등록
- 또는 SinSystem.js 내부에서 직접 처리한다면 balance.csv에 `critical_result_*` 키 군 추가

**Phase A 본문 처리**:
- 7죄종 임계 이벤트 서사·선택지 텍스트는 "이벤트 작성 가이드라인" 역할이므로 **유지**.
- 결과 수치는 본문에서는 표현 그대로 두되, 문단 머리말에 "*결과 수치는 events.csv / event_effects.csv 또는 balance.csv 추가 등록 예정 — F-A4*" 주석.

---

### F-A5. 관계 → 죄종 자동 반영 표 (L443-448) — 수치 미구현 (LOW)

**현황**:
- `docs/game_design/sin_system.md` L443-448: bonds 임계값(70/30) 기반 죄종 누적 자동 반영 표
- `balance.csv`: bonds_high_threshold(70) / bonds_low_threshold(30) 키 존재. 단 사건별 Δ(분노 +5 등)는 키 없음.

**처리 방안 (별도 작업)**:
- balance.csv에 `bonds_event_*` 키 군 추가 또는 별도 CSV 분리

**Phase A 본문 처리**:
- 표 유지 (사건 의미 표현). 수치는 finding 주석만.

---

## Phase B — balance_design.md (2026-04-27)

### F-B1. 방어전 로그 곡선 step 키 미반영 (MEDIUM)

**현황**:
- `docs/game_design/balance_design.md` §1-4: 방어전 로그 곡선 제안 (`step_days`, `step_bonus`)
- `balance.csv`: `defense_enemy_hp_base`, `hp_per_day`, `atk_base`, `atk_per_day`, `spd`만 존재. step 키 없음 → 옛 선형 곡선 그대로 적용 중일 가능성.

**처리 방안 (별도 작업)**:
- balance.csv에 `defense_enemy_hp_step_days`, `defense_enemy_hp_step_bonus`, `defense_enemy_spd_step_days` 추가
- ExpeditionManager(또는 방어전 로직)에서 step 적용
- defense_scaling.csv 컬럼 정합성 점검

---

### F-B2. 자원 채집/벌목 적합도 보정 키 미반영 (LOW)

**현황**:
- `balance_design.md` §2-3: `채집 = base + floor(적합도/divisor) × per` 공식 제안
- `balance.csv`: `gather_base_food`(=10), `lumber_base_wood`(=12)만 존재. 적합도 보정 키 없음.

**처리 방안 (별도 작업)**:
- balance.csv에 `gather_food_stat_bonus_divisor`, `gather_food_stat_bonus_per`, `lumber_wood_stat_bonus_divisor`, `lumber_wood_stat_bonus_per` 추가
- DayActions.js 채집/벌목 로직에 보정 반영

---

### F-B3. balance_design.md §5 하드코딩 정리 — 코드 라인 참조 사용 불가 (LOW)

**현황**:
- `balance_design.md` §5 (L465-475): 코드 라인 번호 참조한 "이전 필요 항목" 표
- 라인 번호는 코드 변경에 따라 수시로 어긋남 → 문서로 관리 부적합

**처리 방안 (별도 작업)**:
- 본 finding 파일로 이전하거나 §5 자체를 일반 원칙 ("매직 넘버는 balance.csv 키로 분리")만 남기고 표 제거.

---

## Phase D — base_design.md (2026-04-27)

### F-D1. facilities.csv 시설 카탈로그 미반영 (HIGH)

**현황**:
- `docs/game_design/base_design.md` §2 시설 목록: 23개 시설 정의 (Tier 0~3, 4 카테고리)
- `src/data/facilities.csv`: 12행만 등록. Tier 2/3 시설 다수 미반영 (도박장/수련의 장/지하 감옥/묘지/도서관/고해소/금고/공방 등)

**문제**:
- 본문 카탈로그 ↔ CSV 어긋남. 코드는 CSV만 인식하므로 미등록 시설은 게임에 존재하지 않음.
- 컬럼 일부(`recruit_slots`, `feast_available`, `gold_per_turn` 등)는 일관 정의되어 있으나, 본문이 추가 효과(`heal_speed`, `morale_stabilize` 등)를 가정하는 부분과 매핑 검증 필요.

**처리 방안 (별도 작업)**:
- facilities.csv에 누락 시설 11개 추가 (id, tier, requires, cost, build_cost, 효과 컬럼 채우기)
- BaseManager / PopupsBuild 코드 검증 후 신규 시설 핸들러 연결
- name_key 채워서 locale_data.csv 동기화

---

### F-D2. 식량 비용 base 수치 오기 (LOW, 이미 수정됨)

**현황**:
- 옛 본문에 `food_cost_base(5)`로 표기되어 있었으나 실제 balance.csv는 `food_cost_base=8`
- 본 Phase D 작업 중 본문을 키 참조 형식으로 치환하면서 수치 노출 자체를 제거 → 추가 작업 불필요. 기록 목적.

---

## Phase E — event_design.md (2026-04-27)

### F-E1. 아침 보고 죄종 텍스트 — locale_data.csv 미반영 (LOW)

**현황**:
- `event_design.md` §1-1: 7죄종 × 3구간(평상/발현/위험) = 21개 묘사 텍스트가 본문에 박힘
- `locale_data.csv`: 해당 키 미존재. MorningReport.js 코드가 어디서 텍스트를 가져오는지 검증 필요.

**처리 방안 (별도 작업)**:
- locale_data.csv에 `morning_report.<sin>.<stage>` 키 21개 추가 (ko/en)
- MorningReport.js / MorningReportPopup.js를 `locale.t(key)` 호출로 전환
- 본문 표는 작성 가이드라인으로 그대로 유지 가능

---

### F-E2. 아침 보고 위험/안정 임계 (LOW)

**현황**:
- 본문이 옛 임계(15+/14 이하)를 사용했으나 sin_system.md §2 4구간(`sin_clean_max`/`sin_manifest_threshold`/`sin_elevated_threshold`/`sin_rampage_threshold`)이 SSOT
- 코드(MorningReport)가 어떤 임계로 분류하는지 검증 필요

**처리 방안 (별도 작업)**:
- MorningReport.js를 sin_system 4구간 키에 정렬하거나, 별도 `morning_report_warn_threshold` 키 추가
- 어느 쪽이든 본문 임계 표기 통일

---

### F-E3. events.csv `trigger_min_morale` 컬럼명 잔재 (HIGH)

**현황**:
- `events.csv` 컬럼: `trigger_type, trigger_sin, trigger_oppose_sin, trigger_min_morale, ...`
- `trigger_min_morale`은 **옛 사기 시스템 잔재** — 현재는 "특정 죄종 수치 임계"의 의미로 재해석되어 사용되고 있음
- 컬럼명과 실제 의미가 달라 신규 이벤트 작성 시 혼란

**처리 방안 (별도 작업)**:
- events.csv 컬럼명 `trigger_min_morale` → `trigger_min_sin` 으로 rename
- EventSystem.js / 관련 로더 동시 수정
- 다른 비슷한 잔재 컬럼(scene 등) 함께 정리

---

### F-E4. 타락/구원 판정 비율 키 미존재 (LOW)

**현황**:
- 폭주 시 "타락 70% / 구원 30%" 비율 박힘
- `balance.csv`: 임계 이벤트(20 도달) 키는 존재하지만 폭주(18~19) 단계 자체의 타락/구원 분기 키는 없음

**처리 방안 (별도 작업)**:
- 설계 의도 재확인: 폭주(18~19) 자체에는 타락/구원 분기가 없고 임계(20)에서만 발생하는지, 아니면 폭주에서도 별개 분기가 있는지
- 후자면 `rampage_corruption_rate` / `rampage_salvation_rate` 키 추가

---

## 다음 Phase로 이전 시 처리

각 finding은 Phase H 종료 후 별도 PR로 일괄 처리 검토.
PR 단위는 도메인별 (관계 매트릭스 / 폭주 / 고양 효과 / 임계 이벤트 / bonds 사건)로 분리하는 것이 회귀 추적 용이.
