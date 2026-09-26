import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle, StyleProp } from 'react-native';

export const colors = {
  paper: '#FBF6EE', ink: '#493529', muted: '#786351', cocoa: '#765139',
  line: '#E2D2BC', cream: '#F0E4D3', honey: '#B88D5B', rust: '#A14E3B',
};
const glyphs = {
  home: '\ue88a', shop: '\ue8d1', create: '\ue3c9', arrow: '\ue5c8',
  back: '\ue5c4', close: '\ue5cd', person: '\ue7fd', book: '\ue865',
  heart: '\ue87e', search: '\ue8b6', check: '\ue5ca', mic: '\ue029',
  play: '\ue037', pause: '\ue034', trash: '\ue872', stop: '\ue047',
};
export function Icon({ name, size = 22, color = colors.ink }: {
  name: keyof typeof glyphs; size?: number; color?: string;
}) {
  return <Text accessible={false} style={{ fontFamily: 'Icons', fontSize: size, color, lineHeight: size + 2 }}>{glyphs[name]}</Text>;
}
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}
export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Button({ title, onPress, secondary = false, icon, style }: {
  title: string; onPress: () => void; secondary?: boolean;
  icon?: keyof typeof glyphs; style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, style, pressed && { opacity: 0.65 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>{title}</Text>
    {icon && <Icon name={icon} size={19} color={secondary ? colors.ink : colors.paper} />}
  </Pressable>;
}
export const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, color: colors.ink, marginBottom: 10, marginTop: 24 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 16, fontSize: 15, color: colors.ink, backgroundColor: colors.paper },
  error: { fontSize: 13, color: colors.rust, lineHeight: 20, marginVertical: 12 },
});
const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1.6, fontWeight: '500' },
  heading: { fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: -1, color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  button: { backgroundColor: colors.cocoa, minHeight: 50, paddingHorizontal: 22, borderRadius: 10, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.paper, fontSize: 14, fontWeight: '500' },
});
