import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type RubroStatus = 'sin_iniciar' | 'en_curso' | 'completada';

interface DbProject {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

interface DbRubro {
  id: string;
  name: string;
  contractor: string | null;
  status: RubroStatus;
  start_date: string | null;
  end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
}

// ─── Gantt constants ─────────────────────────────────────────────────────────

const LABEL_W = 88;
const MONTH_W = 60;
const ROW_H   = 44;
const HDR_H   = 32;
const BAR_H   = 8;
const BAR_R   = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtShort(s: string | null): string {
  const d = parseDate(s);
  if (!d) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    .replace('.', '').toUpperCase();
}

function getMonths(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function isDelayed(r: DbRubro, today: Date): boolean {
  if (r.status === 'en_curso' && r.end_date) {
    const end = parseDate(r.end_date);
    return end !== null && today > end;
  }
  if (r.status === 'completada' && r.actual_end_date && r.end_date) {
    const planned = parseDate(r.end_date);
    const actual = parseDate(r.actual_end_date);
    return planned !== null && actual !== null && actual > planned;
  }
  return false;
}

function deviation(r: DbRubro, today: Date): number | null {
  if (r.status === 'completada' && r.actual_end_date && r.end_date) {
    const planned = parseDate(r.end_date);
    const actual  = parseDate(r.actual_end_date);
    if (planned && actual) return daysBetween(planned, actual);
  }
  if (r.status === 'en_curso' && r.end_date && isDelayed(r, today)) {
    const planned = parseDate(r.end_date);
    if (planned) return daysBetween(planned, today);
  }
  return null;
}

function rubroBarColor(r: DbRubro, today: Date): string {
  if (r.status === 'completada') return colors.success;
  if (isDelayed(r, today)) return colors.error;
  if (r.status === 'en_curso') return colors.arena;
  return 'transparent';
}

function xFor(date: Date, pStart: Date, pEnd: Date, chartW: number): number {
  const pct = Math.max(0, Math.min(1, (date.getTime() - pStart.getTime()) / (pEnd.getTime() - pStart.getTime())));
  return LABEL_W + pct * chartW;
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function buildReportHTML(proj: DbProject, rubs: DbRubro[], today: Date): string {
  const rows = rubs.map(r => {
    const delayed = isDelayed(r, today);
    const dev = deviation(r, today);
    let statusLabel = 'Sin iniciar', statusColor = '#8A93A0';
    if (delayed)                     { statusLabel = 'Retrasado';  statusColor = '#C0392B'; }
    else if (r.status === 'completada') { statusLabel = 'Completado'; statusColor = '#4A7C59'; }
    else if (r.status === 'en_curso')   { statusLabel = 'En curso';   statusColor = '#D97757'; }
    const devText = dev === null ? '—' : dev < 0 ? `${Math.abs(dev)} días antes` : dev > 0 ? `+${dev} días` : 'En tiempo';
    const devColor = dev !== null && dev > 0 ? '#C0392B' : dev !== null && dev < 0 ? '#4A7C59' : '#8A93A0';
    const actualEnd = r.actual_end_date ? fmtShort(r.actual_end_date) : r.status === 'en_curso' ? 'en curso' : '—';
    return `<tr>
      <td>${r.name}${r.contractor ? `<br><span class="sub">${r.contractor}</span>` : ''}</td>
      <td>${fmtShort(r.start_date)} → ${fmtShort(r.end_date)}</td>
      <td>${fmtShort(r.actual_start_date)} → ${actualEnd}</td>
      <td style="color:${statusColor};font-weight:700">${statusLabel}</td>
      <td style="color:${devColor};font-weight:700">${devText}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,sans-serif;margin:32px;color:#12151A;background:#F7F4EE}
    h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0 0 4px}
    .ey{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#8A93A0;margin-bottom:24px}
    .meta{display:flex;gap:16px;margin-bottom:28px;padding:16px;background:white;border-radius:12px}
    .stat{flex:1;text-align:center}.sn{font-size:26px;font-weight:700}.sl{font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#8A93A0}
    table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden}
    th{font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#8A93A0;padding:10px 14px;text-align:left;border-bottom:1px solid #E8E3DA}
    td{font-size:12px;padding:10px 14px;border-bottom:1px solid #E8E3DA;vertical-align:top}
    tr:last-child td{border-bottom:none}.sub{font-size:10px;color:#8A93A0}
    .foot{font-size:10px;color:#8A93A0;text-align:right;margin-top:20px}
  </style></head><body>
    <div class="ey">MERIDIANO · CRONOGRAMA</div>
    <h1>${proj.name}</h1>
    <p style="color:#8A93A0;font-size:12px;margin:4px 0 24px">${fmtShort(proj.start_date)} → ${fmtShort(proj.end_date)}</p>
    <div class="meta">
      <div class="stat"><div class="sn" style="color:#4A7C59">${rubs.filter(r => r.status === 'completada').length}</div><div class="sl">Completados</div></div>
      <div class="stat"><div class="sn" style="color:#D97757">${rubs.filter(r => r.status === 'en_curso').length}</div><div class="sl">En curso</div></div>
      <div class="stat"><div class="sn" style="color:#C0392B">${rubs.filter(r => isDelayed(r, today)).length}</div><div class="sl">Retrasados</div></div>
      <div class="stat"><div class="sn">${rubs.length}</div><div class="sl">Total</div></div>
    </div>
    <table><thead><tr><th>RUBRO</th><th>PLANIFICADO</th><th>REAL</th><th>ESTADO</th><th>DESVÍO</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="foot">Generado el ${today.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} · Meridiano</p>
  </body></html>`;
}

// ─── Count-up number ─────────────────────────────────────────────────────────

function CountUp({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisp(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 700, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={style}>{disp}</Text>;
}

// ─── Gantt chart ─────────────────────────────────────────────────────────────

function GanttChart({ rubros, projectStart, projectEnd }: {
  rubros: DbRubro[];
  projectStart: Date;
  projectEnd: Date;
}) {
  const barProgress = useRef(new Animated.Value(0)).current;
  const todayGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barProgress, {
      toValue: 1, duration: 1000, delay: 250,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(todayGlow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(todayGlow, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, []);

  const today = new Date();
  const months = getMonths(projectStart, projectEnd);
  const CHART_W = months.length * MONTH_W;
  const TOTAL_W = LABEL_W + CHART_W;
  const TOTAL_H = HDR_H + rubros.length * ROW_H;
  const todayX  = xFor(today, projectStart, projectEnd, CHART_W);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: TOTAL_W, height: TOTAL_H }}>

        {/* Month columns */}
        {months.map((m, i) => {
          const x1 = xFor(m, projectStart, projectEnd, CHART_W);
          const next = new Date(m); next.setMonth(next.getMonth() + 1);
          const x2 = Math.min(xFor(next, projectStart, projectEnd, CHART_W), TOTAL_W);
          const label = m.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase();
          return (
            <View key={i} style={[StyleSheet.absoluteFill, { left: x1, right: TOTAL_W - x2 }]}>
              {i % 2 === 1 && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,21,26,0.025)', top: HDR_H }]} />
              )}
              <View style={[g.monthLine, { left: 0, top: HDR_H }]} />
              <View style={[g.monthLabelWrap, { left: 0, width: x2 - x1 }]}>
                <Text style={g.monthLabel}>{label}</Text>
              </View>
            </View>
          );
        })}

        {/* Label column cover (keeps it clean on top of alternating stripes) */}
        <View style={{ position: 'absolute', left: 0, top: HDR_H, bottom: 0, width: LABEL_W, backgroundColor: colors.panel }} pointerEvents="none" />

        {/* Today line */}
        {todayX >= LABEL_W && todayX <= TOTAL_W && (
          <Animated.View style={[g.todayLine, { left: todayX, opacity: todayGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}>
            <Text style={g.todayLabel}>HOY</Text>
          </Animated.View>
        )}

        {/* Rubro rows */}
        {rubros.map((r, i) => {
          const rowTop = HDR_H + i * ROW_H;
          const barTop = rowTop + ROW_H / 2 - BAR_H / 2;
          const delayed = isDelayed(r, today);

          const barBg =
            r.status === 'completada' ? colors.success :
            delayed                   ? colors.error   :
            r.status === 'en_curso'   ? colors.arena   :
            colors.chip;

          const ps = parseDate(r.start_date);
          const pe = parseDate(r.end_date);
          const px1 = ps ? xFor(ps, projectStart, projectEnd, CHART_W) : null;
          const px2 = pe ? xFor(pe, projectStart, projectEnd, CHART_W) : null;

          return (
            <View key={r.id}>
              <View style={[g.rowSep, { top: rowTop + ROW_H - StyleSheet.hairlineWidth }]} />

              {/* Label */}
              <View style={[g.labelWrap, { top: rowTop, height: ROW_H }]}>
                <Text style={g.rowLabel} numberOfLines={2}>{r.name}</Text>
              </View>

              {/* Single bar colored by status */}
              {px1 !== null && px2 !== null && px2 > px1 && (
                <Animated.View style={[g.bar, {
                  left: px1,
                  width: barProgress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(px2 - px1, 4)] }),
                  top: barTop,
                  backgroundColor: barBg,
                }]} />
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const g = StyleSheet.create({
  monthLabelWrap: { position: 'absolute', top: 0, height: HDR_H, alignItems: 'center', justifyContent: 'center' },
  monthLabel:     { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.5, textTransform: 'uppercase' },
  monthLine:      { position: 'absolute', bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  todayLine:      { position: 'absolute', top: HDR_H - 8, bottom: 0, width: 1.5, backgroundColor: colors.arena, zIndex: 5 },
  todayLabel:     { fontFamily: fonts.mono.regular, fontSize: 7, color: colors.arena, letterSpacing: 0.5, textAlign: 'center', marginLeft: -8, width: 18, marginTop: -4 },
  rowSep:         { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  labelWrap:      { position: 'absolute', left: 0, width: LABEL_W, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  rowLabel:       { fontFamily: fonts.archivo.bold, fontSize: 9.5, color: colors.crema, lineHeight: 13 },
  bar:            { position: 'absolute', height: BAR_H, borderRadius: BAR_R },
});

// ─── Rubro detail card ────────────────────────────────────────────────────────

function DetailCard({ r, today, index }: { r: DbRubro; today: Date; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 65),
      Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const delayed = isDelayed(r, today);
  const dev = deviation(r, today);

  let label = 'Sin iniciar', chipBg = colors.chip, chipColor = colors.faint;
  if (delayed)                   { label = 'Retrasado'; chipBg = 'rgba(192,57,43,0.09)'; chipColor = colors.error; }
  else if (r.status === 'completada') { label = 'Completado'; chipBg = 'rgba(74,124,89,0.10)';  chipColor = colors.success; }
  else if (r.status === 'en_curso')   { label = 'En curso';   chipBg = 'rgba(217,119,87,0.10)'; chipColor = colors.arena; }

  let cardBg = colors.panel;
  if (r.status === 'completada') cardBg = 'rgba(74,124,89,0.06)';
  else if (delayed)              cardBg = 'rgba(192,57,43,0.06)';
  else if (r.status === 'en_curso') cardBg = 'rgba(217,119,87,0.06)';

  return (
    <Animated.View style={{
      opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
    <View style={[s.detailCard, { backgroundColor: cardBg }]}>
      <View style={s.detailTop}>
        <Text style={s.detailName} numberOfLines={2}>{r.name}</Text>
        <View style={[s.chip, { backgroundColor: chipBg }]}>
          <Text style={[s.chipText, { color: chipColor }]}>{label}</Text>
        </View>
      </View>

      <View style={s.datesRow}>
        <View style={s.dateBlock}>
          <Text style={s.dateLabel}>PLANIFICADO</Text>
          <Text style={s.dateValue}>{fmtShort(r.start_date)} → {fmtShort(r.end_date)}</Text>
        </View>
        {r.actual_start_date ? (
          <View style={s.dateBlock}>
            <Text style={s.dateLabel}>REAL</Text>
            <Text style={s.dateValue}>
              {fmtShort(r.actual_start_date)} → {r.actual_end_date ? fmtShort(r.actual_end_date) : 'en curso'}
            </Text>
          </View>
        ) : null}
      </View>

      {dev !== null && (
        <View style={s.devRow}>
          {dev < 0 ? (
            <View style={[s.devChip, { backgroundColor: 'rgba(74,124,89,0.10)' }]}>
              <Text style={[s.devText, { color: colors.success }]}>{Math.abs(dev)} días antes de lo previsto</Text>
            </View>
          ) : dev > 0 ? (
            <View style={[s.devChip, { backgroundColor: 'rgba(192,57,43,0.09)' }]}>
              <Text style={[s.devText, { color: colors.error }]}>+{dev} días de retraso</Text>
            </View>
          ) : (
            <View style={[s.devChip, { backgroundColor: colors.chip }]}>
              <Text style={[s.devText, { color: colors.gris }]}>Finalizó en tiempo</Text>
            </View>
          )}
        </View>
      )}
    </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CronogramaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;

  const [project, setProject] = useState<DbProject | null>(null);
  const [rubros, setRubros] = useState<DbRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);

  async function handleExportPDF() {
    if (!project || exportingPDF) return;
    setExportingPDF(true);
    try {
      const html = buildReportHTML(project, rubros, new Date());
      const { uri } = await Print.printToFileAsync({ html });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Cronograma ${project.name}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      // silent — user can retry
    } finally {
      setExportingPDF(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!projectId) return;
      setLoading(true);
      Promise.all([
        supabase.from('projects').select('id, name, start_date, end_date, status').eq('id', projectId).single(),
        supabase.from('rubros')
          .select('id, name, contractor, status, start_date, end_date, actual_start_date, actual_end_date')
          .eq('project_id', projectId)
          .order('created_at'),
      ]).then(([projRes, rubrosRes]) => {
        if (projRes.data) setProject(projRes.data as DbProject);
        setRubros((rubrosRes.data as DbRubro[]) ?? []);
        setLoading(false);
      });
    }, [projectId])
  );

  if (loading) {
    return (
      <View style={[s.safe, s.center]}>
        <ActivityIndicator color={colors.crema} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[s.safe, s.center]}>
        <Text style={s.emptyText}>Proyecto no encontrado</Text>
      </View>
    );
  }

  const today = new Date();
  const projectStart = parseDate(project.start_date);
  const projectEnd   = parseDate(project.end_date);

  // Gantt range: min/max across ALL rubro dates, snapped to month boundaries
  const allDates: Date[] = [];
  if (projectStart) allDates.push(projectStart);
  if (projectEnd)   allDates.push(projectEnd);
  for (const r of rubros) {
    for (const d of [r.start_date, r.end_date, r.actual_start_date, r.actual_end_date]) {
      const p = parseDate(d);
      if (p) allDates.push(p);
    }
  }
  const ganttStart = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : projectStart;
  const ganttEnd = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : projectEnd;
  // Snap to month boundaries
  if (ganttStart) ganttStart.setDate(1);
  if (ganttEnd)   ganttEnd.setMonth(ganttEnd.getMonth() + 1, 0);

  const completed = rubros.filter(r => r.status === 'completada').length;
  const active    = rubros.filter(r => r.status === 'en_curso').length;
  const delayed   = rubros.filter(r => isDelayed(r, today)).length;

  let progressPct = 0;
  let daysLabel = '';
  if (projectStart && projectEnd) {
    const totalDays   = daysBetween(projectStart, projectEnd);
    const elapsedDays = daysBetween(projectStart, today);
    progressPct = Math.max(0, Math.min(1, elapsedDays / totalDays));
    const rem = daysBetween(today, projectEnd);
    daysLabel = rem > 0 ? `${rem} días restantes` : `${Math.abs(rem)} días de retraso`;
  }

  const isFinished = project.status === 'finalizado';

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle}>Cronograma</Text>
        </View>
        <TouchableOpacity style={s.circleBtn} onPress={handleExportPDF} activeOpacity={0.8} disabled={exportingPDF}>
          {exportingPDF
            ? <ActivityIndicator size="small" color={colors.crema} />
            : <Feather name="share" size={16} color={colors.crema} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Project header card */}
        <View style={s.projCard}>
          <Text style={s.projName}>{project.name}</Text>
          <View style={s.projMeta}>
            <View style={[s.statusPill, { backgroundColor: isFinished ? 'rgba(74,124,89,0.10)' : 'rgba(217,119,87,0.10)' }]}>
              <View style={[s.statusDot, { backgroundColor: isFinished ? colors.success : colors.arena }]} />
              <Text style={[s.statusPillText, { color: isFinished ? colors.success : colors.arena }]}>
                {isFinished ? 'FINALIZADO' : 'EN CURSO'}
              </Text>
            </View>
            {daysLabel ? <Text style={s.daysLabel}>{daysLabel}</Text> : null}
          </View>

          {projectStart && projectEnd && (
            <>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPct * 100}%` }]} />
                <View style={[s.todayTick, { left: `${progressPct * 100}%` }]} />
              </View>
              <View style={s.progressLabelRow}>
                <Text style={s.progressLabel}>{fmtShort(project.start_date)}</Text>
                <Text style={[s.progressLabel, { color: colors.arena }]}>HOY</Text>
                <Text style={s.progressLabel}>{fmtShort(project.end_date)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <CountUp value={completed} style={[s.statNum, { color: colors.success }]} />
            <Text style={s.statLabel}>Completados</Text>
          </View>
          <View style={s.stat}>
            <CountUp value={active} style={[s.statNum, { color: colors.arena }]} />
            <Text style={s.statLabel}>En curso</Text>
          </View>
          <View style={s.stat}>
            <CountUp value={delayed} style={[s.statNum, { color: delayed > 0 ? colors.error : colors.faint }]} />
            <Text style={s.statLabel}>Retrasados</Text>
          </View>
          <View style={s.stat}>
            <CountUp value={rubros.length} style={s.statNum} />
            <Text style={s.statLabel}>Total</Text>
          </View>
        </View>

        {/* Gantt */}
        <View style={s.ganttCard}>
          {ganttStart && ganttEnd ? (
            <>
              {/* Gantt legend */}
              <View style={s.ganttLegend}>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.chip }]} /><Text style={s.legendText}>Sin iniciar</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.arena }]} /><Text style={s.legendText}>En curso</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.error }]} /><Text style={s.legendText}>Retrasado</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.success }]} /><Text style={s.legendText}>Completado</Text></View>
              </View>
              <GanttChart rubros={rubros} projectStart={ganttStart} projectEnd={ganttEnd} />
              <Text style={s.scrollHint}>← deslizá para ver todo el cronograma</Text>
            </>
          ) : (
            <View style={s.noDate}>
              <Feather name="calendar" size={24} color={colors.faint} />
              <Text style={s.noDateText}>El proyecto no tiene fechas definidas</Text>
            </View>
          )}
        </View>

        {/* Rubro detail list */}
        <Text style={[s.sectionLabel, { marginTop: spacing.lg }]}>DETALLE POR RUBRO</Text>
        <View style={s.detailList}>
          {rubros.map((r, i) => <DetailCard key={r.id} r={r} today={today} index={i} />)}
          {rubros.length === 0 && (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>Sin rubros cargados</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.tinta },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 80 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  topCenter: { alignItems: 'center' },
  topEyebrow: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.4, color: colors.gris, textTransform: 'uppercase' },
  topTitle:   { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.3 },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },

  // Project card
  projCard: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
    backgroundColor: colors.panel, borderRadius: 22, padding: spacing.lg,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    gap: spacing.sm,
  },
  projName: { fontFamily: fonts.archivo.bold, fontSize: 20, color: colors.crema, letterSpacing: -0.4 },
  projMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: fonts.mono.regular, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  daysLabel:  { fontFamily: fonts.mono.regular, fontSize: 10.5, color: colors.gris, letterSpacing: 0.2 },
  progressTrack: { height: 5, backgroundColor: colors.chip, borderRadius: 3, overflow: 'visible', position: 'relative' },
  progressFill:  { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, backgroundColor: colors.arena },
  todayTick:     { position: 'absolute', top: -3, width: 3, height: 11, backgroundColor: colors.arena, borderRadius: 2, transform: [{ translateX: -1.5 }] },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.3, textTransform: 'uppercase' },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md },
  stat: {
    flex: 1, backgroundColor: colors.panel, borderRadius: 16, paddingVertical: spacing.md,
    alignItems: 'center', gap: 4,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statNum:   { fontFamily: fonts.archivo.bold, fontSize: 22, color: colors.crema, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.mono.regular, fontSize: 8.5, color: colors.gris, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Gantt
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.3, color: colors.gris,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  ganttCard: {
    marginHorizontal: spacing.xl, backgroundColor: colors.panel, borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  ganttLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 2 },
  legendText:  { fontFamily: fonts.mono.regular, fontSize: 8.5, color: colors.gris, textTransform: 'uppercase', letterSpacing: 0.5 },
  scrollHint:  { fontFamily: fonts.mono.regular, fontSize: 8, color: colors.faint, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase', paddingVertical: 8 },
  noDate:      { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  noDateText:  { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.faint },

  // Detail list
  detailList: { marginHorizontal: spacing.xl, gap: spacing.sm },
  detailCard: { borderRadius: 18, padding: spacing.md, gap: 8 },
  detailTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailName: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema, flex: 1, letterSpacing: -0.2 },
  chip:       { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 10, flexShrink: 0 },
  chipText:   { fontFamily: fonts.mono.regular, fontSize: 8.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  datesRow:   { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  dateBlock:  { gap: 3 },
  dateLabel:  { fontFamily: fonts.mono.regular, fontSize: 8, color: colors.gris, letterSpacing: 0.8, textTransform: 'uppercase' },
  dateValue:  { fontFamily: fonts.mono.regular, fontSize: 10.5, color: colors.crema, letterSpacing: 0.2 },
  devRow:     { flexDirection: 'row' },
  devChip:    { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  devText:    { fontFamily: fonts.mono.regular, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText:  { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },
});
