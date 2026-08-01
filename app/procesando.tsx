import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStudio } from '../lib/use-studio';

type StageStatus = 'pending' | 'active' | 'done' | 'error';

interface Stage { id: string; label: string }

const VIDEO_STAGES: Stage[] = [
  { id: 'upload',  label: 'Subiendo video' },
  { id: 'frames',  label: 'Extrayendo frames' },
  { id: 'audio',   label: 'Transcribiendo audio' },
  { id: 'report',  label: 'Generando informe' },
  { id: 'done',    label: 'Listo' },
];

const FOTO_STAGES: Stage[] = [
  { id: 'upload',  label: 'Foto recibida' },
  { id: 'markers', label: 'Marcadores procesados' },
  { id: 'vision',  label: 'Analizando con GPT-4o Vision' },
  { id: 'report',  label: 'Generando pendientes' },
  { id: 'done',    label: 'Listo' },
];

const FOTO_DELAYS = [600, 1400, 3200, 4600];

function PulsingDots() {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, [op]);
  return <Animated.Text style={[styles.activeDots, { opacity: op }]}>···</Animated.Text>;
}

function StageRow({
  stage, status, progress,
}: {
  stage: Stage; status: StageStatus; progress?: number;
}) {
  const isDone    = status === 'done';
  const isActive  = status === 'active';
  const isPending = status === 'pending';
  const isError   = status === 'error';

  return (
    <View style={[styles.stageRow, isPending && styles.stageRowPending]}>
      <View style={[
        styles.stageCircle,
        isPending && styles.stageCirclePending,
        isError && styles.stageCircleError,
      ]}>
        {isDone   && <Feather name="check" size={13} color="#FFFFFF" />}
        {isActive && <PulsingDots />}
        {isPending && <Feather name="minus" size={11} color={colors.faint} />}
        {isError  && <Feather name="x" size={13} color="#FFFFFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stageLabel, isPending && styles.stageLabelPending]}>
          {stage.label}
        </Text>
        {isActive && progress !== undefined && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

export default function ProcesandoScreen() {
  const router = useRouter();
  const { mode, type, videoUri, projectId, rubroId, note } = useLocalSearchParams<{
    mode?: string; type?: string; videoUri?: string;
    projectId?: string; rubroId?: string; note?: string;
  }>();
  const { studio } = useStudio();

  const isFoto   = mode === 'foto';
  const typeLabel = type === 'oficina' ? 'OFICINA TÉCNICA' : 'CONTRATISTAS';
  const stages    = isFoto ? FOTO_STAGES : VIDEO_STAGES;
  const eyebrow   = isFoto ? `ANALIZANDO · FOTO · ${typeLabel}` : `PROCESANDO · ${typeLabel}`;

  const [stageIndex, setStageIndex]       = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone]                   = useState(false);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [reportId, setReportId]           = useState<string | null>(null);

  // ── Foto flow (mock — backend pendiente) ──────────────────────
  useEffect(() => {
    if (!isFoto) return;
    setStageIndex(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    FOTO_DELAYS.forEach((delay, index) => {
      timers.push(setTimeout(() => {
        setStageIndex(index + 1);
        if (index === FOTO_DELAYS.length - 1) setTimeout(() => setDone(true), 500);
      }, delay));
    });
    return () => timers.forEach(clearTimeout);
  }, [isFoto]);

  // ── Video flow ─────────────────────────────────────────────────
  useEffect(() => {
    if (isFoto || !videoUri || !studio) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function run() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sin sesión activa');

        // 1. Upload video to processing bucket
        const ext  = videoUri!.split('.').pop()?.toLowerCase() ?? 'mp4';
        const path = `${studio!.id}/${Date.now()}.${ext}`;
        const url  = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/processing/${path}`;

        const uploadTask = FileSystem.createUploadTask(
          url,
          videoUri!,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': `video/${ext}`,
              'x-upsert': 'true',
            },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            if (totalBytesExpectedToSend > 0) {
              setUploadProgress(totalBytesSent / totalBytesExpectedToSend);
            }
          }
        );

        const result = await uploadTask.uploadAsync();
        if (!result || result.status >= 300) {
          throw new Error('Error al subir el video. Verificá tu conexión.');
        }

        // 2. Create report record (include video_path so the server knows what to process)
        const { data: report, error: insertErr } = await supabase
          .from('reports')
          .insert({
            project_id:  projectId  || null,
            rubro_id:    rubroId    || null,
            created_by:  session.user.id,
            type:        type ?? 'contratistas',
            mode:        'video',
            note:        note || null,
            status:      'processing',
            video_path:  path,
          })
          .select('id')
          .single();

        if (insertErr || !report) throw new Error(`Error al registrar el informe: ${insertErr?.message ?? 'sin datos'}`);

        setReportId(report.id);
        setStageIndex(1); // upload done, waiting for server

        // 3. Subscribe to status changes via Realtime
        channel = supabase
          .channel(`report_${report.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${report.id}` },
            (payload) => {
              const status = payload.new.status as string;
              if (status === 'processing') setStageIndex(2);
              else if (status === 'completed') {
                setStageIndex(4);
                setDone(true);
              } else if (status === 'failed') {
                setErrorMsg('El servidor encontró un error al procesar el video.');
              }
            }
          )
          .subscribe();

      } catch (e: any) {
        setErrorMsg(e.message ?? 'Ocurrió un error inesperado.');
      }
    }

    run();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [studio?.id, videoUri]);

  function getStatus(index: number): StageStatus {
    if (errorMsg && index === stageIndex) return 'error';
    if (index < stageIndex)  return 'done';
    if (index === stageIndex) return 'active';
    return 'pending';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.modeIcon}>
          <Feather name={isFoto ? 'camera' : 'video'} size={20} color={colors.gris} />
        </View>

        <Text style={styles.eyebrow}>{eyebrow}</Text>

        <View style={styles.card}>
          {stages.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              status={getStatus(i)}
              progress={!isFoto && i === 0 && stageIndex === 0 ? uploadProgress : undefined}
            />
          ))}
        </View>

        {errorMsg ? (
          <>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Volver</Text>
            </TouchableOpacity>
          </>
        ) : done ? (
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => router.replace(`/informe/${reportId ?? 'demo'}?type=${type ?? 'contratistas'}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.viewBtnText}>Ver informe  →</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.hint}>
              {stageIndex === 0
                ? 'Subiendo el video, no cierres la app'
                : isFoto
                  ? 'GPT-4o Vision analiza los marcadores'
                  : 'El servidor está procesando el video (1–3 min)'}
            </Text>
            {stageIndex > 0 && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Ir al inicio (el informe llegará cuando esté listo)</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl + spacing.sm, gap: spacing.lg,
  },
  modeIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700', textAlign: 'center',
  },
  card: {
    width: '100%', backgroundColor: colors.panel, borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 6,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3,
  },
  stageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stageRowPending: {},
  stageCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stageCirclePending: { backgroundColor: colors.chip },
  stageCircleError:   { backgroundColor: colors.error },
  activeDots: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },
  stageLabel: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  stageLabelPending: { color: colors.faint, fontFamily: fonts.archivo.semibold },
  progressTrack: {
    height: 3, borderRadius: 2, backgroundColor: colors.chip,
    marginTop: 5, overflow: 'hidden',
  },
  progressFill: {
    height: 3, borderRadius: 2, backgroundColor: colors.crema,
  },
  hint: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.5,
    color: colors.faint, textAlign: 'center', textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontFamily: fonts.archivo.semibold, fontSize: 14,
    color: colors.error, textAlign: 'center',
  },
  viewBtn: {
    width: '100%', height: 54, borderRadius: 27, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  viewBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: {
    fontFamily: fonts.archivo.semibold, fontSize: 13,
    color: colors.gris, textDecorationLine: 'underline', textAlign: 'center',
  },
});
