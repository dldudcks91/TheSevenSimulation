# 밸런스 설계서

> 상태: 초안 — 3개 영역 예시 + 방향성
> 작성일: 2026-03-29
> 최종 수정: 2026-04-27 (Phase B — CSV SSOT 분리: 시뮬 표를 "근거 스냅샷" 으로 명시, 절대 수치는 `[balance.csv:키]` 참조)
> 대상: Phase 1 프로토타입 (챕터 1, 영웅 7명, ~30턴 기준)
>
> **본 문서의 역할**: "왜 이 곡선·이 비용·이 임계값인가"의 **설계 근거**.
> 실제 적용 수치의 SSOT는 `src/data/balance.csv` / `facilities.csv` / `defense_scaling.csv` / `desertion_effects.csv`. 본문 표 안 절대값은 **설계 당시 스냅샷**이며, 코드는 CSV를 따름. 두 곳이 어긋나면 CSV가 진실.

---

## 0. 밸런스 철학

### 핵심 원칙

**"플레이어는 항상 부족하지만, 항상 선택지가 있다"**

- **자원은 항상 부족** — 7명 영웅, 10가지 행동, 3종 자원 → 모든 걸 할 수 없음
- **완벽한 선택은 없음** — 어떤 배분이든 트레이드오프 (누군가를 만족시키면 다른 누군가가 불만)
- **실패해도 복구 가능** — 영웅 1명 이탈/사망이 즉시 게임오버가 아님
- **점진적 긴장** — 초반은 여유, 중반부터 압박, 보스전 전 최대 긴장

### 밸런스 목표 (체감 지표)

> 아래는 **체감 목표** — 정확한 수치가 아닌 "이 정도 느낌이면 성공"의 범위. CSV 키로 표현되지 않으며, 플레이테스트 검증 항목.

| 지표 | 목표 | 이유 |
|------|------|------|
| 1회차 플레이 | ~25~35턴 (챕터 1 클리어) | ~60~90분 세션 |
| 첫 폭주 발생 | ~5~8턴 | 시스템 체감 타이밍 |
| 첫 이탈 위험 | ~10~15턴 | 경영 압박 체감 |
| 영웅 사망 경험 | ~15~25턴 (보스전 근처) | 상실감 → 재도전 동기 |
| 방어전 패배율 (준비한 경우) | 낮음 (소수) | 너무 쉬워도, 너무 어려워도 안 됨 |
| 게임오버 빈도 (첫 플레이) | 중간대 (1/3 안팎) | 적절한 도전감 |

### 밸런싱 방법론

```
1. 스프레드시트 시뮬레이션
   → "아무것도 안 하는 플레이어"의 자원 흐름 시뮬
   → 죄종 수치 변동 누적 그래프
   → 난이도 곡선 (영웅 전투력 vs 적 전투력)

2. 극단 케이스 검증
   → 최선의 플레이: 모든 배분을 최적화하면?
   → 최악의 플레이: 랜덤 배분하면?
   → 특정 죄종 편중: 분노 3명이면?

3. 체감 테스트
   → 숫자가 아니라 "느낌"으로 검증
   → "이 선택지가 고민되는가?"
   → "이 영웅을 어디에 배치할지 매 턴 다른가?"
```

---

## 1. 전투 밸런스 — 난이도 곡선 설계

### 1-1. 문제 정의

현재 전투 관련 수치 출처:
- 영웅 HP 공식: `[balance.csv:hero_hp_base] + vitality × [balance.csv:hero_hp_per_vitality]`. 영웅이 직접 피격 → HP 0 시 knocked_out → 귀환 후 injured
- 매 턴 HP 자연 회복: `[balance.csv:hero_hp_regen_per_turn]` (병원 시설 배율 가중)
- 적 수치: 챕터1 스테이지·방어전·사냥 — 각각 `stage_enemies.csv`, `defense_scaling.csv`(`defense_enemy_*` 키), `hunt_enemies.csv` 참조
- 방어전 스케일링 공식: HP/ATK = base + day × per_day (정확한 키는 `defense_enemy_hp_base / hp_per_day / atk_base / atk_per_day`)

**문제**: 영웅 성장(레벨업)이 완만한 반면 적은 일수 비례로 강해짐. 역전·교차 시점이 재미의 핵심.

### 1-2. 설계 방향

**"영웅은 숫자가 아니라 구성으로 강해진다 + 점진적 성장"**

- 영웅은 **레벨 1~10** 성장 가능 (행동 XP 누적 → 레벨업 시 스탯 +1)
- 성장은 완만: 레벨업당 관련 스탯 +1~2, 극적 전투력 변화보다는 역할 특화 방향
- 강해지는 주요 방법: 카드 확보, 편성 최적화, 레벨업(스탯 +1), 장비(Phase 2)
- 적은 일수에 비례해 강해지지만, **증가율이 체감** (로그 곡선)

> **밸런스 참고**: 레벨업이 존재하므로 Day 20+ 전투력 계산에 영웅 성장분을 반영해야 함. 평균적으로 Day 20 시점 영웅 2~3명이 Lv3~4 도달 → 관련 스탯 +2~3 예상.

### 1-3. 영웅 전투력 기준값

- 스탯 총합 범위: `[balance.csv:stat_total_min]` ~ `[balance.csv:stat_total_max]`
- 메인 스탯 범위: `[balance.csv:stat_main_min]` ~ `[balance.csv:stat_main_max]`
- 공식:
  - `ATK(원정) = 힘 × [balance.csv:atk_expedition_str_mult] + 민첩 × [balance.csv:atk_expedition_agi_mult]`
  - `ATK(방어) = 힘 × [balance.csv:atk_defense_str_mult] + 통솔 × [balance.csv:atk_defense_lead_mult]`
  - `HP = [balance.csv:hero_hp_base] + 건강 × [balance.csv:hero_hp_per_vitality]`
- 건강은 전투 미반영 — 스태미나 풀 + 발병 저항 전용

#### 근거 시뮬 스냅샷 (설계 당시)

> 이 표는 공식 검증용 스냅샷 — 실제 적용 수치는 위 공식 + balance.csv가 SSOT.

| 영웅 유형 | 힘 | 민첩 | 건강 | ATK(원정) | ATK(방어) |
|---|---|---|---|---|---|
| 근접형 (힘 특화) | 16 | 10 | 12 | 15.2 | 12.8+통솔 |
| 균형형 | 10 | 10 | 10 | 11.0 | 8.0+통솔 |
| 허약형 (지능 특화) | 4 | 6 | 6 | 5.2 | 3.2+통솔 |

- 성장 반영: 레벨업 시 관련 스탯 증가 → 후반엔 근접형 ATK가 더 높아짐

### 1-4. 적 난이도 곡선 (챕터 1)

#### 원정 (스테이지 1~3 + 보스)

- 적 정의 SSOT: `stage_enemies.csv` (stage_id별 HP/ATK/SPD)
- 챕터/스테이지 메타: `stages.csv`, `chapters.csv`
- **의도**: s1 튜토리얼 → s2 카드 1장 클리어 → s3 카드 2장 + 좋은 편성 → 보스 풀 카드 + 최적 편성

> **근거 시뮬 스냅샷** — 실 수치는 stage_enemies.csv가 SSOT.
>
> 합산 전투력 = Σ(HP × ATK) / 100 (대략적 지표). 난이도 비율 < 0.7 쉬움 / 0.7~1.0 적절 / 1.0+ 어려움.
>
> | 스테이지 | 적 수 | 적 HP | 적 ATK | 난이도 비율 |
> |---|---|---|---|---|
> | ch1_s1 | 3 | 40~60 | 12~15 | ~0.46 (여유) |
> | ch1_s2 | 3 | 50~80 | 16~20 | ~0.63 (적절) |
> | ch1_s3 | 4 | 50~100 | 18~22 | ~1.03 (긴장) |
> | ch1_boss | 1 | 300 | 30 | ~0.86 (보스전) |

#### 방어전 (간격 = `[balance.csv:raid_interval_min]` ~ `raid_interval_max`)

**현재 적용 공식** (defense_scaling.csv + balance.csv):
- `적 HP = [balance.csv:defense_enemy_hp_base] + day × [balance.csv:defense_enemy_hp_per_day]`
- `적 ATK = [balance.csv:defense_enemy_atk_base] + day × [balance.csv:defense_enemy_atk_per_day]`
- `적 수 = floor(day / [balance.csv:raid_scale_divisor]) + 보정` (raid_scale_small / raid_scale_medium)
- `적 SPD = [balance.csv:defense_enemy_spd]`

**설계 이슈** (옛 가파른 곡선): 단순 선형은 후반 너무 가파름 — 영웅 HP를 2타에 소멸시키는 구간 발생.

**해결 방향 — 로그 곡선 + 단계 점프**:
```
적 HP  = base + day × per_day + floor(day / step_days) × step_bonus
적 ATK = base + day × per_day  (선형이지만 완만)
적 수  = floor(day / divisor) + count_base
```
> step_days / step_bonus 키는 아직 balance.csv에 미반영 — `_migration_findings.md` F-B1 참조.

> **근거 시뮬 스냅샷** — 로그 곡선 제안 적용 시 예상 곡선 (실 수치는 적용 후 CSV 따름).
>
> | Day | 적 수 | 적 HP | 적 ATK | 체감 |
> |---|---|---|---|---|
> | 3 | 2 | 110 | 14 | 여유 |
> | 6 | 3 | 120 | 17 | 카드 1장이면 OK |
> | 10 | 4 | 150 | 22 | 카드 + 풀 편성 |
> | 15 | 5 | 185 | 28 | 풀 방어 필수 |
> | 20 | 7 | 210 | 34 | 영웅 다수 + 카드 필수 |
> | 25 | 8 | 245 | 40 | 풀 편성 + 카드 풀 |
> | 30 | 9 | 280 | 46 | 보스전급 |

**핵심**: Day 10 이전은 원정 집중 가능 → Day 15부터 방어 신경 → Day 25+ 원정 vs 방어 딜레마 최대화.

#### 사냥 (1:1)

- 적 정의 SSOT: `hunt_enemies.csv` (name, base_hp, base_atk, spd)
- 사냥 보상: `[balance.csv:hunt_gold_base] + day × [balance.csv:hunt_gold_per_day]` + 죄종별 일기토 확률 키 (`duel_chance_*`)
- **의도**: 평균 영웅(ATK 평균) vs 약한 적 → 압승 / 허약형 vs 강한 적 → 이기지만 부상 위험. 위험·보상 비대칭.

### 1-5. balance.csv 반영 상태

- 등록 완료 (`balance.csv`): `defense_enemy_hp_base`, `defense_enemy_hp_per_day`, `defense_enemy_atk_base`, `defense_enemy_atk_per_day`, `defense_enemy_spd`, `raid_scale_divisor`, `raid_scale_small`, `raid_scale_medium`
- **미반영 (로그 곡선용)**: `defense_enemy_hp_step_days`, `defense_enemy_hp_step_bonus`, `defense_enemy_spd_step_days`, `defense_enemy_count_divisor`, `defense_enemy_count_base` — `_migration_findings.md` F-B1 참조

---

## 2. 경제 밸런스 — 자원 수입/지출 곡선

### 2-1. 문제 정의

3자원 체계: 식량 / 나무 / 골드
- 시작: 식량 100, 나무 50, 골드 500
- 수입: 채집(식량), 벌목(나무), 사냥/원정/방어(골드)
- 지출: 영웅 유지비(식량), 건설(나무), 연구/고용/치료(골드)

**문제**: 수입과 지출이 맞는가? 자원 부족 → 재미인가 좌절인가?

### 2-2. 설계 방향

**"식량은 긴장, 나무는 계획, 골드는 선택"**

| 자원 | 역할 | 체감 |
|---|---|---|
| **식량** | 생존 자원 — 매 턴 소비, 부족하면 폭식 수치↓ | "먹여살려야 한다" |
| **나무** | 투자 자원 — 건설에만 사용, 획득은 안정적 | "뭘 먼저 지을까" |
| **골드** | 만능 자원 — 연구/고용/연회/교역 | "뭐에 쓸까" |

### 2-3. 턴당 수입/지출 — 공식과 핵심 딜레마

#### 전제
- 영웅 수: 시작 `[balance.csv:starting_heroes]` → 후반 최대 `[balance.csv:max_heroes]`
- 영웅 턴당 식량 비용: 동적 식 = `food_cost_base + round((총합-min)/divisor)` (`[balance.csv:food_cost_base]`, `food_cost_divisor`, 총합/min은 stat_total)

#### 공식 출처

| 항목 | 공식 / 키 |
|---|---|
| 채집 (식량) | `[balance.csv:gather_base_food]` + 적합도 보정 (보정 키 미반영 — F-B2) |
| 벌목 (나무) | `[balance.csv:lumber_base_wood]` + 적합도 보정 (보정 키 미반영 — F-B2) |
| 농장 시설 | `[balance.csv:farm_food_per_turn]` /턴 |
| 벌목소 시설 | `[balance.csv:lumber_mill_wood_per_turn]` /턴 |
| 사냥 골드 | `[balance.csv:hunt_gold_base] + day × [balance.csv:hunt_gold_per_day]` |
| 방어전 골드 | `[balance.csv:defense_victory_gold_base] + day × [balance.csv:defense_victory_gold_per_day]` |
| 원정 노드 | combat: `exp_node_combat_gold_base + day × per_day` / boss: `exp_node_boss_gold_base + day × per_day` |
| 식량 부족 임계 | `[balance.csv:food_shortage_threshold]` |
| 시작 자원 | `starting_food`, `starting_wood`, `starting_gold` |
| 연회 비용 | `[balance.csv:feast_cost]` |
| 고용 비용 | `[balance.csv:recruit_cost]` |

#### 핵심 딜레마

- **식량**: 영웅이 늘면 채집 1명으로 부족 → 채집 2명(원정 인력 부족) 또는 긴축(탐욕·폭식 가속) 또는 농장 건설(나무·턴 투자) 중 선택
- **나무**: 시작 자원만으로 Tier 1 전부 못 지음 → 벌목 꾸준히 + Tier 우선순위 결정
- **골드**: 매 시점 "하나만 선택" — 고용 vs 연구 vs 연회 vs 치료/장비

> **근거 시뮬 스냅샷** — 자원 수지 시뮬은 "공식이 의도대로 작동하는가"를 검증할 때 별도 도구로 재실행. 본문에서 결과 수치 표는 제거(과거 시뮬 표는 옛 수치라 신뢰도 낮음).

### 2-4. balance.csv 반영 상태

- 등록 완료: `starting_food`, `starting_wood`, `starting_gold`, `gather_base_food`, `lumber_base_wood`, `farm_food_per_turn`, `lumber_mill_wood_per_turn`, `feast_cost`, `recruit_cost`, `food_shortage_threshold`, `pioneer_cost_wood`, `pioneer_build_cost`
- **미반영**: 채집·벌목 적합도 보정 키 4종 — `_migration_findings.md` F-B2 참조
- **시설 비용 조정**: `facilities.csv` (Phase D에서 처리) — Tier 1 비용 하향 검토는 base_design.md / facilities.csv가 SSOT

### 2-5. 경제 밸런스 체크리스트

| 체크 | 질문 | 목표 |
|---|---|---|
| □ | Day 5에 식량 고갈 위험을 느끼는가? | O (채집 배분 강제) |
| □ | Day 10에 첫 Tier 1 건물 완성 가능한가? | O (주점 or 감시탑) |
| □ | Day 15에 Tier 2 진입 가능한가? | △ (벌목 꾸준히 했다면) |
| □ | 골드로 "뭘 할지" 고민하는 순간이 있는가? | O (고용 vs 연구) |
| □ | 연회를 "쓰고 싶지만 아까운" 가격인가? | O (100골드 = 사냥 7일분) |

---

## 3. 죄종 수치 쌓임 밸런스 (쌓임 프레임 재정립 — 2026-04-17)

> 사기(Morale) 시스템 전면 폐기. 죄종 7수치(0~20 누적)가 유일한 영웅 관리 레버로 대체.
> **이 섹션은 뼈대만 재정리 — 구체 수치(쌓임 속도, 정화량, 폭주 임계)는 다음 세션에서 확정.**

### 3-1. 문제 정의

죄종 쌓임 시스템이 영웅 운영의 기준. 밸런스가 맞지 않으면:
- **너무 느리게 쌓임** → 폭주/드라마가 거의 없음 → 거점 운영이 단조로움
- **너무 빠르게 쌓임** → 매 턴 여러 영웅이 폭주 → 관리 불가 → 좌절
- **정화 수단 부족** → 쌓이기만 하고 낮추지 못함 → 이탈 러시
- **정화 수단 과잉** → 쌓여도 금방 정화 가능 → 긴장감 없음

### 3-2. 설계 방향

**"초반엔 깨끗, 중반부터 누적, 후반엔 선택 딜레마"**

목표:
- 영웅 초기값 = 모든 죄종 0 (깨끗)
- 챕터 1 중반(Day 8~12)부터 주요 죄종이 "고양" 구간(파워 보너스 활성)
- 챕터 1 후반(Day 15~20)에 첫 폭주 위험 체감
- 7명 중 **2~3명은 항상 "쌓여가는 죄종"** 이 있음 (관리 우선순위 형성)
- 폭주/이탈은 희소 이벤트 (30턴에 2~4회)

### 3-3. 쌓임 vs 정화 소스 (상세 수치 TBD)

#### 쌓이는 소스

| 소스 | 대상 죄종 | 예상 변동량 | 비고 |
|---|---|---|---|
| 행동(전투/사냥/채집 등) | 해당 행동 관련 죄종 | +1~2/회 | 상세 수치 TBD |
| 국시(선포 중) | 해당 국시 죄종 | +X/턴 | 누적 가속, 수치 TBD |
| 이벤트 선택지 | 선택지별 태깅 | ±N | 이벤트별 개별 설계 |
| 폭주 연쇄 전파 | 연관 죄종 | +1 | 같은 죄종/연관 패턴 |
| 시작특성 편향 | 해당 죄종 | ×1.5 배수 | 편향 특성 보유 시 |

#### 정화 수단 (카탈로그 TBD — 다음 세션 확정)

| 수단 후보 | 효과 | 비용 |
|---|---|---|
| 연회 | 특정 죄종(예: 폭식/나태) 감소 | 식량 |
| 야영 (원정 rest 노드) | 전투 관련 죄종 감소 | 시간 |
| 이벤트 선택지 | 선택지별 태깅 | 자원/부작용 |
| 시설 (예배당/고해소 등) | 지속 정화 효과 | 건설 비용 |
| 특성 (저항형 시작특성) | 해당 죄종 쌓임 억제 | 랜덤 부여 |
| 후천특성 (극복형) | 해당 죄종 쌓임 크게 억제 | 레벨업 선택 |

> 정화 수단 카탈로그는 **다음 세션의 핵심 설계 작업**. 어느 수단이 어느 죄종을 얼마나 감소시키는지 일괄 결정 필요.

### 3-4. 폭주/이탈 빈도 시뮬레이션 (재설정 필요)

7명 영웅, 30턴 플레이에서 예상 이벤트 수 (쌓임 프레임 기준 — **TBD 재검증**):

| 이벤트 | 예상 빈도 | 30턴 중 예상 횟수 |
|---|---|---|
| 죄종 고양 진입(파워 보너스 ON) | 영웅당 2~4회 | 총 14~28회 |
| 정화 수단 사용 | 영웅당 1~3회 | 총 7~21회 |
| 폭주 (죄종 18+) | 영웅당 0~1회 | 총 2~4회 |
| 이탈 (폭주 + 3턴) | 영웅당 0~1회 | 총 0~2회 |
| 연쇄 반응 | 폭주 시 50% | 총 1~2회 |

### 3-5. 연쇄 반응 설계 (재설계 필요)

현재 연쇄 반응 규칙(sin_system.md)은 "사기 변동" 기준으로 서술되어 있음. 쌓임 프레임 전환 시 **"주변 영웅의 해당 죄종 쌓임"** 으로 재표현 필요.

| 폭주 결과 | 영향 영웅 | 쌓임 효과 (재설계 TBD) |
|---|---|---|
| 분노 폭주 (도발) | 대상 영웅 | wrath +1 |
| 탐욕 폭주 (횡령) | 폭식/시기 영웅 | 해당 죄종 +1 (자원 부족/불평등감) |
| 교만 폭주 (명령 거부) | 분노 높은 영웅 | wrath +1 (화남) |
| 시기 폭주 (깎아내리기) | 강한 영웅 | 해당 topSin -1 (이례적 감소) |
| 폭식 폭주 (식량 소진) | 전체 | 탐욕/폭식 +1 |
| 나태 폭주 (전파) | 주변 영웅 | sloth +1 |
| 색욕 폭주 (분쟁) | 관련 2명 | wrath/envy +1 |

**연쇄 깊이**: 최대 3회 (MAX_CHAINS = 3) — 유지.

### 3-6. 쌓임 속도 조정 장치 (후보 — TBD)

```csv
# balance.csv 후보 (수치 TBD)
sin_accumulation_base_rate,1         # 행동당 기본 쌓임
sin_accumulation_trait_multiplier,1.5 # 편향 특성 배수
sin_accumulation_resist_multiplier,0.7 # 저항 특성 배수
sin_purify_feast_amount,TBD          # 연회 정화량
sin_purify_rest_amount,TBD           # 야영 정화량
```

### 3-7. 쌓임 밸런스 체크리스트

| 체크 | 질문 | 목표 |
|---|---|---|
| □ | Day 1~5에 죄종 수치가 대부분 0~3 구간인가? | 깨끗한 초반 |
| □ | Day 8~12에 파워 보너스 구간 영웅이 나타나는가? | O |
| □ | Day 15~20에 첫 폭주 위험이 체감되는가? | O |
| □ | 정화 수단이 "쓰고 싶지만 아까운" 긴장감을 주는가? | O (자원 소모) |
| □ | 7명 중 2~3명은 항상 관리가 필요한가? | O |
| □ | 연쇄 반응이 "옆 영웅에게 번지는구나"를 느끼게 하는가? | O |
| □ | 폭주가 너무 자주 일어나 짜증나지는 않는가? | 30턴에 2~4회 (희소 이벤트) |
| □ | 이탈이 "예방 가능했는데..."를 느끼게 하는가? | O (18~20 3턴 유예) |
| □ | 낮은 수치(0~4)가 페널티 없이 "좋은 상태"로 느껴지는가? | O |

---

## 4. 종합 — 밸런스 우선순위

### Phase 1에서 밸런싱해야 할 항목 (우선순위 순)

| 순위 | 영역 | 구체 항목 | 현재 상태 |
|---|---|---|---|
| **1** | 죄종 쌓임 | 쌓임 속도, 정화 수단 카탈로그, 구간 경계 | 쌓임 프레임 전환 중 |
| **2** | 전투 | 방어전 스케일링 곡선 | 현재 너무 가파름 |
| **3** | 경제 | 식량 수지, 건설 비용 | 식량 고갈 너무 빠름 |
| **4** | 전투 | 사냥 보상 밸런스 | 현재 적절 |
| **5** | 이벤트 | 선택지 죄종 수치 변동량(sin_delta) | 초안 있음 |
| **6** | 경제 | 연구 비용/효과 | 현재 적절 |

### 이탈 효과 (desertion_effects.csv 참조)

이탈 시 발생하는 부수 효과의 SSOT는 `src/data/desertion_effects.csv` (sin, effect_type, target, value, description).

- **현재 등록**: 분노(전체 사기), 탐욕(골드 -80), 색욕(랜덤 1명 사기) — 사기 폐기로 분노/색욕 행은 재설계 대상
- **none 처리**: 시기/나태/폭식/교만 — 추가 효과 미정. 7죄종 중 4건이 빈 행

> **재설계 후보 (별도 작업)**: 사기→죄종 누적 변환 + none 4건 채우기. 시기→건물 다운, 폭식→식량 차감, 교만→전 영웅 교만 누적, 나태→그대로 무효과(서사상 "조용한 이탈"). 적용은 `desertion_effects.csv` 컬럼 재설계와 함께 — `_migration_findings.md` 신규 finding 등록 검토.

---

## 5. 하드코딩 수치 정리 — 일반 원칙

- **모든 매직 넘버는 `balance.csv` 키로 분리** (또는 도메인 CSV로). 코드 라인에 절대값을 박지 않는다.
- 신규 기능 구현 시 코드와 함께 키를 등록하고, 기획서는 키 참조로만 표기.
- 발견된 미반영 항목은 `docs/_migration_findings.md`에 누적 기록 (코드 라인 번호로 표기하면 변경 시 어긋나므로, 모듈명 + 함수/책임 단위로 기록).

---

*마지막 업데이트: 2026-04-27 (Phase B — CSV SSOT 분리: 시뮬 표를 "근거 스냅샷" 으로 명시, 공식·키 참조 보강, 이탈 효과 desertion_effects.csv 참조, §5 일반 원칙으로 축약, §N 도메인 메모로 압축. 미반영 키는 `_migration_findings.md` F-B1~F-B3에 기록.)*
*2026-04-20 사기 → 죄종 수치 전환 정리 — exp_node_rest/victory/defeat 모랄 키 → 죄종 수치 키로 이름 변경 명시*
*2026-04-17 쌓임 프레임 재정립 — §3 죄종 수치 쌓임 밸런스 뼈대 재작성, 사기 관련 조항 레거시 표시, 세부 수치 TBD*

---

## N. balance.csv 도메인 메모

> 키 자체와 기본값은 `balance.csv`(SSOT)에서 직접 확인. 본 절은 키들이 어떤 도메인에 속하는지 설명만.

### 원정 노드 보상 도메인
- 키 군: `exp_node_combat_gold_base/per_day`, `exp_node_boss_gold_base/per_day`
- **쌓임 프레임 잔재 키** (이름 변경 검토 필요): `exp_node_rest_*`, `exp_node_victory_*`, `exp_node_defeat_*` — 옛 사기 기반에서 죄종 정화/누적량으로 재의미 부여 필요. 코드 사용처 검증 후 재명명 (`*_sin_restore` / `*_sin_gain`).

### 체력(stamina) 시스템 도메인
- 키 군: `stamina_max`, `stamina_recovery_base`, `stamina_recovery_health_bonus`, `stamina_cost_*` (행동별), `stamina_tired_threshold`, `stamina_overwork_threshold`, `sickness_chance_base`, `sickness_health_reduction`, `sickness_min/max_turns`
- 죄종별 stamina 비용/회복 배율: `stamina_mult_<sin>_cost/recover` 7쌍
- **잔재 키**: `sickness_morale_delta` — 사기 폐기로 무효. 발병 시 topSin 누적으로 대체 예정.
