import { type ReactNode, useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Lar innholdet «sprette» kort når `trigger` endres til true (f.eks. liker eller fullført sett).
 * Ingen animasjon når «Reduser bevegelse» er på.
 */
export function Pop({ trigger, children }: { trigger: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(trigger);
  useEffect(() => {
    if (trigger && !previous.current && !reduce) {
      scale.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 220 }));
    }
    previous.current = trigger;
  }, [trigger, reduce, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
