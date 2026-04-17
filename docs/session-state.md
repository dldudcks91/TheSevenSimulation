# 세션 상태

> 이 파일은 세션 간 컨텍스트 연속성을 위해 유지됩니다.
> 각 작업 완료 후 업데이트하세요. 새 세션 시작 시 이 파일을 먼저 읽으세요.

---

## 현재 진행 중인 작업

_없음 (마지막 업데이트: 2026-04-17)_

---

## 마지막으로 완료한 작업

- **병사 시스템 전면 제거 + 영웅 HP/Stamina 이중축 확립** (2026-04-17, 4개 작업)
  1. **병사 시스템 제거** — 코드(BattleEngine/ExpeditionManager/ExpeditionNodeManager/TurnProcessor + BattleSceneA/B/MapDefenseMode/ExpeditionScene/MapScene/MapHUD/MapBottomPanel/MapTurnFlow) + CSV(balance.csv의 soldier_*, min_soldiers 제거, facilities.csv 훈련장 재정의) + 기획 문서 11개 전면 수정. 영웅 HP = `hero_hp_base(50) + vitality × hero_hp_per_vitality(5)`, 매턴 자연 회복 `hero_hp_regen_per_turn(10)`.
  2. **Stamina → 사기 페널티 연결** — `TurnProcessor.processDayPhase`에서 Stamina 구간 체크. 탈진(0)=-10, 과로(1~25)=-2/턴. `balance.csv`에 `morale_penalty_exhausted`, `morale_penalty_overwork_tick` 추가.
  3. **죄종 × Stamina 보정** — 주 성향(topSin) 기준 소모/회복 배율. `balance.csv`에 `stamina_mult_<sin>_cost/recover` 14개 키 추가. `HeroManager.consumeStamina/recoverStaminaTurn`에서 적용.
  4. **UI 정보 계층 정리** — HUD에서 병사 수 제거, Stamina는 아이콘 경고 전달(피로🟡/과로🟠/탈진🔴/발병💊), HP 바 영웅 상시 표시. `ui_design.md`에 정보 계층 원칙 명문화.

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

- [ ] 바알 죄종 수치 — 작업 지시/소비/외교/전투 판단 범주 변동 규칙 적용 (현재는 판결 범주만)
- [ ] 바알 죄종 수치 — 70+/30- 임계 효과 발동 로직 (버프/리스크)
- [ ] 기존 이벤트 30개에 player_sin 태깅 추가 (현재는 F1~F3 조우 이벤트만)
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
