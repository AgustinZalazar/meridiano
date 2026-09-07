import type { TextStyle } from 'react-native';

export const colors = {
  tinta: '#F7F4EE',
  panel: '#FFFFFF',
  crema: '#12151A',
  arena: '#D97757',
  gris: '#6B6A65',
  border: '#E8E3DA',
  chip: '#EFEBE2',
  faint: '#C4CBD3',
  error: '#C04535',
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

// ─── Escala tipográfica canónica ──────────────────────────────────────────────
// Usar siempre estos 5 niveles. No introducir tamaños intermedios.
//
// display      28px · Archivo 700 · tracking -0.7   → heading de pantalla completa
// titulo       18px · Archivo 700 · tracking -0.3   → título de tarjeta, modal, sección
// cuerpo       15px · Archivo 600                   → texto principal en cards
// apoyo        13px · Archivo 600 · color gris       → fechas, subtítulos, texto secundario
// etiqueta     10px · Mono 400 · uppercase track 1.2 → labels de formulario, timestamps, códigos
//
// Para chips/badge/texto de botón pequeño: 11px Archivo 700 track 0.3 (inline).
// Para arena/crema override de color: aplicar directamente sobre los tokens de abajo.

export const typeScale = {
  display: {
    fontFamily: fonts.archivo.bold,
    fontSize: 28,
    letterSpacing: -0.7,
    lineHeight: 34,
    color: colors.crema,
  } as TextStyle,

  titulo: {
    fontFamily: fonts.archivo.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 24,
    color: colors.crema,
  } as TextStyle,

  cuerpo: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.crema,
  } as TextStyle,

  apoyo: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gris,
  } as TextStyle,

  etiqueta: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: colors.gris,
  } as TextStyle,
};
