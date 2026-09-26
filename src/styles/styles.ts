import { StyleSheet } from 'react-native';
import { colors } from '../components/ui';

export const appStyles = StyleSheet.create({
  inputDisabled: { backgroundColor: colors.cream, color: colors.muted },
  action: { marginTop: 20 },
  notice: { marginTop: 14, fontSize: 13, lineHeight: 20, color: colors.muted },
  switch: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontSize: 13, color: colors.ink },
});
