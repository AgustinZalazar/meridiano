import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PERMISSION_ASKED_KEY = 'informe_notif_permission_asked';
const REMINDER_HOUR = 18;  // first reminder at 18:00
const LAST_CALL_HOUR = 22; // second reminder at 22:00

const AUTO_CLOSE_LABEL = 'mañana al abrir la app';

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  ensureHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('informe-reminder', {
      name: 'Informe del día',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;

  const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (asked === 'true') return false;

  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

export async function scheduleInformeReminder(
  rubroId: string,
  rubroName: string,
  mediaCount: number,
): Promise<void> {
  const hasPermission = await ensurePermission();
  if (!hasPermission) return;

  await cancelInformeReminder(rubroId);

  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
  const plural = mediaCount === 1 ? 'elemento' : 'elementos';

  const cutoff = new Date(y, mo, d, 23, 45, 0);
  const scheduled: Promise<string>[] = [];

  // First reminder at 18:00 — if already past, schedule 15 min from now
  const first = new Date(y, mo, d, REMINDER_HOUR, 0, 0);
  if (first.getTime() <= now.getTime()) {
    first.setTime(now.getTime() + 15 * 60 * 1000);
  }
  if (first.getTime() < cutoff.getTime()) {
    scheduled.push(Notifications.scheduleNotificationAsync({
      identifier: `informe-reminder-${rubroId}-1`,
      content: {
        title: 'Informe del día sin cerrar',
        body: `Tenés ${mediaCount} ${plural} en ${rubroName} sin procesar. Se procesa automáticamente ${AUTO_CLOSE_LABEL}.`,
        data: { rubroId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: first },
    }));
  }

  // Last call at 22:00 — only if still before cutoff and first reminder already passed
  const lastCall = new Date(y, mo, d, LAST_CALL_HOUR, 0, 0);
  if (lastCall.getTime() > now.getTime() && lastCall.getTime() < cutoff.getTime()) {
    scheduled.push(Notifications.scheduleNotificationAsync({
      identifier: `informe-reminder-${rubroId}-2`,
      content: {
        title: '⏰ Último aviso — informe sin cerrar',
        body: `${rubroName}: se procesa automáticamente ${AUTO_CLOSE_LABEL}. Abrí la app para cerrarlo vos.`,
        data: { rubroId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: lastCall },
    }));
  }

  await Promise.all(scheduled);
}

export async function cancelInformeReminder(rubroId: string): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(`informe-reminder-${rubroId}-1`),
    Notifications.cancelScheduledNotificationAsync(`informe-reminder-${rubroId}-2`),
  ]);
}

export async function scheduleTestNotification(): Promise<void> {
  const hasPermission = await ensurePermission();
  if (!hasPermission) return;

  await Promise.all([
    Notifications.scheduleNotificationAsync({
      identifier: 'informe-reminder-test-1',
      content: {
        title: 'Informe del día sin cerrar',
        body: `Tenés 3 elementos en Estructuras sin procesar. Se procesa automáticamente ${AUTO_CLOSE_LABEL}.`,
        data: { test: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 5_000) },
    }),
    Notifications.scheduleNotificationAsync({
      identifier: 'informe-reminder-test-2',
      content: {
        title: '⏰ Último aviso — informe sin cerrar',
        body: `Estructuras: se procesa automáticamente ${AUTO_CLOSE_LABEL}. Abrí la app para cerrarlo vos.`,
        data: { test: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 10_000) },
    }),
  ]);
}
