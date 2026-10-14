import React, { type ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { colors, fonts, spacing } from '../constants/theme';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (__DEV__) {
      console.error('[ErrorBoundary] Unhandled error:', error.message);
      console.error('[ErrorBoundary] Component stack:', info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <View style={s.container}>
        <View style={s.iconWrap}>
          <Feather name="alert-triangle" size={32} color={colors.error} />
        </View>
        <Text style={s.title}>Algo salió mal</Text>
        <Text style={s.subtitle}>La pantalla encontró un error inesperado.</Text>

        {__DEV__ && (
          <ScrollView style={s.devBox}>
            <Text style={s.devText}>{error.message}</Text>
          </ScrollView>
        )}

        <TouchableOpacity style={s.btn} onPress={this.reset} activeOpacity={0.8}>
          <Feather name="refresh-cw" size={15} color="#FFF" />
          <Text style={s.btnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.tinta,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.md,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(192,69,53,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.archivo.bold, fontSize: 20,
    color: colors.crema, textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.archivo.semibold, fontSize: 14,
    color: colors.gris, textAlign: 'center', lineHeight: 20,
  },
  devBox: {
    maxHeight: 140, width: '100%',
    backgroundColor: 'rgba(192,69,53,0.08)',
    borderRadius: 10, padding: 12, marginTop: 4,
  },
  devText: {
    fontFamily: fonts.mono.regular, fontSize: 11,
    color: colors.error, lineHeight: 16,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 48, borderRadius: 24, paddingHorizontal: 28,
    backgroundColor: colors.crema, marginTop: spacing.sm,
  },
  btnText: {
    fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFF',
  },
});
