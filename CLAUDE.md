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
- 데이터: **CSV** (게임 데이터 21개 파일, 세이브는 LocalStorage)
- Phase 2 이후: Godot(GDScript)으로 이식 → 스팀 출시

## 프로젝트 구조
```
TheSevenSimulation/
├── CLAUDE.md                  # 이 파일
├── docs/
│   ├── GAME_DESIGN.md         # 메인 게임 디자인 문서
│   ├── DEV_PLAN.md            # 개발 계획서
│   ├── ART_DESIGN.md          # 아트 디자인 문서
│   ├── game_design/           # 세부 시스템 설계
│   │   ├── sin_system.md      # 죄종 시스템 (핵심)
│   │   ├── hero_design.md     # 영웅/로스터 설계 (랜덤 생성, 결함 있는 인간)
│   │   ├── battle_design.md   # 전투 시스템 설계
│   │   ├── event_design.md    # 이벤트/선택지 설계
│   │   ├── expedition_design.md # 원정 시스템 설계
│   │   ├── base_design.md     # 거점 시설 설계
│   │   ├── equipment_design.md # 장비 시스템 설계 (재설계 예정)
│   │   ├── chapter_scenario.md # 챕터 시나리오
│   │   └── balance_design.md  # 밸런스 설계서 (전투/경제/사기)
│   ├── story/                 # 스토리 (TheSevenTactics 계승)
│   │   ├── story_guide.md
│   │   ├── story_line.md
│   │   └── chapters/          # 챕터별 상세
│   └── reference/             # 레퍼런스 분석
│       ├── rimworld_analysis.pdf   # RimWorld 심층 분석 (적용 제안 포함)
│       ├── item_system_analysis.md # 10종 게임 아이템 시스템 분석
│       ├── HOMM3_analysis.md       # HoMM3 분석
│       ├── darkest_dungeon_analysis.md # Darkest Dungeon 분석
│       ├── hero_archetypes.md      # 영웅 원형 분석
│       └── seven_sins_lore.md      # 7대 죄악 로어
├── .claude/
│   └── rules/
│       ├── game-design.md     # 기획 논의 규칙
│       └── workflow.md        # 구현 워크플로우
└── src/                       # 소스 코드 (Phase 1: Phaser.js)
    ├── game_logic/            # 순수 게임 로직 (Godot 이식 대상, balance 주입)
    │   ├── BattleEngine.js    # 전투 계산 (MELEE/TAG/DUEL 3모드 + SP/카드)
    │   ├── SpriteComposer.js  # LPC 랜덤 외형 생성 (순수 JS)
    │   └── ...
    ├── scenes/                # Phaser 씬 (Godot 이식 시 대체)
    │   ├── MapScene.js        # 단일 맵 뷰 (모든 페이즈, 영내+영외)
    │   ├── MapDefenseMode.js  # 방어전 오버레이 (영외 전투)
    │   ├── MapHuntPopup.js    # 사냥 1:1 팝업 (MapScene 위)
    │   ├── SpriteConstants.js # 스프라이트 공유 상수/유틸
    │   ├── SpriteRenderer.js  # LPC 스프라이트 런타임 합성 (RenderTexture)
    │   └── ...
    ├── ui/                    # UI 컴포넌트
    └── data/                  # 게임 데이터 CSV (22개) + CsvLoader.js
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
- 기획 논의 시 `game-design` 규칙을 따른다
- 구현 시 `workflow` 규칙을 따른다
- 게임 데이터는 **CSV**로 관리 (JSON 아님)
- 밸런스 수치는 `balance.csv`에서 로드, **코드 내 하드코딩 금지**
- game_logic 모듈은 생성자에서 데이터를 주입받음 (`balance`, `policies` 등)
