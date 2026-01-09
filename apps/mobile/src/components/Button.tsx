import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme/theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" ? styles.secondary : styles.primary,
        pressed && !isDisabled ? styles.pressed : undefined,
        isDisabled ? styles.disabled : undefined
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : null}
      {!loading ? (
        <>
          {icon}
          <Text style={variant === "secondary" ? styles.labelSecondary : styles.labelPrimary}>
            {label}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (colors: {
  primary: string;
  border: string;
  text: string;
  muted?: string;
}) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8
    },
    primary: {
      backgroundColor: colors.primary
    },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border
    },
    pressed: {
      opacity: 0.8
    },
    disabled: {
      opacity: 0.6
    },
    labelPrimary: {
      color: "#fff",
      fontWeight: "600"
    },
    labelSecondary: {
      color: colors.text,
      fontWeight: "600"
    }
  });
