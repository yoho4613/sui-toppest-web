# Dash Trials 게임 렉/입력 지연 분석 보고서

## 현상
- 게임 플레이 중 간헐적으로 버튼 입력이 늦게 처리됨
- 캐릭터 이동 반응이 지연됨
- 특히 장애물이 많이 나올 때 심해짐

---

## 원인 분석

### 1. 과도한 useFrame 콜백 (가장 큰 원인)

**현재 상태:**
```
매 프레임마다 실행되는 useFrame 수:
├── Player.tsx:99         → 1개
├── Track.tsx:58          → 1개 (Environment 내 Line)
├── ObstacleManager.tsx:408 → 1개
├── Obstacle.tsx:88       → 장애물 개수만큼 (10-30개)
├── Coin.tsx (Obstacle.tsx:463) → 코인 개수만큼 (10-20개)
└── HealthPotion.tsx (Obstacle.tsx:575) → 포션 개수만큼 (5-10개)

총: 매 프레임 25-60개의 useFrame 콜백 실행
```

**문제점:**
- 각 useFrame 내부에서 `storeRef.current` 접근
- 각각에서 충돌 감지, 애니메이션, 위치 계산 수행
- CPU 과부하 → 메인 스레드 블로킹 → 입력 이벤트 처리 지연

### 2. 이중 게임 루프

**현재 구조:**
```typescript
// DashTrialsGame.tsx:28-51 - 별도 requestAnimationFrame 루프
useEffect(() => {
  const gameLoop = (currentTime: number) => {
    storeRef.current.updateGame(delta);
    animationId = requestAnimationFrame(gameLoop);
  };
  animationId = requestAnimationFrame(gameLoop);
}, [status]);

// + Three.js Canvas 내부의 useFrame 루프 (자동)
```

**문제점:**
- 두 개의 독립적인 애니메이션 루프가 동시 실행
- 동기화 문제 발생 가능
- 불필요한 CPU 사용

### 3. Zustand 구독 중복

**현재 상태:**
```
useGameStore.subscribe() 호출 위치:
├── DashTrialsGame.tsx (GameLoop)
├── ObstacleManager.tsx
├── ControlPad.tsx
├── Obstacle.tsx (장애물당 1개)
├── Coin.tsx (코인당 1개)
└── HealthPotion.tsx (포션당 1개)

총: 30-60개의 동시 구독
```

**문제점:**
- 상태 변경 시 모든 구독자에게 알림
- 구독 콜백 실행 오버헤드

### 4. React 상태 업데이트 중 렌더링

**문제 코드 (ObstacleManager.tsx:423-448):**
```typescript
useFrame((state) => {
  // useFrame 내에서 React 상태 업데이트
  setObstacles(prev => [...filtered, ...newObstacles]);
  setCoins(prev => [...filtered, ...newCoins]);
  setPotions(prev => [...filtered, ...newPotions]);
});
```

**문제점:**
- useFrame은 매 프레임 실행 (60fps = 16.7ms 간격)
- 상태 업데이트 시 React 재조정(reconciliation) 발생
- Virtual DOM diff 계산 → 메인 스레드 블로킹

### 5. 입력 이벤트 처리 지연

**현재 입력 처리 흐름:**
```
키보드/터치 이벤트 발생
    ↓
이벤트 리스너 콜백 (useControls.ts)
    ↓
useGameStore.getState() 호출
    ↓
상태 업데이트 (set())
    ↓
useFrame에서 시각적 반영 (다음 프레임)
```

**문제점:**
- 메인 스레드가 useFrame 처리 중이면 이벤트 처리 대기
- 60개의 useFrame이 순차 실행되는 동안 입력이 대기열에 쌓임

---

## 성능 영향도 분석

| 원인 | 영향도 | 수정 난이도 |
|------|--------|-------------|
| 개별 useFrame (25-60개) | 🔴 매우 높음 | 🟡 중간 |
| 이중 게임 루프 | 🟠 높음 | 🟢 낮음 |
| Zustand 중복 구독 | 🟡 중간 | 🟡 중간 |
| useFrame 내 setState | 🟠 높음 | 🟢 낮음 |
| 입력 이벤트 지연 | 🟡 결과적 문제 | - |

---

## 개선 방안

### 방안 1: 중앙집중식 useFrame (권장 - 효과 높음)

**현재:**
```
Obstacle × 30개 → 30개 useFrame
Coin × 15개 → 15개 useFrame
Potion × 5개 → 5개 useFrame
= 50개 useFrame
```

**개선:**
```typescript
// ObstacleManager.tsx - 단일 useFrame에서 모든 오브젝트 처리
useFrame((state, delta) => {
  const { distance, playerLane, playerAction, isFeverMode } = storeRef.current;

  // 모든 장애물 위치 일괄 업데이트
  obstacleRefs.current.forEach((ref, index) => {
    if (!ref) return;
    const obs = obstacles[index];
    ref.position.z = -(obs.distance - distance);
    // 충돌 감지도 여기서
  });

  // 모든 코인 위치 일괄 업데이트
  coinRefs.current.forEach((ref, index) => {
    // ...
  });
});
```

**기대 효과:**
- 50개 → 1개 useFrame으로 감소
- 약 80% CPU 사용량 감소

### 방안 2: 게임 루프 통합

**현재:**
```typescript
// 별도 requestAnimationFrame 루프
useEffect(() => { ... requestAnimationFrame(gameLoop) ... });

// + Three.js useFrame
```

**개선:**
```typescript
// Player.tsx 또는 ObstacleManager.tsx의 useFrame에서 처리
useFrame((state, delta) => {
  useGameStore.getState().updateGame(delta);
  // ... 나머지 로직
});

// GameLoop 컴포넌트 제거
```

**기대 효과:**
- 이중 루프 제거
- 타이밍 동기화 개선

### 방안 3: 상태 업데이트 배치/쓰로틀링

**현재:**
```typescript
useFrame(() => {
  setObstacles(...);
  setCoins(...);
  setPotions(...);
});
```

**개선:**
```typescript
const pendingUpdatesRef = useRef({ obstacles: null, coins: null, potions: null });
const lastUpdateTimeRef = useRef(0);

useFrame((state) => {
  const now = state.clock.elapsedTime * 1000;

  // 100ms 간격으로만 React 상태 업데이트
  if (now - lastUpdateTimeRef.current > 100) {
    if (pendingUpdatesRef.current.obstacles) {
      setObstacles(pendingUpdatesRef.current.obstacles);
      pendingUpdatesRef.current.obstacles = null;
    }
    lastUpdateTimeRef.current = now;
  }
});
```

**기대 효과:**
- React 재조정 빈도 감소 (60fps → 10fps)
- 메인 스레드 여유 확보

### 방안 4: Instanced Mesh 사용 (고급)

**현재:**
```jsx
{obstacles.map(obs => <Obstacle key={obs.id} ... />)}
// → 30개 Mesh 렌더 콜
```

**개선:**
```typescript
// 동일 유형 장애물을 InstancedMesh로 렌더링
<instancedMesh ref={instancedMeshRef} args={[geometry, material, 50]}>
  {/* 50개 인스턴스를 하나의 드로우 콜로 */}
</instancedMesh>
```

**기대 효과:**
- GPU 드로우 콜 50개 → 1개
- 렌더링 성능 대폭 향상

### 방안 5: 입력 우선순위 높이기

**현재:**
- 입력 이벤트가 다른 작업과 동일한 우선순위

**개선:**
```typescript
// 입력을 즉시 처리하는 별도 마이크로태스크
const handleKeyDown = (e: KeyboardEvent) => {
  queueMicrotask(() => {
    // 상태 업데이트를 마이크로태스크로 실행
    // 메인 스레드 작업보다 우선 처리됨
    useGameStore.getState().setLane(...);
  });
};
```

---

## 우선순위별 개선 로드맵

### 즉시 적용 (Quick Win)
1. ✅ 게임 루프 통합 - GameLoop 컴포넌트를 useFrame으로 이전
2. ✅ useFrame 내 setState 쓰로틀링 - 100ms 간격으로 제한

### 단기 개선 (1-2일)
3. 🔲 중앙집중식 useFrame - ObstacleManager에서 모든 오브젝트 위치 관리
4. 🔲 개별 Obstacle/Coin/Potion 컴포넌트에서 useFrame 제거

### 중기 개선 (1주)
5. 🔲 InstancedMesh 적용 - 동일 유형 오브젝트 배치 렌더링
6. 🔲 Web Worker로 충돌 감지 오프로드

---

## 측정 방법

개선 전후 비교를 위한 성능 측정:

```typescript
// 프레임 타임 측정
let lastTime = performance.now();
let frameTimes: number[] = [];

useFrame(() => {
  const now = performance.now();
  frameTimes.push(now - lastTime);
  lastTime = now;

  if (frameTimes.length >= 60) {
    const avg = frameTimes.reduce((a, b) => a + b) / 60;
    console.log(`Average frame time: ${avg.toFixed(2)}ms (${(1000/avg).toFixed(1)} FPS)`);
    frameTimes = [];
  }
});
```

**목표:**
- 현재 예상: 20-30ms (33-50 FPS)
- 목표: 16ms 이하 (60 FPS 안정)
- 입력 지연: 50ms → 16ms 이하

---

## 결론

**핵심 문제:** 개별 오브젝트마다 useFrame을 사용하여 매 프레임 50-60개의 콜백이 실행됨

**핵심 해결책:** 중앙집중식 useFrame 패턴으로 전환하여 1개의 useFrame에서 모든 오브젝트 처리

**예상 효과:**
- CPU 사용량 70-80% 감소
- 입력 응답 시간 3-5배 개선
- 안정적인 60 FPS 유지
