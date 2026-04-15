# 세션 상태

> 이 파일은 세션 간 컨텍스트 연속성을 위해 유지됩니다.
> 각 작업 완료 후 업데이트하세요. 새 세션 시작 시 이 파일을 먼저 읽으세요.

---

## 현재 진행 중인 작업

_없음 (마지막 업데이트: 2026-04-15)_

---

## 마지막으로 완료한 작업

- **전투씬 4×3 격자 시스템 구현 + BattleSceneB 삭제** (2026-04-15)
  - `BattleSceneB.js` — 삭제 (필드 이동형 전투씬 제거)
  - `BattleSceneA.js` — X축 돌진형 → 4×3 격자 턴제 전투로 전면 재작성
    - 아군 4열×3행 / 적군 4열×3행 격자
    - 틱마다 1칸 이동, 인접 시 교전
    - 병사 수 = 영웅 HP (0 → 즉시 격자에서 제거)
  - `BattleFormationPopup.js` — 신규 생성 (전투 전 드래그 배치 + 병사 수 배분 팝업)
  - `app.js` — BattleSceneB 제거, BattleFormationPopup 등록
  - `ExpeditionScene.js` — 전투 노드 클릭 시 BattleFormationPopup 실행
  - `MapScene.js` — battleMode 하드코딩 'melee'로 단순화
  - `ResultScene.js` — BattleSceneA 직접 참조로 변경
  - `MapHUD.js` — A/B 전투씬 토글 버튼 제거
  - 관련 문서 업데이트 (battle_design.md / ui_design.md / DEV_PLAN.md / CLAUDE.md)

---

## 열린 결정사항

- BattleFormationPopup에서 BattleSceneA 종료 후 victory 결과가 현재 `true` 하드코딩 (임시) — 추후 BattleEngine 결과 기반으로 수정 필요

---

## 다음 할 일

- [ ] 원정 결과 → Store 반영 (자원 획득 / 영웅 부상 처리)
- [ ] 조우 이벤트 노드 → EventScene 연동
- [ ] 챕터별 노드 구성 다양화 (현재는 고정 7노드)
- [ ] 감시탑 건물 ↔ 구름 해제 연동
- [ ] BattleSceneA victory 결과를 실제 BattleEngine 시뮬레이션 결과로 연동

---

## 최근 주요 결정 이력

| 날짜 | 결정 | 근거 |
|------|------|------|
| 2026-04-15 | 전투씬 = 아군 4×3 / 적군 4×3 격자, 1칸/틱 이동 | 롤토체스식 점거 방식, 배치의 재미 극대화 |
| 2026-04-15 | 병사 수 = 영웅 HP (별도 셀 아님) | 단순화: 병사 0 → 영웅 즉시 전장 이탈 |
| 2026-04-15 | 전투 전 드래그 배치 팝업(BattleFormationPopup) 신설 | 전투 전 준비의 재미 (Darkest Dungeon 참조) |
| 2026-04-15 | BattleSceneB 전면 삭제 | 4×3 격자로 방향 통일, A/B 이중 유지 복잡도 제거 |
| 2026-04-15 | 원정 = 하루 단위, 원정 중 방어전 참여 불가 | 거점 vs 원정 트레이드오프 강화 |
| 2026-04-15 | 포탈 = 체크포인트 (이전 노드 영구 유지, 이후 노드 리셋) | 중간 진행 보상 + 재도전 긴장감 동시 확보 |
| 2026-04-15 | 두 모드 프로토타입 동시 구현 (인게임 토글) | 플레이테스트로 어느 방식이 더 재미있는지 직접 판단 |
| 2026-04-15 | 구름 가리기 (Fog of war) STS 노드 방식에 적용 | 빌드업 + 탐색 불확실성 제공, 감시탑 연동 여지 |
| 2026-04-15 | design-review를 Opus + 4병렬 에이전트로 업그레이드 | 도메인별 독립 분석 후 교차 충돌 감지 필요 |
