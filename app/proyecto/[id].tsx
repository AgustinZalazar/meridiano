import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator, ListRenderItem } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ProjectPlaceholder } from '../../components/ProjectPlaceholder';

// ─── Types ───────────────────────────────────────────────────────────────────

type DbRubroStatus = 'sin_iniciar' | 'en_curso' | 'completada';
type PendingStatus = 'pendiente' | 'en_revision' | 'resuelto';
type ReportType = 'contratistas' | 'oficina';
type Tab = 'rubros' | 'pendientes' | 'planos';

interface DbProject {
  id: string;
  name: string;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface DbRubro {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  status: DbRubroStatus;
  start_date: string | null;
  end_date: string | null;
}

interface DbPendingItem {
  id: string;
  description: string;
  rubro_id: string;
  trade: string | null;
  status: PendingStatus;
  reports: { type: ReportType } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<DbRubroStatus, { label: string; active: boolean }> = {
  sin_iniciar: { label: 'Sin iniciar', active: false },
  en_curso:    { label: 'En curso',    active: true  },
  completada:  { label: 'Entregada',   active: false },
};

function formatStartDate(d: string | null): string {
  if (!d) return 'Sin fecha';
  const [year, month] = d.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return 'Inicio ' + date.toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' });
}

const PENDING_STATUS_STYLE: Record<PendingStatus, { bg: string; color: string }> = {
  pendiente:   { bg: colors.chip,                   color: colors.crema  },
  en_revision: { bg: 'rgba(217,119,87,0.12)',       color: colors.arena  },
  resuelto:    { bg: 'rgba(74,124,89,0.12)',         color: colors.success },
};

const PENDING_STATUS_LABEL: Record<PendingStatus, string> = {
  pendiente:   'Pendiente',
  en_revision: 'En revisión',
  resuelto:    'Resuelto',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: DbRubroStatus }) {
  const { label, active } = STATUS_MAP[status];
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  );
}

function RubroCard({ rubro, pendientes, onEdit, onGrabacion, onInformeDia }: {
  rubro: DbRubro;
  pendientes: number;
  onEdit: () => void;
  onGrabacion: () => void;
  onInformeDia: () => void;
}) {
  return (
    <TouchableOpacity style={styles.obraCard} onPress={onEdit} activeOpacity={0.85}>
      <View style={styles.obraCardMain}>
        <View style={styles.obraInfo}>
          <Text style={styles.obraName}>{rubro.name}</Text>
          {rubro.contractor ? (
            <Text style={styles.obraContractor} numberOfLines={1}>{rubro.contractor}</Text>
          ) : null}
          <View style={styles.obraMeta}>
            <Text style={styles.obraDate}>{formatStartDate(rubro.start_date)}</Text>
            <StatusPill status={rubro.status} />
          </View>
        </View>
        {pendientes > 0 && (
          <View style={styles.pendBadge}>
            <Text style={styles.pendText}>{pendientes}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.grabBtn} onPress={onGrabacion} activeOpacity={0.8}>
          <Feather name="video" size={14} color={colors.crema} />
          <Text style={styles.grabBtnText}>Grabar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.grabBtn, styles.grabBtnDay]} onPress={onInformeDia} activeOpacity={0.8}>
          <Feather name="calendar" size={14} color={colors.arena} />
          <Text style={[styles.grabBtnText, { color: colors.arena }]}>Informe del día</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function PendienteCard({ item, rubroName, onPress }: { item: DbPendingItem; rubroName: string; onPress: () => void }) {
  const s = PENDING_STATUS_STYLE[item.status];
  return (
    <TouchableOpacity style={styles.pendCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.pendImageSlot}>
        <Feather name={item.reports ? 'cpu' : 'edit-3'} size={18} color={colors.faint} />
      </View>
      <View style={styles.pendBody}>
        <Text style={styles.pendDesc} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.pendObra}>{rubroName}</Text>
        <View style={styles.pendFooter}>
          {item.trade ? (
            <View style={styles.tradeChip}>
              <Text style={styles.tradeText}>{item.trade.toUpperCase()}</Text>
            </View>
          ) : null}
          <View style={[styles.statusChip, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusChipText, { color: s.color }]}>{PENDING_STATUS_LABEL[item.status]}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProyectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;

  const [project, setProject] = useState<DbProject | null>(null);
  const [rubros, setRubros] = useState<DbRubro[]>([]);
  const [pendingItems, setPendingItems] = useState<DbPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('rubros');
  const [pendType, setPendType] = useState<ReportType>('contratistas');

  useFocusEffect(
    useCallback(() => {
      if (!projectId) return;
      setLoading(true);

      Promise.all([
        supabase.from('projects').select('id, name, image_url, start_date, end_date').eq('id', projectId).single(),
        supabase.from('rubros').select('id, code, name, contractor, status, start_date, end_date').eq('project_id', projectId).order('created_at'),
        supabase.from('pending_items').select('id, description, rubro_id, trade, status, reports(type)').eq('project_id', projectId),
      ]).then(([projRes, rubrosRes, pendRes]) => {
        if (projRes.data) setProject(projRes.data as DbProject);
        setRubros((rubrosRes.data as DbRubro[]) ?? []);
        setPendingItems((pendRes.data as DbPendingItem[]) ?? []);
        setLoading(false);
      });
    }, [projectId])
  );

  const rubroById = Object.fromEntries(rubros.map((r) => [r.id, r]));

  const pendingCountPerRubro = pendingItems.reduce<Record<string, number>>((acc, p) => {
    if (p.status === 'pendiente') acc[p.rubro_id] = (acc[p.rubro_id] ?? 0) + 1;
    return acc;
  }, {});

  const filteredPendientes = pendingItems.filter((p) => {
    const type = p.reports?.type;
    return !type || type === pendType;
  });

  const openPendingCount = pendingItems.filter((p) => p.status === 'pendiente').length;

  if (loading) {
    return (
      <View style={[styles.safe, styles.loadingCenter]}>
        <ActivityIndicator color={colors.crema} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.safe, styles.loadingCenter]}>
        <Text style={styles.emptyText}>Proyecto no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top }]}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.push({
              pathname: '/proyecto/editar',
              params: {
                id: project.id,
                name: project.name,
                image_url: project.image_url ?? '',
                start_date: project.start_date ?? '',
                end_date: project.end_date ?? '',
              },
            })}
            activeOpacity={0.8}
          >
            <Feather name="edit-2" size={15} color={colors.crema} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.push({ pathname: '/nueva-grabacion', params: { projectId: project.id, projectName: project.name } })}
            activeOpacity={0.8}
          >
            <Feather name="video" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        {project.image_url
          ? <Image source={{ uri: project.image_url }} style={styles.bannerImage} resizeMode="cover" />
          : <ProjectPlaceholder variant="banner" />
        }
        {/* Gradient scrim — bottom-heavy, sin tapar el hero */}
        <View style={styles.scrimFar} />
        <View style={styles.scrimNear} />
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerEyebrow}>PROYECTO</Text>
          <Text style={styles.bannerTitle}>{project.name}</Text>
        </View>
      </View>

      {/* Pill nav */}
      <View style={styles.pillNavWrap}>
        <View style={styles.pillNav}>
          {([
            { key: 'rubros',     icon: 'layers',  label: 'Rubros'     },
            { key: 'pendientes', icon: 'clock',   label: 'Pendientes' },
            { key: 'planos',     icon: 'map',     label: 'Planos'     },
          ] as { key: Tab; icon: React.ComponentProps<typeof Feather>['name']; label: string }[]).map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.pillNavItem}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.7}
              >
                <Feather name={t.icon} size={18} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.35)'} />
                <Text style={[styles.pillNavLabel, active && styles.pillNavLabelActive]}>
                  {t.key === 'pendientes' && openPendingCount > 0
                    ? `${t.label} · ${openPendingCount}`
                    : t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      {activeTab === 'rubros' && (
        <FlatList
          data={rubros}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RubroCard
              rubro={item}
              pendientes={pendingCountPerRubro[item.id] ?? 0}
              onEdit={() => router.push({
                pathname: '/rubro/[id]',
                params: {
                  id: item.id,
                  projectId: project.id,
                  name: item.name,
                  contractor: item.contractor ?? '',
                  code: item.code,
                  status: item.status,
                  startDate: item.start_date ?? '',
                  endDate: item.end_date ?? '',
                },
              })}
              onGrabacion={() => router.push({
                pathname: '/nueva-grabacion',
                params: { projectId: project.id, projectName: project.name, rubroName: item.name },
              })}
              onInformeDia={() => router.push({
                pathname: '/informe-dia/[rubroId]',
                params: { rubroId: item.id, rubroName: item.name, projectId: project.id, projectName: project.name },
              })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="layers" size={28} color={colors.faint} />
              <Text style={styles.emptyText}>Sin rubros cargados</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/rubro/nueva', params: { projectId: project.id } })}
            >
              <Feather name="plus" size={16} color={colors.crema} />
              <Text style={styles.addBtnText}>Nuevo rubro</Text>
            </TouchableOpacity>
          }
        />
      )}

      {activeTab === 'pendientes' && (
        <FlatList
          data={filteredPendientes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PendienteCard
              item={item}
              rubroName={rubroById[item.rubro_id]?.name ?? '—'}
              onPress={() => router.push(`/pendiente/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.pendTypeToggle}>
              <TouchableOpacity
                style={[styles.pendTypeBtn, pendType === 'contratistas' && styles.pendTypeBtnActive]}
                onPress={() => setPendType('contratistas')}
                activeOpacity={0.8}
              >
                <Feather name="tool" size={12} color={pendType === 'contratistas' ? '#FFFFFF' : colors.gris} />
                <Text style={[styles.pendTypeBtnText, pendType === 'contratistas' && styles.pendTypeBtnTextActive]}>Contratistas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pendTypeBtn, pendType === 'oficina' && styles.pendTypeBtnActive]}
                onPress={() => setPendType('oficina')}
                activeOpacity={0.8}
              >
                <Feather name="briefcase" size={12} color={pendType === 'oficina' ? '#FFFFFF' : colors.gris} />
                <Text style={[styles.pendTypeBtnText, pendType === 'oficina' && styles.pendTypeBtnTextActive]}>Oficina técnica</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={32} color={colors.faint} />
              <Text style={styles.emptyText}>Sin pendientes</Text>
            </View>
          }
        />
      )}

      {activeTab === 'planos' && (
        <FlatList
          data={[]}
          keyExtractor={(item: never) => item}
          renderItem={null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="map" size={28} color={colors.faint} />
              <Text style={styles.emptyText}>Sin planos cargados</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
              <Feather name="upload" size={16} color={colors.crema} />
              <Text style={styles.addBtnText}>Subir plano</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  loadingCenter: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs,
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  topBarRight: { flexDirection: 'row', gap: spacing.sm },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5,
  },

  banner: { height: 280, backgroundColor: colors.chip },
  bannerImage: { width: '100%', height: '100%' },
  scrimFar: {
    position: 'absolute', bottom: 60, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(18,21,26,0.28)',
  },
  scrimNear: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(18,21,26,0.72)',
  },
  bannerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm,
    gap: 2,
  },
  bannerEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
  },
  bannerTitle: { fontFamily: fonts.archivo.bold, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.5 },

  pillNavWrap: { alignItems: 'center', paddingVertical: spacing.md },
  pillNav: {
    flexDirection: 'row', height: 56, borderRadius: 28, backgroundColor: colors.crema,
    paddingHorizontal: 6, alignItems: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 14,
  },
  pillNavItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
  },
  pillNavLabel: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: 'rgba(255,255,255,0.35)' },
  pillNavLabelActive: { color: '#FFFFFF' },

  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: 10 },

  pendTypeToggle: {
    flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 22, padding: 4, gap: 4, marginBottom: 10,
  },
  pendTypeBtn: {
    flex: 1, height: 38, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  pendTypeBtnActive: { backgroundColor: colors.crema },
  pendTypeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.gris },
  pendTypeBtnTextActive: { color: '#FFFFFF' },

  obraCard: {
    borderRadius: 20, backgroundColor: colors.panel, padding: 16, gap: 12,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  obraCardMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  obraInfo: { flex: 1, gap: 5 },
  obraName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  obraContractor: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris },
  obraMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  obraDate: { fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 0.4, color: colors.gris },
  statusPill: {
    height: 24, borderRadius: 12, paddingHorizontal: 10,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  statusPillActive: { backgroundColor: colors.crema },
  pillText: { fontFamily: fonts.archivo.bold, fontSize: 9.5, letterSpacing: 0.3, color: colors.gris },
  pillTextActive: { color: '#FFFFFF' },
  pendBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pendText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },
  cardActions: { flexDirection: 'row', gap: 8 },
  grabBtn: {
    flex: 1, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.tinta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  grabBtnDay: { borderColor: 'rgba(217,119,87,0.3)', backgroundColor: 'rgba(217,119,87,0.06)' },
  grabBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  addBtn: {
    height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginTop: spacing.xs,
  },
  addBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.crema },

  pendCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.panel, borderRadius: 18, padding: 13,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  pendImageSlot: {
    width: 60, height: 60, borderRadius: 12, backgroundColor: colors.chip,
    flexShrink: 0, alignItems: 'center', justifyContent: 'center',
  },
  pendBody: { flex: 1, gap: 4, justifyContent: 'center' },
  pendDesc: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema, lineHeight: 18 },
  pendObra: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3 },
  pendFooter: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tradeChip: {
    height: 20, borderRadius: 10, paddingHorizontal: 7,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  tradeText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3, color: colors.crema },
  statusChip: { height: 20, borderRadius: 10, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  statusChipText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },
});
