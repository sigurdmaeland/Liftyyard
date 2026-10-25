/**
 * Sentrale designverdier: farger, typografi, avstander og radius.
 * Alle skjermer og komponenter skal hente verdier herfra, ikke hardkode dem.
 * Paletten er foreløpig og byttes ut når merkevaren er bestemt.
 *
 * Universell utforming (WCAG 2.1 AA): tekst har minst 4,5:1 kontrast mot bakgrunnen, store
 * tekster og ikoner minst 3:1. «accent» er for tekst og ikoner, «accentFill» for flater med hvit
 * tekst. Bruk aldri farge alene for å vise tilstand – kombiner med ikon, tekst eller form.
 */
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0D10',
    textSecondary: '#5B616B',
    background: '#FFFFFF',
    backgroundElement: '#F2F3F5',
    backgroundSelected: '#E3E5E9',
    /** Grå bakgrunn bak hvite kort (som iOS «grouped»). */
    backgroundGrouped: '#F2F2F7',
    card: '#FFFFFF',
    /** Lys blågrå bakgrunn for fliser i Bibliotek. */
    tile: '#EEF2FB',
    accent: '#2A64F0',
    /** Bakgrunn for fylte knapper og merker med hvit tekst (kontrast minst 4,5:1 i begge moduser). */
    accentFill: '#2A64F0',
    success: '#18804A',
    /** Bakgrunn for fullførte sett med hvitt hake-symbol. */
    successFill: '#18804A',
    danger: '#D93636',
    /** Bakgrunn for røde merker med hvit tekst. */
    dangerFill: '#D93636',
  },
  /** Mørk modus: helsvart bakgrunn (som iOS og Lyfta, sparer strøm på OLED) med grå kort og skillelinjer. */
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A1A1A6',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    backgroundGrouped: '#000000',
    card: '#1C1C1E',
    tile: '#1C1F26',
    accent: '#6E9BFF',
    accentFill: '#2A64F0',
    success: '#3CCB7F',
    successFill: '#18804A',
    danger: '#FF6B6B',
    dangerFill: '#D93636',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

/**
 * Tekstskalaen appen bruker (punkt). Velg alltid en av disse:
 * 12 merker · 14 hjelpetekst · 16 brødtekst · 17 navn og knapper · 18 kort-titler · 20 tall og
 * underoverskrifter · 22 seksjoner · 24 store seksjoner · 28 skjermtitler · 34 hovedtitler.
 * ThemedText har ferdige typer: small, smallBold, default, heading, subtitle og title.
 */
export const TypeScale = [12, 14, 16, 17, 18, 20, 22, 24, 28, 34] as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 20,
} as const;

export const MaxContentWidth = 800;
