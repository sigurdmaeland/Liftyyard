import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** Minigraf uten akser: bare utviklingen, med siste verdi markert. Trenger minst to punkter. */
export function Sparkline({ values, width = 72, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const theme = useTheme();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const last = values.length - 1;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke={theme.accent}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={x(last)} cy={y(values[last])} r={3.5} fill={theme.accent} stroke={theme.card} strokeWidth={1.5} />
    </Svg>
  );
}
