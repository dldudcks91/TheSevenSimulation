# MapScene.js 분리 리팩토링 계획서

> **상태: ✅ 구현 완료 (2026-04-03)**
> 2,979줄 → 278줄 코디네이터 + 11개 씬 모듈 + 2개 game_logic 모듈
> 추가: DayActions.js + TurnProcessor.js (백테스팅 가능 구조)

## 배경

MapScene.js가 2,981줄, 메서드 80개, 책임 영역 7개가 혼재된 상태. 이후 기능 추가(사기 5구간, 장비 시스템, 챕터 환경변조 등)의 유지보수성을 위해 모듈 분리가 필요.

## 목표 구조

```
src/scenes/
├── MapScene.js              (~400줄, 코디네이터 + 라우팅)
└── map/
    ├── MapConstants.js      (~100줄)
    ├── MapWidgets.js        (~60줄, 공유 UI 유틸)
    ├── MapPopupSystem.js    (~130줄, 스택 관리 + 공통 버튼)
    ├── MapHUD.js            (~100줄)
    ├── MapWorld.js          (~300줄)
    ├── MapBottomPanel.js    (~650줄, 탭 렌더러)
    ├── MapActions.js        (~140줄)
    ├── MapTurnFlow.js       (~270줄)
    └── popups/
        ├── PopupsBuild.js   (~250줄)
        ├── PopupsHero.js    (~360줄)
        └── PopupsAction.js  (~350줄)
```

## 각 모듈별 포함 메서드

### MapConstants.js (~100줄)
상수 블록 전부 (lines 27~118):
- 색상: C, SIN_COLOR_HEX, MORALE_COLORS_HEX
- ACTION_STATS
- 레이아웃: HUD_H, MAP_VP_W, MAP_VP_H, MAP_WORLD_W, MAP_WORLD_H, PANEL_Y, PANEL_H, PANEL_TAB_H, PANEL_CONTENT_Y, PANEL_CONTENT_H
- 맵 구간: ZONE_INSIDE_END, ZONE_OUTSIDE_START, GATE_X, APPROACH_Y
- 탭 정의: TABS
- 건물 그리드: GRID_X, GRID_Y, GRID_COLS, GRID_ROWS, CELL_W, CELL_H, CELL_GAP, BUILDING_SLOTS, PLAZA_INDEX
- 영외 슬롯: OUTSIDE_SLOTS

### MapWidgets.js (~60줄)
공유 UI 유틸 -- Panel과 Popup 양쪽에서 사용:
- _sectionTitle(x, y, text) [2523-2532]
- _outsetPanel(x, y, w, h) [2534-2541]
- _insetPanel(x, y, w, h) [2543-2550]
- _panelButton(cx, y, label, callback) [2552-2573]
- _smallPanelBtn(cx, cy, label, callback) [2575-2595]

패턴: `constructor(scene)` -> `this.scene = scene`

### MapPopupSystem.js (~130줄)
팝업 스택 관리 + 공통 버튼 위젯:
- _pushPopup(mode, data) [747-797]
- _closePopup() [799-804]
- _closeAllPopups() [806-813]
- _pp(element) [815-824]
- _popupCloseBtn(px, py, pw, ph) [826-834]
- _popupButton(cx, cy, label, callback) [836-857]
- _popupSmallBtn(cx, cy, label, callback) [859-879]

내부 상태: `_popupStack[]` 배열을 이 모듈이 소유

### MapHUD.js (~100줄)
상단 HUD:
- _drawHUD() [283-356]
- _drawNavButton(x, y, w, h, label, accentColor, callback) [358-382]
- _updateResources() [2652-2656]
- _updateSoldiers() [2657-2657]
- _updatePhaseDisplay() [2658-2663]

### MapWorld.js (~300줄)
맵 영역 렌더링 + 건물 슬롯:
- _drawMapWorld() [387-481]
- _drawApproachPath() [484-506]
- _initDebugMode() [509-579]
- _drawPlaza() [581-597]
- _drawSlotBg() [600-610]
- _updateBuildings() [2597-2635]
- _updateSlotAppearance(i) [2637-2650]
- _getSlotBuilding(i) [2665-2665]
- _onSlotClick(i) [2666-2690]

### MapBottomPanel.js (~650줄)
탭 바 + 6개 탭 렌더러:
- _drawBottomPanel() [612-655]
- _switchTab(tabId) [657-686]
- _refreshActiveTab() [687-694]
- _clearPanel() [696-699]
- _p(element) [701-708]
- _renderHeroTab() [2142-2220]
- _renderBaseTab() [2225-2295]
- _renderItemTab() [2297-2308]
- _renderExpeditionTab() [2310-2352]
- _renderPolicyTab() [2354-2427]
- _renderBestiaryTab() [2429-2512]
- _renderExpeditionListAction() [1524-1572]
- _renderExpeditionAction(stageIndex) [1907-1942]
- _renderSoldierSelectAction(data) [1944-1992]

내부 상태: `_panelElements[]` 배열, `_activeTab`, `_actionMode`, `_actionData`

### MapActions.js (~140줄)
순수 게임 액션:
- _doGather(hero) [1629-1650]
- _doLumber(hero) [1706-1724]
- _doFeast() [2103-2121]
- _doStabilize() [2123-2140]
- _launchHunt(hero) [2053-2101]
- _calcFitness(hero, primaryStats) [2514-2521]

### MapTurnFlow.js (~270줄)
턴 진행 시퀀스:
- _startMorningPhase() [2692-2714]
- _showNextEvent() [2716-2723]
- _onEndTurn() [2725-2739]
- _doEndTurn() [2741-2747]
- _processDayPhase() [2773-2796]
- _processEveningPhase() [2798-2813]
- _processNightPhase() [2817-2900]
- _finishNightPhase(turn, defenseResult) [2902-2966]
- _checkSinConditions() [2968-2978]

### popups/PopupsBuild.js (~250줄)
건설/연구/시설 관련 팝업:
- _popupBuild(px, py, pw, ph) [881-995] (115줄)
- _popupResearch(px, py, pw, ph) [996-1051] (56줄)
- _popupFacility(px, py, pw, ph, facility) [1126-1155] (30줄)
- _popupBuildingInfo(px, py, pw, ph, building) [1886-1905] (20줄)

### popups/PopupsHero.js (~360줄)
영웅 관련 팝업:
- _popupHeroSelect(px, py, pw, ph, data) [1053-1121] (69줄)
- _popupHeroDetail(px, py, pw, ph, hero) [1234-1439] (206줄)
- _getHeroStory(sinType) [1440-1454] (15줄)
- _popupRecruit(px, py, pw, ph) [1456-1522] (67줄)

### popups/PopupsAction.js (~350줄)
행동 관련 팝업:
- _popupGather(px, py, pw, ph) [1574-1628] (55줄)
- _popupLumber(px, py, pw, ph) [1651-1705] (55줄)
- _popupPioneer(px, py, pw, ph, data) [1726-1808] (83줄)
- _popupDefense(px, py, pw, ph) [1810-1884] (75줄)
- _popupHunt(px, py, pw, ph) [1994-2051] (58줄)
- _popupPolicy(px, py, pw, ph) [1156-1232] (77줄)
- _popupConfirm(px, py, pw, ph, data) [2754-2771] (18줄)

### MapScene.js 코디네이터 (~400줄)
- constructor, preload, create, _cleanup, update (기존 유지)
- 라우팅 메서드 (코디네이터에 남음):
  - `_showPopup(mode, data)` -- _closeAllPopups() 후 _pushPopup() 위임
  - `_showPanelAction(mode, data)` -- 패널 vs 팝업 분기 라우팅
  - `_closePanelAction()`
  - `_showConfirmPopup(title, message, onConfirm)` [2749-2752]
- create()에서 모듈 인스턴스 생성:
  ```javascript
  this.widgets = new MapWidgets(this);
  this.popupSystem = new MapPopupSystem(this);
  this.hud = new MapHUD(this);
  this.world = new MapWorld(this);
  this.bottomPanel = new MapBottomPanel(this);
  this.actions = new MapActions(this);
  this.turnFlow = new MapTurnFlow(this);
  this.popupsBuild = new PopupsBuild(this);
  this.popupsHero = new PopupsHero(this);
  this.popupsAction = new PopupsAction(this);
  ```

## 모듈 간 통신 규칙

1. 모든 모듈은 `constructor(scene)`로 MapScene 참조를 받음
2. 모듈 간 직접 import 금지 -- 반드시 `this.scene.xxx`를 통해 접근
3. 라우팅(`_showPopup`, `_showPanelAction`)은 MapScene 코디네이터에서만
4. store 구독은 `MapScene.create()`에서 등록, 콜백에서 모듈 메서드 호출

## 구현 순서 (포워딩 레이어 방식으로 안전 보장)

### Phase 0: MapConstants.js 추출
- 상수 블록을 별도 파일로 이동
- MapScene에서 import
- 위험도: **제로** (순수 상수, 런타임 의존 없음)

### Phase 1: 포워딩 레이어 구축
- MapScene에 모든 메서드 그대로 두고
- 새 모듈 생성 (빈 클래스 + `constructor(scene)`)
- `MapScene.create()`에서 모듈 인스턴스 생성
- 아직 위임하지 않음 -- 구조만 준비
- 위험도: **제로** (기존 코드 변경 없음)

### Phase 2: 모듈별 순차 추출
순서 (의존성 낮은 것부터):
1. **MapWidgets** -- 순수 UI 헬퍼, 의존성 0
2. **MapPopupSystem** -- _popupStack 자체 소유
3. **MapHUD** -- 독립 UI 블록
4. **MapActions** -- 순수 게임 액션
5. **MapWorld** -- 맵 렌더링 + 슬롯
6. **MapBottomPanel** -- 탭 렌더러 일괄
7. **PopupsBuild -> PopupsHero -> PopupsAction** (팝업 3분할)
8. **MapTurnFlow** -- 모든 모듈 참조 (마지막)

각 모듈 추출 절차:
- a. 메서드를 새 모듈로 복사
- b. `this.xxx` -> `this.scene.xxx` 변환
- c. MapScene에 forwarding stub 유지: `_drawHUD() { this.hud.draw(); }`
- d. 브라우저 테스트
- e. 다음 모듈로

### Phase 3: 정리
- forwarding stub 제거
- MapScene 코디네이터 최종 정리
- 불필요한 import 제거

## 검증 포인트

1. 매 모듈 추출 후 브라우저 실행 확인 (단계별 검증)
2. `this` -> `this.scene` 변환 누락 시 런타임 에러 -> 각 모듈 추출 후 전체 페이즈 순회 테스트
3. `_panelElements`는 MapBottomPanel 내부, `_popupStack`은 MapPopupSystem 내부로 이동
4. store 구독은 `MapScene.create()`에서 등록, `_cleanup()`에서 해제
5. 각 모듈의 `destroy()` 메서드에서 자체 elements 정리
6. depth 계층 유지: HUD(200), 패널(202), 팝업(300+)

## 위험 요소

1. **자동 테스트 부재** -- 수동 테스트만 가능. 모듈별 추출+즉시 확인으로 완화
2. **this -> this.scene 변환 실수** -- 포워딩 레이어로 한 모듈씩 안전하게 전환
3. **팝업 렌더러 내부에서 다른 팝업 호출 (중첩)** -- `this.scene._showPopup()`으로 코디네이터 경유
4. **preload() 스프라이트 로딩** -- MapScene에 그대로 유지 (Phaser 씬 라이프사이클)

---

마지막 업데이트: 2026-04-03
