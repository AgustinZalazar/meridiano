import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';

const LOGO_SRC = require('../../assets/icon.png');
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/use-profile';
import { useStudio } from '../../lib/use-studio';
import { ProjectPlaceholder } from '../../components/ProjectPlaceholder';

interface DbProject {
  id: string;
  name: string;
  image_url: string | null;
  rubros: { id: string; status: string }[];
}

const FILTERS = ['Todos', 'En curso', 'Pausado'];

function StatusPill({ rubros }: { rubros: { status: string }[] }) {
  const active = rubros.some((r) => r.status === 'en_curso');
  const activeCount = rubros.filter((r) => r.status === 'en_curso').length;
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <View style={[styles.pillDot, active ? styles.pillDotActive : styles.pillDotInactive]} />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {active ? `${activeCount} en curso` : 'Pausado'}
      </Text>
    </View>
  );
}

function ProjectCard({ project, onPress }: { project: DbProject; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardImageSlot}>
        {project.image_url
          ? <Image source={{ uri: project.image_url }} style={styles.cardImage} />
          : <ProjectPlaceholder variant="card" />
        }
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{project.name}</Text>
        <View style={styles.cardFooter}>
          <StatusPill rubros={project.rubros} />
          <Feather name="chevron-right" size={17} color={colors.faint} />
        </View>
      </View>
    </TouchableOpacity>
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

  useFocusEffect(useCallback(() => { refetchStudio(); }, [refetchStudio]));

  const fetchProjects = useCallback(() => {
    setLoading(true);
    supabase
      .from('projects')
      .select('id, name, image_url, rubros(id, status)')
      .then(({ data }) => {
        setProjects((data as DbProject[]) ?? []);
        setLoading(false);
      });
  }, []);

  useFocusEffect(fetchProjects);

  const filtered = projects.filter((p) => {
    if (filter === 'En curso') return p.rubros.some((r) => r.status === 'en_curso');
    if (filter === 'Pausado') return !p.rubros.some((r) => r.status === 'en_curso');
    return true;
  });

  const brandLabel = studio?.name ?? profile?.full_name ?? '';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Image source={LOGO_SRC} style={styles.brandLogo} resizeMode="contain" />
          {brandLabel ? (
            <Text style={styles.brandName}>{brandLabel}</Text>
          ) : null}
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
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
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.heading}>Tus proyectos{'\n'}de construcción</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.crema} style={styles.loader} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="layers" size={28} color={colors.faint} />
            <Text style={styles.emptyText}>
              {filter === 'Todos' ? 'No tenés proyectos aún' : `No hay proyectos "${filter}"`}
            </Text>
            {filter === 'Todos' && isAdmin && (
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
          filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onPress={() => router.push(`/proyecto/${p.id}`)}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 92 }]}
        onPress={() => router.push('/nueva-grabacion')}
        activeOpacity={0.85}
      >
        <Feather name="video" size={16} color="#FFFFFF" />
      </TouchableOpacity>
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
  filtersRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  chip: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 16,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.crema,
  },
  chipText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 12.5,
    color: colors.crema,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  filterStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.sm,
    gap: 12,
  },
  loader: {
    marginTop: 60,
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
  cardImagePlaceholder: {
    backgroundColor: colors.chip,
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
  fab: {
    position: 'absolute',
    right: spacing.xl,
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
