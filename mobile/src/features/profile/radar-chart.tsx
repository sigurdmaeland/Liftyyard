import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, TSpan, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type Axis = { label: string; value: number };

/**
 * Radardiagram (edderkoppdiagram) for én serie: hver akse er en muskelgruppe, og avstanden fra
 * midten er verdien relativt til den største. Verdien står ved siden av navnet på hver akse,
 * så diagrammet kan leses uten å trykke.
 */
export function RadarChart({ axes, format, size = 280 }: { axes: Axis[]; format: (v: number) => string; size?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...axes.map((a) => a.value));
  const w = width || size;
  const cx = w / 2;
  const cy = size / 2;
  const r = Math.min(w, size) / 2 - 44;
  const angle = (i: number) => -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
  const point = (i: number, f: number) => [cx + Math.cos(angle(i)) * r * f, cy + Math.sin(angle(i)) * r * f] as const;
  const ring = (f: number) => axes.map((_, i) => point(i, f).join(',')).join(' ');
  const hasData = axes.some((a) => a.value > 0);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.wrap}
      accessible
      accessibilityLabel={`Muskelfordeling: ${axes.map((a) => `${a.label} ${format(a.value)}`).join(', ')}`}>
      <Svg width={w} height={size}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none" stroke={theme.backgroundSelected} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, 1);
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={theme.backgroundSelected} strokeWidth={1} />;
        })}
        {hasData && (
          <Polygon
            points={axes.map((a, i) => point(i, a.value / max).join(',')).join(' ')}
            fill={theme.accent}
            fillOpacity={0.18}
            stroke={theme.accent}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {hasData &&
          axes.map((a, i) => {
            const [x, y] = point(i, a.value / max);
            return <Circle key={i} cx={x} cy={y} r={4} fill={theme.accent} stroke={theme.card} strokeWidth={2} />;
          })}
        {axes.map((a, i) => {
          const [x, y] = point(i, 1.18);
          const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
          return (
            <SvgText key={i} x={x} y={y} textAnchor={anchor} fontSize={13} fontWeight="600" fill={theme.text}>
              {a.label}
              <TSpan x={x} dy={15} fontSize={12} fontWeight="500" fill={theme.textSecondary}>
                {format(a.value)}
              </TSpan>
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
