import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Farger for muskler som er brukt. Primære er røde, sekundære blå (som på muskelkart generelt). */
export const MUSCLE_PRIMARY = '#E5533D';
export const MUSCLE_SECONDARY = '#5B7CFA';

export type MuscleLoad = Map<string, 'PRIMARY' | 'SECONDARY'>;

/*
 * Egen, forenklet figur (ikke Lyftas illustrasjoner). Koordinatsystem 100 × 220 per side.
 * Hver muskel er én eller flere enkle former, speilet for venstre og høyre side.
 */
type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number };

const pair = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { kind: 'ellipse', cx, cy, rx, ry },
  { kind: 'ellipse', cx: 100 - cx, cy, rx, ry },
];

const FRONT: Record<string, Shape[]> = {
  SHOULDERS: pair(26, 41, 7, 6),
  CHEST: [
    { kind: 'path', d: 'M34 40 Q42 37 49 40 L49 54 Q40 58 33 52 Z' },
    { kind: 'path', d: 'M66 40 Q58 37 51 40 L51 54 Q60 58 67 52 Z' },
  ],
  BICEPS: pair(20, 58, 4.5, 10),
  FOREARMS: pair(15, 87, 4, 11),
  ABS: [{ kind: 'rect', x: 43, y: 58, w: 14, h: 36, r: 4 }],
  OBLIQUES: [
    { kind: 'path', d: 'M34 60 L41 60 L41 92 L36 92 Z' },
    { kind: 'path', d: 'M66 60 L59 60 L59 92 L64 92 Z' },
  ],
  QUADS: pair(40, 137, 8, 20),
  ADDUCTORS: pair(46.5, 124, 2.5, 10),
  CALVES: pair(39, 182, 4.5, 13),
};

const BACK: Record<string, Shape[]> = {
  TRAPS: [{ kind: 'path', d: 'M41 30 L59 30 L67 40 L50 50 L33 40 Z' }],
  SHOULDERS: pair(26, 41, 7, 6),
  UPPER_BACK: [{ kind: 'path', d: 'M39 46 L61 46 L59 62 L41 62 Z' }],
  LATS: [
    { kind: 'path', d: 'M30 46 L38 52 L41 80 L34 74 Z' },
    { kind: 'path', d: 'M70 46 L62 52 L59 80 L66 74 Z' },
  ],
  LOWER_BACK: [{ kind: 'rect', x: 42, y: 74, w: 16, h: 22, r: 4 }],
  TRICEPS: pair(20, 58, 4.5, 11),
  FOREARMS: pair(15, 87, 4, 11),
  GLUTES: pair(42, 108, 8.5, 9),
  ABDUCTORS: pair(31.5, 110, 2.5, 7),
  HAMSTRINGS: pair(40, 142, 8, 18),
  CALVES: pair(39, 180, 6, 13),
};

function Body({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Circle cx={50} cy={15} r={10} />
      <Rect x={45} y={23} width={10} height={9} rx={3} />
      <Path d="M30 34 Q50 29 70 34 L75 46 L68 98 L32 98 L25 46 Z" />
      <Path d="M32 96 L68 96 L71 114 L50 120 L29 114 Z" />
      {[20, 80].map((cx) => (
        <G key={cx}>
          <Ellipse cx={cx} cy={58} rx={6.5} ry={17} />
          <Ellipse cx={cx === 20 ? 15 : 85} cy={88} rx={5.5} ry={15} />
          <Circle cx={cx === 20 ? 12 : 88} cy={108} r={4.5} />
        </G>
      ))}
      {[40, 60].map((cx) => (
        <G key={cx}>
          <Ellipse cx={cx} cy={140} rx={10.5} ry={26} />
          <Ellipse cx={cx === 40 ? 39 : 61} cy={183} rx={7.5} ry={20} />
          <Ellipse cx={cx === 40 ? 38 : 62} cy={207} rx={6.5} ry={3.5} />
        </G>
      ))}
    </G>
  );
}

function renderShape(s: Shape, fill: string, key: string) {
  if (s.kind === 'ellipse') return <Ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} />;
  if (s.kind === 'rect') return <Rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill} />;
  return <Path key={key} d={s.d} fill={fill} />;
}

/** Utsnitt av figuren: hele kroppen, overkropp eller underkropp. */
export type BodyCrop = 'full' | 'upper' | 'lower';
const VIEWBOX: Record<BodyCrop, [number, number, number, number]> = {
  full: [0, 0, 100, 220],
  upper: [0, 0, 100, 122],
  lower: [0, 92, 100, 128],
};

/** Én side av figuren (forfra eller bakfra) med brukte muskler farget. */
export function BodyFigure({
  side,
  load,
  height,
  crop = 'full',
}: {
  side: 'front' | 'back';
  load: MuscleLoad;
  height: number;
  crop?: BodyCrop;
}) {
  const theme = useTheme();
  const idle = theme.background === '#FFFFFF' ? '#D9DCE1' : '#3A3F47';
  const [x, y, w, h] = VIEWBOX[crop];
  const map = side === 'front' ? FRONT : BACK;
  return (
    <Svg width={(height * w) / h} height={height} viewBox={`${x} ${y} ${w} ${h}`}>
      <Body fill={theme.backgroundSelected} />
      {Object.entries(map).flatMap(([muscle, shapes]) => {
        const role = load.get(muscle);
        const fill = role === 'PRIMARY' ? MUSCLE_PRIMARY : role === 'SECONDARY' ? MUSCLE_SECONDARY : idle;
        return shapes.map((s, i) => renderShape(s, fill, `${muscle}-${i}`));
      })}
    </Svg>
  );
}

function Side({ side, load, height, label }: { side: 'front' | 'back'; load: MuscleLoad; height: number; label: string }) {
  return (
    <View style={styles.side}>
      <BodyFigure side={side} load={load} height={height} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Muskelkart forfra og bakfra. */
export function BodyMap({ load, height = 200 }: { load: MuscleLoad; height?: number }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Muskler brukt: ${[...load.keys()].join(', ').toLowerCase() || 'ingen'}`}>
      <Side side="front" load={load} height={height} label="Forfra" />
      <Side side="back" load={load} height={height} label="Bakfra" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  side: { alignItems: 'center', gap: 4 },
});
