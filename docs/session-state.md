# 세션 상태

> 이 파일은 세션 간 컨텍스트 연속성을 위해 유지됩니다.
> 각 작업 완료 후 업데이트하세요. 새 세션 시작 시 이 파일을 먼저 읽으세요.

---

## 현재 진행 중인 작업 — i18n 시스템 도입 Phase A (2026-04-24)

### 🟢 확정된 내용 (2026-04-24)

#### i18n 아키텍처 확정 — Godot 스타일 Wide CSV
- **목적**: Reddit 출시 대응 — 한국어/영어 2개 언어 지원
- **구조**: Wide CSV (key, ko, en, ...) — Godot TranslationServer와 동일 포맷 → Phase 2 이식 시 drop-in
- **파일 분리**:
  - `locale_ui.csv` — UI 고정 문구 + 동적 템플릿 (버튼/라벨/로그)
  - `locale_data.csv` — 게임 데이터 텍스트 (죄종명/시설명/아이템명 등)
- **언어 추가 시**: 두 CSV에 열 1개 추가 + `constants.SUPPORTED_LANGS`에 추가 → 끝

#### LocaleManager API (`src/game_logic/LocaleManager.js`)
- `t(key, params)` — UI 문구 조회 + 파라미터 치환
- `dataText(key)` — 데이터 문구 조회
- `field(obj, 'name')` — CSV 객체에서 `obj.name_key` → dataText 조회
- `setLang(lang)` — localStorage 저장 + `store.setState('lang', ...)` 알림
- `toggle()` — KO ↔ EN 순환
- `josa(word, type)` — 한국어 조사 자동 처리 (받침 감지 + ㄹ 예외)
- **템플릿 치환 문법**: `{name}` 단순 치환, `{name|을}` 조사 자동 (ko만)

#### 자동 언어 감지
- localStorage `theseven_lang` 우선 → `navigator.language.startsWith('ko')` → default `ko`

#### Phase A 완료 (2026-04-24) — 기반 구축 + TitleScene 데모
- ✅ `src/constants.js` — LANG_KO/LANG_EN/SUPPORTED_LANGS
- ✅ `src/data/locale_ui.csv` — 12개 키 (UI + 로그 템플릿)
- ✅ `src/data/locale_data.csv` — 7죄종명
- ✅ `src/game_logic/LocaleManager.js` — 신규 (195줄)
- ✅ `src/data/CsvLoader.js` — locale_ui/locale_data 로딩 추가
- ✅ `src/app.js` — `locale.init()` 호출, registry에 등록
- ✅ `src/scenes/TitleScene.js` — 우측 상단 KO | EN 토글, 모든 텍스트 `locale.t()` 전환, 언어 변경 시 `scene.restart()` 재렌더

### 🟢 Phase B 1차 완료 (2026-04-24) — 15개 CSV `_key` 컬럼 추가

**처리된 CSV (비파괴 — 기존 한글 컬럼 유지)**:
- sin_types → name_key, flaw_key, rampage_key, desertion_key
- stat_names → name_key
- facilities → name_key, description_key
- research → name_key, description_key
- chapters → name_key, region_key, boss_key, env_description_key, boss_briefing_key, boss_dying_words_key
- edicts → name_key, description_key
- phases → name_key, description_key
- hunt_enemies → name_key
- stages → name_key
- stage_enemies → name_key
- desertion_effects → description_key
- sin_relations → description_key (relation 타입별 5종)
- sin_rampage_chain → description_key
- items → name_key, description_key, special_key (44개)
- traits → name_key (45개)

**locale_data.csv**: 226개 키 + 영문 번역 완료

**CsvLoader.js**: 각 CSV에서 `_key` 컬럼을 buildGameData 출력 객체에 전달. 예:
- `data.heroData.sin_types[i].name_key`
- `data.facilitiesData.facilities[i].name_key`, `.description_key`
- `data.chapters[i].name_key`, `.environment.description_key` 등

**비파괴 보장**: 기존 `name_ko`/`description` 필드 그대로 유지 → 기존 소비자 코드는 무영향. Phase C에서 `locale.field(obj, 'name')`로 점진 전환.

### 🟢 Phase B 2차 완료 (2026-04-24)
- **events.csv**: title_key/scene_key 컬럼 추가 (33 이벤트)
- **hero_names.csv**: name_en 컬럼 추가 (영문 이름 풀 54개 — Kael/Dran/Flamehand 등 로마자 transliteration)
- **event_choices**: CSV 수정 없음 — CsvLoader에서 `event.{id}.{idx}.text/log` 자동 합성
- **locale_data.csv**: 33개 이벤트 타이틀 영문 번역 추가 (예: "주먹다짐" → "Brawl")
- **미처리**: event_choices 228건 실제 영문 번역 (키만 있고 번역 비어있어 ko fallback), traits pro_effect/con_effect, hero_epithets, sin_satisfaction — Phase D로

### 🟢 Phase C 1차 완료 (2026-04-24) — 주요 씬 i18n
**구조 개선**:
- `SinUtils.SIN_NAMES_KO` → Proxy로 변환 (20+ 소비자 코드 변경 없이 자동 i18n)
- `LocaleManager`에 헬퍼 추가: `sinName/sinFlaw/sinRampage/sinDesertion/statName/traitName/edictName/edictDesc/phaseName`
- `MapConstants` TABS/OUTSIDE_SLOTS/ACTION_STATS에 `labelKey` 속성 추가

**씬 이관 완료**:
- `IntroScene.js` — 2개 프롤로그 씬 × 각 10라인 한/영 분기 (`PROLOGUE_SCENES_BY_LANG`)
- `HeroSelectScene.js` — 영웅 선택 UI 완전 이관 (제목/부제/스토리 7개×2언어/스탯명/버튼)
- `MapHUD.js` — HUD 전체 이관 (턴 종료/저장/전투 토글/원정 모드/국시 배지/Day 표시)
- `MapBottomPanel.js` — 탭 라벨만 이관 (SIN_THOUGHTS/STATUS_ACTIVITY 본문은 Phase D)
- `MapWorld.js` — 영외 슬롯 라벨 locale 연동

**locale_ui.csv 확장**: 12 → 44 키 (UI 버튼/탭/HUD/행동)

**언어 전환 UX**: TitleScene 우측 상단 `KO | EN` 토글 (게임 시작 전 선택). 이후 세션 내 변경은 restart 필요.

### 🟡 남은 작업 (Phase C 2차 + Phase D)
- **Phase C 2차**: MapBottomPanel SIN_THOUGHTS (63 phrases/sin 영문), STATUS_ACTIVITY (9), PopupsBuild/Hero/Action, BattleSceneA/B, DuelBattleScene, MapDefenseMode, MapHuntPopup, MapActionPopup, MorningReportPopup+MorningReport.js, ResultScene, SettlementScene, GameOverScene, CriticalEventPopup+CriticalEventSystem, ExpeditionScene, EventScene
- **Phase D**: 잔여 번역 (event_choices 228건, traits pro/con, hero_epithets 63조합), `[locale] missing` 경고 zero 달성

### 테스트 방법
1. `src/` 폴더에서 로컬 서버 실행 (`python -m http.server` 등)
2. 브라우저에서 타이틀 화면 진입
3. 우측 상단 `KO | EN` 토글 클릭 → 씬 재시작하며 전체 텍스트 영/한 전환 확인
4. 새로고침 후에도 선택 언어 유지되는지 확인 (localStorage)

---

## 이전 작업 — bonds 판정 + 관계 매트릭스 재설계 (2026-04-24)

### 🟢 확정된 내용 (2026-04-24)

#### 관계 매트릭스 전면 재설계
- 기존 "생성" 관계 **완전 삭제**
- **교만 완전 고립** — 타 6개 죄종 모두 대립 ("모든 죄의 근원", 루시퍼 추락 모티프)
- **동류 (같은 topSin)** 추가 — 같은 감정 공유자끼리 가장 강한 결속
- **4가지 관계 유형**: 동류 ×2 / 강화 ×1.5 / 중립 ×1 / 대립 ×-2
- **강화 3쌍**: 분노↔시기, 탐욕↔색욕, 폭식↔나태
- **대립 9쌍**: 교만↔타6(6쌍) + 분노↔나태, 탐욕↔폭식, 시기↔색욕(3쌍)

#### bonds 성향 판정 규칙
- **판정 본체 = 현재 `topSin()`** — sinStats 최고값 죄종
- **동률 해체 = `hero.sinPriority`** — 영웅 생성 시 7죄종 랜덤 셔플 영구 저장된 숨은 우선순위
- **시작특성(trait)은 bonds 판정에 개입하지 않음** — 시작특성은 sinStats 쌓임 속도 편향 역할만
- **판정 시점**: 사건 발생 순간 스냅샷 (매 턴 자동 변동 없음 → 순환 피드백 방지)

#### 매트릭스 적용 범위
- **긍정 사건 ✅ 적용** — 같은 경험도 성향에 따라 반응이 다름
- **부정 사건 ❌ 미적용** — 배신/폭주 피해는 누구에게나 배신, 원본 Δ 그대로
- **상시 특성 배경 ❌ 미적용** — 특성 자체가 성격 표현, 이중 적용 방지

#### 계산 순서
```
기본Δ × 관계배율(긍정 사건만) × 색욕고양(×2) × 열정령국시(×1.5)
→ Math.round → 분노고양 가드(Δ>0 차단) → clamp[0, 100]
```

#### 문서 반영 완료
- `sin_system.md` §3 매트릭스 전면 교체 (4관계 유형 + 교만 고립 + 대칭 3+3 페어)
- `sin_system.md` §2-A 판정 규칙 + 배율 규칙 추가
- `hero_design.md` §6 관계 시스템 섹션 재작성 (sinPriority 데이터 구조 추가)
- `GAME_DESIGN.md` 죄종 간 관계 매트릭스 섹션 전면 교체

### 🟡 다음 세션 우선
- **bonds 사건별 Δ 수치표** — 원정 귀환/사냥/연회/방어전/이벤트/폭주 등 실제 메커닉별 기본 Δ 확정
  - 기획 방향: 실제 게임 메커닉과 1:1 매핑 (추상적 "위기 구조·복수·두둔" 같은 거 배제)
  - 현재 구현된 원정 귀환 ±3만 유지, 나머지는 플레이테스트 후 결정 추천

### 🔴 코드 반영 대기
- [ ] `hero.sinPriority` 필드 추가 (영웅 생성 시 랜덤 셔플 영구 저장)
- [ ] bonds 성향 판정 함수 (topSin + sinPriority 동률 해체)
- [ ] bonds 관계 매트릭스 상수 (SIN_RELATION_MATRIX)
- [ ] bonds 변동 시 매트릭스·글로벌 배율 스택 적용 (HeroManager.adjustBonds 확장)
- [ ] bonds 사건별 훅 연결 (사건 수치 확정 후)

---

## 이전 진행 — 죄종 시스템 세부 확정 (2026-04-21)

### 🟢 확정된 내용

#### 게임 정체성
- **7감정 모델** 확정 — 죄종 7수치가 영웅 감정 담당. 사기(morale) 부활 없음
- **RimWorld/DD 계보** — "감정 포화 서사". CK3식 충성도 게임 아님
- **영웅 = 결함 있는 인간(용병)** — 봉신 아님, 충성심은 축이 아님

#### 수치 구조 (4+2 구간)
| 구간 | 수치 | 스탯 보너스 |
|---|---|---|
| 깨끗 | 0~4 | 없음 |
| 발현 | 5~11 | 관련 스탯 +1 |
| 고양 | 12~17 | 관련 스탯 +2 + 상시 장점 + 상시 단점 |
| 폭주 | 18~19 | 관련 스탯 +3 + 매 턴 강제 행동 |
| 임계 | 20 도달 | 죄종별 결정적 순간 이벤트 즉시 발동 |
- 스탯 보너스는 **치환형** (발현 +1 → 고양 +2로 교체, 누적 X)
- **엄격 구간 경계** (부드러운 전이 없음)

#### 7죄종 × 7영역 × 7스탯 삼각 매핑
| 죄종 | 영역 | 스탯 |
|---|---|---|
| 분노 | 전투 | 힘 |
| 교만 | 명성·지휘 | 통솔 |
| 탐욕 | 자원·경제 | 지능 |
| 시기 | 정찰·정보 | 민첩 |
| 색욕 | 사회·관계 | 매력 |
| 폭식 | 식량·체력 | 건강 |
| 나태 | 회복·관조 | 감각 |

#### 고양 상시 장점 (7죄종) — 확정 (2026-04-21)
- **분노** (힘 / 전투): 전투 공격력 +15%
- **교만** (통솔 / 명성·지휘): 리더일 때 파티 전투력 +10%
- **탐욕** (지능 / 자원·경제): 채집·거래·전리품 +20%
- **시기** (민첩 / 정찰·정보): 원정 시 다음 노드 1개 추가 공개
- **색욕** (매력 / 사회·관계): bonds 변동량 2배
- **폭식** (건강 / 식량·체력): HP 회복 2배
- **나태** (감각 / 회복·관조): Stamina 회복 2배
- **설계 원칙**: 장점/단점은 서로 다른 영역에 위치 (같은 차원 상쇄 X)

#### 고양 상시 단점 (7죄종) — 확정 (2026-04-21)
- **분노** (힘 / 전투): bonds 증가 불가 (기존 bonds만 악화 가능)
- **교만** (통솔 / 명성·지휘): 같은 파티 영웅 분노·시기 +1/턴 유발
- **탐욕** (지능 / 자원·경제): 원정 복귀 시 전리품 10% 확률 횡령
- **시기** (민첩 / 정찰·정보): 자신보다 스탯 높은 영웅과 파티 시 분노 +1/턴
- **색욕** (매력 / 사회·관계): bonds ≥ 70 영웅 없으면 나태 +1/턴
- **폭식** (건강 / 식량·체력): 채집·벌목 효율 -20%
- **나태** (감각 / 회복·관조): 원정 참여 시 파티 이동 노드 -1

#### 폭주 매 턴 강제 행동 (7죄종)
- 분노: 도발 / 교만: 명령 거부 / 탐욕: 횡령 / 시기: 독살 시도 / 색욕: 집착 / 폭식: 과식 / 나태: 태업

#### 임계(20) 결정적 순간 이벤트 구조
- 선택지 3개: **이탈 / 구원 / 극단**
- 확률 보정: bonds 평균, 시작특성 편향/저항
- 구원 특성 7종: 평정/현자/청빈/대범/순결/단식자/명상가
- 7죄종 이벤트명 및 분기 초안 확정

#### 관계 시스템 (bonds)
- `hero.bonds = {[otherHeroId]: 0..100}` asymmetric, 초기값 50
- **바알↔영웅 친밀도 별도 축 없음** — 후천 특성(acquiredTraits)으로 이산 기록
- 관계 변화는 **죄종 수치 쌓임에 증폭/억제**로 자동 반영 (새 감정 축 추가 X)

#### 낮 상태 3분류
- 작업 중 (Stamina 소모) / idle (Stamina 회복, 휴식과 병합) / 특수 행동 (병원 등)
- **밤 방어 자동 판정**: Stamina ≥ 임계(40) + 거점 내 + 비부상
- **"방어 배치" slot 제거** — Stamina가 게이트
- 부상 영웅: 뭘 하든 방어 불가, 병원 치유 가속

#### 숙소 시스템 (Phase 1 축소판)
- 단일 시설, 3티어 업그레이드 (임시막사→병영→고급 숙소)
- 1인실/공동실 2분류 — 영웅 선호별 쌓임 회피/유발
- 페어 배정 UI 없음 (자동 배정 + 수동 오버라이드)
- 깊은 룸메 관리 / 밤 동실 이벤트 생성기는 Phase 2

### 🟡 논의 중 (다음 세션 우선)

- [x] **고양 상시 단점 7개** — 확정 (2026-04-21)
- [x] **시기/색욕 장점 단순화** — 단일화 완료 (2026-04-21)
- [x] **정화 수단 카탈로그** — 반대 행동 원칙 확정, 문서·balance.csv 반영 완료 (2026-04-21)
- [x] **20 도달 이벤트 7개 세부** — 선택지 텍스트 + 확률 수치 확정 (2026-04-21)
- [x] **bonds 판정 규칙** — topSin + sinPriority 숨은 우선순위 확정 (2026-04-24)
- [x] **관계 매트릭스 재설계** — 생성 삭제, 교만 고립, 4유형 배율 확정 (2026-04-24)
- [ ] **bonds 사건별 Δ 수치표** — 실제 메커닉별 기본 Δ 추후 확정
- [x] **시작특성 21종 편향/저항/중립 재분류** — 편향8/저항5/중립8 확정 (2026-04-21)
- [x] **traits.csv 메타데이터 + 구원특성 7종 등록** — sin_category/target_sin/sin_mult 컬럼 (2026-04-23)
- [x] **편향/저항/구원 쌓임 배수 로직** — HeroManager.updateSinStat 적용 (배수 ×1.3/×0.7/×0.5) (2026-04-23)
- [ ] **시작특성 편향 8종 → 구체 죄종 매핑** — 8종이 어느 죄종에 편향인지 (8:7 비대칭 해소)
- [ ] 숙소 티어 수치 (수용/배율/1인실 개수) 플레이테스트 후 조정

### 🔴 코드 반영 대기

- [x] 4구간 경계값 balance.csv (sin_manifest=5, sin_elevated=12, sin_rampage=18, sin_critical=20) — 2026-04-23
- [x] 7영역×7스탯 매핑 코드 상수화 (SinUtils.SIN_DOMAIN / SIN_STAT) — 2026-04-23
- [x] 발현/고양/폭주 스탯 치환 로직 (SinUtils.getSinStatBonuses, HeroManager.getEffectiveStats) — 2026-04-23
- [x] 20 도달 결정적 순간 이벤트 시스템 (CriticalEventSystem + CriticalEventPopup) — 2026-04-23
- [x] hero.bonds 필드 + 변동 훅 (HeroManager.adjustBonds, 원정 귀환 시 bonds+3) — 2026-04-23
- [ ] 숙소 1인실/공동실 자동 배정 알고리즘 (숙소 시스템 자체 미구축 — Phase 2)
- [x] 밤 방어 Stamina 게이트 전환 (TurnProcessor.getDefenseParty 자동 판정) — 2026-04-23
- [x] 이벤트 30개 7감정 프레임 재태깅 (event_effects.csv morale→sin_delta, SIN_KEYS 타겟 직접 처리) — 2026-04-23
- [x] 정화 수단 로직 (DayActions 채집/벌목/연회 + TurnProcessor idle/solo) — 2026-04-23

---

## 이전 진행 중인 작업 (아카이브 — 이번 세션에 흡수)

- **쌓임(누적) 프레임 재정립 — 기획서 뼈대 반영 완료, 세부 수치 TBD** (2026-04-17)
  - **(2026-04-20 추가 완료)** 사기 표현 전면 제거 — 기획 문서 8개에서 사기(morale) 참조 → 죄종 수치(sin_delta) 전환:
    - `event_design.md`: 이벤트 30개 트리거 + 결과 전부 재태깅 (사기 71+ → 수치 15+, 사기 100 → 수치 18+)
    - `chapter_scenario.md`: 챕터 환경 변조 + 이벤트 결과 전환. Ch4 "죄종 만족" 개념 삭제
    - `faction_design.md`: F-1~F-8 세력 이벤트 + 포고령 항목 삭제 + F-7 속죄의 밤 → 죄종 정화 이벤트로 재정의
    - `ui_design.md`: 사기 바 → 죄종 수치 바, 색상 팔레트 재정의, 영웅 카드 정보 계층 갱신
    - `base_design.md`: 국시 표 사기 효과 → 죄종 누적 가속/정화로 전환, 결속 의식 연구 효과 수정
    - `equipment_design.md`: "사기 물약" → "정화의 약초", 장신구 사기 효과 → 정화 효과
    - `balance_design.md`: exp_node_morale 키 → sin_restore/sin_gain 키로 명시
    - `expedition_design.md`: 원정 결과 Store 반영 표 죄종 수치 기반 갱신
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
  - **(2026-04-20 구현 완료)** 쌓임 프레임 코드 반영 — 5개 파일:
    - `HeroManager.js`: `_rollSinStats()` → 전부 0. `updateSinStat()` 클램프 0~20. `_pickEpithet()` maxVal=0 가드 추가.
    - `TurnProcessor.js`: `checkSinConditions()` 자동 감소 6개 제거 (wrath_idle_fall, sloth_defense_fall, sloth_action_fall, gluttony_food_shortage_fall, lust_solo_fall, pride_defense_lose_fall). morale TODO 주석 삭제.
    - `DayActions.js`: 낮 행동 sin 감소 4개 제거 (채집/벌목 sloth_action_fall, 연회 greed_feast_fall, 사냥패배 pride_combat_lose_fall).
    - `MorningReport.js`: `dangerLowSin` 제거. "의욕 상실" 알림 분기 삭제 (낮은 수치 = 안정 처리).
    - `balance.csv`: `sin_min`=0, 감소 상수 9개 제거, 정화 플레이스홀더 3개 추가 (purify_feast_greed / purify_rest_sloth / purify_rest_lust).
  - **이후 작업**: 수치 구간 확정 → 정화 카탈로그 설계 → 이벤트 30개 CSV 재태깅

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

### 우선 — bonds 시스템 코드 반영 + 구체 수치
- [ ] `hero.sinPriority` 필드 추가 (HeroManager._generateHero, 7죄종 랜덤 셔플)
- [ ] 성향 판정 함수 `getSinDisposition(hero)` — topSin + sinPriority 동률 해체
- [ ] `SIN_RELATION_MATRIX` 상수 (동류/강화/중립/대립 × 배율)
- [ ] `HeroManager.adjustBonds` 확장 — 매트릭스·글로벌 배율 스택 적용
- [ ] balance.csv에 배율 키 추가 (bonds_mult_kin / bonds_mult_enhance / bonds_mult_neutral / bonds_mult_conflict)
- [ ] sinPriority 세이브/로드 (SaveManager)
- [ ] **bonds 사건별 Δ 수치표 기획 확정 (플레이테스트 후 구체 사건 맵핑)**

### 시작특성 편향 8종 죄종 매핑 (아직 미확정)
- [ ] 8종이 어느 죄종에 편향인지 (8:7 비대칭이므로 어느 한 죄종 2개 편향 or 재배치)
- [ ] 저항 5종이 어느 죄종에 저항인지

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
| 2026-04-24 | bonds 성향 판정은 현재 topSin만 사용 (시작특성 무관) | 시작특성 21종 재분류(편향8/저항5/중립8) 상태에서 매트릭스를 시작특성 기반으로 돌리면 86% 페어가 중립 판정 → 기능 작동 불가. topSin 기반이면 쌓임 프레임과 정합, 시간에 따라 관계가 극적으로 변함. |
| 2026-04-24 | 동률 해체 = `hero.sinPriority` 숨은 우선순위 순열 | sinStats 모두 0인 초반에도 영웅마다 다른 성향 판정 가능 → 초반 무력화 문제 자연 해결. 플레이어 비공개 "숨은 기질" = 결함 있는 인간 테마와 일치. |
| 2026-04-24 | 관계 매트릭스 재설계 — 생성 삭제, 교만 완전 고립 | 기존 TheSevenTactics 매트릭스는 복잡하고 교만이 여러 강화/대립 혼재. "교만 = 모든 죄의 근원(루시퍼)"이라는 성경 모티프를 메커니즘으로 표현 → 교만 영웅 = 로스터 붕괴 가속기. 각 비교만 죄종은 1강화/2대립/3중립으로 단순. |
| 2026-04-24 | 배율 ×2/×1.5/×1/×-2 (동류/강화/중립/대립) | 이전 ×1.5/×1.3/×1/×-0.5 대비 2배 증폭. 관계 표현을 더 강렬하게 — "같은 사건도 극단적으로 다른 결과" 재미 극대화. |
| 2026-04-24 | 매트릭스 배율은 긍정 사건에만 적용, 부정 사건은 원본 Δ 유지 | 배신·폭주 피해는 누구에게나 배신. 성향 배율로 완화/증폭하면 서사 희석. 책임 분리: 매트릭스 = 공유 경험 해석, 부정 사건 = 무조건 악화. |
