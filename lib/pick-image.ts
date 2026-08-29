import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export async function requestPhotoPermission(): Promise<boolean> {
  const { status, accessPrivileges } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status === 'granted') return true;

  // iOS: acceso limitado a fotos seleccionadas
  if (Platform.OS === 'ios' && accessPrivileges === 'limited') {
    Alert.alert(
      'Acceso limitado a fotos',
      'La app solo puede ver las fotos que seleccionaste. Para ver todas las fotos, habilitá "Todas las fotos" en Ajustes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }

  // Permiso denegado (iOS o Android)
  Alert.alert(
    'Sin acceso a fotos',
    'Habilitá el acceso a fotos en Ajustes para poder elegir una imagen.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}
