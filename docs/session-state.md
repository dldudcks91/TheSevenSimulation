# 세션 상태

> 이 파일은 세션 간 컨텍스트 연속성을 위해 유지됩니다.
> 각 작업 완료 후 업데이트하세요. 새 세션 시작 시 이 파일을 먼저 읽으세요.

---

## 현재 진행 중인 작업

- **쌓임(누적) 프레임 재정립 — 기획서 뼈대 반영 완료, 세부 수치 TBD** (2026-04-17)
  - **배경**: Phase 1~3(사기 제거 + 죄종 수치 동적화) 구현 완료 후, 개념적 리프레임 필요성 발견. 양방향 변동(충족도)이 서사적으로 애매 → 단방향 누적(오염도)이 더 자연스럽다는 판단.
  - **확정된 뼈대**:
    - **쌓임 프레임**: 죄종 수치 = "영웅에게 들어간 나쁜 마음". 0에서 시작, 행동에 따라 쌓임, 정화는 전용 수단으로만. 낮은 수치 = 깨끗(좋음), 18+ = 폭주.
    - **메인 죄종 개념 폐기**: `topSin()`은 "현재 가장 많이 쌓인 죄종"이라는 상태 표현. 영웅 정체성은 **시작특성(trait)** 담당.
    - **특성 3슬롯**: 시작특성 1(이름별 고정, 장점 전용) + 후천특성 2(Lv5/Lv10, 행동 XP or 폭주 이력 기반).
    - **시작특성 3카테고리(안)**: 편향(50%)/저항(20%)/중립(30%) — 기존 21종 재분류는 다음 세션.
  - **기획서 뼈대 반영 완료 (6개 파일)**:
    - `sin_system.md` §2 쌓임 시스템 재서술, §3 관계 매트릭스, §5 국시별 효과 사기 → 누적 가속, 미확정 항목 우선순위 재정리
    - `hero_design.md` §2-2 쌓임 시스템, §2-3 특성 3슬롯 구조 + 편향/저항/중립 카테고리 플래그, §4 쌓임 조건 재서술
    - `GAME_DESIGN.md` §4 영웅 시스템 전면 갱신 — 0-시작, 쌓임 프레임, 메인 죄종 폐기
    - `balance_design.md` §3 죄종 수치 쌓임 밸런스로 전면 재작성, 사기 관련 CSV 키 레거시 표시
    - `event_design.md` §1-1 구간 서사 재분류, effect target 필드 `morale → sin_delta` 전환 명시, 미확정 항목 추가
    - `battle_design.md` 죄종 파워 보너스 섹션 신설, 일기토/죄종 반응 결과를 죄종 수치 변동으로 재표현
  - **다음 세션 확정 필요 항목**:
    - [ ] 수치 구간 경계값 (0~?/?~?/?~17/18+)
    - [ ] 정화 수단 카탈로그 (연회/야영/시설/이벤트/특성별 감소량)
    - [ ] 폭주 트리거 범위 (어느 죄종이든 vs 특정 조건)
    - [ ] 연쇄 전파 패턴 (같은 죄종만 vs 연관 죄종까지)
    - [ ] 후천특성 기존 기획과의 병합 확정
    - [ ] 시작특성 21종 편향/저항/중립 재분류
  - **이후 작업**: 수치 확정 → 기존 Phase 1~3 구현 재작업(양방향 → 쌓임) → balance.csv 재조정 → 이벤트 30개 재태깅

---

## 마지막으로 완료한 작업

- **국시(Edict) 시스템 도입 + 바알 죄종 수치/포고령 제거** (2026-04-17)
  - **결정 배경**: 바알의 통치 레이어를 단순화. 바알 죄종 7수치(playerSins) + 포고령 3축(ration/training/alert)을 전부 제거하고 **단일 국시**로 통합. 플레이어는 7죄종 중 1개를 기간형(5턴)으로 선포.
  - **국시 7종**: 강병령(분노)/풍요령(폭식)/축재령(탐욕)/안식령(나태)/경쟁령(시기)/열정령(색욕)/위광령(교만). 효과는 `src/data/edicts.csv`에서 관리 (battle_power_mult / resource_gain_mult / food_consume_mult / build_research_mult / morale_tick 등).
  - **신규 파일**: `src/game_logic/EdictManager.js` (선포/만료/해제/쿨다운/대립 전환), `src/data/edicts.csv`.
  - **balance.csv**: `edict_duration(5)`, `edict_cooldown_normal(1)`, `edict_cooldown_early(2)`, `edict_cooldown_opposite_bonus(1)` 추가.
  - **삭제**: `policies.csv`, `BaseManager.setPolicy/getPolicyMoraleEffect`, `base.policies` 필드, `SinUtils.makeDefaultPlayerSins/applyPlayerSinDelta/PLAYER_SIN_*`, `EventSystem`의 `target='player_sin_*'` 분기, `event_effects.csv`의 player_sin 7행, `MapHUD.updateBaalSins/_showBaalSinPopup`, `PopupsAction.popupPolicy`, `MapBottomPanel.renderPolicyTab`.
  - **UI 전환**: HUD 👑 바알 죄종 → 📜 국시 배지 (선포 중/쿨다운/무국시 상태 + 잔여 턴 표시, 클릭 시 국시 탭). 정책 탭 → 국시 탭(7종 카드 + 선포/해제 버튼). 광장 클릭 → 국시 탭.
  - **효과 연결**: BattleEngine에 `setPowerMultDelta()` 추가 → `_calcATK` 배율 적용 (방어전/원정 모두). BaseManager 건설/연구 배율 `_buildResearchMult()`. TurnProcessor 낮 페이즈 시작 시 `edictManager.tickDay(day)` + 자원 배율 적용.
  - **세이브 마이그레이션**: 기존 세이브의 `playerSins` / `base.policies`는 로드 시 단순 폐기. `edict` 저장/복원 추가.
  - **기획 문서**: GAME_DESIGN.md §3 바알 역할 재서술, sin_system.md §1/§5 국시 시스템 신설, base_design.md 포고령 섹션 → 국시 섹션, ui_design.md HUD/탭/팝업 업데이트, event_design.md player_sin 타겟 언급 제거.

- **사기 시스템 완전 제거 + 죄종 수치 동적화** (2026-04-17)
  - **핵심 결정**: 사기(0~100) 완전 폐기. 죄종 7수치(1~20)가 유일한 영웅 관리 레버. 수치가 행동마다 오르내리는 상태 게이지로 재정의. 높은 수치 = 파워 보너스 + 문제 행동 위험.
  - **폭주 방식**: DD 스트레스 방식 채택. 18 진입=폭주 시작, 18~19 유지=매 턴 문제 행동, 20+3턴=이탈.
  - **game_logic 7개**: HeroManager/SinSystem/TurnProcessor/DayActions/ExpeditionNodeManager/EventSystem/MorningReport 전면 재작성.
  - **balance.csv**: morale_* 키 전부 제거. sin_rampage_threshold/recover_threshold/desertion_turns, sin_elevated/frustrated_threshold, 7죄종별 rise/fall 상수, rampage 행동 상수 신규 추가.
  - **UI 11개 파일**: MapHeroInspector/MapBottomPanel/PopupsHero — 7종 죄종 수치 미니 바. MorningReportPopup/SettlementScene/MapActionPopup/MapActions/ExpeditionScene/PopupsAction/MapConstants/app.js 사기 참조 전부 제거.
  - **기획 문서**: sin_system.md/hero_design.md/expedition_design.md/DEV_PLAN.md 사기→죄종 수치 기준으로 갱신.

- **병사 시스템 전면 제거 + 영웅 HP/Stamina 이중축 확립** (2026-04-17, 4개 작업)
  1. **병사 시스템 제거** — 코드 + CSV + 기획 문서 11개 전면 수정. 영웅 HP = `hero_hp_base(50) + vitality × hero_hp_per_vitality(5)`, 매턴 자연 회복.
  2. **죄종 × Stamina 보정** — 주 성향(topSin) 기준 소모/회복 배율. `balance.csv`에 `stamina_mult_<sin>_cost/recover` 14개 키 추가.
  3. **UI 정보 계층 정리** — HUD 병사 카운터 제거, Stamina 아이콘 경고, HP 바 상시 표시.

- **기획↔개발 갭 일괄 개발** (2026-04-16, 7개 항목)
  1. **원정 결과 → Store 반영** — `ExpeditionNodeManager.applyCombatResult/applyRestNode/advanceChapterOnBoss/finalizeReturn`. balance.csv에 `exp_node_*` 보상 키 추가. 전투 승패별 골드/사기/영웅 부상/HP 반영. 보스 격파 시 다음 챕터 자동 해금.
  2. **조우 이벤트 노드 ↔ EventScene 연동** — `EventSystem.pickEncounterEvent(partyHeroIds)` + `applyChoice(evt, idx, context)` (target='party'). 조우 이벤트 F1~F3 추가 (events.csv/event_choices.csv/event_effects.csv).
  3. **아침 보고 죄종 태그 버그 수정** — MorningReportPopup에서 `topSin(entry.sinStats)` (undefined) → `entry.dominantSin` / `entry.sinName` 사용. 심리 텍스트 63종은 이미 SIN_TEXTS에 구현되어 있었음 (Explore 갭 분석 정정).
  4. **감시탑 ↔ 구름 해제 연동** — `ExpeditionNodeManager.revealByWatchtower(level, allNodes)`. Lv.1/2/3 = +1/+2/전체 스텝 공개. ExpeditionScene에서 `baseManager.getWatchtowerLevel()` 호출.
  5. **챕터별 원정 노드 구성 CSV화** — `expedition_nodes.csv` (7챕터 × 7노드) + `expedition_dice.csv` (7챕터 × 25칸 파이프 시퀀스). 챕터별 테마 반영 (분노=combat, 탐욕=event, 나태=rest 등). 보스명 실명화.
  6. **바알(플레이어) 죄종 수치 변동** — `Store.playerSins` (7죄종 각 50), `SaveManager` 저장/복원, `SinUtils.applyPlayerSinDelta`, EventSystem에서 `target='player_sin_X'` 처리, F1~F3 이벤트에 태깅. MapHUD에 👑 top 죄종 표시 + 클릭 팝업 전체 수치 열람.
  7. **체력(stamina) 시스템** — hero.stamina 필드 + balance.csv `stamina_*` 수치, `HeroManager.consumeStamina/recoverStaminaTurn/checkSicknessTick/tickSickness`, DayActions에서 채집/벌목/사냥 소모 + 피로/과로 시 효율 감소, TurnProcessor에서 매턴 회복+발병 판정, ExpeditionScene에서 원정 시작 시 -25, MapHeroInspector에 체력 바 추가.

- **기획서 폭주 강조 프레이밍 제거** (2026-04-16)
  - 결정: 폭주는 "핵심/창발의 축"이 아니라 사기 변동의 한 결과(희소 이벤트)로 위치 재조정
  - 메커니즘(사기 100=폭주, 행동 결정, 후천 폭주 특성, 연쇄 반응)은 유지
  - 수정 파일: `GAME_DESIGN.md` (핵심 재미 캐치프레이즈, 폭주/연쇄 반응 섹션 헤더), `sin_system.md` (드라마 톤 약화), `hero_design.md` (주 성향 역할 재서술 + "핵심"/"의미" 라벨 제거), `balance_design.md` (사기 평가 기준 다원화), `faction_design.md` (고해소 이벤트 역할 표현)
  - 영향: 죄종 시스템의 "일상 효과 = 만족/불만 비례 변동"을 전면, "주 성향 = 양극단 행동 결정"을 부수 효과로 재배치

- **원정 맵 탐색 프로토타입 구현** (2026-04-15)
  - `ExpeditionNodeManager.js` — STS 노드/주사위 경로/포탈 체크포인트 순수 로직
  - `ExpeditionScene.js` — Phaser 오버레이 씬 (두 모드 렌더링 + 인라인 전투)
  - `app.js` — ExpeditionScene 등록, `expeditionMode: 'node'` 초기값
  - `MapHUD.js` — ⚙ 클릭으로 모드 토글 (`[원정:노드]` ↔ `[원정:주사위]`)
  - `MapBottomPanel.js` — 원정 탭에 "⚔ 원정 맵 열기" 버튼 추가
  - 관련 문서 전면 업데이트 (expedition_design.md / ui_design.md / DEV_PLAN.md)

---

## 열린 결정사항

_없음_

---

## 다음 할 일

### 우선 — 쌓임 프레임 세부 확정 (다음 세션 예정)
- [ ] 수치 구간 경계값 확정 (0~?/?~?/?~17/18+)
- [ ] 정화 수단 카탈로그 작성 (어떤 수단이 어떤 죄종을 얼마나 감소시키는지)
- [ ] 폭주 트리거 범위 확정 (어느 죄종이든 vs 특정 조건)
- [ ] 연쇄 전파 패턴 확정 (같은 죄종만 vs 연관 죄종까지)
- [ ] 후천특성 기존 기획과의 병합 설계
- [ ] 시작특성 21종 → 편향/저항/중립 재분류

### 쌓임 프레임 확정 후 구현 작업
- [ ] `_rollSinStats()` → 모두 0으로 초기화
- [ ] `SinDynamics`/TurnProcessor "내리는 조건" 제거, 정화 수단 경로만 유지
- [ ] `DayActions` 자동 감소 로직 제거
- [ ] `balance.csv` 감소 상수 정리 + 정화 수단 전용 상수 추가
- [ ] UI 저수치 경고 제거
- [ ] 이벤트 30개 본문 `morale` → `sin_delta` 재태깅

### 기존 TODO (유지)
- [ ] 국시 효과 "경쟁령 갈등↑", "열정령 관계 효과", "위광령 저렙 영웅" 실제 적용 처리
- [ ] 조우 이벤트 풀 확장 (챕터/지역별 전용 이벤트)
- [ ] 병원 시설 발병 기간 단축 효과
- [ ] 탈진(stamina=0) 시 강제 휴식 로직
- [ ] 밸런스: 체력 회복률 / 행동 소모량 / 발병 확률 플레이테스트

---

## 최근 주요 결정 이력

| 날짜 | 결정 | 근거 |
|------|------|------|
| 2026-04-15 | 원정 = 하루 단위, 원정 중 방어전 참여 불가 | 거점 vs 원정 트레이드오프 강화 |
| 2026-04-15 | 포탈 = 체크포인트 (이전 노드 영구 유지, 이후 노드 리셋) | 중간 진행 보상 + 재도전 긴장감 동시 확보 |
| 2026-04-15 | 두 모드 프로토타입 동시 구현 (인게임 토글) | 플레이테스트로 어느 방식이 더 재미있는지 직접 판단 |
| 2026-04-15 | 구름 가리기 (Fog of war) STS 노드 방식에 적용 | 빌드업 + 탐색 불확실성 제공, 감시탑 연동 여지 |
| 2026-04-15 | design-review를 Opus + 4병렬 에이전트로 업그레이드 | 도메인별 독립 분석 후 교차 충돌 감지 필요 |
| 2026-04-16 | 폭주 = 핵심 X, 만족/불만 비례 변동 = 핵심 O로 프레이밍 재조정 | design-review에서 "연쇄 반응 양의 피드백 발산 위험" 지적. 폭주 의존 설계가 시스템 폭발 위험을 키운다고 판단 |
| 2026-04-16 | 바알 죄종 변동을 이벤트 선택지 effect target(`player_sin_X`)으로 선언적 표현 | CSV 데이터 주도 원칙 준수. 향후 기획 변경 시 CSV만 수정해도 동작. |
| 2026-04-16 | 체력 시스템 Phase A만 구현 — 소비/회복/발병/UI. 탈진 강제휴식·병원 단축은 Phase B로 연기 | 스코프 제한으로 밸런스 관찰 후 확장 결정 |
| 2026-04-16 | 챕터별 원정 노드를 CSV로 분리 (expedition_nodes.csv/expedition_dice.csv) | 동일 토폴로지(start→분기→포탈→분기→보스) 유지하되 노드 타입만 변조 — 밸런스 조정 비용 최소 |
| 2026-04-17 | 병사 시스템 완전 제거, 영웅 HP 직격 구조 확정 | HP+Stamina 이중축. design-review 4전문가 분석 결과 "로테이션 전략/죄종 차별화/건설 트리 레버 이원화"에 이중축이 필수 판정 |
| 2026-04-17 | Stamina → 사기 페널티 명시화 (탈진-10, 과로-2/턴) | sin_system.md 사기 변동 요인 표에 누락이었음. 암묵적 연결을 명시화 |
| 2026-04-17 | 죄종 × Stamina 보정 도입 (주 성향 기준, 1개만 적용) | 나태=소모↓회복↑, 분노/시기=소모↑, 폭식=회복↑ — 이중축이 로스터 차별화에 기여하려면 죄종과 교차해야 한다 |
| 2026-04-17 | 죄종 수치를 쌓임(누적, 0→20) 프레임으로 재정립 | 양방향 변동(충족도)은 "폭주/이탈이 왜 이 수치에서 일어나나" 서사 근거가 약함. 단방향 누적(오염도)은 "나쁜 마음이 쌓이다 터진다"로 자연스러움. DD 스트레스 모델 구조와 일치. |
| 2026-04-17 | 메인 죄종 개념 완전 폐기, topSin()은 상태 표현으로만 | 정체성은 **특성(trait)**이 담당. 0-시작 + 쌓임 프레임과 "고정 주 성향"은 개념적으로 충돌. 플레이어 행동이 영웅의 현재 상태를 결정 → 타락 서사 가능. |
| 2026-04-17 | 특성 3슬롯 구조 확정 (시작 1 + 후천 2) | 시작특성(이름별 고정)이 정체성 + 죄종 쌓임 편향. 후천특성(Lv5/Lv10)이 플레이 선택의 성장. 기존 고유 특성 21종 풀은 유지, 편향/저항/중립 재분류는 다음 세션. |
| 2026-04-17 | 기획서 뼈대 먼저 반영, 세부 수치는 다음 세션 확정 | 수치 구간/정화 카탈로그가 결정되기 전 기획서 전면 업데이트 시 TBD 마커 남발 + 이중 작업. 뼈대(개념/프레임)만 우선 반영. |
