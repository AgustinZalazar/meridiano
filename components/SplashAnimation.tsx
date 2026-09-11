import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { colors, fonts } from '../constants/theme';

// ── Screen dimensions ─────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2;

// ── Logo geometry (screen coords) ─────────────────────────────────────────────
// L-shape: corner (bottom-right of L), left end, top end
const CORNER   = { x: CX + 28, y: CY - 5  };
const LEFT_END = { x: CX - 28, y: CY - 5  };
const TOP_END  = { x: CX + 28, y: CY - 65 };
const ARM_LEN_H = CORNER.x - LEFT_END.x; // 56px
const ARM_LEN_V = CORNER.y - TOP_END.y;  // 60px
const ARM_W  = 5;
const DOT_R  = 6;
const DASH_R = 2.5;

// ── Diagonal dots (arena dashes from LEFT_END → TOP_END) ─────────────────────
const _DX  = TOP_END.x - LEFT_END.x;
const _DY  = TOP_END.y - LEFT_END.y;
const _LEN = Math.sqrt(_DX * _DX + _DY * _DY);
const _UX  = _DX / _LEN;
const _UY  = _DY / _LEN;

const DIAG_DOTS: { x: number; y: number }[] = [];
for (let t = 8; t < _LEN - 4; t += 11) {
  DIAG_DOTS.push({
    x: LEFT_END.x + _UX * t - DASH_R,
    y: LEFT_END.y + _UY * t - DASH_R,
  });
}

// ── Grid lines ────────────────────────────────────────────────────────────────
const GRID_STEP = 48;
const MAJOR_MOD = 192;

interface LineData {
  horiz: boolean;
  pos: number;
  major: boolean;
  d: number; // 0 = center, 1 = edge
}

const GRID_LINES: LineData[] = [];
for (let y = 0; y <= SH; y += GRID_STEP) {
  GRID_LINES.push({ horiz: true,  pos: y, major: y % MAJOR_MOD === 0, d: Math.abs(y - CY) / CY });
}
for (let x = 0; x <= SW; x += GRID_STEP) {
  GRID_LINES.push({ horiz: false, pos: x, major: x % MAJOR_MOD === 0, d: Math.abs(x - CX) / CX });
}

// ── Timing (ms) ──────────────────────────────────────────────────────────────
const TM = {
  markEnd:    220,
  gridWaveOff: 80,
  gridWaveLen: 620,
  lineDraw:    460,
  armsStart:  1050, armsEnd:  1400,
  dotsStart:  1360, dotsEnd:  1520,
  dashStart:  1460, dashEnd:  1940,
  textStart:  1860, textEnd:  2240,
  gridFadeS:  1620, gridFadeE: 2420,
  minShow:    2600,
  clock:      5000, // total clock duration
};

// ── Worklet helpers ───────────────────────────────────────────────────────────
function eOut(t: number) {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}
function eIO(t: number) {
  'worklet';
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function prg(t: number, s: number, e: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - s) / (e - s)));
}

// ── Sub-components ────────────────────────────────────────────────────────────
function GridLine({ horiz, pos, major, d, clock }: LineData & { clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const start = TM.gridWaveOff + (1 - d) * TM.gridWaveLen;
    const p     = eOut(prg(clock.value, start, start + TM.lineDraw));
    const fade  = 1 - eOut(prg(clock.value, TM.gridFadeS, TM.gridFadeE));
    const alpha = (major ? 0.14 : 0.07) * fade;
    return horiz
      ? { width: SW * p, opacity: alpha }
      : { height: SH * p, opacity: alpha };
  });

  const baseStyle = horiz
    ? { position: 'absolute' as const, left: 0, top: pos, height: major ? 1 : StyleSheet.hairlineWidth, backgroundColor: colors.crema }
    : { position: 'absolute' as const, top: 0,  left: pos, width:  major ? 1 : StyleSheet.hairlineWidth, backgroundColor: colors.crema };

  return <Animated.View style={[baseStyle, style]} />;
}

function CornerMark({ ox, oy, sx, sy, clock }: { ox:number; oy:number; sx:number; sy:number; clock: SharedValue<number> }) {
  const leg = 16;
  const style = useAnimatedStyle(() => {
    const appear = eOut(prg(clock.value, 0, TM.markEnd));
    const fade   = 1 - eOut(prg(clock.value, TM.gridFadeS, TM.gridFadeE));
    return { opacity: appear * fade * 0.3 };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: ox, top: oy }, style]}>
      <View style={{ position: 'absolute', left: sx > 0 ? 0 : -leg, top: 0, width: leg, height: 1, backgroundColor: colors.crema }} />
      <View style={{ position: 'absolute', left: 0, top: sy > 0 ? 0 : -leg, width: 1, height: leg, backgroundColor: colors.crema }} />
    </Animated.View>
  );
}

function HorizArm({ clock }: { clock: SharedValue<number> }) {
  // Anchor the RIGHT edge at CORNER.x; grow leftward via translateX
  const style = useAnimatedStyle(() => {
    const w = ARM_LEN_H * eOut(prg(clock.value, TM.armsStart, TM.armsEnd));
    return { width: w, transform: [{ translateX: -w }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: CORNER.x,
      top: CORNER.y - ARM_W / 2,
      height: ARM_W,
      backgroundColor: colors.crema,
    }, style]} />
  );
}

function VertArm({ clock }: { clock: SharedValue<number> }) {
  // Anchor the BOTTOM edge at CORNER.y; grow upward via translateY
  const style = useAnimatedStyle(() => {
    const h = ARM_LEN_V * eOut(prg(clock.value, TM.armsStart, TM.armsEnd));
    return { height: h, transform: [{ translateY: -h }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: CORNER.x - ARM_W / 2,
      top: CORNER.y,
      width: ARM_W,
      backgroundColor: colors.crema,
    }, style]} />
  );
}

function EndDot({ pos, clock }: { pos: {x:number; y:number}; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = eOut(prg(clock.value, TM.dotsStart, TM.dotsEnd));
    return { opacity: p, transform: [{ scale: p }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: pos.x - DOT_R,
      top:  pos.y - DOT_R,
      width: DOT_R * 2,
      height: DOT_R * 2,
      borderRadius: DOT_R,
      backgroundColor: colors.crema,
    }, style]} />
  );
}

function DiagDot({ pos, index, clock }: { pos: {x:number; y:number}; index: number; clock: SharedValue<number> }) {
  const total    = DIAG_DOTS.length;
  const dotStart = TM.dashStart + (index / total) * (TM.dashEnd - TM.dashStart);
  const dotEnd   = dotStart + (TM.dashEnd - TM.dashStart) / total + 80;

  const style = useAnimatedStyle(() => {
    const p = eOut(prg(clock.value, dotStart, dotEnd));
    return { opacity: p, transform: [{ scale: p }] };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: pos.x,
      top:  pos.y,
      width: DASH_R * 2,
      height: DASH_R * 2,
      borderRadius: DASH_R,
      backgroundColor: colors.arena,
    }, style]} />
  );
}

function LogoText({ clock }: { clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: eOut(prg(clock.value, TM.textStart, TM.textEnd)),
  }));
  const textTop = CORNER.y + DOT_R + 14;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: textTop, alignItems: 'center' }, style]}>
      <Text style={{ fontFamily: fonts.archivo.bold, fontSize: 28, color: colors.crema, letterSpacing: -0.5 }}>
        MERIDIANO
      </Text>
      <View style={{ width: 36, height: 1.5, backgroundColor: colors.arena, marginTop: 10, borderRadius: 1 }} />
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 2, marginTop: 10, textTransform: 'uppercase' }}>
        Gestión de obras
      </Text>
    </Animated.View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  isReady: boolean;
  onDone: () => void;
}

export function SplashAnimation({ isReady, onDone }: Props) {
  const clock      = useSharedValue(0);
  const exitAlpha  = useSharedValue(1);
  const mountTime  = useRef(Date.now());
  const mounted    = useRef(true);

  useEffect(() => {
    clock.value = withTiming(TM.clock, { duration: TM.clock, easing: Easing.linear });
    return () => { mounted.current = false; };
  }, []);

  const handleDone = useCallback(() => {
    if (mounted.current) onDone();
  }, [onDone]);

  useEffect(() => {
    if (!isReady) return;
    const elapsed  = Date.now() - mountTime.current;
    const waitMore = Math.max(0, TM.minShow - elapsed);
    const timer = setTimeout(() => {
      exitAlpha.value = withTiming(0, { duration: 500 }, () => {
        runOnJS(handleDone)();
      });
    }, waitMore);
    return () => clearTimeout(timer);
  }, [isReady, handleDone]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: exitAlpha.value }));

  const inset = 20;
  const corners = [
    { ox: inset,    oy: inset,    sx:  1, sy:  1 },
    { ox: SW-inset, oy: inset,    sx: -1, sy:  1 },
    { ox: inset,    oy: SH-inset, sx:  1, sy: -1 },
    { ox: SW-inset, oy: SH-inset, sx: -1, sy: -1 },
  ] as const;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tinta, zIndex: 999 }, containerStyle]}>
      {GRID_LINES.map((ln, i) => (
        <GridLine key={`g${i}`} {...ln} clock={clock} />
      ))}
      {corners.map((c, i) => (
        <CornerMark key={`m${i}`} {...c} clock={clock} />
      ))}
      <HorizArm clock={clock} />
      <VertArm  clock={clock} />
      <EndDot pos={LEFT_END} clock={clock} />
      <EndDot pos={TOP_END}  clock={clock} />
      {DIAG_DOTS.map((pos, i) => (
        <DiagDot key={`dd${i}`} pos={pos} index={i} clock={clock} />
      ))}
      <LogoText clock={clock} />
    </Animated.View>
  );
}
