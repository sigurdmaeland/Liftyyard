import Svg, { Path, Rect } from 'react-native-svg';

/**
 * Liftyard-logoen: en Y der armene løfter en vektstang. Samme tegning som app-ikonet
 * (kilde: assets/brand/liftyard-mark.svg). Dekorativ som standard; gi `label` når logoen står alene.
 */
export function LiftyardMark({
  size = 48,
  color,
  barColor = color,
  label,
}: {
  size?: number;
  /** Farge på Y-en (og stangen hvis barColor ikke er satt). */
  color: string;
  /** Egen farge på vektstangen og skivene, f.eks. blått i den svarte varianten. */
  barColor?: string;
  label?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 3 100 100"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
      <Path d="M15 27H85" stroke={barColor} strokeWidth={6} strokeLinecap="round" />
      <Rect x={6} y={14} width={9} height={26} rx={3} fill={barColor} />
      <Rect x={85} y={14} width={9} height={26} rx={3} fill={barColor} />
      <Path d="M33 37L50 59L67 37M50 59V86" stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
