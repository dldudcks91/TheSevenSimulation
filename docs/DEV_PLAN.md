# TheSevenSimulation 개발 계획서

> 작성일: 2026-03-24
> 마지막 업데이트: 2026-04-27 (Phase G — CSV SSOT 메타 정책 명시)
>
> **메타 정책**: 본 문서는 개발 단계·일정·범위 정의. 게임 시스템의 절대 수치는 도메인별 기획서 + `src/data/*.csv` (SSOT)에서 관리. 본 문서에 등장하는 "영웅 21명·이벤트 30개" 등은 **목표 카운트** (구조적 화이트리스트).

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
│   ├── SinSystem.js          # 죄종/폭주/이탈/연쇄반응 (balance+desertionEffects 주입)
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
    ├── facilities.csv         # 시설 23종 (Tier 0~3)
    ├── research.csv           # 연구 6종
    ├── chapters.csv           # 7챕터
    ├── stages.csv             # 스테이지
    ├── stage_enemies.csv      # 스테이지별 적
    ├── policies.csv           # 포고령 3×3
    ├── hunt_enemies.csv       # 사냥 적 5종
    ├── defense_scaling.csv    # 방어전 스케일링
    ├── phases.csv             # 턴 4페이즈
    ├── morale_states.csv      # (레거시, 실제 미사용 — 사기 시스템 제거됨)
    ├── desertion_effects.csv  # 이탈 효과
    ├── stat_names.csv         # 스탯 한글명
    └── traits.csv             # 특성 38개 (고유 21 장점전용 + 후천 행동 10 + 후천 폭주 7)
```

> **핵심**: `game_logic/`는 Phaser 의존 없는 순수 JS. 모든 밸런스 상수는 CSV에서 로드하여 생성자로 주입. 하드코딩 금지.

### 구현 순서

| 순서 | 기능 | 상태 |
|------|------|------|
| 1 | 프로젝트 셋업 (Phaser.js 기본 구조) | [x] |
| 2 | 영웅 시스템 (랜덤 생성, 7스탯, 죄종 수치 동적화) | [x] |
| 3 | 턴 진행 (아침/낮/저녁/밤 4단계) | [x] |
| 4 | 이벤트 시스템 (선택지 → 죄종 수치 변동) | [x] |
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
| 20 | 전투 방식 확정 (X축 오토배틀 + 죄종 반응 + 일기토) — 카드 시스템 제거 (2026-04-13) | [x] |
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
| 36 | HeroManager 죄종 수치 임계값 balance.csv 연동 | [x] |
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
| 56 | BattleSceneA UI/연출 보강 (배경/HP바/일기토/결과/로그/라운드) — 카드 UI 제거 (2026-04-13) | [x] |
| 57 | 새 게임 초기 아이템 랜덤 지급 + 세이브/로드 인벤토리·식량·나무 연동 | [x] |
| 58 | 채집/벌목 행동 팝업 (MapActionPopup — 프로그레스 바 + 결과 + 죄종 대사) | [x] |
| 59 | **원정 맵 탐색 프로토타입** (ExpeditionScene + ExpeditionNodeManager) — STS 노드 방식 / 주사위 방식, HUD ⚙ 토글 | [x] |
| 60 | **원정 결과 Store 반영** — 전투 승패 골드·영웅 부상·HP 반영, 보스 격파 → 챕터 해금, 야영 HP/Stamina 회복 (2026-04-16) | [x] |
| 61 | **조우 이벤트 노드 연동** — EventSystem.pickEncounterEvent + target='party'. 조우 이벤트 F1~F3 추가 (부상 순례자/제단/보물상자) (2026-04-16) | [x] |
| 62 | **감시탑 ↔ 구름 해제 연동** — Lv.1/2/3 = +1/+2/전체 스텝 미리보기 (2026-04-16) | [x] |
| 63 | **챕터별 원정 노드 CSV화** — expedition_nodes.csv (7ch×7노드) + expedition_dice.csv (7ch×25칸) (2026-04-16) | [x] |
| 64 | **바알 죄종 수치 기반 시스템** — Store.playerSins, SaveManager, HUD 표시, 이벤트 target='player_sin_X' 태깅 (2026-04-16) | [x] |
| 65 | **체력(stamina) 시스템 Phase A** — hero.stamina 필드, 턴 회복 / 행동 소모 / 과로 발병 / 피로 효율 감소 / UI 바 (2026-04-16) | [x] |
| 66 | **아침 보고 죄종 태그 버그 수정** — MorningReportPopup sin 태그가 undefined 표시되던 문제 (2026-04-16) | [x] |
| 67 | **병사 시스템 전면 제거 + 영웅 HP 직격 구조** — balance.csv `hero_hp_base/per_vitality/regen_per_turn` 추가, BattleEngine/Expedition/Defense 전면 영웅 HP 기반 (2026-04-16) | [x] |
| 68 | **Stamina 구간별 효율 감소** — 피로 -20%, 과로 -40%, 발병 판정 (TurnProcessor.processDayPhase) (2026-04-16) | [x] |
| 69 | **죄종 × Stamina 보정** — 주 성향별 소모/회복 배율 CSV(`stamina_mult_<sin>_*`) + HeroManager 적용 (2026-04-16) | [x] |
| 70 | **UI 정보 계층 정리** — HUD 병사 카운터 제거, Stamina 아이콘 경고 전환, HP 바 영웅 상시 표시 (2026-04-16) | [x] |
| 71 | **사기 시스템 완전 제거 + 죄종 수치 동적화** — HeroManager/SinSystem/TurnProcessor/DayActions/ExpeditionNodeManager/EventSystem/MorningReport 전면 재작성. balance.csv morale 키 제거, sin_rampage_*/sin_*_rise/fall 키 신규. UI 6개 씬 사기 바 → 죄종 수치 바 교체 (2026-04-17) | [x] |
| 72 | **i18n 시스템 Phase A — Godot 스타일 Wide CSV 기반** — LocaleManager.js(t/dataText/field/josa), locale_ui.csv + locale_data.csv, CsvLoader/app.js 연동, TitleScene KO/EN 토글 (2026-04-24) | [x] |
| 73 | **i18n Phase B — CSV `_key` 컬럼 추가 + locale_data 번역 채우기** — sin_types/stat_names/facilities/research/chapters/edicts/phases/hunt_enemies/stages/stage_enemies/desertion_effects/sin_relations/sin_rampage_chain/items/traits 15개 CSV 전환. locale_data.csv 226키 영문 번역 (2026-04-24) | [x] |
| 74 | **i18n Phase B 2차 — events/event_choices/hero_names** — events.csv title_key/scene_key 추가, hero_names.csv name_en 영문 이름 풀 54개, event_choices는 CsvLoader에서 key 자동 합성, locale_data 이벤트 타이틀 33개 번역 (2026-04-24) | [x] |
| 75 | **i18n Phase C 1차 — 주요 씬 하드코딩 이관** — SinUtils.SIN_NAMES_KO Proxy 전환 (20+ 소비자 자동 i18n), LocaleManager 헬퍼 (sinName/statName/traitName/edictName/phaseName), IntroScene 프롤로그 한/영 분기, HeroSelectScene 완전 이관, MapHUD 완전 이관, MapConstants TABS/OUTSIDE_SLOTS/ACTION_STATS에 labelKey 추가, MapWorld/MapBottomPanel 라벨 locale 연동 (2026-04-24) | [x] |

---

## 다음 작업 (미완료)

| # | 항목 | 상태 | 상세 |
|---|------|------|------|
| 1 | **죄종 수치 동적화 완료** | ✅ 2026-04-17 | 죄종 7수치가 유일한 관리 레버. sin_rampage 폭주 지속 상태 + processRampageTick. UI 전면 교체 완료. |
| 2 | **장비 시스템** | Phase 2 | equipment_design.md "재설계 예정" |
| 3 | **챕터 2~7 콘텐츠** | Phase 2 | chapters.csv에 7챕터 정의 완료, stages.csv는 챕터1만 |
| 4 | **원정 실시간 전투** | 미구현 | 결과형→실시간 오토배틀+죄종 반응으로 전환 예정 (카드 제거 완료 2026-04-13) |
| 5 | **챕터별 환경 변조 적용** | 미구현 | CSV 로드+registry 등록까지 완료, 게임플레이 적용 코드 없음 |
| 6 | **밸런싱 수치 적용** | 초안 완료 | balance_design.md 작성 완료. 수치 적용 미착수 |
| 7 | **MapScene 분리** | ✅ 완료 | 2979줄 → 278줄 코디네이터 + 11개 모듈(map/) + game_logic 2개(DayActions/TurnProcessor). 백테스팅 가능 구조 |
| 8 | **죄종 수치화 + 특성 시스템** | 기획 확정, 구현 일부 잔여 | 죄종 7수치 + 주 성향 고정. 고유 특성 21종(장점 전용, 영웅별 고정) + 후천 폭주 7종. **미완료: hero_names.csv 21명 축소 + 매핑, traits.csv 정리, 배정 코드 변경** |
| 9 | **i18n Phase B 1차 — 15개 CSV `_key` 컬럼 추가** | ✅ 2026-04-24 | sin_types/stat_names/facilities/research/chapters/edicts/phases/hunt_enemies/stages/stage_enemies/desertion_effects/sin_relations/sin_rampage_chain/items/traits. 기존 한글 컬럼 유지 (비파괴), `_key` 추가 + CsvLoader 전달 |
| 10 | **i18n Phase B 2차 — 일부 완료** | ✅ 2026-04-24 | events/hero_names 완료. hero_epithets/sin_satisfaction/traits의 pro_effect/con_effect/event_choices 영문은 Phase D로 |
| 11 | **i18n Phase C 1차 — 주요 씬 하드코딩 이관** | ✅ 2026-04-24 | SinUtils Proxy, IntroScene, HeroSelectScene, MapHUD, MapConstants 완료. MapBottomPanel 탭만 (본문 미이관), PopupsBuild/Hero/Action, 배틀 씬들, MapDefenseMode/HuntPopup/ActionPopup, MorningReport, ResultScene, SettlementScene, GameOverScene, CriticalEventPopup, ExpeditionScene은 미이관 |
| 12 | **i18n Phase C 2차 — 나머지 UI 이관** | 미구현 | MapBottomPanel 탭 본문 (SIN_THOUGHTS 63 phrases/sin), PopupsBuild/Hero/Action, 전투씬, 원정 씬, 팝업들, MorningReport 영문. 각 파일 순차 이관 |
| 13 | **i18n Phase D — 잔여 번역 채우기 + 완결성 검증** | 미구현 | event_choices 228건, traits pro/con, hero_epithets, SIN_THOUGHTS 번역. `[locale] missing` 경고 zero 달성 |

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
| **하드코딩 이관** | 일기토 확률, 스탯 범위 등 수치를 balance.csv로 이관 (총 108개) |

---

*마지막 업데이트: 2026-04-17 (사기 시스템 완전 제거, 죄종 수치 동적화 완료)*
