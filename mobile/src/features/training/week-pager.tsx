import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, View } from 'react-native';

import { WeekStrip } from '@/features/training/week-strip';
import { startOfWeek } from '@/lib/stats';

const WEEKS_BACK = 104;

/**
 * Ukestripe som kan dras sidelengs mellom uker (to år bakover, ikke forbi inneværende uke).
 * Starter på uken til `selected`.
 */
export function WeekPager({
  trainedDays,
  selected,
  onSelect,
  today,
}: {
  trainedDays: Set<string>;
  selected: Date;
  onSelect: (d: Date) => void;
  today: Date;
}) {
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Date>>(null);
  const todayKey = today.toDateString();
  const weeks = useMemo(() => {
    const current = startOfWeek(new Date(todayKey));
    return Array.from({ length: WEEKS_BACK + 1 }, (_, i) => {
      const d = new Date(current);
      d.setDate(d.getDate() - (WEEKS_BACK - i) * 7);
      return d;
    });
    // Ukene regnes ut fra dagens dato, én gang per dag.
  }, [todayKey]);

  const selectedWeek = startOfWeek(selected).getTime();
  const initialIndex = Math.max(0, weeks.findIndex((w) => w.getTime() === selectedWeek));

  // Følg med når valgt dag endres utenfra (f.eks. «gå til i dag»).
  useEffect(() => {
    if (width > 0) list.current?.scrollToIndex({ index: initialIndex, animated: true });
  }, [initialIndex, width]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const weekStart = weeks[index];
    if (!weekStart || weekStart.getTime() === selectedWeek) return;
    // Velg samme ukedag i den nye uken, men aldri en dag i fremtiden.
    const dayOffset = (selected.getDay() + 6) % 7;
    const next = new Date(weekStart);
    next.setDate(next.getDate() + dayOffset);
    onSelect(next.getTime() > today.getTime() ? today : next);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          ref={list}
          data={weeks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(w) => w.toISOString()}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <WeekStrip weekStart={item} trainedDays={trainedDays} selected={selected} onSelect={onSelect} today={today} />
            </View>
          )}
        />
      )}
    </View>
  );
}
