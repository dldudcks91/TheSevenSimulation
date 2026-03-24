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
├── app.js                    # 진입점, Phaser 초기화
├── game_logic/               # 순수 게임 로직 (Phaser 의존 금지)
│   ├── SinSystem.js
│   ├── HeroManager.js
│   ├── EventSystem.js
│   ├── ExpeditionManager.js
│   ├── BattleEngine.js
│   ├── BaseManager.js
│   └── TurnManager.js
├── scenes/                   # Phaser 씬
│   ├── MainScene.js
│   ├── BattleScene.js
│   ├── ExpeditionScene.js
│   └── EventScene.js
├── ui/                       # UI 컴포넌트
│   └── components/
├── store/                    # 상태 관리
│   └── Store.js
└── data/                     # 게임 데이터 JSON
    ├── events.json
    ├── sin_relations.json
    ├── facilities.json
    └── stages.json
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
| JSON 키 | snake_case | `sin_type`, `base_stat` |

---

## 게임 데이터 (data/)

### JSON 형식
```json
{
    "id": "hero_001",
    "sin_type": "wrath",
    "stats": {
        "strength": 15,
        "agility": 10,
        "intellect": 5,
        "vitality": 14,
        "perception": 8,
        "leadership": 12,
        "charisma": 9
    }
}
```

### 규칙
- 게임 데이터는 JSON 파일로 관리
- 런타임에 JSON 수정 금지 (읽기 전용)
- 플레이어 진행 상태는 Store + LocalStorage

---

## 금지 사항

- `var` 사용 금지 → `const` 우선, 필요 시 `let`
- `==` 사용 금지 → `===` 사용
- `console.log` 배포 금지 → 개발 중에만 사용
- game_logic/ 안에서 DOM/Phaser API 접근 금지
- 전역 변수 금지 → Store 또는 모듈 스코프 사용
- 매직 넘버 금지 → 상수 정의 (`const MORALE_MAX = 100;`)