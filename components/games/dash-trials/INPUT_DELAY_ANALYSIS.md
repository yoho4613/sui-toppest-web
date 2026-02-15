# Dash Trials 입력 딜레이 원인 분석

## 개요
Lucky Day (NeonRunner3D)와 Dash Trials를 비교 분석하여 입력 딜레이의 원인을 파악합니다.

---

## 핵심 발견: React 리렌더링이 주요 원인

### 문제점: GameHUD.tsx의 과도한 Zustand 구독

```typescript
// GameHUD.tsx - 매 프레임 리렌더링을 유발하는 구독들
const distance = useGameStore((state) => state.distance);      // ⚠️ 매 프레임 변경
const elapsedTime = useGameStore((state) => state.elapsedTime); // ⚠️ 매 프레임 변경
const health = useGameStore((state) => state.health);          // ⚠️ 매 프레임 변경 (decay)
const speed = useGameStore((state) => state.speed);            // ⚠️ 매 프레임 변경
const coinCount = useGameStore((state) => state.coinCount);
const isFeverMode = useGameStore((state) => state.isFeverMode);
const consecutiveCoins = useGameStore((state) => state.consecutiveCoins);
const difficulty = useGameStore((state) => state.difficulty);
const maxHealth = useGameStore((state) => state.maxHealth);
```

**결과**: GameHUD 컴포넌트가 **초당 60회 리렌더링** 발생

### Lucky Day vs Dash Trials 비교

| 항목 | Lucky Day | Dash Trials |
|------|-----------|-------------|
| 상태 관리 | `useRef<GameStore>` (ref 직접 접근) | Zustand + React 구독 |
| HUD 업데이트 | CSS 변수 또는 DOM 직접 조작 | React state 기반 리렌더링 |
| 리렌더 빈도 | 거의 없음 | 초당 60회 |
| GC 부담 | 낮음 | 높음 (매 렌더 객체 생성) |

---

## Zustand 구독 현황

### 총 구독 수: 45개

**자주 변경되는 값 구독 (매 프레임 리렌더링 유발):**

| 파일 | 구독 값 | 변경 빈도 |
|------|---------|----------|
| GameHUD.tsx | distance, elapsedTime, health, speed | 매 프레임 |
| useClubRewards.ts | distance | 매 프레임 |
| Player.tsx | playerLane, playerAction, isFeverMode 등 6개 | 상태 변경 시 |

### 문제가 되는 패턴

```typescript
// ❌ 문제: 매 프레임 리렌더링 + Virtual DOM diff
function GameHUD() {
  const distance = useGameStore((state) => state.distance); // 구독
  return <div>{Math.floor(distance)}m</div>; // JSX 재생성
}
```

---

## 입력 딜레이 발생 경로

```
키보드/터치 입력
    ↓
useControls.ts (getState() 사용 - OK)
    ↓
Zustand store 업데이트
    ↓
⚠️ 모든 구독 컴포넌트 리렌더링 (GameHUD 포함)
    ↓
React Virtual DOM diff 계산
    ↓
DOM 업데이트
    ↓
⚠️ 다음 useFrame 실행까지 지연 발생
```

### 지연 계산

- React 리렌더링: ~2-5ms
- Virtual DOM diff: ~1-2ms
- GameHUD 포함 총 9개 구독 컴포넌트
- **최악의 경우: 20-50ms 지연** (1-3 프레임)

---

## 추가 발견: Player.tsx의 복잡한 구조

### Player.tsx 구독 (6개)
```typescript
const playerLane = useGameStore((state) => state.playerLane);
const playerAction = useGameStore((state) => state.playerAction);
const isFeverMode = useGameStore((state) => state.isFeverMode);
const status = useGameStore((state) => state.status);
const isCrashing = useGameStore((state) => state.isCrashing);
const gameOverReason = useGameStore((state) => state.gameOverReason);
```

### Player 3D 모델 복잡도
- 메시 수: ~20개 (몸통, 팔, 다리, 헬멧, 부스터 등)
- 재질 수: ~15개 (각 파츠별 개별 재질)
- 라이트: 2개 (player glow, booster glow)

**Lucky Day Player**: 단순한 프로시저럴 모델 (~8개 메시)

---

## 해결 방안

### 방안 1: GameHUD 최적화 (권장 - 즉시 적용 가능)

```typescript
// ✅ 개선: requestAnimationFrame으로 DOM 직접 업데이트
function GameHUD() {
  const distanceRef = useRef<HTMLSpanElement>(null);
  const healthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationId: number;

    const updateHUD = () => {
      const { distance, health, speed } = useGameStore.getState();
      if (distanceRef.current) {
        distanceRef.current.textContent = `${Math.floor(distance)}m`;
      }
      if (healthRef.current) {
        healthRef.current.style.width = `${health}%`;
      }
      animationId = requestAnimationFrame(updateHUD);
    };

    animationId = requestAnimationFrame(updateHUD);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // JSX는 초기 렌더링 1회만
  return (
    <div>
      <span ref={distanceRef}>0m</span>
      <div ref={healthRef} style={{ width: '100%' }} />
    </div>
  );
}
```

### 방안 2: Lucky Day 패턴으로 완전 교체 (대규모 작업)

```typescript
// 모든 게임 상태를 ref로 관리
const storeRef = useRef<GameStore>({
  distance: 0,
  health: 100,
  playerLane: 0,
  // ...
});

// 구독 대신 직접 참조
useFrame(() => {
  storeRef.current.distance += speed * delta;
});
```

### 방안 3: Player 모델 단순화

현재 Player.tsx: 663줄, ~20개 메시
목표: ~300줄, ~8개 메시

---

## 우선순위 권장

1. **즉시**: GameHUD 리팩토링 (방안 1)
2. **단기**: Player 모델 단순화
3. **중기**: useClubRewards 구독 제거
4. **장기**: 전체 ref 기반 아키텍처 전환 (방안 2)

---

## 메모리 사용 비교

| 항목 | Lucky Day | Dash Trials |
|------|-----------|-------------|
| Player 메시 | ~8개 | ~20개 |
| 재질 객체 | 공유 사용 | 개별 생성 |
| HUD 리렌더 | 없음 | 초당 60회 |
| Zustand 구독 | 0개 | 45개 |

---

## 결론

**주요 원인**: GameHUD.tsx의 과도한 Zustand 구독으로 인한 React 리렌더링

**해결 방향**:
1. 자주 변경되는 값(distance, health, speed)은 DOM 직접 조작으로 전환
2. React 리렌더링을 이벤트 기반으로 제한 (status 변경 시에만)

---

*분석일: 2024-02-15*
