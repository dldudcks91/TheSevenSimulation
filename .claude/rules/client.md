# 클라이언트 JS 규칙

## 아키텍처

### 핵심 원칙
- **서버 없음** — 싱글플레이어, 클라이언트 Only
- **game_logic/와 scenes/를 완전 분리**
  - `game_logic/`: 순수 JS, Phaser 의존 없음 (Godot 이식 대상)
  - `scenes/`: Phaser 씬, 렌더링/애니메이션 담당 (이식 시 대체)
- **빌드 도구 없음** — Vanilla JS, Phaser.js는 CDN 로드

### 디렉토리 구조
```
src/
├── index.html
├── app.js                    # 진입점, CSV 전체 로드 + Phaser 초기화
├── game_logic/               # 순수 게임 로직 (Phaser 의존 금지)
│   ├── SinSystem.js          # 죄종/사기/폭주/이탈/연쇄반응
│   ├── HeroManager.js        # 영웅 랜덤 생성, 사기 관리
│   ├── EventSystem.js        # 이벤트/선택지
│   ├── ExpeditionManager.js  # 원정/방어전 (stagesData 주입)
│   ├── BattleEngine.js       # 전투 계산 (balance 주입)
│   ├── BaseManager.js        # 거점/건설/연구/포고령 (policies 주입)
│   └── TurnManager.js        # 턴 진행 (phases 주입)
├── scenes/                   # Phaser 씬
│   ├── TitleScene.js
│   ├── HeroSelectScene.js
│   ├── MainScene.js          # 영내/영외 전환 + 우측 패널 + 팝업 행동
│   ├── EventScene.js
│   ├── BattleSceneA.js       # 돌진형 전투
│   ├── BattleSceneB.js       # 필드 이동형 전투 (기본값)
│   ├── DuelBattleScene.js    # 1:1 전투 (사냥)
│   ├── ResultScene.js
│   ├── SettlementScene.js
│   └── GameOverScene.js
├── ui/                       # UI 컴포넌트
│   └── components/
├── assets/                   # 게임 에셋
│   └── sprites/
├── store/                    # 상태 관리
│   └── Store.js
└── data/                     # 게임 데이터 (CSV)
    ├── CsvLoader.js          # CSV 파서 + 전체 로더 + 데이터 조립
    ├── balance.csv            # 밸런스 상수 (전투/사기/보상)
    ├── hero_names.csv         # 영웅 이름 풀
    ├── sin_types.csv          # 7죄종 정의
    ├── sin_relations.csv      # 죄종 간 관계 매트릭스
    ├── sin_satisfaction.csv   # 죄종별 만족/불만 조건
    ├── sin_rampage_chain.csv  # 폭주 연쇄 반응
    ├── events.csv             # 이벤트 본체
    ├── event_choices.csv      # 이벤트 선택지
    ├── event_effects.csv      # 선택지 효과
    ├── facilities.csv         # 시설 정보
    ├── research.csv           # 연구 항목
    ├── chapters.csv           # 7챕터 정보
    ├── stages.csv             # 스테이지 정보
    ├── stage_enemies.csv      # 스테이지별 적
    ├── policies.csv           # 포고령 종류/효과
    ├── hunt_enemies.csv       # 사냥 적
    ├── phases.csv             # 턴 페이즈
    ├── morale_states.csv      # 사기 5단계
    ├── desertion_effects.csv  # 이탈 효과
    ├── defense_scaling.csv    # 방어전 스케일링
    └── stat_names.csv         # 스탯 한글명
```

---

## 모듈 시스템

### ES Modules Only
```javascript
// ✅ 올바름
import HeroManager from './game_logic/HeroManager.js';
export default SinSystem;
export { calculateMorale };

// ❌ 금지
const module = require('...');  // CommonJS 금지
(function() { ... })();         // IIFE 금지
```

---

## 게임 로직 모듈 패턴 (game_logic/)

### Manager 클래스 패턴
```javascript
/**
 * 영웅 관리
 */
class HeroManager {
    constructor(store) {
        this.store = store;
    }

    /** 영웅 랜덤 생성 */
    createHero() {
        // 순수 로직만. DOM/Phaser 접근 금지
    }

    /** 사기 변동 */
    updateMorale(heroId, delta) {
        // store.setState()로 상태 변경
    }
}

export default HeroManager;
```

### 규칙
- Phaser, DOM, Canvas 접근 **절대 금지**
- 상태 변경은 반드시 Store를 통해서
- 다른 Manager 직접 참조 금지 → Store를 통해 통신
- 순수 함수 우선 (같은 입력 → 같은 출력)

---

## Phaser 씬 패턴 (scenes/)

### 씬 구조
```javascript
import Phaser from 'phaser';

class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    init(data) {
        // 씬 전환 시 데이터 수신
    }

    create() {
        // 스프라이트, UI 생성
    }

    update(time, delta) {
        // 프레임별 업데이트
    }
}

export default BattleScene;
```

### 규칙
- 게임 로직 직접 구현 금지 → game_logic/ 모듈 호출
- 씬은 **렌더링과 애니메이션만** 담당
- 씬 간 데이터 전달은 `this.scene.start('SceneName', data)` 사용

---

## 상태 관리 (Store)

### Central Store (pub/sub 패턴)
```javascript
class Store {
    constructor() {
        this._state = {};
        this._listeners = new Map();
    }

    getState(key) {
        return this._state[key];
    }

    setState(key, value) {
        this._state[key] = value;
        this._notify(key);
    }

    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);
        return () => this._unsubscribe(key, callback);
    }

    _notify(key) {
        const listeners = this._listeners.get(key) || [];
        listeners.forEach(cb => cb(this._state[key]));
    }

    _unsubscribe(key, callback) {
        const listeners = this._listeners.get(key) || [];
        this._listeners.set(key, listeners.filter(cb => cb !== callback));
    }
}

export default new Store();
```

### 데이터 흐름
```
[플레이어 입력] → [Phaser 씬] → [game_logic Manager] → [Store] → [Phaser 씬 업데이트]
```

---

## UI 컴포넌트 패턴 (HTML 혼합 UI용)

### mount/unmount 라이프사이클
```javascript
const HeroPanel = {
    el: null,
    _unsubscribers: [],

    mount(el) {
        this.el = el;
        this.el.innerHTML = this._render();
        this._bindEvents();
        this._unsubscribers.push(
            store.subscribe('heroes', () => this._update())
        );
    },

    unmount() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        this.el.innerHTML = '';
    },

    _render() {
        return `<div class="hero-panel">...</div>`;
    },

    _update() {
        // 부분 업데이트 (전체 리렌더 X)
    },

    _bindEvents() {
        this.el.addEventListener('pointerdown', this._onAction.bind(this));
    },

    _onAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        // action에 따라 분기
    }
};

export default HeroPanel;
```

### 규칙
- 이벤트 위임 (`data-action`) 사용, 개별 리스너 금지
- `pointerdown` 사용 (모바일 대응)
- 부분 업데이트 우선 (innerHTML 전체 교체 최소화)

---

## 세이브/로드

### LocalStorage
```javascript
const SaveManager = {
    save(state) {
        localStorage.setItem('theseven_save', JSON.stringify(state));
    },

    load() {
        const raw = localStorage.getItem('theseven_save');
        return raw ? JSON.parse(raw) : null;
    },

    deleteSave() {
        localStorage.removeItem('theseven_save');
    }
};
```

---

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수/함수 | camelCase | `heroMorale`, `calculateDamage()` |
| 클래스 | PascalCase | `HeroManager`, `BattleScene` |
| 상수 | UPPER_SNAKE | `MAX_HEROES`, `MORALE_MAX` |
| 파일명 | PascalCase (클래스) | `HeroManager.js`, `BattleScene.js` |
| data 속성 | snake_case | `data-action`, `data-hero-id` |
| CSV 헤더/키 | snake_case | `sin_type`, `base_stat` |

---

## 게임 데이터 (data/)

### CSV 형식 (데이터 주도 설계)
모든 게임 데이터는 CSV로 관리. 게임 시작 시 `CsvLoader.loadAllCsv()`로 전체 로드 후 `buildGameData()`로 JS 객체로 조립.

```
[CSV 파일] → CsvLoader.parseCsv() → 객체 배열
[전체 CSV] → loadAllCsv() → buildGameData() → registry에 등록
[game_logic] ← 생성자에서 데이터 주입 (balance, policies 등)
```

### CSV 규칙
- 첫 줄 = 헤더 (컬럼명, snake_case)
- 숫자 자동 변환, 빈 셀 = null, true/false = boolean
- 따옴표로 감싼 셀 내 콤마/줄바꿈 지원
- 런타임에 CSV 수정 금지 (읽기 전용)
- 플레이어 진행 상태는 Store + LocalStorage
- 밸런스 상수는 `balance.csv`에 key-value로 관리
- 하드코딩된 게임 수치는 반드시 CSV로 추출

---

## 금지 사항

- `var` 사용 금지 → `const` 우선, 필요 시 `let`
- `==` 사용 금지 → `===` 사용
- `console.log` 배포 금지 → 개발 중에만 사용
- game_logic/ 안에서 DOM/Phaser API 접근 금지
- 전역 변수 금지 → Store 또는 모듈 스코프 사용
- 매직 넘버 금지 → `balance.csv`에서 로드 (`this.balance.morale_max ?? 100`)