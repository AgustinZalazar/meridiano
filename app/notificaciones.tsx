import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';

type NotifType = 'informe' | 'miembro' | 'pendiente' | 'cambio';

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

const MOCK_NOTIFS: Notif[] = [
  { id: '1', type: 'informe', title: 'Informe generado', body: 'OB-002 · Instalaciones Eléctricas — 8 pendientes detectados.', time: 'Hace 5 min', unread: true },
  { id: '2', type: 'pendiente', title: 'Pendiente resuelto', body: 'Marco Téllez marcó como resuelto: "Estructura del deck exterior".', time: 'Hace 1 h', unread: true },
  { id: '3', type: 'cambio', title: 'Solicitud de cambio', body: 'Nueva solicitud de material en Torre Palermo — prioridad alta.', time: 'Hace 3 h', unread: true },
  { id: '4', type: 'miembro', title: 'Miembro unido', body: 'Sofía Lara aceptó la invitación al estudio.', time: 'Ayer', unread: false },
  { id: '5', type: 'informe', title: 'Informe generado', body: 'OB-001 · Estructura y Hormigón — sin pendientes.', time: 'Ayer', unread: false },
  { id: '6', type: 'pendiente', title: 'Pendiente en revisión', body: 'Daniel Ruiz inició revisión: "Cableado del tablero principal".', time: '20 JUL', unread: false },
  { id: '7', type: 'cambio', title: 'Solicitud aprobada', body: 'La solicitud de cambio de plazo en Residencial Nordelta fue aprobada.', time: '19 JUL', unread: false },
];

const NOTIF_ICON: Record<NotifType, React.ComponentProps<typeof Feather>['name']> = {
  informe: 'file-text',
  miembro: 'user-plus',
  pendiente: 'alert-circle',
  cambio: 'git-pull-request',
};

const NOTIF_COLOR: Record<NotifType, string> = {
  informe: colors.arena,
  miembro: colors.success,
  pendiente: '#C0392B',
  cambio: colors.gris,
};

function NotifRow({ notif }: { notif: Notif }) {
  const iconColor = NOTIF_COLOR[notif.type];
  return (
    <View style={[styles.row, notif.unread && styles.rowUnread]}>
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
        <Feather name={NOTIF_ICON[notif.type]} size={16} color={iconColor} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle}>{notif.title}</Text>
          {notif.unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowBody2} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.rowTime}>{notif.time}</Text>
      </View>
    </View>
  );
}

export default function NotificacionesScreen() {
  const router = useRouter();
  const unreadCount = MOCK_NOTIFS.filter((n) => n.unread).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.markAll}>Marcar todo leído</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>ACTIVIDAD</Text>
        <Text style={styles.heading}>
          {unreadCount > 0 ? `${unreadCount} nuevas` : 'Notificaciones'}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {MOCK_NOTIFS.map((n) => (
          <NotifRow key={n.id} notif={n} />
        ))}
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
  markAll: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.arena,
    textDecorationLine: 'underline',
  },
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: 4,
  },
  eyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.archivo.bold,
    fontSize: 28,
    color: colors.crema,
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 48,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUnread: {
    backgroundColor: 'rgba(217,119,87,0.03)',
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.arena,
  },
  rowBody2: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.gris,
    lineHeight: 18,
  },
  rowTime: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    color: colors.faint,
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
