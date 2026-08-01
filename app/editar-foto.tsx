import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Image, LayoutChangeEvent, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tool = 'markers' | 'dibujo';

interface Pt { x: number; y: number }

interface Marker {
  id: string;
  rx: number;
  ry: number;
  description: string;
}

interface Stroke {
  id: string;
  points: Pt[];
  color: string;
  width: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAW_COLORS = [
  { id: 'white', value: '#FFFFFF' },
  { id: 'terra', value: colors.arena },
  { id: 'red',   value: '#FF3B30' },
  { id: 'dark',  value: colors.crema },
];

const DRAW_WIDTHS = [
  { id: 'thin',  value: 3 },
  { id: 'thick', value: 7 },
];

// ─── Pure-RN stroke renderer (no native SVG dep) ─────────────────────────────

function StrokeLines({ points, color, width }: { points: Pt[]; color: string; width: number }) {
  return (
    <>
      {points.slice(1).map((pt, i) => {
        const prev = points[i];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) return null;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cx = (prev.x + pt.x) / 2;
        const cy = (prev.y + pt.y) / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: len,
              height: width,
              backgroundColor: color,
              borderRadius: width / 2,
              left: cx - len / 2,
              top: cy - width / 2,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditarFotoScreen() {
  const router = useRouter();
  const { uri, rubro } = useLocalSearchParams<{ uri: string; rubro: string }>();

  const [tool, setTool] = useState<Tool>('markers');
  const toolRef = useRef<Tool>('markers');
  useEffect(() => { toolRef.current = tool; }, [tool]);

  const [imgW, setImgW] = useState(1);
  const [imgH, setImgH] = useState(1);

  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [comment, setComment] = useState('');

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [drawWidth, setDrawWidth] = useState(DRAW_WIDTHS[0].value);
  const [livePoints, setLivePoints] = useState<Pt[]>([]);
  const liveRef = useRef<Pt[]>([]);
  const drawColorRef = useRef(drawColor);
  const drawWidthRef = useRef(drawWidth);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { drawWidthRef.current = drawWidth; }, [drawWidth]);

  const canAnalyze =
    (markers.length > 0 && markers.every((m) => m.description.trim().length > 0)) ||
    strokes.length > 0;

  function onImageLayout(e: LayoutChangeEvent) {
    setImgW(e.nativeEvent.layout.width);
    setImgH(e.nativeEvent.layout.height);
  }

  // ─── Touch responder ───────────────────────────────────────────────────────

  const photoResponder = {
    onStartShouldSetResponderCapture: () => toolRef.current === 'dibujo',
    onStartShouldSetResponder: () => true,

    onResponderGrant: (e: any) => {
      const { locationX, locationY } = e.nativeEvent;
      if (toolRef.current === 'markers') {
        const id = Date.now().toString();
        setMarkers((prev) => [...prev, { id, rx: locationX / imgW, ry: locationY / imgH, description: '' }]);
        setSelectedId(id);
      } else {
        liveRef.current = [{ x: locationX, y: locationY }];
        setLivePoints([{ x: locationX, y: locationY }]);
      }
    },

    onResponderMove: (e: any) => {
      if (toolRef.current !== 'dibujo') return;
      const { locationX, locationY } = e.nativeEvent;
      liveRef.current.push({ x: locationX, y: locationY });
      if (liveRef.current.length % 3 === 0) {
        setLivePoints([...liveRef.current]);
      }
    },

    onResponderRelease: () => {
      if (toolRef.current !== 'dibujo') return;
      const pts = liveRef.current;
      if (pts.length >= 2) {
        setStrokes((prev) => [
          ...prev,
          { id: Date.now().toString(), points: pts, color: drawColorRef.current, width: drawWidthRef.current },
        ]);
      }
      liveRef.current = [];
      setLivePoints([]);
    },
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  function removeMarker(id: string) {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateDescription(id: string, text: string) {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, description: text } : m)));
  }

  function undoStroke() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setMarkers([]);
    setStrokes([]);
    setSelectedId(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const fallback = 'https://picsum.photos/id/1048/800/600';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={18} color={colors.crema} />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <Text style={styles.topEyebrow}>{rubro ?? 'Rubro'}</Text>
            <Text style={styles.topTitle}>Anotar foto</Text>
          </View>
          <TouchableOpacity
            style={[styles.circleBtn, markers.length === 0 && strokes.length === 0 && styles.circleBtnDisabled]}
            onPress={clearAll}
            disabled={markers.length === 0 && strokes.length === 0}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={16} color={markers.length === 0 && strokes.length === 0 ? colors.faint : colors.crema} />
          </TouchableOpacity>
        </View>

        {/* Tool toggle */}
        <View style={styles.toolToggle}>
          <TouchableOpacity
            style={[styles.toolBtn, tool === 'markers' && styles.toolBtnActive]}
            onPress={() => setTool('markers')}
            activeOpacity={0.8}
          >
            <Feather name="map-pin" size={13} color={tool === 'markers' ? '#FFFFFF' : colors.gris} />
            <Text style={[styles.toolBtnText, tool === 'markers' && styles.toolBtnTextActive]}>Marcadores</Text>
            {markers.length > 0 && (
              <View style={[styles.toolBadge, tool === 'markers' && styles.toolBadgeActive]}>
                <Text style={[styles.toolBadgeText, tool === 'markers' && styles.toolBadgeTextActive]}>{markers.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, tool === 'dibujo' && styles.toolBtnActive]}
            onPress={() => setTool('dibujo')}
            activeOpacity={0.8}
          >
            <Feather name="edit-3" size={13} color={tool === 'dibujo' ? '#FFFFFF' : colors.gris} />
            <Text style={[styles.toolBtnText, tool === 'dibujo' && styles.toolBtnTextActive]}>Dibujo</Text>
            {strokes.length > 0 && (
              <View style={[styles.toolBadge, tool === 'dibujo' && styles.toolBadgeActive]}>
                <Text style={[styles.toolBadgeText, tool === 'dibujo' && styles.toolBadgeTextActive]}>{strokes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Photo + annotations */}
          <View style={styles.photoWrap} onLayout={onImageLayout} {...photoResponder}>
            <Image source={{ uri: uri ?? fallback }} style={styles.photo} resizeMode="cover" />

            {/* Drawing overlay — pure RN Views, no native SVG */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {strokes.map((s) => (
                <StrokeLines key={s.id} points={s.points} color={s.color} width={s.width} />
              ))}
              {livePoints.length >= 2 && (
                <StrokeLines points={livePoints} color={drawColor} width={drawWidth} />
              )}
            </View>

            {/* Numbered markers */}
            {markers.map((m, index) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.marker,
                  { left: m.rx * imgW - 15, top: m.ry * imgH - 15 },
                  selectedId === m.id && styles.markerSelected,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedId(m.id === selectedId ? null : m.id);
                }}
                onLongPress={(e) => {
                  e.stopPropagation();
                  removeMarker(m.id);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.markerText}>{index + 1}</Text>
              </TouchableOpacity>
            ))}

            {markers.length === 0 && strokes.length === 0 && livePoints.length === 0 && (
              <View style={styles.emptyOverlay} pointerEvents="none">
                <View style={styles.emptyPill}>
                  <Feather
                    name={tool === 'markers' ? 'plus-circle' : 'edit-3'}
                    size={13}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text style={styles.emptyPillText}>
                    {tool === 'markers' ? 'Toca para agregar marcador' : 'Dibujá sobre la foto'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Drawing toolbar */}
          {tool === 'dibujo' && (
            <View style={styles.drawToolbar}>
              <View style={styles.colorRow}>
                {DRAW_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.colorSwatch, { backgroundColor: c.value }, drawColor === c.value && styles.colorSwatchActive]}
                    onPress={() => setDrawColor(c.value)}
                    activeOpacity={0.8}
                  />
                ))}
                <View style={styles.drawToolDivider} />
                {DRAW_WIDTHS.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.widthBtn, drawWidth === w.value && styles.widthBtnActive]}
                    onPress={() => setDrawWidth(w.value)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.widthLine, { height: w.value, backgroundColor: drawWidth === w.value ? '#FFFFFF' : colors.gris }]} />
                  </TouchableOpacity>
                ))}
                <View style={styles.drawToolDivider} />
                <TouchableOpacity
                  style={[styles.undoBtn, strokes.length === 0 && styles.undoBtnDisabled]}
                  onPress={undoStroke}
                  disabled={strokes.length === 0}
                  activeOpacity={0.8}
                >
                  <Feather name="corner-left-up" size={15} color={strokes.length === 0 ? colors.faint : colors.crema} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Marker descriptions */}
          {tool === 'markers' && markers.length > 0 && (
            <View style={styles.markerList}>
              <Text style={styles.sectionLabel}>
                {markers.length} {markers.length === 1 ? 'MARCADOR' : 'MARCADORES'}
              </Text>
              {markers.map((m, index) => (
                <View key={m.id} style={[styles.markerRow, selectedId === m.id && styles.markerRowActive]}>
                  <TouchableOpacity
                    style={[styles.markerBadge, selectedId === m.id && styles.markerBadgeSelected]}
                    onPress={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.markerBadgeText}>{index + 1}</Text>
                  </TouchableOpacity>
                  <View style={styles.markerInputWrap}>
                    <TextInput
                      style={styles.inputText}
                      value={m.description}
                      onChangeText={(t) => updateDescription(m.id, t)}
                      placeholder="Describí el problema…"
                      placeholderTextColor={colors.faint}
                      onFocus={() => setSelectedId(m.id)}
                      selectionColor={colors.arena}
                      multiline
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => removeMarker(m.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color={colors.faint} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Comment */}
          <View style={styles.commentBlock}>
            <Text style={styles.sectionLabel}>COMENTARIO</Text>
            <View style={styles.commentField}>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Agregá una nota general sobre la foto…"
                placeholderTextColor={colors.faint}
                selectionColor={colors.arena}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaBlock}>
            {tool === 'markers' && markers.length > 0 && !markers.every((m) => m.description.trim().length > 0) && (
              <Text style={styles.ctaHint}>Describí todos los marcadores para continuar</Text>
            )}
            <TouchableOpacity
              style={[styles.btnPrimary, !canAnalyze && styles.btnPrimaryDisabled]}
              onPress={() => router.replace('/procesando?mode=foto')}
              disabled={!canAnalyze}
              activeOpacity={0.85}
            >
              <Feather name="zap" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Analizar con AI  →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSkip} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.btnSkipText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  circleBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  topCenter: { alignItems: 'center', gap: 1 },
  topEyebrow: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.gris },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.2 },

  toolToggle: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.chip, borderRadius: 24, padding: 4, gap: 4, marginBottom: spacing.sm,
  },
  toolBtn: {
    flex: 1, height: 40, borderRadius: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  toolBtnActive: { backgroundColor: colors.crema },
  toolBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.gris },
  toolBtnTextActive: { color: '#FFFFFF' },
  toolBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  toolBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  toolBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  toolBadgeTextActive: { color: '#FFFFFF' },

  scroll: { paddingBottom: 48, gap: spacing.lg },

  photoWrap: {
    marginHorizontal: spacing.xl, borderRadius: 24, overflow: 'hidden',
    backgroundColor: colors.chip, minHeight: 240,
  },
  photo: { width: '100%', aspectRatio: 4 / 3 },

  marker: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 7,
  },
  markerSelected: { backgroundColor: colors.arena, transform: [{ scale: 1.18 }] },
  markerText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },

  emptyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  emptyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(18,21,26,0.55)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  emptyPillText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: '#FFFFFF' },

  drawToolbar: {
    marginHorizontal: spacing.xl, backgroundColor: colors.panel, borderRadius: 18, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: colors.crema },
  drawToolDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },
  widthBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chip,
  },
  widthBtnActive: { backgroundColor: colors.crema },
  widthLine: { width: 16, borderRadius: 4 },
  undoBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chip,
  },
  undoBtnDisabled: {},

  markerList: { paddingHorizontal: spacing.xl, gap: 10 },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  markerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.panel, borderRadius: 18, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  markerRowActive: {
    borderWidth: 1.5, borderColor: colors.arena,
    shadowColor: colors.arena, shadowOpacity: 0.10, shadowRadius: 12,
  },
  markerBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  markerBadgeSelected: { backgroundColor: colors.arena },
  markerBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },
  markerInputWrap: { flex: 1 },
  inputText: { fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.crema, lineHeight: 20, minHeight: 36 },

  commentBlock: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  commentField: {
    backgroundColor: colors.panel, borderRadius: 18, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  commentInput: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.crema,
    lineHeight: 20, minHeight: 60,
  },

  ctaBlock: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  ctaHint: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 0.3,
    color: colors.faint, textAlign: 'center', textTransform: 'uppercase',
  },
  btnPrimary: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryDisabled: { backgroundColor: colors.faint },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  btnSkip: { height: 44, alignItems: 'center', justifyContent: 'center' },
  btnSkipText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris, textDecorationLine: 'underline' },
});
