# TheSevenSimulation 개발 계획서

> 작성일: 2026-03-24

---

## 기술 스택

### Phase 1: 웹 프로토타입
| 구분 | 기술 |
|------|------|
| 서버 | **없음** (클라이언트 전용, 싱글플레이어) |
| 게임 엔진 | **Phaser.js** (2D 게임 프레임워크) |
| 게임 로직 | JS (ES Modules) — Phaser와 분리 |
| 데이터 | JSON (게임 데이터, 세이브는 LocalStorage) |
| UI | Phaser Canvas + HTML 혼합 |
| 전투 | **시각 시뮬레이션** (자동전투, 스프라이트 애니메이션) |

### Phase 2: Godot 이식 (스팀 출시)
| 구분 | 기술 |
|------|------|
| 엔진 | Godot 4.x (GDScript) |
| 플랫폼 | PC (Steam) |
| 데이터 | JSON → Resource |

> Phaser.js → Godot 이식 시 게임 로직(JS)은 GDScript로 변환, 렌더링은 Godot 씬으로 대체.

---

## Phase 1 개발 계획

### 소스 코드 구조 (계획)

```
src/
├── index.html
├── app.js                    # 앱 진입점, Phaser 초기화
├── game_logic/               # 순수 게임 로직 (Godot 이식 대상)
│   ├── SinSystem.js          # 죄종/사기 시스템 (영웅 간 관계)
│   ├── HeroManager.js        # 영웅 관리 (랜덤 생성, 스탯, 사기)
│   ├── EventSystem.js        # 이벤트/선택지
│   ├── ExpeditionManager.js  # 원정 관리
│   ├── BattleEngine.js       # 전투 계산 (7스탯 기반)
│   ├── BaseManager.js        # 거점 시설/건설/연구 관리
│   └── TurnManager.js        # 턴 진행 관리
├── scenes/                   # Phaser 씬 (Godot 이식 시 대체)
│   ├── MainScene.js          # 거점 메인 화면
│   ├── BattleScene.js        # 전투 시각화 (자동전투)
│   ├── ExpeditionScene.js    # 원정 결과/리플레이
│   └── EventScene.js         # 이벤트/선택지 화면
├── ui/                       # UI 컴포넌트
│   └── components/
└── data/                     # 게임 데이터 (이식 시 그대로)
    ├── events.json
    ├── sin_relations.json
    ├── facilities.json
    └── stages.json
```

> **핵심**: `game_logic/`는 Phaser 의존 없는 순수 JS. `scenes/`가 Phaser 렌더링 담당. Godot 이식 시 game_logic → GDScript, scenes → Godot 씬.

### 구현 순서

| 순서 | 기능 | 상태 |
|------|------|------|
| 1 | 프로젝트 셋업 (Phaser.js 기본 구조) | [ ] |
| 2 | 영웅 시스템 (랜덤 생성, 7스탯, 죄종, 사기) | [ ] |
| 3 | 턴 진행 (아침/낮/저녁/밤 4단계) | [ ] |
| 4 | 이벤트 시스템 (선택지 → 사기 변화) | [ ] |
| 5 | 거점 시설 건설 (Tier 1~3 건설 트리) | [ ] |
| 6 | 연구 시스템 | [ ] |
| 7 | 폭주 & 이탈 & 연쇄 반응 | [ ] |
| 8 | 원정 파견 & 결과 | [ ] |
| 9 | 전투 엔진 (7스탯 기반 자동 계산 + 시각화) | [ ] |
| 10 | 밤 습격 (방어전 시각 시뮬레이션) | [ ] |
| 11 | 주점 (영웅 고용) | [ ] |
| 12 | 타락/구원 분기 | [ ] |
| 13 | 챕터 시나리오 시스템 (환경 변조 + 챕터 이벤트) | [ ] |
| 14 | 챕터1 콘텐츠 (스테이지 3 + 보스 + 보스 서사) | [ ] |
| 15 | 세이브/로드 | [ ] |
| 16 | UI 폴리시 | [ ] |

---

*마지막 업데이트: 2026-03-24 (챕터 시나리오 시스템 구현 항목 추가)*
