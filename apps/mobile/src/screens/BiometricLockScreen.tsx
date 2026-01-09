import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import Card from "../components/Card";
import Screen from "../components/Screen";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../theme/theme";

export default function BiometricLockScreen() {
  const { unlockWithBiometrics } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await unlockWithBiometrics();
      if (!ok) {
        setError("Biometric check failed.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Biometric check failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Unlock LMS</Text>
        <Text style={styles.subtitle}>Confirm your identity to continue.</Text>
      </View>
      <Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={loading ? "Checking..." : "Unlock"} onPress={handleUnlock} disabled={loading} />
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: { text: string; muted: string; danger: string }) =>
  StyleSheet.create({
    hero: {
      marginBottom: 14
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 6
    },
    subtitle: {
      color: colors.muted
    },
    error: {
      color: colors.danger,
      marginBottom: 8
    }
  });
