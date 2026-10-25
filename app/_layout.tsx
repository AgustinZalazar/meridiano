import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import * as Font from 'expo-font';
import { Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { ToastProvider, useToast } from '../lib/toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { onboardingKey } from './welcome';
import { fonts } from '../constants/theme';
import { autoCloseStaleReports } from '../lib/informe-autoclose';
import { runSync, getPendingCount } from '../lib/offline/sync-engine';
import { useNetworkState } from '../lib/offline/network';

const ls = StyleSheet.create({
  offlinePill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(18,21,26,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    zIndex: 9999,
  },
  offlinePillText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !__DEV__,
});
import { SplashAnimation } from '../components/SplashAnimation';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);
  const lastAutoClose = useRef<string | null>(null);
  const isOnline = useNetworkState();
  const wasOnline = useRef(isOnline);

  // Sync queued offline operations when network comes back
  useEffect(() => {
    if (!session) return;
    const cameOnline = !wasOnline.current && isOnline;
    wasOnline.current = isOnline;
    if (!cameOnline) return;

    void (async () => {
      const pending = await getPendingCount();
      if (pending === 0) return;
      await runSync();
      toast.success(`${pending} ${pending === 1 ? 'cambio sincronizado' : 'cambios sincronizados'}`);
    })();
  }, [isOnline, session]);

  // Auto-close stale open reports when session is available and app comes to foreground
  useEffect(() => {
    if (!session) return;

    async function runAutoClose() {
      const today = new Date().toISOString().slice(0, 10);
      if (lastAutoClose.current === today) return;
      lastAutoClose.current = today;

      const result = await autoCloseStaleReports();
      for (const r of result.processed) {
        const d = new Date(r.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        toast.success(`Informe del ${d} (${r.rubroName}) procesado automáticamente`);
      }
    }

    void runAutoClose();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        void runAutoClose();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    if (loading) return;

    AsyncStorage.getItem(onboardingKey(session?.user.id ?? 'anonymous')).then((v) => {
      const onboardingSeen = v === 'true';
      const inAuth    = segments[0] === '(auth)';
      const inWelcome = segments[0] === 'welcome';

      if (!session && !inAuth) {
        router.replace('/(auth)/login');
      } else if (session && !onboardingSeen && !inWelcome) {
        router.replace('/welcome');
      } else if (session && onboardingSeen && inAuth) {
        router.replace('/(tabs)');
      }
    });
  }, [session, loading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.tinta },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(auth)/registro-invitado" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="proyecto/[id]" />
        <Stack.Screen name="proyecto/nueva"   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="proyecto/editar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="rubro/nueva" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="rubro/[id]"  options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="nueva-grabacion" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="procesando" />
        <Stack.Screen name="informe/[id]" />
        <Stack.Screen name="informe-dia/[rubroId]" />
        <Stack.Screen name="informe-dia/agregar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="invitar-miembro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="studio/crear" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="configuracion-informe" options={{ animation: 'slide_from_right' }} />
      </Stack>

      {!isOnline && (
        <View
          style={[ls.offlinePill, { top: insets.top + 8 }]}
          pointerEvents="none"
        >
          <Feather name="wifi-off" size={11} color="rgba(255,255,255,0.9)" />
          <Text style={ls.offlinePillText}>Sin señal</Text>
        </View>
      )}
    </View>
  );
}

// Wrapper lives inside AuthProvider so it can access useAuth
function SplashWrapper({ onDone }: { onDone: () => void }) {
  const { loading } = useAuth();
  return <SplashAnimation isReady={!loading} onDone={onDone} />;
}

export default Sentry.wrap(function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Archivo_600SemiBold,
      Archivo_700Bold,
      IBMPlexMono_400Regular,
      IBMPlexMono_500Medium,
    })
      .catch(() => {})
      .finally(() => setFontsReady(true));
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.tinta }} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <RootLayoutNav />
          {!splashDone && <SplashWrapper onDone={() => setSplashDone(true)} />}
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
});
