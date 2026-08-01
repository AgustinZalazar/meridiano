import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'pendiente' | 'en_revision' | 'resuelto';
type Source = 'ai' | 'manual';

interface MockPendiente {
  description: string;
  project: string;
  obra: string;
  trade?: string;
  status: Status;
  source: Source;
  imageUri?: string;
  // AI-specific
  frameNote?: string;
  reportName?: string;
  reportDate?: string;
  reportType?: 'contratistas' | 'oficina';
  aiAnalysis?: string;
  pdfName?: string;
  pdfSize?: string;
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

const MOCK: Record<string, MockPendiente> = {
  '1': {
    description: 'Empalme de cables sin protección en tablero del subsuelo. Riesgo eléctrico inmediato.',
    project: 'Edificio Palermo Norte',
    obra: 'Instalaciones Eléctricas',
    trade: 'Electricidad',
    status: 'pendiente',
    source: 'ai',
    imageUri: 'https://picsum.photos/id/1048/800/500',
    frameNote: 'Frame 11 · t=0:44',
    reportName: 'Visita de obra · 20 jul 2026',
    reportDate: '20 jul 2026',
    reportType: 'contratistas',
    aiAnalysis: 'En el sector del tablero eléctrico de subsuelo se detectan conductores empatados sin borneras ni cinta aisladora. Los terminales quedan expuestos al contacto directo. La zona presenta humedad en el piso, lo que incrementa el riesgo. Se recomienda intervención inmediata del contratista eléctrico antes de continuar con el avance de la obra en este sector.',
    pdfName: 'Informe_Contratistas_20jul2026.pdf',
    pdfSize: '1.2 MB',
  },
  '2': {
    description: 'Fisura diagonal en muro de contención sector C. Requiere evaluación estructural.',
    project: 'Edificio Palermo Norte',
    obra: 'Trabajos de Hormigón',
    trade: 'Estructura',
    status: 'en_revision',
    source: 'ai',
    imageUri: 'https://picsum.photos/id/1040/800/500',
    frameNote: 'Frame 38 · t=2:32',
    reportName: 'Visita de obra · 19 jul 2026',
    reportDate: '19 jul 2026',
    reportType: 'contratistas',
    aiAnalysis: 'Se observa fisura diagonal de aproximadamente 40 cm de longitud en el paño central del muro de contención del sector C. El patrón de la fisura es consistente con esfuerzos de corte. El hormigón adyacente no presenta disgregación aparente. Se requiere evaluación presencial del ingeniero estructural para determinar si es fisura superficial o de mayor profundidad antes de continuar con el relleno lateral.',
    pdfName: 'Informe_Contratistas_19jul2026.pdf',
    pdfSize: '980 KB',
  },
  '3': {
    description: 'Pendiente de aprobación: certificado de avance de obra mes de julio.',
    project: 'Edificio Palermo Norte',
    obra: 'Administración General',
    status: 'pendiente',
    source: 'manual',
  },
  '4': {
    description: 'Cañería de agua fría sin aislación térmica en tramo de 8m en planta 3.',
    project: 'Edificio Palermo Norte',
    obra: 'Instalaciones Sanitarias',
    trade: 'Plomería',
    status: 'pendiente',
    source: 'ai',
    imageUri: 'https://picsum.photos/id/366/800/500',
    frameNote: 'Frame 24 · t=1:36',
    reportName: 'Visita de obra · 17 jul 2026',
    reportDate: '17 jul 2026',
    reportType: 'contratistas',
    aiAnalysis: 'En la planta 3, tramo entre el shaft sanitario y el baño del dormitorio principal, se identifican aproximadamente 8 metros de cañería de PVC para agua fría sin cobertura de aislación. En un futuro, la diferencia de temperatura con la losa puede provocar condensación y daños en el cielorraso. El contratista sanitario debe completar el aislamiento con coquilla antes del cierre.',
    pdfName: 'Informe_Contratistas_17jul2026.pdf',
    pdfSize: '1.4 MB',
  },
  '5': {
    description: 'Planos As-Built de instalaciones eléctricas sin actualizar. Vence plazo el 31/07.',
    project: 'Edificio Palermo Norte',
    obra: '—',
    status: 'pendiente',
    source: 'manual',
  },
  '6': {
    description: 'Memoria de cálculo estructural pendiente de revisión por parte de dirección de obra.',
    project: 'Edificio Palermo Norte',
    obra: 'Trabajos de Hormigón',
    trade: 'Estructura',
    status: 'en_revision',
    source: 'manual',
  },
  '7': {
    description: 'Cronograma actualizado sin firma del contratista principal.',
    project: 'Edificio Palermo Norte',
    obra: '—',
    status: 'resuelto',
    source: 'manual',
  },
  '8': {
    description: 'Andamio tubular sin red de protección en fachada norte, pisos 4 al 7.',
    project: 'Edificio Palermo Norte',
    obra: 'Trabajos de Hormigón',
    trade: 'Seguridad',
    status: 'resuelto',
    source: 'ai',
    imageUri: 'https://picsum.photos/id/1074/800/500',
    frameNote: 'Frame 62 · t=4:08',
    reportName: 'Visita de obra · 13 jul 2026',
    reportDate: '13 jul 2026',
    reportType: 'contratistas',
    aiAnalysis: 'El andamio tubular instalado en la fachada norte, desde el piso 4 hasta el 7, no cuenta con red de seguridad perimetral. Se observa también ausencia de rodapié en el nivel 5. Según la normativa vigente (Decreto 911/96), todo andamio a más de 2m de altura debe contar con red de contención. Se marcó como resuelto luego de verificar la colocación de la red en visita del 16/07.',
    pdfName: 'Informe_Contratistas_13jul2026.pdf',
    pdfSize: '1.1 MB',
  },
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'pendiente',   label: 'Pendiente'   },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'resuelto',    label: 'Resuelto'    },
];

const STATUS_COLOR: Record<Status, string> = {
  pendiente:   colors.crema,
  en_revision: colors.arena,
  resuelto:    colors.success,
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DetallePendienteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = MOCK[id ?? '1'] ?? MOCK['1'];

  const [status, setStatus] = useState<Status>(data.status);
  const [note, setNote] = useState('');

  const isAI = data.source === 'ai';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={18} color={colors.crema} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
            <Feather name="share-2" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>

        {/* Frame image — solo si viene de IA */}
        {isAI && data.imageUri ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: data.imageUri }} style={styles.image} resizeMode="cover" />
            <View style={styles.frameBadgeRow}>
              <View style={styles.frameBadge}>
                <Feather name="film" size={10} color={colors.gris} />
                <Text style={styles.frameBadgeText}>{data.frameNote}</Text>
              </View>
              <View style={[styles.frameBadge, { backgroundColor: 'rgba(18,21,26,0.7)' }]}>
                <Feather name="cpu" size={10} color={colors.arena} />
                <Text style={[styles.frameBadgeText, { color: colors.arena }]}>Detectado por IA</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>

          {/* Eyebrow */}
          <Text style={styles.eyebrow}>{data.project} · {data.obra}</Text>

          {/* Issue title */}
          <Text style={styles.description}>{data.description}</Text>

          {/* Trade + source chips */}
          <View style={styles.chipRow}>
            {data.trade ? (
              <View style={styles.tradeChip}>
                <Text style={styles.tradeText}>{data.trade.toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={[styles.sourceChip, isAI && styles.sourceChipAI]}>
              <Feather name={isAI ? 'cpu' : 'edit-3'} size={10} color={isAI ? colors.arena : colors.gris} />
              <Text style={[styles.sourceChipText, isAI && styles.sourceChipTextAI]}>
                {isAI ? 'Generado por IA' : 'Manual'}
              </Text>
            </View>
          </View>

          {/* ── Análisis de IA ─────────────────────────────────── */}
          {isAI && data.aiAnalysis ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="cpu" size={12} color={colors.arena} />
                <Text style={[styles.sectionLabel, { color: colors.arena }]}>ANÁLISIS DE IA</Text>
              </View>
              <View style={styles.aiCard}>
                <Text style={styles.aiText}>{data.aiAnalysis}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Contexto del informe ──────────────────────────── */}
          {isAI && data.reportName ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={12} color={colors.gris} />
                <Text style={styles.sectionLabel}>INFORME DE ORIGEN</Text>
              </View>
              <View style={styles.infoCardShadow}>
                <View style={styles.infoCard}>
                  <InfoRow icon="calendar" label="Fecha" value={data.reportDate ?? ''} />
                  <View style={styles.infoRowDivider} />
                  <InfoRow icon="tag" label="Tipo" value={data.reportType === 'contratistas' ? 'Contratistas' : 'Oficina técnica'} />
                  <View style={styles.infoRowDivider} />
                  <InfoRow icon="film" label="Frame" value={data.frameNote ?? ''} />
                </View>
              </View>
            </View>
          ) : null}

          {/* ── PDF del informe ──────────────────────────────── */}
          {isAI && data.pdfName ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file" size={12} color={colors.gris} />
                <Text style={styles.sectionLabel}>DOCUMENTO</Text>
              </View>
              <View style={styles.pdfCard}>
                <View style={styles.pdfIcon}>
                  <Text style={styles.pdfIconText}>PDF</Text>
                </View>
                <View style={styles.pdfMeta}>
                  <Text style={styles.pdfName} numberOfLines={1}>{data.pdfName}</Text>
                  <Text style={styles.pdfSize}>{data.pdfSize}</Text>
                </View>
                <View style={styles.pdfActions}>
                  <TouchableOpacity style={styles.pdfBtn} activeOpacity={0.75}>
                    <Feather name="download" size={15} color={colors.crema} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pdfBtn} activeOpacity={0.75}>
                    <Feather name="share-2" size={15} color={colors.crema} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Estado ───────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="activity" size={12} color={colors.gris} />
              <Text style={styles.sectionLabel}>ESTADO</Text>
            </View>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.statusBtn,
                    status === opt.value && { backgroundColor: STATUS_COLOR[opt.value] + '22', borderColor: STATUS_COLOR[opt.value] },
                  ]}
                  onPress={() => setStatus(opt.value)}
                  activeOpacity={0.8}
                >
                  {status === opt.value && (
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[opt.value] }]} />
                  )}
                  <Text style={[
                    styles.statusBtnText,
                    status === opt.value && { color: STATUS_COLOR[opt.value] },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Nota ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="edit-3" size={12} color={colors.gris} />
              <Text style={styles.sectionLabel}>NOTA</Text>
            </View>
            <View style={styles.noteField}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Agregar observación o resolución…"
                placeholderTextColor={colors.faint}
                multiline
                numberOfLines={3}
                selectionColor={colors.crema}
              />
            </View>
          </View>

          {/* CTAs */}
          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/solicitud-cambio')} activeOpacity={0.85}>
            <Feather name="git-pull-request" size={15} color={colors.crema} />
            <Text style={styles.btnSecondaryText}>Solicitud de cambio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Guardar cambios</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Info row helper ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Feather name={icon} size={12} color={colors.gris} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { paddingBottom: 48 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },

  imageWrap: {
    marginHorizontal: spacing.xl, borderRadius: 24, overflow: 'hidden',
    height: 220, backgroundColor: colors.chip,
  },
  image: { width: '100%', height: '100%' },
  frameBadgeRow: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  frameBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(18,21,26,0.65)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  frameBadgeText: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3,
  },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },

  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.gris,
  },
  description: {
    fontFamily: fonts.archivo.bold, fontSize: 19, color: colors.crema,
    lineHeight: 27, letterSpacing: -0.3,
  },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tradeChip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  tradeText: { fontFamily: fonts.archivo.bold, fontSize: 10.5, letterSpacing: 0.4, color: colors.crema },
  sourceChip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 5,
  },
  sourceChipAI: { backgroundColor: 'rgba(217,119,87,0.1)', borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)' },
  sourceChipText: { fontFamily: fonts.archivo.bold, fontSize: 10.5, color: colors.gris },
  sourceChipTextAI: { color: colors.arena },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },

  aiCard: {
    backgroundColor: 'rgba(217,119,87,0.07)',
    borderWidth: 1, borderColor: 'rgba(217,119,87,0.15)',
    borderRadius: 18, padding: spacing.md,
  },
  aiText: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema,
    lineHeight: 22,
  },

  infoCardShadow: {
    borderRadius: 18, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoCard: {
    borderRadius: 18, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 13,
    backgroundColor: colors.panel,
  },
  infoRowDivider: {
    height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md,
  },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  infoValue: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },

  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusBtn: {
    flex: 1, height: 42, borderRadius: 21, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.gris },

  noteField: {
    backgroundColor: colors.panel, borderRadius: 16,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  noteInput: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, minHeight: 72,
  },

  pdfCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.panel, borderRadius: 18, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pdfIcon: {
    width: 46, height: 54, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pdfIconText: {
    fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1, fontWeight: '700',
    color: '#DC2626',
  },
  pdfMeta: { flex: 1, gap: 3 },
  pdfName: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  pdfSize: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris, letterSpacing: 0.3 },
  pdfActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  pdfBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },

  btnSecondary: {
    height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSecondaryText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.crema },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
