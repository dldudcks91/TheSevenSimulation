# TheSevenSimulation 개발 계획서

> 작성일: 2026-03-24
> 마지막 업데이트: 2026-04-07

---

## 기술 스택

### Phase 1: 웹 프로토타입
| 구분 | 기술 |
|------|------|
| 서버 | **없음** (클라이언트 전용, 싱글플레이어) |
| 게임 엔진 | **Phaser.js** (2D 게임 프레임워크) |
| 게임 로직 | JS (ES Modules) — Phaser와 분리 |
| 데이터 | **CSV** (게임 데이터, 세이브는 LocalStorage) |
| UI | Phaser Canvas (팝업 오버레이 + 우측 패널) |
| 해상도 | **1280×720** |
| 전투 | **시각 시뮬레이션** (자동전투, 스프라이트 애니메이션) |

### Phase 2: Godot 이식 (스팀 출시)
| 구분 | 기술 |
|------|------|
| 엔진 | Godot 4.x (GDScript) |
| 플랫폼 | PC (Steam) |
| 데이터 | CSV → Resource |

> Phaser.js → Godot 이식 시 game_logic(JS) → GDScript 변환, scenes → Godot 씬 대체. CSV 데이터는 그대로 사용 가능.

---

## Phase 1 개발 계획

### 소스 코드 구조

```
src/
├── index.html
├── app.js                    # 진입점, CSV 전체 로드 + Phaser 초기화
├── game_logic/               # 순수 게임 로직 (Godot 이식 대상)
│   ├── SinSystem.js          # 죄종/사기/폭주/이탈/연쇄반응 (balance+desertionEffects 주입)
│   ├── HeroManager.js        # 영웅 관리 (balance 주입)
│   ├── EventSystem.js        # 이벤트/선택지
│   ├── ExpeditionManager.js  # 원정/방어전 (stagesData+balance 주입)
│   ├── BattleEngine.js       # 전투 계산 (balance 주입)
│   ├── BaseManager.js        # 거점/건설/연구/포고령 (policies+balance 주입)
│   ├── TurnManager.js        # 턴 페이즈 관리 (phases 주입)
│   ├── DayActions.js         # 낮 행동 순수 로직 — 채집/벌목/연회/사냥 (백테스팅 가능)
│   └── TurnProcessor.js      # 턴 전체 로직 조율 — 낮→밤 처리 (백테스팅 가능)
├── scenes/                   # Phaser 씬 (Godot 이식 시 대체)
│   ├── TitleScene.js         # 타이틀 화면
│   ├── IntroScene.js         # 인트로 연출
│   ├── HeroSelectScene.js    # 영웅 선택 화면 (LPC 합성)
│   ├── MapScene.js           # 단일 맵 뷰 (코디네이터, ~280줄)
│   ├── map/                  # MapScene 하위 모듈 (11개)
│   │   ├── MapConstants.js, MapWidgets.js, MapPopupSystem.js
│   │   ├── MapHUD.js, MapWorld.js, MapBottomPanel.js
│   │   ├── MapActions.js, MapTurnFlow.js
│   │   └── popups/ (PopupsBuild.js, PopupsHero.js, PopupsAction.js)
│   ├── MapDefenseMode.js     # 방어전 오버레이 (영외 전투)
│   ├── MapHuntPopup.js       # 사냥 1:1 팝업 (MapScene 위)
│   ├── MapActionPopup.js     # 채집/벌목 행동 결과 팝업 (MapScene 위)
│   ├── EventScene.js         # 이벤트/선택지 (오버레이)
│   ├── BattleSceneA.js       # X축 오토배틀 (원정 리플레이용)
│   ├── BattleSceneB.js       # 태그매치 (프로토 보관)
│   ├── DuelBattleScene.js    # 1:1 전투 (레거시)
│   ├── SpriteConstants.js    # 스프라이트 공유 상수/유틸
│   ├── SpriteRenderer.js     # LPC 스프라이트 런타임 합성
│   ├── ResultScene.js        # 원정 결과 (오버레이)
│   ├── SettlementScene.js    # 결산 (오버레이)
│   └── GameOverScene.js      # 게임 오버 화면
├── ui/                       # UI 컴포넌트
│   └── components/
├── assets/                   # 게임 에셋
│   └── sprites/
├── store/                    # 상태 관리
│   ├── Store.js
│   └── SaveManager.js
└── data/                     # 게임 데이터 (CSV, 26개 파일)
    ├── CsvLoader.js           # CSV 파서 + 전체 로더 + 데이터 조립
    ├── balance.csv            # 밸런스 상수 108개
    ├── hero_names.csv         # 영웅 이름 풀
    ├── sin_types.csv          # 7죄종 정의
    ├── sin_relations.csv      # 죄종 관계 매트릭스
    ├── sin_satisfaction.csv   # 만족/불만 조건
    ├── sin_rampage_chain.csv  # 폭주 연쇄 반응
    ├── events.csv             # 이벤트 30개 본체
    ├── event_choices.csv      # 선택지 105개
    ├── event_effects.csv      # 효과 140개
    ├── facilities.csv         # 시설 9종
    ├── research.csv           # 연구 6종
    ├── chapters.csv           # 7챕터
    ├── stages.csv             # 스테이지
    ├── stage_enemies.csv      # 스테이지별 적
    ├── policies.csv           # 포고령 3×3
    ├── hunt_enemies.csv       # 사냥 적 5종
    ├── defense_scaling.csv    # 방어전 스케일링
    ├── phases.csv             # 턴 4페이즈
    ├── morale_states.csv      # 사기 5단계
    ├── desertion_effects.csv  # 이탈 효과
    ├── stat_names.csv         # 스탯 한글명
    └── traits.csv             # 특성 55개 (선천 45 + 후천 10)
```

> **핵심**: `game_logic/`는 Phaser 의존 없는 순수 JS. 모든 밸런스 상수는 CSV에서 로드하여 생성자로 주입. 하드코딩 금지.

### 구현 순서

| 순서 | 기능 | 상태 |
|------|------|------|
| 1 | 프로젝트 셋업 (Phaser.js 기본 구조) | [x] |
| 2 | 영웅 시스템 (랜덤 생성, 7스탯, 죄종, 사기) | [x] |
| 3 | 턴 진행 (아침/낮/저녁/밤 4단계) | [x] |
| 4 | 이벤트 시스템 (선택지 → 사기 변화) | [x] |
| 5 | 거점 시설 건설 (Tier 1~3 건설 트리) | [x] |
| 6 | 연구 시스템 | [x] |
| 7 | 폭주 & 이탈 & 연쇄 반응 | [x] |
| 8 | 원정 파견 & 결과 | [x] |
| 9 | 전투 엔진 (7스탯 기반 자동 계산 + A/B 전투씬 분리 시각화) | [x] |
| 10 | 밤 습격 (방어전 시각 시뮬레이션) | [x] |
| 11 | 주점 (영웅 고용) | [x] |
| 12 | 타락/구원 분기 | [x] |
| 13 | 챕터 시나리오 시스템 (환경 변조 + 챕터 이벤트) | [x] |
| 14 | 챕터1 콘텐츠 (스테이지 3 + 보스 + 보스 서사) | [x] |
| 15 | 세이브/로드 | [x] |
| 16 | UI 폴리시 | [x] |
| 17 | ActionScene 삭제 → MainScene 영내/영외 전환 + 팝업 | [x] |
| 18 | JSON → CSV 전면 전환 + 하드코딩 데이터 추출 | [x] |
| 19 | MainScene → MapScene 단일 맵 뷰 전환 | [x] |
| 20 | 전투 방식 확정 (X축 오토배틀 + 카드 + 일기토) | [x] |
| 21 | LPC 스프라이트 런타임 합성 (SpriteComposer + SpriteRenderer) | [x] |
| 22 | 영웅 수식어 시스템 (죄종 수치 상위2 조합) | [x] |
| 23 | 방어전 MapDefenseMode (맵 위 오버레이) | [x] |
| 24 | 사냥 MapHuntPopup (맵 위 팝업) | [x] |
| 25 | 기획서 전면 업데이트 (3자원, HP 모델, 습격 빈도) | [x] |
| 26 | 탭 순서 변경 (시설→영웅→아이템→원정→정책) + 3자원 HUD | [x] |
| 27 | 방어 배치 시스템 (명시적 배치 필수, 자동 참여 제거) | [x] |
| 28 | 개척 시스템 (3×3 초기 해금, 5×5 확장) | [x] |
| 29 | 건설/연구/개척 진행도 바 시스템 (영웅 스탯 기반) | [x] |
| 30 | 스택 기반 팝업 시스템 리팩토링 (_pushPopup/_closePopup) | [x] |
| 31 | 건설 다중 동시 가능 (building→buildings 배열) | [x] |
| 32 | 사냥/채집/벌목 행동 1회 제한 (status 잠금) | [x] |
| 33 | 채집→식량, 벌목→나무 자원 분리 + 농장/벌목장 시설 | [x] |
| 34 | 팝업 버튼 depth 하드코딩 제거 + 전체 depth 정리 | [x] |
| 35 | MapDefenseMode/MapHuntPopup destroy() 메모리 누수 수정 | [x] |
| 36 | HeroManager 사기 임계값 balance.csv 연동 | [x] |
| 37 | 방어 배치 후 영웅 status 복원 버그 수정 | [x] |
| 38 | 턴종료 확인 팝업 스택 시스템 전환 | [x] |
| 39 | 스프라이트 walk 액션 preload 누락 수정 | [x] |
| 40 | 방어전 영외 전투 (영내/영외 공간 분리) | [x] |
| 41 | 하드코딩 수치 → balance.csv 이관 (108개 키) | [x] |
| 42 | 스프라이트 상수 공유 모듈 추출 (SpriteConstants.js) | [x] |
| 43 | shutdown 핸들러 추가 (MapScene, BattleSceneA/B) | [x] |
| 44 | 불필요 파일 삭제 (BattleScene.js, MainScene.js) | [x] |
| 45 | 합성 텍스처 lifecycle 관리 (destroy 시 textures.remove) | [x] |
| 46 | 밸런스 설계서 작성 (balance_design.md) | [x] |
| 47 | 턴 종료 시 영웅 상태 전체 idle 초기화 (expedition/injured/knocked_out 제외) | [x] |
| 48 | 건설/연구 진행률 표시 분수 형식 전환 (33% → 12/25) | [x] |
| 49 | 영웅 고용 주점 건설 필수 조건 추가 | [x] |
| 50 | 적 접근 경로 시각화 (성문→영외 점선 7칸, 습격 카운트다운) | [x] |
| 51 | 도감 탭 추가 (몬스터 19종 스프라이트 카드) | [x] |
| 52 | 몬스터 스프라이트 확충 (늑대/고블린/거미/곰/사자/사슴/식인화/대형벌레) | [x] |
| 53 | 디버그 모드 (맵 클릭 좌표 표시, Shift+D 토글) | [x] |
| 54 | 건설 팝업 UI 개선 (골드 표시, 티어 뱃지, 비용 분리, 골드부족 표시) | [x] |
| 55 | 시설 탭 UI 개선 (진행도 바, 티어 표시) | [x] |
| 56 | BattleSceneA UI/연출 보강 (배경/HP바/카드/일기토/결과/로그/라운드) | [x] |
| 57 | 새 게임 초기 아이템 랜덤 지급 + 세이브/로드 인벤토리·식량·나무 연동 | [x] |
| 58 | 채집/벌목 행동 팝업 (MapActionPopup — 프로그레스 바 + 결과 + 죄종 대사) | [x] |

---

## 다음 작업 (미완료)

| # | 항목 | 상태 | 상세 |
|---|------|------|------|
| 1 | **사기 5구간 재설계** | 기획 확정 | 이탈/불만/안정/고양/폭주 5구간 + 변동 로그 팝업(최근 7건) + 죄종별 차별 반응. fun_review 2장 |
| 2 | **장비 시스템** | Phase 2 | equipment_design.md "재설계 예정" |
| 3 | **챕터 2~7 콘텐츠** | Phase 2 | chapters.csv에 7챕터 정의 완료, stages.csv는 챕터1만 |
| 4 | **원정 실시간 전투** | 미구현 | 결과형→실시간 오토배틀+카드로 전환 예정 |
| 5 | **챕터별 환경 변조 적용** | 미구현 | CSV 로드+registry 등록까지 완료, 게임플레이 적용 코드 없음 |
| 6 | **밸런싱 수치 적용** | 초안 완료 | balance_design.md 작성 완료. 수치 적용 미착수 |
| 7 | **MapScene 분리** | ✅ 완료 | 2979줄 → 278줄 코디네이터 + 11개 모듈(map/) + game_logic 2개(DayActions/TurnProcessor). 백테스팅 가능 구조 |
| 8 | **죄종 수치화 + 특성 시스템** | ✅ 2단계 완료 | 1단계: sinType→primarySin 전환(20+파일). 2단계: primarySin 라벨 제거, 특성 우선→sinStats 가중 확률→이력 누적 후천 고정. SinUtils.js 신규, 선천 특성 10개→행동강박 폭주/이탈 매핑, 후천 폭주 7종 추가(traits.csv 67개). game_logic 7파일+UI 14파일 전환 완료. |

---

## 완료된 리팩토링 (2026-03-30)

| 항목 | 내용 |
|------|------|
| **shutdown 핸들러** | MapScene, BattleSceneA/B에 _cleanup() + shutdown 이벤트 등록. store.subscribe 해제, 오버레이 씬 정리 |
| **스프라이트 상수 통합** | SpriteConstants.js 신규 생성. 4개 파일에서 ~800줄 중복 제거 |
| **불필요 파일 삭제** | BattleScene.js, MainScene.js (~2580줄 제거) |
| **미정의 상수 수정** | ZONE_GATE_END/ZONE_OUTSIDE_END → ZONE_OUTSIDE_START/MAP_WORLD_W |
| **depth 충돌 해소** | MapDefenseMode 유닛 depth 3000+fy → fy (카드 UI 3001 아래로) |
| **합성 텍스처 정리** | MapDefenseMode, MapHuntPopup, BattleSceneA에서 textures.remove() 추가 |
| **하드코딩 이관** | SP, 일기토 확률, 스탯 범위 등 25개 키를 balance.csv로 이관 (총 108개) |

---

*마지막 업데이트: 2026-04-04 (채집/벌목 행동 팝업 MapActionPopup 추가)*
