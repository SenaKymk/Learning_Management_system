import { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/theme";

type ScreenProps = {
  children: ReactNode;
  padded?: boolean;
  scrollable?: boolean;
};

export default function Screen({ children, padded = true, scrollable = true }: ScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (scrollable) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={padded ? styles.padded : undefined}>
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.container, padded && styles.padded]}>{children}</View>;
}

const makeStyles = (colors: { background: string }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    padded: {
      padding: 16
    }
  });
