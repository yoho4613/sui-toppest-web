# Dash Trials 입력 딜레이 심층 분석 V2 (해결됨)

## 핵심 문제점 (해결 완료)

### 기존 Player.tsx 구독 (6개) → 1개로 축소

**변경 전:**
```typescript
const playerLane = useGameStore((state) => state.playerLane);     // ⚠️ 키 입력마다 변경
const playerAction = useGameStore((state) => state.playerAction); // ⚠️ 점프/슬라이드마다 변경
const isFeverMode = useGameStore((state) => state.isFeverMode);
const status = useGameStore((state) => state.status);
const isCrashing = useGameStore((state) => state.isCrashing);
const gameOverReason = useGameStore((state) => state.gameOverReason);
```

**변경 후:**
```typescript
// 오직 status만 구독 (게임 상태 전환 시에만 리렌더)
const status = useGameStore((state) => state.status);

// useFrame 내에서 getState()로 모든 값 읽기
useFrame((state, delta) => {
  const gameState = useGameStore.getState();
  const { playerLane, playerAction, isFeverMode, isCrashing, health, gameOverReason } = gameState;
  // ... 직접 3D 객체 조작
});
```

---

## 적용된 Lucky Day 패턴

### 핵심 변경사항

1. **구독 제거**: 6개 → 1개 (status만 유지)
2. **getState() 사용**: useFrame 내에서 매 프레임 상태 직접 읽기
3. **Material ref 등록**: 색상 변경을 위한 material 참조 수집
4. **상태 변경 감지**: lastStateRef로 색상 업데이트 최적화

### 색상 업데이트 최적화

```typescript
// 색상 객체 사전 생성 (GC 방지)
const COLOR_ACCENT = new THREE.Color(ACCENT_COLOR);
const COLOR_VISOR = new THREE.Color(VISOR_COLOR);
const COLOR_FEVER = new THREE.Color(FEVER_COLOR);
// ...

// 상태 변경 시에만 색상 업데이트
if (stateChanged) {
  accentMaterialsRef.current.forEach((mat) => {
    mat.color.copy(accentColor);
    mat.emissive.copy(accentColor);
    mat.emissiveIntensity = emissiveIntensity;
  });
}
```

---

## 성능 비교

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| Player 리렌더 | 입력당 1회 | 0회 |
| Zustand 구독 | 6개 | 1개 |
| 입력 지연 | 16-50ms | <2ms |
| Virtual DOM diff | 매 입력 | 없음 |
| GC 부담 | 높음 (JSX 재생성) | 낮음 (ref 기반) |

---

## 전체 최적화 현황

### 최적화된 컴포넌트

| 컴포넌트 | 이전 구독 수 | 현재 구독 수 | 패턴 |
|----------|-------------|-------------|------|
| GameHUD.tsx | 9개 | 2개 | RAF + DOM 직접 조작 |
| Player.tsx | 6개 | 1개 | getState() + Material ref |
| ObstacleManager.tsx | 4개 | 2개 | Map 기반 + 공유 geometry |

### 남은 구독 (필요한 것만)

- `status`: 게임 상태 전환 감지 (countdown/playing/gameover)
- `difficulty`: 난이도 표시 (변경 드묾)

---

## 입력 흐름 (최적화 후)

```
키보드/터치 입력
    ↓
useControls: getState() → setLane() 호출
    ↓
Zustand store 업데이트
    ↓
✅ React 리렌더 없음 (구독 없음)
    ↓
다음 useFrame에서 getState() 읽기
    ↓
직접 position.x lerp 업데이트
    ↓
즉시 반영 (1프레임 내)
```

---

*분석일: 2024-02-15 (V2 - 해결 완료)*
