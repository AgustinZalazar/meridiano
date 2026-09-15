import { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator, Alert, ScrollView, TextInput, Animated, Easing, Linking } from 'react-native';
import { SlidingTabs } from '../../components/SlidingTabs';
import { BottomSheet } from '../../components/BottomSheet';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ProjectPlaceholder } from '../../components/ProjectPlaceholder';

// ─── Types ───────────────────────────────────────────────────────────────────

type DbRubroStatus = 'sin_iniciar' | 'en_curso' | 'completada';
type ProjectStatus = 'activo' | 'finalizado' | 'pausado';
type PendingStatus = 'pendiente' | 'en_revision' | 'resuelto';
type ReportType = 'contratistas' | 'oficina';
type Tab = 'rubros' | 'pendientes' | 'planos';

const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string }[] = [
  { value: 'activo',     label: 'En construcción', color: colors.crema   },
  { value: 'pausado',    label: 'Pausado',          color: colors.gris    },
  { value: 'finalizado', label: 'Finalizado',       color: colors.success },
];

type PropertyType = 'edificio' | 'casa' | 'local_comercial' | 'oficina' | 'nave_industrial' | 'otro';
type TipoObra     = 'obra_nueva' | 'refaccion' | 'ampliacion' | 'demolicion' | 'otro';

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  edificio: 'Edificio', casa: 'Casa', local_comercial: 'Local comercial',
  oficina: 'Oficina', nave_industrial: 'Nave industrial', otro: 'Otro',
};
const PROPERTY_TYPE_ICON: Record<PropertyType, React.ComponentProps<typeof Feather>['name']> = {
  edificio: 'layers', casa: 'home', local_comercial: 'shopping-bag',
  oficina: 'briefcase', nave_industrial: 'package', otro: 'more-horizontal',
};
const TIPO_OBRA_LABEL: Record<TipoObra, string> = {
  obra_nueva: 'Obra nueva', refaccion: 'Refacción', ampliacion: 'Ampliación',
  demolicion: 'Demolición', otro: 'Otro',
};
const AMENITY_LABEL: Record<string, string> = {
  pileta: 'Pileta', quincho: 'Quincho', gym: 'Gym', sum: 'SUM',
  jardin: 'Jardín', terraza: 'Terraza', solarium: 'Solarium',
  laundry: 'Laundry', bauleras: 'Bauleras', porteria: 'Portería', vigilancia: 'Vigilancia',
};

interface DbProject {
  id: string;
  name: string;
  image_url: string | null;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus | null;
  // Property profile
  property_type: PropertyType | null;
  tipo_obra: TipoObra | null;
  m2_cubiertos: number | null;
  m2_totales: number | null;
  m2_terreno: number | null;
  pisos: number | null;
  unidades: number | null;
  dormitorios: number | null;
  banos: number | null;
  ambientes: number | null;
  cocheras: number | null;
  amenities: string[];
  direccion: string | null;
  comitente: string | null;
  anio_proyecto: number | null;
}

interface DbRubro {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  status: DbRubroStatus;
  start_date: string | null;
  end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
}

interface DbPendingItem {
  id: string;
  description: string;
  rubro_id: string;
  trade: string | null;
  status: PendingStatus;
  reports: { type: ReportType } | null;
  created_at: string;
}

interface DbPlano {
  id: string;
  name: string;
  type: string;
  storage_path: string;
  created_at: string;
}

const PLAN_TYPES = ['ARQUITECTURA', 'ESTRUCTURAL', 'INSTALACIONES', 'OTRO'] as const;
const ALLOWED_PLAN_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<DbRubroStatus, { label: string; active: boolean }> = {
  sin_iniciar: { label: 'Sin iniciar', active: false },
  en_curso:    { label: 'En curso',    active: true  },
  completada:  { label: 'Entregada',   active: false },
};

function formatItemDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    ...(!sameYear && { year: 'numeric' }),
  }).replace('.', '').toUpperCase();
}

function formatStartDate(d: string | null): string {
  if (!d) return 'Sin fecha';
  const [year, month] = d.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return 'Inicio ' + date.toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' });
}

const PENDING_STATUS_COLOR: Record<PendingStatus, string> = {
  pendiente:   colors.gris,
  en_revision: colors.arena,
  resuelto:    colors.success,
};

const PENDING_STATUS_LABEL: Record<PendingStatus, string> = {
  pendiente:   'Pendiente',
  en_revision: 'En revisión',
  resuelto:    'Resuelto',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BadgeDot({ count }: { count: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const isFirst = useRef(true);

  useEffect(() => {
    scale.setValue(isFirst.current ? 0 : 0.6);
    isFirst.current = false;
    Animated.spring(scale, {
      toValue: 1, friction: 4, tension: 200, useNativeDriver: true,
    }).start();
  }, [count]);

  return (
    <Animated.View style={[styles.badgeDot, { transform: [{ scale }] }]}>
      <Text style={styles.badgeDotText}>{count}</Text>
    </Animated.View>
  );
}

function SkeletonRubroCard() {
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
    <Animated.View style={[styles.obraCard, { opacity, gap: 12 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ height: 15, width: '55%', borderRadius: 8, backgroundColor: colors.chip }} />
        <View style={{ height: 24, width: 72, borderRadius: 12, backgroundColor: colors.chip }} />
      </View>
      <View style={{ height: 11, width: '38%', borderRadius: 6, backgroundColor: colors.chip }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: colors.chip }} />
        <View style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: colors.chip }} />
      </View>
    </Animated.View>
  );
}

function StatusPill({ status }: { status: DbRubroStatus }) {
  const { label, active } = STATUS_MAP[status];
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  );
}

function RubroCard({ rubro, pendientes, index, onEdit, onGrabacion, onInformeDia }: {
  rubro: DbRubro;
  pendientes: number;
  index: number;
  onEdit: () => void;
  onGrabacion: () => void;
  onInformeDia: () => void;
}) {
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
    <TouchableOpacity style={styles.obraCard} onPress={onEdit} activeOpacity={0.85}>
      {/* Header: nombre + status */}
      <View style={styles.obraHeader}>
        <Text style={styles.obraName} numberOfLines={2}>{rubro.name}</Text>
        <StatusPill status={rubro.status} />
      </View>

      {/* Contratista */}
      {rubro.contractor ? (
        <Text style={styles.obraContractor} numberOfLines={1}>{rubro.contractor}</Text>
      ) : null}

      {/* Footer: fecha + pendientes */}
      <View style={styles.obraFooter}>
        <Text style={styles.obraDate}>{formatStartDate(rubro.start_date)}</Text>
        {pendientes > 0 && (
          <View style={styles.pendInline}>
            <Feather name="alert-circle" size={10} color={colors.arena} />
            <Text style={styles.pendInlineText}>{pendientes} pendiente{pendientes > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Acciones */}
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
    </Animated.View>
  );
}

function PendienteCard({ item, rubroName, index, onPress }: { item: DbPendingItem; rubroName: string; index: number; onPress: () => void }) {
  const statusColor = PENDING_STATUS_COLOR[item.status];
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
    <TouchableOpacity style={styles.pendCard} onPress={onPress} activeOpacity={0.85}>
      {/* Top row: status dot + label + date */}
      <View style={styles.pendTopRow}>
        <View style={styles.pendStatusRow}>
          <View style={[styles.pendStatusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.pendStatusLabel, { color: statusColor }]}>
            {PENDING_STATUS_LABEL[item.status].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.pendDate}>{formatItemDate(item.created_at)}</Text>
      </View>
      {/* Description */}
      <Text style={styles.pendDesc} numberOfLines={2}>{item.description}</Text>
      {/* Footer: rubro + trade chip */}
      <View style={styles.pendCardFooter}>
        <Text style={styles.pendObra} numberOfLines={1}>{rubroName}</Text>
        {item.trade ? (
          <View style={styles.tradeChip}>
            <Text style={styles.tradeText}>{item.trade.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ─── PropertyProfileCard ─────────────────────────────────────────────────────

function PropertyProfileCard({ project }: { project: DbProject }) {
  const { property_type: pt, tipo_obra: to, m2_cubiertos, m2_totales, m2_terreno,
    pisos, unidades, dormitorios, banos, ambientes, cocheras,
    amenities, direccion, comitente, anio_proyecto } = project;

  const hasAny = pt || to || m2_cubiertos || m2_totales || m2_terreno || pisos ||
    unidades || dormitorios || banos || ambientes || cocheras ||
    (amenities?.length > 0) || direccion || comitente || anio_proyecto;

  if (!hasAny) return null;

  const fmt = (n: number | null) => n != null ? n.toLocaleString('es-AR') : null;

  return (
    <View style={styles.propCard}>
      {/* Type row */}
      {(pt || to) && (
        <View style={styles.propTypeRow}>
          {pt && (
            <View style={styles.propTypeBadge}>
              <Feather name={PROPERTY_TYPE_ICON[pt]} size={12} color={colors.arena} />
              <Text style={styles.propTypeBadgeText}>{PROPERTY_TYPE_LABEL[pt]}</Text>
            </View>
          )}
          {to && (
            <View style={styles.propObraBadge}>
              <Text style={styles.propObraBadgeText}>{TIPO_OBRA_LABEL[to]}</Text>
            </View>
          )}
          {anio_proyecto && (
            <Text style={styles.propAnio}>{anio_proyecto}</Text>
          )}
        </View>
      )}

      {/* Metros */}
      {(m2_cubiertos || m2_totales || m2_terreno) && (
        <View style={styles.propMetrosRow}>
          {m2_cubiertos ? <View style={styles.propMetroItem}><Text style={styles.propMetroVal}>{fmt(m2_cubiertos)}</Text><Text style={styles.propMetroLabel}>m² cub.</Text></View> : null}
          {m2_totales   ? <View style={styles.propMetroItem}><Text style={styles.propMetroVal}>{fmt(m2_totales)}</Text><Text style={styles.propMetroLabel}>m² tot.</Text></View> : null}
          {m2_terreno   ? <View style={styles.propMetroItem}><Text style={styles.propMetroVal}>{fmt(m2_terreno)}</Text><Text style={styles.propMetroLabel}>m² terreno</Text></View> : null}
        </View>
      )}

      {/* Datos específicos */}
      {(pisos || unidades || dormitorios || banos || ambientes || cocheras) && (
        <View style={styles.propDatosRow}>
          {pisos      ? <View style={styles.propDato}><Feather name="layers" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{pisos} pisos</Text></View> : null}
          {unidades   ? <View style={styles.propDato}><Feather name="grid" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{unidades} unidades</Text></View> : null}
          {ambientes  ? <View style={styles.propDato}><Feather name="home" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{ambientes} amb.</Text></View> : null}
          {dormitorios? <View style={styles.propDato}><Feather name="moon" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{dormitorios} dorm.</Text></View> : null}
          {banos      ? <View style={styles.propDato}><Feather name="droplet" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{banos} baños</Text></View> : null}
          {cocheras   ? <View style={styles.propDato}><Feather name="square" size={10} color={colors.gris} /><Text style={styles.propDatoText}>{cocheras} coch.</Text></View> : null}
        </View>
      )}

      {/* Amenities */}
      {amenities?.length > 0 && (
        <View style={styles.propAmenities}>
          {amenities.map((a) => (
            <View key={a} style={styles.propAmenityChip}>
              <Text style={styles.propAmenityText}>{AMENITY_LABEL[a] ?? a}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Dirección / comitente */}
      {(direccion || comitente) && (
        <View style={styles.propFooter}>
          {comitente && (
            <View style={styles.propFooterItem}>
              <Feather name="user" size={10} color={colors.gris} />
              <Text style={styles.propFooterText} numberOfLines={1}>{comitente}</Text>
            </View>
          )}
          {direccion && (
            <View style={styles.propFooterItem}>
              <Feather name="map-pin" size={10} color={colors.gris} />
              <Text style={styles.propFooterText} numberOfLines={1}>{direccion}</Text>
            </View>
          )}
        </View>
      )}
    </View>
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
  const [planos, setPlanos] = useState<DbPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('rubros');
  const [pendType, setPendType] = useState<ReportType>('contratistas');
  const [pendStatusFilter, setPendStatusFilter] = useState<PendingStatus | 'active'>('active');
  const [planoSheet, setPlanoSheet] = useState(false);
  const [planoName, setPlanoName] = useState('');
  const [planoType, setPlanoType] = useState<typeof PLAN_TYPES[number]>('ARQUITECTURA');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [uploadingPlano, setUploadingPlano] = useState(false);
  const [pendRubroFilter, setPendRubroFilter] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [openingPlanoId, setOpeningPlanoId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!projectId) return;
      setLoading(true);

      Promise.all([
        supabase.from('projects').select('id, name, image_url, logo_url, start_date, end_date, status, property_type, tipo_obra, m2_cubiertos, m2_totales, m2_terreno, pisos, unidades, dormitorios, banos, ambientes, cocheras, amenities, direccion, comitente, anio_proyecto').eq('id', projectId).single(),
        supabase.from('rubros').select('id, code, name, contractor, status, start_date, end_date, actual_start_date, actual_end_date').eq('project_id', projectId).order('created_at'),
        supabase.from('pending_items').select('id, description, rubro_id, trade, status, reports(type), created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('planos').select('id, name, type, storage_path, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]).then(([projRes, rubrosRes, pendRes, planosRes]) => {
        if (projRes.data) {
          setProject(projRes.data as DbProject);
          setProjectStatus((projRes.data as DbProject).status ?? null);
        }
        setRubros((rubrosRes.data as DbRubro[]) ?? []);
        setPendingItems((pendRes.data as DbPendingItem[]) ?? []);
        setPlanos((planosRes.data as DbPlano[]) ?? []);
        setLoading(false);
      });
    }, [projectId])
  );

  async function handlePickPlano() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_PLAN_EXTS.includes(ext)) {
      Alert.alert('Tipo no permitido', 'Solo se aceptan archivos PDF, JPG, PNG o WebP.');
      return;
    }
    setPlanoName(asset.name.replace(/\.[^.]+$/, ''));
    setPickedFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
    setPlanoSheet(true);
  }

  async function handleUploadPlano() {
    if (!pickedFile || !planoName.trim()) return;
    setUploadingPlano(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const ext = pickedFile.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const storagePath = `${projectId}/${Date.now()}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: FileSystem.EncodingType.Base64 });
      const chars = atob(base64);
      const bytes = new Uint8Array(chars.length);
      for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);

      const { error: uploadErr } = await supabase.storage
        .from('planos')
        .upload(storagePath, bytes.buffer, { contentType: pickedFile.mimeType, upsert: false });
      if (uploadErr) throw new Error(`Error al subir: ${uploadErr.message}`);

      const { error: insertErr } = await supabase.from('planos').insert({
        project_id: projectId,
        name: planoName.trim(),
        type: planoType,
        storage_path: storagePath,
        uploaded_by: session.user.id,
      });
      if (insertErr) throw new Error(`Error al guardar: ${insertErr.message}`);

      setPlanoSheet(false);
      setPickedFile(null);
      setPlanoName('');
      setPlanoType('ARQUITECTURA');

      const { data } = await supabase.from('planos').select('id, name, type, storage_path, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
      setPlanos((data as DbPlano[]) ?? []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo subir el plano.');
    } finally {
      setUploadingPlano(false);
    }
  }

  async function handleOpenPlano(item: DbPlano) {
    setOpeningPlanoId(item.id);
    try {
      const { data, error } = await supabase.storage
        .from('planos')
        .createSignedUrl(item.storage_path, 3600);
      if (error || !data?.signedUrl) throw new Error('No se pudo obtener el enlace');
      await Linking.openURL(data.signedUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo abrir el plano.');
    } finally {
      setOpeningPlanoId(null);
    }
  }

  async function handleStatusChange(status: ProjectStatus) {
    if (!projectId) return;
    setSavingStatus(true);
    try {
      await supabase.from('projects').update({ status }).eq('id', projectId);
      setProjectStatus(status);
    } finally {
      setSavingStatus(false);
      setStatusSheetVisible(false);
    }
  }

  const rubroById = Object.fromEntries(rubros.map((r) => [r.id, r]));

  const pendingCountPerRubro = pendingItems.reduce<Record<string, number>>((acc, p) => {
    if (p.status === 'pendiente') acc[p.rubro_id] = (acc[p.rubro_id] ?? 0) + 1;
    return acc;
  }, {});

  const filteredPendientes = pendingItems.filter((p) => {
    const type = p.reports?.type;
    if (type && type !== pendType) return false;
    if (pendRubroFilter && p.rubro_id !== pendRubroFilter) return false;
    if (pendStatusFilter === 'active' && p.status === 'resuelto') return false;
    if (pendStatusFilter !== 'active' && p.status !== pendStatusFilter) return false;
    return true;
  });

  const openPendingCount = pendingItems.filter((p) => p.status === 'pendiente').length;

  if (loading) {
    return (
      <View style={styles.safe}>
        <View style={[styles.topBar, { top: insets.top }]}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={18} color={colors.crema} />
          </TouchableOpacity>
        </View>
        <View style={[styles.banner, { backgroundColor: colors.chip }]} />
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {[0, 1, 2].map(i => <SkeletonRubroCard key={i} />)}
        </ScrollView>
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
                logo_url: project.logo_url ?? '',
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
        <LinearGradient
          colors={['transparent', 'rgba(18,21,26,0.72)']}
          style={styles.scrim}
        />
        <View style={styles.bannerOverlay}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle}>{project.name}</Text>
              <TouchableOpacity
                style={styles.bannerStatusBadge}
                onPress={() => setStatusSheetVisible(true)}
                activeOpacity={0.8}
              >
                {projectStatus ? (
                  <View style={[styles.bannerStatusDot, { backgroundColor: PROJECT_STATUS_OPTIONS.find(o => o.value === projectStatus)?.color }]} />
                ) : (
                  <Feather name="circle" size={8} color="rgba(255,255,255,0.4)" />
                )}
                <Text style={styles.bannerStatusText}>
                  {PROJECT_STATUS_OPTIONS.find(o => o.value === projectStatus)?.label ?? 'Sin estado'}
                </Text>
                <Feather name="chevron-right" size={11} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            </View>
            {project.logo_url ? (
              <Image source={{ uri: project.logo_url }} style={styles.projectLogoImg} resizeMode="contain" />
            ) : null}
          </View>
        </View>
      </View>


      {/* Content */}
      {activeTab === 'rubros' && (
        <FlatList
          data={rubros}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<PropertyProfileCard project={project} />}
          renderItem={({ item, index }) => (
            <RubroCard
              rubro={item}
              index={index}
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
          renderItem={({ item, index }) => (
            <PendienteCard
              item={item}
              index={index}
              rubroName={rubroById[item.rubro_id]?.name ?? '—'}
              onPress={() => router.push(`/pendiente/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.pendFiltersWrap}>
              <SlidingTabs
                options={['Contratistas', 'Oficina técnica']}
                selected={pendType === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
                onChange={(v) => setPendType(v === 'Contratistas' ? 'contratistas' : 'oficina')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.rubroFilterStrip}
                contentContainerStyle={styles.rubroFilterRow}
              >
                {([['active', 'Activos'], ['pendiente', 'Pendiente'], ['en_revision', 'En revisión'], ['resuelto', 'Resuelto']] as const).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.rubroChip, pendStatusFilter === val && styles.rubroChipActive]}
                    onPress={() => setPendStatusFilter(val)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.rubroChipText, pendStatusFilter === val && styles.rubroChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {rubros.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.rubroFilterStrip}
                  contentContainerStyle={styles.rubroFilterRow}
                >
                  <TouchableOpacity
                    style={[styles.rubroChip, !pendRubroFilter && styles.rubroChipActive]}
                    onPress={() => setPendRubroFilter(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.rubroChipText, !pendRubroFilter && styles.rubroChipTextActive]}>Todos</Text>
                  </TouchableOpacity>
                  {rubros.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.rubroChip, pendRubroFilter === r.id && styles.rubroChipActive]}
                      onPress={() => setPendRubroFilter(pendRubroFilter === r.id ? null : r.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.rubroChipText, pendRubroFilter === r.id && styles.rubroChipTextActive]} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
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
          data={planos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isImg = /\.(jpg|jpeg|png|webp)$/i.test(item.storage_path);
            return (
              <TouchableOpacity
                style={styles.planoRow}
                onPress={() => handleOpenPlano(item)}
                activeOpacity={0.85}
                disabled={openingPlanoId === item.id}
              >
                {/* Name - primary element */}
                <Text style={styles.planoName}>
                  {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                </Text>
                {/* Footer: type badge + format tag + date + loader */}
                <View style={styles.planoTopRow}>
                  <View style={styles.planoTagsRow}>
                    <View style={styles.planoTypeBadge}>
                      <Text style={styles.planoTypeText}>{item.type}</Text>
                    </View>
                    <Text style={styles.planoFormatTag}>{isImg ? 'IMG' : 'PDF'}</Text>
                  </View>
                  {openingPlanoId === item.id
                    ? <ActivityIndicator size="small" color={colors.arena} />
                    : <Text style={styles.planoDate}>
                        {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '').toUpperCase()}
                      </Text>
                  }
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="map" size={28} color={colors.faint} />
              <Text style={styles.emptyText}>Sin planos cargados</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addBtn} onPress={handlePickPlano} activeOpacity={0.85} disabled={uploadingPlano}>
              {uploadingPlano
                ? <ActivityIndicator color={colors.crema} size="small" />
                : <><Feather name="upload" size={16} color={colors.crema} /><Text style={styles.addBtnText}>Subir plano</Text></>
              }
            </TouchableOpacity>
          }
        />
      )}

      {/* ── Bottom bar ────────────────────── */}
      <View style={[styles.bottomBarWrap, { bottom: Math.max(insets.bottom, 16) + 6 }]} pointerEvents="box-none">
      <View style={styles.bottomBar}>
        {([
          { key: 'rubros',     icon: 'layers',      label: 'Rubros'     },
          { key: 'pendientes', icon: 'clock',        label: 'Pendientes' },
          { key: 'planos',     icon: 'map',          label: 'Planos'     },
          { key: 'materiales', icon: 'package',      label: 'Materiales' },
          { key: 'cronograma', icon: 'bar-chart-2',  label: 'Cronograma' },
        ] as { key: string; icon: React.ComponentProps<typeof Feather>['name']; label: string }[]).map((t) => {
          const isNav = t.key === 'materiales' || t.key === 'cronograma';
          const active = !isNav && activeTab === t.key;
          const badge = t.key === 'pendientes' && openPendingCount > 0 ? openPendingCount : null;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.bottomBarItem}
              activeOpacity={0.7}
              onPress={() => {
                if (t.key === 'materiales') {
                  router.push({ pathname: '/materiales/[id]', params: { id: project.id } });
                } else if (t.key === 'cronograma') {
                  router.push({ pathname: '/cronograma/[id]', params: { id: project.id } });
                } else {
                  setActiveTab(t.key as Tab);
                }
              }}
            >
              <View style={styles.bottomBarIconWrap}>
                <Feather
                  name={t.icon}
                  size={20}
                  color={active ? '#FFFFFF' : isNav ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.35)'}
                />
                {badge ? <BadgeDot count={badge} /> : null}
              </View>
              <Text style={[styles.bottomBarLabel, active && styles.bottomBarLabelActive, isNav && styles.bottomBarLabelNav]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>

      {/* ── Sheet estado del proyecto ────────────────────── */}
      <BottomSheet visible={statusSheetVisible} onClose={() => setStatusSheetVisible(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Estado del proyecto</Text>
          <View style={styles.statusOptions}>
            {PROJECT_STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.statusOption, projectStatus === opt.value && styles.statusOptionActive]}
                onPress={() => handleStatusChange(opt.value)}
                activeOpacity={0.8}
                disabled={savingStatus}
              >
                <View style={[styles.statusOptionDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.statusOptionText, projectStatus === opt.value && styles.statusOptionTextActive]}>
                  {opt.label}
                </Text>
                {projectStatus === opt.value && (
                  savingStatus
                    ? <ActivityIndicator size="small" color={colors.crema} />
                    : <Feather name="check" size={16} color={colors.crema} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* ── Sheet nombre + tipo de plano ────────────────────── */}
      <BottomSheet visible={planoSheet} onClose={() => setPlanoSheet(false)} avoidKeyboard>
        <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Nuevo plano</Text>

            <Text style={styles.sheetFieldLabel}>NOMBRE</Text>
            <View style={styles.sheetInputWrap}>
              <TextInput
                style={styles.sheetInput}
                value={planoName}
                onChangeText={setPlanoName}
                placeholder="Ej: Planta Baja"
                placeholderTextColor={colors.faint}
                selectionColor={colors.arena}
                autoFocus
              />
            </View>

            <Text style={styles.sheetFieldLabel}>TIPO</Text>
            <View style={styles.typeRow}>
              {PLAN_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChipBtn, planoType === t && styles.typeChipBtnActive]}
                  onPress={() => setPlanoType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeChipBtnText, planoType === t && styles.typeChipBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.sheetBtn, (!planoName.trim() || uploadingPlano) && styles.sheetBtnDisabled]}
              onPress={handleUploadPlano}
              activeOpacity={0.85}
              disabled={!planoName.trim() || uploadingPlano}
            >
              {uploadingPlano
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Feather name="upload" size={15} color="#FFF" /><Text style={styles.sheetBtnText}>Subir plano</Text></>
              }
            </TouchableOpacity>
          </View>
      </BottomSheet>
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

  banner: {
    height: 230, backgroundColor: colors.chip,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  bannerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bannerTextCol: { flex: 1, gap: 2 },
  bannerEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
  },
  bannerTitle: { fontFamily: fonts.archivo.bold, fontSize: 22, color: '#FFFFFF', letterSpacing: -0.5 },
  projectLogoImg: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', flexShrink: 0,
  },
  bannerStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  bannerStatusDot: { width: 6, height: 6, borderRadius: 3 },
  bannerStatusText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  bottomBarWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', pointerEvents: 'box-none',
  },
  bottomBar: {
    flexDirection: 'row', borderRadius: 31, backgroundColor: colors.crema,
    paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 26, elevation: 20,
  },
  bottomBarItem: { alignItems: 'center', gap: 3, paddingHorizontal: 14, paddingVertical: 4 },
  bottomBarIconWrap: { position: 'relative' },
  bottomBarLabel: {
    fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.35)',
  },
  bottomBarLabelActive: { color: '#FFFFFF' },
  bottomBarLabelNav: { color: 'rgba(255,255,255,0.45)' },
  badgeDot: {
    position: 'absolute', top: -4, right: -7,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.arena, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeDotText: { fontFamily: fonts.archivo.bold, fontSize: 9, color: '#FFFFFF' },

  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 110, gap: 10 },

  obraCard: {
    borderRadius: 20, backgroundColor: colors.panel, padding: 16, gap: 8,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  obraHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  obraName: { fontFamily: fonts.archivo.bold, fontSize: 15.5, color: colors.crema, flex: 1, lineHeight: 21 },
  obraContractor: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, marginTop: -2 },
  obraFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  obraDate: { fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 0.4, color: colors.faint },
  pendInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendInlineText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: colors.arena },
  statusPill: {
    height: 24, borderRadius: 12, paddingHorizontal: 10,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusPillActive: { backgroundColor: colors.crema },
  pillText: { fontFamily: fonts.archivo.bold, fontSize: 9.5, letterSpacing: 0.3, color: colors.gris },
  pillTextActive: { color: '#FFFFFF' },
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

  planoRow: {
    backgroundColor: colors.panel, borderRadius: 16, padding: 16, gap: 9,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  planoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planoTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planoName: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, lineHeight: 20 },
  planoTypeBadge: {
    height: 18, paddingHorizontal: 7, borderRadius: 9, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  planoTypeText: { fontFamily: fonts.mono.regular, fontSize: 8, letterSpacing: 0.4, color: colors.gris },
  planoFormatTag: { fontFamily: fonts.mono.regular, fontSize: 8, letterSpacing: 0.8, color: colors.gris },
  planoDate: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.3 },

  sheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingBottom: 36, paddingTop: 12, gap: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },
  sheetFieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: -spacing.sm,
  },
  sheetInputWrap: { backgroundColor: colors.chip, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sheetInput: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, height: 42 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChipBtn: {
    height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  typeChipBtnActive: { backgroundColor: colors.crema },
  typeChipBtnText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.crema },
  typeChipBtnTextActive: { color: '#FFFFFF' },
  sheetBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sheetBtnDisabled: { opacity: 0.35 },
  sheetBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.1 },

  pendCard: {
    backgroundColor: colors.panel, borderRadius: 16, padding: 16, gap: 9,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  pendTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pendStatusDot: { width: 6, height: 6, borderRadius: 3 },
  pendStatusLabel: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.2 },
  pendDesc: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, lineHeight: 20 },
  pendObra: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3, flex: 1 },
  pendCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tradeChip: {
    height: 20, borderRadius: 10, paddingHorizontal: 8,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tradeText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3, color: colors.crema },
  pendDate: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },

  // Pendientes filters
  pendFiltersWrap: { gap: 8, marginBottom: 6 },
  rubroFilterStrip: { marginHorizontal: -spacing.xl },
  rubroFilterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl },
  rubroChip: {
    height: 30, borderRadius: 15, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  rubroChipActive: { backgroundColor: colors.crema },
  rubroChipText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.gris },
  rubroChipTextActive: { color: '#FFFFFF' },

  // Status sheet options
  statusOptions: { gap: 8 },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.chip, borderRadius: 18, padding: 16,
  },
  statusOptionActive: {
    backgroundColor: 'rgba(217,191,164,0.1)',
    borderWidth: 1.5, borderColor: colors.crema,
  },
  statusOptionDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.gris },
  statusOptionTextActive: { color: colors.crema },

  // Property profile card
  propCard: {
    backgroundColor: colors.panel, borderRadius: 18, padding: 14, gap: 12,
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  propTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  propTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    backgroundColor: 'rgba(217,119,87,0.10)',
  },
  propTypeBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.arena },
  propObraBadge: {
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  propObraBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.gris },
  propAnio: { fontFamily: fonts.mono.regular, fontSize: 11, color: colors.faint, marginLeft: 'auto' },
  propMetrosRow: { flexDirection: 'row', gap: 0 },
  propMetroItem: { flex: 1, alignItems: 'center', gap: 2 },
  propMetroVal: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.5 },
  propMetroLabel: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.4, textTransform: 'uppercase' },
  propDatosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  propDato: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.chip,
  },
  propDatoText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: colors.gris },
  propAmenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  propAmenityChip: {
    height: 22, paddingHorizontal: 8, borderRadius: 11,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  propAmenityText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: colors.gris },
  propFooter: { gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  propFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  propFooterText: { fontFamily: fonts.archivo.semibold, fontSize: 11, color: colors.gris, flex: 1 },
});
