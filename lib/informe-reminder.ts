import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PERMISSION_ASKED_KEY = 'informe_notif_permission_asked';
const END_OF_DAY_HOUR = 18; // 18:00

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensurePermission(): Promise<boolean> {
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
  const trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), END_OF_DAY_HOUR, 0, 0);

  // Already past end-of-day hour → schedule 15 min from now
  if (trigger.getTime() <= now.getTime()) {
    trigger.setTime(now.getTime() + 15 * 60 * 1000);
  }

  // Too close to midnight → don't schedule
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 45, 0);
  if (trigger.getTime() > cutoff.getTime()) return;

  const plural = mediaCount === 1 ? 'elemento' : 'elementos';
  await Notifications.scheduleNotificationAsync({
    identifier: `informe-reminder-${rubroId}`,
    content: {
      title: 'Informe del día sin cerrar',
      body: `Tenés ${mediaCount} ${plural} en ${rubroName} sin procesar. Si no lo cerrás, se cierra automáticamente.`,
      data: { rubroId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });
}

export async function cancelInformeReminder(rubroId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`informe-reminder-${rubroId}`);
}
