import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, ActivityIndicator, TextInput, Animated, Easing, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');
const GRID_STEP = 48;

const H_LINES: number[] = [];
const V_LINES: number[] = [];
for (let y = GRID_STEP; y < SH; y += GRID_STEP) H_LINES.push(y);
for (let x = GRID_STEP; x < SW; x += GRID_STEP) V_LINES.push(x);

function GridBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {H_LINES.map((y) => (
        <View key={`h${y}`} style={{ position: 'absolute', left: 0, right: 0, top: y, height: StyleSheet.hairlineWidth, backgroundColor: colors.crema, opacity: 0.07 }} />
      ))}
      {V_LINES.map((x) => (
        <View key={`v${x}`} style={{ position: 'absolute', top: 0, bottom: 0, left: x, width: StyleSheet.hairlineWidth, backgroundColor: colors.crema, opacity: 0.07 }} />
      ))}
    </View>
  );
}
import { LinearGradient } from 'expo-linear-gradient';
import { SlidingTabs } from '../../components/SlidingTabs';

const LOGO_SRC = require('../../assets/icon.png');
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/use-profile';
import { useStudio } from '../../lib/use-studio';

type PropertyType = 'edificio' | 'casa' | 'local_comercial' | 'oficina' | 'nave_industrial' | 'otro';

const PROPERTY_ICON: Record<PropertyType, string> = {
  edificio:        'layers',
  casa:            'home',
  local_comercial: 'shopping-bag',
  oficina:         'briefcase',
  nave_industrial: 'package',
  otro:            'map-pin',
};

const PROPERTY_PALETTE: Record<PropertyType, { grad: [string, string]; tint: string; ring: string }> = {
  edificio:        { grad: ['#EDE8DF', '#E0D8CB'], tint: '#7A6A52', ring: 'rgba(122,106,82,0.10)'  },
  casa:            { grad: ['#E8EDE8', '#D9E3D9'], tint: '#5A7060', ring: 'rgba(90,112,96,0.10)'   },
  local_comercial: { grad: ['#E6EAED', '#D8DFE4'], tint: '#556470', ring: 'rgba(85,100,112,0.10)'  },
  oficina:         { grad: ['#ECE8EE', '#E0D9E4'], tint: '#6E5F7A', ring: 'rgba(110,95,122,0.10)'  },
  nave_industrial: { grad: ['#E6E8E8', '#D8DCDC'], tint: '#5A6264', ring: 'rgba(90,98,100,0.10)'   },
  otro:            { grad: ['#EFEBE2', '#E4DDD0'], tint: '#6B6A65', ring: 'rgba(107,106,101,0.10)' },
};

function ProjectLogoFallback({ propertyType }: { propertyType: PropertyType | null }) {
  const type = propertyType ?? 'otro';
  const { grad, tint, ring } = PROPERTY_PALETTE[type];
  const icon = PROPERTY_ICON[type] as any;

  return (
    <LinearGradient
      colors={grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardImageFallback}
    >
      {/* subtle grid */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[16, 32, 48].map((v) => (
          <View key={`h${v}`} style={{ position: 'absolute', left: 0, right: 0, top: v, height: StyleSheet.hairlineWidth, backgroundColor: tint, opacity: 0.12 }} />
        ))}
        {[16, 32, 48].map((v) => (
          <View key={`v${v}`} style={{ position: 'absolute', top: 0, bottom: 0, left: v, width: StyleSheet.hairlineWidth, backgroundColor: tint, opacity: 0.12 }} />
        ))}
      </View>
      <View style={[styles.fallbackRing, { backgroundColor: ring }]}>
        <Feather name={icon} size={24} color={tint} />
      </View>
    </LinearGradient>
  );
}

interface DbProject {
  id: string;
  name: string;
  logo_url: string | null;
  property_type: PropertyType | null;
  rubros: { id: string; status: string }[];
}

const FILTERS = ['Todos', 'En curso'];

function StatusPill({ rubros }: { rubros: { status: string }[] }) {
  const active = rubros.some((r) => r.status === 'en_curso');
  const activeCount = rubros.filter((r) => r.status === 'en_curso').length;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Animated.View style={[
        styles.pillDot,
        active ? styles.pillDotActive : styles.pillDotInactive,
        active && { opacity: pulse },
      ]} />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {active ? `${activeCount} en curso` : 'Pausado'}
      </Text>
    </View>
  );
}

function SearchBarFade({ children }: { children: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{
      flex: 1,
      opacity: anim,
      transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.45, 1] });
  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.cardImageSlot, { backgroundColor: colors.chip }]} />
      <View style={[styles.cardBody, { gap: 10 }]}>
        <View style={{ height: 14, borderRadius: 7, backgroundColor: colors.chip, width: '65%' }} />
        <View style={{ height: 22, borderRadius: 11, backgroundColor: colors.chip, width: '40%' }} />
      </View>
    </Animated.View>
  );
}

function ProjectCard({ project, onPress, index }: { project: DbProject; onPress: () => void; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 65),
      Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.cardImageSlot}>
          {project.logo_url ? (
            <Image source={{ uri: project.logo_url }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <ProjectLogoFallback propertyType={project.property_type} />
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{project.name}</Text>
          <View style={styles.cardFooter}>
            <StatusPill rubros={project.rubros} />
            <Feather name="chevron-right" size={17} color={colors.faint} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProyectosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { studio, isAdmin, refetch: refetchStudio } = useStudio();
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const fabPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.06, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fabPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  function openSearch() {
    setSearchVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function closeSearch() {
    setSearchVisible(false);
    setSearchQuery('');
  }

  useFocusEffect(useCallback(() => { refetchStudio(); }, [refetchStudio]));

  const fetchProjects = useCallback(() => {
    setLoading(true);
    supabase
      .from('projects')
      .select('id, name, logo_url, property_type, rubros(id, status)')
      .then(({ data }) => {
        setProjects((data as DbProject[]) ?? []);
        setLoading(false);
      });
  }, []);

  useFocusEffect(fetchProjects);

  const filtered = projects
    .filter((p) => {
      if (filter === 'En curso') return p.rubros.some((r) => r.status === 'en_curso');
      return true;
    })
    .filter((p) =>
      !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

  const rawLabel = studio?.name ?? profile?.full_name ?? '';
  const brandLabel = rawLabel.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <GridBackground />
      <View style={styles.topBar}>
        {searchVisible ? (
          <SearchBarFade>
          <View style={styles.searchBar}>
            <Feather name="search" size={15} color={colors.gris} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar proyecto..."
              placeholderTextColor={colors.faint}
              selectionColor={colors.arena}
              returnKeyType="search"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={closeSearch} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.gris} />
            </TouchableOpacity>
          </View>
          </SearchBarFade>
        ) : (
          <>
            <View style={styles.brand}>
              <Image source={LOGO_SRC} style={styles.brandLogo} resizeMode="contain" />
              {brandLabel ? (
                <Text style={styles.brandName} numberOfLines={2} ellipsizeMode="tail">{brandLabel}</Text>
              ) : null}
            </View>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.circleBtn} onPress={openSearch} activeOpacity={0.8}>
                <Feather name="search" size={17} color={colors.crema} />
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.circleBtn, styles.circleBtnAccent]}
                  onPress={() => router.push('/proyecto/nueva')}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.heading}>Tus proyectos{'\n'}de construcción</Text>
      </View>

      <View style={styles.filterRow}>
        <SlidingTabs options={FILTERS} selected={filter} onChange={setFilter} />
      </View>

      {!loading && projects.length > 0 && (
        <TouchableOpacity style={styles.simEntry} onPress={() => router.push('/simulacion')} activeOpacity={0.8}>
          <Feather name="zap" size={13} color={colors.arena} />
          <Text style={styles.simEntryText}>Simular nuevo proyecto</Text>
          <Feather name="chevron-right" size={13} color={colors.faint} />
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>{[0,1,2,3].map(i => <SkeletonCard key={i} />)}</>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name={searchQuery.trim() ? 'search' : 'layers'} size={28} color={colors.faint} />
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? `Sin resultados para "${searchQuery.trim()}"`
                : filter === 'Todos' ? 'No tenés proyectos aún' : `No hay proyectos "${filter}"`}
            </Text>
            {filter === 'Todos' && !searchQuery.trim() && isAdmin && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/proyecto/nueva')}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Crear proyecto</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              index={i}
              onPress={() => router.push(`/proyecto/${p.id}`)}
            />
          ))
        )}
      </ScrollView>

      <Animated.View style={[styles.fabWrap, { bottom: insets.bottom + 92, transform: [{ scale: fabPulse }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/nueva-grabacion')}
          activeOpacity={0.85}
        >
          <Feather name="video" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandLogo: {
    width: 36,
    height: 36,
  },
  brandName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14.5,
    color: colors.crema,
    maxWidth: 180,
    flexShrink: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },
  circleBtnAccent: {
    backgroundColor: colors.crema,
    shadowColor: colors.crema,
    shadowOpacity: 0.25,
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.archivo.bold,
    fontSize: 30,
    color: colors.crema,
    letterSpacing: -0.9,
    lineHeight: 36,
  },
  filterRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.sm,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    gap: 16,
  },
  emptyText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.faint,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: colors.crema,
    marginTop: 4,
  },
  emptyBtnText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.panel,
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  cardImageSlot: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.chip,
    flexShrink: 0,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 16.5,
    color: colors.crema,
    letterSpacing: -0.3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.chip,
  },
  statusPillActive: {
    backgroundColor: colors.crema,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillDotActive: {
    backgroundColor: '#FFFFFF',
  },
  pillDotInactive: {
    backgroundColor: colors.faint,
  },
  pillText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.gris,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.crema,
  },
  simEntry: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  simEntryText: {
    flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.crema,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.arena,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.arena,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
});
