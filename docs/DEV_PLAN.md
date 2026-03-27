# TheSevenSimulation 개발 계획서

> 작성일: 2026-03-24
> 마지막 업데이트: 2026-03-27

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
│   └── TurnManager.js        # 턴 진행 (phases 주입)
├── scenes/                   # Phaser 씬 (Godot 이식 시 대체)
│   ├── TitleScene.js         # 타이틀 화면
│   ├── IntroScene.js         # 인트로 연출
│   ├── HeroSelectScene.js    # 영웅 선택 화면 (LPC 합성)
│   ├── MapScene.js           # 단일 맵 뷰 (모든 페이즈 처리)
│   ├── MapDefenseMode.js     # 방어전 오버레이 (MapScene 위)
│   ├── MapHuntPopup.js       # 사냥 1:1 팝업 (MapScene 위)
│   ├── EventScene.js         # 이벤트/선택지 (오버레이)
│   ├── BattleSceneA.js       # X축 오토배틀 (원정 리플레이용)
│   ├── BattleSceneB.js       # 태그매치 (프로토 보관)
│   ├── DuelBattleScene.js    # 1:1 전투 (레거시)
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
└── data/                     # 게임 데이터 (CSV, 21개 파일)
    ├── CsvLoader.js           # CSV 파서 + 전체 로더 + 데이터 조립
    ├── balance.csv            # 밸런스 상수 70+개
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
    └── stat_names.csv         # 스탯 한글명
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
| 22 | 영웅 수식어 시스템 (독립 세부스탯 상위2 조합) | [x] |
| 23 | 방어전 MapDefenseMode (맵 위 오버레이) | [x] |
| 24 | 사냥 MapHuntPopup (맵 위 팝업) | [x] |
| 25 | 기획서 전면 업데이트 (3자원, HP 모델, 습격 빈도) | [x] |

---

## 다음 작업 (미완료)

기획서 대비 코드 점검 결과 아래 항목이 미반영 또는 불일치:

| # | 항목 | 상태 | 상세 |
|---|------|------|------|
| 1 | **장비 시스템** | Phase 2 | equipment_design.md "재설계 예정" |
| 2 | **챕터 2~7 콘텐츠** | Phase 2 | chapters.csv에 7챕터 정의 완료, stages.csv는 챕터1만 |
| 3 | **3자원 체계 구현** | 미구현 | 기획 확정 (식량/나무/골드). Store+HUD+채집/벌목 행동 구현 필요 |
| 4 | **원정 실시간 전투** | 미구현 | 결과형→실시간 오토배틀+카드로 전환 예정 |
| 5 | **챕터별 환경 변조 적용** | 미확인 | chapters.csv에 morale_modifier 있으나 적용 여부 확인 필요 |
| 6 | **방어전 테스트** | 필요 | MapDefenseMode 구현 완료, 실제 플레이 테스트 필요 |
| 7 | **사냥 테스트** | 필요 | MapHuntPopup 구현 완료, 실제 플레이 테스트 필요 |
| 8 | **밸런싱** | 미착수 | 사기 변동량, 전투 계수, 습격 스케일링, 죄종 만족조건 |

---

*마지막 업데이트: 2026-03-27 (MapDefenseMode/MapHuntPopup 구현, 기획서 전면 정합성 업데이트, HP 모델 확정, 3자원 확정)*
