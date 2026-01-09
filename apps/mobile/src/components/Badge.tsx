import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";

type BadgeProps = {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
  icon?: ReactNode;
};

export default function Badge({ label, tone = "default", icon }: BadgeProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.badge, toneStyles(colors)[tone]]}>
      {icon}
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const toneStyles = (colors: { border: string; surface: string; success: string; warning: string; danger: string }) =>
  StyleSheet.create({
    default: {
      backgroundColor: colors.border
    },
    success: {
      backgroundColor: colors.success
    },
    warning: {
      backgroundColor: colors.warning
    },
    danger: {
      backgroundColor: colors.danger
    },
    muted: {
      backgroundColor: colors.surface
    }
  });

const makeStyles = (colors: { text: string }) =>
  StyleSheet.create({
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    text: {
      color: colors.text,
      fontWeight: "600"
    }
  });
