import { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../constants/theme';

export const ONBOARDING_KEY = 'meridiano_onboarding_v1';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 72, 300);
const CARD_H = Math.round(CARD_W * 1.12);

// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'grab',
    num: '01 / 04',
    accent: '#D97757',
    title: 'Grabá tu\nrecorrido',
    body: 'Filmá video o tomá fotos mientras recorrés la obra. Sin formularios ni burocracia.',
  },
  {
    key: 'ai',
    num: '02 / 04',
    accent: '#5A8DEE',
    title: 'De tu voz\nal informe',
    body: 'Describí los problemas mientras grabás. La IA transcribe y genera el informe automáticamente.',
  },
  {
    key: 'pending',
    num: '03 / 04',
    accent: '#4A7C59',
    title: 'Pendientes\norganizados',
    body: 'Seguí el estado de cada ítem por rubro, gremio y responsable. Todo en un lugar.',
  },
  {
    key: 'start',
    num: '04 / 04',
    accent: '#12151A',
    title: 'Listo para\nempezar',
    body: 'Creá tu primer proyecto y empezá a documentar tu obra hoy mismo.',
  },
] as const;

type Slide = (typeof SLIDES)[number];

// ─── Illustrations ─────────────────────────────────────────────────────────────
//
// Each renders a scaled-down version of the actual app screen it represents.

const CAM_H = Math.round(CARD_H * 0.60);
const INFO_H = CARD_H - CAM_H;

function GrabMockup() {
  return (
    <View style={[mock.card, { width: CARD_W, height: CARD_H }]}>
      {/* ── Camera viewfinder area ── */}
      <View style={[mock.camView, { height: CAM_H }]}>
        {/* Top bar */}
        <View style={mock.camTopBar}>
          <View style={mock.recPill}>
            <View style={mock.recDot} />
            <Text style={mock.recText}>REC  00:42</Text>
          </View>
          <Text style={mock.camTimer}>1080p</Text>
        </View>

        {/* Grid lines */}
        <View style={[mock.vfLine, mock.vfH, { top: '33%' }]} />
        <View style={[mock.vfLine, mock.vfH, { top: '66%' }]} />
        <View style={[mock.vfLine, mock.vfV, { left: '33%' }]} />
        <View style={[mock.vfLine, mock.vfV, { left: '66%' }]} />

        {/* Focus brackets */}
        <View style={[mock.fb, { top: '30%', left: '30%', borderTopWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[mock.fb, { top: '30%', right: '30%', borderTopWidth: 2, borderRightWidth: 2 }]} />
        <View style={[mock.fb, { bottom: '30%', left: '30%', borderBottomWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[mock.fb, { bottom: '30%', right: '30%', borderBottomWidth: 2, borderRightWidth: 2 }]} />

        {/* Controls */}
        <View style={mock.camControls}>
          <View style={mock.camSideBtn}>
            <Feather name="image" size={14} color="rgba(255,255,255,0.65)" />
          </View>
          <View style={mock.camRecBtn}>
            <View style={mock.camRecBtnInner} />
          </View>
          <View style={mock.camSideBtn}>
            <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.65)" />
          </View>
        </View>
      </View>

      {/* ── Info strip ── */}
      <View style={[mock.infoStrip, { height: INFO_H }]}>
        <View style={mock.infoRow}>
          <Feather name="map-pin" size={11} color={colors.arena} />
          <Text style={mock.infoTitle} numberOfLines={1}>Edificio Palermo Norte</Text>
        </View>
        <View style={mock.infoChips}>
          <View style={mock.chip}>
            <Text style={mock.chipText}>Inst. Eléctricas</Text>
          </View>
          <View style={[mock.chip, { backgroundColor: 'rgba(217,119,87,0.12)' }]}>
            <Text style={[mock.chipText, { color: colors.arena }]}>Contratistas</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const AI_BLUE = '#5A8DEE';

function AIMockup() {
  const HDR_H = 44;
  const TRANSCRIPT_H = Math.round(CARD_H * 0.38);
  const PLAYER_H = 40;
  const ITEMS_H = CARD_H - HDR_H - 1 - TRANSCRIPT_H - 1 - PLAYER_H - 1;

  const pendingItems = [
    'Fisura en muro del subsuelo',
    'Revisión instalación eléctrica',
  ];

  return (
    <View style={[mock.card, { width: CARD_W, height: CARD_H }]}>
      {/* Header */}
      <View style={[mock.cardHeader, { height: HDR_H }]}>
        <View style={mock.cardHeaderLeft}>
          <Feather name="mic" size={13} color={AI_BLUE} />
          <Text style={mock.cardHeaderTitle}>TRANSCRIPCIÓN</Text>
        </View>
        <View style={[mock.badge, { backgroundColor: 'rgba(90,141,238,0.13)' }]}>
          <View style={[mock.badgeDot, { backgroundColor: AI_BLUE }]} />
          <Text style={[mock.badgeText, { color: AI_BLUE }]}>En proceso</Text>
        </View>
      </View>
      <View style={mock.divider} />

      {/* Transcript bubble */}
      <View style={[mock.transcriptArea, { height: TRANSCRIPT_H }]}>
        <View style={mock.transcriptBubble}>
          <Text style={mock.transcriptText}>
            {"\"...hay una fisura en el muro del subsuelo, también revisá la instalación eléctrica del tablero...\""}
          </Text>
        </View>
        {/* Waveform bars */}
        <View style={mock.waveform}>
          {[6,14,9,20,12,18,8,16,11,20,7,15,10,18,6].map((h, i) => (
            <View
              key={i}
              style={[
                mock.waveBar,
                {
                  height: h,
                  backgroundColor: i < 9 ? AI_BLUE : AI_BLUE + '35',
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={mock.divider} />

      {/* Audio player bar */}
      <View style={[mock.playerBar, { height: PLAYER_H }]}>
        <View style={[mock.playerPlay, { backgroundColor: AI_BLUE }]}>
          <Feather name="pause" size={10} color="#FFF" />
        </View>
        <View style={mock.playerTrack}>
          <View style={[mock.playerFill, { backgroundColor: AI_BLUE }]} />
        </View>
        <Text style={mock.playerTime}>01:14</Text>
      </View>
      <View style={mock.divider} />

      {/* Extracted pending items */}
      <View style={[mock.aiResults, { flex: 1 }]}>
        <Text style={mock.aiResultsLabel}>PENDIENTES GENERADOS</Text>
        {pendingItems.map((item, i) => (
          <View key={i} style={mock.aiItem}>
            <View style={[mock.aiItemDot, { backgroundColor: AI_BLUE + '20' }]}>
              <Feather name="zap" size={9} color={AI_BLUE} />
            </View>
            <Text style={mock.aiItemText} numberOfLines={1}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PendingMockup() {
  const HDR_H = 48;
  const TAB_H = 38;
  const items = [
    { label: 'Cimentación revisada', trade: 'Estructura', status: 'done',    color: '#4A7C59' },
    { label: 'Instalación eléctrica', trade: 'Electricidad', status: 'open',  color: colors.arena },
    { label: 'Revestimiento fachada', trade: 'Albañilería', status: 'review', color: '#5A8DEE' },
  ];
  const statusIcon: Record<string, React.ComponentProps<typeof Feather>['name']> = {
    done: 'check', open: 'alert-circle', review: 'clock',
  };

  return (
    <View style={[mock.card, { width: CARD_W, height: CARD_H }]}>
      {/* Header */}
      <View style={[mock.cardHeader, { height: HDR_H }]}>
        <Text style={mock.cardHeaderTitle}>Pendientes</Text>
        <View style={[mock.badge, { backgroundColor: colors.arena }]}>
          <Text style={[mock.badgeText, { color: '#FFF' }]}>5</Text>
        </View>
      </View>
      <View style={mock.divider} />

      {/* Tab toggle */}
      <View style={[mock.tabRow, { height: TAB_H }]}>
        <View style={[mock.tabItem, mock.tabActive]}>
          <Feather name="tool" size={11} color="#FFF" />
          <Text style={[mock.tabText, mock.tabTextActive]}>Contratistas</Text>
        </View>
        <View style={mock.tabItem}>
          <Feather name="briefcase" size={11} color={colors.gris} />
          <Text style={mock.tabText}>Oficina</Text>
        </View>
      </View>
      <View style={mock.divider} />

      {/* List items */}
      {items.map((item, i) => (
        <View key={i} style={[mock.listItem, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <View style={[mock.listDot, { backgroundColor: item.color + '22' }]}>
            <View style={[mock.listDotInner, { backgroundColor: item.color }]} />
          </View>
          <View style={mock.listBody}>
            <Text style={mock.listTitle} numberOfLines={1}>{item.label}</Text>
            <Text style={mock.listSub}>{item.trade}</Text>
          </View>
          <View style={[mock.listStatusIcon, { backgroundColor: item.color + '18' }]}>
            <Feather name={statusIcon[item.status]} size={11} color={item.color} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StartMockup() {
  const HDR_H = 52;
  const projects = [
    { name: 'Edificio Palermo Norte', rubros: '3 rubros', color: colors.arena, status: 'En curso' },
    { name: 'Casa Rural Tigre',       rubros: '1 rubro',  color: '#5A8DEE',   status: 'Sin iniciar' },
  ];

  return (
    <View style={[mock.card, { width: CARD_W, height: CARD_H }]}>
      {/* App header */}
      <View style={[mock.appHeader, { height: HDR_H }]}>
        <View style={mock.appLogo}>
          <Text style={mock.appLogoText}>M</Text>
        </View>
        <Text style={mock.appTitle}>Meridiano</Text>
        <View style={mock.appAddBtn}>
          <Feather name="plus" size={14} color="#FFF" />
        </View>
      </View>
      <View style={mock.divider} />

      {/* Project cards */}
      {projects.map((p, i) => (
        <View key={i}>
          <View style={mock.projectCard}>
            <View style={[mock.projectStripe, { backgroundColor: p.color }]} />
            <View style={mock.projectBody}>
              <Text style={mock.projectName} numberOfLines={1}>{p.name}</Text>
              <View style={mock.projectMeta}>
                <Text style={mock.projectSub}>{p.rubros}</Text>
                <View style={[mock.chip, { backgroundColor: p.color + '18' }]}>
                  <Text style={[mock.chipText, { color: p.color }]}>{p.status}</Text>
                </View>
              </View>
            </View>
            <Feather name="chevron-right" size={14} color={colors.faint} />
          </View>
          <View style={mock.divider} />
        </View>
      ))}

      {/* Add button */}
      <View style={mock.addRow}>
        <View style={mock.addBtn}>
          <Feather name="plus" size={13} color={colors.crema} />
        </View>
        <Text style={mock.addLabel}>Nuevo proyecto</Text>
      </View>
    </View>
  );
}

function SlideIllustration({ slide }: { slide: Slide }) {
  switch (slide.key) {
    case 'grab':    return <GrabMockup />;
    case 'ai':      return <AIMockup />;
    case 'pending': return <PendingMockup />;
    case 'start':   return <StartMockup />;
  }
}

// ─── Slide ────────────────────────────────────────────────────────────────────

function SlideItem({ slide }: { slide: Slide }) {
  return (
    <View style={[s.slide, { width: SCREEN_W }]}>
      <View style={s.illustrationWrap}>
        <SlideIllustration slide={slide} />
      </View>
      <View style={s.textBlock}>
        <Text style={[s.slideNum, { color: slide.accent }]}>{slide.num}</Text>
        <Text style={s.slideTitle}>{slide.title}</Text>
        <Text style={s.slideBody}>{slide.body}</Text>
      </View>
    </View>
  );
}

// ─── Dot ──────────────────────────────────────────────────────────────────────

function Dot({ active, accent }: { active: boolean; accent: string }) {
  return (
    <View
      style={[
        s.dot,
        active
          ? { width: 24, backgroundColor: accent }
          : { width: 8, backgroundColor: colors.chip },
      ]}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLast = currentIndex === SLIDES.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0] != null) setCurrentIndex(viewableItems[0].index ?? 0);
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  }

  function handleNext() {
    flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
  }

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES as unknown as Slide[]}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => <SlideItem slide={item} />}
        bounces={false}
        decelerationRate="fast"
      />

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.dotsRow}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} active={i === currentIndex} accent={slide.accent} />
          ))}
        </View>
        <View style={s.btnRow}>
          {isLast ? (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: SLIDES[currentIndex].accent, flex: 1 }]}
              onPress={finish}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Empezar</Text>
              <Feather name="arrow-right" size={16} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={s.skipBtn} onPress={finish} activeOpacity={0.7}>
                <Text style={s.skipText}>Saltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: SLIDES[currentIndex].accent }]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>Siguiente</Text>
                <Feather name="arrow-right" size={16} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Mock UI styles ────────────────────────────────────────────────────────────

const mock = StyleSheet.create({
  card: {
    borderRadius: 26, backgroundColor: colors.panel,
    overflow: 'hidden',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10, shadowRadius: 28, elevation: 8,
  },

  // Slide 1 — Camera
  camView: {
    backgroundColor: '#1C1F26', width: '100%',
    justifyContent: 'space-between', overflow: 'hidden',
  },
  camTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 6,
  },
  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF453A' },
  recText: { fontFamily: fonts.mono.regular, fontSize: 10.5, color: '#FFF', letterSpacing: 0.5 },
  camTimer: { fontFamily: fonts.mono.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' },
  vfLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.08)' },
  vfH: { left: 0, right: 0, height: 1 },
  vfV: { top: 0, bottom: 0, width: 1 },
  fb: {
    position: 'absolute', width: 14, height: 14,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  camControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 14, paddingTop: 8,
  },
  camSideBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  camRecBtn: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  camRecBtnInner: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF453A',
  },
  infoStrip: {
    paddingHorizontal: 14, paddingVertical: 12, gap: 8, justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoTitle: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.crema, flex: 1 },
  infoChips: { flexDirection: 'row', gap: 6 },

  // Slide 2 — AI (transcription)
  transcriptArea: {
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    gap: 10, justifyContent: 'space-between',
  },
  transcriptBubble: {
    backgroundColor: colors.chip, borderRadius: 14,
    padding: 11, flex: 1,
  },
  transcriptText: {
    fontFamily: fonts.archivo.semibold, fontSize: 11.5,
    color: colors.crema, lineHeight: 17, fontStyle: 'italic',
  },
  waveform: {
    flexDirection: 'row', alignItems: 'center', gap: 3, height: 24,
  },
  waveBar: { width: 3, borderRadius: 2 },
  playerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 10,
  },
  playerPlay: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  playerTrack: {
    flex: 1, height: 4, backgroundColor: colors.chip, borderRadius: 2, overflow: 'hidden',
  },
  playerFill: { width: '52%', height: '100%', borderRadius: 2 },
  playerTime: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris },
  aiResults: {
    paddingHorizontal: 14, paddingVertical: 10, gap: 7,
  },
  aiResultsLabel: {
    fontFamily: fonts.mono.regular, fontSize: 8.5, letterSpacing: 1,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  aiItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiItemDot: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  aiItemText: { fontFamily: fonts.archivo.semibold, fontSize: 11, color: colors.crema, flex: 1 },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardHeaderTitle: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.crema, letterSpacing: 0.3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.archivo.bold, fontSize: 10, letterSpacing: 0.2 },

  // Slide 3 — Pending
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, gap: 4,
    backgroundColor: colors.tinta,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, height: 26, borderRadius: 13,
  },
  tabActive: { backgroundColor: colors.crema },
  tabText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.gris },
  tabTextActive: { color: '#FFF' },
  listItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 10, gap: 10,
  },
  listDot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listDotInner: { width: 10, height: 10, borderRadius: 5 },
  listBody: { flex: 1, gap: 2 },
  listTitle: { fontFamily: fonts.archivo.bold, fontSize: 11.5, color: colors.crema },
  listSub: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris },
  listStatusIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  // Slide 4 — Start
  appHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  appLogo: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center',
  },
  appLogoText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
  appTitle: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, flex: 1 },
  appAddBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.arena, alignItems: 'center', justifyContent: 'center',
  },
  projectCard: {
    flexDirection: 'row', alignItems: 'center', paddingRight: 14,
    paddingVertical: 11, gap: 12,
  },
  projectStripe: { width: 4, height: 38, borderRadius: 2, marginLeft: 14 },
  projectBody: { flex: 1, gap: 4 },
  projectName: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.crema },
  projectMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  projectSub: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  addBtn: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  addLabel: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris },

  // Shared
  divider: { height: 1, backgroundColor: colors.border },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: colors.chip,
  },
  chipText: { fontFamily: fonts.archivo.bold, fontSize: 9.5, color: colors.gris, letterSpacing: 0.2 },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  slide: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },

  illustrationWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingBottom: spacing.md,
  },

  textBlock: {
    width: '100%', paddingBottom: 130, gap: spacing.xs,
  },
  slideNum: {
    fontFamily: fonts.mono.regular, fontSize: 10.5,
    letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: '700',
  },
  slideTitle: {
    fontFamily: fonts.archivo.bold, fontSize: 34,
    color: colors.crema, letterSpacing: -1, lineHeight: 40,
    marginTop: 6,
  },
  slideBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 15,
    color: colors.gris, lineHeight: 23, marginTop: 6,
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.tinta,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },

  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  skipText: { fontFamily: fonts.archivo.semibold, fontSize: 14.5, color: colors.gris },
  primaryBtn: {
    height: 50, borderRadius: 25, paddingHorizontal: 26,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  primaryBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
});
