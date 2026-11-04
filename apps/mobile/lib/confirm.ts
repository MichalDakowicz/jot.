import { Alert, Platform } from 'react-native';

/**
 * react-native-web's Alert.alert is a no-op, so destructive confirmations
 * fall back to the browser's own dialog.
 */
export function confirmDestructive(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const { title, message, confirmLabel = 'Delete', onConfirm } = opts;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Keep it', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
