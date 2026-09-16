import { useEffect, useRef, useState, Fragment } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStudio } from '../lib/use-studio';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'active' | 'done' | 'error';
interface Stage { id: string; label: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAN_PERIOD = 4000;

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

interface DetBox {
  label: string;
  left: `${number}%`; top: `${number}%`; width: `${number}%`; height: `${number}%`;
  color: string;
  revealAt: number;
}

const DET_BOXES: DetBox[] = [
  { label: 'COLUMNA',   left: '1%',  top: '1%',  width: '10%', height: '84%', color: colors.arena,   revealAt: 0.05 },
  { label: 'VIGA',      left: '12%', top: '12%', width: '26%', height: '22%', color: colors.arena,   revealAt: 0.09 },
  { label: 'FISURA ⚠',  left: '28%', top: '40%', width: '17%', height: '30%', color: colors.error,   revealAt: 0.24 },
  { label: 'REVOQUE',   left: '50%', top: '52%', width: '37%', height: '33%', color: colors.success, revealAt: 0.32 },
];

const ITEM_CHIPS = [
  { dot: colors.arena,   label: 'Fisura en viga invertida',           meta: 'Bloque C · Piso 2', badge: 'HORMIGÓN',    revealAt: 0.27 },
  { dot: colors.error,   label: 'Instalación expuesta sin protección', meta: 'Bloque C · UF 4',   badge: 'INSTALAC.',   revealAt: 0.42 },
  { dot: colors.success, label: 'Revoque terminado conforme',          meta: 'Bloque A · Piso 1', badge: 'TERMINAC.',   revealAt: 0.54 },
];

const STEP_DOTS = ['Subida', 'Frames', 'Análisis', 'Informe'];

// ─── Foto flow: original stage card ───────────────────────────────────────────

function ScaleIn({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

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
  return <Animated.Text style={[fotoStyles.activeDots, { opacity: op }]}>···</Animated.Text>;
}

function StageRow({ stage, status, progress }: { stage: Stage; status: StageStatus; progress?: number }) {
  const rowScale = useRef(new Animated.Value(1)).current;
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'pending' && status === 'active') {
      Animated.sequence([
        Animated.timing(rowScale, { toValue: 1.03, duration: 120, useNativeDriver: true }),
        Animated.spring(rowScale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
      ]).start();
    }
    prevStatus.current = status;
  }, [status]);

  const isDone = status === 'done', isActive = status === 'active';
  const isPending = status === 'pending', isError = status === 'error';

  return (
    <Animated.View style={[fotoStyles.stageRow, { transform: [{ scale: rowScale }] }]}>
      <View style={[fotoStyles.stageCircle, isPending && fotoStyles.stageCirclePending, isError && fotoStyles.stageCircleError]}>
        {isDone   && <ScaleIn><Feather name="check" size={13} color="#FFFFFF" /></ScaleIn>}
        {isActive && <PulsingDots />}
        {isPending && <Feather name="minus" size={11} color={colors.faint} />}
        {isError  && <ScaleIn><Feather name="x" size={13} color="#FFFFFF" /></ScaleIn>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[fotoStyles.stageLabel, isPending && fotoStyles.stageLabelPending]}>{stage.label}</Text>
        {isActive && progress !== undefined && (
          <View style={fotoStyles.progressTrack}>
            <View style={[fotoStyles.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Video flow: new animated screen ─────────────────────────────────────────

function AiDot() {
  const op = useRef(new Animated.Value(0.3)).current;
  const sc = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(op, { toValue: 1,   duration: 600, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(op, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[vidStyles.aiDot, { opacity: op, transform: [{ scale: sc }] }]} />
  );
}

function FrameScene({ scan }: { scan: Animated.Value }) {
  const overlayH = scan.interpolate({
    inputRange: [0, 0.62, 0.85, 0.851, 1],
    outputRange: ['100%', '0%', '0%', '100%', '100%'],
  });
  const lineOp = scan.interpolate({
    inputRange: [0, 0.62, 0.67, 0.85, 0.92, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });
  const boxOps = DET_BOXES.map(({ revealAt }) =>
    scan.interpolate({
      inputRange: [0, revealAt, Math.min(revealAt + 0.07, 0.62), 0.70, 0.77, 0.851, 1],
      outputRange: [0, 0, 1, 1, 0, 0, 0],
      extrapolate: 'clamp',
    })
  );

  return (
    <View style={vidStyles.frame}>
      <LinearGradient
        colors={['#362f26', '#2c2620', '#31281e']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Horizontal form lines (concrete texture) */}
      {[0.2, 0.4, 0.6, 0.8].map(y => (
        <View key={y} style={[vidStyles.textureLine, { top: `${y * 100}%` as `${number}%` }]} />
      ))}

      {/* Columns */}
      <LinearGradient
        colors={['rgba(210,185,155,0.13)', 'rgba(210,185,155,0.02)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[vidStyles.col, { left: 0, width: '11%', borderRightColor: 'rgba(210,185,155,0.15)', borderRightWidth: 1 }]}
      />
      <View style={[vidStyles.col, { left: '39%', width: '7%', borderColor: 'rgba(210,185,155,0.1)', borderWidth: 1, backgroundColor: 'rgba(210,185,155,0.05)' }]} />
      <View style={[vidStyles.col, { right: 0, width: '9%', borderColor: 'rgba(210,185,155,0.12)', borderWidth: 1, backgroundColor: 'rgba(210,185,155,0.08)' }]} />

      {/* Top beam */}
      <LinearGradient
        colors={['rgba(210,185,155,0.10)', 'rgba(210,185,155,0.01)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[vidStyles.col, { top: 0, left: 0, right: 0, height: '11%', width: undefined, borderBottomColor: 'rgba(210,185,155,0.12)', borderBottomWidth: 1 }]}
      />

      {/* Crack */}
      <View style={vidStyles.crack1} />
      <View style={vidStyles.crack2} />

      {/* Center lamp glow */}
      <View style={vidStyles.lampGlow} />

      {/* Detection boxes */}
      {DET_BOXES.map((box, i) => (
        <Animated.View key={i} style={[vidStyles.detBox, {
          left: box.left, top: box.top, width: box.width, height: box.height,
          borderColor: box.color, opacity: boxOps[i],
        }]}>
          <View style={[vidStyles.detLabel, { borderColor: box.color }]}>
            <Text style={[vidStyles.detLabelText, { color: box.color }]}>{box.label}</Text>
          </View>
          <View style={[vidStyles.detCorner, { top: -1.5, right: -1.5, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: box.color }]} />
          <View style={[vidStyles.detCorner, { bottom: -1.5, left: -1.5, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: box.color }]} />
        </Animated.View>
      ))}

      {/* HUD */}
      <Text style={[vidStyles.hud, vidStyles.hudTc]}>00:02:18</Text>
      <Text style={[vidStyles.hud, vidStyles.hudFr]}>F:327</Text>
      <View style={vidStyles.hudAi}>
        <AiDot />
        <Text style={vidStyles.hudAiText}>IA activa</Text>
      </View>

      {/* Corner brackets */}
      <View style={[vidStyles.corner, vidStyles.cornerTL]} />
      <View style={[vidStyles.corner, vidStyles.cornerTR]} />
      <View style={[vidStyles.corner, vidStyles.cornerBL]} />
      <View style={[vidStyles.corner, vidStyles.cornerBR]} />

      {/* Scan overlay */}
      <Animated.View style={[vidStyles.scanOverlay, { height: overlayH }]}>
        <Animated.View style={[vidStyles.scanLine, { opacity: lineOp }]} />
      </Animated.View>
    </View>
  );
}

function ItemChipRow({ chip, scan }: { chip: typeof ITEM_CHIPS[0]; scan: Animated.Value }) {
  const op = scan.interpolate({
    inputRange: [0, chip.revealAt, Math.min(chip.revealAt + 0.09, 0.62), 0.70, 0.77, 0.851, 1],
    outputRange: [0, 0, 1, 1, 0, 0, 0],
    extrapolate: 'clamp',
  });
  const ty = scan.interpolate({
    inputRange: [0, chip.revealAt, Math.min(chip.revealAt + 0.09, 0.62), 1],
    outputRange: [7, 7, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[vidStyles.itemChip, { opacity: op, transform: [{ translateY: ty }] }]}>
      <View style={[vidStyles.itemDot, { backgroundColor: chip.dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={vidStyles.itemName} numberOfLines={1}>{chip.label}</Text>
        <Text style={vidStyles.itemMeta}>{chip.meta}</Text>
      </View>
      <View style={vidStyles.itemBadge}>
        <Text style={vidStyles.itemBadgeText}>{chip.badge}</Text>
      </View>
    </Animated.View>
  );
}

function StepDots({ stageIndex, done }: { stageIndex: number; done: boolean }) {
  function dotState(i: number): 'done' | 'active' | 'pending' {
    if (done || i < stageIndex) return 'done';
    if (i === stageIndex) return 'active';
    return 'pending';
  }

  return (
    <View style={vidStyles.dotsRow}>
      {STEP_DOTS.map((label, i) => {
        const state = dotState(i);
        return (
          <Fragment key={i}>
            <View style={vidStyles.dotWrap}>
              <View style={[
                vidStyles.dot,
                state === 'done'   && vidStyles.dotDone,
                state === 'active' && vidStyles.dotActive,
              ]}>
                {state === 'done' && <Feather name="check" size={4} color="white" />}
              </View>
              <Text style={[vidStyles.dotLabel, state !== 'pending' && vidStyles.dotLabelActive]}>{label}</Text>
            </View>
            {i < STEP_DOTS.length - 1 && (
              <View style={[vidStyles.dotLine, state === 'done' && vidStyles.dotLineDone]} />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProcesandoScreen() {
  const router = useRouter();
  const { mode, type, videoUri, projectId, rubroId, note, fotoUrl, markersJson, comment } = useLocalSearchParams<{
    mode?: string; type?: string; videoUri?: string;
    projectId?: string; rubroId?: string; note?: string;
    fotoUrl?: string; markersJson?: string; comment?: string;
  }>();
  const { studio } = useStudio();

  const isFoto    = mode === 'foto';
  const typeLabel = type === 'oficina' ? 'OFICINA TÉCNICA' : 'CONTRATISTAS';
  const stages    = isFoto ? FOTO_STAGES : VIDEO_STAGES;
  const eyebrow   = isFoto ? `ANALIZANDO · FOTO · ${typeLabel}` : `PROCESANDO · ${typeLabel}`;

  const [stageIndex, setStageIndex]         = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone]                     = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);
  const [reportId, setReportId]             = useState<string | null>(null);
  const [frameNum, setFrameNum]             = useState(1);

  // Scan animation (drives everything in video mode)
  const scan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isFoto) return;
    const loop = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: SCAN_PERIOD, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    const listenerId = scan.addListener(({ value }) => {
      const f = value < 0.62 ? Math.round(1 + (value / 0.62) * 20) : 21;
      setFrameNum(f);
    });
    return () => { loop.stop(); scan.removeListener(listenerId); };
  }, [isFoto]);

  // Progress bar width (synced to scan while analyzing, or upload progress)
  const animatedProgress = scan.interpolate({
    inputRange: [0, 0.62, 0.85, 0.851, 1],
    outputRange: ['0%', '100%', '100%', '0%', '0%'],
  });

  // ── Foto flow ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFoto) return;
    async function runFoto() {
      try {
        setStageIndex(0);
        await new Promise(r => setTimeout(r, 400));
        setStageIndex(1);
        await new Promise(r => setTimeout(r, 500));
        setStageIndex(2);
        const markers = markersJson ? JSON.parse(markersJson) : [];
        const { data, error } = await supabase.functions.invoke('analyze-foto', {
          body: {
            project_id: projectId || null,
            rubro_id: rubroId || null,
            type: type ?? 'contratistas',
            foto_url: fotoUrl,
            markers,
            comment: comment || null,
          },
        });
        if (error) throw new Error(error.message ?? 'Error al analizar la foto');
        setStageIndex(3);
        await new Promise(r => setTimeout(r, 400));
        setStageIndex(4);
        setReportId(data.report_id);
        setTimeout(() => setDone(true), 300);
      } catch (e: any) {
        setErrorMsg(e.message ?? 'Ocurrió un error inesperado.');
      }
    }
    runFoto();
  }, [isFoto]);

  // ── Video flow ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFoto || !videoUri || !studio) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function run() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sin sesión activa');

        const ext = videoUri!.split('.').pop()?.toLowerCase() ?? 'mp4';
        const ALLOWED_VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', '3gp', 'webm'];
        if (!ALLOWED_VIDEO_EXTS.includes(ext)) throw new Error('Tipo de video no permitido.');
        const path = `${studio!.id}/${Date.now()}.${ext}`;
        const url  = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/processing/${path}`;

        const uploadTask = FileSystem.createUploadTask(
          url, videoUri!,
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
            if (totalBytesExpectedToSend > 0)
              setUploadProgress(totalBytesSent / totalBytesExpectedToSend);
          }
        );

        const result = await uploadTask.uploadAsync();
        if (!result || result.status >= 300)
          throw new Error('Error al subir el video. Verificá tu conexión.');

        const { data: report, error: insertErr } = await supabase
          .from('reports')
          .insert({
            project_id: projectId || null,
            rubro_id:   rubroId   || null,
            created_by: session.user.id,
            type:       type ?? 'contratistas',
            mode:       'video',
            note:       note || null,
            status:     'processing',
            video_path: path,
          })
          .select('id')
          .single();

        if (insertErr || !report)
          throw new Error(`Error al registrar el informe: ${insertErr?.message ?? 'sin datos'}`);

        setReportId(report.id);
        setStageIndex(1);

        channel = supabase
          .channel(`report_${report.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${report.id}` },
            (payload) => {
              const status = payload.new.status as string;
              if (status === 'processing')  setStageIndex(2);
              else if (status === 'completed') { setStageIndex(4); setDone(true); }
              else if (status === 'failed')    setErrorMsg('El servidor encontró un error al procesar el video.');
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
    if (done) return 'done';
    if (errorMsg && index === stageIndex) return 'error';
    if (index < stageIndex)  return 'done';
    if (index === stageIndex) return 'active';
    return 'pending';
  }

  // ── Foto UI (original) ─────────────────────────────────────────────────────
  if (isFoto) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.modeIcon}>
            <Feather name="camera" size={20} color={colors.gris} />
          </View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <View style={styles.card}>
            {stages.map((stage, i) => (
              <StageRow
                key={stage.id}
                stage={stage}
                status={getStatus(i)}
                progress={undefined}
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
            <Text style={styles.hint}>GPT-4o Vision analiza los marcadores</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Video UI (new) ─────────────────────────────────────────────────────────
  const statusLabel = done
    ? 'Informe listo'
    : stageIndex === 0
    ? 'Subiendo video'
    : stageIndex < 2
    ? 'Extrayendo frames'
    : 'Analizando frames';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={vidStyles.container}>

        {/* Header row */}
        <View style={vidStyles.headerRow}>
          <Text style={vidStyles.headerLabel}>PROCESANDO · {typeLabel}</Text>
          <View style={vidStyles.frameChip}>
            <Text style={vidStyles.frameChipNum}>{stageIndex >= 1 ? frameNum : 0}</Text>
            <Text style={vidStyles.frameChipLabel}>/ 21 frames</Text>
          </View>
        </View>

        {/* Frame scene */}
        <FrameScene scan={scan} />

        {/* Status + progress */}
        <View style={vidStyles.statusBlock}>
          <View style={vidStyles.statusTitleRow}>
            <Text style={vidStyles.statusTitle}>{statusLabel}</Text>
            {!done && !errorMsg && (
              <View style={vidStyles.statusDots}>
                {[0, 1, 2].map(i => <LDot key={i} delay={i * 150} />)}
              </View>
            )}
            {done && <Feather name="check-circle" size={16} color={colors.success} />}
          </View>
          <View style={vidStyles.progTrack}>
            {stageIndex === 0
              ? <View style={[vidStyles.progFill, { width: `${Math.round(uploadProgress * 100)}%` as `${number}%` }]} />
              : <Animated.View style={[vidStyles.progFill, { width: done ? '100%' : animatedProgress }]} />
            }
          </View>
        </View>

        {/* Detected items stream */}
        {stageIndex >= 1 && !done && (
          <View>
            <Text style={vidStyles.itemsLabel}>Elementos detectados</Text>
            <View style={vidStyles.itemsStream}>
              {ITEM_CHIPS.map((chip, i) => (
                <ItemChipRow key={i} chip={chip} scan={scan} />
              ))}
            </View>
          </View>
        )}

        {/* Step dots */}
        <StepDots stageIndex={Math.min(stageIndex, STEP_DOTS.length - 1)} done={done} />

        {/* Bottom actions */}
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
        ) : stageIndex > 0 ? (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Ir al inicio (el informe llegará cuando esté listo)</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>Subiendo el video, no cierres la app</Text>
        )}

      </View>
    </SafeAreaView>
  );
}

function LDot({ delay }: { delay: number }) {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.2, duration: 350, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[vidStyles.ldot, { opacity: op }]} />;
}

// ─── Styles: shared ───────────────────────────────────────────────────────────

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
    textTransform: 'uppercase', color: colors.gris, textAlign: 'center',
  },
  card: {
    width: '100%', backgroundColor: colors.panel, borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 6,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3,
  },
  hint: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.5,
    color: colors.faint, textAlign: 'center', textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
  },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.error, textAlign: 'center' },
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

// ─── Styles: foto stage row ───────────────────────────────────────────────────

const fotoStyles = StyleSheet.create({
  stageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stageCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stageCirclePending: { backgroundColor: colors.chip },
  stageCircleError:   { backgroundColor: colors.error },
  activeDots: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },
  stageLabel: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  stageLabelPending: { color: colors.faint, fontFamily: fonts.archivo.semibold },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.chip, marginTop: 5, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: 2, backgroundColor: colors.crema },
});

// ─── Styles: video new UI ─────────────────────────────────────────────────────

const vidStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 14,
    justifyContent: 'center',
  },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.gris,
  },
  frameChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  frameChipNum: { fontFamily: fonts.mono.medium, fontSize: 11, color: colors.arena, minWidth: 16, textAlign: 'right' },
  frameChipLabel: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris },

  // Frame
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2C2620',
  },
  textureLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(200,175,140,0.04)' },
  col: { position: 'absolute', top: 0, bottom: 0 },
  crack1: {
    position: 'absolute', left: '32%', top: '44%',
    width: 1, height: '28%', backgroundColor: 'rgba(180,155,120,0.15)',
    transform: [{ rotate: '7deg' }],
  },
  crack2: {
    position: 'absolute', left: '62%', top: '54%',
    width: 1, height: '18%', backgroundColor: 'rgba(180,155,120,0.09)',
    transform: [{ rotate: '-4deg' }],
  },
  lampGlow: {
    position: 'absolute', left: '35%', top: '15%',
    width: '50%', height: '50%', borderRadius: 999,
    backgroundColor: 'rgba(220,190,140,0.06)',
  },

  // Detection boxes
  detBox: { position: 'absolute', borderWidth: 1.5, borderRadius: 3 },
  detLabel: {
    position: 'absolute', top: -15, left: -1,
    backgroundColor: 'rgba(18,21,26,0.9)', borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  detLabelText: { fontFamily: fonts.mono.regular, fontSize: 7, letterSpacing: 0.5 },
  detCorner: { position: 'absolute', width: 6, height: 6 },

  // HUD
  hud: { position: 'absolute', fontFamily: fonts.mono.regular, fontSize: 7.5, letterSpacing: 0.4 },
  hudTc:    { top: 7, right: 9, color: 'rgba(217,119,87,0.5)' },
  hudFr:    { top: 7, left: 9,  color: 'rgba(217,119,87,0.3)' },
  hudAi:    { position: 'absolute', bottom: 8, left: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.arena },
  hudAiText:{ fontFamily: fonts.mono.regular, fontSize: 7, color: 'rgba(217,119,87,0.55)', letterSpacing: 0.3 },

  // Corner brackets
  corner: { position: 'absolute', width: 11, height: 11 },
  cornerTL: { top: 5, left: 5,   borderTopWidth: 1.5, borderLeftWidth: 1.5,   borderColor: 'rgba(217,119,87,0.3)' },
  cornerTR: { top: 5, right: 5,  borderTopWidth: 1.5, borderRightWidth: 1.5,  borderColor: 'rgba(217,119,87,0.3)' },
  cornerBL: { bottom: 5, left: 5,  borderBottomWidth: 1.5, borderLeftWidth: 1.5,  borderColor: 'rgba(217,119,87,0.3)' },
  cornerBR: { bottom: 5, right: 5, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: 'rgba(217,119,87,0.3)' },

  // Scan
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#2C2620', zIndex: 4 },
  scanLine: {
    position: 'absolute', bottom: -1, left: '4%', right: '4%',
    height: 2, borderRadius: 2,
    backgroundColor: colors.arena,
    shadowColor: colors.arena, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6,
  },

  // Status block
  statusBlock: { gap: 8 },
  statusTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontFamily: fonts.archivo.bold, fontSize: 16, letterSpacing: -0.3, color: colors.crema, flex: 1 },
  statusDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ldot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.arena },
  progTrack: { height: 3, borderRadius: 2, backgroundColor: colors.chip, overflow: 'hidden' },
  progFill:  { height: 3, borderRadius: 2, backgroundColor: colors.arena },

  // Items
  itemsLabel: {
    fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', color: colors.faint, marginBottom: 6,
  },
  itemsStream: { gap: 6, minHeight: 116 },
  itemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: colors.panel, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  itemDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  itemName: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.crema, letterSpacing: -0.1 },
  itemMeta: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.faint, letterSpacing: 0.3, marginTop: 1 },
  itemBadge: { backgroundColor: colors.chip, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemBadgeText: { fontFamily: fonts.mono.regular, fontSize: 8, color: colors.gris, letterSpacing: 0.6, textTransform: 'uppercase' },

  // Step dots
  dotsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2 },
  dotWrap: { alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chip, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotDone:   { backgroundColor: colors.arena, borderColor: colors.arena },
  dotActive: {
    backgroundColor: colors.arena, borderColor: colors.arena,
    shadowColor: colors.arena, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 3,
  },
  dotLabel: { fontFamily: fonts.mono.regular, fontSize: 7.5, letterSpacing: 0.3, color: colors.faint },
  dotLabelActive: { color: colors.gris },
  dotLine: { flex: 1, height: 1.5, backgroundColor: colors.border, maxWidth: 48, marginTop: 3.5 },
  dotLineDone: { backgroundColor: colors.arena, opacity: 0.5 },
});
