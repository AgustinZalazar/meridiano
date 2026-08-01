import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { ONBOARDING_KEY } from './welcome';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => {
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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.tinta },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" />
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
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

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
    <AuthProvider>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
