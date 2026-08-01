import type { TextStyle } from 'react-native';

export const colors = {
  tinta: '#F7F4EE',
  panel: '#FFFFFF',
  crema: '#12151A',
  arena: '#D97757',
  gris: '#8A93A0',
  border: '#E8E3DA',
  chip: '#EFEBE2',
  faint: '#C4CBD3',
  error: '#C0392B',
  success: '#4A7C59',
} as const;

export const fonts = {
  archivo: {
    bold: 'Archivo_700Bold',
    semibold: 'Archivo_600SemiBold',
    // system fallback when custom fonts aren't loaded yet
    fallback: 'System',
  },
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
    fallback: 'monospace',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const text = {
  h1: {
    fontFamily: fonts.archivo.bold,
    fontSize: 28,
    color: colors.crema,
    lineHeight: 34,
  } as TextStyle,
  h2: {
    fontFamily: fonts.archivo.bold,
    fontSize: 22,
    color: colors.crema,
    lineHeight: 28,
  } as TextStyle,
  h3: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 17,
    color: colors.crema,
    lineHeight: 24,
  } as TextStyle,
  body: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 15,
    color: colors.crema,
    lineHeight: 22,
  } as TextStyle,
  bodyGris: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 15,
    color: colors.gris,
    lineHeight: 22,
  } as TextStyle,
  small: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.crema,
    lineHeight: 18,
  } as TextStyle,
  label: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: colors.gris,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  } as TextStyle,
  labelArena: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: colors.arena,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  } as TextStyle,
  mono: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.gris,
    lineHeight: 18,
  } as TextStyle,
  monoSm: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: colors.gris,
    lineHeight: 16,
  } as TextStyle,
};
