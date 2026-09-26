import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle, StyleProp } from 'react-native';
export const colors = {
  paper: '#F7F3E8',
  ink: '#303E30',
  muted: '#7C7C6B',
  green: '#4B5C3E',
  line: '#DDD8C8',
  cream: '#EFEBDF',
  gold: '#A38751',
  rust: '#A76750'
};
export const serif = 'Cormorant';
const glyphs = { bluetooth: '\ue1a7',
  home: '\ue88a',
  shop: '\ue8d1',
  create: '\ue3c9',
  arrow: '\ue5c8',
  back: '\ue5c4',
  close: '\ue5cd',
  person: '\ue7fd',
  leaf: '\uea35',
  book: '\ue865',
  heart: '\ue87e',
  search: '\ue8b6',
  check: '\ue5ca',
  star: '\ue838',
  logout: '\ue9ba',
  eye: '\ue8f4',
  sparkle: '\ue65f'
};
export function Icon({
  name,
  size = 22,
  color = colors.ink
}: {
  name: keyof typeof glyphs;
  size?: number;
  color?: string;
}) {
  return <Text accessible={false} style={{
    fontFamily: 'Icons',
    fontSize: size,
    color,
    lineHeight: size + 2
  }}>{glyphs[name]}</Text>;
}
export function Label({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[s.label, style]}>{children}</Text>;
}
export function Heading({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[s.heading, style]}>{children}</Text>;
}
export function Body({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[s.body, style]}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  icon,
  style
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: keyof typeof glyphs;
  style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({
    pressed
  }) => [s.button, secondary && s.secondary, style, pressed && {
    opacity: 0.72
  }]}><Text style={[s.buttonText, secondary && {
      color: colors.ink
    }]}>{title}</Text>{icon && <Icon name={icon} size={19} color={secondary ? colors.ink : colors.paper} />}</Pressable>;
}
export function Ornament() {
  return <View style={s.ornament}><View style={s.line} /><Text style={{
      color: colors.gold,
      fontSize: 21
    }}>❦</Text><View style={s.line} /></View>;
}
const s = StyleSheet.create({
  label: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: '600'
  },
  heading: {
    fontFamily: serif,
    fontSize: 38,
    lineHeight: 42,
    color: colors.ink
  },
  body: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.muted
  },
  button: {
    backgroundColor: colors.green,
    minHeight: 50,
    paddingHorizontal: 23,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line
  },
  buttonText: {
    color: colors.paper,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  ornament: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 23
  },
  line: {
    height: 1,
    backgroundColor: colors.line,
    width: 45
  }
});
