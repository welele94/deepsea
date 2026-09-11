import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Direction = 'down' | 'up';
type CellType = 'empty' | 'treasure' | 'oxygen';

type Cell = {
  depth: number;
  type: CellType;
  value?: number;
};

const TOTAL_DEPTH = 20;
const DESCENT_TAPS_PER_CELL = 5;
const ASCENT_TAPS_PER_CELL = 8;
const EXTRA_TAPS_PER_TREASURE = 2;
const SURFACE_Y = 132;

const specialCells: Record<number, Omit<Cell, 'depth'>> = {
  3: { type: 'treasure', value: 100 },
  4: { type: 'oxygen' },
  6: { type: 'treasure', value: 200 },
  8: { type: 'oxygen' },
  10: { type: 'treasure', value: 350 },
  12: { type: 'treasure', value: 500 },
  13: { type: 'oxygen' },
  16: { type: 'treasure', value: 800 },
  18: { type: 'oxygen' },
  19: { type: 'treasure', value: 1200 },
  20: { type: 'treasure', value: 2000 },
};

const cells: Cell[] = Array.from({ length: TOTAL_DEPTH }, (_, index) => {
  const depth = index + 1;
  const special = specialCells[depth];
  return special ? { depth, ...special } : { depth, type: 'empty' };
});

const xPattern = [
  0.20, 0.43, 0.67, 0.79, 0.58,
  0.31, 0.16, 0.38, 0.63, 0.76,
  0.56, 0.29, 0.13, 0.34, 0.62,
  0.81, 0.59, 0.36, 0.19, 0.48,
];

export default function App() {
  const { width, height } = useWindowDimensions();
  const worldWidth = Math.min(width, 1180);
  const worldHeight = Math.max(height * 2.45, 1850);
  const viewportHeight = height;

  const [depth, setDepth] = useState(0);
  const depthRef = useRef(0);
  const [direction, setDirection] = useState<Direction>('down');
  const [rolledSeconds, setRolledSeconds] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [tapsThisBurst, setTapsThisBurst] = useState(0);
  const [tapProgress, setTapProgress] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [weight, setWeight] = useState(0);
  const [carriedLoot, setCarriedLoot] = useState<number[]>([]);
  const [bankedScore, setBankedScore] = useState(0);
  const [collectedDepths, setCollectedDepths] = useState<number[]>([]);
  const [message, setMessage] = useState('Roll the die and start your dive.');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstEndsAtRef = useRef(0);
  const tapsCountRef = useRef(0);

  const requiredTaps = useMemo(() => {
    if (direction === 'down') return DESCENT_TAPS_PER_CELL;
    return ASCENT_TAPS_PER_CELL + weight * EXTRA_TAPS_PER_TREASURE;
  }, [direction, weight]);

  const currentCell = cells.find((cell) => cell.depth === depth);
  const carrying = carriedLoot.reduce((sum, value) => sum + value, 0);
  const canCollect =
    !active &&
    currentCell?.type === 'treasure' &&
    currentCell.value !== undefined &&
    !collectedDepths.includes(currentCell.depth);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function platformPosition(cellDepth: number) {
    const platformWidth = Math.max(64, Math.min(112, worldWidth * 0.14));
    const sidePadding = Math.max(22, worldWidth * 0.05);
    const usableWidth = worldWidth - sidePadding * 2 - platformWidth;
    const verticalGap = (worldHeight - SURFACE_Y - 150) / TOTAL_DEPTH;

    return {
      x: sidePadding + xPattern[cellDepth - 1] * usableWidth,
      y: SURFACE_Y + cellDepth * verticalGap,
      width: platformWidth + ((cellDepth % 3) - 1) * 14,
    };
  }

  function diverPosition() {
    if (depth === 0) {
      return {
        x: worldWidth * 0.52,
        y: 56,
      };
    }

    const platform = platformPosition(depth);
    return {
      x: platform.x + platform.width / 2 - 20,
      y: platform.y - 43,
    };
  }

  const currentDiverPosition = diverPosition();
  const targetCameraY = Math.max(
    0,
    Math.min(
      worldHeight - viewportHeight,
      currentDiverPosition.y - viewportHeight * 0.43,
    ),
  );

  function rollDie() {
    if (active || rolledSeconds !== null) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    setRolledSeconds(roll);
    setTapProgress(0);

    if (depth === 0) setDirection('down');
    if (depth === TOTAL_DEPTH) setDirection('up');

    setMessage(`You rolled ${roll}. Pick a direction and swim.`);
  }

  function chooseDirection(nextDirection: Direction) {
    if (active || rolledSeconds === null) return;
    if (depth === 0 && nextDirection === 'up') return;
    if (depth === TOTAL_DEPTH && nextDirection === 'down') return;

    setDirection(nextDirection);
    setTapProgress(0);
  }

  function startBurst() {
    if (active || rolledSeconds === null) return;

    tapsCountRef.current = 0;
    setTapsThisBurst(0);
    setTapProgress(0);
    setActive(true);

    const duration = rolledSeconds * 1000;
    setTimeLeftMs(duration);
    burstEndsAtRef.current = Date.now() + duration;
    setMessage(depth === 0 ? 'DIVE!' : 'SWIM!');

    clearTimer();
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, burstEndsAtRef.current - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        finishBurst();
      }
    }, 40);
  }

  function finishBurst() {
    clearTimer();
    setActive(false);
    setTimeLeftMs(0);
    setRolledSeconds(null);
    setTapProgress(0);
    setMessage(`Finished with ${tapsCountRef.current} taps.`);
  }

  function stopBurstEarly(nextMessage: string) {
    clearTimer();
    setActive(false);
    setTimeLeftMs(0);
    setRolledSeconds(null);
    setTapProgress(0);
    setMessage(nextMessage);
  }

  function returnToBoat() {
    const recovered = carriedLoot.reduce((sum, value) => sum + value, 0);
    setBankedScore((score) => score + recovered);
    setCarriedLoot([]);
    setWeight(0);
    setDirection('down');
    stopBurstEarly(
      recovered > 0 ? `SAFE! You recovered €${recovered}.` : 'SAFE! Back on the boat.',
    );
  }

  function moveOneCell() {
    const currentDepth = depthRef.current;
    const nextDepth =
      direction === 'down'
        ? Math.min(TOTAL_DEPTH, currentDepth + 1)
        : Math.max(0, currentDepth - 1);

    if (nextDepth === currentDepth) return;

    depthRef.current = nextDepth;
    setDepth(nextDepth);

    if (nextDepth === 0) {
      returnToBoat();
      return;
    }

    if (nextDepth === TOTAL_DEPTH) {
      setDirection('up');
      stopBurstEarly('You reached the seabed. Time to get back up.');
      return;
    }

    if (specialCells[nextDepth]?.type === 'oxygen') {
      setMessage('Oxygen tank spotted. Its mechanic comes next.');
    }
  }

  function handleTap() {
    if (!active) return;

    tapsCountRef.current += 1;
    setTapsThisBurst(tapsCountRef.current);

    setTapProgress((progress) => {
      const next = progress + 1;
      if (next >= requiredTaps) {
        moveOneCell();
        return next - requiredTaps;
      }
      return next;
    });
  }

  function pickUpTreasure() {
    if (!canCollect || !currentCell?.value) return;

    setCollectedDepths((depths) => [...depths, currentCell.depth]);
    setCarriedLoot((loot) => [...loot, currentCell.value as number]);
    setWeight((currentWeight) => currentWeight + 1);
    setMessage(`Treasure secured: €${currentCell.value}. It will slow your ascent.`);
  }

  function resetGame() {
    clearTimer();
    tapsCountRef.current = 0;
    depthRef.current = 0;
    setDepth(0);
    setDirection('down');
    setRolledSeconds(null);
    setActive(false);
    setTapsThisBurst(0);
    setTapProgress(0);
    setTimeLeftMs(0);
    setWeight(0);
    setCarriedLoot([]);
    setBankedScore(0);
    setCollectedDepths([]);
    setMessage('Roll the die and start your dive.');
  }

  const timeSeconds = (timeLeftMs / 1000).toFixed(1);
  const progressPercent = Math.min(100, (tapProgress / requiredTaps) * 100);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.oceanViewport}>
        <View
          style={[
            styles.world,
            {
              width: worldWidth,
              height: worldHeight,
              left: Math.max(0, (width - worldWidth) / 2),
              transform: [{ translateY: -targetCameraY }],
            },
          ]}
        >
          <OceanBands worldHeight={worldHeight} />

          <View style={[styles.surfaceLine, { top: SURFACE_Y }]} />
          <Text style={[styles.boat, { left: worldWidth * 0.39, top: 26 }]}>🚤</Text>
          {depth === 0 && (
            <Text
              style={[
                styles.diver,
                { left: currentDiverPosition.x, top: currentDiverPosition.y },
              ]}
            >
              🤿
            </Text>
          )}

          {cells.map((cell) => {
            const platform = platformPosition(cell.depth);
            const collected = collectedDepths.includes(cell.depth);
            const hasDiver = depth === cell.depth;
            const item =
              cell.type === 'oxygen'
                ? '🫧'
                : cell.type === 'treasure' && !collected
                  ? '💎'
                  : '';

            return (
              <View key={cell.depth}>
                {!!item && (
                  <Text
                    style={[
                      styles.item,
                      {
                        left: platform.x + platform.width / 2 - 12,
                        top: platform.y - 39,
                      },
                    ]}
                  >
                    {item}
                  </Text>
                )}

                <View
                  style={[
                    styles.platformShadow,
                    {
                      left: platform.x + 5,
                      top: platform.y + 6,
                      width: platform.width,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.platform,
                    hasDiver && styles.platformCurrent,
                    {
                      left: platform.x,
                      top: platform.y,
                      width: platform.width,
                    },
                  ]}
                />

                {hasDiver && (
                  <Text
                    style={[
                      styles.diver,
                      {
                        left: currentDiverPosition.x,
                        top: currentDiverPosition.y,
                      },
                    ]}
                  >
                    🤿
                  </Text>
                )}

                <Text
                  style={[
                    styles.depthMarker,
                    {
                      left: platform.x - 30,
                      top: platform.y - 2,
                    },
                  ]}
                >
                  {cell.depth}
                </Text>
              </View>
            );
          })}

          <View style={[styles.seabed, { top: worldHeight - 72 }]}>
            <Text style={styles.seabedText}>𓇼   𓆝   𓆟   𓇼</Text>
          </View>
        </View>

        {active && (
          <Pressable
            accessibilityRole="button"
            onPressIn={handleTap}
            style={styles.tapEverywhere}
          >
            <View pointerEvents="none" style={styles.activeCenter}>
              <Text style={styles.activeWord}>TAP!</Text>
              <Text style={styles.activeTimer}>{timeSeconds}</Text>
              <Text style={styles.activeMeta}>
                {tapProgress}/{requiredTaps} · {tapsThisBurst} taps
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%` as `${number}%` },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        )}
      </View>

      <View pointerEvents="box-none" style={styles.topLayer}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>DEEPSEA</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          <Pressable onPress={resetGame} style={styles.resetButton}>
            <Text style={styles.resetText}>↻</Text>
          </Pressable>
        </View>

        <View style={styles.hudRow}>
          <HudPill icon="↕" value={`${depth}/${TOTAL_DEPTH}`} />
          <HudPill icon="💎" value={`€${carrying}`} />
          <HudPill icon="⚓" value={`€${bankedScore}`} />
          <HudPill icon="🎒" value={String(weight)} />
        </View>
      </View>

      {!active && (
        <View pointerEvents="box-none" style={styles.bottomLayer}>
          {canCollect && (
            <Pressable onPress={pickUpTreasure} style={styles.collectButton}>
              <Text style={styles.collectText}>TAKE 💎 €{currentCell?.value}</Text>
            </Pressable>
          )}

          <View style={styles.controlCard}>
            {rolledSeconds === null ? (
              <Pressable onPress={rollDie} style={styles.rollButton}>
                <Text style={styles.rollDie}>🎲</Text>
                <Text style={styles.rollText}>ROLL</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.rollResult}>
                  <Text style={styles.rollResultNumber}>{rolledSeconds}</Text>
                  <Text style={styles.rollResultLabel}>SECONDS</Text>
                </View>

                <View style={styles.directionRow}>
                  <Pressable
                    disabled={depth === TOTAL_DEPTH}
                    onPress={() => chooseDirection('down')}
                    style={[
                      styles.directionButton,
                      direction === 'down' && styles.directionButtonSelected,
                      depth === TOTAL_DEPTH && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.directionText}>↓ DOWN</Text>
                    <Text style={styles.directionSub}>{DESCENT_TAPS_PER_CELL}/step</Text>
                  </Pressable>

                  <Pressable
                    disabled={depth === 0}
                    onPress={() => chooseDirection('up')}
                    style={[
                      styles.directionButton,
                      direction === 'up' && styles.directionButtonSelected,
                      depth === 0 && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.directionText}>↑ UP</Text>
                    <Text style={styles.directionSub}>{requiredTaps}/step</Text>
                  </Pressable>
                </View>

                <Pressable onPress={startBurst} style={styles.swimButton}>
                  <Text style={styles.swimText}>SWIM</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function HudPill({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.hudPill}>
      <Text style={styles.hudIcon}>{icon}</Text>
      <Text style={styles.hudValue}>{value}</Text>
    </View>
  );
}

function OceanBands({ worldHeight }: { worldHeight: number }) {
  const bandHeight = worldHeight / 5;
  const colors = ['#19a9dc', '#0989bf', '#066f9d', '#075579', '#073b59'];

  return (
    <>
      {colors.map((color, index) => (
        <View
          key={color}
          style={[
            styles.oceanBand,
            {
              top: index * bandHeight,
              height: bandHeight + 2,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#073b59',
    overflow: 'hidden',
  },
  oceanViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  world: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  oceanBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  surfaceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(224, 248, 255, 0.75)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  boat: {
    position: 'absolute',
    fontSize: 72,
    transform: [{ scaleX: 1.4 }],
  },
  diver: {
    position: 'absolute',
    zIndex: 8,
    fontSize: 36,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 6,
  },
  platform: {
    position: 'absolute',
    height: 10,
    borderRadius: 8,
    backgroundColor: '#9be5e9',
    borderTopWidth: 2,
    borderTopColor: '#d7fbff',
    borderBottomWidth: 2,
    borderBottomColor: '#24758d',
  },
  platformCurrent: {
    backgroundColor: '#fff2a8',
    borderTopColor: '#fff9da',
    borderBottomColor: '#d99d32',
  },
  platformShadow: {
    position: 'absolute',
    height: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 18, 31, 0.24)',
  },
  item: {
    position: 'absolute',
    zIndex: 6,
    fontSize: 27,
  },
  depthMarker: {
    position: 'absolute',
    color: 'rgba(226,248,255,0.5)',
    fontSize: 11,
    fontWeight: '800',
  },
  seabed: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 92,
    backgroundColor: '#06283c',
    borderTopWidth: 8,
    borderTopColor: '#174b5a',
    alignItems: 'center',
    paddingTop: 15,
  },
  seabedText: {
    color: '#73b5b9',
    fontSize: 30,
    letterSpacing: 12,
  },
  topLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingTop: 42,
    paddingHorizontal: 18,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  brand: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  message: {
    maxWidth: 520,
    marginTop: 3,
    color: 'rgba(239,251,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  resetButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,35,52,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  resetText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  hudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 11,
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(3,37,57,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  hudIcon: {
    fontSize: 13,
  },
  hudValue: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  bottomLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 31,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  controlCard: {
    width: '100%',
    maxWidth: 640,
    minHeight: 78,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 24,
    backgroundColor: 'rgba(3, 29, 44, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 180,
    minHeight: 58,
    paddingHorizontal: 30,
    borderRadius: 18,
    backgroundColor: '#f2d35f',
  },
  rollDie: {
    fontSize: 27,
  },
  rollText: {
    color: '#173247',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  rollResult: {
    width: 64,
    alignItems: 'center',
  },
  rollResultNumber: {
    color: '#ffe678',
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '900',
  },
  rollResultLabel: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  directionRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
  },
  directionButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  directionButtonSelected: {
    backgroundColor: '#087fa7',
    borderColor: '#9de9f1',
  },
  directionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  directionSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.28,
  },
  swimButton: {
    minWidth: 92,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#ef625a',
  },
  swimText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  collectButton: {
    marginBottom: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#f0c94e',
    borderWidth: 2,
    borderColor: '#fff3a7',
  },
  collectText: {
    color: '#173247',
    fontSize: 13,
    fontWeight: '900',
  },
  tapEverywhere: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,18,30,0.07)',
  },
  activeCenter: {
    width: 210,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(1, 25, 39, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  activeWord: {
    color: '#ffe678',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 4,
  },
  activeTimer: {
    marginTop: 2,
    color: '#ffffff',
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '900',
  },
  activeMeta: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    width: 150,
    height: 8,
    marginTop: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#79e4e9',
  },
});
