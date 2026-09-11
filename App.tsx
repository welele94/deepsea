import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
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
const DESCENT_TAPS_PER_CELL = 10;
const ASCENT_TAPS_PER_CELL = 15;
const EXTRA_TAPS_PER_TREASURE = 5;

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

export default function App() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [depth, setDepth] = useState(0);
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
  const [message, setMessage] = useState('Roll the die to begin your dive.');

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

  function rollDie() {
    if (active || rolledSeconds !== null) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    setRolledSeconds(roll);
    setTapProgress(0);

    if (depth === 0) setDirection('down');
    if (depth === TOTAL_DEPTH) setDirection('up');

    setMessage(`You rolled ${roll}. Choose your direction, then swim.`);
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
    setMessage(depth === 0 ? 'DIVE! Tap as fast as you can!' : 'SWIM! Tap as fast as you can!');

    clearTimer();
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, burstEndsAtRef.current - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        finishBurst();
      }
    }, 50);
  }

  function finishBurst() {
    clearTimer();
    setActive(false);
    setTimeLeftMs(0);
    setRolledSeconds(null);
    setTapProgress(0);
    setMessage(`Burst finished: ${tapsCountRef.current} taps.`);
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
    setDepth((currentDepth) => {
      if (direction === 'down') {
        if (currentDepth >= TOTAL_DEPTH) return currentDepth;
        const nextDepth = currentDepth + 1;

        if (nextDepth === TOTAL_DEPTH) {
          setDirection('up');
          stopBurstEarly('Bottom reached. Now you have to get back up.');
        } else if (specialCells[nextDepth]?.type === 'oxygen') {
          setMessage('Oxygen tank spotted. We will wire its mechanic next.');
        }

        return nextDepth;
      }

      if (currentDepth <= 0) return currentDepth;
      const nextDepth = currentDepth - 1;

      if (nextDepth === 0) {
        returnToBoat();
      } else if (specialCells[nextDepth]?.type === 'oxygen') {
        setMessage('Oxygen tank spotted. We will wire its mechanic next.');
      }

      return nextDepth;
    });
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
    setMessage(
      `Treasure collected: €${currentCell.value}. Going up now costs more taps.`,
    );
  }

  function resetGame() {
    clearTimer();
    tapsCountRef.current = 0;
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
    setMessage('Roll the die to begin your dive.');
  }

  const timeSeconds = (timeLeftMs / 1000).toFixed(1);
  const progressPercent = Math.min(100, (tapProgress / requiredTaps) * 100);

  const Controls = (
    <View style={[styles.panel, styles.controlsPanel]}>
      <View style={styles.statsGrid}>
        <Stat label="DEPTH" value={`${depth}/${TOTAL_DEPTH}`} />
        <Stat label="WEIGHT" value={String(weight)} />
        <Stat label="CARRYING" value={`€${carrying}`} />
        <Stat label="BANKED" value={`€${bankedScore}`} />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.eyebrow}>CURRENT STATUS</Text>
        <Text style={styles.statusText}>{message}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={active || rolledSeconds !== null}
        onPress={rollDie}
        style={({ pressed }) => [
          styles.diceButton,
          (active || rolledSeconds !== null) && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.diceFace}>{rolledSeconds ?? '🎲'}</Text>
        <Text style={styles.buttonText}>
          {rolledSeconds === null
            ? 'ROLL DIE'
            : `${rolledSeconds} SECOND${rolledSeconds === 1 ? '' : 'S'}`}
        </Text>
      </Pressable>

      <View style={styles.directionBlock}>
        <Text style={styles.eyebrow}>DIRECTION</Text>
        <View style={styles.directionRow}>
          <DirectionButton
            label="↓ DOWN"
            selected={direction === 'down'}
            disabled={active || rolledSeconds === null || depth === TOTAL_DEPTH}
            onPress={() => chooseDirection('down')}
          />
          <DirectionButton
            label="↑ UP"
            selected={direction === 'up'}
            disabled={active || rolledSeconds === null || depth === 0}
            onPress={() => chooseDirection('up')}
          />
        </View>
        <Text style={styles.helperText}>
          {direction === 'down'
            ? `${DESCENT_TAPS_PER_CELL} taps per cell`
            : `${requiredTaps} taps per cell (${ASCENT_TAPS_PER_CELL} base + weight)`}
        </Text>
      </View>

      {canCollect && (
        <Pressable onPress={pickUpTreasure} style={styles.collectButton}>
          <Text style={styles.buttonText}>💎 PICK UP €{currentCell?.value}</Text>
        </Pressable>
      )}

      {!active && rolledSeconds !== null && (
        <Pressable onPress={startBurst} style={styles.startButton}>
          <Text style={styles.startText}>START SWIMMING — {rolledSeconds}s</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={!active}
        onPressIn={handleTap}
        style={({ pressed }) => [
          styles.tapZone,
          active && styles.tapZoneActive,
          !active && styles.disabled,
          pressed && active && styles.tapZonePressed,
        ]}
      >
        <Text style={styles.tapTitle}>{active ? 'TAP! TAP! TAP!' : 'TAPPING ZONE'}</Text>
        <Text style={styles.timer}>{active ? `${timeSeconds}s` : '—'}</Text>
        <Text style={styles.tapCount}>{tapsThisBurst} taps</Text>
        <Text style={styles.helperText}>
          {tapProgress} / {requiredTaps} to next cell
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </Pressable>

      <View style={styles.rulesRow}>
        <Text style={styles.ruleText}>↓ 10 taps</Text>
        <Text style={styles.ruleText}>↑ 15 taps</Text>
        <Text style={styles.ruleText}>💎 +5 up</Text>
      </View>

      <Pressable onPress={resetGame} style={styles.resetButton}>
        <Text style={styles.resetText}>Reset prototype</Text>
      </Pressable>
    </View>
  );

  const Track = (
    <View style={[styles.panel, styles.oceanPanel]}>
      <View style={styles.surfaceBlock}>
        <Text style={styles.boat}>🚤 {depth === 0 ? '🤿' : ''}</Text>
        <Text style={styles.waves}>≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈</Text>
      </View>

      {cells.map((cell) => {
        const hasDiver = depth === cell.depth;
        const collected = collectedDepths.includes(cell.depth);
        const item =
          cell.type === 'oxygen'
            ? '🫧'
            : cell.type === 'treasure' && !collected
              ? '💎'
              : '·';

        return (
          <View key={cell.depth} style={styles.depthRow}>
            <Text style={styles.depthNumber}>{String(cell.depth).padStart(2, '0')}</Text>
            <View
              style={[
                styles.depthCell,
                { backgroundColor: depthColor(cell.depth) },
                hasDiver && styles.activeCell,
              ]}
            >
              <Text style={styles.cellItem}>{item}</Text>
              {hasDiver && <Text style={styles.diver}>🤿</Text>}
            </View>
          </View>
        );
      })}

      <View style={styles.seabed}>
        <Text style={styles.seabedText}>𓇼  SEABED  𓆝</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>WEB + MOBILE ARCADE PROTOTYPE</Text>
            <Text style={styles.title}>DEEPSEA</Text>
          </View>
          <Text style={styles.tagline}>Roll. Dive. Tap. Get greedy. Get back alive.</Text>
        </View>

        <View style={[styles.gameLayout, wide && styles.gameLayoutWide]}>
          {wide ? (
            <>
              {Track}
              {Controls}
            </>
          ) : (
            <>
              {Controls}
              {Track}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function DirectionButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.directionButton,
        selected && styles.directionSelected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.directionText}>{label}</Text>
    </Pressable>
  );
}

function depthColor(depth: number) {
  if (depth <= 5) return '#123c63';
  if (depth <= 10) return '#0e3256';
  if (depth <= 15) return '#0a2948';
  return '#071f38';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05111f',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    padding: 18,
    paddingTop: 36,
    paddingBottom: 60,
  },
  header: {
    gap: 10,
    marginBottom: 20,
  },
  eyebrow: {
    color: '#82cfff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tagline: {
    color: '#91a7bd',
    fontSize: 15,
  },
  gameLayout: {
    gap: 18,
  },
  gameLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#17324b',
    borderRadius: 22,
    backgroundColor: '#081827',
    overflow: 'hidden',
  },
  controlsPanel: {
    flex: 1,
    minWidth: 0,
    padding: 18,
    gap: 16,
  },
  oceanPanel: {
    flex: 1.1,
    minWidth: 0,
    paddingBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 110,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#0c2236',
  },
  statLabel: {
    color: '#6f879d',
    fontSize: 10,
    fontWeight: '800',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  statusCard: {
    borderRadius: 16,
    backgroundColor: '#0c2236',
    padding: 14,
    gap: 5,
  },
  statusText: {
    color: '#d7e8f7',
    fontSize: 15,
    lineHeight: 21,
  },
  diceButton: {
    minHeight: 94,
    borderRadius: 18,
    backgroundColor: '#123d60',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  diceFace: {
    fontSize: 36,
    color: '#ffffff',
    fontWeight: '900',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  directionBlock: {
    gap: 9,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  directionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#284760',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a1c2d',
  },
  directionSelected: {
    borderColor: '#5dc9ff',
    backgroundColor: '#123b5b',
  },
  directionText: {
    color: '#e8f5ff',
    fontWeight: '800',
  },
  helperText: {
    color: '#7f97ad',
    fontSize: 12,
  },
  collectButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#654c16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#187eb4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  tapZone: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#24425b',
    backgroundColor: '#0a1b2b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    gap: 7,
  },
  tapZoneActive: {
    borderColor: '#5dc9ff',
    backgroundColor: '#0d2b42',
  },
  tapZonePressed: {
    transform: [{ scale: 0.995 }],
    backgroundColor: '#123750',
  },
  tapTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  timer: {
    color: '#70d4ff',
    fontSize: 46,
    fontWeight: '900',
  },
  tapCount: {
    color: '#d9ecfa',
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#142f44',
    overflow: 'hidden',
    marginTop: 7,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5dc9ff',
  },
  rulesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  ruleText: {
    color: '#90abc0',
    fontSize: 12,
    fontWeight: '700',
  },
  resetButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resetText: {
    color: '#6f879d',
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.38,
  },
  pressed: {
    opacity: 0.8,
  },
  surfaceBlock: {
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    backgroundColor: '#0c4167',
  },
  boat: {
    fontSize: 36,
  },
  waves: {
    color: '#73d4ff',
    fontSize: 20,
    letterSpacing: 3,
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 7,
    gap: 10,
  },
  depthNumber: {
    width: 28,
    textAlign: 'right',
    color: '#62809a',
    fontSize: 11,
    fontWeight: '800',
  },
  depthCell: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#19415f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCell: {
    borderColor: '#6ed8ff',
    borderWidth: 2,
  },
  cellItem: {
    fontSize: 20,
  },
  diver: {
    position: 'absolute',
    right: 14,
    fontSize: 24,
  },
  seabed: {
    marginTop: 12,
    marginHorizontal: 16,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#10293a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seabedText: {
    color: '#8ba5b7',
    fontWeight: '900',
    letterSpacing: 2,
  },
});
