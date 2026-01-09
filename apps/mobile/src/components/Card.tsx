import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/theme";

type CardProps = {
  children: ReactNode;
  padded?: boolean;
};

export default function Card({ children, padded = true }: CardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <View style={[styles.card, padded && styles.padded]}>{children}</View>;
}

const makeStyles = (colors: { surface: string; border: string }) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      marginBottom: 12
    },
    padded: {
      padding: 14
    }
  });
