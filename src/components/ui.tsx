import { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { Image } from "expo-image";
import { iconAssets } from "./icon-assets";

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
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: keyof typeof iconAssets;
  size?: number;
  color?: string;
}) {
  return (
    <Image
      source={iconAssets[name]}
      accessible={false}
      pointerEvents="none"
      contentFit="contain"
      contentPosition="center"
      tintColor={color}
      transition={0}
      cachePolicy="memory-disk"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
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
      className={`font-heading text-[58px] font-normal leading-[46px] tracking-[-1px] text-ink ${className}`}
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
  icon?: keyof typeof iconAssets;
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
