# TheSevenSimulation - Project Guide

## 프로젝트 개요
7대 죄악(Seven Deadly Sins) 테마의 거점 경영 시뮬레이션 게임.
마왕 바알이 인간 세계에 추락하여 림보(거점)를 운영하며, 결함 있는 인간 영웅들을 이끌고 7대 죄악의 화신들에게 복수하는 여정. 바알은 판결자로서 죄종 수치 없이 경영 판단으로 영웅들의 드라마를 이끈다.
스토리는 컷신이 아닌 **시뮬레이션 체감**으로 전달 — 챕터별 환경 변조 + 챕터 이벤트 + 보스 서사(브리핑+유언).

**장르**: 거점 경영 시뮬레이션 + 로스터 관리 + 자동전투 원정
**핵심 재미**: 죄종 시스템이 만들어내는 창발적 드라마 (RimWorld식 연쇄 반응)
**참고작**: RimWorld(연쇄 반응), Darkest Dungeon(로스터 관리), Frostpunk(도덕적 선택), CK3(지도자 특성), 삼국지6(꿈 시스템), HoMM3(지휘관)
**원작**: TheSevenTactics (세계관/스토리/영웅/죄종 관계 계승)

## 기술 스택 (Phase 1: 웹 프로토타입)
- 서버 없음 — 클라이언트 JS만으로 동작 (싱글플레이어)
- 게임 엔진: **Phaser.js** (2D 게임 프레임워크)
- 게임 로직: JS (ES Modules) — Phaser와 분리
- 전투: **시각 시뮬레이션** (자동전투, 스프라이트 애니메이션)
- 데이터: **CSV** (게임 데이터 26개 파일, 세이브는 LocalStorage)
- Phase 2 이후: Godot(GDScript)으로 이식 → 스팀 출시

## 프로젝트 구조
```
TheSevenSimulation/
├── CLAUDE.md                  # 이 파일
├── docs/
│   ├── GAME_DESIGN.md         # 메인 게임 디자인 문서
│   ├── DEV_PLAN.md            # 개발 계획서
│   ├── game_design/           # 세부 시스템 설계 (14개)
│   │   ├── sin_system.md      # 죄종 시스템 (핵심)
│   │   ├── hero_design.md     # 영웅/로스터 설계 (랜덤 생성, 결함 있는 인간)
│   │   ├── battle_design.md   # 전투 시스템 설계
│   │   ├── event_design.md    # 이벤트/선택지 설계
│   │   ├── expedition_design.md # 원정 시스템 설계
│   │   ├── base_design.md     # 거점 시설 설계
│   │   ├── equipment_design.md # 장비 시스템 설계
│   │   ├── chapter_scenario.md # 챕터 시나리오
│   │   ├── balance_design.md  # 밸런스 설계서 (전투/경제/사기)
│   │   ├── ui_design.md       # UI/화면 설계 (씬 변경 시 먼저 업데이트)
│   │   ├── faction_design.md  # 세력/초청 이벤트 설계
│   │   ├── battle_intervention_analysis.md # 전투 개입 방식 분석
│   │   ├── fun_review_20260401.md # 재미 관점 기획 리뷰
│   │   └── mapscene_refactor_plan.md # MapScene 리팩토링 계획
│   ├── story/                 # 스토리 (TheSevenTactics 계승)
│   │   ├── story_guide.md
│   │   ├── story_line.md
│   │   └── chapters/          # 챕터별 상세 (prologue + ch1~ch7)
│   ├── art/                   # 아트 디자인
│   │   ├── hero_portrait_prompts.md # 영웅 초상화 프롬프트
│   │   └── hero_portraits.csv      # 영웅 초상화 데이터
│   └── reference/             # 레퍼런스 분석
│       ├── rimworld_analysis.pdf   # RimWorld 심층 분석 (적용 제안 포함)
│       ├── item_system_analysis.md # 10종 게임 아이템 시스템 분석
│       ├── HOMM3_analysis.md       # HoMM3 분석
│       ├── darkest_dungeon_analysis.md # Darkest Dungeon 분석
│       ├── hero_archetypes.md      # 영웅 원형 분석
│       ├── seven_sins_lore.md      # 7대 죄악 로어
│       ├── rtk6_battle_analysis.md # RTK6 전투 분석
│       └── tab_ui_analysis.md      # 탭 UI 분석
├── tools/                     # 개발 도구 (LPC 스프라이트 등)
│   ├── lpc_composer.py        # LPC 스프라이트 합성기
│   ├── lpc_heroes.json        # 영웅 스프라이트 설정
│   ├── compose_lpc.py         # LPC 합성 스크립트
│   ├── extract_lpc_parts.py   # LPC 파츠 추출
│   └── convert_monsters.py    # 몬스터 변환
├── .claude/
│   ├── rules/
│   │   ├── client.md          # 클라이언트 JS 규칙
│   │   ├── game-design.md     # 기획 논의 규칙
│   │   └── workflow.md        # 구현 워크플로우
│   └── skills/                # 10개 전문 스킬 (하단 목록 참조)
└── src/                       # 소스 코드 (Phase 1: Phaser.js)
    ├── app.js                 # 진입점, CSV 전체 로드 + Phaser 초기화
    ├── constants.js           # 공유 상수
    ├── index.html
    ├── game_logic/            # 순수 게임 로직 (Godot 이식 대상, 12개)
    │   ├── BaseManager.js     # 거점/건설/연구/포고령 (policies 주입)
    │   ├── BattleEngine.js    # 전투 계산 (MELEE/TAG/DUEL 3모드 + SP/죄종 반응)
    │   ├── DayActions.js      # 낮 행동 순수 로직 (채집/벌목/연회/사냥)
    │   ├── EventSystem.js     # 이벤트/선택지
    │   ├── ExpeditionManager.js # 원정/방어전 (stagesData 주입)
    │   ├── HeroManager.js     # 영웅 랜덤 생성, 사기 관리
    │   ├── MorningReport.js   # 아침 보고 생성
    │   ├── SinSystem.js       # 죄종/사기/폭주/이탈/연쇄반응
    │   ├── SinUtils.js        # 죄종 유틸리티 함수
    │   ├── SpriteComposer.js  # LPC 랜덤 외형 생성 (순수 JS)
    │   ├── TurnManager.js     # 턴 진행 (phases 주입)
    │   └── TurnProcessor.js   # 턴 전체 로직 조율 (낮→밤 처리)
    ├── scenes/                # Phaser 씬 (17개 + map/ 하위 모듈)
    │   ├── TitleScene.js      # 타이틀
    │   ├── IntroScene.js      # 인트로
    │   ├── HeroSelectScene.js # 영웅 선택
    │   ├── MapScene.js        # 단일 맵 뷰 (코디네이터)
    │   ├── map/               # MapScene 하위 모듈 (9개 + popups/)
    │   │   ├── MapConstants.js, MapWidgets.js, MapPopupSystem.js
    │   │   ├── MapHUD.js, MapWorld.js, MapBottomPanel.js
    │   │   ├── MapActions.js, MapTurnFlow.js, MapHeroInspector.js
    │   │   └── popups/ (PopupsBuild, PopupsHero, PopupsAction)
    │   ├── MapDefenseMode.js  # 방어전 오버레이 (영외 전투)
    │   ├── MapHuntPopup.js    # 사냥 1:1 팝업 (MapScene 위)
    │   ├── MapActionPopup.js  # 채집/벌목 행동 결과 팝업 (MapScene 위)
    │   ├── MorningReportPopup.js # 아침 보고 팝업
    │   ├── EventScene.js      # 이벤트 씬
    │   ├── BattleSceneA.js    # 돌진형 전투
    │   ├── BattleSceneB.js    # 필드 이동형 전투 (기본값)
    │   ├── DuelBattleScene.js # 1:1 전투 (사냥)
    │   ├── ResultScene.js     # 결과
    │   ├── SettlementScene.js # 정산
    │   ├── GameOverScene.js   # 게임오버
    │   ├── SpriteConstants.js # 스프라이트 공유 상수/유틸
    │   └── SpriteRenderer.js  # LPC 스프라이트 런타임 합성 (RenderTexture)
    ├── store/                 # 상태 관리
    │   ├── Store.js           # Central Store (pub/sub)
    │   └── SaveManager.js     # LocalStorage 세이브/로드
    ├── assets/                # 게임 에셋
    └── data/                  # 게임 데이터 CSV (26개) + CsvLoader.js
```

## 기획 문서 위치
- 메인 기획서: `docs/GAME_DESIGN.md`
- 개발 계획서: `docs/DEV_PLAN.md`
- 세부 시스템: `docs/game_design/`
- 스토리: `docs/story/` (TheSevenTactics에서 계승)

## 작업 규칙 (필수)
- **구현/개발 요청** 시 → `.claude/skills/client-*` 스킬을 먼저 확인하고 호출
- **기획/디자인 논의** 시 → `.claude/skills/design-*` 스킬을 먼저 확인하고 호출
- 스킬을 호출하지 않고 직접 작업하지 말 것
- 매칭되는 스킬이 없을 때만 직접 작업
- **씬(Scene) 변경 시** → `docs/game_design/ui_design.md`를 **먼저 업데이트**한 후 코드 구현

### 스킬 목록
| 접두어 | 스킬 | 용도 |
|--------|------|------|
| `client-` | `client-implement` | 기능 구현 (구현해줘, 만들어줘, 개발해줘) |
| `client-` | `client-review` | 코드 리뷰 (리뷰해줘, 검토해줘) |
| `client-` | `client-debug` | 버그 수정 (버그, 에러, 안 돼) |
| `design-` | `design-battle` | 전투/밸런스 기획 |
| `design-` | `design-economy` | 경제/거점 기획 |
| `design-` | `design-narrative` | 내러티브/이벤트 기획 |
| `design-` | `design-system` | 시스템 디자인 (사기, 연쇄반응) |
| `design-` | `design-ux` | UX/UI 설계 |
| `design-` | `design-review` | 기획 전체 리뷰 |
| `sprite-` | `sprite-compose` | LPC 스프라이트 생성 (캐릭터 만들어줘, 스프라이트 바꿔줘) |

## 개발 규칙
- 기획서는 한국어로 작성
- 문서 변경 시 마지막 업데이트 날짜 기재
- **기획/코드 변경 시 파급 문서 확인** — 변경 내용이 `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`에도 반영되어야 하는지 점검
- 기획 논의 시 `game-design` 규칙을 따른다
- 구현 시 `workflow` 규칙을 따른다
- 게임 데이터는 **CSV**로 관리 (JSON 아님)
- 밸런스 수치는 `balance.csv`에서 로드, **코드 내 하드코딩 금지**
- game_logic 모듈은 생성자에서 데이터를 주입받음 (`balance`, `policies` 등)
