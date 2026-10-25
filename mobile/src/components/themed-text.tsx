import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'heading' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

/**
 * Tekst med temafarge. Store titler markeres som overskrifter for skjermlesere, og all tekst
 * følger brukerens tekststørrelse (Dynamic Type), begrenset til 2× for at oppsettet skal holde.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const header = type === 'title' || type === 'subtitle' || type === 'heading' ? { accessibilityRole: 'header' as const } : {};

  return <Text maxFontSizeMultiplier={2} {...header} style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: 800,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  heading: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
