import { ReactNode } from "react";
import { Pressable, Text } from "react-native";

export const colors = {
  paper: "#FBF6EE",
  ink: "#493529",
  muted: "#786351",
  cocoa: "#765139",
  line: "#E2D2BC",
  cream: "#F0E4D3",
  honey: "#B88D5B",
  rust: "#A14E3B",
};
const glyphs = {
  home: "\ue88a",
  create: "\ue3c9",
  arrow: "\ue5c8",
  back: "\ue5c4",
  close: "\ue5cd",
  person: "\ue7fd",
  book: "\ue865",
  heart: "\ue87e",
  search: "\ue8b6",
  check: "\ue5ca",
  mic: "\ue029",
  play: "\ue037",
  pause: "\ue034",
  trash: "\ue872",
  stop: "\ue047",
  drag: "\ue25d",
};
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: keyof typeof glyphs;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      accessible={false}
      className="font-icons"
      style={{ fontSize: size, color, lineHeight: size + 2 }}
    >
      {glyphs[name]}
    </Text>
  );
}
type TypographyProps = { children: ReactNode; className?: string };

export function Label({ children, className = "" }: TypographyProps) {
  return (
    <Text
      className={`text-[11px] font-medium tracking-[1.6px] text-muted ${className}`}
    >
      {children}
    </Text>
  );
}
export function Heading({ children, className = "" }: TypographyProps) {
  return (
    <Text
      className={`text-[30px] font-semibold leading-[38px] tracking-[-1px] text-ink ${className}`}
    >
      {children}
    </Text>
  );
}
export function Body({ children, className = "" }: TypographyProps) {
  return (
    <Text className={`text-[14px] leading-[22px] text-muted ${className}`}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  className = "",
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: keyof typeof glyphs;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      className={`min-h-[50px] flex-row items-center justify-center gap-3 rounded-[10px] px-[22px] active:opacity-[0.65] ${secondary ? "border border-line bg-transparent" : "bg-cocoa"} ${disabled ? "opacity-[0.65]" : ""} ${className}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        className={`text-[14px] font-medium ${secondary ? "text-ink" : "text-paper"}`}
      >
        {title}
      </Text>
      {icon && (
        <Icon
          name={icon}
          size={19}
          color={secondary ? colors.ink : colors.paper}
        />
      )}
    </Pressable>
  );
}
