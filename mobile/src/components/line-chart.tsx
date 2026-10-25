import { useState } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Point = { date: string; value: number };

/**
 * Enkel linjegraf for én serie: 2 px linje, markører med ring i bakgrunnsfargen, diskrete
 * rutenettlinjer og akseverdier i tekstfarge. Trykk i grafen for å se verdien for nærmeste punkt.
 * Tittelen over grafen navngir serien, så det trengs ingen tegnforklaring.
 * `area` fyller svakt under linjen og starter y-aksen på 0 (for summer som varighet og volum).
 * Med mange punkter vises bare markøren for valgt punkt, så linjen ikke drukner i prikker.
 */
export function LineChart({
  points,
  height = 200,
  format,
  formatDate,
  formatAxis = (v) => String(Math.round(v)),
  area = false,
  noun = 'økter',
}: {
  points: Point[];
  height?: number;
  format: (v: number) => string;
  formatDate: (iso: string) => string;
  formatAxis?: (v: number) => string;
  area?: boolean;
  /** Hva punktene er, for skjermleseren («økter», «uker», «målinger»). */
  noun?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const pad = { left: 44, right: 12, top: 16, bottom: 24 };
  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.1);
  const min = area ? 0 : Math.max(0, rawMin - span * 0.15);
  const max = area ? Math.max(rawMax * 1.15, 1) : rawMax + span * 0.15;
  const showMarkers = points.length <= 16;
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - ((v - min) / (max - min)) * plotH;
  const ticks = [min, (min + max) / 2, max];

  const onPress = (e: GestureResponderEvent) => {
    const px = e.nativeEvent.locationX;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setSelected(best === selected ? null : best);
  };

  const last = points[points.length - 1];
  const sel = selected !== null ? points[selected] : null;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Graf med ${points.length} ${noun}. Siste: ${format(last.value)}. Høyeste: ${format(rawMax)}.`}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.readout}>
        {sel ? `${formatDate(sel.date)}: ${format(sel.value)}` : `Trykk i grafen for å se en verdi`}
      </ThemedText>
      <Pressable onPress={onPress}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map((t, i) => (
              <Line key={i} x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={theme.backgroundSelected} strokeWidth={1} />
            ))}
            {ticks.map((t, i) => (
              <SvgText key={`l${i}`} x={pad.left - 6} y={y(t) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                {formatAxis(t)}
              </SvgText>
            ))}
            {area && points.length > 1 && (
              <Path
                d={`M${x(0)},${y(min)} ${points.map((p, i) => `L${x(i)},${y(p.value)}`).join(' ')} L${x(points.length - 1)},${y(min)} Z`}
                fill={theme.accent}
                fillOpacity={0.12}
              />
            )}
            {points.length > 1 && (
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={theme.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {sel && selected !== null && (
              <Line x1={x(selected)} x2={x(selected)} y1={pad.top} y2={pad.top + plotH} stroke={theme.textSecondary} strokeWidth={1} strokeDasharray="3 3" />
            )}
            {points.map((p, i) => (showMarkers || selected === i) && (
              <Circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={selected === i ? 6 : 4}
                fill={theme.accent}
                stroke={theme.background}
                strokeWidth={2}
              />
            ))}
            <SvgText x={pad.left} y={height - 6} fontSize={11} fill={theme.textSecondary}>
              {formatDate(points[0].date)}
            </SvgText>
            {points.length > 1 && (
              <SvgText x={width - pad.right} y={height - 6} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                {formatDate(last.date)}
              </SvgText>
            )}
          </Svg>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: 4, minHeight: 20 },
});
